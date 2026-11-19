<?php

namespace Database\Seeders;

use App\Models\Organization;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed bawaan membuat organisasi operator dan memuat versi instrumen. Tidak ada akun dan tidak ada data contoh:
     * pengelola sistem pertama dibuat dengan `php artisan nscas:create-admin`, dan data contoh untuk
     * pengembangan dengan `php artisan nscas:demo`.
     */
    public function run(): void
    {
        Organization::firstOrCreate(['is_operator' => true], ['name' => 'Nusa Safety', 'legal_name' => 'PT Nusa Rendra Jayatama']);
        $this->call(InstrumentVersionSeeder::class);
    }
}
