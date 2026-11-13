import Order from '../models/Order.js';
import { cache } from '../utils/cache.js';

// @desc    Get dashboard metrics overview (total orders, total revenue, counts by status)
// @route   GET /api/analytics/overview
// @access  Private/Admin
const getAnalyticsOverview = async (req, res) => {
  try {
    const cached = cache.get('analytics:overview');
    if (cached) {
      return res.json(cached);
    }

    // Current calendar date in Asia/Kolkata (IST: UTC+05:30)
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    const istTodayStart = new Date(`${todayStr}T00:00:00.000+05:30`);
    const istTodayEnd = new Date(`${todayStr}T23:59:59.999+05:30`);

    // Run aggregations in parallel for high performance
    const [stats, statusCounts, todayStats] = await Promise.all([
      Order.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$total' },
            totalOrders: { $sum: 1 },
          },
        },
      ]),
      Order.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),
      Order.aggregate([
        {
          $match: {
            status: { $in: ['Handover Bill', 'Completed'] },
            $or: [
              { completedAt: { $gte: istTodayStart, $lte: istTodayEnd } },
              { completedAt: null, createdAt: { $gte: istTodayStart, $lte: istTodayEnd } },
            ],
          },
        },
        {
          $group: {
            _id: null,
            todayRevenue: { $sum: '$total' },
            todayOrders: { $sum: 1 },
          },
        },
      ]),
    ]);

    const revenue = stats.length > 0 ? stats[0].totalRevenue : 0;
    const ordersCount = stats.length > 0 ? stats[0].totalOrders : 0;
    const todayRevenue = todayStats.length > 0 ? todayStats[0].todayRevenue : 0;
    const todayOrders = todayStats.length > 0 ? todayStats[0].todayOrders : 0;

    const statusMap = { Placed: 0, Confirmed: 0, Preparing: 0, Ready: 0, Completed: 0, Cancelled: 0 };
    statusCounts.forEach((item) => {
      if (statusMap[item._id] !== undefined) {
        statusMap[item._id] = item.count;
      }
    });

    const responsePayload = {
      success: true,
      data: {
        totalRevenue: revenue,
        totalOrders: ordersCount,
        todayRevenue,
        todayOrders,
        statusBreakdown: statusMap,
      },
    };

    cache.set('analytics:overview', responsePayload, 45);
    res.json(responsePayload);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get weekly revenue trends
// @route   GET /api/analytics/revenue
// @access  Private/Admin
const getRevenueTrends = async (req, res) => {
  try {
    const cached = cache.get('analytics:revenue');
    if (cached) {
      return res.json(cached);
    }

    // Group orders by creation day (past 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const revenueByDay = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo },
          status: { $ne: 'Cancelled' },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const responsePayload = { success: true, data: revenueByDay };
    cache.set('analytics:revenue', responsePayload, 45);

    res.json(responsePayload);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get top selling menu items
// @route   GET /api/analytics/popular-items
// @access  Private/Admin
const getPopularItems = async (req, res) => {
  try {
    const cached = cache.get('analytics:popular');
    if (cached) {
      return res.json(cached);
    }

    const popularItems = await Order.aggregate([
      { $match: { status: { $ne: 'Cancelled' } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.name',
          quantity: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        },
      },
      { $sort: { quantity: -1 } },
      { $limit: 5 },
    ]);

    const responsePayload = { success: true, data: popularItems };
    cache.set('analytics:popular', responsePayload, 45);

    res.json(responsePayload);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get order counts by payment method
// @route   GET /api/analytics/payment-methods
// @access  Private/Admin
const getPaymentMethodStats = async (req, res) => {
  try {
    const cached = cache.get('analytics:payments');
    if (cached) {
      return res.json(cached);
    }

    const paymentMethods = await Order.aggregate([
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          revenue: { $sum: '$total' },
        },
      },
    ]);

    const responsePayload = { success: true, data: paymentMethods };
    cache.set('analytics:payments', responsePayload, 45);

    res.json(responsePayload);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export { getAnalyticsOverview, getRevenueTrends, getPopularItems, getPaymentMethodStats };
