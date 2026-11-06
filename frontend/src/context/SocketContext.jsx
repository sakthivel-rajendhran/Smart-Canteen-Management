import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import { getSocketUrl } from '../services/api';
import { useAuth } from './AuthContext';

const SocketContext = createContext({
  socket: null,
  isConnected: false,
});

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socketUrl = getSocketUrl();
    console.log('🔌 Connecting shared Socket.IO to:', socketUrl);

    // Create a single socket connection instance for the tab
    const socket = io(socketUrl, {
      auth: {
        token: user?.token || '',
      },
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🔌 Shared Socket.IO connected:', socket.id);
      setIsConnected(true);

      // Join private user and admin rooms if authenticated
      if (user?._id) {
        socket.emit('join', `user:${user._id}`);
      }
      if (user?.role === 'admin') {
        socket.emit('join', 'admin');
      }
    });

    socket.on('connect_error', (err) => {
      console.warn('⚠️ Shared Socket.IO connection attempt warning:', err.message);
      setIsConnected(false);
    });

    socket.on('disconnect', () => {
      console.warn('⚠️ Shared Socket.IO disconnected');
      setIsConnected(false);
    });

    socket.on('reconnect', () => {
      console.log('🔄 Shared Socket.IO reconnected');
      setIsConnected(true);
      if (user?._id) {
        socket.emit('join', `user:${user._id}`);
      }
      if (user?.role === 'admin') {
        socket.emit('join', 'admin');
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [user?.token, user?._id, user?.role]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  return context;
};

export default SocketContext;

