<?php

namespace App\Http\Controllers\Respondents;

use App\Domain\Access\Resource;
use App\Domain\Setup\UnitTree;
use App\Models\Assessment;
use App\Services\Respondents\ParticipationReport;
use App\Services\Respondents\RespondentScope;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Partisipasi per strata dan unit, serta tren harian (docs/01 M2). Dihitung dari token, tidak dari jawaban; jumlah
 * selesai di bawah ambang sel disembunyikan (aturan 3). Koordinator unit hanya melihat unitnya dan tanpa tren.
 */
class ParticipationController extends CollectionController
{
    public function index(Request $request, Assessment $assessment): Response
    {
        $roles = $this->pageRoles($request, $assessment, 'participation');
        $scope = RespondentScope::units($request->user(), $assessment, $roles, Resource::TokensAndParticipation);
        $report = ParticipationReport::for($assessment, $scope);
        // Urutan pohon unit (induk lalu anaknya) beserta kedalamannya untuk tampilan bertingkat.
        $byId = array_column($report['summary']['units'], null, 'unitId');
        $units = array_map(fn (array $u) => [...$byId[$u['id']], 'depth' => $u['depth']], UnitTree::flatten(array_map(
            fn (array $u) => ['id' => $u['unitId'], 'parentId' => $u['parentId'], 'name' => $u['name']],
            array_values($byId),
        )));

        return Inertia::render('respondents/participation', [
            ...$this->collectionCommon($assessment, $roles),
            'scoped' => $scope !== null,
            'minCell' => $report['minCell'],
            'minParticipation' => $report['minParticipation'],
            'summary' => [
                ...$report['summary'],
                'units' => $units,
            ],
            'trend' => $report['trend'],
            'surveyTarget' => $assessment->parameter_snapshot['samplePlan']['result']['surveyTargetTotal'] ?? null,
        ]);
    }
}
