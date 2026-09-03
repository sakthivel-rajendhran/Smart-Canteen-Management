import express from 'express';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// All notification routes require JWT authentication
router.use(protect);

router.route('/')
  .get(getNotifications);

router.get('/unread', getUnreadCount);
router.patch('/read-all', markAllAsRead);

router.route('/:id')
  .delete(deleteNotification);

router.patch('/:id/read', markAsRead);

export default router;
