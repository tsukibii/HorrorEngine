"""Closets with doors that open (DECISIONS 2026-11-05, later; PROPGEN §26): a carcass of boards (the wood's grain
along each), a rail and a shelf with a folded stack (the `clothes` family's folded pieces; the hanging ones were
scrapped, DECISIONS 2026-11-05, latest),
and the doors as **parts**: a wardrobe's pair on hinges, a sliding closet's two panels on their tracks, an oshiire's
fusuma. Built with the doors shut (`built: "open"` builds them open); the runtime opens and shuts them (the story's
`open` use, or `hide` with the player inside).

    {"family": "closet", "kind": "wardrobe" | "sliding" | "oshiire", "size": [w, d, h] (mm), "wood": "#8a6a4a",
     "finish": "satin", "pbr": {"wood": "pbr/wood/WoodOak001_2K-JPG"}, "open": 100 (a hinge's degrees) or the slide in mm,
     "built": "shut" | "open",
     "stack": true (a folded stack on the shelf), "handles": "bar" | "knob" | "none", "paper": {"color": "#f1ede2",
     "pattern": "plain" | "seigaiha" | "dots"} (an oshiire's fusuma), "seed": 1}
"""
import math

import numpy as np

from .. import finish as FN
from .. import mesh as M
from .. import noise as N
from . import clothes as CL
from . import furniture as FU
from .bedding import paint_cover

MM = 0.001
FIELDS = {"kind": "wardrobe", "size": [1000, 580, 1900], "wood": "#8a6a4a", "finish": "satin", "open": 100, "built": "shut",
          "stack": True, "handles": "bar", "paper": {"color": "#f1ede2", "pattern": "plain"}}
CHOICES = {"kind": ["wardrobe", "sliding", "oshiire"], "finish": ["raw", "oil", "satin", "gloss"], "built": ["shut", "open"],
           "handles": ["bar", "knob", "none"]}
LABELS = {"size": ["width", "depth", "height"]}
KINDS = {"wardrobe": dict(size=(1000, 580, 1900), t=18.0), "sliding": dict(size=(1600, 600, 2000), t=18.0), "oshiire": dict(size=(1800, 850, 1800), t=24.0)}


def plank(L, W, t, isl_face, isl_back, isl_edge, I, R=None, move=(0, 0, 0), mat="wood", bevel=0.0012):
    """A board L along its grain (x) by W, t thick, lying, then turned by R and moved: its face on `isl_face` (seen
    from above as built), its back on `isl_back`, its edges on `isl_edge`."""
    m = M.rbox((L, W, t), bevel, I, top=isl_face, bottom=isl_back, edge=isl_edge, at=(0, 0, -t / 2), mat=mat, steps=1, corner_n=2)
    if R is not None:
        M.turn(m, R, move=move)
    else:
        m.v += np.asarray(move, float)
        m.a["rest"] = m.v.copy()
    return m


UPRIGHT_YZ = M.rot("y", -90)                         # a lying board's length x stood up along z, its face toward +x
UPRIGHT_XZ = M.rot("x", 90) @ M.rot("z", 90)         # its length along z, its width along x, its face toward -y


def make(spec, th):
    kind = spec.get("kind", "wardrobe")
    if kind not in KINDS:
        raise ValueError(f"closet kind {kind!r}: one of {', '.join(KINDS)}")
    K = KINDS[kind]
    seed = int(spec.get("seed", 0))
    r = N.rng(seed, "closet", kind)
    w, d, h = [float(v) * MM for v in (spec.get("size") or K["size"])]
    t = float(spec.get("thick", K["t"])) * MM
    wood = spec.get("wood", "#8a6a4a")
    built_open = spec.get("built", "shut") == "open"
    stack_on = bool(spec.get("stack", True))
    handles = spec.get("handles", "bar" if kind == "wardrobe" else "none")
    paper = dict({"color": "#f1ede2", "pattern": "plain", "size": 60, "ink": "#d9d2c3"}, **(spec.get("paper") or {}))
    th.material("wood", "wood", color=wood, rough=0.55)
    th.material("fabric", "fabric", color="#c9cfd6", rough=0.9)
    th.material("metal", "metal", color="#b9b9b9", rough=0.35, metal=1.0)
    if kind == "oshiire":
        th.material("paper", "paper", color=paper["color"], rough=0.9)
    # islands: a face each for the boards that show, the hidden ones small
    big = lambda nm, a, b, mat="wood": th.island(nm, a * 1000, b * 1000, mat=mat)
    big("side_face", h, d)
    big("side_in", h * 0.6, d * 0.6)
    big("top_face", w, d)
    big("bottom_face", w * 0.5, d * 0.5)
    big("back_face", h * 0.6, w * 0.6)
    big("shelf_face", w, d)
    big("plinth_face", w, 0.08)
    th.island("edges", 300, 30, mat="wood")
    door_w = w / 2 if kind == "wardrobe" else w / 2 + 0.04
    for nm in ("door_l", "door_r"):
        big(nm + "_front", h, door_w)
        big(nm + "_back", h * 0.5, door_w * 0.5)
    th.island("rail", 80, 40, mat="metal")
    th.island("hw", 60, 60, mat="metal")
    if kind == "oshiire":
        big("paper_l", h - 0.1, door_w - 0.08, mat="paper")
        big("paper_r", h - 0.1, door_w - 0.08, mat="paper")
    folded = []
    if stack_on:
        n_f = 2 if kind == "oshiire" else 3
        for i in range(n_f):
            if kind == "oshiire":
                W, L, thick = 0.9 * r.uniform(0.95, 1.0), 0.6 * r.uniform(0.95, 1.0), 0.11
                g, col = "towel", ["#ece6d8", "#d8d0c0"][i % 2]
            else:
                g = ["tee", "sweater", "shirt"][i % 3]
                Gm = CL.GARMENTS[g]
                W, L, thick = [v * MM * r.uniform(0.9, 1.05) for v in Gm["size"]] + [Gm["thick"] * MM]
                col = CL.PALETTE[int(r.integers(len(CL.PALETTE)))]
            cov = {"color": col, "pattern": "plain", "size": 28, "ink": CL._hex(CL._shade(col, 0.72)), "rough": 0.9}
            th.island(f"f{i}_top", W * 1000 * 0.6, L * 1000 * 0.6, mat="fabric")
            th.island(f"f{i}_hem", 2 * (W + L) * 1000 * 0.5, math.pi * thick * 1000 / 2 + 2, mat="fabric")
            folded.append((g, W, L, thick, cov))
    th.island("f_bottom", 60, 40, mat="fabric")
    th.pack()
    I = th.islands
    # the carcass
    body = []
    for sx in (-1, 1):
        body.append(plank(h, d, t, "side_face" if sx < 0 else "side_in", "side_in" if sx < 0 else "side_face", "edges", I, UPRIGHT_YZ, (sx * (w / 2 - t / 2), 0, h / 2 + t / 2)))
    plinth = 0.06 if kind != "oshiire" else 0.0
    body.append(plank(w - 2 * t, d, t, "top_face", "bottom_face", "edges", I, None, (0, 0, h)))
    body.append(plank(w - 2 * t, d - 0.02, t, "bottom_face", "bottom_face", "edges", I, None, (0, 0.01, plinth + t)))
    if plinth:
        body.append(plank(w - 2 * t, plinth, t, "plinth_face", "plinth_face", "edges", I, M.rot("x", 90), (0, -d / 2 + 0.03 + t / 2, plinth / 2)))
    body.append(plank(h - plinth, w - 2 * t, 0.006, "back_face", "back_face", "edges", I, UPRIGHT_XZ, (0, d / 2 - 0.003, plinth + (h - plinth) / 2)))
    shelf_z = h - 0.32 if kind != "oshiire" else h / 2
    body.append(plank(w - 2 * t, d - 0.03, t, "shelf_face", "bottom_face", "edges", I, None, (0, 0.012, shelf_z)))
    inside_lo = (-w / 2 + t, -d / 2 + 0.02, plinth + t)
    inside_hi = (w / 2 - t, d / 2 - 0.006, shelf_z - t)
    # the rail (bare: the hanging clothes were scrapped)
    highs = []
    if kind != "oshiire":
        rail_z = shelf_z - t - 0.07
        rail = M.tube(np.array([[-w / 2 + t, 0.0, rail_z], [w / 2 - t, 0.0, rail_z]]), 0.011, I["rail"], n=10, mat="metal")
        body.append(rail)
        for sx in (-1, 1):
            body.append(M.rbox((0.03, 0.04, 0.03), 0.004, I, top="hw", bottom="hw", edge="hw", at=(sx * (w / 2 - t - 0.015), 0, rail_z - 0.015), mat="metal"))
    # the folded stack on the shelf (an oshiire's futons on its lower and upper floors)
    z = shelf_z + t / 2 if kind != "oshiire" else plinth + t + t / 2
    for i, (g, W, L, thick, cov) in enumerate(folded):
        low, high = CL.folded_piece(W, L, thick, seed + 17 * i, I[f"f{i}_top"], I["f_bottom"], I[f"f{i}_hem"], mat="fabric", step=0.03)
        if kind == "oshiire":                         # a futon on each floor, in the left bay, kept inside the sides
            mv = (max(-w / 4, -w / 2 + t + W / 2 + 0.03) + r.uniform(0.0, 0.02), 0.02, z if i == 0 else shelf_z + t / 2)
        else:
            mv = (w / 4 * (1 if i % 2 else -1) * 0.8 + r.uniform(-0.02, 0.02), 0.0 + r.uniform(-0.02, 0.02), z)
            z += float(low.v[:, 2].max()) - 0.004
        for m in (low, high):
            M.turn(m, M.rot("z", r.uniform(-6, 6)), move=mv)
        body.append(low)
        highs.append(high)
    body_m = M.join(body, ["wood", "fabric", "metal"] + (["paper"] if kind == "oshiire" else []))
    # the doors
    parts = []
    front_y = -d / 2 + 0.01
    reveal = 0.003
    if kind == "wardrobe":
        dw = w / 2 - reveal * 1.5
        for nm, sx in (("door_l", -1), ("door_r", 1)):
            door = [plank(h - plinth - reveal * 2, dw, t, nm + "_front", nm + "_back", "edges", I, UPRIGHT_XZ, (sx * (dw / 2 + reveal / 2), front_y, plinth + reveal + (h - plinth - 2 * reveal) / 2))]
            if handles == "bar":
                x = sx * 0.035
                door.append(M.tube(M.spline(np.array([[x, front_y - t / 2, h * 0.5 - 0.08], [x, front_y - t / 2 - 0.03, h * 0.5 - 0.07], [x, front_y - t / 2 - 0.03, h * 0.5 + 0.07], [x, front_y - t / 2, h * 0.5 + 0.08]]), 0.01), 0.005, I["hw"], n=8, mat="metal", caps=(True, True), cap_bulge=0.2))
            elif handles == "knob":
                door.append(M.rbox((0.026, 0.026, 0.026), 0.009, I, top="hw", bottom="hw", edge="hw", at=(sx * 0.05, front_y - t / 2 - 0.026, h * 0.5 - 0.013), mat="metal"))
            dm = M.join(door, ["wood", "fabric", "metal"] + (["paper"] if kind == "oshiire" else []))
            pivot = (sx * (w / 2 - t), front_y, h / 2)
            axis = (0.0, 0.0, -1.0 if sx < 0 else 1.0)
            if built_open:
                M.turn(dm, M.rodrigues(axis, float(spec.get("open", 100))), about=pivot)
            parts.append((nm, dm, dict(pivot=pivot, axis=axis, kind="hinge", open=float(spec.get("open", 100)), built=float(spec.get("open", 100)) if built_open else 0.0)))
    else:
        travel = float(spec.get("open", (w / 2 - 0.08) * 1000)) * MM
        for nm, sx, y in (("door_l", -1, front_y + 0.02), ("door_r", 1, front_y)):
            pw = w / 2 + 0.03
            door = []
            if kind == "oshiire":                     # a fusuma: a wooden frame round a papered panel
                fw = 0.03
                door.append(plank(h - plinth, pw, 0.021, nm + "_front", nm + "_back", "edges", I, UPRIGHT_XZ, (sx * (pw / 2 - 0.015), y, plinth + (h - plinth) / 2)))
                door.append(plank(h - plinth - 2 * fw, pw - 2 * fw, 0.006, "paper_l" if sx < 0 else "paper_r", "paper_l" if sx < 0 else "paper_r", "edges", I, UPRIGHT_XZ,
                                  (sx * (pw / 2 - 0.015), y - 0.0105 - 0.003, plinth + (h - plinth) / 2), mat="paper"))
                door.append(plank(h - plinth - 2 * fw, pw - 2 * fw, 0.006, "paper_l" if sx < 0 else "paper_r", "paper_l" if sx < 0 else "paper_r", "edges", I, UPRIGHT_XZ,
                                  (sx * (pw / 2 - 0.015), y + 0.0105 + 0.003, plinth + (h - plinth) / 2), mat="paper"))
            else:
                door.append(plank(h - plinth - 0.03, pw, t, nm + "_front", nm + "_back", "edges", I, UPRIGHT_XZ, (sx * (pw / 2 - 0.015), y, plinth + 0.015 + (h - plinth - 0.03) / 2)))
            dm = M.join(door, ["wood", "fabric", "metal"] + (["paper"] if kind == "oshiire" else []))
            pivot = (sx * (pw / 2 - 0.015), y, h / 2)
            axis = (1.0 if sx < 0 else -1.0, 0.0, 0.0)
            if built_open:
                dm.v += np.asarray(axis) * travel
                dm.a["rest"] = dm.v.copy()
            parts.append((nm, dm, dict(pivot=pivot, axis=axis, kind="slide", open=travel, built=travel if built_open else 0.0)))
        # the tracks
        for y in (front_y + 0.02, front_y):
            body_m = M.join([body_m, M.box((w - 2 * t, 0.012, 0.012), at=(0, y, plinth + t), island="edges", islands=I, mat="wood")], body_m.mats)
    th.assemble([("body", body_m)] + [(nm, dm) for nm, dm, _ in parts], high=[("body", M.join(highs))] if highs else None,
                mats=["wood", "fabric", "metal"] + (["paper"] if kind == "oshiire" else []))
    for nm, dm, pt in parts:
        th.part(nm, pt["pivot"], pt["axis"], kind=pt["kind"], open=pt["open"], shut=0.0, built=pt["built"])
    th.inside = (inside_lo, inside_hi)
    th.pose = "stand"
    th.sharp_angle = 40
    th.view = {"azim": -32, "elev": 14, "lens": 42}
    th.reach, th.cage = 0.01, 0.003
    if not highs:
        th.high = None
    dwood = {"wood": wood, "ring": float(spec.get("ring", 5.0)), "finish": spec.get("finish", "satin"),
             "flaws": dict({"grain": 0.4, "cracks": 0.1, "scratches": 0.25, "dents": 0.1}, **(spec.get("flaws") or {}))}

    def paint(fr):
        faces = {"side_face": "top", "side_in": "under", "top_face": "top", "bottom_face": "under", "back_face": "under", "shelf_face": "top",
                 "plinth_face": "top", "door_l_front": "top", "door_r_front": "top", "door_l_back": "under", "door_r_back": "under", "edges": "edge"}
        for i, (nm, kd) in enumerate(faces.items()):
            FU.paint_wood(fr[nm], kd, dwood, np.random.default_rng(seed * 7 + i), seed * 13 + i)
        if kind == "oshiire":
            for nm in ("paper_l", "paper_r"):
                f = fr[nm]
                paint_cover(f, {"color": paper["color"], "pattern": paper["pattern"], "size": paper["size"], "ink": paper["ink"], "rough": 0.92}, seed + 5, weave=0.3)
                X, Y = f.grid()
                fib = N.fbm3(np.stack([X / 3.0, Y / 3.0, np.full_like(X, seed * 0.2)], -1), seed + 6, 2)
                f.lay_island((0.06 * np.clip(fib, 0, 1)).astype(np.float32), color="#000000")
                hx = f.W * 0.5 + (-f.W * 0.36 if nm == "paper_l" else f.W * 0.36)   # the hikite, the recessed pull
                f.ellipse(hx, f.H * 0.46, 18, 26, color="#2a2420", rough=0.5, height=-0.8)
                f.ring(hx, f.H * 0.46, 22, 3, color="#4a3d33", rough=0.45, metal=0.3)
        elif kind == "sliding":                       # the recessed pulls along each panel's inner edge
            for nm, side in (("door_l_front", 1), ("door_r_front", -1)):
                f = fr[nm]
                x = f.W * 0.5 + side * f.W * 0.42
                f.rect(x - 10, f.H * 0.44, 20, 120, r=6, color="#262626", rough=0.5, height=-0.9)
        FN.metal(fr["rail"], "satin", "chrome", seed)
        FN.metal(fr["hw"], spec.get("metal_finish", "satin"), spec.get("metal", "nickel"), seed + 1)
        for i, (g, W, L, thick, cov) in enumerate(folded):
            CL.paint_garment(fr[f"f{i}_top"], g, cov, seed + 7 * i, 1.0)
            CL.paint_hem(fr[f"f{i}_hem"], cov, seed + 9 * i)
        paint_cover(fr["f_bottom"], folded[0][4] if folded else {"color": "#c9cfd6"}, seed + 11, weave=0.8)

    th.paint = paint
    return th
