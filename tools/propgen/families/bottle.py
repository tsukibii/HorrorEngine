"""PET bottles: a 500 ml water bottle turned from its profile (the push-up base, ribs above and below a recessed label
band, the shoulder, the neck's support ring), its wrap-round label, a knurled cap, the water inside to `fill`; crushed,
the PET crinkles into sharp little creases and the neck stays as it was.

    {"family": "bottle", "art": {"design": "water", "brand": "MIZUHO"}, "fill": 0.8, "cap": "#2a6fd6",
     "crush": {"amount": 0.7, ...}, "crinkle": 0.6}
"""
import math

import numpy as np

from .. import deform as D
from .. import designs
from .. import mesh as M
from .. import noise as N


def profile(H=205.0, R=32.5, neck=13.5, label=(60.0, 128.0), ribs=True):
    """(base, low body, label band, high body, shoulder, neck) runs in mm, the cap's from H - 15.5 to H."""
    base = [(0, 4.0), (8, 3.7), (16, 2.8), (22, 1.6), (26, 0.6), (28.5, 0.0), (30.8, 0.4), (32.0, 1.6), (R, 3.5)]
    z_sh = 0.70 * H

    def grooves(z0, z1):
        pts = [(R, z0)]
        if ribs:
            n = int((z1 - z0) // 9.0)
            for i in range(n):
                zc = z0 + (i + 0.5) * (z1 - z0) / n
                pts += [(R, zc - 2.4), (R - 1.0, zc - 1.2), (R - 1.4, zc - 0.4), (R - 1.4, zc + 0.4), (R - 1.0, zc + 1.2), (R, zc + 2.4)]
        pts.append((R, z1))
        return pts

    low = grooves(3.5, label[0] - 3.0)
    band = [(R, label[0] - 3.0), (R - 0.45, label[0] - 1.5), (R - 0.45, label[1] + 1.5), (R, label[1] + 3.0)]
    high = grooves(label[1] + 3.0, z_sh)
    zn = H - 22.0
    sh = []
    for i in range(25):
        s = i / 24
        r = neck + (R - neck) * (0.5 + 0.5 * math.cos(math.pi * s ** 0.9))
        sh.append((r, z_sh + (zn - z_sh) * s))
    nk = [(neck, zn), (neck, H - 18.6), (neck + 3.1, H - 18.2), (neck + 3.1, H - 16.9), (neck + 0.25, H - 16.4), (neck + 0.25, H - 3.0),
          (neck - 1.6, H - 2.4)]
    return {"base": base, "low": low, "band": band, "high": high, "shoulder": sh, "neck": nk}


def inside(prof, H, R, spec, fill, I):
    """The water: the inside of the wall from the push-up to the neck's top, closed, and its fill table."""
    from .. import liquid as LQ
    pts = prof["base"] + prof["low"][1:] + prof["band"][1:] + prof["high"][1:] + prof["shoulder"][1:] + prof["neck"][1:-1]
    inner = [(max(r - 0.5, 0.0), z + 0.4) for r, z in pts]
    return LQ.turned(inner, I, "water", spec.get("liquid", "water"), fill, spec.get("liquid_color"), int(spec.get("seed", 0)))


CAP = [(0, 0.0), (8, -0.15), (13.2, -0.35), (14.9, -0.9), (15.35, -1.7), (15.35, -12.4), (15.6, -12.9), (15.6, -15.5), (14.2, -15.6)]


def make(spec, th):
    H, R = float(spec.get("height", 205.0)), float(spec.get("radius", 32.5))
    neck = 13.5
    prof = profile(H, R, neck, tuple(spec.get("label_band", (60.0, 128.0))), spec.get("ribs", True))
    crushed = bool(spec.get("crush"))
    fill = float(spec.get("fill", 0.0 if crushed else 0.85))
    capc = spec.get("cap", "#2a6fd6")
    th.material("clear", "clear", alpha=True, double=True, color="#e6eef2", rough=0.06, specular=0.6)
    th.material("main", "plastic", color="#f2f2f0", rough=0.45, px=int(spec.get("tex", 1024)))
    body_len = sum(M.arclen(prof[k]) for k in ("low", "band", "high"))
    th.island("pet", 2 * math.pi * R, body_len, mat="clear", wrap=True)
    th.island("pet_top", 2 * math.pi * R, M.arclen(prof["shoulder"]) + M.arclen(prof["neck"]), mat="clear", wrap=True)
    th.island("pet_base", 2 * R, 2 * R, mat="clear")
    th.island("water", 2 * math.pi * R, 60, mat="clear", wrap=True)
    th.island("water_top", 2 * R, 2 * R, mat="clear")
    lab0, lab1 = spec.get("label_band", (60.0, 128.0))
    th.island("label", 2 * math.pi * (R + 0.2), lab1 - lab0, mat="main", wrap=True)
    th.island("cap_side", 2 * math.pi * 15.6, M.arclen(CAP[3:]), mat="main", wrap=True)
    th.island("cap_top", 31.0, 31.0, mat="main")
    th.pack()
    I = th.islands
    mm = 0.001

    def build(n, step):
        segs = [M.Seg(np.array(prof["base"]) * mm, "pet_base", "bottom", disc=R * mm),
                M.Seg(np.array(prof["low"] + prof["band"][1:] + prof["high"][1:]) * mm, "pet", "band"),
                M.Seg(np.array(prof["shoulder"] + prof["neck"][1:]) * mm, "pet_top", "band")]
        pet = M.lathe(segs, n, I, step=step, mats=["clear"])
        # the label: a band just proud of the recess
        lab = M.lathe([M.Seg(np.array([(R + 0.15 - 0.45, lab0), (R + 0.15 - 0.45, lab1)]) * mm, "label", "band")], n, I, step=step, mats=["main"])
        cap = M.lathe([M.Seg(np.array(CAP[:4]) * mm, "cap_top", "top", disc=15.5 * mm),
                       M.Seg(np.array(CAP[3:]) * mm, "cap_side", "band")], max(32, n // 2), I, step=step, mats=["main"])
        cap.v[:, 2] += H * mm
        cap.a["shell"][:, 1] += H * mm
        cap.a["rest"] = cap.v.copy()
        parts = []
        return M.join(parts + [pet, lab, cap])

    if crushed:
        th.low = build(int(spec.get("segments", 56)), 0.004)
        th.high = build(160, 0.0012)
    else:
        th.low = build(int(spec.get("segments", 40)), 0.008)
        th.high = None
    if fill > 0 and not crushed:
        th.liquid = inside(prof, H, R, spec, fill, I)
    seed = int(spec.get("seed", 0))
    c = spec.get("crush")
    for m in (th.low, th.high):
        if m is None or not c:
            continue
        D.crush(m, amount=c.get("amount", 0.7), at=c.get("at", 0.42), spread=c.get("spread", 0.34), squash=c.get("squash", 0),
                twist=c.get("twist", 20), buckle=c.get("buckle", 0.9), wrinkle=c.get("wrinkle", 0.7), shorten=c.get("shorten", 0.12),
                bend=c.get("bend", 0), rigid=(0.03, 0.74), thin=c.get("thin", 0.1), seed=c.get("seed", seed), z_range=(0.0, H * mm))
        # PET crinkles: fine sharp creases over what was squashed
        z = m.a["rest"][:, 2] / (H * mm)
        mask = N.smoothstep(0.02, 0.12, z) * (1 - N.smoothstep(0.66, 0.74, z))
        D.displace(m, float(spec.get("crinkle", 0.6)) * 1.6 * mm, 9 * mm, seed + 11, ridged=True, mask=mask)
        D.displace(m, float(spec.get("crinkle", 0.6)) * 0.6 * mm, 3.5 * mm, seed + 12, ridged=True, mask=mask)
    th.pose = "lie" if crushed else "stand"
    art = spec.get("art") or {"design": "water"}

    def paint(fr):
        for nm in ("pet", "pet_top", "pet_base"):
            f = fr[nm]
            f.fill(color="#e9f1f4", rough=0.05, opacity=0.12)
        fr["pet_base"].ring(fr["pet_base"].W / 2, fr["pet_base"].H / 2, 6, 0.8, height=0.08, opacity=0.35)
        for nm in ("water", "water_top"):
            fr[nm].fill(color="#cfe6f2", rough=0.02, opacity=0.0)
        designs.draw(fr["label"], art, seed, "water")
        f = fr["cap_side"]
        f.fill(color=capc, rough=0.42)
        f.stripes(0.9, 0.45, angle=0, height=0.12)
        f.rect(0, 0, f.W, 2.6, color=capc, rough=0.5)
        f.stripes(3.0, 0.15, angle=0, color="#000000", alpha=0.25, mask=None)
        f = fr["cap_top"]
        f.fill(color=capc, rough=0.38)
        f.ring(f.W / 2, f.H / 2, 13.0, 0.5, height=0.1)
        f.text((art.get("brand") or "MIZUHO")[:8], (f.W / 2, f.H / 2), 3.0, font="archivo", height=0.08, add_height=True)

    th.paint = paint
    th.view = {"azim": -12} if not crushed else {}
    return th
