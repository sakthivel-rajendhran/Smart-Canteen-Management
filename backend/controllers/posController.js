import mongoose from 'mongoose';
import crypto from 'crypto';
import Order from '../models/Order.js';
import User from '../models/User.js';
import MenuItem from '../models/MenuItem.js';
import CanteenSettings from '../models/CanteenSettings.js';
import generateOrderCode from '../utils/generateOrderCode.js';
import {
  createAndEmitNotification,
  createAndEmitAdminNotification,
} from '../utils/notificationHelper.js';

// Safe query helper by code, token, or Mongo ID
const buildSafeOrderQuery = (rawQuery) => {
  if (!rawQuery) return null;
  const term = String(rawQuery).trim();
  const withoutPrefix = term.replace(/^DRS-/i, '');
  const withPrefix = term.toUpperCase().startsWith('DRS-') ? term : `DRS-${term}`;

  const conditions = [
    { orderCode: { $regex: new RegExp(`^${term}$`, 'i') } },
    { orderCode: { $regex: new RegExp(`^${withPrefix}$`, 'i') } },
    { pickupToken: { $regex: new RegExp(`^${term}$`, 'i') } },
    { pickupToken: { $regex: new RegExp(`^${withPrefix}$`, 'i') } },
    { pickupToken: { $regex: new RegExp(`^${withoutPrefix}$`, 'i') } },
    { pickupSecret: term },
  ];
  if (mongoose.Types.ObjectId.isValid(term)) {
    conditions.unshift({ _id: term });
  }
  return { $or: conditions };
};

// @desc    Create Direct Walk-in Counter Order (POS Billing)
// @route   POST /api/admin/pos/orders
// @access  Private/Admin
export const createWalkInOrder = async (req, res) => {
  try {
    const {
      items,
      paymentMethod = 'cash',
      paymentStatus = 'paid',
      walkInCustomer = {},
      discount = 0,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Please add at least one food item.' });
    }

    // 1. Batch verify items from database
    const itemIds = items
      .map((i) => i.menuItem || i._id)
      .filter((id) => id && mongoose.Types.ObjectId.isValid(id));

    if (itemIds.length !== items.length) {
      return res.status(400).json({ success: false, message: 'Invalid item ID found in billing cart.' });
    }

    const dbItems = await MenuItem.find({ _id: { $in: itemIds } }).lean();
    const dbItemMap = new Map(dbItems.map((item) => [item._id.toString(), item]));

    let subtotal = 0;
    const verifiedItems = [];

    for (const item of items) {
      const targetId = String(item.menuItem || item._id);
      const dbItem = dbItemMap.get(targetId);

      if (!dbItem) {
        return res.status(404).json({ success: false, message: `Menu item not found: ${item.name || targetId}` });
      }

      if (!dbItem.available) {
        return res.status(400).json({
          success: false,
          message: `"${dbItem.name}" is marked sold out. Please remove or toggle availability.`,
        });
      }

      const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
      const itemTotal = Number(dbItem.price) * qty;
      subtotal += itemTotal;

      verifiedItems.push({
        menuItem: dbItem._id,
        name: dbItem.name,
        price: Number(dbItem.price),
        quantity: qty,
        emoji: dbItem.emoji || '🍛',
        image: dbItem.image?.url || '',
      });
    }

    const discountAmount = Math.max(0, Math.min(subtotal, Number(discount) || 0));
    const grandTotal = Math.max(0, subtotal - discountAmount);

    // 2. Generate unique order code & consistent pickup token
    const orderCode = await generateOrderCode();
    const pickupToken = orderCode; // Consistent DRS-XXXX format
    const pickupSecret = `sec_${crypto.randomBytes(6).toString('hex')}`;

    // 3. Create WALK_IN Order document
    const order = await Order.create({
      orderCode,
      orderType: 'WALK_IN',
      pickupToken,
      pickupSecret,
      user: req.user._id, // Associated cashier account as reference
      cashier: req.user._id,
      walkInCustomer: {
        name: walkInCustomer.name?.trim() || 'Walk-in Customer',
        phone: walkInCustomer.phone?.trim() || '',
        registerNumber: walkInCustomer.registerNumber?.trim() || '',
        staffId: walkInCustomer.staffId?.trim() || '',
      },
      items: verifiedItems,
      subtotal,
      discount: discountAmount,
      total: grandTotal,
      paymentMethod,
      paymentStatus: paymentStatus || 'paid',
      status: 'Placed',
    });

    // 4. Real-time broadcast to kitchen and admin boards
    const io = req.app.get('socketio');
    if (io) {
      io.to('admin').emit('order:created', order);

      // Create idempotent admin notification for walk-in sale
      createAndEmitAdminNotification(io, {
        title: '🔔 New Walk-in Order',
        message: `Walk-in Order #${order.orderCode} (Token: #${order.pickupToken}) placed at counter (₹${order.total}).`,
        icon: '💵',
        priority: 'HIGH',
        orderId: order._id,
        orderCode: order.orderCode,
        eventId: `ORDER_ADMIN_${order.orderCode}_PLACED`,
        metadata: {
          orderCode: order.orderCode,
          pickupToken: order.pickupToken,
          total: order.total,
          customerName: order.walkInCustomer.name,
        },
      });
    }

    res.status(201).json({
      success: true,
      message: 'Walk-in order created successfully',
      data: order,
    });
  } catch (error) {
    console.error('POS Walk-in creation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get All Orders for Handover Management Queue (Pending vs Completed)
// @route   GET /api/admin/pos/handover-orders
// @access  Private/Admin
export const getHandoverOrders = async (req, res) => {
  try {
    const { filter = 'pending', search = '' } = req.query;
    const query = {};

    if (filter === 'completed') {
      query.status = { $in: ['Handover Bill', 'Completed'] };
    } else if (filter === 'all') {
      query.status = { $in: ['Ready', 'Pickup Bill', 'Handover Bill', 'Completed'] };
    } else {
      // Pending handovers: orders waiting for final collection & bill print ('Pickup Bill' or 'Ready')
      query.status = { $in: ['Pickup Bill', 'Ready'] };
      query.handoverVerified = { $ne: true };
    }

    if (search && search.trim()) {
      const safeSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(safeSearch, 'i');

      // Match online registered users by name, phone, registerNumber, staffId
      const matchingUsers = await User.find({
        $or: [
          { name: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
          { 'studentDetails.registerNumber': searchRegex },
          { 'staffDetails.staffId': searchRegex },
        ],
      }).select('_id').lean();
      const userIds = matchingUsers.map((u) => u._id);

      query.$or = [
        { orderCode: searchRegex },
        { pickupToken: searchRegex },
        { 'walkInCustomer.name': searchRegex },
        { 'walkInCustomer.phone': searchRegex },
        { 'walkInCustomer.registerNumber': searchRegex },
        { 'walkInCustomer.staffId': searchRegex },
        ...(userIds.length > 0 ? [{ user: { $in: userIds } }] : []),
      ];
    }

    const [orders, pendingCount, completedCount] = await Promise.all([
      Order.find(query)
        .populate('user', 'name email phone role accountType studentDetails staffDetails')
        .populate('cashier', 'name')
        .sort(filter === 'completed' ? { completedAt: -1, updatedAt: -1 } : { updatedAt: 1 })
        .lean(),
      Order.countDocuments({ status: { $in: ['Pickup Bill', 'Ready'] }, handoverVerified: { $ne: true } }),
      Order.countDocuments({ status: { $in: ['Handover Bill', 'Completed'] } }),
    ]);

    res.json({
      success: true,
      count: orders.length,
      data: orders,
      stats: {
        pending: pendingCount,
        completed: completedCount,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get All Orders Ready for Pickup (Legacy alias)
// @route   GET /api/admin/pos/ready-orders
// @access  Private/Admin
export const getReadyOrders = async (req, res) => {
  try {
    const readyOrders = await Order.find({ status: { $in: ['Ready', 'Pickup Bill'] } })
      .populate('user', 'name phone studentDetails staffDetails')
      .populate('cashier', 'name')
      .sort({ updatedAt: 1 }) // Oldest ready order first
      .lean();

    res.json({
      success: true,
      count: readyOrders.length,
      data: readyOrders,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Verify Pickup & Handover Food to Customer (Status -> Handover Bill)
// @route   POST /api/admin/pos/verify-pickup
// @access  Private/Admin
export const verifyAndHandoverOrder = async (req, res) => {
  try {
    const { token, orderId, secret } = req.body;
    const queryTerm = token || orderId || secret || req.params.id;

    if (!queryTerm) {
      return res.status(400).json({ success: false, message: 'Please provide a pickup token, Order Code, or QR secret.' });
    }

    const query = buildSafeOrderQuery(queryTerm);
    const order = await Order.findOne(query)
      .populate('user', 'name email phone studentDetails staffDetails')
      .populate('cashier', 'name');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `No order found matching "${queryTerm}". Please check the token.`,
      });
    }

    // STRICT DUPLICATE HANDOVER PROTECTION
    if (order.status === 'Handover Bill' || order.status === 'Completed' || order.handoverVerified) {
      const collectedTime = order.completedAt
        ? new Date(order.completedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        : 'earlier';

      return res.status(409).json({
        success: false,
        alreadyCollected: true,
        message: `Order already collected! Order #${order.orderCode} (Token #${order.pickupToken}) was handed over at ${collectedTime}.`,
        order,
      });
    }

    if (order.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: `Order #${order.orderCode} was cancelled and cannot be handed over.`,
        order,
      });
    }

    // Update order status to Handover Bill (final collected state)
    order.status = 'Handover Bill';
    order.completedAt = new Date();
    order.handoverVerified = true;
    order.handoverVerifiedAt = new Date();
    order.handoverVerifiedBy = req.user._id;

    // Settle unpaid counter COD if applicable
    if (order.paymentStatus === 'cod' || order.paymentStatus === 'pending') {
      order.paymentStatus = 'paid';
    }

    await order.save();

    // Broadcast real-time status update
    const io = req.app.get('socketio');
    if (io) {
      io.to('admin').emit('order:updated', order);

      // Broadcast removal from public counter display
      io.emit('pickup:readyTokensChanged', {
        orderId: order._id,
        orderCode: order.orderCode,
        pickupToken: order.pickupToken || order.orderCode,
        status: 'Handover Bill',
      });
      if (order.user) {
        // Update customer tracking timeline immediately without generating a customer notification
        io.to(`user:${order.user._id || order.user}`).emit('order:statusChanged', {
          orderId: order._id,
          orderCode: order.orderCode,
          status: 'Handover Bill',
          paymentStatus: order.paymentStatus,
          order,
        });
      }
    }

    res.json({
      success: true,
      message: `✓ Food handed over and bill completed! Order #${order.orderCode} (Token #${order.pickupToken}) marked as Handover Bill.`,
      data: order,
    });
  } catch (error) {
    console.error('Handover verification error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Completed Bill History & Sales Archive (with Date Filters & Stats)
// @route   GET /api/admin/bills
// @access  Private/Admin
export const getBillArchive = async (req, res) => {
  try {
    const {
      dateRange = 'today',
      startDate,
      endDate,
      orderType = 'ALL',
      paymentMethod = 'ALL',
      status = 'Completed',
      search = '',
      page = 1,
      limit = 20,
    } = req.query;

    const query = {};

    // 1. Status Filter (default completed archive, or ALL)
    if (status === 'Completed' || status === 'Handover Bill') {
      query.status = { $in: ['Handover Bill', 'Completed'] };
    } else if (status !== 'ALL') {
      query.status = status;
    }

    // 2. Order Type Filter
    if (orderType && orderType !== 'ALL') {
      query.orderType = orderType.toUpperCase();
    }

    // 3. Payment Method Filter
    if (paymentMethod && paymentMethod !== 'ALL') {
      query.paymentMethod = paymentMethod.toLowerCase();
    }

    // 4. Date Range Filtering based on completion/creation
    const now = new Date();
    let rangeStart = null;
    let rangeEnd = null;

    if (dateRange === 'today') {
      rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      rangeEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (dateRange === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      rangeStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
      rangeEnd = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
    } else if (dateRange === '7days') {
      rangeStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (dateRange === '30days') {
      rangeStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (dateRange === '3months') {
      rangeStart = new Date(now);
      rangeStart.setMonth(rangeStart.getMonth() - 3);
    } else if (dateRange === '6months') {
      rangeStart = new Date(now);
      rangeStart.setMonth(rangeStart.getMonth() - 6);
    } else if (dateRange === 'custom' && (startDate || endDate)) {
      if (startDate) rangeStart = new Date(startDate);
      if (endDate) {
        rangeEnd = new Date(endDate);
        rangeEnd.setHours(23, 59, 59, 999);
      }
    }

    if (rangeStart || rangeEnd) {
      const dateField = status === 'Completed' ? 'completedAt' : 'createdAt';
      query[dateField] = {};
      if (rangeStart) query[dateField].$gte = rangeStart;
      if (rangeEnd) query[dateField].$lte = rangeEnd;
    }

    // 5. Search Filter across Token, OrderCode, Customer, Phone
    if (search && search.trim()) {
      const safeSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(safeSearch, 'i');

      query.$or = [
        { orderCode: searchRegex },
        { pickupToken: searchRegex },
        { 'walkInCustomer.name': searchRegex },
        { 'walkInCustomer.phone': searchRegex },
        { 'walkInCustomer.registerNumber': searchRegex },
        { 'walkInCustomer.staffId': searchRegex },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    // 6. Execute Queries & Aggregation in Parallel
    const [orders, totalCount, summaryAgg] = await Promise.all([
      Order.find(query)
        .populate('user', 'name email phone studentDetails staffDetails')
        .populate('cashier', 'name')
        .sort({ completedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Order.countDocuments(query),
      Order.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalCompletedOrders: { $sum: 1 },
            totalSales: { $sum: '$total' },
            onlineSales: {
              $sum: { $cond: [{ $eq: ['$orderType', 'ONLINE'] }, '$total', 0] },
            },
            walkInSales: {
              $sum: { $cond: [{ $eq: ['$orderType', 'WALK_IN'] }, '$total', 0] },
            },
            cashSales: {
              $sum: {
                $cond: [{ $in: ['$paymentMethod', ['cash', 'cod']] }, '$total', 0],
              },
            },
            digitalSales: {
              $sum: {
                $cond: [{ $in: ['$paymentMethod', ['razorpay', 'upi', 'card']] }, '$total', 0],
              },
            },
          },
        },
      ]),
    ]);

    const summary = summaryAgg[0] || {
      totalCompletedOrders: 0,
      totalSales: 0,
      onlineSales: 0,
      walkInSales: 0,
      cashSales: 0,
      digitalSales: 0,
    };

    res.json({
      success: true,
      summary,
      data: orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum) || 1,
      },
    });
  } catch (error) {
    console.error('Bill archive error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Single Bill for Thermal Reprint (Preserves purchase snapshot)
// @route   GET /api/admin/bills/:id
// @access  Private/Admin
export const getBillById = async (req, res) => {
  try {
    const query = buildSafeOrderQuery(req.params.id);
    if (!query) {
      return res.status(404).json({ success: false, message: 'Invalid bill identifier' });
    }

    const order = await Order.findOne(query)
      .populate('user', 'name email phone studentDetails staffDetails')
      .populate('cashier', 'name')
      .lean();

    if (!order) {
      return res.status(404).json({ success: false, message: 'Bill record not found' });
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Bill Retention Configuration
// @route   GET /api/admin/settings/bill-retention
// @access  Private/Admin
export const getRetentionSettings = async (req, res) => {
  try {
    let settings = await CanteenSettings.findOne({ key: 'default' }).lean();
    if (!settings) {
      settings = await CanteenSettings.create({ key: 'default', billRetentionMonths: 6 });
    }
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update Bill Retention Configuration (3 or 6 Months)
// @route   PUT /api/admin/settings/bill-retention
// @access  Private/Admin
export const updateRetentionSettings = async (req, res) => {
  try {
    const { billRetentionMonths } = req.body;
    const months = parseInt(billRetentionMonths, 10);

    if (months !== 3 && months !== 6) {
      return res.status(400).json({ success: false, message: 'Retention period must be either 3 or 6 months.' });
    }

    let settings = await CanteenSettings.findOne({ key: 'default' });
    if (!settings) {
      settings = new CanteenSettings({ key: 'default' });
    }

    settings.billRetentionMonths = months;
    await settings.save();

    res.json({
      success: true,
      message: `Bill retention updated to ${months} months successfully.`,
      data: settings,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Run Safe Cleanup for Expired Bills (Supports Preview & Execute)
// @route   POST /api/admin/settings/bill-retention/cleanup
// @access  Private/Admin
export const cleanupExpiredBills = async (req, res) => {
  try {
    const { preview = false } = req.body;

    const settings = await CanteenSettings.findOne({ key: 'default' });
    const months = settings?.billRetentionMonths || 6;

    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - months);

    // CRITICAL SAFETY CONDITIONS:
    // Only completed orders older than cutoff date are eligible
    // Never touches Placed, Confirmed, Preparing, or Ready orders awaiting pickup!
    const cleanupFilter = {
      status: { $in: ['Handover Bill', 'Completed'] },
      completedAt: { $lt: cutoffDate },
      paymentStatus: 'paid', // Never delete unresolved/disputed payments
    };

    const eligibleCount = await Order.countDocuments(cleanupFilter);

    if (preview) {
      const sample = await Order.find(cleanupFilter)
        .select('orderCode pickupToken total completedAt')
        .limit(10)
        .lean();

      return res.json({
        success: true,
        preview: true,
        retentionMonths: months,
        cutoffDate,
        eligibleCount,
        sampleRecords: sample,
      });
    }

    // Execute safe cleanup
    const deleteResult = await Order.deleteMany(cleanupFilter);

    if (settings) {
      settings.lastCleanupAt = new Date();
      settings.lastCleanupCount = deleteResult.deletedCount;
      await settings.save();
    }

    console.log(`[RETENTION CLEANUP] Safely archived/deleted ${deleteResult.deletedCount} completed orders older than ${months} months.`);

    res.json({
      success: true,
      message: `Cleanup completed. ${deleteResult.deletedCount} expired completed bills were safely pruned.`,
      deletedCount: deleteResult.deletedCount,
      cutoffDate,
    });
  } catch (error) {
    console.error('Retention cleanup error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

