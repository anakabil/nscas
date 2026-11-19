<?php

namespace App\Providers;

use App\Services\Reports\ChromiumPdfRenderer;
use App\Services\Reports\PdfRenderer;
use Carbon\CarbonImmutable;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Fase R10: PDF laporan dari Chromium di server yang sama.
        $this->app->bind(PdfRenderer::class, ChromiumPdfRenderer::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
        $this->configureSurveyRateLimits();
    }

    /**
     * Pembatas laju halaman responden (docs/02 bagian 4 butir 5). Kuncinya HMAC alamat IP dengan kunci aplikasi dan
     * tanggal, sehingga tidak dapat dibalik menjadi alamat dan berganti setiap hari; penghitungnya hanya hidup satu
     * menit di cache. Batasnya longgar karena banyak pekerja di satu lokasi proyek dapat berbagi satu alamat IP saat
     * mengisi bersama setelah safety talk.
     */
    protected function configureSurveyRateLimits(): void
    {
        $key = fn (Request $request): string => hash_hmac('sha256', $request->ip().'|'.now()->format('Y-m-d'), (string) config('app.key'));
        RateLimiter::for('survey', fn (Request $request) => Limit::perMinute(600)->by('survey:'.$key($request)));
        RateLimiter::for('survey-submit', fn (Request $request) => Limit::perMinute(300)->by('survey-submit:'.$key($request)));
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
            // Pemeriksaan "uncompromised" sengaja tidak dipakai: fitur itu memanggil layanan pihak ketiga di luar
            // negeri dari server, sedangkan NSCAS tidak memakai layanan luar tanpa persetujuan tertulis (aturan 7).
            : null,
        );
    }
}
