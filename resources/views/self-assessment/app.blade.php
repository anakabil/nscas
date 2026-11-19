{{-- Formulir penilaian mandiri bertoken (fase R4). Paket peramban tersendiri tanpa kode konsol; data disisipkan sebagai JSON. --}}
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="robots" content="noindex, nofollow">
    <meta name="theme-color" content="#691b2e">
    <title>{{ __('survey_entry.titleSelfAssessment', [], 'id') }}</title>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    @vite(['resources/css/survey.css', 'resources/js/self-assessment/main.tsx'])
</head>
<body>
    <div id="sa-root"></div>
    <noscript>
        <p style="padding:1rem">{{ __('survey_entry.noScript', [], 'id') }}</p>
        <p style="padding:0 1rem" lang="en">{{ __('survey_entry.noScript', [], 'en') }}</p>
    </noscript>
    <script type="application/json" id="sa-data">@json($data)</script>
</body>
</html>
