<?php

namespace App\Http\Controllers\Files;

use App\Domain\Files\FileType;
use App\Http\Controllers\Controller;
use App\Models\PendingUpload;
use App\Services\Files\ObjectStore;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Penerima unggahan saat penyimpanan memakai disk lokal (Codespaces dan pengujian). Dengan disk s3 peramban
 * mengunggah langsung ke penyimpanan objek, dan rute ini tidak dipakai. Isi berkas tetap diperiksa saat unggahan
 * diselesaikan, sama seperti unggah langsung.
 */
class UploadRelayController extends Controller
{
    public function __invoke(Request $request, string $upload, ObjectStore $store): Response
    {
        abort_if($store->direct(), 404);
        $pending = PendingUpload::whereKey($upload)->where('user_id', $request->user()?->id)->first();
        abort_if(! $pending || $pending->expires_at->isPast(), 404);

        $input = $request->getContent(true);
        abort_unless(is_resource($input), 400);
        if (! $store->storeRelayed($pending->storage_key, $input, FileType::MAX_UPLOAD_BYTES)) {
            return response('', 413);
        }

        return response('', 204);
    }
}
