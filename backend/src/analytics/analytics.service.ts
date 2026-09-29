import { Injectable } from '@nestjs/common';
import { CompensationStatus, EntitlementStatus, ParcelStage } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { parcelScope, projectScope } from '../common/scope';
import { PrismaService } from '../prisma/prisma.service';

const STAGE_ORDER: ParcelStage[] = ['IDENTIFIED', 'PRELIM_NOTIFIED', 'DECLARED', 'AWARDED', 'COMPENSATION_PAID', 'POSSESSION_TAKEN', 'HANDED_OVER', 'LAPSED', 'WITHDRAWN'];

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Headline numbers for the caller’s jurisdiction. */
  async kpis(user: AuthUser) {
    const pScope = parcelScope(user);
    const [projects, parcelAgg, possessed, stages, comp, rrPending, families, openObjections] = await Promise.all([
      this.prisma.project.count({ where: projectScope(user) }),
      this.prisma.parcel.aggregate({ where: pScope, _count: { _all: true }, _sum: { totalAreaHa: true, familiesAffected: true } }),
      this.prisma.parcel.aggregate({ where: { AND: [pScope, { stage: { in: ['POSSESSION_TAKEN', 'HANDED_OVER'] } }] }, _sum: { totalAreaHa: true } }),
      this.prisma.parcel.groupBy({ by: ['stage'], where: pScope, _count: { _all: true }, _sum: { totalAreaHa: true } }),
      this.prisma.compensation.groupBy({ by: ['status'], where: { parcel: pScope }, _sum: { amountPaise: true }, _count: { _all: true } }),
      this.prisma.rREntitlementGrant.count({ where: { status: EntitlementStatus.ASSIGNED, case: { parcel: pScope } } }),
      this.prisma.affectedFamily.count({ where: { project: projectScope(user) } }),
      this.prisma.objection.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'HEARING_SCHEDULED', 'ESCALATED'] }, parcel: pScope } }),
    ]);
    const sum = (statuses: CompensationStatus[]) => comp.filter((c) => statuses.includes(c.status)).reduce((a, c) => a + (c._sum.amountPaise ?? 0n), 0n);
    const totalArea = parcelAgg._sum.totalAreaHa ?? 0;
    return {
      projects,
      parcels: parcelAgg._count._all,
      notifiedAreaHa: round1(totalArea),
      possessedAreaHa: round1(possessed._sum.totalAreaHa ?? 0),
      possessionPct: totalArea ? round1(((possessed._sum.totalAreaHa ?? 0) / totalArea) * 100) : 0,
      familiesAffected: families,
      rrEntitlementsPending: rrPending,
      openObjections,
      compensation: {
        assessedPaise: sum(['ASSESSED', 'APPROVED', 'INITIATED', 'PAID', 'FAILED', 'DISPUTED', 'ON_HOLD']),
        paidPaise: sum(['PAID']),
        pendingPaise: sum(['ASSESSED', 'APPROVED', 'INITIATED', 'FAILED']),
        disputedOrHeldPaise: sum(['DISPUTED', 'ON_HOLD']),
      },
      stageFunnel: STAGE_ORDER.map((stage) => {
        const s = stages.find((x) => x.stage === stage);
        return { stage, parcels: s?._count._all ?? 0, areaHa: round1(s?._sum.totalAreaHa ?? 0) };
      }),
    };
  }

  /** Parcel progress rolled up by state or district. */
  async breakdown(user: AuthUser, level: 'state' | 'district', stateCode?: string) {
    const by = level === 'state' ? (['stateCode', 'stateName'] as const) : (['districtCode', 'districtName', 'stateCode'] as const);
    const where = { AND: [parcelScope(user), stateCode ? { stateCode } : {}] };
    const [all, done, paid] = await Promise.all([
      this.prisma.parcel.groupBy({ by: [...by], where, _count: { _all: true }, _sum: { totalAreaHa: true, familiesAffected: true } }),
      this.prisma.parcel.groupBy({ by: [...by], where: { AND: [where, { stage: { in: ['POSSESSION_TAKEN', 'HANDED_OVER'] } }] }, _count: { _all: true }, _sum: { totalAreaHa: true } }),
      this.prisma.parcel.groupBy({ by: [...by], where: { AND: [where, { stage: { in: ['COMPENSATION_PAID', 'POSSESSION_TAKEN', 'HANDED_OVER'] } }] }, _count: { _all: true } }),
    ]);
    const key = (r: Record<string, unknown>) => String(level === 'state' ? r.stateCode : r.districtCode);
    return all
      .map((r) => {
        const k = key(r);
        const d = done.find((x) => key(x) === k);
        const p = paid.find((x) => key(x) === k);
        const area = r._sum.totalAreaHa ?? 0;
        return {
          code: k,
          name: String(level === 'state' ? r.stateName : (r as { districtName: string }).districtName),
          stateCode: String(r.stateCode),
          parcels: r._count._all,
          areaHa: round1(area),
          familiesAffected: r._sum.familiesAffected ?? 0,
          paidParcels: p?._count._all ?? 0,
          possessedParcels: d?._count._all ?? 0,
          possessionPct: area ? round1(((d?._sum.totalAreaHa ?? 0) / area) * 100) : 0,
        };
      })
      .sort((a, b) => b.parcels - a.parcels);
  }
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
