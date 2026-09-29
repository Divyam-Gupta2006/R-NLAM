import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CompensationStatus, ParcelStage, Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { Clock } from '../common/clock';
import { paging, parcelScope } from '../common/scope';
import { LifecycleService } from '../lifecycle/lifecycle.service';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_GATEWAY, PaymentGateway } from './payment-gateway';

@Injectable()
export class CompensationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: LifecycleService,
    private readonly clock: Clock,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  async list(user: AuthUser, f: { projectId?: string; status?: CompensationStatus; parcelId?: string; page?: string; pageSize?: string }) {
    const where: Prisma.CompensationWhereInput = { projectId: f.projectId, status: f.status, parcelId: f.parcelId, parcel: parcelScope(user) };
    const pg = paging(f.page, f.pageSize);
    const [items, total, totals] = await Promise.all([
      this.prisma.compensation.findMany({
        where,
        skip: pg.skip,
        take: pg.take,
        include: {
          parcel: { select: { id: true, parcelNumber: true, surveyNumber: true, villageName: true, districtName: true, stage: true } },
          award: { select: { awardNumber: true, awardDate: true } },
          paymentReferences: { orderBy: { transactedAt: 'desc' } },
        },
        orderBy: [{ status: 'asc' }, { amountPaise: 'desc' }],
      }),
      this.prisma.compensation.count({ where }),
      this.prisma.compensation.groupBy({ by: ['status'], where, _sum: { amountPaise: true }, _count: { _all: true } }),
    ]);
    return {
      items,
      total,
      page: pg.page,
      pageSize: pg.pageSize,
      totalsByStatus: totals.map((t) => ({ status: t.status, count: t._count._all, amountPaise: t._sum.amountPaise ?? 0n })),
      gateway: { name: this.gateway.name, synthetic: this.gateway.synthetic },
    };
  }

  /**
   * Initiate and settle one payment through the gateway. On success the
   * compensation becomes PAID; if that was the parcel's last unpaid line, the
   * parcel moves AWARDED → COMPENSATION_PAID (as SYSTEM) in the same transaction.
   */
  async pay(user: AuthUser, id: string) {
    const comp = await this.prisma.compensation.findFirst({ where: { id, parcel: parcelScope(user) } });
    if (!comp) throw new NotFoundException('Compensation not found');
    if (comp.status !== CompensationStatus.APPROVED) throw new BadRequestException(`Compensation is ${comp.status}; approve it first`);

    const result = await this.gateway.disburse({
      compensationId: comp.id,
      beneficiaryName: comp.beneficiaryName,
      amountPaise: comp.amountPaise,
      accountLast4: comp.bankAccountLast4,
    });

    return this.prisma.$transaction(
      async (tx) => {
        await this.lifecycle.transitionInTx(tx, {
          entityType: 'Compensation',
          entityId: id,
          event: 'INITIATE_PAYMENT',
          actor: user,
          fromDomainService: true,
          context: { gateway: result.gateway, synthetic: this.gateway.synthetic },
        });
        await tx.paymentReference.create({
          data: { compensationId: id, utrNumber: result.utrNumber, gatewaySource: result.gateway, amountPaise: comp.amountPaise, status: result.status },
        });
        if (result.status === 'FAILED') {
          await this.lifecycle.transitionInTx(tx, { entityType: 'Compensation', entityId: id, event: 'MARK_FAILED', actor: user, reason: result.message });
          return { status: 'FAILED', utrNumber: result.utrNumber, message: result.message };
        }
        await this.lifecycle.transitionInTx(tx, {
          entityType: 'Compensation',
          entityId: id,
          event: 'CONFIRM_PAID',
          actor: user,
          fromDomainService: true,
          data: { paidOn: this.clock.now() },
          context: { utrNumber: result.utrNumber },
        });

        const parcel = await tx.parcel.findUniqueOrThrow({ where: { id: comp.parcelId } });
        const unpaid = await tx.compensation.count({ where: { parcelId: comp.parcelId, status: { not: CompensationStatus.PAID } } });
        let parcelAdvanced = false;
        if (unpaid === 0 && parcel.stage === ParcelStage.AWARDED) {
          await this.lifecycle.transitionInTx(tx, {
            entityType: 'Parcel',
            entityId: comp.parcelId,
            event: 'COMPLETE_PAYMENT',
            actor: 'SYSTEM',
            reason: 'Last beneficiary paid',
          });
          parcelAdvanced = true;
        }
        return { status: 'PAID', utrNumber: result.utrNumber, gateway: result.gateway, synthetic: this.gateway.synthetic, parcelAdvanced };
      },
      { timeout: 30_000 },
    );
  }
}
