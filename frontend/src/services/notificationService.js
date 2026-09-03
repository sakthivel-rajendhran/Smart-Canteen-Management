import API from './api';

export const notificationService = {
  /**
   * Fetch current user's notifications
   * @param {Object} params - { unreadOnly, page, limit }
   */
  async getNotifications(params = {}) {
    const response = await API.get('/notifications', { params });
    return response.data;
  },

  /**
   * Fetch unread notification count
   */
  async getUnreadCount() {
    const response = await API.get('/notifications/unread');
    return response.data;
  },

  /**
   * Mark a single notification as read
   * @param {string} id - Notification ID
   */
  async markAsRead(id) {
    const response = await API.patch(`/notifications/${id}/read`);
    return response.data;
  },

  /**
   * Mark all notifications as read for current user
   */
  async markAllAsRead() {
    const response = await API.patch('/notifications/read-all');
    return response.data;
  },

  /**
   * Delete a notification
   * @param {string} id - Notification ID
   */
  async deleteNotification(id) {
    const response = await API.delete(`/notifications/${id}`);
    return response.data;
  },
};

export default notificationService;
