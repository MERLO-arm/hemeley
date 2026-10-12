"""
Wallet security utilities for HEMELEY.

- HMAC signing of wallet transactions and wallet snapshots (integrity protection).
- Generation of unique transaction references (TXN-HEMELEY-YYYYMMDD-XXXX).
- Helpers to read the encryption/signing key from environment.
"""
import os
import hmac
import hashlib
import secrets
from datetime import datetime, timezone


def _get_secret() -> bytes:
    key = os.environ.get("WALLET_ENCRYPTION_KEY")
    if not key:
        raise RuntimeError("WALLET_ENCRYPTION_KEY missing in environment")
    return key.encode("utf-8")


def sign_payload(parts: list) -> str:
    """Compute HMAC-SHA256 signature of pipe-joined payload parts."""
    msg = "|".join("" if p is None else str(p) for p in parts).encode("utf-8")
    return hmac.new(_get_secret(), msg, hashlib.sha256).hexdigest()


def verify_signature(parts: list, signature: str) -> bool:
    if not signature:
        return False
    expected = sign_payload(parts)
    return hmac.compare_digest(expected, signature)


def sign_wallet(wallet: dict) -> str:
    """Compute integrity hash for a wallet document."""
    return sign_payload([
        wallet.get("id"),
        wallet.get("user_id"),
        wallet.get("role"),
        f"{float(wallet.get('balance', 0)):.2f}",
        f"{float(wallet.get('held_balance', 0)):.2f}",
        wallet.get("status", "active"),
        wallet.get("version", 0),
    ])


def sign_transaction(tx: dict) -> str:
    """Compute HMAC signature for a wallet transaction."""
    return sign_payload([
        tx.get("id"),
        tx.get("reference"),
        tx.get("type"),
        f"{float(tx.get('amount', 0)):.2f}",
        tx.get("currency", "XAF"),
        tx.get("from_wallet_id"),
        tx.get("to_wallet_id"),
        tx.get("status"),
        tx.get("created_at"),
    ])


def generate_tx_reference() -> str:
    """Generate a unique transaction reference: TXN-HEMELEY-YYYYMMDD-XXXX
    XXXX is 6 hex chars (uppercase) for sufficient uniqueness within a day.
    """
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    rand = secrets.token_hex(3).upper()  # 6 hex chars
    return f"TXN-HEMELEY-{today}-{rand}"


# System wallet ids (constants)
SYSTEM_ESCROW_USER_ID = "SYSTEM_ESCROW"
SYSTEM_COMMISSIONS_USER_ID = "SYSTEM_COMMISSIONS"
