import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Plus, Minus, ShoppingBag, X, CheckCircle2, RefreshCw, Smartphone, Wallet,
  MapPin, Utensils, ShieldCheck, Check, ArrowRight
} from 'lucide-react';
import CoverCarousel from '../components/CoverCarousel';
import CategorizedMenuList from '../components/CategorizedMenuList';

const API = (process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000') + '/api';

/**
 * /menu/:slug — Page publique branded d'un restaurant (scan QR code).
 * Détection automatique de présence :
 *  - Sur site : paramètre 't' (jeton HMAC sécurisé permanent de table)
 *  - À distance : absence de jeton ou jeton invalide
 */
const PublicMenuPage = () => {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const tableToken = searchParams.get('t');
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cart, setCart] = useState({}); // { menu_id: quantity }
  const [showCheckout, setShowCheckout] = useState(false);

  useEffect(() => {
    const url = `${API}/public/menu/${encodeURIComponent(slug)}${tableToken ? `?t=${encodeURIComponent(tableToken)}` : ''}`;
    axios.get(url)
      .then((res) => setData(res.data))
      .catch((e) => setError(e?.response?.data?.detail || 'Restaurant introuvable'))
      .finally(() => setLoading(false));
  }, [slug, tableToken]);

  const addItem = (menuId) => setCart((c) => ({ ...c, [menuId]: (c[menuId] || 0) + 1 }));
  const removeItem = (menuId) => setCart((c) => {
    const next = { ...c, [menuId]: Math.max(0, (c[menuId] || 0) - 1) };
    if (next[menuId] === 0) delete next[menuId];
    return next;
  });

  const cartItems = data
    ? Object.entries(cart).map(([id, qty]) => {
        const m = data.menus.find((x) => x.id === id);
        return m ? { ...m, qty } : null;
      }).filter(Boolean)
    : [];
  const total = cartItems.reduce((s, it) => s + it.price * it.qty, 0);
  const itemCount = cartItems.reduce((s, it) => s + it.qty, 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50" data-testid="public-menu-loading">
        <RefreshCw size={42} className="animate-spin text-orange-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4" data-testid="public-menu-error">
        <div className="bg-white max-w-md w-full rounded-3xl shadow-xl p-8 text-center">
          <div className="text-5xl mb-3">🍽️</div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Restaurant introuvable</h1>
          <p className="text-slate-500 mb-4">{error}</p>
          <button onClick={() => navigate('/')} className="bg-orange-500 text-white rounded-full px-6 py-3 font-semibold">Accueil HEMELEY</button>
        </div>
      </div>
    );
  }

  const { vendor, menus, table_info } = data;
  const brand = vendor.brand_color || '#FF6B00';
  const isOnSite = Boolean(table_info?.is_table);
  const tableNumber = table_info?.table_number;

  return (
    <div className="min-h-screen bg-stone-50" data-testid="public-menu-page">
      {/* Dynamic Presence Banner */}
      {isOnSite ? (
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white px-4 py-3 shadow-md sticky top-0 z-30" data-testid="presence-banner-onsite">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-bold text-lg flex-shrink-0">
                🍽️
              </div>
              <div>
                <p className="font-extrabold text-sm sm:text-base leading-tight flex items-center gap-2">
                  <span>SUR PLACE — TABLE N° {tableNumber}</span>
                </p>
                <p className="text-xs text-emerald-100 hidden sm:block">
                  Service direct à table · Validation express sans friction
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-semibold backdrop-blur-sm whitespace-nowrap border border-white/25">
              Sur site détecté ✅
            </span>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-4 py-2.5 shadow-sm sticky top-0 z-30" data-testid="presence-banner-remote">
          <div className="max-w-3xl mx-auto flex items-center justify-between text-xs sm:text-sm">
            <span className="flex items-center gap-2 font-medium">
              <span>🛵</span> Commande à distance (À emporter / Livraison)
            </span>
            <span className="text-slate-400 text-xs">
              Lien partagé public
            </span>
          </div>
        </div>
      )}

      {/* Cover carousel */}
      <CoverCarousel
        photos={vendor.cover_photos && vendor.cover_photos.length > 0
          ? vendor.cover_photos
          : (vendor.cover_base64 ? [vendor.cover_base64] : [])}
        logo={vendor.logo_base64}
        brandColor={brand}
        testid="public-menu-cover"
      />

      {/* Header */}
      <div className="max-w-3xl mx-auto px-4 -mt-12 relative z-10">
        <div className="bg-white rounded-3xl shadow-xl p-6 flex items-center gap-4" data-testid="public-menu-header">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md text-white font-bold text-2xl"
            style={{ backgroundColor: brand }}
          >
            {vendor.logo_base64
              ? <img src={vendor.logo_base64} alt={vendor.name} className="w-full h-full rounded-2xl object-cover" />
              : vendor.name?.charAt(0)?.toUpperCase() || '🍽️'}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 truncate" data-testid="vendor-name">{vendor.name}</h1>
            {vendor.slogan && <p className="text-slate-600 text-sm">{vendor.slogan}</p>}
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className="text-xs text-slate-500 flex items-center gap-1">📍 {vendor.zone}</span>
              {isOnSite && (
                <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full">
                  Table {tableNumber}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Menu list */}
      <div className="max-w-3xl mx-auto px-4 py-8 pb-32">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">Notre carte</h2>
          {isOnSite && (
            <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              ⚡ Commande directe à table
            </span>
          )}
        </div>

        {menus.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center text-slate-500">
            Aucun plat disponible pour le moment.
          </div>
        ) : (
          <CategorizedMenuList
            menus={menus}
            customCategories={vendor.custom_categories || []}
            accentColor={brand}
            testid="public-menu-list"
            renderItem={(m) => {
              const qty = cart[m.id] || 0;
              return (
                <div key={m.id} className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-all p-4 flex gap-4" data-testid={`menu-item-${m.id}`}>
                  <div className="w-24 h-24 rounded-xl bg-stone-100 overflow-hidden flex-shrink-0">
                    {m.image_base64 ? (
                      <img src={m.image_base64} alt={m.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl">🍛</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900">{m.name}</h3>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-1">{m.description}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-bold" style={{ color: brand }}>{Number(m.price).toLocaleString()} FCFA</span>
                      {qty === 0 ? (
                        <button
                          onClick={() => addItem(m.id)}
                          data-testid={`add-${m.id}`}
                          className="text-white rounded-full px-4 py-1.5 text-sm font-semibold inline-flex items-center gap-1 hover:opacity-90 transition-transform active:scale-95 shadow-sm"
                          style={{ backgroundColor: brand }}
                        >
                          <Plus size={14} /> Ajouter
                        </button>
                      ) : (
                        <div className="inline-flex items-center gap-2">
                          <button onClick={() => removeItem(m.id)} className="w-7 h-7 rounded-full bg-stone-200 hover:bg-stone-300 flex items-center justify-center transition-colors"><Minus size={14} /></button>
                          <span className="font-semibold w-6 text-center">{qty}</span>
                          <button onClick={() => addItem(m.id)} className="w-7 h-7 rounded-full text-white flex items-center justify-center transition-colors" style={{ backgroundColor: brand }}><Plus size={14} /></button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            }}
          />
        )}
      </div>

      {/* Bottom cart bar */}
      {itemCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 shadow-2xl p-4 z-40" data-testid="public-cart-bar">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs text-slate-500">{itemCount} article{itemCount > 1 ? 's' : ''} {isOnSite ? `· Table ${tableNumber}` : ''}</p>
              <p className="text-xl font-bold" style={{ color: brand }}>{total.toLocaleString()} FCFA</p>
            </div>
            <button
              onClick={() => setShowCheckout(true)}
              data-testid="public-checkout-btn"
              className="text-white font-bold rounded-full px-6 py-3.5 inline-flex items-center gap-2 hover:opacity-90 shadow-lg active:scale-95 transition-transform"
              style={{ backgroundColor: brand }}
            >
              <ShoppingBag size={18} /> {isOnSite ? `Commander (Table ${tableNumber})` : 'Commander'}
            </button>
          </div>
        </div>
      )}

      {/* Checkout modal */}
      {showCheckout && (
        <PublicCheckoutModal
          slug={slug}
          vendor={vendor}
          brand={brand}
          cartItems={cartItems}
          total={total}
          tableInfo={table_info}
          tableToken={tableToken}
          onClose={() => setShowCheckout(false)}
          onSuccess={() => setCart({})}
        />
      )}

      {/* Footer */}
      <div className="text-center py-6 text-xs text-slate-400">
        <Link to="/" className="hover:underline">propulsé par HEMELEY</Link>
      </div>
    </div>
  );
};


/**
 * Tunnel de commande adapté selon la présence (Sur site vs À distance)
 */
const PublicCheckoutModal = ({ slug, brand, cartItems, total, tableInfo, tableToken, onClose, onSuccess }) => {
  const navigate = useNavigate();
  const isOnSite = Boolean(tableInfo?.is_table);
  const tableNumber = tableInfo?.table_number;

  const [step, setStep] = useState('info'); // info | done
  const [loading, setLoading] = useState(false);
  // Sur site : espèces à table par défaut (0 friction) ; À distance : cash à la livraison
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [result, setResult] = useState(null);

  const submit = async () => {
    // Validation stricte uniquement si À DISTANCE
    if (!isOnSite) {
      if (!name.trim()) {
        toast.error('Veuillez renseigner votre nom pour la livraison');
        return;
      }
      if (!phone.trim()) {
        toast.error('Veuillez renseigner votre téléphone de contact');
        return;
      }
      if (!address.trim()) {
        toast.error('Veuillez renseigner votre adresse de livraison');
        return;
      }
    }

    // Si paiement online, le téléphone est nécessaire pour la pop-up USSD
    if (paymentMethod === 'online' && !phone.trim()) {
      toast.error('Veuillez renseigner un numéro Mobile Money pour valider le paiement');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        customer_name: name.trim() || (isOnSite ? `Client Table ${tableNumber}` : 'Client'),
        customer_phone: phone.trim() || (isOnSite ? '' : '237600000000'),
        customer_address: isOnSite ? null : (address.trim() || null),
        customer_note: note.trim() || null,
        items: cartItems.map((it) => ({ menu_id: it.id, quantity: it.qty })),
        payment_method: paymentMethod,
        table_token: isOnSite ? tableToken : null,
        table_number: isOnSite ? tableNumber : null,
      };

      const res = await axios.post(`${API}/public/order/${encodeURIComponent(slug)}`, payload);
      setResult(res.data);
      setStep('done');
      if (onSuccess) onSuccess();

      if (paymentMethod === 'online' && res.data.campay_reference) {
        toast.success('Demande Mobile Money transmise !');
      } else if (isOnSite) {
        toast.success(`Commande Table ${tableNumber} envoyée en cuisine ! 🍳`);
      } else {
        toast.success('Commande enregistrée pour livraison !');
      }
    } catch (e) {
      console.error('Order submit error:', e);
      toast.error(e?.response?.data?.detail || 'Erreur lors de la validation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4" data-testid="public-checkout-modal">
      <div className="bg-white w-full max-w-lg rounded-t-3xl md:rounded-3xl max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-stone-200 px-5 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-lg text-slate-900">
              {step === 'info' ? (isOnSite ? `Commande Table N° ${tableNumber}` : 'Votre commande à distance') : 'Confirmation'}
            </h2>
            {isOnSite && (
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
                Sur place
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors"><X size={20} /></button>
        </div>

        {step === 'info' && (
          <div className="p-5 space-y-4">
            {/* Banner info */}
            {isOnSite ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3" data-testid="checkout-onsite-banner">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xl flex-shrink-0">
                  {tableNumber}
                </div>
                <div className="text-sm">
                  <p className="font-bold text-emerald-900">Table N° {tableNumber} identifiée</p>
                  <p className="text-emerald-700 text-xs">Votre commande sera servie directement à cette table.</p>
                </div>
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3.5 flex items-center gap-3 text-sm text-blue-900" data-testid="checkout-remote-banner">
                <span className="text-xl">🛵</span>
                <div>
                  <p className="font-bold">Commande à distance / Livraison</p>
                  <p className="text-xs text-blue-700">Renseignez votre adresse pour la livraison.</p>
                </div>
              </div>
            )}

            {/* Cart summary */}
            <div className="bg-stone-50 rounded-2xl p-4 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Récapitulatif des plats</p>
              {cartItems.map((it) => (
                <div key={it.id} className="flex justify-between text-sm py-1 border-b border-stone-200/60 last:border-0">
                  <span className="text-slate-800 font-medium">{it.name} <span className="text-slate-400 font-normal">× {it.qty}</span></span>
                  <span className="font-semibold">{(it.price * it.qty).toLocaleString()} FCFA</span>
                </div>
              ))}
              <div className="border-t border-stone-200 pt-2 flex justify-between font-bold text-base">
                <span>Total à régler</span>
                <span style={{ color: brand }}>{total.toLocaleString()} FCFA</span>
              </div>
            </div>

            {/* Form Fields: Strict for remote, Frictionless for on-site */}
            {isOnSite ? (
              // SUR SITE : Options facultatives pour zéro friction
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Votre prénom ou pseudo <span className="text-slate-400 font-normal">(optionnel)</span>
                  </label>
                  <input
                    data-testid="input-customer-name-onsite"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={`Ex: Client Table ${tableNumber}`}
                    className="w-full border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Numéro de téléphone <span className="text-slate-400 font-normal">(optionnel si paiement au serveur)</span>
                  </label>
                  <input
                    data-testid="input-customer-phone-onsite"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="237 6XX XXX XXX (requis si Mobile Money)"
                    className="w-full border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Précisions cuisine <span className="text-slate-400 font-normal">(optionnel)</span>
                  </label>
                  <input
                    data-testid="input-customer-note-onsite"
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Sans piment, sauce à part..."
                    className="w-full border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>
            ) : (
              // À DISTANCE : Informations requises obligatoires
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nom complet <span className="text-red-500">*</span>
                  </label>
                  <input
                    data-testid="input-customer-name-remote"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jean Dupont"
                    className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Téléphone (contact livreur) <span className="text-red-500">*</span>
                  </label>
                  <input
                    data-testid="input-customer-phone-remote"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="237 6XX XXX XXX"
                    className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Adresse / Localisation de livraison <span className="text-red-500">*</span>
                  </label>
                  <input
                    data-testid="input-customer-address-remote"
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Quartier, rue, repère, n° porte..."
                    className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Instructions particulières <span className="text-slate-400 font-normal">(optionnel)</span>
                  </label>
                  <input
                    data-testid="input-customer-note-remote"
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Appeler en arrivant au portail..."
                    className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>
            )}

            {/* Payment Method Selection */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Mode de règlement</label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  data-testid="payment-cash-btn"
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-3.5 rounded-2xl border-2 text-left transition-all ${
                    paymentMethod === 'cash' ? 'border-orange-500 bg-orange-50/70 shadow-sm' : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <Wallet size={20} className={paymentMethod === 'cash' ? 'text-orange-600 mb-1.5' : 'text-slate-500 mb-1.5'} />
                  <p className="font-bold text-sm text-slate-900 leading-tight">
                    {isOnSite ? 'Payer à table / comptoir' : 'Espèces à la livraison'}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isOnSite ? 'Règlement au serveur' : 'Cash au livreur'}
                  </p>
                </button>

                <button
                  type="button"
                  data-testid="payment-online-btn"
                  onClick={() => setPaymentMethod('online')}
                  className={`p-3.5 rounded-2xl border-2 text-left transition-all ${
                    paymentMethod === 'online' ? 'border-orange-500 bg-orange-50/70 shadow-sm' : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <Smartphone size={20} className={paymentMethod === 'online' ? 'text-orange-600 mb-1.5' : 'text-slate-500 mb-1.5'} />
                  <p className="font-bold text-sm text-slate-900 leading-tight">Mobile Money</p>
                  <p className="text-xs text-slate-500 mt-0.5">Orange / MTN Money</p>
                </button>
              </div>
            </div>

            <button
              onClick={submit}
              disabled={loading}
              data-testid="public-submit-order-btn"
              className="w-full text-white font-bold rounded-full py-4 hover:opacity-95 disabled:opacity-50 transition-transform active:scale-[0.98] shadow-lg flex items-center justify-center gap-2 mt-4 text-base"
              style={{ backgroundColor: brand }}
            >
              {loading ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Envoi de la commande...
                </>
              ) : isOnSite ? (
                `Valider pour la Table ${tableNumber} (${total.toLocaleString()} FCFA)`
              ) : (
                `Confirmer la commande (${total.toLocaleString()} FCFA)`
              )}
            </button>
          </div>
        )}

        {step === 'done' && result && (
          <div className="p-6 text-center space-y-4" data-testid="public-order-confirmed">
            <div className="w-20 h-20 mx-auto bg-emerald-100 rounded-full flex items-center justify-center">
              <CheckCircle2 size={42} className="text-emerald-600" />
            </div>
            
            <div>
              <h3 className="text-2xl font-black text-slate-900">
                {isOnSite ? 'Commande transmise en cuisine !' : 'Commande enregistrée !'}
              </h3>
              <p className="text-slate-600 text-sm mt-1">
                N° de commande : <span className="font-mono font-bold text-slate-900">{result.order_number}</span>
              </p>
            </div>

            {isOnSite && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-left text-sm text-emerald-950">
                <p className="font-bold text-emerald-900 flex items-center gap-1.5 mb-1">
                  <span>🍽️</span> Servi à la Table N° {tableNumber}
                </p>
                <p className="text-xs text-emerald-800">
                  {paymentMethod === 'cash'
                    ? 'Votre commande est en préparation. Vous pouvez régler l\'addition en espèces directement au serveur.'
                    : 'Votre paiement Mobile Money est en cours de traitement. Votre plat vous sera apporté dès validation.'}
                </p>
              </div>
            )}

            {!isOnSite && (
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 text-left text-sm text-slate-700">
                <p className="font-bold text-slate-900 mb-1">🛵 Livraison à distance</p>
                <p className="text-xs text-slate-600">
                  Le restaurant prépare vos plats. Le livreur vous contactera dès la prise en charge.
                </p>
              </div>
            )}

            {paymentMethod === 'online' && result.campay_reference && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-left text-sm text-blue-900 space-y-2">
                <p className="font-semibold flex items-center gap-1.5">
                  <Smartphone size={16} /> Demande Mobile Money envoyée sur votre téléphone
                </p>
                <p className="text-xs text-blue-800">
                  Composez votre code secret Mobile Money (Orange / MTN) sur votre combiné pour valider.
                </p>
                <button
                  onClick={() => navigate(`/payment-status?type=order&order_id=${result.order_id}&method=mtn`)}
                  className="w-full mt-2 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  Vérifier l'état du paiement en direct <ArrowRight size={14} />
                </button>
              </div>
            )}

            <button
              onClick={() => {
                onClose();
                navigate(`/menu/${slug}${isOnSite ? `?t=${tableToken}` : ''}`);
              }}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-full py-3.5 font-semibold text-sm transition-colors"
            >
              Fermer et retourner au menu
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicMenuPage;
