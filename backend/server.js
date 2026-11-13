import express from 'express';
import dns from 'dns';
// dns.setDefaultResultOrder('ipv4first');
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import compression from 'compression';
import dotenv from 'dotenv';

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

// CORS config
const corsOptions = {
  origin: true, // Echoes back the request origin dynamically (solves CORS local IP/host blocks)
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(compression());
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
    return originalEnd.apply(res, [chunk, ...args]);
  };

  next();
});

// Socket.IO Setup
const allowedOrigins = [
  'https://smart-canteen-management-two.vercel.app',
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
].filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, postman) or matching origins
      if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app') || process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      return callback(null, true); // Fallback to permissive for smooth real-time cross-origin support
    },
    methods: ['GET', 'POST', 'PATCH'],
    credentials: true,
  },
});

// Attach Socket.IO to App
app.set('socketio', io);

// Configure Socket Listeners
configureSockets(io);

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

// Health check API
app.get('/', (req, res) => {
  res.json({ success: true, message: 'DRS Quick Serve API Server is active!' });
});

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running in development mode on port ${PORT}`);
});
// Nodemon hot reload trigger comment
