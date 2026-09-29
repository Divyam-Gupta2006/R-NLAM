SET search_path TO public, extensions;

-- CreateEnum
CREATE TYPE "ConstraintKind" AS ENUM ('FOREST', 'SCHEDULED_AREA', 'FRA_CLAIM', 'CRZ', 'PROTECTED_AREA');

-- CreateTable
CREATE TABLE "ConstraintLayer" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "ConstraintKind" NOT NULL,
    "name" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "isSynthetic" BOOLEAN NOT NULL DEFAULT true,
    "geometry" JSONB NOT NULL,
    "geom" geometry(MultiPolygon,4326),
    "areaSqm" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConstraintLayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParcelConstraint" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "layerId" TEXT NOT NULL,
    "overlapSqm" DOUBLE PRECISION NOT NULL,
    "overlapPct" DOUBLE PRECISION NOT NULL,
    "overlapGeometry" JSONB NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParcelConstraint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConstraintLayer_code_key" ON "ConstraintLayer"("code");

-- CreateIndex
CREATE INDEX "ConstraintLayer_geom_gist" ON "ConstraintLayer" USING GIST ("geom");

-- CreateIndex
CREATE INDEX "ParcelConstraint_parcelId_idx" ON "ParcelConstraint"("parcelId");

-- CreateIndex
CREATE UNIQUE INDEX "ParcelConstraint_parcelId_layerId_key" ON "ParcelConstraint"("parcelId", "layerId");

-- AddForeignKey
ALTER TABLE "ParcelConstraint" ADD CONSTRAINT "ParcelConstraint_layerId_fkey" FOREIGN KEY ("layerId") REFERENCES "ConstraintLayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Keep geom/areaSqm in sync with the GeoJSON source (layers may be Polygon,
-- MultiPolygon or a FeatureCollection-derived GeometryCollection).
CREATE OR REPLACE FUNCTION constraint_layer_sync_geom() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  NEW."geom" := ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(NEW."geometry"::text), 4326)), 3));
  NEW."areaSqm" := ST_Area(NEW."geom"::geography);
  RETURN NEW;
END;
$$;

CREATE TRIGGER constraint_layer_sync_geom
BEFORE INSERT OR UPDATE OF "geometry" ON "ConstraintLayer"
FOR EACH ROW EXECUTE FUNCTION constraint_layer_sync_geom();
