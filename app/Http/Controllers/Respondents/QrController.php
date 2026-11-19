<?php

namespace App\Http\Controllers\Respondents;

use App\Domain\Access\Permissions;
use App\Domain\Access\Resource;
use App\Domain\Setup\UnitTree;
use App\Models\AccessToken;
use App\Models\Assessment;
use App\Models\Unit;
use App\Models\UnitQrCode;
use App\Services\Respondents\RespondentDistribution;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Kode QR unit untuk pekerja tanpa surel, terutama pekerja penyedia jasa (docs/01 M2). Kode mentah hanya ditampilkan
 * saat dibuat; mencetak ulang berarti membuat kode baru dan kode lama unit itu otomatis dinonaktifkan.
 */
class QrController extends CollectionController
{
    public function index(Request $request, Assessment $assessment): Response
    {
        $roles = $this->pageRoles($request, $assessment, 'qr');
        $units = Unit::where('assessment_id', $assessment->id)->get(['id', 'parent_id', 'name']);
        $issued = AccessToken::where('assessment_id', $assessment->id)->whereNotNull('unit_qr_code_id')
            ->selectRaw('unit_qr_code_id, count(*) as n')->groupBy('unit_qr_code_id')->pluck('n', 'unit_qr_code_id');
        $codes = UnitQrCode::where('assessment_id', $assessment->id)->where('is_active', true)
            ->with(['unit:id,name', 'stratum:id,code'])->orderBy('created_at')->get();

        return Inertia::render('respondents/qr', [
            ...$this->collectionCommon($assessment, $roles),
            'canEdit' => $this->distribution($assessment) === 'open' && Permissions::canWrite($roles, Resource::TokensAndParticipation),
            'units' => array_map(
                fn (array $u) => ['id' => $u['id'], 'name' => $u['name'], 'depth' => $u['depth']],
                UnitTree::flatten($units->map(fn (Unit $u) => ['id' => $u->id, 'parentId' => $u->parent_id, 'name' => $u->name])->all()),
            ),
            'strata' => $assessment->strata()->orderBy('code')->get(['id', 'code', 'name'])->map(fn ($s) => ['id' => $s->id, 'code' => $s->code, 'name' => $s->name])->all(),
            'codes' => $codes->map(fn (UnitQrCode $c) => [
                'id' => $c->id,
                'unit' => $c->unit->name,
                'stratum' => $c->stratum?->code,
                'createdAt' => $c->created_at->toIso8601String(),
                'issued' => (int) ($issued[$c->id] ?? 0),
                'maxIssuance' => $c->max_issuance,
            ])->all(),
            'created' => $request->session()->get('qrCreated'),
        ]);
    }

    public function store(Request $request, Assessment $assessment, RespondentDistribution $service): RedirectResponse
    {
        $actor = $this->writerFor($this->pageRoles($request, $assessment, 'qr'), Resource::TokensAndParticipation);
        $data = $request->validate([
            'unit_id' => ['required', 'string', 'max:26', Rule::exists('units', 'id')->where('assessment_id', $assessment->id)],
            'stratum_id' => ['nullable', 'string', 'max:26', Rule::exists('strata', 'id')->where('assessment_id', $assessment->id)],
            'max_issuance' => ['nullable', 'integer', 'min:1', 'max:100000'],
        ]);
        $qr = $service->createQr($assessment, $data['unit_id'], $data['stratum_id'] ?? null, isset($data['max_issuance']) ? (int) $data['max_issuance'] : null, $actor);
        $svg = (new Writer(new ImageRenderer(new RendererStyle(480, 2), new SvgImageBackEnd)))->writeString($qr['link']);

        return back()->with('qrCreated', [...$qr, 'svg' => $svg]);
    }

    public function destroy(Request $request, Assessment $assessment, string $code, RespondentDistribution $service): RedirectResponse
    {
        $actor = $this->writerFor($this->pageRoles($request, $assessment, 'qr'), Resource::TokensAndParticipation);
        $service->deactivateQr($assessment, $code, $actor);

        return back()->with('status', 'saved');
    }
}
