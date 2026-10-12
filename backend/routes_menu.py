from fastapi import APIRouter, HTTPException, Depends, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from models import Menu, MenuCreate, MenuUpdate
from auth import get_current_user, require_role
from utils import is_menu_available
from datetime import datetime, timezone
import base64
import io
from PIL import Image
import logging

logger = logging.getLogger(__name__)

menu_router = APIRouter()

BASE_CATEGORIES = {"entree", "plat", "boisson", "dessert", "petit-dejeuner", "snack", "autre"}


async def _validate_category(category: str, vendor_id: str, db) -> str:
    """Vérifie que la catégorie est autorisée (base ou custom du vendor)."""
    if not category:
        return "plat"
    normalized = category.strip()
    key = normalized.lower()
    if key in BASE_CATEGORIES:
        return key
    vendor = await db.vendors.find_one({"id": vendor_id}, {"_id": 0, "custom_categories": 1})
    customs = {c.lower(): c for c in (vendor.get("custom_categories") or [])} if vendor else {}
    if key in customs:
        return customs[key]  # renvoie le libellé original
    raise HTTPException(
        status_code=400,
        detail=f"Catégorie '{category}' invalide. Utilisez une catégorie de base ou créez-la dans vos paramètres.",
    )


def get_db(request: Request):
    return request.app.state.db

def compress_image(image_base64: str, max_size: int = 800) -> str:
    """Compress image for low bandwidth"""
    try:
        image_data = base64.b64decode(image_base64.split(',')[1] if ',' in image_base64 else image_base64)
        img = Image.open(io.BytesIO(image_data))
        
        if img.mode in ('RGBA', 'LA', 'P'):
            img = img.convert('RGB')
        
        if img.width > max_size or img.height > max_size:
            img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG', quality=70, optimize=True)
        compressed = base64.b64encode(buffer.getvalue()).decode('utf-8')
        return f"data:image/jpeg;base64,{compressed}"
    except:
        return image_base64

@menu_router.get("/", response_model=list[Menu])
@menu_router.get("", response_model=list[Menu])  # Without trailing slash
async def get_menus(zone: str = None, db = Depends(get_db)):
    """Get all active menus, optionally filtered by zone"""
    query = {"is_active": True}
    if zone:
        query["zone"] = zone
    
    menus = await db.menus.find(query, {"_id": 0}).to_list(100)
    
    # Filter by availability
    available_menus = [menu for menu in menus if is_menu_available(menu)]
    
    for menu in available_menus:
        if isinstance(menu.get('created_at'), str):
            menu['created_at'] = datetime.fromisoformat(menu['created_at'])
    
    return available_menus

@menu_router.get("/{menu_id}", response_model=Menu)
async def get_menu(menu_id: str, db = Depends(get_db)):
    """Get a specific menu"""
    menu = await db.menus.find_one({"id": menu_id}, {"_id": 0})
    if not menu:
        raise HTTPException(status_code=404, detail="Menu not found")
    
    if isinstance(menu.get('created_at'), str):
        menu['created_at'] = datetime.fromisoformat(menu['created_at'])
    
    return menu

@menu_router.post("/", response_model=Menu)
async def create_menu(
    menu_data: MenuCreate,
    user: dict = Depends(require_role("vendor")),
    db = Depends(get_db)
):
    """Create a new menu (vendor only)"""
    image_base64 = None
    if menu_data.image_base64:
        image_base64 = compress_image(menu_data.image_base64)

    validated_category = await _validate_category(menu_data.category, user["id"], db)

    menu = Menu(
        vendor_id=user["id"],
        vendor_name=user["name"],
        name=menu_data.name,
        description=menu_data.description,
        ingredients=menu_data.ingredients,
        price=menu_data.price,
        original_price=menu_data.original_price,
        discount_percent=menu_data.discount_percent,
        category=validated_category,
        zone=menu_data.zone,
        total_portions=menu_data.total_portions,
        remaining_portions=menu_data.total_portions,
        cost_price=menu_data.cost_price,
        image_base64=image_base64,
        visibility_start=menu_data.visibility_start,
        visibility_end=menu_data.visibility_end,
        availability=menu_data.availability or {"type": "always"}
    )
    
    doc = menu.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.menus.insert_one(doc)
    
    return menu

@menu_router.put("/{menu_id}", response_model=Menu)
async def update_menu(
    menu_id: str,
    menu_data: MenuUpdate,
    user: dict = Depends(require_role("vendor")),
    db = Depends(get_db)
):
    """Update a menu (vendor only)"""
    menu = await db.menus.find_one({"id": menu_id, "vendor_id": user["id"]}, {"_id": 0})
    if not menu:
        raise HTTPException(status_code=404, detail="Menu not found")
    
    update_data = {k: v for k, v in menu_data.model_dump(exclude_unset=True).items() if v is not None}

    if "category" in update_data:
        update_data["category"] = await _validate_category(update_data["category"], user["id"], db)

    if "image_base64" in update_data and update_data["image_base64"]:
        update_data["image_base64"] = compress_image(update_data["image_base64"])
    
    if update_data:
        await db.menus.update_one({"id": menu_id}, {"$set": update_data})
    
    updated_menu = await db.menus.find_one({"id": menu_id}, {"_id": 0})
    if isinstance(updated_menu.get('created_at'), str):
        updated_menu['created_at'] = datetime.fromisoformat(updated_menu['created_at'])
    
    return updated_menu

@menu_router.delete("/{menu_id}")
async def delete_menu(
    menu_id: str,
    user: dict = Depends(require_role("vendor")),
    db = Depends(get_db)
):
    """Delete a menu (vendor only)"""
    result = await db.menus.delete_one({"id": menu_id, "vendor_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Menu not found")
    return {"success": True}

@menu_router.get("/vendor/my-menus", response_model=list[Menu])
async def get_vendor_menus(
    user: dict = Depends(require_role("vendor")),
    db = Depends(get_db)
):
    """Get all menus for the current vendor"""
    menus = await db.menus.find({"vendor_id": user["id"]}, {"_id": 0}).to_list(100)
    
    for menu in menus:
        if isinstance(menu.get('created_at'), str):
            menu['created_at'] = datetime.fromisoformat(menu['created_at'])
    
    return menus