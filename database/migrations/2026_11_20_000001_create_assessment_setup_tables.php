<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Fase R1: administrasi dan konfigurasi asesmen (docs/01 M1, docs/12 tahap 1).
 *
 * Parameter yang masih dapat diubah disimpan di assessments.parameter_draft. Saat asesmen dikunci, seluruh draf,
 * strata, unit, dan teks persetujuan disalin ke assessments.parameter_snapshot (CLAUDE.md aturan 5).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Bahasa antarmuka pilihan pengguna (id atau en); null berarti bahasa bawaan.
            $table->string('locale', 2)->nullable();
            // Akun yang dibuat atau diatur ulang oleh administrator wajib mengganti kata sandi sementara.
            $table->boolean('must_change_password')->default(false);
        });

        Schema::table('organizations', function (Blueprint $table) {
            $table->string('legal_name')->nullable();
            $table->string('sector', 120)->nullable();
            $table->boolean('is_active')->default(true);
        });

        // Versi instrumen beserta parameter bawaannya (seed/aspek-dan-parameter.json) dan isi instrumennya
        // (seed/instrumen-karakteristik-v1.json). Hanya versi berstatus PUBLISHED yang dapat dipilih.
        Schema::create('instrument_versions', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('code', 64)->unique();
            $table->string('status', 16)->default('DRAFT');
            $table->timestamp('published_at')->nullable();
            $table->jsonb('default_parameters');
            $table->jsonb('content')->nullable();
            $table->timestamps();
        });

        Schema::table('assessments', function (Blueprint $table) {
            $table->dropColumn('instrument_version');
        });

        Schema::table('assessments', function (Blueprint $table) {
            $table->string('scope_type', 16)->default('CORPORATE');
            $table->foreignUlid('instrument_version_id')->nullable()->constrained()->restrictOnDelete();
            $table->jsonb('parameter_draft')->nullable();
            $table->text('consent_text_id')->nullable();
            $table->text('consent_text_en')->nullable();
            // Perjanjian pemrosesan data dengan klien (docs/04 bagian 1.1): NOT_STARTED, IN_PROGRESS, SIGNED.
            $table->string('dpa_status', 16)->default('NOT_STARTED');
            $table->string('dpa_reference', 120)->nullable();
            $table->date('dpa_signed_on')->nullable();
            // Komunikasi awal dan kalibrasi asesor (docs/12 temuan T2).
            $table->jsonb('kickoff')->nullable();
            $table->jsonb('calibration')->nullable();
            $table->foreignId('locked_by')->nullable()->constrained('users')->nullOnDelete();
        });

        Schema::create('units', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('assessment_id')->constrained()->cascadeOnDelete();
            $table->ulid('parent_id')->nullable();
            $table->string('name');
            $table->string('type', 16);
            // Koordinat dan radius hanya untuk unit berjenis proyek (observasi digital, docs/01 M6).
            $table->decimal('latitude', 9, 6)->nullable();
            $table->decimal('longitude', 9, 6)->nullable();
            $table->unsignedInteger('radius_meters')->nullable();
            $table->timestamps();
            $table->index(['assessment_id', 'parent_id']);
        });

        // Kunci asing ke tabel sendiri ditambahkan setelah kunci primer terbentuk. Unit induk tidak dapat dihapus
        // selama masih memiliki unit di bawahnya.
        Schema::table('units', function (Blueprint $table) {
            $table->foreign('parent_id')->references('id')->on('units')->restrictOnDelete();
        });

        Schema::create('strata', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('assessment_id')->constrained()->cascadeOnDelete();
            $table->string('code', 20);
            $table->string('name');
            $table->string('group', 16);
            $table->unsignedInteger('population')->default(0);
            $table->boolean('is_contractor')->default(false);
            $table->timestamps();
            $table->unique(['assessment_id', 'code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('strata');
        Schema::dropIfExists('units');
        Schema::table('assessments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('instrument_version_id');
            $table->dropConstrainedForeignId('locked_by');
            $table->dropColumn([
                'scope_type', 'parameter_draft', 'consent_text_id', 'consent_text_en', 'dpa_status', 'dpa_reference',
                'dpa_signed_on', 'kickoff', 'calibration',
            ]);
            $table->string('instrument_version', 64)->nullable();
        });
        Schema::dropIfExists('instrument_versions');
        Schema::table('organizations', function (Blueprint $table) {
            $table->dropColumn(['legal_name', 'sector', 'is_active']);
        });
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['locale', 'must_change_password']);
        });
    }
};
