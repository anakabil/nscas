<?php

declare(strict_types=1);

namespace App\Domain\Scoring;

/** Toleransi dan pembulatan sesuai docs/03 bagian 1. Presisi penuh; pembulatan hanya saat ditampilkan. */
final class Numeric
{
    /** Toleransi perbandingan ambang. Contoh: selisih >= 1,00 - EPS. */
    public const float EPS = 1e-9;

    /**
     * Pembulatan ke atas setara ROUNDUP Excel, kebal galat floating point
     * (misalnya 0,07 x 100 = 7,000000000000001). Hasil bertipe int; ceil() PHP mengembalikan float.
     */
    public static function ceilSafe(float $x): int
    {
        if (! is_finite($x)) {
            throw new EngineInputError('Nilai yang dibulatkan ke atas harus bilangan terhingga');
        }

        return (int) ceil($x - self::EPS);
    }

    /**
     * Rata-rata aritmetika. Penjumlahan berurutan dari kiri agar identik dengan rujukan.
     *
     * @param  array<array-key, int|float>  $values
     */
    public static function mean(array $values): float
    {
        $n = count($values);
        if ($n === 0) {
            throw new EngineInputError('Rata-rata tidak dapat dihitung dari daftar kosong');
        }
        $sum = 0.0;
        foreach ($values as $v) {
            $sum += $v;
        }

        return $sum / $n;
    }

    /**
     * Varians sampel dengan pembagi n - 1.
     *
     * @param  array<array-key, int|float>  $values
     */
    public static function sampleVariance(array $values): float
    {
        $n = count($values);
        if ($n < 2) {
            throw new EngineInputError('Varians sampel memerlukan minimal dua nilai');
        }
        $m = self::mean($values);
        $sum = 0.0;
        foreach ($values as $v) {
            $d = $v - $m;
            $sum += $d * $d;
        }

        return $sum / ($n - 1);
    }

    /** Setara Number.isFinite: hanya int atau float terhingga; string angka dan null ditolak. */
    public static function isFiniteNumber(mixed $value): bool
    {
        return is_int($value) || (is_float($value) && is_finite($value));
    }
}
