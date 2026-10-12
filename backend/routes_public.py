"""Public endpoints — no authentication required.

- POST /api/public/partnership : nouvelle candidature partenaire
- GET  /api/public/menu/{slug} : page publique d'un restaurant (QR-code)
- POST /api/public/order/{slug} : commande directe via la page publique
                                  (paiement online via CamPay OU cash)
"""
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, Field
from typing import Literal, Optional, List
from datetime import datetime, timezone
import logging
import re
import uuid

from models import (
    PartnershipRequest,
    PartnershipRequestCreate,
)
from utils import is_menu_available

logger = logging.getLogger(__name__)

public_router = APIRouter(prefix="/public", tags=["Public"])


def get_db(request: Request):
    return request.app.state.db


def slugify(text: str) -> str:
    """Génère un slug URL-safe à partir d'un nom (ex: 'Chez Marie' -> 'chez-marie')."""
    text = (text or "").strip().lower()
    text = re.sub(r"[àáâãäå]", "a", text)
    text = re.sub(r"[éèêë]", "e", text)
    text = re.sub(r"[ìíîï]", "i", text)
    text = re.sub(r"[òóôõö]", "o", text)
    text = re.sub(r"[ùúûü]", "u", text)
    text = re.sub(r"[ç]", "c", text)
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"^-+|-+$", "", text)
    return text or f"resto-{uuid.uuid4().hex[:6]}"


async def ensure_unique_slug(db, base_slug: str) -> str:
    """Garantit l'unicité du slug en suffixant -2, -3... au besoin."""
    candidate = base_slug
    suffix = 2
    while await db.vendors.find_one({"slug": candidate}, {"_id": 0}):
        candidate = f"{base_slug}-{suffix}"
        suffix += 1
    return candidate


@public_router.get("/settings")
async def get_public_settings(request: Request):
    """Lightweight public settings (no auth) — used by frontend to know if vendor identity is hidden."""
    db = request.app.state.db
    s = await db.platform_settings.find_one({"id": "platform_settings"}, {"_id": 0})
    return {
        "hide_vendor_identity": bool((s or {}).get("hide_vendor_identity", True)),
    }


# ========================================================
# Partnership requests
# ========================================================

@public_router.post("/partnership")
async def submit_partnership_request(
    payload: PartnershipRequestCreate,
    request: Request,
):
    """Enregistre une demande de partenariat (formulaire /devenir-partenaire)."""
    db = request.app.state.db

    # Anti-spam: même phone + business avec une demande pending => bloquer
    existing = await db.partnership_requests.find_one(
        {
            "phone": payload.phone,
            "business_name": payload.business_name,
            "status": "pending",
        },
        {"_id": 0},
    )
    if existing:
        return {
            "success": True,
            "id": existing["id"],
            "message": "Votre demande est déjà en cours de traitement.",
            "duplicate": True,
        }

    req = PartnershipRequest(
        name=payload.name.strip(),
        phone=payload.phone.strip(),
        business_name=payload.business_name.strip(),
        type=payload.type,
        zone=payload.zone.strip(),
        description=(payload.description or "").strip() or None,
    )
    doc = req.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.partnership_requests.insert_one(doc)

    # Admin notification (in-app)
    try:
        from models import Notification
        notif = Notification(
            user_id="admin",  # all admins polling
            user_role="admin",
            type="partnership_request",
            title="Nouvelle demande partenaire",
            message=f"{req.business_name} ({req.type}) - {req.zone}",
            metadata={"request_id": req.id},
        )
        ndoc = notif.model_dump()
        ndoc["created_at"] = ndoc["created_at"].isoformat()
        await db.notifications.insert_one(ndoc)
    except Exception as e:
        logger.warning(f"Admin notification insert failed: {e}")

    return {
        "success": True,
        "id": req.id,
        "message": "Votre demande a bien été reçue. Nous vous contacterons sous 48h.",
    }


# ========================================================
# Public QR-code branded menu page
# ========================================================

async def _serialize_vendor_public(vendor: dict, hide_identity: bool = False) -> dict:
    """Public projection of a vendor doc — strips PII on the main marketplace."""
    if not vendor:
        return {}
    return {
        "id": vendor.get("id"),
        "slug": vendor.get("slug"),
        "name": vendor.get("name"),  # SHOWN on /menu/:slug (QR page = explicit brand)
        "slogan": vendor.get("slogan"),
        "brand_color": vendor.get("brand_color") or "#FF6B00",
        "logo_base64": vendor.get("logo_base64"),
        "cover_base64": vendor.get("cover_base64"),        # legacy single cover (fallback)
        "cover_photos": vendor.get("cover_photos") or [],  # nouveau : jusqu'à 3 photos
        "custom_categories": vendor.get("custom_categories") or [],
        "zone": vendor.get("zone"),
        "phone": vendor.get("phone") if not hide_identity else None,
        "address": vendor.get("address") if not hide_identity else None,
    }


@public_router.get("/menu/{slug}")
async def public_menu_by_slug(slug: str, request: Request):
    """Page publique d'un restaurant via son slug (QR-code).

    Retourne :
      - vendor : infos branded (logo, couleur, slogan...)
      - menus  : tous les menus actifs avec portions > 0
    """
    db = request.app.state.db
    vendor = await db.vendors.find_one({"slug": slug, "is_active": True}, {"_id": 0, "password_hash": 0})
    if not vendor:
        raise HTTPException(status_code=404, detail="Restaurant introuvable")

    menus_raw = await db.menus.find(
        {"vendor_id": vendor["id"], "is_active": True},
        {"_id": 0},
    ).to_list(200)

    # Filter by availability (visibility window + time-of-day rules)
    menus_active: List[dict] = []
    for m in menus_raw:
        # remaining_portions can be int OR corrupted string from legacy seeds
        try:
            remaining = int(m.get("remaining_portions") or 0)
        except (TypeError, ValueError):
            remaining = 0
        if remaining <= 0:
            continue
        if is_menu_available(m):
            m["remaining_portions"] = remaining
            menus_active.append(m)

    return {
        "vendor": await _serialize_vendor_public(vendor, hide_identity=False),
        "menus": menus_active,
    }


class PublicOrderItem(BaseModel):
    menu_id: str
    quantity: int = Field(..., gt=0, le=20)


class PublicOrderIn(BaseModel):
    customer_name: str = Field(..., min_length=2)
    customer_phone: str = Field(..., min_length=8)
    customer_note: Optional[str] = None
    items: List[PublicOrderItem]
    payment_method: Literal["online", "cash"]


@public_router.post("/order/{slug}")
async def public_order(slug: str, payload: PublicOrderIn, request: Request):
    """Crée une commande depuis la page publique branded.

    - payment_method='cash' : commande enregistrée, paiement à la livraison/caisse
    - payment_method='online' : ouvre un /collect CamPay et renvoie la reference
    """
    db = request.app.state.db
    vendor = await db.vendors.find_one({"slug": slug, "is_active": True}, {"_id": 0})
    if not vendor:
        raise HTTPException(status_code=404, detail="Restaurant introuvable")

    if not payload.items:
        raise HTTPException(status_code=400, detail="Panier vide")

    # Build order items + verify portions
    order_items = []
    subtotal = 0
    for it in payload.items:
        menu = await db.menus.find_one({"id": it.menu_id, "vendor_id": vendor["id"]}, {"_id": 0})
        if not menu:
            raise HTTPException(status_code=404, detail=f"Plat introuvable: {it.menu_id}")
        try:
            remaining = int(menu.get("remaining_portions") or 0)
        except (TypeError, ValueError):
            remaining = 0
        if remaining < it.quantity:
            raise HTTPException(status_code=400, detail=f"Stock insuffisant pour {menu['name']}")
        line_subtotal = float(menu["price"]) * it.quantity
        subtotal += line_subtotal
        order_items.append({
            "menu_id": menu["id"],
            "menu_name": menu["name"],
            "price": float(menu["price"]),
            "quantity": it.quantity,
            "subtotal": line_subtotal,
            "vendor_id": vendor["id"],
            "vendor_name": vendor["name"],
            "image_base64": menu.get("image_base64"),
            "zone": vendor.get("zone"),
        })

    total = subtotal  # No delivery fee for QR/on-site service

    order_id = str(uuid.uuid4())
    order_number = f"QR-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    order_doc = {
        "id": order_id,
        "order_number": order_number,
        "source": "public_qr",
        "vendor_id": vendor["id"],
        "vendor_name": vendor["name"],
        "vendor_phone": vendor.get("phone"),
        "zone": vendor.get("zone"),
        "customer_name": payload.customer_name.strip(),
        "customer_phone": payload.customer_phone.strip(),
        "customer_note": payload.customer_note,
        "items": order_items,
        "subtotal": subtotal,
        "delivery_fee": 0,
        "discount": 0,
        "total": total,
        "payment_method": payload.payment_method,
        "payment_status": "pending",
        "order_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.orders.insert_one(order_doc)

    # Decrement stock atomically
    for it in payload.items:
        await db.menus.update_one(
            {"id": it.menu_id},
            {"$inc": {"remaining_portions": -it.quantity}},
        )

    response = {
        "success": True,
        "order_id": order_id,
        "order_number": order_number,
        "total": total,
        "payment_method": payload.payment_method,
    }

    # If online → initiate CamPay collect
    if payload.payment_method == "online":
        try:
            from campay import campay_client, normalize_cm_phone
            ext_ref = f"QR-{order_id[:12]}"
            campay_resp = await campay_client.initiate_payment(
                amount=int(total),
                phone=normalize_cm_phone(payload.customer_phone),
                external_reference=ext_ref,
                description=f"HEMELEY QR {order_number}",
            )
            await db.orders.update_one(
                {"id": order_id},
                {"$set": {
                    "campay_reference": campay_resp.get("reference"),
                    "campay_external_reference": ext_ref,
                    "campay_status": "PENDING",
                }},
            )
            response["campay_reference"] = campay_resp.get("reference")
            response["campay_status"] = "PENDING"
        except HTTPException as e:
            # CamPay refusé → on garde la commande mais on prévient le client
            await db.orders.update_one(
                {"id": order_id},
                {"$set": {"campay_status": "FAILED", "campay_failure_reason": e.detail}},
            )
            response["campay_error"] = e.detail

    return response
