import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetDemoData() {
  console.log('========================================================');
  console.log('🧹 SAFE RESET OF SYNTHETIC DEMONSTRATION DATASET');
  console.log('   Notice: Only records matching DEMO- / SYN- namespaces will be removed.');
  console.log('========================================================');

  // Find demo projects
  const demoProjects = await prisma.project.findMany({
    where: {
      OR: [
        { code: { startsWith: 'DEMO-' } },
        { code: { startsWith: 'SYN-' } },
        { name: { contains: 'Synthetic Demo' } },
      ],
    },
    select: { id: true, code: true },
  });

  const demoProjectIds = demoProjects.map((p) => p.id);
  console.log(`Found ${demoProjects.length} synthetic demo projects to remove.`);

  if (demoProjectIds.length > 0) {
    // Delete in cascade order
    const delRisk = await prisma.riskAssessment.deleteMany({ where: { projectId: { in: demoProjectIds } } });
    const delSla = await prisma.sLATask.deleteMany({ where: { projectId: { in: demoProjectIds } } });
    const delMilestones = await prisma.statutoryMilestone.deleteMany({ where: { projectId: { in: demoProjectIds } } });
    const delDocs = await prisma.document.deleteMany({ where: { projectId: { in: demoProjectIds } } });

    const delPossession = await prisma.possession.deleteMany({ where: { projectId: { in: demoProjectIds } } });
    const delRR = await prisma.rRCase.deleteMany({ where: { projectId: { in: demoProjectIds } } });
    const delComp = await prisma.compensation.deleteMany({ where: { projectId: { in: demoProjectIds } } });
    const delAward = await prisma.award.deleteMany({ where: { projectId: { in: demoProjectIds } } });
    const delObj = await prisma.objection.deleteMany({
      where: { parcel: { projectId: { in: demoProjectIds } } },
    });
    const delParcels = await prisma.parcel.deleteMany({ where: { projectId: { in: demoProjectIds } } });
    const delWfActions = await prisma.workflowAction.deleteMany({
      where: { instance: { projectId: { in: demoProjectIds } } },
    });
    const delWfInstances = await prisma.workflowInstance.deleteMany({ where: { projectId: { in: demoProjectIds } } });
    const delProposals = await prisma.proposal.deleteMany({ where: { projectId: { in: demoProjectIds } } });
    const delProjects = await prisma.project.deleteMany({ where: { id: { in: demoProjectIds } } });

    console.log(`Successfully removed ${delProjects.count} demo projects and associated dependent records.`);
  } else {
    console.log('No synthetic demo projects found for deletion.');
  }

  // Safe delete demo orgs
  const delOrgs = await prisma.organization.deleteMany({
    where: { code: { startsWith: 'DEMO-ORG-' } },
  });
  console.log(`Removed ${delOrgs.count} demo organizations.`);

  console.log('========================================================');
  console.log('✅ DEMO RESET COMPLETED SAFELY (NON-DEMO DATA PRESERVED)');
  console.log('========================================================\n');
}

resetDemoData()
  .catch((e) => {
    console.error('❌ Safe reset failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

