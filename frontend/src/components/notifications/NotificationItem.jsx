import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Trash2, ArrowUpRight, Clock, AlertCircle } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';

const formatTimeAgo = (dateStr) => {
  if (!dateStr) return 'Just now';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays}d ago`;
};

const NotificationItem = ({ notification, onCloseDropdown }) => {
  const navigate = useNavigate();
  const { markAsRead, deleteNotification } = useNotifications();

  const isUnread = !notification.read;
  const isHighPriority = notification.priority === 'HIGH';
  const orderCode = notification.metadata?.orderCode || notification.order?.orderCode;

  const handleClick = () => {
    if (isUnread) {
      markAsRead(notification._id);
    }
    if (orderCode) {
      if (onCloseDropdown) onCloseDropdown();
      navigate(`/tracker/${orderCode}`);
    }
  };

  const handleMarkRead = (e) => {
    e.stopPropagation();
    markAsRead(notification._id);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    deleteNotification(notification._id);
  };

  const getIconBackground = () => {
    switch (notification.type) {
      case 'ORDER_READY':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'ORDER_PREPARING':
        return 'bg-amber-100 text-amber-700 border-amber-300';
      case 'ORDER_CONFIRMED':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'ORDER_PLACED':
        return 'bg-rose-100 text-rose-700 border-rose-300';
      case 'ORDER_CANCELLED':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'ORDER_COMPLETED':
        return 'bg-gray-100 text-gray-700 border-gray-300';
      default:
        return 'bg-amber-50 text-amber-600 border-amber-200';
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`group relative p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex gap-3.5 ${
        isUnread
          ? 'bg-amber-light/25 hover:bg-amber-light/40 border-amber/30 shadow-xs'
          : 'bg-white hover:bg-gray-50/80 border-gray-100'
      } ${isHighPriority && isUnread ? 'ring-1 ring-green-500/40' : ''}`}
    >
      {/* Icon */}
      <div
        className={`w-10 h-10 rounded-xl border flex items-center justify-center text-lg flex-shrink-0 shadow-xs ${getIconBackground()}`}
      >
        {notification.icon || '🔔'}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4
            className={`text-xs font-bold leading-tight line-clamp-1 ${
              isUnread ? 'text-primary-dark font-extrabold' : 'text-gray-700 font-semibold'
            }`}
          >
            {notification.title}
          </h4>

          <span className="text-[10px] text-gray-400 whitespace-nowrap flex items-center gap-1">
            <Clock className="w-2.5 h-2.5 text-gray-300" />
            {formatTimeAgo(notification.createdAt)}
          </span>
        </div>

        <p className="text-xs text-gray-600 mt-1 leading-snug line-clamp-2">
          {notification.message}
        </p>

        {/* Order code link & Action buttons */}
        <div className="flex items-center justify-between mt-2.5 pt-1.5 border-t border-gray-100/70">
          {orderCode ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary-dark transition-colors">
              <span>Track #{orderCode}</span>
              <ArrowUpRight className="w-3 h-3" />
            </span>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
            {isUnread && (
              <button
                onClick={handleMarkRead}
                title="Mark as read"
                className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={handleDelete}
              title="Delete notification"
              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Unread Accent Dot */}
      {isUnread && (
        <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-amber shadow-xs" />
      )}
    </div>
  );
};

export default NotificationItem;
