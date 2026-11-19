<?php

namespace App\Services\Respondents;

use App\Domain\Respondents\TokenCodec;
use App\Models\AccessToken;
use App\Models\Assessment;
use Illuminate\Support\Facades\URL;

/**
 * Pembuatan token akses dan alamat publiknya. Token mentah hanya dikembalikan sekali, untuk ditaruh di tautan atau
 * surel; basis data hanya menyimpan hash SHA-256 (docs/04 bagian 3).
 */
final class SurveyLinks
{
    /**
     * @param  array{unit_id: string, stratum_id: string|null, roster_entry_id?: string|null, unit_qr_code_id?: string|null, channel: string, reminder_count?: int, last_reminder_at?: mixed}  $data
     * @return array{token: AccessToken, raw: string}
     */
    public static function issue(Assessment|string $assessment, array $data): array
    {
        $raw = TokenCodec::generate();
        $token = AccessToken::create([
            'assessment_id' => $assessment instanceof Assessment ? $assessment->id : $assessment,
            'kind' => 'SURVEY',
            'token_hash' => TokenCodec::hash($raw),
            'issued_at' => now(),
            ...$data,
        ]);

        return ['token' => $token, 'raw' => $raw];
    }

    public static function survey(string $raw): string
    {
        return URL::to('/s/'.$raw);
    }

    public static function qr(string $raw): string
    {
        return URL::to('/q/'.$raw);
    }
}
