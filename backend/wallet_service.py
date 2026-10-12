"""
Wallet service — core ledger operations.

All wallet movements MUST go through this module. It guarantees:
- Atomic balance updates with optimistic concurrency (version field)
- HMAC integrity signature on wallet snapshots and transactions
- Append-only audit log
- Idempotent transactions via unique reference
- Prevention of negative balances and frozen wallets
"""
from datetime import datetime, timezone
from typing import Optional
from fastapi import HTTPException
import logging
import os

from wallet_models import Wallet, WalletTransaction, WalletAuditLog
from wallet_security import (
    sign_wallet, sign_transaction, generate_tx_reference,
    SYSTEM_ESCROW_USER_ID, SYSTEM_COMMISSIONS_USER_ID,
)
from realtime import emit_wallet_event

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _serialize(doc: dict) -> dict:
    """Convert datetimes to ISO strings for Mongo-friendly storage."""
    out = {}
    for k, v in doc.items():
        if isinstance(v, datetime):
            out[k] = v.isoformat()
        else:
            out[k] = v
    return out


# ============ WALLET CRUD ============

async def get_or_create_wallet(db, user_id: str, role: str) -> dict:
    """Fetch a wallet by user_id+role; create one on first access."""
    existing = await db.wallets.find_one({"user_id": user_id, "role": role}, {"_id": 0})
    if existing:
        return existing

    wallet = Wallet(user_id=user_id, role=role).model_dump()
    wallet["integrity_hash"] = sign_wallet(wallet)
    wallet = _serialize(wallet)
    await db.wallets.insert_one(wallet.copy())
    return await db.wallets.find_one({"id": wallet["id"]}, {"_id": 0})


async def get_system_wallet(db, kind: str) -> dict:
    """kind = 'escrow' | 'commissions'"""
    if kind == "escrow":
        return await get_or_create_wallet(db, SYSTEM_ESCROW_USER_ID, "admin_escrow")
    if kind == "commissions":
        return await get_or_create_wallet(db, SYSTEM_COMMISSIONS_USER_ID, "admin_commissions")
    raise ValueError(f"Unknown system wallet: {kind}")


async def _update_wallet_balance(
    db,
    wallet: dict,
    delta_balance: float = 0.0,
    delta_held: float = 0.0,
) -> dict:
    """Atomic balance update with optimistic concurrency on version field.

    Raises HTTPException if wallet is frozen, would go negative, or version mismatch.
    """
    if wallet.get("status") != "active":
        raise HTTPException(status_code=403, detail=f"Portefeuille {wallet.get('status')} — opération bloquée")

    new_balance = round(float(wallet.get("balance", 0.0)) + delta_balance, 2)
    new_held = round(float(wallet.get("held_balance", 0.0)) + delta_held, 2)

    if new_balance < 0:
        raise HTTPException(status_code=400, detail="Solde insuffisant")
    if new_held < 0:
        raise HTTPException(status_code=400, detail="Solde escrow insuffisant")

    new_version = int(wallet.get("version", 0)) + 1
    snapshot = {
        "id": wallet["id"],
        "user_id": wallet["user_id"],
        "role": wallet["role"],
        "balance": new_balance,
        "held_balance": new_held,
        "status": wallet.get("status", "active"),
        "version": new_version,
    }
    integrity = sign_wallet(snapshot)

    result = await db.wallets.update_one(
        {"id": wallet["id"], "version": wallet.get("version", 0)},
        {
            "$set": {
                "balance": new_balance,
                "held_balance": new_held,
                "version": new_version,
                "integrity_hash": integrity,
                "updated_at": _now_iso(),
            }
        },
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=409, detail="Conflit de concurrence — réessayez")

    return await db.wallets.find_one({"id": wallet["id"]}, {"_id": 0})


# ============ TRANSACTIONS ============

async def record_transaction(
    db,
    *,
    tx_type: str,
    amount: float,
    from_wallet: Optional[dict] = None,
    to_wallet: Optional[dict] = None,
    description: str = "",
    order_id: Optional[str] = None,
    order_number: Optional[str] = None,
    campay_reference: Optional[str] = None,
    initiated_by: str = "SYSTEM",
    initiated_role: str = "system",
    metadata: Optional[dict] = None,
    reference: Optional[str] = None,
    status: str = "completed",
) -> dict:
    """Insert a transaction ledger entry (signed)."""
    tx = WalletTransaction(
        reference=reference or generate_tx_reference(),
        type=tx_type,
        status=status,
        amount=round(float(amount), 2),
        from_wallet_id=from_wallet.get("id") if from_wallet else None,
        from_user_id=from_wallet.get("user_id") if from_wallet else None,
        from_role=from_wallet.get("role") if from_wallet else None,
        to_wallet_id=to_wallet.get("id") if to_wallet else None,
        to_user_id=to_wallet.get("user_id") if to_wallet else None,
        to_role=to_wallet.get("role") if to_wallet else None,
        order_id=order_id,
        order_number=order_number,
        campay_reference=campay_reference,
        description=description,
        metadata=metadata,
        initiated_by=initiated_by,
        initiated_role=initiated_role,
        completed_at=datetime.now(timezone.utc) if status == "completed" else None,
    ).model_dump()

    tx["signature"] = sign_transaction(tx)
    tx = _serialize(tx)
    await db.wallet_transactions.insert_one(tx.copy())
    return tx


async def write_audit(
    db,
    *,
    actor_id: str,
    actor_role: str,
    action: str,
    target_user_id: Optional[str] = None,
    target_wallet_id: Optional[str] = None,
    target_resource: Optional[str] = None,
    details: Optional[dict] = None,
    ip: Optional[str] = None,
) -> None:
    log = WalletAuditLog(
        actor_id=actor_id,
        actor_role=actor_role,
        action=action,
        target_user_id=target_user_id,
        target_wallet_id=target_wallet_id,
        target_resource=target_resource,
        details=details,
        ip_address=ip,
    ).model_dump()
    log = _serialize(log)
    await db.wallet_audit_logs.insert_one(log)


# ============ HIGH-LEVEL OPERATIONS ============

async def credit_recharge(
    db,
    *,
    user_id: str,
    role: str,
    amount: float,
    campay_reference: str,
    external_reference: str,
    ip: Optional[str] = None,
) -> dict:
    """Credit a customer/vendor/delivery wallet after a successful Mobile Money top-up.
    Idempotent: if a transaction already exists with this campay_reference and SUCCESS,
    we return without double-crediting.
    """
    # Idempotency check
    existing = await db.wallet_transactions.find_one({
        "campay_reference": campay_reference,
        "type": "recharge",
        "status": "completed",
    })
    if existing:
        logger.info(f"Recharge {campay_reference} already processed — skipping")
        return {"already_processed": True}

    wallet = await get_or_create_wallet(db, user_id, role)
    wallet = await _update_wallet_balance(db, wallet, delta_balance=amount)

    tx = await record_transaction(
        db,
        tx_type="recharge",
        amount=amount,
        to_wallet=wallet,
        description=f"Recharge Mobile Money (CAMPAY {campay_reference})",
        campay_reference=campay_reference,
        reference=external_reference,
        initiated_by="WEBHOOK",
        initiated_role="system",
    )

    await write_audit(
        db,
        actor_id="SYSTEM",
        actor_role="webhook",
        action="wallet.recharge.success",
        target_user_id=user_id,
        target_wallet_id=wallet["id"],
        details={"amount": amount, "campay_reference": campay_reference},
        ip=ip,
    )
    # Real-time notification
    await emit_wallet_event(
        event="wallet.recharge.success",
        recipient_user_ids=[user_id],
        payload={
            "amount": amount,
            "new_balance": wallet["balance"],
            "campay_reference": campay_reference,
            "tx_reference": tx["reference"],
            "message": f"Recharge de {int(amount)} FCFA réussie",
        },
    )
    return {"wallet": wallet, "transaction": tx}


async def hold_escrow_for_order(
    db,
    *,
    customer_id: str,
    order_id: str,
    order_number: str,
    total: float,
    description: str = "Paiement commande",
    ip: Optional[str] = None,
) -> dict:
    """Move funds from customer wallet to admin escrow (HOLD).
    Used at checkout when customer chooses 'Pay with wallet'.
    """
    customer_wallet = await get_or_create_wallet(db, customer_id, "customer")
    if float(customer_wallet.get("balance", 0)) < total:
        raise HTTPException(status_code=400, detail="Solde wallet insuffisant")

    escrow = await get_system_wallet(db, "escrow")

    customer_wallet = await _update_wallet_balance(db, customer_wallet, delta_balance=-total)
    escrow = await _update_wallet_balance(db, escrow, delta_balance=total, delta_held=total)

    tx = await record_transaction(
        db,
        tx_type="order_payment",
        amount=total,
        from_wallet=customer_wallet,
        to_wallet=escrow,
        description=description,
        order_id=order_id,
        order_number=order_number,
        initiated_by=customer_id,
        initiated_role="customer",
    )

    await write_audit(
        db,
        actor_id=customer_id,
        actor_role="customer",
        action="order.escrow.hold",
        target_user_id=customer_id,
        target_resource=order_id,
        details={"order_number": order_number, "amount": total},
        ip=ip,
    )

    # Real-time notification — debit confirmation for customer
    await emit_wallet_event(
        event="order.paid",
        recipient_user_ids=[customer_id],
        payload={
            "amount": total,
            "order_id": order_id,
            "order_number": order_number,
            "new_balance": customer_wallet["balance"],
            "tx_reference": tx["reference"],
            "message": f"Commande {order_number} payée ({int(total)} FCFA)",
        },
    )

    return {"customer_wallet": customer_wallet, "escrow": escrow, "transaction": tx}


async def release_escrow_to_vendor_and_delivery(
    db,
    *,
    order: dict,
    ip: Optional[str] = None,
) -> dict:
    """Called when an order becomes 'delivered' — split the held escrow:
    - commission_rate of total -> admin_commissions
    - delivery_fee -> delivery wallet (if any)
    - remainder -> vendor wallet
    """
    order_id = order["id"]
    order_number = order["order_number"]
    total = float(order["total"])
    delivery_fee = float(order.get("delivery_fee", 0) or 0)
    commission_rate = float(os.environ.get("HEMELEY_COMMISSION_RATE", 0.15))

    # Idempotency: skip if release already done
    existing = await db.wallet_transactions.find_one({
        "order_id": order_id,
        "type": "escrow_release_vendor",
        "status": "completed",
    })
    if existing:
        return {"already_released": True}

    commission = round(total * commission_rate, 2)
    vendor_share = round(total - commission - delivery_fee, 2)

    if vendor_share < 0:
        # safety: reduce commission so vendor gets at least 0
        vendor_share = 0
        commission = round(total - delivery_fee, 2)

    escrow = await get_system_wallet(db, "escrow")
    commissions = await get_system_wallet(db, "commissions")

    # Release total from escrow (release the held portion)
    escrow = await _update_wallet_balance(db, escrow, delta_balance=-total, delta_held=-total)

    # Credit commission to system commissions wallet
    if commission > 0:
        commissions = await _update_wallet_balance(db, commissions, delta_balance=commission)
        await record_transaction(
            db,
            tx_type="commission",
            amount=commission,
            from_wallet=escrow,
            to_wallet=commissions,
            description=f"Commission HEMELEY ({int(commission_rate*100)}%) commande {order_number}",
            order_id=order_id,
            order_number=order_number,
            initiated_by="SYSTEM",
        )

    # Credit delivery wallet
    if delivery_fee > 0 and order.get("delivery_id"):
        dwallet = await get_or_create_wallet(db, order["delivery_id"], "delivery")
        dwallet = await _update_wallet_balance(db, dwallet, delta_balance=delivery_fee)
        await record_transaction(
            db,
            tx_type="escrow_release_delivery",
            amount=delivery_fee,
            from_wallet=escrow,
            to_wallet=dwallet,
            description=f"Frais livraison commande {order_number}",
            order_id=order_id,
            order_number=order_number,
            initiated_by="SYSTEM",
        )

    # Credit vendor wallet
    if vendor_share > 0:
        vwallet = await get_or_create_wallet(db, order["vendor_id"], "vendor")
        vwallet = await _update_wallet_balance(db, vwallet, delta_balance=vendor_share)
        await record_transaction(
            db,
            tx_type="escrow_release_vendor",
            amount=vendor_share,
            from_wallet=escrow,
            to_wallet=vwallet,
            description=f"Versement commande {order_number}",
            order_id=order_id,
            order_number=order_number,
            initiated_by="SYSTEM",
        )

    await write_audit(
        db,
        actor_id="SYSTEM",
        actor_role="system",
        action="order.escrow.release",
        target_resource=order_id,
        details={
            "order_number": order_number,
            "total": total,
            "vendor_share": vendor_share,
            "delivery_fee": delivery_fee,
            "commission": commission,
        },
        ip=ip,
    )

    # Real-time notifications for vendor + delivery
    recipients = [order.get("vendor_id")]
    if order.get("delivery_id"):
        recipients.append(order["delivery_id"])
    recipients = [r for r in recipients if r]
    await emit_wallet_event(
        event="escrow.released",
        recipient_user_ids=recipients,
        payload={
            "order_id": order_id,
            "order_number": order_number,
            "vendor_share": vendor_share,
            "delivery_fee": delivery_fee,
            "commission": commission,
            "message": f"Commande {order_number} livrée — versement effectué",
        },
    )

    return {
        "vendor_share": vendor_share,
        "delivery_fee": delivery_fee,
        "commission": commission,
    }


async def refund_escrow_to_customer(
    db,
    *,
    customer_id: str,
    order_id: str,
    order_number: str,
    total: float,
    reason: str = "Annulation commande",
    actor_id: str = "SYSTEM",
    actor_role: str = "system",
    ip: Optional[str] = None,
) -> dict:
    """Cancellation: move funds back from escrow to customer wallet."""
    existing = await db.wallet_transactions.find_one({
        "order_id": order_id,
        "type": "refund",
        "status": "completed",
    })
    if existing:
        return {"already_refunded": True}

    escrow = await get_system_wallet(db, "escrow")
    customer_wallet = await get_or_create_wallet(db, customer_id, "customer")

    escrow = await _update_wallet_balance(db, escrow, delta_balance=-total, delta_held=-total)
    customer_wallet = await _update_wallet_balance(db, customer_wallet, delta_balance=total)

    tx = await record_transaction(
        db,
        tx_type="refund",
        amount=total,
        from_wallet=escrow,
        to_wallet=customer_wallet,
        description=f"Remboursement: {reason}",
        order_id=order_id,
        order_number=order_number,
        initiated_by=actor_id,
        initiated_role=actor_role,
    )

    await write_audit(
        db,
        actor_id=actor_id,
        actor_role=actor_role,
        action="order.escrow.refund",
        target_user_id=customer_id,
        target_resource=order_id,
        details={"order_number": order_number, "amount": total, "reason": reason},
        ip=ip,
    )

    # Real-time notification for customer
    await emit_wallet_event(
        event="order.refunded",
        recipient_user_ids=[customer_id],
        payload={
            "amount": total,
            "order_id": order_id,
            "order_number": order_number,
            "new_balance": customer_wallet["balance"],
            "reason": reason,
            "message": f"Commande {order_number} remboursée — {int(total)} FCFA",
        },
    )

    return {"customer_wallet": customer_wallet, "escrow": escrow, "transaction": tx}
