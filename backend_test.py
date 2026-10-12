#!/usr/bin/env python3
"""
HEMELEY Backend API Testing Suite
Tests all API endpoints for the local food discovery platform
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, Optional

class HemeleyAPITester:
    def __init__(self, base_url: str = "https://hemeley-preview.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.vendor_token = None
        self.vendor_id = None
        self.test_menu_id = None
        self.test_order_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        
        # Test data
        self.test_vendor = {
            "name": f"Test Vendor {datetime.now().strftime('%H%M%S')}",
            "email": f"test_vendor_{datetime.now().strftime('%H%M%S')}@hemeley.com",
            "phone": "237699123456",
            "zone": "bonapriso",
            "password": "TestPass123!"
        }
        
        self.test_menu = {
            "name": "Poulet DG Test",
            "description": "Délicieux poulet aux légumes avec plantain",
            "ingredients": "Poulet, plantain, légumes, épices locales",
            "price": 2500.0,
            "zone": "bonapriso",
            "total_portions": 10
        }
        
        self.test_order = {
            "pseudonym": "TestUser",
            "comment": "J'adore ce plat!",
            "phone": "237677654321",
            "email": "test@example.com",
            "order_type": "commander",
            "payment_method": "orange"
        }

    def log_test(self, name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test results"""
        self.tests_run += 1
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} | {name}")
        
        if success:
            self.tests_passed += 1
        else:
            self.failed_tests.append({
                "test": name,
                "details": details,
                "response": response_data
            })
            
        if details:
            print(f"    Details: {details}")
        print()

    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, 
                    headers: Optional[Dict] = None, expected_status: int = 200) -> tuple:
        """Make HTTP request and return success status and response"""
        url = f"{self.api_url}/{endpoint.lstrip('/')}"
        
        default_headers = {'Content-Type': 'application/json'}
        if headers:
            default_headers.update(headers)
            
        if self.vendor_token and 'Authorization' not in default_headers:
            default_headers['Authorization'] = f'Bearer {self.vendor_token}'

        try:
            if method.upper() == 'GET':
                response = requests.get(url, headers=default_headers, timeout=30)
            elif method.upper() == 'POST':
                response = requests.post(url, json=data, headers=default_headers, timeout=30)
            elif method.upper() == 'PUT':
                response = requests.put(url, json=data, headers=default_headers, timeout=30)
            elif method.upper() == 'DELETE':
                response = requests.delete(url, headers=default_headers, timeout=30)
            else:
                return False, {"error": f"Unsupported method: {method}"}

            success = response.status_code == expected_status
            
            try:
                response_data = response.json()
            except:
                response_data = {"status_code": response.status_code, "text": response.text}
                
            return success, response_data
            
        except requests.exceptions.RequestException as e:
            return False, {"error": str(e)}

    def test_api_root(self):
        """Test API root endpoint"""
        success, response = self.make_request('GET', '/')
        expected_message = "HEMELEY API - Le goût du risque 🍛"
        
        if success and response.get('message') == expected_message:
            self.log_test("API Root", True, f"Message: {response.get('message')}")
        else:
            self.log_test("API Root", False, f"Expected message not found", response)

    def test_get_zones(self):
        """Test zones endpoint"""
        success, response = self.make_request('GET', '/zones')
        
        if success and isinstance(response, list) and len(response) == 2:
            zones = [zone['slug'] for zone in response]
            if 'bonapriso' in zones and 'bonanjo' in zones:
                self.log_test("Get Zones", True, f"Found zones: {zones}")
            else:
                self.log_test("Get Zones", False, f"Missing expected zones", response)
        else:
            self.log_test("Get Zones", False, "Invalid zones response", response)

    def test_menu_time_check(self):
        """Test menu time availability check"""
        success, response = self.make_request('GET', '/menu-time-check')
        
        if success and 'available' in response:
            availability = response['available']
            self.log_test("Menu Time Check", True, f"Available: {availability}")
        else:
            self.log_test("Menu Time Check", False, "Invalid time check response", response)

    def test_vendor_registration(self):
        """Test vendor registration"""
        success, response = self.make_request('POST', '/vendor/register', 
                                            self.test_vendor, expected_status=200)
        
        if success and 'token' in response and 'vendor' in response:
            self.vendor_token = response['token']
            self.vendor_id = response['vendor']['id']
            self.log_test("Vendor Registration", True, 
                         f"Vendor ID: {self.vendor_id}")
        else:
            self.log_test("Vendor Registration", False, 
                         "Registration failed", response)

    def test_vendor_login(self):
        """Test vendor login"""
        login_data = {
            "email": self.test_vendor["email"],
            "password": self.test_vendor["password"]
        }
        
        success, response = self.make_request('POST', '/vendor/login', 
                                            login_data, expected_status=200)
        
        if success and 'token' in response:
            # Update token from login
            self.vendor_token = response['token']
            self.log_test("Vendor Login", True, "Login successful")
        else:
            self.log_test("Vendor Login", False, "Login failed", response)

    def test_create_menu(self):
        """Test menu creation"""
        if not self.vendor_token:
            self.log_test("Create Menu", False, "No vendor token available")
            return
            
        success, response = self.make_request('POST', '/vendor/menus', 
                                            self.test_menu, expected_status=200)
        
        if success and 'id' in response:
            self.test_menu_id = response['id']
            self.log_test("Create Menu", True, f"Menu ID: {self.test_menu_id}")
        else:
            self.log_test("Create Menu", False, "Menu creation failed", response)

    def test_get_vendor_menus(self):
        """Test getting vendor menus"""
        if not self.vendor_token:
            self.log_test("Get Vendor Menus", False, "No vendor token available")
            return
            
        success, response = self.make_request('GET', '/vendor/menus')
        
        if success and isinstance(response, list):
            menu_count = len(response)
            self.log_test("Get Vendor Menus", True, f"Found {menu_count} menus")
        else:
            self.log_test("Get Vendor Menus", False, "Failed to get menus", response)

    def test_get_public_menus(self):
        """Test getting public menus"""
        success, response = self.make_request('GET', '/menus')
        
        if success and isinstance(response, list):
            self.log_test("Get Public Menus", True, f"Found {len(response)} public menus")
        else:
            self.log_test("Get Public Menus", False, "Failed to get public menus", response)

    def test_get_menus_by_zone(self):
        """Test getting menus by zone"""
        success, response = self.make_request('GET', '/menus?zone=bonapriso')
        
        if success and isinstance(response, list):
            self.log_test("Get Menus by Zone", True, 
                         f"Found {len(response)} menus in Bonapriso")
        else:
            self.log_test("Get Menus by Zone", False, 
                         "Failed to get menus by zone", response)

    def test_get_menu_detail(self):
        """Test getting menu detail"""
        if not self.test_menu_id:
            self.log_test("Get Menu Detail", False, "No test menu ID available")
            return
            
        success, response = self.make_request('GET', f'/menus/{self.test_menu_id}')
        
        if success and response.get('id') == self.test_menu_id:
            self.log_test("Get Menu Detail", True, f"Menu: {response.get('name')}")
        else:
            self.log_test("Get Menu Detail", False, "Failed to get menu detail", response)

    def test_create_order(self):
        """Test order creation"""
        if not self.test_menu_id:
            self.log_test("Create Order", False, "No test menu ID available")
            return
            
        order_data = {**self.test_order, "menu_id": self.test_menu_id}
        success, response = self.make_request('POST', '/orders', 
                                            order_data, expected_status=200)
        
        if success and 'id' in response:
            self.test_order_id = response['id']
            self.log_test("Create Order", True, f"Order ID: {self.test_order_id}")
        else:
            self.log_test("Create Order", False, "Order creation failed", response)

    def test_get_vendor_orders(self):
        """Test getting vendor orders"""
        if not self.vendor_token:
            self.log_test("Get Vendor Orders", False, "No vendor token available")
            return
            
        success, response = self.make_request('GET', '/vendor/orders')
        
        if success and isinstance(response, list):
            self.log_test("Get Vendor Orders", True, f"Found {len(response)} orders")
        else:
            self.log_test("Get Vendor Orders", False, "Failed to get orders", response)

    def test_update_menu(self):
        """Test menu update"""
        if not self.vendor_token or not self.test_menu_id:
            self.log_test("Update Menu", False, "Missing vendor token or menu ID")
            return
            
        update_data = {"is_active": False}
        success, response = self.make_request('PUT', f'/vendor/menus/{self.test_menu_id}', 
                                            update_data)
        
        if success and response.get('is_active') == False:
            self.log_test("Update Menu", True, "Menu deactivated successfully")
        else:
            self.log_test("Update Menu", False, "Menu update failed", response)

    def test_confirm_payment(self):
        """Test payment confirmation"""
        if not self.vendor_token or not self.test_order_id:
            self.log_test("Confirm Payment", False, "Missing vendor token or order ID")
            return
            
        success, response = self.make_request('PUT', f'/vendor/orders/{self.test_order_id}/confirm')
        
        if success and response.get('success'):
            self.log_test("Confirm Payment", True, "Payment confirmed")
        else:
            self.log_test("Confirm Payment", False, "Payment confirmation failed", response)

    def cleanup_test_data(self):
        """Clean up test data"""
        if self.vendor_token and self.test_menu_id:
            try:
                self.make_request('DELETE', f'/vendor/menus/{self.test_menu_id}')
                print("🧹 Test menu cleaned up")
            except:
                pass

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting HEMELEY API Tests")
        print("=" * 50)
        
        # Basic API tests
        self.test_api_root()
        self.test_get_zones()
        self.test_menu_time_check()
        
        # Public menu tests
        self.test_get_public_menus()
        self.test_get_menus_by_zone()
        
        # Vendor authentication tests
        self.test_vendor_registration()
        self.test_vendor_login()
        
        # Vendor menu management tests
        self.test_create_menu()
        self.test_get_vendor_menus()
        self.test_get_menu_detail()
        self.test_update_menu()
        
        # Order management tests
        self.test_create_order()
        self.test_get_vendor_orders()
        self.test_confirm_payment()
        
        # Cleanup
        self.cleanup_test_data()
        
        # Print summary
        print("=" * 50)
        print(f"📊 Test Summary:")
        print(f"   Total Tests: {self.tests_run}")
        print(f"   Passed: {self.tests_passed}")
        print(f"   Failed: {len(self.failed_tests)}")
        print(f"   Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.failed_tests:
            print("\n❌ Failed Tests:")
            for test in self.failed_tests:
                print(f"   - {test['test']}: {test['details']}")
        
        return len(self.failed_tests) == 0

def main():
    """Main test runner"""
    tester = HemeleyAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())