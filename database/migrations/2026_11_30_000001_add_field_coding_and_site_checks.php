<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Bahan validasi lapangan versi 2 (permintaan pemilik proyek, 20 November 2026): kode bukti dan tingkat kesepakatan
 * kelompok per nilai sesi, serta hasil lembar kerja kunjungan proyek per butir. Dipakai untuk triangulasi; tidak masuk
 * rumus nilai.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('validation_ratings', function (Blueprint $table) {
            // CONSISTENT, PARTIAL, NONE.
            $table->string('evidence_code', 16)->nullable();
            // Hanya diskusi kelompok: AGREED, MIXED, DIVIDED.
            $table->string('agreement', 16)->nullable();
        });

        Schema::create('site_visit_checks', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('validation_session_id')->constrained()->cascadeOnDelete();
            $table->string('item_code', 12);
            $table->foreignUlid('characteristic_id')->constrained()->restrictOnDelete();
            // MEETS, PARTIAL, NOT_MET, NOT_OBSERVED.
            $table->string('result', 16);
            $table->text('note')->nullable();
            $table->foreignId('checked_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();
            $table->unique(['validation_session_id', 'item_code']);
            $table->index('characteristic_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('site_visit_checks');
        Schema::table('validation_ratings', function (Blueprint $table) {
            $table->dropColumn(['evidence_code', 'agreement']);
        });
    }
};
