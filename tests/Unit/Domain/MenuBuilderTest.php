<?php

declare(strict_types=1);

namespace Tests\Unit\Domain;

use App\Domain\Access\Permissions;
use App\Domain\Access\Resource;
use App\Domain\Access\Role;
use App\Domain\Navigation\MenuBuilder;
use App\Domain\Navigation\Module;
use App\Domain\Navigation\ModuleCatalog;
use App\Domain\Workflow\AssessmentStatus;
use App\Domain\Workflow\StageState;
use PHPUnit\Framework\TestCase;

class MenuBuilderTest extends TestCase
{
    /** @param list<Module> $modules */
    private function keys(array $modules): array
    {
        return array_map(fn (Module $m) => $m->key, $modules);
    }

    public function test_all_six_stages_are_always_returned_in_order(): void
    {
        $menu = MenuBuilder::byStage(AssessmentStatus::DataCollection, [Role::ExecutiveViewer]);
        $this->assertSame([1, 2, 3, 4, 5, 6], array_map(fn ($g) => $g['stage']->number(), $menu));
        $this->assertSame(StageState::Done, $menu[0]['state']);
        $this->assertSame(StageState::Current, $menu[1]['state']);
        $this->assertSame(StageState::Upcoming, $menu[4]['state']);
    }

    public function test_lead_assessor_sees_every_stage_module(): void
    {
        $menu = MenuBuilder::byStage(AssessmentStatus::Scoring, [Role::LeadAssessor]);
        $visible = array_merge(...array_map(fn ($g) => $this->keys($g['modules']), $menu));
        $staged = array_filter(ModuleCatalog::all(AssessmentStatus::Scoring), fn (Module $m) => $m->stage !== null);
        $this->assertSame($this->keys(array_values($staged)), $visible);
    }

    public function test_client_roles_never_see_raw_data_or_scoring_pages(): void
    {
        foreach ([Role::ClientAdmin, Role::UnitCoordinator, Role::ExecutiveViewer] as $role) {
            $menu = MenuBuilder::byStage(AssessmentStatus::Scoring, [$role]);
            $visible = array_merge(...array_map(fn ($g) => $this->keys($g['modules']), $menu));
            foreach (['dataQuality', 'findings', 'validation', 'scoring', 'panel'] as $hidden) {
                $this->assertNotContains($hidden, $visible, "{$role->value} tidak boleh melihat {$hidden}");
            }
        }
    }

    public function test_super_admin_cannot_open_respondent_or_result_pages(): void
    {
        $menu = MenuBuilder::byStage(AssessmentStatus::Reported, [Role::SuperAdmin]);
        $visible = array_merge(...array_map(fn ($g) => $this->keys($g['modules']), $menu));
        foreach (['respondents', 'evidence', 'scoring', 'dashboard', 'report'] as $hidden) {
            $this->assertNotContains($hidden, $visible);
        }
        $this->assertSame(['audit'], $this->keys(MenuBuilder::crossStage(AssessmentStatus::Reported, [Role::SuperAdmin])));
    }

    public function test_executive_viewer_reads_parameters_only_after_lock(): void
    {
        $before = MenuBuilder::byStage(AssessmentStatus::Configured, [Role::ExecutiveViewer])[0]['modules'];
        $after = MenuBuilder::byStage(AssessmentStatus::Locked, [Role::ExecutiveViewer])[0]['modules'];
        $this->assertSame([], $this->keys($before));
        $this->assertContains('parameters', $this->keys($after));
    }

    public function test_role_menu_uses_the_highest_role_and_respects_permissions(): void
    {
        $this->assertSame(['dashboard', 'report', 'monitoring'], $this->keys(MenuBuilder::byRole(AssessmentStatus::Reported, [Role::ExecutiveViewer])));
        $coordinator = $this->keys(MenuBuilder::byRole(AssessmentStatus::DataCollection, [Role::UnitCoordinator]));
        $this->assertSame(['respondents', 'participation', 'evidence', 'observations'], $coordinator);
        // Pengguna dengan dua peran memakai tugas peran tertinggi.
        $both = $this->keys(MenuBuilder::byRole(AssessmentStatus::Scoring, [Role::ExecutiveViewer, Role::LeadAssessor]));
        $this->assertContains('panel', $both);
        $this->assertSame([], MenuBuilder::byRole(AssessmentStatus::Draft, []));
    }

    public function test_account_menu_depends_on_account_type(): void
    {
        $keys = fn (array $roles) => array_column(MenuBuilder::account($roles), 'key');
        $this->assertSame(['assessments', 'account'], $keys([Role::ExecutiveViewer]));
        $this->assertSame(['assessments', 'newAssessment', 'organizations', 'account'], $keys([Role::LeadAssessor]));
        $this->assertSame(['assessments', 'organizations', 'retention', 'systemStatus', 'account'], $keys([Role::SuperAdmin]));
    }

    public function test_menu_never_offers_a_page_the_matrix_forbids(): void
    {
        // Contoh silang terhadap matriks docs/04: daftar responden tertutup bagi asesor dan pemirsa eksekutif.
        $this->assertFalse(Permissions::canRead([Role::Assessor], Resource::Roster));
        $this->assertFalse(Permissions::canRead([Role::SuperAdmin], Resource::RawSurveyAnswers));
        $this->assertTrue(Permissions::canWrite([Role::UnitCoordinator], Resource::EvidenceAndObservations));
        $this->assertFalse(Permissions::canWrite([Role::Assessor], Resource::PanelAndFinalization));
        foreach (AssessmentStatus::cases() as $status) {
            foreach (ModuleCatalog::all($status) as $module) {
                $this->assertNotEmpty($module->roles, $module->key);
                $this->assertMatchesRegularExpression('/^[a-z][a-z-]*(\/[a-z-]+)?$/', $module->path);
            }
        }
    }

    public function test_roles_are_valid_only_in_the_matching_organization_type(): void
    {
        $this->assertTrue(Role::LeadAssessor->isValidFor(true));
        $this->assertFalse(Role::LeadAssessor->isValidFor(false));
        $this->assertTrue(Role::ClientAdmin->isValidFor(false));
        $this->assertFalse(Role::ExecutiveViewer->requiresTwoFactor());
        $this->assertTrue(Role::ClientAdmin->requiresTwoFactor());
    }
}
