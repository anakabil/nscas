<?php

declare(strict_types=1);

namespace Tests\Unit\Domain\Findings;

use App\Domain\Findings\PreliminaryFindings;
use App\Domain\Quality\QualityReport;
use PHPUnit\Framework\TestCase;

class PreliminaryFindingsTest extends TestCase
{
    /** @return array<string, mixed> */
    private function build(int $managementCount = 6): array
    {
        $characteristics = [
            ['id' => 'c1', 'code' => 'K1.1', 'name' => 'Keteladanan', 'aspectCode' => 'A1', 'contextual' => false],
            ['id' => 'c2', 'code' => 'K1.2', 'name' => 'Keterlibatan', 'aspectCode' => 'A1', 'contextual' => false],
        ];
        $strata = [
            ['id' => 'm', 'group' => 'MANAGEMENT', 'population' => 20],
            ['id' => 'f1', 'group' => 'FIELD', 'population' => 300],
            ['id' => 'f2', 'group' => 'FIELD', 'population' => 100],
        ];
        $responses = [];
        for ($i = 0; $i < $managementCount; $i++) {
            $responses[] = ['stratumId' => 'm', 'levels' => ['c1' => 4, 'c2' => 4], 'climate' => ['i1' => 5, 'i2' => 1]];
        }
        for ($i = 0; $i < 6; $i++) {
            $responses[] = ['stratumId' => 'f1', 'levels' => ['c1' => 2, 'c2' => $i < 3 ? null : 3], 'climate' => ['i1' => 3, 'i2' => 3]];
        }
        for ($i = 0; $i < 4; $i++) {
            $responses[] = ['stratumId' => 'f2', 'levels' => ['c1' => 3, 'c2' => 3], 'climate' => ['i1' => 4, 'i2' => 2]];
        }
        $dimensions = [['code' => 'D1', 'name' => 'Komitmen', 'items' => [['id' => 'i1', 'reverse' => false], ['id' => 'i2', 'reverse' => true]]]];

        return PreliminaryFindings::build($characteristics, $strata, $responses, ['c1' => [5, 5]], ['c1' => ['types' => 1, 'belowMinimum' => true], 'c2' => ['types' => 2, 'belowMinimum' => false]], $dimensions, 5, 0.5);
    }

    public function test_group_means_are_population_weighted_and_gaps_flagged(): void
    {
        $f = $this->build();
        $c1 = $f['characteristics'][0];
        $this->assertSame(4.0, $c1['groups']['MANAGEMENT']['value']);
        // Lapangan: f1 rata-rata 2 (bobot 300), f2 rata-rata 3 (bobot 100), jadi 2,25.
        $this->assertEqualsWithDelta(2.25, $c1['groups']['FIELD']['value'], 1e-9);
        $this->assertTrue($c1['groups']['SUPERVISORY']['suppressed']);
        $this->assertEqualsWithDelta(1.75, $c1['gap'], 1e-9);
        $this->assertTrue($c1['gapAttention']);
        $this->assertSame(['mean' => 5.0, 'n' => 2], $c1['selfAssessment']);
        // Porsi "Tidak tahu" K1.2: 3 dari 16.
        $this->assertEqualsWithDelta(3 / 16, $f['characteristics'][1]['dontKnowShare'], 1e-9);
        $this->assertSame('K1.1', $f['focus'][0]['code']);
        $this->assertContains('GAP', $f['focus'][0]['reasons']);
        $this->assertContains('SELF_HIGHER', $f['focus'][0]['reasons']);
        // Butir negatif dibalik: manajemen (5 + 5) / 2 = 5.
        $this->assertSame(5.0, $f['climate'][0]['groups']['MANAGEMENT']['value']);
        // Aspek: lapangan f1 (2 x 3 + 2,5 x 3) / 6 = 2,25 dan f2 = 3, berbobot 300 dan 100 menjadi 2,4375.
        $this->assertEqualsWithDelta(4 - 2.4375, $f['aspects'][0]['gap'], 1e-9);
    }

    public function test_small_groups_are_hidden_and_no_gap_is_shown(): void
    {
        $f = $this->build(4);
        $this->assertNull($f['characteristics'][0]['groups']['MANAGEMENT']['value']);
        $this->assertTrue($f['characteristics'][0]['groups']['MANAGEMENT']['suppressed']);
        $this->assertNull($f['characteristics'][0]['gap']);
        $this->assertNull($f['aspects'][0]['gap']);
    }

    public function test_quality_report_hides_small_units(): void
    {
        $dimensions = [['code' => 'D1', 'name' => 'Komitmen', 'items' => [['id' => 'a', 'reverse' => false], ['id' => 'b', 'reverse' => false]]]];
        $responses = [];
        foreach ([[4, 4], [5, 5], [3, 3], [4, 5], [2, 2], [4, 4]] as [$a, $b]) {
            $responses[] = ['unitId' => 'u1', 'climate' => ['a' => $a, 'b' => $b]];
        }
        $responses[] = ['unitId' => 'u2', 'climate' => ['a' => 1, 'b' => 5]];
        $alpha = QualityReport::alphaByDimension($dimensions, $responses, 5, 0.7);
        $this->assertSame(7, $alpha[0]['n']);
        $this->assertNotNull($alpha[0]['alpha']);
        $rwg = QualityReport::rwgByUnit([['id' => 'u1', 'name' => 'Proyek A'], ['id' => 'u2', 'name' => 'Proyek B'], ['id' => 'u3', 'name' => 'Kosong']], $dimensions, $responses, 5, 0.7);
        $this->assertCount(2, $rwg);
        $this->assertSame(6, $rwg[0]['n']);
        $this->assertNotNull($rwg[0]['average']);
        $this->assertNull($rwg[1]['n']);
        $this->assertNull($rwg[1]['average']);
    }
}
