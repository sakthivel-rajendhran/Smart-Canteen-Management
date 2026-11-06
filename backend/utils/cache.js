// In-memory cache with TTL support
const store = new Map();

export const cache = {
  get(key) {
    const item = store.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      store.delete(key);
      return null;
    }
    return item.value;
  },

  set(key, value, ttlSeconds = 45) {
    store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  },

  del(key) {
    store.delete(key);
  },

  clearPrefix(prefix) {
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) {
        store.delete(key);
      }
    }
  },

  flush() {
    store.clear();
  },
};

export default cache;
