"""CAMPAY (Cameroon Mobile Money) client.

Implementation manuelle via httpx pur (PAS le SDK pip `campay` qui est cassé).
Conforme au guide en 10 étapes :
- Auth via permanent token (CAMPAY_TOKEN) + fallback dynamique via POST /token/
- Header exact : "Authorization: Token {token}" (pas Bearer, pas JWT)
- Endpoints : /token/, /collect/, /transaction/{reference}/, /withdraw/
- Mode démo : https://demo.campay.net/api  |  Live : https://campay.net/api
- Validation: amount entier >= 25, téléphone forcé en format 237XXXXXXXXX
"""
import os
import httpx
import hmac
import hashlib
import logging
from fastapi import HTTPException

logger = logging.getLogger(__name__)


def normalize_cm_phone(phone: str) -> str:
    """Normalise un numéro camerounais au format 237XXXXXXXXX (12 chiffres)."""
    if not phone:
        raise HTTPException(status_code=400, detail="Numéro de téléphone requis")
    p = str(phone).strip().replace(" ", "").replace("-", "")
    if p.startswith("+"):
        p = p[1:]
    if p.startswith("00"):
        p = p[2:]
    # Si déjà en 237XXXXXXXXX (12 chiffres)
    if p.startswith("237") and len(p) == 12 and p.isdigit():
        return p
    # Si 9 chiffres locaux 6XXXXXXXX
    if len(p) == 9 and p.isdigit() and p.startswith(("6", "2")):
        return "237" + p
    # Tentative : strip 0 initial puis préfixer 237
    p_stripped = p.lstrip("0")
    if len(p_stripped) == 9 and p_stripped.isdigit():
        return "237" + p_stripped
    raise HTTPException(
        status_code=400,
        detail=f"Numéro invalide. Format attendu: 237XXXXXXXXX (ex: 237670000000). Reçu: {phone}",
    )


class CampayClient:
    def __init__(self):
        self._dynamic_token = None  # cached

    # --- lazy env readers (load_dotenv may not have run at import time) ---
    @property
    def app_id(self):
        return os.environ.get("CAMPAY_APP_ID")

    @property
    def username(self):
        return os.environ.get("CAMPAY_USERNAME")

    @property
    def password(self):
        return os.environ.get("CAMPAY_PASSWORD")

    @property
    def _permanent_token(self):
        return os.environ.get("CAMPAY_TOKEN") or os.environ.get("CAMPAY_ACCESS_TOKEN")

    @property
    def webhook_secret(self):
        return os.environ.get("CAMPAY_WEBHOOK_KEY") or os.environ.get("CAMPAY_WEBHOOK_SECRET")

    @property
    def env(self):
        return os.environ.get("CAMPAY_ENV", "demo")

    @property
    def base_url(self):
        return (
            "https://demo.campay.net/api"
            if self.env == "demo"
            else "https://campay.net/api"
        )

    # ---------- Token management ----------
    async def _fetch_dynamic_token(self) -> str:
        """POST /token/ avec username/password (app_id/secret CamPay)."""
        if not self.username or not self.password:
            raise HTTPException(
                status_code=500,
                detail="CAMPAY_USERNAME / CAMPAY_PASSWORD non configurés",
            )
        url = f"{self.base_url}/token/"
        payload = {"username": self.username, "password": self.password}
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(url, json=payload, timeout=20)
                if resp.status_code >= 400:
                    logger.error(
                        f"CAMPAY /token/ failed: {resp.status_code} {resp.text[:300]}"
                    )
                    raise HTTPException(
                        status_code=502,
                        detail=f"CAMPAY auth failed ({resp.status_code})",
                    )
                data = resp.json()
                tok = data.get("token") or data.get("access_token")
                if not tok:
                    raise HTTPException(
                        status_code=502, detail="CAMPAY token absent de la réponse"
                    )
                self._dynamic_token = tok
                return tok
        except httpx.HTTPError as e:
            logger.error(f"CAMPAY token network error: {e}")
            raise HTTPException(status_code=502, detail=f"CAMPAY auth network error: {e}")

    async def _get_token(self, force_refresh: bool = False) -> str:
        if force_refresh:
            return await self._fetch_dynamic_token()
        if self._dynamic_token:
            return self._dynamic_token
        if self._permanent_token:
            return self._permanent_token
        return await self._fetch_dynamic_token()

    def _headers(self, token: str) -> dict:
        # Header EXACT requis par CamPay : "Token {token}" (avec majuscule)
        return {
            "Authorization": f"Token {token}",
            "Content-Type": "application/json",
        }

    async def _request_with_retry(
        self, method: str, url: str, json_body: dict | None = None
    ) -> dict:
        """Requête CamPay avec refresh automatique du token si 401/403."""
        for attempt in (1, 2):
            token = await self._get_token(force_refresh=(attempt == 2))
            try:
                async with httpx.AsyncClient() as client:
                    if method.upper() == "GET":
                        resp = await client.get(url, headers=self._headers(token), timeout=30)
                    else:
                        resp = await client.post(
                            url, json=json_body or {}, headers=self._headers(token), timeout=30
                        )
                if resp.status_code in (401, 403) and attempt == 1:
                    logger.warning(
                        f"CAMPAY {method} {url} → {resp.status_code} (token invalide), refresh + retry"
                    )
                    continue
                if resp.status_code >= 400:
                    logger.error(
                        f"CAMPAY {method} {url} → {resp.status_code} {resp.text[:300]}"
                    )
                    raise HTTPException(
                        status_code=502,
                        detail=f"CAMPAY error {resp.status_code}: {resp.text[:200]}",
                    )
                return resp.json()
            except httpx.HTTPError as e:
                if attempt == 2:
                    logger.error(f"CAMPAY {method} {url} network error: {e}")
                    raise HTTPException(status_code=502, detail=f"CAMPAY network error: {e}")
        # Should never reach here
        raise HTTPException(status_code=502, detail="CAMPAY: échec après retry")

    # ---------- Public API ----------
    async def initiate_payment(
        self,
        amount: float,
        phone: str,
        external_reference: str,
        description: str = "HEMELEY",
    ) -> dict:
        """POST /collect/ — Initie une demande Mobile Money sur le téléphone du client."""
        amount_int = int(amount)
        if amount_int < 25:
            raise HTTPException(
                status_code=400,
                detail=f"Montant minimum 25 FCFA (reçu: {amount_int})",
            )
        normalized_phone = normalize_cm_phone(phone)
        url = f"{self.base_url}/collect/"
        payload = {
            "amount": str(amount_int),
            "currency": "XAF",
            "from": normalized_phone,
            "description": description,
            "external_reference": external_reference,
        }
        return await self._request_with_retry("POST", url, payload)

    async def initiate_withdrawal(
        self,
        amount: float,
        phone: str,
        external_reference: str,
        description: str = "HEMELEY Retrait",
    ) -> dict:
        """POST /withdraw/ — Sortie d'argent vers un numéro Mobile Money."""
        amount_int = int(amount)
        if amount_int < 25:
            raise HTTPException(
                status_code=400, detail=f"Montant minimum 25 FCFA (reçu: {amount_int})"
            )
        normalized_phone = normalize_cm_phone(phone)
        url = f"{self.base_url}/withdraw/"
        payload = {
            "amount": str(amount_int),
            "currency": "XAF",
            "to": normalized_phone,
            "description": description,
            "external_reference": external_reference,
        }
        return await self._request_with_retry("POST", url, payload)

    async def get_payment_status(self, reference: str) -> dict:
        """GET /transaction/{reference}/ — Statut courant de la transaction."""
        if not reference:
            raise HTTPException(status_code=400, detail="Référence requise")
        url = f"{self.base_url}/transaction/{reference}/"
        return await self._request_with_retry("GET", url)

    def verify_webhook_signature(self, payload: str, signature: str) -> bool:
        """Vérifie le HMAC-SHA256 envoyé par CamPay dans X-Campay-Signature."""
        if not self.webhook_secret or not signature:
            return False
        expected = hmac.new(
            self.webhook_secret.encode("utf-8"),
            payload.encode("utf-8") if isinstance(payload, str) else payload,
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, signature)


campay_client = CampayClient()
