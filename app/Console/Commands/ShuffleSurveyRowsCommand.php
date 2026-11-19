<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\AsCommand;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Mengacak urutan fisik baris jawaban survei (dibawa dari v1 ops/maintenance/shuffle-survey-rows.sql).
 *
 * Urutan fisik baris di PostgreSQL dan di berkas cadangan mengikuti urutan pengiriman, sehingga pihak yang dapat
 * membaca basis data secara langsung dapat mencocokkannya dengan waktu selesai token. CLUSTER menulis ulang tabel
 * menurut kunci utama, yaitu UUID versi 4 acak, sehingga urutan pengiriman hilang. Dijalankan terjadwal setiap malam
 * (routes/console.php) dan dapat dijalankan manual setelah masa survei ditutup. CLUSTER mengunci tabel sebentar.
 */
#[AsCommand(name: 'nscas:shuffle-survey-rows', description: 'Tulis ulang tabel jawaban survei dalam urutan UUID acak')]
class ShuffleSurveyRowsCommand extends Command
{
    protected $signature = 'nscas:shuffle-survey-rows';

    public function handle(): int
    {
        foreach (['survey_responses', 'characteristic_answers', 'climate_answers'] as $table) {
            DB::statement("CLUSTER {$table} USING {$table}_pkey");
            DB::statement("ANALYZE {$table}");
        }
        $this->info('Urutan fisik jawaban survei diacak.');

        return self::SUCCESS;
    }
}
