<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Daftar nama jabatan organisasi per strata, dan templat strata organisasi yang dipakai asesmen baru organisasi itu.
 * Nama jabatan hanya membantu responden memilih kelompok dan memetakan impor daftar responden; jawaban survei tetap
 * hanya menyimpan strata (CLAUDE.md aturan 2).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('strata', function (Blueprint $table) {
            $table->jsonb('job_titles')->default('[]');
        });
        Schema::table('organizations', function (Blueprint $table) {
            // Daftar {code, name, group, isContractor, jobTitles}; null berarti memakai strata bawaan instrumen.
            $table->jsonb('strata_template')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->dropColumn('strata_template');
        });
        Schema::table('strata', function (Blueprint $table) {
            $table->dropColumn('job_titles');
        });
    }
};
