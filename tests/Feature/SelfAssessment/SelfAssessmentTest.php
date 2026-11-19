<?php

namespace Tests\Feature\SelfAssessment;

use App\Domain\Access\Role;
use App\Domain\Workflow\AssessmentStatus;
use App\Models\AccessToken;
use App\Models\Assessment;
use App\Models\AuditLog;
use App\Models\LevelStatement;
use App\Models\Organization;
use App\Models\SelfAssessment;
use App\Models\SelfAssessmentAnswer;
use App\Models\Unit;
use App\Models\User;
use App\Services\SetupFactsCollector;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\BuildsAssessments;
use Tests\TestCase;

/**
 * Fase R4 (docs/01 M4): penilaian mandiri manajemen yang teridentifikasi, dengan alasan wajib, draf di server, kirim
 * sekali, jejak audit, dan hak akses sesuai matriks docs/04.
 */
class SelfAssessmentTest extends TestCase
{
    use BuildsAssessments, RefreshDatabase;

    private User $lead;

    private User $admin;

    private Assessment $assessment;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpAssessmentWorld();
        $this->lead = $this->member($this->operator, Role::LeadAssessor);
        $this->admin = $this->member($this->client, Role::ClientAdmin);
        $this->assessment = $this->lockedAssessment($this->lead, $this->member($this->operator, Role::Assessor));
    }

    /** @return array{id: string, raw: string} */
    private function issue(string $name = 'Ir. Budi Hartono'): array
    {
        $unit = Unit::where('assessment_id', $this->assessment->id)->orderBy('name')->firstOrFail();
        $link = $this->actingAs($this->admin)->post(route('self-assessments.store', $this->assessment), [
            'name' => $name, 'position' => 'Manajer Proyek', 'unit_id' => $unit->id,
        ])->assertSessionHas('selfAssessmentLink')->getSession()->get('selfAssessmentLink')['link'];
        auth()->logout();

        return ['id' => SelfAssessment::latest('created_at')->value('id'), 'raw' => substr($link, strrpos($link, '/') + 1)];
    }

    /** @return array<string, mixed> */
    private function formData(TestResponse $response): array
    {
        preg_match('#<script type="application/json" id="sa-data">(.*?)</script>#s', (string) $response->getContent(), $m);
        $this->assertNotEmpty($m);

        return json_decode($m[1], true);
    }

    private function answer(string $raw, string $characteristicId, ?string $statementId, string $justification): TestResponse
    {
        return $this->putJson("/sa/{$raw}/answer", ['characteristicId' => $characteristicId, 'statementId' => $statementId, 'justification' => $justification, 'evidenceIds' => []]);
    }

    public function test_client_admin_issues_an_identified_link_shown_once(): void
    {
        $issued = $this->issue();
        $sa = SelfAssessment::findOrFail($issued['id']);

        $this->assertSame(['DRAFT', 'Ir. Budi Hartono', 'Manajer Proyek'], [$sa->status, $sa->respondent_name, $sa->respondent_position]);
        $token = AccessToken::findOrFail($sa->access_token_id);
        $this->assertSame('SELF_ASSESSMENT', $token->kind);
        $this->assertNotSame($issued['raw'], $token->token_hash);
        $this->assertTrue(AuditLog::where('action', 'selfAssessment.issue')->where('entity_id', $sa->id)->exists());
        // Token penilaian mandiri tidak dihitung sebagai token survei.
        $this->assertSame(0, SetupFactsCollector::for($this->assessment)->activeSurveyTokens);
        $this->assertSame(1, SetupFactsCollector::for($this->assessment)->selfAssessmentsIssued);
    }

    public function test_form_saves_drafts_requires_reasons_and_locks_after_submit(): void
    {
        $issued = $this->issue();
        $response = $this->get("/sa/{$issued['raw']}")->assertOk()->assertSee('id="sa-root"', false);
        $data = $this->formData($response);
        $this->assertCount(18, $data['characteristics']);
        $this->assertStringNotContainsString('"level"', (string) $response->getContent());
        $this->assertSame('Ir. Budi Hartono', $data['profile']['name']);

        $this->putJson("/sa/{$issued['raw']}/profile", ['name' => 'Ir. Budi Hartono, M.T.', 'position' => 'Manajer Proyek Senior'])->assertOk();
        $this->assertSame('Ir. Budi Hartono, M.T.', SelfAssessment::findOrFail($issued['id'])->respondent_name);
        $this->assertTrue(AuditLog::where('action', 'selfAssessment.profile_update')->exists());

        $first = $data['characteristics'][0];
        $this->answer($issued['raw'], $first['id'], $first['statements'][2]['id'], 'Terlalu pendek')->assertOk();
        $this->postJson("/sa/{$issued['raw']}/submit")->assertStatus(422)->assertJson(['error' => 'INCOMPLETE'])
            ->assertJsonCount(18, 'missing')
            ->assertJsonPath('missing.0.reasons', ['JUSTIFICATION'])
            ->assertJsonPath('missing.1.reasons', ['LEVEL', 'JUSTIFICATION']);

        $reason = 'Rapat keselamatan bulanan dipimpin direktur dan notulanya ditindaklanjuti dalam dua minggu.';
        foreach ($data['characteristics'] as $c) {
            $this->answer($issued['raw'], $c['id'], $c['statements'][1]['id'], $reason)->assertOk();
        }
        $stored = SelfAssessmentAnswer::where('self_assessment_id', $issued['id'])->where('characteristic_id', $first['id'])->sole();
        $this->assertSame(LevelStatement::find($first['statements'][1]['id'])->level, $stored->level);
        $this->assertSame(18 + 1, AuditLog::where('action', 'selfAssessment.answer_save')->count());

        $this->postJson("/sa/{$issued['raw']}/submit")->assertOk()->assertJson(['ok' => true]);
        $sa = SelfAssessment::findOrFail($issued['id']);
        $this->assertSame('SUBMITTED', $sa->status);
        $this->assertNotNull($sa->submitted_at);
        $this->assertNotNull(AccessToken::findOrFail($sa->access_token_id)->completed_at);
        $this->assertTrue(AuditLog::where('action', 'selfAssessment.submit')->exists());

        $this->answer($issued['raw'], $first['id'], null, $reason)->assertStatus(409)->assertJson(['error' => 'SELF_ASSESSMENT_SUBMITTED']);
        $this->assertSame('SUBMITTED', $this->formData($this->get("/sa/{$issued['raw']}"))['status']);
        $this->actingAs($this->admin)->post(route('self-assessments.reissue', [$this->assessment, $issued['id']]))->assertStatus(409);
    }

    public function test_invalid_closed_and_unknown_inputs_are_rejected(): void
    {
        $issued = $this->issue();
        $data = $this->formData($this->get("/sa/{$issued['raw']}"));
        $c = $data['characteristics'][0];
        $other = $data['characteristics'][1]['statements'][0]['id'];

        $this->answer($issued['raw'], $c['id'], $other, 'x')->assertStatus(422)->assertJson(['error' => 'UNKNOWN_ITEM']);
        $this->putJson("/sa/{$issued['raw']}/answer", ['characteristicId' => $c['id'], 'statementId' => null, 'justification' => '', 'evidenceIds' => ['abc']])
            ->assertStatus(422)->assertJson(['error' => 'UNKNOWN_EVIDENCE']);
        $this->putJson("/sa/{$issued['raw']}/answer", ['characteristicId' => $c['id']])->assertStatus(400);
        $this->putJson("/sa/{$issued['raw']}/profile", ['name' => 'A', 'position' => ''])->assertStatus(400);
        $this->answer(str_repeat('b', 43), $c['id'], null, 'x')->assertNotFound()->assertJson(['error' => 'INVALID_TOKEN']);
        $this->get('/sa/'.str_repeat('b', 43))->assertNotFound()->assertSee('tidak dikenali');

        $this->assessment->forceFill(['status' => AssessmentStatus::Validation])->save();
        $this->get("/sa/{$issued['raw']}")->assertOk()->assertSee('sudah berakhir');
        $this->answer($issued['raw'], $c['id'], null, 'x')->assertStatus(409)->assertJson(['error' => 'DISTRIBUTION_CLOSED']);
    }

    public function test_reissue_replaces_the_link_and_keeps_the_draft(): void
    {
        $issued = $this->issue();
        $c = $this->formData($this->get("/sa/{$issued['raw']}"))['characteristics'][0];
        $this->answer($issued['raw'], $c['id'], $c['statements'][0]['id'], 'Draf alasan yang belum selesai ditulis.')->assertOk();

        $this->actingAs($this->admin)->post(route('self-assessments.revoke', [$this->assessment, $issued['id']]))->assertSessionHas('status', 'saved');
        auth()->logout();
        $this->get("/sa/{$issued['raw']}")->assertNotFound();
        $link = $this->actingAs($this->admin)->post(route('self-assessments.reissue', [$this->assessment, $issued['id']]))->getSession()->get('selfAssessmentLink')['link'];
        auth()->logout();

        $data = $this->formData($this->get(parse_url($link, PHP_URL_PATH)));
        $this->assertSame('Draf alasan yang belum selesai ditulis.', $data['characteristics'][0]['answer']['justification']);
        $this->assertSame($c['statements'][0]['id'] !== null, $data['characteristics'][0]['answer']['statementId'] !== null);
    }

    public function test_console_pages_follow_the_access_matrix(): void
    {
        $issued = $this->issue();
        $c = $this->formData($this->get("/sa/{$issued['raw']}"))['characteristics'][0];
        $this->answer($issued['raw'], $c['id'], $c['statements'][0]['id'], 'Alasan yang dapat dibaca asesor di konsol.')->assertOk();

        $assessor = $this->assessment->team()->where('role', Role::Assessor)->first()->user;
        foreach ([$this->lead, $assessor, $this->admin] as $user) {
            $this->actingAs($user)->get(route('self-assessments.index', $this->assessment))->assertOk()
                ->assertInertia(fn (Assert $page) => $page->component('respondents/self-assessments')->has('rows', 1)->where('rows.0.status', 'DRAFT')->where('rows.0.answered', 1));
        }
        $this->actingAs($this->lead)->get(route('self-assessments.show', [$this->assessment, $issued['id']]))->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('detail.rows.0.justification', 'Alasan yang dapat dibaca asesor di konsol.'));
        $this->actingAs($this->lead)->get(route('self-assessments.index', $this->assessment))->assertInertia(fn (Assert $page) => $page->where('canEdit', false));
        $this->actingAs($this->lead)->post(route('self-assessments.store', $this->assessment), ['name' => 'X Y', 'position' => 'Z Z', 'unit_id' => 'a'])->assertForbidden();

        $this->actingAs(User::factory()->create(['is_super_admin' => true]))->get(route('self-assessments.index', $this->assessment))->assertForbidden();
        $this->actingAs($this->member($this->client, Role::UnitCoordinator))->get(route('self-assessments.index', $this->assessment))->assertForbidden();
        $this->actingAs($this->member($this->client, Role::ExecutiveViewer))->get(route('self-assessments.index', $this->assessment))->assertForbidden();
        $this->actingAs($this->member(Organization::factory()->create(), Role::ClientAdmin))->get(route('self-assessments.index', $this->assessment))->assertNotFound();

        $this->actingAs($this->lead)->get(route('home'))->assertInertia(fn (Assert $page) => $page
            ->where('dashboard.rows.0.participation.selfAssessments', ['issued' => 1, 'submitted' => 0]));
    }
}
