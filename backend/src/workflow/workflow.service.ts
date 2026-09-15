import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WorkflowService {
  constructor(private prisma: PrismaService) {}

  async getTemplates() {
    return this.prisma.workflowTemplate.findMany();
  }

  async getInstanceByProjectId(projectId: string) {
    const instance = await this.prisma.workflowInstance.findFirst({
      where: { projectId },
      include: {
        template: true,
        actions: {
          include: {
            user: {
              select: { id: true, name: true, role: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!instance) {
      throw new NotFoundException(`Workflow instance for project ${projectId} not found.`);
    }

    return instance;
  }

  async executeAction(data: { instanceId: string; actionName: string; performedBy: string; fromStage: string; toStage: string; remarks?: string }) {
    const instance = await this.prisma.workflowInstance.findUnique({
      where: { id: data.instanceId },
      include: { template: true },
    });

    if (!instance) {
      throw new NotFoundException(`Workflow instance ${data.instanceId} not found.`);
    }

    let actorId = data.performedBy;
    const actorUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { id: data.performedBy },
          { email: data.performedBy },
        ],
      },
    });

    if (actorUser) {
      actorId = actorUser.id;
    } else {
      const fallbackUser = await this.prisma.user.findFirst();
      if (fallbackUser) {
        actorId = fallbackUser.id;
      }
    }

    // Record action and update current stage
    const [action, updatedInstance] = await this.prisma.$transaction([
      this.prisma.workflowAction.create({
        data: {
          instanceId: data.instanceId,
          actionName: data.actionName,
          performedBy: actorId,
          fromStage: data.fromStage,
          toStage: data.toStage,
          remarks: data.remarks || '',
        },
      }),
      this.prisma.workflowInstance.update({
        where: { id: data.instanceId },
        data: { currentStage: data.toStage },
      }),
    ]);

    return { action, instance: updatedInstance };
  }
}
