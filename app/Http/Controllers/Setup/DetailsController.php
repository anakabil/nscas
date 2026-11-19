<?php

namespace App\Http\Controllers\Setup;

use App\Domain\Setup\ScopeType;
use App\Models\Assessment;
use App\Models\InstrumentVersion;
use App\Services\AssessmentSetup;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Rincian dan lingkup asesmen: nama, lingkup, periode, tingkat sasaran, dan versi instrumen. */
class DetailsController extends SetupController
{
    public function edit(Request $request, Assessment $assessment): Response
    {
        $roles = $this->pageRoles($request, $assessment, 'details');

        return Inertia::render('setup/details', [
            ...$this->common($assessment, $roles),
            'canEdit' => $this->canEditParameters($roles) && ! $assessment->status->parametersLocked(),
            'details' => [
                'name' => $assessment->name,
                'scopeType' => $assessment->scope_type->value,
                'periodStart' => $assessment->period_start->toDateString(),
                'periodEnd' => $assessment->period_end->toDateString(),
                'targetLevel' => $assessment->target_level,
                'instrumentVersionId' => $assessment->instrument_version_id,
            ],
            'instrumentVersions' => self::versionOptions($assessment->instrument_version_id),
        ]);
    }

    public function update(Request $request, Assessment $assessment, AssessmentSetup $setup): RedirectResponse
    {
        $this->requireParameterWriter($this->pageRoles($request, $assessment, 'details'));
        $setup->updateDetails($assessment, self::validated($request));

        return back()->with('status', 'saved');
    }

    /** @return array{name: string, scope_type: string, period_start: string, period_end: string, target_level: int, instrument_version_id: string} */
    public static function validated(Request $request): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:3', 'max:200'],
            'scope_type' => ['required', Rule::enum(ScopeType::class)],
            'period_start' => ['required', 'date_format:Y-m-d'],
            'period_end' => ['required', 'date_format:Y-m-d', 'after_or_equal:period_start'],
            'target_level' => ['required', 'integer', 'between:1,5'],
            'instrument_version_id' => ['required', 'string', 'max:64'],
        ]);
        $data['target_level'] = (int) $data['target_level'];
        $data['name'] = trim($data['name']);

        return $data;
    }

    /**
     * Versi terbit, ditambah versi yang sedang dipakai bila versi itu tidak lagi terbit.
     *
     * @return list<array{id: string, code: string}>
     */
    public static function versionOptions(?string $current = null): array
    {
        return InstrumentVersion::query()
            ->where('status', 'PUBLISHED')
            ->when($current, fn ($q) => $q->orWhere('id', $current))
            ->orderByDesc('published_at')
            ->get(['id', 'code'])
            ->map(fn (InstrumentVersion $v) => ['id' => $v->id, 'code' => $v->code])
            ->all();
    }
}
