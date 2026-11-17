import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Order from '../models/Order.js';
import MenuItem from '../models/MenuItem.js';

import Category from '../models/Category.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function run() {
  await connectDB();
  const orderCountTotal = await Order.countDocuments();
  const orderCountNotCancelled = await Order.countDocuments({ status: { $ne: 'Cancelled' } });
  const orderStatusCounts = await Order.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
  console.log('Total orders:', orderCountTotal);
  console.log('Non-cancelled orders:', orderCountNotCancelled);
  console.log('Status counts:', orderStatusCounts);

  const menuCountAll = await MenuItem.countDocuments();
  const menuCountAvailable = await MenuItem.countDocuments({ available: true });
  const menuCountAvailableParent = await MenuItem.countDocuments({ 
    available: true, 
    $or: [{ variantParent: null }, { variantParent: { $exists: false } }] 
  });
  console.log('Total menu items:', menuCountAll);
  console.log('Available menu items (all):', menuCountAvailable);
  console.log('Available parent menu items:', menuCountAvailableParent);

  const prepAgg = await MenuItem.aggregate([
    { $match: { available: true, $or: [{ variantParent: null }, { variantParent: { $exists: false } }] } },
    { $group: { _id: null, avgTime: { $avg: '$preparationTime' } } }
  ]);
  console.log('Avg prep time agg:', prepAgg);

  const categoriesCount = await Category.countDocuments();
  console.log('Categories count:', categoriesCount);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
