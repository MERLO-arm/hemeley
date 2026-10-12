from fastapi import FastAPI, APIRouter, Request
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path

# Import routes
from routes_auth import auth_router
from routes_menu import menu_router
from routes_order import order_router
from routes_payment import payment_router
from routes_delivery import delivery_router
from routes_admin import admin_router
from routes_notification import notification_router

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI(title="HEMELEY API", version="2.0.0")
api_router = APIRouter(prefix="/api")

# Add database to app state
app.state.db = db

# ==================== MIDDLEWARE ====================

@app.middleware("http")
async def add_db_to_request(request: Request, call_next):
    request.state.db = db
    response = await call_next(request)
    return response

# ==================== ROUTES ====================

@api_router.get("/")
async def root():
    return {"message": "HEMELEY API v2.0 - Le goût du risque 🍛", "status": "running"}

@api_router.get("/zones")
async def get_zones():
    zones = [
        {"id": "1", "name": "Bonapriso", "slug": "bonapriso"},
        {"id": "2", "name": "Bonanjo", "slug": "bonanjo"}
    ]
    return zones

# Include all routers
api_router.include_router(auth_router, prefix="/auth", tags=["Authentication"])
api_router.include_router(menu_router, prefix="/menus", tags=["Menus"])
api_router.include_router(order_router, prefix="/orders", tags=["Orders"])
api_router.include_router(payment_router, prefix="/payments", tags=["Payments"])
api_router.include_router(delivery_router, prefix="/delivery", tags=["Delivery"])
api_router.include_router(admin_router, prefix="/admin", tags=["Admin"])
api_router.include_router(notification_router, prefix="/notifications", tags=["Notifications"])

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
        content={"detail": "Internal server error"}
    )
