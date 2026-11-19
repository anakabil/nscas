<?php

namespace App\Http\Controllers\Setup;

use App\Domain\Setup\Kickoff;
use App\Models\Assessment;
use App\Models\AssessmentTeamMember;
use App\Services\AssessmentSetup;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Kesiapan organisasi dan tim sebelum pengukuran (docs/12 temuan T2): komitmen pimpinan, penjelasan kepada pekerja,
 * dan kalibrasi asesor. Keduanya syarat sebelum parameter dikunci.
 */
class KickoffController extends SetupController
{
    /** Saluran penyampaian penjelasan kepada pekerja; teksnya di berkas bahasa (setup.kickoff.channels.*). */
    public const CHANNELS = ['SAFETY_TALK', 'MEETING', 'NOTICE_BOARD', 'EMAIL', 'MESSAGING', 'OTHER'];

    public function edit(Request $request, Assessment $assessment): Response
    {
        $roles = $this->pageRoles($request, $assessment, 'kickoff');
        $assessment->load('team.user');
        $team = $assessment->team->map(fn (AssessmentTeamMember $m) => [
            'userId' => $m->user_id, 'name' => $m->user->name, 'role' => $m->role->value,
        ])->values()->all();

        return Inertia::render('setup/kickoff', [
            ...$this->common($assessment, $roles),
            'canEdit' => $this->canEditParameters($roles) && ! $assessment->status->parametersLocked(),
            'kickoff' => $assessment->kickoff,
            'calibration' => $assessment->calibration,
            'team' => $team,
            'channels' => self::CHANNELS,
            'kickoffComplete' => Kickoff::isComplete($assessment->kickoff),
            'calibrationComplete' => Kickoff::calibrationComplete(
                $assessment->calibration,
                $assessment->team->pluck('user_id')->map(fn ($id) => (int) $id)->all(),
            ),
        ]);
    }

    public function update(Request $request, Assessment $assessment, AssessmentSetup $setup): RedirectResponse
    {
        $this->requireParameterWriter($this->pageRoles($request, $assessment, 'kickoff'));
        $data = $request->validate([
            'leadership.date' => ['nullable', 'date_format:Y-m-d'],
            'leadership.leader' => ['nullable', 'string', 'max:200'],
            'leadership.note' => ['nullable', 'string', 'max:2000'],
            'briefing.date' => ['nullable', 'date_format:Y-m-d'],
            'briefing.channels' => ['array'],
            'briefing.channels.*' => [Rule::in(self::CHANNELS)],
            'briefing.note' => ['nullable', 'string', 'max:2000'],
        ]);
        $setup->updateKickoff($assessment, [
            'leadership' => [
                'date' => $data['leadership']['date'] ?? null,
                'leader' => $data['leadership']['leader'] ?? null,
                'note' => $data['leadership']['note'] ?? null,
            ],
            'briefing' => [
                'date' => $data['briefing']['date'] ?? null,
                'channels' => array_values(array_unique($data['briefing']['channels'] ?? [])),
                'note' => $data['briefing']['note'] ?? null,
            ],
        ]);

        return back()->with('status', 'saved');
    }

    public function calibration(Request $request, Assessment $assessment, AssessmentSetup $setup): RedirectResponse
    {
        $this->requireParameterWriter($this->pageRoles($request, $assessment, 'kickoff'));
        $data = $request->validate([
            'date' => ['required', 'date_format:Y-m-d'],
            'note' => ['nullable', 'string', 'max:2000'],
            'attendees' => ['array'],
            'attendees.*' => ['integer'],
        ]);
        $setup->recordCalibration($assessment, [
            'date' => $data['date'],
            'note' => $data['note'] ?? null,
            'attendees' => array_map('intval', $data['attendees'] ?? []),
        ]);

        return back()->with('status', 'saved');
    }
}
