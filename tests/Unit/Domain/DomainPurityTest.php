<?php

declare(strict_types=1);

namespace Tests\Unit\Domain;

use PHPUnit\Framework\TestCase;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;

/** Lapisan domain adalah kode murni: tanpa kerangka kerja, basis data, maupun I/O (CLAUDE.md aturan 1). */
class DomainPurityTest extends TestCase
{
    public function test_domain_code_has_no_framework_database_or_io_dependencies(): void
    {
        $root = dirname(__DIR__, 3).'/app/Domain';
        $forbidden = ['Illuminate\\', 'use App\\Models', 'use App\\Http', 'DB::', 'file_get_contents', 'fopen(', 'curl_', 'env(', 'config('];
        $checked = 0;
        foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root)) as $file) {
            if (! $file->isFile() || $file->getExtension() !== 'php') {
                continue;
            }
            $source = (string) file_get_contents($file->getPathname());
            foreach ($forbidden as $needle) {
                $this->assertStringNotContainsString($needle, $source, "{$file->getPathname()} memuat {$needle}");
            }
            $checked++;
        }
        $this->assertGreaterThan(8, $checked);
    }
}
