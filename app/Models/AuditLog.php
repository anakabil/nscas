<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Jejak audit. Hanya ditambah: pemicu basis data menolak UPDATE, DELETE, dan TRUNCATE (aturan 6).
 * Tulis melalui App\Support\Audit, jangan langsung.
 *
 * @property int $id
 * @property CarbonImmutable $occurred_at
 * @property int|null $actor_id
 * @property string|null $actor_role
 * @property string|null $organization_id
 * @property string|null $assessment_id
 * @property string $action
 * @property string|null $entity_type
 * @property string|null $entity_id
 * @property array<array-key, mixed>|null $changes
 * @property string|null $ip_hash
 */
#[Fillable(['actor_id', 'actor_role', 'organization_id', 'assessment_id', 'action', 'entity_type', 'entity_id', 'changes', 'ip_hash'])]
class AuditLog extends Model
{
    public $timestamps = false;

    protected function casts(): array
    {
        return ['occurred_at' => 'datetime', 'changes' => 'array'];
    }
}
