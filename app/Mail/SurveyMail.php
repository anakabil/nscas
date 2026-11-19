<?php

namespace App\Mail;

use Carbon\CarbonInterface;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Surel undangan dan pengingat survei, dua bahasa (Indonesia lalu Inggris), dibawa dari v1
 * src/lib/jobs/email-templates.ts. Teks dari lang/<bahasa>/survey_mail.php. Logo disematkan di badan surel, bukan
 * dimuat dari server lain, sehingga pembukaan surel tidak dapat dilacak.
 */
class SurveyMail extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * @param  'invitation'|'reminder'|'continue'|'selfAssessment'  $kind  "continue": token yang sudah dibuka tidak
     *                                                                     diganti, tanpa tautan baru. "selfAssessment": tautan penilaian mandiri manajemen, tidak anonim.
     */
    public function __construct(
        public string $kind,
        public string $recipientName,
        public string $organization,
        public ?string $link,
        public ?CarbonInterface $closesAt,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: __("survey_mail.{$this->kind}.subject", ['organization' => $this->organization], 'id'));
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.survey',
            text: 'mail.survey-text',
            with: ['sections' => [$this->section('id'), $this->section('en')], 'logo' => public_path('brand/nscas-logo-480.png')],
        );
    }

    /** @return array<string, mixed> */
    private function section(string $locale): array
    {
        $t = fn (string $key, array $replace = []) => __("survey_mail.{$key}", $replace, $locale);
        $deadline = null;
        if ($this->closesAt !== null) {
            $local = $this->closesAt->copy()->setTimezone('Asia/Jakarta')->locale($locale);
            $deadline = $t('deadline', ['date' => $local->translatedFormat($locale === 'id' ? 'j F Y, H.i' : 'j F Y, H:i').' WIB']);
        }

        $self = $this->kind === 'selfAssessment';

        return [
            'locale' => $locale,
            'greeting' => $t('greeting', ['name' => $this->recipientName]),
            'intro' => $t("{$this->kind}.intro", ['organization' => $this->organization]),
            // Penilaian mandiri tidak anonim dan diberi tahu demikian (CLAUDE.md aturan 2).
            'anonymity' => $self ? $t('selfAssessment.notice') : $t('anonymity'),
            'duration' => match (true) {
                $self => $t('selfAssessment.duration'),
                $this->kind === 'continue' => null,
                default => $t('duration'),
            },
            'button' => $self ? $t('selfAssessment.button') : $t('button'),
            'linkIntro' => $t('linkIntro'),
            'personal' => $t('personal'),
            'deadline' => $deadline,
            'closing' => $t('closing'),
            'signature' => $t('signature'),
            'otherLanguage' => $t('otherLanguage'),
            'link' => $this->link,
        ];
    }
}
