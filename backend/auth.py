import bcrypt
import jwt
import os
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

JWT_SECRET = os.environ.get('JWT_SECRET', 'hemeley_secret_key_2024')
security = HTTPBearer()

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_db(request: Request):
    return request.app.state.db

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), request: Request = None):
    """Get current authenticated user from token"""
    if not request:
        raise HTTPException(status_code=500, detail="Request not available")
    
    db = request.app.state.db
    
    token = credentials.credentials
    payload = decode_token(token)
    
    # Find user based on role
    role = payload.get("role")
    user_id = payload.get("user_id")
    
    if role == "vendor":
        collection = db.vendors
    elif role == "delivery":
        collection = db.delivery_partners
    elif role in ["admin", "super_admin"]:
        collection = db.admins
    else:
        raise HTTPException(status_code=401, detail="Invalid role")
    
    user = await collection.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is inactive")
    
    return user

def require_role(*allowed_roles):
    """Decorator to require specific roles"""
    async def role_checker(user: dict = Depends(get_current_user)):
        if user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return role_checker