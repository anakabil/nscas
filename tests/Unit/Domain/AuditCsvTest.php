<?php

declare(strict_types=1);

namespace Tests\Unit\Domain;

use App\Domain\Audit\AuditCsv;
use PHPUnit\Framework\TestCase;

final class AuditCsvTest extends TestCase
{
    public function test_formula_cells_are_neutralised(): void
    {
        $this->assertSame("'=HYPERLINK(\"x\")", AuditCsv::neutralize('=HYPERLINK("x")'));
        $this->assertSame("'+1", AuditCsv::neutralize('+1'));
        $this->assertSame("'-2", AuditCsv::neutralize('-2'));
        $this->assertSame("'@SUM(A1)", AuditCsv::neutralize('@SUM(A1)'));
        $this->assertSame('teks biasa', AuditCsv::neutralize('teks biasa'));
    }

    public function test_cells_are_quoted_and_the_document_starts_with_a_byte_order_mark(): void
    {
        $this->assertSame('"a;b"', AuditCsv::cell('a;b'));
        $this->assertSame('"say ""hi"""', AuditCsv::cell('say "hi"'));
        $this->assertSame('', AuditCsv::cell(null));
        $this->assertSame("\u{FEFF}a;'=1\r\nb;2\r\n", AuditCsv::document([['a', '=1'], ['b', 2]]));
    }
}
