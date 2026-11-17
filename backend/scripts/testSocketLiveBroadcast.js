import io from '../../frontend/node_modules/socket.io-client/build/esm/index.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import connectDB from '../config/db.js';
import MenuItem from '../models/MenuItem.js';
import User from '../models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SOCKET_URL = 'http://localhost:5000';
const API_BASE = 'http://localhost:5000/api';

async function testLiveSocketBroadcast() {
  console.log('--- Testing Live Socket.IO Broadcast to Multiple Connected Users ---');
  await connectDB();

  // Find admin user for JWT token
  const adminUser = await User.findOne({ role: 'admin' });
  if (!adminUser) throw new Error('No admin user found in DB');
  const token = jwt.sign({ id: adminUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

  // Find an available parent menu item to toggle
  const testItem = await MenuItem.findOne({
    available: true,
    $or: [{ variantParent: null }, { variantParent: { $exists: false } }],
  });
  if (!testItem) throw new Error('No available parent menu item found');

  console.log(`Using test menu item: "${testItem.name}" (ID: ${testItem._id})`);

  // Connect 3 independent client sockets (Student A, Student B, Faculty C)
  const clientA = io(SOCKET_URL, { transports: ['websocket'] });
  const clientB = io(SOCKET_URL, { transports: ['websocket'] });
  const clientC = io(SOCKET_URL, { transports: ['websocket'] });

  await Promise.all([
    new Promise(res => clientA.on('connect', res)),
    new Promise(res => clientB.on('connect', res)),
    new Promise(res => clientC.on('connect', res)),
  ]);
  console.log('✅ 3 clients connected to Socket.IO successfully.');

  // Set up promise collectors for event
  let receivedA = null, receivedB = null, receivedC = null;
  const waitForToggleOff = new Promise((resolve) => {
    let count = 0;
    const checkAll = () => {
      count++;
      if (count === 3) resolve();
    };
    clientA.once('homepage:stats:update', (d) => { receivedA = d; checkAll(); });
    clientB.once('homepage:stats:update', (d) => { receivedB = d; checkAll(); });
    clientC.once('homepage:stats:update', (d) => { receivedC = d; checkAll(); });
  });

  // Action 1: Toggle test item to unavailable
  console.log(`\nAction 1: Toggling "${testItem.name}" to unavailable (sold out)...`);
  const toggleRes1 = await fetch(`${API_BASE}/menu/${testItem._id}/availability`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  const toggleJson1 = await toggleRes1.json();
  console.log('Toggle response:', toggleJson1.message);

  // Wait for all 3 clients to receive the broadcast
  await waitForToggleOff;
  console.log('📡 Broadcast received by Client A:', receivedA);
  console.log('📡 Broadcast received by Client B:', receivedB);
  console.log('📡 Broadcast received by Client C:', receivedC);

  if (!receivedA || !receivedB || !receivedC) {
    throw new Error('Not all clients received the broadcast!');
  }
  if (receivedA.menuItems !== receivedB.menuItems || receivedB.menuItems !== receivedC.menuItems) {
    throw new Error('Inconsistent menuItems counts across clients!');
  }
  console.log(`✅ All 3 clients received identical menuItems count (${receivedA.menuItems}) in real-time!`);

  // Action 2: Toggle test item back to available (restore original state)
  const waitForToggleBack = new Promise((resolve) => {
    let count = 0;
    const checkAll = () => {
      count++;
      if (count === 3) resolve();
    };
    clientA.once('homepage:stats:update', (d) => { receivedA = d; checkAll(); });
    clientB.once('homepage:stats:update', (d) => { receivedB = d; checkAll(); });
    clientC.once('homepage:stats:update', (d) => { receivedC = d; checkAll(); });
  });

  console.log(`\nAction 2: Restoring "${testItem.name}" to available...`);
  const toggleRes2 = await fetch(`${API_BASE}/menu/${testItem._id}/availability`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  const toggleJson2 = await toggleRes2.json();
  console.log('Restore response:', toggleJson2.message);

  await waitForToggleBack;
  console.log(`📡 Broadcast received after restore -> Menu items: ${receivedA.menuItems}`);
  console.log('✅ All 3 clients updated synchronously to restored state!');

  // Cleanup connections
  clientA.disconnect();
  clientB.disconnect();
  clientC.disconnect();

  console.log('\n🎉 Real-time multi-user Socket.IO broadcast test passed with 100% success!');
  process.exit(0);
}

testLiveSocketBroadcast().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
