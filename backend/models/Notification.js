import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },
    type: {
      type: String,
      enum: [
        'ORDER_PLACED',
        'ORDER_CONFIRMED',
        'ORDER_PREPARING',
        'ORDER_READY',
        'ORDER_COMPLETED',
        'ORDER_CANCELLED',
        'SYSTEM',
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    icon: {
      type: String,
      default: '🔔',
    },
    priority: {
      type: String,
      enum: ['LOW', 'NORMAL', 'HIGH'],
      default: 'NORMAL',
    },
    metadata: {
      orderCode: { type: String, default: '' },
      total: { type: Number },
      itemsCount: { type: Number },
      pickupCounter: { type: String, default: 'DRS Quick Serve Canteen' },
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
      // Automatic retention: expire notifications older than 90 days (7,776,000 seconds)
      expires: 7776000,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for lightning-fast user notification queries and unread counting
notificationSchema.index({ user: 1, read: 1, createdAt: -1 });
notificationSchema.index({ user: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
