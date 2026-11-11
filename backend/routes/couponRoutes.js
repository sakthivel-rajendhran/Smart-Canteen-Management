import express from 'express';
import {
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
  getCouponSettings,
  updateCouponSettings,
} from '../controllers/couponController.js';
import { protect } from '../middleware/authMiddleware.js';
import { adminOnly } from '../middleware/adminMiddleware.js';

const router = express.Router();

// Global coupon enable/disable settings (Admin toggles, Customers read)
router.route('/settings')
  .get(getCouponSettings)
  .put(protect, adminOnly, updateCouponSettings);

// Publicly validated route for calculating coupon discounts
router.post('/validate', validateCoupon);

// Admin-only CRUD operations
router.route('/')
  .get(protect, adminOnly, getCoupons)
  .post(protect, adminOnly, createCoupon);

router.route('/:id')
  .put(protect, adminOnly, updateCoupon)
  .delete(protect, adminOnly, deleteCoupon);

export default router;
