<?php

namespace App\Services\SelfAssessment;

use App\Domain\Access\Role;
use App\Domain\Respondents\SurveyWindow;
use App\Jobs\SendSelfAssessmentLink;
use App\Models\AccessToken;
use App\Models\Assessment;
use App\Models\Characteristic;
use App\Models\EvidenceItem;
use App\Models\SelfAssessment;
use App\Models\Unit;
use App\Services\Respondents\SurveyLinks;
use App\Support\Audit;
use App\Support\RuleViolation;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\URL;

/**
 * Penerbitan dan pemantauan penilaian mandiri dari konsol (docs/01 M4), dibawa dari v1
 * src/lib/self-assessment/service.ts. Pemanggil sudah memeriksa hak akses. Tautan hanya dikembalikan sekali; basis
 * data menyimpan hash token.
 */
final class SelfAssessmentAdmin
{
    /** @return array{id: string, link: string} */
    public function issue(Assessment $assessment, string $name, string $position, string $unitId, Role $actorRole): array
    {
        return DB::transaction(function () use ($assessment, $name, $position, $unitId, $actorRole) {
            $locked = $this->lockOpen($assessment);
            $unit = Unit::where('assessment_id', $locked->id)->findOrFail($unitId);
            $issued = SurveyLinks::issue($locked, ['unit_id' => $unit->id, 'stratum_id' => null, 'kind' => 'SELF_ASSESSMENT', 'channel' => 'LINK']);
            $sa = SelfAssessment::create([
                'assessment_id' => $locked->id,
                'unit_id' => $unit->id,
                'access_token_id' => $issued['token']->id,
                'respondent_name' => $name,
                'respondent_position' => $position,
            ]);
            Audit::record('selfAssessment.issue', $sa, ['after' => ['respondentName' => $name, 'respondentPosition' => $position, 'unitId' => $unit->id]], $locked, $actorRole);

            return ['id' => $sa->id, 'link' => self::link($issued['raw'])];
        });
    }

    /** @return list<array<string, mixed>> */
    public function list(Assessment $assessment): array
    {
        $total = Characteristic::where('instrument_version_id', $assessment->instrument_version_id)->count();

        return SelfAssessment::where('assessment_id', $assessment->id)->orderBy('created_at')->orderBy('respondent_name')
            ->with(['unit:id,name', 'accessToken:id,revoked_at,first_opened_at'])
            ->withCount(['answers as answered_count' => fn ($q) => $q->whereNotNull('level')])
            ->get()
            ->map(fn (SelfAssessment $sa) => [
                'id' => $sa->id,
                'name' => $sa->respondent_name,
                'position' => $sa->respondent_position,
                'unit' => $sa->unit->name,
                'status' => match (true) {
                    $sa->status === 'SUBMITTED' => 'SUBMITTED',
                    $sa->accessToken->revoked_at !== null => 'REVOKED',
                    $sa->accessToken->first_opened_at === null => 'NOT_OPENED',
                    default => 'DRAFT',
                },
                'issuedAt' => $sa->created_at->toIso8601String(),
                'submittedAt' => $sa->submitted_at?->toIso8601String(),
                'answered' => (int) $sa->answered_count,
                'emailed' => $sa->respondent_email !== null,
                'total' => $total,
            ])->all();
    }

    public function revoke(Assessment $assessment, string $id, Role $actorRole): void
    {
        DB::transaction(function () use ($assessment, $id, $actorRole) {
            $locked = $this->lockOpen($assessment);
            $sa = $this->changeable($locked, $id);
            $token = AccessToken::findOrFail($sa->access_token_id);
            if ($token->revoked_at !== null) {
                throw RuleViolation::invalid('form', 'NO_ACTIVE_TOKEN');
            }
            $token->forceFill(['revoked_at' => now(), 'revoked_reason' => 'MANUAL'])->save();
            Audit::record('selfAssessment.revoke', $sa, [], $locked, $actorRole);
        });
    }

    /** Tautan baru menggantikan tautan lama; draf yang sudah diisi tetap tersimpan. */
    public function reissue(Assessment $assessment, string $id, Role $actorRole): string
    {
        return DB::transaction(function () use ($assessment, $id, $actorRole) {
            $locked = $this->lockOpen($assessment);
            $sa = $this->changeable($locked, $id);
            $old = AccessToken::findOrFail($sa->access_token_id);
            if ($old->revoked_at === null) {
                $old->forceFill(['revoked_at' => now(), 'revoked_reason' => 'REISSUED'])->save();
            }
            $issued = SurveyLinks::issue($locked, ['unit_id' => $sa->unit_id, 'stratum_id' => null, 'kind' => 'SELF_ASSESSMENT', 'channel' => 'LINK']);
            $sa->forceFill(['access_token_id' => $issued['token']->id])->save();
            Audit::record('selfAssessment.reissue', $sa, [], $locked, $actorRole);

            return self::link($issued['raw']);
        });
    }

    /**
     * Mengirim tautan baru lewat surel (keputusan R4). Alamat disimpan terenkripsi; token dibuat oleh pekerja antrean
     * tepat sebelum surel dikirim, sehingga tautan lama berhenti berlaku saat surel terkirim.
     */
    public function sendByEmail(Assessment $assessment, string $id, string $email, Role $actorRole): void
    {
        DB::transaction(function () use ($assessment, $id, $email, $actorRole) {
            $locked = $this->lockOpen($assessment);
            $sa = $this->changeable($locked, $id);
            $sa->forceFill(['respondent_email' => $email])->save();
            // Alamat tidak ditulis ke jejak audit; cukup fakta bahwa tautan dikirim lewat surel.
            Audit::record('selfAssessment.email', $sa, ['after' => ['channel' => 'EMAIL']], $locked, $actorRole);
            SendSelfAssessmentLink::dispatch($locked->id, $sa->id)->afterCommit();
        });
    }

    /**
     * Rincian jawaban untuk konsol: tingkat dan pernyataan yang dipilih, alasan, dan bukti.
     *
     * @return array<string, mixed>
     */
    public function detail(Assessment $assessment, string $id): array
    {
        $sa = SelfAssessment::where('assessment_id', $assessment->id)->with(['unit:id,name', 'answers'])->findOrFail($id);
        $answers = $sa->answers->keyBy('characteristic_id');
        $characteristics = Characteristic::where('instrument_version_id', $assessment->instrument_version_id)->orderBy('position')->with('statements')->get();
        // Judul bukti yang ditautkan (fase R5); bukti yang kemudian dihapus tetap disebut agar jejak penilaian utuh.
        $evidence = EvidenceItem::where('assessment_id', $assessment->id)
            ->whereIn('id', $sa->answers->flatMap(fn ($a) => $a->evidence_ids ?? [])->unique()->values()->all())
            ->get(['id', 'title', 'version'])->keyBy('id');

        return [
            'id' => $sa->id,
            'name' => $sa->respondent_name,
            'position' => $sa->respondent_position,
            'unit' => $sa->unit->name,
            'status' => $sa->status,
            'submittedAt' => $sa->submitted_at?->toIso8601String(),
            'rows' => $characteristics->map(function (Characteristic $c) use ($answers, $evidence) {
                $answer = $answers->get($c->id);
                $level = $answer?->level;

                return [
                    'code' => $c->code,
                    'name' => $c->name_id,
                    'level' => $level,
                    'statement' => $level === null ? null : $c->statements->firstWhere('level', $level)?->text_id,
                    'justification' => $answer?->justification ?: null,
                    'evidenceCount' => count($answer?->evidence_ids ?? []),
                    'evidence' => array_values(array_filter(array_map(
                        fn (string $id) => $evidence->has($id) ? ['title' => $evidence[$id]->title, 'version' => $evidence[$id]->version] : null,
                        $answer?->evidence_ids ?? [],
                    ))),
                ];
            })->all(),
        ];
    }

    public static function link(string $raw): string
    {
        return URL::to('/sa/'.$raw);
    }

    /** Penilaian mandiri diterbitkan dan diisi setelah parameter dikunci sampai pengumpulan data ditutup. */
    private function lockOpen(Assessment $assessment): Assessment
    {
        $locked = Assessment::whereKey($assessment->id)->lockForUpdate()->firstOrFail();
        if (! $locked->status->parametersLocked()) {
            throw RuleViolation::locked('DISTRIBUTION_NOT_OPEN');
        }
        if (! SurveyWindow::distributionOpen($locked->status)) {
            throw RuleViolation::locked('DISTRIBUTION_CLOSED');
        }

        return $locked;
    }

    private function changeable(Assessment $assessment, string $id): SelfAssessment
    {
        $sa = SelfAssessment::where('assessment_id', $assessment->id)->whereKey($id)->lockForUpdate()->first();
        if ($sa === null) {
            throw new RuleViolation(404, 'NOT_FOUND');
        }
        if ($sa->status === 'SUBMITTED') {
            throw RuleViolation::locked('SELF_ASSESSMENT_SUBMITTED');
        }

        return $sa;
    }
}
