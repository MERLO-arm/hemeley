import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Wallet, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownLeft,
  Plus, Send, RefreshCw, X, Lock, Eye, EyeOff, Smartphone,
  AlertCircle, CheckCircle, Clock, Filter, ChevronDown
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// ============ Helpers ============

const formatXAF = (n) => Number(n || 0).toLocaleString('fr-FR') + ' FCFA';

const TX_TYPE_META = {
  recharge:                { label: 'Recharge',          color: 'text-emerald-600', icon: ArrowDownLeft, sign: '+' },
  order_payment:           { label: 'Paiement commande', color: 'text-rose-600',    icon: ArrowUpRight,  sign: '−' },
  escrow_release_vendor:   { label: 'Versement vendeur', color: 'text-emerald-600', icon: ArrowDownLeft, sign: '+' },
  escrow_release_delivery: { label: 'Course livreur',    color: 'text-emerald-600', icon: ArrowDownLeft, sign: '+' },
  commission:              { label: 'Commission HEMELEY',color: 'text-emerald-600', icon: ArrowDownLeft, sign: '+' },
  refund:                  { label: 'Remboursement',     color: 'text-emerald-600', icon: ArrowDownLeft, sign: '+' },
  withdrawal_hold:         { label: 'Demande retrait',   color: 'text-rose-600',    icon: ArrowUpRight,  sign: '−' },
  withdrawal_payout:       { label: 'Retrait envoyé',    color: 'text-rose-600',    icon: ArrowUpRight,  sign: '−' },
  withdrawal_reject:       { label: 'Retrait remboursé', color: 'text-emerald-600', icon: ArrowDownLeft, sign: '+' },
  subscription_payment:    { label: 'Abonnement',        color: 'text-rose-600',    icon: ArrowUpRight,  sign: '−' },
  adjustment:              { label: 'Ajustement',        color: 'text-amber-600',   icon: RefreshCw,     sign: '±' },
};

const getTxMeta = (type) => TX_TYPE_META[type] || { label: type, color: 'text-gray-600', icon: RefreshCw, sign: '' };

const getAuthHeader = (role) => {
  let token;
  if (role === 'customer')      token = localStorage.getItem('hemeley_customer_token');
  else if (role === 'vendor')   token = localStorage.getItem('vendor_token');
  else if (role === 'delivery') token = localStorage.getItem('delivery_token');
  else if (role === 'admin' || role === 'super_admin') token = localStorage.getItem('admin_token');
  else token = localStorage.getItem('hemeley_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// ============ WalletCard ============

export const WalletCard = ({ role, onOpenRecharge, onOpenWithdraw, refreshKey = 0 }) => {
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showBalance, setShowBalance] = useState(true);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/wallet/me`, { headers: getAuthHeader(role) });
      setWallet(res.data);
    } catch {
      setWallet(null);
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => { fetch(); }, [fetch, refreshKey]);

  // Auto-refresh on real-time wallet notifications
  useEffect(() => {
    const handler = () => fetch();
    window.addEventListener('hemeley:wallet-updated', handler);
    return () => window.removeEventListener('hemeley:wallet-updated', handler);
  }, [fetch]);

  const balance = Number(wallet?.balance || 0);
  const frozen = wallet && wallet.status !== 'active';
  const showSkeleton = loading && !wallet;

  return (
    <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-orange-500 via-orange-600 to-amber-600 p-6 text-white shadow-xl" data-testid="wallet-card">
      {/* Decorative pattern */}
      <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-white/10" />
      <div className="absolute -left-12 -bottom-20 w-44 h-44 rounded-full bg-black/10" />

      <div className="relative flex items-start justify-between mb-6">
        <div className="flex items-center gap-2">
          <Wallet size={22} className="opacity-90" />
          <span className="font-medium tracking-wide">Wallet HEMELEY</span>
          {frozen && (
            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 text-xs">
              <Lock size={12} /> Figé
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button data-testid="wallet-toggle-visibility" onClick={() => setShowBalance(s => !s)} className="p-2 rounded-full hover:bg-white/15 transition">
            {showBalance ? <Eye size={16}/> : <EyeOff size={16}/>}
          </button>
          <button data-testid="wallet-refresh" onClick={fetch} className="p-2 rounded-full hover:bg-white/15 transition">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>
          </button>
        </div>
      </div>

      <div className="relative">
        <p className="text-white/70 text-sm mb-1">Solde disponible</p>
        {showSkeleton ? (
          <div className="h-10 w-48 rounded-lg bg-white/20 animate-pulse" />
        ) : (
          <p data-testid="wallet-balance" className="font-mono text-4xl font-bold tracking-tight">
            {showBalance ? formatXAF(balance) : '••• ••• FCFA'}
          </p>
        )}
        {wallet?.held_balance > 0 && (
          <p className="text-white/70 text-xs mt-2 flex items-center gap-1">
            <Lock size={12} /> {formatXAF(wallet.held_balance)} en escrow
          </p>
        )}
      </div>

      <div className="relative mt-6 flex flex-wrap gap-2">
        {role === 'customer' && (
          <button
            data-testid="wallet-recharge-btn"
            onClick={onOpenRecharge}
            disabled={frozen}
            className="flex items-center gap-2 bg-white text-orange-600 font-semibold px-5 py-2.5 rounded-full shadow hover:bg-amber-50 transition disabled:opacity-50"
          >
            <Plus size={16}/> Recharger
          </button>
        )}
        {(role === 'vendor' || role === 'delivery') && (
          <button
            data-testid="wallet-withdraw-btn"
            onClick={onOpenWithdraw}
            disabled={frozen || balance < 2000}
            className="flex items-center gap-2 bg-white text-orange-600 font-semibold px-5 py-2.5 rounded-full shadow hover:bg-amber-50 transition disabled:opacity-50"
          >
            <Send size={16}/> Retirer
          </button>
        )}
      </div>

      <div className="relative mt-4 text-[11px] text-white/60">
        N° wallet · {wallet?.id?.slice(0, 8) || '—'} · v{wallet?.version ?? 0}
      </div>
    </div>
  );
};

// ============ RechargeModal (customer) ============

export const RechargeModal = ({ open, onClose, onSuccess }) => {
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [operator, setOperator] = useState('mtn');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      const c = JSON.parse(localStorage.getItem('hemeley_customer') || '{}');
      const ph = c.phone || '';
      setPhone(ph.startsWith('237') ? ph : (ph ? `237${ph}` : ''));
    }
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    const a = Number(amount);
    if (!a || a < 25) { toast.error('Montant minimum: 25 FCFA'); return; }
    if (!phone || phone.length < 9) { toast.error('Numéro Mobile Money invalide'); return; }
    setLoading(true);
    try {
      const res = await axios.post(
        `${API}/wallet/recharge`,
        { amount: a, phone },
        { headers: getAuthHeader('customer') }
      );
      toast.success('Confirmez le paiement sur votre téléphone');
      onSuccess?.(res.data);
      onClose();
      // Redirect to status page with the external reference
      if (res.data?.reference) {
        window.location.href = `/payment-status?type=recharge&ref=${encodeURIComponent(res.data.reference)}`;
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Échec de la recharge');
    } finally {
      setLoading(false);
    }
  };

  const presets = [200, 500, 1000, 2000, 5000, 10000];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md shadow-2xl" data-testid="recharge-modal">
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h3 className="font-bold text-lg">Recharger le wallet</h3>
            <p className="text-xs text-gray-500">Mobile Money MTN ou Orange Money</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100" data-testid="recharge-close-btn"><X size={18}/></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Operator selector */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { v: 'mtn',    label: 'MTN MoMo',    bg: 'bg-yellow-400',  fg: 'text-black' },
              { v: 'orange', label: 'Orange Money',bg: 'bg-orange-500',  fg: 'text-white' },
            ].map(op => (
              <button
                key={op.v}
                data-testid={`recharge-op-${op.v}`}
                onClick={() => setOperator(op.v)}
                className={`flex items-center gap-2 p-3 rounded-2xl border-2 transition ${
                  operator === op.v ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`w-9 h-9 ${op.bg} ${op.fg} rounded-lg flex items-center justify-center font-bold text-xs`}>
                  {op.v === 'mtn' ? 'MTN' : 'OM'}
                </div>
                <span className="text-sm font-medium">{op.label}</span>
              </button>
            ))}
          </div>

          {/* Amount */}
          <div>
            <label className="text-sm font-medium mb-1 block">Montant (FCFA)</label>
            <input
              data-testid="recharge-amount-input"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-orange-500 outline-none"
              placeholder="Ex: 200"
              min={25}
            />
            <div className="flex flex-wrap gap-2 mt-2">
              {presets.map(p => (
                <button
                  key={p}
                  data-testid={`recharge-preset-${p}`}
                  onClick={() => setAmount(String(p))}
                  className="px-3 py-1.5 text-xs rounded-full bg-gray-100 hover:bg-orange-100 hover:text-orange-700 transition"
                >
                  {formatXAF(p)}
                </button>
              ))}
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="text-sm font-medium mb-1 block">Numéro Mobile Money</label>
            <div className="flex items-center gap-2 border-2 border-gray-200 rounded-xl px-3 py-2 focus-within:border-orange-500">
              <Smartphone size={18} className="text-gray-400" />
              <input
                data-testid="recharge-phone-input"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="flex-1 outline-none py-1"
                placeholder="237 6XX XXX XXX"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Format: 2376XXXXXXXX</p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex gap-2">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            Une fois validé, vous recevrez une demande de confirmation sur votre téléphone. Le solde est crédité après confirmation.
          </div>

          <button
            data-testid="recharge-submit-btn"
            onClick={submit}
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-full py-3 shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <><RefreshCw className="animate-spin" size={16}/> Traitement…</> : <>Recharger {amount ? formatXAF(amount) : ''}</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============ WithdrawalModal (vendor / delivery) ============

export const WithdrawalModal = ({ open, onClose, onSuccess, balance = 0, role = 'vendor' }) => {
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const submit = async () => {
    const a = Number(amount);
    if (!a || a < 2000) { toast.error('Montant minimum: 2000 FCFA'); return; }
    if (a > balance)    { toast.error('Solde insuffisant'); return; }
    if (!phone || phone.length < 9) { toast.error('Numéro Mobile Money invalide'); return; }
    setLoading(true);
    try {
      await axios.post(
        `${API}/wallet/withdrawals`,
        { amount: a, phone },
        { headers: getAuthHeader(role) }
      );
      toast.success('Demande envoyée. En attente de validation par le Super Admin.');
      onSuccess?.();
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Échec de la demande');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md shadow-2xl" data-testid="withdrawal-modal">
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h3 className="font-bold text-lg">Demande de retrait</h3>
            <p className="text-xs text-gray-500">Validation manuelle par Super Admin</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100" data-testid="withdrawal-close-btn"><X size={18}/></button>
        </div>

        <div className="p-5 space-y-5">
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm">
            <p className="text-gray-700">Solde disponible</p>
            <p className="text-2xl font-bold text-orange-600">{formatXAF(balance)}</p>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Montant (min. 2000 FCFA)</label>
            <input
              data-testid="withdrawal-amount-input"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-orange-500 outline-none"
              placeholder="Ex: 10000"
              min={2000}
              max={balance}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Numéro Mobile Money</label>
            <div className="flex items-center gap-2 border-2 border-gray-200 rounded-xl px-3 py-2 focus-within:border-orange-500">
              <Smartphone size={18} className="text-gray-400" />
              <input
                data-testid="withdrawal-phone-input"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="flex-1 outline-none py-1"
                placeholder="2376XXXXXXXX"
              />
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex gap-2">
            <Clock size={16} className="flex-shrink-0 mt-0.5" />
            Le montant est immédiatement débité de votre wallet. Il sera versé après validation par le Super Admin (généralement sous 24h).
          </div>

          <button
            data-testid="withdrawal-submit-btn"
            onClick={submit}
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-full py-3 shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <><RefreshCw className="animate-spin" size={16}/> Envoi…</> : <>Demander le retrait</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============ TransactionsList ============

export const TransactionsList = ({ role, refreshKey = 0, limit = 20, showFilter = true }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');

  const reload = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/wallet/transactions?limit=${limit}`, { headers: getAuthHeader(role) });
      setItems(res.data || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${API}/wallet/transactions?limit=${limit}`, { headers: getAuthHeader(role) });
        if (active) setItems(res.data || []);
      } catch {
        if (active) setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [role, limit, refreshKey]);

  // Auto-refresh on real-time wallet notifications
  useEffect(() => {
    const handler = () => reload();
    window.addEventListener('hemeley:wallet-updated', handler);
    return () => window.removeEventListener('hemeley:wallet-updated', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, limit]);

  const filtered = filterType === 'all' ? items : items.filter(t => t.type === filterType);

  if (loading) {
    return <div className="flex items-center gap-2 text-gray-500 p-4"><RefreshCw size={16} className="animate-spin"/> Chargement…</div>;
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" data-testid="transactions-list">
      {showFilter && (
        <div className="p-4 border-b flex items-center gap-2 overflow-x-auto">
          {['all','recharge','order_payment','escrow_release_vendor','withdrawal_hold','refund'].map(k => (
            <button
              key={k}
              data-testid={`tx-filter-${k}`}
              onClick={() => setFilterType(k)}
              className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition ${
                filterType === k ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {k === 'all' ? 'Tout' : (TX_TYPE_META[k]?.label || k)}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="p-10 text-center text-gray-500">
          <Wallet size={32} className="mx-auto mb-2 text-gray-300" />
          <p>Aucune transaction pour le moment</p>
        </div>
      ) : (
        <ul className="divide-y">
          {filtered.map(tx => {
            const meta = getTxMeta(tx.type);
            const Icon = meta.icon;
            return (
              <li key={tx.id} className="flex items-center gap-3 p-4 hover:bg-gray-50 transition" data-testid={`tx-item-${tx.reference}`}>
                <div className={`w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center ${meta.color}`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{meta.label}</p>
                  <p className="text-xs text-gray-500 truncate">{tx.reference}</p>
                  {tx.description && <p className="text-xs text-gray-500 truncate">{tx.description}</p>}
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${meta.color}`}>{meta.sign}{formatXAF(tx.amount)}</p>
                  <p className="text-[10px] text-gray-400">{new Date(tx.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

// ============ WithdrawalsList (own — vendor/delivery) ============

export const WithdrawalsList = ({ role, refreshKey = 0 }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await axios.get(`${API}/wallet/withdrawals/me`, { headers: getAuthHeader(role) });
        if (active) setItems(res.data || []);
      } catch {
        if (active) setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    setLoading(true);
    load();
    const handler = () => load();
    window.addEventListener('hemeley:wallet-updated', handler);
    return () => {
      active = false;
      window.removeEventListener('hemeley:wallet-updated', handler);
    };
  }, [role, refreshKey]);

  if (loading) return <div className="text-gray-500 p-4">Chargement…</div>;

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-500">
        Aucune demande de retrait pour le moment.
      </div>
    );
  }

  const STATUS = {
    pending:  { label: 'En attente',  bg: 'bg-amber-100',   text: 'text-amber-700' },
    approved: { label: 'Approuvée',   bg: 'bg-blue-100',    text: 'text-blue-700' },
    paid:     { label: 'Payée',       bg: 'bg-emerald-100', text: 'text-emerald-700' },
    rejected: { label: 'Rejetée',     bg: 'bg-rose-100',    text: 'text-rose-700' },
    failed:   { label: 'Échec',       bg: 'bg-rose-100',    text: 'text-rose-700' },
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" data-testid="withdrawals-list">
      <ul className="divide-y">
        {items.map(w => {
          const st = STATUS[w.status] || { label: w.status, bg: 'bg-gray-100', text: 'text-gray-700' };
          return (
            <li key={w.id} className="p-4 flex items-center gap-3" data-testid={`wd-item-${w.id}`}>
              <div className="flex-1 min-w-0">
                <p className="font-mono text-xs text-gray-500">{w.reference}</p>
                <p className="font-bold">{formatXAF(w.amount)} → {w.phone}</p>
                {w.rejection_reason && (
                  <p className="text-xs text-rose-600 mt-1">Motif: {w.rejection_reason}</p>
                )}
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${st.bg} ${st.text}`}>{st.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
