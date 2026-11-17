import express from 'express';
import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Database config
import connectDB from './config/db.js';

// Sockets config
import configureSockets from './sockets/orderSocket.js';

// Route files
import authRoutes from './routes/authRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import menuRoutes from './routes/menuRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import couponRoutes from './routes/couponRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import posRoutes from './routes/posRoutes.js';
import revenueReportRoutes from './routes/revenueReportRoutes.js';

// Error Handler Middleware
import { notFound, errorHandler } from './middleware/errorMiddleware.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config();

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required.');
  process.exit(1);
}

// Connect to Database
connectDB();

const app = express();
const server = http.createServer(app);

// Trust proxy for accurate IP address in rate limiters when behind Render / Vercel proxies
app.set('trust proxy', 1);

// Security Headers (configured to allow Cloudinary media assets)
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

// Allowed origins whitelist: CLIENT_URL (+ localhost in dev)
const allowedOrigins = [
  'https://smart-canteen-management-two.vercel.app',
  process.env.CLIENT_URL,
  ...(process.env.NODE_ENV !== 'production'
    ? ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000']
    : []),
].filter(Boolean);

const isOriginAllowed = (origin) => {
  if (!origin) return true; // Server-to-server or tools (curl/postman)
  if (allowedOrigins.includes(origin)) return true;
  if (
    process.env.NODE_ENV !== 'production' &&
    (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))
  ) {
    return true;
  }
  return false;
};

// Express CORS config (strict origin check, no permissive fallback)
const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS blocked: Origin not allowed'));
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(compression());
app.use(cors(corsOptions));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Performance & Request Timing Middleware
app.use((req, res, next) => {
  const start = process.hrtime();
  let resSize = 0;

  const originalWrite = res.write;
  const originalEnd = res.end;

  res.write = function (chunk, ...args) {
    if (chunk) {
      resSize += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
    }
    return originalWrite.apply(res, [chunk, ...args]);
  };

  res.end = function (chunk, ...args) {
    if (chunk) {
      resSize += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
    }
    const diff = process.hrtime(start);
    const durationMs = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);
    const sizeKB = (resSize / 1024).toFixed(2);
    console.log(`[PERF] ${req.method} ${req.originalUrl || req.url} ${res.statusCode} - ${durationMs}ms (${sizeKB} KB)`);
    if (Number(durationMs) > 500) {
      console.warn(`⚠️ [SLOW REQUEST] ${req.method} ${req.originalUrl || req.url} took ${durationMs}ms (>500ms threshold) - ${res.statusCode} (${sizeKB} KB)`);
    }
    return originalEnd.apply(res, [chunk, ...args]);
  };

  next();
});

// Rate Limiters
// 1. General API: 300 requests per 15 min per IP (supports load-test header bypass)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.headers['x-load-test'] === 'drs-load-test-bypass',
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again after 15 minutes.',
  },
});

// 2. Auth (Login & Register): 10 requests per 15 min per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login or registration attempts. Please try again after 15 minutes.',
  },
});

// 3. Coupon Validate: 20 requests per 15 min per IP
const couponLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many coupon validation attempts. Please try again after 15 minutes.',
  },
});

// Socket.IO Setup (strict parameters and no permissive origin fallback)
const io = new Server(server, {
  pingInterval: 25000,
  pingTimeout: 20000,
  maxHttpBufferSize: 100 * 1024, // 100 KB
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Socket.IO CORS blocked: Origin not allowed'));
    },
    methods: ['GET', 'POST', 'PATCH'],
    credentials: true,
  },
});

// Attach Socket.IO to App
app.set('socketio', io);

// Configure Socket Listeners
configureSockets(io);

// Health check API (excluded from general rate limits)
app.get('/api/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

app.get('/', (req, res) => {
  res.json({ success: true, message: 'DRS Quick Serve API Server is active!' });
});

// Apply Rate Limiters
app.use('/api', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/coupons/validate', couponLimiter);

// API Mappings
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/admin/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', posRoutes);
app.use('/api/admin/revenue', revenueReportRoutes);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running in development mode on port ${PORT}`);
});

// Graceful Shutdown & Process Stability Handlers
let isShuttingDown = false;

const shutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[SHUTDOWN] Received ${signal}. Closing server gracefully...`);

  // Stop accepting new HTTP requests
  server.close(async () => {
    console.log('[SHUTDOWN] HTTP server closed.');
    try {
      if (io) {
        await io.close();
        console.log('[SHUTDOWN] Socket.IO closed.');
      }
      await mongoose.connection.close(false);
      console.log('[SHUTDOWN] Mongoose connection closed.');
      process.exit(0);
    } catch (err) {
      console.error('[SHUTDOWN] Error during shutdown:', err);
      process.exit(1);
    }
  });

  // Forced exit fallback after 10s
  setTimeout(() => {
    console.error('[SHUTDOWN] Forced shutdown after 10s timeout.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught Exception:', error);
  process.exit(1);
});
