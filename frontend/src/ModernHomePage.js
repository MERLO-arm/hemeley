import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { 
  Clock, MapPin, Search, ChevronRight, Star, Plus, Filter,
  ShoppingCart, User, LogOut, BadgeCheck, Flame, X, SlidersHorizontal
} from 'lucide-react';
import { toast } from 'sonner';
import { useCart } from './CartContext';
import FoodChatBot from './FoodChatBot';
import HemeleyLogo from './HemeleyLogo';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
const API = `${BACKEND_URL}/api`;

const zones = [
  { id: 'bonapriso', name: 'Bonapriso', icon: '🏙️' },
  { id: 'akwa', name: 'Akwa', icon: '🌊' },
  { id: 'deido', name: 'Deido', icon: '🎭' },
  { id: 'bonamoussadi', name: 'Bonamoussadi', icon: '🌳' },
  { id: 'bepanda', name: 'Bepanda', icon: '🏪' },
  { id: 'makepe', name: 'Makepe', icon: '🏘️' },
  { id: 'bonanjo', name: 'Bonanjo', icon: '🏛️' },
  { id: 'ndokotti', name: 'Ndokotti', icon: '🚏' },
  { id: 'logbessou', name: 'Logbessou', icon: '🌅' },
  { id: 'kotto', name: 'Kotto', icon: '🏡' }
];

const categories = [
  { id: 'all', name: 'Tout', icon: '🍽️' },
  { id: 'plat', name: 'Plats', icon: '🥘' },
  { id: 'petit-dejeuner', name: 'Petit-déj', icon: '🥐' },
  { id: 'boisson', name: 'Boissons', icon: '🥤' },
  { id: 'dessert', name: 'Desserts', icon: '🍰' },
  { id: 'snack', name: 'Snacks', icon: '🌯' }
];

const sortOptions = [
  { id: 'popular', name: 'Populaire' },
  { id: 'price_asc', name: 'Prix ↑' },
  { id: 'price_desc', name: 'Prix ↓' },
  { id: 'rating', name: 'Meilleur avis' },
  { id: 'newest', name: 'Plus récent' }
];

const ModernHomePage = ({ CartButton, CartModal }) => {
  const [selectedZone, setSelectedZone] = useState('');
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('popular');
  const [showFilters, setShowFilters] = useState(false);
  const [customer, setCustomer] = useState(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addToCart, cart } = useCart();

  // Preload query from landing-page hero (?q=... &category=...)
  useEffect(() => {
    const q = searchParams.get('q');
    const cat = searchParams.get('category');
    if (q) setSearchQuery(q);
    if (cat) setSelectedCategory(cat);
  }, [searchParams]);

  useEffect(() => {
    const stored = localStorage.getItem('hemeley_customer');
    if (stored) setCustomer(JSON.parse(stored));
    fetchAllMenus();
  }, []);

  useEffect(() => {
    if (selectedZone) fetchMenusByZone();
    else fetchAllMenus();
  }, [selectedZone]);

  const fetchAllMenus = async () => {
    setLoading(true);
    try {
      const promises = zones.map(z => axios.get(`${API}/menus?zone=${z.id}`).catch(() => ({ data: [] })));
      const results = await Promise.all(promises);
      const all = results.flatMap(r => r.data || []);
      setMenus(all);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMenusByZone = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/menus?zone=${selectedZone}`);
      setMenus(res.data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMenus = useMemo(() => {
    let result = [...menus];
    
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(m => 
        m.name.toLowerCase().includes(q) || 
        m.vendor_name?.toLowerCase().includes(q) ||
        m.description?.toLowerCase().includes(q)
      );
    }
    
    // Category filter
    if (selectedCategory !== 'all') {
      result = result.filter(m => (m.category || 'plat') === selectedCategory);
    }
    
    // Sort
    switch (sortBy) {
      case 'price_asc': result.sort((a, b) => a.price - b.price); break;
      case 'price_desc': result.sort((a, b) => b.price - a.price); break;
      case 'rating': result.sort((a, b) => (b.vendor_rating || 0) - (a.vendor_rating || 0)); break;
      case 'newest': result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); break;
      default: result.sort((a, b) => (b.remaining_portions > 0 ? 1 : 0) - (a.remaining_portions > 0 ? 1 : 0));
    }
    
    return result;
  }, [menus, searchQuery, selectedCategory, sortBy]);

  const handleAddToCart = (menu) => {
    // Pass the raw menu object — CartContext.addToCart reads menu.id, menu.name, etc.
    addToCart(menu);
  };

  const handleLogout = () => {
    localStorage.removeItem('hemeley_customer');
    localStorage.removeItem('hemeley_customer_token');
    setCustomer(null);
    toast.success('Déconnecté');
  };

  const cartCount = cart?.items?.reduce((s, i) => s + i.quantity, 0) || 0;

  const heroImages = [
    'https://images.unsplash.com/photo-1765584829902-51939816637c?w=800&q=80',
    'https://images.pexels.com/photos/36458103/pexels-photo-36458103.jpeg?auto=compress&w=800',
    'https://images.unsplash.com/photo-1562259819-3ffa9f9a77f3?w=800&q=80',
    'https://images.pexels.com/photos/14090826/pexels-photo-14090826.jpeg?auto=compress&w=800'
  ];
  const [heroIndex, setHeroIndex] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setHeroIndex(i => (i + 1) % heroImages.length), 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" data-testid="logo-link">
            <HemeleyLogo size={32} />
          </Link>
          
          {/* Search bar - desktop */}
          <div className="hidden md:flex flex-1 max-w-xl mx-6">
            <div className="relative w-full">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un plat, un restaurant..."
                data-testid="search-input"
                className="w-full pl-10 pr-4 py-2.5 bg-gray-100 rounded-full border-0 text-sm focus:bg-white focus:ring-2 focus:ring-orange-200 transition-all"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X size={16} className="text-gray-400" />
                </button>
              )}
            </div>
          </div>
          
          {/* Right side */}
          <div className="flex items-center gap-3">
            {customer ? (
              <div className="flex items-center gap-3">
                <Link to="/client/dashboard" className="flex items-center gap-2 px-3 py-2 bg-orange-50 rounded-full hover:bg-orange-100 transition-colors" data-testid="user-profile-link">
                  <User size={18} className="text-orange-600" />
                  <span className="text-sm font-medium text-orange-700 hidden sm:inline">{customer.pseudo}</span>
                </Link>
                <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-gray-600" data-testid="logout-btn">
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <Link to="/client/login" className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-full text-sm font-medium hover:bg-orange-600 transition-colors" data-testid="login-btn">
                <User size={16} />
                <span>Connexion</span>
              </Link>
            )}
            
            <button onClick={() => setShowCart(true)} className="relative p-2 hover:bg-gray-100 rounded-full" data-testid="cart-btn">
              <ShoppingCart size={22} className="text-gray-700" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-orange-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">{cartCount}</span>
              )}
            </button>
          </div>
        </div>
        
        {/* Mobile search */}
        <div className="md:hidden px-4 pb-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher..."
              className="w-full pl-9 pr-4 py-2 bg-gray-100 rounded-full text-sm"
            />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-slate-900" style={{height: '280px'}}>
        {heroImages.map((img, i) => (
          <img
            key={i}
            src={img}
            alt=""
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${i === heroIndex ? 'opacity-100' : 'opacity-0'}`}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
        <div className="absolute bottom-0 left-0 right-0 p-6 max-w-7xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-black text-white mb-2 leading-tight">
            Le street food de <span className="text-orange-400">Douala</span>,<br className="sm:hidden" /> livré chez vous
          </h1>
          <p className="text-white/70 text-sm md:text-base max-w-xl">
            Découvrez les meilleurs plats de rue de chaque quartier. Commandez en quelques clics.
          </p>
        </div>
        {/* Dots */}
        <div className="absolute bottom-3 right-6 flex gap-1.5">
          {heroImages.map((_, i) => (
            <button key={i} onClick={() => setHeroIndex(i)} className={`w-2 h-2 rounded-full transition-all ${i === heroIndex ? 'bg-orange-400 w-5' : 'bg-white/40'}`}></button>
          ))}
        </div>
      </div>

      {/* Zones - Horizontal scroll */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setSelectedZone('')}
              data-testid="zone-all"
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                !selectedZone ? 'bg-orange-500 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Tous les quartiers
            </button>
            {zones.map(z => (
              <button
                key={z.id}
                onClick={() => setSelectedZone(z.id === selectedZone ? '' : z.id)}
                data-testid={`zone-${z.id}`}
                className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedZone === z.id ? 'bg-orange-500 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span>{z.icon}</span>
                <span>{z.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                data-testid={`category-${cat.id}`}
                className={`flex-shrink-0 flex flex-col items-center gap-1 px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                  selectedCategory === cat.id ? 'bg-orange-50 text-orange-600 border-2 border-orange-200' : 'bg-gray-50 text-gray-600 border-2 border-transparent hover:bg-gray-100'
                }`}
              >
                <span className="text-xl">{cat.icon}</span>
                <span>{cat.name}</span>
              </button>
            ))}
            
            {/* Sort / Filter */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              data-testid="filter-btn"
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium bg-gray-50 text-gray-600 border-2 border-transparent hover:bg-gray-100 ml-auto"
            >
              <SlidersHorizontal size={14} />
              <span>Trier</span>
            </button>
          </div>
          
          {showFilters && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {sortOptions.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => { setSortBy(opt.id); setShowFilters(false); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    sortBy === opt.id ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {opt.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Results count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            {filteredMenus.length} résultat{filteredMenus.length !== 1 ? 's' : ''}
            {selectedZone && ` à ${zones.find(z => z.id === selectedZone)?.name}`}
            {searchQuery && ` pour "${searchQuery}"`}
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse">
                <div className="aspect-[4/3] bg-gray-200"></div>
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredMenus.length === 0 ? (
          <div className="text-center py-20">
            <span className="text-6xl block mb-4">🍽️</span>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Aucun menu trouvé</h3>
            <p className="text-gray-500">Essayez un autre quartier ou une autre catégorie</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5" data-testid="menu-grid">
            {filteredMenus.map(menu => (
              <div
                key={menu.id}
                data-testid={`menu-card-${menu.id}`}
                className="group bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-xl hover:border-orange-100 transition-all duration-300"
              >
                {/* Image */}
                <Link to={`/plat/${menu.id}`} className="block">
                  <div className="aspect-[4/3] bg-gray-100 overflow-hidden relative">
                    {menu.image_base64 ? (
                      <img
                        src={menu.image_base64.startsWith('data:') ? menu.image_base64 : `data:image/jpeg;base64,${menu.image_base64}`}
                        alt={menu.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
                        <span className="text-5xl">🍛</span>
                      </div>
                    )}
                    
                    {/* Discount badge */}
                    {(menu.discount_percent || menu.original_price) && (
                      <div className="absolute top-3 left-3 bg-red-500 text-white px-2.5 py-1 rounded-full text-xs font-bold">
                        -{menu.discount_percent || Math.round((1 - menu.price / menu.original_price) * 100)}%
                      </div>
                    )}
                    
                    {/* Low stock badge */}
                    {menu.remaining_portions > 0 && menu.remaining_portions <= 3 && (
                      <div className="absolute top-3 right-3 flex items-center gap-1 bg-amber-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                        <Flame size={12} />
                        {menu.remaining_portions} restant{menu.remaining_portions > 1 ? 's' : ''}
                      </div>
                    )}
                    
                    {menu.remaining_portions === 0 && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="bg-white/90 text-gray-800 px-4 py-2 rounded-full font-bold text-sm">Épuisé</span>
                      </div>
                    )}
                  </div>
                </Link>
                
                {/* Content */}
                <div className="p-4">
                  {/* Vendor */}
                  <Link 
                    to={`/vendeur/${menu.vendor_id}`}
                    className="flex items-center gap-1.5 mb-2 group/vendor"
                    data-testid={`vendor-link-${menu.vendor_id}`}
                  >
                    <span className="text-xs font-medium text-gray-500 group-hover/vendor:text-orange-600 transition-colors">{menu.vendor_name}</span>
                    {menu.vendor_verified && <BadgeCheck size={13} className="text-blue-500" />}
                  </Link>
                  
                  {/* Name */}
                  <Link to={`/plat/${menu.id}`}>
                    <h3 className="font-bold text-gray-900 text-base mb-1 line-clamp-1 group-hover:text-orange-600 transition-colors">{menu.name}</h3>
                  </Link>
                  <p className="text-xs text-gray-500 mb-3 line-clamp-2 min-h-[2rem]">{menu.description}</p>
                  
                  {/* Rating + Zone */}
                  <div className="flex items-center gap-2 mb-3 text-xs text-gray-500">
                    <div className="flex items-center gap-0.5">
                      <Star size={12} className="text-yellow-400 fill-yellow-400" />
                      <span className="font-medium text-gray-700">{menu.vendor_rating || '4.5'}</span>
                    </div>
                    <span>•</span>
                    <div className="flex items-center gap-0.5">
                      <MapPin size={11} />
                      <span className="capitalize">{menu.zone}</span>
                    </div>
                    <span>•</span>
                    <div className="flex items-center gap-0.5">
                      <Clock size={11} />
                      <span>20-30 min</span>
                    </div>
                  </div>
                  
                  {/* Price + Add button */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-orange-600">{menu.price?.toLocaleString()}</span>
                      <span className="text-xs text-gray-500">FCFA</span>
                      {menu.original_price && menu.original_price > menu.price && (
                        <span className="text-sm text-gray-400 line-through">{menu.original_price?.toLocaleString()}</span>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.preventDefault(); handleAddToCart(menu); }}
                      disabled={menu.remaining_portions === 0}
                      data-testid={`add-to-cart-${menu.id}`}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                        menu.remaining_portions === 0 
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-orange-500 text-white hover:bg-orange-600 active:scale-90 shadow-md shadow-orange-200'
                      }`}
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-white mt-12">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <HemeleyLogo size={36} variant="dark" />
              <p className="text-slate-400 text-sm mt-3">La plateforme de découverte et commande de street food à Douala.</p>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-3 uppercase tracking-wider text-slate-300">Client</h4>
              <div className="space-y-2">
                <Link to="/client/login" className="block text-sm text-slate-400 hover:text-orange-400 transition-colors" data-testid="footer-client-link">Se connecter / S'inscrire</Link>
                <Link to="/client/dashboard" className="block text-sm text-slate-400 hover:text-orange-400 transition-colors">Mon espace</Link>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-3 uppercase tracking-wider text-slate-300">Vendeur</h4>
              <div className="space-y-2">
                <Link to="/vendor/login" className="block text-sm text-slate-400 hover:text-orange-400 transition-colors" data-testid="footer-vendor-link">Espace vendeur</Link>
                <Link to="/vendor" className="block text-sm text-slate-400 hover:text-orange-400 transition-colors">Devenir vendeur</Link>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-3 uppercase tracking-wider text-slate-300">Livreur</h4>
              <div className="space-y-2">
                <Link to="/delivery/login" className="block text-sm text-slate-400 hover:text-orange-400 transition-colors" data-testid="footer-delivery-link">Espace livreur</Link>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-8 pt-6 text-center">
            <p className="text-slate-500 text-xs">&copy; 2026 HEMELEY. Tous droits réservés.</p>
          </div>
        </div>
      </footer>

      {/* Cart Modal */}
      {showCart && <CartModal isOpen={showCart} onClose={() => setShowCart(false)} />}
      
      {/* ChatBot */}
      <FoodChatBot />
    </div>
  );
};

export default ModernHomePage;
