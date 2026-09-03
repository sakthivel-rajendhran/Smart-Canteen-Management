import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import API from '../services/api';
import io from 'socket.io-client';
import FoodCard from '../components/food/FoodCard';
import FoodDetailModal from '../components/food/FoodDetailModal';
import {
  Search,
  HelpCircle,
  AlertCircle,
  ShoppingCart,
  Sparkles,
  CheckCircle2,
  Filter,
  X,
} from 'lucide-react';

const Menu = () => {
  const { cart, addToCart, changeQuantity } = useCart();

  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Active filter states
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [onlyFeatured, setOnlyFeatured] = useState(false);

  // Modal detail state
  const [selectedFood, setSelectedFood] = useState(null);

  // Debounced search query
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    fetchData();

    // Setup Socket.IO for real-time menu synchronization
    const socketUrl = `${window.location.protocol}//${window.location.hostname}:5000`;
    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('Real-time menu socket connected.');
    });

    // Real-time Event: New food added by Admin
    socket.on('menu:created', (newItem) => {
      setMenuItems((prev) => {
        if (prev.some((item) => item._id === newItem._id)) return prev;
        return [newItem, ...prev];
      });
    });

    // Real-time Event: Food item updated (or image replaced)
    socket.on('menu:updated', (updatedItem) => {
      setMenuItems((prev) =>
        prev.map((item) => (item._id === updatedItem._id ? updatedItem : item))
      );
      // Update selected food in modal if currently open
      setSelectedFood((prev) => (prev && prev._id === updatedItem._id ? updatedItem : prev));
    });

    // Real-time Event: Food item removed
    socket.on('menu:deleted', ({ id }) => {
      setMenuItems((prev) => prev.filter((item) => item._id !== id));
      setSelectedFood((prev) => (prev && prev._id === id ? null : prev));
    });

    // Real-time Event: Quick availability toggle
    socket.on('menu:availabilityChanged', ({ id, available }) => {
      setMenuItems((prev) =>
        prev.map((item) => (item._id === id ? { ...item, available } : item))
      );
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      const [catRes, menuRes] = await Promise.all([
        API.get('/categories'),
        API.get('/menu'),
      ]);

      if (catRes.data?.success && menuRes.data?.success) {
        setCategories(catRes.data.data);
        setMenuItems(menuRes.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getQtyInCart = (itemId) => {
    const item = cart.find((i) => i.menuItem === itemId);
    return item ? item.quantity : 0;
  };

  // Filter items efficiently
  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchesCategory =
        activeCategory === 'all' || item.category?._id === activeCategory;

      const q = debouncedQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q)) ||
        (item.category?.name && item.category.name.toLowerCase().includes(q));

      const matchesAvailable = !onlyAvailable || item.available !== false;
      const matchesFeatured = !onlyFeatured || Boolean(item.featured);

      return matchesCategory && matchesSearch && matchesAvailable && matchesFeatured;
    });
  }, [menuItems, activeCategory, debouncedQuery, onlyAvailable, onlyFeatured]);

  const cartTotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <div className="bg-cream min-h-screen">
      {/* Hero Header Banner */}
      <div className="relative bg-gradient-to-br from-primary-darker via-primary-dark to-[#165032] py-12 md:py-16 px-[5%] text-center text-white overflow-hidden shadow-md">
        <div className="absolute -right-20 -top-20 w-72 h-72 bg-amber/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-72 h-72 bg-primary/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 backdrop-blur-md px-4 py-1.5 rounded-full text-amber font-bold text-xs uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5 fill-amber" />
            <span>DRS College Smart Canteen</span>
          </div>
          <h1 className="font-outfit font-black text-3xl md:text-5xl tracking-tight mb-3">
            Delicious & Fresh Menu 🍛
          </h1>
          <p className="text-white/75 text-sm md:text-base font-medium max-w-xl mx-auto">
            Traditional Tamil recipes cooked fresh daily. High quality ingredients, instant pickup, zero queue waiting.
          </p>
        </div>
      </div>

      {/* Sticky Categories & Quick Filters Bar */}
      <div className="bg-white/95 backdrop-blur-md border-b border-border sticky top-16 z-30 px-[5%] shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 py-3">
          {/* Categories Tab Scroll */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-4.5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activeCategory === 'all'
                  ? 'bg-primary-dark text-white shadow-md'
                  : 'bg-cream text-muted hover:bg-gray-100 hover:text-primary-dark'
              }`}
            >
              <span>🍽️</span> All Items ({menuItems.length})
            </button>
            {categories.map((cat) => {
              const count = menuItems.filter((i) => i.category?._id === cat._id).length;
              const emojiIcon =
                cat.name === 'Meals' ? '🍛' : cat.name === 'Snacks' ? '🍿' : '🥤';

              return (
                <button
                  key={cat._id}
                  onClick={() => setActiveCategory(cat._id)}
                  className={`px-4.5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    activeCategory === cat._id
                      ? 'bg-primary-dark text-white shadow-md'
                      : 'bg-cream text-muted hover:bg-gray-100 hover:text-primary-dark'
                  }`}
                >
                  <span>{emojiIcon}</span> {cat.name} ({count})
                </button>
              );
            })}
          </div>

          {/* Quick Filter Toggles */}
          <div className="hidden md:flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setOnlyFeatured((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border ${
                onlyFeatured
                  ? 'bg-amber text-primary-darker border-amber shadow-sm'
                  : 'bg-white text-muted border-border hover:border-gray-300'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" /> Featured
            </button>
            <button
              onClick={() => setOnlyAvailable((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border ${
                onlyAvailable
                  ? 'bg-green-600 text-white border-green-600 shadow-sm'
                  : 'bg-white text-muted border-border hover:border-gray-300'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> In Stock Only
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 py-8 pb-36">
        {/* Search & Mobile Filter Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-8">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-3.5 w-4.5 h-4.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search delicious dosas, meals, juices..."
              className="w-full bg-white border-2 border-border focus:border-primary rounded-2xl py-3 pl-11 pr-10 text-xs md:text-sm focus:outline-none transition-all shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-3.5 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Mobile Filter Badges */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setOnlyFeatured((prev) => !prev)}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1 ${
                onlyFeatured
                  ? 'bg-amber text-primary-darker border-amber shadow-sm'
                  : 'bg-white text-muted border-border'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" /> Featured
            </button>
            <button
              onClick={() => setOnlyAvailable((prev) => !prev)}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1 ${
                onlyAvailable
                  ? 'bg-green-600 text-white border-green-600 shadow-sm'
                  : 'bg-white text-muted border-border'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> In Stock
            </button>
          </div>

          {/* Results Counter */}
          <div className="text-xs text-muted font-bold self-end sm:self-center">
            Showing <span className="text-primary-dark font-black">{filteredItems.length}</span> dishes
          </div>
        </div>

        {/* Dynamic State Rendering */}
        {loading ? (
          <div className="py-24 text-center">
            <div className="w-14 h-14 border-4 border-muted border-t-primary rounded-full animate-spin mx-auto mb-4" />
            <span className="text-muted text-sm font-bold uppercase tracking-wider">
              Preparing delicious menu...
            </span>
          </div>
        ) : error ? (
          <div className="text-center py-20 bg-white border border-border rounded-3xl p-6 max-w-lg mx-auto shadow-sm">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="font-outfit font-bold text-xl text-primary-dark mb-1">
              Failed to Load Menu
            </h3>
            <p className="text-muted text-sm mb-6 leading-relaxed">{error}</p>
            <button
              onClick={fetchData}
              className="bg-primary-dark text-white font-bold px-7 py-3 rounded-xl hover:bg-primary transition-all shadow-md active:scale-95"
            >
              Retry Connection
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-20 bg-white border border-border rounded-3xl p-8 max-w-md mx-auto shadow-sm">
            <HelpCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="font-outfit font-bold text-xl text-primary-dark mb-1">
              No Food Items Found
            </h3>
            <p className="text-muted text-sm mb-6 leading-relaxed">
              We couldn't find any dishes matching "{searchQuery}". Try a different search keyword or category.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setActiveCategory('all');
                setOnlyAvailable(false);
                setOnlyFeatured(false);
              }}
              className="bg-primary hover:bg-primary-dark text-white font-bold px-6 py-2.5 rounded-xl transition-all shadow-sm text-xs"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          /* Food Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredItems.map((item) => (
              <FoodCard
                key={item._id}
                item={item}
                quantity={getQtyInCart(item._id)}
                onAdd={(itemToAdd) => addToCart(itemToAdd, 1)}
                onChangeQty={(id, delta) => changeQuantity(id, delta)}
                onOpenDetail={(itemToOpen) => setSelectedFood(itemToOpen)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating Tray Summary Bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 w-[92%] max-w-xl bg-primary-darker/95 backdrop-blur-md text-white p-4 md:p-4.5 rounded-3xl shadow-2xl shadow-primary-darker/50 flex items-center justify-between z-40 border border-white/10 hover:bg-primary-dark transition-all">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-amber text-primary-darker font-bold rounded-2xl flex items-center justify-center shadow-md">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-white/70 font-semibold block">
                {cartCount} Dish{cartCount > 1 ? 'es' : ''} in your Tray
              </span>
              <span className="font-outfit font-black text-lg text-amber">
                ₹{cartTotal} Total
              </span>
            </div>
          </div>
          <Link
            to="/cart"
            className="bg-amber hover:bg-amber-dark text-primary-darker font-outfit font-black text-xs md:text-sm px-6 py-3 rounded-2xl transition-all shadow-lg active:scale-95 flex items-center gap-1.5"
          >
            <span>Proceed to Tray</span> →
          </Link>
        </div>
      )}

      {/* Food Details Popup Modal */}
      <FoodDetailModal
        item={selectedFood}
        isOpen={Boolean(selectedFood)}
        onClose={() => setSelectedFood(null)}
        initialQty={selectedFood ? getQtyInCart(selectedFood._id) || 1 : 1}
        onAddToCart={(item, qty) => addToCart(item, qty)}
      />
    </div>
  );
};

export default Menu;
