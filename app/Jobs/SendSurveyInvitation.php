<?php

namespace App\Jobs;

use App\Domain\Respondents\SurveyWindow;
use App\Mail\SurveyMail;
use App\Models\AccessToken;
use App\Models\Assessment;
use App\Models\RosterEntry;
use App\Services\Respondents\SurveyLinks;
use App\Support\Audit;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Satu surel undangan survei per responden (docs/01 M2), dibawa dari v1 src/lib/jobs/invitations.ts. Token dibuat di
 * sini, tepat sebelum surel dikirim, sehingga token mentah hanya ada di memori pekerja dan di surel. Bila pengiriman
 * gagal, token itu dicabut (SEND_FAILED) dan pekerjaan diulang dengan token baru.
 */
class SendSurveyInvitation implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /** @var list<int> */
    public array $backoff = [60, 300];

    public function __construct(public string $assessmentId, public string $rosterEntryId) {}

    public function handle(): void
    {
        $prepared = DB::transaction(function () {
            $entry = RosterEntry::whereKey($this->rosterEntryId)->where('assessment_id', $this->assessmentId)->lockForUpdate()->first();
            // Dilewati bila responden dihapus, tanpa surel, sudah memiliki token terpakai, atau distribusi sudah ditutup.
            if ($entry === null || $entry->email === null) {
                return null;
            }
            if ($entry->tokens()->where('kind', 'SURVEY')->whereNull('revoked_at')->exists()) {
                return null;
            }
            $assessment = Assessment::with('organization')->find($this->assessmentId);
            if ($assessment === null || ! SurveyWindow::distributionOpen($assessment->status)) {
                return null;
            }
            $issued = SurveyLinks::issue($assessment, ['unit_id' => $entry->unit_id, 'stratum_id' => $entry->stratum_id, 'roster_entry_id' => $entry->id, 'channel' => 'EMAIL']);

            return [$entry, $assessment, $issued];
        });
        if ($prepared === null) {
            return;
        }

        /** @var array{0: RosterEntry, 1: Assessment, 2: array{token: AccessToken, raw: string}} $prepared */
        [$entry, $assessment, $issued] = $prepared;
        try {
            Mail::to($entry->email)->send(new SurveyMail('invitation', $entry->full_name, $assessment->organization->name, SurveyLinks::survey($issued['raw']), $assessment->survey_closes_at));
        } catch (Throwable $e) {
            $issued['token']->forceFill(['revoked_at' => now(), 'revoked_reason' => 'SEND_FAILED'])->save();
            throw $e;
        }
        Audit::record('invitation.sent', $entry, ['after' => ['kind' => 'invitation']], $assessment);
    }
}
