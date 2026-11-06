import Notification from '../models/Notification.js';
import User from '../models/User.js';

/**
 * Order status to notification template mapping
 */
export const orderNotificationTemplates = {
  Placed: {
    type: 'ORDER_PLACED',
    title: '🛒 Order Placed',
    message: (orderCode) => `Your order ${orderCode} has been placed successfully.`,
    icon: '🛒',
    priority: 'NORMAL',
  },
  Confirmed: {
    type: 'ORDER_CONFIRMED',
    title: '✓ Order Confirmed',
    message: (orderCode) => `Your order ${orderCode} has been confirmed by the canteen.`,
    icon: '✓',
    priority: 'NORMAL',
  },
  Preparing: {
    type: 'ORDER_PREPARING',
    title: '👨‍🍳 Preparing Your Order',
    message: (orderCode) => `Your order ${orderCode} is now being prepared.`,
    icon: '👨‍🍳',
    priority: 'NORMAL',
  },
  Ready: {
    type: 'ORDER_READY',
    title: '🔔 Order Ready',
    message: (orderCode) => `Your order ${orderCode} is ready for pickup!`,
    icon: '🔔',
    priority: 'HIGH',
  },
  Completed: {
    type: 'ORDER_COMPLETED',
    title: '✓ Order Completed',
    message: (orderCode) =>
      `Your order ${orderCode} has been completed. Thank you for ordering from DRS Quick Serve.`,
    icon: '✓',
    priority: 'NORMAL',
  },
  Cancelled: {
    type: 'ORDER_CANCELLED',
    title: '⚠ Order Cancelled',
    message: (orderCode) => `Your order ${orderCode} has been cancelled.`,
    icon: '⚠',
    priority: 'HIGH',
  },
};

/**
 * Create a notification in MongoDB idempotently and emit in real time to the student's private room.
 * Strict Rule: One Event = One Notification per User.
 */
export const createAndEmitNotification = async (io, options) => {
  const {
    userId,
    orderId,
    orderCode,
    status,
    eventId: customEventId,
    customType,
    customTitle,
    customMessage,
    customIcon,
    customPriority,
    metadata = {},
  } = options;

  if (!userId) return null;

  const template = orderNotificationTemplates[status] || {};
  const type = customType || template.type || 'SYSTEM';
  const title = customTitle || template.title || 'Order Update';
  const message =
    customMessage ||
    (template.message ? template.message(orderCode || 'Order') : `Update for ${orderCode || 'your order'}`);
  const icon = customIcon || template.icon || '🔔';
  const priority = customPriority || template.priority || 'NORMAL';

  // Construct stable, deterministic event identifier
  const eventId =
    customEventId ||
    `ORDER_CUSTOMER_${orderCode || orderId || 'EVT'}_${(status || type).toUpperCase()}`;

  try {
    // 1. Check if this exact event notification already exists for this user (idempotency check)
    const existing = await Notification.findOne({ user: userId, eventId });
    if (existing) {
      return existing; // Already generated; avoid duplicate emit and document
    }

    // 2. Create notification atomically
    let notification;
    try {
      notification = await Notification.create({
        user: userId,
        order: orderId || undefined,
        eventId,
        type,
        title,
        message,
        icon,
        priority,
        metadata: {
          orderCode: orderCode || '',
          ...metadata,
        },
        read: false,
      });
    } catch (createErr) {
      // Catch MongoDB duplicate key error (E11000) on concurrent requests
      if (createErr.code === 11000) {
        return await Notification.findOne({ user: userId, eventId });
      }
      throw createErr;
    }

    // 3. Emit strictly ONCE to user's private room
    if (io) {
      io.to(`user:${userId}`).emit('notification:new', notification);
    }

    return notification;
  } catch (err) {
    console.error(`[NOTIFICATION] Failed to create notification for user ${userId}:`, err.message);
    return null;
  }
};

/**
 * Notify all admins idempotently via Socket.IO and persist one notification per admin account.
 * Deduplication Guarantee: Emits strictly to user:${admin._id} once, avoiding duplicate room broadcasts.
 */
export const createAndEmitAdminNotification = async (io, options) => {
  const {
    title,
    message,
    icon = '🔔',
    priority = 'HIGH',
    orderId,
    orderCode,
    eventId: customEventId,
    metadata = {},
  } = options;

  try {
    // Construct stable admin eventId
    const eventId =
      customEventId ||
      `ORDER_ADMIN_${orderCode || orderId || 'EVT'}_PLACED`;

    // Find all administrative accounts
    const admins = await User.find({
      role: { $in: ['admin', 'ADMIN'] },
    }).select('_id name email');

    const createdNotifications = [];

    for (const admin of admins) {
      try {
        // 1. Check if this admin already has a notification for this event
        const existing = await Notification.findOne({ user: admin._id, eventId });
        if (existing) {
          createdNotifications.push(existing);
          continue;
        }

        // 2. Atomically create one notification for this admin
        let notification;
        try {
          notification = await Notification.create({
            user: admin._id,
            order: orderId || undefined,
            eventId,
            type: 'SYSTEM',
            title,
            message,
            icon,
            priority,
            metadata: {
              orderCode: orderCode || '',
              ...metadata,
            },
            read: false,
          });
        } catch (createErr) {
          if (createErr.code === 11000) {
            notification = await Notification.findOne({ user: admin._id, eventId });
          } else {
            throw createErr;
          }
        }

        if (notification) {
          createdNotifications.push(notification);

          // 3. Emit ONLY to this admin's personal authenticated room.
          // Note: DO NOT broadcast to 'admin' room here, because admin sockets already join user:${admin._id}.
          // Emitting to both caused duplicate real-time alerts.
          if (io) {
            io.to(`user:${admin._id}`).emit('notification:new', notification);
          }
        }
      } catch (adminErr) {
        console.error(`[NOTIFICATION] Failed to deliver admin notification to ${admin._id}:`, adminErr.message);
      }
    }

    return createdNotifications;
  } catch (err) {
    console.error('Error creating admin notifications:', err.message);
    return [];
  }
};
