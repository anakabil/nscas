<?php

declare(strict_types=1);

namespace App\Domain\Scoring;

/**
 * Satu respons survei anonim. Hanya memuat kode strata dan jawaban; tidak ada token, identitas,
 * alamat IP, maupun waktu kirim (CLAUDE.md aturan 2).
 */
final readonly class SurveyResponseInput
{
    /**
     * @param  array<string, int|float|null>  $characteristicAnswers  Kode karakteristik ke tingkat 1 sampai 5.
     *                                                                Nilai null berarti "Tidak tahu"; kunci yang tidak ada berarti tidak dijawab.
     * @param  bool  $excluded  Respons yang dikeluarkan setelah ditinjau asesor tidak dihitung.
     */
    public function __construct(
        public string $stratumCode,
        public array $characteristicAnswers,
        public bool $excluded = false,
    ) {}
}
