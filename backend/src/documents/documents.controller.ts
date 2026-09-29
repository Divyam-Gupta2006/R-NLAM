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
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiPropertyOptional, ApiQuery, ApiTags } from '@nestjs/swagger';
import { DocumentKind, Prisma } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import * as crypto from 'crypto';
import { Response } from 'express';
import { AuditService } from '../audit/audit.service';
import { AuthUser, R } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import { parcelScope } from '../common/scope';
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

@ApiTags('documents')
@ApiBearerAuth()
@Roles(...R.OFFICIALS)
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(STORAGE) private readonly storage: StorageAdapter,
  ) {}

  @Get()
  @ApiQuery({ name: 'parcelId', required: false })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'kind', required: false, enum: DocumentKind })
  list(@CurrentUser() user: AuthUser, @Query('parcelId') parcelId?: string, @Query('projectId') projectId?: string, @Query('kind') kind?: DocumentKind) {
    const where: Prisma.DocumentWhereInput = { parcelId, projectId, kind };
    if (parcelId) where.parcel = parcelScope(user);
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
