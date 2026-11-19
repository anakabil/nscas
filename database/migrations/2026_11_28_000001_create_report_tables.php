<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Fase R10: laporan dan komunikasi hasil (docs/01 M11, docs/12 temuan T5), dibawa dari skema v1 (Report). Setiap
 * versi menyimpan potret isi laporan yang tidak pernah berubah; versi final ditandatangani asesor utama dan tidak
 * dapat diubah, kecuali kunci PDF yang diisi sekali (pemicu report_guard).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reports', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('assessment_id')->constrained()->cascadeOnDelete();
            // FULL, EXECUTIVE_SUMMARY, STATEMENT, WORKER_SUMMARY.
            $table->string('kind', 24);
            $table->unsignedSmallInteger('version');
            $table->string('locale', 2)->default('id');
            // DRAFT atau FINAL.
            $table->string('status', 8)->default('DRAFT');
            $table->jsonb('content');
            $table->string('storage_key', 300)->nullable();
            $table->char('pdf_sha256', 64)->nullable();
            $table->foreignId('signed_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestampTz('signed_at')->nullable();
            $table->string('signer_name', 200)->nullable();
            $table->string('signer_position', 200)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['assessment_id', 'kind', 'version']);
        });
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION report_guard() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
              IF TG_OP = 'DELETE' THEN
                RAISE EXCEPTION 'reports: versions cannot be deleted';
              END IF;
              IF NEW.assessment_id IS DISTINCT FROM OLD.assessment_id OR NEW.kind IS DISTINCT FROM OLD.kind OR NEW.version IS DISTINCT FROM OLD.version
                 OR NEW.locale IS DISTINCT FROM OLD.locale OR NEW.content IS DISTINCT FROM OLD.content OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
                RAISE EXCEPTION 'reports: content of a version is immutable';
              END IF;
              IF OLD.status = 'FINAL' THEN
                IF NEW.status IS DISTINCT FROM OLD.status OR NEW.signed_by IS DISTINCT FROM OLD.signed_by OR NEW.signed_at IS DISTINCT FROM OLD.signed_at
                   OR NEW.signer_name IS DISTINCT FROM OLD.signer_name OR NEW.signer_position IS DISTINCT FROM OLD.signer_position
                   OR (OLD.storage_key IS NOT NULL AND (NEW.storage_key IS DISTINCT FROM OLD.storage_key OR NEW.pdf_sha256 IS DISTINCT FROM OLD.pdf_sha256)) THEN
                  RAISE EXCEPTION 'reports: a signed version cannot be changed';
                END IF;
              END IF;
              IF NEW.status = 'FINAL' AND (NEW.signed_by IS NULL OR NEW.signed_at IS NULL OR NEW.signer_name IS NULL) THEN
                RAISE EXCEPTION 'reports: a final version needs a signer';
              END IF;
              RETURN NEW;
            END $$;
            CREATE TRIGGER reports_guard BEFORE UPDATE OR DELETE ON reports FOR EACH ROW EXECUTE FUNCTION report_guard();
            SQL);

        // Komunikasi hasil kepada pekerja (docs/12 temuan T5).
        Schema::create('result_communications', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('assessment_id')->constrained()->cascadeOnDelete();
            $table->date('communicated_on');
            $table->jsonb('channels');
            $table->string('audience', 300);
            $table->unsignedInteger('reached')->nullable();
            $table->text('note')->nullable();
            $table->foreignId('recorded_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('result_communications');
        DB::unprepared('DROP TRIGGER IF EXISTS reports_guard ON reports; DROP FUNCTION IF EXISTS report_guard();');
        Schema::dropIfExists('reports');
    }
};
