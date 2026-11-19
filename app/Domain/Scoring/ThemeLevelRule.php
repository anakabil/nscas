<?php

declare(strict_types=1);

namespace App\Domain\Scoring;

/**
 * Aturan penetapan tangga per tema yang tidak saling menutupi (docs/13 bagian 6.3; keputusan D2 dan D3). Padanan
 * seed/fixtures/referensi_aturan_tema.py; fixture aturan-tema-v2.json (D4) adalah sumber kebenaran. Aturan ini
 * menyalin logika prosedural skema sertifikasi, bukan kriteria isinya, dan dipakai untuk instrumen versi 2 yang
 * berstruktur tema. Instrumen versi 1 tetap memakai ScoringEngine dan fixture versi 1. Murni.
 */
final class ThemeLevelRule
{
    public const GREEN = 'HIJAU';

    public const AMBER = 'JINGGA';

    public const RED = 'MERAH';

    public const STEPS = [2, 3, 4, 5];

    /** Ambang awal (D3), dikalibrasi setelah asesmen pertama. */
    public const DEFAULT_GREEN = 0.80;

    public const DEFAULT_AMBER = 0.50;

    private const EPS = 1e-9;

    public static function color(float $fulfilment, float $green = self::DEFAULT_GREEN, float $amber = self::DEFAULT_AMBER): string
    {
        return match (true) {
            $fulfilment >= $green - self::EPS => self::GREEN,
            $fulfilment >= $amber - self::EPS => self::AMBER,
            default => self::RED,
        };
    }

    /**
     * Langkah 3: perilaku semua tema hijau; prasyarat paling sedikit n - 1 tema hijau dan tidak ada yang merah.
     *
     * @param  list<array{code: string, behaviour: array<int|string, float>, prerequisite: array<int|string, float>}>  $themes
     */
    public static function stepReached(array $themes, int $step, float $green = self::DEFAULT_GREEN, float $amber = self::DEFAULT_AMBER): bool
    {
        $greens = 0;
        foreach ($themes as $t) {
            if (self::color((float) $t['behaviour'][$step], $green, $amber) !== self::GREEN) {
                return false;
            }
            $p = self::color((float) $t['prerequisite'][$step], $green, $amber);
            if ($p === self::RED) {
                return false;
            }
            $greens += $p === self::GREEN ? 1 : 0;
        }

        return $greens >= count($themes) - 1;
    }

    /**
     * Langkah 4 dan 5: tangga organisasi mulai dari sasaran lalu turun sampai tangga 2 (selain itu 1), warna per tema
     * dan tangga, profil per tema, serta tema penghambat menuju tangga berikutnya bila sasaran belum tercapai.
     *
     * @param  list<array{code: string, behaviour: array<int|string, float>, prerequisite: array<int|string, float>}>  $themes
     * @return array{level: int, colors: array<string, array<string, array{behaviour: string, prerequisite: string}>>, profile: array<string, int>, nextStep: int|null, blockers: list<array{code: string, behaviour: string, prerequisite: string}>}
     */
    public static function determine(array $themes, int $target, float $green = self::DEFAULT_GREEN, float $amber = self::DEFAULT_AMBER): array
    {
        if ($themes === []) {
            throw new EngineInputError('Aturan tema memerlukan paling sedikit satu tema');
        }
        $level = 1;
        for ($s = min(5, $target); $s >= 2; $s--) {
            if (self::stepReached($themes, $s, $green, $amber)) {
                $level = $s;
                break;
            }
        }
        $colors = [];
        $profile = [];
        foreach ($themes as $t) {
            $best = 1;
            foreach (self::STEPS as $s) {
                $b = self::color((float) $t['behaviour'][$s], $green, $amber);
                $p = self::color((float) $t['prerequisite'][$s], $green, $amber);
                $colors[$t['code']][(string) $s] = ['behaviour' => $b, 'prerequisite' => $p];
                if ($b === self::GREEN && $p !== self::RED) {
                    $best = $s;
                }
            }
            $profile[$t['code']] = $best;
        }
        $next = $level < $target ? $level + 1 : null;

        return [
            'level' => $level,
            'colors' => $colors,
            'profile' => $profile,
            'nextStep' => $next,
            'blockers' => $next === null ? [] : self::blockers($themes, $next, $green, $amber),
        ];
    }

    /**
     * Tema yang menahan tangga: perilaku belum hijau, prasyarat merah, atau prasyarat jingga bila jumlah prasyarat
     * hijau kurang dari n - 1 (satu prasyarat jingga masih diterima).
     *
     * @param  list<array{code: string, behaviour: array<int|string, float>, prerequisite: array<int|string, float>}>  $themes
     * @return list<array{code: string, behaviour: string, prerequisite: string}>
     */
    public static function blockers(array $themes, int $step, float $green = self::DEFAULT_GREEN, float $amber = self::DEFAULT_AMBER): array
    {
        $prerequisite = array_map(fn (array $t) => self::color((float) $t['prerequisite'][$step], $green, $amber), $themes);
        $amberBlocks = count(array_filter($prerequisite, fn (string $c) => $c === self::GREEN)) < count($themes) - 1;
        $out = [];
        foreach ($themes as $i => $t) {
            $b = self::color((float) $t['behaviour'][$step], $green, $amber);
            $p = $prerequisite[$i];
            if ($b !== self::GREEN || $p === self::RED || ($p === self::AMBER && $amberBlocks)) {
                $out[] = ['code' => $t['code'], 'behaviour' => $b, 'prerequisite' => $p];
            }
        }

        return $out;
    }
}
