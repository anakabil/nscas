<?php

declare(strict_types=1);

namespace Tests\Unit\Domain\Survey;

use App\Domain\Respondents\SurveyWindow;
use App\Domain\Survey\DurationBucket;
use App\Domain\Survey\SubmissionCheck;
use App\Domain\Survey\SurveyRules;
use App\Domain\Workflow\AssessmentStatus;
use DateTimeImmutable;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** Dibawa dari v1 src/lib/survey/__tests__/rules.test.ts, ditambah pemeriksaan kelengkapan kiriman. */
class SurveyRulesTest extends TestCase
{
    /** @return iterable<array{int, DurationBucket}> */
    public static function durations(): iterable
    {
        yield [0, DurationBucket::Under5];
        yield [299, DurationBucket::Under5];
        yield [300, DurationBucket::From5To10];
        yield [599, DurationBucket::From5To10];
        yield [600, DurationBucket::From10To15];
        yield [900, DurationBucket::From15To20];
        yield [1199, DurationBucket::From15To20];
        yield [1200, DurationBucket::Over20];
        yield [86_400, DurationBucket::Over20];
    }

    #[DataProvider('durations')]
    public function test_duration_is_kept_only_as_a_five_minute_bucket(int $seconds, DurationBucket $bucket): void
    {
        $this->assertSame($bucket, DurationBucket::fromSeconds($seconds));
    }

    public function test_median_duration_is_estimated_from_bucket_midpoints(): void
    {
        $this->assertSame(15.0, DurationBucket::estimatedMedianMinutes([]));
        $this->assertSame(15.0, DurationBucket::estimatedMedianMinutes(['UNDER_5' => 9]));
        $this->assertSame(12.5, DurationBucket::estimatedMedianMinutes(['UNDER_5' => 2, 'FROM_5_TO_10' => 3, 'FROM_10_TO_15' => 6]));
        $this->assertSame(25.0, DurationBucket::estimatedMedianMinutes(['FROM_15_TO_20' => 4, 'OVER_20' => 7]));
        // Jumlah genap yang terbelah di batas rentang: rata-rata dua titik tengah.
        $this->assertSame(12.5, DurationBucket::estimatedMedianMinutes(['FROM_5_TO_10' => 5, 'FROM_10_TO_15' => 0, 'FROM_15_TO_20' => 5]));
    }

    public function test_submission_date_is_the_wib_calendar_day_and_token_times_round_to_the_hour(): void
    {
        $this->assertSame('2026-11-02', SurveyRules::wibDate(new DateTimeImmutable('2026-11-02T16:59:59Z')));
        $this->assertSame('2026-11-03', SurveyRules::wibDate(new DateTimeImmutable('2026-11-02T17:00:00Z')));
        $this->assertSame('2026-11-02T10:00:00+00:00', SurveyRules::roundToNearestHour(new DateTimeImmutable('2026-11-02T10:29:59Z'))->format('c'));
        $this->assertSame('2026-11-02T11:00:00+00:00', SurveyRules::roundToNearestHour(new DateTimeImmutable('2026-11-02T10:30:00Z'))->format('c'));
    }

    public function test_statement_order_is_stable_per_respondent_and_balanced_across_respondents(): void
    {
        $statements = array_map(fn ($id) => ['id' => $id], ['s1', 's2', 's3', 's4', 's5']);
        $a = SurveyRules::respondentOrder($statements, 'token-a');
        $this->assertSame($a, SurveyRules::respondentOrder($statements, 'token-a'));
        $ids = array_column($a, 'id');
        sort($ids);
        $this->assertSame(['s1', 's2', 's3', 's4', 's5'], $ids);

        $firsts = [];
        $orders = [];
        for ($i = 0; $i < 2000; $i++) {
            $order = array_column(SurveyRules::respondentOrder($statements, "token-{$i}"), 'id');
            $orders[implode('', $order)] = true;
            $firsts[$order[0]] = ($firsts[$order[0]] ?? 0) + 1;
        }
        $this->assertGreaterThan(100, count($orders));
        foreach ($firsts as $count) {
            $this->assertGreaterThan(0.15, $count / 2000);
            $this->assertLessThan(0.25, $count / 2000);
        }
    }

    public function test_submission_must_answer_every_item_once_and_levels_come_from_the_server(): void
    {
        $levels = ['c1' => ['s1a' => 1, 's1b' => 4], 'c2' => ['s2a' => 2, 's2b' => 5]];
        $items = ['i1', 'i2'];
        $climate = [['itemId' => 'i1', 'value' => 4], ['itemId' => 'i2', 'value' => 2]];

        $ok = SubmissionCheck::check($levels, $items, [['characteristicId' => 'c1', 'statementId' => 's1b'], ['characteristicId' => 'c2', 'statementId' => null]], $climate);
        $this->assertTrue($ok['ok']);
        $this->assertSame([['characteristicId' => 'c1', 'level' => 4], ['characteristicId' => 'c2', 'level' => null]], $ok['characteristicAnswers']);

        $this->assertSame('INCOMPLETE', SubmissionCheck::check($levels, $items, [['characteristicId' => 'c1', 'statementId' => 's1a']], $climate)['code']);
        $this->assertSame('INCOMPLETE', SubmissionCheck::check($levels, $items, [['characteristicId' => 'c1', 'statementId' => 's1a'], ['characteristicId' => 'c1', 'statementId' => 's1b']], $climate)['code']);
        // Pernyataan dari karakteristik lain tidak diterima.
        $this->assertSame('UNKNOWN_ITEM', SubmissionCheck::check($levels, $items, [['characteristicId' => 'c1', 'statementId' => 's2a'], ['characteristicId' => 'c2', 'statementId' => 's2b']], $climate)['code']);
        $this->assertSame('UNKNOWN_ITEM', SubmissionCheck::check($levels, $items, [['characteristicId' => 'c1', 'statementId' => 's1a'], ['characteristicId' => 'cX', 'statementId' => null]], $climate)['code']);
        $this->assertSame('UNKNOWN_ITEM', SubmissionCheck::check($levels, $items, [['characteristicId' => 'c1', 'statementId' => 's1a'], ['characteristicId' => 'c2', 'statementId' => null]], [['itemId' => 'i1', 'value' => 4], ['itemId' => 'iX', 'value' => 2]])['code']);
    }

    public function test_survey_window_state_distinguishes_not_yet_open_from_closed(): void
    {
        $now = new DateTimeImmutable('2026-12-10 09:00');
        $this->assertSame('NOT_OPEN', SurveyWindow::state(AssessmentStatus::Locked, null, null, $now));
        $this->assertSame('NOT_OPEN', SurveyWindow::state(AssessmentStatus::DataCollection, new DateTimeImmutable('2026-12-11'), null, $now));
        $this->assertSame('OPEN', SurveyWindow::state(AssessmentStatus::DataCollection, new DateTimeImmutable('2026-12-01'), new DateTimeImmutable('2026-12-20'), $now));
        $this->assertSame('CLOSED', SurveyWindow::state(AssessmentStatus::DataCollection, null, new DateTimeImmutable('2026-12-10 09:00'), $now));
        $this->assertSame('CLOSED', SurveyWindow::state(AssessmentStatus::Validation, null, null, $now));
    }
}
