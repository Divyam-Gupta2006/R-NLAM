import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HearingsService {
  constructor(private prisma: PrismaService) {}

  async findAll(objectionId?: string) {
    const where = objectionId ? { objectionId } : {};
    return this.prisma.hearing.findMany({
      where,
      include: {
        objection: {
          include: {
            parcel: { select: { id: true, parcelNumber: true, khasraNumber: true } },
          },
        },
      },
      orderBy: { hearingDate: 'asc' },
    });
  }

  async schedule(data: { objectionId: string; hearingDate: Date; venue: string; presidingOfficer: string }) {
    const hearing = await this.prisma.hearing.create({
      data: {
        objectionId: data.objectionId,
        hearingDate: data.hearingDate,
        venue: data.venue,
        presidingOfficer: data.presidingOfficer,
        status: 'SCHEDULED',
      },
    });

    await this.prisma.objection.update({
      where: { id: data.objectionId },
      data: { status: 'HEARING_SCHEDULED' },
    });

    return hearing;
  }

  async recordDecision(id: string, decision: string, status?: string) {
    const hearing = await this.prisma.hearing.findUnique({ where: { id } });
    if (!hearing) {
      throw new NotFoundException(`Hearing ${id} not found.`);
    }

    const updated = await this.prisma.hearing.update({
      where: { id },
      data: {
        decision,
        status: status || 'COMPLETED',
      },
    });

    await this.prisma.objection.update({
      where: { id: hearing.objectionId },
      data: { status: 'HEARD' },
    });

    return updated;
  }
}
