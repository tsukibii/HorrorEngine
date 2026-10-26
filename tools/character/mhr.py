"""MHR's body in plain numpy (the Character Studio's server, face_mesh.py, the presets): the packed mesh
(Content/Studio/Bodies/MHR_lod1.bin, tools/character/pack_mhr.py), a body from its 45 identity weights, and its measures.
Y up, facing +Z, metres; the measures in cm, over the same regions as the desk's shape page (tools/director/shape.html).
"""
import json
import struct
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
BIN = ROOT / "Content" / "Studio" / "Bodies" / "MHR_lod1.bin"
_CACHE = {}


def load(path=BIN):
    """{points (n,3) float64, tris (m,3), shapes (45,n,3) float32, header}"""
    path = Path(path)
    if path not in _CACHE:
        data = path.read_bytes()
        (hl,) = struct.unpack_from("<I", data, 0)
        h = json.loads(data[4:4 + hl].decode("utf-8"))
        n, m, k = h["points"], h["triangles"], h["shapes"]
        pts = np.frombuffer(data, np.float32, n * 3, h["points_at"]).reshape(n, 3).astype(np.float64)
        tris = np.frombuffer(data, np.uint32, m * 3, h["triangles_at"]).reshape(m, 3).astype(np.int64)
        shapes = np.frombuffer(data, np.float16, k * n * 3, h["shapes_at"]).reshape(k, n, 3).astype(np.float32)
        out = dict(points=pts, tris=tris, shapes=shapes, header=h)
        if "expr_at" in h:                                # the 72 expressions on the points they move, the UVs
            e, q = h["expressions"], h["expr_points"]
            out["expr_idx"] = np.frombuffer(data, np.uint32, q, h["expr_idx_at"]).astype(np.int64)
            out["expr"] = np.frombuffer(data, np.float16, e * q * 3, h["expr_at"]).reshape(e, q, 3).astype(np.float32)
            out["expr_names"] = h["expr_names"]
            out["uv"] = np.frombuffer(data, np.float32, m * 6, h["uv_at"]).reshape(m, 3, 2).astype(np.float64)
        _CACHE[path] = out
    return _CACHE[path]


def body(weights, mhr=None, expressions=None):
    """the points with the identity weights applied (missing weights are 0), and expressions: {Meta's name or index:
    weight} of the 72 FACS shapes, on top"""
    mhr = mhr or load()
    w = np.zeros(len(mhr["shapes"]), np.float32)
    w[:min(len(weights), len(w))] = np.asarray(weights, np.float32)[:len(w)]
    pts = mhr["points"] + np.tensordot(w, mhr["shapes"], 1)
    for k, v in (expressions or {}).items():
        i = mhr["expr_names"].index(k) if isinstance(k, str) else int(k)
        pts[mhr["expr_idx"]] += v * mhr["expr"][i]
    return pts


# the regions, on the neutral body (cm, as the shape page has them): which points each measure reads
def _regions(p):
    x, y, z = p[:, 0] * 100, p[:, 1] * 100, p[:, 2] * 100
    top, low = int(np.argmax(y)), int(np.argmin(y))
    sel = lambda m: np.flatnonzero(m)
    return {
        "height": ([top, low], 1, "span"),
        "shoulders": (sel((y > 136) & (y < 146) & (np.abs(x) < 26)), 0, "span"),
        "chest": (sel((y > 118) & (y < 128) & (np.abs(x) < 16)), 2, "span"),
        "bust": (sel((y > 120) & (y < 130) & (np.abs(x) < 14) & (z > 0)), 2, "max"),
        "waist": (sel((y > 100) & (y < 108) & (np.abs(x) < 22)), 0, "span"),
        "belly": (sel((y > 92) & (y < 110) & (np.abs(x) < 12)), 2, "max"),
        "hips": (sel((y > 82) & (y < 94) & (np.abs(x) < 24)), 0, "span"),
        "seat": (sel((y > 80) & (y < 92) & (np.abs(x) < 16) & (z < 0)), 2, "min"),
        "thighs": (sel((y > 66) & (y < 74) & (x > 2) & (x < 22)), 0, "span"),
        "arms": (sel(np.abs(x) > 40), 0, "absmax"),
        "neck": (sel((y > 140) & (y < 146) & (np.abs(x) < 8)), 0, "span"),
        "head_w": (sel((y > 150) & (np.abs(x) < 12)), 0, "span"),
        "skull": (sel((y > 155) & (np.abs(x) < 10)), 2, "span"),
        "jaw": (sel((y > 146) & (y < 151) & (np.abs(x) < 9)), 0, "span"),
        "brow": (sel((y > 162) & (y < 166) & (np.abs(x) < 3)), 2, "max"),
        "nose": (sel((y > 156) & (y < 162) & (np.abs(x) < 2)), 2, "max"),
        "chin": (sel((y > 146) & (y < 150) & (np.abs(x) < 2)), 2, "max"),
        "crown": ([top], 1, "max"),
        "hands": (sel(np.abs(x) > 58), 2, "span"),
    }


def regions(mhr=None):
    mhr = mhr or load()
    if "regions" not in mhr: mhr["regions"] = _regions(mhr["points"])
    return mhr["regions"]


def measures(points, mhr=None):
    """every measure of a body's points (cm)"""
    out = {}
    for name, (idx, ax, kind) in regions(mhr).items():
        v = points[idx, ax] * 100
        if name == "height": out[name] = float(v[0] - v[1])
        elif kind == "span": out[name] = float(np.ptp(v))
        elif kind == "max": out[name] = float(v.max())
        elif kind == "min": out[name] = float(v.min())
        else: out[name] = float(np.abs(v).max())
    return out


def fit_measures(targets, start=None, keep=0.02, groups=("body", "head"), steps=40, limit=3.0, mhr=None):
    """the identity weights whose body comes closest to the target measures (cm), staying near `start` (MHR's average
    by default; `keep` is how hard) and within +-limit (MHR's shapes are a PCA: past about 3 the body breaks):
    Gauss-Newton on the measures, which are near-linear in the weights"""
    mhr = mhr or load()
    k = len(mhr["shapes"])
    free = np.zeros(k, bool)
    for g in groups:
        a, b = mhr["header"]["groups"][g]
        free[a:b] = True
    w = np.zeros(k) if start is None else np.array(start, float)
    w0 = w.copy()
    names = list(targets)
    t = np.array([targets[n] for n in names])
    for _ in range(steps):
        m = np.array([measures(body(w, mhr), mhr)[n] for n in names])
        J = np.zeros((len(names), k))
        for i in np.flatnonzero(free):
            d = np.zeros(k); d[i] = 0.05
            J[:, i] = (np.array([measures(body(w + d, mhr), mhr)[n] for n in names]) - m) / 0.05
        A = np.vstack([J[:, free], np.sqrt(keep) * np.eye(free.sum())])
        r = np.concatenate([t - m, np.sqrt(keep) * (w0[free] - w[free])])
        step = np.linalg.lstsq(A, r, rcond=None)[0]
        w[free] = np.clip(w[free] + step, -limit, limit)
        if np.abs(step).max() < 1e-3: break
    return w


# what a shape's slider says it does: the measures it moves most (cm per unit weight, over a typical size)
WORDS = {"height": (2, "taller", "shorter"), "shoulders": (1, "broader shoulders", "narrower shoulders"),
         "chest": (1, "deeper chest", "flatter chest"), "bust": (0.6, "fuller bust", "flatter bust"),
         "waist": (1, "wider waist", "slimmer waist"), "belly": (1, "belly out", "flatter belly"),
         "hips": (1, "wider hips", "narrower hips"), "seat": (0.6, "flatter seat", "rounder seat"),
         "thighs": (0.6, "thicker thighs", "thinner thighs"), "arms": (1, "longer arms", "shorter arms"),
         "neck": (0.4, "thicker neck", "slimmer neck"), "head_w": (0.3, "wider head", "narrower head"),
         "skull": (0.3, "longer skull", "shorter skull"), "jaw": (0.3, "wider jaw", "narrower jaw"),
         "brow": (0.2, "brow forward", "brow back"), "nose": (0.2, "nose out", "nose in"),
         "chin": (0.2, "chin forward", "chin back"), "crown": (0.3, "taller head", "flatter head"),
         "hands": (0.2, "bigger hands", "smaller hands")}
GROUP_MEASURES = {"body": ["height", "shoulders", "chest", "bust", "waist", "belly", "hips", "seat", "thighs", "arms", "neck"],
                  "head": ["head_w", "skull", "jaw", "brow", "nose", "chin", "crown"], "hands": ["hands"]}


def labels(mhr=None):
    """each identity shape's slider label: the two measures it moves most, in words"""
    mhr = mhr or load()
    base = measures(mhr["points"], mhr)
    out = []
    for g, (a, b) in mhr["header"]["groups"].items():
        for i in range(a, b):
            m = measures(mhr["points"] + mhr["shapes"][i], mhr)
            d = sorted(((n, (m[n] - base[n]) / WORDS[n][0]) for n in GROUP_MEASURES[g]), key=lambda x: -abs(x[1]))
            out.append(", ".join(WORDS[n][1 if v > 0 else 2] for n, v in d[:2] if abs(v) > 0.15) or "subtle")
    return out


# the bases (DECISIONS 2026-10-26, after the user's references: slim and young, a flat stomach, the man slim and
# athletic). The body's measures in cm on MHR's own scale (the Studio scales a body to its height), fitted from MHR's
# average with the head's measures held; the head's weights are kept as they were, so faces, photo fits and hair made
# on a base stay. What MHR's shapes can't do is the base's sculpt (sculpt.js): its average belly, which they can't take
# back (feminine: the stomach 0.9 cm out of the ribs' line, from 2.1; -1 would hollow it under the ribs).
BODIES = {
    "feminine": dict(shoulders=46.3, chest=21.6, bust=14.6, waist=31.3, belly=12.6, hips=37.2, seat=-12.0, thighs=14.1, neck=12.2),
    "masculine": dict(shoulders=53.2, chest=25.8, bust=14.6, waist=30.8, belly=12.2, hips=34.4, seat=-11.0, thighs=14.9, neck=15.6),
}
SCULPT = {"feminine": {"belly": -0.7}}
# a base's head (changes from MHR's average, cm), fitted only for a base the file doesn't have yet
HEADS = {"feminine": dict(head_w=-0.6, skull=-0.4, jaw=-1.2, brow=-0.3, nose=-0.2, chin=-0.2),
         "masculine": dict(head_w=0.4, jaw=0.8, brow=0.3, chin=0.2)}
PRESETS_FILE = ROOT / "Content" / "Studio" / "Bodies" / "MHR_presets.json"


def make_presets(path=PRESETS_FILE):
    mhr = load(); base = measures(mhr["points"]); k = len(mhr["shapes"]); a, b = mhr["header"]["groups"]["body"]
    old = json.loads(path.read_text(encoding="utf-8"))["presets"] if path.exists() else {}
    out = {"average": [0.0] * k}
    for name, bdy in BODIES.items():
        w = np.zeros(k)
        if name in old: w[b:] = np.array(old[name], float)[b:]                       # the head and hands as they were
        else: w = fit_measures({n: base[n] + v for n, v in HEADS[name].items()}, keep=0.3, groups=("head",), mhr=mhr)
        was = np.array(old[name], float) if name in old else w
        hold = {n: v for n, v in measures(body(was, mhr), mhr).items() if n in GROUP_MEASURES["head"]}
        f = fit_measures({**bdy, **hold}, start=w, keep=0.01, groups=("body",), steps=60, mhr=mhr)
        w[a:b] = f[a:b]
        out[name] = [round(float(x), 4) for x in w]
    path.write_text(json.dumps({"about": "MHR identity weights for the Character Studio's bases (tools/character/mhr.py presets), "
                                         "and the sculpt each base carries (sculpt.js's controls)",
                                "presets": out, "sculpt": SCULPT}, indent=1), encoding="utf-8")
    return out


if __name__ == "__main__":
    import sys
    if sys.argv[1:] == ["presets"]:
        print({k: max(abs(x) for x in v) for k, v in make_presets().items()}, "->", PRESETS_FILE)
    else:
        print("python tools/character/mhr.py presets    the bases into Content/Studio/Bodies/MHR_presets.json")


def hull_length(pts):
    """the perimeter of the convex hull of 2D points (monotone chain): a tape measure round a slice"""
    p = sorted(set(map(tuple, np.round(np.asarray(pts, float), 6))))
    if len(p) < 3: return 0.0
    cross = lambda o, a, b: (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, hi = [], []
    for q in p:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], q) <= 0: lo.pop()
        lo.append(q)
    for q in reversed(p):
        while len(hi) >= 2 and cross(hi[-2], hi[-1], q) <= 0: hi.pop()
        hi.append(q)
    h = np.array(lo[:-1] + hi[:-1])
    return float(np.linalg.norm(h - np.roll(h, -1, 0), axis=1).sum())


def girths(points, band=0.01):
    """tape-measure girths (cm) of a body standing in MHR's A-pose: the torso's slices with the arms left out (the
    torso is what lies within the armpits' width), bust the largest round the chest, waist the smallest between bust
    and hips, hips the largest round the seat"""
    y = points[:, 1]; H = y.max() - y.min(); y0 = y.min()
    def at(frac, half=0.19):
        s = points[(np.abs(y - (y0 + H * frac)) < band) & (np.abs(points[:, 0]) < half)][:, [0, 2]]
        return hull_length(s) * 100
    fr = np.arange(0.44, 0.78, 0.005)
    g = np.array([at(f, 0.16 if f > 0.62 else 0.19) for f in fr])
    bust_i = np.argmax(np.where(fr > 0.68, g, 0)); hips_i = np.argmax(np.where(fr < 0.56, g, 0))
    waist_i = hips_i + np.argmin(g[hips_i:bust_i + 1])
    return {"bust": round(float(g[bust_i]), 1), "waist": round(float(g[waist_i]), 1), "hips": round(float(g[hips_i]), 1),
            "bust_at": round(float(fr[bust_i]), 3), "waist_at": round(float(fr[waist_i]), 3), "hips_at": round(float(fr[hips_i]), 3)}
