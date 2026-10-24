-- CreateEnum
CREATE TYPE "GapPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- AlterTable
ALTER TABLE "ActionItem" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "lastReminderAt" TIMESTAMP(3),
ADD COLUMN     "ownerEmail" TEXT,
ADD COLUMN     "unitId" TEXT;

-- AlterTable
ALTER TABLE "ActionUpdate" ADD COLUMN     "status" "ActionStatus";

-- AlterTable
ALTER TABLE "GapItem" ADD COLUMN     "isContextual" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priority" "GapPriority",
ADD COLUMN     "rank" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scoreRunId" TEXT;

-- CreateIndex
CREATE INDEX "ActionItem_unitId_idx" ON "ActionItem"("unitId");

-- AddForeignKey
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Kemajuan tindakan dalam persen.
ALTER TABLE "ActionUpdate" DROP CONSTRAINT IF EXISTS "ActionUpdate_progress_range";
ALTER TABLE "ActionUpdate"
  ADD CONSTRAINT "ActionUpdate_progress_range" CHECK ("progressPercent" BETWEEN 0 AND 100);
-- Tindakan yang diverifikasi selalu mencatat pemverifikasi dan waktunya.
ALTER TABLE "ActionItem"
  ADD CONSTRAINT "ActionItem_verified_complete" CHECK ("status" <> 'VERIFIED' OR ("verifiedById" IS NOT NULL AND "verifiedAt" IS NOT NULL));
