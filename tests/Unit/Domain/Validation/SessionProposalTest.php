<?php

declare(strict_types=1);

namespace Tests\Unit\Domain\Validation;

use App\Domain\Validation\SessionProposal;
use App\Domain\Validation\ValidationRules;
use App\Domain\Workflow\AssessmentStatus;
use PHPUnit\Framework\TestCase;

/** Dibawa dari v1 src/lib/validation/__tests__/proposal.test.ts, ditambah kunjungan fisik (D6). */
class SessionProposalTest extends TestCase
{
    /** @return list<array{id: string, code: string, group: string, population: int}> */
    private function strata(): array
    {
        $fixture = json_decode((string) file_get_contents(__DIR__.'/../../../../seed/fixtures/sampel-3000.json'), true);
        $groups = ['S1' => 'MANAGEMENT', 'S2' => 'MANAGEMENT', 'S3' => 'SUPERVISORY', 'S4' => 'FIELD', 'S5' => 'FIELD'];

        return array_map(fn (array $s) => ['id' => $s['code'], 'code' => $s['code'], 'group' => $groups[$s['code']] ?? 'FIELD', 'population' => (int) $s['population']], $fixture['expected']['strata']);
    }

    public function test_allocation_keeps_the_total_and_follows_population(): void
    {
        $this->assertSame(['a' => 5, 'b' => 3, 'c' => 2], SessionProposal::allocate(10, [['id' => 'a', 'population' => 50], ['id' => 'b', 'population' => 30], ['id' => 'c', 'population' => 20]]));
        $this->assertSame(7, array_sum(SessionProposal::allocate(7, [['id' => 'a', 'population' => 10], ['id' => 'b', 'population' => 10], ['id' => 'c', 'population' => 10]])));
        $this->assertSame(['kecil' => 0, 'besar' => 10], SessionProposal::allocate(10, [['id' => 'kecil', 'population' => 1], ['id' => 'besar', 'population' => 100]]));
        $this->assertSame(['a' => 3], SessionProposal::allocate(50, [['id' => 'a', 'population' => 3]]));
        $this->assertSame(['a' => 2, 'b' => 3], SessionProposal::allocate(10, [['id' => 'a', 'population' => 2], ['id' => 'b', 'population' => 3]]));
    }

    public function test_participants_are_split_evenly_with_at_most_eight_per_session(): void
    {
        $this->assertSame([6, 6, 5], SessionProposal::splitIntoSessions(17, 8));
        $this->assertSame([8, 8], SessionProposal::splitIntoSessions(16, 8));
        $this->assertSame([3], SessionProposal::splitIntoSessions(3, 8));
        $this->assertSame([], SessionProposal::splitIntoSessions(0, 8));
    }

    public function test_proposal_for_three_thousand_workers(): void
    {
        $p = SessionProposal::propose(33, 66, 4, $this->strata(), 8);
        $interviews = array_values(array_filter($p['sessions'], fn ($s) => $s['type'] === 'INTERVIEW'));
        $groups = array_values(array_filter($p['sessions'], fn ($s) => $s['type'] === 'FOCUS_GROUP'));
        $this->assertCount(33, $interviews);
        $this->assertTrue(collect($interviews)->every(fn ($s) => in_array($s['stratumCode'], ['S1', 'S2', 'S3'], true) && $s['participantCount'] === 1));
        $this->assertSame(66, array_sum(array_column($groups, 'participantCount')));
        $this->assertTrue(collect($groups)->every(fn ($s) => in_array($s['stratumCode'], ['S3', 'S4', 'S5'], true) && $s['participantCount'] >= 1 && $s['participantCount'] <= 8));
        $this->assertTrue(collect($p['sessions'])->where('stratumCode', 'S1')->every(fn ($s) => $s['layer'] === 'MANAGEMENT'));
        // D6: dari empat kunjungan, satu fisik dan tiga virtual.
        $this->assertCount(1, array_filter($p['sessions'], fn ($s) => $s['type'] === 'SITE_VISIT'));
        $this->assertCount(3, array_filter($p['sessions'], fn ($s) => $s['type'] === 'VIRTUAL_SITE_VISIT'));
        $this->assertSame(['interviews' => 0, 'focusGroupParticipants' => 0], $p['unallocated']);
    }

    public function test_at_least_one_physical_visit_and_unallocated_quota_is_reported(): void
    {
        $fieldOnly = array_values(array_filter($this->strata(), fn ($s) => $s['group'] === 'FIELD'));
        $p = SessionProposal::propose(14, 27, 0, $fieldOnly, 8);
        $this->assertSame(14, $p['unallocated']['interviews']);
        $this->assertSame([['type' => 'SITE_VISIT', 'stratumId' => null, 'stratumCode' => null, 'layer' => 'FIELD', 'participantCount' => 0, 'sequence' => 1]], array_values(array_filter($p['sessions'], fn ($s) => str_contains($s['type'], 'VISIT'))));
    }

    public function test_ratings_statuses_and_completion_rules(): void
    {
        foreach ([1.0, 1.5, 3.0, 4.5, 5.0] as $ok) {
            $this->assertTrue(ValidationRules::isValidRating($ok));
        }
        foreach ([0.5, 5.5, 3.25, 2.7] as $bad) {
            $this->assertFalse(ValidationRules::isValidRating($bad));
        }
        $this->assertTrue(ValidationRules::planningOpen(AssessmentStatus::DataCollection));
        $this->assertFalse(ValidationRules::planningOpen(AssessmentStatus::Scoring));
        $this->assertTrue(ValidationRules::ratingOpen(AssessmentStatus::Validation));
        $this->assertFalse(ValidationRules::ratingOpen(AssessmentStatus::PanelReview));

        $this->assertFalse(ValidationRules::sessionsCompleted([]));
        $this->assertFalse(ValidationRules::sessionsCompleted([['status' => 'COMPLETED', 'ratings' => 3], ['status' => 'SCHEDULED', 'ratings' => 0]]));
        $this->assertTrue(ValidationRules::sessionsCompleted([['status' => 'COMPLETED', 'ratings' => 3], ['status' => 'CANCELLED', 'ratings' => 0]]));
        $this->assertFalse(ValidationRules::sessionsCompleted([['status' => 'COMPLETED', 'ratings' => 0]]));

        $this->assertFalse(ValidationRules::planSet([['type' => 'INTERVIEW', 'status' => 'SCHEDULED', 'focus' => 2]]));
        $this->assertFalse(ValidationRules::planSet([['type' => 'INTERVIEW', 'status' => 'SCHEDULED', 'focus' => 0], ['type' => 'SITE_VISIT', 'status' => 'SCHEDULED', 'focus' => 0]]));
        $this->assertTrue(ValidationRules::planSet([['type' => 'FOCUS_GROUP', 'status' => 'SCHEDULED', 'focus' => 3], ['type' => 'SITE_VISIT', 'status' => 'SCHEDULED', 'focus' => 0]]));
    }
}
