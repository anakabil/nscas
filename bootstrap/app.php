<?php

use App\Http\Middleware\EnsureAccountIsUsable;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\SecurityHeaders;
use App\Http\Middleware\SetLocale;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->web(append: [
            SecurityHeaders::class,
            SetLocale::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);

        // Dipasang per rute (routes/web.php) pada halaman kerja; halaman pengaturan tetap dapat dibuka agar
        // pengguna bisa mengaktifkan verifikasi dua langkah.
        $middleware->alias(['usable' => EnsureAccountIsUsable::class]);

        // Proksi tepercaya diatur di config/trustedproxy.php, bukan di sini: fungsi ini berjalan sebelum .env dimuat,
        // sehingga env() di sini hanya melihat variabel lingkungan sistem dan mengabaikan isi berkas .env.
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // Halaman galat berbahasa Indonesia dengan tampilan NSCAS. Saat pengembangan (APP_DEBUG) galat 500 tetap
        // menampilkan jejak galat bawaan.
        $exceptions->respond(function (Response $response, Throwable $exception, Request $request) {
            $status = $response->getStatusCode();
            if ($status === 419) {
                return back()->with('status', 'session-expired');
            }
            if (! in_array($status, [403, 404, 429, 500, 503], true) || ($status === 500 && config('app.debug'))) {
                return $response;
            }

            return Inertia::render('error', ['status' => $status])->toResponse($request)->setStatusCode($status);
        });
    })->create();
