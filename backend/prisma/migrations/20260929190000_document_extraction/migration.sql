-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('PENDING_REVIEW', 'CONFIRMED', 'REJECTED');

-- CreateTable
CREATE TABLE "DocumentExtraction" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "documentSha256" TEXT NOT NULL,
    "textMethod" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentTypeConfidence" DOUBLE PRECISION NOT NULL,
    "proposed" JSONB NOT NULL,
    "needsReview" BOOLEAN NOT NULL,
    "status" "ExtractionStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "confirmed" JSONB,
    "corrections" INTEGER,
    "reviewNote" TEXT,
    "requestedById" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentExtraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentExtraction_documentId_createdAt_idx" ON "DocumentExtraction"("documentId", "createdAt");

-- AddForeignKey
ALTER TABLE "DocumentExtraction" ADD CONSTRAINT "DocumentExtraction_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
