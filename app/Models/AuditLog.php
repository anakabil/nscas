<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Jejak audit. Hanya ditambah: pemicu basis data menolak UPDATE, DELETE, dan TRUNCATE (aturan 6).
 * Tulis melalui App\Support\Audit, jangan langsung.
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
