import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Inject,
  Module,
  NotFoundException,
  Param,
  Post,
  Query,
  UnprocessableEntityException,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiProperty, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FieldEvidenceStatus, Prisma, RoleName } from '@prisma/client';
import { IsIn, IsString, IsUUID, Length } from 'class-validator';
import * as crypto from 'crypto';
import { AuditService } from '../audit/audit.service';
import { AuthUser, R } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { Clock } from '../common/clock';
import { parcelScope } from '../common/scope';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE, StorageAdapter } from '../storage/storage';
import { bundleSeal, EvidenceBundle, photoMismatch, validateBundle } from './field-evidence';
import { evidenceGeometryCheck } from './field-geo';

const PHOTO_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

class FieldCheckDto {
  @ApiProperty() @IsUUID() parcelId: string;
  @ApiProperty({ example: 'New structure (about 210 m²) since the s.11 notification' }) @IsString() @Length(5, 300) finding: string;
}

class ResolveDto {
  @ApiProperty({ enum: ['ACCEPT', 'REJECT'] }) @IsIn(['ACCEPT', 'REJECT']) decision: 'ACCEPT' | 'REJECT';
  @ApiProperty({ description: 'Why (at least 10 characters)' }) @IsString() @Length(10, 1000) note: string;
}

@ApiTags('field')
@ApiBearerAuth()
@Controller('field')
export class FieldController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clock: Clock,
    @Inject(STORAGE) private readonly storage: StorageAdapter,
  ) {}

  @Post('evidence')
  @Roles(...R.FIELD)
  @HttpCode(200)
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { bundle: { type: 'string', description: 'Sealed evidence bundle (JSON) including bundleHash' }, photos: { type: 'array', items: { type: 'string', format: 'binary' } } } } })
  @ApiOperation({
    summary: 'Upload one sealed field-evidence bundle (idempotent on clientId)',
    description:
      'The server recomputes the SHA-256 seal and every photo hash and refuses a mismatch (422). A repeat of the same bundle returns the stored result. If another officer surveyed the parcel after this device last synced, the bundle is kept as CONFLICT for a supervisor instead of overwriting.',
  })
  @UseInterceptors(FilesInterceptor('photos', 6, { limits: { fileSize: MAX_PHOTO_BYTES } }))
  async upload(@CurrentUser() user: AuthUser, @UploadedFiles() files: Express.Multer.File[] | undefined, @Body('bundle') bundleText: string) {
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(bundleText ?? '');
    } catch {
      throw new BadRequestException('bundle must be JSON');
    }
    const now = this.clock.now();
    // Devices keep real time; a pinned demo clock must not make them look "in the future".
    const problems = validateBundle(raw, new Date(Math.max(Date.now(), now.getTime())));
    if (problems.length) throw new BadRequestException(problems);
    const b = raw as unknown as EvidenceBundle & { bundleHash: string };

    const parcel = await this.prisma.parcel.findFirst({ where: { AND: [{ id: b.parcelId }, parcelScope(user)] }, select: { id: true, parcelNumber: true, projectId: true } });
    if (!parcel) throw new NotFoundException('Parcel not found in your jurisdiction');

    const existing = await this.prisma.fieldEvidence.findUnique({ where: { clientId: b.clientId } });
    if (existing) {
      if (existing.bundleHash === b.bundleHash) return { duplicate: true, evidence: existing };
      throw new ConflictException('A different bundle was already uploaded with this clientId');
    }

    const photos = files ?? [];
    for (const f of photos) if (!PHOTO_MIME.includes(f.mimetype)) throw new BadRequestException(`Unsupported photo type ${f.mimetype}`);
    const received = photos.map((f) => crypto.createHash('sha256').update(f.buffer).digest('hex'));
    const seal = bundleSeal(raw);
    const photoProblem = photoMismatch(b.photoHashes, received);
    if (seal !== b.bundleHash || photoProblem) {
      const why = photoProblem ?? 'The bundle does not match its device seal (SHA-256 mismatch): it was altered after capture or in transit';
      await this.audit.log({ actor: user, action: 'FIELD_EVIDENCE_REFUSED', entityType: 'Parcel', entityId: parcel.id, newState: { clientId: b.clientId, deviceSeal: b.bundleHash, serverSeal: seal, reason: why } });
      throw new UnprocessableEntityException(why);
    }

    const geo = await evidenceGeometryCheck(this.prisma, parcel.id, b);
    // Conflict: an accepted survey of the same kind by someone else that this device had not seen.
    const since = b.baseSyncedAt ? new Date(b.baseSyncedAt) : new Date(0);
    const unseen = await this.prisma.fieldEvidence.findFirst({
      where: { parcelId: parcel.id, kind: b.kind, status: FieldEvidenceStatus.ACCEPTED, capturedById: { not: user.id }, receivedAt: { gt: since } },
      orderBy: { receivedAt: 'desc' },
    });
    const status = unseen ? FieldEvidenceStatus.CONFLICT : FieldEvidenceStatus.ACCEPTED;

    const stored: Array<{ file: Express.Multer.File; obj: Awaited<ReturnType<StorageAdapter['put']>> }> = [];
    for (const [i, f] of photos.entries()) {
      const key = `field/${parcel.id}/${b.clientId}-${i + 1}.${f.mimetype.split('/')[1]}`;
      stored.push({ file: f, obj: await this.storage.put(key, f.buffer) });
    }

    return this.prisma.$transaction(async (tx) => {
      const docs = [];
      for (const [i, s] of stored.entries()) {
        docs.push(
          await tx.document.create({
            data: {
              kind: 'FIELD_PHOTO',
              title: `Field photo ${i + 1}, ${parcel.parcelNumber}`,
              fileName: s.obj.key.split('/').pop()!,
              storageBackend: s.obj.backend,
              storageKey: s.obj.key,
              sha256: s.obj.sha256,
              mimeType: s.file.mimetype,
              sizeBytes: s.obj.sizeBytes,
              parcelId: parcel.id,
              projectId: parcel.projectId,
              issuedOn: new Date(b.capturedAt),
              uploadedById: user.id,
              isSynthetic: false,
            },
          }),
        );
      }
      const ev = await tx.fieldEvidence.create({
        data: {
          clientId: b.clientId,
          deviceId: b.deviceId,
          parcelId: parcel.id,
          capturedById: user.id,
          capturedAt: new Date(b.capturedAt),
          receivedAt: now,
          baseSyncedAt: b.baseSyncedAt ? new Date(b.baseSyncedAt) : null,
          kind: b.kind,
          geometry: b.geometry as unknown as Prisma.InputJsonValue,
          accuracyM: b.accuracyM,
          samples: b.samples,
          positionSource: b.positionSource,
          note: b.note,
          photoDocumentIds: docs.map((d) => d.id),
          photoHashes: b.photoHashes,
          bundleHash: b.bundleHash,
          hashVerified: true,
          ...geo,
          status,
          conflictWithId: unseen?.id ?? null,
          conflictReason: unseen
            ? `Another ${b.kind === 'POINT' ? 'point' : 'boundary'} survey of this parcel reached the server after this device last synced; a supervisor must choose.`
            : null,
        },
      });
      await this.audit.append(tx, {
        actor: user,
        action: status === FieldEvidenceStatus.CONFLICT ? 'FIELD_EVIDENCE_CONFLICT' : 'FIELD_EVIDENCE_RECEIVED',
        entityType: 'FieldEvidence',
        entityId: ev.id,
        newState: { parcelNumber: parcel.parcelNumber, clientId: ev.clientId, deviceSeal: ev.bundleHash, hashVerified: true, kind: ev.kind, accuracyM: ev.accuracyM, capturedAt: ev.capturedAt, distanceM: ev.distanceM, overlapIoU: ev.overlapIoU, photos: ev.photoHashes.length, status },
      });
      return { duplicate: false, evidence: ev };
    });
  }

  @Get('evidence')
  @Roles(...R.OFFICIALS)
  @ApiQuery({ name: 'parcelId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: FieldEvidenceStatus })
  @ApiOperation({ summary: 'Field evidence in your jurisdiction; serverTime is what a device records as its last sync' })
  async list(@CurrentUser() user: AuthUser, @Query('parcelId') parcelId?: string, @Query('status') status?: FieldEvidenceStatus) {
    if (status && !Object.values(FieldEvidenceStatus).includes(status)) throw new BadRequestException('Unknown status');
    const serverTime = this.clock.now();
    const items = await this.prisma.fieldEvidence.findMany({
      where: { parcelId, status, parcel: parcelScope(user) },
      include: { parcel: { select: { parcelNumber: true, villageName: true } } },
      orderBy: { receivedAt: 'desc' },
      take: 500,
    });
    return { serverTime, items };
  }

  @Post('evidence/:id/resolve')
  @Roles(...R.ACQUISITION)
  @ApiOperation({ summary: 'Resolve a conflicting survey: accept it (the earlier one is superseded) or reject it. Audited.' })
  async resolve(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ResolveDto) {
    const ev = await this.prisma.fieldEvidence.findFirst({ where: { id, parcel: parcelScope(user) } });
    if (!ev) throw new NotFoundException('Evidence not found');
    if (ev.status !== FieldEvidenceStatus.CONFLICT) throw new BadRequestException('Only conflicting evidence needs a decision');
    return this.prisma.$transaction(async (tx) => {
      const status = dto.decision === 'ACCEPT' ? FieldEvidenceStatus.ACCEPTED : FieldEvidenceStatus.REJECTED;
      const updated = await tx.fieldEvidence.update({ where: { id }, data: { status, resolvedById: user.id, resolvedAt: this.clock.now(), resolutionNote: dto.note } });
      if (status === FieldEvidenceStatus.ACCEPTED && ev.conflictWithId) {
        await tx.fieldEvidence.update({ where: { id: ev.conflictWithId }, data: { status: FieldEvidenceStatus.SUPERSEDED, resolvedById: user.id, resolvedAt: this.clock.now(), resolutionNote: `Superseded by ${ev.clientId}: ${dto.note}` } });
      }
      await this.audit.append(tx, {
        actor: user,
        action: status === FieldEvidenceStatus.ACCEPTED ? 'FIELD_EVIDENCE_CONFLICT_ACCEPTED' : 'FIELD_EVIDENCE_CONFLICT_REJECTED',
        entityType: 'FieldEvidence',
        entityId: id,
        previousState: { status: ev.status, conflictWithId: ev.conflictWithId },
        newState: { status, superseded: status === FieldEvidenceStatus.ACCEPTED ? ev.conflictWithId : null, note: dto.note },
      });
      return updated;
    });
  }

  /** Field-check tasks raised from change detection (6.12). */
  @Get('checks')
  @Roles(...R.OFFICIALS)
  @ApiOperation({ summary: 'Field-check tasks raised from change detection, in your jurisdiction' })
  async checks(@CurrentUser() user: AuthUser) {
    const now = this.clock.now();
    const tasks = await this.prisma.sLATask.findMany({
      where: { taskName: { startsWith: 'Field check:' }, project: { parcels: { some: parcelScope(user) } } },
      orderBy: { startDate: 'desc' },
    });
    return tasks.map((t) => ({ ...t, isBreached: !t.completedDate && t.targetDate < now }));
  }

  @Post('checks')
  @Roles(...R.ACQUISITION, RoleName.GIS_OFFICER)
  @ApiOperation({ summary: 'Raise a field-check task for a parcel where imagery shows a change after notification (7-day SLA). Audited.' })
  async raiseCheck(@CurrentUser() user: AuthUser, @Body() dto: FieldCheckDto) {
    const parcel = await this.prisma.parcel.findFirst({ where: { AND: [{ id: dto.parcelId }, parcelScope(user)] }, select: { id: true, parcelNumber: true, projectId: true } });
    if (!parcel) throw new NotFoundException('Parcel not found in your jurisdiction');
    const now = this.clock.now();
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.sLATask.create({
        data: { projectId: parcel.projectId, taskName: `Field check: ${parcel.parcelNumber}: ${dto.finding}`, assignedRole: RoleName.FIELD_OFFICER, slaDays: 7, startDate: now, targetDate: new Date(now.getTime() + 7 * 86_400_000) },
      });
      await this.audit.append(tx, { actor: user, action: 'FIELD_CHECK_REQUESTED', entityType: 'Parcel', entityId: parcel.id, newState: { taskId: task.id, finding: dto.finding, dueOn: task.targetDate, source: 'change-detection' } });
      return task;
    });
  }
}

@Module({ controllers: [FieldController] })
export class FieldModule {}
