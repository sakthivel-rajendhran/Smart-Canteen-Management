import React from 'react';
import { Link } from 'react-router-dom';
import { 
  CheckCheck, 
  Volume2, 
  VolumeX, 
  ArrowRight, 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  Bell 
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

  // Preview up to 8 most recent notifications in the dropdown
  const recentNotifications = notifications.slice(0, 8);

  return (
    <div className="w-[340px] sm:w-[390px] bg-white rounded-3xl shadow-2xl border border-gray-200/80 overflow-hidden flex flex-col font-inter animate-in fade-in zoom-in-95 duration-150 z-50">
      {/* Dropdown Header */}
      <div className="bg-primary-darker p-4 text-white flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber text-primary-darker font-bold flex items-center justify-center text-sm shadow-xs">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-outfit font-extrabold text-sm tracking-tight text-white">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="bg-amber text-primary-darker font-black text-[10px] px-2 py-0.2 rounded-full shadow-xs">
                  {unreadCount}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Header Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* Audio toggle */}
          <button
            onClick={toggleSound}
            title={soundEnabled ? 'Chime sound is ON' : 'Chime sound is MUTED'}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            {soundEnabled ? (
              <Volume2 className="w-3.5 h-3.5 text-amber" />
            ) : (
              <VolumeX className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Mark all as read */}
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              title="Mark all as read"
              className="flex items-center gap-1 text-[11px] font-bold text-amber hover:text-amber-light px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all</span>
            </button>
          )}
        </div>
      </div>

      {/* Real-Time Connection Ribbon */}
      <div className="px-4 py-1.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between text-[10px] font-medium text-gray-500">
        <div className="flex items-center gap-1.5">
          {socketStatus === 'connected' ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-green-700 font-semibold">🟢 Real-Time Active</span>
            </>
          ) : socketStatus === 'reconnecting' ? (
            <>
              <RefreshCw className="w-3 h-3 text-amber animate-spin" />
              <span className="text-amber-700 font-semibold">🟡 Reconnecting...</span>
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span className="text-red-600 font-semibold">🔴 Offline (Syncing)</span>
            </>
          )}
        </div>

        <button
          onClick={fetchNotifications}
          className="text-gray-400 hover:text-primary transition-colors flex items-center gap-1 font-semibold"
          title="Refresh"
        >
          <RefreshCw className="w-2.5 h-2.5" />
          <span>Sync</span>
        </button>
      </div>

      {/* Notifications List Body */}
      <div className="max-h-[380px] overflow-y-auto p-3 flex flex-col gap-2 no-scrollbar">
        {loading && notifications.length === 0 ? (
          // Skeleton loading
          <div className="flex flex-col gap-2 p-2">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="p-3 bg-gray-50 rounded-2xl animate-pulse flex gap-3 items-center"
              >
                <div className="w-10 h-10 bg-gray-200 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 bg-gray-200 rounded-md w-3/4" />
                  <div className="h-2.5 bg-gray-100 rounded-md w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          // Section 39: Empty state
          <div className="py-10 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-light/30 border border-amber/20 text-amber-dark flex items-center justify-center text-xl mx-auto mb-2.5 shadow-xs">
              🔔
            </div>
            <h4 className="font-outfit font-bold text-sm text-primary-dark mb-0.5">
              No Notifications
            </h4>
            <p className="text-gray-400 text-xs leading-relaxed max-w-[220px] mx-auto">
              You're all caught up! Order status updates will appear here instantly.
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

      {/* Dropdown Footer: Link to Full Notification Center */}
      <div className="p-3 bg-gray-50/80 border-t border-gray-100 text-center">
        <Link
          to="/notifications"
          onClick={onClose}
          className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-primary hover:text-primary-dark py-1 px-3 rounded-xl hover:bg-white transition-all w-full"
        >
          <span>View All in Notification Center</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
};

export default NotificationDropdown;
