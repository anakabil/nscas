<?php

namespace App\Console\Commands;

use App\Domain\Access\Role;
use App\Domain\Workflow\AssessmentStatus;
use App\Models\Assessment;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Console\Command;
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

        $plan = [
            [$client, 'Asesmen Budaya K3 Kantor Pusat 2026', AssessmentStatus::DataCollection, '2026-10-01', '2026-12-31'],
            [$client, 'Asesmen Budaya K3 Proyek Gedung 2026', AssessmentStatus::Validation, '2026-08-01', '2026-11-30'],
            [$client, 'Asesmen Budaya K3 Divisi Infrastruktur 2026', AssessmentStatus::Draft, '2026-12-01', '2027-02-28'],
            [$client, 'Asesmen Budaya K3 2025', AssessmentStatus::Monitoring, '2025-08-01', '2025-11-30'],
            [$other, 'Asesmen Budaya K3 Perdana', AssessmentStatus::Scoring, '2026-09-01', '2026-12-15'],
        ];
        foreach ($plan as [$organization, $name, $status, $start, $end]) {
            $assessment = Assessment::firstOrCreate(
                ['organization_id' => $organization->id, 'name' => $name],
                ['period_start' => $start, 'period_end' => $end, 'target_level' => 4, 'created_by' => $accounts['LEAD_ASSESSOR']->id],
            );
            $assessment->forceFill(['status' => $status])->save();
            $assessment->team()->firstOrCreate(['user_id' => $accounts['LEAD_ASSESSOR']->id], ['role' => Role::LeadAssessor]);
            $assessment->team()->firstOrCreate(['user_id' => $accounts['ASSESSOR']->id], ['role' => Role::Assessor]);
        }

        $this->info('Data contoh siap. Akun (kata sandi sama untuk semua):');
        foreach ($accounts as $role => $account) {
            $this->line(sprintf('  %-17s %s', $role, $account->email));
        }
        $this->line('Kata sandi: '.$password);
        $this->warn('Untuk meninjau tanpa verifikasi dua langkah, setel NSCAS_ENFORCE_TWO_FACTOR=false di .env pengembangan.');

        return self::SUCCESS;
    }
}
