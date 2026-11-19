<?php

namespace Tests\Feature;

use Tests\TestCase;

class SecurityHeadersTest extends TestCase
{
    public function test_pages_carry_strict_security_headers(): void
    {
        $response = $this->get(route('login'))->assertOk();
        $csp = (string) $response->headers->get('Content-Security-Policy');

        $this->assertStringContainsString("default-src 'self'", $csp);
        $this->assertMatchesRegularExpression("/script-src 'self' 'nonce-[A-Za-z0-9+\\/=]+'/", $csp);
        $this->assertStringContainsString("frame-ancestors 'none'", $csp);
        $this->assertStringContainsString("object-src 'none'", $csp);
        // Tidak ada sumber pihak ketiga: huruf, skrip, dan gambar hanya dari domain sendiri (aturan 7).
        $this->assertStringNotContainsString('fonts.bunny.net', $csp);
        $this->assertStringNotContainsString('googleapis', $csp);
        $response->assertHeader('X-Frame-Options', 'DENY');
        $response->assertHeader('X-Content-Type-Options', 'nosniff');
        $response->assertHeader('Referrer-Policy', 'no-referrer');
    }
}
