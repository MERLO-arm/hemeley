from fastapi import APIRouter, HTTPException, Request, Header, UploadFile, File
from typing import Optional, List
from datetime import datetime, timezone
import hashlib
import jwt
import os
import base64
import uuid

from models import (
    Customer, CustomerRegister, CustomerLogin, CustomerUpdate, CustomerAddress,
    Message, Conversation, MessageCreate, Review, ReviewCreate,
    LoyaltyTransaction, LoyaltyReward
)

customer_router = APIRouter(prefix="/customer", tags=["Customer"])

JWT_SECRET = os.environ.get("JWT_SECRET", "hemeley_secret_key_2024")

# ==================== HELPER FUNCTIONS ====================

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed

def create_token(customer_id: str, phone: str) -> str:
    return jwt.encode(
        {"customer_id": customer_id, "phone": phone, "role": "customer"},
        JWT_SECRET,
        algorithm="HS256"
    )

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except:
        raise HTTPException(status_code=401, detail="Token invalide")

async def get_current_customer(request: Request, authorization: str = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Non autorisé")
    token = authorization.replace("Bearer ", "")
    payload = decode_token(token)
    
    db = request.state.db
    customer = await db.customers.find_one({"id": payload["customer_id"]}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Client non trouvé")
    return customer

def calculate_loyalty_level(total_spent: float) -> str:
    if total_spent >= 500000:
        return "platinum"
    elif total_spent >= 200000:
        return "gold"
    elif total_spent >= 50000:
        return "silver"
    return "bronze"

def get_points_multiplier(level: str) -> float:
    multipliers = {"bronze": 1.0, "silver": 1.5, "gold": 2.0, "platinum": 3.0}
    return multipliers.get(level, 1.0)

# ==================== AUTH ROUTES ====================

@customer_router.post("/register")
async def register_customer(request: Request, data: CustomerRegister):
    """Register a new customer"""
    db = request.state.db
    
    # Check if phone already exists
    existing = await db.customers.find_one({"phone": data.phone})
    if existing:
        raise HTTPException(status_code=400, detail="Ce numéro de téléphone est déjà utilisé")
    
    # Check if pseudo already exists
    existing_pseudo = await db.customers.find_one({"pseudo": data.pseudo})
    if existing_pseudo:
        raise HTTPException(status_code=400, detail="Ce pseudo est déjà utilisé")
    
    # Generate unique referral code
    referral_code = data.pseudo[:4].upper() + str(uuid.uuid4())[:4].upper()
    
    customer = Customer(
        pseudo=data.pseudo,
        phone=data.phone,
        password_hash=hash_password(data.password),
        whatsapp=data.whatsapp or data.phone,
        email=data.email,
        referral_code=referral_code,
        referral_count=0
    )
    
    bonus_points = 0
    
    # Handle referral code
    if hasattr(data, 'referral_code') and data.referral_code:
        referrer = await db.customers.find_one({"referral_code": data.referral_code})
        if referrer:
            # Give bonus to new customer
            customer.loyalty_points = 50
            bonus_points = 50
            customer.referred_by = referrer["id"]
            
            # Give bonus to referrer
            await db.customers.update_one(
                {"id": referrer["id"]},
                {
                    "$inc": {"loyalty_points": 100, "referral_count": 1}
                }
            )
            
            # Log referral bonus for referrer
            from models import LoyaltyTransaction
            referrer_tx = LoyaltyTransaction(
                customer_id=referrer["id"],
                type="bonus",
                points=100,
                description=f"Parrainage de {data.pseudo}"
            )
            await db.loyalty_transactions.insert_one(referrer_tx.model_dump())
    
    await db.customers.insert_one(customer.model_dump())
    
    # Log signup bonus if any
    if bonus_points > 0:
        from models import LoyaltyTransaction
        signup_tx = LoyaltyTransaction(
            customer_id=customer.id,
            type="bonus",
            points=bonus_points,
            description="Bonus de parrainage à l'inscription"
        )
        await db.loyalty_transactions.insert_one(signup_tx.model_dump())
    
    token = create_token(customer.id, customer.phone)
    
    customer_data = customer.model_dump()
    del customer_data["password_hash"]
    
    return {"token": token, "customer": customer_data, "bonus_points": bonus_points}

@customer_router.post("/login")
async def login_customer(request: Request, data: CustomerLogin):
    """Login a customer"""
    db = request.state.db
    
    customer = await db.customers.find_one({"phone": data.phone}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=401, detail="Numéro de téléphone ou mot de passe incorrect")
    
    if not verify_password(data.password, customer.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Numéro de téléphone ou mot de passe incorrect")
    
    # Update last login
    await db.customers.update_one(
        {"id": customer["id"]},
        {"$set": {"last_login": datetime.now(timezone.utc)}}
    )
    
    token = create_token(customer["id"], customer["phone"])
    
    del customer["password_hash"]
    
    return {"token": token, "customer": customer}

# ==================== PROFILE ROUTES ====================

@customer_router.get("/profile")
async def get_profile(request: Request, authorization: str = Header(None)):
    """Get current customer profile"""
    customer = await get_current_customer(request, authorization)
    if "password_hash" in customer:
        del customer["password_hash"]
    return customer

@customer_router.put("/profile")
async def update_profile(request: Request, data: CustomerUpdate, authorization: str = Header(None)):
    """Update customer profile"""
    customer = await get_current_customer(request, authorization)
    db = request.state.db
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    
    if update_data:
        await db.customers.update_one(
            {"id": customer["id"]},
            {"$set": update_data}
        )
    
    updated = await db.customers.find_one({"id": customer["id"]}, {"_id": 0, "password_hash": 0})
    return updated

@customer_router.post("/profile/image")
async def upload_profile_image(request: Request, authorization: str = Header(None)):
    """Upload profile image as base64"""
    customer = await get_current_customer(request, authorization)
    db = request.state.db
    
    body = await request.json()
    image_base64 = body.get("image_base64")
    
    if not image_base64:
        raise HTTPException(status_code=400, detail="Image requise")
    
    await db.customers.update_one(
        {"id": customer["id"]},
        {"$set": {"profile_image": image_base64}}
    )
    
    return {"message": "Photo de profil mise à jour"}

# ==================== ADDRESS ROUTES ====================

@customer_router.get("/addresses")
async def get_addresses(request: Request, authorization: str = Header(None)):
    """Get customer addresses"""
    customer = await get_current_customer(request, authorization)
    return customer.get("addresses", [])

@customer_router.post("/addresses")
async def add_address(request: Request, address: CustomerAddress, authorization: str = Header(None)):
    """Add a new address"""
    customer = await get_current_customer(request, authorization)
    db = request.state.db
    
    addresses = customer.get("addresses", [])
    
    # If this is set as default, unset others
    if address.is_default:
        for addr in addresses:
            addr["is_default"] = False
    
    addresses.append(address.model_dump())
    
    await db.customers.update_one(
        {"id": customer["id"]},
        {"$set": {"addresses": addresses}}
    )
    
    return {"message": "Adresse ajoutée", "addresses": addresses}

@customer_router.delete("/addresses/{address_id}")
async def delete_address(request: Request, address_id: str, authorization: str = Header(None)):
    """Delete an address"""
    customer = await get_current_customer(request, authorization)
    db = request.state.db
    
    addresses = [a for a in customer.get("addresses", []) if a.get("id") != address_id]
    
    await db.customers.update_one(
        {"id": customer["id"]},
        {"$set": {"addresses": addresses}}
    )
    
    return {"message": "Adresse supprimée"}

# ==================== FAVORITES ROUTES ====================

@customer_router.get("/favorites/vendors")
async def get_favorite_vendors(request: Request, authorization: str = Header(None)):
    """Get favorite vendors"""
    customer = await get_current_customer(request, authorization)
    db = request.state.db
    
    vendor_ids = customer.get("favorite_vendors", [])
    if not vendor_ids:
        return []
    
    vendors = await db.vendors.find(
        {"id": {"$in": vendor_ids}},
        {"_id": 0, "password_hash": 0}
    ).to_list(100)
    
    # Get ratings for each vendor
    for vendor in vendors:
        reviews = await db.reviews.find({"vendor_id": vendor["id"]}).to_list(1000)
        if reviews:
            vendor["rating"] = sum(r["rating"] for r in reviews) / len(reviews)
            vendor["review_count"] = len(reviews)
        else:
            vendor["rating"] = 0
            vendor["review_count"] = 0
    
    return vendors

@customer_router.post("/favorites/vendors/{vendor_id}")
async def add_favorite_vendor(request: Request, vendor_id: str, authorization: str = Header(None)):
    """Add vendor to favorites"""
    customer = await get_current_customer(request, authorization)
    db = request.state.db
    
    # Check vendor exists
    vendor = await db.vendors.find_one({"id": vendor_id})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendeur non trouvé")
    
    favorites = customer.get("favorite_vendors", [])
    if vendor_id not in favorites:
        favorites.append(vendor_id)
        await db.customers.update_one(
            {"id": customer["id"]},
            {"$set": {"favorite_vendors": favorites}}
        )
    
    return {"message": "Vendeur ajouté aux favoris"}

@customer_router.delete("/favorites/vendors/{vendor_id}")
async def remove_favorite_vendor(request: Request, vendor_id: str, authorization: str = Header(None)):
    """Remove vendor from favorites"""
    customer = await get_current_customer(request, authorization)
    db = request.state.db
    
    favorites = [v for v in customer.get("favorite_vendors", []) if v != vendor_id]
    
    await db.customers.update_one(
        {"id": customer["id"]},
        {"$set": {"favorite_vendors": favorites}}
    )
    
    return {"message": "Vendeur retiré des favoris"}

@customer_router.get("/favorites/menus")
async def get_favorite_menus(request: Request, authorization: str = Header(None)):
    """Get favorite menus"""
    customer = await get_current_customer(request, authorization)
    db = request.state.db
    
    menu_ids = customer.get("favorite_menus", [])
    if not menu_ids:
        return []
    
    menus = await db.menus.find(
        {"id": {"$in": menu_ids}},
        {"_id": 0}
    ).to_list(100)
    
    return menus

@customer_router.post("/favorites/menus/{menu_id}")
async def add_favorite_menu(request: Request, menu_id: str, authorization: str = Header(None)):
    """Add menu to favorites"""
    customer = await get_current_customer(request, authorization)
    db = request.state.db
    
    favorites = customer.get("favorite_menus", [])
    if menu_id not in favorites:
        favorites.append(menu_id)
        await db.customers.update_one(
            {"id": customer["id"]},
            {"$set": {"favorite_menus": favorites}}
        )
    
    return {"message": "Menu ajouté aux favoris"}

@customer_router.delete("/favorites/menus/{menu_id}")
async def remove_favorite_menu(request: Request, menu_id: str, authorization: str = Header(None)):
    """Remove menu from favorites"""
    customer = await get_current_customer(request, authorization)
    db = request.state.db
    
    favorites = [m for m in customer.get("favorite_menus", []) if m != menu_id]
    
    await db.customers.update_one(
        {"id": customer["id"]},
        {"$set": {"favorite_menus": favorites}}
    )
    
    return {"message": "Menu retiré des favoris"}

# ==================== ORDERS ROUTES ====================

@customer_router.get("/orders")
async def get_customer_orders(request: Request, authorization: str = Header(None)):
    """Get customer order history"""
    customer = await get_current_customer(request, authorization)
    db = request.state.db
    
    orders = await db.orders.find(
        {"customer_phone": customer["phone"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return orders

@customer_router.get("/orders/active")
async def get_active_orders(request: Request, authorization: str = Header(None)):
    """Get active (non-delivered) orders"""
    customer = await get_current_customer(request, authorization)
    db = request.state.db
    
    orders = await db.orders.find(
        {
            "customer_phone": customer["phone"],
            "order_status": {"$nin": ["delivered", "cancelled"]}
        },
        {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    
    return orders

@customer_router.get("/orders/{order_id}")
async def get_order_detail(request: Request, order_id: str, authorization: str = Header(None)):
    """Get specific order details"""
    customer = await get_current_customer(request, authorization)
    db = request.state.db
    
    order = await db.orders.find_one(
        {"id": order_id, "customer_phone": customer["phone"]},
        {"_id": 0}
    )
    
    if not order:
        raise HTTPException(status_code=404, detail="Commande non trouvée")
    
    return order

# ==================== MESSAGING ROUTES ====================

@customer_router.get("/conversations")
async def get_conversations(request: Request, authorization: str = Header(None)):
    """Get all conversations"""
    customer = await get_current_customer(request, authorization)
    db = request.state.db
    
    conversations = await db.conversations.find(
        {"customer_id": customer["id"]},
        {"_id": 0}
    ).sort("last_message_at", -1).to_list(50)
    
    return conversations

@customer_router.get("/conversations/{conversation_id}/messages")
async def get_messages(request: Request, conversation_id: str, authorization: str = Header(None)):
    """Get messages in a conversation"""
    customer = await get_current_customer(request, authorization)
    db = request.state.db
    
    # Verify conversation belongs to customer
    conversation = await db.conversations.find_one({
        "id": conversation_id,
        "customer_id": customer["id"]
    })
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation non trouvée")
    
    # Mark messages as read
    await db.messages.update_many(
        {"conversation_id": conversation_id, "sender_type": "vendor"},
        {"$set": {"is_read": True}}
    )
    
    # Reset unread count
    await db.conversations.update_one(
        {"id": conversation_id},
        {"$set": {"unread_customer": 0}}
    )
    
    messages = await db.messages.find(
        {"conversation_id": conversation_id},
        {"_id": 0}
    ).sort("created_at", 1).to_list(500)
    
    return messages

@customer_router.post("/conversations/message")
async def send_message(request: Request, data: MessageCreate, authorization: str = Header(None)):
    """Send a message to a vendor"""
    customer = await get_current_customer(request, authorization)
    db = request.state.db
    
    # Get or create conversation
    conversation_id = data.conversation_id
    
    if not conversation_id and data.vendor_id:
        # Check if conversation exists
        existing = await db.conversations.find_one({
            "customer_id": customer["id"],
            "vendor_id": data.vendor_id
        })
        
        if existing:
            conversation_id = existing["id"]
        else:
            # Get vendor info
            vendor = await db.vendors.find_one({"id": data.vendor_id}, {"_id": 0})
            if not vendor:
                raise HTTPException(status_code=404, detail="Vendeur non trouvé")
            
            # Create new conversation
            conversation = Conversation(
                customer_id=customer["id"],
                customer_name=customer["pseudo"],
                customer_phone=customer["phone"],
                vendor_id=data.vendor_id,
                vendor_name=vendor["name"]
            )
            await db.conversations.insert_one(conversation.model_dump())
            conversation_id = conversation.id
    
    if not conversation_id:
        raise HTTPException(status_code=400, detail="conversation_id ou vendor_id requis")
    
    # Create message
    message = Message(
        conversation_id=conversation_id,
        sender_id=customer["id"],
        sender_type="customer",
        sender_name=customer["pseudo"],
        content=data.content,
        content_type=data.content_type,
        file_url=data.file_url,
        file_name=data.file_name
    )
    
    await db.messages.insert_one(message.model_dump())
    
    # Update conversation
    await db.conversations.update_one(
        {"id": conversation_id},
        {
            "$set": {
                "last_message": data.content[:100],
                "last_message_at": datetime.now(timezone.utc)
            },
            "$inc": {"unread_vendor": 1}
        }
    )
    
    return {"message": "Message envoyé", "data": message.model_dump()}

# ==================== REVIEWS ROUTES ====================

@customer_router.get("/reviews")
async def get_my_reviews(request: Request, authorization: str = Header(None)):
    """Get reviews written by customer"""
    customer = await get_current_customer(request, authorization)
    db = request.state.db
    
    reviews = await db.reviews.find(
        {"customer_id": customer["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return reviews

@customer_router.post("/reviews")
async def create_review(request: Request, data: ReviewCreate, authorization: str = Header(None)):
    """Create a review for a vendor"""
    customer = await get_current_customer(request, authorization)
    db = request.state.db
    
    # Validate rating
    if data.rating < 1 or data.rating > 5:
        raise HTTPException(status_code=400, detail="La note doit être entre 1 et 5")
    
    # Get vendor
    vendor = await db.vendors.find_one({"id": data.vendor_id}, {"_id": 0})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendeur non trouvé")
    
    # Check if already reviewed this order
    if data.order_id:
        existing = await db.reviews.find_one({
            "customer_id": customer["id"],
            "order_id": data.order_id
        })
        if existing:
            raise HTTPException(status_code=400, detail="Vous avez déjà évalué cette commande")
    
    review = Review(
        customer_id=customer["id"],
        customer_name=customer["pseudo"],
        vendor_id=data.vendor_id,
        vendor_name=vendor["name"],
        order_id=data.order_id,
        rating=data.rating,
        comment=data.comment
    )
    
    await db.reviews.insert_one(review.model_dump())
    
    # Award loyalty points for review
    await add_loyalty_points(
        db, customer["id"], 10, "earned",
        f"Avis laissé pour {vendor['name']}"
    )
    
    return {"message": "Avis publié", "review": review.model_dump()}

# ==================== LOYALTY ROUTES ====================

async def add_loyalty_points(db, customer_id: str, points: int, type: str, description: str, order_id: str = None):
    """Add loyalty points to customer"""
    customer = await db.customers.find_one({"id": customer_id})
    if not customer:
        return
    
    # Apply multiplier based on level
    multiplier = get_points_multiplier(customer.get("loyalty_level", "bronze"))
    actual_points = int(points * multiplier) if type == "earned" else points
    
    # Create transaction
    transaction = LoyaltyTransaction(
        customer_id=customer_id,
        type=type,
        points=actual_points,
        description=description,
        order_id=order_id
    )
    await db.loyalty_transactions.insert_one(transaction.model_dump())
    
    # Update customer points
    new_points = customer.get("loyalty_points", 0)
    if type in ["earned", "bonus"]:
        new_points += actual_points
    elif type in ["spent", "expired"]:
        new_points -= actual_points
    
    # Update level based on total spent
    new_level = calculate_loyalty_level(customer.get("total_spent", 0))
    
    await db.customers.update_one(
        {"id": customer_id},
        {"$set": {"loyalty_points": max(0, new_points), "loyalty_level": new_level}}
    )

@customer_router.get("/loyalty")
async def get_loyalty_info(request: Request, authorization: str = Header(None)):
    """Get loyalty program info"""
    customer = await get_current_customer(request, authorization)
    db = request.state.db
    
    # Get recent transactions
    transactions = await db.loyalty_transactions.find(
        {"customer_id": customer["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    
    # Get available rewards
    rewards = await db.loyalty_rewards.find(
        {"is_active": True},
        {"_id": 0}
    ).to_list(50)
    
    return {
        "points": customer.get("loyalty_points", 0),
        "level": customer.get("loyalty_level", "bronze"),
        "total_orders": customer.get("total_orders", 0),
        "total_spent": customer.get("total_spent", 0),
        "multiplier": get_points_multiplier(customer.get("loyalty_level", "bronze")),
        "transactions": transactions,
        "available_rewards": rewards,
        "level_benefits": {
            "bronze": {"multiplier": 1.0, "min_spent": 0},
            "silver": {"multiplier": 1.5, "min_spent": 50000},
            "gold": {"multiplier": 2.0, "min_spent": 200000},
            "platinum": {"multiplier": 3.0, "min_spent": 500000}
        }
    }

@customer_router.post("/loyalty/redeem/{reward_id}")
async def redeem_reward(request: Request, reward_id: str, authorization: str = Header(None)):
    """Redeem a loyalty reward"""
    customer = await get_current_customer(request, authorization)
    db = request.state.db
    
    reward = await db.loyalty_rewards.find_one({"id": reward_id, "is_active": True})
    if not reward:
        raise HTTPException(status_code=404, detail="Récompense non trouvée")
    
    if customer.get("loyalty_points", 0) < reward["points_required"]:
        raise HTTPException(status_code=400, detail="Points insuffisants")
    
    # Deduct points
    await add_loyalty_points(
        db, customer["id"], reward["points_required"], "spent",
        f"Échange: {reward['name']}"
    )
    
    return {
        "message": "Récompense échangée avec succès",
        "reward": reward,
        "remaining_points": customer.get("loyalty_points", 0) - reward["points_required"]
    }

# ==================== STATS ROUTES ====================

@customer_router.get("/stats")
async def get_customer_stats(request: Request, authorization: str = Header(None)):
    """Get customer statistics"""
    customer = await get_current_customer(request, authorization)
    db = request.state.db
    
    # Get order stats
    orders = await db.orders.find(
        {"customer_phone": customer["phone"]},
        {"_id": 0}
    ).to_list(1000)
    
    total_orders = len(orders)
    total_spent = sum(o.get("total", 0) for o in orders)
    
    # Get favorite items from orders
    item_counts = {}
    vendor_counts = {}
    for order in orders:
        vendor_id = order.get("vendor_id")
        if vendor_id:
            vendor_counts[vendor_id] = vendor_counts.get(vendor_id, 0) + 1
        for item in order.get("items", []):
            menu_name = item.get("menu_name")
            if menu_name:
                item_counts[menu_name] = item_counts.get(menu_name, 0) + item.get("quantity", 1)
    
    # Sort to find favorites
    favorite_items = sorted(item_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    favorite_vendors = sorted(vendor_counts.items(), key=lambda x: x[1], reverse=True)[:3]
    
    return {
        "total_orders": total_orders,
        "total_spent": total_spent,
        "average_order": total_spent / total_orders if total_orders > 0 else 0,
        "favorite_items": [{"name": name, "count": count} for name, count in favorite_items],
        "frequent_vendors": [{"vendor_id": vid, "order_count": count} for vid, count in favorite_vendors],
        "loyalty_points": customer.get("loyalty_points", 0),
        "loyalty_level": customer.get("loyalty_level", "bronze"),
        "member_since": customer.get("created_at")
    }
