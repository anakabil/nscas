<?php

declare(strict_types=1);

namespace Tests\Unit\Domain\Results;

use App\Domain\Findings\PreliminaryFindings;
use App\Domain\Results\CellSuppression;
use App\Domain\Results\Heatmap;
use PHPUnit\Framework\TestCase;

/** Penyembunyian primer dan pelengkap, dibawa dari v1 src/lib/privacy/__tests__/suppression.test.ts. */
final class CellSuppressionTest extends TestCase
{
    public function test_a_single_hidden_cell_in_a_published_group_hides_the_smallest_visible_cell(): void
    {
        $cells = ['s1' => ['value' => 3.0, 'n' => 3], 's2' => ['value' => 4.0, 'n' => 12], 's3' => ['value' => 2.0, 'n' => 8], 's4' => ['value' => 3.5, 'n' => 20]];
        $safe = CellSuppression::apply($cells, 5, [['s1', 's2', 's3'], ['s4']]);

        $this->assertSame(['value' => null, 'n' => null, 'suppressed' => true], $safe['s1']);
        // s3 (8 responden) ikut disembunyikan karena paling kecil di kelompoknya; s2 dan s4 tetap tampil.
        $this->assertSame(['value' => null, 'n' => null, 'suppressed' => true], $safe['s3']);
        $this->assertSame(['value' => 4.0, 'n' => 12, 'suppressed' => false], $safe['s2']);
        $this->assertSame(['value' => 3.5, 'n' => 20, 'suppressed' => false], $safe['s4']);
    }

    public function test_hiding_repeats_across_overlapping_groups_and_ignores_empty_cells(): void
    {
        $cells = ['a' => ['value' => 3.0, 'n' => 2], 'b' => ['value' => 4.0, 'n' => 9], 'c' => ['value' => 2.0, 'n' => 30], 'd' => ['value' => null, 'n' => 0]];
        // a tersembunyi; kelompok [a, b] menyembunyikan b; kelompok [b, c] lalu punya satu sel tersembunyi dan c ikut.
        $safe = CellSuppression::apply($cells, 5, [['a', 'b'], ['b', 'c', 'd']]);
        $this->assertSame([true, true, true], [$safe['a']['suppressed'], $safe['b']['suppressed'], $safe['c']['suppressed']]);
        // Sel tanpa responden tidak membuka apa pun: jumlah nolnya tetap terbaca.
        $this->assertSame(['value' => null, 'n' => 0, 'suppressed' => true], $safe['d']);

        $none = CellSuppression::apply(['x' => ['value' => 3.0, 'n' => 5], 'y' => ['value' => null, 'n' => 0]], 5, [['x', 'y']]);
        $this->assertFalse($none['x']['suppressed']);
    }

    public function test_the_strata_heatmap_applies_the_groups(): void
    {
        $chars = [['id' => 'c1', 'aspectCode' => 'A1', 'contextual' => false]];
        $responses = [];
        foreach (['m1' => 3, 'm2' => 6, 'f1' => 10] as $stratum => $count) {
            for ($i = 0; $i < $count; $i++) {
                $responses[] = ['stratumId' => $stratum, 'unitId' => 'u', 'levels' => ['c1' => 3]];
            }
        }
        $columns = [['id' => 'm1', 'label' => 'M1'], ['id' => 'm2', 'label' => 'M2'], ['id' => 'f1', 'label' => 'F1']];
        $cells = Heatmap::build($chars, $responses, $columns, 'stratumId', 5, [['m1', 'm2'], ['f1']])['rows'][0]['cells'];
        $this->assertSame([true, true, false], array_column($cells, 'suppressed'));
    }

    public function test_a_hidden_job_group_hides_one_more_group_because_the_overall_mean_is_published(): void
    {
        $characteristics = [['id' => 'c1', 'code' => 'K1.1', 'name' => 'K', 'aspectCode' => 'A1', 'contextual' => false]];
        $strata = [['id' => 'm', 'group' => 'MANAGEMENT', 'population' => 20], ['id' => 's', 'group' => 'SUPERVISORY', 'population' => 40], ['id' => 'f', 'group' => 'FIELD', 'population' => 300]];
        $responses = [];
        foreach (['m' => 6, 's' => 3, 'f' => 12] as $stratum => $count) {
            for ($i = 0; $i < $count; $i++) {
                $responses[] = ['stratumId' => $stratum, 'levels' => ['c1' => 3], 'climate' => []];
            }
        }
        $f = PreliminaryFindings::build($characteristics, $strata, $responses, [], [], [], 5, 0.5);
        $groups = $f['characteristics'][0]['groups'];

        $this->assertSame([true, true, false], [$groups['SUPERVISORY']['suppressed'], $groups['MANAGEMENT']['suppressed'], $groups['FIELD']['suppressed']]);
        $this->assertNull($groups['SUPERVISORY']['n']);
        $this->assertNull($f['characteristics'][0]['gap']);
        $this->assertTrue($f['aspects'][0]['groups']['MANAGEMENT']['suppressed']);
    }
}
