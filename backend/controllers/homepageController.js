import Order from '../models/Order.js';
import MenuItem from '../models/MenuItem.js';
import Category from '../models/Category.js';
import cache from '../utils/cache.js';

const STATS_CACHE_KEY = 'homepage_stats';
const STATS_CACHE_TTL = 15; // 15 seconds cache

/**
 * Calculates real-time aggregate statistics from MongoDB:
 * 1. ordersPlaced: count of non-cancelled orders
 * 2. menuItems: count of currently available parent menu items
 * 3. averagePreparationTime: calculated average prep time in minutes (rounded)
 * 4. categoriesCount: active menu categories
 * 5. traditional: brand statement ("Authentic")
 */
export const calculateHomepageStats = async () => {
  const [ordersPlaced, menuItems, prepAgg, categoriesCount] = await Promise.all([
    // A. Orders Placed: Count actual successfully created orders, excluding cancelled
    Order.countDocuments({ status: { $ne: 'Cancelled' } }),

    // B. Menu Items: Count currently available parent menu items (exclude variants to avoid double-counting)
    MenuItem.countDocuments({
      available: true,
      $or: [{ variantParent: null }, { variantParent: { $exists: false } }],
    }),

    // C. Average Prep Time: Average preparation time of available parent items
    MenuItem.aggregate([
      {
        $match: {
          available: true,
          $or: [{ variantParent: null }, { variantParent: { $exists: false } }],
          preparationTime: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: null,
          avgTime: { $avg: '$preparationTime' },
        },
      },
    ]),

    // D. Active Categories Count
    Category.countDocuments({ active: true }),
  ]);

  const rawAvg = prepAgg.length > 0 && prepAgg[0].avgTime ? prepAgg[0].avgTime : 5;
  const averagePreparationTime = Math.round(rawAvg);

  return {
    ordersPlaced: Math.max(0, ordersPlaced),
    menuItems: Math.max(0, menuItems),
    averagePreparationTime: Math.max(1, averagePreparationTime),
    categoriesCount: Math.max(0, categoriesCount),
    traditional: 'Authentic',
    lastUpdated: new Date().toISOString(),
  };
};

/**
 * Public lightweight endpoint: GET /api/homepage/stats
 */
export const getHomepageStats = async (req, res) => {
  try {
    const cachedStats = cache.get(STATS_CACHE_KEY);
    if (cachedStats) {
      return res.status(200).json({
        success: true,
        message: 'Homepage statistics fetched successfully',
        data: cachedStats,
      });
    }

    const freshStats = await calculateHomepageStats();
    cache.set(STATS_CACHE_KEY, freshStats, STATS_CACHE_TTL);

    return res.status(200).json({
      success: true,
      message: 'Homepage statistics fetched successfully',
      data: freshStats,
    });
  } catch (error) {
    console.error('Error fetching homepage statistics:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching homepage statistics',
      error: error.message,
    });
  }
};

/**
 * Invalidate cache and broadcast updated stats over Socket.IO to all connected visitors
 * @param {object} io - Socket.IO server instance
 */
export const emitHomepageStatsUpdate = async (io) => {
  try {
    // Invalidate cached stats
    cache.del(STATS_CACHE_KEY);

    // Calculate fresh database statistics
    const updatedStats = await calculateHomepageStats();
    cache.set(STATS_CACHE_KEY, updatedStats, STATS_CACHE_TTL);

    if (io) {
      // Emit dedicated public event with ONLY aggregate numbers (no private order or customer data)
      io.emit('homepage:stats:update', updatedStats);
      console.log('📡 [SOCKET] Emitted homepage:stats:update:', {
        ordersPlaced: updatedStats.ordersPlaced,
        menuItems: updatedStats.menuItems,
        averagePreparationTime: updatedStats.averagePreparationTime,
      });
    }

    return updatedStats;
  } catch (error) {
    console.error('⚠️ [HOMEPAGE STATS] Failed to calculate or emit stats update:', error.message);
    return null;
  }
};
