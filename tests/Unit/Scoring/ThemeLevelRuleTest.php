<?php

declare(strict_types=1);

namespace Tests\Unit\Scoring;

use App\Domain\Scoring\ThemeLevelRule;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * Fixture versi 2 (keputusan D4): aturan penetapan tangga per tema harus sama persis dengan
 * seed/fixtures/referensi_aturan_tema.py. Bila berbeda, yang salah adalah kode.
 */
final class ThemeLevelRuleTest extends TestCase
{
    /** @return array<string, mixed> */
    private static function fixture(): array
    {
        return json_decode((string) file_get_contents(__DIR__.'/../../../seed/fixtures/aturan-tema-v2.json'), true, flags: JSON_THROW_ON_ERROR);
    }

    /** @return iterable<string, array{array<string, mixed>}> */
    public static function cases(): iterable
    {
        foreach (self::fixture()['cases'] as $name => $case) {
            yield $name => [$case];
        }
    }

    /** @param array<string, mixed> $case */
    #[DataProvider('cases')]
    public function test_matches_the_python_reference(array $case): void
    {
        $t = self::fixture()['thresholds'];
        $result = ThemeLevelRule::determine($case['themes'], (int) $case['target'], (float) $t['green'], (float) $t['amber']);

        $this->assertSame($case['expected'], $result);
    }

    public function test_thresholds_follow_decision_d3(): void
    {
        $t = self::fixture()['thresholds'];
        $this->assertEqualsWithDelta(ThemeLevelRule::DEFAULT_GREEN, $t['green'], 1e-6);
        $this->assertEqualsWithDelta(ThemeLevelRule::DEFAULT_AMBER, $t['amber'], 1e-6);
        $this->assertSame('HIJAU', ThemeLevelRule::color(0.8));
        $this->assertSame('JINGGA', ThemeLevelRule::color(0.7999));
        $this->assertSame('JINGGA', ThemeLevelRule::color(0.5));
        $this->assertSame('MERAH', ThemeLevelRule::color(0.4999));
    }
}
