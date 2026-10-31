"""Rope: a shimenawa, the straw rope hung where something holy (or something sealed) is: its strands twisted round
each other, thick in its middle and thin at its ends (daikon-jime, `taper` < 1) or even (gobō-jime, `taper` 1), hung in
a sag between two points; shide (the zigzag paper streamers) hanging from it, straw tassels (fusa) between them. Its
ends are `socket_end_a` and `socket_end_b`, where it's tied.

    {"family": "rope", "span": 900, "sag": 120, "thick": 60, "taper": 0.5, "strands": 3, "shide": 4, "fusa": 3,
     "straw": "#c6ae74", "paper": "#f6f4ee"}
"""
import math

import numpy as np

from .. import designs
from .. import mesh as M
from .. import noise as N

MM = 0.001


def make(spec, th):
    seed = int(spec.get("seed", 0))
    r = N.rng(seed, "rope")
    L = float(spec.get("span", 900))
    sag = float(spec.get("sag", 120))
    D = float(spec.get("thick", 60))
    taper = float(spec.get("taper", 0.5))
    ns = int(spec.get("strands", 3))
    n_shide = int(spec.get("shide", 4))
    n_fusa = int(spec.get("fusa", 3))
    straw = spec.get("straw", "#c6ae74")
    th.material("main", "fabric", color=straw, rough=0.85)
    th.material("paper", "paper", color=spec.get("paper", "#f6f4ee"), rough=0.85, px=512)
    k = max(48, int(L / 12))
    s = np.linspace(0, 1, k)
    x = (s - 0.5) * L
    z = -sag * (1 - (2 * x / L) ** 2)
    P = np.stack([x, np.zeros_like(x), z], 1)
    seg = np.linalg.norm(np.diff(P, axis=0), axis=1)
    length = float(seg.sum())
    R = D / 2 * (taper + (1 - taper) * np.sin(math.pi * s) ** 0.8)
    for i in range(ns):
        th.island(f"strand{i}", 2 * math.pi * D / 2 * 0.6, length, wrap=True)
    th.island("shide", 34, 56, mat="paper")
    th.island("fusa", 2 * math.pi * 16, 170, wrap=True)
    th.island("tie", 2 * math.pi * 2, 40, wrap=True)
    th.pack()
    I = th.islands
    T = np.gradient(P, axis=0)
    T /= np.linalg.norm(T, axis=1, keepdims=True)
    Nn = np.stack([-T[:, 2], np.zeros(k), T[:, 0]], 1)
    B = np.array([0.0, 1.0, 0.0])
    turns = length / (4.2 * D)
    parts = []
    for i in range(ns):
        th_ = 2 * math.pi * i / ns + turns * 2 * math.pi * s
        c = P + (0.5 * R)[:, None] * (np.cos(th_)[:, None] * Nn + np.sin(th_)[:, None] * B[None])
        parts.append(M.tube(c * MM, R * 0.6 * MM, I[f"strand{i}"], n=12, caps=(True, True), cap_bulge=0.25))
    # shide: four leaves of paper cut and folded into a zigzag, tucked into the rope, each leaf turned a little
    w, h = 34.0, 56.0
    at = [(i + 1) / (n_shide + 1) for i in range(n_shide)]
    for si in at:
        j = int(si * (k - 1))
        top = P[j, 2] + R[j] * 0.2
        lean = r.uniform(-6, 6)
        for b in range(4):
            off = (0 if b % 2 == 0 else w / 2) - w / 4
            bx = M.box((w, 0.25, h), at=(P[j, 0] + off, 0, top - (b + 1) * h + b * 1.5), island="shide", islands=I, mat="paper")
            c0 = bx.v.mean(0)
            a = math.radians((14 if b % 2 else -14) + r.uniform(-6, 6))
            Rz = np.array([[math.cos(a), -math.sin(a), 0], [math.sin(a), math.cos(a), 0], [0, 0, 1]])
            l = math.radians(lean)
            Rx = np.array([[1, 0, 0], [0, math.cos(l), -math.sin(l)], [0, math.sin(l), math.cos(l)]])
            bx.v = (bx.v - c0) @ (Rx @ Rz).T + c0 + np.array([0, (top - c0[2]) * math.sin(l), 0])
            bx.v *= MM
            bx.a["rest"] = bx.v.copy()
            parts.append(bx)
    # fusa: straw tassels between the shide, bound below the rope, flaring to a cut end
    if n_shide >= 2:
        fat = [(at[i] + at[i + 1]) / 2 for i in range(len(at) - 1)][:n_fusa]
    else:
        fat = [(i + 1) / (n_fusa + 1) for i in range(n_fusa)]
    for fi in fat:
        j = int(fi * (k - 1))
        top = P[j, 2]
        Lf = float(spec.get("fusa_len", 150)) * r.uniform(0.9, 1.1)
        zz = top - Lf * np.linspace(0, 1, 16) ** 1.4
        rr = np.interp(-zz, -np.array([top, top - 16, top - 22, top - Lf * 0.75, top - Lf]), [10, 9.5, 8, 14, 16])
        path = np.stack([np.full_like(zz, P[j, 0]), np.zeros_like(zz), zz], 1)
        parts.append(M.tube(path * MM, rr * MM, I["fusa"], n=14, caps=(False, True), cap_bulge=0.05))
        tie = M.ring_path((P[j, 0], 0, top - 19), (0, 0, 1), 8.8, 20)
        parts.append(M.tube(tie * MM, 1.6 * MM, I["tie"], n=6))
    th.low = M.join(parts, ["main", "paper"])
    th.high = None
    th.sockets["end_a"] = (P[0] * MM, (-1, 0, 0))
    th.sockets["end_b"] = (P[-1] * MM, (1, 0, 0))
    th.pose = "stand"
    th.view = {"azim": -12, "elev": 12}

    def paint(fr):
        base = designs.P.rgb(straw)
        for nm in [f"strand{i}" for i in range(ns)] + ["fusa", "tie"]:
            f = fr[nm]
            X, Y = f.grid()
            i = sum(map(ord, nm))
            # straw: stalks along the strand, each its own shade, a darker one here and there, their ridges in the relief
            stalk = np.floor(X / 2.2 + 0.35 * N.fbm3(np.stack([X / 9, Y / 60, np.full_like(X, i)], -1), seed + i, 2))
            shade = N.fbm3(np.stack([stalk * 0.71, Y / 120.0, np.full_like(X, i * 0.3)], -1), seed + 1, 2)
            g = N.fbm3(np.stack([X / 1.2, Y / 25.0, np.full_like(X, i * 1.7)], -1), seed + 2, 3)
            col = base[None, None] * (1 + 0.32 * shade[..., None] + 0.1 * g[..., None])
            dark = (N.fbm3(np.stack([stalk * 1.3, Y / 200.0, np.full_like(X, 9.0 + i)], -1), seed + 3, 2) > 0.38)[..., None]
            col = np.where(dark, col * 0.72, col)
            fr_ = np.abs(((X / 2.2) % 1.0) - 0.5) * 2
            f.lay_island(np.ones_like(X), color=np.clip(col, 0, 1).astype(np.float32), rough=0.86,
                         height=(0.22 * (1 - fr_ ** 2) + 0.05 * g).astype(np.float32))
        designs.paper_base(fr["shide"], spec.get("paper", "#f6f4ee"), fibres=1.6, seed=seed)

    th.paint = paint
    return th
