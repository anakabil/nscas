@php
    // Berita acara pemusnahan data mentah (docs/04 bagian 7). Berdiri sendiri: tanpa skrip, huruf, atau gambar dari luar.
    $t = fn (string $k, array $x = []) => __('retention.doc.'.$k, $x, $loc);
    $d = $r->details;
    $day = fn ($v) => $v ? \Carbon\CarbonImmutable::parse($v)->setTimezone('Asia/Jakarta')->locale($loc)->translatedFormat('j F Y') : '';
    $time = fn ($v) => $v ? \Carbon\CarbonImmutable::parse($v)->setTimezone('Asia/Jakarta')->locale($loc)->translatedFormat('j F Y H.i').' WIB' : '';
    $num = fn (int $v) => number_format($v, 0, $loc === 'id' ? ',' : '.', $loc === 'id' ? '.' : ',');
    $a = $r->assessment;
@endphp
<!DOCTYPE html>
<html lang="{{ $loc }}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{ $t('title') }} {{ $a->name }}</title>
<style>
    @page { size: A4; margin: 18mm 16mm 20mm;
        @bottom-right { content: counter(page) " / " counter(pages); font: 8pt Georgia, serif; color: #6b625c; } }
    * { box-sizing: border-box; }
    body { margin: 0; background: #fefaf4; color: #1a1a1a; font: 10.5pt/1.55 "Liberation Sans", "DejaVu Sans", Arial, sans-serif; }
    main { max-width: 190mm; margin: 0 auto; background: #fff; }
    @media screen { main { padding: 14mm 16mm; margin: 24px auto; box-shadow: 0 1px 6px rgba(0,0,0,.08); } }
    @media print { body { background: #fff; } }
    h1, h2 { font-family: Georgia, "DejaVu Serif", serif; color: #691b2e; font-weight: normal; line-height: 1.2; }
    h1 { font-size: 19pt; margin: 6mm 0 1mm; }
    h2 { font-size: 12.5pt; margin: 7mm 0 2.5mm; border-bottom: 1px solid #cba35a; padding-bottom: 1.5mm; break-after: avoid; }
    p { margin: 0 0 3mm; }
    .muted { color: #6b625c; font-size: 9pt; }
    table { width: 100%; border-collapse: collapse; font-size: 9.5pt; break-inside: avoid; }
    th, td { text-align: left; padding: 1.6mm 2mm; border-bottom: 1px solid #e6ddd0; vertical-align: top; }
    th { width: 42%; font-weight: normal; color: #3b3431; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    thead th { font-weight: bold; color: #1a1a1a; border-bottom: 1px solid #cba35a; }
    .signs { display: flex; gap: 12mm; margin-top: 12mm; break-inside: avoid; }
    .signs div { flex: 1; border-top: 1px solid #3b3431; padding-top: 2mm; font-size: 9.5pt; margin-top: 20mm; }
    img { width: 46mm; height: auto; }
</style>
</head>
<body>
<main>
    <img src="{{ $logo }}" alt="NSCAS Nusa Safety">
    <h1>{{ $t('title') }}</h1>
    <p class="muted">{{ $t('number', ['id' => $r->id]) }}</p>
    <p>{{ $t('opening', ['date' => $day($r->executed_at), 'assessment' => $a->name, 'organization' => $a->organization?->name]) }}</p>

    <h2>{{ $t('basis.title') }}</h2>
    <table>
        <tr><th>{{ $t('basis.law') }}</th><td>{{ $t('basis.lawValue') }}</td></tr>
        <tr><th>{{ $t('basis.baseline') }}</th><td>{{ $day($d['baseline'] ?? null) }}</td></tr>
        <tr><th>{{ $t('basis.months') }}</th><td>{{ $t('basis.monthsValue', ['months' => $d['months'] ?? '']) }}</td></tr>
        <tr><th>{{ $t('basis.end') }}</th><td>{{ $day($d['dueAt'] ?? null) }}</td></tr>
    </table>

    <h2>{{ $t('confirmation.title') }}</h2>
    <table>
        <tr><th>{{ $t('confirmation.ref') }}</th><td>{{ $r->client_confirmation_ref }}</td></tr>
        <tr><th>{{ $t('confirmation.date') }}</th><td>{{ $day($r->client_confirmed_on) }}</td></tr>
        <tr><th>{{ $t('confirmation.by') }}</th><td>{{ $r->client_confirmed_by }}</td></tr>
    </table>

    <h2>{{ $t('destroyed.title') }}</h2>
    <table>
        <thead><tr><th>{{ $t('destroyed.category') }}</th><th class="num">{{ $t('destroyed.count') }}</th></tr></thead>
        <tbody>
        @foreach ($categories as $category)
            <tr><td>{{ $t('categories.'.$category) }}</td><td class="num">{{ $num((int) ($d['counts'][$category] ?? 0)) }}</td></tr>
        @endforeach
        </tbody>
    </table>

    <h2>{{ $t('retained.title') }}</h2>
    <p>{{ $t('retained.body') }}</p>

    @if ($r->notes)
        <h2>{{ $t('notes') }}</h2>
        <p>{{ $r->notes }}</p>
    @endif

    <h2>{{ $t('execution.title') }}</h2>
    <table>
        <tr><th>{{ $t('execution.by') }}</th><td>{{ $r->executor?->name }}</td></tr>
        <tr><th>{{ $t('execution.at') }}</th><td>{{ $time($r->executed_at) }}</td></tr>
        <tr><th>{{ $t('execution.witness') }}</th><td>{{ $r->witness_name }}</td></tr>
        @if ($r->objects_purged_at)
            <tr><th>{{ $t('execution.objectsPurged') }}</th><td>{{ $time($r->objects_purged_at) }}</td></tr>
        @endif
    </table>

    <div class="signs">
        <div>{{ $t('execution.by') }}<br>{{ $r->executor?->name }}</div>
        <div>{{ $t('execution.witness') }}<br>{{ $r->witness_name }}</div>
    </div>
    <p class="muted" style="margin-top: 10mm">{{ $t('footer') }}</p>
</main>
</body>
</html>
