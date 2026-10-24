-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'LEAD_ASSESSOR', 'ASSESSOR', 'CLIENT_ADMIN', 'UNIT_COORDINATOR', 'EXECUTIVE_VIEWER');

-- CreateEnum
CREATE TYPE "AssignmentRole" AS ENUM ('LEAD_ASSESSOR', 'ASSESSOR');

-- CreateEnum
CREATE TYPE "InstrumentStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "AssessmentScope" AS ENUM ('CORPORATE', 'DIVISION', 'PROJECT');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'CONFIGURED', 'LOCKED', 'DATA_COLLECTION', 'SCORING', 'PANEL_REVIEW', 'ACTION_PLANNING', 'REPORTED', 'MONITORING', 'ARCHIVED', 'PURGED');

-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('HEAD_OFFICE', 'DIVISION', 'PROJECT', 'BRANCH');

-- CreateEnum
CREATE TYPE "StratumGroup" AS ENUM ('MANAGEMENT', 'SUPERVISORY', 'FIELD');

-- CreateEnum
CREATE TYPE "TokenKind" AS ENUM ('SURVEY', 'SELF_ASSESSMENT');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('id', 'en');

-- CreateEnum
CREATE TYPE "DurationBucket" AS ENUM ('<5', '5-10', '10-15', '15-20', '>20');

-- CreateEnum
CREATE TYPE "QualityFlag" AS ENUM ('POLA_SERAGAM', 'TERLALU_CEPAT', 'BANYAK_TIDAK_TAHU');

-- CreateEnum
CREATE TYPE "SelfAssessmentStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "ValidationSessionType" AS ENUM ('INTERVIEW', 'FOCUS_GROUP', 'VIRTUAL_SITE_VISIT');

-- CreateEnum
CREATE TYPE "ValidationSessionStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'DONE', 'VERIFIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReportKind" AS ENUM ('FULL', 'EXECUTIVE_SUMMARY', 'STATEMENT');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'FINAL');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "sector" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "totpSecretEnc" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "unitScope" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstrumentVersion" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "InstrumentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "defaultParameters" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstrumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aspect" (
    "id" TEXT NOT NULL,
    "instrumentVersionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxPointsStep5" INTEGER,
    "excludedFromLevel" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Aspect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Characteristic" (
    "id" TEXT NOT NULL,
    "instrumentVersionId" TEXT NOT NULL,
    "aspectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameId" TEXT NOT NULL,
    "nameEn" TEXT,
    "isContextual" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,
    "targetRespondents" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Characteristic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LevelStatement" (
    "id" TEXT NOT NULL,
    "characteristicId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "textId" TEXT NOT NULL,
    "textEn" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LevelStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceRequirement" (
    "id" TEXT NOT NULL,
    "characteristicId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvidenceRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClimateDimension" (
    "id" TEXT NOT NULL,
    "instrumentVersionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameId" TEXT NOT NULL,
    "nameEn" TEXT,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClimateDimension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClimateItem" (
    "id" TEXT NOT NULL,
    "dimensionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "textId" TEXT NOT NULL,
    "textEn" TEXT,
    "reverseCoded" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClimateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scopeType" "AssessmentScope" NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "targetLevel" INTEGER NOT NULL,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "instrumentVersionId" TEXT NOT NULL,
    "parameterSnapshot" JSONB,
    "lockedAt" TIMESTAMP(3),
    "lockedById" TEXT,
    "consentTextId" TEXT,
    "consentTextEn" TEXT,
    "dpaSigned" BOOLEAN NOT NULL DEFAULT false,
    "surveyOpensAt" TIMESTAMP(3),
    "surveyClosesAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentAssignment" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AssignmentRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "type" "UnitType" NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "radiusMeters" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stratum" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group" "StratumGroup" NOT NULL,
    "population" INTEGER NOT NULL,
    "isContractor" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stratum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterEntry" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "stratumId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "employeeNo" TEXT,
    "emailEnc" TEXT,
    "phoneEnc" TEXT,
    "isContractor" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RosterEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessToken" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "rosterEntryId" TEXT,
    "unitQrCodeId" TEXT,
    "unitId" TEXT NOT NULL,
    "stratumId" TEXT,
    "kind" "TokenKind" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstOpenedAt" TIMESTAMP(3),
    "consentAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "reminderCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitQrCode" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxIssuance" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitQrCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyResponse" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "stratumId" TEXT NOT NULL,
    "instrumentVersionId" TEXT NOT NULL,
    "language" "Locale" NOT NULL,
    "submittedOn" DATE NOT NULL,
    "durationBucket" "DurationBucket" NOT NULL,
    "qualityFlags" "QualityFlag"[],
    "excluded" BOOLEAN NOT NULL DEFAULT false,
    "excludedReason" TEXT,
    "excludedById" TEXT,

    CONSTRAINT "SurveyResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacteristicAnswer" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "characteristicId" TEXT NOT NULL,
    "level" INTEGER,

    CONSTRAINT "CharacteristicAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClimateAnswer" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "ClimateAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SelfAssessment" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "accessTokenId" TEXT NOT NULL,
    "respondentName" TEXT NOT NULL,
    "respondentPosition" TEXT NOT NULL,
    "status" "SelfAssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SelfAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SelfAssessmentAnswer" (
    "id" TEXT NOT NULL,
    "selfAssessmentId" TEXT NOT NULL,
    "characteristicId" TEXT NOT NULL,
    "level" INTEGER,
    "justification" TEXT,
    "evidenceIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SelfAssessmentAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceItem" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "unitId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersedesId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvidenceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceLink" (
    "id" TEXT NOT NULL,
    "evidenceItemId" TEXT NOT NULL,
    "characteristicId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvidenceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObservationWindow" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "checklist" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObservationWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObservationCapture" (
    "id" TEXT NOT NULL,
    "windowId" TEXT NOT NULL,
    "checklistItemCode" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "serverCapturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "accuracyMeters" DOUBLE PRECISION,
    "distanceFromSiteMeters" DOUBLE PRECISION,
    "outsideRadius" BOOLEAN NOT NULL DEFAULT false,
    "uploadedById" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObservationCapture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationSession" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "type" "ValidationSessionType" NOT NULL,
    "unitId" TEXT,
    "stratumId" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "meetingUrl" TEXT,
    "guideTemplateId" TEXT,
    "participantCount" INTEGER,
    "recordingConsent" BOOLEAN NOT NULL DEFAULT false,
    "status" "ValidationSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ValidationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationParticipant" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ValidationParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValidationRating" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "characteristicId" TEXT NOT NULL,
    "assessorId" TEXT NOT NULL,
    "level" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ValidationRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceRating" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "characteristicId" TEXT NOT NULL,
    "assessorId" TEXT NOT NULL,
    "level" DOUBLE PRECISION NOT NULL,
    "rationale" TEXT NOT NULL,
    "evidenceIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvidenceRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SclFulfillment" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "aspectCode" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "percent" DOUBLE PRECISION NOT NULL,
    "justification" TEXT NOT NULL,
    "enteredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SclFulfillment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreRun" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "inputSnapshot" JSONB NOT NULL,
    "parameterSnapshot" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "runById" TEXT NOT NULL,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoreRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PanelAdjustment" (
    "id" TEXT NOT NULL,
    "scoreRunId" TEXT NOT NULL,
    "characteristicId" TEXT NOT NULL,
    "engineValue" DOUBLE PRECISION NOT NULL,
    "adjustedValue" DOUBLE PRECISION NOT NULL,
    "rationale" TEXT NOT NULL,
    "decidedById" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PanelAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GapItem" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "characteristicId" TEXT NOT NULL,
    "currentIndex" DOUBLE PRECISION NOT NULL,
    "targetLevel" INTEGER NOT NULL,
    "gap" DOUBLE PRECISION NOT NULL,
    "priorityScore" DOUBLE PRECISION NOT NULL,
    "rootCause" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GapItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionItem" (
    "id" TEXT NOT NULL,
    "gapItemId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "ownerName" TEXT NOT NULL,
    "ownerPosition" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "successIndicator" TEXT NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'PLANNED',
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionUpdate" (
    "id" TEXT NOT NULL,
    "actionItemId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "progressPercent" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "kind" "ReportKind" NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "storageKey" TEXT,
    "signedById" TEXT,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "actorRole" "Role",
    "organizationId" TEXT,
    "assessmentId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ipHash" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DestructionRecord" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL,
    "executedById" TEXT NOT NULL,
    "objectCount" INTEGER NOT NULL,
    "witnessName" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DestructionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Membership_organizationId_idx" ON "Membership"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_organizationId_role_key" ON "Membership"("userId", "organizationId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "InstrumentVersion_code_key" ON "InstrumentVersion"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Aspect_instrumentVersionId_code_key" ON "Aspect"("instrumentVersionId", "code");

-- CreateIndex
CREATE INDEX "Characteristic_aspectId_idx" ON "Characteristic"("aspectId");

-- CreateIndex
CREATE UNIQUE INDEX "Characteristic_instrumentVersionId_code_key" ON "Characteristic"("instrumentVersionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "LevelStatement_characteristicId_level_key" ON "LevelStatement"("characteristicId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceRequirement_characteristicId_order_key" ON "EvidenceRequirement"("characteristicId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ClimateDimension_instrumentVersionId_code_key" ON "ClimateDimension"("instrumentVersionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ClimateItem_dimensionId_code_key" ON "ClimateItem"("dimensionId", "code");

-- CreateIndex
CREATE INDEX "Assessment_organizationId_status_idx" ON "Assessment"("organizationId", "status");

-- CreateIndex
CREATE INDEX "AssessmentAssignment_userId_idx" ON "AssessmentAssignment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentAssignment_assessmentId_userId_key" ON "AssessmentAssignment"("assessmentId", "userId");

-- CreateIndex
CREATE INDEX "Unit_assessmentId_idx" ON "Unit"("assessmentId");

-- CreateIndex
CREATE INDEX "Unit_parentId_idx" ON "Unit"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Stratum_assessmentId_code_key" ON "Stratum"("assessmentId", "code");

-- CreateIndex
CREATE INDEX "RosterEntry_assessmentId_unitId_idx" ON "RosterEntry"("assessmentId", "unitId");

-- CreateIndex
CREATE INDEX "RosterEntry_assessmentId_employeeNo_idx" ON "RosterEntry"("assessmentId", "employeeNo");

-- CreateIndex
CREATE UNIQUE INDEX "AccessToken_tokenHash_key" ON "AccessToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AccessToken_assessmentId_kind_completedAt_idx" ON "AccessToken"("assessmentId", "kind", "completedAt");

-- CreateIndex
CREATE INDEX "AccessToken_rosterEntryId_idx" ON "AccessToken"("rosterEntryId");

-- CreateIndex
CREATE INDEX "AccessToken_unitQrCodeId_idx" ON "AccessToken"("unitQrCodeId");

-- CreateIndex
CREATE UNIQUE INDEX "UnitQrCode_codeHash_key" ON "UnitQrCode"("codeHash");

-- CreateIndex
CREATE INDEX "UnitQrCode_assessmentId_unitId_idx" ON "UnitQrCode"("assessmentId", "unitId");

-- CreateIndex
CREATE INDEX "SurveyResponse_assessmentId_unitId_stratumId_idx" ON "SurveyResponse"("assessmentId", "unitId", "stratumId");

-- CreateIndex
CREATE INDEX "CharacteristicAnswer_characteristicId_idx" ON "CharacteristicAnswer"("characteristicId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacteristicAnswer_responseId_characteristicId_key" ON "CharacteristicAnswer"("responseId", "characteristicId");

-- CreateIndex
CREATE INDEX "ClimateAnswer_itemId_idx" ON "ClimateAnswer"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ClimateAnswer_responseId_itemId_key" ON "ClimateAnswer"("responseId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "SelfAssessment_accessTokenId_key" ON "SelfAssessment"("accessTokenId");

-- CreateIndex
CREATE INDEX "SelfAssessment_assessmentId_status_idx" ON "SelfAssessment"("assessmentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SelfAssessmentAnswer_selfAssessmentId_characteristicId_key" ON "SelfAssessmentAnswer"("selfAssessmentId", "characteristicId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceItem_storageKey_key" ON "EvidenceItem"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceItem_supersedesId_key" ON "EvidenceItem"("supersedesId");

-- CreateIndex
CREATE INDEX "EvidenceItem_assessmentId_unitId_idx" ON "EvidenceItem"("assessmentId", "unitId");

-- CreateIndex
CREATE INDEX "EvidenceLink_characteristicId_idx" ON "EvidenceLink"("characteristicId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceLink_evidenceItemId_characteristicId_key" ON "EvidenceLink"("evidenceItemId", "characteristicId");

-- CreateIndex
CREATE INDEX "ObservationWindow_assessmentId_unitId_idx" ON "ObservationWindow"("assessmentId", "unitId");

-- CreateIndex
CREATE UNIQUE INDEX "ObservationCapture_storageKey_key" ON "ObservationCapture"("storageKey");

-- CreateIndex
CREATE INDEX "ObservationCapture_windowId_idx" ON "ObservationCapture"("windowId");

-- CreateIndex
CREATE INDEX "ValidationSession_assessmentId_scheduledAt_idx" ON "ValidationSession"("assessmentId", "scheduledAt");

-- CreateIndex
CREATE INDEX "ValidationParticipant_sessionId_idx" ON "ValidationParticipant"("sessionId");

-- CreateIndex
CREATE INDEX "ValidationRating_characteristicId_idx" ON "ValidationRating"("characteristicId");

-- CreateIndex
CREATE UNIQUE INDEX "ValidationRating_sessionId_characteristicId_assessorId_key" ON "ValidationRating"("sessionId", "characteristicId", "assessorId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceRating_assessmentId_characteristicId_assessorId_key" ON "EvidenceRating"("assessmentId", "characteristicId", "assessorId");

-- CreateIndex
CREATE UNIQUE INDEX "SclFulfillment_assessmentId_aspectCode_step_key" ON "SclFulfillment"("assessmentId", "aspectCode", "step");

-- CreateIndex
CREATE INDEX "ScoreRun_assessmentId_createdAt_idx" ON "ScoreRun"("assessmentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PanelAdjustment_scoreRunId_characteristicId_key" ON "PanelAdjustment"("scoreRunId", "characteristicId");

-- CreateIndex
CREATE UNIQUE INDEX "GapItem_assessmentId_characteristicId_key" ON "GapItem"("assessmentId", "characteristicId");

-- CreateIndex
CREATE INDEX "ActionItem_gapItemId_idx" ON "ActionItem"("gapItemId");

-- CreateIndex
CREATE INDEX "ActionUpdate_actionItemId_idx" ON "ActionUpdate"("actionItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Report_assessmentId_kind_version_key" ON "Report"("assessmentId", "kind", "version");

-- CreateIndex
CREATE INDEX "AuditLog_assessmentId_at_idx" ON "AuditLog"("assessmentId", "at");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_at_idx" ON "AuditLog"("organizationId", "at");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_at_idx" ON "AuditLog"("actorId", "at");

-- CreateIndex
CREATE INDEX "DestructionRecord_assessmentId_idx" ON "DestructionRecord"("assessmentId");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aspect" ADD CONSTRAINT "Aspect_instrumentVersionId_fkey" FOREIGN KEY ("instrumentVersionId") REFERENCES "InstrumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Characteristic" ADD CONSTRAINT "Characteristic_instrumentVersionId_fkey" FOREIGN KEY ("instrumentVersionId") REFERENCES "InstrumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Characteristic" ADD CONSTRAINT "Characteristic_aspectId_fkey" FOREIGN KEY ("aspectId") REFERENCES "Aspect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LevelStatement" ADD CONSTRAINT "LevelStatement_characteristicId_fkey" FOREIGN KEY ("characteristicId") REFERENCES "Characteristic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceRequirement" ADD CONSTRAINT "EvidenceRequirement_characteristicId_fkey" FOREIGN KEY ("characteristicId") REFERENCES "Characteristic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClimateDimension" ADD CONSTRAINT "ClimateDimension_instrumentVersionId_fkey" FOREIGN KEY ("instrumentVersionId") REFERENCES "InstrumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClimateItem" ADD CONSTRAINT "ClimateItem_dimensionId_fkey" FOREIGN KEY ("dimensionId") REFERENCES "ClimateDimension"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_instrumentVersionId_fkey" FOREIGN KEY ("instrumentVersionId") REFERENCES "InstrumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAssignment" ADD CONSTRAINT "AssessmentAssignment_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAssignment" ADD CONSTRAINT "AssessmentAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stratum" ADD CONSTRAINT "Stratum_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterEntry" ADD CONSTRAINT "RosterEntry_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterEntry" ADD CONSTRAINT "RosterEntry_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterEntry" ADD CONSTRAINT "RosterEntry_stratumId_fkey" FOREIGN KEY ("stratumId") REFERENCES "Stratum"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessToken" ADD CONSTRAINT "AccessToken_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessToken" ADD CONSTRAINT "AccessToken_rosterEntryId_fkey" FOREIGN KEY ("rosterEntryId") REFERENCES "RosterEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessToken" ADD CONSTRAINT "AccessToken_unitQrCodeId_fkey" FOREIGN KEY ("unitQrCodeId") REFERENCES "UnitQrCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessToken" ADD CONSTRAINT "AccessToken_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessToken" ADD CONSTRAINT "AccessToken_stratumId_fkey" FOREIGN KEY ("stratumId") REFERENCES "Stratum"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitQrCode" ADD CONSTRAINT "UnitQrCode_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnitQrCode" ADD CONSTRAINT "UnitQrCode_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_stratumId_fkey" FOREIGN KEY ("stratumId") REFERENCES "Stratum"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_instrumentVersionId_fkey" FOREIGN KEY ("instrumentVersionId") REFERENCES "InstrumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_excludedById_fkey" FOREIGN KEY ("excludedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacteristicAnswer" ADD CONSTRAINT "CharacteristicAnswer_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "SurveyResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacteristicAnswer" ADD CONSTRAINT "CharacteristicAnswer_characteristicId_fkey" FOREIGN KEY ("characteristicId") REFERENCES "Characteristic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClimateAnswer" ADD CONSTRAINT "ClimateAnswer_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "SurveyResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClimateAnswer" ADD CONSTRAINT "ClimateAnswer_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ClimateItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelfAssessment" ADD CONSTRAINT "SelfAssessment_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelfAssessment" ADD CONSTRAINT "SelfAssessment_accessTokenId_fkey" FOREIGN KEY ("accessTokenId") REFERENCES "AccessToken"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelfAssessmentAnswer" ADD CONSTRAINT "SelfAssessmentAnswer_selfAssessmentId_fkey" FOREIGN KEY ("selfAssessmentId") REFERENCES "SelfAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelfAssessmentAnswer" ADD CONSTRAINT "SelfAssessmentAnswer_characteristicId_fkey" FOREIGN KEY ("characteristicId") REFERENCES "Characteristic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "EvidenceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceLink" ADD CONSTRAINT "EvidenceLink_evidenceItemId_fkey" FOREIGN KEY ("evidenceItemId") REFERENCES "EvidenceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceLink" ADD CONSTRAINT "EvidenceLink_characteristicId_fkey" FOREIGN KEY ("characteristicId") REFERENCES "Characteristic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservationWindow" ADD CONSTRAINT "ObservationWindow_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservationWindow" ADD CONSTRAINT "ObservationWindow_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservationWindow" ADD CONSTRAINT "ObservationWindow_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservationCapture" ADD CONSTRAINT "ObservationCapture_windowId_fkey" FOREIGN KEY ("windowId") REFERENCES "ObservationWindow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservationCapture" ADD CONSTRAINT "ObservationCapture_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationSession" ADD CONSTRAINT "ValidationSession_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationSession" ADD CONSTRAINT "ValidationSession_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationSession" ADD CONSTRAINT "ValidationSession_stratumId_fkey" FOREIGN KEY ("stratumId") REFERENCES "Stratum"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationParticipant" ADD CONSTRAINT "ValidationParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ValidationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationRating" ADD CONSTRAINT "ValidationRating_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ValidationSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationRating" ADD CONSTRAINT "ValidationRating_characteristicId_fkey" FOREIGN KEY ("characteristicId") REFERENCES "Characteristic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationRating" ADD CONSTRAINT "ValidationRating_assessorId_fkey" FOREIGN KEY ("assessorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceRating" ADD CONSTRAINT "EvidenceRating_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceRating" ADD CONSTRAINT "EvidenceRating_characteristicId_fkey" FOREIGN KEY ("characteristicId") REFERENCES "Characteristic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceRating" ADD CONSTRAINT "EvidenceRating_assessorId_fkey" FOREIGN KEY ("assessorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SclFulfillment" ADD CONSTRAINT "SclFulfillment_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SclFulfillment" ADD CONSTRAINT "SclFulfillment_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreRun" ADD CONSTRAINT "ScoreRun_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreRun" ADD CONSTRAINT "ScoreRun_runById_fkey" FOREIGN KEY ("runById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanelAdjustment" ADD CONSTRAINT "PanelAdjustment_scoreRunId_fkey" FOREIGN KEY ("scoreRunId") REFERENCES "ScoreRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanelAdjustment" ADD CONSTRAINT "PanelAdjustment_characteristicId_fkey" FOREIGN KEY ("characteristicId") REFERENCES "Characteristic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PanelAdjustment" ADD CONSTRAINT "PanelAdjustment_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GapItem" ADD CONSTRAINT "GapItem_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GapItem" ADD CONSTRAINT "GapItem_characteristicId_fkey" FOREIGN KEY ("characteristicId") REFERENCES "Characteristic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_gapItemId_fkey" FOREIGN KEY ("gapItemId") REFERENCES "GapItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionUpdate" ADD CONSTRAINT "ActionUpdate_actionItemId_fkey" FOREIGN KEY ("actionItemId") REFERENCES "ActionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionUpdate" ADD CONSTRAINT "ActionUpdate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_signedById_fkey" FOREIGN KEY ("signedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DestructionRecord" ADD CONSTRAINT "DestructionRecord_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DestructionRecord" ADD CONSTRAINT "DestructionRecord_executedById_fkey" FOREIGN KEY ("executedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
