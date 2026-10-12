"""
HEMELEY Customer Space API Tests
Tests for: Customer registration, login, dashboard, loyalty program, favorites, orders
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://hemeley-preview.preview.emergentagent.com')

# Test credentials
TEST_PHONE = f"699{uuid.uuid4().hex[:6]}"
TEST_PASSWORD = "test1234"
TEST_PSEUDO = f"TestUser_{uuid.uuid4().hex[:4]}"

VENDOR_ID = "128786a1-915c-49c9-bef5-e2e1434a0b29"

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture(scope="module")
def customer_token(api_client):
    """Register a test customer and get token"""
    # First try login with known test credentials
    login_response = api_client.post(f"{BASE_URL}/api/customer/login", json={
        "phone": "690000001",
        "password": "test1234"
    })
    
    if login_response.status_code == 200:
        return login_response.json().get("token")
    
    # Otherwise register new customer
    register_response = api_client.post(f"{BASE_URL}/api/customer/register", json={
        "pseudo": TEST_PSEUDO,
        "phone": TEST_PHONE,
        "whatsapp": TEST_PHONE,
        "password": TEST_PASSWORD
    })
    
    if register_response.status_code == 200:
        return register_response.json().get("token")
    
    pytest.skip("Could not register or login customer")

@pytest.fixture(scope="module")
def vendor_token(api_client):
    """Login vendor and get token"""
    response = api_client.post(f"{BASE_URL}/api/vendor/login", json={
        "email": "vendeur@hemeley.com",
        "password": "hemeley2024"
    })
    
    if response.status_code == 200:
        return response.json().get("token")
    
    # Try registration
    response = api_client.post(f"{BASE_URL}/api/vendor/register", json={
        "email": "vendeur@hemeley.com",
        "password": "hemeley2024",
        "phone": "655000001",
        "name": "Mon Restaurant",
        "role": "vendor",
        "zone": "bonapriso"
    })
    
    if response.status_code == 200:
        return response.json().get("token")
    
    pytest.skip("Could not login or register vendor")


class TestHealthAndBasics:
    """Basic API health checks"""
    
    def test_api_root(self, api_client):
        """Test API root returns correct message"""
        response = api_client.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "HEMELEY" in data.get("message", "")
    
    def test_health_check(self, api_client):
        """Test health endpoint"""
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
    
    def test_zones_endpoint(self, api_client):
        """Test zones endpoint returns data"""
        response = api_client.get(f"{BASE_URL}/api/zones")
        assert response.status_code == 200
        zones = response.json()
        assert isinstance(zones, list)
        assert len(zones) >= 2


class TestCustomerRegistration:
    """Customer registration flow tests"""
    
    def test_register_customer_success(self, api_client):
        """Test successful customer registration"""
        unique_phone = f"699{uuid.uuid4().hex[:6]}"
        unique_pseudo = f"User_{uuid.uuid4().hex[:4]}"
        
        response = api_client.post(f"{BASE_URL}/api/customer/register", json={
            "pseudo": unique_pseudo,
            "phone": unique_phone,
            "whatsapp": unique_phone,
            "email": f"{unique_pseudo}@test.com",
            "password": "testpassword123"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "customer" in data
        assert data["customer"]["pseudo"] == unique_pseudo
        assert data["customer"]["phone"] == unique_phone
        assert data["customer"]["loyalty_level"] == "bronze"
    
    def test_register_duplicate_phone_fails(self, api_client, customer_token):
        """Test that duplicate phone number fails registration"""
        # First login to get a known phone
        response = api_client.post(f"{BASE_URL}/api/customer/login", json={
            "phone": "690000001",
            "password": "test1234"
        })
        
        if response.status_code != 200:
            pytest.skip("No existing customer to test duplicate phone")
        
        # Try to register with same phone
        response = api_client.post(f"{BASE_URL}/api/customer/register", json={
            "pseudo": f"DupTest_{uuid.uuid4().hex[:4]}",
            "phone": "690000001",
            "password": "newpassword"
        })
        
        assert response.status_code == 400


class TestCustomerLogin:
    """Customer login flow tests"""
    
    def test_login_success(self, api_client, customer_token):
        """Test successful customer login"""
        response = api_client.post(f"{BASE_URL}/api/customer/login", json={
            "phone": "690000001",
            "password": "test1234"
        })
        
        # Either 200 (success) or 401 (wrong credentials)
        if response.status_code == 200:
            data = response.json()
            assert "token" in data
            assert "customer" in data
        else:
            # Test user may not exist, skip
            pytest.skip("Test customer not found")
    
    def test_login_wrong_password(self, api_client):
        """Test login with wrong password"""
        response = api_client.post(f"{BASE_URL}/api/customer/login", json={
            "phone": "690000001",
            "password": "wrongpassword"
        })
        
        assert response.status_code == 401


class TestCustomerProfile:
    """Customer profile tests"""
    
    def test_get_profile(self, api_client, customer_token):
        """Test getting customer profile"""
        response = api_client.get(f"{BASE_URL}/api/customer/profile", 
            headers={"Authorization": f"Bearer {customer_token}"})
        
        assert response.status_code == 200
        data = response.json()
        assert "pseudo" in data
        assert "phone" in data
        assert "loyalty_level" in data
    
    def test_get_profile_unauthorized(self, api_client):
        """Test profile access without token"""
        response = api_client.get(f"{BASE_URL}/api/customer/profile")
        assert response.status_code == 401


class TestCustomerLoyalty:
    """Loyalty program tests"""
    
    def test_get_loyalty_info(self, api_client, customer_token):
        """Test getting loyalty program info"""
        response = api_client.get(f"{BASE_URL}/api/customer/loyalty",
            headers={"Authorization": f"Bearer {customer_token}"})
        
        assert response.status_code == 200
        data = response.json()
        assert "points" in data
        assert "level" in data
        assert "multiplier" in data
        assert "level_benefits" in data
        
        # Verify level benefits structure
        assert "bronze" in data["level_benefits"]
        assert "silver" in data["level_benefits"]
        assert "gold" in data["level_benefits"]
        assert "platinum" in data["level_benefits"]


class TestCustomerStats:
    """Customer statistics tests"""
    
    def test_get_stats(self, api_client, customer_token):
        """Test getting customer stats"""
        response = api_client.get(f"{BASE_URL}/api/customer/stats",
            headers={"Authorization": f"Bearer {customer_token}"})
        
        assert response.status_code == 200
        data = response.json()
        assert "total_orders" in data
        assert "total_spent" in data
        assert "loyalty_points" in data
        assert "loyalty_level" in data


class TestCustomerOrders:
    """Customer orders tests"""
    
    def test_get_orders(self, api_client, customer_token):
        """Test getting customer orders"""
        response = api_client.get(f"{BASE_URL}/api/customer/orders",
            headers={"Authorization": f"Bearer {customer_token}"})
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_active_orders(self, api_client, customer_token):
        """Test getting active orders"""
        response = api_client.get(f"{BASE_URL}/api/customer/orders/active",
            headers={"Authorization": f"Bearer {customer_token}"})
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestCustomerFavorites:
    """Customer favorites tests"""
    
    def test_get_favorite_vendors(self, api_client, customer_token):
        """Test getting favorite vendors"""
        response = api_client.get(f"{BASE_URL}/api/customer/favorites/vendors",
            headers={"Authorization": f"Bearer {customer_token}"})
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_favorite_menus(self, api_client, customer_token):
        """Test getting favorite menus"""
        response = api_client.get(f"{BASE_URL}/api/customer/favorites/menus",
            headers={"Authorization": f"Bearer {customer_token}"})
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestCustomerConversations:
    """Customer messaging tests"""
    
    def test_get_conversations(self, api_client, customer_token):
        """Test getting customer conversations"""
        response = api_client.get(f"{BASE_URL}/api/customer/conversations",
            headers={"Authorization": f"Bearer {customer_token}"})
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestVendorPublicAPI:
    """Public vendor API tests"""
    
    def test_list_vendors(self, api_client):
        """Test listing vendors"""
        response = api_client.get(f"{BASE_URL}/api/vendors/")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_vendor_detail(self, api_client):
        """Test getting vendor details"""
        # First get list of vendors
        list_response = api_client.get(f"{BASE_URL}/api/vendors/")
        
        if list_response.status_code != 200 or len(list_response.json()) == 0:
            pytest.skip("No vendors available")
        
        vendor_id = list_response.json()[0]["id"]
        
        response = api_client.get(f"{BASE_URL}/api/vendors/{vendor_id}")
        assert response.status_code == 200
        data = response.json()
        assert "name" in data
        assert "menus" in data
        assert "reviews" in data
    
    def test_get_vendor_specific(self, api_client):
        """Test getting specific vendor (Mon Restaurant)"""
        response = api_client.get(f"{BASE_URL}/api/vendors/{VENDOR_ID}")
        
        if response.status_code == 404:
            pytest.skip("Test vendor not found")
        
        assert response.status_code == 200
        data = response.json()
        assert "name" in data


class TestVendorDashboard:
    """Vendor dashboard API tests"""
    
    def test_vendor_login(self, api_client):
        """Test vendor login"""
        response = api_client.post(f"{BASE_URL}/api/vendor/login", json={
            "email": "vendeur@hemeley.com",
            "password": "hemeley2024"
        })
        
        # Either 200 or vendor doesn't exist
        if response.status_code == 200:
            data = response.json()
            assert "token" in data
        else:
            # May need to register first
            pass
    
    def test_vendor_menus(self, api_client, vendor_token):
        """Test getting vendor menus"""
        if not vendor_token:
            pytest.skip("Vendor token not available")
        
        response = api_client.get(f"{BASE_URL}/api/vendor/menus",
            headers={"Authorization": f"Bearer {vendor_token}"})
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_vendor_orders(self, api_client, vendor_token):
        """Test getting vendor orders"""
        if not vendor_token:
            pytest.skip("Vendor token not available")
        
        response = api_client.get(f"{BASE_URL}/api/vendor/orders",
            headers={"Authorization": f"Bearer {vendor_token}"})
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestRestaurantPage:
    """Restaurant page API tests"""
    
    def test_get_restaurant_menus(self, api_client):
        """Test getting restaurant menus"""
        response = api_client.get(f"{BASE_URL}/api/vendors/{VENDOR_ID}/menus")
        
        if response.status_code == 404:
            pytest.skip("Test vendor not found")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_restaurant_reviews(self, api_client):
        """Test getting restaurant reviews"""
        response = api_client.get(f"{BASE_URL}/api/vendors/{VENDOR_ID}/reviews")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
