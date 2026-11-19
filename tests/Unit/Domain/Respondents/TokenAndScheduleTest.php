<?php

declare(strict_types=1);

namespace Tests\Unit\Domain\Respondents;

use App\Domain\Respondents\ReminderPolicy;
use App\Domain\Respondents\SurveyWindow;
use App\Domain\Respondents\TokenCodec;
use App\Domain\Workflow\AssessmentStatus;
use DateTimeImmutable;
use PHPUnit\Framework\TestCase;

class TokenAndScheduleTest extends TestCase
{
    public function test_tokens_are_random_url_safe_and_only_their_hash_is_kept(): void
    {
        $a = TokenCodec::generate();
        $b = TokenCodec::generate();

        $this->assertNotSame($a, $b);
        $this->assertTrue(TokenCodec::looksValid($a));
        $this->assertSame(64, strlen(TokenCodec::hash($a)));
        $this->assertSame(TokenCodec::hash($a), TokenCodec::hash($a));
        $this->assertFalse(TokenCodec::looksValid('pendek'));
        $this->assertFalse(TokenCodec::looksValid(str_repeat('a', 42).'/'));
    }

    public function test_survey_is_open_only_while_collecting_and_inside_the_window(): void
    {
        $now = new DateTimeImmutable('2026-12-10 09:00');
        $opens = new DateTimeImmutable('2026-12-01');
        $closes = new DateTimeImmutable('2026-12-20');

        $this->assertTrue(SurveyWindow::isOpen(AssessmentStatus::DataCollection, null, null, $now));
        $this->assertTrue(SurveyWindow::isOpen(AssessmentStatus::DataCollection, $opens, $closes, $now));
        $this->assertFalse(SurveyWindow::isOpen(AssessmentStatus::Locked, $opens, $closes, $now));
        $this->assertFalse(SurveyWindow::isOpen(AssessmentStatus::DataCollection, $opens, $closes, new DateTimeImmutable('2026-11-30')));
        $this->assertFalse(SurveyWindow::isOpen(AssessmentStatus::DataCollection, $opens, $closes, $closes));
        $this->assertTrue(SurveyWindow::distributionOpen(AssessmentStatus::Locked));
        $this->assertFalse(SurveyWindow::distributionOpen(AssessmentStatus::Draft));
        $this->assertFalse(SurveyWindow::distributionOpen(AssessmentStatus::Validation));
    }

    public function test_reminders_go_to_email_invitations_at_most_three_times_three_days_apart(): void
    {
        $issued = new DateTimeImmutable('2026-12-01 08:00');
        $eligible = fn (?string $channel, int $count, ?DateTimeImmutable $last, string $now, ?DateTimeImmutable $done = null, ?DateTimeImmutable $revoked = null) => ReminderPolicy::eligible($channel, $revoked, $done, $count, $issued, $last, new DateTimeImmutable($now));

        $this->assertFalse($eligible('EMAIL', 0, null, '2026-12-03 08:00'));
        $this->assertTrue($eligible('EMAIL', 0, null, '2026-12-04 08:00'));
        $this->assertFalse($eligible('EMAIL', 1, new DateTimeImmutable('2026-12-04 08:00'), '2026-12-06 08:00'));
        $this->assertTrue($eligible('EMAIL', 2, new DateTimeImmutable('2026-12-07 08:00'), '2026-12-10 08:00'));
        $this->assertFalse($eligible('EMAIL', 3, new DateTimeImmutable('2026-12-10 08:00'), '2026-12-20 08:00'));
        $this->assertFalse($eligible('LINK', 0, null, '2026-12-20 08:00'));
        $this->assertFalse($eligible('EMAIL', 0, null, '2026-12-20 08:00', done: $issued));
        $this->assertFalse($eligible('EMAIL', 0, null, '2026-12-20 08:00', revoked: $issued));
    }
}
