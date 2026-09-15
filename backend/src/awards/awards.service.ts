import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AwardsService {
  constructor(private prisma: PrismaService) {}

  async findAll(projectId?: string) {
    const where = projectId ? { projectId } : {};
    return this.prisma.award.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, code: true } },
        parcel: { select: { id: true, parcelNumber: true, khasraNumber: true, landOwnerName: true } },
        compensations: true,
      },
      orderBy: { declaredDate: 'desc' },
    });
  }

  async create(data: {
    awardNumber: string;
    projectId: string;
    parcelId: string;
    valuationLand: number;
    valuationAssets?: number;
    solatiumAmount?: number;
  }) {
    const valLand = data.valuationLand || 0;
    const valAssets = data.valuationAssets || 0;
    // 100% Solatium calculation under RFCTLARR Act 2013
    const solatium = data.solatiumAmount !== undefined ? data.solatiumAmount : valLand + valAssets;
    const totalAward = valLand + valAssets + solatium;

    const award = await this.prisma.award.create({
      data: {
        awardNumber: data.awardNumber,
        projectId: data.projectId,
        parcelId: data.parcelId,
        valuationLand: valLand,
        valuationAssets: valAssets,
        solatiumAmount: solatium,
        totalAward,
        status: 'DECLARED',
      },
    });

    // Create corresponding compensation case
    const parcel = await this.prisma.parcel.findUnique({ where: { id: data.parcelId } });

    await this.prisma.compensation.create({
      data: {
        projectId: data.projectId,
        parcelId: data.parcelId,
        awardId: award.id,
        beneficiaryName: parcel?.landOwnerName || 'Authorized Landowner',
        amount: totalAward,
        status: 'ASSESSED',
      },
    });

    return award;
  }
}
