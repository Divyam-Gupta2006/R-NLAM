import { BadRequestException, Body, Controller, Get, Inject, Module, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CaseLinkStatus, Prisma, PrismaClient } from '@prisma/client';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import { AuditService } from '../audit/audit.service';
import { AuthUser, R } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { parcelScope } from '../common/scope';
import { PrismaService } from '../prisma/prisma.service';
import { proposeLink } from './case-matcher';
import { ECOURTS, EcourtsAdapter, SyntheticEcourtsAdapter } from './ecourts.adapter';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Fetch cases for every district with parcels, store them, and propose
 * links. Idempotent: decided links are never touched; candidates are
 * refreshed, and candidates that no longer match are dropped. Shared by the
 * API and the demo seed.
 */
export async function syncCourtCases(db: Db, adapter: EcourtsAdapter, districtCodes?: string[]) {
  const districts = districtCodes ?? (await db.parcel.findMany({ distinct: ['districtCode'], select: { districtCode: true } })).map((d) => d.districtCode);
  let cases = 0;
  let candidates = 0;
  for (const districtCode of districts) {
    const records = await adapter.casesForDistrict(districtCode);
    if (!records.length) continue;
    const parcels = await db.parcel.findMany({
      where: { districtCode },
      select: { id: true, districtCode: true, villageName: true, surveyNumber: true, holders: { select: { nameAsRecorded: true } } },
    });
    for (const r of records) {
      const data = {
        courtName: r.courtName,
        caseType: r.caseType,
        caseNumber: r.caseNumber,
        category: r.category,
        status: r.status,
        stayOrder: r.stayOrder,
        filedOn: new Date(r.filedOn),
        nextHearingOn: r.nextHearingOn ? new Date(r.nextHearingOn) : null,
        disposedOn: r.disposedOn ? new Date(r.disposedOn) : null,
        petitioners: r.petitioners,
        respondents: r.respondents,
        subject: r.subject,
        surveyNumbers: r.surveyNumbers,
        villageName: r.villageName,
        districtCode: r.districtCode,
        source: adapter.source,
        isSynthetic: adapter.source.endsWith('SYNTHETIC'),
        fetchedAt: new Date(),
      };
      const kase = await db.courtCase.upsert({ where: { cnr: r.cnr }, create: { cnr: r.cnr, ...data }, update: data });
      cases++;
      const facts = { districtCode: r.districtCode, villageName: r.villageName, surveyNumbers: r.surveyNumbers, parties: [...r.petitioners, ...r.respondents] };
      const found = new Set<string>();
      for (const p of parcels) {
        const m = proposeLink(facts, { districtCode: p.districtCode, villageName: p.villageName, surveyNumber: p.surveyNumber, holderNames: p.holders.map((h) => h.nameAsRecorded) });
        if (!m) continue;
        found.add(p.id);
        const prior = await db.caseLink.findUnique({ where: { courtCaseId_parcelId: { courtCaseId: kase.id, parcelId: p.id } } });
        if (prior && prior.status !== CaseLinkStatus.CANDIDATE) continue;
        await db.caseLink.upsert({
          where: { courtCaseId_parcelId: { courtCaseId: kase.id, parcelId: p.id } },
          create: { courtCaseId: kase.id, parcelId: p.id, score: m.score, reasons: m.reasons as unknown as Prisma.InputJsonValue },
          update: { score: m.score, reasons: m.reasons as unknown as Prisma.InputJsonValue },
        });
        candidates++;
      }
      await db.caseLink.deleteMany({ where: { courtCaseId: kase.id, status: CaseLinkStatus.CANDIDATE, parcelId: { notIn: [...found] } } });
    }
  }
  return { source: adapter.source, districts: districts.length, cases, candidates };
}

class ReviewLinkDto {
  @ApiProperty({ enum: ['CONFIRM', 'REJECT'] }) @IsIn(['CONFIRM', 'REJECT']) decision: 'CONFIRM' | 'REJECT';
  @ApiPropertyOptional({ description: 'Required (≥ 10 characters) to reject' }) @IsOptional() @IsString() @Length(0, 1000) note?: string;
}

const LINK_INCLUDE = {
  courtCase: true,
  parcel: { select: { id: true, parcelNumber: true, surveyNumber: true, villageName: true, districtName: true, stage: true, project: { select: { code: true } }, holders: { select: { nameAsRecorded: true } } } },
} satisfies Prisma.CaseLinkInclude;

@ApiTags('court-links')
@ApiBearerAuth()
@Roles(...R.OFFICIALS)
@Controller('court-links')
export class CourtLinksController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(ECOURTS) private readonly adapter: EcourtsAdapter,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Proposed and decided links between court cases and parcels in your jurisdiction, with the reasons for each' })
  @ApiQuery({ name: 'status', required: false, enum: CaseLinkStatus })
  @ApiQuery({ name: 'parcelId', required: false })
  list(@CurrentUser() user: AuthUser, @Query('status') status?: CaseLinkStatus, @Query('parcelId') parcelId?: string) {
    if (status && !Object.values(CaseLinkStatus).includes(status)) throw new BadRequestException('Unknown status');
    return this.prisma.caseLink.findMany({
      where: { status, parcelId, parcel: parcelScope(user) },
      include: LINK_INCLUDE,
      orderBy: [{ status: 'asc' }, { score: 'desc' }],
    });
  }

  @Post('sync')
  @Roles(...R.ACQUISITION)
  @ApiOperation({ summary: 'Fetch cases from the eCourts adapter (synthetic by default) and refresh candidate links. Decided links are kept.' })
  async sync(@CurrentUser() user: AuthUser) {
    const r = await syncCourtCases(this.prisma, this.adapter);
    await this.audit.log({ actor: user, action: 'COURT_CASES_SYNCED', entityType: 'System', entityId: 'ecourts', newState: r });
    return r;
  }

  @Post(':id/review')
  @Roles(...R.ACQUISITION)
  @ApiOperation({ summary: 'Confirm or reject a candidate link (audited). Confirmed pending title suits and stay orders feed "Why is it stuck?".' })
  async review(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReviewLinkDto) {
    const link = await this.prisma.caseLink.findFirst({ where: { id, parcel: parcelScope(user) }, include: LINK_INCLUDE });
    if (!link) throw new NotFoundException('Link not found');
    if (link.status !== CaseLinkStatus.CANDIDATE) throw new BadRequestException(`Already ${link.status.toLowerCase()}`);
    if (dto.decision === 'REJECT' && (dto.note ?? '').trim().length < 10) throw new BadRequestException('Give a reason (at least 10 characters) for rejecting');
    const status = dto.decision === 'CONFIRM' ? CaseLinkStatus.CONFIRMED : CaseLinkStatus.REJECTED;
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.caseLink.update({
        where: { id },
        data: { status, reviewNote: dto.note, reviewedById: user.id, reviewedAt: new Date() },
        include: LINK_INCLUDE,
      });
      await this.audit.append(tx, {
        actor: user,
        action: status === CaseLinkStatus.CONFIRMED ? 'COURT_CASE_LINK_CONFIRMED' : 'COURT_CASE_LINK_REJECTED',
        entityType: 'CaseLink',
        entityId: id,
        previousState: { status: link.status, score: link.score },
        newState: { status, cnr: link.courtCase.cnr, caseNumber: link.courtCase.caseNumber, parcelNumber: link.parcel.parcelNumber, note: dto.note ?? null },
      });
      return updated;
    });
  }
}

@Module({
  controllers: [CourtLinksController],
  providers: [{ provide: ECOURTS, useFactory: () => new SyntheticEcourtsAdapter() }],
})
export class CourtModule {}
