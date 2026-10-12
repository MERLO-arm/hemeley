"""
Wallet & Escrow models for HEMELEY
Separate file from main models.py to keep wallet logic isolated and secure.
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Literal
from datetime import datetime, timezone
import uuid


# ==================== WALLET ====================

WalletRole = Literal["customer", "vendor", "delivery", "admin", "admin_escrow", "admin_commissions"]
WalletStatus = Literal["active", "frozen", "closed"]


class Wallet(BaseModel):
    """Internal wallet — one per user (or system wallet for admin escrow/commissions)."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str  # owner id (for system wallets: "SYSTEM_ESCROW" or "SYSTEM_COMMISSIONS")
    role: WalletRole
    balance: float = 0.0
    held_balance: float = 0.0  # funds locked in escrow for pending orders (only for admin_escrow)
    currency: str = "XAF"
    status: WalletStatus = "active"
    # HMAC integrity signature of {user_id|role|balance|held_balance|version}
    integrity_hash: Optional[str] = None
    version: int = 0  # incremented on every update (optimistic concurrency)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ==================== TRANSACTION TYPES ====================

WalletTxType = Literal[
    "recharge",            # client topup via CAMPAY
    "order_payment",       # client pays for order (debit client, credit escrow)
    "escrow_hold",         # part of order_payment (admin_escrow side)
    "escrow_release_vendor",   # release vendor share when delivered
    "escrow_release_delivery", # release delivery share when delivered
    "commission",          # admin commission credit
    "refund",              # refund to customer wallet
    "withdrawal_hold",     # vendor/delivery withdrawal request (debit + lock)
    "withdrawal_payout",   # withdrawal sent to mobile money
    "withdrawal_reject",   # rejected: refund to wallet
    "subscription_payment", # vendor pays subscription
    "adjustment",          # super admin manual adjustment
]

WalletTxStatus = Literal["pending", "completed", "failed", "reversed"]


class WalletTransaction(BaseModel):
    """Immutable ledger entry for any wallet movement.
    
    Each entry has a unique reference TXN-HEMELEY-YYYYMMDD-XXXX and an HMAC
    signature computed over its critical fields to detect tampering.
    """
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    reference: str  # TXN-HEMELEY-YYYYMMDD-XXXX
    type: WalletTxType
    status: WalletTxStatus = "completed"
    amount: float
    currency: str = "XAF"
    # Either wallet may be None for top-ups (no source) / withdrawals (no destination internal)
    from_wallet_id: Optional[str] = None
    from_user_id: Optional[str] = None
    from_role: Optional[str] = None
    to_wallet_id: Optional[str] = None
    to_user_id: Optional[str] = None
    to_role: Optional[str] = None
    # Linked entities
    order_id: Optional[str] = None
    order_number: Optional[str] = None
    campay_reference: Optional[str] = None
    related_tx_id: Optional[str] = None  # e.g. for refunds, link to original
    description: Optional[str] = None
    metadata: Optional[dict] = None
    # Security: HMAC signature
    signature: Optional[str] = None
    # Initiator
    initiated_by: Optional[str] = None  # user id who triggered this (or "SYSTEM"/"WEBHOOK")
    initiated_role: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None


# ==================== RECHARGE ====================

RechargeStatus = Literal["pending", "successful", "failed", "expired"]


class RechargeRequest(BaseModel):
    """Tracks a Mobile Money recharge in progress."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    role: WalletRole
    amount: float
    phone: str  # mobile money number used
    currency: str = "XAF"
    campay_reference: Optional[str] = None
    external_reference: str  # our internal tx ref TXN-HEMELEY-...
    status: RechargeStatus = "pending"
    operator: Optional[str] = None  # MTN | ORANGE
    webhook_attempts: int = 0
    last_webhook_at: Optional[datetime] = None
    failure_reason: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None


class RechargeInitiate(BaseModel):
    amount: float
    phone: str  # phone format 237XXXXXXXXX


# ==================== WITHDRAWAL ====================

WithdrawalStatus = Literal["pending", "approved", "rejected", "paid", "failed"]


class WithdrawalRequest(BaseModel):
    """Vendor / delivery withdrawal request — manually approved by Super Admin."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    reference: str  # TXN-HEMELEY-...
    user_id: str
    role: WalletRole  # vendor | delivery
    user_name: Optional[str] = None
    amount: float
    phone: str
    currency: str = "XAF"
    status: WithdrawalStatus = "pending"
    rejection_reason: Optional[str] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    campay_reference: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class WithdrawalCreate(BaseModel):
    amount: float
    phone: str


class WithdrawalAction(BaseModel):
    reason: Optional[str] = None  # required when rejecting


# ==================== SUBSCRIPTION ====================

SubscriptionStatus = Literal["active", "expired", "cancelled"]


class VendorSubscription(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    vendor_id: str
    plan: str  # basic | pro | premium
    amount: float
    currency: str = "XAF"
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime
    status: SubscriptionStatus = "active"
    transaction_id: Optional[str] = None


# ==================== AUDIT LOG ====================

class WalletAuditLog(BaseModel):
    """Append-only audit trail of all wallet-related actions."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    actor_id: str  # who performed the action (user id or SYSTEM)
    actor_role: str
    action: str  # e.g. "wallet.freeze", "withdrawal.approve", "wallet.recharge"
    target_user_id: Optional[str] = None
    target_wallet_id: Optional[str] = None
    target_resource: Optional[str] = None
    details: Optional[dict] = None
    ip_address: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
