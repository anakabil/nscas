<?php

namespace Database\Seeders;

use App\Models\Characteristic;
use App\Models\ClimateDimension;
use App\Models\EvidenceRequirement;
use App\Models\InstrumentVersion;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Memuat versi instrumen dari seed/ ke basis data (PROMPTS.md R1 butir 4). Parameter bawaan berasal dari
 * seed/aspek-dan-parameter.json dan isi instrumen dari seed/instrumen-karakteristik-v1.json. Versi yang sudah ada
 * tidak diubah, agar asesmen yang memakainya tetap konsisten; versi baru dimuat sebagai baris baru.
 *
 * Fase R3: isi instrumen juga disalin ke tabel ternormalisasi (karakteristik, pernyataan berjenjang, dimensi dan
 * butir skala iklim) karena jawaban survei merujuknya dengan kunci asing. Penyalinan hanya terjadi sekali per versi.
 * Skala iklim diambil dari seed/skala-iklim-draf.json (status draf, wajib ditelaah ahli sebelum dipakai klien).
 */
class InstrumentVersionSeeder extends Seeder
{
    public function run(): void
    {
        $parameters = $this->json('aspek-dan-parameter.json');
        $content = $this->json('instrumen-karakteristik-v1.json');
        $code = (string) $parameters['instrumentVersion'];

        $version = InstrumentVersion::firstOrCreate(['code' => $code], [
            'status' => 'PUBLISHED',
            'published_at' => now(),
            'default_parameters' => $parameters,
            'content' => $content,
        ]);

        DB::transaction(function () use ($version) {
            if (! Characteristic::where('instrument_version_id', $version->id)->exists()) {
                $this->characteristics($version);
            }
            if (! ClimateDimension::where('instrument_version_id', $version->id)->exists()) {
                $this->climate($version, $this->json('skala-iklim-draf.json'));
            }
        });
    }

    /** Karakteristik dan pernyataan berjenjang dari isi versi itu sendiri, bukan dari berkas terbaru. */
    private function characteristics(InstrumentVersion $version): void
    {
        foreach ($version->content['characteristics'] ?? [] as $position => $c) {
            $characteristic = Characteristic::create([
                'instrument_version_id' => $version->id,
                'aspect_code' => $c['aspectCode'],
                'code' => $c['code'],
                'name_id' => $c['name'],
                'name_en' => $c['nameEn'] ?? null,
                'is_contextual' => (bool) ($c['isContextual'] ?? false),
                'position' => $position + 1,
                'target_respondents' => $c['targetRespondents'] ?? [],
                'evidence_examples' => $c['evidenceExamples'] ?? [],
            ]);
            if (count($c['levels'] ?? []) !== 5) {
                throw new RuntimeException("Karakteristik {$c['code']} harus memiliki lima pernyataan berjenjang.");
            }
            foreach ($c['levels'] as $level) {
                $characteristic->statements()->create([
                    'level' => (int) $level['level'],
                    'text_id' => $level['statement'],
                    'text_en' => $level['statementEn'] ?? null,
                ]);
            }
            // Butir daftar periksa bukti (fase R5, docs/01 M5).
            foreach (array_values($c['evidenceExamples'] ?? []) as $i => $description) {
                EvidenceRequirement::create(['characteristic_id' => $characteristic->id, 'position' => $i + 1, 'description' => (string) $description]);
            }
        }
    }

    /** @param  array<string, mixed>  $scale */
    private function climate(InstrumentVersion $version, array $scale): void
    {
        foreach ($scale['dimensions'] ?? [] as $position => $d) {
            $dimension = ClimateDimension::create([
                'instrument_version_id' => $version->id,
                'code' => $d['code'],
                'name_id' => $d['name'],
                'name_en' => $d['nameEn'] ?? null,
                'position' => $position + 1,
            ]);
            foreach ($d['items'] as $i => $item) {
                $dimension->items()->create([
                    'code' => $item['code'],
                    'text_id' => $item['text'],
                    'text_en' => $item['textEn'] ?? null,
                    'reverse_coded' => (bool) $item['reverse'],
                    'position' => $i + 1,
                ]);
            }
        }
    }

    /** @return array<string, mixed> */
    private function json(string $file): array
    {
        $data = json_decode((string) file_get_contents(base_path("seed/{$file}")), true);
        if (! is_array($data)) {
            throw new RuntimeException("Berkas seed/{$file} tidak dapat dibaca.");
        }

        return $data;
    }
}
