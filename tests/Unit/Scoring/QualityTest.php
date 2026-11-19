<?php

declare(strict_types=1);

namespace Tests\Unit\Scoring;

use App\Domain\Scoring\DataQuality;
use App\Domain\Scoring\QualityFlag;
use App\Domain\Scoring\QualityThresholds;
use App\Domain\Scoring\ResponseForQuality;
use PHPUnit\Framework\TestCase;

/** Tes statistik mutu data (docs/03 bagian 8) dengan nilai yang dihitung tangan. */
final class QualityTest extends TestCase
{
    use ScoringTestSupport;

    private static function thresholds(): QualityThresholds
    {
        $quality = self::seedParameters()['quality'];

        return new QualityThresholds(
            straightliningShare: $quality['straightliningShare'], // 0,90
            speedingFractionOfMedian: $quality['speedingFractionOfMedian'], // 0,33
            dontKnowShareMax: $quality['dontKnowShareMax'], // 0,50
        );
    }

    /**
     * Jawaban wajar; sebagian properti dapat diganti.
     *
     * @param  array<string, mixed>  $overrides
     */
    private static function base(array $overrides = []): ResponseForQuality
    {
        return new ResponseForQuality(...array_merge([
            'climateValues' => [1, 2, 3, 4, 5, 1, 2, 3, 4, 5],
            'characteristicLevels' => [3, 3, 4, 2, 3],
            'durationMinutes' => 12,
        ], $overrides));
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return list<string>
     */
    private static function flags(array $overrides = [], ?float $median = 12): array
    {
        return QualityFlag::values(DataQuality::responseQualityFlags(self::base($overrides), $median, self::thresholds()));
    }

    // ---------------------------------------------------------------------------------------------
    // rwg(J), banyak butir
    // ---------------------------------------------------------------------------------------------

    public function test_rwg_j_four_respondents_three_items_is_point_ninety_six(): void
    {
        // Baris = responden, kolom = butir.
        //   butir 1: 4, 4, 5, 5  rata-rata 4,5; jumlah kuadrat simpangan 4 x 0,25 = 1; s^2 = 1/3
        //   butir 2: 3, 4, 3, 4  rata-rata 3,5; jumlah kuadrat simpangan 1;          s^2 = 1/3
        //   butir 3: 4, 4, 4, 4  s^2 = 0
        // rataS^2 = (1/3 + 1/3 + 0) / 3 = 2/9; sigmaEU^2 = (25 - 1) / 12 = 2
        // r = (2/9) / 2 = 1/9; J(1 - r) = 3 x 8/9 = 8/3
        // rwg(J) = (8/3) / (8/3 + 1/9) = (24/9) / (25/9) = 24/25 = 0,96
        $matrix = [
            [4, 3, 4],
            [4, 4, 4],
            [5, 3, 4],
            [5, 4, 4],
        ];

        self::assertCloseTo(0.96, DataQuality::rwgJ($matrix), 12);
    }

    public function test_rwg_j_with_one_item_equals_single_item_rwg(): void
    {
        // Untuk J = 1: rwg(J) = (1 - r) / ((1 - r) + r) = 1 - r, yaitu rumus rwg satu butir.
        $case = self::fixture('kasus-tepi')['rwgSatuButir'];
        $values = $case['input']['values'];
        $asMatrix = array_map(static fn (int $v): array => [$v], $values);

        self::assertCloseTo((float) DataQuality::rwgSingle($values), DataQuality::rwgJ($asMatrix), 12);
        self::assertCloseTo($case['expected'], DataQuality::rwgJ($asMatrix), 6);
    }

    public function test_rwg_j_is_zero_when_observed_variance_exceeds_uniform_variance(): void
    {
        // Butir 1 dan 2: 1, 5, 1, 5; rata-rata 3; jumlah kuadrat simpangan 4 x 4 = 16; s^2 = 16/3
        // r = (16/3) / 2 = 2,67 > 1, sehingga kesepakatan dianggap tidak ada: 0
        $this->assertSame(0.0, DataQuality::rwgJ([
            [1, 1],
            [5, 5],
            [1, 1],
            [5, 5],
        ]));
    }

    public function test_rwg_j_perfect_agreement_is_one(): void
    {
        // Semua varians butir 0: r = 0; rwg(J) = J / J = 1
        $this->assertSame(1.0, DataQuality::rwgJ([
            [3, 4],
            [3, 4],
            [3, 4],
        ]));
    }

    public function test_rwg_is_null_with_fewer_than_two_respondents_or_without_items(): void
    {
        $this->assertNull(DataQuality::rwgJ([[3, 4]]));
        $this->assertNull(DataQuality::rwgJ([[], []]));
        $this->assertNull(DataQuality::rwgSingle([4]));
    }

    public function test_rwg_single_item_hand_calculated_and_clamped_at_zero(): void
    {
        // 3, 3, 4, 3, 4, 3, 3, 4: rata-rata 27/8 = 3,375; jumlah kuadrat simpangan 5 x 0,140625 + 3 x 0,390625 = 1,875
        // s^2 = 1,875 / 7 = 0,267857; rwg = 1 - 0,267857 / 2 = 0,866071
        self::assertCloseTo(1 - (1.875 / 7) / 2, DataQuality::rwgSingle([3, 3, 4, 3, 4, 3, 3, 4]), 12);
        // 1, 5, 2, 4, 1, 5: rata-rata 3; jumlah kuadrat simpangan 4 + 4 + 1 + 1 + 4 + 4 = 18; s^2 = 3,6
        // 1 - 3,6 / 2 = -0,8, nilai negatif dijadikan 0
        $this->assertSame(0.0, DataQuality::rwgSingle([1, 5, 2, 4, 1, 5]));
    }

    public function test_expected_uniform_variance_of_five_point_scale_is_two(): void
    {
        $this->assertSame(2.0, DataQuality::expectedUniformVariance());
        $this->assertSame(4.0, DataQuality::expectedUniformVariance(7)); // (49 - 1) / 12
    }

    // ---------------------------------------------------------------------------------------------
    // Alfa Cronbach dengan pembalikan butir negatif
    // ---------------------------------------------------------------------------------------------

    public function test_negative_items_are_reversed_with_six_minus_value(): void
    {
        $this->assertSame(5.0, DataQuality::reverseScore(1));
        $this->assertSame(4.0, DataQuality::reverseScore(2));
        $this->assertSame(3.0, DataQuality::reverseScore(3));
    }

    public function test_cronbach_alpha_with_reverse_coded_third_item_matches_fixture(): void
    {
        // Fixture alphaCronbach memakai skor yang sudah dibalik. Di sini butir ketiga disimpan sebagai
        // jawaban asli (6 - skor) lalu ditandai reverseCoded; hasilnya harus kembali 0,881579.
        $case = self::fixture('kasus-tepi')['alphaCronbach'];
        $raw = array_map(static fn (array $row): array => [$row[0], $row[1], 6 - $row[2]], $case['input']['matrix']);

        self::assertCloseTo($case['expected'], DataQuality::cronbachAlpha($raw, reverseCoded: [false, false, true]), 6);
        // Tanpa pembalikan, butir ketiga berkorelasi negatif dan alfa turun jauh.
        $this->assertLessThan(0.5, DataQuality::cronbachAlpha($raw));
    }

    public function test_cronbach_alpha_two_items_three_respondents_is_twelve_thirteenths(): void
    {
        // Butir 1: 1, 2, 3 (s^2 = 1); butir 2: 2, 2, 4 (rata-rata 8/3; s^2 = (4/9 + 4/9 + 16/9) / 2 = 4/3)
        // Total: 3, 4, 7 (rata-rata 14/3; s^2 = (25/9 + 4/9 + 49/9) / 2 = 13/3)
        // alfa = (2/1) x (1 - (1 + 4/3) / (13/3)) = 2 x (1 - 7/13) = 12/13 = 0,923077
        self::assertCloseTo(12 / 13, DataQuality::cronbachAlpha([
            [1, 2],
            [2, 2],
            [3, 4],
        ]), 12);
    }

    public function test_cronbach_alpha_is_null_for_degenerate_input(): void
    {
        // Kurang dari dua butir, kurang dari dua responden, atau varians total nol.
        $this->assertNull(DataQuality::cronbachAlpha([[3], [4]]));
        $this->assertNull(DataQuality::cronbachAlpha([[3, 4]]));
        $this->assertNull(DataQuality::cronbachAlpha([
            [3, 3],
            [3, 3],
        ]));
    }

    public function test_statistics_reject_ragged_or_non_numeric_matrices(): void
    {
        // Khusus PHP: tanpa pemeriksaan ini, kolom yang hilang menjadi null dan dihitung sebagai 0.
        self::assertEngineInputError(static fn () => DataQuality::cronbachAlpha([[3, 4], [3]]));
        self::assertEngineInputError(static fn () => DataQuality::rwgJ([[3, 4], [3, '4']]));
    }

    // ---------------------------------------------------------------------------------------------
    // Median
    // ---------------------------------------------------------------------------------------------

    public function test_median_odd_even_and_empty(): void
    {
        $this->assertSame(5.0, DataQuality::median([9, 3, 5]));
        $this->assertSame(11.0, DataQuality::median([12, 8, 10, 20])); // (10 + 12) / 2
        $this->assertNull(DataQuality::median([]));
    }

    // ---------------------------------------------------------------------------------------------
    // Tanda mutu jawaban
    // ---------------------------------------------------------------------------------------------

    public function test_reasonable_response_is_not_flagged(): void
    {
        $this->assertSame([], self::flags());
    }

    public function test_straightlining_when_ninety_percent_or_more_climate_answers_are_identical(): void
    {
        // 19 dari 21 butir bernilai 4: 19/21 = 0,9048 >= 0,90, ditandai.
        $nineteen = [...array_fill(0, 19, 4), 3, 3];
        $this->assertSame(['POLA_SERAGAM'], self::flags(['climateValues' => $nineteen]));
        // Tepat 9 dari 10: 0,90 >= 0,90, ditandai (batas inklusif).
        $nine = [...array_fill(0, 9, 5), 1];
        $this->assertSame(['POLA_SERAGAM'], self::flags(['climateValues' => $nine]));
        // 18 dari 21: 0,857 < 0,90, tidak ditandai.
        $eighteen = [...array_fill(0, 18, 4), 3, 3, 3];
        $this->assertSame([], self::flags(['climateValues' => $eighteen]));
    }

    public function test_straightlining_counts_the_most_frequent_value_even_when_not_adjacent(): void
    {
        // Nilai terbanyak tersebar di antara nilai lain, dan 4 serta 4,0 dihitung sebagai nilai yang sama.
        $scattered = [4, 3, 4, 4.0, 4, 4, 4, 4, 4, 4];
        $this->assertSame(['POLA_SERAGAM'], self::flags(['climateValues' => $scattered]));
        $this->assertSame([], self::flags(['climateValues' => [4, 3, 4, 3, 4, 3, 4, 3, 4, 3]]));
    }

    public function test_speeding_when_duration_is_below_fraction_of_median(): void
    {
        // Median 12 menit: 0,33 x 12 = 3,96 menit.
        $this->assertSame(['TERLALU_CEPAT'], self::flags(['durationMinutes' => 3.9]));
        // Tepat 3,96 bukan "kurang dari", tidak ditandai.
        $this->assertSame([], self::flags(['durationMinutes' => 3.96]));
        $this->assertSame([], self::flags(['durationMinutes' => 4]));
        // Tanpa median atau durasi, tanda ini tidak dapat dinilai.
        $this->assertSame([], self::flags(['durationMinutes' => 1], null));
        $this->assertSame([], self::flags(['durationMinutes' => null]));
    }

    public function test_many_dont_know_when_more_than_half_of_characteristic_answers_are_dont_know(): void
    {
        // 18 karakteristik, 9 Tidak tahu: 9/18 = 0,50, bukan "lebih dari", tidak ditandai.
        $nineOf18 = [...array_fill(0, 9, null), ...array_fill(0, 9, 3)];
        $this->assertSame([], self::flags(['characteristicLevels' => $nineOf18]));
        // 10 dari 18: 0,556 > 0,50, ditandai.
        $tenOf18 = [...array_fill(0, 10, null), ...array_fill(0, 8, 3)];
        $this->assertSame(['BANYAK_TIDAK_TAHU'], self::flags(['characteristicLevels' => $tenOf18]));
    }

    public function test_all_three_flags_can_appear_together_in_fixed_order(): void
    {
        $flags = DataQuality::responseQualityFlags(
            new ResponseForQuality(array_fill(0, 21, 3), array_fill(0, 18, null), 2),
            12,
            self::thresholds(),
        );

        $this->assertSame([QualityFlag::PolaSeragam, QualityFlag::TerlaluCepat, QualityFlag::BanyakTidakTahu], $flags);
        $this->assertSame(['POLA_SERAGAM', 'TERLALU_CEPAT', 'BANYAK_TIDAK_TAHU'], QualityFlag::values($flags));
    }

    public function test_no_climate_or_characteristic_answers_means_no_flags(): void
    {
        $this->assertSame([], self::flags(['climateValues' => [], 'characteristicLevels' => []]));
    }
}
