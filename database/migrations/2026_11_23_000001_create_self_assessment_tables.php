<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Fase R4: penilaian mandiri manajemen (docs/01 M4). Tidak anonim: nama dan jabatan pengisi tersimpan bersama
 * jawaban, draf disimpan di server, dan setiap perubahan dicatat di jejak audit. Diakses lewat token jenis
 * SELF_ASSESSMENT pada access_tokens; token dapat diganti tanpa kehilangan draf.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('self_assessments', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('assessment_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('unit_id')->constrained()->restrictOnDelete();
            // Token yang berlaku sekarang; penerbitan ulang mengganti nilainya.
            $table->foreignUlid('access_token_id')->unique()->constrained()->restrictOnDelete();
            $table->string('respondent_name', 200);
            $table->string('respondent_position', 200);
            // DRAFT atau SUBMITTED. Setelah SUBMITTED jawaban terkunci.
            $table->string('status', 16)->default('DRAFT');
            $table->timestampTz('submitted_at')->nullable();
            $table->timestamps();
            $table->index(['assessment_id', 'status']);
        });

        Schema::create('self_assessment_answers', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('self_assessment_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('characteristic_id')->constrained()->restrictOnDelete();
            $table->unsignedSmallInteger('level')->nullable();
            $table->text('justification')->default('');
            // Id bukti dokumen (fase R5).
            $table->jsonb('evidence_ids')->default('[]');
            $table->timestamps();
            $table->unique(['self_assessment_id', 'characteristic_id']);
        });
        DB::statement('ALTER TABLE self_assessment_answers ADD CONSTRAINT self_assessment_answers_level_check CHECK (level IS NULL OR level BETWEEN 1 AND 5)');
    }

    public function down(): void
    {
        Schema::dropIfExists('self_assessment_answers');
        Schema::dropIfExists('self_assessments');
    }
};
