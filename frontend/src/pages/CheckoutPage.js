import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  ChevronLeft, User, MapPin, RefreshCw, Navigation, CheckCircle,
  Package, Crown, Check
} from 'lucide-react';
import { useCart } from '../CartContext';
import { API, LocationPickerMap } from '../MapUtils';

const CheckoutPage = () => {
  const navigate = useNavigate();
  const { cart } = useCart();
  const submitting = useRef(false);
  const [formData, setFormData] = useState({
    pseudonym: '',
    phone: '',
    email: '',
    address: '',
    payment_method: 'orange',
    latitude: null,
    longitude: null
  });
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [step, setStep] = useState(1); // 1: Info, 2: Location, 3: Payment
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [customer, setCustomer] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [walletLoading, setWalletLoading] = useState(false);

  // Fetch wallet balance for logged-in customer (used to enable wallet payment)
  useEffect(() => {
    const token = localStorage.getItem('hemeley_customer_token');
    if (!token) return;
    setWalletLoading(true);
    axios
      .get(`${API}/wallet/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setWallet(res.data))
      .catch(() => setWallet(null))
      .finally(() => setWalletLoading(false));
  }, []);

  // Check if customer is logged in and pre-fill data
  useEffect(() => {
    const customerData = localStorage.getItem('hemeley_customer');
    const token = localStorage.getItem('hemeley_customer_token');
    
    if (customerData && token) {
      try {
        const parsed = JSON.parse(customerData);
        setCustomer(parsed);
        setIsLoggedIn(true);
        
        // Pre-fill form with customer data
        setFormData(prev => ({
          ...prev,
          pseudonym: parsed.pseudo || '',
          phone: parsed.phone || '',
          email: parsed.email || ''
        }));
        
        // If customer has a default address, pre-fill it
        const defaultAddress = parsed.addresses?.find(a => a.is_default);
        if (defaultAddress) {
          setFormData(prev => ({
            ...prev,
            address: defaultAddress.address,
            latitude: defaultAddress.latitude,
            longitude: defaultAddress.longitude
          }));
          if (defaultAddress.latitude && defaultAddress.longitude) {
            setPosition([defaultAddress.latitude, defaultAddress.longitude]);
          }
        }
        
        // Skip to step 2 (location) if info is already filled
        if (parsed.pseudo && parsed.phone) {
          setStep(2);
        }
      } catch (e) {
        console.error('Error parsing customer data:', e);
      }
    }
  }, []);

  useEffect(() => {
    if (cart.items.length === 0 && !submitting.current) {
      navigate('/');
    }
  }, [cart.items.length, navigate]);

  // Get current location
  const getCurrentLocation = () => {
    setGettingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const coords = [pos.coords.latitude, pos.coords.longitude];
          setPosition(coords);
          setFormData(prev => ({
            ...prev,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          }));
          
          // Reverse geocoding
          try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&zoom=18&addressdetails=1`);
            const data = await response.json();
            if (data.display_name) {
              setFormData(prev => ({ ...prev, address: data.display_name }));
            }
          } catch (error) {
            console.error('Error getting address:', error);
          }
          setGettingLocation(false);
        },
        (error) => {
          console.error('Error getting location:', error);
          toast.error('Impossible d\'obtenir votre position. Veuillez sélectionner sur la carte.');
          setGettingLocation(false);
        },
        { enableHighAccuracy: true }
      );
    } else {
      toast.error('La géolocalisation n\'est pas supportée par votre navigateur');
      setGettingLocation(false);
    }
  };

  const handlePositionChange = (newPosition) => {
    setPosition(newPosition);
    setFormData(prev => ({
      ...prev,
      latitude: newPosition[0],
      longitude: newPosition[1]
    }));
  };

  const handleAddressFromMap = (address) => {
    setFormData(prev => ({ ...prev, address }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.pseudonym || !formData.phone) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (!position || !formData.address) {
      toast.error('Veuillez sélectionner votre adresse de livraison sur la carte');
      setStep(2);
      return;
    }

    setLoading(true);

    try {
      // Create order with cart items
      const orderData = {
        items: cart.items,
        total: cart.total,
        customer_info: {
          ...formData,
          latitude: position[0],
          longitude: position[1]
        }
      };

      // Wallet payment requires the customer JWT
      const requestConfig = {};
      if (formData.payment_method === 'wallet') {
        const token = localStorage.getItem('hemeley_customer_token');
        if (!token) {
          toast.error('Connectez-vous pour utiliser votre wallet');
          setLoading(false);
          return;
        }
        requestConfig.headers = { Authorization: `Bearer ${token}` };
      }

      const response = await axios.post(`${API}/orders/checkout`, orderData, requestConfig);
      
      if (response.data.orders && response.data.orders.length > 0) {
        // Mark the form as submitting so the empty-cart effect doesn't pre-navigate
        submitting.current = true;
        const orderId = response.data.orders[0].id;
        const paymentMethod = formData.payment_method;

        if (paymentMethod === 'orange' || paymentMethod === 'mtn') {
          // Mobile Money : ne PAS vider le panier — la PaymentStatusPage le videra
          // uniquement quand le statut CamPay sera exactement "SUCCESSFUL".
          // Cela permet le bouton "Réessayer" en cas d'échec sans perdre le panier.
          navigate(`/payment-status?type=order&order_id=${orderId}&method=${paymentMethod}`);
        } else {
          // Wallet/Cash : paiement déjà confirmé côté backend.
          // PaymentSuccessPage videra le panier APRÈS son montage (évite race
          // condition DOM insertBefore entre clearCart() + navigate()).
          toast.success('Commande créée avec succès!');
          navigate(`/payment-success?order_id=${orderId}`);
        }
      } else {
        throw new Error('Aucune commande créée');
      }
    } catch (error) {
      console.error('Error during checkout:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de la commande');
    } finally {
      setLoading(false);
    }
  };

  if (cart.items.length === 0) {
    return null;
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-20">
      
      {/* Header */}
      <div className="bg-primary text-white p-4 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <button
            data-testid="back-from-checkout-btn"
            onClick={() => step > 1 ? setStep(step - 1) : navigate('/')}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex-1">
            <h1 className="font-heading text-xl tracking-wide">Finaliser la commande</h1>
            <p className="font-body text-sm opacity-80">Étape {step} sur 3</p>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="max-w-2xl mx-auto mt-4 flex gap-2">
          {[1, 2, 3].map(s => (
            <div 
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? 'bg-white' : 'bg-white/30'}`}
            />
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        {/* Step 1: Customer Info */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in">
            {/* Connected Customer Banner */}
            {isLoggedIn && customer && (
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl p-4 flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <Check size={24} />
                </div>
                <div>
                  <p className="font-bold">Bonjour {customer.pseudo} !</p>
                  <p className="text-sm opacity-90">Vos informations sont pré-remplies</p>
                </div>
              </div>
            )}
            
            {/* Login Prompt for non-logged users */}
            {!isLoggedIn && (
              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-orange-800">Vous avez un compte ?</p>
                  <p className="text-sm text-orange-600">Connectez-vous pour commander plus vite</p>
                </div>
                <button 
                  onClick={() => navigate('/client/login', { state: { from: '/checkout' } })}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium text-sm"
                >
                  Connexion
                </button>
              </div>
            )}
            
            <div className="bg-white rounded-2xl p-6 border border-stone-100 shadow-sm">
              <h2 className="font-heading text-2xl text-text mb-6 flex items-center gap-2">
                <User size={24} className="text-primary" />
                Vos informations
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="font-body font-medium text-text mb-2 block">Nom complet *</label>
                  <input
                    data-testid="checkout-name-input"
                    type="text"
                    required
                    value={formData.pseudonym}
                    onChange={(e) => setFormData({ ...formData, pseudonym: e.target.value })}
                    className="w-full bg-stone-50 border-2 border-stone-200 rounded-xl px-4 py-3 focus:border-primary focus:bg-white focus:outline-none font-body transition-all"
                    placeholder="Ex: Jean Kamga"
                  />
                </div>

                <div>
                  <label className="font-body font-medium text-text mb-2 block">Téléphone *</label>
                  <input
                    data-testid="checkout-phone-input"
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-stone-50 border-2 border-stone-200 rounded-xl px-4 py-3 focus:border-primary focus:bg-white focus:outline-none font-body transition-all"
                    placeholder="6XXXXXXXX"
                  />
                </div>

                <div>
                  <label className="font-body font-medium text-text mb-2 block">Email (optionnel)</label>
                  <input
                    data-testid="checkout-email-input"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-stone-50 border-2 border-stone-200 rounded-xl px-4 py-3 focus:border-primary focus:bg-white focus:outline-none font-body transition-all"
                    placeholder="votre@email.com"
                  />
                </div>
              </div>
            </div>

            {/* Order Summary Mini */}
            <div className="bg-white rounded-2xl p-4 border border-stone-100 shadow-sm">
              <div className="flex justify-between items-center">
                <span className="font-body text-text-muted">{cart.items.length} article(s)</span>
                <span className="font-heading text-xl text-primary">{cart.total.toLocaleString()} FCFA</span>
              </div>
            </div>

            <button
              onClick={() => {
                if (!formData.pseudonym || !formData.phone) {
                  toast.error('Veuillez remplir votre nom et téléphone');
                  return;
                }
                setStep(2);
              }}
              className="w-full bg-primary text-white rounded-full py-4 font-heading text-xl tracking-wide shadow-lg hover:scale-105 active:scale-95 transition-transform flex items-center justify-center gap-2"
              data-testid="next-step-btn"
            >
              Continuer
              <ChevronLeft size={20} className="rotate-180" />
            </button>
          </div>
        )}

        {/* Step 2: Location */}
        {step === 2 && (
          <div className="space-y-4 animate-in fade-in">
            <div className="bg-white rounded-2xl p-6 border border-stone-100 shadow-sm">
              <h2 className="font-heading text-2xl text-text mb-4 flex items-center gap-2">
                <MapPin size={24} className="text-primary" />
                Adresse de livraison
              </h2>
              
              <p className="font-body text-text-muted mb-4">
                Cliquez sur la carte pour sélectionner votre position exacte
              </p>

              {/* Get Current Location Button */}
              <button
                onClick={getCurrentLocation}
                disabled={gettingLocation}
                className="w-full mb-4 bg-stone-100 text-text rounded-xl py-3 font-body font-medium hover:bg-stone-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                data-testid="get-location-btn"
              >
                {gettingLocation ? (
                  <>
                    <RefreshCw size={20} className="animate-spin" />
                    Localisation en cours...
                  </>
                ) : (
                  <>
                    <Navigation size={20} />
                    Utiliser ma position actuelle
                  </>
                )}
              </button>

              {/* Map */}
              <div className="rounded-2xl overflow-hidden border-2 border-stone-200 mb-4">
                <LocationPickerMap 
                  position={position}
                  setPosition={handlePositionChange}
                  onAddressChange={handleAddressFromMap}
                />
              </div>

              {/* Selected Address */}
              {formData.address && (
                <div className="bg-success/10 border-2 border-success rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle size={20} className="text-success flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-body font-medium text-text">Adresse sélectionnée</p>
                      <p className="font-body text-sm text-text-muted">{formData.address}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Manual Address Input */}
              <div className="mt-4">
                <label className="font-body font-medium text-text mb-2 block">Précisions supplémentaires</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-stone-50 border-2 border-stone-200 rounded-xl px-4 py-3 focus:border-primary focus:bg-white focus:outline-none font-body transition-all"
                  rows={2}
                  placeholder="Numéro, étage, repère..."
                  data-testid="checkout-address-input"
                />
              </div>
            </div>

            <button
              onClick={() => {
                if (!formData.address) {
                  toast.error('Veuillez sélectionner votre adresse de livraison');
                  return;
                }
                setStep(3);
              }}
              className="w-full bg-primary text-white rounded-full py-4 font-heading text-xl tracking-wide shadow-lg hover:scale-105 active:scale-95 transition-transform flex items-center justify-center gap-2"
            >
              Continuer vers le paiement
              <ChevronLeft size={20} className="rotate-180" />
            </button>
          </div>
        )}

        {/* Step 3: Payment */}
        {step === 3 && (
          <div className="space-y-4 animate-in fade-in">
            {/* Order Summary */}
            <div className="bg-white rounded-2xl p-6 border border-stone-100 shadow-sm">
              <h2 className="font-heading text-2xl text-text mb-4 flex items-center gap-2">
                <Package size={24} className="text-primary" />
                Récapitulatif
              </h2>
              
              <div className="space-y-3 mb-4">
                {cart.items.map(item => (
                  <div key={item.menu_id} className="flex justify-between items-center py-2 border-b border-stone-100">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-stone-100 rounded-lg overflow-hidden">
                        {item.image_base64 ? (
                          <img src={item.image_base64} alt={item.menu_name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xl">🍛</div>
                        )}
                      </div>
                      <div>
                        <p className="font-body font-medium text-text">{item.menu_name}</p>
                        <p className="font-body text-sm text-text-muted">{item.vendor_name} × {item.quantity}</p>
                      </div>
                    </div>
                    <p className="font-body font-bold text-primary">{item.subtotal.toLocaleString()} FCFA</p>
                  </div>
                ))}
              </div>

              {/* Delivery Info */}
              <div className="bg-stone-50 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 text-text-muted mb-2">
                  <MapPin size={16} />
                  <span className="font-body text-sm">Livraison à</span>
                </div>
                <p className="font-body text-text text-sm">{formData.address}</p>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-stone-200">
                <span className="font-heading text-xl text-text">Total</span>
                <span className="font-heading text-2xl text-primary" data-testid="checkout-total">{cart.total.toLocaleString()} FCFA</span>
              </div>
            </div>

            {/* Payment Method */}
            <div className="bg-white rounded-2xl p-6 border border-stone-100 shadow-sm">
              <h2 className="font-heading text-2xl text-text mb-4 flex items-center gap-2">
                <Crown size={24} className="text-primary" />
                Méthode de paiement
              </h2>

              <div className="space-y-3">
                {/* Wallet HEMELEY — only for logged-in customers */}
                {isLoggedIn && wallet && (() => {
                  const balance = Number(wallet.balance || 0);
                  const insufficient = balance < cart.total;
                  const frozen = wallet.status !== 'active';
                  const disabled = insufficient || frozen;
                  return (
                    <label
                      className={`flex items-center gap-4 p-4 border-2 rounded-xl transition-all ${
                        disabled
                          ? 'border-stone-200 bg-stone-50 cursor-not-allowed opacity-60'
                          : formData.payment_method === 'wallet'
                          ? 'border-primary bg-primary/5 cursor-pointer'
                          : 'border-stone-200 hover:border-primary/50 cursor-pointer'
                      }`}
                    >
                      <input
                        data-testid="checkout-payment-wallet"
                        type="radio"
                        name="payment_method"
                        value="wallet"
                        checked={formData.payment_method === 'wallet'}
                        disabled={disabled}
                        onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                        className="w-5 h-5 accent-primary"
                      />
                      <div className="flex-1">
                        <p className="font-body font-bold text-text flex items-center gap-2">
                          Wallet HEMELEY
                          <span data-testid="wallet-balance-badge" className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                            {balance.toLocaleString()} FCFA
                          </span>
                        </p>
                        <p className="font-body text-sm text-text-muted">
                          {frozen
                            ? 'Wallet figé — contactez le support'
                            : insufficient
                            ? `Solde insuffisant — il manque ${(cart.total - balance).toLocaleString()} FCFA`
                            : 'Paiement instantané depuis votre wallet'}
                        </p>
                      </div>
                      <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-white">
                        <Crown size={18} />
                      </div>
                    </label>
                  );
                })()}

                {isLoggedIn && !wallet && !walletLoading && (
                  <div className="text-xs text-text-muted px-1">
                    Wallet indisponible pour le moment.
                  </div>
                )}

                <label className={`flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all ${formData.payment_method === 'orange' ? 'border-primary bg-primary/5' : 'border-stone-200 hover:border-primary/50'}`}>
                  <input
                    data-testid="checkout-payment-orange"
                    type="radio"
                    name="payment_method"
                    value="orange"
                    checked={formData.payment_method === 'orange'}
                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                    className="w-5 h-5 accent-primary"
                  />
                  <div className="flex-1">
                    <p className="font-body font-bold text-text">Orange Money</p>
                    <p className="font-body text-sm text-text-muted">Paiement mobile Orange</p>
                  </div>
                  <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold">OM</div>
                </label>

                <label className={`flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all ${formData.payment_method === 'mtn' ? 'border-primary bg-primary/5' : 'border-stone-200 hover:border-primary/50'}`}>
                  <input
                    data-testid="checkout-payment-mtn"
                    type="radio"
                    name="payment_method"
                    value="mtn"
                    checked={formData.payment_method === 'mtn'}
                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                    className="w-5 h-5 accent-primary"
                  />
                  <div className="flex-1">
                    <p className="font-body font-bold text-text">MTN Mobile Money</p>
                    <p className="font-body text-sm text-text-muted">Paiement mobile MTN</p>
                  </div>
                  <div className="w-10 h-10 bg-yellow-400 rounded-lg flex items-center justify-center text-black font-bold">MM</div>
                </label>
              </div>
            </div>

            {/* Security Note */}
            <div className="bg-accent/20 rounded-xl p-4 border-2 border-accent flex items-start gap-3">
              <CheckCircle size={20} className="text-accent flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-body font-bold text-text">Paiement sécurisé</p>
                <p className="font-body text-sm text-text-muted">Vos informations sont protégées et sécurisées</p>
              </div>
            </div>

            <button
              data-testid="proceed-payment-btn"
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-primary text-white rounded-full py-4 font-heading text-xl tracking-wide shadow-lg hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw size={24} className="animate-spin" />
                  Traitement...
                </>
              ) : (
                <>
                  <Crown size={24} />
                  Payer {cart.total.toLocaleString()} FCFA
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};


export default CheckoutPage;
