<?php

namespace App\Services\Evidence;

use App\Domain\Access\Role;
use App\Domain\Evidence\EvidenceChecklist;
use App\Domain\Evidence\EvidenceRules;
use App\Domain\Files\FileType;
use App\Models\Assessment;
use App\Models\Characteristic;
use App\Models\EvidenceItem;
use App\Models\EvidenceLink;
use App\Models\PendingUpload;
use App\Models\Unit;
use App\Models\User;
use App\Services\Files\UploadGrants;
use App\Support\Audit;
use App\Support\RuleViolation;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Penyimpanan bukti (docs/01 M5), dibawa dari v1 src/lib/evidence/service.ts. Berkas diunggah langsung dari peramban
 * ke penyimpanan objek; catatan bukti baru dibuat setelah ukuran, jenis dari isi, dan SHA-256 diperiksa. Koordinator
 * unit hanya melihat dan mengunggah bukti unitnya; bukti tingkat organisasi (tanpa unit) oleh administrator klien.
 */
class EvidenceService
{
    public const MAX_LINKS = 100;

    public const MAX_REQUIREMENTS_PER_LINK = 20;

    public function __construct(private readonly UploadGrants $grants) {}

    /**
     * Langkah 1: izin unggah untuk bukti baru atau versi baru.
     *
     * @param  list<string>|null  $unitScope
     * @param  array{fileName: string, size: int, contentType: string, title: string, description: string, unitId: ?string, supersedesId: ?string}  $input
     * @return array{ticket: string, upload: array{url: string, method: string, headers: array<string, string>}}
     */
    public function requestUpload(Assessment $assessment, User $user, ?array $unitScope, array $input): array
    {
        if ($input['size'] > FileType::MAX_UPLOAD_BYTES) {
            throw RuleViolation::invalid('file', 'FILE_TOO_LARGE');
        }
        $this->assertOpen($assessment);

        $unitId = $input['unitId'];
        if ($input['supersedesId'] !== null) {
            $previous = $this->current($assessment, $unitScope)->find($input['supersedesId']);
            if ($previous === null) {
                throw new RuleViolation(404, 'NOT_FOUND');
            }
            $unitId = $previous->unit_id;
        } elseif ($unitId !== null && ! Unit::where('assessment_id', $assessment->id)->whereKey($unitId)->exists()) {
            throw RuleViolation::invalid('unitId', 'NOT_FOUND');
        }
        if (! EvidenceRules::unitAllowed($unitScope, $unitId)) {
            throw RuleViolation::invalid('unitId', 'UNIT_OUT_OF_SCOPE');
        }

        $extension = FileType::declaredExtension($input['fileName']);
        // Jenis kiriman peramban hanya dipakai untuk header unggah; jenis sebenarnya diperiksa dari isi.
        $contentType = in_array($input['contentType'], FileType::EVIDENCE, true) ? $input['contentType'] : 'application/octet-stream';

        return $this->grants->grant('EVIDENCE', $assessment, $user, $input['fileName'], $input['size'], $contentType, $extension, [
            'title' => $input['title'],
            'description' => $input['description'],
            'unitId' => $unitId,
            'supersedesId' => $input['supersedesId'],
        ]);
    }

    /**
     * Langkah 2: menyelesaikan unggahan. Objek diperiksa (ada, ukuran sama dengan yang dinyatakan dan paling besar
     * 25 MB, jenis dari isi termasuk yang diizinkan dan sesuai ekstensi), lalu catatan bukti dibuat. Versi baru
     * mewarisi pemetaan versi sebelumnya bila pemetaan tidak dikirim.
     *
     * @param  list<string>|null  $unitScope
     * @param  list<array{characteristicId: string, requirementIds: list<string>}>|null  $links
     */
    public function finalize(Assessment $assessment, User $user, ?array $unitScope, Role $actorRole, string $ticket, ?array $links): EvidenceItem
    {
        $pending = PendingUpload::whereKey($ticket)->first();
        if ($pending === null || $pending->kind !== 'EVIDENCE' || $pending->assessment_id !== $assessment->id || $pending->user_id !== $user->id || $pending->expires_at->isPast()) {
            throw RuleViolation::invalid('file', 'UPLOAD_EXPIRED');
        }
        $verified = $this->grants->verify($pending, FileType::EVIDENCE, true);
        if (! $verified['ok']) {
            throw RuleViolation::invalid('file', $verified['code']);
        }

        try {
            return DB::transaction(function () use ($assessment, $user, $unitScope, $actorRole, $ticket, $links, $verified) {
                $pending = $this->grants->claim($ticket, 'EVIDENCE', $assessment, $user);
                if ($pending === null) {
                    throw RuleViolation::invalid('file', 'UPLOAD_EXPIRED');
                }
                $locked = $this->lockOpen($assessment);
                /** @var array{title: string, description: string, unitId: ?string, supersedesId: ?string} $data */
                $data = $pending->data;
                if (! EvidenceRules::unitAllowed($unitScope, $data['unitId'])) {
                    throw RuleViolation::invalid('unitId', 'UNIT_OUT_OF_SCOPE');
                }

                $version = 1;
                $inherited = [];
                if ($data['supersedesId'] !== null) {
                    $previous = EvidenceItem::where('assessment_id', $locked->id)->whereKey($data['supersedesId'])->lockForUpdate()->first();
                    if ($previous === null || $previous->deleted_at !== null || EvidenceItem::where('supersedes_id', $previous->id)->exists()) {
                        throw RuleViolation::locked('EVIDENCE_SUPERSEDED');
                    }
                    $version = $previous->version + 1;
                    $inherited = $previous->links->map(fn (EvidenceLink $l) => ['characteristicId' => $l->characteristic_id, 'requirementIds' => $l->requirement_ids])->all();
                }
                $resolved = $this->resolveLinks($locked, $links ?? $inherited);

                $item = EvidenceItem::create([
                    'assessment_id' => $locked->id,
                    'unit_id' => $data['unitId'],
                    'title' => $data['title'],
                    'description' => $data['description'] !== '' ? $data['description'] : null,
                    'file_name' => $pending->file_name,
                    'storage_key' => $pending->storage_key,
                    'sha256' => $verified['sha256'],
                    'mime_type' => $verified['mime'],
                    'size_bytes' => $verified['size'],
                    'version' => $version,
                    'supersedes_id' => $data['supersedesId'],
                    'uploaded_by_id' => $user->id,
                ]);
                foreach ($resolved as $link) {
                    $item->links()->create(['characteristic_id' => $link['characteristicId'], 'requirement_ids' => $link['requirementIds']]);
                }
                Audit::record($data['supersedesId'] !== null ? 'evidence.version' : 'evidence.upload', $item, ['after' => [
                    'title' => $data['title'],
                    'fileName' => $pending->file_name,
                    'sha256' => $verified['sha256'],
                    'mimeType' => $verified['mime'],
                    'sizeBytes' => $verified['size'],
                    'version' => $version,
                    'supersedesId' => $data['supersedesId'],
                    'unitId' => $data['unitId'],
                    'characteristics' => array_column($resolved, 'code'),
                ]], $locked, $actorRole);
                $this->grants->complete($pending);

                return $item;
            });
        } catch (\Throwable $e) {
            // Unggahan yang lolos pemeriksaan isi tetapi gagal disimpan tidak boleh meninggalkan berkas tanpa catatan.
            if ($e instanceof RuleViolation && $e->key === 'UPLOAD_EXPIRED') {
                throw $e;
            }
            $this->grants->discard($pending);
            throw $e;
        }
    }

    /**
     * Mengganti pemetaan bukti ke karakteristik dan butir daftar periksa.
     *
     * @param  list<string>|null  $unitScope
     * @param  list<array{characteristicId: string, requirementIds: list<string>}>  $links
     */
    public function updateLinks(Assessment $assessment, ?array $unitScope, Role $actorRole, string $evidenceId, array $links): void
    {
        DB::transaction(function () use ($assessment, $unitScope, $actorRole, $evidenceId, $links) {
            $locked = $this->lockOpen($assessment);
            $item = $this->current($locked, $unitScope)->with('links.characteristic:id,code')->lockForUpdate()->find($evidenceId);
            if ($item === null) {
                throw new RuleViolation(404, 'NOT_FOUND');
            }
            $resolved = $this->resolveLinks($locked, $links);
            $before = [
                'characteristics' => $item->links->map(fn (EvidenceLink $l) => $l->characteristic->code)->sort()->values()->all(),
                'requirementIds' => $item->links->flatMap(fn (EvidenceLink $l) => $l->requirement_ids)->values()->all(),
            ];
            $item->links()->delete();
            foreach ($resolved as $link) {
                $item->links()->create(['characteristic_id' => $link['characteristicId'], 'requirement_ids' => $link['requirementIds']]);
            }
            Audit::record('evidence.map', $item, [
                'before' => $before,
                'after' => [
                    'characteristics' => array_values(array_column($resolved, 'code')),
                    'requirementIds' => array_merge(...array_map(fn (array $l) => $l['requirementIds'], $resolved ?: [['requirementIds' => []]])),
                ],
            ], $locked, $actorRole);
        });
    }

    /**
     * Penghapusan logis (docs/04 bagian 6): berkas tetap tersimpan sampai pemusnahan data asesmen.
     *
     * @param  list<string>|null  $unitScope
     */
    public function delete(Assessment $assessment, ?array $unitScope, Role $actorRole, string $evidenceId): void
    {
        DB::transaction(function () use ($assessment, $unitScope, $actorRole, $evidenceId) {
            $locked = $this->lockOpen($assessment);
            $item = $this->current($locked, $unitScope)->lockForUpdate()->find($evidenceId);
            if ($item === null) {
                throw new RuleViolation(404, 'NOT_FOUND');
            }
            $item->forceFill(['deleted_at' => now()])->save();
            Audit::record('evidence.delete', $item, ['before' => ['title' => $item->title, 'version' => $item->version]], $locked, $actorRole);
        });
    }

    /**
     * Bukti versi terbaru yang belum dihapus, beserta riwayat versinya, terbaru lebih dulu.
     *
     * @param  list<string>|null  $unitScope
     * @return list<array<string, mixed>>
     */
    public function list(Assessment $assessment, ?array $unitScope): array
    {
        $all = $this->scoped($assessment, $unitScope)
            ->with(['unit:id,name', 'uploadedBy:id,name', 'links.characteristic:id,code'])
            ->orderByDesc('created_at')->orderByDesc('id')
            ->get();
        $byId = $all->keyBy('id');
        $superseded = $all->pluck('supersedes_id')->filter()->flip();

        return $all
            ->filter(fn (EvidenceItem $i) => $i->deleted_at === null && ! isset($superseded[$i->id]))
            ->map(function (EvidenceItem $i) use ($byId) {
                $history = [];
                $cursor = $i->supersedes_id !== null ? $byId->get($i->supersedes_id) : null;
                while ($cursor !== null) {
                    $history[] = ['id' => $cursor->id, 'version' => $cursor->version, 'createdAt' => $cursor->created_at->toIso8601String()];
                    $cursor = $cursor->supersedes_id !== null ? $byId->get($cursor->supersedes_id) : null;
                }

                return [
                    'id' => $i->id,
                    'title' => $i->title,
                    'description' => $i->description,
                    'fileName' => $i->file_name,
                    'mimeType' => $i->mime_type,
                    'sizeBytes' => $i->size_bytes,
                    'sha256' => $i->sha256,
                    'version' => $i->version,
                    'createdAt' => $i->created_at->toIso8601String(),
                    'unitId' => $i->unit_id,
                    'unitName' => $i->unit?->name,
                    'uploadedBy' => $i->uploadedBy?->name,
                    'links' => $i->links->map(fn (EvidenceLink $l) => [
                        'characteristicId' => $l->characteristic_id,
                        'code' => $l->characteristic->code,
                        'requirementIds' => $l->requirement_ids,
                    ])->sortBy('code')->values()->all(),
                    'previousVersions' => $history,
                ];
            })->values()->all();
    }

    /**
     * Daftar periksa per karakteristik dan ambang jenis bukti (docs/01 M5).
     *
     * @param  list<string>|null  $unitScope
     * @return array{minTypes: int, rows: list<array<string, mixed>>}
     */
    public function checklist(Assessment $assessment, ?array $unitScope): array
    {
        $characteristics = Characteristic::where('instrument_version_id', $assessment->instrument_version_id)
            ->orderBy('position')->with('evidenceRequirements')->get();
        $links = EvidenceLink::whereIn('evidence_item_id', $this->current($assessment, $unitScope)->select('id'))
            ->get(['evidence_item_id', 'characteristic_id', 'requirement_ids']);
        $minTypes = $this->minTypes($assessment);

        return [
            'minTypes' => $minTypes,
            'rows' => EvidenceChecklist::build(
                $characteristics->map(fn (Characteristic $c) => [
                    'id' => $c->id,
                    'code' => $c->code,
                    'name' => $c->name_id,
                    'requirements' => $c->evidenceRequirements->map(fn ($r) => ['id' => $r->id, 'description' => $r->description])->all(),
                ])->all(),
                $links->map(fn (EvidenceLink $l) => [
                    'evidenceItemId' => $l->evidence_item_id,
                    'characteristicId' => $l->characteristic_id,
                    'requirementIds' => array_values($l->requirement_ids),
                ])->all(),
                $minTypes,
            ),
        ];
    }

    /**
     * Data unduhan; versi lama dan bukti yang dihapus secara logis tetap dapat diunduh oleh yang berhak.
     *
     * @param  list<string>|null  $unitScope
     */
    public function forDownload(Assessment $assessment, ?array $unitScope, string $evidenceId): ?EvidenceItem
    {
        return $this->scoped($assessment, $unitScope)->find($evidenceId);
    }

    /** Ambang jenis bukti per karakteristik dari parameter terkunci, atau draf sebelum dikunci. */
    public function minTypes(Assessment $assessment): int
    {
        $quality = $assessment->parameter_snapshot['parameters']['quality'] ?? $assessment->parameter_draft['quality'] ?? [];

        return (int) ($quality['minEvidenceTypesPerCharacteristic'] ?? EvidenceChecklist::DEFAULT_MIN_TYPES);
    }

    /**
     * Bukti yang dapat dilihat pelaku: koordinator unit hanya bukti unitnya.
     *
     * @param  list<string>|null  $unitScope
     * @return Builder<EvidenceItem>
     */
    private function scoped(Assessment $assessment, ?array $unitScope): Builder
    {
        return EvidenceItem::where('assessment_id', $assessment->id)
            ->when($unitScope !== null, fn (Builder $q) => $q->whereIn('unit_id', $unitScope));
    }

    /**
     * Versi terbaru yang belum dihapus.
     *
     * @param  list<string>|null  $unitScope
     * @return Builder<EvidenceItem>
     */
    private function current(Assessment $assessment, ?array $unitScope): Builder
    {
        return $this->scoped($assessment, $unitScope)
            ->whereNull('deleted_at')
            ->whereNotExists(fn ($q) => $q->select(DB::raw(1))->from('evidence_items as newer')->whereColumn('newer.supersedes_id', 'evidence_items.id'));
    }

    /**
     * Memvalidasi karakteristik dan butir daftar periksa terhadap versi instrumen asesmen.
     *
     * @param  list<array{characteristicId: string, requirementIds: list<string>}>  $links
     * @return list<array{characteristicId: string, code: string, requirementIds: list<string>}>
     */
    private function resolveLinks(Assessment $assessment, array $links): array
    {
        $ids = array_values(array_unique(array_column($links, 'characteristicId')));
        if ($ids === []) {
            return [];
        }
        $characteristics = Characteristic::where('instrument_version_id', $assessment->instrument_version_id)
            ->whereIn('id', $ids)->with('evidenceRequirements:id,characteristic_id')->get()->keyBy('id');
        if ($characteristics->count() !== count($ids)) {
            throw RuleViolation::invalid('links', 'UNKNOWN_ITEM');
        }
        $resolved = [];
        foreach ($ids as $id) {
            $requested = array_values(array_unique(array_merge(...array_map(
                fn (array $l) => $l['requirementIds'],
                array_values(array_filter($links, fn (array $l) => $l['characteristicId'] === $id)),
            ))));
            $allowed = $characteristics[$id]->evidenceRequirements->pluck('id')->all();
            if (array_diff($requested, $allowed) !== []) {
                throw RuleViolation::invalid('links', 'UNKNOWN_ITEM');
            }
            $resolved[] = ['characteristicId' => $id, 'code' => $characteristics[$id]->code, 'requirementIds' => $requested];
        }
        usort($resolved, fn (array $a, array $b) => strcmp($a['code'], $b['code']));

        return $resolved;
    }

    private function assertOpen(Assessment $assessment): void
    {
        if (! EvidenceRules::uploadOpen($assessment->status)) {
            throw RuleViolation::locked('EVIDENCE_CLOSED');
        }
    }

    private function lockOpen(Assessment $assessment): Assessment
    {
        $locked = Assessment::whereKey($assessment->id)->lockForUpdate()->firstOrFail();
        $this->assertOpen($locked);

        return $locked;
    }
}
