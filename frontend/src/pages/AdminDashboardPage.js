import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Package, Crown, Truck, User, AlertCircle, CheckCircle, Plus,
  Edit2, Trash2, Search, Filter, X, Eye, ChevronLeft, ChevronRight,
  Upload, Download, Star, Calendar, Clock, Tag, FileText, Mail, Phone,
  Save, RefreshCw, Settings, Users, ShoppingBag, BarChart3, TrendingUp,
  Bell, LogOut, Lock, Unlock, Shield, MapPin, Send, Image, KeyRound,
  Check, AlertTriangle, MoreVertical, Sparkles, Award, Heart, Activity,
  Globe, Languages, Zap, Power, FileSpreadsheet, FileType
} from 'lucide-react';
import AdminFinancePanel from '../AdminFinancePanel';
import { API } from '../MapUtils';
import useWalletNotifications from '../useWalletNotifications';

const AdminDashboardPage = () => {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState(null);

  // Super admins listen to the global broadcast feed
  useWalletNotifications('SUPER_ADMIN');
  const [stats, setStats] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [deliveryPartners, setDeliveryPartners] = useState([]);
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Settings state
  const [platformSettings, setPlatformSettings] = useState(null);
  const [showAddLoyaltyRule, setShowAddLoyaltyRule] = useState(false);
  const [showAddPromotion, setShowAddPromotion] = useState(false);
  const [newRule, setNewRule] = useState({ points_threshold: '', discount_percent: '', description: '' });
  const [newPromo, setNewPromo] = useState({ name: '', discount_percent: '', start_hour: '', end_hour: '', start_date: '', end_date: '', days_of_week: [0,1,2,3,4,5,6] });
  const [savingSettings, setSavingSettings] = useState(false);
  
  // Account creation state
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [newAccount, setNewAccount] = useState({ account_type: 'vendor', name: '', email: '', phone: '', password: 'hemeley2024', zone: 'bonapriso', trust_rate: 0, default_rating: 0, is_verified: false, loyalty_points: 0 });
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkAccountType, setBulkAccountType] = useState('vendor');

  useEffect(() => {
    const adminData = localStorage.getItem('admin_data');
    if (!adminData || adminData === 'undefined') {
      navigate('/admin/login');
      return;
    }
    try {
      setAdmin(JSON.parse(adminData));
      fetchData();
    } catch (error) {
      navigate('/admin/login');
    }
  }, [navigate]);

  const fetchData = async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      navigate('/admin/login');
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [statsRes, vendorsRes, deliveryRes, ordersRes, settingsRes, customersRes] = await Promise.all([
        axios.get(`${API}/admin/stats`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API}/admin/vendors`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/admin/delivery-partners`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/admin/orders`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/admin/settings`, { headers }).catch(() => ({ data: null })),
        axios.get(`${API}/admin/customers`, { headers }).catch(() => ({ data: [] }))
      ]);

      setStats(statsRes.data);
      setVendors(vendorsRes.data || []);
      setDeliveryPartners(deliveryRes.data || []);
      setOrders(ordersRes.data || []);
      setPlatformSettings(settingsRes.data);
      setCustomers(customersRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_data');
    navigate('/');
  };

  const toggleUserStatus = async (userId, role, currentStatus) => {
    const token = localStorage.getItem('admin_token');
    const endpoint = currentStatus ? 'deactivate' : 'activate';
    
    try {
      await axios.put(`${API}/admin/users/${userId}/${endpoint}?role=${role}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Utilisateur ${currentStatus ? 'désactivé' : 'activé'}`);
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const addLoyaltyRule = async () => {
    const token = localStorage.getItem('admin_token');
    setSavingSettings(true);
    try {
      await axios.post(`${API}/admin/settings/loyalty-rules`, {
        points_threshold: parseInt(newRule.points_threshold),
        discount_percent: parseFloat(newRule.discount_percent),
        description: newRule.description || undefined
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Règle de fidélité ajoutée !');
      setShowAddLoyaltyRule(false);
      setNewRule({ points_threshold: '', discount_percent: '', description: '' });
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de l\'ajout');
    } finally {
      setSavingSettings(false);
    }
  };

  const toggleLoyaltyRule = async (ruleId) => {
    const token = localStorage.getItem('admin_token');
    try {
      await axios.put(`${API}/admin/settings/loyalty-rules/${ruleId}/toggle`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
    } catch (error) {
      toast.error('Erreur');
    }
  };

  const deleteLoyaltyRule = async (ruleId) => {
    const token = localStorage.getItem('admin_token');
    try {
      await axios.delete(`${API}/admin/settings/loyalty-rules/${ruleId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Règle supprimée');
      fetchData();
    } catch (error) {
      toast.error('Erreur');
    }
  };

  const addTimePromotion = async () => {
    const token = localStorage.getItem('admin_token');
    setSavingSettings(true);
    try {
      await axios.post(`${API}/admin/settings/time-promotions`, {
        name: newPromo.name,
        discount_percent: parseFloat(newPromo.discount_percent),
        start_hour: parseInt(newPromo.start_hour),
        end_hour: parseInt(newPromo.end_hour),
        start_date: newPromo.start_date || undefined,
        end_date: newPromo.end_date || undefined,
        days_of_week: newPromo.days_of_week
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Promotion ajoutée !');
      setShowAddPromotion(false);
      setNewPromo({ name: '', discount_percent: '', start_hour: '', end_hour: '', start_date: '', end_date: '', days_of_week: [0,1,2,3,4,5,6] });
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de l\'ajout');
    } finally {
      setSavingSettings(false);
    }
  };

  const toggleTimePromotion = async (promoId) => {
    const token = localStorage.getItem('admin_token');
    try {
      await axios.put(`${API}/admin/settings/time-promotions/${promoId}/toggle`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
    } catch (error) {
      toast.error('Erreur');
    }
  };

  const deleteTimePromotion = async (promoId) => {
    const token = localStorage.getItem('admin_token');
    try {
      await axios.delete(`${API}/admin/settings/time-promotions/${promoId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Promotion supprimée');
      fetchData();
    } catch (error) {
      toast.error('Erreur');
    }
  };

  const updateReferralSettings = async (field, value) => {
    const token = localStorage.getItem('admin_token');
    try {
      await axios.put(`${API}/admin/settings/referral`, { [field]: parseInt(value) }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Paramètre mis à jour !');
      fetchData();
    } catch (error) {
      toast.error('Erreur');
    }
  };

  const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  const createAccount = async () => {
    const token = localStorage.getItem('admin_token');
    setCreatingAccount(true);
    try {
      const res = await axios.post(`${API}/admin/create-account`, newAccount, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`Compte ${newAccount.account_type} créé avec succès !`);
      setShowCreateAccount(false);
      setNewAccount({ account_type: 'vendor', name: '', email: '', phone: '', password: 'hemeley2024', zone: 'bonapriso', trust_rate: 0, default_rating: 0, is_verified: false, loyalty_points: 0 });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la création');
    } finally {
      setCreatingAccount(false);
    }
  };

  const bulkImportAccounts = async () => {
    const token = localStorage.getItem('admin_token');
    try {
      const lines = bulkText.trim().split('\n').filter(l => l.trim());
      const accounts = lines.map(line => {
        const parts = line.split(',').map(p => p.trim());
        if (bulkAccountType === 'customer') {
          return { account_type: 'customer', name: parts[0] || '', phone: parts[1] || '', email: parts[2] || '', password: parts[3] || 'hemeley2024' };
        }
        return { account_type: bulkAccountType, name: parts[0] || '', email: parts[1] || '', phone: parts[2] || '', password: parts[3] || 'hemeley2024', zone: parts[4] || 'bonapriso' };
      });
      
      const res = await axios.post(`${API}/admin/create-accounts-bulk`, { accounts }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(`${res.data.created} compte(s) créé(s)`);
      if (res.data.errors?.length > 0) {
        toast.error(`${res.data.errors.length} erreur(s)`);
      }
      setShowBulkImport(false);
      setBulkText('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de l\'import');
    }
  };

  const deleteAccount = async (userId, role) => {
    if (!window.confirm('Voulez-vous vraiment supprimer ce compte ?')) return;
    const token = localStorage.getItem('admin_token');
    try {
      await axios.delete(`${API}/admin/users/${userId}?role=${role}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Compte supprimé');
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <RefreshCw size={40} className="animate-spin text-slate-800" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      
      {/* Sidebar */}
      <div className="fixed left-0 top-0 bottom-0 w-64 bg-slate-900 text-white p-6 hidden lg:block">
        <div className="mb-8">
          <h1 className="font-heading text-2xl tracking-wide">HEMELEY</h1>
          <p className="font-body text-sm text-slate-400">Administration</p>
        </div>

        <nav className="space-y-2">
          {[
            { id: 'overview', label: 'Vue d\'ensemble', icon: Package },
            { id: 'vendors', label: 'Vendeurs', icon: Crown },
            { id: 'delivery', label: 'Livreurs', icon: Truck },
            { id: 'orders', label: 'Commandes', icon: Package },
            { id: 'customers', label: 'Clients', icon: User },
            { id: 'finance', label: 'Finance', icon: CheckCircle },
            { id: 'settings', label: 'Paramètres', icon: AlertCircle }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-body transition-colors ${activeTab === item.id ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
            >
              <item.icon size={20} />
              {item.label}
            </button>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          className="absolute bottom-6 left-6 right-6 flex items-center justify-center gap-2 px-4 py-3 bg-red-500/20 text-red-400 rounded-xl font-body hover:bg-red-500/30 transition-colors"
        >
          <LogOut size={20} />
          Déconnexion
        </button>
      </div>

      {/* Main Content */}
      <div className="lg:ml-64 min-h-screen">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 p-4 lg:p-6 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading text-2xl text-slate-800">
                {activeTab === 'overview' && 'Vue d\'ensemble'}
                {activeTab === 'vendors' && 'Gestion des Vendeurs'}
                {activeTab === 'delivery' && 'Gestion des Livreurs'}
                {activeTab === 'orders' && 'Toutes les Commandes'}
                {activeTab === 'customers' && 'Gestion des Clients'}
                {activeTab === 'finance' && 'Tableau de bord financier'}
                {activeTab === 'settings' && 'Paramètres de la plateforme'}
              </h2>
              <p className="font-body text-slate-500">Bonjour, {admin?.name || 'Admin'}</p>
            </div>
            <button
              onClick={fetchData}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors"
            >
              <RefreshCw size={20} className="text-slate-600" />
            </button>
          </div>
        </div>

        <div className="p-4 lg:p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-6 border border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                      <Package size={24} className="text-primary" />
                    </div>
                    <div>
                      <p className="font-body text-sm text-slate-500">Commandes</p>
                      <p className="font-heading text-3xl text-slate-800">{stats?.total_orders || orders.length}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                      <Crown size={24} className="text-green-600" />
                    </div>
                    <div>
                      <p className="font-body text-sm text-slate-500">Vendeurs</p>
                      <p className="font-heading text-3xl text-slate-800">{stats?.total_vendors || vendors.length}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Truck size={24} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="font-body text-sm text-slate-500">Livreurs</p>
                      <p className="font-heading text-3xl text-slate-800">{stats?.total_delivery_partners || deliveryPartners.length}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                      <AlertCircle size={24} className="text-yellow-600" />
                    </div>
                    <div>
                      <p className="font-body text-sm text-slate-500">En attente</p>
                      <p className="font-heading text-3xl text-slate-800">{stats?.pending_orders || orders.filter(o => o.order_status === 'pending').length}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Revenue Card */}
              <div className="bg-gradient-to-r from-primary to-primary/80 rounded-2xl p-6 text-white">
                <p className="font-body opacity-80 mb-2">Revenus totaux</p>
                <p className="font-heading text-4xl">{(stats?.total_revenue || 0).toLocaleString()} FCFA</p>
              </div>

              {/* Recent Orders */}
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <h3 className="font-heading text-lg text-slate-800">Commandes récentes</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {orders.slice(0, 5).map(order => (
                    <div key={order.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                          <Package size={20} className="text-slate-600" />
                        </div>
                        <div>
                          <p className="font-body font-medium text-slate-800">#{order.id?.slice(-6)}</p>
                          <p className="font-body text-sm text-slate-500">{order.customer_name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-body font-bold text-primary">{order.total?.toLocaleString()} FCFA</p>
                        <p className="font-body text-xs text-slate-500">{order.order_status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Vendors Tab */}
          {activeTab === 'vendors' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <button onClick={() => { setNewAccount({...newAccount, account_type: 'vendor'}); setShowCreateAccount(true); }} data-testid="create-vendor-btn" className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700">+ Créer un vendeur</button>
                <button onClick={() => { setBulkAccountType('vendor'); setShowBulkImport(true); }} data-testid="bulk-import-vendor-btn" className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50">Import en masse</button>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <h3 className="font-heading text-lg text-slate-800">Vendeurs ({vendors.length})</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {vendors.map(vendor => (
                    <div key={vendor.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                          <Crown size={24} className="text-primary" />
                        </div>
                        <div>
                          <p className="font-body font-bold text-slate-800">{vendor.name}</p>
                          <p className="font-body text-sm text-slate-500">{vendor.email}</p>
                          <p className="font-body text-xs text-slate-400">{vendor.zone} • {vendor.phone}</p>
                          {vendor.trust_rate > 0 && <p className="font-body text-xs text-blue-500">Confiance: {vendor.trust_rate}%</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${vendor.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {vendor.is_active ? 'Actif' : 'Inactif'}
                        </span>
                        <button onClick={() => toggleUserStatus(vendor.id, 'vendor', vendor.is_active)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${vendor.is_active ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                          {vendor.is_active ? 'Désactiver' : 'Activer'}
                        </button>
                        <button onClick={() => deleteAccount(vendor.id, 'vendor')} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500 text-white hover:bg-red-600" data-testid={`delete-vendor-${vendor.id}`}>
                          Supprimer
                        </button>
                      </div>
                    </div>
                  ))}
                  {vendors.length === 0 && <div className="p-8 text-center text-slate-500"><Crown size={48} className="mx-auto mb-4 opacity-50" /><p>Aucun vendeur</p></div>}
                </div>
              </div>
            </div>
          )}

          {/* Delivery Partners Tab */}
          {activeTab === 'delivery' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <button onClick={() => { setNewAccount({...newAccount, account_type: 'delivery'}); setShowCreateAccount(true); }} data-testid="create-delivery-btn" className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700">+ Créer un livreur</button>
                <button onClick={() => { setBulkAccountType('delivery'); setShowBulkImport(true); }} className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50">Import en masse</button>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <h3 className="font-heading text-lg text-slate-800">Livreurs ({deliveryPartners.length})</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {deliveryPartners.map(partner => (
                    <div key={partner.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <Truck size={24} className="text-blue-600" />
                        </div>
                        <div>
                          <p className="font-body font-bold text-slate-800">{partner.name}</p>
                          <p className="font-body text-sm text-slate-500">{partner.email}</p>
                          <p className="font-body text-xs text-slate-400">{partner.vehicle_type} • {partner.phone}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${partner.is_available ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                          {partner.is_available ? 'En ligne' : 'Hors ligne'}
                        </span>
                        <button onClick={() => toggleUserStatus(partner.id, 'delivery', partner.is_active)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${partner.is_active !== false ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                          {partner.is_active !== false ? 'Désactiver' : 'Activer'}
                        </button>
                        <button onClick={() => deleteAccount(partner.id, 'delivery')} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500 text-white hover:bg-red-600">
                          Supprimer
                        </button>
                      </div>
                    </div>
                  ))}
                  {deliveryPartners.length === 0 && <div className="p-8 text-center text-slate-500"><Truck size={48} className="mx-auto mb-4 opacity-50" /><p>Aucun livreur</p></div>}
                </div>
              </div>
            </div>
          )}

          {/* Orders Tab */}
          {activeTab === 'orders' && (
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <h3 className="font-heading text-lg text-slate-800">Toutes les commandes ({orders.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-body text-sm font-medium text-slate-600">ID</th>
                      <th className="px-4 py-3 text-left font-body text-sm font-medium text-slate-600">Client</th>
                      <th className="px-4 py-3 text-left font-body text-sm font-medium text-slate-600">Vendeur</th>
                      <th className="px-4 py-3 text-left font-body text-sm font-medium text-slate-600">Total</th>
                      <th className="px-4 py-3 text-left font-body text-sm font-medium text-slate-600">Statut</th>
                      <th className="px-4 py-3 text-left font-body text-sm font-medium text-slate-600">Paiement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.map(order => (
                      <tr key={order.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-body text-sm text-slate-800">#{order.id?.slice(-6)}</td>
                        <td className="px-4 py-3">
                          <p className="font-body text-sm text-slate-800">{order.customer_name}</p>
                          <p className="font-body text-xs text-slate-500">{order.customer_phone}</p>
                        </td>
                        <td className="px-4 py-3 font-body text-sm text-slate-600">{order.vendor_name}</td>
                        <td className="px-4 py-3 font-body text-sm font-bold text-primary">{order.total?.toLocaleString()} FCFA</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            order.order_status === 'delivered' ? 'bg-green-100 text-green-800' :
                            order.order_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {order.order_status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            order.payment_status === 'success' ? 'bg-green-100 text-green-800' :
                            order.payment_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {order.payment_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {orders.length === 0 && (
                <div className="p-8 text-center text-slate-500">
                  <Package size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Aucune commande</p>
                </div>
              )}
            </div>
          )}

          {/* Customers Tab */}
          {activeTab === 'customers' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <button onClick={() => { setNewAccount({...newAccount, account_type: 'customer'}); setShowCreateAccount(true); }} data-testid="create-customer-btn" className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700">+ Créer un client</button>
                <button onClick={() => { setBulkAccountType('customer'); setShowBulkImport(true); }} className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50">Import en masse</button>
              </div>
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <h3 className="font-heading text-lg text-slate-800" data-testid="customers-tab-title">Clients inscrits ({customers.length})</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-body text-sm font-medium text-slate-600">Pseudo</th>
                        <th className="px-4 py-3 text-left font-body text-sm font-medium text-slate-600">Téléphone</th>
                        <th className="px-4 py-3 text-left font-body text-sm font-medium text-slate-600">Niveau</th>
                        <th className="px-4 py-3 text-left font-body text-sm font-medium text-slate-600">Points</th>
                        <th className="px-4 py-3 text-left font-body text-sm font-medium text-slate-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {customers.map(c => (
                        <tr key={c.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-body text-sm font-medium text-slate-800">{c.pseudo}</td>
                          <td className="px-4 py-3 font-body text-sm text-slate-600">{c.phone}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
                              c.loyalty_level === 'platinum' ? 'bg-purple-100 text-purple-800' :
                              c.loyalty_level === 'gold' ? 'bg-yellow-100 text-yellow-800' :
                              c.loyalty_level === 'silver' ? 'bg-gray-100 text-gray-800' :
                              'bg-amber-100 text-amber-800'
                            }`}>{c.loyalty_level || 'bronze'}</span>
                          </td>
                          <td className="px-4 py-3 font-body text-sm text-slate-800">{c.loyalty_points || 0}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button onClick={() => toggleUserStatus(c.id, 'customer', c.is_active !== false)} className={`px-2 py-1 rounded text-xs ${c.is_active !== false ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                {c.is_active !== false ? 'Désactiver' : 'Activer'}
                              </button>
                              <button onClick={() => deleteAccount(c.id, 'customer')} className="px-2 py-1 rounded text-xs bg-red-500 text-white">Supprimer</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {customers.length === 0 && <div className="p-8 text-center text-slate-500"><User size={48} className="mx-auto mb-4 opacity-50" /><p>Aucun client inscrit</p></div>}
              </div>
            </div>
          )}

          {/* Finance Tab */}
          {activeTab === 'finance' && (
            <AdminFinancePanel />
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              {/* Loyalty Rules */}
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-heading text-lg text-slate-800" data-testid="loyalty-rules-title">Règles de fidélité (Points → Réduction)</h3>
                    <p className="font-body text-sm text-slate-500 mt-1">Définissez les seuils de points pour les réductions automatiques</p>
                  </div>
                  <button
                    onClick={() => setShowAddLoyaltyRule(!showAddLoyaltyRule)}
                    data-testid="add-loyalty-rule-btn"
                    className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
                  >
                    + Ajouter une règle
                  </button>
                </div>

                {showAddLoyaltyRule && (
                  <div className="p-4 bg-slate-50 border-b border-slate-100">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="font-body text-sm text-slate-600 block mb-1">Seuil de points</label>
                        <input
                          type="number"
                          value={newRule.points_threshold}
                          onChange={(e) => setNewRule({...newRule, points_threshold: e.target.value})}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg font-body text-sm"
                          placeholder="Ex: 10000"
                          data-testid="rule-points-input"
                        />
                      </div>
                      <div>
                        <label className="font-body text-sm text-slate-600 block mb-1">% de réduction</label>
                        <input
                          type="number"
                          value={newRule.discount_percent}
                          onChange={(e) => setNewRule({...newRule, discount_percent: e.target.value})}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg font-body text-sm"
                          placeholder="Ex: 10"
                          data-testid="rule-discount-input"
                        />
                      </div>
                      <div>
                        <label className="font-body text-sm text-slate-600 block mb-1">Description</label>
                        <input
                          type="text"
                          value={newRule.description}
                          onChange={(e) => setNewRule({...newRule, description: e.target.value})}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg font-body text-sm"
                          placeholder="Ex: VIP Gold"
                        />
                      </div>
                    </div>
                    <button
                      onClick={addLoyaltyRule}
                      disabled={!newRule.points_threshold || !newRule.discount_percent || savingSettings}
                      data-testid="save-loyalty-rule-btn"
                      className="mt-3 px-6 py-2 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                      {savingSettings ? 'Enregistrement...' : 'Enregistrer la règle'}
                    </button>
                  </div>
                )}

                <div className="divide-y divide-slate-100">
                  {(platformSettings?.loyalty_rules || []).map(rule => (
                    <div key={rule.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full ${rule.is_active ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        <div>
                          <p className="font-body font-medium text-slate-800">
                            {rule.points_threshold?.toLocaleString()} points → {rule.discount_percent}% de réduction
                          </p>
                          <p className="font-body text-sm text-slate-500">{rule.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleLoyaltyRule(rule.id)}
                          data-testid={`toggle-rule-${rule.id}`}
                          className={`w-12 h-6 rounded-full relative transition-colors ${rule.is_active ? 'bg-green-500' : 'bg-gray-300'}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${rule.is_active ? 'right-1' : 'left-1'}`}></div>
                        </button>
                        <button
                          onClick={() => deleteLoyaltyRule(rule.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {(platformSettings?.loyalty_rules || []).length === 0 && (
                    <div className="p-8 text-center text-slate-500">
                      <p>Aucune règle de fidélité configurée</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Time-Based Promotions */}
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-heading text-lg text-slate-800" data-testid="time-promos-title">Promotions horaires</h3>
                    <p className="font-body text-sm text-slate-500 mt-1">Réductions automatiques pendant des créneaux horaires spécifiques</p>
                  </div>
                  <button
                    onClick={() => setShowAddPromotion(!showAddPromotion)}
                    data-testid="add-time-promo-btn"
                    className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
                  >
                    + Ajouter une promotion
                  </button>
                </div>

                {showAddPromotion && (
                  <div className="p-4 bg-slate-50 border-b border-slate-100">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="font-body text-sm text-slate-600 block mb-1">Nom de la promotion</label>
                        <input
                          type="text"
                          value={newPromo.name}
                          onChange={(e) => setNewPromo({...newPromo, name: e.target.value})}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg font-body text-sm"
                          placeholder="Ex: Happy Hour Matin"
                          data-testid="promo-name-input"
                        />
                      </div>
                      <div>
                        <label className="font-body text-sm text-slate-600 block mb-1">% de réduction</label>
                        <input
                          type="number"
                          value={newPromo.discount_percent}
                          onChange={(e) => setNewPromo({...newPromo, discount_percent: e.target.value})}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg font-body text-sm"
                          placeholder="Ex: 30"
                          data-testid="promo-discount-input"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                      <div>
                        <label className="font-body text-sm text-slate-600 block mb-1">Heure début</label>
                        <input
                          type="number"
                          min="0" max="23"
                          value={newPromo.start_hour}
                          onChange={(e) => setNewPromo({...newPromo, start_hour: e.target.value})}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg font-body text-sm"
                          placeholder="5"
                          data-testid="promo-start-hour-input"
                        />
                      </div>
                      <div>
                        <label className="font-body text-sm text-slate-600 block mb-1">Heure fin</label>
                        <input
                          type="number"
                          min="0" max="23"
                          value={newPromo.end_hour}
                          onChange={(e) => setNewPromo({...newPromo, end_hour: e.target.value})}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg font-body text-sm"
                          placeholder="8"
                          data-testid="promo-end-hour-input"
                        />
                      </div>
                      <div>
                        <label className="font-body text-sm text-slate-600 block mb-1">Date début</label>
                        <input
                          type="date"
                          value={newPromo.start_date}
                          onChange={(e) => setNewPromo({...newPromo, start_date: e.target.value})}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg font-body text-sm"
                        />
                      </div>
                      <div>
                        <label className="font-body text-sm text-slate-600 block mb-1">Date fin</label>
                        <input
                          type="date"
                          value={newPromo.end_date}
                          onChange={(e) => setNewPromo({...newPromo, end_date: e.target.value})}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg font-body text-sm"
                        />
                      </div>
                    </div>
                    <div className="mb-3">
                      <label className="font-body text-sm text-slate-600 block mb-2">Jours actifs</label>
                      <div className="flex gap-2 flex-wrap">
                        {dayNames.map((day, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              const days = newPromo.days_of_week.includes(i)
                                ? newPromo.days_of_week.filter(d => d !== i)
                                : [...newPromo.days_of_week, i];
                              setNewPromo({...newPromo, days_of_week: days});
                            }}
                            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                              newPromo.days_of_week.includes(i)
                                ? 'bg-primary text-white'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={addTimePromotion}
                      disabled={!newPromo.name || !newPromo.discount_percent || !newPromo.start_hour || !newPromo.end_hour || savingSettings}
                      data-testid="save-time-promo-btn"
                      className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                      {savingSettings ? 'Enregistrement...' : 'Enregistrer la promotion'}
                    </button>
                  </div>
                )}

                <div className="divide-y divide-slate-100">
                  {(platformSettings?.time_promotions || []).map(promo => (
                    <div key={promo.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full ${promo.is_active ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        <div>
                          <p className="font-body font-medium text-slate-800">{promo.name}</p>
                          <p className="font-body text-sm text-slate-500">
                            {promo.discount_percent}% de réduction • {promo.start_hour}h - {promo.end_hour}h
                            {promo.start_date && ` • Du ${promo.start_date}`}
                            {promo.end_date && ` au ${promo.end_date}`}
                          </p>
                          <div className="flex gap-1 mt-1">
                            {promo.days_of_week?.map(d => (
                              <span key={d} className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{dayNames[d]}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleTimePromotion(promo.id)}
                          data-testid={`toggle-promo-${promo.id}`}
                          className={`w-12 h-6 rounded-full relative transition-colors ${promo.is_active ? 'bg-green-500' : 'bg-gray-300'}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${promo.is_active ? 'right-1' : 'left-1'}`}></div>
                        </button>
                        <button
                          onClick={() => deleteTimePromotion(promo.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {(platformSettings?.time_promotions || []).length === 0 && (
                    <div className="p-8 text-center text-slate-500">
                      <p>Aucune promotion horaire configurée</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Referral Settings */}
              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <h3 className="font-heading text-lg text-slate-800" data-testid="referral-settings-title">Paramètres de parrainage</h3>
                  <p className="font-body text-sm text-slate-500 mt-1">Configurez les bonus de parrainage</p>
                </div>
                <div className="p-4 space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                    <div>
                      <p className="font-body font-medium text-slate-800">Bonus nouveau client (parrainé)</p>
                      <p className="font-body text-sm text-slate-500">Points offerts au nouveau client qui s'inscrit avec un code</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={platformSettings?.referral_bonus_new_user ?? 50}
                        onChange={(e) => setPlatformSettings(prev => ({...prev, referral_bonus_new_user: parseInt(e.target.value)}))}
                        onBlur={(e) => updateReferralSettings('referral_bonus_new_user', e.target.value)}
                        className="w-24 px-3 py-2 border border-slate-200 rounded-lg font-body text-sm text-right"
                        data-testid="referral-bonus-new-input"
                      />
                      <span className="font-body text-sm text-slate-500">pts</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                    <div>
                      <p className="font-body font-medium text-slate-800">Bonus parrain</p>
                      <p className="font-body text-sm text-slate-500">Points offerts au parrain pour chaque filleul inscrit</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={platformSettings?.referral_bonus_referrer ?? 100}
                        onChange={(e) => setPlatformSettings(prev => ({...prev, referral_bonus_referrer: parseInt(e.target.value)}))}
                        onBlur={(e) => updateReferralSettings('referral_bonus_referrer', e.target.value)}
                        className="w-24 px-3 py-2 border border-slate-200 rounded-lg font-body text-sm text-right"
                        data-testid="referral-bonus-referrer-input"
                      />
                      <span className="font-body text-sm text-slate-500">pts</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Account Modal */}
      {showCreateAccount && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white rounded-t-2xl flex items-center justify-between">
              <h3 className="font-heading text-lg text-slate-800" data-testid="create-account-title">Créer un compte</h3>
              <button onClick={() => setShowCreateAccount(false)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="font-body text-sm text-slate-600 block mb-1">Type de compte</label>
                <select value={newAccount.account_type} onChange={(e) => setNewAccount({...newAccount, account_type: e.target.value})} data-testid="account-type-select" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                  <option value="vendor">Vendeur</option>
                  <option value="delivery">Livreur</option>
                  <option value="customer">Client</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="font-body text-sm text-slate-600 block mb-1">{newAccount.account_type === 'customer' ? 'Pseudo' : 'Nom'}</label>
                <input type="text" value={newAccount.name} onChange={(e) => setNewAccount({...newAccount, name: e.target.value})} data-testid="account-name-input" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Nom complet" />
              </div>
              {newAccount.account_type !== 'customer' && (
                <div>
                  <label className="font-body text-sm text-slate-600 block mb-1">Email</label>
                  <input type="email" value={newAccount.email} onChange={(e) => setNewAccount({...newAccount, email: e.target.value})} data-testid="account-email-input" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
              )}
              <div>
                <label className="font-body text-sm text-slate-600 block mb-1">Téléphone</label>
                <input type="tel" value={newAccount.phone} onChange={(e) => setNewAccount({...newAccount, phone: e.target.value})} data-testid="account-phone-input" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="font-body text-sm text-slate-600 block mb-1">Mot de passe</label>
                <input type="text" value={newAccount.password} onChange={(e) => setNewAccount({...newAccount, password: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              </div>
              {(newAccount.account_type === 'vendor' || newAccount.account_type === 'delivery') && (
                <div>
                  <label className="font-body text-sm text-slate-600 block mb-1">Zone</label>
                  <select value={newAccount.zone} onChange={(e) => setNewAccount({...newAccount, zone: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                    <option value="bonapriso">Bonapriso</option>
                    <option value="akwa">Akwa</option>
                    <option value="deido">Deido</option>
                    <option value="bonamoussadi">Bonamoussadi</option>
                    <option value="bepanda">Bepanda</option>
                    <option value="makepe">Makepe</option>
                  </select>
                </div>
              )}
              
              {/* Privileges section */}
              <div className="border-t pt-4">
                <p className="font-body font-medium text-slate-700 mb-3">Privilèges</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-body text-xs text-slate-500 block mb-1">Taux de confiance (%)</label>
                    <input type="number" min="0" max="100" value={newAccount.trust_rate} onChange={(e) => setNewAccount({...newAccount, trust_rate: parseInt(e.target.value) || 0})} data-testid="trust-rate-input" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  {newAccount.account_type === 'vendor' && (
                    <div>
                      <label className="font-body text-xs text-slate-500 block mb-1">Note par défaut (0-5)</label>
                      <input type="number" min="0" max="5" step="0.1" value={newAccount.default_rating} onChange={(e) => setNewAccount({...newAccount, default_rating: parseFloat(e.target.value) || 0})} data-testid="default-rating-input" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                    </div>
                  )}
                  {newAccount.account_type === 'customer' && (
                    <div>
                      <label className="font-body text-xs text-slate-500 block mb-1">Points de fidélité</label>
                      <input type="number" min="0" value={newAccount.loyalty_points} onChange={(e) => setNewAccount({...newAccount, loyalty_points: parseInt(e.target.value) || 0})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                    </div>
                  )}
                </div>
                {newAccount.account_type === 'vendor' && (
                  <label className="flex items-center gap-2 mt-3 cursor-pointer">
                    <input type="checkbox" checked={newAccount.is_verified} onChange={(e) => setNewAccount({...newAccount, is_verified: e.target.checked})} className="rounded" data-testid="is-verified-checkbox" />
                    <span className="font-body text-sm text-slate-700">Compte vérifié</span>
                  </label>
                )}
              </div>
              
              <button onClick={createAccount} disabled={creatingAccount} data-testid="submit-create-account" className="w-full py-3 bg-slate-800 text-white rounded-xl font-medium disabled:opacity-50 hover:bg-slate-700">
                {creatingAccount ? 'Création...' : 'Créer le compte'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkImport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg">
            <div className="p-6 border-b flex items-center justify-between">
              <h3 className="font-heading text-lg text-slate-800" data-testid="bulk-import-title">Import en masse ({bulkAccountType}s)</h3>
              <button onClick={() => setShowBulkImport(false)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="font-body text-sm text-slate-600 block mb-1">Type</label>
                <select value={bulkAccountType} onChange={(e) => setBulkAccountType(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                  <option value="vendor">Vendeurs</option>
                  <option value="delivery">Livreurs</option>
                  <option value="customer">Clients</option>
                </select>
              </div>
              <div>
                <label className="font-body text-sm text-slate-600 block mb-1">
                  Données (une ligne par compte, séparées par des virgules)
                </label>
                <p className="font-body text-xs text-slate-400 mb-2">
                  {bulkAccountType === 'customer' ? 'Format: Pseudo, Téléphone, Email, Mot de passe' : 'Format: Nom, Email, Téléphone, Mot de passe, Zone'}
                </p>
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  data-testid="bulk-import-textarea"
                  className="w-full h-40 px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono"
                  placeholder={bulkAccountType === 'customer' ? 'Jean, 690111111, jean@mail.com, pass123\nMarie, 690222222, marie@mail.com, pass456' : 'Restaurant A, rest@mail.com, 690111111, pass123, bonapriso\nRestaurant B, rest2@mail.com, 690222222, pass456, akwa'}
                />
              </div>
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>{bulkText.trim().split('\n').filter(l => l.trim()).length} compte(s) à créer</span>
              </div>
              <button onClick={bulkImportAccounts} disabled={!bulkText.trim()} data-testid="submit-bulk-import" className="w-full py-3 bg-slate-800 text-white rounded-xl font-medium disabled:opacity-50 hover:bg-slate-700">
                Importer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-2 lg:hidden">
        <div className="flex justify-around">
          {[
            { id: 'overview', icon: Package },
            { id: 'vendors', icon: Crown },
            { id: 'orders', icon: Package },
            { id: 'customers', icon: User },
            { id: 'finance', icon: CheckCircle },
            { id: 'settings', icon: AlertCircle }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`p-3 rounded-xl ${activeTab === item.id ? 'bg-slate-100 text-slate-800' : 'text-slate-400'}`}
            >
              <item.icon size={24} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
