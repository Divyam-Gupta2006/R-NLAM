import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConstraintKind, DocumentKind, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth.types';
import { Clock } from '../common/clock';
import { parcelScope } from '../common/scope';
import { LifecycleService } from '../lifecycle/lifecycle.service';
import { Blocker, GuardContext, Tx } from '../lifecycle/lifecycle.types';
import { PrismaService } from '../prisma/prisma.service';
import { ruleValue } from '../rules/resolve';
import { RulesService } from '../rules/rules.service';

/** Overlaps smaller than this are digitising noise, not real encroachment. */
const MIN_OVERLAP_SQM = 10;

export interface LayerRequirement {
  requires: DocumentKind[];
  overridable: boolean;
  citation: string;
  unverified: boolean;
}

export interface GateItem {
  layerId: string;
  layerCode: string;
  layerName: string;
  kind: ConstraintKind;
  isSynthetic: boolean;
  overlapSqm: number;
  overlapPct: number;
  overlapGeometry: unknown;
  requires: DocumentKind[];
  present: Array<{ kind: DocumentKind; id: string; referenceNo: string | null; title: string }>;
  missing: DocumentKind[];
  satisfied: boolean;
  overridable: boolean;
  citation: string;
  unverified: boolean;
}

const KIND_LABEL: Record<ConstraintKind, string> = {
  FOREST: 'forest land',
  SCHEDULED_AREA: 'a Scheduled Area (Fifth Schedule)',
  FRA_CLAIM: 'a pending forest-rights claim',
  CRZ: 'a Coastal Regulation Zone',
  PROTECTED_AREA: 'a protected area / eco-sensitive zone',
};

/**
 * The GIS compliance gate: screens parcels against constraint layers in
 * PostGIS and blocks award and possession until the documents the rule pack
 * requires for each overlapped layer are on file. Enforced as lifecycle
 * guards, so no UI path (or API call) can skip it.
 */
@Injectable()
export class GisGateService implements OnModuleInit {
  private readonly logger = new Logger('GisGate');

  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: RulesService,
    private readonly lifecycle: LifecycleService,
    private readonly audit: AuditService,
    private readonly clock: Clock,
  ) {}

  onModuleInit() {
    const guard = { name: 'gisConsentGate', check: (ctx: GuardContext) => this.guard(ctx) };
    for (const event of ['DECLARE_AWARD', 'TAKE_POSSESSION', 'TAKE_POSSESSION_URGENCY']) this.lifecycle.addGuard('Parcel', event, guard);
  }

  /**
   * Recompute overlaps with ST_Intersects and the true (ellipsoidal) overlap
   * area. Pass parcel ids to screen some, or nothing to screen all.
   */
  async screen(parcelIds?: string[], tx: Tx | PrismaService = this.prisma) {
    return screenParcels(tx, parcelIds);
  }

  async requirement(stateCode: string, kind: ConstraintKind, on: Date): Promise<LayerRequirement> {
    const r = await this.rules.resolve(stateCode, on);
    const { value, rule } = ruleValue<{ requires: DocumentKind[]; overridable: boolean }>(r, `document.layer.${kind}`);
    return { requires: value.requires, overridable: value.overridable, citation: rule.citation, unverified: rule.unverified };
  }

  /** Every overlap on a parcel with what it requires and what is on file. */
  async evaluate(parcelId: string, db: Tx | PrismaService = this.prisma): Promise<GateItem[]> {
    const parcel = await db.parcel.findUnique({ where: { id: parcelId }, select: { stateCode: true } });
    if (!parcel) return [];
    const overlaps = await db.parcelConstraint.findMany({ where: { parcelId }, include: { layer: true } });
    if (!overlaps.length) return [];
    const docs = await db.document.findMany({ where: { parcelId }, select: { id: true, kind: true, referenceNo: true, title: true } });
    const now = this.clock.now();
    const items: GateItem[] = [];
    for (const o of overlaps) {
      const req = await this.requirement(parcel.stateCode, o.layer.kind, now);
      const present = docs.filter((d) => req.requires.includes(d.kind));
      const missing = req.requires.filter((k) => !present.some((d) => d.kind === k));
      items.push({
        layerId: o.layerId,
        layerCode: o.layer.code,
        layerName: o.layer.name,
        kind: o.layer.kind,
        isSynthetic: o.layer.isSynthetic,
        overlapSqm: o.overlapSqm,
        overlapPct: o.overlapPct,
        overlapGeometry: o.overlapGeometry,
        requires: req.requires,
        present,
        missing,
        satisfied: missing.length === 0,
        overridable: req.overridable,
        citation: req.citation,
        unverified: req.unverified,
      });
    }
    return items;
  }

  private async guard(ctx: GuardContext): Promise<Blocker[]> {
    const items = await this.evaluate(ctx.entity.id, ctx.tx);
    return items
      .filter((i) => !i.satisfied)
      .map((i) => ({
        code: `GIS_${i.kind}_OVERLAP`,
        message: `Parcel overlaps ${KIND_LABEL[i.kind]} “${i.layerName}” by ${(i.overlapSqm / 10_000).toFixed(3)} ha (${i.overlapPct}% of the parcel). Missing: ${i.missing.map((m) => m.replace(/_/g, ' ').toLowerCase()).join(', ')}.`,
        citation: i.citation,
        overridable: i.overridable,
        unblockedBy: i.missing,
        evidence: { layerCode: i.layerCode, overlapSqm: i.overlapSqm, overlapPct: i.overlapPct, unverifiedRule: i.unverified },
      }));
  }

  /** All parcels with overlaps in the caller's jurisdiction, with gate status. */
  async conflicts(user: AuthUser, projectId?: string) {
    const parcels = await this.prisma.parcel.findMany({
      where: { AND: [parcelScope(user), projectId ? { projectId } : {}, { id: { in: (await this.prisma.parcelConstraint.findMany({ select: { parcelId: true } })).map((c) => c.parcelId) } }] },
      select: { id: true, parcelNumber: true, surveyNumber: true, villageName: true, districtName: true, stage: true, totalAreaHa: true, projectId: true, familiesAffected: true },
    });
    const out = [];
    for (const p of parcels) {
      const items = await this.evaluate(p.id);
      out.push({ parcel: p, items, blocked: items.some((i) => !i.satisfied) });
    }
    return out.sort((a, b) => Number(b.blocked) - Number(a.blocked));
  }

  async layers() {
    const layers = await this.prisma.constraintLayer.findMany({ orderBy: { kind: 'asc' }, include: { _count: { select: { overlaps: true } } } });
    return layers.map((l) => ({
      id: l.id,
      code: l.code,
      kind: l.kind,
      name: l.name,
      source: l.source,
      isSynthetic: l.isSynthetic,
      areaSqm: l.areaSqm,
      overlaps: l._count.overlaps,
      geometry: l.geometry,
    }));
  }

  /** Load a layer from GeoJSON (Polygon / MultiPolygon / FeatureCollection) and rescreen every parcel. */
  async loadLayer(user: AuthUser, input: { code: string; kind: ConstraintKind; name: string; source: string; geojson: Record<string, unknown> }) {
    const geometry = toGeometry(input.geojson);
    return this.prisma.$transaction(
      async (tx) => {
        const layer = await tx.constraintLayer.upsert({
          where: { code: input.code },
          create: { code: input.code, kind: input.kind, name: input.name, source: input.source, isSynthetic: false, geometry: geometry as Prisma.InputJsonValue },
          update: { kind: input.kind, name: input.name, source: input.source, geometry: geometry as Prisma.InputJsonValue },
        });
        const screened = await this.screen(undefined, tx);
        await this.audit.append(tx, { actor: user, action: 'CONSTRAINT_LAYER_LOADED', entityType: 'ConstraintLayer', entityId: layer.id, newState: { code: layer.code, kind: layer.kind, name: layer.name, source: layer.source, ...screened } });
        return { layer: { id: layer.id, code: layer.code, kind: layer.kind, name: layer.name }, ...screened };
      },
      { timeout: 60_000 },
    );
  }
}

/**
 * Recompute overlaps with ST_Intersects and the true (ellipsoidal) overlap
 * area. Pass parcel ids to screen some, or nothing to screen all. Shared by the
 * service and the demo seed.
 */
export async function screenParcels(db: { $executeRaw: Prisma.TransactionClient['$executeRaw'] }, parcelIds?: string[]) {
  const filter = parcelIds?.length ? Prisma.sql`AND p.id IN (${Prisma.join(parcelIds)})` : Prisma.empty;
  await db.$executeRaw`DELETE FROM "ParcelConstraint" pc USING "Parcel" p WHERE pc."parcelId" = p.id ${filter}`;
  const inserted = await db.$executeRaw`
    INSERT INTO "ParcelConstraint" (id, "parcelId", "layerId", "overlapSqm", "overlapPct", "overlapGeometry", "detectedAt")
    SELECT gen_random_uuid()::text, p.id, l.id, o.sqm, round((100 * o.sqm / nullif(p."areaSqm", 0))::numeric, 2), extensions.ST_AsGeoJSON(o.g)::jsonb, now()
    FROM "Parcel" p
    JOIN "ConstraintLayer" l ON extensions.ST_Intersects(p.geom, l.geom)
    CROSS JOIN LATERAL (
      SELECT extensions.ST_Intersection(p.geom, l.geom) AS g,
             extensions.ST_Area(extensions.ST_Intersection(p.geom, l.geom)::extensions.geography) AS sqm
    ) o
    WHERE p.geom IS NOT NULL AND o.sqm >= ${MIN_OVERLAP_SQM} ${filter}`;
  return { overlaps: inserted };
}

/** Accept a Polygon, MultiPolygon or FeatureCollection of polygons; return one geometry. */
export function toGeometry(g: Record<string, unknown>): Record<string, unknown> {
  if (g.type === 'Polygon' || g.type === 'MultiPolygon') return g;
  if (g.type === 'Feature') return toGeometry(g.geometry as Record<string, unknown>);
  if (g.type === 'FeatureCollection') {
    const polys: unknown[] = [];
    for (const f of (g.features as Array<{ geometry: { type: string; coordinates: unknown[] } }>) ?? []) {
      if (f.geometry?.type === 'Polygon') polys.push(f.geometry.coordinates);
      if (f.geometry?.type === 'MultiPolygon') polys.push(...f.geometry.coordinates);
    }
    if (!polys.length) throw new BadRequestException('No polygon features in the FeatureCollection');
    return { type: 'MultiPolygon', coordinates: polys };
  }
  throw new BadRequestException('Expected a Polygon, MultiPolygon, Feature or FeatureCollection');
}
