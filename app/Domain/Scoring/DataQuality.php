<?php

declare(strict_types=1);

namespace App\Domain\Scoring;

/** Statistik mutu data sesuai docs/03 bagian 8. */
final class DataQuality
{
    /** Varians distribusi seragam yang diharapkan: (A^2 - 1) / 12; 2,0 untuk skala lima titik. */
    public static function expectedUniformVariance(int $scalePoints = 5): float
    {
        if ($scalePoints < 2) {
            throw new EngineInputError('Skala jawaban harus memiliki minimal dua titik');
        }

        return ($scalePoints * $scalePoints - 1) / 12.0;
    }

    /**
     * Kesepakatan dalam kelompok satu butir (James, Demaree, dan Wolf, 1984):
     * rwg = 1 - s^2 / sigmaEU^2, nilai negatif dijadikan 0. Null bila kurang dari dua jawaban.
     *
     * @param  array<array-key, int|float>  $values
     */
    public static function rwgSingle(array $values, int $scalePoints = 5): ?float
    {
        if (count($values) < 2) {
            return null;
        }

        return max(0.0, 1 - Numeric::sampleVariance($values) / self::expectedUniformVariance($scalePoints));
    }

    /**
     * rwg(J) untuk J butir dalam satu dimensi. Matriks berisi baris responden dan kolom butir.
     * rwg(J) = J(1 - r) / [J(1 - r) + r], dengan r = rataS^2 / sigmaEU^2.
     * Bila rata-rata varians teramati sama dengan atau melebihi varians seragam (r >= 1),
     * nilai dijadikan 0, sejalan dengan perlakuan nilai negatif pada rwg satu butir
     * (LeBreton dan Senter, 2008). Null bila kurang dari dua responden atau tanpa butir.
     *
     * @param  list<list<int|float>>  $matrix
     */
    public static function rwgJ(array $matrix, int $scalePoints = 5): ?float
    {
        $rows = array_values($matrix);
        if (count($rows) < 2 || count($rows[0]) === 0) {
            return null;
        }
        $J = count($rows[0]);
        $itemVariances = [];
        for ($i = 0; $i < $J; $i++) {
            $itemVariances[] = Numeric::sampleVariance(self::column($rows, $i));
        }
        $r = Numeric::mean($itemVariances) / self::expectedUniformVariance($scalePoints);
        if ($r >= 1 - Numeric::EPS) {
            return 0.0;
        }
        $agreement = $J * (1 - $r);

        return $agreement / ($agreement + $r);
    }

    /** Pembalikan butir negatif: 6 - nilai untuk skala 1 sampai 5. */
    public static function reverseScore(float $value, float $scaleMin = 1.0, float $scaleMax = 5.0): float
    {
        return $scaleMin + $scaleMax - $value;
    }

    /**
     * Alfa Cronbach per dimensi iklim. Matriks berisi baris responden dan kolom butir dengan nilai asli;
     * butir yang ditandai pada $reverseCoded dibalik lebih dulu. Null bila kurang dari dua butir,
     * kurang dari dua responden, atau varians skor total nol.
     *
     * @param  list<list<int|float>>  $matrix
     * @param  array<int, bool>  $reverseCoded  Indeks kolom ke true bila butir negatif.
     */
    public static function cronbachAlpha(
        array $matrix,
        array $reverseCoded = [],
        float $scaleMin = 1.0,
        float $scaleMax = 5.0,
    ): ?float {
        $rows = array_values($matrix);
        if (count($rows) < 2) {
            return null;
        }
        $k = count($rows[0]);
        if ($k < 2) {
            return null;
        }

        $itemVariances = [];
        $totals = array_fill(0, count($rows), 0.0);
        for ($i = 0; $i < $k; $i++) {
            $reverse = (bool) ($reverseCoded[$i] ?? false);
            $scored = [];
            foreach (self::column($rows, $i) as $rowIndex => $x) {
                $score = $reverse ? self::reverseScore($x, $scaleMin, $scaleMax) : $x;
                $scored[] = $score;
                // Skor total per responden dijumlahkan menurut urutan butir, sama dengan rujukan.
                $totals[$rowIndex] += $score;
            }
            $itemVariances[] = Numeric::sampleVariance($scored);
        }
        $totalVariance = Numeric::sampleVariance($totals);
        if ($totalVariance <= 0) {
            return null;
        }
        $sumItemVariance = 0.0;
        foreach ($itemVariances as $variance) {
            $sumItemVariance += $variance;
        }

        return ($k / ($k - 1)) * (1 - $sumItemVariance / $totalVariance);
    }

    /**
     * Median; null bila daftar kosong.
     *
     * @param  array<array-key, int|float>  $values
     */
    public static function median(array $values): ?float
    {
        if ($values === []) {
            return null;
        }
        $sorted = array_values($values);
        sort($sorted, SORT_NUMERIC);
        $n = count($sorted);
        $mid = intdiv($n, 2);

        return $n % 2 === 1 ? (float) $sorted[$mid] : ($sorted[$mid - 1] + $sorted[$mid]) / 2;
    }

    /**
     * Tanda mutu jawaban. Ditandai otomatis; pengeluaran dari analisis hanya setelah ditinjau asesor.
     *
     * @param  float|null  $medianDurationMinutes  Median durasi asesmen; null bila belum dapat ditaksir.
     * @return list<QualityFlag>
     */
    public static function responseQualityFlags(
        ResponseForQuality $response,
        ?float $medianDurationMinutes,
        QualityThresholds $thresholds,
    ): array {
        $flags = [];

        $climate = array_map(static fn (int|float $value): float => (float) $value, array_values($response->climateValues));
        if ($climate !== []) {
            // Frekuensi nilai terbanyak dihitung dari deret terurut, tanpa menjadikan float sebagai kunci larik.
            sort($climate, SORT_NUMERIC);
            $longestRun = 0;
            $run = 0;
            $previous = null;
            foreach ($climate as $value) {
                $run = $value === $previous ? $run + 1 : 1;
                $previous = $value;
                $longestRun = max($longestRun, $run);
            }
            if ($longestRun / count($climate) >= $thresholds->straightliningShare - Numeric::EPS) {
                $flags[] = QualityFlag::PolaSeragam;
            }
        }

        if ($response->durationMinutes !== null && $medianDurationMinutes !== null && $medianDurationMinutes > 0) {
            if ($response->durationMinutes < $thresholds->speedingFractionOfMedian * $medianDurationMinutes - Numeric::EPS) {
                $flags[] = QualityFlag::TerlaluCepat;
            }
        }

        $levels = $response->characteristicLevels;
        if ($levels !== []) {
            $dontKnow = 0;
            foreach ($levels as $level) {
                if ($level === null) {
                    $dontKnow++;
                }
            }
            if ($dontKnow / count($levels) > $thresholds->dontKnowShareMax + Numeric::EPS) {
                $flags[] = QualityFlag::BanyakTidakTahu;
            }
        }

        return $flags;
    }

    /**
     * Kolom ke-$index dari matriks; menolak baris yang tidak memiliki kolom itu atau berisi bukan angka.
     *
     * @param  list<array<array-key, mixed>>  $rows
     * @return list<int|float>
     */
    private static function column(array $rows, int $index): array
    {
        $column = [];
        foreach ($rows as $row) {
            $cells = is_array($row) ? array_values($row) : [];
            if (! array_key_exists($index, $cells) || ! Numeric::isFiniteNumber($cells[$index])) {
                throw new EngineInputError('Matriks jawaban harus persegi dan hanya berisi angka');
            }
            $column[] = $cells[$index];
        }

        return $column;
    }
}
