<?php

namespace App\Services;

use App\Domain\Access\Role;
use App\Domain\Scoring\SampleCalculator;
use App\Domain\Setup\ConditionEvaluator;
use App\Domain\Setup\ConsentTemplate;
use App\Domain\Setup\DpaStatus;
use App\Domain\Setup\EditableParameters;
use App\Domain\Setup\UnitTree;
use App\Domain\Setup\UnitType;
use App\Domain\Workflow\AssessmentStatus;
use App\Domain\Workflow\Workflow;
use App\Models\Assessment;
use App\Models\AssessmentTeamMember;
use App\Models\InstrumentVersion;
use App\Models\Organization;
use App\Models\Stratum;
use App\Models\Unit;
use App\Models\User;
use App\Support\Audit;
use App\Support\RuleViolation;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * Layanan konfigurasi asesmen dan transisi status (docs/01 M1 dan bagian 3), dibawa dari v1
 * src/lib/assessments/service.ts. Pemanggil sudah memeriksa hak akses. Setiap perubahan berjalan dalam transaksi,
 * baris asesmen dikunci lebih dulu (FOR UPDATE) agar status tidak berubah di tengah jalan, dan dicatat di jejak audit.
 */
final class AssessmentSetup
{
    // -----------------------------------------------------------------------------------------------------------------
    // Pembuatan dan rincian
    // -----------------------------------------------------------------------------------------------------------------

    /**
     * Asesmen baru berstatus draf. Pembuatnya menjadi asesor utama asesmen itu, dan lima strata bawaan disiapkan
     * dengan populasi kosong.
     *
     * @param  array{organization_id: string, name: string, scope_type: string, period_start: string, period_end: string, target_level: int, instrument_version_id: string}  $input
     */
    public function create(User $actor, array $input): Assessment
    {
        $organization = Organization::findOrFail($input['organization_id']);
        if ($organization->is_operator || ! $organization->is_active) {
            throw RuleViolation::invalid('organization_id', 'OPERATOR_ORGANIZATION');
        }
        $version = $this->publishedVersion($input['instrument_version_id']);
        $draft = EditableParameters::draftFromDefaults($version->default_parameters);

        return DB::transaction(function () use ($actor, $input, $organization, $version, $draft) {
            $assessment = Assessment::create([
                ...$input,
                'instrument_version_id' => $version->id,
                'parameter_draft' => $draft,
                'created_by' => $actor->id,
                ...$this->consentTexts($organization, $draft),
            ]);
            foreach ($draft['defaultStrata'] ?? [] as $stratum) {
                $assessment->strata()->create([
                    'code' => $stratum['code'],
                    'name' => $stratum['name'],
                    'group' => $stratum['group'],
                    'is_contractor' => (bool) $stratum['isContractor'],
                    'population' => 0,
                ]);
            }
            $assessment->team()->create(['user_id' => $actor->id, 'role' => Role::LeadAssessor]);
            Audit::record('assessment.create', $assessment, ['after' => $input, 'instrumentVersion' => $version->code], actorRole: Role::LeadAssessor);

            return $assessment;
        });
    }

    /** @param  array{name: string, scope_type: string, period_start: string, period_end: string, target_level: int, instrument_version_id: string}  $input */
    public function updateDetails(Assessment $assessment, array $input): void
    {
        DB::transaction(function () use ($assessment, $input) {
            $locked = $this->lockEditable($assessment);
            $before = $locked->only(['name', 'scope_type', 'period_start', 'period_end', 'target_level', 'instrument_version_id']);
            $data = $input;
            // Mengganti versi instrumen mengatur ulang parameter ke bawaan versi tersebut.
            if ($input['instrument_version_id'] !== $locked->instrument_version_id) {
                $version = $this->publishedVersion($input['instrument_version_id']);
                $data['parameter_draft'] = EditableParameters::draftFromDefaults($version->default_parameters);
            }
            $locked->update($data);
            Audit::record('assessment.update', $locked, ['before' => $this->plain($before), 'after' => $input], actorRole: Role::LeadAssessor);
        });
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Unit
    // -----------------------------------------------------------------------------------------------------------------

    /** @param  array{name: string, type: string, parent_id: string|null, latitude?: float|null, longitude?: float|null, radius_meters?: int|null}  $input */
    public function createUnit(Assessment $assessment, array $input): Unit
    {
        return DB::transaction(function () use ($assessment, $input) {
            $locked = $this->lockOpen($assessment);
            $data = $this->unitData($locked, $input);
            $unit = $locked->units()->create($data);
            $this->invalidateSamplePlan($locked);
            Audit::record('unit.create', $unit, ['after' => $data], $locked, Role::LeadAssessor);

            return $unit;
        });
    }

    /** @param  array{name: string, type: string, parent_id: string|null, latitude?: float|null, longitude?: float|null, radius_meters?: int|null}  $input */
    public function updateUnit(Assessment $assessment, Unit $unit, array $input): void
    {
        DB::transaction(function () use ($assessment, $unit, $input) {
            $locked = $this->lockOpen($assessment);
            $data = $this->unitData($locked, $input);
            $tree = $locked->units()->get(['id', 'parent_id'])
                ->map(fn (Unit $u) => ['id' => $u->id, 'parentId' => $u->parent_id])->all();
            if (UnitTree::wouldCreateCycle($tree, $unit->id, $data['parent_id'])) {
                throw RuleViolation::invalid('parent_id', 'UNIT_CYCLE');
            }
            $before = $unit->only(array_keys($data));
            $unit->update($data);
            if ($before['type'] !== $unit->type) {
                $this->invalidateSamplePlan($locked);
            }
            Audit::record('unit.update', $unit, ['before' => $this->plain($before), 'after' => $data], $locked, Role::LeadAssessor);
        });
    }

    public function deleteUnit(Assessment $assessment, Unit $unit): void
    {
        DB::transaction(function () use ($assessment, $unit) {
            $locked = $this->lockOpen($assessment);
            if (Unit::where('parent_id', $unit->id)->exists()) {
                throw RuleViolation::invalid('unit', 'UNIT_HAS_CHILDREN');
            }
            try {
                $unit->delete();
            } catch (QueryException) { // @phpstan-ignore catch.neverThrown (pelanggaran kunci asing terjadi di basis data)
                // Unit yang sudah dirujuk data lain (responden, token, bukti) tidak dapat dihapus.
                throw RuleViolation::invalid('unit', 'UNIT_IN_USE');
            }
            $this->invalidateSamplePlan($locked);
            Audit::record('unit.delete', $unit, ['before' => ['name' => $unit->name, 'type' => $unit->type->value]], $locked, Role::LeadAssessor);
        });
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Strata
    // -----------------------------------------------------------------------------------------------------------------

    /** @param  array{code: string, name: string, group: string, population: int, is_contractor: bool}  $input */
    public function createStratum(Assessment $assessment, array $input): void
    {
        DB::transaction(function () use ($assessment, $input) {
            $locked = $this->lockEditable($assessment);
            $this->assertStratumCodeFree($locked, $input['code']);
            $stratum = $locked->strata()->create($input);
            $this->invalidateSamplePlan($locked);
            Audit::record('stratum.create', $stratum, ['after' => $input], $locked, Role::LeadAssessor);
        });
    }

    /** @param  array{code: string, name: string, group: string, population: int, is_contractor: bool}  $input */
    public function updateStratum(Assessment $assessment, Stratum $stratum, array $input): void
    {
        DB::transaction(function () use ($assessment, $stratum, $input) {
            $locked = $this->lockEditable($assessment);
            $this->assertStratumCodeFree($locked, $input['code'], $stratum->id);
            $before = $stratum->only(array_keys($input));
            $stratum->update($input);
            $this->invalidateSamplePlan($locked);
            Audit::record('stratum.update', $stratum, ['before' => $this->plain($before), 'after' => $input], $locked, Role::LeadAssessor);
        });
    }

    /** @param  array<string, int>  $populations  Populasi per id strata. */
    public function updatePopulations(Assessment $assessment, array $populations): void
    {
        DB::transaction(function () use ($assessment, $populations) {
            $locked = $this->lockEditable($assessment);
            $before = [];
            $after = [];
            foreach ($locked->strata()->get() as $stratum) {
                if (array_key_exists($stratum->id, $populations) && $populations[$stratum->id] !== $stratum->population) {
                    $before[$stratum->code] = $stratum->population;
                    $after[$stratum->code] = $populations[$stratum->id];
                    $stratum->update(['population' => $populations[$stratum->id]]);
                }
            }
            if ($after === []) {
                return;
            }
            $this->invalidateSamplePlan($locked);
            Audit::record('stratum.populations', $locked, ['before' => $before, 'after' => $after], actorRole: Role::LeadAssessor);
        });
    }

    public function deleteStratum(Assessment $assessment, Stratum $stratum): void
    {
        DB::transaction(function () use ($assessment, $stratum) {
            $locked = $this->lockEditable($assessment);
            try {
                $stratum->delete();
            } catch (QueryException) { // @phpstan-ignore catch.neverThrown (pelanggaran kunci asing terjadi di basis data)
                throw RuleViolation::invalid('stratum', 'STRATUM_IN_USE');
            }
            $this->invalidateSamplePlan($locked);
            Audit::record('stratum.delete', $stratum, ['before' => ['code' => $stratum->code, 'population' => $stratum->population]], $locked, Role::LeadAssessor);
        });
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Parameter, persetujuan, perjanjian pemrosesan data, dan kalkulator sampel
    // -----------------------------------------------------------------------------------------------------------------

    /**
     * @param  array<string, mixed>  $edits  Bagian parameter yang dapat diubah.
     * @param  array{consent_text_id: string, consent_text_en: string, dpa_status: string, dpa_reference: string|null, dpa_signed_on: string|null}  $agreement
     */
    public function updateParameters(Assessment $assessment, array $edits, array $agreement): void
    {
        foreach (EditableParameters::errors($edits) as $field => $key) {
            throw RuleViolation::invalid($field, $key);
        }
        if ($agreement['dpa_status'] === DpaStatus::Signed->value && empty($agreement['dpa_signed_on'])) {
            throw RuleViolation::invalid('dpa_signed_on', 'DPA_DATE_REQUIRED');
        }
        DB::transaction(function () use ($assessment, $edits, $agreement) {
            $locked = $this->lockEditable($assessment);
            $draft = $this->draftOf($locked);
            $next = EditableParameters::apply($draft, $edits);
            $before = ['parameters' => EditableParameters::editablePart($draft), 'dpaStatus' => $locked->dpa_status->value];
            $locked->update([
                'parameter_draft' => $next,
                'consent_text_id' => trim($agreement['consent_text_id']),
                'consent_text_en' => trim($agreement['consent_text_en']),
                'dpa_status' => $agreement['dpa_status'],
                'dpa_reference' => $agreement['dpa_reference'] ?: null,
                'dpa_signed_on' => $agreement['dpa_status'] === DpaStatus::Signed->value ? $agreement['dpa_signed_on'] : null,
            ]);
            Audit::record('assessment.parameters_update', $locked, [
                'before' => $before,
                'after' => ['parameters' => $edits, 'dpaStatus' => $agreement['dpa_status'], 'dpaReference' => $agreement['dpa_reference']],
                'consentChanged' => $locked->wasChanged(['consent_text_id', 'consent_text_en']),
                'samplePlanInvalidated' => ! empty($draft['samplePlan']) && empty($next['samplePlan']),
            ], actorRole: Role::LeadAssessor);
        });
    }

    /** Menjalankan kalkulator sampel di server dari populasi strata tersimpan, lalu menyimpan hasilnya di draf. */
    public function saveSamplePlan(Assessment $assessment, int $projects, int $locations): void
    {
        DB::transaction(function () use ($assessment, $projects, $locations) {
            $locked = $this->lockEditable($assessment);
            $draft = $this->draftOf($locked);
            $strata = $locked->strata()->get(['code', 'name', 'population'])
                ->map(fn (Stratum $s) => ['code' => $s->code, 'name' => $s->name, 'population' => $s->population])->all();
            $workers = array_sum(array_column($strata, 'population'));
            if ($workers < 1) {
                throw RuleViolation::invalid('projects', 'NO_POPULATION');
            }
            $sampling = $draft['sampling'];
            $result = SampleCalculator::samplePlan(
                workers: $workers,
                projects: $projects,
                locations: $locations,
                strata: $strata,
                z: (float) $sampling['z'],
                marginOfError: (float) $sampling['marginOfError'],
                proportion: (float) $sampling['proportion'],
                minParticipation: (float) $sampling['minParticipationPerStratum'],
                interviewFactorManagement: (float) $sampling['sclInterviewFactorManagement'],
                interviewFactorOperational: (float) $sampling['sclInterviewFactorOperational'],
                projectFactor: (float) $sampling['sclProjectFactor'],
            )->toArray();
            $locked->update(['parameter_draft' => [...$draft, 'samplePlan' => [
                'projects' => $projects,
                'locations' => $locations,
                'computedAt' => now()->toIso8601String(),
                'result' => $result,
            ]]]);
            Audit::record('assessment.sample_plan_saved', $locked, ['after' => [
                'workers' => $workers,
                'projects' => $projects,
                'locations' => $locations,
                'recommendedSurvey' => $result['recommendedSurvey'],
                'surveyTargetTotal' => $result['surveyTargetTotal'],
            ]], actorRole: Role::LeadAssessor);
        });
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Tim asesor
    // -----------------------------------------------------------------------------------------------------------------

    /** Hanya staf Nusa Safety yang aktif. Asesor utama harus memegang peran asesor utama di organisasi operator. */
    public function addTeamMember(Assessment $assessment, int $userId, Role $role, Role $actorRole): void
    {
        if (! in_array($role, [Role::LeadAssessor, Role::Assessor], true)) {
            throw RuleViolation::invalid('role', 'NOT_ASSESSOR_STAFF');
        }
        $allowed = $role === Role::LeadAssessor ? [Role::LeadAssessor] : [Role::LeadAssessor, Role::Assessor];
        $staff = User::query()
            ->where('id', $userId)
            ->where('is_active', true)
            ->whereHas('memberships', fn ($q) => $q
                ->whereIn('role', array_map(fn (Role $r) => $r->value, $allowed))
                ->whereHas('organization', fn ($o) => $o->where('is_operator', true)))
            ->first();
        if ($staff === null) {
            throw RuleViolation::invalid('user_id', $role === Role::LeadAssessor ? 'NOT_LEAD_ASSESSOR_STAFF' : 'NOT_ASSESSOR_STAFF');
        }
        DB::transaction(function () use ($assessment, $staff, $role, $actorRole) {
            $locked = $this->lockOpen($assessment);
            if ($locked->team()->where('user_id', $staff->id)->exists()) {
                throw RuleViolation::invalid('user_id', 'ALREADY_ASSIGNED');
            }
            $member = $locked->team()->create(['user_id' => $staff->id, 'role' => $role]);
            Audit::record('team.assign', $member, ['after' => ['userId' => $staff->id, 'email' => $staff->email, 'role' => $role->value]], $locked, $actorRole);
        });
    }

    public function removeTeamMember(Assessment $assessment, AssessmentTeamMember $member, Role $actorRole): void
    {
        DB::transaction(function () use ($assessment, $member, $actorRole) {
            $locked = $this->lockOpen($assessment);
            if ($member->role === Role::LeadAssessor && $locked->team()->where('role', Role::LeadAssessor->value)->count() <= 1) {
                throw RuleViolation::invalid('member', 'LAST_LEAD_ASSESSOR');
            }
            $member->delete();
            Audit::record('team.unassign', $member, ['before' => ['userId' => $member->user_id, 'role' => $member->role->value]], $locked, $actorRole);
        });
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Komunikasi awal dan kalibrasi asesor
    // -----------------------------------------------------------------------------------------------------------------

    /** @param  array{leadership: array{date: string|null, leader: string|null, note: string|null}, briefing: array{date: string|null, channels: list<string>, note: string|null}}  $kickoff */
    public function updateKickoff(Assessment $assessment, array $kickoff): void
    {
        DB::transaction(function () use ($assessment, $kickoff) {
            $locked = $this->lockEditable($assessment);
            $before = $locked->kickoff;
            $locked->update(['kickoff' => $kickoff]);
            Audit::record('assessment.kickoff_update', $locked, ['before' => $before, 'after' => $kickoff], actorRole: Role::LeadAssessor);
        });
    }

    /** @param  array{date: string, note: string|null, attendees: list<int>}  $calibration */
    public function recordCalibration(Assessment $assessment, array $calibration): void
    {
        DB::transaction(function () use ($assessment, $calibration) {
            $locked = $this->lockEditable($assessment);
            $team = $locked->team()->pluck('user_id')->map(fn ($id) => (int) $id)->all();
            $attendees = array_values(array_intersect(array_map('intval', $calibration['attendees']), $team));
            $data = [...$calibration, 'attendees' => $attendees];
            $before = $locked->calibration;
            $locked->update(['calibration' => $data]);
            Audit::record('assessment.calibration_recorded', $locked, ['before' => $before, 'after' => $data], actorRole: Role::LeadAssessor);
        });
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Transisi status
    // -----------------------------------------------------------------------------------------------------------------

    /**
     * Menjalankan satu langkah siklus bila semua syarat terpenuhi. Saat menuju LOCKED, parameter, hasil kalkulator,
     * strata, unit, dan teks persetujuan disalin ke snapshot (CLAUDE.md aturan 5).
     *
     * @param  list<Role>  $roles  Peran pelaku pada asesmen ini.
     */
    public function transition(Assessment $assessment, AssessmentStatus $to, array $roles): void
    {
        DB::transaction(function () use ($assessment, $to, $roles) {
            $locked = $this->lockRow($assessment);
            $from = $locked->status;
            $definition = Workflow::next($from);
            if ($definition === null || $definition->to !== $to) {
                throw RuleViolation::locked('INVALID_TRANSITION');
            }
            if (! in_array($definition->actor, $roles, true)) {
                throw new RuleViolation(403, 'FORBIDDEN');
            }
            $results = ConditionEvaluator::evaluate($definition, SetupFactsCollector::for($locked));
            if (! ConditionEvaluator::allowed($results)) {
                throw RuleViolation::invalid('transition', 'TRANSITION_BLOCKED');
            }
            $data = ['status' => $to];
            $summary = [];
            if ($to === AssessmentStatus::Locked) {
                $snapshot = $this->snapshot($locked);
                $data += ['parameter_snapshot' => $snapshot, 'locked_at' => now(), 'locked_by' => auth()->id()];
                $summary = [
                    'instrumentVersion' => $snapshot['instrumentVersion']['code'],
                    'strata' => array_map(fn ($s) => ['code' => $s['code'], 'population' => $s['population']], $snapshot['strata']),
                    'layerWeights' => $snapshot['parameters']['layerWeights'],
                    'surveyTargetTotal' => $snapshot['samplePlan']['result']['surveyTargetTotal'] ?? null,
                ];
            }
            $locked->forceFill($data)->save();
            Audit::record('assessment.status_change', $locked, [
                'before' => ['status' => $from->value],
                'after' => ['status' => $to->value],
                'conditions' => array_map(fn ($r) => ['key' => $r->key, 'met' => $r->met], $results),
                ...($summary === [] ? [] : ['snapshot' => $summary]),
            ], actorRole: $definition->actor);
        });
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Bantuan
    // -----------------------------------------------------------------------------------------------------------------

    /** Mengunci baris asesmen sampai transaksi selesai dan mengembalikan keadaan terbarunya. */
    private function lockRow(Assessment $assessment): Assessment
    {
        return Assessment::whereKey($assessment->id)->lockForUpdate()->firstOrFail();
    }

    /** Untuk parameter, strata, rincian, sampel, dan komunikasi awal: ditolak 409 setelah dikunci (aturan 5). */
    private function lockEditable(Assessment $assessment): Assessment
    {
        $locked = $this->lockRow($assessment);
        if ($locked->status->parametersLocked()) {
            throw RuleViolation::locked();
        }

        return $locked;
    }

    /** Untuk unit dan tim: tetap dapat diubah setelah dikunci, sampai asesmen ditutup (sama dengan v1). */
    private function lockOpen(Assessment $assessment): Assessment
    {
        $locked = $this->lockRow($assessment);
        if ($locked->status->isClosed()) {
            throw RuleViolation::locked('ASSESSMENT_CLOSED');
        }

        return $locked;
    }

    private function publishedVersion(string $id): InstrumentVersion
    {
        $version = InstrumentVersion::find($id);
        if ($version === null || ! $version->isPublished()) {
            throw RuleViolation::invalid('instrument_version_id', 'INSTRUMENT_NOT_PUBLISHED');
        }

        return $version;
    }

    /** @return array<string, mixed> */
    private function draftOf(Assessment $assessment): array
    {
        return $assessment->parameter_draft
            ?? EditableParameters::draftFromDefaults($assessment->instrumentVersion()->firstOrFail()->default_parameters);
    }

    /** Jumlah proyek dan populasi masuk kalkulator sampel; hasil lama dibatalkan selama belum dikunci. */
    private function invalidateSamplePlan(Assessment $assessment): void
    {
        $draft = $assessment->parameter_draft;
        if (! $assessment->status->parametersLocked() && ! empty($draft['samplePlan'])) {
            $assessment->update(['parameter_draft' => [...$draft, 'samplePlan' => null]]);
        }
    }

    /**
     * Koordinat hanya untuk proyek, dan harus lengkap (garis lintang, garis bujur, radius) atau kosong sama sekali.
     *
     * @param  array<string, mixed>  $input
     * @return array{name: string, type: string, parent_id: string|null, latitude?: float|null, longitude?: float|null, radius_meters?: int|null}
     */
    private function unitData(Assessment $assessment, array $input): array
    {
        $type = UnitType::from($input['type']);
        $coordinates = $type->hasCoordinates()
            ? [$input['latitude'] ?? null, $input['longitude'] ?? null, $input['radius_meters'] ?? null]
            : [null, null, null];
        $filled = count(array_filter($coordinates, fn ($v) => $v !== null && $v !== ''));
        if ($filled !== 0 && $filled !== 3) {
            throw RuleViolation::invalid('latitude', 'COORDINATES_INCOMPLETE');
        }
        $parent = $input['parent_id'] ?? null;
        if ($parent !== null && ! $assessment->units()->whereKey($parent)->exists()) {
            throw RuleViolation::invalid('parent_id', 'PARENT_NOT_FOUND');
        }

        return [
            'name' => trim($input['name']),
            'type' => $type->value,
            'parent_id' => $parent,
            'latitude' => $filled ? (float) $coordinates[0] : null,
            'longitude' => $filled ? (float) $coordinates[1] : null,
            'radius_meters' => $filled ? (int) $coordinates[2] : null,
        ];
    }

    private function assertStratumCodeFree(Assessment $assessment, string $code, ?string $except = null): void
    {
        $taken = $assessment->strata()->where('code', $code)->when($except, fn ($q) => $q->whereKeyNot($except))->exists();
        if ($taken) {
            throw RuleViolation::invalid('code', 'STRATUM_CODE_TAKEN');
        }
    }

    /**
     * @param  array<string, mixed>  $draft
     * @return array{consent_text_id: string, consent_text_en: string}
     */
    private function consentTexts(Organization $organization, array $draft): array
    {
        $months = (int) ($draft['retention']['rawDataMonths'] ?? 36);

        return [
            'consent_text_id' => ConsentTemplate::render('id', $organization->name, (string) config('nscas.data_location'), $months),
            'consent_text_en' => ConsentTemplate::render('en', $organization->name, (string) config('nscas.data_location_en'), $months),
        ];
    }

    /**
     * Isi snapshot saat dikunci: parameter, hasil kalkulator, strata, unit, teks persetujuan, versi instrumen,
     * perjanjian pemrosesan data, komunikasi awal, dan kalibrasi.
     *
     * @return array<string, mixed>
     */
    private function snapshot(Assessment $assessment): array
    {
        $assessment->loadMissing('instrumentVersion');
        $draft = $this->draftOf($assessment);
        $plan = $draft['samplePlan'] ?? null;
        unset($draft['samplePlan']);

        return [
            'schemaVersion' => 1,
            'lockedAt' => now()->toIso8601String(),
            'instrumentVersion' => ['id' => $assessment->instrumentVersion->id, 'code' => $assessment->instrumentVersion->code],
            'scopeType' => $assessment->scope_type->value,
            'period' => ['start' => $assessment->period_start->toDateString(), 'end' => $assessment->period_end->toDateString()],
            'targetLevel' => $assessment->target_level,
            'parameters' => $draft,
            'samplePlan' => $plan,
            'strata' => $assessment->strata()->get()->map(fn (Stratum $s) => [
                'id' => $s->id, 'code' => $s->code, 'name' => $s->name, 'group' => $s->group->value,
                'population' => $s->population, 'isContractor' => $s->is_contractor,
            ])->all(),
            'units' => $assessment->units()->orderBy('name')->get()->map(fn (Unit $u) => [
                'id' => $u->id, 'parentId' => $u->parent_id, 'name' => $u->name, 'type' => $u->type->value,
            ])->all(),
            'consent' => ['id' => $assessment->consent_text_id, 'en' => $assessment->consent_text_en],
            'dataProcessingAgreement' => [
                'status' => $assessment->dpa_status->value,
                'reference' => $assessment->dpa_reference,
                'signedOn' => $assessment->dpa_signed_on?->toDateString(),
            ],
            'kickoff' => $assessment->kickoff,
            'calibration' => $assessment->calibration,
        ];
    }

    /**
     * Nilai sederhana untuk jejak audit (tanggal dan enum menjadi teks).
     *
     * @param  array<string, mixed>  $values
     * @return array<string, mixed>
     */
    private function plain(array $values): array
    {
        return array_map(fn ($v) => match (true) {
            $v instanceof \DateTimeInterface => $v->format('Y-m-d'),
            $v instanceof \BackedEnum => $v->value,
            default => $v,
        }, $values);
    }
}
