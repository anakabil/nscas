<?php

namespace App\Services\Reports;

use RuntimeException;
use Symfony\Component\Process\Process;

/**
 * PDF dari Chromium tanpa layar di server yang sama (docs/01 M11), tanpa layanan pihak ketiga (CLAUDE.md aturan 7).
 * HTML laporan tidak memuat skrip maupun sumber luar, dan jaringan peramban diarahkan ke alamat yang tidak melayani,
 * sehingga render tidak dapat menghubungi server mana pun. Nomor halaman dari aturan CSS @page.
 */
final class ChromiumPdfRenderer implements PdfRenderer
{
    public const TIMEOUT_SECONDS = 90;

    public function available(): bool
    {
        $binary = (string) config('nscas.pdf_chromium');

        return $binary !== '' && is_executable($binary);
    }

    public function render(string $html): string
    {
        if (! $this->available()) {
            throw new RuntimeException('PDF_UNAVAILABLE');
        }
        $dir = sys_get_temp_dir().'/nscas-pdf-'.bin2hex(random_bytes(8));
        mkdir($dir, 0700);
        $in = $dir.'/report.html';
        $out = $dir.'/report.pdf';
        try {
            file_put_contents($in, $html);
            $process = new Process([
                (string) config('nscas.pdf_chromium'),
                '--headless',
                '--no-sandbox',
                '--disable-gpu',
                '--disable-extensions',
                '--disable-background-networking',
                '--no-first-run',
                '--no-pdf-header-footer',
                '--proxy-server=http://127.0.0.1:9',
                '--user-data-dir='.$dir.'/profile',
                '--print-to-pdf='.$out,
                'file://'.$in,
            ], $dir, ['HOME' => $dir]);
            $process->setTimeout(self::TIMEOUT_SECONDS);
            $process->run();
            if (! is_file($out) || filesize($out) === 0) {
                throw new RuntimeException('PDF_FAILED: '.mb_substr($process->getErrorOutput(), 0, 500));
            }

            return (string) file_get_contents($out);
        } finally {
            exec('rm -rf '.escapeshellarg($dir));
        }
    }
}
