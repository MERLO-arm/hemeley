"""Tests for /api/vendor/analytics, /export, and /vendor/profile/branding.

Covers the fresh Vendor Analytics module (Menu Engineering, PDF export, branding).
"""
import os
import pytest
import requests
from datetime import datetime

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback pour éviter crash si var frontend absente côté backend
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL"):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                break

VENDOR_EMAIL = "vendeur@hemeley.com"
VENDOR_PASSWORD = "hemeley2024"
CUSTOMER_PHONE = "690000001"
CUSTOMER_PASSWORD = "hemeley2024"


# ==================== FIXTURES ====================

@pytest.fixture(scope="session")
def vendor_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": VENDOR_EMAIL, "password": VENDOR_PASSWORD}, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Vendor login failed: {r.status_code} {r.text}")
    return r.json()["token"]


@pytest.fixture(scope="session")
def customer_token():
    r = requests.post(f"{BASE_URL}/api/customer/login",
                      json={"phone": CUSTOMER_PHONE, "password": CUSTOMER_PASSWORD}, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Customer login failed: {r.status_code} {r.text}")
    return r.json()["token"]


@pytest.fixture
def vh(vendor_token):
    return {"Authorization": f"Bearer {vendor_token}"}


# ==================== ANALYTICS GET ====================

REQUIRED_KEYS = [
    "vendor", "period", "categories_available", "revenue", "orders", "timeline",
    "top_sold", "bottom_sold", "top_drinks", "category_breakdown",
    "menu_engineering", "heatmap", "best_day", "best_hour", "avg_prep_min",
    "customers", "reviews", "wallet", "alerts", "commission_rate",
]


class TestAnalyticsSchema:
    def test_7d_returns_all_keys(self, vh):
        r = requests.get(f"{BASE_URL}/api/vendor/analytics?period=7d", headers=vh, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        missing = [k for k in REQUIRED_KEYS if k not in data]
        assert not missing, f"Missing keys: {missing}"

        # Revenue substructure
        for k in ("gross", "net", "change_pct", "prev_gross"):
            assert k in data["revenue"], f"revenue.{k} missing"
        # Orders substructure
        for k in ("count", "avg_basket", "conversion_rate", "change_pct"):
            assert k in data["orders"], f"orders.{k} missing"
        # Heatmap 7x24
        assert isinstance(data["heatmap"], list) and len(data["heatmap"]) == 7
        assert all(isinstance(row, list) and len(row) == 24 for row in data["heatmap"])
        # Commission rate is a positive float
        assert isinstance(data["commission_rate"], (int, float)) and data["commission_rate"] >= 0

    def test_today_period(self, vh):
        r = requests.get(f"{BASE_URL}/api/vendor/analytics?period=today", headers=vh, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["period"]["type"] == "today"
        # start should be today 00:00
        start = datetime.fromisoformat(data["period"]["start"])
        assert start.hour == 0 and start.minute == 0

    def test_custom_period_valid(self, vh):
        r = requests.get(
            f"{BASE_URL}/api/vendor/analytics?period=custom&start=2026-01-01&end=2026-02-01",
            headers=vh, timeout=30,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["period"]["type"] == "custom"
        assert data["period"]["start"].startswith("2026-01-01")
        assert data["period"]["end"].startswith("2026-02-01")

    def test_custom_period_missing_dates_400(self, vh):
        r = requests.get(f"{BASE_URL}/api/vendor/analytics?period=custom", headers=vh, timeout=15)
        assert r.status_code == 400, r.text

    def test_category_filter(self, vh):
        r = requests.get(f"{BASE_URL}/api/vendor/analytics?category=boisson", headers=vh, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["category_selected"] == "boisson"


class TestAnalyticsAuth:
    def test_no_token_returns_401(self):
        r = requests.get(f"{BASE_URL}/api/vendor/analytics?period=7d", timeout=15)
        assert r.status_code == 401, r.text

    def test_customer_token_returns_403(self, customer_token):
        r = requests.get(
            f"{BASE_URL}/api/vendor/analytics?period=7d",
            headers={"Authorization": f"Bearer {customer_token}"}, timeout=15,
        )
        assert r.status_code == 403, r.text


# ==================== PDF EXPORT ====================

class TestPdfExport:
    def test_export_returns_pdf_binary(self, vh):
        r = requests.get(f"{BASE_URL}/api/vendor/analytics/export?period=7d",
                         headers=vh, timeout=45)
        assert r.status_code == 200, r.text[:300]
        assert r.content[:8].startswith(b"%PDF-1."), f"Not a PDF: {r.content[:20]!r}"
        cd = r.headers.get("Content-Disposition", "")
        assert "attachment" in cd.lower(), f"Bad CD: {cd}"
        assert r.headers.get("content-type", "").startswith("application/pdf")


# ==================== BRANDING PATCH ====================

class TestBranding:
    def test_patch_brand_color_persists(self, vh):
        payload = {"brand_color": "#00D9C0"}
        r = requests.patch(f"{BASE_URL}/api/vendor/profile/branding",
                           json=payload, headers=vh, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True
        assert body["vendor"]["brand_color"] == "#00D9C0"

        # Verify persistence via analytics endpoint
        a = requests.get(f"{BASE_URL}/api/vendor/analytics?period=7d",
                         headers=vh, timeout=30).json()
        assert a["vendor"]["brand_color"] == "#00D9C0"

    def test_invalid_hex_returns_400(self, vh):
        r = requests.patch(f"{BASE_URL}/api/vendor/profile/branding",
                           json={"brand_color": "NOT_HEX"}, headers=vh, timeout=15)
        assert r.status_code == 400, r.text

    def test_empty_body_returns_400(self, vh):
        r = requests.patch(f"{BASE_URL}/api/vendor/profile/branding",
                           json={}, headers=vh, timeout=15)
        assert r.status_code == 400, r.text


# ==================== MENU cost_price + MENU ENGINEERING ====================

class TestMenuEngineering:
    def test_create_menu_with_cost_price_and_quadrant(self, vh):
        # Create a menu with cost_price
        payload = {
            "name": f"TEST_Analytics_{datetime.utcnow().timestamp():.0f}",
            "description": "Test menu for analytics",
            "ingredients": "test",
            "price": 3000.0,
            "cost_price": 1200.0,
            "category": "plat",
            "zone": "Akwa",
            "total_portions": 10,
        }
        r = requests.post(f"{BASE_URL}/api/vendor/menus", json=payload, headers=vh, timeout=20)
        assert r.status_code in (200, 201), r.text
        created = r.json()
        # Some APIs wrap under {menu: ...}
        menu_obj = created.get("menu", created)
        assert menu_obj.get("cost_price") == 1200.0, f"cost_price not persisted: {created}"
        menu_id = menu_obj["id"]

        # Fetch analytics and verify item present in menu_engineering with correct margin_pct
        a = requests.get(f"{BASE_URL}/api/vendor/analytics?period=30d",
                         headers=vh, timeout=30).json()
        items = a["menu_engineering"]
        found = next((x for x in items if x["menu_id"] == menu_id), None)
        assert found is not None, "Newly created menu not in menu_engineering"
        # margin_pct = (3000 - 1200)/3000 * 100 = 60.0
        assert found["margin_pct"] == 60.0, f"Expected 60.0, got {found['margin_pct']}"
        assert found["cost_price"] == 1200.0

        # Cleanup
        requests.delete(f"{BASE_URL}/api/vendor/menus/{menu_id}", headers=vh, timeout=15)

    def test_all_menu_items_classified_in_valid_quadrant(self, vh):
        a = requests.get(f"{BASE_URL}/api/vendor/analytics?period=30d",
                         headers=vh, timeout=30).json()
        valid = {"stars", "workhorses", "puzzles", "dogs"}
        items = a["menu_engineering"]
        assert len(items) > 0, "menu_engineering empty"
        for it in items:
            assert it["quadrant"] in valid, f"Invalid quadrant: {it}"
