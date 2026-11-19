<?php

namespace Tests\Feature\Observations;

use App\Domain\Access\Role;
use App\Domain\Workflow\AssessmentStatus;
use App\Models\Assessment;
use App\Models\ObservationWindow;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\BuildsAssessments;
use Tests\TestCase;

/** Fase R12: pintu masuk aplikasi kamera observasi yang dapat dipasang di layar utama telepon (keputusan R5). */
class ObservationLauncherTest extends TestCase
{
    use BuildsAssessments, RefreshDatabase;

    private User $lead;

    private User $admin;

    private Assessment $assessment;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpAssessmentWorld();
        $this->lead = $this->member($this->operator, Role::LeadAssessor);
        $this->admin = $this->member($this->client, Role::ClientAdmin);
        $this->assessment = $this->lockedAssessment($this->lead, $this->member($this->operator, Role::Assessor));
        $this->assessment->forceFill(['status' => AssessmentStatus::DataCollection])->save();
    }

    private function window(string $title, int $opensInHours, int $closesInHours): ObservationWindow
    {
        $project = Unit::where('assessment_id', $this->assessment->id)->where('type', 'PROJECT')->firstOrFail();

        return ObservationWindow::create([
            'assessment_id' => $this->assessment->id, 'unit_id' => $project->id, 'title' => $title,
            'opens_at' => now()->addHours($opensInHours), 'closes_at' => now()->addHours($closesInHours),
            'checklist' => [['code' => 'O1', 'label' => 'Pemakaian alat pelindung diri']],
            'latitude' => -6.2, 'longitude' => 106.8, 'radius_meters' => 300, 'created_by_id' => $this->lead->id,
        ]);
    }

    public function test_a_single_open_window_opens_the_camera_directly(): void
    {
        $this->window('Masa lalu', -48, -24);
        $this->window('Akan datang', 24, 48);
        $open = $this->window('Minggu ini', -1, 24);

        $this->actingAs($this->admin)->get(route('observe.index'))
            ->assertRedirect(route('observations.capture', ['assessment' => $this->assessment, 'window' => $open->id]));
        $this->actingAs($this->admin)->get(route('observe.index', ['list' => 1]))->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('observations/launcher')->has('windows', 1)->where('windows.0.title', 'Minggu ini'));
    }

    public function test_users_without_capture_rights_see_no_windows(): void
    {
        $this->window('Minggu ini', -1, 24);
        $viewer = $this->member($this->client, Role::ExecutiveViewer);
        $this->actingAs($viewer)->get(route('observe.index'))->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('observations/launcher')->has('windows', 0));
    }

    public function test_the_manifest_and_service_worker_are_served_without_caching_data(): void
    {
        $manifest = json_decode((string) file_get_contents(public_path('manifest.webmanifest')), true);
        $this->assertSame('/observe', $manifest['start_url']);
        $this->assertSame('standalone', $manifest['display']);
        foreach ($manifest['icons'] as $icon) {
            $this->assertFileExists(public_path(ltrim($icon['src'], '/')));
        }
        $worker = (string) file_get_contents(public_path('sw.js'));
        $this->assertStringContainsString("mode !== 'navigate'", $worker);
        $this->assertStringNotContainsString('cache.put', $worker);
    }
}
