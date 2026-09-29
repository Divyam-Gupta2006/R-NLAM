-- CreateEnum
CREATE TYPE "BriefDecision" AS ENUM ('ACCEPTED', 'DISPUTED');

-- CreateTable
CREATE TABLE "BottleneckDecision" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "decision" "BriefDecision" NOT NULL,
    "comment" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" "RoleName" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BottleneckDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BottleneckDecision_key_createdAt_idx" ON "BottleneckDecision"("key", "createdAt");

-- CreateIndex
CREATE INDEX "BottleneckDecision_projectId_idx" ON "BottleneckDecision"("projectId");

