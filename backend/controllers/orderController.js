import mongoose from 'mongoose';
import crypto from 'crypto';
import Order from '../models/Order.js';
import MenuItem from '../models/MenuItem.js';
import Coupon from '../models/Coupon.js';
import User from '../models/User.js';
import generateOrderCode from '../utils/generateOrderCode.js';
import {
  createAndEmitNotification,
  createAndEmitAdminNotification,
} from '../utils/notificationHelper.js';

// Helper to query orders safely by orderCode, pickupToken, or Mongo _id without CastError
const buildOrderQuery = (rawId) => {
  if (!rawId) return null;
  const id = String(rawId).trim();
  const withoutPrefix = id.replace(/^DRS-/i, '');
  const withPrefix = id.toUpperCase().startsWith('DRS-') ? id : `DRS-${id}`;

  const conditions = [
    { orderCode: { $regex: new RegExp(`^${id}$`, 'i') } },
    { orderCode: { $regex: new RegExp(`^${withPrefix}$`, 'i') } },
    { pickupToken: { $regex: new RegExp(`^${id}$`, 'i') } },
    { pickupToken: { $regex: new RegExp(`^${withPrefix}$`, 'i') } },
    { pickupToken: { $regex: new RegExp(`^${withoutPrefix}$`, 'i') } },
  ];

  if (mongoose.Types.ObjectId.isValid(id)) {
    conditions.unshift({ _id: id });
  }

  return { $or: conditions };
};

// @desc    Create a new order
// @route   POST /api/orders
// @access  Private
const createOrder = async (req, res) => {
  try {
    const { items, couponCode, paymentMethod, paymentId } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'No items in order' });
    }

    // 1. Batch verify items from database in a single query
    const itemIds = items
      .map((item) => item?.menuItem)
      .filter((id) => id && mongoose.Types.ObjectId.isValid(id));

    if (itemIds.length !== items.length) {
      return res.status(400).json({ success: false, message: 'Invalid item ID found in order' });
    }

    const dbItems = await MenuItem.find({ _id: { $in: itemIds } }).lean();
    const dbItemMap = new Map(dbItems.map((item) => [item._id.toString(), item]));

    let subtotal = 0;
    const verifiedItems = [];

    for (const item of items) {
      const qty = Number(item.quantity);
      if (!Number.isInteger(qty) || qty < 1 || qty > 20) {
        return res.status(400).json({
          success: false,
          message: 'Quantity must be a whole number between 1 and 20'
        });
      }

      const dbItem = dbItemMap.get(String(item.menuItem));
      if (!dbItem) {
        return res.status(404).json({ success: false, message: `Menu item not found: ${item.name || item.menuItem}` });
      }

      if (!dbItem.available) {
        return res.status(400).json({
          success: false,
          message: `"${dbItem.name}" is sold out. Please remove it from your cart before checking out.`
        });
      }

      const itemTotal = dbItem.price * qty;
      subtotal += itemTotal;

      verifiedItems.push({
        menuItem: dbItem._id,
        name: dbItem.name,
        price: dbItem.price,
        quantity: qty,
        emoji: dbItem.emoji,
        image: (dbItem.image && typeof dbItem.image === 'object' ? dbItem.image.url : dbItem.image) || '',
      });
    }

    // 2. Validate coupon discount
    let discount = 0;
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), active: true });
      if (coupon && new Date(coupon.expiryDate) > new Date() && subtotal >= coupon.minimumOrder) {
        if (coupon.discountType === 'flat') {
          discount = coupon.discountValue;
        } else if (coupon.discountType === 'percentage') {
          discount = (subtotal * coupon.discountValue) / 100;
          if (coupon.maxDiscount > 0 && discount > coupon.maxDiscount) {
            discount = coupon.maxDiscount;
          }
        }
        discount = Math.min(subtotal, discount);
        
        // Increment coupon usage
        coupon.usedCount += 1;
        await coupon.save();
      }
    }

    const total = subtotal - discount;
    const orderCode = await generateOrderCode();
    const pickupToken = orderCode; // Consistent DRS-XXXX format
    const pickupSecret = `sec_${crypto.randomBytes(6).toString('hex')}`;

    const order = await Order.create({
      orderCode,
      orderType: 'ONLINE',
      pickupToken,
      pickupSecret,
      user: req.user._id,
      items: verifiedItems,
      subtotal,
      discount,
      total,
      coupon: couponCode || '',
      paymentMethod,
      paymentStatus: paymentMethod === 'cod' ? 'cod' : 'pending',
      paymentId: paymentId || '',
      status: 'Placed',
    });

    // Send HTTP response immediately (non-blocking)
    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: order
    });

    // Populate user in memory and emit real-time events & notifications asynchronously
    setImmediate(async () => {
      try {
        const io = req.app.get('socketio');
        if (!io) return;

        const populatedOrder = {
          ...order.toObject(),
          user: {
            _id: req.user._id,
            name: req.user.name,
            email: req.user.email,
            phone: req.user.phone,
            role: req.user.role,
            accountType: req.user.accountType || req.user.role,
            studentDetails: req.user.studentDetails,
            staffDetails: req.user.staffDetails,
          },
        };

        io.to('admin').emit('order:created', populatedOrder);

        const isOrderPlacerAdmin = req.user.role === 'admin' || req.user.role === 'ADMIN';

        // 1. Student notification: Order Placed (only for non-admin customers, avoiding duplicate alerts if admin placed order)
        if (!isOrderPlacerAdmin) {
          await createAndEmitNotification(io, {
            userId: req.user._id,
            orderId: order._id,
            orderCode: order.orderCode,
            status: 'Placed',
            eventId: `ORDER_CUSTOMER_${order.orderCode}_PLACED`,
            metadata: {
              orderCode: order.orderCode,
              total: order.total,
              itemsCount: order.items.length,
              customerName: req.user.name,
            },
          });
        }

        // 2. Admin notification: New Order Received (idempotent, single notification per admin)
        await createAndEmitAdminNotification(io, {
          title: '🔔 New Order Placed',
          message: `New order #${order.orderCode} received from ${req.user.name || 'Customer'} (₹${order.total})`,
          icon: '🔔',
          priority: 'HIGH',
          orderId: order._id,
          orderCode: order.orderCode,
          eventId: `ORDER_ADMIN_${order.orderCode}_PLACED`,
          metadata: {
            orderCode: order.orderCode,
            total: order.total,
            itemsCount: order.items.length,
            customerName: req.user.name,
          },
        });
      } catch (err) {
        console.error('Non-blocking order notification error:', err.message);
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get current user's order history
// @route   GET /api/orders/my
// @access  Private
const getMyOrders = async (req, res) => {
  try {
    const { page, limit } = req.query;

    if (page || limit) {
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
      const skip = (pageNum - 1) * limitNum;

      const [orders, total] = await Promise.all([
        Order.find({ user: req.user._id })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Order.countDocuments({ user: req.user._id }),
      ]);

      return res.json({
        success: true,
        data: orders,
        pagination: {
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum) || 1,
          total,
        },
      });
    }

    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single order by code or id
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = async (req, res) => {
  try {
    const query = buildOrderQuery(req.params.id);
    if (!query) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const order = await Order.findOne(query).populate('user', 'name email phone role accountType studentDetails staffDetails');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Verify ownership (only user who ordered or admin can view)
    const orderUserId = order.user?._id ? order.user._id.toString() : order.user?.toString();
    if (orderUserId && orderUserId !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to view this order' });
    }

    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update order status
// @route   PATCH /api/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = [
      'Placed',
      'Confirmed',
      'Preparing',
      'Ready',
      'Pickup Bill',
      'Handover Bill',
      'Completed',
      'Cancelled',
    ];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const query = buildOrderQuery(req.params.id);
    if (!query) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const order = await Order.findOne(query).populate('user', 'name email phone role accountType studentDetails staffDetails');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Section 25: Duplicate notification prevention
    if (order.status === status) {
      return res.json({
        success: true,
        message: `Order status is already ${status}`,
        data: order,
      });
    }

    order.status = status;

    // Handle payment auto-settlement and handover stamping for Handover Bill / Completed
    if (status === 'Completed' || status === 'Handover Bill') {
      if (order.paymentMethod === 'cod' || order.paymentStatus === 'pending') {
        order.paymentStatus = 'paid';
      }
      order.handoverVerified = true;
      order.completedAt = order.completedAt || new Date();
      order.handoverVerifiedAt = order.handoverVerifiedAt || new Date();
      order.handoverVerifiedBy = req.user._id;
    }

    await order.save();

    const io = req.app.get('socketio');
    if (io) {
      // 1. Create and emit real-time notification to the specific student (idempotent, single transition alert)
      await createAndEmitNotification(io, {
        userId: order.user._id,
        orderId: order._id,
        orderCode: order.orderCode,
        status: order.status,
        eventId: `ORDER_CUSTOMER_${order.orderCode}_${order.status.toUpperCase()}`,
        metadata: {
          orderCode: order.orderCode,
          total: order.total,
          itemsCount: order.items?.length,
        },
      });

      // 2. Notify the specific student tracking their order page
      io.to(`user:${order.user._id}`).emit('order:statusChanged', {
        orderId: order._id,
        orderCode: order.orderCode,
        status: order.status,
        paymentStatus: order.paymentStatus,
        order,
      });

      // 3. Notify admin page
      io.to('admin').emit('order:updated', order);

      // 4. Broadcast live ready tokens change to public counter display
      io.emit('pickup:readyTokensChanged', {
        orderId: order._id,
        orderCode: order.orderCode,
        pickupToken: order.pickupToken || order.orderCode,
        status: order.status,
        readyAt: order.updatedAt,
      });
    }

    res.json({ success: true, message: `Order status updated to ${status}`, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Cancel order (User can only cancel when Placed or Confirmed)
// @route   PATCH /api/orders/:id/cancel
// @access  Private
const cancelOrder = async (req, res) => {
  try {
    const query = buildOrderQuery(req.params.id);
    if (!query) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const order = await Order.findOne(query);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Verify ownership
    const orderUserId = order.user?._id ? order.user._id.toString() : order.user?.toString();
    if (orderUserId && orderUserId !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this order' });
    }

    // Prevent duplicate cancellation
    if (order.status === 'Cancelled') {
      return res.json({ success: true, message: 'Order is already cancelled', data: order });
    }

    // Validate cancellation stage
    if (order.status !== 'Placed' && order.status !== 'Confirmed' && req.user.role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled as prep is already in progress'
      });
    }

    order.status = 'Cancelled';
    if (order.paymentStatus === 'pending') {
      order.paymentStatus = 'failed';
    }
    await order.save();

    const io = req.app.get('socketio');
    if (io) {
      const cancelledByRole = (req.user.role === 'admin' || req.user.role === 'ADMIN') ? 'Admin' : 'Student';

      // 1. Create and emit notification to the customer (idempotent)
      await createAndEmitNotification(io, {
        userId: order.user,
        orderId: order._id,
        orderCode: order.orderCode,
        status: 'Cancelled',
        eventId: `ORDER_CUSTOMER_${order.orderCode}_CANCELLED`,
        metadata: {
          orderCode: order.orderCode,
          cancelledBy: cancelledByRole,
        },
      });

      // 2. If student cancelled, notify admins idempotently
      if (cancelledByRole === 'Student') {
        await createAndEmitAdminNotification(io, {
          title: '⚠ Order Cancelled',
          message: `Order #${order.orderCode} was cancelled by ${req.user.name || 'Customer'}.`,
          icon: '⚠',
          priority: 'HIGH',
          orderId: order._id,
          orderCode: order.orderCode,
          eventId: `ORDER_ADMIN_${order.orderCode}_CANCELLED`,
          metadata: {
            orderCode: order.orderCode,
            cancelledBy: 'Student',
          },
        });
      }

      io.to(`user:${order.user}`).emit('order:statusChanged', {
        orderId: order._id,
        orderCode: order.orderCode,
        status: 'Cancelled',
        paymentStatus: order.paymentStatus
      });

      // Broadcast update to counter display in case a ready order was cancelled
      io.emit('pickup:readyTokensChanged', {
        orderId: order._id,
        orderCode: order.orderCode,
        pickupToken: order.pickupToken || order.orderCode,
        status: 'Cancelled',
      });
      io.to('admin').emit('order:updated', order);
    }

    res.json({ success: true, message: 'Order cancelled successfully', data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all orders (Admin only, support pagination and filter)
// @route   GET /api/orders
// @access  Private/Admin
const getAdminOrders = async (req, res) => {
  try {
    const { status, page, limit } = req.query;
    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const skipNum = (pageNum - 1) * limitNum;

    const orders = await Order.find(query)
      .populate('user', 'name email phone role accountType studentDetails staffDetails')
      .sort({ createdAt: -1 })
      .skip(skipNum)
      .limit(limitNum);

    const totalOrders = await Order.countDocuments(query);

    res.json({
      success: true,
      data: orders,
      pagination: {
        total: totalOrders,
        page: pageNum,
        pages: Math.ceil(totalOrders / limitNum),
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get active live orders (Placed, Confirmed, Preparing, Ready)
// @route   GET /api/orders/active
// @access  Private/Admin
const getActiveOrders = async (req, res) => {
  try {
    const { status, search, paymentMethod } = req.query;

    // Default: only active order stages
    let query = {
      status: { $in: ['Placed', 'Confirmed', 'Preparing', 'Ready'] },
    };

    if (status && status !== 'all' && status !== 'active') {
      query.status = status;
    } else if (status === 'all') {
      delete query.status;
    }

    if (paymentMethod && paymentMethod !== 'all') {
      query.paymentMethod = paymentMethod;
    }

    if (search && search.trim()) {
      const q = search.trim();
      const matchedUsers = await User.find({
        $or: [
          { name: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
        ],
      }).select('_id');

      const userIds = matchedUsers.map((u) => u._id);

      query.$or = [
        { orderCode: { $regex: q, $options: 'i' } },
        { user: { $in: userIds } },
      ];
    }

    const orders = await Order.find(query)
      .populate('user', 'name email phone role accountType studentDetails staffDetails')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all active READY orders for public counter display
// @route   GET /api/orders/public/ready-tokens
// @access  Public (No credentials required, strictly zero PII)
const getPublicReadyTokens = async (req, res) => {
  try {
    const readyOrders = await Order.find({ status: 'Ready' })
      .select('orderCode pickupToken orderType updatedAt createdAt')
      .sort({ updatedAt: 1 }) // Oldest ready order first
      .lean();

    const data = readyOrders.map((o) => {
      const rawToken = o.pickupToken || o.orderCode;
      const formattedToken = String(rawToken).toUpperCase().startsWith('DRS-')
        ? String(rawToken).toUpperCase()
        : `DRS-${rawToken}`;

      return {
        orderCode: o.orderCode,
        pickupToken: formattedToken,
        orderType: o.orderType || 'ONLINE',
        readyAt: o.updatedAt || o.createdAt,
      };
    });

    res.json({
      success: true,
      count: data.length,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export {
  createOrder,
  getMyOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  getAdminOrders,
  getActiveOrders,
  getPublicReadyTokens,
};
