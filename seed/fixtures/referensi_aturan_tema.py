"""
Implementasi rujukan aturan penetapan tangga per tema (docs/13 bagian 6.3; keputusan D2, D3, D4).

Berkas ini BUKAN bagian aplikasi. Fungsinya sebagai sumber kebenaran untuk fixture
aturan-tema-v2.json yang wajib dipenuhi App\\Domain\\Scoring\\ThemeLevelRule. Aturan menyalin logika
prosedural skema sertifikasi, bukan kriteria isinya. Ambang warna 0,80 dan 0,50 adalah kebijakan Nusa Safety
(D3) yang dikalibrasi setelah asesmen pertama. Fixture versi 1 (referensi_skoring.py) tidak diubah.

Jalankan:  python3 referensi_aturan_tema.py
Keluaran:  aturan-tema-v2.json
"""
import json

EPS = 1e-9
GREEN = 0.80
AMBER = 0.50
STEPS = [2, 3, 4, 5]


def color(f, green=GREEN, amber=AMBER):
    """Usulan warna dari tingkat pemenuhan 0 sampai 1 (langkah 2)."""
    if f >= green - EPS:
        return "HIJAU"
    if f >= amber - EPS:
        return "JINGGA"
    return "MERAH"


def step_reached(themes, step, green=GREEN, amber=AMBER):
    """Langkah 3: perilaku semua tema hijau; prasyarat paling sedikit n-1 tema hijau dan tidak ada yang merah."""
    behaviour = [color(t["behaviour"][str(step)], green, amber) for t in themes]
    prerequisite = [color(t["prerequisite"][str(step)], green, amber) for t in themes]
    return (
        all(c == "HIJAU" for c in behaviour)
        and sum(1 for c in prerequisite if c == "HIJAU") >= len(themes) - 1
        and all(c != "MERAH" for c in prerequisite)
    )


def theme_profile(theme, green=GREEN, amber=AMBER):
    """Langkah 5: tangga tertinggi yang dicapai satu tema (perilaku hijau, prasyarat tidak merah)."""
    best = 1
    for s in STEPS:
        if color(theme["behaviour"][str(s)], green, amber) == "HIJAU" and color(theme["prerequisite"][str(s)], green, amber) != "MERAH":
            best = s
    return best


def blockers(themes, step, green=GREEN, amber=AMBER):
    """Tema yang menahan tangga: perilaku belum hijau, prasyarat merah, atau prasyarat jingga bila jumlah prasyarat
    hijau kurang dari n-1 (satu prasyarat jingga masih diterima dan tidak dihitung sebagai penghambat)."""
    prereq = [color(t["prerequisite"][str(step)], green, amber) for t in themes]
    amber_blocks = sum(1 for c in prereq if c == "HIJAU") < len(themes) - 1
    out = []
    for t, p in zip(themes, prereq):
        b = color(t["behaviour"][str(step)], green, amber)
        if b != "HIJAU" or p == "MERAH" or (p == "JINGGA" and amber_blocks):
            out.append({"code": t["code"], "behaviour": b, "prerequisite": p})
    return out


def determine(themes, target, green=GREEN, amber=AMBER):
    """Langkah 4: mulai dari sasaran, turun sampai tangga 2; bila tidak ada yang tercapai, tangga 1."""
    level = 1
    for s in range(int(target), 1, -1):
        if step_reached(themes, s, green, amber):
            level = s
            break
    colors = {
        t["code"]: {
            str(s): {"behaviour": color(t["behaviour"][str(s)], green, amber), "prerequisite": color(t["prerequisite"][str(s)], green, amber)}
            for s in STEPS
        }
        for t in themes
    }
    next_step = level + 1 if level < int(target) else None
    return {
        "level": level,
        "colors": colors,
        "profile": {t["code"]: theme_profile(t, green, amber) for t in themes},
        "nextStep": next_step,
        "blockers": blockers(themes, next_step, green, amber) if next_step else [],
    }


def theme(code, behaviour, prerequisite):
    return {"code": code, "behaviour": {str(s): v for s, v in zip(STEPS, behaviour)}, "prerequisite": {str(s): v for s, v in zip(STEPS, prerequisite)}}


def cases():
    full = [0.95, 0.90, 0.85, 0.82]
    out = {}
    # Contoh docs/13 bagian 6.3: sasaran 4; tangga 4 tema 3 perilaku jingga; tangga 3 semua hijau.
    out["contohDokumen"] = {
        "target": 4,
        "themes": [
            theme("T1", full, full),
            theme("T2", full, full),
            theme("T3", [0.95, 0.90, 0.70, 0.40], [0.95, 0.90, 0.85, 0.60]),
            theme("T4", full, [0.95, 0.90, 0.70, 0.70]),
            theme("T5", full, full),
        ],
    }
    # Kompensasi tidak berlaku: satu tema lemah menahan tangga meski tema lain sangat kuat.
    out["tanpaKompensasi"] = {
        "target": 5,
        "themes": [theme("T1", [1, 1, 1, 1], [1, 1, 1, 1]), theme("T2", [1, 1, 1, 1], [1, 1, 1, 1]), theme("T3", [1, 1, 1, 1], [1, 1, 1, 1]),
                   theme("T4", [1, 1, 1, 1], [1, 1, 1, 1]), theme("T5", [0.85, 0.79, 0.60, 0.30], [0.85, 0.80, 0.80, 0.50])],
    }
    # Prasyarat: dua tema jingga menahan tangga meski perilaku semua hijau.
    out["prasyaratDuaJingga"] = {
        "target": 3,
        "themes": [theme("T1", full, full), theme("T2", full, [0.90, 0.79, 0.79, 0.79]), theme("T3", full, [0.90, 0.60, 0.60, 0.60]),
                   theme("T4", full, full), theme("T5", full, full)],
    }
    # Prasyarat merah pada satu tema menahan tangga.
    out["prasyaratMerah"] = {
        "target": 2,
        "themes": [theme("T1", full, [0.49, 0.49, 0.49, 0.49]), theme("T2", full, full), theme("T3", full, full), theme("T4", full, full), theme("T5", full, full)],
    }
    # Ambang tepat: 0,80 hijau dan 0,50 jingga.
    out["ambangTepat"] = {
        "target": 5,
        "themes": [theme(f"T{i}", [0.80, 0.80, 0.80, 0.80], [0.80, 0.80, 0.80, 0.50]) for i in range(1, 6)],
    }
    # Satu prasyarat jingga masih diterima (empat hijau, tidak ada merah).
    out["satuJingga"] = {
        "target": 4,
        "themes": [theme("T1", full, full), theme("T2", full, full), theme("T3", full, [0.95, 0.90, 0.79, 0.79]), theme("T4", full, full), theme("T5", full, full)],
    }
    for name, case in out.items():
        case["expected"] = determine(case["themes"], case["target"])
    return out


if __name__ == "__main__":
    data = {
        "_catatan": "Dibuat oleh referensi_aturan_tema.py. Aturan penetapan tangga per tema docs/13 bagian 6.3 (D2), ambang 0,80 dan 0,50 (D3). Jangan diubah tangan.",
        "thresholds": {"green": GREEN, "amber": AMBER},
        "cases": cases(),
    }
    with open("aturan-tema-v2.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    for name, case in data["cases"].items():
        print(name, case["expected"]["level"], [b["code"] for b in case["expected"]["blockers"]])
