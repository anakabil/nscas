<?php

declare(strict_types=1);

namespace Tests\Unit\Domain\Results;

use App\Domain\Results\Heatmap;
use App\Domain\Results\Sensitivity;
use App\Domain\Results\Trend;
use App\Domain\Scoring\CharacteristicInput;
use App\Domain\Scoring\EngineInput;
use App\Domain\Scoring\EngineParameters;
use PHPUnit\Framework\TestCase;

final class ResultsDomainTest extends TestCase
{
    private static function params(): EngineParameters
    {
        $seed = json_decode((string) file_get_contents(__DIR__.'/../../../../seed/aspek-dan-parameter.json'), true);

        return EngineParameters::fromSnapshot($seed['parameters'] ?? $seed);
    }

    public function test_sensitivity_shifts_each_pair_of_layer_weights_by_five_hundredths(): void
    {
        $chars = [];
        foreach (['A1', 'A2', 'A3', 'A4', 'A5', 'A6'] as $i => $aspect) {
            $chars[] = new CharacteristicInput("K{$i}.1", $aspect, false, 3.4, 2.9, 3.1);
        }
        $result = Sensitivity::analyse(new EngineInput($chars, 4.0), self::params());

        $this->assertCount(6, $result['scenarios']);
        $this->assertEqualsWithDelta(1.0, array_sum($result['scenarios'][0]['weights']), 1e-9);
        foreach ($result['scenarios'] as $s) {
            $this->assertEqualsWithDelta($s['index'] - $result['base']['index'], $s['delta'], 1e-12);
        }
        // Menaikkan bobot persepsi (lebih tinggi) dan menurunkan bukti (lebih rendah) menaikkan indeks.
        $pUp = array_values(array_filter($result['scenarios'], fn ($s) => $s['up'] === 'perception' && $s['down'] === 'evidence'))[0];
        $this->assertGreaterThan(0, $pUp['delta']);
        $this->assertTrue($result['stable']);
    }

    public function test_sensitivity_reports_a_level_change_near_a_threshold(): void
    {
        $chars = [];
        foreach (['A1', 'A2', 'A3', 'A4', 'A5', 'A6'] as $i => $aspect) {
            // Indeks dasar tepat sedikit di atas 3,0; menurunkan bukti yang tinggi menjatuhkan tingkat.
            $chars[] = new CharacteristicInput("K{$i}.1", $aspect, false, 2.7, 3.4, 2.9);
        }
        $result = Sensitivity::analyse(new EngineInput($chars, 4.0), self::params());
        $this->assertSame(3, $result['base']['level']);
        $this->assertFalse($result['stable']);
    }

    public function test_heatmap_hides_cells_below_the_minimum(): void
    {
        $chars = [['id' => 'a', 'aspectCode' => 'A1', 'contextual' => false], ['id' => 'b', 'aspectCode' => 'A1', 'contextual' => false], ['id' => 't', 'aspectCode' => 'AT', 'contextual' => true]];
        $responses = [];
        for ($i = 0; $i < 5; $i++) {
            $responses[] = ['stratumId' => 's1', 'unitId' => 'u1', 'levels' => ['a' => 4, 'b' => 2, 't' => 5]];
        }
        $responses[] = ['stratumId' => 's2', 'unitId' => 'u1', 'levels' => ['a' => 1, 'b' => null]];
        $map = Heatmap::build($chars, $responses, [['id' => 's1', 'label' => 'S1'], ['id' => 's2', 'label' => 'S2']], 'stratumId', 5);

        $this->assertCount(1, $map['rows']);
        $this->assertSame(['value' => 3.0, 'n' => 5, 'suppressed' => false], $map['rows'][0]['cells'][0]);
        // Jumlah responden sel tersembunyi tidak ikut terkirim.
        $this->assertSame(['value' => null, 'n' => null, 'suppressed' => true], $map['rows'][0]['cells'][1]);
    }

    public function test_trend_orders_periods_and_computes_deltas(): void
    {
        $out = Trend::compare([
            ['id' => 'b', 'name' => '2026', 'periodStart' => '2026-08-01', 'index' => 3.4, 'level' => 3, 'aspects' => ['A1' => 3.5, 'A2' => null]],
            ['id' => 'a', 'name' => '2025', 'periodStart' => '2025-08-01', 'index' => 3.1, 'level' => 3, 'aspects' => ['A1' => 3.0, 'A2' => 2.8]],
        ]);
        $this->assertSame(['a', 'b'], array_column($out, 'id'));
        $this->assertNull($out[0]['delta']);
        $this->assertEqualsWithDelta(0.3, $out[1]['delta'], 1e-9);
        $this->assertSame(0, $out[1]['levelDelta']);
        $this->assertEqualsWithDelta(0.5, $out[1]['aspectDeltas']['A1'], 1e-9);
        $this->assertNull($out[1]['aspectDeltas']['A2']);
    }
}
