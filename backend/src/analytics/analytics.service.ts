import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CompensationStatus, RRStatus, MilestoneStatus, RoleName } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getDashboardKpis() {
    const totalProjects = await this.prisma.project.count();

    const projAggregate = await this.prisma.project.aggregate({
      _sum: {
        requiredLand: true,
        acquiredLand: true,
        possessedLand: true,
        affectedCount: true,
        estimatedCost: true,
      },
    });

    const totalLandRequiredHa = projAggregate._sum.requiredLand || 0;
    const totalLandAcquiredHa = projAggregate._sum.acquiredLand || 0;
    const totalLandPossessedHa = projAggregate._sum.possessedLand || 0;
    const landAcquiredPercentage = totalLandRequiredHa > 0 ? Number(((totalLandAcquiredHa / totalLandRequiredHa) * 100).toFixed(1)) : 0;
    const landPossessedPercentage = totalLandRequiredHa > 0 ? Number(((totalLandPossessedHa / totalLandRequiredHa) * 100).toFixed(1)) : 0;

    // Financial KPIs
    const paidCompensationAgg = await this.prisma.compensation.aggregate({
      where: { status: CompensationStatus.PAID },
      _sum: { amount: true },
    });
    const totalCompensationPaidCr = paidCompensationAgg._sum.amount || 0;

    const totalCompensationBudgetCr = projAggregate._sum.estimatedCost || 0;
    const compensationPaidPercentage = totalCompensationBudgetCr > 0 ? Number(((totalCompensationPaidCr / totalCompensationBudgetCr) * 100).toFixed(1)) : 0;

    // R&R KPIs
    const totalRRCases = await this.prisma.rRCase.count();
    const completedRRCases = await this.prisma.rRCase.count({
      where: { status: RRStatus.COMPLETED },
    });
    const rrCompletedPercentage = totalRRCases > 0 ? Number(((completedRRCases / totalRRCases) * 100).toFixed(1)) : 0;

    // SLA & Milestones
    const overdueMilestones = await this.prisma.statutoryMilestone.count({
      where: { status: MilestoneStatus.OVERDUE },
    });
    const dueSoonMilestones = await this.prisma.statutoryMilestone.count({
      where: { status: MilestoneStatus.DUE_SOON },
    });

    // High risk projects
    const highRiskProjects = await this.prisma.riskAssessment.count({
      where: { riskLevel: { in: ['HIGH', 'CRITICAL'] } },
    });

    return {
      projects: {
        total: totalProjects,
        highRisk: highRiskProjects,
      },
      land: {
        requiredHa: totalLandRequiredHa,
        acquiredHa: totalLandAcquiredHa,
        possessedHa: totalLandPossessedHa,
        acquiredPercentage: landAcquiredPercentage,
        possessedPercentage: landPossessedPercentage,
      },
      financials: {
        budgetCr: totalCompensationBudgetCr,
        paidCr: Number(totalCompensationPaidCr.toFixed(2)),
        paidPercentage: compensationPaidPercentage,
      },
      rr: {
        totalFamilies: projAggregate._sum.affectedCount || 0,
        totalCases: totalRRCases,
        completedCases: completedRRCases,
        completionPercentage: rrCompletedPercentage,
      },
      governance: {
        overdueMilestones,
        dueSoonMilestones,
      },
    };
  }

  async getProjectAnalytics(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        parcels: {
          select: {
            id: true,
            parcelNumber: true,
            status: true,
            totalArea: true,
            acquiredArea: true,
            possessedArea: true,
          },
        },
        workflowInstances: {
          include: { actions: { orderBy: { createdAt: 'desc' }, take: 5 } },
        },
        statutoryMilestones: { orderBy: { deadlineDate: 'asc' } },
        slaTasks: true,
        riskAssessments: { orderBy: { assessedAt: 'desc' }, take: 1 },
      },
    });

    if (!project) {
      return null;
    }

    const parcelStatusBreakdown = project.parcels.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      project: {
        id: project.id,
        code: project.code,
        name: project.name,
        stateName: project.stateName,
        requiredLand: project.requiredLand,
        acquiredLand: project.acquiredLand,
        possessedLand: project.possessedLand,
        possessionPercentage: project.requiredLand > 0 ? (project.possessedLand / project.requiredLand) * 100 : 0,
        status: project.status,
      },
      parcelCount: project.parcels.length,
      parcelStatusBreakdown,
      workflow: project.workflowInstances[0] || null,
      milestones: project.statutoryMilestones,
      latestRisk: project.riskAssessments[0] || null,
    };
  }

  async recordAnalyticsQuery(question: string, sqlQuery: string, userRole: RoleName) {
    return this.prisma.analyticsQuery.create({
      data: {
        question,
        sqlQuery,
        userRole,
      },
    });
  }

  async getStatesAnalytics() {
    const jurisdictions = await this.prisma.jurisdiction.findMany({
      select: { stateCode: true, stateName: true },
      distinct: ['stateCode'],
    });

    const projects = await this.prisma.project.findMany();

    return jurisdictions.map((j) => {
      const stateProj = projects.filter((p) => p.stateName === j.stateName || p.code.includes(j.stateCode));
      const totalReq = stateProj.reduce((acc, p) => acc + p.requiredLand, 0);
      const totalAcq = stateProj.reduce((acc, p) => acc + p.acquiredLand, 0);
      return {
        stateCode: j.stateCode,
        stateName: j.stateName,
        totalProjects: stateProj.length,
        requiredLand: totalReq,
        acquiredLand: totalAcq,
        acquisitionPercentage: totalReq > 0 ? Math.round((totalAcq / totalReq) * 100) : 0,
      };
    });
  }

  async getDistrictsAnalytics(stateCode?: string) {
    const jurisdictions = await this.prisma.jurisdiction.findMany({
      where: stateCode ? { stateCode } : undefined,
    });

    const projects = await this.prisma.project.findMany();

    return jurisdictions.map((j) => {
      const distProj = projects.filter((p) => p.districtNames.includes(j.districtName));
      const totalReq = distProj.reduce((acc, p) => acc + p.requiredLand, 0);
      const totalAcq = distProj.reduce((acc, p) => acc + p.acquiredLand, 0);
      return {
        districtCode: j.districtCode,
        districtName: j.districtName,
        stateName: j.stateName,
        totalProjects: distProj.length,
        requiredLand: totalReq,
        acquiredLand: totalAcq,
        acquisitionPercentage: totalReq > 0 ? Math.round((totalAcq / totalReq) * 100) : 0,
      };
    });
  }
}
