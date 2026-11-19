<?php

declare(strict_types=1);

namespace Tests\Unit\Domain\Respondents;

use App\Domain\Respondents\Participation;
use PHPUnit\Framework\TestCase;

/** Dibawa dari v1 src/lib/respondents/__tests__/participation.test.ts. */
class ParticipationTest extends TestCase
{
    private const STRATA = [
        ['id' => 's-m', 'code' => 'M', 'name' => 'Manajemen', 'population' => 40],
        ['id' => 's-l', 'code' => 'L', 'name' => 'Pekerja lapangan', 'population' => 600],
    ];

    private const UNITS = [
        ['id' => 'u-hq', 'name' => 'Kantor Pusat', 'parentId' => null],
        ['id' => 'u-p1', 'name' => 'Proyek 1', 'parentId' => 'u-hq'],
        ['id' => 'u-p2', 'name' => 'Proyek 2', 'parentId' => 'u-hq'],
    ];

    private const TOKENS = [
        ['unitId' => 'u-hq', 'stratumId' => 's-m', 'issued' => 30, 'completed' => 20],
        ['unitId' => 'u-p1', 'stratumId' => 's-l', 'issued' => 200, 'completed' => 150],
        ['unitId' => 'u-p2', 'stratumId' => 's-l', 'issued' => 10, 'completed' => 3],
        ['unitId' => 'u-p2', 'stratumId' => null, 'issued' => 6, 'completed' => 0],
    ];

    private const ROSTER = [
        ['unitId' => 'u-hq', 'stratumId' => 's-m', 'count' => 35],
        ['unitId' => 'u-p1', 'stratumId' => 's-l', 'count' => 300],
        ['unitId' => 'u-p2', 'stratumId' => 's-l', 'count' => 12],
    ];

    /** @return array<string, mixed> */
    private function build(?array $tokens = null, ?array $roster = null): array
    {
        return Participation::build(self::STRATA, self::UNITS, $tokens ?? self::TOKENS, $roster ?? self::ROSTER, 0.3, 5);
    }

    public function test_cell_threshold_hides_one_to_four_and_shows_zero_and_five_up(): void
    {
        $this->assertSame(['value' => 0, 'suppressed' => false], Participation::maskCount(0, 5));
        $this->assertSame(['value' => null, 'suppressed' => true], Participation::maskCount(1, 5));
        $this->assertSame(['value' => null, 'suppressed' => true], Participation::maskCount(4, 5));
        $this->assertSame(['value' => 5, 'suppressed' => false], Participation::maskCount(5, 5));
    }

    public function test_stratum_rate_is_against_population_and_flags_below_thirty_percent(): void
    {
        [$m, $l] = $this->build()['strata'];

        $this->assertSame([35, 30, ['value' => 20, 'suppressed' => false], false], [$m['registered'], $m['issued'], $m['completed'], $m['belowMinimum']]);
        $this->assertEqualsWithDelta(0.5, $m['rate'], 1e-12);
        $this->assertSame([312, 210, 153, true], [$l['registered'], $l['issued'], $l['completed']['value'], $l['belowMinimum']]);
        $this->assertEqualsWithDelta(153 / 600, $l['rate'], 1e-12);
        $this->assertSame(1, $this->build()['strataBelowMinimum']);
    }

    public function test_unit_rate_is_against_registered_people_and_small_counts_are_hidden(): void
    {
        [$hq, $p1, $p2] = $this->build()['units'];

        $this->assertSame([35, 20], [$hq['registered'], $hq['completed']['value']]);
        $this->assertEqualsWithDelta(20 / 35, $hq['rate'], 1e-12);
        $this->assertEqualsWithDelta(0.5, $p1['rate'], 1e-12);
        $this->assertSame([12, 16, ['value' => null, 'suppressed' => true], null], [$p2['registered'], $p2['issued'], $p2['completed'], $p2['rate']]);
    }

    public function test_totals_and_qr_tokens_waiting_for_a_stratum(): void
    {
        $summary = $this->build();

        $this->assertSame([640, 347, 246, 173], [
            $summary['totals']['population'], $summary['totals']['registered'], $summary['totals']['issued'], $summary['totals']['completed']['value'],
        ]);
        $this->assertEqualsWithDelta(173 / 640, $summary['totals']['rate'], 1e-12);
        $this->assertSame(6, $summary['pendingStratumSelection']);
    }

    public function test_unit_without_roster_has_no_rate(): void
    {
        $summary = $this->build([['unitId' => 'u-p2', 'stratumId' => 's-l', 'issued' => 9, 'completed' => 8]], []);
        $p2 = $summary['units'][2];

        $this->assertSame([0, 8, null], [$p2['registered'], $p2['completed']['value'], $p2['rate']]);
    }

    public function test_hidden_stratum_count_is_still_flagged_below_minimum(): void
    {
        $summary = $this->build([['unitId' => 'u-hq', 'stratumId' => 's-m', 'issued' => 4, 'completed' => 2]]);

        $this->assertSame([true, null, true], [$summary['strata'][0]['completed']['suppressed'], $summary['strata'][0]['rate'], $summary['strata'][0]['belowMinimum']]);
        $this->assertTrue($summary['totals']['completed']['suppressed']);
        $this->assertNull($summary['totals']['rate']);
    }

    public function test_snapshot_keeps_raw_counts_and_trend_applies_the_threshold(): void
    {
        $this->assertSame(
            ['population' => 640, 'issued' => 246, 'completed' => 173, 'strata' => [['stratumId' => 's-m', 'completed' => 20], ['stratumId' => 's-l', 'completed' => 153]]],
            Participation::snapshotData(self::STRATA, self::TOKENS),
        );

        $trend = Participation::trend([
            ['date' => '2026-11-02', 'data' => ['population' => 640, 'completed' => 3]],
            ['date' => '2026-11-03', 'data' => ['population' => 640, 'completed' => 64]],
        ], 5);

        $this->assertSame([
            ['date' => '2026-11-02', 'completed' => ['value' => null, 'suppressed' => true], 'rate' => null],
            ['date' => '2026-11-03', 'completed' => ['value' => 64, 'suppressed' => false], 'rate' => 0.1],
        ], $trend);
    }
}
