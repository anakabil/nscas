<?php

namespace Tests\Feature\Security;

use App\Domain\Access\Role;
use App\Domain\Workflow\AssessmentStatus;
use App\Mail\RetentionFlagMail;
use App\Models\AccessToken;
use App\Models\Assessment;
use App\Models\AuditLog;
use App\Models\Characteristic;
use App\Models\ClimateItem;
use App\Models\DestructionRecord;
use App\Models\EvidenceRating;
use App\Models\RosterEntry;
use App\Models\ScoreRun;
use App\Models\Stratum;
use App\Models\Unit;
use App\Models\User;
use App\Models\ValidationSession;
use App\Services\Reports\PdfRenderer;
use App\Services\Scoring\ScoringService;
use App\Support\Audit;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\BuildsAssessments;
use Tests\TestCase;

/** Pengganti Chromium untuk berita acara. */
class MinutesPdfRenderer implements PdfRenderer
{
    public int $calls = 0;

    public function available(): bool
    {
        return true;
    }

    public function render(string $html): string
    {
        $this->calls++;

        return "%PDF-1.7\n% berita acara uji\n%%EOF\n";
    }
}

/**
 * Fase R11 (docs/04 bagian 6 dan 7): jejak audit per asesmen dengan ekspor CSV, serta masa simpan dan pemusnahan data
 * mentah dengan berita acara yang tidak dapat diubah.
 */
class AuditRetentionTest extends TestCase
{
    use BuildsAssessments, RefreshDatabase;

    private User $lead;

    private User $assessor;

    private User $admin;

    private User $superAdmin;

    private Assessment $assessment;

    private MinutesPdfRenderer $pdf;

    protected function setUp(): void
    {
        parent::setUp();
        config(['filesystems.default' => 'local']);
        Storage::fake('local');
        $this->pdf = new MinutesPdfRenderer;
        $this->app->instance(PdfRenderer::class, $this->pdf);
        $this->setUpAssessmentWorld();
        $this->lead = $this->member($this->operator, Role::LeadAssessor);
        $this->assessor = $this->member($this->operator, Role::Assessor);
        $this->admin = $this->member($this->client, Role::ClientAdmin);
        $this->superAdmin = User::factory()->create(['is_super_admin' => true]);
        $this->assessment = $this->lockedAssessment($this->lead, $this->assessor);
    }

    /** Data mentah: respons survei, daftar responden dan token, narasumber, dan satu berkas bukti. */
    private function seedRawData(): string
    {
        $a = $this->assessment;
        $strata = Stratum::where('assessment_id', $a->id)->orderBy('code')->get();
        $unit = Unit::where('assessment_id', $a->id)->orderBy('name')->firstOrFail();
        $chars = Characteristic::where('instrument_version_id', $a->instrument_version_id)->pluck('id');
        foreach (range(1, 6) as $i) {
            $id = (string) Str::uuid();
            DB::table('survey_responses')->insert([
                'id' => $id, 'assessment_id' => $a->id, 'unit_id' => $unit->id, 'stratum_id' => $strata[$i % 2]->id,
                'instrument_version_id' => $a->instrument_version_id, 'language' => 'id',
                'submitted_on' => now()->toDateString(), 'duration_bucket' => 'FROM_10_TO_15', 'quality_flags' => '[]',
            ]);
            foreach ($chars as $cid) {
                DB::table('characteristic_answers')->insert(['id' => (string) Str::uuid(), 'survey_response_id' => $id, 'characteristic_id' => $cid, 'level' => 3]);
            }
            foreach (ClimateItem::query()->pluck('id') as $item) {
                DB::table('climate_answers')->insert(['id' => (string) Str::uuid(), 'survey_response_id' => $id, 'climate_item_id' => $item, 'value' => 3]);
            }
        }
        $entry = RosterEntry::create(['assessment_id' => $a->id, 'unit_id' => $unit->id, 'stratum_id' => $strata[0]->id, 'full_name' => 'Siti Pekerja', 'email' => 'siti@contoh.id']);
        AccessToken::create(['assessment_id' => $a->id, 'roster_entry_id' => $entry->id, 'unit_id' => $unit->id, 'stratum_id' => $strata[0]->id, 'token_hash' => hash('sha256', 'uji'), 'issued_at' => now()]);
        $session = ValidationSession::create(['assessment_id' => $a->id, 'type' => 'INTERVIEW', 'label' => 'Wawancara uji', 'layer' => 'FIELD', 'status' => 'COMPLETED', 'focus_characteristic_ids' => []]);
        $session->participants()->create(['full_name' => 'Budi Rahasiawan', 'position' => 'Mandor']);
        $key = "{$a->organization_id}/{$a->id}/evidence/uji.pdf";
        Storage::disk('local')->put($key, '%PDF bukti');
        DB::table('evidence_items')->insert([
            'id' => (string) Str::ulid(), 'assessment_id' => $a->id, 'unit_id' => null, 'title' => 'Prosedur kerja aman', 'file_name' => 'prosedur.pdf',
            'storage_key' => $key, 'sha256' => str_repeat('a', 64), 'mime_type' => 'application/pdf', 'size_bytes' => 10,
            'uploaded_by_id' => $this->lead->id, 'created_at' => now(), 'updated_at' => now(),
        ]);

        return $key;
    }

    private function finalize(): void
    {
        $this->assessment->forceFill(['status' => AssessmentStatus::Scoring])->save();
        foreach (Characteristic::where('instrument_version_id', $this->assessment->instrument_version_id)->pluck('id') as $cid) {
            foreach ([$this->lead, $this->assessor] as $rater) {
                EvidenceRating::create(['assessment_id' => $this->assessment->id, 'characteristic_id' => $cid, 'assessor_id' => $rater->id, 'level' => 3.0, 'rationale' => 'Bukti cukup dan konsisten di lapangan.']);
            }
        }
        $this->actingAs($this->lead);
        $service = app(ScoringService::class);
        $service->run($this->assessment->fresh(), $this->lead, Role::LeadAssessor);
        $this->assessment->forceFill(['status' => AssessmentStatus::PanelReview])->save();
        $service->finalize($this->assessment->fresh(), $this->lead, Role::LeadAssessor);
        $this->assessment->forceFill(['status' => AssessmentStatus::Monitoring])->save();
        $this->assessment->refresh();
    }

    private function destruction(array $overrides = []): array
    {
        return [
            'ref' => 'B-123/K3/2029', 'confirmedBy' => 'Andi Wijaya, Direktur Operasi', 'confirmedOn' => now('Asia/Jakarta')->toDateString(),
            'witness' => 'Rina Saksi', 'notes' => null, 'confirm' => true, ...$overrides,
        ];
    }

    public function test_the_audit_trail_shows_full_changes_to_assessors_and_a_summary_to_the_client(): void
    {
        $this->actingAs($this->lead)->get(route('audit.index', $this->assessment))->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('audit/index')->where('full', true)->where('canExport', true)
                ->where('entries.0.changes', fn ($c) => $c !== null)->has('categories'));
        $this->actingAs($this->admin)->get(route('audit.index', $this->assessment))->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('full', false)->where('canExport', false)
                ->where('entries.0.changes', null)->where('entries.0.actorEmail', null));
        $this->actingAs($this->member($this->client, Role::ExecutiveViewer))->get(route('audit.index', $this->assessment))->assertForbidden();
        $outsider = $this->member($this->operator, Role::LeadAssessor);
        $this->actingAs($outsider)->get(route('audit.index', $this->assessment))->assertNotFound();
        $this->actingAs($this->admin)->get(route('audit.export', $this->assessment))->assertForbidden();
    }

    public function test_filters_tenant_scope_and_csv_export(): void
    {
        AuditLog::create(['action' => 'assessment.update', 'assessment_id' => $this->assessment->id, 'organization_id' => (string) Str::ulid(), 'changes' => ['bocor' => true]]);
        $this->lead->forceFill(['name' => '=HYPERLINK("http://contoh.id")'])->save();
        $this->actingAs($this->lead);
        Audit::record('assessment.update', $this->assessment, ['after' => ['name' => '+62 Jakarta']], actorRole: Role::LeadAssessor);

        $page = $this->get(route('audit.index', [$this->assessment, 'category' => 'assessment']))->assertOk();
        $page->assertInertia(fn (Assert $p) => $p->where('entries', fn ($entries) => collect($entries)->every(fn ($e) => str_starts_with($e['action'], 'assessment.'))
            && collect($entries)->every(fn ($e) => ! isset($e['changes']['bocor']))));
        $this->get(route('audit.index', [$this->assessment, 'from' => '2026-12-31', 'to' => '2026-01-01']))->assertSessionHasErrors('to');

        $content = (string) $this->get(route('audit.export', [$this->assessment, 'category' => 'assessment']))->assertOk()
            ->assertHeader('Content-Type', 'text/csv; charset=UTF-8')->getContent();
        $this->assertStringStartsWith("\u{FEFF}waktu_utc;waktu_wib;aksi", $content);
        $this->assertStringContainsString("'=HYPERLINK", $content);
        $this->assertStringNotContainsString('bocor', $content);
        $this->assertSame(1, AuditLog::where('action', 'audit.export')->count());
    }

    public function test_raw_data_is_destroyed_only_after_archive_and_retention_with_an_immutable_record(): void
    {
        Mail::fake();
        $key = $this->seedRawData();
        $this->finalize();
        $finalRun = ScoreRun::where('is_final', true)->sole();

        $this->actingAs($this->lead)->get(route('retention.index'))->assertNotFound();
        $this->actingAs($this->lead)->post(route('retention.destroy', $this->assessment), $this->destruction())->assertNotFound();
        $this->actingAs($this->superAdmin)->get(route('retention.index'))->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('retention/index')->where('rows.0.state', 'active')->where('rows.0.canDestroy', false));
        $this->actingAs($this->superAdmin)->post(route('retention.destroy', $this->assessment), $this->destruction())->assertStatus(409);

        // Masa simpan bawaan 36 bulan sejak hasil ditetapkan (belum ada laporan lengkap bertanda tangan).
        $this->travel(37)->months();
        // Sesi lama berakhir setelah 8 jam; mulai sesi baru.
        $this->flushSession();
        $this->artisan('nscas:retention-check')->assertSuccessful();
        $this->assertNotNull($this->assessment->fresh()->retention_flagged_at);
        Mail::assertQueued(RetentionFlagMail::class, fn (RetentionFlagMail $m) => $m->hasTo($this->superAdmin->email) && count($m->items) === 1);
        $this->artisan('nscas:retention-check')->assertSuccessful();
        $this->assertSame(1, AuditLog::where('action', 'retention.flag')->count());
        $this->actingAs($this->superAdmin)->post(route('retention.destroy', $this->assessment), $this->destruction())->assertStatus(409);

        $this->assessment->forceFill(['status' => AssessmentStatus::Archived])->save();
        $this->actingAs($this->superAdmin)->post(route('retention.destroy', $this->assessment), $this->destruction(['confirm' => false]))->assertSessionHasErrors('confirm');
        $this->actingAs($this->superAdmin)->post(route('retention.destroy', $this->assessment), $this->destruction())->assertRedirect()->assertSessionHas('status', 'destroyed');

        $id = $this->assessment->id;
        $this->assertSame(AssessmentStatus::Purged, $this->assessment->fresh()->status);
        foreach (['survey_responses', 'roster_entries', 'access_tokens', 'evidence_items'] as $table) {
            $this->assertSame(0, DB::table($table)->where('assessment_id', $id)->count(), $table);
        }
        $this->assertSame(0, DB::table('characteristic_answers')->count());
        $this->assertSame(0, DB::table('validation_participants')->count());
        Storage::disk('local')->assertMissing($key);
        $this->assertTrue(ScoreRun::whereKey($finalRun->id)->where('is_final', true)->exists());

        $record = DestructionRecord::sole();
        $this->assertSame(6, $record->details['counts']['surveyResponses']);
        $this->assertSame(1, $record->details['counts']['validationParticipants']);
        $this->assertSame(1, $record->object_count);
        $this->assertNotNull($record->objects_purged_at);
        $this->assertNotNull($record->storage_key);
        $this->assertSame(1, $this->pdf->calls);
        $this->assertSame(1, AuditLog::where('action', 'retention.destroy')->count());
        $this->assertSame('PURGED', AuditLog::where('action', 'assessment.status_change')->latest('id')->first()->changes['after']['status']);

        $this->actingAs($this->superAdmin)->get(route('retention.show', $record))->assertOk()
            ->assertSee('Berita Acara Pemusnahan', false)->assertSee('B-123/K3/2029')->assertDontSee('Budi Rahasiawan')->assertDontSee('<script', false);
        $this->actingAs($this->superAdmin)->get(route('retention.pdf', $record))->assertOk();
        $this->assertSame(1, $this->pdf->calls);
        $this->actingAs($this->superAdmin)->post(route('retention.destroy', $this->assessment), $this->destruction())->assertStatus(409);
        // Hasil tetap dapat dibaca setelah pemusnahan.
        $this->actingAs($this->lead)->get(route('results.index', $this->assessment))->assertOk();

        try {
            DB::table('destruction_records')->where('id', $record->id)->update(['client_confirmation_ref' => 'diubah']);
            $this->fail('Isi berita acara tidak boleh berubah.');
        } catch (QueryException) {
            // Pemicu destruction_record_guard menolak perubahan isi.
        }
        $this->expectException(QueryException::class);
        DB::table('destruction_records')->where('id', $record->id)->delete();
    }
}
