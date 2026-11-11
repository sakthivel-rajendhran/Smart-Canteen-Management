import express from 'express';
import {
  createWalkInOrder,
  getReadyOrders,
  getHandoverOrders,
  verifyAndHandoverOrder,
  getBillArchive,
  getBillById,
  getRetentionSettings,
  updateRetentionSettings,
  cleanupExpiredBills,
  getAdminParcelSettings,
  updateAdminParcelSettings,
} from '../controllers/posController.js';
import { protect } from '../middleware/authMiddleware.js';
import { adminOnly } from '../middleware/adminMiddleware.js';

const router = express.Router();

// All POS and Archive routes are protected and restricted to Admin / Canteen staff
router.use(protect, adminOnly);

// POS Counter Sales (Walk-in)
router.post('/pos/orders', createWalkInOrder);

// Ready for Pickup Queue & Handover Management
router.get('/pos/ready-orders', getReadyOrders);
router.get('/pos/handover-orders', getHandoverOrders);
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

// Parcel Option & Charge Settings
router.route('/settings/parcel')
  .get(getAdminParcelSettings)
  .put(updateAdminParcelSettings);

export default router;

