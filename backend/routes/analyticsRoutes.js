import express from 'express';
import {
  getAnalyticsOverview,
  getRevenueTrends,
  getPopularItems,
  getPaymentMethodStats,
} from '../controllers/analyticsController.js';
import { protect } from '../middleware/authMiddleware.js';
import { adminOnly } from '../middleware/adminMiddleware.js';

const router = express.Router();

router.get('/overview', protect, adminOnly, getAnalyticsOverview);
router.get('/revenue', protect, adminOnly, getRevenueTrends);
router.get('/popular-items', protect, adminOnly, getPopularItems);
router.get('/payments', protect, adminOnly, getPaymentMethodStats);
router.get('/payment-methods', protect, adminOnly, getPaymentMethodStats);

export default router;
