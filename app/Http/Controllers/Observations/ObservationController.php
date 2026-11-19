<?php

namespace App\Http\Controllers\Observations;

use App\Domain\Access\Permissions;
use App\Domain\Access\Resource;
use App\Domain\Access\Role;
use App\Domain\Files\FileType;
use App\Domain\Observations\ObservationRules;
use App\Domain\Setup\UnitTree;
use App\Http\Controllers\Respondents\CollectionController;
use App\Models\Assessment;
use App\Models\Organization;
use App\Models\Unit;
use App\Services\Files\ObjectStore;
use App\Services\Observations\ObservationService;
use App\Services\Respondents\RespondentScope;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

/**
 * Observasi lapangan (docs/01 M6). Masa observasi dibuka asesor utama atau asesor (sama dengan v1
 * OBSERVATION_WINDOW_WRITE_ROLES); rekaman diambil administrator klien atau koordinator unit (unitnya saja) dari
 * kamera di dalam aplikasi; seluruh peran baca matriks docs/04 melihat galeri rekaman.
 */
class ObservationController extends CollectionController
{
    public function index(Request $request, Assessment $assessment, ObservationService $observations): Response
    {
        $roles = $this->pageRoles($request, $assessment, 'observations');
        $scope = RespondentScope::units($request->user(), $assessment, $roles);
        $units = Unit::where('assessment_id', $assessment->id)->get(['id', 'parent_id', 'name', 'type', 'latitude', 'longitude', 'radius_meters'])->keyBy('id');
        $flat = UnitTree::flatten($units->map(fn (Unit $u) => ['id' => $u->id, 'parentId' => $u->parent_id, 'name' => $u->name])->values()->all());

        return Inertia::render('observations/index', [
            ...$this->collectionCommon($assessment, $roles),
            'canCreate' => $this->windowCreator($roles) !== null && ObservationRules::statusAllows($assessment->status),
            'canCapture' => Permissions::canWrite($roles, Resource::EvidenceAndObservations),
            'statusAllows' => ObservationRules::statusAllows($assessment->status),
            'scoped' => $scope !== null,
            'units' => array_map(function (array $u) use ($units) {
                $unit = $units[$u['id']];

                return [
                    'id' => $u['id'],
                    'name' => $u['name'],
                    'depth' => $u['depth'],
                    'latitude' => $unit->latitude === null ? null : (float) $unit->latitude,
                    'longitude' => $unit->longitude === null ? null : (float) $unit->longitude,
                    'radiusMeters' => $unit->radius_meters,
                ];
            }, $flat),
            'windows' => $observations->list($assessment, $scope),
        ]);
    }

    public function storeWindow(Request $request, Assessment $assessment, ObservationService $observations): RedirectResponse
    {
        $actor = $this->windowCreator($this->pageRoles($request, $assessment, 'observations'));
        abort_if($actor === null, 403);
        $data = $request->validate([
            'unit_id' => ['required', 'string', 'max:26'],
            'title' => ['required', 'string', 'min:'.ObservationRules::TITLE_MIN, 'max:'.ObservationRules::TITLE_MAX],
            'opens_at' => ['required', 'date_format:Y-m-d\TH:i'],
            'closes_at' => ['required', 'date_format:Y-m-d\TH:i'],
            'checklist' => ['required', 'string', 'max:20000'],
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'radius_meters' => ['required', 'integer', 'between:'.ObservationRules::RADIUS_MIN.','.ObservationRules::RADIUS_MAX],
        ]);
        $observations->createWindow($assessment, $request->user(), $actor, [
            'unitId' => $data['unit_id'],
            'title' => trim($data['title']),
            'opensAt' => CarbonImmutable::createFromFormat('Y-m-d\TH:i', $data['opens_at'], 'Asia/Jakarta'),
            'closesAt' => CarbonImmutable::createFromFormat('Y-m-d\TH:i', $data['closes_at'], 'Asia/Jakarta'),
            'checklist' => $data['checklist'],
            'latitude' => (float) $data['latitude'],
            'longitude' => (float) $data['longitude'],
            'radiusMeters' => (int) $data['radius_meters'],
        ]);

        return back()->with('status', 'saved');
    }

    /** Halaman kamera untuk satu masa observasi: hanya pengambil rekaman yang unitnya mencakup masa observasi itu. */
    public function capture(Request $request, Assessment $assessment, string $window, ObservationService $observations): Response
    {
        $roles = $this->pageRoles($request, $assessment, 'observations');
        $this->writerFor($roles, Resource::EvidenceAndObservations);
        $found = $observations->windowFor($assessment, RespondentScope::units($request->user(), $assessment, $roles), $window);
        abort_if($found === null, 404);
        $counts = $observations->countsByItem($found);

        return Inertia::render('observations/capture', [
            'assessment' => ['id' => $assessment->id, 'name' => $assessment->name],
            'organization' => Organization::whereKey($assessment->organization_id)->value('name'),
            'window' => [
                'id' => $found->id,
                'title' => $found->title,
                'unitName' => $found->unit->name,
                'opensAt' => $found->opens_at->toIso8601String(),
                'closesAt' => $found->closes_at->toIso8601String(),
                'open' => ObservationRules::windowOpen($assessment->status, $found->opens_at, $found->closes_at, now()),
                'radiusMeters' => $found->radius_meters,
            ],
            'checklist' => array_map(fn (array $c) => [...$c, 'count' => $counts[$c['code']] ?? 0], $found->checklist),
            'maxBytes' => FileType::MAX_UPLOAD_BYTES,
            'urls' => [
                'grant' => route('observations.captures.uploads', [$assessment, $found->id]),
                'finalize' => route('observations.captures.store', [$assessment, $found->id]),
                'back' => route('observations.index', $assessment),
            ],
        ]);
    }

    /** Langkah 1 unggah rekaman (JSON). */
    public function grant(Request $request, Assessment $assessment, string $window, ObservationService $observations): JsonResponse
    {
        $roles = $this->pageRoles($request, $assessment, 'observations');
        $this->writerFor($roles, Resource::EvidenceAndObservations);
        $data = $request->validate([
            'checklistItemCode' => ['required', 'string', 'max:8'],
            'contentType' => ['required', 'string', 'max:100'],
            'size' => ['required', 'integer', 'min:1'],
            'location' => ['nullable', 'array'],
            'location.latitude' => ['required_with:location', 'numeric', 'between:-90,90'],
            'location.longitude' => ['required_with:location', 'numeric', 'between:-180,180'],
            'location.accuracy' => ['required_with:location', 'numeric', 'between:0,100000'],
        ]);
        $location = isset($data['location']) ? [
            'latitude' => (float) $data['location']['latitude'],
            'longitude' => (float) $data['location']['longitude'],
            'accuracy' => (float) $data['location']['accuracy'],
        ] : null;

        return response()->json($observations->requestCapture($assessment, $request->user(), RespondentScope::units($request->user(), $assessment, $roles), $window, [
            'checklistItemCode' => $data['checklistItemCode'],
            // Jenis tanpa parameter, misalnya "video/webm;codecs=vp9" menjadi "video/webm".
            'contentType' => strtolower(trim(explode(';', $data['contentType'])[0])),
            'size' => (int) $data['size'],
            'location' => $location,
        ]));
    }

    /** Langkah 2 unggah rekaman (JSON). */
    public function store(Request $request, Assessment $assessment, string $window, ObservationService $observations): JsonResponse
    {
        $roles = $this->pageRoles($request, $assessment, 'observations');
        $actor = $this->writerFor($roles, Resource::EvidenceAndObservations);
        $data = $request->validate([
            'ticket' => ['required', 'string', 'max:64'],
            'note' => ['nullable', 'string', 'max:'.ObservationRules::NOTE_MAX],
        ]);
        $capture = $observations->finalizeCapture($assessment, $request->user(), RespondentScope::units($request->user(), $assessment, $roles), $actor, $data['ticket'], (string) ($data['note'] ?? ''));

        return response()->json([
            'id' => $capture->id,
            'serverCapturedAt' => $capture->server_captured_at->toIso8601String(),
            'outsideRadius' => $capture->outside_radius,
            'distanceMeters' => $capture->distance_meters === null ? null : (int) round($capture->distance_meters),
        ], 201);
    }

    /** Berkas rekaman setelah hak akses diperiksa; ditampilkan langsung untuk galeri. */
    public function file(Request $request, Assessment $assessment, string $capture, ObservationService $observations, ObjectStore $store): HttpResponse
    {
        $roles = $this->pageRoles($request, $assessment, 'observations');
        $found = $observations->captureForDownload($assessment, RespondentScope::units($request->user(), $assessment, $roles), $capture);
        abort_if($found === null, 404);
        $name = 'observasi-'.$found->checklist_item_code.'-'.$found->server_captured_at->setTimezone('Asia/Jakarta')->format('Ymd-His').'.'.FileType::extensionFor($found->mime_type);

        return $store->download($found->storage_key, $name, $found->mime_type, ! $request->boolean('download'));
    }

    /**
     * Pembuka masa observasi: asesor utama atau asesor asesmen ini.
     *
     * @param  list<Role>  $roles
     */
    private function windowCreator(array $roles): ?Role
    {
        foreach ([Role::LeadAssessor, Role::Assessor] as $role) {
            if (in_array($role, $roles, true)) {
                return $role;
            }
        }

        return null;
    }
}
