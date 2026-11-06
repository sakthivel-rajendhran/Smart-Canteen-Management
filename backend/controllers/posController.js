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

// Safe query helper by bill number, order code, token, secret, or Mongo ID
const buildSafeOrderQuery = (rawQuery) => {
  if (!rawQuery) return null;
  const term = String(rawQuery).trim();
  const withoutPrefix = term.replace(/^DRS-/i, '').replace(/^BILL-/i, '');
  const withPrefix = term.toUpperCase().startsWith('DRS-') ? term : `DRS-${term}`;
  const withBillPrefix = term.toUpperCase().startsWith('BILL-') ? term : `BILL-${term}`;

  const conditions = [
    { billNumber: { $regex: new RegExp(`^${term}$`, 'i') } },
    { billNumber: { $regex: new RegExp(`^${withBillPrefix}$`, 'i') } },
    { billNumber: { $regex: new RegExp(`^BILL-${withPrefix}$`, 'i') } },
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
    const billNumber = `BILL-${orderCode}`;
    const now = new Date();

    // 3. Create WALK_IN Order document (Bill automatically printed at counter)
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
      billNumber,
      billStatus: 'PRINTED',
      billGeneratedAt: now,
      billPrintedAt: now,
      billPrintCount: 1,
      handoverStatus: 'PENDING',
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

// @desc    Get All Orders for Handover Management Queue (Awaiting vs Pending vs Completed)
// @route   GET /api/admin/pos/handover-orders
// @access  Private/Admin
export const getHandoverOrders = async (req, res) => {
  try {
    const { filter = 'awaiting', search = '' } = req.query;
    const query = {};

    if (filter === 'awaiting') {
      // Primary queue: paid and bill printed, waiting for physical collection at food counter
      query.handoverStatus = 'PENDING';
      query.paymentStatus = 'paid';
      query.billStatus = 'PRINTED';
      query.status = { $ne: 'Cancelled' };
    } else if (filter === 'completed') {
      query.$or = [
        { handoverStatus: 'COMPLETED' },
        { status: { $in: ['Handover Bill', 'Completed'] } },
      ];
    } else if (filter === 'pending') {
      // All pending handovers (including awaiting bill print)
      query.handoverStatus = { $ne: 'COMPLETED' };
      query.status = { $nin: ['Handover Bill', 'Completed', 'Cancelled'] };
    } else if (filter === 'all') {
      query.status = { $nin: ['Cancelled'] };
    } else {
      // Default fallback
      query.handoverStatus = 'PENDING';
      query.status = { $nin: ['Handover Bill', 'Completed', 'Cancelled'] };
    }

    if (search && search.trim()) {
      const safeSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(safeSearch, 'i');

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

      const searchConditions = [
        { billNumber: searchRegex },
        { orderCode: searchRegex },
        { pickupToken: searchRegex },
        { 'walkInCustomer.name': searchRegex },
        { 'walkInCustomer.phone': searchRegex },
        { 'walkInCustomer.registerNumber': searchRegex },
        { 'walkInCustomer.staffId': searchRegex },
        ...(userIds.length > 0 ? [{ user: { $in: userIds } }] : []),
      ];

      query.$and = [
        ...(query.$and || []),
        { $or: searchConditions },
      ];
    }

    const [orders, awaitingCount, pendingCount, completedCount] = await Promise.all([
      Order.find(query)
        .populate('user', 'name email phone role accountType studentDetails staffDetails')
        .populate('cashier', 'name')
        .populate('handoverVerifiedBy', 'name')
        .sort(filter === 'completed' ? { completedAt: -1, updatedAt: -1 } : { updatedAt: 1 })
        .lean(),
      Order.countDocuments({
        handoverStatus: 'PENDING',
        paymentStatus: 'paid',
        billStatus: 'PRINTED',
        status: { $ne: 'Cancelled' },
      }),
      Order.countDocuments({
        handoverStatus: { $ne: 'COMPLETED' },
        status: { $nin: ['Handover Bill', 'Completed', 'Cancelled'] },
      }),
      Order.countDocuments({
        $or: [
          { handoverStatus: 'COMPLETED' },
          { status: { $in: ['Handover Bill', 'Completed'] } },
        ],
      }),
    ]);

    // Ensure billNumber is defaulted if not set
    const enrichedOrders = orders.map((o) => ({
      ...o,
      billNumber: o.billNumber || `BILL-${o.orderCode}`,
    }));

    res.json({
      success: true,
      count: enrichedOrders.length,
      data: enrichedOrders,
      stats: {
        awaiting: awaitingCount,
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
      .sort({ updatedAt: 1 })
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

// @desc    BUTTON 1: Print Thermal Bill (Confirms payment & marks billStatus -> PRINTED)
// @route   POST /api/admin/pos/print-bill
// @access  Private/Admin
export const printBill = async (req, res) => {
  try {
    const { orderId, token, billNumber } = req.body;
    const queryTerm = orderId || token || billNumber;

    if (!queryTerm) {
      return res.status(400).json({ success: false, message: 'Please provide an order ID, pickup token, or bill number.' });
    }

    const query = buildSafeOrderQuery(queryTerm);
    const order = await Order.findOne(query)
      .populate('user', 'name email phone studentDetails staffDetails')
      .populate('cashier', 'name');

    if (!order) {
      return res.status(404).json({ success: false, message: `No order found matching "${queryTerm}".` });
    }

    // Payment validation: Section 3: Only allow bill printing after successful payment confirmation
    if (order.paymentStatus !== 'paid') {
      return res.status(400).json({
        success: false,
        unpaid: true,
        message: `Payment of ₹${order.total} has not been collected! Please confirm payment before printing the physical bill.`,
        order,
      });
    }

    const isFirstPrint = !order.billNumber || order.billStatus !== 'PRINTED';
    if (!order.billNumber) {
      order.billNumber = `BILL-${order.orderCode}`;
    }
    if (!order.billGeneratedAt) {
      order.billGeneratedAt = new Date();
    }
    order.billStatus = 'PRINTED';
    order.billPrintedAt = new Date();
    order.billPrintCount = (order.billPrintCount || 0) + 1;

    // Move status to Pickup Bill / Awaiting Handover if in earlier stages
    if (['Placed', 'Confirmed', 'Preparing', 'Ready'].includes(order.status)) {
      order.status = 'Pickup Bill';
    }

    await order.save();

    const io = req.app.get('socketio');
    if (io) {
      io.to('admin').emit('order:updated', order);
    }

    res.json({
      success: true,
      isReprint: !isFirstPrint,
      message: isFirstPrint
        ? `Bill #${order.billNumber} generated and printed successfully.`
        : `Bill #${order.billNumber} reprinted (Copy #${order.billPrintCount}).`,
      data: order,
    });
  } catch (error) {
    console.error('Print bill error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Record Cash/Counter Payment before Bill Printing
// @route   POST /api/admin/pos/record-payment
// @access  Private/Admin
export const recordPayment = async (req, res) => {
  try {
    const { orderId, token, paymentMethod = 'cash' } = req.body;
    const queryTerm = orderId || token;

    if (!queryTerm) {
      return res.status(400).json({ success: false, message: 'Please provide an order ID or pickup token.' });
    }

    const query = buildSafeOrderQuery(queryTerm);
    const order = await Order.findOne(query);

    if (!order) {
      return res.status(404).json({ success: false, message: `No order found matching "${queryTerm}".` });
    }

    order.paymentStatus = 'paid';
    if (paymentMethod) {
      order.paymentMethod = paymentMethod;
    }
    await order.save();

    const io = req.app.get('socketio');
    if (io) {
      io.to('admin').emit('order:updated', order);
    }

    res.json({
      success: true,
      message: `Payment of ₹${order.total} confirmed as ${String(order.paymentMethod).toUpperCase()}!`,
      data: order,
    });
  } catch (error) {
    console.error('Record payment error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    BUTTON 2: Handover Food (Physical food collection confirmation -> Status: Completed)
// @route   POST /api/admin/pos/verify-pickup
// @access  Private/Admin
export const verifyAndHandoverOrder = async (req, res) => {
  try {
    const { token, orderId, secret, billNumber } = req.body;
    const queryTerm = token || orderId || secret || billNumber || req.params.id;

    if (!queryTerm) {
      return res.status(400).json({ success: false, message: 'Please provide a pickup token, Order Code, or Bill Number.' });
    }

    const query = buildSafeOrderQuery(queryTerm);
    const order = await Order.findOne(query)
      .populate('user', 'name email phone studentDetails staffDetails')
      .populate('cashier', 'name');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `No order found matching "${queryTerm}". Please check the physical bill or token.`,
      });
    }

    // STRICT DUPLICATE HANDOVER PROTECTION
    if (
      order.status === 'Completed' ||
      order.status === 'Handover Bill' ||
      order.handoverVerified ||
      order.handoverStatus === 'COMPLETED'
    ) {
      const collectedTime = order.completedAt || order.handoverVerifiedAt
        ? new Date(order.completedAt || order.handoverVerifiedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
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

    // Payment validation: Cannot handover unpaid food
    if (order.paymentStatus !== 'paid') {
      return res.status(400).json({
        success: false,
        unpaid: true,
        message: `Payment of ₹${order.total} has not been collected! Please collect payment before handing over food.`,
        order,
      });
    }

    // Update order status to Completed & mark physical handover
    order.status = 'Completed';
    order.completedAt = new Date();
    order.handoverStatus = 'COMPLETED';
    order.handoverVerified = true;
    order.handoverVerifiedAt = new Date();
    order.handoverVerifiedBy = req.user._id;

    // Ensure billNumber is populated
    if (!order.billNumber) {
      order.billNumber = `BILL-${order.orderCode}`;
    }
    if (!order.billGeneratedAt) {
      order.billGeneratedAt = new Date();
    }
    if (order.billStatus === 'NOT_GENERATED') {
      order.billStatus = 'PRINTED';
      order.billPrintedAt = new Date();
      order.billPrintCount = (order.billPrintCount || 0) + 1;
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
        status: 'Completed',
      });

      if (order.user) {
        // Update customer tracking timeline immediately
        io.to(`user:${order.user._id || order.user}`).emit('order:statusChanged', {
          orderId: order._id,
          orderCode: order.orderCode,
          status: 'Completed',
          paymentStatus: order.paymentStatus,
          order,
        });
      }
    }

    res.json({
      success: true,
      message: `✓ Food handed over! Order #${order.orderCode} (Token #${order.pickupToken}) marked as Completed.`,
      data: order,
    });
  } catch (error) {
    console.error('Handover verification error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Completed Bill History & Daily Sales Archive (with Date Filters & Stats)
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
      handoverStatus = 'ALL',
      search = '',
      page = 1,
      limit = 20,
    } = req.query;

    const query = {
      $or: [
        { billStatus: { $in: ['GENERATED', 'PRINTED'] } },
        { status: { $in: ['Handover Bill', 'Completed'] } },
        { billNumber: { $exists: true, $ne: '' } },
      ],
    };

    // 1. Order Channel Filter
    if (orderType && orderType !== 'ALL') {
      query.orderType = orderType.toUpperCase();
    }

    // 2. Payment Method Filter
    if (paymentMethod && paymentMethod !== 'ALL') {
      query.paymentMethod = paymentMethod.toLowerCase();
    }

    // 3. Handover Status Filter
    if (handoverStatus && handoverStatus !== 'ALL') {
      query.handoverStatus = handoverStatus.toUpperCase();
    }

    // 4. Date Range Filtering based on creation/billing
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
      rangeEnd = new Date();
    } else if (dateRange === '30days') {
      rangeStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      rangeEnd = new Date();
    } else if (dateRange === 'custom' && (startDate || endDate)) {
      if (startDate) rangeStart = new Date(startDate);
      if (endDate) {
        rangeEnd = new Date(endDate);
        rangeEnd.setHours(23, 59, 59, 999);
      }
    }

    if (rangeStart || rangeEnd) {
      query.createdAt = {};
      if (rangeStart) query.createdAt.$gte = rangeStart;
      if (rangeEnd) query.createdAt.$lte = rangeEnd;
    }

    // 5. Search Filter across BillNumber, OrderCode, Token, Customer, Phone
    if (search && search.trim()) {
      const safeSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(safeSearch, 'i');

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

      query.$and = [
        ...(query.$and || []),
        {
          $or: [
            { billNumber: searchRegex },
            { orderCode: searchRegex },
            { pickupToken: searchRegex },
            { 'walkInCustomer.name': searchRegex },
            { 'walkInCustomer.phone': searchRegex },
            { 'walkInCustomer.registerNumber': searchRegex },
            { 'walkInCustomer.staffId': searchRegex },
            ...(userIds.length > 0 ? [{ user: { $in: userIds } }] : []),
          ],
        },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    // 6. Execute Queries & Aggregation in Parallel (Section 7 Daily Founder Report Stats)
    const [orders, totalCount, summaryAgg] = await Promise.all([
      Order.find(query)
        .populate('user', 'name email phone studentDetails staffDetails')
        .populate('cashier', 'name')
        .populate('handoverVerifiedBy', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Order.countDocuments(query),
      Order.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalBillsPrinted: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $eq: ['$billStatus', 'PRINTED'] },
                      { $gt: ['$billPrintCount', 0] },
                      { $and: [{ $ne: ['$billNumber', ''] }, { $ne: ['$billNumber', null] }] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            totalOrders: { $sum: 1 },
            totalSales: {
              $sum: {
                $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$total', 0],
              },
            },
            cashCollections: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $in: ['$paymentMethod', ['cash', 'cod']] },
                      { $eq: ['$paymentStatus', 'paid'] },
                    ],
                  },
                  '$total',
                  0,
                ],
              },
            },
            upiCollections: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $in: ['$paymentMethod', ['upi', 'online', 'razorpay', 'card']] },
                      { $eq: ['$paymentStatus', 'paid'] },
                    ],
                  },
                  '$total',
                  0,
                ],
              },
            },
            pendingPayments: {
              $sum: {
                $cond: [{ $ne: ['$paymentStatus', 'paid'] }, '$total', 0],
              },
            },
            completedHandovers: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $eq: ['$handoverStatus', 'COMPLETED'] },
                      { $in: ['$status', ['Completed', 'Handover Bill']] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            pendingHandovers: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ['$handoverStatus', 'COMPLETED'] },
                      { $nin: ['$status', ['Completed', 'Handover Bill', 'Cancelled']] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
    ]);

    const summary = summaryAgg[0] || {
      totalBillsPrinted: 0,
      totalOrders: 0,
      totalSales: 0,
      cashCollections: 0,
      upiCollections: 0,
      pendingPayments: 0,
      completedHandovers: 0,
      pendingHandovers: 0,
    };

    const enrichedOrders = orders.map((o) => ({
      ...o,
      billNumber: o.billNumber || `BILL-${o.orderCode}`,
      billStatus: o.billStatus || (o.handoverVerified ? 'PRINTED' : 'GENERATED'),
      handoverStatus: o.handoverStatus || (o.handoverVerified || o.status === 'Completed' || o.status === 'Handover Bill' ? 'COMPLETED' : 'PENDING'),
    }));

    res.json({
      success: true,
      summary,
      data: enrichedOrders,
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

// @desc    Get Daily Sales Breakdown for Founder Report
// @route   GET /api/admin/bills/founder-report
// @access  Private/Admin
export const getFounderReport = async (req, res) => {
  try {
    const { dateRange = 'today', startDate, endDate } = req.query;

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
      rangeEnd = new Date();
    } else if (dateRange === '30days') {
      rangeStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      rangeEnd = new Date();
    } else if (dateRange === 'custom' && (startDate || endDate)) {
      if (startDate) rangeStart = new Date(startDate);
      if (endDate) {
        rangeEnd = new Date(endDate);
        rangeEnd.setHours(23, 59, 59, 999);
      }
    }

    const matchQuery = {};
    if (rangeStart || rangeEnd) {
      matchQuery.createdAt = {};
      if (rangeStart) matchQuery.createdAt.$gte = rangeStart;
      if (rangeEnd) matchQuery.createdAt.$lte = rangeEnd;
    }

    const orders = await Order.find(matchQuery).lean();

    let totalOrders = orders.length;
    let totalBillsPrinted = 0;
    let totalItemsSold = 0;
    let grossSales = 0;
    let discounts = 0;
    let netSales = 0;
    let cashCollections = 0;
    let upiCollections = 0;
    let pendingPayments = 0;
    let completedHandovers = 0;
    let pendingHandovers = 0;

    const dailyBreakdown = {};

    for (const ord of orders) {
      if (ord.status === 'Cancelled') continue;

      const isPaid = ord.paymentStatus === 'paid';
      const ordSubtotal = Number(ord.subtotal || ord.total || 0);
      const ordDiscount = Number(ord.discount || 0);
      const ordTotal = Number(ord.total || 0);

      if (ord.billStatus === 'PRINTED' || ord.billPrintCount > 0 || (ord.billNumber && ord.billNumber !== '')) {
        totalBillsPrinted++;
      }

      if (ord.handoverStatus === 'COMPLETED' || ord.status === 'Completed' || ord.status === 'Handover Bill') {
        completedHandovers++;
      } else {
        pendingHandovers++;
      }

      grossSales += ordSubtotal;
      discounts += ordDiscount;

      if (isPaid) {
        netSales += ordTotal;
        if (ord.paymentMethod === 'cash' || ord.paymentMethod === 'cod') {
          cashCollections += ordTotal;
        } else if (['upi', 'online', 'razorpay', 'card'].includes(ord.paymentMethod)) {
          upiCollections += ordTotal;
        }
      } else {
        pendingPayments += ordTotal;
      }

      for (const it of ord.items || []) {
        totalItemsSold += Number(it.quantity || 1);
      }

      const dKey = new Date(ord.createdAt).toISOString().split('T')[0];
      if (!dailyBreakdown[dKey]) {
        dailyBreakdown[dKey] = {
          date: dKey,
          ordersCount: 0,
          grossSales: 0,
          discounts: 0,
          netSales: 0,
          cashCollected: 0,
          upiCollected: 0,
          pendingAmount: 0,
          itemsCount: 0,
        };
      }
      dailyBreakdown[dKey].ordersCount++;
      dailyBreakdown[dKey].grossSales += ordSubtotal;
      dailyBreakdown[dKey].discounts += ordDiscount;
      if (isPaid) {
        dailyBreakdown[dKey].netSales += ordTotal;
        if (ord.paymentMethod === 'cash' || ord.paymentMethod === 'cod') {
          dailyBreakdown[dKey].cashCollected += ordTotal;
        }
        if (['upi', 'online', 'razorpay', 'card'].includes(ord.paymentMethod)) {
          dailyBreakdown[dKey].upiCollected += ordTotal;
        }
      } else {
        dailyBreakdown[dKey].pendingAmount += ordTotal;
      }
      dailyBreakdown[dKey].itemsCount += (ord.items || []).reduce((s, i) => s + (i.quantity || 1), 0);
    }

    res.json({
      success: true,
      data: {
        dateRange,
        startDate: rangeStart,
        endDate: rangeEnd,
        totalOrders,
        totalBillsPrinted,
        totalItemsSold,
        grossSales,
        discounts,
        netSales,
        cashCollections,
        upiCollections,
        pendingPayments,
        completedHandovers,
        pendingHandovers,
        dailyBreakdown: Object.values(dailyBreakdown).sort((a, b) => b.date.localeCompare(a.date)),
      },
    });
  } catch (error) {
    console.error('Founder report error:', error);
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
      .populate('handoverVerifiedBy', 'name')
      .lean();

    if (!order) {
      return res.status(404).json({ success: false, message: 'Bill record not found' });
    }

    const enriched = {
      ...order,
      billNumber: order.billNumber || `BILL-${order.orderCode}`,
      billStatus: order.billStatus || (order.handoverVerified ? 'PRINTED' : 'GENERATED'),
      handoverStatus: order.handoverStatus || (order.handoverVerified || order.status === 'Completed' || order.status === 'Handover Bill' ? 'COMPLETED' : 'PENDING'),
    };

    res.json({
      success: true,
      data: enriched,
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
        .select('orderCode pickupToken billNumber total completedAt')
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
