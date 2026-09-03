import express from 'express';
import dns from 'dns';
// dns.setDefaultResultOrder('ipv4first');
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
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

// Error Handler Middleware
import { notFound, errorHandler } from './middleware/errorMiddleware.js';

dotenv.config();

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

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Socket.IO Setup
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
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
app.use('/api/orders', orderRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);

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
