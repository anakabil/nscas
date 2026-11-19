<?php

namespace App\Http\Presenters;

use App\Domain\Access\Role;
use App\Domain\Navigation\MenuBuilder;
use App\Domain\Navigation\Module;
use App\Domain\Workflow\Stage;
use App\Domain\Workflow\Workflow;
use App\Models\Assessment;

/**
 * Bentuk data asesmen untuk antarmuka. Hanya kunci dan angka yang dikirim; teks antarmuka diterjemahkan di
 * peramban dari berkas bahasa, sehingga pengendali tidak menulis teks tampilan.
 */
final class AssessmentPresenter
{
    /**
     * Ringkasan untuk daftar dan kartu.
     *
     * @param  list<Role>  $roles
     * @return array<string, mixed>
     */
    public static function summary(Assessment $assessment, array $roles): array
    {
        return [
            'id' => $assessment->id,
            'name' => $assessment->name,
            'organization' => $assessment->organization->name,
            'status' => $assessment->status->value,
            'stage' => $assessment->stage()?->number(),
            'closed' => $assessment->status->isClosed(),
            'periodStart' => $assessment->period_start->toDateString(),
            'periodEnd' => $assessment->period_end->toDateString(),
            'targetLevel' => $assessment->target_level,
            'role' => Role::primary($roles)?->value,
            'href' => route('assessments.show', $assessment),
        ];
    }

    /**
     * Menu lengkap satu asesmen: menurut tahap, menurut peran, lintas tahap, dan syarat ke status berikutnya.
     *
     * @param  list<Role>  $roles
     * @return array<string, mixed>
     */
    public static function menu(Assessment $assessment, array $roles): array
    {
        $status = $assessment->status;
        $module = static fn (Module $m): array => [
            'key' => $m->key,
            'stage' => $m->stage?->number(),
            'href' => route('assessments.module', ['assessment' => $assessment, 'path' => $m->path]),
            'ready' => $m->ready,
            'buildPhase' => $m->buildPhase,
        ];
        $next = Workflow::next($status);

        return [
            ...self::summary($assessment, $roles),
            'roles' => array_map(static fn (Role $r): string => $r->value, $roles),
            'stages' => array_map(static fn (array $group): array => [
                'key' => $group['stage']->value,
                'number' => $group['stage']->number(),
                'state' => $group['state']->value,
                'statuses' => array_map(static fn ($s): string => $s->value, $group['stage']->statuses()),
                'modules' => array_map($module, $group['modules']),
            ], MenuBuilder::byStage($status, $roles)),
            'roleTasks' => array_map($module, MenuBuilder::byRole($status, $roles)),
            'crossStage' => array_map($module, MenuBuilder::crossStage($status, $roles)),
            'next' => $next === null ? null : [
                'to' => $next->to->value,
                'toStage' => Stage::of($next->to)?->number(),
                'actor' => $next->actor->value,
                'conditions' => $next->conditions,
            ],
        ];
    }
}
