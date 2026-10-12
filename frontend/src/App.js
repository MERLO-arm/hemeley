import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Clock, MapPin, User, Phone, Mail, ChevronLeft, Plus, LogOut, Eye, EyeOff, ShoppingCart, Minus, X, Crown, Truck, Package, CheckCircle, Search, Navigation, AlertCircle, RefreshCw, Star, Timer, Route as RouteIcon, Check } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { useCart } from './CartContext';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@/App.css';
import ModernHomePage from './ModernHomePage';
import HemeleyLandingPage from './HemeleyLandingPage';
import HemeleyLogo from './HemeleyLogo';
import useWalletNotifications from './useWalletNotifications';
import VendorDashboard2026 from './VendorDashboard2026';
import VendorLandingPage from './VendorLandingPage';
import RestaurantPage from './RestaurantPage';
import VendorProfilePage from './VendorProfilePage';
import { CustomerLoginPage, CustomerDashboard, CustomerMessagesPage } from './CustomerSpace';
import { WalletCard, WithdrawalModal, TransactionsList, WithdrawalsList } from './WalletComponents';
import AdminFinancePanel from './AdminFinancePanel';
import OrderModal from './pages/OrderModal';
import CheckoutPage from './pages/CheckoutPage';
import DeliveryLoginPage from './pages/DeliveryLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import PaymentStatusPage from './pages/PaymentStatusPage';
import PublicMenuPage from './pages/PublicMenuPage';

// Fix Leaflet default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom marker icon
const customIcon = new L.Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
const API = `${BACKEND_URL}/api`;

// Douala center coordinates
const DOUALA_CENTER = [4.0511, 9.7679];

// ==================== LOCATION PICKER MAP ====================
const LocationPickerMap = ({ position, setPosition, onAddressChange }) => {
  const MapClickHandler = () => {
    useMapEvents({
      click: async (e) => {
        const { lat, lng } = e.latlng;
        setPosition([lat, lng]);
        // Reverse geocoding to get address
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
          const data = await response.json();
          if (data.display_name) {
            onAddressChange(data.display_name);
          }
        } catch (error) {
          console.error('Error getting address:', error);
        }
      }
    });
    return null;
  };

  const RecenterMap = ({ position }) => {
    const map = useMap();
    useEffect(() => {
      if (position) {
        map.setView(position, 16);
      }
    }, [position, map]);
    return null;
  };

  return (
    <MapContainer
      center={position || DOUALA_CENTER}
      zoom={14}
      style={{ height: '300px', width: '100%', borderRadius: '16px' }}
      className="z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {position && <Marker position={position} icon={customIcon} />}
      <MapClickHandler />
      <RecenterMap position={position} />
    </MapContainer>
  );
};

// ==================== CART BUTTON ====================
const CartButton = ({ onClick }) => {
  const { getItemCount } = useCart();
  const itemCount = getItemCount();

  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 bg-primary text-white rounded-full w-16 h-16 flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-transform z-40"
      data-testid="cart-fab"
    >
      <ShoppingCart size={28} />
      {itemCount > 0 && (
        <span className="absolute -top-2 -right-2 bg-secondary text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm" data-testid="cart-badge">
          {itemCount}
        </span>
      )}
    </button>
  );
};

// ==================== CART MODAL ====================
const CartModal = ({ isOpen, onClose }) => {
  const { cart, updateQuantity, removeFromCart, clearCart } = useCart();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleCheckout = () => {
    if (cart.items.length === 0) {
      toast.error('Votre panier est vide');
      return;
    }
    onClose();
    navigate('/checkout');
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4" data-testid="cart-modal">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-stone-200 p-4 flex items-center justify-between">
          <h2 className="font-heading text-2xl text-text" data-testid="cart-title">Mon Panier 🛒</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text" data-testid="close-cart-btn">
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          {cart.items.length === 0 ? (
            <div className="text-center py-12" data-testid="empty-cart">
              <ShoppingCart size={64} className="mx-auto text-stone-300 mb-4" />
              <p className="font-body text-text-muted">Votre panier est vide</p>
            </div>
          ) : (
            <>
              <div className="space-y-4 mb-6">
                {cart.items.map(item => (
                  <div key={item.menu_id} className="flex gap-4 bg-stone-50 rounded-xl p-4" data-testid={`cart-item-${item.menu_id}`}>
                    <div className="w-20 h-20 bg-stone-200 rounded-lg overflow-hidden flex-shrink-0">
                      {item.image_base64 ? (
                        <img src={item.image_base64} alt={item.menu_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl">🍛</div>
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="font-body font-bold text-text mb-1">{item.menu_name}</h3>
                      <p className="font-body text-sm text-text-muted mb-2">{item.vendor_name}</p>
                      <p className="font-body text-primary font-bold">{item.price.toLocaleString()} FCFA</p>
                    </div>

                    <div className="flex flex-col items-end justify-between">
                      <button
                        onClick={() => removeFromCart(item.menu_id)}
                        className="text-secondary hover:text-secondary/80"
                        data-testid={`remove-item-${item.menu_id}`}
                      >
                        <X size={20} />
                      </button>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.menu_id, item.quantity - 1)}
                          className="w-8 h-8 rounded-full bg-white border-2 border-stone-200 flex items-center justify-center hover:border-primary"
                          data-testid={`decrease-qty-${item.menu_id}`}
                        >
                          <Minus size={16} />
                        </button>
                        <span className="font-body font-bold w-8 text-center" data-testid={`qty-${item.menu_id}`}>{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.menu_id, item.quantity + 1)}
                          className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center hover:scale-105"
                          data-testid={`increase-qty-${item.menu_id}`}
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      
                      <p className="font-body font-bold text-text mt-2">{item.subtotal.toLocaleString()} FCFA</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-stone-200 pt-4 mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-body text-text-muted">Sous-total</span>
                  <span className="font-body font-bold text-text">{cart.total.toLocaleString()} FCFA</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={clearCart}
                  className="flex-1 border-2 border-stone-200 text-text-muted rounded-full py-3 font-body font-medium hover:border-secondary hover:text-secondary"
                  data-testid="clear-cart-btn"
                >
                  Vider le panier
                </button>
                <button
                  onClick={handleCheckout}
                  className="flex-1 bg-primary text-white rounded-full py-3 font-heading text-xl tracking-wide shadow-lg hover:scale-105 active:scale-95 transition-transform"
                  data-testid="checkout-btn"
                >
                  Commander
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ==================== HOMEPAGE ====================
const HomePage = () => {
  const [zone, setZone] = useState('');
  const [menus, setMenus] = useState([]);
  const [allMenus, setAllMenus] = useState([]);
  const [isAvailable, setIsAvailable] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const zones = [
    { id: 'bonapriso', name: 'Bonapriso', description: 'Le cœur de Douala', icon: '🏙️' },
    { id: 'bonanjo', name: 'Bonanjo', description: 'Le quartier des affaires', icon: '🌆' }
  ];

  // Hero slider images
  const heroSlides = [
    { 
      image: 'https://images.unsplash.com/photo-1653981608672-aea09b857b20?w=1920&q=80',
      title: 'Saveurs Authentiques',
      subtitle: 'Découvrez les meilleurs plats de rue de Douala'
    },
    { 
      image: 'https://images.unsplash.com/photo-1635360065676-f47200966893?w=1920&q=80',
      title: 'Fraîcheur Garantie',
      subtitle: 'Des ingrédients locaux préparés avec passion'
    },
    { 
      image: 'https://images.unsplash.com/photo-1688940738506-acfe9334bf5c?w=1920&q=80',
      title: 'Livraison Rapide',
      subtitle: 'Recevez vos plats chauds en moins de 30 minutes'
    }
  ];

  // Auto slide
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    checkTimeAvailability();
    fetchAllMenus();
    
    // Check URL for zone parameter
    const params = new URLSearchParams(window.location.search);
    const zoneParam = params.get('zone');
    if (zoneParam) {
      setZone(zoneParam);
    }
  }, []);

  useEffect(() => {
    if (zone) {
      fetchMenus();
    }
  }, [zone]);

  const checkTimeAvailability = async () => {
    try {
      const response = await axios.get(`${API}/menu-time-check`);
      setIsAvailable(response.data.available);
    } catch (error) {
      console.error('Error checking time:', error);
    }
  };

  const fetchAllMenus = async () => {
    try {
      // Fetch menus from all zones for search
      const [bonaprisoRes, bonanjoRes] = await Promise.all([
        axios.get(`${API}/menus?zone=bonapriso`),
        axios.get(`${API}/menus?zone=bonanjo`)
      ]);
      setAllMenus([...bonaprisoRes.data, ...bonanjoRes.data]);
    } catch (error) {
      console.error('Error fetching all menus:', error);
    }
  };

  const fetchMenus = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/menus?zone=${zone}`);
      setMenus(response.data);
    } catch (error) {
      console.error('Error fetching menus:', error);
      toast.error('Erreur lors du chargement des menus');
    } finally {
      setLoading(false);
    }
  };

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return { menus: [], zones: [] };
    const query = searchQuery.toLowerCase().trim();
    const filteredMenus = allMenus.filter(menu => 
      menu.name.toLowerCase().includes(query) ||
      menu.description?.toLowerCase().includes(query) ||
      menu.vendor_name?.toLowerCase().includes(query)
    );
    const filteredZones = zones.filter(z => 
      z.name.toLowerCase().includes(query) ||
      z.id.toLowerCase().includes(query)
    );
    return { menus: filteredMenus.slice(0, 5), zones: filteredZones };
  }, [searchQuery, allMenus]);

  const handleSearchSelect = (menu) => {
    setSearchQuery('');
    setShowSearchResults(false);
    navigate(`/plat/${menu.id}`);
  };

  const handleZoneSelect = (selectedZone) => {
    setSearchQuery('');
    setShowSearchResults(false);
    setZone(selectedZone);
  };

  const handleAddToCart = (menu, e) => {
    e.stopPropagation();
    addToCart(menu, 1);
  };

  return (
    <div className="min-h-screen bg-stone-50">
      
      {/* Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <HemeleyLogo size={32} />
            </Link>
            
            {/* Search Bar Desktop */}
            <div className="hidden md:flex flex-1 max-w-xl mx-8 relative">
              <div className="relative w-full">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  placeholder="Rechercher un plat, restaurant..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setShowSearchResults(true); }}
                  onFocus={() => setShowSearchResults(true)}
                  className="w-full bg-stone-100 rounded-full pl-11 pr-4 py-2.5 font-body text-sm focus:bg-white focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                  data-testid="search-input"
                />
              </div>
              
              {/* Search Results Dropdown */}
              {showSearchResults && searchQuery && (searchResults.menus.length > 0 || searchResults.zones.length > 0) && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-stone-100 overflow-hidden z-50">
                  {searchResults.zones.length > 0 && (
                    <div className="p-2">
                      <p className="text-xs font-body text-text-muted px-3 py-1 uppercase">Zones</p>
                      {searchResults.zones.map(z => (
                        <button key={z.id} onClick={() => handleZoneSelect(z.id)} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-stone-50 rounded-xl">
                          <MapPin size={16} className="text-primary" />
                          <span className="font-body text-sm">{z.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults.menus.length > 0 && (
                    <div className="p-2 border-t border-stone-100">
                      <p className="text-xs font-body text-text-muted px-3 py-1 uppercase">Plats</p>
                      {searchResults.menus.map(menu => (
                        <button key={menu.id} onClick={() => handleSearchSelect(menu)} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-stone-50 rounded-xl">
                          <div className="w-10 h-10 bg-stone-100 rounded-lg overflow-hidden">
                            {menu.image_base64 ? <img src={menu.image_base64} alt="" className="w-full h-full object-cover" /> : <span className="text-lg flex items-center justify-center h-full">🍛</span>}
                          </div>
                          <div className="text-left">
                            <p className="font-body text-sm font-medium">{menu.name}</p>
                            <p className="font-body text-xs text-primary">{menu.price?.toLocaleString()} FCFA</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Link to="/vendor/login" className="hidden sm:flex items-center gap-1.5 text-text-muted hover:text-primary font-body text-sm transition-colors">
                <Crown size={16} />
                <span className="hidden lg:inline">Vendeur</span>
              </Link>
              <Link to="/delivery/login" className="hidden sm:flex items-center gap-1.5 text-text-muted hover:text-primary font-body text-sm transition-colors">
                <Truck size={16} />
                <span className="hidden lg:inline">Livreur</span>
              </Link>
              <button onClick={() => setShowCart(true)} className="relative p-2 bg-primary text-white rounded-full hover:bg-primary/90 transition-colors" data-testid="cart-nav-btn">
                <ShoppingCart size={20} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Welcome & Zone Selection */}
      {!zone && (
        <div className="p-6 max-w-md mx-auto">
          <h2 className="font-heading text-3xl text-text mb-4" data-testid="welcome-text">Bienvenue sur HEMELEY</h2>
          <p className="font-body text-text-muted mb-6">Choisissez votre zone pour découvrir les menus du jour</p>
          
          <div className="space-y-4">
            <button
              data-testid="zone-bonapriso-btn"
              onClick={() => setZone('bonapriso')}
              className="w-full bg-white border-2 border-primary text-primary rounded-2xl p-6 font-heading text-2xl tracking-wide hover:bg-primary/10 active:scale-95 transition-transform flex items-center justify-center gap-3"
            >
              <MapPin size={28} />
              Bonapriso
            </button>
            <button
              data-testid="zone-bonanjo-btn"
              onClick={() => setZone('bonanjo')}
              className="w-full bg-white border-2 border-primary text-primary rounded-2xl p-6 font-heading text-2xl tracking-wide hover:bg-primary/10 active:scale-95 transition-transform flex items-center justify-center gap-3"
            >
              <MapPin size={28} />
              Bonanjo
            </button>
          </div>

          <div className="mt-8 text-center">
            <Link
              to="/vendor/login"
              data-testid="vendor-login-link"
              className="text-primary font-body font-medium hover:underline"
            >
              Espace Vendeur
            </Link>
          </div>
        </div>
      )}

      {/* Menu List */}
      {zone && (
        <div className="p-6 max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button
              data-testid="back-to-zones-btn"
              onClick={() => setZone('')}
              className="flex items-center gap-2 text-text-muted hover:text-primary font-body font-medium"
            >
              <ChevronLeft size={20} />
              Changer de zone
            </button>
            <div className="flex items-center gap-2 text-text-muted font-body" data-testid="selected-zone">
              <MapPin size={18} />
              {zone === 'bonapriso' ? 'Bonapriso' : 'Bonanjo'}
            </div>
          </div>

          {!isAvailable && (
            <div className="bg-secondary/10 border-2 border-secondary rounded-2xl p-6 mb-6 text-center" data-testid="closed-message">
              <Clock size={32} className="mx-auto mb-3 text-secondary" />
              <p className="font-body text-lg text-secondary font-medium">
                Les menus sont fermés pour aujourd&apos;hui
              </p>
              <p className="font-body text-sm text-text-muted mt-2">
                Revenez entre 10h et 15h
              </p>
            </div>
          )}

          {isAvailable && (
            <>
              {loading ? (
                <div className="text-center py-12" data-testid="loading-menus">
                  <p className="font-body text-text-muted">Chargement des menus...</p>
                </div>
              ) : menus.length === 0 ? (
                <div className="text-center py-12" data-testid="no-menus">
                  <p className="font-body text-text-muted">Aucun menu disponible pour le moment</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {menus.map(menu => (
                    <div
                      key={menu.id}
                      data-testid={`menu-card-${menu.id}`}
                      className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => navigate(`/plat/${menu.id}`)}
                    >
                      <div className="aspect-video bg-stone-100 overflow-hidden">
                        {menu.image_base64 ? (
                          <img
                            src={menu.image_base64}
                            alt={menu.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-text-muted">
                            <span className="text-6xl">🍛</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="p-4">
                        <h3 className="font-heading text-2xl text-text mb-2" data-testid={`menu-name-${menu.id}`}>{menu.name}</h3>
                        <p className="font-body text-xl font-bold text-primary mb-2" data-testid={`menu-price-${menu.id}`}>
                          {menu.price.toLocaleString()} FCFA
                        </p>
                        <p className="font-body text-sm text-text-muted mb-3" data-testid={`menu-vendor-${menu.id}`}>{menu.vendor_name}</p>
                        
                        <div className="flex items-center justify-between mb-4">
                          <span className="font-body text-sm text-text-muted" data-testid={`menu-portions-${menu.id}`}>
                            {menu.remaining_portions} portion{menu.remaining_portions > 1 ? 's' : ''} restante{menu.remaining_portions > 1 ? 's' : ''}
                          </span>
                          {menu.remaining_portions <= 3 && menu.remaining_portions > 0 && (
                            <span className="bg-secondary text-white px-3 py-1 rounded-full text-xs font-body font-medium">
                              Dernier{menu.remaining_portions > 1 ? 's' : ''} !
                            </span>
                          )}
                        </div>
                        
                        <button
                          data-testid={`hemeley-btn-${menu.id}`}
                          className="w-full bg-primary text-white rounded-full py-3 font-body font-medium shadow-lg hover:scale-105 active:scale-95 transition-transform flex items-center justify-center gap-2"
                          onClick={(e) => handleAddToCart(menu, e)}
                        >
                          <ShoppingCart size={20} />
                          Ajouter au panier
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Cart Button and Modal */}
      <CartButton onClick={() => setShowCart(true)} />
      <CartModal isOpen={showCart} onClose={() => setShowCart(false)} />

      {/* Footer with Links */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 py-3 px-4 z-20">
        <div className="max-w-2xl mx-auto flex justify-center gap-6">
          <Link 
            to="/vendor/login" 
            className="flex items-center gap-2 text-text-muted hover:text-primary font-body text-sm transition-colors"
            data-testid="vendor-link"
          >
            <Crown size={18} />
            Espace Vendeur
          </Link>
          <Link 
            to="/delivery/login" 
            className="flex items-center gap-2 text-text-muted hover:text-primary font-body text-sm transition-colors"
            data-testid="delivery-link"
          >
            <Truck size={18} />
            Espace Livreur
          </Link>
        </div>
      </div>
    </div>
  );
};

// ==================== MENU DETAIL PAGE ====================
const MenuDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showOrderModal, setShowOrderModal] = useState(false);

  useEffect(() => {
    fetchMenu();
  }, [id]);

  const fetchMenu = async () => {
    try {
      const response = await axios.get(`${API}/menus/${id}`);
      setMenu(response.data);
    } catch (error) {
      console.error('Error fetching menu:', error);
      toast.error('Menu introuvable');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    // Return to menu list with zone if available
    if (menu?.zone) {
      navigate(`/?zone=${menu.zone}`);
    } else {
      navigate('/');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="loading-menu-detail">
        <p className="font-body text-text-muted">Chargement...</p>
      </div>
    );
  }

  if (!menu) return null;

  return (
    <div className="min-h-screen pb-24">
      
      {/* Back Button */}
      <button
        data-testid="back-to-home-btn"
        onClick={handleBack}
        className="absolute top-6 left-6 z-10 bg-white/90 backdrop-blur-sm rounded-full p-3 shadow-lg hover:scale-105 active:scale-95 transition-transform"
      >
        <ChevronLeft size={24} className="text-text" />
      </button>

      {/* Hero Image */}
      <div className="max-w-3xl mx-auto">
        <div className="aspect-[16/9] md:aspect-[2/1] bg-stone-100 overflow-hidden md:rounded-b-2xl">
          {menu.image_base64 ? (
            <img
              src={menu.image_base64}
              alt={menu.name}
              className="w-full h-full object-cover"
              data-testid="menu-detail-image"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-text-muted">
              <span className="text-9xl">🍛</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="font-heading text-4xl text-text mb-3" data-testid="menu-detail-name">{menu.name}</h1>
        <p className="font-body text-3xl font-bold text-primary mb-4" data-testid="menu-detail-price">
          {menu.price.toLocaleString()} FCFA
        </p>

        <div className="bg-white rounded-2xl p-4 mb-4 border border-stone-100">
          <p className="font-body text-text-muted mb-2" data-testid="menu-detail-vendor">
            Vendeur: <Link to={`/vendeur/${menu.vendor_id}`} className="text-primary font-medium hover:underline">{menu.vendor_name}</Link>
          </p>
          <p className="font-body text-text-muted" data-testid="menu-detail-portions">
            {menu.remaining_portions} portion{menu.remaining_portions > 1 ? 's' : ''} restante{menu.remaining_portions > 1 ? 's' : ''}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 mb-4 border border-stone-100">
          <h3 className="font-heading text-xl text-text mb-2">Description</h3>
          <p className="font-body text-text" data-testid="menu-detail-description">{menu.description}</p>
        </div>

        <div className="bg-white rounded-2xl p-6 mb-4 border border-stone-100">
          <h3 className="font-heading text-xl text-text mb-2">Ingrédients</h3>
          <p className="font-body text-text" data-testid="menu-detail-ingredients">{menu.ingredients}</p>
        </div>
      </div>

      {/* Fixed Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-stone-200 p-4 safe-area-bottom">
        <button
          data-testid="open-order-modal-btn"
          onClick={() => setShowOrderModal(true)}
          disabled={menu.remaining_portions <= 0}
          className="w-full max-w-2xl mx-auto block bg-primary text-white rounded-full py-4 font-heading text-2xl tracking-wide shadow-lg hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {menu.remaining_portions > 0 ? '🔥 HEMELEY' : 'Épuisé'}
        </button>
      </div>

      {/* Order Modal */}
      {showOrderModal && (
        <OrderModal
          menu={menu}
          onClose={() => setShowOrderModal(false)}
        />
      )}
    </div>
  );
};

// ==================== ORDER MODAL ====================
// ==================== CONFIRMATION PAGE ====================
const ConfirmationPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchOrder = useCallback(async () => {
    try {
      // In a real app, we'd have an endpoint to fetch order by ID
      // For now, we'll show a generic confirmation
      setTimeout(() => setLoading(false), 100);
    } catch (error) {
      console.error('Error fetching order:', error);
      setTimeout(() => setLoading(false), 100);
    }
  }, []);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const getWhatsAppLink = (phone, message) => {
    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${phone}?text=${encodedMessage}`;
  };

  // Mock order data for confirmation (in real app, fetch from API)
  const mockOrder = {
    menu_name: 'Poulet DG',
    amount: 2500,
    order_type: 'commander',
    zone: 'Bonapriso',
    vendor_phone: '237699123456',
    customer_phone: '237677654321',
    payment_method: 'orange'
  };

  const vendorMessage = `Nouvelle commande HEMELEY!
✌️ Plat: ${mockOrder.menu_name}
💵 Montant: ${mockOrder.amount} FCFA
📍 Zone: ${mockOrder.zone}
📞 Contact: ${mockOrder.customer_phone}`;

  const customerMessage = `Ma commande HEMELEY
🍛 Plat: ${mockOrder.menu_name}
💵 Montant: ${mockOrder.amount} FCFA
📍 Zone: ${mockOrder.zone}`;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-body text-text-muted">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="font-heading text-4xl text-text mb-2" data-testid="confirmation-title">Commande créée !</h1>
          <p className="font-body text-text-muted">Votre commande a été enregistrée avec succès</p>
        </div>

        <div className="bg-white rounded-2xl p-6 mb-6 border border-stone-100">
          <h2 className="font-heading text-2xl text-text mb-4">Instructions de paiement</h2>
          
          {mockOrder.payment_method === 'orange' ? (
            <div className="space-y-3 font-body text-text">
              <p className="font-medium">Pour payer avec Orange Money:</p>
              <ol className="list-decimal list-inside space-y-2 text-text-muted">
                <li>Composez #150#</li>
                <li>Sélectionnez &quot;Transfert d&apos;argent&quot;</li>
                <li>Entrez &quot;687676055&quot;</li>
                <li>Entrez le montant: {mockOrder.amount} FCFA</li>
                <li>Confirmez le paiement</li>
              </ol>
            </div>
          ) : (
            <div className="space-y-3 font-body text-text">
              <p className="font-medium">Pour payer avec MTN Mobile Money:</p>
              <ol className="list-decimal list-inside space-y-2 text-text-muted">
                <li>Composez *126#</li>
                <li>Sélectionnez &quot;Transfert&quot;</li>
                <li>Entrez le montant: {mockOrder.amount} FCFA</li>
                <li>Confirmez le paiement</li>
              </ol>
            </div>
          )}
        </div>

        <div className="bg-accent/20 rounded-2xl p-6 mb-6 border-2 border-accent">
          <h2 className="font-heading text-2xl text-text mb-4">Contactez-nous sur WhatsApp</h2>
          
          <div className="space-y-3">
            <a
              data-testid="whatsapp-vendor-link"
              href={getWhatsAppLink(mockOrder.vendor_phone, vendorMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-success text-white rounded-xl py-4 font-body font-medium text-center hover:scale-105 active:scale-95 transition-transform"
            >
              💬 Contacter le vendeur
            </a>
            
            <a
              data-testid="whatsapp-customer-link"
              href={getWhatsAppLink(mockOrder.customer_phone, customerMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-white border-2 border-success text-success rounded-xl py-4 font-body font-medium text-center hover:bg-success/10 transition-colors"
            >
              💬 Partager ma commande
            </a>
          </div>
        </div>

        <button
          data-testid="back-home-from-confirmation-btn"
          onClick={() => navigate('/')}
          className="w-full bg-primary text-white rounded-full py-4 font-heading text-xl tracking-wide shadow-lg hover:scale-105 active:scale-95 transition-transform"
        >
          Retour à l&apos;accueil
        </button>
      </div>
    </div>
  );
};

// ==================== VENDOR LOGIN ====================
const VendorLoginPage = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    zone: 'bonapriso'
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = isLogin ? '/vendor/login' : '/vendor/register';
      const response = await axios.post(`${API}${endpoint}`, formData);
      
      localStorage.setItem('vendor_token', response.data.token);
      localStorage.setItem('vendor_data', JSON.stringify(response.data.user || response.data.vendor));
      
      toast.success(isLogin ? 'Connexion réussie!' : 'Compte créé avec succès!');
      navigate('/vendor/dashboard');
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de l\'authentification');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-6 flex items-center justify-center">
      
      <div className="w-full max-w-md">
        <button
          data-testid="back-from-vendor-login-btn"
          onClick={() => navigate('/')}
          className="mb-6 flex items-center gap-2 text-text-muted hover:text-primary font-body font-medium"
        >
          <ChevronLeft size={20} />
          Retour
        </button>

        <div className="bg-white rounded-2xl p-8 border border-stone-100 shadow-sm">
          <div className="text-center mb-6">
            <h1 className="font-heading text-4xl text-text mb-2" data-testid="vendor-auth-title">Espace Vendeur</h1>
            <p className="font-body text-text-muted">
              {isLogin ? 'Connectez-vous à votre compte' : 'Créez votre compte vendeur'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div>
                  <label className="font-body font-medium text-text mb-2 block">Nom du commerce</label>
                  <input
                    data-testid="vendor-name-input"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-white border-2 border-stone-200 rounded-xl px-4 py-3 focus:border-primary focus:outline-none font-body"
                  />
                </div>

                <div>
                  <label className="font-body font-medium text-text mb-2 block">Téléphone</label>
                  <input
                    data-testid="vendor-phone-input"
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-white border-2 border-stone-200 rounded-xl px-4 py-3 focus:border-primary focus:outline-none font-body"
                  />
                </div>

                <div>
                  <label className="font-body font-medium text-text mb-2 block">Zone</label>
                  <select
                    data-testid="vendor-zone-select"
                    value={formData.zone}
                    onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                    className="w-full bg-white border-2 border-stone-200 rounded-xl px-4 py-3 focus:border-primary focus:outline-none font-body"
                  >
                    <option value="bonapriso">Bonapriso</option>
                    <option value="bonanjo">Bonanjo</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="font-body font-medium text-text mb-2 block">Email</label>
              <input
                data-testid="vendor-email-input"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-white border-2 border-stone-200 rounded-xl px-4 py-3 focus:border-primary focus:outline-none font-body"
              />
            </div>

            <div>
              <label className="font-body font-medium text-text mb-2 block">Mot de passe</label>
              <div className="relative">
                <input
                  data-testid="vendor-password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full bg-white border-2 border-stone-200 rounded-xl px-4 py-3 focus:border-primary focus:outline-none font-body"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              data-testid="vendor-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white rounded-full py-4 font-heading text-xl tracking-wide shadow-lg hover:scale-105 active:scale-95 transition-transform disabled:opacity-50"
            >
              {loading ? 'Chargement...' : (isLogin ? 'Se connecter' : 'Créer un compte')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary font-body font-medium hover:underline"
            >
              {isLogin ? 'Pas encore de compte ? Inscrivez-vous' : 'Déjà un compte ? Connectez-vous'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== VENDOR DASHBOARD ====================
const VendorDashboardPage = () => {
  const navigate = useNavigate();
  const [menus, setMenus] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState(null);

  useEffect(() => {
    const vendorData = localStorage.getItem('vendor_data');
    if (!vendorData || vendorData === 'undefined' || vendorData === 'null') {
      navigate('/vendor/login');
      return;
    }
    try {
      setVendor(JSON.parse(vendorData));
      fetchData();
    } catch (error) {
      console.error('Error parsing vendor data:', error);
      localStorage.removeItem('vendor_data');
      localStorage.removeItem('vendor_token');
      navigate('/vendor/login');
    }
  }, []);

  const fetchData = async () => {
    const token = localStorage.getItem('vendor_token');
    if (!token) {
      navigate('/vendor/login');
      return;
    }

    try {
      const [menusRes, ordersRes] = await Promise.all([
        axios.get(`${API}/vendor/menus`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/vendor/orders`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      setMenus(menusRes?.data || []);
      setOrders(ordersRes?.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      setMenus([]);
      setOrders([]);
      if (error.response?.status === 401) {
        localStorage.removeItem('vendor_token');
        localStorage.removeItem('vendor_data');
        navigate('/vendor/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('vendor_token');
    localStorage.removeItem('vendor_data');
    navigate('/');
  };

  const handleExportPDF = async () => {
    const token = localStorage.getItem('vendor_token');
    if (!token) {
      toast.error('Vous devez être connecté');
      return;
    }

    try {
      toast.info('Génération du rapport PDF en cours...');
      
      const response = await axios.get(`${API}/export/vendor/orders-report`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Accept': 'application/pdf'
        },
        responseType: 'blob',
        timeout: 30000
      });

      // Validate response
      if (!response.data || response.data.size === 0) {
        throw new Error('Le fichier PDF est vide');
      }

      // Create blob with correct type
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const filename = `rapport_hemeley_${new Date().toISOString().split('T')[0]}.pdf`;
      const url = window.URL.createObjectURL(blob);
      
      // Force download using anchor element
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.cssText = 'position:absolute;left:-9999px;';
      document.body.appendChild(link);
      
      // Trigger click
      link.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 1000);

      toast.success('Téléchargement du PDF lancé !');
    } catch (error) {
      console.error('Error downloading PDF:', error);
      
      if (error.response?.status === 401) {
        toast.error('Session expirée. Veuillez vous reconnecter.');
        localStorage.removeItem('vendor_token');
        localStorage.removeItem('vendor_data');
        navigate('/vendor/login');
      } else {
        toast.error('Erreur lors du téléchargement: ' + (error.message || 'Erreur inconnue'));
      }
    }
  };

  const toggleMenuActive = async (menuId, isActive) => {
    const token = localStorage.getItem('vendor_token');
    try {
      await axios.put(
        `${API}/vendor/menus/${menuId}`,
        { is_active: !isActive },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Statut mis à jour');
      fetchData();
    } catch (error) {
      console.error('Error updating menu:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const deleteMenu = async (menuId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce menu ?')) return;

    const token = localStorage.getItem('vendor_token');
    try {
      await axios.delete(`${API}/vendor/menus/${menuId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Menu supprimé');
      fetchData();
    } catch (error) {
      console.error('Error deleting menu:', error);
      toast.error('Erreur lors de la suppression');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-body text-text-muted">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      
      {/* Header */}
      <div className="bg-primary text-white p-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-heading text-3xl tracking-wide mb-1" data-testid="vendor-dashboard-title">Tableau de bord</h1>
            <p className="font-body" data-testid="vendor-name">{vendor?.name}</p>
          </div>
          <button
            data-testid="logout-btn"
            onClick={handleLogout}
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 rounded-full px-4 py-2 font-body transition-colors"
          >
            <LogOut size={18} />
            Déconnexion
          </button>
        </div>
      </div>

      <div className="p-6 max-w-4xl mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white rounded-xl p-6 border border-stone-100 shadow-sm text-center">
            <p className="font-body text-text-muted mb-2">Menus actifs</p>
            <p className="font-heading text-4xl text-primary" data-testid="active-menus-count">{menus.filter(m => m.is_active).length}</p>
          </div>
          <div className="bg-white rounded-xl p-6 border border-stone-100 shadow-sm text-center">
            <p className="font-body text-text-muted mb-2">Commandes</p>
            <p className="font-heading text-4xl text-primary" data-testid="orders-count">{orders.length}</p>
          </div>
        </div>

        {/* Export Button */}
        <div className="mb-8">
          <button
            onClick={handleExportPDF}
            className="w-full bg-accent text-accent-foreground rounded-2xl py-4 font-heading text-xl tracking-wide shadow-lg hover:scale-105 active:scale-95 transition-transform flex items-center justify-center gap-2"
            data-testid="export-pdf-btn"
          >
            📄 Télécharger Rapport PDF
          </button>
        </div>

        {/* Add Menu Button */}
        <button
          data-testid="add-menu-btn"
          onClick={() => navigate('/vendor/add-menu')}
          className="w-full bg-primary text-white rounded-2xl py-4 font-heading text-xl tracking-wide shadow-lg hover:scale-105 active:scale-95 transition-transform mb-8 flex items-center justify-center gap-2"
        >
          <Plus size={24} />
          Ajouter un menu
        </button>

        {/* Menus List */}
        <div>
          <h2 className="font-heading text-2xl text-text mb-4">Mes menus</h2>
          {menus.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-stone-100">
              <p className="font-body text-text-muted">Aucun menu pour le moment</p>
            </div>
          ) : (
            <div className="space-y-4">
              {menus.map(menu => (
                <div key={menu.id} className="bg-white rounded-2xl p-4 border border-stone-100 shadow-sm" data-testid={`vendor-menu-${menu.id}`}>
                  <div className="flex gap-4">
                    <div className="w-24 h-24 bg-stone-100 rounded-xl overflow-hidden flex-shrink-0">
                      {menu.image_base64 ? (
                        <img src={menu.image_base64} alt={menu.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl">🍛</div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-heading text-xl text-text mb-1">{menu.name}</h3>
                      <p className="font-body text-lg font-bold text-primary mb-1">{menu.price.toLocaleString()} FCFA</p>
                      <p className="font-body text-sm text-text-muted">
                        {menu.remaining_portions}/{menu.total_portions} portions restantes
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => toggleMenuActive(menu.id, menu.is_active)}
                        className={`px-4 py-2 rounded-full font-body text-sm font-medium transition-colors ${
                          menu.is_active
                            ? 'bg-success/20 text-success hover:bg-success/30'
                            : 'bg-stone-200 text-text-muted hover:bg-stone-300'
                        }`}
                      >
                        {menu.is_active ? 'Actif' : 'Inactif'}
                      </button>
                      <button
                        onClick={() => deleteMenu(menu.id)}
                        className="px-4 py-2 rounded-full font-body text-sm font-medium bg-secondary/20 text-secondary hover:bg-secondary/30 transition-colors"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Orders List */}
        <div>
          <h2 className="font-heading text-2xl text-text mb-4">Commandes récentes</h2>
          {orders.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-stone-100">
              <p className="font-body text-text-muted">Aucune commande pour le moment</p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.slice(0, 10).map(order => (
                <div key={order.id} className="bg-white rounded-2xl p-4 border border-stone-100 shadow-sm" data-testid={`vendor-order-${order.id}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-body font-bold text-text">{order.menu_name}</h3>
                      <p className="font-body text-sm text-text-muted">{order.pseudonym}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-body font-bold text-primary">{order.amount.toLocaleString()} FCFA</p>
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-body font-medium ${
                        order.payment_status === 'confirmed'
                          ? 'bg-success/20 text-success'
                          : 'bg-accent/20 text-accent-foreground'
                      }`}>
                        {order.payment_status === 'confirmed' ? 'Payé' : 'En attente'}
                      </span>
                    </div>
                  </div>
                  <p className="font-body text-sm text-text-muted mb-2">
                    <Phone size={14} className="inline mr-1" />
                    {order.phone}
                  </p>
                  {order.comment && (
                    <p className="font-body text-sm text-text italic">&quot;{order.comment}&quot;</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ==================== VENDOR ADD MENU ====================
const VendorAddMenuPage = () => {
  const navigate = useNavigate();
  const [vendor, setVendor] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    ingredients: '',
    price: '',
    cost_price: '',
    original_price: '',
    discount_percent: '',
    category: 'plat',
    zone: 'bonapriso',
    total_portions: '',
    image_base64: '',
    visibility_start: '',
    visibility_end: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const vendorData = localStorage.getItem('vendor_data');
    if (!vendorData) {
      navigate('/vendor/login');
      return;
    }
    const parsed = JSON.parse(vendorData);
    setVendor(parsed);
    setFormData(prev => ({ ...prev, zone: parsed.zone || 'bonapriso' }));
    // Refresh vendor to get latest custom_categories
    const token = localStorage.getItem('vendor_token');
    if (token) {
      axios.get(`${API}/vendor/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => {
          setVendor(res.data);
          localStorage.setItem('vendor_data', JSON.stringify(res.data));
        })
        .catch(() => { /* ignore, fall back to cached */ });
    }
  }, []);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, image_base64: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const token = localStorage.getItem('vendor_token');
    if (!token) {
      navigate('/vendor/login');
      return;
    }

    try {
      const payload = {
        ...formData,
        price: parseFloat(formData.price),
        cost_price: formData.cost_price !== '' ? parseFloat(formData.cost_price) : null,
        total_portions: parseInt(formData.total_portions),
        original_price: formData.original_price ? parseFloat(formData.original_price) : null,
        discount_percent: formData.discount_percent ? parseFloat(formData.discount_percent) : null,
        visibility_start: formData.visibility_start || null,
        visibility_end: formData.visibility_end || null
      };

      await axios.post(
        `${API}/vendor/menus`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Menu ajouté avec succès!');
      navigate('/vendor/dashboard');
    } catch (error) {
      console.error('Error creating menu:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de la création du menu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-6 pb-20 bg-stone-50">
      
      <div className="max-w-2xl mx-auto">
        <button
          data-testid="back-to-dashboard-btn"
          onClick={() => navigate('/vendor/dashboard')}
          className="mb-6 flex items-center gap-2 text-text-muted hover:text-primary font-body font-medium"
        >
          <ChevronLeft size={20} />
          Retour au tableau de bord
        </button>

        <div className="bg-white rounded-2xl p-6 border border-stone-100 shadow-sm">
          <h1 className="font-heading text-3xl text-text mb-6" data-testid="add-menu-title">Ajouter un plat</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="font-body font-medium text-text mb-2 block">Nom du plat *</label>
              <input
                data-testid="menu-name-input"
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-white border-2 border-stone-200 rounded-xl px-4 py-3 focus:border-primary focus:outline-none font-body"
                placeholder="Ex: Poulet DG"
              />
            </div>

            <div>
              <label className="font-body font-medium text-text mb-2 block">Catégorie *</label>
              <select
                data-testid="menu-category-select"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full bg-white border-2 border-stone-200 rounded-xl px-4 py-3 focus:border-primary focus:outline-none font-body"
              >
                <option value="entree">Entrée</option>
                <option value="plat">Plat principal</option>
                <option value="boisson">Boisson</option>
                <option value="dessert">Dessert</option>
                <option value="petit-dejeuner">Petit-déjeuner</option>
                <option value="snack">Snack</option>
                <option value="autre">Autre</option>
                {(vendor?.custom_categories || []).length > 0 && (
                  <optgroup label="Mes catégories">
                    {vendor.custom_categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            <div>
              <label className="font-body font-medium text-text mb-2 block">Description *</label>
              <textarea
                data-testid="menu-description-input"
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-white border-2 border-stone-200 rounded-xl px-4 py-3 focus:border-primary focus:outline-none font-body"
                rows={3}
                placeholder="Décrivez votre plat..."
              />
            </div>

            <div>
              <label className="font-body font-medium text-text mb-2 block">Ingrédients *</label>
              <textarea
                data-testid="menu-ingredients-input"
                required
                value={formData.ingredients}
                onChange={(e) => setFormData({ ...formData, ingredients: e.target.value })}
                className="w-full bg-white border-2 border-stone-200 rounded-xl px-4 py-3 focus:border-primary focus:outline-none font-body"
                rows={2}
                placeholder="Listez les ingrédients..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-body font-medium text-text mb-2 block">Prix (FCFA) *</label>
                <input
                  data-testid="menu-price-input"
                  type="number"
                  required
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full bg-white border-2 border-stone-200 rounded-xl px-4 py-3 focus:border-primary focus:outline-none font-body"
                  placeholder="2500"
                />
              </div>
              <div>
                <label className="font-body font-medium text-text mb-2 block">Portions *</label>
                <input
                  data-testid="menu-portions-input"
                  type="number"
                  required
                  min="1"
                  value={formData.total_portions}
                  onChange={(e) => setFormData({ ...formData, total_portions: e.target.value })}
                  className="w-full bg-white border-2 border-stone-200 rounded-xl px-4 py-3 focus:border-primary focus:outline-none font-body"
                  placeholder="10"
                />
              </div>
            </div>

            {/* Coût matière (optionnel — pour Menu Engineering) */}
            <div>
              <label className="font-body font-medium text-text mb-2 block">
                Coût matière par portion (FCFA)
                <span className="ml-2 text-xs text-text-muted font-normal">Optionnel — sert à calculer votre marge</span>
              </label>
              <input
                data-testid="menu-cost-price-input"
                type="number"
                min="0"
                value={formData.cost_price}
                onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                className="w-full bg-white border-2 border-stone-200 rounded-xl px-4 py-3 focus:border-primary focus:outline-none font-body"
                placeholder="Ex: 1200 (le coût des ingrédients pour ce plat)"
              />
              {formData.price && formData.cost_price && parseFloat(formData.price) > 0 && (
                <p className="text-sm text-text-muted mt-1">
                  Marge estimée : <b>{Math.round((1 - parseFloat(formData.cost_price) / parseFloat(formData.price)) * 100)}%</b>
                </p>
              )}
            </div>

            {/* Promotion / Prix barré */}
            <div className="border-2 border-dashed border-stone-200 rounded-xl p-4 space-y-4">
              <h3 className="font-body font-bold text-text flex items-center gap-2">
                <span className="text-red-500">%</span> Réduction / Prix barré
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-body text-sm text-text-muted mb-1 block">Prix original (barré)</label>
                  <input
                    data-testid="menu-original-price-input"
                    type="number"
                    min="0"
                    value={formData.original_price}
                    onChange={(e) => {
                      const op = e.target.value;
                      const disc = op && formData.price ? Math.round((1 - parseFloat(formData.price) / parseFloat(op)) * 100) : '';
                      setFormData({ ...formData, original_price: op, discount_percent: disc > 0 ? disc.toString() : '' });
                    }}
                    className="w-full bg-white border-2 border-stone-200 rounded-xl px-4 py-2.5 focus:border-primary focus:outline-none font-body text-sm"
                    placeholder="3000"
                  />
                </div>
                <div>
                  <label className="font-body text-sm text-text-muted mb-1 block">% Réduction</label>
                  <input
                    data-testid="menu-discount-input"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.discount_percent}
                    onChange={(e) => setFormData({ ...formData, discount_percent: e.target.value })}
                    className="w-full bg-white border-2 border-stone-200 rounded-xl px-4 py-2.5 focus:border-primary focus:outline-none font-body text-sm"
                    placeholder="Auto-calculé"
                  />
                </div>
              </div>
            </div>

            {/* Visibilité */}
            <div className="border-2 border-dashed border-stone-200 rounded-xl p-4 space-y-4">
              <h3 className="font-body font-bold text-text flex items-center gap-2">
                <Clock size={16} className="text-blue-500" /> Période de visibilité
              </h3>
              <p className="font-body text-xs text-text-muted">Laissez vide pour une visibilité permanente</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-body text-sm text-text-muted mb-1 block">Date début</label>
                  <input
                    data-testid="menu-visibility-start"
                    type="date"
                    value={formData.visibility_start}
                    onChange={(e) => setFormData({ ...formData, visibility_start: e.target.value })}
                    className="w-full bg-white border-2 border-stone-200 rounded-xl px-4 py-2.5 focus:border-primary focus:outline-none font-body text-sm"
                  />
                </div>
                <div>
                  <label className="font-body text-sm text-text-muted mb-1 block">Date fin</label>
                  <input
                    data-testid="menu-visibility-end"
                    type="date"
                    value={formData.visibility_end}
                    onChange={(e) => setFormData({ ...formData, visibility_end: e.target.value })}
                    className="w-full bg-white border-2 border-stone-200 rounded-xl px-4 py-2.5 focus:border-primary focus:outline-none font-body text-sm"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="font-body font-medium text-text mb-2 block">Zone *</label>
              <select
                data-testid="menu-zone-select"
                value={formData.zone}
                onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                className="w-full bg-white border-2 border-stone-200 rounded-xl px-4 py-3 focus:border-primary focus:outline-none font-body"
              >
                <option value="bonapriso">Bonapriso</option>
                <option value="akwa">Akwa</option>
                <option value="deido">Deido</option>
                <option value="bonamoussadi">Bonamoussadi</option>
                <option value="bepanda">Bepanda</option>
                <option value="makepe">Makepe</option>
                <option value="bonanjo">Bonanjo</option>
                <option value="ndokotti">Ndokotti</option>
                <option value="logbessou">Logbessou</option>
                <option value="kotto">Kotto</option>
              </select>
            </div>

            <div>
              <label className="font-body font-medium text-text mb-2 block">Image du plat</label>
              <input
                data-testid="menu-image-input"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="w-full bg-white border-2 border-stone-200 rounded-xl px-4 py-3 focus:border-primary focus:outline-none font-body"
              />
              {formData.image_base64 && (
                <div className="mt-4 rounded-xl overflow-hidden">
                  <img src={formData.image_base64} alt="Preview" className="w-full h-48 object-cover" />
                </div>
              )}
            </div>

            <button
              data-testid="create-menu-btn"
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white rounded-full py-4 font-heading text-xl tracking-wide shadow-lg hover:scale-105 active:scale-95 transition-transform disabled:opacity-50"
            >
              {loading ? 'Création...' : 'Créer le menu'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// ==================== CHECKOUT PAGE ====================
// ==================== PAYMENT SUCCESS PAGE ====================
const PaymentSuccessPage = () => {
  const navigate = useNavigate();
  const { clearCart } = useCart();
  const hasFetched = useRef(false);

  useEffect(() => {
    // Guard: ne s'exécute QU'UNE SEULE FOIS au montage, peu importe que
    // clearCart soit recréé à chaque render du CartProvider.
    if (hasFetched.current) return;
    hasFetched.current = true;
    clearCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen p-6 flex items-center justify-center">
      
      <div className="max-w-lg mx-auto text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="font-heading text-4xl text-text mb-4" data-testid="payment-success-title">
          Paiement réussi !
        </h1>
        <p className="font-body text-text-muted mb-6">
          Votre commande a été confirmée et sera préparée sous peu
        </p>
        
        <div className="bg-success/10 rounded-2xl p-6 mb-6 border-2 border-success">
          <div className="flex items-center justify-center gap-2 mb-3">
            <CheckCircle size={24} className="text-success" />
            <p className="font-body font-bold text-success">Commande confirmée</p>
          </div>
          <p className="font-body text-sm text-text-muted">
            Vous recevrez un SMS de confirmation avec les détails de livraison
          </p>
        </div>

        <div className="space-y-3">
          <button
            data-testid="track-order-btn"
            onClick={() => navigate('/orders')}
            className="w-full bg-primary text-white rounded-full py-4 font-heading text-xl tracking-wide shadow-lg hover:scale-105 active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            <Package size={24} />
            Suivre ma commande
          </button>
          
          <button
            data-testid="back-home-success-btn"
            onClick={() => navigate('/')}
            className="w-full bg-white border-2 border-stone-200 text-text rounded-full py-4 font-body font-medium hover:border-primary hover:text-primary transition-colors"
          >
            Retour à l&apos;accueil
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== DELIVERY LOGIN PAGE ====================
// ==================== DELIVERY DASHBOARD PAGE ====================
const DeliveryWalletPanel = () => {
  const [showWithdrawal, setShowWithdrawal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('delivery_token');
    if (!token) return;
    axios.get(`${API}/wallet/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setBalance(Number(res.data?.balance || 0)))
      .catch(() => setBalance(0));
  }, [refreshKey]);

  return (
    <div className="space-y-6 mb-6" data-testid="delivery-wallet-tab">
      <WalletCard
        role="delivery"
        onOpenWithdraw={() => setShowWithdrawal(true)}
        refreshKey={refreshKey}
      />
      <WithdrawalModal
        open={showWithdrawal}
        onClose={() => setShowWithdrawal(false)}
        onSuccess={() => setRefreshKey(k => k + 1)}
        balance={balance}
        role="delivery"
      />
      <div>
        <h3 className="font-bold text-gray-900 mb-3">Mes demandes de retrait</h3>
        <WithdrawalsList role="delivery" refreshKey={refreshKey} />
      </div>
      <div>
        <h3 className="font-bold text-gray-900 mb-3">Historique</h3>
        <TransactionsList role="delivery" refreshKey={refreshKey} />
      </div>
    </div>
  );
};

const DeliveryDashboardPage = () => {
  const navigate = useNavigate();
  const [delivery, setDelivery] = useState(null);

  // Real-time wallet notifications for this delivery user
  useWalletNotifications(delivery?.id || null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const deliveryData = localStorage.getItem('delivery_data');
    if (!deliveryData || deliveryData === 'undefined' || deliveryData === 'null') {
      navigate('/delivery/login');
      return;
    }
    try {
      setDelivery(JSON.parse(deliveryData));
      fetchOrders();
    } catch (error) {
      console.error('Error parsing delivery data:', error);
      localStorage.removeItem('delivery_data');
      localStorage.removeItem('delivery_token');
      navigate('/delivery/login');
    }
  }, [navigate]);

  const fetchOrders = async () => {
    const token = localStorage.getItem('delivery_token');
    if (!token) {
      navigate('/delivery/login');
      return;
    }

    try {
      const response = await axios.get(`${API}/delivery/my-orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(response.data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      // If no orders endpoint, use mock data
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('delivery_token');
    localStorage.removeItem('delivery_data');
    navigate('/');
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    const token = localStorage.getItem('delivery_token');
    try {
      await axios.put(`${API}/orders/${orderId}/status`, 
        { order_status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Statut mis à jour !');
      fetchOrders();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const toggleOnlineStatus = async () => {
    const token = localStorage.getItem('delivery_token');
    try {
      await axios.put(`${API}/delivery/status`, 
        { is_available: !isOnline },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setIsOnline(!isOnline);
      toast.success(isOnline ? 'Vous êtes maintenant hors ligne' : 'Vous êtes maintenant en ligne');
    } catch (error) {
      console.error('Error updating status:', error);
      setIsOnline(!isOnline); // Toggle locally even if API fails
    }
  };

  const pendingOrders = orders.filter(o => ['confirmed', 'ready'].includes(o.order_status));
  const activeOrders = orders.filter(o => o.order_status === 'in_delivery');
  const completedOrders = orders.filter(o => o.order_status === 'delivered');

  const stats = {
    today: completedOrders.filter(o => {
      const orderDate = new Date(o.created_at);
      const today = new Date();
      return orderDate.toDateString() === today.toDateString();
    }).length,
    earnings: completedOrders.reduce((sum, o) => sum + (o.delivery_fee || 500), 0),
    rating: 4.8
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center">
          <RefreshCw size={40} className="animate-spin text-primary mx-auto mb-4" />
          <p className="font-body text-text-muted">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-24">
      
      {/* Header */}
      <div className="bg-primary text-white p-6 pb-20">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <Truck size={24} />
              </div>
              <div>
                <p className="font-body text-sm opacity-80">Bonjour,</p>
                <h1 className="font-heading text-xl" data-testid="delivery-name">{delivery?.name || 'Livreur'}</h1>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
              data-testid="delivery-logout-btn"
            >
              <LogOut size={24} />
            </button>
          </div>

          {/* Online Toggle */}
          <div className="flex items-center justify-between bg-white/10 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
              <span className="font-body">{isOnline ? 'En ligne' : 'Hors ligne'}</span>
            </div>
            <button
              onClick={toggleOnlineStatus}
              className={`px-6 py-2 rounded-full font-body font-medium transition-all ${isOnline ? 'bg-white text-primary' : 'bg-white/30 text-white'}`}
              data-testid="toggle-online-btn"
            >
              {isOnline ? 'Se déconnecter' : 'Se connecter'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-14">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-100 text-center">
            <p className="font-heading text-2xl text-primary" data-testid="today-deliveries">{stats.today}</p>
            <p className="font-body text-xs text-text-muted">Aujourd'hui</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-100 text-center">
            <p className="font-heading text-2xl text-primary">{stats.earnings.toLocaleString()}</p>
            <p className="font-body text-xs text-text-muted">FCFA gagnés</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-100 text-center">
            <div className="flex items-center justify-center gap-1">
              <Star size={16} className="text-yellow-400 fill-yellow-400" />
              <p className="font-heading text-2xl text-primary">{stats.rating}</p>
            </div>
            <p className="font-body text-xs text-text-muted">Note</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl p-2 mb-6 shadow-sm border border-stone-100">
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: 'pending', label: 'À prendre', count: pendingOrders.length },
              { id: 'active', label: 'En cours', count: activeOrders.length },
              { id: 'completed', label: 'Terminées', count: completedOrders.length },
              { id: 'wallet', label: 'Wallet', count: 0 }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-2 rounded-xl font-body text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-primary text-white' : 'text-text-muted hover:bg-stone-50'}`}
                data-testid={`tab-${tab.id}`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${activeTab === tab.id ? 'bg-white/20' : 'bg-primary/10 text-primary'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Wallet Tab */}
        {activeTab === 'wallet' && (
          <DeliveryWalletPanel />
        )}

        {/* Orders List */}
        <div className="space-y-4">
          {activeTab === 'pending' && (
            pendingOrders.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center border border-stone-100">
                <Package size={48} className="text-stone-300 mx-auto mb-4" />
                <p className="font-body text-text-muted">Aucune commande à prendre</p>
                <p className="font-body text-sm text-text-muted mt-1">Les nouvelles commandes apparaîtront ici</p>
              </div>
            ) : (
              pendingOrders.map(order => (
                <OrderCard 
                  key={order.id} 
                  order={order} 
                  type="pending"
                  onAccept={() => updateOrderStatus(order.id, 'in_delivery')}
                />
              ))
            )
          )}

          {activeTab === 'active' && (
            activeOrders.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center border border-stone-100">
                <Truck size={48} className="text-stone-300 mx-auto mb-4" />
                <p className="font-body text-text-muted">Aucune livraison en cours</p>
              </div>
            ) : (
              activeOrders.map(order => (
                <OrderCard 
                  key={order.id} 
                  order={order} 
                  type="active"
                  onComplete={() => updateOrderStatus(order.id, 'delivered')}
                />
              ))
            )
          )}

          {activeTab === 'completed' && (
            completedOrders.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center border border-stone-100">
                <CheckCircle size={48} className="text-stone-300 mx-auto mb-4" />
                <p className="font-body text-text-muted">Aucune livraison terminée</p>
              </div>
            ) : (
              completedOrders.slice(0, 10).map(order => (
                <OrderCard 
                  key={order.id} 
                  order={order} 
                  type="completed"
                />
              ))
            )
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 p-4 safe-area-bottom">
        <div className="max-w-lg mx-auto flex justify-around">
          <button className="flex flex-col items-center gap-1 text-primary">
            <Package size={24} />
            <span className="font-body text-xs">Commandes</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-text-muted">
            <RouteIcon size={24} />
            <span className="font-body text-xs">Historique</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-text-muted">
            <User size={24} />
            <span className="font-body text-xs">Profil</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================== ORDER CARD COMPONENT ====================
const OrderCard = ({ order, type, onAccept, onComplete }) => {
  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    ready: 'bg-purple-100 text-purple-800',
    in_delivery: 'bg-primary/10 text-primary',
    delivered: 'bg-green-100 text-green-800'
  };

  const statusLabels = {
    pending: 'En attente',
    confirmed: 'Confirmée',
    ready: 'Prêt',
    in_delivery: 'En livraison',
    delivered: 'Livrée'
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-100" data-testid={`order-card-${order.id}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-heading text-lg text-text">#{order.order_number || order.id.slice(-6)}</p>
          <p className="font-body text-sm text-text-muted">{order.vendor_name}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[order.order_status] || statusColors.pending}`}>
          {statusLabels[order.order_status] || 'En attente'}
        </span>
      </div>

      {/* Items */}
      <div className="bg-stone-50 rounded-xl p-3 mb-3">
        {order.items?.slice(0, 2).map((item, idx) => (
          <div key={idx} className="flex justify-between items-center py-1">
            <span className="font-body text-sm text-text">{item.menu_name} × {item.quantity}</span>
            <span className="font-body text-sm text-text-muted">{item.subtotal?.toLocaleString()} FCFA</span>
          </div>
        ))}
        {order.items?.length > 2 && (
          <p className="font-body text-xs text-text-muted mt-1">+{order.items.length - 2} autre(s) article(s)</p>
        )}
      </div>

      {/* Customer Info */}
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-2 text-text-muted">
          <User size={16} />
          <span className="font-body text-sm">{order.customer_name}</span>
        </div>
        <div className="flex items-center gap-2 text-text-muted">
          <Phone size={16} />
          <span className="font-body text-sm">{order.customer_phone}</span>
        </div>
      </div>

      {/* Address */}
      {order.customer_address && (
        <div className="flex items-start gap-2 text-text-muted mb-3">
          <MapPin size={16} className="flex-shrink-0 mt-0.5" />
          <span className="font-body text-sm">{order.customer_address}</span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-stone-100">
        <div>
          <p className="font-body text-xs text-text-muted">Gain</p>
          <p className="font-heading text-lg text-primary">{(order.delivery_fee || 500).toLocaleString()} FCFA</p>
        </div>

        {type === 'pending' && (
          <button
            onClick={onAccept}
            className="bg-primary text-white px-6 py-2 rounded-full font-body font-medium hover:scale-105 active:scale-95 transition-transform"
            data-testid={`accept-order-${order.id}`}
          >
            Accepter
          </button>
        )}

        {type === 'active' && (
          <div className="flex gap-2">
            <a
              href={`tel:${order.customer_phone}`}
              className="bg-stone-100 text-text p-2 rounded-full hover:bg-stone-200 transition-colors"
            >
              <Phone size={20} />
            </a>
            <button
              onClick={onComplete}
              className="bg-success text-white px-6 py-2 rounded-full font-body font-medium hover:scale-105 active:scale-95 transition-transform flex items-center gap-2"
              data-testid={`complete-order-${order.id}`}
            >
              <CheckCircle size={18} />
              Livré
            </button>
          </div>
        )}

        {type === 'completed' && (
          <div className="flex items-center gap-1 text-success">
            <CheckCircle size={18} />
            <span className="font-body text-sm font-medium">Terminée</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ==================== SUPER ADMIN LOGIN PAGE ====================
const AdminLoginPage = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(`${API}/auth/login`, {
        email: formData.email,
        password: formData.password,
        role: 'admin'
      });
      
      localStorage.setItem('admin_token', response.data.token);
      localStorage.setItem('admin_data', JSON.stringify(response.data.user));
      
      toast.success('Connexion réussie!');
      navigate('/admin/dashboard');
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de la connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6 flex items-center justify-center">
      
      <div className="w-full max-w-md">
        <button
          onClick={() => navigate('/')}
          className="mb-6 flex items-center gap-2 text-white/60 hover:text-white font-body font-medium"
        >
          <ChevronLeft size={20} />
          Retour
        </button>

        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Crown size={40} className="text-slate-800" />
            </div>
            <h1 className="font-heading text-3xl text-text mb-2" data-testid="admin-login-title">Super Admin</h1>
            <p className="font-body text-text-muted">Accès réservé aux administrateurs</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="font-body font-medium text-text mb-2 block">Email</label>
              <input
                data-testid="admin-email-input"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-stone-50 border-2 border-stone-200 rounded-xl px-4 py-3 focus:border-slate-800 focus:bg-white focus:outline-none font-body transition-all"
                placeholder="admin@hemeley.com"
              />
            </div>

            <div>
              <label className="font-body font-medium text-text mb-2 block">Mot de passe</label>
              <div className="relative">
                <input
                  data-testid="admin-password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full bg-stone-50 border-2 border-stone-200 rounded-xl px-4 py-3 focus:border-slate-800 focus:bg-white focus:outline-none font-body transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              data-testid="admin-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full bg-slate-800 text-white rounded-full py-4 font-heading text-xl tracking-wide shadow-lg hover:bg-slate-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw size={20} className="animate-spin" />
                  Connexion...
                </>
              ) : (
                'Se connecter'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// ==================== SUPER ADMIN DASHBOARD ====================
// ==================== MAIN APP ====================
function App() {
  return (
    <div className="App">
      <Toaster position="top-center" richColors />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HemeleyLandingPage />} />
          <Route path="/menu" element={<ModernHomePage CartButton={CartButton} CartModal={CartModal} />} />
          <Route path="/plat/:id" element={<MenuDetailPage />} />
          <Route path="/menu/:slug" element={<PublicMenuPage />} />
          <Route path="/restaurant/:vendorId" element={<RestaurantPage />} />
          <Route path="/vendeur/:vendorId" element={<VendorProfilePage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/payment-status" element={<PaymentStatusPage />} />
          <Route path="/payment-success" element={<PaymentSuccessPage />} />
          <Route path="/confirmation/:id" element={<ConfirmationPage />} />
          <Route path="/client/login" element={<CustomerLoginPage />} />
          <Route path="/client/dashboard" element={<CustomerDashboard />} />
          <Route path="/client/messages/:conversationId" element={<CustomerMessagesPage />} />
          <Route path="/client/messages" element={<CustomerMessagesPage />} />
          <Route path="/vendor" element={<VendorLandingPage />} />
          <Route path="/vendor/login" element={<VendorLoginPage />} />
          <Route path="/vendor/dashboard" element={<VendorDashboard2026 />} />
          <Route path="/vendor/add-menu" element={<VendorAddMenuPage />} />
          <Route path="/delivery/login" element={<DeliveryLoginPage />} />
          <Route path="/delivery/dashboard" element={<DeliveryDashboardPage />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;