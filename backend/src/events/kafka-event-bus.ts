import { Injectable, NotImplementedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DomainEvent, EventBus, EventHandler } from './event-bus';

/**
 * Scale-out adapter (EVENT_BUS=kafka). NOT IMPLEMENTED: the pitch deck names
 * Kafka, but a broker does not fit on the 2 GB dev laptop.
 *
 * Intended design, documented in docs/asyncapi.yaml:
 * - publishers keep writing to the outbox table (unchanged, atomic);
 * - a relay (Debezium, or the dispatcher with kafkajs) reads outbox rows in
 *   `seq` order and produces to topic `rnlam.<aggregateType>` keyed by
 *   aggregateId, so per-parcel ordering holds;
 * - consumers replace in-process subscribers.
 */
@Injectable()
export class KafkaEventBus implements EventBus {
  async publish(_tx: Prisma.TransactionClient, _event: DomainEvent): Promise<void> {
    throw new NotImplementedException('Kafka adapter is a documented stub; use EVENT_BUS=outbox');
  }

  subscribe(_pattern: string, _handler: EventHandler): void {
    throw new NotImplementedException('Kafka adapter is a documented stub; use EVENT_BUS=outbox');
  }
}
