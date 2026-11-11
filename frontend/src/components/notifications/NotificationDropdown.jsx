import React from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCheck,
  Volume2,
  VolumeX,
  ArrowRight,
  RefreshCw,
  Bell,
  X,
} from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import NotificationItem from './NotificationItem';

const NotificationDropdown = ({ onClose }) => {
  const {
    notifications,
    unreadCount,
    loading,
    socketStatus,
    soundEnabled,
    toggleSound,
    markAllAsRead,
    fetchNotifications,
  } = useNotifications();

  const recentNotifications = notifications.slice(0, 8);

  return (
    <div
      data-testid="notification-dropdown"
      className="w-full max-h-[min(430px,calc(100dvh-164px))] md:max-h-[480px] bg-white rounded-2xl shadow-2xl border border-gray-200/90 overflow-hidden flex flex-col font-inter"
    >
      {/* Compact Header */}
      <div className="bg-primary-darker px-3.5 py-2.5 text-white flex items-center justify-between border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-amber text-primary-darker flex items-center justify-center shrink-0 shadow-xs">
            <Bell className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="font-outfit font-extrabold text-sm tracking-tight text-white truncate">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <span className="bg-amber text-primary-darker font-black text-[10px] px-1.5 py-0.5 rounded-full leading-none shrink-0">
                {unreadCount}
              </span>
            )}
          </div>
        </div>

        {/* Header Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            data-testid="notification-sound-toggle"
            onClick={toggleSound}
            title={soundEnabled ? 'Chime sound is ON' : 'Chime sound is MUTED'}
            aria-label={soundEnabled ? 'Mute notification sound' : 'Enable notification sound'}
            className="p-1.5 rounded-lg text-white/75 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            {soundEnabled ? (
              <Volume2 className="w-3.5 h-3.5 text-amber" />
            ) : (
              <VolumeX className="w-3.5 h-3.5" />
            )}
          </button>

          {unreadCount > 0 && (
            <button
              type="button"
              data-testid="notification-mark-all-btn"
              onClick={markAllAsRead}
              title="Mark all as read"
              className="flex items-center gap-1 text-[11px] font-bold text-amber hover:text-amber-light px-2 py-1 rounded-lg hover:bg-white/10 transition-colors whitespace-nowrap cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Mark all</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Close notifications"
            className="p-1.5 rounded-lg text-white/65 hover:text-white hover:bg-white/10 transition-colors cursor-pointer md:hidden"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Status Row */}
      <div className="px-3.5 py-1.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between text-[11px] shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {socketStatus === 'connected' ? (
            <>
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
              <span className="text-green-700 font-semibold truncate">Real-Time Active</span>
            </>
          ) : socketStatus === 'reconnecting' ? (
            <>
              <RefreshCw className="w-3 h-3 text-amber animate-spin shrink-0" />
              <span className="text-amber-700 font-semibold truncate">Reconnecting...</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
              <span className="text-red-600 font-semibold truncate">Offline (Syncing)</span>
            </>
          )}
        </div>

        <button
          type="button"
          data-testid="notification-sync-btn"
          onClick={fetchNotifications}
          className="text-gray-500 hover:text-primary transition-colors flex items-center gap-1 font-semibold px-1.5 py-0.5 rounded hover:bg-gray-100 cursor-pointer shrink-0"
          title="Refresh"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Sync</span>
        </button>
      </div>

      {/* Scrollable Notifications List */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2.5 flex flex-col gap-2 no-scrollbar">
        {loading && notifications.length === 0 ? (
          <div className="flex flex-col gap-2 p-1">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="p-2.5 bg-gray-50 rounded-xl animate-pulse flex gap-2.5 items-center"
              >
                <div className="w-8 h-8 bg-gray-200 rounded-lg shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                  <div className="h-2.5 bg-gray-100 rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-8 px-4 text-center">
            <div className="w-11 h-11 rounded-full bg-amber-light/40 border border-amber/20 text-amber-dark flex items-center justify-center mx-auto mb-2.5">
              <Bell className="w-5 h-5" />
            </div>
            <h4 className="font-outfit font-bold text-sm text-primary-dark mb-0.5">
              No Notifications
            </h4>
            <p className="text-gray-500 text-xs leading-relaxed max-w-[220px] mx-auto">
              You're all caught up. Order updates will appear here automatically.
            </p>
          </div>
        ) : (
          recentNotifications.map((notif) => (
            <NotificationItem
              key={notif._id || notif.id}
              notification={notif}
              onCloseDropdown={onClose}
            />
          ))
        )}
      </div>

      {/* Compact Footer */}
      <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 text-center shrink-0">
        <Link
          to="/notifications"
          data-testid="notification-center-link"
          onClick={onClose}
          className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-primary hover:text-primary-dark py-1.5 px-3 rounded-xl hover:bg-white transition-all w-full"
        >
          <span>View All in Notification Center</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
};

export default NotificationDropdown;
