<?php

namespace App\Console\Commands;

use App\Domain\Access\Role;
use App\Domain\Setup\EditableParameters;
use App\Domain\Workflow\AssessmentStatus;
use App\Models\Assessment;
use App\Models\InstrumentVersion;
use App\Models\Organization;
use App\Models\User;
use App\Services\AssessmentSetup;
use Database\Seeders\InstrumentVersionSeeder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Auth;
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
}
