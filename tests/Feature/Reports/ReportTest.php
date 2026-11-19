<?php

namespace Tests\Feature\Reports;

use App\Domain\Access\Role;
use App\Domain\Workflow\AssessmentStatus;
use App\Models\Assessment;
use App\Models\AuditLog;
use App\Models\Characteristic;
use App\Models\ClimateItem;
use App\Models\EvidenceRating;
use App\Models\Report;
use App\Models\Stratum;
use App\Models\Unit;
use App\Models\User;
use App\Models\ValidationSession;
use App\Services\Reports\PdfRenderer;
use App\Services\Scoring\ScoringService;
use App\Services\SetupFactsCollector;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\BuildsAssessments;
use Tests\TestCase;

/** Pengganti Chromium untuk tes: menghitung pemanggilan dan mengembalikan PDF kecil. */
class FakePdfRenderer implements PdfRenderer
{
    public int $calls = 0;

    public function __construct(public bool $enabled = true) {}

    public function available(): bool
    {
        return $this->enabled;
    }

    public function render(string $html): string
    {
        $this->calls++;

        return "%PDF-1.7\n% NSCAS uji\n".substr(md5($html), 0, 8)."\n%%EOF\n";
    }
}

/**
 * Fase R10 (docs/01 M11 dan bagian 6, docs/12 temuan T5): laporan dari hasil final, versi bernomor yang tidak dapat
 * diubah, tanda tangan asesor utama, PDF yang disimpan untuk versi final, tanpa nama narasumber, dan komunikasi hasil.
 */
class ReportTest extends TestCase
{
    use BuildsAssessments, RefreshDatabase;

    private User $lead;

    private User $assessor;

    private User $admin;

    private Assessment $assessment;

    private FakePdfRenderer $pdf;

    protected function setUp(): void
    {
        parent::setUp();
        config(['filesystems.default' => 'local']);
        Storage::fake('local');
        $this->pdf = new FakePdfRenderer;
        $this->app->instance(PdfRenderer::class, $this->pdf);
        $this->setUpAssessmentWorld();
        $this->lead = $this->member($this->operator, Role::LeadAssessor);
        $this->assessor = $this->member($this->operator, Role::Assessor);
        $this->admin = $this->member($this->client, Role::ClientAdmin);
        $this->assessment = $this->lockedAssessment($this->lead, $this->assessor);
        $strata = Stratum::where('assessment_id', $this->assessment->id)->orderBy('code')->get();
        $unit = Unit::where('assessment_id', $this->assessment->id)->orderBy('name')->firstOrFail();
        $chars = Characteristic::where('instrument_version_id', $this->assessment->instrument_version_id)->pluck('id');
        foreach (range(1, 6) as $i) {
            $id = (string) Str::uuid();
            DB::table('survey_responses')->insert([
                'id' => $id, 'assessment_id' => $this->assessment->id, 'unit_id' => $unit->id, 'stratum_id' => $strata[$i % 2]->id,
                'instrument_version_id' => $this->assessment->instrument_version_id, 'language' => 'id',
                'submitted_on' => now()->toDateString(), 'duration_bucket' => 'FROM_10_TO_15', 'quality_flags' => '[]',
            ]);
            foreach ($chars as $cid) {
                DB::table('characteristic_answers')->insert(['id' => (string) Str::uuid(), 'survey_response_id' => $id, 'characteristic_id' => $cid, 'level' => 3]);
            }
            foreach (ClimateItem::query()->pluck('id') as $item) {
                DB::table('climate_answers')->insert(['id' => (string) Str::uuid(), 'survey_response_id' => $id, 'climate_item_id' => $item, 'value' => 3]);
            }
        }
        $session = ValidationSession::create(['assessment_id' => $this->assessment->id, 'type' => 'INTERVIEW', 'label' => 'Wawancara uji', 'layer' => 'FIELD', 'status' => 'COMPLETED', 'focus_characteristic_ids' => []]);
        $session->participants()->create(['full_name' => 'Budi Rahasiawan', 'position' => 'Mandor']);
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
        $this->assessment->forceFill(['status' => AssessmentStatus::ActionPlanning])->save();
        $this->assessment->refresh();
    }

    public function test_reports_wait_for_final_results(): void
    {
        $this->assessment->forceFill(['status' => AssessmentStatus::ActionPlanning])->save();
        $this->actingAs($this->lead)->get(route('report.index', $this->assessment))->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('results/report')->where('ready', false));
        $this->actingAs($this->lead)->post(route('report.store', $this->assessment), ['kind' => 'FULL', 'locale' => 'id'])->assertStatus(409);
        $this->actingAs($this->lead)->get(route('report.preview', [$this->assessment, 'FULL']))->assertNotFound();
    }

    public function test_versions_are_immutable_signed_by_the_lead_and_never_name_interviewees(): void
    {
        $this->finalize();
        $preview = $this->actingAs($this->admin)->get(route('report.preview', [$this->assessment, 'FULL']))->assertOk();
        $preview->assertSee('bukan sertifikat', false)->assertSee('DRAF')->assertDontSee('Budi Rahasiawan')->assertDontSee('<script', false);

        $this->actingAs($this->assessor)->post(route('report.store', $this->assessment), ['kind' => 'FULL', 'locale' => 'id'])->assertForbidden();
        $this->actingAs($this->admin)->get(route('report.index', $this->assessment))->assertInertia(fn (Assert $page) => $page->where('ready', true)->where('canCreate', false));
        $this->actingAs($this->lead)->post(route('report.store', $this->assessment), ['kind' => 'FULL', 'locale' => 'id'])->assertRedirect();
        $this->actingAs($this->lead)->post(route('report.store', $this->assessment), ['kind' => 'FULL', 'locale' => 'en'])->assertRedirect();
        [$v2, $v1] = Report::orderByDesc('version')->get()->all();
        $this->assertSame([2, 1], [$v2->version, $v1->version]);
        $this->actingAs($this->admin)->get(route('report.show', [$this->assessment, $v2->id]))->assertOk()->assertSee('not a certificate', false);

        $this->actingAs($this->lead)->post(route('report.sign', [$this->assessment, $v1->id]), ['position' => 'Asesor utama'])->assertStatus(409);
        $this->actingAs($this->assessor)->post(route('report.sign', [$this->assessment, $v2->id]), ['position' => 'Asesor'])->assertForbidden();
        $this->assertFalse(SetupFactsCollector::for($this->assessment->fresh())->finalReportSigned);
        $this->actingAs($this->lead)->post(route('report.sign', [$this->assessment, $v2->id]), ['position' => 'Asesor utama'])->assertRedirect()->assertSessionHas('status', 'signed');
        $v2->refresh();
        $this->assertSame('FINAL', $v2->status);
        $this->assertSame($this->lead->name, $v2->signer_name);
        $this->assertTrue(SetupFactsCollector::for($this->assessment->fresh())->finalReportSigned);
        $this->actingAs($this->lead)->get(route('report.show', [$this->assessment, $v2->id]))->assertSee('Signed electronically by', false)->assertDontSee('>DRAFT<', false);
        $this->actingAs($this->lead)->post(route('report.sign', [$this->assessment, $v2->id]), ['position' => 'Asesor utama'])->assertStatus(409);
        $this->assertSame(2, AuditLog::where('action', 'report.version')->count());
        $this->assertSame(1, AuditLog::where('action', 'report.sign')->count());

        try {
            DB::table('reports')->where('id', $v1->id)->update(['content' => json_encode(['diubah' => true])]);
            $this->fail('Isi versi laporan tidak boleh berubah.');
        } catch (QueryException) {
            // Pemicu report_guard menolak perubahan isi.
        }
        $this->expectException(QueryException::class);
        DB::table('reports')->where('id', $v2->id)->delete();
    }

    public function test_the_signed_pdf_is_rendered_once_and_stored(): void
    {
        $this->finalize();
        $this->actingAs($this->lead)->post(route('report.store', $this->assessment), ['kind' => 'STATEMENT', 'locale' => 'id'])->assertRedirect();
        $report = Report::sole();

        // Versi draf dibuat setiap kali diminta dan tidak disimpan.
        $this->actingAs($this->admin)->get(route('report.pdf', [$this->assessment, $report->id]))->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->assertNull($report->fresh()->storage_key);
        $this->actingAs($this->lead)->post(route('report.sign', [$this->assessment, $report->id]), ['position' => 'Asesor utama'])->assertRedirect();
        $this->actingAs($this->admin)->get(route('report.pdf', [$this->assessment, $report->id]))->assertOk();
        $this->actingAs($this->admin)->get(route('report.pdf', [$this->assessment, $report->id]))->assertOk();
        $this->assertSame(2, $this->pdf->calls);
        $stored = $report->fresh();
        $this->assertNotNull($stored->storage_key);
        $this->assertSame(hash('sha256', Storage::disk('local')->get($stored->storage_key)), $stored->pdf_sha256);
        $this->assertSame(1, AuditLog::where('action', 'report.pdf')->count());

        $this->pdf->enabled = false;
        $this->actingAs($this->lead)->post(route('report.store', $this->assessment), ['kind' => 'FULL', 'locale' => 'id'])->assertRedirect();
        $this->actingAs($this->lead)->get(route('report.pdf', [$this->assessment, Report::where('kind', 'FULL')->value('id')]))->assertStatus(409);
    }

    public function test_results_are_communicated_to_workers_with_a_signed_worker_summary(): void
    {
        $this->finalize();
        $this->assessment->forceFill(['status' => AssessmentStatus::Reported])->save();
        $record = ['date' => now('Asia/Jakarta')->toDateString(), 'channels' => ['SAFETY_TALK', 'NOTICE_BOARD'], 'audience' => 'Seluruh pekerja proyek', 'reached' => 320, 'note' => null];

        $this->actingAs($this->member($this->client, Role::ExecutiveViewer))->get(route('communication.index', $this->assessment))->assertForbidden();
        $this->actingAs($this->admin)->post(route('communication.store', $this->assessment), [...$record, 'channels' => ['FAX']])->assertSessionHasErrors('channels.0');
        $this->actingAs($this->admin)->post(route('communication.store', $this->assessment), $record)->assertRedirect();
        $this->assertFalse(SetupFactsCollector::for($this->assessment->fresh())->resultsCommunicated);

        $this->actingAs($this->lead)->post(route('report.store', $this->assessment), ['kind' => 'WORKER_SUMMARY', 'locale' => 'id'])->assertRedirect();
        $summary = Report::sole();
        $this->actingAs($this->admin)->get(route('report.show', [$this->assessment, $summary->id]))->assertOk()->assertSee('Terima kasih atas partisipasi Anda', false);
        $this->actingAs($this->lead)->post(route('report.sign', [$this->assessment, $summary->id]), ['position' => 'Asesor utama'])->assertRedirect();
        $this->assertTrue(SetupFactsCollector::for($this->assessment->fresh())->resultsCommunicated);
        $this->actingAs($this->admin)->get(route('communication.index', $this->assessment))
            ->assertInertia(fn (Assert $page) => $page->component('results/communication')->has('records', 1)->where('summary.status', 'FINAL'));
        $this->assertSame(1, AuditLog::where('action', 'communication.record')->count());
    }
}
