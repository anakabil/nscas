<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Vite;
use Symfony\Component\HttpFoundation\Response;

/**
 * Header keamanan untuk semua halaman (docs/04 bagian 5). Skrip dibatasi nonce; tidak ada sumber pihak ketiga.
 * Saat server pengembangan Vite berjalan (berkas public/hot ada), asal Vite diizinkan agar pemuatan panas bekerja.
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $nonce = Vite::useCspNonce();
        $response = $next($request);

        $dev = Vite::isRunningHot() ? ' '.rtrim((string) file_get_contents(public_path('hot'))) : '';
        $devWs = $dev === '' ? '' : ' '.preg_replace('/^http/', 'ws', trim($dev));
        $storage = $this->storageOrigin();

        $csp = implode('; ', [
            "default-src 'self'",
            "script-src 'self' 'nonce-{$nonce}'{$dev}",
            // Atribut style dari React memerlukan 'unsafe-inline'; skrip tetap dibatasi nonce.
            "style-src 'self' 'unsafe-inline'{$dev}",
            "img-src 'self' data: blob:{$storage}",
            "font-src 'self'{$dev}",
            "connect-src 'self'{$dev}{$devWs}{$storage}",
            "media-src 'self' blob:{$storage}",
            "worker-src 'self'",
            "manifest-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
        ]);

        $response->headers->set('Content-Security-Policy', $csp);
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('Referrer-Policy', 'no-referrer');
        $response->headers->set('Permissions-Policy', 'camera=(self), geolocation=(self), microphone=(self), payment=(), usb=()');
        if ($request->isSecure()) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        return $response;
    }

    /** Asal penyimpanan objek (unggah langsung dan pratinjau berkas bertanda tangan), bila dikonfigurasi. */
    private function storageOrigin(): string
    {
        $endpoint = (string) config('filesystems.disks.s3.endpoint');
        $bucket = (string) config('filesystems.disks.s3.bucket');
        if ($endpoint === '' || ! preg_match('#^(https?)://([^/]+)#', $endpoint, $m)) {
            return '';
        }
        $origins = [" {$m[1]}://{$m[2]}"];
        // Gaya virtual-host: bucket menjadi subdomain (bawaan DigitalOcean Spaces).
        if ($bucket !== '' && ! config('filesystems.disks.s3.use_path_style_endpoint')) {
            $origins[] = " {$m[1]}://{$bucket}.{$m[2]}";
        }

        return implode('', $origins);
    }
}
