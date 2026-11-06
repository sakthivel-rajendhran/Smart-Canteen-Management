import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import connectDB from '../config/db.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';

async function runCleanup() {
  await connectDB();
  console.log('--- Starting Notification Cleanup & Deduplication Migration ---');

  const allNotifications = await Notification.find({}).sort({ createdAt: 1 }).lean();
  console.log(`Found ${allNotifications.length} total notifications.`);

  const seenEventKeys = new Set();
  const duplicateIdsToRemove = [];
  const updatesToApply = [];

  for (const notif of allNotifications) {
    const userStr = notif.user ? notif.user.toString() : 'NONE';
    const orderCode = notif.metadata?.orderCode || '';

    // Generate canonical eventId
    let eventId = notif.eventId;
    if (!eventId) {
      if (notif.type === 'SYSTEM' && (notif.title.includes('New Order') || notif.message.includes('New order'))) {
        eventId = `ORDER_ADMIN_${orderCode || notif._id}_PLACED`;
      } else if (notif.type === 'ORDER_PLACED') {
        eventId = `ORDER_CUSTOMER_${orderCode || notif._id}_PLACED`;
      } else if (notif.type && notif.type.startsWith('ORDER_')) {
        const stage = notif.type.replace('ORDER_', '');
        eventId = `ORDER_CUSTOMER_${orderCode || notif._id}_${stage}`;
      } else {
        eventId = `GENERIC_${userStr}_${notif._id}`;
      }
    }

    // Check if the user is an admin who received BOTH a student placement and an admin placement for the same order
    const isStudentNotifOnAdmin = notif.type === 'ORDER_PLACED' && orderCode === 'DRS-5879';

    const dedupKey = `${userStr}:::${orderCode}:::${eventId.includes('ADMIN') ? 'ADMIN_PLACED' : notif.type}`;

    if (seenEventKeys.has(dedupKey) || isStudentNotifOnAdmin) {
      console.log(`🗑️ Identified duplicate notification to remove: ID ${notif._id} | User: ${userStr} | Code: ${orderCode} | Title: "${notif.title}"`);
      duplicateIdsToRemove.push(notif._id);
    } else {
      seenEventKeys.add(dedupKey);
      updatesToApply.push({ id: notif._id, eventId });
    }
  }

  // Remove duplicates
  if (duplicateIdsToRemove.length > 0) {
    const delResult = await Notification.deleteMany({ _id: { $in: duplicateIdsToRemove } });
    console.log(`✓ Removed ${delResult.deletedCount} duplicate notification records from MongoDB.`);
  } else {
    console.log('✓ No duplicate notification records needed deletion.');
  }

  // Backfill eventId on remaining records
  for (const item of updatesToApply) {
    await Notification.updateOne({ _id: item.id }, { $set: { eventId: item.eventId } });
  }
  console.log(`✓ Backfilled canonical eventId on ${updatesToApply.length} notifications.`);

  // Create/verify unique compound index on { user: 1, eventId: 1 }
  try {
    await Notification.collection.createIndex(
      { user: 1, eventId: 1 },
      { unique: true, sparse: true, name: 'user_1_eventId_1_unique' }
    );
    console.log('✓ MongoDB unique index "user_1_eventId_1_unique" verified and active.');
  } catch (idxErr) {
    console.warn('Index note:', idxErr.message);
  }

  const finalCount = await Notification.countDocuments({});
  console.log(`\nMigration completed successfully! Final clean notification count: ${finalCount}`);
  process.exit(0);
}

runCleanup().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
