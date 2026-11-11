import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import API from '../services/api';
import { useSocket } from './SocketContext';
import { isItemParcelEligible } from '../utils/categoryHelpers';

const CartContext = createContext(null);

const normalizeServiceType = (serviceType) =>
  String(serviceType || '').trim().toUpperCase() === 'PARCEL' ? 'PARCEL' : 'NORMAL';

const mergeDuplicateCartLines = (items = [], parcelEnabled = true) => {
  const mergedMap = new Map();
  for (const raw of items) {
    if (!raw || !raw.menuItem) continue;
    const itemEligible = raw.parcelEligible !== false && isItemParcelEligible(raw);
    const resolvedType =
      parcelEnabled && itemEligible ? normalizeServiceType(raw.serviceType) : 'NORMAL';
    const key = `${raw.menuItem}::${resolvedType}`;
    const qty = Math.max(1, Number(raw.quantity) || 1);

    if (mergedMap.has(key)) {
      const existing = mergedMap.get(key);
      mergedMap.set(key, {
        ...existing,
        parcelEligible: existing.parcelEligible !== false && itemEligible,
        quantity: existing.quantity + qty,
      });
    } else {
      mergedMap.set(key, {
        ...raw,
        parcelEligible: itemEligible,
        serviceType: resolvedType,
        quantity: qty,
      });
    }
  }
  return Array.from(mergedMap.values());
};

export const CartProvider = ({ children }) => {
  const { socket } = useSocket();
  const [cart, setCart] = useState([]);
  const [coupon, setCoupon] = useState(null); // { code, discountType, discountValue, discountAmount }
  const [couponError, setCouponError] = useState('');
  const [couponsEnabled, setCouponsEnabled] = useState(false);
  const [couponSettingsLoaded, setCouponSettingsLoaded] = useState(false);
  const [parcelEnabled, setParcelEnabled] = useState(true);
  const [parcelChargePerItem, setParcelChargePerItem] = useState(5);
  const [parcelSettingsLoaded, setParcelSettingsLoaded] = useState(false);

  // Load cart from localStorage on mount (normalize legacy entries without serviceType)
  useEffect(() => {
    const savedCart = localStorage.getItem('drs_cart');
    if (savedCart) {
      try {
        const parsed = JSON.parse(savedCart);
        if (Array.isArray(parsed)) {
          setCart(mergeDuplicateCartLines(parsed, true));
        }
      } catch (e) {
        console.error('Error parsing cart data', e);
        localStorage.removeItem('drs_cart');
      }
    }
  }, []);

  const applyParcelPayload = useCallback((data) => {
    if (!data) return;
    const enabled = data.parcelEnabled !== false;
    const charge = Number(data.parcelChargePerItem);
    setParcelEnabled(enabled);
    setParcelChargePerItem(Number.isFinite(charge) && charge >= 0 ? charge : 5);
    setParcelSettingsLoaded(true);

    if (!enabled) {
      setCart((prev) => {
        const hasParcel = prev.some((i) => normalizeServiceType(i.serviceType) === 'PARCEL');
        if (!hasParcel) return prev;
        const normalized = mergeDuplicateCartLines(prev, false);
        localStorage.setItem('drs_cart', JSON.stringify(normalized));
        return normalized;
      });
    }
  }, []);

  const refreshCouponSettings = useCallback(async () => {
    try {
      const res = await API.get('/coupons/settings');
      if (res.data?.success) {
        const enabled = res.data.data?.couponsEnabled !== false;
        setCouponsEnabled(enabled);
        if (!enabled) {
          setCoupon(null);
          setCouponError('');
        }
      }
    } catch {
      // Preserve current setting on transient network error
    } finally {
      setCouponSettingsLoaded(true);
    }
  }, []);

  const refreshParcelSettings = useCallback(async () => {
    try {
      const res = await API.get('/orders/parcel-settings');
      if (res.data?.success && res.data.data) {
        applyParcelPayload(res.data.data);
      }
    } catch {
      // Preserve current setting on transient network error
    } finally {
      setParcelSettingsLoaded(true);
    }
  }, [applyParcelPayload]);

  useEffect(() => {
    refreshCouponSettings();
    refreshParcelSettings();

    const refreshAll = () => {
      refreshCouponSettings();
      refreshParcelSettings();
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        refreshAll();
      }
    };

    window.addEventListener('focus', refreshAll);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    return () => {
      window.removeEventListener('focus', refreshAll);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [refreshCouponSettings, refreshParcelSettings]);

  // Real-time update when Admin toggles global coupons or parcel settings
  useEffect(() => {
    if (!socket) return;

    const handleSettingsUpdated = (data) => {
      if (typeof data?.couponsEnabled === 'boolean') {
        setCouponsEnabled(data.couponsEnabled);
        setCouponSettingsLoaded(true);
        if (!data.couponsEnabled) {
          setCoupon(null);
          setCouponError('');
        }
      }
    };

    const handleParcelUpdated = (data) => {
      applyParcelPayload(data);
    };

    socket.on('coupon:settingsUpdated', handleSettingsUpdated);
    socket.on('parcel:settingsUpdated', handleParcelUpdated);
    return () => {
      socket.off('coupon:settingsUpdated', handleSettingsUpdated);
      socket.off('parcel:settingsUpdated', handleParcelUpdated);
    };
  }, [socket, applyParcelPayload]);

  // Save cart to localStorage on changes
  const saveCart = (newCart) => {
    localStorage.setItem('drs_cart', JSON.stringify(newCart));
    setCart(newCart);
  };

  const addToCart = (item, quantityToAdd = 1, rawServiceType = 'NORMAL') => {
    const itemEligible = isItemParcelEligible(item);
    const resolvedType =
      parcelEnabled && itemEligible ? normalizeServiceType(rawServiceType) : 'NORMAL';
    const existingIndex = cart.findIndex(
      (i) => i.menuItem === item._id && normalizeServiceType(i.serviceType) === resolvedType
    );
    let newCart = [...cart];
    const imageUrl = (item.image && typeof item.image === 'object' ? item.image.url : item.image) || '';

    if (existingIndex > -1) {
      newCart[existingIndex] = {
        ...newCart[existingIndex],
        quantity: newCart[existingIndex].quantity + quantityToAdd,
        parcelEligible: itemEligible,
        serviceType: resolvedType,
      };
    } else {
      newCart.push({
        menuItem: item._id,
        name: item.name,
        price: item.price,
        quantity: quantityToAdd,
        serviceType: resolvedType,
        parcelEligible: itemEligible,
        emoji: item.emoji || '🍛',
        image: imageUrl,
      });
    }
    saveCart(newCart);
    removeCoupon(); // Reset coupon on cart change to enforce validations
  };

  const changeQuantity = (menuItemId, amount, rawServiceType = 'NORMAL') => {
    const requestedType = normalizeServiceType(rawServiceType);
    const newCart = cart
      .map((item) => {
        const itemType =
          parcelEnabled && item.parcelEligible !== false
            ? normalizeServiceType(item.serviceType)
            : 'NORMAL';
        if (item.menuItem === menuItemId && itemType === requestedType) {
          return { ...item, quantity: item.quantity + amount };
        }
        return item;
      })
      .filter((item) => item.quantity > 0);

    saveCart(newCart);
    removeCoupon();
  };

  const changeItemServiceType = (menuItemId, fromRawType, toRawType) => {
    const fromType = normalizeServiceType(fromRawType);
    const toType = parcelEnabled ? normalizeServiceType(toRawType) : 'NORMAL';
    if (fromType === toType) return;

    const updated = cart.map((item) => {
      const itemEligible = item.parcelEligible !== false && isItemParcelEligible(item);
      if (toType === 'PARCEL' && !itemEligible) {
        return item;
      }
      if (item.menuItem === menuItemId && normalizeServiceType(item.serviceType) === fromType) {
        return { ...item, parcelEligible: itemEligible, serviceType: toType };
      }
      return item;
    });

    saveCart(mergeDuplicateCartLines(updated, parcelEnabled));
    removeCoupon();
  };

  const removeFromCart = (menuItemId, rawServiceType = null) => {
    const newCart = cart.filter((item) => {
      if (item.menuItem !== menuItemId) return true;
      if (rawServiceType === null || rawServiceType === undefined) return false;
      return normalizeServiceType(item.serviceType) !== normalizeServiceType(rawServiceType);
    });
    saveCart(newCart);
    removeCoupon();
  };

  const getItemQuantity = (menuItemId, rawServiceType = null) => {
    return cart.reduce((acc, item) => {
      if (item.menuItem !== menuItemId) return acc;
      if (rawServiceType && normalizeServiceType(item.serviceType) !== normalizeServiceType(rawServiceType)) {
        return acc;
      }
      return acc + item.quantity;
    }, 0);
  };

  const clearCart = () => {
    saveCart([]);
    setCoupon(null);
    setCouponError('');
  };

  const foodSubtotal = Number(
    cart.reduce((acc, item) => acc + Number(item.price) * item.quantity, 0).toFixed(2)
  );
  const subtotal = foodSubtotal;

  const parcelChargeTotal = Number(
    cart
      .reduce((acc, item) => {
        const itemEligible = item.parcelEligible !== false && isItemParcelEligible(item);
        const isParcel = parcelEnabled && itemEligible && normalizeServiceType(item.serviceType) === 'PARCEL';
        return acc + (isParcel ? Number(parcelChargePerItem) * item.quantity : 0);
      }, 0)
      .toFixed(2)
  );

  const applyCouponCode = async (code) => {
    if (!couponsEnabled) {
      setCoupon(null);
      setCouponError('Coupons are currently disabled.');
      throw new Error('Coupons are currently disabled.');
    }

    try {
      setCouponError('');
      const response = await API.post('/coupons/validate', { code, subtotal });
      if (response.data?.success) {
        setCoupon(response.data.data);
        return response.data;
      }
    } catch (error) {
      const msg = error.response?.data?.message || 'Invalid coupon';
      if (error.response?.data?.couponsEnabled === false) {
        setCouponsEnabled(false);
      }
      setCouponError(msg);
      setCoupon(null);
      throw new Error(msg);
    }
  };

  const removeCoupon = () => {
    setCoupon(null);
    setCouponError('');
  };

  // Revalidate stock & category parcel eligibility before proceeding to payment
  const validateCartStock = async () => {
    try {
      if (cart.length === 0) return { valid: true };
      const ids = [...new Set(cart.map((i) => i.menuItem))];
      const response = await API.post('/menu/check', { ids });
      if (response.data?.success) {
        const menuItems = response.data.data;
        let eligibilityChanged = false;
        const syncedCart = cart.map((cartItem) => {
          const dbMatch = menuItems.find((i) => String(i._id) === String(cartItem.menuItem));
          if (!dbMatch) return cartItem;
          const eligible = dbMatch.parcelEligible !== false;
          if (cartItem.parcelEligible !== eligible || (!eligible && cartItem.serviceType === 'PARCEL')) {
            eligibilityChanged = true;
            return {
              ...cartItem,
              parcelEligible: eligible,
              serviceType: eligible ? cartItem.serviceType : 'NORMAL',
            };
          }
          return cartItem;
        });

        if (eligibilityChanged) {
          saveCart(mergeDuplicateCartLines(syncedCart, parcelEnabled));
        }

        for (const cartItem of syncedCart) {
          const matchingDbItem = menuItems.find((i) => String(i._id) === String(cartItem.menuItem));
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

  const discount = couponsEnabled && coupon ? coupon.discountAmount : 0;
  const total = Math.max(0, Number((foodSubtotal + parcelChargeTotal - discount).toFixed(2)));

  return (
    <CartContext.Provider
      value={{
        cart,
        coupon: couponsEnabled ? coupon : null,
        couponError,
        couponsEnabled,
        couponSettingsLoaded,
        refreshCouponSettings,
        parcelEnabled,
        parcelChargePerItem,
        parcelSettingsLoaded,
        refreshParcelSettings,
        foodSubtotal,
        parcelChargeTotal,
        subtotal,
        discount,
        total,
        addToCart,
        changeQuantity,
        changeItemServiceType,
        removeFromCart,
        getItemQuantity,
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
