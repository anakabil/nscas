<?php

namespace App\Http\Controllers\Evidence;

use App\Domain\Access\Permissions;
use App\Domain\Access\Resource;
use App\Domain\Access\Role;
use App\Domain\Evidence\EvidenceRules;
use App\Domain\Files\FileType;
use App\Domain\Setup\UnitTree;
use App\Http\Controllers\Respondents\CollectionController;
use App\Models\Assessment;
use App\Models\Unit;
use App\Services\Evidence\EvidenceService;
use App\Services\Files\ObjectStore;
use App\Services\Respondents\RespondentScope;
use App\Services\Validation\ValidationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as HttpResponse;

/**
 * Halaman bukti dokumen (docs/01 M5). Dilihat asesor, administrator klien, dan koordinator unit (unitnya saja);
 * diunggah administrator klien dan koordinator unit (matriks docs/04 baris "Bukti dan observasi").
 */
class EvidenceController extends CollectionController
{
    public function index(Request $request, Assessment $assessment, EvidenceService $evidence, ValidationService $validation): Response
    {
        $roles = $this->pageRoles($request, $assessment, 'evidence');
        $assessor = in_array(Role::LeadAssessor, $roles, true) || in_array(Role::Assessor, $roles, true);
        $scope = RespondentScope::units($request->user(), $assessment, $roles);
        $units = Unit::where('assessment_id', $assessment->id)->get(['id', 'parent_id', 'name']);
        $flat = UnitTree::flatten($units->map(fn (Unit $u) => ['id' => $u->id, 'parentId' => $u->parent_id, 'name' => $u->name])->all());

        return Inertia::render('evidence/index', [
            ...$this->collectionCommon($assessment, $roles),
            'canEdit' => EvidenceRules::uploadOpen($assessment->status) && Permissions::canWrite($roles, Resource::EvidenceAndObservations),
            'uploadOpen' => EvidenceRules::uploadOpen($assessment->status),
            'scoped' => $scope !== null,
            'units' => array_values(array_map(
                fn (array $u) => ['id' => $u['id'], 'name' => $u['name'], 'depth' => $u['depth']],
                array_filter($flat, fn (array $u) => $scope === null || in_array($u['id'], $scope, true)),
            )),
            'checklist' => $evidence->checklist($assessment, $scope),
            // Pernyataan asesor bahwa bukti satu karakteristik sudah ditinjau (syarat evidence_reviewed, fase R6).
            'canReview' => $assessor && ValidationService::evidenceReviewOpen($assessment->status),
            'reviews' => $assessor ? $validation->evidenceReviews($assessment) : (object) [],
            'items' => $evidence->list($assessment, $scope),
            'maxBytes' => FileType::MAX_UPLOAD_BYTES,
            'urls' => [
                'grant' => route('evidence.uploads', $assessment),
                'finalize' => route('evidence.store', $assessment),
            ],
        ]);
    }

    /** Langkah 1 unggah: izin dan tujuan unggah (JSON). */
    public function grant(Request $request, Assessment $assessment, EvidenceService $evidence): JsonResponse
    {
        $roles = $this->pageRoles($request, $assessment, 'evidence');
        $this->writerFor($roles, Resource::EvidenceAndObservations);
        $data = $request->validate([
            'fileName' => ['required', 'string', 'max:255'],
            'size' => ['required', 'integer', 'min:1'],
            'contentType' => ['nullable', 'string', 'max:200'],
            'title' => ['required', 'string', 'min:2', 'max:300'],
            'description' => ['nullable', 'string', 'max:2000'],
            'unitId' => ['nullable', 'string', 'max:64'],
            'supersedesId' => ['nullable', 'string', 'max:64'],
        ]);

        return response()->json($evidence->requestUpload($assessment, $request->user(), RespondentScope::units($request->user(), $assessment, $roles), [
            'fileName' => trim($data['fileName']),
            'size' => (int) $data['size'],
            'contentType' => (string) ($data['contentType'] ?? ''),
            'title' => trim($data['title']),
            'description' => trim((string) ($data['description'] ?? '')),
            'unitId' => $data['unitId'] ?? null,
            'supersedesId' => $data['supersedesId'] ?? null,
        ]));
    }

    /** Langkah 2 unggah: pemeriksaan isi dan pencatatan bukti (JSON). */
    public function store(Request $request, Assessment $assessment, EvidenceService $evidence): JsonResponse
    {
        $roles = $this->pageRoles($request, $assessment, 'evidence');
        $actor = $this->writerFor($roles, Resource::EvidenceAndObservations);
        $data = $request->validate([
            'ticket' => ['required', 'string', 'max:64'],
            ...$this->linkRules(nullable: true),
        ]);
        $item = $evidence->finalize(
            $assessment,
            $request->user(),
            RespondentScope::units($request->user(), $assessment, $roles),
            $actor,
            $data['ticket'],
            isset($data['links']) ? $this->normalizeLinks($data['links']) : null,
        );

        return response()->json(['id' => $item->id, 'version' => $item->version], 201);
    }

    public function updateLinks(Request $request, Assessment $assessment, string $item, EvidenceService $evidence): RedirectResponse
    {
        $roles = $this->pageRoles($request, $assessment, 'evidence');
        $actor = $this->writerFor($roles, Resource::EvidenceAndObservations);
        $data = $request->validate($this->linkRules(nullable: false));
        $evidence->updateLinks($assessment, RespondentScope::units($request->user(), $assessment, $roles), $actor, $item, $this->normalizeLinks($data['links'] ?? []));

        return back()->with('status', 'saved');
    }

    public function destroy(Request $request, Assessment $assessment, string $item, EvidenceService $evidence): RedirectResponse
    {
        $roles = $this->pageRoles($request, $assessment, 'evidence');
        $actor = $this->writerFor($roles, Resource::EvidenceAndObservations);
        $evidence->delete($assessment, RespondentScope::units($request->user(), $assessment, $roles), $actor, $item);

        return back()->with('status', 'saved');
    }

    /** Unduhan setelah hak akses diperiksa; versi lama dan bukti yang dihapus tetap dapat diunduh yang berhak. */
    public function download(Request $request, Assessment $assessment, string $item, EvidenceService $evidence, ObjectStore $store): HttpResponse
    {
        $roles = $this->pageRoles($request, $assessment, 'evidence');
        $found = $evidence->forDownload($assessment, RespondentScope::units($request->user(), $assessment, $roles), $item);
        abort_if($found === null, 404);

        return $store->download($found->storage_key, $found->file_name, $found->mime_type, $request->boolean('inline'));
    }

    /** @return array<string, list<string>> */
    private function linkRules(bool $nullable): array
    {
        return [
            'links' => [$nullable ? 'nullable' : 'present', 'array', 'max:'.EvidenceService::MAX_LINKS],
            'links.*.characteristicId' => ['required', 'string', 'max:64'],
            'links.*.requirementIds' => ['present', 'array', 'max:'.EvidenceService::MAX_REQUIREMENTS_PER_LINK],
            'links.*.requirementIds.*' => ['string', 'max:64'],
        ];
    }

    /**
     * @param  array<int, array{characteristicId: string, requirementIds?: list<string>}>  $links
     * @return list<array{characteristicId: string, requirementIds: list<string>}>
     */
    private function normalizeLinks(array $links): array
    {
        return array_values(array_map(fn (array $l) => [
            'characteristicId' => (string) $l['characteristicId'],
            'requirementIds' => array_values(array_map('strval', $l['requirementIds'] ?? [])),
        ], $links));
    }

    /** Asesor menandai bukti satu karakteristik sudah ditinjau, atau menarik tanda itu. */
    public function review(Request $request, Assessment $assessment, string $characteristic, ValidationService $validation): RedirectResponse
    {
        $roles = $this->pageRoles($request, $assessment, 'evidence');
        $actor = in_array(Role::LeadAssessor, $roles, true) ? Role::LeadAssessor : (in_array(Role::Assessor, $roles, true) ? Role::Assessor : null);
        abort_if($actor === null, 403);
        $data = $request->validate([
            'reviewed' => ['required', 'boolean'],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);
        $note = trim((string) ($data['note'] ?? ''));
        $validation->reviewEvidence($assessment, $request->user(), $actor, $characteristic, (bool) $data['reviewed'], $note === '' ? null : $note);

        return back()->with('status', 'saved');
    }
}
