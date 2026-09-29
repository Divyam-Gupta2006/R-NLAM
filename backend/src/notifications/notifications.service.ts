import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma, RoleName } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { DeliveredEvent, EVENT_BUS, EventBus } from '../events/event-bus';
import { PrismaService } from '../prisma/prisma.service';

export interface NotifyInput {
  title: string;
  message: string;
  type: string;
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';
  userId?: string;
  role?: RoleName;
  stateCode?: string | null;
  districtCode?: string | null;
  entityType?: string;
  entityId?: string;
  /** Same key → created at most once (e.g. `deadline:<clockId>:T-30`). */
  dedupeKey?: string;
}

@Injectable()
export class NotificationsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EVENT_BUS) private readonly bus: EventBus,
  ) {}

  onModuleInit() {
    // Any overridden guard is escalated to the national admins.
    this.bus.subscribe('*', (e) => this.onEvent(e));
  }

  private async onEvent(e: DeliveredEvent) {
    const p = e.payload as { override?: boolean; event?: string; overriddenBlockers?: string[]; stateCode?: string };
    if (!p.override) return;
    await this.notify({
      title: `Guard overridden: ${e.aggregateType} ${p.event}`,
      message: `Blockers overridden: ${(p.overriddenBlockers ?? []).join(', ')}. See the highlighted audit entry.`,
      type: 'OVERRIDE',
      severity: 'CRITICAL',
      role: RoleName.CENTRAL_ADMIN,
      entityType: e.aggregateType,
      entityId: e.aggregateId,
      dedupeKey: `override:${e.id}`,
    });
  }

  async notify(input: NotifyInput) {
    const data: Prisma.NotificationCreateInput = {
      title: input.title,
      message: input.message,
      type: input.type,
      severity: input.severity ?? 'INFO',
      userId: input.userId,
      role: input.role,
      stateCode: input.stateCode ?? undefined,
      districtCode: input.districtCode ?? undefined,
      entityType: input.entityType,
      entityId: input.entityId,
      dedupeKey: input.dedupeKey,
    };
    if (!input.dedupeKey) return this.prisma.notification.create({ data });
    return this.prisma.notification.upsert({ where: { dedupeKey: input.dedupeKey }, create: data, update: {} });
  }

  /** Notifications addressed to me, or to my role within my jurisdiction. */
  forUser(user: AuthUser, unreadOnly: boolean) {
    const roleScope: Prisma.NotificationWhereInput = {
      role: user.role,
      AND: [
        user.stateCode ? { OR: [{ stateCode: null }, { stateCode: user.stateCode }] } : {},
        user.districtCode ? { OR: [{ districtCode: null }, { districtCode: user.districtCode }] } : {},
      ],
    };
    return this.prisma.notification.findMany({
      where: { OR: [{ userId: user.id }, roleScope], isRead: unreadOnly ? false : undefined },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markRead(user: AuthUser, id: string) {
    // updateMany with the same visibility filter: a user cannot mark others' notifications.
    const res = await this.prisma.notification.updateMany({
      where: { id, OR: [{ userId: user.id }, { role: user.role }] },
      data: { isRead: true },
    });
    return { updated: res.count };
  }
}
