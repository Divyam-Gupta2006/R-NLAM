import { Injectable, NotFoundException } from '@nestjs/common';
import { ParcelStage, Prisma, ProjectStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.types';
import { rupeesToPaise } from '../common/money';
import { projectScope } from '../common/scope';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './projects.dto';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthUser, filter: { status?: ProjectStatus; stateCode?: string; q?: string }) {
    const where: Prisma.ProjectWhereInput = {
      AND: [
        projectScope(user),
        filter.status ? { status: filter.status } : {},
        filter.stateCode ? { stateCode: filter.stateCode } : {},
        filter.q ? { OR: [{ name: { contains: filter.q, mode: 'insensitive' } }, { code: { contains: filter.q, mode: 'insensitive' } }] } : {},
      ],
    };
    const projects = await this.prisma.project.findMany({ where, orderBy: { name: 'asc' } });
    const ids = projects.map((p) => p.id);
    const [stages, areas] = await Promise.all([
      this.prisma.parcel.groupBy({ by: ['projectId', 'stage'], where: { projectId: { in: ids } }, _count: { _all: true } }),
      this.prisma.parcel.groupBy({ by: ['projectId'], where: { projectId: { in: ids } }, _sum: { totalAreaHa: true, familiesAffected: true } }),
    ]);
    return projects.map((p) => {
      const byStage: Partial<Record<ParcelStage, number>> = {};
      for (const s of stages.filter((x) => x.projectId === p.id)) byStage[s.stage] = s._count._all;
      const parcels = Object.values(byStage).reduce((a, b) => a + (b ?? 0), 0);
      const done = (byStage.POSSESSION_TAKEN ?? 0) + (byStage.HANDED_OVER ?? 0);
      const area = areas.find((a) => a.projectId === p.id);
      return {
        ...p,
        parcelCount: parcels,
        parcelsByStage: byStage,
        notifiedAreaHa: area?._sum.totalAreaHa ?? 0,
        familiesAffected: area?._sum.familiesAffected ?? 0,
        possessionPct: parcels ? Math.round((done / parcels) * 1000) / 10 : 0,
      };
    });
  }

  async get(user: AuthUser, id: string) {
    const project = await this.prisma.project.findFirst({
      where: { AND: [{ id }, projectScope(user)] },
      include: {
        piaOrg: true,
        notices: { orderBy: { publishedOn: 'asc' }, include: { _count: { select: { parcels: true } } } },
        riskAssessments: { orderBy: { assessedAt: 'desc' }, take: 1 },
      },
    });
    if (!project) throw new NotFoundException('Project not found');

    const [stages, comp, families] = await Promise.all([
      this.prisma.parcel.groupBy({ by: ['stage'], where: { projectId: id }, _count: { _all: true }, _sum: { totalAreaHa: true } }),
      this.prisma.compensation.groupBy({ by: ['status'], where: { projectId: id }, _sum: { amountPaise: true }, _count: { _all: true } }),
      this.prisma.affectedFamily.count({ where: { projectId: id } }),
    ]);
    return {
      ...project,
      stages: stages.map((s) => ({ stage: s.stage, parcels: s._count._all, areaHa: s._sum.totalAreaHa ?? 0 })),
      compensation: comp.map((c) => ({ status: c.status, count: c._count._all, amountPaise: c._sum.amountPaise ?? 0n })),
      familiesAffected: families,
    };
  }

  async create(user: AuthUser, dto: CreateProjectDto) {
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          code: dto.code,
          name: dto.name,
          sector: dto.sector,
          description: dto.description,
          stateCode: dto.stateCode,
          stateName: dto.stateName,
          districtCodes: dto.districtCodes,
          districtNames: dto.districtNames,
          piaName: dto.piaName,
          requiredAreaHa: dto.requiredAreaHa,
          estimatedCostPaise: rupeesToPaise(dto.estimatedCostRupees),
          isSynthetic: false,
        },
      });
      await this.audit.append(tx, { actor: user, action: 'PROJECT_CREATED', entityType: 'Project', entityId: project.id, newState: project });
      return project;
    });
  }
}
