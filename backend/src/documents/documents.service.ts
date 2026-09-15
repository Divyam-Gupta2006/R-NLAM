import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DocumentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(projectId?: string, parcelId?: string) {
    const where: any = {};
    if (projectId) where.projectId = projectId;
    if (parcelId) where.parcelId = parcelId;

    return this.prisma.document.findMany({
      where,
      include: { versions: { orderBy: { version: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: { versions: { orderBy: { version: 'desc' } } },
    });

    if (!document) {
      throw new NotFoundException(`Document with ID ${id} not found.`);
    }

    return document;
  }

  async upload(data: {
    fileName: string;
    minioKey: string;
    mimeType: string;
    fileSize: number;
    bucket?: string;
    projectId?: string;
    parcelId?: string;
    uploadedBy: string;
  }) {
    const doc = await this.prisma.document.create({
      data: {
        fileName: data.fileName,
        minioKey: data.minioKey,
        mimeType: data.mimeType,
        fileSize: data.fileSize,
        bucket: data.bucket || 'rnlam-documents',
        projectId: data.projectId || null,
        parcelId: data.parcelId || null,
        uploadedBy: data.uploadedBy,
      },
    });

    // Create version 1
    await this.prisma.documentVersion.create({
      data: {
        documentId: doc.id,
        version: 1,
        minioKey: data.minioKey,
      },
    });

    return doc;
  }
}
