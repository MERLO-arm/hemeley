/*
 * CategorizedMenuList — affichage groupé par catégorie avec onglets horizontaux
 * scrollables (option A retenue par l'utilisateur : simplicité et cohérence
 * sur les 3 pages publiques).
 *
 * Props :
 *   menus: Menu[]            (menus à afficher, chaque item doit avoir .category)
 *   customCategories: string[] (catégories custom du vendor, en plus des bases)
 *   renderItem: (menu) => ReactNode  (rendu personnalisé par carte plat)
 *   searchThreshold: number  (défaut 10 — active la recherche si ≥ N plats)
 *   testid: string
 *   accentColor: string
 *
 * Comportement :
 *   - Détecte automatiquement les catégories présentes dans les menus + ajoute
 *     les customCategories du vendor (même vides — utile en édition).
 *   - Onglets horizontaux sticky avec compteurs par catégorie.
 *   - "Tous" en 1er onglet quand ≥ 2 catégories.
 *   - Barre de recherche si menus.length ≥ searchThreshold.
 *   - Clic onglet → filtre + scroll to top de la liste.
 *   - Aucun menu → état vide propre.
 */
import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

// Ordre canonique des catégories de base
const BASE_CATEGORY_ORDER = ['entree', 'plat', 'boisson', 'dessert', 'petit-dejeuner', 'snack', 'autre'];
const CATEGORY_LABELS = {
  entree: 'Entrées',
  plat: 'Plats',
  boisson: 'Boissons',
  dessert: 'Desserts',
  'petit-dejeuner': 'Petit-déj',
  snack: 'Snacks',
  autre: 'Autres',
};

const norm = (c) => (c || 'plat').toString().trim().toLowerCase();

const CategorizedMenuList = ({
  menus = [],
  customCategories = [],
  renderItem,
  searchThreshold = 10,
  testid = 'categorized-menu-list',
  accentColor = '#FF6B00',
}) => {
  const [activeTab, setActiveTab] = useState('all');
  const [query, setQuery] = useState('');

  // Build category list from menus + customs
  const { orderedCategories, counts } = useMemo(() => {
    const counts = {};
    menus.forEach(m => {
      const key = norm(m.category);
      counts[key] = (counts[key] || 0) + 1;
    });
    // Base first (only if present), then customs (only if present)
    const bases = BASE_CATEGORY_ORDER.filter(c => counts[c] > 0);
    const customsPresent = customCategories.map(norm).filter(c => counts[c] > 0);
    // Any category present in menus but not in bases or customs (data drift)
    const known = new Set([...bases, ...customsPresent]);
    const extras = Object.keys(counts).filter(c => !known.has(c));
    return {
      orderedCategories: [...bases, ...customsPresent, ...extras],
      counts,
    };
  }, [menus, customCategories]);

  // Label lookup: base labels, sinon on prend le libellé custom d'origine
  const labelFor = (key) => {
    if (CATEGORY_LABELS[key]) return CATEGORY_LABELS[key];
    const orig = customCategories.find(c => norm(c) === key);
    return orig || key.charAt(0).toUpperCase() + key.slice(1);
  };

  const filtered = useMemo(() => {
    let out = menus;
    if (activeTab !== 'all') {
      out = out.filter(m => norm(m.category) === activeTab);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      out = out.filter(m =>
        (m.name || '').toLowerCase().includes(q) ||
        (m.description || '').toLowerCase().includes(q)
      );
    }
    return out;
  }, [menus, activeTab, query]);

  const showSearch = menus.length >= searchThreshold;
  const showTabs = orderedCategories.length >= 2;

  return (
    <div data-testid={testid}>
      {/* Search bar */}
      {showSearch && (
        <div className="mb-4 relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher un plat…"
            data-testid={`${testid}-search`}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-gray-200 focus:border-orange-400 focus:outline-none text-sm"
          />
        </div>
      )}

      {/* Category tabs (sticky horizontal scroll) */}
      {showTabs && (
        <div
          className="sticky top-0 z-20 -mx-4 md:mx-0 px-4 md:px-0 py-2 bg-white/95 backdrop-blur border-b border-gray-100 mb-4 overflow-x-auto no-scrollbar"
          data-testid={`${testid}-tabs`}
        >
          <div className="flex gap-2 min-w-max">
            <TabBtn
              active={activeTab === 'all'}
              onClick={() => setActiveTab('all')}
              accent={accentColor}
              testid={`${testid}-tab-all`}
            >
              Tous <span className="ml-1.5 text-xs opacity-70">({menus.length})</span>
            </TabBtn>
            {orderedCategories.map(cat => (
              <TabBtn
                key={cat}
                active={activeTab === cat}
                onClick={() => setActiveTab(cat)}
                accent={accentColor}
                testid={`${testid}-tab-${cat}`}
              >
                {labelFor(cat)} <span className="ml-1.5 text-xs opacity-70">({counts[cat]})</span>
              </TabBtn>
            ))}
          </div>
        </div>
      )}

      {/* Rendered list */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center text-gray-500" data-testid={`${testid}-empty`}>
          <p className="text-sm">
            {query ? 'Aucun plat ne correspond à votre recherche.' : 'Aucun plat dans cette catégorie.'}
          </p>
        </div>
      ) : activeTab === 'all' && orderedCategories.length >= 2 ? (
        // Grouped by category with section headers when "Tous" is active
        <div className="space-y-6">
          {orderedCategories.map(cat => {
            const catItems = filtered.filter(m => norm(m.category) === cat);
            if (catItems.length === 0) return null;
            return (
              <section key={cat} data-testid={`${testid}-section-${cat}`}>
                <h3 className="text-lg font-bold mb-3 text-gray-800 flex items-center gap-2">
                  <span className="w-1 h-5 rounded-full" style={{ backgroundColor: accentColor }} />
                  {labelFor(cat)}
                  <span className="text-sm font-normal text-gray-400">({catItems.length})</span>
                </h3>
                <div className="space-y-3">
                  {catItems.map(m => renderItem(m))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        // Flat list for a specific category
        <div className="space-y-3">
          {filtered.map(m => renderItem(m))}
        </div>
      )}
    </div>
  );
};

const TabBtn = ({ active, onClick, accent, children, testid }) => (
  <button
    onClick={onClick}
    data-testid={testid}
    className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all border ${
      active
        ? 'text-white border-transparent shadow-sm'
        : 'text-gray-700 bg-white border-gray-200 hover:border-gray-300'
    }`}
    style={active ? { backgroundColor: accent } : undefined}
  >
    {children}
  </button>
);

export default CategorizedMenuList;
