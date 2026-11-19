<?php

namespace App\Services\Files;

use App\Domain\Files\FileType;
use App\Models\PendingUpload;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Filesystem\AwsS3V3Adapter;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

/**
 * Penyimpanan berkas bukti dan observasi (docs/02 bagian 5).
 *
 * Dengan disk s3 (DigitalOcean Spaces di produksi, MinIO saat pengembangan) peramban mengunggah langsung ke
 * penyimpanan objek memakai URL PUT bertanda tangan berumur pendek, dan unduhan dialihkan ke URL GET bertanda tangan
 * lima menit. Dengan disk lokal (Codespaces dan pengujian) alurnya sama, tetapi URL unggah menunjuk ke aplikasi
 * sendiri. Setelah unggah, server selalu memeriksa ukuran sebenarnya, jenis dari isi, dan SHA-256.
 */
class ObjectStore
{
    public const UPLOAD_TTL_MINUTES = 15;

    public const DOWNLOAD_TTL_MINUTES = 5;

    private const CHUNK = 1024 * 1024;

    public function disk(): Filesystem
    {
        return Storage::disk((string) config('filesystems.default'));
    }

    /** Unggah langsung ke penyimpanan objek (disk s3). */
    public function direct(): bool
    {
        return $this->disk() instanceof AwsS3V3Adapter;
    }

    /** Kunci objek docs/02 bagian 5: {organisasi}/{asesmen}/{jenis}/{uuid}.{ekstensi}. */
    public function key(string $organizationId, string $assessmentId, string $kind, string $extension): string
    {
        return "{$organizationId}/{$assessmentId}/{$kind}/".bin2hex(random_bytes(16)).($extension !== '' ? ".{$extension}" : '');
    }

    /**
     * Tujuan unggah untuk peramban: URL, metode, dan header yang harus dikirim apa adanya.
     *
     * @return array{url: string, method: string, headers: array<string, string>}
     */
    public function uploadTarget(PendingUpload $upload, string $contentType): array
    {
        $disk = $this->disk();
        if ($disk instanceof AwsS3V3Adapter) {
            $signed = $disk->temporaryUploadUrl($upload->storage_key, $upload->expires_at, ['ContentType' => $contentType]);
            $headers = [];
            foreach ($signed['headers'] as $name => $values) {
                // Host diatur peramban sendiri; selain itu hanya header yang ikut ditandatangani.
                $lower = strtolower((string) $name);
                if ($lower === 'content-type' || str_starts_with($lower, 'x-amz-')) {
                    $headers[$name] = is_array($values) ? implode(', ', $values) : (string) $values;
                }
            }

            return ['url' => $signed['url'], 'method' => 'PUT', 'headers' => $headers + ['Content-Type' => $contentType]];
        }

        return [
            'url' => route('uploads.relay', ['upload' => $upload->id]),
            'method' => 'PUT',
            'headers' => ['Content-Type' => $contentType, 'X-CSRF-TOKEN' => csrf_token()],
        ];
    }

    /**
     * Menyimpan isi unggahan yang diterima aplikasi (disk lokal). Mengembalikan false bila melebihi batas ukuran.
     *
     * @param  resource  $input
     */
    public function storeRelayed(string $key, $input, int $limit): bool
    {
        $buffer = fopen('php://temp/maxmemory:'.(2 * self::CHUNK), 'w+b');
        if ($buffer === false) {
            return false;
        }
        $total = 0;
        while (! feof($input)) {
            $chunk = fread($input, self::CHUNK);
            if ($chunk === false) {
                break;
            }
            $total += strlen($chunk);
            if ($total > $limit) {
                fclose($buffer);

                return false;
            }
            fwrite($buffer, $chunk);
        }
        rewind($buffer);
        $this->disk()->writeStream($key, $buffer);
        fclose($buffer);

        return true;
    }

    /**
     * Membaca objek yang baru diunggah: ukuran sebenarnya, SHA-256 seluruh isi, dan potongan awal untuk mengenali
     * jenisnya. Null bila objek tidak ada. Objek yang melebihi batas tidak dibaca isinya.
     *
     * @return array{size: int, sha256: string, head: string}|null
     */
    public function inspect(string $key): ?array
    {
        $disk = $this->disk();
        try {
            if (! $disk->exists($key)) {
                return null;
            }
            $size = $disk->size($key);
            if ($size > FileType::MAX_UPLOAD_BYTES) {
                return ['size' => $size, 'sha256' => '', 'head' => ''];
            }
            $stream = $disk->readStream($key);
        } catch (\Throwable) {
            return null;
        }
        if (! is_resource($stream)) {
            return null;
        }
        $hash = hash_init('sha256');
        $head = '';
        $total = 0;
        while (! feof($stream)) {
            $chunk = fread($stream, self::CHUNK);
            if ($chunk === false || $chunk === '') {
                break;
            }
            hash_update($hash, $chunk);
            $total += strlen($chunk);
            if (strlen($head) < FileType::HEAD_BYTES) {
                $head .= substr($chunk, 0, FileType::HEAD_BYTES - strlen($head));
            }
        }
        fclose($stream);

        return ['size' => $total, 'sha256' => hash_final($hash), 'head' => $head];
    }

    public function delete(string $key): void
    {
        try {
            $this->disk()->delete($key);
        } catch (\Throwable) {
            // Objek yang tidak ada atau gagal dihapus dibersihkan ulang oleh nscas:prune-uploads.
        }
    }

    /**
     * Unduhan setelah hak akses diperiksa pengendali: pengalihan ke URL bertanda tangan lima menit (s3), atau
     * isi berkas langsung (lokal).
     */
    public function download(string $key, string $fileName, string $mime, bool $inline): Response
    {
        $safe = trim((string) preg_replace('/[^\p{L}\p{N} ._-]/u', '_', $fileName));
        $safe = mb_substr($safe !== '' ? $safe : 'berkas', 0, 150);
        $disposition = ($inline ? 'inline' : 'attachment')."; filename*=UTF-8''".rawurlencode($safe);
        $disk = $this->disk();
        if ($disk instanceof AwsS3V3Adapter) {
            $url = $disk->temporaryUrl($key, now()->addMinutes(self::DOWNLOAD_TTL_MINUTES), [
                'ResponseContentDisposition' => $disposition,
                'ResponseContentType' => $mime,
            ]);

            return redirect()->away($url);
        }
        if (! $disk->exists($key)) {
            abort(404);
        }

        return $disk->response($key, $safe, [
            'Content-Type' => $mime,
            'Content-Disposition' => $disposition,
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ], $inline ? 'inline' : 'attachment');
    }
}
