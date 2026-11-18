import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from '../config/db.js';
import Order from '../models/Order.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function run() {
  await connectDB();
  console.log('Testing analytics aggregations...');

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const istTodayStart = new Date(`${todayStr}T00:00:00.000+05:30`);
  const istTodayEnd = new Date(`${todayStr}T23:59:59.999+05:30`);

  console.log('1a. stats');
  const stats = await Order.aggregate([
    { $match: { status: { $ne: 'Cancelled' } } },
    { $group: { _id: null, totalRevenue: { $sum: '$total' } } },
  ]);
  console.log('Stats:', stats);

  console.log('1b. statusCounts');
  const statusCounts = await Order.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  console.log('Status counts:', statusCounts);

  console.log('1c. todayStats');
  const todayStats = await Order.aggregate([
    {
      $match: {
        status: { $in: ['Handover Bill', 'Completed'] },
        $or: [
          { completedAt: { $gte: istTodayStart, $lte: istTodayEnd } },
          { completedAt: null, createdAt: { $gte: istTodayStart, $lte: istTodayEnd } },
        ],
      },
    },
    {
      $group: {
        _id: null,
        todayRevenue: { $sum: '$total' },
        todayOrders: { $sum: 1 },
      },
    },
  ]);
  console.log('Today stats:', todayStats);

  console.log('2. Revenue trends');
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const revenueByDay = await Order.aggregate([
    { $match: { createdAt: { $gte: sevenDaysAgo }, status: { $ne: 'Cancelled' } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        revenue: { $sum: '$total' },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  console.log('Revenue by day:', revenueByDay);

  console.log('3. Popular items');
  const popularItems = await Order.aggregate([
    { $match: { status: { $ne: 'Cancelled' } } },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.name',
        quantity: { $sum: '$items.quantity' },
        revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
      },
    },
    { $sort: { quantity: -1 } },
    { $limit: 5 },
  ]);
  console.log('Popular items:', popularItems);

  console.log('4. Payment methods');
  const paymentMethods = await Order.aggregate([
    { $match: { status: { $ne: 'Cancelled' } } },
    {
      $group: {
        _id: '$paymentMethod',
        count: { $sum: 1 },
        revenue: { $sum: '$total' },
      },
    },
  ]);
  console.log('Payment methods:', paymentMethods);

  // Check item data integrity
  console.log('5. Item data integrity');
  const allOrders = await Order.find({ status: { $ne: 'Cancelled' } }).select('items total').lean();
  let invalidPrices = 0;
  for (const o of allOrders) {
    for (const it of (o.items || [])) {
      if (typeof it.price !== 'number' || typeof it.quantity !== 'number') {
        console.log('Invalid item:', it, 'in order:', o._id);
        invalidPrices++;
      }
    }
  }
  console.log('Total checked items with invalid price/qty:', invalidPrices);

  console.log('\nAll aggregations succeeded!');
  process.exit(0);
}

run().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
