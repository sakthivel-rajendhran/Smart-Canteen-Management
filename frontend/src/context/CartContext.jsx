import React, { createContext, useState, useEffect, useContext } from 'react';
import API from '../services/api';

const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState([]);
  const [coupon, setCoupon] = useState(null); // { code, discountType, discountValue, discountAmount }
  const [couponError, setCouponError] = useState('');

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('drs_cart');
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {
        console.error('Error parsing cart data', e);
        localStorage.removeItem('drs_cart');
      }
    }
  }, []);

  // Save cart to localStorage on changes
  const saveCart = (newCart) => {
    localStorage.setItem('drs_cart', JSON.stringify(newCart));
    setCart(newCart);
  };

  const addToCart = (item, quantityToAdd = 1) => {
    const existingIndex = cart.findIndex((i) => i.menuItem === item._id);
    let newCart = [...cart];
    const imageUrl = (item.image && typeof item.image === 'object' ? item.image.url : item.image) || '';

    if (existingIndex > -1) {
      newCart[existingIndex].quantity += quantityToAdd;
    } else {
      newCart.push({
        menuItem: item._id,
        name: item.name,
        price: item.price,
        quantity: quantityToAdd,
        emoji: item.emoji || '🍛',
        image: imageUrl,
      });
    }
    saveCart(newCart);
    removeCoupon(); // Reset coupon on cart change to enforce validations
  };

  const changeQuantity = (menuItemId, amount) => {
    let newCart = cart.map((item) => {
      if (item.menuItem === menuItemId) {
        return { ...item, quantity: item.quantity + amount };
      }
      return item;
    }).filter((item) => item.quantity > 0);

    saveCart(newCart);
    removeCoupon();
  };

  const removeFromCart = (menuItemId) => {
    const newCart = cart.filter((item) => item.menuItem !== menuItemId);
    saveCart(newCart);
    removeCoupon();
  };

  const clearCart = () => {
    saveCart([]);
    setCoupon(null);
    setCouponError('');
  };

  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

  const applyCouponCode = async (code) => {
    try {
      setCouponError('');
      const response = await API.post('/coupons/validate', { code, subtotal });
      if (response.data?.success) {
        setCoupon(response.data.data);
        return response.data;
      }
    } catch (error) {
      const msg = error.response?.data?.message || 'Invalid coupon';
      setCouponError(msg);
      setCoupon(null);
      throw new Error(msg);
    }
  };

  const removeCoupon = () => {
    setCoupon(null);
    setCouponError('');
  };

  // Revalidate stock availability before proceeding to payment
  const validateCartStock = async () => {
    try {
      const response = await API.get('/menu');
      if (response.data?.success) {
        const menuItems = response.data.data;
        for (const cartItem of cart) {
          const matchingDbItem = menuItems.find((i) => i._id === cartItem.menuItem);
          if (!matchingDbItem) {
            return { valid: false, message: `"${cartItem.name}" is no longer available. Please remove it.` };
          }
          if (!matchingDbItem.available) {
            return { valid: false, message: `"${cartItem.name}" is sold out. Please remove it.` };
          }
        }
        return { valid: true };
      }
      return { valid: false, message: 'Stock verification failed' };
    } catch (e) {
      return { valid: false, message: 'Connection error during stock verification' };
    }
  };

  const discount = coupon ? coupon.discountAmount : 0;
  const total = Math.max(0, subtotal - discount);

  return (
    <CartContext.Provider
      value={{
        cart,
        coupon,
        couponError,
        subtotal,
        discount,
        total,
        addToCart,
        changeQuantity,
        removeFromCart,
        clearCart,
        applyCouponCode,
        removeCoupon,
        validateCartStock,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
