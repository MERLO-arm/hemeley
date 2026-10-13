# 💳 Guide d'Intégration CamPay API (HEMELEY 2026)

Ce document récapitule la configuration et le renforcement complet du système de paiement **CamPay API** (Mobile Money MTN & Orange Money Cameroun) sur **HEMELEY**.

---

## 1. 🔑 Identifiants & Configuration Backend (`.env`)

Les clés et identifiants fournis sont configurés dans `backend/.env` :

```env
CAMPAY_APP_ID="7cGPdVJVGqzyxD18tVgqTafTJ2ao8dznT_NRTSAMdgU74ytxP3s2HgYQ5YWiaZCnAaF2-RyhsYbXMNcyZHMzHQ"
CAMPAY_USERNAME="8PUKWcDgMsuk3XPUJWmq8nMDpL8p6XhZ_V-x35KpXtA20eStgoIItOZmtcawLoW06fCN7chsH-sSdto6EKiySA"
CAMPAY_PASSWORD="vLE9rUlVn241AsbBQYOH5_u4nSHF_Amw8K3o7GrmS2V27ibDtjz0WOwIehaDKCcvORdCRkSLxoag7R2w8evyag"
CAMPAY_TOKEN="54ef79921273a9d75155564fde0635ff5606f0f4"
CAMPAY_ACCESS_TOKEN="54ef79921273a9d75155564fde0635ff5606f0f4"
CAMPAY_WEBHOOK_KEY="tN995r3GUSwt1DgkJVY3_YD2yg4D6pwqCZbmir_khx7j9Eh8a3Ui7l3641uPwsNg-QTsGK0dBNRBDZJjGXkbfQ"
CAMPAY_WEBHOOK_SECRET="tN995r3GUSwt1DgkJVY3_YD2yg4D6pwqCZbmir_khx7j9Eh8a3Ui7l3641uPwsNg-QTsGK0dBNRBDZJjGXkbfQ"
CAMPAY_ENV="demo"
```

> **Mode Live** : Pour basculer en production réelle, remplacer simplement `CAMPAY_ENV="demo"` par `CAMPAY_ENV="live"`.

---

## 2. 🛡️ Référence & Gestion Stricte des Codes d'Erreurs

Le backend HEMELEY intègre une validation préventive locale et une traduction automatique des codes erreurs renvoyés par CamPay :

| Code d'Erreur | Cause Officielle CamPay | Validation & Message HEMELEY |
| :--- | :--- | :--- |
| **`ER101`** | Numéro invalide. Doit commencer par l'indicatif 237. | Normalisation automatique au format `237XXXXXXXXX` (12 chiffres). Si invalide, retour immédiat : *"Numéro de téléphone invalide. Assurez-vous que le numéro commence par l'indicatif pays 237 (ex: 2376XXXXXXXX)."* |
| **`ER102`** | Opérateur non supporté (seuls MTN & Orange acceptés). | Détection automatique des préfixes camerounais : MTN (`67X`, `680-683`, `650-654`) et Orange (`69X`, `655-659`). Les numéros hors MTN/Orange sont interceptés avant l'envoi API : *"Opérateur non supporté. Actuellement, seuls les numéros MTN Mobile Money et Orange Money sont acceptés."* |
| **`ER201`** | Montant invalide. Les nombres décimaux sont interdits. | Les montants sont obligatoirement convertis et vérifiés en entiers stricts (pas de centimes autorisés) : *"Montant invalide. Les nombres décimaux ne sont pas autorisés. Le montant doit être un entier sans virgule ni centimes."* |
| **`ER301`** | Solde insuffisant pour retrait/déboursement. | Traduction automatique en cas de payout supérieur au solde de compte : *"Solde insuffisant. Vous essayez de retirer un montant supérieur à votre solde disponible pour cet opérateur."* |

---

## 3. 🌐 Endpoints CamPay Déployés sur HEMELEY

### A. Vérification Titulaire du Compte (`GET /api/campay/holder_info`)
Vérifie le nom associé au numéro Mobile Money avant d'effectuer une transaction ou un retrait :
- **Route** : `GET /api/campay/holder_info?phone_number=237677777777`
- **Réponse Production** : `{"phone_number": "237677777777", "carrier": "MTN", "full_name": "JOHN DOE", "verified": true}`
- **Réponse Démo** : En environnement démo CamPay (où les requêtes télécom réelles sont désactivées), renvoie une simulation transparente sans bloquer l'expérience utilisateur.

### B. Encaissement Mobile Money (`POST /api/campay/collect`)
Déclenche la pop-up USSD sur le téléphone du client pour paiement de commande ou recharge portefeuille :
- **Payload** :
```json
{
  "amount": 2500,
  "phone": "237677777777",
  "description": "Commande HEMELEY #1042",
  "external_reference": "HEMELEY-CMD-1042"
}
```
- **Réponse** :
```json
{
  "success": true,
  "reference": "f4cc71bb-40c5-4f08-b8d1-f480290e1626",
  "ussd_code": "*126#",
  "operator": "MTN",
  "status": "PENDING"
}
```

### C. Vérification de Statut (`GET /api/campay/status/{reference}`)
Interroge le statut en direct de la transaction auprès de CamPay :
- **Statuts possibles** : `PENDING`, `SUCCESSFUL`, `FAILED`, `CANCELLED`.

### D. Déboursements Groupés / Mass Payout (`POST /api/campay/mass_payout`)
Permet de payer plusieurs vendeurs ou livreurs simultanément en une seule requête :
- **Route** : `POST /api/campay/mass_payout`
- **Payload** :
```json
{
  "comment": "Paiement des commissions Vendeurs & Livreurs",
  "mp_reference": "BATCH-PAYOUT-2026-10",
  "details": [
    {
      "phone_number": "237677777777",
      "amount": 15000,
      "description": "Retrait Vendeur Chez Tantine",
      "external_reference": "WD-VEND-01"
    },
    {
      "phone_number": "237699999999",
      "amount": 8500,
      "description": "Retrait Livreur Paul",
      "external_reference": "WD-LIV-02"
    }
  ]
}
```
- **Réponse** :
```json
{
  "reference": "db630efd-6461-4f59-aa61-f78c721d1718",
  "status": "PENDING"
}
```

### E. Suivi Paiement Groupé (`GET /api/campay/mass_payout_status/{reference}`)
Consulte l'avancement et le détail pour chaque numéro du lot.

### F. Webhook Sécurisé HMAC (`POST /api/webhooks/campay`)
- Vérifie la signature cryptographique `X-Campay-Signature` à l'aide de la clé secrète configurée.
- Traitement idempotent : protège contre les rejeux.
