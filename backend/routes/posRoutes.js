import express from 'express';
import {
  createWalkInOrder,
  getReadyOrders,
  getHandoverOrders,
  printBill,
  recordPayment,
  verifyAndHandoverOrder,
  getBillArchive,
  getFounderReport,
  getBillById,
  getRetentionSettings,
  updateRetentionSettings,
  cleanupExpiredBills,
} from '../controllers/posController.js';
import { protect } from '../middleware/authMiddleware.js';
import { adminOnly } from '../middleware/adminMiddleware.js';

const router = express.Router();

// All POS and Archive routes are protected and restricted to Admin / Canteen staff
router.use(protect, adminOnly);

// POS Counter Sales (Walk-in)
router.post('/pos/orders', createWalkInOrder);

// Food Handover, Bill Printing & Pickup Verification Counter
router.get('/pos/ready-orders', getReadyOrders);
router.get('/pos/handover-orders', getHandoverOrders);
router.post('/pos/print-bill', printBill);
router.post('/pos/record-payment', recordPayment);
router.post('/pos/verify-pickup', verifyAndHandoverOrder);
router.post('/orders/:id/verify-pickup', verifyAndHandoverOrder);

// Bill Archive & Daily Sales History
router.get('/bills/founder-report', getFounderReport);
router.get('/bills', getBillArchive);
router.get('/bills/:id', getBillById);

// Bill Retention Management & Safe Cleanup
router.route('/settings/bill-retention')
  .get(getRetentionSettings)
  .put(updateRetentionSettings);

router.post('/settings/bill-retention/cleanup', cleanupExpiredBills);

export default router;
