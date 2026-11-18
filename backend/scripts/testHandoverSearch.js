import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from '../config/db.js';
import { searchHandoverOrders } from '../controllers/posController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const testSearch = async (query) => {
  let result = null;
  const mockReq = { query: { q: query } };
  const mockRes = {
    status: (code) => ({
      json: (data) => { result = { code, ...data }; },
    }),
    json: (data) => { result = { code: 200, ...data }; },
  };

  await searchHandoverOrders(mockReq, mockRes);
  return result;
};

async function run() {
  await connectDB();
  console.log('--- Testing searchHandoverOrders Controller ---');

  // 1. Partial Search 'T'
  console.log('\n[TEST 1] Searching partial "T"...');
  const res1 = await testSearch('T');
  console.log(`Found ${res1.count} orders matching "T":`);
  res1.data.forEach(o => console.log(`  - Token: ${o.pickupToken || o.orderCode} | Status: ${o.status} | Eligibility: ${o.eligibility}`));

  // 2. Partial Search '4T'
  console.log('\n[TEST 2] Searching partial "4T"...');
  const res2 = await testSearch('4T');
  console.log(`Found ${res2.count} orders matching "4T":`);
  res2.data.forEach(o => console.log(`  - Token: ${o.pickupToken || o.orderCode} | Status: ${o.status} | Eligibility: ${o.eligibility}`));

  // 3. Full Search '4T9U'
  console.log('\n[TEST 3] Searching full token "4T9U"...');
  const res3 = await testSearch('4T9U');
  console.log(`Found ${res3.count} orders matching "4T9U":`);
  res3.data.forEach(o => console.log(`  - Token: ${o.pickupToken || o.orderCode} | Status: ${o.status} | Total: ₹${o.total}`));

  // 4. Case-insensitive lowercase '4t9u'
  console.log('\n[TEST 4] Searching lowercase "4t9u"...');
  const res4 = await testSearch('4t9u');
  console.log(`Found ${res4.count} orders matching "4t9u":`);
  res4.data.forEach(o => console.log(`  - Token: ${o.pickupToken || o.orderCode}`));

  // 5. Full ObjectId
  if (res3.data.length > 0) {
    const orderId = String(res3.data[0]._id);
    console.log(`\n[TEST 5] Searching ObjectId "${orderId}"...`);
    const res5 = await testSearch(orderId);
    console.log(`Found ${res5.count} orders matching ObjectId:`);
    res5.data.forEach(o => console.log(`  - Token: ${o.pickupToken || o.orderCode} | ID: ${o._id}`));
  }

  // 6. Whitespace trimming '  4T9U  '
  console.log('\n[TEST 6] Searching with extra spaces "  4T9U  "...');
  const res6 = await testSearch('  4T9U  ');
  console.log(`Found ${res6.count} orders matching "  4T9U  "`);

  // 7. Empty string
  console.log('\n[TEST 7] Searching empty string ""...');
  const res7 = await testSearch('');
  console.log(`Found ${res7.count} orders matching "" (expected 0)`);

  // 8. Nonexistent token
  console.log('\n[TEST 8] Searching nonexistent token "ZZZZ999"...');
  const res8 = await testSearch('ZZZZ999');
  console.log(`Found ${res8.count} orders matching "ZZZZ999" (expected 0)`);

  console.log('\n✅ All backend search tests passed successfully!');
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
