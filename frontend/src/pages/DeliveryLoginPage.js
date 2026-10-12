import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Truck, Mail, Lock, Eye, EyeOff, RefreshCw, ArrowLeft, ChevronLeft, Phone, User } from 'lucide-react';
import { API } from '../MapUtils';

const DeliveryLoginPage = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    vehicle_type: 'moto'
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const payload = isLogin 
        ? { email: formData.email, password: formData.password, role: 'delivery' }
        : { ...formData, role: 'delivery' };
      
      const response = await axios.post(`${API}${endpoint}`, payload);
      
      localStorage.setItem('delivery_token', response.data.token);
      localStorage.setItem('delivery_data', JSON.stringify(response.data.user));
      
      toast.success(isLogin ? 'Connexion réussie!' : 'Compte créé avec succès!');
      navigate('/delivery/dashboard');
    } catch (error) {
      console.error('Error:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de l\'authentification');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary to-primary/80 p-6 flex items-center justify-center">
      
      <div className="w-full max-w-md">
        <button
          onClick={() => navigate('/')}
          className="mb-6 flex items-center gap-2 text-white/80 hover:text-white font-body font-medium"
        >
          <ChevronLeft size={20} />
          Retour
        </button>

        <div className="bg-white rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Truck size={40} className="text-primary" />
            </div>
            <h1 className="font-heading text-3xl text-text mb-2" data-testid="delivery-auth-title">Espace Livreur</h1>
            <p className="font-body text-text-muted">
              {isLogin ? 'Connectez-vous pour commencer' : 'Rejoignez l\'équipe HEMELEY'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div>
                  <label className="font-body font-medium text-text mb-2 block">Nom complet</label>
                  <input
                    data-testid="delivery-name-input"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-stone-50 border-2 border-stone-200 rounded-xl px-4 py-3 focus:border-primary focus:bg-white focus:outline-none font-body transition-all"
                    placeholder="Ex: Paul Nkeng"
                  />
                </div>

                <div>
                  <label className="font-body font-medium text-text mb-2 block">Téléphone</label>
                  <input
                    data-testid="delivery-phone-input"
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-stone-50 border-2 border-stone-200 rounded-xl px-4 py-3 focus:border-primary focus:bg-white focus:outline-none font-body transition-all"
                    placeholder="6XXXXXXXX"
                  />
                </div>

                <div>
                  <label className="font-body font-medium text-text mb-2 block">Type de véhicule</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'moto', label: 'Moto', icon: '🏍️' },
                      { id: 'velo', label: 'Vélo', icon: '🚲' }
                    ].map(v => (
                      <label 
                        key={v.id}
                        className={`flex items-center justify-center gap-2 p-4 border-2 rounded-xl cursor-pointer transition-all ${formData.vehicle_type === v.id ? 'border-primary bg-primary/5' : 'border-stone-200 hover:border-primary/50'}`}
                      >
                        <input
                          type="radio"
                          name="vehicle_type"
                          value={v.id}
                          checked={formData.vehicle_type === v.id}
                          onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                          className="hidden"
                        />
                        <span className="text-2xl">{v.icon}</span>
                        <span className="font-body font-medium">{v.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="font-body font-medium text-text mb-2 block">Email</label>
              <input
                data-testid="delivery-email-input"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-stone-50 border-2 border-stone-200 rounded-xl px-4 py-3 focus:border-primary focus:bg-white focus:outline-none font-body transition-all"
                placeholder="votre@email.com"
              />
            </div>

            <div>
              <label className="font-body font-medium text-text mb-2 block">Mot de passe</label>
              <div className="relative">
                <input
                  data-testid="delivery-password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full bg-stone-50 border-2 border-stone-200 rounded-xl px-4 py-3 focus:border-primary focus:bg-white focus:outline-none font-body transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              data-testid="delivery-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white rounded-full py-4 font-heading text-xl tracking-wide shadow-lg hover:scale-105 active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw size={20} className="animate-spin" />
                  Chargement...
                </>
              ) : (
                isLogin ? 'Se connecter' : 'Créer mon compte'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary font-body font-medium hover:underline"
            >
              {isLogin ? 'Devenir livreur HEMELEY' : 'Déjà un compte ? Connectez-vous'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeliveryLoginPage;
