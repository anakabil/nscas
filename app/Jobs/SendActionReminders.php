<?php

namespace App\Jobs;

use App\Domain\Access\Role;
use App\Domain\ActionPlan\ActionPlanRules;
use App\Mail\ActionReminderMail;
use App\Models\ActionItem;
use App\Models\Assessment;
use App\Models\GapItem;
use App\Models\Membership;
use App\Support\Audit;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Mail;

/**
 * Pengingat tenggat satu asesmen (docs/01 M10): penanggung jawab yang alamat surelnya tercatat menerima daftar
 * tindakannya, dan administrator klien menerima ringkasan seluruh tindakan yang mendekati atau melewati tenggat.
 * Satu tindakan diingatkan paling sering seminggu sekali.
 */
class SendActionReminders implements ShouldQueue
{
    use Queueable;

    public int $tries = 2;

    public function __construct(public string $assessmentId) {}

    public function handle(): void
    {
        $assessment = Assessment::with('organization')->find($this->assessmentId);
        if ($assessment === null || $assessment->action_plan_published_at === null || ! ActionPlanRules::planOpen($assessment->status)) {
            return;
        }
        $now = now();
        $due = ActionItem::whereIn('gap_item_id', GapItem::where('assessment_id', $assessment->id)->select('id'))->with('gap:id,characteristic_code')
            ->whereIn('status', ActionPlanRules::OPEN)->get()
            ->filter(fn (ActionItem $a) => ActionPlanRules::reminderDue($a->status, $a->due_date->toDateString(), $a->last_reminder_at, $now));
        if ($due->isEmpty()) {
            return;
        }
        $item = fn (ActionItem $a) => [
            'title' => $a->title, 'code' => (string) $a->gap?->characteristic_code, 'dueDate' => $a->due_date->toDateString(),
            'state' => ActionPlanRules::dueState($a->status, $a->due_date->toDateString(), $now),
        ];
        $link = route('monitoring.index', $assessment);
        $sent = 0;
        foreach ($due->filter(fn (ActionItem $a) => $a->owner_email !== null)->groupBy('owner_email') as $email => $actions) {
            Mail::to($email)->send(new ActionReminderMail($actions->first()->owner_name, $assessment->organization->name, $assessment->name, $actions->map($item)->values()->all(), $link));
            $sent++;
        }
        $admins = Membership::where('organization_id', $assessment->organization_id)->where('role', Role::ClientAdmin)
            ->with('user:id,name,email,is_active')->get()->pluck('user')->filter(fn ($u) => $u !== null && $u->is_active);
        foreach ($admins as $admin) {
            Mail::to($admin->email)->send(new ActionReminderMail($admin->name, $assessment->organization->name, $assessment->name, $due->map($item)->values()->all(), $link));
            $sent++;
        }
        ActionItem::whereIn('id', $due->pluck('id'))->update(['last_reminder_at' => $now]);
        Audit::record('action.reminder', $assessment, ['after' => ['actions' => $due->count(), 'messages' => $sent]], $assessment);
    }
}
