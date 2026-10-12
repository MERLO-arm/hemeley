import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Wallet, TrendingUp, Lock, Unlock, RefreshCw, Check, X,
  Filter, Eye, AlertTriangle, Search, Download, ChevronRight, Clock,
  ShieldAlert, Coins, ArrowUpRight, ArrowDownLeft
} from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const formatXAF = (n) => Number(n || 0).toLocaleString('fr-FR') + ' FCFA';

const adminHeader = () => {
  const token = localStorage.getItem('admin_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// ============ Stat tile ============

const StatTile = ({ icon: Icon, label, value, sub, color = 'orange', testId }) => {
  const palette = {
    orange:   'from-orange-500 to-amber-500',
    emerald:  'from-emerald-500 to-teal-500',
    indigo:   'from-indigo-500 to-blue-500',
    rose:     'from-rose-500 to-pink-500',
    slate:    'from-slate-700 to-slate-900',
  }[color] || 'from-orange-500 to-amber-500';
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${palette} text-white p-5 shadow-lg`} data-testid={testId}>
      <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10" />
      <div className="relative flex items-start justify-between mb-3">
        <Icon size={22} className="opacity-90" />
      </div>
      <p className="relative text-xs uppercase tracking-wider opacity-80">{label}</p>
      <p className="relative font-mono text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="relative text-xs opacity-80 mt-1">{sub}</p>}
    </div>
  );
};

// ============ Main Panel ============

const AdminFinancePanel = ({ darkMode = false }) => {
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [wallets, setWallets] = useState([]);
  const [walletsRoleFilter, setWalletsRoleFilter] = useState('');
  const [withdrawals, setWithdrawals] = useState([]);
  const [wdStatusFilter, setWdStatusFilter] = useState('pending');
  const [transactions, setTransactions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [rejectModal, setRejectModal] = useState(null); // {wd}
  const [rejectReason, setRejectReason] = useState('');

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  // Fetch overview
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${API}/admin/finance/overview`, { headers: adminHeader() });
        if (alive) setOverview(res.data);
      } catch (e) {
        if (alive) toast.error(e?.response?.data?.detail || 'Erreur tableau de bord');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [refreshKey]);

  // Fetch wallets
  useEffect(() => {
    if (tab !== 'wallets') return;
    let alive = true;
    (async () => {
      const url = `${API}/admin/wallets${walletsRoleFilter ? `?role=${walletsRoleFilter}` : ''}`;
      try {
        const res = await axios.get(url, { headers: adminHeader() });
        if (alive) setWallets(res.data || []);
      } catch (e) {
        if (alive) toast.error('Erreur chargement wallets');
      }
    })();
    return () => { alive = false; };
  }, [tab, walletsRoleFilter, refreshKey]);

  // Fetch withdrawals
  useEffect(() => {
    if (tab !== 'withdrawals') return;
    let alive = true;
    (async () => {
      const url = `${API}/admin/withdrawals${wdStatusFilter ? `?status=${wdStatusFilter}` : ''}`;
      try {
        const res = await axios.get(url, { headers: adminHeader() });
        if (alive) setWithdrawals(res.data || []);
      } catch {
        if (alive) setWithdrawals([]);
      }
    })();
    return () => { alive = false; };
  }, [tab, wdStatusFilter, refreshKey]);

  // Fetch transactions
  useEffect(() => {
    if (tab !== 'transactions') return;
    let alive = true;
    (async () => {
      try {
        const res = await axios.get(`${API}/admin/transactions?limit=200`, { headers: adminHeader() });
        if (alive) setTransactions(res.data || []);
      } catch {
        if (alive) setTransactions([]);
      }
    })();
    return () => { alive = false; };
  }, [tab, refreshKey]);

  // Fetch audit logs
  useEffect(() => {
    if (tab !== 'audit') return;
    let alive = true;
    (async () => {
      try {
        const res = await axios.get(`${API}/admin/audit-logs?limit=200`, { headers: adminHeader() });
        if (alive) setAuditLogs(res.data || []);
      } catch {
        if (alive) setAuditLogs([]);
      }
    })();
    return () => { alive = false; };
  }, [tab, refreshKey]);

  const approveWithdrawal = async (wd) => {
    if (!window.confirm(`Approuver le retrait de ${formatXAF(wd.amount)} → ${wd.phone} ?`)) return;
    try {
      await axios.post(`${API}/admin/withdrawals/${wd.id}/approve`, {}, { headers: adminHeader() });
      toast.success('Retrait approuvé. Versement déclenché.');
      refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Erreur');
    }
  };

  const rejectWithdrawal = async () => {
    if (!rejectReason.trim()) { toast.error('Motif requis'); return; }
    try {
      await axios.post(
        `${API}/admin/withdrawals/${rejectModal.id}/reject`,
        { reason: rejectReason },
        { headers: adminHeader() },
      );
      toast.success('Retrait rejeté. Solde remboursé au demandeur.');
      setRejectModal(null);
      setRejectReason('');
      refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Erreur');
    }
  };

  const toggleFreeze = async (w) => {
    const action = w.status === 'active' ? 'freeze' : 'unfreeze';
    if (!window.confirm(action === 'freeze' ? 'Geler ce wallet ?' : 'Dégeler ce wallet ?')) return;
    try {
      await axios.put(`${API}/admin/wallets/${w.id}/${action}`, {}, { headers: adminHeader() });
      toast.success(action === 'freeze' ? 'Wallet figé' : 'Wallet réactivé');
      refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Erreur');
    }
  };

  const tabs = [
    { id: 'overview',     label: 'Vue d\'ensemble' },
    { id: 'withdrawals',  label: 'Retraits' },
    { id: 'wallets',      label: 'Wallets' },
    { id: 'transactions', label: 'Transactions' },
    { id: 'audit',        label: 'Audit' },
  ];

  return (
    <div className="space-y-6" data-testid="admin-finance-panel">
      {/* Tabs */}
      <div className="flex items-center gap-2 border-b overflow-x-auto pb-1">
        {tabs.map(t => (
          <button
            key={t.id}
            data-testid={`finance-tab-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition ${
              tab === t.id ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto">
          <button onClick={refresh} className="p-2 rounded-full hover:bg-gray-100" data-testid="finance-refresh-btn">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>
          </button>
        </div>
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile
              testId="stat-escrow"
              icon={Lock}
              label="Escrow (en attente)"
              value={formatXAF(overview?.escrow_balance)}
              sub={`Bloqué: ${formatXAF(overview?.escrow_held)}`}
              color="indigo"
            />
            <StatTile
              testId="stat-commissions"
              icon={Coins}
              label="Commissions HEMELEY"
              value={formatXAF(overview?.commissions_balance)}
              sub="Revenus de la plateforme"
              color="emerald"
            />
            <StatTile
              testId="stat-recharges"
              icon={ArrowDownLeft}
              label="Recharges totales"
              value={formatXAF(overview?.total_recharges)}
              sub="Cumul Mobile Money"
              color="orange"
            />
            <StatTile
              testId="stat-pending-wd"
              icon={ShieldAlert}
              label="Retraits en attente"
              value={overview?.pending_withdrawals_count ?? 0}
              sub={formatXAF(overview?.pending_withdrawals_amount)}
              color="rose"
            />
          </div>

          {/* Roles breakdown */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-bold mb-4">Soldes par rôle</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(overview?.by_role || {}).map(([role, info]) => (
                <div key={role} className="rounded-xl bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-wider text-gray-500">{role}</p>
                  <p className="font-mono text-lg font-bold">{formatXAF(info.total)}</p>
                  <p className="text-xs text-gray-500">{info.count} wallet(s)</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Withdrawals */}
      {tab === 'withdrawals' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 overflow-x-auto">
            {['pending', 'approved', 'paid', 'rejected', 'failed', ''].map(s => (
              <button
                key={s || 'all'}
                data-testid={`wd-filter-${s || 'all'}`}
                onClick={() => setWdStatusFilter(s)}
                className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition ${
                  wdStatusFilter === s ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {s ? s : 'Tous'}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {withdrawals.length === 0 ? (
              <div className="p-10 text-center text-gray-500">Aucun retrait</div>
            ) : (
              <ul className="divide-y">
                {withdrawals.map(wd => (
                  <li key={wd.id} className="p-4 flex flex-wrap items-center gap-4" data-testid={`wd-row-${wd.id}`}>
                    <div className="flex-1 min-w-[220px]">
                      <p className="font-mono text-xs text-gray-500">{wd.reference}</p>
                      <p className="font-bold">{formatXAF(wd.amount)}</p>
                      <p className="text-sm text-gray-600">{wd.user_name || wd.user_id?.slice(0,8)} · {wd.role}</p>
                      <p className="text-sm text-gray-500">→ {wd.phone}</p>
                      {wd.rejection_reason && <p className="text-xs text-rose-600 mt-1">Motif: {wd.rejection_reason}</p>}
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{wd.status}</span>
                    {wd.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        <button
                          data-testid={`wd-approve-${wd.id}`}
                          onClick={() => approveWithdrawal(wd)}
                          className="px-3 py-1.5 rounded-full bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 inline-flex items-center gap-1"
                        >
                          <Check size={14}/> Approuver
                        </button>
                        <button
                          data-testid={`wd-reject-${wd.id}`}
                          onClick={() => setRejectModal(wd)}
                          className="px-3 py-1.5 rounded-full bg-rose-500 text-white text-sm font-medium hover:bg-rose-600 inline-flex items-center gap-1"
                        >
                          <X size={14}/> Rejeter
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Wallets */}
      {tab === 'wallets' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 overflow-x-auto">
            {[
              ['', 'Tous'],
              ['customer', 'Clients'],
              ['vendor', 'Vendeurs'],
              ['delivery', 'Livreurs'],
              ['admin', 'Admins'],
              ['admin_escrow', 'Escrow'],
              ['admin_commissions', 'Commissions'],
            ].map(([k, label]) => (
              <button
                key={k || 'all'}
                data-testid={`wallets-filter-${k || 'all'}`}
                onClick={() => setWalletsRoleFilter(k)}
                className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition ${
                  walletsRoleFilter === k ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {wallets.length === 0 ? (
              <div className="p-10 text-center text-gray-500">Aucun wallet</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left p-3">Utilisateur</th>
                    <th className="text-left p-3">Rôle</th>
                    <th className="text-right p-3">Solde</th>
                    <th className="text-right p-3">Bloqué</th>
                    <th className="text-center p-3">Statut</th>
                    <th className="text-center p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {wallets.map(w => (
                    <tr key={w.id} className="border-t hover:bg-gray-50">
                      <td className="p-3 font-mono text-xs truncate">{w.user_id}</td>
                      <td className="p-3 text-xs">{w.role}</td>
                      <td className="p-3 text-right font-mono">{formatXAF(w.balance)}</td>
                      <td className="p-3 text-right font-mono text-gray-500">{formatXAF(w.held_balance)}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${w.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {w.status}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {!w.user_id?.startsWith('SYSTEM') && (
                          <button
                            data-testid={`wallet-freeze-${w.id}`}
                            onClick={() => toggleFreeze(w)}
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              w.status === 'active'
                                ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                                : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            }`}
                          >
                            {w.status === 'active' ? 'Geler' : 'Dégeler'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Transactions */}
      {tab === 'transactions' && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {transactions.length === 0 ? (
            <div className="p-10 text-center text-gray-500">Aucune transaction</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left p-3">Référence</th>
                  <th className="text-left p-3">Type</th>
                  <th className="text-left p-3">De → Vers</th>
                  <th className="text-right p-3">Montant</th>
                  <th className="text-left p-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(t => (
                  <tr key={t.id} className="border-t" data-testid={`tx-row-${t.reference}`}>
                    <td className="p-3 font-mono text-xs">{t.reference}</td>
                    <td className="p-3 text-xs">{t.type}</td>
                    <td className="p-3 text-xs text-gray-600">
                      {t.from_role || '—'} → {t.to_role || '—'}
                    </td>
                    <td className="p-3 text-right font-mono">{formatXAF(t.amount)}</td>
                    <td className="p-3 text-xs text-gray-500">
                      {new Date(t.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Audit */}
      {tab === 'audit' && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {auditLogs.length === 0 ? (
            <div className="p-10 text-center text-gray-500">Aucun log</div>
          ) : (
            <ul className="divide-y">
              {auditLogs.map(l => (
                <li key={l.id} className="p-3 text-sm flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-gray-500">{new Date(l.created_at).toLocaleString('fr-FR')}</span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-gray-100">{l.actor_role}</span>
                  <span className="font-medium">{l.action}</span>
                  {l.details && (
                    <span className="text-xs text-gray-500 ml-auto truncate max-w-md">
                      {JSON.stringify(l.details)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Reject withdrawal modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl" data-testid="reject-modal">
            <h3 className="font-bold text-lg mb-2">Rejeter le retrait</h3>
            <p className="text-sm text-gray-500 mb-4">
              {formatXAF(rejectModal.amount)} pour {rejectModal.user_name || rejectModal.user_id?.slice(0,8)}
            </p>
            <textarea
              data-testid="reject-reason-input"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Motif du rejet (obligatoire)"
              className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-orange-500 min-h-[100px]"
            />
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => { setRejectModal(null); setRejectReason(''); }}
                className="px-4 py-2 rounded-full text-gray-600 hover:bg-gray-100"
              >
                Annuler
              </button>
              <button
                data-testid="reject-confirm-btn"
                onClick={rejectWithdrawal}
                className="px-4 py-2 rounded-full bg-rose-500 text-white font-medium hover:bg-rose-600"
              >
                Confirmer le rejet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminFinancePanel;
