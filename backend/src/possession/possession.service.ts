import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PossessionStatus } from '@prisma/client';

@Injectable()
export class PossessionService {
  constructor(private prisma: PrismaService) {}

  async getCases(projectId?: string) {
    const where = projectId ? { projectId } : {};
    return this.prisma.possession.findMany({
      where,
      include: {
        project: true,
        parcel: true,
      },
    });
  }

  async recordPossession(data: {
    projectId: string;
    parcelId: string;
    authority?: string;
    latitude?: number;
    longitude?: number;
    documentUrl?: string;
    remarks?: string;
    status?: PossessionStatus;
  }) {
    const existing = await this.prisma.possession.findFirst({
      where: { parcelId: data.parcelId },
    });

    const status = data.status || PossessionStatus.POSSESSION_TAKEN;
    const takenDate = status === PossessionStatus.POSSESSION_TAKEN ? new Date() : undefined;
    const handoverDate = status === PossessionStatus.HANDED_TO_PIA ? new Date() : undefined;

    let result;
    if (existing) {
      result = await this.prisma.possession.update({
        where: { id: existing.id },
        data: {
          status,
          takenDate: takenDate || existing.takenDate,
          handoverDate: handoverDate || existing.handoverDate,
          authority: data.authority || existing.authority,
          latitude: data.latitude || existing.latitude,
          longitude: data.longitude || existing.longitude,
          documentUrl: data.documentUrl || existing.documentUrl,
          remarks: data.remarks || existing.remarks,
        },
      });
    } else {
      result = await this.prisma.possession.create({
        data: {
          projectId: data.projectId,
          parcelId: data.parcelId,
          status,
          takenDate,
          handoverDate,
          authority: data.authority || '',
          latitude: data.latitude || null,
          longitude: data.longitude || null,
          documentUrl: data.documentUrl || null,
          remarks: data.remarks || '',
        },
      });
    }

    // Update parcel status & project possessed land total
    await this.prisma.parcel.update({
      where: { id: data.parcelId },
      data: {
        status: status === PossessionStatus.HANDED_TO_PIA ? 'HANDED_TO_PIA' : 'POSSESSION_TAKEN',
      },
    });

    const aggregate = await this.prisma.parcel.aggregate({
      where: { projectId: data.projectId, status: { in: ['POSSESSION_TAKEN', 'HANDED_TO_PIA'] } },
      _sum: { totalArea: true },
    });

    await this.prisma.project.update({
      where: { id: data.projectId },
      data: { possessedLand: aggregate._sum.totalArea || 0 },
    });

    return result;
  }
}
