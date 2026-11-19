<?php

declare(strict_types=1);

namespace Tests\Unit\Scoring;

use PHPUnit\Framework\TestCase;

/**
 * CLAUDE.md aturan 1: mesin penilaian adalah kode murni, tanpa kerangka kerja, basis data, maupun I/O.
 * Tes ini memindai sumber app/Domain/Scoring; hanya tes yang boleh membaca berkas.
 */
final class ArchitectureTest extends TestCase
{
    /** Potongan teks yang tidak boleh muncul di berkas mana pun, termasuk di dalam komentar. */
    private const array FORBIDDEN = [
        'Illuminate\\',
        'use App\\Models',
        'DB::',
        'file_get_contents',
        'fopen',
        'curl_',
    ];

    /**
     * Padanan purity.test.ts lama: tanpa pembantu kerangka kerja, tanpa keadaan sekitar (lingkungan, jam,
     * bilangan acak), dan tanpa pemuatan berkas lain secara manual.
     */
    private const string AMBIENT_STATE = '/\b(?:collect|config|env|getenv|app|resolve|request|session|cache|auth|logger|now|today'
        .'|time|microtime|hrtime|date|gmdate|rand|mt_rand|random_int|random_bytes|uniqid|shuffle|array_rand'
        .'|file|file_put_contents|fwrite|fread|readfile|unlink|mkdir|scandir|glob|fsockopen|stream_[a-z_]+'
        .'|exec|shell_exec|system|passthru|proc_open|mail|header|setcookie|ini_set|putenv'
        .'|require|require_once|include|include_once|eval)\s*\(|\$_[A-Z]+\b|\$GLOBALS\b|\bnew\s+\\\\?(?:DateTime|PDO|Random)/';

    /** @return array<string, string> Nama berkas ke isi. */
    private static function sources(): array
    {
        $dir = dirname(__DIR__, 3).'/app/Domain/Scoring';
        $paths = glob($dir.'/*.php') ?: [];
        // Subfolder ikut dipindai agar berkas yang kelak dipindahkan tidak lolos dari pemeriksaan.
        foreach (glob($dir.'/*', GLOB_ONLYDIR) ?: [] as $subdir) {
            $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($subdir, \FilesystemIterator::SKIP_DOTS));
            foreach ($iterator as $file) {
                if ($file->isFile() && $file->getExtension() === 'php') {
                    $paths[] = $file->getPathname();
                }
            }
        }
        sort($paths);

        $sources = [];
        foreach ($paths as $path) {
            $sources[substr($path, strlen($dir) + 1)] = (string) file_get_contents($path);
        }

        return $sources;
    }

    public function test_scoring_domain_contains_no_framework_database_or_io_code(): void
    {
        $sources = self::sources();

        // Mesin, kalkulator sampel, statistik mutu, parameter, dan objek nilainya harus ikut terpindai.
        $this->assertGreaterThanOrEqual(10, count($sources), 'Pemindaian tidak menemukan berkas app/Domain/Scoring');
        foreach (['ScoringEngine.php', 'SampleCalculator.php', 'DataQuality.php', 'Numeric.php', 'EngineParameters.php'] as $required) {
            $this->assertArrayHasKey($required, $sources);
        }

        foreach ($sources as $file => $source) {
            foreach (self::FORBIDDEN as $needle) {
                $this->assertStringNotContainsString($needle, $source, "{$file} memuat {$needle}");
            }
        }
    }

    public function test_scoring_domain_only_imports_its_own_namespace_and_touches_no_ambient_state(): void
    {
        foreach (self::sources() as $file => $source) {
            $this->assertMatchesRegularExpression('/^<\?php\s+declare\(strict_types=1\);\s+namespace App\\\\Domain\\\\Scoring;/', $source, "{$file} wajib strict_types dan namespace App\\Domain\\Scoring");

            preg_match_all('/^use\s+(?:function\s+|const\s+)?([^;]+);/m', $source, $imports);
            foreach ($imports[1] as $import) {
                // Kelas bawaan PHP di namespace global (tanpa pemisah) boleh; selebihnya hanya modul ini sendiri.
                $this->assertTrue(
                    ! str_contains($import, '\\') || str_starts_with(ltrim($import, '\\'), 'App\\Domain\\Scoring\\'),
                    "{$file} mengimpor {$import} dari luar App\\Domain\\Scoring",
                );
            }
            $this->assertDoesNotMatchRegularExpression('/\\\\(?:App|Illuminate|Laravel|Symfony|Carbon|Inertia)\\\\/', $source, "{$file} merujuk kelas dari luar modul");
            $this->assertDoesNotMatchRegularExpression(self::AMBIENT_STATE, self::withoutComments($source), "{$file} menyentuh kerangka kerja, I/O, lingkungan, jam, atau bilangan acak");
        }
    }

    /** Membuang komentar agar kata biasa di dalam penjelasan tidak dianggap pemanggilan fungsi. */
    private static function withoutComments(string $source): string
    {
        $code = '';
        foreach (token_get_all($source) as $token) {
            if (is_array($token) && in_array($token[0], [T_COMMENT, T_DOC_COMMENT], true)) {
                continue;
            }
            $code .= is_array($token) ? $token[1] : $token;
        }

        return $code;
    }
}
