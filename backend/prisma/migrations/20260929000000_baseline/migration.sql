-- R-NLAM baseline.
-- Extensions are created by scripts/db-setup.ps1 as superuser in schema "extensions";
-- these statements are then no-ops, and document the dependency.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS postgis SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch SCHEMA extensions;
SET search_path TO public, extensions;
DO $$ BEGIN
  EXECUTE format('ALTER DATABASE %I SET search_path TO public, extensions', current_database());
END $$;

-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('CENTRAL_ADMIN', 'CENTRAL_OFFICER', 'STATE_ADMIN', 'STATE_OFFICER', 'DISTRICT_OFFICER', 'PIA_OFFICER', 'FIELD_OFFICER', 'RR_OFFICER', 'FINANCE_OFFICER', 'GIS_OFFICER', 'CITIZEN');

-- CreateEnum
CREATE TYPE "JurisdictionLevel" AS ENUM ('NATION', 'STATE', 'DISTRICT', 'TEHSIL', 'VILLAGE');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_SCRUTINY', 'APPROVED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_SCRUTINY', 'QUERY_RAISED', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ParcelStage" AS ENUM ('IDENTIFIED', 'PRELIM_NOTIFIED', 'DECLARED', 'AWARDED', 'COMPENSATION_PAID', 'POSSESSION_TAKEN', 'HANDED_OVER', 'LAPSED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'SYSTEM_MATCHED', 'OFFICER_VERIFIED', 'DISCREPANCY', 'DISPUTED');

-- CreateEnum
CREATE TYPE "NoticeKind" AS ENUM ('SEC_4_SIA', 'SEC_11_PRELIMINARY', 'SEC_19_DECLARATION', 'SEC_21_NOTICE', 'SEC_23_AWARD');

-- CreateEnum
CREATE TYPE "ObjectionStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'HEARING_SCHEDULED', 'RESOLVED', 'REJECTED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "HearingStatus" AS ENUM ('SCHEDULED', 'HELD', 'ADJOURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AwardStatus" AS ENUM ('DRAFT', 'DECLARED', 'REVISED', 'CHALLENGED');

-- CreateEnum
CREATE TYPE "CompensationStatus" AS ENUM ('ASSESSED', 'APPROVED', 'INITIATED', 'PAID', 'FAILED', 'DISPUTED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "RRStatus" AS ENUM ('IDENTIFIED', 'ELIGIBILITY_VERIFIED', 'PLAN_CREATED', 'BENEFIT_ASSIGNED', 'BENEFIT_DELIVERED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "EntitlementStatus" AS ENUM ('ASSIGNED', 'DELIVERED', 'WAIVED');

-- CreateEnum
CREATE TYPE "PossessionStatus" AS ENUM ('ELIGIBLE', 'SCHEDULED', 'POSSESSION_TAKEN', 'HANDED_TO_PIA');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('GAZETTE_NOTIFICATION', 'AWARD_COPY', 'KHASRA_EXTRACT', 'SIA_REPORT', 'GRAM_SABHA_CONSENT', 'FRA_SETTLEMENT_CERTIFICATE', 'FOREST_CLEARANCE', 'CRZ_CLEARANCE', 'WILDLIFE_CLEARANCE', 'POSSESSION_CERTIFICATE', 'PAYMENT_ADVICE', 'COURT_ORDER', 'FIELD_PHOTO', 'OTHER');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "stateCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Jurisdiction" (
    "id" TEXT NOT NULL,
    "level" "JurisdictionLevel" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameLocal" TEXT,
    "parentId" TEXT,
    "stateCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Jurisdiction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "RoleName" NOT NULL DEFAULT 'CITIZEN',
    "designation" TEXT,
    "organizationId" TEXT,
    "jurisdictionId" TEXT,
    "personId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "description" TEXT,
    "stateCode" TEXT NOT NULL,
    "stateName" TEXT NOT NULL,
    "districtCodes" TEXT[],
    "districtNames" TEXT[],
    "piaOrgId" TEXT,
    "piaName" TEXT NOT NULL,
    "actCode" TEXT NOT NULL DEFAULT 'RFCTLARR_2013',
    "requiredAreaHa" DOUBLE PRECISION NOT NULL,
    "estimatedCostPaise" BIGINT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "alignment" JSONB,
    "isSynthetic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "landRequiredHa" DOUBLE PRECISION NOT NULL,
    "alignmentGeo" JSONB,
    "status" "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "remarks" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatutoryNotice" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "NoticeKind" NOT NULL,
    "referenceNo" TEXT NOT NULL,
    "gazetteRef" TEXT,
    "publishedOn" TIMESTAMP(3) NOT NULL,
    "documentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatutoryNotice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parcel" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parcelNumber" TEXT NOT NULL,
    "surveyNumber" TEXT NOT NULL,
    "ulpin" TEXT,
    "villageId" TEXT NOT NULL,
    "villageName" TEXT NOT NULL,
    "districtCode" TEXT NOT NULL,
    "districtName" TEXT NOT NULL,
    "stateCode" TEXT NOT NULL,
    "stateName" TEXT NOT NULL,
    "totalAreaHa" DOUBLE PRECISION NOT NULL,
    "acquiredAreaHa" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "landClass" TEXT NOT NULL,
    "landUse" TEXT,
    "isRural" BOOLEAN NOT NULL DEFAULT true,
    "distanceFromUrbanKm" DOUBLE PRECISION,
    "marketRatePaisePerHa" BIGINT,
    "stage" "ParcelStage" NOT NULL DEFAULT 'IDENTIFIED',
    "verificationState" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "displayOwnerName" TEXT NOT NULL,
    "geometry" JSONB,
    "areaSqm" DOUBLE PRECISION,
    "familiesAffected" INTEGER NOT NULL DEFAULT 0,
    "isSynthetic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parcel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameScript" TEXT NOT NULL DEFAULT 'Latn',
    "fatherName" TEXT,
    "gender" TEXT,
    "phone" TEXT,
    "idHash" TEXT,
    "villageCode" TEXT,
    "source" TEXT NOT NULL DEFAULT 'LAND_RECORDS',
    "isSynthetic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParcelHolder" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "sharePct" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "nameAsRecorded" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'LAND_RECORDS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParcelHolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandRecordReference" (
    "id" TEXT NOT NULL,
    "surveyNo" TEXT NOT NULL,
    "villageCode" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "areaHa" DOUBLE PRECISION NOT NULL,
    "recordDate" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'STATE_LAND_RECORDS_SYNTHETIC',
    "rawData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LandRecordReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParcelVerification" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "verifiedById" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracyM" DOUBLE PRECISION,
    "photoUrl" TEXT,
    "notes" TEXT,
    "status" "VerificationStatus" NOT NULL DEFAULT 'OFFICER_VERIFIED',
    "isOfflineSync" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParcelVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "role" "RoleName",
    "stateCode" TEXT,
    "districtCode" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "entityType" TEXT,
    "entityId" TEXT,
    "dedupeKey" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Objection" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "applicant" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "filedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ObjectionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Objection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hearing" (
    "id" TEXT NOT NULL,
    "objectionId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "venue" TEXT NOT NULL,
    "presidingOfficer" TEXT NOT NULL,
    "status" "HearingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "outcome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hearing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Award" (
    "id" TEXT NOT NULL,
    "awardNumber" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "awardDate" TIMESTAMP(3) NOT NULL,
    "marketValuePaise" BIGINT NOT NULL,
    "multiplier" DECIMAL(4,2) NOT NULL,
    "assetsValuePaise" BIGINT NOT NULL DEFAULT 0,
    "solatiumPaise" BIGINT NOT NULL,
    "additionalAmountPaise" BIGINT NOT NULL,
    "totalPaise" BIGINT NOT NULL,
    "calculation" JSONB NOT NULL,
    "status" "AwardStatus" NOT NULL DEFAULT 'DECLARED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Award_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Compensation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "awardId" TEXT,
    "personId" TEXT,
    "beneficiaryName" TEXT NOT NULL,
    "sharePct" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "bankAccountLast4" TEXT,
    "ifscCode" TEXT,
    "amountPaise" BIGINT NOT NULL,
    "status" "CompensationStatus" NOT NULL DEFAULT 'ASSESSED',
    "paidOn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Compensation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentReference" (
    "id" TEXT NOT NULL,
    "compensationId" TEXT NOT NULL,
    "utrNumber" TEXT NOT NULL,
    "gatewaySource" TEXT NOT NULL DEFAULT 'PFMS_SYNTHETIC',
    "amountPaise" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "transactedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffectedFamily" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "headName" TEXT NOT NULL,
    "headNameLocal" TEXT,
    "familySize" INTEGER NOT NULL,
    "idHash" TEXT NOT NULL,
    "villageName" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'LANDOWNER',
    "isVulnerable" BOOLEAN NOT NULL DEFAULT false,
    "isDisplaced" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffectedFamily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entitlement" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amountPaise" BIGINT,
    "description" TEXT NOT NULL,
    "citation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Entitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RRCase" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "status" "RRStatus" NOT NULL DEFAULT 'IDENTIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RRCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RREntitlementGrant" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "entitlementId" TEXT NOT NULL,
    "amountPaise" BIGINT,
    "status" "EntitlementStatus" NOT NULL DEFAULT 'ASSIGNED',
    "deliveredOn" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RREntitlementGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Possession" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "status" "PossessionStatus" NOT NULL DEFAULT 'ELIGIBLE',
    "scheduledOn" TIMESTAMP(3),
    "takenOn" TIMESTAMP(3),
    "handedOverOn" TIMESTAMP(3),
    "authority" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Possession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageBackend" TEXT NOT NULL DEFAULT 'local',
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "projectId" TEXT,
    "parcelId" TEXT,
    "referenceNo" TEXT,
    "issuedOn" TIMESTAMP(3),
    "uploadedById" TEXT,
    "isSynthetic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SLATask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskName" TEXT NOT NULL,
    "assignedRole" "RoleName" NOT NULL,
    "slaDays" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "completedDate" TIMESTAMP(3),
    "isBreached" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SLATask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StateTransition" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "fromState" TEXT NOT NULL,
    "toState" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" "RoleName",
    "reason" TEXT,
    "override" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StateTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "seq" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "previousState" JSONB,
    "newState" JSONB,
    "reason" TEXT,
    "highlighted" BOOLEAN NOT NULL DEFAULT false,
    "requestId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "previousHash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("seq")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "seq" BIGSERIAL NOT NULL,
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatchedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("seq")
);

-- CreateTable
CREATE TABLE "DataProvenance" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceRecordId" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',

    CONSTRAINT "DataProvenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskAssessment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "riskScore" DOUBLE PRECISION NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "contributingFactors" JSONB NOT NULL,
    "recommendation" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'synthetic-rf-v1',
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsQuery" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "sqlQuery" TEXT NOT NULL,
    "userRole" "RoleName" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ParcelToStatutoryNotice" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_code_key" ON "Organization"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Jurisdiction_code_key" ON "Jurisdiction"("code");

-- CreateIndex
CREATE INDEX "Jurisdiction_parentId_idx" ON "Jurisdiction"("parentId");

-- CreateIndex
CREATE INDEX "Jurisdiction_stateCode_level_idx" ON "Jurisdiction"("stateCode", "level");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_personId_key" ON "User"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_code_key" ON "Project"("code");

-- CreateIndex
CREATE INDEX "StatutoryNotice_projectId_kind_idx" ON "StatutoryNotice"("projectId", "kind");

-- CreateIndex
CREATE INDEX "Parcel_projectId_stage_idx" ON "Parcel"("projectId", "stage");

-- CreateIndex
CREATE INDEX "Parcel_villageId_idx" ON "Parcel"("villageId");

-- CreateIndex
CREATE INDEX "Parcel_districtCode_idx" ON "Parcel"("districtCode");

-- CreateIndex
CREATE UNIQUE INDEX "Parcel_projectId_parcelNumber_key" ON "Parcel"("projectId", "parcelNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ParcelHolder_parcelId_personId_source_key" ON "ParcelHolder"("parcelId", "personId", "source");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_role_isRead_idx" ON "Notification"("role", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "Award_awardNumber_key" ON "Award"("awardNumber");

-- CreateIndex
CREATE INDEX "Award_parcelId_idx" ON "Award"("parcelId");

-- CreateIndex
CREATE INDEX "Compensation_status_idx" ON "Compensation"("status");

-- CreateIndex
CREATE INDEX "Compensation_parcelId_idx" ON "Compensation"("parcelId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentReference_utrNumber_key" ON "PaymentReference"("utrNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Entitlement_code_key" ON "Entitlement"("code");

-- CreateIndex
CREATE INDEX "RRCase_parcelId_idx" ON "RRCase"("parcelId");

-- CreateIndex
CREATE UNIQUE INDEX "Possession_parcelId_key" ON "Possession"("parcelId");

-- CreateIndex
CREATE INDEX "Document_parcelId_kind_idx" ON "Document"("parcelId", "kind");

-- CreateIndex
CREATE INDEX "StateTransition_entityType_entityId_idx" ON "StateTransition"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEvent_id_key" ON "AuditEvent"("id");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEvent_hash_key" ON "AuditEvent"("hash");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_id_key" ON "OutboxEvent"("id");

-- CreateIndex
CREATE INDEX "OutboxEvent_dispatchedAt_idx" ON "OutboxEvent"("dispatchedAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_aggregateType_aggregateId_idx" ON "OutboxEvent"("aggregateType", "aggregateId");

-- CreateIndex
CREATE UNIQUE INDEX "_ParcelToStatutoryNotice_AB_unique" ON "_ParcelToStatutoryNotice"("A", "B");

-- CreateIndex
CREATE INDEX "_ParcelToStatutoryNotice_B_index" ON "_ParcelToStatutoryNotice"("B");

-- AddForeignKey
ALTER TABLE "Jurisdiction" ADD CONSTRAINT "Jurisdiction_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Jurisdiction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_piaOrgId_fkey" FOREIGN KEY ("piaOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatutoryNotice" ADD CONSTRAINT "StatutoryNotice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_villageId_fkey" FOREIGN KEY ("villageId") REFERENCES "Jurisdiction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcelHolder" ADD CONSTRAINT "ParcelHolder_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcelHolder" ADD CONSTRAINT "ParcelHolder_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcelVerification" ADD CONSTRAINT "ParcelVerification_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Objection" ADD CONSTRAINT "Objection_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hearing" ADD CONSTRAINT "Hearing_objectionId_fkey" FOREIGN KEY ("objectionId") REFERENCES "Objection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Award" ADD CONSTRAINT "Award_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Award" ADD CONSTRAINT "Award_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compensation" ADD CONSTRAINT "Compensation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compensation" ADD CONSTRAINT "Compensation_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compensation" ADD CONSTRAINT "Compensation_awardId_fkey" FOREIGN KEY ("awardId") REFERENCES "Award"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compensation" ADD CONSTRAINT "Compensation_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReference" ADD CONSTRAINT "PaymentReference_compensationId_fkey" FOREIGN KEY ("compensationId") REFERENCES "Compensation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffectedFamily" ADD CONSTRAINT "AffectedFamily_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RRCase" ADD CONSTRAINT "RRCase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RRCase" ADD CONSTRAINT "RRCase_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RRCase" ADD CONSTRAINT "RRCase_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "AffectedFamily"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RREntitlementGrant" ADD CONSTRAINT "RREntitlementGrant_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "RRCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RREntitlementGrant" ADD CONSTRAINT "RREntitlementGrant_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "Entitlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Possession" ADD CONSTRAINT "Possession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Possession" ADD CONSTRAINT "Possession_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SLATask" ADD CONSTRAINT "SLATask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StateTransition" ADD CONSTRAINT "StateTransition_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataProvenance" ADD CONSTRAINT "DataProvenance_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ParcelToStatutoryNotice" ADD CONSTRAINT "_ParcelToStatutoryNotice_A_fkey" FOREIGN KEY ("A") REFERENCES "Parcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ParcelToStatutoryNotice" ADD CONSTRAINT "_ParcelToStatutoryNotice_B_fkey" FOREIGN KEY ("B") REFERENCES "StatutoryNotice"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- PostGIS geometry for parcels, maintained from the GeoJSON column.
-- Prisma cannot map geometry, so it is invisible to the client; spatial
-- queries use $queryRaw against "geom".
-- ---------------------------------------------------------------------------
ALTER TABLE "Parcel" ADD COLUMN "geom" extensions.geometry(MultiPolygon, 4326);
CREATE INDEX "Parcel_geom_gist" ON "Parcel" USING GIST ("geom");

CREATE OR REPLACE FUNCTION parcel_sync_geom() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW."geometry" IS NULL THEN
    NEW."geom" := NULL;
    NEW."areaSqm" := NULL;
  ELSE
    NEW."geom" := ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(NEW."geometry"::text), 4326)), 3));
    -- geography gives true area in square metres on the ellipsoid
    NEW."areaSqm" := ST_Area(NEW."geom"::geography);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER parcel_sync_geom
BEFORE INSERT OR UPDATE OF "geometry" ON "Parcel"
FOR EACH ROW EXECUTE FUNCTION parcel_sync_geom();

-- Owner names are matched fuzzily (reconciliation, eCourts candidate links).
CREATE INDEX "Person_name_trgm" ON "Person" USING GIN ("name" gin_trgm_ops);
