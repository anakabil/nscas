<?php

namespace App\Console\Commands;

use App\Domain\Respondents\ReminderPolicy;
use App\Domain\Respondents\SurveyWindow;
use App\Domain\Workflow\AssessmentStatus;
use App\Jobs\SendSurveyReminder;
use App\Models\AccessToken;
use App\Models\Assessment;
use Illuminate\Console\Attributes\AsCommand;
use Illuminate\Console\Command;

/**
 * Penjadwal pengingat harian pukul 08.00 WIB (routes/console.php): mengantre satu pekerjaan per token undangan surel
 * yang belum selesai dan memenuhi App\Domain\Respondents\ReminderPolicy, hanya selama masa survei terbuka.
 */
#[AsCommand(name: 'nscas:survey-reminders', description: 'Antrekan pengingat survei untuk undangan surel yang belum selesai')]
class SurveyRemindersCommand extends Command
{
    protected $signature = 'nscas:survey-reminders';

    public function handle(): int
    {
        $now = now();
        $cutoff = $now->copy()->subDays(ReminderPolicy::GAP_DAYS);
        $queued = 0;
        $assessments = Assessment::where('status', AssessmentStatus::DataCollection)->get(['id', 'status', 'survey_opens_at', 'survey_closes_at']);
        foreach ($assessments as $assessment) {
            if (! SurveyWindow::isOpen($assessment->status, $assessment->survey_opens_at, $assessment->survey_closes_at, $now)) {
                continue;
            }
            AccessToken::where('assessment_id', $assessment->id)
                ->where('kind', 'SURVEY')->where('channel', 'EMAIL')
                ->whereNull('revoked_at')->whereNull('completed_at')->whereNotNull('roster_entry_id')
                ->where('reminder_count', '<', ReminderPolicy::MAX_REMINDERS)
                ->where(fn ($q) => $q->where('last_reminder_at', '<=', $cutoff)->orWhere(fn ($q) => $q->whereNull('last_reminder_at')->where('issued_at', '<=', $cutoff)))
                ->pluck('id')
                ->each(function (string $id) use (&$queued) {
                    SendSurveyReminder::dispatch($id);
                    $queued++;
                });
        }
        $this->info("Pengingat diantrekan: {$queued}");

        return self::SUCCESS;
    }
}
