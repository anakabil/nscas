<?php

namespace App\Services\Results;

use App\Domain\Panel\PanelRules;
use App\Domain\Results\Heatmap;
use App\Domain\Results\Sensitivity;
use App\Domain\Results\Trend;
use App\Domain\Scoring\EngineParameters;
use App\Domain\Scoring\Flag;
use App\Domain\Scoring\ScoringEngine;
use App\Models\Assessment;
use App\Models\Characteristic;
use App\Models\ScoreRun;
use App\Models\Unit;
use App\Models\User;
use App\Services\Findings\FindingsService;
use App\Services\Findings\SurveyDataLoader;
use App\Services\Quality\DataQualityService;
use App\Support\AssessmentAccess;

/**
 * Dasbor hasil (docs/01 M9), dibawa dari v1 src/lib/dashboard: hasil final rapat panel (atau, bagi asesor, hasil
 * sementara eksekusi terakhir), indeks per aspek dan karakteristik, peta warna aspek terhadap strata dan unit dengan
 * sel tersembunyi, selisih persepsi, statistik mutu, analisis kepekaan bobot lapisan, dan perbandingan antarperiode.
 */
class ResultsService
{
    public function __construct(private readonly FindingsService $findings, private readonly DataQualityService $quality) {}

    /** Hasil yang ditampilkan: final bila ada; bagi asesor, eksekusi terakhir sebagai hasil sementara. */
    public function source(Assessment $assessment, bool $assessor): ?ScoreRun
    {
        $final = ScoreRun::where('assessment_id', $assessment->id)->where('is_final', true)->first();
        if ($final !== null || ! $assessor) {
            return $final;
        }

        return ScoreRun::where('assessment_id', $assessment->id)->orderByDesc('created_at')->first();
    }

    /**
     * @param  list<string>|null  $unitScope  unit koordinator; null berarti semua unit
     * @return array<string, mixed>|null
     */
    public function dashboard(Assessment $assessment, bool $assessor, ?array $unitScope): ?array
    {
        $run = $this->source($assessment, $assessor);
        if ($run === null) {
            return null;
        }
        $run->load('decisions');
        $result = $run->is_final ? $run->final_result : $this->withPanel($run);
        $params = EngineParameters::fromSnapshot($run->parameter_snapshot);
        $aspectNames = collect($run->parameter_snapshot['aspects'] ?? [])->pluck('name', 'code');
        $characteristics = Characteristic::where('instrument_version_id', $assessment->instrument_version_id)->orderBy('position')
            ->get(['id', 'code', 'name_id', 'name_en', 'aspect_code', 'is_contextual']);
        $names = $characteristics->keyBy('code');
        $minCell = $params->minRespondentsPerReportCell;
        $responses = SurveyDataLoader::responses($assessment);
        $snapshotStrata = $assessment->parameter_snapshot['strata'] ?? [];
        $units = Unit::where('assessment_id', $assessment->id)->orderBy('name')->get(['id', 'name'])
            ->filter(fn (Unit $u) => $unitScope === null || in_array($u->id, $unitScope, true));
        $defs = $characteristics->map(fn (Characteristic $c) => ['id' => $c->id, 'aspectCode' => $c->aspect_code, 'contextual' => (bool) $c->is_contextual])->all();
        // Jawaban survei dimuat sekali untuk peta, temuan awal, dan statistik mutu.
        $findings = $this->findings->build($assessment, $responses);
        $scoped = $unitScope !== null;
        $quality = $this->quality->report($assessment, false, $responses);
        $panel = [];
        foreach ($run->decisions as $d) {
            if ($d->kind === 'ADJUSTED' && $d->adjusted_value !== null) {
                $panel[$d->characteristic_code] = (float) $d->adjusted_value;
            }
        }

        return [
            'provisional' => ! $run->is_final,
            'runAt' => $run->created_at->toIso8601String(),
            'finalizedAt' => $run->finalized_at?->toIso8601String(),
            'engineVersion' => $run->engine_version,
            'targetLevel' => (float) ($run->input_snapshot['targetLevel'] ?? $assessment->target_level),
            'minCell' => $minCell,
            'organization' => $result['organization'],
            'sclLevel' => $result['sclTrack']['indicativeLevel'] ?? null,
            'aspects' => array_map(fn (string $code, array $a) => ['code' => $code, 'name' => (string) ($aspectNames[$code] ?? $code), ...$a],
                array_keys($result['aspects']), array_values($result['aspects'])),
            'characteristics' => array_map(fn (array $c) => [
                'code' => $c['code'],
                'name' => $names[$c['code']]->name_id ?? $c['code'],
                'nameEn' => $names[$c['code']]->name_en ?? null,
                'aspectCode' => $c['aspectCode'],
                'contextual' => $c['isContextual'],
                'perception' => $c['perception'],
                'evidence' => $c['evidence'],
                'validation' => $c['validation'],
                'engine' => $c['final'],
                'panel' => $c['panelAdjusted'],
                'value' => $c['panelAdjusted'] ?? $c['final'],
                'flags' => $c['flags'],
            ], $result['characteristics']),
            'divergence' => array_values(array_map(fn (array $c) => $c['code'], array_filter($result['characteristics'], fn (array $c) => in_array(Flag::SelisihPersepsiBukti->value, $c['flags'], true)))),
            // Koordinator unit hanya melihat unitnya (docs/04 bagian 2, sama dengan v1): peta strata, selisih persepsi, dan
            // partisipasi per strata seluruh organisasi tidak dikirim.
            'perceptionGap' => $scoped ? [] : $findings['aspects'],
            'gapAttention' => $findings['gapAttention'],
            'heatmaps' => [
                'strata' => $scoped ? null : Heatmap::build(
                    $defs, $responses,
                    array_map(fn (array $s) => ['id' => $s['id'], 'label' => $s['code'], 'name' => $s['name']], $snapshotStrata),
                    'stratumId', $minCell, $this->strataGroups($snapshotStrata),
                ),
                'units' => Heatmap::build($defs, $responses, $units->map(fn (Unit $u) => ['id' => $u->id, 'label' => $u->name])->values()->all(), 'unitId', $minCell),
            ],
            'quality' => [
                'counts' => $quality['counts'],
                'minParticipation' => $quality['minParticipation'],
                'strata' => $scoped ? [] : array_map(fn (array $s) => ['code' => $s['code'], 'name' => $s['name'], 'population' => $s['population'], 'completed' => $s['completed'], 'rate' => $s['rate'], 'belowMinimum' => $s['belowMinimum']], $quality['strata']),
                'alpha' => $quality['alpha'],
                'alphaMin' => $quality['alphaMin'],
                'rwg' => array_values(array_filter($quality['rwg'], fn (array $r) => $unitScope === null || in_array($r['unitId'], $unitScope, true))),
                'rwgMin' => $quality['rwgMin'],
            ],
            'sensitivity' => Sensitivity::analyse(PanelRules::restoreInput($run->input_snapshot, $panel), $params),
            'parameters' => [
                'layerWeights' => $params->layerWeights->toArray(),
                'selfAssessmentWeight' => $params->selfAssessmentWeightInPerception,
                'divergenceThreshold' => $params->divergenceThreshold,
            ],
        ];
    }

    /**
     * Kelompok kolom peta strata yang agregatnya diterbitkan: setiap kelompok jabatan (rata-rata kelompok pada selisih
     * persepsi) dan seluruh strata (rata-rata organisasi). Dipakai untuk penyembunyian pelengkap.
     *
     * @param  list<array<string, mixed>>  $strata
     * @return list<list<string>>
     */
    private function strataGroups(array $strata): array
    {
        $groups = [];
        foreach ($strata as $s) {
            $groups[(string) ($s['group'] ?? '')][] = (string) $s['id'];
        }

        return [...array_values($groups), array_map(fn (array $s) => (string) $s['id'], $strata)];
    }

    /** @return array<string, mixed> */
    private function withPanel(ScoreRun $run): array
    {
        $panel = [];
        foreach ($run->decisions as $d) {
            if ($d->kind === 'ADJUSTED' && $d->adjusted_value !== null) {
                $panel[$d->characteristic_code] = (float) $d->adjusted_value;
            }
        }

        return ScoringEngine::runEngine(PanelRules::restoreInput($run->input_snapshot, $panel), EngineParameters::fromSnapshot($run->parameter_snapshot))->toArray();
    }

    /**
     * Hasil final asesmen organisasi yang sama dengan versi instrumen yang sama, yang dapat dilihat pengguna ini
     * (CLAUDE.md aturan 4).
     *
     * @return array{periods: list<array<string, mixed>>, aspects: list<array{code: string, name: string}>}
     */
    public function trend(User $user, Assessment $assessment): array
    {
        $assessments = AssessmentAccess::visibleTo($user)
            ->where('assessments.organization_id', $assessment->organization_id)
            ->where('assessments.instrument_version_id', $assessment->instrument_version_id)
            ->get(['assessments.id', 'assessments.name', 'assessments.period_start']);
        $runs = ScoreRun::whereIn('assessment_id', $assessments->pluck('id'))->where('is_final', true)->get(['assessment_id', 'final_result', 'parameter_snapshot'])->keyBy('assessment_id');
        $periods = [];
        $aspects = [];
        foreach ($assessments as $a) {
            $run = $runs->get($a->id);
            if ($run === null) {
                continue;
            }
            foreach ($run->parameter_snapshot['aspects'] ?? [] as $asp) {
                if (array_key_exists($asp['code'], $run->final_result['aspects'])) {
                    $aspects[$asp['code']] = $asp['name'];
                }
            }
            $periods[] = [
                'id' => $a->id,
                'name' => $a->name,
                'periodStart' => $a->period_start->toDateString(),
                'index' => (float) $run->final_result['organization']['index'],
                'level' => (int) $run->final_result['organization']['indicativeLevel'],
                'aspects' => array_map(fn (array $x) => $x['index'] === null ? null : (float) $x['index'], $run->final_result['aspects']),
            ];
        }

        return [
            'periods' => array_map(fn (array $p) => [...$p, 'current' => $p['id'] === $assessment->id], Trend::compare($periods)),
            'aspects' => array_map(fn (string $code, string $name) => ['code' => $code, 'name' => $name], array_keys($aspects), array_values($aspects)),
        ];
    }
}
