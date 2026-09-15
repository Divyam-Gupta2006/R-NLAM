import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProposalStatus } from '@prisma/client';

@Injectable()
export class ProposalsService {
  constructor(private prisma: PrismaService) {}

  async findAll(projectId?: string) {
    const where: any = {};
    if (projectId) where.projectId = projectId;

    return this.prisma.proposal.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id },
      include: {
        project: true,
      },
    });

    if (!proposal) {
      throw new NotFoundException(`Proposal with ID ${id} not found.`);
    }

    return proposal;
  }

  async create(data: {
    projectId: string;
    title: string;
    landRequired: number;
    alignmentGeo?: any;
    remarks?: string;
  }) {
    return this.prisma.proposal.create({
      data: {
        projectId: data.projectId,
        title: data.title,
        landRequired: data.landRequired,
        alignmentGeo: data.alignmentGeo || null,
        remarks: data.remarks || '',
        status: ProposalStatus.DRAFT,
      },
    });
  }

  async updateStatus(id: string, status: ProposalStatus, remarks?: string) {
    const proposal = await this.findOne(id);
    return this.prisma.proposal.update({
      where: { id: proposal.id },
      data: {
        status,
        remarks: remarks ? `${proposal.remarks || ''}\n[Note]: ${remarks}` : proposal.remarks,
        submittedAt: status === ProposalStatus.SUBMITTED ? new Date() : proposal.submittedAt,
      },
    });
  }
}
