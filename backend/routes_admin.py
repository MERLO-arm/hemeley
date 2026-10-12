from fastapi import APIRouter, HTTPException, Depends, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from auth import get_current_user, require_role
from models import (
    AdminStats, UserRegister,
    LoyaltyRule, LoyaltyRuleCreate, TimePromotion, TimePromotionCreate, PlatformSettings
)
from datetime import datetime, timezone
import uuid
import logging

logger = logging.getLogger(__name__)

admin_router = APIRouter()

def get_db(request: Request):
    return request.app.state.db

@admin_router.get("/stats", response_model=AdminStats)
async def get_admin_stats(
    user: dict = Depends(require_role("admin", "super_admin")),
    db = Depends(get_db)
):
    """Get platform statistics"""
    total_orders = await db.orders.count_documents({})
    total_vendors = await db.vendors.count_documents({"is_active": True})
    total_delivery_partners = await db.delivery_partners.count_documents({"is_active": True})
    pending_orders = await db.orders.count_documents({"order_status": "pending"})
    active_menus = await db.menus.count_documents({"is_active": True})
    
    # Calculate total revenue
    pipeline = [
        {"$match": {"payment_status": "success"}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}}
    ]
    result = await db.orders.aggregate(pipeline).to_list(1)
    total_revenue = result[0]["total"] if result else 0.0
    
    return AdminStats(
        total_orders=total_orders,
        total_revenue=total_revenue,
        total_vendors=total_vendors,
        total_delivery_partners=total_delivery_partners,
        pending_orders=pending_orders,
        active_menus=active_menus
    )

@admin_router.get("/vendors")
async def get_all_vendors(
    user: dict = Depends(require_role("admin", "super_admin")),
    db = Depends(get_db)
):
    """Get all vendors"""
    vendors = await db.vendors.find({}, {"_id": 0, "password_hash": 0}).to_list(100)
    return vendors

@admin_router.get("/delivery-partners")
async def get_all_delivery_partners(
    user: dict = Depends(require_role("admin", "super_admin")),
    db = Depends(get_db)
):
    """Get all delivery partners"""
    partners = await db.delivery_partners.find({}, {"_id": 0, "password_hash": 0}).to_list(100)
    return partners

@admin_router.get("/orders")
async def get_all_orders(
    user: dict = Depends(require_role("admin", "super_admin")),
    db = Depends(get_db)
):
    """Get all orders"""
    orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    
    for order in orders:
        if isinstance(order.get('created_at'), str):
            order['created_at'] = datetime.fromisoformat(order['created_at'])
    
    return orders

@admin_router.put("/users/{user_id}/activate")
async def activate_user(
    user_id: str,
    role: str,
    user: dict = Depends(require_role("super_admin")),
    db = Depends(get_db)
):
    """Activate a user (super admin only)"""
    collection_map = {
        "vendor": db.vendors,
        "delivery": db.delivery_partners,
        "admin": db.admins,
        "customer": db.customers
    }
    
    if role not in collection_map:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    collection = collection_map[role]
    
    result = await collection.update_one(
        {"id": user_id},
        {"$set": {"is_active": True, "is_verified": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"success": True}

@admin_router.put("/users/{user_id}/deactivate")
async def deactivate_user(
    user_id: str,
    role: str,
    user: dict = Depends(require_role("super_admin")),
    db = Depends(get_db)
):
    """Deactivate a user (super admin only)"""
    collection_map = {
        "vendor": db.vendors,
        "delivery": db.delivery_partners,
        "admin": db.admins,
        "customer": db.customers
    }
    
    if role not in collection_map:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    collection = collection_map[role]
    
    result = await collection.update_one(
        {"id": user_id},
        {"$set": {"is_active": False}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"success": True}

@admin_router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    role: str,
    user: dict = Depends(require_role("super_admin")),
    db = Depends(get_db)
):
    """Delete a user (super admin only)"""
    collection_map = {
        "vendor": db.vendors,
        "delivery": db.delivery_partners,
        "admin": db.admins,
        "customer": db.customers
    }
    
    if role not in collection_map:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    collection = collection_map[role]
    
    result = await collection.delete_one({"id": user_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"success": True}

# ==================== ADMIN: CREATE ACCOUNTS ====================

@admin_router.post("/create-account")
async def create_account(
    request: Request,
    user: dict = Depends(require_role("super_admin")),
    db = Depends(get_db)
):
    """Create any type of account with optional privileges"""
    import bcrypt
    import hashlib
    body = await request.json()
    
    account_type = body.get("account_type")  # vendor, delivery, customer, admin
    name = body.get("name", "")
    email = body.get("email", "")
    phone = body.get("phone", "")
    password = body.get("password", "hemeley2024")
    zone = body.get("zone", "bonapriso")
    
    # Privileges
    trust_rate = body.get("trust_rate", 0)
    default_rating = body.get("default_rating", 0)
    is_verified = body.get("is_verified", False)
    loyalty_points = body.get("loyalty_points", 0)
    
    account_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    if account_type == "vendor":
        if not name:
            raise HTTPException(status_code=400, detail="Le nom est requis")
        existing = await db.vendors.find_one({"email": email})
        if existing:
            raise HTTPException(status_code=400, detail="Email déjà utilisé")
        
        hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        vendor_doc = {
            "id": account_id,
            "name": name,
            "email": email,
            "phone": phone,
            "zone": zone,
            "password_hash": hashed,
            "role": "vendor",
            "is_active": True,
            "is_verified": is_verified,
            "trust_rate": trust_rate,
            "default_rating": default_rating,
            "rating": default_rating,
            "review_count": 0,
            "created_at": now,
            "created_by": user.get("id")
        }
        await db.vendors.insert_one(vendor_doc)
        
    elif account_type == "delivery":
        if not name:
            raise HTTPException(status_code=400, detail="Le nom est requis")
        hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        delivery_doc = {
            "id": account_id,
            "name": name,
            "email": email,
            "phone": phone,
            "zone": zone,
            "password_hash": hashed,
            "role": "delivery",
            "is_active": True,
            "is_verified": is_verified,
            "trust_rate": trust_rate,
            "created_at": now,
            "created_by": user.get("id")
        }
        await db.delivery_partners.insert_one(delivery_doc)
        
    elif account_type == "customer":
        if not phone:
            raise HTTPException(status_code=400, detail="Le téléphone est requis")
        existing = await db.customers.find_one({"phone": phone})
        if existing:
            raise HTTPException(status_code=400, detail="Téléphone déjà utilisé")
        
        hashed = hashlib.sha256(password.encode()).hexdigest()
        customer_doc = {
            "id": account_id,
            "pseudo": name or f"Client_{phone[-4:]}",
            "phone": phone,
            "email": email,
            "password_hash": hashed,
            "loyalty_points": loyalty_points,
            "loyalty_level": "bronze",
            "referral_code": f"HEM{phone[-4:]}{uuid.uuid4().hex[:4].upper()}",
            "referral_count": 0,
            "trust_rate": trust_rate,
            "is_active": True,
            "created_at": now,
            "created_by": user.get("id")
        }
        await db.customers.insert_one(customer_doc)
        
    elif account_type == "admin":
        if not email:
            raise HTTPException(status_code=400, detail="L'email est requis")
        existing = await db.admins.find_one({"email": email})
        if existing:
            raise HTTPException(status_code=400, detail="Email déjà utilisé")
        
        hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        admin_doc = {
            "id": account_id,
            "name": name or "Admin",
            "email": email,
            "password_hash": hashed,
            "role": body.get("admin_role", "admin"),
            "is_active": True,
            "created_at": now,
            "created_by": user.get("id")
        }
        await db.admins.insert_one(admin_doc)
    else:
        raise HTTPException(status_code=400, detail="Type de compte invalide")
    
    return {"success": True, "id": account_id, "account_type": account_type}

@admin_router.post("/create-accounts-bulk")
async def create_accounts_bulk(
    request: Request,
    user: dict = Depends(require_role("super_admin")),
    db = Depends(get_db)
):
    """Bulk create accounts"""
    import bcrypt
    import hashlib
    body = await request.json()
    accounts = body.get("accounts", [])
    
    if not accounts:
        raise HTTPException(status_code=400, detail="Liste de comptes vide")
    
    created = 0
    errors = []
    
    for acc in accounts:
        try:
            account_type = acc.get("account_type", "customer")
            name = acc.get("name", "")
            email = acc.get("email", "")
            phone = acc.get("phone", "")
            password = acc.get("password", "hemeley2024")
            zone = acc.get("zone", "bonapriso")
            account_id = str(uuid.uuid4())
            now = datetime.now(timezone.utc)
            
            if account_type == "vendor":
                hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                await db.vendors.insert_one({
                    "id": account_id, "name": name, "email": email, "phone": phone,
                    "zone": zone, "password_hash": hashed, "role": "vendor",
                    "is_active": True, "is_verified": acc.get("is_verified", False),
                    "trust_rate": acc.get("trust_rate", 0), "default_rating": acc.get("default_rating", 0),
                    "rating": acc.get("default_rating", 0), "review_count": 0,
                    "created_at": now, "created_by": user.get("id")
                })
            elif account_type == "delivery":
                hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                await db.delivery_partners.insert_one({
                    "id": account_id, "name": name, "email": email, "phone": phone,
                    "zone": zone, "password_hash": hashed, "role": "delivery",
                    "is_active": True, "created_at": now, "created_by": user.get("id")
                })
            elif account_type == "customer":
                hashed = hashlib.sha256(password.encode()).hexdigest()
                await db.customers.insert_one({
                    "id": account_id, "pseudo": name or f"Client_{phone[-4:]}", "phone": phone,
                    "email": email, "password_hash": hashed,
                    "loyalty_points": acc.get("loyalty_points", 0), "loyalty_level": "bronze",
                    "referral_code": f"HEM{uuid.uuid4().hex[:6].upper()}", "referral_count": 0,
                    "is_active": True, "created_at": now, "created_by": user.get("id")
                })
            created += 1
        except Exception as e:
            errors.append({"account": acc.get("name") or acc.get("phone"), "error": str(e)})
    
    return {"success": True, "created": created, "errors": errors}

# ==================== VENDOR PROFILE UPDATE ====================

@admin_router.put("/vendor-profile")
async def update_vendor_profile(
    request: Request,
    db = Depends(get_db)
):
    """Vendor updates their own profile (uses vendor token)"""
    body = await request.json()
    vendor_id = body.get("vendor_id")
    
    if not vendor_id:
        raise HTTPException(status_code=400, detail="vendor_id requis")
    
    update = {}
    allowed_fields = ["name", "phone", "email", "zone", "description", "whatsapp", "opening_hours", "closing_hours"]
    for field in allowed_fields:
        if field in body:
            update[field] = body[field]
    
    if not update:
        raise HTTPException(status_code=400, detail="Aucun champ à mettre à jour")
    
    result = await db.vendors.update_one({"id": vendor_id}, {"$set": update})
    if result.modified_count == 0 and result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Vendeur non trouvé")
    
    vendor = await db.vendors.find_one({"id": vendor_id}, {"_id": 0, "password_hash": 0})
    # Convert datetime
    if vendor and "created_at" in vendor and hasattr(vendor.get("created_at"), "isoformat"):
        vendor["created_at"] = vendor["created_at"].isoformat()
    
    return vendor

async def get_or_create_settings(db):
    """Get platform settings or create defaults"""
    settings = await db.platform_settings.find_one({"id": "platform_settings"}, {"_id": 0})
    if not settings:
        default = PlatformSettings().model_dump()
        # Convert datetime to string for JSON serialization
        if "updated_at" in default and hasattr(default["updated_at"], "isoformat"):
            default["updated_at"] = default["updated_at"].isoformat()
        await db.platform_settings.insert_one(default)
        # Re-fetch without _id
        settings = await db.platform_settings.find_one({"id": "platform_settings"}, {"_id": 0})
    # Convert datetime objects to strings
    if settings and "updated_at" in settings and hasattr(settings["updated_at"], "isoformat"):
        settings["updated_at"] = settings["updated_at"].isoformat()
    for rule in settings.get("loyalty_rules", []):
        if "created_at" in rule and hasattr(rule["created_at"], "isoformat"):
            rule["created_at"] = rule["created_at"].isoformat()
    for promo in settings.get("time_promotions", []):
        if "created_at" in promo and hasattr(promo["created_at"], "isoformat"):
            promo["created_at"] = promo["created_at"].isoformat()
    return settings

@admin_router.get("/settings")
async def get_platform_settings(
    user: dict = Depends(require_role("admin", "super_admin")),
    db = Depends(get_db)
):
    """Get all platform settings"""
    settings = await get_or_create_settings(db)
    return settings

@admin_router.put("/settings/referral")
async def update_referral_settings(
    request: Request,
    user: dict = Depends(require_role("super_admin")),
    db = Depends(get_db)
):
    """Update referral bonus settings"""
    body = await request.json()
    await get_or_create_settings(db)
    
    update = {}
    if "referral_bonus_new_user" in body:
        update["referral_bonus_new_user"] = int(body["referral_bonus_new_user"])
    if "referral_bonus_referrer" in body:
        update["referral_bonus_referrer"] = int(body["referral_bonus_referrer"])
    
    if update:
        update["updated_at"] = datetime.now(timezone.utc)
        update["updated_by"] = user.get("id")
        await db.platform_settings.update_one(
            {"id": "platform_settings"}, {"$set": update}
        )
    
    return await get_or_create_settings(db)

# ==================== LOYALTY RULES ====================

@admin_router.post("/settings/loyalty-rules")
async def add_loyalty_rule(
    data: LoyaltyRuleCreate,
    user: dict = Depends(require_role("super_admin")),
    db = Depends(get_db)
):
    """Add a loyalty points -> discount rule"""
    await get_or_create_settings(db)
    
    rule = LoyaltyRule(
        points_threshold=data.points_threshold,
        discount_percent=data.discount_percent,
        description=data.description or f"{data.points_threshold} pts = {data.discount_percent}% de réduction"
    )
    
    await db.platform_settings.update_one(
        {"id": "platform_settings"},
        {
            "$push": {"loyalty_rules": rule.model_dump()},
            "$set": {"updated_at": datetime.now(timezone.utc), "updated_by": user.get("id")}
        }
    )
    
    return await get_or_create_settings(db)

@admin_router.put("/settings/loyalty-rules/{rule_id}/toggle")
async def toggle_loyalty_rule(
    rule_id: str,
    user: dict = Depends(require_role("super_admin")),
    db = Depends(get_db)
):
    """Toggle a loyalty rule active/inactive"""
    settings = await get_or_create_settings(db)
    rules = settings.get("loyalty_rules", [])
    
    found = False
    for rule in rules:
        if rule["id"] == rule_id:
            rule["is_active"] = not rule["is_active"]
            found = True
            break
    
    if not found:
        raise HTTPException(status_code=404, detail="Règle non trouvée")
    
    await db.platform_settings.update_one(
        {"id": "platform_settings"},
        {"$set": {"loyalty_rules": rules, "updated_at": datetime.now(timezone.utc)}}
    )
    
    return await get_or_create_settings(db)

@admin_router.delete("/settings/loyalty-rules/{rule_id}")
async def delete_loyalty_rule(
    rule_id: str,
    user: dict = Depends(require_role("super_admin")),
    db = Depends(get_db)
):
    """Delete a loyalty rule"""
    await db.platform_settings.update_one(
        {"id": "platform_settings"},
        {
            "$pull": {"loyalty_rules": {"id": rule_id}},
            "$set": {"updated_at": datetime.now(timezone.utc)}
        }
    )
    return await get_or_create_settings(db)

# ==================== TIME PROMOTIONS ====================

@admin_router.post("/settings/time-promotions")
async def add_time_promotion(
    data: TimePromotionCreate,
    user: dict = Depends(require_role("super_admin")),
    db = Depends(get_db)
):
    """Add a time-based promotion"""
    await get_or_create_settings(db)
    
    promo = TimePromotion(
        name=data.name,
        discount_percent=data.discount_percent,
        start_hour=data.start_hour,
        end_hour=data.end_hour,
        start_date=data.start_date,
        end_date=data.end_date,
        days_of_week=data.days_of_week
    )
    
    await db.platform_settings.update_one(
        {"id": "platform_settings"},
        {
            "$push": {"time_promotions": promo.model_dump()},
            "$set": {"updated_at": datetime.now(timezone.utc), "updated_by": user.get("id")}
        }
    )
    
    return await get_or_create_settings(db)

@admin_router.put("/settings/time-promotions/{promo_id}/toggle")
async def toggle_time_promotion(
    promo_id: str,
    user: dict = Depends(require_role("super_admin")),
    db = Depends(get_db)
):
    """Toggle a time promotion active/inactive"""
    settings = await get_or_create_settings(db)
    promos = settings.get("time_promotions", [])
    
    found = False
    for promo in promos:
        if promo["id"] == promo_id:
            promo["is_active"] = not promo["is_active"]
            found = True
            break
    
    if not found:
        raise HTTPException(status_code=404, detail="Promotion non trouvée")
    
    await db.platform_settings.update_one(
        {"id": "platform_settings"},
        {"$set": {"time_promotions": promos, "updated_at": datetime.now(timezone.utc)}}
    )
    
    return await get_or_create_settings(db)

@admin_router.delete("/settings/time-promotions/{promo_id}")
async def delete_time_promotion(
    promo_id: str,
    user: dict = Depends(require_role("super_admin")),
    db = Depends(get_db)
):
    """Delete a time promotion"""
    await db.platform_settings.update_one(
        {"id": "platform_settings"},
        {
            "$pull": {"time_promotions": {"id": promo_id}},
            "$set": {"updated_at": datetime.now(timezone.utc)}
        }
    )
    return await get_or_create_settings(db)

# ==================== CUSTOMERS MANAGEMENT ====================

@admin_router.get("/customers")
async def get_all_customers(
    user: dict = Depends(require_role("admin", "super_admin")),
    db = Depends(get_db)
):
    """Get all customers"""
    customers = await db.customers.find({}, {"_id": 0, "password_hash": 0}).to_list(200)
    return customers

# ==================== ACTIVE PROMOTIONS (Public) ====================

@admin_router.get("/active-promotions")
async def get_active_promotions(
    db = Depends(get_db)
):
    """Get currently active promotions (no auth required for customer display)"""
    settings = await db.platform_settings.find_one({"id": "platform_settings"}, {"_id": 0})
    if not settings:
        return {"loyalty_rules": [], "time_promotions": []}
    
    active_rules = [r for r in settings.get("loyalty_rules", []) if r.get("is_active")]
    active_promos = [p for p in settings.get("time_promotions", []) if p.get("is_active")]
    
    return {"loyalty_rules": active_rules, "time_promotions": active_promos}