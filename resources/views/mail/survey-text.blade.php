@foreach ($sections as $i => $s)
@if ($i > 0)
----------

@endif
{{ $s['greeting'] }}

{{ $s['intro'] }}

{{ $s['anonymity'] }}
@if ($s['duration'])

{{ $s['duration'] }}
@endif
@if ($s['link'])

{{ $s['linkIntro'] }}
{{ $s['link'] }}

{{ $s['personal'] }}
@endif
@if ($s['deadline'])

{{ $s['deadline'] }}
@endif

{{ $s['closing'] }}
{{ $s['signature'] }}
@if ($i === 0)

{{ $s['otherLanguage'] }}
@endif

@endforeach
