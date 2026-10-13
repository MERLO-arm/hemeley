"""CAMPAY (Cameroon Mobile Money) client - Reinforced.

Implementation robuste utilisant httpx.Client synchrone encapsulé dans asyncio.to_thread
pour garantir une stabilité totale des connexions TLS / Cloudflare sous Windows et Linux.
Support complet des spécifications CamPay API :
- Authentification par jeton permanent (CAMPAY_TOKEN / CAMPAY_ACCESS_TOKEN) ou dynamique (/token/)
- Header exact : "Authorization: Token {token}"
- Endpoints supportés :
    * POST /collect/ (demande de paiement client Mobile Money)
    * GET  /transaction/{reference}/ (statut d'une transaction)
    * POST /withdraw/ (retrait individuel vendeur / livreur)
    * GET  /holder_info/?phone_number=... (vérification nom titulaire compte)
    * POST /mass_payout/ (paiements groupés / retraits en masse)
    * GET  /mass_payout_status/{reference}/ (statut paiement groupé)
- Gestion stricte et messages d'erreurs en Français pour les codes CamPay :
    * ER101 : Numéro de téléphone invalide (doit commencer par 237)
    * ER102 : Opérateur non supporté (seuls MTN et Orange acceptés)
    * ER201 : Montant invalide (nombres décimaux interdits, entier requis)
    * ER301 : Solde insuffisant (retrait supérieur au solde disponible)
"""

import os
import json
import logging
import asyncio
import hmac
import hashlib
from typing import Optional, List, Dict, Any
from fastapi import HTTPException
import httpx

logger = logging.getLogger(__name__)

CAMPAY_ERROR_CODES = {
    "ER101": "Numéro de téléphone invalide. Assurez-vous que le numéro commence par l'indicatif pays 237 (ex: 2376XXXXXXXX).",
    "ER102": "Opérateur non supporté. Actuellement, seuls les numéros MTN Mobile Money et Orange Money sont acceptés.",
    "ER201": "Montant invalide. Les nombres décimaux ne sont pas autorisés. Le montant doit être un entier sans virgule ni centimes.",
    "ER301": "Solde insuffisant. Vous essayez de retirer un montant supérieur à votre solde disponible pour cet opérateur.",
}


def normalize_cm_phone(phone: str) -> str:
    """Normalise un numéro camerounais au format international 237XXXXXXXXX (12 chiffres)."""
    if not phone:
        raise HTTPException(
            status_code=400,
            detail=f"ER101: {CAMPAY_ERROR_CODES['ER101']} (Numéro vide ou manquant)"
        )
    p = str(phone).strip().replace(" ", "").replace("-", "")
    if p.startswith("+"):
        p = p[1:]
    if p.startswith("00"):
        p = p[2:]
    
    if p.startswith("237") and len(p) == 12 and p.isdigit():
        return p
    
    if len(p) == 9 and p.isdigit() and p.startswith(("6", "2")):
        return "237" + p
        
    p_stripped = p.lstrip("0")
    if len(p_stripped) == 9 and p_stripped.isdigit():
        return "237" + p_stripped
        
    raise HTTPException(
        status_code=400,
        detail=f"ER101: {CAMPAY_ERROR_CODES['ER101']} (Numéro reçu: {phone})"
    )


def detect_carrier(phone: str) -> str:
    """Détecte l'opérateur Mobile Money (MTN, ORANGE, ou UNSUPPORTED)."""
    p = normalize_cm_phone(phone)
    local_part = p[3:]
    
    if len(local_part) != 9:
        return "UNSUPPORTED"
        
    prefix2 = local_part[:2]
    prefix3 = local_part[:3]
    
    if prefix2 == "67":
        return "MTN"
    if prefix3 in ("680", "681", "682", "683"):
        return "MTN"
    if prefix3 in ("650", "651", "652", "653", "654"):
        return "MTN"
        
    if prefix2 == "69":
        return "ORANGE"
    if prefix3 in ("655", "656", "657", "658", "659"):
        return "ORANGE"
        
    return "UNSUPPORTED"


def validate_payment_inputs(phone: str, amount: Any) -> tuple[str, int, str]:
    """Validation préventive stricte avant envoi à l'API CamPay."""
    if isinstance(amount, float) and not amount.is_integer():
        raise HTTPException(
            status_code=400,
            detail=f"ER201: {CAMPAY_ERROR_CODES['ER201']} (Décimales reçues: {amount})"
        )
    try:
        amt_int = int(amount)
        if amt_int <= 0:
            raise ValueError()
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=400,
            detail=f"ER201: {CAMPAY_ERROR_CODES['ER201']} (Montant invalide: {amount})"
        )

    normalized = normalize_cm_phone(phone)
    carrier = detect_carrier(normalized)
    if carrier not in ("MTN", "ORANGE"):
        raise HTTPException(
            status_code=400,
            detail=f"ER102: {CAMPAY_ERROR_CODES['ER102']} (Numéro {normalized} non reconnu MTN ou Orange)"
        )

    return normalized, amt_int, carrier


def parse_campay_error(status_code: int, raw_text: str) -> HTTPException:
    """Traduit les erreurs renvoyées par CamPay en messages clairs."""
    err_code = None
    raw_msg = raw_text
    try:
        data = json.loads(raw_text)
        err_code = data.get("error_code") or data.get("code")
        raw_msg = data.get("message") or data.get("detail") or raw_text
        if not err_code:
            for code in ("ER101", "ER102", "ER201", "ER301"):
                if code in str(data):
                    err_code = code
                    break
    except Exception:
        pass

    if err_code and err_code in CAMPAY_ERROR_CODES:
        explanation = CAMPAY_ERROR_CODES[err_code]
        status = 402 if err_code == "ER301" else 400
        return HTTPException(
            status_code=status,
            detail=f"{err_code}: {explanation} ({raw_msg})"
        )

    return HTTPException(
        status_code=502 if status_code >= 500 else 400,
        detail=f"Erreur CamPay ({status_code}): {raw_msg}"
    )


class CampayClient:
    def __init__(self):
        self._dynamic_token: Optional[str] = None

    @property
    def app_id(self) -> Optional[str]:
        return os.environ.get("CAMPAY_APP_ID")

    @property
    def username(self) -> Optional[str]:
        return os.environ.get("CAMPAY_USERNAME")

    @property
    def password(self) -> Optional[str]:
        return os.environ.get("CAMPAY_PASSWORD")

    @property
    def permanent_token(self) -> Optional[str]:
        return os.environ.get("CAMPAY_TOKEN") or os.environ.get("CAMPAY_ACCESS_TOKEN")

    @property
    def webhook_secret(self) -> Optional[str]:
        return os.environ.get("CAMPAY_WEBHOOK_KEY") or os.environ.get("CAMPAY_WEBHOOK_SECRET")

    @property
    def env(self) -> str:
        return os.environ.get("CAMPAY_ENV", "demo")

    @property
    def base_url(self) -> str:
        return (
            "https://demo.campay.net/api"
            if self.env == "demo"
            else "https://campay.net/api"
        )

    # ---------- Gestion des Jetons (Token Management) ----------
    def _sync_fetch_dynamic_token(self) -> str:
        """Récupération synchrone du jeton JWT."""
        if not self.username or not self.password:
            raise HTTPException(
                status_code=500,
                detail="CAMPAY_USERNAME / CAMPAY_PASSWORD non configurés dans le backend.",
            )
        url = f"{self.base_url}/token/"
        payload = {"username": self.username, "password": self.password}
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "HEMELEY-App/1.0 (MobileMoney-Payment-Client)"
        }
        with httpx.Client(timeout=25) as client:
            resp = client.post(url, json=payload, headers=headers)
            if resp.status_code >= 400:
                logger.error(f"CamPay /token/ failed: {resp.status_code} {resp.text[:300]}")
                raise parse_campay_error(resp.status_code, resp.text)
            data = resp.json()
            token = data.get("token") or data.get("access_token")
            if not token:
                raise HTTPException(status_code=502, detail="CamPay: Jeton absent de la réponse d'authentification.")
            self._dynamic_token = token
            return token

    async def _fetch_dynamic_token(self) -> str:
        return await asyncio.to_thread(self._sync_fetch_dynamic_token)

    async def _get_token(self, force_refresh: bool = False) -> str:
        """Retourne le jeton permanent en priorité, ou un jeton dynamique régénéré."""
        if not force_refresh and self.permanent_token:
            return self.permanent_token
        if not force_refresh and self._dynamic_token:
            return self._dynamic_token
        return await self._fetch_dynamic_token()

    def _headers(self, token: str) -> dict:
        """Header exact requis par CamPay: 'Authorization: Token {token}'."""
        return {
            "Authorization": f"Token {token}",
            "Content-Type": "application/json",
            "User-Agent": "HEMELEY-App/1.0 (MobileMoney-Payment-Client)",
        }

    def _sync_request(self, method: str, url: str, token: str, json_body: Optional[dict], params: Optional[dict]):
        with httpx.Client(timeout=30) as client:
            if method.upper() == "GET":
                return client.get(url, params=params, headers=self._headers(token))
            return client.post(url, json=json_body or {}, headers=self._headers(token))

    async def _request_with_retry(
        self, method: str, url: str, json_body: Optional[dict] = None, params: Optional[dict] = None
    ) -> dict:
        """Exécute une requête avec retry et rafraîchissement automatique."""
        last_error = None
        for attempt in (1, 2, 3):
            token = await self._get_token(force_refresh=(attempt > 1 and not self.permanent_token))
            try:
                resp = await asyncio.to_thread(
                    self._sync_request, method, url, token, json_body, params
                )

                if resp.status_code in (401, 403) and attempt == 1:
                    logger.warning(f"CamPay {method} {url} -> {resp.status_code}, rafraîchissement token...")
                    await asyncio.sleep(0.3)
                    continue

                if resp.status_code >= 400:
                    logger.error(f"CamPay {method} {url} -> {resp.status_code} {resp.text[:300]}")
                    raise parse_campay_error(resp.status_code, resp.text)

                return resp.json()
            except HTTPException:
                raise
            except Exception as e:
                last_error = e
                logger.warning(f"CamPay tentative {attempt} échouée ({e}), nouvelle tentative...")
                await asyncio.sleep(0.6)

        if last_error:
            raise HTTPException(status_code=502, detail=f"Échec de communication CamPay: {last_error}")
        raise HTTPException(status_code=502, detail="Échec CamPay après retry")

    # ---------- Endpoints Publics CamPay ----------

    async def get_holder_info(self, phone: str) -> dict:
        """GET /holder_info/?phone_number=237XXXXXXXX
        
        Permet de vérifier le nom complet associé à un numéro Mobile Money
        (MTN Mobile Money ou Orange Money).
        """
        normalized_phone = normalize_cm_phone(phone)
        carrier = detect_carrier(normalized_phone)
        url = f"{self.base_url}/holder_info/"
        params = {"phone_number": normalized_phone}

        token = await self._get_token()
        try:
            resp = await asyncio.to_thread(self._sync_request, "GET", url, token, None, params)
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "phone_number": normalized_phone,
                    "carrier": carrier,
                    "full_name": data.get("full_name", "TITULAIRE CONFIRMÉ"),
                    "verified": True,
                    "demo_mode": False
                }
            elif resp.status_code == 401 and "not allowed on Demo" in resp.text:
                return {
                    "phone_number": normalized_phone,
                    "carrier": carrier,
                    "full_name": f"COMPTE TEST {carrier} ({normalized_phone[-4:]})",
                    "verified": True,
                    "demo_mode": True,
                    "message": "Vérification titulaire simulée (environnement CamPay Démo)"
                }
            elif resp.status_code >= 400:
                raise parse_campay_error(resp.status_code, resp.text)
        except HTTPException:
            raise
        except Exception as e:
            if self.env == "demo":
                return {
                    "phone_number": normalized_phone,
                    "carrier": carrier,
                    "full_name": f"COMPTE TEST {carrier} ({normalized_phone[-4:]})",
                    "verified": True,
                    "demo_mode": True,
                    "message": "Mode démo actif"
                }
            raise HTTPException(status_code=502, detail=f"Erreur vérification titulaire: {e}")

    async def initiate_payment(
        self,
        amount: Any,
        phone: str,
        external_reference: str,
        description: str = "HEMELEY Commande",
    ) -> dict:
        """POST /collect/ - Déclenche une demande Mobile Money USSD sur le téléphone du client."""
        normalized_phone, amount_int, carrier = validate_payment_inputs(phone, amount)

        # En environnement démo CamPay, le montant max de test est 25 FCFA
        if self.env == "demo" and amount_int > 25:
            logger.info(f"Mode démo CamPay détecté: montant ajusté de {amount_int} à 25 FCFA pour le test API")
            amount_to_send = 25
        else:
            amount_to_send = amount_int

        url = f"{self.base_url}/collect/"
        payload = {
            "amount": str(amount_to_send),
            "currency": "XAF",
            "from": normalized_phone,
            "description": description[:100],
            "external_reference": external_reference,
        }
        res = await self._request_with_retry("POST", url, payload)
        res["operator"] = carrier
        res["validated_phone"] = normalized_phone
        return res

    async def initiate_withdrawal(
        self,
        amount: Any,
        phone: str,
        external_reference: str,
        description: str = "HEMELEY Retrait",
    ) -> dict:
        """POST /withdraw/ - Déboursement / Retrait d'argent vers un compte Mobile Money."""
        normalized_phone, amount_int, carrier = validate_payment_inputs(phone, amount)

        if self.env == "demo" and amount_int > 25:
            amount_to_send = 25
        else:
            amount_to_send = amount_int

        url = f"{self.base_url}/withdraw/"
        payload = {
            "amount": str(amount_to_send),
            "currency": "XAF",
            "to": normalized_phone,
            "description": description[:100],
            "external_reference": external_reference,
        }
        res = await self._request_with_retry("POST", url, payload)
        res["operator"] = carrier
        res["validated_phone"] = normalized_phone
        return res

    async def get_payment_status(self, reference: str) -> dict:
        """GET /transaction/{reference}/ - Vérifie le statut d'une transaction."""
        if not reference:
            raise HTTPException(status_code=400, detail="Référence CamPay requise")
        url = f"{self.base_url}/transaction/{reference}/"
        return await self._request_with_retry("GET", url)

    async def initiate_mass_payout(
        self,
        details: List[Dict[str, Any]],
        comment: str = "HEMELEY Mass Payout",
        mp_reference: str = "",
    ) -> dict:
        """POST /mass_payout/ - Envoi de paiements multiples groupés en une seule requête."""
        if not details:
            raise HTTPException(status_code=400, detail="La liste des bénéficiaires ne peut pas être vide")

        formatted_details = []
        for idx, item in enumerate(details):
            phone = item.get("phone_number") or item.get("phone")
            amt = item.get("amount")
            desc = item.get("description", f"Paiement #{idx+1}")
            ext_ref = item.get("external_reference", f"WD-{idx+1}")

            norm_phone, norm_amt, carrier = validate_payment_inputs(phone, amt)
            if self.env == "demo" and norm_amt > 25:
                norm_amt = 10

            formatted_details.append({
                "phone_number": norm_phone,
                "amount": str(norm_amt),
                "description": desc[:100],
                "external_reference": str(ext_ref),
            })

        url = f"{self.base_url}/mass_payout/"
        payload = {
            "comment": comment[:100],
            "mp_reference": mp_reference or f"MP-{os.urandom(4).hex()}",
            "details": formatted_details,
        }
        return await self._request_with_retry("POST", url, payload)

    async def get_mass_payout_status(self, reference: str) -> dict:
        """GET /mass_payout_status/{reference}/ - Suivi du traitement d'un paiement de masse."""
        if not reference:
            raise HTTPException(status_code=400, detail="Référence de mass payout requise")
        url = f"{self.base_url}/mass_payout_status/{reference}/"
        return await self._request_with_retry("GET", url)

    def verify_webhook_signature(self, payload: str, signature: str) -> bool:
        """Vérifie l'authenticité de la signature HMAC-SHA256 envoyée dans X-Campay-Signature."""
        if not self.webhook_secret or not signature:
            logger.warning("Vérification webhook: clé secrète ou signature manquante")
            return False
        expected = hmac.new(
            self.webhook_secret.encode("utf-8"),
            payload.encode("utf-8") if isinstance(payload, str) else payload,
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, signature)


campay_client = CampayClient()
