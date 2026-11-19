<?php

namespace App\Services\Files;

use App\Domain\Files\FileType;
use App\Models\Assessment;
use App\Models\PendingUpload;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Izin unggah dua langkah (docs/02 bagian 5): (1) pengguna meminta izin dan menerima tiket serta tujuan unggah,
 * (2) setelah berkas terunggah, pengguna menyelesaikan dengan tiket itu dan server memeriksa isinya. Tiket adalah id
 * baris pending_uploads, berlaku 15 menit, hanya untuk pengguna, asesmen, dan jenis unggahan yang sama.
 */
class UploadGrants
{
    public function __construct(private readonly ObjectStore $store) {}

    /**
     * @param  'EVIDENCE'|'OBSERVATION'  $kind
     * @param  array<string, mixed>  $data  data tambahan menurut jenis unggahan
     * @return array{ticket: string, upload: array{url: string, method: string, headers: array<string, string>}}
     */
    public function grant(string $kind, Assessment $assessment, User $user, string $fileName, int $size, string $contentType, string $extension, array $data): array
    {
        $folder = $kind === 'EVIDENCE' ? 'evidence' : 'observation';
        $upload = PendingUpload::create([
            'kind' => $kind,
            'assessment_id' => $assessment->id,
            'user_id' => $user->id,
            'storage_key' => $this->store->key($assessment->organization_id, $assessment->id, $folder, $extension),
            'file_name' => mb_substr($fileName, 0, 255),
            'declared_size' => $size,
            'data' => $data,
            'expires_at' => now()->addMinutes(ObjectStore::UPLOAD_TTL_MINUTES),
        ]);

        return ['ticket' => $upload->id, 'upload' => $this->store->uploadTarget($upload, $contentType)];
    }

    /**
     * Mengambil dan mengunci izin yang masih berlaku untuk diselesaikan, di dalam transaksi pemanggil. Null bila tiket
     * tidak dikenal, milik pengguna atau asesmen lain, jenisnya berbeda, atau sudah kedaluwarsa.
     */
    public function claim(string $ticket, string $kind, Assessment $assessment, User $user): ?PendingUpload
    {
        $upload = PendingUpload::whereKey($ticket)->lockForUpdate()->first();
        if (! $upload || $upload->kind !== $kind || $upload->assessment_id !== $assessment->id || $upload->user_id !== $user->id) {
            return null;
        }

        return $upload->expires_at->isFuture() ? $upload : null;
    }

    /**
     * Memeriksa objek terunggah terhadap izin: ada, ukuran sama dengan yang dinyatakan dan paling besar 25 MB, serta
     * jenis dari isi termasuk yang diizinkan dan sesuai ekstensi nama berkas. Objek yang gagal diperiksa dihapus.
     *
     * @param  list<string>  $allowed
     * @return array{ok: true, size: int, sha256: string, mime: string}|array{ok: false, code: string}
     */
    public function verify(PendingUpload $upload, array $allowed, bool $checkExtension): array
    {
        $inspected = $this->store->inspect($upload->storage_key);
        if ($inspected === null) {
            return ['ok' => false, 'code' => 'UPLOAD_MISSING'];
        }
        $reject = function (string $code) use ($upload): array {
            $this->discard($upload);

            return ['ok' => false, 'code' => $code];
        };
        if ($inspected['size'] > FileType::MAX_UPLOAD_BYTES) {
            return $reject('FILE_TOO_LARGE');
        }
        if ($inspected['size'] !== $upload->declared_size) {
            return $reject('FILE_SIZE_MISMATCH');
        }
        $detected = FileType::detect($inspected['head'], $upload->file_name);
        if ($detected === null || ! in_array($detected['mime'], $allowed, true)) {
            return $reject('FILE_TYPE');
        }
        if ($checkExtension && ! FileType::extensionMatches($detected['ext'], FileType::declaredExtension($upload->file_name))) {
            return $reject('FILE_TYPE');
        }

        return ['ok' => true, 'size' => $inspected['size'], 'sha256' => $inspected['sha256'], 'mime' => $detected['mime']];
    }

    /** Menghapus izin dan objeknya (unggahan ditolak). */
    public function discard(PendingUpload $upload): void
    {
        $this->store->delete($upload->storage_key);
        DB::table('pending_uploads')->where('id', $upload->id)->delete();
    }

    /** Izin selesai: baris dihapus, objek tetap karena kini dirujuk catatan bukti atau observasi. */
    public function complete(PendingUpload $upload): void
    {
        DB::table('pending_uploads')->where('id', $upload->id)->delete();
    }

    /** Menghapus izin yang kedaluwarsa lebih dari satu jam beserta objeknya. Mengembalikan jumlah yang dihapus. */
    public function prune(): int
    {
        $count = 0;
        PendingUpload::where('expires_at', '<', now()->subHour())->orderBy('expires_at')->chunkById(200, function ($uploads) use (&$count) {
            foreach ($uploads as $upload) {
                $this->discard($upload);
                $count++;
            }
        });

        return $count;
    }
}
