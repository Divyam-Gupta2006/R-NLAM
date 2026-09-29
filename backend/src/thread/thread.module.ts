import { Controller, Get, Injectable, Module, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators';
import { parcelScope, projectScope } from '../common/scope';
import { PrismaService } from '../prisma/prisma.service';

type Category = 'LEGAL' | 'LAND' | 'MONEY' | 'PEOPLE' | 'EVIDENCE' | 'OVERSIGHT';

/** Which strand of the thread an audited action belongs to. */
function categorise(entityType: string, action: string): Category {
  if (action.includes('OVERRIDE')) return 'OVERSIGHT';
  if (entityType === 'Document' || entityType === 'FieldEvidence') return 'EVIDENCE';
  if (entityType === 'Compensation' || entityType === 'Award' || action.includes('AWARD') || action.includes('PAY')) return 'MONEY';
  if (entityType === 'RRCase' || entityType === 'RREntitlementGrant' || entityType === 'PersonMatch' || action.startsWith('IDENTITY')) return 'PEOPLE';
  if (entityType === 'CaseLink') return 'LEGAL';
  if (entityType === 'StatutoryNotice' || entityType === 'Objection' || entityType === 'Hearing' || action.startsWith('NOTICE') || action === 'DECLARE') return 'LEGAL';
  if (entityType === 'Possession' || action.includes('POSSESSION') || action === 'HAND_OVER') return 'LAND';
  return 'LEGAL';
}

const TITLE: Record<string, string> = {
  PUBLISH_PRELIMINARY: 'Preliminary notification (s.11)',
  DECLARE: 'Declaration (s.19)',
  DECLARE_AWARD: 'Award declared (s.23)',
  DECLARE_AWARD_OVERRIDE: 'Award declared by senior override',
  COMPLETE_PAYMENT: 'All compensation paid',
  TAKE_POSSESSION: 'Possession taken (s.38)',
  TAKE_POSSESSION_URGENCY: 'Urgency possession (s.40)',
  HAND_OVER: 'Handed over to the requiring body',
  APPROVE: 'Compensation approved',
  INITIATE_PAYMENT: 'Payment initiated',
  CONFIRM_PAID: 'Payment credited',
  MARK_FAILED: 'Payment failed',
  RETRY: 'Payment retried',
  HOLD: 'Payment put on hold',
  RELEASE: 'Hold released',
  DISPUTE: 'Compensation disputed',
  OBJECTION_FILED: 'Objection filed (s.15)',
  SCHEDULE_HEARING: 'Hearing scheduled',
  RECORD_HELD: 'Hearing held',
  ADJOURN: 'Hearing adjourned',
  RESOLVE: 'Objection allowed',
  REJECT: 'Objection disallowed',
  ESCALATE: 'Objection escalated',
  VERIFY_ELIGIBILITY: 'R&R eligibility verified',
  CREATE_PLAN: 'R&R plan created',
  ASSIGN_BENEFITS: 'R&R entitlements assigned',
  RR_ENTITLEMENT_DELIVERED: 'R&R entitlement delivered',
  MARK_DELIVERED: 'All R&R benefits delivered',
  CLOSE: 'R&R case closed',
  TAKE: 'Possession record: taken',
  DOCUMENT_UPLOADED: 'Document filed',
  PARCEL_REGISTERED: 'Parcel registered',
  COMPENSATION_HELD_IDENTITY: 'Payment held: identity mismatch',
  AWARD_DECLARED_AFTER_URGENCY_POSSESSION: 'Award declared after urgency possession',
  IDENTITY_CONFIRM: 'Identity confirmed across records',
  IDENTITY_REJECT: 'Identity candidate rejected',
  IDENTITY_UNLINK: 'Identity link undone',
};

@Injectable()
class ThreadService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The parcel's digital thread: every audited event on the parcel and on
   * everything hanging off it, in chain order, each with its hash.
   */
  async parcelThread(user: AuthUser, parcelId: string) {
    const p = await this.prisma.parcel.findFirst({
      where: { AND: [{ id: parcelId }, parcelScope(user)] },
      include: {
        notices: { select: { id: true, kind: true, referenceNo: true, publishedOn: true } },
        compensations: { select: { id: true, beneficiaryName: true } },
        awards: { select: { id: true, awardNumber: true } },
        objections: { select: { id: true, hearings: { select: { id: true } } } },
        rrCases: { select: { id: true, grants: { select: { id: true } } } },
        possessions: { select: { id: true } },
        documents: { select: { id: true, title: true, sha256: true, kind: true } },
        holders: { select: { personId: true } },
        caseLinks: { select: { id: true } },
        fieldEvidence: { select: { id: true } },
      },
    });
    if (!p) throw new NotFoundException('Parcel not found');
    const matches = await this.prisma.personMatch.findMany({ where: { OR: [{ personAId: { in: p.holders.map((h) => h.personId) } }, { personBId: { in: p.holders.map((h) => h.personId) } }] }, select: { id: true } });
    const related = new Map<string, string>([[p.id, 'Parcel']]);
    for (const n of p.notices) related.set(n.id, 'StatutoryNotice');
    for (const c of p.compensations) related.set(c.id, 'Compensation');
    for (const a of p.awards) related.set(a.id, 'Award');
    for (const o of p.objections) {
      related.set(o.id, 'Objection');
      for (const h of o.hearings) related.set(h.id, 'Hearing');
    }
    for (const rc of p.rrCases) {
      related.set(rc.id, 'RRCase');
      for (const g of rc.grants) related.set(g.id, 'RREntitlementGrant');
    }
    for (const pos of p.possessions) related.set(pos.id, 'Possession');
    for (const d of p.documents) related.set(d.id, 'Document');
    for (const m of matches) related.set(m.id, 'PersonMatch');
    for (const l of p.caseLinks) related.set(l.id, 'CaseLink');
    for (const e of p.fieldEvidence) related.set(e.id, 'FieldEvidence');

    const audits = await this.prisma.auditEvent.findMany({
      where: { entityId: { in: [...related.keys()] } },
      orderBy: { seq: 'asc' },
      include: { user: { select: { name: true, designation: true } } },
    });
    const docs = new Map(p.documents.map((d) => [d.id, d]));
    const comps = new Map(p.compensations.map((c) => [c.id, c]));
    const notices = new Map(p.notices.map((n) => [n.id, n]));

    const items = audits.map((a) => {
      const newState = (a.newState ?? {}) as Record<string, unknown>;
      const baseAction = a.action.replace(/^NOTICE_PUBLISHED_.*/, 'NOTICE_PUBLISHED');
      let title = TITLE[a.action] ?? TITLE[baseAction] ?? a.action.replace(/_/g, ' ').toLowerCase();
      let detail: string | null = a.reason;
      if (a.entityType === 'StatutoryNotice') {
        const n = notices.get(a.entityId);
        title = `Notice published: ${n?.kind.replace(/_/g, ' ').toLowerCase() ?? 'notice'}`;
        detail = n?.referenceNo ?? detail;
      }
      if (a.entityType === 'Compensation') detail = [comps.get(a.entityId)?.beneficiaryName, newState.utrNumber ? `UTR ${String(newState.utrNumber)}` : null, a.reason].filter(Boolean).join(' · ') || null;
      if (a.entityType === 'Document') {
        const d = docs.get(a.entityId);
        detail = d ? `${d.title} · SHA-256 ${d.sha256.slice(0, 16)}…` : detail;
      }
      return {
        seq: a.seq,
        at: a.timestamp,
        category: categorise(a.entityType, a.action),
        title,
        detail,
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        actor: a.user ? `${a.user.name}${a.user.designation ? `, ${a.user.designation}` : ''}` : a.actorRole === 'SYSTEM' ? 'System' : a.actorRole,
        highlighted: a.highlighted,
        hash: a.hash,
        previousHash: a.previousHash,
        documentId: a.entityType === 'Document' ? a.entityId : null,
      };
    });
    // Chain order (seq) is the authority; show chronologically by event time.
    items.sort((x, y) => +x.at - +y.at || Number(x.seq - y.seq));
    return { parcelId: p.id, parcelNumber: p.parcelNumber, items, relatedEntities: related.size };
  }

  /**
   * Layered graph: project → notices → parcels → holders → cases, for one
   * project (optionally one village, to keep it readable).
   */
  async projectGraph(user: AuthUser, projectId: string, villageId?: string) {
    const project = await this.prisma.project.findFirst({ where: { AND: [{ id: projectId }, projectScope(user)] }, select: { id: true, code: true, name: true } });
    if (!project) throw new NotFoundException('Project not found');
    const parcels = await this.prisma.parcel.findMany({
      where: { AND: [{ projectId }, parcelScope(user), villageId ? { villageId } : {}] },
      take: 60,
      orderBy: { parcelNumber: 'asc' },
      select: {
        id: true,
        parcelNumber: true,
        stage: true,
        villageName: true,
        notices: { select: { id: true, kind: true, referenceNo: true } },
        holders: { select: { person: { select: { id: true, name: true, nameScript: true, identityGroupId: true } } } },
        objections: { select: { id: true, category: true, status: true } },
      },
    });
    const conflicts = await this.prisma.parcelConstraint.findMany({ where: { parcelId: { in: parcels.map((p) => p.id) } }, include: { layer: { select: { code: true, name: true, kind: true } } } });

    type Node = { id: string; layer: number; kind: string; label: string; sub?: string; status?: string };
    const nodes = new Map<string, Node>();
    const edges: Array<{ from: string; to: string; kind: string }> = [];
    const add = (n: Node) => nodes.has(n.id) || nodes.set(n.id, n);
    add({ id: project.id, layer: 0, kind: 'project', label: project.code, sub: project.name });
    for (const p of parcels) {
      add({ id: p.id, layer: 2, kind: 'parcel', label: p.parcelNumber, sub: p.villageName, status: p.stage });
      if (p.notices.length === 0) edges.push({ from: project.id, to: p.id, kind: 'contains' });
      for (const n of p.notices) {
        add({ id: n.id, layer: 1, kind: 'notice', label: n.kind.replace(/_/g, ' ').replace('SEC ', 's.').toLowerCase(), sub: n.referenceNo });
        if (!edges.some((e) => e.from === project.id && e.to === n.id)) edges.push({ from: project.id, to: n.id, kind: 'issued' });
        edges.push({ from: n.id, to: p.id, kind: 'covers' });
      }
      for (const h of p.holders) {
        add({ id: h.person.id, layer: 3, kind: 'holder', label: h.person.name, sub: h.person.identityGroupId ? 'identity confirmed' : undefined });
        edges.push({ from: p.id, to: h.person.id, kind: 'held by' });
      }
      for (const o of p.objections) {
        add({ id: o.id, layer: 4, kind: 'case', label: `Objection: ${o.category.replace(/_/g, ' ').toLowerCase()}`, status: o.status });
        edges.push({ from: p.id, to: o.id, kind: 'objection' });
      }
      for (const c of conflicts.filter((x) => x.parcelId === p.id)) {
        add({ id: `${c.layerId}`, layer: 4, kind: 'constraint', label: c.layer.name, sub: `${c.overlapPct}% overlap` });
        edges.push({ from: p.id, to: c.layerId, kind: 'overlaps' });
      }
    }
    return { project, nodes: [...nodes.values()], edges, truncated: parcels.length === 60 };
  }
}

@ApiTags('thread')
@ApiBearerAuth()
@Controller('thread')
class ThreadController {
  constructor(private readonly thread: ThreadService) {}

  @Get('parcels/:id')
  @ApiOperation({ summary: 'Digital thread: every audited event on a parcel and its notices, cases, money, R&R, possession and documents, with audit hashes' })
  parcel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.thread.parcelThread(user, id);
  }

  @Get('projects/:id/graph')
  @ApiOperation({ summary: 'Layered graph: project → notices → parcels → holders → cases/constraints' })
  @ApiQuery({ name: 'villageId', required: false })
  graph(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('villageId') villageId?: string) {
    return this.thread.projectGraph(user, id, villageId);
  }
}

@Module({ controllers: [ThreadController], providers: [ThreadService] })
export class ThreadModule {}
