-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "actionPlanPublishedAt" TIMESTAMP(3),
ADD COLUMN     "parameterDraft" JSONB;
