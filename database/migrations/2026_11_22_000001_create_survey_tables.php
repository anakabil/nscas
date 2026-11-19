<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Fase R3: isi instrumen ternormalisasi dan jawaban survei anonim (docs/01 M3, docs/02 bagian 4).
 *
 * Instrumen: karakteristik dengan lima pernyataan berjenjang, serta dimensi dan butir skala iklim, per versi
 * instrumen. Diisi InstrumentVersionSeeder dari seed/ dan tidak diubah setelah versi dipakai.
 *
 * Jawaban (CLAUDE.md aturan 2): tidak ada kolom yang merujuk token, daftar responden, alamat, atau perangkat. Kunci
 * utama UUID versi 4 acak, bukan berurutan waktu. Tidak ada cap waktu: hanya tanggal kirim tanpa jam dan rentang
 * durasi lima menit, agar jawaban tidak dapat dicocokkan dengan waktu selesai token.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('characteristics', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('instrument_version_id')->constrained()->restrictOnDelete();
            $table->string('aspect_code', 8);
            $table->string('code', 16);
            $table->text('name_id');
            $table->text('name_en')->nullable();
            $table->boolean('is_contextual')->default(false);
            $table->unsignedSmallInteger('position');
            $table->jsonb('target_respondents')->default('[]');
            $table->jsonb('evidence_examples')->default('[]');
            $table->unique(['instrument_version_id', 'code']);
        });

        Schema::create('level_statements', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('characteristic_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('level');
            $table->text('text_id');
            $table->text('text_en')->nullable();
            $table->unique(['characteristic_id', 'level']);
        });
        DB::statement('ALTER TABLE level_statements ADD CONSTRAINT level_statements_level_check CHECK (level BETWEEN 1 AND 5)');

        Schema::create('climate_dimensions', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('instrument_version_id')->constrained()->restrictOnDelete();
            $table->string('code', 16);
            $table->text('name_id');
            $table->text('name_en')->nullable();
            $table->unsignedSmallInteger('position');
            $table->unique(['instrument_version_id', 'code']);
        });

        Schema::create('climate_items', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('climate_dimension_id')->constrained()->cascadeOnDelete();
            $table->string('code', 16);
            $table->text('text_id');
            $table->text('text_en')->nullable();
            $table->boolean('reverse_coded')->default(false);
            $table->unsignedSmallInteger('position');
            $table->unique(['climate_dimension_id', 'code']);
        });

        Schema::create('survey_responses', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUlid('assessment_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('unit_id')->constrained()->restrictOnDelete();
            $table->foreignUlid('stratum_id')->constrained('strata')->restrictOnDelete();
            $table->foreignUlid('instrument_version_id')->constrained()->restrictOnDelete();
            $table->string('language', 2);
            // Tanggal kirim (WIB) tanpa jam.
            $table->date('submitted_on');
            // UNDER_5, FROM_5_TO_10, FROM_10_TO_15, FROM_15_TO_20, OVER_20.
            $table->string('duration_bucket', 16);
            $table->jsonb('quality_flags')->default('[]');
            // Pengeluaran dari analisis setelah ditinjau asesor (fase R6).
            $table->boolean('excluded')->default(false);
            $table->text('excluded_reason')->nullable();
            $table->foreignId('excluded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->index(['assessment_id', 'unit_id', 'stratum_id']);
        });

        Schema::create('characteristic_answers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('survey_response_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('characteristic_id')->constrained()->restrictOnDelete();
            // 1 sampai 5; kosong berarti "Tidak tahu".
            $table->unsignedSmallInteger('level')->nullable();
            $table->unique(['survey_response_id', 'characteristic_id']);
            $table->index('characteristic_id');
        });
        DB::statement('ALTER TABLE characteristic_answers ADD CONSTRAINT characteristic_answers_level_check CHECK (level IS NULL OR level BETWEEN 1 AND 5)');

        Schema::create('climate_answers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('survey_response_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('climate_item_id')->constrained()->restrictOnDelete();
            $table->unsignedSmallInteger('value');
            $table->unique(['survey_response_id', 'climate_item_id']);
            $table->index('climate_item_id');
        });
        DB::statement('ALTER TABLE climate_answers ADD CONSTRAINT climate_answers_value_check CHECK (value BETWEEN 1 AND 5)');
    }

    public function down(): void
    {
        Schema::dropIfExists('climate_answers');
        Schema::dropIfExists('characteristic_answers');
        Schema::dropIfExists('survey_responses');
        Schema::dropIfExists('climate_items');
        Schema::dropIfExists('climate_dimensions');
        Schema::dropIfExists('level_statements');
        Schema::dropIfExists('characteristics');
    }
};
