<?php

declare(strict_types=1);

namespace Tests\Unit\Domain\Observations;

use App\Domain\Observations\Geo;
use App\Domain\Observations\ObservationRules;
use App\Domain\Workflow\AssessmentStatus;
use DateTimeImmutable;
use PHPUnit\Framework\TestCase;

/** Dibawa dari v1 src/lib/observations/__tests__/geo.test.ts. */
class GeoTest extends TestCase
{
    public function test_haversine_matches_a_known_distance(): void
    {
        // Monas ke Bundaran HI, sekitar 2,2 km.
        $d = Geo::haversineMeters(-6.1754, 106.8272, -6.1951, 106.8231);
        $this->assertGreaterThan(2_150, $d);
        $this->assertLessThan(2_300, $d);
        $this->assertSame(0.0, Geo::haversineMeters(0, 0, 0, 0));
    }

    public function test_flags_points_outside_the_radius_but_not_missing_locations(): void
    {
        $this->assertFalse(Geo::checkRadius(-6.2088, 106.8456, 500, ['latitude' => -6.2088, 'longitude' => 106.8486])['outsideRadius']);
        $far = Geo::checkRadius(-6.2088, 106.8456, 500, ['latitude' => -6.2188, 'longitude' => 106.8456]);
        $this->assertTrue($far['outsideRadius']);
        $this->assertGreaterThan(1_000, $far['distanceMeters']);
        $this->assertSame(['distanceMeters' => null, 'outsideRadius' => false], Geo::checkRadius(-6.2088, 106.8456, 500, null));
    }

    public function test_checklist_has_one_item_per_line_with_sequential_codes(): void
    {
        $this->assertSame([
            ['code' => 'O1', 'label' => 'Pemakaian alat pelindung diri'],
            ['code' => 'O2', 'label' => 'Rambu dan pembatas area'],
            ['code' => 'O3', 'label' => 'Kebersihan area kerja'],
        ], ObservationRules::parseChecklist("Pemakaian alat pelindung diri\n\n  Rambu dan pembatas area  \r\nKebersihan area kerja"));
        $this->assertCount(50, ObservationRules::parseChecklist(implode("\n", array_fill(0, 60, 'butir'))));
        $this->assertSame(300, mb_strlen(ObservationRules::parseChecklist(str_repeat('é', 400))[0]['label']));
    }

    public function test_window_is_open_only_between_its_times_while_collecting_data(): void
    {
        $opens = new DateTimeImmutable('2026-12-01T08:00:00+07:00');
        $closes = new DateTimeImmutable('2026-12-01T17:00:00+07:00');
        $during = new DateTimeImmutable('2026-12-01T09:00:00+07:00');
        $this->assertTrue(ObservationRules::windowOpen(AssessmentStatus::DataCollection, $opens, $closes, $during));
        $this->assertFalse(ObservationRules::windowOpen(AssessmentStatus::DataCollection, $opens, $closes, $closes));
        $this->assertFalse(ObservationRules::windowOpen(AssessmentStatus::DataCollection, $opens, $closes, new DateTimeImmutable('2026-12-01T07:59:00+07:00')));
        $this->assertFalse(ObservationRules::windowOpen(AssessmentStatus::Validation, $opens, $closes, $during));
    }
}
