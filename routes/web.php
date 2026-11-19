<?php

use App\Http\Controllers\AccountAreaController;
use App\Http\Controllers\AssessmentController;
use App\Http\Controllers\AssessmentTransitionController;
use App\Http\Controllers\Evidence\EvidenceController;
use App\Http\Controllers\Files\UploadRelayController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\NewAssessmentController;
use App\Http\Controllers\Observations\ObservationController;
use App\Http\Controllers\OrganizationController;
use App\Http\Controllers\Respondents\ParticipationController;
use App\Http\Controllers\Respondents\QrController;
use App\Http\Controllers\Respondents\RespondentController;
use App\Http\Controllers\Respondents\SelfAssessmentController;
use App\Http\Controllers\Respondents\SelfAssessmentFormController;
use App\Http\Controllers\Respondents\SurveyEntryController;
use App\Http\Controllers\Setup\DetailsController;
use App\Http\Controllers\Setup\KickoffController;
use App\Http\Controllers\Setup\ParameterController;
use App\Http\Controllers\Setup\SamplingController;
use App\Http\Controllers\Setup\StratumController;
use App\Http\Controllers\Setup\TeamController;
use App\Http\Controllers\Setup\UnitController;
use App\Http\Controllers\Validation\DataQualityController;
use App\Http\Controllers\Validation\FindingsController;
use App\Http\Controllers\Validation\ValidationController;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\SetLocale;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Http\Request;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Support\Facades\Route;
use Illuminate\Validation\Rule;
use Illuminate\View\Middleware\ShareErrorsFromSession;

// Tidak ada halaman publik: pengunjung langsung ke halaman masuk, pengguna yang sudah masuk ke beranda.
Route::get('/', fn () => redirect()->route(auth()->check() ? 'home' : 'login'))->name('root');

// Pilihan bahasa antarmuka, juga untuk halaman masuk. Pengguna yang sudah masuk menyimpannya di akun (PROMPTS.md R1).
Route::post('locale', function (Request $request) {
    $locale = $request->validate(['locale' => ['required', Rule::in(SetLocale::SUPPORTED)]])['locale'];
    $request->session()->put('locale', $locale);
    $request->user()?->forceFill(['locale' => $locale])->save();

    return back();
})->middleware('throttle:30,1')->name('locale.update');

// Halaman publik responden (fase R2 dan R3): tanpa sesi, sehingga tidak ada baris sesi yang menyimpan alamat IP atau
// peramban responden (aturan 2, docs/04). Kiriman survei tidak memakai token CSRF: hak aksesnya adalah token survei.
Route::withoutMiddleware([StartSession::class, ShareErrorsFromSession::class, PreventRequestForgery::class, SetLocale::class, HandleInertiaRequests::class])
    ->group(function () {
        Route::middleware('throttle:survey')->group(function () {
            Route::get('q/{code}', [SurveyEntryController::class, 'qr'])->where('code', '[A-Za-z0-9_-]{1,64}')->name('survey.qr');
            Route::get('s/{token}', [SurveyEntryController::class, 'show'])->where('token', '[A-Za-z0-9_-]{1,64}')->name('survey.show');
            Route::post('s/{token}/open', [SurveyEntryController::class, 'open'])->where('token', '[A-Za-z0-9_-]{1,64}')->name('survey.open');
            // Penilaian mandiri manajemen bertoken (fase R4); teridentifikasi dan diaudit oleh layanannya.
            Route::get('sa/{token}', [SelfAssessmentFormController::class, 'show'])->where('token', '[A-Za-z0-9_-]{1,64}')->name('self-assessment.show');
            Route::put('sa/{token}/profile', [SelfAssessmentFormController::class, 'profile'])->where('token', '[A-Za-z0-9_-]{1,64}')->name('self-assessment.profile');
            Route::put('sa/{token}/answer', [SelfAssessmentFormController::class, 'answer'])->where('token', '[A-Za-z0-9_-]{1,64}')->name('self-assessment.answer');
            Route::post('sa/{token}/submit', [SelfAssessmentFormController::class, 'submit'])->where('token', '[A-Za-z0-9_-]{1,64}')->name('self-assessment.submit');
        });
        Route::post('s/{token}/submit', [SurveyEntryController::class, 'submit'])->where('token', '[A-Za-z0-9_-]{1,64}')
            ->middleware('throttle:survey-submit')->name('survey.submit');
    });

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

    // Tahap 2. Responden, kode QR, partisipasi (fase R2), dan penilaian mandiri (fase R4).
    Route::prefix('assessments/{assessment}')->group(function () {
        Route::get('respondents', [RespondentController::class, 'index'])->name('respondents.index');
        Route::get('respondents/template', [RespondentController::class, 'template'])->name('respondents.template');
        Route::post('respondents/import', [RespondentController::class, 'import'])->middleware('throttle:30,1')->name('respondents.import');
        Route::post('respondents/links', [RespondentController::class, 'links'])->name('respondents.links');
        Route::post('respondents/invitations', [RespondentController::class, 'invitations'])->name('respondents.invitations');
        Route::put('respondents/window', [RespondentController::class, 'window'])->name('respondents.window');
        Route::post('respondents/window/close', [RespondentController::class, 'closeSurvey'])->name('respondents.window.close');
        Route::post('respondents/coordinators', [RespondentController::class, 'assign'])->name('respondents.coordinators.store');
        Route::delete('respondents/coordinators/{assignment}', [RespondentController::class, 'unassign'])->whereNumber('assignment')->name('respondents.coordinators.destroy');
        Route::get('respondents/qr', [QrController::class, 'index'])->name('qr.index');
        Route::post('respondents/qr', [QrController::class, 'store'])->name('qr.store');
        Route::delete('respondents/qr/{code}', [QrController::class, 'destroy'])->whereAlphaNumeric('code')->name('qr.destroy');
        Route::post('respondents/{entry}/revoke', [RespondentController::class, 'revoke'])->whereAlphaNumeric('entry')->name('respondents.revoke');
        Route::post('respondents/{entry}/reissue', [RespondentController::class, 'reissue'])->whereAlphaNumeric('entry')->name('respondents.reissue');
        Route::get('participation', [ParticipationController::class, 'index'])->name('participation.index');
        Route::get('self-assessments', [SelfAssessmentController::class, 'index'])->name('self-assessments.index');
        Route::post('self-assessments', [SelfAssessmentController::class, 'store'])->name('self-assessments.store');
        Route::get('self-assessments/{selfAssessment}', [SelfAssessmentController::class, 'show'])->whereAlphaNumeric('selfAssessment')->name('self-assessments.show');
        Route::post('self-assessments/{selfAssessment}/revoke', [SelfAssessmentController::class, 'revoke'])->whereAlphaNumeric('selfAssessment')->name('self-assessments.revoke');
        Route::post('self-assessments/{selfAssessment}/reissue', [SelfAssessmentController::class, 'reissue'])->whereAlphaNumeric('selfAssessment')->name('self-assessments.reissue');
        Route::post('self-assessments/{selfAssessment}/email', [SelfAssessmentController::class, 'email'])->whereAlphaNumeric('selfAssessment')->middleware('throttle:30,1')->name('self-assessments.email');

        // Fase R5: bukti dokumen (docs/01 M5).
        Route::get('evidence', [EvidenceController::class, 'index'])->name('evidence.index');
        Route::post('evidence/uploads', [EvidenceController::class, 'grant'])->middleware('throttle:60,1')->name('evidence.uploads');
        Route::post('evidence', [EvidenceController::class, 'store'])->middleware('throttle:60,1')->name('evidence.store');
        Route::put('evidence/{item}/links', [EvidenceController::class, 'updateLinks'])->whereAlphaNumeric('item')->name('evidence.links');
        Route::delete('evidence/{item}', [EvidenceController::class, 'destroy'])->whereAlphaNumeric('item')->name('evidence.destroy');
        Route::get('evidence/{item}/download', [EvidenceController::class, 'download'])->whereAlphaNumeric('item')->name('evidence.download');
        Route::put('evidence/reviews/{characteristic}', [EvidenceController::class, 'review'])->whereAlphaNumeric('characteristic')->name('evidence.reviews');

        // Fase R5: observasi lapangan (docs/01 M6).
        Route::get('observations', [ObservationController::class, 'index'])->name('observations.index');
        Route::post('observations/windows', [ObservationController::class, 'storeWindow'])->name('observations.windows.store');
        Route::get('observations/captures/{capture}/file', [ObservationController::class, 'file'])->whereAlphaNumeric('capture')->name('observations.captures.file');
        Route::get('observations/{window}/capture', [ObservationController::class, 'capture'])->whereAlphaNumeric('window')->name('observations.capture');
        Route::post('observations/{window}/captures/uploads', [ObservationController::class, 'grant'])->whereAlphaNumeric('window')->middleware('throttle:60,1')->name('observations.captures.uploads');
        Route::post('observations/{window}/captures', [ObservationController::class, 'store'])->whereAlphaNumeric('window')->middleware('throttle:60,1')->name('observations.captures.store');
    });

    // Tahap 3. Mutu data, temuan awal, dan validasi lapangan (fase R6).
    Route::prefix('assessments/{assessment}')->group(function () {
        Route::get('data-quality', [DataQualityController::class, 'index'])->name('data-quality.index');
        Route::put('data-quality/responses/{response}/exclusion', [DataQualityController::class, 'exclusion'])->whereUuid('response')->name('data-quality.exclusion');
        Route::put('data-quality/justifications', [DataQualityController::class, 'justify'])->name('data-quality.justify');
        Route::put('data-quality/reviews', [DataQualityController::class, 'review'])->name('data-quality.review');
        Route::get('findings', [FindingsController::class, 'index'])->name('findings.index');
        Route::get('validation', [ValidationController::class, 'index'])->name('validation.index');
        Route::post('validation/proposal', [ValidationController::class, 'propose'])->name('validation.propose');
        Route::post('validation/sessions', [ValidationController::class, 'store'])->name('validation.sessions.store');
        Route::get('validation/sessions/{session}', [ValidationController::class, 'show'])->whereAlphaNumeric('session')->name('validation.sessions.show');
        Route::put('validation/sessions/{session}', [ValidationController::class, 'update'])->whereAlphaNumeric('session')->name('validation.sessions.update');
        Route::put('validation/sessions/{session}/form', [ValidationController::class, 'form'])->whereAlphaNumeric('session')->name('validation.sessions.form');
        Route::post('validation/sessions/{session}/participants', [ValidationController::class, 'addParticipant'])->whereAlphaNumeric('session')->name('validation.participants.store');
        Route::delete('validation/participants/{participant}', [ValidationController::class, 'removeParticipant'])->whereAlphaNumeric('participant')->name('validation.participants.destroy');
        Route::put('validation/guides/{layer}', [ValidationController::class, 'guide'])->where('layer', 'MANAGEMENT|SUPERVISORY|FIELD')->name('validation.guides.update');
        Route::put('validation/feedback', [ValidationController::class, 'feedback'])->name('validation.feedback');
    });

    // Penerima unggahan saat penyimpanan memakai disk lokal; dengan disk s3 peramban mengunggah langsung (fase R5).
    Route::put('uploads/{upload}', UploadRelayController::class)->whereAlphaNumeric('upload')->middleware('throttle:60,1')->name('uploads.relay');

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
