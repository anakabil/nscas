<?php

namespace Tests\Feature\Setup;

use App\Domain\Access\Role;
use App\Models\Assessment;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\BuildsAssessments;
use Tests\TestCase;

/** Hak akses halaman tahap 1 menurut matriks docs/04 dan isolasi tenant (aturan 4). */
class SetupAccessTest extends TestCase
{
    use BuildsAssessments, RefreshDatabase;

    private User $lead;

    private Assessment $assessment;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpAssessmentWorld();
        $this->lead = $this->member($this->operator, Role::LeadAssessor);
        $this->assessment = $this->createAssessment($this->lead);
    }

    private function parametersPayload(): array
    {
        $parameters = $this->actingAs($this->lead)->get(route('setup.parameters', $this->assessment))->viewData('page')['props']['parameters'];

        return ['parameters' => $parameters, 'consent_text_id' => $this->assessment->consent_text_id, 'dpa_status' => 'NOT_STARTED'];
    }

    public function test_team_assessor_reads_but_cannot_change_parameters(): void
    {
        $assessor = $this->member($this->operator, Role::Assessor);
        $this->assessment->team()->create(['user_id' => $assessor->id, 'role' => Role::Assessor]);
        $payload = $this->parametersPayload();

        $this->actingAs($assessor)->get(route('setup.parameters', $this->assessment))
            ->assertOk()->assertInertia(fn (Assert $page) => $page->component('setup/parameters')->where('canEdit', false));
        $this->actingAs($assessor)->put(route('setup.parameters.update', $this->assessment), $payload)->assertForbidden();
        $this->actingAs($assessor)->post(route('setup.units.store', $this->assessment), ['name' => 'Unit', 'type' => 'BRANCH'])->assertForbidden();
        $this->actingAs($assessor)->post(route('assessments.transition', $this->assessment), ['to' => 'CONFIGURED'])->assertForbidden();
    }

    public function test_client_admin_reads_planning_pages_but_cannot_change_them(): void
    {
        $admin = $this->member($this->client, Role::ClientAdmin);
        $payload = $this->parametersPayload();

        $this->actingAs($admin)->get(route('setup.strata', $this->assessment))
            ->assertOk()->assertInertia(fn (Assert $page) => $page->where('canEdit', false));
        $this->actingAs($admin)->get(route('setup.team', $this->assessment))
            ->assertOk()->assertInertia(fn (Assert $page) => $page->where('canEdit', false)->where('staff', []));
        $this->actingAs($admin)->put(route('setup.parameters.update', $this->assessment), $payload)->assertForbidden();
        $this->actingAs($admin)->post(route('setup.team.store', $this->assessment), ['user_id' => $admin->id, 'role' => 'ASSESSOR'])->assertForbidden();
    }

    public function test_coordinators_and_executives_cannot_open_team_or_kickoff(): void
    {
        $coordinator = $this->member($this->client, Role::UnitCoordinator);
        $viewer = $this->member($this->client, Role::ExecutiveViewer);

        $this->actingAs($coordinator)->get(route('setup.team', $this->assessment))->assertForbidden();
        $this->actingAs($viewer)->get(route('setup.kickoff', $this->assessment))->assertForbidden();
        $this->actingAs($viewer)->get(route('setup.parameters', $this->assessment))->assertForbidden();
    }

    public function test_other_organisations_and_unassigned_assessors_receive_404(): void
    {
        $otherAdmin = $this->member(Organization::factory()->create(), Role::ClientAdmin);
        $unassignedLead = $this->member($this->operator, Role::LeadAssessor);
        $payload = $this->parametersPayload();

        $this->actingAs($otherAdmin)->get(route('setup.details', $this->assessment))->assertNotFound();
        $this->actingAs($unassignedLead)->get(route('setup.units', $this->assessment))->assertNotFound();
        $this->actingAs($unassignedLead)->put(route('setup.parameters.update', $this->assessment), $payload)->assertNotFound();
        $this->actingAs($otherAdmin)->post(route('assessments.transition', $this->assessment), ['to' => 'CONFIGURED'])->assertNotFound();
    }

    public function test_super_admin_manages_the_team_but_not_the_parameters(): void
    {
        $superAdmin = User::factory()->create(['is_super_admin' => true]);
        $assessor = $this->member($this->operator, Role::Assessor);
        $payload = $this->parametersPayload();

        $this->actingAs($superAdmin)->post(route('setup.team.store', $this->assessment), ['user_id' => $assessor->id, 'role' => 'ASSESSOR'])
            ->assertSessionHasNoErrors();
        $this->assertSame(2, $this->assessment->team()->count());
        $this->actingAs($superAdmin)->put(route('setup.parameters.update', $this->assessment), $payload)->assertForbidden();
    }

    public function test_unit_from_another_assessment_cannot_be_reached_through_this_one(): void
    {
        $other = $this->createAssessment($this->lead, ['name' => 'Asesmen Lain']);
        $this->actingAs($this->lead)->post(route('setup.units.store', $other), ['name' => 'Unit Asing', 'type' => 'BRANCH']);
        $foreign = $other->units()->sole();

        $this->actingAs($this->lead)->delete(route('setup.units.destroy', [$this->assessment, $foreign]))->assertNotFound();
        $this->assertTrue($foreign->exists());
    }
}
