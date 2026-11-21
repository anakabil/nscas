@php
    // Laporan siap cetak (docs/01 M11 dan bagian 6). Berdiri sendiri: tanpa skrip, tanpa huruf atau gambar dari luar.
    $loc = $c['locale'];
    $t = fn (string $k, array $r = []) => __('report.'.$k, $r, $loc);
    $n = fn ($v, int $d = 2) => $v === null ? $t('hidden') : number_format((float) $v, $d, $loc === 'id' ? ',' : '.', $loc === 'id' ? '.' : ',');
    $pct = fn ($v) => $v === null ? $t('hidden') : $n($v * 100, 1).' %';
    $date = fn (?string $d) => $d ? \Carbon\CarbonImmutable::parse($d)->setTimezone('Asia/Jakarta')->locale($loc)->translatedFormat('j F Y') : '';
    $m = $c['meta'];
    $r = $c['results'];
    $org = $r['organization'];
    $kind = $c['kind'];
    $period = $t('period', ['start' => $date($m['periodStart']), 'end' => $date($m['periodEnd'])]);
    $chars = collect($r['characteristics']);
    $name = fn (array $x) => $loc === 'en' && ($x['nameEn'] ?? null) ? $x['nameEn'] : $x['name'];
    $charName = fn (string $code) => ($x = $chars->firstWhere('code', $code)) ? $name($x) : $code;
    $consolidated = $org['consolidated'] ? $t('text.consolidated') : $t('text.notConsolidated');
@endphp
<!DOCTYPE html>
<html lang="{{ $loc }}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{ $t('kinds.'.$kind) }} {{ $m['assessment'] }}</title>
<style>
    @page { size: A4; margin: 18mm 16mm 20mm;
        @bottom-left { content: "{{ $m['organization'] }}, {{ $t('kinds.'.$kind) }}"; font: 8pt Georgia, serif; color: #6b625c; }
        @bottom-right { content: counter(page) " / " counter(pages); font: 8pt Georgia, serif; color: #6b625c; } }
    * { box-sizing: border-box; }
    body { margin: 0; background: #fefaf4; color: #1a1a1a; font: 10.5pt/1.55 "Liberation Sans", "DejaVu Sans", Arial, sans-serif; }
    main { max-width: 190mm; margin: 0 auto; padding: 12mm 0; background: #fff; }
    @media screen { main { padding: 14mm 16mm; margin: 24px auto; box-shadow: 0 1px 6px rgba(0,0,0,.08); } }
    @media print { body { background: #fff; } main { padding: 0; max-width: none; } .no-print { display: none; } }
    /* Layar telepon: tanpa bingkai halaman, tabel digulir di tempatnya, dan tanda DRAF tidak melebarkan halaman. */
    @media screen and (max-width: 640px) {
        body { overflow-x: hidden; }
        main { padding: 5mm 4mm; margin: 0; box-shadow: none; }
        table { display: block; max-width: 100%; overflow-x: auto; }
        .draft { font-size: 40pt; }
    }
    h1, h2, h3 { font-family: Georgia, "DejaVu Serif", serif; color: #691b2e; font-weight: normal; line-height: 1.2; }
    h1 { font-size: 22pt; margin: 6mm 0 2mm; }
    h2 { font-size: 13.5pt; margin: 9mm 0 3mm; border-bottom: 1px solid #cba35a; padding-bottom: 1.5mm; break-after: avoid; }
    h3 { font-size: 11pt; margin: 5mm 0 2mm; color: #3b3431; }
    p { margin: 0 0 3mm; }
    .muted { color: #6b625c; font-size: 9pt; }
    .note { border: 1px solid #cba35a; background: #fbf5ea; padding: 3mm 4mm; margin: 4mm 0; font-size: 9.5pt; }
    .draft { position: fixed; top: 40%; left: 0; right: 0; text-align: center; font: 72pt Georgia, serif; color: rgba(105,27,46,.08); transform: rotate(-24deg); pointer-events: none; }
    .cover { border-bottom: 2px solid #691b2e; padding-bottom: 5mm; margin-bottom: 4mm; }
    .cover img { width: 46mm; height: auto; }
    .figures { display: flex; gap: 4mm; margin: 4mm 0; flex-wrap: wrap; }
    .figure { flex: 1 1 32mm; border: 1px solid #cdbfad; padding: 3mm; }
    .figure b { display: block; font: 20pt Georgia, serif; color: #1a1a1a; }
    table { width: 100%; border-collapse: collapse; margin: 2mm 0 4mm; font-size: 9pt; break-inside: auto; }
    th, td { border-bottom: 1px solid #e6ddd2; padding: 1.4mm 2mm; text-align: left; vertical-align: top; }
    th { background: #f4ede3; font-weight: bold; color: #3b3431; }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    tr { break-inside: avoid; }
    ul { margin: 0 0 3mm; padding-left: 5mm; }
    .sign { margin-top: 10mm; border-top: 1px solid #cdbfad; padding-top: 4mm; break-inside: avoid; }
    .big { font-size: 13pt; line-height: 1.6; }
</style>
</head>
<body>
@if (! $report || $report->status !== 'FINAL')
    <div class="draft" aria-hidden="true">{{ $t('draft') }}</div>
@endif
<main>
    <header class="cover">
        <img src="{{ $logo }}" alt="NSCAS Nusa Safety">
        <h1>{{ $kind === 'STATEMENT' ? $t('statement.title') : $t('kinds.'.$kind) }}</h1>
        <p><strong>{{ $m['organization'] }}</strong>, {{ $m['assessment'] }}</p>
        <p class="muted">{{ $period }}. {{ $report ? $t('version', ['version' => $report->version]).'.' : $t('draftNote') }} {{ $t('preparedBy') }}.</p>
    </header>
    <p class="note">{{ $t('notCertificate') }}</p>

    @if ($kind === 'WORKER_SUMMARY')
        <div class="big">
            <p>{{ $t('worker.thanks') }}</p>
            <p>{{ $t('worker.who', ['count' => $n($c['quality']['counts']['analysed'], 0)]) }}</p>
            <p><strong>{{ $t('worker.result', ['level' => $org['indicativeLevel']]) }}</strong></p>
            <h2>{{ $t('worker.good') }}</h2>
            <ul>@foreach ($r['strengths'] as $s)<li>{{ $s['name'] }}</li>@endforeach</ul>
            <h2>{{ $t('worker.improve') }}</h2>
            <ul>
                @foreach (array_slice($c['gaps'], 0, 5) as $g)
                    <li>{{ $charName($g['code']) }}@if (! empty($g['actions'])): {{ $g['actions'][0]['title'] }}@endif</li>
                @endforeach
            </ul>
            <p>{{ $t('worker.next') }}</p>
        </div>
    @else
        <div class="figures">
            <div class="figure">{{ $t('cols.index') }}<b>{{ $n($org['index']) }}</b></div>
            <div class="figure">{{ $t('cols.level') }}<b>{{ $org['indicativeLevel'] }}</b>{{ $consolidated }}</div>
            <div class="figure">{{ $t('cols.gap') }}<b>{{ $n($org['gapToTarget']) }}</b></div>
        </div>
    @endif

    @if ($kind === 'STATEMENT')
        <p class="big">{{ $t('statement.body', ['period' => $period, 'instrument' => $m['instrument'], 'organization' => $m['organization'], 'level' => $org['indicativeLevel'], 'index' => $n($org['index']), 'consolidated' => $consolidated]) }}</p>
        <table>
            <tr><th>{{ $t('cols.aspect') }}</th><th class="num">{{ $t('cols.index') }}</th></tr>
            @foreach ($r['aspects'] as $a)<tr><td>{{ $a['code'] }} {{ $a['name'] }}</td><td class="num">{{ $n($a['index']) }}</td></tr>@endforeach
        </table>
    @endif

    @if ($kind === 'EXECUTIVE_SUMMARY')
        <p class="big">{{ $t('executive.headline', ['index' => $n($org['index']), 'level' => $org['indicativeLevel'], 'target' => $n($m['targetLevel'], 0)]) }} {{ $r['sensitivity']['stable'] ? $t('text.sensitivityStable') : $t('text.sensitivityUnstable') }}</p>
        <h2>{{ $t('cols.aspect') }}</h2>
        <table>
            <tr><th>{{ $t('cols.aspect') }}</th><th class="num">{{ $t('cols.index') }}</th><th class="num">{{ $t('cols.gap') }}</th></tr>
            @foreach ($r['aspects'] as $a)<tr><td>{{ $a['code'] }} {{ $a['name'] }}</td><td class="num">{{ $n($a['index']) }}</td><td class="num">{{ $n($a['gapToTarget']) }}</td></tr>@endforeach
        </table>
        <h2>{{ $t('executive.strengths') }}</h2>
        <ul>@foreach ($r['strengths'] as $s)<li>{{ $s['code'] }} {{ $s['name'] }} ({{ $n($s['value']) }})</li>@endforeach</ul>
        <h2>{{ $t('executive.priorities') }}</h2>
        <table>
            <tr><th>#</th><th>{{ $t('cols.characteristic') }}</th><th class="num">{{ $t('cols.current') }}</th><th>{{ $t('cols.action') }}</th></tr>
            @foreach (array_slice($c['gaps'], 0, 5) as $g)
                <tr><td>{{ $g['rank'] }}</td><td>{{ $g['code'] }} {{ $charName($g['code']) }}</td><td class="num">{{ $n($g['currentIndex']) }}</td><td>{{ $g['actions'][0]['title'] ?? '' }}</td></tr>
            @endforeach
        </table>
        <h2>{{ $t('executive.next') }}</h2>
        <p>{{ $t('executive.nextText') }}</p>
    @endif

    @if ($kind === 'FULL')
        <h2>{{ $t('sections.scope') }}</h2>
        <p>{{ $t('text.scope', ['assessment' => $m['assessment'], 'organization' => $m['organization'], 'scope' => $t('scopeTypes.'.$m['scopeType']), 'period' => $period, 'units' => $m['units'], 'workers' => $n($m['workers'], 0), 'location' => $m['dataLocation'], 'target' => $n($m['targetLevel'], 0)]) }}</p>

        <h2>{{ $t('sections.method') }}</h2>
        <p>{{ $t('text.method', ['instrument' => $m['instrument'], 'engine' => $m['engineVersion']]) }}</p>
        @php($p = $c['parameters'])
        <table>
            <tr><th>{{ $t('cols.parameter') }}</th><th class="num">{{ $t('cols.value') }}</th></tr>
            <tr><td>{{ $t('params.layerWeights') }}</td><td class="num">{{ $n($p['layerWeights']['perception']) }}; {{ $n($p['layerWeights']['evidence']) }}; {{ $n($p['layerWeights']['validation']) }}</td></tr>
            <tr><td>{{ $t('params.selfAssessmentWeight') }}</td><td class="num">{{ $n($p['selfAssessmentWeight']) }}</td></tr>
            <tr><td>{{ $t('params.divergenceThreshold') }}</td><td class="num">{{ $n($p['divergenceThreshold']) }}</td></tr>
            @if ($p['assessorDisagreementFlag'] !== null)<tr><td>{{ $t('params.assessorDisagreementFlag') }}</td><td class="num">{{ $n($p['assessorDisagreementFlag']) }}</td></tr>@endif
            @if (is_array($p['consolidation']))<tr><td>{{ $t('params.consolidation') }}</td><td class="num">{{ $n($p['consolidation']['maxAspectBelowLevel'] ?? null) }}; {{ $n($p['consolidation']['maxCharacteristicBelowLevel'] ?? null) }}</td></tr>@endif
            <tr><td>{{ $t('params.minCell') }}</td><td class="num">{{ $r['minCell'] }}</td></tr>
        </table>
        <table>
            <tr><th>{{ $t('cols.aspect') }}</th><th class="num">{{ $t('cols.weight') }}</th></tr>
            @foreach ($p['aspectWeights'] as $a)<tr><td>{{ $a['code'] }} {{ $a['name'] }}</td><td class="num">{{ $n($a['weight'], 4) }}</td></tr>@endforeach
        </table>

        <h2>{{ $t('sections.participation') }}</h2>
        <p>{{ $t('text.participation', ['min' => $pct($c['participation']['minParticipation'])]) }}</p>
        <table>
            <tr><th>{{ $t('cols.stratum') }}</th><th class="num">{{ $t('cols.population') }}</th><th class="num">{{ $t('cols.completed') }}</th><th class="num">{{ $t('cols.rate') }}</th></tr>
            @foreach ($c['participation']['strata'] as $s)
                <tr><td>{{ $s['code'] }} {{ $s['name'] }}</td><td class="num">{{ $n($s['population'], 0) }}</td><td class="num">{{ $s['completed']['suppressed'] ? $t('hidden') : $n($s['completed']['value'], 0) }}</td><td class="num">{{ $pct($s['rate']) }}</td></tr>
            @endforeach
        </table>
        <table>
            <tr><th>{{ $t('cols.unit') }}</th><th class="num">{{ $t('cols.registered') }}</th><th class="num">{{ $t('cols.completed') }}</th><th class="num">{{ $t('cols.rate') }}</th></tr>
            @foreach ($c['participation']['units'] as $u)
                <tr><td>{{ $u['name'] }}</td><td class="num">{{ $n($u['registered'], 0) }}</td><td class="num">{{ $u['completed']['suppressed'] ? $t('hidden') : $n($u['completed']['value'], 0) }}</td><td class="num">{{ $pct($u['rate']) }}</td></tr>
            @endforeach
        </table>

        <h2>{{ $t('sections.reliability') }}</h2>
        <p>{{ $t('text.reliability') }}</p>
        <table>
            <tr><th>{{ $t('cols.dimension') }}</th><th class="num">{{ $t('cols.alpha') }}</th><th class="num">{{ $t('cols.respondents') }}</th></tr>
            @foreach ($c['quality']['alpha'] as $a)<tr><td>{{ $a['code'] }} {{ $a['name'] ?? '' }}</td><td class="num">{{ $n($a['alpha']) }}</td><td class="num">{{ $a['n'] ?? '' }}</td></tr>@endforeach
        </table>

        <h2>{{ $t('sections.indices') }}</h2>
        <p>{{ $t('text.indices') }}</p>
        <table>
            <tr><th>{{ $t('cols.characteristic') }}</th><th class="num">{{ $t('cols.perception') }}</th><th class="num">{{ $t('cols.evidence') }}</th><th class="num">{{ $t('cols.validation') }}</th><th class="num">{{ $t('cols.final') }}</th></tr>
            @foreach ($chars->where('contextual', false) as $x)
                <tr><td>{{ $x['code'] }} {{ $name($x) }}</td><td class="num">{{ $x['perception'] === null ? '' : $n($x['perception']) }}</td><td class="num">{{ $x['evidence'] === null ? '' : $n($x['evidence']) }}</td><td class="num">{{ $x['validation'] === null ? '' : $n($x['validation']) }}</td><td class="num"><strong>{{ $x['value'] === null ? '' : $n($x['value']) }}</strong></td></tr>
            @endforeach
        </table>
        <table>
            <tr><th>{{ $t('cols.aspect') }}</th><th class="num">{{ $t('cols.weight') }}</th><th class="num">{{ $t('cols.index') }}</th></tr>
            @foreach ($r['aspects'] as $a)<tr><td>{{ $a['code'] }} {{ $a['name'] }}</td><td class="num">{{ $n($a['weight'], 4) }}</td><td class="num">{{ $n($a['index']) }}</td></tr>@endforeach
        </table>

        <h2>{{ $t('sections.divergence') }}</h2>
        <p>{{ $t('text.divergence') }}</p>
        <ul>@forelse ($r['divergence'] as $code)<li>{{ $code }} {{ $charName($code) }}</li>@empty<li>{{ $t('none') }}</li>@endforelse</ul>

        <h2>{{ $t('sections.perceptionGap') }}</h2>
        <p>{{ $t('text.perceptionGap', ['value' => $n($r['gapAttention'], 1)]) }}</p>
        <table>
            <tr><th>{{ $t('cols.aspect') }}</th><th class="num">{{ $t('cols.management') }}</th><th class="num">{{ $t('cols.field') }}</th><th class="num">{{ $t('cols.difference') }}</th></tr>
            @foreach ($r['perceptionGap'] as $g)
                <tr><td>{{ $g['aspectCode'] }}</td><td class="num">{{ $n($g['groups']['MANAGEMENT']['value']) }}</td><td class="num">{{ $n($g['groups']['FIELD']['value']) }}</td><td class="num">{{ $g['gap'] === null ? $t('hidden') : $n($g['gap']) }}</td></tr>
            @endforeach
        </table>

        <h2>{{ $t('sections.level') }}</h2>
        <p>{{ $t('text.level', ['index' => $n($org['index']), 'level' => $org['indicativeLevel'], 'consolidated' => $consolidated, 'gap' => $n($org['gapToTarget']), 'scl' => $r['sclLevel'] ?? $t('none')]) }}</p>
        <p>{{ $r['sensitivity']['stable'] ? $t('text.sensitivityStable') : $t('text.sensitivityUnstable') }}</p>
        <table>
            <tr><th>{{ $t('cols.scenario') }}</th><th class="num">{{ $t('cols.index') }}</th><th class="num">{{ $t('cols.level') }}</th></tr>
            @foreach ($r['sensitivity']['scenarios'] as $s)
                <tr><td>{{ $t('scenario', ['up' => $t('cols.'.$s['up']), 'down' => $t('cols.'.$s['down'])]) }}</td><td class="num">{{ $n($s['index'], 3) }}</td><td class="num">{{ $s['level'] }}</td></tr>
            @endforeach
        </table>
        @if (empty($c['panel']))
            <p>{{ $t('text.panelNone') }}</p>
        @else
            <table>
                <tr><th>{{ $t('cols.characteristic') }}</th><th>{{ $t('cols.decision') }}</th><th>{{ $t('cols.rationale') }}</th></tr>
                @foreach ($c['panel'] as $d)
                    <tr><td>{{ $d['code'] }}</td><td>{{ $d['kind'] === 'ADJUSTED' ? $t('adjustedTo', ['from' => $n($d['engineValue']), 'to' => $n($d['value'])]) : $t('confirmed', ['value' => $n($d['engineValue'])]) }}</td><td>{{ $d['rationale'] }}</td></tr>
                @endforeach
            </table>
        @endif

        <h2>{{ $t('sections.contextual') }}</h2>
        <p>{{ $t('text.contextual', ['index' => $org['contextualIndex'] === null ? $t('none') : $n($org['contextualIndex'])]) }}</p>
        <table>
            <tr><th>{{ $t('cols.characteristic') }}</th><th class="num">{{ $t('cols.final') }}</th></tr>
            @foreach ($chars->where('contextual', true) as $x)<tr><td>{{ $x['code'] }} {{ $name($x) }}</td><td class="num">{{ $x['value'] === null ? '' : $n($x['value']) }}</td></tr>@endforeach
        </table>

        <h2>{{ $t('sections.gaps') }}</h2>
        @if (empty($c['gaps']))
            <p>{{ $t('text.gapsNone') }}</p>
        @else
            <p>{{ $t('text.gaps') }}</p>
            <table>
                <tr><th>#</th><th>{{ $t('cols.characteristic') }}</th><th class="num">{{ $t('cols.current') }}</th><th class="num">{{ $t('cols.gap') }}</th><th>{{ $t('cols.priority') }}</th></tr>
                @foreach ($c['gaps'] as $g)
                    <tr><td>{{ $g['rank'] }}</td><td>{{ $g['code'] }} {{ $charName($g['code']) }}@if ($g['rootCause'])<br><span class="muted">{{ $g['rootCause'] }}</span>@endif</td><td class="num">{{ $n($g['currentIndex']) }}</td><td class="num">{{ $n($g['gap']) }}</td><td>{{ $g['priority'] ? $t('priorities.'.$g['priority']) : '' }}</td></tr>
                @endforeach
            </table>
            <table>
                <tr><th>{{ $t('cols.characteristic') }}</th><th>{{ $t('cols.action') }}</th><th>{{ $t('cols.owner') }}</th><th>{{ $t('cols.due') }}</th></tr>
                @foreach ($c['gaps'] as $g)
                    @foreach ($g['actions'] as $a)<tr><td>{{ $g['code'] }}</td><td>{{ $a['title'] }}<br><span class="muted">{{ $a['indicator'] }}</span></td><td>{{ $a['owner'] }}</td><td>{{ $date($a['dueDate']) }}</td></tr>@endforeach
                @endforeach
            </table>
        @endif

        <h2>{{ $t('sections.limitations') }}</h2>
        <ul>
            @foreach ($t('text.limitations') as $line)<li>{{ $line }}</li>@endforeach
            @if (! empty($c['limitations']['belowMinimum']))<li>{{ $t('text.belowMinimum', ['codes' => implode(', ', $c['limitations']['belowMinimum'])]) }}</li>@endif
            @if ($c['limitations']['unstable'])<li>{{ $t('text.unstable') }}</li>@endif
        </ul>

        <h2>{{ $t('sections.appendix') }}</h2>
        <h3>{{ $t('text.sessions') }}</h3>
        <table>
            <tr><th>{{ $t('cols.type') }}</th><th>{{ $t('cols.layer') }}</th><th>{{ $t('cols.date') }}</th><th class="num">{{ $t('cols.participants') }}</th></tr>
            @foreach ($c['sessions'] as $s)<tr><td>{{ $t('sessionTypes.'.$s['type']) }}</td><td>{{ $t('groups.'.$s['layer']) }}</td><td>{{ $date($s['date']) }}</td><td class="num">{{ $s['participants'] }}</td></tr>@endforeach
        </table>
        <h3>{{ $t('text.evidence') }}</h3>
        <table>
            <tr><th>{{ $t('cols.title') }}</th><th class="num">{{ $t('cols.version') }}</th><th>{{ $t('cols.hash') }}</th></tr>
            @foreach ($c['evidence'] as $e)<tr><td>{{ $e['title'] }}</td><td class="num">{{ $e['version'] }}</td><td><code>{{ $e['sha256'] }}</code></td></tr>@endforeach
        </table>
    @endif

    <section class="sign">
        <h3>{{ $t('signature.title') }}</h3>
        @if ($report && $report->status === 'FINAL')
            <p>{{ $t('signature.signed', ['name' => $report->signer_name, 'position' => $report->signer_position, 'date' => $date($report->signed_at?->toIso8601String())]) }}</p>
        @else
            <p class="muted">{{ $t('signature.unsigned') }}</p>
        @endif
    </section>
</main>
</body>
</html>
