<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Perintah pembantu uji ujung ke ujung tidak boleh menyentuh basis data selain basis data e2e. */
class E2eCycleCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_refuses_any_database_not_named_e2e(): void
    {
        $this->artisan('nscas:e2e-cycle', ['step' => 'accounts'])->assertFailed();
        $this->assertDatabaseMissing('users', ['email' => 'utama@e2e.test']);
    }
}
