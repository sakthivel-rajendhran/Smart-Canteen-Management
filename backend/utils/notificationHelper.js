import Notification from '../models/Notification.js';
import User from '../models/User.js';

/**
 * Order status to notification template mapping
 */
export const orderNotificationTemplates = {
  Placed: {
    type: 'ORDER_PLACED',
    title: '🛒 Order Placed',
    message: (orderCode) => `Your order #${orderCode} has been placed successfully.`,
    icon: '🛒',
    priority: 'NORMAL',
  },
  Confirmed: {
    type: 'ORDER_CONFIRMED',
    title: '✓ Order Confirmed',
    message: (orderCode) => `Your order #${orderCode} has been confirmed by the canteen.`,
    icon: '✓',
    priority: 'NORMAL',
  },
  Preparing: {
    type: 'ORDER_PREPARING',
    title: '👨‍🍳 Preparing Your Order',
    message: (orderCode) => `Your order #${orderCode} is now being prepared.`,
    icon: '👨‍🍳',
    priority: 'NORMAL',
  },
  Ready: {
    type: 'ORDER_READY',
    title: '🔔 Order Ready',
    message: (orderCode) => `Your order #${orderCode} is ready for pickup! Show token #${orderCode} at the counter.`,
    icon: '🔔',
    priority: 'HIGH',
  },
  'Pickup Bill': {
    type: 'ORDER_READY',
    title: 'Your Order Is Ready!',
    message: (orderCode) =>
      `Your order #${orderCode} is ready for collection. Please visit the canteen counter and show your pickup token #${orderCode}.`,
    icon: '🧾',
    priority: 'HIGH',
  },
  Completed: {
    type: 'ORDER_COMPLETED',
    title: '✓ Order Completed',
    message: (orderCode) =>
      `Your order #${orderCode} has been completed. Thank you for ordering from DRS Quick Serve.`,
    icon: '✓',
    priority: 'NORMAL',
  },
  Cancelled: {
    type: 'ORDER_CANCELLED',
    title: '⚠ Order Cancelled',
    message: (orderCode) => `Your order #${orderCode} has been cancelled.`,
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
// Cached admin accounts list (TTL: 60s) to prevent DB queries on every order placement
let cachedAdmins = null;
let cachedAdminsTime = 0;

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
    const eventId =
      customEventId ||
      `ORDER_ADMIN_${orderCode || orderId || 'EVT'}_PLACED`;

    // Retrieve admins from cache or DB
    const now = Date.now();
    let admins = cachedAdmins;
    if (!admins || now - cachedAdminsTime > 60000) {
      admins = await User.find({
        role: { $in: ['admin', 'ADMIN'] },
      }).select('_id name email').lean();
      cachedAdmins = admins;
      cachedAdminsTime = now;
    }

    if (!admins || admins.length === 0) return [];

    const adminIds = admins.map((a) => a._id);

    // If event is for a newly generated order code, it is guaranteed unique; otherwise check
    let alreadyNotifiedUserIds = new Set();
    if (!eventId.startsWith('ORDER_ADMIN_') || !orderCode) {
      const existingNotifications = await Notification.find({
        user: { $in: adminIds },
        eventId,
      }).select('user').lean();
      alreadyNotifiedUserIds = new Set(existingNotifications.map((n) => n.user.toString()));
    }

    const docsToInsert = admins
      .filter((admin) => !alreadyNotifiedUserIds.has(admin._id.toString()))
      .map((admin) => ({
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
      }));

    if (docsToInsert.length === 0) {
      return existingNotifications;
    }

    // 3. One single bulk insert instead of a loop of saves
    let created = [];
    try {
      created = await Notification.insertMany(docsToInsert, { ordered: false });
    } catch (insertErr) {
      if (insertErr.insertedDocs) {
        created = insertErr.insertedDocs;
      }
    }

    // 4. Emit to each notified admin's private room
    if (io && Array.isArray(created)) {
      for (const notif of created) {
        io.to(`user:${notif.user}`).emit('notification:new', notif);
      }
    }

    return created;
  } catch (err) {
    console.error('Error creating admin notifications (bulk):', err.message);
    return [];
  }
};
