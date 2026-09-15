import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoleName } from '@prisma/client';

@Injectable()
export class SlaService {
  constructor(private prisma: PrismaService) {}

  async getTasks() {
    return this.prisma.sLATask.findMany({
      orderBy: { targetDate: 'asc' },
    });
  }

  async checkBreaches() {
    const overdueTasks = await this.prisma.sLATask.findMany({
      where: {
        targetDate: { lt: new Date() },
        completedDate: null,
      },
    });

    const notifications = [];
    for (const task of overdueTasks) {
      const notif = await this.prisma.notification.create({
        data: {
          role: task.assignedRole || RoleName.DISTRICT_OFFICER,
          title: `SLA BREACH ALERT: ${task.taskName}`,
          message: `Task ${task.taskName} is overdue. Target date was ${task.targetDate.toISOString().split('T')[0]}.`,
          type: 'SLA_BREACH',
        },
      });
      notifications.push(notif);
    }

    return {
      checkedCount: overdueTasks.length,
      breachesFound: overdueTasks.length,
      notificationsGenerated: notifications.length,
    };
  }
}

