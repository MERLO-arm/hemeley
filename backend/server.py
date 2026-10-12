from fastapi import FastAPI, APIRouter, Request, HTTPException, Header
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path

# Load .env BEFORE importing any route module. Route modules read JWT_SECRET
# (and other env-derived constants) at import-time; if load_dotenv runs after,
# they silently pick fallback constants → auth-secret mismatch between modules.
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Import routes
from routes_auth import auth_router
from routes_menu import menu_router
from routes_order import order_router
from routes_payment import payment_router, campay_router
from routes_vendor_analytics import vendor_analytics_router
from routes_delivery import delivery_router
from routes_admin import admin_router
from routes_notification import notification_router
from routes_export import export_router
from routes_customer import customer_router
from routes_vendor_public import vendor_public_router
from routes_public import public_router
from routes_chatbot import chatbot_router
from routes_wallet import wallet_router, webhook_router
from routes_admin_wallet import admin_wallet_router
from realtime import ws_router

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI(
    title="HEMELEY API",
    version="2.0.0",
    description="Le goût du risque 🍛"
)
api_router = APIRouter(prefix="/api")

# Add database to app state
app.state.db = db

# ==================== MIDDLEWARE ====================

@app.middleware("http")
async def add_db_to_request(request: Request, call_next):
    request.state.db = db
    response = await call_next(request)
    return response

# ==================== BASE ROUTES ====================

@api_router.get("/")
async def root():
    return {
        "message": "HEMELEY API v2.0 - Le goût du risque 🍛",
        "status": "running",
        "version": "2.0.0",
        "features": ["campay_payment", "multi_cart", "delivery", "admin"]
    }

@api_router.get("/zones")
async def get_zones():
    zones = [
        {"id": "1", "name": "Bonapriso", "slug": "bonapriso"},
        {"id": "2", "name": "Bonanjo", "slug": "bonanjo"}
    ]
    return zones

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "database": "connected"}

# Include all routers
api_router.include_router(auth_router, prefix="/auth", tags=["Authentication"])
api_router.include_router(menu_router, prefix="/menus", tags=["Menus"])
api_router.include_router(order_router, prefix="/orders", tags=["Orders"])
api_router.include_router(payment_router, prefix="/payments", tags=["Payments"])
api_router.include_router(campay_router, tags=["CamPay"])
api_router.include_router(vendor_analytics_router, tags=["Vendor Analytics"])
api_router.include_router(delivery_router, prefix="/delivery", tags=["Delivery"])
api_router.include_router(admin_router, prefix="/admin", tags=["Admin"])
api_router.include_router(notification_router, prefix="/notifications", tags=["Notifications"])
api_router.include_router(export_router, prefix="/export", tags=["Export"])
api_router.include_router(customer_router)
api_router.include_router(vendor_public_router)
api_router.include_router(public_router)
api_router.include_router(chatbot_router, prefix="/chatbot", tags=["Chatbot"])
api_router.include_router(wallet_router, prefix="/wallet", tags=["Wallet"])
api_router.include_router(webhook_router, prefix="/webhooks", tags=["Webhooks"])
api_router.include_router(admin_wallet_router, prefix="/admin", tags=["AdminWallet"])
api_router.include_router(ws_router, prefix="/ws", tags=["Realtime"])

# ==================== BACKWARD COMPATIBILITY ROUTES ====================
# Support old MVP routes for smooth transition

@api_router.post("/vendor/register")
async def vendor_register_compat(request: Request):
    """Backward compatibility for vendor registration"""
    from routes_auth import register
    from models import UserRegister
    body = await request.json()
    body['role'] = 'vendor'
    user_data = UserRegister(**body)
    return await register(user_data, request.app.state.db)

@api_router.post("/vendor/login")
async def vendor_login_compat(request: Request):
    """Backward compatibility for vendor login"""
    from routes_auth import login
    from models import UserLogin
    body = await request.json()
    body['role'] = 'vendor'
    login_data = UserLogin(**body)
    return await login(login_data, request.app.state.db)

@api_router.get("/vendor/menus")
async def vendor_menus_compat(request: Request, authorization: str = Header(None)):
    """Backward compatibility for vendor menus"""
    from routes_menu import get_vendor_menus
    from fastapi.security import HTTPAuthorizationCredentials
    from auth import require_role
    
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization required")
    
    # Mock credentials
    class MockCreds:
        def __init__(self, token):
            self.credentials = token
    
    creds = MockCreds(authorization.replace('Bearer ', ''))
    from auth import get_current_user
    user = await get_current_user(creds, request)
    
    return await get_vendor_menus(user, request.app.state.db)

@api_router.post("/vendor/menus")
async def create_menu_compat(request: Request, authorization: str = Header(None)):
    """Backward compatibility for creating menu"""
    from routes_menu import create_menu
    from models import MenuCreate
    
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization required")
    
    class MockCreds:
        def __init__(self, token):
            self.credentials = token
    
    creds = MockCreds(authorization.replace('Bearer ', ''))
    from auth import get_current_user
    user = await get_current_user(creds, request)
    
    body = await request.json()
    menu_data = MenuCreate(**body)
    return await create_menu(menu_data, user, request.app.state.db)

@api_router.put("/vendor/menus/{menu_id}")
async def update_menu_compat(menu_id: str, request: Request, authorization: str = Header(None)):
    """Backward compatibility for updating menu"""
    from routes_menu import update_menu
    from models import MenuUpdate
    
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization required")
    
    class MockCreds:
        def __init__(self, token):
            self.credentials = token
    
    creds = MockCreds(authorization.replace('Bearer ', ''))
    from auth import get_current_user
    user = await get_current_user(creds, request)
    
    body = await request.json()
    menu_data = MenuUpdate(**body)
    return await update_menu(menu_id, menu_data, user, request.app.state.db)

@api_router.delete("/vendor/menus/{menu_id}")
async def delete_menu_compat(menu_id: str, request: Request, authorization: str = Header(None)):
    """Backward compatibility for deleting menu"""
    from routes_menu import delete_menu
    
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization required")
    
    class MockCreds:
        def __init__(self, token):
            self.credentials = token
    
    creds = MockCreds(authorization.replace('Bearer ', ''))
    from auth import get_current_user
    user = await get_current_user(creds, request)
    
    return await delete_menu(menu_id, user, request.app.state.db)

@api_router.get("/vendor/orders")
async def vendor_orders_compat(request: Request, authorization: str = Header(None)):
    """Backward compatibility for vendor orders"""
    from routes_order import get_vendor_orders
    
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization required")
    
    class MockCreds:
        def __init__(self, token):
            self.credentials = token
    
    creds = MockCreds(authorization.replace('Bearer ', ''))
    from auth import get_current_user
    user = await get_current_user(creds, request)
    
    return await get_vendor_orders(user, request.app.state.db)

@api_router.get("/menu-time-check")
async def menu_time_check_compat():
    """Backward compatibility for time check"""
    # Simple time check - always return true for now
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    current_hour = (now.hour + 1) % 24  # Douala timezone
    return {"available": True}  # Simplified - always available

@api_router.put("/vendor/orders/{order_id}/confirm")
async def confirm_payment_compat(order_id: str, request: Request, authorization: str = Header(None)):
    """Backward compatibility for confirming payment"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization required")
    
    class MockCreds:
        def __init__(self, token):
            self.credentials = token
    
    creds = MockCreds(authorization.replace('Bearer ', ''))
    from auth import get_current_user
    user = await get_current_user(creds, request)
    
    result = await request.app.state.db.orders.update_one(
        {"id": order_id, "vendor_id": user["id"]},
        {"$set": {"payment_status": "confirmed"}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return {"success": True}

# Include the router in the main app
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# Error handlers
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "type": str(type(exc).__name__)}
    )
