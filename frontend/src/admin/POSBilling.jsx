import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import API from '../services/api';
import { useSocket } from '../context/SocketContext';
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
  Banknote,
  QrCode,
  CheckCircle2,
  AlertCircle,
  X,
  Receipt,
  RotateCcw,
} from 'lucide-react';

const POSBilling = () => {
  const { socket } = useSocket();
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
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' | 'upi'
  const [cashGiven, setCashGiven] = useState('');

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

  // Real-time synchronization for category updates/renames
  useEffect(() => {
    if (!socket) return;

    const handleCategoryCreated = (newCat) => {
      if (newCat.active === false) return;
      setCategories((prev) =>
        prev.some((c) => c._id === newCat._id)
          ? prev
          : [...prev, newCat].sort((a, b) => a.name.localeCompare(b.name))
      );
    };

    const handleCategoryUpdated = (updatedCat) => {
      setCategories((prev) => {
        if (updatedCat.active === false) {
          return prev.filter((c) => c._id !== updatedCat._id);
        }
        const exists = prev.some((c) => c._id === updatedCat._id);
        const updated = exists
          ? prev.map((c) => (c._id === updatedCat._id ? updatedCat : c))
          : [...prev, updatedCat];
        return updated.sort((a, b) => a.name.localeCompare(b.name));
      });

      if (updatedCat.active === false) {
        setSelectedCategory((prev) => (prev === updatedCat._id ? 'ALL' : prev));
      }

      setMenuItems((prev) =>
        prev.map((item) =>
          item.category?._id === updatedCat._id
            ? {
                ...item,
                category: {
                  ...item.category,
                  name: updatedCat.name,
                  active: updatedCat.active,
                },
              }
            : item
        )
      );
    };

    const handleCategoryDeleted = ({ id }) => {
      setCategories((prev) => prev.filter((c) => c._id !== id));
      setSelectedCategory((prev) => (prev === id ? 'ALL' : prev));
    };

    socket.on('category:created', handleCategoryCreated);
    socket.on('category:updated', handleCategoryUpdated);
    socket.on('category:deleted', handleCategoryDeleted);

    return () => {
      socket.off('category:created', handleCategoryCreated);
      socket.off('category:updated', handleCategoryUpdated);
      socket.off('category:deleted', handleCategoryDeleted);
    };
  }, [socket]);

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
        API.get('/menu?activeCategoriesOnly=true'),
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

  // Exclude items in inactive categories
  const activeMenuItems = useMemo(() => {
    return menuItems.filter((item) => item.category && item.category.active !== false);
  }, [menuItems]);

  // Filtered Menu Items
  const filteredItems = useMemo(() => {
    return activeMenuItems.filter((item) => {
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
  }, [activeMenuItems, selectedCategory, vegOnly, searchQuery]);

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
    setCashGiven('');
    setPaymentMethod('cash');
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

  // Handle Checkout: Confirm Payment & Generate Physical Thermal Bill
  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      showToast('Billing cart is empty! Add food items to proceed.', 'error');
      return;
    }

    if (isSubmitting) return; // Prevent duplicate clicks

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
        paymentStatus: 'paid', // Counter POS sales are strictly collected before completing
        walkInCustomer: {
          name: 'Walk-in Customer',
          phone: '',
          registerNumber: '',
          staffId: '',
        },
        discount: discountAmount,
      };

      const response = await API.post('/admin/pos/orders', payload);

      if (response.data?.success) {
        const order = response.data.data;
        setLastCreatedOrder(order);
        // Open receipt modal for preview. autoPrint is set to false so browser print dialog only opens when clicked
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
    <div className="min-h-screen lg:h-[calc(100vh-4rem)] flex flex-col bg-stone-100/70 font-inter text-text lg:overflow-hidden">
      
      {/* Custom Thin Scrollbar Styles for Independent Paneling */}
      <style>{`
        .pos-independent-scroll::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .pos-independent-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .pos-independent-scroll::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.16);
          border-radius: 9999px;
        }
        .pos-independent-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.32);
        }
      `}</style>

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

      {/* Thermal Receipt Modal (strictly manual print upon explicit click, autoPrint disabled) */}
      <ThermalReceiptModal
        order={lastCreatedOrder}
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        autoPrint={false}
      />

      {/* ================= TOP POS ACTION & STATUS BAR ================= */}
      <div className="shrink-0 bg-[#0b3d2e] text-white px-4 py-2.5 shadow-md border-b border-white/10 z-20">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber flex items-center justify-center text-primary-dark font-black text-base shadow-sm">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-outfit font-black text-sm sm:text-base tracking-tight leading-none">
                  POS Counter Billing
                </h1>
                <span className="bg-amber/20 border border-amber/40 text-amber text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                  Direct Billing
                </span>
              </div>
              <p className="text-[10px] text-white/70 mt-0.5">
                Select Food → Confirm Payment → Print Physical Thermal Bill → Completed
              </p>
            </div>
          </div>

          {/* Quick links & Last Order Callout for safe reprinting */}
          <div className="flex items-center gap-2">
            {lastCreatedOrder && (
              <div className="flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/10 px-3 py-1.5 rounded-xl text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  Last Bill: <strong className="text-amber">#{lastCreatedOrder.pickupToken || lastCreatedOrder.orderCode}</strong> (₹{lastCreatedOrder.total})
                </span>
                <button
                  type="button"
                  onClick={() => setReceiptModalOpen(true)}
                  className="ml-1 text-[10px] bg-amber text-stone-950 font-bold px-2.5 py-0.5 rounded hover:bg-amber-light transition shadow-2xs flex items-center gap-1 active:scale-95"
                  title="Reprint last bill without creating duplicate"
                >
                  <Printer className="w-3 h-3" />
                  <span>Reprint Bill</span>
                </button>
              </div>
            )}

            <Link
              to="/admin/bills"
              className="flex items-center gap-1.5 bg-amber hover:bg-amber-dark text-stone-950 font-bold text-xs px-3 py-1.5 rounded-xl transition shadow-xs"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Bill Archive</span>
            </Link>
          </div>

        </div>
      </div>

      {/* ================= MAIN POS TWO-COLUMN SPLIT WORKSPACE ================= */}
      <div className="flex-1 min-h-0 max-w-7xl mx-auto w-full p-3 sm:p-4 pb-20 lg:pb-3 flex flex-col lg:flex-row gap-4 overflow-hidden">
        
        {/* ================= LEFT SECTION: FOOD MENU CATALOG ================= */}
        <div className="w-full lg:w-[62%] xl:w-[65%] flex flex-col h-full min-h-0 bg-white/40 lg:bg-transparent rounded-3xl">
          
          {/* Top Filter Controls (Sticky/Fixed within Left Panel) */}
          <div className="shrink-0 space-y-2.5 pb-2.5">
            
            {/* Search bar & Veg toggle */}
            <div className="bg-white rounded-2xl p-3 shadow-xs border border-stone-200 flex flex-col sm:flex-row items-center gap-2.5">
              {/* Search input */}
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search food by name... (Press '/' to focus)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:border-[#0b3d2e] focus:bg-white transition"
                />
                {searchQuery && (
                  <button
                    type="button"
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
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition shrink-0 ${
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
                className="p-2 text-stone-500 hover:text-[#0b3d2e] hover:bg-stone-100 rounded-xl transition border border-stone-200 shrink-0"
                title="Refresh Menu Catalog"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Category Pills Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                  selectedCategory === 'ALL'
                    ? 'bg-[#0b3d2e] text-white shadow-xs'
                    : 'bg-white text-stone-600 hover:bg-stone-50 border border-stone-200'
                }`}
              >
                All Items ({activeMenuItems.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat._id}
                  type="button"
                  onClick={() => setSelectedCategory(cat._id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                    selectedCategory === cat._id
                      ? 'bg-[#0b3d2e] text-white shadow-xs'
                      : 'bg-white text-stone-600 hover:bg-stone-50 border border-stone-200'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

          </div>

          {/* Independent Scrolling Food Grid Area */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1.5 pos-independent-scroll">
            {loading ? (
              <div className="py-24 text-center bg-white rounded-3xl border border-stone-200">
                <div className="w-10 h-10 border-4 border-stone-200 border-t-[#0b3d2e] rounded-full animate-spin mx-auto mb-3" />
                <span className="text-stone-500 text-xs font-bold uppercase tracking-wider">
                  Loading food items...
                </span>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="py-20 text-center bg-white rounded-3xl border border-stone-200 p-6">
                <div className="text-3xl mb-2">🍽</div>
                <h3 className="font-outfit font-bold text-stone-800 text-base mb-1">
                  No food items found
                </h3>
                <p className="text-stone-500 text-xs max-w-sm mx-auto">
                  No items match the current search or category filter.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4 gap-3 pb-3">
                {filteredItems.map((item) => {
                  const cartItem = cart.find((i) => i.menuItem === item._id);
                  const isAdded = Boolean(cartItem);

                  return (
                    <div
                      key={item._id}
                      onClick={() => item.available && addToCart(item)}
                      className={`group relative bg-white rounded-2xl p-2.5 sm:p-3 border transition-all duration-150 flex flex-col justify-between select-none cursor-pointer ${
                        !item.available
                          ? 'opacity-50 cursor-not-allowed border-stone-200 bg-stone-50'
                          : isAdded
                          ? 'border-[#0b3d2e] shadow-md ring-2 ring-[#0b3d2e]/20'
                          : 'border-stone-200 hover:border-[#0b3d2e]/50 hover:shadow-md'
                      }`}
                    >
                      {/* Top Badges */}
                      <div className="flex items-center justify-between mb-1.5">
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
                          <span className="bg-[#0b3d2e] text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-2xs">
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
                                : 'bg-amber text-stone-950 hover:bg-amber-dark active:scale-90 shadow-2xs'
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

        </div>

        {/* ================= RIGHT SECTION: COUNTER CART (INDEPENDENT SCROLL) ================= */}
        <div className="w-full lg:w-[38%] xl:w-[35%] flex flex-col h-full min-h-0">
          
          <div className="bg-white rounded-3xl shadow-xl border border-stone-200 p-4 flex flex-col h-full min-h-0">
            
            {/* Cart Header (Shrink-0) */}
            <div className="shrink-0 flex items-center justify-between pb-3 border-b border-stone-200">
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
                  className="flex items-center gap-1 text-[11px] font-bold text-red-600 hover:text-red-700 hover:bg-red-50 px-2.5 py-1 rounded-lg transition"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Cart</span>
                </button>
              )}
            </div>

            {/* Cart Items List (Independent Scrolling) */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain py-2.5 space-y-2 pr-1.5 divide-y divide-stone-100 pos-independent-scroll">
              {cart.length === 0 ? (
                <div className="h-full min-h-[140px] flex flex-col items-center justify-center text-center text-stone-400 p-4">
                  <ShoppingCart className="w-9 h-9 mx-auto mb-2 stroke-1 opacity-40 text-stone-400" />
                  <p className="text-xs font-bold text-stone-600">Counter Cart is Empty</p>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    Click any food item on the left to add to bill
                  </p>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.menuItem} className="pt-2 first:pt-0 flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${item.isVeg ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                        <h4 className="font-bold text-xs text-stone-900 truncate">
                          {item.name}
                        </h4>
                      </div>
                      <span className="text-[10px] text-stone-500 font-medium ml-3.5">
                        ₹{item.price.toFixed(2)} each
                      </span>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-xl shrink-0">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.menuItem, -1)}
                        className="w-5 h-5 rounded bg-white text-stone-700 flex items-center justify-center hover:bg-stone-200 transition shadow-2xs"
                        title="Decrease quantity"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-5 text-center font-black text-xs font-mono">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.menuItem, 1)}
                        className="w-5 h-5 rounded bg-white text-stone-700 flex items-center justify-center hover:bg-stone-200 transition shadow-2xs"
                        title="Increase quantity"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Item Total */}
                    <div className="text-right w-16 shrink-0">
                      <span className="font-outfit font-black text-xs text-stone-900">
                        ₹{(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.menuItem)}
                      className="text-stone-400 hover:text-red-500 p-1 transition shrink-0"
                      title="Remove item from cart"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Cart Footer Controls (Shrink-0) */}
            <div className="shrink-0 pt-2.5 border-t border-stone-200 space-y-2.5">
              
              {/* Payment Mode Selection (Cash vs UPI QR) */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-stone-500 block">
                  Select Payment Method
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-black border transition-all ${
                      paymentMethod === 'cash'
                        ? 'bg-[#0b3d2e] text-white border-[#0b3d2e] shadow-xs'
                        : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    <Banknote className="w-4 h-4 text-amber" />
                    <span>Cash Payment</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('upi')}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-black border transition-all ${
                      paymentMethod === 'upi'
                        ? 'bg-[#0b3d2e] text-white border-[#0b3d2e] shadow-xs'
                        : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    <QrCode className="w-4 h-4 text-amber" />
                    <span>UPI QR Code</span>
                  </button>
                </div>
              </div>

              {/* Cash Given & Change Helper (Visible when Cash selected) */}
              {paymentMethod === 'cash' && grandTotal > 0 && (
                <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-2.5 space-y-1.5 animate-in fade-in text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-stone-700">Cash Received from Customer:</span>
                    <div className="relative w-28">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-bold text-stone-500">₹</span>
                      <input
                        type="number"
                        min="0"
                        value={cashGiven}
                        onChange={(e) => setCashGiven(e.target.value)}
                        placeholder={grandTotal.toFixed(0)}
                        className="w-full pl-6 pr-2 py-1 bg-white border border-stone-300 rounded-lg text-right font-mono font-bold text-xs focus:outline-none focus:border-[#0b3d2e]"
                      />
                    </div>
                  </div>

                  {Number(cashGiven) > 0 && Number(cashGiven) >= grandTotal && (
                    <div className="bg-emerald-100/80 border border-emerald-300 text-emerald-900 rounded-xl px-2.5 py-1.5 flex items-center justify-between font-bold">
                      <span>Change to Return:</span>
                      <span className="font-mono text-sm font-black text-emerald-950">
                        ₹{(Number(cashGiven) - grandTotal).toFixed(2)}
                      </span>
                    </div>
                  )}

                  {Number(cashGiven) > 0 && Number(cashGiven) < grandTotal && (
                    <div className="bg-rose-100/80 border border-rose-300 text-rose-800 rounded-xl px-2.5 py-1 flex items-center justify-between text-[11px] font-bold">
                      <span>Short by:</span>
                      <span className="font-mono">
                        ₹{(grandTotal - Number(cashGiven)).toFixed(2)}
                      </span>
                    </div>
                  )}

                  {/* Quick Cash Suggestions */}
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] text-stone-500 font-bold">Quick:</span>
                    <button
                      type="button"
                      onClick={() => setCashGiven(String(grandTotal))}
                      className="px-2 py-0.5 bg-white border border-stone-200 hover:border-amber-500 rounded text-[10px] font-mono font-bold text-stone-700 transition"
                    >
                      ₹{grandTotal.toFixed(0)} (Exact)
                    </button>
                    {[50, 100, 200, 500].filter((val) => val > grandTotal).map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setCashGiven(String(val))}
                        className="px-2 py-0.5 bg-white border border-stone-200 hover:border-amber-500 rounded text-[10px] font-mono font-bold text-stone-700 transition"
                      >
                        ₹{val}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* UPI QR Display Interface (Visible when UPI selected) */}
              {paymentMethod === 'upi' && (
                <div className="bg-emerald-50/90 border border-emerald-300 rounded-2xl p-2.5 space-y-2 animate-in fade-in">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 bg-white p-1 rounded-xl border border-emerald-200 shadow-xs flex items-center justify-center shrink-0">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                          `upi://pay?pa=drsquickserve@canteen&pn=DRS%20Quick%20Serve&am=${grandTotal.toFixed(
                            2
                          )}&cu=INR`
                        )}`}
                        alt="UPI QR Code"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-black uppercase text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                          Scan & Pay
                        </span>
                        <span className="text-xs font-outfit font-black text-emerald-950">
                          ₹{grandTotal.toFixed(2)}
                        </span>
                      </div>
                      <p className="text-[10px] text-stone-600 font-medium mt-0.5 truncate">
                        GPay • PhonePe • Paytm • BHIM
                      </p>
                      <div className="text-[9px] font-mono text-stone-500 mt-0.5">
                        UPI: <strong>drsquickserve@canteen</strong>
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] text-emerald-800 bg-emerald-100/60 rounded-lg p-1.5 text-center font-semibold">
                    Customer scans QR & pays • Verify confirmation on counter soundbox / phone
                  </div>
                </div>
              )}

              {/* Discount Input & Subtotal */}
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-stone-500 font-semibold">Special Discount (₹):</span>
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
              <div className="bg-stone-50 p-2.5 rounded-2xl border border-stone-200 space-y-1">
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
                <div className="border-t border-stone-200 pt-1 flex items-baseline justify-between">
                  <span className="font-outfit font-black text-xs uppercase text-stone-900 tracking-wider">
                    Grand Total
                  </span>
                  <span className="font-outfit font-black text-2xl text-[#0b3d2e]">
                    ₹{grandTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Primary Action Button: Confirm Payment & Print Thermal Bill */}
              <button
                type="button"
                disabled={cart.length === 0 || isSubmitting}
                onClick={handleCompleteSale}
                className="w-full flex items-center justify-center gap-2 bg-[#0b3d2e] hover:bg-[#1a7a45] disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-sm py-3.5 px-4 rounded-2xl shadow-lg active:scale-[0.98] transition-all"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Confirming Payment & Generating Bill...</span>
                  </>
                ) : (
                  <>
                    <Printer className="w-4.5 h-4.5 text-amber" />
                    <span>
                      {paymentMethod === 'cash' ? 'Confirm Cash & Print Bill' : 'Confirm UPI & Print Bill'}{' '}
                      (₹{grandTotal.toFixed(2)})
                    </span>
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
