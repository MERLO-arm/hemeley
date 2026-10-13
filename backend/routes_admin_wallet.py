"""Super Admin wallet/finance routes."""
from fastapi import APIRouter, HTTPException, Depends, Request, Header
from datetime import datetime, timezone
import logging

from auth import require_role
from wallet_models import WithdrawalAction
from wallet_service import (
    get_or_create_wallet, get_system_wallet, _update_wallet_balance,
    record_transaction, write_audit,
)
from wallet_security import sign_wallet
from campay import campay_client
from realtime import emit_wallet_event

logger = logging.getLogger(__name__)
admin_wallet_router = APIRouter()


def get_db(request: Request):
    return request.app.state.db


@admin_wallet_router.get("/finance/overview")
async def finance_overview(
    user: dict = Depends(require_role("admin", "super_admin")),
    db=Depends(get_db),
):
    """Dashboard: escrow balance, commissions balance, totals per role, pending withdrawals."""
    escrow = await get_system_wallet(db, "escrow")
    commissions = await get_system_wallet(db, "commissions")

    # Aggregate balances by role
    pipeline = [{"$group": {"_id": "$role", "total": {"$sum": "$balance"}, "count": {"$sum": 1}}}]
    rows = await db.wallets.aggregate(pipeline).to_list(20)
    by_role = {r["_id"]: {"total": r["total"], "count": r["count"]} for r in rows}

    pending_withdrawals = await db.withdrawal_requests.count_documents({"status": "pending"})
    pending_amount_pipeline = [
        {"$match": {"status": "pending"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]
    pa = await db.withdrawal_requests.aggregate(pending_amount_pipeline).to_list(1)
    pending_total = pa[0]["total"] if pa else 0

    total_recharges_pipeline = [
        {"$match": {"type": "recharge", "status": "completed"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]
    tr = await db.wallet_transactions.aggregate(total_recharges_pipeline).to_list(1)
    total_recharges = tr[0]["total"] if tr else 0

    return {
        "escrow_balance": escrow.get("balance", 0),
        "escrow_held": escrow.get("held_balance", 0),
        "commissions_balance": commissions.get("balance", 0),
        "by_role": by_role,
        "pending_withdrawals_count": pending_withdrawals,
        "pending_withdrawals_amount": pending_total,
        "total_recharges": total_recharges,
    }


@admin_wallet_router.get("/wallets")
async def list_wallets(
    role: str = None,
    user: dict = Depends(require_role("admin", "super_admin")),
    db=Depends(get_db),
):
    q = {}
    if role:
        q["role"] = role
    wallets = await db.wallets.find(q, {"_id": 0}).sort("balance", -1).to_list(500)
    return wallets


@admin_wallet_router.get("/transactions")
async def list_transactions(
    limit: int = 100,
    skip: int = 0,
    type: str = None,
    user: dict = Depends(require_role("admin", "super_admin")),
    db=Depends(get_db),
):
    q = {}
    if type:
        q["type"] = type
    items = await db.wallet_transactions.find(q, {"_id": 0}).sort("created_at", -1).skip(skip).limit(min(limit, 500)).to_list(limit)
    return items


@admin_wallet_router.get("/audit-logs")
async def list_audit_logs(
    limit: int = 100,
    user: dict = Depends(require_role("admin", "super_admin")),
    db=Depends(get_db),
):
    items = await db.wallet_audit_logs.find({}, {"_id": 0}).sort("created_at", -1).limit(min(limit, 500)).to_list(limit)
    return items


@admin_wallet_router.put("/wallets/{wallet_id}/freeze")
async def freeze_wallet(
    wallet_id: str,
    user: dict = Depends(require_role("super_admin")),
    db=Depends(get_db),
):
    wallet = await db.wallets.find_one({"id": wallet_id}, {"_id": 0})
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet introuvable")

    new_version = int(wallet.get("version", 0)) + 1
    snap = {**wallet, "version": new_version, "status": "frozen"}
    integrity = sign_wallet(snap)
    await db.wallets.update_one(
        {"id": wallet_id},
        {"$set": {
            "status": "frozen",
            "version": new_version,
            "integrity_hash": integrity,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    await write_audit(
        db,
        actor_id=user["id"], actor_role=user["role"],
        action="wallet.freeze", target_user_id=wallet["user_id"], target_wallet_id=wallet_id,
    )
    return {"success": True, "wallet_id": wallet_id, "status": "frozen"}


@admin_wallet_router.put("/wallets/{wallet_id}/unfreeze")
async def unfreeze_wallet(
    wallet_id: str,
    user: dict = Depends(require_role("super_admin")),
    db=Depends(get_db),
):
    wallet = await db.wallets.find_one({"id": wallet_id}, {"_id": 0})
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet introuvable")

    new_version = int(wallet.get("version", 0)) + 1
    snap = {**wallet, "version": new_version, "status": "active"}
    integrity = sign_wallet(snap)
    await db.wallets.update_one(
        {"id": wallet_id},
        {"$set": {
            "status": "active",
            "version": new_version,
            "integrity_hash": integrity,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    await write_audit(
        db,
        actor_id=user["id"], actor_role=user["role"],
        action="wallet.unfreeze", target_user_id=wallet["user_id"], target_wallet_id=wallet_id,
    )
    return {"success": True, "wallet_id": wallet_id, "status": "active"}


# ============ WITHDRAWALS APPROVAL ============

@admin_wallet_router.get("/withdrawals")
async def list_withdrawals(
    status: str = None,
    user: dict = Depends(require_role("admin", "super_admin")),
    db=Depends(get_db),
):
    q = {}
    if status:
        q["status"] = status
    items = await db.withdrawal_requests.find(q, {"_id": 0}).sort("created_at", -1).limit(500).to_list(500)
    return items


@admin_wallet_router.post("/withdrawals/{wd_id}/approve")
async def approve_withdrawal(
    wd_id: str,
    request: Request,
    user: dict = Depends(require_role("super_admin")),
    db=Depends(get_db),
):
    wd = await db.withdrawal_requests.find_one({"id": wd_id}, {"_id": 0})
    if not wd:
        raise HTTPException(status_code=404, detail="Demande introuvable")
    if wd["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Demande déjà {wd['status']}")

    # Trigger CAMPAY payout
    try:
        campay_resp = await campay_client.initiate_withdrawal(
            amount=float(wd["amount"]),
            phone=wd["phone"],
            external_reference=wd["reference"],
            description=f"HEMELEY Retrait {wd['user_name'] or wd['user_id'][:8]}",
        )
        campay_ref = campay_resp.get("reference")
    except Exception as e:
        err_msg = e.detail if isinstance(e, HTTPException) else str(e)
        logger.error(f"CAMPAY withdrawal payout failed: {err_msg}", exc_info=True)
        # Refund the held amount back to wallet immediately
        wallet = await db.wallets.find_one({"user_id": wd["user_id"], "role": wd["role"]}, {"_id": 0})
        if wallet:
            await _update_wallet_balance(db, wallet, delta_balance=float(wd["amount"]))
            await record_transaction(
                db,
                tx_type="withdrawal_reject",
                amount=float(wd["amount"]),
                to_wallet=wallet,
                description=f"Échec payout CAMPAY - remboursement ({err_msg})",
                initiated_by=user["id"],
                initiated_role=user["role"],
            )
        await db.withdrawal_requests.update_one(
            {"id": wd_id},
            {"$set": {"status": "failed", "rejection_reason": err_msg}},
        )
        await write_audit(
            db,
            actor_id=user["id"], actor_role=user["role"],
            action="withdrawal.approve.failed",
            target_user_id=wd["user_id"], target_resource=wd_id,
            details={"amount": wd["amount"], "error": err_msg},
        )
        raise HTTPException(status_code=502, detail=f"Échec CAMPAY: {err_msg}")

    await db.withdrawal_requests.update_one(
        {"id": wd_id},
        {"$set": {
            "status": "approved",
            "approved_by": user["id"],
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "campay_reference": campay_ref,
        }},
    )

    await record_transaction(
        db,
        tx_type="withdrawal_payout",
        amount=float(wd["amount"]),
        description=f"Retrait approuvé {wd['reference']}",
        reference=wd["reference"],
        campay_reference=campay_ref,
        initiated_by=user["id"],
        initiated_role=user["role"],
        status="pending",  # Will become completed via webhook
    )

    await write_audit(
        db,
        actor_id=user["id"], actor_role=user["role"],
        action="withdrawal.approve",
        target_user_id=wd["user_id"], target_resource=wd_id,
        details={"amount": wd["amount"], "campay_ref": campay_ref},
    )

    await emit_wallet_event(
        event="withdrawal.approved",
        recipient_user_ids=[wd["user_id"]],
        payload={
            "withdrawal_id": wd_id,
            "amount": wd["amount"],
            "reference": wd["reference"],
            "phone": wd["phone"],
            "message": f"Retrait de {int(wd['amount'])} FCFA approuvé — versement en cours",
        },
    )

    return {"success": True, "campay_reference": campay_ref}


@admin_wallet_router.post("/withdrawals/{wd_id}/reject")
async def reject_withdrawal(
    wd_id: str,
    data: WithdrawalAction,
    user: dict = Depends(require_role("super_admin")),
    db=Depends(get_db),
):
    if not data.reason:
        raise HTTPException(status_code=400, detail="Motif de rejet requis")

    wd = await db.withdrawal_requests.find_one({"id": wd_id}, {"_id": 0})
    if not wd:
        raise HTTPException(status_code=404, detail="Demande introuvable")
    if wd["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Demande déjà {wd['status']}")

    # Refund held amount back to user wallet
    wallet = await db.wallets.find_one({"user_id": wd["user_id"], "role": wd["role"]}, {"_id": 0})
    if wallet:
        wallet = await _update_wallet_balance(db, wallet, delta_balance=float(wd["amount"]))
        await record_transaction(
            db,
            tx_type="withdrawal_reject",
            amount=float(wd["amount"]),
            to_wallet=wallet,
            description=f"Rejet retrait — {data.reason}",
            initiated_by=user["id"],
            initiated_role=user["role"],
        )

    await db.withdrawal_requests.update_one(
        {"id": wd_id},
        {"$set": {
            "status": "rejected",
            "rejection_reason": data.reason,
            "approved_by": user["id"],
            "approved_at": datetime.now(timezone.utc).isoformat(),
        }},
    )

    await write_audit(
        db,
        actor_id=user["id"], actor_role=user["role"],
        action="withdrawal.reject",
        target_user_id=wd["user_id"], target_resource=wd_id,
        details={"reason": data.reason, "amount": wd["amount"]},
    )

    await emit_wallet_event(
        event="withdrawal.rejected",
        recipient_user_ids=[wd["user_id"]],
        payload={
            "withdrawal_id": wd_id,
            "amount": wd["amount"],
            "reference": wd["reference"],
            "reason": data.reason,
            "message": f"Retrait rejeté — {int(wd['amount'])} FCFA remboursés au wallet",
        },
    )

    return {"success": True}


# ============ MANUAL ADJUSTMENT (super admin only) ============

@admin_wallet_router.post("/wallets/{wallet_id}/adjust")
async def adjust_wallet(
    wallet_id: str,
    request: Request,
    user: dict = Depends(require_role("super_admin")),
    db=Depends(get_db),
):
    body = await request.json()
    delta = float(body.get("delta", 0))
    reason = body.get("reason", "Ajustement administratif")
    if delta == 0:
        raise HTTPException(status_code=400, detail="Delta requis")

    wallet = await db.wallets.find_one({"id": wallet_id}, {"_id": 0})
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet introuvable")

    wallet = await _update_wallet_balance(db, wallet, delta_balance=delta)
    await record_transaction(
        db,
        tx_type="adjustment",
        amount=abs(delta),
        to_wallet=wallet if delta > 0 else None,
        from_wallet=wallet if delta < 0 else None,
        description=reason,
        initiated_by=user["id"],
        initiated_role=user["role"],
    )
    await write_audit(
        db,
        actor_id=user["id"], actor_role=user["role"],
        action="wallet.adjust", target_user_id=wallet["user_id"], target_wallet_id=wallet_id,
        details={"delta": delta, "reason": reason},
    )
    return {"success": True, "wallet": wallet}
