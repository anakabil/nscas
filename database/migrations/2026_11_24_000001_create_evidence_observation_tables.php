<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Fase R5: bukti dokumen (docs/01 M5) dan observasi lapangan (docs/01 M6), dibawa dari skema v1 (EvidenceItem,
 * EvidenceLink, EvidenceRequirement, ObservationWindow, ObservationCapture).
 *
 * Berkas disimpan di penyimpanan objek dengan kunci {organisasi}/{asesmen}/{jenis}/{uuid}.{ekstensi}; basis data
 * hanya menyimpan kunci, SHA-256, jenis dari isi, dan ukuran. Unggahan yang diminta tetapi belum diselesaikan dicatat
 * di pending_uploads agar objeknya dapat dihapus otomatis bila tidak pernah diselesaikan.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Butir daftar periksa bukti per karakteristik, dari evidence_examples versi instrumen.
        Schema::create('evidence_requirements', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('characteristic_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('position');
            $table->text('description');
            $table->unique(['characteristic_id', 'position']);
        });

        Schema::create('evidence_items', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('assessment_id')->constrained()->cascadeOnDelete();
            // Kosong untuk bukti tingkat organisasi.
            $table->foreignUlid('unit_id')->nullable()->constrained()->restrictOnDelete();
            $table->string('title', 300);
            $table->text('description')->nullable();
            $table->string('file_name', 255);
            $table->string('storage_key', 300)->unique();
            $table->char('sha256', 64);
            $table->string('mime_type', 120);
            $table->unsignedInteger('size_bytes');
            $table->unsignedSmallInteger('version')->default(1);
            // Versi sebelumnya; satu versi hanya dapat digantikan satu kali.
            $table->ulid('supersedes_id')->nullable()->unique();
            $table->foreignId('uploaded_by_id')->constrained('users')->restrictOnDelete();
            // Penghapusan logis (docs/04 bagian 6): berkas tetap tersimpan sampai pemusnahan data asesmen.
            $table->timestampTz('deleted_at')->nullable();
            $table->timestamps();
            $table->index(['assessment_id', 'unit_id']);
        });
        // Kunci asing ke tabel yang sama dipasang setelah kunci utamanya ada.
        Schema::table('evidence_items', function (Blueprint $table) {
            $table->foreign('supersedes_id')->references('id')->on('evidence_items')->restrictOnDelete();
        });

        Schema::create('evidence_links', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('evidence_item_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('characteristic_id')->constrained()->restrictOnDelete();
            // Id butir daftar periksa (evidence_requirements) karakteristik ini yang dipenuhi bukti.
            $table->jsonb('requirement_ids')->default('[]');
            $table->unique(['evidence_item_id', 'characteristic_id']);
            $table->index('characteristic_id');
        });

        Schema::create('observation_windows', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('assessment_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('unit_id')->constrained()->restrictOnDelete();
            $table->string('title', 200);
            $table->timestampTz('opens_at');
            $table->timestampTz('closes_at');
            // Larik {code, label} butir yang diobservasi.
            $table->jsonb('checklist');
            // Titik proyek dan radius toleransi untuk jendela ini (awalnya disalin dari unit).
            $table->decimal('latitude', 9, 6);
            $table->decimal('longitude', 9, 6);
            $table->unsignedInteger('radius_meters');
            $table->foreignId('created_by_id')->constrained('users')->restrictOnDelete();
            $table->timestamps();
            $table->index(['assessment_id', 'unit_id']);
        });
        DB::statement('ALTER TABLE observation_windows ADD CONSTRAINT observation_windows_order_check CHECK (closes_at > opens_at)');

        Schema::create('observation_captures', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('observation_window_id')->constrained()->cascadeOnDelete();
            $table->string('checklist_item_code', 8);
            $table->string('storage_key', 300)->unique();
            $table->char('sha256', 64);
            $table->string('mime_type', 120);
            $table->unsignedInteger('size_bytes');
            // Waktu server saat pengambilan diminta, bukan waktu perangkat.
            $table->timestampTz('server_captured_at');
            $table->decimal('latitude', 9, 6)->nullable();
            $table->decimal('longitude', 9, 6)->nullable();
            $table->float('accuracy_meters')->nullable();
            $table->float('distance_meters')->nullable();
            $table->boolean('outside_radius')->default(false);
            $table->text('note')->nullable();
            $table->foreignId('uploaded_by_id')->constrained('users')->restrictOnDelete();
            $table->timestamps();
            $table->index('observation_window_id');
        });

        // Unggahan yang sudah diberi izin tetapi belum diselesaikan. Baris dihapus saat selesai; yang kedaluwarsa
        // dihapus beserta objeknya oleh nscas:prune-uploads.
        Schema::create('pending_uploads', function (Blueprint $table) {
            $table->ulid('id')->primary();
            // EVIDENCE atau OBSERVATION.
            $table->string('kind', 16);
            $table->foreignUlid('assessment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('storage_key', 300)->unique();
            $table->string('file_name', 255);
            $table->unsignedInteger('declared_size');
            $table->jsonb('data')->default('{}');
            $table->timestampTz('expires_at');
            $table->timestamps();
            $table->index('expires_at');
        });

        // Isi daftar periksa untuk versi instrumen yang sudah dimuat sebelum fase ini.
        $now = now();
        foreach (DB::table('characteristics')->orderBy('id')->get(['id', 'evidence_examples']) as $c) {
            foreach (json_decode((string) $c->evidence_examples, true) ?: [] as $i => $description) {
                DB::table('evidence_requirements')->insert([
                    'id' => (string) Str::ulid($now),
                    'characteristic_id' => $c->id,
                    'position' => $i + 1,
                    'description' => (string) $description,
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('pending_uploads');
        Schema::dropIfExists('observation_captures');
        Schema::dropIfExists('observation_windows');
        Schema::dropIfExists('evidence_links');
        Schema::dropIfExists('evidence_items');
        Schema::dropIfExists('evidence_requirements');
    }
};
