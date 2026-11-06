import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import API from '../services/api';
import ThermalReceiptModal from '../components/common/ThermalReceiptModal';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Printer,
  Sparkles,
  RefreshCw,
  User,
  Phone,
  GraduationCap,
  CreditCard,
  Banknote,
  QrCode,
  CheckCircle2,
  AlertCircle,
  X,
  Receipt,
  RotateCcw,
  Clock,
  Layers,
  ArrowRight,
} from 'lucide-react';

const POSBilling = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Search & Category Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [vegOnly, setVegOnly] = useState(false);

  // Billing Cart State
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' | 'upi' | 'card'

  // Walk-in Customer State
  const [customer, setCustomer] = useState({
    name: 'Walk-in Customer',
    phone: '',
    registerNumber: '',
    staffId: '',
  });

  // Submission & Receipt Modal State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastCreatedOrder, setLastCreatedOrder] = useState(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [toastNotification, setToastNotification] = useState(null);

  const searchInputRef = useRef(null);

  // Fetch menu and categories on mount
  useEffect(() => {
    fetchInitialData();
  }, []);

  // Keyboard shortcut listener ('/' focuses search)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setError('');
      const [menuRes, catRes] = await Promise.all([
        API.get('/menu'),
        API.get('/categories').catch(() => ({ data: { data: [] } })),
      ]);

      if (menuRes.data?.success) {
        setMenuItems(menuRes.data.data || []);
      }
      if (catRes.data?.success) {
        setCategories(catRes.data.data || []);
      }
    } catch (err) {
      console.error('POS data fetch error:', err);
      setError(err.response?.data?.message || 'Failed to load menu items for counter POS.');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type = 'success') => {
    setToastNotification({ message, type });
    setTimeout(() => {
      setToastNotification(null);
    }, 4000);
  };

  // Filtered Menu Items
  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      // Category filter
      if (selectedCategory !== 'ALL') {
        const catId = typeof item.category === 'object' ? item.category?._id : item.category;
        const catName = typeof item.category === 'object' ? item.category?.name : '';
        if (catId !== selectedCategory && catName !== selectedCategory) {
          return false;
        }
      }

      // Veg filter
      if (vegOnly && !item.isVeg) {
        return false;
      }

      // Search text filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.name?.toLowerCase().includes(q);
        const matchesCategory = typeof item.category === 'object' && item.category?.name?.toLowerCase().includes(q);
        return matchesName || matchesCategory;
      }

      return true;
    });
  }, [menuItems, selectedCategory, vegOnly, searchQuery]);

  // Cart operations
  const addToCart = (item) => {
    if (!item.available) {
      showToast(`"${item.name}" is currently sold out!`, 'error');
      return;
    }

    setCart((prev) => {
      const existing = prev.find((i) => i.menuItem === item._id);
      if (existing) {
        return prev.map((i) =>
          i.menuItem === item._id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          menuItem: item._id,
          name: item.name,
          price: Number(item.price),
          quantity: 1,
          isVeg: item.isVeg,
          emoji: item.emoji || '🍛',
          image: item.image?.url || '',
        },
      ];
    });
  };

  const updateQuantity = (menuItemId, delta) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.menuItem === menuItemId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const removeFromCart = (menuItemId) => {
    setCart((prev) => prev.filter((i) => i.menuItem !== menuItemId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
    setCustomer({
      name: 'Walk-in Customer',
      phone: '',
      registerNumber: '',
      staffId: '',
    });
  };

  // Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    const val = Number(discount) || 0;
    return Math.max(0, Math.min(subtotal, val));
  }, [subtotal, discount]);

  const grandTotal = useMemo(() => {
    return Math.max(0, subtotal - discountAmount);
  }, [subtotal, discountAmount]);

  const totalCartCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  // Handle Checkout & Print
  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      showToast('Billing cart is empty! Add food items to proceed.', 'error');
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        items: cart.map((i) => ({
          menuItem: i.menuItem,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
        })),
        paymentMethod,
        paymentStatus: 'paid', // Counter POS sales are collected immediately
        walkInCustomer: {
          name: customer.name.trim() || 'Walk-in Customer',
          phone: customer.phone.trim(),
          registerNumber: customer.registerNumber.trim(),
          staffId: customer.staffId.trim(),
        },
        discount: discountAmount,
      };

      const response = await API.post('/admin/pos/orders', payload);

      if (response.data?.success) {
        const order = response.data.data;
        setLastCreatedOrder(order);
        setReceiptModalOpen(true);
        clearCart();
        showToast(
          `✓ Sale Complete! Token #${order.pickupToken || order.orderCode} generated for ₹${order.total}.`,
          'success'
        );
      }
    } catch (err) {
      console.error('POS Sale creation error:', err);
      showToast(err.response?.data?.message || 'Failed to complete sale.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100/70 pb-20 font-inter text-text">
      
      {/* Toast Notification */}
      {toastNotification && (
        <div className="fixed top-20 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border bg-white animate-in slide-in-from-top-2 text-xs font-bold transition-all">
          {toastNotification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          )}
          <span className="text-stone-800">{toastNotification.message}</span>
        </div>
      )}

      {/* Thermal Receipt Modal (for instant print & reprint) */}
      <ThermalReceiptModal
        order={lastCreatedOrder}
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        autoPrint={true}
      />

      {/* Top POS Action & Status Bar */}
      <div className="bg-[#0b3d2e] text-white px-4 py-3 shadow-md border-b border-white/10 sticky top-16 z-30">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber flex items-center justify-center text-primary-dark font-black text-lg shadow-sm">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-outfit font-black text-base sm:text-lg tracking-tight">
                  POS Counter Billing
                </h1>
                <span className="bg-amber/20 border border-amber/40 text-amber text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                  Fast Sales
                </span>
              </div>
              <p className="text-[11px] text-white/70">
                Direct walk-in counter purchases • Zero student login needed
              </p>
            </div>
          </div>

          {/* Quick links & Last Order Callout */}
          <div className="flex items-center gap-2.5">
            {lastCreatedOrder && (
              <div className="hidden sm:flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/10 px-3 py-1.5 rounded-xl text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>
                  Last Token: <strong className="text-amber">#{lastCreatedOrder.pickupToken}</strong> (₹{lastCreatedOrder.total})
                </span>
                <button
                  onClick={() => setReceiptModalOpen(true)}
                  className="ml-1 text-[11px] bg-amber text-stone-950 font-bold px-2 py-0.5 rounded hover:bg-amber-light transition"
                  title="Reprint last receipt"
                >
                  Reprint
                </button>
              </div>
            )}

            <Link
              to="/admin/handover"
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition border border-white/10"
            >
              <span>Handover Queue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>

            <Link
              to="/admin/bills"
              className="flex items-center gap-1.5 bg-amber hover:bg-amber-dark text-stone-950 font-bold text-xs px-3.5 py-2 rounded-xl transition shadow-sm"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Bill Archive</span>
            </Link>
          </div>

        </div>
      </div>

      {/* Main POS Split Layout */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-5">
        <div className="flex flex-col lg:flex-row gap-5 items-start">
          
          {/* ================= LEFT PANEL: FOOD CATALOG (65%) ================= */}
          <div className="w-full lg:w-[63%] flex flex-col gap-4">
            
            {/* Search & Filter Bar */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200 flex flex-col sm:flex-row items-center gap-3">
              {/* Search input */}
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search food by name... (Press '/' to focus)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-[#0b3d2e] focus:bg-white transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-0.5"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Veg Only toggle */}
              <button
                type="button"
                onClick={() => setVegOnly(!vegOnly)}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold border transition ${
                  vegOnly
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                    : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                }`}
              >
                <span className="w-3 h-3 rounded-full border border-emerald-600 flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                </span>
                <span>Veg Only</span>
              </button>

              {/* Reload Menu */}
              <button
                type="button"
                onClick={fetchInitialData}
                disabled={loading}
                className="p-2.5 text-stone-500 hover:text-[#0b3d2e] hover:bg-stone-100 rounded-xl transition border border-stone-200"
                title="Refresh Menu Catalog"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-all ${
                  selectedCategory === 'ALL'
                    ? 'bg-[#0b3d2e] text-white shadow-sm'
                    : 'bg-white text-stone-600 hover:bg-stone-50 border border-stone-200'
                }`}
              >
                All Items ({menuItems.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat._id}
                  type="button"
                  onClick={() => setSelectedCategory(cat._id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-all ${
                    selectedCategory === cat._id
                      ? 'bg-[#0b3d2e] text-white shadow-sm'
                      : 'bg-white text-stone-600 hover:bg-stone-50 border border-stone-200'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Menu Items Grid */}
            {loading ? (
              <div className="py-20 text-center bg-white rounded-3xl border border-stone-200">
                <div className="w-10 h-10 border-4 border-stone-200 border-t-[#0b3d2e] rounded-full animate-spin mx-auto mb-3" />
                <span className="text-stone-500 text-xs font-bold uppercase tracking-wider">
                  Loading food items...
                </span>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="py-16 text-center bg-white rounded-3xl border border-stone-200 p-6">
                <div className="text-3xl mb-2">🍽</div>
                <h3 className="font-outfit font-bold text-stone-800 text-base mb-1">
                  No food items found
                </h3>
                <p className="text-stone-500 text-xs max-w-sm mx-auto">
                  No items match the current search or category filter.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredItems.map((item) => {
                  const cartItem = cart.find((i) => i.menuItem === item._id);
                  const isAdded = Boolean(cartItem);

                  return (
                    <div
                      key={item._id}
                      onClick={() => item.available && addToCart(item)}
                      className={`group relative bg-white rounded-2xl p-3 border transition-all duration-150 flex flex-col justify-between select-none cursor-pointer ${
                        !item.available
                          ? 'opacity-50 cursor-not-allowed border-stone-200 bg-stone-50'
                          : isAdded
                          ? 'border-[#0b3d2e] shadow-md ring-2 ring-[#0b3d2e]/20'
                          : 'border-stone-200 hover:border-[#0b3d2e]/50 hover:shadow-md'
                      }`}
                    >
                      {/* Top Badges */}
                      <div className="flex items-center justify-between mb-2">
                        {/* Veg / Non-Veg Indicator */}
                        <div
                          className={`w-3.5 h-3.5 border rounded-sm flex items-center justify-center ${
                            item.isVeg ? 'border-emerald-600' : 'border-rose-600'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              item.isVeg ? 'bg-emerald-600' : 'bg-rose-600'
                            }`}
                          />
                        </div>

                        {/* Cart quantity tag if already in cart */}
                        {isAdded && (
                          <span className="bg-[#0b3d2e] text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs">
                            {cartItem.quantity} in cart
                          </span>
                        )}

                        {!item.available && (
                          <span className="bg-red-100 text-red-700 text-[9px] font-bold px-1.5 py-0.5 rounded">
                            Sold Out
                          </span>
                        )}
                      </div>

                      {/* Food Image / Emoji */}
                      <div className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-stone-100 mb-2 flex items-center justify-center">
                        {item.image?.url ? (
                          <img
                            src={item.image.url}
                            alt={item.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            loading="lazy"
                          />
                        ) : (
                          <span className="text-3xl">{item.emoji || '🍛'}</span>
                        )}
                      </div>

                      {/* Details */}
                      <div>
                        <h4 className="font-outfit font-bold text-xs sm:text-sm text-stone-900 leading-snug line-clamp-2">
                          {item.name}
                        </h4>
                        
                        <div className="flex items-center justify-between mt-2 pt-1 border-t border-stone-100">
                          <span className="font-outfit font-black text-sm text-[#0b3d2e]">
                            ₹{Number(item.price).toFixed(2)}
                          </span>

                          <button
                            type="button"
                            disabled={!item.available}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (item.available) addToCart(item);
                            }}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black transition-all ${
                              !item.available
                                ? 'bg-stone-200 text-stone-400'
                                : 'bg-amber text-stone-950 hover:bg-amber-dark active:scale-90 shadow-xs'
                            }`}
                            title="Add 1 to cart"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

          </div>

          {/* ================= RIGHT PANEL: BILLING CART & CHECKOUT (37%) ================= */}
          <div className="w-full lg:w-[37%] sticky top-28">
            <div className="bg-white rounded-3xl shadow-xl border border-stone-200 p-4 sm:p-5 flex flex-col gap-4">
              
              {/* Cart Header */}
              <div className="flex items-center justify-between pb-3 border-b border-stone-200">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber/20 text-[#0b3d2e] flex items-center justify-center font-bold">
                    <ShoppingCart className="w-4 h-4 text-[#0b3d2e]" />
                  </div>
                  <div>
                    <h3 className="font-outfit font-black text-sm text-stone-900 leading-none">
                      Counter Cart
                    </h3>
                    <span className="text-[11px] text-stone-500 font-medium">
                      {totalCartCount} item(s) selected
                    </span>
                  </div>
                </div>

                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={clearCart}
                    className="flex items-center gap-1 text-[11px] font-bold text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-lg transition"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                )}
              </div>

              {/* Customer Info Form (Quick inputs) */}
              <div className="bg-stone-50 rounded-2xl p-3 border border-stone-200/80 space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500 flex items-center justify-between">
                  <span>Customer Details (Optional)</span>
                  <span className="text-[10px] lowercase font-normal">defaults to Walk-in</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Customer Name"
                      value={customer.name}
                      onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                      className="w-full pl-8 pr-2 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#0b3d2e]"
                    />
                  </div>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      placeholder="Phone (optional)"
                      value={customer.phone}
                      onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                      className="w-full pl-8 pr-2 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#0b3d2e]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Reg No (Student)"
                    value={customer.registerNumber}
                    onChange={(e) => setCustomer({ ...customer, registerNumber: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-[11px] font-semibold focus:outline-none focus:border-[#0b3d2e]"
                  />
                  <input
                    type="text"
                    placeholder="Staff ID (Faculty)"
                    value={customer.staffId}
                    onChange={(e) => setCustomer({ ...customer, staffId: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-[11px] font-semibold focus:outline-none focus:border-[#0b3d2e]"
                  />
                </div>
              </div>

              {/* Cart Items List */}
              <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 divide-y divide-stone-100">
                {cart.length === 0 ? (
                  <div className="py-8 text-center text-stone-400">
                    <ShoppingCart className="w-8 h-8 mx-auto mb-2 stroke-1 opacity-50" />
                    <p className="text-xs font-bold text-stone-500">Cart is empty</p>
                    <p className="text-[10px] text-stone-400">Click food items on the left to add</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={item.menuItem} className="pt-2 first:pt-0 flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${item.isVeg ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                          <h4 className="font-bold text-xs text-stone-900 truncate">
                            {item.name}
                          </h4>
                        </div>
                        <span className="text-[10px] text-stone-500 font-medium">
                          ₹{item.price.toFixed(2)} each
                        </span>
                      </div>

                      {/* Quantity buttons */}
                      <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.menuItem, -1)}
                          className="w-5 h-5 rounded bg-white text-stone-700 flex items-center justify-center hover:bg-stone-200 transition"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-5 text-center font-black text-xs font-mono">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.menuItem, 1)}
                          className="w-5 h-5 rounded bg-white text-stone-700 flex items-center justify-center hover:bg-stone-200 transition"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Total */}
                      <div className="text-right w-16">
                        <span className="font-outfit font-black text-xs text-stone-900">
                          ₹{(item.price * item.quantity).toFixed(2)}
                        </span>
                      </div>

                      {/* Remove */}
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.menuItem)}
                        className="text-stone-400 hover:text-red-500 p-1 transition"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-1.5 pt-2 border-t border-stone-200">
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                  Payment Mode
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold border transition ${
                      paymentMethod === 'cash'
                        ? 'bg-[#0b3d2e] text-white border-[#0b3d2e] shadow-xs'
                        : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    <span>Cash</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('upi')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold border transition ${
                      paymentMethod === 'upi'
                        ? 'bg-[#0b3d2e] text-white border-[#0b3d2e] shadow-xs'
                        : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>UPI QR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-bold border transition ${
                      paymentMethod === 'card'
                        ? 'bg-[#0b3d2e] text-white border-[#0b3d2e] shadow-xs'
                        : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Card</span>
                  </button>
                </div>
              </div>

              {/* Discount Input */}
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-stone-600 font-semibold">Special Discount (₹):</span>
                <input
                  type="number"
                  min="0"
                  max={subtotal}
                  value={discount || ''}
                  placeholder="0"
                  onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                  className="w-20 px-2 py-1 bg-stone-50 border border-stone-200 rounded-lg text-right font-mono font-bold text-xs focus:outline-none focus:border-[#0b3d2e]"
                />
              </div>

              {/* Bill Totals Summary */}
              <div className="bg-stone-50 p-3 rounded-2xl border border-stone-200 space-y-1.5">
                <div className="flex justify-between text-xs text-stone-600 font-medium">
                  <span>Subtotal</span>
                  <span className="font-mono font-bold">₹{subtotal.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-xs text-emerald-600 font-bold">
                    <span>Discount</span>
                    <span className="font-mono">−₹{discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-stone-200 pt-1.5 flex items-baseline justify-between">
                  <span className="font-outfit font-black text-sm uppercase text-stone-900">
                    Grand Total
                  </span>
                  <span className="font-outfit font-black text-2xl text-[#0b3d2e]">
                    ₹{grandTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Primary Action Button: Complete & Print */}
              <button
                type="button"
                disabled={cart.length === 0 || isSubmitting}
                onClick={handleCompleteSale}
                className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-stone-950 font-black text-sm py-3.5 px-4 rounded-2xl shadow-lg shadow-amber-500/25 active:scale-[0.98] transition-all"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-stone-950 border-t-transparent rounded-full animate-spin" />
                    <span>Processing Sale...</span>
                  </>
                ) : (
                  <>
                    <Printer className="w-5 h-5" />
                    <span>⚡ Complete Sale & Print Bill (₹{grandTotal.toFixed(2)})</span>
                  </>
                )}
              </button>

            </div>
          </div>

        </div>
      </div>

    </div>
  );
};

export default POSBilling;

