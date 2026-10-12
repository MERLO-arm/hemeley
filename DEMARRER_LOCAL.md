# Guide de Démarrage en Local - HEMELEY

Le projet **HEMELEY** a été rapatrié directement depuis l'environnement distant et installé dans **D:\HEMLEY**.

---

## 1. Prérequis

- **Python 3.10+** (déjà installé)
- **Node.js v22+ & npm** (déjà installés)
- **MongoDB** (sur le port standard 27017)

---

## 2. Base de Données (MongoDB)

### Option A : Via Docker
Depuis D:\HEMLEY :
\\powershell
docker compose up -d
\
### Option B : Via MongoDB Windows (Service ou standalone)
Assurez-vous qu'une instance MongoDB écoute sur mongodb://localhost:27017.

---

## 3. Lancement du Backend (FastAPI)

Dans un terminal PowerShell :

\\powershell
cd D:\HEMLEY\backend

# Créer un environnement virtuel (recommandé)
python -m venv venv
.\venv\Scripts\Activate.ps1

# Installer les dépendances
pip install -r requirements.txt

# Lancer FastAPI
uvicorn server:app --reload --host 0.0.0.0 --port 8000
\
- **Swagger / OpenAPI** : http://localhost:8000/docs
- **API Base** : http://localhost:8000/api

---

## 4. Lancement du Frontend (React 19)

Dans un second terminal PowerShell :

\\powershell
cd D:\HEMLEY\frontend

# Installer les dépendances
npm install

# Démarrer le serveur React
npm start
\
- **Application** : http://localhost:3000
- Le fichier rontend/.env.local est déjà paramétré pour pointer sur http://localhost:8000.

---

## 5. Comptes de Test

| Rôle | Identifiant / Email | Mot de passe |
|---|---|---|
| **Client** | Téléphone : 690000001 (Pseudo : TestClient) | hemeley2024 |
| **Vendeur** | Email : endeur@hemeley.com | hemeley2024 |
| **Super Admin** | Email : dmin@hemeley.com | hemeley2024 |

---

## 6. Structure du Projet

- ackend/ : API FastAPI (Authentication JWT, Menus, Commandes, Portefeuille Wallet, Intégration CamPay, etc.)
- rontend/ : Application React (PWA, Tailwind CSS, Shadcn UI, Lucide Icons)
- memory/ : PRD et documentation fonctionnelle
- docker-compose.yml : Configuration Docker pour MongoDB
- HEMELEY_README.md : Charte graphique, architecture et détails métier
