import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Menu as MenuIcon, ShoppingBag, User, Search, MapPin, Clock,
  ChevronDown, ChevronRight, Star, ArrowRight, Truck, ShieldCheck,
  Sparkles, MessageSquare
} from 'lucide-react';
import HemeleyLogo from './HemeleyLogo';
import FoodChatBot from './FoodChatBot';
import { API } from './MapUtils';
import { useCart } from './CartContext';

// ============ Header ============

const LandingHeader = ({ onOpenMenu }) => {
  const navigate = useNavigate();
  const { getItemCount } = useCart();
  const cartCount = getItemCount();
  const customer = JSON.parse(localStorage.getItem('hemeley_customer') || 'null');

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-stone-100">
      <div className="max-w-7xl mx-auto h-16 px-4 sm:px-6 flex items-center gap-4">
        <button
          onClick={onOpenMenu}
          className="p-2 rounded-lg hover:bg-stone-100 transition"
          aria-label="Menu"
          data-testid="landing-burger-btn"
        >
          <MenuIcon size={22} />
        </button>

        <Link to="/" className="flex items-center" data-testid="landing-logo-link">
          <HemeleyLogo size={34} />
        </Link>

        <nav className="hidden md:flex items-center gap-7 ml-6 text-sm font-medium text-slate-700">
          <Link to="/menu" className="hover:text-slate-900 transition" data-testid="nav-restaurants">Restaurants</Link>
          <Link to="/menu" className="hover:text-slate-900 transition" data-testid="nav-offers">Offres</Link>
          <a href="#help" className="hover:text-slate-900 transition" data-testid="nav-help">Aide</a>
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-4">
          <button
            onClick={() => navigate('/menu')}
            className="hidden sm:flex items-center gap-2 text-slate-700 hover:text-slate-900 px-2"
            data-testid="header-cart-btn"
          >
            <span className="relative">
              <ShoppingBag size={20} />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {cartCount}
                </span>
              )}
            </span>
            <span className="text-sm">Panier</span>
          </button>

          {customer ? (
            <Link to="/client/dashboard" className="flex items-center gap-2 text-slate-700 hover:text-slate-900 text-sm" data-testid="header-account">
              <User size={18} />
              <span className="hidden sm:inline">{customer.pseudo}</span>
            </Link>
          ) : (
            <>
              <Link to="/client/login" className="flex items-center gap-2 text-slate-700 hover:text-slate-900 text-sm" data-testid="header-login">
                <User size={18} />
                <span className="hidden sm:inline">Connexion</span>
              </Link>
              <Link
                to="/client/login?signup=1"
                className="bg-slate-900 text-white text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-slate-800 transition shadow-sm"
                data-testid="header-signup"
              >
                Inscription
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

// ============ Hero ============

const Hero = () => {
  const navigate = useNavigate();
  const [address, setAddress] = useState('');
  const [query, setQuery] = useState('');
  const [when, setWhen] = useState('Livrer maintenant');
  const [whenOpen, setWhenOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSugg, setShowSugg] = useState(false);

  // Live search across menus + restaurants
  useEffect(() => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await axios.get(`${API}/menus`);
        const q = query.toLowerCase();
        const matches = (res.data || [])
          .filter(m =>
            m.name?.toLowerCase().includes(q) ||
            m.vendor_name?.toLowerCase().includes(q) ||
            m.category?.toLowerCase().includes(q) ||
            m.zone?.toLowerCase().includes(q)
          )
          .slice(0, 6);
        setSuggestions(matches);
        setShowSugg(true);
      } catch {
        setSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const submit = () => {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (address.trim()) params.set('address', address.trim());
    navigate(`/menu${params.toString() ? `?${params.toString()}` : ''}`);
  };

  return (
    <section className="relative">
      <div
        className="relative h-[480px] sm:h-[560px] lg:h-[600px] overflow-hidden"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=2000&q=80')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-white/85 via-white/40 to-transparent" />

        <div className="relative max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center">
          <div className="max-w-2xl w-full">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 leading-tight tracking-tight" data-testid="hero-title">
              Vos restos locaux<br/>livrés chez vous
            </h1>

            <form
              onSubmit={(e) => { e.preventDefault(); submit(); }}
              className="mt-8 bg-white rounded-2xl shadow-xl p-1.5 flex flex-col sm:flex-row gap-1.5 max-w-2xl relative"
            >
              <div className="flex items-center gap-3 flex-1 px-4 py-3 rounded-xl border border-transparent hover:border-stone-200">
                <Search size={18} className="text-slate-400 flex-shrink-0" />
                <input
                  data-testid="hero-search-input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setShowSugg(true)}
                  onBlur={() => setTimeout(() => setShowSugg(false), 180)}
                  placeholder="Rechercher un plat, un restaurant, une zone..."
                  className="flex-1 bg-transparent outline-none text-sm text-slate-700 placeholder-slate-400"
                />
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setWhenOpen((v) => !v)}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm text-slate-700 hover:bg-stone-50 w-full sm:w-auto"
                  data-testid="hero-when-btn"
                >
                  <Clock size={18} className="text-slate-400" />
                  <span>{when}</span>
                  <ChevronDown size={16} className="text-slate-400" />
                </button>
                {whenOpen && (
                  <div className="absolute left-0 sm:left-auto right-0 top-full mt-2 bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden z-10 w-56">
                    {['Livrer maintenant', 'Pour plus tard'].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => { setWhen(v); setWhenOpen(false); }}
                        className="block w-full text-left px-4 py-2.5 text-sm hover:bg-stone-50"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-6 py-3 rounded-xl transition"
                data-testid="hero-find-btn"
              >
                Rechercher
              </button>

              {/* Live suggestions */}
              {showSugg && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-stone-200 rounded-2xl shadow-2xl overflow-hidden z-20" data-testid="hero-search-suggestions">
                  <ul className="max-h-80 overflow-y-auto divide-y">
                    {suggestions.map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => navigate(`/restaurant/${m.vendor_id}`)}
                          className="w-full flex items-center gap-3 p-3 hover:bg-stone-50 text-left"
                          data-testid={`suggestion-${m.id}`}
                        >
                          {m.image_base64 ? (
                            <img src={m.image_base64.startsWith('data:') ? m.image_base64 : `data:image/jpeg;base64,${m.image_base64}`} alt={m.name} className="w-12 h-12 rounded-lg object-cover" />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-stone-100 flex items-center justify-center">
                              <HemeleyLogo size={24} showText={false} />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-900 truncate">{m.name}</p>
                            <p className="text-xs text-slate-500 truncate">{m.vendor_name} · {m.zone}</p>
                          </div>
                          <span className="font-bold text-orange-500 text-sm">{Number(m.price).toLocaleString()} F</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </form>

            <div className="mt-6 flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 bg-white rounded-full px-4 py-2 shadow-sm">
                <MapPin size={16} className="text-slate-400" />
                <input
                  data-testid="hero-address-input"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Votre adresse de livraison (optionnel)"
                  className="bg-transparent outline-none text-sm w-64 placeholder-slate-400"
                />
              </div>
              <button
                onClick={() => navigate('/menu')}
                className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-2.5 rounded-full shadow-lg transition group"
                data-testid="hero-discover-btn"
              >
                Découvrir les saveurs
                <Search size={16} className="group-hover:translate-x-0.5 transition" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// ============ Categories ============

const CATEGORY_DEFS = [
  { key: 'plat',     label: 'Plats',      img: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80' },
  { key: 'snack',    label: 'Snacks',     img: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80' },
  { key: 'boisson',  label: 'Boissons',   img: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=600&q=80' },
  { key: 'dessert',  label: 'Desserts',   img: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=600&q=80' },
  { key: 'petit-dej',label: 'Petit-déj',  img: 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=600&q=80' },
  { key: 'all',      label: 'Tout voir',  img: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=600&q=80' },
];

const Categories = () => {
  const navigate = useNavigate();
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-20" data-testid="categories-section">
      <div className="flex items-end justify-between mb-8">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Toutes les saveurs, en un clic</h2>
        <button onClick={() => navigate('/menu')} className="text-orange-500 font-semibold hover:underline inline-flex items-center gap-1 text-sm">
          Tout voir <ChevronRight size={16}/>
        </button>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 sm:gap-6">
        {CATEGORY_DEFS.map((c) => {
          const targetCat = c.key === 'petit-dej' ? 'petit-dejeuner' : c.key;
          return (
            <button
              key={c.key}
              onClick={() => navigate(`/menu${targetCat !== 'all' ? `?category=${targetCat}` : ''}`)}
              className="group flex flex-col items-center gap-3"
              data-testid={`cat-${c.key}`}
            >
              <div className="relative w-full aspect-[3/5] rounded-3xl overflow-hidden shadow-md group-hover:shadow-xl group-hover:-translate-y-1 transition-all">
                <img src={c.img} alt={c.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <span className="text-sm sm:text-base font-bold text-slate-800">{c.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

// ============ Popular vendors (from real menus) ============

const PopularVendors = () => {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await axios.get(`${API}/menus`);
        const grouped = {};
        for (const m of res.data || []) {
          const k = m.vendor_id;
          if (!grouped[k]) {
            const rawCover = m.image_base64 || null;
            grouped[k] = {
              vendor_id: m.vendor_id,
              vendor_name: m.vendor_name,
              zone: m.zone,
              menus_count: 0,
              cover: rawCover && !rawCover.startsWith('data:')
                ? `data:image/jpeg;base64,${rawCover}`
                : rawCover,
              avg_price: 0,
              total_price: 0,
            };
          }
          grouped[k].menus_count += 1;
          grouped[k].total_price += Number(m.price || 0);
          if (!grouped[k].cover && m.image_base64) {
            grouped[k].cover = m.image_base64.startsWith('data:')
              ? m.image_base64
              : `data:image/jpeg;base64,${m.image_base64}`;
          }
        }
        const list = Object.values(grouped)
          .map((v) => ({ ...v, avg_price: Math.round(v.total_price / v.menus_count) }))
          .slice(0, 6);
        if (alive) setVendors(list);
      } catch {
        if (alive) setVendors([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-14 sm:pb-20" data-testid="popular-section">
      <div className="flex items-end justify-between mb-8">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Populaire près de chez vous</h2>
        <button onClick={() => navigate('/menu')} className="text-orange-500 font-semibold hover:underline inline-flex items-center gap-1 text-sm">
          Tout voir <ChevronRight size={16}/>
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[0,1,2].map((i) => (
            <div key={i} className="aspect-[4/3] rounded-3xl bg-stone-100 animate-pulse" />
          ))}
        </div>
      ) : vendors.length === 0 ? (
        <div className="text-center py-12 text-slate-500">Aucun restaurant pour le moment.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {vendors.slice(0, 3).map((v, idx) => {
            const ratings = [4.8, 4.6, 4.9];
            const reviews = ['250+', '180+', '310+'];
            const fees = ['1 500 FCFA', '1 000 FCFA', '2 500 FCFA'];
            const times = ['20-30 min', '15-25 min', '30-45 min'];
            return (
              <button
                key={v.vendor_id}
                onClick={() => navigate(`/restaurant/${v.vendor_id}`)}
                className="group text-left"
                data-testid={`vendor-card-${v.vendor_id}`}
              >
                <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-md group-hover:shadow-xl group-hover:-translate-y-1 transition-all">
                  {v.cover ? (
                    <img src={v.cover} alt={v.vendor_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center">
                      <HemeleyLogo size={56} showText={false} />
                    </div>
                  )}
                  <div className="absolute top-3 right-3 bg-white px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1">
                    <Star size={12} className="text-orange-500 fill-orange-500" />
                    <span className="text-xs font-bold text-slate-900">{ratings[idx]}</span>
                    <span className="text-[10px] text-slate-500">({reviews[idx]})</span>
                  </div>
                </div>
                <div className="mt-4 flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{v.vendor_name}</h3>
                    <p className="text-sm text-slate-500 mt-1 inline-flex items-center gap-3">
                      <span className="inline-flex items-center gap-1"><ShoppingBag size={14}/> {fees[idx]} Livraison</span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1"><Clock size={14}/> {times[idx]}</span>
                    </p>
                  </div>
                  <span className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center text-slate-500 group-hover:bg-orange-500 group-hover:text-white transition">
                    <Search size={14} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};

// ============ Aventure Hemeley (delivery hero) ============

const AventureHemeley = () => (
  <section className="bg-stone-50 py-16 sm:py-24" data-testid="aventure-section">
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      <div className="text-center mb-12">
        <p className="text-orange-500 font-bold text-xs tracking-[0.25em] uppercase">L'aventure Hemeley</p>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-3">Le Goût de Chez Soi, Partout.</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="relative aspect-[4/5] rounded-3xl overflow-hidden shadow-2xl">
          <img
            src="https://images.unsplash.com/photo-1604908554007-1437a3a8b56c?auto=format&fit=crop&w=1200&q=80"
            alt="Livraison Hemeley"
            className="w-full h-full object-cover"
            onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1200&q=80'; }}
          />
          <div className="absolute bottom-6 left-6 bg-white/95 backdrop-blur px-4 py-2 rounded-full flex items-center gap-2 shadow-lg">
            <HemeleyLogo size={26} showText={false} />
            <span className="font-bold text-slate-900">Fresh Gourmet Delivery</span>
          </div>
        </div>

        <div>
          <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-tight">
            Le meilleur de votre ville,<br/>livré avec soin par Hemeley
          </h3>
          <p className="mt-5 text-slate-600 leading-relaxed">
            Rejoignez des milliers d'utilisateurs qui font confiance à Hemeley pour leurs repas quotidiens.
            Livraison ultra-rapide, tarifs transparents et les meilleurs restaurants de votre quartier.
          </p>

          <div className="mt-8 space-y-4">
            <div className="flex items-center gap-4 bg-white rounded-2xl border border-stone-100 p-4 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                <Clock size={20} className="text-orange-500" />
              </div>
              <div>
                <p className="font-bold text-slate-900">Livraison en 30 min</p>
                <p className="text-sm text-slate-500">Moyenne constatée sur nos commandes</p>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-white rounded-2xl border border-stone-100 p-4 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                <MapPin size={20} className="text-blue-500" />
              </div>
              <div>
                <p className="font-bold text-slate-900">Partout dans votre ville</p>
                <p className="text-sm text-slate-500">10 quartiers de Douala couverts</p>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-white rounded-2xl border border-stone-100 p-4 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <ShieldCheck size={20} className="text-emerald-500" />
              </div>
              <div>
                <p className="font-bold text-slate-900">Paiement sécurisé</p>
                <p className="text-sm text-slate-500">Wallet HEMELEY · MTN · Orange Money</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

// ============ Footer ============

const LandingFooter = () => (
  <footer className="bg-slate-950 text-slate-300 pt-16 pb-8" data-testid="landing-footer">
    <div className="max-w-7xl mx-auto px-4 sm:px-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
        <div className="md:col-span-1">
          <HemeleyLogo size={42} variant="dark" />
          <p className="mt-5 text-sm leading-relaxed text-slate-400">
            Hemeley transforme la façon dont vous mangez au quotidien. Découvrez,
            commandez et savourez le meilleur de la gastronomie locale sans quitter votre canapé.
          </p>
        </div>

        <FooterColumn title="Entreprise" links={[
          ['À propos', '/about'],
          ['Carrières', '/careers'],
          ['Blog', '/blog'],
          ['Presse', '/press'],
        ]} />
        <FooterColumn title="Partenaires" links={[
          ['Ajouter un restaurant', '/vendor'],
          ['Devenir coursier', '/delivery/login'],
          ['Hemeley for Business', '/business'],
        ]} />
        <FooterColumn title="Légal" links={[
          ['Confidentialité', '/privacy'],
          ['Conditions', '/terms'],
          ['Mentions légales', '/legal'],
        ]} />
      </div>

      <div className="mt-12 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <p>© {new Date().getFullYear()} Hemeley Technologies Inc. Tous droits réservés.</p>
        <div className="flex items-center gap-5">
          <button className="underline hover:text-white">Français</button>
          <Link to="/privacy" className="hover:text-white">Politique de cookies</Link>
        </div>
      </div>
    </div>
  </footer>
);

const FooterColumn = ({ title, links }) => (
  <div>
    <h4 className="font-bold text-white mb-5">{title}</h4>
    <ul className="space-y-3 text-sm">
      {links.map(([label, href]) => (
        <li key={label}>
          <Link to={href} className="hover:text-white transition">{label}</Link>
        </li>
      ))}
    </ul>
  </div>
);

// ============ Side menu ============

const SideMenu = ({ open, onClose }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div onClick={(e) => e.stopPropagation()} className="absolute left-0 top-0 bottom-0 w-80 bg-white shadow-2xl p-6 overflow-y-auto" data-testid="side-menu">
        <HemeleyLogo size={36} />
        <nav className="mt-8 space-y-1">
          {[
            ['Restaurants', '/menu'],
            ['Mes commandes', '/client/dashboard'],
            ['Wallet', '/client/dashboard'],
            ['Devenir partenaire', '/vendor'],
            ['Devenir livreur', '/delivery/login'],
            ['Aide', '#help'],
          ].map(([label, href]) => (
            <Link
              key={label}
              to={href}
              onClick={onClose}
              className="block px-3 py-3 rounded-xl hover:bg-stone-100 text-slate-800 font-medium"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
};

// ============ Main Page ============

const HemeleyLandingPage = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white" data-testid="hemeley-landing">
      <LandingHeader onOpenMenu={() => setMenuOpen(true)} />
      <Hero />
      <Categories />
      <PopularVendors />
      <AventureHemeley />
      <LandingFooter />

      <FoodChatBot />
      <SideMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
};

export default HemeleyLandingPage;
