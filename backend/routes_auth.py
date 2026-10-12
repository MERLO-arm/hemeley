from fastapi import APIRouter, HTTPException, Depends, Request
from typing import Annotated
from motor.motor_asyncio import AsyncIOMotorDatabase
from models import UserRegister, UserLogin, TokenResponse, Vendor, Delivery, Admin
from auth import hash_password, verify_password, create_token
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

auth_router = APIRouter()

def get_db(request: Request):
    return request.app.state.db

@auth_router.post("/register", response_model=TokenResponse)
async def register(user_data: UserRegister, db = Depends(get_db)):
    """
    Register a new user (vendor, delivery, or admin)
    """
    # Determine collection based on role
    if user_data.role == "vendor":
        collection = db.vendors
        user = Vendor(
            email=user_data.email,
            phone=user_data.phone,
            name=user_data.name,
            zone=user_data.zone or "bonapriso",
            address=user_data.address,
            password_hash=hash_password(user_data.password)
        )
    elif user_data.role == "delivery":
        collection = db.delivery_partners
        user = Delivery(
            email=user_data.email,
            phone=user_data.phone,
            name=user_data.name,
            vehicle_type=user_data.vehicle_type,
            password_hash=hash_password(user_data.password)
        )
    elif user_data.role == "admin":
        collection = db.admins
        user = Admin(
            email=user_data.email,
            phone=user_data.phone,
            name=user_data.name,
            role="admin",
            password_hash=hash_password(user_data.password)
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    # Check if email already exists
    existing = await collection.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Save user
    user_doc = user.model_dump()
    user_doc['created_at'] = user_doc['created_at'].isoformat()
    await collection.insert_one(user_doc)
    
    # Create token
    token = create_token(user.id, user.email, user.role)
    
    # Return response without password_hash
    user_dict = user.model_dump(exclude={'password_hash'})
    
    return TokenResponse(token=token, user=user_dict)

@auth_router.post("/login", response_model=TokenResponse)
async def login(login_data: UserLogin, db = Depends(get_db)):
    """
    Login user
    """
    # Try to find user in different collections
    user = None
    
    if login_data.role:
        # Search in specific collection
        if login_data.role == "vendor":
            user = await db.vendors.find_one({"email": login_data.email}, {"_id": 0})
        elif login_data.role == "delivery":
            user = await db.delivery_partners.find_one({"email": login_data.email}, {"_id": 0})
        elif login_data.role in ["admin", "super_admin"]:
            user = await db.admins.find_one({"email": login_data.email}, {"_id": 0})
    else:
        # Search in all collections
        for collection_name in ["vendors", "delivery_partners", "admins"]:
            user = await db[collection_name].find_one({"email": login_data.email}, {"_id": 0})
            if user:
                break
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is inactive")
    
    if not verify_password(login_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Create token
    token = create_token(user["id"], user["email"], user["role"])
    
    # Return response without password_hash
    user_dict = {k: v for k, v in user.items() if k != "password_hash"}
    
    return TokenResponse(token=token, user=user_dict)