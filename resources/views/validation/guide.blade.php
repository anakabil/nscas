@php
    // Panduan sesi siap cetak (bahan validasi versi 2) untuk dipakai di lapangan tanpa sambungan. Tanpa skrip dan
    // tanpa sumber luar. Nama narasumber tidak ditulis di lembar ini.
    $t = fn (string $k, array $r = []) => __('fieldwork.'.$k, $r, $loc);
    $g = $s['fieldGuide'];
    $kind = $g['kind'];
    $name = fn ($c) => $loc === 'en' && $c->name_en ? $c->name_en : $c->name_id;
    $date = $s['scheduledAt'] ? \Carbon\CarbonImmutable::parse($s['scheduledAt'])->setTimezone('Asia/Jakarta')->locale($loc)->translatedFormat('j F Y H.i').' WIB' : '';
@endphp
<!DOCTYPE html>
<html lang="{{ $loc }}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{ $t('print.title', ['type' => $t('types.'.$s['type'])]) }} {{ $s['label'] }}</title>
<style>
    @page { size: A4; margin: 14mm 14mm 16mm; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #fefaf4; color: #1a1a1a; font: 10.5pt/1.5 "Liberation Sans", "DejaVu Sans", Arial, sans-serif; }
    main { max-width: 190mm; margin: 0 auto; background: #fff; padding: 12mm 14mm; }
    @media print { body { background: #fff; } main { padding: 0; } }
    h1, h2 { font-family: Georgia, "DejaVu Serif", serif; color: #691b2e; font-weight: normal; line-height: 1.2; }
    h1 { font-size: 18pt; margin: 0 0 2mm; }
    h2 { font-size: 12pt; margin: 6mm 0 2mm; border-bottom: 1px solid #cba35a; padding-bottom: 1mm; break-after: avoid; }
    p, li { margin: 0 0 1.5mm; }
    ol, ul { margin: 0 0 2mm; padding-left: 6mm; }
    .meta { display: grid; grid-template-columns: 30mm 1fr; gap: 1mm 4mm; font-size: 9.5pt; margin-bottom: 3mm; }
    .meta span:nth-child(odd) { color: #6b625c; }
    .line { border-bottom: 1px solid #b7aca0; min-height: 6mm; }
    .q { break-inside: avoid; border: 1px solid #e6ddd0; border-radius: 2mm; padding: 3mm 4mm; margin-bottom: 3mm; }
    .q .code { font-weight: bold; color: #691b2e; }
    .q .main { font-weight: bold; margin: 1mm 0 1.5mm; }
    .muted { color: #6b625c; font-size: 9pt; }
    .write { border-bottom: 1px dotted #b7aca0; height: 7mm; }
    table { width: 100%; border-collapse: collapse; font-size: 9pt; }
    th, td { border: 1px solid #d8cfc2; padding: 1.5mm 2mm; vertical-align: top; text-align: left; }
    th { background: #f5efe6; }
    td.res { width: 26mm; text-align: center; color: #6b625c; }
    td.note { width: 45mm; }
    tr { break-inside: avoid; }
</style>
</head>
<body>
<main>
    <h1>{{ $t('print.title', ['type' => $t('types.'.$s['type'])]) }}</h1>
    <div class="meta">
        <span>{{ $t('print.session') }}</span><span>{{ $s['label'] }}</span>
        <span>{{ $t('print.date') }}</span><span>{{ $date }}</span>
        <span>{{ $t('print.place') }}</span><span>{{ $s['unit'] ?? $s['location'] }}</span>
        <span>{{ $t('print.assessors') }}</span><span class="line"></span>
    </div>

    @if ($kind === 'SITE_VISIT')
        <p>{{ $g['intro'] }}</p>
        <p class="muted">{{ $t('print.scale') }}</p>
        @foreach ($g['sections'] as $section)
            <h2>{{ $section['code'] }}. {{ $section['title'] }} ({{ $t('methods.'.$section['method']) }})</h2>
            <table>
                <thead><tr><th style="width: 13mm">{{ $t('columns.item') }}</th><th>{{ $t('columns.text') }}</th><th class="res">{{ $t('print.resultColumn') }}</th><th class="note">{{ $t('print.notes') }}</th></tr></thead>
                <tbody>
                @foreach ($section['items'] as $item)
                    <tr><td>{{ $item['code'] }}<br><span class="muted">{{ $item['characteristic'] }}</span></td><td>{{ $item['text'] }}</td><td class="res"></td><td class="note"></td></tr>
                @endforeach
                </tbody>
            </table>
        @endforeach
    @else
        @if ($kind === 'FOCUS_GROUP')
            <h2>{{ $t('print.rules') }}</h2>
            <ul>@foreach ($g['rules'] as $line)<li>{{ $line }}</li>@endforeach</ul>
        @endif
        <h2>{{ $t('print.opening') }}</h2>
        <ol>@foreach ($g['opening'] as $line)<li>{{ $line }}</li>@endforeach</ol>
        @if ($kind === 'FOCUS_GROUP')
            <h2>{{ $t('print.warmUp') }}</h2>
            <p>{{ $g['warmUp'] }}</p>
        @endif
        <h2>{{ $t('print.questions') }}</h2>
        @foreach ($characteristics as $c)
            @php $extra = $g['characteristics'][$c->code] ?? []; @endphp
            <div class="q">
                <div><span class="code">{{ $c->code }}</span> {{ $name($c) }}</div>
                <p class="main">{{ $questions[$c->code] ?? '' }}</p>
                @if (! empty($extra['probes']))
                    <p class="muted">{{ $t('print.probes') }}:</p>
                    <ul>@foreach ($extra['probes'] as $probe)<li>{{ $probe }}</li>@endforeach</ul>
                @endif
                @if (! empty($extra['strong']))
                    <p class="muted">{{ $t('print.strong') }}: {{ $extra['strong'] }}</p>
                    <p class="muted">{{ $t('print.weak') }}: {{ $extra['weak'] }}</p>
                @endif
                <p class="muted">{{ $kind === 'FOCUS_GROUP' ? $t('print.recordGroup') : $t('print.record') }}</p>
                <div class="write"></div>
            </div>
        @endforeach
        <h2>{{ $t('print.closing') }}</h2>
        <ol>@foreach ($g['closing'] as $line)<li>{{ $line }}</li>@endforeach</ol>
    @endif
    <p class="muted" style="margin-top: 6mm">{{ $t('print.footer') }}</p>
</main>
</body>
</html>
