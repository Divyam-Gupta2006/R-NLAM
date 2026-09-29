import { BadRequestException, Body, Controller, Get, HttpCode, Injectable, Module, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiQuery, ApiTags } from '@nestjs/swagger';
import { MatchStatus, Prisma, PrismaClient, RoleName } from '@prisma/client';
import { IsIn, IsString, Length } from 'class-validator';
import { AuditService } from '../audit/audit.service';
import { AuthUser, R } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { Clock } from '../common/clock';
import { PrismaService } from '../prisma/prisma.service';
import { matchPersons, PersonFacts } from './matcher';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Build candidate links (blocking by village) and store them. Idempotent:
 * decided links are left alone; pending ones are refreshed. Shared by the API
 * and the demo seed.
 */
export async function runReconciliation(db: Db) {
  const persons = await db.person.findMany({
    include: {
      holdings: { select: { parcelId: true, source: true } },
      compensations: { select: { parcelId: true } },
    },
  });
  const facts: PersonFacts[] = persons.map((p) => ({
    id: p.id,
    name: p.name,
    fatherName: p.fatherName,
    villageCode: p.villageCode,
    idHash: p.idHash,
    source: p.source,
    parcelIds: [...new Set([...p.holdings.map((h) => h.parcelId), ...p.compensations.map((c) => c.parcelId)])],
    holderParcelIds: p.holdings.filter((h) => h.source === 'LAND_RECORDS').map((h) => h.parcelId),
    hasCompensation: p.compensations.length > 0,
  }));
  const byVillage = new Map<string, PersonFacts[]>();
  for (const f of facts) byVillage.set(f.villageCode ?? '?', [...(byVillage.get(f.villageCode ?? '?') ?? []), f]);

  const existing = new Map((await db.personMatch.findMany()).map((m) => [`${m.personAId}|${m.personBId}`, m]));
  let candidates = 0;
  let autoLinked = 0;
  const found = new Set<string>();
  for (const group of byVillage.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const [a, b] = group[i].id < group[j].id ? [group[i], group[j]] : [group[j], group[i]];
        const m = matchPersons(a, b);
        if (!m) continue;
        found.add(`${a.id}|${b.id}`);
        const prior = existing.get(`${a.id}|${b.id}`);
        if (prior && prior.status !== MatchStatus.PENDING) continue;
        const status = m.band === 'AUTO_LINK' ? MatchStatus.AUTO_LINKED : MatchStatus.PENDING;
        await db.personMatch.upsert({
          where: { personAId_personBId: { personAId: a.id, personBId: b.id } },
          create: { personAId: a.id, personBId: b.id, confidence: m.confidence, reasons: m.reasons as unknown as Prisma.InputJsonValue, requiresHuman: m.requiresHuman, status },
          update: { confidence: m.confidence, reasons: m.reasons as unknown as Prisma.InputJsonValue, requiresHuman: m.requiresHuman, status },
        });
        if (status === MatchStatus.AUTO_LINKED) {
          autoLinked++;
          await db.person.updateMany({ where: { id: { in: [a.id, b.id] } }, data: { identityGroupId: a.id } });
        } else candidates++;
      }
    }
  }
  // Pending candidates that no longer match (rules or records changed) are withdrawn.
  const stale = [...existing.values()].filter((m) => m.status === MatchStatus.PENDING && !found.has(`${m.personAId}|${m.personBId}`));
  if (stale.length) await db.personMatch.deleteMany({ where: { id: { in: stale.map((m) => m.id) } } });
  return { persons: persons.length, candidates, autoLinked, withdrawn: stale.length };
}

class DecisionDto {
  @ApiProperty({ enum: ['CONFIRM', 'REJECT', 'UNLINK'] }) @IsIn(['CONFIRM', 'REJECT', 'UNLINK']) decision: 'CONFIRM' | 'REJECT' | 'UNLINK';
  @ApiProperty({ example: 'Verified with the 7/12 extract and Aadhaar-seeded bank account in person at the Tehsil office' }) @IsString() @Length(10, 2000) comment: string;
}

@Injectable()
class ReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clock: Clock,
  ) {}

  /** Villages the caller may see (codes start with the district code, e.g. MH-WRD-…). */
  private villageFilter(user: AuthUser): Prisma.PersonWhereInput {
    if (user.role === RoleName.CENTRAL_ADMIN || user.role === RoleName.CENTRAL_OFFICER) return {};
    if (user.districtCode) return { villageCode: { startsWith: `${user.districtCode}-` } };
    if (user.stateCode) return { villageCode: { startsWith: `${user.stateCode}-` } };
    return {};
  }

  async queue(user: AuthUser, status?: MatchStatus) {
    const visible = new Set((await this.prisma.person.findMany({ where: this.villageFilter(user), select: { id: true } })).map((p) => p.id));
    const matches = await this.prisma.personMatch.findMany({ where: { status: status ?? { in: [MatchStatus.PENDING, MatchStatus.AUTO_LINKED] } }, orderBy: [{ requiresHuman: 'desc' }, { confidence: 'desc' }] });
    const ids = [...new Set(matches.flatMap((m) => [m.personAId, m.personBId]))];
    const people = new Map(
      (await this.prisma.person.findMany({
        where: { id: { in: ids } },
        include: { holdings: { include: { parcel: { select: { id: true, parcelNumber: true, villageName: true } } } }, compensations: { select: { id: true, amountPaise: true, status: true, parcelId: true } } },
      })).map((p) => [p.id, p]),
    );
    return matches
      .filter((m) => visible.has(m.personAId) || visible.has(m.personBId))
      .map((m) => ({ ...m, a: people.get(m.personAId), b: people.get(m.personBId) }));
  }

  async decide(user: AuthUser, id: string, dto: DecisionDto) {
    const m = await this.prisma.personMatch.findUnique({ where: { id } });
    if (!m) throw new NotFoundException('Match not found');
    const allowed: Record<DecisionDto['decision'], MatchStatus[]> = {
      CONFIRM: [MatchStatus.PENDING, MatchStatus.AUTO_LINKED],
      REJECT: [MatchStatus.PENDING, MatchStatus.AUTO_LINKED],
      UNLINK: [MatchStatus.CONFIRMED, MatchStatus.AUTO_LINKED],
    };
    if (!allowed[dto.decision].includes(m.status)) throw new BadRequestException(`Match is ${m.status}; cannot ${dto.decision.toLowerCase()}`);
    const status = dto.decision === 'CONFIRM' ? MatchStatus.CONFIRMED : dto.decision === 'REJECT' ? MatchStatus.REJECTED : MatchStatus.UNLINKED;
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.personMatch.update({ where: { id }, data: { status, decidedById: user.id, decidedAt: this.clock.now(), comment: dto.comment } });
      await tx.person.updateMany({ where: { id: { in: [m.personAId, m.personBId] } }, data: { identityGroupId: status === MatchStatus.CONFIRMED ? m.personAId : null } });
      await this.audit.append(tx, {
        actor: user,
        action: `IDENTITY_${dto.decision}`,
        entityType: 'PersonMatch',
        entityId: id,
        previousState: { status: m.status },
        newState: { status, personAId: m.personAId, personBId: m.personBId, confidence: m.confidence },
        reason: dto.comment,
      });
      return updated;
    });
  }
}

@ApiTags('reconciliation')
@ApiBearerAuth()
@Roles(...R.OFFICIALS)
@Controller('reconciliation')
class ReconciliationController {
  constructor(
    private readonly service: ReconciliationService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('queue')
  @ApiOperation({ summary: 'Candidate identity links for human verification (and auto-links, which stay reversible)' })
  @ApiQuery({ name: 'status', required: false, enum: MatchStatus })
  queue(@CurrentUser() user: AuthUser, @Query('status') status?: MatchStatus) {
    return this.service.queue(user, status);
  }

  @Post('run')
  @HttpCode(200)
  @Roles(...R.ACQUISITION)
  @ApiOperation({ summary: 'Recompute candidate links across all person records (blocking by village)' })
  async run(@CurrentUser() user: AuthUser) {
    const r = await runReconciliation(this.prisma);
    await this.audit.log({ actor: user, action: 'RECONCILIATION_RUN', entityType: 'System', entityId: 'reconciliation', newState: r });
    return r;
  }

  @Post('matches/:id/decision')
  @HttpCode(200)
  @Roles(...R.ACQUISITION, RoleName.FINANCE_OFFICER)
  @ApiOperation({ summary: 'Confirm, reject or unlink a candidate. Records are never merged; confirming links them. Audited.' })
  decide(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: DecisionDto) {
    return this.service.decide(user, id, dto);
  }
}

@Module({ controllers: [ReconciliationController], providers: [ReconciliationService] })
export class ReconciliationModule {}
