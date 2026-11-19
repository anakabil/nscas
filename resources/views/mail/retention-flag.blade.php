{{-- Pemberitahuan masa simpan berakhir untuk pengelola sistem. Tanpa gambar jarak jauh: logo disematkan (CID). --}}
<!DOCTYPE html>
<html lang="{{ $locale }}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:24px 12px;background:#fefaf4">
<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1a;max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #cdbfad;border-radius:12px;padding:28px">
    <p style="margin:0 0 20px"><img src="{{ $message->embed($logo) }}" alt="NSCAS Nusa Safety" width="200" style="display:block;width:200px;height:auto;border:0"></p>
    <p>{{ $greeting }}</p>
    <p>{{ $intro }}</p>
    <ul style="padding-left:18px">
        @foreach ($lines as $line)
            <li style="margin-bottom:6px">{{ $line }}</li>
        @endforeach
    </ul>
    <p>{{ $action }}</p>
    <p><a href="{{ $link }}" style="display:inline-block;background:#691b2e;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">{{ $button }}</a></p>
    <p>{{ $closing }}<br>{{ $signature }}</p>
</div>
</body>
</html>
