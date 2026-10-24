-- AlterTable
ALTER TABLE "AccessToken" ADD COLUMN     "revokedReason" TEXT;

-- CreateTable
CREATE TABLE "ParticipationSnapshot" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "takenOn" DATE NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParticipationSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParticipationSnapshot_assessmentId_takenOn_key" ON "ParticipationSnapshot"("assessmentId", "takenOn");

-- AddForeignKey
ALTER TABLE "ParticipationSnapshot" ADD CONSTRAINT "ParticipationSnapshot_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
