<?php

namespace App\Services\Results;

use App\Models\Assessment;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Common\Entity\Style\Style;
use OpenSpout\Writer\XLSX\Writer;

/**
 * Ekspor Excel dasbor hasil (docs/01 M9). Isinya sama dengan dasbor: angka gabungan, sel di bawah ambang responden
 * tetap disembunyikan (CLAUDE.md aturan 3), dan pernyataan bahwa hasil bukan sertifikat ada di baris pertama.
 * Teks dari lang/<bahasa>/results.php.
 */
final class ResultsExport
{
    /**
     * @param  array<string, mixed>  $d  keluaran ResultsService::dashboard()
     * @return string jalur berkas sementara; pemanggil menghapusnya setelah dikirim
     */
    public static function build(Assessment $assessment, array $d, string $locale): string
    {
        $t = fn (string $key, array $replace = []) => __("results.{$key}", $replace, $locale);
        $hidden = $t('hidden');
        $num = fn (?float $v, int $digits = 2) => $v === null ? $hidden : round($v, $digits);
        $path = tempnam(sys_get_temp_dir(), 'nscas-results-').'.xlsx';
        $bold = (new Style)->setFontBold();
        $head = (new Style)->setFontBold()->setFontColor('FFFFFF')->setBackgroundColor('691B2E');
        $writer = new Writer;
        $writer->openToFile($path);

        $sheet = $writer->getCurrentSheet();
        $sheet->setName($t('sheets.summary'));
        $sheet->setColumnWidth(40, 1);
        $sheet->setColumnWidth(60, 2);
        $writer->addRow(Row::fromValues([$t('notCertificate')], $bold));
        $writer->addRow(Row::fromValues([]));
        $org = $d['organization'];
        foreach ([
            [$t('summary.assessment'), $assessment->name],
            [$t('summary.organization'), $assessment->organization->name],
            [$t('summary.status'), $d['provisional'] ? $t('summary.provisional') : $t('summary.final')],
            [$t('summary.index'), round((float) $org['index'], 2)],
            [$t('summary.level'), (int) $org['indicativeLevel']],
            [$t('summary.consolidated'), $org['consolidated'] ? $t('yes') : $t('no')],
            [$t('summary.target'), $d['targetLevel']],
            [$t('summary.gap'), round((float) $org['gapToTarget'], 2)],
            [$t('summary.scl'), $d['sclLevel'] ?? $t('none')],
            [$t('summary.stable'), $d['sensitivity']['stable'] ? $t('yes') : $t('no')],
            [$t('summary.engine'), $d['engineVersion']],
        ] as $pair) {
            $writer->addRow(Row::fromValues($pair));
        }

        $writer->addNewSheetAndMakeItCurrent()->setName($t('sheets.aspects'));
        $writer->addRow(Row::fromValues([$t('cols.code'), $t('cols.aspect'), $t('cols.index'), $t('cols.min'), $t('cols.weight'), $t('cols.gap')], $head));
        foreach ($d['aspects'] as $a) {
            $writer->addRow(Row::fromValues([$a['code'], $a['name'], $num($a['index']), $num($a['min']), round((float) $a['weight'], 4), $num($a['gapToTarget'])]));
        }

        $writer->addNewSheetAndMakeItCurrent()->setName($t('sheets.characteristics'));
        $writer->addRow(Row::fromValues([$t('cols.code'), $t('cols.characteristic'), $t('cols.aspect'), $t('cols.perception'), $t('cols.evidence'), $t('cols.validation'), $t('cols.engine'), $t('cols.panel'), $t('cols.value'), $t('cols.flags')], $head));
        foreach ($d['characteristics'] as $c) {
            $writer->addRow(Row::fromValues([
                $c['code'], $locale === 'en' && $c['nameEn'] ? $c['nameEn'] : $c['name'], $c['aspectCode'],
                $c['perception'] === null ? '' : round($c['perception'], 2), $c['evidence'] === null ? '' : round($c['evidence'], 2),
                $c['validation'] === null ? '' : round($c['validation'], 2), $c['engine'] === null ? '' : round($c['engine'], 2),
                $c['panel'] === null ? '' : round($c['panel'], 2), $c['value'] === null ? '' : round($c['value'], 2),
                implode(', ', array_map(fn (string $f) => $t("flags.{$f}"), $c['flags'])),
            ]));
        }

        foreach (['strata' => 'sheets.strata', 'units' => 'sheets.units'] as $key => $sheetName) {
            $writer->addNewSheetAndMakeItCurrent()->setName($t($sheetName));
            $map = $d['heatmaps'][$key];
            $writer->addRow(Row::fromValues([$t('cols.aspect'), ...array_column($map['columns'], 'label')], $head));
            foreach ($map['rows'] as $row) {
                $writer->addRow(Row::fromValues([$row['aspectCode'], ...array_map(fn (array $cell) => $num($cell['value']), $row['cells'])]));
            }
            $writer->addRow(Row::fromValues([]));
            $writer->addRow(Row::fromValues([$t('hiddenNote', ['min' => $d['minCell']])]));
        }

        $writer->addNewSheetAndMakeItCurrent()->setName($t('sheets.sensitivity'));
        $writer->addRow(Row::fromValues([$t('cols.scenario'), $t('cols.perception'), $t('cols.evidence'), $t('cols.validation'), $t('cols.index'), $t('cols.level'), $t('cols.changed')], $head));
        $base = $d['sensitivity']['base'];
        $writer->addRow(Row::fromValues([$t('base'), $base['weights']['perception'], $base['weights']['evidence'], $base['weights']['validation'], round($base['index'], 3), $base['level'], '']));
        foreach ($d['sensitivity']['scenarios'] as $s) {
            $writer->addRow(Row::fromValues([
                $t('scenario', ['up' => $t("layers.{$s['up']}"), 'down' => $t("layers.{$s['down']}")]),
                $s['weights']['perception'], $s['weights']['evidence'], $s['weights']['validation'], round($s['index'], 3), $s['level'], $s['levelChanged'] ? $t('yes') : $t('no'),
            ]));
        }
        $writer->close();

        return $path;
    }
}
