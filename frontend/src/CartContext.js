import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

const CartContext = createContext();

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
};

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState(() => {
    // Load cart from localStorage
    const savedCart = localStorage.getItem('hemeley_cart');
    return savedCart ? JSON.parse(savedCart) : { items: [], total: 0 };
  });

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('hemeley_cart', JSON.stringify(cart));
  }, [cart]);

  const addToCart = (menu, quantity = 1) => {
    setCart(prevCart => {
      const existingItemIndex = prevCart.items.findIndex(item => item.menu_id === menu.id);
      
      let newItems;
      if (existingItemIndex >= 0) {
        // Update quantity
        newItems = [...prevCart.items];
        newItems[existingItemIndex].quantity += quantity;
        newItems[existingItemIndex].subtotal = newItems[existingItemIndex].quantity * newItems[existingItemIndex].price;
      } else {
        // Add new item
        newItems = [...prevCart.items, {
          menu_id: menu.id,
          menu_name: menu.name,
          price: menu.price,
          quantity: quantity,
          subtotal: menu.price * quantity,
          vendor_id: menu.vendor_id,
          vendor_name: menu.vendor_name,
          image_base64: menu.image_base64,
          zone: menu.zone
        }];
      }
      
      const total = newItems.reduce((sum, item) => sum + item.subtotal, 0);
      
      toast.success(`${menu.name} ajouté au panier !`);
      
      return { items: newItems, total };
    });
  };

  const removeFromCart = (menu_id) => {
    setCart(prevCart => {
      const newItems = prevCart.items.filter(item => item.menu_id !== menu_id);
      const total = newItems.reduce((sum, item) => sum + item.subtotal, 0);
      
      toast.info('Article retiré du panier');
      
      return { items: newItems, total };
    });
  };

  const updateQuantity = (menu_id, quantity) => {
    if (quantity <= 0) {
      removeFromCart(menu_id);
      return;
    }
    
    setCart(prevCart => {
      const newItems = prevCart.items.map(item => {
        if (item.menu_id === menu_id) {
          return {
            ...item,
            quantity,
            subtotal: item.price * quantity
          };
        }
        return item;
      });
      
      const total = newItems.reduce((sum, item) => sum + item.subtotal, 0);
      
      return { items: newItems, total };
    });
  };

  const clearCart = useCallback(() => {
    setCart({ items: [], total: 0 });
    localStorage.removeItem('hemeley_cart');
    toast.info('Panier vidé');
  }, []);

  const getItemCount = () => {
    return cart.items.reduce((sum, item) => sum + item.quantity, 0);
  };

  const value = {
    cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getItemCount
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
