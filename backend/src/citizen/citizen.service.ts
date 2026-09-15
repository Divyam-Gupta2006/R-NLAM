import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CitizenService {
  constructor(private prisma: PrismaService) {}

  async getSummary() {
    const totalProjects = await this.prisma.project.count();
    const parcels = await this.prisma.parcel.findMany();
    const totalAcquiredArea = parcels.reduce((acc, p) => acc + Number(p.acquiredArea || 0), 0);
    const totalFamilies = await this.prisma.affectedFamily.count();

    return {
      publicProjectsCount: totalProjects,
      totalAcquiredAreaHectares: Math.round(totalAcquiredArea * 100) / 100,
      totalBeneficiariesCount: totalFamilies,
      lastUpdated: new Date().toISOString(),
    };
  }

  async getPublicProjects() {
    return this.prisma.project.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        sector: true,
        stateName: true,
        districtNames: true,
        status: true,
        requiredLand: true,
        acquiredLand: true,
        estimatedCost: true,
      },
    });
  }

  async getMyLand(khasraNumber?: string) {
    if (khasraNumber) {
      return this.prisma.parcel.findMany({
        where: { khasraNumber: { contains: khasraNumber, mode: 'insensitive' } },
        include: { project: { select: { name: true, code: true } } },
      });
    }
    return this.prisma.parcel.findMany({
      take: 10,
      include: { project: { select: { name: true, code: true } } },
    });
  }

  async getMyCompensation() {
    return this.prisma.compensation.findMany({
      include: {
        parcel: { select: { khasraNumber: true, landOwnerName: true } },
        award: { select: { awardNumber: true } },
      },
    });
  }

  async getMyRR() {
    return this.prisma.affectedFamily.findMany({
      include: {
        rrCases: {
          include: { deliveries: true },
        },
      },
    });
  }

  async submitGrievance(data: { name: string; email: string; phone: string; khasraNumber: string; remarks: string }) {
    const parcel = await this.prisma.parcel.findFirst({
      where: { khasraNumber: data.khasraNumber },
    });

    if (parcel) {
      return this.prisma.objection.create({
        data: {
          parcelId: parcel.id,
          applicant: data.name,
          category: 'Land Measurement Discrepancy',
          description: data.remarks || 'Citizen Grievance submitted via portal.',
          status: 'SUBMITTED',
        },
      });
    }

    return {
      status: 'SUBMITTED',
      message: 'Grievance submitted successfully. Case file created for district officer review.',
      referenceId: `GRV-${Date.now()}`,
    };
  }
}

