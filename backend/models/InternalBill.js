import mongoose from 'mongoose';

const internalBillSchema = new mongoose.Schema(
  {
    billNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      unique: true,
      index: true,
    },
    orderCode: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    pickupToken: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    orderChannel: {
      type: String,
      enum: ['ONLINE', 'POS'],
      default: 'POS',
      index: true,
    },
    customerName: {
      type: String,
      default: 'Walk-in Customer',
      trim: true,
    },
    customerType: {
      type: String,
      enum: ['STUDENT', 'STAFF', 'WALK_IN', 'CUSTOMER'],
      default: 'WALK_IN',
    },
    customerPhone: {
      type: String,
      default: '',
      trim: true,
    },
    customerRegNo: {
      type: String,
      default: '',
      trim: true,
    },
    customerStaffId: {
      type: String,
      default: '',
      trim: true,
    },
    items: [
      {
        menuItem: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'MenuItem',
        },
        name: { type: String, required: true },
        price: { type: Number, required: true },
        quantity: { type: Number, required: true, default: 1 },
        lineTotal: { type: Number, required: true },
        emoji: { type: String, default: '🍛' },
      },
    ],
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    grandTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'upi', 'cod', 'razorpay', 'card', 'online'],
      default: 'cash',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['paid', 'pending', 'failed'],
      default: 'paid',
      index: true,
    },
    handoverStatus: {
      type: String,
      enum: ['PENDING', 'COMPLETED'],
      default: 'PENDING',
      index: true,
    },
    handedOverAt: {
      type: Date,
    },
    handedOverBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    generatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    billPrintCount: {
      type: Number,
      default: 1,
      min: 1,
    },
    lastPrintedAt: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
    collection: 'internal_bills',
  }
);

// Compound indexes for founder auditing, daily sales reports, and fast search
internalBillSchema.index({ generatedAt: -1 });
internalBillSchema.index({ handoverStatus: 1, generatedAt: -1 });
internalBillSchema.index({ paymentMethod: 1, paymentStatus: 1 });
internalBillSchema.index({ orderCode: 1, pickupToken: 1 });

const InternalBill = mongoose.model('InternalBill', internalBillSchema);

export default InternalBill;
