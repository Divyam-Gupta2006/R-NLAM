import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectStatus } from '@prisma/client';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async findAll(filter: { stateCode?: string; districtCode?: string }) {
    const where: any = {};
    if (filter.stateCode) where.stateCode = filter.stateCode;
    if (filter.districtCode) where.districtCodes = { has: filter.districtCode };

    const projects = await this.prisma.project.findMany({
      where,
      include: {
        _count: {
          select: {
            parcels: true,
            proposals: true,
            awards: true,
            compensationCases: true,
            rrCases: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return projects.map((p) => ({
      ...p,
      acquisitionProgress: p.requiredLand > 0 ? (p.acquiredLand / p.requiredLand) * 100 : 0,
      possessionProgress: p.requiredLand > 0 ? (p.possessedLand / p.requiredLand) * 100 : 0,
    }));
  }

  async findOne(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        proposals: true,
        parcels: { take: 10 },
        workflowInstances: {
          include: {
            actions: {
              include: { user: { select: { name: true, role: true } } },
              take: 5,
            },
          },
        },
        statutoryMilestones: true,
        slaTasks: true,
        riskAssessments: { orderBy: { assessedAt: 'desc' }, take: 1 },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found.`);
    }

    return {
      ...project,
      acquisitionProgress: project.requiredLand > 0 ? (project.acquiredLand / project.requiredLand) * 100 : 0,
      possessionProgress: project.requiredLand > 0 ? (project.possessedLand / project.requiredLand) * 100 : 0,
    };
  }

  async create(data: {
    code: string;
    name: string;
    sector: string;
    stateCode: string;
    stateName: string;
    districtCodes: string[];
    districtNames: string[];
    piaName: string;
    requiredLand: number;
    estimatedCost: number;
  }) {
    const project = await this.prisma.project.create({
      data: {
        code: data.code,
        name: data.name,
        sector: data.sector,
        stateCode: data.stateCode,
        stateName: data.stateName,
        districtCodes: data.districtCodes,
        districtNames: data.districtNames,
        piaName: data.piaName,
        requiredLand: data.requiredLand,
        estimatedCost: data.estimatedCost,
        status: ProjectStatus.DRAFT,
      },
    });

    const defaultTemplate = await this.prisma.workflowTemplate.findFirst();
    if (defaultTemplate) {
      await this.prisma.workflowInstance.create({
        data: {
          projectId: project.id,
          templateId: defaultTemplate.id,
          currentStage: 'Proposal Scrutiny',
          status: 'IN_PROGRESS',
        },
      });
    }

    return project;
  }
}
