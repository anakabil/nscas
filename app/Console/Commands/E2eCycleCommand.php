<?php

namespace App\Console\Commands;

use App\Domain\Access\Role;
use App\Domain\Setup\EditableParameters;
use App\Domain\Workflow\AssessmentStatus;
use App\Models\AccessToken;
use App\Models\Assessment;
use App\Models\Characteristic;
use App\Models\GapItem;
use App\Models\InstrumentVersion;
use App\Models\Organization;
use App\Models\Unit;
use App\Models\User;
use App\Models\ValidationSession;
use App\Services\ActionPlan\ActionPlanService;
use App\Services\AssessmentSetup;
use App\Services\Quality\DataQualityService;
use App\Services\Respondents\ParticipationReport;
use App\Services\Respondents\RespondentDistribution;
use App\Services\Scoring\ScoringService;
use App\Services\SelfAssessment\SelfAssessmentAdmin;
use App\Services\SelfAssessment\SelfAssessmentForm;
use App\Services\Survey\SurveyService;
use App\Services\Validation\ValidationService;
use Carbon\CarbonImmutable;
use Database\Seeders\InstrumentVersionSeeder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * Pembantu uji ujung ke ujung (tests/e2e, fase R12). Peramban menjalankan setiap transisi status dan aksi kunci;
 * perintah ini mengerjakan langkah yang berulang lewat layanan yang sama dengan pengendali, sehingga syarat transisi
 * terpenuhi secara sungguhan, bukan dengan mengubah status langsung. Hanya berjalan pada basis data yang namanya
 * berakhiran _e2e dan tidak pernah di produksi.
 */
class E2eCycleCommand extends Command
{
    protected $signature = 'nscas:e2e-cycle {step : accounts|load|plan|roster|responses|quality|validate|rate|panel|actions|status} {--assessment=} {--password=}';

    protected $description = 'Langkah pembantu uji ujung ke ujung (hanya basis data e2e)';

    private const RATIONALE = 'Prosedur tersedia dan dikenal pekerja; bukti pelaksanaan terlihat di proyek yang dikunjungi.';

    public function handle(): int
    {
        if (app()->isProduction() || ! str_ends_with((string) config('database.connections.pgsql.database'), '_e2e')) {
            $this->error('Perintah ini hanya untuk basis data uji ujung ke ujung (nama berakhiran _e2e).');

            return self::FAILURE;
        }
        $step = (string) $this->argument('step');
        if ($step === 'accounts') {
            $this->accounts((string) ($this->option('password') ?: 'UjiSiklus2026'));

            return self::SUCCESS;
        }
        if ($step === 'load') {
            $this->load();

            return self::SUCCESS;
        }
        $assessment = Assessment::findOrFail((string) $this->option('assessment'));
        $lead = User::where('email', 'utama@e2e.test')->firstOrFail();
        $assessor = User::where('email', 'asesor@e2e.test')->firstOrFail();
        $admin = User::where('email', 'klien@e2e.test')->firstOrFail();

        match ($step) {
            'plan' => $this->plan($assessment, $lead, $assessor),
            'roster' => $this->roster($assessment, $admin),
            'responses' => $this->responses($assessment, $admin),
            'quality' => $this->quality($assessment, $lead),
            'validate' => $this->validate($assessment, $lead, $assessor),
            'rate' => $this->rate($assessment, $lead, $assessor),
            'panel' => $this->panel($assessment, $lead),
            'actions' => $this->actions($assessment, $admin),
            'status' => $this->line($assessment->status->value),
            default => throw new RuntimeException("Langkah tidak dikenal: {$step}"),
        };

        return self::SUCCESS;
    }

    /**
     * Uji beban (tests/load): satu asesmen berstatus pengumpulan data dengan 330 tautan survei, dibuat lewat transisi
     * sungguhan. Token mentah, karakteristik beserta pernyataannya, dan butir iklim ditulis ke
     * storage/app/private/e2e/load.json untuk skrip beban.
     */
    private function load(): void
    {
        $this->accounts('UjiSiklus2026');
        $lead = User::where('email', 'utama@e2e.test')->firstOrFail();
        $assessor = User::where('email', 'asesor@e2e.test')->firstOrFail();
        $admin = User::where('email', 'klien@e2e.test')->firstOrFail();
        Auth::setUser($lead);
        $setup = app(AssessmentSetup::class);
        $assessment = $setup->create($lead, [
            'organization_id' => Organization::where('name', 'PT Siklus Konstruksi')->value('id'),
            'name' => 'Asesmen Uji Beban '.now()->format('YmdHis'),
            'scope_type' => 'CORPORATE',
            'period_start' => now('Asia/Jakarta')->subMonth()->toDateString(),
            'period_end' => now('Asia/Jakarta')->addMonths(2)->toDateString(),
            'target_level' => 4,
            'instrument_version_id' => InstrumentVersion::where('status', 'PUBLISHED')->latest('published_at')->value('id'),
        ]);
        $this->plan($assessment, $lead, $assessor, ['S1' => 10, 'S2' => 30, 'S3' => 60, 'S4' => 130, 'S5' => 100]);
        $setup->transition($assessment, AssessmentStatus::Configured, [Role::LeadAssessor]);
        $setup->transition($assessment, AssessmentStatus::Locked, [Role::LeadAssessor]);
        $this->roster($assessment->fresh(), $admin);
        Auth::setUser($lead);
        $setup->transition($assessment->fresh(), AssessmentStatus::DataCollection, [Role::LeadAssessor]);
        $links = json_decode((string) Storage::disk('local')->get('e2e/links.json'), true);
        $characteristics = Characteristic::where('instrument_version_id', $assessment->instrument_version_id)->with('statements')->orderBy('position')->get();
        $items = DB::table('climate_items')->join('climate_dimensions', 'climate_dimensions.id', '=', 'climate_items.climate_dimension_id')
            ->where('climate_dimensions.instrument_version_id', $assessment->instrument_version_id)->pluck('climate_items.id');
        Storage::disk('local')->put('e2e/load.json', json_encode([
            'assessment' => $assessment->id,
            'tokens' => array_map(fn (string $l) => basename((string) parse_url($l, PHP_URL_PATH)), $links),
            'characteristics' => $characteristics->map(fn ($c) => ['id' => $c->id, 'statementIds' => $c->statements->pluck('id')->all()])->all(),
            'climateItems' => $items->all(),
        ]));
        $this->line(json_encode(['assessment' => $assessment->id, 'tokens' => count($links), 'file' => Storage::disk('local')->path('e2e/load.json')]));
    }

    private function accounts(string $password): void
    {
        app(InstrumentVersionSeeder::class)->run();
        $operator = Organization::firstOrCreate(['is_operator' => true], ['name' => 'Nusa Safety']);
        $client = Organization::firstOrCreate(['name' => 'PT Siklus Konstruksi'], ['is_operator' => false]);
        foreach ([
            ['Pengelola Siklus', 'pengelola@e2e.test', null, null],
            ['Utama Siklus', 'utama@e2e.test', $operator, Role::LeadAssessor],
            ['Asesor Siklus', 'asesor@e2e.test', $operator, Role::Assessor],
            ['Klien Siklus', 'klien@e2e.test', $client, Role::ClientAdmin],
        ] as [$name, $email, $organization, $role]) {
            $user = User::firstOrCreate(['email' => $email], ['name' => $name, 'password' => $password]);
            $user->forceFill(['is_super_admin' => $role === null, 'password' => $password])->save();
            if ($organization !== null) {
                $user->memberships()->firstOrCreate(['organization_id' => $organization->id, 'role' => $role]);
            }
        }
    }

    /** Tahap 1: unit, populasi strata, tim, parameter, rencana sampel, komunikasi awal, dan kalibrasi. */
    private function plan(Assessment $assessment, User $lead, User $assessor, array $populations = ['S1' => 2, 'S2' => 5, 'S3' => 10, 'S4' => 30, 'S5' => 13]): void
    {
        Auth::setUser($lead);
        $setup = app(AssessmentSetup::class);
        $office = $setup->createUnit($assessment, ['name' => 'Kantor Pusat Siklus', 'type' => 'HEAD_OFFICE', 'parent_id' => null]);
        $setup->createUnit($assessment, ['name' => 'Proyek Siklus Utara', 'type' => 'PROJECT', 'parent_id' => $office->id,
            'latitude' => -6.2, 'longitude' => 106.8, 'radius_meters' => 300]);
        $setup->updatePopulations($assessment, $assessment->strata()->get()->mapWithKeys(fn ($s) => [$s->id => $populations[$s->code] ?? 0])->all());
        $setup->addTeamMember($assessment, $assessor->id, Role::Assessor, Role::LeadAssessor);
        $fresh = $assessment->fresh();
        $setup->updateParameters($fresh, EditableParameters::editablePart($fresh->parameter_draft), [
            'consent_text_id' => (string) $fresh->consent_text_id,
            'consent_text_en' => (string) $fresh->consent_text_en,
            'dpa_status' => 'SIGNED',
            'dpa_reference' => 'PPD/E2E/2026/001',
            'dpa_signed_on' => now('Asia/Jakarta')->subDays(10)->toDateString(),
        ]);
        $setup->saveSamplePlan($fresh, projects: 1, locations: 1);
        $day = fn (int $d) => now('Asia/Jakarta')->subDays($d)->toDateString();
        $setup->updateKickoff($fresh, [
            'leadership' => ['date' => $day(5), 'leader' => 'Direktur Operasi', 'note' => 'Pernyataan dukungan pimpinan.'],
            'briefing' => ['date' => $day(4), 'channels' => ['SAFETY_TALK'], 'note' => 'Tujuan pengukuran dan kerahasiaan jawaban.'],
        ]);
        $setup->recordCalibration($fresh, ['date' => $day(3), 'note' => 'Pembahasan contoh bukti.', 'attendees' => [$lead->id, $assessor->id]]);
    }

    /** Tahap 2: daftar responden, tautan survei, dan masa survei, oleh administrator klien. Tautan ditulis ke berkas. */
    private function roster(Assessment $assessment, User $admin): void
    {
        Auth::setUser($admin);
        $project = Unit::where('assessment_id', $assessment->id)->where('type', 'PROJECT')->firstOrFail();
        $rows = [['Nama', 'Nomor induk', 'Surel', 'Telepon', 'Unit', 'Strata', 'Penyedia jasa']];
        $n = 0;
        foreach ($assessment->strata()->orderBy('code')->get() as $stratum) {
            for ($i = 0; $i < $stratum->population; $i++, $n++) {
                $rows[] = ["Pekerja Siklus {$n}", sprintf('SK-%03d', $n), '', '', $project->name, $stratum->code, ''];
            }
        }
        $path = tempnam(sys_get_temp_dir(), 'e2e-roster-').'.csv';
        file_put_contents($path, implode("\n", array_map(fn ($r) => implode(';', $r), $rows))."\n");
        $service = app(RespondentDistribution::class);
        $service->import($assessment, $path, null, true, Role::ClientAdmin);
        @unlink($path);
        $links = array_column($service->issueLinks($assessment, null, false, null, Role::ClientAdmin), 'link');
        $service->setWindow($assessment, CarbonImmutable::now()->subHour(), CarbonImmutable::now()->addDays(3), Role::ClientAdmin);
        Storage::disk('local')->put('e2e/links.json', json_encode($links));
        $this->line(json_encode(['links' => count($links), 'first' => $links[0] ?? null]));
    }

    /**
     * Jawaban survei untuk dua pertiga tautan lewat layanan kirim yang sama dengan halaman responden (tautan pertama
     * diisi peramban), lalu satu penilaian mandiri manajemen sampai terkirim.
     */
    private function responses(Assessment $assessment, User $admin): void
    {
        mt_srand(2026);
        $links = json_decode((string) Storage::disk('local')->get('e2e/links.json'), true);
        $survey = app(SurveyService::class);
        $characteristics = Characteristic::where('instrument_version_id', $assessment->instrument_version_id)->with('statements')->orderBy('position')->get();
        $items = DB::table('climate_items')->join('climate_dimensions', 'climate_dimensions.id', '=', 'climate_items.climate_dimension_id')
            ->where('climate_dimensions.instrument_version_id', $assessment->instrument_version_id)->pluck('climate_items.id');
        $sent = 0;
        foreach (array_slice($links, 1, (int) floor(count($links) * 2 / 3)) as $link) {
            $raw = basename((string) parse_url($link, PHP_URL_PATH));
            $survey->markOpened($raw, now());
            $result = $survey->submit($raw, [
                'language' => 'id',
                'stratumId' => null,
                'durationSeconds' => 600 + mt_rand(0, 600),
                'characteristics' => $characteristics->map(fn ($c) => [
                    'characteristicId' => $c->id,
                    'statementId' => $c->statements->firstWhere('level', mt_rand(2, 4))?->id,
                ])->all(),
                'climate' => $items->map(fn ($id) => ['itemId' => $id, 'value' => mt_rand(2, 5)])->all(),
            ], now());
            if (! $result['ok']) {
                throw new RuntimeException('Kirim survei gagal: '.$result['code']);
            }
            $sent++;
        }

        Auth::setUser($admin);
        $project = Unit::where('assessment_id', $assessment->id)->where('type', 'PROJECT')->firstOrFail();
        $issued = app(SelfAssessmentAdmin::class)->issue($assessment, 'Manajer Proyek Siklus', 'Manajer Proyek', $project->id, Role::ClientAdmin);
        $raw = basename((string) parse_url($issued['link'], PHP_URL_PATH));
        $form = app(SelfAssessmentForm::class);
        foreach ($characteristics as $c) {
            $saved = $form->saveAnswer($raw, $c->id, $c->statements->firstWhere('level', 3)?->id,
                'Prosedur sudah berjalan di proyek dan dipantau mingguan oleh pengawas lapangan serta tim K3.', []);
            if (! $saved['ok']) {
                throw new RuntimeException('Simpan penilaian mandiri gagal: '.($saved['code'] ?? ''));
            }
        }
        $submitted = $form->submit($raw);
        if (! $submitted['ok']) {
            throw new RuntimeException('Kirim penilaian mandiri gagal: '.($submitted['code'] ?? ''));
        }
        $this->line(json_encode(['surveys' => $sent, 'selfAssessment' => 'SUBMITTED']));
    }

    /** Alasan untuk strata di bawah batas partisipasi dan tinjauan partisipasi oleh asesor utama. */
    private function quality(Assessment $assessment, User $lead): void
    {
        Auth::setUser($lead);
        $service = app(DataQualityService::class);
        $min = ParticipationReport::thresholds($assessment)[1];
        $completed = AccessToken::where('assessment_id', $assessment->id)->where('kind', 'SURVEY')->whereNotNull('completed_at')
            ->selectRaw('stratum_id, count(*) as n')->groupBy('stratum_id')->pluck('n', 'stratum_id');
        foreach ($assessment->strata()->get() as $stratum) {
            if ($stratum->population > 0 && ((int) ($completed[$stratum->id] ?? 0)) / $stratum->population < $min) {
                $service->justify($assessment, $lead, Role::LeadAssessor, $stratum->id,
                    'Sebagian pekerja strata ini bertugas bergilir selama masa survei; hasil dibaca bersama wawancara dan observasi.');
            }
        }
        $service->review($assessment, $lead, Role::LeadAssessor, 'PARTICIPATION', 'Partisipasi diterima dengan catatan.');
    }

    /** Tahap 3: setiap sesi selesai dengan nilai pada karakteristik fokus, dan bukti setiap karakteristik ditinjau. */
    private function validate(Assessment $assessment, User $lead, User $assessor): void
    {
        $service = app(ValidationService::class);
        Auth::setUser($lead);
        foreach (ValidationSession::where('assessment_id', $assessment->id)->where('status', '!=', 'CANCELLED')->get() as $session) {
            $ratings = array_map(fn (string $id) => ['characteristicId' => $id, 'level' => 3.0, 'note' => 'Contoh nyata disebut lebih dari satu narasumber.'],
                $session->focus_characteristic_ids ?? []);
            if ($ratings !== []) {
                $service->saveAssessorForm($assessment, $lead, Role::LeadAssessor, $session->id, true, 'Sesi berjalan sesuai panduan.', $ratings);
            }
            DB::table('validation_sessions')->where('id', $session->id)->update(['status' => 'COMPLETED', 'updated_at' => now()]);
        }
        Auth::setUser($assessor);
        foreach (Characteristic::where('instrument_version_id', $assessment->instrument_version_id)->pluck('id') as $id) {
            $service->reviewEvidence($assessment, $assessor, Role::Assessor, $id, true, null);
        }
    }

    /** Tahap 4: nilai bukti kedua asesor untuk setiap karakteristik. */
    private function rate(Assessment $assessment, User $lead, User $assessor): void
    {
        $service = app(ScoringService::class);
        foreach ([[$lead, Role::LeadAssessor], [$assessor, Role::Assessor]] as [$user, $role]) {
            Auth::setUser($user);
            foreach (Characteristic::where('instrument_version_id', $assessment->instrument_version_id)->orderBy('position')->pluck('id') as $k => $id) {
                $service->saveRating($assessment, $user, $role, $id, 3.0 + ($k % 2) * 0.5, self::RATIONALE, [], []);
            }
        }
    }

    /** Keputusan panel untuk karakteristik yang memerlukannya: dikukuhkan dengan alasan. */
    private function panel(Assessment $assessment, User $lead): void
    {
        Auth::setUser($lead);
        $service = app(ScoringService::class);
        foreach ($service->panel($assessment)['needed'] ?? [] as $code) {
            $service->decide($assessment, $lead, Role::LeadAssessor, $code, 'CONFIRMED', null, 'Panel membahas selisih dan sepakat nilai mesin mencerminkan bukti.');
        }
        $this->line(json_encode(['decided' => count($service->panel($assessment)['needed'] ?? [])]));
    }

    /** Tahap 5: analisis penyebab dan satu tindakan untuk setiap kesenjangan, oleh administrator klien. */
    private function actions(Assessment $assessment, User $admin): void
    {
        Auth::setUser($admin);
        $service = app(ActionPlanService::class);
        $project = Unit::where('assessment_id', $assessment->id)->where('type', 'PROJECT')->value('id');
        foreach (GapItem::where('assessment_id', $assessment->id)->orderBy('rank')->get() as $k => $gap) {
            $service->updateGap($assessment, Role::ClientAdmin, $gap->id, 'Pemantauan tindak lanjut belum dijadwalkan secara tetap di proyek.', 'HIGH');
            $service->createAction($assessment, $admin, Role::ClientAdmin, null, $gap->id, [
                'title' => 'Tinjauan mingguan tindak lanjut laporan bahaya',
                'description' => null,
                'ownerName' => 'Manajer K3 Proyek',
                'ownerPosition' => 'Manajer K3',
                'ownerEmail' => null,
                'unitId' => $project,
                'dueDate' => now('Asia/Jakarta')->addMonths(2 + $k % 3)->toDateString(),
                'successIndicator' => 'Seluruh laporan bahaya ditindaklanjuti paling lama tujuh hari.',
            ]);
        }
    }
}
