import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoleName } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  private calculateHash(previousHash: string, data: object): string {
    return crypto.createHash('sha256').update(previousHash + JSON.stringify(data)).digest('hex');
  }

  async findAll(filter: { entityType?: string; entityId?: string }) {
    const where: any = {};
    if (filter.entityType) where.entityType = filter.entityType;
    if (filter.entityId) where.entityId = filter.entityId;

    return this.prisma.auditEvent.findMany({
      where,
      include: { user: { select: { name: true, role: true } } },
      orderBy: { timestamp: 'desc' },
      take: 100,
    });
  }

  async logEvent(data: {
    actorId: string;
    actorRole: RoleName;
    action: string;
    entityType: string;
    entityId: string;
    previousState?: any;
    newState?: any;
    reason?: string;
    requestId?: string;
  }) {
    const lastEvent = await this.prisma.auditEvent.findFirst({
      orderBy: { timestamp: 'desc' },
    });

    const previousHash = lastEvent ? lastEvent.hash : 'GENESIS_HASH_00000000000000000000000000000000';
    const hashData = {
      actorId: data.actorId,
      actorRole: data.actorRole,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      timestamp: new Date().toISOString(),
    };

    const hash = this.calculateHash(previousHash, hashData);

    return this.prisma.auditEvent.create({
      data: {
        actorId: data.actorId,
        actorRole: data.actorRole,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        previousState: data.previousState || null,
        newState: data.newState || null,
        reason: data.reason || '',
        requestId: data.requestId || null,
        previousHash,
        hash,
      },
    });
  }

  async verifyChain() {
    const events = await this.prisma.auditEvent.findMany({
      orderBy: { timestamp: 'asc' },
    });

    let isValid = true;
    let tamperedEventId: string | null = null;
    let expectedPreviousHash = 'GENESIS_HASH_00000000000000000000000000000000';

    for (const event of events) {
      if (event.previousHash !== expectedPreviousHash) {
        isValid = false;
        tamperedEventId = event.id;
        break;
      }
      expectedPreviousHash = event.hash;
    }

    return {
      chainIntegrityValid: isValid,
      totalEventsAudited: events.length,
      tamperedEventId,
      statusMessage: isValid
        ? 'Audit chain cryptographic integrity verified successfully.'
        : `Tampering detected at event ID ${tamperedEventId}.`,
    };
  }
}
