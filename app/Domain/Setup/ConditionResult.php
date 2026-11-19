<?php

declare(strict_types=1);

namespace App\Domain\Setup;

/**
 * Hasil pemeriksaan satu syarat transisi. $met bernilai null bila syarat belum dapat diperiksa otomatis karena
 * modulnya belum dibangun; syarat seperti itu tetap menahan transisi.
 */
final readonly class ConditionResult
{
    public function __construct(
        public string $key,
        public ?bool $met,
        public ?string $module,
    ) {}
}
