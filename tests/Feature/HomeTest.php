<?php

namespace Tests\Feature;

use App\Domain\Access\Role;
use App\Domain\Workflow\AssessmentStatus;
use App\Models\Assessment;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class HomeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['nscas.enforce_two_factor' => false]);
    }

    private function clientUser(Organization $organization, Role $role): User
    {
        $user = User::factory()->create();
        $user->memberships()->create(['organization_id' => $organization->id, 'role' => $role]);

        return $user;
    }

    public function test_guests_are_sent_to_login_and_root_redirects(): void
    {
        $this->get('/')->assertRedirect(route('login'));
        $this->get(route('home'))->assertRedirect(route('login'));
        $this->actingAs(User::factory()->create())->get('/')->assertRedirect(route('home'));
    }

    public function test_home_shows_six_stages_with_modules_for_the_account_type(): void
    {
        $organization = Organization::factory()->create();
        $assessment = Assessment::factory()->for($organization)->status(AssessmentStatus::DataCollection)->create();
        $admin = $this->clientUser($organization, Role::ClientAdmin);

        $this->actingAs($admin)->get(route('home'))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('home')
            ->where('persona.primaryRole', 'CLIENT_ADMIN')
            ->where('selected.id', $assessment->id)
            ->where('selected.stage', 2)
            ->has('selected.stages', 6)
            ->where('selected.stages.0.state', 'done')
            ->where('selected.stages.1.state', 'current')
            ->where('selected.stages.2.state', 'upcoming')
            // Admin klien tidak melihat halaman tahap validasi dan penilaian (data mentah dan nilai asesor).
            ->where('selected.stages.2.modules', [])
            ->where('selected.stages.3.modules', [])
            ->where('selected.roleTasks.0.key', 'respondents')
            ->where('accountMenu.0.key', 'assessments')
        );
    }

    public function test_executive_viewer_gets_a_reading_menu_only(): void
    {
        $organization = Organization::factory()->create();
        Assessment::factory()->for($organization)->status(AssessmentStatus::Reported)->create();
        $viewer = $this->clientUser($organization, Role::ExecutiveViewer);

        $this->actingAs($viewer)->get(route('home'))->assertInertia(fn (Assert $page) => $page
            ->where('persona.primaryRole', 'EXECUTIVE_VIEWER')
            ->where('selected.roleTasks', fn ($tasks) => collect($tasks)->pluck('key')->all() === ['dashboard', 'report', 'monitoring'])
            ->where('accountMenu', fn ($menu) => collect($menu)->pluck('key')->all() === ['assessments', 'account'])
        );
    }

    public function test_home_without_any_assessment_still_renders(): void
    {
        $this->actingAs(User::factory()->create())->get(route('home'))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->where('selected', null)
            ->where('assessments', [])
            ->where('persona.primaryRole', null)
        );
    }

    public function test_home_never_lists_assessments_of_other_organizations(): void
    {
        $mine = Organization::factory()->create();
        $other = Organization::factory()->create();
        $visible = Assessment::factory()->for($mine)->create();
        $hidden = Assessment::factory()->for($other)->create();
        $admin = $this->clientUser($mine, Role::ClientAdmin);

        $this->actingAs($admin)->get(route('home', ['assessment' => $hidden->id]))->assertInertia(fn (Assert $page) => $page
            ->has('assessments', 1)
            ->where('assessments.0.id', $visible->id)
            // Meminta asesmen organisasi lain lewat parameter tidak berpengaruh.
            ->where('selected.id', $visible->id)
        );
    }

    public function test_roles_that_require_two_factor_must_enrol_before_working(): void
    {
        config(['nscas.enforce_two_factor' => true]);
        $organization = Organization::factory()->create();
        $admin = $this->clientUser($organization, Role::ClientAdmin);
        $viewer = $this->clientUser($organization, Role::ExecutiveViewer);

        $this->actingAs($admin)->get(route('home'))->assertRedirect(route('security.edit'));
        $this->actingAs($viewer)->get(route('home'))->assertOk();
        $admin->forceFill(['two_factor_confirmed_at' => now()])->save();
        $this->actingAs($admin)->get(route('home'))->assertOk();
    }

    public function test_deactivated_accounts_are_signed_out(): void
    {
        $user = User::factory()->create(['is_active' => false]);
        $this->actingAs($user)->get(route('home'))->assertRedirect(route('login'));
        $this->assertGuest();
    }
}
