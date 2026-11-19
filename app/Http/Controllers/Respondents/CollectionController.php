<?php

namespace App\Http\Controllers\Respondents;

use App\Domain\Access\Permissions;
use App\Domain\Access\Resource;
use App\Domain\Access\Role;
use App\Domain\Navigation\ModuleCatalog;
use App\Domain\Respondents\SurveyWindow;
use App\Http\Controllers\Setup\SetupController;
use App\Http\Presenters\AssessmentPresenter;
use App\Models\Assessment;

/**
 * Dasar halaman tahap 2: responden, kode QR, partisipasi (fase R2), penilaian mandiri (fase R4), serta bukti dan
 * observasi (fase R5). Hak buka mengikuti katalog modul (matriks
 * docs/04); hak ubah diperiksa terpisah pada setiap aksi. Distribusi terbuka setelah parameter dikunci dan selama
 * pengumpulan data.
 */
abstract class CollectionController extends SetupController
{
    private const TABS = [
        'respondents' => 'respondents',
        'qr' => 'respondents/qr',
        'participation' => 'participation',
        'selfAssessments' => 'self-assessments',
        'evidence' => 'evidence',
        'observations' => 'observations',
    ];

    /**
     * @param  list<Role>  $roles
     * @return array<string, mixed>
     */
    protected function collectionCommon(Assessment $assessment, array $roles): array
    {
        $assessment->loadMissing('organization');
        $visible = collect(ModuleCatalog::all($assessment->status))->filter(fn ($m) => $m->visibleTo($roles))->pluck('key')->all();
        $tabs = $this->tabMap();

        return [
            'assessment' => AssessmentPresenter::menu($assessment, $roles),
            'stage' => $this->stageKey(),
            'tabs' => array_values(array_map(
                fn (string $key) => ['key' => $key, 'href' => route('assessments.module', ['assessment' => $assessment, 'path' => $tabs[$key]])],
                array_filter(array_keys($tabs), fn (string $key) => in_array($key, $visible, true)),
            )),
            'distribution' => $this->distribution($assessment),
            'window' => [
                'opensAt' => $assessment->survey_opens_at?->toIso8601String(),
                'closesAt' => $assessment->survey_closes_at?->toIso8601String(),
                'open' => SurveyWindow::isOpen($assessment->status, $assessment->survey_opens_at, $assessment->survey_closes_at, now()),
            ],
        ];
    }

    /** @return array<string, string> kunci modul ke jalur halaman */
    protected function tabMap(): array
    {
        return self::TABS;
    }

    /** Kunci teks label tahap pada kepala halaman. */
    protected function stageKey(): string
    {
        return 'collection';
    }

    /** 'notYet' sebelum dikunci, 'open' saat dikunci atau mengumpulkan data, 'closed' sesudahnya. */
    protected function distribution(Assessment $assessment): string
    {
        return match (true) {
            ! $assessment->status->parametersLocked() => 'notYet',
            SurveyWindow::distributionOpen($assessment->status) => 'open',
            default => 'closed',
        };
    }

    /**
     * Peran pelaku untuk perubahan atas sumber daya ini, atau 403. Peran dengan hak paling luas didahulukan untuk
     * jejak audit.
     *
     * @param  list<Role>  $roles
     */
    protected function writerFor(array $roles, Resource $resource): Role
    {
        foreach (Role::byPrecedence() as $role) {
            if (in_array($role, $roles, true) && Permissions::canWrite([$role], $resource)) {
                return $role;
            }
        }
        abort(403);
    }

    /**
     * Masa survei diatur asesor utama atau administrator klien (sama dengan v1 SURVEY_WINDOW_WRITE_ROLES).
     *
     * @param  list<Role>  $roles
     */
    protected function windowWriter(array $roles): ?Role
    {
        foreach ([Role::LeadAssessor, Role::ClientAdmin] as $role) {
            if (in_array($role, $roles, true)) {
                return $role;
            }
        }

        return null;
    }
}
