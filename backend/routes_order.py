from fastapi import APIRouter, HTTPException, Depends, Request, BackgroundTasks, Header
from motor.motor_asyncio import AsyncIOMotorDatabase
from models import OrderCreate, Order, OrderStatusUpdate, OrderItem, CartItem
from pydantic import BaseModel
from typing import List, Optional
from auth import get_current_user, require_role
from utils import calculate_distance, calculate_delivery_fee, find_nearest_available_delivery
from notifications import send_email, send_whatsapp, generate_order_confirmation_email, generate_order_whatsapp_message
from wallet_service import (
    hold_escrow_for_order,
    release_escrow_to_vendor_and_delivery,
    refund_escrow_to_customer,
)
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

order_router = APIRouter()

class CheckoutRequest(BaseModel):
    items: List[CartItem]
    total: float
    customer_info: dict

def get_db(request: Request):
    return request.app.state.db


async def _resolve_customer_by_phone(db, phone: str) -> Optional[dict]:
    """Lookup the registered customer by phone number for wallet operations."""
    return await db.customers.find_one({"phone": phone}, {"_id": 0, "password_hash": 0})


async def _authenticated_customer_for_wallet(request: Request, authorization: Optional[str], customer_phone: str) -> dict:
    """Wallet payments require the customer's own JWT. Ensures the token's customer
    matches the order's customer_phone — prevents debiting someone else's wallet.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Connexion requise pour payer avec le wallet HEMELEY",
        )
    # Reuse customer JWT helper
    from routes_customer import get_current_customer
    try:
        customer = await get_current_customer(request, authorization)
    except HTTPException:
        raise HTTPException(
            status_code=401,
            detail="Token client invalide pour le paiement wallet",
        )
    if customer.get("phone") != customer_phone:
        raise HTTPException(
            status_code=403,
            detail="Le numéro de la commande ne correspond pas au compte connecté",
        )
    return customer


async def _hold_wallet_for_order(db, *, customer: dict, order_id: str, order_number: str, total: float):
    """Debit the authenticated customer's wallet and credit escrow."""
    await hold_escrow_for_order(
        db,
        customer_id=customer["id"],
        order_id=order_id,
        order_number=order_number,
        total=total,
        description=f"Paiement commande {order_number}",
    )

@order_router.post("/", response_model=Order)
async def create_order(order_data: OrderCreate, request: Request, authorization: Optional[str] = Header(None), db = Depends(get_db)):
    """
    Create a new order. Wallet payments require the customer's JWT.
    """
    # Check customer loyalty status
    customer_order_count = await db.orders.count_documents({
        "customer_phone": order_data.customer_phone,
        "payment_status": "success"
    })
    
    is_vip = customer_order_count >= 5
    vip_discount = 0.0
    
    # Validate items and calculate totals
    subtotal = 0.0
    for item in order_data.items:
        menu = await db.menus.find_one({"id": item.menu_id}, {"_id": 0})
        if not menu:
            raise HTTPException(status_code=404, detail=f"Menu {item.menu_id} not found")
        
        if menu["remaining_portions"] < item.quantity:
            raise HTTPException(status_code=400, detail=f"Not enough portions for {menu['name']}")
        
        subtotal += item.subtotal
    
    # Apply VIP discount (10%)
    if is_vip:
        vip_discount = subtotal * 0.10
    
    # Get vendor info
    vendor = await db.vendors.find_one({"id": order_data.vendor_id}, {"_id": 0})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    # Calculate delivery fee if location provided
    delivery_fee = 0.0
    distance_km = None
    
    if order_data.customer_latitude and order_data.customer_longitude:
        if vendor.get("latitude") and vendor.get("longitude"):
            distance_km = calculate_distance(
                vendor["latitude"], vendor["longitude"],
                order_data.customer_latitude, order_data.customer_longitude
            )
            delivery_fee = calculate_delivery_fee(distance_km)
    
    total = subtotal - vip_discount + delivery_fee
    
    # Create order
    order = Order(
        customer_name=order_data.customer_name,
        customer_phone=order_data.customer_phone,
        customer_email=order_data.customer_email,
        customer_latitude=order_data.customer_latitude,
        customer_longitude=order_data.customer_longitude,
        customer_address=order_data.customer_address,
        customer_order_count=customer_order_count + 1,
        is_vip=is_vip,
        vip_discount=vip_discount,
        items=order_data.items,
        vendor_id=order_data.vendor_id,
        vendor_name=vendor["name"],
        vendor_phone=vendor["phone"],
        zone=order_data.zone,
        delivery_fee=delivery_fee,
        distance_km=distance_km,
        subtotal=subtotal,
        discount=vip_discount,
        total=total,
        payment_method=order_data.payment_method,
        table_number=order_data.table_number,
        order_type=order_data.order_type or ("dine_in" if order_data.table_number else "delivery"),
        customer_note=order_data.customer_note
    )
    
    # Save order
    order_doc = order.model_dump()
    order_doc['created_at'] = order_doc['created_at'].isoformat()

    # Wallet payment: hold escrow before inserting the order
    if order.payment_method == "wallet":
        customer = await _authenticated_customer_for_wallet(request, authorization, order.customer_phone)
        await _hold_wallet_for_order(
            db,
            customer=customer,
            order_id=order.id,
            order_number=order.order_number,
            total=order.total,
        )
        order_doc["payment_status"] = "success"
        order_doc["order_status"] = "confirmed"
        order_doc["confirmed_at"] = datetime.now(timezone.utc).isoformat()
        # Mirror state on the Pydantic object so the HTTP response matches what we persisted
        order.payment_status = "success"
        order.order_status = "confirmed"
        order.confirmed_at = datetime.now(timezone.utc)

    await db.orders.insert_one(order_doc)
    
    # Update menu portions
    for item in order_data.items:
        await db.menus.update_one(
            {"id": item.menu_id},
            {"$inc": {"remaining_portions": -item.quantity}}
        )

    # ==== NOUVEAU : notification temps réel vers le vendor ====
    try:
        from realtime import hub
        alert_payload = {
            "order_id": order.id,
            "order_number": order.order_number,
            "table_number": order.table_number,
            "order_type": order.order_type,
            "customer_name": order.customer_name,
            "customer_phone": order.customer_phone,
            "vendor_id": order.vendor_id,
            "items": [
                {"name": it.menu_name, "quantity": it.quantity, "price": it.price}
                for it in order.items
            ],
            "total": order.total,
            "payment_method": order.payment_method,
            "created_at": order_doc["created_at"],
        }
        # Notifie le vendor propriétaire + tout serveur enregistré sur ce vendor
        await hub.notify([order.vendor_id], "order.placed", alert_payload)
    except Exception as e:
        logger.error(f"WS emit order.placed failed: {e}")

    return order

@order_router.post("/checkout")
async def checkout_cart(checkout_data: CheckoutRequest, request: Request, authorization: Optional[str] = Header(None), db = Depends(get_db)):
    """
    Create orders from cart items (can handle multiple vendors).
    Wallet payments require the customer's JWT.
    """
    try:
        # Group items by vendor
        vendor_groups = {}
        for item in checkout_data.items:
            if item.vendor_id not in vendor_groups:
                vendor_groups[item.vendor_id] = []
            vendor_groups[item.vendor_id].append(item)
        
        created_orders = []
        
        # Create separate orders for each vendor
        for vendor_id, items in vendor_groups.items():
            # Get vendor info
            vendor = await db.vendors.find_one({"id": vendor_id}, {"_id": 0})
            if not vendor:
                raise HTTPException(status_code=404, detail=f"Vendor {vendor_id} not found")
            
            # Validate items and calculate subtotal
            subtotal = 0.0
            order_items = []
            
            for item in items:
                menu = await db.menus.find_one({"id": item.menu_id}, {"_id": 0})
                if not menu:
                    raise HTTPException(status_code=404, detail=f"Menu {item.menu_id} not found")
                
                if menu["remaining_portions"] < item.quantity:
                    raise HTTPException(status_code=400, detail=f"Not enough portions for {menu['name']}")
                
                item_subtotal = item.price * item.quantity
                subtotal += item_subtotal
                
                order_items.append(OrderItem(
                    menu_id=item.menu_id,
                    menu_name=item.menu_name,
                    quantity=item.quantity,
                    price=item.price,
                    subtotal=item_subtotal
                ))
            
            # Check customer loyalty status
            customer_order_count = await db.orders.count_documents({
                "customer_phone": checkout_data.customer_info["phone"],
                "payment_status": "success"
            })
            
            is_vip = customer_order_count >= 5
            vip_discount = subtotal * 0.10 if is_vip else 0.0
            
            # Calculate delivery fee if location provided
            delivery_fee = 0.0
            distance_km = None
            
            customer_lat = checkout_data.customer_info.get("latitude")
            customer_lng = checkout_data.customer_info.get("longitude")
            
            if customer_lat and customer_lng and vendor.get("latitude") and vendor.get("longitude"):
                distance_km = calculate_distance(
                    vendor["latitude"], vendor["longitude"],
                    customer_lat, customer_lng
                )
                delivery_fee = calculate_delivery_fee(distance_km)
            
            total = subtotal - vip_discount + delivery_fee
            
            # Create order
            order = Order(
                customer_name=checkout_data.customer_info["pseudonym"],
                customer_phone=checkout_data.customer_info["phone"],
                customer_email=checkout_data.customer_info.get("email"),
                customer_latitude=customer_lat,
                customer_longitude=customer_lng,
                customer_address=checkout_data.customer_info.get("address"),
                customer_order_count=customer_order_count + 1,
                is_vip=is_vip,
                vip_discount=vip_discount,
                items=order_items,
                vendor_id=vendor_id,
                vendor_name=vendor["name"],
                vendor_phone=vendor["phone"],
                zone=vendor["zone"],
                delivery_fee=delivery_fee,
                distance_km=distance_km,
                subtotal=subtotal,
                discount=vip_discount,
                total=total,
                payment_method=checkout_data.customer_info["payment_method"],
                table_number=checkout_data.customer_info.get("table_number"),
                order_type=checkout_data.customer_info.get("order_type") or (
                    "dine_in" if checkout_data.customer_info.get("table_number") else "delivery"
                ),
                customer_note=checkout_data.customer_info.get("note")
            )
            
            # Save order
            order_doc = order.model_dump()
            order_doc['created_at'] = order_doc['created_at'].isoformat()

            # Wallet payment: hold escrow before inserting the order
            if order.payment_method == "wallet":
                customer = await _authenticated_customer_for_wallet(request, authorization, order.customer_phone)
                await _hold_wallet_for_order(
                    db,
                    customer=customer,
                    order_id=order.id,
                    order_number=order.order_number,
                    total=order.total,
                )
                order_doc["payment_status"] = "success"
                order_doc["order_status"] = "confirmed"
                order_doc["confirmed_at"] = datetime.now(timezone.utc).isoformat()
                order.payment_status = "success"
                order.order_status = "confirmed"
                order.confirmed_at = datetime.now(timezone.utc)

            await db.orders.insert_one(order_doc)

            # Mobile Money payment: kick off a CAMPAY collect to the customer's phone
            if order.payment_method in ("orange", "mtn"):
                try:
                    from campay import campay_client
                    from wallet_security import generate_tx_reference
                    customer_phone_intl = order.customer_phone
                    if not customer_phone_intl.startswith("237"):
                        customer_phone_intl = "237" + customer_phone_intl.lstrip("+").lstrip("0")
                    ext_ref = generate_tx_reference()
                    campay_resp = await campay_client.initiate_payment(
                        amount=order.total,
                        phone=customer_phone_intl,
                        external_reference=ext_ref,
                        description=f"HEMELEY {order.order_number}",
                    )
                    # Persist link between order and CAMPAY transaction for status polling
                    await db.orders.update_one(
                        {"id": order.id},
                        {"$set": {
                            "campay_reference": campay_resp.get("reference"),
                            "campay_external_reference": ext_ref,
                            "campay_status": "PENDING",
                            "campay_initiated_at": datetime.now(timezone.utc).isoformat(),
                        }},
                    )
                except Exception as e:
                    logger.error(f"CAMPAY collect failed for order {order.id}: {e}")
                    await db.orders.update_one(
                        {"id": order.id},
                        {"$set": {"campay_status": "FAILED", "campay_failure_reason": str(e)}},
                    )
            
            # Update menu portions
            for item in items:
                await db.menus.update_one(
                    {"id": item.menu_id},
                    {"$inc": {"remaining_portions": -item.quantity}}
                )
            
            created_orders.append(order)

            # ==== Notification temps réel vers le vendor (dashboard live) ====
            try:
                from realtime import hub
                await hub.notify([order.vendor_id], "order.placed", {
                    "order_id": order.id,
                    "order_number": order.order_number,
                    "table_number": order.table_number,
                    "order_type": order.order_type,
                    "customer_name": order.customer_name,
                    "customer_phone": order.customer_phone,
                    "vendor_id": order.vendor_id,
                    "items": [
                        {"name": it.menu_name, "quantity": it.quantity, "price": it.price}
                        for it in order.items
                    ],
                    "total": order.total,
                    "payment_method": order.payment_method,
                    "created_at": order_doc["created_at"],
                })
            except Exception as e:
                logger.error(f"WS emit order.placed (checkout) failed: {e}")

            # Send notifications in background
            order_dict = order.model_dump()
            
            # Send email if provided
            if checkout_data.customer_info.get("email"):
                try:
                    html, text = generate_order_confirmation_email(order_dict)
                    await send_email(
                        checkout_data.customer_info["email"],
                        f"HEMELEY - Commande #{order.id[:8]} Confirmée!",
                        html, text
                    )
                except Exception as e:
                    logger.error(f"Failed to send email: {e}")
            
            # Send WhatsApp notification
            try:
                message = generate_order_whatsapp_message(order_dict)
                await send_whatsapp(checkout_data.customer_info["phone"], message)
            except Exception as e:
                logger.error(f"Failed to send WhatsApp: {e}")
        
        return {
            "success": True,
            "orders": created_orders,
            "total_orders": len(created_orders),
            "message": f"Created {len(created_orders)} order(s) successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Checkout failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Checkout failed: {str(e)}")

@order_router.get("/{order_id}", response_model=Order)
async def get_order(order_id: str, db = Depends(get_db)):
    """Get order details"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if isinstance(order.get('created_at'), str):
        order['created_at'] = datetime.fromisoformat(order['created_at'])
    
    return order

@order_router.get("/number/{order_number}", response_model=Order)
async def get_order_by_number(order_number: str, db = Depends(get_db)):
    """Get order by order number"""
    order = await db.orders.find_one({"order_number": order_number}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if isinstance(order.get('created_at'), str):
        order['created_at'] = datetime.fromisoformat(order['created_at'])
    
    return order


@order_router.get("/{order_id}/payment-status")
async def order_payment_status(order_id: str, db = Depends(get_db)):
    """Lightweight endpoint used by the secure payment-status page to poll progress.

    For Mobile Money orders this also queries CAMPAY for the live transaction state
    and persists it on the order document so the UI gets a fresh status on each tick.
    """
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    response = {
        "order_id": order["id"],
        "order_number": order["order_number"],
        "payment_method": order.get("payment_method"),
        "payment_status": order.get("payment_status", "pending"),
        "order_status": order.get("order_status", "pending"),
        "total": order.get("total"),
        "campay_status": order.get("campay_status"),
        "campay_reference": order.get("campay_reference"),
    }

    # If CAMPAY transaction is still pending, ask CAMPAY directly
    if (
        order.get("payment_method") in ("orange", "mtn")
        and order.get("campay_reference")
        and (order.get("campay_status") or "").upper() == "PENDING"
    ):
        try:
            from campay import campay_client
            cstatus = await campay_client.get_payment_status(order["campay_reference"])
            cstatus_value = (cstatus.get("status") or "").upper()
            update_doc = {"campay_status": cstatus_value}
            if cstatus_value in ("SUCCESSFUL", "SUCCESS"):
                update_doc["payment_status"] = "success"
                update_doc["order_status"] = "confirmed"
                update_doc["confirmed_at"] = datetime.now(timezone.utc).isoformat()
            elif cstatus_value in ("FAILED", "CANCELED", "CANCELLED"):
                update_doc["payment_status"] = "failed"
                update_doc["order_status"] = "cancelled"
                update_doc["campay_failure_reason"] = cstatus.get("reason", "campay_failed")
            await db.orders.update_one({"id": order_id}, {"$set": update_doc})
            response.update(update_doc)
        except Exception as e:
            logger.warning(f"CAMPAY status poll failed for order {order_id}: {e}")

    return response

@order_router.put("/{order_id}/status")
async def update_order_status(
    order_id: str,
    status_update: OrderStatusUpdate,
    user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Update order status (vendor, delivery, admin)"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Check permissions
    if user["role"] == "vendor" and order["vendor_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not your order")
    
    if user["role"] == "delivery" and order.get("delivery_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Not assigned to you")
    
    update_data = {"order_status": status_update.order_status}
    
    if status_update.order_status == "delivered":
        update_data["delivered_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.orders.update_one({"id": order_id}, {"$set": update_data})

    # ===== Wallet escrow side-effects =====
    # Release escrow when an order paid via wallet is delivered
    if (
        status_update.order_status == "delivered"
        and order.get("payment_method") == "wallet"
        and order.get("payment_status") == "success"
    ):
        try:
            await release_escrow_to_vendor_and_delivery(db, order={**order, **update_data})
        except Exception as e:
            logger.error(f"Escrow release failed for order {order_id}: {e}", exc_info=True)
            # Don't roll back the status update — flag for admin review
            await db.orders.update_one(
                {"id": order_id},
                {"$set": {"escrow_release_error": str(e)}},
            )

    # Refund escrow on cancellation
    if (
        status_update.order_status == "cancelled"
        and order.get("payment_method") == "wallet"
        and order.get("payment_status") == "success"
    ):
        customer = await db.customers.find_one({"phone": order["customer_phone"]}, {"_id": 0})
        if customer:
            try:
                await refund_escrow_to_customer(
                    db,
                    customer_id=customer["id"],
                    order_id=order_id,
                    order_number=order["order_number"],
                    total=float(order["total"]),
                    reason="Annulation commande",
                    actor_id=user["id"],
                    actor_role=user["role"],
                )
            except Exception as e:
                logger.error(f"Escrow refund failed for order {order_id}: {e}", exc_info=True)
                await db.orders.update_one(
                    {"id": order_id},
                    {"$set": {"escrow_refund_error": str(e)}},
                )
    
    return {"success": True, "status": status_update.order_status}

@order_router.get("/customer/loyalty-status")
async def get_loyalty_status(phone: str, db = Depends(get_db)):
    """Check customer loyalty status"""
    order_count = await db.orders.count_documents({
        "customer_phone": phone,
        "payment_status": "success"
    })
    
    is_vip = order_count >= 5
    orders_until_vip = max(0, 5 - order_count)
    
    return {
        "phone": phone,
        "order_count": order_count,
        "is_vip": is_vip,
        "orders_until_vip": orders_until_vip,
        "discount_percentage": 10 if is_vip else 0
    }

@order_router.get("/vendor/my-orders")
async def get_vendor_orders(
    user: dict = Depends(require_role("vendor")),
    db = Depends(get_db)
):
    """Get all orders for vendor"""
    orders = await db.orders.find(
        {"vendor_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    for order in orders:
        if isinstance(order.get('created_at'), str):
            order['created_at'] = datetime.fromisoformat(order['created_at'])
    
    return orders

@order_router.get("/vendor/pending-alerts")
async def get_vendor_pending_alerts(
    user: dict = Depends(require_role("vendor")),
    db = Depends(get_db)
):
    """Retourne les commandes non acquittées du vendor (pour reconstituer la queue
    d'alertes au refresh / reconnexion). Une commande est "à acquitter" si:
      - order_status in {pending, confirmed}
      - PAS déjà acquittée par le vendor (staff_acknowledged != True)
      - créée dans les 24 dernières heures
    """
    from datetime import timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    cursor = db.orders.find({
        "vendor_id": user["id"],
        "order_status": {"$in": ["pending", "confirmed"]},
        "staff_acknowledged": {"$ne": True},
        "created_at": {"$gte": cutoff},
    }, {"_id": 0}).sort("created_at", -1).limit(50)
    orders = await cursor.to_list(50)
    # Format léger pour l'alerte (pas besoin des grosses images ou de la totalité du doc)
    alerts = [{
        "order_id": o["id"],
        "order_number": o.get("order_number"),
        "table_number": o.get("table_number"),
        "order_type": o.get("order_type", "delivery"),
        "customer_name": o.get("customer_name"),
        "customer_phone": o.get("customer_phone"),
        "items": [
            {"name": it.get("menu_name"), "quantity": it.get("quantity"), "price": it.get("price")}
            for it in (o.get("items") or [])
        ],
        "total": o.get("total"),
        "payment_method": o.get("payment_method"),
        "created_at": o.get("created_at"),
    } for o in orders]
    return {"count": len(alerts), "alerts": alerts}


@order_router.post("/{order_id}/acknowledge")
async def acknowledge_order(
    order_id: str,
    user: dict = Depends(require_role("vendor")),
    db = Depends(get_db)
):
    """Marque une commande comme vue/prise en charge par le staff.
    Idempotent. Utilisé pour arrêter le son d'alerte + retirer de la queue.
    """
    result = await db.orders.update_one(
        {"id": order_id, "vendor_id": user["id"]},
        {"$set": {
            "staff_acknowledged": True,
            "staff_acknowledged_at": datetime.now(timezone.utc).isoformat(),
            "staff_acknowledged_by": user["id"],
        }},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Commande non trouvée pour ce vendor")
    return {"success": True, "order_id": order_id}


@order_router.put("/{order_id}/assign-delivery")
async def assign_delivery(
    order_id: str,
    user: dict = Depends(require_role("vendor", "admin", "super_admin")),
    db = Depends(get_db)
):
    """Auto-assign nearest available delivery partner"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Check if already assigned
    if order.get("delivery_id"):
        raise HTTPException(status_code=400, detail="Delivery already assigned")
    
    # Get vendor location
    vendor = await db.vendors.find_one({"id": order["vendor_id"]}, {"_id": 0})
    if not vendor or not vendor.get("latitude") or not vendor.get("longitude"):
        raise HTTPException(status_code=400, detail="Vendor location not set")
    
    # Find nearest delivery partner
    delivery_partner = await find_nearest_available_delivery(
        db, vendor["latitude"], vendor["longitude"]
    )
    
    if not delivery_partner:
        raise HTTPException(status_code=404, detail="No available delivery partners")
    
    # Assign delivery
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "delivery_id": delivery_partner["id"],
            "delivery_name": delivery_partner["name"],
            "delivery_phone": delivery_partner["phone"],
            "order_status": "ready"
        }}
    )
    
    # Mark delivery partner as unavailable
    await db.delivery_partners.update_one(
        {"id": delivery_partner["id"]},
        {"$set": {"is_available": False}}
    )
    
    return {
        "success": True,
        "delivery_partner": {
            "id": delivery_partner["id"],
            "name": delivery_partner["name"],
            "phone": delivery_partner["phone"]
        }
    }