import mongoose from 'mongoose';

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
  },
  {
    timestamps: true,
  }
);

// Compound index for optimized category and status filtering
menuItemSchema.index({ category: 1, available: 1, featured: 1 });
menuItemSchema.index({ categories: 1, available: 1, featured: 1 });

const MenuItem = mongoose.model('MenuItem', menuItemSchema);
export default MenuItem;
