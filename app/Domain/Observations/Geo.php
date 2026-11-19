<?php

declare(strict_types=1);

namespace App\Domain\Observations;

/** Jarak titik observasi ke titik proyek (docs/01 M6), dibawa dari v1 src/lib/observations/geo.ts. Murni. */
final class Geo
{
    private const EARTH_RADIUS_METERS = 6_371_008.8;

    /** Jarak lingkaran besar (haversine) dalam meter. */
    public static function haversineMeters(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);
        $h = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon / 2) ** 2;

        return 2 * self::EARTH_RADIUS_METERS * asin(min(1.0, sqrt($h)));
    }

    /**
     * Ditandai bila titik berada di luar radius; lokasi yang tidak tersedia tidak dianggap di luar radius.
     *
     * @param  array{latitude: float, longitude: float}|null  $point
     * @return array{distanceMeters: float|null, outsideRadius: bool}
     */
    public static function checkRadius(float $siteLat, float $siteLon, int $radiusMeters, ?array $point): array
    {
        if ($point === null) {
            return ['distanceMeters' => null, 'outsideRadius' => false];
        }
        $distance = self::haversineMeters($siteLat, $siteLon, $point['latitude'], $point['longitude']);

        return ['distanceMeters' => $distance, 'outsideRadius' => $distance > $radiusMeters];
    }
}
