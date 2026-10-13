"""Module de gestion des jetons sécurisés HMAC pour les tables de restaurant.

Permet la détection infalsifiable de présence sur site (au restaurant) sans GPS.
Le jeton est permanent et encodé de manière URL-safe.
Format : base64url("{table_number}.{hmac_sha256(secret, slug:table_number)[:24]}")
"""

import hmac
import hashlib
import base64
import os
from typing import Tuple, Optional

def get_hmac_secret() -> str:
    return os.environ.get("JWT_SECRET") or os.environ.get("TABLE_QR_SECRET") or "hemeley_secure_table_token_secret_douala_2026"


def generate_table_token(vendor_slug: str, table_number: str) -> str:
    """Génère un jeton permanent infalsifiable pour une table spécifique d'un restaurant."""
    if not vendor_slug or not table_number:
        raise ValueError("vendor_slug et table_number sont requis")
        
    clean_slug = str(vendor_slug).strip().lower()
    clean_table = str(table_number).strip()
    secret = get_hmac_secret()
    
    payload = f"{clean_slug}:{clean_table}"
    sig = hmac.new(secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()[:24]
    
    raw = f"{clean_table}.{sig}"
    token = base64.urlsafe_b64encode(raw.encode("utf-8")).decode("utf-8").rstrip("=")
    return token


def verify_table_token(vendor_slug: str, token: str) -> Tuple[bool, Optional[str]]:
    """Vérifie l'authenticité du jeton pour le restaurant spécifié.
    
    Retourne :
      (True, table_number) si le jeton est valide pour ce restaurant.
      (False, None) si le jeton est invalide, corrompu, ou falsifié.
    """
    if not token or not vendor_slug:
        return False, None
        
    try:
        clean_token = str(token).strip()
        padded = clean_token + "=" * (-len(clean_token) % 4)
        decoded = base64.urlsafe_b64decode(padded.encode("utf-8")).decode("utf-8")
        
        if "." not in decoded:
            return False, None
            
        table_number, sig = decoded.split(".", 1)
        clean_slug = str(vendor_slug).strip().lower()
        clean_table = str(table_number).strip()
        secret = get_hmac_secret()
        
        payload = f"{clean_slug}:{clean_table}"
        expected_sig = hmac.new(secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()[:24]
        
        if hmac.compare_digest(sig, expected_sig):
            return True, clean_table
            
        return False, None
    except Exception:
        return False, None
