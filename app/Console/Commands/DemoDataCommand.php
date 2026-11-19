<?php

namespace App\Console\Commands;

use App\Domain\Access\Role;
use App\Domain\Observations\Geo;
use App\Domain\Setup\EditableParameters;
use App\Domain\Survey\SurveyRules;
use App\Domain\Validation\SessionProposal;
use App\Domain\Workflow\AssessmentStatus;
use App\Models\AccessToken;
use App\Models\Assessment;
use App\Models\AssessmentReview;
use App\Models\Characteristic;
use App\Models\EvidenceItem;
use App\Models\EvidenceRating;
use App\Models\EvidenceReview;
use App\Models\FeedbackNote;
use App\Models\InstrumentVersion;
use App\Models\ObservationCapture;
use App\Models\ObservationWindow;
use App\Models\Organization;
use App\Models\ParticipationSnapshot;
use App\Models\RosterEntry;
use App\Models\SclFulfillment;
use App\Models\ScoreRun;
use App\Models\SelfAssessment;
use App\Models\SelfAssessmentAnswer;
use App\Models\StratumJustification;
use App\Models\SurveyResponse;
use App\Models\Unit;
use App\Models\User;
use App\Models\ValidationRating;
use App\Models\ValidationSession;
use App\Services\AssessmentSetup;
use App\Services\Files\ObjectStore;
use App\Services\Respondents\ParticipationReport;
use App\Services\Respondents\RespondentDistribution;
use App\Services\Respondents\SurveyLinks;
use App\Services\Scoring\ScoringService;
use App\Services\Validation\ValidationService;
use Carbon\CarbonImmutable;
use Database\Seeders\InstrumentVersionSeeder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Data contoh untuk meninjau tampilan beranda pada setiap jenis akun dan setiap tahap. Hanya untuk lingkungan
 * pengembangan: perintah ini menolak berjalan di produksi, dan seed bawaan tidak pernah membuat data contoh.
 */
class DemoDataCommand extends Command
{
    protected $signature = 'nscas:demo {--password= : Kata sandi semua akun contoh; bila kosong dibuat acak}';

    protected $description = 'Membuat organisasi, akun, dan asesmen contoh (hanya di luar produksi)';

    public function handle(): int
    {
        if (app()->isProduction()) {
            $this->error('Data contoh tidak boleh dibuat di produksi.');

            return self::FAILURE;
        }

        $password = (string) ($this->option('password') ?: Str::password(16, symbols: false));
        $operator = Organization::firstOrCreate(['is_operator' => true], ['name' => 'Nusa Safety']);
        $client = Organization::firstOrCreate(['name' => 'PT Konstruksi Contoh'], ['is_operator' => false]);
        $other = Organization::firstOrCreate(['name' => 'PT Infrastruktur Lain'], ['is_operator' => false]);

        $user = function (string $name, string $email, ?Organization $organization, ?Role $role, bool $superAdmin = false) use ($password): User {
            $account = User::firstOrCreate(['email' => $email], ['name' => $name, 'password' => $password]);
            $account->forceFill(['is_super_admin' => $superAdmin, 'password' => $password])->save();
            if ($organization && $role) {
                $account->memberships()->firstOrCreate(['organization_id' => $organization->id, 'role' => $role]);
            }

            return $account;
        };

        $accounts = [
            'SUPER_ADMIN' => $user('Pengelola Sistem', 'pengelola@contoh.test', null, null, true),
            'LEAD_ASSESSOR' => $user('Rina Wulandari', 'asesor.utama@contoh.test', $operator, Role::LeadAssessor),
            'ASSESSOR' => $user('Bima Santoso', 'asesor@contoh.test', $operator, Role::Assessor),
            'CLIENT_ADMIN' => $user('Sari Kusuma', 'admin.klien@contoh.test', $client, Role::ClientAdmin),
            'UNIT_COORDINATOR' => $user('Dedi Pratama', 'koordinator@contoh.test', $client, Role::UnitCoordinator),
            'EXECUTIVE_VIEWER' => $user('Hendra Wijaya', 'eksekutif@contoh.test', $client, Role::ExecutiveViewer),
        ];

        app(InstrumentVersionSeeder::class)->run();
        $version = InstrumentVersion::where('status', 'PUBLISHED')->latest('published_at')->firstOrFail();
        $lead = $accounts['LEAD_ASSESSOR'];
        $assessor = $accounts['ASSESSOR'];
        Auth::setUser($lead);

        // Status akhir, periode, dan seberapa jauh perencanaan dilengkapi. Asesmen yang sudah melewati perencanaan
        // dibuat lengkap lalu dikunci lewat layanan sungguhan, sehingga snapshot dan jejak auditnya nyata.
        $plan = [
            [$client, 'Asesmen Budaya K3 Kantor Pusat 2026', AssessmentStatus::DataCollection, '2026-10-01', '2026-12-31'],
            [$client, 'Asesmen Budaya K3 Proyek Gedung 2026', AssessmentStatus::Validation, '2026-08-01', '2026-11-30'],
            [$client, 'Asesmen Budaya K3 Divisi Infrastruktur 2026', AssessmentStatus::Draft, '2026-11-10', '2027-02-28'],
            [$client, 'Asesmen Budaya K3 2025', AssessmentStatus::Monitoring, '2025-08-01', '2025-11-30'],
            [$other, 'Asesmen Budaya K3 Perdana', AssessmentStatus::Scoring, '2026-09-01', '2026-12-15'],
        ];
        $setup = app(AssessmentSetup::class);
        foreach ($plan as [$organization, $name, $status, $start, $end]) {
            $existing = Assessment::where('organization_id', $organization->id)->where('name', $name)->first();
            // Data contoh lama dari fase R0 (tanpa versi instrumen) dibuat ulang agar halaman tahap 1 terisi.
            if ($existing !== null && $existing->instrument_version_id === null) {
                $existing->delete();
                $existing = null;
            }
            if ($existing !== null) {
                $existing->forceFill(['status' => $status])->save();

                continue;
            }
            $assessment = $setup->create($lead, [
                'organization_id' => $organization->id,
                'name' => $name,
                'scope_type' => 'CORPORATE',
                'period_start' => $start,
                'period_end' => $end,
                'target_level' => 4,
                'instrument_version_id' => $version->id,
            ]);
            $this->plan($setup, $assessment, $lead, $assessor, complete: $status !== AssessmentStatus::Draft);
            if ($status !== AssessmentStatus::Draft) {
                $setup->transition($assessment, AssessmentStatus::Configured, [Role::LeadAssessor]);
                $setup->transition($assessment, AssessmentStatus::Locked, [Role::LeadAssessor]);
                $assessment->refresh()->forceFill(['status' => $status])->save();
            }
        }

        // Fase R2: daftar responden, token, kode QR, dan partisipasi untuk asesmen yang sudah melewati penguncian.
        // Fase R3: satu jawaban survei anonim untuk setiap token contoh yang sudah selesai.
        foreach ($plan as [$organization, $name, $status]) {
            $assessment = Assessment::where('organization_id', $organization->id)->where('name', $name)->first();
            if ($assessment !== null && $status !== AssessmentStatus::Draft && $assessment->roster()->doesntExist()) {
                $this->respondents($assessment, $accounts['CLIENT_ADMIN'], $accounts['UNIT_COORDINATOR'], $status);
            }
            if ($assessment !== null && $status !== AssessmentStatus::Draft && ! SurveyResponse::where('assessment_id', $assessment->id)->exists()) {
                $this->answers($assessment);
            }
            // Fase R5: bukti dokumen dan observasi lapangan contoh, sebelum penilaian mandiri agar jawabannya dapat
            // menautkan bukti.
            if ($assessment !== null && $status !== AssessmentStatus::Draft && ! EvidenceItem::where('assessment_id', $assessment->id)->exists()) {
                $this->evidence($assessment, $accounts['CLIENT_ADMIN']);
            }
            if ($assessment !== null && $status !== AssessmentStatus::Draft && ! ObservationWindow::where('assessment_id', $assessment->id)->exists()) {
                $this->observations($assessment, $lead, $accounts['CLIENT_ADMIN'], $status === AssessmentStatus::DataCollection);
            }
            // Fase R4: penilaian mandiri manajemen contoh.
            if ($assessment !== null && $status !== AssessmentStatus::Draft && ! SelfAssessment::where('assessment_id', $assessment->id)->exists()) {
                $this->selfAssessments($assessment, $status === AssessmentStatus::DataCollection);
            }
            // Fase R6: tinjauan mutu data dan validasi lapangan untuk asesmen yang sudah melewati pengumpulan data.
            if ($assessment !== null && $status->position() > AssessmentStatus::DataCollection->position()
                && ! ValidationSession::where('assessment_id', $assessment->id)->exists()) {
                $this->validation($assessment, $lead, $assessor, $status === AssessmentStatus::Validation);
            }
            // Fase R7: nilai bukti dua asesor, jalur setara, perhitungan, dan keputusan panel.
            if ($assessment !== null && $status->position() >= AssessmentStatus::Scoring->position()
                && ! ScoreRun::where('assessment_id', $assessment->id)->exists()) {
                $this->scoring($assessment->refresh(), $lead, $assessor, $status);
            }
        }
        Auth::forgetUser();

        $this->info('Data contoh siap. Akun (kata sandi sama untuk semua):');
        foreach ($accounts as $role => $account) {
            $this->line(sprintf('  %-17s %s', $role, $account->email));
        }
        $this->line('Kata sandi: '.$password);
        $this->warn('Untuk meninjau tanpa verifikasi dua langkah, setel NSCAS_ENFORCE_TWO_FACTOR=false di .env pengembangan.');

        return self::SUCCESS;
    }

    /**
     * Perencanaan contoh dengan skala klien pertama (sekitar 3.000 pekerja). Bila $complete false, hanya sebagian
     * yang diisi agar dasbor progres menampilkan asesmen yang perencanaannya belum lengkap.
     */
    private function plan(AssessmentSetup $setup, Assessment $assessment, User $lead, User $assessor, bool $complete): void
    {
        $headOffice = $setup->createUnit($assessment, ['name' => 'Kantor Pusat Jakarta', 'type' => 'HEAD_OFFICE', 'parent_id' => null]);
        $division = $setup->createUnit($assessment, ['name' => 'Divisi Gedung', 'type' => 'DIVISION', 'parent_id' => $headOffice->id]);
        $setup->createUnit($assessment, [
            'name' => 'Proyek Gedung Perkantoran Kuningan', 'type' => 'PROJECT', 'parent_id' => $division->id,
            'latitude' => -6.2297, 'longitude' => 106.8295, 'radius_meters' => 300,
        ]);
        $populations = ['S1' => 14, 'S2' => 96, 'S3' => 310, 'S4' => 1180, 'S5' => 1400];
        if (! $complete) {
            $populations = ['S1' => 14, 'S2' => 96, 'S3' => 0, 'S4' => 0, 'S5' => 0];
        }
        $setup->updatePopulations($assessment, $assessment->strata()->get()->mapWithKeys(
            fn ($stratum) => [$stratum->id => $populations[$stratum->code] ?? 0],
        )->all());
        $setup->addTeamMember($assessment, $assessor->id, Role::Assessor, Role::LeadAssessor);
        if (! $complete) {
            return;
        }
        $division2 = $setup->createUnit($assessment, ['name' => 'Divisi Infrastruktur', 'type' => 'DIVISION', 'parent_id' => $headOffice->id]);
        $setup->createUnit($assessment, [
            'name' => 'Proyek Jalan Tol Semarang', 'type' => 'PROJECT', 'parent_id' => $division2->id,
            'latitude' => -7.0051, 'longitude' => 110.4381, 'radius_meters' => 500,
        ]);
        $fresh = $assessment->fresh();
        $setup->updateParameters($fresh, EditableParameters::editablePart($fresh->parameter_draft), [
            'consent_text_id' => (string) $fresh->consent_text_id,
            'consent_text_en' => (string) $fresh->consent_text_en,
            'dpa_status' => 'SIGNED',
            'dpa_reference' => 'PPD/NS/2026/014',
            'dpa_signed_on' => '2026-07-20',
        ]);
        $setup->saveSamplePlan($fresh, projects: 2, locations: 5);
        $setup->updateKickoff($fresh, [
            'leadership' => ['date' => '2026-07-25', 'leader' => 'Direktur Operasi', 'note' => 'Pernyataan dukungan dalam rapat pimpinan.'],
            'briefing' => ['date' => '2026-07-28', 'channels' => ['SAFETY_TALK', 'NOTICE_BOARD'], 'note' => 'Tujuan pengukuran dan jaminan kerahasiaan jawaban.'],
        ]);
        $setup->recordCalibration($fresh, ['date' => '2026-07-29', 'note' => 'Pembahasan contoh bukti tiap aspek.', 'attendees' => [$lead->id, $assessor->id]]);
    }

    /**
     * Daftar responden fiktif skala klien pertama, token, kode QR, penyelesaian survei, dan cuplikan harian. Nama dan
     * surel dibuat dari daftar kata, bukan data orang sungguhan. Tingkat penyelesaian dibedakan per strata agar
     * halaman partisipasi menampilkan strata yang memenuhi dan yang di bawah ambang.
     */
    private function respondents(Assessment $assessment, User $admin, User $coordinator, AssessmentStatus $final): void
    {
        $collecting = $final === AssessmentStatus::DataCollection;
        $first = ['Agus', 'Budi', 'Citra', 'Dewi', 'Eko', 'Fajar', 'Gita', 'Hadi', 'Indah', 'Joko', 'Kartika', 'Lukman', 'Maya', 'Nur', 'Oki', 'Putri', 'Rizky', 'Sinta', 'Teguh', 'Wahyu', 'Yanti', 'Zainal'];
        $last = ['Santoso', 'Wijaya', 'Lestari', 'Saputra', 'Hidayat', 'Kurniawan', 'Pratiwi', 'Setiawan', 'Nugroho', 'Rahmawati', 'Siregar', 'Harahap', 'Gunawan', 'Utami', 'Purnomo'];
        $units = Unit::where('assessment_id', $assessment->id)->orderBy('name')->get();
        $strata = $assessment->strata()->orderBy('code')->get();
        // Orang terdaftar per strata (sebagian pekerja penyedia jasa memakai kode QR), dan bagian yang menyelesaikan survei.
        $plan = $collecting
            ? ['S1' => [14, 0.79], 'S2' => [96, 0.58], 'S3' => [300, 0.47], 'S4' => [900, 0.24], 'S5' => [1100, 0.36]]
            : ['S1' => [14, 0.86], 'S2' => [90, 0.71], 'S3' => [180, 0.62], 'S4' => [400, 0.55], 'S5' => [500, 0.48]];

        $rows = [['Nama', 'Nomor induk', 'Surel', 'Telepon', 'Unit', 'Strata', 'Penyedia jasa']];
        $n = 0;
        foreach ($strata as $stratum) {
            for ($i = 0; $i < ($plan[$stratum->code][0] ?? 0); $i++, $n++) {
                $name = $first[$n % count($first)].' '.$last[intdiv($n, count($first)) % count($last)];
                $withEmail = $stratum->code !== 'S5' || $n % 3 === 0;
                $rows[] = [
                    $name, sprintf('NS-%05d', $n + 1),
                    $withEmail ? sprintf('pekerja%05d@contoh.test', $n + 1) : '',
                    $n % 4 === 0 ? sprintf('0812%08d', $n + 1) : '',
                    $units[$n % $units->count()]->name, $stratum->code, '',
                ];
            }
        }
        $path = tempnam(sys_get_temp_dir(), 'demo-roster-').'.csv';
        file_put_contents($path, implode("\n", array_map(fn ($r) => implode(';', $r), $rows))."\n");

        Auth::setUser($admin);
        $assessment->forceFill(['status' => AssessmentStatus::DataCollection])->save();
        $service = app(RespondentDistribution::class);
        $service->import($assessment, $path, null, true, Role::ClientAdmin);
        @unlink($path);
        $service->setWindow(
            $assessment,
            CarbonImmutable::parse($collecting ? '2026-11-10 08:00' : '2026-09-01 08:00', 'Asia/Jakarta'),
            CarbonImmutable::parse($collecting ? '2026-12-15 17:00' : '2026-10-15 17:00', 'Asia/Jakarta'),
            Role::ClientAdmin,
        );
        $division = $units->firstWhere('name', 'Divisi Gedung');
        // Koordinator contoh hanya anggota PT Konstruksi Contoh.
        if ($division !== null && $coordinator->memberships()->where('organization_id', $assessment->organization_id)->exists()) {
            $service->assignCoordinator($assessment, $coordinator->id, $division->id, Role::ClientAdmin);
        }
        $toll = $units->firstWhere('name', 'Proyek Jalan Tol Semarang') ?? $units->first();
        $service->createQr($assessment, $toll->id, null, 400, Role::ClientAdmin);
        $qr = $assessment->qrCodes()->where('is_active', true)->firstOrFail();

        // Token dibuat langsung (tanpa surel terkirim) agar data contoh tidak mengantre surel sungguhan.
        $opens = $assessment->fresh()->survey_opens_at;
        $now = now();
        $span = max(1, (int) $opens->diffInHours($collecting ? $now : $opens->copy()->addDays(40)));
        foreach (RosterEntry::where('assessment_id', $assessment->id)->orderBy('employee_no')->get() as $k => $entry) {
            $token = SurveyLinks::issue($assessment, [
                'unit_id' => $entry->unit_id, 'stratum_id' => $entry->stratum_id, 'roster_entry_id' => $entry->id,
                'channel' => $entry->email === null ? 'LINK' : 'EMAIL',
            ])['token'];
            $rate = $plan[$strata->firstWhere('id', $entry->stratum_id)->code][1];
            // Penyelesaian tersebar sepanjang masa survei, dibulatkan ke jam seperti aplikasi sungguhan.
            if (($k * 7919 % 1000) / 1000 < $rate) {
                $at = $opens->copy()->addHours(($k * 37) % $span)->startOfHour();
                $token->forceFill(['issued_at' => $opens, 'first_opened_at' => $at, 'consent_at' => $at, 'completed_at' => $at])->save();
            } else {
                $token->forceFill(['issued_at' => $opens])->save();
            }
        }
        // Pekerja penyedia jasa lewat kode QR, memilih strata S5 sendiri.
        $s5 = $strata->firstWhere('code', 'S5');
        for ($q = 0; $q < 140; $q++) {
            $token = SurveyLinks::issue($assessment, ['unit_id' => $qr->unit_id, 'stratum_id' => $q < 120 ? $s5?->id : null, 'unit_qr_code_id' => $qr->id, 'channel' => 'QR'])['token'];
            $at = $opens->copy()->addHours(($q * 53) % $span)->startOfHour();
            $token->forceFill($q < 95 ? ['issued_at' => $at, 'first_opened_at' => $at, 'consent_at' => $at, 'completed_at' => $at] : ['issued_at' => $at])->save();
        }

        // Cuplikan harian dari jumlah selesai sampai hari itu.
        $population = (int) $strata->sum('population');
        $lastDay = CarbonImmutable::parse($collecting ? $now : $opens->copy()->addDays(40))->setTimezone('Asia/Jakarta')->startOfDay();
        for ($day = CarbonImmutable::parse($opens)->setTimezone('Asia/Jakarta')->startOfDay(); $day <= $lastDay; $day = $day->addDay()) {
            $end = $day->endOfDay()->utc();
            $completed = AccessToken::where('assessment_id', $assessment->id)->where('completed_at', '<=', $end)->count();
            ParticipationSnapshot::updateOrCreate(
                ['assessment_id' => $assessment->id, 'taken_on' => $day->toDateString()],
                ['data' => ['population' => $population, 'issued' => AccessToken::where('assessment_id', $assessment->id)->where('issued_at', '<=', $end)->whereNull('revoked_at')->count(), 'completed' => $completed, 'strata' => []]],
            );
        }
        $assessment->forceFill(['status' => $final])->save();
        Auth::setUser(User::where('email', 'asesor.utama@contoh.test')->firstOrFail());
    }

    /**
     * Jawaban survei fiktif untuk token contoh yang selesai, dengan pola yang masuk akal untuk dianalisis pada fase
     * berikutnya: manajemen menilai sedikit lebih tinggi daripada pekerja lapangan (kesenjangan persepsi), sebagian
     * kecil "Tidak tahu", dan durasi kebanyakan 10 sampai 20 menit. Angka acak memakai benih tetap agar hasilnya sama
     * setiap kali data contoh dibuat.
     */
    private function answers(Assessment $assessment): void
    {
        mt_srand(crc32($assessment->name));
        $characteristics = DB::table('characteristics')->where('instrument_version_id', $assessment->instrument_version_id)->orderBy('position')->pluck('id');
        $items = DB::table('climate_items')->join('climate_dimensions', 'climate_dimensions.id', '=', 'climate_items.climate_dimension_id')
            ->where('climate_dimensions.instrument_version_id', $assessment->instrument_version_id)->pluck('climate_items.reverse_coded', 'climate_items.id');
        $groups = $assessment->strata()->pluck('group', 'id')->map(fn ($g) => $g instanceof \BackedEnum ? $g->value : $g);
        $base = ['MANAGEMENT' => 3.4, 'SUPERVISORY' => 3.0, 'FIELD' => 2.6];
        $buckets = ['FROM_5_TO_10', 'FROM_10_TO_15', 'FROM_10_TO_15', 'FROM_15_TO_20', 'FROM_15_TO_20', 'OVER_20'];
        $clamp = fn (float $v): int => (int) max(1, min(5, round($v)));

        $tokens = AccessToken::where('assessment_id', $assessment->id)->whereNotNull('completed_at')->whereNotNull('stratum_id')->get(['unit_id', 'stratum_id', 'completed_at']);
        foreach ($tokens->chunk(200) as $chunk) {
            $responses = $levels = $climate = [];
            foreach ($chunk as $token) {
                $id = SurveyResponse::randomId();
                $mean = $base[$groups[$token->stratum_id] ?? 'FIELD'] ?? 2.8;
                $person = (mt_rand() / mt_getrandmax() - 0.5) * 1.2;
                $responses[] = [
                    'id' => $id, 'assessment_id' => $assessment->id, 'unit_id' => $token->unit_id, 'stratum_id' => $token->stratum_id,
                    'instrument_version_id' => $assessment->instrument_version_id, 'language' => mt_rand(1, 20) === 1 ? 'en' : 'id',
                    'submitted_on' => SurveyRules::wibDate($token->completed_at), 'duration_bucket' => $buckets[mt_rand(0, 5)],
                    // Sebagian kecil jawaban bertanda agar tinjauan mutu data (fase R6) memiliki contoh.
                    'quality_flags' => match (mt_rand(1, 60)) {
                        1 => '["POLA_SERAGAM"]',
                        2 => '["TERLALU_CEPAT"]',
                        3 => '["BANYAK_TIDAK_TAHU"]',
                        default => '[]',
                    },
                ];
                foreach ($characteristics as $k => $characteristicId) {
                    $noise = (mt_rand() / mt_getrandmax() - 0.5) * 1.6 + ($k % 3 - 1) * 0.3;
                    $levels[] = ['id' => SurveyResponse::randomId(), 'survey_response_id' => $id, 'characteristic_id' => $characteristicId,
                        'level' => mt_rand(1, 14) === 1 ? null : $clamp($mean + $person + $noise)];
                }
                foreach ($items as $itemId => $reverse) {
                    $agree = $mean + 0.6 + $person + (mt_rand() / mt_getrandmax() - 0.5) * 1.8;
                    $climate[] = ['id' => SurveyResponse::randomId(), 'survey_response_id' => $id, 'climate_item_id' => $itemId,
                        'value' => $clamp($reverse ? 6 - $agree : $agree)];
                }
            }
            DB::table('survey_responses')->insert($responses);
            foreach (array_chunk($levels, 2000) as $rows) {
                DB::table('characteristic_answers')->insert($rows);
            }
            foreach (array_chunk($climate, 2000) as $rows) {
                DB::table('climate_answers')->insert($rows);
            }
        }
    }

    /**
     * Penilaian mandiri contoh dengan nama dan alasan fiktif. Manajemen menilai sedikit lebih tinggi daripada pekerja,
     * pola yang lazim dan menjadi bahan kesenjangan persepsi pada fase penilaian.
     */
    private function selfAssessments(Assessment $assessment, bool $collecting): void
    {
        mt_srand(crc32('sa'.$assessment->name));
        $people = [
            ['Ir. Hendro Saputra', 'Direktur Operasi', 'Kantor Pusat Jakarta', 'SUBMITTED'],
            ['Ratna Dewi, S.T.', 'Kepala Divisi K3 dan Lingkungan', 'Kantor Pusat Jakarta', 'SUBMITTED'],
            ['Agus Wibowo, S.T.', 'Manajer Proyek', 'Proyek Gedung Perkantoran Kuningan', 'SUBMITTED'],
            ['Yudi Prasetyo', 'Manajer Proyek', 'Proyek Jalan Tol Semarang', $collecting ? 'DRAFT' : 'SUBMITTED'],
        ];
        if ($collecting) {
            $people[] = ['Sri Handayani', 'Manajer Lokasi', 'Divisi Gedung', 'NOT_OPENED'];
        }
        $bases = [
            'Praktik ini terlihat dari rapat koordinasi mingguan di proyek dan tindak lanjut temuan inspeksi yang dicatat dalam laporan bulanan.',
            'Dasar penilaian kami adalah catatan pelaksanaan safety talk, hasil inspeksi gabungan, dan pembahasan insiden pada rapat manajemen.',
            'Penerapannya sudah berjalan di sebagian besar proyek, tetapi belum seragam di proyek baru dan pada pekerjaan subkontraktor.',
            'Kami menilai berdasarkan tinjauan manajemen terakhir, program kerja K3 tahunan, dan umpan balik pekerja dalam forum komunikasi.',
        ];
        $characteristics = DB::table('characteristics')->where('instrument_version_id', $assessment->instrument_version_id)->orderBy('position')->get(['id']);
        $units = Unit::where('assessment_id', $assessment->id)->pluck('id', 'name');
        $at = CarbonImmutable::parse($assessment->survey_opens_at ?? $assessment->period_start)->addDays(6)->setTime(10, 0);
        // Bukti terbaru per karakteristik (fase R5) untuk ditautkan pada jawaban.
        $evidence = [];
        foreach (EvidenceItem::where('assessment_id', $assessment->id)->whereNull('deleted_at')->whereNotIn('id', EvidenceItem::whereNotNull('supersedes_id')->select('supersedes_id'))->with('links')->orderBy('title')->get() as $item) {
            foreach ($item->links as $link) {
                $evidence[$link->characteristic_id][] = $item->id;
            }
        }

        foreach ($people as $i => [$name, $position, $unitName, $state]) {
            $token = SurveyLinks::issue($assessment, ['unit_id' => $units[$unitName] ?? $units->first(), 'stratum_id' => null, 'kind' => 'SELF_ASSESSMENT', 'channel' => 'LINK'])['token'];
            $sa = SelfAssessment::create([
                'assessment_id' => $assessment->id, 'unit_id' => $token->unit_id, 'access_token_id' => $token->id,
                'respondent_name' => $name, 'respondent_position' => $position,
                'status' => $state === 'SUBMITTED' ? 'SUBMITTED' : 'DRAFT',
                'submitted_at' => $state === 'SUBMITTED' ? $at->addDays($i) : null,
            ]);
            if ($state === 'NOT_OPENED') {
                continue;
            }
            $token->forceFill(['first_opened_at' => $at->subDay(), 'completed_at' => $state === 'SUBMITTED' ? $at->addDays($i) : null])->save();
            foreach ($characteristics as $k => $c) {
                if ($state === 'DRAFT' && $k >= 9) {
                    break;
                }
                SelfAssessmentAnswer::create([
                    'self_assessment_id' => $sa->id, 'characteristic_id' => $c->id,
                    'level' => max(2, min(5, 3 + mt_rand(0, 2) - ($k % 5 === 4 ? 1 : 0))),
                    'justification' => $bases[($k + $i) % count($bases)],
                    'evidence_ids' => array_slice($evidence[$c->id] ?? [], 0, 1 + ($i % 2)),
                ]);
            }
        }
    }

    /**
     * Bukti dokumen contoh (fase R5): berkas PDF kecil dengan pemetaan ke karakteristik dan butir daftar periksa, satu
     * bukti dengan versi kedua, dan satu bukti yang dihapus. Berkas ditulis ke disk penyimpanan yang berlaku.
     */
    private function evidence(Assessment $assessment, User $admin): void
    {
        $store = app(ObjectStore::class);
        $characteristics = Characteristic::where('instrument_version_id', $assessment->instrument_version_id)
            ->orderBy('position')->with('evidenceRequirements')->get()->keyBy('code');
        $units = Unit::where('assessment_id', $assessment->id)->pluck('id', 'name');
        $at = CarbonImmutable::parse($assessment->locked_at ?? $assessment->period_start)->addDays(2)->setTime(9, 0);
        // [judul, unit (null untuk tingkat organisasi), [kode karakteristik => posisi butir daftar periksa]]
        $items = [
            ['Risalah rapat direksi triwulan III', null, ['K1.1' => [1], 'K2.2' => [1]]],
            ['Jadwal dan catatan kunjungan manajemen ke lapangan', 'Proyek Gedung Perkantoran Kuningan', ['K1.1' => [2]]],
            ['Notulen forum P2K3 bulanan', 'Kantor Pusat Jakarta', ['K1.2' => [1]]],
            ['Daftar hadir safety talk pagi', 'Proyek Jalan Tol Semarang', ['K1.2' => [2], 'K5.3' => [1]]],
            ['Kebijakan penghargaan dan sanksi K3', null, ['K1.3' => [1]]],
            ['Laporan investigasi kejadian nyaris celaka', 'Proyek Gedung Perkantoran Kuningan', ['K2.1' => [1], 'K5.2' => [1]]],
            ['Rencana kerja dan anggaran K3 tahunan', null, ['K2.2' => [2]]],
            ['Prosedur seleksi dan evaluasi subkontraktor', null, ['K3.1' => [1]]],
            ['Matriks kompetensi dan rencana pelatihan', 'Kantor Pusat Jakarta', ['K3.2' => [1, 2]]],
            ['Struktur organisasi fungsi K3', null, ['K3.3' => [1]]],
            ['Izin kerja dan analisis keselamatan pekerjaan', 'Proyek Jalan Tol Semarang', ['K4.1' => [1], 'K4.3' => [1]]],
            ['Rekap laporan bahaya dari pekerja', 'Proyek Jalan Tol Semarang', ['K5.1' => [1]]],
        ];
        $created = [];
        foreach ($items as $n => [$title, $unitName, $map]) {
            $item = $this->storeEvidence($store, $assessment, $admin, $title, $unitName === null ? null : ($units[$unitName] ?? null), $at->addHours($n * 5), null);
            foreach ($map as $code => $positions) {
                $c = $characteristics->get($code);
                if ($c === null) {
                    continue;
                }
                $requirementIds = $c->evidenceRequirements->whereIn('position', $positions)->pluck('id')->values()->all();
                $item->links()->create(['characteristic_id' => $c->id, 'requirement_ids' => $requirementIds]);
            }
            $created[] = $item;
        }
        // Versi kedua untuk rencana kerja dan anggaran, mewarisi pemetaan versi pertama.
        $first = $created[6];
        $second = $this->storeEvidence($store, $assessment, $admin, $first->title.' (revisi)', $first->unit_id, $at->addDays(5), $first);
        foreach ($first->links as $link) {
            $second->links()->create(['characteristic_id' => $link->characteristic_id, 'requirement_ids' => $link->requirement_ids]);
        }
        // Bukti yang diunggah keliru lalu dihapus secara logis.
        $this->storeEvidence($store, $assessment, $admin, 'Draf surat edaran (keliru unggah)', null, $at->addDays(1), null)
            ->forceFill(['deleted_at' => $at->addDays(1)->addHour()])->save();
    }

    private function storeEvidence(ObjectStore $store, Assessment $assessment, User $admin, string $title, ?string $unitId, CarbonImmutable $at, ?EvidenceItem $previous): EvidenceItem
    {
        $pdf = $this->samplePdf($title);
        $key = $store->key($assessment->organization_id, $assessment->id, 'evidence', 'pdf');
        $store->disk()->put($key, $pdf);
        $item = new EvidenceItem([
            'assessment_id' => $assessment->id,
            'unit_id' => $unitId,
            'title' => $title,
            'file_name' => Str::slug($title).'.pdf',
            'storage_key' => $key,
            'sha256' => hash('sha256', $pdf),
            'mime_type' => 'application/pdf',
            'size_bytes' => strlen($pdf),
            'version' => $previous === null ? 1 : $previous->version + 1,
            'supersedes_id' => $previous?->id,
            'uploaded_by_id' => $admin->id,
        ]);
        $item->created_at = $at;
        $item->updated_at = $at;
        $item->save();

        return $item;
    }

    /** PDF satu halaman yang sah dengan judul bukti, tanpa pustaka tambahan. */
    private function samplePdf(string $title): string
    {
        $text = str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], 'Contoh bukti NSCAS: '.$title);
        $stream = "BT /F1 14 Tf 56 760 Td ({$text}) Tj ET";
        $objects = [
            '<< /Type /Catalog /Pages 2 0 R >>',
            '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
            '<< /Length '.strlen($stream)." >>\nstream\n{$stream}\nendstream",
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        ];
        $pdf = "%PDF-1.4\n";
        $offsets = [];
        foreach ($objects as $i => $object) {
            $offsets[] = strlen($pdf);
            $pdf .= ($i + 1)." 0 obj\n{$object}\nendobj\n";
        }
        $xref = strlen($pdf);
        $pdf .= 'xref'."\n0 ".(count($objects) + 1)."\n0000000000 65535 f \n";
        foreach ($offsets as $offset) {
            $pdf .= sprintf("%010d 00000 n \n", $offset);
        }

        return $pdf.'trailer << /Size '.(count($objects) + 1)." /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF\n";
    }

    /**
     * Observasi lapangan contoh (fase R5): satu masa observasi yang sudah berakhir dengan beberapa rekaman, dan untuk asesmen
     * yang sedang mengumpulkan data satu masa observasi yang sedang berlangsung. Foto dibuat dengan GD.
     */
    private function observations(Assessment $assessment, User $lead, User $admin, bool $collecting): void
    {
        $store = app(ObjectStore::class);
        $project = Unit::where('assessment_id', $assessment->id)->whereNotNull('latitude')->orderBy('name')->first();
        if ($project === null) {
            return;
        }
        $checklist = [
            ['code' => 'O1', 'label' => 'Pemakaian alat pelindung diri di area kerja'],
            ['code' => 'O2', 'label' => 'Rambu dan pembatas area galian'],
            ['code' => 'O3', 'label' => 'Kebersihan dan kerapian area kerja'],
        ];
        $start = CarbonImmutable::parse($assessment->survey_opens_at ?? $assessment->period_start)->setTimezone('Asia/Jakarta')->addDays(3)->setTime(8, 0);
        $windows = [[
            'title' => 'Observasi area kerja minggu pertama', 'opens' => $start, 'closes' => $start->addDays(2)->setTime(17, 0),
        ]];
        if ($collecting) {
            $now = CarbonImmutable::now('Asia/Jakarta');
            $windows[] = ['title' => 'Observasi lanjutan pekan ini', 'opens' => $now->subDay()->setTime(7, 0), 'closes' => $now->addDays(3)->setTime(17, 0)];
        }
        $lat = (float) $project->latitude;
        $lng = (float) $project->longitude;
        $radius = (int) ($project->radius_meters ?? 300);
        foreach ($windows as $w => $spec) {
            $window = ObservationWindow::create([
                'assessment_id' => $assessment->id, 'unit_id' => $project->id, 'title' => $spec['title'],
                'opens_at' => $spec['opens']->utc(), 'closes_at' => $spec['closes']->utc(), 'checklist' => $checklist,
                'latitude' => $lat, 'longitude' => $lng, 'radius_meters' => $radius, 'created_by_id' => $lead->id,
            ]);
            // [butir, selisih lintang, akurasi]; null berarti lokasi tidak diizinkan.
            $shots = $w === 0
                ? [['O1', 0.0004, 8.0], ['O1', -0.0006, 12.0], ['O2', 0.0011, 15.0], ['O3', 0.012, 20.0], ['O3', null, null]]
                : [['O1', 0.0003, 6.0], ['O2', 0.0008, 10.0]];
            foreach ($shots as $k => [$code, $dLat, $accuracy]) {
                $jpeg = $this->samplePhoto($code, $k);
                $key = $store->key($assessment->organization_id, $assessment->id, 'observation', 'jpg');
                $store->disk()->put($key, $jpeg);
                $distance = $dLat === null ? null : Geo::haversineMeters($lat, $lng, $lat + $dLat, $lng);
                ObservationCapture::create([
                    'observation_window_id' => $window->id, 'checklist_item_code' => $code, 'storage_key' => $key,
                    'sha256' => hash('sha256', $jpeg), 'mime_type' => 'image/jpeg', 'size_bytes' => strlen($jpeg),
                    'server_captured_at' => $spec['opens']->addHours(2 + $k)->utc(),
                    'latitude' => $dLat === null ? null : $lat + $dLat, 'longitude' => $dLat === null ? null : $lng,
                    'accuracy_meters' => $accuracy, 'distance_meters' => $distance,
                    'outside_radius' => $distance !== null && $distance > $radius,
                    'note' => $k === 0 ? 'Pekerja di lantai 3 memakai helm dan sabuk pengaman.' : null,
                    'uploaded_by_id' => $admin->id,
                ]);
            }
        }
    }

    /** Foto contoh 640 x 480 berwarna kalem dengan kode butir, dibuat dengan GD. */
    private function samplePhoto(string $code, int $variant): string
    {
        $image = imagecreatetruecolor(640, 480);
        $palette = [[105, 27, 46], [134, 101, 42], [59, 52, 49], [74, 18, 32]];
        [$r, $g, $b] = $palette[$variant % count($palette)];
        for ($y = 0; $y < 480; $y++) {
            $shade = (int) (60 * $y / 480);
            imageline($image, 0, $y, 639, $y, (int) imagecolorallocate($image, min(255, $r + $shade), min(255, $g + $shade), min(255, $b + $shade)));
        }
        $light = (int) imagecolorallocate($image, 254, 250, 244);
        imagefilledrectangle($image, 32, 380, 300, 440, (int) imagecolorallocate($image, 26, 26, 26));
        imagestring($image, 5, 48, 398, "Observasi {$code} contoh ".($variant + 1), $light);
        ob_start();
        imagejpeg($image, null, 80);
        imagedestroy($image);

        return (string) ob_get_clean();
    }

    /**
     * Fase R6: survei ditutup, tinjauan partisipasi dan mutu data, sesi dari rencana sampel, narasumber fiktif, nilai
     * dua asesor, catatan umpan balik, dan tinjauan bukti. Bila $inProgress, sebagian sesi dan tinjauan bukti belum
     * selesai sehingga halaman validasi menampilkan pekerjaan yang masih berjalan.
     */
    private function validation(Assessment $assessment, User $lead, User $assessor, bool $inProgress): void
    {
        mt_srand(crc32('validasi '.$assessment->name));
        $at = CarbonImmutable::parse($assessment->period_end)->subDays(20)->setTime(9, 0);
        $assessment->forceFill(['survey_closes_at' => $at->subDays(3)->utc()])->save();

        // Alasan untuk strata di bawah batas partisipasi, lalu kedua tinjauan asesor utama.
        $min = ParticipationReport::thresholds($assessment)[1];
        $completed = AccessToken::where('assessment_id', $assessment->id)->where('kind', 'SURVEY')->whereNotNull('completed_at')
            ->selectRaw('stratum_id, count(*) as n')->groupBy('stratum_id')->pluck('n', 'stratum_id');
        foreach ($assessment->strata()->get() as $stratum) {
            if ($stratum->population > 0 && ((int) ($completed[$stratum->id] ?? 0)) / $stratum->population < $min) {
                StratumJustification::create([
                    'assessment_id' => $assessment->id, 'stratum_id' => $stratum->id, 'written_by' => $lead->id,
                    'justification' => 'Sebagian besar pekerja strata ini bekerja bergilir di lokasi terpencil selama masa survei. Hasilnya dibaca bersama wawancara dan observasi lapangan.',
                ]);
            }
        }
        foreach (['PARTICIPATION' => 'Partisipasi diterima dengan catatan pada strata pelaksana.', 'DATA_QUALITY' => 'Jawaban bertanda diperiksa; tidak ada yang dikeluarkan.'] as $kind => $note) {
            AssessmentReview::create(['assessment_id' => $assessment->id, 'kind' => $kind, 'note' => $note, 'reviewed_by' => $lead->id, 'reviewed_at' => $at->subDays(2)]);
        }

        // Sesi dari usulan rencana sampel, dengan karakteristik fokus dari temuan awal.
        $proposal = app(ValidationService::class)->proposal($assessment);
        $characteristics = Characteristic::where('instrument_version_id', $assessment->instrument_version_id)->orderBy('position')->get(['id', 'code']);
        $focus = $proposal !== null && $proposal['focus'] !== [] ? array_column($proposal['focus'], 'characteristicId') : $characteristics->take(4)->pluck('id')->all();
        $projects = Unit::where('assessment_id', $assessment->id)->where('type', 'PROJECT')->orderBy('name')->get(['id', 'name']);
        $names = ['Ahmad Fauzi', 'Rina Marlina', 'Dedi Kurnia', 'Sri Wahyuni', 'Bambang Irawan', 'Lina Oktaviani', 'Yusuf Hakim', 'Wulan Sari'];
        $positions = ['MANAGEMENT' => 'Manajer Proyek', 'SUPERVISORY' => 'Pengawas Lapangan', 'FIELD' => 'Tukang Besi'];
        $base = ['MANAGEMENT' => 3.5, 'SUPERVISORY' => 3.0, 'FIELD' => 2.5];
        foreach (($proposal['sessions'] ?? []) as $i => $p) {
            $visit = in_array($p['type'], [SessionProposal::SITE_VISIT, SessionProposal::VIRTUAL_SITE_VISIT], true);
            $done = ! $inProgress || $i % 3 !== 2;
            $project = $projects->isEmpty() ? null : $projects[$i % $projects->count()];
            $session = ValidationSession::create([
                'assessment_id' => $assessment->id,
                'type' => $p['type'],
                'label' => trim(preg_replace('/\s+/', ' ', __('setup.sessionLabels.'.$p['type'], ['stratum' => $p['stratumCode'] ?? '', 'n' => $p['sequence']], 'id'))),
                'layer' => $p['layer'],
                'stratum_id' => $p['stratumId'],
                'unit_id' => $visit ? $project?->id : null,
                'scheduled_at' => $at->addDays(intdiv($i, 3))->addHours(($i % 3) * 2)->utc(),
                'meeting_url' => $p['type'] === SessionProposal::SITE_VISIT ? null : 'https://rapat.contoh.test/validasi-'.($i + 1),
                'location' => $p['type'] === SessionProposal::SITE_VISIT ? ($project?->name ?? 'Lokasi proyek') : null,
                'participant_count' => $p['participantCount'] ?: null,
                'status' => $done ? 'COMPLETED' : 'SCHEDULED',
                'focus_characteristic_ids' => $focus,
                'recording_consent' => $done,
                'notes' => $done ? 'Narasumber menyebut contoh nyata penerapan prosedur, tetapi tindak lanjut laporan bahaya belum konsisten antarproyek.' : null,
            ]);
            if ($visit || ! $done) {
                continue;
            }
            foreach (range(1, max(1, min(3, (int) $p['participantCount']))) as $k) {
                $session->participants()->create(['full_name' => $names[($i + $k) % count($names)], 'position' => $positions[$p['layer']] ?? 'Pekerja']);
            }
            foreach ([$lead, $assessor] as $rater) {
                foreach ($focus as $characteristicId) {
                    $level = max(1.0, min(5.0, round((($base[$p['layer']] ?? 3.0) + mt_rand(-2, 2) * 0.5) * 2) / 2));
                    ValidationRating::create([
                        'validation_session_id' => $session->id, 'characteristic_id' => $characteristicId, 'assessor_id' => $rater->id,
                        'level' => $level, 'note' => 'Didukung contoh yang disebut lebih dari satu narasumber.',
                    ]);
                }
            }
        }

        foreach ([3, 2, 1] as $daysBefore) {
            FeedbackNote::create([
                'assessment_id' => $assessment->id, 'note_date' => $at->addDays(3 - $daysBefore)->toDateString(), 'author_id' => $lead->id,
                'summary' => 'Sesi hari ini berjalan sesuai jadwal. Temuan sementara: komunikasi bahaya harian sudah rutin, tindak lanjut laporan perlu dipantau.',
            ]);
        }
        foreach ($characteristics as $k => $c) {
            if ($inProgress && $k % 2 === 1) {
                continue;
            }
            EvidenceReview::create(['assessment_id' => $assessment->id, 'characteristic_id' => $c->id, 'reviewed_by' => $assessor->id, 'reviewed_at' => $at->addDay(), 'note' => null]);
        }
    }

    /**
     * Fase R7: nilai bukti dua asesor (satu karakteristik sengaja berselisih agar perlu rekonsiliasi), jalur setara,
     * satu perhitungan lewat layanan sungguhan, lalu, untuk asesmen yang sudah melewati rapat panel, keputusan panel
     * dan penetapan hasil. Status sementara dipindahkan agar aturan status layanan tetap berlaku, lalu dikembalikan.
     */
    private function scoring(Assessment $assessment, User $lead, User $assessor, AssessmentStatus $final): void
    {
        mt_srand(crc32('penilaian '.$assessment->name));
        $service = app(ScoringService::class);
        $assessment->forceFill(['status' => AssessmentStatus::Scoring])->save();
        $characteristics = Characteristic::where('instrument_version_id', $assessment->instrument_version_id)->orderBy('position')->get(['id', 'code']);
        foreach ($characteristics as $k => $c) {
            $base = 2.5 + ($k % 4) * 0.5;
            foreach ([$lead, $assessor] as $i => $rater) {
                $level = $k === 2 && $i === 1 ? max(1.0, $base - 1.5) : max(1.0, min(5.0, $base + (mt_rand(0, 1) * 0.5)));
                EvidenceRating::create([
                    'assessment_id' => $assessment->id, 'characteristic_id' => $c->id, 'assessor_id' => $rater->id, 'level' => $level,
                    'rationale' => 'Prosedur tersedia dan dikenal pekerja; bukti pelaksanaan terlihat di sebagian besar proyek yang dikunjungi.',
                ]);
            }
        }
        foreach ($service->sclAspectCodes($assessment) as $a => $code) {
            foreach ([2 => 92, 3 => 84, 4 => 72, 5 => 55] as $step => $percent) {
                SclFulfillment::create([
                    'assessment_id' => $assessment->id, 'aspect_code' => $code, 'step' => $step, 'percent' => max(0, $percent - $a * 2),
                    'justification' => 'Dinilai dari bukti dokumen, wawancara, dan observasi lapangan.', 'updated_by' => $lead->id,
                ]);
            }
        }
        $service->run($assessment, $lead, Role::LeadAssessor);
        if ($final->position() > AssessmentStatus::PanelReview->position()) {
            $assessment->forceFill(['status' => AssessmentStatus::PanelReview])->save();
            $panel = $service->panel($assessment);
            foreach ($panel['needed'] ?? [] as $i => $code) {
                $engine = collect($panel['characteristics'])->firstWhere('code', $code)['final'] ?? 3.0;
                $i % 2 === 0
                    ? $service->decide($assessment, $lead, Role::LeadAssessor, $code, 'ADJUSTED', round(max(1.0, $engine - 0.25), 2), 'Panel menimbang bukti kunjungan proyek yang menunjukkan pelaksanaan belum merata.')
                    : $service->decide($assessment, $lead, Role::LeadAssessor, $code, 'CONFIRMED', null, 'Panel membahas selisih dan sepakat nilai mesin mencerminkan bukti.');
            }
            $service->finalize($assessment, $lead, Role::LeadAssessor);
        }
        $assessment->forceFill(['status' => $final])->save();
    }
}
