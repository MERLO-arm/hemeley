"""Vendor Analytics — endpoint agrégé pour le dashboard vendeur nouvelle génération.

GET  /api/vendor/analytics?period=today|7d|30d|month|custom&start=&end=&category=all|plat|...
GET  /api/vendor/analytics/export?...  → PDF binaire

Retourne TOUT ce dont l'UI a besoin (aucune agrégation côté client).
"""
from fastapi import APIRouter, Request, HTTPException, Query
from fastapi.responses import Response
from datetime import datetime, timezone, timedelta
from collections import defaultdict
from typing import Optional
import io
import os
import base64
import logging

logger = logging.getLogger(__name__)

vendor_analytics_router = APIRouter()

COMMISSION_RATE = float(os.environ.get("HEMELEY_COMMISSION_RATE", "0.10"))


# ==================== HELPERS ====================

def _get_vendor_from_request(request: Request):
    """Extrait le vendor depuis le Bearer token (JWT vendor)."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Auth requise")
    from auth import decode_token
    try:
        payload = decode_token(auth.split(" ", 1)[1])
    except Exception:
        raise HTTPException(status_code=401, detail="Token invalide")
    if payload.get("role") != "vendor":
        raise HTTPException(status_code=403, detail="Accès vendeur uniquement")
    return payload.get("user_id") or payload.get("sub")


def _parse_period(period: str, start: Optional[str], end: Optional[str]):
    """Retourne (period_start, period_end, prev_start, prev_end) en datetimes UTC."""
    now = datetime.now(timezone.utc)
    today0 = now.replace(hour=0, minute=0, second=0, microsecond=0)

    if period == "today":
        p_start, p_end = today0, now
    elif period == "7d":
        p_start = today0 - timedelta(days=6)
        p_end = now
    elif period == "30d":
        p_start = today0 - timedelta(days=29)
        p_end = now
    elif period == "month":
        p_start = today0.replace(day=1)
        p_end = now
    elif period == "custom":
        if not start or not end:
            raise HTTPException(status_code=400, detail="start & end requis en mode custom")
        try:
            p_start = datetime.fromisoformat(start).replace(tzinfo=timezone.utc)
            p_end = datetime.fromisoformat(end).replace(tzinfo=timezone.utc)
        except ValueError:
            raise HTTPException(status_code=400, detail="start/end doivent être ISO8601")
    else:
        raise HTTPException(status_code=400, detail=f"period invalide: {period}")

    span = p_end - p_start
    prev_end = p_start
    prev_start = p_start - span
    return p_start, p_end, prev_start, prev_end


def _pct_change(current: float, previous: float) -> float:
    if previous == 0:
        return 0.0 if current == 0 else 100.0
    return round(((current - previous) / previous) * 100, 1)


async def _fetch_scoped_orders(db, vendor_id: str, start_dt: datetime, end_dt: datetime, category: str):
    """Récupère les commandes du vendor dans la fenêtre, filtrées par catégorie (au niveau item)."""
    cursor = db.orders.find({
        "vendor_id": vendor_id,
        "created_at": {"$gte": start_dt.isoformat(), "$lte": end_dt.isoformat()},
    }, {"_id": 0})
    orders = await cursor.to_list(length=5000)

    if category and category != "all":
        # Filtre au niveau des items : garde uniquement les items de la bonne catégorie
        filtered = []
        for o in orders:
            kept_items = [
                it for it in (o.get("items") or [])
                if (it.get("category") or "plat") == category
            ]
            if kept_items:
                o = {**o}
                o["items"] = kept_items
                # Recalcule subtotal filtré
                sub = sum(float(it.get("subtotal") or 0) for it in kept_items)
                o["_filtered_subtotal"] = sub
                filtered.append(o)
        return filtered
    else:
        for o in orders:
            o["_filtered_subtotal"] = float(o.get("subtotal") or 0)
        return orders


# ==================== MAIN ENDPOINT ====================

@vendor_analytics_router.get("/vendor/analytics")
async def vendor_analytics(
    request: Request,
    period: str = Query("7d"),
    start: Optional[str] = None,
    end: Optional[str] = None,
    category: str = Query("all"),
):
    vendor_id = _get_vendor_from_request(request)
    db = request.app.state.db

    vendor = await db.vendors.find_one({"id": vendor_id}, {"_id": 0, "password_hash": 0})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor non trouvé")

    p_start, p_end, prev_start, prev_end = _parse_period(period, start, end)

    orders = await _fetch_scoped_orders(db, vendor_id, p_start, p_end, category)
    prev_orders = await _fetch_scoped_orders(db, vendor_id, prev_start, prev_end, category)

    # Catégories dispo pour le vendor (utilisées comme options du filtre côté UI)
    categories = await db.menus.distinct("category", {"vendor_id": vendor_id})

    # Tous les menus (référentiel produit)
    all_menus = await db.menus.find({"vendor_id": vendor_id}, {"_id": 0, "image_base64": 0}).to_list(500)
    menu_by_id = {m["id"]: m for m in all_menus}

    # ========== A. REVENUS ==========
    revenue_gross = sum(float(o.get("total") or 0) for o in orders)
    revenue_net = round(revenue_gross * (1 - COMMISSION_RATE), 0)
    prev_gross = sum(float(o.get("total") or 0) for o in prev_orders)

    order_count = len(orders)
    prev_order_count = len(prev_orders)
    avg_basket = round(revenue_gross / order_count, 0) if order_count else 0
    delivered = sum(1 for o in orders if o.get("order_status") == "delivered")
    conversion_rate = round(delivered / order_count * 100, 1) if order_count else 0.0

    # Série temporelle jour par jour (revenu, nb commandes)
    days_span = max(1, int((p_end - p_start).total_seconds() // 86400) + 1)
    days_span = min(days_span, 90)  # cap
    day_labels, day_rev, day_ord = [], [], []
    for i in range(days_span):
        day_start = (p_start + timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        day_orders = [o for o in orders if day_start.isoformat() <= o.get("created_at", "") < day_end.isoformat()]
        day_labels.append(day_start.strftime("%d/%m"))
        day_rev.append(round(sum(float(o.get("total") or 0) for o in day_orders), 0))
        day_ord.append(len(day_orders))

    # ========== B. PRODUITS ==========
    # Comptage items vendus par menu_id
    item_stats = defaultdict(lambda: {"qty": 0, "revenue": 0.0, "name": "", "category": "plat"})
    for o in orders:
        for it in (o.get("items") or []):
            mid = it.get("menu_id")
            if not mid:
                continue
            item_stats[mid]["qty"] += int(it.get("quantity") or 0)
            item_stats[mid]["revenue"] += float(it.get("subtotal") or 0)
            item_stats[mid]["name"] = it.get("menu_name") or item_stats[mid]["name"]
            item_stats[mid]["category"] = it.get("category") or item_stats[mid]["category"]

    sorted_items = sorted(item_stats.items(), key=lambda x: x[1]["qty"], reverse=True)
    top_sold = [
        {"menu_id": mid, "name": s["name"], "qty": s["qty"], "revenue": round(s["revenue"], 0),
         "category": s["category"]}
        for mid, s in sorted_items[:5]
    ]
    bottom_sold = [
        {"menu_id": mid, "name": s["name"], "qty": s["qty"], "revenue": round(s["revenue"], 0),
         "category": s["category"]}
        for mid, s in sorted(sorted_items, key=lambda x: x[1]["qty"])[:5] if s["qty"] > 0
    ]

    # Boissons top 5 (séparé)
    drinks = [d for d in sorted_items if d[1]["category"] == "boisson"][:5]
    top_drinks = [
        {"menu_id": mid, "name": s["name"], "qty": s["qty"], "revenue": round(s["revenue"], 0)}
        for mid, s in drinks
    ]

    # Menu Engineering matrix : popularité (qty vendue) vs marge unitaire
    # Marge = (price - cost_price) / price ; défaut 40% si cost_price manquant
    total_qty_sold = sum(s["qty"] for _, s in item_stats.items())
    avg_qty = total_qty_sold / len(all_menus) if all_menus else 1
    matrix = []
    for m in all_menus:
        mid = m["id"]
        s = item_stats.get(mid, {"qty": 0, "revenue": 0.0})
        price = float(m.get("price") or 0)
        cost = m.get("cost_price")
        if cost is not None and price > 0:
            margin_pct = round((price - float(cost)) / price * 100, 1)
        else:
            margin_pct = None  # inconnue
        margin_ref = margin_pct if margin_pct is not None else 40.0
        qty = s["qty"]
        # Quadrant
        pop_high = qty >= avg_qty
        marge_high = margin_ref >= 40.0
        if pop_high and marge_high:
            quadrant = "stars"          # Étoiles
        elif pop_high and not marge_high:
            quadrant = "workhorses"     # Chevaux de trait
        elif not pop_high and marge_high:
            quadrant = "puzzles"        # Énigmes
        else:
            quadrant = "dogs"           # Poids morts
        matrix.append({
            "menu_id": mid,
            "name": m.get("name"),
            "category": m.get("category", "plat"),
            "price": price,
            "cost_price": cost,
            "margin_pct": margin_pct,
            "qty": qty,
            "revenue": round(s["revenue"], 0),
            "quadrant": quadrant,
        })

    # Catégorie → revenu (donut)
    cat_stats = defaultdict(float)
    for _, s in item_stats.items():
        cat_stats[s["category"]] += s["revenue"]
    category_breakdown = [{"category": c, "revenue": round(v, 0)} for c, v in sorted(cat_stats.items(), key=lambda x: -x[1])]

    # ========== C. TEMPOREL ==========
    # Heatmap 7 jours × 24h (indexé 0=lundi)
    heatmap = [[0] * 24 for _ in range(7)]
    for o in orders:
        try:
            dt = datetime.fromisoformat(o["created_at"].replace("Z", "+00:00"))
        except Exception:
            continue
        day = dt.weekday()   # 0=lundi
        hr = dt.hour
        heatmap[day][hr] += 1

    # Meilleur jour (%delta vs moyenne)
    day_totals = [sum(row) for row in heatmap]
    total_orders_all = sum(day_totals) or 1
    avg_per_day = total_orders_all / 7
    day_names = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]
    if max(day_totals) > 0:
        best_day_idx = day_totals.index(max(day_totals))
        best_day = {
            "name": day_names[best_day_idx],
            "orders": day_totals[best_day_idx],
            "pct_vs_avg": round((day_totals[best_day_idx] / avg_per_day - 1) * 100, 0),
        }
    else:
        best_day = None

    # Heure de pointe
    hour_totals = [sum(heatmap[d][h] for d in range(7)) for h in range(24)]
    if max(hour_totals) > 0:
        peak_hour = hour_totals.index(max(hour_totals))
        peak_hour_orders = hour_totals[peak_hour]
        peak_hour_pct = round(peak_hour_orders / total_orders_all * 100, 0)
        best_hour = {
            "hour_start": peak_hour,
            "hour_end": (peak_hour + 2) % 24,
            "share_pct": peak_hour_pct,
            "orders": peak_hour_orders,
        }
    else:
        best_hour = None

    # Temps moyen de préparation (created_at → status delivered)
    prep_times = []
    for o in orders:
        if o.get("order_status") == "delivered":
            try:
                ct = datetime.fromisoformat(o["created_at"].replace("Z", "+00:00"))
                dt = o.get("delivered_at") or o.get("updated_at")
                if dt:
                    dt_obj = datetime.fromisoformat(dt.replace("Z", "+00:00"))
                    prep_times.append((dt_obj - ct).total_seconds() / 60.0)
            except Exception:
                continue
    avg_prep_min = round(sum(prep_times) / len(prep_times), 0) if prep_times else None

    # ========== D. CLIENT / FIDÉLITÉ ==========
    # Ratio nouveaux vs récurrents dans la fenêtre
    cust_orders = defaultdict(int)
    for o in orders:
        pid = o.get("customer_id") or o.get("customer_phone")
        if pid:
            cust_orders[pid] += 1
    total_cust = len(cust_orders)
    returning = sum(1 for v in cust_orders.values() if v > 1)
    new_c = total_cust - returning
    avg_orders_per_cust = round(sum(cust_orders.values()) / total_cust, 1) if total_cust else 0

    # Barres empilées par semaine (nouveau vs récurrent) — sur 4 dernières semaines
    weekly = []
    now = datetime.now(timezone.utc)
    for w in range(4):
        w_start = (now - timedelta(days=7 * (w + 1))).replace(hour=0, minute=0, second=0, microsecond=0)
        w_end = (now - timedelta(days=7 * w))
        w_orders = [o for o in orders if w_start.isoformat() <= o.get("created_at", "") < w_end.isoformat()]
        # Un client est "nouveau" s'il n'a pas de commande AVANT w_start (approximation locale)
        prior_ids = {o.get("customer_id") or o.get("customer_phone") for o in orders
                     if o.get("created_at", "") < w_start.isoformat()}
        w_cust = {o.get("customer_id") or o.get("customer_phone") for o in w_orders}
        w_new = len(w_cust - prior_ids)
        w_ret = len(w_cust & prior_ids)
        weekly.append({
            "label": w_start.strftime("Sem %d/%m"),
            "new": w_new,
            "returning": w_ret,
        })
    weekly.reverse()

    # Note moyenne + tendance (comparé à la période précédente)
    reviews_curr = await db.reviews.find({
        "vendor_id": vendor_id,
        "created_at": {"$gte": p_start.isoformat(), "$lte": p_end.isoformat()},
    }, {"_id": 0}).to_list(500)
    reviews_prev = await db.reviews.find({
        "vendor_id": vendor_id,
        "created_at": {"$gte": prev_start.isoformat(), "$lte": prev_end.isoformat()},
    }, {"_id": 0}).to_list(500)
    avg_rating_curr = round(sum(r.get("rating", 0) for r in reviews_curr) / len(reviews_curr), 2) if reviews_curr else None
    avg_rating_prev = round(sum(r.get("rating", 0) for r in reviews_prev) / len(reviews_prev), 2) if reviews_prev else None
    rating_delta = round((avg_rating_curr - avg_rating_prev), 2) if avg_rating_curr and avg_rating_prev else None

    # ========== E. TRÉSORERIE ==========
    wallet = await db.wallets.find_one({"user_id": vendor_id, "role": "vendor"}, {"_id": 0})
    wallet_balance = float(wallet.get("balance") or 0) if wallet else 0.0
    wallet_currency = wallet.get("currency", "XAF") if wallet else "XAF"

    withdrawals = await db.withdrawal_requests.find(
        {"user_id": vendor_id, "role": "vendor"}, {"_id": 0}
    ).sort("created_at", -1).limit(5).to_list(5)

    # Projection 7j = moyenne glissante sur days_span jours × 7
    days_with_activity = max(1, sum(1 for r in day_rev if r > 0))
    daily_avg = revenue_gross / days_with_activity if days_with_activity else 0
    projection_7d = round(daily_avg * 7 * (1 - COMMISSION_RATE), 0)

    # ========== F. ALERTES AUTOMATIQUES ==========
    alerts = []
    # Alerte 1 : CA en baisse > 15%
    delta_ca = _pct_change(revenue_gross, prev_gross)
    if delta_ca <= -15 and prev_gross > 0:
        alerts.append({
            "severity": "warning",
            "title": "Baisse de CA détectée",
            "message": f"Votre CA a baissé de {abs(delta_ca)}% cette période vs précédente.",
        })
    # Alerte 2 : plat non commandé depuis 14 jours
    two_weeks_ago = (now - timedelta(days=14)).isoformat()
    inactive_menus = []
    for m in all_menus:
        if not m.get("is_active"):
            continue
        # Cherche la dernière commande contenant ce menu
        last = await db.orders.find_one(
            {"vendor_id": vendor_id, "items.menu_id": m["id"]},
            sort=[("created_at", -1)],
            projection={"_id": 0, "created_at": 1},
        )
        if not last or last.get("created_at", "") < two_weeks_ago:
            inactive_menus.append(m.get("name"))
        if len(inactive_menus) >= 3:
            break
    if inactive_menus:
        alerts.append({
            "severity": "info",
            "title": "Plats en sommeil",
            "message": f"{', '.join(inactive_menus)} n'ont pas été commandés depuis 14 jours.",
        })
    # Alerte 3 : annulations en hausse
    cancelled_curr = sum(1 for o in orders if o.get("order_status") == "cancelled")
    cancelled_prev = sum(1 for o in prev_orders if o.get("order_status") == "cancelled")
    if prev_order_count > 0 and cancelled_prev > 0:
        cancel_rate_curr = cancelled_curr / order_count if order_count else 0
        cancel_rate_prev = cancelled_prev / prev_order_count
        if cancel_rate_curr > cancel_rate_prev * 1.5 and cancelled_curr >= 3:
            alerts.append({
                "severity": "danger",
                "title": "Annulations en hausse",
                "message": f"Vos annulations ont augmenté de {round((cancel_rate_curr/cancel_rate_prev-1)*100,0)}% sur cette période.",
            })
    alerts = alerts[:3]

    return {
        "vendor": {
            "id": vendor.get("id"),
            "name": vendor.get("name"),
            "logo_base64": vendor.get("logo_base64"),
            "brand_color": vendor.get("brand_color"),
        },
        "period": {
            "type": period,
            "start": p_start.isoformat(),
            "end": p_end.isoformat(),
            "prev_start": prev_start.isoformat(),
            "prev_end": prev_end.isoformat(),
        },
        "categories_available": ["all"] + sorted([c for c in categories if c]),
        "category_selected": category,
        "commission_rate": COMMISSION_RATE,

        "revenue": {
            "gross": round(revenue_gross, 0),
            "net": revenue_net,
            "change_pct": _pct_change(revenue_gross, prev_gross),
            "prev_gross": round(prev_gross, 0),
        },
        "orders": {
            "count": order_count,
            "prev_count": prev_order_count,
            "change_pct": _pct_change(order_count, prev_order_count),
            "avg_basket": avg_basket,
            "conversion_rate": conversion_rate,
        },
        "timeline": {"labels": day_labels, "revenue": day_rev, "orders": day_ord},

        "top_sold": top_sold,
        "bottom_sold": bottom_sold,
        "top_drinks": top_drinks,
        "category_breakdown": category_breakdown,
        "menu_engineering": matrix,

        "heatmap": heatmap,
        "best_day": best_day,
        "best_hour": best_hour,
        "avg_prep_min": avg_prep_min,

        "customers": {
            "total": total_cust,
            "new": new_c,
            "returning": returning,
            "avg_orders_per_customer": avg_orders_per_cust,
            "weekly": weekly,
        },
        "reviews": {
            "avg_rating": avg_rating_curr,
            "count": len(reviews_curr),
            "trend": rating_delta,
        },
        "wallet": {
            "balance": wallet_balance,
            "currency": wallet_currency,
            "recent_withdrawals": withdrawals,
            "projection_7d_net": projection_7d,
        },
        "alerts": alerts,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ==================== PDF EXPORT ====================

@vendor_analytics_router.get("/vendor/analytics/export")
async def vendor_analytics_pdf(
    request: Request,
    period: str = Query("7d"),
    start: Optional[str] = None,
    end: Optional[str] = None,
    category: str = Query("all"),
):
    """Rapport PDF du vendor pour la période et catégorie sélectionnées."""
    # Récupère les données via la même logique
    data = await vendor_analytics(request, period=period, start=start, end=end, category=category)

    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import cm
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.colors import HexColor, black, white
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
        from reportlab.lib.enums import TA_CENTER, TA_LEFT
    except ImportError:
        raise HTTPException(status_code=500, detail="reportlab non installé")

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=1.5 * cm, bottomMargin=1.5 * cm,
                            leftMargin=1.5 * cm, rightMargin=1.5 * cm)
    styles = getSampleStyleSheet()
    brand = data["vendor"].get("brand_color") or "#FF6B00"
    brand_col = HexColor(brand)

    title_style = ParagraphStyle(
        "TitleH", parent=styles["Title"], fontSize=22, textColor=brand_col, alignment=TA_LEFT,
        spaceAfter=6,
    )
    subtitle = ParagraphStyle(
        "Sub", parent=styles["Normal"], fontSize=10, textColor=HexColor("#6B7280"), alignment=TA_LEFT
    )
    h2 = ParagraphStyle(
        "H2", parent=styles["Heading2"], fontSize=13, textColor=black, spaceBefore=12, spaceAfter=6
    )

    elements = []

    # Header : logo + nom
    logo_b64 = data["vendor"].get("logo_base64")
    header_left_cells = []
    if logo_b64:
        try:
            raw = logo_b64.split(",", 1)[-1]  # strip data URL prefix
            img_data = base64.b64decode(raw)
            img = Image(io.BytesIO(img_data), width=2.2 * cm, height=2.2 * cm)
            header_left_cells.append(img)
        except Exception:
            pass

    elements.append(Paragraph(f"<b>{data['vendor']['name']}</b>", title_style))
    elements.append(Paragraph(
        f"Rapport analytique — Période : {data['period']['start'][:10]} → {data['period']['end'][:10]} — "
        f"Catégorie : {data['category_selected']} — Généré le {data['generated_at'][:10]}",
        subtitle,
    ))
    elements.append(Spacer(1, 0.4 * cm))

    # KPIs principaux
    elements.append(Paragraph("Ventes", h2))
    kpi_data = [
        ["Indicateur", "Valeur", "Évolution"],
        ["CA brut", f"{int(data['revenue']['gross']):,} FCFA".replace(",", " "),
         f"{data['revenue']['change_pct']:+.1f}%"],
        ["CA net (après commission)", f"{int(data['revenue']['net']):,} FCFA".replace(",", " "), "—"],
        ["Nombre de commandes", str(data['orders']['count']),
         f"{data['orders']['change_pct']:+.1f}%"],
        ["Panier moyen", f"{int(data['orders']['avg_basket']):,} FCFA".replace(",", " "), "—"],
        ["Taux de conversion", f"{data['orders']['conversion_rate']:.1f}%", "—"],
    ]
    kpi_table = Table(kpi_data, colWidths=[6 * cm, 5 * cm, 3 * cm])
    kpi_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), brand_col),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#E5E7EB")),
        ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(kpi_table)

    # Top 5
    elements.append(Paragraph("Top 5 des plats vendus", h2))
    top_rows = [["Rang", "Plat", "Catégorie", "Qté", "CA (FCFA)"]]
    for i, it in enumerate(data["top_sold"], start=1):
        top_rows.append([str(i), it["name"], it["category"], str(it["qty"]),
                         f"{int(it['revenue']):,}".replace(",", " ")])
    if len(top_rows) == 1:
        top_rows.append(["—", "Pas encore de ventes sur cette période", "—", "—", "—"])
    top_table = Table(top_rows, colWidths=[1.2 * cm, 6.5 * cm, 2.8 * cm, 1.7 * cm, 3 * cm])
    top_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HexColor("#111827")),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#E5E7EB")),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, HexColor("#F9FAFB")]),
    ]))
    elements.append(top_table)

    # Alertes
    if data["alerts"]:
        elements.append(Paragraph("Alertes", h2))
        for a in data["alerts"]:
            elements.append(Paragraph(f"<b>{a['title']}</b> — {a['message']}", styles["Normal"]))
            elements.append(Spacer(1, 0.15 * cm))

    # Meilleur jour / heure
    if data["best_day"] or data["best_hour"]:
        elements.append(Paragraph("Temporel", h2))
        if data["best_day"]:
            elements.append(Paragraph(
                f"Meilleur jour : <b>{data['best_day']['name']}</b> "
                f"({data['best_day']['orders']} commandes, {data['best_day']['pct_vs_avg']:+.0f}% vs moyenne)",
                styles["Normal"]))
        if data["best_hour"]:
            elements.append(Paragraph(
                f"Heure de pointe : <b>{data['best_hour']['hour_start']:02d}h-{data['best_hour']['hour_end']:02d}h</b> "
                f"({data['best_hour']['share_pct']:.0f}% des commandes)",
                styles["Normal"]))

    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()

    filename = f"HEMELEY_{data['vendor']['name'].replace(' ', '_')}_{data['period']['start'][:10]}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ==================== VENDOR PROFILE (logo + brand) ====================

from pydantic import BaseModel


@vendor_analytics_router.get("/vendor/me")
async def get_vendor_me(request: Request):
    """Retourne le vendor connecté (sans password) — utile pour rafraîchir custom_categories."""
    vendor_id = _get_vendor_from_request(request)
    db = request.app.state.db
    vendor = await db.vendors.find_one({"id": vendor_id}, {"_id": 0, "password_hash": 0})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor non trouvé")
    return vendor


class VendorProfileUpdate(BaseModel):
    logo_base64: Optional[str] = None
    brand_color: Optional[str] = None
    cover_photos: Optional[list] = None      # remplace la liste complète (jusqu'à 3)
    custom_categories: Optional[list] = None  # remplace la liste complète


BASE_CATEGORIES = {"entree", "plat", "boisson", "dessert", "petit-dejeuner", "snack", "autre"}
MAX_COVER_PHOTOS = 3
MAX_COVER_BYTES = 5_500_000  # ~4 Mo décodé après base64 overhead


@vendor_analytics_router.patch("/vendor/profile/branding")
async def update_vendor_branding(payload: VendorProfileUpdate, request: Request):
    """Met à jour logo + brand_color + cover_photos + custom_categories (atomique)."""
    vendor_id = _get_vendor_from_request(request)
    db = request.app.state.db

    updates = {}

    if payload.logo_base64 is not None:
        if len(payload.logo_base64) > 3_500_000:
            raise HTTPException(status_code=413, detail="Logo trop lourd (max 2 Mo)")
        if payload.logo_base64 and not payload.logo_base64.startswith("data:image"):
            raise HTTPException(status_code=400, detail="Format logo invalide (data URL attendu)")
        updates["logo_base64"] = payload.logo_base64 or None

    if payload.brand_color is not None:
        if payload.brand_color and not payload.brand_color.startswith("#"):
            raise HTTPException(status_code=400, detail="brand_color doit être un hex (#RRGGBB)")
        updates["brand_color"] = payload.brand_color or None

    if payload.cover_photos is not None:
        if not isinstance(payload.cover_photos, list):
            raise HTTPException(status_code=400, detail="cover_photos doit être une liste")
        if len(payload.cover_photos) > MAX_COVER_PHOTOS:
            raise HTTPException(status_code=400, detail=f"Maximum {MAX_COVER_PHOTOS} photos de couverture")
        cleaned = []
        for i, ph in enumerate(payload.cover_photos):
            if not isinstance(ph, str) or not ph.startswith("data:image"):
                raise HTTPException(status_code=400, detail=f"Photo #{i+1}: format invalide (data URL attendu)")
            if len(ph) > MAX_COVER_BYTES:
                raise HTTPException(status_code=413, detail=f"Photo #{i+1}: trop lourde (max 4 Mo)")
            cleaned.append(ph)
        updates["cover_photos"] = cleaned

    if payload.custom_categories is not None:
        if not isinstance(payload.custom_categories, list):
            raise HTTPException(status_code=400, detail="custom_categories doit être une liste")
        # Normalise: strip, lowercase-key mais garde le libellé d'origine, unique
        seen = set()
        cleaned = []
        for c in payload.custom_categories:
            if not isinstance(c, str):
                continue
            label = c.strip()
            if not label:
                continue
            if len(label) > 40:
                raise HTTPException(status_code=400, detail=f"Catégorie trop longue: '{label[:40]}...'")
            key = label.lower()
            if key in {b.lower() for b in BASE_CATEGORIES}:
                raise HTTPException(status_code=400, detail=f"'{label}' est déjà une catégorie de base")
            if key in seen:
                continue
            seen.add(key)
            cleaned.append(label)
        if len(cleaned) > 12:
            raise HTTPException(status_code=400, detail="Max 12 catégories personnalisées")
        updates["custom_categories"] = cleaned

    if not updates:
        raise HTTPException(status_code=400, detail="Rien à mettre à jour")

    result = await db.vendors.update_one({"id": vendor_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Vendor non trouvé")

    vendor = await db.vendors.find_one({"id": vendor_id}, {"_id": 0, "password_hash": 0})
    return {"success": True, "vendor": vendor}
