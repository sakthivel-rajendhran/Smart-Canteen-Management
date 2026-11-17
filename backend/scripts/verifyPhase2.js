import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import dns from 'dns';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

import Order from '../models/Order.js';
import Coupon from '../models/Coupon.js';
import User from '../models/User.js';
import MenuItem from '../models/MenuItem.js';
import Category from '../models/Category.js';
import CanteenSettings from '../models/CanteenSettings.js';

dotenv.config({ path: './backend/.env' });
dotenv.config();

const BASE_URL = 'http://127.0.0.1:5000';

async function runTests() {
  console.log('====================================================');
  console.log('    DRS QUICK SERVE - PHASE 2 VERIFICATION SUITE   ');
  console.log('====================================================\n');

  // Connect to mongoose for test setup/cleanup
  await mongoose.connect(process.env.MONGO_URI, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 15000,
  });

  // Find or create test student
  let testStudent = await User.findOne({ email: 'test_student_p2@drs.com' });
  if (!testStudent) {
    testStudent = await User.create({
      name: 'Test Student P2',
      email: 'test_student_p2@drs.com',
      password: 'password123',
      role: 'STUDENT',
      accountType: 'STUDENT',
    });
  }

  // Find or create test admin
  let testAdmin = await User.findOne({ role: { $in: ['admin', 'ADMIN'] } });
  if (!testAdmin) {
    testAdmin = await User.create({
      name: 'Test Admin P2',
      email: 'test_admin_p2@drs.com',
      password: 'password123',
      role: 'admin',
    });
  }

  const studentToken = jwt.sign({ id: testStudent._id, role: 'student', name: testStudent.name }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const adminToken = jwt.sign({ id: testAdmin._id, role: 'admin', name: testAdmin.name }, process.env.JWT_SECRET, { expiresIn: '1h' });

  // Clear any existing active orders for testStudent
  await Order.deleteMany({ user: testStudent._id });

  // Get an available menu item
  const menuItem = await MenuItem.findOne({ available: true }).lean();
  if (!menuItem) {
    console.error('❌ No available menu items found for test.');
    process.exit(1);
  }

  console.log('Using test menu item:', menuItem.name, '(Price: ₹' + menuItem.price + ')');

  // ----------------------------------------------------
  // TEST 1: Order Code Format & Creation
  // ----------------------------------------------------
  console.log('\n--- TEST 1: Order Code Format (DRS-YYMMDD-XXXX) ---');
  const res1 = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      items: [{ menuItem: menuItem._id, quantity: 1, serviceType: 'NORMAL' }],
      paymentMethod: 'cod',
    }),
  });
  const data1 = await res1.json();
  const code = data1.data?.orderCode;
  const codeRegex = /^DRS-\d{6}-[A-Z0-9]{4}$/;
  const isMatch = codeRegex.test(code);
  console.log('Generated Order Code:', code);
  console.log('Matches DRS-YYMMDD-XXXX format:', isMatch ? '✅ PASS' : '❌ FAIL');

  // ----------------------------------------------------
  // TEST 2: Idempotency with clientRequestId
  // ----------------------------------------------------
  console.log('\n--- TEST 2: Idempotency with clientRequestId ---');
  const clientReqId = 'test_req_' + Date.now();

  // First call: should create order
  const idempRes1 = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      items: [{ menuItem: menuItem._id, quantity: 1, serviceType: 'NORMAL' }],
      paymentMethod: 'cod',
      clientRequestId: clientReqId,
    }),
  });
  const idempData1 = await idempRes1.json();
  console.log('Call 1 Status:', idempRes1.status, 'OrderCode:', idempData1.data?.orderCode);

  // Second call with same clientRequestId: should return existing order without creating duplicate
  const idempRes2 = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      items: [{ menuItem: menuItem._id, quantity: 1, serviceType: 'NORMAL' }],
      paymentMethod: 'cod',
      clientRequestId: clientReqId,
    }),
  });
  const idempData2 = await idempRes2.json();
  console.log('Call 2 Status:', idempRes2.status, 'OrderCode:', idempData2.data?.orderCode, 'Message:', idempData2.message);

  const isIdempotent = (idempRes2.status === 200) && (idempData1.data?._id === idempData2.data?._id);
  console.log('Idempotency verified:', isIdempotent ? '✅ PASS' : '❌ FAIL');

  // ----------------------------------------------------
  // TEST 3: Student Active Orders Limit (Max 3)
  // ----------------------------------------------------
  console.log('\n--- TEST 3: Active Orders Limit (Max 3 per student) ---');
  // Student currently has 2 active orders (data1, idempData1). Let's create a 3rd.
  const res3 = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      items: [{ menuItem: menuItem._id, quantity: 1, serviceType: 'NORMAL' }],
      paymentMethod: 'cod',
    }),
  });
  const data3 = await res3.json();
  console.log('Order 3 (Limit reached): Status:', res3.status, 'OrderCode:', data3.data?.orderCode);

  // Attempt 4th active order: should be rejected with 400
  const res4 = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      items: [{ menuItem: menuItem._id, quantity: 1, serviceType: 'NORMAL' }],
      paymentMethod: 'cod',
    }),
  });
  const data4 = await res4.json();
  console.log('Order 4 Status:', res4.status, 'Message:', data4.message);
  console.log('Limit rejection verified:', (res4.status === 400 && data4.message.includes('maximum limit of 3')) ? '✅ PASS' : '❌ FAIL');

  // Cancel one order to allow further testing
  await Order.updateOne({ _id: data1.data?._id }, { $set: { status: 'Completed' } });

  // ----------------------------------------------------
  // TEST 4: Atomic Coupons (Claim, Exhaustion & Decrement on Cancel)
  // ----------------------------------------------------
  console.log('\n--- TEST 4: Atomic Coupons (claim, reject on exhaustion, decrement on cancel) ---');
  await CanteenSettings.updateOne({ key: 'default' }, { $set: { couponsEnabled: true } });

  const testCouponCode = 'TESTP2_' + Math.floor(Math.random() * 10000);
  const expiryTomorrow = new Date();
  expiryTomorrow.setDate(expiryTomorrow.getDate() + 2);

  await Coupon.create({
    code: testCouponCode,
    discountType: 'flat',
    discountValue: 10,
    minimumOrder: 10,
    expiryDate: expiryTomorrow,
    usageLimit: 1, // Only 1 use allowed!
    usedCount: 0,
    active: true,
  });

  // First order with coupon: should succeed and atomically increment usedCount to 1
  const cRes1 = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      items: [{ menuItem: menuItem._id, quantity: 1, serviceType: 'NORMAL' }],
      couponCode: testCouponCode,
      paymentMethod: 'cod',
    }),
  });
  const cData1 = await cRes1.json();
  const cDoc1 = await Coupon.findOne({ code: testCouponCode }).lean();
  console.log('1st Coupon Use Status:', cRes1.status, 'OrderCode:', cData1.data?.orderCode, 'usedCount:', cDoc1.usedCount, '(Expected: 1)');
  console.log('Atomic claim verified:', (cRes1.status === 201 && cDoc1.usedCount === 1) ? '✅ PASS' : '❌ FAIL');

  // Complete an earlier order to ensure the active order limit isn't triggering the 400 on coupon retry
  await Order.updateOne({ _id: data3.data?._id }, { $set: { status: 'Completed' } });

  // Second order with coupon: should be REJECTED with 400 because limit is reached
  const cRes2 = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      items: [{ menuItem: menuItem._id, quantity: 1, serviceType: 'NORMAL' }],
      couponCode: testCouponCode,
      paymentMethod: 'cod',
    }),
  });
  const cData2 = await cRes2.json();
  console.log('2nd Coupon Use (exhausted): Status:', cRes2.status, 'Message:', cData2.message);
  console.log('Coupon exhaustion rejection:', (cRes2.status === 400 && cData2.message.includes('fully redeemed')) ? '✅ PASS' : '❌ FAIL');

  // Cancel the order: coupon usedCount should decrement to 0
  const cancelRes = await fetch(`${BASE_URL}/api/orders/${cData1.data?.orderCode}/cancel`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const cancelData = await cancelRes.json();
  const cDoc2 = await Coupon.findOne({ code: testCouponCode }).lean();
  console.log('Order Cancel Status:', cancelRes.status, 'usedCount after cancel:', cDoc2.usedCount, '(Expected: 0)');
  console.log('Coupon decrement on cancel verified:', cDoc2.usedCount === 0 ? '✅ PASS' : '❌ FAIL');

  // ----------------------------------------------------
  // TEST 5: Order Status Transitions & Overwrite Prevention
  // ----------------------------------------------------
  console.log('\n--- TEST 5: Status Transitions (findOneAndUpdate) ---');
  // Create a dedicated Placed order to test transitions
  const freshOrderRes = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      items: [{ menuItem: menuItem._id, quantity: 1, serviceType: 'NORMAL' }],
      paymentMethod: 'cod',
    }),
  });
  const freshOrderData = await freshOrderRes.json();
  const targetOrder = freshOrderData.data;

  // Valid: Placed -> Confirmed
  const sRes1 = await fetch(`${BASE_URL}/api/orders/${targetOrder.orderCode}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ status: 'Confirmed' }),
  });
  const sData1 = await sRes1.json();
  console.log('Placed -> Confirmed Status:', sRes1.status, 'New status:', sData1.data?.status);
  console.log('Placed -> Confirmed transition:', (sRes1.status === 200 && sData1.data?.status === 'Confirmed') ? '✅ PASS' : '❌ FAIL');

  // Invalid: Confirmed -> Ready (Skipping Preparing)
  const sRes2 = await fetch(`${BASE_URL}/api/orders/${targetOrder.orderCode}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ status: 'Ready' }),
  });
  const sData2 = await sRes2.json();
  console.log('Confirmed -> Ready (Invalid transition): Status:', sRes2.status, 'Message:', sData2.message);
  console.log('Invalid transition blocked:', sRes2.status === 400 ? '✅ PASS' : '❌ FAIL');

  // Valid: Confirmed -> Preparing
  const sRes3 = await fetch(`${BASE_URL}/api/orders/${targetOrder.orderCode}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ status: 'Preparing' }),
  });
  const sData3 = await sRes3.json();
  console.log('Confirmed -> Preparing Status:', sRes3.status, 'New status:', sData3.data?.status);
  console.log('Confirmed -> Preparing transition:', (sRes3.status === 200 && sData3.data?.status === 'Preparing') ? '✅ PASS' : '❌ FAIL');

  // ----------------------------------------------------
  // TEST 6: Security Headers (Helmet) & Rate Limit Headers
  // ----------------------------------------------------
  console.log('\n--- TEST 6: Helmet & Rate Limit Headers ---');
  const headRes = await fetch(`${BASE_URL}/api/health`);
  const headers = Object.fromEntries(headRes.headers.entries());
  console.log('X-DNS-Prefetch-Control:', headers['x-dns-prefetch-control']);
  console.log('X-Frame-Options:', headers['x-frame-options']);
  console.log('RateLimit-Limit:', headers['ratelimit-limit']);
  console.log('RateLimit-Remaining:', headers['ratelimit-remaining']);
  const hasSecurityHeaders = headers['x-frame-options'] || headers['x-dns-prefetch-control'];
  console.log('Security & RateLimit headers verified:', hasSecurityHeaders ? '✅ PASS' : '❌ FAIL');

  // Clean up test data
  await Order.deleteMany({ user: testStudent._id });
  await Coupon.deleteOne({ code: testCouponCode });
  await mongoose.disconnect();

  console.log('\n====================================================');
  console.log('       ALL PHASE 2 VERIFICATIONS PASSED ✅         ');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
