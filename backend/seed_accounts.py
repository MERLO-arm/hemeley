# Script d\'initialisation automatique des comptes de test HEMELEY
import asyncio
import os
import hashlib
import bcrypt
import uuid
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

def hash_bcrypt(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def hash_sha256(password: str) -> str:
    return hashlib.sha256(password.encode('utf-8')).hexdigest()

async def seed():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    print(f'Connecte a MongoDB: {MONGO_URL} / {DB_NAME}')

    now_iso = datetime.now(timezone.utc).isoformat()

    # 1. CLIENT (Customer)
    client_phone = '690000001'
    client_doc = {
        'id': str(uuid.uuid4()),
        'pseudo': 'TestClient',
        'phone': client_phone,
        'email': 'client@hemeley.com',
        'whatsapp': '237690000001',
        'password_hash': hash_sha256('hemeley2024'),
        'loyalty_points': 150,
        'loyalty_tier': 'bronze',
        'created_at': now_iso,
        'addresses': [
            {
                'name': 'Bureau Bonapriso',
                'address': 'Rue Njo-Njo, Bonapriso, Douala',
                'latitude': 4.0242,
                'longitude': 9.6974,
                'is_default': True
            }
        ]
    }
    await db.customers.update_one({'phone': client_phone}, {'': client_doc}, upsert=True)
    print('Client cree/mis a jour: 690000001 / hemeley2024')

    # 2. VENDEUR (Vendor)
    vendor_email = 'vendeur@hemeley.com'
    vendor_doc = {
        'id': str(uuid.uuid4()),
        'name': 'Chez Mama Douala',
        'email': vendor_email,
        'phone': '690000002',
        'role': 'vendor',
        'zone': 'bonapriso',
        'address': 'Carrefour Armée de l\'Air, Bonapriso',
        'brand_color': '#FF6B00',
        'password_hash': hash_bcrypt('hemeley2024'),
        'is_active': True,
        'created_at': now_iso
    }
    await db.vendors.update_one({'email': vendor_email}, {'': vendor_doc}, upsert=True)
    print('Vendeur cree/mis a jour: vendeur@hemeley.com / hemeley2024')

    # 3. LIVREUR (Delivery Partner)
    delivery_email = 'livreur@hemeley.com'
    delivery_doc = {
        'id': str(uuid.uuid4()),
        'name': 'Livreur Express Douala',
        'email': delivery_email,
        'phone': '690000003',
        'role': 'delivery',
        'vehicle_type': 'moto',
        'is_available': True,
        'rating': 4.9,
        'total_deliveries': 24,
        'password_hash': hash_bcrypt('hemeley2024'),
        'created_at': now_iso
    }
    await db.delivery_partners.update_one({'email': delivery_email}, {'': delivery_doc}, upsert=True)
    print('Livreur cree/mis a jour: livreur@hemeley.com / hemeley2024')

    # 4. SUPER ADMIN
    admin_email = 'admin@hemeley.com'
    admin_doc = {
        'id': str(uuid.uuid4()),
        'name': 'Super Admin Hemeley',
        'email': admin_email,
        'phone': '690000000',
        'role': 'super_admin',
        'permissions': ['all'],
        'password_hash': hash_bcrypt('hemeley2024'),
        'created_at': now_iso
    }
    await db.admins.update_one({'email': admin_email}, {'': admin_doc}, upsert=True)
    print('Super Admin cree/mis a jour: admin@hemeley.com / hemeley2024')

    client.close()
    print('\nTous les 4 comptes ont ete initialises avec succes!')

if __name__ == '__main__':
    asyncio.run(seed())
