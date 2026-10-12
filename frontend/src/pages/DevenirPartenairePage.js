import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  ChevronLeft, Send, Store, Truck, ChefHat, UtensilsCrossed, MapPin, Phone, User, CheckCircle2
} from 'lucide-react';
import HemeleyLogo from '../HemeleyLogo';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const TYPES = [
  { value: 'street', label: 'Vendeur de rue', icon: ChefHat },
  { value: 'restaurant', label: 'Restaurant', icon: UtensilsCrossed },
  { value: 'foodtruck', label: 'Food truck', icon: Truck },
  { value: 'traiteur', label: 'Traiteur', icon: Store },
];

const ZONES = ['Bonapriso', 'Bonanjo', 'Akwa', 'Deido', 'Bonamoussadi', 'Bepanda', 'Makepe', 'Ndokotti', 'Logbessou', 'Kotto', 'Autre'];

const DevenirPartenairePage = () => {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    business_name: '',
    type: 'restaurant',
    zone: 'Akwa',
    description: '',
  });

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.business_name.trim()) {
      toast.error('Merci de renseigner nom, téléphone et nom du commerce');
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API}/public/partnership`, form);
      setSubmitted(true);
      toast.success(res.data.message || 'Demande envoyée !');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Erreur lors de l\'envoi');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4" data-testid="partnership-success">
        <div className="bg-white max-w-md w-full rounded-3xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 size={42} className="text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Demande envoyée !</h1>
          <p className="text-slate-600 mb-6">
            Merci pour votre intérêt. L'équipe HEMELEY vous contactera sous 48h
            au numéro WhatsApp <span className="font-semibold">{form.phone}</span>.
          </p>
          <button
            onClick={() => navigate('/')}
            data-testid="partnership-back-home"
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-full py-3"
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50" data-testid="partnership-page">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-4">
          <button onClick={() => navigate('/')} className="p-2 hover:bg-stone-100 rounded-full">
            <ChevronLeft size={22} />
          </button>
          <Link to="/" className="flex items-center gap-2"><HemeleyLogo size={32} /></Link>
          <div className="ml-auto text-sm text-slate-500">Partenaires HEMELEY</div>
        </div>
      </header>

      {!showForm ? (
        /* HERO */
        <section className="max-w-5xl mx-auto px-4 py-12 md:py-20">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <span className="inline-block bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-semibold mb-4">
                ✦ Programme Partenaire 2026
              </span>
              <h1 className="text-4xl md:text-5xl font-bold text-slate-900 leading-tight mb-4">
                Vendez plus.<br />
                <span className="text-orange-500">Vendez mieux.</span>
              </h1>
              <p className="text-lg text-slate-600 mb-6">
                Rejoignez le premier réseau de découverte de street food à Douala.
                Recevez des commandes sans gérer la livraison. Encaissez via Mobile Money.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  'Aucun frais d\'inscription',
                  'Commission unique de 15% par commande livrée',
                  'Wallet HEMELEY avec retrait Mobile Money',
                  'QR-code dédié pour votre menu en ligne',
                  'Visibilité gratuite sur l\'app',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2 text-slate-700">
                    <CheckCircle2 size={20} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => setShowForm(true)}
                data-testid="partnership-cta-rejoindre"
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-full px-8 py-4 text-lg shadow-lg hover:scale-105 transition-transform"
              >
                Nous rejoindre →
              </button>
            </div>
            <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-3xl p-8 text-white shadow-2xl">
              <div className="text-6xl mb-4">🍛</div>
              <h3 className="text-2xl font-bold mb-2">Plus de 200 vendeurs</h3>
              <p className="opacity-90 mb-6">font déjà confiance à HEMELEY pour booster leurs revenus.</p>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="bg-white/20 rounded-2xl p-4 backdrop-blur">
                  <div className="text-3xl font-bold">+42%</div>
                  <div className="text-xs opacity-80">revenus moyens</div>
                </div>
                <div className="bg-white/20 rounded-2xl p-4 backdrop-blur">
                  <div className="text-3xl font-bold">48h</div>
                  <div className="text-xs opacity-80">activation</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : (
        /* FORM */
        <section className="max-w-2xl mx-auto px-4 py-10">
          <div className="bg-white rounded-3xl shadow-lg p-6 md:p-10">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">Demande de partenariat</h2>
            <p className="text-slate-500 mb-6">Remplissez ce formulaire — réponse sous 48h via WhatsApp.</p>

            <form onSubmit={submit} className="space-y-5" data-testid="partnership-form">
              <Field label="Prénom & Nom" icon={User}>
                <input
                  data-testid="partnership-name"
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  placeholder="Marie Kamga"
                  className="w-full border-2 border-stone-200 rounded-xl px-4 py-3 focus:border-orange-500 focus:outline-none"
                />
              </Field>

              <Field label="Numéro WhatsApp" icon={Phone}>
                <input
                  data-testid="partnership-phone"
                  type="tel"
                  required
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  placeholder="237 6XX XXX XXX"
                  className="w-full border-2 border-stone-200 rounded-xl px-4 py-3 focus:border-orange-500 focus:outline-none"
                />
              </Field>

              <Field label="Nom du commerce" icon={Store}>
                <input
                  data-testid="partnership-business"
                  type="text"
                  required
                  value={form.business_name}
                  onChange={(e) => update('business_name', e.target.value)}
                  placeholder="Chez Marie"
                  className="w-full border-2 border-stone-200 rounded-xl px-4 py-3 focus:border-orange-500 focus:outline-none"
                />
              </Field>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Type d'activité</label>
                <div className="grid grid-cols-2 gap-3">
                  {TYPES.map((t) => {
                    const Icon = t.icon;
                    const active = form.type === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        data-testid={`partnership-type-${t.value}`}
                        onClick={() => update('type', t.value)}
                        className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${active ? 'border-orange-500 bg-orange-50' : 'border-stone-200 hover:border-orange-300'}`}
                      >
                        <Icon size={20} className={active ? 'text-orange-500' : 'text-slate-400'} />
                        <span className="font-medium text-slate-800 text-sm">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Field label="Zone d'activité" icon={MapPin}>
                <select
                  data-testid="partnership-zone"
                  value={form.zone}
                  onChange={(e) => update('zone', e.target.value)}
                  className="w-full border-2 border-stone-200 rounded-xl px-4 py-3 focus:border-orange-500 focus:outline-none bg-white"
                >
                  {ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
                </select>
              </Field>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Description courte de l'activité</label>
                <textarea
                  data-testid="partnership-description"
                  value={form.description}
                  onChange={(e) => update('description', e.target.value)}
                  placeholder="Cuisine camerounaise traditionnelle, ouvert 7j/7..."
                  rows={3}
                  className="w-full border-2 border-stone-200 rounded-xl px-4 py-3 focus:border-orange-500 focus:outline-none resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                data-testid="partnership-submit"
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-full py-4 inline-flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg"
              >
                <Send size={18} /> {loading ? 'Envoi en cours...' : 'Envoyer ma demande'}
              </button>
            </form>
          </div>
        </section>
      )}
    </div>
  );
};

const Field = ({ label, icon: Icon, children }) => (
  <div>
    <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
      {Icon && <Icon size={14} className="text-slate-400" />}
      {label}
    </label>
    {children}
  </div>
);

export default DevenirPartenairePage;
