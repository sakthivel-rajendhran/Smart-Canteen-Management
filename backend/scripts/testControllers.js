import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from '../config/db.js';
import {
  getAnalyticsOverview,
  getRevenueTrends,
  getPopularItems,
  getPaymentMethodStats,
} from '../controllers/analyticsController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const mockReq = {};
const mockRes = (label) => ({
  status: (code) => ({
    json: (data) => console.log(`[${label}] Status ${code}:`, JSON.stringify(data, null, 2)),
  }),
  json: (data) => console.log(`[${label}] 200 OK:`, JSON.stringify(data, null, 2)),
});

async function testControllers() {
  await connectDB();
  console.log('\n--- Testing Controller Output ---');
  await getAnalyticsOverview(mockReq, mockRes('Overview'));
  await getRevenueTrends(mockReq, mockRes('RevenueTrends'));
  await getPopularItems(mockReq, mockRes('PopularItems'));
  await getPaymentMethodStats(mockReq, mockRes('PaymentStats'));
  process.exit(0);
}

testControllers().catch(e => {
  console.error(e);
  process.exit(1);
});
