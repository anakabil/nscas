<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Fase R9: daftar kesenjangan, rencana aksi, dan pemantauan (docs/01 M10), dibawa dari skema v1 (GapItem,
 * ActionItem, ActionUpdate) dengan tambahan v2: tinjauan triwulan dan tinjauan penutup pemantauan.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assessments', function (Blueprint $table) {
            $table->timestampTz('action_plan_published_at')->nullable();
        });

        Schema::create('gap_items', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('assessment_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('characteristic_id')->constrained()->restrictOnDelete();
            $table->string('characteristic_code', 16);
            $table->foreignUlid('score_run_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('current_index', 6, 4);
            $table->decimal('target_level', 3, 1);
            $table->decimal('gap', 6, 4);
            // Bobot aspek dikali kesenjangan; dasar urutan.
            $table->decimal('priority_score', 8, 6);
            $table->unsignedSmallInteger('rank');
            $table->boolean('is_contextual')->default(false);
            $table->text('root_cause')->nullable();
            // Prioritas yang ditetapkan tim: HIGH, MEDIUM, LOW.
            $table->string('priority', 8)->nullable();
            $table->timestamps();
            $table->unique(['assessment_id', 'characteristic_id']);
        });

        Schema::create('action_items', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('gap_item_id')->constrained()->cascadeOnDelete();
            $table->string('title', 300);
            $table->text('description')->nullable();
            $table->string('owner_name', 200);
            $table->string('owner_position', 200);
            // Penerima pengingat tenggat, terenkripsi di aplikasi.
            $table->text('owner_email')->nullable();
            $table->foreignUlid('unit_id')->nullable()->constrained()->nullOnDelete();
            $table->date('due_date');
            $table->text('success_indicator');
            // PLANNED, IN_PROGRESS, DONE, CANCELLED, VERIFIED.
            $table->string('status', 16)->default('PLANNED');
            $table->unsignedSmallInteger('progress_percent')->default(0);
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('verified_at')->nullable();
            $table->timestampTz('last_reminder_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['gap_item_id']);
            $table->index(['due_date', 'status']);
        });
        DB::statement("ALTER TABLE action_items ADD CONSTRAINT action_items_values_check CHECK (status IN ('PLANNED','IN_PROGRESS','DONE','CANCELLED','VERIFIED') AND progress_percent BETWEEN 0 AND 100)");

        // Riwayat pembaruan kemajuan dan verifikasi asesor (kind PROGRESS atau VERIFICATION).
        Schema::create('action_updates', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('action_item_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 16)->default('PROGRESS');
            $table->text('note');
            $table->unsignedSmallInteger('progress_percent');
            $table->string('status', 16);
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestampTz('created_at')->useCurrent();
            $table->index('action_item_id');
        });

        // Tinjauan pemantauan per triwulan; tinjauan penutup menandai akhir pemantauan.
        Schema::create('monitoring_reviews', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('assessment_id')->constrained()->cascadeOnDelete();
            $table->string('quarter', 8);
            $table->text('summary');
            $table->boolean('closing')->default(false);
            $table->foreignId('reviewed_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();
            $table->unique(['assessment_id', 'quarter']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('monitoring_reviews');
        Schema::dropIfExists('action_updates');
        Schema::dropIfExists('action_items');
        Schema::dropIfExists('gap_items');
        Schema::table('assessments', function (Blueprint $table) {
            $table->dropColumn('action_plan_published_at');
        });
    }
};
