/*
  Warnings:

  - Added the required column `latitude` to the `ObservationWindow` table without a default value. This is not possible if the table is not empty.
  - Added the required column `longitude` to the `ObservationWindow` table without a default value. This is not possible if the table is not empty.
  - Added the required column `radiusMeters` to the `ObservationWindow` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "EvidenceLink" ADD COLUMN     "requirementIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "ObservationCapture" ADD COLUMN     "sizeBytes" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ObservationWindow" ADD COLUMN     "latitude" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "longitude" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "radiusMeters" INTEGER NOT NULL,
ADD COLUMN     "title" TEXT NOT NULL DEFAULT '';
