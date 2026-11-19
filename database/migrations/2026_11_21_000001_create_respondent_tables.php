<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Fase R2: daftar responden, token akses, kode QR, partisipasi (docs/01 M2, docs/02 bagian 4).
 *
 * Anonimitas (CLAUDE.md aturan 2): token mentah hanya ada di tautan; tabel ini menyimpan hash SHA-256. Jawaban survei
 * (fase R3) tidak akan merujuk tabel ini. Waktu buka, persetujuan, dan selesai pada token dibulatkan ke jam oleh
 * aplikasi. Kontak responden dienkripsi dengan kunci aplikasi; hash surel dipakai hanya untuk mencegah duplikat.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assessments', function (Blueprint $table) {
            $table->timestampTz('survey_opens_at')->nullable();
            $table->timestampTz('survey_closes_at')->nullable();
        });

        Schema::create('roster_entries', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('assessment_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('unit_id')->constrained()->restrictOnDelete();
            $table->foreignUlid('stratum_id')->constrained('strata')->restrictOnDelete();
            $table->string('full_name', 200);
            $table->string('employee_no', 64)->nullable();
            $table->text('email')->nullable();
            $table->string('email_hash', 64)->nullable();
            $table->text('phone')->nullable();
            $table->boolean('is_contractor')->default(false);
            $table->timestamps();
            $table->index(['assessment_id', 'unit_id']);
            $table->index(['assessment_id', 'employee_no']);
            $table->index(['assessment_id', 'email_hash']);
        });

        Schema::create('unit_qr_codes', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('assessment_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('unit_id')->constrained()->restrictOnDelete();
            // Kosong berarti responden memilih strata sendiri dari daftar tertutup di halaman survei.
            $table->foreignUlid('stratum_id')->nullable()->constrained('strata')->restrictOnDelete();
            $table->string('code_hash', 64)->unique();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('max_issuance')->nullable();
            $table->timestamps();
            $table->index(['assessment_id', 'unit_id']);
        });

        Schema::create('access_tokens', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('assessment_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('roster_entry_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUlid('unit_qr_code_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUlid('unit_id')->constrained()->restrictOnDelete();
            $table->foreignUlid('stratum_id')->nullable()->constrained('strata')->restrictOnDelete();
            $table->string('kind', 16)->default('SURVEY');
            $table->string('token_hash', 64)->unique();
            // EMAIL, LINK, atau QR. Pengingat otomatis hanya untuk EMAIL.
            $table->string('channel', 8)->nullable();
            $table->timestampTz('issued_at');
            $table->timestampTz('first_opened_at')->nullable();
            $table->timestampTz('consent_at')->nullable();
            $table->timestampTz('completed_at')->nullable();
            $table->timestampTz('revoked_at')->nullable();
            // MANUAL, REISSUED, ROTATED_REMINDER, atau SEND_FAILED.
            $table->string('revoked_reason', 32)->nullable();
            $table->unsignedSmallInteger('reminder_count')->default(0);
            $table->timestampTz('last_reminder_at')->nullable();
            $table->index(['assessment_id', 'kind', 'completed_at']);
            $table->index(['roster_entry_id']);
            $table->index(['unit_qr_code_id']);
        });

        // Koordinator unit ditugaskan per unit pada satu asesmen; ia hanya melihat unit itu beserta unit di bawahnya.
        Schema::create('unit_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignUlid('assessment_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('unit_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['unit_id', 'user_id']);
            $table->index(['assessment_id', 'user_id']);
        });

        // Hitungan partisipasi harian untuk grafik tren. Berisi jumlah mentah; ambang sel diterapkan saat ditampilkan.
        Schema::create('participation_snapshots', function (Blueprint $table) {
            $table->id();
            $table->foreignUlid('assessment_id')->constrained()->cascadeOnDelete();
            $table->date('taken_on');
            $table->jsonb('data');
            $table->timestamps();
            $table->unique(['assessment_id', 'taken_on']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('participation_snapshots');
        Schema::dropIfExists('unit_assignments');
        Schema::dropIfExists('access_tokens');
        Schema::dropIfExists('unit_qr_codes');
        Schema::dropIfExists('roster_entries');
        Schema::table('assessments', function (Blueprint $table) {
            $table->dropColumn(['survey_opens_at', 'survey_closes_at']);
        });
    }
};
