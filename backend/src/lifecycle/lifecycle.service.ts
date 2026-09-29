import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { Clock } from '../common/clock';
import { EVENT_BUS, EventBus } from '../events/event-bus';
import { PrismaService } from '../prisma/prisma.service';
import { ALL_MACHINES } from './machines';
import { Actor, Blocker, Guard, MachineDef, TransitionBlockedError, TransitionDef, Tx } from './lifecycle.types';

export interface TransitionRequest {
  entityType: string;
  entityId: string;
  event: string;
  actor: Actor;
  reason?: string | null;
  /** Senior officer overriding overridable blockers. Requires a reason. */
  override?: boolean;
  /** Extra fields written together with the state (e.g. paidOn). */
  data?: Record<string, unknown>;
  /** Merged into the audit entry and the event payload. */
  context?: Record<string, unknown>;
  /** Internal callers (domain services) may fire domainOnly transitions. */
  fromDomainService?: boolean;
}

const OVERRIDE_ROLES: RoleName[] = [RoleName.CENTRAL_ADMIN, RoleName.STATE_ADMIN];
const MIN_OVERRIDE_REASON = 20;

/**
 * The one place where lifecycle state changes. For each transition it, in a
 * single transaction: locks the row, checks the source state, the caller's role
 * and every guard, writes the new state, a StateTransition row, a hash-chained
 * AuditEvent and an outbox event.
 */
@Injectable()
export class LifecycleService {
  private readonly machines = new Map<string, MachineDef>();
  /** Guards contributed by feature modules (GIS gate, court stays, statutory lapse). */
  private readonly extraGuards = new Map<string, Guard[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly clock: Clock,
    @Inject(EVENT_BUS) private readonly bus: EventBus,
  ) {
    for (const m of ALL_MACHINES) this.machines.set(m.entityType, m);
  }

  /** Feature modules add guards here, e.g. addGuard('Parcel', 'DECLARE_AWARD', gisGate). */
  addGuard(entityType: string, event: string, guard: Guard) {
    const key = `${entityType}:${event}`;
    const list = this.extraGuards.get(key) ?? [];
    if (!list.some((g) => g.name === guard.name)) list.push(guard);
    this.extraGuards.set(key, list);
  }

  machine(entityType: string): MachineDef {
    const m = this.machines.get(entityType);
    if (!m) throw new NotFoundException(`No lifecycle for entity type ${entityType}`);
    return m;
  }

  definitions() {
    return [...this.machines.values()].map((m) => ({
      entityType: m.entityType,
      states: m.states,
      transitions: m.transitions.map((t) => ({
        event: t.event,
        label: t.label,
        from: t.from,
        to: t.to,
        roles: t.roles,
        domainOnly: !!t.domainOnly,
        guards: this.guardsFor(m, t).map((g) => g.name),
      })),
    }));
  }

  private guardsFor(m: MachineDef, t: TransitionDef): Guard[] {
    return [...(t.guards ?? []), ...(this.extraGuards.get(`${m.entityType}:${t.event}`) ?? [])];
  }

  private delegate(tx: Tx, m: MachineDef) {
    // Every delegate named in MachineDef has findUnique/update with the same shape.
    return tx[m.delegate] as unknown as {
      findUnique(args: { where: { id: string } }): Promise<(Record<string, unknown> & { id: string }) | null>;
      update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<Record<string, unknown> & { id: string }>;
    };
  }

  private async evaluate(tx: Tx, m: MachineDef, t: TransitionDef, entity: Record<string, unknown> & { id: string }, actor: Actor) {
    const blockers: Blocker[] = [];
    for (const guard of this.guardsFor(m, t)) {
      blockers.push(...(await guard.check({ tx, entityType: m.entityType, entity, event: t.event, actor, now: this.clock.now() })));
    }
    return blockers;
  }

  /** Current state, every transition the caller could fire, and what blocks each. */
  async inspect(entityType: string, entityId: string, actor: Actor) {
    const m = this.machine(entityType);
    return this.prisma.$transaction(async (tx) => {
      const entity = await this.delegate(tx, m).findUnique({ where: { id: entityId } });
      if (!entity) throw new NotFoundException(`${entityType} ${entityId} not found`);
      const state = String(entity[m.stateField]);
      const options = [];
      for (const t of m.transitions.filter((x) => x.from.includes(state))) {
        const roleOk = actor === 'SYSTEM' || t.roles.includes(actor.role);
        const blockers = await this.evaluate(tx, m, t, entity, actor);
        options.push({
          event: t.event,
          label: t.label,
          to: t.to,
          domainOnly: !!t.domainOnly,
          permitted: roleOk,
          blockers,
          canOverride: blockers.length > 0 && blockers.every((b) => b.overridable) && actor !== 'SYSTEM' && OVERRIDE_ROLES.includes(actor.role),
        });
      }
      const history = await tx.stateTransition.findMany({
        where: { entityType, entityId },
        orderBy: { createdAt: 'asc' },
        include: { actor: { select: { name: true, designation: true } } },
      });
      return { entityType, entityId, state, options, history };
    });
  }

  /** Run a transition in its own transaction. */
  async transition(req: TransitionRequest) {
    return this.prisma.$transaction((tx) => this.transitionInTx(tx, req), { timeout: 20_000 });
  }

  /** Run a transition inside the caller's transaction (domain services use this). */
  async transitionInTx(tx: Tx, req: TransitionRequest) {
    const m = this.machine(req.entityType);
    // Row lock: concurrent transitions on the same entity serialise here.
    await tx.$queryRawUnsafe(`SELECT 1 FROM ${m.table} WHERE id = $1 FOR UPDATE`, req.entityId);
    const entity = await this.delegate(tx, m).findUnique({ where: { id: req.entityId } });
    if (!entity) throw new NotFoundException(`${req.entityType} ${req.entityId} not found`);

    const from = String(entity[m.stateField]);
    const t = m.transitions.find((x) => x.event === req.event);
    if (!t) throw new BadRequestException(`Unknown event ${req.event} for ${req.entityType}`);
    if (!t.from.includes(from)) {
      throw new BadRequestException(`${req.entityType} is ${from}; ${req.event} is allowed only from ${t.from.join(' / ')}`);
    }
    if (t.domainOnly && !req.fromDomainService) {
      throw new BadRequestException(`${req.event} needs domain data; use its dedicated endpoint`);
    }
    if (req.actor !== 'SYSTEM' && !t.roles.includes(req.actor.role)) {
      throw new ForbiddenException(`Role ${req.actor.role} cannot ${t.label.toLowerCase()}`);
    }

    const blockers = await this.evaluate(tx, m, t, entity, req.actor);
    let overridden = false;
    if (blockers.length > 0) {
      const canOverride =
        req.override === true &&
        req.actor !== 'SYSTEM' &&
        OVERRIDE_ROLES.includes(req.actor.role) &&
        blockers.every((b) => b.overridable) &&
        (req.reason?.trim().length ?? 0) >= MIN_OVERRIDE_REASON;
      if (!canOverride) throw new TransitionBlockedError(blockers, req.entityType, req.event);
      overridden = true;
    }

    const updated = await this.delegate(tx, m).update({
      where: { id: req.entityId },
      data: { ...(req.data ?? {}), [m.stateField]: t.to },
    });

    const actorUser = req.actor === 'SYSTEM' ? null : req.actor;
    await tx.stateTransition.create({
      data: {
        entityType: m.entityType,
        entityId: req.entityId,
        event: t.event,
        fromState: from,
        toState: t.to,
        actorId: actorUser?.id ?? null,
        actorRole: actorUser?.role ?? null,
        reason: req.reason ?? null,
        override: overridden,
      },
    });

    await this.audit.append(tx, {
      actor: req.actor,
      action: overridden ? `${t.event}_OVERRIDE` : t.event,
      entityType: m.entityType,
      entityId: req.entityId,
      previousState: { [m.stateField]: from },
      newState: { [m.stateField]: t.to, ...(req.data ?? {}), ...(req.context ?? {}) },
      reason: req.reason ?? null,
      highlighted: overridden,
    });

    const eventFields: Record<string, unknown> = {};
    for (const f of m.eventFields ?? []) eventFields[f] = updated[f];
    await this.bus.publish(tx, {
      type: m.eventType,
      aggregateType: m.entityType,
      aggregateId: req.entityId,
      payload: {
        event: t.event,
        from,
        to: t.to,
        actorId: actorUser?.id ?? null,
        actorRole: actorUser?.role ?? 'SYSTEM',
        override: overridden,
        overriddenBlockers: overridden ? blockers.map((b) => b.code) : [],
        ...eventFields,
        ...(req.context ?? {}),
      },
    });

    return { entity: updated, from, to: t.to, overridden, blockers: overridden ? blockers : [] };
  }
}
