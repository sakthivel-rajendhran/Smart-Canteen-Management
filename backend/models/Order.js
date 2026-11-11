import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    orderCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    orderType: {
      type: String,
      enum: ['ONLINE', 'WALK_IN'],
      default: 'ONLINE',
      index: true,
    },
    pickupToken: {
      type: String,
      required: true,
      index: true,
    },
    pickupSecret: {
      type: String,
      default: '',
    },
    // User is required for ONLINE orders, but optional for WALK_IN counter orders
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true,
    },
    // Optional details for direct counter purchases
    walkInCustomer: {
      name: { type: String, default: 'Walk-in Customer' },
      phone: { type: String, default: '' },
      registerNumber: { type: String, default: '' },
      staffId: { type: String, default: '' },
    },
    items: [
      {
        menuItem: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'MenuItem',
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        price: {
          type: Number,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
        },
        emoji: {
          type: String,
          default: '🍛',
        },
        image: {
          type: String,
          default: '',
        },
        serviceType: {
          type: String,
          enum: ['NORMAL', 'PARCEL'],
          default: 'NORMAL',
        },
        parcelChargePerUnit: {
          type: Number,
          default: 0,
        },
        parcelChargeTotal: {
          type: Number,
          default: 0,
        },
        itemSubtotal: {
          type: Number,
        },
      },
    ],
    foodSubtotal: {
      type: Number,
    },
    parcelChargeTotal: {
      type: Number,
      default: 0,
    },
    subtotal: {
      type: Number,
      required: true,
    },
    discount: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
    },
    coupon: {
      type: String,
      default: '',
    },
    paymentMethod: {
      type: String,
      enum: ['cod', 'razorpay', 'cash', 'upi', 'card'],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'cod'],
      default: 'pending',
    },
    paymentId: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: [
        'Placed',
        'Confirmed',
        'Preparing',
        'Ready',
        'Pickup Bill',
        'Handover Bill',
        'Completed',
        'Cancelled',
      ],
      default: 'Placed',
      index: true,
    },
    completedAt: {
      type: Date,
      index: true,
    },
    handoverVerified: {
      type: Boolean,
      default: false,
    },
    handoverVerifiedAt: {
      type: Date,
    },
    handoverVerifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // Single Pickup Bill notification flag to guarantee strictly one notification per order
    pickupBillNotificationSent: {
      type: Boolean,
      default: false,
      index: true,
    },
    pickupBillNotifiedAt: {
      type: Date,
    },
    // Cashier who entered the walk-in order
    cashier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for user orders, live feeds, archive queries, and date ranges
orderSchema.index({ createdAt: -1 });
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ orderType: 1, createdAt: -1 });
orderSchema.index({ status: 1, completedAt: -1 });
orderSchema.index({ completedAt: -1 });

const Order = mongoose.model('Order', orderSchema);
export default Order;
