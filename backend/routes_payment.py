from fastapi import APIRouter, HTTPException, Depends, Request, Header
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorDatabase
from models import OrderCreate, Order, Transaction, PaymentInitiate, PaymentWebhook
from campay import campay_client, normalize_cm_phone
from utils import calculate_distance, calculate_delivery_fee
from datetime import datetime, timezone
from typing import Optional
import logging
import json
import uuid

logger = logging.getLogger(__name__)

payment_router = APIRouter()
campay_router = APIRouter()


class CampayCollectIn(BaseModel):
    amount: int = Field(..., ge=25, description="Montant entier en XAF (min 25)")
    phone: str = Field(..., description="Numéro Mobile Money (237XXXXXXXXX)")
    description: Optional[str] = "HEMELEY"
    external_reference: Optional[str] = None

def get_db(request: Request):
    return request.app.state.db


@campay_router.post("/campay/collect")
async def campay_collect(payload: CampayCollectIn, request: Request):
    """Endpoint direct CamPay /collect/ — POST raw vers https://demo.campay.net/api/collect/.

    Validations :
      - amount entier minimum 25 FCFA (Pydantic ge=25)
      - numéro forcé en format 237XXXXXXXXX
      - external_reference auto-généré si absent

    Retourne : { reference, ussd_code, operator, status, external_reference }
    """
    ext_ref = payload.external_reference or f"HEMELEY-{uuid.uuid4().hex[:12]}"
    normalized = normalize_cm_phone(payload.phone)
    db = request.app.state.db

    campay_resp = await campay_client.initiate_payment(
        amount=payload.amount,
        phone=normalized,
        external_reference=ext_ref,
        description=payload.description or "HEMELEY",
    )

    # Persistance lightweight pour audit / polling
    try:
        await db.campay_transactions.insert_one({
            "external_reference": ext_ref,
            "campay_reference": campay_resp.get("reference"),
            "amount": payload.amount,
            "phone": normalized,
            "description": payload.description,
            "status": "PENDING",
            "raw_initiate": campay_resp,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        logger.warning(f"campay_transactions persist failed: {e}")

    return {
        "success": True,
        "reference": campay_resp.get("reference"),
        "external_reference": ext_ref,
        "ussd_code": campay_resp.get("ussd_code"),
        "operator": campay_resp.get("operator"),
        "status": campay_resp.get("status", "PENDING"),
        "amount": payload.amount,
        "phone": normalized,
    }


@campay_router.get("/campay/status/{reference}")
async def campay_status(reference: str, request: Request):
    """Endpoint direct CamPay /transaction/{reference}/ — GET raw.

    Retourne le statut CamPay tel quel + la version normalisée
    ("SUCCESSFUL" | "FAILED" | "CANCELLED" | "PENDING") pour usage frontend.
    """
    cstatus = await campay_client.get_payment_status(reference)
    raw_status = (cstatus.get("status") or "").upper()
    db = request.app.state.db

    normalized_status = "PENDING"
    if raw_status in ("SUCCESSFUL", "SUCCESS"):
        normalized_status = "SUCCESSFUL"
    elif raw_status in ("FAILED",):
        normalized_status = "FAILED"
    elif raw_status in ("CANCELED", "CANCELLED"):
        normalized_status = "CANCELLED"

    # Mise à jour de la persistance locale
    try:
        await db.campay_transactions.update_one(
            {"campay_reference": reference},
            {"$set": {
                "status": normalized_status,
                "raw_status": cstatus,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
    except Exception as e:
        logger.warning(f"campay_transactions update failed: {e}")

    return {
        "reference": reference,
        "status": normalized_status,
        "raw_status": raw_status,
        "amount": cstatus.get("amount"),
        "currency": cstatus.get("currency"),
        "operator": cstatus.get("operator"),
        "phone": cstatus.get("phone_number") or cstatus.get("phone"),
        "external_reference": cstatus.get("external_reference"),
        "reason": cstatus.get("reason"),
    }

@payment_router.post("/campay/initiate")
async def initiate_campay_payment(payment_data: PaymentInitiate, db = Depends(get_db)):
    """
    Initiate CAMPAY payment for an order
    """
    # Get order
    order = await db.orders.find_one({"id": payment_data.order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["payment_status"] == "success":
        raise HTTPException(status_code=400, detail="Order already paid")
    
    try:
        # Initiate payment with CAMPAY
        reference = f"{order['order_number']}_{int(datetime.now().timestamp())}"
        
        campay_response = await campay_client.initiate_payment(
            amount=order["total"],
            phone=payment_data.customer_phone,
            external_reference=reference,
            description=f"Commande HEMELEY #{order['order_number']}"
        )
        
        # Create transaction record
        transaction = Transaction(
            order_id=order["id"],
            order_number=order["order_number"],
            amount=order["total"],
            currency="XAF",
            payment_method=order["payment_method"],
            reference=reference,
            status="pending",
            provider_response=campay_response
        )
        
        # Save transaction
        trans_doc = transaction.model_dump()
        trans_doc['created_at'] = trans_doc['created_at'].isoformat()
        await db.transactions.insert_one(trans_doc)
        
        # Update order with payment reference
        await db.orders.update_one(
            {"id": payment_data.order_id},
            {"$set": {"payment_reference": reference}}
        )
        
        return {
            "success": True,
            "reference": reference,
            "campay_response": campay_response,
            "message": "Paiement initié avec succès"
        }
        
    except Exception as e:
        logger.error(f"Payment initiation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Payment initiation failed: {str(e)}")

@payment_router.post("/campay/webhook")
async def campay_webhook(
    request: Request,
    webhook_data: PaymentWebhook,
    x_campay_signature: str = Header(None),
    db = Depends(get_db)
):
    """
    CAMPAY webhook handler - called by CAMPAY when payment status changes
    """
    # Verify webhook signature
    body = await request.body()
    if not campay_client.verify_webhook_signature(body.decode(), x_campay_signature or ""):
        logger.warning("Invalid webhook signature")
        raise HTTPException(status_code=401, detail="Invalid signature")
    
    try:
        # Find transaction by reference
        transaction = await db.transactions.find_one(
            {"reference": webhook_data.reference},
            {"_id": 0}
        )
        
        if not transaction:
            logger.warning(f"Transaction not found for reference: {webhook_data.reference}")
            return {"success": False, "message": "Transaction not found"}
        
        # Validate amount
        webhook_amount = float(webhook_data.amount)
        if abs(webhook_amount - transaction["amount"]) > 0.01:
            logger.error(f"Amount mismatch: expected {transaction['amount']}, got {webhook_amount}")
            raise HTTPException(status_code=400, detail="Amount mismatch")
        
        # Validate currency
        if webhook_data.currency != "XAF":
            logger.error(f"Invalid currency: {webhook_data.currency}")
            raise HTTPException(status_code=400, detail="Invalid currency")
        
        # Update transaction status
        new_status = "success" if webhook_data.status.lower() == "successful" else "failed"
        
        await db.transactions.update_one(
            {"reference": webhook_data.reference},
            {
                "$set": {
                    "status": new_status,
                    "provider_response": webhook_data.model_dump(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        # Update order payment status
        order_update = {"payment_status": new_status}
        
        if new_status == "success":
            order_update["order_status"] = "confirmed"
            order_update["confirmed_at"] = datetime.now(timezone.utc).isoformat()
        
        await db.orders.update_one(
            {"id": transaction["order_id"]},
            {"$set": order_update}
        )
        
        # TODO: Send notifications to vendor, customer
        
        logger.info(f"Payment webhook processed: {webhook_data.reference} - {new_status}")
        
        return {
            "success": True,
            "message": "Webhook processed successfully",
            "status": new_status
        }
        
    except Exception as e:
        logger.error(f"Webhook processing failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Webhook processing failed: {str(e)}")

@payment_router.get("/status/{reference}")
async def get_payment_status(reference: str, db = Depends(get_db)):
    """
    Get payment status by reference
    """
    transaction = await db.transactions.find_one({"reference": reference}, {"_id": 0})
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Also check with CAMPAY API for latest status
    try:
        campay_status = await campay_client.get_payment_status(reference)
        
        return {
            "reference": reference,
            "status": transaction["status"],
            "amount": transaction["amount"],
            "order_number": transaction["order_number"],
            "campay_status": campay_status
        }
    except Exception as e:
        logger.error(f"Failed to fetch CAMPAY status: {e}")
        return {
            "reference": reference,
            "status": transaction["status"],
            "amount": transaction["amount"],
            "order_number": transaction["order_number"]
        }

@payment_router.get("/order/{order_id}")
async def get_order_payment_info(order_id: str, db = Depends(get_db)):
    """
    Get payment information for an order
    """
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    transactions = await db.transactions.find(
        {"order_id": order_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(10)
    
    return {
        "order_id": order_id,
        "order_number": order["order_number"],
        "total": order["total"],
        "payment_status": order["payment_status"],
        "payment_reference": order.get("payment_reference"),
        "transactions": transactions
    }