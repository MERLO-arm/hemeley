import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import HemeleyLogo from './HemeleyLogo';
import SEO from './components/SEO';
import { 
  ChevronRight, Star, Package, Users, BarChart3, QrCode, 
  Clock, CreditCard, Bell, Settings, FileText, MessageSquare,
  TrendingUp, Shield, Smartphone, Globe, CheckCircle, ArrowRight,
  Play, ChefHat, Store, Utensils
} from 'lucide-react';

// Vendor testimonials data
const testimonials = [
  {
    id: 1,
    name: "Mama Ngono",
    business: "Restaurant Mama Ngono",
    role: "Propriétaire",
    image: "https://images.unsplash.com/photo-1687422808278-d17b09489ed1?w=150&h=150&fit=crop&crop=face",
    rating: 5,
    text: "Avec HEMELEY, j'ai pu digitaliser mon restaurant et tripler mes ventes en seulement 3 mois. La gestion des commandes est devenue tellement simple ! Je recommande vivement."
  },
  {
    id: 2,
    name: "Paul Atangana",
    business: "Chez Paulo Grillades",
    role: "Gérant",
    image: "https://images.unsplash.com/photo-1748518146559-a596d5b3a016?w=150&h=150&fit=crop&crop=face",
    rating: 5,
    text: "Honnêtement, vraiment satisfait ! Le système de QR code pour les tables a révolutionné mon service. Les clients commandent directement depuis leur table. L'équipe support est au top !"
  },
  {
    id: 3,
    name: "Marie-Claire Essomba",
    business: "Saveurs du Cameroun",
    role: "CEO",
    image: "https://images.unsplash.com/photo-1687422808248-f807f4ea2a2e?w=150&h=150&fit=crop&crop=face",
    rating: 5,
    text: "HEMELEY nous a permis d'avoir une visibilité incroyable sur nos ventes et nos clients. Les rapports détaillés m'aident à prendre les meilleures décisions pour mon business."
  }
];

// Features data
const features = [
  {
    icon: Package,
    title: "Gestion des Menus",
    description: "Gérez facilement vos plats, prix, et portions. Ajoutez des photos, modifiez la disponibilité en un clic.",
    color: "bg-orange-100 text-orange-600"
  },
  {
    icon: BarChart3,
    title: "Statistiques",
    description: "Suivez vos ventes, revenus et tendances avec des graphiques interactifs et des rapports détaillés.",
    color: "bg-blue-100 text-blue-600"
  },
  {
    icon: QrCode,
    title: "QR Codes Tables",
    description: "Générez des QR codes uniques pour chaque table. Vos clients commandent directement depuis leur smartphone.",
    color: "bg-green-100 text-green-600"
  },
  {
    icon: Bell,
    title: "Notifications",
    description: "Recevez des alertes instantanées pour chaque nouvelle commande. Ne manquez plus aucune vente.",
    color: "bg-purple-100 text-purple-600"
  },
  {
    icon: CreditCard,
    title: "Paiements Mobile",
    description: "Acceptez les paiements Orange Money et MTN Mobile Money. Encaissez rapidement et en toute sécurité.",
    color: "bg-amber-100 text-amber-600"
  },
  {
    icon: FileText,
    title: "Rapports PDF/Excel",
    description: "Exportez vos données en PDF ou Excel. Analysez vos performances et gérez votre comptabilité facilement.",
    color: "bg-pink-100 text-pink-600"
  }
];

// Stats data
const stats = [
  { value: "500+", label: "Vendeurs actifs" },
  { value: "15K+", label: "Commandes/mois" },
  { value: "9.5/10", label: "Satisfaction" },
  { value: "50M+", label: "FCFA générés" }
];

// Vendor avatars for social proof
const vendorAvatars = [
  "https://images.unsplash.com/photo-1687422808278-d17b09489ed1?w=60&h=60&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1748518146559-a596d5b3a016?w=60&h=60&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1687422808248-f807f4ea2a2e?w=60&h=60&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1687422808259-565a84e31cd0?w=60&h=60&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1687422808204-6892507bb8d9?w=60&h=60&fit=crop&crop=face"
];

const VendorLandingPage = () => {
  const navigate = useNavigate();
  const [activeTestimonial, setActiveTestimonial] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTestimonial(prev => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      <SEO
        title="Devenir Partenaire Restaurateur & Digitaliser ses Ventes"
        description="Rejoignez Hemeley à Douala. Équipez votre établissement de QR codes de table, recevez des commandes en ligne et encaissez directement via Orange Money & MTN MoMo."
        path="/vendor"
      />
      {/* Header */}
      <header className="sticky top-0 bg-white/90 backdrop-blur-md z-50 border-b border-orange-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <HemeleyLogo size={34} />
            </Link>
            
            <nav className="hidden md:flex items-center gap-8">
              <a href="#fonctionnalites" className="text-gray-600 hover:text-orange-600 transition-colors">Fonctionnalités</a>
              <a href="#temoignages" className="text-gray-600 hover:text-orange-600 transition-colors">Avis</a>
              <a href="#communaute" className="text-gray-600 hover:text-orange-600 transition-colors">Communauté</a>
            </nav>

            <div className="flex items-center gap-3">
              <Link 
                to="/vendor/login" 
                className="text-orange-600 hover:text-orange-700 font-medium transition-colors"
              >
                Connexion
              </Link>
              <button 
                onClick={() => navigate('/vendor/login', { state: { register: true } })}
                className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-5 py-2.5 rounded-full font-medium hover:shadow-lg hover:shadow-orange-200 transition-all flex items-center gap-2"
                data-testid="vendor-landing-signup-btn"
              >
                Inscription <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="space-y-8">
              <div className="space-y-4">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
                  Le <span className="text-orange-500">système tout-en-un</span>
                  <br />pour
                  <br />
                  <span className="relative">
                    Gérer votre Restaurant
                    <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none">
                      <path d="M2 8 Q75 2 150 8 T298 8" stroke="#F97316" strokeWidth="4" strokeLinecap="round" fill="none"/>
                    </svg>
                  </span>
                </h1>
                <p className="text-lg text-gray-600 max-w-lg">
                  Rejoignez les <strong>500+ restaurateurs</strong> de Douala qui ont choisi HEMELEY pour digitaliser leur activité et augmenter leurs ventes.
                </p>
              </div>

              {/* Social Proof */}
              <div className="flex items-center gap-4">
                <div className="flex -space-x-3">
                  {vendorAvatars.map((avatar, i) => (
                    <img 
                      key={i}
                      src={avatar} 
                      alt={`Vendeur ${i+1}`}
                      className="w-12 h-12 rounded-full border-3 border-white object-cover shadow-md"
                    />
                  ))}
                  <div className="w-12 h-12 rounded-full bg-orange-500 border-3 border-white flex items-center justify-center text-white font-bold text-sm shadow-md">
                    +500
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={18} className="fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-sm text-gray-600">9.5/10 satisfaction</p>
                </div>
              </div>

              {/* CTA */}
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={() => navigate('/vendor/login', { state: { register: true } })}
                  className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-8 py-4 rounded-full font-semibold text-lg hover:shadow-xl hover:shadow-orange-200 transition-all flex items-center justify-center gap-2 group"
                  data-testid="vendor-landing-cta-btn"
                >
                  Essayer gratuitement
                  <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </button>
                <button className="flex items-center justify-center gap-2 px-6 py-4 border-2 border-gray-200 rounded-full font-medium text-gray-700 hover:border-orange-300 hover:bg-orange-50 transition-all">
                  <Play size={20} className="text-orange-500" />
                  Voir la démo
                </button>
              </div>

              <p className="text-sm text-gray-500">
                Bénéficiez de <strong>7 jours d'essai gratuit</strong> et sans engagement
              </p>
            </div>

            {/* Right Content - Dashboard Preview */}
            <div className="relative">
              {/* Browser mockup */}
              <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100">
                <div className="bg-gray-100 px-4 py-3 flex items-center gap-2">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                    <div className="w-3 h-3 rounded-full bg-green-400"></div>
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="bg-white rounded-lg px-4 py-1 text-sm text-gray-500 flex items-center gap-2">
                      <Globe size={14} />
                      hemeley.com
                    </div>
                  </div>
                </div>
                
                {/* Dashboard Preview */}
                <div className="p-6 bg-gradient-to-br from-gray-50 to-white">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="font-bold text-lg">Bienvenue, Mama Ngono!</h3>
                      <p className="text-sm text-gray-500">Voici ce qui se passe chez Restaurant Mama Ngono</p>
                    </div>
                    <div className="flex items-center gap-2 bg-orange-100 text-orange-600 px-3 py-1.5 rounded-full text-sm font-medium">
                      <CheckCircle size={16} />
                      Compte vérifié
                    </div>
                  </div>

                  {/* Stats Cards */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                      <p className="text-2xl font-bold text-gray-900">2.5M</p>
                      <p className="text-xs text-gray-500">FCFA</p>
                      <p className="text-sm text-gray-600 mt-1">Ventes totales</p>
                      <p className="text-xs text-green-600 font-medium">+24.5% ce mois</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                      <p className="text-2xl font-bold text-gray-900">156</p>
                      <p className="text-sm text-gray-600 mt-1">Commandes</p>
                      <p className="text-xs text-green-600 font-medium">+12 aujourd'hui</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                      <p className="text-2xl font-bold text-gray-900">89</p>
                      <p className="text-sm text-gray-600 mt-1">Clients</p>
                      <p className="text-xs text-green-600 font-medium">+8 cette semaine</p>
                    </div>
                  </div>

                  {/* Chart Preview */}
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <p className="font-medium text-gray-700">Ventes cette semaine</p>
                      <select className="text-sm border rounded-lg px-2 py-1">
                        <option>Cette semaine</option>
                      </select>
                    </div>
                    <div className="h-24 flex items-end gap-2">
                      {[40, 65, 45, 80, 55, 90, 75].map((h, i) => (
                        <div key={i} className="flex-1 bg-gradient-to-t from-orange-500 to-orange-400 rounded-t-lg transition-all hover:from-orange-600 hover:to-orange-500" style={{ height: `${h}%` }}></div>
                      ))}
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-gray-500">
                      <span>Lun</span><span>Mar</span><span>Mer</span><span>Jeu</span><span>Ven</span><span>Sam</span><span>Dim</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating cards */}
              <div className="absolute -right-8 top-20 bg-white rounded-xl shadow-lg p-4 border border-gray-100 animate-float hidden lg:block">
                <p className="text-sm font-medium text-gray-700 mb-2">Manage your <span className="text-orange-500">orders</span></p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  12 nouvelles commandes
                </div>
              </div>

              <div className="absolute -left-8 bottom-20 bg-white rounded-xl shadow-lg p-4 border border-gray-100 animate-float-delayed hidden lg:block">
                <p className="text-sm font-medium text-gray-700 mb-2">Manage your <span className="text-orange-500">customers</span></p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold text-xs">WD</div>
                  <div>
                    <p className="text-xs font-medium">Wilfried Djopa</p>
                    <p className="text-xs text-gray-500">Client fidèle</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-orange-100/50 to-transparent -z-10"></div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-white border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-3xl sm:text-4xl font-bold text-orange-600">{stat.value}</p>
                <p className="text-gray-600 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial Quote */}
      <section className="py-16 bg-orange-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="text-5xl text-orange-300 font-serif mb-4">"</div>
          <p className="text-xl sm:text-2xl text-gray-700 italic leading-relaxed">
            Maintenant, je peux savoir comment se porte mon entreprise. Plus besoin de papier et de stylo.
          </p>
          <div className="mt-6 flex items-center justify-center gap-4">
            <img 
              src={testimonials[0].image} 
              alt={testimonials[0].name}
              className="w-14 h-14 rounded-full object-cover border-3 border-white shadow-md"
            />
            <div className="text-left">
              <p className="font-semibold text-gray-900">{testimonials[0].name}</p>
              <p className="text-sm text-gray-500">{testimonials[0].business}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="fonctionnalites" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Quelques <span className="text-orange-500">fonctionnalités</span> qui rendent HEMELEY unique
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Des outils puissants et simples pour gérer votre restaurant comme un pro
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <div 
                key={i} 
                className="group p-6 rounded-2xl border border-gray-100 hover:border-orange-200 hover:shadow-xl hover:shadow-orange-100/50 transition-all cursor-pointer"
              >
                <div className={`w-14 h-14 rounded-xl ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <feature.icon size={28} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-gradient-to-b from-white to-orange-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <ChefHat className="text-orange-500" size={24} />
                <span className="text-orange-600 font-medium">Dépasser les frontières</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-8">
                Suivez tous les détails de votre entreprise pour <span className="text-orange-500">booster votre activité</span>
              </h2>

              <div className="space-y-8">
                <div className="flex gap-4 p-4 rounded-xl border-2 border-dashed border-orange-200 bg-orange-50/50">
                  <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold shrink-0">1</div>
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">Trouvez tous vos documents en <span className="text-orange-500">un seul endroit</span></h3>
                    <p className="text-gray-600 text-sm">Obtenez des informations sur votre santé financière en consultant des rapports et des résumés détaillés.</p>
                  </div>
                </div>

                <div className="flex gap-4 p-4">
                  <div className="w-8 h-8 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center font-bold shrink-0">2</div>
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">Visualisez toutes vos statistiques par période</h3>
                    <p className="text-gray-600 text-sm">Suivez vos ventes, stocks, clients et fournisseurs en un seul endroit.</p>
                  </div>
                </div>

                <div className="flex gap-4 p-4">
                  <div className="w-8 h-8 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center font-bold shrink-0">3</div>
                  <div>
                    <h3 className="font-bold text-gray-900 mb-1">Utilisez les outils marketing pour vendre plus</h3>
                    <p className="text-gray-600 text-sm">Améliorez la fidélisation de vos clients avec des campagnes ciblées.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right side - Dashboard preview */}
            <div className="relative">
              <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white">
                    <BarChart3 size={24} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">127.50K <span className="text-sm font-normal text-gray-500">FCFA</span></p>
                    <p className="text-sm text-gray-500">Balance cette semaine</p>
                  </div>
                </div>

                <div className="h-32 bg-gradient-to-r from-orange-100 to-pink-100 rounded-xl mb-4 flex items-end justify-center pb-4">
                  <div className="w-3/4 h-20 bg-gradient-to-t from-pink-400 to-pink-300 rounded-t-xl"></div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-500">Bilan comptable</p>
                    <p className="font-semibold">Consultez vos rapports</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-500">Balance générale</p>
                    <p className="font-semibold">Vue d'ensemble</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="temoignages" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-sm text-gray-500 italic mb-2">What they say about us</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Ce que nos <span className="text-orange-500">clients adorés</span> pensent de nous
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, i) => (
              <div 
                key={testimonial.id}
                className={`p-6 rounded-2xl transition-all ${
                  i === activeTestimonial 
                    ? 'bg-gray-900 text-white scale-105 shadow-2xl' 
                    : 'bg-white border border-gray-100 hover:border-orange-200 hover:shadow-lg'
                }`}
              >
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, j) => (
                    <Star 
                      key={j} 
                      size={16} 
                      className={i === activeTestimonial ? 'fill-yellow-400 text-yellow-400' : 'fill-yellow-400 text-yellow-400'} 
                    />
                  ))}
                </div>
                <p className={`mb-6 leading-relaxed ${i === activeTestimonial ? 'text-gray-300' : 'text-gray-600'}`}>
                  {testimonial.text}
                </p>
                <div className="flex items-center gap-3">
                  <img 
                    src={testimonial.image} 
                    alt={testimonial.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div>
                    <p className={`font-semibold ${i === activeTestimonial ? 'text-white' : 'text-gray-900'}`}>
                      {testimonial.name}
                    </p>
                    <p className={`text-sm ${i === activeTestimonial ? 'text-gray-400' : 'text-gray-500'}`}>
                      {testimonial.role} - {testimonial.business}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Partner logos */}
          <div className="mt-16 text-center">
            <p className="text-sm text-gray-500 mb-6">Ils nous font confiance</p>
            <div className="flex items-center justify-center gap-8 flex-wrap opacity-60 grayscale">
              {['Restaurant Mama', "Chez Paulo", 'Saveurs du Cameroun', 'Grillades Express', 'Le Petit Douala'].map((name, i) => (
                <div key={i} className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full">
                  <Store size={18} />
                  <span className="text-sm font-medium">{name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Community Section */}
      <section id="communaute" className="py-20 bg-gradient-to-r from-orange-500 to-orange-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Rejoignez la communauté HEMELEY</h2>
          <p className="text-orange-100 mb-12 max-w-2xl">
            Devenez membre de notre communauté pour nous aider à grandir. Vous pouvez cliquer sur n'importe quelle case ici pour rejoindre le groupe ou nous contacter.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: "Groupe de Feedback", subtitle: "Envoyez-nous vos avis", icon: MessageSquare },
              { title: "Newsletter", subtitle: "Restez informés", icon: Bell },
              { title: "Aide & Support", subtitle: "Recevez toute l'aide", icon: Shield },
              { title: "Affiliation", subtitle: "Gagnez de l'argent", icon: TrendingUp }
            ].map((item, i) => (
              <div 
                key={i}
                className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 hover:bg-white/20 transition-all cursor-pointer group"
              >
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <item.icon size={24} />
                </div>
                <h3 className="font-bold mb-1">{item.title}</h3>
                <p className="text-orange-100 text-sm mb-4">{item.subtitle}</p>
                <ArrowRight size={20} className="opacity-50 group-hover:opacity-100 group-hover:translate-x-2 transition-all" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Envie de tester <span className="text-orange-500">HEMELEY</span> ?
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Créez un compte et découvrez comment nous pouvons vous aider à développer votre entreprise.
            <br />
            <strong>Vous avez le droit de tout essayer, de tout modifier et de tout supprimer.</strong>
          </p>
          
          <button 
            onClick={() => navigate('/vendor/login', { state: { register: true } })}
            className="relative bg-gradient-to-r from-orange-500 to-orange-600 text-white px-10 py-5 rounded-full font-semibold text-lg hover:shadow-2xl hover:shadow-orange-200 transition-all group"
            data-testid="vendor-landing-final-cta"
          >
            <span className="flex items-center gap-2">
              Commencer gratuitement
              <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" />
            </span>
            {/* Decorative arrow */}
            <svg className="absolute -top-8 -left-8 w-12 h-12 text-orange-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="mb-4">
                <HemeleyLogo size={36} variant="dark" />
              </div>
              <p className="text-gray-400 text-sm">
                La plateforme #1 pour les restaurateurs de Douala. Gérez votre business simplement.
              </p>
            </div>

            <div>
              <h4 className="font-bold mb-4">Liens</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#fonctionnalites" className="hover:text-white transition-colors">Fonctionnalités</a></li>
                <li><a href="#temoignages" className="hover:text-white transition-colors">Témoignages</a></li>
                <li><a href="#communaute" className="hover:text-white transition-colors">Communauté</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4">Légal</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Conditions d'utilisation</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Politique de confidentialité</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4">Contact</h4>
              <ul className="space-y-2 text-gray-400">
                <li>contact@hemeley.com</li>
                <li>+237 6XX XXX XXX</li>
                <li>Douala, Cameroun</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-gray-400 text-sm">© 2024 HEMELEY. Tous droits réservés.</p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">FR Français</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Custom styles for animations */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        .animate-float-delayed {
          animation: float 3s ease-in-out infinite;
          animation-delay: 1.5s;
        }
      `}</style>
    </div>
  );
};

export default VendorLandingPage;
