<?php

namespace App\Support;

use App\Domain\Access\Role;
use App\Models\Assessment;
use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

/**
 * Pencatat jejak audit (aturan 6). Setiap perubahan data asesmen, skor, keputusan panel, dan unggahan bukti
 * dicatat lewat sini. Nilai rahasia (kata sandi, token) tidak boleh dimasukkan ke $changes.
 */
final class Audit
{
    /**
     * @param  array<string, mixed>  $changes
     */
    public static function record(string $action, ?Model $entity = null, array $changes = [], ?Assessment $assessment = null, ?Role $actorRole = null): AuditLog
    {
        $assessment ??= $entity instanceof Assessment ? $entity : null;
        $ip = request()?->ip();

        return AuditLog::create([
            'actor_id' => Auth::id(),
            'actor_role' => $actorRole?->value,
            'organization_id' => $assessment?->organization_id,
            'assessment_id' => $assessment?->id,
            'action' => $action,
            'entity_type' => $entity ? class_basename($entity) : null,
            'entity_id' => $entity ? (string) $entity->getKey() : null,
            'changes' => $changes === [] ? null : $changes,
            // HMAC dengan kunci aplikasi: cukup untuk mengenali pola, tidak dapat dibalik menjadi alamat IP.
            'ip_hash' => $ip ? hash_hmac('sha256', $ip, (string) config('app.key')) : null,
        ]);
    }
}
