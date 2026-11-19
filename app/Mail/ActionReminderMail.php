<?php

namespace App\Mail;

use Carbon\CarbonImmutable;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Pengingat tenggat rencana aksi (docs/01 M10), dua bahasa (Indonesia lalu Inggris). Teks dari
 * lang/<bahasa>/action_mail.php. Logo disematkan, tanpa gambar jarak jauh.
 */
class ActionReminderMail extends Mailable
{
    use Queueable, SerializesModels;

    /** @param  list<array{title: string, dueDate: string, state: string, code: string}>  $items */
    public function __construct(
        public string $recipientName,
        public string $organization,
        public string $assessment,
        public array $items,
        public string $link,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: __('action_mail.subject', ['organization' => $this->organization], 'id'));
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.action-reminder',
            text: 'mail.action-reminder-text',
            with: ['sections' => [$this->section('id'), $this->section('en')], 'logo' => public_path('brand/nscas-logo-480.png')],
        );
    }

    /** @return array<string, mixed> */
    private function section(string $locale): array
    {
        $t = fn (string $key, array $replace = []) => __("action_mail.{$key}", $replace, $locale);
        $date = fn (string $d) => CarbonImmutable::parse($d)->locale($locale)->translatedFormat('j F Y');

        return [
            'locale' => $locale,
            'greeting' => $t('greeting', ['name' => $this->recipientName]),
            'intro' => $t('intro', ['assessment' => $this->assessment]),
            'items' => array_map(fn (array $i) => $t('item', ['code' => $i['code'], 'title' => $i['title'], 'date' => $date($i['dueDate']), 'state' => $t("states.{$i['state']}")]), $this->items),
            'button' => $t('button'),
            'closing' => $t('closing'),
            'signature' => $t('signature'),
            'otherLanguage' => $t('otherLanguage'),
            'link' => $this->link,
        ];
    }
}
