<?php

namespace Database\Seeders;

use App\Models\InstrumentVersion;
use Illuminate\Database\Seeder;
use RuntimeException;

/**
 * Memuat versi instrumen dari seed/ ke basis data (PROMPTS.md R1 butir 4). Parameter bawaan berasal dari
 * seed/aspek-dan-parameter.json dan isi instrumen dari seed/instrumen-karakteristik-v1.json. Versi yang sudah ada
 * tidak diubah, agar asesmen yang memakainya tetap konsisten; versi baru dimuat sebagai baris baru.
 */
class InstrumentVersionSeeder extends Seeder
{
    public function run(): void
    {
        $parameters = $this->json('aspek-dan-parameter.json');
        $content = $this->json('instrumen-karakteristik-v1.json');
        $code = (string) $parameters['instrumentVersion'];

        InstrumentVersion::firstOrCreate(['code' => $code], [
            'status' => 'PUBLISHED',
            'published_at' => now(),
            'default_parameters' => $parameters,
            'content' => $content,
        ]);
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
