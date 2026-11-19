{{-- Keadaan tautan atau kode QR yang tidak dapat dipakai saat ini. Ringan, tanpa skrip, tanpa sumber pihak ketiga; dua bahasa. --}}
@php
    $titleKey ??= 'title';
    $when = fn ($at, string $locale) => $at->copy()->setTimezone('Asia/Jakarta')->locale($locale)->translatedFormat($locale === 'id' ? 'j F Y, H.i' : 'j F Y, H:i').' WIB';
    $schedule = function (string $locale) use ($state, $opensAt, $closesAt, $when) {
        if ($state !== 'NOT_OPEN') {
            return null;
        }
        if ($opensAt !== null && $opensAt->isFuture()) {
            return __('survey_entry.opens', ['date' => $when($opensAt, $locale)], $locale);
        }

        return $closesAt !== null ? __('survey_entry.closes', ['date' => $when($closesAt, $locale)], $locale) : null;
    };
@endphp
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>{{ __('survey_entry.'.$titleKey, [], 'id') }}</title>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <style>
        body { margin: 0; background: #fefaf4; color: #1a1a1a; font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; }
        main { max-width: 560px; margin: 0 auto; padding: 32px 16px 48px; }
        .card { background: #fff; border: 1px solid #cdbfad; border-radius: 14px; padding: 24px; }
        img { display: block; width: 180px; height: auto; margin-bottom: 20px; }
        h1 { font-size: 20px; line-height: 1.35; color: #691b2e; margin: 0 0 12px; }
        p { margin: 0 0 12px; }
        .muted { color: #3b3431; font-size: 14px; }
        hr { border: none; border-top: 1px solid #cdbfad; margin: 22px 0; }
        footer { text-align: center; color: #8c8073; font-size: 13px; margin-top: 20px; }
    </style>
</head>
<body>
<main>
    <div class="card">
        <img src="/brand/nscas-logo-480.png" alt="NSCAS Nusa Safety" width="180">
        @foreach (['id', 'en'] as $i => $locale)
            @if ($i > 0)
                <hr>
            @endif
            <section lang="{{ $locale }}">
                <h1>{{ __('survey_entry.'.$titleKey, [], $locale) }}</h1>
                <p>{{ __('survey_entry.states.'.$state, [], $locale) }}</p>
                @if ($schedule($locale))
                    <p>{{ $schedule($locale) }}</p>
                @endif
                @if (in_array($state, ['NOT_OPEN', 'QR_CLOSED'], true))
                    <p class="muted">{{ __('survey_entry.anonymous', [], $locale) }}</p>
                @endif
                <p class="muted">{{ __('survey_entry.privacy', [], $locale) }}</p>
            </section>
        @endforeach
    </div>
    <footer>{{ __('survey_entry.footer') }}</footer>
</main>
</body>
</html>
