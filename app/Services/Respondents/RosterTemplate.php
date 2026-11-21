<?php

namespace App\Services\Respondents;

use App\Domain\Respondents\RosterValidator;
use App\Support\TempFile;
use OpenSpout\Common\Entity\Cell;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Common\Entity\Style\Style;
use OpenSpout\Writer\XLSX\Entity\SheetView;
use OpenSpout\Writer\XLSX\Writer;
use RuntimeException;
use ZipArchive;

/**
 * Templat Excel daftar responden, dibawa dari v1 src/lib/respondents/template.ts. Lembar pertama memuat judul kolom
 * yang dikenali pengimpor; lembar "Pilihan" memuat nama unit dan kode strata asesmen ini dan menjadi daftar pilihan
 * kolom Unit, Strata, dan Penyedia jasa; lembar "Petunjuk" menjelaskan isian. Nomor induk dan telepon berformat teks
 * agar angka nol di depan tidak hilang.
 */
final class RosterTemplate
{
    public const DATA_ROWS = 5000;

    /**
     * @param  list<string>  $units
     * @param  list<array{code: string, name: string, jobTitles?: list<string>}>  $strata
     * @param  array{optionsSheet: string, instructionsSheet: string, title: string, lines: list<string>, yes: string, no: string}  $texts
     * @return string Jalur berkas sementara; pemanggil menghapusnya setelah dikirim.
     */
    public static function build(array $units, array $strata, array $texts): string
    {
        $path = TempFile::path('roster-template-', 'xlsx');
        $writer = new Writer;
        $writer->openToFile($path);

        $header = (new Style)->setFontBold()->setFontColor('FFFFFF')->setBackgroundColor('691B2E');
        $text = (new Style)->setFormat('@');

        $sheet = $writer->getCurrentSheet();
        $sheet->setName(RosterReader::TEMPLATE_SHEET);
        $sheet->setSheetView((new SheetView)->setFreezeRow(2));
        foreach (RosterValidator::COLUMNS as $i => $column) {
            $sheet->setColumnWidth(in_array($column, ['name', 'unit'], true) ? 32 : 20, $i + 1);
        }
        $writer->addRow(Row::fromValues(array_values(RosterValidator::TEMPLATE_HEADERS), $header));
        $textColumns = array_keys(array_intersect(RosterValidator::COLUMNS, ['employeeNo', 'phone']));
        for ($r = 0; $r < self::DATA_ROWS; $r++) {
            $cells = [];
            foreach (RosterValidator::COLUMNS as $i => $column) {
                $cells[] = in_array($i, $textColumns, true) ? Cell::fromValue('', $text) : Cell::fromValue('');
            }
            $writer->addRow(new Row($cells));
        }

        $options = $writer->addNewSheetAndMakeItCurrent();
        $options->setName($texts['optionsSheet']);
        $options->setColumnWidth(40, 1);
        $options->setColumnWidth(14, 2);
        $options->setColumnWidth(40, 3);
        $options->setColumnWidth(16, 4);
        $options->setColumnWidth(4, 5);
        $options->setColumnWidth(36, 6);
        $options->setColumnWidth(14, 7);
        // Kolom F dan G: nama jabatan organisasi dan strata tujuannya, sebagai rujukan pengisian kolom Jabatan.
        $titles = [];
        foreach ($strata as $s) {
            foreach ($s['jobTitles'] ?? [] as $title) {
                $titles[] = [$title, $s['code']];
            }
        }
        $writer->addRow(Row::fromValues([
            RosterValidator::TEMPLATE_HEADERS['unit'], RosterValidator::TEMPLATE_HEADERS['stratum'], '', RosterValidator::TEMPLATE_HEADERS['contractor'],
            '', RosterValidator::TEMPLATE_HEADERS['jobTitle'], RosterValidator::TEMPLATE_HEADERS['stratum'],
        ], (new Style)->setFontBold()));
        $choices = [$texts['yes'], $texts['no']];
        for ($i = 0, $n = max(count($units), count($strata), count($titles), 2); $i < $n; $i++) {
            $writer->addRow(Row::fromValues([
                $units[$i] ?? '', $strata[$i]['code'] ?? '', $strata[$i]['name'] ?? '', $choices[$i] ?? '', '', $titles[$i][0] ?? '', $titles[$i][1] ?? '',
            ]));
        }

        $help = $writer->addNewSheetAndMakeItCurrent();
        $help->setName($texts['instructionsSheet']);
        $help->setColumnWidth(110, 1);
        $writer->addRow(Row::fromValues([$texts['title']], (new Style)->setFontBold()->setFontSize(13)));
        foreach ($texts['lines'] as $line) {
            $writer->addRow(Row::fromValues([$line], (new Style)->setShouldWrapText()));
        }
        $writer->close();

        self::addListValidations($path, $texts['optionsSheet'], count($units), count($strata));

        return $path;
    }

    /** OpenSpout belum mendukung validasi data, sehingga daftar pilihan disisipkan langsung ke XML lembar pertama. */
    private static function addListValidations(string $path, string $optionsSheet, int $units, int $strata): void
    {
        $column = static fn (string $key): string => chr(ord('A') + (int) array_search($key, RosterValidator::COLUMNS, true));
        $sheetRef = "'".str_replace("'", "''", $optionsSheet)."'";
        $range = static fn (string $col, int $count): string => "{$sheetRef}!\${$col}\$2:\${$col}\$".(max($count, 1) + 1);
        $last = self::DATA_ROWS + 1;
        $rules = array_filter([
            $units > 0 ? [$column('unit'), $range('A', $units)] : null,
            $strata > 0 ? [$column('stratum'), $range('B', $strata)] : null,
            [$column('contractor'), $range('D', 2)],
        ]);
        $xml = '<dataValidations count="'.count($rules).'">';
        foreach ($rules as [$col, $formula]) {
            $xml .= '<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="'.$col.'2:'.$col.$last.'">'
                .'<formula1>'.htmlspecialchars($formula, ENT_XML1).'</formula1></dataValidation>';
        }
        $xml .= '</dataValidations>';

        $zip = new ZipArchive;
        if ($zip->open($path) !== true) {
            throw new RuntimeException('Templat daftar responden tidak dapat dibuka.');
        }
        $entry = 'xl/worksheets/sheet1.xml';
        $content = (string) $zip->getFromName($entry);
        // Callback, bukan teks pengganti biasa, karena rumus memuat $2 yang akan dibaca sebagai rujukan kelompok.
        $content = (string) preg_replace_callback('#(?=<(?:hyperlinks|printOptions|pageMargins|pageSetup|headerFooter|drawing|legacyDrawing)\b|</worksheet>)#', static fn (): string => $xml, $content, 1);
        $zip->addFromString($entry, $content);
        $zip->close();
    }
}
