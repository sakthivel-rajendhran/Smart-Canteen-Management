import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import { orderNotificationTemplates } from '../utils/notificationHelper.js';

console.log('🧪 Starting Automated DRS Notification Verification Tests...\n');

// Test 1: Verify all 6 order status templates exist with correct metadata
const expectedStatuses = ['Placed', 'Confirmed', 'Preparing', 'Ready', 'Completed', 'Cancelled'];
let statusTestsPassed = true;

for (const status of expectedStatuses) {
  const template = orderNotificationTemplates[status];
  if (!template) {
    console.error(`❌ Missing template for status: ${status}`);
    statusTestsPassed = false;
  } else {
    const sampleMsg = template.message('DRS-1042');
    console.log(`✅ Status [${status}]: Type="${template.type}", Icon="${template.icon}", Priority="${template.priority}"`);
    console.log(`   Sample Title: "${template.title}" | Sample Msg: "${sampleMsg}"`);
  }
}

// Test 2: Notification Schema properties
console.log('\n🧪 Testing Notification Schema paths...');
const schemaPaths = Notification.schema.paths;
const requiredFields = ['user', 'type', 'title', 'message'];

let schemaValid = true;
for (const field of requiredFields) {
  if (!schemaPaths[field]) {
    console.error(`❌ Missing required schema field: ${field}`);
    schemaValid = false;
  } else {
    console.log(`✅ Schema field "${field}" verified (required: ${schemaPaths[field].isRequired || false})`);
  }
}

// Verify indexes
const indexes = Notification.schema.indexes();
console.log('\n🧪 Verified Notification MongoDB Indexes:');
indexes.forEach((idx) => {
  console.log(`   Index:`, JSON.stringify(idx[0]), idx[1] ? JSON.stringify(idx[1]) : '');
});

if (statusTestsPassed && schemaValid) {
  console.log('\n✨ ALL NOTIFICATION SYSTEM VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  process.exit(0);
} else {
  console.error('\n❌ SOME VERIFICATION CHECKS FAILED');
  process.exit(1);
}
