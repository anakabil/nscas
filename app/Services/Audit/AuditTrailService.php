<?php

namespace App\Services\Audit;

use App\Domain\Access\Role;
use App\Domain\Audit\AuditCsv;
use App\Models\Assessment;
use App\Models\AuditLog;
use App\Models\User;
use App\Support\Audit;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

/**
 * Pembacaan dan ekspor jejak audit satu asesmen (docs/04 bagian 6), dibawa dari v1 (src/lib/audit-trail/service.ts).
 * Tabel audit_logs hanya dibaca di sini; penulisan tetap melalui App\Support\Audit. Pengelola sistem dan asesor
 * utama melihat isi perubahan; administrator klien melihat ringkasan tanpa isi perubahan.
 */
class AuditTrailService
{
    public const PAGE_SIZE = 50;

    public const EXPORT_LIMIT = 50_000;

    /** @param  list<Role>  $roles */
    public static function full(array $roles): bool
    {
        return in_array(Role::SuperAdmin, $roles, true) || in_array(Role::LeadAssessor, $roles, true);
    }

    /** @param  list<Role>  $roles */
    public static function canExport(array $roles): bool
    {
        return in_array(Role::LeadAssessor, $roles, true);
    }

    /**
     * Kategori yang benar-benar muncul pada jejak asesmen ini, untuk pilihan penyaring.
     *
     * @return list<string>
     */
    public function categories(Assessment $assessment): array
    {
        return $this->base($assessment)->selectRaw("distinct split_part(action, '.', 1) as category")->orderBy('category')
            ->pluck('category')->map(fn ($c) => (string) $c)->values()->all();
    }

    /**
     * @param  array{category?: ?string, from?: ?string, to?: ?string, page?: int}  $filters  tanggal dalam WIB (Y-m-d)
     * @return array{entries: list<array<string, mixed>>, total: int, page: int, pages: int}
     */
    public function page(Assessment $assessment, array $filters, bool $full): array
    {
        $query = $this->filtered($assessment, $filters);
        $total = (clone $query)->count();
        $pages = max(1, (int) ceil($total / self::PAGE_SIZE));
        $page = min(max(1, (int) ($filters['page'] ?? 1)), $pages);
        $rows = $query->orderByDesc('occurred_at')->orderByDesc('id')->forPage($page, self::PAGE_SIZE)->get();

        /** @var list<AuditLog> $list */
        $list = $rows->all();

        return ['entries' => $this->present($list, $full), 'total' => $total, 'page' => $page, 'pages' => $pages];
    }

    /**
     * Ekspor CSV lengkap untuk asesor utama, urut dari yang terlama; ekspor itu sendiri dicatat sebagai audit.export.
     *
     * @param  array{category?: ?string, from?: ?string, to?: ?string}  $filters
     * @return array{csv: string, rows: int}
     */
    public function export(Assessment $assessment, array $filters, string $locale): array
    {
        $rows = $this->filtered($assessment, $filters)->orderBy('occurred_at')->orderBy('id')->limit(self::EXPORT_LIMIT)->get();
        /** @var list<AuditLog> $list */
        $list = $rows->all();
        $entries = $this->present($list, true);
        $label = fn (string $key) => __('audit.csv.'.$key, [], $locale);
        $header = array_map($label, ['at', 'atWib', 'action', 'entityType', 'entityId', 'actor', 'actorEmail', 'role', 'ipHash', 'changes']);
        $lines = [$header];
        foreach ($entries as $e) {
            $lines[] = [
                $e['at'],
                CarbonImmutable::parse($e['at'])->setTimezone('Asia/Jakarta')->format('Y-m-d H:i:s'),
                $e['action'],
                $e['entityType'],
                $e['entityId'],
                $e['actor'] ?? __('audit.system', [], $locale),
                $e['actorEmail'],
                $e['role'],
                $e['ipHash'],
                $e['changes'] === null ? null : json_encode($e['changes'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ];
        }
        Audit::record('audit.export', $assessment, ['after' => ['rows' => count($entries), 'filters' => array_filter($filters)]], actorRole: Role::LeadAssessor);

        return ['csv' => AuditCsv::document($lines), 'rows' => count($entries)];
    }

    /** Penyaring tenant: catatan asesmen ini milik organisasinya, atau dari tugas sistem tanpa organisasi. */
    private function base(Assessment $assessment): Builder
    {
        return AuditLog::query()->where('assessment_id', $assessment->id)
            ->where(fn (Builder $q) => $q->where('organization_id', $assessment->organization_id)->orWhereNull('organization_id'));
    }

    /** @param  array{category?: ?string, from?: ?string, to?: ?string}  $filters */
    private function filtered(Assessment $assessment, array $filters): Builder
    {
        $query = $this->base($assessment);
        if (! empty($filters['category'])) {
            $query->where('action', 'like', str_replace(['%', '_'], ['\%', '\_'], $filters['category']).'.%');
        }
        if (! empty($filters['from'])) {
            $query->where('occurred_at', '>=', CarbonImmutable::parse($filters['from'], 'Asia/Jakarta')->startOfDay()->utc());
        }
        if (! empty($filters['to'])) {
            $query->where('occurred_at', '<', CarbonImmutable::parse($filters['to'], 'Asia/Jakarta')->addDay()->startOfDay()->utc());
        }

        return $query;
    }

    /**
     * @param  list<AuditLog>  $rows
     * @return list<array<string, mixed>>
     */
    private function present(array $rows, bool $full): array
    {
        $actorIds = array_values(array_unique(array_filter(array_map(fn (AuditLog $r) => $r->actor_id, $rows))));
        $users = $actorIds === [] ? collect() : User::whereIn('id', $actorIds)->get(['id', 'name', 'email'])->keyBy('id');

        return array_map(function (AuditLog $r) use ($users, $full) {
            $user = $r->actor_id ? $users->get($r->actor_id) : null;

            return [
                'id' => $r->id,
                'at' => $r->occurred_at->toIso8601String(),
                'action' => $r->action,
                'entityType' => $r->entity_type,
                'entityId' => $full ? $r->entity_id : null,
                'actor' => $user?->name,
                'actorEmail' => $full ? $user?->email : null,
                'role' => $r->actor_role,
                'ipHash' => $full ? $r->ip_hash : null,
                'changes' => $full ? $r->changes : null,
            ];
        }, $rows);
    }
}
