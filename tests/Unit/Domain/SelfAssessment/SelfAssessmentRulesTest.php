<?php

declare(strict_types=1);

namespace Tests\Unit\Domain\SelfAssessment;

use App\Domain\SelfAssessment\SelfAssessmentRules;
use PHPUnit\Framework\TestCase;

/** Dibawa dari v1 src/lib/self-assessment/__tests__/rules.test.ts. */
class SelfAssessmentRulesTest extends TestCase
{
    public function test_justification_length_ignores_extra_whitespace(): void
    {
        $this->assertSame(0, SelfAssessmentRules::justificationLength(null));
        $this->assertSame(0, SelfAssessmentRules::justificationLength("   \n  "));
        $this->assertSame(16, SelfAssessmentRules::justificationLength("  rapat   K3\n\nbulanan "));
        $this->assertSame(5, SelfAssessmentRules::justificationLength('ánèíô'));
    }

    public function test_missing_lists_characteristics_without_a_level_or_a_long_enough_reason(): void
    {
        $long = str_repeat('a', 50);
        $missing = SelfAssessmentRules::missingForSubmit(['c1', 'c2', 'c3', 'c4'], [
            ['characteristicId' => 'c1', 'level' => 3, 'justification' => $long],
            ['characteristicId' => 'c2', 'level' => null, 'justification' => $long],
            ['characteristicId' => 'c3', 'level' => 4, 'justification' => str_repeat('a', 49)],
        ]);

        $this->assertSame([
            ['characteristicId' => 'c2', 'reasons' => ['LEVEL']],
            ['characteristicId' => 'c3', 'reasons' => ['JUSTIFICATION']],
            ['characteristicId' => 'c4', 'reasons' => ['LEVEL', 'JUSTIFICATION']],
        ], $missing);
        $this->assertSame([], SelfAssessmentRules::missingForSubmit(['c1'], [['characteristicId' => 'c1', 'level' => 5, 'justification' => "  {$long}  "]]));
    }
}
