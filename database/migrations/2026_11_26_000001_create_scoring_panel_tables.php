<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Fase R7: penilaian asesor dan rapat panel (docs/01 M8, docs/03 bagian 2.2 sampai 5), dibawa dari skema v1
 * (EvidenceRating, SclFulfillment, ScoreRun, PanelAdjustment dan pemicu score_run_guard). Keputusan panel kini
 * mencakup pengukuhan nilai mesin, selain penyesuaian, agar setiap karakteristik bertanda memiliki keputusan tertulis.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('evidence_ratings', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('assessment_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('characteristic_id')->constrained()->restrictOnDelete();
            $table->foreignId('assessor_id')->constrained('users')->restrictOnDelete();
            $table->decimal('level', 2, 1);
            $table->text('rationale');
            // Id bukti dokumen dan rekaman observasi yang menjadi dasar nilai.
            $table->jsonb('evidence_item_ids')->default('[]');
            $table->jsonb('observation_capture_ids')->default('[]');
            $table->timestamps();
            $table->unique(['assessment_id', 'characteristic_id', 'assessor_id']);
        });
        DB::statement('ALTER TABLE evidence_ratings ADD CONSTRAINT evidence_ratings_level_check CHECK (level BETWEEN 1 AND 5 AND level * 2 = floor(level * 2))');
        DB::statement('ALTER TABLE evidence_ratings ADD CONSTRAINT evidence_ratings_rationale_present CHECK (length(btrim(rationale)) > 0)');

        // Pemenuhan jalur setara per aspek dan tangga (docs/03 bagian 5), diisi asesor utama.
        Schema::create('scl_fulfillments', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('assessment_id')->constrained()->cascadeOnDelete();
            $table->string('aspect_code', 8);
            $table->unsignedSmallInteger('step');
            $table->decimal('percent', 5, 2);
            $table->text('justification');
            $table->foreignId('updated_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();
            $table->unique(['assessment_id', 'aspect_code', 'step']);
        });
        DB::statement('ALTER TABLE scl_fulfillments ADD CONSTRAINT scl_fulfillments_values_check CHECK (step BETWEEN 2 AND 5 AND percent BETWEEN 0 AND 100 AND length(btrim(justification)) > 0)');

        Schema::create('score_runs', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('assessment_id')->constrained()->cascadeOnDelete();
            $table->string('engine_version', 16);
            // Nilai lapisan per karakteristik dan ringkasan sumber; tanpa jawaban mentah.
            $table->jsonb('input_snapshot');
            $table->jsonb('parameter_snapshot');
            $table->jsonb('result');
            $table->foreignId('run_by')->constrained('users')->restrictOnDelete();
            $table->timestampTz('created_at')->useCurrent();
            $table->boolean('is_final')->default(false);
            $table->jsonb('final_result')->nullable();
            $table->timestampTz('finalized_at')->nullable();
            $table->foreignId('finalized_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->index(['assessment_id', 'created_at']);
        });
        // Paling banyak satu eksekusi final per asesmen.
        DB::statement('CREATE UNIQUE INDEX score_runs_one_final ON score_runs (assessment_id) WHERE is_final');

        Schema::create('panel_decisions', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('score_run_id')->constrained()->restrictOnDelete();
            $table->foreignUlid('characteristic_id')->constrained()->restrictOnDelete();
            $table->string('characteristic_code', 16);
            // ADJUSTED: nilai diganti; CONFIRMED: nilai mesin dikukuhkan setelah dibahas.
            $table->string('kind', 16);
            $table->decimal('engine_value', 6, 4)->nullable();
            $table->decimal('adjusted_value', 3, 2)->nullable();
            $table->text('rationale');
            $table->foreignId('decided_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();
            $table->unique(['score_run_id', 'characteristic_id']);
        });
        DB::statement("ALTER TABLE panel_decisions ADD CONSTRAINT panel_decisions_values_check CHECK (length(btrim(rationale)) > 0 AND kind IN ('ADJUSTED', 'CONFIRMED') AND ((kind = 'ADJUSTED' AND adjusted_value BETWEEN 1 AND 5) OR (kind = 'CONFIRMED' AND adjusted_value IS NULL)))");

        // Hasil yang sudah ditetapkan rapat panel tidak dapat diubah (docs/01 M8). Masukan, parameter, dan hasil
        // mesin tidak pernah berubah setelah eksekusi; penetapan hanya mengisi kolom final satu kali.
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION score_run_guard() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
              IF TG_OP = 'DELETE' THEN
                IF OLD.is_final THEN RAISE EXCEPTION 'score_runs: final run cannot be deleted'; END IF;
                RETURN OLD;
              END IF;
              IF OLD.is_final THEN RAISE EXCEPTION 'score_runs: final run cannot be changed'; END IF;
              IF NEW.assessment_id IS DISTINCT FROM OLD.assessment_id OR NEW.engine_version IS DISTINCT FROM OLD.engine_version
                 OR NEW.input_snapshot IS DISTINCT FROM OLD.input_snapshot OR NEW.parameter_snapshot IS DISTINCT FROM OLD.parameter_snapshot
                 OR NEW.result IS DISTINCT FROM OLD.result OR NEW.run_by IS DISTINCT FROM OLD.run_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
                RAISE EXCEPTION 'score_runs: input and result are immutable';
              END IF;
              IF NEW.is_final AND (NEW.final_result IS NULL OR NEW.finalized_at IS NULL OR NEW.finalized_by IS NULL) THEN
                RAISE EXCEPTION 'score_runs: finalization requires final_result, finalized_at, finalized_by';
              END IF;
              IF NOT NEW.is_final AND (NEW.final_result IS NOT NULL OR NEW.finalized_at IS NOT NULL OR NEW.finalized_by IS NOT NULL) THEN
                RAISE EXCEPTION 'score_runs: final columns are written only at finalization';
              END IF;
              RETURN NEW;
            END $$;
            CREATE TRIGGER score_runs_guard BEFORE UPDATE OR DELETE ON score_runs FOR EACH ROW EXECUTE FUNCTION score_run_guard();

            CREATE OR REPLACE FUNCTION panel_decision_guard() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
              IF TG_OP IN ('UPDATE', 'DELETE') AND EXISTS (SELECT 1 FROM score_runs WHERE id = OLD.score_run_id AND is_final) THEN
                RAISE EXCEPTION 'panel_decisions: decision of a final run cannot be changed';
              END IF;
              IF TG_OP IN ('INSERT', 'UPDATE') AND EXISTS (SELECT 1 FROM score_runs WHERE id = NEW.score_run_id AND is_final) THEN
                RAISE EXCEPTION 'panel_decisions: decision of a final run cannot be changed';
              END IF;
              IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
              RETURN NEW;
            END $$;
            CREATE TRIGGER panel_decisions_guard BEFORE INSERT OR UPDATE OR DELETE ON panel_decisions FOR EACH ROW EXECUTE FUNCTION panel_decision_guard();
            SQL);
    }

    public function down(): void
    {
        DB::unprepared('DROP TRIGGER IF EXISTS panel_decisions_guard ON panel_decisions; DROP FUNCTION IF EXISTS panel_decision_guard();');
        DB::unprepared('DROP TRIGGER IF EXISTS score_runs_guard ON score_runs; DROP FUNCTION IF EXISTS score_run_guard();');
        Schema::dropIfExists('panel_decisions');
        Schema::dropIfExists('score_runs');
        Schema::dropIfExists('scl_fulfillments');
        Schema::dropIfExists('evidence_ratings');
    }
};
