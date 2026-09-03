import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Bell, 
  CheckCheck, 
  Volume2, 
  VolumeX, 
  Globe, 
  RefreshCw, 
  Filter, 
  ArrowLeft,
  Search,
  CheckCircle2,
  Inbox
} from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import NotificationItem from '../components/notifications/NotificationItem';

const NotificationCenter = () => {
  const {
    notifications,
    unreadCount,
    loading,
    socketStatus,
    soundEnabled,
    browserPermission,
    toggleSound,
    requestBrowserPermission,
    markAllAsRead,
    fetchNotifications,
  } = useNotifications();

  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'unread', 'orders'
  const [searchQuery, setSearchQuery] = useState('');

  // Filtered list
  const filteredNotifications = notifications.filter((notif) => {
    // 1. Filter Tab
    if (activeFilter === 'unread' && notif.read) return false;
    if (activeFilter === 'orders' && !notif.type.startsWith('ORDER_')) return false;

    // 2. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const titleMatch = notif.title?.toLowerCase().includes(q);
      const msgMatch = notif.message?.toLowerCase().includes(q);
      const codeMatch = notif.metadata?.orderCode?.toLowerCase().includes(q);
      if (!titleMatch && !msgMatch && !codeMatch) return false;
    }

    return true;
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-24 font-inter">
      {/* Top Breadcrumb / Back Navigation */}
      <div className="flex items-center justify-between mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted hover:text-primary-dark transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>

        {/* Real-Time Live Status Pill */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-white shadow-xs">
          {socketStatus === 'connected' ? (
            <>
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-green-700">Live Connected</span>
            </>
          ) : socketStatus === 'reconnecting' ? (
            <>
              <RefreshCw className="w-3 h-3 text-amber animate-spin" />
              <span className="text-amber-700">Reconnecting...</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-red-700">Offline</span>
            </>
          )}
        </div>
      </div>

      {/* Main Banner / Header */}
      <div className="bg-gradient-to-br from-primary-darker to-primary text-white rounded-3xl p-6 sm:p-8 mb-8 shadow-md relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-amber text-primary-darker flex items-center justify-center font-bold text-xl shadow-md">
                <Bell className="w-5 h-5" />
              </div>
              <h1 className="font-outfit font-black text-2xl sm:text-3xl tracking-tight">
                Notification Center
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-white/80 max-w-md leading-relaxed">
              Track live status changes for your food orders and manage real-time alerts.
            </p>
          </div>

          {/* Quick Settings Card */}
          <div className="flex flex-wrap items-center gap-2.5 sm:self-center">
            {/* Audio Alert Switch */}
            <button
              onClick={toggleSound}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 shadow-xs ${
                soundEnabled
                  ? 'bg-amber text-primary-darker border-amber shadow-md'
                  : 'bg-white/10 text-white/80 border-white/20 hover:bg-white/20'
              }`}
              title={soundEnabled ? 'Chime sound is ON' : 'Chime sound is MUTED'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span>Sound: {soundEnabled ? 'ON' : 'OFF'}</span>
            </button>

            {/* Browser Notifications Switch */}
            <button
              onClick={requestBrowserPermission}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 shadow-xs ${
                browserPermission === 'granted'
                  ? 'bg-green-600 text-white border-green-500 shadow-md'
                  : 'bg-white/10 text-white/80 border-white/20 hover:bg-white/20'
              }`}
              title="Browser Push Notifications"
            >
              <Globe className="w-4 h-4" />
              <span>
                Desktop: {browserPermission === 'granted' ? 'Enabled ✓' : 'Enable'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Action and Filter Controls Row */}
      <div className="bg-white border border-border p-4 rounded-3xl shadow-sm mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { key: 'all', label: 'All', count: notifications.length },
            { key: 'unread', label: 'Unread', count: unreadCount },
            { key: 'orders', label: 'Orders', count: notifications.filter((n) => n.type.startsWith('ORDER_')).length },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeFilter === tab.key
                  ? 'bg-primary-darker text-white shadow-sm'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  activeFilter === tab.key
                    ? 'bg-amber text-primary-darker font-black'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notifications..."
              className="w-full bg-cream border border-border focus:border-primary rounded-xl py-2 pl-9 pr-3 text-xs focus:outline-none transition-all"
            />
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="px-3.5 py-2 bg-amber hover:bg-amber-dark text-primary-darker font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 whitespace-nowrap active:scale-95"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all read</span>
            </button>
          )}

          <button
            onClick={fetchNotifications}
            className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl transition-colors border border-border"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary' : ''}`} />
          </button>
        </div>
      </div>

      {/* Notifications List Container */}
      <div className="flex flex-col gap-3">
        {loading && notifications.length === 0 ? (
          // Skeleton loaders
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="bg-white border border-border rounded-2xl p-5 shadow-xs animate-pulse flex gap-4 items-center"
              >
                <div className="w-12 h-12 rounded-2xl bg-gray-200 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredNotifications.length === 0 ? (
          // Empty State
          <div className="bg-white border border-border rounded-3xl p-12 text-center shadow-xs">
            <div className="w-16 h-16 bg-amber-light/30 border border-amber/30 text-amber-dark rounded-full flex items-center justify-center text-3xl mx-auto mb-3 shadow-xs">
              🔔
            </div>
            <h3 className="font-outfit font-bold text-lg text-primary-dark mb-1">
              No Notifications Found
            </h3>
            <p className="text-gray-400 text-xs leading-relaxed max-w-sm mx-auto mb-6">
              {searchQuery || activeFilter !== 'all'
                ? 'No notifications match your filter criteria.'
                : "You're all caught up! When you place orders or kitchen status changes, you'll see alerts here in real time."}
            </p>
            {(searchQuery || activeFilter !== 'all') && (
              <button
                onClick={() => {
                  setActiveFilter('all');
                  setSearchQuery('');
                }}
                className="text-xs font-bold text-primary hover:underline"
              >
                Reset filters
              </button>
            )}
          </div>
        ) : (
          filteredNotifications.map((notif) => (
            <NotificationItem key={notif._id || notif.id} notification={notif} />
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationCenter;
