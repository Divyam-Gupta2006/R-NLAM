import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { BriefDecision, ClockKind, RoleName } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.types';
import { Clock } from '../common/clock';
import { addDays, daysBetween, istDateString } from '../common/dates';
import { formatInr } from '../common/money';
import { parcelScope, projectScope } from '../common/scope';
import { GisGateService } from '../gis/gis-gate.service';
import { savingsIfActed } from '../liability/liability';
import { LiabilityService } from '../liability/liability.service';
import { LLM_PROVIDER, LLMProvider } from '../llm/llm.provider';
import { PrismaService } from '../prisma/prisma.service';
import { LEAD_TIME_DAYS } from './lead-times';
import { BottleneckType, familiesComponent, moneyComponent, score, Score, statutoryRisk } from './scoring';

export interface Evidence {
  label: string;
  detail: string;
  citation?: string;
  unverified?: boolean;
}

export interface Brief {
  headline: string;
  blocked: string;
  why: string[];
  impact: string;
  action: string;
  owner: { role: RoleName; label: string; names: string[] };
  deadline: string | null;
  deadlineWhy: string;
}

export interface Bottleneck {
  key: string;
  type: BottleneckType;
  projectId: string;
  projectCode: string;
  title: string;
  parcels: Array<{ id: string; parcelNumber: string; villageName: string }>;
  families: number;
  exposurePaise: bigint;
  exposureLabel: string;
  perDayPaise: bigint;
  daysToDeadline: number | null;
  evidence: Evidence[];
  brief: Brief;
  score: Score;
  decision: { decision: BriefDecision; comment: string; by: string; role: RoleName; at: Date } | null;
}

type Draft = Omit<Bottleneck, 'score' | 'decision' | 'projectCode'> & { accruing: boolean; legalBar: boolean; leadTimeDays?: number; leadTimeWhy?: string };

const ROLE_LABEL: Partial<Record<RoleName, string>> = {
  DISTRICT_OFFICER: 'Collector',
  FINANCE_OFFICER: 'Accounts Officer (LA)',
  RR_OFFICER: 'R&R Administrator',
  STATE_ADMIN: 'Principal Secretary (Revenue)',
};

const OPEN_OBJECTION = ['SUBMITTED', 'UNDER_REVIEW', 'HEARING_SCHEDULED', 'ESCALATED'] as const;
const DOC_LABEL = (k: string) => k.replace(/_/g, ' ').toLowerCase();

/**
 * Collects every bottleneck on every project the caller can see, scores it
 * (statutory risk × ₹ exposure × families), and writes a deterministic action
 * brief with its evidence. Nothing here depends on a language model; the LLM
 * may only rephrase a finished brief.
 */
@Injectable()
export class WhyStuckService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly liability: LiabilityService,
    private readonly gate: GisGateService,
    private readonly audit: AuditService,
    private readonly clock: Clock,
    @Inject(LLM_PROVIDER) private readonly llm: LLMProvider,
  ) {}

  /** Ranked bottlenecks, optionally for one project. */
  async bottlenecks(user: AuthUser, projectId?: string): Promise<Bottleneck[]> {
    const now = this.clock.now();
    const scope = { AND: [parcelScope(user), projectId ? { projectId } : {}] };
    const [parcels, clocks, liab, conflicts, projects] = await Promise.all([
      this.prisma.parcel.findMany({
        where: scope,
        select: {
          id: true,
          parcelNumber: true,
          villageName: true,
          districtCode: true,
          districtName: true,
          stateCode: true,
          stage: true,
          projectId: true,
          familiesAffected: true,
          totalAreaHa: true,
          marketRatePaisePerHa: true,
          objections: { where: { status: { in: [...OPEN_OBJECTION] } }, select: { id: true, category: true, status: true, applicant: true, hearings: { select: { scheduledAt: true, status: true } } } },
          compensations: { select: { id: true, status: true, amountPaise: true, beneficiaryName: true } },
          rrCases: { select: { family: { select: { headName: true } }, grants: { where: { status: 'ASSIGNED' }, select: { amountPaise: true, entitlement: { select: { name: true } } } } } },
          caseLinks: { where: { status: 'CONFIRMED' }, select: { courtCase: true } },
          _count: { select: { caseLinks: { where: { status: 'CANDIDATE' } } } },
        },
      }),
      this.prisma.statutoryClock.findMany({ where: { status: { in: ['RUNNING', 'MISSED'] } } }),
      this.liability.perParcel(user),
      this.gate.conflicts(user, projectId),
      this.prisma.project.findMany({ where: projectScope(user), select: { id: true, code: true } }),
    ]);
    const pById = new Map(parcels.map((p) => [p.id, p]));
    const clocksBy = new Map<string, Map<ClockKind, (typeof clocks)[number]>>();
    for (const c of clocks) {
      if (!pById.has(c.parcelId)) continue;
      if (!clocksBy.has(c.parcelId)) clocksBy.set(c.parcelId, new Map());
      clocksBy.get(c.parcelId)!.set(c.kind, c);
    }
    const clockOf = (parcelId: string, kind: ClockKind) => clocksBy.get(parcelId)?.get(kind);
    const days = (d: Date) => daysBetween(now, d);
    const owners = await this.owners();
    const ownerFor = (role: RoleName, districtCode: string, stateCode: string) => ({
      role,
      label: ROLE_LABEL[role] ?? role,
      names: owners.filter((o) => o.role === role && (o.districtCode === districtCode || (!o.districtCode && o.stateCode === stateCode))).map((o) => o.name),
    });
    const drafts: Draft[] = [];
    const ref = (p: { id: string; parcelNumber: string; villageName: string }) => ({ id: p.id, parcelNumber: p.parcelNumber, villageName: p.villageName });
    /** Lower bound of what a lapse puts at risk: market value + 100% solatium + additional amount accrued. */
    const valueAtRisk = (p: (typeof parcels)[number]) => BigInt(Math.round(Number(p.marketRatePaisePerHa ?? 0n) * p.totalAreaHa)) * 2n + (liab.get(p.id)?.additionalAccruedPaise ?? 0n);
    const litigated = new Set(parcels.filter((p) => p.objections.some((o) => o.category === 'TITLE' && o.status === 'ESCALATED')).map((p) => p.id));

    // 1. GIS consent gate
    for (const c of conflicts.filter((x) => x.blocked && ['DECLARED', 'AWARDED', 'COMPENSATION_PAID'].includes(x.parcel.stage))) {
      const p = pById.get(c.parcel.id);
      if (!p) continue;
      const l = liab.get(p.id);
      const awardClock = clockOf(p.id, 'AWARD_DEADLINE');
      const dToDeadline = awardClock ? days(awardClock.dueOn) : null;
      const projected = l && awardClock && dToDeadline !== null && dToDeadline > 0 ? l.add.reduce((s, f) => s + savingsIfActed(f, now, dToDeadline), 0n) : 0n;
      const missing = c.items.filter((i) => !i.satisfied);
      const exposure = valueAtRisk(p) + projected;
      const leadKind = missing.map((m) => m.kind).sort((a, b) => (LEAD_TIME_DAYS[b] ?? 0) - (LEAD_TIME_DAYS[a] ?? 0))[0];
      drafts.push({
        key: `GIS:${p.id}`,
        type: 'GIS_BLOCK',
        projectId: p.projectId,
        title: `Award blocked: ${p.parcelNumber} overlaps ${missing.map((m) => m.layerName).join(' and ')}`,
        parcels: [ref(p)],
        families: p.familiesAffected,
        exposurePaise: exposure,
        exposureLabel: 'Acquisition value at risk if the award lapses (market value + solatium), plus additional amount accrued and still to accrue',
        perDayPaise: l?.additionalDailyPaise ?? 0n,
        daysToDeadline: dToDeadline,
        accruing: false,
        legalBar: true,
        leadTimeDays: LEAD_TIME_DAYS[leadKind],
        leadTimeWhy: `typically needed for ${leadKind.replace(/_/g, ' ').toLowerCase()} clearance (planning assumption)`,
        evidence: [
          ...missing.map((m) => ({
            label: `${m.layerName} (${m.kind.replace(/_/g, ' ').toLowerCase()})`,
            detail: `Overlap ${(m.overlapSqm / 10_000).toFixed(3)} ha, ${m.overlapPct}% of the parcel (PostGIS ST_Intersection). Missing: ${m.missing.map(DOC_LABEL).join(', ')}.`,
            citation: m.citation,
            unverified: m.unverified,
          })),
          ...(awardClock ? [{ label: 'Award deadline', detail: `Due ${istDateString(awardClock.dueOn)}; ${awardClock.consequence}`, citation: awardClock.citation }] : []),
        ],
        brief: {
          headline: `Forest and rights clearance is holding up ${p.parcelNumber}`,
          blocked: `The s.23 award for parcel ${p.parcelNumber} (${p.villageName}), and its possession.`,
          why: missing.map((m) => `It overlaps ${m.layerName} by ${m.overlapPct}% and ${m.missing.map(DOC_LABEL).join(' and ')} ${m.missing.length > 1 ? 'are' : 'is'} not on file (${m.citation}).`),
          impact: `${formatInr(l?.additionalAccruedPaise ?? 0n)} additional amount accrued so far, ${formatInr(l?.additionalDailyPaise ?? 0n)} more every day; ${p.familiesAffected} families wait for their award.`,
          action: `Obtain ${[...new Set(missing.flatMap((m) => m.missing))].map(DOC_LABEL).join(' and ')} and upload them to the parcel; the award unblocks automatically. If a Government order permits proceeding meanwhile, a senior officer can record an override with its reference.`,
          owner: ownerFor(RoleName.DISTRICT_OFFICER, p.districtCode, p.stateCode),
          deadline: awardClock ? istDateString(awardClock.dueOn) : null,
          deadlineWhy: awardClock ? `s.25 award deadline (${awardClock.citation})` : 'No statutory deadline recorded',
        },
      });
    }

    // 2. Declarations at risk (grouped by the s.11 notice), with undisposed objections called out
    const declGroups = new Map<string, typeof parcels>();
    for (const p of parcels.filter((x) => x.stage === 'PRELIM_NOTIFIED')) {
      const c = clockOf(p.id, 'DECLARATION_DEADLINE');
      if (!c || (c.status === 'RUNNING' && days(c.dueOn) > 120)) continue;
      const k = `${c.noticeId}:${p.districtCode}`;
      declGroups.set(k, [...(declGroups.get(k) ?? []), p]);
    }
    for (const [k, ps] of declGroups) {
      const c = clockOf(ps[0].id, 'DECLARATION_DEADLINE')!;
      const d = days(c.dueOn);
      const objections = ps.flatMap((p) => p.objections.map((o) => ({ ...o, parcelNumber: p.parcelNumber })));
      const nextHearing = objections.flatMap((o) => o.hearings.filter((h) => h.status === 'SCHEDULED').map((h) => h.scheduledAt)).sort((a, b) => +a - +b)[0];
      const exposure = ps.reduce((s, p) => s + valueAtRisk(p), 0n);
      const families = ps.reduce((s, p) => s + p.familiesAffected, 0);
      const villages = [...new Set(ps.map((p) => p.villageName))];
      drafts.push({
        key: `DECL:${k}`,
        type: 'DECLARATION_AT_RISK',
        projectId: ps[0].projectId,
        title: `s.19 declaration ${d < 0 ? 'overdue' : `due in ${d} days`} for ${ps.length} parcels in ${villages.join(', ')}`,
        parcels: ps.map(ref),
        families,
        exposurePaise: exposure,
        exposureLabel: 'Acquisition value at risk if the notification lapses (market value + solatium + additional amount accrued)',
        perDayPaise: ps.reduce((s, p) => s + (liab.get(p.id)?.additionalDailyPaise ?? 0n), 0n),
        daysToDeadline: d,
        accruing: false,
        legalBar: false,
        leadTimeDays: objections.length ? LEAD_TIME_DAYS.OBJECTION_HEARINGS : undefined,
        leadTimeWhy: objections.length ? 'to hear and dispose of the pending objections (planning assumption)' : undefined,
        evidence: [
          { label: 'Declaration deadline', detail: `Due ${istDateString(c.dueOn)}. ${c.consequence}`, citation: c.citation },
          ...(objections.length ? [{ label: `${objections.length} objection(s) undisposed`, detail: objections.map((o) => `${o.parcelNumber}: ${o.category.replace(/_/g, ' ').toLowerCase()} (${o.status.replace(/_/g, ' ').toLowerCase()})`).join('; '), citation: 'RFCTLARR 2013, s.15(2)' }] : []),
        ],
        brief: {
          headline: `${villages.join(' & ')}: the preliminary notification lapses on ${istDateString(c.dueOn)} without a s.19 declaration`,
          blocked: `The s.19 declaration for ${ps.length} parcels (${villages.join(', ')}), and everything after it.`,
          why: [
            `The s.11 notification is deemed rescinded if no declaration follows within the rule-pack period (${c.citation}); ${d < 0 ? `that date passed ${-d} days ago` : `${d} days remain`}.`,
            ...(objections.length ? [`${objections.length} objection(s) under s.15 must be heard and disposed of first${nextHearing ? `; the next hearing is ${istDateString(nextHearing)}` : ''}.`] : []),
          ],
          impact: `${families} families and ${ps.length} parcels would have to restart acquisition, putting at least ${formatInr(exposure)} of acquisition value at risk.`,
          action: objections.length
            ? `Hold the pending hearings${nextHearing ? ` (next ${istDateString(nextHearing)})` : ''}, dispose of the ${objections.length} objection(s), then publish the s.19 declaration. Parcels with open objections are left out automatically, so the rest can be declared now.`
            : `Publish the s.19 declaration for these parcels now.`,
          owner: ownerFor(RoleName.DISTRICT_OFFICER, ps[0].districtCode, ps[0].stateCode),
          deadline: istDateString(addDays(c.dueOn, -1)),
          deadlineWhy: `One day before the s.19(7) lapse date (${istDateString(c.dueOn)})`,
        },
      });
    }

    // 3. Pending awards (grouped by s.19 notice): money accrues until the award
    const awardGroups = new Map<string, typeof parcels>();
    for (const p of parcels.filter((x) => x.stage === 'DECLARED' && !litigated.has(x.id) && !conflicts.some((c) => c.parcel.id === x.id && c.blocked))) {
      const c = clockOf(p.id, 'AWARD_DEADLINE');
      if (!c) continue;
      const k = `${c.noticeId}:${p.districtCode}`;
      awardGroups.set(k, [...(awardGroups.get(k) ?? []), p]);
    }
    for (const [k, ps] of awardGroups) {
      const c = clockOf(ps[0].id, 'AWARD_DEADLINE')!;
      const d = days(c.dueOn);
      const perDay = ps.reduce((s, p) => s + (liab.get(p.id)?.additionalDailyPaise ?? 0n), 0n);
      const toDeadline = ps.reduce((s, p) => s + (liab.get(p.id)?.add.reduce((a, f) => a + savingsIfActed(f, now, Math.max(0, d)), 0n) ?? 0n), 0n);
      drafts.push({
        key: `AWARD:${k}`,
        type: 'AWARD_AT_RISK',
        projectId: ps[0].projectId,
        title: `${ps.length} declared parcels awaiting award in ${[...new Set(ps.map((p) => p.villageName))].join(', ')}`,
        parcels: ps.map(ref),
        families: ps.reduce((s, p) => s + p.familiesAffected, 0),
        exposurePaise: toDeadline,
        exposureLabel: 'Additional amount that will accrue if the awards come only at the s.25 deadline',
        perDayPaise: perDay,
        daysToDeadline: d,
        accruing: false,
        legalBar: false,
        evidence: [{ label: 'Award deadline', detail: `Due ${istDateString(c.dueOn)}. ${c.consequence}`, citation: c.citation }],
        brief: {
          headline: `Every day without these awards adds ${formatInr(perDay)} to the bill`,
          blocked: `Awards (s.23) for ${ps.length} declared parcels.`,
          why: [`The additional amount under s.30(3) runs at 12% a year on market value until the award.`, `The awards must be made by ${istDateString(c.dueOn)} or the proceedings lapse (${c.citation}).`],
          impact: `${formatInr(toDeadline)} more if the awards wait for the deadline; ${ps.reduce((s, p) => s + p.familiesAffected, 0)} families wait for compensation.`,
          action: `Finalise valuations and declare the awards; each parcel's award screen previews the calculation line by line.`,
          owner: ownerFor(RoleName.DISTRICT_OFFICER, ps[0].districtCode, ps[0].stateCode),
          deadline: istDateString(c.dueOn),
          deadlineWhy: `s.25 award deadline (${c.citation})`,
        },
      });
    }

    // 4. s.80 interest running (possession before payment)
    for (const p of parcels) {
      const l = liab.get(p.id);
      const running = l?.s80.filter((f) => f.possessionOn <= now && (!f.paidOn || f.paidOn > now)) ?? [];
      if (!running.length) continue;
      const nextYear = running.reduce((s, f) => s + savingsIfActed(f, now, 365), 0n);
      const unpaid = running.reduce((s, f) => s + f.principalPaise, 0n);
      drafts.push({
        key: `S80:${p.id}`,
        type: 'INTEREST_RUNNING',
        projectId: p.projectId,
        title: `Interest running on ${p.parcelNumber}: possession taken, ${running.length} holder(s) unpaid`,
        parcels: [ref(p)],
        families: p.familiesAffected,
        exposurePaise: l!.s80OutstandingPaise + nextYear,
        exposureLabel: 's.80 interest accrued, plus the next 12 months if still unpaid',
        perDayPaise: l!.s80DailyPaise,
        daysToDeadline: null, // no deadline: money is lost every day (accruing)
        accruing: true,
        legalBar: false,
        evidence: [{ label: 'Unpaid since possession', detail: `${running.map((f) => `${f.beneficiary}: ${formatInr(f.principalPaise)}`).join('; ')}. Possession ${istDateString(running[0].possessionOn)}.`, citation: 'RFCTLARR 2013, s.80' }],
        brief: {
          headline: `${formatInr(l!.s80DailyPaise)} of interest a day on ${p.parcelNumber}`,
          blocked: `Nothing is blocked, but money is being lost: possession was taken on ${istDateString(running[0].possessionOn)} before ${running.length} holder(s) were paid.`,
          why: [`Compensation unpaid at possession carries interest at 9% a year, rising to 15% after one year (s.80).`],
          impact: `${formatInr(l!.s80OutstandingPaise)} interest accrued; ${formatInr(nextYear)} more in the next 12 months if unpaid; ${formatInr(unpaid)} principal owed.`,
          action: `Pay the outstanding ${formatInr(unpaid)} now (Finance → Ready to pay). Interest stops on the day of payment.`,
          owner: ownerFor(RoleName.FINANCE_OFFICER, p.districtCode, p.stateCode),
          deadline: istDateString(now),
          deadlineWhy: 'Interest accrues daily',
        },
      });
    }

    // 5. Compensation overdue after award (s.38), grouped by village; holds and failures separately
    const overdue = new Map<string, Array<{ p: (typeof parcels)[number]; c: (typeof parcels)[number]['compensations'][number]; due: Date }>>();
    for (const p of parcels.filter((x) => x.stage === 'AWARDED')) {
      const clk = clockOf(p.id, 'PAYMENT_DEADLINE');
      for (const c of p.compensations) {
        if (c.status === 'ON_HOLD' || c.status === 'FAILED') {
          const type = c.status === 'ON_HOLD' ? 'PAYMENT_HELD' : 'PAYMENT_FAILED';
          const d = clk ? days(clk.dueOn) : null;
          drafts.push({
            key: `${type}:${c.id}`,
            type,
            projectId: p.projectId,
            title: c.status === 'ON_HOLD' ? `Payment on hold: ${c.beneficiaryName} (${p.parcelNumber})` : `Payment bounced: ${c.beneficiaryName} (${p.parcelNumber})`,
            parcels: [ref(p)],
            families: Math.max(1, Math.round(p.familiesAffected / Math.max(1, p.compensations.length))),
            exposurePaise: c.amountPaise,
            exposureLabel: 'Compensation not reaching the beneficiary',
            perDayPaise: 0n,
            daysToDeadline: d,
            accruing: false,
            legalBar: c.status === 'ON_HOLD',
            leadTimeDays: c.status === 'ON_HOLD' ? LEAD_TIME_DAYS.IDENTITY_RECONCILIATION : undefined,
            leadTimeWhy: c.status === 'ON_HOLD' ? 'to reconcile the beneficiary identity (planning assumption)' : undefined,
            evidence: [
              { label: c.status === 'ON_HOLD' ? 'Held' : 'Failed credit', detail: `${formatInr(c.amountPaise)} to ${c.beneficiaryName}.`, citation: clk?.citation },
              ...(clk ? [{ label: 'Payment deadline', detail: `${istDateString(clk.dueOn)} (${d !== null && d < 0 ? `${-d} days ago` : `${d} days left`})`, citation: clk.citation }] : []),
            ],
            brief: {
              headline: c.status === 'ON_HOLD' ? `${c.beneficiaryName}'s compensation is on hold` : `${c.beneficiaryName}'s payment bounced`,
              blocked: `${formatInr(c.amountPaise)} for parcel ${p.parcelNumber}; the parcel cannot move to possession until every holder is paid.`,
              why: [c.status === 'ON_HOLD' ? 'The beneficiary record could not be matched with the land record (name differs across records or scripts).' : 'The bank rejected the credit (account closed or details wrong).'],
              impact: `${formatInr(c.amountPaise)} owed; the s.38 payment deadline ${d !== null && d < 0 ? `was missed ${-d} days ago` : 'is running'}.`,
              action: c.status === 'ON_HOLD' ? 'Confirm the beneficiary’s identity in the reconciliation queue, then release the hold and pay.' : 'Collect corrected bank details from the beneficiary and retry the payment.',
              owner: ownerFor(c.status === 'ON_HOLD' ? RoleName.DISTRICT_OFFICER : RoleName.FINANCE_OFFICER, p.districtCode, p.stateCode),
              deadline: clk ? istDateString(clk.dueOn) : null,
              deadlineWhy: clk ? `s.38 payment deadline (${clk.citation})` : 'No statutory deadline recorded',
            },
          });
          continue;
        }
        if (clk && (c.status === 'ASSESSED' || c.status === 'APPROVED') && (clk.status === 'MISSED' || days(clk.dueOn) <= 30)) {
          const k = `${p.projectId}:${p.villageName}`;
          overdue.set(k, [...(overdue.get(k) ?? []), { p, c, due: clk.dueOn }]);
        }
      }
    }
    for (const [k, rows] of overdue) {
      const earliest = rows.map((r) => r.due).sort((a, b) => +a - +b)[0];
      const d = days(earliest);
      const amount = rows.reduce((s, r) => s + r.c.amountPaise, 0n);
      const parcelsIn = [...new Map(rows.map((r) => [r.p.id, r.p])).values()];
      const approvedOnly = rows.every((r) => r.c.status === 'APPROVED');
      drafts.push({
        key: `PAY:${k}`,
        type: 'PAYMENT_OVERDUE',
        projectId: rows[0].p.projectId,
        title: `${rows.length} awarded beneficiaries unpaid in ${rows[0].p.villageName}${d < 0 ? `, ${-d} days past the s.38 deadline` : ''}`,
        parcels: parcelsIn.map(ref),
        families: parcelsIn.reduce((s, p) => s + p.familiesAffected, 0),
        exposurePaise: amount,
        exposureLabel: 'Compensation awarded but not paid',
        perDayPaise: 0n,
        daysToDeadline: d,
        accruing: false,
        legalBar: false,
        evidence: [{ label: 'Unpaid lines', detail: rows.map((r) => `${r.p.parcelNumber} ${r.c.beneficiaryName}: ${formatInr(r.c.amountPaise)} (${r.c.status.toLowerCase()})`).join('; '), citation: 'RFCTLARR 2013, s.38(1)' }],
        brief: {
          headline: `${formatInr(amount)} awarded in ${rows[0].p.villageName} has not reached ${rows.length} beneficiaries`,
          blocked: `Possession of ${parcelsIn.length} parcel(s): the Act allows it only after full payment.`,
          why: [`Compensation must be paid or tendered within three months of the award (s.38(1)); the earliest deadline ${d < 0 ? `passed ${-d} days ago` : `is in ${d} days`}.`, 'No interest accrues before possession, but the land cannot be handed to the project.'],
          impact: `${formatInr(amount)} owed to ${rows.length} beneficiaries; ${parcelsIn.reduce((s, p) => s + p.familiesAffected, 0)} families waiting.`,
          action: approvedOnly ? 'Release payment for the approved lines (Finance → Ready to pay).' : 'Approve the assessed lines, then release payment.',
          owner: ownerFor(approvedOnly ? RoleName.FINANCE_OFFICER : RoleName.DISTRICT_OFFICER, rows[0].p.districtCode, rows[0].p.stateCode),
          deadline: istDateString(earliest),
          deadlineWhy: 's.38(1) three-month payment deadline',
        },
      });
    }

    // 6. R&R blocking possession
    for (const p of parcels.filter((x) => x.stage === 'COMPENSATION_PAID')) {
      const pending = p.rrCases.flatMap((rc) => rc.grants.map((g) => ({ ...g, family: rc.family.headName })));
      if (!pending.length) continue;
      const clk = clockOf(p.id, 'RR_MONETARY_DEADLINE');
      const d = clk ? days(clk.dueOn) : null;
      const amount = pending.reduce((s, g) => s + (g.amountPaise ?? 0n), 0n);
      drafts.push({
        key: `RR:${p.id}`,
        type: 'RR_BLOCKING_POSSESSION',
        projectId: p.projectId,
        title: `Possession of ${p.parcelNumber} waits for ${pending.length} R&R entitlement(s)`,
        parcels: [ref(p)],
        families: p.familiesAffected,
        exposurePaise: amount,
        exposureLabel: 'Monetary R&R entitlements not yet delivered',
        perDayPaise: 0n,
        daysToDeadline: d,
        accruing: false,
        legalBar: true,
        evidence: [{ label: 'Undelivered', detail: pending.map((g) => `${g.entitlement.name} (${g.family})`).join('; '), citation: 'RFCTLARR 2013, s.38(1)' }, ...(clk ? [{ label: 'R&R deadline', detail: `${istDateString(clk.dueOn)}`, citation: clk.citation }] : [])],
        brief: {
          headline: `Paid, but the land cannot be taken: ${pending.length} R&R entitlement(s) still due on ${p.parcelNumber}`,
          blocked: `Possession of parcel ${p.parcelNumber} (${p.villageName}).`,
          why: ['Possession is lawful only after R&R entitlements are delivered (s.38(1)).'],
          impact: `${formatInr(amount)} of entitlements to ${p.familiesAffected} families; the project cannot use the land.`,
          action: 'Deliver the listed entitlements (R&R → Delivery) and record each; possession then unblocks.',
          owner: ownerFor(RoleName.RR_OFFICER, p.districtCode, p.stateCode),
          deadline: clk ? istDateString(clk.dueOn) : null,
          deadlineWhy: clk ? 's.38(1) six-month R&R deadline' : 'No statutory deadline recorded',
        },
      });
    }

    // 7. Litigation: confirmed court cases (6.9) that bar progress (a pending
    // title suit, or any order of stay / status quo), and title objections
    // escalated to court. An s.64 reference without a stay runs in parallel
    // with payment and does not block.
    for (const p of parcels) {
      const title = p.objections.find((o) => o.category === 'TITLE' && o.status === 'ESCALATED');
      const cases = p.caseLinks.map((l) => l.courtCase).filter((c) => c.status === 'PENDING' && (c.category === 'TITLE_SUIT' || c.stayOrder));
      if (!title && !cases.length) continue;
      const stay = cases.find((c) => c.stayOrder);
      const clk = clockOf(p.id, 'AWARD_DEADLINE');
      const hearings = cases.map((c) => c.nextHearingOn).filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime());
      const nextHearing = hearings[0] ?? null;
      const caseEvidence = cases.map((c) => ({
        label: `${c.caseNumber}, ${c.courtName}`,
        detail: `${c.subject}. ${c.stayOrder ? 'Order of stay / status quo in force. ' : ''}${c.nextHearingOn ? `Next hearing ${istDateString(c.nextHearingOn)}.` : ''} Link confirmed by an officer${c.isSynthetic ? ' (synthetic eCourts record)' : ''}.`,
        citation: `CNR ${c.cnr}`,
      }));
      const pending = p._count.caseLinks;
      drafts.push({
        key: `LIT:${p.id}`,
        type: 'LITIGATION',
        projectId: p.projectId,
        title: stay ? `Court order holds ${p.parcelNumber}: ${stay.caseNumber}` : `Title dispute on ${p.parcelNumber} in court`,
        parcels: [ref(p)],
        families: p.familiesAffected,
        exposurePaise: valueAtRisk(p),
        exposureLabel: stay ? 'Acquisition value held up while the order stands' : 'Acquisition value at risk if the award lapses while the title is disputed',
        perDayPaise: liab.get(p.id)?.additionalDailyPaise ?? 0n,
        daysToDeadline: clk ? days(clk.dueOn) : nextHearing ? days(nextHearing) : null,
        accruing: false,
        legalBar: true,
        leadTimeDays: LEAD_TIME_DAYS.LITIGATION,
        leadTimeWhy: 'typical time to a first hearing in the civil court (planning assumption)',
        evidence: [
          ...caseEvidence,
          ...(title ? [{ label: 'Objection escalated', detail: `${title.applicant}: title dispute${cases.length ? '' : '; civil suit said to be pending'}.`, citation: 'RFCTLARR 2013, s.15(2)' }] : []),
          ...(pending ? [{ label: 'Unconfirmed court links', detail: `${pending} candidate case link(s) for this parcel await an officer's decision.`, citation: 'eCourts candidate links' }] : []),
        ],
        brief: stay
          ? {
              headline: `A court order holds up ${p.parcelNumber}: ${stay.caseNumber} (${stay.courtName})`,
              blocked: `Any step on parcel ${p.parcelNumber} that the order covers.`,
              why: [`${stay.subject}.`, 'The order binds the Collector until it is varied or the case is disposed of.'],
              impact: `${p.familiesAffected} families; ${formatInr(valueAtRisk(p))} of acquisition value is held up.`,
              action: `Brief the government pleader before the hearing${stay.nextHearingOn ? ` on ${istDateString(stay.nextHearingOn)}` : ''}; fix what the petition complains of so the order can be vacated; take no step the order forbids.`,
              owner: ownerFor(RoleName.DISTRICT_OFFICER, p.districtCode, p.stateCode),
              deadline: stay.nextHearingOn ? istDateString(stay.nextHearingOn) : null,
              deadlineWhy: stay.nextHearingOn ? `next hearing in ${stay.caseNumber}` : 'No hearing date listed',
            }
          : {
              headline: `A family title dispute is holding up ${p.parcelNumber}`,
              blocked: `The award for parcel ${p.parcelNumber}${title ? ': an objection under s.15 is undisposed' : ''}.`,
              why: [
                cases.length ? `A title suit is pending: ${cases.map((c) => `${c.caseNumber} (${c.courtName})`).join('; ')}.` : 'The objection was escalated after the hearing because a civil suit is said to be pending.',
                ...(title ? ['The award cannot be made while the s.15 objection is open.'] : []),
              ],
              impact: `${p.familiesAffected} families; ${clk ? `the award must be made by ${istDateString(clk.dueOn)} or the proceedings lapse` : 'the award cannot proceed'}.`,
              action: cases.length
                ? `Seek an early hearing${nextHearing ? ` (next listed ${istDateString(nextHearing)})` : ''}; consider making the award and depositing the disputed share with the Authority so the dispute does not stop the award; dispose of the objection.`
                : 'Confirm the court case against the parcel (Court case links), seek an early hearing or consider depositing the disputed share with the Authority, and dispose of the objection.',
              owner: ownerFor(RoleName.DISTRICT_OFFICER, p.districtCode, p.stateCode),
              deadline: clk ? istDateString(clk.dueOn) : nextHearing ? istDateString(nextHearing) : null,
              deadlineWhy: clk ? `s.25 award deadline (${clk.citation})` : nextHearing ? 'next hearing' : 'No statutory deadline recorded',
            },
      });
    }

    // Score, apply officer decisions, rank
    const maxMoney = drafts.reduce((m, d) => (d.exposurePaise > m ? d.exposurePaise : m), 0n);
    const maxFam = drafts.reduce((m, d) => Math.max(m, d.families), 0);
    const decisions = await this.latestDecisions(drafts.map((d) => d.key));
    const codes = new Map(projects.map((p) => [p.id, p.code]));
    return drafts
      .map(({ accruing, legalBar, leadTimeDays, leadTimeWhy, ...d }) => {
        const dec = decisions.get(d.key) ?? null;
        return {
          ...d,
          projectCode: codes.get(d.projectId) ?? '',
          decision: dec,
          score: score(statutoryRisk({ daysToDeadline: d.daysToDeadline, accruing, legalBar, leadTimeDays, leadTimeWhy }), moneyComponent(d.exposurePaise, maxMoney), familiesComponent(d.families, maxFam), dec?.decision ?? null),
        };
      })
      .sort((a, b) => b.score.priority - a.score.priority);
  }

  private async owners() {
    const users = await this.prisma.user.findMany({ where: { active: true, role: { in: [RoleName.DISTRICT_OFFICER, RoleName.FINANCE_OFFICER, RoleName.RR_OFFICER, RoleName.STATE_ADMIN] } }, include: { jurisdiction: true } });
    return users.map((u) => ({ role: u.role, name: `${u.name}${u.designation ? `, ${u.designation}` : ''}`, districtCode: u.jurisdiction?.level === 'DISTRICT' ? u.jurisdiction.code : null, stateCode: u.jurisdiction?.stateCode ?? null }));
  }

  private async latestDecisions(keys: string[]) {
    const rows = await this.prisma.bottleneckDecision.findMany({ where: { key: { in: keys } }, orderBy: { createdAt: 'desc' } });
    const users = new Map((await this.prisma.user.findMany({ where: { id: { in: rows.map((r) => r.actorId) } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
    const out = new Map<string, NonNullable<Bottleneck['decision']>>();
    for (const r of rows) if (!out.has(r.key)) out.set(r.key, { decision: r.decision, comment: r.comment, by: users.get(r.actorId) ?? r.actorId, role: r.actorRole, at: r.createdAt });
    return out;
  }

  /** One line per project: how stuck it is and why, for dashboards. */
  async projects(user: AuthUser) {
    const all = await this.bottlenecks(user);
    const projects = await this.prisma.project.findMany({ where: projectScope(user), select: { id: true, code: true, name: true, stateName: true } });
    return projects
      .map((p) => {
        const mine = all.filter((b) => b.projectId === p.id);
        return {
          ...p,
          bottlenecks: mine.length,
          topPriority: mine[0]?.score.priority ?? 0,
          top: mine[0] ? { key: mine[0].key, title: mine[0].title, type: mine[0].type } : null,
          exposurePaise: mine.reduce((s, b) => s + b.exposurePaise, 0n),
          perDayPaise: mine.reduce((s, b) => s + b.perDayPaise, 0n),
          families: mine.reduce((s, b) => s + b.families, 0),
          byType: mine.reduce<Record<string, number>>((m, b) => ({ ...m, [b.type]: (m[b.type] ?? 0) + 1 }), {}),
        };
      })
      .sort((a, b) => b.topPriority - a.topPriority);
  }

  async decide(user: AuthUser, key: string, decision: BriefDecision, comment: string) {
    if (comment.trim().length < 5) throw new BadRequestException('Add a short comment explaining the decision');
    const all = await this.bottlenecks(user);
    const b = all.find((x) => x.key === key);
    if (!b) throw new NotFoundException('No such bottleneck in your jurisdiction (it may already be resolved)');
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.bottleneckDecision.create({ data: { key, projectId: b.projectId, decision, comment, actorId: user.id, actorRole: user.role } });
      await this.audit.append(tx, {
        actor: user,
        action: `BRIEF_${decision}`,
        entityType: 'Bottleneck',
        entityId: key,
        newState: { decision, title: b.title, priorityBefore: b.score.priority, components: { risk: b.score.risk.value, money: b.score.money.value, families: b.score.families.value } },
        reason: comment,
      });
      return row;
    });
  }

  /** Plain-language / translated version of a brief. Labelled; never changes facts. */
  async rephrase(user: AuthUser, key: string, language: 'en' | 'hi' | 'mr') {
    const b = (await this.bottlenecks(user)).find((x) => x.key === key);
    if (!b) throw new NotFoundException('No such bottleneck in your jurisdiction');
    const text = [b.brief.headline, `Blocked: ${b.brief.blocked}`, `Why: ${b.brief.why.join(' ')}`, `Impact: ${b.brief.impact}`, `Next step: ${b.brief.action}`, `Owner: ${b.brief.owner.label}${b.brief.deadline ? `, by ${b.brief.deadline}` : ''}.`].join('\n');
    return { key, source: text, ...(await this.llm.rephrase(text, { language, audience: 'officer' })) };
  }
}
