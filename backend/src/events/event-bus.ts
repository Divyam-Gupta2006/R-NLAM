import { Prisma } from '@prisma/client';

/**
 * Domain event envelope. `type` is versioned (`parcel.stage_changed.v1`) and
 * documented in docs/asyncapi.yaml.
 */
export interface DomainEvent<P = Record<string, unknown>> {
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload: P;
}

export interface DeliveredEvent<P = Record<string, unknown>> extends DomainEvent<P> {
  id: string;
  seq: bigint;
  occurredAt: Date;
}

export type EventHandler = (event: DeliveredEvent) => Promise<void> | void;

/**
 * Publishing side. `publish` takes the caller's transaction so the event is
 * recorded atomically with the state change (transactional outbox).
 */
export interface EventBus {
  publish(tx: Prisma.TransactionClient, event: DomainEvent): Promise<void>;
  subscribe(typePattern: string, handler: EventHandler): void;
}

export const EVENT_BUS = Symbol('EVENT_BUS');

/** `parcel.*` matches `parcel.stage_changed.v1`; `*` matches everything. */
export function matchesPattern(pattern: string, type: string): boolean {
  if (pattern === '*') return true;
  if (pattern.endsWith('.*')) return type.startsWith(pattern.slice(0, -1));
  return pattern === type;
}
