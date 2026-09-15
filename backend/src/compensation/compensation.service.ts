import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CompensationStatus } from '@prisma/client';

@Injectable()
export class CompensationService {
  constructor(private prisma: PrismaService) {}

  async getCases(projectId?: string) {
    const where = projectId ? { projectId } : {};
    return this.prisma.compensation.findMany({
      where,
      include: {
        project: true,
        parcel: true,
        award: true,
        paymentReferences: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async initiatePayment(data: { compensationId: string; utrNumber?: string; gatewaySource?: string }) {
    const comp = await this.prisma.compensation.findUnique({
      where: { id: data.compensationId },
    });

    if (!comp) {
      throw new NotFoundException(`Compensation case ${data.compensationId} not found.`);
    }

    const utr = data.utrNumber || `PFMS${Date.now()}`;
    const gateway = data.gatewaySource || 'PFMS_TREASURY_MOCK';

    const [paymentRef, updatedComp] = await this.prisma.$transaction([
      this.prisma.paymentReference.create({
        data: {
          compensationId: comp.id,
          utrNumber: utr,
          gatewaySource: gateway,
          amount: comp.amount,
          status: 'SUCCESS',
        },
      }),
      this.prisma.compensation.update({
        where: { id: comp.id },
        data: { status: CompensationStatus.PAID },
      }),
    ]);

    await this.prisma.parcel.update({
      where: { id: comp.parcelId },
      data: { status: 'COMPENSATION_PAID' },
    });

    return { paymentRef, compensation: updatedComp };
  }

  async updateStatus(id: string, status: CompensationStatus) {
    const comp = await this.prisma.compensation.findUnique({ where: { id } });
    if (!comp) {
      throw new NotFoundException(`Compensation case ${id} not found.`);
    }

    return this.prisma.compensation.update({
      where: { id },
      data: { status },
    });
  }
}
