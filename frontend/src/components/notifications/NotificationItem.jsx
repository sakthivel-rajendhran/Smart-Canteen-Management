import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  Trash2,
  ArrowUpRight,
  Clock,
  AlertCircle,
  Bell,
  CheckCircle2,
  Utensils,
  ShieldCheck,
  Receipt,
} from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { useAuth } from '../../context/AuthContext';

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
  const { user } = useAuth();

  const isUnread = !notification.read;
  const isHighPriority = notification.priority === 'HIGH';
  const orderCode = notification.metadata?.orderCode || notification.order?.orderCode;
  const pickupToken = notification.metadata?.pickupToken;
  const notifId = notification._id || notification.id;

  const isAdmin = user?.role === 'admin' || window.location.pathname.startsWith('/admin');

  const handleClick = () => {
    if (isUnread && notifId) {
      markAsRead(notifId);
    }
    if (onCloseDropdown) onCloseDropdown();

    if (isAdmin) {
      const adminLink = notification.metadata?.link;
      if (
        adminLink &&
        !adminLink.includes('tracker') &&
        !adminLink.includes('live-tracking') &&
        !adminLink.includes('handover')
      ) {
        navigate(adminLink);
      }
    } else {
      const customerLink =
        notification.metadata?.link || (orderCode ? `/tracker/${orderCode}` : '/pickup');
      if (customerLink) {
        navigate(customerLink);
      }
    }
  };

  const handleMarkRead = (e) => {
    e.stopPropagation();
    if (notifId) markAsRead(notifId);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (notifId) deleteNotification(notifId);
  };

  const getIconConfig = () => {
    switch (notification.type) {
      case 'ORDER_READY':
      case 'ORDER_COMPLETED':
        return {
          bg: 'bg-green-100 text-green-700 border-green-300',
          Icon: CheckCircle2,
        };
      case 'ORDER_PREPARING':
        return {
          bg: 'bg-amber-100 text-amber-700 border-amber-300',
          Icon: Utensils,
        };
      case 'ORDER_CONFIRMED':
        return {
          bg: 'bg-blue-100 text-blue-700 border-blue-300',
          Icon: ShieldCheck,
        };
      case 'ORDER_PLACED':
        return {
          bg: 'bg-primary-light text-primary-dark border-primary/25',
          Icon: Receipt,
        };
      case 'ORDER_CANCELLED':
        return {
          bg: 'bg-red-100 text-red-700 border-red-300',
          Icon: AlertCircle,
        };
      default:
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          Icon: Bell,
        };
    }
  };

  const { bg, Icon } = getIconConfig();

  return (
    <div
      data-testid={`notification-item-${notifId}`}
      onClick={handleClick}
      className={`group relative p-2.5 sm:p-3 rounded-xl border transition-all duration-150 cursor-pointer flex gap-2.5 sm:gap-3 min-w-0 ${
        isUnread
          ? 'bg-amber-light/25 hover:bg-amber-light/40 border-amber/35 shadow-xs'
          : 'bg-white hover:bg-gray-50 border-gray-100'
      } ${isHighPriority && isUnread ? 'ring-1 ring-green-500/35' : ''}`}
    >
      {/* Left Status Icon */}
      <div
        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${bg}`}
      >
        <Icon className="w-4 h-4" />
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4
            className={`text-xs leading-snug line-clamp-1 min-w-0 flex-1 ${
              isUnread ? 'text-primary-dark font-extrabold' : 'text-gray-700 font-semibold'
            }`}
          >
            {notification.title}
          </h4>

          <span className="text-[10px] text-gray-400 whitespace-nowrap flex items-center gap-1 shrink-0">
            <Clock className="w-2.5 h-2.5 text-gray-300" />
            <span>{formatTimeAgo(notification.createdAt)}</span>
            {isUnread && <span className="w-1.5 h-1.5 rounded-full bg-amber inline-block ml-0.5" />}
          </span>
        </div>

        <p className="text-[11px] sm:text-xs text-gray-600 mt-0.5 leading-snug line-clamp-2 break-words">
          {notification.message}
        </p>

        {/* Bottom Order Link, Token Badge & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 mt-2 pt-1.5 border-t border-gray-100/80 min-w-0">
          {orderCode ? (
            <div className="flex flex-wrap items-center gap-1.5 min-w-0 flex-1">
              <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-primary hover:text-primary-dark truncate max-w-full">
                <span className="truncate">Pickup / Track #{orderCode}</span>
                <ArrowUpRight className="w-3 h-3 shrink-0" />
              </span>
              {pickupToken && (
                <span className="text-[10px] font-mono font-bold text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded leading-none whitespace-nowrap shrink-0">
                  Token #{pickupToken}
                </span>
              )}
            </div>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-1 shrink-0 ml-auto">
            {isUnread && (
              <button
                type="button"
                onClick={handleMarkRead}
                title="Mark as read"
                aria-label="Mark notification as read"
                className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={handleDelete}
              title="Delete notification"
              aria-label="Delete notification"
              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationItem;
