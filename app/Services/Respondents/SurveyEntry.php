<?php

namespace App\Services\Respondents;

use App\Domain\Respondents\SurveyWindow;
use App\Domain\Respondents\TokenCodec;
use App\Models\AccessToken;
use App\Models\Assessment;
use App\Models\UnitQrCode;
use Illuminate\Support\Facades\DB;

/**
 * Pemindaian kode QR unit (docs/01 M2), dibawa dari v1 issueTokenFromQr. Tidak mencatat alamat IP maupun jejak audit
 * per pemindaian. Keadaan tautan dan pengiriman survei ada di App\Services\Survey\SurveyService.
 */
final class SurveyEntry
{
    /**
     * Menerbitkan token survei sekali pakai dari kode QR unit, tanpa daftar responden. Bila perangkat yang sama masih
     * menyimpan token dari pemindaian sebelumnya yang belum selesai, token itu dipakai ulang agar satu orang tidak
     * menghabiskan kuota.
     *
     * @return array{ok: true, raw: string, reused: bool}|array{ok: false, reason: 'INVALID'|'CLOSED'|'LIMIT'}
     */
    public static function issueFromQr(string $rawCode, ?string $previousRaw): array
    {
        if (! TokenCodec::looksValid($rawCode)) {
            return ['ok' => false, 'reason' => 'INVALID'];
        }

        return DB::transaction(function () use ($rawCode, $previousRaw) {
            $qr = UnitQrCode::where('code_hash', TokenCodec::hash($rawCode))->first();
            if ($qr === null || ! $qr->is_active) {
                return ['ok' => false, 'reason' => 'INVALID'];
            }
            $assessment = Assessment::find($qr->assessment_id, ['id', 'status', 'survey_opens_at', 'survey_closes_at']);
            if (! SurveyWindow::isOpen($assessment->status, $assessment->survey_opens_at, $assessment->survey_closes_at, now())) {
                return ['ok' => false, 'reason' => 'CLOSED'];
            }
            if ($previousRaw !== null && TokenCodec::looksValid($previousRaw)) {
                $previous = AccessToken::where('token_hash', TokenCodec::hash($previousRaw))->first(['unit_qr_code_id', 'revoked_at', 'completed_at']);
                if ($previous !== null && $previous->unit_qr_code_id === $qr->id && $previous->revoked_at === null && $previous->completed_at === null) {
                    return ['ok' => true, 'raw' => $previousRaw, 'reused' => true];
                }
            }
            // Mengunci baris kode QR agar batas penerbitan tidak terlampaui oleh pemindaian bersamaan.
            UnitQrCode::whereKey($qr->id)->lockForUpdate()->first(['id']);
            if ($qr->max_issuance !== null && AccessToken::where('unit_qr_code_id', $qr->id)->count() >= $qr->max_issuance) {
                return ['ok' => false, 'reason' => 'LIMIT'];
            }
            $issued = SurveyLinks::issue($assessment, ['unit_id' => $qr->unit_id, 'stratum_id' => $qr->stratum_id, 'unit_qr_code_id' => $qr->id, 'channel' => 'QR']);

            return ['ok' => true, 'raw' => $issued['raw'], 'reused' => false];
        });
    }
}
