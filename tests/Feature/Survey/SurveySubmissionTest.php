<?php

namespace Tests\Feature\Survey;

use App\Domain\Access\Role;
use App\Domain\Respondents\TokenCodec;
use App\Domain\Workflow\AssessmentStatus;
use App\Models\AccessToken;
use App\Models\Assessment;
use App\Models\AuditLog;
use App\Models\LevelStatement;
use App\Models\Organization;
use App\Models\Stratum;
use App\Models\SurveyResponse;
use App\Models\Unit;
use App\Services\Respondents\SurveyLinks;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Tests\Concerns\BuildsAssessments;
use Tests\TestCase;

/**
 * Fase R3 (docs/01 M3): halaman survei, pengiriman satu kali, penolakan, strata pilihan untuk kode QR, tanda mutu,
 * dan ukuran muatan halaman.
 */
class SurveySubmissionTest extends TestCase
{
    use BuildsAssessments, RefreshDatabase;

    private Assessment $assessment;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpAssessmentWorld();
        $lead = $this->member($this->operator, Role::LeadAssessor);
        $this->assessment = $this->lockedAssessment($lead, $this->member($this->operator, Role::Assessor));
        $this->openSurvey();
    }

    private function openSurvey(?Carbon $closes = null): void
    {
        $this->assessment->forceFill([
            'status' => AssessmentStatus::DataCollection,
            'survey_opens_at' => now()->subDay(),
            'survey_closes_at' => $closes ?? now()->addDays(10),
        ])->save();
    }

    private function unit(): Unit
    {
        return Unit::where('assessment_id', $this->assessment->id)->orderBy('name')->firstOrFail();
    }

    private function stratum(): Stratum
    {
        return $this->assessment->strata()->orderBy('code')->firstOrFail();
    }

    /** @return array{token: AccessToken, raw: string} */
    private function issue(bool $withStratum = true): array
    {
        return SurveyLinks::issue($this->assessment, ['unit_id' => $this->unit()->id, 'stratum_id' => $withStratum ? $this->stratum()->id : null, 'channel' => 'LINK']);
    }

    /** @return array<string, mixed> */
    private function surveyData(TestResponse $response): array
    {
        preg_match('#<script type="application/json" id="survey-data">(.*?)</script>#s', (string) $response->getContent(), $m);
        $this->assertNotEmpty($m, 'Data survei tidak ditemukan di halaman.');

        return json_decode($m[1], true);
    }

    /**
     * Jawaban lengkap: pernyataan ke-$pick setiap karakteristik (null untuk Tidak tahu) dan nilai iklim $value.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function answers(array $data, ?int $pick = 0, int|callable $value = 4, int $seconds = 700): array
    {
        $items = array_merge(...$data['climateScreens']);

        return [
            'language' => 'id',
            'stratumId' => null,
            'durationSeconds' => $seconds,
            'characteristics' => array_map(fn ($c) => ['characteristicId' => $c['id'], 'statementId' => $pick === null ? null : $c['statements'][$pick]['id']], $data['characteristics']),
            'climate' => array_map(fn ($i, $k) => ['itemId' => $i['id'], 'value' => is_callable($value) ? $value($k) : $value], $items, array_keys($items)),
        ];
    }

    public function test_ready_page_embeds_shuffled_statements_without_their_levels_and_without_console_code(): void
    {
        $first = $this->issue();
        $response = $this->get('/s/'.$first['raw'])->assertOk()->assertHeader('Cache-Control')->assertHeader('Referrer-Policy', 'no-referrer');
        $data = $this->surveyData($response);

        $this->assertCount(18, $data['characteristics']);
        $this->assertCount(5, $data['characteristics'][0]['statements']);
        $this->assertCount(7, $data['climateScreens']);
        $this->assertCount(21, array_merge(...$data['climateScreens']));
        $this->assertFalse($data['needsStratum']);
        $this->assertStringContainsString('Singapura', $data['consent']['id']);
        $this->assertStringNotContainsString('"level"', (string) $response->getContent());
        $this->assertStringNotContainsString('data-page', (string) $response->getContent());
        $this->assertStringNotContainsString('resources/js/app.tsx', (string) $response->getContent());
        $this->assertSame(substr(TokenCodec::hash($first['raw']), 0, 24), $data['draftKey']);

        // Urutan pernyataan berbeda antarresponden tetapi tetap untuk responden yang sama.
        $other = $this->surveyData($this->get('/s/'.$this->issue()['raw']));
        $order = fn (array $d) => array_map(fn ($c) => array_column($c['statements'], 'id'), $d['characteristics']);
        $this->assertNotSame($order($data), $order($other));
        $this->assertSame($order($data), $order($this->surveyData($this->get('/s/'.$first['raw']))));
    }

    public function test_submission_stores_an_anonymous_response_and_closes_the_token_once(): void
    {
        $issued = $this->issue();
        $data = $this->surveyData($this->get('/s/'.$issued['raw']));
        $audits = AuditLog::count();
        $this->travelTo(Carbon::parse('2026-12-02 16:40:00', 'UTC'));
        $this->assessment->forceFill(['survey_opens_at' => now()->subDay(), 'survey_closes_at' => now()->addDay()])->save();

        $response = $this->postJson('/s/'.$issued['raw'].'/submit', $this->answers($data, 1, fn ($k) => 1 + $k % 5))->assertCreated()->assertJson(['ok' => true]);
        $this->assertNotContains(config('session.cookie'), collect($response->headers->getCookies())->map->getName()->all());

        $token = $issued['token']->fresh();
        $this->assertSame('2026-12-02 17:00:00', $token->completed_at->utc()->format('Y-m-d H:i:s'));
        $this->assertEquals($token->completed_at, $token->consent_at);

        $stored = SurveyResponse::sole();
        $this->assertMatchesRegularExpression('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/', $stored->id);
        $this->assertSame('2026-12-02', $stored->submitted_on->toDateString(), 'Tanggal WIB 2 Desember pukul 23.40.');
        $this->assertSame('FROM_10_TO_15', $stored->duration_bucket);
        $this->assertSame([$this->unit()->id, $this->stratum()->id, 'id'], [$stored->unit_id, $stored->stratum_id, $stored->language]);
        $this->assertSame([], $stored->quality_flags);

        // Tingkat ditentukan server dari id pernyataan yang dipilih.
        $chosen = array_column(array_map(fn ($c) => ['c' => $c['id'], 's' => $c['statements'][1]['id']], $data['characteristics']), 's', 'c');
        $levels = DB::table('characteristic_answers')->where('survey_response_id', $stored->id)->pluck('level', 'characteristic_id');
        foreach ($chosen as $characteristicId => $statementId) {
            $this->assertSame(LevelStatement::find($statementId)->level, (int) $levels[$characteristicId]);
        }
        $this->assertSame(21, DB::table('climate_answers')->where('survey_response_id', $stored->id)->count());
        $this->assertSame($audits, AuditLog::count(), 'Pengiriman survei tidak boleh menulis jejak audit.');

        $this->postJson('/s/'.$issued['raw'].'/submit', $this->answers($data))->assertStatus(409)->assertJson(['error' => 'ALREADY_SUBMITTED']);
        $this->get('/s/'.$issued['raw'])->assertOk()->assertSee('sudah diterima');
        $this->assertSame(1, SurveyResponse::count());
    }

    public function test_invalid_closed_and_incomplete_submissions_are_rejected(): void
    {
        $issued = $this->issue();
        $data = $this->surveyData($this->get('/s/'.$issued['raw']));
        $url = '/s/'.$issued['raw'].'/submit';

        $this->postJson('/s/'.str_repeat('a', 43).'/submit', $this->answers($data))->assertNotFound()->assertJson(['error' => 'INVALID_TOKEN']);
        $this->postJson($url, [...$this->answers($data), 'language' => 'fr'])->assertStatus(400)->assertJson(['error' => 'INVALID_INPUT']);
        $this->postJson($url, [...$this->answers($data), 'climate' => [['itemId' => 'x', 'value' => 6]]])->assertStatus(400);
        $partial = $this->answers($data);
        array_pop($partial['characteristics']);
        $this->postJson($url, $partial)->assertStatus(422)->assertJson(['error' => 'INCOMPLETE']);
        $this->call('POST', $url, [], [], [], ['CONTENT_TYPE' => 'application/json'], str_repeat(' ', 70 * 1024))->assertStatus(413);

        $this->assessment->forceFill(['survey_opens_at' => now()->addDay()])->save();
        $this->postJson($url, $this->answers($data))->assertStatus(409)->assertJson(['error' => 'SURVEY_NOT_OPEN']);
        $this->get('/s/'.$issued['raw'])->assertOk()->assertSee('Survei dibuka mulai');
        $this->assessment->forceFill(['survey_opens_at' => now()->subDays(5), 'survey_closes_at' => now()->subMinute()])->save();
        $this->postJson($url, $this->answers($data))->assertStatus(409)->assertJson(['error' => 'SURVEY_CLOSED']);
        $this->get('/s/'.$issued['raw'])->assertOk()->assertSee('Survei sudah ditutup');

        $this->openSurvey();
        $issued['token']->forceFill(['revoked_at' => now(), 'revoked_reason' => 'MANUAL'])->save();
        $this->postJson($url, $this->answers($data))->assertNotFound()->assertJson(['error' => 'INVALID_TOKEN']);
        $this->assertSame(0, SurveyResponse::count());
        $this->assertNull($issued['token']->fresh()->completed_at);
    }

    public function test_qr_token_requires_a_stratum_of_this_assessment(): void
    {
        $this->assessment->strata()->where('code', 'S4')->firstOrFail()->forceFill(['job_titles' => ['Mandor', 'Juru Ukur']])->save();
        $issued = $this->issue(withStratum: false);
        $data = $this->surveyData($this->get('/s/'.$issued['raw']));
        $this->assertTrue($data['needsStratum']);
        $this->assertCount(5, $data['strata']);
        // Nama jabatan organisasi tampil sebagai contoh pada pilihan kelompok jabatan.
        $this->assertSame(['Mandor', 'Juru Ukur'], $data['strata'][3]['jobTitles']);
        $this->assertSame([], $data['strata'][0]['jobTitles']);
        $url = '/s/'.$issued['raw'].'/submit';

        $this->postJson($url, $this->answers($data))->assertStatus(422)->assertJson(['error' => 'STRATUM_REQUIRED']);
        $foreign = Assessment::factory()->for(Organization::factory()->create())->create();
        $otherStratum = Stratum::create(['assessment_id' => $foreign->id, 'code' => 'X1', 'name' => 'Lain', 'group' => 'FIELD', 'population' => 1]);
        $this->postJson($url, [...$this->answers($data), 'stratumId' => $otherStratum->id])->assertStatus(422);

        $chosen = $data['strata'][3]['id'];
        $this->postJson($url, [...$this->answers($data), 'stratumId' => $chosen])->assertCreated();
        $this->assertSame($chosen, $issued['token']->fresh()->stratum_id);
        $this->assertSame($chosen, SurveyResponse::sole()->stratum_id);
    }

    public function test_opening_the_page_is_marked_by_the_browser_rounded_to_the_hour(): void
    {
        $issued = $this->issue();
        $this->get('/s/'.$issued['raw']);
        $this->assertNull($issued['token']->fresh()->first_opened_at, 'Membuka halaman (misalnya pratinjau tautan) tidak menandai token.');

        $this->travelTo(Carbon::parse('2026-12-02 08:14:00', 'UTC'));
        $this->post('/s/'.$issued['raw'].'/open')->assertNoContent();
        $this->assertSame('08:00:00', $issued['token']->fresh()->first_opened_at->utc()->format('H:i:s'));
        $this->post('/s/bukan-token/open')->assertNoContent();
    }

    public function test_quality_flags_follow_the_assessment_thresholds(): void
    {
        // Sepuluh jawaban sebelumnya berdurasi 10 sampai 15 menit, sehingga median taksiran 12,5 menit.
        for ($i = 0; $i < 10; $i++) {
            $prior = $this->issue();
            $this->postJson('/s/'.$prior['raw'].'/submit', $this->answers($this->surveyData($this->get('/s/'.$prior['raw'])), 0, fn ($k) => 1 + $k % 5))->assertCreated();
        }
        $issued = $this->issue();
        $data = $this->surveyData($this->get('/s/'.$issued['raw']));
        $this->postJson('/s/'.$issued['raw'].'/submit', $this->answers($data, null, 3, 120))->assertCreated();

        $flags = SurveyResponse::where('duration_bucket', 'UNDER_5')->sole()->quality_flags;
        $this->assertEqualsCanonicalizing(['POLA_SERAGAM', 'TERLALU_CEPAT', 'BANYAK_TIDAK_TAHU'], $flags);
    }

    public function test_survey_page_payload_stays_under_350_kb_compressed(): void
    {
        if (! is_file(public_path('build/manifest.json'))) {
            $this->markTestSkipped('Aset belum dibangun (npm run build).');
        }
        $html = (string) $this->get('/s/'.$this->issue()['raw'])->getContent();
        preg_match_all('#(?:src|href)="[^"]*?(/build/assets/[^"]+)"#', $html, $assets);
        $manifest = json_decode((string) file_get_contents(public_path('build/manifest.json')), true);
        $files = array_unique($assets[1]);
        // Potongan yang dimuat lewat import statis juga dihitung.
        $walk = function (string $key) use (&$walk, $manifest, &$files): void {
            foreach ($manifest[$key]['imports'] ?? [] as $import) {
                $files[] = '/build/'.$manifest[$import]['file'];
                $walk($import);
            }
        };
        // Lingkungan uji mematikan tag Vite, sehingga berkas entri diambil dari manifest, bukan dari HTML.
        $files[] = '/build/'.$manifest['resources/js/survey/main.tsx']['file'];
        $files[] = '/build/'.$manifest['resources/css/survey.css']['file'];
        $walk('resources/js/survey/main.tsx');
        $files = array_unique($files);

        $total = strlen((string) gzencode($html)) + filesize(public_path('brand/nscas-logo-480.png'));
        foreach ($files as $file) {
            $this->assertStringNotContainsString('app-', basename($file), 'Paket konsol tidak boleh dimuat halaman survei.');
            $total += strlen((string) gzencode((string) file_get_contents(public_path(ltrim($file, '/')))));
        }
        $this->assertNotEmpty($files);
        $this->assertLessThan(350 * 1024, $total);
    }
}
