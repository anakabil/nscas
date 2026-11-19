<?php

namespace App\Http\Controllers\Respondents;

use App\Http\Controllers\Controller;
use App\Services\Respondents\SurveyEntry;
use App\Services\Survey\SurveyService;
use DateTimeInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

/**
 * Halaman publik responden tanpa akun (docs/01 M2 dan M3). Rutenya tidak memulai sesi, sehingga tidak ada baris sesi
 * yang menyimpan alamat IP atau peramban responden. Pengendali ini tidak membaca alamat IP, tidak menulis log, dan
 * tidak menulis jejak audit (docs/02 bagian 4); pembatas laju memakai HMAC alamat IP berumur satu menit
 * (AppServiceProvider). Halaman survei memakai paket peramban tersendiri tanpa kode konsol.
 */
class SurveyEntryController extends Controller
{
    /** Kiriman wajar berukuran beberapa kilobita; batas ini menolak muatan yang tidak masuk akal. */
    private const MAX_BODY_BYTES = 64 * 1024;

    /** Pemindaian kode QR unit: menerbitkan atau memakai ulang token, lalu meneruskan ke tautan survei. */
    public function qr(Request $request, string $code): RedirectResponse|Response
    {
        $cookie = 'nscas_qr_'.substr(hash('sha256', $code), 0, 16);
        $result = SurveyEntry::issueFromQr($code, $request->cookie($cookie));
        if (! $result['ok']) {
            return $this->page('QR_'.$result['reason'], null, null, 200);
        }

        return redirect('/s/'.$result['raw'])
            ->withCookie(cookie($cookie, $result['raw'], 60 * 24 * 30, '/', null, $request->isSecure(), true, false, 'lax'));
    }

    public function show(string $token, SurveyService $survey): Response
    {
        $state = $survey->state($token, now());
        if ($state['state'] !== 'READY') {
            return $this->page($state['state'], $state['opensAt'] ?? null, $state['closesAt'] ?? null, $state['state'] === 'INVALID' ? 404 : 200);
        }

        return response()->view('survey.app', [
            'data' => [
                ...$survey->payload($token, $state['token'], $state['assessment']),
                'openUrl' => url('/s/'.$token.'/open'),
                'submitUrl' => url('/s/'.$token.'/submit'),
                'logo' => asset('brand/nscas-logo-480.png'),
            ],
        ])->header('Cache-Control', 'no-store')->header('X-Robots-Tag', 'noindex, nofollow');
    }

    /**
     * Dipanggil peramban setelah halaman survei dimuat (bukan oleh pratinjau tautan aplikasi pesan). Selalu 204 agar
     * keberadaan token tidak dapat ditebak dari rute ini.
     */
    public function open(string $token, SurveyService $survey): Response
    {
        $survey->markOpened($token, now());

        return response()->noContent()->header('Cache-Control', 'no-store');
    }

    public function submit(Request $request, string $token, SurveyService $survey): JsonResponse
    {
        if (strlen((string) $request->getContent()) > self::MAX_BODY_BYTES) {
            return $this->json(413, 'INVALID_INPUT');
        }
        $validator = Validator::make($request->json()->all(), [
            'language' => ['required', Rule::in(['id', 'en'])],
            // Wajib untuk token kode QR tanpa strata; diabaikan untuk token yang sudah memiliki strata.
            'stratumId' => ['nullable', 'string', 'max:64'],
            // Durasi dari persetujuan sampai menekan Kirim (detik); hanya untuk rentang dan tanda mutu.
            'durationSeconds' => ['required', 'integer', 'min:0', 'max:2592000'],
            'characteristics' => ['required', 'array', 'min:1', 'max:200'],
            'characteristics.*.characteristicId' => ['required', 'string', 'max:64'],
            'characteristics.*.statementId' => ['present', 'nullable', 'string', 'max:64'],
            'climate' => ['required', 'array', 'min:1', 'max:500'],
            'climate.*.itemId' => ['required', 'string', 'max:64'],
            'climate.*.value' => ['required', 'integer', 'min:1', 'max:5'],
        ]);
        if ($validator->fails()) {
            return $this->json(400, 'INVALID_INPUT');
        }
        $input = $validator->validated();
        $result = $survey->submit($token, [
            'language' => $input['language'],
            'stratumId' => $input['stratumId'] ?? null,
            'durationSeconds' => (int) $input['durationSeconds'],
            'characteristics' => array_map(fn (array $c) => ['characteristicId' => (string) $c['characteristicId'], 'statementId' => $c['statementId'] ?? null], $input['characteristics']),
            'climate' => array_map(fn (array $c) => ['itemId' => (string) $c['itemId'], 'value' => (int) $c['value']], $input['climate']),
        ], now());

        return $result['ok']
            ? response()->json(['ok' => true], 201)->header('Cache-Control', 'no-store')
            : $this->json($result['status'], (string) $result['code']);
    }

    private function json(int $status, string $code): JsonResponse
    {
        return response()->json(['error' => $code], $status)->header('Cache-Control', 'no-store');
    }

    private function page(string $state, ?DateTimeInterface $opensAt, ?DateTimeInterface $closesAt, int $status): Response
    {
        return response()->view('survey.entry', ['state' => $state, 'opensAt' => $opensAt, 'closesAt' => $closesAt], $status)
            ->header('Cache-Control', 'no-store')
            ->header('X-Robots-Tag', 'noindex, nofollow');
    }
}
