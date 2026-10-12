/*
 * VendorAnalyticsTab — module Analytiques nouvelle génération pour l'espace vendeur.
 *
 * Design goals (spec utilisateur) :
 *  - Filtres globaux (période + catégorie) fixes en haut, appliqués à tous les widgets
 *  - Skeleton loaders sur chaque widget (jamais d'écran blanc / de graphe plat)
 *  - États vides explicites ("Pas encore de commandes sur cette période")
 *  - Chiffres clés + delta vs période précédente (flèche + %)
 *  - CA net vs CA brut (commission plateforme)
 *  - Top / Bottom 5, Boissons top 5, Matrice Menu Engineering
 *  - Heatmap 7×24, best day/hour badges
 *  - Ratio nouveau vs récurrent (stacked bars 4 semaines)
 *  - Résumé Wallet + projection 7j
 *  - Alertes automatiques
 *  - Export CSV par widget + PDF global (respecte les filtres actifs)
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import {
  TrendingUp, TrendingDown, RefreshCw, Download, FileText, AlertTriangle,
  Wallet, Calendar, Star, Utensils, Coffee, Trophy, Flame, Info
} from 'lucide-react';
import { saveAs } from 'file-saver';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CATEGORY_LABELS = {
  all: 'Toutes',
  plat: 'Plats',
  boisson: 'Boissons',
  dessert: 'Desserts',
  snack: 'Snacks',
  'petit-dejeuner': 'Petit-déj',
};
const PERIODS = [
  { id: 'today', label: "Aujourd'hui" },
  { id: '7d', label: '7 derniers jours' },
  { id: '30d', label: '30 derniers jours' },
  { id: 'month', label: 'Ce mois' },
  { id: 'custom', label: 'Personnalisé' },
];

const QUADRANT_META = {
  stars:      { label: 'Étoiles',          color: '#F59E0B', desc: 'Populaires ET marge élevée' },
  workhorses: { label: 'Chevaux de trait', color: '#3B82F6', desc: 'Populaires mais marge faible' },
  puzzles:    { label: 'Énigmes',          color: '#8B5CF6', desc: 'Marge élevée mais peu vendus' },
  dogs:       { label: 'Poids morts',      color: '#6B7280', desc: 'Peu vendus ET marge faible' },
};

// --- helpers ---------------------------------------------------------------
const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('fr-FR') : n);
const fmtDate = (iso) => (iso ? iso.slice(0, 10) : '—');

const DeltaBadge = ({ pct }) => {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return null;
  if (pct === 0) return <span className="text-xs text-gray-400">— 0%</span>;
  const positive = pct > 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  const color = positive ? 'text-emerald-400' : 'text-red-400';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${color}`}>
      <Icon size={12} />
      {positive ? '+' : ''}{pct}%
    </span>
  );
};

const Skeleton = ({ h = 'h-24', className = '' }) => (
  <div className={`animate-pulse rounded-2xl bg-slate-800/40 ${h} ${className}`} />
);

const EmptyState = ({ title = 'Pas encore de données', hint = 'Les données apparaîtront ici dès que vous aurez des commandes.', icon: Icon = Info }) => (
  <div className="flex flex-col items-center justify-center py-10 text-center" data-testid="analytics-empty-state">
    <div className="mb-3 w-12 h-12 rounded-full bg-slate-800/60 flex items-center justify-center">
      <Icon size={22} className="text-gray-400" />
    </div>
    <p className="font-semibold text-sm text-gray-200">{title}</p>
    <p className="text-xs text-gray-500 mt-1 max-w-xs">{hint}</p>
  </div>
);

const Card = ({ title, subtitle, right, children, darkMode, testid, exportRows }) => {
  const bg = darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-gray-100';
  const doExport = () => {
    if (!exportRows || exportRows.length === 0) {
      toast.info('Rien à exporter pour ce widget');
      return;
    }
    const headers = Object.keys(exportRows[0]);
    const csv = [headers.join(','), ...exportRows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
    saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${(title || 'export').replace(/\s+/g,'_')}.csv`);
  };
  return (
    <div className={`p-5 rounded-2xl border ${bg} backdrop-blur-xl`} data-testid={testid}>
      <div className="flex items-start justify-between mb-4 gap-3">
        <div>
          <h3 className="text-base font-bold">{title}</h3>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {right}
          {exportRows && (
            <button
              onClick={doExport}
              data-testid={`export-csv-${testid || 'widget'}`}
              className="p-2 rounded-lg hover:bg-slate-800/70 text-gray-400 hover:text-white transition-colors"
              title="Exporter CSV"
            >
              <Download size={14} />
            </button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
};

// --- main component --------------------------------------------------------
const VendorAnalyticsTab = ({ darkMode = true }) => {
  const [period, setPeriod] = useState('7d');
  const [category, setCategory] = useState('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetchedAt, setLastFetchedAt] = useState(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('vendor_token') : null;

  const fetchAnalytics = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ period, category });
      if (period === 'custom') { params.set('start', customStart); params.set('end', customEnd); }
      const resp = await axios.get(`${API}/vendor/analytics?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(resp.data);
      setLastFetchedAt(new Date());
    } catch (e) {
      setError(e?.response?.data?.detail || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [period, category, customStart, customEnd, token]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const timeAgo = useMemo(() => {
    if (!lastFetchedAt) return '';
    const diff = Math.round((Date.now() - lastFetchedAt.getTime()) / 60000);
    if (diff < 1) return "à l'instant";
    if (diff === 1) return 'il y a 1 min';
    if (diff < 60) return `il y a ${diff} min`;
    return `à ${lastFetchedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  }, [lastFetchedAt]);

  const handleExportPdf = async () => {
    if (!token) return;
    setExportingPdf(true);
    try {
      const params = new URLSearchParams({ period, category });
      if (period === 'custom') { params.set('start', customStart); params.set('end', customEnd); }
      const resp = await axios.get(`${API}/vendor/analytics/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });
      saveAs(resp.data, `HEMELEY_rapport_${period}_${Date.now()}.pdf`);
      toast.success('Rapport PDF téléchargé');
    } catch {
      toast.error('Échec de génération du PDF');
    } finally {
      setExportingPdf(false);
    }
  };

  // ---- render helpers ------------------------------------------------------
  const chartOptions = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (c) => `${fmt(c.parsed.y)} FCFA` } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: darkMode ? '#9CA3AF' : '#6B7280' } },
      y: {
        beginAtZero: true, min: 0,
        grid: { color: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
        ticks: { color: darkMode ? '#9CA3AF' : '#6B7280', callback: (v) => fmt(v) },
      },
    },
  }), [darkMode]);

  // ---- render --------------------------------------------------------------
  return (
    <div className="space-y-6" data-testid="vendor-analytics-tab">
      {/* Sticky filters bar */}
      <div className={`sticky top-0 z-10 -mx-4 md:mx-0 px-4 md:px-0 py-3 backdrop-blur-md ${darkMode ? 'bg-slate-950/85' : 'bg-white/85'}`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-800/60 p-1" data-testid="analytics-period-selector">
            {PERIODS.map(p => (
              <button
                key={p.id}
                data-testid={`analytics-period-${p.id}`}
                onClick={() => setPeriod(p.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${period === p.id ? 'bg-orange-500 text-white' : 'text-gray-300 hover:bg-slate-700/50'}`}
              >{p.label}</button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="flex items-center gap-2" data-testid="analytics-custom-range">
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                data-testid="analytics-custom-start"
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-sm text-white border border-slate-700" />
              <span className="text-gray-500">→</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                data-testid="analytics-custom-end"
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-sm text-white border border-slate-700" />
            </div>
          )}

          {data?.categories_available?.length > 0 && (
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              data-testid="analytics-category-filter"
              className="px-3 py-2 rounded-xl bg-slate-800/60 text-sm text-white border border-slate-700"
            >
              {data.categories_available.map(c => (
                <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>
              ))}
            </select>
          )}

          <div className="ml-auto flex items-center gap-3">
            {lastFetchedAt && (
              <span className="text-xs text-gray-500">Mis à jour {timeAgo}</span>
            )}
            <button
              onClick={fetchAnalytics}
              disabled={loading}
              data-testid="analytics-refresh-btn"
              className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-gray-300 disabled:opacity-50"
              title="Actualiser"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={handleExportPdf}
              disabled={exportingPdf || loading}
              data-testid="analytics-export-pdf"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium disabled:opacity-50"
            >
              <FileText size={14} />
              {exportingPdf ? 'Génération…' : 'Exporter PDF'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-900/30 border border-red-800 text-red-300 text-sm" data-testid="analytics-error">
          {error}
        </div>
      )}

      {/* ALERTES en bandeau (au-dessus des filtres pas possible ici; on met juste en dessous) */}
      {data?.alerts?.length > 0 && (
        <div className="space-y-2" data-testid="analytics-alerts">
          {data.alerts.map((a, i) => (
            <div key={i} className={`p-4 rounded-xl border flex items-start gap-3 ${
              a.severity === 'danger' ? 'bg-red-900/20 border-red-800 text-red-200' :
              a.severity === 'warning' ? 'bg-amber-900/20 border-amber-800 text-amber-200' :
              'bg-blue-900/20 border-blue-800 text-blue-200'
            }`}>
              <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">{a.title}</p>
                <p className="text-xs opacity-90">{a.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SECTION A — VENTES */}
      <section>
        <h4 className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-3 flex items-center gap-2">
          <TrendingUp size={12} /> Ventes
        </h4>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <Skeleton key={i} h="h-28" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard title="CA brut" value={`${fmt(data?.revenue?.gross || 0)} FCFA`} delta={data?.revenue?.change_pct} darkMode={darkMode} testid="kpi-revenue-gross" />
            <KpiCard title="CA net (après commission)" value={`${fmt(data?.revenue?.net || 0)} FCFA`} sub={`Commission ${Math.round((data?.commission_rate || 0) * 100)}%`} darkMode={darkMode} testid="kpi-revenue-net" />
            <KpiCard title="Commandes" value={fmt(data?.orders?.count || 0)} delta={data?.orders?.change_pct} darkMode={darkMode} testid="kpi-orders" />
            <KpiCard title="Panier moyen" value={`${fmt(data?.orders?.avg_basket || 0)} FCFA`} sub={`Conv. ${data?.orders?.conversion_rate || 0}%`} darkMode={darkMode} testid="kpi-avg-basket" />
          </div>
        )}
        <div className="mt-4">
          <Card
            title="Évolution du chiffre d'affaires"
            subtitle="Revenu quotidien sur la période"
            darkMode={darkMode}
            testid="widget-revenue-timeline"
            exportRows={data?.timeline?.labels?.map((lbl, i) => ({
              date: lbl, revenue: data.timeline.revenue[i], orders: data.timeline.orders[i],
            }))}
          >
            {loading ? <Skeleton h="h-64" /> :
              (data?.orders?.count || 0) === 0 ? (
                <EmptyState title="Pas encore de commandes sur cette période" icon={Calendar} />
              ) : (
                <div className="h-64">
                  <Line
                    data={{
                      labels: data.timeline.labels,
                      datasets: [{
                        label: 'Revenus (FCFA)',
                        data: data.timeline.revenue,
                        fill: true,
                        borderColor: '#FF6B00',
                        backgroundColor: 'rgba(255,107,0,0.1)',
                        tension: 0.4,
                        pointRadius: 4,
                      }],
                    }}
                    options={chartOptions}
                  />
                </div>
              )}
          </Card>
        </div>
      </section>

      {/* SECTION B — PRODUITS */}
      <section>
        <h4 className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-3 flex items-center gap-2">
          <Utensils size={12} /> Produits
        </h4>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title="Top 5 des plats vendus" darkMode={darkMode} testid="widget-top-sold"
            exportRows={data?.top_sold?.map(it => ({ name: it.name, category: it.category, qty: it.qty, revenue_fcfa: it.revenue }))}>
            {loading ? <Skeleton h="h-64" /> :
              (data?.top_sold?.length || 0) === 0 ? <EmptyState title="Aucune vente sur la période" icon={Trophy} /> : (
                <TopBottomList items={data.top_sold} accent="#F59E0B" darkMode={darkMode} />
              )}
          </Card>

          <Card title="Top 5 des plats les moins vendus" darkMode={darkMode} testid="widget-bottom-sold"
            subtitle="Ceux qu'il faut peut-être repenser"
            exportRows={data?.bottom_sold?.map(it => ({ name: it.name, category: it.category, qty: it.qty, revenue_fcfa: it.revenue }))}>
            {loading ? <Skeleton h="h-64" /> :
              (data?.bottom_sold?.length || 0) === 0 ? <EmptyState title="Pas assez de données pour classer" icon={Trophy} /> : (
                <TopBottomList items={data.bottom_sold} accent="#6B7280" darkMode={darkMode} />
              )}
          </Card>

          <Card title="Boissons les plus vendues" darkMode={darkMode} testid="widget-top-drinks"
            exportRows={data?.top_drinks?.map(it => ({ name: it.name, qty: it.qty, revenue_fcfa: it.revenue }))}>
            {loading ? <Skeleton h="h-64" /> :
              (data?.top_drinks?.length || 0) === 0 ? <EmptyState title="Aucune boisson vendue sur la période" icon={Coffee} /> : (
                <TopBottomList items={data.top_drinks} accent="#00D9C0" darkMode={darkMode} />
              )}
          </Card>

          <Card title="Répartition par catégorie" darkMode={darkMode} testid="widget-category-breakdown"
            exportRows={data?.category_breakdown?.map(it => ({ category: it.category, revenue_fcfa: it.revenue }))}>
            {loading ? <Skeleton h="h-64" /> :
              (data?.category_breakdown?.length || 0) === 0 ? <EmptyState /> : (
                <div className="h-64">
                  <Doughnut
                    data={{
                      labels: data.category_breakdown.map(c => CATEGORY_LABELS[c.category] || c.category),
                      datasets: [{
                        data: data.category_breakdown.map(c => c.revenue),
                        backgroundColor: ['#FF6B00','#00D9C0','#8B5CF6','#F59E0B','#6B7280','#EF4444'],
                        borderWidth: 0,
                      }],
                    }}
                    options={{ responsive: true, maintainAspectRatio: false, cutout: '65%',
                      plugins: { legend: { position: 'bottom', labels: { color: darkMode ? '#fff' : '#333', font: { size: 11 } } },
                                 tooltip: { callbacks: { label: c => `${c.label}: ${fmt(c.parsed)} FCFA` } } },
                    }}
                  />
                </div>
              )}
          </Card>
        </div>

        {/* Menu Engineering Matrix (4 quadrants) */}
        <div className="mt-4">
          <Card
            title="Matrice Menu Engineering"
            subtitle="Croisement popularité × marge — regardez où se trouvent vos plats"
            darkMode={darkMode} testid="widget-menu-engineering"
            exportRows={data?.menu_engineering?.map(m => ({
              name: m.name, category: m.category, qty: m.qty, price: m.price,
              cost_price: m.cost_price, margin_pct: m.margin_pct, quadrant: m.quadrant,
            }))}
          >
            {loading ? <Skeleton h="h-72" /> :
              (data?.menu_engineering?.length || 0) === 0 ? <EmptyState title="Aucun plat dans votre menu" /> : (
                <MenuEngineeringMatrix items={data.menu_engineering} darkMode={darkMode} />
              )}
          </Card>
        </div>
      </section>

      {/* SECTION C — TEMPOREL */}
      <section>
        <h4 className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-3 flex items-center gap-2">
          <Flame size={12} /> Temporel
        </h4>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Card title="Heatmap des commandes"
              subtitle="Jour de la semaine × Heure — intensité = volume"
              darkMode={darkMode} testid="widget-heatmap">
              {loading ? <Skeleton h="h-72" /> :
                (data?.orders?.count || 0) === 0 ? <EmptyState /> : (
                  <Heatmap grid={data.heatmap} />
                )}
            </Card>
          </div>
          <div className="space-y-4">
            <Card title="Meilleur jour" darkMode={darkMode} testid="widget-best-day">
              {loading ? <Skeleton h="h-24" /> :
                !data?.best_day ? <EmptyState hint="Nous saurons vous le dire après quelques commandes." /> : (
                  <div>
                    <p className="text-2xl font-bold">{data.best_day.name}</p>
                    <p className="text-sm text-gray-400 mt-1">
                      {data.best_day.orders} commandes ({data.best_day.pct_vs_avg > 0 ? '+' : ''}{data.best_day.pct_vs_avg}% vs moyenne)
                    </p>
                  </div>
                )}
            </Card>
            <Card title="Heure de pointe" darkMode={darkMode} testid="widget-best-hour">
              {loading ? <Skeleton h="h-24" /> :
                !data?.best_hour ? <EmptyState hint="Encore un peu d'activité et on vous dira." /> : (
                  <div>
                    <p className="text-2xl font-bold">
                      {String(data.best_hour.hour_start).padStart(2,'0')}h–{String(data.best_hour.hour_end).padStart(2,'0')}h
                    </p>
                    <p className="text-sm text-gray-400 mt-1">{data.best_hour.share_pct}% de vos commandes</p>
                  </div>
                )}
            </Card>
            <Card title="Temps moyen de préparation" darkMode={darkMode} testid="widget-avg-prep">
              {loading ? <Skeleton h="h-20" /> :
                data?.avg_prep_min == null ? <EmptyState hint="Requiert des commandes livrées avec horodatage." /> : (
                  <p className="text-2xl font-bold">{data.avg_prep_min} min</p>
                )}
            </Card>
          </div>
        </div>
      </section>

      {/* SECTION D — CLIENT / FIDÉLITÉ */}
      <section>
        <h4 className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-3 flex items-center gap-2">
          <Star size={12} /> Client & Fidélité
        </h4>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title="Nouveaux vs récurrents" subtitle="Sur les 4 dernières semaines" darkMode={darkMode} testid="widget-cust-weekly">
            {loading ? <Skeleton h="h-64" /> :
              (data?.customers?.total || 0) === 0 ? <EmptyState /> : (
                <div className="h-64">
                  <Bar
                    data={{
                      labels: data.customers.weekly.map(w => w.label),
                      datasets: [
                        { label: 'Nouveaux', data: data.customers.weekly.map(w => w.new), backgroundColor: '#FF6B00', stack: 's' },
                        { label: 'Récurrents', data: data.customers.weekly.map(w => w.returning), backgroundColor: '#00D9C0', stack: 's' },
                      ],
                    }}
                    options={{ responsive: true, maintainAspectRatio: false,
                      plugins: { legend: { position: 'bottom', labels: { color: darkMode ? '#fff' : '#333' } } },
                      scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true } },
                    }}
                  />
                </div>
              )}
          </Card>
          <div className="space-y-4">
            <Card title="Fréquence moyenne / client" darkMode={darkMode} testid="widget-cust-freq">
              {loading ? <Skeleton h="h-20" /> :
                (data?.customers?.total || 0) === 0 ? <EmptyState /> : (
                  <div>
                    <p className="text-3xl font-bold">{data.customers.avg_orders_per_customer}</p>
                    <p className="text-sm text-gray-400 mt-1">commandes / client sur la période</p>
                  </div>
                )}
            </Card>
            <Card title="Note moyenne" darkMode={darkMode} testid="widget-avg-rating">
              {loading ? <Skeleton h="h-20" /> :
                data?.reviews?.avg_rating == null ? <EmptyState hint="Aucun avis reçu sur cette période." /> : (
                  <div className="flex items-baseline gap-3">
                    <p className="text-3xl font-bold">{data.reviews.avg_rating}/5</p>
                    <p className="text-xs text-gray-400">({data.reviews.count} avis)</p>
                    {data.reviews.trend != null && (
                      <span className={`text-xs font-semibold ${data.reviews.trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {data.reviews.trend >= 0 ? '+' : ''}{data.reviews.trend}
                      </span>
                    )}
                  </div>
                )}
            </Card>
          </div>
        </div>
      </section>

      {/* SECTION E — TRÉSORERIE */}
      <section>
        <h4 className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-3 flex items-center gap-2">
          <Wallet size={12} /> Trésorerie
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card title="Solde disponible" darkMode={darkMode} testid="widget-wallet-balance">
            {loading ? <Skeleton h="h-20" /> : (
              <p className="text-3xl font-bold">{fmt(Math.round(data?.wallet?.balance || 0))} <span className="text-base text-gray-400">{data?.wallet?.currency}</span></p>
            )}
          </Card>
          <Card title="Projection 7 jours" subtitle="Estimation nette basée sur votre moyenne" darkMode={darkMode} testid="widget-projection">
            {loading ? <Skeleton h="h-20" /> :
              (data?.wallet?.projection_7d_net || 0) === 0 ? <EmptyState hint="Manque de données pour projeter." /> : (
                <p className="text-3xl font-bold">≈ {fmt(data.wallet.projection_7d_net)} FCFA</p>
              )}
          </Card>
          <Card title="Retraits récents" darkMode={darkMode} testid="widget-recent-withdrawals">
            {loading ? <Skeleton h="h-20" /> :
              (data?.wallet?.recent_withdrawals?.length || 0) === 0 ? <EmptyState hint="Aucun retrait pour l'instant." /> : (
                <ul className="text-sm space-y-2">
                  {data.wallet.recent_withdrawals.map((w, i) => (
                    <li key={i} className="flex justify-between text-gray-300">
                      <span>{fmtDate(w.created_at)}</span>
                      <span className="font-semibold">{fmt(w.amount)} FCFA</span>
                    </li>
                  ))}
                </ul>
              )}
          </Card>
        </div>
      </section>
    </div>
  );
};

// ---- Sub-components -------------------------------------------------------

const KpiCard = ({ title, value, sub, delta, testid, darkMode }) => (
  <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-gray-100'}`} data-testid={testid}>
    <p className="text-xs text-gray-400 mb-1">{title}</p>
    <p className="text-xl font-bold">{value}</p>
    <div className="mt-1 flex items-center gap-2">
      {delta !== undefined && <DeltaBadge pct={delta} />}
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  </div>
);

const TopBottomList = ({ items, accent, darkMode }) => (
  <ul className="space-y-3">
    {items.map((it, i) => (
      <li key={it.menu_id} className="flex items-center gap-3">
        <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: accent, color: '#fff' }}>{i + 1}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{it.name}</p>
          <p className="text-xs text-gray-400">{it.qty} vendus • {CATEGORY_LABELS[it.category] || it.category}</p>
        </div>
        <span className="text-sm font-bold text-orange-400 flex-shrink-0">{fmt(it.revenue)} FCFA</span>
      </li>
    ))}
  </ul>
);

const MenuEngineeringMatrix = ({ items, darkMode }) => {
  // 2D grid : 4 quadrants
  const groups = { stars: [], workhorses: [], puzzles: [], dogs: [] };
  items.forEach(it => groups[it.quadrant]?.push(it));
  const gridCell = (title, list, quadKey) => {
    const meta = QUADRANT_META[quadKey];
    return (
      <div className={`p-3 rounded-xl border ${darkMode ? 'border-slate-800' : 'border-gray-200'}`}
           style={{ backgroundColor: `${meta.color}12` }}
           data-testid={`quadrant-${quadKey}`}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="font-bold text-sm" style={{ color: meta.color }}>{meta.label}</p>
            <p className="text-[10px] text-gray-500">{meta.desc}</p>
          </div>
          <span className="text-xs font-bold text-gray-400">{list.length}</span>
        </div>
        <ul className="space-y-1.5 max-h-28 overflow-y-auto">
          {list.length === 0 && <li className="text-xs text-gray-500">Aucun plat</li>}
          {list.slice(0, 5).map(it => (
            <li key={it.menu_id} className="text-xs flex justify-between text-gray-300">
              <span className="truncate">{it.name}</span>
              <span className="text-gray-500 ml-2 flex-shrink-0">
                {it.qty}× {it.margin_pct != null ? `• ${it.margin_pct}%` : ''}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  };
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        {gridCell('Étoiles', groups.stars, 'stars')}
        {gridCell('Énigmes', groups.puzzles, 'puzzles')}
        {gridCell('Chevaux de trait', groups.workhorses, 'workhorses')}
        {gridCell('Poids morts', groups.dogs, 'dogs')}
      </div>
      <p className="text-[11px] text-gray-500 mt-3">
        Astuce : renseignez le <b>coût matière</b> de chaque plat dans « Mes Plats » pour affiner la marge.
        Sans coût matière, la marge par défaut est estimée à 40%.
      </p>
    </div>
  );
};

const Heatmap = ({ grid }) => {
  const days = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  const max = Math.max(1, ...grid.flat());
  return (
    <div className="overflow-x-auto">
      <div className="min-w-max">
        <div className="flex text-[10px] text-gray-500 ml-8 mb-1">
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} className="w-6 text-center">{h % 3 === 0 ? h : ''}</span>
          ))}
        </div>
        {grid.map((row, d) => (
          <div key={d} className="flex items-center mb-0.5">
            <span className="w-8 text-[11px] text-gray-500 text-right pr-2">{days[d]}</span>
            {row.map((v, h) => {
              const alpha = v === 0 ? 0.05 : Math.max(0.15, v / max);
              return (
                <div key={h} className="w-6 h-6 mx-[1px] rounded-[3px]" title={`${days[d]} ${h}h : ${v} commande${v>1?'s':''}`}
                     style={{ backgroundColor: `rgba(255,107,0,${alpha})` }} />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default VendorAnalyticsTab;
