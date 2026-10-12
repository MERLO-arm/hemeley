# HEMELEY Phase 2 - Guide d'Implémentation Frontend

## ✅ Complété Backend

### 1. Système de Fidélité "HEMELEY VIP"
- **Condition** : 5 commandes payées avec succès
- **Avantages** : 
  - Badge VIP 👑
  - 10% de réduction automatique
  - Priorité portions limitées (à implémenter)
  
**Endpoint** : `GET /api/orders/customer/loyalty-status?phone={phone}`

**Réponse** :
```json
{
  "phone": "237699123456",
  "order_count": 3,
  "is_vip": false,
  "orders_until_vip": 2,
  "discount_percentage": 0
}
```

### 2. CAMPAY SDK Setup
- Script tag ajouté dans `index.html`
- Variables d'environnement configurées
- Endpoints backend prêts

### 3. Cart Context
- `CartContext.js` créé
- Persistance localStorage
- Méthodes : addToCart, removeFromCart, updateQuantity, clearCart, getItemCount

## 🔄 À Implémenter Frontend

### Étape 1 : Cart UI (Urgent)

**Composants à ajouter dans App.js** :

```javascript
import { useCart } from './CartContext';
import { ShoppingCart, Plus, Minus, X, Crown } from 'lucide-react';

// 1. CartButton (FAB en bas à droite)
const CartButton = ({ onClick }) => {
  const { getItemCount } = useCart();
  const itemCount = getItemCount();

  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 bg-primary text-white rounded-full w-16 h-16 flex items-center justify-center shadow-2xl hover:scale-110 z-40"
      data-testid="cart-fab"
    >
      <ShoppingCart size={28} />
      {itemCount > 0 && (
        <span className="absolute -top-2 -right-2 bg-secondary text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
          {itemCount}
        </span>
      )}
    </button>
  );
};

// 2. CartModal
const CartModal = ({ isOpen, onClose }) => {
  const { cart, updateQuantity, removeFromCart, clearCart } = useCart();
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b p-4 flex justify-between">
          <h2 className="font-heading text-2xl">Mon Panier 🛒</h2>
          <button onClick={onClose}><X size={24} /></button>
        </div>

        {/* Items */}
        <div className="p-6">
          {cart.items.map(item => (
            <div key={item.menu_id} className="flex gap-4 mb-4">
              {/* Item card avec quantité +/- */}
            </div>
          ))}
          
          {/* Total */}
          <div className="border-t pt-4">
            <p className="font-bold">Total: {cart.total.toLocaleString()} FCFA</p>
          </div>

          {/* Actions */}
          <button onClick={() => navigate('/checkout')} className="w-full bg-primary text-white rounded-full py-3 mt-4">
            Commander
          </button>
        </div>
      </div>
    </div>
  );
};
```

**Modifier HomePage** :
```javascript
const HomePage = () => {
  const [showCart, setShowCart] = useState(false);
  const { addToCart } = useCart();

  const handleAddToCart = (menu, e) => {
    e.stopPropagation();
    addToCart(menu, 1);
  };

  return (
    <>
      {/* ... existing code ... */}
      
      {/* Sur chaque menu card, remplacer le bouton HEMELEY par : */}
      <button
        onClick={(e) => handleAddToCart(menu, e)}
        className="w-full bg-primary text-white rounded-full py-3"
      >
        <ShoppingCart size={20} className="inline mr-2" />
        Ajouter au panier
      </button>

      <CartButton onClick={() => setShowCart(true)} />
      <CartModal isOpen={showCart} onClose={() => setShowCart(false)} />
    </>
  );
};
```

### Étape 2 : Checkout avec CAMPAY

**Page Checkout** :
```javascript
const CheckoutPage = () => {
  const { cart, clearCart } = useCart();
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    payment_method: 'orange'
  });
  const [loyaltyStatus, setLoyaltyStatus] = useState(null);

  useEffect(() => {
    // Load CAMPAY SDK
    const campayScript = document.getElementById('campay-sdk');
    if (!campayScript.src) {
      campayScript.src = 'https://demo.campay.net/sdk/js?app-id=YOUR_APP_ID';
    }
  }, []);

  useEffect(() => {
    if (formData.customer_phone && formData.customer_phone.length >= 9) {
      checkLoyaltyStatus();
    }
  }, [formData.customer_phone]);

  const checkLoyaltyStatus = async () => {
    try {
      const response = await axios.get(`${API}/orders/customer/loyalty-status`, {
        params: { phone: formData.customer_phone }
      });
      setLoyaltyStatus(response.data);
    } catch (error) {
      console.error('Error checking loyalty:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 1. Créer la commande
    const orderData = {
      customer_name: formData.customer_name,
      customer_phone: formData.customer_phone,
      customer_email: formData.customer_email,
      items: cart.items,
      vendor_id: cart.items[0].vendor_id,
      zone: cart.items[0].zone,
      payment_method: formData.payment_method
    };

    const orderResponse = await axios.post(`${API}/orders`, orderData);
    const order = orderResponse.data;

    // 2. Initier paiement CAMPAY
    const paymentResponse = await axios.post(`${API}/payments/campay/initiate`, {
      order_id: order.id,
      amount: order.total,
      customer_phone: formData.customer_phone
    });

    // 3. Ouvrir widget CAMPAY
    if (window.campay) {
      window.campay.options({
        payButtonId: 'campay-pay-button',
        description: `Commande HEMELEY #${order.order_number}`,
        amount: order.total,
        currency: 'XAF',
        externalReference: paymentResponse.data.reference,
        redirectUrl: `${window.location.origin}/payment-return`
      });

      window.campay.onSuccess = (data) => {
        clearCart();
        navigate(`/confirmation/${order.id}`);
      };

      window.campay.onFail = (data) => {
        toast.error('Paiement échoué');
      };
    }
  };

  return (
    <div className="min-h-screen p-6">
      <h1 className="font-heading text-3xl mb-6">Finaliser la commande</h1>

      {/* Badge VIP */}
      {loyaltyStatus?.is_vip && (
        <div className="bg-accent/20 border-2 border-accent rounded-xl p-4 mb-6 flex items-center gap-3">
          <Crown size={32} className="text-accent" />
          <div>
            <p className="font-heading text-lg">HEMELEY VIP 👑</p>
            <p className="font-body text-sm text-text-muted">-10% sur cette commande !</p>
          </div>
        </div>
      )}

      {!loyaltyStatus?.is_vip && loyaltyStatus?.orders_until_vip > 0 && (
        <div className="bg-primary/10 rounded-xl p-4 mb-6">
          <p className="font-body text-sm">
            Plus que {loyaltyStatus.orders_until_vip} commande{loyaltyStatus.orders_until_vip > 1 ? 's' : ''} pour devenir VIP ! 🎉
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Form fields */}
        <button type="submit" id="campay-pay-button" className="w-full bg-primary text-white rounded-full py-4">
          Payer {cart.total.toLocaleString()} FCFA
        </button>
      </form>
    </div>
  );
};
```

### Étape 3 : Dashboard Livreur

**Routes à ajouter** :
```javascript
<Route path="/delivery/login" element={<DeliveryLoginPage />} />
<Route path="/delivery/dashboard" element={<DeliveryDashboardPage />} />
```

**DeliveryDashboardPage** :
```javascript
const DeliveryDashboardPage = () => {
  const [deliveries, setDeliveries] = useState([]);
  const [stats, setStats] = useState(null);
  const [isAvailable, setIsAvailable] = useState(true);

  useEffect(() => {
    fetchDeliveries();
    fetchStats();
    startLocationTracking();
  }, []);

  const fetchDeliveries = async () => {
    const token = localStorage.getItem('delivery_token');
    const response = await axios.get(`${API}/delivery/my-deliveries`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setDeliveries(response.data);
  };

  const fetchStats = async () => {
    const token = localStorage.getItem('delivery_token');
    const response = await axios.get(`${API}/delivery/stats`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setStats(response.data);
  };

  const startLocationTracking = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.watchPosition(async (position) => {
        const token = localStorage.getItem('delivery_token');
        await axios.put(`${API}/delivery/update-location`, {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      });
    }
  };

  const toggleAvailability = async () => {
    const token = localStorage.getItem('delivery_token');
    await axios.put(`${API}/delivery/toggle-availability`, {
      is_available: !isAvailable
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setIsAvailable(!isAvailable);
  };

  return (
    <div className="min-h-screen p-6">
      <div className="bg-primary text-white p-6 rounded-2xl mb-6">
        <h1 className="font-heading text-3xl mb-4">Dashboard Livreur 🚚</h1>
        
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white/20 rounded-xl p-4 text-center">
            <Package size={32} className="mx-auto mb-2" />
            <p className="text-2xl font-bold">{stats?.total_deliveries || 0}</p>
            <p className="text-sm">Livraisons</p>
          </div>
          <div className="bg-white/20 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold">{stats?.total_earnings?.toLocaleString() || 0}</p>
            <p className="text-sm">FCFA gagnés</p>
          </div>
          <div className="bg-white/20 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold">{stats?.pending_deliveries || 0}</p>
            <p className="text-sm">En cours</p>
          </div>
        </div>

        <button
          onClick={toggleAvailability}
          className={`w-full mt-4 py-3 rounded-full font-bold ${
            isAvailable ? 'bg-success' : 'bg-stone-400'
          }`}
        >
          {isAvailable ? '✅ Disponible' : '⏸️ Indisponible'}
        </button>
      </div>

      <h2 className="font-heading text-2xl mb-4">Livraisons en cours</h2>
      {deliveries.filter(d => ['ready', 'in_delivery'].includes(d.order_status)).map(delivery => (
        <div key={delivery.id} className="bg-white rounded-xl p-4 mb-4 border">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="font-heading text-xl">#{delivery.order_number}</p>
              <p className="text-sm text-text-muted">{delivery.customer_name}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm ${
              delivery.order_status === 'ready' ? 'bg-accent/20 text-accent-foreground' : 'bg-primary/20 text-primary'
            }`}>
              {delivery.order_status === 'ready' ? 'Prêt' : 'En livraison'}
            </span>
          </div>

          <div className="space-y-2 mb-4">
            <p className="text-sm"><MapPin size={16} className="inline mr-2" />{delivery.customer_address || 'Adresse non fournie'}</p>
            <p className="text-sm"><Phone size={16} className="inline mr-2" />{delivery.customer_phone}</p>
            {delivery.distance_km && (
              <p className="text-sm">📍 Distance: {delivery.distance_km} km</p>
            )}
          </div>

          <div className="flex gap-2">
            {delivery.order_status === 'ready' && (
              <button
                onClick={() => updateStatus(delivery.id, 'in_delivery')}
                className="flex-1 bg-primary text-white rounded-full py-2 font-medium"
              >
                Commencer la livraison
              </button>
            )}
            {delivery.order_status === 'in_delivery' && (
              <button
                onClick={() => updateStatus(delivery.id, 'delivered')}
                className="flex-1 bg-success text-white rounded-full py-2 font-medium"
              >
                <CheckCircle size={20} className="inline mr-2" />
                Marquer comme livré
              </button>
            )}
            <a
              href={`tel:${delivery.customer_phone}`}
              className="px-4 py-2 border-2 border-primary text-primary rounded-full font-medium"
            >
              <Phone size={20} />
            </a>
          </div>
        </div>
      ))}
    </div>
  );
};
```

## 🔧 Installation Finale

1. Redémarrer frontend après modifications
2. Tester le flow complet :
   - Ajouter au panier
   - Checkout
   - Paiement CAMPAY (demo)
   - Confirmation
3. Tester dashboard livreur

## 📝 Variables d'environnement à configurer

Mettre les vraies valeurs CAMPAY dans `/app/backend/.env` :
```
CAMPAY_APP_ID=your_real_app_id
CAMPAY_USERNAME=your_username
CAMPAY_PASSWORD=your_password
CAMPAY_ACCESS_TOKEN=your_access_token
CAMPAY_WEBHOOK_SECRET=your_webhook_secret
```
