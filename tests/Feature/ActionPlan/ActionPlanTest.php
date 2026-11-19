<?php

namespace Tests\Feature\ActionPlan;

use App\Domain\Access\Role;
use App\Domain\Workflow\AssessmentStatus;
use App\Mail\ActionReminderMail;
use App\Models\ActionItem;
use App\Models\Assessment;
use App\Models\AuditLog;
use App\Models\Characteristic;
use App\Models\ClimateItem;
use App\Models\EvidenceRating;
use App\Models\GapItem;
use App\Models\Stratum;
use App\Models\Unit;
use App\Models\UnitAssignment;
use App\Models\User;
use App\Services\Scoring\ScoringService;
use App\Services\SetupFactsCollector;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\BuildsAssessments;
use Tests\TestCase;

/**
 * Fase R9 (docs/01 M10): daftar kesenjangan dari hasil final, analisis penyebab, tindakan dengan penanggung jawab
 * dan tenggat, penerbitan, cakupan unit koordinator, pembaruan kemajuan, verifikasi asesor, tinjauan triwulan, dan
 * pengingat tenggat.
 */
class ActionPlanTest extends TestCase
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
        $unit = Unit::where('assessment_id', $this->assessment->id)->orderBy('name')->firstOrFail();
        foreach (range(1, 6) as $i) {
            $id = (string) Str::uuid();
            DB::table('survey_responses')->insert([
                'id' => $id, 'assessment_id' => $this->assessment->id, 'unit_id' => $unit->id, 'stratum_id' => $strata[$i % 2]->id,
                'instrument_version_id' => $this->assessment->instrument_version_id, 'language' => 'id',
                'submitted_on' => now()->toDateString(), 'duration_bucket' => 'FROM_10_TO_15', 'quality_flags' => '[]',
            ]);
            foreach ($this->characteristicIds() as $cid) {
                DB::table('characteristic_answers')->insert(['id' => (string) Str::uuid(), 'survey_response_id' => $id, 'characteristic_id' => $cid, 'level' => 3]);
            }
            foreach (ClimateItem::query()->pluck('id') as $item) {
                DB::table('climate_answers')->insert(['id' => (string) Str::uuid(), 'survey_response_id' => $id, 'climate_item_id' => $item, 'value' => 3]);
            }
        }
        $this->assessment->forceFill(['status' => AssessmentStatus::Scoring])->save();
        foreach ($this->characteristicIds() as $cid) {
            foreach ([$this->lead, $this->assessor] as $rater) {
                EvidenceRating::create(['assessment_id' => $this->assessment->id, 'characteristic_id' => $cid, 'assessor_id' => $rater->id, 'level' => 3.0, 'rationale' => 'Bukti cukup dan konsisten di lapangan.']);
            }
        }
        $this->actingAs($this->lead);
        $service = app(ScoringService::class);
        $service->run($this->assessment->fresh(), $this->lead, Role::LeadAssessor);
        $this->assessment->forceFill(['status' => AssessmentStatus::PanelReview])->save();
        $service->finalize($this->assessment->fresh(), $this->lead, Role::LeadAssessor);
        $this->assessment->forceFill(['status' => AssessmentStatus::ActionPlanning])->save();
        $this->assessment->refresh();
    }

    /** @return list<string> */
    private function characteristicIds(): array
    {
        return Characteristic::where('instrument_version_id', $this->assessment->instrument_version_id)->orderBy('position')->pluck('id')->all();
    }

    /** @return array<string, mixed> */
    private function action(array $overrides = []): array
    {
        return [
            'title' => 'Pelatihan pelaporan bahaya untuk mandor', 'description' => null, 'ownerName' => 'Hendra Gunawan',
            'ownerPosition' => 'Manajer K3', 'ownerEmail' => null, 'unitId' => null, 'dueDate' => now()->addDays(30)->toDateString(),
            'successIndicator' => 'Sembilan puluh persen mandor mengikuti pelatihan.', ...$overrides,
        ];
    }

    public function test_the_gap_list_is_formed_at_finalization_and_published_only_when_complete(): void
    {
        $gaps = GapItem::where('assessment_id', $this->assessment->id)->orderBy('rank')->get();
        $this->assertCount(18, $gaps);
        $this->assertTrue($gaps->last()->is_contextual);
        $this->assertGreaterThanOrEqual($gaps[1]->priority_score, $gaps[0]->priority_score);
        $this->assertSame(1, AuditLog::where('action', 'gap.generate')->count());

        $this->actingAs($this->admin)->get(route('gaps.index', $this->assessment))->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('results/gaps')->where('canAct', true)->where('canPublish', true)
                ->has('plan.gaps', 18)->has('plan.incomplete', 18));
        $viewer = $this->member($this->client, Role::ExecutiveViewer);
        $this->actingAs($viewer)->get(route('gaps.index', $this->assessment))->assertInertia(fn (Assert $page) => $page->where('canAct', false)->where('canPublish', false));

        $this->actingAs($this->admin)->post(route('gaps.publish', $this->assessment))->assertSessionHasErrors('form');
        foreach ($gaps as $gap) {
            $this->actingAs($this->assessor)->put(route('gaps.analyse', [$this->assessment, $gap->id]), ['rootCause' => 'Pengawas belum menindaklanjuti laporan secara konsisten.', 'priority' => 'HIGH'])->assertRedirect();
            $this->actingAs($this->admin)->post(route('actions.store', [$this->assessment, $gap->id]), $this->action())->assertRedirect();
        }
        $this->actingAs($viewer)->post(route('gaps.publish', $this->assessment))->assertForbidden();
        $this->actingAs($this->admin)->post(route('gaps.publish', $this->assessment))->assertRedirect()->assertSessionHas('status', 'published');
        $this->assertTrue(SetupFactsCollector::for($this->assessment->fresh())->actionPlanPublished);
        $this->assertSame(1, AuditLog::where('action', 'action_plan.publish')->count());
        $this->assertSame(18, AuditLog::where('action', 'action.create')->count());
    }

    public function test_unit_coordinators_manage_only_actions_of_their_units(): void
    {
        $coordinator = $this->member($this->client, Role::UnitCoordinator);
        $units = Unit::where('assessment_id', $this->assessment->id)->orderBy('name')->get();
        UnitAssignment::create(['assessment_id' => $this->assessment->id, 'unit_id' => $units[0]->id, 'user_id' => $coordinator->id]);
        $gap = GapItem::where('assessment_id', $this->assessment->id)->orderBy('rank')->firstOrFail();

        $this->actingAs($coordinator)->post(route('actions.store', [$this->assessment, $gap->id]), $this->action())->assertSessionHasErrors('unitId');
        $this->actingAs($coordinator)->post(route('actions.store', [$this->assessment, $gap->id]), $this->action(['unitId' => $units[1]->id]))->assertSessionHasErrors('unitId');
        $this->actingAs($coordinator)->post(route('actions.store', [$this->assessment, $gap->id]), $this->action(['unitId' => $units[0]->id]))->assertRedirect();
        $this->actingAs($coordinator)->put(route('gaps.analyse', [$this->assessment, $gap->id]), ['rootCause' => 'Tidak berhak', 'priority' => null])->assertForbidden();
        $this->actingAs($coordinator)->get(route('gaps.index', $this->assessment))
            ->assertInertia(fn (Assert $page) => $page->where('scoped', true)->has('units', 1)->where('plan.gaps.0.actions.0.editable', true));
    }

    public function test_progress_is_verified_by_assessors_and_monitoring_closes_with_a_closing_review(): void
    {
        $gap = GapItem::where('assessment_id', $this->assessment->id)->orderBy('rank')->firstOrFail();
        $this->actingAs($this->admin)->post(route('actions.store', [$this->assessment, $gap->id]), $this->action(['ownerEmail' => 'Hendra@Contoh.test']))->assertRedirect();
        $action = ActionItem::sole();
        $this->assertSame('hendra@contoh.test', $action->owner_email);
        $this->assertStringNotContainsString('hendra@contoh.test', (string) DB::table('action_items')->value('owner_email'));

        $this->actingAs($this->assessor)->post(route('actions.verify', [$this->assessment, $action->id]), ['approve' => true, 'note' => 'Belum selesai dikerjakan.'])->assertStatus(409);
        $this->actingAs($this->admin)->post(route('actions.progress', [$this->assessment, $action->id]), ['note' => 'Pelatihan selesai untuk semua mandor.', 'progress' => 80, 'status' => 'DONE'])->assertRedirect();
        $this->assertSame(100, $action->fresh()->progress_percent);
        $this->actingAs($this->admin)->post(route('actions.verify', [$this->assessment, $action->id]), ['approve' => true, 'note' => 'Daftar hadir sudah diperiksa.'])->assertForbidden();
        $this->actingAs($this->assessor)->post(route('actions.verify', [$this->assessment, $action->id]), ['approve' => true, 'note' => 'Daftar hadir dan materi sudah diperiksa.'])->assertRedirect();
        $this->assertSame('VERIFIED', $action->fresh()->status);
        $this->actingAs($this->admin)->put(route('actions.update', [$this->assessment, $action->id]), $this->action())->assertStatus(409);

        $this->actingAs($this->assessor)->get(route('monitoring.index', $this->assessment))->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('results/monitoring')->where('monitoring.summary.verified', 1)->has('monitoring.actions.0.updates', 2));
        $this->actingAs($this->assessor)->put(route('monitoring.review', $this->assessment), ['quarter' => '2026-Q4', 'summary' => 'Semua tindakan terverifikasi sesuai rencana.', 'closing' => true])->assertStatus(409);
        $this->assessment->forceFill(['status' => AssessmentStatus::Monitoring])->save();
        $this->assertFalse(SetupFactsCollector::for($this->assessment->fresh())->monitoringClosed);
        $this->actingAs($this->admin)->put(route('monitoring.review', $this->assessment), ['quarter' => '2026-Q4', 'summary' => 'Semua tindakan terverifikasi sesuai rencana.', 'closing' => true])->assertForbidden();
        $this->actingAs($this->assessor)->put(route('monitoring.review', $this->assessment), ['quarter' => '2026-Q4', 'summary' => 'Semua tindakan terverifikasi sesuai rencana.', 'closing' => true])->assertRedirect();
        $this->assertTrue(SetupFactsCollector::for($this->assessment->fresh())->monitoringClosed);
        $this->assertSame(1, AuditLog::where('action', 'action.verify')->count());
        $this->assertSame(1, AuditLog::where('action', 'monitoring.review')->count());
    }

    public function test_deadline_reminders_go_weekly_to_owners_and_client_admins_after_publication(): void
    {
        Mail::fake();
        $gap = GapItem::where('assessment_id', $this->assessment->id)->orderBy('rank')->firstOrFail();
        $this->actingAs($this->admin)->post(route('actions.store', [$this->assessment, $gap->id]), $this->action(['ownerEmail' => 'hendra@contoh.test', 'dueDate' => now('Asia/Jakarta')->addDays(3)->toDateString()]))->assertRedirect();

        $this->artisan('nscas:action-reminders')->assertSuccessful();
        Mail::assertNothingSent();

        $this->assessment->forceFill(['action_plan_published_at' => now()])->save();
        $this->artisan('nscas:action-reminders')->assertSuccessful();
        Mail::assertSent(ActionReminderMail::class, 2);
        Mail::assertSent(ActionReminderMail::class, fn (ActionReminderMail $m) => $m->hasTo('hendra@contoh.test') && count($m->items) === 1);
        Mail::assertSent(ActionReminderMail::class, fn (ActionReminderMail $m) => $m->hasTo($this->admin->email));
        $this->assertNotNull(ActionItem::sole()->last_reminder_at);

        $this->artisan('nscas:action-reminders')->assertSuccessful();
        Mail::assertSent(ActionReminderMail::class, 2);
        $this->assertFalse(AuditLog::whereRaw('changes::text ilike ?', ['%hendra@contoh.test%'])->exists());
    }
}
