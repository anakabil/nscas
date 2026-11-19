@foreach ($sections as $i => $s)
@if ($i > 0)
----------

@endif
{{ $s['greeting'] }}

{{ $s['intro'] }}

@foreach ($s['items'] as $item)
- {{ $item }}
@endforeach

{{ $s['link'] }}

{{ $s['closing'] }}
{{ $s['signature'] }}
@if ($i === 0)

{{ $s['otherLanguage'] }}
@endif

@endforeach
