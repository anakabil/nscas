{{--
    Halaman survei responden (fase R3). Paket peramban tersendiri (resources/js/survey) tanpa kode konsol. Data survei
    disisipkan sebagai JSON; @json menyandikan < > & ' " sehingga isi tidak dapat keluar dari elemen script.
--}}
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="robots" content="noindex, nofollow">
    <meta name="theme-color" content="#691b2e">
    <title>{{ __('survey_entry.title', [], 'id') }}</title>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    @vite(['resources/css/survey.css', 'resources/js/survey/main.tsx'])
</head>
<body>
    <div id="survey-root"></div>
    <noscript>
        <p style="padding:1rem">{{ __('survey_entry.noScript', [], 'id') }}</p>
        <p style="padding:0 1rem" lang="en">{{ __('survey_entry.noScript', [], 'en') }}</p>
    </noscript>
    <script type="application/json" id="survey-data">@json($data)</script>
</body>
</html>
