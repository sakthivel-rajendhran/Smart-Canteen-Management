import mongoose from 'mongoose';
import crypto from 'crypto';
import Order from '../models/Order.js';
import MenuItem from '../models/MenuItem.js';
import Coupon from '../models/Coupon.js';
import User from '../models/User.js';
import { isGlobalCouponsEnabled } from './couponController.js';
import {
  getOrCreateParcelSettings,
  isItemParcelEligible,
  resolveItemParcelPricing,
} from '../utils/parcelHelper.js';
import { resolveOrderVariantSelection } from '../utils/variantHelper.js';
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
  let appliedCouponCode = '';

  try {
    const { items, couponCode, paymentMethod, paymentId, clientRequestId } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'No items in order' });
    }

    // 1. Idempotency Check: if clientRequestId is provided and order exists, return existing order
    if (clientRequestId && typeof clientRequestId === 'string' && clientRequestId.trim()) {
      const existingOrder = await Order.findOne({
        user: req.user._id,
        clientRequestId: clientRequestId.trim(),
      }).lean();

      if (existingOrder) {
        return res.status(200).json({
          success: true,
          message: 'Order already placed (idempotent)',
          data: existingOrder,
        });
      }
    }

    // 2. Active Orders Limit: maximum 3 active orders per student
    const activeOrderCount = await Order.countDocuments({
      user: req.user._id,
      status: { $in: ['Placed', 'Confirmed', 'Preparing', 'Ready', 'Pickup Bill'] },
    });

    if (activeOrderCount >= 3) {
      return res.status(400).json({
        success: false,
        message: 'You have reached the maximum limit of 3 active orders. Please wait until your previous orders are completed before placing a new one.',
      });
    }

    // 3. Batch verify items from database in a single query
    const itemIds = items
      .map((item) => item?.menuItem)
      .filter((id) => id && mongoose.Types.ObjectId.isValid(id));

    if (itemIds.length !== items.length) {
      return res.status(400).json({ success: false, message: 'Invalid item ID found in order' });
    }

    const dbItems = await MenuItem.find({ _id: { $in: itemIds } })
      .populate('category', 'name active parcelEligible')
      .populate('categories', 'name active parcelEligible')
      .lean();
    const dbItemMap = new Map(dbItems.map((item) => [item._id.toString(), item]));
    const parentIds = dbItems
      .map((item) => item.variantParent)
      .filter(Boolean)
      .map((id) => String(id));
    const parentDocs =
      parentIds.length > 0
        ? await MenuItem.find({ _id: { $in: parentIds } })
            .populate('category', 'name active parcelEligible')
            .populate('categories', 'name active parcelEligible')
            .lean()
        : [];
    const parentItemMap = new Map(parentDocs.map((item) => [item._id.toString(), item]));
    const { parcelEnabled, parcelChargePerItem } = await getOrCreateParcelSettings();

    let subtotal = 0;
    let parcelChargeTotal = 0;
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

      const parentDoc = dbItem.variantParent
        ? parentItemMap.get(String(dbItem.variantParent)) || null
        : null;
      const effectiveItemForCat = parentDoc || dbItem;

      const assignedCats = [
        effectiveItemForCat.category,
        ...(Array.isArray(effectiveItemForCat.categories) ? effectiveItemForCat.categories : []),
      ].filter(Boolean);
      if (assignedCats.length > 0 && !assignedCats.some((c) => c.active !== false)) {
        return res.status(400).json({
          success: false,
          message: `"${effectiveItemForCat.name}" belongs to an inactive category ("${effectiveItemForCat.category?.name || 'Inactive'}") and cannot be ordered right now.`
        });
      }

      if (!effectiveItemForCat.available) {
        return res.status(400).json({
          success: false,
          message: `"${effectiveItemForCat.name}" is sold out. Please remove it from your cart before checking out.`
        });
      }

      const resolvedVariant = resolveOrderVariantSelection(
        dbItem,
        item.variantId || null,
        parentDoc
      );

      const pricing = resolveItemParcelPricing({
        rawServiceType: item.serviceType,
        quantity: qty,
        unitFoodPrice: resolvedVariant.unitFoodPrice,
        parcelEnabled,
        parcelChargePerItem,
        itemParcelEligible: isItemParcelEligible(resolvedVariant.parentItem),
        itemName: resolvedVariant.variantLabel
          ? `${resolvedVariant.displayName} (${resolvedVariant.variantLabel})`
          : resolvedVariant.displayName,
      });

      subtotal += pricing.itemFoodTotal;
      parcelChargeTotal += pricing.parcelChargeTotal;

      verifiedItems.push({
        menuItem: resolvedVariant.parentItem._id,
        variantId: resolvedVariant.variantId,
        variantLabel: resolvedVariant.variantLabel,
        name: resolvedVariant.displayName,
        price: resolvedVariant.unitFoodPrice,
        quantity: qty,
        emoji: resolvedVariant.parentItem.emoji,
        image: resolvedVariant.imageUrl,
        serviceType: pricing.serviceType,
        parcelChargePerUnit: pricing.parcelChargePerUnit,
        parcelChargeTotal: pricing.parcelChargeTotal,
        itemSubtotal: pricing.itemSubtotal,
      });
    }

    subtotal = Number(subtotal.toFixed(2));
    parcelChargeTotal = Number(parcelChargeTotal.toFixed(2));

    // 4. Validate and Claim Coupon Atomically with findOneAndUpdate
    let discount = 0;
    if (couponCode && String(couponCode).trim()) {
      const globalEnabled = await isGlobalCouponsEnabled();
      if (!globalEnabled) {
        return res.status(400).json({
          success: false,
          message: 'Coupons are currently disabled by the canteen admin and cannot be applied to orders.',
        });
      }

      const cleanCode = String(couponCode).trim().toUpperCase();
      const now = new Date();

      const claimedCoupon = await Coupon.findOneAndUpdate(
        {
          code: cleanCode,
          active: true,
          expiryDate: { $gt: now },
          minimumOrder: { $lte: subtotal },
          $or: [
            { usageLimit: 0 },
            { $expr: { $lt: ['$usedCount', '$usageLimit'] } },
          ],
        },
        { $inc: { usedCount: 1 } },
        { new: true }
      );

      if (!claimedCoupon) {
        return res.status(400).json({
          success: false,
          message: 'Invalid, expired, minimum order not met, or fully redeemed coupon code.',
        });
      }

      if (claimedCoupon.discountType === 'flat') {
        discount = claimedCoupon.discountValue;
      } else if (claimedCoupon.discountType === 'percentage') {
        discount = (subtotal * claimedCoupon.discountValue) / 100;
        if (claimedCoupon.maxDiscount > 0 && discount > claimedCoupon.maxDiscount) {
          discount = claimedCoupon.maxDiscount;
        }
      }
      discount = Math.min(subtotal, Number(discount.toFixed(2)));
      appliedCouponCode = claimedCoupon.code;
    }

    const total = Math.max(0, Number((subtotal + parcelChargeTotal - discount).toFixed(2)));

    // 5. Order Creation with up to 5 retries on duplicate orderCode (no endless loops)
    let order = null;
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      attempts++;
      const orderCode = generateOrderCode();
      const pickupToken = orderCode;
      const pickupSecret = `sec_${crypto.randomBytes(6).toString('hex')}`;

      try {
        order = await Order.create({
          orderCode,
          orderType: 'ONLINE',
          pickupToken,
          pickupSecret,
          clientRequestId: (clientRequestId && typeof clientRequestId === 'string' && clientRequestId.trim()) ? clientRequestId.trim() : null,
          user: req.user._id,
          items: verifiedItems,
          foodSubtotal: subtotal,
          parcelChargeTotal,
          subtotal,
          discount,
          total,
          coupon: appliedCouponCode,
          paymentMethod,
          paymentStatus: paymentMethod === 'cod' ? 'cod' : 'pending',
          paymentId: paymentId || '',
          status: 'Placed',
          statusTimestamps: { Placed: new Date() },
        });
        break; // Successfully created
      } catch (err) {
        if (err.code === 11000) {
          // If collision was on clientRequestId, another concurrent request placed this order
          if (err.keyPattern?.clientRequestId) {
            if (appliedCouponCode) {
              await Coupon.updateOne({ code: appliedCouponCode }, { $inc: { usedCount: -1 } });
            }
            const existing = await Order.findOne({ user: req.user._id, clientRequestId: clientRequestId.trim() }).lean();
            if (existing) {
              return res.status(200).json({
                success: true,
                message: 'Order already placed (idempotent)',
                data: existing,
              });
            }
          }
          // If collision was on orderCode, retry up to 5 attempts
          if (attempts >= maxAttempts) {
            if (appliedCouponCode) {
              await Coupon.updateOne({ code: appliedCouponCode }, { $inc: { usedCount: -1 } });
            }
            return res.status(500).json({
              success: false,
              message: 'Failed to generate a unique order code after 5 attempts. Please try again.',
            });
          }
          continue;
        }

        // On other error: roll back coupon count and propagate
        if (appliedCouponCode) {
          await Coupon.updateOne({ code: appliedCouponCode }, { $inc: { usedCount: -1 } });
        }
        throw err;
      }
    }

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

        // Smart Notification Rule:
        // Admin notification: New Order Received (bulk insert, single notification per admin)
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
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// @desc    Get current user's order history
// @route   GET /api/orders/my
// @access  Private
const getMyOrders = async (req, res) => {
  try {
    const { page, limit } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [orders, total] = await Promise.all([
      Order.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Order.countDocuments({ user: req.user._id }),
    ]);

    res.json({
      success: true,
      data: orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
        total,
      },
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
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
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// @desc    Update order status
// @route   PATCH /api/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    // Allowed transitions mapping:
    // Placed > Confirmed | Cancelled
    // Confirmed > Preparing | Cancelled
    // Preparing > Ready | Cancelled
    // Ready > Completed | Pickup Bill | Cancelled
    // Pickup Bill > Handover Bill | Completed | Cancelled
    // Handover Bill > Completed
    const VALID_PREDECESSORS = {
      Confirmed: ['Placed'],
      Preparing: ['Confirmed'],
      Ready: ['Preparing'],
      'Pickup Bill': ['Ready'],
      'Handover Bill': ['Pickup Bill'],
      Completed: ['Ready', 'Pickup Bill', 'Handover Bill'],
      Cancelled: ['Placed', 'Confirmed', 'Preparing', 'Ready', 'Pickup Bill'],
    };

    const validPredecessors = VALID_PREDECESSORS[status];
    if (!validPredecessors) {
      return res.status(400).json({ success: false, message: `Invalid status transition target: "${status}"` });
    }

    const query = buildOrderQuery(req.params.id);
    if (!query) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const now = new Date();
    const updateFields = {
      status,
      [`statusTimestamps.${status}`]: now,
    };

    if (status === 'Completed' || status === 'Handover Bill') {
      updateFields.paymentStatus = 'paid';
      updateFields.handoverVerified = true;
      updateFields.completedAt = now;
      updateFields.handoverVerifiedAt = now;
      updateFields.handoverVerifiedBy = req.user._id;
      updateFields[`statusTimestamps.Completed`] = now;
      updateFields[`statusTimestamps.Handover Bill`] = now;
    }

    // Atomic conditional update: only matches if current status is in valid predecessors
    const order = await Order.findOneAndUpdate(
      {
        ...query,
        status: { $in: validPredecessors },
      },
      { $set: updateFields },
      { new: true }
    ).populate('user', 'name email phone role accountType studentDetails staffDetails');

    if (!order) {
      const existing = await Order.findOne(query);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
      if (existing.status === status) {
        return res.json({
          success: true,
          message: `Order status is already ${status}`,
          data: existing,
        });
      }
      return res.status(400).json({
        success: false,
        message: `Invalid status transition: Order #${existing.orderCode} cannot transition from "${existing.status}" to "${status}". Another admin may have already updated it.`,
      });
    }

    // Decrement coupon usage on cancel
    if (status === 'Cancelled' && order.coupon) {
      await Coupon.updateOne({ code: order.coupon }, { $inc: { usedCount: -1 } });
    }

    const io = req.app.get('socketio');
    if (io) {
      // 1. Send ONLY to user's private room
      if (order.user) {
        io.to(`user:${order.user._id}`).emit('order:statusChanged', {
          orderId: order._id,
          orderCode: order.orderCode,
          status: order.status,
          statusTimestamps: order.statusTimestamps ? Object.fromEntries(order.statusTimestamps) : undefined,
          paymentStatus: order.paymentStatus,
          order,
        });
      }

      // 2. Send ONLY to admin room
      io.to('admin').emit('order:updated', order);

      // 3. Smart Notification: single customer notification when order reaches Pickup Bill
      if (status === 'Pickup Bill' && order.user && !order.pickupBillNotificationSent) {
        order.pickupBillNotificationSent = true;
        order.pickupBillNotifiedAt = new Date();

        await Order.updateOne(
          { _id: order._id, pickupBillNotificationSent: { $ne: true } },
          { $set: { pickupBillNotificationSent: true, pickupBillNotifiedAt: new Date() } }
        );

        const pickupToken = order.pickupToken || order.orderCode;
        await createAndEmitNotification(io, {
          userId: order.user._id,
          orderId: order._id,
          orderCode: order.orderCode,
          status: 'Pickup Bill',
          customType: 'ORDER_READY',
          customTitle: 'Your Order Is Ready!',
          customMessage: `Your order #${order.orderCode} is ready for collection. Please visit the canteen counter and show your pickup token ${pickupToken}.`,
          customIcon: '🧾',
          customPriority: 'HIGH',
          eventId: `ORDER_CUSTOMER_${order.orderCode}_PICKUP_BILL`,
          metadata: {
            orderId: order._id,
            orderCode: order.orderCode,
            pickupToken: pickupToken,
            status: 'Pickup Bill',
            dateTime: new Date().toISOString(),
            link: '/pickup',
            total: order.total,
            itemsCount: order.items?.length || 0,
          },
        });
      }
    }

    res.json({ success: true, message: `Order status updated to ${status}`, data: order });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
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

    // Verify ownership first if not admin
    if (req.user.role !== 'admin' && req.user.role !== 'ADMIN') {
      const existing = await Order.findOne(query).select('user status orderCode coupon');
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
      const orderUserId = existing.user?._id ? existing.user._id.toString() : existing.user?.toString();
      if (orderUserId && orderUserId !== req.user._id.toString()) {
        return res.status(403).json({ success: false, message: 'Not authorized to cancel this order' });
      }
    }

    const cancellableStatuses = (req.user.role === 'admin' || req.user.role === 'ADMIN')
      ? ['Placed', 'Confirmed', 'Preparing', 'Ready', 'Pickup Bill']
      : ['Placed', 'Confirmed'];

    const order = await Order.findOneAndUpdate(
      {
        ...query,
        status: { $in: cancellableStatuses },
      },
      {
        $set: {
          status: 'Cancelled',
          [`statusTimestamps.Cancelled`]: new Date(),
        },
      },
      { new: true }
    );

    if (!order) {
      const existing = await Order.findOne(query);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Order not found' });
      }
      if (existing.status === 'Cancelled') {
        return res.json({ success: true, message: 'Order is already cancelled', data: existing });
      }
      return res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled as preparation is already in progress or completed.',
      });
    }

    // Decrement coupon count on cancel
    if (order.coupon) {
      await Coupon.updateOne({ code: order.coupon }, { $inc: { usedCount: -1 } });
    }

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

      // 2. If student cancelled, notify admins idempotently via bulk insert
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

      // Targeted socket emits only
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
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
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

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skipNum = (pageNum - 1) * limitNum;

    const [orders, totalOrders] = await Promise.all([
      Order.find(query)
        .populate('user', 'name email phone role accountType studentDetails staffDetails')
        .sort({ createdAt: -1 })
        .skip(skipNum)
        .limit(limitNum)
        .lean(),
      Order.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: orders,
      pagination: {
        total: totalOrders,
        page: pageNum,
        pages: Math.ceil(totalOrders / limitNum) || 1,
      },
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// @desc    Get active live orders (Placed, Confirmed, Preparing, Ready)
// @route   GET /api/orders/active
// @access  Private/Admin
const getActiveOrders = async (req, res) => {
  try {
    const { status, search, paymentMethod } = req.query;

    // Default: only active order stages for online orders (walk-in counter orders are completed directly at POS)
    let query = {
      status: { $in: ['Placed', 'Confirmed', 'Preparing', 'Ready'] },
      orderType: { $ne: 'WALK_IN' },
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
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
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
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// @desc    Get Public Parcel Settings (enable flag & per-item charge)
// @route   GET /api/orders/parcel-settings
// @access  Public
const getParcelSettings = async (req, res) => {
  try {
    const { parcelEnabled, parcelChargePerItem } = await getOrCreateParcelSettings();
    res.json({
      success: true,
      data: { parcelEnabled, parcelChargePerItem },
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
  getParcelSettings,
};
