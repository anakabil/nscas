<?php

namespace App\Services\Validation;

use App\Models\Assessment;
use App\Models\Characteristic;
use App\Models\SiteVisitCheck;
use App\Models\ValidationParticipant;
use App\Models\ValidationRating;
use App\Models\ValidationSession;
use App\Support\TempFile;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Common\Entity\Style\Style;
use OpenSpout\Writer\XLSX\Writer;

/**
 * Ekspor data validasi lapangan ke Excel untuk analisis lanjut (bahan versi 2): sesi, kode per karakteristik, lembar
 * kunjungan proyek, dan ringkasan triangulasi. Nama narasumber tidak dicantumkan; asesor ditulis sebagai A1, A2, dan
 * seterusnya agar kesepakatan antarpenilai tetap dapat dihitung.
 */
final class ValidationExport
{
    /** @param  array<string, array<string, mixed>>  $triangulation */
    public static function build(Assessment $assessment, array $triangulation, string $locale): string
    {
        $t = fn (string $key) => __("fieldwork.{$key}", [], $locale);
        $col = fn (string $key) => $t("columns.{$key}");
        $path = TempFile::path('nscas-validation-', 'xlsx');
        $head = (new Style)->setFontBold()->setFontColor('FFFFFF')->setBackgroundColor('691B2E');
        $writer = new Writer;
        $writer->openToFile($path);

        $characteristics = Characteristic::where('instrument_version_id', $assessment->instrument_version_id)->orderBy('position')->get(['id', 'code', 'name_id', 'name_en']);
        $code = $characteristics->pluck('code', 'id');
        $name = $characteristics->mapWithKeys(fn ($c) => [$c->code => $locale === 'en' && $c->name_en ? $c->name_en : $c->name_id]);
        $sessions = ValidationSession::where('assessment_id', $assessment->id)->with(['unit:id,name', 'stratum:id,code'])
            ->orderBy('scheduled_at')->orderBy('label')->get();
        $participants = ValidationParticipant::whereIn('validation_session_id', $sessions->pluck('id'))
            ->selectRaw('validation_session_id, count(*) as n')->groupBy('validation_session_id')->pluck('n', 'validation_session_id');
        $date = fn (ValidationSession $s) => $s->scheduled_at?->setTimezone('Asia/Jakarta')->format('Y-m-d');

        $sheet = $writer->getCurrentSheet();
        $sheet->setName($t('sheets.sessions'));
        $writer->addRow(Row::fromValues([$t('note')]));
        $writer->addRow(Row::fromValues(array_map($col, ['session', 'type', 'layer', 'unit', 'stratum', 'date', 'status', 'participants']), $head));
        foreach ($sessions as $s) {
            $writer->addRow(Row::fromValues([
                $s->label, $t("types.{$s->type}"), $t("layers.{$s->layer}"), $s->unit?->name, $s->stratum?->code, $date($s),
                $t("statuses.{$s->status}"), (int) ($participants[$s->id] ?? $s->participant_count ?? 0),
            ]));
        }

        $writer->addNewSheetAndMakeItCurrent()->setName($t('sheets.codes'));
        $writer->addRow(Row::fromValues(array_map($col, ['session', 'type', 'layer', 'characteristic', 'assessor', 'level', 'evidence', 'agreement', 'note']), $head));
        // Lembar kode dan kunjungan hanya memuat sesi yang tidak dibatalkan, sama dengan ringkasan triangulasi.
        $active = $sessions->filter(fn (ValidationSession $s) => $s->status !== 'CANCELLED')->pluck('id');
        $ratings = ValidationRating::whereIn('validation_session_id', $active)->orderBy('created_at')->get();
        $assessors = $ratings->pluck('assessor_id')->unique()->values()->flip()->map(fn ($i) => 'A'.($i + 1));
        $bySession = $sessions->keyBy('id');
        foreach ($ratings->sortBy(fn ($r) => [$bySession[$r->validation_session_id]->label, $code[$r->characteristic_id] ?? '']) as $r) {
            $s = $bySession[$r->validation_session_id];
            $writer->addRow(Row::fromValues([
                $s->label, $t("types.{$s->type}"), $t("layers.{$s->layer}"), $code[$r->characteristic_id] ?? '', $assessors[$r->assessor_id],
                (float) $r->level, $r->evidence_code ? $t("evidence.{$r->evidence_code}") : null,
                $r->agreement ? $t("agreement.{$r->agreement}") : null, $r->note,
            ]));
        }

        $writer->addNewSheetAndMakeItCurrent()->setName($t('sheets.site'));
        $writer->addRow(Row::fromValues(array_map($col, ['session', 'unit', 'date', 'item', 'characteristic', 'method', 'text', 'result', 'note']), $head));
        $items = [];
        foreach (FieldGuide::content()['siteVisit']['sections'] as $section) {
            foreach ($section['items'] as $item) {
                $items[$item['code']] = ['method' => $section['method'], 'text' => $item['text'], 'characteristic' => $item['characteristic']];
            }
        }
        $checks = SiteVisitCheck::whereIn('validation_session_id', $active)->orderBy('item_code')->get();
        foreach ($checks->sortBy(fn ($c) => [$bySession[$c->validation_session_id]->label, $c->item_code]) as $c) {
            $s = $bySession[$c->validation_session_id];
            $item = $items[$c->item_code] ?? ['method' => null, 'text' => null, 'characteristic' => $code[$c->characteristic_id] ?? ''];
            $writer->addRow(Row::fromValues([
                $s->label, $s->unit?->name, $date($s), $c->item_code, $item['characteristic'],
                $item['method'] ? $t("methods.{$item['method']}") : null, $item['text'], $t("results.{$c->result}"), $c->note,
            ]));
        }

        $writer->addNewSheetAndMakeItCurrent()->setName($t('sheets.triangulation'));
        $keys = ['characteristic', 'name', 'talksN', 'talksMean', 'mean_MANAGEMENT', 'mean_SUPERVISORY', 'mean_FIELD', 'ev_CONSISTENT', 'ev_PARTIAL', 'ev_NONE',
            'ag_AGREED', 'ag_MIXED', 'ag_DIVIDED', 'site_MEETS', 'site_PARTIAL', 'site_NOT_MET', 'site_NOT_OBSERVED', 'siteIndex', 'divergent'];
        $writer->addRow(Row::fromValues(array_map($col, $keys), $head));
        $round = fn (?float $v) => $v === null ? null : round($v, 4);
        foreach ($triangulation as $c => $row) {
            $writer->addRow(Row::fromValues([
                $c, $name[$c] ?? '', $row['talks']['n'], $round($row['talks']['mean']),
                $round($row['talks']['byLayer']['MANAGEMENT'] ?? null), $round($row['talks']['byLayer']['SUPERVISORY'] ?? null), $round($row['talks']['byLayer']['FIELD'] ?? null),
                ...array_values($row['talks']['evidence']), ...array_values($row['talks']['agreement']), ...array_values($row['site']['counts']),
                $round($row['site']['index']), $row['divergent'] ? $t('yes') : $t('no'),
            ]));
        }
        $writer->close();

        return $path;
    }
}
