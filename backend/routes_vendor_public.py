from fastapi import APIRouter, HTTPException, Request
from typing import Optional, List
from datetime import datetime, timezone

vendor_public_router = APIRouter(prefix="/vendors", tags=["Vendors Public"])

# ==================== PUBLIC VENDOR ROUTES ====================

@vendor_public_router.get("/")
async def list_vendors(request: Request, zone: Optional[str] = None):
    """Get list of all vendors (public)"""
    db = request.state.db
    
    query = {"is_active": True}
    if zone:
        query["zone"] = zone
    
    vendors = await db.vendors.find(
        query,
        {"_id": 0, "password_hash": 0}
    ).to_list(100)
    
    # Add ratings and menu count
    for vendor in vendors:
        # Get reviews
        reviews = await db.reviews.find({"vendor_id": vendor["id"]}).to_list(1000)
        if reviews:
            vendor["rating"] = round(sum(r["rating"] for r in reviews) / len(reviews), 1)
            vendor["review_count"] = len(reviews)
        else:
            vendor["rating"] = 0
            vendor["review_count"] = 0
        
        # Get menu count
        menu_count = await db.menus.count_documents({"vendor_id": vendor["id"], "is_active": True})
        vendor["menu_count"] = menu_count
    
    return vendors

@vendor_public_router.get("/{vendor_id}")
async def get_vendor_detail(request: Request, vendor_id: str):
    """Get vendor details with menus (public)"""
    db = request.state.db
    
    vendor = await db.vendors.find_one(
        {"id": vendor_id},
        {"_id": 0, "password_hash": 0}
    )
    
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendeur non trouvé")
    
    # Get menus
    menus = await db.menus.find(
        {"vendor_id": vendor_id, "is_active": True},
        {"_id": 0}
    ).to_list(100)
    
    # Get reviews
    reviews = await db.reviews.find(
        {"vendor_id": vendor_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    # Calculate rating
    if reviews:
        vendor["rating"] = round(sum(r["rating"] for r in reviews) / len(reviews), 1)
        vendor["review_count"] = len(reviews)
        
        # Rating breakdown
        rating_breakdown = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
        for r in reviews:
            rating_breakdown[r["rating"]] = rating_breakdown.get(r["rating"], 0) + 1
        vendor["rating_breakdown"] = rating_breakdown
    else:
        vendor["rating"] = 0
        vendor["review_count"] = 0
        vendor["rating_breakdown"] = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    
    # Order stats
    total_orders = await db.orders.count_documents({"vendor_id": vendor_id})
    completed_orders = await db.orders.count_documents({"vendor_id": vendor_id, "order_status": "delivered"})
    vendor["total_orders"] = total_orders
    vendor["completed_orders"] = completed_orders
    vendor["completion_rate"] = round((completed_orders / total_orders * 100) if total_orders > 0 else 0, 1)
    vendor["menu_count"] = len(menus)
    
    # Convert datetime for JSON
    if "created_at" in vendor and hasattr(vendor["created_at"], "isoformat"):
        vendor["created_at"] = vendor["created_at"].isoformat()
    if "last_login" in vendor and hasattr(vendor.get("last_login"), "isoformat"):
        vendor["last_login"] = vendor["last_login"].isoformat()
    
    for menu in menus:
        if "created_at" in menu and hasattr(menu.get("created_at"), "isoformat"):
            menu["created_at"] = menu["created_at"].isoformat()
    for review in reviews:
        if "created_at" in review and hasattr(review.get("created_at"), "isoformat"):
            review["created_at"] = review["created_at"].isoformat()
    
    vendor["menus"] = menus
    vendor["reviews"] = reviews[:10]
    
    return vendor

@vendor_public_router.get("/{vendor_id}/menus")
async def get_vendor_menus(request: Request, vendor_id: str):
    """Get all menus for a vendor (public)"""
    db = request.state.db
    
    vendor = await db.vendors.find_one({"id": vendor_id})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendeur non trouvé")
    
    menus = await db.menus.find(
        {"vendor_id": vendor_id, "is_active": True},
        {"_id": 0}
    ).to_list(100)
    
    return menus

@vendor_public_router.get("/{vendor_id}/reviews")
async def get_vendor_reviews(request: Request, vendor_id: str, limit: int = 20):
    """Get reviews for a vendor (public)"""
    db = request.state.db
    
    reviews = await db.reviews.find(
        {"vendor_id": vendor_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    return reviews

# ==================== VENDOR MESSAGING (FOR VENDORS) ====================

@vendor_public_router.get("/messaging/conversations")
async def get_vendor_conversations(request: Request, vendor_id: str):
    """Get all conversations for a vendor"""
    db = request.state.db
    
    conversations = await db.conversations.find(
        {"vendor_id": vendor_id},
        {"_id": 0}
    ).sort("last_message_at", -1).to_list(50)
    
    return conversations

@vendor_public_router.get("/messaging/conversations/{conversation_id}/messages")
async def get_conversation_messages(request: Request, conversation_id: str, vendor_id: str):
    """Get messages in a conversation (for vendor)"""
    db = request.state.db
    
    # Verify conversation belongs to vendor
    conversation = await db.conversations.find_one({
        "id": conversation_id,
        "vendor_id": vendor_id
    })
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation non trouvée")
    
    # Mark messages as read
    await db.messages.update_many(
        {"conversation_id": conversation_id, "sender_type": "customer"},
        {"$set": {"is_read": True}}
    )
    
    # Reset unread count
    await db.conversations.update_one(
        {"id": conversation_id},
        {"$set": {"unread_vendor": 0}}
    )
    
    messages = await db.messages.find(
        {"conversation_id": conversation_id},
        {"_id": 0}
    ).sort("created_at", 1).to_list(500)
    
    return messages

@vendor_public_router.post("/messaging/conversations/{conversation_id}/reply")
async def vendor_reply_message(request: Request, conversation_id: str):
    """Vendor replies to a message"""
    db = request.state.db
    body = await request.json()
    
    vendor_id = body.get("vendor_id")
    content = body.get("content")
    content_type = body.get("content_type", "text")
    file_url = body.get("file_url")
    file_name = body.get("file_name")
    
    if not vendor_id or not content:
        raise HTTPException(status_code=400, detail="vendor_id et content requis")
    
    # Verify conversation
    conversation = await db.conversations.find_one({
        "id": conversation_id,
        "vendor_id": vendor_id
    })
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation non trouvée")
    
    # Get vendor info
    vendor = await db.vendors.find_one({"id": vendor_id}, {"_id": 0})
    
    from models import Message
    
    message = Message(
        conversation_id=conversation_id,
        sender_id=vendor_id,
        sender_type="vendor",
        sender_name=vendor["name"],
        content=content,
        content_type=content_type,
        file_url=file_url,
        file_name=file_name
    )
    
    await db.messages.insert_one(message.model_dump())
    
    # Update conversation
    await db.conversations.update_one(
        {"id": conversation_id},
        {
            "$set": {
                "last_message": content[:100],
                "last_message_at": datetime.now(timezone.utc)
            },
            "$inc": {"unread_customer": 1}
        }
    )
    
    return {"message": "Message envoyé", "data": message.model_dump()}
