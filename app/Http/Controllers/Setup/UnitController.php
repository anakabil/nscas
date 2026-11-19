<?php

namespace App\Http\Controllers\Setup;

use App\Domain\Setup\UnitTree;
use App\Domain\Setup\UnitType;
use App\Models\Assessment;
use App\Models\Unit;
use App\Services\AssessmentSetup;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Unit yang diukur, bertingkat, dengan koordinat untuk proyek. Tetap dapat diubah setelah dikunci (sama dengan v1). */
class UnitController extends SetupController
{
    public function index(Request $request, Assessment $assessment): Response
    {
        $roles = $this->pageRoles($request, $assessment, 'units');
        $units = $assessment->units()->get()->map(fn (Unit $u) => [
            'id' => $u->id,
            'parentId' => $u->parent_id,
            'name' => $u->name,
            'type' => $u->type->value,
            'latitude' => $u->latitude === null ? null : (float) $u->latitude,
            'longitude' => $u->longitude === null ? null : (float) $u->longitude,
            'radiusMeters' => $u->radius_meters,
        ])->all();

        return Inertia::render('setup/units', [
            ...$this->common($assessment, $roles),
            'canEdit' => $this->canEditParameters($roles) && ! $assessment->status->isClosed(),
            'units' => UnitTree::flatten($units),
        ]);
    }

    public function store(Request $request, Assessment $assessment, AssessmentSetup $setup): RedirectResponse
    {
        $this->requireParameterWriter($this->pageRoles($request, $assessment, 'units'));
        $setup->createUnit($assessment, $this->validated($request));

        return back()->with('status', 'saved');
    }

    public function update(Request $request, Assessment $assessment, Unit $unit, AssessmentSetup $setup): RedirectResponse
    {
        $this->requireParameterWriter($this->pageRoles($request, $assessment, 'units'));
        abort_unless($unit->assessment_id === $assessment->id, 404);
        $setup->updateUnit($assessment, $unit, $this->validated($request));

        return back()->with('status', 'saved');
    }

    public function destroy(Request $request, Assessment $assessment, Unit $unit, AssessmentSetup $setup): RedirectResponse
    {
        $this->requireParameterWriter($this->pageRoles($request, $assessment, 'units'));
        abort_unless($unit->assessment_id === $assessment->id, 404);
        $setup->deleteUnit($assessment, $unit);

        return back()->with('status', 'saved');
    }

    /** @return array{name: string, type: string, parent_id: string|null, latitude: float|null, longitude: float|null, radius_meters: int|null} */
    private function validated(Request $request): array
    {
        $request->merge(array_map(
            fn ($v) => is_string($v) ? str_replace(',', '.', trim($v)) : $v,
            $request->only(['latitude', 'longitude']),
        ));

        return $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:200'],
            'type' => ['required', Rule::enum(UnitType::class)],
            'parent_id' => ['nullable', 'string', 'max:64'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'radius_meters' => ['nullable', 'integer', 'between:10,10000'],
        ]) + ['parent_id' => null, 'latitude' => null, 'longitude' => null, 'radius_meters' => null];
    }
}
