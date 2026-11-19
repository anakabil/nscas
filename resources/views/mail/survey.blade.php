{{-- Surel survei dua bahasa. Tanpa gambar jarak jauh: logo disematkan (CID). Warna dari tema NSCAS (docs/05). --}}
<!DOCTYPE html>
<html lang="id">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:24px 12px;background:#fefaf4">
<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1a;max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #cdbfad;border-radius:12px;padding:28px">
    <p style="margin:0 0 20px"><img src="{{ $message->embed($logo) }}" alt="NSCAS Nusa Safety" width="240" style="display:block;width:240px;height:auto;border:0"></p>
    @foreach ($sections as $i => $s)
        @if ($i > 0)
            <hr style="border:none;border-top:1px solid #cdbfad;margin:28px 0">
        @endif
        <div lang="{{ $s['locale'] }}">
            <p>{{ $s['greeting'] }}</p>
            <p>{{ $s['intro'] }}</p>
            <p>{{ $s['anonymity'] }}@if ($s['duration']) {{ $s['duration'] }}@endif</p>
            @if ($s['link'])
                <p><a href="{{ $s['link'] }}" style="display:inline-block;background:#691b2e;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">{{ $s['button'] }}</a></p>
                <p style="font-size:13px;color:#3b3431">{{ $s['linkIntro'] }}<br><span style="word-break:break-all">{{ $s['link'] }}</span></p>
                <p style="font-size:13px;color:#3b3431">{{ $s['personal'] }}</p>
            @endif
            @if ($s['deadline'])
                <p>{{ $s['deadline'] }}</p>
            @endif
            <p>{{ $s['closing'] }}<br>{{ $s['signature'] }}</p>
            @if ($i === 0)
                <p style="font-size:13px;color:#3b3431">{{ $s['otherLanguage'] }}</p>
            @endif
        </div>
    @endforeach
</div>
</body>
</html>
