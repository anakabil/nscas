<?php

declare(strict_types=1);

namespace App\Domain\Scoring;

/** Kalkulator sampel sesuai docs/03 bagian 7. Rujukan: sample_plan di seed/fixtures/referensi_skoring.py. */
final class SampleCalculator
{
    /**
     * Nilai bawaan z, galat, proporsi, partisipasi minimum, dan faktor sama dengan bagian sampling pada
     * seed/aspek-dan-parameter.json; aplikasi meneruskan nilai dari snapshot parameter asesmen.
     *
     * @param  int|float  $workers  M: jumlah pekerja dalam lingkup asesmen (bilangan bulat, minimal 1).
     * @param  int|float  $projects  N: jumlah proyek berjalan (bilangan bulat, minimal 0).
     * @param  int|float  $locations  X: jumlah lokasi (bilangan bulat, minimal 0).
     * @param  list<array<string, mixed>>  $strata  Tiap strata wajib memuat code (string) dan population (bilangan bulat, minimal 0).
     *                                              Kunci lain, misalnya name, diteruskan apa adanya ke keluaran.
     * @param  float  $marginOfError  e
     * @param  float  $proportion  p
     */
    public static function samplePlan(
        int|float $workers,
        int|float $projects,
        int|float $locations,
        array $strata,
        float $z = 1.96,
        float $marginOfError = 0.05,
        float $proportion = 0.5,
        float $minParticipation = 0.3,
        float $interviewFactorManagement = 0.6,
        float $interviewFactorOperational = 1.2,
        float $projectFactor = 0.6,
    ): SamplePlan {
        $M = self::assertCount($workers, 'Jumlah pekerja', 1);
        $projectCount = self::assertCount($projects, 'Jumlah proyek', 0);
        $locationCount = self::assertCount($locations, 'Jumlah lokasi', 0);
        $populations = [];
        foreach ($strata as $i => $stratum) {
            $code = is_array($stratum) && is_scalar($stratum['code'] ?? null) ? (string) $stratum['code'] : '#'.$i;
            $populations[$i] = self::assertCount(
                is_array($stratum) ? ($stratum['population'] ?? null) : null,
                "Populasi strata {$code}",
                0,
            );
        }
        $e = $marginOfError;
        $p = $proportion;
        if (! is_finite($e) || ! ($e > 0)) {
            throw new EngineInputError('Galat sampel harus lebih dari nol');
        }

        // e^2 dihitung sekali agar urutan operasi sama dengan rujukan: M x (e^2), bukan (M x e) x e.
        $eSquared = $e * $e;

        $sclManagement = Numeric::ceilSafe($interviewFactorManagement * sqrt($M));
        $sclOperational = Numeric::ceilSafe($interviewFactorOperational * sqrt($M));
        $slovin = Numeric::ceilSafe($M / (1 + $M * $eSquared));
        $n0 = ($z * $z * $p * (1 - $p)) / $eSquared;
        $cochran = Numeric::ceilSafe($n0 / (1 + ($n0 - 1) / $M));
        $recommended = max($slovin, $cochran);

        $outStrata = [];
        $surveyTargetTotal = 0;
        foreach ($strata as $i => $stratum) {
            $population = $populations[$i];
            // Operator / pada dua int yang habis dibagi menghasilkan int, karena itu dipaksa float.
            $share = (float) ($population / $M);
            $surveyTarget = min(
                $population,
                max(Numeric::ceilSafe($share * $recommended), Numeric::ceilSafe($minParticipation * $population)),
            );
            $outStrata[] = [...$stratum, 'proportion' => $share, 'surveyTarget' => $surveyTarget];
            $surveyTargetTotal += $surveyTarget;
        }

        return new SamplePlan(
            inputs: [
                'M' => $M,
                'projects' => $projectCount,
                'locations' => $locationCount,
                'z' => $z,
                'e' => $e,
                'p' => $p,
                'minParticipation' => $minParticipation,
            ],
            sclMinimumInterviewManagement: $sclManagement,
            sclMinimumInterviewOperational: $sclOperational,
            sclMinimumInterviewTotal: $sclManagement + $sclOperational,
            slovin: $slovin,
            cochranInitial: $n0,
            cochranCorrected: $cochran,
            recommendedSurvey: $recommended,
            projectsToVisit: max(1, Numeric::ceilSafe($projectFactor * sqrt($projectCount))),
            locationsToVisit: Numeric::ceilSafe(sqrt($locationCount)),
            strata: $outStrata,
            surveyTargetTotal: $surveyTargetTotal,
        );
    }

    /** Setara Number.isInteger dan batas bawah: menerima int atau float bernilai bulat, mengembalikan int. */
    private static function assertCount(mixed $value, string $name, int $min): int
    {
        $isInteger = is_int($value) || (is_float($value) && is_finite($value) && floor($value) === $value);
        if (! $isInteger || $value < $min) {
            throw new EngineInputError("{$name} harus bilangan bulat paling kecil {$min}");
        }

        return (int) $value;
    }
}
