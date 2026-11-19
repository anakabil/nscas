<?php

namespace Tests\Feature\Setup;

use App\Domain\Access\Role;
use App\Domain\Workflow\AssessmentStatus;
use App\Models\Assessment;
use App\Models\AuditLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\BuildsAssessments;
use Tests\TestCase;

/**
 * Fase R1, kriteria selesai (PROMPTS.md): asesor utama dapat membuat asesmen dari nol sampai terkunci; parameter tidak
 * dapat diubah setelah terkunci; peran lain ditolak sesuai matriks.
 */
class AssessmentSetupFlowTest extends TestCase
{
    use BuildsAssessments, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpAssessmentWorld();
    }

    public function test_lead_assessor_creates_an_assessment_and_becomes_its_lead(): void
    {
        $lead = $this->member($this->operator, Role::LeadAssessor);

        $response = $this->actingAs($lead)->post(route('assessments.store'), $this->newAssessmentInput());

        $assessment = Assessment::firstOrFail();
        $response->assertRedirect(route('setup.details', $assessment));
        $this->assertSame(AssessmentStatus::Draft, $assessment->status);
        $this->assertSame(Role::LeadAssessor, $assessment->team()->sole()->role);
        $this->assertSame($lead->id, $assessment->team()->sole()->user_id);
        $this->assertSame(['S1', 'S2', 'S3', 'S4', 'S5'], $assessment->strata()->pluck('code')->all());
        $this->assertStringContainsString('Singapura', $assessment->consent_text_id);
        $this->assertStringContainsString('PT Konstruksi Uji', $assessment->consent_text_id);
        $this->assertStringContainsString('Singapore', $assessment->consent_text_en);
        $this->assertNull($assessment->parameter_draft['samplePlan']);
        $this->assertTrue(AuditLog::where('action', 'assessment.create')->where('assessment_id', $assessment->id)->exists());
    }

    public function test_only_lead_assessors_can_create_assessments_and_only_for_client_organisations(): void
    {
        $assessor = $this->member($this->operator, Role::Assessor);
        $clientAdmin = $this->member($this->client, Role::ClientAdmin);
        $lead = $this->member($this->operator, Role::LeadAssessor);

        $this->actingAs($assessor)->get(route('assessments.create'))->assertForbidden();
        $this->actingAs($clientAdmin)->post(route('assessments.store'), $this->newAssessmentInput())->assertForbidden();
        $this->actingAs($lead)->post(route('assessments.store'), $this->newAssessmentInput(['organization_id' => $this->operator->id]))
            ->assertSessionHasErrors('organization_id');
        $this->actingAs($lead)->post(route('assessments.store'), $this->newAssessmentInput(['period_end' => now()->toDateString()]))
            ->assertSessionHasErrors('period_end');
        $this->assertSame(0, Assessment::count());
    }

    public function test_from_draft_to_locked_through_the_pages(): void
    {
        $lead = $this->member($this->operator, Role::LeadAssessor);
        $assessor = $this->member($this->operator, Role::Assessor);
        $assessment = $this->createAssessment($lead);

        // Syarat belum terpenuhi: perubahan status ditolak dengan pesan, status tetap draf.
        $this->actingAs($lead)->post(route('assessments.transition', $assessment), ['to' => 'CONFIGURED'])
            ->assertSessionHasErrors('transition');
        $this->assertSame(AssessmentStatus::Draft, $assessment->fresh()->status);

        $this->actingAs($lead)->post(route('setup.units.store', $assessment), ['name' => 'Kantor Pusat', 'type' => 'HEAD_OFFICE'])->assertSessionHasNoErrors();
        $this->actingAs($lead)->post(route('setup.units.store', $assessment), [
            'name' => 'Proyek Jalan Tol', 'type' => 'PROJECT', 'latitude' => '-6,2088', 'longitude' => '106,8456', 'radius_meters' => 250,
        ])->assertSessionHasNoErrors();
        $populations = $assessment->strata()->pluck('id')->mapWithKeys(fn ($id) => [$id => 400])->all();
        $this->actingAs($lead)->put(route('setup.strata.populations', $assessment), ['populations' => $populations])->assertSessionHasNoErrors();
        $this->actingAs($lead)->post(route('setup.team.store', $assessment), ['user_id' => $assessor->id, 'role' => 'ASSESSOR'])->assertSessionHasNoErrors();

        $this->actingAs($lead)->get(route('assessments.show', $assessment))->assertInertia(fn (Assert $page) => $page
            ->where('progress.next.to', 'CONFIGURED')
            ->where('progress.next.canTransition', true)
            ->where('progress.readiness', ['met' => 5, 'checkable' => 5, 'total' => 5]));
        $this->actingAs($lead)->post(route('assessments.transition', $assessment), ['to' => 'CONFIGURED'])->assertSessionHasNoErrors();
        $this->assertSame(AssessmentStatus::Configured, $assessment->fresh()->status);

        $parameters = $this->actingAs($lead)->get(route('setup.parameters', $assessment))->viewData('page')['props']['parameters'];
        $parameters['layerWeights'] = ['perception' => '0,30', 'evidence' => '0,45', 'validation' => '0,25'];
        $this->actingAs($lead)->put(route('setup.parameters.update', $assessment), [
            'parameters' => $parameters,
            'consent_text_id' => $assessment->consent_text_id,
            'consent_text_en' => $assessment->consent_text_en,
            'dpa_status' => 'SIGNED',
            'dpa_reference' => 'PPD-2026-01',
            'dpa_signed_on' => now()->toDateString(),
        ])->assertSessionHasNoErrors();
        $this->actingAs($lead)->post(route('setup.sampling.store', $assessment), ['projects' => 1, 'locations' => 2])->assertSessionHasNoErrors();
        $this->actingAs($lead)->put(route('setup.kickoff.update', $assessment), [
            'leadership' => ['date' => now()->toDateString(), 'leader' => 'Direktur Utama'],
            'briefing' => ['date' => now()->toDateString(), 'channels' => ['SAFETY_TALK', 'NOTICE_BOARD'], 'note' => 'Tujuan dan kerahasiaan jawaban'],
        ])->assertSessionHasNoErrors();
        $this->actingAs($lead)->put(route('setup.kickoff.calibration', $assessment), [
            'date' => now()->toDateString(), 'attendees' => [$lead->id, $assessor->id],
        ])->assertSessionHasNoErrors();

        $this->actingAs($lead)->post(route('assessments.transition', $assessment), ['to' => 'LOCKED'])->assertSessionHasNoErrors();

        $locked = $assessment->fresh();
        $this->assertSame(AssessmentStatus::Locked, $locked->status);
        $this->assertNotNull($locked->locked_at);
        $this->assertSame($lead->id, $locked->locked_by);
        $snapshot = $locked->parameter_snapshot;
        $this->assertSame('NS-SCML-1.0', $snapshot['instrumentVersion']['code']);
        $this->assertSame(0.45, $snapshot['parameters']['layerWeights']['evidence']);
        $this->assertSame(2000, array_sum(array_column($snapshot['strata'], 'population')));
        $this->assertCount(2, $snapshot['units']);
        $this->assertGreaterThan(0, $snapshot['samplePlan']['result']['surveyTargetTotal']);
        $this->assertStringContainsString('Singapura', $snapshot['consent']['id']);
        $this->assertSame('SIGNED', $snapshot['dataProcessingAgreement']['status']);
        $this->assertSame(2, AuditLog::where('action', 'assessment.status_change')->where('assessment_id', $assessment->id)->count());
    }

    public function test_parameters_cannot_change_after_locking(): void
    {
        $lead = $this->member($this->operator, Role::LeadAssessor);
        $assessor = $this->member($this->operator, Role::Assessor);
        $assessment = $this->completePlanning($this->createAssessment($lead), $lead, $assessor);
        $this->actingAs($lead)->post(route('assessments.transition', $assessment), ['to' => 'CONFIGURED']);
        $this->actingAs($lead)->post(route('assessments.transition', $assessment), ['to' => 'LOCKED']);
        $this->assertSame(AssessmentStatus::Locked, $assessment->fresh()->status);
        $snapshot = $assessment->fresh()->parameter_snapshot;

        $page = $this->actingAs($lead)->get(route('setup.parameters', $assessment));
        $page->assertInertia(fn (Assert $p) => $p->where('canEdit', false)->where('locked', true));
        $parameters = $page->viewData('page')['props']['parameters'];

        $this->actingAs($lead)->putJson(route('setup.parameters.update', $assessment), [
            'parameters' => $parameters, 'consent_text_id' => str_repeat('Teks persetujuan baru. ', 5), 'consent_text_en' => '',
            'dpa_status' => 'SIGNED', 'dpa_signed_on' => now()->toDateString(),
        ])->assertStatus(409);
        $stratum = $assessment->strata()->first();
        $this->actingAs($lead)->putJson(route('setup.strata.populations', $assessment), ['populations' => [$stratum->id => 9]])->assertStatus(409);
        $this->actingAs($lead)->putJson(route('setup.details.update', $assessment), [
            'name' => 'Nama baru', 'scope_type' => 'PROJECT', 'period_start' => '2026-01-01', 'period_end' => '2026-12-31',
            'target_level' => 5, 'instrument_version_id' => $this->instrumentId(),
        ])->assertStatus(409);
        $this->actingAs($lead)->postJson(route('setup.sampling.store', $assessment), ['projects' => 9, 'locations' => 9])->assertStatus(409);
        $this->actingAs($lead)->put(route('setup.strata.populations', $assessment), ['populations' => [$stratum->id => 9]])->assertStatus(409);

        $this->assertEquals($snapshot, $assessment->fresh()->parameter_snapshot);
        $this->assertSame(100, $stratum->fresh()->population);

        // Unit masih dapat ditambah setelah dikunci (misalnya proyek baru), sama dengan v1.
        $this->actingAs($lead)->post(route('setup.units.store', $assessment), ['name' => 'Proyek Baru', 'type' => 'PROJECT'])->assertSessionHasNoErrors();
        $this->assertSame(3, $assessment->units()->count());
    }

    public function test_cross_field_rules_and_unit_rules_are_reported_on_the_field(): void
    {
        $lead = $this->member($this->operator, Role::LeadAssessor);
        $assessment = $this->createAssessment($lead);
        $parameters = $this->actingAs($lead)->get(route('setup.parameters', $assessment))->viewData('page')['props']['parameters'];

        $bad = $parameters;
        $bad['layerWeights']['perception'] = 0.5;
        $this->actingAs($lead)->put(route('setup.parameters.update', $assessment), [
            'parameters' => $bad, 'consent_text_id' => $assessment->consent_text_id, 'dpa_status' => 'NOT_STARTED',
        ])->assertSessionHasErrors('layerWeights');
        $bad = $parameters;
        $bad['quality']['minRespondentsPerReportCell'] = 4;
        $this->actingAs($lead)->put(route('setup.parameters.update', $assessment), [
            'parameters' => $bad, 'consent_text_id' => $assessment->consent_text_id, 'dpa_status' => 'NOT_STARTED',
        ])->assertSessionHasErrors('parameters.quality.minRespondentsPerReportCell');
        $this->actingAs($lead)->put(route('setup.parameters.update', $assessment), [
            'parameters' => $parameters, 'consent_text_id' => $assessment->consent_text_id, 'dpa_status' => 'SIGNED',
        ])->assertSessionHasErrors('dpa_signed_on');

        $this->actingAs($lead)->post(route('setup.units.store', $assessment), ['name' => 'Proyek', 'type' => 'PROJECT', 'latitude' => '-6,2'])
            ->assertSessionHasErrors('latitude');
        $this->actingAs($lead)->post(route('setup.units.store', $assessment), ['name' => 'Induk', 'type' => 'DIVISION']);
        $parent = $assessment->units()->sole();
        $this->actingAs($lead)->post(route('setup.units.store', $assessment), ['name' => 'Anak', 'type' => 'PROJECT', 'parent_id' => $parent->id]);
        $child = $assessment->units()->where('name', 'Anak')->sole();
        $this->actingAs($lead)->put(route('setup.units.update', [$assessment, $parent]), ['name' => 'Induk', 'type' => 'DIVISION', 'parent_id' => $child->id])
            ->assertSessionHasErrors('parent_id');
        $this->actingAs($lead)->delete(route('setup.units.destroy', [$assessment, $parent]))->assertSessionHasErrors('unit');
        $this->actingAs($lead)->post(route('setup.strata.store', $assessment), ['code' => 's1', 'name' => 'Duplikat', 'group' => 'FIELD', 'population' => 3])
            ->assertSessionHasErrors('code');
    }

    public function test_changing_strata_invalidates_the_saved_sample_plan(): void
    {
        $lead = $this->member($this->operator, Role::LeadAssessor);
        $assessor = $this->member($this->operator, Role::Assessor);
        $assessment = $this->completePlanning($this->createAssessment($lead), $lead, $assessor);
        $this->assertNotNull($assessment->parameter_draft['samplePlan']);

        $stratum = $assessment->strata()->first();
        $this->actingAs($lead)->put(route('setup.strata.populations', $assessment), ['populations' => [$stratum->id => 999]]);

        $this->assertNull($assessment->fresh()->parameter_draft['samplePlan']);
    }

    public function test_team_needs_two_people_and_keeps_one_lead(): void
    {
        $lead = $this->member($this->operator, Role::LeadAssessor);
        $assessment = $this->createAssessment($lead);
        $outsider = $this->member($this->client, Role::ClientAdmin);
        $assessor = $this->member($this->operator, Role::Assessor);

        $this->actingAs($lead)->post(route('setup.team.store', $assessment), ['user_id' => $outsider->id, 'role' => 'ASSESSOR'])->assertSessionHasErrors('user_id');
        $this->actingAs($lead)->post(route('setup.team.store', $assessment), ['user_id' => $assessor->id, 'role' => 'LEAD_ASSESSOR'])->assertSessionHasErrors('user_id');
        $leadMember = $assessment->team()->sole();
        $this->actingAs($lead)->delete(route('setup.team.destroy', [$assessment, $leadMember]))->assertSessionHasErrors('member');
        $this->actingAs($lead)->post(route('setup.team.store', $assessment), ['user_id' => $assessor->id, 'role' => 'ASSESSOR'])->assertSessionHasNoErrors();
        $this->assertSame(2, $assessment->team()->count());
    }
}
