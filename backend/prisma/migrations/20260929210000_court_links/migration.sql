-- CreateEnum
CREATE TYPE "CourtCaseCategory" AS ENUM ('TITLE_SUIT', 'LAR_REFERENCE', 'WRIT_PETITION', 'OTHER');

-- CreateEnum
CREATE TYPE "CourtCaseStatus" AS ENUM ('PENDING', 'DISPOSED');

-- CreateEnum
CREATE TYPE "CaseLinkStatus" AS ENUM ('CANDIDATE', 'CONFIRMED', 'REJECTED');

-- CreateTable
CREATE TABLE "CourtCase" (
    "id" TEXT NOT NULL,
    "cnr" TEXT NOT NULL,
    "courtName" TEXT NOT NULL,
    "caseType" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "category" "CourtCaseCategory" NOT NULL,
    "status" "CourtCaseStatus" NOT NULL,
    "stayOrder" BOOLEAN NOT NULL DEFAULT false,
    "filedOn" TIMESTAMP(3) NOT NULL,
    "nextHearingOn" TIMESTAMP(3),
    "disposedOn" TIMESTAMP(3),
    "petitioners" TEXT[],
    "respondents" TEXT[],
    "subject" TEXT NOT NULL,
    "surveyNumbers" TEXT[],
    "villageName" TEXT,
    "districtCode" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'ECOURTS_SYNTHETIC',
    "isSynthetic" BOOLEAN NOT NULL DEFAULT true,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourtCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseLink" (
    "id" TEXT NOT NULL,
    "courtCaseId" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "reasons" JSONB NOT NULL,
    "status" "CaseLinkStatus" NOT NULL DEFAULT 'CANDIDATE',
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourtCase_cnr_key" ON "CourtCase"("cnr");

-- CreateIndex
CREATE INDEX "CourtCase_districtCode_idx" ON "CourtCase"("districtCode");

-- CreateIndex
CREATE INDEX "CaseLink_parcelId_status_idx" ON "CaseLink"("parcelId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CaseLink_courtCaseId_parcelId_key" ON "CaseLink"("courtCaseId", "parcelId");

-- AddForeignKey
ALTER TABLE "CaseLink" ADD CONSTRAINT "CaseLink_courtCaseId_fkey" FOREIGN KEY ("courtCaseId") REFERENCES "CourtCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseLink" ADD CONSTRAINT "CaseLink_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
