import React, { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import NotificationDropdown from './NotificationDropdown';

const NotificationBell = ({ isAdmin = false }) => {
  const { unreadCount, socketStatus } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Format count for display (e.g. 99+)
  const badgeLabel = unreadCount > 99 ? '99+' : unreadCount;

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`relative p-2 rounded-full transition-all flex items-center justify-center ${
          isOpen
            ? 'bg-amber text-primary-darker shadow-md'
            : isAdmin
            ? 'text-white/80 hover:bg-white/10 hover:text-white'
            : 'text-white/85 hover:bg-white/10 hover:text-white'
        }`}
        title="Notifications"
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <Bell className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />

        {/* Unread Count Badge (Section 13: Hidden when unreadCount is 0) */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white font-outfit font-black text-[10px] min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center border-2 border-primary-darker shadow-md animate-in zoom-in-75 duration-150">
            {badgeLabel}
          </span>
        )}

        {/* Real-Time Live Connection Pulse Dot */}
        {socketStatus === 'connected' ? (
          <span className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-green-400 ring-1 ring-primary-darker" />
        ) : socketStatus === 'reconnecting' ? (
          <span className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-400 ring-1 ring-primary-darker animate-ping" />
        ) : null}
      </button>

      {/* Floating Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 z-50">
          <NotificationDropdown onClose={() => setIsOpen(false)} />
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
