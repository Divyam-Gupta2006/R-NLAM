import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ClockKind, ClockStatus, NoticeKind, Prisma, RoleName } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { Clock } from '../common/clock';
import { daysBetween, istDateString } from '../common/dates';
import { parcelScope } from '../common/scope';
import { DeliveredEvent, EVENT_BUS, EventBus } from '../events/event-bus';
import { LifecycleService } from '../lifecycle/lifecycle.service';
import { Blocker, GuardContext } from '../lifecycle/lifecycle.types';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { computeClocks, ParcelFacts } from '../rules/clocks';
import { ruleValue } from '../rules/resolve';
import { RulesService } from '../rules/rules.service';

export const parcelInclude = {
  notices: { select: { id: true, kind: true, publishedOn: true } },
  awards: { select: { awardDate: true }, orderBy: { awardDate: 'asc' } },
  compensations: { select: { status: true, paidOn: true } },
  rrCases: { select: { grants: { select: { status: true, deliveredOn: true, amountPaise: true } } } },
} satisfies Prisma.ParcelInclude;
type ParcelWithFacts = Prisma.ParcelGetPayload<{ include: typeof parcelInclude }>;

/** Officer-facing deadlines that get T-60/T-30/T-7 alerts (the objection window is informational). */
const ALERTED: ClockKind[] = ['DECLARATION_DEADLINE', 'AWARD_DEADLINE', 'PAYMENT_DEADLINE', 'RR_MONETARY_DEADLINE'];
const KIND_LABEL: Record<ClockKind, string> = {
  OBJECTION_WINDOW: 'Objection window (s.15)',
  DECLARATION_DEADLINE: 's.19 declaration',
  AWARD_DEADLINE: 'Award (s.25)',
  PAYMENT_DEADLINE: 'Compensation payment (s.38)',
  RR_MONETARY_DEADLINE: 'Monetary R&R (s.38)',
};

export function factsOf(p: ParcelWithFacts): ParcelFacts {
  const first = (k: NoticeKind) => p.notices.filter((n) => n.kind === k).sort((a, b) => +a.publishedOn - +b.publishedOn)[0];
  const sec11 = first(NoticeKind.SEC_11_PRELIMINARY);
  const sec19 = first(NoticeKind.SEC_19_DECLARATION);
  const allPaid = p.compensations.length > 0 && p.compensations.every((c) => c.status === 'PAID');
  const monetary = p.rrCases.flatMap((c) => c.grants).filter((g) => g.amountPaise !== null);
  const allRR = monetary.length > 0 && monetary.every((g) => g.status !== 'ASSIGNED');
  const latest = (ds: Array<Date | null>) => ds.filter((d): d is Date => !!d).sort((a, b) => +b - +a)[0] ?? null;
  return {
    stage: p.stage,
    sec11: sec11 ? { date: sec11.publishedOn, noticeId: sec11.id } : undefined,
    sec19: sec19 ? { date: sec19.publishedOn, noticeId: sec19.id } : undefined,
    awardDate: p.awards[0]?.awardDate,
    hasCompensation: p.compensations.length > 0,
    allPaidOn: allPaid ? latest(p.compensations.map((c) => c.paidOn)) : null,
    hasMonetaryRR: monetary.length > 0,
    allMonetaryRRDeliveredOn: allRR ? latest(monetary.map((g) => g.deliveredOn)) : null,
  };
}

@Injectable()
export class StatutoryService implements OnModuleInit, OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('Statutory');
  private timer: NodeJS.Timeout | null = null;
  private firstRun: NodeJS.Timeout | null = null;
  private pending = new Set<string>();
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: RulesService,
    private readonly clock: Clock,
    private readonly lifecycle: LifecycleService,
    private readonly notifications: NotificationsService,
    @Inject(EVENT_BUS) private readonly bus: EventBus,
  ) {}

  onModuleInit() {
    // Lapse guards: the rule pack decides the window; overriding one means
    // recording the Government's written extension (provisos to s.19(7), s.25).
    this.lifecycle.addGuard('Parcel', 'DECLARE', { name: 'declarationWindowOpen', check: (ctx) => this.windowGuard(ctx, 'DECLARATION_DEADLINE') });
    this.lifecycle.addGuard('Parcel', 'DECLARE_AWARD', { name: 'awardPeriodOpen', check: (ctx) => this.windowGuard(ctx, 'AWARD_DEADLINE') });
    // Recompute a parcel's clocks whenever anything about it changes.
    this.bus.subscribe('parcel.*', (e) => this.queue(e.aggregateId));
    this.bus.subscribe('compensation.*', (e) => this.queueFromPayload(e));
    this.bus.subscribe('rr_case.*', (e) => this.queueFromPayload(e));
  }

  onApplicationBootstrap() {
    if (process.env.STATUTORY_SCHEDULER === 'off') return;
    this.firstRun = setTimeout(() => void this.recomputeAll().then(() => this.raiseAlerts()), 3_000);
    this.timer = setInterval(() => void this.recomputeAll().then(() => this.raiseAlerts()), 60 * 60 * 1000);
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
    if (this.firstRun) clearTimeout(this.firstRun);
    if (this.flushTimer) clearTimeout(this.flushTimer);
  }

  private queueFromPayload(e: DeliveredEvent) {
    const parcelId = (e.payload as { parcelId?: string }).parcelId;
    if (parcelId) this.queue(parcelId);
  }

  private queue(parcelId: string) {
    this.pending.add(parcelId);
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(async () => {
      const ids = [...this.pending];
      this.pending.clear();
      this.flushTimer = null;
      await this.recompute({ id: { in: ids } }).catch((err) => this.logger.warn(`recompute failed: ${err}`));
    }, 500);
  }

  private async windowGuard(ctx: GuardContext, kind: 'DECLARATION_DEADLINE' | 'AWARD_DEADLINE'): Promise<Blocker[]> {
    const p = await ctx.tx.parcel.findUnique({ where: { id: ctx.entity.id }, include: parcelInclude });
    if (!p) return [];
    const resolver = await this.rules.resolverFor(p.stateCode);
    const facts = factsOf(p);
    // Evaluate as if the action were not yet done (it is what we are about to do).
    const pre = kind === 'DECLARATION_DEADLINE' ? { ...facts, sec19: undefined } : { ...facts, awardDate: undefined };
    const clock = computeClocks(pre, resolver, ctx.now).find((c) => c.kind === kind);
    if (!clock || clock.status !== 'MISSED') return [];
    return [
      {
        code: kind === 'DECLARATION_DEADLINE' ? 'DECLARATION_WINDOW_EXPIRED' : 'AWARD_PERIOD_EXPIRED',
        message: `${KIND_LABEL[kind]} was due by ${istDateString(clock.dueOn)} (${daysBetween(clock.dueOn, ctx.now)} days ago). ${clock.consequence}`,
        citation: clock.citation,
        overridable: true,
        unblockedBy: ['GOVERNMENT_EXTENSION_ORDER'],
        evidence: { dueOn: clock.dueOn, packCode: clock.packCode, ruleKey: clock.ruleKey },
      },
    ];
  }

  /** Recompute clocks for the parcels matching `where` (all if omitted). */
  async recompute(where: Prisma.ParcelWhereInput = {}) {
    const parcels = await this.prisma.parcel.findMany({ where, include: parcelInclude });
    const now = this.clock.now();
    const resolvers = new Map<string, Awaited<ReturnType<RulesService['resolverFor']>>>();
    let written = 0;
    for (const p of parcels) {
      let resolver = resolvers.get(p.stateCode);
      if (!resolver) {
        resolver = await this.rules.resolverFor(p.stateCode);
        resolvers.set(p.stateCode, resolver);
      }
      let clocks;
      try {
        clocks = computeClocks(factsOf(p), resolver, now);
      } catch (err) {
        this.logger.warn(`No rules for parcel ${p.parcelNumber}: ${(err as Error).message}`);
        continue;
      }
      const kinds = clocks.map((c) => c.kind);
      await this.prisma.$transaction([
        this.prisma.statutoryClock.deleteMany({ where: { parcelId: p.id, kind: { notIn: kinds } } }),
        ...clocks.map((c) => {
          const data = { ...c, projectId: p.projectId, districtCode: p.districtCode, stateCode: p.stateCode };
          return this.prisma.statutoryClock.upsert({ where: { parcelId_kind: { parcelId: p.id, kind: c.kind } }, create: { parcelId: p.id, ...data }, update: data });
        }),
      ]);
      written += clocks.length;
    }
    return { parcels: parcels.length, clocks: written };
  }

  async recomputeAll() {
    const r = await this.recompute();
    this.logger.log(`Statutory clocks recomputed: ${r.clocks} clocks on ${r.parcels} parcels`);
    return r;
  }

  /**
   * T-60 / T-30 / T-7 alerts, one per (deadline, notice or parcel, threshold),
   * addressed to the district's Collectors; T-7 and missed deadlines also go to
   * the State Admin. Deduplicated, so re-running is harmless.
   */
  async raiseAlerts() {
    const now = this.clock.now();
    const running = await this.prisma.statutoryClock.findMany({ where: { kind: { in: ALERTED }, status: { in: ['RUNNING', 'MISSED'] } } });
    const groups = new Map<string, typeof running>();
    for (const c of running) {
      const key = `${c.kind}:${c.noticeId ?? c.parcelId}:${c.districtCode}:${istDateString(c.dueOn)}`;
      groups.set(key, [...(groups.get(key) ?? []), c]);
    }
    let raised = 0;
    for (const [key, cs] of groups) {
      const c = cs[0];
      const resolver = await this.rules.resolverFor(c.stateCode);
      let offsets = [60, 30, 7];
      try {
        offsets = ruleValue<number[]>(resolver(now), 'alert.offsets.days').value;
      } catch {
        /* default offsets */
      }
      const left = daysBetween(now, c.dueOn);
      const parcelLabel = cs.length === 1 ? '1 parcel' : `${cs.length} parcels`;
      if (c.status === 'MISSED') {
        for (const role of [RoleName.DISTRICT_OFFICER, RoleName.STATE_ADMIN]) {
          await this.notifications.notify({
            title: `Missed: ${KIND_LABEL[c.kind]} (${parcelLabel})`,
            message: `Was due ${istDateString(c.dueOn)}. ${c.consequence} (${c.citation})`,
            type: 'STATUTORY_DEADLINE',
            severity: 'CRITICAL',
            role,
            stateCode: c.stateCode,
            districtCode: role === RoleName.DISTRICT_OFFICER ? c.districtCode : null,
            entityType: cs.length === 1 ? 'Parcel' : 'StatutoryNotice',
            entityId: cs.length === 1 ? c.parcelId : c.noticeId ?? c.parcelId,
            dedupeKey: `clock:${key}:MISSED:${role}`,
          });
          raised++;
        }
        continue;
      }
      const threshold = [...offsets].sort((a, b) => a - b).find((o) => left <= o);
      if (threshold === undefined) continue;
      const recipients: RoleName[] = threshold <= 7 ? [RoleName.DISTRICT_OFFICER, RoleName.STATE_ADMIN] : [RoleName.DISTRICT_OFFICER];
      for (const role of recipients) {
        await this.notifications.notify({
          title: `T-${threshold}: ${KIND_LABEL[c.kind]} due in ${left} days (${parcelLabel})`,
          message: `Due ${istDateString(c.dueOn)}. ${c.consequence} (${c.citation})`,
          type: 'STATUTORY_DEADLINE',
          severity: threshold <= 7 ? 'CRITICAL' : threshold <= 30 ? 'WARNING' : 'INFO',
          role,
          stateCode: c.stateCode,
          districtCode: role === RoleName.DISTRICT_OFFICER ? c.districtCode : null,
          entityType: cs.length === 1 ? 'Parcel' : 'StatutoryNotice',
          entityId: cs.length === 1 ? c.parcelId : c.noticeId ?? c.parcelId,
          dedupeKey: `clock:${key}:T-${threshold}:${role}`,
        });
        raised++;
      }
    }
    return { groups: groups.size, notifications: raised };
  }

  /** Calendar: clocks grouped by (kind, notice or parcel, due date), soonest first. */
  async calendar(user: AuthUser, f: { status?: ClockStatus; projectId?: string; includeMet?: boolean }) {
    const now = this.clock.now();
    const clocks = await this.prisma.statutoryClock.findMany({
      where: {
        projectId: f.projectId,
        status: f.status ?? (f.includeMet ? undefined : { in: ['RUNNING', 'MISSED'] }),
        parcelId: { in: (await this.prisma.parcel.findMany({ where: parcelScope(user), select: { id: true } })).map((p) => p.id) },
      },
      orderBy: { dueOn: 'asc' },
    });
    const parcels = await this.prisma.parcel.findMany({
      where: { id: { in: [...new Set(clocks.map((c) => c.parcelId))] } },
      select: { id: true, parcelNumber: true, villageName: true, districtName: true, project: { select: { id: true, code: true, name: true } } },
    });
    const pmap = new Map(parcels.map((p) => [p.id, p]));
    const groups = new Map<string, { key: string; kind: ClockKind; label: string; dueOn: Date; startsOn: Date; status: ClockStatus; daysLeft: number; citation: string; consequence: string; packCode: string; unverified: boolean; noticeId: string | null; project: { id: string; code: string; name: string } | undefined; districts: Set<string>; villages: Set<string>; parcels: Array<{ id: string; parcelNumber: string; villageName: string }> }>();
    for (const c of clocks) {
      const key = `${c.kind}:${c.noticeId ?? c.parcelId}:${istDateString(c.dueOn)}`;
      const p = pmap.get(c.parcelId);
      let g = groups.get(key);
      if (!g) {
        g = { key, kind: c.kind, label: KIND_LABEL[c.kind], dueOn: c.dueOn, startsOn: c.startsOn, status: c.status, daysLeft: daysBetween(now, c.dueOn), citation: c.citation, consequence: c.consequence, packCode: c.packCode, unverified: c.unverified, noticeId: c.noticeId, project: p?.project, districts: new Set(), villages: new Set(), parcels: [] };
        groups.set(key, g);
      }
      if (p) {
        g.districts.add(p.districtName);
        g.villages.add(p.villageName);
        g.parcels.push({ id: p.id, parcelNumber: p.parcelNumber, villageName: p.villageName });
      }
    }
    return [...groups.values()]
      .map((g) => ({ ...g, districts: [...g.districts], villages: [...g.villages], parcelCount: g.parcels.length }))
      .sort((a, b) => +a.dueOn - +b.dueOn);
  }

  async forParcel(parcelId: string) {
    return this.prisma.statutoryClock.findMany({ where: { parcelId }, orderBy: { dueOn: 'asc' } });
  }
}
