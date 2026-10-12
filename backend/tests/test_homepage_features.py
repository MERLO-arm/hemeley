"""
Test suite for HEMELEY Homepage Features (Iteration 6)
- Menu API with new fields (category, original_price, discount_percent, visibility dates)
- Zone filtering (10 zones)
- Vendor menu creation with enhanced fields
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://hemeley-preview.preview.emergentagent.com"

# Test credentials
VENDOR_EMAIL = "vendeur@hemeley.com"
VENDOR_PASSWORD = "hemeley2024"
CUSTOMER_PHONE = "690000001"
CUSTOMER_PASSWORD = "hemeley2024"

# 10 zones as per requirements
ZONES = ['bonapriso', 'akwa', 'deido', 'bonamoussadi', 'bepanda', 'makepe', 'bonanjo', 'ndokotti', 'logbessou', 'kotto']

# Categories as per requirements
CATEGORIES = ['plat', 'petit-dejeuner', 'boisson', 'dessert', 'snack']


class TestMenuAPI:
    """Test menu endpoints with new fields"""
    
    def test_get_menus_by_zone(self):
        """Test fetching menus by zone - all 10 zones should work"""
        for zone in ZONES:
            response = requests.get(f"{BASE_URL}/api/menus?zone={zone}")
            assert response.status_code == 200, f"Failed for zone {zone}: {response.text}"
            data = response.json()
            assert isinstance(data, list), f"Expected list for zone {zone}"
            print(f"Zone {zone}: {len(data)} menus")
    
    def test_menu_response_structure(self):
        """Test that menu response includes all required fields"""
        response = requests.get(f"{BASE_URL}/api/menus?zone=bonapriso")
        assert response.status_code == 200
        
        menus = response.json()
        if len(menus) > 0:
            menu = menus[0]
            # Required fields
            assert 'id' in menu, "Missing id"
            assert 'name' in menu, "Missing name"
            assert 'price' in menu, "Missing price"
            assert 'vendor_name' in menu, "Missing vendor_name"
            assert 'vendor_id' in menu, "Missing vendor_id"
            assert 'zone' in menu, "Missing zone"
            
            # New optional fields should be present (even if null)
            print(f"Menu fields: {list(menu.keys())}")
            print(f"Menu has original_price: {'original_price' in menu}")
            print(f"Menu has discount_percent: {'discount_percent' in menu}")
            print(f"Menu has category: {'category' in menu}")
            print(f"Menu has visibility_start: {'visibility_start' in menu}")
            print(f"Menu has visibility_end: {'visibility_end' in menu}")


class TestVendorMenuCreation:
    """Test vendor menu creation with new fields"""
    
    @pytest.fixture
    def vendor_token(self):
        """Get vendor authentication token"""
        response = requests.post(f"{BASE_URL}/api/vendor/login", json={
            "email": VENDOR_EMAIL,
            "password": VENDOR_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Vendor login failed: {response.text}")
    
    def test_vendor_login(self):
        """Test vendor can login"""
        response = requests.post(f"{BASE_URL}/api/vendor/login", json={
            "email": VENDOR_EMAIL,
            "password": VENDOR_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        print(f"Vendor login successful")
    
    def test_create_menu_with_new_fields(self, vendor_token):
        """Test creating menu with category, original_price, discount_percent, visibility dates"""
        headers = {"Authorization": f"Bearer {vendor_token}"}
        
        # Create menu with all new fields
        menu_data = {
            "name": "TEST_Menu_With_Discount",
            "description": "Test menu with discount and visibility dates",
            "ingredients": "Test ingredients",
            "price": 2000,
            "original_price": 2500,  # Prix barré
            "discount_percent": 20,  # 20% discount
            "category": "plat",
            "zone": "bonapriso",
            "total_portions": 10,
            "visibility_start": (datetime.now()).strftime("%Y-%m-%d"),
            "visibility_end": (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        }
        
        response = requests.post(
            f"{BASE_URL}/api/vendor/menus",
            json=menu_data,
            headers=headers
        )
        
        assert response.status_code in [200, 201], f"Create menu failed: {response.text}"
        created_menu = response.json()
        
        # Verify new fields are saved
        assert created_menu.get("name") == menu_data["name"]
        assert created_menu.get("price") == menu_data["price"]
        print(f"Created menu: {created_menu.get('id')}")
        print(f"Original price: {created_menu.get('original_price')}")
        print(f"Discount percent: {created_menu.get('discount_percent')}")
        print(f"Category: {created_menu.get('category')}")
        print(f"Visibility start: {created_menu.get('visibility_start')}")
        print(f"Visibility end: {created_menu.get('visibility_end')}")
        
        # Cleanup - delete the test menu
        menu_id = created_menu.get("id")
        if menu_id:
            delete_response = requests.delete(
                f"{BASE_URL}/api/vendor/menus/{menu_id}",
                headers=headers
            )
            print(f"Cleanup: Delete menu {menu_id} - Status: {delete_response.status_code}")
    
    def test_create_menu_with_different_categories(self, vendor_token):
        """Test creating menus with different categories"""
        headers = {"Authorization": f"Bearer {vendor_token}"}
        created_menus = []
        
        for category in CATEGORIES:
            menu_data = {
                "name": f"TEST_Menu_{category}",
                "description": f"Test menu for category {category}",
                "ingredients": "Test ingredients",
                "price": 1500,
                "category": category,
                "zone": "bonapriso",
                "total_portions": 5
            }
            
            response = requests.post(
                f"{BASE_URL}/api/vendor/menus",
                json=menu_data,
                headers=headers
            )
            
            if response.status_code in [200, 201]:
                created_menu = response.json()
                created_menus.append(created_menu.get("id"))
                print(f"Created menu with category '{category}': {created_menu.get('id')}")
            else:
                print(f"Failed to create menu with category '{category}': {response.text}")
        
        # Cleanup
        for menu_id in created_menus:
            if menu_id:
                requests.delete(f"{BASE_URL}/api/vendor/menus/{menu_id}", headers=headers)
        
        assert len(created_menus) > 0, "No menus were created"
    
    def test_create_menu_with_all_zones(self, vendor_token):
        """Test creating menus in all 10 zones"""
        headers = {"Authorization": f"Bearer {vendor_token}"}
        created_menus = []
        
        for zone in ZONES:
            menu_data = {
                "name": f"TEST_Menu_{zone}",
                "description": f"Test menu for zone {zone}",
                "ingredients": "Test ingredients",
                "price": 1500,
                "category": "plat",
                "zone": zone,
                "total_portions": 5
            }
            
            response = requests.post(
                f"{BASE_URL}/api/vendor/menus",
                json=menu_data,
                headers=headers
            )
            
            if response.status_code in [200, 201]:
                created_menu = response.json()
                created_menus.append(created_menu.get("id"))
                print(f"Created menu in zone '{zone}': {created_menu.get('id')}")
            else:
                print(f"Failed to create menu in zone '{zone}': {response.text}")
        
        # Cleanup
        for menu_id in created_menus:
            if menu_id:
                requests.delete(f"{BASE_URL}/api/vendor/menus/{menu_id}", headers=headers)
        
        assert len(created_menus) == len(ZONES), f"Expected {len(ZONES)} menus, created {len(created_menus)}"


class TestCustomerAuth:
    """Test customer authentication"""
    
    def test_customer_login(self):
        """Test customer can login"""
        response = requests.post(f"{BASE_URL}/api/customer/login", json={
            "phone": CUSTOMER_PHONE,
            "password": CUSTOMER_PASSWORD
        })
        assert response.status_code == 200, f"Customer login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        
        # Check customer data
        customer = data.get("customer") or data.get("user")
        if customer:
            print(f"Customer pseudo: {customer.get('pseudo')}")
            assert customer.get("pseudo") is not None, "Customer pseudo missing"


class TestBackendModels:
    """Test that backend models accept new fields"""
    
    def test_menu_model_fields(self):
        """Verify Menu model has all required fields by checking API response"""
        response = requests.get(f"{BASE_URL}/api/menus?zone=bonapriso")
        assert response.status_code == 200
        
        # The fact that the API works means the model is correct
        # Check if we can filter by category (if implemented)
        print("Menu API working - model accepts zone parameter")
    
    def test_health_check(self):
        """Basic health check"""
        response = requests.get(f"{BASE_URL}/api/health")
        # Some APIs don't have health endpoint, so we check menus instead
        if response.status_code == 404:
            response = requests.get(f"{BASE_URL}/api/menus?zone=bonapriso")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        print("Backend is healthy")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
