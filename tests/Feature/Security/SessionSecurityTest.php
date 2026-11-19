<?php

namespace Tests\Feature\Security;

use App\Domain\Access\Role;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\BuildsAssessments;
use Tests\TestCase;

/**
 * Fase R11 (docs/04 bagian 3 dan 6): penguncian setelah 5 kali gagal masuk dalam 15 menit, batas sesi 8 jam, batas
 * 30 menit tanpa aktivitas untuk pengguna Nusa Safety, dan pencatatan peristiwa akses.
 */
class SessionSecurityTest extends TestCase
{
    use BuildsAssessments, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpAssessmentWorld();
    }

    public function test_five_failed_sign_ins_lock_the_account_for_fifteen_minutes(): void
    {
        $user = $this->member($this->client, Role::ClientAdmin);
        foreach (range(1, 5) as $_) {
            $this->post(route('login.store'), ['email' => $user->email, 'password' => 'salah-sekali'])->assertSessionHasErrors('email');
        }
        // Kata sandi benar pun ditolak selama terkunci.
        $this->post(route('login.store'), ['email' => $user->email, 'password' => 'password'])->assertSessionHasErrors('email');
        $this->assertGuest();
        $this->assertSame(5, AuditLog::where('action', 'auth.login_failed')->count());
        $this->assertSame(1, AuditLog::where('action', 'auth.locked')->where('entity_id', (string) $user->id)->count());
        $this->assertStringContainsString('15', (string) session('errors')->first('email'));

        $this->travel(16)->minutes();
        $this->post(route('login.store'), ['email' => $user->email, 'password' => 'password'])->assertRedirect();
        $this->assertAuthenticatedAs($user);
        $this->assertSame(1, AuditLog::where('action', 'auth.login')->count());
    }

    public function test_successful_sign_ins_do_not_count_towards_the_lock(): void
    {
        $user = $this->member($this->client, Role::ClientAdmin);
        // Kata sandi di-hash dengan argon2id (docs/04 bagian 3).
        $this->assertSame('argon2id', password_get_info($user->password)['algoName']);
        foreach (range(1, 6) as $_) {
            $this->post(route('login.store'), ['email' => $user->email, 'password' => 'password'])->assertRedirect();
            $this->assertAuthenticatedAs($user);
            $this->post(route('logout'));
        }
        $this->assertSame(6, AuditLog::where('action', 'auth.logout')->count());
    }

    public function test_unknown_emails_are_recorded_only_as_a_keyed_hash(): void
    {
        $this->post(route('login.store'), ['email' => 'tidak.ada@contoh.id', 'password' => 'apa-saja'])->assertSessionHasErrors('email');
        $log = AuditLog::where('action', 'auth.login_failed')->sole();
        $this->assertNull($log->entity_id);
        $this->assertStringNotContainsString('tidak.ada', json_encode($log->changes));
        $this->assertSame(64, strlen($log->changes['emailHash']));
    }

    public function test_every_session_ends_after_eight_hours(): void
    {
        $user = $this->member($this->client, Role::ClientAdmin);
        $this->actingAs($user)->get(route('profile.edit'))->assertOk();
        $this->travel(7)->hours();
        $this->get(route('profile.edit'))->assertOk();
        $this->travel(61)->minutes();
        $this->get(route('profile.edit'))->assertRedirect(route('login'))->assertSessionHas('status', 'sessionExpired');
        $this->assertGuest();
        $this->assertSame(['reason' => 'absolute'], AuditLog::where('action', 'auth.session_expired')->sole()->changes);
    }

    public function test_nusa_safety_users_are_signed_out_after_thirty_idle_minutes(): void
    {
        $client = $this->member($this->client, Role::ClientAdmin);
        $this->actingAs($client)->get(route('profile.edit'))->assertOk();
        $this->travel(45)->minutes();
        $this->get(route('profile.edit'))->assertOk();

        $this->app['auth']->forgetGuards();
        $this->flushSession();
        $lead = $this->member($this->operator, Role::LeadAssessor);
        $this->actingAs($lead)->get(route('profile.edit'))->assertOk();
        $this->travel(29)->minutes();
        $this->get(route('profile.edit'))->assertOk();
        $this->travel(29)->minutes();
        $this->get(route('profile.edit'))->assertOk();
        $this->travel(31)->minutes();
        $this->get(route('profile.edit'))->assertRedirect(route('login'))->assertSessionHas('status', 'sessionIdle');
        $this->assertGuest();

        $this->flushSession();
        $admin = User::factory()->create(['is_super_admin' => true]);
        $this->actingAs($admin)->get(route('profile.edit'))->assertOk();
        $this->travel(31)->minutes();
        $this->get(route('profile.edit'))->assertRedirect(route('login'));
    }

    public function test_the_login_page_shows_the_session_message_and_no_remember_option(): void
    {
        $this->withSession(['status' => 'sessionIdle'])->get(route('login'))->assertOk()
            ->assertInertia(fn ($page) => $page->component('auth/login')->where('status', 'sessionIdle'));
    }
}
