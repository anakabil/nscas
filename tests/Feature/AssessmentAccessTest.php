<?php

namespace Tests\Feature;

use App\Domain\Access\Resource;
use App\Domain\Access\Role;
use App\Domain\Workflow\AssessmentStatus;
use App\Models\Assessment;
use App\Models\Organization;
use App\Models\User;
use App\Support\AssessmentAccess;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

/** Isolasi tenant dan hak akses asesmen (CLAUDE.md aturan 4, docs/04 bagian 2). */
class AssessmentAccessTest extends TestCase
{
    use RefreshDatabase;

    private Organization $clientA;

    private Organization $clientB;

    private Assessment $assessmentA;

    private Assessment $assessmentB;

    protected function setUp(): void
    {
        parent::setUp();
        config(['nscas.enforce_two_factor' => false]);
        $this->clientA = Organization::factory()->create();
        $this->clientB = Organization::factory()->create();
        $this->assessmentA = Assessment::factory()->for($this->clientA)->status(AssessmentStatus::Scoring)->create();
        $this->assessmentB = Assessment::factory()->for($this->clientB)->create();
    }

    private function member(Organization $organization, Role $role): User
    {
        $user = User::factory()->create();
        $user->memberships()->create(['organization_id' => $organization->id, 'role' => $role]);

        return $user->fresh();
    }

    private function assessor(Assessment $assessment, Role $role): User
    {
        $operator = Organization::factory()->operator()->create();
        $user = $this->member($operator, $role);
        $assessment->team()->create(['user_id' => $user->id, 'role' => $role]);

        return $user->fresh();
    }

    public function test_client_user_cannot_open_another_organizations_assessment(): void
    {
        $adminA = $this->member($this->clientA, Role::ClientAdmin);

        $this->actingAs($adminA)->get(route('assessments.show', $this->assessmentA))->assertOk();
        // 404, bukan 403: keberadaan asesmen organisasi lain tidak diungkap.
        $this->actingAs($adminA)->get(route('assessments.show', $this->assessmentB))->assertNotFound();
        $this->actingAs($adminA)->get(route('assessments.module', [$this->assessmentB, 'respondents']))->assertNotFound();
        $this->actingAs($adminA)->get(route('assessments.index'))->assertInertia(fn (Assert $page) => $page
            ->has('assessments', 1)->where('assessments.0.id', $this->assessmentA->id));
    }

    public function test_assessor_sees_only_assigned_assessments(): void
    {
        $assessor = $this->assessor($this->assessmentA, Role::Assessor);

        $this->assertSame([Role::Assessor], AssessmentAccess::rolesFor($assessor, $this->assessmentA));
        $this->assertSame([], AssessmentAccess::rolesFor($assessor, $this->assessmentB));
        $this->actingAs($assessor)->get(route('assessments.show', $this->assessmentB))->assertNotFound();
        $this->assertSame([$this->assessmentA->id], AssessmentAccess::visibleTo($assessor)->pluck('id')->all());
    }

    public function test_operator_role_in_a_client_organization_grants_nothing(): void
    {
        // Keanggotaan yang tidak sah (peran operator di organisasi klien) tidak boleh memberi akses.
        $user = $this->member($this->clientA, Role::LeadAssessor);

        $this->assertSame([], AssessmentAccess::rolesFor($user, $this->assessmentA));
        $this->actingAs($user)->get(route('assessments.show', $this->assessmentA))->assertNotFound();
    }

    public function test_module_pages_follow_the_access_matrix(): void
    {
        $admin = $this->member($this->clientA, Role::ClientAdmin);
        $viewer = $this->member($this->clientA, Role::ExecutiveViewer);
        $lead = $this->assessor($this->assessmentA, Role::LeadAssessor);

        $this->actingAs($admin)->get(route('assessments.module', [$this->assessmentA, 'respondents']))->assertOk();
        $this->actingAs($admin)->get(route('assessments.module', [$this->assessmentA, 'scoring']))->assertForbidden();
        $this->actingAs($viewer)->get(route('assessments.module', [$this->assessmentA, 'respondents']))->assertForbidden();
        $this->actingAs($viewer)->get(route('assessments.module', [$this->assessmentA, 'dashboard']))->assertOk();
        // Halaman tahap 1 sudah dibangun (fase R1): alamat modul yang sama membuka halaman kerjanya.
        $this->actingAs($lead)->get(route('assessments.module', [$this->assessmentA, 'setup/units']))->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('setup/units')->where('canEdit', true));
        $this->actingAs($lead)->get(route('assessments.module', [$this->assessmentA, 'participation']))->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('assessments/module')->where('module.key', 'participation')->where('module.stage', 2));
        $this->actingAs($lead)->get(route('assessments.module', [$this->assessmentA, 'tidak-ada']))->assertNotFound();
    }

    public function test_super_admin_administers_but_cannot_reach_respondents_or_results(): void
    {
        $superAdmin = User::factory()->create(['is_super_admin' => true]);

        $this->actingAs($superAdmin)->get(route('assessments.show', $this->assessmentB))->assertOk();
        $this->actingAs($superAdmin)->get(route('assessments.module', [$this->assessmentA, 'respondents']))->assertForbidden();
        $this->actingAs($superAdmin)->get(route('assessments.module', [$this->assessmentA, 'dashboard']))->assertForbidden();
        $this->actingAs($superAdmin)->get(route('assessments.module', [$this->assessmentA, 'audit']))->assertOk();
    }

    public function test_require_enforces_read_and_write_separately(): void
    {
        $assessor = $this->assessor($this->assessmentA, Role::Assessor);

        $this->assertSame([Role::Assessor], AssessmentAccess::require($assessor, $this->assessmentA, Resource::PanelAndFinalization));
        $this->expectException(HttpException::class);
        AssessmentAccess::require($assessor, $this->assessmentA, Resource::PanelAndFinalization, 'write');
    }

    public function test_account_areas_are_limited_to_the_right_account_types(): void
    {
        $viewer = $this->member($this->clientA, Role::ExecutiveViewer);
        $superAdmin = User::factory()->create(['is_super_admin' => true]);

        $this->actingAs($viewer)->get(route('organizations.index'))->assertForbidden();
        $this->actingAs($viewer)->get(route('retention.index'))->assertForbidden();
        $this->actingAs($viewer)->get(route('system-status'))->assertForbidden();
        $this->actingAs($superAdmin)->get(route('retention.index'))->assertOk();
        $this->actingAs($superAdmin)->get(route('system-status'))->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('checks.0.key', 'database')->where('checks.0.ok', true));
    }
}
