<?php

declare(strict_types=1);

namespace Tests\Unit\Domain\Setup;

use App\Domain\Setup\JobTitles;
use PHPUnit\Framework\TestCase;

final class JobTitlesTest extends TestCase
{
    public function test_titles_are_split_trimmed_and_deduplicated(): void
    {
        $this->assertSame(['Site Manager', 'Site Engineer', 'Pengawas K3'], JobTitles::parse("Site Manager,  site manager\n Site   Engineer ;Pengawas K3\n\n"));
        $this->assertSame(['Mandor'], JobTitles::parse(['Mandor', ' MANDOR ', '']));
        $this->assertSame([], JobTitles::parse(null));
        $this->assertSame([], JobTitles::parse(" , ;\n"));
    }

    public function test_limits_on_count_and_length(): void
    {
        $this->assertNull(JobTitles::error(['Mandor', 'Juru Ukur']));
        $this->assertSame('JOB_TITLE_LENGTH', JobTitles::error(['M']));
        $this->assertSame('JOB_TITLE_LENGTH', JobTitles::error([str_repeat('a', 81)]));
        $this->assertSame('JOB_TITLES_TOO_MANY', JobTitles::error(array_map(fn ($i) => "Jabatan {$i}", range(1, 41))));
    }

    public function test_a_title_can_belong_to_one_stratum_only(): void
    {
        $this->assertSame(['site manager'], JobTitles::conflicts(['site manager', 'Mandor'], [['Site Manager'], ['Tukang']]));
        $this->assertSame([], JobTitles::conflicts(['Mandor'], [['Site Manager']]));
    }

    public function test_lookup_maps_normalised_titles_to_their_stratum(): void
    {
        $map = JobTitles::lookup([
            ['id' => 's2', 'isContractor' => false, 'jobTitles' => ['Site Manager']],
            ['id' => 's5', 'isContractor' => true, 'jobTitles' => ['Tukang Besi']],
        ]);
        $this->assertSame(['site manager' => ['id' => 's2', 'isContractor' => false], 'tukang besi' => ['id' => 's5', 'isContractor' => true]], $map);
    }
}
