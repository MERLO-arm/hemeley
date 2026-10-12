/*
 * VendorProfileBranding — Section « Profil du restaurant » dans Paramètres.
 *
 * Fonctionnalités :
 *  - Upload logo (jpg/png/webp, max 2 Mo) avec prévisualisation immédiate + recadrage carré CSS
 *  - Choix d'une couleur de marque (color picker + hex input)
 *  - Erreurs claires (taille/format)
 *  - Preview en direct avant enregistrement
 */
import React, { useState, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Upload, Palette, Save, Trash2, ImagePlus, X, Tag, Plus, ChevronUp, ChevronDown } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const MAX_COVER_BYTES = 4 * 1024 * 1024;
const MAX_COVERS = 3;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const BASE_CATS = ['entree', 'plat', 'boisson', 'dessert', 'petit-dejeuner', 'snack', 'autre'];

const VendorProfileBranding = ({ vendor, darkMode = true, onSaved }) => {
  const [logoPreview, setLogoPreview] = useState(vendor?.logo_base64 || null);
  const [brandColor, setBrandColor] = useState(vendor?.brand_color || '#FF6B00');
  const [covers, setCovers] = useState(vendor?.cover_photos || []);
  const [customCats, setCustomCats] = useState(vendor?.custom_categories || []);
  const [newCatDraft, setNewCatDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const fileRef = useRef(null);
  const coverRef = useRef(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('vendor_token') : null;

  const readFileAsDataURL = (file) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onloadend = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

  const handleLogoFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) { toast.error('Format non autorisé (jpg, png, webp)'); return; }
    if (file.size > MAX_LOGO_BYTES) { toast.error('Logo trop lourd (max 2 Mo)'); return; }
    setLogoPreview(await readFileAsDataURL(file));
    setDirty(true);
  };

  const handleCoverFile = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (covers.length + files.length > MAX_COVERS) {
      toast.error(`Maximum ${MAX_COVERS} photos de couverture`);
      return;
    }
    const validated = [];
    for (const f of files) {
      if (!ACCEPTED.includes(f.type)) { toast.error(`${f.name} : format non autorisé`); continue; }
      if (f.size > MAX_COVER_BYTES) { toast.error(`${f.name} : trop lourde (max 4 Mo)`); continue; }
      validated.push(await readFileAsDataURL(f));
    }
    if (validated.length) {
      setCovers([...covers, ...validated].slice(0, MAX_COVERS));
      setDirty(true);
    }
    if (coverRef.current) coverRef.current.value = '';
  };

  const moveCover = (idx, delta) => {
    const next = [...covers];
    const j = idx + delta;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setCovers(next);
    setDirty(true);
  };

  const removeCover = (idx) => {
    setCovers(covers.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const removeLogo = () => {
    setLogoPreview(null);
    setDirty(true);
    if (fileRef.current) fileRef.current.value = '';
  };

  const addCustomCat = () => {
    const label = newCatDraft.trim();
    if (!label) return;
    if (label.length > 40) { toast.error('Nom trop long (40 caractères max)'); return; }
    const key = label.toLowerCase();
    if (BASE_CATS.includes(key)) { toast.error(`"${label}" est déjà une catégorie de base`); return; }
    if (customCats.some(c => c.toLowerCase() === key)) { toast.error('Catégorie déjà présente'); return; }
    if (customCats.length >= 12) { toast.error('Max 12 catégories personnalisées'); return; }
    setCustomCats([...customCats, label]);
    setNewCatDraft('');
    setDirty(true);
  };

  const removeCustomCat = (idx) => {
    setCustomCats(customCats.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const save = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const resp = await axios.patch(
        `${API}/vendor/profile/branding`,
        {
          logo_base64: logoPreview,
          brand_color: brandColor,
          cover_photos: covers,
          custom_categories: customCats,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success('Profil enregistré');
      setDirty(false);
      if (resp.data?.vendor) {
        try {
          const stored = JSON.parse(localStorage.getItem('vendor_data') || '{}');
          localStorage.setItem('vendor_data', JSON.stringify({ ...stored, ...resp.data.vendor }));
        } catch { /* ignore */ }
      }
      onSaved?.(resp.data.vendor);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Échec enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const cardBg = darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-gray-100';

  return (
    <div className={`p-6 rounded-2xl border ${cardBg}`} data-testid="vendor-profile-branding">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold">Profil du restaurant</h3>
          <p className="text-xs text-gray-400 mt-1">
            Logo, photos de couverture, couleur de marque et catégories personnalisées.
          </p>
        </div>
        {dirty && (
          <button
            onClick={save}
            disabled={saving}
            data-testid="save-branding-btn"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Logo */}
        <div>
          <label className="text-sm font-semibold text-gray-300 mb-3 block">Logo (carré)</label>
          <div className="flex items-start gap-4">
            <div
              className="w-28 h-28 rounded-2xl bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-dashed border-slate-700"
              data-testid="logo-preview"
            >
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs text-gray-500 text-center px-2">Aperçu du logo</span>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleLogoFile}
                className="hidden"
                data-testid="logo-file-input"
              />
              <button
                onClick={() => fileRef.current?.click()}
                data-testid="logo-upload-btn"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-white"
              >
                <Upload size={14} />
                {logoPreview ? 'Remplacer' : 'Téléverser'}
              </button>
              {logoPreview && (
                <button
                  onClick={removeLogo}
                  data-testid="logo-remove-btn"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 text-sm"
                >
                  <Trash2 size={14} />
                  Supprimer
                </button>
              )}
              <p className="text-xs text-gray-500">JPG, PNG ou WebP · max 2 Mo</p>
            </div>
          </div>
        </div>

        {/* Brand color */}
        <div>
          <label className="text-sm font-semibold text-gray-300 mb-3 block flex items-center gap-2">
            <Palette size={14} /> Couleur de marque
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={brandColor}
              onChange={e => { setBrandColor(e.target.value); setDirty(true); }}
              data-testid="brand-color-picker"
              className="w-14 h-14 rounded-xl cursor-pointer bg-transparent"
            />
            <input
              type="text"
              value={brandColor}
              onChange={e => { setBrandColor(e.target.value); setDirty(true); }}
              data-testid="brand-color-input"
              className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm"
              placeholder="#FF6B00"
              maxLength={7}
            />
          </div>
          <div className="mt-4 p-3 rounded-xl border border-slate-800" style={{ backgroundColor: `${brandColor}18` }}>
            <p className="text-xs text-gray-400 mb-1">Aperçu</p>
            <p className="font-bold text-sm" style={{ color: brandColor }}>{vendor?.name || 'Votre restaurant'}</p>
            <div className="mt-2 h-1 rounded-full" style={{ backgroundColor: brandColor }} />
          </div>
        </div>
      </div>

      {/* Photos de couverture */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <ImagePlus size={14} /> Photos de couverture ({covers.length}/{MAX_COVERS})
          </label>
          {covers.length < MAX_COVERS && (
            <button
              onClick={() => coverRef.current?.click()}
              data-testid="cover-upload-btn"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-white"
            >
              <Upload size={13} />
              Ajouter
            </button>
          )}
          <input
            ref={coverRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleCoverFile}
            className="hidden"
            data-testid="cover-file-input"
          />
        </div>

        {covers.length === 0 ? (
          <div className="p-8 rounded-xl border-2 border-dashed border-slate-700 text-center">
            <ImagePlus size={32} className="mx-auto text-gray-500 mb-2" />
            <p className="text-sm text-gray-400">Aucune photo de couverture</p>
            <p className="text-xs text-gray-500 mt-1">Jusqu&apos;à 3 photos affichées en carrousel sur votre page publique</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {covers.map((src, i) => (
              <div key={i} className="relative group rounded-xl overflow-hidden bg-slate-800 aspect-video" data-testid={`cover-slot-${i}`}>
                <img src={src} alt={`Cover ${i + 1}`} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-2">
                  <div className="flex gap-1">
                    {i > 0 && (
                      <button onClick={() => moveCover(i, -1)} data-testid={`cover-move-up-${i}`} className="p-1 rounded bg-white/20 hover:bg-white/30 backdrop-blur">
                        <ChevronUp size={14} className="text-white" />
                      </button>
                    )}
                    {i < covers.length - 1 && (
                      <button onClick={() => moveCover(i, 1)} data-testid={`cover-move-down-${i}`} className="p-1 rounded bg-white/20 hover:bg-white/30 backdrop-blur">
                        <ChevronDown size={14} className="text-white" />
                      </button>
                    )}
                  </div>
                  <button onClick={() => removeCover(i)} data-testid={`cover-remove-${i}`} className="p-1 rounded bg-red-500/80 hover:bg-red-600">
                    <X size={14} className="text-white" />
                  </button>
                </div>
                <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-bold">#{i + 1}</div>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-500 mt-2">JPG, PNG ou WebP · max 4 Mo par photo · carrousel automatique toutes les 5s</p>
      </div>

      {/* Catégories personnalisées */}
      <div className="mt-8">
        <label className="text-sm font-semibold text-gray-300 mb-3 block flex items-center gap-2">
          <Tag size={14} /> Mes catégories personnalisées
        </label>
        <p className="text-xs text-gray-500 mb-3">
          Ajoutez des catégories propres à votre restaurant (ex : Pizzas, Sushi, Ramen).
          Les catégories de base <em>Entrée, Plat, Boisson, Dessert, Petit-déj, Snack, Autre</em> sont toujours disponibles.
        </p>
        <div className="flex flex-wrap gap-2 mb-3" data-testid="custom-categories-list">
          {customCats.length === 0 && (
            <p className="text-xs text-gray-500 italic">Aucune catégorie personnalisée pour l&apos;instant.</p>
          )}
          {customCats.map((cat, i) => (
            <span key={i} data-testid={`custom-cat-chip-${i}`} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-sm text-white">
              {cat}
              <button onClick={() => removeCustomCat(i)} className="text-gray-400 hover:text-red-400" aria-label="Supprimer">
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newCatDraft}
            onChange={e => setNewCatDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomCat())}
            placeholder="Nouvelle catégorie…"
            data-testid="custom-cat-input"
            className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm"
            maxLength={40}
          />
          <button
            onClick={addCustomCat}
            disabled={!newCatDraft.trim()}
            data-testid="custom-cat-add-btn"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium disabled:opacity-50"
          >
            <Plus size={14} />
            Ajouter
          </button>
        </div>
      </div>
    </div>
  );
};

export default VendorProfileBranding;

