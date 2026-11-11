import mongoose from 'mongoose';

const menuVariantSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
    },
    available: {
      type: Boolean,
      default: true,
    },
    preparationTime: {
      type: Number,
      default: 5,
    },
    image: {
      url: {
        type: String,
        default: '',
      },
      publicId: {
        type: String,
        default: '',
      },
    },
    legacyMenuItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem',
      default: null,
    },
  },
  { _id: true }
);

const menuItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      index: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        index: true,
      },
    ],
    adminReviewNote: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    price: {
      type: Number,
      required: true,
    },
    image: {
      url: {
        type: String,
        default: '',
      },
      publicId: {
        type: String,
        default: '',
      },
    },
    emoji: {
      type: String,
      default: '🍛',
    },
    backgroundColor: {
      type: String,
      default: '#fff',
    },
    available: {
      type: Boolean,
      default: true,
      index: true,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    preparationTime: {
      type: Number, // in minutes
      default: 10,
    },
    variants: {
      type: [menuVariantSchema],
      default: [],
    },
    variantParent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem',
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for optimized category and status filtering
menuItemSchema.index({ category: 1, available: 1, featured: 1 });
menuItemSchema.index({ categories: 1, available: 1, featured: 1 });
menuItemSchema.index({ variantParent: 1, available: 1 });

const MenuItem = mongoose.model('MenuItem', menuItemSchema);
export default MenuItem;
