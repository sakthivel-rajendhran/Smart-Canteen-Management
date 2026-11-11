import mongoose from 'mongoose';

const canteenSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'default',
    },
    billRetentionMonths: {
      type: Number,
      enum: [3, 6],
      default: 6, // 3 or 6 months (default 6)
    },
    lastCleanupAt: {
      type: Date,
    },
    lastCleanupCount: {
      type: Number,
      default: 0,
    },
    canteenName: {
      type: String,
      default: 'DRS Quick Serve Canteen',
    },
    collegeName: {
      type: String,
      default: 'DRS College of Engineering & Tech',
    },
    couponsEnabled: {
      type: Boolean,
      default: true,
    },
    parcelEnabled: {
      type: Boolean,
      default: true,
    },
    parcelChargePerItem: {
      type: Number,
      default: 5,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

const CanteenSettings = mongoose.model('CanteenSettings', canteenSettingsSchema);
export default CanteenSettings;

