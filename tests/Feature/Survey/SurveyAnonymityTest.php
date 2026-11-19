<?php

namespace Tests\Feature\Survey;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * CLAUDE.md aturan 2 dan docs/02 bagian 4, dibawa dari v1 src/lib/survey/__tests__/anonymity.test.ts: tabel jawaban
 * survei tidak memuat kolom yang dapat dipakai menemukan token atau responden, tidak memuat cap waktu, dan jalur kode
 * survei tidak membaca alamat IP, tidak menulis log, dan tidak menulis jejak audit.
 */
class SurveyAnonymityTest extends TestCase
{
    use RefreshDatabase;

    private const ANSWER_TABLES = [
        'survey_responses' => ['id', 'assessment_id', 'unit_id', 'stratum_id', 'instrument_version_id', 'language', 'submitted_on', 'duration_bucket', 'quality_flags', 'excluded', 'excluded_reason', 'excluded_by'],
        'characteristic_answers' => ['id', 'survey_response_id', 'characteristic_id', 'level'],
        'climate_answers' => ['id', 'survey_response_id', 'climate_item_id', 'value'],
    ];

    public function test_answer_tables_have_only_the_allowed_columns(): void
    {
        foreach (self::ANSWER_TABLES as $table => $allowed) {
            $this->assertEqualsCanonicalizing($allowed, Schema::getColumnListing($table), $table);
            foreach (Schema::getColumnListing($table) as $column) {
                $this->assertDoesNotMatchRegularExpression('/token|roster|respondent|email|phone|ip|agent|device|session|_at$/i', $column, "{$table}.{$column}");
            }
        }
    }

    public function test_answer_tables_keep_no_timestamps_and_use_random_uuid_keys(): void
    {
        foreach (array_keys(self::ANSWER_TABLES) as $table) {
            $types = collect(Schema::getColumns($table))->pluck('type_name', 'name');
            $this->assertSame('uuid', $types['id'], "{$table}.id");
            $temporal = $types->filter(fn ($type) => str_contains($type, 'time') || $type === 'date')->keys()->all();
            $this->assertSame($table === 'survey_responses' ? ['submitted_on'] : [], $temporal, $table);
        }
        $this->assertSame('date', collect(Schema::getColumns('survey_responses'))->firstWhere('name', 'submitted_on')['type_name']);
    }

    public function test_no_foreign_key_links_answers_to_tokens_or_the_roster(): void
    {
        $keys = collect(DB::select(<<<'SQL'
            SELECT tc.table_name AS source, ccu.table_name AS target
            FROM information_schema.table_constraints tc
            JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
        SQL));

        $fromAnswers = $keys->whereIn('source', array_keys(self::ANSWER_TABLES))->pluck('target')->unique()->sort()->values()->all();
        $this->assertSame(['assessments', 'characteristics', 'climate_items', 'instrument_versions', 'strata', 'survey_responses', 'units', 'users'], $fromAnswers);
        $toAnswers = $keys->whereIn('target', array_keys(self::ANSWER_TABLES))->pluck('source')->unique()->sort()->values()->all();
        $this->assertSame(['characteristic_answers', 'climate_answers'], $toAnswers);
    }

    public function test_survey_code_path_reads_no_ip_and_writes_no_log_or_audit(): void
    {
        $files = [
            app_path('Services/Survey/SurveyService.php'),
            app_path('Http/Controllers/Respondents/SurveyEntryController.php'),
            app_path('Services/Respondents/SurveyEntry.php'),
            ...glob(resource_path('js/survey/*')),
            resource_path('views/survey/app.blade.php'),
            resource_path('views/survey/entry.blade.php'),
        ];
        foreach ($files as $file) {
            $content = (string) file_get_contents($file);
            $this->assertDoesNotMatchRegularExpression('/->ip\(|getClientIp|REMOTE_ADDR|X-Forwarded-For|userAgent\(|HTTP_USER_AGENT/i', $content, $file);
            $this->assertDoesNotMatchRegularExpression('/Audit::|Log::|logger\(|info\(|console\.(log|info|warn|error|debug)/', $content, $file);
        }
    }
}
