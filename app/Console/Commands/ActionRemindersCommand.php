<?php

namespace App\Console\Commands;

use App\Domain\Workflow\AssessmentStatus;
use App\Jobs\SendActionReminders;
use App\Models\Assessment;
use Illuminate\Console\Command;

/** Pengingat tenggat rencana aksi setiap pukul 08.00 WIB untuk asesmen yang rencana aksinya sudah diterbitkan. */
class ActionRemindersCommand extends Command
{
    protected $signature = 'nscas:action-reminders';

    protected $description = 'Mengirim pengingat tenggat rencana aksi';

    public function handle(): int
    {
        $ids = Assessment::whereNotNull('action_plan_published_at')
            ->whereIn('status', [AssessmentStatus::ActionPlanning, AssessmentStatus::Reported, AssessmentStatus::Monitoring])->pluck('id');
        foreach ($ids as $id) {
            SendActionReminders::dispatch($id);
        }
        $this->info(sprintf('Pengingat rencana aksi dijadwalkan untuk %d asesmen.', $ids->count()));

        return self::SUCCESS;
    }
}
