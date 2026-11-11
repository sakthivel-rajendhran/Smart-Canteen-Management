import express from 'express';
import {
  createOrder,
  getMyOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  getAdminOrders,
  getActiveOrders,
  getPublicReadyTokens,
  getParcelSettings,
} from '../controllers/orderController.js';
import { protect } from '../middleware/authMiddleware.js';
import { adminOnly } from '../middleware/adminMiddleware.js';

const router = express.Router();

router.route('/')
  .get(protect, adminOnly, getAdminOrders)
  .post(protect, createOrder);

router.get('/active', protect, adminOnly, getActiveOrders);
router.get('/my', protect, getMyOrders);
router.get('/admin/list', protect, adminOnly, getAdminOrders);

// Public route for Counter Live Pickup Display (No login required, safe public fields only)
router.get('/public/ready-tokens', getPublicReadyTokens);
router.get('/parcel-settings', getParcelSettings);

router.route('/:id')
  .get(protect, getOrderById);

router.patch('/:id/status', protect, adminOnly, updateOrderStatus);
router.patch('/:id/cancel', protect, cancelOrder);

export default router;
