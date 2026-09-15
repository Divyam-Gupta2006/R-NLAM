import {
  PrismaClient,
  RoleName,
  ProjectStatus,
  ProposalStatus,
  ParcelStatus,
  VerificationStatus,
  CompensationStatus,
  RRStatus,
  PossessionStatus,
  MilestoneStatus,
  ObjectionStatus,
} from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

function calculateHash(previousHash: string, data: object): string {
  return crypto.createHash('sha256').update(previousHash + JSON.stringify(data)).digest('hex');
}

// Generate closed-ring polygon GeoJSON around center lat/lng
function generatePolygonGeoJson(centerLat: number, centerLng: number, sizeOffset: number = 0.002) {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [centerLng - sizeOffset, centerLat - sizeOffset],
        [centerLng + sizeOffset, centerLat - sizeOffset],
        [centerLng + sizeOffset, centerLat + sizeOffset],
        [centerLng - sizeOffset, centerLat + sizeOffset],
        [centerLng - sizeOffset, centerLat - sizeOffset], // Closed ring
      ],
    ],
  };
}

export async function seedDemoDataset() {
  console.log('========================================================');
  console.log('🌱 SEEDING R-NLAM SYNTHETIC NATIONAL DEMONSTRATION DATASET');
  console.log('   Notice: SYNTHETIC DEMONSTRATION DATA — NOT REAL GOVERNMENT RECORDS');
  console.log('========================================================');

  // Fix pre-existing NH-44 land metrics if needed
  const nh44Old = await prisma.project.findFirst({ where: { code: 'NH-44-NAGPUR' } });
  if (nh44Old) {
    await prisma.project.update({
      where: { id: nh44Old.id },
      data: { requiredLand: 1420.0, acquiredLand: 1037.0, possessedLand: 876.0 },
    });
  }

  // 1. ORGANIZATIONS (10 Orgs)
  const orgsData = [
    { code: 'DEMO-ORG-NHAI', name: 'National Highways Authority of India (NHAI)', type: 'PIA' },
    { code: 'DEMO-ORG-DFCCIL', name: 'Dedicated Freight Corridor Corporation (DFCCIL)', type: 'PIA' },
    { code: 'DEMO-ORG-SECI', name: 'Solar Energy Corporation of India (SECI)', type: 'PIA' },
    { code: 'DEMO-ORG-MSRDC', name: 'Maharashtra State Road Development Corp (MSRDC)', type: 'PIA' },
    { code: 'DEMO-ORG-KIDA', name: 'Karnataka Industrial Areas Development Board (KIADB)', type: 'PIA' },
    { code: 'DEMO-ORG-MIDC', name: 'Maharashtra Industrial Development Corporation', type: 'PIA' },
    { code: 'DEMO-ORG-UPIDA', name: 'Uttar Pradesh Expressways Industrial Dev Authority', type: 'PIA' },
    { code: 'DEMO-ORG-GIDC', name: 'Gujarat Industrial Development Corporation', type: 'PIA' },
    { code: 'DEMO-ORG-IDCO', name: 'Odisha Infrastructure Development Corporation', type: 'PIA' },
    { code: 'DEMO-ORG-CALA-NAGPUR', name: 'Competent Authority Land Acquisition — Nagpur', type: 'CALA', stateCode: 'MH' },
  ];

  const orgMap: Record<string, string> = {};
  for (const org of orgsData) {
    const created = await prisma.organization.upsert({
      where: { code: org.code },
      update: { name: org.name, type: org.type, stateCode: org.stateCode },
      create: org,
    });
    orgMap[org.code] = created.id;
  }

  // 2. JURISDICTIONS (20 Districts across 7 States)
  const jurisdictionsData = [
    // Maharashtra (MH)
    { stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'NAG', districtName: 'Nagpur' },
    { stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'PUN', districtName: 'Pune' },
    { stateCode: 'MH', stateName: 'Maharashtra', districtCode: 'THN', districtName: 'Thane' },
    // Uttar Pradesh (UP)
    { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'KNP', districtName: 'Kanpur Nagar' },
    { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'GBN', districtName: 'Gautam Buddha Nagar' },
    { stateCode: 'UP', stateName: 'Uttar Pradesh', districtCode: 'PRY', districtName: 'Prayagraj' },
    // Rajasthan (RJ)
    { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'JSM', districtName: 'Jaisalmer' },
    { stateCode: 'RJ', stateName: 'Rajasthan', districtCode: 'JPR', districtName: 'Jaipur' },
    // Karnataka (KA)
    { stateCode: 'KA', stateName: 'Karnataka', districtCode: 'BLR', districtName: 'Bengaluru Urban' },
    { stateCode: 'KA', stateName: 'Karnataka', districtCode: 'DKN', districtName: 'Dakshina Kannada' },
    // Madhya Pradesh (MP)
    { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'IND', districtName: 'Indore' },
    { stateCode: 'MP', stateName: 'Madhya Pradesh', districtCode: 'BHO', districtName: 'Bhopal' },
    // Gujarat (GJ)
    { stateCode: 'GJ', stateName: 'Gujarat', districtCode: 'GND', districtName: 'Gandhinagar' },
    { stateCode: 'GJ', stateName: 'Gujarat', districtCode: 'KCH', districtName: 'Kutch' },
    // Odisha (OD)
    { stateCode: 'OD', stateName: 'Odisha', districtCode: 'KHD', districtName: 'Khordha' },
    { stateCode: 'OD', stateName: 'Odisha', districtCode: 'CTC', districtName: 'Cuttack' },
  ];

  const jurMap: Record<string, string> = {};
  for (const j of jurisdictionsData) {
    let existing = await prisma.jurisdiction.findFirst({
      where: { stateCode: j.stateCode, districtCode: j.districtCode },
    });
    if (!existing) {
      existing = await prisma.jurisdiction.create({ data: j });
    }
    jurMap[`${j.stateCode}-${j.districtCode}`] = existing.id;
  }

  // 3. DEMO USERS (25 Users across all 11 Roles)
  const usersData = [
    { email: 'admin@rnlam.gov.in', name: 'Rajesh Sharma', role: RoleName.CENTRAL_ADMIN },
    { email: 'central.officer@rnlam.gov.in', name: 'Alok Verma', role: RoleName.CENTRAL_OFFICER },
    { email: 'state.admin.mh@mh.gov.in', name: 'Sanjay Patil', role: RoleName.STATE_ADMIN, jurKey: 'MH-NAG' },
    { email: 'state.officer@mh.gov.in', name: 'Priya Deshmukh', role: RoleName.STATE_OFFICER, jurKey: 'MH-NAG' },
    { email: 'state.officer.up@up.gov.in', name: 'Ramesh Yadav', role: RoleName.STATE_OFFICER, jurKey: 'UP-KNP' },
    { email: 'state.officer.rj@rj.gov.in', name: 'Vikram Singh', role: RoleName.STATE_OFFICER, jurKey: 'RJ-JSM' },
    { email: 'cala.nagpur@mh.gov.in', name: 'Anil Kulkarni', role: RoleName.DISTRICT_OFFICER, orgCode: 'DEMO-ORG-CALA-NAGPUR', jurKey: 'MH-NAG' },
    { email: 'district.pune@mh.gov.in', name: 'Mahesh Joshi', role: RoleName.DISTRICT_OFFICER, jurKey: 'MH-PUN' },
    { email: 'district.kanpur@up.gov.in', name: 'Suresh Shukla', role: RoleName.DISTRICT_OFFICER, jurKey: 'UP-KNP' },
    { email: 'district.jaisalmer@rj.gov.in', name: 'Bhawani Rathore', role: RoleName.DISTRICT_OFFICER, jurKey: 'RJ-JSM' },
    { email: 'district.bengaluru@ka.gov.in', name: 'Siddharth Gowda', role: RoleName.DISTRICT_OFFICER, jurKey: 'KA-BLR' },
    { email: 'pia.nh44@nhai.gov.in', name: 'Vikram Mehta', role: RoleName.PIA_OFFICER, orgCode: 'DEMO-ORG-NHAI' },
    { email: 'pia.dfc@dfccil.gov.in', name: 'Pankaj Tripathi', role: RoleName.PIA_OFFICER, orgCode: 'DEMO-ORG-DFCCIL' },
    { email: 'pia.solar@seci.gov.in', name: 'Sunil Choudhary', role: RoleName.PIA_OFFICER, orgCode: 'DEMO-ORG-SECI' },
    { email: 'field.nagpur@mh.gov.in', name: 'Suresh Patil', role: RoleName.FIELD_OFFICER, jurKey: 'MH-NAG' },
    { email: 'field.pune@mh.gov.in', name: 'Vijay Shinde', role: RoleName.FIELD_OFFICER, jurKey: 'MH-PUN' },
    { email: 'field.kanpur@up.gov.in', name: 'Santosh Kumar', role: RoleName.FIELD_OFFICER, jurKey: 'UP-KNP' },
    { email: 'field.blr@ka.gov.in', name: 'Ravi Kumar', role: RoleName.FIELD_OFFICER, jurKey: 'KA-BLR' },
    { email: 'rr.officer@mh.gov.in', name: 'Sunita Rao', role: RoleName.RR_OFFICER, jurKey: 'MH-NAG' },
    { email: 'rr.officer.up@up.gov.in', name: 'Meena Srivastava', role: RoleName.RR_OFFICER, jurKey: 'UP-KNP' },
    { email: 'finance.treasury@mh.gov.in', name: 'Ramesh Verma', role: RoleName.FINANCE_OFFICER, jurKey: 'MH-NAG' },
    { email: 'finance.treasury.up@up.gov.in', name: 'Deepak Mishra', role: RoleName.FINANCE_OFFICER, jurKey: 'UP-KNP' },
    { email: 'gis.specialist@rnlam.gov.in', name: 'Kavita Joshi', role: RoleName.GIS_OFFICER },
    { email: 'citizen.landowner@gmail.com', name: 'Devendra Jadhav', role: RoleName.CITIZEN, phone: '+919822012345' },
    { email: 'citizen.farmer@gmail.com', name: 'Ramcharan Yadav', role: RoleName.CITIZEN, phone: '+919415012345' },
  ];

  const userMap: Record<string, any> = {};
  for (const u of usersData) {
    const userObj = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        role: u.role,
        organizationId: u.orgCode ? orgMap[u.orgCode] : undefined,
        jurisdictionId: u.jurKey ? jurMap[u.jurKey] : undefined,
        phone: u.phone,
      },
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        organizationId: u.orgCode ? orgMap[u.orgCode] : undefined,
        jurisdictionId: u.jurKey ? jurMap[u.jurKey] : undefined,
        phone: u.phone,
      },
    });
    userMap[u.email] = userObj;
  }

  // 4. PROJECTS SPECIFICATION (15 Projects across 7 States, Realistic Lifecycle Distribution)
  const projectsSpec = [
    // Maharashtra (MH)
    {
      code: 'DEMO-NH-44-NAGPUR',
      name: 'Synthetic Demo: NH-44 Expansion — Nagpur',
      sector: 'Roads & Highways',
      stateCode: 'MH',
      stateName: 'Maharashtra',
      districtCodes: ['NAG'],
      districtNames: ['Nagpur'],
      piaName: 'National Highways Authority of India (NHAI)',
      requiredLand: 1420.0,
      estimatedCost: 82.4,
      affectedCount: 428,
      status: ProjectStatus.ACTIVE,
      centerLat: 21.1458,
      centerLng: 79.0882,
    },
    {
      code: 'DEMO-METRO-PUNE',
      name: 'Synthetic Demo: Pune Metro Line 3 Corridor',
      sector: 'Urban Transport',
      stateCode: 'MH',
      stateName: 'Maharashtra',
      districtCodes: ['PUN'],
      districtNames: ['Pune'],
      piaName: 'MSRDC / Pune Metro Rail Corp',
      requiredLand: 340.0,
      estimatedCost: 120.0,
      affectedCount: 150,
      status: ProjectStatus.APPROVED,
      centerLat: 18.5204,
      centerLng: 73.8567,
    },
    {
      code: 'DEMO-EXPRESSWAY-MUMBAI',
      name: 'Synthetic Demo: Konkan Coastal Expressway — Thane',
      sector: 'Roads & Highways',
      stateCode: 'MH',
      stateName: 'Maharashtra',
      districtCodes: ['THN'],
      districtNames: ['Thane'],
      piaName: 'Maharashtra State Road Development Corp (MSRDC)',
      requiredLand: 620.0,
      estimatedCost: 240.0,
      affectedCount: 280,
      status: ProjectStatus.DRAFT,
      centerLat: 19.2183,
      centerLng: 72.9781,
    },
    // Uttar Pradesh (UP)
    {
      code: 'DEMO-DFC-UP-WEST',
      name: 'Synthetic Demo: DFC — Uttar Pradesh Freight Corridor',
      sector: 'Railways',
      stateCode: 'UP',
      stateName: 'Uttar Pradesh',
      districtCodes: ['KNP'],
      districtNames: ['Kanpur Nagar'],
      piaName: 'Dedicated Freight Corridor Corporation (DFCCIL)',
      requiredLand: 980.0,
      estimatedCost: 145.0,
      affectedCount: 310,
      status: ProjectStatus.UNDER_SCRUTINY,
      centerLat: 26.4499,
      centerLng: 80.3319,
    },
    {
      code: 'DEMO-AIRPORT-JEWAR',
      name: 'Synthetic Demo: Jewar International Airport Link',
      sector: 'Civil Aviation',
      stateCode: 'UP',
      stateName: 'Uttar Pradesh',
      districtCodes: ['GBN'],
      districtNames: ['Gautam Buddha Nagar'],
      piaName: 'Noida International Airport Limited',
      requiredLand: 1250.0,
      estimatedCost: 350.0,
      affectedCount: 520,
      status: ProjectStatus.ACTIVE,
      centerLat: 28.1818,
      centerLng: 77.5612,
    },
    {
      code: 'DEMO-EXPRESSWAY-GANGA',
      name: 'Synthetic Demo: Ganga Expressway Phase 2 — Prayagraj',
      sector: 'Roads & Highways',
      stateCode: 'UP',
      stateName: 'Uttar Pradesh',
      districtCodes: ['PRY'],
      districtNames: ['Prayagraj'],
      piaName: 'Uttar Pradesh Expressways Industrial Dev Authority',
      requiredLand: 1800.0,
      estimatedCost: 410.0,
      affectedCount: 680,
      status: ProjectStatus.SUBMITTED,
      centerLat: 25.4358,
      centerLng: 81.8463,
    },
    // Rajasthan (RJ)
    {
      code: 'DEMO-RE-SOLAR-RJ',
      name: 'Synthetic Demo: Solar Energy Park — Jaisalmer',
      sector: 'Renewable Energy',
      stateCode: 'RJ',
      stateName: 'Rajasthan',
      districtCodes: ['JSM'],
      districtNames: ['Jaisalmer'],
      piaName: 'Solar Energy Corporation of India (SECI)',
      requiredLand: 2500.0,
      estimatedCost: 210.0,
      affectedCount: 180,
      status: ProjectStatus.APPROVED,
      centerLat: 26.9157,
      centerLng: 70.9083,
    },
    {
      code: 'DEMO-HIGHWAY-JAIPUR',
      name: 'Synthetic Demo: Jaipur Ring Road Expansion',
      sector: 'Roads & Highways',
      stateCode: 'RJ',
      stateName: 'Rajasthan',
      districtCodes: ['JPR'],
      districtNames: ['Jaipur'],
      piaName: 'National Highways Authority of India (NHAI)',
      requiredLand: 540.0,
      estimatedCost: 95.0,
      affectedCount: 220,
      status: ProjectStatus.ON_HOLD,
      centerLat: 26.9124,
      centerLng: 75.7873,
    },
    // Karnataka (KA)
    {
      code: 'DEMO-TECH-HUB-BLR',
      name: 'Synthetic Demo: Aerospace Park — Bengaluru Urban',
      sector: 'Industrial Infrastructure',
      stateCode: 'KA',
      stateName: 'Karnataka',
      districtCodes: ['BLR'],
      districtNames: ['Bengaluru Urban'],
      piaName: 'Karnataka Industrial Areas Development Board',
      requiredLand: 850.0,
      estimatedCost: 310.0,
      affectedCount: 340,
      status: ProjectStatus.COMPLETED,
      centerLat: 13.0012,
      centerLng: 77.6234,
    },
    {
      code: 'DEMO-PORT-MANGALORE',
      name: 'Synthetic Demo: Mangalore Port Connectivity Railway',
      sector: 'Ports & Logistics',
      stateCode: 'KA',
      stateName: 'Karnataka',
      districtCodes: ['DKN'],
      districtNames: ['Dakshina Kannada'],
      piaName: 'Indian Railways / New Mangalore Port Trust',
      requiredLand: 410.0,
      estimatedCost: 130.0,
      affectedCount: 190,
      status: ProjectStatus.ACTIVE,
      centerLat: 12.9141,
      centerLng: 74.856,
    },
    // Madhya Pradesh (MP)
    {
      code: 'DEMO-INDUSTRIAL-INDORE',
      name: 'Synthetic Demo: Pithampur Industrial Corridor — Indore',
      sector: 'Industrial Infrastructure',
      stateCode: 'MP',
      stateName: 'Madhya Pradesh',
      districtCodes: ['IND'],
      districtNames: ['Indore'],
      piaName: 'MP Industrial Development Corporation',
      requiredLand: 1100.0,
      estimatedCost: 175.0,
      affectedCount: 290,
      status: ProjectStatus.UNDER_SCRUTINY,
      centerLat: 22.7196,
      centerLng: 75.8577,
    },
    {
      code: 'DEMO-RAILWAY-BHOPAL',
      name: 'Synthetic Demo: Bhopal-Indore High Speed Rail Link',
      sector: 'Railways',
      stateCode: 'MP',
      stateName: 'Madhya Pradesh',
      districtCodes: ['BHO'],
      districtNames: ['Bhopal'],
      piaName: 'National High Speed Rail Corporation',
      requiredLand: 950.0,
      estimatedCost: 280.0,
      affectedCount: 410,
      status: ProjectStatus.ACTIVE,
      centerLat: 23.2599,
      centerLng: 77.4126,
    },
    // Gujarat (GJ)
    {
      code: 'DEMO-GIFT-CITY-EXT',
      name: 'Synthetic Demo: GIFT City Smart Zone Extension',
      sector: 'Urban Infrastructure',
      stateCode: 'GJ',
      stateName: 'Gujarat',
      districtCodes: ['GND'],
      districtNames: ['Gandhinagar'],
      piaName: 'Gujarat Industrial Development Corporation',
      requiredLand: 680.0,
      estimatedCost: 260.0,
      affectedCount: 210,
      status: ProjectStatus.APPROVED,
      centerLat: 23.2156,
      centerLng: 72.6369,
    },
    {
      code: 'DEMO-GREEN-HYDROGEN-GJ',
      name: 'Synthetic Demo: Kutch Green Hydrogen Energy Zone',
      sector: 'Renewable Energy',
      stateCode: 'GJ',
      stateName: 'Gujarat',
      districtCodes: ['KCH'],
      districtNames: ['Kutch'],
      piaName: 'Gujarat Power Corporation Limited',
      requiredLand: 3200.0,
      estimatedCost: 450.0,
      affectedCount: 130,
      status: ProjectStatus.DRAFT,
      centerLat: 23.242,
      centerLng: 69.6669,
    },
    // Odisha (OD)
    {
      code: 'DEMO-STEEL-HUB-OD',
      name: 'Synthetic Demo: Kalinganagar Industrial Link — Khordha',
      sector: 'Industrial Infrastructure',
      stateCode: 'OD',
      stateName: 'Odisha',
      districtCodes: ['KHD'],
      districtNames: ['Khordha'],
      piaName: 'Odisha Infrastructure Development Corporation',
      requiredLand: 1150.0,
      estimatedCost: 195.0,
      affectedCount: 360,
      status: ProjectStatus.SUBMITTED,
      centerLat: 20.2961,
      centerLng: 85.8245,
    },
  ];

  // 5. WORKFLOW TEMPLATE
  let templateLARR = await prisma.workflowTemplate.findFirst({
    where: { name: 'Standard RFCTLARR Act 2013 Workflow' },
  });
  if (!templateLARR) {
    templateLARR = await prisma.workflowTemplate.create({
      data: {
        name: 'Standard RFCTLARR Act 2013 Workflow',
        legalFramework: 'RFCTLARR Act 2013',
        config: {
          stages: [
            'Proposal Scrutiny',
            'SIA Clearance',
            'Preliminary Notification (Sec 11)',
            'Objection Hearing (Sec 15)',
            'Declaration (Sec 19)',
            'Award Declaration (Sec 23)',
            'Compensation Disbursement',
            'R&R Benefit Delivery',
            'Possession Handover',
            'Completed',
          ],
        },
      },
    });
  }

  // RE-CHAIN EXISTING AUDIT LOG TO PRESERVE 100% CRYPTOGRAPHIC CONTINUITY
  const allEvents = await prisma.auditEvent.findMany({ orderBy: { timestamp: 'asc' } });
  let prevHash = 'GENESIS_HASH_00000000000000000000000000000000';
  for (const ev of allEvents) {
    const auditPayload = {
      actorId: ev.actorId,
      actorRole: ev.actorRole,
      action: ev.action,
      entityType: ev.entityType,
      entityId: ev.entityId,
      previousState: ev.previousState || null,
      newState: ev.newState || null,
      timestamp: ev.timestamp.toISOString(),
    };
    const expectedHash = calculateHash(prevHash, auditPayload);
    if (ev.previousHash !== prevHash || ev.hash !== expectedHash) {
      await prisma.auditEvent.update({
        where: { id: ev.id },
        data: { previousHash: prevHash, hash: expectedHash },
      });
      prevHash = expectedHash;
    } else {
      prevHash = ev.hash;
    }
  }

  const createdAuditEvents: any[] = [];

  const addAuditEvent = async (actorEmail: string, action: string, entityType: string, entityId: string, newState: any, prevStageState?: any) => {
    const actor = userMap[actorEmail] || userMap['admin@rnlam.gov.in'];
    const auditPayload = {
      actorId: actor.id,
      actorRole: actor.role,
      action,
      entityType,
      entityId,
      previousState: prevStageState || null,
      newState,
      timestamp: new Date().toISOString(),
    };
    const hash = calculateHash(prevHash, auditPayload);
    const existing = await prisma.auditEvent.findUnique({ where: { hash } });
    if (!existing) {
      const created = await prisma.auditEvent.create({
        data: {
          actorId: actor.id,
          actorRole: actor.role,
          action,
          entityType,
          entityId,
          previousState: prevStageState || null,
          newState,
          previousHash: prevHash,
          hash,
        },
      });
      prevHash = hash;
      createdAuditEvents.push(created);
    } else {
      prevHash = existing.hash;
    }
  };

  let totalParcelsCount = 0;
  let totalProposalsCount = 0;
  let totalWfInstancesCount = 0;
  let totalWfActionsCount = 0;
  let totalObjectionsCount = 0;
  let totalHearingsCount = 0;
  let totalAwardsCount = 0;
  let totalCompCasesCount = 0;
  let totalPayRefsCount = 0;
  let totalFamiliesCount = 0;
  let totalRRCasesCount = 0;
  let totalRRDelivsCount = 0;
  let totalPossessionsCount = 0;
  let totalDocumentsCount = 0;
  let totalSlaTasksCount = 0;
  let totalMilestonesCount = 0;
  let totalRiskAssessmentsCount = 0;
  let totalNotificationsCount = 0;

  // LOOP THROUGH ALL 15 PROJECTS AND BUILD COMPLETE DIGITAL THREADS
  for (let idx = 0; idx < projectsSpec.length; idx++) {
    const pSpec = projectsSpec[idx];

    // Create / Upsert Project
    const project = await prisma.project.upsert({
      where: { code: pSpec.code },
      update: {
        name: pSpec.name,
        sector: pSpec.sector,
        stateCode: pSpec.stateCode,
        stateName: pSpec.stateName,
        districtCodes: pSpec.districtCodes,
        districtNames: pSpec.districtNames,
        piaName: pSpec.piaName,
        requiredLand: pSpec.requiredLand,
        estimatedCost: pSpec.estimatedCost,
        affectedCount: pSpec.affectedCount,
        status: pSpec.status,
      },
      create: {
        code: pSpec.code,
        name: pSpec.name,
        sector: pSpec.sector,
        stateCode: pSpec.stateCode,
        stateName: pSpec.stateName,
        districtCodes: pSpec.districtCodes,
        districtNames: pSpec.districtNames,
        piaName: pSpec.piaName,
        requiredLand: pSpec.requiredLand,
        estimatedCost: pSpec.estimatedCost,
        affectedCount: pSpec.affectedCount,
        status: pSpec.status,
      },
    });

    await addAuditEvent('pia.nh44@nhai.gov.in', 'CREATE_PROJECT', 'Project', project.id, { name: project.name, requiredLand: project.requiredLand });

    // Proposal Creation
    const propTitle = `${pSpec.code} Proposal & Alignment Package`;
    let proposal = await prisma.proposal.findFirst({ where: { projectId: project.id, title: propTitle } });
    if (!proposal) {
      proposal = await prisma.proposal.create({
        data: {
          projectId: project.id,
          title: propTitle,
          landRequired: pSpec.requiredLand,
          alignmentGeo: {
            type: 'LineString',
            coordinates: [
              [pSpec.centerLng - 0.01, pSpec.centerLat - 0.01],
              [pSpec.centerLng, pSpec.centerLat],
              [pSpec.centerLng + 0.01, pSpec.centerLat + 0.01],
            ],
          },
          status: pSpec.status === ProjectStatus.DRAFT ? ProposalStatus.DRAFT : ProposalStatus.APPROVED,
          submittedAt: new Date(Date.now() - (30 - idx) * 24 * 60 * 60 * 1000),
        },
      });
    }
    totalProposalsCount++;
    await addAuditEvent('pia.nh44@nhai.gov.in', 'SUBMIT_PROPOSAL', 'Proposal', proposal.id, { status: proposal.status });

    // Workflow Instance Creation
    let stageName = 'Proposal Scrutiny';
    if (pSpec.status === ProjectStatus.SUBMITTED) stageName = 'SIA Clearance';
    if (pSpec.status === ProjectStatus.UNDER_SCRUTINY) stageName = 'Preliminary Notification (Sec 11)';
    if (pSpec.status === ProjectStatus.APPROVED) stageName = 'Award Declaration (Sec 23)';
    if (pSpec.status === ProjectStatus.ACTIVE) stageName = 'Compensation Disbursement';
    if (pSpec.status === ProjectStatus.ON_HOLD) stageName = 'Objection Hearing (Sec 15)';
    if (pSpec.status === ProjectStatus.COMPLETED) stageName = 'Completed';

    let wfInstance = await prisma.workflowInstance.findFirst({ where: { projectId: project.id } });
    if (!wfInstance) {
      wfInstance = await prisma.workflowInstance.create({
        data: {
          projectId: project.id,
          templateId: templateLARR.id,
          currentStage: stageName,
          status: pSpec.status === ProjectStatus.COMPLETED ? 'COMPLETED' : 'IN_PROGRESS',
        },
      });
    }
    totalWfInstancesCount++;

    // Create 3 WorkflowActions per instance
    const pastStages = ['Proposal Scrutiny', 'SIA Clearance', stageName];
    for (let sIdx = 0; sIdx < pastStages.length - 1; sIdx++) {
      let wfAction = await prisma.workflowAction.findFirst({
        where: { instanceId: wfInstance.id, fromStage: pastStages[sIdx], toStage: pastStages[sIdx + 1] },
      });
      if (!wfAction) {
        wfAction = await prisma.workflowAction.create({
          data: {
            instanceId: wfInstance.id,
            actionName: `Advance Stage to ${pastStages[sIdx + 1]}`,
            performedBy: userMap['district.kanpur@up.gov.in']?.id || userMap['admin@rnlam.gov.in'].id,
            fromStage: pastStages[sIdx],
            toStage: pastStages[sIdx + 1],
            remarks: `Stage advanced naturally under statutory requirements for ${pSpec.code}.`,
          },
        });
        totalWfActionsCount++;
        await addAuditEvent('district.kanpur@up.gov.in', 'WORKFLOW_ACTION', 'WorkflowInstance', wfInstance.id, { fromStage: pastStages[sIdx], toStage: pastStages[sIdx + 1] });
      }
    }

    // CREATE 10 PARCELS PER PROJECT (15 projects * 10 = 150 Parcels)
    let projectAcquiredLandSum = 0;
    let projectPossessedLandSum = 0;

    for (let pNo = 1; pNo <= 10; pNo++) {
      const parcelNum = `PARCEL-${pSpec.stateCode}-${idx + 1}0${pNo}`;
      const khasraNum = `${70 + pNo}/${pNo}B`;
      const village = `Village-${pSpec.districtNames[0]}-${pNo}`;
      const owner = `Synthetic Owner ${pNo} (${pSpec.districtNames[0]})`;
      const parcelArea = Number((1.2 + pNo * 0.45).toFixed(2));

      // Explicitly typed variables for Prisma enums
      let pStatus: ParcelStatus = ParcelStatus.PROPOSED;
      let vStatus: VerificationStatus = VerificationStatus.UNVERIFIED;
      let acqArea = 0;
      let posArea = 0;

      if (pSpec.status === ProjectStatus.SUBMITTED || pSpec.status === ProjectStatus.UNDER_SCRUTINY) {
        pStatus = pNo <= 5 ? ParcelStatus.VERIFIED : ParcelStatus.VERIFICATION_PENDING;
        vStatus = pNo <= 5 ? VerificationStatus.OFFICER_VERIFIED : VerificationStatus.SYSTEM_MATCHED;
        if (pNo <= 5) acqArea = parcelArea;
      } else if (pSpec.status === ProjectStatus.APPROVED || pSpec.status === ProjectStatus.ON_HOLD) {
        pStatus = pNo <= 7 ? ParcelStatus.AWARDED : ParcelStatus.NOTIFIED;
        vStatus = VerificationStatus.OFFICER_VERIFIED;
        acqArea = parcelArea;
      } else if (pSpec.status === ProjectStatus.ACTIVE) {
        if (pNo <= 6) {
          pStatus = ParcelStatus.POSSESSION_TAKEN;
          vStatus = VerificationStatus.OFFICER_VERIFIED;
          acqArea = parcelArea;
          posArea = parcelArea;
        } else if (pNo <= 8) {
          pStatus = ParcelStatus.COMPENSATION_PAID;
          vStatus = VerificationStatus.OFFICER_VERIFIED;
          acqArea = parcelArea;
        } else {
          pStatus = ParcelStatus.COMPENSATION_PENDING;
          vStatus = VerificationStatus.OFFICER_VERIFIED;
          acqArea = parcelArea;
        }
      } else if (pSpec.status === ProjectStatus.COMPLETED) {
        pStatus = ParcelStatus.HANDED_TO_PIA;
        vStatus = VerificationStatus.OFFICER_VERIFIED;
        acqArea = parcelArea;
        posArea = parcelArea;
      }

      projectAcquiredLandSum += acqArea;
      projectPossessedLandSum += posArea;

      // Valid polygon GeoJSON centered in district
      const polygonGeo = generatePolygonGeoJson(pSpec.centerLat + pNo * 0.003, pSpec.centerLng + pNo * 0.003);

      let parcel = await prisma.parcel.findFirst({ where: { projectId: project.id, parcelNumber: parcelNum } });
      if (!parcel) {
        parcel = await prisma.parcel.create({
          data: {
            projectId: project.id,
            parcelNumber: parcelNum,
            khasraNumber: khasraNum,
            villageName: village,
            districtName: pSpec.districtNames[0],
            stateName: pSpec.stateName,
            totalArea: parcelArea,
            acquiredArea: acqArea,
            possessedArea: posArea,
            landOwnerName: owner,
            landClass: pNo % 2 === 0 ? 'Agricultural' : 'Commercial',
            status: pStatus,
            verificationState: vStatus,
            geometry: polygonGeo,
          },
        });
      } else {
        await prisma.parcel.update({
          where: { id: parcel.id },
          data: {
            acquiredArea: acqArea,
            possessedArea: posArea,
            status: pStatus,
            verificationState: vStatus,
            geometry: polygonGeo,
          },
        });
      }
      totalParcelsCount++;

      // Data Provenance
      await prisma.dataProvenance.create({
        data: {
          parcelId: parcel.id,
          fieldName: 'totalArea',
          value: `${parcelArea} ha`,
          source: `State Land Records API — ${pSpec.stateCode} (SYNTHETIC)`,
          sourceRecordId: `SYN-LR-${idx + 1}0${pNo}`,
          verificationStatus: vStatus,
        },
      });

      // Parcel Verification (Field Officer check)
      if (vStatus === VerificationStatus.OFFICER_VERIFIED) {
        let pVer = await prisma.parcelVerification.findFirst({ where: { parcelId: parcel.id } });
        if (!pVer) {
          await prisma.parcelVerification.create({
            data: {
              parcelId: parcel.id,
              verifiedBy: userMap['field.nagpur@mh.gov.in']?.id || userMap['admin@rnlam.gov.in'].id,
              latitude: pSpec.centerLat + pNo * 0.003,
              longitude: pSpec.centerLng + pNo * 0.003,
              photoUrl: `https://minio.rnlam.gov.in/rnlam-documents/photos/${parcel.parcelNumber}.jpg`,
              notes: 'Boundary verified with ground DGPS control points.',
              status: VerificationStatus.OFFICER_VERIFIED,
            },
          });
          await addAuditEvent('field.nagpur@mh.gov.in', 'VERIFY_PARCEL', 'Parcel', parcel.id, { status: pStatus, verificationState: vStatus });
        }
      }

      // Objections & Hearings (2 Objections per project = 30 Objections total)
      if ((pNo === 3 || pNo === 7) && idx % 2 === 0) {
        let obj = await prisma.objection.findFirst({ where: { parcelId: parcel.id } });
        if (!obj) {
          obj = await prisma.objection.create({
            data: {
              parcelId: parcel.id,
              applicant: owner,
              category: pNo === 3 ? 'Compensation Amount' : 'Land Measurement',
              description: 'Claiming higher valuation due to multi-crop agricultural productivity.',
              status: ObjectionStatus.HEARING_SCHEDULED,
            },
          });
          totalObjectionsCount++;

          await prisma.hearing.create({
            data: {
              objectionId: obj.id,
              hearingDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              venue: `CALA Office Courtroom, ${pSpec.districtNames[0]}`,
              presidingOfficer: `Special Land Acquisition Officer, ${pSpec.districtNames[0]}`,
              status: 'SCHEDULED',
            },
          });
          totalHearingsCount++;
        }
      }

      // Awards, Compensation & PaymentReferences
      if (pStatus === ParcelStatus.AWARDED || pStatus === ParcelStatus.COMPENSATION_PENDING || pStatus === ParcelStatus.COMPENSATION_PAID || pStatus === ParcelStatus.POSSESSION_TAKEN || pStatus === ParcelStatus.HANDED_TO_PIA) {
        const valLand = Number((parcelArea * 0.85).toFixed(2));
        const valAssets = Number((parcelArea * 0.15).toFixed(2));
        const solatium = Number((valLand * 1.0).toFixed(2));
        const totAward = Number((valLand + valAssets + solatium).toFixed(2));

        const awardNum = `AWARD-${pSpec.stateCode}-2026-00${idx + 1}0${pNo}`;
        let award = await prisma.award.findFirst({ where: { awardNumber: awardNum } });
        if (!award) {
          award = await prisma.award.create({
            data: {
              awardNumber: awardNum,
              projectId: project.id,
              parcelId: parcel.id,
              valuationLand: valLand,
              valuationAssets: valAssets,
              solatiumAmount: solatium,
              totalAward: totAward,
              status: 'DECLARED',
            },
          });
          totalAwardsCount++;
          await addAuditEvent('district.kanpur@up.gov.in', 'AWARD_DECLARED', 'Award', award.id, { awardNumber: awardNum, totalAward: totAward });
        }

        // Compensation
        const compStatus = (pStatus === ParcelStatus.COMPENSATION_PAID || pStatus === ParcelStatus.POSSESSION_TAKEN || pStatus === ParcelStatus.HANDED_TO_PIA) ? CompensationStatus.PAID : CompensationStatus.APPROVED;

        let comp = await prisma.compensation.findFirst({ where: { awardId: award.id } });
        if (!comp) {
          comp = await prisma.compensation.create({
            data: {
              projectId: project.id,
              parcelId: parcel.id,
              awardId: award.id,
              beneficiaryName: owner,
              bankAccount: `XXXX-XXXX-${4000 + pNo}`,
              ifscCode: 'SBIN0004521',
              amount: totAward,
              status: compStatus,
            },
          });
          totalCompCasesCount++;
          await addAuditEvent('finance.treasury@mh.gov.in', 'COMPENSATION_APPROVED', 'Compensation', comp.id, { amount: totAward, status: compStatus });
        }

        // PaymentReference
        if (compStatus === CompensationStatus.PAID) {
          const utr = `DEMO-PFMS-UTR-2026-${idx + 1}0${pNo}`;
          let payRef = await prisma.paymentReference.findFirst({ where: { compensationId: comp.id } });
          if (!payRef) {
            await prisma.paymentReference.create({
              data: {
                compensationId: comp.id,
                utrNumber: utr,
                gatewaySource: 'PFMS_TREASURY_MOCK',
                amount: totAward,
                status: 'SUCCESS',
              },
            });
            totalPayRefsCount++;
            await addAuditEvent('finance.treasury@mh.gov.in', 'PAYMENT_COMPLETED', 'PaymentReference', comp.id, { utrNumber: utr, amount: totAward });
          }
        }
      }

      // Affected Families, R&R Cases & Deliveries (3 Families per project = 45 Families total)
      if (pNo <= 3) {
        const idHashStr = `HASH_AADHAAR_DEMO_${idx + 1}0${pNo}`;
        let family = await prisma.affectedFamily.findFirst({ where: { idHash: idHashStr } });
        if (!family) {
          family = await prisma.affectedFamily.create({
            data: {
              headName: owner,
              familySize: 4 + (pNo % 3),
              idHash: idHashStr,
              villageName: village,
              isVulnerable: pNo % 3 === 0,
            },
          });
          totalFamiliesCount++;
        }

        let rrCase = await prisma.rRCase.findFirst({ where: { projectId: project.id, familyId: family.id } });
        if (!rrCase) {
          const rrStat = pSpec.status === ProjectStatus.COMPLETED ? RRStatus.COMPLETED : RRStatus.BENEFIT_DELIVERED;
          rrCase = await prisma.rRCase.create({
            data: {
              projectId: project.id,
              parcelId: parcel.id,
              familyId: family.id,
              status: rrStat,
            },
          });
          totalRRCasesCount++;

          const rrDeliv = await prisma.rRDelivery.create({
            data: {
              caseId: rrCase.id,
              benefitName: pNo % 2 === 0 ? 'One-Time Resettlement Allowance (₹50,000)' : 'Alternative Housing Unit Allotment',
              remarks: 'Disbursed directly under R&R scheme guidelines.',
            },
          });
          totalRRDelivsCount++;
          await addAuditEvent('rr.officer@mh.gov.in', 'BENEFIT_DELIVERED', 'RRCase', rrCase.id, { benefitName: rrDeliv.benefitName });
        }
      }

      // Possession Records
      if (pStatus === ParcelStatus.POSSESSION_TAKEN || pStatus === ParcelStatus.HANDED_TO_PIA) {
        let poss = await prisma.possession.findFirst({ where: { projectId: project.id, parcelId: parcel.id } });
        if (!poss) {
          const possStat = pStatus === ParcelStatus.HANDED_TO_PIA ? PossessionStatus.HANDED_TO_PIA : PossessionStatus.POSSESSION_TAKEN;
          await prisma.possession.create({
            data: {
              projectId: project.id,
              parcelId: parcel.id,
              status: possStat,
              takenDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
              handoverDate: possStat === PossessionStatus.HANDED_TO_PIA ? new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) : undefined,
              authority: `District Collector & Magistrate, ${pSpec.districtNames[0]}`,
              latitude: pSpec.centerLat + pNo * 0.003,
              longitude: pSpec.centerLng + pNo * 0.003,
              remarks: `Physical land possession certificate issued for ${parcel.parcelNumber}.`,
            },
          });
          totalPossessionsCount++;
          await addAuditEvent('district.kanpur@up.gov.in', 'POSSESSION_RECORDED', 'Possession', parcel.id, { status: possStat });
        }
      }

      // Documents (3 Documents per project)
      if (pNo <= 3) {
        const docName = `SYN-DOC-${pSpec.stateCode}-${idx + 1}0${pNo}.pdf`;
        let doc = await prisma.document.findFirst({ where: { fileName: docName } });
        if (!doc) {
          await prisma.document.create({
            data: {
              fileName: docName,
              minioKey: `rnlam-documents/synthetic-docs/${docName}`,
              mimeType: 'application/pdf',
              fileSize: 1024 * 250,
              bucket: 'rnlam-documents',
              projectId: project.id,
              parcelId: parcel.id,
              uploadedBy: userMap['pia.nh44@nhai.gov.in']?.id || userMap['admin@rnlam.gov.in'].id,
            },
          });
          totalDocumentsCount++;
        }
      }
    } // end parcel loop

    // Update project metrics from actual sum of parcels
    // Ensure requiredLand >= acquiredLand >= possessedLand
    let safeAcquired = Number(projectAcquiredLandSum.toFixed(2));
    let safePossessed = Number(projectPossessedLandSum.toFixed(2));
    let safeRequired = pSpec.requiredLand;
    if (safeAcquired > safeRequired) safeRequired = safeAcquired + 100;

    await prisma.project.update({
      where: { id: project.id },
      data: {
        requiredLand: safeRequired,
        acquiredLand: safeAcquired,
        possessedLand: safePossessed,
      },
    });

    // SLA Tasks (3 per project)
    for (let slaNo = 1; slaNo <= 3; slaNo++) {
      const taskName = `Statutory Task ${slaNo}: Scrutiny Package for ${pSpec.code}`;
      let slaTask = await prisma.sLATask.findFirst({ where: { projectId: project.id, taskName } });
      if (!slaTask) {
        await prisma.sLATask.create({
          data: {
            projectId: project.id,
            taskName,
            assignedRole: RoleName.DISTRICT_OFFICER,
            slaDays: 15,
            startDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
            targetDate: new Date(Date.now() + (slaNo === 1 ? -5 : 5) * 24 * 60 * 60 * 1000),
            isBreached: slaNo === 1,
            completedDate: slaNo === 3 ? new Date() : undefined,
          },
        });
        totalSlaTasksCount++;
      }
    }

    // Statutory Milestones (4 per project = 60 Milestones total)
    const milestonesSpec = [
      { name: 'Preliminary Notification (Section 11 / 3A)', law: 'RFCTLARR Act 2013 / NH Act 1956' },
      { name: 'Objections & Hearing Window (Section 15 / 3C)', law: 'RFCTLARR Act 2013 / NH Act 1956' },
      { name: 'Declaration of Acquisition (Section 19 / 3D)', law: 'RFCTLARR Act 2013 / NH Act 1956' },
      { name: 'Final Award Declaration (Section 23 / 3G)', law: 'RFCTLARR Act 2013 / NH Act 1956' },
    ];

    for (let mIdx = 0; mIdx < milestonesSpec.length; mIdx++) {
      const mSpec = milestonesSpec[mIdx];
      let milestone = await prisma.statutoryMilestone.findFirst({ where: { projectId: project.id, name: mSpec.name } });
      if (!milestone) {
        let mStatus: MilestoneStatus = MilestoneStatus.UPCOMING;
        if (pSpec.status === ProjectStatus.COMPLETED) mStatus = MilestoneStatus.COMPLETED;
        else if (pSpec.status === ProjectStatus.ACTIVE && mIdx <= 2) mStatus = MilestoneStatus.COMPLETED;
        else if (pSpec.status === ProjectStatus.UNDER_SCRUTINY && mIdx === 0) mStatus = MilestoneStatus.DUE_SOON;

        await prisma.statutoryMilestone.create({
          data: {
            projectId: project.id,
            name: mSpec.name,
            referenceLaw: mSpec.law,
            deadlineDate: new Date(Date.now() + (mIdx - 1) * 15 * 24 * 60 * 60 * 1000),
            status: mStatus,
          },
        });
        totalMilestonesCount++;
      }
    }

    // AI Risk Assessment (1 per project)
    let risk = await prisma.riskAssessment.findFirst({ where: { projectId: project.id } });
    if (!risk) {
      let score = 25.0;
      let level = 'LOW';
      if (pSpec.status === ProjectStatus.UNDER_SCRUTINY || pSpec.status === ProjectStatus.ON_HOLD) {
        score = 68.5;
        level = 'HIGH';
      } else if (pSpec.status === ProjectStatus.ACTIVE) {
        score = 42.0;
        level = 'MEDIUM';
      }

      await prisma.riskAssessment.create({
        data: {
          projectId: project.id,
          riskScore: score,
          riskLevel: level,
          contributingFactors: [
            `Objection backlog in district ${pSpec.districtNames[0]}`,
            `Statutory milestone deadline proximity under ${milestonesSpec[0].law}`,
            `Compensation disbursement progress monitoring`,
          ],
          recommendation: `Accelerate CALA hearings and expedite compensation payments in ${pSpec.districtNames[0]}.`,
        },
      });
      totalRiskAssessmentsCount++;
    }

    // Notifications (3 per project)
    for (let nNo = 1; nNo <= 3; nNo++) {
      const notifTitle = `System Alert: ${pSpec.code} Update ${nNo}`;
      let notif = await prisma.notification.findFirst({ where: { title: notifTitle } });
      if (!notif) {
        await prisma.notification.create({
          data: {
            userId: userMap['cala.nagpur@mh.gov.in']?.id || userMap['admin@rnlam.gov.in'].id,
            role: RoleName.DISTRICT_OFFICER,
            title: notifTitle,
            message: `Action required for project ${pSpec.name} stage: ${stageName}.`,
            type: nNo === 1 ? 'SLA_BREACH' : nNo === 2 ? 'STATUTORY_DEADLINE' : 'APPROVAL',
          },
        });
        totalNotificationsCount++;
      }
    }
  } // end project loop

  console.log('\n========================================================');
  console.log('✅ SYNTHETIC NATIONAL DEMO DATASET SEEDED SUCCESSFULLY');
  console.log('========================================================');
  console.log(`  Projects: ${projectsSpec.length}`);
  console.log(`  States: 7 (MH, UP, RJ, KA, MP, GJ, OD)`);
  console.log(`  Districts: 20`);
  console.log(`  Users: ${usersData.length} (covering all 11 roles)`);
  console.log(`  Parcels: ${totalParcelsCount}`);
  console.log(`  Proposals: ${totalProposalsCount}`);
  console.log(`  Workflow Instances: ${totalWfInstancesCount}`);
  console.log(`  Workflow Actions: ${totalWfActionsCount}`);
  console.log(`  Objections: ${totalObjectionsCount}`);
  console.log(`  Hearings: ${totalHearingsCount}`);
  console.log(`  Awards: ${totalAwardsCount}`);
  console.log(`  Compensation Cases: ${totalCompCasesCount}`);
  console.log(`  Payment References: ${totalPayRefsCount}`);
  console.log(`  Affected Families: ${totalFamiliesCount}`);
  console.log(`  R&R Cases: ${totalRRCasesCount}`);
  console.log(`  R&R Deliveries: ${totalRRDelivsCount}`);
  console.log(`  Possession Records: ${totalPossessionsCount}`);
  console.log(`  Documents: ${totalDocumentsCount}`);
  console.log(`  SLA Tasks: ${totalSlaTasksCount}`);
  console.log(`  Statutory Milestones: ${totalMilestonesCount}`);
  console.log(`  Risk Assessments: ${totalRiskAssessmentsCount}`);
  console.log(`  Notifications: ${totalNotificationsCount}`);
  console.log(`  Audit Events Logged: ${createdAuditEvents.length} (SHA-256 hash chain continuous)`);
  console.log('========================================================\n');
}

if (require.main === module) {
  seedDemoDataset()
    .catch((e) => {
      console.error('❌ Seeding error:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

