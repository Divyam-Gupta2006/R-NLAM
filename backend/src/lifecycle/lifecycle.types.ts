import { Prisma, RoleName } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';

export type Tx = Prisma.TransactionClient;
export type Actor = AuthUser | 'SYSTEM';

/** Why a transition cannot happen right now. Shown verbatim to officers. */
export interface Blocker {
  code: string; // stable machine code, e.g. OPEN_OBJECTIONS, GIS_FOREST_OVERLAP
  message: string; // human explanation
  citation?: string; // legal basis, e.g. "RFCTLARR 2013, s.38(1)"
  /** A senior officer may override with a recorded reason (never for hard legal bars). */
  overridable: boolean;
  /** What would clear it, e.g. ["FOREST_CLEARANCE"] document kinds. */
  unblockedBy?: string[];
  evidence?: Record<string, unknown>;
}

export interface GuardContext {
  tx: Tx;
  entityType: string;
  entity: Record<string, unknown> & { id: string };
  event: string;
  actor: Actor;
  now: Date;
}

export interface Guard {
  name: string;
  check(ctx: GuardContext): Promise<Blocker[]>;
}

export interface TransitionDef {
  event: string;
  label: string;
  from: readonly string[];
  to: string;
  roles: readonly RoleName[];
  guards?: Guard[];
  /** Needs domain data (e.g. award amounts): only callable through its domain service. */
  domainOnly?: boolean;
}

export interface MachineDef {
  entityType: string; // Parcel, Objection, ...
  table: string; // quoted SQL table name, used for row locking
  stateField: string;
  states: readonly string[];
  transitions: TransitionDef[];
  /** Prisma delegate name on the client, e.g. "parcel". */
  delegate: 'parcel' | 'objection' | 'hearing' | 'compensation' | 'rRCase' | 'possession' | 'project' | 'proposal';
  /** Event type emitted to the outbox, e.g. parcel.stage_changed.v1 */
  eventType: string;
  /** Fields copied into the event payload for consumers (e.g. projectId). */
  eventFields?: readonly string[];
}

export class TransitionBlockedError extends Error {
  constructor(
    public readonly blockers: Blocker[],
    public readonly entityType: string,
    public readonly event: string,
  ) {
    super(`${entityType} ${event} blocked: ${blockers.map((b) => b.code).join(', ')}`);
  }
}
