"""Kitchenware turned from a profile with a real wall: plates, rice bowls and a donburi, a mug with its handle, a glass
tumbler, a jar with a lid and a label, a sake flask (tokkuri), a soy-sauce bottle. Glazed inside and out, the foot ring
left as bare clay; a glaze is a colour with its gloss, or a design (designs.py: sometsuke's blue and white, a rim line,
speckled stoneware); chips on the rim show the clay, tea stains settle inside.

    {"family": "ware", "kind": "bowl" | "plate" | "donburi" | "mug" | "glass" | "jar" | "tokkuri" | "soy",
     "art": {"design": "sometsuke"}, "glaze": "#e9e4d8", "clay": "#9a6b4a", "chips": 2, "wear": {...}}
"""
import math

import numpy as np

from .. import deform as D
from .. import designs
from .. import mesh as M
from .. import noise as N

# outer profiles (r, z) mm from the foot up to the lip, the wall's thickness, the foot ring (radius, height)
SHAPES = {
    "bowl":    dict(out=[(36, 7), (44, 12), (52, 24), (56.5, 40), (58, 56), (58.5, 62)], t=3.2, foot=(28, 7)),
    "donburi": dict(out=[(44, 8), (56, 14), (66, 30), (72, 52), (74, 74), (74.5, 80)], t=3.6, foot=(34, 8)),
    "plate":   dict(out=[(70, 4), (98, 7), (114, 13), (126, 20), (130, 22)], t=4.0, foot=(58, 4)),
    "mug":     dict(out=[(38, 3), (41, 8), (42.5, 30), (43, 60), (43.5, 92), (43.5, 96)], t=4.5, foot=(36, 3)),
    "glass":   dict(out=[(31, 0), (32, 2), (33.5, 40), (36, 80), (37, 98), (37.2, 100)], t=2.4, foot=None, base=11.0),
    "jar":     dict(out=[(36, 0), (38, 3), (40, 12), (40, 82), (36, 92), (31, 96), (31, 104)], t=2.6, foot=None, base=6.0),
    "tokkuri": dict(out=[(30, 4), (38, 12), (46, 34), (48, 52), (40, 82), (20, 108), (12, 122), (12.5, 134), (15, 140)], t=3.0, foot=(26, 4)),
    "soy":     dict(out=[(26, 0), (28, 3), (29, 50), (28, 66), (18, 82), (10, 92), (9.5, 104)], t=2.2, foot=None, base=5.0),
}
CLEAR = ("glass", "jar", "soy")


def wall(sh):
    """The closed profile: under the foot, the outside up, round the lip, the inside down to the middle (mm)."""
    out = sh["out"]
    t = sh["t"]
    pts_under = []
    if sh.get("foot"):
        fr, fh = sh["foot"]
        pts_under = [(0, fh + 1.5), (fr - 4, fh + 1.2), (fr - 2.5, 0.6), (fr - 1.6, 0.0), (fr + 0.4, 0.0), (fr + 1.4, 0.8), (fr + 1.0, fh - 0.5), (out[0][0], out[0][1])]
    else:
        pts_under = [(0, 0.8), (out[0][0] - 4, 0.6), (out[0][0] - 1.5, 0.0), (out[0][0], out[0][1])]
    r_lip, z_lip = out[-1]
    lip = [(r_lip - t / 2 + t / 2 * math.cos(a), z_lip + t / 2 * math.sin(a) * 0.9) for a in np.linspace(0, math.pi, 7)]
    # the inside: the outside's points moved in by the wall's thickness along their normals
    o = np.array(out, float)
    d = np.gradient(o, axis=0)
    nrm = np.stack([d[:, 1], -d[:, 0]], 1)
    nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-9)
    inner = o - nrm * t
    base = sh.get("base") or (sh["foot"][1] + 1.5 + t if sh.get("foot") else t)
    inner = [(max(r, 0.0), max(z, base)) for r, z in inner[::-1]]
    inside = inner + [(inner[-1][0] * 0.6, base), (0, base)]
    return {"under": pts_under, "outside": list(out), "lip": lip, "inside": inside}


def make(spec, th):
    kind = spec.get("kind", "bowl")
    sh = SHAPES[kind]
    seed = int(spec.get("seed", 0))
    prof = wall(sh)
    clear = kind in CLEAR
    th.material("main", "clear" if clear else "plastic", alpha=clear, color=spec.get("glaze", "#cfe0e6" if clear else "#ece7dc"),
                rough=0.05 if clear else 0.16, specular=0.6 if clear else None)
    R = max(r for r, z in sh["out"])
    th.island("outside", 2 * math.pi * R, M.arclen(prof["outside"]), wrap=True)
    th.island("inside", 2 * math.pi * R, M.arclen(prof["inside"]), wrap=True)
    th.island("lip", 2 * math.pi * R, M.arclen(prof["lip"]), wrap=True)
    th.island("under", 2 * R, 2 * R)
    extra = []
    if kind == "mug":
        th.island("handle", 2 * math.pi * 6, 90)
    if kind in ("jar", "soy", "tokkuri"):
        th.material("parts", "paint", color=spec.get("cap", "#b0392f" if kind == "soy" else "#d8d4cb"), rough=0.35, px=512)
        th.island("cap_side", 2 * math.pi * 40, 20, mat="parts", wrap=True)
        th.island("cap_top", 82, 82, mat="parts")
        if kind == "jar":
            th.island("label", 2 * math.pi * 40.5, 50, mat="parts", wrap=True)
    th.pack()
    I = th.islands
    mm = 0.001

    def build(n, step):
        segs = [M.Seg(np.array(prof["under"]) * mm, "under", "bottom", disc=R * mm),
                M.Seg(np.array(prof["outside"]) * mm, "outside", "band"),
                M.Seg(np.array(prof["lip"]) * mm, "lip", "band"),
                M.Seg(np.array(prof["inside"]) * mm, "inside", "band")]
        parts = [M.lathe(segs, n, I, step=step, mats=["main"])]
        if kind == "mug":
            # the handle: a rounded section along a C from the wall's top to its foot, on the right (+x)
            t = np.linspace(0, 1, 24)
            z = 78 - 52 * t
            x = 41 + 6 + 22 * np.sin(math.pi * t) ** 0.9
            path = np.stack([x, np.zeros_like(t), z], 1) * mm
            path[0, 0] = path[-1, 0] = 39.5 * mm
            a = np.linspace(0, 2 * math.pi, 14, endpoint=False)
            sec = np.stack([5.0 * np.cos(a), 7.0 * np.sin(a)], 1) * mm
            hd = M.sweep(path, sec, I["handle"])
            th_h = np.arctan2(hd.v[:, 1], hd.v[:, 0])
            hd.a["shell"] = np.stack([th_h, hd.v[:, 2], np.hypot(hd.v[:, 0], hd.v[:, 1])], 1)
            parts.append(hd)
        if kind in ("jar", "soy", "tokkuri"):
            r_top, z_top = sh["out"][-1]
            if kind == "jar":
                cap = [(0, z_top + 9), (r_top + 1.5, z_top + 8.6), (r_top + 3.0, z_top + 7.4), (r_top + 3.2, z_top - 6), (r_top + 2.2, z_top - 6.6)]
            elif kind == "soy":
                cap = [(0, z_top + 16), (6, z_top + 15.6), (10.5, z_top + 13), (11.5, z_top + 4), (11.5, z_top - 6), (10.8, z_top - 6.8)]
            else:
                cap = None
            if cap:
                cp = M.lathe([M.Seg(np.array(cap[:3]) * mm, "cap_top", "top", disc=(r_top + 3.2) * mm),
                              M.Seg(np.array(cap[2:]) * mm, "cap_side", "band")], max(24, n // 2), I, step=step, mats=["parts"])
                parts.append(cp)
            if kind == "jar":
                lb = M.lathe([M.Seg(np.array([(40.3, 22), (40.3, 72)]) * mm, "label", "band")], n, I, step=step, mats=["parts"])
                parts.append(lb)
        return M.join(parts, ["main"] + (["parts"] if kind in ("jar", "soy", "tokkuri") else []))

    chips = int(spec.get("chips", 0))
    th.low = build(int(spec.get("segments", 48)), 0.006)
    th.high = build(128, 0.0012) if chips else None
    if chips:
        r = N.rng(seed, "chips")
        r_lip, z_lip = sh["out"][-1]
        ang = r.uniform(0, 2 * math.pi, chips)
        centres = np.stack([r_lip * np.cos(ang), r_lip * np.sin(ang), np.full(chips, z_lip)], 1) * mm
        D.dents(th.high, centres, depth=1.6 * mm, radius=3.5 * mm, seed=seed, creases=0.8)
        th.chips = centres
    th.pose = spec.get("pose", "stand")
    th.view = {"azim": -15, "elev": 35}
    art = spec.get("art") or {"design": "glaze"}

    def paint(fr):
        clay = spec.get("clay", "#a47a58")
        for nm in ("outside", "inside", "lip"):
            designs.draw(fr[nm], dict(art, part=nm, glaze=th.mats["main"]["color"], clear=clear), seed, "glaze")
        f = fr["under"]
        if clear:
            f.fill(color=th.mats["main"]["color"], rough=0.05, opacity=0.35)
        else:
            designs.draw(f, {"design": "paper", "paper": clay}, seed, "paper")
            f.fill(color=clay, rough=0.85, metal=0.0, alpha=0.7)
            f.ring(f.W / 2, f.H / 2, f.W * 0.2, 0.8, color="#3a2a1a", rough=0.8, alpha=0.5)
        if "handle" in fr:
            designs.draw(fr["handle"], dict(art, part="handle", glaze=th.mats["main"]["color"]), seed, "glaze")
        for nm in ("cap_side", "cap_top"):
            if nm in fr:
                fr[nm].fill(color=th.mats["parts"]["color"], rough=0.35, metal=0.6 if kind == "jar" else 0.0)
        if "label" in fr:
            designs.draw(fr["label"], spec.get("label_art") or {"design": "jar_label"}, seed + 2, "jar_label")

    th.paint = paint
    return th
