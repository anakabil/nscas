<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Fase R11: retensi dan pemusnahan data mentah (docs/04 bagian 7), dibawa dari skema v1 (DestructionRecord dan
 * pemicu destruction_record_guard). Berita acara tidak dapat dihapus dan isinya tidak berubah; hanya hasil
 * penghapusan berkas dan PDF berita acara yang diisi kemudian, masing-masing sekali.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assessments', function (Blueprint $table) {
            $table->timestampTz('retention_flagged_at')->nullable();
        });

        Schema::create('destruction_records', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('assessment_id')->unique()->constrained()->restrictOnDelete();
            $table->timestampTz('executed_at');
            $table->foreignId('executed_by')->constrained('users')->restrictOnDelete();
            $table->string('client_confirmation_ref', 200);
            $table->string('client_confirmed_by', 200);
            $table->date('client_confirmed_on');
            $table->string('witness_name', 200);
            $table->text('notes')->nullable();
            // Banyak baris per tabel dan banyak berkas yang dimusnahkan.
            $table->jsonb('details');
            $table->unsignedInteger('object_count');
            $table->timestampTz('objects_purged_at')->nullable();
            $table->string('storage_key', 300)->nullable();
            $table->char('pdf_sha256', 64)->nullable();
            $table->timestamps();
        });
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION destruction_record_guard() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
              IF TG_OP = 'DELETE' THEN
                RAISE EXCEPTION 'destruction_records: a destruction record is permanent';
              END IF;
              IF NEW.assessment_id IS DISTINCT FROM OLD.assessment_id OR NEW.executed_at IS DISTINCT FROM OLD.executed_at
                 OR NEW.executed_by IS DISTINCT FROM OLD.executed_by OR NEW.client_confirmation_ref IS DISTINCT FROM OLD.client_confirmation_ref
                 OR NEW.client_confirmed_by IS DISTINCT FROM OLD.client_confirmed_by OR NEW.client_confirmed_on IS DISTINCT FROM OLD.client_confirmed_on
                 OR NEW.witness_name IS DISTINCT FROM OLD.witness_name OR NEW.notes IS DISTINCT FROM OLD.notes
                 OR NEW.details IS DISTINCT FROM OLD.details OR NEW.object_count IS DISTINCT FROM OLD.object_count
                 OR (OLD.objects_purged_at IS NOT NULL AND NEW.objects_purged_at IS DISTINCT FROM OLD.objects_purged_at)
                 OR (OLD.storage_key IS NOT NULL AND (NEW.storage_key IS DISTINCT FROM OLD.storage_key OR NEW.pdf_sha256 IS DISTINCT FROM OLD.pdf_sha256)) THEN
                RAISE EXCEPTION 'destruction_records: content is immutable';
              END IF;
              RETURN NEW;
            END $$;
            CREATE TRIGGER destruction_records_guard BEFORE UPDATE OR DELETE ON destruction_records FOR EACH ROW EXECUTE FUNCTION destruction_record_guard();
            SQL);
    }

    public function down(): void
    {
        DB::unprepared('DROP TRIGGER IF EXISTS destruction_records_guard ON destruction_records; DROP FUNCTION IF EXISTS destruction_record_guard();');
        Schema::dropIfExists('destruction_records');
        Schema::table('assessments', function (Blueprint $table) {
            $table->dropColumn('retention_flagged_at');
        });
    }
};
