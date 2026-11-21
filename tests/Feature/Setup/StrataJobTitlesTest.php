<?php

namespace Tests\Feature\Setup;

use App\Domain\Access\Role;
use App\Domain\Workflow\AssessmentStatus;
use App\Models\Assessment;
use App\Models\AuditLog;
use App\Models\Organization;
use App\Models\RosterEntry;
use App\Models\User;
use App\Services\AssessmentSetup;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\BuildsAssessments;
use Tests\TestCase;

/**
 * Nama jabatan organisasi per strata: diisi di halaman Strata, disimpan sebagai templat organisasi untuk asesmen
 * berikutnya, dan dipakai impor daftar responden untuk menentukan strata. Tidak disimpan pada jawaban survei.
 */
class StrataJobTitlesTest extends TestCase
{
    use BuildsAssessments, RefreshDatabase;

    private User $lead;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpAssessmentWorld();
        $this->lead = $this->member($this->operator, Role::LeadAssessor);
    }

    /** @param  array<string, mixed>  $changes */
    private function updateStratum(Assessment $assessment, string $code, array $changes)
    {
        $stratum = $assessment->strata()->where('code', $code)->firstOrFail();

        return $this->actingAs($this->lead)->put(route('setup.strata.update', [$assessment, $stratum]), [
            'code' => $stratum->code, 'name' => $stratum->name, 'group' => $stratum->group->value,
            'population' => $stratum->population, 'is_contractor' => $stratum->is_contractor, ...$changes,
        ]);
    }

    public function test_job_titles_are_saved_per_stratum_and_each_title_belongs_to_one_stratum(): void
    {
        $assessment = $this->createAssessment($this->lead);

        $this->updateStratum($assessment, 'S2', ['job_titles' => "Site Manager\nKepala Seksi, site manager"])->assertSessionHasNoErrors();
        $this->assertSame(['Site Manager', 'Kepala Seksi'], $assessment->strata()->where('code', 'S2')->firstOrFail()->job_titles);
        $log = AuditLog::where('action', 'stratum.update')->latest('id')->firstOrFail();
        $this->assertSame(['Site Manager', 'Kepala Seksi'], $log->changes['after']['job_titles']);
        $this->assertSame([], $log->changes['before']['job_titles']);

        $this->updateStratum($assessment, 'S3', ['job_titles' => 'SITE MANAGER'])->assertSessionHasErrors('job_titles');
        $this->updateStratum($assessment, 'S3', ['job_titles' => 'X'])->assertSessionHasErrors('job_titles');
        $this->assertSame([], $assessment->strata()->where('code', 'S3')->first()->job_titles);

        $this->actingAs($this->lead)->get(route('setup.strata', $assessment))->assertInertia(fn (Assert $page) => $page
            ->where('strata.1.jobTitles', ['Site Manager', 'Kepala Seksi'])
            ->where('templateCount', 0)
            ->where('canSaveTemplate', true));
    }

    public function test_the_strata_layout_becomes_the_organisation_template_for_the_next_assessment(): void
    {
        $first = $this->createAssessment($this->lead);
        $this->updateStratum($first, 'S4', ['name' => 'Pelaksana lapangan', 'job_titles' => 'Mandor, Juru Ukur', 'population' => 900])->assertSessionHasNoErrors();

        $this->actingAs($this->lead)->post(route('setup.strata.template', $first))->assertSessionHasNoErrors()->assertSessionHas('status', 'templateSaved');
        $template = Organization::findOrFail($first->organization_id)->strata_template;
        $this->assertCount(5, $template);
        $this->assertEquals(['code' => 'S4', 'name' => 'Pelaksana lapangan', 'group' => 'FIELD', 'isContractor' => false, 'jobTitles' => ['Mandor', 'Juru Ukur']], $template[3]);
        $this->assertArrayNotHasKey('population', $template[3]);
        $this->assertTrue(AuditLog::where('action', 'organization.strata_template')->where('assessment_id', $first->id)->exists());

        $next = $this->createAssessment($this->lead, ['name' => 'Asesmen periode berikutnya']);
        $s4 = $next->strata()->where('code', 'S4')->firstOrFail();
        $this->assertSame(['Pelaksana lapangan', ['Mandor', 'Juru Ukur'], 0], [$s4->name, $s4->job_titles, $s4->population]);
        $this->assertTrue(AuditLog::where('action', 'assessment.create')->where('assessment_id', $next->id)->firstOrFail()->changes['strataFromTemplate']);

        // Peran lain tidak dapat menyimpan templat.
        $admin = $this->member($this->client, Role::ClientAdmin);
        $this->actingAs($admin)->post(route('setup.strata.template', $first))->assertForbidden();
    }

    public function test_the_roster_import_finds_the_stratum_from_the_job_title(): void
    {
        $draft = $this->createAssessment($this->lead);
        $this->updateStratum($draft, 'S3', ['job_titles' => 'Site Engineer'])->assertSessionHasNoErrors();
        $this->updateStratum($draft, 'S5', ['job_titles' => 'Tukang Besi'])->assertSessionHasNoErrors();
        $assessment = $this->completePlanning($draft, $this->lead, $this->member($this->operator, Role::Assessor));
        Auth::login($this->lead);
        app(AssessmentSetup::class)->transition($assessment, AssessmentStatus::Configured, [Role::LeadAssessor]);
        app(AssessmentSetup::class)->transition($assessment, AssessmentStatus::Locked, [Role::LeadAssessor]);
        Auth::logout();
        $assessment = $assessment->fresh();
        // Nama jabatan ikut tercatat pada snapshot parameter terkunci.
        $this->assertSame(['Site Engineer'], collect($assessment->parameter_snapshot['strata'])->firstWhere('code', 'S3')['jobTitles']);
        $admin = $this->member($this->client, Role::ClientAdmin);
        $unit = $assessment->units()->orderBy('name')->firstOrFail()->name;
        $csv = UploadedFile::fake()->createWithContent('daftar.csv', "Nama;Unit;Jabatan;Strata\nAni;{$unit};Site Engineer;\nBudi;{$unit};Tukang Besi;\n");

        $this->actingAs($admin)->post(route('respondents.import', $assessment), ['file' => $csv, 'commit' => '1'])
            ->assertSessionHas('rosterPreview', fn ($p) => $p['ok'] && $p['imported'] === 2);
        $this->assertSame('S3', RosterEntry::where('full_name', 'Ani')->firstOrFail()->stratum->code);
        $budi = RosterEntry::where('full_name', 'Budi')->firstOrFail();
        $this->assertSame('S5', $budi->stratum->code);
        $this->assertTrue($budi->is_contractor);
        $this->assertStringNotContainsStringIgnoringCase('jabatan', implode(',', array_keys($budi->getAttributes())));
    }
}
