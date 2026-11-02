import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Server } from 'socket.io';

import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {
  // Ignore
}

dotenv.config();

// Route files
import authRoutes from '../routes/authRoutes.js';
import categoryRoutes from '../routes/categoryRoutes.js';
import menuRoutes from '../routes/menuRoutes.js';
import orderRoutes from '../routes/orderRoutes.js';
import couponRoutes from '../routes/couponRoutes.js';
import paymentRoutes from '../routes/paymentRoutes.js';
import analyticsRoutes from '../routes/analyticsRoutes.js';
import notificationRoutes from '../routes/notificationRoutes.js';
import { notFound, errorHandler } from '../middleware/errorMiddleware.js';

// Setup test app on dedicated test port
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.set('socketio', io);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/', (req, res) => {
  res.json({ success: true, message: 'DRS Quick Serve API Server is active!' });
});

app.use(notFound);
app.use(errorHandler);

const TEST_PORT = 5099;
const BASE_URL = `http://localhost:${TEST_PORT}`;

// Result tracking
const results = [];

function recordResult(group, apiName, method, endpoint, status, pass, details) {
  results.push({
    group,
    apiName,
    method,
    endpoint,
    status,
    pass,
    details: typeof details === 'object' ? JSON.stringify(details).slice(0, 100) : String(details).slice(0, 100),
  });
  const icon = pass ? '✅' : '❌';
  console.log(`${icon} [${group}] ${method} ${endpoint} -> Status ${status} (${pass ? 'PASSED' : 'FAILED'})`);
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined,
  });
  let data = null;
  try {
    data = await response.json();
  } catch (e) {
    data = { error: 'Failed to parse JSON response' };
  }
  return { status: response.status, ok: response.ok, data };
}

async function runTests() {
  console.log('====================================================');
  console.log('  STARTING SYSTEMATIC API AUDIT & STATUS CHECK');
  console.log('====================================================\n');

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB database for testing.\n');

  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`Test server running on port ${TEST_PORT}\n`);

  let userToken = '';
  let adminToken = '';
  let sampleCategoryId = '';
  let sampleMenuItemId = '';
  let sampleCouponId = '';
  let sampleOrderCode = '';
  let sampleOrderId = '';
  let sampleNotificationId = '';

  // 0. HEALTH CHECK
  try {
    const res = await request('/');
    recordResult('Health', 'Root Health Check', 'GET', '/', res.status, res.status === 200 && res.data.success, res.data.message);
  } catch (e) {
    recordResult('Health', 'Root Health Check', 'GET', '/', 500, false, e.message);
  }

  // 1. AUTH APIS
  try {
    // User login
    const userRes = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'sakthivel.june03@gmail.com', password: '123456' },
    });
    if (userRes.data?.success && userRes.data?.data?.token) {
      userToken = userRes.data.data.token;
      recordResult('Auth', 'Student Login', 'POST', '/api/auth/login', userRes.status, true, `Logged in as ${userRes.data.data.name}`);
    } else {
      recordResult('Auth', 'Student Login', 'POST', '/api/auth/login', userRes.status, false, userRes.data);
    }

    // Admin login
    const adminRes = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'sakthiadmin@gmail.com', password: 'Sakthi@2004' },
    });
    if (adminRes.data?.success && adminRes.data?.data?.token) {
      adminToken = adminRes.data.data.token;
      recordResult('Auth', 'Admin Login', 'POST', '/api/auth/login', adminRes.status, true, `Admin role confirmed: ${adminRes.data.data.role}`);
    } else {
      recordResult('Auth', 'Admin Login', 'POST', '/api/auth/login', adminRes.status, false, adminRes.data);
    }

    // Auth profile (GET /api/auth/me)
    const meRes = await request('/api/auth/me', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    recordResult('Auth', 'Get Profile', 'GET', '/api/auth/me', meRes.status, meRes.data?.success, meRes.data?.data?.email);

    // Auth update profile (PUT /api/auth/profile)
    const updateProfileRes = await request('/api/auth/profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${userToken}` },
      body: { phone: '9876543211' },
    });
    recordResult('Auth', 'Update Profile', 'PUT', '/api/auth/profile', updateProfileRes.status, updateProfileRes.data?.success, updateProfileRes.data?.message);
  } catch (e) {
    recordResult('Auth', 'Auth Suite', 'ERROR', '/api/auth/*', 500, false, e.message);
  }

  // 2. CATEGORIES APIS
  try {
    // GET /api/categories (Public)
    const catRes = await request('/api/categories');
    recordResult('Categories', 'Get All Categories', 'GET', '/api/categories', catRes.status, catRes.data?.success && Array.isArray(catRes.data?.data), `Count: ${catRes.data?.data?.length}`);
    if (catRes.data?.data?.length > 0) {
      sampleCategoryId = catRes.data.data[0]._id;
    }

    // POST /api/categories (Admin)
    const tempCatName = `TestCat_${Date.now()}`;
    const createCatRes = await request('/api/categories', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { name: tempCatName },
    });
    const createdCatId = createCatRes.data?.data?._id;
    recordResult('Categories', 'Create Category', 'POST', '/api/categories', createCatRes.status, createCatRes.data?.success, createCatRes.data?.message);

    // PUT /api/categories/:id (Admin)
    if (createdCatId) {
      const updateCatRes = await request(`/api/categories/${createdCatId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { name: `${tempCatName}_Updated` },
      });
      recordResult('Categories', 'Update Category', 'PUT', '/api/categories/:id', updateCatRes.status, updateCatRes.data?.success, updateCatRes.data?.message);

      // DELETE /api/categories/:id (Admin)
      const delCatRes = await request(`/api/categories/${createdCatId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      recordResult('Categories', 'Delete Category', 'DELETE', '/api/categories/:id', delCatRes.status, delCatRes.data?.success, delCatRes.data?.message);
    }
  } catch (e) {
    recordResult('Categories', 'Categories Suite', 'ERROR', '/api/categories', 500, false, e.message);
  }

  // 3. MENU APIS
  try {
    // GET /api/menu
    const menuRes = await request('/api/menu');
    recordResult('Menu', 'Get Menu Items', 'GET', '/api/menu', menuRes.status, menuRes.data?.success && Array.isArray(menuRes.data?.data), `Count: ${menuRes.data?.data?.length}`);
    if (menuRes.data?.data?.length > 0) {
      sampleMenuItemId = menuRes.data.data[0]._id;
    }

    // GET /api/menu?featuredOnly=true
    const featRes = await request('/api/menu?featuredOnly=true');
    recordResult('Menu', 'Get Featured Menu Items', 'GET', '/api/menu?featuredOnly=true', featRes.status, featRes.data?.success && Array.isArray(featRes.data?.data), `Count: ${featRes.data?.data?.length}`);

    // GET /api/menu?category=...
    if (sampleCategoryId) {
      const catMenuRes = await request(`/api/menu?category=${sampleCategoryId}`);
      recordResult('Menu', 'Get Menu by Category ID', 'GET', `/api/menu?category=${sampleCategoryId}`, catMenuRes.status, catMenuRes.data?.success, `Count: ${catMenuRes.data?.data?.length}`);
    }

    // GET /api/menu/:id
    if (sampleMenuItemId) {
      const singleItemRes = await request(`/api/menu/${sampleMenuItemId}`);
      recordResult('Menu', 'Get Single Menu Item', 'GET', `/api/menu/${sampleMenuItemId}`, singleItemRes.status, singleItemRes.data?.success && singleItemRes.data?.data?._id === sampleMenuItemId, singleItemRes.data?.data?.name);
    }

    // POST /api/menu (Create item)
    const testItemName = `Test Item ${Date.now()}`;
    const createItemRes = await request('/api/menu', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: testItemName,
        category: sampleCategoryId,
        price: 45,
        description: 'Automated test item',
        emoji: '🍕',
        available: true,
      },
    });
    const createdItemId = createItemRes.data?.data?._id;
    recordResult('Menu', 'Create Menu Item', 'POST', '/api/menu', createItemRes.status, createItemRes.data?.success, createItemRes.data?.message);

    // PATCH /api/menu/:id/availability
    if (createdItemId) {
      const toggleRes = await request(`/api/menu/${createdItemId}/availability`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      recordResult('Menu', 'Toggle Item Availability', 'PATCH', `/api/menu/:id/availability`, toggleRes.status, toggleRes.data?.success, toggleRes.data?.message);

      // PUT /api/menu/:id
      const updateItemRes = await request(`/api/menu/${createdItemId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { price: 50, description: 'Updated test description' },
      });
      recordResult('Menu', 'Update Menu Item', 'PUT', `/api/menu/:id`, updateItemRes.status, updateItemRes.data?.success, updateItemRes.data?.message);

      // DELETE /api/menu/:id
      const delItemRes = await request(`/api/menu/${createdItemId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      recordResult('Menu', 'Delete Menu Item', 'DELETE', `/api/menu/:id`, delItemRes.status, delItemRes.data?.success, delItemRes.data?.message);
    }
  } catch (e) {
    recordResult('Menu', 'Menu Suite', 'ERROR', '/api/menu', 500, false, e.message);
  }

  // 4. COUPONS APIS
  try {
    // GET /api/coupons (Admin)
    const couponsRes = await request('/api/coupons', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    recordResult('Coupons', 'Get All Coupons', 'GET', '/api/coupons', couponsRes.status, couponsRes.data?.success, `Count: ${couponsRes.data?.data?.length}`);
    if (couponsRes.data?.data?.length > 0) {
      sampleCouponId = couponsRes.data.data[0]._id;
    }

    // POST /api/coupons/validate (Public / Unauthenticated cart checkout test)
    const valRes = await request('/api/coupons/validate', {
      method: 'POST',
      body: { code: 'DRS10', subtotal: 60 },
    });
    recordResult('Coupons', 'Validate Coupon (DRS10)', 'POST', '/api/coupons/validate', valRes.status, valRes.data?.success && valRes.data?.data?.discountAmount === 10, valRes.data?.message);

    // POST /api/coupons (Admin create coupon)
    const testCode = `TEST${Math.floor(Math.random() * 1000)}`;
    const createCpnRes = await request('/api/coupons', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        code: testCode,
        discountType: 'flat',
        discountValue: 15,
        minimumOrder: 50,
        expiryDate: new Date(Date.now() + 86400000).toISOString(),
        active: true,
      },
    });
    const createdCpnId = createCpnRes.data?.data?._id;
    recordResult('Coupons', 'Create Coupon', 'POST', '/api/coupons', createCpnRes.status, createCpnRes.data?.success, createCpnRes.data?.message);

    // PUT /api/coupons/:id
    if (createdCpnId) {
      const updateCpnRes = await request(`/api/coupons/${createdCpnId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { discountValue: 20 },
      });
      recordResult('Coupons', 'Update Coupon', 'PUT', '/api/coupons/:id', updateCpnRes.status, updateCpnRes.data?.success, updateCpnRes.data?.message);

      // DELETE /api/coupons/:id
      const delCpnRes = await request(`/api/coupons/${createdCpnId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      recordResult('Coupons', 'Delete Coupon', 'DELETE', '/api/coupons/:id', delCpnRes.status, delCpnRes.data?.success, delCpnRes.data?.message);
    }
  } catch (e) {
    recordResult('Coupons', 'Coupons Suite', 'ERROR', '/api/coupons', 500, false, e.message);
  }

  // 5. ORDERS APIS
  try {
    // POST /api/orders (Create Order)
    const orderPayload = {
      items: [
        {
          menuItem: sampleMenuItemId,
          name: 'Test Meals',
          quantity: 1,
        },
      ],
      couponCode: 'DRS10',
      paymentMethod: 'cod',
    };

    const createOrderRes = await request('/api/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: orderPayload,
    });
    recordResult('Orders', 'Create Order', 'POST', '/api/orders', createOrderRes.status, createOrderRes.data?.success, createOrderRes.data?.message);
    if (createOrderRes.data?.data) {
      sampleOrderCode = createOrderRes.data.data.orderCode;
      sampleOrderId = createOrderRes.data.data._id;
    }

    // GET /api/orders/my (Student history)
    const myOrdersRes = await request('/api/orders/my', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    recordResult('Orders', 'Get Student Orders', 'GET', '/api/orders/my', myOrdersRes.status, myOrdersRes.data?.success && Array.isArray(myOrdersRes.data?.data), `Count: ${myOrdersRes.data?.data?.length}`);

    // GET /api/orders/:id (using orderCode)
    if (sampleOrderCode) {
      const getByCodeRes = await request(`/api/orders/${sampleOrderCode}`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      recordResult('Orders', 'Get Order by Code', 'GET', `/api/orders/${sampleOrderCode}`, getByCodeRes.status, getByCodeRes.data?.success && getByCodeRes.data?.data?.orderCode === sampleOrderCode, `Status: ${getByCodeRes.data?.data?.status}`);
    }

    // GET /api/orders/:id (using Mongo _id)
    if (sampleOrderId) {
      const getByIdRes = await request(`/api/orders/${sampleOrderId}`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      recordResult('Orders', 'Get Order by Mongo ID', 'GET', `/api/orders/${sampleOrderId}`, getByIdRes.status, getByIdRes.data?.success && getByIdRes.data?.data?._id === sampleOrderId, `Status: ${getByIdRes.data?.data?.status}`);
    }

    // GET /api/orders/active (Admin active orders)
    const activeOrdersRes = await request('/api/orders/active', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    recordResult('Orders', 'Get Active Orders', 'GET', '/api/orders/active', activeOrdersRes.status, activeOrdersRes.data?.success && Array.isArray(activeOrdersRes.data?.data), `Count: ${activeOrdersRes.data?.data?.length}`);

    // GET /api/orders (Admin all orders)
    const allOrdersRes = await request('/api/orders', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    recordResult('Orders', 'Get All Orders (Admin)', 'GET', '/api/orders', allOrdersRes.status, allOrdersRes.data?.success && Array.isArray(allOrdersRes.data?.data), `Total: ${allOrdersRes.data?.pagination?.total}`);

    // PATCH /api/orders/:id/status (Admin change status)
    if (sampleOrderCode) {
      const statusRes = await request(`/api/orders/${sampleOrderCode}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: { status: 'Preparing' },
      });
      recordResult('Orders', 'Update Order Status', 'PATCH', '/api/orders/:id/status', statusRes.status, statusRes.data?.success, statusRes.data?.message);
    }

    // PATCH /api/orders/:id/cancel
    if (sampleOrderCode) {
      const cancelRes = await request(`/api/orders/${sampleOrderCode}/cancel`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      recordResult('Orders', 'Cancel Order', 'PATCH', '/api/orders/:id/cancel', cancelRes.status, cancelRes.data?.success, cancelRes.data?.message);
    }
  } catch (e) {
    recordResult('Orders', 'Orders Suite', 'ERROR', '/api/orders', 500, false, e.message);
  }

  // 6. PAYMENTS APIS
  try {
    // POST /api/payments/create-order
    const rpRes = await request('/api/payments/create-order', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: { amount: 100, receipt: 'receipt_test_123' },
    });
    recordResult('Payments', 'Create Razorpay Order', 'POST', '/api/payments/create-order', rpRes.status, rpRes.data?.success && !!rpRes.data?.data?.id, `ID: ${rpRes.data?.data?.id}`);

    // POST /api/payments/verify
    if (sampleOrderCode) {
      const verifyRes = await request('/api/payments/verify', {
        method: 'POST',
        headers: { Authorization: `Bearer ${userToken}` },
        body: {
          razorpay_order_id: rpRes.data?.data?.id || 'order_mock_test',
          razorpay_payment_id: 'pay_mock_12345',
          razorpay_signature: 'signature_mock',
          orderCode: sampleOrderCode,
        },
      });
      recordResult('Payments', 'Verify Payment Signature', 'POST', '/api/payments/verify', verifyRes.status, verifyRes.data?.success, verifyRes.data?.message);
    }

    // GET /api/payments/admin/list
    const payListRes = await request('/api/payments/admin/list', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    recordResult('Payments', 'Get Admin Payment Logs', 'GET', '/api/payments/admin/list', payListRes.status, payListRes.data?.success && Array.isArray(payListRes.data?.data), `Count: ${payListRes.data?.data?.length}`);
  } catch (e) {
    recordResult('Payments', 'Payments Suite', 'ERROR', '/api/payments', 500, false, e.message);
  }

  // 7. ANALYTICS APIS
  try {
    // GET /api/analytics/overview
    const overRes = await request('/api/analytics/overview', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    recordResult('Analytics', 'Get Overview Stats', 'GET', '/api/analytics/overview', overRes.status, overRes.data?.success && typeof overRes.data?.data?.totalRevenue === 'number', `Revenue: ₹${overRes.data?.data?.totalRevenue}`);

    // GET /api/analytics/revenue
    const revRes = await request('/api/analytics/revenue', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    recordResult('Analytics', 'Get Revenue Trends', 'GET', '/api/analytics/revenue', revRes.status, revRes.data?.success && Array.isArray(revRes.data?.data), `Trend days: ${revRes.data?.data?.length}`);

    // GET /api/analytics/popular-items
    const popRes = await request('/api/analytics/popular-items', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    recordResult('Analytics', 'Get Popular Items', 'GET', '/api/analytics/popular-items', popRes.status, popRes.data?.success && Array.isArray(popRes.data?.data), `Items count: ${popRes.data?.data?.length}`);

    // GET /api/analytics/payments
    const payRes = await request('/api/analytics/payments', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    recordResult('Analytics', 'Get Payment Stats', 'GET', '/api/analytics/payments', payRes.status, payRes.data?.success && Array.isArray(payRes.data?.data), `Methods count: ${payRes.data?.data?.length}`);

    // GET /api/analytics/payment-methods (Alias)
    const payAliasRes = await request('/api/analytics/payment-methods', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    recordResult('Analytics', 'Get Payment Methods Alias', 'GET', '/api/analytics/payment-methods', payAliasRes.status, payAliasRes.data?.success && Array.isArray(payAliasRes.data?.data), `Methods count: ${payAliasRes.data?.data?.length}`);
  } catch (e) {
    recordResult('Analytics', 'Analytics Suite', 'ERROR', '/api/analytics', 500, false, e.message);
  }

  // 8. NOTIFICATIONS APIS
  try {
    // GET /api/notifications
    const notifRes = await request('/api/notifications', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    recordResult('Notifications', 'Get Notifications History', 'GET', '/api/notifications', notifRes.status, notifRes.data?.success && Array.isArray(notifRes.data?.data), `Count: ${notifRes.data?.data?.length}`);
    if (notifRes.data?.data?.length > 0) {
      sampleNotificationId = notifRes.data.data[0]._id;
    }

    // GET /api/notifications/unread
    const unreadRes = await request('/api/notifications/unread', {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    recordResult('Notifications', 'Get Unread Count', 'GET', '/api/notifications/unread', unreadRes.status, unreadRes.data?.success && typeof unreadRes.data?.unreadCount === 'number', `Unread: ${unreadRes.data?.unreadCount}`);

    // PATCH /api/notifications/:id/read
    if (sampleNotificationId) {
      const readOneRes = await request(`/api/notifications/${sampleNotificationId}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${userToken}` },
      });
      recordResult('Notifications', 'Mark Single Notification Read', 'PATCH', '/api/notifications/:id/read', readOneRes.status, readOneRes.data?.success, readOneRes.data?.message);
    }

    // PATCH /api/notifications/read-all
    const readAllRes = await request('/api/notifications/read-all', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userToken}` },
    });
    recordResult('Notifications', 'Mark All Notifications Read', 'PATCH', '/api/notifications/read-all', readAllRes.status, readAllRes.data?.success, readAllRes.data?.message);

    // DELETE /api/notifications/:id
    if (sampleNotificationId) {
      const delNotifRes = await request(`/api/notifications/${sampleNotificationId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${userToken}` },
      });
      recordResult('Notifications', 'Delete Notification', 'DELETE', '/api/notifications/:id', delNotifRes.status, delNotifRes.data?.success, delNotifRes.data?.message);
    }
  } catch (e) {
    recordResult('Notifications', 'Notifications Suite', 'ERROR', '/api/notifications', 500, false, e.message);
  }

  // SUMMARY REPORT
  console.log('\n====================================================');
  console.log('                 API AUDIT SUMMARY                  ');
  console.log('====================================================');
  const total = results.length;
  const passed = results.filter((r) => r.pass).length;
  const failed = total - passed;

  console.log(`Total APIs Tested : ${total}`);
  console.log(`Passed APIs       : ${passed} (✅)`);
  console.log(`Failed APIs       : ${failed} (❌)\n`);

  if (failed > 0) {
    console.log('Failed Endpoints:');
    results.filter((r) => !r.pass).forEach((r) => {
      console.log(`  - [${r.group}] ${r.method} ${r.endpoint} -> Status ${r.status}: ${r.details}`);
    });
  } else {
    console.log('🎉 ALL APIs ARE OPERATIONAL AND FETCHING DATA PERFECTLY!');
  }
  console.log('====================================================\n');

  // Shutdown test server and close DB
  server.close();
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
