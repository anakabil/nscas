<?php

namespace Tests\Feature\Setup;

use App\Domain\Access\Role;
use App\Models\AuditLog;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\BuildsAssessments;
use Tests\TestCase;

/** Organisasi dan pengguna (PROMPTS.md R1 butir 1). */
class OrganizationAdminTest extends TestCase
{
    use BuildsAssessments, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpAssessmentWorld();
    }

    public function test_super_admin_creates_a_client_organisation_and_an_account_with_a_temporary_password(): void
    {
        $superAdmin = User::factory()->create(['is_super_admin' => true]);

        $this->actingAs($superAdmin)->post(route('organizations.store'), ['name' => 'PT Baru', 'legal_name' => 'PT Baru Tbk.'])->assertRedirect();
        $organization = Organization::where('name', 'PT Baru')->sole();
        $this->assertFalse($organization->is_operator);

        $response = $this->actingAs($superAdmin)->post(route('organizations.users.store', $organization), [
            'name' => 'Admin Baru', 'email' => 'Admin.Baru@Contoh.test', 'roles' => ['CLIENT_ADMIN'],
        ]);
        $response->assertSessionHas('temporaryPassword');
        $password = session('temporaryPassword')['password'];
        $user = User::where('email', 'admin.baru@contoh.test')->sole();
        $this->assertTrue($user->must_change_password);
        $this->assertTrue(Hash::check($password, $user->password));
        $this->assertSame([Role::ClientAdmin], $user->memberships->pluck('role')->all());

        $audit = AuditLog::where('action', 'user.create')->sole();
        $this->assertStringNotContainsString($password, json_encode($audit->changes));
    }

    public function test_roles_are_never_filled_automatically_and_must_fit_the_organisation(): void
    {
        $superAdmin = User::factory()->create(['is_super_admin' => true]);

        $this->actingAs($superAdmin)->post(route('organizations.users.store', $this->client), ['name' => 'Tanpa Peran', 'email' => 'a@contoh.test'])
            ->assertSessionHasErrors('roles');
        $this->actingAs($superAdmin)->post(route('organizations.users.store', $this->client), [
            'name' => 'Salah Peran', 'email' => 'b@contoh.test', 'roles' => ['LEAD_ASSESSOR'],
        ])->assertSessionHasErrors('roles');
        $this->actingAs($superAdmin)->post(route('organizations.users.store', $this->operator), [
            'name' => 'Asesor', 'email' => 'c@contoh.test', 'roles' => ['ASSESSOR'],
        ])->assertSessionHasNoErrors();
        $this->assertSame(1, User::where('email', 'c@contoh.test')->count());
        $this->assertSame(0, User::whereIn('email', ['a@contoh.test', 'b@contoh.test'])->count());
    }

    public function test_temporary_password_must_be_changed_before_working(): void
    {
        $user = $this->member($this->client, Role::ClientAdmin);
        $user->forceFill(['must_change_password' => true, 'password' => 'Sementara123'])->save();

        $this->actingAs($user)->get(route('home'))->assertRedirect(route('security.edit'));
        $this->actingAs($user)->withSession(['auth.password_confirmed_at' => time()])->get(route('security.edit'))
            ->assertInertia(fn (Assert $page) => $page->where('mustChangePassword', true));
        $this->actingAs($user)->put(route('user-password.update'), [
            'current_password' => 'Sementara123', 'password' => 'KataSandiBaru!2026', 'password_confirmation' => 'KataSandiBaru!2026',
        ])->assertSessionHasNoErrors();
        $this->assertFalse($user->fresh()->must_change_password);
        $this->actingAs($user->fresh())->get(route('home'))->assertOk();
    }

    public function test_client_admin_manages_only_client_accounts_in_their_own_organisation(): void
    {
        $admin = $this->member($this->client, Role::ClientAdmin);
        $other = Organization::factory()->create();

        $this->actingAs($admin)->get(route('organizations.index'))
            ->assertInertia(fn (Assert $page) => $page->has('organizations', 1)->where('canCreate', false));
        $this->actingAs($admin)->post(route('organizations.users.store', $this->client), [
            'name' => 'Koordinator', 'email' => 'koor@contoh.test', 'roles' => ['UNIT_COORDINATOR'],
        ])->assertSessionHasNoErrors();
        $this->actingAs($admin)->post(route('organizations.users.store', $this->client), [
            'name' => 'Asesor Palsu', 'email' => 'palsu@contoh.test', 'roles' => ['ASSESSOR'],
        ])->assertSessionHasErrors('roles');
        $this->actingAs($admin)->get(route('organizations.show', $other))->assertNotFound();
        $this->actingAs($admin)->post(route('organizations.users.store', $other), [
            'name' => 'X', 'email' => 'x@contoh.test', 'roles' => ['EXECUTIVE_VIEWER'],
        ])->assertNotFound();
        $this->actingAs($admin)->post(route('organizations.store'), ['name' => 'PT Liar'])->assertForbidden();
    }

    public function test_accounts_are_deactivated_not_deleted_and_signed_out(): void
    {
        $admin = $this->member($this->client, Role::ClientAdmin);
        $viewer = $this->member($this->client, Role::ExecutiveViewer);

        $this->actingAs($admin)->put(route('organizations.users.active', [$this->client, $admin]), ['active' => false])->assertSessionHasErrors('user');
        $this->actingAs($admin)->put(route('organizations.users.active', [$this->client, $viewer]), ['active' => false])->assertSessionHasNoErrors();
        $this->assertFalse($viewer->fresh()->is_active);
        $this->assertTrue(User::whereKey($viewer->id)->exists());
        $this->actingAs($viewer->fresh())->get(route('home'))->assertRedirect(route('login'));
        $this->assertTrue(AuditLog::where('action', 'user.deactivate')->exists());
    }

    public function test_lead_assessor_can_view_but_not_manage_organisations(): void
    {
        $lead = $this->member($this->operator, Role::LeadAssessor);

        $this->actingAs($lead)->get(route('organizations.show', $this->client))
            ->assertOk()->assertInertia(fn (Assert $page) => $page->where('canManageUsers', false)->where('roleOptions', []));
        $this->actingAs($lead)->post(route('organizations.users.store', $this->client), [
            'name' => 'X', 'email' => 'x@contoh.test', 'roles' => ['EXECUTIVE_VIEWER'],
        ])->assertForbidden();
    }

    public function test_chosen_language_is_saved_on_the_account(): void
    {
        $user = $this->member($this->client, Role::ExecutiveViewer);

        $this->actingAs($user)->post(route('locale.update'), ['locale' => 'en'])->assertRedirect();

        $this->assertSame('en', $user->fresh()->locale);
        $this->actingAs($user->fresh())->get(route('home'))->assertInertia(fn (Assert $page) => $page->where('locale', 'en'));
    }
}
