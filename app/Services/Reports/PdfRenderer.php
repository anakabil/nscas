<?php

namespace App\Services\Reports;

/** Pengubah HTML laporan menjadi PDF di server (docs/01 M11). */
interface PdfRenderer
{
    /** PDF dapat dibuat di lingkungan ini. */
    public function available(): bool;

    /** @return string isi PDF */
    public function render(string $html): string;
}
