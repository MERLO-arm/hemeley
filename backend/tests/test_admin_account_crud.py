"""
Test Admin Account CRUD, Vendor Settings, and Vendor Messaging Features
Tests for iteration 5: Admin create/delete/deactivate accounts, Vendor profile settings, Vendor messaging reply
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://hemeley-preview.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@hemeley.com"
ADMIN_PASSWORD = "hemeley2024"
VENDOR_EMAIL = "vendeur@hemeley.com"
VENDOR_PASSWORD = "hemeley2024"


class TestAdminLogin:
    """Admin authentication tests"""
    
    def test_admin_login_success(self, api_client):
        """Test admin login with correct credentials"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
            "role": "admin"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert "user" in data, "No user in response"
        print(f"✅ Admin login successful, role: {data['user'].get('role')}")


class TestAdminAccountCreation:
    """Admin account creation tests"""
    
    def test_create_vendor_account(self, api_client, admin_token):
        """Test creating a vendor account via admin"""
        unique_id = str(uuid.uuid4())[:8]
        response = api_client.post(f"{BASE_URL}/api/admin/create-account", 
            json={
                "account_type": "vendor",
                "name": f"TEST_Vendor_{unique_id}",
                "email": f"test_vendor_{unique_id}@test.com",
                "phone": f"69{unique_id[:7]}",
                "password": "testpass123",
                "zone": "bonapriso",
                "trust_rate": 80,
                "default_rating": 4.5,
                "is_verified": True
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Create vendor failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert data.get("account_type") == "vendor"
        assert "id" in data
        print(f"✅ Vendor account created: {data['id']}")
        return data["id"]
    
    def test_create_customer_account(self, api_client, admin_token):
        """Test creating a customer account via admin"""
        unique_id = str(uuid.uuid4())[:8]
        response = api_client.post(f"{BASE_URL}/api/admin/create-account", 
            json={
                "account_type": "customer",
                "name": f"TEST_Customer_{unique_id}",
                "phone": f"68{unique_id[:7]}",
                "password": "testpass123",
                "loyalty_points": 100,
                "trust_rate": 90
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Create customer failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert data.get("account_type") == "customer"
        print(f"✅ Customer account created: {data['id']}")
        return data["id"]
    
    def test_create_delivery_account(self, api_client, admin_token):
        """Test creating a delivery account via admin"""
        unique_id = str(uuid.uuid4())[:8]
        response = api_client.post(f"{BASE_URL}/api/admin/create-account", 
            json={
                "account_type": "delivery",
                "name": f"TEST_Delivery_{unique_id}",
                "email": f"test_delivery_{unique_id}@test.com",
                "phone": f"67{unique_id[:7]}",
                "password": "testpass123",
                "zone": "bonanjo",
                "trust_rate": 75,
                "is_verified": True
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Create delivery failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert data.get("account_type") == "delivery"
        print(f"✅ Delivery account created: {data['id']}")
        return data["id"]
    
    def test_create_admin_account(self, api_client, admin_token):
        """Test creating an admin account via super admin"""
        unique_id = str(uuid.uuid4())[:8]
        response = api_client.post(f"{BASE_URL}/api/admin/create-account", 
            json={
                "account_type": "admin",
                "name": f"TEST_Admin_{unique_id}",
                "email": f"test_admin_{unique_id}@test.com",
                "password": "testpass123",
                "admin_role": "admin"
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Create admin failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert data.get("account_type") == "admin"
        print(f"✅ Admin account created: {data['id']}")
        return data["id"]


class TestAdminBulkAccountCreation:
    """Admin bulk account creation tests"""
    
    def test_bulk_create_accounts(self, api_client, admin_token):
        """Test bulk creating accounts"""
        unique_id = str(uuid.uuid4())[:6]
        response = api_client.post(f"{BASE_URL}/api/admin/create-accounts-bulk", 
            json={
                "accounts": [
                    {
                        "account_type": "customer",
                        "name": f"TEST_Bulk_Customer1_{unique_id}",
                        "phone": f"66{unique_id}1",
                        "password": "testpass123"
                    },
                    {
                        "account_type": "customer",
                        "name": f"TEST_Bulk_Customer2_{unique_id}",
                        "phone": f"66{unique_id}2",
                        "password": "testpass123"
                    },
                    {
                        "account_type": "vendor",
                        "name": f"TEST_Bulk_Vendor_{unique_id}",
                        "email": f"bulk_vendor_{unique_id}@test.com",
                        "phone": f"66{unique_id}3",
                        "password": "testpass123",
                        "zone": "bonapriso"
                    }
                ]
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Bulk create failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert data.get("created") >= 2, f"Expected at least 2 created, got {data.get('created')}"
        print(f"✅ Bulk accounts created: {data['created']}")


class TestAdminUserManagement:
    """Admin user deactivate/activate/delete tests"""
    
    def test_deactivate_vendor(self, api_client, admin_token):
        """Test deactivating a vendor"""
        # First create a vendor to deactivate
        unique_id = str(uuid.uuid4())[:8]
        create_resp = api_client.post(f"{BASE_URL}/api/admin/create-account", 
            json={
                "account_type": "vendor",
                "name": f"TEST_Deactivate_{unique_id}",
                "email": f"deactivate_{unique_id}@test.com",
                "phone": f"65{unique_id[:7]}",
                "password": "testpass123",
                "zone": "bonapriso"
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert create_resp.status_code == 200
        vendor_id = create_resp.json()["id"]
        
        # Deactivate
        response = api_client.put(f"{BASE_URL}/api/admin/users/{vendor_id}/deactivate?role=vendor",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Deactivate failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        print(f"✅ Vendor deactivated: {vendor_id}")
        
        # Activate again
        response = api_client.put(f"{BASE_URL}/api/admin/users/{vendor_id}/activate?role=vendor",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Activate failed: {response.text}"
        print(f"✅ Vendor activated: {vendor_id}")
        
        return vendor_id
    
    def test_delete_vendor(self, api_client, admin_token):
        """Test deleting a vendor"""
        # First create a vendor to delete
        unique_id = str(uuid.uuid4())[:8]
        create_resp = api_client.post(f"{BASE_URL}/api/admin/create-account", 
            json={
                "account_type": "vendor",
                "name": f"TEST_Delete_{unique_id}",
                "email": f"delete_{unique_id}@test.com",
                "phone": f"64{unique_id[:7]}",
                "password": "testpass123",
                "zone": "bonapriso"
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert create_resp.status_code == 200
        vendor_id = create_resp.json()["id"]
        
        # Delete
        response = api_client.delete(f"{BASE_URL}/api/admin/users/{vendor_id}?role=vendor",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Delete failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        print(f"✅ Vendor deleted: {vendor_id}")


class TestVendorProfileUpdate:
    """Vendor profile update tests (via admin endpoint)"""
    
    def test_update_vendor_profile(self, api_client, vendor_id):
        """Test updating vendor profile fields"""
        # Update name
        response = api_client.put(f"{BASE_URL}/api/admin/vendor-profile", 
            json={
                "vendor_id": vendor_id,
                "name": "TEST_Updated_Name"
            }
        )
        assert response.status_code == 200, f"Update name failed: {response.text}"
        data = response.json()
        assert data.get("name") == "TEST_Updated_Name"
        print(f"✅ Vendor name updated")
        
        # Update phone
        response = api_client.put(f"{BASE_URL}/api/admin/vendor-profile", 
            json={
                "vendor_id": vendor_id,
                "phone": "699999999"
            }
        )
        assert response.status_code == 200, f"Update phone failed: {response.text}"
        data = response.json()
        assert data.get("phone") == "699999999"
        print(f"✅ Vendor phone updated")
        
        # Update zone
        response = api_client.put(f"{BASE_URL}/api/admin/vendor-profile", 
            json={
                "vendor_id": vendor_id,
                "zone": "bonanjo"
            }
        )
        assert response.status_code == 200, f"Update zone failed: {response.text}"
        data = response.json()
        assert data.get("zone") == "bonanjo"
        print(f"✅ Vendor zone updated")
        
        # Update description
        response = api_client.put(f"{BASE_URL}/api/admin/vendor-profile", 
            json={
                "vendor_id": vendor_id,
                "description": "Test description for vendor"
            }
        )
        assert response.status_code == 200, f"Update description failed: {response.text}"
        data = response.json()
        assert data.get("description") == "Test description for vendor"
        print(f"✅ Vendor description updated")
        
        # Update opening hours
        response = api_client.put(f"{BASE_URL}/api/admin/vendor-profile", 
            json={
                "vendor_id": vendor_id,
                "opening_hours": "08:00",
                "closing_hours": "22:00"
            }
        )
        assert response.status_code == 200, f"Update hours failed: {response.text}"
        data = response.json()
        assert data.get("opening_hours") == "08:00"
        assert data.get("closing_hours") == "22:00"
        print(f"✅ Vendor hours updated")


class TestVendorLogin:
    """Vendor authentication tests"""
    
    def test_vendor_login_success(self, api_client):
        """Test vendor login with correct credentials"""
        response = api_client.post(f"{BASE_URL}/api/vendor/login", json={
            "email": VENDOR_EMAIL,
            "password": VENDOR_PASSWORD
        })
        assert response.status_code == 200, f"Vendor login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        print(f"✅ Vendor login successful")
        return data


class TestVendorMessaging:
    """Vendor messaging tests"""
    
    def test_get_vendor_conversations(self, api_client, vendor_id):
        """Test getting vendor conversations"""
        response = api_client.get(f"{BASE_URL}/api/vendors/messaging/conversations?vendor_id={vendor_id}")
        assert response.status_code == 200, f"Get conversations failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Got {len(data)} conversations for vendor")
        return data


class TestAdminGetEndpoints:
    """Admin GET endpoints tests"""
    
    def test_get_all_vendors(self, api_client, admin_token):
        """Test getting all vendors"""
        response = api_client.get(f"{BASE_URL}/api/admin/vendors",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Get vendors failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Got {len(data)} vendors")
    
    def test_get_all_customers(self, api_client, admin_token):
        """Test getting all customers"""
        response = api_client.get(f"{BASE_URL}/api/admin/customers",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Get customers failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Got {len(data)} customers")
    
    def test_get_all_delivery_partners(self, api_client, admin_token):
        """Test getting all delivery partners"""
        response = api_client.get(f"{BASE_URL}/api/admin/delivery-partners",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Get delivery partners failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Got {len(data)} delivery partners")
    
    def test_get_admin_stats(self, api_client, admin_token):
        """Test getting admin stats"""
        response = api_client.get(f"{BASE_URL}/api/admin/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Get stats failed: {response.text}"
        data = response.json()
        assert "total_orders" in data
        assert "total_vendors" in data
        print(f"✅ Got admin stats: {data['total_orders']} orders, {data['total_vendors']} vendors")


# ==================== FIXTURES ====================

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def admin_token(api_client):
    """Get admin authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD,
        "role": "admin"
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Admin authentication failed: {response.text}")


@pytest.fixture
def vendor_data(api_client):
    """Get vendor login data"""
    response = api_client.post(f"{BASE_URL}/api/vendor/login", json={
        "email": VENDOR_EMAIL,
        "password": VENDOR_PASSWORD
    })
    if response.status_code == 200:
        return response.json()
    pytest.skip(f"Vendor authentication failed: {response.text}")


@pytest.fixture
def vendor_id(vendor_data):
    """Get vendor ID from login"""
    user = vendor_data.get("user") or vendor_data.get("vendor")
    if user:
        return user.get("id")
    pytest.skip("Could not get vendor ID")


@pytest.fixture
def vendor_token(vendor_data):
    """Get vendor token"""
    return vendor_data.get("token")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
