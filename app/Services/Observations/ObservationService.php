<?php

namespace App\Services\Observations;

use App\Domain\Access\Role;
use App\Domain\Files\FileType;
use App\Domain\Observations\Geo;
use App\Domain\Observations\ObservationRules;
use App\Models\Assessment;
use App\Models\ObservationCapture;
use App\Models\ObservationWindow;
use App\Models\PendingUpload;
use App\Models\Unit;
use App\Models\User;
use App\Services\Files\UploadGrants;
use App\Support\Audit;
use App\Support\RuleViolation;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Observasi lapangan (docs/01 M6), dibawa dari v1 src/lib/observations/service.ts. Asesor membuka jendela observasi
 * per proyek; koordinator mengambil foto atau video langsung dari kamera. Waktu pengambilan adalah waktu server saat
 * izin unggah diminta, bukan waktu perangkat. Pengambilan di luar jendela waktu ditolak; di luar radius diterima
 * tetapi ditandai.
 */
class ObservationService
{
    /** Ekstensi berkas tersimpan menurut jenis rekaman kamera. */
    private const CAPTURE_EXTENSIONS = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'video/webm' => 'webm',
        'video/mp4' => 'mp4',
        'video/quicktime' => 'mov',
    ];

    public function __construct(private readonly UploadGrants $grants) {}

    /**
     * @param  array{unitId: string, title: string, opensAt: CarbonInterface, closesAt: CarbonInterface, checklist: string, latitude: float, longitude: float, radiusMeters: int}  $input
     */
    public function createWindow(Assessment $assessment, User $user, Role $actorRole, array $input): ObservationWindow
    {
        return DB::transaction(function () use ($assessment, $user, $actorRole, $input) {
            $locked = Assessment::whereKey($assessment->id)->lockForUpdate()->firstOrFail();
            if (! ObservationRules::statusAllows($locked->status)) {
                throw RuleViolation::locked('OBSERVATION_CLOSED');
            }
            $unit = Unit::where('assessment_id', $locked->id)->find($input['unitId']);
            if ($unit === null) {
                throw RuleViolation::invalid('unitId', 'NOT_FOUND');
            }
            if ($input['closesAt']->lessThanOrEqualTo($input['opensAt'])) {
                throw RuleViolation::invalid('closesAt', 'WINDOW_ORDER');
            }
            $checklist = ObservationRules::parseChecklist($input['checklist']);
            if ($checklist === []) {
                throw RuleViolation::invalid('checklist', 'CHECKLIST_REQUIRED');
            }
            $window = ObservationWindow::create([
                'assessment_id' => $locked->id,
                'unit_id' => $unit->id,
                'title' => $input['title'],
                'opens_at' => $input['opensAt']->utc(),
                'closes_at' => $input['closesAt']->utc(),
                'checklist' => $checklist,
                'latitude' => $input['latitude'],
                'longitude' => $input['longitude'],
                'radius_meters' => $input['radiusMeters'],
                'created_by_id' => $user->id,
            ]);
            Audit::record('observation.window_create', $window, ['after' => [
                'unit' => $unit->name,
                'title' => $input['title'],
                'opensAt' => $window->opens_at->toIso8601String(),
                'closesAt' => $window->closes_at->toIso8601String(),
                'checklist' => $checklist,
                'latitude' => $input['latitude'],
                'longitude' => $input['longitude'],
                'radiusMeters' => $input['radiusMeters'],
            ]], $locked, $actorRole);

            return $window;
        });
    }

    /**
     * Jendela observasi beserta rekamannya, terbaru lebih dulu. Koordinator hanya melihat jendela unitnya.
     *
     * @param  list<string>|null  $unitScope
     * @return list<array<string, mixed>>
     */
    public function list(Assessment $assessment, ?array $unitScope): array
    {
        $now = now();

        return $this->windows($assessment, $unitScope)
            ->with(['unit:id,name', 'captures' => fn ($q) => $q->orderByDesc('server_captured_at')->with('uploadedBy:id,name')])
            ->orderByDesc('opens_at')->orderByDesc('id')
            ->get()
            ->map(fn (ObservationWindow $w) => [
                'id' => $w->id,
                'title' => $w->title,
                'unitId' => $w->unit_id,
                'unitName' => $w->unit->name,
                'opensAt' => $w->opens_at->toIso8601String(),
                'closesAt' => $w->closes_at->toIso8601String(),
                'state' => $w->opens_at->isAfter($now) ? 'UPCOMING' : ($w->closes_at->isAfter($now) ? 'OPEN' : 'CLOSED'),
                'open' => ObservationRules::windowOpen($assessment->status, $w->opens_at, $w->closes_at, $now),
                'checklist' => $w->checklist,
                'latitude' => $w->latitude,
                'longitude' => $w->longitude,
                'radiusMeters' => $w->radius_meters,
                'captures' => $w->captures->map(fn (ObservationCapture $c) => [
                    'id' => $c->id,
                    'code' => $c->checklist_item_code,
                    'mimeType' => $c->mime_type,
                    'capturedAt' => $c->server_captured_at->toIso8601String(),
                    'accuracyMeters' => $c->accuracy_meters,
                    'distanceMeters' => $c->distance_meters,
                    'outsideRadius' => $c->outside_radius,
                    'hasLocation' => $c->latitude !== null,
                    'note' => $c->note,
                    'uploadedBy' => $c->uploadedBy?->name,
                ])->all(),
            ])->all();
    }

    /**
     * Satu jendela untuk halaman kamera, dengan jumlah rekaman per butir.
     *
     * @param  list<string>|null  $unitScope
     */
    public function windowFor(Assessment $assessment, ?array $unitScope, string $windowId): ?ObservationWindow
    {
        return $this->windows($assessment, $unitScope)->with('unit:id,name')->withCount('captures')->find($windowId);
    }

    /** @return array<string, int> */
    public function countsByItem(ObservationWindow $window): array
    {
        return ObservationCapture::where('observation_window_id', $window->id)
            ->selectRaw('checklist_item_code, count(*) as total')->groupBy('checklist_item_code')
            ->pluck('total', 'checklist_item_code')->map(fn ($n) => (int) $n)->all();
    }

    /**
     * Langkah 1: izin unggah satu rekaman. Waktu server saat ini menjadi waktu pengambilan; jarak ke titik proyek
     * dihitung dari lokasi peramban.
     *
     * @param  list<string>|null  $unitScope
     * @param  array{checklistItemCode: string, contentType: string, size: int, location: array{latitude: float, longitude: float, accuracy: float}|null}  $input
     * @return array{ticket: string, upload: array{url: string, method: string, headers: array<string, string>}, outsideRadius: bool, distanceMeters: float|null}
     */
    public function requestCapture(Assessment $assessment, User $user, ?array $unitScope, string $windowId, array $input): array
    {
        if ($input['size'] > FileType::MAX_UPLOAD_BYTES) {
            throw RuleViolation::invalid('file', 'FILE_TOO_LARGE');
        }
        $window = $this->windowFor($assessment, $unitScope, $windowId);
        if ($window === null) {
            throw new RuleViolation(404, 'NOT_FOUND');
        }
        $now = now();
        if (! ObservationRules::windowOpen($assessment->status, $window->opens_at, $window->closes_at, $now)) {
            throw RuleViolation::locked('OUTSIDE_WINDOW');
        }
        if (! in_array($input['checklistItemCode'], array_column($window->checklist, 'code'), true)) {
            throw RuleViolation::invalid('checklistItemCode', 'UNKNOWN_ITEM');
        }
        $extension = self::CAPTURE_EXTENSIONS[$input['contentType']] ?? null;
        if ($extension === null) {
            throw RuleViolation::invalid('file', 'CAMERA_ONLY');
        }
        $location = $input['location'];
        $radius = Geo::checkRadius($window->latitude, $window->longitude, $window->radius_meters, $location === null ? null : [
            'latitude' => $location['latitude'],
            'longitude' => $location['longitude'],
        ]);
        $grant = $this->grants->grant('OBSERVATION', $assessment, $user, "observasi.{$extension}", $input['size'], $input['contentType'], $extension, [
            'windowId' => $window->id,
            'checklistItemCode' => $input['checklistItemCode'],
            'serverCapturedAt' => $now->toIso8601String(),
            'latitude' => $location['latitude'] ?? null,
            'longitude' => $location['longitude'] ?? null,
            'accuracyMeters' => $location['accuracy'] ?? null,
            'distanceMeters' => $radius['distanceMeters'],
            'outsideRadius' => $radius['outsideRadius'],
        ]);

        return [...$grant, 'outsideRadius' => $radius['outsideRadius'], 'distanceMeters' => $radius['distanceMeters']];
    }

    /**
     * Langkah 2: rekaman diperiksa (ada, ukuran sama, jenis dari isi berupa foto atau video), lalu dicatat.
     *
     * @param  list<string>|null  $unitScope
     */
    public function finalizeCapture(Assessment $assessment, User $user, ?array $unitScope, Role $actorRole, string $ticket, string $note): ObservationCapture
    {
        $pending = PendingUpload::whereKey($ticket)->first();
        if ($pending === null || $pending->kind !== 'OBSERVATION' || $pending->assessment_id !== $assessment->id || $pending->user_id !== $user->id || $pending->expires_at->isPast()) {
            throw RuleViolation::invalid('file', 'UPLOAD_EXPIRED');
        }
        $verified = $this->grants->verify($pending, FileType::OBSERVATION, false);
        if (! $verified['ok']) {
            throw RuleViolation::invalid('file', $verified['code']);
        }

        try {
            return DB::transaction(function () use ($assessment, $user, $unitScope, $actorRole, $ticket, $note, $verified) {
                $pending = $this->grants->claim($ticket, 'OBSERVATION', $assessment, $user);
                if ($pending === null) {
                    throw RuleViolation::invalid('file', 'UPLOAD_EXPIRED');
                }
                /** @var array{windowId: string, checklistItemCode: string, serverCapturedAt: string, latitude: float|null, longitude: float|null, accuracyMeters: float|null, distanceMeters: float|null, outsideRadius: bool} $d */
                $d = $pending->data;
                $window = $this->windows($assessment, $unitScope)->find($d['windowId']);
                if ($window === null) {
                    throw new RuleViolation(404, 'NOT_FOUND');
                }
                $note = trim($note);
                $capture = ObservationCapture::create([
                    'observation_window_id' => $window->id,
                    'checklist_item_code' => $d['checklistItemCode'],
                    'storage_key' => $pending->storage_key,
                    'sha256' => $verified['sha256'],
                    'mime_type' => $verified['mime'],
                    'size_bytes' => $verified['size'],
                    'server_captured_at' => $d['serverCapturedAt'],
                    'latitude' => $d['latitude'],
                    'longitude' => $d['longitude'],
                    'accuracy_meters' => $d['accuracyMeters'],
                    'distance_meters' => $d['distanceMeters'],
                    'outside_radius' => $d['outsideRadius'],
                    'note' => $note !== '' ? mb_substr($note, 0, ObservationRules::NOTE_MAX) : null,
                    'uploaded_by_id' => $user->id,
                ]);
                Audit::record('observation.capture', $capture, ['after' => [
                    'windowId' => $window->id,
                    'checklistItemCode' => $d['checklistItemCode'],
                    'sha256' => $verified['sha256'],
                    'mimeType' => $verified['mime'],
                    'serverCapturedAt' => $d['serverCapturedAt'],
                    'accuracyMeters' => $d['accuracyMeters'],
                    'distanceMeters' => $d['distanceMeters'],
                    'outsideRadius' => $d['outsideRadius'],
                ]], $assessment, $actorRole);
                $this->grants->complete($pending);

                return $capture;
            });
        } catch (\Throwable $e) {
            if ($e instanceof RuleViolation && $e->key === 'UPLOAD_EXPIRED') {
                throw $e;
            }
            $this->grants->discard($pending);
            throw $e;
        }
    }

    /** @param  list<string>|null  $unitScope */
    public function captureForDownload(Assessment $assessment, ?array $unitScope, string $captureId): ?ObservationCapture
    {
        return ObservationCapture::whereIn('observation_window_id', $this->windows($assessment, $unitScope)->select('id'))->find($captureId);
    }

    /**
     * @param  list<string>|null  $unitScope
     * @return Builder<ObservationWindow>
     */
    private function windows(Assessment $assessment, ?array $unitScope): Builder
    {
        return ObservationWindow::where('assessment_id', $assessment->id)
            ->when($unitScope !== null, fn (Builder $q) => $q->whereIn('unit_id', $unitScope));
    }
}
