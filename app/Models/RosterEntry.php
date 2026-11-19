<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Satu orang pada daftar responden (docs/01 M2). Surel dan telepon dienkripsi dengan kunci aplikasi (docs/04 bagian 4);
 * email_hash (HMAC) hanya untuk mencegah responden ganda. Tidak pernah dirujuk oleh jawaban survei (aturan 2).
 *
 * @property string $id
 * @property string $assessment_id
 * @property string $unit_id
 * @property string $stratum_id
 * @property string $full_name
 * @property string|null $employee_no
 * @property string|null $email
 * @property string|null $email_hash
 * @property string|null $phone
 * @property bool $is_contractor
 */
#[Fillable(['assessment_id', 'unit_id', 'stratum_id', 'full_name', 'employee_no', 'email', 'email_hash', 'phone', 'is_contractor'])]
#[Hidden(['email', 'phone', 'email_hash'])]
class RosterEntry extends Model
{
    use HasUlids;

    protected function casts(): array
    {
        return ['email' => 'encrypted', 'phone' => 'encrypted', 'is_contractor' => 'boolean'];
    }

    /** HMAC alamat surel dengan kunci aplikasi: cukup untuk mengenali duplikat, tidak dapat dibalik. */
    public static function emailHash(string $email): string
    {
        return hash_hmac('sha256', mb_strtolower(trim($email)), (string) config('app.key'));
    }

    /** @return BelongsTo<Unit, $this> */
    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    /** @return BelongsTo<Stratum, $this> */
    public function stratum(): BelongsTo
    {
        return $this->belongsTo(Stratum::class);
    }

    /** @return HasMany<AccessToken, $this> */
    public function tokens(): HasMany
    {
        return $this->hasMany(AccessToken::class);
    }
}
