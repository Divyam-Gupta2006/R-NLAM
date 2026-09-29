-- CreateEnum
CREATE TYPE "RulePackStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "ClockKind" AS ENUM ('OBJECTION_WINDOW', 'DECLARATION_DEADLINE', 'AWARD_DEADLINE', 'PAYMENT_DEADLINE', 'RR_MONETARY_DEADLINE');

-- CreateEnum
CREATE TYPE "ClockStatus" AS ENUM ('RUNNING', 'MET', 'MISSED');

-- CreateTable
CREATE TABLE "RulePack" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "actCode" TEXT NOT NULL,
    "stateCode" TEXT,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "status" "RulePackStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RulePack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleEntry" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "unit" TEXT,
    "citation" TEXT NOT NULL,
    "quote" TEXT,
    "unverified" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,

    CONSTRAINT "RuleEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatutoryClock" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "districtCode" TEXT NOT NULL,
    "stateCode" TEXT NOT NULL,
    "noticeId" TEXT,
    "kind" "ClockKind" NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL,
    "dueOn" TIMESTAMP(3) NOT NULL,
    "status" "ClockStatus" NOT NULL,
    "metOn" TIMESTAMP(3),
    "excludedDays" INTEGER NOT NULL DEFAULT 0,
    "ruleKey" TEXT NOT NULL,
    "packCode" TEXT NOT NULL,
    "citation" TEXT NOT NULL,
    "consequence" TEXT NOT NULL,
    "unverified" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatutoryClock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RulePack_code_key" ON "RulePack"("code");

-- CreateIndex
CREATE INDEX "RulePack_actCode_stateCode_status_idx" ON "RulePack"("actCode", "stateCode", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RuleEntry_packId_key_key" ON "RuleEntry"("packId", "key");

-- CreateIndex
CREATE INDEX "StatutoryClock_status_dueOn_idx" ON "StatutoryClock"("status", "dueOn");

-- CreateIndex
CREATE INDEX "StatutoryClock_districtCode_status_idx" ON "StatutoryClock"("districtCode", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StatutoryClock_parcelId_kind_key" ON "StatutoryClock"("parcelId", "kind");

-- AddForeignKey
ALTER TABLE "RuleEntry" ADD CONSTRAINT "RuleEntry_packId_fkey" FOREIGN KEY ("packId") REFERENCES "RulePack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

