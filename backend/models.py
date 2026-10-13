from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Literal
from datetime import datetime, timezone, time
import uuid

# ==================== BASE MODELS ====================

class Zone(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    slug: str

# ==================== USER MODELS ====================

class UserBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    phone: str
    role: Literal["vendor", "delivery", "admin", "super_admin"]
    is_active: bool = True
    is_verified: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    password_hash: Optional[str] = None

class Vendor(UserBase):
    role: Literal["vendor"] = "vendor"
    name: str
    zone: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None
    logo_base64: Optional[str] = None
    brand_color: Optional[str] = None  # ex: "#FF6B00" (hex)
    cover_photos: List[str] = []       # jusqu'à 3 data URLs (jpg/png/webp), ordonnées
    custom_categories: List[str] = []  # catégories propres à ce vendor

class Delivery(UserBase):
    role: Literal["delivery"] = "delivery"
    name: str
    vehicle_type: Optional[str] = None
    is_available: bool = True
    current_latitude: Optional[float] = None
    current_longitude: Optional[float] = None
    total_deliveries: int = 0
    rating: float = 0.0

class Admin(UserBase):
    role: Literal["admin", "super_admin"]
    name: str
    permissions: List[str] = []

# ==================== AUTH MODELS ====================

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    phone: str
    name: str
    role: Literal["vendor", "delivery", "admin"]
    zone: Optional[str] = None
    address: Optional[str] = None
    vehicle_type: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str
    role: Optional[str] = None

class TokenResponse(BaseModel):
    token: str
    user: dict

# ==================== MENU MODELS ====================

class MenuAvailability(BaseModel):
    type: Literal["time_range", "days", "always"] = "always"
    start_time: Optional[str] = None  # "10:00"
    end_time: Optional[str] = None    # "15:00"
    days: Optional[List[str]] = None  # ["monday", "wednesday", "friday"]

class Menu(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vendor_id: str
    vendor_name: str
    name: str
    description: str
    ingredients: str
    price: float
    original_price: Optional[float] = None  # Prix barré (si promo)
    discount_percent: Optional[float] = None  # % de réduction
    category: str = "plat"  # plat, boisson, dessert, snack, petit-dejeuner
    zone: str
    total_portions: int
    remaining_portions: int
    cost_price: Optional[float] = None  # Coût matière par portion (FCFA) — pour calcul de marge
    image_base64: Optional[str] = None
    is_active: bool = True
    visibility_start: Optional[str] = None  # ISO date string
    visibility_end: Optional[str] = None    # ISO date string
    availability: MenuAvailability = Field(default_factory=MenuAvailability)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MenuCreate(BaseModel):
    name: str
    description: str
    ingredients: str
    price: float
    original_price: Optional[float] = None
    discount_percent: Optional[float] = None
    category: str = "plat"
    zone: str
    total_portions: int
    cost_price: Optional[float] = None
    image_base64: Optional[str] = None
    availability: Optional[MenuAvailability] = None
    visibility_start: Optional[str] = None
    visibility_end: Optional[str] = None

class MenuUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    ingredients: Optional[str] = None
    price: Optional[float] = None
    original_price: Optional[float] = None
    discount_percent: Optional[float] = None
    category: Optional[str] = None
    total_portions: Optional[int] = None
    remaining_portions: Optional[int] = None
    cost_price: Optional[float] = None
    is_active: Optional[bool] = None
    image_base64: Optional[str] = None
    availability: Optional[MenuAvailability] = None
    visibility_start: Optional[str] = None
    visibility_end: Optional[str] = None

# ==================== CART MODELS ====================

class CartItem(BaseModel):
    menu_id: str
    menu_name: str
    price: float
    quantity: int
    vendor_id: str
    vendor_name: str
    image_base64: Optional[str] = None

class Cart(BaseModel):
    items: List[CartItem] = []
    total: float = 0.0

# ==================== ORDER MODELS ====================

class OrderItem(BaseModel):
    menu_id: str
    menu_name: str
    quantity: int
    price: float
    subtotal: float

class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_number: str = Field(default_factory=lambda: f"HEM{datetime.now().strftime('%Y%m%d%H%M%S')}")
    
    # Customer info
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    customer_latitude: Optional[float] = None
    customer_longitude: Optional[float] = None
    customer_address: Optional[str] = None
    
    # Loyalty info
    is_vip: bool = False
    vip_discount: float = 0.0
    customer_order_count: int = 0
    
    # Order items
    items: List[OrderItem]
    
    # Vendor info
    vendor_id: str
    vendor_name: str
    vendor_phone: str
    zone: str
    
    # Delivery info
    delivery_id: Optional[str] = None
    delivery_name: Optional[str] = None
    delivery_phone: Optional[str] = None
    delivery_fee: float = 0.0
    distance_km: Optional[float] = None
    
    # Pricing
    subtotal: float
    discount: float = 0.0
    total: float
    
    # Payment
    payment_method: str
    payment_status: Literal["pending", "success", "failed"] = "pending"
    payment_reference: Optional[str] = None
    
    # Status
    order_status: Literal["pending", "confirmed", "preparing", "ready", "in_delivery", "delivered", "cancelled"] = "pending"
    
    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    confirmed_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    
    # Dine-in (table) & Presence
    table_number: Optional[str] = None
    order_type: Literal["delivery", "dine_in", "takeaway"] = "delivery"
    presence: Literal["on_site", "remote"] = "remote"
    table_token_verified: bool = False
    source: Optional[str] = "app"

    # Notes
    customer_note: Optional[str] = None

class OrderCreate(BaseModel):
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    customer_latitude: Optional[float] = None
    customer_longitude: Optional[float] = None
    customer_address: Optional[str] = None
    items: List[OrderItem]
    vendor_id: str
    zone: str
    payment_method: str
    table_number: Optional[str] = None
    order_type: Literal["delivery", "dine_in", "takeaway"] = "delivery"
    presence: Optional[Literal["on_site", "remote"]] = None
    table_token: Optional[str] = None
    source: Optional[str] = None
    customer_note: Optional[str] = None

class OrderStatusUpdate(BaseModel):
    order_status: Literal["confirmed", "preparing", "ready", "in_delivery", "delivered", "cancelled"]

# ==================== PAYMENT MODELS ====================

class PaymentInitiate(BaseModel):
    order_id: str
    amount: float
    customer_phone: str

class PaymentWebhook(BaseModel):
    reference: str
    status: str
    amount: str
    currency: str
    operator: Optional[str] = None
    code: Optional[str] = None
    operator_reference: Optional[str] = None

class Transaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_id: str
    order_number: str
    amount: float
    currency: str = "XAF"
    payment_method: str
    payment_provider: str = "campay"
    reference: str
    status: Literal["pending", "success", "failed"] = "pending"
    provider_response: Optional[dict] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

# ==================== NOTIFICATION MODELS ====================

class Notification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_role: str
    title: str
    message: str
    type: Literal["order", "payment", "delivery", "system"] = "system"
    is_read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    data: Optional[dict] = None

class NotificationCreate(BaseModel):
    user_id: str
    user_role: str
    title: str
    message: str
    type: Literal["order", "payment", "delivery", "system"] = "system"
    data: Optional[dict] = None

# ==================== STATS MODELS ====================

class VendorStats(BaseModel):
    total_orders: int
    total_revenue: float
    active_menus: int
    pending_orders: int

class DeliveryStats(BaseModel):
    total_deliveries: int
    total_earnings: float
    pending_deliveries: int
    rating: float

class AdminStats(BaseModel):
    total_orders: int
    total_revenue: float
    total_vendors: int
    total_delivery_partners: int
    pending_orders: int
    active_menus: int


# ==================== CUSTOMER MODELS ====================

class Customer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    pseudo: str
    phone: str
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    password_hash: Optional[str] = None
    profile_image: Optional[str] = None
    
    # Addresses
    addresses: List[dict] = []  # [{name, address, latitude, longitude, is_default}]
    
    # Loyalty Program
    loyalty_points: int = 0
    loyalty_level: Literal["bronze", "silver", "gold", "platinum"] = "bronze"
    total_orders: int = 0
    total_spent: float = 0.0
    
    # Referral
    referral_code: Optional[str] = None
    referral_count: int = 0
    referred_by: Optional[str] = None
    
    # Favorites
    favorite_vendors: List[str] = []
    favorite_menus: List[str] = []
    
    # Settings
    notifications_enabled: bool = True
    language: str = "fr"
    
    # Status
    is_active: bool = True
    is_verified: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_login: Optional[datetime] = None

class CustomerRegister(BaseModel):
    pseudo: str
    phone: str
    password: str
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    referral_code: Optional[str] = None

class CustomerLogin(BaseModel):
    phone: str
    password: str

class CustomerUpdate(BaseModel):
    pseudo: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    profile_image: Optional[str] = None
    notifications_enabled: Optional[bool] = None
    language: Optional[str] = None

class CustomerAddress(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # "Maison", "Bureau", etc.
    address: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_default: bool = False

# ==================== MESSAGING MODELS ====================

class Message(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    conversation_id: str
    sender_id: str
    sender_type: Literal["customer", "vendor"]
    sender_name: str
    content: str
    content_type: Literal["text", "image", "file"] = "text"
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    is_read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Conversation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customer_id: str
    customer_name: str
    customer_phone: str
    vendor_id: str
    vendor_name: str
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None
    unread_customer: int = 0
    unread_vendor: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MessageCreate(BaseModel):
    conversation_id: Optional[str] = None
    vendor_id: Optional[str] = None
    content: str
    content_type: Literal["text", "image", "file"] = "text"
    file_url: Optional[str] = None
    file_name: Optional[str] = None

# ==================== REVIEW MODELS ====================

class Review(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customer_id: str
    customer_name: str
    vendor_id: str
    vendor_name: str
    order_id: Optional[str] = None
    rating: int  # 1-5
    comment: Optional[str] = None
    reply: Optional[str] = None
    reply_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ReviewCreate(BaseModel):
    vendor_id: str
    order_id: Optional[str] = None
    rating: int
    comment: Optional[str] = None

# ==================== LOYALTY MODELS ====================

class LoyaltyTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customer_id: str
    type: Literal["earned", "spent", "bonus", "expired"]
    points: int
    description: str
    order_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class LoyaltyReward(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    points_required: int
    reward_type: Literal["discount_percent", "discount_fixed", "free_delivery", "free_item"]
    reward_value: float
    is_active: bool = True

# ==================== PROMOTION MODELS ====================

class LoyaltyRule(BaseModel):
    """Rule: if customer has >= points_threshold, they get discount_percent% off"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    points_threshold: int
    discount_percent: float
    is_active: bool = True
    description: Optional[str] = None

class TimePromotion(BaseModel):
    """Time-based promotion: discount during specific hours"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    discount_percent: float
    start_hour: int  # 0-23
    end_hour: int    # 0-23
    start_date: Optional[str] = None  # ISO date string
    end_date: Optional[str] = None    # ISO date string
    days_of_week: List[int] = [0, 1, 2, 3, 4, 5, 6]  # 0=Monday, 6=Sunday
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PlatformSettings(BaseModel):
    """Global platform settings managed by Super Admin"""
    model_config = ConfigDict(extra="ignore")
    id: str = "platform_settings"
    loyalty_rules: List[LoyaltyRule] = []
    time_promotions: List[TimePromotion] = []
    referral_bonus_new_user: int = 50
    referral_bonus_referrer: int = 100
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_by: Optional[str] = None

class LoyaltyRuleCreate(BaseModel):
    points_threshold: int
    discount_percent: float
    description: Optional[str] = None

class TimePromotionCreate(BaseModel):
    name: str
    discount_percent: float
    start_hour: int
    end_hour: int
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    days_of_week: List[int] = [0, 1, 2, 3, 4, 5, 6]


class PartnershipRequestCreate(BaseModel):
    name: str
    phone: str
    business_name: str
    type: str = "vendor"  # vendor | delivery | other
    zone: str
    description: Optional[str] = None


class PartnershipRequest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: str
    business_name: str
    type: str
    zone: str
    description: Optional[str] = None
    status: str = "pending"  # pending | approved | rejected
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
