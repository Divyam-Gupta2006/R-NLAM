import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, R } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { Clock } from '../common/clock';
import { parcelScope, projectScope } from '../common/scope';
import { GisGateService } from '../gis/gis-gate.service';
import { GisModule } from '../gis/gis.module';
import { PrismaService } from '../prisma/prisma.service';
import { StuckModule } from '../stuck/stuck.module';
import { WhyStuckService } from '../stuck/why-stuck.service';

const STAGES = ['IDENTIFIED', 'PRELIM_NOTIFIED', 'DECLARED', 'AWARDED', 'COMPENSATION_PAID', 'POSSESSION_TAKEN', 'HANDED_OVER', 'LAPSED', 'WITHDRAWN'] as const;

/**
 * One call for the national command screen (6.13): projects by stage, the ten
 * most stuck projects with their top brief, GIS-blocked parcels, SLA breaches
 * by state and families still waiting for R&R. Scoped like everything else,
 * so a state officer sees the same screen for their state.
 */
@Injectable()
export class CommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stuck: WhyStuckService,
    private readonly gate: GisGateService,
    private readonly clock: Clock,
  ) {}

  async summary(user: AuthUser) {
    const now = this.clock.now();
    const [projects, stageRows, bottlenecks, conflicts, slaTasks, rrCases] = await Promise.all([
      this.prisma.project.findMany({ where: projectScope(user), select: { id: true, code: true, name: true, stateName: true, sector: true, isSynthetic: true } }),
      this.prisma.parcel.groupBy({ by: ['projectId', 'stage'], where: parcelScope(user), _count: { _all: true } }),
      this.stuck.bottlenecks(user),
      this.gate.conflicts(user),
      this.prisma.sLATask.findMany({ where: { project: projectScope(user) }, include: { project: { select: { stateCode: true, stateName: true } } } }),
      this.prisma.rRCase.findMany({
        where: { parcel: parcelScope(user), grants: { some: { status: 'ASSIGNED' } } },
        select: { parcel: { select: { stateName: true, districtName: true } }, family: { select: { familySize: true } }, grants: { where: { status: 'ASSIGNED' }, select: { amountPaise: true } } },
      }),
    ]);

    // Projects by stage
    const byProject = new Map(projects.map((p) => [p.id, { ...p, total: 0, stages: Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<string, number> }]));
    for (const r of stageRows) {
      const p = byProject.get(r.projectId);
      if (!p) continue;
      p.stages[r.stage] = r._count._all;
      p.total += r._count._all;
    }

    // Top 10 stuck projects, each with the brief of its highest-priority bottleneck
    const grouped = new Map<string, typeof bottlenecks>();
    for (const b of bottlenecks) grouped.set(b.projectId, [...(grouped.get(b.projectId) ?? []), b]);
    const stuck = [...grouped.entries()]
      .map(([projectId, list]) => {
        const p = byProject.get(projectId);
        const top = list[0];
        return {
          id: projectId,
          code: p?.code ?? '',
          name: p?.name ?? '',
          stateName: p?.stateName ?? '',
          bottlenecks: list.length,
          topPriority: top.score.priority,
          exposurePaise: list.reduce((s, b) => s + b.exposurePaise, 0n),
          perDayPaise: list.reduce((s, b) => s + b.perDayPaise, 0n),
          families: list.reduce((s, b) => s + b.families, 0),
          byType: list.reduce<Record<string, number>>((m, b) => ({ ...m, [b.type]: (m[b.type] ?? 0) + 1 }), {}),
          top: { key: top.key, type: top.type, title: top.title, headline: top.brief.headline, action: top.brief.action, owner: top.brief.owner, deadline: top.brief.deadline },
        };
      })
      .sort((a, b) => b.topPriority - a.topPriority)
      .slice(0, 10);

    // GIS-blocked parcels
    const blocked = conflicts.filter((c) => c.blocked);
    const gisByDistrict = new Map<string, number>();
    for (const c of blocked) gisByDistrict.set(c.parcel.districtName, (gisByDistrict.get(c.parcel.districtName) ?? 0) + 1);
    const gis = {
      blockedParcels: blocked.length,
      blockedAreaHa: Math.round(blocked.reduce((s, c) => s + c.parcel.totalAreaHa, 0) * 100) / 100,
      families: blocked.reduce((s, c) => s + c.parcel.familiesAffected, 0),
      byDistrict: [...gisByDistrict.entries()].map(([district, parcels]) => ({ district, parcels })).sort((a, b) => b.parcels - a.parcels),
      examples: blocked.slice(0, 5).map((c) => ({
        parcelNumber: c.parcel.parcelNumber,
        villageName: c.parcel.villageName,
        districtName: c.parcel.districtName,
        overlaps: c.items.filter((i) => !i.satisfied).map((i) => ({ layer: i.layerName, kind: i.kind, overlapPct: i.overlapPct, missing: i.missing, citation: i.citation })),
      })),
    };

    // SLA breaches by state (live: open and past target)
    const slaByState = new Map<string, { stateCode: string; stateName: string; open: number; breached: number; worstOverdueDays: number }>();
    for (const t of slaTasks) {
      const key = t.project.stateCode;
      const row = slaByState.get(key) ?? { stateCode: key, stateName: t.project.stateName, open: 0, breached: 0, worstOverdueDays: 0 };
      if (!t.completedDate) {
        row.open += 1;
        if (t.targetDate < now) {
          row.breached += 1;
          row.worstOverdueDays = Math.max(row.worstOverdueDays, Math.floor((now.getTime() - t.targetDate.getTime()) / 86_400_000));
        }
      }
      slaByState.set(key, row);
    }
    const slaRows = [...slaByState.values()].sort((a, b) => b.breached - a.breached || b.open - a.open);

    // Families waiting for R&R
    const rrByState = new Map<string, { stateName: string; families: number; entitlements: number; pendingPaise: bigint }>();
    for (const c of rrCases) {
      const row = rrByState.get(c.parcel.stateName) ?? { stateName: c.parcel.stateName, families: 0, entitlements: 0, pendingPaise: 0n };
      row.families += 1;
      row.entitlements += c.grants.length;
      row.pendingPaise += c.grants.reduce((s, g) => s + (g.amountPaise ?? 0n), 0n);
      rrByState.set(c.parcel.stateName, row);
    }
    const rrRows = [...rrByState.values()].sort((a, b) => b.families - a.families);

    return {
      asOf: now,
      projectsByStage: [...byProject.values()].sort((a, b) => b.total - a.total),
      stuck,
      gis,
      sla: { open: slaRows.reduce((s, r) => s + r.open, 0), breached: slaRows.reduce((s, r) => s + r.breached, 0), byState: slaRows },
      rr: {
        familiesAwaiting: rrRows.reduce((s, r) => s + r.families, 0),
        entitlementsPending: rrRows.reduce((s, r) => s + r.entitlements, 0),
        pendingPaise: rrRows.reduce((s, r) => s + r.pendingPaise, 0n),
        byState: rrRows,
      },
    };
  }
}

@ApiTags('command')
@ApiBearerAuth()
@Roles(...R.OFFICIALS)
@Controller('command')
class CommandController {
  constructor(private readonly command: CommandService) {}

  @Get('summary')
  @ApiOperation({ summary: 'National command screen: projects by stage, top 10 stuck projects with briefs, GIS-blocked parcels, SLA breaches by state, families awaiting R&R (scoped)' })
  summary(@CurrentUser() user: AuthUser) {
    return this.command.summary(user);
  }
}

@Module({ imports: [StuckModule, GisModule], controllers: [CommandController], providers: [CommandService] })
export class CommandModule {}
