-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "retentionFlaggedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "DestructionRecord" ADD COLUMN     "clientConfirmationRef" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "clientConfirmedBy" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "clientConfirmedOn" DATE,
ADD COLUMN     "details" JSONB,
ADD COLUMN     "objectsPurgedAt" TIMESTAMP(3),
ADD COLUMN     "pdfStatus" "ReportPdfStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "renderedAt" TIMESTAMP(3),
ADD COLUMN     "storageKey" TEXT;

-- Berita acara pemusnahan tidak dapat dihapus, dan isinya tidak berubah setelah dibuat. Hanya kolom hasil
-- penghapusan berkas dan render PDF yang boleh diisi kemudian.
CREATE OR REPLACE FUNCTION destruction_record_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'DestructionRecord is permanent: DELETE is not allowed' USING ERRCODE = 'raise_exception';
  END IF;
  IF NEW."assessmentId" IS DISTINCT FROM OLD."assessmentId"
     OR NEW."scope" IS DISTINCT FROM OLD."scope"
     OR NEW."executedAt" IS DISTINCT FROM OLD."executedAt"
     OR NEW."executedById" IS DISTINCT FROM OLD."executedById"
     OR NEW."objectCount" IS DISTINCT FROM OLD."objectCount"
     OR NEW."witnessName" IS DISTINCT FROM OLD."witnessName"
     OR NEW."notes" IS DISTINCT FROM OLD."notes"
     OR NEW."clientConfirmationRef" IS DISTINCT FROM OLD."clientConfirmationRef"
     OR NEW."clientConfirmedOn" IS DISTINCT FROM OLD."clientConfirmedOn"
     OR NEW."clientConfirmedBy" IS DISTINCT FROM OLD."clientConfirmedBy"
     OR NEW."details" IS DISTINCT FROM OLD."details" THEN
    RAISE EXCEPTION 'DestructionRecord content is immutable' USING ERRCODE = 'raise_exception';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "DestructionRecord_guard"
  BEFORE UPDATE OR DELETE ON "DestructionRecord"
  FOR EACH ROW
  EXECUTE FUNCTION destruction_record_guard();
