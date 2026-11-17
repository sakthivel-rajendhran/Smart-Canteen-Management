/**
 * DRS Quick Serve - Render Free Tier Keep-Alive Daemon
 * 
 * Render free web services spin down after 15 minutes of inactivity.
 * This script pings GET /api/health every 14 minutes to keep the container warm.
 * 
 * Usage:
 *   node scripts/keepAlive.js
 * 
 * Alternative Recommended Free Cloud Monitors:
 *   1. UptimeRobot (https://uptimerobot.com) -> HTTP(s) monitor -> ping every 10 or 14 mins
 *   2. cron-job.org (https://cron-job.org)   -> Cron job every 14 mins
 * 
 * Ping Endpoint:
 *   https://smart-canteen-management-1-b9zg.onrender.com/api/health
 */

import http from 'http';
import https from 'https';

const TARGET_URL = process.env.RENDER_EXTERNAL_URL
  ? `${process.env.RENDER_EXTERNAL_URL.replace(/\/$/, '')}/api/health`
  : process.env.KEEP_ALIVE_URL || 'https://smart-canteen-management-1-b9zg.onrender.com/api/health';

const INTERVAL_MS = 14 * 60 * 1000; // 14 minutes (Render sleeps at 15m)

function pingEndpoint(url) {
  const isHttps = url.startsWith('https://');
  const client = isHttps ? https : http;

  const startTime = Date.now();
  const req = client.get(url, { timeout: 35000 }, (res) => {
    let raw = '';
    res.on('data', (chunk) => { raw += chunk; });
    res.on('end', () => {
      const duration = Date.now() - startTime;
      const istTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      console.log(`[KEEP-ALIVE] ${istTime} (IST) -> ${res.statusCode} ${res.statusMessage} in ${duration}ms (${url})`);
    });
  });

  req.on('error', (err) => {
    const istTime = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    console.warn(`[KEEP-ALIVE WARN] ${istTime} (IST) -> Ping failed: ${err.message}`);
  });

  req.on('timeout', () => {
    req.destroy();
    console.warn('[KEEP-ALIVE WARN] Request timed out (server might be waking up from sleep)');
  });
}

console.log('====================================================');
console.log('    DRS QUICK SERVE - RENDER KEEP-ALIVE DAEMON     ');
console.log('====================================================');
console.log(`Target:   ${TARGET_URL}`);
console.log(`Interval: Every 14 minutes (${INTERVAL_MS / 1000}s)`);
console.log('External monitor alternatives: cron-job.org or UptimeRobot');
console.log('====================================================\n');

// Initial immediate ping
pingEndpoint(TARGET_URL);

// Schedule recurring ping every 14 minutes
setInterval(() => {
  pingEndpoint(TARGET_URL);
}, INTERVAL_MS);
