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
 * Create a notification in MongoDB and emit in real time to the student's room
 */
export const createAndEmitNotification = async (io, options) => {
  const {
    userId,
    orderId,
    orderCode,
    status,
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

  const notification = await Notification.create({
    user: userId,
    order: orderId || undefined,
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

  // Emit to student's private authenticated room
  if (io) {
    io.to(`user:${userId}`).emit('notification:new', notification);
  }

  return notification;
};

/**
 * Notify all admins via Socket.IO and persist notifications for admin accounts
 */
export const createAndEmitAdminNotification = async (io, options) => {
  const {
    title,
    message,
    icon = '🔔',
    priority = 'NORMAL',
    orderId,
    metadata = {},
  } = options;

  try {
    // Find admin users
    const admins = await User.find({ role: 'admin' }).select('_id');

    const createdNotifications = [];
    for (const admin of admins) {
      const notification = await Notification.create({
        user: admin._id,
        order: orderId || undefined,
        type: 'SYSTEM',
        title,
        message,
        icon,
        priority,
        metadata,
        read: false,
      });
      createdNotifications.push(notification);

      // Emit to each admin's private room
      if (io) {
        io.to(`user:${admin._id}`).emit('notification:new', notification);
      }
    }

    // Also broadcast to general admin room
    if (io) {
      io.to('admin').emit('notification:new', {
        type: 'SYSTEM',
        title,
        message,
        icon,
        priority,
        metadata,
        createdAt: new Date(),
      });
    }

    return createdNotifications;
  } catch (err) {
    console.error('Error creating admin notifications:', err);
    return [];
  }
};
