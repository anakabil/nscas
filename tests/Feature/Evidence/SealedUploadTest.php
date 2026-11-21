<?php

namespace Tests\Feature\Evidence;

use App\Domain\Access\Role;
use App\Domain\Files\FileType;
use App\Models\PendingUpload;
use App\Services\Files\ObjectStore;
use App\Services\Files\UploadGrants;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\BuildsAssessments;
use Tests\TestCase;

/**
 * Unggah langsung ke penyimpanan objek: URL PUT bertanda tangan tidak dapat dicabut, sehingga objek dipindahkan ke kunci
 * akhir sebelum diperiksa. Kunci yang dirujuk catatan bukti tidak pernah diberikan ke peramban.
 */
class SealedUploadTest extends TestCase
{
    use BuildsAssessments, RefreshDatabase;

    public function test_a_direct_upload_is_moved_to_a_fresh_key_before_it_is_checked(): void
    {
        config(['filesystems.default' => 'local']);
        Storage::fake('local');
        $this->setUpAssessmentWorld();
        $lead = $this->member($this->operator, Role::LeadAssessor);
        $assessment = $this->createAssessment($lead);
        $pdf = "%PDF-1.7\n".str_repeat('isi bukti ', 50);
        $key = "{$assessment->organization_id}/{$assessment->id}/evidence/".str_repeat('a', 32).'.pdf';
        Storage::disk('local')->put($key, $pdf);
        $upload = PendingUpload::create([
            'kind' => 'EVIDENCE', 'assessment_id' => $assessment->id, 'user_id' => $lead->id, 'storage_key' => $key,
            'file_name' => 'Risalah.pdf', 'declared_size' => strlen($pdf), 'data' => [], 'expires_at' => now()->addMinutes(15),
        ]);
        // Disk lokal berperan sebagai penyimpanan objek dengan unggah langsung.
        $store = $this->partialMock(ObjectStore::class, fn ($mock) => $mock->shouldReceive('direct')->andReturn(true));

        $verified = (new UploadGrants($store))->verify($upload, FileType::EVIDENCE, true);

        $this->assertTrue($verified['ok']);
        $this->assertSame(hash('sha256', $pdf), $verified['sha256']);
        $sealed = PendingUpload::findOrFail($upload->id)->storage_key;
        $this->assertNotSame($key, $sealed);
        $this->assertStringStartsWith("{$assessment->organization_id}/{$assessment->id}/evidence/", $sealed);
        $this->assertStringEndsWith('.pdf', $sealed);
        Storage::disk('local')->assertMissing($key);
        $this->assertSame($pdf, Storage::disk('local')->get($sealed));

        // Unggahan ulang ke kunci lama tidak menyentuh berkas yang sudah diperiksa.
        Storage::disk('local')->put($key, 'isi lain');
        $this->assertSame($pdf, Storage::disk('local')->get($sealed));

        // Objek yang tidak ada ditolak tanpa mengubah izin.
        $missing = PendingUpload::create([
            'kind' => 'EVIDENCE', 'assessment_id' => $assessment->id, 'user_id' => $lead->id, 'storage_key' => "{$assessment->organization_id}/x/evidence/none.pdf",
            'file_name' => 'Tidak ada.pdf', 'declared_size' => 10, 'data' => [], 'expires_at' => now()->addMinutes(15),
        ]);
        $this->assertSame(['ok' => false, 'code' => 'UPLOAD_MISSING'], (new UploadGrants($store))->verify($missing, FileType::EVIDENCE, true));
    }
}
