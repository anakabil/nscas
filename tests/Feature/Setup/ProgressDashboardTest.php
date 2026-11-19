<?php

namespace Tests\Feature\Setup;

use App\Domain\Access\Role;
use App\Domain\Workflow\AssessmentStatus;
use App\Http\Middleware\HandleInertiaRequests;
use App\Models\Assessment;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\BuildsAssessments;
use Tests\TestCase;

/**
 * Dasbor progres di beranda (keputusan pemilik proyek, 19 November 2026): tampil untuk pengelola sistem, asesor, dan
 * administrator klien, tidak untuk koordinator unit dan peninjau eksekutif, dan hanya memuat asesmen yang boleh dilihat.
 */
class ProgressDashboardTest extends TestCase
{
    use BuildsAssessments, RefreshDatabase;

    private User $lead;

    private Assessment $planning;

    private Assessment $collecting;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpAssessmentWorld();
        $this->lead = $this->member($this->operator, Role::LeadAssessor);
        $this->planning = $this->createAssessment($this->lead, [
            'name' => 'Sedang Direncanakan',
            'period_start' => now()->subDays(5)->toDateString(),
            'period_end' => now()->addDays(60)->toDateString(),
        ]);
        $this->collecting = Assessment::factory()->for(Organization::factory()->create())->status(AssessmentStatus::DataCollection)->create([
            'name' => 'Organisasi Lain',
            'period_start' => now()->subDays(80)->toDateString(),
            'period_end' => now()->subDays(1)->toDateString(),
        ]);
    }

    public function test_super_admin_sees_every_assessment_with_progress_and_attention_flags(): void
    {
        $superAdmin = User::factory()->create(['is_super_admin' => true]);

        $this->actingAs($superAdmin)->get(route('home'))->assertInertia(fn (Assert $page) => $page
            ->has('dashboard.rows', 2)
            ->where('dashboard.totals.active', 2)
            ->where('dashboard.totals.byStage', [1, 1, 0, 0, 0, 0])
            ->where('dashboard.totals.attention', 2)
            ->where('dashboard.rows.0.attention', ['periodEnded'])
            ->where('dashboard.rows.1.name', 'Sedang Direncanakan')
            ->where('dashboard.rows.1.attention', ['planningLate'])
            ->where('dashboard.rows.1.planning.total', 7)
            ->where('dashboard.rows.1.readiness.total', 5));
    }

    public function test_lead_assessor_sees_only_assigned_assessments_and_readiness_grows_with_planning(): void
    {
        $this->actingAs($this->lead)->get(route('home'))->assertInertia(fn (Assert $page) => $page
            ->has('dashboard.rows', 1)
            ->where('dashboard.rows.0.id', $this->planning->id)
            ->where('dashboard.rows.0.planning.done', 1)
            // Strata bawaan dan versi instrumen sudah ada sejak dibuat; unit, jumlah pekerja, dan tim belum.
            ->where('dashboard.rows.0.readiness.met', 2));

        $this->completePlanning($this->planning, $this->lead, $this->member($this->operator, Role::Assessor));

        $this->actingAs($this->lead)->get(route('home'))->assertInertia(fn (Assert $page) => $page
            ->where('dashboard.rows.0.planning.done', 7)
            ->where('dashboard.rows.0.readiness', ['met' => 5, 'checkable' => 5, 'total' => 5])
            ->where('dashboard.rows.0.attention', ['planningLate', 'readyToAdvance'])
            ->where('dashboard.rows.0.workers', 1500)
            ->where('dashboard.totals.ready', 1));
    }

    public function test_client_admin_sees_own_organisation_only(): void
    {
        $admin = $this->member($this->client, Role::ClientAdmin);

        $this->actingAs($admin)->get(route('home'))->assertInertia(fn (Assert $page) => $page
            ->has('dashboard.rows', 1)
            ->where('dashboard.rows.0.organization', 'PT Konstruksi Uji'));
    }

    public function test_unit_coordinators_and_executive_viewers_do_not_get_the_dashboard(): void
    {
        foreach ([Role::UnitCoordinator, Role::ExecutiveViewer] as $role) {
            $user = $this->member($this->client, $role);
            $this->actingAs($user)->get(route('home'))->assertInertia(fn (Assert $page) => $page->where('dashboard', null));
        }
    }

    public function test_dashboard_can_be_reloaded_on_its_own(): void
    {
        $superAdmin = User::factory()->create(['is_super_admin' => true]);
        $version = (string) app(HandleInertiaRequests::class)->version(request());

        $this->actingAs($superAdmin)
            ->withHeaders(['X-Inertia' => 'true', 'X-Inertia-Partial-Component' => 'home', 'X-Inertia-Partial-Data' => 'dashboard', 'X-Inertia-Version' => $version])
            ->get(route('home'))
            ->assertOk()
            ->assertJsonPath('props.dashboard.totals.active', 2)
            ->assertJsonMissingPath('props.assessments');
    }
}
