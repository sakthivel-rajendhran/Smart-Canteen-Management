import mongoose from 'mongoose';

const revenueReportSchema = new mongoose.Schema(
  {
    reportId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    reportName: {
      type: String,
      required: true,
    },
    dateRange: {
      type: String,
      enum: ['today', 'yesterday', '7days', '30days', '3months', '6months', 'custom'],
      required: true,
      index: true,
    },
    filterLabel: {
      type: String,
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    summary: {
      grossSales: { type: Number, default: 0 },
      netRevenue: { type: Number, default: 0 },
      totalOrders: { type: Number, default: 0 },
      cashRevenue: { type: Number, default: 0 },
      onlineRevenue: { type: Number, default: 0 },
      totalDiscounts: { type: Number, default: 0 },
      parcelCharges: { type: Number, default: 0 },
      refunds: { type: Number, default: 0 },
      refundedOrdersCount: { type: Number, default: 0 },
      avgOrderValue: { type: Number, default: 0 },
      posWalkInOrders: { type: Number, default: 0 },
      customerOnlineOrders: { type: Number, default: 0 },
    },
    fileStorage: {
      storageType: {
        type: String,
        enum: ['cloudinary', 'local', 'buffer'],
        default: 'cloudinary',
      },
      publicId: { type: String, default: '' },
      secureUrl: { type: String, default: '' },
      fileSize: { type: Number, default: 0 },
      mimeType: { type: String, default: 'application/pdf' },
    },
    status: {
      type: String,
      enum: ['generated', 'archived'],
      default: 'generated',
      index: true,
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    generatedByName: {
      type: String,
      default: 'Authorized Admin',
    },
    generatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

revenueReportSchema.index({ createdAt: -1 });

const RevenueReport = mongoose.model('RevenueReport', revenueReportSchema);
export default RevenueReport;

