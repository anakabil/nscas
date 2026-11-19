<?php

namespace Tests\Feature;

use Tests\TestCase;

/**
 * Header proksi (X-Forwarded-*) hanya dipercaya bila TRUSTED_PROXIES mengizinkan pemanggilnya. Di Codespaces dan di
 * belakang penyeimbang beban, aplikasi harus membuat alamat dengan domain publik dan skema HTTPS (docs/08, docs/09).
 */
class TrustedProxiesTest extends TestCase
{
    private const FORWARDED = [
        'X-Forwarded-Proto' => 'https',
        'X-Forwarded-Host' => 'nscas-uji-8000.app.github.dev',
        'X-Forwarded-Port' => '443',
    ];

    protected function tearDown(): void
    {
        putenv('TRUSTED_PROXIES');
        unset($_ENV['TRUSTED_PROXIES'], $_SERVER['TRUSTED_PROXIES']);
        parent::tearDown();
    }

    public function test_forwarded_headers_are_ignored_by_default(): void
    {
        $response = $this->withServerVariables(['REMOTE_ADDR' => '10.20.30.40'])->get('/', self::FORWARDED);

        $this->assertStringStartsWith('http://', (string) $response->headers->get('Location'));
        $this->assertStringNotContainsString('app.github.dev', (string) $response->headers->get('Location'));
        $response->assertHeaderMissing('Strict-Transport-Security');
    }

    public function test_wildcard_trusts_the_calling_proxy(): void
    {
        config(['trustedproxy.proxies' => '*']);

        $this->withServerVariables(['REMOTE_ADDR' => '10.20.30.40'])
            ->get('/', self::FORWARDED)
            ->assertRedirect('https://nscas-uji-8000.app.github.dev/login')
            ->assertHeader('Strict-Transport-Security');
    }

    public function test_comma_separated_list_trusts_a_listed_proxy(): void
    {
        config(['trustedproxy.proxies' => '127.0.0.1, 10.20.0.0/16']);

        $this->withServerVariables(['REMOTE_ADDR' => '10.20.30.40'])
            ->get('/', self::FORWARDED)
            ->assertRedirect('https://nscas-uji-8000.app.github.dev/login');
    }

    public function test_comma_separated_list_ignores_other_callers(): void
    {
        config(['trustedproxy.proxies' => '127.0.0.1, 10.20.0.0/16']);

        $response = $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.10'])->get('/', self::FORWARDED);

        $this->assertStringNotContainsString('app.github.dev', (string) $response->headers->get('Location'));
        $response->assertHeaderMissing('Strict-Transport-Security');
    }

    /**
     * Nilai dari .env baru tersedia setelah aplikasi dimuat. Pengaturan proksi harus dibaca dari konfigurasi pada saat
     * permintaan, bukan dari env() saat kernel dibuat, agar TRUSTED_PROXIES di berkas .env tidak diabaikan diam-diam.
     * Berkas konfigurasi dibaca langsung: memuat ulang aplikasi akan memuat ulang .env dan menimpa nilai uji.
     */
    public function test_configuration_reads_the_environment_value(): void
    {
        $this->assertSame('*', $this->configWith('*')['proxies']);
        $this->assertSame('10.0.0.0/16', $this->configWith('10.0.0.0/16')['proxies']);
        $this->assertNull($this->configWith('')['proxies']);
    }

    /** @return array<string, mixed> */
    private function configWith(string $value): array
    {
        putenv("TRUSTED_PROXIES={$value}");
        $_ENV['TRUSTED_PROXIES'] = $_SERVER['TRUSTED_PROXIES'] = $value;

        return require config_path('trustedproxy.php');
    }
}
