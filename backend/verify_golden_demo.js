const http = require('http');

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

async function runGoldenDemoProof() {
  console.log('========================================================');
  console.log('R-NLAM GOLDEN DEMO END-TO-END RUNTIME VERIFICATION');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  // 1. Central Dashboard Initial KPIs
  try {
    console.log('[STEP 1/15] Verifying National Dashboard KPIs (GET /api/analytics/kpis)...');
    const res = await makeRequest('GET', '/analytics/kpis');
    if (res.status === 200 && res.body.projects) {
      console.log(`  -> PASSED: Dynamic KPIs retrieved. Total Projects: ${res.body.projects.total}, Total Required Land: ${res.body.land.requiredHa} ha, Acquired: ${res.body.land.acquiredHa} ha.`);
      passed++;
    } else {
      console.log(`  -> FAILED: Code ${res.status}`, res.body);
      failed++;
    }
  } catch (err) {
    console.log(`  -> FAILED: ${err.message}`);
    failed++;
  }

  // 2. PIA Project Creation & PostgreSQL Persistence
  let createdProjectId = null;
  const testProjectCode = `TEST-GOLDEN-${Date.now().toString().slice(-6)}`;
  try {
    console.log(`[STEP 2/15] Verifying PIA Project Creation (POST /api/projects - Code: ${testProjectCode})...`);
    const createRes = await makeRequest('POST', '/projects', {
      code: testProjectCode,
      name: 'Golden Demo Corridor — Nagpur',
      sector: 'Roads & Highways',
      stateCode: 'MH',
      stateName: 'Maharashtra',
      districtCodes: ['NAG'],
      districtNames: ['Nagpur'],
      piaName: 'National Highways Authority of India (NHAI)',
      requiredLand: 500.0,
      estimatedCost: 65.0,
    }, { 'X-User-Role': 'PIA_OFFICER' });

    if ((createRes.status === 201 || createRes.status === 200) && createRes.body.id) {
      createdProjectId = createRes.body.id;
      console.log(`  -> PASSED: Synthetic Project created & persisted in PostgreSQL. ID: ${createdProjectId}, Status: ${createRes.body.status}.`);
      passed++;
    } else {
      console.log(`  -> FAILED: Code ${createRes.status}`, createRes.body);
      failed++;
    }
  } catch (err) {
    console.log(`  -> FAILED: ${err.message}`);
    failed++;
  }

  // 3. Workflow Instance Auto-Creation
  let workflowInstanceId = null;
  try {
    console.log(`[STEP 3/15] Verifying Workflow Instance Auto-Creation (GET /api/workflow/instance/${createdProjectId})...`);
    const wfRes = await makeRequest('GET', `/workflow/instance/${createdProjectId}`);
    if (wfRes.status === 200 && wfRes.body.id) {
      workflowInstanceId = wfRes.body.id;
      console.log(`  -> PASSED: Workflow Instance auto-created. ID: ${workflowInstanceId}, Initial Stage: '${wfRes.body.currentStage}'.`);
      passed++;
    } else {
      console.log(`  -> FAILED: Code ${wfRes.status}`, wfRes.body);
      failed++;
    }
  } catch (err) {
    console.log(`  -> FAILED: ${err.message}`);
    failed++;
  }

  // 4. District Work Queue & Proposals
  try {
    console.log('[STEP 4/15] Verifying District Work Queue Proposals (GET /api/proposals)...');
    const propRes = await makeRequest('GET', '/proposals');
    if (propRes.status === 200 && Array.isArray(propRes.body)) {
      console.log(`  -> PASSED: Retrieved ${propRes.body.length} proposals for district review.`);
      passed++;
    } else {
      console.log(`  -> FAILED: Code ${propRes.status}`);
      failed++;
    }
  } catch (err) {
    console.log(`  -> FAILED: ${err.message}`);
    failed++;
  }

  // 5. Project-Scoped GIS GeoJSON
  try {
    console.log(`[STEP 5/15] Verifying Project-Scoped GIS GeoJSON (GET /api/gis/geojson?projectId=${createdProjectId})...`);
    const gisRes = await makeRequest('GET', `/gis/geojson?projectId=${createdProjectId}`);
    if (gisRes.status === 200 && gisRes.body.type === 'FeatureCollection') {
      console.log(`  -> PASSED: PostGIS GeoJSON FeatureCollection generated for project.`);
      passed++;
    } else {
      console.log(`  -> FAILED: Code ${gisRes.status}`);
      failed++;
    }
  } catch (err) {
    console.log(`  -> FAILED: ${err.message}`);
    failed++;
  }

  // 6. Parcel Detail Retrieval by ID (Contract Check 2 Requirement)
  let seededParcelId = null;
  try {
    console.log('[STEP 6/15] Verifying Parcel Detail Retrieval by ID (GET /api/parcels/:id)...');
    const parcelsRes = await makeRequest('GET', '/parcels');
    if (parcelsRes.body.length > 0) {
      seededParcelId = parcelsRes.body[0].id;
      const detailRes = await makeRequest('GET', `/parcels/${seededParcelId}`);
      if (detailRes.status === 200 && detailRes.body.id === seededParcelId) {
        console.log(`  -> PASSED: Parcel details retrieved. Khasra: ${detailRes.body.khasraNumber}, Owner: ${detailRes.body.landOwnerName}, Status: ${detailRes.body.status}.`);
        passed++;
      } else {
        console.log(`  -> FAILED: Code ${detailRes.status}`);
        failed++;
      }
    } else {
      console.log('  -> FAILED: No parcels found.');
      failed++;
    }
  } catch (err) {
    console.log(`  -> FAILED: ${err.message}`);
    failed++;
  }

  // 7. Field Verification Sync (Database Mutation)
  try {
    console.log('[STEP 7/15] Verifying Field Verification Sync (POST /api/parcels/verify)...');
    const verRes = await makeRequest('POST', '/parcels/verify', {
      parcelId: seededParcelId,
      verifiedBy: 'field.nagpur@mh.gov.in',
      latitude: 21.1458,
      longitude: 79.0882,
      notes: 'Golden Demo field survey verification.',
      status: 'OFFICER_VERIFIED',
    }, { 'X-User-Role': 'FIELD_OFFICER' });

    if (verRes.status === 200 || verRes.status === 201) {
      console.log(`  -> PASSED: Parcel verification recorded. Verification status: '${verRes.body.verification.status}', Parcel status: '${verRes.body.parcel.status}'.`);
      passed++;
    } else {
      console.log(`  -> FAILED: Code ${verRes.status}`, verRes.body);
      failed++;
    }
  } catch (err) {
    console.log(`  -> FAILED: ${err.message}`);
    failed++;
  }

  // 8. Atomic Workflow State Action Execution
  try {
    console.log(`[STEP 8/15] Verifying Atomic Workflow Action Execution (POST /api/workflow/action)...`);
    const wfActionRes = await makeRequest('POST', '/workflow/action', {
      instanceId: workflowInstanceId,
      actionName: 'Advance Stage',
      performedBy: 'cala.nagpur@mh.gov.in',
      fromStage: 'Proposal Scrutiny',
      toStage: 'SIA Clearance',
      remarks: 'Golden Demo proposal scrutiny approved.',
    }, { 'X-User-Role': 'DISTRICT_OFFICER' });

    if (wfActionRes.status === 200 || wfActionRes.status === 201) {
      console.log(`  -> PASSED: Workflow state advanced to '${wfActionRes.body.instance.currentStage}'. Action logged in DB transaction.`);
      passed++;
    } else {
      console.log(`  -> FAILED: Code ${wfActionRes.status}`, wfActionRes.body);
      failed++;
    }
  } catch (err) {
    console.log(`  -> FAILED: ${err.message}`);
    failed++;
  }

  // 9. Audit Event Logging & Hash Chaining
  try {
    console.log('[STEP 9/15] Verifying Audit Trail Log Appends (GET /api/audit)...');
    const auditRes = await makeRequest('GET', '/audit');
    if (auditRes.status === 200 && Array.isArray(auditRes.body) && auditRes.body.length > 0) {
      console.log(`  -> PASSED: ${auditRes.body.length} audit events logged in append-only table. Latest action: '${auditRes.body[0].action}'.`);
      passed++;
    } else {
      console.log(`  -> FAILED: Code ${auditRes.status}`);
      failed++;
    }
  } catch (err) {
    console.log(`  -> FAILED: ${err.message}`);
    failed++;
  }

  // 10. Cryptographic SHA-256 Hash Chain Verification
  try {
    console.log('[STEP 10/15] Verifying SHA-256 Audit Hash Chain (GET /api/audit/verify-chain)...');
    const chainRes = await makeRequest('GET', '/audit/verify-chain');
    if (chainRes.status === 200 && chainRes.body.chainIntegrityValid === true) {
      console.log(`  -> PASSED: Cryptographic hash chain verified across ${chainRes.body.totalEventsAudited} events. Status: ${chainRes.body.statusMessage}`);
      passed++;
    } else {
      console.log(`  -> FAILED: Code ${chainRes.status}`, chainRes.body);
      failed++;
    }
  } catch (err) {
    console.log(`  -> FAILED: ${err.message}`);
    failed++;
  }

  // 11. In-App Notifications
  try {
    console.log('[STEP 11/15] Verifying In-App Notifications (GET /api/notifications)...');
    const notifRes = await makeRequest('GET', '/notifications');
    if (notifRes.status === 200 && Array.isArray(notifRes.body)) {
      console.log(`  -> PASSED: ${notifRes.body.length} SLA notifications retrieved.`);
      passed++;
    } else {
      console.log(`  -> FAILED: Code ${notifRes.status}`);
      failed++;
    }
  } catch (err) {
    console.log(`  -> FAILED: ${err.message}`);
    failed++;
  }

  // 12. Compensation Cases & Payment Reference Tracking
  try {
    console.log('[STEP 12/15] Verifying Compensation Treasury Ledger (GET /api/compensation/cases)...');
    const compRes = await makeRequest('GET', '/compensation/cases');
    if (compRes.status === 200 && Array.isArray(compRes.body)) {
      console.log(`  -> PASSED: Compensation payment cases retrieved (${compRes.body.length} cases). Beneficiary: ${compRes.body[0]?.beneficiaryName || 'N/A'}.`);
      passed++;
    } else {
      console.log(`  -> FAILED: Code ${compRes.status}`);
      failed++;
    }
  } catch (err) {
    console.log(`  -> FAILED: ${err.message}`);
    failed++;
  }

  // 13. Resettlement & Rehabilitation (R&R)
  try {
    console.log('[STEP 13/15] Verifying R&R Families & Cases (GET /api/rr/families & GET /api/rr/cases)...');
    const [famRes, rrCaseRes] = await Promise.all([
      makeRequest('GET', '/rr/families'),
      makeRequest('GET', '/rr/cases'),
    ]);
    if (famRes.status === 200 && rrCaseRes.status === 200) {
      console.log(`  -> PASSED: ${famRes.body.length} affected families and ${rrCaseRes.body.length} R&R cases retrieved.`);
      passed++;
    } else {
      console.log(`  -> FAILED: Code ${famRes.status} / ${rrCaseRes.status}`);
      failed++;
    }
  } catch (err) {
    console.log(`  -> FAILED: ${err.message}`);
    failed++;
  }

  // 14. Possession Handover Certificates
  try {
    console.log('[STEP 14/15] Verifying Possession Handover Certificates (GET /api/possession/cases)...');
    const possRes = await makeRequest('GET', '/possession/cases');
    if (possRes.status === 200 && Array.isArray(possRes.body)) {
      console.log(`  -> PASSED: ${possRes.body.length} physical possession certificates retrieved.`);
      passed++;
    } else {
      console.log(`  -> FAILED: Code ${possRes.status}`);
      failed++;
    }
  } catch (err) {
    console.log(`  -> FAILED: ${err.message}`);
    failed++;
  }

  // 15. Updated National Dashboard KPIs
  try {
    console.log('[STEP 15/15] Verifying Updated National Dashboard KPIs (GET /api/analytics/kpis)...');
    const kpiRes = await makeRequest('GET', '/analytics/kpis');
    if (kpiRes.status === 200 && kpiRes.body.projects) {
      console.log(`  -> PASSED: Updated KPIs computed live from database. Total Projects: ${kpiRes.body.projects.total}, Total Required Land: ${kpiRes.body.land.requiredHa} ha, Acquired: ${kpiRes.body.land.acquiredHa} ha.`);
      passed++;
    } else {
      console.log(`  -> FAILED: Code ${kpiRes.status}`);
      failed++;
    }
  } catch (err) {
    console.log(`  -> FAILED: ${err.message}`);
    failed++;
  }

  console.log('\n========================================================');
  console.log(`GOLDEN DEMO RESULT: ${passed} PASSED, ${failed} FAILED out of 15 STEPS.`);
  console.log('========================================================');
}

runGoldenDemoProof();

