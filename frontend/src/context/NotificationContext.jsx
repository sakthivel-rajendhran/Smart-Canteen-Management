import React, { createContext, useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';
import notificationService from '../services/notificationService';

export const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [socketStatus, setSocketStatus] = useState('disconnected'); // 'connected' | 'reconnecting' | 'disconnected'
  const [toasts, setToasts] = useState([]);

  // Audio preference (default: ON)
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('drs_notification_sound');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Browser notification permission state
  const [browserPermission, setBrowserPermission] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  const socketRef = useRef(null);
  const audioCtxRef = useRef(null);

  // Synthesize Web Audio chime
  const playChime = useCallback((priority = 'NORMAL') => {
    if (!soundEnabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;

      if (priority === 'HIGH') {
        // High priority: 3 ascending celebratory bell tones (E5, G#5, B5)
        const notes = [659.25, 830.61, 987.77];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.12);

          gain.gain.setValueAtTime(0, now + idx * 0.12);
          gain.gain.linearRampToValueAtTime(0.25, now + idx * 0.12 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.5);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + idx * 0.12);
          osc.stop(now + idx * 0.12 + 0.5);
        });
      } else {
        // Normal priority: 2 smooth harmonic chime tones (D5 -> A5)
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, now); // D5
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880.0, now + 0.1); // A5

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc1.stop(now + 0.45);
        osc2.start(now + 0.1);
        osc2.stop(now + 0.45);
      }
    } catch (err) {
      console.warn('Web Audio playback failed or blocked by browser:', err);
    }
  }, [soundEnabled]);

  // Trigger optional Web Browser Notification
  const triggerBrowserNotification = useCallback((notification) => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const title = `${notification.icon || '🔔'} ${notification.title}`;
        const options = {
          body: notification.message,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: notification._id || `order-${notification.metadata?.orderCode || Date.now()}`,
        };
        const n = new Notification(title, options);
        n.onclick = () => {
          window.focus();
          if (notification.metadata?.orderCode) {
            window.location.href = `/tracker/${notification.metadata.orderCode}`;
          }
          n.close();
        };
      } catch (err) {
        console.warn('Native notification error:', err);
      }
    }
  }, []);

  // In-app toast adder
  const addToast = useCallback((notification) => {
    const toastId = notification._id || `toast-${Date.now()}-${Math.random()}`;
    const newToast = {
      id: toastId,
      notificationId: notification._id,
      title: notification.title,
      message: notification.message,
      icon: notification.icon || '🔔',
      priority: notification.priority || 'NORMAL',
      orderCode: notification.metadata?.orderCode,
      createdAt: notification.createdAt || new Date(),
    };

    setToasts((prev) => [newToast, ...prev.slice(0, 3)]); // Keep maximum 4 active toasts

    // Auto dismiss after 5.5 seconds
    setTimeout(() => {
      dismissToast(toastId);
    }, 5500);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Fetch initial notifications from REST API
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await notificationService.getNotifications({ limit: 50 });
      if (res?.success) {
        setNotifications(res.data || []);
        setUnreadCount(typeof res.unreadCount === 'number' ? res.unreadCount : 0);
      }
    } catch (err) {
      console.error('Failed to load notification history:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Toggle audio alerts
  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('drs_notification_sound', JSON.stringify(next));
      if (next) playChime('NORMAL');
      return next;
    });
  }, [playChime]);

  // Request browser notification permission
  const requestBrowserPermission = useCallback(async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setBrowserPermission(perm);
        return perm === 'granted';
      } catch (e) {
        console.error('Permission request failed:', e);
      }
    }
    return false;
  }, []);

  // Mark single notification as read
  const markAsRead = useCallback(async (id) => {
    try {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      // REST update
      await notificationService.markAsRead(id);

      // Multi-tab socket sync
      if (socketRef.current?.connected) {
        socketRef.current.emit('notification:markRead', { id });
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
      fetchNotifications();
    }
  }, [fetchNotifications]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      // Optimistic update
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);

      // REST update
      await notificationService.markAllAsRead();

      // Multi-tab socket sync
      if (socketRef.current?.connected) {
        socketRef.current.emit('notification:markReadAll');
      }
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      fetchNotifications();
    }
  }, [fetchNotifications]);

  // Delete notification
  const deleteNotification = useCallback(async (id) => {
    try {
      // Optimistic remove
      const item = notifications.find((n) => n._id === id);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      if (item && !item.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }

      // REST delete
      await notificationService.deleteNotification(id);

      // Multi-tab socket sync
      if (socketRef.current?.connected) {
        socketRef.current.emit('notification:remove', { id });
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
      fetchNotifications();
    }
  }, [notifications, fetchNotifications]);

  // Manage Socket.IO lifecycle
  useEffect(() => {
    if (!user || !user.token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setNotifications([]);
      setUnreadCount(0);
      setSocketStatus('disconnected');
      return;
    }

    // Initial fetch of notification history
    fetchNotifications();

    // Connect to Socket.IO server with JWT authentication
    const socketUrl = `${window.location.protocol}//${window.location.hostname}:5000`;
    const socket = io(socketUrl, {
      auth: {
        token: user.token,
      },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ Notification Socket connected:', socket.id);
      setSocketStatus('connected');
      // Refetch latest notifications on reconnect to synchronize state
      notificationService
        .getUnreadCount()
        .then((res) => {
          if (res?.success) setUnreadCount(res.unreadCount);
        })
        .catch(() => {});
    });

    socket.on('disconnect', () => {
      console.warn('⚠️ Notification Socket disconnected');
      setSocketStatus('disconnected');
    });

    socket.on('reconnect_attempt', () => {
      setSocketStatus('reconnecting');
    });

    socket.on('reconnect', () => {
      console.log('🔄 Notification Socket reconnected');
      setSocketStatus('connected');
      fetchNotifications();
    });

    // Real-Time Event: Incoming New Notification
    socket.on('notification:new', (newNotif) => {
      console.log('🔔 Real-time notification received:', newNotif);
      if (!newNotif) return;

      setNotifications((prev) => {
        // Prevent duplicate addition
        if (prev.some((n) => n._id === newNotif._id)) return prev;
        return [newNotif, ...prev];
      });

      setUnreadCount((prev) => prev + 1);
      addToast(newNotif);
      playChime(newNotif.priority);
      triggerBrowserNotification(newNotif);
    });

    // Multi-tab sync listeners
    socket.on('notification:read', ({ id }) => {
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    });

    socket.on('notification:readAll', () => {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    });

    socket.on('notification:deleted', ({ id }) => {
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      notificationService
        .getUnreadCount()
        .then((res) => {
          if (res?.success) setUnreadCount(res.unreadCount);
        })
        .catch(() => {});
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.token, fetchNotifications, addToast, playChime, triggerBrowserNotification]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        socketStatus,
        toasts,
        soundEnabled,
        browserPermission,
        toggleSound,
        requestBrowserPermission,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        dismissToast,
        fetchNotifications,
        socket: socketRef.current,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
