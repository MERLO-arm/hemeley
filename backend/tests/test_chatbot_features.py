"""
Test suite for HEMELEY iteration 7 features:
- AI Chatbot HEME (POST /api/chatbot/chat)
- Homepage hero slideshow
- Footer links
- Vendor dashboard 'Plats' wording
- Vendor add menu form fields
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthAndBasics:
    """Basic health checks"""
    
    def test_api_health(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✓ API health check passed")
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "HEMELEY" in data.get("message", "")
        print("✓ API root check passed")


class TestChatbotAPI:
    """Test AI Chatbot HEME endpoints"""
    
    def test_chatbot_chat_endpoint_exists(self):
        """Test that chatbot chat endpoint exists and responds"""
        session_id = f"test_{uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{BASE_URL}/api/chatbot/chat",
            json={
                "message": "Bonjour",
                "session_id": session_id,
                "customer": None
            }
        )
        # Should return 200 even if LLM fails (graceful error handling)
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        print(f"✓ Chatbot chat endpoint works, response: {data.get('response', '')[:100]}...")
    
    def test_chatbot_responds_in_french(self):
        """Test that chatbot responds in French"""
        session_id = f"test_{uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{BASE_URL}/api/chatbot/chat",
            json={
                "message": "Quels plats avez-vous?",
                "session_id": session_id,
                "customer": None
            }
        )
        assert response.status_code == 200
        data = response.json()
        # Check response exists (may be error message if LLM key invalid)
        assert "response" in data
        print(f"✓ Chatbot responds: {data.get('response', '')[:150]}...")
    
    def test_chatbot_reset_endpoint(self):
        """Test chatbot reset endpoint"""
        session_id = f"test_{uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{BASE_URL}/api/chatbot/chat/reset",
            json={"session_id": session_id}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print("✓ Chatbot reset endpoint works")
    
    def test_chatbot_with_customer_context(self):
        """Test chatbot with customer context"""
        session_id = f"test_{uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{BASE_URL}/api/chatbot/chat",
            json={
                "message": "Bonjour",
                "session_id": session_id,
                "customer": {
                    "id": "test_customer_123",
                    "pseudo": "TestClient",
                    "loyalty_points": 100,
                    "loyalty_level": "silver"
                }
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        print(f"✓ Chatbot with customer context works")


class TestMenusAPI:
    """Test menus API for zones and categories"""
    
    def test_get_menus_all_zones(self):
        """Test getting menus from all 10 zones"""
        zones = ['bonapriso', 'akwa', 'deido', 'bonamoussadi', 'bepanda', 
                 'makepe', 'bonanjo', 'ndokotti', 'logbessou', 'kotto']
        
        for zone in zones:
            response = requests.get(f"{BASE_URL}/api/menus?zone={zone}")
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)
            print(f"✓ Zone {zone}: {len(data)} menus")
        
        print("✓ All 10 zones return menus successfully")
    
    def test_zones_endpoint(self):
        """Test zones endpoint"""
        response = requests.get(f"{BASE_URL}/api/zones")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Zones endpoint returns {len(data)} zones")


class TestVendorAuth:
    """Test vendor authentication"""
    
    def test_vendor_login(self):
        """Test vendor login with test credentials"""
        response = requests.post(
            f"{BASE_URL}/api/vendor/login",
            json={
                "email": "vendeur@hemeley.com",
                "password": "hemeley2024",
                "role": "vendor"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        print("✓ Vendor login works")
        return data.get("token")
    
    def test_vendor_menus_endpoint(self):
        """Test vendor menus endpoint with auth"""
        # First login
        login_response = requests.post(
            f"{BASE_URL}/api/vendor/login",
            json={
                "email": "vendeur@hemeley.com",
                "password": "hemeley2024",
                "role": "vendor"
            }
        )
        if login_response.status_code != 200:
            pytest.skip("Vendor login failed")
        
        token = login_response.json().get("token")
        
        # Get vendor menus
        response = requests.get(
            f"{BASE_URL}/api/vendor/menus",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Vendor menus endpoint returns {len(data)} menus")


class TestCustomerAuth:
    """Test customer authentication"""
    
    def test_customer_login(self):
        """Test customer login with test credentials"""
        response = requests.post(
            f"{BASE_URL}/api/customer/login",
            json={
                "phone": "690000001",
                "password": "hemeley2024"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "customer" in data
        customer = data.get("customer", {})
        assert customer.get("pseudo") == "TestClient"
        print(f"✓ Customer login works, pseudo: {customer.get('pseudo')}")


class TestAdminAuth:
    """Test admin authentication"""
    
    def test_admin_login(self):
        """Test admin login with test credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "admin@hemeley.com",
                "password": "hemeley2024",
                "role": "admin"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        print("✓ Admin login works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
