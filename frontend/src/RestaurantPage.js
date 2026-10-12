import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ChevronLeft, Star, Clock, MapPin, Phone, MessageSquare, Heart,
  Share2, ShoppingCart, Plus, Minus, ChevronRight, Store, Award,
  Check, X, BadgeCheck
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { useCart } from './CartContext';
import CoverCarousel from './components/CoverCarousel';
import CategorizedMenuList from './components/CategorizedMenuList';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const RestaurantPage = () => {
  const { vendorId } = useParams();
  const navigate = useNavigate();
  const { addToCart, cart } = useCart();
  
  // Redirect to new VendorProfilePage
  useEffect(() => {
    navigate(`/vendeur/${vendorId}`, { replace: true });
  }, [vendorId, navigate]);
  
  const [vendor, setVendor] = useState(null);
  const [menus, setMenus] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [activeTab, setActiveTab] = useState('menus');
  const [selectedMenu, setSelectedMenu] = useState(null);
  const [quantity, setQuantity] = useState(1);
  
  // Customer auth state
  const [customer, setCustomer] = useState(null);
  
  useEffect(() => {
    const storedCustomer = localStorage.getItem('hemeley_customer');
    if (storedCustomer) {
      setCustomer(JSON.parse(storedCustomer));
    }
  }, []);
  
  useEffect(() => {
    fetchVendorData();
  }, [vendorId]);
  
  useEffect(() => {
    if (customer && vendor) {
      checkFavorite();
    }
  }, [customer, vendor]);
  
  const fetchVendorData = async () => {
    try {
      const response = await axios.get(`${API}/vendors/${vendorId}`);
      setVendor(response.data);
      setMenus(response.data.menus || []);
      setReviews(response.data.reviews || []);
    } catch (error) {
      toast.error('Erreur lors du chargement du restaurant');
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
    } catch (error) {
      console.error('Error checking favorite:', error);
    }
  };
  
  const toggleFavorite = async () => {
    if (!customer) {
      toast.error('Connectez-vous pour ajouter aux favoris');
      navigate('/client/login');
      return;
    }
    
    try {
      const token = localStorage.getItem('hemeley_customer_token');
      if (isFavorite) {
        await axios.delete(`${API}/customer/favorites/vendors/${vendorId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Retiré des favoris');
      } else {
        await axios.post(`${API}/customer/favorites/vendors/${vendorId}`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Ajouté aux favoris');
      }
      setIsFavorite(!isFavorite);
    } catch (error) {
      toast.error('Erreur');
    }
  };
  
  const handleAddToCart = (menu) => {
    addToCart({ ...menu, vendor_id: vendor.id, vendor_name: vendor.name }, quantity);
    setSelectedMenu(null);
    setQuantity(1);
  };
  
  const startConversation = () => {
    if (!customer) {
      toast.error('Connectez-vous pour envoyer un message');
      navigate('/client/login');
      return;
    }
    navigate(`/client/messages?vendor=${vendorId}`);
  };
  
  const shareRestaurant = () => {
    if (navigator.share) {
      navigator.share({
        title: vendor?.name,
        text: `Découvrez ${vendor?.name} sur HEMELEY`,
        url: window.location.href
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Lien copié !');
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
      </div>
    );
  }
  
  if (!vendor) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Store size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">Restaurant non trouvé</p>
          <Link to="/" className="text-orange-600 mt-4 inline-block">Retour à l'accueil</Link>
        </div>
      </div>
    );
  }
  
  const cartItemCount = cart?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full">
            <ChevronLeft size={24} />
          </button>
          <div className="flex items-center gap-3">
            <button onClick={shareRestaurant} className="p-2 hover:bg-gray-100 rounded-full">
              <Share2 size={20} />
            </button>
            <button 
              onClick={toggleFavorite} 
              className={`p-2 rounded-full ${isFavorite ? 'text-red-500' : 'hover:bg-gray-100'}`}
            >
              <Heart size={20} fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
            <button 
              onClick={() => navigate('/checkout')}
              className="relative p-2 bg-orange-500 text-white rounded-full"
            >
              <ShoppingCart size={20} />
              {cartItemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                  {cartItemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>
      
      {/* Restaurant Banner & Info */}
      <div className="bg-white">
        {/* Cover carousel (up to 3 photos) */}
        <div className="relative">
          <CoverCarousel
            photos={vendor.cover_photos && vendor.cover_photos.length > 0
              ? vendor.cover_photos
              : (vendor.cover_base64 ? [vendor.cover_base64] : [])}
            logo={vendor.logo_base64}
            brandColor={vendor.brand_color || '#FF6B00'}
            height="h-48"
            testid="restaurant-cover"
          />
          {/* Restaurant logo overlaid */}
          <div className="absolute bottom-0 left-4 transform translate-y-1/2">
            <div className="w-24 h-24 bg-white rounded-2xl shadow-lg flex items-center justify-center border-4 border-white overflow-hidden">
              {vendor.logo_base64 ? (
                <img src={vendor.logo_base64} alt={vendor.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-orange-600">{vendor.name.charAt(0)}</span>
              )}
            </div>
          </div>
        </div>
        
        {/* Restaurant Info */}
        <div className="px-4 pt-16 pb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">{vendor.name}</h1>
                {vendor.is_verified && (
                  <BadgeCheck className="text-blue-500" size={20} />
                )}
              </div>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Star className="text-yellow-400 fill-yellow-400" size={16} />
                  <span className="font-medium">{vendor.rating || 0}</span>
                  <span>({vendor.review_count || 0} avis)</span>
                </div>
                <div className="flex items-center gap-1">
                  <MapPin size={16} />
                  <span>{vendor.zone}</span>
                </div>
              </div>
            </div>
            
            <button 
              onClick={startConversation}
              className="flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-600 rounded-full font-medium hover:bg-orange-200 transition-colors"
            >
              <MessageSquare size={18} />
              <span className="hidden sm:inline">Contacter</span>
            </button>
          </div>
          
          {/* Quick Info */}
          <div className="flex items-center gap-4 mt-4 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock size={16} />
              <span>10h - 15h</span>
            </div>
            {vendor.phone && (
              <a href={`tel:${vendor.phone}`} className="flex items-center gap-2 text-sm text-gray-600">
                <Phone size={16} />
                <span>{vendor.phone}</span>
              </a>
            )}
          </div>
          
          {/* Loyalty Badge */}
          {customer && (
            <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg border border-amber-100">
              <Award className="text-amber-500" size={18} />
              <span className="text-sm text-amber-700">
                Gagnez des points de fidélité sur chaque commande !
              </span>
            </div>
          )}
        </div>
        
        {/* Tabs */}
        <div className="border-b">
          <div className="px-4 flex gap-6">
            {[
              { id: 'menus', label: 'Menus', count: menus.length },
              { id: 'reviews', label: 'Avis', count: reviews.length }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 border-b-2 transition-colors ${
                  activeTab === tab.id 
                    ? 'border-orange-500 text-orange-600 font-medium' 
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {activeTab === 'menus' && (
          <div>
            {menus.length === 0 ? (
              <div className="text-center py-12">
                <Store size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">Aucun menu disponible pour le moment</p>
              </div>
            ) : (
              <CategorizedMenuList
                menus={menus}
                customCategories={vendor.custom_categories || []}
                accentColor={vendor.brand_color || '#FF6B00'}
                testid="restaurant-menu-list"
                renderItem={(menu) => (
                  <div
                    key={menu.id}
                    className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 hover:shadow-md transition-shadow"
                  >
                    <div className="flex">
                      <div className="w-32 h-32 sm:w-40 sm:h-40 flex-shrink-0 bg-gray-100">
                        {menu.image_base64 ? (
                          <img
                            src={menu.image_base64.startsWith('data:') ? menu.image_base64 : `data:image/jpeg;base64,${menu.image_base64}`}
                            alt={menu.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <Store size={32} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 p-4 flex flex-col justify-between">
                        <div>
                          <h3 className="font-bold text-gray-900">{menu.name}</h3>
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{menu.description}</p>
                          {menu.remaining_portions <= 5 && menu.remaining_portions > 0 && (
                            <span className="text-xs text-orange-600 font-medium">
                              Plus que {menu.remaining_portions} portions !
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-lg font-bold text-orange-600">
                            {menu.price.toLocaleString()} FCFA
                          </span>
                          <button
                            onClick={() => setSelectedMenu(menu)}
                            disabled={menu.remaining_portions === 0}
                            className={`px-4 py-2 rounded-full font-medium flex items-center gap-2 ${
                              menu.remaining_portions === 0
                                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                : 'bg-orange-500 text-white hover:bg-orange-600'
                            }`}
                          >
                            <Plus size={18} />
                            <span className="hidden sm:inline">Ajouter</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              />
            )}
          </div>
        )}
        
        {activeTab === 'reviews' && (
          <div className="space-y-4">
            {/* Rating Summary */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-4xl font-bold text-gray-900">{vendor.rating || 0}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {[1, 2, 3, 4, 5].map(i => (
                      <Star 
                        key={i} 
                        size={16} 
                        className={i <= Math.round(vendor.rating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{vendor.review_count || 0} avis</p>
                </div>
                
                {vendor.rating_breakdown && (
                  <div className="flex-1 space-y-1">
                    {[5, 4, 3, 2, 1].map(rating => {
                      const count = vendor.rating_breakdown[rating] || 0;
                      const percentage = vendor.review_count > 0 ? (count / vendor.review_count) * 100 : 0;
                      return (
                        <div key={rating} className="flex items-center gap-2">
                          <span className="text-sm text-gray-600 w-4">{rating}</span>
                          <Star size={12} className="text-yellow-400 fill-yellow-400" />
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-yellow-400 rounded-full"
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-500 w-8">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            
            {/* Review List */}
            {reviews.length === 0 ? (
              <div className="text-center py-12">
                <Star size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">Aucun avis pour le moment</p>
                {customer && (
                  <p className="text-sm text-gray-400 mt-2">Soyez le premier à donner votre avis !</p>
                )}
              </div>
            ) : (
              reviews.map(review => (
                <div key={review.id} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                        <span className="font-bold text-orange-600">
                          {review.customer_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{review.customer_name}</p>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map(i => (
                            <Star 
                              key={i} 
                              size={12} 
                              className={i <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    <span className="text-sm text-gray-400">
                      {new Date(review.created_at).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                  
                  {review.comment && (
                    <p className="text-gray-600 mt-3">{review.comment}</p>
                  )}
                  
                  {review.reply && (
                    <div className="mt-3 pl-4 border-l-2 border-orange-200 bg-orange-50 p-3 rounded-r-lg">
                      <p className="text-sm font-medium text-orange-600">Réponse du restaurant</p>
                      <p className="text-sm text-gray-600 mt-1">{review.reply}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
      
      {/* Add to Cart Modal */}
      {selectedMenu && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:w-96 sm:rounded-2xl rounded-t-2xl max-h-[80vh] overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Ajouter au panier</h3>
                <button onClick={() => { setSelectedMenu(null); setQuantity(1); }} className="p-2">
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
                  <button 
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                  >
                    <Minus size={18} />
                  </button>
                  <span className="text-xl font-bold">{quantity}</span>
                  <button 
                    onClick={() => setQuantity(q => q + 1)}
                    className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                  >
                    <Plus size={18} />
                  </button>
                </div>
                
                <span className="text-xl font-bold text-orange-600">
                  {(selectedMenu.price * quantity).toLocaleString()} FCFA
                </span>
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

export default RestaurantPage;
