-- CreateEnum
CREATE TYPE "GrievanceStatus" AS ENUM ('RECEIVED', 'UNDER_REVIEW', 'RESOLVED');

-- CreateTable
CREATE TABLE "Grievance" (
    "id" TEXT NOT NULL,
    "registrationNo" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'CPGRAMS_SYNTHETIC',
    "personId" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "status" "GrievanceStatus" NOT NULL DEFAULT 'RECEIVED',
    "reply" TEXT,
    "repliedById" TEXT,
    "repliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Grievance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigiLockerIssue" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "uri" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'DIGILOCKER_SYNTHETIC',
    "sha256" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DigiLockerIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Grievance_registrationNo_key" ON "Grievance"("registrationNo");

-- CreateIndex
CREATE INDEX "Grievance_parcelId_idx" ON "Grievance"("parcelId");

-- CreateIndex
CREATE INDEX "Grievance_personId_idx" ON "Grievance"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "DigiLockerIssue_documentId_personId_key" ON "DigiLockerIssue"("documentId", "personId");
