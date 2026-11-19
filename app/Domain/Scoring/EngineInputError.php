<?php

declare(strict_types=1);

namespace App\Domain\Scoring;

use InvalidArgumentException;

/** Masukan atau parameter mesin penilaian tidak lengkap atau tidak valid. Pesan berbahasa Indonesia. */
final class EngineInputError extends InvalidArgumentException {}
