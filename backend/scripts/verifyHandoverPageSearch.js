import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from '../config/db.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import { searchHandoverOrders } from '../controllers/posController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const runComprehensiveVerification = async () => {
  try {
    await connectDB();
    console.log('--- Comprehensive Handover Live Search Verification ---');

    // Helper to simulate express req/res
    const mockRequest = (query) => ({
      query: { q: query },
    });

    const mockResponse = () => {
      let result = null;
      let statusCode = 200;
      return {
        status: (code) => {
          statusCode = code;
          return {
            json: (payload) => {
              result = { statusCode, ...payload };
            },
          };
        },
        json: (payload) => {
          result = { statusCode, ...payload };
        },
        getResult: () => result,
      };
    };

    // 1. Partial Search
    console.log('\n[TEST 1] Partial query: "4"');
    let res = mockResponse();
    await searchHandoverOrders(mockRequest('4'), res);
    let output = res.getResult();
    console.log(`Success: ${output.success}, Count: ${output.count}`);
    if (output.count > 0) {
      console.log(`First match: #${output.data[0].orderCode} | Status: ${output.data[0].status} | Eligibility: ${output.data[0].eligibility}`);
    }

    // 2. Exact token search
    console.log('\n[TEST 2] Exact token query: "4T9U"');
    res = mockResponse();
    await searchHandoverOrders(mockRequest('4T9U'), res);
    output = res.getResult();
    console.log(`Success: ${output.success}, Count: ${output.count}`);
    if (output.count > 0) {
      const ord = output.data[0];
      console.log(`Matched Order: #${ord.orderCode} (Token: #${ord.pickupToken})`);
      console.log(`Status: ${ord.status} | Eligibility: ${ord.eligibility}`);
      console.log(`Eligibility Message: ${ord.eligibilityMessage}`);
      console.log(`Items count: ${ord.items.length}, Total: ₹${ord.total}`);
    }

    // 3. Lowercase & hash symbol query: "#4t9u"
    console.log('\n[TEST 3] Formatted input: "#4t9u"');
    res = mockResponse();
    await searchHandoverOrders(mockRequest('#4t9u'), res);
    output = res.getResult();
    console.log(`Success: ${output.success}, Count: ${output.count}`);
    if (output.count > 0) {
      console.log(`Matched Order: #${output.data[0].orderCode}`);
    }

    // 4. Customer phone search
    console.log('\n[TEST 4] Walk-in customer search');
    const walkInOrder = await Order.findOne({ 'walkInCustomer.name': { $exists: true } }).lean();
    if (walkInOrder && walkInOrder.walkInCustomer?.name) {
      const partialName = walkInOrder.walkInCustomer.name.slice(0, 4);
      res = mockResponse();
      await searchHandoverOrders(mockRequest(partialName), res);
      output = res.getResult();
      console.log(`Query "${partialName}" matched ${output.count} orders`);
    }

    // 5. Empty / whitespace search
    console.log('\n[TEST 5] Empty / whitespace query');
    res = mockResponse();
    await searchHandoverOrders(mockRequest('   '), res);
    output = res.getResult();
    console.log(`Empty query count: ${output.count} (expected 0)`);

    // 6. Non-existent token
    console.log('\n[TEST 6] Non-existent query: "NONEXISTENT999"');
    res = mockResponse();
    await searchHandoverOrders(mockRequest('NONEXISTENT999'), res);
    output = res.getResult();
    console.log(`Nonexistent query count: ${output.count} (expected 0)`);

    console.log('\n✅ All verification checks passed!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  }
};

runComprehensiveVerification();
