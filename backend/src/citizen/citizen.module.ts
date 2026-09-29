import { BadRequestException, Body, Controller, ForbiddenException, Get, Inject, Module, NotFoundException, Param, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiQuery, ApiTags } from '@nestjs/swagger';
import { DocumentKind, GrievanceStatus, RoleName } from '@prisma/client';
import { IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import * as crypto from 'crypto';
import { Response } from 'express';
import { AuditService } from '../audit/audit.service';
import { AuthUser, R } from '../auth/auth.types';
import { CurrentUser, Public, Roles } from '../auth/decorators';
import { Clock } from '../common/clock';
import { parcelScope } from '../common/scope';
import { LANGUAGES, TranslationModule } from '../i18n/translation.module';
import { s80Daily, s80Interest } from '../liability/liability';
import { LiabilityModule } from '../liability/liability.module';
import { LiabilityService } from '../liability/liability.service';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE, StorageAdapter } from '../storage/storage';
import { DIGILOCKER_ADAPTER, DigiLockerAdapter, GRIEVANCE_ADAPTER, GrievanceAdapter, SyntheticCpgramsAdapter, SyntheticDigiLockerAdapter } from './adapters';

/** Documents a land holder may see and keep. Internal working papers stay internal. */
export const CITIZEN_DOC_KINDS: DocumentKind[] = ['AWARD_COPY', 'GAZETTE_NOTIFICATION', 'SIA_REPORT', 'GRAM_SABHA_CONSENT', 'POSSESSION_CERTIFICATE', 'PAYMENT_ADVICE'];
export const GRIEVANCE_CATEGORIES = ['AMOUNT', 'PAYMENT_DELAY', 'RR', 'MEASUREMENT', 'HEARING', 'OTHER'] as const;

class LodgeGrievanceDto {
  @ApiProperty() @IsUUID() parcelId: string;
  @ApiProperty({ enum: GRIEVANCE_CATEGORIES }) @IsIn(GRIEVANCE_CATEGORIES) category: (typeof GRIEVANCE_CATEGORIES)[number];
  @ApiProperty({ description: 'In the citizen’s own words, any script' }) @IsString() @Length(10, 2000) description: string;
  @ApiPropertyOptional({ enum: LANGUAGES }) @IsOptional() @IsIn(LANGUAGES) language?: string;
}

class ReplyGrievanceDto {
  @ApiProperty({ enum: ['UNDER_REVIEW', 'RESOLVED'] }) @IsIn(['UNDER_REVIEW', 'RESOLVED']) status: 'UNDER_REVIEW' | 'RESOLVED';
  @ApiProperty() @IsString() @Length(10, 2000) reply: string;
}

@ApiTags('citizen')
@Controller('citizen')
class CitizenController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly liability: LiabilityService,
    private readonly audit: AuditService,
    private readonly clock: Clock,
    @Inject(STORAGE) private readonly storage: StorageAdapter,
    @Inject(GRIEVANCE_ADAPTER) private readonly cpgrams: GrievanceAdapter,
    @Inject(DIGILOCKER_ADAPTER) private readonly digilocker: DigiLockerAdapter,
  ) {}

  private personOf(user: AuthUser): string {
    if (!user.personId) throw new ForbiddenException('Account is not linked to a land holder');
    return user.personId;
  }

  @Public()
  @Get('projects')
  @ApiOperation({ summary: 'Public list of acquisition projects (no personal data)' })
  projects() {
    return this.prisma.project.findMany({
      where: { status: { in: ['APPROVED', 'ACTIVE', 'COMPLETED'] } },
      select: { id: true, code: true, name: true, sector: true, stateName: true, districtNames: true, status: true, requiredAreaHa: true, piaName: true, isSynthetic: true },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * The citizen's own digital twin: every parcel they hold, its stage, notices,
   * award breakdown, their compensation lines (with any s.80 interest owed to
   * them), R&R entitlements, objections and hearings. Only rows linked to the
   * caller's person record are returned.
   */
  @ApiBearerAuth()
  @Roles(RoleName.CITIZEN)
  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    const personId = this.personOf(user);
    const person = await this.prisma.person.findUniqueOrThrow({ where: { id: personId } });
    const holdings = await this.prisma.parcelHolder.findMany({
      where: { personId },
      include: {
        parcel: {
          include: {
            project: { select: { id: true, code: true, name: true, sector: true, piaName: true } },
            village: { select: { name: true, nameLocal: true } },
            notices: { orderBy: { publishedOn: 'asc' } },
            awards: { orderBy: { awardDate: 'desc' } },
            compensations: { where: { personId }, include: { paymentReferences: true } },
            objections: { include: { hearings: { orderBy: { scheduledAt: 'asc' } } } },
            possessions: true,
          },
        },
      },
    });
    const families = await this.prisma.rRCase.findMany({
      where: { parcel: { holders: { some: { personId } } } },
      include: { family: true, grants: { include: { entitlement: true } } },
    });

    // Interest the law says is owed to this person (s.80): compensation not
    // paid before possession earns 9% for a year, then 15%.
    const now = this.clock.now();
    const liab = await this.liability.perParcel(user);
    const interest = new Map<string, { accruedPaise: bigint; dailyPaise: bigint; possessionOn: Date; paidOn: Date | null; ratesBp: [number, number] }>();
    for (const v of liab.values()) {
      for (const f of v.s80) {
        interest.set(f.compensationId, {
          accruedPaise: s80Interest(f.principalPaise, f.possessionOn, f.paidOn ?? now, f.rates),
          dailyPaise: f.paidOn ? 0n : s80Daily(f.principalPaise, f.possessionOn, now, f.rates),
          possessionOn: f.possessionOn,
          paidOn: f.paidOn,
          ratesBp: [f.rates.firstYearBp, f.rates.afterYearBp],
        });
      }
    }
    return {
      asOf: now,
      person: { name: person.name, fatherName: person.fatherName, villageCode: person.villageCode },
      holdings: holdings.map((h) => ({
        sharePct: h.sharePct,
        nameAsRecorded: h.nameAsRecorded,
        parcel: { ...h.parcel, compensations: h.parcel.compensations.map((c) => ({ ...c, interest: interest.get(c.id) ?? null })) },
      })),
      rrCases: families,
    };
  }

  @ApiBearerAuth()
  @Roles(RoleName.CITIZEN)
  @Get('grievances')
  @ApiOperation({ summary: 'My grievances and their replies' })
  grievances(@CurrentUser() user: AuthUser) {
    return this.prisma.grievance.findMany({ where: { personId: this.personOf(user) }, orderBy: { createdAt: 'desc' } });
  }

  @ApiBearerAuth()
  @Roles(RoleName.CITIZEN)
  @Post('grievances')
  @ApiOperation({ summary: 'Lodge a grievance about my land (issued a CPGRAMS-style number; synthetic adapter by default). Audited.' })
  async lodge(@CurrentUser() user: AuthUser, @Body() dto: LodgeGrievanceDto) {
    const personId = this.personOf(user);
    const parcel = await this.prisma.parcel.findFirst({ where: { AND: [{ id: dto.parcelId }, parcelScope(user)] }, select: { id: true, parcelNumber: true } });
    if (!parcel) throw new NotFoundException('Parcel not found among your holdings');
    return this.prisma.$transaction(async (tx) => {
      const { registrationNo } = await this.cpgrams.lodge(tx, dto, this.clock.now());
      const g = await tx.grievance.create({
        data: { registrationNo, channel: this.cpgrams.channel, personId, parcelId: parcel.id, category: dto.category, description: dto.description, language: dto.language ?? 'en' },
      });
      await this.audit.append(tx, {
        actor: user,
        action: 'GRIEVANCE_LODGED',
        entityType: 'Grievance',
        entityId: g.id,
        newState: { registrationNo, channel: g.channel, parcelNumber: parcel.parcelNumber, category: g.category, language: g.language },
      });
      return g;
    });
  }

  @ApiBearerAuth()
  @Roles(RoleName.CITIZEN)
  @Get('documents')
  @ApiOperation({ summary: 'Public documents about my land (award copy, notices, payment advice), with any DigiLocker issue' })
  async documents(@CurrentUser() user: AuthUser) {
    const personId = this.personOf(user);
    const docs = await this.prisma.document.findMany({
      where: { kind: { in: CITIZEN_DOC_KINDS }, parcel: parcelScope(user) },
      select: { id: true, kind: true, title: true, referenceNo: true, issuedOn: true, sha256: true, sizeBytes: true, isSynthetic: true, parcel: { select: { parcelNumber: true, surveyNumber: true, villageName: true } } },
      orderBy: { issuedOn: 'desc' },
    });
    const issued = new Map((await this.prisma.digiLockerIssue.findMany({ where: { personId, documentId: { in: docs.map((d) => d.id) } } })).map((i) => [i.documentId, i]));
    return docs.map((d) => ({ ...d, digilocker: issued.get(d.id) ?? null }));
  }

  private async myDocument(user: AuthUser, id: string) {
    const doc = await this.prisma.document.findFirst({ where: { id, kind: { in: CITIZEN_DOC_KINDS }, parcel: parcelScope(user) } });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  @ApiBearerAuth()
  @Roles(RoleName.CITIZEN)
  @Get('documents/:id/download')
  @ApiOperation({ summary: 'Download one of my documents (checked against its recorded SHA-256)' })
  async download(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    const doc = await this.myDocument(user, id);
    const data = await this.storage.get(doc.storageKey).catch(() => {
      throw new NotFoundException('The file is not available');
    });
    if (crypto.createHash('sha256').update(data).digest('hex') !== doc.sha256) throw new BadRequestException('Stored file does not match its recorded hash');
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${doc.fileName}"`);
    res.send(data);
  }

  @ApiBearerAuth()
  @Roles(RoleName.CITIZEN)
  @Post('documents/:id/digilocker')
  @ApiOperation({ summary: 'Issue this document to my DigiLocker (synthetic adapter by default). Idempotent; audited.' })
  async toDigiLocker(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const personId = this.personOf(user);
    const doc = await this.myDocument(user, id);
    const existing = await this.prisma.digiLockerIssue.findUnique({ where: { documentId_personId: { documentId: doc.id, personId } } });
    if (existing) return existing;
    const { uri } = await this.digilocker.issue(doc, personId);
    return this.prisma.$transaction(async (tx) => {
      const issue = await tx.digiLockerIssue.create({ data: { documentId: doc.id, personId, uri, channel: this.digilocker.channel, sha256: doc.sha256 } });
      await this.audit.append(tx, { actor: user, action: 'DOCUMENT_ISSUED_TO_DIGILOCKER', entityType: 'Document', entityId: doc.id, newState: { channel: issue.channel, uri, sha256: doc.sha256 } });
      return issue;
    });
  }
}

/** The officers' side of citizen grievances. */
@ApiTags('grievances')
@ApiBearerAuth()
@Roles(...R.OFFICIALS)
@Controller('grievances')
class GrievancesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clock: Clock,
  ) {}

  @Get()
  @ApiQuery({ name: 'status', required: false, enum: GrievanceStatus })
  @ApiOperation({ summary: 'Citizen grievances about parcels in your jurisdiction' })
  async list(@CurrentUser() user: AuthUser, @Query('status') status?: GrievanceStatus) {
    if (status && !Object.values(GrievanceStatus).includes(status)) throw new BadRequestException('Unknown status');
    const parcels = await this.prisma.parcel.findMany({ where: parcelScope(user), select: { id: true, parcelNumber: true, villageName: true, surveyNumber: true } });
    const byId = new Map(parcels.map((p) => [p.id, p]));
    const rows = await this.prisma.grievance.findMany({ where: { status, parcelId: { in: [...byId.keys()] } }, orderBy: { createdAt: 'desc' }, take: 500 });
    const people = new Map((await this.prisma.person.findMany({ where: { id: { in: rows.map((r) => r.personId) } }, select: { id: true, name: true } })).map((p) => [p.id, p.name]));
    return rows.map((g) => ({ ...g, parcel: byId.get(g.parcelId), citizenName: people.get(g.personId) ?? null }));
  }

  @Post(':id/reply')
  @Roles(...R.ACQUISITION, RoleName.RR_OFFICER, RoleName.FINANCE_OFFICER)
  @ApiOperation({ summary: 'Reply to a grievance and set its status. Audited; the citizen sees the reply.' })
  async reply(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReplyGrievanceDto) {
    const g = await this.prisma.grievance.findUnique({ where: { id } });
    if (!g || !(await this.prisma.parcel.findFirst({ where: { AND: [{ id: g.parcelId }, parcelScope(user)] }, select: { id: true } }))) throw new NotFoundException('Grievance not found');
    if (g.status === GrievanceStatus.RESOLVED) throw new BadRequestException('Already resolved');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.grievance.update({ where: { id }, data: { status: dto.status, reply: dto.reply, repliedById: user.id, repliedAt: this.clock.now() } });
      await this.audit.append(tx, {
        actor: user,
        action: dto.status === 'RESOLVED' ? 'GRIEVANCE_RESOLVED' : 'GRIEVANCE_REPLIED',
        entityType: 'Grievance',
        entityId: id,
        previousState: { status: g.status },
        newState: { status: dto.status, registrationNo: g.registrationNo },
      });
      return updated;
    });
  }
}

@Module({
  imports: [LiabilityModule, TranslationModule],
  controllers: [CitizenController, GrievancesController],
  providers: [
    { provide: GRIEVANCE_ADAPTER, useFactory: () => new SyntheticCpgramsAdapter() },
    { provide: DIGILOCKER_ADAPTER, useFactory: () => new SyntheticDigiLockerAdapter() },
  ],
})
export class CitizenModule {}
