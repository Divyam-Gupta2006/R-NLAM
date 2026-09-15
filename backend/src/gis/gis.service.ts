import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GisService {
  constructor(private prisma: PrismaService) {}

  async getGeoJson(projectId?: string) {
    const where = projectId ? { projectId } : {};
    const parcels = await this.prisma.parcel.findMany({
      where,
      select: {
        id: true,
        parcelNumber: true,
        khasraNumber: true,
        villageName: true,
        districtName: true,
        stateName: true,
        totalArea: true,
        acquiredArea: true,
        possessedArea: true,
        landOwnerName: true,
        landClass: true,
        status: true,
        verificationState: true,
        geometry: true,
      },
    });

    const features = parcels
      .filter((p) => p.geometry)
      .map((p) => ({
        type: 'Feature',
        id: p.id,
        geometry: p.geometry,
        properties: {
          parcelNumber: p.parcelNumber,
          khasraNumber: p.khasraNumber,
          villageName: p.villageName,
          districtName: p.districtName,
          stateName: p.stateName,
          totalArea: p.totalArea,
          acquiredArea: p.acquiredArea,
          possessedArea: p.possessedArea,
          landOwnerName: p.landOwnerName,
          landClass: p.landClass,
          status: p.status,
          verificationState: p.verificationState,
        },
      }));

    return {
      type: 'FeatureCollection',
      features,
    };
  }

  async getSpatialStats(projectId?: string) {
    const where = projectId ? { projectId } : {};

    const aggregate = await this.prisma.parcel.aggregate({
      where,
      _sum: {
        totalArea: true,
        acquiredArea: true,
        possessedArea: true,
      },
      _count: {
        id: true,
      },
    });

    return {
      totalParcelsCount: aggregate._count.id || 0,
      totalArea: aggregate._sum.totalArea || 0,
      acquiredArea: aggregate._sum.acquiredArea || 0,
      possessedArea: aggregate._sum.possessedArea || 0,
      acquisitionProgressPct: aggregate._sum.totalArea ? ((aggregate._sum.acquiredArea || 0) / aggregate._sum.totalArea) * 100 : 0,
      possessionProgressPct: aggregate._sum.totalArea ? ((aggregate._sum.possessedArea || 0) / aggregate._sum.totalArea) * 100 : 0,
    };
  }
}
