<?php

namespace Tests\Feature\Results;

use App\Domain\Access\Resource;
use App\Domain\Access\Role;
use App\Domain\Workflow\AssessmentStatus;
use App\Models\Assessment;
use App\Models\AuditLog;
use App\Models\Characteristic;
use App\Models\ClimateItem;
use App\Models\EvidenceRating;
use App\Models\Organization;
use App\Models\Stratum;
use App\Models\Unit;
use App\Models\UnitAssignment;
use App\Models\User;
use App\Services\Respondents\RespondentScope;
use App\Services\Scoring\ScoringService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use OpenSpout\Reader\XLSX\Reader;
use Tests\Concerns\BuildsAssessments;
use Tests\TestCase;

/**
 * Fase R8 (docs/01 M9): dasbor hasil dari hasil final (hasil sementara hanya untuk asesor), penyembunyian sel di
 * bawah lima responden, cakupan unit koordinator, ekspor Excel, analisis kepekaan, dan perbandingan antarperiode.
 */
class ResultsTest extends TestCase
{
    use BuildsAssessments, RefreshDatabase;

    private User $lead;

    private User $assessor;

    private User $admin;

    private User $viewer;

    private Assessment $assessment;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpAssessmentWorld();
        $this->lead = $this->member($this->operator, Role::LeadAssessor);
        $this->assessor = $this->member($this->operator, Role::Assessor);
        $this->admin = $this->member($this->client, Role::ClientAdmin);
        $this->viewer = $this->member($this->client, Role::ExecutiveViewer);
        $this->assessment = $this->withResponses($this->lockedAssessment($this->lead, $this->assessor));
    }

    private function withResponses(Assessment $assessment): Assessment
    {
        $strata = Stratum::where('assessment_id', $assessment->id)->orderBy('code')->get();
        $unit = Unit::where('assessment_id', $assessment->id)->orderBy('name')->firstOrFail();
        foreach (range(1, 6) as $i) {
            $id = (string) Str::uuid();
            DB::table('survey_responses')->insert([
                'id' => $id, 'assessment_id' => $assessment->id, 'unit_id' => $unit->id, 'stratum_id' => $strata[$i % 2]->id,
                'instrument_version_id' => $assessment->instrument_version_id, 'language' => 'id',
                'submitted_on' => now()->toDateString(), 'duration_bucket' => 'FROM_10_TO_15', 'quality_flags' => '[]',
            ]);
            foreach (Characteristic::where('instrument_version_id', $assessment->instrument_version_id)->pluck('id') as $cid) {
                DB::table('characteristic_answers')->insert(['id' => (string) Str::uuid(), 'survey_response_id' => $id, 'characteristic_id' => $cid, 'level' => 3]);
            }
            foreach (ClimateItem::query()->pluck('id') as $item) {
                DB::table('climate_answers')->insert(['id' => (string) Str::uuid(), 'survey_response_id' => $id, 'climate_item_id' => $item, 'value' => 3]);
            }
        }

        return $assessment;
    }

    /** Nilai dua asesor, perhitungan, lalu penetapan rapat panel lewat layanan sungguhan. */
    private function finalize(Assessment $assessment, float $evidence, bool $final = true): void
    {
        $assessment->forceFill(['status' => AssessmentStatus::Scoring])->save();
        foreach (Characteristic::where('instrument_version_id', $assessment->instrument_version_id)->pluck('id') as $cid) {
            foreach ([$this->lead, $this->assessor] as $rater) {
                EvidenceRating::create(['assessment_id' => $assessment->id, 'characteristic_id' => $cid, 'assessor_id' => $rater->id, 'level' => $evidence, 'rationale' => 'Bukti cukup dan konsisten di lapangan.']);
            }
        }
        $this->actingAs($this->lead);
        $service = app(ScoringService::class);
        $service->run($assessment->fresh(), $this->lead, Role::LeadAssessor);
        if ($final) {
            $assessment->forceFill(['status' => AssessmentStatus::PanelReview])->save();
            $service->finalize($assessment->fresh(), $this->lead, Role::LeadAssessor);
            $assessment->forceFill(['status' => AssessmentStatus::ActionPlanning])->save();
        }
    }

    public function test_only_assessors_see_provisional_results_before_the_panel(): void
    {
        $this->actingAs($this->admin)->get(route('results.index', $this->assessment))->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('results/dashboard')->where('results', null));
        $this->finalize($this->assessment, 3.0, final: false);

        $this->actingAs($this->assessor)->get(route('results.index', $this->assessment))
            ->assertInertia(fn (Assert $page) => $page->where('results.provisional', true));
        $this->actingAs($this->viewer)->get(route('results.index', $this->assessment))
            ->assertInertia(fn (Assert $page) => $page->where('results', null));
        $this->actingAs($this->admin)->get(route('results.export', $this->assessment))->assertNotFound();
    }

    public function test_final_results_hide_small_cells_and_include_sensitivity(): void
    {
        $this->finalize($this->assessment, 3.0);

        $this->actingAs($this->viewer)->get(route('results.index', $this->assessment))->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('results.provisional', false)
                ->where('results.organization.indicativeLevel', 3)
                ->where('results.heatmaps.strata.rows.0.cells.0.suppressed', true)
                ->where('results.heatmaps.strata.rows.0.cells.0.value', null)
                ->where('results.heatmaps.units.rows.0.cells.0.value', 3)
                ->where('results.heatmaps.units.rows.0.cells.0.n', 6)
                ->has('results.sensitivity.scenarios', 6)
                ->where('results.sensitivity.stable', true));
        $this->actingAs(User::factory()->create(['is_super_admin' => true]))->get(route('results.index', $this->assessment))->assertForbidden();
        $outsider = $this->member(Organization::factory()->create(), Role::ClientAdmin);
        $this->actingAs($outsider)->get(route('results.index', $this->assessment))->assertNotFound();
    }

    public function test_unit_coordinators_see_only_their_units_on_the_unit_map(): void
    {
        $this->finalize($this->assessment, 3.0);
        $coordinator = $this->member($this->client, Role::UnitCoordinator);
        $unit = Unit::where('assessment_id', $this->assessment->id)->orderByDesc('name')->firstOrFail();
        UnitAssignment::create(['assessment_id' => $this->assessment->id, 'unit_id' => $unit->id, 'user_id' => $coordinator->id]);

        // Koordinator tidak menerima agregat seluruh organisasi per strata maupun per kelompok jabatan (docs/04).
        $this->actingAs($coordinator)->get(route('results.index', $this->assessment))
            ->assertInertia(fn (Assert $page) => $page->has('results.heatmaps.units.columns', 1)->where('results.heatmaps.units.columns.0.id', $unit->id)
                ->where('results.heatmaps.strata', null)
                ->where('results.perceptionGap', [])
                ->where('results.quality.strata', []));

        // Peran tambahan tanpa hak atas daftar responden tidak melonggarkan batas unit koordinator.
        $this->assertNull(RespondentScope::units($coordinator, $this->assessment, [Role::ClientAdmin, Role::UnitCoordinator], Resource::Roster));
        $this->assertSame([$unit->id], RespondentScope::units($coordinator, $this->assessment, [Role::ExecutiveViewer, Role::UnitCoordinator], Resource::Roster));
        $this->assertSame([$unit->id], RespondentScope::units($coordinator, $this->assessment, [Role::ExecutiveViewer, Role::UnitCoordinator], Resource::ActionPlans, write: true));
        $this->assertNull(RespondentScope::units($coordinator, $this->assessment, [Role::ExecutiveViewer, Role::UnitCoordinator], Resource::ResultsDashboard));
    }

    public function test_excel_export_keeps_the_disclaimer_and_hidden_cells(): void
    {
        $this->finalize($this->assessment, 3.0);

        $response = $this->actingAs($this->admin)->get(route('results.export', $this->assessment))->assertOk();
        $this->assertStringContainsString('spreadsheetml', (string) $response->headers->get('Content-Type'));
        $path = $response->getFile()->getPathname();
        $copy = tempnam(sys_get_temp_dir(), 'xlsx-').'.xlsx';
        copy($path, $copy);
        $reader = new Reader;
        $reader->open($copy);
        $sheets = [];
        foreach ($reader->getSheetIterator() as $sheet) {
            $rows = [];
            foreach ($sheet->getRowIterator() as $row) {
                $rows[] = $row->toArray();
            }
            $sheets[$sheet->getName()] = $rows;
        }
        $reader->close();
        unlink($copy);

        $this->assertSame(['Ringkasan', 'Aspek', 'Karakteristik', 'Peta strata', 'Peta unit', 'Kepekaan bobot'], array_keys($sheets));
        $this->assertStringContainsString('bukan sertifikat', $sheets['Ringkasan'][0][0]);
        $this->assertSame('tersembunyi', $sheets['Peta strata'][1][1]);
        $this->assertSame(1, AuditLog::where('action', 'results.export')->count());
    }

    public function test_periods_with_the_same_instrument_are_compared(): void
    {
        $this->finalize($this->assessment, 3.0);
        $later = $this->withResponses($this->lockedAssessment($this->lead, $this->assessor, ['name' => 'Asesmen Budaya K3 Periode Kedua', 'period_start' => now()->addYear()->toDateString(), 'period_end' => now()->addYear()->addDays(90)->toDateString()]));
        $this->finalize($later, 3.5);

        $this->actingAs($this->viewer)->get(route('trend.index', $later))->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('results/trend')
                ->has('trend.periods', 2)
                ->where('trend.periods.0.id', $this->assessment->id)
                ->where('trend.periods.1.current', true)
                ->where('trend.periods.1.delta', fn ($d) => $d > 0));
    }
}
