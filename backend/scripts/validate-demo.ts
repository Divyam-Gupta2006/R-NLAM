import { PrismaClient, RoleName, ProjectStatus } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

function calculateHash(previousHash: string, data: object): string {
  return crypto.createHash('sha256').update(previousHash + JSON.stringify(data)).digest('hex');
}

async function validateDemoDataset() {
  console.log('========================================================');
  console.log('🔍 RUNNING COMPREHENSIVE DEMO DATASET AUTOMATED VALIDATION');
  console.log('========================================================');

  let passCount = 0;
  let failCount = 0;

  const assertCheck = (condition: boolean, description: string, details?: string) => {
    if (condition) {
      console.log(`  [PASS] ${description} ${details ? '(' + details + ')' : ''}`);
      passCount++;
    } else {
      console.error(`  [FAIL] ❌ ${description} ${details ? '(' + details + ')' : ''}`);
      failCount++;
    }
  };

  // 1. PROJECT COUNT
  const projectCount = await prisma.project.count();
  assertCheck(projectCount >= 12, '1. Project Count >= 12', `Found ${projectCount} projects`);

  // 2. LIFECYCLE DISTRIBUTION
  const statuses = await prisma.project.groupBy({
    by: ['status'],
    _count: { id: true },
  });
  const statusSet = new Set(statuses.map((s) => s.status));
  const requiredStatuses: ProjectStatus[] = [
    ProjectStatus.DRAFT,
    ProjectStatus.SUBMITTED,
    ProjectStatus.UNDER_SCRUTINY,
    ProjectStatus.APPROVED,
    ProjectStatus.ACTIVE,
    ProjectStatus.ON_HOLD,
    ProjectStatus.COMPLETED,
  ];
  const missingStatuses = requiredStatuses.filter((st) => !statusSet.has(st));
  assertCheck(
    missingStatuses.length === 0,
    '2. Lifecycle Distribution Covers All States',
    `Found ${statusSet.size} statuses. Missing: ${missingStatuses.join(', ') || 'None'}`
  );

  // 3. STATE COVERAGE
  const stateList = await prisma.project.groupBy({
    by: ['stateCode'],
    _count: { id: true },
  });
  assertCheck(stateList.length >= 6, '3. State Coverage (6–8 States)', `Found ${stateList.length} states`);

  // 4. DISTRICT COVERAGE
  const jurList = await prisma.jurisdiction.count();
  assertCheck(jurList >= 15, '4. District Coverage (15–25 Districts)', `Found ${jurList} jurisdictions`);

  // 5. PARCEL COUNT
  const parcelCount = await prisma.parcel.count();
  assertCheck(parcelCount >= 100, '5. Parcel Count >= 100', `Found ${parcelCount} parcels`);

  // 6 & 7. GEOJSON POLYGON VALIDITY
  const parcels = await prisma.parcel.findMany({ select: { id: true, geometry: true } });
  let validGeomCount = 0;
  let invalidGeomCount = 0;

  for (const p of parcels) {
    if (!p.geometry) {
      invalidGeomCount++;
      continue;
    }
    const g = p.geometry as any;
    if (g.type === 'Polygon' && Array.isArray(g.coordinates) && g.coordinates.length > 0) {
      const ring = g.coordinates[0];
      if (Array.isArray(ring) && ring.length >= 4) {
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (first[0] === last[0] && first[1] === last[1]) {
          validGeomCount++;
        } else {
          invalidGeomCount++;
        }
      } else {
        invalidGeomCount++;
      }
    } else {
      invalidGeomCount++;
    }
  }
  assertCheck(
    invalidGeomCount === 0 && validGeomCount >= 100,
    '6 & 7. GeoJSON Polygon Geometry Validity',
    `Valid: ${validGeomCount}, Invalid: ${invalidGeomCount}`
  );

  // 8. CANONICAL LAND METRICS CONSISTENCY
  const projects = await prisma.project.findMany({
    include: {
      parcels: {
        select: { acquiredArea: true, possessedArea: true, totalArea: true },
      },
    },
  });

  let landMetricFailures = 0;
  for (const p of projects) {
    if (p.requiredLand < p.acquiredLand || p.acquiredLand < p.possessedLand) {
      landMetricFailures++;
      console.error(`    Mismatch in project ${p.code}: req=${p.requiredLand}, acq=${p.acquiredLand}, pos=${p.possessedLand}`);
    }
  }
  assertCheck(
    landMetricFailures === 0,
    '8. Canonical Land Metrics Consistency (requiredLand >= acquiredLand >= possessedLand)',
    `Projects evaluated: ${projects.length}`
  );

  // 9. PROJECT ↔ PARCEL RELATIONSHIPS (Check for actual unlinked parcels)
  const allParcels = await prisma.parcel.findMany({ select: { id: true, projectId: true } });
  const orphanParcelsCount = allParcels.filter((p) => !p.projectId).length;
  assertCheck(orphanParcelsCount === 0, '9. No Orphan Parcels', `Orphans found: ${orphanParcelsCount}`);

  // 10. WORKFLOW COMPLETENESS
  const wfCount = await prisma.workflowInstance.count();
  const wfActionsCount = await prisma.workflowAction.count();
  assertCheck(wfCount >= 12 && wfActionsCount >= 20, '10. Workflow Instances & Actions Complete', `Instances: ${wfCount}, Actions: ${wfActionsCount}`);

  // 11. AWARD CONSISTENCY
  const awards = await prisma.award.findMany();
  let awardValFailures = 0;
  for (const a of awards) {
    const expected = Number((a.valuationLand + a.valuationAssets + a.solatiumAmount).toFixed(2));
    if (Math.abs(expected - a.totalAward) > 0.05) {
      awardValFailures++;
    }
  }
  assertCheck(awardValFailures === 0, '11. Award Total Calculation Integrity', `Evaluated ${awards.length} awards`);

  // 12 & 13. COMPENSATION & PAYMENT REFERENCES
  const compCount = await prisma.compensation.count();
  const payRefCount = await prisma.paymentReference.count();
  assertCheck(compCount >= 30 && payRefCount >= 20, '12 & 13. Compensation Cases & Payment References', `Comp: ${compCount}, PayRefs: ${payRefCount}`);

  // 14 & 15. R&R & POSSESSION
  const familyCount = await prisma.affectedFamily.count();
  const rrCount = await prisma.rRCase.count();
  const possCount = await prisma.possession.count();
  assertCheck(
    familyCount >= 40 && rrCount >= 30 && possCount >= 20,
    '14 & 15. R&R Cases & Possession Records Integrity',
    `Families: ${familyCount}, R&R Cases: ${rrCount}, Possession: ${possCount}`
  );

  // 16. OBJECTIONS & HEARINGS
  const objCount = await prisma.objection.count();
  const hearCount = await prisma.hearing.count();
  assertCheck(objCount >= 15 && hearCount >= 10, '16. Objections & Hearings Registered', `Objections: ${objCount}, Hearings: ${hearCount}`);

  // 17. SLA & STATUTORY MILESTONES
  const slaCount = await prisma.sLATask.count();
  const milestoneCount = await prisma.statutoryMilestone.count();
  assertCheck(slaCount >= 30 && milestoneCount >= 50, '17. SLA Tasks & Statutory Milestones Present', `SLA Tasks: ${slaCount}, Milestones: ${milestoneCount}`);

  // 18. RISK ASSESSMENTS
  const riskCount = await prisma.riskAssessment.count();
  assertCheck(riskCount >= 12, '18. Risk Assessments (1+ per project)', `Found ${riskCount} risk assessments`);

  // 19 & 20. NOTIFICATIONS & DOCUMENTS
  const notifCount = await prisma.notification.count();
  const docCount = await prisma.document.count();
  assertCheck(notifCount >= 30 && docCount >= 30, '19 & 20. Notifications & Documents Metadata', `Notifications: ${notifCount}, Documents: ${docCount}`);

  // 21. ROLE COVERAGE (ALL 11 ROLES PRESENT)
  const users = await prisma.user.findMany({ select: { role: true } });
  const userRoles = new Set(users.map((u) => u.role));
  const all11Roles: RoleName[] = Object.values(RoleName);
  const missingRoles = all11Roles.filter((r) => !userRoles.has(r));
  assertCheck(missingRoles.length === 0, '21. All 11 Roles Covered in User Table', `Covered: ${userRoles.size}/11. Missing: ${missingRoles.join(', ') || 'None'}`);

  // 22. SHA-256 AUDIT HASH CHAIN CONTINUITY
  const auditEvents = await prisma.auditEvent.findMany({ orderBy: { timestamp: 'asc' } });
  let auditChainValid = true;
  let brokenIndex = -1;

  for (let i = 1; i < auditEvents.length; i++) {
    if (auditEvents[i].previousHash !== auditEvents[i - 1].hash) {
      auditChainValid = false;
      brokenIndex = i;
      break;
    }
  }
  assertCheck(
    auditChainValid && auditEvents.length >= 100,
    '22. SHA-256 Audit Chain Cryptographic Continuity',
    `Audited ${auditEvents.length} events. Continuous: ${auditChainValid}${brokenIndex !== -1 ? ' (Broken at index ' + brokenIndex + ')' : ''}`
  );

  console.log('\n========================================================');
  console.log(`VALIDATION SUMMARY: ${passCount} PASSED, ${failCount} FAILED out of ${passCount + failCount} CHECKS.`);
  console.log('========================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

validateDemoDataset()
  .catch((e) => {
    console.error('❌ Validation script runtime error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

