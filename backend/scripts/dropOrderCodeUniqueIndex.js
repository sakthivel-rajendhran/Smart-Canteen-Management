import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Order from '../models/Order.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

/**
 * Migration Script: Drop Unique Index on orderCode
 * 
 * 4-character pickup tokens are no longer globally unique; they are only
 * collision-checked against active orders (Placed, Confirmed, Preparing, Ready).
 * This script drops the legacy unique index 'orderCode_1' and ensures the compound
 * index { orderCode: 1, status: 1 } exists.
 */
async function dropOrderCodeUniqueIndex() {
  console.log('====================================================');
  console.log('   MIGRATION: DROP ORDER CODE UNIQUE INDEX          ');
  console.log('====================================================\n');

  try {
    await connectDB();

    console.log('Inspecting existing Order collection indexes...');
    const existingIndexes = await Order.collection.indexes();
    console.log('Existing indexes found:', existingIndexes.length);

    let droppedCount = 0;

    for (const idx of existingIndexes) {
      const isOrderCodeUnique =
        Boolean(idx.unique) &&
        idx.key &&
        idx.key.orderCode === 1 &&
        Object.keys(idx.key).length === 1;

      console.log(`- Index: "${idx.name}", Key: ${JSON.stringify(idx.key)}, Unique: ${Boolean(idx.unique)}`);

      if (isOrderCodeUnique || (idx.name === 'orderCode_1' && idx.unique)) {
        console.log(`  --> Dropping legacy unique index: "${idx.name}"...`);
        await Order.collection.dropIndex(idx.name);
        console.log(`  --> Successfully dropped index: "${idx.name}"`);
        droppedCount++;
      }
    }

    if (droppedCount === 0) {
      console.log('\nNotice: No unique single-field index on orderCode was found (already dropped or not present).');
    } else {
      console.log(`\nSuccessfully dropped ${droppedCount} unique index(es).`);
    }

    console.log('\nCreating compound index { orderCode: 1, status: 1 }...');
    await Order.collection.createIndex({ orderCode: 1, status: 1 });
    console.log('Compound index { orderCode: 1, status: 1 } ensured.');

    console.log('\nUpdated Order collection indexes:');
    const updatedIndexes = await Order.collection.indexes();
    for (const idx of updatedIndexes) {
      console.log(`- "${idx.name}": ${JSON.stringify(idx.key)} ${idx.unique ? '(UNIQUE)' : ''}`);
    }

    console.log('\n====================================================');
    console.log('   INDEX MIGRATION COMPLETED SUCCESSFULLY           ');
    console.log('====================================================');
  } catch (err) {
    console.error('Migration failed with error:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

dropOrderCodeUniqueIndex();
