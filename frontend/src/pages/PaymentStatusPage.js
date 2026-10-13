import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  CheckCircle, XCircle, RefreshCw, Smartphone, ShieldCheck, Clock,
  Phone, Home, Receipt, AlertTriangle
} from 'lucide-react';
import HemeleyLogo from '../HemeleyLogo';
import { API } from '../MapUtils';
import { useCart } from '../CartContext';

/**
 * Secure payment status page — polls the backend every 3s until the CAMPAY
 * transaction is settled (SUCCESSFUL or FAILED/CANCELLED), then redirects.
 *
 * Polling: 3s interval, max 60 attempts (3 minutes total).
 * clearCart() is called EXCLUSIVEMENT quand status === "SUCCESSFUL".
 *
 * Query params:
 *   ?type=order&order_id=...&method=orange|mtn
 *   ?type=recharge&ref=TXN-HEMELEY-...
 */
const PaymentStatusPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { clearCart } = useCart();
  const type = params.get('type');                          // order | recharge
  const orderId = params.get('order_id');
  const ref = params.get('ref');
  const method = params.get('method') || 'mtn';

  const [data, setData] = useState(null);
  const [attempts, setAttempts] = useState(0);
  const [final, setFinal] = useState(null);                 // 'success' | 'failed' | 'timeout'
  const [error, setError] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const pollTimer = useRef(null);
  const cartClearedRef = useRef(false);
  const maxAttempts = 60;                                   // 3s × 60 = 3 minutes

  const customerToken = typeof window !== 'undefined' ? localStorage.getItem('hemeley_customer_token') : null;

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        let resp;
        if (type === 'order' && orderId) {
          resp = await axios.get(`${API}/orders/${orderId}/payment-status`);
        } else if (type === 'recharge' && ref) {
          resp = await axios.get(`${API}/wallet/recharge/${encodeURIComponent(ref)}`, {
            headers: customerToken ? { Authorization: `Bearer ${customerToken}` } : {},
          });
        } else {
          setError('Paramètres manquants');
          return;
        }

        if (cancelled) return;
        setData(resp.data);

        // Statut strict "SUCCESSFUL" pour valider le paiement
        const campayStatusUpper = (resp.data.campay_status || '').toUpperCase();
        const isSuccess =
          (type === 'order' &&
            (resp.data.payment_status === 'success' || campayStatusUpper === 'SUCCESSFUL')) ||
          (type === 'recharge' && resp.data.status === 'successful');

        const isFailed =
          (type === 'order' &&
            (resp.data.payment_status === 'failed' ||
             ['FAILED', 'CANCELED', 'CANCELLED'].includes(campayStatusUpper))) ||
          (type === 'recharge' && resp.data.status === 'failed');

        if (isSuccess) {
          setFinal('success');
          toast.success('Paiement confirmé ✅');
          clearInterval(pollTimer.current);
          // Vider le panier UNIQUEMENT sur succès confirmé
          if (type === 'order' && !cartClearedRef.current) {
            cartClearedRef.current = true;
            clearCart();
          }
          // Auto-redirect après une courte pause
          setTimeout(() => {
            if (type === 'order') navigate(`/payment-success?order_id=${orderId}`);
            else                  navigate('/client/dashboard?tab=wallet');
          }, 2500);
        } else if (isFailed) {
          setFinal('failed');
          clearInterval(pollTimer.current);
          // Panier conservé : l'utilisateur peut cliquer "Réessayer"
        }
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.detail || 'Erreur de vérification');
      }
    };

    // First check immediately, then poll every 3s
    tick();
    pollTimer.current = setInterval(() => {
      setAttempts((n) => {
        const next = n + 1;
        if (next >= maxAttempts) {
          clearInterval(pollTimer.current);
          setFinal('timeout');
        } else {
          tick();
        }
        return next;
      });
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(pollTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, orderId, ref]);

  const opLabel = method === 'orange' ? 'Orange Money' : 'MTN Mobile Money';

  const handleSimulateSuccess = async () => {
    if (!orderId) return;
    try {
      setSimulating(true);
      await axios.post(`${API}/orders/${orderId}/simulate-payment-success`);
      toast.success('Paiement simulé avec succès ! Mise à jour en cours...');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors de la simulation');
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col" data-testid="payment-status-page">
      <header className="bg-white border-b border-stone-200 px-6 h-16 flex items-center">
        <Link to="/"><HemeleyLogo size={32} /></Link>
        <div className="ml-auto flex items-center gap-2 text-emerald-600 text-sm font-medium">
          <ShieldCheck size={16} /> Paiement sécurisé
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="bg-white w-full max-w-lg rounded-3xl shadow-xl overflow-hidden">

          {/* HEADER STATE */}
          <div className={`px-6 py-8 text-center text-white ${
            final === 'success' ? 'bg-gradient-to-br from-emerald-500 to-teal-600' :
            final === 'failed'  ? 'bg-gradient-to-br from-rose-500 to-pink-600'    :
            final === 'timeout' ? 'bg-gradient-to-br from-amber-500 to-orange-600' :
                                  'bg-gradient-to-br from-orange-500 to-amber-500'
          }`}>
            <div className="w-20 h-20 mx-auto rounded-full bg-white/20 flex items-center justify-center mb-4">
              {final === 'success' ? (
                <CheckCircle size={42} data-testid="status-success-icon" />
              ) : final === 'failed' ? (
                <XCircle size={42} data-testid="status-failed-icon" />
              ) : final === 'timeout' ? (
                <Clock size={42} data-testid="status-timeout-icon" />
              ) : (
                <RefreshCw size={42} className="animate-spin" data-testid="status-pending-icon" />
              )}
            </div>
            <h2 className="text-2xl font-bold" data-testid="status-title">
              {final === 'success' ? 'Paiement confirmé !' :
               final === 'failed'  ? 'Paiement échoué'      :
               final === 'timeout' ? 'Délai dépassé'        :
                                     'Confirmation en cours...'}
            </h2>
            <p className="text-white/90 mt-2 text-sm">
              {final === 'success' ? 'Votre commande est en préparation' :
               final === 'failed'  ? 'La transaction n\'a pas pu être complétée' :
               final === 'timeout' ? 'Nous n\'avons pas reçu de confirmation' :
                                     `Validez la demande de paiement reçue sur votre téléphone (${opLabel})`}
            </p>
          </div>

          {/* BODY */}
          <div className="p-6 space-y-5">
            {/* Pending: instructions */}
            {!final && (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3">
                  <Smartphone className="text-blue-500 flex-shrink-0" size={20} />
                  <div className="text-sm text-blue-900">
                    <p className="font-semibold mb-1">Étapes à suivre :</p>
                    <ol className="list-decimal list-inside space-y-0.5">
                      <li>Une demande {opLabel} arrive sur votre téléphone</li>
                      <li>Composez votre code secret pour confirmer</li>
                      <li>Cette page se met à jour automatiquement</li>
                    </ol>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                  <RefreshCw className="animate-spin" size={14} />
                  Vérification {attempts}/{maxAttempts}...
                </div>
              </>
            )}

            {/* Summary */}
            {data && (
              <div className="bg-stone-50 rounded-2xl p-4 space-y-2 text-sm" data-testid="status-summary">
                <Row label="Montant" value={`${Number(data.total ?? data.amount ?? 0).toLocaleString('fr-FR')} FCFA`} bold />
                {data.order_number && <Row label="Commande" value={data.order_number} />}
                {data.reference && <Row label="Référence" value={data.reference} mono />}
                {data.campay_reference && <Row label="Réf. CAMPAY" value={data.campay_reference} mono />}
                <Row label="Méthode" value={opLabel} />
                <Row label="Statut" value={data.payment_status || data.status || data.campay_status || 'en cours'} />
              </div>
            )}

            {/* Failure details */}
            {final === 'failed' && data?.campay_failure_reason && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex gap-3 text-sm text-rose-800" data-testid="failure-reason">
                <AlertTriangle size={18} className="flex-shrink-0" />
                <span>{data.campay_failure_reason || data.failure_reason}</span>
              </div>
            )}

            {error && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-sm text-rose-700">{error}</div>
            )}

            {/* Test/Demo Simulation Button */}
            {type === 'order' && orderId && !final && (
              <div className="p-3 bg-purple-50/80 border border-dashed border-purple-200 rounded-2xl text-center">
                <p className="text-xs text-purple-700 mb-2 font-medium">Mode Test CamPay Sandbox</p>
                <button
                  type="button"
                  onClick={handleSimulateSuccess}
                  disabled={simulating}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition-all inline-flex items-center gap-2"
                >
                  {simulating ? <RefreshCw size={12} className="animate-spin" /> : '🧪'}
                  <span>Simuler validation paiement (Mode Test)</span>
                </button>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {final === 'success' && (
                <button
                  onClick={() => navigate(type === 'order' ? `/payment-success?order_id=${orderId}` : '/client/dashboard?tab=wallet')}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-full py-3 inline-flex items-center justify-center gap-2"
                  data-testid="status-continue-btn"
                >
                  Continuer <Receipt size={16} />
                </button>
              )}
              {(final === 'failed' || final === 'timeout') && (
                <>
                  <button
                    onClick={() => navigate(type === 'order' ? '/checkout' : '/client/dashboard?tab=wallet')}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-full py-3 inline-flex items-center justify-center gap-2"
                    data-testid="status-retry-btn"
                  >
                    <RefreshCw size={16} /> Réessayer
                  </button>
                  <button
                    onClick={() => navigate('/')}
                    className="flex-1 bg-stone-100 hover:bg-stone-200 text-slate-800 font-semibold rounded-full py-3 inline-flex items-center justify-center gap-2"
                  >
                    <Home size={16} /> Accueil
                  </button>
                </>
              )}
              {!final && (
                <>
                  <a
                    href="tel:+237"
                    className="flex-1 bg-stone-100 hover:bg-stone-200 text-slate-800 font-semibold rounded-full py-3 inline-flex items-center justify-center gap-2 text-sm"
                  >
                    <Phone size={16} /> Aide
                  </a>
                  <button
                    onClick={() => window.location.reload()}
                    className="flex-1 bg-stone-100 hover:bg-stone-200 text-slate-800 font-semibold rounded-full py-3 inline-flex items-center justify-center gap-2 text-sm"
                  >
                    <RefreshCw size={16} /> Actualiser
                  </button>
                </>
              )}
            </div>

            {/* Trust badges */}
            <div className="pt-3 border-t border-stone-100 flex items-center justify-center gap-4 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1"><ShieldCheck size={14}/> Connexion chiffrée</span>
              <span>·</span>
              <span>Paiement traité par CAMPAY</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const Row = ({ label, value, bold = false, mono = false }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-slate-500">{label}</span>
    <span className={`text-slate-900 ${bold ? 'font-bold' : ''} ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
  </div>
);

export default PaymentStatusPage;
