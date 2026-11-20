<?php

namespace Tests\Feature\Validation;

use App\Domain\Access\Role;
use App\Domain\Workflow\AssessmentStatus;
use App\Models\Assessment;
use App\Models\AuditLog;
use App\Models\Characteristic;
use App\Models\SiteVisitCheck;
use App\Models\User;
use App\Models\ValidationGuide;
use App\Models\ValidationRating;
use App\Models\ValidationSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\BuildsAssessments;
use Tests\TestCase;

/**
 * Bahan validasi lapangan versi 2 (permintaan pemilik proyek, 20 November 2026): panduan wawancara dan diskusi kelompok
 * terarah, kode bukti dan kesepakatan, lembar kerja kunjungan proyek, triangulasi, ekspor Excel, dan cetak panduan.
 */
class FieldGuideTest extends TestCase
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
        $this->assessment->forceFill(['status' => AssessmentStatus::Validation])->save();
    }

    private function characteristic(string $code): Characteristic
    {
        return Characteristic::where('instrument_version_id', $this->assessment->instrument_version_id)->where('code', $code)->firstOrFail();
    }

    private function makeSession(string $type, string $layer): ValidationSession
    {
        return ValidationSession::create([
            'assessment_id' => $this->assessment->id, 'type' => $type, 'label' => "Sesi {$type}", 'layer' => $layer,
            'status' => 'SCHEDULED', 'focus_characteristic_ids' => [$this->characteristic('K1.1')->id, $this->characteristic('K4.2')->id],
        ]);
    }

    public function test_each_session_type_shows_its_field_guide_and_workers_get_plain_discussion_questions(): void
    {
        foreach (['INTERVIEW' => 'MANAGEMENT', 'FOCUS_GROUP' => 'FIELD', 'SITE_VISIT' => 'FIELD'] as $type => $layer) {
            $s = $this->makeSession($type, $layer);
            $this->actingAs($this->assessor)->get(route('validation.sessions.show', [$this->assessment, $s->id]))->assertOk()
                ->assertInertia(fn (Assert $page) => $page->component('validation/session')
                    ->where('session.fieldGuide.kind', $type === 'SITE_VISIT' ? 'SITE_VISIT' : $type));
        }
        $field = collect(ValidationGuide::where('assessment_id', $this->assessment->id)->where('layer', 'FIELD')->value('questions'))->firstWhere('code', 'K1.1');
        $this->assertStringContainsString('kalian', $field['question']);
    }

    public function test_evidence_and_agreement_codes_are_stored_with_ratings(): void
    {
        $group = $this->makeSession('FOCUS_GROUP', 'FIELD');
        $interview = $this->makeSession('INTERVIEW', 'MANAGEMENT');
        $k11 = $this->characteristic('K1.1')->id;
        $form = fn (ValidationSession $s, array $rating) => $this->actingAs($this->assessor)->put(route('validation.sessions.form', [$this->assessment, $s->id]), [
            'recordingConsent' => true, 'notes' => null, 'ratings' => [['characteristicId' => $k11, 'level' => 3.5, 'note' => null, ...$rating]],
        ]);

        $form($group, ['evidence' => 'PARTIAL', 'agreement' => 'MIXED'])->assertSessionHasNoErrors();
        $form($interview, ['evidence' => 'CONSISTENT', 'agreement' => 'DIVIDED'])->assertSessionHasNoErrors();
        $form($interview, ['evidence' => 'BAGUS'])->assertSessionHasErrors('ratings.0.evidence');

        $stored = ValidationRating::where('validation_session_id', $group->id)->firstOrFail();
        $this->assertSame(['PARTIAL', 'MIXED'], [$stored->evidence_code, $stored->agreement]);
        // Kesepakatan kelompok hanya untuk diskusi kelompok.
        $this->assertNull(ValidationRating::where('validation_session_id', $interview->id)->value('agreement'));
        $this->assertSame('CONSISTENT', ValidationRating::where('validation_session_id', $interview->id)->value('evidence_code'));
    }

    public function test_the_site_visit_worksheet_is_saved_per_item_and_audited(): void
    {
        $visit = $this->makeSession('SITE_VISIT', 'FIELD');
        $interview = $this->makeSession('INTERVIEW', 'MANAGEMENT');
        $url = route('validation.sessions.site-checks', [$this->assessment, $visit->id]);

        $this->actingAs($this->assessor)->put($url, ['checks' => [
            ['itemCode' => 'SV19', 'result' => 'PARTIAL', 'note' => 'Pengaman tepi lantai 5 belum lengkap.'],
            ['itemCode' => 'SV24', 'result' => 'MEETS', 'note' => null],
            ['itemCode' => 'SV01', 'result' => 'NOT_OBSERVED', 'note' => null],
        ]])->assertSessionHasNoErrors();
        $this->assertSame(3, SiteVisitCheck::where('validation_session_id', $visit->id)->count());
        $this->assertSame($this->characteristic('K4.2')->id, SiteVisitCheck::where('item_code', 'SV19')->value('characteristic_id'));
        $this->assertSame(1, AuditLog::where('action', 'validation.site_check')->count());

        // Mengosongkan satu butir menghapusnya; kiriman yang sama tidak menambah catatan audit.
        $this->actingAs($this->assessor)->put($url, ['checks' => [['itemCode' => 'SV01', 'result' => null, 'note' => null]]])->assertSessionHasNoErrors();
        $this->assertSame(2, SiteVisitCheck::where('validation_session_id', $visit->id)->count());
        $this->actingAs($this->assessor)->put($url, ['checks' => [['itemCode' => 'SV24', 'result' => 'MEETS', 'note' => null]]])->assertSessionHasNoErrors();
        $this->assertSame(2, AuditLog::where('action', 'validation.site_check')->count());

        $this->actingAs($this->assessor)->put($url, ['checks' => [['itemCode' => 'SV99', 'result' => 'MEETS', 'note' => null]]])->assertSessionHasErrors('checks');
        $this->actingAs($this->assessor)->put($url, ['checks' => [['itemCode' => 'SV19', 'result' => 'BAGUS', 'note' => null]]])->assertSessionHasErrors('checks.0.result');
        $this->actingAs($this->assessor)->put(route('validation.sessions.site-checks', [$this->assessment, $interview->id]), ['checks' => [
            ['itemCode' => 'SV19', 'result' => 'MEETS', 'note' => null],
        ]])->assertSessionHasErrors('checks');
        $this->actingAs($this->admin)->put($url, ['checks' => []])->assertForbidden();
    }

    public function test_triangulation_reaches_the_scoring_workspace_and_the_excel_export(): void
    {
        $interview = $this->makeSession('INTERVIEW', 'MANAGEMENT');
        $visit = $this->makeSession('SITE_VISIT', 'FIELD');
        $k42 = $this->characteristic('K4.2')->id;
        $this->actingAs($this->lead)->put(route('validation.sessions.form', [$this->assessment, $interview->id]), [
            'recordingConsent' => true, 'notes' => null, 'ratings' => [['characteristicId' => $k42, 'level' => 5.0, 'note' => null, 'evidence' => 'CONSISTENT']],
        ])->assertSessionHasNoErrors();
        $this->actingAs($this->lead)->put(route('validation.sessions.site-checks', [$this->assessment, $visit->id]), ['checks' => [
            ['itemCode' => 'SV19', 'result' => 'NOT_MET', 'note' => 'Lubang lantai terbuka.'],
            ['itemCode' => 'SV20', 'result' => 'PARTIAL', 'note' => 'Satu perancah tanpa tanda.'],
        ]])->assertSessionHasNoErrors();

        $this->assessment->forceFill(['status' => AssessmentStatus::Scoring])->save();
        $this->actingAs($this->assessor)->get(route('scoring.show', [$this->assessment, 'K4.2']))->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('characteristic.triangulation.talks.n', 1)
                ->where('characteristic.triangulation.site.index', 0.25)
                // Sesi (5 - 1) / 4 = 1,00 dan kunjungan 0,25: perlu dibahas.
                ->where('characteristic.triangulation.divergent', true)
                ->has('characteristic.siteChecks', 2));

        $response = $this->actingAs($this->assessor)->get(route('validation.export', $this->assessment));
        $response->assertOk()->assertHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        $this->assertSame(1, AuditLog::where('action', 'validation.export')->count());
        $this->actingAs($this->admin)->get(route('validation.export', $this->assessment))->assertForbidden();
    }

    public function test_printable_guides_carry_the_material_without_scripts_or_names(): void
    {
        $visit = $this->makeSession('SITE_VISIT', 'FIELD');
        $group = $this->makeSession('FOCUS_GROUP', 'FIELD');
        $group->participants()->create(['full_name' => 'Budi Rahasiawan', 'position' => 'Tukang besi']);

        $this->actingAs($this->assessor)->get(route('validation.sessions.print', [$this->assessment, $visit->id]))->assertOk()
            ->assertSee('SV19')->assertSee('Pengaman tepi')->assertDontSee('<script', false);
        $this->actingAs($this->assessor)->get(route('validation.sessions.print', [$this->assessment, $group->id]))->assertOk()
            ->assertSee('Aturan diskusi')->assertSee('Pendalaman')->assertDontSee('Budi Rahasiawan')->assertDontSee('<script', false);
        $this->actingAs($this->admin)->get(route('validation.sessions.print', [$this->assessment, $visit->id]))->assertForbidden();
    }
}
