<?php

namespace App\Http\Controllers\Setup;

use App\Domain\Setup\ConsentTemplate;
use App\Domain\Setup\DpaStatus;
use App\Domain\Setup\EditableParameters;
use App\Models\Assessment;
use App\Models\InstrumentVersion;
use App\Services\AssessmentSetup;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Parameter asesmen, teks persetujuan responden, dan status perjanjian pemrosesan data. Setelah dikunci, nilai dibaca
 * dari snapshot dan formulir menjadi baca saja; perubahan lewat permintaan langsung ditolak 409 (docs/01 M1).
 */
class ParameterController extends SetupController
{
    public function edit(Request $request, Assessment $assessment): Response
    {
        $roles = $this->pageRoles($request, $assessment, 'parameters');
        $locked = $assessment->status->parametersLocked();
        // Setelah dikunci nilai dibaca dari snapshot; asesmen tanpa snapshot (data lama) memakai draf atau bawaan.
        $draft = ($locked ? ($assessment->parameter_snapshot['parameters'] ?? null) : null)
            ?? $assessment->parameter_draft
            ?? EditableParameters::draftFromDefaults($this->defaults($assessment));
        $months = (int) ($draft['retention']['rawDataMonths'] ?? 36);
        $organization = $assessment->organization->name;

        return Inertia::render('setup/parameters', [
            ...$this->common($assessment, $roles),
            'canEdit' => $this->canEditParameters($roles) && ! $locked,
            'parameters' => EditableParameters::editablePart($draft),
            'aspectWeights' => EditableParameters::aspectWeights($draft),
            'retentionMonths' => $months,
            'consent' => ['id' => (string) $assessment->consent_text_id, 'en' => (string) $assessment->consent_text_en],
            'consentTemplates' => [
                'id' => ConsentTemplate::render('id', $organization, (string) config('nscas.data_location'), $months),
                'en' => ConsentTemplate::render('en', $organization, (string) config('nscas.data_location_en'), $months),
            ],
            'dataLocation' => (string) config('nscas.data_location'),
            'dpa' => [
                'status' => $assessment->dpa_status->value,
                'reference' => $assessment->dpa_reference,
                'signedOn' => $assessment->dpa_signed_on?->toDateString(),
            ],
        ]);
    }

    /** @return array<string, mixed> */
    private function defaults(Assessment $assessment): array
    {
        return ($assessment->instrumentVersion ?? InstrumentVersion::where('status', 'PUBLISHED')->latest('published_at')->firstOrFail())
            ->default_parameters;
    }

    public function update(Request $request, Assessment $assessment, AssessmentSetup $setup): RedirectResponse
    {
        $this->requireParameterWriter($this->pageRoles($request, $assessment, 'parameters'));
        // Angka desimal boleh memakai koma, sesuai kebiasaan penulisan Indonesia.
        $request->replace($this->normalizeDecimals($request->all()));
        $unit = ['required', 'numeric', 'between:0,1'];
        $distance = ['required', 'numeric', 'between:0,4'];
        $data = $request->validate([
            'parameters.layerWeights.perception' => $unit,
            'parameters.layerWeights.evidence' => $unit,
            'parameters.layerWeights.validation' => $unit,
            'parameters.selfAssessmentWeightInPerception' => $unit,
            'parameters.divergenceThreshold' => $distance,
            'parameters.consolidation.maxAspectBelowLevel' => $distance,
            'parameters.consolidation.maxCharacteristicBelowLevel' => $distance,
            'parameters.perceptionGapAttention' => $distance,
            'parameters.assessorDisagreementFlag' => $distance,
            'parameters.sclThresholds' => ['required', 'array', 'size:4'],
            'parameters.sclThresholds.*.step' => ['required', 'integer', 'between:2,5'],
            'parameters.sclThresholds.*.minWeightedAverage' => $unit,
            'parameters.sclThresholds.*.minPerAspect' => $unit,
            'parameters.quality.cronbachAlphaMin' => $unit,
            'parameters.quality.rwgMin' => $unit,
            'parameters.quality.minRespondentsPerReportCell' => ['required', 'integer', 'between:5,50'],
            'parameters.sampling.z' => ['required', 'numeric', 'between:1,4'],
            'parameters.sampling.marginOfError' => ['required', 'numeric', 'gt:0', 'max:0.5'],
            'parameters.sampling.proportion' => ['required', 'numeric', 'gt:0', 'lt:1'],
            'parameters.sampling.minParticipationPerStratum' => $unit,
            'consent_text_id' => ['required', 'string', 'min:50', 'max:5000'],
            'consent_text_en' => ['nullable', 'string', 'max:5000'],
            'dpa_status' => ['required', Rule::enum(DpaStatus::class)],
            'dpa_reference' => ['nullable', 'string', 'max:120'],
            'dpa_signed_on' => ['nullable', 'date_format:Y-m-d'],
        ]);

        $setup->updateParameters($assessment, $data['parameters'], [
            'consent_text_id' => $data['consent_text_id'],
            'consent_text_en' => (string) ($data['consent_text_en'] ?? ''),
            'dpa_status' => $data['dpa_status'],
            'dpa_reference' => $data['dpa_reference'] ?? null,
            'dpa_signed_on' => $data['dpa_signed_on'] ?? null,
        ]);

        return back()->with('status', 'saved');
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    private function normalizeDecimals(array $input): array
    {
        $flat = Arr::dot($input['parameters'] ?? []);
        foreach ($flat as $key => $value) {
            if (is_string($value)) {
                $flat[$key] = str_replace(',', '.', trim($value));
            }
        }

        return [...$input, 'parameters' => Arr::undot($flat)];
    }
}
