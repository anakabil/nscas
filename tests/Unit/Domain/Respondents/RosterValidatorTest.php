<?php

declare(strict_types=1);

namespace Tests\Unit\Domain\Respondents;

use App\Domain\Respondents\RosterValidator;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** Dibawa dari v1 src/lib/respondents/__tests__/roster-file.test.ts. */
class RosterValidatorTest extends TestCase
{
    private const HEADER = ['Nama', 'Nomor induk', 'Surel', 'Telepon', 'Unit', 'Strata', 'Penyedia jasa'];

    private const UNITS = ['kantor pusat' => 'u-hq', 'proyek tol cisumdawu' => 'u-p1'];

    private const STRATA = [
        'm' => ['id' => 's-m', 'isContractor' => false],
        'manajemen' => ['id' => 's-m', 'isContractor' => false],
        'pj' => ['id' => 's-pj', 'isContractor' => true],
    ];

    /**
     * @param  list<list<string>>  $rows
     * @param  list<string>|null  $scope
     * @param  list<string>  $nos
     * @param  list<string>  $emails
     * @return array<string, mixed>
     */
    private function validate(array $rows, ?array $scope = null, array $nos = [], array $emails = []): array
    {
        return RosterValidator::validate($rows, self::UNITS, self::STRATA, $scope, $nos, $emails);
    }

    /** @param  array<string, mixed>  $result */
    private function codes(array $result): array
    {
        return array_map(fn (array $e) => "{$e['row']}:{$e['column']}:{$e['code']}", $result['errors']);
    }

    public function test_header_aliases_and_required_marks_are_recognised(): void
    {
        $mapped = RosterValidator::mapHeader(['Nama Lengkap*', 'NIK', 'Email', 'No HP', 'Unit (wajib)', 'Kode strata', 'Contractor']);

        $this->assertSame([], $mapped['missing']);
        $this->assertSame(['name' => 0, 'employeeNo' => 1, 'email' => 2, 'phone' => 3, 'unit' => 4, 'stratum' => 5, 'contractor' => 6], $mapped['columns']);
        $this->assertSame(['unit', 'stratum'], RosterValidator::mapHeader(['Nama', 'Surel'])['missing']);
    }

    /** @return iterable<array{string, string}> */
    public static function phones(): iterable
    {
        yield ['0812-3456-7890', '+6281234567890'];
        yield ['62 812 3456 7890', '+6281234567890'];
        yield ['+62 (812) 3456.7890', '+6281234567890'];
        yield ['812345678', '+812345678'];
    }

    #[DataProvider('phones')]
    public function test_phone_numbers_are_normalised(string $raw, string $expected): void
    {
        $this->assertSame($expected, RosterValidator::normalizePhone($raw));
    }

    public function test_invalid_phones_and_contractor_values(): void
    {
        $this->assertNull(RosterValidator::normalizePhone('12345'));
        $this->assertNull(RosterValidator::normalizePhone('08xx'));
        $this->assertTrue(RosterValidator::parseContractor('Ya'));
        $this->assertFalse(RosterValidator::parseContractor('TIDAK'));
        $this->assertNull(RosterValidator::parseContractor(''));
        $this->assertSame('INVALID', RosterValidator::parseContractor('mungkin'));
    }

    public function test_valid_row_maps_unit_and_stratum_case_insensitively(): void
    {
        $result = $this->validate([self::HEADER, ['Siti Aminah', 'A-1', 'SITI@Contoh.co.id', '081234567890', 'kantor PUSAT', 'manajemen', '']]);

        $this->assertSame([], $result['errors']);
        $this->assertSame([[
            'row' => 2,
            'fullName' => 'Siti Aminah',
            'employeeNo' => 'A-1',
            'email' => 'siti@contoh.co.id',
            'phone' => '+6281234567890',
            'unitId' => 'u-hq',
            'stratumId' => 's-m',
            'isContractor' => false,
        ]], $result['valid']);
    }

    public function test_blank_contractor_follows_the_stratum(): void
    {
        $result = $this->validate([self::HEADER, ['Agus', '', '', '', 'Kantor Pusat', 'PJ', '']]);

        $this->assertTrue($result['valid'][0]['isContractor']);
    }

    public function test_errors_are_reported_per_row_with_file_row_numbers(): void
    {
        $result = $this->validate([
            self::HEADER,
            ['', '', '', '', '', '', ''],
            ['', '', 'bukan-surel', '123', 'Gudang', 'X', 'kadang'],
            ['Budi', 'B-1', '', '', '', '', ''],
        ]);

        $this->assertSame(2, $result['totalRows']);
        $this->assertSame([], $result['valid']);
        $this->assertSame([
            '3:name:NAME_REQUIRED',
            '3:unit:UNIT_NOT_FOUND',
            '3:stratum:STRATUM_NOT_FOUND',
            '3:email:EMAIL_INVALID',
            '3:phone:PHONE_INVALID',
            '3:contractor:CONTRACTOR_INVALID',
            '4:unit:UNIT_REQUIRED',
            '4:stratum:STRATUM_REQUIRED',
        ], $this->codes($result));
    }

    public function test_duplicates_in_file_and_already_registered_people_are_rejected(): void
    {
        $result = $this->validate([
            self::HEADER,
            ['A', 'N-1', 'a@contoh.co.id', '', 'Kantor Pusat', 'M', ''],
            ['B', 'n-1', 'A@contoh.co.id', '', 'Kantor Pusat', 'M', ''],
            ['C', 'N-9', 'lama@contoh.co.id', '', 'Kantor Pusat', 'M', ''],
        ], null, ['n-9'], ['lama@contoh.co.id']);

        $this->assertSame(['A'], array_column($result['valid'], 'fullName'));
        $this->assertSame([
            '3:employeeNo:DUPLICATE_IN_FILE',
            '3:email:DUPLICATE_IN_FILE',
            '4:employeeNo:ALREADY_REGISTERED',
            '4:email:ALREADY_REGISTERED',
        ], $this->codes($result));
    }

    public function test_unit_coordinator_may_only_import_own_units(): void
    {
        $result = $this->validate([self::HEADER, ['A', '', '', '', 'Proyek Tol Cisumdawu', 'M', '']], ['u-hq']);

        $this->assertSame(['2:unit:UNIT_OUT_OF_SCOPE'], $this->codes($result));
    }

    public function test_overlong_text_is_rejected(): void
    {
        $result = $this->validate([self::HEADER, [str_repeat('x', 201), str_repeat('y', 65), '', '', 'Kantor Pusat', 'M', '']]);

        $this->assertSame(['TEXT_TOO_LONG', 'TEXT_TOO_LONG'], array_column($result['errors'], 'code'));
    }

    public function test_validation_stops_when_columns_are_missing_or_rows_exceed_the_limit(): void
    {
        $this->assertSame(['unit', 'stratum'], $this->validate([['Nama'], ['A']])['missingColumns']);

        $many = [self::HEADER];
        for ($i = 0; $i <= RosterValidator::MAX_ROWS; $i++) {
            $many[] = ["R{$i}", '', '', '', 'Kantor Pusat', 'M', ''];
        }
        $result = $this->validate($many);
        $this->assertTrue($result['tooManyRows']);
        $this->assertSame([], $result['valid']);
    }
}
