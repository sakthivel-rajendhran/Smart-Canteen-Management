import express from 'express';
import { getHomepageStats } from '../controllers/homepageController.js';

const router = express.Router();

// GET /api/homepage/stats - Public aggregate statistics for customer landing page
router.get('/stats', getHomepageStats);

export default router;
