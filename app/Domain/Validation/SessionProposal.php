<?php

declare(strict_types=1);

namespace App\Domain\Validation;

/**
 * Usulan sesi validasi dari hasil kalkulator sampel (docs/03 bagian 7), dibawa dari v1 src/lib/validation/proposal.ts:
 * wawancara perorangan untuk kelompok MANAGEMENT dan SUPERVISORY sebanyak wawancara minimum manajemen dan staf;
 * diskusi kelompok terarah untuk SUPERVISORY dan FIELD sebanyak wawancara minimum pekerja operasional, paling banyak
 * delapan peserta per sesi; serta kunjungan proyek. Sesuai keputusan D6 (docs/13), paling sedikit satu kunjungan
 * adalah kunjungan fisik; sisanya kunjungan virtual. Murni.
 */
final class SessionProposal
{
    public const INTERVIEW = 'INTERVIEW';

    public const FOCUS_GROUP = 'FOCUS_GROUP';

    public const SITE_VISIT = 'SITE_VISIT';

    public const VIRTUAL_SITE_VISIT = 'VIRTUAL_SITE_VISIT';

    public const TYPES = [self::INTERVIEW, self::FOCUS_GROUP, self::SITE_VISIT, self::VIRTUAL_SITE_VISIT];

    /**
     * Pembagian proporsional dengan metode sisa terbesar, dibatasi populasi tiap strata. Jumlah hasil sama dengan total
     * kecuali total melebihi seluruh populasi.
     *
     * @param  list<array{id: string, population: int}>  $strata
     * @return array<string, int>
     */
    public static function allocate(int $total, array $strata): array
    {
        $result = [];
        foreach ($strata as $s) {
            $result[$s['id']] = 0;
        }
        $remaining = max(0, $total);
        $open = array_values(array_filter($strata, fn (array $s) => $s['population'] > 0));
        while ($remaining > 0 && $open !== []) {
            $weight = array_sum(array_column($open, 'population'));
            $shares = array_map(fn (array $s) => ['s' => $s, 'exact' => $remaining * $s['population'] / $weight], $open);
            $given = 0;
            foreach ($shares as $share) {
                $room = $share['s']['population'] - $result[$share['s']['id']];
                $n = min((int) floor($share['exact']), $room);
                $result[$share['s']['id']] += $n;
                $given += $n;
            }
            $left = $remaining - $given;
            // Sisa ke pecahan terbesar; seri diputus menurut populasi lalu urutan masukan.
            $order = $shares;
            usort($order, function (array $a, array $b) {
                $fa = $a['exact'] - floor($a['exact']);
                $fb = $b['exact'] - floor($b['exact']);

                return $fb <=> $fa ?: $b['s']['population'] <=> $a['s']['population'];
            });
            foreach ($order as $share) {
                if ($left === 0) {
                    break;
                }
                if ($result[$share['s']['id']] < $share['s']['population']) {
                    $result[$share['s']['id']]++;
                    $left--;
                }
            }
            $remaining = $left;
            $open = array_values(array_filter($open, fn (array $s) => $result[$s['id']] < $s['population']));
        }

        return $result;
    }

    /**
     * Peserta dibagi rata ke sesi berkapasitas maksimal: 17 peserta dengan batas 8 menjadi 6, 6, 5.
     *
     * @return list<int>
     */
    public static function splitIntoSessions(int $participants, int $maxPerSession): array
    {
        if ($participants <= 0) {
            return [];
        }
        $sessions = (int) ceil($participants / max(1, $maxPerSession));
        $base = intdiv($participants, $sessions);
        $extra = $participants % $sessions;

        return array_map(fn (int $i) => $base + ($i < $extra ? 1 : 0), range(0, $sessions - 1));
    }

    /**
     * @param  list<array{id: string, code: string, group: string, population: int}>  $strata  group: MANAGEMENT, SUPERVISORY, FIELD
     * @return array{sessions: list<array{type: string, stratumId: string|null, stratumCode: string|null, layer: string, participantCount: int, sequence: int}>, interviews: int, focusGroupParticipants: int, siteVisits: int, virtualVisits: int, unallocated: array{interviews: int, focusGroupParticipants: int}}
     */
    public static function propose(int $interviewsManagement, int $interviewsOperational, int $projectsToVisit, array $strata, int $maxPerSession): array
    {
        $interviewStrata = array_values(array_filter($strata, fn (array $s) => in_array($s['group'], ['MANAGEMENT', 'SUPERVISORY'], true)));
        $focusStrata = array_values(array_filter($strata, fn (array $s) => in_array($s['group'], ['SUPERVISORY', 'FIELD'], true)));
        $interviewAlloc = self::allocate($interviewsManagement, $interviewStrata);
        $focusAlloc = self::allocate($interviewsOperational, $focusStrata);

        $sessions = [];
        foreach ($interviewStrata as $s) {
            for ($n = 1; $n <= $interviewAlloc[$s['id']]; $n++) {
                $sessions[] = ['type' => self::INTERVIEW, 'stratumId' => $s['id'], 'stratumCode' => $s['code'], 'layer' => $s['group'], 'participantCount' => 1, 'sequence' => $n];
            }
        }
        foreach ($focusStrata as $s) {
            foreach (self::splitIntoSessions($focusAlloc[$s['id']], $maxPerSession) as $i => $count) {
                $sessions[] = ['type' => self::FOCUS_GROUP, 'stratumId' => $s['id'], 'stratumCode' => $s['code'], 'layer' => $s['group'], 'participantCount' => $count, 'sequence' => $i + 1];
            }
        }
        // D6: kunjungan pertama selalu fisik, walaupun kalkulator tidak menyebut proyek yang dikunjungi.
        $visits = max(1, $projectsToVisit);
        for ($n = 1; $n <= $visits; $n++) {
            $sessions[] = ['type' => $n === 1 ? self::SITE_VISIT : self::VIRTUAL_SITE_VISIT, 'stratumId' => null, 'stratumCode' => null, 'layer' => 'FIELD', 'participantCount' => 0, 'sequence' => $n === 1 ? 1 : $n - 1];
        }

        return [
            'sessions' => $sessions,
            'interviews' => array_sum($interviewAlloc),
            'focusGroupParticipants' => array_sum($focusAlloc),
            'siteVisits' => 1,
            'virtualVisits' => $visits - 1,
            'unallocated' => [
                'interviews' => max(0, $interviewsManagement - array_sum($interviewAlloc)),
                'focusGroupParticipants' => max(0, $interviewsOperational - array_sum($focusAlloc)),
            ],
        ];
    }
}
