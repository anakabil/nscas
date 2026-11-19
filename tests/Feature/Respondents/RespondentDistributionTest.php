<?php

namespace Tests\Feature\Respondents;

use App\Domain\Access\Role;
use App\Domain\Respondents\TokenCodec;
use App\Domain\Workflow\AssessmentStatus;
use App\Jobs\SendSurveyInvitation;
use App\Mail\SurveyMail;
use App\Models\AccessToken;
use App\Models\Assessment;
use App\Models\AuditLog;
use App\Models\RosterEntry;
use App\Models\User;
use App\Services\AssessmentSetup;
use App\Services\Respondents\RosterReader;
use App\Support\RuleViolation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Inertia\Testing\AssertableInertia as Assert;
use RuntimeException;
use Tests\Concerns\BuildsAssessments;
use Tests\TestCase;

/**
 * Fase R2 (docs/01 M2): impor daftar responden, tautan sekali tampil, undangan surel lewat antrean, pencabutan,
 * penerbitan ulang, masa survei, dan syarat dimulainya pengumpulan data.
 */
class RespondentDistributionTest extends TestCase
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

    private function csv(array $rows): UploadedFile
    {
        $lines = array_map(fn (array $r) => implode(';', $r), [['Nama', 'Nomor induk', 'Surel', 'Telepon', 'Unit', 'Strata', 'Penyedia jasa'], ...$rows]);

        return UploadedFile::fake()->createWithContent('daftar.csv', "\u{FEFF}".implode("\n", $lines)."\n");
    }

    private function import(User $user, UploadedFile $file, bool $commit)
    {
        return $this->actingAs($user)->post(route('respondents.import', $this->assessment), ['file' => $file, 'commit' => $commit ? '1' : '0']);
    }

    private function stratumCode(int $index = 0): string
    {
        return $this->assessment->strata()->orderBy('code')->pluck('code')[$index];
    }

    public function test_import_previews_first_and_saves_only_on_commit_with_encrypted_contacts(): void
    {
        $file = $this->csv([
            ['Siti Aminah', 'A-1', 'siti@contoh.test', '081234567890', 'Kantor Pusat', $this->stratumCode(), ''],
            ['Budi Santoso', 'A-2', '', '', 'Proyek Gedung A', $this->stratumCode(1), 'Ya'],
        ]);

        $this->import($this->admin, $file, false)->assertRedirect()
            ->assertSessionHas('rosterPreview', fn ($p) => $p['ok'] && $p['summary']['validRows'] === 2 && $p['imported'] === 0);
        $this->assertSame(0, RosterEntry::count());

        $this->import($this->admin, $file, true)->assertSessionHas('rosterPreview', fn ($p) => $p['ok'] && $p['imported'] === 2);
        $siti = RosterEntry::where('full_name', 'Siti Aminah')->firstOrFail();
        $this->assertSame('siti@contoh.test', $siti->email);
        $this->assertSame('+6281234567890', $siti->phone);
        $raw = DB::table('roster_entries')->where('id', $siti->id)->first();
        $this->assertStringNotContainsString('siti@contoh.test', (string) $raw->email);
        $this->assertSame(RosterEntry::emailHash('siti@contoh.test'), $raw->email_hash);
        $this->assertTrue(RosterEntry::where('full_name', 'Budi Santoso')->value('is_contractor'));

        $audit = AuditLog::where('action', 'roster.import')->firstOrFail();
        $this->assertSame(2, $audit->changes['after']['imported']);
        $this->assertStringNotContainsString('siti@contoh.test', json_encode($audit->changes));

        // Surel yang sama tidak dapat didaftarkan dua kali.
        $this->import($this->admin, $this->csv([['Siti Lagi', '', 'SITI@contoh.test', '', 'Kantor Pusat', $this->stratumCode(), '']]), false)
            ->assertSessionHas('rosterPreview', fn ($p) => ! $p['ok'] && $p['summary']['errors'][0]['code'] === 'ALREADY_REGISTERED');
    }

    public function test_invalid_rows_block_the_whole_import(): void
    {
        $this->import($this->admin, $this->csv([
            ['Sah', '', '', '', 'Kantor Pusat', $this->stratumCode(), ''],
            ['', '', 'bukan-surel', '', 'Gudang', 'X', ''],
        ]), true)->assertSessionHas('rosterPreview', fn ($p) => ! $p['ok'] && $p['error'] === 'INVALID_ROWS' && $p['summary']['errorCount'] === 4);

        $this->assertSame(0, RosterEntry::count());
    }

    public function test_three_thousand_rows_import_within_thirty_seconds(): void
    {
        $codes = $this->assessment->strata()->pluck('code')->all();
        $rows = [];
        for ($i = 1; $i <= 3000; $i++) {
            $rows[] = ["Pekerja {$i}", "NIP-{$i}", "pekerja{$i}@contoh.test", '', $i % 2 ? 'Kantor Pusat' : 'Proyek Gedung A', $codes[$i % count($codes)], ''];
        }
        $started = microtime(true);
        $this->import($this->admin, $this->csv($rows), true)->assertSessionHas('rosterPreview', fn ($p) => $p['imported'] === 3000);

        $this->assertLessThan(30, microtime(true) - $started);
        $this->assertSame(3000, RosterEntry::count());
    }

    public function test_template_download_can_be_read_back_by_the_importer(): void
    {
        $response = $this->actingAs($this->admin)->get(route('respondents.template', $this->assessment))->assertOk();
        $path = $response->getFile()->getPathname();

        $this->assertSame(['Nama', 'Nomor induk', 'Surel', 'Telepon', 'Unit', 'Strata', 'Penyedia jasa'], RosterReader::read($path)['rows'][0]);
    }

    public function test_links_are_shown_once_and_only_their_hashes_are_stored(): void
    {
        $this->import($this->admin, $this->csv([
            ['A', '', '', '', 'Kantor Pusat', $this->stratumCode(), ''],
            ['B', '', 'b@contoh.test', '', 'Kantor Pusat', $this->stratumCode(), ''],
        ]), true);

        $response = $this->actingAs($this->admin)->post(route('respondents.links', $this->assessment), ['only_without_email' => '1']);
        $links = $response->getSession()->get('issuedLinks');
        $this->assertCount(1, $links);
        $raw = substr($links[0]['link'], strrpos($links[0]['link'], '/') + 1);
        $this->assertTrue(TokenCodec::looksValid($raw));
        $token = AccessToken::firstOrFail();
        $this->assertSame(TokenCodec::hash($raw), $token->token_hash);
        $this->assertSame('LINK', $token->channel);
        $this->assertSame(0, DB::table('access_tokens')->where('token_hash', $raw)->count());
        $this->assertStringNotContainsString($raw, json_encode(AuditLog::pluck('changes')));

        // Responden yang sudah memiliki token tidak diberi tautan lagi.
        $this->actingAs($this->admin)->post(route('respondents.links', $this->assessment), ['only_without_email' => '1'])
            ->assertSessionHas('respondentNotice', ['key' => 'linksNone']);
    }

    public function test_invitations_are_queued_and_create_the_token_when_the_email_is_sent(): void
    {
        Mail::fake();
        $this->import($this->admin, $this->csv([
            ['Siti', '', 'siti@contoh.test', '', 'Kantor Pusat', $this->stratumCode(), ''],
            ['Tanpa Surel', '', '', '', 'Kantor Pusat', $this->stratumCode(), ''],
        ]), true);

        $this->actingAs($this->admin)->post(route('respondents.invitations', $this->assessment), [])
            ->assertSessionHas('respondentNotice', ['key' => 'invitationsQueued', 'count' => 1]);

        Mail::assertSent(SurveyMail::class, fn (SurveyMail $mail) => $mail->hasTo('siti@contoh.test') && $mail->kind === 'invitation' && str_contains((string) $mail->link, '/s/'));
        $this->assertSame(['EMAIL'], AccessToken::pluck('channel')->all());
        $this->assertTrue(AuditLog::where('action', 'invitation.sent')->exists());

        // Pengiriman ulang tanpa token baru: responden sudah memiliki token terpakai.
        $this->actingAs($this->admin)->post(route('respondents.invitations', $this->assessment), [])
            ->assertSessionHas('respondentNotice', ['key' => 'invitationsNone']);
    }

    public function test_a_failed_send_revokes_the_token_it_created(): void
    {
        $this->import($this->admin, $this->csv([['Siti', '', 'siti@contoh.test', '', 'Kantor Pusat', $this->stratumCode(), '']]), true);
        Mail::shouldReceive('to')->andThrow(new RuntimeException('SMTP tidak tersedia'));

        try {
            (new SendSurveyInvitation($this->assessment->id, RosterEntry::value('id')))->handle();
            $this->fail('Pengiriman seharusnya gagal.');
        } catch (RuntimeException) {
        }

        $token = AccessToken::firstOrFail();
        $this->assertSame('SEND_FAILED', $token->revoked_reason);
        $this->assertNotNull($token->revoked_at);
    }

    public function test_revoked_links_no_longer_open_and_reissue_replaces_them(): void
    {
        $this->import($this->admin, $this->csv([['A', '', '', '', 'Kantor Pusat', $this->stratumCode(), '']]), true);
        $first = $this->actingAs($this->admin)->post(route('respondents.links', $this->assessment), ['only_without_email' => '0'])->getSession()->get('issuedLinks')[0]['link'];
        $path = parse_url($first, PHP_URL_PATH);
        $this->get($path)->assertOk()->assertSee('Survei sedang tidak dibuka');

        $entry = RosterEntry::firstOrFail();
        $this->actingAs($this->admin)->post(route('respondents.revoke', [$this->assessment, $entry->id]))->assertSessionHas('respondentNotice', ['key' => 'revoked']);
        $this->get($path)->assertNotFound()->assertSee('tidak berlaku');
        $this->actingAs($this->admin)->post(route('respondents.revoke', [$this->assessment, $entry->id]))->assertSessionHasErrors('form');

        $second = $this->actingAs($this->admin)->post(route('respondents.reissue', [$this->assessment, $entry->id]), ['channel' => 'LINK'])->getSession()->get('issuedLinks')[0]['link'];
        $this->assertNotSame($first, $second);
        $this->get(parse_url($second, PHP_URL_PATH))->assertOk();

        // Responden yang sudah selesai tidak dapat diterbitkan ulang.
        AccessToken::whereNull('revoked_at')->update(['completed_at' => now()->startOfHour()]);
        $this->actingAs($this->admin)->post(route('respondents.reissue', [$this->assessment, $entry->id]), ['channel' => 'LINK'])->assertSessionHasErrors('form');
        $this->get(parse_url($second, PHP_URL_PATH))->assertOk()->assertSee('sudah diterima');
    }

    public function test_survey_window_is_entered_in_wib_and_must_close_after_it_opens(): void
    {
        $this->actingAs($this->admin)->put(route('respondents.window', $this->assessment), ['opens_at' => '2026-12-01T08:00', 'closes_at' => '2026-12-20T17:00'])
            ->assertSessionHas('status', 'saved');
        $this->assertSame('2026-12-01T01:00:00+00:00', $this->assessment->fresh()->survey_opens_at->utc()->toIso8601String());

        $this->actingAs($this->admin)->put(route('respondents.window', $this->assessment), ['opens_at' => '2026-12-20T08:00', 'closes_at' => '2026-12-01T08:00'])
            ->assertSessionHasErrors('closesAt');
    }

    public function test_data_collection_starts_only_with_a_roster_and_issued_tokens(): void
    {
        $setup = app(AssessmentSetup::class);
        Auth::login($this->lead);
        try {
            $setup->transition($this->assessment, AssessmentStatus::DataCollection, [Role::LeadAssessor]);
            $this->fail('Transisi seharusnya ditolak.');
        } catch (RuleViolation $e) {
            $this->assertSame('TRANSITION_BLOCKED', $e->key);
        }

        $this->import($this->admin, $this->csv([['A', '', '', '', 'Kantor Pusat', $this->stratumCode(), '']]), true);
        $this->actingAs($this->admin)->post(route('respondents.links', $this->assessment), ['only_without_email' => '0']);
        Auth::login($this->lead);
        $setup->transition($this->assessment, AssessmentStatus::DataCollection, [Role::LeadAssessor]);

        $this->assertSame(AssessmentStatus::DataCollection, $this->assessment->fresh()->status);
    }

    public function test_distribution_is_closed_before_locking_and_after_data_collection(): void
    {
        $draft = $this->createAssessment($this->lead);
        $this->actingAs($this->admin)->post(route('respondents.import', $draft), ['file' => $this->csv([]), 'commit' => '0'])->assertStatus(409);

        $this->assessment->forceFill(['status' => AssessmentStatus::Validation])->save();
        $this->actingAs($this->admin)->post(route('respondents.links', $this->assessment), ['only_without_email' => '0'])->assertStatus(409);
        $this->actingAs($this->admin)->get(route('respondents.index', $this->assessment))->assertOk()
            ->assertInertia(fn (Assert $page) => $page->where('distribution', 'closed')->where('can.import', false)->where('can.distribute', false));
    }

    public function test_roster_page_lists_people_without_completion_status(): void
    {
        $this->import($this->admin, $this->csv([['Siti', 'A-1', 'siti@contoh.test', '', 'Kantor Pusat', $this->stratumCode(), '']]), true);
        $this->actingAs($this->admin)->post(route('respondents.links', $this->assessment), ['only_without_email' => '0']);
        AccessToken::query()->update(['completed_at' => now()->startOfHour()]);

        $this->actingAs($this->admin)->get(route('respondents.index', $this->assessment))->assertInertia(fn (Assert $page) => $page
            ->component('respondents/index')
            ->where('summary.registered', 1)
            ->where('roster.rows.0.email', 'siti@contoh.test')
            ->where('roster.rows.0.tokenState', 'ISSUED')
            ->missing('roster.rows.0.completed')
            ->where('can.import', true)
            ->where('can.distribute', true));
    }
}
