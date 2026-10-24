-- CreateEnum
CREATE TYPE "ReportPdfStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "content" JSONB,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "pdfStatus" "ReportPdfStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "renderError" TEXT,
ADD COLUMN     "renderedAt" TIMESTAMP(3),
ADD COLUMN     "signerName" TEXT,
ADD COLUMN     "signerPosition" TEXT;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Laporan final tidak dapat diubah (docs/01 M11). Isi snapshot tidak pernah berubah setelah versi dibuat.
-- Penandatanganan mengisi status FINAL beserta penanda tangan, nama, jabatan, dan waktunya sekaligus. Setelah
-- final, hanya kolom hasil render PDF yang boleh diisi (PDF final dirender sesudah tanda tangan), dan baris
-- tidak dapat dihapus.
CREATE OR REPLACE FUNCTION report_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" = 'FINAL' THEN
      RAISE EXCEPTION 'Report is final: DELETE is not allowed' USING ERRCODE = 'raise_exception';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW."content" IS DISTINCT FROM OLD."content"
     OR NEW."assessmentId" IS DISTINCT FROM OLD."assessmentId"
     OR NEW."version" IS DISTINCT FROM OLD."version"
     OR NEW."kind" IS DISTINCT FROM OLD."kind" THEN
    RAISE EXCEPTION 'Report content and identity are immutable' USING ERRCODE = 'raise_exception';
  END IF;
  IF OLD."status" = 'FINAL' AND (
       NEW."status" IS DISTINCT FROM OLD."status"
       OR NEW."signedById" IS DISTINCT FROM OLD."signedById"
       OR NEW."signedAt" IS DISTINCT FROM OLD."signedAt"
       OR NEW."signerName" IS DISTINCT FROM OLD."signerName"
       OR NEW."signerPosition" IS DISTINCT FROM OLD."signerPosition") THEN
    RAISE EXCEPTION 'Report is final: signature and status cannot change' USING ERRCODE = 'raise_exception';
  END IF;
  IF NEW."status" = 'FINAL' AND (NEW."signedById" IS NULL OR NEW."signedAt" IS NULL OR NEW."signerName" IS NULL OR NEW."signerPosition" IS NULL) THEN
    RAISE EXCEPTION 'A final report requires signer, name, position, and time' USING ERRCODE = 'raise_exception';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Report_guard"
  BEFORE UPDATE OR DELETE ON "Report"
  FOR EACH ROW
  EXECUTE FUNCTION report_guard();
