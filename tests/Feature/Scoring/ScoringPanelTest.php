<?php

namespace Tests\Feature\Scoring;

use App\Domain\Access\Role;
use App\Domain\Workflow\AssessmentStatus;
use App\Models\Assessment;
use App\Models\AuditLog;
use App\Models\Characteristic;
use App\Models\ClimateItem;
use App\Models\EvidenceRating;
use App\Models\Organization;
use App\Models\PanelDecision;
use App\Models\ScoreRun;
use App\Models\Stratum;
use App\Models\Unit;
use App\Models\User;
use App\Services\SetupFactsCollector;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\BuildsAssessments;
use Tests\TestCase;

/**
 * Fase R7 (docs/01 M8, docs/03 bagian 2 sampai 5): nilai bukti tanpa saling melihat sebelum menyimpan, dua asesor per
 * karakteristik, jalur setara, eksekusi mesin dari parameter terkunci yang tidak dapat diubah, keputusan panel
 * tertulis untuk karakteristik bertanda, dan penguncian hasil.
 */
class ScoringPanelTest extends TestCase
{
    use BuildsAssessments, RefreshDatabase;

    private User $lead;

    private User $assessor;

    private User $admin;

    private Assessment $assessment;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpAssessmentWorld();
        $this->lead = $this->member($this->operator, Role::LeadAssessor);
        $this->assessor = $this->member($this->operator, Role::Assessor);
        $this->admin = $this->member($this->client, Role::ClientAdmin);
        $this->assessment = $this->lockedAssessment($this->lead, $this->assessor);
        $strata = Stratum::where('assessment_id', $this->assessment->id)->orderBy('code')->get();
        foreach (range(1, 6) as $i) {
            $this->response($strata[$i % 2], 3);
        }
    }

    private function moveTo(AssessmentStatus $status): void
    {
        $this->assessment->forceFill(['status' => $status])->save();
        $this->assessment->refresh();
    }

    private function response(Stratum $stratum, int $level): void
    {
        $id = (string) Str::uuid();
        $unit = Unit::where('assessment_id', $this->assessment->id)->orderBy('name')->firstOrFail();
        DB::table('survey_responses')->insert([
            'id' => $id, 'assessment_id' => $this->assessment->id, 'unit_id' => $unit->id, 'stratum_id' => $stratum->id,
            'instrument_version_id' => $this->assessment->instrument_version_id, 'language' => 'id',
            'submitted_on' => now()->toDateString(), 'duration_bucket' => 'FROM_10_TO_15', 'quality_flags' => '[]',
        ]);
        foreach (Characteristic::where('instrument_version_id', $this->assessment->instrument_version_id)->pluck('id') as $cid) {
            DB::table('characteristic_answers')->insert(['id' => (string) Str::uuid(), 'survey_response_id' => $id, 'characteristic_id' => $cid, 'level' => $level]);
        }
        foreach (ClimateItem::query()->pluck('id') as $item) {
            DB::table('climate_answers')->insert(['id' => (string) Str::uuid(), 'survey_response_id' => $id, 'climate_item_id' => $item, 'value' => $level]);
        }
    }

    /** @return list<Characteristic> */
    private function characteristics(): array
    {
        return Characteristic::where('instrument_version_id', $this->assessment->instrument_version_id)->orderBy('position')->get()->all();
    }

    private function rate(User $user, Characteristic $c, float $level, string $rationale = 'Dua dokumen dan satu observasi menunjukkan praktik berjalan.'): TestResponse
    {
        return $this->actingAs($user)->put(route('scoring.rate', [$this->assessment, $c->id]), [
            'level' => $level, 'rationale' => $rationale, 'evidenceIds' => [], 'observationIds' => [],
        ]);
    }

    public function test_assessors_rate_blind_until_they_save_their_own_rating(): void
    {
        $this->moveTo(AssessmentStatus::Scoring);
        $k11 = $this->characteristics()[0];

        $this->rate($this->assessor, $k11, 3.3)->assertSessionHasErrors('level');
        $this->rate($this->assessor, $k11, 3.5, 'Terlalu singkat')->assertSessionHasErrors('rationale');
        $this->actingAs($this->assessor)->put(route('scoring.rate', [$this->assessment, $k11->id]), [
            'level' => 3.5, 'rationale' => 'Dua dokumen dan satu observasi menunjukkan praktik berjalan.', 'evidenceIds' => ['01ABCDEFGHJKMNPQRSTVWXYZ00'], 'observationIds' => [],
        ])->assertSessionHasErrors('evidenceIds');
        $this->rate($this->admin, $k11, 3.5)->assertForbidden();
        $this->rate($this->assessor, $k11, 3.5)->assertRedirect();

        $this->actingAs($this->lead)->get(route('scoring.show', [$this->assessment, $k11->code]))->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('scoring/characteristic')
                ->where('characteristic.own', null)->where('characteristic.hidden', 1)->where('characteristic.others', [])
                ->where('characteristic.perception.answered', 6));
        $this->rate($this->lead, $k11, 1.5)->assertRedirect();
        $this->actingAs($this->lead)->get(route('scoring.show', [$this->assessment, $k11->code]))
            ->assertInertia(fn (Assert $page) => $page->where('characteristic.own.level', 1.5)->where('characteristic.hidden', 0)
                ->where('characteristic.others.0.level', 3.5));
        // Selisih 2,0 lebih dari ambang 1,0: tanda rekonsiliasi tampil bagi yang sudah menilai.
        $this->actingAs($this->lead)->get(route('scoring.index', $this->assessment))
            ->assertInertia(fn (Assert $page) => $page->component('scoring/index')->where('rows.0.reconcile', true)->where('rows.0.assessors', 2));
        $this->assertSame(2, AuditLog::where('action', 'score.evidence_rating')->count());

        $this->moveTo(AssessmentStatus::PanelReview);
        $this->rate($this->assessor, $k11, 4.0)->assertStatus(409);
    }

    public function test_scoring_runs_from_locked_parameters_and_are_immutable(): void
    {
        $this->moveTo(AssessmentStatus::Validation);
        foreach ($this->characteristics() as $c) {
            $this->rate($this->assessor, $c, 3.0)->assertRedirect();
        }
        $this->assertFalse(SetupFactsCollector::for($this->assessment->fresh())->twoAssessorRatings);
        foreach ($this->characteristics() as $c) {
            $this->rate($this->lead, $c, 3.5)->assertRedirect();
        }
        $this->assertTrue(SetupFactsCollector::for($this->assessment->fresh())->twoAssessorRatings);

        $this->actingAs($this->lead)->post(route('scoring.run', $this->assessment))->assertStatus(409);
        $this->moveTo(AssessmentStatus::Scoring);
        $this->actingAs($this->assessor)->post(route('scoring.run', $this->assessment))->assertForbidden();
        Carbon::setTestNow(now()->addMinute());
        $this->actingAs($this->lead)->post(route('scoring.run', $this->assessment))->assertRedirect()->assertSessionHas('status', 'scoreRun');

        $run = ScoreRun::sole();
        $this->assertSame('1.0.0', $run->engine_version);
        $this->assertSame(6, $run->input_snapshot['counts']['responses']);
        $this->assertArrayNotHasKey('surveyResponses', $run->input_snapshot);
        $this->assertEqualsWithDelta(3.0, $run->result['characteristics'][0]['perception'], 1e-6);
        $this->assertEqualsWithDelta(3.25, $run->result['characteristics'][0]['evidence'], 1e-6);
        $this->assertSame($this->assessment->parameter_snapshot['parameters'], $run->parameter_snapshot);
        $this->assertTrue(SetupFactsCollector::for($this->assessment->fresh())->scoreRunCurrent);
        $this->assertSame(1, AuditLog::where('action', 'score.run')->count());

        // Perubahan nilai sesudah eksekusi membuat eksekusi usang.
        Carbon::setTestNow(now()->addMinutes(2));
        $this->rate($this->assessor, $this->characteristics()[0], 4.0)->assertRedirect();
        $this->assertFalse(SetupFactsCollector::for($this->assessment->fresh())->scoreRunCurrent);
        $this->actingAs($this->lead)->get(route('scoring.index', $this->assessment))->assertInertia(fn (Assert $page) => $page->where('stale', true)->has('runs', 1));
        Carbon::setTestNow();

        $this->expectException(QueryException::class);
        DB::table('score_runs')->where('id', $run->id)->update(['result' => json_encode(['diubah' => true])]);
    }

    public function test_the_equivalent_track_is_entered_by_the_lead_per_aspect(): void
    {
        $this->moveTo(AssessmentStatus::Scoring);
        $entries = array_map(fn (int $step) => ['step' => $step, 'percent' => 90 - $step * 5, 'justification' => 'Bukti dan wawancara sejalan.'], [2, 3, 4, 5]);

        $this->actingAs($this->assessor)->put(route('scoring.scl', [$this->assessment, 'A1']), ['entries' => $entries])->assertForbidden();
        $this->actingAs($this->lead)->put(route('scoring.scl', [$this->assessment, 'A1']), ['entries' => array_slice($entries, 0, 3)])->assertSessionHasErrors('entries');
        $this->actingAs($this->lead)->put(route('scoring.scl', [$this->assessment, 'A1']), ['entries' => $entries])->assertRedirect();
        $this->actingAs($this->lead)->get(route('scoring.index', $this->assessment))
            ->assertInertia(fn (Assert $page) => $page->where('scl.0.code', 'A1')->where('scl.0.steps.2.percent', 80)->where('scl.1.steps.2', null));
        $this->assertSame(1, AuditLog::where('action', 'score.scl')->count());
    }

    public function test_the_panel_decides_every_flagged_characteristic_then_locks_the_results(): void
    {
        $this->moveTo(AssessmentStatus::Scoring);
        $characteristics = $this->characteristics();
        foreach ($characteristics as $i => $c) {
            // Karakteristik pertama berselisih 2,0 antarasesor sehingga perlu rekonsiliasi.
            $this->rate($this->assessor, $c, $i === 0 ? 1.0 : 3.0)->assertRedirect();
            $this->rate($this->lead, $c, 3.0)->assertRedirect();
        }
        $this->actingAs($this->lead)->post(route('scoring.run', $this->assessment))->assertRedirect();
        $this->moveTo(AssessmentStatus::PanelReview);

        $code = $characteristics[0]->code;
        $this->actingAs($this->lead)->get(route('panel.index', $this->assessment))->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('scoring/panel')->where('canDecide', true)->where('panel.needed', [$code])
                ->where('panel.final', false));
        $this->actingAs($this->assessor)->get(route('panel.index', $this->assessment))->assertInertia(fn (Assert $page) => $page->where('canDecide', false));
        $this->actingAs($this->admin)->get(route('panel.index', $this->assessment))->assertForbidden();

        $this->actingAs($this->lead)->post(route('panel.finalize', $this->assessment))->assertSessionHasErrors('form');
        $this->assertFalse(SetupFactsCollector::for($this->assessment->fresh())->panelDecisionsComplete);
        $this->actingAs($this->assessor)->put(route('panel.decide', [$this->assessment, $code]), ['kind' => 'CONFIRMED', 'rationale' => 'Dibahas bersama dan disepakati panel.'])->assertForbidden();
        $this->actingAs($this->lead)->put(route('panel.decide', [$this->assessment, $code]), ['kind' => 'ADJUSTED', 'value' => 5.5, 'rationale' => 'Dibahas bersama dan disepakati panel.'])->assertSessionHasErrors('value');
        $this->actingAs($this->lead)->put(route('panel.decide', [$this->assessment, $code]), ['kind' => 'ADJUSTED', 'value' => 2.75, 'rationale' => 'Bukti tambahan dari kunjungan proyek menguatkan nilai bukti yang lebih rendah.'])->assertRedirect();
        $this->assertTrue(SetupFactsCollector::for($this->assessment->fresh())->panelDecisionsComplete);
        $this->actingAs($this->lead)->get(route('panel.index', $this->assessment))
            ->assertInertia(fn (Assert $page) => $page->where('panel.characteristics.0.decision.kind', 'ADJUSTED')->where('panel.characteristics.0.decision.value', 2.75));

        $this->actingAs($this->lead)->post(route('panel.finalize', $this->assessment))->assertRedirect()->assertSessionHas('status', 'finalized');
        $run = ScoreRun::sole();
        $this->assertTrue($run->is_final);
        $this->assertEqualsWithDelta(2.75, $run->final_result['characteristics'][0]['panelAdjusted'], 1e-6);
        $this->assertTrue(SetupFactsCollector::for($this->assessment->fresh())->resultsLocked);
        $this->assertSame(1, AuditLog::where('action', 'panel.finalize')->count());

        // Setelah ditetapkan, keputusan tidak dapat diubah lewat aplikasi maupun langsung di basis data.
        $this->actingAs($this->lead)->put(route('panel.decide', [$this->assessment, $code]), ['kind' => 'CONFIRMED', 'rationale' => 'Perubahan setelah penetapan hasil.'])->assertStatus(409);
        $this->expectException(QueryException::class);
        PanelDecision::query()->delete();
    }

    public function test_evidence_ratings_are_scoped_to_the_assessment_team(): void
    {
        $this->moveTo(AssessmentStatus::Scoring);
        $outsider = $this->member(Organization::factory()->operator()->create(), Role::LeadAssessor);
        $this->actingAs($outsider)->get(route('scoring.index', $this->assessment))->assertNotFound();
        $this->rate($outsider, $this->characteristics()[0], 3.0)->assertNotFound();
        $this->assertSame(0, EvidenceRating::count());
    }
}
