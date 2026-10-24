-- AlterTable
ALTER TABLE "EvidenceRating" ADD COLUMN     "observationIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "ScoreRun" ADD COLUMN     "finalResult" JSONB,
ADD COLUMN     "finalizedAt" TIMESTAMP(3),
ADD COLUMN     "finalizedById" TEXT;

-- AddForeignKey
ALTER TABLE "ScoreRun" ADD CONSTRAINT "ScoreRun_finalizedById_fkey" FOREIGN KEY ("finalizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Hasil yang sudah ditetapkan rapat panel tidak dapat diubah (docs/01 M8). Masukan, parameter, dan hasil mesin
-- tidak pernah berubah setelah eksekusi; finalisasi hanya mengisi isFinal, finalResult, finalizedAt, dan
-- finalizedById satu kali. ScoreRun final tidak dapat dihapus, dan penyesuaian panel pada eksekusi final
-- tidak dapat ditambah, diubah, atau dihapus.

CREATE OR REPLACE FUNCTION score_run_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."isFinal" THEN
      RAISE EXCEPTION 'ScoreRun is final: DELETE is not allowed' USING ERRCODE = 'raise_exception';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD."isFinal" THEN
    RAISE EXCEPTION 'ScoreRun is final: UPDATE is not allowed' USING ERRCODE = 'raise_exception';
  END IF;
  IF NEW."assessmentId" IS DISTINCT FROM OLD."assessmentId"
     OR NEW."engineVersion" IS DISTINCT FROM OLD."engineVersion"
     OR NEW."inputSnapshot" IS DISTINCT FROM OLD."inputSnapshot"
     OR NEW."parameterSnapshot" IS DISTINCT FROM OLD."parameterSnapshot"
     OR NEW."result" IS DISTINCT FROM OLD."result"
     OR NEW."runById" IS DISTINCT FROM OLD."runById"
     OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'ScoreRun input and result are immutable' USING ERRCODE = 'raise_exception';
  END IF;
  IF NEW."isFinal" AND (NEW."finalResult" IS NULL OR NEW."finalizedAt" IS NULL OR NEW."finalizedById" IS NULL) THEN
    RAISE EXCEPTION 'ScoreRun finalization requires finalResult, finalizedAt, and finalizedById' USING ERRCODE = 'raise_exception';
  END IF;
  IF NOT NEW."isFinal" AND (NEW."finalResult" IS NOT NULL OR NEW."finalizedAt" IS NOT NULL OR NEW."finalizedById" IS NOT NULL) THEN
    RAISE EXCEPTION 'ScoreRun finalResult is written only at finalization' USING ERRCODE = 'raise_exception';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ScoreRun_guard"
  BEFORE UPDATE OR DELETE ON "ScoreRun"
  FOR EACH ROW
  EXECUTE FUNCTION score_run_guard();

CREATE OR REPLACE FUNCTION panel_adjustment_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND EXISTS (SELECT 1 FROM "ScoreRun" WHERE "id" = OLD."scoreRunId" AND "isFinal") THEN
    RAISE EXCEPTION 'PanelAdjustment belongs to a final ScoreRun: % is not allowed', TG_OP USING ERRCODE = 'raise_exception';
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND EXISTS (SELECT 1 FROM "ScoreRun" WHERE "id" = NEW."scoreRunId" AND "isFinal") THEN
    RAISE EXCEPTION 'PanelAdjustment belongs to a final ScoreRun: % is not allowed', TG_OP USING ERRCODE = 'raise_exception';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "PanelAdjustment_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "PanelAdjustment"
  FOR EACH ROW
  EXECUTE FUNCTION panel_adjustment_guard();

-- Alasan penyesuaian panel dan nilai asesor wajib diisi.
ALTER TABLE "PanelAdjustment"
  ADD CONSTRAINT "PanelAdjustment_rationale_present" CHECK (length(btrim("rationale")) > 0);
ALTER TABLE "EvidenceRating"
  ADD CONSTRAINT "EvidenceRating_rationale_present" CHECK (length(btrim("rationale")) > 0);
ALTER TABLE "SclFulfillment"
  ADD CONSTRAINT "SclFulfillment_justification_present" CHECK (length(btrim("justification")) > 0);
