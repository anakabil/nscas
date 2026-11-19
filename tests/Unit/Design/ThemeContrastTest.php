<?php

declare(strict_types=1);

namespace Tests\Unit\Design;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * Kontras warna tema (docs/05 bagian 1 dan 5). Nilai dibaca langsung dari resources/css/app.css, sehingga
 * perubahan palet yang menurunkan keterbacaan langsung tertangkap. Acuan: WCAG 2.1 tingkat AA.
 */
class ThemeContrastTest extends TestCase
{
    /** @return array<string, string> */
    private static function tokens(): array
    {
        $css = (string) file_get_contents(dirname(__DIR__, 3).'/resources/css/app.css');
        preg_match('/:root\s*\{(.*?)\n\}/s', $css, $root);
        preg_match_all('/--([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/', $root[1] ?? '', $matches, PREG_SET_ORDER);
        $tokens = [];
        foreach ($matches as $match) {
            $tokens[$match[1]] = strtolower($match[2]);
        }

        return $tokens;
    }

    private static function luminance(string $hex): float
    {
        $channels = array_map(
            static function (string $pair): float {
                $value = hexdec($pair) / 255;

                return $value <= 0.03928 ? $value / 12.92 : (($value + 0.055) / 1.055) ** 2.4;
            },
            str_split(ltrim($hex, '#'), 2),
        );

        return 0.2126 * $channels[0] + 0.7152 * $channels[1] + 0.0722 * $channels[2];
    }

    private static function contrast(string $a, string $b): float
    {
        $la = self::luminance($a);
        $lb = self::luminance($b);

        return (max($la, $lb) + 0.05) / (min($la, $lb) + 0.05);
    }

    /** @return iterable<string, array{string, string, float}> */
    public static function pairs(): iterable
    {
        // [warna depan, warna latar, kontras minimal]
        yield 'teks utama di latar halaman' => ['foreground', 'background', 4.5];
        yield 'teks pendukung di kartu' => ['muted-foreground', 'card', 4.5];
        yield 'teks pendukung di latar halaman' => ['muted-foreground', 'background', 4.5];
        yield 'teks tombol utama' => ['primary-foreground', 'primary', 4.5];
        yield 'emas tua untuk teks di bidang terang' => ['gold-deep', 'card', 4.5];
        yield 'emas tua di latar halaman' => ['gold-deep', 'background', 4.5];
        yield 'emas di bidang gelap' => ['gold', 'obsidian', 4.5];
        yield 'emas pucat di bidang gelap' => ['gold-soft', 'obsidian', 4.5];
        yield 'perak di bidang gelap' => ['silver', 'obsidian', 4.5];
        yield 'perak tua sebagai ikon di bidang gelap' => ['silver-dim', 'obsidian', 3.0];
        yield 'teks berhasil di kartu' => ['success', 'card', 4.5];
        yield 'teks galat di kartu' => ['destructive', 'card', 4.5];
        yield 'cincin fokus di kartu' => ['ring', 'card', 3.0];
        yield 'garis masukan di kartu' => ['input', 'card', 1.5];
    }

    #[DataProvider('pairs')]
    public function test_pair_meets_minimum_contrast(string $foreground, string $background, float $minimum): void
    {
        $tokens = self::tokens();
        $this->assertArrayHasKey($foreground, $tokens);
        $this->assertArrayHasKey($background, $tokens);
        $ratio = self::contrast($tokens[$foreground], $tokens[$background]);
        $this->assertGreaterThanOrEqual($minimum, $ratio, sprintf('%s di atas %s hanya %.2f banding 1', $foreground, $background, $ratio));
    }

    public function test_gold_is_never_a_text_colour_on_light_surfaces(): void
    {
        // Emas cerah kurang kontras di bidang terang; itulah alasan adanya emas tua (docs/05 aturan warna 2).
        $tokens = self::tokens();
        $this->assertLessThan(4.5, self::contrast($tokens['gold'], $tokens['card']));
    }
}
