"""Telusuri logo NSCAS raster menjadi jalur vektor per warna.

Setiap piksel diuraikan sebagai campuran latar krem dan satu warna logo (marun, hitam, emas). Warna dengan sisa
terkecil dipilih, cakupannya dihitung, peta cakupan diperbesar 4 kali agar tepi halus, lalu ditelusuri potrace.
Keluaran: JSON berisi jalur per warna untuk simbol dan untuk tulisan, dalam koordinat piksel asli.
"""

import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

SRC = Path(sys.argv[1])
OUT = Path(sys.argv[2])
WORK = OUT.parent / 'work'
WORK.mkdir(parents=True, exist_ok=True)

BG = np.array([254, 250, 244.0])
COLORS = {
    'maroon': np.array([105, 27, 46.0]),
    'black': np.array([26, 26, 26.0]),
    'gold': np.array([203, 163, 90.0]),
}
SCALE = 4

im = np.asarray(Image.open(SRC).convert('RGB')).astype(float)
h, w, _ = im.shape
d = im - BG

best_res = np.full((h, w), np.inf)
best_name = np.empty((h, w), dtype=object)
best_cov = np.zeros((h, w))
for name, c in COLORS.items():
    v = c - BG
    a = np.clip((d @ v) / (v @ v), 0, 1)
    res = np.linalg.norm(d - a[..., None] * v, axis=2)
    better = res < best_res
    best_res[better] = res[better]
    best_name[better] = name
    best_cov[better] = a[better]

REGIONS = {
    'mark': (150, 115, 665, 695),
    'word': (695, 255, 1835, 590),
}

result = {'source_size': [w, h], 'regions': {}}
for region, (x0, y0, x1, y1) in REGIONS.items():
    layers = {}
    for name in COLORS:
        cov = np.where(best_name == name, best_cov, 0.0)[y0:y1, x0:x1]
        img = Image.fromarray((cov * 255).astype(np.uint8))
        big = img.resize(((x1 - x0) * SCALE, (y1 - y0) * SCALE), Image.BICUBIC)
        mask = (np.asarray(big) < 128).astype(np.uint8) * 255  # potrace menelusuri piksel hitam
        pbm = WORK / f'{region}-{name}.pbm'
        Image.fromarray(mask).convert('1').save(pbm)
        svg = WORK / f'{region}-{name}.svg'
        subprocess.run(
            ['potrace', str(pbm), '-s', '-o', str(svg), '-t', '40', '-a', '1.0', '-O', '0.4', '--flat', '-u', '10'],
            check=True,
        )
        text = svg.read_text()
        paths = re.findall(r'<path d="([^"]+)"', text)
        transform = re.search(r'<g transform="([^"]+)"', text)
        layers[name] = {'paths': paths, 'transform': transform.group(1) if transform else ''}
    result['regions'][region] = {'box': [x0, y0, x1, y1], 'layers': layers}

OUT.write_text(json.dumps(result))
print('ok', {r: {k: len(v['paths']) for k, v in d['layers'].items()} for r, d in result['regions'].items()})
