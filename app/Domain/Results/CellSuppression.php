<?php

declare(strict_types=1);

namespace App\Domain\Results;

/**
 * Penyembunyian sel laporan (CLAUDE.md aturan 3, docs/04), dibawa dari v1 src/lib/privacy/suppression.ts. Murni.
 *
 * Penyembunyian primer: sel dengan 1 sampai ambang - 1 responden tidak menampilkan nilai maupun jumlah respondennya.
 * Penyembunyian pelengkap: bila agregat sekelompok sel ikut diterbitkan (misalnya rata-rata kelompok manajemen),
 * satu sel tersembunyi dapat dihitung balik dari agregat dan sel lain yang tampil. Karena itu, bila dalam satu
 * kelompok hanya satu sel yang tersembunyi, sel tampil dengan responden paling sedikit ikut disembunyikan. Diulang
 * sampai tidak ada kelompok dengan tepat satu sel tersembunyi.
 */
final class CellSuppression
{
    /**
     * @param  array<string, array{value: float|null, n: int}>  $cells  sel menurut kunci
     * @param  list<list<string>>  $groups  kunci sel yang agregatnya diterbitkan di tempat lain
     * @return array<string, array{value: float|null, n: int|null, suppressed: bool}>
     */
    public static function apply(array $cells, int $minCell, array $groups = []): array
    {
        $state = [];
        foreach ($cells as $key => $c) {
            $state[$key] = match (true) {
                $c['n'] <= 0 => 'empty',
                $c['n'] < $minCell => 'primary',
                $c['value'] === null => 'empty',
                default => 'visible',
            };
        }
        $hidden = fn (string $s): bool => $s === 'primary' || $s === 'secondary';

        do {
            $changed = false;
            foreach ($groups as $group) {
                $members = array_values(array_filter($group, fn ($k) => isset($state[$k])));
                $hiddenCount = count(array_filter($members, fn ($k) => $hidden($state[$k])));
                $visible = array_values(array_filter($members, fn ($k) => $state[$k] === 'visible'));
                if ($hiddenCount === 1 && $visible !== []) {
                    $smallest = $visible[0];
                    foreach ($visible as $k) {
                        if ($cells[$k]['n'] < $cells[$smallest]['n']) {
                            $smallest = $k;
                        }
                    }
                    $state[$smallest] = 'secondary';
                    $changed = true;
                }
            }
        } while ($changed);

        $out = [];
        foreach ($cells as $key => $c) {
            $isHidden = $hidden($state[$key]);
            // Sel tanpa responden tetap bertanda tersembunyi seperti sebelumnya, tetapi jumlah nolnya boleh terbaca dan
            // tidak dihitung sebagai sel tersembunyi pada penyembunyian pelengkap karena tidak membuka apa pun.
            $out[$key] = [
                'value' => $state[$key] === 'visible' ? $c['value'] : null,
                'n' => $isHidden ? null : $c['n'],
                'suppressed' => $isHidden || $c['n'] <= 0,
            ];
        }

        return $out;
    }
}
