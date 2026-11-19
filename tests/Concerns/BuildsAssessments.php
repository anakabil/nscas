<?php

namespace Tests\Concerns;

use App\Domain\Access\Role;
use App\Domain\Setup\EditableParameters;
use App\Models\Assessment;
use App\Models\InstrumentVersion;
use App\Models\Organization;
use App\Models\User;
use App\Services\AssessmentSetup;
use Database\Seeders\InstrumentVersionSeeder;
use Illuminate\Support\Facades\Auth;

/** Pembuat data uji fase R1: organisasi, akun berperan, dan asesmen yang dibuat lewat layanan sungguhan. */
trait BuildsAssessments
{
    protected Organization $operator;

    protected Organization $client;

    protected function setUpAssessmentWorld(): void
    {
        config(['nscas.enforce_two_factor' => false]);
        $this->seed(InstrumentVersionSeeder::class);
        $this->operator = Organization::factory()->operator()->create();
        $this->client = Organization::factory()->create(['name' => 'PT Konstruksi Uji']);
    }

    protected function member(Organization $organization, Role $role): User
    {
        $user = User::factory()->create();
        $user->memberships()->create(['organization_id' => $organization->id, 'role' => $role]);

        return $user->fresh();
    }

    protected function instrumentId(): string
    {
        return InstrumentVersion::firstOrFail()->id;
    }

    /** @return array<string, mixed> */
    protected function newAssessmentInput(array $overrides = []): array
    {
        return [
            'organization_id' => $this->client->id,
            'name' => 'Asesmen Budaya K3 Uji',
            'scope_type' => 'CORPORATE',
            'period_start' => now()->addDays(10)->toDateString(),
            'period_end' => now()->addDays(100)->toDateString(),
            'target_level' => 4,
            'instrument_version_id' => $this->instrumentId(),
            ...$overrides,
        ];
    }

    protected function createAssessment(User $lead, array $overrides = []): Assessment
    {
        Auth::login($lead);
        $assessment = app(AssessmentSetup::class)->create($lead, $this->newAssessmentInput($overrides));
        Auth::logout();

        return $assessment->fresh();
    }

    /** Lengkapi seluruh syarat perencanaan lewat layanan: unit, populasi, tim, parameter, sampel, komunikasi awal. */
    protected function completePlanning(Assessment $assessment, User $lead, User $assessor): Assessment
    {
        Auth::login($lead);
        $setup = app(AssessmentSetup::class);
        $setup->createUnit($assessment, ['name' => 'Kantor Pusat', 'type' => 'HEAD_OFFICE', 'parent_id' => null]);
        $setup->createUnit($assessment, ['name' => 'Proyek Gedung A', 'type' => 'PROJECT', 'parent_id' => null, 'latitude' => -6.2, 'longitude' => 106.8, 'radius_meters' => 300]);
        $setup->updatePopulations($assessment, $assessment->strata()->pluck('id')->mapWithKeys(fn ($id, $i) => [$id => 100 * ($i + 1)])->all());
        $setup->addTeamMember($assessment, $assessor->id, Role::Assessor, Role::LeadAssessor);
        $draft = $assessment->fresh()->parameter_draft;
        $setup->updateParameters($assessment, EditableParameters::editablePart($draft), [
            'consent_text_id' => $assessment->fresh()->consent_text_id,
            'consent_text_en' => $assessment->fresh()->consent_text_en,
            'dpa_status' => 'SIGNED',
            'dpa_reference' => 'PPD-001',
            'dpa_signed_on' => now()->toDateString(),
        ]);
        $setup->saveSamplePlan($assessment, 1, 2);
        $setup->updateKickoff($assessment, [
            'leadership' => ['date' => now()->toDateString(), 'leader' => 'Direktur Utama', 'note' => null],
            'briefing' => ['date' => now()->toDateString(), 'channels' => ['SAFETY_TALK'], 'note' => 'Penjelasan tujuan dan kerahasiaan'],
        ]);
        $setup->recordCalibration($assessment, ['date' => now()->toDateString(), 'note' => null, 'attendees' => [$lead->id, $assessor->id]]);
        Auth::logout();

        return $assessment->fresh();
    }
}
