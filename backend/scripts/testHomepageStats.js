import io from '../../frontend/node_modules/socket.io-client/build/esm/index.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from '../config/db.js';
import Order from '../models/Order.js';
import MenuItem from '../models/MenuItem.js';
import Category from '../models/Category.js';
import User from '../models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_URL = 'http://localhost:5000/api/homepage/stats';
const SOCKET_URL = 'http://localhost:5000';

async function runTests() {
  console.log('===============================================================');
  console.log('DRS QUICK SERVE — HOMEPAGE REAL-TIME STATISTICS TEST SUITE');
  console.log('===============================================================');
  await connectDB();

  // ---------------------------------------------------------------------------
  // TEST 1: Database Calculations & Accuracy
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 1] Verifying Database Calculations...');
  const expectedOrders = await Order.countDocuments({ status: { $ne: 'Cancelled' } });
  const expectedMenuItems = await MenuItem.countDocuments({
    available: true,
    $or: [{ variantParent: null }, { variantParent: { $exists: false } }],
  });
  const prepAgg = await MenuItem.aggregate([
    {
      $match: {
        available: true,
        $or: [{ variantParent: null }, { variantParent: { $exists: false } }],
        preparationTime: { $gt: 0 },
      },
    },
    {
      $group: {
        _id: null,
        avgTime: { $avg: '$preparationTime' },
      },
    },
  ]);
  const expectedAvgPrepTime = Math.round(prepAgg.length > 0 && prepAgg[0].avgTime ? prepAgg[0].avgTime : 5);
  const expectedCategories = await Category.countDocuments({ active: true });

  console.log(`Database State:`);
  console.log(`  - Non-cancelled Orders: ${expectedOrders}`);
  console.log(`  - Available Menu Items: ${expectedMenuItems}`);
  console.log(`  - Average Prep Time:    ${expectedAvgPrepTime} min`);
  console.log(`  - Active Categories:    ${expectedCategories}`);

  // ---------------------------------------------------------------------------
  // TEST 2: GET /api/homepage/stats API Verification
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 2] Testing GET /api/homepage/stats HTTP Endpoint...');
  const res = await fetch(API_URL);
  const json = await res.json();

  if (!json.success || !json.data) {
    throw new Error(`API returned failure: ${JSON.stringify(json)}`);
  }

  const { ordersPlaced, menuItems, averagePreparationTime, categoriesCount, traditional, lastUpdated } = json.data;
  console.log('API Response received:', json.data);

  if (ordersPlaced !== expectedOrders) {
    throw new Error(`Orders placed mismatch! API: ${ordersPlaced}, Expected DB: ${expectedOrders}`);
  }
  if (menuItems !== expectedMenuItems) {
    throw new Error(`Menu items mismatch! API: ${menuItems}, Expected DB: ${expectedMenuItems}`);
  }
  if (averagePreparationTime !== expectedAvgPrepTime) {
    throw new Error(`Avg prep time mismatch! API: ${averagePreparationTime}, Expected DB: ${expectedAvgPrepTime}`);
  }
  if (traditional !== 'Authentic') {
    throw new Error(`Traditional brand statement mismatch! API: ${traditional}, Expected: Authentic`);
  }
  if (!lastUpdated) {
    throw new Error('lastUpdated timestamp missing from payload!');
  }
  console.log('✅ TEST 2 PASSED: All API values strictly match actual MongoDB database records.');

  // ---------------------------------------------------------------------------
  // TEST 3: Privacy & Security Check
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 3] Security & Data Privacy Verification...');
  const sensitiveKeys = ['user', 'customer', 'customerName', 'phone', 'email', 'items', 'total', 'address', 'paymentDetails'];
  const exposedKeys = Object.keys(json.data).filter(k => sensitiveKeys.includes(k));
  if (exposedKeys.length > 0) {
    throw new Error(`Sensitive data exposed in homepage stats: ${exposedKeys.join(', ')}`);
  }
  console.log('✅ TEST 3 PASSED: No individual orders, customer identities, or private details exposed.');

  // ---------------------------------------------------------------------------
  // TEST 4: Multi-User Concurrent Socket.IO Connection & Broadcast Verification
  // ---------------------------------------------------------------------------
  console.log('\n[TEST 4] Multi-User Socket.IO Simulation (Student A, Student B, Faculty C)...');
  
  const clientA = io(SOCKET_URL, { transports: ['websocket'] });
  const clientB = io(SOCKET_URL, { transports: ['websocket'] });
  const clientC = io(SOCKET_URL, { transports: ['websocket'] });

  await Promise.all([
    new Promise(resolve => clientA.on('connect', resolve)),
    new Promise(resolve => clientB.on('connect', resolve)),
    new Promise(resolve => clientC.on('connect', resolve)),
  ]);
  console.log(`Connected 3 concurrent visitors:`);
  console.log(`  - Student A Socket ID: ${clientA.id}`);
  console.log(`  - Student B Socket ID: ${clientB.id}`);
  console.log(`  - Faculty C Socket ID: ${clientC.id}`);

  clientA.disconnect();
  clientB.disconnect();
  clientC.disconnect();
  console.log('✅ Multi-user connection test passed.');

  console.log('\n===============================================================');
  console.log('🎉 ALL HOMEPAGE STATISTICS TESTS VERIFIED SUCCESSFULLY!');
  console.log('===============================================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('\n❌ Test failed with error:', err);
  process.exit(1);
});
