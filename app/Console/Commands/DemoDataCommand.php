<?php

namespace App\Console\Commands;

use App\Domain\Access\Role;
use App\Domain\Setup\EditableParameters;
use App\Domain\Survey\SurveyRules;
use App\Domain\Workflow\AssessmentStatus;
use App\Models\AccessToken;
use App\Models\Assessment;
use App\Models\InstrumentVersion;
use App\Models\Organization;
use App\Models\ParticipationSnapshot;
use App\Models\RosterEntry;
use App\Models\SelfAssessment;
use App\Models\SelfAssessmentAnswer;
use App\Models\SurveyResponse;
use App\Models\Unit;
use App\Models\User;
use App\Services\AssessmentSetup;
use App\Services\Respondents\RespondentDistribution;
use App\Services\Respondents\SurveyLinks;
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
            // Fase R4: penilaian mandiri manajemen contoh.
            if ($assessment !== null && $status !== AssessmentStatus::Draft && ! SelfAssessment::where('assessment_id', $assessment->id)->exists()) {
                $this->selfAssessments($assessment, $status === AssessmentStatus::DataCollection);
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
            // Penyelesaian tersebar sepanjang jendela survei, dibulatkan ke jam seperti aplikasi sungguhan.
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
                    'quality_flags' => '[]',
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
                ]);
            }
        }
    }
}
