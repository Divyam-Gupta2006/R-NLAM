import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RRStatus } from '@prisma/client';

@Injectable()
export class RRService {
  constructor(private prisma: PrismaService) {}

  async getFamilies(projectId?: string) {
    if (projectId) {
      return this.prisma.affectedFamily.findMany({
        where: {
          rrCases: {
            some: { projectId },
          },
        },
        include: { rrCases: true },
      });
    }
    return this.prisma.affectedFamily.findMany({ include: { rrCases: true } });
  }

  async getCases(projectId?: string) {
    const where = projectId ? { projectId } : {};
    return this.prisma.rRCase.findMany({
      where,
      include: {
        project: true,
        parcel: true,
        family: true,
        deliveries: true,
      },
    });
  }

  async verifyEligibility(data: { projectId: string; parcelId: string; familyId: string; status: RRStatus }) {
    const existingCase = await this.prisma.rRCase.findFirst({
      where: { projectId: data.projectId, parcelId: data.parcelId, familyId: data.familyId },
    });

    if (existingCase) {
      return this.prisma.rRCase.update({
        where: { id: existingCase.id },
        data: { status: data.status },
      });
    }

    return this.prisma.rRCase.create({
      data: {
        projectId: data.projectId,
        parcelId: data.parcelId,
        familyId: data.familyId,
        status: data.status,
      },
    });
  }

  async recordDelivery(data: { caseId: string; benefitName: string; remarks?: string }) {
    const rrCase = await this.prisma.rRCase.findUnique({
      where: { id: data.caseId },
    });

    if (!rrCase) {
      throw new NotFoundException(`R&R Case ${data.caseId} not found.`);
    }

    const delivery = await this.prisma.rRDelivery.create({
      data: {
        caseId: data.caseId,
        benefitName: data.benefitName,
        remarks: data.remarks || '',
      },
    });

    await this.prisma.rRCase.update({
      where: { id: data.caseId },
      data: { status: RRStatus.BENEFIT_DELIVERED },
    });

    return delivery;
  }
}
