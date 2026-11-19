"""Susun jalur hasil penelusuran menjadi berkas SVG logo dan modul TypeScript untuk komponen React."""

import json
import re
import sys
from pathlib import Path

data = json.loads(Path(sys.argv[1]).read_text())
out = Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)

SCALE = 4
PALETTE = {
    'color': {'maroon': '#691B2E', 'black': '#1A1A1A', 'gold': '#CBA35A'},
    # Versi untuk bidang gelap: hitam dan marun menjadi krem, emas tetap emas, tagline emas muda.
    'reversed': {'maroon': '#FBF6EC', 'black': '#FBF6EC', 'gold': '#D4AE62'},
}


def compact(d: str) -> str:
    return re.sub(r'\s+', ' ', d).strip()


def group(region: str, name: str, fill: str) -> str:
    reg = data['regions'][region]
    x0, y0, _, _ = reg['box']
    layer = reg['layers'][name]
    if not layer['paths']:
        return ''
    paths = ''.join(f'<path d="{compact(p)}"/>' for p in layer['paths'])
    return f'<g fill="{fill}" transform="translate({x0} {y0}) scale({1 / SCALE}) {layer["transform"]}">{paths}</g>'


# Kotak tampilan: simbol 163..649 x 128..681, tulisan sampai 1821. Tepi lega 8 piksel.
VIEW = {
    'logo': (155, 120, 1829 - 155, 689 - 120),
    'mark': (155, 120, 657 - 155, 689 - 120),
}

for variant, pal in PALETTE.items():
    tagline_fill = pal['maroon'] if variant == 'color' else '#D4AE62'
    mark = ''.join(group('mark', n, pal[n]) for n in ('maroon', 'black', 'gold'))
    word = group('word', 'black', pal['black']) + group('word', 'maroon', tagline_fill)
    suffix = '' if variant == 'color' else '-reversed'
    for name, (x, y, w, h) in VIEW.items():
        body = mark + (word if name == 'logo' else '')
        title = 'NSCAS, Nusa Safety Culture Assessment System'
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x} {y} {w} {h}" role="img" aria-label="{title}">'
            f'<title>{title}</title>{body}</svg>\n'
        )
        (out / f'nscas-{name}{suffix}.svg').write_text(svg)

# Modul TypeScript: jalur mentah per lapis dan transformasinya, agar komponen dapat mewarnai ulang.
lines = [
    '// Dibuat otomatis dari logo NSCAS milik Nusa Safety (penelusuran vektor per warna). Jangan disunting manual;',
    '// jalankan ulang skrip penelusuran bila logo berubah. Koordinat dalam piksel berkas asli 1983 x 793.',
    '',
    'export type LogoLayer = { transform: string; paths: string[] };',
    '',
]
for region in ('mark', 'word'):
    reg = data['regions'][region]
    x0, y0, _, _ = reg['box']
    for name, layer in reg['layers'].items():
        if not layer['paths']:
            continue
        const = f'{region.upper()}_{name.upper()}'
        transform = f'translate({x0} {y0}) scale({1 / SCALE}) {layer["transform"]}'
        paths = ', '.join(json.dumps(compact(p)) for p in layer['paths'])
        lines.append(f'export const {const}: LogoLayer = {{ transform: {json.dumps(transform)}, paths: [{paths}] }};')
lines.append('')
for name, (x, y, w, h) in VIEW.items():
    lines.append(f"export const VIEWBOX_{name.upper()} = '{x} {y} {w} {h}';")
(out / 'logo-paths.ts').write_text('\n'.join(lines) + '\n')
print('ok', sorted(p.name for p in out.iterdir()))
