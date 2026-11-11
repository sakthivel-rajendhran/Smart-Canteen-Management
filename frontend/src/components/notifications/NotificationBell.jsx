import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import NotificationDropdown from './NotificationDropdown';

const EDGE_MARGIN = 12;

const NotificationBell = ({ isAdmin = false }) => {
  const { unreadCount, socketStatus } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [panelAnchor, setPanelAnchor] = useState({
    isMobile: false,
    top: 68,
    right: EDGE_MARGIN,
    width: 360,
    caretRight: 18,
  });
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const location = useLocation();

  const updateAnchorPosition = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const isMobile = vw < 768;

    if (!isMobile) {
      const desktopWidth = Math.min(390, vw - 32);
      const bellCenter = rect.left + rect.width / 2;
      // Check if right-0 stays >= 16px inside viewport left edge
      const overflowLeft = Math.max(0, EDGE_MARGIN - (rect.right - desktopWidth));
      const panelRightEdge = rect.right + overflowLeft;
      const caretRight = Math.max(14, Math.min(desktopWidth - 28, Math.round(panelRightEdge - bellCenter - 6)));
      setPanelAnchor({
        isMobile: false,
        top: Math.round(rect.bottom + 8),
        right: overflowLeft > 0 ? Math.round(vw - panelRightEdge) : 0,
        shiftRight: overflowLeft,
        width: desktopWidth,
        caretRight,
      });
      return;
    }

    const panelWidth = Math.min(380, vw - EDGE_MARGIN * 2);
    const bellCenter = rect.left + rect.width / 2;
    const desiredRightEdge = Math.min(vw - EDGE_MARGIN, Math.max(panelWidth + EDGE_MARGIN, rect.right + 44));
    const rightOffset = Math.max(EDGE_MARGIN, Math.round(vw - desiredRightEdge));
    const actualRightEdge = vw - rightOffset;
    const caretRight = Math.max(18, Math.min(panelWidth - 30, Math.round(actualRightEdge - bellCenter - 6)));

    setPanelAnchor({
      isMobile: true,
      top: Math.round(rect.bottom + 8),
      right: rightOffset,
      shiftRight: 0,
      width: panelWidth,
      caretRight,
    });
  }, []);

  // Recompute anchor geometry when opened or resized
  useEffect(() => {
    if (!isOpen) return;
    updateAnchorPosition();
    window.addEventListener('resize', updateAnchorPosition);
    window.addEventListener('scroll', updateAnchorPosition, true);
    return () => {
      window.removeEventListener('resize', updateAnchorPosition);
      window.removeEventListener('scroll', updateAnchorPosition, true);
    };
  }, [isOpen, updateAnchorPosition]);

  // Close dropdown automatically when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  // Close dropdown on outside pointer click / tap
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const badgeLabel = unreadCount > 99 ? '99+' : unreadCount;

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Bell Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        data-testid="notification-bell-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`relative rounded-full transition-all flex items-center justify-center select-none ${
          isAdmin ? 'h-9 w-9' : 'p-2'
        } ${
          isOpen
            ? 'bg-amber text-primary-darker shadow-sm shadow-amber/20'
            : isAdmin
            ? 'text-white/85 hover:bg-white/10 hover:text-white bg-transparent'
            : 'text-white/85 hover:bg-white/10 hover:text-white'
        }`}
        title="Notifications"
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <Bell className={`${isAdmin ? 'w-4 h-4' : 'w-5 h-5'} transition-transform duration-200`} />

        {/* Unread Count Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white font-outfit font-black text-[9px] min-w-[16px] h-[16px] px-1 rounded-full flex items-center justify-center border-2 border-primary-darker shadow-md">
            {badgeLabel}
          </span>
        )}

        {/* Real-Time Live Connection Dot */}
        {socketStatus === 'connected' ? (
          <span className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-green-400 ring-1 ring-primary-darker" />
        ) : socketStatus === 'reconnecting' ? (
          <span className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-400 ring-1 ring-primary-darker animate-pulse" />
        ) : null}
      </button>

      {/* Mobile Scrim + Floating Anchored Dropdown */}
      {isOpen && (
        <>
          {panelAnchor.isMobile && (
            <div
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 top-16 bg-black/25 z-40"
              aria-hidden="true"
            />
          )}

          <div
            data-testid="notification-dropdown-anchor"
            style={
              panelAnchor.isMobile
                ? {
                    position: 'fixed',
                    top: `${panelAnchor.top}px`,
                    right: `${panelAnchor.right}px`,
                    width: `${panelAnchor.width}px`,
                    maxWidth: 'calc(100vw - 24px)',
                  }
                : {
                    position: 'absolute',
                    top: '100%',
                    right: panelAnchor.shiftRight ? `-${panelAnchor.shiftRight}px` : '0px',
                    marginTop: '10px',
                    width: `${panelAnchor.width}px`,
                    maxWidth: 'calc(100vw - 32px)',
                  }
            }
            className="z-50"
          >
            {/* Visual Caret Pointer Anchored to Bell */}
            <span
              style={{ right: `${panelAnchor.caretRight}px` }}
              className="absolute -top-1.5 w-3 h-3 rotate-45 bg-primary-darker border-l border-t border-white/15 z-10 pointer-events-none"
              aria-hidden="true"
            />
            <NotificationDropdown onClose={() => setIsOpen(false)} />
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationBell;
