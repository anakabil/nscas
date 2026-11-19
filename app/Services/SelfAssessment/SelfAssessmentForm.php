<?php

namespace App\Services\SelfAssessment;

use App\Domain\Respondents\SurveyWindow;
use App\Domain\Respondents\TokenCodec;
use App\Domain\SelfAssessment\SelfAssessmentRules;
use App\Domain\Survey\SurveyRules;
use App\Models\AccessToken;
use App\Models\Assessment;
use App\Models\Characteristic;
use App\Models\EvidenceItem;
use App\Models\Organization;
use App\Models\SelfAssessment;
use App\Models\SelfAssessmentAnswer;
use App\Support\Audit;
use Illuminate\Support\Facades\DB;

/**
 * Formulir penilaian mandiri bertoken /sa/{token} (docs/01 M4), dibawa dari v1 src/lib/self-assessment/service.ts.
 * Tidak anonim: nama dan jabatan tersimpan bersama jawaban, draf disimpan di server, dan setiap perubahan dicatat
 * di jejak audit (aturan 6). Pengisi tidak memiliki akun, sehingga pelaku di jejak audit kosong dan identitasnya
 * adalah penilaian mandiri yang diubah.
 */
final class SelfAssessmentForm
{
    /** @return array{state: 'INVALID'|'CLOSED'|'READY'|'SUBMITTED', selfAssessment?: SelfAssessment, assessment?: Assessment} */
    public function state(string $raw): array
    {
        $token = $this->token($raw);
        $sa = $token === null ? null : SelfAssessment::where('access_token_id', $token->id)->first();
        if ($sa === null) {
            return ['state' => 'INVALID'];
        }
        $assessment = Assessment::findOrFail($sa->assessment_id);
        if ($sa->status === 'SUBMITTED') {
            return ['state' => 'SUBMITTED', 'selfAssessment' => $sa, 'assessment' => $assessment];
        }

        return SurveyWindow::distributionOpen($assessment->status)
            ? ['state' => 'READY', 'selfAssessment' => $sa, 'assessment' => $assessment]
            : ['state' => 'CLOSED'];
    }

    /**
     * Isi formulir: identitas, karakteristik dengan pernyataan dalam urutan acak tetap per tautan tanpa nomor tingkat
     * (seperti survei, agar tidak menggiring jawaban), dan jawaban yang sudah tersimpan.
     *
     * @return array<string, mixed>
     */
    public function payload(string $raw, SelfAssessment $sa, Assessment $assessment): array
    {
        $answers = SelfAssessmentAnswer::where('self_assessment_id', $sa->id)->get()->keyBy('characteristic_id');
        $seed = TokenCodec::hash($raw);
        $characteristics = Characteristic::where('instrument_version_id', $assessment->instrument_version_id)->orderBy('position')->with('statements')->get();

        return [
            'organization' => Organization::whereKey($assessment->organization_id)->value('name'),
            'profile' => ['name' => $sa->respondent_name, 'position' => $sa->respondent_position],
            'status' => $sa->status,
            'submittedAt' => $sa->submitted_at?->toIso8601String(),
            'minLength' => SelfAssessmentRules::JUSTIFICATION_MIN_LENGTH,
            'maxLength' => SelfAssessmentRules::JUSTIFICATION_MAX_LENGTH,
            // Bukti versi terbaru yang belum dihapus (fase R5), untuk ditautkan per karakteristik.
            'evidence' => $this->evidenceChoices($assessment),
            'characteristics' => $characteristics->map(function (Characteristic $c) use ($answers, $seed) {
                $answer = $answers->get($c->id);
                $statements = $c->statements->map(fn ($s) => ['id' => $s->id, 'level' => $s->level, 'text' => ['id' => $s->text_id, 'en' => $s->text_en]])->values()->all();

                return [
                    'id' => $c->id,
                    'code' => $c->code,
                    'name' => ['id' => $c->name_id, 'en' => $c->name_en],
                    'statements' => array_map(fn ($s) => ['id' => $s['id'], 'text' => $s['text']], SurveyRules::respondentOrder($statements, $seed)),
                    'answer' => [
                        'statementId' => $answer?->level === null ? null : collect($statements)->firstWhere('level', $answer->level)['id'] ?? null,
                        'justification' => (string) ($answer?->justification ?? ''),
                        'evidenceIds' => $answer?->evidence_ids ?? [],
                    ],
                ];
            })->all(),
        ];
    }

    /**
     * Bukti versi terbaru yang belum dihapus, beserta karakteristik yang dipetakan, urut judul.
     *
     * @return list<array{id: string, title: string, version: int, characteristicIds: list<string>}>
     */
    private function evidenceChoices(Assessment $assessment): array
    {
        return EvidenceItem::where('assessment_id', $assessment->id)
            ->whereNull('deleted_at')
            ->whereNotExists(fn ($q) => $q->select(DB::raw(1))->from('evidence_items as newer')->whereColumn('newer.supersedes_id', 'evidence_items.id'))
            ->with('links:id,evidence_item_id,characteristic_id')
            ->orderBy('title')->orderBy('id')
            ->get(['id', 'title', 'version'])
            ->map(fn (EvidenceItem $e) => [
                'id' => $e->id,
                'title' => $e->title,
                'version' => $e->version,
                'characteristicIds' => $e->links->pluck('characteristic_id')->values()->all(),
            ])->all();
    }

    /** @return array{ok: bool, status: int, code: string|null} */
    public function saveProfile(string $raw, string $name, string $position): array
    {
        return DB::transaction(function () use ($raw, $name, $position) {
            $ctx = $this->lockForChange($raw);
            if (isset($ctx['error'])) {
                return $ctx['error'];
            }
            [$sa, $assessment] = [$ctx['sa'], $ctx['assessment']];
            $before = ['respondentName' => $sa->respondent_name, 'respondentPosition' => $sa->respondent_position];
            $sa->forceFill(['respondent_name' => $name, 'respondent_position' => $position])->save();
            Audit::record('selfAssessment.profile_update', $sa, ['before' => $before, 'after' => ['respondentName' => $name, 'respondentPosition' => $position]], $assessment);

            return $this->ok();
        });
    }

    /**
     * Draf satu karakteristik. Alasan boleh belum lengkap selama masih draf; tingkat ditentukan server dari id
     * pernyataan.
     *
     * @param  list<string>  $evidenceIds
     * @return array{ok: bool, status: int, code: string|null}
     */
    public function saveAnswer(string $raw, string $characteristicId, ?string $statementId, string $justification, array $evidenceIds): array
    {
        return DB::transaction(function () use ($raw, $characteristicId, $statementId, $justification, $evidenceIds) {
            $ctx = $this->lockForChange($raw);
            if (isset($ctx['error'])) {
                return $ctx['error'];
            }
            [$sa, $assessment] = [$ctx['sa'], $ctx['assessment']];
            $characteristic = Characteristic::where('instrument_version_id', $assessment->instrument_version_id)->with('statements')->find($characteristicId);
            if ($characteristic === null) {
                return $this->fail(422, 'UNKNOWN_ITEM');
            }
            $level = null;
            if ($statementId !== null) {
                $statement = $characteristic->statements->firstWhere('id', $statementId);
                if ($statement === null) {
                    return $this->fail(422, 'UNKNOWN_ITEM');
                }
                $level = $statement->level;
            }
            // Bukti yang ditautkan harus milik asesmen ini dan belum dihapus (fase R5).
            $evidenceIds = array_values(array_unique($evidenceIds));
            if ($evidenceIds !== [] && EvidenceItem::where('assessment_id', $assessment->id)->whereNull('deleted_at')->whereIn('id', $evidenceIds)->count() !== count($evidenceIds)) {
                return $this->fail(422, 'UNKNOWN_EVIDENCE');
            }
            $answer = SelfAssessmentAnswer::firstOrNew(['self_assessment_id' => $sa->id, 'characteristic_id' => $characteristic->id]);
            $before = $answer->exists ? ['level' => $answer->level, 'justification' => $answer->justification, 'evidenceIds' => $answer->evidence_ids] : null;
            $after = ['level' => $level, 'justification' => $justification, 'evidenceIds' => array_values(array_unique($evidenceIds))];
            $answer->forceFill(['level' => $level, 'justification' => $justification, 'evidence_ids' => $after['evidenceIds']])->save();
            Audit::record('selfAssessment.answer_save', $sa, [
                'characteristic' => $characteristic->code,
                'before' => $before,
                'after' => $after,
            ], $assessment);

            return $this->ok();
        });
    }

    /**
     * Mengirim penilaian mandiri. Setelah SUBMITTED, jawaban terkunci (docs/01 M4).
     *
     * @return array{ok: bool, status: int, code: string|null, missing?: list<array{characteristicId: string, reasons: list<string>}>}
     */
    public function submit(string $raw): array
    {
        return DB::transaction(function () use ($raw) {
            $ctx = $this->lockForChange($raw);
            if (isset($ctx['error'])) {
                return $ctx['error'];
            }
            [$sa, $assessment, $token] = [$ctx['sa'], $ctx['assessment'], $ctx['token']];
            $ids = Characteristic::where('instrument_version_id', $assessment->instrument_version_id)->orderBy('position')->pluck('id')->all();
            $answers = SelfAssessmentAnswer::where('self_assessment_id', $sa->id)->get()
                ->map(fn ($a) => ['characteristicId' => $a->characteristic_id, 'level' => $a->level, 'justification' => $a->justification])->all();
            $missing = SelfAssessmentRules::missingForSubmit($ids, $answers);
            if ($missing !== []) {
                return [...$this->fail(422, 'INCOMPLETE'), 'missing' => $missing];
            }
            $now = now();
            $sa->forceFill(['status' => 'SUBMITTED', 'submitted_at' => $now])->save();
            $token->forceFill(['completed_at' => $now])->save();
            Audit::record('selfAssessment.submit', $sa, ['after' => ['status' => 'SUBMITTED', 'answers' => count($answers)]], $assessment);

            return $this->ok();
        });
    }

    private function token(string $raw): ?AccessToken
    {
        if (! TokenCodec::looksValid($raw)) {
            return null;
        }
        $token = AccessToken::where('token_hash', TokenCodec::hash($raw))->first();

        return $token === null || $token->kind !== 'SELF_ASSESSMENT' || $token->revoked_at !== null ? null : $token;
    }

    /**
     * Mengunci penilaian mandiri milik token untuk diubah; menolak bila token tidak sah, sudah dikirim, atau ditutup.
     *
     * @return array{error: array{ok: false, status: int, code: string}}|array{sa: SelfAssessment, assessment: Assessment, token: AccessToken}
     */
    private function lockForChange(string $raw): array
    {
        $token = $this->token($raw);
        $sa = $token === null ? null : SelfAssessment::where('access_token_id', $token->id)->lockForUpdate()->first();
        if ($sa === null) {
            return ['error' => $this->fail(404, 'INVALID_TOKEN')];
        }
        if ($sa->status === 'SUBMITTED') {
            return ['error' => $this->fail(409, 'SELF_ASSESSMENT_SUBMITTED')];
        }
        $assessment = Assessment::findOrFail($sa->assessment_id);
        if (! SurveyWindow::distributionOpen($assessment->status)) {
            return ['error' => $this->fail(409, 'DISTRIBUTION_CLOSED')];
        }
        if ($token->first_opened_at === null) {
            $token->forceFill(['first_opened_at' => now()])->save();
        }

        return ['sa' => $sa, 'assessment' => $assessment, 'token' => $token];
    }

    /** @return array{ok: true, status: int, code: null} */
    private function ok(): array
    {
        return ['ok' => true, 'status' => 200, 'code' => null];
    }

    /** @return array{ok: false, status: int, code: string} */
    private function fail(int $status, string $code): array
    {
        return ['ok' => false, 'status' => $status, 'code' => $code];
    }
}
