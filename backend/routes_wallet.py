"""
Wallet routes — for clients, vendors, delivery, and admin.

Endpoints:
  GET  /api/wallet/me                    - current user's wallet
  GET  /api/wallet/transactions          - own transaction history (paged)
  POST /api/wallet/recharge              - initiate a Mobile Money top-up (CAMPAY collect)
  GET  /api/wallet/recharge/{ref}        - check recharge status
  POST /api/webhooks/campay              - CAMPAY webhook (HMAC verified)
  POST /api/wallet/withdrawals           - request a withdrawal (vendor / delivery)
  GET  /api/wallet/withdrawals/me        - own withdrawal requests
"""
from fastapi import APIRouter, HTTPException, Request, Header, Depends
from datetime import datetime, timezone
from typing import Optional
import os
import logging

from auth import get_current_user
from routes_customer import get_current_customer
from wallet_models import (
    RechargeInitiate, RechargeRequest,
    WithdrawalRequest, WithdrawalCreate,
)
from wallet_security import generate_tx_reference
from wallet_service import (
    get_or_create_wallet, credit_recharge, write_audit, record_transaction,
    _update_wallet_balance, get_system_wallet,
)
from campay import campay_client

logger = logging.getLogger(__name__)

wallet_router = APIRouter()
webhook_router = APIRouter()


def get_db(request: Request):
    return request.app.state.db


def _serialize(doc: dict) -> dict:
    out = {}
    for k, v in doc.items():
        if isinstance(v, datetime):
            out[k] = v.isoformat()
        else:
            out[k] = v
    return out


# ============ Resolve actor (customer | vendor | delivery | admin) ============

async def _resolve_actor(request: Request, authorization: Optional[str]) -> dict:
    """Identify the caller across all authenticated roles.

    Returns dict: {id, role, name, phone}.
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Token requis")

    # Try customer token first (different shape: customer_id)
    try:
        customer = await get_current_customer(request, authorization)
        return {
            "id": customer["id"],
            "role": "customer",
            "name": customer.get("pseudo"),
            "phone": customer.get("phone"),
        }
    except HTTPException:
        # Customer JWT path failed — fall back to other roles
        pass
    except KeyError:
        # Token decoded but missing customer_id (it's a vendor/admin token) — fall back
        pass

    # Try vendor / delivery / admin token
    from fastapi.security import HTTPAuthorizationCredentials

    class Creds:
        def __init__(self, token):
            self.credentials = token

    creds = Creds(authorization.replace("Bearer ", ""))
    user = await get_current_user(creds, request)
    role = user["role"]
    # super_admin maps to a personal 'admin' wallet (system wallets are SYSTEM_ESCROW / SYSTEM_COMMISSIONS only)
    if role in ("super_admin", "admin"):
        role = "admin"
    return {
        "id": user["id"],
        "role": role,
        "name": user.get("name"),
        "phone": user.get("phone"),
    }


# ============ ENDPOINTS ============

@wallet_router.get("/me")
async def get_my_wallet(request: Request, authorization: str = Header(None), db=Depends(get_db)):
    actor = await _resolve_actor(request, authorization)
    wallet = await get_or_create_wallet(db, actor["id"], actor["role"])
    return wallet


@wallet_router.get("/transactions")
async def get_my_transactions(
    request: Request,
    limit: int = 50,
    skip: int = 0,
    authorization: str = Header(None),
    db=Depends(get_db),
):
    actor = await _resolve_actor(request, authorization)
    cursor = db.wallet_transactions.find(
        {"$or": [{"from_user_id": actor["id"]}, {"to_user_id": actor["id"]}]},
        {"_id": 0},
    ).sort("created_at", -1).skip(skip).limit(min(limit, 200))
    return await cursor.to_list(length=limit)


@wallet_router.post("/recharge")
async def initiate_recharge(
    data: RechargeInitiate,
    request: Request,
    authorization: str = Header(None),
    db=Depends(get_db),
):
    """Initiate a CAMPAY mobile-money top-up. Customer (or vendor/delivery) wallet recharge."""
    actor = await _resolve_actor(request, authorization)

    min_recharge = float(os.environ.get("MIN_RECHARGE", 500))
    if data.amount < min_recharge:
        raise HTTPException(status_code=400, detail=f"Montant minimum: {int(min_recharge)} FCFA")

    # Ensure wallet exists
    wallet = await get_or_create_wallet(db, actor["id"], actor["role"])
    if wallet.get("status") != "active":
        raise HTTPException(status_code=403, detail=f"Portefeuille {wallet.get('status')} — opération bloquée")

    external_ref = generate_tx_reference()

    # Persist recharge_request UPFRONT (status=pending). Update later with CAMPAY ref or failure.
    rr = RechargeRequest(
        user_id=actor["id"],
        role=actor["role"],
        amount=data.amount,
        phone=data.phone,
        external_reference=external_ref,
    ).model_dump()
    rr = _serialize(rr)
    await db.recharge_requests.insert_one(rr.copy())

    try:
        campay_resp = await campay_client.initiate_payment(
            amount=data.amount,
            phone=data.phone,
            external_reference=external_ref,
            description=f"HEMELEY Recharge {actor['role']} {actor['id'][:8]}",
        )
    except HTTPException as e:
        await db.recharge_requests.update_one(
            {"id": rr["id"]},
            {"$set": {"status": "failed", "failure_reason": str(e.detail)}},
        )
        raise
    except Exception as e:
        await db.recharge_requests.update_one(
            {"id": rr["id"]},
            {"$set": {"status": "failed", "failure_reason": str(e)}},
        )
        logger.error(f"Recharge initiation failed: {e}", exc_info=True)
        raise HTTPException(status_code=502, detail="Erreur CAMPAY")

    await db.recharge_requests.update_one(
        {"id": rr["id"]},
        {"$set": {
            "campay_reference": campay_resp.get("reference"),
            "operator": campay_resp.get("operator"),
        }},
    )

    await write_audit(
        db,
        actor_id=actor["id"],
        actor_role=actor["role"],
        action="wallet.recharge.initiate",
        target_user_id=actor["id"],
        details={"amount": data.amount, "phone": data.phone, "campay_ref": campay_resp.get("reference")},
    )

    return {
        "success": True,
        "reference": external_ref,
        "campay_reference": campay_resp.get("reference"),
        "message": "Veuillez confirmer la transaction sur votre téléphone",
        "campay_response": campay_resp,
    }


@wallet_router.get("/recharge/{ref}")
async def get_recharge_status(ref: str, request: Request, authorization: str = Header(None), db=Depends(get_db)):
    actor = await _resolve_actor(request, authorization)
    rr = await db.recharge_requests.find_one(
        {"$or": [{"external_reference": ref}, {"campay_reference": ref}], "user_id": actor["id"]},
        {"_id": 0},
    )
    if not rr:
        raise HTTPException(status_code=404, detail="Recharge introuvable")

    # If still pending, ask CAMPAY directly (covers cases where webhook is delayed)
    if rr.get("status") == "pending" and rr.get("campay_reference"):
        try:
            cstatus = await campay_client.get_payment_status(rr["campay_reference"])
            cstatus_value = (cstatus.get("status") or "").upper()
            if cstatus_value in ("SUCCESSFUL", "SUCCESS"):
                # Credit wallet (idempotent inside credit_recharge)
                from wallet_service import credit_recharge
                await credit_recharge(
                    db,
                    user_id=rr["user_id"],
                    role=rr["role"],
                    amount=float(rr["amount"]),
                    campay_reference=rr["campay_reference"],
                    external_reference=rr["external_reference"],
                )
                await db.recharge_requests.update_one(
                    {"id": rr["id"]},
                    {"$set": {"status": "successful", "completed_at": datetime.now(timezone.utc).isoformat()}},
                )
                rr["status"] = "successful"
            elif cstatus_value in ("FAILED", "CANCELED", "CANCELLED"):
                await db.recharge_requests.update_one(
                    {"id": rr["id"]},
                    {"$set": {"status": "failed", "failure_reason": cstatus.get("reason", "campay_failed")}},
                )
                rr["status"] = "failed"
        except Exception as e:
            logger.warning(f"CAMPAY status poll failed for {rr['campay_reference']}: {e}")
    return rr


# ============ WEBHOOK ============

@webhook_router.post("/campay")
async def campay_webhook(
    request: Request,
    x_campay_signature: str = Header(None),
    db=Depends(get_db),
):
    """CAMPAY webhook handler.

    Security:
      - Verifies HMAC-SHA256 signature with CAMPAY_WEBHOOK_KEY
      - Idempotent: re-processing the same campay_reference is a no-op
      - On failure to credit wallet (e.g. db error), increments retry counter
        — CAMPAY will retry the webhook automatically (up to 3 times configured by us)
    """
    raw_body = await request.body()
    body_str = raw_body.decode("utf-8") if raw_body else ""

    # Verify signature
    if not campay_client.verify_webhook_signature(body_str, x_campay_signature or ""):
        logger.warning(f"CAMPAY webhook: invalid signature")
        raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    campay_ref = payload.get("reference") or payload.get("operator_reference")
    external_ref = payload.get("external_reference")
    status = (payload.get("status") or "").upper()
    amount_str = payload.get("amount")

    logger.info(f"CAMPAY webhook received: ext_ref={external_ref} campay={campay_ref} status={status}")

    # Find matching recharge or order-payment
    rr = None
    if external_ref:
        rr = await db.recharge_requests.find_one({"external_reference": external_ref}, {"_id": 0})
    if not rr and campay_ref:
        rr = await db.recharge_requests.find_one({"campay_reference": campay_ref}, {"_id": 0})

    if not rr:
        # Not a recharge — could be a withdrawal payout confirmation
        wd = await db.withdrawal_requests.find_one(
            {"$or": [{"reference": external_ref}, {"campay_reference": campay_ref}]},
            {"_id": 0},
        )
        if wd:
            return await _process_withdrawal_callback(db, wd, status, payload)
        logger.warning(f"CAMPAY webhook: no matching recharge/withdrawal for {campay_ref}")
        return {"success": False, "message": "No matching transaction"}

    # Update recharge_requests row + handle retries
    new_attempts = int(rr.get("webhook_attempts", 0)) + 1
    update = {
        "webhook_attempts": new_attempts,
        "last_webhook_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        amount_val = float(amount_str) if amount_str else float(rr["amount"])
        # Validate amount matches
        if abs(amount_val - float(rr["amount"])) > 0.01:
            logger.error(f"Amount mismatch on {campay_ref}: webhook={amount_val} expected={rr['amount']}")
            update["status"] = "failed"
            update["failure_reason"] = "amount_mismatch"
            await db.recharge_requests.update_one({"id": rr["id"]}, {"$set": update})
            return {"success": False, "message": "Amount mismatch"}

        if status in ("SUCCESSFUL", "SUCCESS"):
            await credit_recharge(
                db,
                user_id=rr["user_id"],
                role=rr["role"],
                amount=amount_val,
                campay_reference=campay_ref or rr.get("campay_reference") or rr["external_reference"],
                external_reference=rr["external_reference"],
            )
            update["status"] = "successful"
            update["completed_at"] = datetime.now(timezone.utc).isoformat()
        elif status in ("FAILED", "CANCELED", "CANCELLED"):
            update["status"] = "failed"
            update["failure_reason"] = payload.get("reason", "campay_failed")
        else:
            # Unknown status — keep pending (retry will happen)
            update["status"] = "pending"

        await db.recharge_requests.update_one({"id": rr["id"]}, {"$set": update})
        return {"success": True, "status": update.get("status")}

    except HTTPException as e:
        # Mark failed but allow retry
        if new_attempts >= 3:
            update["status"] = "failed"
            update["failure_reason"] = str(e.detail)
        await db.recharge_requests.update_one({"id": rr["id"]}, {"$set": update})
        raise
    except Exception as e:
        logger.error(f"Webhook processing error: {e}", exc_info=True)
        if new_attempts >= 3:
            update["status"] = "failed"
            update["failure_reason"] = str(e)
        await db.recharge_requests.update_one({"id": rr["id"]}, {"$set": update})
        raise HTTPException(status_code=500, detail="Webhook processing error")


async def _process_withdrawal_callback(db, wd: dict, status: str, payload: dict) -> dict:
    """Update withdrawal status when CAMPAY confirms payout."""
    update = {}
    if status in ("SUCCESSFUL", "SUCCESS"):
        update["status"] = "paid"
        update["paid_at"] = datetime.now(timezone.utc).isoformat()
    elif status in ("FAILED", "CANCELED", "CANCELLED"):
        update["status"] = "failed"
        # On failure, refund the held balance back to wallet
        wallet = await db.wallets.find_one({"user_id": wd["user_id"], "role": wd["role"]}, {"_id": 0})
        if wallet:
            await _update_wallet_balance(db, wallet, delta_balance=float(wd["amount"]))
            await record_transaction(
                db,
                tx_type="withdrawal_reject",
                amount=float(wd["amount"]),
                to_wallet=wallet,
            description=f"Échec retrait — remboursement",
                campay_reference=payload.get("reference"),
                initiated_by="WEBHOOK",
            )
    if update:
        await db.withdrawal_requests.update_one({"id": wd["id"]}, {"$set": update})
    return {"success": True, "withdrawal_status": update.get("status")}


# ============ WITHDRAWAL ============

@wallet_router.post("/withdrawals")
async def request_withdrawal(
    data: WithdrawalCreate,
    request: Request,
    authorization: str = Header(None),
    db=Depends(get_db),
):
    """Vendor / delivery requests a withdrawal — held until Super Admin approves."""
    actor = await _resolve_actor(request, authorization)
    if actor["role"] not in ("vendor", "delivery"):
        raise HTTPException(status_code=403, detail="Seuls les vendeurs et livreurs peuvent demander un retrait")

    min_w = float(os.environ.get("MIN_RETRAIT", 2000))
    if data.amount < min_w:
        raise HTTPException(status_code=400, detail=f"Montant minimum: {int(min_w)} FCFA")

    wallet = await get_or_create_wallet(db, actor["id"], actor["role"])
    if wallet.get("status") != "active":
        raise HTTPException(status_code=403, detail=f"Portefeuille {wallet.get('status')} — opération bloquée")
    if float(wallet.get("balance", 0)) < data.amount:
        raise HTTPException(status_code=400, detail="Solde insuffisant")

    # Lock the funds: debit wallet now, refund if rejected
    wallet = await _update_wallet_balance(db, wallet, delta_balance=-data.amount)

    ref = generate_tx_reference()
    wd = WithdrawalRequest(
        reference=ref,
        user_id=actor["id"],
        role=actor["role"],
        user_name=actor.get("name"),
        amount=data.amount,
        phone=data.phone,
    ).model_dump()
    wd = _serialize(wd)
    await db.withdrawal_requests.insert_one(wd.copy())

    await record_transaction(
        db,
        tx_type="withdrawal_hold",
        amount=data.amount,
        from_wallet=wallet,
        description=f"Demande de retrait {ref}",
        reference=ref,
        initiated_by=actor["id"],
        initiated_role=actor["role"],
        status="pending",
    )

    await write_audit(
        db,
        actor_id=actor["id"],
        actor_role=actor["role"],
        action="withdrawal.request",
        target_user_id=actor["id"],
        target_resource=wd["id"],
        details={"amount": data.amount, "phone": data.phone},
    )

    return {"success": True, "reference": ref, "withdrawal": wd, "message": "Demande envoyée — en attente de validation"}


@wallet_router.get("/withdrawals/me")
async def get_my_withdrawals(
    request: Request,
    authorization: str = Header(None),
    db=Depends(get_db),
):
    actor = await _resolve_actor(request, authorization)
    items = await db.withdrawal_requests.find(
        {"user_id": actor["id"]},
        {"_id": 0},
    ).sort("created_at", -1).to_list(100)
    return items
