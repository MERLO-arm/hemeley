# HEMELEY - Les saveurs qui font vibrer 😋🍛

## Vue d'ensemble

HEMELEY est une Progressive Web App (PWA) de découverte et commande de street food locale à Douala (Bonapriso, Bonanjo). La plateforme connecte les petits vendeurs de rue avec les clients locaux pour des commandes rapides et simples.

## Caractéristiques principales

### Côté Client (Sans authentification)
- ✅ **Sélection de zone** : Bonapriso ou Bonanjo
- ✅ **Menus quotidiens** : Affichage des plats disponibles (10h-15h)
- ✅ **Détails des plats** : Images, prix, ingrédients, portions restantes
- ✅ **Commande/Réservation** : Commander (100%) ou Réserver (10%)
- ✅ **Paiement** : Instructions pour Orange Money et MTN Mobile Money
- ✅ **Confirmation** : Liens WhatsApp vers le vendeur et pour partager
- ✅ **Pas d'inscription requise** : Flow rapide et simple

### Côté Vendeur (Avec authentification)
- ✅ **Inscription/Connexion** : Authentification sécurisée JWT
- ✅ **Dashboard** : Statistiques des menus et commandes
- ✅ **Gestion des menus** : Ajouter, modifier, supprimer
- ✅ **Upload d'images** : Photos des plats (compressées automatiquement)
- ✅ **Activer/Désactiver** : Contrôle de la disponibilité des menus
- ✅ **Suivi des commandes** : Liste des clients et statuts de paiement
- ✅ **Confirmation de paiement** : Marquer les commandes comme payées

## Stack Technique

### Backend
- **Framework** : FastAPI
- **Base de données** : MongoDB avec Motor (async)
- **Authentification** : JWT avec bcrypt
- **Upload d'images** : Base64 avec compression PIL
- **CORS** : Configuré pour tous les domaines

### Frontend
- **Framework** : React 19 avec React Router
- **Styling** : Tailwind CSS avec configuration personnalisée
- **UI Components** : Shadcn/ui + Lucide React pour les icônes
- **Notifications** : Sonner (toasts)
- **PWA** : Service Worker + Manifest

### Design
- **Couleurs** :
  - Primary : #FF6B00 (Piment Orange)
  - Secondary : #D92828 (Sauce Red)
  - Background : #FFF8F0 (Cassava White)
  - Text : #2D241E (Charcoal)
  - Accent : #FACC15 (Mustard Yellow)
  
- **Typographie** :
  - Headings : Bebas Neue
  - Body : Manrope
  
- **Principes** :
  - Mobile-first
  - Haute lisibilité (contraste pour usage en extérieur)
  - Optimisé bande passante faible
  - Style street food authentique

## Endpoints API

### Public
- `GET /api/` - Message de bienvenue
- `GET /api/zones` - Liste des zones (Bonapriso, Bonanjo)
- `GET /api/menus?zone=X` - Menus par zone
- `GET /api/menus/{id}` - Détail d'un menu
- `GET /api/menu-time-check` - Vérification disponibilité horaire
- `POST /api/orders` - Créer une commande (sans auth)

### Vendeur
- `POST /api/vendor/register` - Inscription
- `POST /api/vendor/login` - Connexion
- `GET /api/vendor/menus` - Mes menus (auth)
- `POST /api/vendor/menus` - Créer un menu (auth)
- `PUT /api/vendor/menus/{id}` - Modifier un menu (auth)
- `DELETE /api/vendor/menus/{id}` - Supprimer un menu (auth)
- `GET /api/vendor/orders` - Mes commandes (auth)
- `PUT /api/vendor/orders/{id}/confirm` - Confirmer paiement (auth)

## Routes Frontend

### Public
- `/` - Accueil avec sélection de zone
- `/menu/{id}` - Détail d'un menu
- `/confirmation/{id}` - Confirmation de commande

### Vendeur
- `/vendor/login` - Connexion/Inscription
- `/vendor/dashboard` - Tableau de bord
- `/vendor/add-menu` - Ajouter un menu

## Fonctionnalités PWA

### Manifest
- **Nom** : HEMELEY - Le goût du risque
- **Couleur thème** : #FF6B00
- **Mode** : Standalone
- **Orientation** : Portrait
- **Langue** : Français

### Service Worker
- Cache des assets statiques
- Stratégie cache-first pour les assets
- Network-first pour les API calls
- Gestion de mise à jour automatique

## Variables d'environnement

### Backend (.env)
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=test_database
CORS_ORIGINS=*
JWT_SECRET=hemeley_jwt_secret_2024_douala_street_food
```

### Frontend (.env)
```
REACT_APP_BACKEND_URL=https://hemeley-preview.preview.emergentagent.com
WDS_SOCKET_PORT=443
ENABLE_HEALTH_CHECK=false
```

## Déploiement

L'application est configurée pour fonctionner dans un environnement Kubernetes avec :
- Backend sur port 8001 (interne)
- Frontend sur port 3000 (interne)
- Ingress mappé avec préfixe `/api` vers le backend
- Hot reload activé pour le développement

## Prochaines étapes recommandées

### MVP+
- [ ] Intégration réelle Orange Money/MTN API
- [ ] Système de notifications push
- [ ] Géolocalisation pour distance vendeur
- [ ] Système de notation/avis
- [ ] Historique des commandes client
- [ ] Analytics vendeur (ventes, plats populaires)

### Évolutions
- [ ] Multi-langues (Anglais, autres dialectes locaux)
- [ ] Programme de fidélité
- [ ] Mode hors ligne complet
- [ ] Intégration paiement carte bancaire
- [ ] Export des données vendeur (Excel/PDF)
- [ ] Chat en temps réel client-vendeur

## Testing

Tests complets effectués avec 100% de réussite :
- ✅ Backend API (14/14 tests)
- ✅ Frontend UI flows
- ✅ Intégration backend-frontend
- ✅ PWA capabilities
- ✅ Responsive design (mobile + tablet)
- ✅ Langue française

## Support

Pour toute question ou assistance, contactez l'équipe HEMELEY.

---

**HEMELEY** - Connecter les saveurs de rue de Douala 🍛🔥
