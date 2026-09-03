import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    orderCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
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
      },
    ],
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
      enum: ['cod', 'razorpay'],
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
      enum: ['Placed', 'Confirmed', 'Preparing', 'Ready', 'Completed', 'Cancelled'],
      default: 'Placed',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index to support sorting by creation date
orderSchema.index({ createdAt: -1 });

const Order = mongoose.model('Order', orderSchema);
export default Order;
