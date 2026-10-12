from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Depends, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, time
import bcrypt
import jwt
import base64
import io
from PIL import Image

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Secret
JWT_SECRET = os.environ.get('JWT_SECRET', 'hemeley_secret_key_2024')
security = HTTPBearer()

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# ==================== MODELS ====================

class Zone(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    slug: str

class Vendor(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    phone: str
    zone: str
    password_hash: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class VendorCreate(BaseModel):
    name: str
    email: str
    phone: str
    zone: str
    password: str

class VendorLogin(BaseModel):
    email: str
    password: str

class Menu(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vendor_id: str
    vendor_name: str
    name: str
    description: str
    ingredients: str
    price: float
    zone: str
    total_portions: int
    remaining_portions: int
    image_base64: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MenuCreate(BaseModel):
    name: str
    description: str
    ingredients: str
    price: float
    zone: str
    total_portions: int
    image_base64: Optional[str] = None

class MenuUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    ingredients: Optional[str] = None
    price: Optional[float] = None
    total_portions: Optional[int] = None
    remaining_portions: Optional[int] = None
    is_active: Optional[bool] = None
    image_base64: Optional[str] = None

class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    menu_id: str
    menu_name: str
    vendor_id: str
    vendor_name: str
    vendor_phone: str
    pseudonym: str
    comment: str
    phone: str
    email: Optional[str] = None
    order_type: str  # "commander" or "reserver"
    amount: float
    payment_method: str  # "orange" or "mtn"
    payment_status: str = "pending"  # "pending" or "confirmed"
    zone: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OrderCreate(BaseModel):
    menu_id: str
    pseudonym: str
    comment: str
    phone: str
    email: Optional[str] = None
    order_type: str
    payment_method: str

# ==================== UTILITIES ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(vendor_id: str, email: str) -> str:
    payload = {"vendor_id": vendor_id, "email": email}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_vendor(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = decode_token(token)
    vendor = await db.vendors.find_one({"id": payload["vendor_id"]}, {"_id": 0})
    if not vendor:
        raise HTTPException(status_code=401, detail="Vendor not found")
    return vendor

def is_menu_time_available() -> bool:
    """Check if current time is between 10h and 15h"""
    now = datetime.now(timezone.utc)
    # Adjust for Douala timezone (UTC+1)
    local_time = now.replace(hour=(now.hour + 1) % 24)
    current_hour = local_time.hour
    return 5 <= current_hour < 22

def compress_image(image_base64: str, max_size: int = 800) -> str:
    """Compress image for low bandwidth"""
    try:
        image_data = base64.b64decode(image_base64.split(',')[1] if ',' in image_base64 else image_base64)
        img = Image.open(io.BytesIO(image_data))
        
        # Convert to RGB if necessary
        if img.mode in ('RGBA', 'LA', 'P'):
            img = img.convert('RGB')
        
        # Resize if too large
        if img.width > max_size or img.height > max_size:
            img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        
        # Compress
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG', quality=70, optimize=True)
        compressed = base64.b64encode(buffer.getvalue()).decode('utf-8')
        return f"data:image/jpeg;base64,{compressed}"
    except:
        return image_base64

# ==================== ROUTES ====================

@api_router.get("/")
async def root():
    return {"message": "HEMELEY API - Les saveurs qui font vibrer 😋🍛"}

# Zones
@api_router.get("/zones", response_model=List[Zone])
async def get_zones():
    zones = [
        Zone(id="1", name="Bonapriso", slug="bonapriso"),
        Zone(id="2", name="Bonanjo", slug="bonanjo")
    ]
    return zones

# Menus (Public)
@api_router.get("/menus", response_model=List[Menu])
async def get_menus(zone: Optional[str] = None):
    query = {"is_active": True}
    if zone:
        query["zone"] = zone
    
    menus = await db.menus.find(query, {"_id": 0}).to_list(100)
    
    # Convert datetime
    for menu in menus:
        if isinstance(menu.get('created_at'), str):
            menu['created_at'] = datetime.fromisoformat(menu['created_at'])
    
    return menus

@api_router.get("/menus/{menu_id}", response_model=Menu)
async def get_menu(menu_id: str):
    menu = await db.menus.find_one({"id": menu_id}, {"_id": 0})
    if not menu:
        raise HTTPException(status_code=404, detail="Menu not found")
    
    if isinstance(menu.get('created_at'), str):
        menu['created_at'] = datetime.fromisoformat(menu['created_at'])
    
    return menu

@api_router.get("/menu-time-check")
async def menu_time_check():
    return {"available": is_menu_time_available()}

# Orders (Public)
@api_router.post("/orders", response_model=Order)
async def create_order(order_data: OrderCreate):
    # Get menu
    menu = await db.menus.find_one({"id": order_data.menu_id}, {"_id": 0})
    if not menu:
        raise HTTPException(status_code=404, detail="Menu not found")
    
    if menu["remaining_portions"] <= 0:
        raise HTTPException(status_code=400, detail="No portions remaining")
    
    # Get vendor
    vendor = await db.vendors.find_one({"id": menu["vendor_id"]}, {"_id": 0})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    # Calculate amount
    amount = menu["price"] if order_data.order_type == "commander" else menu["price"] * 0.1
    
    # Create order
    order = Order(
        menu_id=order_data.menu_id,
        menu_name=menu["name"],
        vendor_id=menu["vendor_id"],
        vendor_name=vendor["name"],
        vendor_phone=vendor["phone"],
        pseudonym=order_data.pseudonym,
        comment=order_data.comment,
        phone=order_data.phone,
        email=order_data.email,
        order_type=order_data.order_type,
        amount=amount,
        payment_method=order_data.payment_method,
        zone=menu["zone"]
    )
    
    # Save order
    doc = order.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.orders.insert_one(doc)
    
    # Update remaining portions
    await db.menus.update_one(
        {"id": order_data.menu_id},
        {"$set": {"remaining_portions": menu["remaining_portions"] - 1}}
    )
    
    return order

# Vendor Auth
@api_router.post("/vendor/register")
async def register_vendor(vendor_data: VendorCreate):
    # Check if email exists
    existing = await db.vendors.find_one({"email": vendor_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    vendor = Vendor(
        name=vendor_data.name,
        email=vendor_data.email,
        phone=vendor_data.phone,
        zone=vendor_data.zone,
        password_hash=hash_password(vendor_data.password)
    )
    
    doc = vendor.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.vendors.insert_one(doc)
    
    token = create_token(vendor.id, vendor.email)
    return {"token": token, "vendor": {"id": vendor.id, "name": vendor.name, "email": vendor.email}}

@api_router.post("/vendor/login")
async def login_vendor(login_data: VendorLogin):
    vendor = await db.vendors.find_one({"email": login_data.email}, {"_id": 0})
    if not vendor:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(login_data.password, vendor["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(vendor["id"], vendor["email"])
    return {"token": token, "vendor": {"id": vendor["id"], "name": vendor["name"], "email": vendor["email"], "zone": vendor["zone"]}}

# Vendor Menus
@api_router.get("/vendor/menus", response_model=List[Menu])
async def get_vendor_menus(current_vendor: dict = Depends(get_current_vendor)):
    menus = await db.menus.find({"vendor_id": current_vendor["id"]}, {"_id": 0}).to_list(100)
    
    for menu in menus:
        if isinstance(menu.get('created_at'), str):
            menu['created_at'] = datetime.fromisoformat(menu['created_at'])
    
    return menus

@api_router.post("/vendor/menus", response_model=Menu)
async def create_menu(menu_data: MenuCreate, current_vendor: dict = Depends(get_current_vendor)):
    # Compress image if provided
    image_base64 = None
    if menu_data.image_base64:
        image_base64 = compress_image(menu_data.image_base64)
    
    menu = Menu(
        vendor_id=current_vendor["id"],
        vendor_name=current_vendor["name"],
        name=menu_data.name,
        description=menu_data.description,
        ingredients=menu_data.ingredients,
        price=menu_data.price,
        zone=menu_data.zone,
        total_portions=menu_data.total_portions,
        remaining_portions=menu_data.total_portions,
        image_base64=image_base64
    )
    
    doc = menu.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.menus.insert_one(doc)
    
    return menu

@api_router.put("/vendor/menus/{menu_id}", response_model=Menu)
async def update_menu(menu_id: str, menu_data: MenuUpdate, current_vendor: dict = Depends(get_current_vendor)):
    # Check menu exists and belongs to vendor
    menu = await db.menus.find_one({"id": menu_id, "vendor_id": current_vendor["id"]}, {"_id": 0})
    if not menu:
        raise HTTPException(status_code=404, detail="Menu not found")
    
    # Prepare update
    update_data = {k: v for k, v in menu_data.model_dump(exclude_unset=True).items() if v is not None}
    
    # Compress image if provided
    if "image_base64" in update_data and update_data["image_base64"]:
        update_data["image_base64"] = compress_image(update_data["image_base64"])
    
    if update_data:
        await db.menus.update_one({"id": menu_id}, {"$set": update_data})
    
    # Get updated menu
    updated_menu = await db.menus.find_one({"id": menu_id}, {"_id": 0})
    if isinstance(updated_menu.get('created_at'), str):
        updated_menu['created_at'] = datetime.fromisoformat(updated_menu['created_at'])
    
    return updated_menu

@api_router.delete("/vendor/menus/{menu_id}")
async def delete_menu(menu_id: str, current_vendor: dict = Depends(get_current_vendor)):
    result = await db.menus.delete_one({"id": menu_id, "vendor_id": current_vendor["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Menu not found")
    return {"success": True}

# Vendor Orders
@api_router.get("/vendor/orders", response_model=List[Order])
async def get_vendor_orders(current_vendor: dict = Depends(get_current_vendor)):
    orders = await db.orders.find({"vendor_id": current_vendor["id"]}, {"_id": 0}).to_list(100)
    
    for order in orders:
        if isinstance(order.get('created_at'), str):
            order['created_at'] = datetime.fromisoformat(order['created_at'])
    
    return orders

@api_router.put("/vendor/orders/{order_id}/confirm")
async def confirm_payment(order_id: str, current_vendor: dict = Depends(get_current_vendor)):
    result = await db.orders.update_one(
        {"id": order_id, "vendor_id": current_vendor["id"]},
        {"$set": {"payment_status": "confirmed"}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return {"success": True}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()