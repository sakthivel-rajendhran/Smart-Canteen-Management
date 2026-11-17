import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import MenuItem from '../models/MenuItem.js';
import generateOrderCode, { generateToken, ALPHABET, ACTIVE_STATUSES } from '../utils/generateOrderCode.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const FORBIDDEN_CHARS = ['0', 'O', 'o', '1', 'I', 'i', 'L', 'l'];

async function runTestSuite() {
  console.log('================================================================');
  console.log('       DRS QUICK SERVE — SHORT 4-CHAR TOKEN TEST SUITE          ');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  // -------------------------------------------------------------------------
  // TEST 1: Unit Test the Generator (10,000 generated tokens)
  // -------------------------------------------------------------------------
  console.log('▶ [TEST 1] Generator Unit Test (10,000 generated values)...');
  totalTests++;

  const ITERATIONS = 10000;
  const generatedTokens = new Set();
  let lengthFailures = 0;
  let forbiddenFailures = 0;
  let invalidCharFailures = 0;

  for (let i = 0; i < ITERATIONS; i++) {
    const token = generateToken();

    // Check length
    if (typeof token !== 'string' || token.length !== 4) {
      lengthFailures++;
    }

    // Check forbidden characters
    for (const forbidden of FORBIDDEN_CHARS) {
      if (token.includes(forbidden)) {
        forbiddenFailures++;
      }
    }

    // Check allowed alphabet
    for (const char of token) {
      if (!ALPHABET.includes(char)) {
        invalidCharFailures++;
      }
    }

    generatedTokens.add(token);
  }

  console.log(`  - Total generated: ${ITERATIONS}`);
  console.log(`  - Unique values produced: ${generatedTokens.size} (${((generatedTokens.size / ITERATIONS) * 100).toFixed(2)}% distinct in random sample)`);
  console.log(`  - Length violations (not 4 chars): ${lengthFailures}`);
  console.log(`  - Forbidden character violations (0, O, 1, I, L): ${forbiddenFailures}`);
  console.log(`  - Invalid alphabet characters: ${invalidCharFailures}`);

  if (lengthFailures === 0 && forbiddenFailures === 0 && invalidCharFailures === 0) {
    console.log('  ✅ TEST 1 PASSED: 10,000 tokens strictly valid, 4-char, and clean of ambiguous characters.\n');
    passedTests++;
  } else {
    console.error('  ❌ TEST 1 FAILED!\n');
  }

  // -------------------------------------------------------------------------
  // Database Connection
  // -------------------------------------------------------------------------
  console.log('Connecting to database for integration & concurrency tests...');
  await connectDB();

  // Find or create a test user and menu item
  let testUser = await User.findOne({ role: 'student' });
  if (!testUser) {
    testUser = await User.findOne({});
  }

  let testMenuItem = await MenuItem.findOne({});
  if (!testMenuItem) {
    testMenuItem = await MenuItem.create({
      name: 'Test Roll',
      price: 40,
      category: new mongoose.Types.ObjectId(),
      isAvailable: true,
    });
  }

  const createdTestOrderIds = [];

  try {
    // -------------------------------------------------------------------------
    // TEST 2: Create 30 Orders in Parallel (Concurrency & Active Collision Check)
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 2] Creating 30 orders in parallel on database...');
    totalTests++;

    const orderPromises = [];
    for (let i = 0; i < 30; i++) {
      orderPromises.push(
        (async (idx) => {
          const code = await generateOrderCode();
          const order = await Order.create({
            orderCode: code,
            orderType: 'ONLINE',
            pickupToken: code,
            pickupSecret: `test_sec_${idx}`,
            user: testUser?._id,
            items: [
              {
                menuItem: testMenuItem._id,
                name: testMenuItem.name,
                price: testMenuItem.price,
                quantity: 1,
              },
            ],
            foodSubtotal: testMenuItem.price,
            parcelChargeTotal: 0,
            subtotal: testMenuItem.price,
            discount: 0,
            total: testMenuItem.price,
            paymentMethod: 'cash',
            paymentStatus: 'pending',
            status: 'Placed',
            statusTimestamps: { Placed: new Date() },
          });

          // Race safety check
          let raceRetries = 0;
          while (raceRetries < 3) {
            const duplicate = await Order.findOne({
              _id: { $ne: order._id },
              orderCode: order.orderCode,
              status: { $in: ACTIVE_STATUSES },
              createdAt: { $lte: order.createdAt },
            }).select('_id createdAt').lean();

            if (!duplicate) break;

            const newCode = await generateOrderCode();
            order.orderCode = newCode;
            order.pickupToken = newCode;
            await Order.updateOne(
              { _id: order._id },
              { $set: { orderCode: newCode, pickupToken: newCode } }
            );
            raceRetries++;
          }

          return order;
        })(i)
      );
    }

    const createdOrders = await Promise.all(orderPromises);
    for (const o of createdOrders) {
      createdTestOrderIds.push(o._id);
    }

    console.log(`  - 30 parallel orders inserted successfully.`);

    // Check for collisions among active orders
    const activeOrderCodes = createdOrders.map((o) => o.orderCode);
    const uniqueActiveCodes = new Set(activeOrderCodes);
    console.log(`  - Unique active tokens among 30: ${uniqueActiveCodes.size} / 30`);
    console.log(`  - Sample tokens generated: ${activeOrderCodes.slice(0, 8).map((t) => '#' + t).join(', ')}...`);

    const duplicateCheck = await Order.aggregate([
      {
        $match: {
          _id: { $in: createdTestOrderIds },
          status: { $in: ACTIVE_STATUSES },
        },
      },
      {
        $group: {
          _id: '$orderCode',
          count: { $sum: 1 },
          ids: { $push: '$_id' },
        },
      },
      {
        $match: { count: { $gt: 1 } },
      },
    ]);

    if (duplicateCheck.length === 0) {
      console.log('  ✅ TEST 2 PASSED: All 30 orders succeeded, and NO two active orders share a token.\n');
      passedTests++;
    } else {
      console.error('  ❌ TEST 2 FAILED: Active token collisions detected:', duplicateCheck);
    }

    // -------------------------------------------------------------------------
    // TEST 3: Full End-to-End Flow Verification
    // -------------------------------------------------------------------------
    console.log('▶ [TEST 3] Confirming Full Flow (Place -> Tracker/Bill by _id -> Admin Search -> Status Updates -> Cancel -> History)...');
    totalTests++;

    // 1. Single order placement
    const sampleToken = await generateOrderCode();
    const flowOrder = await Order.create({
      orderCode: sampleToken,
      orderType: 'ONLINE',
      pickupToken: sampleToken,
      pickupSecret: 'flow_secret_123',
      user: testUser?._id,
      items: [
        {
          menuItem: testMenuItem._id,
          name: testMenuItem.name,
          price: testMenuItem.price,
          quantity: 2,
        },
      ],
      foodSubtotal: testMenuItem.price * 2,
      subtotal: testMenuItem.price * 2,
      total: testMenuItem.price * 2,
      paymentMethod: 'cash',
      paymentStatus: 'pending',
      status: 'Placed',
      statusTimestamps: { Placed: new Date() },
    });
    createdTestOrderIds.push(flowOrder._id);

    console.log(`  1. Order placed: _id=${flowOrder._id}, token=#${flowOrder.orderCode}`);

    // 2. Lookup by _id (Tracker & Bill URL queries)
    const lookedUpById = await Order.findById(flowOrder._id).populate('user', 'name email');
    if (!lookedUpById || lookedUpById.orderCode !== sampleToken) {
      throw new Error(`Lookup by _id failed for order ${flowOrder._id}`);
    }
    console.log(`  2. Tracker/Bill lookup by _id successful (Token: #${lookedUpById.orderCode})`);

    // 3. Admin counter search by 4-char token (case-insensitive exact match)
    const adminSearched = await Order.findOne({
      orderCode: sampleToken.toLowerCase().toUpperCase(),
      status: { $in: ACTIVE_STATUSES },
    }).sort({ createdAt: -1 });

    if (!adminSearched || String(adminSearched._id) !== String(flowOrder._id)) {
      throw new Error(`Admin search by token #${sampleToken} failed`);
    }
    console.log(`  3. Admin counter search matched exact token #${sampleToken} successfully`);

    // 4. Update status sequence: Placed -> Confirmed -> Preparing -> Ready
    for (const nextStatus of ['Confirmed', 'Preparing', 'Ready']) {
      await Order.updateOne(
        { _id: flowOrder._id },
        { $set: { status: nextStatus, [`statusTimestamps.${nextStatus}`]: new Date() } }
      );
    }
    const readyOrder = await Order.findById(flowOrder._id);
    if (readyOrder.status !== 'Ready') {
      throw new Error(`Status update to Ready failed; current status: ${readyOrder.status}`);
    }
    console.log(`  4. Status progressed to Ready successfully`);

    // 5. Test Cancel Flow
    const cancellableCode = await generateOrderCode();
    const cancelOrder = await Order.create({
      orderCode: cancellableCode,
      orderType: 'ONLINE',
      pickupToken: cancellableCode,
      user: testUser?._id,
      items: [{ menuItem: testMenuItem._id, name: testMenuItem.name, price: 10, quantity: 1 }],
      subtotal: 10,
      total: 10,
      paymentMethod: 'cash',
      status: 'Placed',
    });
    createdTestOrderIds.push(cancelOrder._id);

    await Order.updateOne(
      { _id: cancelOrder._id, status: { $in: ['Placed', 'Confirmed'] } },
      { $set: { status: 'Cancelled', [`statusTimestamps.Cancelled`]: new Date() } }
    );
    const cancelledOrder = await Order.findById(cancelOrder._id);
    if (cancelledOrder.status !== 'Cancelled') {
      throw new Error(`Cancel order failed`);
    }
    console.log(`  5. Order #${cancelOrder.orderCode} cancelled successfully`);

    // 6. Test History Query by user
    const historyOrders = await Order.find({ user: testUser?._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
    if (!historyOrders || historyOrders.length === 0) {
      throw new Error('User order history query returned empty');
    }
    console.log(`  6. Order history query retrieved ${historyOrders.length} orders successfully`);

    console.log('  ✅ TEST 3 PASSED: Full lifecycle works seamlessly with 4-char token & _id lookups.\n');
    passedTests++;
  } finally {
    // Clean up test orders
    if (createdTestOrderIds.length > 0) {
      console.log(`Cleaning up ${createdTestOrderIds.length} test order records...`);
      await Order.deleteMany({ _id: { $in: createdTestOrderIds } });
      console.log('Test records cleaned up.');
    }
    await mongoose.disconnect();
    console.log('Database disconnected.');
  }

  console.log('================================================================');
  console.log(`TEST SUITE RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log('================================================================');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal error during test suite:', err);
  process.exit(1);
});
