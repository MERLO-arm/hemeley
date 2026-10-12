"""
Test suite for HEMELEY Vendor Profile Page and related features
Tests: VendorProfilePage, clickable vendor names, /restaurant redirect, admin settings
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://hemeley-preview.preview.emergentagent.com')

# Test data
VENDOR_ID = "e8427dd9-cb7a-4ebf-baa1-c9fd4d604f2b"  # Merlo Dassi
MENU_ID = "b389cfa4-103a-4313-b529-218c5a82f97f"  # poulet DG
ADMIN_EMAIL = "admin@hemeley.com"
ADMIN_PASSWORD = "hemeley2024"


class TestVendorPublicAPI:
    """Test vendor public endpoints for VendorProfilePage"""
    
    def test_get_vendor_detail(self):
        """Test GET /api/vendors/{vendor_id} returns vendor with stats"""
        response = requests.get(f"{BASE_URL}/api/vendors/{VENDOR_ID}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Verify vendor basic info
        assert data["id"] == VENDOR_ID
        assert "name" in data
        assert "zone" in data
        assert "phone" in data
        
        # Verify stats for VendorProfilePage standing badge
        assert "completed_orders" in data, "Missing completed_orders for standing badge"
        assert "completion_rate" in data, "Missing completion_rate for standing badge"
        assert "menu_count" in data, "Missing menu_count for stats"
        assert "total_orders" in data, "Missing total_orders"
        
        # Verify rating info
        assert "rating" in data
        assert "review_count" in data
        assert "rating_breakdown" in data
        
        # Verify menus are included
        assert "menus" in data
        assert isinstance(data["menus"], list)
        
        # Verify reviews are included
        assert "reviews" in data
        assert isinstance(data["reviews"], list)
        
        print(f"✓ Vendor detail API returns all required fields for VendorProfilePage")
        print(f"  - Name: {data['name']}")
        print(f"  - Zone: {data['zone']}")
        print(f"  - Completed orders: {data['completed_orders']}")
        print(f"  - Completion rate: {data['completion_rate']}%")
        print(f"  - Menu count: {data['menu_count']}")
    
    def test_vendor_not_found(self):
        """Test GET /api/vendors/{invalid_id} returns 404"""
        response = requests.get(f"{BASE_URL}/api/vendors/invalid-vendor-id-12345")
        assert response.status_code == 404
        print("✓ Invalid vendor ID returns 404")
    
    def test_get_vendor_menus(self):
        """Test GET /api/vendors/{vendor_id}/menus returns menus"""
        response = requests.get(f"{BASE_URL}/api/vendors/{VENDOR_ID}/menus")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Vendor menus endpoint returns {len(data)} menus")
    
    def test_get_vendor_reviews(self):
        """Test GET /api/vendors/{vendor_id}/reviews returns reviews"""
        response = requests.get(f"{BASE_URL}/api/vendors/{VENDOR_ID}/reviews")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Vendor reviews endpoint returns {len(data)} reviews")


class TestMenusWithVendorInfo:
    """Test menus API returns vendor_id for clickable vendor names"""
    
    def test_menus_have_vendor_id(self):
        """Test GET /api/menus returns vendor_id for each menu"""
        response = requests.get(f"{BASE_URL}/api/menus?zone=bonapriso")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) > 0, "No menus found in bonapriso zone"
        
        for menu in data:
            assert "vendor_id" in menu, f"Menu {menu.get('name')} missing vendor_id"
            assert "vendor_name" in menu, f"Menu {menu.get('name')} missing vendor_name"
        
        print(f"✓ All {len(data)} menus have vendor_id and vendor_name for clickable links")
    
    def test_menu_detail_has_vendor_id(self):
        """Test GET /api/menus/{id} returns vendor_id"""
        response = requests.get(f"{BASE_URL}/api/menus/{MENU_ID}")
        assert response.status_code == 200
        
        data = response.json()
        assert "vendor_id" in data, "Menu detail missing vendor_id"
        assert "vendor_name" in data, "Menu detail missing vendor_name"
        
        print(f"✓ Menu detail has vendor_id: {data['vendor_id']}")
        print(f"  - Vendor name: {data['vendor_name']}")


class TestAdminLogin:
    """Test admin login and dashboard access"""
    
    def test_admin_login(self):
        """Test admin login with correct credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] in ["admin", "super_admin"]
        
        print(f"✓ Admin login successful")
        print(f"  - Role: {data['user']['role']}")
        return data["token"]
    
    def test_admin_stats(self):
        """Test admin stats endpoint"""
        # Login first
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        token = login_response.json()["token"]
        
        # Get stats
        response = requests.get(
            f"{BASE_URL}/api/admin/stats",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "total_orders" in data
        assert "total_vendors" in data
        assert "total_delivery_partners" in data
        
        print(f"✓ Admin stats endpoint working")
        print(f"  - Total orders: {data['total_orders']}")
        print(f"  - Total vendors: {data['total_vendors']}")


class TestAdminSettings:
    """Test admin settings tab functionality"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_settings(self, admin_token):
        """Test GET /api/admin/settings returns settings"""
        response = requests.get(
            f"{BASE_URL}/api/admin/settings",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "loyalty_rules" in data
        assert "time_promotions" in data
        assert "referral_bonus_new_user" in data
        assert "referral_bonus_referrer" in data
        
        print(f"✓ Admin settings endpoint returns all sections")
        print(f"  - Loyalty rules: {len(data['loyalty_rules'])}")
        print(f"  - Time promotions: {len(data['time_promotions'])}")
        print(f"  - Referral bonus (new user): {data['referral_bonus_new_user']}")
        print(f"  - Referral bonus (referrer): {data['referral_bonus_referrer']}")
    
    def test_add_loyalty_rule(self, admin_token):
        """Test adding a loyalty rule"""
        response = requests.post(
            f"{BASE_URL}/api/admin/settings/loyalty-rules",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "points_threshold": 999,
                "discount_percent": 15,
                "description": "TEST_RULE: 999 pts = 15% discount"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        rules = data.get("loyalty_rules", [])
        test_rule = next((r for r in rules if r.get("points_threshold") == 999), None)
        assert test_rule is not None, "Test loyalty rule not found after creation"
        
        print(f"✓ Loyalty rule added successfully")
        
        # Cleanup - delete the test rule
        rule_id = test_rule["id"]
        delete_response = requests.delete(
            f"{BASE_URL}/api/admin/settings/loyalty-rules/{rule_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert delete_response.status_code == 200
        print(f"✓ Test loyalty rule cleaned up")
    
    def test_add_time_promotion(self, admin_token):
        """Test adding a time promotion"""
        response = requests.post(
            f"{BASE_URL}/api/admin/settings/time-promotions",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "name": "TEST_PROMO: Test Promotion",
                "discount_percent": 20,
                "start_hour": 10,
                "end_hour": 12,
                "days_of_week": [1, 2, 3]
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        promos = data.get("time_promotions", [])
        test_promo = next((p for p in promos if "TEST_PROMO" in p.get("name", "")), None)
        assert test_promo is not None, "Test time promotion not found after creation"
        
        print(f"✓ Time promotion added successfully")
        
        # Cleanup - delete the test promotion
        promo_id = test_promo["id"]
        delete_response = requests.delete(
            f"{BASE_URL}/api/admin/settings/time-promotions/{promo_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert delete_response.status_code == 200
        print(f"✓ Test time promotion cleaned up")


class TestVendorsList:
    """Test vendors list endpoint"""
    
    def test_list_vendors(self):
        """Test GET /api/vendors returns list of vendors"""
        response = requests.get(f"{BASE_URL}/api/vendors")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        if len(data) > 0:
            vendor = data[0]
            assert "id" in vendor
            assert "name" in vendor
            assert "zone" in vendor
            assert "rating" in vendor
            assert "menu_count" in vendor
        
        print(f"✓ Vendors list returns {len(data)} vendors")
    
    def test_list_vendors_by_zone(self):
        """Test GET /api/vendors?zone=bonapriso filters by zone"""
        response = requests.get(f"{BASE_URL}/api/vendors?zone=bonapriso")
        assert response.status_code == 200
        
        data = response.json()
        for vendor in data:
            assert vendor["zone"] == "bonapriso", f"Vendor {vendor['name']} has wrong zone"
        
        print(f"✓ Vendors filtered by zone correctly ({len(data)} in bonapriso)")


class TestHealthCheck:
    """Basic health check"""
    
    def test_api_health(self):
        """Test API is responding"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        print("✓ API health check passed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
