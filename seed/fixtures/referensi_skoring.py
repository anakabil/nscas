"""
Implementasi rujukan mesin penilaian dan kalkulator sampel NSCAS.

Berkas ini BUKAN bagian aplikasi. Fungsinya sebagai sumber kebenaran untuk
menghasilkan berkas fixture JSON yang wajib dipenuhi oleh mesin penilaian
TypeScript di aplikasi. Nilai-nilainya identik dengan kertas kerja
Konsep_Platform_SCML_Daring_NusaSafety.xlsx (lembar 08 dan 09).

Jalankan:  python3 referensi_skoring.py
Keluaran:  skoring-simulasi.json, sampel-3000.json, kasus-tepi.json
"""
import json
import math

EPS = 1e-9

# ----------------------------------------------------------------------------
# Parameter bawaan (harus sama dengan seed/aspek-dan-parameter.json)
# ----------------------------------------------------------------------------
LAYER_WEIGHTS = {"perception": 0.35, "evidence": 0.40, "validation": 0.25}
DIVERGENCE_THRESHOLD = 1.00
ASPECT_MAX_POINTS_STEP5 = {"A1": 4800, "A2": 1800, "A3": 3450, "A4": 3200, "A5": 3950, "A6": 800}
TOTAL_POINTS = sum(ASPECT_MAX_POINTS_STEP5.values())  # 18000
ASPECT_WEIGHTS = {k: v / TOTAL_POINTS for k, v in ASPECT_MAX_POINTS_STEP5.items()}
SCL_THRESHOLDS = {2: (0.75, 0.70), 3: (0.80, 0.70), 4: (0.80, 0.75), 5: (0.85, 0.75)}


def ceil_safe(x):
    """Pembulatan ke atas yang kebal galat floating point (setara ROUNDUP Excel)."""
    return math.ceil(x - EPS)


# ----------------------------------------------------------------------------
# Mesin penilaian
# ----------------------------------------------------------------------------
def combine_layers(p, e, v, weights=LAYER_WEIGHTS):
    """Indeks gabungan. Lapisan bernilai None dikeluarkan dan bobot dinormalisasi ulang."""
    pairs = [(p, weights["perception"]), (e, weights["evidence"]), (v, weights["validation"])]
    avail = [(val, w) for val, w in pairs if val is not None]
    if not avail:
        return None, ["SEMUA_LAPISAN_KOSONG"]
    flags = [] if len(avail) == 3 else ["LAPISAN_TIDAK_LENGKAP"]
    wsum = sum(w for _, w in avail)
    return sum(val * w for val, w in avail) / wsum, flags


def score_characteristic(p, e, v, threshold=DIVERGENCE_THRESHOLD):
    combined, flags = combine_layers(p, e, v)
    divergence = abs(p - e) if (p is not None and e is not None) else None
    final = combined
    if divergence is not None and divergence >= threshold - EPS:
        final = min(combined, e)
        flags.append("SELISIH_PERSEPSI_BUKTI")
    return {"combined": combined, "divergence": divergence, "final": final, "flags": flags}


def perception_score(answers_by_stratum, population_by_stratum, self_assessment_levels, alpha=0.30):
    """answers_by_stratum: {kodeStrata: [tingkat atau None untuk "Tidak tahu"]}"""
    num = den = 0.0
    for code, answers in answers_by_stratum.items():
        valid = [a for a in answers if a is not None]
        if not valid:
            continue
        w = population_by_stratum[code]
        num += w * (sum(valid) / len(valid))
        den += w
    survey = num / den if den else None
    sa = [x for x in self_assessment_levels if x is not None]
    if survey is None:
        return {"survey": None, "selfAssessment": (sum(sa) / len(sa)) if sa else None, "perception": None}
    if not sa:
        return {"survey": survey, "selfAssessment": None, "perception": survey}
    a = sum(sa) / len(sa)
    return {"survey": survey, "selfAssessment": a, "perception": (1 - alpha) * survey + alpha * a}


def indicative_level(org_index):
    return max(1, min(5, math.floor(org_index + EPS)))


def run_engine(characteristics, target_level):
    """characteristics: list dict {code, aspectCode, isContextual, p, e, v}"""
    out_chars = []
    for c in characteristics:
        r = score_characteristic(c["p"], c["e"], c["v"])
        out_chars.append({"code": c["code"], "aspectCode": c["aspectCode"], "isContextual": c["isContextual"], **r})

    aspects = {}
    for a in ASPECT_WEIGHTS:
        vals = [x["final"] for x in out_chars if x["aspectCode"] == a and not x["isContextual"]]
        aspects[a] = {"index": sum(vals) / len(vals), "min": min(vals)}
    org = sum(ASPECT_WEIGHTS[a] * aspects[a]["index"] for a in ASPECT_WEIGHTS)
    level = indicative_level(org)
    min_aspect = min(x["index"] for x in aspects.values())
    min_char = min(x["final"] for x in out_chars if not x["isContextual"])
    consolidated = (min_aspect >= level - 0.5 - EPS) and (min_char >= level - 1 - EPS)
    priority = min(aspects, key=lambda k: aspects[k]["index"])
    ctx = [x["final"] for x in out_chars if x["isContextual"]]
    return {
        "characteristics": out_chars,
        "aspects": {k: {**v, "weight": ASPECT_WEIGHTS[k], "gapToTarget": target_level - v["index"]} for k, v in aspects.items()},
        "organization": {
            "index": org, "indicativeLevel": level, "consolidated": consolidated,
            "minAspectIndex": min_aspect, "minCharacteristicIndex": min_char,
            "gapToTarget": target_level - org, "priorityAspect": priority,
            "contextualIndex": sum(ctx) / len(ctx) if ctx else None,
        },
    }


def scl_track(fulfillment):
    """fulfillment: {aspectCode: {2: f, 3: f, 4: f, 5: f}} dengan f dalam 0..1"""
    steps = {}
    level = 1
    chain_ok = True
    for s in (2, 3, 4, 5):
        avg = sum(ASPECT_WEIGHTS[a] * fulfillment[a][s] for a in ASPECT_WEIGHTS)
        mn = min(fulfillment[a][s] for a in ASPECT_WEIGHTS)
        t_avg, t_min = SCL_THRESHOLDS[s]
        passed = (avg >= t_avg - EPS) and (mn >= t_min - EPS)
        steps[s] = {"weightedAverage": avg, "minimum": mn, "thresholdAverage": t_avg, "thresholdMinimum": t_min, "passed": passed}
        if chain_ok and passed:
            level = s
        else:
            chain_ok = False
    return {"steps": steps, "indicativeLevel": level}


# ----------------------------------------------------------------------------
# Kalkulator sampel
# ----------------------------------------------------------------------------
def sample_plan(M, N_projects, X_locations, strata, z=1.96, e=0.05, p=0.5, min_participation=0.30):
    scl_mgmt = ceil_safe(0.6 * math.sqrt(M))
    scl_ops = ceil_safe(1.2 * math.sqrt(M))
    slovin = ceil_safe(M / (1 + M * e ** 2))
    n0 = z ** 2 * p * (1 - p) / e ** 2
    cochran = ceil_safe(n0 / (1 + (n0 - 1) / M))
    rec = max(slovin, cochran)
    out_strata = []
    for s in strata:
        prop = s["population"] / M
        n = min(s["population"], max(ceil_safe(prop * rec), ceil_safe(min_participation * s["population"])))
        out_strata.append({**s, "proportion": prop, "surveyTarget": n})
    return {
        "inputs": {"M": M, "projects": N_projects, "locations": X_locations, "z": z, "e": e, "p": p, "minParticipation": min_participation},
        "sclMinimumInterviewManagement": scl_mgmt,
        "sclMinimumInterviewOperational": scl_ops,
        "sclMinimumInterviewTotal": scl_mgmt + scl_ops,
        "slovin": slovin, "cochranInitial": n0, "cochranCorrected": cochran,
        "recommendedSurvey": rec,
        "projectsToVisit": max(1, ceil_safe(0.6 * math.sqrt(N_projects))),
        "locationsToVisit": ceil_safe(math.sqrt(X_locations)),
        "strata": out_strata,
        "surveyTargetTotal": sum(x["surveyTarget"] for x in out_strata),
    }


# ----------------------------------------------------------------------------
# Statistik mutu data
# ----------------------------------------------------------------------------
def rwg_single(values, A=5):
    n = len(values)
    mean = sum(values) / n
    var = sum((x - mean) ** 2 for x in values) / (n - 1)
    sigma_eu = (A ** 2 - 1) / 12
    return max(0.0, 1 - var / sigma_eu)


def cronbach_alpha(matrix):
    """matrix: list responden, tiap responden list skor butir (sudah dibalik bila butir negatif)."""
    k = len(matrix[0])
    def var(xs):
        m = sum(xs) / len(xs)
        return sum((x - m) ** 2 for x in xs) / (len(xs) - 1)
    item_vars = [var([r[i] for r in matrix]) for i in range(k)]
    total_var = var([sum(r) for r in matrix])
    return (k / (k - 1)) * (1 - sum(item_vars) / total_var)


# ----------------------------------------------------------------------------
# Data simulasi (sama dengan lembar 08 Simulasi Skoring)
# ----------------------------------------------------------------------------
SIM = [
    ("K1.1", "A1", False, 3.6, 3.0, 3.2), ("K1.2", "A1", False, 3.4, 3.0, 3.0), ("K1.3", "A1", False, 3.2, 2.0, 2.4),
    ("K2.1", "A2", False, 3.4, 3.0, 3.2), ("K2.2", "A2", False, 3.6, 3.0, 3.4),
    ("K3.1", "A3", False, 3.0, 2.6, 2.8), ("K3.2", "A3", False, 3.8, 3.4, 3.6), ("K3.3", "A3", False, 3.6, 3.4, 3.4),
    ("K4.1", "A4", False, 3.6, 3.4, 3.4), ("K4.2", "A4", False, 3.4, 3.0, 3.0), ("K4.3", "A4", False, 3.4, 3.2, 3.2),
    ("K5.1", "A5", False, 3.2, 2.4, 2.6), ("K5.2", "A5", False, 3.6, 3.2, 3.4), ("K5.3", "A5", False, 3.8, 3.6, 3.6),
    ("K6.1", "A6", False, 3.4, 3.2, 3.2), ("K6.2", "A6", False, 3.2, 3.0, 3.0),
    ("KT.1", "KT", True, 3.8, 3.6, 3.6), ("KT.2", "KT", True, 3.0, 2.4, 2.6),
]
SCL_FULFILLMENT = {
    "A1": {2: 0.92, 3: 0.86, 4: 0.74, 5: 0.60}, "A2": {2: 0.90, 3: 0.84, 4: 0.72, 5: 0.58},
    "A3": {2: 0.88, 3: 0.80, 4: 0.68, 5: 0.55}, "A4": {2: 0.90, 3: 0.85, 4: 0.73, 5: 0.60},
    "A5": {2: 0.86, 3: 0.79, 4: 0.66, 5: 0.52}, "A6": {2: 0.90, 3: 0.83, 4: 0.70, 5: 0.56},
}


def rounded(obj, nd=6):
    if isinstance(obj, float):
        return round(obj, nd)
    if isinstance(obj, dict):
        return {str(k): rounded(v, nd) for k, v in obj.items()}
    if isinstance(obj, list):
        return [rounded(v, nd) for v in obj]
    return obj


if __name__ == "__main__":
    chars = [{"code": c, "aspectCode": a, "isContextual": k, "p": p, "e": e, "v": v} for c, a, k, p, e, v in SIM]
    sim = {
        "_catatan": "Toleransi pembandingan 1e-6. Sumber: lembar 08 Simulasi Skoring.",
        "parameters": {"layerWeights": LAYER_WEIGHTS, "divergenceThreshold": DIVERGENCE_THRESHOLD, "targetLevel": 4},
        "input": {"characteristics": chars, "sclFulfillment": SCL_FULFILLMENT},
        "expected": {**run_engine(chars, 4), "sclTrack": scl_track(SCL_FULFILLMENT)},
    }
    json.dump(rounded(sim), open("skoring-simulasi.json", "w"), ensure_ascii=False, indent=2)

    strata = [
        {"code": "S1", "name": "Direksi dan manajemen puncak", "population": 15},
        {"code": "S2", "name": "Manajemen menengah dan manajer proyek", "population": 120},
        {"code": "S3", "name": "Penyelia dan pengawas lapangan", "population": 300},
        {"code": "S4", "name": "Pelaksana dan pekerja sendiri", "population": 1800},
        {"code": "S5", "name": "Pekerja penyedia jasa dan subkontraktor", "population": 765},
    ]
    json.dump(rounded({"_catatan": "Sumber: lembar 09 Kalkulator Sampel.", "expected": sample_plan(3000, 40, 12, strata)}),
              open("sampel-3000.json", "w"), ensure_ascii=False, indent=2)

    tepi = {
        "_catatan": "Kasus tepi yang wajib ditangani mesin penilaian.",
        "contohDeck": {"input": {"p": 3.60, "e": 2.40, "v": 2.80}, "expected": score_characteristic(3.60, 2.40, 2.80)},
        "selisihTepatSatu": {"input": {"p": 3.40, "e": 2.40, "v": 3.00}, "expected": score_characteristic(3.40, 2.40, 3.00)},
        "selisihDiBawahSatu": {"input": {"p": 3.39, "e": 2.40, "v": 3.00}, "expected": score_characteristic(3.39, 2.40, 3.00)},
        "buktiLebihTinggiDariPersepsi": {"input": {"p": 2.20, "e": 3.40, "v": 3.00}, "expected": score_characteristic(2.20, 3.40, 3.00)},
        "validasiKosong": {"input": {"p": 3.60, "e": 3.20, "v": None}, "expected": score_characteristic(3.60, 3.20, None)},
        "tingkatDibatasiLima": {"input": {"orgIndex": 5.0}, "expected": indicative_level(5.0)},
        "tingkatPembulatanFloatingPoint": {"input": {"orgIndex": 2.9999999999999996}, "expected": indicative_level(2.9999999999999996)},
        "persepsiPembobotanStrata": {
            "input": {"answersByStratum": {"S1": [4, 4, 5], "S2": [3, 4, None, 4, 3], "S4": [2, 3, 3, 2, 3], "S5": [None, None]},
                      "populationByStratum": {"S1": 15, "S2": 120, "S4": 1800, "S5": 765},
                      "selfAssessmentLevels": [4, 4], "alpha": 0.30},
            "expected": perception_score({"S1": [4, 4, 5], "S2": [3, 4, None, 4, 3], "S4": [2, 3, 3, 2, 3], "S5": [None, None]},
                                         {"S1": 15, "S2": 120, "S4": 1800, "S5": 765}, [4, 4], 0.30)},
        "persepsiTanpaPenilaianMandiri": {
            "input": {"answersByStratum": {"S3": [3, 4], "S4": [3, 3, 2]}, "populationByStratum": {"S3": 300, "S4": 1800},
                      "selfAssessmentLevels": [], "alpha": 0.30},
            "expected": perception_score({"S3": [3, 4], "S4": [3, 3, 2]}, {"S3": 300, "S4": 1800}, [], 0.30)},
        "rwgSatuButir": {"input": {"values": [3, 3, 4, 3, 4, 3, 3, 4]}, "expected": rwg_single([3, 3, 4, 3, 4, 3, 3, 4])},
        "rwgSebaranLebar": {"input": {"values": [1, 5, 2, 4, 1, 5]}, "expected": rwg_single([1, 5, 2, 4, 1, 5])},
        "alphaCronbach": {"input": {"matrix": [[4, 4, 5], [3, 3, 4], [5, 4, 5], [2, 3, 2], [4, 5, 4], [3, 3, 3]]},
                          "expected": cronbach_alpha([[4, 4, 5], [3, 3, 4], [5, 4, 5], [2, 3, 2], [4, 5, 4], [3, 3, 3]])},
    }
    json.dump(rounded(tepi), open("kasus-tepi.json", "w"), ensure_ascii=False, indent=2)
    print("fixture dibuat")
