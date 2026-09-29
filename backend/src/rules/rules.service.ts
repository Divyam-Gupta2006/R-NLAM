import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient, RulePackStatus } from '@prisma/client';
import { AwardRules } from '../awards/award-calculator';
import { parseIstDate } from '../common/dates';
import { PrismaService } from '../prisma/prisma.service';
import { multiplierFor, PackLike, Resolution, resolveRules, ruleValue } from './resolve';
import { PackSeed, SHIPPED_PACKS } from './rule-packs.data';

export const DEFAULT_ACT = 'RFCTLARR_2013';

export interface ParcelForRules {
  stateCode: string;
  isRural: boolean;
  distanceFromUrbanKm: number | null;
}

export interface AwardRuleResolution {
  rules: AwardRules;
  packCode: string;
  packs: string[];
  /** Keys whose values are not yet verified against the statute. */
  unverified: string[];
  additionalStartEvent: string;
}

/** Upsert shipped packs (idempotent, by code). Used by the seed and on first boot. */
export async function installPacks(prisma: PrismaClient | Prisma.TransactionClient, packs: PackSeed[] = SHIPPED_PACKS) {
  for (const p of packs) {
    const pack = await prisma.rulePack.upsert({
      where: { code: p.code },
      create: {
        code: p.code,
        actCode: p.actCode,
        stateCode: p.stateCode,
        version: p.version,
        title: p.title,
        source: p.source,
        effectiveFrom: parseIstDate(p.effectiveFrom),
        effectiveTo: p.effectiveTo ? parseIstDate(p.effectiveTo) : null,
        status: RulePackStatus.ACTIVE,
      },
      update: { title: p.title, source: p.source },
    });
    for (const e of p.entries) {
      const data = {
        category: e.category,
        label: e.label,
        value: e.value as Prisma.InputJsonValue,
        unit: e.unit,
        citation: e.citation,
        quote: e.quote,
        unverified: e.unverified ?? false,
        note: e.note,
      };
      await prisma.ruleEntry.upsert({ where: { packId_key: { packId: pack.id, key: e.key } }, create: { packId: pack.id, key: e.key, ...data }, update: data });
    }
  }
}

/**
 * Database-backed rule resolution. Packs are cached briefly; every lookup is
 * resolved for a specific state and date, so historical cases use the rules
 * that were in force when their event happened.
 */
@Injectable()
export class RulesService {
  private cache: { at: number; packs: PackLike[] } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  invalidate() {
    this.cache = null;
  }

  async packs(): Promise<PackLike[]> {
    if (this.cache && Date.now() - this.cache.at < 60_000) return this.cache.packs;
    const rows = await this.prisma.rulePack.findMany({ include: { entries: true } });
    const packs: PackLike[] = rows.map((p) => ({ ...p, entries: p.entries }));
    this.cache = { at: Date.now(), packs };
    return packs;
  }

  async resolve(stateCode: string, on: Date, actCode = DEFAULT_ACT): Promise<Resolution> {
    return resolveRules(await this.packs(), actCode, stateCode, on);
  }

  /** Synchronous resolver over a snapshot, for computing many clocks at once. */
  async resolverFor(stateCode: string, actCode = DEFAULT_ACT): Promise<(on: Date) => Resolution> {
    const packs = await this.packs();
    return (on: Date) => resolveRules(packs, actCode, stateCode, on);
  }

  /** Money rules for an award, resolved on the date the additional amount starts. */
  async awardRules(parcel: ParcelForRules, onDate: Date): Promise<AwardRuleResolution> {
    const r = await this.resolve(parcel.stateCode, onDate);
    const mult = multiplierFor(r, parcel.isRural, parcel.distanceFromUrbanKm);
    const sol = ruleValue<number>(r, 'money.solatium.bp');
    const add = ruleValue<number>(r, 'money.additional.bp_per_year');
    const start = ruleValue<string>(r, 'money.additional.start_event');
    const used = [mult.rule, sol.rule, add.rule, start.rule];
    return {
      rules: {
        multiplierHundredths: mult.hundredths,
        multiplierCitation: mult.rule.citation,
        solatiumBp: sol.value,
        solatiumCitation: sol.rule.citation,
        additionalBpPerYear: add.value,
        additionalCitation: add.rule.citation,
        dayCountBasis: 365,
      },
      packCode: r.statePack ?? r.centralPack ?? 'none',
      packs: [r.centralPack, r.statePack].filter((x): x is string => !!x),
      unverified: used.filter((u) => u.unverified).map((u) => `${u.label} (${u.packCode})`),
      additionalStartEvent: start.value,
    };
  }

  async listPacks() {
    return this.prisma.rulePack.findMany({
      include: { _count: { select: { entries: true } } },
      orderBy: [{ actCode: 'asc' }, { stateCode: 'asc' }, { version: 'desc' }],
    });
  }

  async getPack(code: string) {
    const pack = await this.prisma.rulePack.findUnique({ where: { code }, include: { entries: { orderBy: [{ category: 'asc' }, { key: 'asc' }] } } });
    if (!pack) throw new NotFoundException(`Rule pack ${code} not found`);
    return pack;
  }
}
