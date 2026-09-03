import Order from '../models/Order.js';

// @desc    Get dashboard metrics overview (total orders, total revenue, counts by status)
// @route   GET /api/analytics/overview
// @access  Private/Admin
const getAnalyticsOverview = async (req, res) => {
  try {
    // 1. Get totals and revenues
    const stats = await Order.aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$total' },
          totalOrders: { $sum: 1 },
        },
      },
    ]);

    const revenue = stats.length > 0 ? stats[0].totalRevenue : 0;
    const ordersCount = stats.length > 0 ? stats[0].totalOrders : 0;

    // 2. Count by statuses
    const statusCounts = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const statusMap = { Placed: 0, Confirmed: 0, Preparing: 0, Ready: 0, Completed: 0, Cancelled: 0 };
    statusCounts.forEach((item) => {
      if (statusMap[item._id] !== undefined) {
        statusMap[item._id] = item.count;
      }
    });

    res.json({
      success: true,
      data: {
        totalRevenue: revenue,
        totalOrders: ordersCount,
        statusBreakdown: statusMap,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get weekly revenue trends
// @route   GET /api/analytics/revenue
// @access  Private/Admin
const getRevenueTrends = async (req, res) => {
  try {
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

    res.json({ success: true, data: revenueByDay });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get top selling menu items
// @route   GET /api/analytics/popular-items
// @access  Private/Admin
const getPopularItems = async (req, res) => {
  try {
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

    res.json({ success: true, data: popularItems });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get order counts by payment method
// @route   GET /api/analytics/payment-methods
// @access  Private/Admin
const getPaymentMethodStats = async (req, res) => {
  try {
    const paymentMethods = await Order.aggregate([
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          revenue: { $sum: '$total' },
        },
      },
    ]);

    res.json({ success: true, data: paymentMethods });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export { getAnalyticsOverview, getRevenueTrends, getPopularItems, getPaymentMethodStats };
