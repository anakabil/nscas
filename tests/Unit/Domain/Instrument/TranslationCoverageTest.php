<?php

declare(strict_types=1);

namespace Tests\Unit\Domain\Instrument;

use App\Domain\Instrument\TranslationCoverage;
use PHPUnit\Framework\TestCase;

final class TranslationCoverageTest extends TestCase
{
    private const CHARACTERISTICS = ['K1.1' => [1, 2, 3, 4, 5]];

    private const CLIMATE = ['D1' => ['D1.1', 'D1.2']];

    /** @return array<string, mixed> */
    private function complete(): array
    {
        return [
            'characteristics' => ['K1.1' => ['name' => 'Name', 'levels' => ['1' => 'a', '2' => 'b', '3' => 'c', '4' => 'd', '5' => 'e']]],
            'climate' => ['D1' => ['name' => 'Dimension', 'items' => ['D1.1' => 'x', 'D1.2' => 'y']]],
        ];
    }

    public function test_a_complete_translation_has_no_problems(): void
    {
        $this->assertSame([], TranslationCoverage::problems(self::CHARACTERISTICS, self::CLIMATE, $this->complete()));
    }

    public function test_missing_empty_and_unknown_entries_are_reported(): void
    {
        $t = $this->complete();
        $t['characteristics']['K1.1']['levels']['3'] = '  ';
        $t['characteristics']['K1.1']['levels']['6'] = 'extra';
        $t['characteristics']['K9.9'] = ['name' => 'Unknown', 'levels' => []];
        unset($t['climate']['D1']['items']['D1.2']);
        $t['climate']['D1']['items']['D1.9'] = 'extra';
        $t['climate']['D8'] = ['name' => 'Unknown', 'items' => []];

        $this->assertSame([
            'Teks pernyataan K1.1 tingkat 3 kosong.',
            'Tingkat 6 pada K1.1 tidak ada di instrumen.',
            'Karakteristik K9.9 tidak ada di instrumen.',
            'Teks butir iklim D1.2 kosong.',
            'Butir iklim D1.9 tidak ada di dimensi D1.',
            'Dimensi iklim D8 tidak ada di instrumen.',
        ], TranslationCoverage::problems(self::CHARACTERISTICS, self::CLIMATE, $t));
    }

    public function test_absent_sections_and_long_dashes_are_reported(): void
    {
        $this->assertSame(
            ['Karakteristik K1.1 belum diterjemahkan.', 'Dimensi iklim D1 belum diterjemahkan.'],
            TranslationCoverage::problems(self::CHARACTERISTICS, self::CLIMATE, []),
        );

        $t = $this->complete();
        $t['characteristics']['K1.1']['name'] = "Management \u{2014} attention";
        $t['climate']['D1']['items']['D1.1'] = 'Rules -- always';
        $this->assertSame(
            ['Teks nama karakteristik K1.1 memakai tanda pisah panjang.', 'Teks butir iklim D1.1 memakai tanda pisah panjang.'],
            TranslationCoverage::problems(self::CHARACTERISTICS, self::CLIMATE, $t),
        );
    }

    public function test_approval_needs_a_reviewer_and_a_date(): void
    {
        $this->assertFalse(TranslationCoverage::approved([]));
        $this->assertFalse(TranslationCoverage::approved(['approval' => ['approvedBy' => 'Reviewer', 'approvedOn' => null]]));
        $this->assertTrue(TranslationCoverage::approved(['approval' => ['approvedBy' => 'Reviewer', 'approvedOn' => '2026-12-01']]));
    }
}
