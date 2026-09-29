-- CreateEnum
CREATE TYPE "FieldEvidenceKind" AS ENUM ('POINT', 'POLYGON');

-- CreateEnum
CREATE TYPE "FieldEvidenceStatus" AS ENUM ('ACCEPTED', 'CONFLICT', 'SUPERSEDED', 'REJECTED');

-- CreateTable
CREATE TABLE "FieldEvidence" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "capturedById" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "baseSyncedAt" TIMESTAMP(3),
    "kind" "FieldEvidenceKind" NOT NULL,
    "geometry" JSONB NOT NULL,
    "accuracyM" DOUBLE PRECISION NOT NULL,
    "samples" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "photoDocumentIds" TEXT[],
    "photoHashes" TEXT[],
    "bundleHash" TEXT NOT NULL,
    "hashVerified" BOOLEAN NOT NULL,
    "distanceM" DOUBLE PRECISION,
    "overlapIoU" DOUBLE PRECISION,
    "capturedAreaSqm" DOUBLE PRECISION,
    "status" "FieldEvidenceStatus" NOT NULL,
    "conflictReason" TEXT,
    "conflictWithId" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,

    CONSTRAINT "FieldEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FieldEvidence_clientId_key" ON "FieldEvidence"("clientId");

-- CreateIndex
CREATE INDEX "FieldEvidence_parcelId_receivedAt_idx" ON "FieldEvidence"("parcelId", "receivedAt");

-- AddForeignKey
ALTER TABLE "FieldEvidence" ADD CONSTRAINT "FieldEvidence_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
