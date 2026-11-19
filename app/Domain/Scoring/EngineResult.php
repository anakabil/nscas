<?php

declare(strict_types=1);

namespace App\Domain\Scoring;

/** Keluaran lengkap mesin penilaian (docs/03 bagian 9). Nilai berpresisi penuh; pembulatan hanya saat ditampilkan. */
final readonly class EngineResult
{
    /**
     * @param  list<CharacteristicResult>  $characteristics  Dalam urutan masukan.
     * @param  array<string, AspectResult>  $aspects  Berkunci kode aspek, dalam urutan parameter; tanpa aspek kontekstual.
     * @param  SclTrackResult|null  $sclTrack  Null bila pemenuhan jalur setara tidak diberikan.
     */
    public function __construct(
        public string $engineVersion,
        public array $characteristics,
        public array $aspects,
        public OrganizationResult $organization,
        public ?SclTrackResult $sclTrack = null,
    ) {}

    /**
     * Bentuk larik yang sama dengan EngineResult pada docs/03 bagian 9, siap disimpan sebagai JSON.
     * Kunci sclTrack tidak disertakan bila jalur setara tidak dihitung.
     *
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        $out = [
            'engineVersion' => $this->engineVersion,
            'characteristics' => array_map(
                static fn (CharacteristicResult $c): array => $c->toArray(),
                array_values($this->characteristics),
            ),
            'aspects' => array_map(static fn (AspectResult $a): array => $a->toArray(), $this->aspects),
            'organization' => $this->organization->toArray(),
        ];
        if ($this->sclTrack !== null) {
            $out['sclTrack'] = $this->sclTrack->toArray();
        }

        return $out;
    }
}
