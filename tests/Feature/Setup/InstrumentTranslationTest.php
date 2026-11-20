<?php

namespace Tests\Feature\Setup;

use App\Models\AuditLog;
use App\Models\Characteristic;
use App\Models\ClimateItem;
use App\Models\LevelStatement;
use Database\Seeders\InstrumentVersionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Draf terjemahan Inggris isi instrumen dan perintah penerapannya (docs/17). */
class InstrumentTranslationTest extends TestCase
{
    use RefreshDatabase;

    private const DRAFT = 'seed/terjemahan-instrumen-en-draf.json';

    /** 18 nama karakteristik, 90 pernyataan berjenjang, 7 nama dimensi, dan 21 butir iklim. */
    private const TEXTS = 136;

    /** @var list<string> */
    private array $temporary = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(InstrumentVersionSeeder::class);
    }

    protected function tearDown(): void
    {
        foreach ($this->temporary as $file) {
            @unlink($file);
        }
        parent::tearDown();
    }

    /** @param  callable(array<string, mixed>): array<string, mixed>  $change */
    private function variant(callable $change): string
    {
        $data = json_decode((string) file_get_contents(base_path(self::DRAFT)), true);
        $file = (string) tempnam(sys_get_temp_dir(), 'nscas-translation-');
        file_put_contents($file, json_encode($change($data), JSON_UNESCAPED_UNICODE));
        $this->temporary[] = $file;

        return $file;
    }

    private function approved(): string
    {
        return $this->variant(function (array $data) {
            $data['approval']['approvedBy'] = 'Penelaah Nusa Safety';
            $data['approval']['approvedOn'] = '2026-12-01';

            return $data;
        });
    }

    public function test_the_draft_covers_every_text_of_instrument_version_one_and_is_not_approved_yet(): void
    {
        $this->artisan('nscas:instrument-translation', ['file' => self::DRAFT])
            ->expectsOutputToContain(self::TEXTS.' teks akan diisi')
            ->expectsOutputToContain('Draf belum disetujui')
            ->assertSuccessful();

        $this->assertSame(0, Characteristic::whereNotNull('name_en')->count());
        $this->assertSame(0, LevelStatement::whereNotNull('text_en')->count());
    }

    public function test_an_unapproved_draft_is_refused(): void
    {
        $this->artisan('nscas:instrument-translation', ['file' => self::DRAFT, '--apply' => true])
            ->expectsOutputToContain('Draf belum disetujui')
            ->assertFailed();

        $this->assertSame(0, LevelStatement::whereNotNull('text_en')->count());
        $this->assertFalse(AuditLog::where('action', 'instrument.translation_applied')->exists());
    }

    public function test_an_approved_translation_fills_only_empty_english_texts_and_is_audited(): void
    {
        $k11 = Characteristic::where('code', 'K1.1')->firstOrFail();
        $k11->forceFill(['name_en' => 'Existing wording'])->save();
        $file = $this->approved();

        $this->artisan('nscas:instrument-translation', ['file' => $file, '--apply' => true])
            ->expectsOutputToContain('Diterapkan: '.(self::TEXTS - 1).' teks')
            ->assertSuccessful();

        $this->assertSame('Existing wording', $k11->fresh()?->name_en);
        $this->assertSame(0, LevelStatement::whereNull('text_en')->count());
        $this->assertSame(0, ClimateItem::whereNull('text_en')->count());
        $statement = LevelStatement::where('characteristic_id', $k11->id)->where('level', 1)->firstOrFail();
        $this->assertSame('Management does not talk about safety unless an outside party demands it.', $statement->text_en);
        // Teks sumber bahasa Indonesia tidak berubah.
        $this->assertSame('Manajemen tidak membicarakan keselamatan kecuali bila ada tuntutan dari pihak luar.', $statement->text_id);

        $log = AuditLog::where('action', 'instrument.translation_applied')->sole();
        $this->assertSame(self::TEXTS - 1, $log->changes['filled']);
        $this->assertSame(1, $log->changes['kept']);
        $this->assertSame('Penelaah Nusa Safety', $log->changes['approvedBy']);

        // Penerapan ulang tidak mengubah apa pun.
        $this->artisan('nscas:instrument-translation', ['file' => $file, '--apply' => true])
            ->expectsOutputToContain('Diterapkan: 0 teks')
            ->assertSuccessful();
    }

    public function test_an_incomplete_translation_is_rejected_with_its_problems(): void
    {
        $file = $this->variant(function (array $data) {
            unset($data['characteristics']['K4.2']);
            $data['climate']['D3']['items']['D3.2'] = '';

            return $data;
        });

        $this->artisan('nscas:instrument-translation', ['file' => $file])
            ->expectsOutputToContain('Karakteristik K4.2 belum diterjemahkan.')
            ->expectsOutputToContain('Teks butir iklim D3.2 kosong.')
            ->assertFailed();
    }
}
