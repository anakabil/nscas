<?php

use App\Http\Controllers\AccountAreaController;
use App\Http\Controllers\AssessmentController;
use App\Http\Controllers\AssessmentTransitionController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\NewAssessmentController;
use App\Http\Controllers\OrganizationController;
use App\Http\Controllers\Setup\DetailsController;
use App\Http\Controllers\Setup\KickoffController;
use App\Http\Controllers\Setup\ParameterController;
use App\Http\Controllers\Setup\SamplingController;
use App\Http\Controllers\Setup\StratumController;
use App\Http\Controllers\Setup\TeamController;
use App\Http\Controllers\Setup\UnitController;
use App\Http\Middleware\SetLocale;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Validation\Rule;

// Tidak ada halaman publik: pengunjung langsung ke halaman masuk, pengguna yang sudah masuk ke beranda.
Route::get('/', fn () => redirect()->route(auth()->check() ? 'home' : 'login'))->name('root');

// Pilihan bahasa antarmuka, juga untuk halaman masuk. Pengguna yang sudah masuk menyimpannya di akun (PROMPTS.md R1).
Route::post('locale', function (Request $request) {
    $locale = $request->validate(['locale' => ['required', Rule::in(SetLocale::SUPPORTED)]])['locale'];
    $request->session()->put('locale', $locale);
    $request->user()?->forceFill(['locale' => $locale])->save();

    return back();
})->middleware('throttle:30,1')->name('locale.update');

Route::middleware(['auth', 'usable'])->group(function () {
    Route::get('home', HomeController::class)->name('home');

    Route::get('assessments', [AssessmentController::class, 'index'])->name('assessments.index');
    Route::get('assessments/create', [NewAssessmentController::class, 'create'])->name('assessments.create');
    Route::post('assessments', [NewAssessmentController::class, 'store'])->name('assessments.store');
    Route::get('assessments/{assessment}', [AssessmentController::class, 'show'])->name('assessments.show');
    Route::post('assessments/{assessment}/transition', AssessmentTransitionController::class)->name('assessments.transition');

    // Tahap 1. Perencanaan (fase R1). Didaftarkan sebelum rute modul umum agar tidak tertangkap olehnya.
    Route::prefix('assessments/{assessment}/setup')->name('setup.')->group(function () {
        Route::get('/', [DetailsController::class, 'edit'])->name('details');
        Route::put('/', [DetailsController::class, 'update'])->name('details.update');
        Route::get('units', [UnitController::class, 'index'])->name('units');
        Route::post('units', [UnitController::class, 'store'])->name('units.store');
        Route::put('units/{unit}', [UnitController::class, 'update'])->name('units.update');
        Route::delete('units/{unit}', [UnitController::class, 'destroy'])->name('units.destroy');
        Route::get('strata', [StratumController::class, 'index'])->name('strata');
        Route::post('strata', [StratumController::class, 'store'])->name('strata.store');
        Route::put('strata/populations', [StratumController::class, 'populations'])->name('strata.populations');
        Route::put('strata/{stratum}', [StratumController::class, 'update'])->name('strata.update');
        Route::delete('strata/{stratum}', [StratumController::class, 'destroy'])->name('strata.destroy');
        Route::get('parameters', [ParameterController::class, 'edit'])->name('parameters');
        Route::put('parameters', [ParameterController::class, 'update'])->name('parameters.update');
        Route::get('sampling', [SamplingController::class, 'show'])->name('sampling');
        Route::post('sampling', [SamplingController::class, 'store'])->name('sampling.store');
        Route::get('team', [TeamController::class, 'index'])->name('team');
        Route::post('team', [TeamController::class, 'store'])->name('team.store');
        Route::delete('team/{member}', [TeamController::class, 'destroy'])->name('team.destroy');
        Route::get('kickoff', [KickoffController::class, 'edit'])->name('kickoff');
        Route::put('kickoff', [KickoffController::class, 'update'])->name('kickoff.update');
        Route::put('kickoff/calibration', [KickoffController::class, 'calibration'])->name('kickoff.calibration');
    });

    Route::get('assessments/{assessment}/{path}', [AssessmentController::class, 'module'])
        ->where('path', '[a-z][a-z-]*(/[a-z-]+)?')
        ->name('assessments.module');

    Route::get('organizations', [OrganizationController::class, 'index'])->name('organizations.index');
    Route::post('organizations', [OrganizationController::class, 'store'])->name('organizations.store');
    Route::get('organizations/{organization}', [OrganizationController::class, 'show'])->name('organizations.show');
    Route::put('organizations/{organization}', [OrganizationController::class, 'update'])->name('organizations.update');
    Route::post('organizations/{organization}/users', [OrganizationController::class, 'storeUser'])->name('organizations.users.store');
    Route::put('organizations/{organization}/users/{user}', [OrganizationController::class, 'updateUser'])->name('organizations.users.update');
    Route::put('organizations/{organization}/users/{user}/active', [OrganizationController::class, 'setActive'])->name('organizations.users.active');
    Route::post('organizations/{organization}/users/{user}/password', [OrganizationController::class, 'resetPassword'])->name('organizations.users.password');
    Route::get('retention', [AccountAreaController::class, 'pending'])->defaults('area', 'retention')->name('retention.index');
    Route::get('system-status', [AccountAreaController::class, 'systemStatus'])->name('system-status');
});

require __DIR__.'/settings.php';
