<?php

declare(strict_types=1);

namespace Tests\Unit\Domain;

use App\Domain\Validation\Triangulation;
use PHPUnit\Framework\TestCase;

final class TriangulationTest extends TestCase
{
    public function test_site_index_counts_partial_as_half_and_ignores_items_not_checked(): void
    {
        $this->assertNull(Triangulation::siteIndex([]));
        $this->assertNull(Triangulation::siteIndex(['NOT_OBSERVED']));
        // (2 + 0,5) / 4 = 0,625
        $this->assertEqualsWithDelta(0.625, Triangulation::siteIndex(['MEETS', 'MEETS', 'PARTIAL', 'NOT_MET', 'NOT_OBSERVED']), 1e-9);
    }

    public function test_sources_are_summarised_per_characteristic_with_a_divergence_marker(): void
    {
        $ratings = [
            ['code' => 'K1.1', 'type' => 'INTERVIEW', 'layer' => 'MANAGEMENT', 'level' => 4.0, 'evidence' => 'CONSISTENT', 'agreement' => null],
            ['code' => 'K1.1', 'type' => 'FOCUS_GROUP', 'layer' => 'FIELD', 'level' => 4.0, 'evidence' => 'PARTIAL', 'agreement' => 'MIXED'],
            ['code' => 'K4.2', 'type' => 'INTERVIEW', 'layer' => 'SUPERVISORY', 'level' => 3.0, 'evidence' => null, 'agreement' => null],
        ];
        $checks = [
            ['code' => 'K1.1', 'result' => 'NOT_MET', 'unitId' => 'U1'],
            ['code' => 'K1.1', 'result' => 'PARTIAL', 'unitId' => 'U1'],
            ['code' => 'K4.2', 'result' => 'PARTIAL', 'unitId' => 'U1'],
        ];
        $s = Triangulation::summarize(['K1.1', 'K4.2', 'K5.1'], $ratings, $checks);

        $this->assertSame(2, $s['K1.1']['talks']['n']);
        $this->assertEqualsWithDelta(4.0, $s['K1.1']['talks']['mean'], 1e-9);
        $this->assertSame(['MANAGEMENT' => 4.0, 'FIELD' => 4.0], $s['K1.1']['talks']['byLayer']);
        $this->assertSame(['CONSISTENT' => 1, 'PARTIAL' => 1, 'NONE' => 0], $s['K1.1']['talks']['evidence']);
        $this->assertSame(['AGREED' => 0, 'MIXED' => 1, 'DIVIDED' => 0], $s['K1.1']['talks']['agreement']);
        // Sesi (4 - 1) / 4 = 0,75 dan kunjungan 0,25: selisih 0,50, perlu dibahas.
        $this->assertEqualsWithDelta(0.25, $s['K1.1']['site']['index'], 1e-9);
        $this->assertTrue($s['K1.1']['divergent']);
        // Sesi 0,50 dan kunjungan 0,50: sejalan.
        $this->assertFalse($s['K4.2']['divergent']);
        $this->assertSame(0, $s['K5.1']['talks']['n']);
        $this->assertNull($s['K5.1']['site']['index']);
        $this->assertFalse($s['K5.1']['divergent']);
    }

    public function test_ratings_given_on_site_visit_sessions_are_not_counted_as_talks(): void
    {
        $ratings = [
            ['code' => 'K1.1', 'type' => 'INTERVIEW', 'layer' => 'MANAGEMENT', 'level' => 5.0, 'evidence' => null, 'agreement' => null],
            ['code' => 'K1.1', 'type' => 'INTERVIEW', 'layer' => 'MANAGEMENT', 'level' => 5.0, 'evidence' => null, 'agreement' => null],
            ['code' => 'K1.1', 'type' => 'SITE_VISIT', 'layer' => 'FIELD', 'level' => 2.0, 'evidence' => null, 'agreement' => null],
            ['code' => 'K1.1', 'type' => 'VIRTUAL_SITE_VISIT', 'layer' => 'FIELD', 'level' => 2.0, 'evidence' => null, 'agreement' => null],
        ];
        $checks = [['code' => 'K1.1', 'result' => 'PARTIAL', 'unitId' => 'U1'], ['code' => 'K1.1', 'result' => 'NOT_MET', 'unitId' => 'U1']];
        $s = Triangulation::summarize(['K1.1'], $ratings, $checks);

        // Hanya dua wawancara: rerata 5,0 (setara 1,0) terhadap indeks kunjungan 0,25, tetap perlu dibahas.
        $this->assertSame(2, $s['K1.1']['talks']['n']);
        $this->assertEqualsWithDelta(5.0, $s['K1.1']['talks']['mean'], 1e-9);
        $this->assertSame(['MANAGEMENT' => 5.0], $s['K1.1']['talks']['byLayer']);
        $this->assertTrue($s['K1.1']['divergent']);
    }
}
