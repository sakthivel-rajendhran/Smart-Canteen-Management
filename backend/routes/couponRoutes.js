import express from 'express';
import {
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
} from '../controllers/couponController.js';
import { protect } from '../middleware/authMiddleware.js';
import { adminOnly } from '../middleware/adminMiddleware.js';

const router = express.Router();

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
