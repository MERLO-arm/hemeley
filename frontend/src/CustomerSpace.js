import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link, useParams } from 'react-router-dom';
import { 
  User, Phone, Mail, MapPin, Heart, ShoppingBag, MessageSquare, 
  Star, Award, Settings, LogOut, ChevronRight, Camera, Edit2,
  Crown, Gift, TrendingUp, Clock, ChevronLeft, Plus, Trash2,
  Send, Image, Check, Bell, X, Home, Package, Copy, Share2,
  Globe, Moon, Sun, Shield, HelpCircle, FileText, Users, Wallet
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { WalletCard, RechargeModal, TransactionsList } from './WalletComponents';
import HemeleyLogo from './HemeleyLogo';
import useWalletNotifications from './useWalletNotifications';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// ==================== AUTH PAGES ====================

export const CustomerLoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  
  const [formData, setFormData] = useState({
    pseudo: '',
    phone: '',
    whatsapp: '',
    email: '',
    password: '',
    confirmPassword: '',
    referral_code: ''
  });
  
  useEffect(() => {
    const token = localStorage.getItem('hemeley_customer_token');
    if (token) {
      navigate('/client/dashboard');
    }
    
    if (location.state?.register) {
      setIsLogin(false);
    }
    
    // Check for referral code in URL
    const params = new URLSearchParams(location.search);
    const ref = params.get('ref');
    if (ref) {
      setReferralCode(ref);
      setFormData(prev => ({ ...prev, referral_code: ref }));
      setIsLogin(false);
    }
  }, [navigate, location]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (isLogin) {
        const response = await axios.post(`${API}/customer/login`, {
          phone: formData.phone,
          password: formData.password
        });
        
        localStorage.setItem('hemeley_customer_token', response.data.token);
        localStorage.setItem('hemeley_customer', JSON.stringify(response.data.customer));
        toast.success('Connexion réussie !');
        
        // Redirect to checkout if coming from there
        const redirectTo = location.state?.from || '/client/dashboard';
        navigate(redirectTo);
      } else {
        if (formData.password !== formData.confirmPassword) {
          toast.error('Les mots de passe ne correspondent pas');
          setLoading(false);
          return;
        }
        
        if (formData.password.length < 6) {
          toast.error('Le mot de passe doit contenir au moins 6 caractères');
          setLoading(false);
          return;
        }
        
        const response = await axios.post(`${API}/customer/register`, {
          pseudo: formData.pseudo,
          phone: formData.phone,
          whatsapp: formData.whatsapp || formData.phone,
          email: formData.email || undefined,
          password: formData.password,
          referral_code: formData.referral_code || undefined
        });
        
        localStorage.setItem('hemeley_customer_token', response.data.token);
        localStorage.setItem('hemeley_customer', JSON.stringify(response.data.customer));
        toast.success('Compte créé avec succès ! ' + (response.data.bonus_points ? `+${response.data.bonus_points} points de parrainage !` : ''));
        navigate('/client/dashboard');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      <div className="p-4">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-gray-600">
          <ChevronLeft size={20} />
          Retour
        </button>
      </div>
      
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl mx-auto flex items-center justify-center mb-4">
            <User size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isLogin ? 'Connexion Client' : 'Créer un compte'}
          </h1>
          <p className="text-gray-500 mt-2">
            {isLogin ? 'Accédez à votre espace personnel' : 'Rejoignez la communauté HEMELEY'}
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pseudo *</label>
              <input
                type="text"
                value={formData.pseudo}
                onChange={(e) => setFormData({...formData, pseudo: e.target.value})}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Votre pseudo"
                required={!isLogin}
              />
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Numéro de téléphone *</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="6XXXXXXXX"
              required
            />
          </div>
          
          {!isLogin && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp (optionnel)</label>
                <input
                  type="tel"
                  value={formData.whatsapp}
                  onChange={(e) => setFormData({...formData, whatsapp: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Numéro WhatsApp"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email (optionnel)</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="votre@email.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code de parrainage (optionnel)</label>
                <input
                  type="text"
                  value={formData.referral_code}
                  onChange={(e) => setFormData({...formData, referral_code: e.target.value.toUpperCase()})}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="CODE123"
                />
              </div>
            </>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe *</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm"
              >
                {showPassword ? 'Cacher' : 'Voir'}
              </button>
            </div>
          </div>
          
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer le mot de passe *</label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="••••••••"
                required={!isLogin}
              />
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50"
          >
            {loading ? 'Chargement...' : (isLogin ? 'Se connecter' : 'Créer mon compte')}
          </button>
          
          <div className="text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-orange-600 font-medium"
            >
              {isLogin ? "Pas encore de compte ? S'inscrire" : "Déjà un compte ? Se connecter"}
            </button>
          </div>
        </form>
        
        {!isLogin && (
          <div className="mt-8 space-y-3">
            <p className="text-center text-sm text-gray-500">En créant un compte, vous bénéficiez de :</p>
            {[
              { icon: Award, text: 'Programme de fidélité avec points' },
              { icon: Heart, text: 'Favoris et historique de commandes' },
              { icon: MessageSquare, text: 'Messagerie directe avec les restaurants' },
              { icon: Gift, text: '50 points bonus avec un code parrainage' }
            ].map((benefit, i) => (
              <div key={i} className="flex items-center gap-3 text-gray-600">
                <benefit.icon size={18} className="text-orange-500" />
                <span className="text-sm">{benefit.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ==================== DASHBOARD ====================

export const CustomerDashboard = () => {
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [activeOrders, setActiveOrders] = useState([]);
  const [favorites, setFavorites] = useState({ vendors: [], menus: [] });
  const [conversations, setConversations] = useState([]);
  const [loyalty, setLoyalty] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editField, setEditField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [showOrderDetail, setShowOrderDetail] = useState(null);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [walletRefreshKey, setWalletRefreshKey] = useState(0);

  // Subscribe to real-time wallet/payment events for this customer
  useWalletNotifications(customer?.id || null);
  const [addresses, setAddresses] = useState([]);
  const [newAddress, setNewAddress] = useState({ name: '', address: '', is_default: false });
  const [savingSettings, setSavingSettings] = useState(false);
  
  const token = localStorage.getItem('hemeley_customer_token');
  
  useEffect(() => {
    if (!token) {
      navigate('/client/login');
      return;
    }
    fetchData();
  }, [token, navigate]);
  
  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      const [profileRes, statsRes, ordersRes, activeOrdersRes, loyaltyRes, conversationsRes, addressesRes] = await Promise.all([
        axios.get(`${API}/customer/profile`, { headers }),
        axios.get(`${API}/customer/stats`, { headers }),
        axios.get(`${API}/customer/orders`, { headers }),
        axios.get(`${API}/customer/orders/active`, { headers }),
        axios.get(`${API}/customer/loyalty`, { headers }),
        axios.get(`${API}/customer/conversations`, { headers }),
        axios.get(`${API}/customer/addresses`, { headers })
      ]);
      
      setCustomer(profileRes.data);
      setStats(statsRes.data);
      setOrders(ordersRes.data);
      setActiveOrders(activeOrdersRes.data);
      setLoyalty(loyaltyRes.data);
      setConversations(conversationsRes.data);
      setAddresses(addressesRes.data || []);
      
      // Update localStorage
      localStorage.setItem('hemeley_customer', JSON.stringify(profileRes.data));
      
      // Fetch favorites
      const [vendorsRes, menusRes] = await Promise.all([
        axios.get(`${API}/customer/favorites/vendors`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/customer/favorites/menus`, { headers }).catch(() => ({ data: [] }))
      ]);
      setFavorites({ vendors: vendorsRes.data, menus: menusRes.data });
      
    } catch (error) {
      console.error('Error fetching data:', error);
      if (error.response?.status === 401) {
        localStorage.removeItem('hemeley_customer_token');
        localStorage.removeItem('hemeley_customer');
        navigate('/client/login');
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handleLogout = () => {
    localStorage.removeItem('hemeley_customer_token');
    localStorage.removeItem('hemeley_customer');
    toast.success('Déconnexion réussie');
    navigate('/');
  };
  
  const handleEditProfile = (field, currentValue) => {
    setEditField(field);
    setEditValue(currentValue || '');
    setShowEditModal(true);
  };
  
  const saveProfileEdit = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const updateData = { [editField]: editValue };
      
      await axios.put(`${API}/customer/profile`, updateData, { headers });
      toast.success('Profil mis à jour !');
      setShowEditModal(false);
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    }
  };
  
  const saveAddress = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API}/customer/addresses`, newAddress, { headers });
      toast.success('Adresse ajoutée !');
      setShowAddressModal(false);
      setNewAddress({ name: '', address: '', is_default: false });
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de l\'ajout');
    }
  };
  
  const deleteAddress = async (addressId) => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.delete(`${API}/customer/addresses/${addressId}`, { headers });
      toast.success('Adresse supprimée');
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };
  
  const toggleSetting = async (field, value) => {
    setSavingSettings(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.put(`${API}/customer/profile`, { [field]: value }, { headers });
      setCustomer(prev => ({ ...prev, [field]: value }));
      localStorage.setItem('hemeley_customer', JSON.stringify({ ...customer, [field]: value }));
      toast.success('Paramètre mis à jour !');
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setSavingSettings(false);
    }
  };
  
  const copyReferralCode = () => {
    const code = customer?.referral_code || customer?.id?.slice(0, 8).toUpperCase();
    navigator.clipboard.writeText(code);
    toast.success('Code copié !');
  };
  
  const shareReferralLink = () => {
    const code = customer?.referral_code || customer?.id?.slice(0, 8).toUpperCase();
    const link = `${window.location.origin}/client/login?ref=${code}`;
    if (navigator.share) {
      navigator.share({
        title: 'Rejoins HEMELEY !',
        text: `Utilise mon code ${code} pour obtenir 50 points bonus !`,
        url: link
      });
    } else {
      navigator.clipboard.writeText(link);
      toast.success('Lien copié !');
    }
  };
  
  const getLevelColor = (level) => {
    const colors = {
      bronze: 'from-amber-600 to-amber-700',
      silver: 'from-gray-400 to-gray-500',
      gold: 'from-yellow-400 to-yellow-500',
      platinum: 'from-purple-400 to-purple-600'
    };
    return colors[level] || colors.bronze;
  };
  
  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-700',
      confirmed: 'bg-blue-100 text-blue-700',
      preparing: 'bg-purple-100 text-purple-700',
      ready: 'bg-green-100 text-green-700',
      in_delivery: 'bg-orange-100 text-orange-700',
      delivered: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };
  
  const getStatusLabel = (status) => {
    const labels = {
      pending: 'En attente',
      confirmed: 'Confirmée',
      preparing: 'En préparation',
      ready: 'Prête',
      in_delivery: 'En livraison',
      delivered: 'Livrée',
      cancelled: 'Annulée'
    };
    return labels[status] || status;
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
      </div>
    );
  }
  
  const tabs = [
    { id: 'overview', label: 'Accueil', icon: Home },
    { id: 'orders', label: 'Commandes', icon: ShoppingBag },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'favorites', label: 'Favoris', icon: Heart },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'loyalty', label: 'Fidélité', icon: Award },
    { id: 'profile', label: 'Profil', icon: User }
  ];
  
  const referralCode = customer?.referral_code || customer?.id?.slice(0, 8).toUpperCase();
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <HemeleyLogo size={32} />
          </Link>
          
          <div className="flex items-center gap-3">
            <button className="p-2 relative" onClick={() => setShowReferralModal(true)}>
              <Gift size={20} className="text-orange-500" />
            </button>
            <button className="p-2 relative">
              <Bell size={20} className="text-gray-600" />
              {conversations.some(c => c.unread_customer > 0) && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              )}
            </button>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                {customer?.profile_image ? (
                  <img src={customer.profile_image} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <span className="font-bold text-orange-600">{customer?.pseudo?.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <span className="font-medium text-gray-900 hidden sm:block">{customer?.pseudo}</span>
            </div>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="border-t overflow-x-auto">
          <div className="max-w-6xl mx-auto px-4 flex gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <tab.icon size={18} />
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>
      
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Welcome Card */}
            <div className={`bg-gradient-to-r ${getLevelColor(customer?.loyalty_level)} rounded-2xl p-6 text-white`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/80">Bonjour,</p>
                  <h1 className="text-2xl font-bold">{customer?.pseudo}</h1>
                  <div className="flex items-center gap-2 mt-2">
                    <Crown size={18} />
                    <span className="capitalize">{customer?.loyalty_level || 'Bronze'}</span>
                    <span className="text-white/80">• {loyalty?.points || 0} points</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold">{stats?.total_orders || 0}</p>
                  <p className="text-white/80 text-sm">commandes</p>
                </div>
              </div>
            </div>
            
            {/* Referral Banner */}
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-4 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Gift size={24} />
                  <div>
                    <p className="font-bold">Parrainez vos amis !</p>
                    <p className="text-sm text-white/80">Gagnez 100 points par parrainage</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowReferralModal(true)}
                  className="px-4 py-2 bg-white text-purple-600 rounded-full font-medium text-sm"
                >
                  Inviter
                </button>
              </div>
            </div>
            
            {/* Active Orders */}
            {activeOrders.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4">Commandes en cours</h2>
                <div className="space-y-3">
                  {activeOrders.map(order => (
                    <div key={order.id} className="bg-white rounded-xl p-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{order.vendor_name}</p>
                          <p className="text-sm text-gray-500">{order.order_number}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.order_status)}`}>
                          {getStatusLabel(order.order_status)}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-orange-600 font-bold">{order.total?.toLocaleString()} FCFA</span>
                        <button 
                          onClick={() => setShowOrderDetail(order)}
                          className="text-sm text-orange-600 font-medium"
                        >
                          Voir détails →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Quick Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total dépensé', value: `${(stats?.total_spent || 0).toLocaleString()} FCFA`, icon: TrendingUp },
                { label: 'Commandes', value: stats?.total_orders || 0, icon: ShoppingBag },
                { label: 'Points fidélité', value: loyalty?.points || 0, icon: Award },
                { label: 'Parrainages', value: customer?.referral_count || 0, icon: Users }
              ].map((stat, i) => (
                <div key={i} className="bg-white rounded-xl p-4 shadow-sm">
                  <stat.icon size={20} className="text-orange-500 mb-2" />
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                </div>
              ))}
            </div>
            
            {/* Recent Orders */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Commandes récentes</h2>
                <button onClick={() => setActiveTab('orders')} className="text-sm text-orange-600 font-medium">
                  Voir tout →
                </button>
              </div>
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                {orders.slice(0, 3).map((order, i) => (
                  <div key={order.id} className={`p-4 ${i !== 0 ? 'border-t' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{order.vendor_name}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(order.created_at).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{order.total?.toLocaleString()} FCFA</p>
                        <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(order.order_status)}`}>
                          {getStatusLabel(order.order_status)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {orders.length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    <ShoppingBag size={32} className="mx-auto mb-2 text-gray-300" />
                    <p>Aucune commande pour le moment</p>
                    <Link to="/" className="text-orange-600 font-medium mt-2 inline-block">
                      Découvrir les restaurants →
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Mes commandes</h2>
            {orders.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center shadow-sm">
                <ShoppingBag size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">Aucune commande pour le moment</p>
                <Link to="/" className="text-orange-600 font-medium mt-4 inline-block">
                  Découvrir les restaurants →
                </Link>
              </div>
            ) : (
              orders.map(order => (
                <div 
                  key={order.id} 
                  data-testid={`order-card-${order.id}`}
                  className="bg-white rounded-xl shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setShowOrderDetail(order)}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-gray-900">{order.vendor_name}</p>
                        <p className="text-sm text-gray-500">{order.order_number}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(order.created_at).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.order_status)}`}>
                        {getStatusLabel(order.order_status)}
                      </span>
                    </div>
                    
                    <div className="mt-3 flex items-center justify-between">
                      <span className="font-bold text-lg text-orange-600">{order.total?.toLocaleString()} FCFA</span>
                      <span className="text-sm text-orange-600 font-medium">
                        Voir détails →
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        
        {/* Favorites Tab */}
        {activeTab === 'favorites' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Restaurants favoris</h2>
              {favorites.vendors.length === 0 ? (
                <div className="bg-white rounded-xl p-8 text-center shadow-sm">
                  <Heart size={32} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-gray-500">Aucun restaurant favori</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {favorites.vendors.map(vendor => (
                    <div 
                      key={vendor.id}
                      onClick={() => navigate(`/restaurant/${vendor.id}`)}
                      className="bg-white rounded-xl shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                    >
                      <div className="h-32 bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                        <span className="text-4xl font-bold text-white">{vendor.name.charAt(0)}</span>
                      </div>
                      <div className="p-4">
                        <p className="font-bold text-gray-900">{vendor.name}</p>
                        <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <Star size={14} className="text-yellow-400 fill-yellow-400" />
                            <span>{vendor.rating || 0}</span>
                          </div>
                          <span>•</span>
                          <span>{vendor.zone}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Messages Tab */}
        {activeTab === 'messages' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Messages</h2>
            {conversations.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center shadow-sm">
                <MessageSquare size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">Aucune conversation</p>
                <p className="text-sm text-gray-400 mt-2">
                  Contactez un restaurant depuis sa page pour démarrer une conversation
                </p>
              </div>
            ) : (
              conversations.map(conv => (
                <div 
                  key={conv.id}
                  onClick={() => navigate(`/client/messages/${conv.id}`)}
                  className="bg-white rounded-xl shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                      <span className="font-bold text-orange-600">{conv.vendor_name.charAt(0)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-gray-900">{conv.vendor_name}</p>
                        {conv.last_message_at && (
                          <span className="text-xs text-gray-400">
                            {new Date(conv.last_message_at).toLocaleDateString('fr-FR')}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 truncate">{conv.last_message || 'Nouvelle conversation'}</p>
                    </div>
                    {conv.unread_customer > 0 && (
                      <span className="w-6 h-6 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center">
                        {conv.unread_customer}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        
        {/* Wallet Tab */}
        {activeTab === 'wallet' && (
          <div className="space-y-6" data-testid="wallet-tab-content">
            <WalletCard role="customer" onOpenRecharge={() => setShowRechargeModal(true)} refreshKey={walletRefreshKey} />
            <div>
              <h3 className="font-bold text-gray-900 text-lg mb-3 flex items-center gap-2">
                <Clock size={18} /> Historique
              </h3>
              <TransactionsList role="customer" refreshKey={walletRefreshKey} />
            </div>
          </div>
        )}

        {/* Loyalty Tab */}
        {activeTab === 'loyalty' && (
          <div className="space-y-6">
            {/* Level Card */}
            <div className={`bg-gradient-to-r ${getLevelColor(customer?.loyalty_level)} rounded-2xl p-6 text-white`}>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                  <Crown size={32} />
                </div>
                <div>
                  <p className="text-white/80">Niveau actuel</p>
                  <p className="text-2xl font-bold capitalize">{customer?.loyalty_level || 'Bronze'}</p>
                  <p className="text-white/80">Multiplicateur x{loyalty?.multiplier || 1}</p>
                </div>
              </div>
              <div className="mt-6">
                <div className="flex justify-between text-sm text-white/80 mb-2">
                  <span>{loyalty?.points || 0} points</span>
                  <span>Prochain niveau</span>
                </div>
                <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-white rounded-full"
                    style={{ width: `${Math.min(100, ((loyalty?.total_spent || 0) / 50000) * 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
            
            {/* Level Benefits */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-bold text-gray-900 mb-4">Avantages par niveau</h3>
              <div className="space-y-4">
                {Object.entries(loyalty?.level_benefits || {}).map(([level, benefits]) => (
                  <div 
                    key={level}
                    className={`p-4 rounded-xl border-2 ${
                      customer?.loyalty_level === level ? 'border-orange-500 bg-orange-50' : 'border-gray-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Crown size={20} className={customer?.loyalty_level === level ? 'text-orange-500' : 'text-gray-400'} />
                        <span className="font-medium capitalize">{level}</span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {benefits.min_spent.toLocaleString()} FCFA minimum
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      Multiplicateur de points: x{benefits.multiplier}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Transactions */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-bold text-gray-900 mb-4">Historique des points</h3>
              {loyalty?.transactions?.length === 0 ? (
                <p className="text-center text-gray-500 py-4">Aucune transaction</p>
              ) : (
                <div className="space-y-3">
                  {loyalty?.transactions?.slice(0, 10).map((tx, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="text-gray-900">{tx.description}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(tx.created_at).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      <span className={`font-bold ${tx.type === 'earned' || tx.type === 'bonus' ? 'text-green-600' : 'text-red-600'}`}>
                        {tx.type === 'earned' || tx.type === 'bonus' ? '+' : '-'}{tx.points}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            {/* Profile Card */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center">
                    {customer?.profile_image ? (
                      <img src={customer.profile_image} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <span className="text-2xl font-bold text-orange-600">{customer?.pseudo?.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <button className="absolute bottom-0 right-0 w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center">
                    <Camera size={16} />
                  </button>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{customer?.pseudo}</h2>
                  <p className="text-gray-500">Membre depuis {new Date(customer?.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</p>
                </div>
              </div>
            </div>
            
            {/* Info */}
            <div className="bg-white rounded-xl shadow-sm divide-y">
              {[
                { icon: User, label: 'Pseudo', value: customer?.pseudo, field: 'pseudo' },
                { icon: Phone, label: 'Téléphone', value: customer?.phone, field: 'phone' },
                { icon: MessageSquare, label: 'WhatsApp', value: customer?.whatsapp || customer?.phone, field: 'whatsapp' },
                { icon: Mail, label: 'Email', value: customer?.email || 'Non renseigné', field: 'email' }
              ].map((item, i) => (
                <div key={i} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <item.icon size={20} className="text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">{item.label}</p>
                      <p className="text-gray-900">{item.value}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleEditProfile(item.field, item.value)}
                    className="text-orange-600 p-2 hover:bg-orange-50 rounded-lg"
                  >
                    <Edit2 size={18} />
                  </button>
                </div>
              ))}
            </div>
            
            {/* Actions */}
            <div className="bg-white rounded-xl shadow-sm divide-y">
              <button 
                onClick={() => setShowAddressModal(true)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <MapPin size={20} className="text-gray-400" />
                  <span>Mes adresses ({addresses.length})</span>
                </div>
                <ChevronRight size={20} className="text-gray-400" />
              </button>
              
              <button 
                onClick={() => setShowReferralModal(true)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <Gift size={20} className="text-orange-500" />
                  <div>
                    <span>Parrainage</span>
                    <p className="text-sm text-gray-500">Code: {referralCode}</p>
                  </div>
                </div>
                <ChevronRight size={20} className="text-gray-400" />
              </button>
              
              <button 
                onClick={() => setShowSettingsModal(true)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <Settings size={20} className="text-gray-400" />
                  <span>Paramètres</span>
                </div>
                <ChevronRight size={20} className="text-gray-400" />
              </button>
              
              <Link to="/help" className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <HelpCircle size={20} className="text-gray-400" />
                  <span>Aide & Support</span>
                </div>
                <ChevronRight size={20} className="text-gray-400" />
              </Link>
            </div>
            
            {/* Logout */}
            <button
              onClick={handleLogout}
              className="w-full bg-red-50 text-red-600 rounded-xl p-4 flex items-center justify-center gap-2 font-medium"
            >
              <LogOut size={20} />
              Déconnexion
            </button>
          </div>
        )}
      </main>
      
      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">
                Modifier {editField === 'pseudo' ? 'le pseudo' : editField === 'phone' ? 'le téléphone' : editField === 'whatsapp' ? 'WhatsApp' : "l'email"}
              </h3>
              <button onClick={() => setShowEditModal(false)} data-testid="close-edit-modal">
                <X size={24} />
              </button>
            </div>
            <input
              data-testid="edit-profile-input"
              type={editField === 'email' ? 'email' : editField === 'pseudo' ? 'text' : 'tel'}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-4"
              placeholder={
                editField === 'email' ? 'votre@email.com' : 
                editField === 'pseudo' ? 'Votre pseudo' : '6XXXXXXXX'
              }
            />
            <div className="flex gap-3">
              <button 
                onClick={() => setShowEditModal(false)}
                className="flex-1 py-3 border border-gray-200 rounded-xl"
              >
                Annuler
              </button>
              <button 
                onClick={saveProfileEdit}
                data-testid="save-profile-edit-btn"
                className="flex-1 py-3 bg-orange-500 text-white rounded-xl font-medium"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Address Modal */}
      {showAddressModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Mes adresses</h3>
                <button onClick={() => setShowAddressModal(false)}>
                  <X size={24} />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              {addresses.map((addr, i) => (
                <div key={i} className="p-4 border rounded-xl">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{addr.name}</p>
                      <p className="text-sm text-gray-500">{addr.address}</p>
                      {addr.is_default && (
                        <span className="text-xs text-orange-600 font-medium">Par défaut</span>
                      )}
                    </div>
                    <button 
                      onClick={() => deleteAddress(addr.id)}
                      className="text-red-500 p-1"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
              
              <div className="border-t pt-4">
                <p className="font-medium mb-3">Ajouter une adresse</p>
                <input
                  type="text"
                  value={newAddress.name}
                  onChange={(e) => setNewAddress({...newAddress, name: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-3"
                  placeholder="Nom (ex: Maison, Bureau)"
                />
                <input
                  type="text"
                  value={newAddress.address}
                  onChange={(e) => setNewAddress({...newAddress, address: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-3"
                  placeholder="Adresse complète"
                />
                <label className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    checked={newAddress.is_default}
                    onChange={(e) => setNewAddress({...newAddress, is_default: e.target.checked})}
                    className="rounded"
                  />
                  <span className="text-sm">Définir comme adresse par défaut</span>
                </label>
                <button 
                  onClick={saveAddress}
                  className="w-full py-3 bg-orange-500 text-white rounded-xl font-medium"
                >
                  Ajouter l'adresse
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Paramètres</h3>
                <button onClick={() => setShowSettingsModal(false)} data-testid="close-settings-modal">
                  <X size={24} />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Bell size={20} className="text-gray-600" />
                  <span>Notifications push</span>
                </div>
                <button 
                  data-testid="toggle-notifications"
                  onClick={() => toggleSetting('notifications_enabled', !customer?.notifications_enabled)}
                  disabled={savingSettings}
                  className={`w-12 h-6 rounded-full relative transition-colors ${customer?.notifications_enabled !== false ? 'bg-orange-500' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${customer?.notifications_enabled !== false ? 'right-1' : 'left-1'}`}></div>
                </button>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Globe size={20} className="text-gray-600" />
                  <span>Langue</span>
                </div>
                <select 
                  data-testid="language-select"
                  value={customer?.language || 'fr'}
                  onChange={(e) => toggleSetting('language', e.target.value)}
                  className="bg-white border border-gray-200 rounded-lg px-3 py-1 text-sm"
                >
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </select>
              </div>
              
              <div className="border-t pt-4">
                <button className="w-full p-4 text-left flex items-center gap-3 text-gray-600 hover:bg-gray-50 rounded-xl">
                  <Shield size={20} />
                  <span>Politique de confidentialité</span>
                </button>
                <button className="w-full p-4 text-left flex items-center gap-3 text-gray-600 hover:bg-gray-50 rounded-xl">
                  <FileText size={20} />
                  <span>Conditions d'utilisation</span>
                </button>
              </div>
              
              <button className="w-full py-3 border border-red-200 text-red-600 rounded-xl font-medium">
                Supprimer mon compte
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Referral Modal */}
      {showReferralModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Parrainez vos amis</h3>
                <button onClick={() => setShowReferralModal(false)}>
                  <X size={24} />
                </button>
              </div>
            </div>
            
            <div className="p-6 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full mx-auto flex items-center justify-center mb-4">
                <Gift size={40} className="text-white" />
              </div>
              
              <h4 className="text-xl font-bold text-gray-900 mb-2">Gagnez 100 points !</h4>
              <p className="text-gray-500 mb-6">
                Pour chaque ami qui s'inscrit avec votre code et passe sa première commande, vous gagnez 100 points de fidélité !
              </p>
              
              <div className="bg-gray-100 rounded-xl p-4 mb-4">
                <p className="text-sm text-gray-500 mb-1">Votre code de parrainage</p>
                <p className="text-2xl font-bold text-orange-600" data-testid="referral-code">{referralCode}</p>
              </div>
              
              <div className="flex gap-3">
                <button 
                  onClick={copyReferralCode}
                  data-testid="copy-referral-btn"
                  className="flex-1 py-3 border border-gray-200 rounded-xl font-medium flex items-center justify-center gap-2"
                >
                  <Copy size={18} />
                  Copier le code
                </button>
                <button 
                  onClick={shareReferralLink}
                  data-testid="share-referral-btn"
                  className="flex-1 py-3 bg-orange-500 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                >
                  <Share2 size={18} />
                  Partager
                </button>
              </div>
              
              <div className="mt-6 pt-6 border-t">
                <p className="text-sm text-gray-500">
                  {customer?.referral_count || 0} ami(s) parrainé(s) • {(customer?.referral_count || 0) * 100} points gagnés
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Recharge Modal */}
      <RechargeModal
        open={showRechargeModal}
        onClose={() => setShowRechargeModal(false)}
        onSuccess={() => setWalletRefreshKey(k => k + 1)}
      />

      {/* Order Detail Modal */}
      {showOrderDetail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold" data-testid="order-detail-title">Détails commande</h3>
                  <p className="text-sm text-gray-500">{showOrderDetail.order_number}</p>
                </div>
                <button onClick={() => setShowOrderDetail(null)} data-testid="close-order-detail">
                  <X size={24} />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-5">
              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Statut</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(showOrderDetail.order_status)}`}>
                  {getStatusLabel(showOrderDetail.order_status)}
                </span>
              </div>
              
              {/* Restaurant */}
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Restaurant</span>
                <span className="font-medium text-gray-900">{showOrderDetail.vendor_name}</span>
              </div>
              
              {/* Date */}
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Date</span>
                <span className="text-gray-900">
                  {new Date(showOrderDetail.created_at).toLocaleDateString('fr-FR', {
                    day: 'numeric', month: 'long', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  })}
                </span>
              </div>
              
              {/* Items */}
              <div className="border-t pt-4">
                <p className="font-bold text-gray-900 mb-3">Articles commandés</p>
                <div className="space-y-3">
                  {showOrderDetail.items?.map((item, i) => (
                    <div key={i} className="flex justify-between items-center" data-testid={`order-item-${i}`}>
                      <div>
                        <p className="text-gray-900">{item.menu_name}</p>
                        <p className="text-sm text-gray-500">{item.quantity}x {item.price?.toLocaleString()} FCFA</p>
                      </div>
                      <span className="font-medium text-gray-900">{item.subtotal?.toLocaleString()} FCFA</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Delivery address */}
              {showOrderDetail.customer_address && (
                <div className="border-t pt-4">
                  <p className="font-bold text-gray-900 mb-2">Adresse de livraison</p>
                  <p className="text-sm text-gray-600">{showOrderDetail.customer_address}</p>
                </div>
              )}
              
              {/* Payment */}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Paiement</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    showOrderDetail.payment_status === 'success' ? 'bg-green-100 text-green-700' :
                    showOrderDetail.payment_status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {showOrderDetail.payment_status === 'success' ? 'Payé' : 
                     showOrderDetail.payment_status === 'pending' ? 'En attente' : 'Échoué'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Méthode</span>
                  <span className="text-gray-900 capitalize">{showOrderDetail.payment_method}</span>
                </div>
              </div>
              
              {/* Total */}
              <div className="border-t pt-4">
                {showOrderDetail.subtotal && showOrderDetail.subtotal !== showOrderDetail.total && (
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600">Sous-total</span>
                    <span className="text-gray-900">{showOrderDetail.subtotal?.toLocaleString()} FCFA</span>
                  </div>
                )}
                {showOrderDetail.delivery_fee > 0 && (
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600">Livraison</span>
                    <span className="text-gray-900">{showOrderDetail.delivery_fee?.toLocaleString()} FCFA</span>
                  </div>
                )}
                {showOrderDetail.discount > 0 && (
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600">Réduction</span>
                    <span className="text-green-600">-{showOrderDetail.discount?.toLocaleString()} FCFA</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-lg">
                  <span className="font-bold text-gray-900">Total</span>
                  <span className="font-bold text-orange-600" data-testid="order-detail-total">{showOrderDetail.total?.toLocaleString()} FCFA</span>
                </div>
              </div>
              
              {/* Customer note */}
              {showOrderDetail.customer_note && (
                <div className="border-t pt-4">
                  <p className="font-bold text-gray-900 mb-2">Note</p>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-xl">{showOrderDetail.customer_note}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== MESSAGE PAGE ====================

export const CustomerMessagesPage = () => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  
  const token = localStorage.getItem('hemeley_customer_token');
  
  useEffect(() => {
    if (!token) {
      navigate('/client/login');
      return;
    }
    
    if (conversationId) {
      fetchMessages();
    } else {
      const params = new URLSearchParams(location.search);
      const vendorId = params.get('vendor');
      if (vendorId) {
        startNewConversation(vendorId);
      } else {
        setLoading(false);
      }
    }
  }, [conversationId, token]);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const fetchMessages = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      const convsRes = await axios.get(`${API}/customer/conversations`, { headers });
      const conv = convsRes.data.find(c => c.id === conversationId);
      setConversation(conv);
      
      const msgsRes = await axios.get(`${API}/customer/conversations/${conversationId}/messages`, { headers });
      setMessages(msgsRes.data);
    } catch (error) {
      toast.error('Erreur lors du chargement des messages');
    } finally {
      setLoading(false);
    }
  };
  
  const startNewConversation = async (vendorId) => {
    try {
      const vendorRes = await axios.get(`${API}/vendors/${vendorId}`);
      setConversation({
        vendor_id: vendorId,
        vendor_name: vendorRes.data.name,
        isNew: true
      });
    } catch (error) {
      toast.error('Erreur');
      navigate('/client/dashboard');
    } finally {
      setLoading(false);
    }
  };
  
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;
    
    setSending(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const response = await axios.post(`${API}/customer/conversations/message`, {
        conversation_id: conversation?.isNew ? null : conversationId,
        vendor_id: conversation?.vendor_id,
        content: newMessage.trim(),
        content_type: 'text'
      }, { headers });
      
      if (conversation?.isNew) {
        navigate(`/client/messages/${response.data.data.conversation_id}`, { replace: true });
      } else {
        setMessages([...messages, response.data.data]);
      }
      
      setNewMessage('');
    } catch (error) {
      toast.error("Erreur lors de l'envoi du message");
    } finally {
      setSending(false);
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="px-4 py-3 flex items-center gap-4">
          <button onClick={() => navigate('/client/dashboard')} className="p-2">
            <ChevronLeft size={24} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
              <span className="font-bold text-orange-600">{conversation?.vendor_name?.charAt(0)}</span>
            </div>
            <div>
              <p className="font-medium text-gray-900">{conversation?.vendor_name}</p>
              <p className="text-xs text-gray-500">Restaurant</p>
            </div>
          </div>
        </div>
      </header>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <MessageSquare size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">Commencez la conversation</p>
          </div>
        )}
        
        {messages.map((msg, i) => {
          const isMe = msg.sender_type === 'customer';
          return (
            <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] ${isMe ? 'bg-orange-500 text-white' : 'bg-white'} rounded-2xl px-4 py-3 shadow-sm`}>
                <p>{msg.content}</p>
                <p className={`text-xs mt-1 ${isMe ? 'text-white/70' : 'text-gray-400'}`}>
                  {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      
      <form onSubmit={sendMessage} className="bg-white border-t p-4">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Écrire un message..."
            className="flex-1 px-4 py-3 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button 
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="p-3 bg-orange-500 text-white rounded-full disabled:opacity-50"
          >
            <Send size={20} />
          </button>
        </div>
      </form>
    </div>
  );
};

export default CustomerDashboard;
