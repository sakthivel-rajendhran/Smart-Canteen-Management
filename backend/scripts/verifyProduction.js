import fs from 'fs';

async function checkProduction() {
  console.log('====================================================');
  console.log('      DRS QUICK SERVE - PRODUCTION VERIFICATION     ');
  console.log('====================================================\n');

  const frontendUrl = 'https://smart-canteen-management-two.vercel.app';
  const backendUrl = 'https://smart-canteen-management-1-b9zg.onrender.com';

  console.log('1. Checking Frontend on Vercel:', frontendUrl);
  try {
    const fRes = await fetch(frontendUrl);
    console.log('   Status:', fRes.status, fRes.statusText);
    const html = await fRes.text();
    console.log('   HTML bytes:', html.length);
    console.log('   Includes #root container:', html.includes('id="root"'));
    console.log('   Includes index bundle:', html.includes('assets/index-'));
  } catch (err) {
    console.error('   Frontend check failed:', err.message);
  }

  console.log('\n2. Checking Backend on Render:', backendUrl);
  try {
    const hRes = await fetch(backendUrl + '/api/health');
    console.log('   GET /api/health ->', hRes.status, await hRes.json());
  } catch (err) {
    console.error('   Health check failed:', err.message);
  }

  try {
    const mRes = await fetch(backendUrl + '/api/menu');
    const mData = await mRes.json();
    console.log('   GET /api/menu ->', mRes.status, 'Items:', mData.data?.length, 'Encoding:', mRes.headers.get('content-encoding'));
  } catch (err) {
    console.error('   Menu check failed:', err.message);
  }

  try {
    const cRes = await fetch(backendUrl + '/api/categories');
    const cData = await cRes.json();
    console.log('   GET /api/categories ->', cRes.status, 'Count:', cData.data?.length);
  } catch (err) {
    console.error('   Categories check failed:', err.message);
  }

  console.log('\n====================================================');
  console.log('             VERIFICATION SUMMARY COMPLETE          ');
  console.log('====================================================');
}

checkProduction();
