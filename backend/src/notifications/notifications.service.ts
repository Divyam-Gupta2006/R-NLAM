import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoleName, MilestoneStatus } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId?: string, role?: RoleName) {
    const where: any = {};
    if (userId || role) {
      where.OR = [];
      if (userId) where.OR.push({ userId });
      if (role) where.OR.push({ role });
    }

    return this.prisma.notification.findMany({
      where: where.OR?.length ? where : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markAsRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async checkBreaches() {
    const now = new Date();
    const generated: any[] = [];

    // 1. Check Statutory Milestones overdue
    const upcomingMilestones = await this.prisma.statutoryMilestone.findMany({
      where: {
        status: { in: [MilestoneStatus.UPCOMING, MilestoneStatus.DUE_SOON] },
      },
      include: { project: true },
    });

    for (const ms of upcomingMilestones) {
      const daysLeft = Math.ceil((new Date(ms.deadlineDate).getTime() - now.getTime()) / (1000 * 3600 * 24));

      if (daysLeft < 0 && ms.status !== MilestoneStatus.OVERDUE) {
        await this.prisma.statutoryMilestone.update({
          where: { id: ms.id },
          data: { status: MilestoneStatus.OVERDUE },
        });

        const notif = await this.prisma.notification.create({
          data: {
            role: RoleName.DISTRICT_OFFICER,
            title: `BREACH: Statutory Milestone Overdue!`,
            message: `Milestone '${ms.name}' for project '${ms.project.name}' expired ${Math.abs(daysLeft)} days ago.`,
            type: 'STATUTORY_DEADLINE',
          },
        });
        generated.push(notif);
      }
    }

    // 2. Check SLA Tasks overdue
    const pendingTasks = await this.prisma.sLATask.findMany({
      where: {
        completedDate: null,
        targetDate: { lt: now },
      },
      include: { project: true },
    });

    for (const task of pendingTasks) {
      if (!task.isBreached) {
        await this.prisma.sLATask.update({
          where: { id: task.id },
          data: { isBreached: true },
        });

        const notif = await this.prisma.notification.create({
          data: {
            role: task.assignedRole || RoleName.DISTRICT_OFFICER,
            title: `SLA Task Overdue: ${task.taskName}`,
            message: `SLA task '${task.taskName}' for project '${task.project.name}' has breached deadline and has been escalated.`,
            type: 'SLA_BREACH',
          },
        });
        generated.push(notif);
      }
    }

    return {
      message: `Checked statutory milestones and SLA tasks successfully.`,
      generatedNotificationsCount: generated.length,
      notifications: generated,
    };
  }
}
