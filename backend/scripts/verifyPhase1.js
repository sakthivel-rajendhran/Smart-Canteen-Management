import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import dns from 'dns';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

dotenv.config({ path: './.env' });
dotenv.config();

async function verify() {
  console.log('====================================================');
  console.log('   DRS QUICK SERVE - PHASE 1 VERIFICATION SUITE    ');
  console.log('====================================================\n');

  const adminToken = jwt.sign({ id: '6ad42e20c681fbc60f8871a6', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });

  // 1. Health check
  const healthRes = await fetch('http://127.0.0.1:5000/api/health');
  const healthData = await healthRes.json();
  console.log('1. GET /api/health:', healthRes.status, healthData);

  // 2. Categories check + Cache-Control
  const catRes = await fetch('http://127.0.0.1:5000/api/categories');
  const catHeaders = {
    'cache-control': catRes.headers.get('cache-control'),
    etag: catRes.headers.get('etag'),
    'content-encoding': catRes.headers.get('content-encoding'),
  };
  const catData = await catRes.json();
  console.log('\n2. GET /api/categories:');
  console.log('   Status:', catRes.status);
  console.log('   Headers:', catHeaders);
  console.log('   Categories count:', catData.data?.length);
  console.log('   Sample category:', catData.data?.[0]?.name, '(parcelEligible:', catData.data?.[0]?.parcelEligible, ')');

  // 3. Menu check + Cache-Control + Base64 verification
  const menuRes = await fetch('http://127.0.0.1:5000/api/menu');
  const menuHeaders = {
    'cache-control': menuRes.headers.get('cache-control'),
    etag: menuRes.headers.get('etag'),
    'content-encoding': menuRes.headers.get('content-encoding'),
  };
  const menuData = await menuRes.json();
  const items = menuData.data || [];
  const base64Items = items.filter(i => (typeof i.image === 'string' ? i.image : (i.image?.url || '')).startsWith('data:'));
  console.log('\n3. GET /api/menu:');
  console.log('   Status:', menuRes.status);
  console.log('   Headers:', menuHeaders);
  console.log('   Menu count:', items.length);
  console.log('   Base64 items in list:', base64Items.length, '(Expected 0)');

  // 4. POST /api/menu/check (Lightweight batch check)
  const sampleIds = items.slice(0, 3).map(i => i._id);
  const checkRes = await fetch('http://127.0.0.1:5000/api/menu/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: sampleIds }),
  });
  const checkData = await checkRes.json();
  console.log('\n4. POST /api/menu/check:');
  console.log('   Status:', checkRes.status);
  console.log('   Sample checked items:', checkData.data);

  // 5. GET /api/orders/my with pagination
  const ordersRes = await fetch('http://127.0.0.1:5000/api/orders/my?page=1&limit=5', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const ordersData = await ordersRes.json();
  console.log('\n5. GET /api/orders/my:');
  console.log('   Status:', ordersRes.status);
  console.log('   Returned items:', ordersData.data?.length);
  console.log('   Pagination:', ordersData.pagination);

  // 6. GET /api/notifications with pagination
  const notifRes = await fetch('http://127.0.0.1:5000/api/notifications?page=1&limit=5', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const notifData = await notifRes.json();
  console.log('\n6. GET /api/notifications:');
  console.log('   Status:', notifRes.status);
  console.log('   Returned items:', notifData.data?.length);
  console.log('   Pagination:', notifData.pagination);

  // 7. GET /api/analytics/overview
  const analyticsRes = await fetch('http://127.0.0.1:5000/api/analytics/overview', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const analyticsData = await analyticsRes.json();
  console.log('\n7. GET /api/analytics/overview:');
  console.log('   Status:', analyticsRes.status);
  console.log('   Analytics overview:', analyticsData.data);

  // 8. Benchmark Endpoints (5 requests each to test cache and p95)
  console.log('\n====================================================');
  console.log('   LATENCY & THROUGHPUT BENCHMARK (PHASE 1)         ');
  console.log('====================================================\n');

  const benchmarkList = [
    { name: 'GET /api/health', url: 'http://127.0.0.1:5000/api/health', headers: {} },
    { name: 'GET /api/categories', url: 'http://127.0.0.1:5000/api/categories', headers: {} },
    { name: 'GET /api/menu', url: 'http://127.0.0.1:5000/api/menu', headers: {} },
    { name: 'POST /api/menu/check', url: 'http://127.0.0.1:5000/api/menu/check', method: 'POST', body: JSON.stringify({ ids: sampleIds }), headers: { 'Content-Type': 'application/json' } },
    { name: 'GET /api/orders/my', url: 'http://127.0.0.1:5000/api/orders/my', headers: { Authorization: `Bearer ${adminToken}` } },
    { name: 'GET /api/notifications', url: 'http://127.0.0.1:5000/api/notifications', headers: { Authorization: `Bearer ${adminToken}` } },
    { name: 'GET /api/analytics/overview', url: 'http://127.0.0.1:5000/api/analytics/overview', headers: { Authorization: `Bearer ${adminToken}` } },
  ];

  const report = [];

  for (const b of benchmarkList) {
    // 1 warm-up request to establish TLS/Atlas connection
    try {
      await fetch(b.url, {
        method: b.method || 'GET',
        headers: b.headers || {},
        body: b.body,
      });
    } catch {}

    const times = [];
    let sizeBytes = 0;
    let statusCode = 200;

    for (let i = 0; i < 5; i++) {
      const t0 = performance.now();
      const res = await fetch(b.url, {
        method: b.method || 'GET',
        headers: b.headers || {},
        body: b.body,
      });
      const duration = performance.now() - t0;
      times.push(duration);
      statusCode = res.status;
      const buf = await res.arrayBuffer();
      sizeBytes = buf.byteLength;
    }

    times.sort((a, b) => a - b);
    const avg = (times.reduce((a, b) => a + b, 0) / times.length).toFixed(1);
    const min = times[0].toFixed(1);
    const p95 = times[Math.floor(times.length * 0.95)].toFixed(1);
    const sizeKB = (sizeBytes / 1024).toFixed(2);

    report.push({
      Endpoint: b.name,
      Status: statusCode,
      'Size (KB)': `${sizeKB} KB`,
      'Min (ms)': `${min} ms`,
      'Avg (ms)': `${avg} ms`,
      'p95 (ms)': `${p95} ms`,
      'Target Met?': Number(p95) < 300 ? '✅ YES' : '❌ NO',
    });
  }

  console.table(report);
}

verify().catch(console.error);
