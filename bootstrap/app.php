<?php

use App\Http\Middleware\EnforceSessionLimits;
use App\Http\Middleware\EnsureAccountIsUsable;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\SecurityHeaders;
use App\Http\Middleware\SetLocale;
use App\Support\RuleViolation;
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
            EnforceSessionLimits::class,
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
        // Pelanggaran aturan bisnis dari layanan: 422 kembali ke formulir dengan pesan pada isian terkait; 409 (data
        // terkunci) dan 403 sebagai halaman galat. Pesan diambil dari lang/<bahasa>/setup.php.
        $exceptions->render(function (RuleViolation $e, Request $request) {
            if ($e->status === 422) {
                return $request->expectsJson()
                    ? response()->json(['message' => __('setup.errors.'.$e->key), 'errors' => [$e->field => [__('setup.errors.'.$e->key)]]], 422)
                    : back()->withErrors([$e->field => __('setup.errors.'.$e->key)])->withInput();
            }

            return $request->expectsJson()
                ? response()->json(['message' => __('setup.errors.'.$e->key), 'code' => $e->key], $e->status)
                : Inertia::render('error', ['status' => $e->status, 'reason' => $e->key])->toResponse($request)->setStatusCode($e->status);
        });

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
            // Permintaan JSON (unggah bukti dan observasi, survei) menerima galat JSON apa adanya.
            if ($request->expectsJson() || ! in_array($status, [403, 404, 409, 429, 500, 503], true) || ($status === 500 && config('app.debug'))) {
                return $response;
            }

            return Inertia::render('error', ['status' => $status])->toResponse($request)->setStatusCode($status);
        });
    })->create();
