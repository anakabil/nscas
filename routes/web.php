<?php

use App\Http\Controllers\AccountAreaController;
use App\Http\Controllers\AssessmentController;
use App\Http\Controllers\HomeController;
use App\Http\Middleware\SetLocale;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Validation\Rule;

// Tidak ada halaman publik: pengunjung langsung ke halaman masuk, pengguna yang sudah masuk ke beranda.
Route::get('/', fn () => redirect()->route(auth()->check() ? 'home' : 'login'))->name('root');

// Pilihan bahasa antarmuka, juga untuk halaman masuk.
Route::post('locale', function (Request $request) {
    $request->session()->put('locale', $request->validate(['locale' => ['required', Rule::in(SetLocale::SUPPORTED)]])['locale']);

    return back();
})->middleware('throttle:30,1')->name('locale.update');

Route::middleware(['auth', 'usable'])->group(function () {
    Route::get('home', HomeController::class)->name('home');

    Route::get('assessments', [AssessmentController::class, 'index'])->name('assessments.index');
    Route::get('assessments/create', [AccountAreaController::class, 'pending'])->defaults('area', 'newAssessment')->name('assessments.create');
    Route::get('assessments/{assessment}', [AssessmentController::class, 'show'])->name('assessments.show');
    Route::get('assessments/{assessment}/{path}', [AssessmentController::class, 'module'])
        ->where('path', '[a-z][a-z-]*(/[a-z-]+)?')
        ->name('assessments.module');

    Route::get('organizations', [AccountAreaController::class, 'pending'])->defaults('area', 'organizations')->name('organizations.index');
    Route::get('retention', [AccountAreaController::class, 'pending'])->defaults('area', 'retention')->name('retention.index');
    Route::get('system-status', [AccountAreaController::class, 'systemStatus'])->name('system-status');
});

require __DIR__.'/settings.php';
