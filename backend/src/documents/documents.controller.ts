import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiProperty, ApiPropertyOptional, ApiQuery, ApiTags } from '@nestjs/swagger';
import { DocumentKind, Prisma } from '@prisma/client';
import { IsDateString, IsEnum, IsIn, IsObject, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import * as crypto from 'crypto';
import { Response } from 'express';
import { AiClient, ProposedField } from '../ai/ai.module';
import { AuditService } from '../audit/audit.service';
import { AuthUser, R } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { parcelScope, projectScope } from '../common/scope';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE, StorageAdapter } from '../storage/storage';

const ALLOWED_MIME = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;

class UploadDocumentDto {
  @ApiPropertyOptional({ enum: DocumentKind }) @IsEnum(DocumentKind) kind: DocumentKind;
  @ApiPropertyOptional() @IsString() @Length(2, 200) title: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() projectId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() parcelId?: string;
  @ApiPropertyOptional({ example: 'FC/8-12/2026' }) @IsOptional() @IsString() referenceNo?: string;
  @ApiPropertyOptional({ example: '2026-08-12' }) @IsOptional() @IsDateString() issuedOn?: string;
}

class ReviewExtractionDto {
  @ApiProperty({ enum: ['CONFIRM', 'REJECT'] }) @IsIn(['CONFIRM', 'REJECT']) decision: 'CONFIRM' | 'REJECT';
  @ApiPropertyOptional({
    description: 'Final values per field, as accepted or corrected by the reviewer. Every field flagged needs_review must be included.',
    example: { survey_numbers: ['45/2A'], village: ['Borgaon'] },
  })
  @IsOptional()
  @IsObject()
  fields?: Record<string, Array<string | number>>;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 1000) note?: string;
}

const sameValues = (a: Array<string | number>, b: Array<string | number>) =>
  a.length === b.length && JSON.stringify(a.map(String).sort()) === JSON.stringify(b.map(String).sort());

@ApiTags('documents')
@ApiBearerAuth()
@Roles(...R.OFFICIALS)
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(STORAGE) private readonly storage: StorageAdapter,
    private readonly ai: AiClient,
  ) {}

  private async visibleDocument(user: AuthUser, id: string) {
    const doc = await this.prisma.document.findFirst({ where: { id, OR: [{ parcelId: null }, { parcel: parcelScope(user) }] } });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  @Get()
  @ApiQuery({ name: 'parcelId', required: false })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'kind', required: false, enum: DocumentKind })
  list(@CurrentUser() user: AuthUser, @Query('parcelId') parcelId?: string, @Query('projectId') projectId?: string, @Query('kind') kind?: DocumentKind) {
    // Parcel documents by parcel scope; project-level documents by project scope.
    const where: Prisma.DocumentWhereInput = { parcelId, projectId, kind, OR: [{ parcel: parcelScope(user) }, { parcelId: null, project: projectScope(user) }] };
    return this.prisma.document.findMany({
      where,
      include: { parcel: { select: { parcelNumber: true, villageName: true } }, project: { select: { code: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, kind: { type: 'string' }, title: { type: 'string' }, parcelId: { type: 'string' }, projectId: { type: 'string' }, referenceNo: { type: 'string' }, issuedOn: { type: 'string' } } } })
  @ApiOperation({ summary: 'Upload a document (PDF/PNG/JPEG/WebP, ≤ 10 MB). Stored with its SHA-256.' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_BYTES } }))
  async upload(@CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File | undefined, @Body() dto: UploadDocumentDto) {
    if (!file) throw new BadRequestException('file is required');
    if (!ALLOWED_MIME.includes(file.mimetype)) throw new BadRequestException(`Unsupported file type ${file.mimetype}`);
    if (!dto.parcelId && !dto.projectId) throw new BadRequestException('Attach the document to a parcel or a project');

    const safeName = file.originalname.replace(/[^A-Za-z0-9._-]/g, '_').slice(-80);
    const key = `documents/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}-${safeName}`;
    const stored = await this.storage.put(key, file.buffer);

    return this.prisma.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: {
          kind: dto.kind,
          title: dto.title,
          fileName: safeName,
          storageBackend: stored.backend,
          storageKey: stored.key,
          sha256: stored.sha256,
          mimeType: file.mimetype,
          sizeBytes: stored.sizeBytes,
          projectId: dto.projectId,
          parcelId: dto.parcelId,
          referenceNo: dto.referenceNo,
          issuedOn: dto.issuedOn ? new Date(dto.issuedOn) : undefined,
          uploadedById: user.id,
          isSynthetic: false,
        },
      });
      await this.audit.append(tx, {
        actor: user,
        action: 'DOCUMENT_UPLOADED',
        entityType: 'Document',
        entityId: doc.id,
        newState: { kind: doc.kind, sha256: doc.sha256, parcelId: doc.parcelId, projectId: doc.projectId, referenceNo: doc.referenceNo },
      });
      return doc;
    });
  }

  @Post(':id/extract')
  @ApiOperation({
    summary: 'Ask the AI service to propose fields (survey numbers, owners, area, amounts, dates, sections) from this document',
    description: 'Stores the proposal as PENDING_REVIEW with per-field confidence and evidence. 503 if the AI service is not running.',
  })
  async extract(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const doc = await this.visibleDocument(user, id);
    const data = await this.storage.get(doc.storageKey).catch(() => {
      throw new NotFoundException('Document content is not in storage');
    });
    if (crypto.createHash('sha256').update(data).digest('hex') !== doc.sha256) throw new BadRequestException('Stored file does not match its recorded hash');
    const r = await this.ai.extract(data, doc.fileName, doc.mimeType);
    return this.prisma.$transaction(async (tx) => {
      const ex = await tx.documentExtraction.create({
        data: {
          documentId: doc.id,
          documentSha256: doc.sha256,
          textMethod: r.text_method,
          documentType: r.document_type,
          documentTypeConfidence: r.document_type_confidence,
          proposed: r.fields as unknown as Prisma.InputJsonValue,
          needsReview: r.needs_review,
          requestedById: user.id,
        },
      });
      const flagged = Object.entries(r.fields)
        .filter(([, fs]) => fs.some((f) => f.needs_review))
        .map(([k]) => k);
      await this.audit.append(tx, {
        actor: user,
        action: 'DOCUMENT_EXTRACTION_PROPOSED',
        entityType: 'Document',
        entityId: doc.id,
        newState: { extractionId: ex.id, documentSha256: doc.sha256, documentType: r.document_type, textMethod: r.text_method, fieldsNeedingReview: flagged },
      });
      return ex;
    });
  }

  @Get(':id/extractions')
  @ApiOperation({ summary: 'Field proposals for this document, newest first, with their review status' })
  async extractions(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.visibleDocument(user, id);
    return this.prisma.documentExtraction.findMany({ where: { documentId: id }, orderBy: { createdAt: 'desc' } });
  }

  @Post('extractions/:extractionId/review')
  @ApiOperation({
    summary: 'Confirm (with corrections) or reject proposed fields. Audited; every field flagged needs_review must be confirmed or corrected explicitly.',
  })
  async review(@CurrentUser() user: AuthUser, @Param('extractionId') extractionId: string, @Body() dto: ReviewExtractionDto) {
    const ex = await this.prisma.documentExtraction.findUnique({ where: { id: extractionId } });
    if (!ex) throw new NotFoundException('Extraction not found');
    await this.visibleDocument(user, ex.documentId);
    if (ex.status !== 'PENDING_REVIEW') throw new BadRequestException(`Already ${ex.status.toLowerCase()}`);

    const proposed = ex.proposed as unknown as Record<string, ProposedField[]>;
    let confirmed: Record<string, Array<string | number>> | null = null;
    const changed: string[] = [];
    if (dto.decision === 'REJECT') {
      if ((dto.note ?? '').trim().length < 10) throw new BadRequestException('Give a reason (at least 10 characters) for rejecting');
    } else {
      const given = dto.fields ?? {};
      const unknown = Object.keys(given).filter((k) => !(k in proposed));
      if (unknown.length) throw new BadRequestException(`Unknown fields: ${unknown.join(', ')}`);
      const missing = Object.entries(proposed)
        .filter(([k, fs]) => fs.some((f) => f.needs_review) && !(k in given))
        .map(([k]) => k);
      if (missing.length) throw new BadRequestException(`Confirm or correct each flagged field: ${missing.join(', ')}`);
      confirmed = {};
      for (const [k, fs] of Object.entries(proposed)) {
        const values = k in given ? given[k] : fs.map((f) => f.value);
        if (!Array.isArray(values) || !values.every((v) => typeof v === 'string' || typeof v === 'number')) {
          throw new BadRequestException(`${k} must be a list of strings or numbers`);
        }
        confirmed[k] = values;
        if (!sameValues(values, fs.map((f) => f.value))) changed.push(k);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.documentExtraction.update({
        where: { id: ex.id },
        data: {
          status: dto.decision === 'CONFIRM' ? 'CONFIRMED' : 'REJECTED',
          confirmed: confirmed === null ? Prisma.DbNull : (confirmed as Prisma.InputJsonValue),
          corrections: confirmed === null ? null : changed.length,
          reviewNote: dto.note,
          reviewedById: user.id,
          reviewedAt: new Date(),
        },
      });
      await this.audit.append(tx, {
        actor: user,
        action: dto.decision === 'CONFIRM' ? 'DOCUMENT_FIELDS_CONFIRMED' : 'DOCUMENT_EXTRACTION_REJECTED',
        entityType: 'Document',
        entityId: ex.documentId,
        previousState: { extractionId: ex.id, status: ex.status, proposed: Object.fromEntries(Object.entries(proposed).map(([k, fs]) => [k, fs.map((f) => f.value)])) },
        newState: { extractionId: ex.id, status: updated.status, confirmed, correctedFields: changed, note: dto.note ?? null },
      });
      return updated;
    });
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download a document (integrity-checked against its stored SHA-256)' })
  async download(@Param('id') id: string, @Res() res: Response) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    const data = await this.storage.get(doc.storageKey).catch(() => {
      throw new NotFoundException('Document content is not in storage (synthetic seed records have metadata only)');
    });
    const sha = crypto.createHash('sha256').update(data).digest('hex');
    if (sha !== doc.sha256) throw new BadRequestException('Stored file does not match its recorded hash');
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${doc.fileName}"`);
    res.send(data);
  }
}
