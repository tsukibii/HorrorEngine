"""Shipping cartons (DECISIONS 2026-11-10, last: the laptop's shop delivers what's bought "in an 'amazon' package box",
unboxed with E): a regular slotted carton of single-wall corrugated board, the kind online shops send, our own (no one's
brand: the shop's name printed on it, NIGHT-MART's unless said), customizable (`CUSTOM`).

    {"family": "parcel", "size": [305, 229, 152], "board": 3.5, "open": false, "taped": true, "shipping_label": true,
     "art": {"store": "NIGHT-MART", "tagline": "ORDERS TAKEN AT ANY HOUR", "kraft": "#b4875b", "ink": "#1e1915",
             "tape": "#c79d62", "tape_ink": "#4a3016"}}

- **The board** (`board` mm, 3.5: a C flute): the walls standing round the bottom, the front and back a board higher
  than the sides so the long flaps lie over the short ones; its cut edges show the flute (the `edge` island: a wave
  between two liners), its folds the face's own edge; the flutes' faint ribs through its faces (the relief), the
  kraft's mottling and fibres, its edges and corners scuffed, a little grime along its foot.
- **The flaps** (`size` [length, width, height] mm, x, y, z; each flap half the width long, as a regular slotted
  carton's): four parts that open (PROPGEN §26), each a hinge along its wall's top, its free edges cut: `flap_left` and
  `flap_right` (the short ones, under), `flap_front` and `flap_back` (the long ones meeting along the middle, over
  them); built shut (`open` true: built open, an emptied box). The order to open them is in the extras (`parcel.order`:
  the long ones first), so the devices plugin's HSPackage swings them in turn.
- **The tape** (`taped`): a strip of packing tape along the long flaps' seam and down the short sides, cut in two
  along the seam (each half on its flap, so the box opens as if a knife had run along it); its print the shop's name
  repeated (`tape.print`).
- **The shipping label** (`shipping_label`): on the back flap, made up: from the shop, to the occupant, a route code, a
  barcode and a tracking number (`label.label`: the whole label, your own picture there).
- **The print** (flexo ink on the kraft): the shop's mark (a crescent, a star and its name) on the front and back
  (`front.logo`, `back.logo`), its words on the front flap (`flap_front.words`), this way up and keep dry on the left
  (`left.arrows`, `left.dry`), the box maker's certificate on the right (`right.stamp`); `art`: store, tagline, kraft,
  ink, tape, tape_ink, inside.
- **Inside** (`propgen_inside`): the box between its walls and under its flaps, where the goods go.

Every name here is made up.
"""
import math

import numpy as np

from .. import mesh as M
from .. import noise as N
from ..paint import rgb, text_width
from .ammo import _worn_edges

CUSTOM = True       # your own pictures go on it: the picture editor previews them on its picture (PROPGEN §25)

GAP = 2.0           # mm between the long flaps along the seam
TAPE = 48.0         # mm, the tape's width (2 in)
LEG = 62.0          # mm the tape runs down each short side
PITCH = 7.8         # mm, a C flute's pitch
ORDER = ["flap_front", "flap_back", "flap_left", "flap_right"]


def _quad(p, isl, uv, mat):
    """A quad (4 points, metres) mapped across an island at the island-local corners `uv`."""
    m = M.Mesh(np.asarray(p, float), [[0, 1, 2, 3]], np.array([[isl.to_uv(a, b) for a, b in uv]], float), mats=[mat], smooth=False)
    m.a["rest"] = m.v.copy()
    return m


def _facing(p, uv, isl, mat, out):
    """A quad facing `out` (its corners turned round when they wind the other way)."""
    p = [np.asarray(x, float) for x in p]
    if np.dot(np.cross(p[1] - p[0], p[2] - p[0]), np.asarray(out, float)) < 0:
        p, uv = p[::-1], uv[::-1]
    return _quad(p, isl, uv, mat)


def _board(o, U, V, t, out_isl, in_isl, mat_out, mat_in, cuts=(False, False, False, False), edge=None):
    """A board panel: its outside the rectangle o, o+U, o+U+V, o+V (metres; seen from outside U runs right and V up, so
    U x V is its outward normal), `t` thick inward; the outside across `out_isl` upright, the inside across `in_isl` read
    from inside. Its four edges (0 along U from o, 1 up the far side, 2 back along the top, 3 down to o): a cut one
    (`cuts`) shows the flute, mapped across `edge` at its real length; a fold is its face's own border a board wide."""
    o, U, V = (np.asarray(x, float) for x in (o, U, V))
    nrm = np.cross(U, V)
    nrm /= max(float(np.linalg.norm(nrm)), 1e-12)
    a = [o, o + U, o + U + V, o + V]
    b = [p - nrm * t for p in a]
    corner = [np.array(c, float) for c in ((0, 0), (1, 0), (1, 1), (0, 1))]
    parts = [_quad(a, out_isl, [tuple(c) for c in corner], mat_out),
             _quad([b[0], b[3], b[2], b[1]], in_isl, [(1, 0), (1, 1), (0, 1), (0, 0)], mat_in)]
    mid = (a[0] + a[2]) / 2 - nrm * t / 2
    du = t / max(float(np.linalg.norm(U)), 1e-9)
    dv = t / max(float(np.linalg.norm(V)), 1e-9)
    inward = [np.array(w) for w in ((0.0, dv), (-du, 0.0), (0.0, -dv), (du, 0.0))]
    for i in range(4):
        j = (i + 1) % 4
        q = [a[j], a[i], b[i], b[j]]
        if cuts[i] and edge is not None:
            k = min(float(np.linalg.norm(a[j] - a[i])) * 1000 / edge.w_mm, 1.0)
            isl, uv = edge, [(k, 1.0), (0.0, 1.0), (0.0, 0.0), (k, 0.0)]
        else:
            isl, uv = out_isl, [tuple(corner[j]), tuple(corner[i]), tuple(corner[i] + inward[i]), tuple(corner[j] + inward[i])]
        c = (q[0] + q[1] + q[2] + q[3]) / 4
        parts.append(_facing(q, uv, isl, mat_out, c - mid))
    return parts


def _crescent_cov(f, cx, cy, r):
    """The shop's crescent as a coverage: a disc less one beside it, opening to the upper right."""
    a = np.radians(np.linspace(0, 360, 96, endpoint=False))
    outer = np.stack([cx + r * np.cos(a), cy + r * np.sin(a)], -1)
    inner = np.stack([cx + r * 0.42 + r * 0.8 * np.cos(a), cy + r * 0.26 + r * 0.8 * np.sin(a)], -1)
    return f.cov_of([outer]) * (1.0 - f.cov_of([inner]))


def _star(cx, cy, r):
    a = np.radians(np.arange(8) * 45.0 + 90.0)
    rr = np.where(np.arange(8) % 2 == 0, r, r * 0.32)
    return np.stack([cx + rr * np.cos(a), cy + rr * np.sin(a)], -1)


def _mark(f, cx, cy, size, store, ink, alpha=0.93):
    """The shop's mark centred at (cx, cy): the crescent with a star in its opening, then the name, `size` mm caps."""
    r = size * 0.72
    tw = text_width(store, "archivo", size, 0.08)
    w = 2 * r + size * 0.55 + tw
    x0 = cx - w / 2
    f.lay_island(_crescent_cov(f, x0 + r, cy, r), color=ink, rough=0.8, alpha=alpha)
    f.fill_polys([_star(x0 + r * 1.42, cy + r * 0.5, r * 0.34)], color=ink, rough=0.8, alpha=alpha)
    f.text(store, (x0 + 2 * r + size * 0.55, cy), size, font="archivo", anchor="left", tracking=0.08, color=ink, rough=0.8, alpha=alpha)


def _arrows(f, cx, cy, s, ink):
    """'This way up' (ISO 780): two arrows over a bar."""
    for dx in (-0.55, 0.55):
        x = cx + dx * s
        f.poly(np.array([(x - 0.11 * s, cy - 0.5 * s), (x + 0.11 * s, cy - 0.5 * s), (x + 0.11 * s, cy + 0.12 * s), (x + 0.3 * s, cy + 0.12 * s),
                         (x, cy + 0.55 * s), (x - 0.3 * s, cy + 0.12 * s), (x - 0.11 * s, cy + 0.12 * s)]), color=ink, rough=0.8, alpha=0.92)
    f.rect(cx - 0.95 * s, cy - 0.72 * s, 1.9 * s, 0.13 * s, color=ink, rough=0.8, alpha=0.92)


def _umbrella(f, cx, cy, s, ink):
    """'Keep dry' (ISO 780): an umbrella in the rain."""
    hem = cy + 0.1 * s
    a = np.radians(np.linspace(0, 180, 40))
    top = np.stack([cx + 0.62 * s * np.cos(a), hem + 0.5 * s * np.sin(a)], -1)          # right to left over the top
    scal = []
    for k in range(4):                                    # the canopy's scalloped hem, left to right, each bulging down
        c = cx - 0.62 * s + (k + 0.5) * 0.31 * s
        b = np.radians(np.linspace(180, 360, 10))
        scal.append(np.stack([c + 0.155 * s * np.cos(b), hem + 0.06 * s * np.sin(b)], -1))
    f.poly(np.concatenate([top] + scal), color=ink, rough=0.8, alpha=0.92)
    f.line(np.array([(cx, cy + 0.1 * s), (cx, cy - 0.45 * s)]), 0.07 * s, color=ink, rough=0.8, alpha=0.92)
    h = np.radians(np.linspace(180, 360, 12))
    f.line(np.stack([cx - 0.11 * s + 0.11 * s * np.cos(h), cy - 0.45 * s + 0.11 * s * np.sin(h)], -1), 0.07 * s, color=ink, rough=0.8, alpha=0.92)
    for dx, dy in ((-0.7, 0.85), (-0.3, 0.95), (0.1, 0.88), (0.5, 0.97), (0.85, 0.82)):
        x, y = cx + dx * s, cy + dy * s
        f.line(np.array([(x, y), (x - 0.06 * s, y - 0.16 * s)]), 0.05 * s, color=ink, rough=0.8, alpha=0.92)


def _certificate(f, cx, cy, r, ink, seed):
    """A box maker's certificate (made up): a ring with its words round it, the board's grade in the middle."""
    f.ring(cx, cy, r, r * 0.05, color=ink, rough=0.8, alpha=0.9)
    f.ring(cx, cy, r * 0.74, r * 0.03, color=ink, rough=0.8, alpha=0.9)
    f.text("BOX MAKER'S CERTIFICATE", (cx, cy + r * 0.87), r * 0.11, font="archivo", arc=r * 0.87, color=ink, rough=0.8, alpha=0.9)
    f.text("KESTREL BOARD CO.", (cx, cy - r * 0.87), r * 0.1, font="archivo", arc=-r * 0.87, color=ink, rough=0.8, alpha=0.9)
    for k, (s, sz) in enumerate((("SINGLE WALL", 0.1), ("32 ECT", 0.2), ("EDGE CRUSH TEST", 0.075), ("MAX 29 KG", 0.1))):
        f.text(s, (cx, cy + r * (0.36 - k * 0.24)), r * sz, font="archivo", color=ink, rough=0.8, alpha=0.9)


def make(spec, th):
    seed = int(spec.get("seed", 0))
    L, W, H = (float(v) for v in (spec.get("size") or (305, 229, 152)))
    tm = float(spec.get("board", 3.5))
    art = dict(spec.get("art") or {})
    store = str(art.get("store", "NIGHT-MART"))
    tagline = str(art.get("tagline", "ORDERS TAKEN AT ANY HOUR"))
    kraft = art.get("kraft", "#b4875b")
    inside = art.get("inside", "#bf966a")
    ink = art.get("ink", "#1e1915")
    taped = bool(spec.get("taped", True))
    labelled = bool(spec.get("shipping_label", True))
    built_open = bool(spec.get("open", False))
    px = int(spec.get("tex", 2048))
    th.material("card", "card", px=px, color=kraft, rough=0.86)
    th.material("inside", "card", px=max(256, px // 2), color=inside, rough=0.9)
    for nm in ("card", "inside"):                    # no curvature-driven wear on flat board (its edges painted: _worn_edges)
        th.mats[nm]["wear"] = {"edges": 0.0, "dirt": 0.0}
    mats = ["card", "inside"]
    if taped:
        th.material("tape", "film", px=int(spec.get("tape_tex", 512)), color=art.get("tape", "#c79d62"), rough=0.24)
        th.mats["tape"]["wear"] = {"edges": 0.0, "dirt": 0.0}
        mats.append("tape")
    if labelled:
        th.material("label", "paper", px=int(spec.get("label_tex", 512)), color="#f2f0ea", rough=0.72)
        th.mats["label"]["wear"] = {"edges": 0.0, "dirt": 0.0}
        mats.append("label")
    g_mm = 1.5                                         # the short flaps clear of the long walls each side
    fl_mm = W / 2                                      # every flap half the width long
    short_mm = W - 2 * tm - 2 * g_mm
    lh = float(np.clip(fl_mm - TAPE / 2 - 12.0, 30.0, 70.0))
    lw = min(lh * 1.43, L * 0.42)
    faces = {"front": (L, H + tm), "back": (L, H + tm), "left": (W - 2 * tm, H), "right": (W - 2 * tm, H),
             "bottom": (L - 2 * tm, W - 2 * tm), "flap_front": (L, fl_mm - GAP / 2), "flap_back": (L, fl_mm - GAP / 2),
             "flap_left": (fl_mm, short_mm), "flap_right": (fl_mm, short_mm)}
    for nm, (w_, h_) in faces.items():
        th.island(nm, w_, h_, "card")
        th.island("in_" + nm, w_, h_, "inside")
    th.island("edge", max(L, W) + 4.0, tm, "card")
    run_mm = 2 * LEG + 4 * tm + L                     # the tape's run: up the left, across the top, down the right
    if taped:
        th.island("tape", run_mm, TAPE, "tape")
    if labelled:
        th.island("label", lw, lh, "label")
    th.pack()
    I = th.islands
    mm = 0.001
    Lm, Wm, Hm, t = L * mm, W * mm, H * mm, tm * mm
    g, gap, fl, short = g_mm * mm, GAP * mm, fl_mm * mm, short_mm * mm
    zt, zm = Hm, Hm + t                               # the short walls' top (the short flaps' hinge), the long walls' (the long flaps')
    E = I["edge"]
    pieces = {nm: [] for nm in ["box"] + ORDER}
    pieces["box"] += _board((-Lm / 2, -Wm / 2, 0), (Lm, 0, 0), (0, 0, zm), t, I["front"], I["in_front"], "card", "inside")
    pieces["box"] += _board((Lm / 2, Wm / 2, 0), (-Lm, 0, 0), (0, 0, zm), t, I["back"], I["in_back"], "card", "inside")
    pieces["box"] += _board((-Lm / 2, Wm / 2 - t, 0), (0, -(Wm - 2 * t), 0), (0, 0, zt), t, I["left"], I["in_left"], "card", "inside")
    pieces["box"] += _board((Lm / 2, -Wm / 2 + t, 0), (0, Wm - 2 * t, 0), (0, 0, zt), t, I["right"], I["in_right"], "card", "inside")
    pieces["box"] += _board((-Lm / 2 + t, Wm / 2 - t, 0), (Lm - 2 * t, 0, 0), (0, -(Wm - 2 * t), 0), t, I["bottom"], I["in_bottom"], "card", "inside")
    # the flaps shut: the short ones on the short walls' tops, the long ones over them, meeting along the middle
    pieces["flap_left"] += _board((-Lm / 2, -short / 2, zt + t), (fl, 0, 0), (0, short, 0), t, I["flap_left"], I["in_flap_left"], "card", "inside",
                                  cuts=(True, True, True, False), edge=E)
    pieces["flap_right"] += _board((Lm / 2, short / 2, zt + t), (-fl, 0, 0), (0, -short, 0), t, I["flap_right"], I["in_flap_right"], "card", "inside",
                                   cuts=(True, True, True, False), edge=E)
    pieces["flap_front"] += _board((-Lm / 2, -Wm / 2, zm + t), (Lm, 0, 0), (0, fl - gap / 2, 0), t, I["flap_front"], I["in_flap_front"], "card", "inside",
                                   cuts=(False, True, True, True), edge=E)
    pieces["flap_back"] += _board((-Lm / 2, gap / 2, zm + t), (Lm, 0, 0), (0, fl - gap / 2, 0), t, I["flap_back"], I["in_flap_back"], "card", "inside",
                                  cuts=(True, True, False, True), edge=E)
    top = zm + t
    if taped:                                         # the tape: each piece mapped by where it lies along the run
        T, tw, e = I["tape"], TAPE * mm, 0.15 * mm
        su = lambda s_mm: s_mm / run_mm

        def side(sx, s0, s1, z0, z1, v0, v1, y0, y1):
            x = sx * (Lm / 2 + e)
            p = [(x, y0, z0), (x, y1, z0), (x, y1, z1), (x, y0, z1)]
            if sx > 0:                                # down the right: the run goes on as z falls
                uv = [(su(s1), v0), (su(s1), v1), (su(s0), v1), (su(s0), v0)]
            else:
                uv = [(su(s0), v0), (su(s0), v1), (su(s1), v1), (su(s1), v0)]
            return _facing(p, uv, T, "tape", (sx, 0, 0))
        for sx in (-1, 1):
            s = (lambda a: a) if sx < 0 else (lambda a: run_mm - a)
            lo = (lambda a, b: (a, b)) if sx < 0 else (lambda a, b: (b, a))
            # the leg down the short wall, the short flap's fold, the long flaps' ends (each half on its flap)
            pieces["box"].append(side(sx, *lo(s(0.0), s(LEG)), zt - LEG * mm, zt, 0.0, 1.0, -tw / 2, tw / 2))
            pieces["flap_left" if sx < 0 else "flap_right"].append(side(sx, *lo(s(LEG), s(LEG + tm)), zt, zt + t, 0.0, 1.0, -tw / 2, tw / 2))
            pieces["flap_front"].append(side(sx, *lo(s(LEG + tm), s(LEG + 2 * tm)), zm, top + e, 0.0, 0.5, -tw / 2, 0.0))
            pieces["flap_back"].append(side(sx, *lo(s(LEG + tm), s(LEG + 2 * tm)), zm, top + e, 0.5, 1.0, 0.0, tw / 2))
        s0, s1 = su(LEG + 2 * tm), su(LEG + 2 * tm + L)
        for nm, (y0, y1, v0, v1) in (("flap_front", (-tw / 2, 0.0, 0.0, 0.5)), ("flap_back", (0.0, tw / 2, 0.5, 1.0))):
            p = [(-Lm / 2 - e, y0, top + e), (Lm / 2 + e, y0, top + e), (Lm / 2 + e, y1, top + e), (-Lm / 2 - e, y1, top + e)]
            pieces[nm].append(_facing(p, [(s0, v0), (s1, v0), (s1, v1), (s0, v1)], T, "tape", (0, 0, 1)))
    if labelled:                                      # the shipping label on the back flap, right of the middle
        lx = L * 0.12 * mm
        ly0 = gap / 2 + (TAPE / 2 + 7.0) * mm
        x0, x1, y0, y1, z = lx - lw * mm / 2, lx + lw * mm / 2, ly0, ly0 + lh * mm, top + 0.25 * mm
        pieces["flap_back"].append(_facing([(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)], [(0, 0), (1, 0), (1, 1), (0, 1)],
                                           I["label"], "label", (0, 0, 1)))
    r = N.rng(seed, "parcel_flaps")
    opens = {"flap_front": 112.0 + r.uniform(-6, 6), "flap_back": 117.0 + r.uniform(-6, 6),
             "flap_left": 101.0 + r.uniform(-5, 5), "flap_right": 105.0 + r.uniform(-5, 5)}
    hinges = {"flap_front": ((0.0, -Wm / 2, zm), (1.0, 0.0, 0.0)), "flap_back": ((0.0, Wm / 2, zm), (-1.0, 0.0, 0.0)),
              "flap_left": ((-Lm / 2, 0.0, zt), (0.0, -1.0, 0.0)), "flap_right": ((Lm / 2, 0.0, zt), (0.0, 1.0, 0.0))}
    joined = []
    for nm in ["box"] + ORDER:
        m = M.join(pieces[nm], mats)
        if nm != "box" and built_open:               # made open: each flap turned up about its hinge (the part's `built`)
            piv = np.asarray(hinges[nm][0], float)
            m.v = (m.v - piv) @ M.rodrigues(hinges[nm][1], opens[nm]).T + piv
            m.a["rest"] = m.v.copy()
        joined.append((nm, m))
    th.assemble(joined, None, mats)
    th.high = None
    for nm in ORDER:
        th.part(nm, hinges[nm][0], hinges[nm][1], kind="hinge", open=round(opens[nm], 1), shut=0.0,
                built=round(opens[nm], 1) if built_open else 0.0)
    th.inside = ((-Lm / 2 + t, -Wm / 2 + t, t), (Lm / 2 - t, Wm / 2 - t, zt))
    th.sockets = {"top": ((0.0, 0.0, top), (0.0, 0.0, 1.0)), "front": ((0.0, -Wm / 2, Hm / 2), (0.0, -1.0, 0.0))}
    th.extras["parcel"] = {"size": [L, W, H], "board": tm, "order": ORDER, "taped": taped, "store": store}
    th.pose = "stand"
    th.sharp_angle = 30
    th.view = {"azim": -32, "elev": 36}
    th.reach = 0.004
    th.cage = 0.0015
    worn = float((spec.get("wear") or {}).get("edges", 0.45))
    grime = float((spec.get("wear") or {}).get("grime", 0.5))
    ribs_along = {"front": "x", "back": "x", "left": "x", "right": "x", "bottom": "x", "flap_front": "x", "flap_back": "x",
                  "flap_left": "y", "flap_right": "y"}

    def board(f, col, ribs, k, rough=0.86, specks=0.32):
        """Kraft: its colour mottled, its fibres and a dark one here and there, the flutes' ribs through the liner
        (relief, and a breath of shade), its roughness uneven with them."""
        X, Y = f.grid()
        n1 = N.fbm3(np.stack([X / 45.0, Y / 45.0, np.full_like(X, seed * 1.3 + k)], -1), seed + 3, 3)
        n2 = N.fbm3(np.stack([X / 1.4, Y / 1.4, np.full_like(X, seed * 0.9 + 5 + k)], -1), seed + 5, 2)
        n3 = N.fbm3(np.stack([X / 0.6, Y / 2.2, np.full_like(X, seed * 0.7 + 11 + k)], -1), seed + 7, 2)
        rib = np.cos((X if ribs == "x" else Y) / PITCH * 2 * math.pi)
        speck = np.clip((n3 - 0.5) * 5.0, 0, 1)
        c = rgb(col)[None, None] * (1 + 0.05 * n1[..., None] + 0.035 * n2[..., None]) * (1 - 0.014 * rib)[..., None]
        c = c * (1 - specks * speck)[..., None]
        f.lay_island(np.ones_like(X, np.float32), color=np.clip(c, 0, 1).astype(np.float32),
                     rough=np.clip(rough + 0.035 * n1 + 0.025 * n2, 0, 1).astype(np.float32),
                     height=(0.035 * rib + 0.008 * n2).astype(np.float32))
        return X, Y

    def foot_grime(f, X, Y, k):
        """Where it was set down: dark along its foot, uneven."""
        n = N.fbm3(np.stack([X / 9.0, Y / 9.0, np.full_like(X, 3.0 + k)], -1), seed + 61, 3) * 0.5 + 0.5
        m = np.clip(1 - Y / (6.0 + 10.0 * n), 0, 1) ** 1.6 * grime * 0.55
        f.lay_island(m.astype(np.float32), color="#4b3a2a", rough=0.92)

    def paint(fr):
        for k, (nm, ribs) in enumerate(ribs_along.items()):
            f = fr[nm]
            X, Y = board(f, kraft, ribs, k)
            board(fr["in_" + nm], inside, ribs, k + 20, rough=0.84, specks=0.45)
            if nm in ("front", "back", "left", "right"):
                foot_grime(f, X, Y, k)
            if nm == "bottom":                          # the bottom flaps' seam and its strip of tape (painted: it's seldom seen)
                f.rect(-1, f.H / 2 - 0.4, f.W + 2, 0.8, color="#3d2c1e", rough=0.95)
                if taped:
                    f.rect(-1, f.H / 2 - TAPE / 2, f.W + 2, TAPE, color=art.get("tape", "#c79d62"), rough=0.42, alpha=0.9)
            _worn_edges(f, worn, seed + k)
        F = fr["front"]
        s = min(22.0, L * 0.072, H * 0.16)
        F.slot("logo", (F.W / 2, F.H * 0.56, F.W * 0.8, s * 3.2),
               lambda: (_mark(F, F.W / 2, F.H * 0.58, s, store, ink),
                        F.text(tagline, (F.W / 2, F.H * 0.58 - s * 1.35), s * 0.34, font="bebas", tracking=0.3, color=ink, rough=0.8, alpha=0.9)),
               kind="logo", about="the shop's mark on the front")
        F.text("PLEASE RECYCLE", (F.W - 8.0, 9.0), 3.2, font="bebas", anchor="right", tracking=0.2, color=ink, rough=0.8, alpha=0.85)
        B = fr["back"]
        B.slot("logo", (B.W / 2, B.H * 0.56, B.W * 0.8, s * 3.2),
               lambda: (_mark(B, B.W / 2, B.H * 0.58, s, store, ink),
                        B.text(tagline, (B.W / 2, B.H * 0.58 - s * 1.35), s * 0.34, font="bebas", tracking=0.3, color=ink, rough=0.8, alpha=0.9)),
               kind="logo", about="the shop's mark on the back")
        Lf = fr["left"]
        a = min(16.0, Lf.H * 0.13)
        ax, ay = max(a * 1.3, (Lf.W / 2 - TAPE / 2) / 2), Lf.H - a * 1.5
        Lf.slot("arrows", (ax, ay, a * 2.2, a * 1.8), lambda: _arrows(Lf, ax, ay, a, ink), kind="stamp", about="this way up")
        ux = Lf.W - ax
        Lf.slot("dry", (ux, ay, a * 2.0, a * 2.0), lambda: _umbrella(Lf, ux, ay - a * 0.2, a, ink), kind="stamp", about="keep dry")
        R = fr["right"]
        rr = min(24.0, R.H * 0.2, (R.W / 2 - TAPE / 2) * 0.48)
        cx, cy = rr * 1.25, R.H * 0.42
        R.slot("stamp", (cx, cy, rr * 2.2, rr * 2.2), lambda: _certificate(R, cx, cy, rr, ink, seed), kind="stamp",
               about="the box maker's certificate (made up)")
        Ff = fr["flap_front"]
        sw = min(13.0, L * 0.042)
        wy = (Ff.H - (TAPE / 2 if taped else 0.0)) * 0.48
        Ff.slot("words", (Ff.W / 2, wy, Ff.W * 0.8, sw * 2.8),
                lambda: (_mark(Ff, Ff.W / 2, wy + sw * 0.4, sw, store, ink),
                         Ff.text(tagline, (Ff.W / 2, wy - sw * 0.95), sw * 0.42, font="bebas", tracking=0.3, color=ink, rough=0.8, alpha=0.9)),
                kind="logo", about="the shop's words on the top")
        Fe = fr["edge"]
        X, Y = Fe.grid()
        Fe.lay_island(np.ones_like(X, np.float32), color="#3b2a1b", rough=0.96)            # the flutes' hollows
        lin = 0.42
        Fe.lay_island(((Y < lin) | (Y > Fe.H - lin)).astype(np.float32), color="#c99d6c", rough=0.9)
        wave = Fe.H / 2 + (Fe.H / 2 - lin) * np.sin(X / PITCH * 2 * math.pi)
        Fe.lay_island(np.clip(1.0 - np.abs(Y - wave) / 0.42, 0, 1).astype(np.float32), color="#b08455", rough=0.9)
        if taped:
            Tf = fr["tape"]
            X, Y = Tf.grid()
            n = N.fbm3(np.stack([X / 40.0, Y / 2.5, np.full_like(X, 2.0)], -1), seed + 41, 2)
            # the film laid by hand: creases across it, a bubble here and there, its gloss uneven with them
            cr = (1.0 - np.abs(N.fbm3(np.stack([X / 3.0, Y / 26.0, np.full_like(X, 4.0)], -1), seed + 43, 3))) ** 10
            bub = np.clip((N.fbm3(np.stack([X / 3.5, Y / 3.5, np.full_like(X, 6.0)], -1), seed + 45, 2) - 0.45) * 5.0, 0, 1)
            c = rgb(art.get("tape", "#c79d62"))[None, None] * (1 + 0.035 * n[..., None] + 0.06 * (cr + bub)[..., None])
            Tf.lay_island(np.ones_like(X, np.float32), color=np.clip(c, 0, 1).astype(np.float32),
                          rough=np.clip(0.26 + 0.08 * cr + 0.03 * n - 0.05 * bub, 0.05, 1).astype(np.float32),
                          height=(0.03 * cr + 0.045 * bub).astype(np.float32))

            def words():
                one = f"{store}  //  ALWAYS OPEN  //  "
                sz = TAPE * 0.2
                step = text_width(one, "bebas", sz, 0.25)
                x = 6.0
                while x < Tf.W:
                    Tf.text(one, (x, Tf.H / 2), sz, font="bebas", anchor="left", tracking=0.25, color=art.get("tape_ink", "#4a3016"), rough=0.3, alpha=0.9)
                    x += max(step + sz * 0.9, 20.0)       # (an outline's width leaves out its trailing spaces)
            Tf.slot("print", (Tf.W / 2, Tf.H / 2, Tf.W, Tf.H), words, kind="pattern", about="the packing tape's print")
        if labelled:
            Lb = fr["label"]
            X, Y = Lb.grid()
            g = N.fbm3(np.stack([X / 0.7, Y / 0.7, np.full_like(X, 8.0)], -1), seed + 47, 2)
            g2 = N.fbm3(np.stack([X / 12.0, Y / 12.0, np.full_like(X, 9.0)], -1), seed + 49, 2)
            Lb.lay_island(np.ones_like(X, np.float32), color=np.clip(rgb("#efece4")[None, None] * (1 + 0.02 * g[..., None] + 0.025 * g2[..., None]), 0, 1).astype(np.float32),
                          rough=np.clip(0.74 + 0.05 * g + 0.04 * g2, 0, 1).astype(np.float32), height=(0.006 * g + 0.012 * g2).astype(np.float32))

            def lab():
                k = Lb.H / 70.0
                c = "#1a1a1a"
                W_, H_ = Lb.W, Lb.H
                Lb.text(f"FROM: {store} FULFILMENT / DOCK 9", (3 * k, H_ - 4.2 * k), 2.3 * k, font="mono", anchor="left", color=c, rough=0.62)
                Lb.rect(2 * k, H_ - 7.6 * k, W_ - 4 * k, 0.5 * k, color=c, rough=0.62)
                Lb.text("SHIP TO:", (3 * k, H_ - 11.5 * k), 2.5 * k, font="archivo", anchor="left", color=c, rough=0.62)
                Lb.text("OCCUPANT", (3 * k, H_ - 18.5 * k), 5.0 * k, font="archivo", anchor="left", color=c, rough=0.62)
                Lb.text("LEAVE AT THE DOOR. NO SIGNATURE.", (3 * k, H_ - 24.5 * k), 2.1 * k, font="mono", anchor="left", color=c, rough=0.62)
                Lb.rect(W_ - 25 * k, H_ - 31 * k, 22 * k, 21 * k, color=c, rough=0.62)
                Lb.text("N9", (W_ - 14 * k, H_ - 20.5 * k), 10.5 * k, font="archivo", color="#f2f0ea")
                Lb.rect(2 * k, H_ - 34 * k, W_ - 4 * k, 0.5 * k, color=c, rough=0.62)
                Lb.text("NIGHT DELIVERY", (3 * k, H_ - 38.5 * k), 2.8 * k, font="archivo", anchor="left", color=c, rough=0.62)
                Lb.text("1 OF 1", (W_ - 3 * k, H_ - 38.5 * k), 2.8 * k, font="archivo", anchor="right", color=c, rough=0.62)
                rng = np.random.default_rng(seed + 77)
                x, x1 = 6 * k, W_ - 6 * k
                while x < x1:
                    bw = float(rng.choice([0.45, 0.45, 0.9, 1.35])) * k
                    if rng.random() < 0.56:
                        Lb.rect(x, 9.5 * k, min(bw, x1 - x), 16 * k, color=c, rough=0.62)
                    x += bw + 0.45 * k
                Lb.text("NM 4471 0922 3108", (W_ / 2, 5.2 * k), 2.6 * k, font="mono", color=c, rough=0.62)
            Lb.slot("label", (Lb.W / 2, Lb.H / 2, Lb.W, Lb.H), lab, kind="picture", about="the shipping label")

    th.paint = paint
    return th
