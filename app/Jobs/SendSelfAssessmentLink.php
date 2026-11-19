<?php

namespace App\Jobs;

use App\Domain\Respondents\SurveyWindow;
use App\Mail\SurveyMail;
use App\Models\AccessToken;
use App\Models\Assessment;
use App\Models\SelfAssessment;
use App\Services\Respondents\SurveyLinks;
use App\Services\SelfAssessment\SelfAssessmentAdmin;
use App\Support\Audit;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Surel tautan penilaian mandiri (keputusan R4). Sama dengan undangan survei: token baru dibuat tepat sebelum surel
 * dikirim dan menggantikan token lama; bila pengiriman gagal, token baru dicabut dan pekerjaan diulang.
 */
class SendSelfAssessmentLink implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /** @var list<int> */
    public array $backoff = [60, 300];

    public function __construct(public string $assessmentId, public string $selfAssessmentId) {}

    public function handle(): void
    {
        $prepared = DB::transaction(function () {
            $sa = SelfAssessment::whereKey($this->selfAssessmentId)->where('assessment_id', $this->assessmentId)->lockForUpdate()->first();
            if ($sa === null || $sa->status === 'SUBMITTED' || $sa->respondent_email === null) {
                return null;
            }
            $assessment = Assessment::with('organization')->find($this->assessmentId);
            if ($assessment === null || ! SurveyWindow::distributionOpen($assessment->status)) {
                return null;
            }
            $old = AccessToken::find($sa->access_token_id);
            if ($old !== null && $old->revoked_at === null) {
                $old->forceFill(['revoked_at' => now(), 'revoked_reason' => 'REISSUED'])->save();
            }
            $issued = SurveyLinks::issue($assessment, ['unit_id' => $sa->unit_id, 'stratum_id' => null, 'kind' => 'SELF_ASSESSMENT', 'channel' => 'EMAIL']);
            $sa->forceFill(['access_token_id' => $issued['token']->id])->save();

            return [$sa, $assessment, $issued];
        });
        if ($prepared === null) {
            return;
        }

        /** @var array{0: SelfAssessment, 1: Assessment, 2: array{token: AccessToken, raw: string}} $prepared */
        [$sa, $assessment, $issued] = $prepared;
        try {
            Mail::to($sa->respondent_email)->send(new SurveyMail('selfAssessment', $sa->respondent_name, $assessment->organization->name, SelfAssessmentAdmin::link($issued['raw']), null));
        } catch (Throwable $e) {
            $issued['token']->forceFill(['revoked_at' => now(), 'revoked_reason' => 'SEND_FAILED'])->save();
            throw $e;
        }
        Audit::record('selfAssessment.email_sent', $sa, ['after' => ['channel' => 'EMAIL']], $assessment);
    }
}
