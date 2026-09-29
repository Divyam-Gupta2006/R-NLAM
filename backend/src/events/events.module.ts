import { Controller, Get, Global, Module, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { R } from '../auth/auth.types';
import { Roles } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { EVENT_BUS } from './event-bus';
import { KafkaEventBus } from './kafka-event-bus';
import { OutboxEventBus } from './outbox-event-bus';

@ApiTags('events')
@ApiBearerAuth()
@Roles(...R.OFFICIALS)
@Controller('events')
class EventsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Outbox events, newest first (the digital thread feed)' })
  @ApiQuery({ name: 'aggregateType', required: false })
  @ApiQuery({ name: 'aggregateId', required: false })
  list(@Query('aggregateType') aggregateType?: string, @Query('aggregateId') aggregateId?: string) {
    return this.prisma.outboxEvent.findMany({
      where: { aggregateType, aggregateId },
      orderBy: { seq: 'desc' },
      take: 200,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Outbox health: pending, failed and delivered counts' })
  async stats() {
    const [pending, failed, delivered] = await Promise.all([
      this.prisma.outboxEvent.count({ where: { dispatchedAt: null, lastError: null } }),
      this.prisma.outboxEvent.count({ where: { dispatchedAt: null, NOT: { lastError: null } } }),
      this.prisma.outboxEvent.count({ where: { NOT: { dispatchedAt: null } } }),
    ]);
    return { bus: process.env.EVENT_BUS ?? 'outbox', pending, failed, delivered };
  }
}

@Global()
@Module({
  controllers: [EventsController],
  providers: [
    OutboxEventBus,
    KafkaEventBus,
    {
      provide: EVENT_BUS,
      useFactory: (outbox: OutboxEventBus, kafka: KafkaEventBus) => (process.env.EVENT_BUS === 'kafka' ? kafka : outbox),
      inject: [OutboxEventBus, KafkaEventBus],
    },
  ],
  exports: [EVENT_BUS, OutboxEventBus],
})
export class EventsModule {}
