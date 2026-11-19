<?php

namespace App\Http\Controllers\Respondents;

use App\Domain\SelfAssessment\SelfAssessmentRules;
use App\Http\Controllers\Controller;
use App\Services\SelfAssessment\SelfAssessmentForm;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Validator;

/**
 * Formulir penilaian mandiri bertoken /sa/{token} (docs/01 M4). Pengisi tidak memiliki akun; hak aksesnya adalah
 * token. Rutenya tanpa sesi seperti halaman survei, tetapi berbeda dengan survei, penilaian ini teridentifikasi dan
 * setiap perubahan dicatat di jejak audit oleh layanan.
 */
class SelfAssessmentFormController extends Controller
{
    public function show(string $token, SelfAssessmentForm $form): Response
    {
        $state = $form->state($token);
        if ($state['state'] === 'INVALID' || $state['state'] === 'CLOSED') {
            return response()->view('survey.entry', ['state' => 'SA_'.$state['state'], 'opensAt' => null, 'closesAt' => null, 'titleKey' => 'titleSelfAssessment'], $state['state'] === 'INVALID' ? 404 : 200)
                ->header('Cache-Control', 'no-store')->header('X-Robots-Tag', 'noindex, nofollow');
        }

        return response()->view('self-assessment.app', [
            'data' => [
                ...$form->payload($token, $state['selfAssessment'], $state['assessment']),
                'profileUrl' => url('/sa/'.$token.'/profile'),
                'answerUrl' => url('/sa/'.$token.'/answer'),
                'submitUrl' => url('/sa/'.$token.'/submit'),
                'logo' => asset('brand/nscas-logo-480.png'),
            ],
        ])->header('Cache-Control', 'no-store')->header('X-Robots-Tag', 'noindex, nofollow');
    }

    public function profile(Request $request, string $token, SelfAssessmentForm $form): JsonResponse
    {
        $validator = Validator::make($request->json()->all(), [
            'name' => ['required', 'string', 'min:2', 'max:200'],
            'position' => ['required', 'string', 'min:2', 'max:200'],
        ]);
        if ($validator->fails()) {
            return $this->json(['ok' => false, 'status' => 400, 'code' => 'INVALID_INPUT']);
        }

        return $this->json($form->saveProfile($token, trim($request->json('name')), trim($request->json('position'))));
    }

    public function answer(Request $request, string $token, SelfAssessmentForm $form): JsonResponse
    {
        $validator = Validator::make($request->json()->all(), [
            'characteristicId' => ['required', 'string', 'max:64'],
            'statementId' => ['present', 'nullable', 'string', 'max:64'],
            'justification' => ['present', 'nullable', 'string', 'max:'.SelfAssessmentRules::JUSTIFICATION_MAX_LENGTH],
            'evidenceIds' => ['present', 'array', 'max:50'],
            'evidenceIds.*' => ['string', 'max:64'],
        ]);
        if ($validator->fails()) {
            return $this->json(['ok' => false, 'status' => 400, 'code' => 'INVALID_INPUT']);
        }
        $data = $validator->validated();

        return $this->json($form->saveAnswer($token, $data['characteristicId'], $data['statementId'] ?? null, (string) ($data['justification'] ?? ''), array_values($data['evidenceIds'])));
    }

    public function submit(string $token, SelfAssessmentForm $form): JsonResponse
    {
        return $this->json($form->submit($token));
    }

    /** @param  array{ok: bool, status: int, code: string|null, missing?: array<mixed>}  $result */
    private function json(array $result): JsonResponse
    {
        $body = $result['ok'] ? ['ok' => true] : array_filter(['error' => $result['code'], 'missing' => $result['missing'] ?? null], fn ($v) => $v !== null);

        return response()->json($body, $result['status'])->header('Cache-Control', 'no-store');
    }
}
