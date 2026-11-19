<?php

declare(strict_types=1);

namespace Tests\Unit\Domain\Setup;

use App\Domain\Setup\ConditionEvaluator;
use App\Domain\Setup\ConsentTemplate;
use App\Domain\Setup\EditableParameters;
use App\Domain\Setup\Kickoff;
use App\Domain\Setup\PlanningChecklist;
use App\Domain\Setup\SetupFacts;
use App\Domain\Setup\UnitTree;
use App\Domain\Workflow\AssessmentStatus;
use App\Domain\Workflow\Workflow;
use PHPUnit\Framework\TestCase;

class SetupRulesTest extends TestCase
{
    /** @return array<string, mixed> */
    private function defaults(): array
    {
        return json_decode((string) file_get_contents(dirname(__DIR__, 4).'/seed/aspek-dan-parameter.json'), true);
    }

    private function completeFacts(): SetupFacts
    {
        return new SetupFacts(
            unitCount: 3, strataCount: 5, strataWithoutPopulation: 0, instrumentPublished: true, leadAssessorCount: 1,
            teamSize: 2, consentFilled: true, dpaSigned: true, samplePlanSaved: true, kickoffComplete: true,
            calibrationComplete: true,
        );
    }

    public function test_unit_tree_orders_parents_before_children_and_puts_orphans_at_root(): void
    {
        $tree = UnitTree::flatten([
            ['id' => 'c', 'parentId' => 'b', 'name' => 'Proyek Gedung'],
            ['id' => 'a', 'parentId' => null, 'name' => 'Kantor Pusat'],
            ['id' => 'b', 'parentId' => 'a', 'name' => 'Divisi Gedung'],
            ['id' => 'x', 'parentId' => 'hilang', 'name' => 'Cabang Medan'],
        ]);

        $this->assertSame(['x', 'a', 'b', 'c'], array_column($tree, 'id'));
        $this->assertSame([0, 0, 1, 2], array_column($tree, 'depth'));
    }

    public function test_unit_tree_detects_cycles(): void
    {
        $units = [['id' => 'a', 'parentId' => null], ['id' => 'b', 'parentId' => 'a'], ['id' => 'c', 'parentId' => 'b']];

        $this->assertTrue(UnitTree::wouldCreateCycle($units, 'a', 'c'));
        $this->assertTrue(UnitTree::wouldCreateCycle($units, 'a', 'a'));
        $this->assertFalse(UnitTree::wouldCreateCycle($units, 'c', 'a'));
        $this->assertFalse(UnitTree::wouldCreateCycle($units, 'b', null));
    }

    public function test_draft_drops_note_keys_and_starts_without_sample_plan(): void
    {
        $draft = EditableParameters::draftFromDefaults($this->defaults());

        $this->assertArrayNotHasKey('_catatan', $draft);
        $this->assertNull($draft['samplePlan']);
        $this->assertSame(0.35, $draft['layerWeights']['perception']);
    }

    public function test_cross_field_rules_reject_bad_weights_steps_and_small_report_cells(): void
    {
        $edits = EditableParameters::editablePart(EditableParameters::draftFromDefaults($this->defaults()));
        $this->assertSame([], EditableParameters::errors($edits));

        $edits['layerWeights']['perception'] = 0.5;
        $edits['sclThresholds'][0]['step'] = 3;
        $edits['quality']['minRespondentsPerReportCell'] = 4;

        $this->assertSame([
            'layerWeights' => 'LAYER_WEIGHTS_SUM',
            'sclThresholds' => 'SCL_STEPS',
            'quality.minRespondentsPerReportCell' => 'MIN_REPORT_CELL',
        ], EditableParameters::errors($edits));
    }

    public function test_changing_sampling_parameters_invalidates_the_saved_sample_plan(): void
    {
        $draft = [...EditableParameters::draftFromDefaults($this->defaults()), 'samplePlan' => ['surveyTargetTotal' => 341]];
        $edits = EditableParameters::editablePart($draft);

        $edits['divergenceThreshold'] = 1.5;
        $kept = EditableParameters::apply($draft, $edits);
        $this->assertSame(['surveyTargetTotal' => 341], $kept['samplePlan']);
        $this->assertSame(1.5, $kept['divergenceThreshold']);

        $edits['sampling']['marginOfError'] = 0.04;
        $this->assertNull(EditableParameters::apply($draft, $edits)['samplePlan']);
    }

    public function test_aspect_weights_follow_level_five_points_and_skip_the_contextual_dimension(): void
    {
        $weights = EditableParameters::aspectWeights(EditableParameters::draftFromDefaults($this->defaults()));

        $this->assertNotContains('KT', array_column($weights, 'code'));
        $this->assertEqualsWithDelta(1.0, array_sum(array_column($weights, 'weight')), 1e-9);
    }

    public function test_consent_text_names_the_data_location_and_retention(): void
    {
        $id = ConsentTemplate::render('id', 'PT Konstruksi Contoh', 'Singapura', 36);
        $en = ConsentTemplate::render('en', 'PT Konstruksi Contoh', 'Singapore', 36);

        $this->assertStringContainsString('pusat data di Singapura', $id);
        $this->assertStringContainsString('setelah 36 bulan', $id);
        $this->assertStringContainsString('PT Konstruksi Contoh', $id);
        $this->assertStringContainsString('data centre in Singapore', $en);
        $this->assertStringNotContainsString('Indonesia and destroyed', $en);
    }

    public function test_planning_transitions_pass_only_when_every_condition_is_met(): void
    {
        $toConfigured = Workflow::next(AssessmentStatus::Draft);
        $toLocked = Workflow::next(AssessmentStatus::Configured);

        $this->assertTrue(ConditionEvaluator::allowed(ConditionEvaluator::evaluate($toConfigured, $this->completeFacts())));
        $this->assertTrue(ConditionEvaluator::allowed(ConditionEvaluator::evaluate($toLocked, $this->completeFacts())));

        $alone = new SetupFacts(unitCount: 1, strataCount: 1, instrumentPublished: true, leadAssessorCount: 1, teamSize: 1);
        $results = ConditionEvaluator::evaluate($toConfigured, $alone);
        $this->assertFalse(ConditionEvaluator::allowed($results));
        $this->assertSame(['team_assigned'], array_values(array_map(
            fn ($r) => $r->key,
            array_filter($results, fn ($r) => $r->met === false),
        )));
        $this->assertSame('team', $results[4]->module);
    }

    public function test_data_collection_needs_a_roster_and_issued_survey_tokens(): void
    {
        $toCollection = Workflow::next(AssessmentStatus::Locked);
        $none = ConditionEvaluator::evaluate($toCollection, $this->completeFacts());
        $this->assertSame([['roster_imported', false, 'respondents'], ['tokens_issued', false, 'respondents']], array_map(fn ($r) => [$r->key, $r->met, $r->module], $none));
        $this->assertFalse(ConditionEvaluator::allowed($none));

        $ready = ConditionEvaluator::evaluate($toCollection, new SetupFacts(rosterCount: 120, activeSurveyTokens: 1));
        $this->assertTrue(ConditionEvaluator::allowed($ready));
    }

    public function test_conditions_of_modules_not_yet_built_are_unknown_and_block_the_transition(): void
    {
        $results = ConditionEvaluator::evaluate(Workflow::next(AssessmentStatus::DataCollection), $this->completeFacts());

        $this->assertContains(null, array_map(fn ($r) => $r->met, $results));
        $this->assertFalse(ConditionEvaluator::allowed($results));
    }

    public function test_unit_scope_includes_every_unit_below_the_assigned_ones(): void
    {
        $units = [
            ['id' => 'hq', 'parentId' => null], ['id' => 'div', 'parentId' => 'hq'],
            ['id' => 'p1', 'parentId' => 'div'], ['id' => 'p2', 'parentId' => 'div'], ['id' => 'other', 'parentId' => 'hq'],
        ];

        $this->assertEqualsCanonicalizing(['div', 'p1', 'p2'], UnitTree::withDescendants($units, ['div']));
        $this->assertEqualsCanonicalizing(['p1', 'other'], UnitTree::withDescendants($units, ['p1', 'other', 'tidak-ada']));
        $this->assertSame([], UnitTree::withDescendants($units, []));
    }

    public function test_kickoff_needs_leadership_commitment_and_worker_briefing(): void
    {
        $complete = [
            'leadership' => ['date' => '2026-11-03', 'leader' => 'Direktur Operasi', 'note' => ''],
            'briefing' => ['date' => '2026-11-05', 'note' => 'Apel pagi di semua proyek'],
        ];
        $this->assertTrue(Kickoff::isComplete($complete));
        $this->assertFalse(Kickoff::isComplete(null));
        $this->assertFalse(Kickoff::isComplete([...$complete, 'briefing' => ['date' => '2026-11-05', 'note' => '  ']]));
    }

    public function test_calibration_must_cover_every_current_team_member(): void
    {
        $calibration = ['date' => '2026-11-04', 'attendees' => [7, 9]];

        $this->assertTrue(Kickoff::calibrationComplete($calibration, [7, 9]));
        $this->assertFalse(Kickoff::calibrationComplete($calibration, [7, 9, 12]));
        $this->assertFalse(Kickoff::calibrationComplete(['attendees' => [7]], [7]));
        $this->assertFalse(Kickoff::calibrationComplete($calibration, []));
    }

    public function test_planning_checklist_counts_the_seven_setup_pages(): void
    {
        $partial = new SetupFacts(unitCount: 2, strataCount: 5, strataWithoutPopulation: 1, instrumentPublished: true);
        $items = PlanningChecklist::items($partial, locked: false);

        $this->assertSame(PlanningChecklist::ITEMS, array_column($items, 'key'));
        $this->assertSame(2, PlanningChecklist::doneCount($items));
        $this->assertSame(7, PlanningChecklist::doneCount(PlanningChecklist::items($partial, locked: true)));
    }
}
