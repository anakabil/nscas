<?php

namespace App\Services\Respondents;

use App\Domain\Access\Role;
use App\Domain\Respondents\RosterValidator;
use App\Domain\Respondents\TokenCodec;
use App\Domain\Workflow\AssessmentStatus;
use App\Jobs\SendSurveyInvitation;
use App\Models\AccessToken;
use App\Models\Assessment;
use App\Models\Membership;
use App\Models\RosterEntry;
use App\Models\Stratum;
use App\Models\Unit;
use App\Models\UnitAssignment;
use App\Models\UnitQrCode;
use App\Support\Audit;
use App\Support\RuleViolation;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Manajemen responden dan distribusi token (docs/01 M2, docs/04 bagian 3), dibawa dari v1
 * src/lib/respondents/service.ts. Pemanggil sudah memeriksa hak akses; $scope membatasi koordinator unit ke unitnya
 * (null untuk semua unit). Setiap perubahan mengunci baris asesmen lebih dulu agar status tidak berubah di tengah
 * jalan, dan dicatat di jejak audit tanpa token maupun kontak responden.
 */
final class RespondentDistribution
{
    /** Batas galat yang dikirim ke peramban; jumlah seluruhnya tetap dilaporkan. */
    public const MAX_REPORTED_ERRORS = 200;

    // -----------------------------------------------------------------------------------------------------------------
    // Impor daftar responden
    // -----------------------------------------------------------------------------------------------------------------

    /**
     * Pratinjau ($commit false) atau impor ($commit true). Impor hanya dilakukan bila seluruh baris valid, dan berkas
     * selalu dibaca serta divalidasi ulang di server, bukan memakai hasil pratinjau dari peramban.
     *
     * @param  list<string>|null  $scope
     * @return array{ok: bool, error: string|null, imported: int, summary: array<string, mixed>|null}
     */
    public function import(Assessment $assessment, string $path, ?array $scope, bool $commit, Role $actorRole): array
    {
        $file = RosterReader::read($path);
        if (isset($file['error'])) {
            return ['ok' => false, 'error' => $file['error'], 'imported' => 0, 'summary' => null];
        }

        return DB::transaction(function () use ($assessment, $file, $scope, $commit, $actorRole) {
            $locked = $this->lockForDistribution($assessment);
            $units = $locked->units()->get(['id', 'name']);
            $strata = $locked->strata()->orderBy('code')->get(['id', 'code', 'name', 'is_contractor']);
            $existing = RosterEntry::where('assessment_id', $locked->id)->get(['employee_no', 'email_hash']);

            $strataMap = [];
            foreach ($strata as $s) {
                $strataMap[RosterValidator::normalizeKey($s->code)] = ['id' => $s->id, 'isContractor' => $s->is_contractor];
                $strataMap[RosterValidator::normalizeKey($s->name)] ??= ['id' => $s->id, 'isContractor' => $s->is_contractor];
            }
            $validation = RosterValidator::validate(
                $file['rows'],
                $units->mapWithKeys(fn (Unit $u) => [RosterValidator::normalizeKey($u->name) => $u->id])->all(),
                $strataMap,
                $scope,
                $existing->pluck('employee_no')->filter()->map(fn ($n) => mb_strtolower($n))->values()->all(),
                $existing->pluck('email_hash')->filter()->values()->all(),
                RosterEntry::emailHash(...),
            );
            $summary = $this->summarize($validation, $units->pluck('name', 'id')->all(), $strata->pluck('code', 'id')->all());
            $invalid = $validation['missingColumns'] !== [] || $validation['tooManyRows'] || $validation['errors'] !== [] || $validation['valid'] === [];
            if ($invalid || ! $commit) {
                return ['ok' => ! $invalid, 'error' => $invalid ? 'INVALID_ROWS' : null, 'imported' => 0, 'summary' => $summary];
            }

            $now = now();
            $rows = array_map(fn (array $r) => [
                'id' => strtolower((string) Str::ulid()),
                'assessment_id' => $locked->id,
                'unit_id' => $r['unitId'],
                'stratum_id' => $r['stratumId'],
                'full_name' => $r['fullName'],
                'employee_no' => $r['employeeNo'],
                // Kontak dienkripsi dengan kunci aplikasi, sama dengan cast "encrypted" pada model (docs/04 bagian 4).
                'email' => $r['email'] === null ? null : Crypt::encryptString($r['email']),
                'email_hash' => $r['email'] === null ? null : RosterEntry::emailHash($r['email']),
                'phone' => $r['phone'] === null ? null : Crypt::encryptString($r['phone']),
                'is_contractor' => $r['isContractor'],
                'created_at' => $now,
                'updated_at' => $now,
            ], $validation['valid']);
            foreach (array_chunk($rows, 500) as $chunk) {
                RosterEntry::insert($chunk);
            }

            Audit::record('roster.import', $locked, ['after' => [
                'imported' => count($rows),
                'withEmail' => count(array_filter($rows, fn ($r) => $r['email'] !== null)),
                'byUnit' => array_column($summary['byUnit'], 'count', 'name'),
                'byStratum' => array_column($summary['byStratum'], 'count', 'code'),
            ]], actorRole: $actorRole);

            return ['ok' => true, 'error' => null, 'imported' => count($rows), 'summary' => $summary];
        });
    }

    /**
     * @param  array<string, mixed>  $validation
     * @param  array<string, string>  $unitNames
     * @param  array<string, string>  $stratumCodes
     * @return array<string, mixed>
     */
    private function summarize(array $validation, array $unitNames, array $stratumCodes): array
    {
        $byUnit = array_count_values(array_column($validation['valid'], 'unitId'));
        $byStratum = array_count_values(array_column($validation['valid'], 'stratumId'));

        return [
            'missingColumns' => $validation['missingColumns'],
            'tooManyRows' => $validation['tooManyRows'],
            'totalRows' => $validation['totalRows'],
            'validRows' => count($validation['valid']),
            'errorCount' => count($validation['errors']),
            'errors' => array_slice($validation['errors'], 0, self::MAX_REPORTED_ERRORS),
            'byUnit' => array_values(array_map(fn ($id) => ['unitId' => $id, 'name' => $unitNames[$id], 'count' => $byUnit[$id]], array_keys(array_intersect_key($unitNames, $byUnit)))),
            'byStratum' => array_values(array_map(fn ($id) => ['stratumId' => $id, 'code' => $stratumCodes[$id], 'count' => $byStratum[$id]], array_keys(array_intersect_key($stratumCodes, $byStratum)))),
        ];
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Tautan, undangan, pencabutan
    // -----------------------------------------------------------------------------------------------------------------

    /**
     * Menerbitkan tautan survei untuk responden yang belum memiliki token terpakai. Token mentah hanya dikembalikan
     * sekali ini, untuk ditampilkan dan diunduh sebagai CSV.
     *
     * @param  list<string>|null  $scope
     * @return list<array{fullName: string, employeeNo: string|null, unit: string, stratum: string, link: string}>
     */
    public function issueLinks(Assessment $assessment, ?string $unitId, bool $onlyWithoutEmail, ?array $scope, Role $actorRole): array
    {
        return DB::transaction(function () use ($assessment, $unitId, $onlyWithoutEmail, $scope, $actorRole) {
            $locked = $this->lockForDistribution($assessment);
            $entries = $this->withoutUsableToken($this->scoped($locked, $unitId, $scope))
                ->when($onlyWithoutEmail, fn (Builder $q) => $q->whereNull('email'))
                ->with(['unit:id,name', 'stratum:id,code'])
                ->get(['id', 'unit_id', 'stratum_id', 'full_name', 'employee_no'])
                ->sortBy(fn (RosterEntry $e) => mb_strtolower($e->unit->name.'|'.$e->full_name))->values();

            $links = [];
            foreach ($entries as $entry) {
                $issued = SurveyLinks::issue($locked, ['unit_id' => $entry->unit_id, 'stratum_id' => $entry->stratum_id, 'roster_entry_id' => $entry->id, 'channel' => 'LINK']);
                $links[] = [
                    'fullName' => $entry->full_name,
                    'employeeNo' => $entry->employee_no,
                    'unit' => $entry->unit->name,
                    'stratum' => $entry->stratum->code,
                    'link' => SurveyLinks::survey($issued['raw']),
                ];
            }
            if ($links !== []) {
                Audit::record('token.issue', $locked, ['after' => ['channel' => 'LINK', 'count' => count($links), 'unitId' => $unitId, 'onlyWithoutEmail' => $onlyWithoutEmail]], actorRole: $actorRole);
            }

            return $links;
        });
    }

    /**
     * Mengantre surel undangan. Token dibuat oleh pekerjaan antrean saat surel dikirim, sehingga token mentah tidak
     * pernah disimpan.
     *
     * @param  list<string>|null  $scope
     */
    public function queueInvitations(Assessment $assessment, ?string $unitId, ?array $scope, Role $actorRole): int
    {
        return DB::transaction(function () use ($assessment, $unitId, $scope, $actorRole) {
            $locked = $this->lockForDistribution($assessment);
            $ids = $this->withoutUsableToken($this->scoped($locked, $unitId, $scope))->whereNotNull('email')->pluck('id');
            foreach ($ids as $id) {
                SendSurveyInvitation::dispatch($locked->id, $id)->afterCommit();
            }
            if ($ids->isNotEmpty()) {
                Audit::record('invitation.queue', $locked, ['after' => ['count' => $ids->count(), 'unitId' => $unitId]], actorRole: $actorRole);
            }

            return $ids->count();
        });
    }

    /** @param  list<string>|null  $scope */
    public function revoke(Assessment $assessment, string $rosterEntryId, ?array $scope, Role $actorRole): void
    {
        DB::transaction(function () use ($assessment, $rosterEntryId, $scope, $actorRole) {
            $locked = $this->lockForDistribution($assessment);
            $entry = $this->entry($locked, $rosterEntryId, $scope);
            $active = $entry->tokens()->where('kind', 'SURVEY')->whereNull('revoked_at')->whereNull('completed_at')->pluck('id');
            if ($active->isEmpty()) {
                throw RuleViolation::invalid('form', 'NO_ACTIVE_TOKEN');
            }
            AccessToken::whereIn('id', $active)->update(['revoked_at' => now(), 'revoked_reason' => 'MANUAL']);
            Audit::record('token.revoke', $entry, ['after' => ['tokens' => $active->count()]], $locked, $actorRole);
        });
    }

    /**
     * Penerbitan ulang: token aktif dicabut lalu token baru diterbitkan sebagai tautan (dikembalikan sekali) atau
     * dikirim lewat surel oleh antrean. Ditolak bila responden sudah menyelesaikan survei.
     *
     * @param  'LINK'|'EMAIL'  $channel
     * @param  list<string>|null  $scope
     * @return array{fullName: string, employeeNo: string|null, unit: string, stratum: string, link: string}|null
     */
    public function reissue(Assessment $assessment, string $rosterEntryId, string $channel, ?array $scope, Role $actorRole): ?array
    {
        return DB::transaction(function () use ($assessment, $rosterEntryId, $channel, $scope, $actorRole) {
            $locked = $this->lockForDistribution($assessment);
            $entry = $this->entry($locked, $rosterEntryId, $scope);
            $usable = $entry->tokens()->where('kind', 'SURVEY')->whereNull('revoked_at')->get(['id', 'completed_at']);
            if ($usable->contains(fn (AccessToken $t) => $t->completed_at !== null)) {
                throw RuleViolation::invalid('form', 'TOKEN_ALREADY_USED');
            }
            if ($channel === 'EMAIL' && $entry->email === null) {
                throw RuleViolation::invalid('form', 'NO_EMAIL');
            }
            if ($usable->isNotEmpty()) {
                AccessToken::whereIn('id', $usable->pluck('id'))->update(['revoked_at' => now(), 'revoked_reason' => 'REISSUED']);
            }
            $link = null;
            if ($channel === 'LINK') {
                $issued = SurveyLinks::issue($locked, ['unit_id' => $entry->unit_id, 'stratum_id' => $entry->stratum_id, 'roster_entry_id' => $entry->id, 'channel' => 'LINK']);
                $entry->loadMissing(['unit:id,name', 'stratum:id,code']);
                $link = ['fullName' => $entry->full_name, 'employeeNo' => $entry->employee_no, 'unit' => $entry->unit->name, 'stratum' => $entry->stratum->code, 'link' => SurveyLinks::survey($issued['raw'])];
            } else {
                SendSurveyInvitation::dispatch($locked->id, $entry->id)->afterCommit();
            }
            Audit::record('token.reissue', $entry, ['after' => ['channel' => $channel, 'revoked' => $usable->count()]], $locked, $actorRole);

            return $link;
        });
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Kode QR unit
    // -----------------------------------------------------------------------------------------------------------------

    /**
     * Kode QR baru untuk unit (dan strata bila ditentukan); kode aktif lama unit itu dinonaktifkan. Kode mentah hanya
     * dikembalikan sekali.
     *
     * @return array{id: string, link: string, unit: string, stratum: string|null}
     */
    public function createQr(Assessment $assessment, string $unitId, ?string $stratumId, ?int $maxIssuance, Role $actorRole): array
    {
        return DB::transaction(function () use ($assessment, $unitId, $stratumId, $maxIssuance, $actorRole) {
            $locked = $this->lockForDistribution($assessment);
            $unit = Unit::where('assessment_id', $locked->id)->findOrFail($unitId);
            $stratum = $stratumId === null ? null : Stratum::where('assessment_id', $locked->id)->findOrFail($stratumId);
            $deactivated = UnitQrCode::where('assessment_id', $locked->id)->where('unit_id', $unit->id)
                ->where('stratum_id', $stratum?->id)->where('is_active', true)->update(['is_active' => false]);
            $raw = TokenCodec::generate();
            $qr = UnitQrCode::create([
                'assessment_id' => $locked->id,
                'unit_id' => $unit->id,
                'stratum_id' => $stratum?->id,
                'code_hash' => TokenCodec::hash($raw),
                'max_issuance' => $maxIssuance,
            ]);
            Audit::record('qr.create', $qr, ['after' => ['unitId' => $unit->id, 'stratumId' => $stratum?->id, 'maxIssuance' => $maxIssuance, 'previousDeactivated' => $deactivated]], $locked, $actorRole);

            return ['id' => $qr->id, 'link' => SurveyLinks::qr($raw), 'unit' => $unit->name, 'stratum' => $stratum?->code];
        });
    }

    public function deactivateQr(Assessment $assessment, string $qrId, Role $actorRole): void
    {
        DB::transaction(function () use ($assessment, $qrId, $actorRole) {
            $qr = UnitQrCode::where('assessment_id', $assessment->id)->lockForUpdate()->findOrFail($qrId);
            if (! $qr->is_active) {
                return;
            }
            $qr->forceFill(['is_active' => false])->save();
            Audit::record('qr.deactivate', $qr, [], $assessment, $actorRole);
        });
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Masa survei dan koordinator unit
    // -----------------------------------------------------------------------------------------------------------------

    /**
     * Masa survei bukan parameter terkunci (aturan 5): jadwal lapangan dapat bergeser selama pengumpulan data.
     */
    public function setWindow(Assessment $assessment, CarbonImmutable $opensAt, CarbonImmutable $closesAt, Role $actorRole): void
    {
        if ($closesAt <= $opensAt) {
            throw RuleViolation::invalid('closesAt', 'WINDOW_ORDER');
        }
        DB::transaction(function () use ($assessment, $opensAt, $closesAt, $actorRole) {
            $locked = $this->lockForDistribution($assessment);
            $before = ['opensAt' => $locked->survey_opens_at?->toIso8601String(), 'closesAt' => $locked->survey_closes_at?->toIso8601String()];
            // Disimpan dalam UTC: Eloquent menulis waktu tanpa zona, sehingga waktu WIB harus dikonversi lebih dulu.
            $locked->forceFill(['survey_opens_at' => $opensAt->utc(), 'survey_closes_at' => $closesAt->utc()])->save();
            Audit::record('assessment.survey_window', $locked, [
                'before' => $before,
                'after' => ['opensAt' => $opensAt->utc()->toIso8601String(), 'closesAt' => $closesAt->utc()->toIso8601String()],
            ], actorRole: $actorRole);
        });
    }

    /** Menugaskan koordinator unit (anggota organisasi klien berperan koordinator unit) pada satu unit. */
    public function assignCoordinator(Assessment $assessment, int $userId, string $unitId, Role $actorRole): void
    {
        DB::transaction(function () use ($assessment, $userId, $unitId, $actorRole) {
            $locked = $this->lockOpen($assessment);
            $unit = Unit::where('assessment_id', $locked->id)->findOrFail($unitId);
            $isCoordinator = Membership::where('organization_id', $locked->organization_id)->where('user_id', $userId)
                ->where('role', Role::UnitCoordinator)->exists();
            if (! $isCoordinator) {
                throw RuleViolation::invalid('userId', 'NOT_A_COORDINATOR');
            }
            $assignment = UnitAssignment::firstOrCreate(['unit_id' => $unit->id, 'user_id' => $userId], ['assessment_id' => $locked->id]);
            if ($assignment->wasRecentlyCreated) {
                Audit::record('coordinator.assign', $assignment, ['after' => ['userId' => $userId, 'unitId' => $unit->id]], $locked, $actorRole);
            }
        });
    }

    public function removeCoordinator(Assessment $assessment, int $assignmentId, Role $actorRole): void
    {
        DB::transaction(function () use ($assessment, $assignmentId, $actorRole) {
            $locked = $this->lockOpen($assessment);
            $assignment = UnitAssignment::where('assessment_id', $locked->id)->findOrFail($assignmentId);
            $assignment->delete();
            Audit::record('coordinator.remove', $assignment, ['before' => ['userId' => $assignment->user_id, 'unitId' => $assignment->unit_id]], $locked, $actorRole);
        });
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Bantuan
    // -----------------------------------------------------------------------------------------------------------------

    /**
     * Daftar responden dan token dikelola setelah parameter dikunci dan selama pengumpulan data (docs/01 M2).
     */
    private function lockForDistribution(Assessment $assessment): Assessment
    {
        $locked = Assessment::whereKey($assessment->id)->lockForUpdate()->firstOrFail();
        if (! $locked->status->parametersLocked()) {
            throw RuleViolation::locked('DISTRIBUTION_NOT_OPEN');
        }
        if (! in_array($locked->status, [AssessmentStatus::Locked, AssessmentStatus::DataCollection], true)) {
            throw RuleViolation::locked('DISTRIBUTION_CLOSED');
        }

        return $locked;
    }

    /** Penugasan koordinator boleh diubah sejak perencanaan sampai asesmen ditutup. */
    private function lockOpen(Assessment $assessment): Assessment
    {
        $locked = Assessment::whereKey($assessment->id)->lockForUpdate()->firstOrFail();
        if ($locked->status->isClosed()) {
            throw RuleViolation::locked('ASSESSMENT_CLOSED');
        }

        return $locked;
    }

    /**
     * @param  list<string>|null  $scope
     * @return Builder<RosterEntry>
     */
    private function scoped(Assessment $assessment, ?string $unitId, ?array $scope): Builder
    {
        if ($unitId !== null && $scope !== null && ! in_array($unitId, $scope, true)) {
            throw new RuleViolation(403, 'FORBIDDEN');
        }

        return RosterEntry::where('assessment_id', $assessment->id)
            ->when($scope !== null, fn (Builder $q) => $q->whereIn('unit_id', $scope))
            ->when($unitId !== null, fn (Builder $q) => $q->where('unit_id', $unitId));
    }

    /**
     * Token dianggap terpakai bila belum dicabut (aktif atau sudah selesai); responden tersebut tidak diberi token baru.
     *
     * @param  Builder<RosterEntry>  $query
     * @return Builder<RosterEntry>
     */
    private function withoutUsableToken(Builder $query): Builder
    {
        return $query->whereDoesntHave('tokens', fn (Builder $q) => $q->where('kind', 'SURVEY')->whereNull('revoked_at'));
    }

    /** @param  list<string>|null  $scope */
    private function entry(Assessment $assessment, string $id, ?array $scope): RosterEntry
    {
        $entry = $this->scoped($assessment, null, $scope)->whereKey($id)->first();
        if ($entry === null) {
            throw new RuleViolation(404, 'NOT_FOUND');
        }

        return $entry;
    }
}
