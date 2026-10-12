"""
HEMELEY Admin & Customer API Tests
Tests for:
- Admin login and dashboard
- Admin settings (loyalty rules, time promotions, referral settings)
- Customer login and profile management
- Customer settings (notifications, language)
"""

import pytest
import requests
import os
import hashlib

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from test_credentials.md
ADMIN_EMAIL = "admin@hemeley.com"
ADMIN_PASSWORD = "hemeley2024"
CUSTOMER_PHONE = "690000001"
CUSTOMER_PASSWORD = "hemeley2024"


class TestHealthCheck:
    """Basic health check"""
    
    def test_api_health(self):
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ API health check passed")


class TestAdminAuth:
    """Admin authentication tests"""
    
    def test_admin_login_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
            "role": "admin"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert "user" in data, "No user in response"
        assert data["user"]["email"] == ADMIN_EMAIL
        print(f"✓ Admin login successful, role: {data['user'].get('role')}")
        return data["token"]
    
    def test_admin_login_invalid_credentials(self):
        """Test admin login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@email.com",
            "password": "wrongpassword",
            "role": "admin"
        })
        assert response.status_code == 401
        print("✓ Admin login correctly rejects invalid credentials")


class TestAdminDashboard:
    """Admin dashboard API tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
            "role": "admin"
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Admin authentication failed")
    
    def test_get_admin_stats(self, admin_token):
        """Test admin stats endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/stats", headers=headers)
        assert response.status_code == 200, f"Failed to get stats: {response.text}"
        data = response.json()
        assert "total_orders" in data
        assert "total_vendors" in data
        assert "total_revenue" in data
        print(f"✓ Admin stats: {data['total_orders']} orders, {data['total_vendors']} vendors")
    
    def test_get_vendors_list(self, admin_token):
        """Test vendors list endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/vendors", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Vendors list: {len(data)} vendors")
    
    def test_get_delivery_partners(self, admin_token):
        """Test delivery partners list endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/delivery-partners", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Delivery partners list: {len(data)} partners")
    
    def test_get_orders_list(self, admin_token):
        """Test orders list endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/orders", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Orders list: {len(data)} orders")
    
    def test_get_customers_list(self, admin_token):
        """Test customers list endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/customers", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Customers list: {len(data)} customers")


class TestAdminSettings:
    """Admin platform settings tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
            "role": "admin"
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Admin authentication failed")
    
    def test_get_platform_settings(self, admin_token):
        """Test getting platform settings"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/settings", headers=headers)
        assert response.status_code == 200, f"Failed to get settings: {response.text}"
        data = response.json()
        assert "loyalty_rules" in data
        assert "time_promotions" in data
        assert "referral_bonus_new_user" in data
        assert "referral_bonus_referrer" in data
        print(f"✓ Platform settings: {len(data.get('loyalty_rules', []))} loyalty rules, {len(data.get('time_promotions', []))} time promotions")
        return data
    
    def test_add_loyalty_rule(self, admin_token):
        """Test adding a loyalty rule"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        rule_data = {
            "points_threshold": 5000,
            "discount_percent": 5,
            "description": "TEST_5000 points = 5% discount"
        }
        response = requests.post(f"{BASE_URL}/api/admin/settings/loyalty-rules", 
                                json=rule_data, headers=headers)
        assert response.status_code == 200, f"Failed to add loyalty rule: {response.text}"
        data = response.json()
        
        # Verify rule was added
        rules = data.get("loyalty_rules", [])
        test_rule = next((r for r in rules if r.get("points_threshold") == 5000 and "TEST_" in r.get("description", "")), None)
        assert test_rule is not None, "Test rule not found in response"
        print(f"✓ Loyalty rule added: {test_rule['points_threshold']} pts → {test_rule['discount_percent']}%")
        return test_rule["id"]
    
    def test_toggle_loyalty_rule(self, admin_token):
        """Test toggling a loyalty rule"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First get settings to find a rule
        settings_response = requests.get(f"{BASE_URL}/api/admin/settings", headers=headers)
        settings = settings_response.json()
        rules = settings.get("loyalty_rules", [])
        
        if not rules:
            pytest.skip("No loyalty rules to toggle")
        
        rule_id = rules[0]["id"]
        original_status = rules[0]["is_active"]
        
        # Toggle the rule
        response = requests.put(f"{BASE_URL}/api/admin/settings/loyalty-rules/{rule_id}/toggle", 
                               headers=headers)
        assert response.status_code == 200, f"Failed to toggle rule: {response.text}"
        
        # Verify toggle worked
        data = response.json()
        updated_rule = next((r for r in data.get("loyalty_rules", []) if r["id"] == rule_id), None)
        assert updated_rule is not None
        assert updated_rule["is_active"] != original_status
        print(f"✓ Loyalty rule toggled: {original_status} → {updated_rule['is_active']}")
    
    def test_add_time_promotion(self, admin_token):
        """Test adding a time-based promotion"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        promo_data = {
            "name": "TEST_Happy Hour",
            "discount_percent": 15,
            "start_hour": 11,
            "end_hour": 14,
            "days_of_week": [0, 1, 2, 3, 4]  # Mon-Fri
        }
        response = requests.post(f"{BASE_URL}/api/admin/settings/time-promotions", 
                                json=promo_data, headers=headers)
        assert response.status_code == 200, f"Failed to add time promotion: {response.text}"
        data = response.json()
        
        # Verify promotion was added
        promos = data.get("time_promotions", [])
        test_promo = next((p for p in promos if "TEST_" in p.get("name", "")), None)
        assert test_promo is not None, "Test promotion not found in response"
        print(f"✓ Time promotion added: {test_promo['name']} ({test_promo['start_hour']}h-{test_promo['end_hour']}h)")
        return test_promo["id"]
    
    def test_toggle_time_promotion(self, admin_token):
        """Test toggling a time promotion"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First get settings to find a promotion
        settings_response = requests.get(f"{BASE_URL}/api/admin/settings", headers=headers)
        settings = settings_response.json()
        promos = settings.get("time_promotions", [])
        
        if not promos:
            pytest.skip("No time promotions to toggle")
        
        promo_id = promos[0]["id"]
        original_status = promos[0]["is_active"]
        
        # Toggle the promotion
        response = requests.put(f"{BASE_URL}/api/admin/settings/time-promotions/{promo_id}/toggle", 
                               headers=headers)
        assert response.status_code == 200, f"Failed to toggle promotion: {response.text}"
        
        # Verify toggle worked
        data = response.json()
        updated_promo = next((p for p in data.get("time_promotions", []) if p["id"] == promo_id), None)
        assert updated_promo is not None
        assert updated_promo["is_active"] != original_status
        print(f"✓ Time promotion toggled: {original_status} → {updated_promo['is_active']}")
    
    def test_update_referral_settings(self, admin_token):
        """Test updating referral bonus settings"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Update referral bonus for new user
        response = requests.put(f"{BASE_URL}/api/admin/settings/referral", 
                               json={"referral_bonus_new_user": 75}, headers=headers)
        assert response.status_code == 200, f"Failed to update referral settings: {response.text}"
        data = response.json()
        assert data.get("referral_bonus_new_user") == 75
        print(f"✓ Referral bonus updated: new_user={data.get('referral_bonus_new_user')}")
        
        # Reset to default
        requests.put(f"{BASE_URL}/api/admin/settings/referral", 
                    json={"referral_bonus_new_user": 50}, headers=headers)


class TestCustomerAuth:
    """Customer authentication tests"""
    
    def test_customer_login_success(self):
        """Test customer login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/customer/login", json={
            "phone": CUSTOMER_PHONE,
            "password": CUSTOMER_PASSWORD
        })
        assert response.status_code == 200, f"Customer login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert "customer" in data, "No customer in response"
        assert data["customer"]["phone"] == CUSTOMER_PHONE
        print(f"✓ Customer login successful: {data['customer'].get('pseudo')}")
        return data["token"]
    
    def test_customer_login_invalid_credentials(self):
        """Test customer login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/customer/login", json={
            "phone": "999999999",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Customer login correctly rejects invalid credentials")


class TestCustomerProfile:
    """Customer profile management tests"""
    
    @pytest.fixture
    def customer_token(self):
        """Get customer auth token"""
        response = requests.post(f"{BASE_URL}/api/customer/login", json={
            "phone": CUSTOMER_PHONE,
            "password": CUSTOMER_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Customer authentication failed")
    
    def test_get_customer_profile(self, customer_token):
        """Test getting customer profile"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        response = requests.get(f"{BASE_URL}/api/customer/profile", headers=headers)
        assert response.status_code == 200, f"Failed to get profile: {response.text}"
        data = response.json()
        assert "pseudo" in data
        assert "phone" in data
        assert data["phone"] == CUSTOMER_PHONE
        print(f"✓ Customer profile: {data.get('pseudo')}, level: {data.get('loyalty_level', 'bronze')}")
        return data
    
    def test_update_customer_profile_pseudo(self, customer_token):
        """Test updating customer pseudo"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        
        # Get current profile
        profile_response = requests.get(f"{BASE_URL}/api/customer/profile", headers=headers)
        original_pseudo = profile_response.json().get("pseudo")
        
        # Update pseudo
        new_pseudo = "TestClient_Updated"
        response = requests.put(f"{BASE_URL}/api/customer/profile", 
                               json={"pseudo": new_pseudo}, headers=headers)
        assert response.status_code == 200, f"Failed to update profile: {response.text}"
        data = response.json()
        assert data.get("pseudo") == new_pseudo
        print(f"✓ Customer pseudo updated: {original_pseudo} → {new_pseudo}")
        
        # Restore original
        requests.put(f"{BASE_URL}/api/customer/profile", 
                    json={"pseudo": original_pseudo}, headers=headers)
    
    def test_update_customer_profile_email(self, customer_token):
        """Test updating customer email"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        
        # Update email
        test_email = "test_update@hemeley.com"
        response = requests.put(f"{BASE_URL}/api/customer/profile", 
                               json={"email": test_email}, headers=headers)
        assert response.status_code == 200, f"Failed to update email: {response.text}"
        data = response.json()
        assert data.get("email") == test_email
        print(f"✓ Customer email updated to: {test_email}")
    
    def test_update_customer_profile_whatsapp(self, customer_token):
        """Test updating customer whatsapp"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        
        # Update whatsapp
        test_whatsapp = "690000002"
        response = requests.put(f"{BASE_URL}/api/customer/profile", 
                               json={"whatsapp": test_whatsapp}, headers=headers)
        assert response.status_code == 200, f"Failed to update whatsapp: {response.text}"
        data = response.json()
        assert data.get("whatsapp") == test_whatsapp
        print(f"✓ Customer whatsapp updated to: {test_whatsapp}")
    
    def test_update_customer_settings_notifications(self, customer_token):
        """Test updating customer notification settings"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        
        # Update notifications setting
        response = requests.put(f"{BASE_URL}/api/customer/profile", 
                               json={"notifications_enabled": False}, headers=headers)
        assert response.status_code == 200, f"Failed to update notifications: {response.text}"
        data = response.json()
        assert data.get("notifications_enabled") == False
        print(f"✓ Customer notifications disabled")
        
        # Re-enable
        requests.put(f"{BASE_URL}/api/customer/profile", 
                    json={"notifications_enabled": True}, headers=headers)
    
    def test_update_customer_settings_language(self, customer_token):
        """Test updating customer language setting"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        
        # Update language
        response = requests.put(f"{BASE_URL}/api/customer/profile", 
                               json={"language": "en"}, headers=headers)
        assert response.status_code == 200, f"Failed to update language: {response.text}"
        data = response.json()
        assert data.get("language") == "en"
        print(f"✓ Customer language updated to: en")
        
        # Reset to French
        requests.put(f"{BASE_URL}/api/customer/profile", 
                    json={"language": "fr"}, headers=headers)


class TestCustomerOrders:
    """Customer orders tests"""
    
    @pytest.fixture
    def customer_token(self):
        """Get customer auth token"""
        response = requests.post(f"{BASE_URL}/api/customer/login", json={
            "phone": CUSTOMER_PHONE,
            "password": CUSTOMER_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Customer authentication failed")
    
    def test_get_customer_orders(self, customer_token):
        """Test getting customer orders"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        response = requests.get(f"{BASE_URL}/api/customer/orders", headers=headers)
        assert response.status_code == 200, f"Failed to get orders: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Customer orders: {len(data)} orders")
        return data
    
    def test_get_customer_active_orders(self, customer_token):
        """Test getting customer active orders"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        response = requests.get(f"{BASE_URL}/api/customer/orders/active", headers=headers)
        assert response.status_code == 200, f"Failed to get active orders: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Customer active orders: {len(data)} orders")


class TestCustomerLoyalty:
    """Customer loyalty program tests"""
    
    @pytest.fixture
    def customer_token(self):
        """Get customer auth token"""
        response = requests.post(f"{BASE_URL}/api/customer/login", json={
            "phone": CUSTOMER_PHONE,
            "password": CUSTOMER_PASSWORD
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Customer authentication failed")
    
    def test_get_loyalty_info(self, customer_token):
        """Test getting loyalty program info"""
        headers = {"Authorization": f"Bearer {customer_token}"}
        response = requests.get(f"{BASE_URL}/api/customer/loyalty", headers=headers)
        assert response.status_code == 200, f"Failed to get loyalty info: {response.text}"
        data = response.json()
        assert "points" in data
        assert "level" in data
        assert "level_benefits" in data
        print(f"✓ Customer loyalty: {data.get('points')} points, level: {data.get('level')}")


class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
            "role": "admin"
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Admin authentication failed")
    
    def test_cleanup_test_loyalty_rules(self, admin_token):
        """Clean up test loyalty rules"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get settings
        settings_response = requests.get(f"{BASE_URL}/api/admin/settings", headers=headers)
        settings = settings_response.json()
        
        # Delete test rules
        for rule in settings.get("loyalty_rules", []):
            if "TEST_" in rule.get("description", ""):
                requests.delete(f"{BASE_URL}/api/admin/settings/loyalty-rules/{rule['id']}", 
                              headers=headers)
                print(f"✓ Cleaned up test loyalty rule: {rule['id']}")
    
    def test_cleanup_test_time_promotions(self, admin_token):
        """Clean up test time promotions"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get settings
        settings_response = requests.get(f"{BASE_URL}/api/admin/settings", headers=headers)
        settings = settings_response.json()
        
        # Delete test promotions
        for promo in settings.get("time_promotions", []):
            if "TEST_" in promo.get("name", ""):
                requests.delete(f"{BASE_URL}/api/admin/settings/time-promotions/{promo['id']}", 
                              headers=headers)
                print(f"✓ Cleaned up test time promotion: {promo['id']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
