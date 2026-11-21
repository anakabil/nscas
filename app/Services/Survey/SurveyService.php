<?php

namespace App\Services\Survey;

use App\Domain\Respondents\SurveyWindow;
use App\Domain\Respondents\TokenCodec;
use App\Domain\Scoring\DataQuality;
use App\Domain\Scoring\QualityThresholds;
use App\Domain\Scoring\ResponseForQuality;
use App\Domain\Survey\DurationBucket;
use App\Domain\Survey\SubmissionCheck;
use App\Domain\Survey\SurveyRules;
use App\Models\AccessToken;
use App\Models\Assessment;
use App\Models\Characteristic;
use App\Models\ClimateDimension;
use App\Models\Organization;
use App\Models\Stratum;
use App\Models\SurveyResponse;
use DateTimeInterface;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Survei responden (docs/01 M3) dengan desain anonimitas docs/02 bagian 4, dibawa dari v1 src/lib/survey/service.ts.
 *
 * Kelas ini sengaja tidak menulis jejak audit, log, alamat IP, atau metadata permintaan: mencatat waktu atau alamat
 * pengiriman akan memungkinkan jawaban dicocokkan dengan token. Satu-satunya jejak per token adalah waktu buka,
 * persetujuan, dan selesai yang dibulatkan ke jam.
 */
final class SurveyService
{
    /**
     * Keadaan tautan survei. Tidak mengubah apa pun.
     *
     * @return array{state: 'INVALID'|'USED'|'NOT_OPEN'|'CLOSED'|'READY', opensAt?: DateTimeInterface|null, closesAt?: DateTimeInterface|null, token?: AccessToken, assessment?: Assessment}
     */
    public function state(string $raw, DateTimeInterface $now): array
    {
        $token = $this->find($raw);
        if ($token === null) {
            return ['state' => 'INVALID'];
        }
        if ($token->completed_at !== null) {
            return ['state' => 'USED'];
        }
        $assessment = Assessment::findOrFail($token->assessment_id);
        $window = SurveyWindow::state($assessment->status, $assessment->survey_opens_at, $assessment->survey_closes_at, $now);
        if ($window !== 'OPEN') {
            return ['state' => $window, 'opensAt' => $assessment->survey_opens_at, 'closesAt' => $assessment->survey_closes_at];
        }

        return ['state' => 'READY', 'token' => $token, 'assessment' => $assessment, 'closesAt' => $assessment->survey_closes_at];
    }

    /**
     * Isi survei untuk peramban. Pernyataan dikirim dalam urutan acak yang tetap per responden (benih: hash token),
     * tanpa tingkatnya. Butir iklim dikelompokkan per dimensi; satu dimensi satu layar.
     *
     * @return array<string, mixed>
     */
    public function payload(string $raw, AccessToken $token, Assessment $assessment): array
    {
        $instrument = $this->instrument($assessment->instrument_version_id);
        $seed = TokenCodec::hash($raw);
        $consent = $assessment->parameter_snapshot['consent'] ?? ['id' => $assessment->consent_text_id, 'en' => $assessment->consent_text_en];

        return [
            'organization' => Organization::whereKey($assessment->organization_id)->value('name'),
            'consent' => ['id' => (string) ($consent['id'] ?? ''), 'en' => (string) ($consent['en'] ?? '')],
            'closesAt' => $assessment->survey_closes_at?->toIso8601String(),
            'needsStratum' => $token->stratum_id === null,
            'strata' => $token->stratum_id === null
                ? Stratum::where('assessment_id', $assessment->id)->orderBy('code')->get(['id', 'name', 'job_titles'])
                    ->map(fn (Stratum $s) => ['id' => $s->id, 'name' => $s->name, 'jobTitles' => array_values($s->job_titles ?? [])])->all()
                : [],
            'characteristics' => array_map(fn (array $c) => [
                'id' => $c['id'],
                'code' => $c['code'],
                'name' => $c['name'],
                'statements' => array_map(
                    fn (array $s) => ['id' => $s['id'], 'text' => $s['text']],
                    SurveyRules::respondentOrder($c['statements'], $seed),
                ),
            ], $instrument['characteristics']),
            'climateScreens' => $instrument['climateScreens'],
            // Kunci draf di perangkat: bagian hash token, bukan token itu sendiri.
            'draftKey' => substr($seed, 0, 24),
        ];
    }

    /** Menandai tautan pernah dibuka (dibulatkan ke jam), agar pengingat tidak mengganti token yang sedang dipakai. */
    public function markOpened(string $raw, DateTimeInterface $now): void
    {
        if (! TokenCodec::looksValid($raw)) {
            return;
        }
        AccessToken::where('token_hash', TokenCodec::hash($raw))->where('kind', 'SURVEY')
            ->whereNull('first_opened_at')->whereNull('revoked_at')->whereNull('completed_at')
            ->update(['first_opened_at' => SurveyRules::roundToNearestHour($now)]);
    }

    /**
     * Pengiriman survei dalam satu transaksi (docs/02 bagian 4 butir 2): token dikunci dan ditandai selesai, lalu
     * jawaban dibuat dengan unit dan strata yang disalin dari token, tanpa rujukan ke token maupun daftar responden,
     * dengan tanggal tanpa jam dan durasi dalam rentang.
     *
     * @param  array{language: string, stratumId: string|null, durationSeconds: int, characteristics: list<array{characteristicId: string, statementId: string|null}>, climate: list<array{itemId: string, value: int}>}  $input
     * @return array{ok: bool, status: int, code: string|null}
     */
    public function submit(string $raw, array $input, DateTimeInterface $now): array
    {
        // Pemeriksaan awal tanpa kunci, agar koneksi basis data hanya ditahan selama penguncian dan penulisan.
        $pre = $this->find($raw);
        if ($pre === null) {
            return $this->fail(404, 'INVALID_TOKEN');
        }
        if ($pre->completed_at !== null) {
            return $this->fail(409, 'ALREADY_SUBMITTED');
        }
        $assessment = Assessment::findOrFail($pre->assessment_id);
        $window = SurveyWindow::state($assessment->status, $assessment->survey_opens_at, $assessment->survey_closes_at, $now);
        if ($window !== 'OPEN') {
            return $this->fail(409, $window === 'CLOSED' ? 'SURVEY_CLOSED' : 'SURVEY_NOT_OPEN');
        }

        $structure = $this->structure($assessment->instrument_version_id);
        $checked = SubmissionCheck::check($structure['statementLevels'], $structure['itemIds'], $input['characteristics'], $input['climate']);
        if (! $checked['ok']) {
            return $this->fail(422, $checked['code']);
        }
        $flags = $this->qualityFlags($assessment, $checked, $input['durationSeconds']);

        return DB::transaction(function () use ($pre, $assessment, $input, $checked, $flags, $now) {
            // Kunci baris token: dua kiriman bersamaan dengan token yang sama tidak boleh sama-sama tersimpan.
            $token = AccessToken::whereKey($pre->id)->lockForUpdate()->first();
            if ($token === null || $token->revoked_at !== null) {
                return $this->fail(404, 'INVALID_TOKEN');
            }
            if ($token->completed_at !== null) {
                return $this->fail(409, 'ALREADY_SUBMITTED');
            }
            $fresh = Assessment::findOrFail($assessment->id);
            $window = SurveyWindow::state($fresh->status, $fresh->survey_opens_at, $fresh->survey_closes_at, $now);
            if ($window !== 'OPEN') {
                return $this->fail(409, $window === 'CLOSED' ? 'SURVEY_CLOSED' : 'SURVEY_NOT_OPEN');
            }

            $stratumId = $token->stratum_id;
            if ($stratumId === null) {
                $stratumId = $input['stratumId'] === null ? null
                    : Stratum::where('assessment_id', $assessment->id)->whereKey($input['stratumId'])->value('id');
                if ($stratumId === null) {
                    return $this->fail(422, 'STRATUM_REQUIRED');
                }
            }

            $rounded = SurveyRules::roundToNearestHour($now);
            $token->forceFill(['completed_at' => $rounded, 'consent_at' => $rounded, 'stratum_id' => $stratumId])->save();

            $responseId = SurveyResponse::randomId();
            DB::table('survey_responses')->insert([
                'id' => $responseId,
                'assessment_id' => $assessment->id,
                'unit_id' => $token->unit_id,
                'stratum_id' => $stratumId,
                'instrument_version_id' => $assessment->instrument_version_id,
                'language' => $input['language'],
                'submitted_on' => SurveyRules::wibDate($now),
                'duration_bucket' => DurationBucket::fromSeconds($input['durationSeconds'])->value,
                'quality_flags' => json_encode($flags),
            ]);
            DB::table('characteristic_answers')->insert(array_map(fn (array $a) => [
                'id' => SurveyResponse::randomId(),
                'survey_response_id' => $responseId,
                'characteristic_id' => $a['characteristicId'],
                'level' => $a['level'],
            ], $checked['characteristicAnswers']));
            DB::table('climate_answers')->insert(array_map(fn (array $a) => [
                'id' => SurveyResponse::randomId(),
                'survey_response_id' => $responseId,
                'climate_item_id' => $a['itemId'],
                'value' => $a['value'],
            ], $checked['climateAnswers']));

            return ['ok' => true, 'status' => 201, 'code' => null];
        });
    }

    /** Token survei yang belum dicabut, atau null. */
    private function find(string $raw): ?AccessToken
    {
        if (! TokenCodec::looksValid($raw)) {
            return null;
        }
        $token = AccessToken::where('token_hash', TokenCodec::hash($raw))->first();

        return $token === null || $token->kind !== 'SURVEY' || $token->revoked_at !== null ? null : $token;
    }

    /**
     * Isi instrumen untuk peramban, disimpan di cache karena satu versi instrumen tidak pernah berubah.
     *
     * @return array{characteristics: list<array<string, mixed>>, climateScreens: list<list<array<string, mixed>>>}
     */
    private function instrument(string $versionId): array
    {
        return Cache::rememberForever("survey:instrument:{$versionId}", function () use ($versionId) {
            $characteristics = Characteristic::where('instrument_version_id', $versionId)->orderBy('position')->with('statements')->get();
            $dimensions = ClimateDimension::where('instrument_version_id', $versionId)->orderBy('position')->with('items')->get();

            return [
                'characteristics' => $characteristics->map(fn (Characteristic $c) => [
                    'id' => $c->id,
                    'code' => $c->code,
                    'name' => ['id' => $c->name_id, 'en' => $c->name_en],
                    'statements' => $c->statements->map(fn ($s) => ['id' => $s->id, 'text' => ['id' => $s->text_id, 'en' => $s->text_en]])->values()->all(),
                ])->all(),
                'climateScreens' => $dimensions->filter(fn ($d) => $d->items->isNotEmpty())->values()->map(
                    fn (ClimateDimension $d) => $d->items->map(fn ($i) => ['id' => $i->id, 'text' => ['id' => $i->text_id, 'en' => $i->text_en]])->values()->all(),
                )->all(),
            ];
        });
    }

    /**
     * Struktur instrumen untuk memeriksa kiriman: tingkat setiap pernyataan dan daftar butir iklim.
     *
     * @return array{statementLevels: array<string, array<string, int>>, itemIds: list<string>}
     */
    private function structure(string $versionId): array
    {
        return Cache::rememberForever("survey:structure:{$versionId}", function () use ($versionId) {
            $levels = [];
            foreach (Characteristic::where('instrument_version_id', $versionId)->with('statements:id,characteristic_id,level')->get(['id']) as $c) {
                $levels[$c->id] = $c->statements->pluck('level', 'id')->map(fn ($l) => (int) $l)->all();
            }
            $items = DB::table('climate_items')->join('climate_dimensions', 'climate_dimensions.id', '=', 'climate_items.climate_dimension_id')
                ->where('climate_dimensions.instrument_version_id', $versionId)
                ->orderBy('climate_dimensions.position')->orderBy('climate_items.position')->pluck('climate_items.id')->all();

            return ['statementLevels' => $levels, 'itemIds' => $items];
        });
    }

    /**
     * Tanda mutu sesuai docs/03 bagian 8. Durasi tepat hanya dipakai di sini dan tidak disimpan.
     *
     * @param  array{characteristicAnswers: list<array{level: int|null}>, climateAnswers: list<array{value: int}>}  $checked
     * @return list<string>
     */
    private function qualityFlags(Assessment $assessment, array $checked, int $durationSeconds): array
    {
        $counts = SurveyResponse::where('assessment_id', $assessment->id)
            ->selectRaw('duration_bucket, count(*) as n')->groupBy('duration_bucket')->pluck('n', 'duration_bucket')
            ->map(fn ($n) => (int) $n)->all();
        $quality = $assessment->parameter_snapshot['parameters']['quality'] ?? $assessment->parameter_draft['quality'] ?? [];
        $flags = DataQuality::responseQualityFlags(
            new ResponseForQuality(
                array_column($checked['climateAnswers'], 'value'),
                array_column($checked['characteristicAnswers'], 'level'),
                $durationSeconds / 60,
            ),
            DurationBucket::estimatedMedianMinutes($counts),
            new QualityThresholds(
                (float) ($quality['straightliningShare'] ?? 0.9),
                (float) ($quality['speedingFractionOfMedian'] ?? 0.33),
                (float) ($quality['dontKnowShareMax'] ?? 0.5),
            ),
        );

        return array_map(fn ($flag) => $flag->value, $flags);
    }

    /** @return array{ok: false, status: int, code: string} */
    private function fail(int $status, string $code): array
    {
        return ['ok' => false, 'status' => $status, 'code' => $code];
    }
}
