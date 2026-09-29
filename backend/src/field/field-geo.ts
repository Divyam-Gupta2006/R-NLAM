import { Prisma, PrismaClient } from '@prisma/client';
import { EvidenceBundle } from './field-evidence';

type Db = PrismaClient | Prisma.TransactionClient;
const round = (x: number | null | undefined, d: number) => (x === null || x === undefined ? null : Math.round(x * 10 ** d) / 10 ** d);

/**
 * Where field evidence sits against the recorded boundary (PostGIS, metres on
 * the spheroid): a point's distance from the parcel (0 = inside), or a walked
 * boundary's area and intersection-over-union with the recorded one.
 */
export async function evidenceGeometryCheck(db: Db, parcelId: string, b: Pick<EvidenceBundle, 'kind' | 'geometry'>) {
  const gj = JSON.stringify(b.geometry);
  if (b.kind === 'POINT') {
    const rows = await db.$queryRaw<Array<{ d: number | null }>>`
      SELECT extensions.ST_Distance(p.geom::extensions.geography, extensions.ST_SetSRID(extensions.ST_GeomFromGeoJSON(${gj}), 4326)::extensions.geography) AS d
      FROM "Parcel" p WHERE p.id = ${parcelId} AND p.geom IS NOT NULL`;
    return { distanceM: round(rows[0]?.d, 1), overlapIoU: null, capturedAreaSqm: null };
  }
  const rows = await db.$queryRaw<Array<{ iou: number | null; area: number | null }>>`
    WITH g AS (
      SELECT extensions.ST_MakeValid(extensions.ST_SetSRID(extensions.ST_GeomFromGeoJSON(${gj}), 4326)) AS e, p.geom AS r
      FROM "Parcel" p WHERE p.id = ${parcelId}
    )
    SELECT CASE WHEN r IS NULL THEN NULL ELSE
             extensions.ST_Area(extensions.ST_Intersection(e, r)::extensions.geography)
             / NULLIF(extensions.ST_Area(extensions.ST_Union(e, r)::extensions.geography), 0) END AS iou,
           extensions.ST_Area(e::extensions.geography) AS area
    FROM g`;
  return { distanceM: null, overlapIoU: round(rows[0]?.iou, 3), capturedAreaSqm: round(rows[0]?.area, 1) };
}
