<?php

namespace Tests\Feature\Validation;

use App\Domain\Access\Role;
use App\Domain\Validation\SessionProposal;
use App\Domain\Workflow\AssessmentStatus;
use App\Mail\SurveyMail;
use App\Models\AccessToken;
use App\Models\Assessment;
use App\Models\AuditLog;
use App\Models\Characteristic;
use App\Models\ClimateItem;
use App\Models\EvidenceReview;
use App\Models\Organization;
use App\Models\SelfAssessment;
use App\Models\Stratum;
use App\Models\SurveyResponse;
use App\Models\Unit;
use App\Models\User;
use App\Models\ValidationRating;
use App\Models\ValidationSession;
use App\Services\SetupFactsCollector;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\BuildsAssessments;
use Tests\TestCase;

/**
 * Fase R6 (docs/01 M7, docs/12 temuan T1, T3, T4): penutupan survei, tinjauan partisipasi dan mutu data, temuan awal
 * dengan sel tersembunyi, sesi validasi dari rencana sampel, narasumber, nilai asesor, kunjungan fisik (D6), tinjauan
 * bukti, tautan penilaian mandiri lewat surel, dan syarat transisi tahap 3.
 */
class ValidationStageTest extends TestCase
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
    }

    private function moveTo(AssessmentStatus $status): void
    {
        $this->assessment->forceFill(['status' => $status])->save();
        $this->assessment->refresh();
    }

    private function characteristic(string $code): Characteristic
    {
        return Characteristic::where('instrument_version_id', $this->assessment->instrument_version_id)->where('code', $code)->firstOrFail();
    }

    /**
     * Jawaban survei anonim langsung ke basis data (alur kirim survei diuji di tes survei).
     *
     * @param  list<string>  $flags
     */
    private function response(Stratum $stratum, int $level, array $flags = []): string
    {
        $id = (string) Str::uuid();
        $unit = Unit::where('assessment_id', $this->assessment->id)->orderBy('name')->firstOrFail();
        DB::table('survey_responses')->insert([
            'id' => $id, 'assessment_id' => $this->assessment->id, 'unit_id' => $unit->id, 'stratum_id' => $stratum->id,
            'instrument_version_id' => $this->assessment->instrument_version_id, 'language' => 'id',
            'submitted_on' => now()->toDateString(), 'duration_bucket' => 'FROM_10_TO_15', 'quality_flags' => json_encode($flags),
        ]);
        foreach (Characteristic::where('instrument_version_id', $this->assessment->instrument_version_id)->pluck('id') as $cid) {
            DB::table('characteristic_answers')->insert(['id' => (string) Str::uuid(), 'survey_response_id' => $id, 'characteristic_id' => $cid, 'level' => $level]);
        }
        foreach (ClimateItem::query()->pluck('id') as $item) {
            DB::table('climate_answers')->insert(['id' => (string) Str::uuid(), 'survey_response_id' => $id, 'climate_item_id' => $item, 'value' => $level]);
        }

        return $id;
    }

    public function test_the_survey_can_be_closed_now_and_meets_the_condition(): void
    {
        $this->moveTo(AssessmentStatus::DataCollection);
        $this->assertFalse(SetupFactsCollector::for($this->assessment)->surveyClosed);

        $this->actingAs($this->assessor)->post(route('respondents.window.close', $this->assessment))->assertForbidden();
        $this->actingAs($this->lead)->post(route('respondents.window.close', $this->assessment))->assertRedirect();

        $this->assertTrue($this->assessment->fresh()->survey_closes_at->lessThanOrEqualTo(now()));
        $this->assertTrue(SetupFactsCollector::for($this->assessment->fresh())->surveyClosed);
        $this->assertSame(1, AuditLog::where('action', 'survey.close')->count());
    }

    public function test_data_quality_review_needs_a_justification_for_every_stratum_below_the_threshold(): void
    {
        $this->moveTo(AssessmentStatus::DataCollection);
        $strata = Stratum::where('assessment_id', $this->assessment->id)->orderBy('code')->get();
        $flagged = $this->response($strata[0], 3, ['TERLALU_CEPAT']);
        foreach (range(1, 5) as $_) {
            $this->response($strata[0], 4);
        }

        $this->actingAs($this->assessor)->get(route('data-quality.index', $this->assessment))->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('validation/data-quality')
                ->where('isLead', false)->where('canExclude', false)
                ->where('report.counts.analysed', 6)->where('report.counts.flagged', 1)
                ->has('report.flagged', 1)->missing('report.flagged.0.unitId')->missing('report.flagged.0.stratumId'));
        $this->actingAs($this->admin)->get(route('data-quality.index', $this->assessment))->assertForbidden();
        $this->actingAs($this->assessor)->put(route('data-quality.exclusion', [$this->assessment, $flagged]), ['excluded' => true, 'reason' => 'Terlalu cepat'])->assertForbidden();

        // Pengeluaran memerlukan alasan, tercatat, dan dapat dipulihkan.
        $this->actingAs($this->lead)->put(route('data-quality.exclusion', [$this->assessment, $flagged]), ['excluded' => true])->assertSessionHasErrors('reason');
        $this->actingAs($this->lead)->put(route('data-quality.exclusion', [$this->assessment, $flagged]), ['excluded' => true, 'reason' => 'Diisi kurang dari dua menit'])->assertRedirect();
        $this->assertTrue(SurveyResponse::find($flagged)->excluded);
        $this->actingAs($this->lead)->get(route('data-quality.index', $this->assessment))
            ->assertInertia(fn (Assert $page) => $page->where('report.counts.analysed', 5)->where('report.counts.excluded', 1));
        $this->assertSame(1, AuditLog::where('action', 'survey.exclude')->count());

        // Semua strata di bawah batas (tidak ada token selesai): tinjauan saja belum cukup.
        $this->actingAs($this->lead)->put(route('data-quality.review', $this->assessment), ['kind' => 'PARTICIPATION', 'note' => null])->assertRedirect();
        $this->assertFalse(SetupFactsCollector::for($this->assessment->fresh())->participationReviewed);
        $this->actingAs($this->lead)->put(route('data-quality.justify', $this->assessment), ['stratumId' => $strata[0]->id, 'justification' => 'Pendek'])->assertSessionHasErrors('justification');
        foreach ($strata as $s) {
            $this->actingAs($this->lead)->put(route('data-quality.justify', $this->assessment), [
                'stratumId' => $s->id, 'justification' => 'Proyek sedang mobilisasi sehingga sebagian pekerja belum hadir di lokasi.',
            ])->assertRedirect();
        }
        $this->assertTrue(SetupFactsCollector::for($this->assessment->fresh())->participationReviewed);
        $this->actingAs($this->lead)->put(route('data-quality.review', $this->assessment), ['kind' => 'DATA_QUALITY', 'note' => 'Satu jawaban dikeluarkan.'])->assertRedirect();
        $this->assertTrue(SetupFactsCollector::for($this->assessment->fresh())->dataQualityReviewed);
        $this->assertSame(5, AuditLog::where('action', 'participation.justify')->count());

        // Setelah rapat panel tinjauan dan pengeluaran ditutup.
        $this->moveTo(AssessmentStatus::PanelReview);
        $this->actingAs($this->lead)->put(route('data-quality.exclusion', [$this->assessment, $flagged]), ['excluded' => false])->assertStatus(409);
    }

    public function test_findings_hide_cells_below_the_minimum_and_never_show_levels(): void
    {
        $this->moveTo(AssessmentStatus::DataCollection);
        $strata = Stratum::where('assessment_id', $this->assessment->id)->orderBy('code')->get();
        foreach (range(1, 3) as $_) {
            $this->response($strata[0], 2);
        }

        $this->actingAs($this->assessor)->get(route('findings.index', $this->assessment))->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('validation/findings')
                ->where('findings.responses', 3)
                ->where('findings.characteristics.0.survey', null)
                ->where('findings.characteristics.0.suppressed', true)
                ->where('findings.climate.0.groups.MANAGEMENT.value', null)
                ->missing('findings.characteristics.0.level'));
        $this->actingAs($this->admin)->get(route('findings.index', $this->assessment))->assertForbidden();
        $outsider = $this->member(Organization::factory()->operator()->create(), Role::LeadAssessor);
        $this->actingAs($outsider)->get(route('findings.index', $this->assessment))->assertNotFound();
    }

    public function test_sessions_are_proposed_once_rated_by_each_assessor_and_gate_the_transitions(): void
    {
        $this->moveTo(AssessmentStatus::DataCollection);
        $this->actingAs($this->lead)->get(route('validation.index', $this->assessment))->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('validation/index')->where('canLead', true)->has('guides', 3)
                ->where('proposal.siteVisits', fn ($n) => $n >= 1));
        $this->actingAs($this->assessor)->post(route('validation.propose', $this->assessment))->assertForbidden();
        $this->actingAs($this->lead)->post(route('validation.propose', $this->assessment))->assertRedirect()->assertSessionHas('status', 'sessionsCreated');
        $this->actingAs($this->lead)->post(route('validation.propose', $this->assessment))->assertStatus(409);
        $this->assertTrue(ValidationSession::where('assessment_id', $this->assessment->id)->where('type', SessionProposal::SITE_VISIT)->exists());
        $this->assertSame(1, AuditLog::where('action', 'validation.sessions_proposed')->count());

        // Rencana tersusun bila ada wawancara atau diskusi dengan karakteristik fokus dan satu kunjungan fisik.
        $k11 = $this->characteristic('K1.1');
        $k21 = $this->characteristic('K2.1');
        $talk = ValidationSession::where('assessment_id', $this->assessment->id)->whereIn('type', [SessionProposal::INTERVIEW, SessionProposal::FOCUS_GROUP])->firstOrFail();
        $this->actingAs($this->assessor)->put(route('validation.sessions.update', [$this->assessment, $talk->id]), [
            'label' => $talk->label, 'layer' => $talk->layer, 'unitId' => null, 'stratumId' => $talk->stratum_id,
            'scheduledAt' => now('Asia/Jakarta')->addDay()->format('Y-m-d\TH:i'), 'meetingUrl' => 'http://rapat.contoh.test/abc',
            'location' => null, 'participantCount' => 4, 'focus' => [$k11->id, $k21->id], 'status' => 'SCHEDULED',
        ])->assertSessionHasErrors('meetingUrl');
        $this->actingAs($this->assessor)->put(route('validation.sessions.update', [$this->assessment, $talk->id]), [
            'label' => $talk->label, 'layer' => $talk->layer, 'unitId' => null, 'stratumId' => $talk->stratum_id,
            'scheduledAt' => now('Asia/Jakarta')->addDay()->format('Y-m-d\TH:i'), 'meetingUrl' => 'https://rapat.contoh.test/abc',
            'location' => null, 'participantCount' => 4, 'focus' => [$k11->id, $k21->id], 'status' => 'SCHEDULED',
        ])->assertRedirect();
        $this->assertTrue(SetupFactsCollector::for($this->assessment->fresh())->validationPlanSet);

        // Narasumber disimpan terpisah; diskusi kelompok paling banyak delapan peserta.
        $this->actingAs($this->assessor)->post(route('validation.participants.store', [$this->assessment, $talk->id]), ['name' => 'Budi Santoso', 'position' => 'Mandor'])->assertRedirect();
        $this->assertSame(1, $talk->participants()->count());
        $group = ValidationSession::create(['assessment_id' => $this->assessment->id, 'type' => SessionProposal::FOCUS_GROUP, 'label' => 'Diskusi uji', 'layer' => 'FIELD', 'focus_characteristic_ids' => [$k11->id]]);
        foreach (range(1, 8) as $i) {
            $group->participants()->create(['full_name' => "Peserta {$i}", 'position' => 'Tukang']);
        }
        $this->actingAs($this->assessor)->post(route('validation.participants.store', [$this->assessment, $group->id]), ['name' => 'Peserta 9', 'position' => 'Tukang'])->assertSessionHasErrors('name');

        // Nilai hanya pada tahap validasi dan penilaian, kelipatan 0,5, milik masing-masing asesor.
        $form = fn (float $level) => ['recordingConsent' => true, 'notes' => 'Prosedur dikenal pekerja.', 'ratings' => [['characteristicId' => $k11->id, 'level' => $level, 'note' => 'Contoh nyata disebut']]];
        $this->actingAs($this->assessor)->put(route('validation.sessions.form', [$this->assessment, $talk->id]), $form(3.5))->assertStatus(409);
        $this->moveTo(AssessmentStatus::Validation);
        $this->actingAs($this->assessor)->put(route('validation.sessions.form', [$this->assessment, $talk->id]), $form(3.3))->assertSessionHasErrors('ratings');
        $this->actingAs($this->assessor)->put(route('validation.sessions.form', [$this->assessment, $talk->id]), $form(3.5))->assertRedirect();
        $this->actingAs($this->lead)->put(route('validation.sessions.form', [$this->assessment, $talk->id]), $form(4.0))->assertRedirect();
        $this->assertEqualsCanonicalizing([3.5, 4.0], ValidationRating::where('validation_session_id', $talk->id)->pluck('level')->all());
        $this->actingAs($this->assessor)->get(route('validation.sessions.show', [$this->assessment, $talk->id]))
            ->assertInertia(fn (Assert $page) => $page->component('validation/session')->where("session.ratings.{$k11->id}.level", 3.5)->where('session.raters', 2)
                ->where('session.participants.0.name', 'Budi Santoso'));

        // Semua sesi aktif selesai dan satu kunjungan fisik selesai.
        $facts = SetupFactsCollector::for($this->assessment->fresh());
        $this->assertFalse($facts->validationSessionsCompleted);
        $this->assertFalse($facts->siteVisitCompleted);
        ValidationSession::where('assessment_id', $this->assessment->id)->where('id', '!=', $talk->id)->update(['status' => 'CANCELLED']);
        ValidationSession::whereKey($talk->id)->update(['status' => 'COMPLETED']);
        $this->assertTrue(SetupFactsCollector::for($this->assessment->fresh())->validationSessionsCompleted);
        $this->assertFalse(SetupFactsCollector::for($this->assessment->fresh())->siteVisitCompleted);
        ValidationSession::where('assessment_id', $this->assessment->id)->where('type', SessionProposal::SITE_VISIT)->limit(1)->update(['status' => 'COMPLETED']);
        $this->assertTrue(SetupFactsCollector::for($this->assessment->fresh())->siteVisitCompleted);

        $this->assertSame(2, AuditLog::where('action', 'validation.rating_save')->count());
        $this->assertSame(1, AuditLog::where('action', 'validation.participant_add')->count());
        $this->actingAs($this->admin)->get(route('validation.index', $this->assessment))->assertForbidden();
    }

    public function test_assessors_mark_evidence_as_reviewed_per_characteristic(): void
    {
        $this->moveTo(AssessmentStatus::Validation);
        $k11 = $this->characteristic('K1.1');

        $this->actingAs($this->admin)->put(route('evidence.reviews', [$this->assessment, $k11->id]), ['reviewed' => true])->assertForbidden();
        $this->actingAs($this->assessor)->put(route('evidence.reviews', [$this->assessment, $k11->id]), ['reviewed' => true, 'note' => 'Dua jenis bukti cocok.'])->assertRedirect();
        $this->assertSame(1, EvidenceReview::where('assessment_id', $this->assessment->id)->count());
        $this->actingAs($this->lead)->get(route('evidence.index', $this->assessment))
            ->assertInertia(fn (Assert $page) => $page->where('canReview', true)->where("reviews.{$k11->id}.note", 'Dua jenis bukti cocok.'));
        $this->actingAs($this->admin)->get(route('evidence.index', $this->assessment))
            ->assertInertia(fn (Assert $page) => $page->where('canReview', false)->where('reviews', []));

        $facts = SetupFactsCollector::for($this->assessment->fresh());
        $this->assertSame(1, $facts->characteristicsReviewed);
        $this->assertGreaterThan(1, $facts->characteristicCount);

        $this->actingAs($this->assessor)->put(route('evidence.reviews', [$this->assessment, $k11->id]), ['reviewed' => false])->assertRedirect();
        $this->assertSame(0, EvidenceReview::count());
        $this->assertSame(1, AuditLog::where('action', 'evidence.review_withdraw')->count());
    }

    public function test_self_assessment_links_are_sent_by_email_and_pending_links_block_validation(): void
    {
        Mail::fake();
        $unit = Unit::where('assessment_id', $this->assessment->id)->orderBy('name')->firstOrFail();
        $this->actingAs($this->admin)->post(route('self-assessments.store', $this->assessment), ['name' => 'Siti Aminah', 'position' => 'Manajer Proyek', 'unit_id' => $unit->id])->assertRedirect();
        $sa = SelfAssessment::sole();
        $oldToken = $sa->access_token_id;

        $this->actingAs($this->admin)->post(route('self-assessments.email', [$this->assessment, $sa->id]), ['email' => 'bukan-surel'])->assertSessionHasErrors('email');
        $this->actingAs($this->lead)->post(route('self-assessments.email', [$this->assessment, $sa->id]), ['email' => 'siti@contoh.test'])->assertForbidden();
        $this->actingAs($this->admin)->post(route('self-assessments.email', [$this->assessment, $sa->id]), ['email' => 'Siti@Contoh.test'])
            ->assertRedirect()->assertSessionHas('status', 'emailQueued');

        Mail::assertSent(SurveyMail::class, fn (SurveyMail $m) => $m->kind === 'selfAssessment' && $m->hasTo('siti@contoh.test') && $m->link !== null);
        $sa->refresh();
        $this->assertNotSame($oldToken, $sa->access_token_id);
        $this->assertNotNull(AccessToken::find($oldToken)->revoked_at);
        $this->assertSame('siti@contoh.test', $sa->respondent_email);
        // Alamat terenkripsi di basis data dan tidak ditulis ke jejak audit.
        $this->assertStringNotContainsString('siti@contoh.test', (string) DB::table('self_assessments')->where('id', $sa->id)->value('respondent_email'));
        $this->assertFalse(AuditLog::whereRaw('changes::text ilike ?', ['%siti@contoh.test%'])->exists());

        // Tautan aktif yang belum dikirim menahan syarat; setelah dikirim, syarat terpenuhi.
        $facts = SetupFactsCollector::for($this->assessment->fresh());
        $this->assertSame(1, $facts->selfAssessmentsPending);
        $sa->forceFill(['status' => 'SUBMITTED', 'submitted_at' => now()])->save();
        $facts = SetupFactsCollector::for($this->assessment->fresh());
        $this->assertSame(0, $facts->selfAssessmentsPending);
        $this->assertSame(1, $facts->selfAssessmentsSubmitted);
    }
}
