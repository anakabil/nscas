<?php

namespace Tests\Feature\Respondents;

use App\Domain\Access\Role;
use App\Domain\Workflow\AssessmentStatus;
use App\Mail\SurveyMail;
use App\Models\AccessToken;
use App\Models\Assessment;
use App\Models\Organization;
use App\Models\ParticipationSnapshot;
use App\Models\RosterEntry;
use App\Models\Unit;
use App\Models\UnitQrCode;
use App\Models\User;
use App\Services\AssessmentSetup;
use App\Services\Respondents\SurveyLinks;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Mail;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\BuildsAssessments;
use Tests\TestCase;

/**
 * Fase R2: kode QR unit, halaman publik tanpa sesi, cakupan koordinator unit, matriks hak akses, ambang sel
 * partisipasi, pengingat, dan cuplikan harian.
 */
class RespondentAccessAndParticipationTest extends TestCase
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

    /** Membuka pengumpulan data dengan jendela survei yang sedang berjalan. */
    private function openSurvey(): void
    {
        $this->assessment->forceFill([
            'status' => AssessmentStatus::DataCollection,
            'survey_opens_at' => now()->subDay(),
            'survey_closes_at' => now()->addDays(10),
        ])->save();
    }

    private function unit(string $name): Unit
    {
        return Unit::where('assessment_id', $this->assessment->id)->where('name', $name)->firstOrFail();
    }

    private function createQr(?int $max = null): string
    {
        $response = $this->actingAs($this->admin)->post(route('qr.store', $this->assessment), [
            'unit_id' => $this->unit('Proyek Gedung A')->id,
            'max_issuance' => $max,
        ]);
        $created = $response->getSession()->get('qrCreated');
        $this->assertStringStartsWith('<?xml', $created['svg']);

        return (string) parse_url($created['link'], PHP_URL_PATH);
    }

    public function test_qr_scan_issues_a_token_reuses_it_on_the_same_device_and_respects_the_limit(): void
    {
        $qr = $this->createQr(2);
        $this->get($qr)->assertOk()->assertSee('Survei sedang tidak dibuka');

        $this->openSurvey();
        $first = $this->get($qr)->assertRedirect();
        $cookie = collect($first->headers->getCookies())->first(fn ($c) => str_starts_with($c->getName(), 'nscas_qr_'));
        $this->assertNotNull($cookie);
        $this->assertTrue($cookie->isHttpOnly());
        $this->get($first->headers->get('Location'))->assertOk()->assertSee('Tautan survei Anda berlaku');

        // Perangkat yang sama memakai ulang tokennya, sehingga kuota tidak berkurang. Nilai kuki dikirim kembali apa
        // adanya (terenkripsi), seperti peramban.
        $again = $this->call('GET', $qr, [], [$cookie->getName() => $cookie->getValue()]);
        $this->assertSame($first->headers->get('Location'), $again->headers->get('Location'));
        $this->assertSame(1, AccessToken::where('channel', 'QR')->count());
        $token = AccessToken::where('channel', 'QR')->firstOrFail();
        $this->assertNull($token->roster_entry_id);
        $this->assertNull($token->stratum_id);

        // Perangkat lain menerbitkan token kedua; pemindaian ketiga melampaui batas.
        $this->get($qr)->assertRedirect();
        $this->get($qr)->assertOk()->assertSee('Kuota pengisian');
        $this->assertSame(2, AccessToken::where('channel', 'QR')->count());
    }

    public function test_new_qr_code_replaces_the_old_one_and_deactivated_codes_stop_working(): void
    {
        $this->openSurvey();
        $old = $this->createQr();
        $new = $this->createQr();

        $this->get($old)->assertOk()->assertSee('tidak berlaku');
        $this->get($new)->assertRedirect();

        $code = UnitQrCode::where('is_active', true)->firstOrFail();
        $this->actingAs($this->admin)->delete(route('qr.destroy', [$this->assessment, $code->id]))->assertSessionHas('status', 'saved');
        $this->get($new)->assertOk()->assertSee('tidak berlaku');
    }

    public function test_public_respondent_pages_start_no_session_and_set_no_session_cookie(): void
    {
        $this->openSurvey();
        $issued = SurveyLinks::issue($this->assessment, ['unit_id' => $this->unit('Kantor Pusat')->id, 'stratum_id' => null, 'channel' => 'LINK']);

        $response = $this->get('/s/'.$issued['raw'])->assertOk()->assertHeader('Referrer-Policy', 'no-referrer')->assertHeader('Cache-Control');
        $names = collect($response->headers->getCookies())->map->getName()->all();
        $this->assertNotContains(config('session.cookie'), $names);
        $this->assertNotContains('XSRF-TOKEN', $names);
        $this->assertStringNotContainsString('/build/', $response->getContent());
        $this->assertLessThan(350 * 1024, strlen($response->getContent()));

        $this->get('/s/bukan-token')->assertNotFound();
    }

    public function test_unit_coordinator_sees_and_imports_only_assigned_units(): void
    {
        $coordinator = $this->member($this->client, Role::UnitCoordinator);
        $hq = $this->unit('Kantor Pusat');
        $child = app(AssessmentSetup::class)->createUnit($this->assessment, ['name' => 'Divisi Gedung', 'type' => 'DIVISION', 'parent_id' => $hq->id]);
        $this->actingAs($this->admin)->post(route('respondents.coordinators.store', $this->assessment), ['user_id' => $coordinator->id, 'unit_id' => $hq->id])
            ->assertSessionHas('status', 'saved');

        $code = $this->assessment->strata()->value('code');
        $file = fn (array $rows) => UploadedFile::fake()->createWithContent('d.csv', "Nama;Unit;Strata\n".implode("\n", array_map(fn ($r) => implode(';', $r), $rows))."\n");
        $this->actingAs($this->admin)->post(route('respondents.import', $this->assessment), ['file' => $file([['A', 'Kantor Pusat', $code], ['B', 'Divisi Gedung', $code], ['C', 'Proyek Gedung A', $code]]), 'commit' => '1']);

        $this->actingAs($coordinator)->get(route('respondents.index', $this->assessment))->assertInertia(fn (Assert $page) => $page
            ->where('scoped', true)
            ->where('summary.registered', 2)
            ->has('units', 2)
            ->where('can.import', true)
            ->where('can.distribute', false)
            ->where('coordinators', null));
        $this->actingAs($coordinator)->post(route('respondents.import', $this->assessment), ['file' => $file([['D', 'Proyek Gedung A', $code]]), 'commit' => '0'])
            ->assertSessionHas('rosterPreview', fn ($p) => $p['summary']['errors'][0]['code'] === 'UNIT_OUT_OF_SCOPE');
        $this->actingAs($coordinator)->post(route('respondents.links', $this->assessment), ['only_without_email' => '0'])->assertForbidden();
        $this->actingAs($coordinator)->get(route('participation.index', $this->assessment))->assertInertia(fn (Assert $page) => $page
            ->where('scoped', true)->has('summary.units', 2)->where('summary.totals.registered', 2)->where('trend', []));
        $this->assertSame(1, RosterEntry::where('unit_id', $child->id)->count());

        // Pengguna yang bukan koordinator unit tidak dapat ditugaskan.
        $this->actingAs($this->admin)->post(route('respondents.coordinators.store', $this->assessment), ['user_id' => $this->lead->id, 'unit_id' => $hq->id])
            ->assertSessionHasErrors('userId');
    }

    public function test_role_matrix_for_respondent_pages(): void
    {
        $superAdmin = User::factory()->create(['is_super_admin' => true]);
        $viewer = $this->member($this->client, Role::ExecutiveViewer);

        // Pengelola sistem tidak dapat melihat daftar responden (docs/04), tetapi melihat partisipasi gabungan.
        $this->actingAs($superAdmin)->get(route('respondents.index', $this->assessment))->assertForbidden();
        $this->actingAs($superAdmin)->get(route('participation.index', $this->assessment))->assertOk();
        $this->actingAs($viewer)->get(route('respondents.index', $this->assessment))->assertForbidden();
        $this->actingAs($viewer)->get(route('qr.index', $this->assessment))->assertForbidden();
        $this->actingAs($viewer)->get(route('participation.index', $this->assessment))->assertOk();
        // Asesor utama melihat daftar responden tanpa hak ubah.
        $this->actingAs($this->lead)->get(route('respondents.index', $this->assessment))->assertInertia(fn (Assert $page) => $page
            ->where('can.import', false)->where('can.distribute', false)->where('can.window', true));
        $this->actingAs($this->lead)->post(route('respondents.links', $this->assessment), ['only_without_email' => '0'])->assertForbidden();
        $this->actingAs($this->lead)->post(route('qr.store', $this->assessment), ['unit_id' => $this->unit('Kantor Pusat')->id])->assertForbidden();

        // Pengguna organisasi lain menerima 404.
        $outsider = $this->member(Organization::factory()->create(), Role::ClientAdmin);
        $this->actingAs($outsider)->get(route('respondents.index', $this->assessment))->assertNotFound();
        $this->actingAs($outsider)->get(route('participation.index', $this->assessment))->assertNotFound();
    }

    public function test_participation_hides_completed_counts_below_the_cell_threshold(): void
    {
        $unit = $this->unit('Kantor Pusat');
        $strata = $this->assessment->strata()->orderBy('code')->get();
        foreach ([[$strata[0], 3], [$strata[1], 6]] as [$stratum, $done]) {
            for ($i = 0; $i < 8; $i++) {
                $token = SurveyLinks::issue($this->assessment, ['unit_id' => $unit->id, 'stratum_id' => $stratum->id, 'channel' => 'LINK'])['token'];
                if ($i < $done) {
                    $token->forceFill(['completed_at' => now()->startOfHour()])->save();
                }
            }
        }

        $this->actingAs($this->admin)->get(route('participation.index', $this->assessment))->assertInertia(fn (Assert $page) => $page
            ->component('respondents/participation')
            ->where('minCell', 5)
            ->where('summary.strata.0.completed', ['value' => null, 'suppressed' => true])
            ->where('summary.strata.0.rate', null)
            ->where('summary.strata.0.belowMinimum', true)
            ->where('summary.strata.1.completed', ['value' => 6, 'suppressed' => false])
            ->where('summary.totals.completed', ['value' => 9, 'suppressed' => false]));

        // Dasbor beranda memakai ambang yang sama.
        $this->actingAs($this->lead)->get(route('home'))->assertInertia(fn (Assert $page) => $page
            ->where('dashboard.rows.0.participation.completed', ['value' => 9, 'suppressed' => false])
            ->where('dashboard.rows.0.participation.tokens', 16)
            // Populasi strata uji 100 sampai 500, sehingga kelima strata masih di bawah 30 persen.
            ->where('dashboard.rows.0.participation.strataBelowMinimum', 5));
    }

    public function test_reminders_rotate_unopened_tokens_and_ask_opened_ones_to_continue(): void
    {
        Mail::fake();
        $this->openSurvey();
        $unit = $this->unit('Kantor Pusat');
        $stratum = $this->assessment->strata()->value('id');
        $entries = collect(['a', 'b', 'c'])->map(fn ($n) => RosterEntry::create([
            'assessment_id' => $this->assessment->id, 'unit_id' => $unit->id, 'stratum_id' => $stratum,
            'full_name' => "Pekerja {$n}", 'email' => "{$n}@contoh.test", 'email_hash' => RosterEntry::emailHash("{$n}@contoh.test"),
        ]));
        $issue = fn (RosterEntry $e, int $daysAgo) => tap(SurveyLinks::issue($this->assessment, ['unit_id' => $unit->id, 'stratum_id' => $stratum, 'roster_entry_id' => $e->id, 'channel' => 'EMAIL'])['token'])
            ->forceFill(['issued_at' => now()->subDays($daysAgo)])->save();
        $issue($entries[0], 4);
        $issue($entries[1], 4);
        $issue($entries[2], 1);
        AccessToken::where('roster_entry_id', $entries[1]->id)->update(['first_opened_at' => now()->subDays(2)->startOfHour()]);

        $this->artisan('nscas:survey-reminders')->assertSuccessful();

        Mail::assertSent(SurveyMail::class, fn (SurveyMail $m) => $m->hasTo('a@contoh.test') && $m->kind === 'reminder' && $m->link !== null);
        Mail::assertSent(SurveyMail::class, fn (SurveyMail $m) => $m->hasTo('b@contoh.test') && $m->kind === 'continue' && $m->link === null);
        Mail::assertNotSent(SurveyMail::class, fn (SurveyMail $m) => $m->hasTo('c@contoh.test'));

        $a = AccessToken::where('roster_entry_id', $entries[0]->id)->orderBy('issued_at')->get();
        $this->assertSame(['ROTATED_REMINDER', null], $a->pluck('revoked_reason')->all());
        $this->assertSame(1, $a->last()->reminder_count);
        $b = AccessToken::where('roster_entry_id', $entries[1]->id)->sole();
        $this->assertSame(1, $b->reminder_count);
        $this->assertNull($b->revoked_at);

        // Jarak tiga hari: menjalankan lagi hari ini tidak mengirim apa pun.
        Mail::fake();
        $this->artisan('nscas:survey-reminders')->assertSuccessful();
        Mail::assertNothingSent();
    }

    public function test_daily_snapshot_keeps_raw_counts_and_the_trend_masks_them(): void
    {
        $this->openSurvey();
        $unit = $this->unit('Kantor Pusat');
        $stratum = $this->assessment->strata()->value('id');
        for ($i = 0; $i < 3; $i++) {
            SurveyLinks::issue($this->assessment, ['unit_id' => $unit->id, 'stratum_id' => $stratum, 'channel' => 'LINK'])['token']
                ->forceFill(['completed_at' => now()->startOfHour()])->save();
        }

        $this->artisan('nscas:participation-snapshot')->assertSuccessful();
        $this->artisan('nscas:participation-snapshot')->assertSuccessful();

        $snapshot = ParticipationSnapshot::sole();
        $this->assertSame(3, $snapshot->data['completed']);
        $this->actingAs($this->admin)->get(route('participation.index', $this->assessment))->assertInertia(fn (Assert $page) => $page
            ->has('trend', 1)->where('trend.0.completed', ['value' => null, 'suppressed' => true]));
    }

    public function test_transition_hub_links_the_new_conditions_to_the_respondents_page(): void
    {
        Auth::login($this->lead);
        $this->actingAs($this->lead)->get(route('assessments.show', $this->assessment))->assertInertia(fn (Assert $page) => $page
            ->where('progress.next.conditions.0.key', 'roster_imported')
            ->where('progress.next.conditions.0.met', false)
            ->where('progress.next.conditions.0.href', route('assessments.module', [$this->assessment, 'respondents'])));
    }
}
