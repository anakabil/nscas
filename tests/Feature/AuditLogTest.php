<?php

namespace Tests\Feature;

use App\Models\Assessment;
use App\Models\AuditLog;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** Jejak audit hanya boleh ditambah (CLAUDE.md aturan 6); ditegakkan oleh pemicu basis data. */
class AuditLogTest extends TestCase
{
    use RefreshDatabase;

    public function test_records_actor_assessment_and_hashed_ip(): void
    {
        $user = User::factory()->create();
        $assessment = Assessment::factory()->create();

        $this->actingAs($user);
        $log = Audit::record('assessment.created', $assessment, ['name' => $assessment->name]);

        $this->assertSame($user->id, $log->actor_id);
        $this->assertSame($assessment->id, $log->assessment_id);
        $this->assertSame($assessment->organization_id, $log->organization_id);
        $this->assertSame('Assessment', $log->entity_type);
        $this->assertNotSame('127.0.0.1', $log->ip_hash);
        $this->assertMatchesRegularExpression('/^[0-9a-f]{64}$/', (string) $log->ip_hash);
    }

    public function test_rows_cannot_be_updated(): void
    {
        $log = Audit::record('test.action');
        $this->expectException(QueryException::class);
        DB::table('audit_logs')->where('id', $log->id)->update(['action' => 'tampered']);
    }

    public function test_rows_cannot_be_deleted(): void
    {
        $log = Audit::record('test.action');
        $this->expectException(QueryException::class);
        DB::table('audit_logs')->where('id', $log->id)->delete();
    }

    public function test_table_cannot_be_truncated(): void
    {
        Audit::record('test.action');
        $this->expectException(QueryException::class);
        DB::statement('TRUNCATE audit_logs');
    }

    public function test_deleting_an_account_keeps_its_audit_rows(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user);
        $log = Audit::record('test.action');

        $user->delete();

        $kept = AuditLog::findOrFail($log->id);
        $this->assertNull($kept->actor_id);
        $this->assertSame('test.action', $kept->action);
    }
}
