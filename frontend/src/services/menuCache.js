// In-memory module cache for menu and categories with 60-second stale time
const STALE_TIME_MS = 60 * 1000;

let menuCache = {
  data: null,
  timestamp: 0,
};

let categoriesCache = {
  data: null,
  timestamp: 0,
};

let featuredCache = {
  data: null,
  timestamp: 0,
};

export const MenuCacheService = {
  getMenu() {
    return menuCache.data;
  },

  isMenuFresh() {
    return Boolean(menuCache.data && Date.now() - menuCache.timestamp < STALE_TIME_MS);
  },

  setMenu(data) {
    menuCache = {
      data,
      timestamp: Date.now(),
    };
  },

  getCategories() {
    return categoriesCache.data;
  },

  isCategoriesFresh() {
    return Boolean(categoriesCache.data && Date.now() - categoriesCache.timestamp < STALE_TIME_MS);
  },

  setCategories(data) {
    categoriesCache = {
      data,
      timestamp: Date.now(),
    };
  },

  getFeatured() {
    return featuredCache.data;
  },

  isFeaturedFresh() {
    return Boolean(featuredCache.data && Date.now() - featuredCache.timestamp < STALE_TIME_MS);
  },

  setFeatured(data) {
    featuredCache = {
      data,
      timestamp: Date.now(),
    };
  },

  // Real-time synchronization helpers
  addMenuItem(item) {
    if (menuCache.data) {
      if (!menuCache.data.some((i) => i._id === item._id)) {
        menuCache.data = [item, ...menuCache.data];
      }
    }
  },

  updateMenuItem(item) {
    if (menuCache.data) {
      menuCache.data = menuCache.data.map((i) => (i._id === item._id ? item : i));
    }
    if (featuredCache.data) {
      featuredCache.data = featuredCache.data.map((i) => (i._id === item._id ? item : i));
    }
  },

  removeMenuItem(id) {
    if (menuCache.data) {
      menuCache.data = menuCache.data.filter((i) => i._id !== id);
    }
    if (featuredCache.data) {
      featuredCache.data = featuredCache.data.filter((i) => i._id !== id);
    }
  },

  updateAvailability(id, available) {
    if (menuCache.data) {
      menuCache.data = menuCache.data.map((i) => (i._id === id ? { ...i, available } : i));
    }
    if (featuredCache.data) {
      featuredCache.data = featuredCache.data.map((i) => (i._id === id ? { ...i, available } : i));
    }
  },

  clear() {
    menuCache = { data: null, timestamp: 0 };
    categoriesCache = { data: null, timestamp: 0 };
    featuredCache = { data: null, timestamp: 0 };
  },
};

export default MenuCacheService;

