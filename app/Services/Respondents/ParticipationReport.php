<?php

namespace App\Services\Respondents;

use App\Domain\Respondents\Participation;
use App\Models\AccessToken;
use App\Models\Assessment;
use App\Models\ParticipationSnapshot;
use App\Models\RosterEntry;
use App\Models\Stratum;
use App\Models\Unit;

/**
 * Pemuat data partisipasi (dibawa dari v1 src/lib/respondents/participation-data.ts). Selalu dari token akses, tidak
 * pernah dari tabel jawaban (docs/02 bagian 4). Ambang sel dan partisipasi minimum dibaca dari snapshot parameter
 * (aturan 5), dengan draf sebagai cadangan.
 */
final class ParticipationReport
{
    /**
     * @param  list<string>|null  $scope
     * @return array{summary: array<string, mixed>, minCell: int, minParticipation: float, trend: list<array<string, mixed>>}
     */
    public static function for(Assessment $assessment, ?array $scope): array
    {
        [$minCell, $minParticipation] = self::thresholds($assessment);
        $counts = self::counts($assessment, $scope);
        $snapshots = $scope !== null ? collect() : ParticipationSnapshot::where('assessment_id', $assessment->id)->orderBy('taken_on')->get(['taken_on', 'data']);

        return [
            'summary' => Participation::build($counts['strata'], $counts['units'], $counts['tokens'], $counts['roster'], $minParticipation, $minCell),
            'minCell' => $minCell,
            'minParticipation' => $minParticipation,
            'trend' => Participation::trend($snapshots->map(fn (ParticipationSnapshot $s) => ['date' => $s->taken_on->toDateString(), 'data' => $s->data])->all(), $minCell),
        ];
    }

    /** @return array{population: int, issued: int, completed: int, strata: list<array{stratumId: string, completed: int}>} */
    public static function snapshotData(Assessment $assessment): array
    {
        $counts = self::counts($assessment, null);

        return Participation::snapshotData($counts['strata'], $counts['tokens']);
    }

    /** @return array{0: int, 1: float} */
    public static function thresholds(Assessment $assessment): array
    {
        $parameters = $assessment->parameter_snapshot['parameters'] ?? $assessment->parameter_draft ?? [];

        return [
            (int) ($parameters['quality']['minRespondentsPerReportCell'] ?? 5),
            (float) ($parameters['sampling']['minParticipationPerStratum'] ?? 0.3),
        ];
    }

    /**
     * Jumlah mentah per unit dan strata; $scope membatasi ke unit koordinator.
     *
     * @param  list<string>|null  $scope
     * @return array{strata: list<array<string, mixed>>, units: list<array<string, mixed>>, tokens: list<array<string, mixed>>, roster: list<array<string, mixed>>}
     */
    private static function counts(Assessment $assessment, ?array $scope): array
    {
        $inScope = fn ($q, string $column = 'unit_id') => $scope === null ? $q : $q->whereIn($column, $scope);

        $strata = Stratum::where('assessment_id', $assessment->id)->orderBy('code')->get(['id', 'code', 'name', 'population'])
            ->map(fn (Stratum $s) => ['id' => $s->id, 'code' => $s->code, 'name' => $s->name, 'population' => $s->population])->all();
        $units = $inScope(Unit::where('assessment_id', $assessment->id), 'id')->orderBy('name')->get(['id', 'name', 'parent_id'])
            ->map(fn (Unit $u) => ['id' => $u->id, 'name' => $u->name, 'parentId' => $u->parent_id])->all();
        $tokens = $inScope(AccessToken::where('assessment_id', $assessment->id)->where('kind', 'SURVEY'))
            ->selectRaw('unit_id, stratum_id, count(*) filter (where revoked_at is null) as issued, count(*) filter (where completed_at is not null) as completed')
            ->groupBy('unit_id', 'stratum_id')->toBase()->get()
            ->map(fn ($r) => ['unitId' => $r->unit_id, 'stratumId' => $r->stratum_id, 'issued' => (int) $r->issued, 'completed' => (int) $r->completed])->all();
        $roster = $inScope(RosterEntry::where('assessment_id', $assessment->id))
            ->selectRaw('unit_id, stratum_id, count(*) as count')->groupBy('unit_id', 'stratum_id')->toBase()->get()
            ->map(fn ($r) => ['unitId' => $r->unit_id, 'stratumId' => $r->stratum_id, 'count' => (int) $r->count])->all();

        return ['strata' => $strata, 'units' => $units, 'tokens' => $tokens, 'roster' => $roster];
    }
}
