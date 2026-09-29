import { Injectable, Logger, OnApplicationShutdown, OnApplicationBootstrap } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { canonicalJson } from '../common/canonical-json';
import { PrismaService } from '../prisma/prisma.service';
import { DeliveredEvent, DomainEvent, EventBus, EventHandler, matchesPattern } from './event-bus';

const POLL_MS = Number(process.env.OUTBOX_POLL_MS ?? 1500);
const BATCH = 100;
const MAX_ATTEMPTS = 8;
/** Only one dispatcher may run per database; the lock is released with the session. */
const DISPATCH_LOCK_KEY = 7_201_300_002;

/**
 * Default EventBus: a transactional outbox table in Postgres plus an in-process
 * dispatcher. Delivery is at-least-once, in `seq` order; handlers must be
 * idempotent. A Kafka adapter can replace the dispatcher's delivery step
 * (see kafka-event-bus.ts) without changing any publisher.
 */
@Injectable()
export class OutboxEventBus implements EventBus, OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('Outbox');
  private readonly handlers: Array<{ pattern: string; handler: EventHandler }> = [];
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  async publish(tx: Prisma.TransactionClient, event: DomainEvent): Promise<void> {
    await tx.outboxEvent.create({
      data: {
        type: event.type,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        payload: JSON.parse(canonicalJson(event.payload)) as Prisma.InputJsonValue,
      },
    });
  }

  subscribe(pattern: string, handler: EventHandler): void {
    this.handlers.push({ pattern, handler });
  }

  onApplicationBootstrap() {
    if (process.env.OUTBOX_DISPATCHER === 'off') return;
    this.timer = setInterval(() => void this.dispatchOnce(), POLL_MS);
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Deliver one batch. Public so tests and the demo reset can drain synchronously. */
  async dispatchOnce(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const [{ locked }] = await tx.$queryRaw<Array<{ locked: boolean }>>`
            SELECT pg_try_advisory_xact_lock(${DISPATCH_LOCK_KEY}::bigint) AS locked`;
          if (!locked) return 0;

          const events = await tx.outboxEvent.findMany({
            where: { dispatchedAt: null, attempts: { lt: MAX_ATTEMPTS } },
            orderBy: { seq: 'asc' },
            take: BATCH,
          });
          let delivered = 0;
          for (const row of events) {
            const event: DeliveredEvent = {
              id: row.id,
              seq: row.seq,
              type: row.type,
              aggregateType: row.aggregateType,
              aggregateId: row.aggregateId,
              payload: row.payload as Record<string, unknown>,
              occurredAt: row.occurredAt,
            };
            try {
              for (const { pattern, handler } of this.handlers) {
                if (matchesPattern(pattern, row.type)) await handler(event);
              }
              await tx.outboxEvent.update({ where: { seq: row.seq }, data: { dispatchedAt: new Date(), attempts: { increment: 1 } } });
              delivered++;
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              this.logger.warn(`Handler failed for ${row.type} #${row.seq}: ${message}`);
              await tx.outboxEvent.update({ where: { seq: row.seq }, data: { attempts: { increment: 1 }, lastError: message.slice(0, 500) } });
              // Stop at the first failure to preserve per-stream ordering.
              break;
            }
          }
          return delivered;
        },
        { timeout: 30_000 },
      );
    } catch (err) {
      this.logger.error(`Dispatch cycle failed: ${err instanceof Error ? err.message : String(err)}`);
      return 0;
    } finally {
      this.running = false;
    }
  }
}
