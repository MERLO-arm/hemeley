import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Plus, Minus, ShoppingBag, X, CheckCircle2, RefreshCw, Smartphone, Wallet
} from 'lucide-react';
import CoverCarousel from '../components/CoverCarousel';
import CategorizedMenuList from '../components/CategorizedMenuList';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

/**
 * /menu/:slug — Page publique branded d'un restaurant (scan QR code).
 * Aucune navigation HEMELEY visible, juste le menu du restaurant + paiement.
 */
const PublicMenuPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cart, setCart] = useState({}); // { menu_id: quantity }
  const [showCheckout, setShowCheckout] = useState(false);

  useEffect(() => {
    axios.get(`${API}/public/menu/${encodeURIComponent(slug)}`)
      .then((res) => setData(res.data))
      .catch((e) => setError(e?.response?.data?.detail || 'Restaurant introuvable'))
      .finally(() => setLoading(false));
  }, [slug]);

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
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <RefreshCw size={42} className="animate-spin text-orange-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4">
        <div className="bg-white max-w-md w-full rounded-3xl shadow-xl p-8 text-center">
          <div className="text-5xl mb-3">🍽️</div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Restaurant introuvable</h1>
          <p className="text-slate-500 mb-4">Le lien que vous avez scanné n'est plus actif.</p>
          <button onClick={() => navigate('/')} className="bg-orange-500 text-white rounded-full px-6 py-3 font-semibold">Accueil HEMELEY</button>
        </div>
      </div>
    );
  }

  const { vendor, menus } = data;
  const brand = vendor.brand_color || '#FF6B00';

  return (
    <div className="min-h-screen bg-stone-50" data-testid="public-menu-page">
      {/* Cover carousel (up to 3 photos) */}
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
            <p className="text-xs text-slate-400 mt-1">📍 {vendor.zone}</p>
          </div>
        </div>
      </div>

      {/* Menu list */}
      <div className="max-w-3xl mx-auto px-4 py-8 pb-32">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Notre menu</h2>
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
                          className="text-white rounded-full px-4 py-1.5 text-sm font-semibold inline-flex items-center gap-1 hover:opacity-90"
                          style={{ backgroundColor: brand }}
                        >
                          <Plus size={14} /> Commander
                        </button>
                      ) : (
                        <div className="inline-flex items-center gap-2">
                          <button onClick={() => removeItem(m.id)} className="w-7 h-7 rounded-full bg-stone-200 hover:bg-stone-300 flex items-center justify-center"><Minus size={14} /></button>
                          <span className="font-semibold w-6 text-center">{qty}</span>
                          <button onClick={() => addItem(m.id)} className="w-7 h-7 rounded-full text-white flex items-center justify-center" style={{ backgroundColor: brand }}><Plus size={14} /></button>
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
              <p className="text-xs text-slate-500">{itemCount} article{itemCount > 1 ? 's' : ''}</p>
              <p className="text-xl font-bold" style={{ color: brand }}>{total.toLocaleString()} FCFA</p>
            </div>
            <button
              onClick={() => setShowCheckout(true)}
              data-testid="public-checkout-btn"
              className="text-white font-bold rounded-full px-6 py-3 inline-flex items-center gap-2 hover:opacity-90"
              style={{ backgroundColor: brand }}
            >
              <ShoppingBag size={18} /> Commander
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
          onClose={() => setShowCheckout(false)}
        />
      )}

      {/* Footer */}
      <div className="text-center py-6 text-xs text-slate-400">
        <Link to="/" className="hover:underline">propulsé par HEMELEY</Link>
      </div>
    </div>
  );
};


const PublicCheckoutModal = ({ slug, brand, cartItems, total, onClose }) => {
  const navigate = useNavigate();
  const [step, setStep] = useState('info'); // info | done
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [result, setResult] = useState(null);

  const submit = async () => {
    if (!name.trim() || !phone.trim()) {
      toast.error('Nom et téléphone requis');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        customer_note: note.trim() || null,
        items: cartItems.map((it) => ({ menu_id: it.id, quantity: it.qty })),
        payment_method: paymentMethod,
      };
      const res = await axios.post(`${API}/public/order/${encodeURIComponent(slug)}`, payload);
      setResult(res.data);
      setStep('done');
      if (paymentMethod === 'online' && res.data.campay_reference) {
        toast.success('Demande Mobile Money envoyée — composez votre code');
      } else {
        toast.success('Commande enregistrée ! Paiement à la livraison.');
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Erreur lors de la commande');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4" data-testid="public-checkout-modal">
      <div className="bg-white w-full max-w-md rounded-t-3xl md:rounded-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-stone-200 px-5 py-4 flex items-center justify-between">
          <h2 className="font-bold text-lg">{step === 'info' ? 'Votre commande' : 'Confirmation'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full"><X size={20} /></button>
        </div>

        {step === 'info' && (
          <div className="p-5 space-y-4">
            {/* Cart summary */}
            <div className="bg-stone-50 rounded-2xl p-4 space-y-2">
              {cartItems.map((it) => (
                <div key={it.id} className="flex justify-between text-sm">
                  <span className="text-slate-700">{it.name} × {it.qty}</span>
                  <span className="font-medium">{(it.price * it.qty).toLocaleString()} FCFA</span>
                </div>
              ))}
              <div className="border-t border-stone-200 pt-2 flex justify-between font-bold">
                <span>Total</span>
                <span style={{ color: brand }}>{total.toLocaleString()} FCFA</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Nom complet</label>
              <input data-testid="public-name" type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jean Doe" className="w-full border-2 border-stone-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Téléphone</label>
              <input data-testid="public-phone" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="237 6XX XXX XXX" className="w-full border-2 border-stone-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Note (optionnel)</label>
              <textarea data-testid="public-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Préférences, allergies..." className="w-full border-2 border-stone-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500 resize-none" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Mode de paiement</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  data-testid="payment-cash"
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-4 rounded-xl border-2 text-sm font-semibold transition-all ${paymentMethod === 'cash' ? 'border-orange-500 bg-orange-50' : 'border-stone-200'}`}
                >
                  <Wallet size={20} className="mx-auto mb-1" />
                  Espèces<br /><span className="text-xs text-slate-500 font-normal">à la livraison</span>
                </button>
                <button
                  type="button"
                  data-testid="payment-online"
                  onClick={() => setPaymentMethod('online')}
                  className={`p-4 rounded-xl border-2 text-sm font-semibold transition-all ${paymentMethod === 'online' ? 'border-orange-500 bg-orange-50' : 'border-stone-200'}`}
                >
                  <Smartphone size={20} className="mx-auto mb-1" />
                  Mobile Money<br /><span className="text-xs text-slate-500 font-normal">Orange / MTN</span>
                </button>
              </div>
            </div>

            <button
              onClick={submit}
              disabled={loading}
              data-testid="public-submit-order"
              className="w-full text-white font-bold rounded-full py-3.5 hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: brand }}
            >
              {loading ? 'Envoi...' : `Confirmer la commande (${total.toLocaleString()} FCFA)`}
            </button>
          </div>
        )}

        {step === 'done' && result && (
          <div className="p-5 text-center space-y-4" data-testid="public-order-confirmed">
            <div className="w-20 h-20 mx-auto bg-emerald-100 rounded-full flex items-center justify-center">
              <CheckCircle2 size={42} className="text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Commande confirmée !</h3>
            <p className="text-slate-600 text-sm">
              N° de commande : <span className="font-mono font-semibold">{result.order_number}</span>
            </p>
            {paymentMethod === 'online' && result.campay_reference && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-left text-sm text-blue-900">
                <p className="font-semibold mb-1">📱 Une demande Mobile Money vient de partir vers votre téléphone.</p>
                <p>Composez votre code secret pour valider le paiement.</p>
              </div>
            )}
            {paymentMethod === 'cash' && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left text-sm text-amber-900">
                <p className="font-semibold mb-1">💵 Paiement en espèces</p>
                <p>Merci de préparer la somme exacte : <strong>{total.toLocaleString()} FCFA</strong></p>
              </div>
            )}
            <button
              onClick={() => { onClose(); navigate(`/menu/${slug}`); }}
              className="w-full bg-stone-100 hover:bg-stone-200 rounded-full py-3 font-semibold"
            >
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicMenuPage;
