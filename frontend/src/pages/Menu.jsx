import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import API from '../services/api';
import MenuCacheService from '../services/menuCache';
import {
  itemHasActiveCategory,
  itemMatchesCategory,
  itemMatchesCategorySearch,
  syncItemCategoryUpdate,
} from '../utils/categoryHelpers';
import FoodCard from '../components/food/FoodCard';
import FoodDetailModal from '../components/food/FoodDetailModal';
import MenuSkeleton from '../components/skeletons/MenuSkeleton';
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
  const {
    cart,
    addToCart,
    changeQuantity,
    getItemQuantity,
    parcelEnabled,
    parcelChargePerItem,
    foodSubtotal,
    parcelChargeTotal,
  } = useCart();
  const { user } = useAuth();
  const { socket } = useSocket();
  const hasMobileBottomNav = Boolean(user && user.role !== 'admin' && user.role !== 'ADMIN');

  const [categories, setCategories] = useState(() => MenuCacheService.getCategories() || []);
  const [menuItems, setMenuItems] = useState(() => MenuCacheService.getMenu() || []);
  const [loading, setLoading] = useState(() => !MenuCacheService.getMenu());
  const [error, setError] = useState('');

  // Active filter states
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [onlyFeatured, setOnlyFeatured] = useState(false);

  // Modal detail state
  const [selectedFood, setSelectedFood] = useState(null);

  // Debounced search query (300ms)
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    fetchData();
  }, []);

  // Real-time synchronization via shared socket
  useEffect(() => {
    if (!socket) return;

    const handleCreated = (newItem) => {
      setMenuItems((prev) => {
        if (prev.some((item) => item._id === newItem._id)) return prev;
        const updated = [newItem, ...prev];
        MenuCacheService.setMenu(updated);
        return updated;
      });
    };

    const handleUpdated = (updatedItem) => {
      setMenuItems((prev) => {
        const updated = prev.map((item) => (item._id === updatedItem._id ? updatedItem : item));
        MenuCacheService.setMenu(updated);
        return updated;
      });
      setSelectedFood((prev) => (prev && prev._id === updatedItem._id ? updatedItem : prev));
    };

    const handleDeleted = ({ id }) => {
      setMenuItems((prev) => {
        const updated = prev.filter((item) => item._id !== id);
        MenuCacheService.setMenu(updated);
        return updated;
      });
      setSelectedFood((prev) => (prev && prev._id === id ? null : prev));
    };

    const handleAvailability = ({ id, available }) => {
      setMenuItems((prev) => {
        const updated = prev.map((item) => (item._id === id ? { ...item, available } : item));
        MenuCacheService.setMenu(updated);
        return updated;
      });
    };

    const handleCategoryCreated = (newCat) => {
      if (newCat.active === false) return;
      setCategories((prev) => {
        if (prev.some((c) => c._id === newCat._id)) return prev;
        const updated = [...prev, newCat].sort((a, b) => a.name.localeCompare(b.name));
        MenuCacheService.setCategories(updated);
        return updated;
      });
    };

    const handleCategoryUpdated = (updatedCat) => {
      setCategories((prev) => {
        let updated;
        if (updatedCat.active === false) {
          updated = prev.filter((c) => c._id !== updatedCat._id);
        } else if (prev.some((c) => c._id === updatedCat._id)) {
          updated = prev.map((c) => (c._id === updatedCat._id ? updatedCat : c));
        } else {
          updated = [...prev, updatedCat];
        }
        updated = updated.sort((a, b) => a.name.localeCompare(b.name));
        MenuCacheService.setCategories(updated);
        return updated;
      });

      if (updatedCat.active === false) {
        setActiveCategory((prev) => (prev === updatedCat._id ? 'all' : prev));
      }

      setMenuItems((prev) => {
        const updated = prev.map((item) => syncItemCategoryUpdate(item, updatedCat));
        MenuCacheService.setMenu(updated);
        return updated;
      });
    };

    const handleCategoryDeleted = ({ id }) => {
      setCategories((prev) => {
        const updated = prev.filter((c) => c._id !== id);
        MenuCacheService.setCategories(updated);
        return updated;
      });
      setActiveCategory((prev) => (prev === id ? 'all' : prev));
    };

    socket.on('menu:created', handleCreated);
    socket.on('menu:updated', handleUpdated);
    socket.on('menu:deleted', handleDeleted);
    socket.on('menu:availabilityChanged', handleAvailability);
    socket.on('category:created', handleCategoryCreated);
    socket.on('category:updated', handleCategoryUpdated);
    socket.on('category:deleted', handleCategoryDeleted);

    return () => {
      socket.off('menu:created', handleCreated);
      socket.off('menu:updated', handleUpdated);
      socket.off('menu:deleted', handleDeleted);
      socket.off('menu:availabilityChanged', handleAvailability);
      socket.off('category:created', handleCategoryCreated);
      socket.off('category:updated', handleCategoryUpdated);
      socket.off('category:deleted', handleCategoryDeleted);
    };
  }, [socket]);

  const fetchData = async () => {
    const hasCachedData = Boolean(MenuCacheService.getMenu() && MenuCacheService.getCategories());
    if (!hasCachedData) {
      setLoading(true);
    }
    setError('');

    try {
      const [catRes, menuRes] = await Promise.all([
        API.get('/categories'),
        API.get('/menu?activeCategoriesOnly=true'),
      ]);

      if (catRes.data?.success && menuRes.data?.success) {
        setCategories(catRes.data.data);
        setMenuItems(menuRes.data.data);
        MenuCacheService.setCategories(catRes.data.data);
        MenuCacheService.setMenu(menuRes.data.data);
      }
    } catch (err) {
      if (!hasCachedData) {
        setError(err.response?.data?.message || 'Connection error. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const getQtyInCart = (itemId) => {
    const item = cart.find((i) => i.menuItem === itemId);
    return item ? item.quantity : 0;
  };

  // Exclude items whose assigned categories are all deactivated
  const activeMenuItems = useMemo(() => {
    return menuItems.filter((item) => itemHasActiveCategory(item));
  }, [menuItems]);

  // Filter items efficiently (supports primary + multi-category items)
  const filteredItems = useMemo(() => {
    return activeMenuItems.filter((item) => {
      const matchesCategory = itemMatchesCategory(item, activeCategory);

      const q = debouncedQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q)) ||
        itemMatchesCategorySearch(item, q);

      const matchesAvailable = !onlyAvailable || item.available !== false;
      const matchesFeatured = !onlyFeatured || Boolean(item.featured);

      return matchesCategory && matchesSearch && matchesAvailable && matchesFeatured;
    });
  }, [activeMenuItems, activeCategory, debouncedQuery, onlyAvailable, onlyFeatured]);

  const cartTotal = Number((foodSubtotal + parcelChargeTotal).toFixed(2));
  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const getCategoryTabClass = (isSelected) =>
    `h-9 min-w-[96px] sm:min-w-[104px] px-4 rounded-full border text-xs inline-flex items-center justify-center whitespace-nowrap text-center shrink-0 transition-all select-none cursor-pointer ${
      isSelected
        ? 'bg-amber text-primary-darker border-amber font-black shadow-sm shadow-amber/20 hover:bg-amber'
        : 'bg-cream text-primary-dark border-border font-bold hover:bg-primary-light/60 hover:border-primary/25'
    }`;

  return (
    <div className="bg-cream min-h-screen overflow-x-clip">
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
      <div className="bg-white/95 backdrop-blur-md border-b border-border sticky top-16 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Categories Tab Scroll */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className={getCategoryTabClass(activeCategory === 'all')}
            >
              All Categories
            </button>
            {categories.map((cat) => (
              <button
                key={cat._id}
                type="button"
                onClick={() => setActiveCategory(cat._id)}
                className={getCategoryTabClass(activeCategory === cat._id)}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Quick Filter Toggles */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setOnlyFeatured((prev) => !prev)}
              className={`h-9 px-3.5 rounded-xl text-xs font-bold transition-all inline-flex items-center justify-center gap-1.5 border whitespace-nowrap cursor-pointer ${
                onlyFeatured
                  ? 'bg-amber text-primary-darker border-amber shadow-sm'
                  : 'bg-white text-muted border-border hover:border-gray-300'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" /> Featured
            </button>
            <button
              type="button"
              onClick={() => setOnlyAvailable((prev) => !prev)}
              className={`h-9 px-3.5 rounded-xl text-xs font-bold transition-all inline-flex items-center justify-center gap-1.5 border whitespace-nowrap cursor-pointer ${
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
      <div
        className={`max-w-7xl mx-auto px-4 py-8 ${
          cartCount > 0
            ? hasMobileBottomNav
              ? 'pb-48 md:pb-32'
              : 'pb-32'
            : hasMobileBottomNav
            ? 'pb-28 md:pb-16'
            : 'pb-16'
        }`}
      >
        {/* Search & Mobile Filter Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-8">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-3.5 w-4 h-4 text-gray-400" />
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
          <MenuSkeleton count={8} />
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
                normalQty={getItemQuantity(item._id, 'NORMAL')}
                parcelQty={getItemQuantity(item._id, 'PARCEL')}
                parcelEnabled={parcelEnabled}
                parcelChargePerItem={parcelChargePerItem}
                onAdd={(itemToAdd, svc = 'NORMAL') => addToCart(itemToAdd, 1, svc)}
                onChangeQty={(id, delta, svc = 'NORMAL') => changeQuantity(id, delta, svc)}
                onOpenDetail={(itemToOpen) => setSelectedFood(itemToOpen)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating Tray Summary Bar (Positioned cleanly above mobile bottom navigation with safe-area support) */}
      {cartCount > 0 && (
        <div
          className={`fixed left-1/2 -translate-x-1/2 w-[calc(100%-24px)] sm:w-[92%] max-w-xl bg-primary-darker/95 backdrop-blur-md text-white p-3 sm:p-4 rounded-2xl sm:rounded-3xl shadow-2xl shadow-primary-darker/50 flex items-center justify-between gap-3 z-40 border border-white/10 hover:bg-primary-dark transition-all ${
            hasMobileBottomNav
              ? 'bottom-[calc(80px+env(safe-area-inset-bottom,0px))] md:bottom-6'
              : 'bottom-[calc(16px+env(safe-area-inset-bottom,0px))] md:bottom-6'
          }`}
        >
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 bg-amber text-primary-darker font-bold rounded-xl sm:rounded-2xl flex items-center justify-center shadow-md shrink-0">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] sm:text-xs text-white/75 font-semibold block truncate">
                {cartCount} Dish{cartCount > 1 ? 'es' : ''} in your Tray
                {parcelChargeTotal > 0 ? ` • +₹${parcelChargeTotal} parcel` : ''}
              </span>
              <span className="font-outfit font-black text-base sm:text-lg text-amber block leading-tight">
                ₹{cartTotal} Total
              </span>
            </div>
          </div>
          <Link
            to="/cart"
            className="bg-amber hover:bg-amber-dark text-primary-darker font-outfit font-black text-xs sm:text-sm px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl transition-all shadow-lg active:scale-95 flex items-center gap-1.5 shrink-0 whitespace-nowrap"
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
        initialQty={1}
        parcelEnabled={parcelEnabled}
        parcelChargePerItem={parcelChargePerItem}
        onAddToCart={(item, qty, svc = 'NORMAL') => addToCart(item, qty, svc)}
      />
    </div>
  );
};

export default Menu;
