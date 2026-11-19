<?php

namespace App\Jobs;

use App\Domain\Respondents\ReminderPolicy;
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
 * Satu pengingat survei (docs/01 M2), dibawa dari v1 src/lib/jobs/reminders.ts. Karena token mentah tidak disimpan,
 * pengingat untuk token yang belum dibuka memuat token baru dan token lama dicabut (ROTATED_REMINDER) setelah surel
 * terkirim. Token yang sudah dibuka tidak diganti agar isian di perangkat responden tetap terpakai; surelnya meminta
 * responden melanjutkan dari tautan semula.
 */
class SendSurveyReminder implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /** @var list<int> */
    public array $backoff = [60, 300];

    public function __construct(public string $tokenId) {}

    public function handle(): void
    {
        $now = now();
        $prepared = DB::transaction(function () use ($now) {
            $rosterEntryId = AccessToken::whereKey($this->tokenId)->value('roster_entry_id');
            if ($rosterEntryId === null) {
                return null;
            }
            $entry = RosterEntry::whereKey($rosterEntryId)->lockForUpdate()->first();
            $token = AccessToken::find($this->tokenId);
            $assessment = $token === null ? null : Assessment::with('organization')->find($token->assessment_id);
            if ($entry === null || $entry->email === null || $token === null || $assessment === null) {
                return null;
            }
            $eligible = ReminderPolicy::eligible($token->channel, $token->revoked_at, $token->completed_at, $token->reminder_count, $token->issued_at, $token->last_reminder_at, $now)
                && SurveyWindow::isOpen($assessment->status, $assessment->survey_opens_at, $assessment->survey_closes_at, $now);
            $tokens = $entry->tokens()->where('kind', 'SURVEY')->where(fn ($q) => $q->whereNull('revoked_at')->orWhereNotNull('completed_at'))->get(['id', 'completed_at']);
            // Responden yang sudah menyelesaikan survei dengan token mana pun tidak diingatkan.
            if (! $eligible || $tokens->contains(fn (AccessToken $t) => $t->completed_at !== null)) {
                return null;
            }
            // Token lain yang masih aktif dicabut agar satu responden tidak memegang dua token sah.
            $strays = $tokens->pluck('id')->reject(fn ($id) => $id === $token->id);
            if ($strays->isNotEmpty()) {
                AccessToken::whereIn('id', $strays)->update(['revoked_at' => $now, 'revoked_reason' => 'ROTATED_REMINDER']);
            }
            $count = $token->reminder_count + 1;
            $rotated = $token->first_opened_at !== null ? null : SurveyLinks::issue($assessment, [
                'unit_id' => $token->unit_id,
                'stratum_id' => $token->stratum_id,
                'roster_entry_id' => $entry->id,
                'channel' => 'EMAIL',
                'reminder_count' => $count,
                'last_reminder_at' => $now,
            ]);

            return [$entry, $assessment, $token, $rotated, $count];
        });
        if ($prepared === null) {
            return;
        }

        /** @var array{0: RosterEntry, 1: Assessment, 2: AccessToken, 3: array{token: AccessToken, raw: string}|null, 4: int} $prepared */
        [$entry, $assessment, $token, $rotated, $count] = $prepared;
        try {
            Mail::to($entry->email)->send(new SurveyMail(
                $rotated === null ? 'continue' : 'reminder',
                $entry->full_name,
                $assessment->organization->name,
                $rotated === null ? null : SurveyLinks::survey($rotated['raw']),
                $assessment->survey_closes_at,
            ));
        } catch (Throwable $e) {
            if ($rotated !== null) {
                $rotated['token']->forceFill(['revoked_at' => now(), 'revoked_reason' => 'SEND_FAILED'])->save();
            }
            throw $e;
        }

        DB::transaction(function () use ($entry, $assessment, $token, $rotated, $count, $now) {
            $old = AccessToken::whereKey($token->id)->lockForUpdate()->first();
            if ($rotated !== null) {
                if ($old->first_opened_at !== null || $old->completed_at !== null) {
                    // Responden membuka tautan lama saat pengingat sedang dikirim: tautan lama tetap berlaku.
                    $rotated['token']->forceFill(['revoked_at' => now(), 'revoked_reason' => 'ROTATED_REMINDER'])->save();
                } elseif ($old->revoked_at === null) {
                    $old->forceFill(['revoked_at' => now(), 'revoked_reason' => 'ROTATED_REMINDER'])->save();
                }
            } else {
                $old->forceFill(['reminder_count' => $count, 'last_reminder_at' => $now])->save();
            }
            Audit::record('reminder.sent', $entry, ['after' => ['kind' => $rotated === null ? 'continue' : 'reminder', 'reminderNumber' => $count]], $assessment);
        });
    }
}
