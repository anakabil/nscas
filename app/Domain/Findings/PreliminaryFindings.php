<?php

declare(strict_types=1);

namespace App\Domain\Findings;

/**
 * Temuan awal (docs/12 temuan T4): gambaran deskriptif tanpa tingkat, disusun sebelum validasi lapangan agar wawancara
 * dan diskusi kelompok terarah diarahkan oleh data (rancangan campuran berurutan, temuan T1). Isinya rata-rata survei
 * per karakteristik dan kelompok jabatan berbobot populasi strata, porsi "Tidak tahu", penilaian mandiri, selisih
 * persepsi manajemen dan lapangan (docs/03 bagian 6), kelengkapan jenis bukti, dan usulan karakteristik fokus.
 * Sel dengan kurang dari ambang responden disembunyikan (CLAUDE.md aturan 3). Murni.
 */
final class PreliminaryFindings
{
    public const GROUPS = ['MANAGEMENT', 'SUPERVISORY', 'FIELD'];

    /** Porsi "Tidak tahu" yang menandakan karakteristik kurang dikenal pekerja. */
    public const DONT_KNOW_ATTENTION = 0.30;

    /** Jumlah karakteristik fokus yang diusulkan untuk validasi. */
    public const FOCUS_LIMIT = 6;

    /** Banyak karakteristik dengan rata-rata survei terendah yang ikut ditandai. */
    public const LOWEST_COUNT = 3;

    /**
     * @param  list<array{id: string, code: string, name: string, aspectCode: string, contextual: bool}>  $characteristics
     * @param  list<array{id: string, group: string, population: int}>  $strata
     * @param  list<array{stratumId: string, levels: array<string, int|null>, climate: array<string, int>}>  $responses  jawaban yang tidak dikeluarkan
     * @param  array<string, list<int>>  $selfAssessment  id karakteristik ke tingkat penilaian mandiri terkirim
     * @param  array<string, array{types: int, belowMinimum: bool}>  $evidence
     * @param  list<array{code: string, name: string, items: list<array{id: string, reverse: bool}>}>  $dimensions
     * @return array{characteristics: list<array<string, mixed>>, aspects: list<array<string, mixed>>, climate: list<array<string, mixed>>, focus: list<array{characteristicId: string, code: string, reasons: list<string>}>}
     */
    public static function build(array $characteristics, array $strata, array $responses, array $selfAssessment, array $evidence, array $dimensions, int $minCell, float $gapAttention): array
    {
        $population = [];
        $groupOf = [];
        foreach ($strata as $s) {
            $population[$s['id']] = max(0, $s['population']);
            $groupOf[$s['id']] = $s['group'];
        }

        $rows = [];
        foreach ($characteristics as $c) {
            $byStratum = [];
            $dontKnow = 0;
            $total = 0;
            foreach ($responses as $r) {
                if (! array_key_exists($c['id'], $r['levels'])) {
                    continue;
                }
                $total++;
                $level = $r['levels'][$c['id']];
                if ($level === null) {
                    $dontKnow++;

                    continue;
                }
                $byStratum[$r['stratumId']][] = $level;
            }
            $answered = $total - $dontKnow;
            $overall = self::weighted($byStratum, $population);
            $groups = [];
            foreach (self::GROUPS as $g) {
                $own = array_filter($byStratum, fn ($_, string $sid) => ($groupOf[$sid] ?? null) === $g, ARRAY_FILTER_USE_BOTH);
                $n = array_sum(array_map('count', $own));
                $value = self::weighted($own, $population);
                $groups[$g] = ['value' => $n >= $minCell ? $value : null, 'n' => $n, 'suppressed' => $n < $minCell];
            }
            $gap = ! $groups['MANAGEMENT']['suppressed'] && ! $groups['FIELD']['suppressed'] && $groups['MANAGEMENT']['value'] !== null && $groups['FIELD']['value'] !== null
                ? $groups['MANAGEMENT']['value'] - $groups['FIELD']['value']
                : null;
            $sa = $selfAssessment[$c['id']] ?? [];
            $saMean = $sa === [] ? null : (float) array_sum($sa) / count($sa);
            $survey = $answered >= $minCell ? $overall : null;
            $rows[] = [
                'characteristicId' => $c['id'],
                'code' => $c['code'],
                'name' => $c['name'],
                'aspectCode' => $c['aspectCode'],
                'contextual' => $c['contextual'],
                'answered' => $answered,
                'survey' => $survey,
                'suppressed' => $answered < $minCell,
                'dontKnowShare' => $total >= $minCell ? $dontKnow / $total : null,
                'groups' => $groups,
                'gap' => $gap,
                'gapAttention' => $gap !== null && abs($gap) >= $gapAttention - 1e-9,
                'selfAssessment' => ['mean' => $saMean, 'n' => count($sa)],
                'selfAssessmentGap' => $saMean !== null && $survey !== null ? $saMean - $survey : null,
                'evidenceTypes' => $evidence[$c['id']]['types'] ?? 0,
                'evidenceBelowMinimum' => $evidence[$c['id']]['belowMinimum'] ?? true,
            ];
        }

        return [
            'characteristics' => $rows,
            'aspects' => self::aspects($characteristics, $responses, $population, $groupOf, $minCell, $gapAttention),
            'climate' => self::climate($dimensions, $responses, $population, $groupOf, $minCell),
            'focus' => self::focus($rows, $gapAttention),
        ];
    }

    /**
     * Rata-rata berbobot populasi strata dari rata-rata tiap strata (docs/03 bagian 2.1).
     *
     * @param  array<string, list<int|float>>  $byStratum
     * @param  array<string, int>  $population
     */
    private static function weighted(array $byStratum, array $population): ?float
    {
        $num = 0.0;
        $den = 0.0;
        foreach ($byStratum as $sid => $values) {
            if ($values === []) {
                continue;
            }
            $w = (float) ($population[$sid] ?? 0);
            if ($w <= 0) {
                continue;
            }
            $num += $w * (array_sum($values) / count($values));
            $den += $w;
        }

        return $den > 0 ? $num / $den : null;
    }

    /**
     * Selisih persepsi per aspek: rata-rata kelompok manajemen dikurangi lapangan, dari karakteristik nonkontekstual.
     * Rata-rata tiap responden dihitung lebih dulu agar setiap orang berbobot sama dalam strata.
     *
     * @param  list<array{id: string, code: string, name: string, aspectCode: string, contextual: bool}>  $characteristics
     * @param  list<array{stratumId: string, levels: array<string, int|null>, climate: array<string, int>}>  $responses
     * @param  array<string, int>  $population
     * @param  array<string, string>  $groupOf
     * @return list<array<string, mixed>>
     */
    private static function aspects(array $characteristics, array $responses, array $population, array $groupOf, int $minCell, float $gapAttention): array
    {
        $byAspect = [];
        foreach ($characteristics as $c) {
            if (! $c['contextual']) {
                $byAspect[$c['aspectCode']][] = $c['id'];
            }
        }
        $out = [];
        foreach ($byAspect as $aspect => $ids) {
            $groups = [];
            foreach (self::GROUPS as $g) {
                $byStratum = [];
                foreach ($responses as $r) {
                    if (($groupOf[$r['stratumId']] ?? null) !== $g) {
                        continue;
                    }
                    $values = array_values(array_filter(array_map(fn (string $id) => $r['levels'][$id] ?? null, $ids), fn ($v) => $v !== null));
                    if ($values !== []) {
                        $byStratum[$r['stratumId']][] = array_sum($values) / count($values);
                    }
                }
                $n = array_sum(array_map('count', $byStratum));
                $groups[$g] = ['value' => $n >= $minCell ? self::weighted($byStratum, $population) : null, 'n' => $n, 'suppressed' => $n < $minCell];
            }
            $gap = $groups['MANAGEMENT']['value'] !== null && $groups['FIELD']['value'] !== null
                ? $groups['MANAGEMENT']['value'] - $groups['FIELD']['value']
                : null;
            $out[] = ['aspectCode' => $aspect, 'groups' => $groups, 'gap' => $gap, 'gapAttention' => $gap !== null && $gap >= $gapAttention - 1e-9];
        }

        return $out;
    }

    /**
     * Rata-rata dimensi iklim per kelompok jabatan; butir negatif dibalik (6 - nilai).
     *
     * @param  list<array{code: string, name: string, items: list<array{id: string, reverse: bool}>}>  $dimensions
     * @param  list<array{stratumId: string, levels: array<string, int|null>, climate: array<string, int>}>  $responses
     * @param  array<string, int>  $population
     * @param  array<string, string>  $groupOf
     * @return list<array<string, mixed>>
     */
    private static function climate(array $dimensions, array $responses, array $population, array $groupOf, int $minCell): array
    {
        $out = [];
        foreach ($dimensions as $d) {
            $groups = [];
            foreach (self::GROUPS as $g) {
                $byStratum = [];
                foreach ($responses as $r) {
                    if (($groupOf[$r['stratumId']] ?? null) !== $g) {
                        continue;
                    }
                    $values = [];
                    foreach ($d['items'] as $item) {
                        if (isset($r['climate'][$item['id']])) {
                            $v = $r['climate'][$item['id']];
                            $values[] = $item['reverse'] ? 6 - $v : $v;
                        }
                    }
                    if ($values !== []) {
                        $byStratum[$r['stratumId']][] = array_sum($values) / count($values);
                    }
                }
                $n = array_sum(array_map('count', $byStratum));
                $groups[$g] = ['value' => $n >= $minCell ? self::weighted($byStratum, $population) : null, 'n' => $n, 'suppressed' => $n < $minCell];
            }
            $out[] = ['code' => $d['code'], 'name' => $d['name'], 'groups' => $groups];
        }

        return $out;
    }

    /**
     * Usulan karakteristik fokus validasi: selisih persepsi, penilaian mandiri jauh di atas survei, porsi "Tidak tahu"
     * tinggi, rata-rata survei terendah, dan bukti di bawah ambang jenis. Diurutkan menurut banyak alasan.
     *
     * @param  list<array<string, mixed>>  $rows
     * @return list<array{characteristicId: string, code: string, reasons: list<string>}>
     */
    private static function focus(array $rows, float $gapAttention): array
    {
        $scored = array_values(array_filter($rows, fn (array $r) => $r['survey'] !== null && ! $r['contextual']));
        usort($scored, fn (array $a, array $b) => $a['survey'] <=> $b['survey'] ?: strcmp($a['code'], $b['code']));
        $lowest = array_column(array_slice($scored, 0, self::LOWEST_COUNT), 'characteristicId');

        $candidates = [];
        foreach ($rows as $r) {
            $reasons = [];
            if ($r['gapAttention']) {
                $reasons[] = 'GAP';
            }
            if ($r['selfAssessmentGap'] !== null && $r['selfAssessmentGap'] >= $gapAttention - 1e-9) {
                $reasons[] = 'SELF_HIGHER';
            }
            if ($r['dontKnowShare'] !== null && $r['dontKnowShare'] >= self::DONT_KNOW_ATTENTION) {
                $reasons[] = 'DONT_KNOW';
            }
            if (in_array($r['characteristicId'], $lowest, true)) {
                $reasons[] = 'LOW';
            }
            if ($r['evidenceBelowMinimum']) {
                $reasons[] = 'EVIDENCE';
            }
            // Bukti saja tidak cukup untuk menjadi fokus wawancara; perlu sinyal dari data persepsi.
            if (array_diff($reasons, ['EVIDENCE']) !== []) {
                $candidates[] = ['row' => $r, 'reasons' => $reasons];
            }
        }
        usort($candidates, fn (array $a, array $b) => count($b['reasons']) <=> count($a['reasons'])
            ?: abs((float) ($b['row']['gap'] ?? 0)) <=> abs((float) ($a['row']['gap'] ?? 0))
            ?: ($a['row']['survey'] ?? 9) <=> ($b['row']['survey'] ?? 9)
            ?: strcmp($a['row']['code'], $b['row']['code']));

        return array_map(fn (array $c) => [
            'characteristicId' => $c['row']['characteristicId'],
            'code' => $c['row']['code'],
            'reasons' => $c['reasons'],
        ], array_slice($candidates, 0, self::FOCUS_LIMIT));
    }
}
