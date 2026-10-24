-- AlterTable
ALTER TABLE "ValidationSession" ADD COLUMN     "label" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "notes" TEXT,
ALTER COLUMN "scheduledAt" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ValidationGuideTemplate" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "layer" "StratumGroup" NOT NULL,
    "intro" TEXT NOT NULL,
    "questions" JSONB NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ValidationGuideTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ValidationGuideTemplate_assessmentId_layer_key" ON "ValidationGuideTemplate"("assessmentId", "layer");

-- AddForeignKey
ALTER TABLE "ValidationSession" ADD CONSTRAINT "ValidationSession_guideTemplateId_fkey" FOREIGN KEY ("guideTemplateId") REFERENCES "ValidationGuideTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValidationGuideTemplate" ADD CONSTRAINT "ValidationGuideTemplate_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
