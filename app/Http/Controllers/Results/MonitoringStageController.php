<?php

namespace App\Http\Controllers\Results;

use App\Http\Controllers\Respondents\CollectionController;

/** Dasar halaman tahap 6 Pemantauan dan perbaikan (fase R8 dan R9). */
abstract class MonitoringStageController extends CollectionController
{
    private const TABS = [
        'monitoring' => 'monitoring',
        'trend' => 'trend',
    ];

    protected function tabMap(): array
    {
        return self::TABS;
    }

    protected function stageKey(): string
    {
        return 'monitoringStage';
    }
}
