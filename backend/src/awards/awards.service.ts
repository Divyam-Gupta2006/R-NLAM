import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { NoticeKind, Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { canonicalJson } from '../common/canonical-json';
import { istDateString } from '../common/dates';
import { rupeesToPaise } from '../common/money';
import { parcelScope } from '../common/scope';
import { LifecycleService } from '../lifecycle/lifecycle.service';
import { PrismaService } from '../prisma/prisma.service';
import { RulesService } from '../rules/rules.service';
import { AwardBreakdown, calculateAward } from './award-calculator';
import { splitByShare } from './split';

export interface AwardRequest {
  parcelId: string;
  awardDate: Date;
  assetsValueRupees?: number;
  override?: boolean;
  reason?: string;
}

@Injectable()
export class AwardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: RulesService,
    private readonly lifecycle: LifecycleService,
  ) {}

  async list(user: AuthUser, projectId?: string) {
    return this.prisma.award.findMany({
      where: { projectId, parcel: parcelScope(user) },
      include: { parcel: { select: { parcelNumber: true, surveyNumber: true, villageName: true, displayOwnerName: true, stage: true } } },
      orderBy: { awardDate: 'desc' },
    });
  }

  /** Compute without saving: what the award would be, line by line, with citations. */
  async preview(user: AuthUser, req: AwardRequest) {
    const parcel = await this.prisma.parcel.findFirst({ where: { AND: [{ id: req.parcelId }, parcelScope(user)] }, include: { notices: true, holders: true } });
    if (!parcel) throw new NotFoundException('Parcel not found');
    return this.compute(parcel, req);
  }

  private async compute(
    parcel: Prisma.ParcelGetPayload<{ include: { notices: true; holders: true } }>,
    req: AwardRequest,
  ): Promise<{ breakdown: AwardBreakdown; packCode: string; packs: string[]; unverified: string[]; additionalFrom: Date; additionalFromEvent: string }> {
    if (!parcel.marketRatePaisePerHa) throw new BadRequestException('Parcel has no market rate recorded (s.26)');
    const earliest = (kind: NoticeKind) => parcel.notices.filter((n) => n.kind === kind).sort((a, b) => +a.publishedOn - +b.publishedOn)[0];
    const sec11 = earliest(NoticeKind.SEC_11_PRELIMINARY);
    if (!sec11) throw new BadRequestException('Parcel has no s.11 preliminary notification');

    // Rules in force on the award date decide the money.
    const res = await this.rules.awardRules(parcel, req.awardDate);
    const unverified = [...res.unverified];
    // s.30(3): the additional amount runs from the s.4(2) SIA notification.
    const startNotice = res.additionalStartEvent === 'SEC_4_SIA' ? earliest(NoticeKind.SEC_4_SIA) : earliest(res.additionalStartEvent as NoticeKind);
    let additionalFrom = startNotice?.publishedOn;
    let additionalFromEvent = res.additionalStartEvent;
    if (!additionalFrom) {
      additionalFrom = sec11.publishedOn;
      additionalFromEvent = 'SEC_11_PRELIMINARY';
      unverified.push('Additional amount start date: no s.4(2) SIA notification on record, s.11 date used (e.g. SIA exemption)');
    }

    const breakdown = calculateAward(
      {
        areaHa: parcel.totalAreaHa,
        marketRatePaisePerHa: parcel.marketRatePaisePerHa,
        assetsValuePaise: rupeesToPaise(req.assetsValueRupees ?? 0),
        additionalFrom,
        cutoffDate: req.awardDate,
      },
      res.rules,
    );
    return { breakdown, packCode: res.packCode, packs: res.packs, unverified, additionalFrom, additionalFromEvent };
  }

  /**
   * Declare the award: Award row with its calculation trace, one Compensation
   * row per holder (split by share, exact to the paisa), and the parcel
   * transition DECLARED → AWARDED, atomically.
   */
  async declare(user: AuthUser, req: AwardRequest) {
    const parcel = await this.prisma.parcel.findFirst({
      where: { AND: [{ id: req.parcelId }, parcelScope(user)] },
      include: { notices: true, holders: { include: { person: true } } },
    });
    if (!parcel) throw new NotFoundException('Parcel not found');
    if (parcel.holders.length === 0) throw new BadRequestException('Parcel has no recorded holders to compensate');
    if (req.override && (req.reason?.trim().length ?? 0) < 20) throw new BadRequestException('An override needs a reason of at least 20 characters (e.g. the extension order reference)');

    const { breakdown, packCode, packs, unverified, additionalFrom, additionalFromEvent } = await this.compute(parcel, req);
    const shares = splitByShare(
      breakdown.totalPaise,
      parcel.holders.map((h) => ({ sharePct: h.sharePct, personId: h.personId, name: h.nameAsRecorded })),
    );

    return this.prisma.$transaction(
      async (tx) => {
        const count = await tx.award.count({ where: { parcel: { districtCode: parcel.districtCode } } });
        const award = await tx.award.create({
          data: {
            awardNumber: `AWD/${parcel.districtCode}/${istDateString(req.awardDate).slice(0, 4)}/${String(count + 1).padStart(4, '0')}`,
            projectId: parcel.projectId,
            parcelId: parcel.id,
            awardDate: req.awardDate,
            marketValuePaise: breakdown.marketValuePaise,
            multiplier: new Prisma.Decimal(breakdown.multiplier),
            assetsValuePaise: breakdown.assetsValuePaise,
            solatiumPaise: breakdown.solatiumPaise,
            additionalAmountPaise: breakdown.additionalAmountPaise,
            totalPaise: breakdown.totalPaise,
            calculation: JSON.parse(canonicalJson({ ...breakdown, packCode, packs, unverified, additionalFrom, additionalFromEvent })) as Prisma.InputJsonValue,
          },
        });
        for (const s of shares) {
          await tx.compensation.create({
            data: {
              projectId: parcel.projectId,
              parcelId: parcel.id,
              awardId: award.id,
              personId: s.personId,
              beneficiaryName: s.name,
              sharePct: s.sharePct,
              amountPaise: s.amountPaise,
            },
          });
        }
        await this.lifecycle.transitionInTx(tx, {
          entityType: 'Parcel',
          entityId: parcel.id,
          event: 'DECLARE_AWARD',
          actor: user,
          fromDomainService: true,
          override: req.override,
          reason: req.reason ?? `Award ${award.awardNumber}`,
          context: { awardId: award.id, awardNumber: award.awardNumber, totalPaise: award.totalPaise },
        });
        return award;
      },
      { timeout: 30_000 },
    );
  }
}
