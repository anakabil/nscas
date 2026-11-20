<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Akun yang dibuat sebelum hash kata sandi beralih ke argon2id (fase R11) tetap dapat masuk, dan hash-nya diperbarui
 * ke argon2id saat itu juga. Sebelumnya, Laravel menolak hash bcrypt dengan galat server 500.
 */
class LegacyPasswordHashTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_bcrypt_password_still_signs_in_and_is_upgraded_to_argon2id(): void
    {
        $user = User::factory()->create();
        DB::table('users')->where('id', $user->id)->update(['password' => password_hash('TinjauLokal2026', PASSWORD_BCRYPT, ['cost' => 4])]);

        $this->post(route('login.store'), ['email' => $user->email, 'password' => 'TinjauLokal2026'])->assertRedirect();
        $this->assertAuthenticatedAs($user->fresh());
        $this->assertSame('argon2id', password_get_info((string) DB::table('users')->where('id', $user->id)->value('password'))['algoName']);
    }

    public function test_a_wrong_password_on_a_bcrypt_account_is_rejected_without_a_server_error(): void
    {
        $user = User::factory()->create();
        DB::table('users')->where('id', $user->id)->update(['password' => password_hash('TinjauLokal2026', PASSWORD_BCRYPT, ['cost' => 4])]);

        $this->post(route('login.store'), ['email' => $user->email, 'password' => 'salah-sekali'])->assertSessionHasErrors('email');
        $this->assertGuest();
    }
}
