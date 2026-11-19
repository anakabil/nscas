<?php

namespace Tests\Feature\Observations;

use App\Domain\Access\Role;
use App\Models\Assessment;
use App\Models\AuditLog;
use App\Models\ObservationCapture;
use App\Models\ObservationWindow;
use App\Models\Unit;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\BuildsAssessments;
use Tests\TestCase;

/**
 * Fase R5 (docs/01 M6): masa observasi oleh asesor, rekaman kamera oleh koordinator, waktu server, lokasi dan
 * akurasinya, penanda di luar radius, penolakan di luar masa observasi, cakupan unit, dan jejak audit.
 */
class ObservationTest extends TestCase
{
    use BuildsAssessments, RefreshDatabase;

    private const JPEG = "\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xFF\xD9";

    private User $lead;

    private User $assessor;

    private User $admin;

    private Assessment $assessment;

    private Unit $project;

    protected function setUp(): void
    {
        parent::setUp();
        config(['filesystems.default' => 'local']);
        Storage::fake('local');
        $this->setUpAssessmentWorld();
        $this->lead = $this->member($this->operator, Role::LeadAssessor);
        $this->assessor = $this->member($this->operator, Role::Assessor);
        $this->admin = $this->member($this->client, Role::ClientAdmin);
        $this->assessment = $this->lockedAssessment($this->lead, $this->assessor);
        $this->project = Unit::where('assessment_id', $this->assessment->id)->where('name', 'Proyek Gedung A')->firstOrFail();
        $this->travelTo(CarbonImmutable::parse('2026-12-01 09:00', 'Asia/Jakarta'));
        // Sesi yang dimulai sebelum lompatan waktu sudah melewati batas 8 jam (docs/04 bagian 3).
        $this->flushSession();
    }

    /** @param  array<string, mixed>  $overrides */
    private function createWindow(User $user, array $overrides = []): TestResponse
    {
        return $this->actingAs($user)->post(route('observations.windows.store', $this->assessment), [
            'unit_id' => $this->project->id,
            'title' => 'Observasi area kerja minggu pertama',
            'opens_at' => '2026-12-01T08:00',
            'closes_at' => '2026-12-01T17:00',
            'checklist' => "Pemakaian alat pelindung diri\nRambu dan pembatas area\n",
            'latitude' => -6.2,
            'longitude' => 106.8,
            'radius_meters' => 300,
            ...$overrides,
        ]);
    }

    private function window(): ObservationWindow
    {
        $this->createWindow($this->lead)->assertSessionHasNoErrors();

        return ObservationWindow::sole();
    }

    /**
     * @param  array{latitude: float, longitude: float, accuracy: float}|null  $location
     */
    private function capture(User $user, ObservationWindow $window, ?array $location, string $content = self::JPEG, string $type = 'image/jpeg', string $code = 'O1'): TestResponse
    {
        $grant = $this->actingAs($user)->postJson(route('observations.captures.uploads', [$this->assessment, $window->id]), [
            'checklistItemCode' => $code, 'contentType' => $type, 'size' => strlen($content), 'location' => $location,
        ]);
        if ($grant->status() !== 200) {
            return $grant;
        }
        $this->actingAs($user)->call('PUT', $grant->json('upload.url'), [], [], [], ['CONTENT_TYPE' => $type], $content)->assertNoContent();

        return $this->actingAs($user)->postJson(route('observations.captures.store', [$this->assessment, $window->id]), [
            'ticket' => $grant->json('ticket'), 'note' => 'Pekerja di lantai 3 memakai helm.',
        ]);
    }

    public function test_assessors_open_windows_with_a_parsed_checklist_and_wib_times(): void
    {
        $window = $this->window();

        $this->assertSame([['code' => 'O1', 'label' => 'Pemakaian alat pelindung diri'], ['code' => 'O2', 'label' => 'Rambu dan pembatas area']], $window->checklist);
        $this->assertSame('2026-12-01T01:00:00+00:00', $window->opens_at->utc()->toIso8601String());
        $this->assertSame(300, $window->radius_meters);
        $audit = AuditLog::where('action', 'observation.window_create')->sole();
        $this->assertSame(Role::LeadAssessor->value, $audit->actor_role);
        $this->assertSame('Proyek Gedung A', $audit->changes['after']['unit']);

        $this->createWindow($this->assessor, ['title' => 'Observasi kedua'])->assertSessionHasNoErrors();
        $this->assertSame(Role::Assessor->value, AuditLog::where('action', 'observation.window_create')->latest('id')->value('actor_role'));
        $this->createWindow($this->admin)->assertForbidden();
    }

    public function test_window_input_is_validated(): void
    {
        $this->createWindow($this->lead, ['closes_at' => '2026-12-01T08:00'])->assertSessionHasErrors('closesAt');
        $this->createWindow($this->lead, ['checklist' => "\n  \n"])->assertSessionHasErrors('checklist');
        $this->createWindow($this->lead, ['radius_meters' => 5])->assertSessionHasErrors('radius_meters');
        $this->createWindow($this->lead, ['latitude' => 91])->assertSessionHasErrors('latitude');
        $other = $this->createAssessment($this->lead);
        $this->createWindow($this->lead, ['unit_id' => $other->units()->value('id') ?? 'x'])->assertSessionHasErrors('unitId');
        $this->assertSame(0, ObservationWindow::count());

        $draft = $this->createAssessment($this->lead);
        $this->actingAs($this->lead)->post(route('observations.windows.store', $draft), [
            'unit_id' => 'x', 'title' => 'Observasi', 'opens_at' => '2026-12-01T08:00', 'closes_at' => '2026-12-01T17:00',
            'checklist' => 'APD', 'latitude' => 0, 'longitude' => 0, 'radius_meters' => 100,
        ])->assertStatus(409);
    }

    public function test_coordinators_capture_with_server_time_location_and_radius_flag(): void
    {
        $window = $this->window();

        // Di dalam radius: sekitar 33 meter dari titik proyek.
        $this->capture($this->admin, $window, ['latitude' => -6.2003, 'longitude' => 106.8, 'accuracy' => 12.5])
            ->assertCreated()->assertJsonPath('outsideRadius', false)->assertJsonPath('distanceMeters', 33);
        $inside = ObservationCapture::sole();
        $this->assertSame('2026-12-01T02:00:00+00:00', $inside->server_captured_at->utc()->toIso8601String());
        $this->assertSame(12.5, $inside->accuracy_meters);
        $this->assertSame('image/jpeg', $inside->mime_type);
        $this->assertSame(hash('sha256', self::JPEG), $inside->sha256);
        $this->assertSame('Pekerja di lantai 3 memakai helm.', $inside->note);
        $this->assertStringContainsString('/observation/', $inside->storage_key);

        // Di luar radius: diterima tetapi ditandai.
        $this->capture($this->admin, $window, ['latitude' => -6.21, 'longitude' => 106.8, 'accuracy' => 8])
            ->assertCreated()->assertJsonPath('outsideRadius', true);
        // Tanpa lokasi: diterima, tidak dianggap di luar radius.
        $this->capture($this->admin, $window, null, code: 'O2')->assertCreated()->assertJsonPath('distanceMeters', null);

        $this->assertSame(3, AuditLog::where('action', 'observation.capture')->count());
        $this->actingAs($this->lead)->get(route('observations.index', $this->assessment))->assertInertia(fn (Assert $page) => $page
            ->component('observations/index')
            ->where('canCreate', true)
            ->where('canCapture', false)
            ->where('windows.0.state', 'OPEN')
            ->has('windows.0.captures', 3)
            ->where('windows.0.captures.1.outsideRadius', true));
        $this->actingAs($this->lead)->get(route('observations.captures.file', [$this->assessment, $inside->id]))->assertOk()->assertStreamedContent(self::JPEG);
        // Dasbor beranda: satu dari satu proyek sudah diobservasi.
        $this->actingAs($this->lead)->get(route('home'))->assertInertia(fn (Assert $page) => $page
            ->where('dashboard.rows.0.participation.observations', ['observed' => 1, 'projects' => 1]));
    }

    public function test_captures_outside_the_time_window_are_rejected(): void
    {
        $window = $this->window();
        $this->travelTo(CarbonImmutable::parse('2026-12-01 17:00', 'Asia/Jakarta'));
        // Sesi yang dibuka pukul 09.00 berakhir tepat 8 jam kemudian; pengguna masuk ulang.
        $this->flushSession();
        $this->capture($this->admin, $window, null)->assertStatus(409)->assertJsonPath('code', 'OUTSIDE_WINDOW');
        $this->travelTo(CarbonImmutable::parse('2026-12-01 07:59', 'Asia/Jakarta'));
        $this->capture($this->admin, $window, null)->assertStatus(409);
        $this->actingAs($this->admin)->get(route('observations.capture', [$this->assessment, $window->id]))
            ->assertInertia(fn (Assert $page) => $page->component('observations/capture')->where('window.open', false));
        $this->assertSame(0, ObservationCapture::count());
    }

    public function test_only_camera_photos_and_videos_are_accepted(): void
    {
        $window = $this->window();
        $this->capture($this->admin, $window, null, "%PDF-1.7\n", 'application/pdf')->assertStatus(422)
            ->assertJsonPath('errors.file.0', __('setup.errors.CAMERA_ONLY'));
        // Jenis yang dinyatakan foto tetapi isinya dokumen.
        $this->capture($this->admin, $window, null, "%PDF-1.7\n", 'image/jpeg')->assertStatus(422)
            ->assertJsonPath('errors.file.0', __('setup.errors.FILE_TYPE'));
        $this->capture($this->admin, $window, null, code: 'O9')->assertStatus(422);
        // Video WebM dari MediaRecorder.
        $this->capture($this->admin, $window, null, "\x1A\x45\xDF\xA3\x9F\x42\x86\x81\x01", 'video/webm;codecs=vp8')->assertCreated();
        $this->assertSame('video/webm', ObservationCapture::sole()->mime_type);
        $this->assertSame([], array_values(array_filter(Storage::disk('local')->allFiles(), fn (string $f) => ! str_ends_with($f, '.webm'))));
    }

    public function test_unit_coordinators_only_reach_windows_of_their_units_and_assessors_cannot_capture(): void
    {
        $window = $this->window();
        $coordinator = $this->member($this->client, Role::UnitCoordinator);
        $office = Unit::where('assessment_id', $this->assessment->id)->where('name', 'Kantor Pusat')->firstOrFail();
        $this->actingAs($this->admin)->post(route('respondents.coordinators.store', $this->assessment), ['user_id' => $coordinator->id, 'unit_id' => $office->id]);

        $this->actingAs($coordinator)->get(route('observations.index', $this->assessment))->assertInertia(fn (Assert $page) => $page
            ->where('scoped', true)->has('windows', 0)->where('canCapture', true));
        $this->actingAs($coordinator)->get(route('observations.capture', [$this->assessment, $window->id]))->assertNotFound();
        $this->capture($coordinator, $window, null)->assertNotFound();

        $this->actingAs($this->admin)->post(route('respondents.coordinators.store', $this->assessment), ['user_id' => $coordinator->id, 'unit_id' => $this->project->id]);
        $this->actingAs($coordinator)->get(route('observations.capture', [$this->assessment, $window->id]))->assertInertia(fn (Assert $page) => $page
            ->component('observations/capture')
            ->where('window.open', true)
            ->where('checklist.0', ['code' => 'O1', 'label' => 'Pemakaian alat pelindung diri', 'count' => 0]));
        $this->capture($coordinator, $window, null)->assertCreated();
        $this->assertSame(Role::UnitCoordinator->value, AuditLog::where('action', 'observation.capture')->value('actor_role'));

        $this->actingAs($this->assessor)->get(route('observations.capture', [$this->assessment, $window->id]))->assertForbidden();
        $this->capture($this->assessor, $window, null)->assertForbidden();
        $outsider = $this->member($this->operator, Role::Assessor);
        $this->actingAs($outsider)->get(route('observations.index', $this->assessment))->assertNotFound();
    }
}
