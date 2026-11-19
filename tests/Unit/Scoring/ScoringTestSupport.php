<?php

declare(strict_types=1);

namespace Tests\Unit\Scoring;

use App\Domain\Scoring\CharacteristicInput;
use App\Domain\Scoring\EngineInputError;
use App\Domain\Scoring\EngineParameters;
use PHPUnit\Framework\Assert;
use Throwable;

/**
 * Pembantu tes mesin penilaian: pemuat fixture, pembanding rekursif bertoleransi 1e-6, dan padanan
 * toBeCloseTo serta toThrow pada tes TypeScript lama. Hanya tes yang membaca berkas; mesin tidak.
 */
trait ScoringTestSupport
{
    /** Toleransi pembandingan fixture (docs/03). */
    private const float TOLERANCE = 1e-6;

    private static function repoRoot(): string
    {
        return dirname(__DIR__, 3);
    }

    /** @return array<array-key, mixed> */
    private static function loadJson(string $relativePath): array
    {
        $path = self::repoRoot().'/'.$relativePath;
        Assert::assertFileExists($path);

        return json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
    }

    /** @return array<array-key, mixed> */
    private static function fixture(string $name): array
    {
        return self::loadJson("seed/fixtures/{$name}.json");
    }

    /** @return array<string, mixed> */
    private static function seedParameters(): array
    {
        return self::loadJson('seed/aspek-dan-parameter.json');
    }

    private static function params(): EngineParameters
    {
        return EngineParameters::fromSnapshot(self::seedParameters());
    }

    /**
     * Karakteristik simulasi (lembar 08) sebagai masukan mesin.
     *
     * @return list<CharacteristicInput>
     */
    private static function simulationCharacteristics(): array
    {
        return array_map(
            static fn (array $c): CharacteristicInput => new CharacteristicInput(
                code: $c['code'],
                aspectCode: $c['aspectCode'],
                isContextual: $c['isContextual'],
                perception: $c['p'],
                evidence: $c['e'],
                validation: $c['v'],
            ),
            self::fixture('skoring-simulasi')['input']['characteristics'],
        );
    }

    /**
     * Membandingkan setiap nilai pada $expected dengan $actual secara rekursif. Angka dibandingkan dengan
     * toleransi 1e-6; nilai lain harus sama persis. Kunci tambahan pada $actual yang tidak ada di fixture
     * tidak dinilai. Mengembalikan jumlah nilai yang diperiksa.
     */
    private static function assertMatchesFixture(mixed $actual, mixed $expected, string $path = '$'): int
    {
        if (is_int($expected) || is_float($expected)) {
            Assert::assertTrue(is_int($actual) || is_float($actual), "{$path} harus angka, ternyata ".get_debug_type($actual));
            Assert::assertLessThanOrEqual(
                self::TOLERANCE,
                abs($actual - $expected),
                "{$path}: {$actual} berbeda dari fixture {$expected}",
            );

            return 1;
        }
        if (is_array($expected) && array_is_list($expected)) {
            Assert::assertIsArray($actual, "{$path} harus larik");
            Assert::assertTrue(array_is_list($actual), "{$path} harus larik berurutan");
            Assert::assertCount(count($expected), $actual, "{$path} panjang larik");
            $checked = 0;
            foreach ($expected as $i => $item) {
                $checked += self::assertMatchesFixture($actual[$i], $item, "{$path}[{$i}]");
            }

            return $checked;
        }
        if (is_array($expected)) {
            Assert::assertIsArray($actual, "{$path} harus objek");
            $checked = 0;
            foreach ($expected as $key => $value) {
                if (str_starts_with((string) $key, '_')) {
                    continue; // catatan, bukan nilai
                }
                Assert::assertArrayHasKey($key, $actual, "{$path}.{$key} tidak ada");
                $checked += self::assertMatchesFixture($actual[$key], $value, "{$path}.{$key}");
            }

            return $checked;
        }
        Assert::assertSame($expected, $actual, $path);

        return 1;
    }

    /** Jumlah nilai daun pada fixture (tanpa kunci catatan), untuk memastikan tidak ada yang terlewat. */
    private static function countLeaves(mixed $value): int
    {
        if (! is_array($value)) {
            return 1;
        }
        $count = 0;
        foreach ($value as $key => $item) {
            if (! array_is_list($value) && str_starts_with((string) $key, '_')) {
                continue;
            }
            $count += self::countLeaves($item);
        }

        return $count;
    }

    /** Padanan toBeCloseTo(expected, digits) pada vitest: |selisih| < 10^-digits / 2. */
    private static function assertCloseTo(float $expected, mixed $actual, int $digits, string $message = ''): void
    {
        Assert::assertTrue(is_int($actual) || is_float($actual), $message !== '' ? $message : 'Nilai harus angka, ternyata '.get_debug_type($actual));
        Assert::assertLessThan(
            (10 ** -$digits) / 2,
            abs($actual - $expected),
            $message !== '' ? $message : "{$actual} tidak mendekati {$expected} sampai {$digits} desimal",
        );
    }

    /** Padanan toThrow: $fn wajib melempar EngineInputError; pola opsional dicocokkan dengan pesannya. */
    private static function assertEngineInputError(callable $fn, ?string $pattern = null): void
    {
        try {
            $fn();
        } catch (Throwable $e) {
            Assert::assertInstanceOf(EngineInputError::class, $e, 'Galat yang dilempar: '.$e::class.': '.$e->getMessage());
            if ($pattern !== null) {
                Assert::assertMatchesRegularExpression($pattern, $e->getMessage());
            }

            return;
        }
        Assert::fail('EngineInputError tidak dilempar');
    }

    /**
     * Salinan objek nilai readonly dengan sebagian properti diganti, padanan { ...obj, kunci: nilai }.
     *
     * @template T of object
     *
     * @param  T  $object
     * @param  array<string, mixed>  $overrides
     * @return T
     */
    private static function with(object $object, array $overrides): object
    {
        return new ($object::class)(...array_merge(get_object_vars($object), $overrides));
    }
}
