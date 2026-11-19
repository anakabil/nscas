<?php

declare(strict_types=1);

namespace App\Domain\Navigation;

use App\Domain\Access\Role;
use App\Domain\Workflow\Stage;

/** Satu halaman kerja di dalam asesmen. Kunci dipakai untuk teks (modules.<key>), ikon, dan rute. */
final readonly class Module
{
    /**
     * @param  list<Role>  $roles  Peran yang boleh membuka halaman ini (hak baca).
     * @param  string  $buildPhase  Fase rombak v2 yang membangun modul ini (PROMPTS.md).
     * @param  bool  $ready  Modul sudah dibangun dan dapat dipakai.
     */
    public function __construct(
        public string $key,
        public ?Stage $stage,
        public string $path,
        public array $roles,
        public string $buildPhase,
        public bool $ready = false,
    ) {}

    /**
     * @param  iterable<Role>  $held
     */
    public function visibleTo(iterable $held): bool
    {
        foreach ($held as $role) {
            if (in_array($role, $this->roles, true)) {
                return true;
            }
        }

        return false;
    }
}
