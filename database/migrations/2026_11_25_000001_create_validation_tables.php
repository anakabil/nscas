<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Fase R6: tahap 3 Validasi dan triangulasi (docs/12 temuan T1, T3, T4; docs/01 M7), dibawa dari skema v1
 * (ValidationGuideTemplate, ValidationSession, ValidationParticipant, ValidationRating) dengan tambahan v2:
 * tinjauan partisipasi dan mutu data sebagai gerbang, alasan tertulis untuk strata di bawah ambang, tinjauan bukti per
 * karakteristik, kunjungan fisik (D6), karakteristik fokus per sesi, dan catatan umpan balik harian (docs/13 V17).
 *
 * Kerahasiaan narasumber (docs/13 V16): nama narasumber disimpan terpisah dari catatan dan nilai, sehingga pernyataan
 * dalam catatan tidak ditautkan ke orang tertentu.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Tinjauan asesor utama: PARTICIPATION dan DATA_QUALITY, satu baris per jenis.
        Schema::create('assessment_reviews', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('assessment_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 24);
            $table->text('note')->nullable();
            $table->foreignId('reviewed_by')->constrained('users')->restrictOnDelete();
            $table->timestampTz('reviewed_at');
            $table->unique(['assessment_id', 'kind']);
        });

        // Alasan tertulis untuk strata yang partisipasinya di bawah batas minimum (docs/12 temuan T3).
        Schema::create('stratum_justifications', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('assessment_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('stratum_id')->unique()->constrained('strata')->cascadeOnDelete();
            $table->text('justification');
            $table->foreignId('written_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();
        });

        // Pernyataan asesor bahwa bukti satu karakteristik telah ditinjau (syarat evidence_reviewed, keputusan R5).
        Schema::create('evidence_reviews', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('assessment_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('characteristic_id')->constrained()->restrictOnDelete();
            $table->text('note')->nullable();
            $table->foreignId('reviewed_by')->constrained('users')->restrictOnDelete();
            $table->timestampTz('reviewed_at');
            $table->unique(['assessment_id', 'characteristic_id']);
        });

        // Panduan pertanyaan per lapisan jabatan, salinan per asesmen dari seed/panduan-validasi-v1.json.
        Schema::create('validation_guides', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('assessment_id')->constrained()->cascadeOnDelete();
            $table->string('layer', 16);
            $table->text('intro');
            $table->jsonb('questions');
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['assessment_id', 'layer']);
        });

        Schema::create('validation_sessions', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('assessment_id')->constrained()->cascadeOnDelete();
            // INTERVIEW, FOCUS_GROUP, SITE_VISIT (fisik), VIRTUAL_SITE_VISIT.
            $table->string('type', 24);
            $table->string('label', 200);
            // Lapisan panduan: MANAGEMENT, SUPERVISORY, FIELD.
            $table->string('layer', 16);
            $table->foreignUlid('unit_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUlid('stratum_id')->nullable()->constrained('strata')->nullOnDelete();
            $table->timestampTz('scheduled_at')->nullable();
            // Tautan rapat eksternal (HTTPS) atau lokasi kunjungan.
            $table->string('meeting_url', 500)->nullable();
            $table->string('location', 300)->nullable();
            $table->unsignedSmallInteger('participant_count')->nullable();
            // SCHEDULED, COMPLETED, CANCELLED.
            $table->string('status', 16)->default('SCHEDULED');
            $table->jsonb('focus_characteristic_ids')->default('[]');
            $table->boolean('recording_consent')->default(false);
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->index(['assessment_id', 'status']);
        });

        Schema::create('validation_participants', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('validation_session_id')->constrained()->cascadeOnDelete();
            $table->string('full_name', 200);
            $table->string('position', 200);
            $table->timestamps();
        });

        Schema::create('validation_ratings', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('validation_session_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('characteristic_id')->constrained()->restrictOnDelete();
            $table->foreignId('assessor_id')->constrained('users')->restrictOnDelete();
            $table->decimal('level', 2, 1);
            $table->text('note')->nullable();
            $table->timestamps();
            $table->unique(['validation_session_id', 'characteristic_id', 'assessor_id']);
        });
        DB::statement('ALTER TABLE validation_ratings ADD CONSTRAINT validation_ratings_level_check CHECK (level BETWEEN 1 AND 5 AND level * 2 = floor(level * 2))');

        // Ringkasan umpan balik harian kepada organisasi selama validasi (docs/13 V17).
        Schema::create('feedback_notes', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('assessment_id')->constrained()->cascadeOnDelete();
            $table->date('note_date');
            $table->text('summary');
            $table->foreignId('author_id')->constrained('users')->restrictOnDelete();
            $table->timestamps();
            $table->unique(['assessment_id', 'note_date']);
        });

        // Alamat surel pengisi penilaian mandiri untuk pengiriman tautan (keputusan R4), terenkripsi di aplikasi.
        Schema::table('self_assessments', function (Blueprint $table) {
            $table->text('respondent_email')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('self_assessments', function (Blueprint $table) {
            $table->dropColumn('respondent_email');
        });
        Schema::dropIfExists('feedback_notes');
        Schema::dropIfExists('validation_ratings');
        Schema::dropIfExists('validation_participants');
        Schema::dropIfExists('validation_sessions');
        Schema::dropIfExists('validation_guides');
        Schema::dropIfExists('evidence_reviews');
        Schema::dropIfExists('stratum_justifications');
        Schema::dropIfExists('assessment_reviews');
    }
};
