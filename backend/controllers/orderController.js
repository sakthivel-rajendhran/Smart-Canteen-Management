import mongoose from 'mongoose';
import Order from '../models/Order.js';
import MenuItem from '../models/MenuItem.js';
import Coupon from '../models/Coupon.js';
import User from '../models/User.js';
import generateOrderCode from '../utils/generateOrderCode.js';
import {
  createAndEmitNotification,
  createAndEmitAdminNotification,
} from '../utils/notificationHelper.js';

// Helper to query orders safely by either orderCode or Mongo _id without CastError
const buildOrderQuery = (rawId) => {
  if (!rawId) return null;
  const id = String(rawId).trim();
  if (mongoose.Types.ObjectId.isValid(id)) {
    return { $or: [{ _id: id }, { orderCode: { $regex: new RegExp(`^${id}$`, 'i') } }] };
  }
  return { orderCode: { $regex: new RegExp(`^${id}$`, 'i') } };
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

    // 1. Verify items are available in stock
    let subtotal = 0;
    const verifiedItems = [];

    for (const item of items) {
      const dbItem = await MenuItem.findById(item.menuItem);
      if (!dbItem) {
        return res.status(404).json({ success: false, message: `Menu item not found: ${item.name}` });
      }

      if (!dbItem.available) {
        return res.status(400).json({
          success: false,
          message: `"${dbItem.name}" is sold out. Please remove it from your cart before checking out.`
        });
      }

      const itemTotal = dbItem.price * item.quantity;
      subtotal += itemTotal;

      verifiedItems.push({
        menuItem: dbItem._id,
        name: dbItem.name,
        price: dbItem.price,
        quantity: item.quantity,
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

    const order = await Order.create({
      orderCode,
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

    // Populate user details for real-time order broadcast
    const populatedOrder = await Order.findById(order._id).populate('user', 'name email');

    // Real-time broadcast to Admin & Student
    const io = req.app.get('socketio');
    if (io) {
      io.to('admin').emit('order:created', populatedOrder);
      io.emit('order:created', populatedOrder);

      // 1. Student notification: Order Placed
      await createAndEmitNotification(io, {
        userId: req.user._id,
        orderId: order._id,
        orderCode: order.orderCode,
        status: 'Placed',
        metadata: {
          orderCode: order.orderCode,
          total: order.total,
          itemsCount: order.items.length,
        },
      });

      // 2. Admin notification: New Order Received
      await createAndEmitAdminNotification(io, {
        title: '🔔 New Order Placed',
        message: `New order #${order.orderCode} received from ${req.user.name || 'Student'} (₹${order.total})`,
        icon: '🔔',
        priority: 'HIGH',
        orderId: order._id,
        metadata: {
          orderCode: order.orderCode,
          total: order.total,
          customerName: req.user.name,
        },
      });
    }

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: order
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
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
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

    const order = await Order.findOne(query).populate('user', 'name email');

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
    const validStatuses = ['Placed', 'Confirmed', 'Preparing', 'Ready', 'Completed', 'Cancelled'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const query = buildOrderQuery(req.params.id);
    if (!query) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const order = await Order.findOne(query).populate('user', 'name email');

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

    // Handle payment auto-settlement for COD on complete
    if (status === 'Completed' && order.paymentMethod === 'cod') {
      order.paymentStatus = 'paid';
    }

    await order.save();

    const io = req.app.get('socketio');
    if (io) {
      // 1. Create and emit real-time notification to the specific student
      await createAndEmitNotification(io, {
        userId: order.user._id,
        orderId: order._id,
        orderCode: order.orderCode,
        status: order.status,
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

      // 3. Notify admin page and general socket listeners
      io.to('admin').emit('order:updated', order);
      io.emit('order:updated', order);
      io.emit('order:statusChanged', {
        orderId: order._id,
        orderCode: order.orderCode,
        status: order.status,
        paymentStatus: order.paymentStatus,
        order,
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
      // Create and emit notification to the student
      await createAndEmitNotification(io, {
        userId: order.user,
        orderId: order._id,
        orderCode: order.orderCode,
        status: 'Cancelled',
        metadata: {
          orderCode: order.orderCode,
          cancelledBy: req.user.role === 'admin' ? 'Admin' : 'Student',
        },
      });

      io.to(`user:${order.user}`).emit('order:statusChanged', {
        orderId: order._id,
        orderCode: order.orderCode,
        status: 'Cancelled',
        paymentStatus: order.paymentStatus
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
      .populate('user', 'name email')
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
      .populate('user', 'name email phone')
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

export {
  createOrder,
  getMyOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  getAdminOrders,
  getActiveOrders,
};
