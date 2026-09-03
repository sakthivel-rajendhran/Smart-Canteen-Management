import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const configureSockets = (io) => {
  // Socket.IO Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '') ||
        socket.handshake.query?.token;

      if (token) {
        try {
          const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || 'supersecretjwtkeydrsquickserve12345'
          );
          const user = await User.findById(decoded.id).select('-password');
          if (user) {
            socket.user = user;
          }
        } catch (jwtErr) {
          console.warn(`Socket authentication warning (${socket.id}): Invalid or expired token`);
          // Note: We don't necessarily kill the socket if guests need public menu updates,
          // but socket.user will remain undefined so private rooms are blocked.
        }
      }
      next();
    } catch (err) {
      console.error('Socket middleware error:', err);
      next(err);
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user?._id?.toString();
    const userRole = socket.user?.role;

    // Automatically join the authenticated user's private room
    if (userId) {
      const userRoom = `user:${userId}`;
      socket.join(userRoom);
      console.log(`🔒 Authenticated Socket ${socket.id} (${socket.user.name}) automatically joined room: ${userRoom}`);

      // If administrator, automatically join 'admin' room
      if (userRole === 'admin') {
        socket.join('admin');
        console.log(`🛡️ Admin Socket ${socket.id} automatically joined room: admin`);
      }
    } else {
      console.log(`🌐 Guest / Unauthenticated Socket connected: ${socket.id}`);
    }

    // Guarded manual room join requests
    socket.on('join', (room) => {
      if (!room || typeof room !== 'string') return;

      if (room.startsWith('user:')) {
        const requestedUserId = room.replace('user:', '');
        // Security check: Must be authenticated and must match own user ID (or be admin)
        if (!socket.user || (socket.user._id.toString() !== requestedUserId && socket.user.role !== 'admin')) {
          console.warn(`⛔ Unauthorized room join attempt by socket ${socket.id} for room ${room}`);
          return socket.emit('error:unauthorized', { message: 'Cannot join another user room' });
        }
        socket.join(room);
        console.log(`Socket ${socket.id} verified and joined: ${room}`);
      } else if (room === 'admin') {
        if (!socket.user || socket.user.role !== 'admin') {
          console.warn(`⛔ Unauthorized admin room join attempt by socket ${socket.id}`);
          return socket.emit('error:unauthorized', { message: 'Admin access required for room admin' });
        }
        socket.join('admin');
        console.log(`Socket ${socket.id} verified and joined: admin`);
      } else {
        // Other rooms (e.g. general order tracking)
        socket.join(room);
        console.log(`Socket ${socket.id} joined general room: ${room}`);
      }
    });

    // Real-time synchronization events across multi-tab sessions
    socket.on('notification:markRead', ({ id }) => {
      if (userId && id) {
        socket.to(`user:${userId}`).emit('notification:read', { id });
      }
    });

    socket.on('notification:markReadAll', () => {
      if (userId) {
        socket.to(`user:${userId}`).emit('notification:readAll');
      }
    });

    socket.on('notification:remove', ({ id }) => {
      if (userId && id) {
        socket.to(`user:${userId}`).emit('notification:deleted', { id });
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket client disconnected: ${socket.id}`);
    });
  });
};

export default configureSockets;
