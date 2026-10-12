# HEMELEY - PRD

## Problem Statement
PWA "HEMELEY" — food discovery and ordering for street food in Douala, Cameroon.

## Completed Features
1. **Homepage (Uber Eats style)**: Hero slideshow, 10 quartiers, 6 categories, sort/filter, search, prix barrés, certified badges, ratings
2. **Header/Footer**: "Connexion" button, Footer with vendor/delivery links
3. **AI Chatbot HEME**: GPT-4o-mini via Emergent LLM
4. **Vendor Profile Page (Alibaba-style)**: Standing, verification badges, stats, reviews, menu grid
5. **Vendor Dashboard 2026**: Plats, Orders, **Wallet**, Messages, QR, Analytics, Reviews, Settings
6. **Customer Space**: Profile, settings, orders, **Wallet**, referrals, loyalty
7. **Super Admin**: Accounts, loyalty rules, time promos, bulk import, **Finance**
8. **Menu Creation**: Category, prix barré, discount, visibility dates, 10 zones
9. **Checkout**: Auto-fill, geolocation, multi-payment (Orange Money, MTN, **Wallet HEMELEY**)
10. **Delivery Dashboard**: orders + **Wallet**
11. **Wallet & CAMPAY Phase 1+2 (Feb 2026)**: HMAC-secured ledger, CAMPAY recharge, webhook verifier, withdrawals with manual super-admin approval, freeze. **25/25 tests** (iter 8).
12. **Wallet & Escrow Phase 3 (Feb 2026)**: Order lifecycle wired — wallet payment requires JWT, escrow held at checkout, auto-split on delivery (15% commission + delivery_fee + vendor share), refund on cancel. **39/39 tests** (iter 9).
13. **Wallet UI Phase 4 (Feb 2026)**: Complete UI in 4 dashboards (Customer/Vendor/Delivery/Admin). **54/54 frontend assertions** (iter 10).
14. **Refactor App.js (May 2026)**: 4 components extracted to `/pages/`: OrderModal, CheckoutPage, DeliveryLoginPage, AdminDashboardPage. Shared utilities in `MapUtils.js`. **App.js: 4326 → 2258 lignes (-48%)**. **Critical bug fixed**: 12 duplicate `<Toaster>` instances were causing `removeChild` NotFoundError on route navigation — now exactly 1 global Toaster. Cleaned all test/seed data from MongoDB. **100% iter 11 tests** — 0 pageerrors across 7 routes + 23 tab clicks.

14. **CamPay Checkout réécrit (Feb 2026)**: Intégration via `httpx` pur — SDK pip abandonné. Endpoints `POST /api/campay/collect` + `GET /api/campay/status/{reference}`. Token strategy : permanent + fallback dynamique via `POST /token/` avec retry auto sur 401/403. Header exact `Authorization: Token {token}`. Validations : amount entier ≥ 25 FCFA, phone normalisé `237XXXXXXXXX`. Bug fix critique : `load_dotenv` timing résolu via lazy `@property`. **Frontend** : `clearCart()` UNIQUEMENT sur statut CamPay strictement `SUCCESSFUL` (panier conservé sur échec → bouton "Réessayer" fonctionne). Polling 3s × 60 = 3 min timeout. **11/12 tests** (iter 12).

15. **React bugs critiques (Feb 2026)**: 2 erreurs runtime résolues. (a) `/payment-success` *Maximum update depth exceeded* : `useEffect` avait `[clearCart]` comme deps, or `clearCart` était recréé à chaque render de `CartProvider` → boucle infinie. Fix : `useRef` guard + `deps=[]`. (b) `/checkout` *insertBefore NotFoundError* : `clearCart()` appelé synchrone juste avant `navigate()` → race DOM. Fix : retrait du `clearCart` côté CheckoutPage, délégué à PaymentSuccessPage après montage. **Défense en profondeur** : `clearCart` wrapped dans `useCallback` au niveau `CartContext`. Grep gate `<Toaster` = 1 ✅.

16. **Module Analytiques Vendeur nouvelle génération (Feb 2026)**: Refonte complète niveau Deliveroo Business. Nouveaux endpoints `/api/vendor/analytics` (KPI + timeline + top/bottom 5 + boissons + heatmap 7×24 + best day/hour + Menu Engineering 4 quadrants + customers new/returning + wallet + projection + alertes auto) et `/api/vendor/analytics/export` (PDF reportlab avec logo + brand color). Nouveau composant `VendorAnalyticsTab.js` avec filtres sticky (période today/7d/30d/month/custom + catégorie), skeleton loaders, états vides propres, export CSV par widget, deltas vs période précédente. **Nouveau champ** `Menu.cost_price` pour calcul marge (matrice Menu Engineering). Section Paramètres `/vendor/dashboard`: composant `VendorProfileBranding` (upload logo 2 Mo max + color picker + hex input + preview). Logo affiché dans header dashboard + `RestaurantPage` + `VendorProfilePage` + PDF export. **Bug fix bonus**: `load_dotenv()` déplacé AVANT les imports de routes (résout mismatch JWT_SECRET entre `auth.py` et `routes_customer.py` — customer token → vendor endpoint retourne maintenant 403 au lieu de 401). `routes_menu.create_menu()` passe maintenant `cost_price` au constructeur Menu (avant : silently dropped). **13/13 tests backend passés** après fixes (iter 13).

17. **Catégorisation + Photos couverture (Feb 2026)** : Nouveaux champs `Vendor.cover_photos` (max 3 data URLs) et `Vendor.custom_categories` (max 12 libellés, isolés par vendor). Validation stricte `Menu.category` : catégories de base `{entree, plat, boisson, dessert, petit-dejeuner, snack, autre}` + custom du vendor (case-insensitive, libellé d'origine préservé). Migration one-shot : 9 menus orphelins (`category=null`) → `"plat"` par défaut. Endpoint étendu `PATCH /api/vendor/profile/branding` (fusion atomique : logo + brand_color + cover_photos + custom_categories). Nouveau `GET /api/vendor/me` (rafraîchit le vendor localStorage). Nouveaux composants partagés `CoverCarousel` (autoplay 5s, dots, swipe, empty state avec logo fallback) et `CategorizedMenuList` (onglets horizontaux scrollables + section headers + search bar seuil 10 plats). **Intégrés sur les 3 pages publiques** (`/menu/:slug` PublicMenuPage, `/restaurant/:id` RestaurantPage→VendorProfilePage, `/vendeur/:id` VendorProfilePage). **Bug fix bonus critique** : `public_router` n'était jamais enregistré dans `server.py` (feature `/api/public/*` orpheline) — corrigé + ajout des modèles Pydantic `PartnershipRequest`/`PartnershipRequestCreate`. Route `/menu/:id` (détail plat) renommée en `/plat/:id` pour libérer `/menu/:slug`. Vendor `armel-resto` seedé avec slug. **16/17 tests backend passés** (iter 14) + smoke test frontend validé sur les 3 pages.

## Pending
### P1
- [ ] Vendor subscription billing automation
- [ ] Apply promotions to checkout
- [ ] Real-time notifications (WebSockets) sur événements paiement
- [ ] AdminDashboardPage.js (1118 lines) — extraire les sous-panneaux Vendeurs/Livreurs/Commandes/Clients/Settings

### P2
- [ ] Cashback automatique sur orders livrées
- [ ] Bouton "1-clic" wallet depuis fiche plat
- [ ] PDF/Excel export des transactions
- [ ] Email/SMS notifications (Twilio/SendGrid)
- [ ] Geolocation delivery tracking
- [ ] Table Reservation (QR codes)
- [ ] CI grep gate: `grep -r '<Toaster' src/ | wc -l` doit valoir 1
- [ ] Ajouter `data-testid` sur les onglets clients pour tests robustes

## Architecture
### Backend
- `/app/backend/wallet_models.py`, `wallet_security.py`, `wallet_service.py`, `routes_wallet.py`, `routes_admin_wallet.py`, `routes_order.py`, `campay.py`

### Frontend
- `/app/frontend/src/App.js` (2258 lignes — réduit) — racine + routes + 1 seul Toaster global
- `/app/frontend/src/MapUtils.js` — API + LocationPickerMap + customIcon + DOUALA_CENTER (partagé)
- `/app/frontend/src/pages/OrderModal.js` (191 lignes)
- `/app/frontend/src/pages/CheckoutPage.js` (606 lignes)
- `/app/frontend/src/pages/DeliveryLoginPage.js` (190 lignes)
- `/app/frontend/src/pages/AdminDashboardPage.js` (1118 lignes — à raffiner P1)
- `/app/frontend/src/CustomerSpace.js`, `/app/frontend/src/VendorDashboard2026.js`, `/app/frontend/src/AdminFinancePanel.js`, `/app/frontend/src/WalletComponents.js`

### DB
- `wallets`, `wallet_transactions`, `wallet_audit_logs`, `recharge_requests`, `withdrawal_requests` (toutes nettoyées de données test en mai 2026)
