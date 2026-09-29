-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('PENDING', 'AUTO_LINKED', 'CONFIRMED', 'REJECTED', 'UNLINKED');

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "identityGroupId" TEXT;

-- CreateTable
CREATE TABLE "PersonMatch" (
    "id" TEXT NOT NULL,
    "personAId" TEXT NOT NULL,
    "personBId" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reasons" JSONB NOT NULL,
    "requiresHuman" BOOLEAN NOT NULL DEFAULT true,
    "status" "MatchStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonMatch_status_idx" ON "PersonMatch"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PersonMatch_personAId_personBId_key" ON "PersonMatch"("personAId", "personBId");

