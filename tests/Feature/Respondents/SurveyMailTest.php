<?php

namespace Tests\Feature\Respondents;

use App\Mail\SurveyMail;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/** Surel survei dua bahasa tanpa gambar jarak jauh (aturan 7: tidak ada layanan pihak ketiga yang menerima data). */
class SurveyMailTest extends TestCase
{
    public function test_invitation_is_bilingual_with_an_embedded_logo_and_a_wib_deadline(): void
    {
        $mail = new SurveyMail('invitation', 'Siti Aminah', 'PT Konstruksi Contoh', 'https://nscas.test/s/abc', Carbon::parse('2026-12-20 10:00:00', 'UTC'));
        $html = $mail->render();

        $this->assertSame('Undangan survei budaya keselamatan dan kesehatan kerja PT Konstruksi Contoh', $mail->envelope()->subject);
        $this->assertStringContainsString('Yth. Siti Aminah,', $html);
        $this->assertStringContainsString('Dear Siti Aminah,', $html);
        $this->assertStringContainsString('20 Desember 2026, 17.00 WIB', $html);
        $this->assertStringContainsString('20 December 2026, 17:00 WIB', $html);
        $this->assertStringContainsString('href="https://nscas.test/s/abc"', $html);
        // Saat dikirim logo menjadi lampiran cid; pada pratinjau Laravel menyisipkannya sebagai data URI.
        $this->assertMatchesRegularExpression('/<img src="(cid|data):/', $html);
        $this->assertDoesNotMatchRegularExpression('/<img src="https?:/', $html);
    }

    public function test_continue_reminder_has_no_link(): void
    {
        $html = (new SurveyMail('continue', 'Budi', 'PT Konstruksi Contoh', null, null))->render();

        $this->assertStringContainsString('Lanjutkan pengisian dari tautan yang sama', $html);
        $this->assertStringNotContainsString('Buka survei', $html);
    }
}
