import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { API } from '../MapUtils';

const OrderModal = ({ menu, onClose }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    pseudonym: '',
    comment: '',
    phone: '',
    email: '',
    order_type: 'commander',
    payment_method: 'orange'
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.pseudonym || !formData.phone) {
      toast.error('Veuillez remplir les champs obligatoires');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API}/orders`, {
        menu_id: menu.id,
        ...formData
      });

      toast.success('Commande créée avec succès!');
      navigate(`/confirmation/${response.data.id}`);
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de la création de la commande');
    } finally {
      setLoading(false);
    }
  };

  const amount = formData.order_type === 'commander' ? menu.price : menu.price * 0.1;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4" data-testid="order-modal">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-stone-200 p-4 flex items-center justify-between">
          <h2 className="font-heading text-2xl text-text" data-testid="order-modal-title">🔥 HEMELEY</h2>
          <button
            data-testid="close-order-modal-btn"
            onClick={onClose}
            className="text-text-muted hover:text-text"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="font-body font-medium text-text mb-2 block">Pseudonyme *</label>
            <input
              data-testid="order-pseudonym-input"
              type="text"
              required
              value={formData.pseudonym}
              onChange={(e) => setFormData({ ...formData, pseudonym: e.target.value })}
              className="w-full bg-white border-2 border-stone-200 rounded-xl px-4 py-3 focus:border-primary focus:outline-none font-body"
              placeholder="Votre pseudo"
            />
          </div>

          <div>
            <label className="font-body font-medium text-text mb-2 block">Qu&apos;est-ce que tu aimes sur ce plat ?</label>
            <textarea
              data-testid="order-comment-input"
              value={formData.comment}
              onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
              className="w-full bg-white border-2 border-stone-200 rounded-xl px-4 py-3 focus:border-primary focus:outline-none font-body"
              rows={3}
              placeholder="Votre commentaire..."
            />
          </div>

          <div>
            <label className="font-body font-medium text-text mb-2 block">Type de commande *</label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-4 border-2 border-stone-200 rounded-xl cursor-pointer hover:border-primary transition-colors">
                <input
                  data-testid="order-type-commander"
                  type="radio"
                  name="order_type"
                  value="commander"
                  checked={formData.order_type === 'commander'}
                  onChange={(e) => setFormData({ ...formData, order_type: e.target.value })}
                  className="w-5 h-5"
                />
                <div className="flex-1">
                  <p className="font-body font-medium text-text">Commander (100%)</p>
                  <p className="font-body text-sm text-text-muted">{menu.price.toLocaleString()} FCFA</p>
                </div>
              </label>
              <label className="flex items-center gap-3 p-4 border-2 border-stone-200 rounded-xl cursor-pointer hover:border-primary transition-colors">
                <input
                  data-testid="order-type-reserver"
                  type="radio"
                  name="order_type"
                  value="reserver"
                  checked={formData.order_type === 'reserver'}
                  onChange={(e) => setFormData({ ...formData, order_type: e.target.value })}
                  className="w-5 h-5"
                />
                <div className="flex-1">
                  <p className="font-body font-medium text-text">Réserver (10%)</p>
                  <p className="font-body text-sm text-text-muted">{(menu.price * 0.1).toLocaleString()} FCFA</p>
                </div>
              </label>
            </div>
          </div>

          <div>
            <label className="font-body font-medium text-text mb-2 block">Téléphone *</label>
            <input
              data-testid="order-phone-input"
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full bg-white border-2 border-stone-200 rounded-xl px-4 py-3 focus:border-primary focus:outline-none font-body"
              placeholder="6XXXXXXXX"
            />
          </div>

          <div>
            <label className="font-body font-medium text-text mb-2 block">Email (optionnel)</label>
            <input
              data-testid="order-email-input"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full bg-white border-2 border-stone-200 rounded-xl px-4 py-3 focus:border-primary focus:outline-none font-body"
              placeholder="votre@email.com"
            />
          </div>

          <div>
            <label className="font-body font-medium text-text mb-2 block">Méthode de paiement *</label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-4 border-2 border-stone-200 rounded-xl cursor-pointer hover:border-primary transition-colors">
                <input
                  data-testid="payment-method-orange"
                  type="radio"
                  name="payment_method"
                  value="orange"
                  checked={formData.payment_method === 'orange'}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  className="w-5 h-5"
                />
                <p className="font-body font-medium text-text">Orange Money</p>
              </label>
              <label className="flex items-center gap-3 p-4 border-2 border-stone-200 rounded-xl cursor-pointer hover:border-primary transition-colors">
                <input
                  data-testid="payment-method-mtn"
                  type="radio"
                  name="payment_method"
                  value="mtn"
                  checked={formData.payment_method === 'mtn'}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  className="w-5 h-5"
                />
                <p className="font-body font-medium text-text">MTN Mobile Money</p>
              </label>
            </div>
          </div>

          <div className="bg-accent/20 rounded-xl p-4 border-2 border-accent">
            <p className="font-body font-bold text-text mb-1">Total à payer</p>
            <p className="font-heading text-3xl text-primary" data-testid="order-total-amount">{amount.toLocaleString()} FCFA</p>
          </div>

          <button
            data-testid="submit-order-btn"
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white rounded-full py-4 font-heading text-xl tracking-wide shadow-lg hover:scale-105 active:scale-95 transition-transform disabled:opacity-50"
          >
            {loading ? 'Traitement...' : 'Continuer vers le paiement'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default OrderModal;
