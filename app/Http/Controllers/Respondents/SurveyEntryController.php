<?php

namespace App\Http\Controllers\Respondents;

use App\Http\Controllers\Controller;
use App\Services\Respondents\SurveyEntry;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Halaman publik responden tanpa akun (docs/01 M2). Rutenya tidak memulai sesi, sehingga tidak ada baris sesi yang
 * menyimpan alamat IP atau peramban responden; halaman ini juga tidak memuat kode konsol (CLAUDE.md, konvensi kode).
 */
class SurveyEntryController extends Controller
{
    /** Pemindaian kode QR unit: menerbitkan atau memakai ulang token, lalu meneruskan ke tautan survei. */
    public function qr(Request $request, string $code): RedirectResponse|Response
    {
        $cookie = 'nscas_qr_'.substr(hash('sha256', $code), 0, 16);
        $result = SurveyEntry::issueFromQr($code, $request->cookie($cookie));
        if (! $result['ok']) {
            return $this->page($result['reason'] === 'INVALID' ? 'QR_INVALID' : 'QR_'.$result['reason'], null, 200);
        }

        return redirect('/s/'.$result['raw'])
            ->withCookie(cookie($cookie, $result['raw'], 60 * 24 * 30, '/', null, $request->isSecure(), true, false, 'lax'));
    }

    public function show(string $token): Response
    {
        $state = SurveyEntry::state($token);

        return $this->page($state['state'], $state['closesAt'], $state['state'] === 'INVALID' ? 404 : 200);
    }

    private function page(string $state, mixed $closesAt, int $status): Response
    {
        return response()->view('survey.entry', ['state' => $state, 'closesAt' => $closesAt], $status)
            ->header('Cache-Control', 'no-store')
            ->header('X-Robots-Tag', 'noindex, nofollow');
    }
}
