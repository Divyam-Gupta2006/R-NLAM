import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ParcelStatus, VerificationStatus } from '@prisma/client';

@Injectable()
export class ParcelsService {
  constructor(private prisma: PrismaService) {}

  async findAll(filter: { projectId?: string; villageName?: string }) {
    const where: any = {};
    if (filter.projectId) where.projectId = filter.projectId;
    if (filter.villageName) where.villageName = filter.villageName;

    return this.prisma.parcel.findMany({
      where,
      include: {
        verifications: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { parcelNumber: 'asc' },
    });
  }

  async findOne(id: string) {
    const parcel = await this.prisma.parcel.findUnique({
      where: { id },
      include: {
        project: true,
        verifications: { include: { officer: { select: { name: true, role: true } } }, orderBy: { createdAt: 'desc' } },
        objections: true,
        awards: true,
        compensations: true,
        rrCases: true,
        possessions: true,
        provenance: true,
      },
    });

    if (!parcel) {
      throw new NotFoundException(`Parcel with ID ${id} not found.`);
    }

    return parcel;
  }

  async create(data: {
    projectId: string;
    parcelNumber: string;
    khasraNumber: string;
    villageName: string;
    districtName: string;
    stateName: string;
    totalArea: number;
    landOwnerName: string;
    landClass: string;
    geometry?: any;
  }) {
    return this.prisma.parcel.create({
      data: {
        projectId: data.projectId,
        parcelNumber: data.parcelNumber,
        khasraNumber: data.khasraNumber,
        villageName: data.villageName,
        districtName: data.districtName,
        stateName: data.stateName,
        totalArea: data.totalArea,
        landOwnerName: data.landOwnerName,
        landClass: data.landClass,
        geometry: data.geometry || null,
        status: ParcelStatus.PROPOSED,
        verificationState: VerificationStatus.UNVERIFIED,
      },
    });
  }

  async verifyParcel(data: {
    parcelId: string;
    verifiedBy: string;
    latitude: number;
    longitude: number;
    photoUrl?: string;
    notes?: string;
    status?: VerificationStatus;
    isOfflineSync?: boolean;
  }) {
    const parcel = await this.findOne(data.parcelId);

    const status = data.status || VerificationStatus.OFFICER_VERIFIED;

    let officerId = data.verifiedBy;
    const officerUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { id: data.verifiedBy },
          { email: data.verifiedBy },
        ],
      },
    });

    if (officerUser) {
      officerId = officerUser.id;
    } else {
      const fallbackUser = await this.prisma.user.findFirst();
      if (fallbackUser) {
        officerId = fallbackUser.id;
      }
    }

    const [verification, updatedParcel] = await this.prisma.$transaction([
      this.prisma.parcelVerification.create({
        data: {
          parcelId: data.parcelId,
          verifiedBy: officerId,
          latitude: data.latitude,
          longitude: data.longitude,
          photoUrl: data.photoUrl || null,
          notes: data.notes || '',
          status,
          isOfflineSync: !!data.isOfflineSync,
        },
      }),
      this.prisma.parcel.update({
        where: { id: data.parcelId },
        data: {
          verificationState: status,
          status: status === VerificationStatus.OFFICER_VERIFIED ? ParcelStatus.VERIFIED : parcel.status,
          acquiredArea: status === VerificationStatus.OFFICER_VERIFIED ? parcel.totalArea : parcel.acquiredArea,
        },
      }),
    ]);

    // Recalculate project acquired land area
    const aggregate = await this.prisma.parcel.aggregate({
      where: { projectId: parcel.projectId, status: { in: ['VERIFIED', 'NOTIFIED', 'AWARDED', 'COMPENSATION_PAID', 'POSSESSION_TAKEN', 'HANDED_TO_PIA'] } },
      _sum: { totalArea: true },
    });

    await this.prisma.project.update({
      where: { id: parcel.projectId },
      data: { acquiredLand: aggregate._sum.totalArea || 0 },
    });

    return { verification, parcel: updatedParcel };
  }
}
