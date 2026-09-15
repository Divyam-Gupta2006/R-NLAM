import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ObjectionStatus } from '@prisma/client';

@Injectable()
export class ObjectionsService {
  constructor(private prisma: PrismaService) {}

  async findAll(parcelId?: string) {
    const where = parcelId ? { parcelId } : {};
    return this.prisma.objection.findMany({
      where,
      include: {
        parcel: { select: { id: true, parcelNumber: true, khasraNumber: true, villageName: true } },
        hearings: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: { parcelId: string; applicant: string; category: string; description: string }) {
    return this.prisma.objection.create({
      data: {
        parcelId: data.parcelId,
        applicant: data.applicant,
        category: data.category,
        description: data.description,
        status: ObjectionStatus.SUBMITTED,
      },
    });
  }

  async updateStatus(id: string, status: ObjectionStatus) {
    const objection = await this.prisma.objection.findUnique({ where: { id } });
    if (!objection) {
      throw new NotFoundException(`Objection with ID ${id} not found.`);
    }

    return this.prisma.objection.update({
      where: { id },
      data: { status },
    });
  }
}
