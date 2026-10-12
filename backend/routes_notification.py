from fastapi import APIRouter, HTTPException, Depends, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from auth import get_current_user
from models import Notification, NotificationCreate
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

notification_router = APIRouter()

def get_db(request: Request):
    return request.app.state.db

@notification_router.get("/")
async def get_notifications(
    user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get notifications for current user"""
    notifications = await db.notifications.find(
        {
            "user_id": user["id"],
            "user_role": user["role"]
        },
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    for notif in notifications:
        if isinstance(notif.get('created_at'), str):
            notif['created_at'] = datetime.fromisoformat(notif['created_at'])
    
    return notifications

@notification_router.get("/unread-count")
async def get_unread_count(
    user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get count of unread notifications"""
    count = await db.notifications.count_documents({
        "user_id": user["id"],
        "user_role": user["role"],
        "is_read": False
    })
    
    return {"count": count}

@notification_router.put("/{notification_id}/read")
async def mark_as_read(
    notification_id: str,
    user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Mark notification as read"""
    result = await db.notifications.update_one(
        {
            "id": notification_id,
            "user_id": user["id"]
        },
        {"$set": {"is_read": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"success": True}

@notification_router.put("/mark-all-read")
async def mark_all_as_read(
    user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Mark all notifications as read"""
    await db.notifications.update_many(
        {
            "user_id": user["id"],
            "user_role": user["role"],
            "is_read": False
        },
        {"$set": {"is_read": True}}
    )
    
    return {"success": True}

@notification_router.post("/", response_model=Notification)
async def create_notification(
    notif_data: NotificationCreate,
    db = Depends(get_db)
):
    """Create a new notification (internal use)"""
    notification = Notification(**notif_data.model_dump())
    
    doc = notification.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.notifications.insert_one(doc)
    
    return notification