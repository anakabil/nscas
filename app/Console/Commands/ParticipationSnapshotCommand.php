<?php

namespace App\Console\Commands;

use App\Domain\Workflow\AssessmentStatus;
use App\Models\Assessment;
use App\Models\ParticipationSnapshot;
use App\Services\Respondents\ParticipationReport;
use Illuminate\Console\Command;

/**
 * Cuplikan partisipasi harian pukul 23.00 WIB (routes/console.php) untuk grafik tren. Menyimpan jumlah mentah dari
 * token; ambang sel diterapkan saat ditampilkan.
 */
class ParticipationSnapshotCommand extends Command
{
    protected $signature = 'nscas:participation-snapshot';

    protected $description = 'Simpan cuplikan partisipasi harian asesmen yang sedang mengumpulkan data';

    public function handle(): int
    {
        $takenOn = now()->setTimezone('Asia/Jakarta')->toDateString();
        $count = 0;
        foreach (Assessment::where('status', AssessmentStatus::DataCollection)->get() as $assessment) {
            ParticipationSnapshot::updateOrCreate(
                ['assessment_id' => $assessment->id, 'taken_on' => $takenOn],
                ['data' => ParticipationReport::snapshotData($assessment)],
            );
            $count++;
        }
        $this->info("Cuplikan disimpan: {$count}");

        return self::SUCCESS;
    }
}
