import express from 'express';
import {
  createRazorpayOrder,
  verifyPayment,
  getAdminPayments,
} from '../controllers/paymentController.js';
import { protect } from '../middleware/authMiddleware.js';
import { adminOnly } from '../middleware/adminMiddleware.js';

const router = express.Router();

router.post('/create-order', protect, createRazorpayOrder);
router.post('/verify', protect, verifyPayment);
router.get('/admin/list', protect, adminOnly, getAdminPayments);

export default router;
