<?php

namespace Tests\Feature\Evidence;

use App\Domain\Access\Role;
use App\Domain\Workflow\AssessmentStatus;
use App\Models\Assessment;
use App\Models\AuditLog;
use App\Models\Characteristic;
use App\Models\EvidenceItem;
use App\Models\EvidenceRequirement;
use App\Models\PendingUpload;
use App\Models\SelfAssessment;
use App\Models\Unit;
use App\Models\User;
use App\Services\Files\UploadGrants;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\BuildsAssessments;
use Tests\TestCase;

/**
 * Fase R5 (docs/01 M5): bukti dokumen dengan unggah dua langkah, pemeriksaan jenis dari isi, SHA-256, versi,
 * pemetaan ke karakteristik dan butir daftar periksa, hapus logis, cakupan unit koordinator, dan jejak audit.
 */
class EvidenceTest extends TestCase
{
    use BuildsAssessments, RefreshDatabase;

    private const PDF = "%PDF-1.7\n1 0 obj <<>> endobj\ntrailer <<>>\n%%EOF\n";

    private User $lead;

    private User $admin;

    private Assessment $assessment;

    protected function setUp(): void
    {
        parent::setUp();
        config(['filesystems.default' => 'local']);
        Storage::fake('local');
        $this->setUpAssessmentWorld();
        $this->lead = $this->member($this->operator, Role::LeadAssessor);
        $this->admin = $this->member($this->client, Role::ClientAdmin);
        $this->assessment = $this->lockedAssessment($this->lead, $this->member($this->operator, Role::Assessor));
    }

    private function unit(string $name): Unit
    {
        return Unit::where('assessment_id', $this->assessment->id)->where('name', $name)->firstOrFail();
    }

    private function characteristic(string $code): Characteristic
    {
        return Characteristic::where('instrument_version_id', $this->assessment->instrument_version_id)->where('code', $code)->firstOrFail();
    }

    /**
     * Unggah lengkap: izin, kirim isi lewat penerima aplikasi (disk lokal), lalu selesaikan.
     *
     * @param  array<string, mixed>  $overrides
     * @param  list<array{characteristicId: string, requirementIds: list<string>}>|null  $links
     */
    private function upload(User $user, string $content, array $overrides = [], ?array $links = [], ?int $declaredSize = null): TestResponse
    {
        $grant = $this->actingAs($user)->postJson(route('evidence.uploads', $this->assessment), [
            'fileName' => 'Risalah rapat direksi.pdf',
            'size' => $declaredSize ?? strlen($content),
            'contentType' => 'application/pdf',
            'title' => 'Risalah rapat direksi Oktober',
            'description' => '',
            'unitId' => null,
            'supersedesId' => null,
            ...$overrides,
        ]);
        if ($grant->status() !== 200) {
            return $grant;
        }
        $target = $grant->json('upload');
        $this->assertSame('PUT', $target['method']);
        $this->actingAs($user)->call('PUT', $target['url'], [], [], [], ['CONTENT_TYPE' => 'application/pdf'], $content)->assertNoContent();

        return $this->actingAs($user)->postJson(route('evidence.store', $this->assessment), [
            'ticket' => $grant->json('ticket'),
            ...($links === null ? [] : ['links' => $links]),
        ]);
    }

    public function test_client_admin_uploads_a_pdf_that_is_checked_hashed_mapped_and_audited(): void
    {
        $k11 = $this->characteristic('K1.1');
        $requirement = EvidenceRequirement::where('characteristic_id', $k11->id)->orderBy('position')->firstOrFail();

        $this->upload($this->admin, self::PDF, links: [['characteristicId' => $k11->id, 'requirementIds' => [$requirement->id]]])
            ->assertCreated()->assertJsonPath('version', 1);

        $item = EvidenceItem::sole();
        $this->assertSame(hash('sha256', self::PDF), $item->sha256);
        $this->assertSame('application/pdf', $item->mime_type);
        $this->assertSame(strlen(self::PDF), $item->size_bytes);
        $this->assertSame('Risalah rapat direksi.pdf', $item->file_name);
        $this->assertNull($item->unit_id);
        $this->assertStringStartsWith("{$this->assessment->organization_id}/{$this->assessment->id}/evidence/", $item->storage_key);
        Storage::disk('local')->assertExists($item->storage_key);
        $this->assertSame(0, PendingUpload::count());
        $this->assertSame([$requirement->id], $item->links()->sole()->requirement_ids);

        $audit = AuditLog::where('action', 'evidence.upload')->sole();
        $this->assertSame(Role::ClientAdmin->value, $audit->actor_role);
        $this->assertSame(['K1.1'], $audit->changes['after']['characteristics']);
        $this->assertSame($item->sha256, $audit->changes['after']['sha256']);

        $this->actingAs($this->admin)->get(route('evidence.index', $this->assessment))->assertInertia(fn (Assert $page) => $page
            ->component('evidence/index')
            ->where('canEdit', true)
            ->where('checklist.minTypes', 2)
            ->where('checklist.rows.0.code', 'K1.1')
            ->where('checklist.rows.0.types', 1)
            ->where('checklist.rows.0.belowMinimum', true)
            ->where('checklist.rows.0.requirements.0.met', true)
            ->where('items.0.title', 'Risalah rapat direksi Oktober')
            ->where('items.0.links.0.code', 'K1.1'));
    }

    public function test_content_type_size_and_extension_are_checked_from_the_file_itself(): void
    {
        // Isi HTML dengan nama .pdf ditolak dan berkasnya dihapus.
        $this->upload($this->admin, '<html><script>alert(1)</script></html>')->assertStatus(422)->assertJsonPath('errors.file.0', __('setup.errors.FILE_TYPE'));
        // Isi PNG dengan nama .pdf: jenis dikenali tetapi tidak sesuai ekstensi.
        $this->upload($this->admin, "\x89PNG\r\n\x1A\n".str_repeat("\x00", 32))->assertStatus(422);
        // Ukuran berbeda dari yang dinyatakan (unggahan terpotong).
        $this->upload($this->admin, self::PDF, declaredSize: strlen(self::PDF) + 10)->assertStatus(422)
            ->assertJsonPath('errors.file.0', __('setup.errors.FILE_SIZE_MISMATCH'));
        // Lebih dari 25 MB ditolak sejak permintaan izin.
        $this->upload($this->admin, self::PDF, declaredSize: 25 * 1024 * 1024 + 1)->assertStatus(422)
            ->assertJsonPath('errors.file.0', __('setup.errors.FILE_TOO_LARGE'));

        $this->assertSame(0, EvidenceItem::count());
        $this->assertSame(0, PendingUpload::count());
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_a_ticket_belongs_to_one_user_and_cannot_be_finalized_twice(): void
    {
        $grant = $this->actingAs($this->admin)->postJson(route('evidence.uploads', $this->assessment), [
            'fileName' => 'a.pdf', 'size' => strlen(self::PDF), 'contentType' => 'application/pdf', 'title' => 'Bukti A', 'unitId' => null, 'supersedesId' => null,
        ])->assertOk();
        $other = $this->member($this->client, Role::ClientAdmin);
        // Penerima unggahan menolak tiket milik pengguna lain.
        $this->actingAs($other)->call('PUT', $grant->json('upload.url'), [], [], [], ['CONTENT_TYPE' => 'application/pdf'], self::PDF)->assertNotFound();
        $this->actingAs($this->admin)->call('PUT', $grant->json('upload.url'), [], [], [], ['CONTENT_TYPE' => 'application/pdf'], self::PDF)->assertNoContent();
        $this->actingAs($other)->postJson(route('evidence.store', $this->assessment), ['ticket' => $grant->json('ticket')])->assertStatus(422)
            ->assertJsonPath('errors.file.0', __('setup.errors.UPLOAD_EXPIRED'));
        $this->actingAs($this->admin)->postJson(route('evidence.store', $this->assessment), ['ticket' => $grant->json('ticket')])->assertCreated();
        $this->actingAs($this->admin)->postJson(route('evidence.store', $this->assessment), ['ticket' => $grant->json('ticket')])->assertStatus(422);
        $this->assertSame(1, EvidenceItem::count());
    }

    public function test_a_new_version_supersedes_the_old_one_and_inherits_its_mapping(): void
    {
        $k11 = $this->characteristic('K1.1');
        $this->upload($this->admin, self::PDF, links: [['characteristicId' => $k11->id, 'requirementIds' => []]])->assertCreated();
        $first = EvidenceItem::sole();
        $second = self::PDF.'% revisi';
        $this->upload($this->admin, $second, ['supersedesId' => $first->id, 'title' => 'Risalah rapat direksi revisi'], links: null)
            ->assertCreated()->assertJsonPath('version', 2);

        $latest = EvidenceItem::where('version', 2)->sole();
        $this->assertSame($first->id, $latest->supersedes_id);
        $this->assertSame([$k11->id], $latest->links()->pluck('characteristic_id')->all());
        $this->assertSame(1, AuditLog::where('action', 'evidence.version')->count());

        $this->actingAs($this->admin)->get(route('evidence.index', $this->assessment))->assertInertia(fn (Assert $page) => $page
            ->has('items', 1)
            ->where('items.0.version', 2)
            ->where('items.0.previousVersions.0.id', $first->id)
            ->where('checklist.rows.0.evidenceCount', 1));

        // Versi lama tetap dapat diunduh, tetapi tidak dapat digantikan lagi.
        $this->actingAs($this->admin)->get(route('evidence.download', [$this->assessment, $first->id]))->assertOk()->assertStreamedContent(self::PDF);
        $this->upload($this->admin, self::PDF, ['supersedesId' => $first->id])->assertNotFound();
    }

    public function test_mapping_is_validated_against_the_instrument_and_audited(): void
    {
        $this->upload($this->admin, self::PDF)->assertCreated();
        $item = EvidenceItem::sole();
        $k12 = $this->characteristic('K1.2');
        $foreign = EvidenceRequirement::where('characteristic_id', $this->characteristic('K1.1')->id)->value('id');
        $own = EvidenceRequirement::where('characteristic_id', $k12->id)->orderBy('position')->pluck('id')->all();

        $this->actingAs($this->admin)->put(route('evidence.links', [$this->assessment, $item->id]), [
            'links' => [['characteristicId' => $k12->id, 'requirementIds' => [$foreign]]],
        ])->assertSessionHasErrors('links');
        $this->actingAs($this->admin)->put(route('evidence.links', [$this->assessment, $item->id]), [
            'links' => [['characteristicId' => $k12->id, 'requirementIds' => array_slice($own, 0, 2)]],
        ])->assertSessionHasNoErrors();

        $this->assertSame(array_slice($own, 0, 2), $item->links()->sole()->requirement_ids);
        $audit = AuditLog::where('action', 'evidence.map')->sole();
        $this->assertSame([], $audit->changes['before']['characteristics']);
        $this->assertSame(['K1.2'], $audit->changes['after']['characteristics']);
        $this->actingAs($this->admin)->get(route('evidence.index', $this->assessment))->assertInertia(fn (Assert $page) => $page
            ->where('checklist.rows.1.code', 'K1.2')
            ->where('checklist.rows.1.types', 2)
            ->where('checklist.rows.1.belowMinimum', false));
    }

    public function test_deleted_evidence_leaves_the_list_and_checklist_but_stays_downloadable(): void
    {
        $this->upload($this->admin, self::PDF, links: [['characteristicId' => $this->characteristic('K1.1')->id, 'requirementIds' => []]])->assertCreated();
        $item = EvidenceItem::sole();
        $this->actingAs($this->admin)->delete(route('evidence.destroy', [$this->assessment, $item->id]))->assertRedirect();

        $this->assertNotNull($item->fresh()->deleted_at);
        Storage::disk('local')->assertExists($item->storage_key);
        $this->assertSame(1, AuditLog::where('action', 'evidence.delete')->count());
        $this->actingAs($this->admin)->get(route('evidence.index', $this->assessment))->assertInertia(fn (Assert $page) => $page
            ->has('items', 0)->where('checklist.rows.0.evidenceCount', 0));
        $this->actingAs($this->lead)->get(route('evidence.download', [$this->assessment, $item->id]))->assertOk();
    }

    public function test_unit_coordinator_works_only_within_assigned_units(): void
    {
        $coordinator = $this->member($this->client, Role::UnitCoordinator);
        $project = $this->unit('Proyek Gedung A');
        $office = $this->unit('Kantor Pusat');
        $this->actingAs($this->admin)->post(route('respondents.coordinators.store', $this->assessment), ['user_id' => $coordinator->id, 'unit_id' => $project->id]);
        $this->upload($this->admin, self::PDF, ['unitId' => $office->id, 'title' => 'Bukti kantor pusat'])->assertCreated();

        // Bukti tingkat organisasi dan unit lain ditolak; unitnya sendiri diterima.
        $this->upload($coordinator, self::PDF, ['unitId' => null])->assertStatus(422)->assertJsonPath('errors.unitId.0', __('setup.errors.UNIT_OUT_OF_SCOPE'));
        $this->upload($coordinator, self::PDF, ['unitId' => $office->id])->assertStatus(422);
        $this->upload($coordinator, self::PDF, ['unitId' => $project->id, 'title' => 'Bukti proyek'])->assertCreated();

        $this->actingAs($coordinator)->get(route('evidence.index', $this->assessment))->assertInertia(fn (Assert $page) => $page
            ->where('scoped', true)
            ->has('items', 1)
            ->where('items.0.title', 'Bukti proyek')
            ->has('units', 1));
        $officeItem = EvidenceItem::where('title', 'Bukti kantor pusat')->sole();
        $this->actingAs($coordinator)->get(route('evidence.download', [$this->assessment, $officeItem->id]))->assertNotFound();
        $this->actingAs($coordinator)->delete(route('evidence.destroy', [$this->assessment, $officeItem->id]))->assertNotFound();
    }

    public function test_assessors_read_only_and_outsiders_get_404(): void
    {
        $this->upload($this->admin, self::PDF)->assertCreated();
        $item = EvidenceItem::sole();
        $this->actingAs($this->lead)->get(route('evidence.index', $this->assessment))->assertInertia(fn (Assert $page) => $page->where('canEdit', false)->has('items', 1));
        $this->actingAs($this->lead)->postJson(route('evidence.uploads', $this->assessment), [
            'fileName' => 'a.pdf', 'size' => 10, 'title' => 'Bukti', 'unitId' => null, 'supersedesId' => null,
        ])->assertForbidden();
        $this->actingAs($this->lead)->delete(route('evidence.destroy', [$this->assessment, $item->id]))->assertForbidden();

        $outsider = $this->member($this->operator, Role::Assessor);
        $this->actingAs($outsider)->get(route('evidence.index', $this->assessment))->assertNotFound();
        $this->actingAs($outsider)->get(route('evidence.download', [$this->assessment, $item->id]))->assertNotFound();
    }

    public function test_uploads_are_closed_before_lock_and_after_the_panel(): void
    {
        $draft = $this->createAssessment($this->lead);
        $this->actingAs($this->admin)->postJson(route('evidence.uploads', $draft), [
            'fileName' => 'a.pdf', 'size' => 10, 'title' => 'Bukti', 'unitId' => null, 'supersedesId' => null,
        ])->assertStatus(409)->assertJsonPath('code', 'EVIDENCE_CLOSED');

        $this->assessment->forceFill(['status' => AssessmentStatus::ActionPlanning])->save();
        $this->actingAs($this->admin)->get(route('evidence.index', $this->assessment))->assertInertia(fn (Assert $page) => $page->where('canEdit', false)->where('uploadOpen', false));
        $this->upload($this->admin, self::PDF)->assertStatus(409);
    }

    public function test_direct_upload_and_download_use_signed_object_storage_urls(): void
    {
        config([
            'filesystems.default' => 's3',
            'filesystems.disks.s3.key' => 'contoh',
            'filesystems.disks.s3.secret' => 'contoh-rahasia',
            'filesystems.disks.s3.region' => 'sgp1',
            'filesystems.disks.s3.bucket' => 'nscas-uji',
            'filesystems.disks.s3.endpoint' => 'https://sgp1.digitaloceanspaces.com',
        ]);
        Storage::forgetDisk('s3');

        $grant = $this->actingAs($this->admin)->postJson(route('evidence.uploads', $this->assessment), [
            'fileName' => 'Risalah.pdf', 'size' => 1000, 'contentType' => 'application/pdf', 'title' => 'Risalah', 'unitId' => null, 'supersedesId' => null,
        ])->assertOk();
        $url = (string) $grant->json('upload.url');
        $this->assertStringStartsWith('https://nscas-uji.sgp1.digitaloceanspaces.com/'.$this->assessment->organization_id.'/', $url);
        $this->assertStringContainsString('X-Amz-Signature=', $url);
        $this->assertSame(['Content-Type' => 'application/pdf'], $grant->json('upload.headers'));
        // Penerima unggahan aplikasi tidak dipakai saat unggah langsung.
        $this->actingAs($this->admin)->call('PUT', route('uploads.relay', ['upload' => $grant->json('ticket')]), [], [], [], [], self::PDF)->assertNotFound();

        $item = EvidenceItem::create([
            'assessment_id' => $this->assessment->id, 'title' => 'Risalah', 'file_name' => 'Risalah rapat.pdf', 'storage_key' => 'org/a/evidence/x.pdf',
            'sha256' => str_repeat('a', 64), 'mime_type' => 'application/pdf', 'size_bytes' => 10, 'uploaded_by_id' => $this->admin->id,
        ]);
        $redirect = $this->actingAs($this->lead)->get(route('evidence.download', [$this->assessment, $item->id]))->assertRedirect();
        $location = (string) $redirect->headers->get('Location');
        $this->assertStringContainsString('X-Amz-Expires=300', $location);
        $this->assertStringContainsString('response-content-disposition=attachment', $location);
    }

    public function test_abandoned_uploads_are_pruned_with_their_files(): void
    {
        $grant = $this->actingAs($this->admin)->postJson(route('evidence.uploads', $this->assessment), [
            'fileName' => 'a.pdf', 'size' => strlen(self::PDF), 'title' => 'Bukti', 'unitId' => null, 'supersedesId' => null,
        ])->assertOk();
        $this->actingAs($this->admin)->call('PUT', $grant->json('upload.url'), [], [], [], [], self::PDF)->assertNoContent();
        $pending = PendingUpload::sole();
        Storage::disk('local')->assertExists($pending->storage_key);

        $this->assertSame(0, app(UploadGrants::class)->prune());
        $this->travel(2)->hours();
        $this->artisan('nscas:prune-uploads')->assertSuccessful();
        $this->assertSame(0, PendingUpload::count());
        Storage::disk('local')->assertMissing($pending->storage_key);
    }

    public function test_self_assessment_links_existing_evidence_only(): void
    {
        $this->upload($this->admin, self::PDF, links: [['characteristicId' => $this->characteristic('K1.1')->id, 'requirementIds' => []]])->assertCreated();
        $item = EvidenceItem::sole();
        $unit = $this->unit('Kantor Pusat');
        $link = $this->actingAs($this->admin)->post(route('self-assessments.store', $this->assessment), [
            'name' => 'Ir. Budi Hartono', 'position' => 'Direktur Operasi', 'unit_id' => $unit->id,
        ])->getSession()->get('selfAssessmentLink')['link'];
        auth()->logout();
        $raw = substr($link, strrpos($link, '/') + 1);
        $k11 = $this->characteristic('K1.1');

        $page = (string) $this->get("/sa/{$raw}")->getContent();
        preg_match('#<script type="application/json" id="sa-data">(.*?)</script>#s', $page, $m);
        $data = json_decode($m[1], true);
        $this->assertSame([['id' => $item->id, 'title' => $item->title, 'version' => 1, 'characteristicIds' => [$k11->id]]], $data['evidence']);

        $save = fn (array $ids) => $this->putJson("/sa/{$raw}/answer", ['characteristicId' => $k11->id, 'statementId' => null, 'justification' => '', 'evidenceIds' => $ids]);
        $save([$item->id])->assertOk();
        $save(['01jzzzzzzzzzzzzzzzzzzzzzzz'])->assertStatus(422)->assertJsonPath('error', 'UNKNOWN_EVIDENCE');

        $sa = SelfAssessment::sole();
        $this->actingAs($this->lead)->get(route('self-assessments.show', [$this->assessment, $sa->id]))->assertInertia(fn (Assert $page) => $page
            ->where('detail.rows.0.evidence.0.title', $item->title));

        $item->forceFill(['deleted_at' => now()])->save();
        auth()->logout();
        $save([$item->id])->assertStatus(422);
    }
}
