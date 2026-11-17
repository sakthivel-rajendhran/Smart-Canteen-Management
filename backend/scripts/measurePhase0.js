import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import dns from 'dns';

try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {}

dotenv.config({ path: './backend/.env' });

async function run() {
  const adminToken = jwt.sign({ id: '6ad42e20c681fbc60f8871a6' }, process.env.JWT_SECRET, { expiresIn: '1h' });

  const endpoints = [
    { name: 'GET /api/health', url: 'http://127.0.0.1:5000/api/health', headers: {} },
    { name: 'GET /api/categories', url: 'http://127.0.0.1:5000/api/categories', headers: {} },
    { name: 'GET /api/menu', url: 'http://127.0.0.1:5000/api/menu', headers: {} },
    { name: 'GET /api/orders/my', url: 'http://127.0.0.1:5000/api/orders/my', headers: { Authorization: `Bearer ${adminToken}` } },
    { name: 'GET /api/notifications', url: 'http://127.0.0.1:5000/api/notifications', headers: { Authorization: `Bearer ${adminToken}` } },
    { name: 'GET /api/analytics/overview', url: 'http://127.0.0.1:5000/api/analytics/overview', headers: { Authorization: `Bearer ${adminToken}` } },
    { name: 'GET /api/admin/revenue/analytics', url: 'http://127.0.0.1:5000/api/admin/revenue/analytics?dateRange=today', headers: { Authorization: `Bearer ${adminToken}` } },
  ];

  console.log('=== BENCHMARKING ENDPOINTS (PHASE 0 MEASUREMENT) ===\n');

  const results = [];

  for (const ep of endpoints) {
    // Run 3 warm-up / measurement samples
    const times = [];
    let sizeBytes = 0;
    let status = 0;
    let sampleData = null;

    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      const res = await fetch(ep.url, { headers: ep.headers });
      const duration = performance.now() - start;
      const buf = await res.arrayBuffer();
      times.push(duration);
      sizeBytes = buf.byteLength;
      status = res.status;
      if (i === 0) {
        try {
          sampleData = JSON.parse(Buffer.from(buf).toString('utf8'));
        } catch {}
      }
    }

    const avgMs = (times.reduce((a, b) => a + b, 0) / times.length).toFixed(1);
    const minMs = Math.min(...times).toFixed(1);
    const maxMs = Math.max(...times).toFixed(1);
    const sizeKB = (sizeBytes / 1024).toFixed(2);

    let itemCount = '-';
    if (sampleData) {
      if (Array.isArray(sampleData.data)) itemCount = sampleData.data.length;
      else if (Array.isArray(sampleData)) itemCount = sampleData.length;
    }

    results.push({
      endpoint: ep.name,
      status,
      sizeBytes,
      sizeKB: `${sizeKB} KB`,
      avgMs: `${avgMs} ms`,
      minMs: `${minMs} ms`,
      maxMs: `${maxMs} ms`,
      items: itemCount,
    });
  }

  console.table(results);

  // Check /api/menu in depth (image sizes, payload properties)
  const menuRes = await fetch('http://127.0.0.1:5000/api/menu');
  const menuRawText = await menuRes.text();
  const menuData = JSON.parse(menuRawText);
  const items = menuData.data || [];
  let base64Count = 0;
  let cloudinaryCount = 0;
  let totalImgLength = 0;

  for (const it of items) {
    const imgUrl = typeof it.image === 'string' ? it.image : (it.image?.url || '');
    if (imgUrl.startsWith('data:image')) {
      base64Count++;
      totalImgLength += imgUrl.length;
    } else if (imgUrl.includes('cloudinary.com')) {
      cloudinaryCount++;
    }
  }

  console.log('\n--- Deep Inspection: GET /api/menu ---');
  console.log('Total Menu Items:', items.length);
  console.log('Raw JSON Size (Uncompressed):', (Buffer.byteLength(menuRawText) / 1024).toFixed(2), 'KB');
  console.log('Items with Base64 Images:', base64Count);
  console.log('Items with Cloudinary URLs:', cloudinaryCount);
  console.log('Total Base64 String Size in JSON:', (totalImgLength / 1024).toFixed(2), 'KB');
}

run().catch(console.error);
