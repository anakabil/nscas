<?php

declare(strict_types=1);

namespace App\Domain\Workflow;

use App\Domain\Access\Role;

/** Satu transisi status beserta pelaku dan syaratnya. Syarat berupa kunci; pemeriksaannya dilakukan modul terkait. */
final readonly class Transition
{
    /**
     * @param  list<string>  $conditions  Kunci syarat; teksnya ada di berkas bahasa (workflow.conditions.*).
     */
    public function __construct(
        public AssessmentStatus $from,
        public AssessmentStatus $to,
        public Role $actor,
        public array $conditions,
    ) {}
}
