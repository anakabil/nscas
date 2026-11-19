<?php

declare(strict_types=1);

namespace Tests\Unit\Domain\Panel;

use App\Domain\Panel\PanelRules;
use App\Domain\Scoring\CharacteristicInput;
use App\Domain\Scoring\EngineInput;
use App\Domain\Scoring\Flag;
use App\Domain\Workflow\AssessmentStatus;
use PHPUnit\Framework\TestCase;

final class PanelRulesTest extends TestCase
{
    public function test_ratings_of_others_stay_hidden_until_the_viewer_rates(): void
    {
        $ratings = [['assessorId' => 1, 'level' => 3.0], ['assessorId' => 2, 'level' => 4.0]];

        $this->assertSame(['own' => null, 'others' => [], 'hidden' => 2], PanelRules::visibleRatings($ratings, 3));
        $seen = PanelRules::visibleRatings($ratings, 2);
        $this->assertSame(4.0, $seen['own']['level']);
        $this->assertSame([['assessorId' => 1, 'level' => 3.0]], $seen['others']);
    }

    public function test_two_distinct_assessors_are_needed_for_every_characteristic(): void
    {
        $ratings = [
            ['characteristicId' => 'a', 'assessorId' => 1], ['characteristicId' => 'a', 'assessorId' => 2],
            ['characteristicId' => 'b', 'assessorId' => 1], ['characteristicId' => 'b', 'assessorId' => 1],
        ];
        $this->assertFalse(PanelRules::twoAssessorsComplete(['a', 'b'], $ratings));
        $this->assertTrue(PanelRules::twoAssessorsComplete(['a'], $ratings));
        $this->assertFalse(PanelRules::twoAssessorsComplete([], $ratings));
    }

    public function test_panel_values_and_status_windows(): void
    {
        $this->assertTrue(PanelRules::isValidPanelValue(2.75));
        $this->assertFalse(PanelRules::isValidPanelValue(2.755));
        $this->assertFalse(PanelRules::isValidPanelValue(0.99));
        $this->assertTrue(PanelRules::ratingOpen(AssessmentStatus::Validation));
        $this->assertFalse(PanelRules::ratingOpen(AssessmentStatus::PanelReview));
        $this->assertTrue(PanelRules::runOpen(AssessmentStatus::Scoring));
        $this->assertTrue(PanelRules::panelOpen(AssessmentStatus::PanelReview));
    }

    public function test_flagged_characteristics_need_a_written_decision(): void
    {
        $result = [
            ['code' => 'K1.1', 'flags' => ['PERLU_REKONSILIASI']],
            ['code' => 'K1.2', 'flags' => ['LAPISAN_TIDAK_LENGKAP']],
            ['code' => 'K1.3', 'flags' => ['SELISIH_PERSEPSI_BUKTI', 'PENILAI_TUNGGAL']],
        ];
        $needed = PanelRules::needsDecision($result);
        $this->assertSame(['K1.1', 'K1.3'], $needed);
        $this->assertFalse(PanelRules::decisionsComplete($needed, ['K1.1' => str_repeat('a', 25)]));
        $this->assertFalse(PanelRules::decisionsComplete($needed, ['K1.1' => str_repeat('a', 25), 'K1.3' => 'pendek']));
        $this->assertTrue(PanelRules::decisionsComplete($needed, ['K1.1' => str_repeat('a', 25), 'K1.3' => str_repeat('b', 20)]));
    }

    public function test_equivalent_track_needs_all_four_steps_of_every_aspect(): void
    {
        $rows = [];
        foreach ([2, 3, 4, 5] as $step) {
            $rows[] = ['aspectCode' => 'A1', 'step' => $step, 'percent' => 80.0];
        }
        $this->assertSame(['A1' => [2 => 0.8, 3 => 0.8, 4 => 0.8, 5 => 0.8]], PanelRules::sclFulfilment($rows, ['A1']));
        $this->assertNull(PanelRules::sclFulfilment($rows, ['A1', 'A2']));
    }

    public function test_stored_engine_input_round_trips_with_panel_values(): void
    {
        $input = new EngineInput([
            new CharacteristicInput('K1.1', 'A1', false, 3.2, 2.5, null, flags: [Flag::PerluRekonsiliasi]),
        ], 4.0, null);
        $stored = json_decode(json_encode(PanelRules::serializeInput($input)), true);
        $restored = PanelRules::restoreInput($stored, ['K1.1' => 2.75]);

        $this->assertSame(2.75, $restored->characteristics[0]->panelAdjusted);
        $this->assertSame([Flag::PerluRekonsiliasi], $restored->characteristics[0]->flags);
        $this->assertSame(3.2, $restored->characteristics[0]->perception);
        $this->assertNull($restored->characteristics[0]->validation);
    }
}
