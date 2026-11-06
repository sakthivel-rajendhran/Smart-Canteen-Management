import mongoose from 'mongoose';
import Notification from '../models/Notification.js';

// @desc    Get user's notification history
// @route   GET /api/notifications
// @access  Private
const getNotifications = async (req, res) => {
  try {
    const { unreadOnly, limit = 50, page = 1 } = req.query;
    const query = { user: req.user._id };

    if (unreadOnly === 'true') {
      query.read = false;
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 20));
    const skipNum = (pageNum - 1) * limitNum;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skipNum)
        .limit(limitNum)
        .populate('order', 'orderCode status total items')
        .lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ user: req.user._id, read: false }),
    ]);

    res.json({
      success: true,
      unreadCount,
      count: notifications.length,
      data: notifications,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    console.error('Error in getNotifications:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get unread notification count
// @route   GET /api/notifications/unread
// @access  Private
const getUnreadCount = async (req, res) => {
  try {
    const unreadCount = await Notification.countDocuments({
      user: req.user._id,
      read: false,
    });

    res.json({
      success: true,
      unreadCount,
    });
  } catch (error) {
    console.error('Error in getUnreadCount:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark single notification as read
// @route   PATCH /api/notifications/:id/read
// @access  Private
const markAsRead = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    // Enforce ownership
    if (notification.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to modify this notification' });
    }

    notification.read = true;
    await notification.save();

    // Broadcast update to all connected tabs of this user
    const io = req.app.get('socketio');
    if (io) {
      io.to(`user:${req.user._id}`).emit('notification:read', { id: notification._id });
    }

    const unreadCount = await Notification.countDocuments({
      user: req.user._id,
      read: false,
    });

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: notification,
      unreadCount,
    });
  } catch (error) {
    console.error('Error in markAsRead:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark all notifications as read for current user
// @route   PATCH /api/notifications/read-all
// @access  Private
const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, read: false },
      { $set: { read: true } }
    );

    // Broadcast update to all user tabs
    const io = req.app.get('socketio');
    if (io) {
      io.to(`user:${req.user._id}`).emit('notification:readAll');
    }

    res.json({
      success: true,
      message: 'All notifications marked as read',
      unreadCount: 0,
    });
  } catch (error) {
    console.error('Error in markAllAsRead:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete single notification
// @route   DELETE /api/notifications/:id
// @access  Private
const deleteNotification = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    // Enforce ownership
    if (notification.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this notification' });
    }

    await Notification.findByIdAndDelete(req.params.id);

    // Broadcast deletion to all user tabs
    const io = req.app.get('socketio');
    if (io) {
      io.to(`user:${req.user._id}`).emit('notification:deleted', { id: req.params.id });
    }

    const unreadCount = await Notification.countDocuments({
      user: req.user._id,
      read: false,
    });

    res.json({
      success: true,
      message: 'Notification deleted',
      unreadCount,
    });
  } catch (error) {
    console.error('Error in deleteNotification:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
