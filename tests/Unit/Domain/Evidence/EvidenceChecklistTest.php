<?php

declare(strict_types=1);

namespace Tests\Unit\Domain\Evidence;

use App\Domain\Evidence\EvidenceChecklist;
use App\Domain\Evidence\EvidenceRules;
use App\Domain\Workflow\AssessmentStatus;
use PHPUnit\Framework\TestCase;

/** Dibawa dari v1 src/lib/evidence/__tests__/rules.test.ts. */
class EvidenceChecklistTest extends TestCase
{
    /** @return list<array{id: string, code: string, name: string, requirements: list<array{id: string, description: string}>}> */
    private function characteristics(): array
    {
        return [
            ['id' => 'c1', 'code' => 'K1.1', 'name' => 'Keteladanan', 'requirements' => [
                ['id' => 'r1', 'description' => 'Risalah rapat'],
                ['id' => 'r2', 'description' => 'Catatan kunjungan'],
                ['id' => 'r3', 'description' => 'Tinjauan manajemen'],
            ]],
            ['id' => 'c2', 'code' => 'K1.2', 'name' => 'Anggaran', 'requirements' => [['id' => 'r4', 'description' => 'Anggaran K3']]],
            ['id' => 'c3', 'code' => 'K1.3', 'name' => 'Penghargaan', 'requirements' => []],
        ];
    }

    public function test_marks_met_items_and_counts_evidence_types(): void
    {
        $rows = EvidenceChecklist::build($this->characteristics(), [
            ['evidenceItemId' => 'e1', 'characteristicId' => 'c1', 'requirementIds' => ['r1']],
            ['evidenceItemId' => 'e2', 'characteristicId' => 'c1', 'requirementIds' => ['r1', 'r2']],
            ['evidenceItemId' => 'e3', 'characteristicId' => 'c2', 'requirementIds' => ['r4']],
            ['evidenceItemId' => 'e4', 'characteristicId' => 'c3', 'requirementIds' => []],
        ], 2);

        $this->assertSame([2, 2, false], [$rows[0]['evidenceCount'], $rows[0]['types'], $rows[0]['belowMinimum']]);
        $this->assertSame([true, true, false], array_column($rows[0]['requirements'], 'met'));
        $this->assertSame([1, 1, true], [$rows[1]['evidenceCount'], $rows[1]['types'], $rows[1]['belowMinimum']]);
        $this->assertSame([1, 1, true], [$rows[2]['evidenceCount'], $rows[2]['types'], $rows[2]['belowMinimum']]);
    }

    public function test_two_items_without_checklist_items_count_as_one_type(): void
    {
        $rows = EvidenceChecklist::build($this->characteristics(), [
            ['evidenceItemId' => 'e1', 'characteristicId' => 'c1', 'requirementIds' => []],
            ['evidenceItemId' => 'e2', 'characteristicId' => 'c1', 'requirementIds' => ['r-lain']],
        ], 2);

        $this->assertSame([1, true], [$rows[0]['types'], $rows[0]['belowMinimum']]);
    }

    public function test_characteristics_without_evidence_are_below_the_threshold(): void
    {
        foreach (EvidenceChecklist::build($this->characteristics(), [], 2) as $row) {
            $this->assertTrue($row['belowMinimum']);
            $this->assertSame(0, $row['types']);
        }
    }

    public function test_upload_window_and_unit_scope(): void
    {
        $this->assertFalse(EvidenceRules::uploadOpen(AssessmentStatus::Configured));
        $this->assertTrue(EvidenceRules::uploadOpen(AssessmentStatus::Locked));
        $this->assertTrue(EvidenceRules::uploadOpen(AssessmentStatus::Validation));
        $this->assertTrue(EvidenceRules::uploadOpen(AssessmentStatus::PanelReview));
        $this->assertFalse(EvidenceRules::uploadOpen(AssessmentStatus::ActionPlanning));

        $this->assertTrue(EvidenceRules::unitAllowed(null, null));
        $this->assertTrue(EvidenceRules::unitAllowed(['u1'], 'u1'));
        $this->assertFalse(EvidenceRules::unitAllowed(['u1'], 'u2'));
        // Bukti tingkat organisasi hanya untuk pengguna tanpa batas unit.
        $this->assertFalse(EvidenceRules::unitAllowed(['u1'], null));
    }
}
