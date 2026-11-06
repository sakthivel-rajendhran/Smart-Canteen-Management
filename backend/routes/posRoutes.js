import express from 'express';
import {
  createWalkInOrder,
  getReadyOrders,
  verifyAndHandoverOrder,
  getBillArchive,
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

// Ready for Pickup Queue & Verification
router.get('/pos/ready-orders', getReadyOrders);
router.post('/pos/verify-pickup', verifyAndHandoverOrder);
router.post('/orders/:id/verify-pickup', verifyAndHandoverOrder);

// Bill Archive & Sales History
router.get('/bills', getBillArchive);
router.get('/bills/:id', getBillById);

// Bill Retention Management & Safe Cleanup
router.route('/settings/bill-retention')
  .get(getRetentionSettings)
  .put(updateRetentionSettings);

router.post('/settings/bill-retention/cleanup', cleanupExpiredBills);

export default router;
