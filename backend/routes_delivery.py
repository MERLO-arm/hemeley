from fastapi import APIRouter, HTTPException, Depends, Request, Body
from motor.motor_asyncio import AsyncIOMotorDatabase
from auth import get_current_user, require_role
from models import DeliveryStats
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

delivery_router = APIRouter()

def get_db(request: Request):
    return request.app.state.db

@delivery_router.get("/my-orders")
async def get_my_orders(
    user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get all orders assigned to or available for this delivery person"""
    # Get orders assigned to this delivery person or ready for pickup
    orders = await db.orders.find(
        {
            "$or": [
                {"delivery_id": user.get("id")},
                {
                    "order_status": {"$in": ["confirmed", "ready"]},
                    "delivery_id": {"$exists": False}
                }
            ]
        },
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return orders

@delivery_router.put("/status")
async def update_delivery_status(
    data: dict = Body(...),
    user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Update delivery person availability status"""
    is_available = data.get("is_available", True)
    
    await db.users.update_one(
        {"id": user.get("id")},
        {"$set": {"is_available": is_available}}
    )
    
    return {"success": True, "is_available": is_available}

@delivery_router.get("/my-deliveries")
async def get_my_deliveries(
    user: dict = Depends(require_role("delivery")),
    db = Depends(get_db)
):
    """Get all deliveries for current delivery partner"""
    orders = await db.orders.find(
        {"delivery_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    for order in orders:
        if isinstance(order.get('created_at'), str):
            order['created_at'] = datetime.fromisoformat(order['created_at'])
    
    return orders

@delivery_router.get("/pending")
async def get_pending_deliveries(
    user: dict = Depends(require_role("delivery")),
    db = Depends(get_db)
):
    """Get pending deliveries for current delivery partner"""
    orders = await db.orders.find(
        {
            "delivery_id": user["id"],
            "order_status": {"$in": ["ready", "in_delivery"]}
        },
        {"_id": 0}
    ).to_list(50)
    
    for order in orders:
        if isinstance(order.get('created_at'), str):
            order['created_at'] = datetime.fromisoformat(order['created_at'])
    
    return orders

@delivery_router.put("/update-location")
async def update_location(
    latitude: float,
    longitude: float,
    user: dict = Depends(require_role("delivery")),
    db = Depends(get_db)
):
    """Update delivery partner's current location"""
    await db.delivery_partners.update_one(
        {"id": user["id"]},
        {"$set": {
            "current_latitude": latitude,
            "current_longitude": longitude
        }}
    )
    
    return {"success": True}

@delivery_router.put("/toggle-availability")
async def toggle_availability(
    is_available: bool,
    user: dict = Depends(require_role("delivery")),
    db = Depends(get_db)
):
    """Toggle delivery partner availability"""
    await db.delivery_partners.update_one(
        {"id": user["id"]},
        {"$set": {"is_available": is_available}}
    )
    
    return {"success": True, "is_available": is_available}

@delivery_router.get("/stats", response_model=DeliveryStats)
async def get_delivery_stats(
    user: dict = Depends(require_role("delivery")),
    db = Depends(get_db)
):
    """Get delivery partner statistics"""
    # Count deliveries
    total_deliveries = await db.orders.count_documents({
        "delivery_id": user["id"],
        "order_status": "delivered"
    })
    
    pending_deliveries = await db.orders.count_documents({
        "delivery_id": user["id"],
        "order_status": {"$in": ["ready", "in_delivery"]}
    })
    
    # Calculate total earnings (delivery fees)
    pipeline = [
        {"$match": {
            "delivery_id": user["id"],
            "order_status": "delivered"
        }},
        {"$group": {
            "_id": None,
            "total": {"$sum": "$delivery_fee"}
        }}
    ]
    
    result = await db.orders.aggregate(pipeline).to_list(1)
    total_earnings = result[0]["total"] if result else 0.0
    
    return DeliveryStats(
        total_deliveries=total_deliveries,
        total_earnings=total_earnings,
        pending_deliveries=pending_deliveries,
        rating=user.get("rating", 0.0)
    )