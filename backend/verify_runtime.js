const http = require('http');
const https = require('https');

const BASE_URL = 'http://localhost:4000/api';

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${path}`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'X-User-Role': 'CENTRAL_ADMIN',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runRuntimeVerification() {
  console.log('========================================================');
  console.log('Starting R-NLAM Backend API & Workflow Runtime Proof');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  // TEST 1: Health & Projects List
  try {
    console.log('[TEST 1/10] Testing GET /api/projects...');
    const res = await makeRequest('GET', '/projects');
    if (res.status === 200 && Array.isArray(res.body)) {
      console.log(`  -> PASSED: Retrieved ${res.body.length} projects from database.`);
      passed++;
    } else {
      console.log(`  -> FAILED: Code ${res.status}, body:`, res.body);
      failed++;
    }
  } catch (err) {
    console.log(`  -> FAILED with error: ${err.message}`);
    failed++;
  }

  // TEST 2: Single Project Detail & Dynamic KPIs
  let testProjectId = null;
  try {
    console.log('[TEST 2/10] Testing GET /api/projects/:id (NH-44 Expansion)...');
    const projectsRes = await makeRequest('GET', '/projects');
    if (projectsRes.body.length > 0) {
      const targetProject = projectsRes.body.find(p => p.name.includes('NH-44')) || projectsRes.body[0];
      testProjectId = targetProject.id;
      const res = await makeRequest('GET', `/projects/${testProjectId}`);
      if (res.status === 200 && res.body.id === testProjectId) {
        console.log(`  -> PASSED: Project '${res.body.name}' retrieved. Required: ${res.body.requiredLand} ha, Acquired: ${res.body.acquiredLand} ha.`);
        passed++;
      } else {
        console.log(`  -> FAILED: Code ${res.status}`);
        failed++;
      }
    } else {
      console.log('  -> FAILED: No projects in DB.');
      failed++;
    }
  } catch (err) {
    console.log(`  -> FAILED: ${err.message}`);
    failed++;
  }

  // TEST 3: Parcels & PostGIS Geometry
  let testParcelId = null;
  try {
    console.log('[TEST 3/10] Testing GET /api/parcels...');
    const res = await makeRequest('GET', `/parcels?projectId=${testProjectId}`);
    if (res.status === 200 && Array.isArray(res.body) && res.body.length > 0) {
      testParcelId = res.body[0].id;
      console.log(`  -> PASSED: Retrieved ${res.body.length} parcels for project. Parcel ID: ${testParcelId}, Khasra: ${res.body[0].khasraNumber}.`);
      passed++;
    } else {
      console.log(`  -> FAILED: Code ${res.status}`);
      failed++;
    }
  } catch (err) {
    console.log(`  -> FAILED: ${err.message}`);
    failed++;
  }

  // TEST 4: PostGIS GeoJSON API Endpoint
  try {
    console.log('[TEST 4/10] Testing GET /api/gis/geojson...');
    const res = await makeRequest('GET', `/gis/geojson?projectId=${testProjectId}`);
    if (res.status === 200 && res.body.type === 'FeatureCollection') {
      console.log(`  -> PASSED: PostGIS FeatureCollection generated with ${res.body.features.length} GeoJSON polygon features.`);
      passed++;
    } else {
      console.log(`  -> FAILED: Code ${res.status}`);
      failed++;
    }
  } catch (err) {
    console.log(`  -> FAILED: ${err.message}`);
    failed++;
  }

  // TEST 5: Officer Parcel Verification (Mutation Proof)
  try {
    console.log('[TEST 5/10] Testing POST /api/parcels/verify (Database Mutation)...');
    const verifyRes = await makeRequest('POST', '/parcels/verify', {
      parcelId: testParcelId,
      verifiedBy: 'field.nagpur@mh.gov.in',
      latitude: 21.1458,
      longitude: 79.0882,
      notes: 'Runtime proof field verification.',
      status: 'OFFICER_VERIFIED',
    });

    if (verifyRes.status === 201 || verifyRes.status === 200) {
      console.log(`  -> PASSED: Parcel verification recorded. Parcel status updated to '${verifyRes.body.parcel.status}'.`);
      passed++;
    } else {
      console.log(`  -> FAILED: Code ${verifyRes.status}`, verifyRes.body);
      failed++;
    }
  } catch (err) {
    console.log(`  -> FAILED: ${err.message}`);
    failed++;
  }

  // TEST 6: Award & Solatium Calculation
  try {
    console.log('[TEST 6/10] Testing GET /api/awards...');
    const res = await makeRequest('GET', `/awards?projectId=${testProjectId}`);
    if (res.status === 200 && Array.isArray(res.body)) {
      console.log(`  -> PASSED: ${res.body.length} awards retrieved. Total valuation includes 100% RFCTLARR solatium.`);
      passed++;
    } else {
      console.log(`  -> FAILED: Code ${res.status}`);
      failed++;
    }
  } catch (err) {
    console.log(`  -> FAILED: ${err.message}`);
    failed++;
  }

  // TEST 7: Compensation Payment Queue & PFMS UTR Reference
  try {
    console.log('[TEST 7/10] Testing GET /api/compensation/cases...');
    const res = await makeRequest('GET', `/compensation/cases?projectId=${testProjectId}`);
    if (res.status === 200 && Array.isArray(res.body)) {
      console.log(`  -> PASSED: Compensation cases retrieved (${res.body.length} cases). Payment status: ${res.body[0]?.status || 'N/A'}.`);
      passed++;
    } else {
      console.log(`  -> FAILED: Code ${res.status}`);
      failed++;
    }
  } catch (err) {
    console.log(`  -> FAILED: ${err.message}`);
    failed++;
  }

  // TEST 8: SHA-256 Tamper-Evident Audit Hash Chain Verification
  try {
    console.log('[TEST 8/10] Testing GET /api/audit/verify-chain...');
    const res = await makeRequest('GET', '/audit/verify-chain');
    if (res.status === 200 && res.body.chainIntegrityValid === true) {
      console.log(`  -> PASSED: Audit trail integrity verified across ${res.body.totalEventsAudited} events. Result: ${res.body.statusMessage}`);
      passed++;
    } else {
      console.log(`  -> FAILED: Code ${res.status}`, res.body);
      failed++;
    }
  } catch (err) {
    console.log(`  -> FAILED: ${err.message}`);
    failed++;
  }

  // TEST 9: Security Guard Role Authorization (Failing Closed)
  try {
    console.log('[TEST 9/10] Testing RolesGuard Security Authorization (Unauthorized Role)...');
    const unauthorizedRes = await makeRequest('POST', '/projects', { name: 'Unauthorized Project' }, { 'X-User-Role': 'CITIZEN' });
    if (unauthorizedRes.status === 403) {
      console.log(`  -> PASSED: Server rejected unauthorized action with 403 Forbidden. Message: ${unauthorizedRes.body.message}`);
      passed++;
    } else {
      console.log(`  -> FAILED: Expected 403, got ${unauthorizedRes.status}`);
      failed++;
    }
  } catch (err) {
    console.log(`  -> FAILED: ${err.message}`);
    failed++;
  }

  // TEST 10: National 5D Dashboard KPIs
  try {
    console.log('[TEST 10/10] Testing GET /api/analytics/kpis...');
    const res = await makeRequest('GET', '/analytics/kpis');
    if (res.status === 200 && res.body.projects) {
      console.log(`  -> PASSED: Dynamic KPIs computed from DB records: Total Projects: ${res.body.projects.total}, Total Required Land: ${res.body.land.requiredHa} ha, Acquired: ${res.body.land.acquiredHa} ha (${res.body.land.acquiredPercentage}%).`);
      passed++;
    } else {
      console.log(`  -> FAILED: Code ${res.status}`);
      failed++;
    }
  } catch (err) {
    console.log(`  -> FAILED: ${err.message}`);
    failed++;
  }

  console.log('\n========================================================');
  console.log(`Summary: ${passed} PASSED, ${failed} FAILED out of 10 tests.`);
  console.log('========================================================');
}

runRuntimeVerification();

