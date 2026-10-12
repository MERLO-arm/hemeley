import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { 
  TrendingUp, TrendingDown, DollarSign, ShoppingBag, Users, Package, 
  Plus, LogOut, Download, QrCode, Sun, Moon, Bell, Search, 
  ChevronRight, Check, X, Clock, AlertTriangle, Star, Eye, EyeOff,
  BarChart3, PieChart, Calendar, Zap, Share2, MessageSquare,
  Printer, Mail, Menu as MenuIcon, RefreshCw, Settings, Home, FileSpreadsheet,
  Edit2, Trash2, MapPin, Phone, ChevronLeft, Store, Table2, Copy
} from 'lucide-react';
import { toast } from 'sonner';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, BarElement, Filler } from 'chart.js';
import { QRCodeSVG } from 'qrcode.react';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { WalletCard, WithdrawalModal, TransactionsList, WithdrawalsList } from './WalletComponents';
import HemeleyLogo from './HemeleyLogo';
import useWalletNotifications from './useWalletNotifications';
import VendorAnalyticsTab from './VendorAnalyticsTab';
import VendorProfileBranding from './VendorProfileBranding';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, BarElement, Filler);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
const API = `${BACKEND_URL}/api`;
const FRONTEND_URL = process.env.REACT_APP_BACKEND_URL?.replace('/api', '') || window.location.origin;

const VendorDashboard2026 = () => {
  const navigate = useNavigate();
  const [vendor, setVendor] = useState(null);

  // Subscribe to real-time wallet/payment events for this vendor
  useWalletNotifications(vendor?.id || null);
  const [darkMode, setDarkMode] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [menus, setMenus] = useState([]);
  const [orders, setOrders] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [focusMode, setFocusMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuCategoryFilter, setMenuCategoryFilter] = useState('all');
  const [showQRModal, setShowQRModal] = useState(false);
  const [showTableQRModal, setShowTableQRModal] = useState(false);
  const [selectedTable, setSelectedTable] = useState(1);
  const [tableCount, setTableCount] = useState(10);
  const [showKPIModal, setShowKPIModal] = useState(null);
  const [chartPeriod, setChartPeriod] = useState('7d');
  const [editingMenu, setEditingMenu] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Messages
  const [activeConversation, setActiveConversation] = useState(null);
  const [conversationMessages, setConversationMessages] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  
  // Vendor Settings
  const [editVendorField, setEditVendorField] = useState(null);
  const [editVendorValue, setEditVendorValue] = useState('');
  const [savingVendor, setSavingVendor] = useState(false);

  const token = localStorage.getItem('vendor_token');

  // Calculate real stats from orders
  const stats = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
    
    const todayOrders = orders.filter(o => new Date(o.created_at) >= today);
    const thisWeekOrders = orders.filter(o => new Date(o.created_at) >= weekAgo);
    const lastWeekOrders = orders.filter(o => {
      const d = new Date(o.created_at);
      return d >= twoWeeksAgo && d < weekAgo;
    });
    
    const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const thisWeekRevenue = thisWeekOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const lastWeekRevenue = lastWeekOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    
    const avgBasket = orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0;
    const deliveredOrders = orders.filter(o => o.order_status === 'delivered').length;
    const conversionRate = orders.length > 0 ? Math.round((deliveredOrders / orders.length) * 100) : 0;
    
    // Calculate percentage changes
    const revenueChange = lastWeekRevenue > 0 
      ? Math.round(((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100 * 10) / 10 
      : 0;
    const ordersChange = lastWeekOrders.length > 0 
      ? Math.round(((thisWeekOrders.length - lastWeekOrders.length) / lastWeekOrders.length) * 100 * 10) / 10 
      : 0;
    
    return {
      totalRevenue,
      todayRevenue,
      todayOrders: todayOrders.length,
      totalOrders: orders.length,
      avgBasket,
      conversionRate,
      revenueChange,
      ordersChange,
      basketChange: 0,
      conversionChange: 0,
      activeMenus: menus.filter(m => m.is_active).length,
      totalMenus: menus.length,
      unreadMessages: conversations.reduce((sum, c) => sum + (c.unread_vendor || 0), 0),
      avgRating: reviews.length > 0 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : 0,
      reviewCount: reviews.length
    };
  }, [orders, menus, conversations, reviews]);

  // Calculate chart data from real orders
  const chartData = useMemo(() => {
    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const now = new Date();
    const labels = [];
    const revenues = [];
    const orderCounts = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      labels.push(days[date.getDay()]);
      
      const dayOrders = orders.filter(o => {
        const orderDate = new Date(o.created_at);
        return orderDate.toDateString() === date.toDateString();
      });
      
      revenues.push(dayOrders.reduce((sum, o) => sum + (o.total || 0), 0));
      orderCounts.push(dayOrders.length);
    }
    
    return { labels, revenues, orderCounts };
  }, [orders]);

  // Category breakdown from menus
  const categoryData = useMemo(() => {
    const categories = {};
    orders.forEach(order => {
      order.items?.forEach(item => {
        const name = item.menu_name || 'Autre';
        categories[name] = (categories[name] || 0) + (item.subtotal || 0);
      });
    });
    
    const sorted = Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    return {
      labels: sorted.map(([name]) => name.length > 15 ? name.slice(0, 15) + '...' : name),
      values: sorted.map(([, value]) => value)
    };
  }, [orders]);

  useEffect(() => {
    const vendorData = localStorage.getItem('vendor_data');
    if (!vendorData || vendorData === 'undefined' || !token) {
      navigate('/vendor/login');
      return;
    }
    try {
      setVendor(JSON.parse(vendorData));
      fetchData();
    } catch (error) {
      navigate('/vendor/login');
    }
  }, [navigate, token]);

  const fetchData = async () => {
    if (!token) return;

    try {
      const [menusRes, ordersRes] = await Promise.all([
        axios.get(`${API}/vendor/menus`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/vendor/orders`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setMenus(menusRes.data || []);
      setOrders(ordersRes.data || []);
      
      // Fetch conversations and reviews
      const vendorData = JSON.parse(localStorage.getItem('vendor_data') || '{}');
      if (vendorData.id) {
        try {
          const [convsRes, reviewsRes] = await Promise.all([
            axios.get(`${API}/vendors/messaging/conversations?vendor_id=${vendorData.id}`),
            axios.get(`${API}/vendors/${vendorData.id}/reviews`)
          ]);
          setConversations(convsRes.data || []);
          setReviews(reviewsRes.data || []);
        } catch (e) {
          console.log('Optional data fetch error:', e);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
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
    toast.success('Déconnexion réussie');
    navigate('/');
  };

  const toggleMenuActive = async (menuId, isActive) => {
    try {
      await axios.put(`${API}/menus/${menuId}/toggle`, { is_active: !isActive }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(isActive ? 'Menu désactivé' : 'Menu activé');
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      await axios.put(`${API}/orders/${orderId}/status`, { order_status: status }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Statut mis à jour');
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const deleteMenu = async (menuId) => {
    if (!window.confirm('Voulez-vous vraiment supprimer ce menu ?')) return;
    try {
      await axios.delete(`${API}/menus/${menuId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Menu supprimé');
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const updateMenuPortions = async (menuId, portions) => {
    try {
      await axios.put(`${API}/menus/${menuId}`, { remaining_portions: portions }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Stock mis à jour');
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    
    // Orders sheet
    const ordersData = orders.map(o => ({
      'N° Commande': o.order_number || o.id?.slice(-6),
      'Client': o.customer_name,
      'Téléphone': o.customer_phone,
      'Articles': o.items?.map(i => `${i.quantity}x ${i.menu_name}`).join(', '),
      'Total (FCFA)': o.total,
      'Statut': o.order_status === 'pending' ? 'En attente' :
                o.order_status === 'confirmed' ? 'Confirmée' :
                o.order_status === 'ready' ? 'Prête' :
                o.order_status === 'delivered' ? 'Livrée' : 'Annulée',
      'Paiement': o.payment_status === 'success' ? 'Payé' : 'En attente',
      'Date': new Date(o.created_at).toLocaleDateString('fr-FR'),
      'Heure': new Date(o.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    }));
    const wsOrders = XLSX.utils.json_to_sheet(ordersData);
    XLSX.utils.book_append_sheet(wb, wsOrders, 'Commandes');
    
    // Menus sheet
    const menusData = menus.map(m => ({
      'Nom': m.name,
      'Description': m.description,
      'Prix (FCFA)': m.price,
      'Portions Totales': m.total_portions,
      'Portions Restantes': m.remaining_portions,
      'Actif': m.is_active ? 'Oui' : 'Non',
      'Zone': m.zone
    }));
    const wsMenus = XLSX.utils.json_to_sheet(menusData);
    XLSX.utils.book_append_sheet(wb, wsMenus, 'Menus');
    
    // Stats sheet
    const statsData = [{
      'Revenus Totaux (FCFA)': stats.totalRevenue,
      'Commandes Totales': stats.totalOrders,
      'Commandes Aujourd\'hui': stats.todayOrders,
      'Panier Moyen (FCFA)': stats.avgBasket,
      'Taux de Conversion (%)': stats.conversionRate,
      'Plats Actifs': stats.activeMenus,
      'Note Moyenne': stats.avgRating,
      'Nombre d\'Avis': stats.reviewCount
    }];
    const wsStats = XLSX.utils.json_to_sheet(statsData);
    XLSX.utils.book_append_sheet(wb, wsStats, 'Statistiques');
    
    const fileName = `hemeley_${vendor?.name?.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success('Export Excel téléchargé!');
  };

  const exportPDF = async () => {
    try {
      toast.info('Génération du PDF...');
      const response = await axios.get(`${API}/export/vendor/orders-report`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      saveAs(blob, `rapport_${vendor?.name?.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('PDF téléchargé!');
    } catch (error) {
      toast.error('Erreur lors de l\'export PDF');
    }
  };

  // ==================== MESSAGING ====================
  const openConversation = async (conv) => {
    setActiveConversation(conv);
    try {
      const res = await axios.get(`${API}/vendors/messaging/conversations/${conv.id}/messages?vendor_id=${vendor?.id}`);
      setConversationMessages(res.data || []);
    } catch (error) {
      toast.error('Erreur lors du chargement des messages');
    }
  };

  const sendReply = async () => {
    if (!replyText.trim() || !activeConversation) return;
    setSendingReply(true);
    try {
      await axios.post(`${API}/vendors/messaging/conversations/${activeConversation.id}/reply`, {
        vendor_id: vendor?.id,
        content: replyText.trim()
      });
      setReplyText('');
      // Refresh messages
      const res = await axios.get(`${API}/vendors/messaging/conversations/${activeConversation.id}/messages?vendor_id=${vendor?.id}`);
      setConversationMessages(res.data || []);
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de l\'envoi');
    } finally {
      setSendingReply(false);
    }
  };

  // ==================== VENDOR SETTINGS ====================
  const saveVendorField = async () => {
    if (!editVendorField || !vendor) return;
    setSavingVendor(true);
    try {
      const res = await axios.put(`${API}/admin/vendor-profile`, {
        vendor_id: vendor.id,
        [editVendorField]: editVendorValue
      });
      const updated = res.data;
      setVendor(updated);
      localStorage.setItem('vendor_data', JSON.stringify(updated));
      toast.success('Profil mis à jour !');
      setEditVendorField(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la mise à jour');
    } finally {
      setSavingVendor(false);
    }
  };

  const downloadQRCode = (type = 'png') => {
    const svg = document.getElementById('vendor-qr-code');
    if (!svg) return;
    
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      
      canvas.toBlob((blob) => {
        saveAs(blob, `qrcode_${vendor?.name?.replace(/\s/g, '_')}.${type}`);
        toast.success(`QR Code ${type.toUpperCase()} téléchargé!`);
      }, `image/${type}`);
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const copyTableLink = (tableNum) => {
    const link = `${FRONTEND_URL}/restaurant/${vendor?.id}?table=${tableNum}`;
    navigator.clipboard.writeText(link);
    toast.success(`Lien Table ${tableNum} copié!`);
  };

  // Chart configs with real data
  const revenueChartData = {
    labels: chartData.labels,
    datasets: [{
      label: 'Revenus (FCFA)',
      data: chartData.revenues,
      fill: true,
      borderColor: '#FF6B00',
      backgroundColor: 'rgba(255, 107, 0, 0.1)',
      tension: 0.4,
      pointBackgroundColor: '#FF6B00',
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 6
    }]
  };

  const categoryChartData = {
    labels: categoryData.labels.length > 0 ? categoryData.labels : ['Aucune vente'],
    datasets: [{
      data: categoryData.values.length > 0 ? categoryData.values : [1],
      backgroundColor: ['#FF6B00', '#00D9C0', '#8B5CF6', '#F59E0B', '#6B7280'],
      borderWidth: 0,
      hoverOffset: 10
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0,0,0,0.8)',
        padding: 12,
        titleFont: { size: 14, weight: 'bold' },
        bodyFont: { size: 13 },
        cornerRadius: 8,
        callbacks: {
          label: (context) => `${context.parsed.y?.toLocaleString()} FCFA`
        }
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: darkMode ? '#9CA3AF' : '#6B7280' } },
      y: { 
        grid: { color: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }, 
        ticks: { 
          color: darkMode ? '#9CA3AF' : '#6B7280',
          callback: (value) => value.toLocaleString()
        } 
      }
    }
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { color: darkMode ? '#fff' : '#333', padding: 15, font: { size: 11 } } },
      tooltip: {
        callbacks: {
          label: (context) => `${context.label}: ${context.parsed?.toLocaleString()} FCFA`
        }
      }
    },
    cutout: '65%'
  };

  const pendingOrders = orders.filter(o => ['pending', 'confirmed', 'preparing'].includes(o.order_status));
  const filteredMenus = menus.filter(m => {
    const matchesQuery = m.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = menuCategoryFilter === 'all'
      || (m.category || 'plat').toLowerCase() === menuCategoryFilter.toLowerCase();
    return matchesQuery && matchesCat;
  });
  // Distribution des catégories pour l'UI de filtre
  const menuCategoryCounts = menus.reduce((acc, m) => {
    const k = (m.category || 'plat').toLowerCase();
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-slate-950' : 'bg-gray-100'}`}>
        <div className="text-center">
          <RefreshCw size={48} className="animate-spin text-orange-500 mx-auto mb-4" />
          <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Chargement...</p>
        </div>
      </div>
    );
  }

  // Focus Mode UI - Simplified order management
  if (focusMode) {
    return (
      <div className="min-h-screen bg-slate-950 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Zap className="text-orange-500" />
              Mode Focus
            </h1>
            <div className="flex items-center gap-4">
              <span className="text-gray-400">
                {pendingOrders.length} commande(s) en attente
              </span>
              <button onClick={() => setFocusMode(false)} className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors">
                Quitter
              </button>
            </div>
          </div>
          
          <div className="space-y-4">
            {pendingOrders.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-6xl mb-4">✨</div>
                <p className="text-xl text-gray-400">Aucune commande en attente</p>
                <p className="text-gray-500 mt-2">Vous êtes à jour!</p>
              </div>
            ) : (
              pendingOrders.map(order => (
                <div key={order.id} className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <span className="text-orange-500 font-bold text-xl">#{order.order_number || order.id?.slice(-6)}</span>
                      <span className={`ml-3 px-3 py-1 rounded-full text-xs font-bold ${
                        order.order_status === 'pending' ? 'bg-yellow-500/20 text-yellow-400 animate-pulse' : 
                        order.order_status === 'confirmed' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-purple-500/20 text-purple-400'
                      }`}>
                        {order.order_status === 'pending' ? '⚡ NOUVEAU' : 
                         order.order_status === 'confirmed' ? '👨‍🍳 CONFIRMÉE' : '🍳 EN PRÉPARATION'}
                      </span>
                    </div>
                    <span className="text-2xl font-bold text-white">{order.total?.toLocaleString()} FCFA</span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-gray-400 text-sm mb-4">
                    <span>{order.customer_name}</span>
                    <span>•</span>
                    <span>{order.customer_phone}</span>
                    <span>•</span>
                    <span>{new Date(order.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  
                  <div className="bg-slate-800/50 rounded-xl p-4 mb-4">
                    {order.items?.map((item, idx) => (
                      <div key={idx} className="flex justify-between py-2 border-b border-slate-700 last:border-0">
                        <span className="text-gray-300 font-medium">{item.quantity}× {item.menu_name}</span>
                        <span className="text-gray-400">{item.subtotal?.toLocaleString()} FCFA</span>
                      </div>
                    ))}
                  </div>

                  {order.customer_note && (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-4">
                      <p className="text-yellow-400 text-sm">📝 Note: {order.customer_note}</p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    {order.order_status === 'pending' && (
                      <>
                        <button onClick={() => updateOrderStatus(order.id, 'confirmed')} className="flex-1 py-3 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-colors flex items-center justify-center gap-2">
                          <Check size={20} /> Accepter
                        </button>
                        <button onClick={() => updateOrderStatus(order.id, 'cancelled')} className="px-6 py-3 bg-red-500/20 text-red-400 rounded-xl font-bold hover:bg-red-500/30 transition-colors">
                          <X size={20} />
                        </button>
                      </>
                    )}
                    {order.order_status === 'confirmed' && (
                      <button onClick={() => updateOrderStatus(order.id, 'preparing')} className="flex-1 py-3 bg-purple-500 text-white rounded-xl font-bold hover:bg-purple-600 transition-colors flex items-center justify-center gap-2">
                        🍳 En préparation
                      </button>
                    )}
                    {order.order_status === 'preparing' && (
                      <button onClick={() => updateOrderStatus(order.id, 'ready')} className="flex-1 py-3 bg-cyan-500 text-white rounded-xl font-bold hover:bg-cyan-600 transition-colors flex items-center justify-center gap-2">
                        ✅ Prêt à servir
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-slate-950 text-white' : 'bg-gray-100 text-gray-900'}`}>
      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 bottom-0 z-40 transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-20'} ${darkMode ? 'bg-slate-900/80' : 'bg-white/80'} backdrop-blur-xl border-r ${darkMode ? 'border-slate-800' : 'border-gray-200'}`}>
        <div className="p-4 h-full flex flex-col">
          {/* Logo */}
          <div className="mb-8">
            <HemeleyLogo size={32} showText={sidebarOpen} variant={darkMode ? 'dark' : 'default'} />
          </div>

          {/* Nav Items */}
          <nav className="flex-1 space-y-2">
            {[
              { id: 'dashboard', icon: Home, label: 'Dashboard', badge: null },
              { id: 'orders', icon: ShoppingBag, label: 'Commandes', badge: pendingOrders.length > 0 ? pendingOrders.length : null },
              { id: 'menus', icon: MenuIcon, label: 'Mes Plats', badge: null },
              { id: 'wallet', icon: DollarSign, label: 'Wallet', badge: null },
              { id: 'messages', icon: MessageSquare, label: 'Messages', badge: stats.unreadMessages > 0 ? stats.unreadMessages : null },
              { id: 'qrcodes', icon: QrCode, label: 'QR Codes', badge: null },
              { id: 'analytics', icon: BarChart3, label: 'Analytiques', badge: null },
              { id: 'reviews', icon: Star, label: 'Avis', badge: null },
              { id: 'settings', icon: Settings, label: 'Paramètres', badge: null }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all relative ${activeTab === item.id ? 'bg-orange-500/20 text-orange-500' : `${darkMode ? 'text-gray-400 hover:text-white hover:bg-slate-800' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}`}
              >
                <item.icon size={20} />
                {sidebarOpen && <span className="font-medium">{item.label}</span>}
                {item.badge && (
                  <span className={`absolute ${sidebarOpen ? 'right-4' : 'top-1 right-1'} w-5 h-5 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center`}>
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Bottom Actions */}
          <div className="space-y-2 pt-4 border-t border-slate-800">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl ${darkMode ? 'text-gray-400 hover:text-white hover:bg-slate-800' : 'text-gray-600 hover:bg-gray-100'}`}>
              <ChevronRight size={20} className={`transform transition-transform ${sidebarOpen ? 'rotate-180' : ''}`} />
              {sidebarOpen && <span>Réduire</span>}
            </button>
            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10">
              <LogOut size={20} />
              {sidebarOpen && <span>Déconnexion</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'}`}>
        {/* Header */}
        <header className={`sticky top-0 z-30 px-6 py-4 ${darkMode ? 'bg-slate-950/80' : 'bg-gray-100/80'} backdrop-blur-xl border-b ${darkMode ? 'border-slate-800' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {vendor?.logo_base64 && (
                <img
                  src={vendor.logo_base64}
                  alt={vendor.name}
                  data-testid="vendor-header-logo"
                  className="w-12 h-12 rounded-xl object-cover ring-2 ring-orange-500/30"
                />
              )}
              <div>
                <h1 className="text-2xl font-bold">Bienvenue, {vendor?.name} 👋</h1>
                <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>
                  {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Search */}
              <div className={`relative hidden md:block ${darkMode ? 'bg-slate-800' : 'bg-white'} rounded-xl`}>
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`pl-10 pr-4 py-2 rounded-xl bg-transparent outline-none w-64 ${darkMode ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'}`}
                />
              </div>

              {/* Focus Mode */}
              <button onClick={() => setFocusMode(true)} className="p-2 rounded-xl bg-orange-500/20 text-orange-500 hover:bg-orange-500/30 transition-colors relative" title="Mode Focus">
                <Zap size={20} />
                {pendingOrders.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {pendingOrders.length}
                  </span>
                )}
              </button>

              {/* Refresh */}
              <button onClick={fetchData} className={`p-2 rounded-xl transition-colors ${darkMode ? 'hover:bg-slate-800' : 'hover:bg-gray-200'}`}>
                <RefreshCw size={20} />
              </button>

              {/* Theme Toggle */}
              <button onClick={() => setDarkMode(!darkMode)} className={`p-2 rounded-xl transition-colors ${darkMode ? 'bg-slate-800 text-yellow-400' : 'bg-gray-200 text-gray-600'}`}>
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            </div>
          </div>
        </header>

        <div className="p-6">
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {[
                  { id: 'revenue', title: 'Revenus Totaux', value: `${stats.totalRevenue.toLocaleString()} FCFA`, change: stats.revenueChange, icon: DollarSign, color: 'orange' },
                  { id: 'orders', title: "Commandes Aujourd'hui", value: stats.todayOrders, change: stats.ordersChange, icon: ShoppingBag, color: 'cyan' },
                  { id: 'menus', title: 'Plats Actifs', value: `${stats.activeMenus}/${stats.totalMenus}`, change: null, icon: Package, color: 'purple' },
                  { id: 'rating', title: 'Note Moyenne', value: `${stats.avgRating}/5`, change: null, icon: Star, color: 'yellow', subtext: `${stats.reviewCount} avis` }
                ].map(kpi => (
                  <div
                    key={kpi.id}
                    className={`group relative p-6 rounded-2xl transition-all duration-300 hover:scale-[1.02] hover:shadow-xl ${darkMode ? 'bg-slate-900/50 hover:bg-slate-900/80 border border-slate-800' : 'bg-white hover:shadow-lg border border-gray-100'} backdrop-blur-xl`}
                  >
                    <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r ${kpi.color === 'orange' ? 'from-orange-500/10' : kpi.color === 'cyan' ? 'from-cyan-500/10' : kpi.color === 'purple' ? 'from-purple-500/10' : 'from-yellow-500/10'} to-transparent`} />
                    
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div className={`p-3 rounded-xl ${kpi.color === 'orange' ? 'bg-orange-500/20 text-orange-500' : kpi.color === 'cyan' ? 'bg-cyan-500/20 text-cyan-500' : kpi.color === 'purple' ? 'bg-purple-500/20 text-purple-500' : 'bg-yellow-500/20 text-yellow-500'}`}>
                          <kpi.icon size={24} />
                        </div>
                        {kpi.change !== null && (
                          <div className={`flex items-center gap-1 text-sm font-medium ${kpi.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {kpi.change >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                            {Math.abs(kpi.change)}%
                          </div>
                        )}
                      </div>
                      
                      <p className={`text-sm mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{kpi.title}</p>
                      <p className="text-2xl font-bold">{kpi.value}</p>
                      {kpi.subtext && <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{kpi.subtext}</p>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Revenue Chart */}
                <div className={`lg:col-span-2 p-6 rounded-2xl ${darkMode ? 'bg-slate-900/50 border border-slate-800' : 'bg-white border border-gray-100'} backdrop-blur-xl`}>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold">Évolution des Revenus (7 derniers jours)</h3>
                  </div>
                  <div className="h-64">
                    <Line data={revenueChartData} options={chartOptions} />
                  </div>
                </div>

                {/* Category Chart */}
                <div className={`p-6 rounded-2xl ${darkMode ? 'bg-slate-900/50 border border-slate-800' : 'bg-white border border-gray-100'} backdrop-blur-xl`}>
                  <h3 className="text-lg font-bold mb-6">Top Ventes</h3>
                  <div className="h-64">
                    <Doughnut data={categoryChartData} options={doughnutOptions} />
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <button onClick={exportExcel} className={`group flex items-center justify-center gap-3 p-4 rounded-2xl font-medium transition-all hover:scale-[1.02] ${darkMode ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                  <FileSpreadsheet size={20} />
                  Export Excel
                </button>
                <button onClick={exportPDF} className={`group flex items-center justify-center gap-3 p-4 rounded-2xl font-medium transition-all hover:scale-[1.02] ${darkMode ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}>
                  <Download size={20} />
                  Export PDF
                </button>
                <button onClick={() => setActiveTab('qrcodes')} className={`group flex items-center justify-center gap-3 p-4 rounded-2xl font-medium transition-all hover:scale-[1.02] ${darkMode ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}`}>
                  <QrCode size={20} />
                  QR Codes Tables
                </button>
                <button onClick={() => navigate('/vendor/add-menu')} className="group flex items-center justify-center gap-3 p-4 rounded-2xl font-medium bg-gradient-to-r from-orange-500 to-orange-600 text-white transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-orange-500/25">
                  <Plus size={20} />
                  Ajouter Plat
                </button>
              </div>

              {/* Recent Orders */}
              <div className={`p-6 rounded-2xl ${darkMode ? 'bg-slate-900/50 border border-slate-800' : 'bg-white border border-gray-100'} backdrop-blur-xl`}>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold">Commandes Récentes</h3>
                  {pendingOrders.length > 0 && (
                    <button onClick={() => setFocusMode(true)} className="flex items-center gap-2 px-3 py-1 bg-orange-500/20 text-orange-500 rounded-full text-sm font-bold animate-pulse">
                      <span className="w-2 h-2 rounded-full bg-orange-500" />
                      {pendingOrders.length} en attente
                    </button>
                  )}
                </div>

                {orders.length === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingBag size={48} className="mx-auto text-gray-500 mb-4" />
                    <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Aucune commande pour le moment</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className={darkMode ? 'border-b border-slate-800' : 'border-b border-gray-200'}>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">N°</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Client</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Total</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Statut</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.slice(0, 5).map(order => (
                          <tr key={order.id} className={`${darkMode ? 'border-b border-slate-800 hover:bg-slate-800/50' : 'border-b border-gray-100 hover:bg-gray-50'} transition-colors`}>
                            <td className="py-4 px-4 font-mono text-orange-500">#{order.order_number || order.id?.slice(-6)}</td>
                            <td className="py-4 px-4">
                              <p className="font-medium">{order.customer_name}</p>
                              <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{order.customer_phone}</p>
                            </td>
                            <td className="py-4 px-4 font-bold">{order.total?.toLocaleString()} FCFA</td>
                            <td className="py-4 px-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                order.order_status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                                order.order_status === 'confirmed' ? 'bg-blue-500/20 text-blue-400' :
                                order.order_status === 'preparing' ? 'bg-purple-500/20 text-purple-400' :
                                order.order_status === 'ready' ? 'bg-cyan-500/20 text-cyan-400' :
                                order.order_status === 'delivered' ? 'bg-green-500/20 text-green-400' :
                                'bg-red-500/20 text-red-400'
                              }`}>
                                {order.order_status === 'pending' ? 'En attente' :
                                 order.order_status === 'confirmed' ? 'Confirmée' :
                                 order.order_status === 'preparing' ? 'Préparation' :
                                 order.order_status === 'ready' ? 'Prête' :
                                 order.order_status === 'delivered' ? 'Livrée' : 'Annulée'}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex gap-2">
                                {order.order_status === 'pending' && (
                                  <>
                                    <button onClick={() => updateOrderStatus(order.id, 'confirmed')} className="p-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30" title="Accepter">
                                      <Check size={16} />
                                    </button>
                                    <button onClick={() => updateOrderStatus(order.id, 'cancelled')} className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30" title="Refuser">
                                      <X size={16} />
                                    </button>
                                  </>
                                )}
                                {order.order_status === 'confirmed' && (
                                  <button onClick={() => updateOrderStatus(order.id, 'preparing')} className="p-2 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30" title="En préparation">
                                    🍳
                                  </button>
                                )}
                                {order.order_status === 'preparing' && (
                                  <button onClick={() => updateOrderStatus(order.id, 'ready')} className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30" title="Prêt">
                                    <Package size={16} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {orders.length > 5 && (
                      <button onClick={() => setActiveTab('orders')} className="w-full mt-4 py-3 text-orange-500 font-medium hover:bg-orange-500/10 rounded-xl transition-colors">
                        Voir toutes les commandes ({orders.length})
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Orders Tab */}
          {activeTab === 'orders' && (
            <div className={`p-6 rounded-2xl ${darkMode ? 'bg-slate-900/50 border border-slate-800' : 'bg-white border border-gray-100'} backdrop-blur-xl`}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">Toutes les Commandes ({orders.length})</h3>
                <div className="flex gap-2">
                  <button onClick={exportExcel} className={`px-4 py-2 rounded-lg ${darkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-gray-100 hover:bg-gray-200'}`}>
                    <FileSpreadsheet size={18} />
                  </button>
                  <button onClick={() => setFocusMode(true)} className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center gap-2">
                    <Zap size={18} /> Mode Focus
                  </button>
                </div>
              </div>

              {orders.length === 0 ? (
                <div className="text-center py-20">
                  <ShoppingBag size={64} className="mx-auto text-gray-500 mb-4" />
                  <p className="text-xl text-gray-400">Aucune commande</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className={darkMode ? 'border-b border-slate-800' : 'border-b border-gray-200'}>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">N° Commande</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Client</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Articles</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Total</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Statut</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Date</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map(order => (
                        <tr key={order.id} className={`${darkMode ? 'border-b border-slate-800 hover:bg-slate-800/50' : 'border-b border-gray-100 hover:bg-gray-50'} transition-colors`}>
                          <td className="py-4 px-4 font-mono text-orange-500">#{order.order_number || order.id?.slice(-6)}</td>
                          <td className="py-4 px-4">
                            <p className="font-medium">{order.customer_name}</p>
                            <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{order.customer_phone}</p>
                          </td>
                          <td className="py-4 px-4">
                            <div className="text-sm">
                              {order.items?.map((item, i) => (
                                <div key={i}>{item.quantity}× {item.menu_name}</div>
                              ))}
                            </div>
                          </td>
                          <td className="py-4 px-4 font-bold">{order.total?.toLocaleString()} FCFA</td>
                          <td className="py-4 px-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                              order.order_status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                              order.order_status === 'confirmed' ? 'bg-blue-500/20 text-blue-400' :
                              order.order_status === 'preparing' ? 'bg-purple-500/20 text-purple-400' :
                              order.order_status === 'ready' ? 'bg-cyan-500/20 text-cyan-400' :
                              order.order_status === 'delivered' ? 'bg-green-500/20 text-green-400' :
                              'bg-red-500/20 text-red-400'
                            }`}>
                              {order.order_status === 'pending' ? 'En attente' :
                               order.order_status === 'confirmed' ? 'Confirmée' :
                               order.order_status === 'preparing' ? 'Préparation' :
                               order.order_status === 'ready' ? 'Prête' :
                               order.order_status === 'delivered' ? 'Livrée' : 'Annulée'}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-sm">
                            {new Date(order.created_at).toLocaleDateString('fr-FR')}<br/>
                            <span className="text-gray-500">{new Date(order.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex gap-2">
                              {order.order_status === 'pending' && (
                                <>
                                  <button onClick={() => updateOrderStatus(order.id, 'confirmed')} className="p-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30">
                                    <Check size={16} />
                                  </button>
                                  <button onClick={() => updateOrderStatus(order.id, 'cancelled')} className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30">
                                    <X size={16} />
                                  </button>
                                </>
                              )}
                              {order.order_status === 'confirmed' && (
                                <button onClick={() => updateOrderStatus(order.id, 'preparing')} className="p-2 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30">
                                  🍳
                                </button>
                              )}
                              {order.order_status === 'preparing' && (
                                <button onClick={() => updateOrderStatus(order.id, 'ready')} className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30">
                                  <Package size={16} />
                                </button>
                              )}
                              {order.order_status === 'ready' && (
                                <button onClick={() => updateOrderStatus(order.id, 'delivered')} className="p-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30">
                                  ✅
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Menus Tab */}
          {activeTab === 'menus' && (
            <div className={`p-6 rounded-2xl ${darkMode ? 'bg-slate-900/50 border border-slate-800' : 'bg-white border border-gray-100'} backdrop-blur-xl`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Mes Plats ({menus.length})</h3>
                <button onClick={() => navigate('/vendor/add-menu')} className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center gap-2">
                  <Plus size={18} /> Ajouter
                </button>
              </div>

              {/* Filtres catégorie */}
              {menus.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-5 overflow-x-auto" data-testid="menu-category-filter">
                  <button
                    onClick={() => setMenuCategoryFilter('all')}
                    data-testid="menu-filter-all"
                    className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${
                      menuCategoryFilter === 'all'
                        ? 'bg-orange-500 text-white'
                        : darkMode ? 'bg-slate-800 text-gray-300 hover:bg-slate-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Toutes ({menus.length})
                  </button>
                  {['entree','plat','boisson','dessert','petit-dejeuner','snack','autre'].map(cat => (
                    (menuCategoryCounts[cat] || 0) > 0 && (
                      <button
                        key={cat}
                        onClick={() => setMenuCategoryFilter(cat)}
                        data-testid={`menu-filter-${cat}`}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${
                          menuCategoryFilter === cat
                            ? 'bg-orange-500 text-white'
                            : darkMode ? 'bg-slate-800 text-gray-300 hover:bg-slate-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {cat === 'entree' ? 'Entrées' : cat === 'plat' ? 'Plats' :
                         cat === 'boisson' ? 'Boissons' : cat === 'dessert' ? 'Desserts' :
                         cat === 'petit-dejeuner' ? 'Petit-déj' : cat === 'snack' ? 'Snacks' : 'Autres'}
                        {' '}({menuCategoryCounts[cat]})
                      </button>
                    )
                  ))}
                  {/* Catégories custom du vendor */}
                  {(vendor?.custom_categories || []).map(cat => {
                    const key = cat.toLowerCase();
                    return (menuCategoryCounts[key] || 0) > 0 && (
                      <button
                        key={key}
                        onClick={() => setMenuCategoryFilter(key)}
                        data-testid={`menu-filter-${key}`}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${
                          menuCategoryFilter === key
                            ? 'bg-orange-500 text-white'
                            : darkMode ? 'bg-slate-800 text-gray-300 hover:bg-slate-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {cat} ({menuCategoryCounts[key]})
                      </button>
                    );
                  })}
                </div>
              )}

              {filteredMenus.length === 0 ? (
                <div className="text-center py-20">
                  <MenuIcon size={64} className="mx-auto text-gray-500 mb-4" />
                  <p className="text-xl text-gray-400 mb-4">Aucun menu</p>
                  <button onClick={() => navigate('/vendor/add-menu')} className="px-6 py-3 bg-orange-500 text-white rounded-xl">
                    Créer mon premier menu
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredMenus.map(menu => (
                    <div key={menu.id} className={`group relative rounded-2xl overflow-hidden ${darkMode ? 'bg-slate-800/50' : 'bg-gray-50'} transition-all hover:scale-[1.02]`}>
                      <div className="aspect-video bg-slate-700 relative overflow-hidden">
                        {menu.image_base64 ? (
                          <img src={menu.image_base64.startsWith('data:') ? menu.image_base64 : `data:image/jpeg;base64,${menu.image_base64}`} alt={menu.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-4xl">🍛</div>
                        )}
                        <div className="absolute top-2 left-2 flex gap-2">
                          {menu.remaining_portions <= 3 && menu.remaining_portions > 0 && (
                            <span className="px-2 py-1 bg-red-500 text-white text-xs rounded-full font-bold">Stock bas</span>
                          )}
                          {menu.remaining_portions === 0 && (
                            <span className="px-2 py-1 bg-gray-500 text-white text-xs rounded-full font-bold">Épuisé</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-bold truncate flex-1">{menu.name}</h4>
                          <span className="text-orange-500 font-bold ml-2">{menu.price?.toLocaleString()} F</span>
                        </div>
                        
                        <div className="mb-3">
                          <div className="flex justify-between text-xs mb-1">
                            <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Stock</span>
                            <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>{menu.remaining_portions}/{menu.total_portions}</span>
                          </div>
                          <div className={`h-2 rounded-full ${darkMode ? 'bg-slate-700' : 'bg-gray-200'}`}>
                            <div 
                              className={`h-full rounded-full transition-all ${menu.remaining_portions > 5 ? 'bg-green-500' : menu.remaining_portions > 2 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              style={{ width: `${Math.min((menu.remaining_portions / menu.total_portions) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => toggleMenuActive(menu.id, menu.is_active)}
                            className={`relative w-12 h-6 rounded-full transition-colors ${menu.is_active ? 'bg-green-500' : darkMode ? 'bg-slate-600' : 'bg-gray-300'}`}
                          >
                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${menu.is_active ? 'translate-x-7' : 'translate-x-1'}`} />
                          </button>
                          <div className="flex gap-1">
                            <button onClick={() => deleteMenu(menu.id)} className="p-2 rounded-lg text-red-400 hover:bg-red-500/20">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Wallet Tab */}
          {activeTab === 'wallet' && (
            <VendorWalletPanel darkMode={darkMode} />
          )}

          {/* QR Codes Tab */}
          {activeTab === 'qrcodes' && (
            <div className="space-y-6">
              {/* Restaurant QR Code */}
              <div className={`p-6 rounded-2xl ${darkMode ? 'bg-slate-900/50 border border-slate-800' : 'bg-white border border-gray-100'} backdrop-blur-xl`}>
                <h3 className="text-xl font-bold mb-6">QR Code Restaurant</h3>
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <div className="p-4 bg-white rounded-2xl">
                    <QRCodeSVG 
                      id="vendor-qr-code"
                      value={`${FRONTEND_URL}/restaurant/${vendor?.id}`}
                      size={200}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                  <div className="flex-1">
                    <p className={`mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Scannez ce QR code pour accéder directement à votre page restaurant sur HEMELEY.
                      Les clients pourront voir vos menus et commander.
                    </p>
                    <div className="flex gap-3 flex-wrap">
                      <button onClick={() => downloadQRCode('png')} className={`px-4 py-2 rounded-lg font-medium ${darkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-gray-100 hover:bg-gray-200'}`}>
                        <Download size={18} className="inline mr-2" />PNG
                      </button>
                      <button onClick={() => {
                        navigator.clipboard.writeText(`${FRONTEND_URL}/restaurant/${vendor?.id}`);
                        toast.success('Lien copié!');
                      }} className={`px-4 py-2 rounded-lg font-medium ${darkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-gray-100 hover:bg-gray-200'}`}>
                        <Copy size={18} className="inline mr-2" />Copier le lien
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Table QR Codes */}
              <div className={`p-6 rounded-2xl ${darkMode ? 'bg-slate-900/50 border border-slate-800' : 'bg-white border border-gray-100'} backdrop-blur-xl`}>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold">QR Codes par Table</h3>
                    <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Générez des QR codes uniques pour chaque table de votre restaurant
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Nombre de tables:</label>
                    <input 
                      type="number"
                      min="1"
                      max="50"
                      value={tableCount}
                      onChange={(e) => setTableCount(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
                      className={`w-20 px-3 py-2 rounded-lg ${darkMode ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-900'}`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {Array.from({ length: tableCount }, (_, i) => i + 1).map(tableNum => (
                    <div key={tableNum} className={`p-4 rounded-xl ${darkMode ? 'bg-slate-800/50' : 'bg-gray-50'} text-center`}>
                      <div className="p-2 bg-white rounded-lg inline-block mb-3">
                        <QRCodeSVG 
                          value={`${FRONTEND_URL}/restaurant/${vendor?.id}?table=${tableNum}`}
                          size={100}
                          level="M"
                        />
                      </div>
                      <p className="font-bold mb-2">Table {tableNum}</p>
                      <div className="flex gap-2 justify-center">
                        <button 
                          onClick={() => copyTableLink(tableNum)}
                          className={`p-2 rounded-lg ${darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-200 hover:bg-gray-300'}`}
                          title="Copier le lien"
                        >
                          <Copy size={14} />
                        </button>
                        <button 
                          onClick={() => {
                            setSelectedTable(tableNum);
                            setShowTableQRModal(true);
                          }}
                          className={`p-2 rounded-lg ${darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-200 hover:bg-gray-300'}`}
                          title="Agrandir"
                        >
                          <Eye size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Messages Tab */}
          {activeTab === 'messages' && (
            <div className={`p-6 rounded-2xl ${darkMode ? 'bg-slate-900/50 border border-slate-800' : 'bg-white border border-gray-100'} backdrop-blur-xl`}>
              <h3 className="text-xl font-bold mb-6">Messages ({conversations.length})</h3>
              
              {activeConversation ? (
                <div>
                  {/* Back + Header */}
                  <button onClick={() => { setActiveConversation(null); setConversationMessages([]); }} className="flex items-center gap-2 mb-4 text-orange-500 hover:underline" data-testid="back-to-conversations">
                    <ChevronLeft size={18} /> Retour aux conversations
                  </button>
                  <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-700/50">
                    <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center">
                      <span className="text-orange-500 font-bold">{activeConversation.customer_name?.charAt(0)}</span>
                    </div>
                    <p className="font-medium">{activeConversation.customer_name}</p>
                  </div>

                  {/* Messages list */}
                  <div className="space-y-3 max-h-96 overflow-y-auto mb-4 p-2" data-testid="messages-list">
                    {conversationMessages.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">Aucun message</p>
                    ) : conversationMessages.map((msg, i) => (
                      <div key={msg.id || i} className={`flex ${msg.sender_type === 'vendor' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                          msg.sender_type === 'vendor'
                            ? 'bg-orange-500 text-white rounded-br-md'
                            : darkMode ? 'bg-slate-800 text-white rounded-bl-md' : 'bg-gray-100 text-gray-900 rounded-bl-md'
                        }`}>
                          <p>{msg.content}</p>
                          <p className={`text-xs mt-1 ${msg.sender_type === 'vendor' ? 'text-orange-100' : 'text-gray-500'}`}>
                            {msg.created_at ? new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Reply input */}
                  <div className="flex gap-2" data-testid="reply-form">
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendReply()}
                      placeholder="Écrire un message..."
                      data-testid="reply-input"
                      className={`flex-1 px-4 py-3 rounded-xl border ${darkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                    />
                    <button
                      onClick={sendReply}
                      disabled={!replyText.trim() || sendingReply}
                      data-testid="send-reply-btn"
                      className="px-6 py-3 bg-orange-500 text-white rounded-xl font-medium disabled:opacity-50 hover:bg-orange-600 transition-colors"
                    >
                      {sendingReply ? '...' : 'Envoyer'}
                    </button>
                  </div>
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-20">
                  <MessageSquare size={64} className="mx-auto text-gray-500 mb-4" />
                  <p className="text-xl text-gray-400">Aucun message</p>
                  <p className="text-gray-500 mt-2">Les clients pourront vous contacter depuis votre page restaurant</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {conversations.map(conv => (
                    <div key={conv.id} onClick={() => openConversation(conv)} className={`p-4 rounded-xl ${darkMode ? 'bg-slate-800/50 hover:bg-slate-800' : 'bg-gray-50 hover:bg-gray-100'} cursor-pointer transition-colors`} data-testid={`conversation-${conv.id}`}>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center">
                          <span className="text-orange-500 font-bold">{conv.customer_name?.charAt(0)}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="font-medium">{conv.customer_name}</p>
                            {conv.last_message_at && (
                              <span className="text-xs text-gray-500">
                                {new Date(conv.last_message_at).toLocaleDateString('fr-FR')}
                              </span>
                            )}
                          </div>
                          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'} truncate`}>
                            {conv.last_message || 'Nouvelle conversation'}
                          </p>
                        </div>
                        {conv.unread_vendor > 0 && (
                          <span className="w-6 h-6 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center">
                            {conv.unread_vendor}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Reviews Tab */}
          {activeTab === 'reviews' && (
            <div className={`p-6 rounded-2xl ${darkMode ? 'bg-slate-900/50 border border-slate-800' : 'bg-white border border-gray-100'} backdrop-blur-xl`}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold">Avis Clients ({reviews.length})</h3>
                  {reviews.length > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex">
                        {[1,2,3,4,5].map(i => (
                          <Star key={i} size={16} className={i <= Math.round(parseFloat(stats.avgRating)) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-400'} />
                        ))}
                      </div>
                      <span className="text-lg font-bold">{stats.avgRating}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {reviews.length === 0 ? (
                <div className="text-center py-20">
                  <Star size={64} className="mx-auto text-gray-500 mb-4" />
                  <p className="text-xl text-gray-400">Aucun avis</p>
                  <p className="text-gray-500 mt-2">Les avis de vos clients apparaîtront ici</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reviews.map(review => (
                    <div key={review.id} className={`p-4 rounded-xl ${darkMode ? 'bg-slate-800/50' : 'bg-gray-50'}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center">
                            <span className="text-orange-500 font-bold">{review.customer_name?.charAt(0)}</span>
                          </div>
                          <div>
                            <p className="font-medium">{review.customer_name}</p>
                            <div className="flex items-center gap-1">
                              {[1,2,3,4,5].map(i => (
                                <Star key={i} size={12} className={i <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-400'} />
                              ))}
                            </div>
                          </div>
                        </div>
                        <span className="text-sm text-gray-500">
                          {new Date(review.created_at).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      {review.comment && (
                        <p className={`mt-3 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{review.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <VendorAnalyticsTab darkMode={darkMode} />
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <VendorProfileBranding
                vendor={vendor}
                darkMode={darkMode}
                onSaved={(v) => setVendor(prev => ({ ...prev, ...v }))}
              />
              <div className={`p-6 rounded-2xl ${darkMode ? 'bg-slate-900/50 border border-slate-800' : 'bg-white border border-gray-100'} backdrop-blur-xl`}>
              <h3 className="text-xl font-bold mb-6">Paramètres du compte</h3>
              
              <div className="space-y-3">
                {[
                  { field: 'name', label: 'Nom du restaurant', value: vendor?.name, icon: '🏪' },
                  { field: 'email', label: 'Email', value: vendor?.email, icon: '📧' },
                  { field: 'phone', label: 'Téléphone', value: vendor?.phone, icon: '📞' },
                  { field: 'whatsapp', label: 'WhatsApp', value: vendor?.whatsapp || vendor?.phone, icon: '💬' },
                  { field: 'zone', label: 'Zone', value: vendor?.zone, icon: '📍' },
                  { field: 'description', label: 'Description', value: vendor?.description || '', icon: '📝' },
                  { field: 'opening_hours', label: 'Heures d\'ouverture', value: vendor?.opening_hours || '', icon: '🕐' },
                  { field: 'closing_hours', label: 'Heures de fermeture', value: vendor?.closing_hours || '', icon: '🕘' }
                ].map((item, i) => (
                  <div key={i} className={`flex items-center justify-between p-4 rounded-xl ${darkMode ? 'bg-slate-800/50' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{item.icon}</span>
                      <div>
                        <p className="text-sm text-gray-500">{item.label}</p>
                        {editVendorField === item.field ? (
                          <input
                            type="text"
                            value={editVendorValue}
                            onChange={(e) => setEditVendorValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && saveVendorField()}
                            autoFocus
                            data-testid={`edit-vendor-${item.field}`}
                            className={`mt-1 w-full px-3 py-1.5 rounded-lg border ${darkMode ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300'}`}
                          />
                        ) : (
                          <p className="font-medium">{item.value || '-'}</p>
                        )}
                      </div>
                    </div>
                    {editVendorField === item.field ? (
                      <div className="flex gap-2">
                        <button onClick={saveVendorField} disabled={savingVendor} className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-sm font-medium" data-testid={`save-vendor-${item.field}`}>
                          {savingVendor ? '...' : 'OK'}
                        </button>
                        <button onClick={() => setEditVendorField(null)} className="px-3 py-1.5 bg-gray-500 text-white rounded-lg text-sm">
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => { setEditVendorField(item.field); setEditVendorValue(item.value || ''); }}
                        data-testid={`edit-btn-${item.field}`}
                        className={`px-4 py-2 rounded-lg text-sm font-medium ${darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-gray-200 hover:bg-gray-300'} transition-colors`}
                      >
                        Modifier
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            </div>
          )}
        </div>
      </main>

      {/* Table QR Modal */}
      {showTableQRModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className={`w-full max-w-md p-6 rounded-3xl ${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">Table {selectedTable}</h3>
              <button onClick={() => setShowTableQRModal(false)} className="p-2 rounded-lg hover:bg-slate-800">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-white rounded-2xl">
                <QRCodeSVG 
                  value={`${FRONTEND_URL}/restaurant/${vendor?.id}?table=${selectedTable}`}
                  size={250}
                  level="H"
                  includeMargin={true}
                />
              </div>
            </div>
            
            <p className={`text-center text-sm mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Les clients qui scannent ce code seront dirigés vers votre menu avec le numéro de table {selectedTable} pré-rempli.
            </p>
            
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => copyTableLink(selectedTable)}
                className={`p-3 rounded-xl font-medium ${darkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-gray-100 hover:bg-gray-200'}`}
              >
                <Copy size={18} className="mx-auto mb-1" />
                <span className="text-sm">Copier lien</span>
              </button>
              <button 
                onClick={() => {
                  window.print();
                  toast.success('Impression lancée');
                }}
                className={`p-3 rounded-xl font-medium ${darkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-gray-100 hover:bg-gray-200'}`}
              >
                <Printer size={18} className="mx-auto mb-1" />
                <span className="text-sm">Imprimer</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorDashboard2026;

// ==================== VENDOR WALLET PANEL ====================

const VendorWalletPanel = ({ darkMode }) => {
  const [showWithdrawal, setShowWithdrawal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [balance, setBalance] = useState(0);

  // Lift the balance from a hidden axios call so the WithdrawalModal knows the cap
  useEffect(() => {
    const token = localStorage.getItem('vendor_token');
    if (!token) return;
    axios.get(`${API}/wallet/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setBalance(Number(res.data?.balance || 0)))
      .catch(() => setBalance(0));
  }, [refreshKey]);

  return (
    <div className="space-y-6" data-testid="vendor-wallet-tab">
      <WalletCard
        role="vendor"
        onOpenWithdraw={() => setShowWithdrawal(true)}
        refreshKey={refreshKey}
      />

      <WithdrawalModal
        open={showWithdrawal}
        onClose={() => setShowWithdrawal(false)}
        onSuccess={() => setRefreshKey(k => k + 1)}
        balance={balance}
        role="vendor"
      />

      <div>
        <h3 className={`font-bold text-lg mb-3 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          <RefreshCw size={18} /> Demandes de retrait
        </h3>
        <WithdrawalsList role="vendor" refreshKey={refreshKey} />
      </div>

      <div>
        <h3 className={`font-bold text-lg mb-3 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          <Clock size={18} /> Historique des paiements
        </h3>
        <TransactionsList role="vendor" refreshKey={refreshKey} />
      </div>
    </div>
  );
};
