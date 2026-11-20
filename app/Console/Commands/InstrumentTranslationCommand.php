<?php

namespace App\Console\Commands;

use App\Domain\Instrument\TranslationCoverage;
use App\Domain\Workflow\AssessmentStatus;
use App\Models\Assessment;
use App\Models\Characteristic;
use App\Models\ClimateDimension;
use App\Models\InstrumentVersion;
use App\Support\Audit;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

/**
 * Memeriksa dan menerapkan terjemahan Inggris isi instrumen (docs/17). Tanpa --apply perintah ini hanya memeriksa
 * kelengkapan. Penerapan menuntut bagian persetujuan terisi, hanya mengisi kolom bahasa Inggris yang masih kosong, dan
 * tidak pernah mengubah teks bahasa Indonesia maupun teks Inggris yang sudah ada: perubahan kalimat pada versi yang
 * sudah dipakai dilakukan lewat versi instrumen baru.
 */
class InstrumentTranslationCommand extends Command
{
    protected $signature = 'nscas:instrument-translation
        {file : Berkas terjemahan, misalnya seed/terjemahan-instrumen-en-draf.json}
        {--apply : Terapkan ke basis data; tanpa pilihan ini hanya memeriksa}';

    protected $description = 'Memeriksa kelengkapan terjemahan Inggris isi instrumen, lalu menerapkannya setelah disetujui';

    public function handle(): int
    {
        $path = (string) $this->argument('file');
        $full = str_starts_with($path, '/') ? $path : base_path($path);
        $raw = is_file($full) ? file_get_contents($full) : false;
        $data = $raw === false ? null : json_decode($raw, true);
        if (! is_array($data)) {
            $this->error("Berkas {$path} tidak dapat dibaca sebagai JSON.");

            return self::FAILURE;
        }
        if (($data['language'] ?? null) !== 'en') {
            $this->error('Hanya terjemahan bahasa Inggris (language: "en") yang didukung.');

            return self::FAILURE;
        }
        $version = InstrumentVersion::where('code', (string) ($data['instrumentVersion'] ?? ''))->first();
        if ($version === null) {
            $this->error('Versi instrumen pada berkas tidak ditemukan di basis data.');

            return self::FAILURE;
        }

        $characteristics = Characteristic::with('statements')->where('instrument_version_id', $version->id)->orderBy('position')->get();
        $dimensions = ClimateDimension::with('items')->where('instrument_version_id', $version->id)->orderBy('position')->get();

        $problems = TranslationCoverage::problems(
            $characteristics->mapWithKeys(fn (Characteristic $c) => [$c->code => $c->statements->map(fn ($s) => (int) $s->level)->sort()->values()->all()])->all(),
            $dimensions->mapWithKeys(fn (ClimateDimension $d) => [$d->code => $d->items->map(fn ($i) => (string) $i->code)->values()->all()])->all(),
            $data,
        );
        if ($problems !== []) {
            $this->error('Terjemahan belum lengkap atau tidak sesuai instrumen '.$version->code.':');
            foreach ($problems as $problem) {
                $this->line("  - {$problem}");
            }

            return self::FAILURE;
        }

        // Pasangan model dan nilai yang akan diisi; teks yang sudah berisi tidak disentuh.
        $fills = [];
        $kept = 0;
        $queue = function (Model $model, string $column, string $text) use (&$fills, &$kept): void {
            if (TranslationCoverage::filled($model->getAttribute($column))) {
                $kept++;
            } else {
                $fills[] = [$model, $column, trim($text)];
            }
        };
        foreach ($characteristics as $c) {
            $entry = $data['characteristics'][$c->code];
            $queue($c, 'name_en', $entry['name']);
            foreach ($c->statements as $s) {
                $queue($s, 'text_en', $entry['levels'][(string) $s->level]);
            }
        }
        foreach ($dimensions as $d) {
            $entry = $data['climate'][$d->code];
            $queue($d, 'name_en', $entry['name']);
            foreach ($d->items as $i) {
                $queue($i, 'text_en', $entry['items'][$i->code]);
            }
        }

        $this->info(sprintf('Terjemahan lengkap untuk %s: %d teks akan diisi, %d teks Inggris yang sudah ada tidak diubah.', $version->code, count($fills), $kept));

        if (! $this->option('apply')) {
            $this->line(TranslationCoverage::approved($data)
                ? 'Pemeriksaan saja. Jalankan ulang dengan --apply untuk menerapkan.'
                : 'Pemeriksaan saja. Draf belum disetujui; isi approval.approvedBy dan approval.approvedOn sebelum --apply.');

            return self::SUCCESS;
        }
        if (! TranslationCoverage::approved($data)) {
            $this->error('Draf belum disetujui: isi approval.approvedBy dan approval.approvedOn terlebih dahulu (docs/17).');

            return self::FAILURE;
        }

        $collecting = Assessment::where('instrument_version_id', $version->id)->where('status', AssessmentStatus::DataCollection->value)->count();
        if ($collecting > 0) {
            $this->warn("{$collecting} asesmen dengan versi ini sedang mengumpulkan data. Responden berbahasa Inggris yang mengisi setelah ini akan melihat teks Inggris.");
        }

        DB::transaction(function () use ($fills, $kept, $version, $data, $raw, $collecting) {
            foreach ($fills as [$model, $column, $text]) {
                $model->forceFill([$column => $text])->save();
            }
            Audit::record('instrument.translation_applied', $version, [
                'language' => 'en',
                'filled' => count($fills),
                'kept' => $kept,
                'approvedBy' => $data['approval']['approvedBy'],
                'approvedOn' => $data['approval']['approvedOn'],
                'backTranslatedBy' => $data['approval']['backTranslatedBy'] ?? null,
                'fileSha256' => hash('sha256', (string) $raw),
                'assessmentsCollecting' => $collecting,
            ]);
        });

        $this->info(sprintf('Diterapkan: %d teks Inggris diisi dan dicatat di jejak audit.', count($fills)));

        return self::SUCCESS;
    }
}
