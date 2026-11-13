import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { adminOnly } from '../middleware/adminMiddleware.js';
import {
  getRevenueAnalytics,
  generateRevenueReport,
  getReportHistory,
  downloadReportById,
  viewReportById,
} from '../controllers/revenueReportController.js';

const router = express.Router();

// All revenue report operations require Admin authentication
router.use(protect, adminOnly);

// Analytics & Dashboard data
router.get('/analytics', getRevenueAnalytics);

// Report Generation & History
router.post('/reports/generate', generateRevenueReport);
router.get('/reports', getReportHistory);
router.get('/reports/:id/download', downloadReportById);
router.get('/reports/:id/view', viewReportById);

export default router;
