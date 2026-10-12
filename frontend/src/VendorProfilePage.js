import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ChevronLeft, Star, Clock, MapPin, Phone, MessageSquare, Heart,
  Share2, ShoppingCart, Plus, Minus, Store, Award, Shield, 
  BadgeCheck, Users, Package, TrendingUp, Calendar, X, Check,
  ChevronRight, Globe, Flame
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { useCart } from './CartContext';
import CoverCarousel from './components/CoverCarousel';
import CategorizedMenuList from './components/CategorizedMenuList';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const VendorProfilePage = () => {
  const { vendorId } = useParams();
  const navigate = useNavigate();
  const { addToCart, cart } = useCart();
  
  const [vendor, setVendor] = useState(null);
  const [menus, setMenus] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [customer, setCustomer] = useState(null);
  
  useEffect(() => {
    const storedCustomer = localStorage.getItem('hemeley_customer');
    if (storedCustomer) setCustomer(JSON.parse(storedCustomer));
  }, []);
  
  useEffect(() => { fetchVendorData(); }, [vendorId]);
  
  useEffect(() => {
    if (customer && vendor) checkFavorite();
  }, [customer, vendor]);
  
  const fetchVendorData = async () => {
    try {
      const response = await axios.get(`${API}/vendors/${vendorId}`);
      setVendor(response.data);
      setMenus(response.data.menus || []);
      setReviews(response.data.reviews || []);
    } catch (error) {
      toast.error('Restaurant non trouvé');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };
  
  const checkFavorite = async () => {
    if (!customer) return;
    try {
      const token = localStorage.getItem('hemeley_customer_token');
      const response = await axios.get(`${API}/customer/favorites/vendors`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsFavorite(response.data.some(v => v.id === vendorId));
    } catch (error) {}
  };
  
  const toggleFavorite = async () => {
    if (!customer) { navigate('/client/login'); return; }
    try {
      const token = localStorage.getItem('hemeley_customer_token');
      if (isFavorite) {
        await axios.delete(`${API}/customer/favorites/vendors/${vendorId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${API}/customer/favorites/vendors/${vendorId}`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setIsFavorite(!isFavorite);
      toast.success(isFavorite ? 'Retiré des favoris' : 'Ajouté aux favoris');
    } catch (error) { toast.error('Erreur'); }
  };
  
  const handleAddToCart = (menu) => {
    addToCart({ ...menu, vendor_id: vendor.id, vendor_name: vendor.name }, quantity);
    setSelectedMenu(null);
    setQuantity(1);
  };
  
  const shareVendor = () => {
    if (navigator.share) {
      navigator.share({ title: vendor?.name, text: `Découvrez ${vendor?.name} sur HEMELEY`, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Lien copié !');
    }
  };
  
  const getMemberSince = () => {
    if (!vendor?.created_at) return 'Membre';
    const d = new Date(vendor.created_at);
    return `Membre depuis ${d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;
  };
  
  const getStanding = () => {
    const orders = vendor?.completed_orders || 0;
    const rate = vendor?.completion_rate || 0;
    if (orders > 100 && rate > 90) return { label: 'Excellence', color: 'text-yellow-600 bg-yellow-50 border-yellow-200', icon: Award };
    if (orders > 50 && rate > 80) return { label: 'Confirmé', color: 'text-blue-600 bg-blue-50 border-blue-200', icon: Shield };
    if (orders > 20) return { label: 'Actif', color: 'text-green-600 bg-green-50 border-green-200', icon: TrendingUp };
    return { label: 'Nouveau', color: 'text-gray-600 bg-gray-50 border-gray-200', icon: Store };
  };
  
  const cartItemCount = cart?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
      </div>
    );
  }
  
  if (!vendor) return null;
  
  const standing = getStanding();
  const StandingIcon = standing.icon;
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors" data-testid="vendor-profile-back">
            <ChevronLeft size={24} />
          </button>
          <div className="flex items-center gap-2">
            <button onClick={shareVendor} className="p-2 hover:bg-gray-100 rounded-full" data-testid="vendor-share-btn">
              <Share2 size={20} />
            </button>
            <button onClick={toggleFavorite} className={`p-2 rounded-full ${isFavorite ? 'text-red-500' : 'hover:bg-gray-100'}`} data-testid="vendor-favorite-btn">
              <Heart size={20} fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
            <button onClick={() => navigate('/checkout')} className="relative p-2 bg-orange-500 text-white rounded-full" data-testid="vendor-cart-btn">
              <ShoppingCart size={20} />
              {cartItemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">{cartItemCount}</span>
              )}
            </button>
          </div>
        </div>
      </header>
      
      {/* Hero Section — Cover Carousel */}
      <div className="bg-white">
        <CoverCarousel
          photos={vendor.cover_photos && vendor.cover_photos.length > 0
            ? vendor.cover_photos
            : (vendor.cover_base64 ? [vendor.cover_base64] : [])}
          logo={vendor.logo_base64}
          brandColor={vendor.brand_color || '#FF6B00'}
          height="h-52 md:h-64"
          testid="vendor-profile-cover"
        />

        <div className="max-w-7xl mx-auto px-4 -mt-16 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end gap-4 md:gap-6">
            {/* Logo */}
            <div className="w-28 h-28 md:w-32 md:h-32 bg-white rounded-2xl shadow-xl flex items-center justify-center border-4 border-white flex-shrink-0 overflow-hidden" data-testid="vendor-logo">
              {vendor.logo_base64 ? (
                <img src={vendor.logo_base64} alt={vendor.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl md:text-5xl font-black text-orange-600">{vendor.name?.charAt(0)}</span>
              )}
            </div>
            
            {/* Info */}
            <div className="flex-1 pb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900" data-testid="vendor-profile-name">{vendor.name}</h1>
                {vendor.is_verified && <BadgeCheck className="text-blue-500" size={22} />}
              </div>
              <div className="flex items-center gap-3 mt-2 flex-wrap text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Star className="text-yellow-400 fill-yellow-400" size={16} />
                  <span className="font-semibold text-gray-900">{vendor.rating || '0.0'}</span>
                  <span>({vendor.review_count || 0} avis)</span>
                </div>
                <span className="text-gray-300">|</span>
                <div className="flex items-center gap-1">
                  <MapPin size={14} />
                  <span>{vendor.zone}</span>
                </div>
                <span className="text-gray-300">|</span>
                <div className="flex items-center gap-1">
                  <Calendar size={14} />
                  <span>{getMemberSince()}</span>
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-2 pb-4">
              <button 
                onClick={() => { if (!customer) { navigate('/client/login'); return; } navigate(`/client/messages?vendor=${vendorId}`); }}
                className="flex items-center gap-2 px-5 py-2.5 border-2 border-gray-200 rounded-xl font-medium hover:border-orange-300 hover:text-orange-600 transition-all text-sm"
                data-testid="vendor-contact-btn"
              >
                <MessageSquare size={16} />
                Contacter
              </button>
              {vendor.phone && (
                <a href={`tel:${vendor.phone}`} className="flex items-center gap-2 px-5 py-2.5 border-2 border-gray-200 rounded-xl font-medium hover:border-orange-300 transition-all text-sm">
                  <Phone size={16} />
                  Appeler
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Trust & Standing Section */}
      <div className="bg-white border-t border-gray-100 mt-2">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Standing Badge */}
            <div className={`flex items-center gap-3 p-4 rounded-xl border ${standing.color}`} data-testid="vendor-standing">
              <StandingIcon size={24} />
              <div>
                <p className="font-bold text-sm">{standing.label}</p>
                <p className="text-xs opacity-70">Niveau vendeur</p>
              </div>
            </div>
            
            {/* Stats */}
            <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
              <Package size={24} className="text-gray-500" />
              <div>
                <p className="font-bold text-sm text-gray-900">{vendor.completed_orders || 0}</p>
                <p className="text-xs text-gray-500">Commandes livrées</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
              <TrendingUp size={24} className="text-green-500" />
              <div>
                <p className="font-bold text-sm text-gray-900">{vendor.completion_rate || 0}%</p>
                <p className="text-xs text-gray-500">Taux de complétion</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
              <Store size={24} className="text-orange-500" />
              <div>
                <p className="font-bold text-sm text-gray-900">{vendor.menu_count || menus.length}</p>
                <p className="text-xs text-gray-500">Menus actifs</p>
              </div>
            </div>
          </div>
          
          {/* Verification Badges */}
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-xs font-medium border border-green-100">
              <Check size={14} />
              Identité vérifiée
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-100">
              <Shield size={14} />
              Paiement sécurisé
            </div>
            {(vendor.completed_orders || 0) > 10 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-full text-xs font-medium border border-amber-100">
                <Award size={14} />
                Vendeur de confiance
              </div>
            )}
            {vendor.phone && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-xs font-medium border border-purple-100">
                <Phone size={14} />
                Téléphone vérifié
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Reviews Summary */}
      {reviews.length > 0 && (
        <div className="bg-white border-t border-gray-100 mt-2">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <h3 className="font-bold text-lg text-gray-900 mb-4">Avis clients</h3>
            <div className="flex items-center gap-6 mb-4">
              <div className="text-center">
                <p className="text-4xl font-bold text-gray-900">{vendor.rating}</p>
                <div className="flex items-center gap-0.5 mt-1 justify-center">
                  {[1,2,3,4,5].map(i => (
                    <Star key={i} size={14} className={i <= Math.round(vendor.rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'} />
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">{vendor.review_count} avis</p>
              </div>
              
              {vendor.rating_breakdown && (
                <div className="flex-1 space-y-1">
                  {[5,4,3,2,1].map(r => {
                    const count = vendor.rating_breakdown[r] || 0;
                    const pct = vendor.review_count > 0 ? (count / vendor.review_count * 100) : 0;
                    return (
                      <div key={r} className="flex items-center gap-2">
                        <span className="text-xs text-gray-600 w-3">{r}</span>
                        <Star size={10} className="text-yellow-400 fill-yellow-400" />
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-yellow-400 rounded-full" style={{width: `${pct}%`}}></div>
                        </div>
                        <span className="text-xs text-gray-500 w-6">{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            {/* Review cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {reviews.slice(0, 4).map(review => (
                <div key={review.id} className="p-4 border border-gray-100 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-orange-600">{review.customer_name?.charAt(0)}</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm text-gray-900">{review.customer_name}</p>
                      <div className="flex items-center gap-0.5">
                        {[1,2,3,4,5].map(i => (
                          <Star key={i} size={10} className={i <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'} />
                        ))}
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">{review.created_at ? new Date(review.created_at).toLocaleDateString('fr-FR') : ''}</span>
                  </div>
                  {review.comment && <p className="text-sm text-gray-600 line-clamp-2">{review.comment}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* Menus Section */}
      <div className="bg-white border-t border-gray-100 mt-2">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg text-gray-900" data-testid="vendor-menus-title">
              Tous les menus ({menus.length})
            </h3>
          </div>
          
          {menus.length === 0 ? (
            <div className="text-center py-16">
              <Store size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">Aucun menu disponible pour le moment</p>
            </div>
          ) : (
            <CategorizedMenuList
              menus={menus}
              customCategories={vendor.custom_categories || []}
              accentColor={vendor.brand_color || '#FF6B00'}
              testid="vendor-profile-menu-list"
              renderItem={(menu) => (
                <div
                  key={menu.id}
                  data-testid={`vendor-menu-card-${menu.id}`}
                  className="group bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-lg hover:border-orange-100 transition-all flex sm:block"
                >
                  <div className="w-32 sm:w-full aspect-square bg-gray-100 overflow-hidden relative flex-shrink-0">
                    {menu.image_base64 ? (
                      <img
                        src={menu.image_base64.startsWith('data:') ? menu.image_base64 : `data:image/jpeg;base64,${menu.image_base64}`}
                        alt={menu.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-5xl bg-gradient-to-br from-orange-50 to-amber-50">
                        <Store size={40} className="text-gray-300" />
                      </div>
                    )}
                    {menu.remaining_portions <= 3 && menu.remaining_portions > 0 && (
                      <div className="absolute top-3 right-3 flex items-center gap-1 bg-red-500 text-white px-2.5 py-1 rounded-full text-xs font-bold">
                        <Flame size={12} />
                        Derniers !
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex-1">
                    <h4 className="font-bold text-gray-900 text-base mb-1 line-clamp-1">{menu.name}</h4>
                    <p className="text-xs text-gray-500 mb-3 line-clamp-2 min-h-[2rem]">{menu.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-orange-600">{menu.price?.toLocaleString()} <span className="text-xs font-normal">FCFA</span></span>
                      <button
                        onClick={() => setSelectedMenu(menu)}
                        disabled={menu.remaining_portions === 0}
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-all ${
                          menu.remaining_portions === 0
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-orange-500 text-white hover:bg-orange-600 active:scale-95'
                        }`}
                      >
                        <Plus size={16} />
                        Ajouter
                      </button>
                    </div>
                    <div className="mt-2">
                      <span className="text-xs text-gray-400">{menu.remaining_portions} portion{menu.remaining_portions > 1 ? 's' : ''} restante{menu.remaining_portions > 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>
              )}
            />
          )}
        </div>
      </div>
      
      {/* Add to Cart Modal */}
      {selectedMenu && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full sm:w-96 sm:rounded-2xl rounded-t-2xl max-h-[80vh] overflow-y-auto">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Ajouter au panier</h3>
                <button onClick={() => { setSelectedMenu(null); setQuantity(1); }} className="p-2 hover:bg-gray-100 rounded-full">
                  <X size={20} />
                </button>
              </div>
              
              {selectedMenu.image_base64 && (
                <img 
                  src={selectedMenu.image_base64.startsWith('data:') ? selectedMenu.image_base64 : `data:image/jpeg;base64,${selectedMenu.image_base64}`}
                  alt={selectedMenu.name}
                  className="w-full h-48 object-cover rounded-xl mb-4"
                />
              )}
              
              <h4 className="font-bold text-gray-900">{selectedMenu.name}</h4>
              <p className="text-sm text-gray-500 mt-1">{selectedMenu.description}</p>
              
              <div className="flex items-center justify-between mt-6">
                <div className="flex items-center gap-4">
                  <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50">
                    <Minus size={18} />
                  </button>
                  <span className="text-xl font-bold">{quantity}</span>
                  <button onClick={() => setQuantity(q => q + 1)} className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50">
                    <Plus size={18} />
                  </button>
                </div>
                <span className="text-xl font-bold text-orange-600">{(selectedMenu.price * quantity).toLocaleString()} FCFA</span>
              </div>
              
              <button
                onClick={() => handleAddToCart(selectedMenu)}
                className="w-full mt-6 py-4 bg-orange-500 text-white rounded-full font-bold hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
              >
                <ShoppingCart size={20} />
                Ajouter au panier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorProfilePage;
