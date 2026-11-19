<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Pengelola sistem Nusa Safety. Tidak menilai dan tidak melihat identitas responden (docs/01 bagian 2).
            $table->boolean('is_super_admin')->default(false);
            $table->boolean('is_active')->default(true);
        });

        Schema::create('organizations', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('name');
            // true untuk Nusa Safety (pelaksana asesmen); false untuk organisasi klien.
            $table->boolean('is_operator')->default(false);
            $table->timestamps();
        });

        Schema::create('memberships', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignUlid('organization_id')->constrained()->cascadeOnDelete();
            $table->string('role', 32);
            $table->timestamps();
            $table->unique(['user_id', 'organization_id', 'role']);
        });

        Schema::create('assessments', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignUlid('organization_id')->constrained()->restrictOnDelete();
            $table->string('name');
            $table->date('period_start');
            $table->date('period_end');
            $table->unsignedSmallInteger('target_level')->default(3);
            $table->string('status', 32)->default('DRAFT')->index();
            $table->string('instrument_version', 64)->nullable();
            // Bobot, ambang, versi instrumen, dan strata saat dikunci. Setelah LOCKED hanya dibaca (aturan 5).
            $table->jsonb('parameter_snapshot')->nullable();
            $table->timestamp('locked_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['organization_id', 'status']);
        });

        Schema::create('assessment_team_members', function (Blueprint $table) {
            $table->id();
            $table->foreignUlid('assessment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('role', 32);
            $table->timestamps();
            $table->unique(['assessment_id', 'user_id']);
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->timestamp('occurred_at')->useCurrent()->index();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('actor_role', 32)->nullable();
            $table->ulid('organization_id')->nullable()->index();
            $table->ulid('assessment_id')->nullable()->index();
            $table->string('action', 64)->index();
            $table->string('entity_type', 64)->nullable();
            $table->string('entity_id', 64)->nullable();
            $table->jsonb('changes')->nullable();
            // HMAC alamat IP, bukan alamat aslinya.
            $table->string('ip_hash', 64)->nullable();
        });

        // Jejak audit hanya boleh ditambah (aturan 6). Ditegakkan di basis data agar tidak bergantung pada kode
        // aplikasi: UPDATE, DELETE, dan TRUNCATE ditolak. Pengecualian satu-satunya adalah pemutusan tautan pelaku
        // (actor_id menjadi NULL) saat akun dihapus, karena itu dijalankan oleh kunci asing.
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION audit_logs_append_only() RETURNS trigger AS $$
            BEGIN
                -- IF bersarang: NEW dan OLD tidak tersedia pada TRUNCATE dan DELETE.
                IF TG_OP = 'UPDATE' THEN
                    IF NEW.actor_id IS NULL
                       AND ROW(NEW.id, NEW.occurred_at, NEW.actor_role, NEW.organization_id, NEW.assessment_id, NEW.action,
                               NEW.entity_type, NEW.entity_id, NEW.changes, NEW.ip_hash)
                           IS NOT DISTINCT FROM
                           ROW(OLD.id, OLD.occurred_at, OLD.actor_role, OLD.organization_id, OLD.assessment_id, OLD.action,
                               OLD.entity_type, OLD.entity_id, OLD.changes, OLD.ip_hash) THEN
                        RETURN NEW;
                    END IF;
                END IF;
                RAISE EXCEPTION 'audit_logs is append-only (% rejected)', TG_OP USING ERRCODE = 'restrict_violation';
            END;
            $$ LANGUAGE plpgsql;

            CREATE TRIGGER audit_logs_no_update_delete BEFORE UPDATE OR DELETE ON audit_logs
                FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();
            CREATE TRIGGER audit_logs_no_truncate BEFORE TRUNCATE ON audit_logs
                FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_append_only();
        SQL);
    }

    public function down(): void
    {
        DB::unprepared('DROP TRIGGER IF EXISTS audit_logs_no_truncate ON audit_logs; DROP TRIGGER IF EXISTS audit_logs_no_update_delete ON audit_logs;');
        Schema::dropIfExists('audit_logs');
        DB::unprepared('DROP FUNCTION IF EXISTS audit_logs_append_only();');
        Schema::dropIfExists('assessment_team_members');
        Schema::dropIfExists('assessments');
        Schema::dropIfExists('memberships');
        Schema::dropIfExists('organizations');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['is_super_admin', 'is_active']);
        });
    }
};
