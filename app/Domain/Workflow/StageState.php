<?php

declare(strict_types=1);

namespace App\Domain\Workflow;

enum StageState: string
{
    case Done = 'done';
    case Current = 'current';
    case Upcoming = 'upcoming';
}
