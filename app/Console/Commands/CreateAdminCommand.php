<?php

namespace App\Console\Commands;

use App\Models\Organization;
use App\Models\User;
use App\Support\Audit;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class CreateAdminCommand extends Command
{
    protected $signature = 'nscas:create-admin {email : Surel pengelola sistem} {--name=Pengelola Sistem : Nama tampilan}';

    protected $description = 'Membuat akun pengelola sistem (SUPER_ADMIN) pertama dengan kata sandi acak yang ditampilkan satu kali';

    public function handle(): int
    {
        $email = Str::lower((string) $this->argument('email'));
        if (Validator::make(['email' => $email], ['email' => ['required', 'email:rfc']])->fails()) {
            $this->error('Alamat surel tidak sah.');

            return self::FAILURE;
        }
        if (User::where('email', $email)->exists()) {
            $this->error('Akun dengan surel ini sudah ada. Kata sandi tidak diubah.');

            return self::FAILURE;
        }

        Organization::firstOrCreate(['is_operator' => true], ['name' => 'Nusa Safety']);

        // Kata sandi acak 24 karakter; hanya ditampilkan di terminal ini dan tidak disimpan di mana pun selain
        // sebagai hash. Pengguna wajib menggantinya dan mengaktifkan verifikasi dua langkah saat pertama masuk.
        $password = Str::password(24, symbols: false);
        $user = User::create(['name' => (string) $this->option('name'), 'email' => $email, 'password' => $password]);
        $user->forceFill(['is_super_admin' => true])->save();
        Audit::record('user.super_admin_created', $user, ['email' => $email]);

        $this->info("Akun pengelola sistem dibuat: {$email}");
        $this->line('Kata sandi awal (catat sekarang, tidak ditampilkan lagi):');
        $this->line($password);
        $this->warn('Segera masuk, ganti kata sandi, dan aktifkan verifikasi dua langkah.');

        return self::SUCCESS;
    }
}
