<?php

namespace App\Mail;

use Carbon\CarbonImmutable;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Pemberitahuan mingguan kepada pengelola sistem bahwa masa simpan data mentah beberapa asesmen telah berakhir
 * (docs/04 bagian 7). Satu bahasa, mengikuti bahasa akun penerima.
 */
class RetentionFlagMail extends Mailable
{
    use Queueable, SerializesModels;

    /** @param  list<array{id: string, name: string, organization: ?string, dueAt: string}>  $items */
    public function __construct(public string $recipientName, public string $recipientLocale, public array $items, public string $link) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: __('retention.mail.subject', ['count' => count($this->items)], $this->recipientLocale));
    }

    public function content(): Content
    {
        $loc = $this->recipientLocale;
        $t = fn (string $key, array $replace = []) => __("retention.mail.{$key}", $replace, $loc);

        return new Content(
            view: 'mail.retention-flag',
            text: 'mail.retention-flag-text',
            with: [
                'locale' => $loc,
                'logo' => public_path('brand/nscas-logo-480.png'),
                'greeting' => $t('greeting', ['name' => $this->recipientName]),
                'intro' => $t('intro'),
                'lines' => array_map(fn (array $i) => $t('item', [
                    'assessment' => $i['name'],
                    'organization' => $i['organization'] ?? '',
                    'date' => CarbonImmutable::parse($i['dueAt'])->setTimezone('Asia/Jakarta')->locale($loc)->translatedFormat('j F Y'),
                ]), $this->items),
                'action' => $t('action'),
                'button' => $t('button'),
                'closing' => $t('closing'),
                'signature' => $t('signature'),
                'link' => $this->link,
            ],
        );
    }
}
