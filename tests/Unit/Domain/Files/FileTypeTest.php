<?php

declare(strict_types=1);

namespace Tests\Unit\Domain\Files;

use App\Domain\Files\FileType;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Writer\XLSX\Writer;
use PHPUnit\Framework\TestCase;

/** Dibawa dari v1 src/lib/files/__tests__/content-type.test.ts. */
class FileTypeTest extends TestCase
{
    public function test_recognises_pdf_images_and_videos_from_content(): void
    {
        $this->assertSame('application/pdf', FileType::detect("%PDF-1.7\n...")['mime'] ?? null);
        $this->assertSame('image/jpeg', FileType::detect("\xFF\xD8\xFF\xE0\x00\x00")['mime'] ?? null);
        $this->assertSame('image/png', FileType::detect("\x89PNG\r\n\x1A\n\x00")['mime'] ?? null);
        $this->assertSame('image/webp', FileType::detect("RIFF\x00\x00\x00\x00WEBPVP8 ")['mime'] ?? null);
        $this->assertSame('image/heic', FileType::detect("\x00\x00\x00\x18ftypheic\x00\x00")['mime'] ?? null);
        $this->assertSame('video', FileType::detect("\x1A\x45\xDF\xA3\x9F")['kind'] ?? null);
        $this->assertSame('video/mp4', FileType::detect("\x00\x00\x00 ftypisom\x00\x00")['mime'] ?? null);
        $this->assertSame('video/quicktime', FileType::detect("\x00\x00\x00\x14ftypqt  ")['mime'] ?? null);
    }

    public function test_tells_excel_and_word_apart_and_rejects_other_zip_files(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'nscas').'.xlsx';
        $writer = new Writer;
        $writer->openToFile($path);
        $writer->addRow(Row::fromValues(['x']));
        $writer->close();
        $xlsx = (string) file_get_contents($path, length: FileType::HEAD_BYTES);
        @unlink($path);

        $this->assertSame('xlsx', FileType::detect($xlsx)['ext'] ?? null);
        $this->assertSame('docx', FileType::detect("PK\x03\x04....[Content_Types].xml....word/document.xml")['ext'] ?? null);
        $this->assertNull(FileType::detect("PK\x03\x04ppt/slides/slide1.xml"));
    }

    public function test_old_office_documents_use_the_declared_extension(): void
    {
        $ole = "\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1\x00\x00";
        $this->assertSame('application/vnd.ms-excel', FileType::detect($ole, 'Laporan.XLS')['mime'] ?? null);
        $this->assertSame('application/msword', FileType::detect($ole, 'notulen.doc')['mime'] ?? null);
        $this->assertNull(FileType::detect($ole, 'presentasi.ppt'));
    }

    public function test_ignores_the_file_name_for_unknown_content(): void
    {
        $this->assertNull(FileType::detect("MZ\x90\x00 program", 'laporan.pdf'));
        $this->assertNull(FileType::detect('<html><script>', 'bukti.jpg'));
        $this->assertNull(FileType::detect("\x01\x02"));
    }

    public function test_declared_extension_must_match_the_detected_type(): void
    {
        $this->assertSame('jpeg', FileType::declaredExtension('Foto Lokasi.JPEG'));
        $this->assertSame('', FileType::declaredExtension('tanpa-ekstensi'));
        $this->assertTrue(FileType::extensionMatches('jpg', 'jpeg'));
        $this->assertTrue(FileType::extensionMatches('heic', 'heif'));
        $this->assertTrue(FileType::extensionMatches('pdf', ''));
        $this->assertFalse(FileType::extensionMatches('pdf', 'docx'));
        $this->assertFalse(FileType::extensionMatches('jpg', 'png'));
    }
}
