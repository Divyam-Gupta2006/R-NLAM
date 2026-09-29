import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AuthUser } from '../auth/auth.types';
import { Clock } from '../common/clock';
import { addDays, addMonths, istDateString, istHuman, parseIstDate } from '../common/dates';
import { parcelScope } from '../common/scope';
import { EVENT_BUS, EventBus } from '../events/event-bus';
import { PrismaService } from '../prisma/prisma.service';
import { Resolution, ruleValue } from '../rules/resolve';
import { RulesService } from '../rules/rules.service';
import { AdditionalFact, liabilityAt, S80Fact, savingsIfActed } from './liability';

interface Geo {
  parcel_id: string;
  parcel_number: string;
  project_id: string;
  state_code: string;
  state_name: string;
  district_code: string;
  district_name: string;
  village_id: string;
  village_name: string;
}
interface S80Row extends Geo {
  compensation_id: string;
  beneficiary: string;
  principal_paise: bigint;
  possession_on: Date;
  paid_on: Date | null;
}
interface AddRow extends Geo {
  stage: string;
  market_value_paise: bigint;
  start_on: Date;
  start_event: string;
  stop_on: Date | null;
}

type Level = 'state' | 'district' | 'village' | 'parcel';

/**
 * Live statutory cost of delay: s.80 interest and s.30(3) additional amount,
 * at parcel level, rolled up to village, district, state and nation. Facts come
 * from the mv_liability_* views; rates from the rule pack in force.
 */
@Injectable()
export class LiabilityService implements OnModuleInit {
  private readonly logger = new Logger('Liability');
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: RulesService,
    private readonly clock: Clock,
    @Inject(EVENT_BUS) private readonly bus: EventBus,
  ) {}

  onModuleInit() {
    for (const pattern of ['parcel.*', 'compensation.*', 'possession.*']) this.bus.subscribe(pattern, () => this.scheduleRefresh());
  }

  private scheduleRefresh() {
    if (this.refreshTimer) return;
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      void this.refresh().catch((e) => this.logger.warn(`refresh failed: ${e}`));
    }, 1_000);
  }

  async refresh() {
    await this.prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_liability_s80');
    await this.prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_liability_additional');
  }

  private async facts(user: AuthUser) {
    const allowed = new Set((await this.prisma.parcel.findMany({ where: parcelScope(user), select: { id: true } })).map((p) => p.id));
    const [s80Rows, addRows] = await Promise.all([
      this.prisma.$queryRawUnsafe<S80Row[]>('SELECT * FROM mv_liability_s80'),
      this.prisma.$queryRawUnsafe<AddRow[]>('SELECT * FROM mv_liability_additional'),
    ]);
    const resolvers = new Map<string, (d: Date) => Resolution>();
    const resolver = async (state: string) => {
      if (!resolvers.has(state)) resolvers.set(state, await this.rules.resolverFor(state));
      return resolvers.get(state)!;
    };

    const s80: Array<S80Fact & { row: S80Row }> = [];
    for (const r of s80Rows.filter((x) => allowed.has(x.parcel_id))) {
      const res = (await resolver(r.state_code))(r.possession_on);
      s80.push({
        kind: 's80',
        compensationId: r.compensation_id,
        parcelId: r.parcel_id,
        beneficiary: r.beneficiary,
        principalPaise: BigInt(r.principal_paise),
        possessionOn: r.possession_on,
        paidOn: r.paid_on,
        rates: { firstYearBp: ruleValue<number>(res, 'money.interest.first_year.bp').value, afterYearBp: ruleValue<number>(res, 'money.interest.after_year.bp').value, basis: 365 },
        row: r,
      });
    }
    const additional: Array<AdditionalFact & { row: AddRow }> = [];
    for (const r of addRows.filter((x) => allowed.has(x.parcel_id))) {
      const res = (await resolver(r.state_code))(r.start_on);
      additional.push({
        kind: 'additional',
        parcelId: r.parcel_id,
        marketValuePaise: BigInt(r.market_value_paise),
        startOn: r.start_on,
        stopOn: r.stop_on,
        rate: { bpPerYear: ruleValue<number>(res, 'money.additional.bp_per_year').value, basis: 365 },
        row: r,
      });
    }
    return { s80, additional };
  }

  /** Per-parcel liability now, for the bottleneck engine. */
  async perParcel(user: AuthUser) {
    const now = this.clock.now();
    const { s80, additional } = await this.facts(user);
    const out = new Map<string, { s80: S80Fact[]; add: AdditionalFact[]; additionalAccruedPaise: bigint; additionalDailyPaise: bigint; s80OutstandingPaise: bigint; s80DailyPaise: bigint }>();
    const get = (id: string) => {
      if (!out.has(id)) out.set(id, { s80: [], add: [], additionalAccruedPaise: 0n, additionalDailyPaise: 0n, s80OutstandingPaise: 0n, s80DailyPaise: 0n });
      return out.get(id)!;
    };
    for (const f of s80) get(f.parcelId).s80.push(f);
    for (const f of additional) get(f.parcelId).add.push(f);
    for (const v of out.values()) {
      const l = liabilityAt(v.s80, v.add, now);
      Object.assign(v, l);
    }
    return out;
  }

  async summary(user: AuthUser) {
    const now = this.clock.now();
    const { s80, additional } = await this.facts(user);
    const at = liabilityAt(s80, additional, now);
    const daily = at.s80DailyPaise + at.additionalDailyPaise;

    // Month-start points for the last 12 months, then today.
    const today = parseIstDate(istDateString(now));
    const firstOfMonth = parseIstDate(`${istDateString(now).slice(0, 7)}-01`);
    const points = Array.from({ length: 12 }, (_, i) => addMonths(firstOfMonth, i - 11)).concat([today]);
    const trend = points.map((d) => {
      const l = liabilityAt(s80, additional, d);
      return { date: istDateString(d), s80OutstandingPaise: l.s80OutstandingPaise, additionalAccruedPaise: l.additionalAccruedPaise, dailyPaise: l.s80DailyPaise + l.additionalDailyPaise };
    });

    return {
      asOf: now,
      totals: {
        ...at,
        totalAccruedPaise: at.s80OutstandingPaise + at.additionalAccruedPaise,
        dailyPaise: daily,
        /** For the live counter; rounded to the paisa. */
        perSecondPaise: Number(daily) / 86_400,
        s80Lines: s80.filter((f) => !f.paidOn || f.paidOn > now).filter((f) => f.possessionOn <= now).length,
        pendingAwards: additional.filter((f) => f.startOn <= now && (!f.stopOn || f.stopOn > now)).length,
      },
      trend,
      basis: [
        { key: 's80', label: 'Interest on compensation unpaid at possession', citation: 'RFCTLARR 2013, s.80 (9% p.a.; 15% after one year)' },
        { key: 'additional', label: 'Additional amount on awards still pending', citation: 'RFCTLARR 2013, s.30(3) (12% p.a. on market value from the s.4(2) notification)' },
      ],
    };
  }

  async rollup(user: AuthUser, level: Level, parent?: string) {
    const now = this.clock.now();
    const { s80, additional } = await this.facts(user);
    const keyOf = (g: Geo): { code: string; name: string; parent: string } => {
      switch (level) {
        case 'state':
          return { code: g.state_code, name: g.state_name, parent: 'IN' };
        case 'district':
          return { code: g.district_code, name: g.district_name, parent: g.state_code };
        case 'village':
          return { code: g.village_id, name: g.village_name, parent: g.district_code };
        case 'parcel':
          return { code: g.parcel_id, name: g.parcel_number, parent: g.village_id };
      }
    };
    const rows = new Map<string, { code: string; name: string; parent: string; s80: S80Fact[]; add: AdditionalFact[] }>();
    const bucket = (g: Geo) => {
      const k = keyOf(g);
      if (parent && k.parent !== parent) return null;
      if (!rows.has(k.code)) rows.set(k.code, { ...k, s80: [], add: [] });
      return rows.get(k.code)!;
    };
    for (const f of s80) bucket(f.row)?.s80.push(f);
    for (const f of additional) bucket(f.row)?.add.push(f);
    return [...rows.values()]
      .map((r) => {
        const l = liabilityAt(r.s80, r.add, now);
        return {
          level,
          code: r.code,
          name: r.name,
          parent: r.parent,
          ...l,
          totalAccruedPaise: l.s80OutstandingPaise + l.additionalAccruedPaise,
          dailyPaise: l.s80DailyPaise + l.additionalDailyPaise,
        };
      })
      .filter((r) => r.totalAccruedPaise > 0n || r.dailyPaise > 0n)
      .sort((a, b) => (b.dailyPaise > a.dailyPaise ? 1 : b.dailyPaise < a.dailyPaise ? -1 : 0));
  }

  /**
   * What acting within `actInDays` would avoid. Unpaid s.80 lines: the interest
   * over the next `horizonDays` if otherwise still unpaid. Pending awards: the
   * additional amount between acting and the s.25 award deadline (the latest
   * the award can lawfully come), or the horizon if no clock exists.
   */
  async topSavings(user: AuthUser, limit = 10, horizonDays = 365, actInDays = 7) {
    const now = this.clock.now();
    const actOn = addDays(now, actInDays);
    const { s80, additional } = await this.facts(user);
    const deadlines = new Map(
      (await this.prisma.statutoryClock.findMany({ where: { kind: 'AWARD_DEADLINE', status: 'RUNNING' }, select: { parcelId: true, dueOn: true } })).map((c) => [c.parcelId, c.dueOn]),
    );

    const unpaid = s80
      .filter((f) => f.possessionOn <= now && (!f.paidOn || f.paidOn > now))
      .map((f) => ({
        kind: 'PAY_COMPENSATION' as const,
        compensationId: f.compensationId,
        parcelId: f.parcelId,
        parcelNumber: f.row.parcel_number,
        village: f.row.village_name,
        district: f.row.district_name,
        beneficiary: f.beneficiary,
        principalPaise: f.principalPaise,
        possessionOn: f.possessionOn,
        accruedPaise: liabilityAt([f], [], now).s80OutstandingPaise,
        savingPaise: savingsIfActed(f, actOn, horizonDays),
        horizon: `${horizonDays} days`,
      }));

    const pending = additional
      .filter((f) => f.startOn <= now && !f.stopOn && f.row.stage === 'DECLARED')
      .map((f) => {
        const due = deadlines.get(f.parcelId);
        const days = due ? Math.max(0, Math.round((due.getTime() - actOn.getTime()) / 86_400_000)) : horizonDays;
        return {
          kind: 'DECLARE_AWARD' as const,
          parcelId: f.parcelId,
          parcelNumber: f.row.parcel_number,
          village: f.row.village_name,
          district: f.row.district_name,
          marketValuePaise: f.marketValuePaise,
          startOn: f.startOn,
          accruedPaise: liabilityAt([], [f], now).additionalAccruedPaise,
          savingPaise: savingsIfActed(f, actOn, days),
          horizon: due ? `until s.25 deadline ${istHuman(due)}` : `${horizonDays} days`,
        };
      });

    const byDesc = <T extends { savingPaise: bigint }>(a: T, b: T) => (b.savingPaise > a.savingPaise ? 1 : b.savingPaise < a.savingPaise ? -1 : 0);
    const topPay = unpaid.sort(byDesc).slice(0, limit);
    const topAward = pending.sort(byDesc).slice(0, limit);
    return {
      actOn,
      payCompensation: topPay,
      declareAward: topAward,
      totalSavingPaise: [...topPay, ...topAward].reduce((s, x) => s + x.savingPaise, 0n),
    };
  }
}
