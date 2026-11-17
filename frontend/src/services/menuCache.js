// Stale-While-Revalidate cache for menu and categories with 5-minute TTL backed by sessionStorage
const TTL_MS = 5 * 60 * 1000; // 5 minutes

const KEYS = {
  MENU: 'drs_menu_cache',
  CATEGORIES: 'drs_categories_cache',
  FEATURED: 'drs_featured_cache',
};

const safeSessionGet = (key) => {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    const item = window.sessionStorage.getItem(key);
    if (!item) return null;
    const parsed = JSON.parse(item);
    if (parsed && typeof parsed.timestamp === 'number') {
      return parsed;
    }
  } catch (e) {
    // SessionStorage may be restricted or full
  }
  return null;
};

const safeSessionSet = (key, data) => {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    const record = {
      data,
      timestamp: Date.now(),
    };
    window.sessionStorage.setItem(key, JSON.stringify(record));
  } catch (e) {
    // Quota exceeded or restricted
  }
};

const safeSessionRemove = (key) => {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(key);
    }
  } catch (e) {}
};

// In-memory fallback
let memoryMenu = safeSessionGet(KEYS.MENU);
let memoryCategories = safeSessionGet(KEYS.CATEGORIES);
let memoryFeatured = safeSessionGet(KEYS.FEATURED);

export const MenuCacheService = {
  getMenu() {
    if (memoryMenu && memoryMenu.data) {
      return memoryMenu.data;
    }
    const stored = safeSessionGet(KEYS.MENU);
    if (stored && stored.data) {
      memoryMenu = stored;
      return stored.data;
    }
    return null;
  },

  isMenuFresh() {
    const item = memoryMenu || safeSessionGet(KEYS.MENU);
    return Boolean(item && item.data && Date.now() - item.timestamp < TTL_MS);
  },

  setMenu(data) {
    memoryMenu = { data, timestamp: Date.now() };
    safeSessionSet(KEYS.MENU, data);
  },

  getCategories() {
    if (memoryCategories && memoryCategories.data) {
      return memoryCategories.data;
    }
    const stored = safeSessionGet(KEYS.CATEGORIES);
    if (stored && stored.data) {
      memoryCategories = stored;
      return stored.data;
    }
    return null;
  },

  isCategoriesFresh() {
    const item = memoryCategories || safeSessionGet(KEYS.CATEGORIES);
    return Boolean(item && item.data && Date.now() - item.timestamp < TTL_MS);
  },

  setCategories(data) {
    memoryCategories = { data, timestamp: Date.now() };
    safeSessionSet(KEYS.CATEGORIES, data);
  },

  getFeatured() {
    if (memoryFeatured && memoryFeatured.data) {
      return memoryFeatured.data;
    }
    const stored = safeSessionGet(KEYS.FEATURED);
    if (stored && stored.data) {
      memoryFeatured = stored;
      return stored.data;
    }
    return null;
  },

  isFeaturedFresh() {
    const item = memoryFeatured || safeSessionGet(KEYS.FEATURED);
    return Boolean(item && item.data && Date.now() - item.timestamp < TTL_MS);
  },

  setFeatured(data) {
    memoryFeatured = { data, timestamp: Date.now() };
    safeSessionSet(KEYS.FEATURED, data);
  },

  // Real-time synchronization helpers
  addMenuItem(item) {
    const current = this.getMenu();
    if (current) {
      if (!current.some((i) => i._id === item._id)) {
        this.setMenu([item, ...current]);
      }
    }
  },

  updateMenuItem(item) {
    const currentMenu = this.getMenu();
    if (currentMenu) {
      this.setMenu(currentMenu.map((i) => (i._id === item._id ? item : i)));
    }
    const currentFeatured = this.getFeatured();
    if (currentFeatured) {
      this.setFeatured(currentFeatured.map((i) => (i._id === item._id ? item : i)));
    }
  },

  removeMenuItem(id) {
    const currentMenu = this.getMenu();
    if (currentMenu) {
      this.setMenu(currentMenu.filter((i) => i._id !== id));
    }
    const currentFeatured = this.getFeatured();
    if (currentFeatured) {
      this.setFeatured(currentFeatured.filter((i) => i._id !== id));
    }
  },

  updateAvailability(id, available) {
    const currentMenu = this.getMenu();
    if (currentMenu) {
      this.setMenu(currentMenu.map((i) => (i._id === id ? { ...i, available } : i)));
    }
    const currentFeatured = this.getFeatured();
    if (currentFeatured) {
      this.setFeatured(currentFeatured.map((i) => (i._id === id ? { ...i, available } : i)));
    }
  },

  clear() {
    memoryMenu = null;
    memoryCategories = null;
    memoryFeatured = null;
    safeSessionRemove(KEYS.MENU);
    safeSessionRemove(KEYS.CATEGORIES);
    safeSessionRemove(KEYS.FEATURED);
  },
};

export default MenuCacheService;
