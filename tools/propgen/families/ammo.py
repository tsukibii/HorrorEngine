"""Cartridges and the boxes they come in (DECISIONS 2026-11-09, the user's "a cartridge prop for the shells that I can
customize similar to cans and books"): the 12-gauge shell (here from the weapon family) and a printed card box of them.
Everything printed or stamped on them is one of their own pictures (PROPGEN §15), so the picture editor takes yours
there and shows it on the prop's own picture before it's made (§25).

- **`shell`**: a 2 3/4" 12-gauge (65 mm crimped, 70 mm fired): the brass head (`brass_mm` 16: its rim, the extractor
  groove, the primer, the headstamp pressed round it), the plastic hull (`hull`, a colour) with its moulding streaks
  and its print along it on the side that faces you, the six-point star crimp; `spent` opens the crimp into a mouth,
  dark inside, the brass a little tarnished, the primer struck. Its print is the design `shell_print` (`art`: brand,
  load, ink, mark) and the headstamp `stamp` ([the top's words, the bottom's]). Its own pictures: `hull.brand`,
  `hull.load`, `hull.mark`, `base.stamp`. Sockets `front`, `back`.
- **`box`**: a card box of shells: `count` of them (5, 10, 25...), `arrange` `lie` (side by side in rows of five, the
  print up, the brass toward the front, in layers: a box of five is 116 x 69 x 25 mm) or `stand` (heads up in a grid
  of five by five: 117 x 117 x 70 mm); its lid hinged along the back with a tuck flap (a part that opens, PROPGEN §26:
  `open` the degrees it's made open, 0 shut; Godot's parts.gd swings it), the shells inside as the `shells` keys say
  (a shell recipe's: hull, brass_mm, art, stamp). Its print is the design `shell_box` on each face (`art`: brand,
  gauge, length, load, pellets, speed, count, colors [ground, band, ink], gold, picture: shell | target | none). Its own
  pictures: `lid.brand`, `lid.gauge`, `lid.load`, `lid.specs`, `lid.count`, `lid.art`, `front.brand`, `front.load`,
  `back.brand`, `back.warning`, `left.gauge`, `right.gauge`, `bottom.lot`, `flap.words`, and the shells' own. Its inside
  is a container's (`inside`).

    {"family": "ammo", "kind": "shell", "hull": "#a3241f", "brass_mm": 16, "spent": false,
     "art": {"design": "shell_print", "brand": "HARROW", "load": "12 GA  2-3/4 IN  00 BUCK", "ink": "#f1eadb"},
     "stamp": ["HARROW", "12 GA"]}
    {"family": "ammo", "kind": "box", "count": 5, "arrange": "lie" | "stand", "open": 0,
     "art": {"design": "shell_box", "brand": "HARROW", "load": "00 BUCK", "colors": ["#6e1712", "#171412", "#efe6d2"]},
     "shells": {"hull": "#a3241f", "art": {"design": "shell_print", "brand": "HARROW"}}}
"""
import math

import numpy as np

from .. import designs
from .. import finish as FN
from .. import mesh as M
from .. import noise as N

CUSTOM = True       # your own pictures go on it: the picture editor previews them on its picture (PROPGEN §25)

RIM = 0.01135       # the rim's radius (m): a shell lies on it, its neighbours touch it
CRIMPED = 0.0652    # a live shell's length (m)


# ---- the shell ----------------------------------------------------------------------------------------------------------

def shell_profile(hb, spent, top=None):
    """The shell's profile, its base at z = 0, as the runs (points r, z metres) the lathe turns: the base disc, the brass
    head, the hull (a spent one's down its inside too), the crimp (None when spent). `top` cuts the hull there (only the
    head and a little of the hull: shells standing in a box, their heads up)."""
    base = [(0.0, 0.0), (0.0040, 0.0), (0.0041, 0.0003), (0.0108, 0.0002), (RIM, 0.0004)]
    head = [(RIM, 0.0004), (RIM, 0.0014), (0.0102, 0.0016), (0.0102, 0.0026), (0.0105, 0.0030), (0.0105, hb)]
    if top is not None:
        return base, head, [(0.0103, hb), (0.0103, max(top, hb + 0.002))], None
    if spent:
        # the crimp opened: the mouth flared a little, its lip, the hull's inside down to the wad's seat
        hull = [(0.0103, hb), (0.0103, 0.0690), (0.0106, 0.0702), (0.0098, 0.0705), (0.0094, 0.0690), (0.0094, 0.026), (0.0, 0.026)]
        return base, head, hull, None
    hull = [(0.0103, hb), (0.0103, 0.0630), (0.0100, 0.0646), (0.0092, 0.0652)]
    crimp = [(0.0092, 0.0652), (0.0040, 0.0640), (0.0, 0.0636)]
    return base, head, hull, crimp


def shell_islands(th, hb, spent, brass="brass", hull="hull", top=None):
    """The shell's islands at their true sizes (mm): the head's band, the base's disc, the hull's band, the crimp's disc."""
    base, head, hl, crimp = shell_profile(hb, spent, top)
    th.island("head", 2 * math.pi * RIM * 1000, M.arclen(head) * 1000, brass, wrap=True)
    th.island("base", 2 * RIM * 1000, 2 * RIM * 1000, brass)
    th.island("hull", 2 * math.pi * 10.3, M.arclen(hl) * 1000, hull, wrap=True)
    if crimp:
        th.island("crimp", 19.0, 19.0, hull)


def shell_mesh(I, hb, spent, n, step, mats, top=None):
    """The shell turned (metres, standing on its base at the origin, its print facing -y)."""
    base, head, hull, crimp = shell_profile(hb, spent, top)
    segs = [M.Seg(base, "base", "bottom", disc=RIM), M.Seg(head, "head", "band"), M.Seg(hull, "hull", "band")]
    if crimp:
        segs.append(M.Seg(crimp, "crimp", "top", disc=0.0095))
    m = M.lathe(segs, n, I, step=step, mats=mats)
    m.a["rest"] = m.v.copy()
    return m


def _outside_mm(hb, spent):
    """How far the hull's outside runs (mm, from the brass): a spent hull's island runs on down its inside."""
    _, _, hull, _ = shell_profile(hb, spent)
    return M.arclen(hull[:2]) * 1000 if spent else M.arclen(hull) * 1000


def paint_shell(fr, sp, seed, spent, hb):
    """A shell's paint: the brass satin (tarnished when fired) with the headstamp pressed round the primer, the hull's
    print (the design) and its moulding streaks, the crimp's star or a fired one's dark inside."""
    FN.metal(fr["head"], "satin", "brass", seed, along=90.0, age="tarnish" if spent else None, age_amount=0.3)
    f = fr["base"]
    FN.metal(f, "satin", "brass", seed + 1)
    c = f.W / 2
    words = sp.get("stamp", ["HARROW", "12 GA"])
    words = [words, ""] if isinstance(words, str) else list(words) + ["", ""]
    top, bot = str(words[0]), str(words[1])
    r_t, r_b, size = 6.7, 6.7, 1.35

    def stamp():
        if top:
            f.text(top, (c, c + r_t), size, font="archivo", arc=r_t, height=-0.035, add_height=True, tracking=0.12)
        if bot:
            f.text(bot, (c, c - r_b), size, font="archivo", arc=-r_b, height=-0.035, add_height=True, tracking=0.12)
    boxes = ([designs.text_box(top, (c, c + r_t), size, font="archivo", arc=r_t, tracking=0.12)] if top else []) + \
            ([designs.text_box(bot, (c, c - r_b), size, font="archivo", arc=-r_b, tracking=0.12)] if bot else [])
    f.slot("stamp", designs.union(*boxes) if boxes else (c, c, 16.0, 16.0), stamp, kind="stamp",
           about="the headstamp pressed into the brass round the primer", height=-0.035, add_height=True, relief=True)
    f.ellipse(c, c, 3.6, color="#b07a4a", rough=0.3, metal=1.0)                          # the primer, copper
    f.ring(c, c, 3.75, 0.25, height=-0.03, add_height=True)                               # its seat
    if spent:
        f.ellipse(c, c, 1.2, height=-0.2, add_height=True)                                 # the firing pin's dent
    f = fr["hull"]
    L = min(_outside_mm(hb, spent), f.H)
    art = dict({"design": "shell_print"}, **(sp.get("art") or {}))
    art.setdefault("hull", sp.get("hull", "#a3241f"))
    art["length"] = L
    designs.draw(f, art, seed, "shell_print")
    X, Y = f.grid()
    g = N.fbm3(np.stack([X / 3.0, Y / 0.2, np.full_like(X, seed * 0.1)], -1), seed + 3, 2)
    f.lay_island(np.ones_like(X), height=(0.004 * g).astype(np.float32), add_height=True)  # the extruded streaks, along it
    if spent:
        f.lay_island((Y > L + 2.0).astype(np.float32), color="#160c0a", rough=0.8)           # the inside, dark
    elif "crimp" in fr:
        f = fr["crimp"]
        f.fill(color=sp.get("hull", "#a3241f"), rough=0.42, metal=0.0)
        X, Y = f.grid()
        a = np.arctan2(Y - f.H / 2, X - f.W / 2)
        rr = np.hypot(X - f.W / 2, Y - f.H / 2)
        fold = np.abs(np.sin(3 * a)) ** 8 * np.clip(rr / 8.5, 0, 1)                         # the six folds of the star
        f.lay_island(np.clip(fold, 0, 1).astype(np.float32), height=-0.12, add_height=True, color="#5a1410")


def _shell(spec, th):
    seed = int(spec.get("seed", 0))
    spent = bool(spec.get("spent", False))
    hb = float(spec.get("brass_mm", 16)) * 0.001
    px = int(spec.get("tex", 512))
    th.material("brass", "metal", px=px, color="#c9a25e", rough=0.28, metal=1.0)
    th.material("hull", "paint", px=px, color=spec.get("hull", "#a3241f"), rough=0.42)
    shell_islands(th, hb, spent)
    th.pack()
    mats = ["brass", "hull"]
    th.low = shell_mesh(th.islands, hb, spent, 18, 0.002, mats)
    th.high = shell_mesh(th.islands, hb, spent, 36, 0.0006, mats)
    th.sockets = {"front": ((0.0, 0.0, 0.066), (0.0, 0.0, 1.0)), "back": ((0.0, 0.0, 0.0), (0.0, 0.0, -1.0))}
    th.extras["weapon"] = {"kind": "shell", "gauge": 12, "spent": spent, "length_m": 0.0705 if spent else CRIMPED}
    th.pose = "stand"
    th.view = {"azim": -30, "elev": 20}
    th.reach = 0.002
    th.cage = 0.001
    th.paint = lambda fr: paint_shell(fr, spec, seed, spent, hb)
    return th


# ---- the box --------------------------------------------------------------------------------------------------------------

def _quad(p, isl, uv, mat):
    """A quad (4 points, metres) mapped across an island at the island-local corners `uv`."""
    m = M.Mesh(np.asarray(p, float), [[0, 1, 2, 3]], np.array([[isl.to_uv(a, b) for a, b in uv]], float), mats=[mat], smooth=False)
    m.a["rest"] = m.v.copy()
    return m


def _panel(o, U, V, t, out_isl, in_isl, mat_out, mat_in):
    """A card panel: its outside the rectangle o, o+U, o+U+V, o+V (metres; seen from outside U runs right and V up, so
    U x V is its outward normal), `t` thick inward; its outside mapped across `out_isl` upright, its inside across
    `in_isl` read from inside; its four cut edges a line at the outside island's foot."""
    o, U, V = (np.asarray(x, float) for x in (o, U, V))
    nrm = np.cross(U, V)
    nrm /= max(float(np.linalg.norm(nrm)), 1e-12)
    a = [o, o + U, o + U + V, o + V]
    b = [p - nrm * t for p in a]
    parts = [_quad(a, out_isl, [(0, 0), (1, 0), (1, 1), (0, 1)], mat_out),
             _quad([b[0], b[3], b[2], b[1]], in_isl, [(1, 0), (1, 1), (0, 1), (0, 0)], mat_in)]
    mid = (a[0] + a[2]) / 2 - nrm * t / 2
    for i in range(4):
        j = (i + 1) % 4
        q = [a[j], a[i], b[i], b[j]]
        c = (q[0] + q[1] + q[2] + q[3]) / 4
        if np.dot(np.cross(q[1] - q[0], q[2] - q[0]), c - mid) < 0:
            q = q[::-1]
        parts.append(_quad(q, out_isl, [(0.5, 0.0)] * 4, mat_out))
    return M.join(parts, [mat_out, mat_in])


def _worn_edges(f, amount, seed):
    """A card face's edges scuffed through its print to the board: a ragged band along them, the corners most. (The
    wear's own edges read the mesh's curvature, which a flat panel with vertices only at its corners spreads over all
    of it: so the card's are painted here, by each texel's distance from its face's edges.)"""
    if amount <= 0:
        return
    X, Y = f.grid()
    dx, dy = np.minimum(X, f.W - X), np.minimum(Y, f.H - Y)
    d = np.minimum(dx, dy)
    n = N.fbm3(np.stack([X / 1.2, Y / 1.2, np.full_like(X, seed * 0.7)], -1), seed + 31, 3) * 0.5 + 0.5
    m = np.clip(1 - d / (0.5 + 1.5 * n), 0, 1) ** 1.5 * amount * 1.5
    m += np.clip(1 - np.hypot(dx, dy) / 6.0, 0, 1) ** 2 * (0.4 + 0.6 * n) * amount
    f.lay_island(np.clip(m, 0, 1).astype(np.float32), color="#d6c6a2", rough=0.92)


def _box(spec, th):
    seed = int(spec.get("seed", 0))
    count = max(1, int(spec.get("count", 5)))
    arrange = spec.get("arrange", "lie" if count <= 10 else "stand")
    sh = dict(spec.get("shells") or {})
    hb = float(sh.get("brass_mm", 16)) * 0.001
    t = float(spec.get("thick", 0.8)) * 0.001
    pitch = 2 * RIM + 0.0005
    if arrange == "stand":
        cols = min(count, 5)
        rows = int(math.ceil(count / cols))
        Wi, Di, Hi = cols * pitch + 0.001, rows * pitch + 0.001, CRIMPED + 0.002
        layers = 1
    else:
        cols = min(count, 5)
        layers = int(math.ceil(count / cols))
        Wi, Di, Hi = cols * pitch + 0.001, CRIMPED + 0.0018, layers * 2 * RIM + 0.0006
    W, D, H = Wi + 2 * t, Di + 2 * t, Hi + 2 * t
    fh = min(0.016, Hi * 0.7)                      # the tuck flap
    wmm, dmm, hmm = W * 1000, D * 1000, (H - t) * 1000
    px = int(spec.get("tex", 1024))
    th.material("card", "card", px=px, color=(spec.get("art") or {}).get("colors", ["#6e1712"])[0], rough=0.7)
    th.material("inside", "card", px=max(256, px // 2), color=spec.get("inside", "#b8ab94"), rough=0.9)
    for nm in ("card", "inside"):                    # no curvature-driven wear on flat card (painted instead: _worn_edges)
        th.mats[nm]["wear"] = {"edges": 0.0, "dirt": 0.0}
    th.material("brass", "metal", px=int(sh.get("tex", 512)), color="#c9a25e", rough=0.28, metal=1.0, bake=False)
    th.material("hull", "paint", px=int(sh.get("tex", 512)), color=sh.get("hull", "#a3241f"), rough=0.42, bake=False)
    for nm, w_, h_ in (("lid", wmm, dmm), ("front", wmm, hmm), ("back", wmm, hmm), ("left", dmm - 2 * t * 1000, hmm),
                       ("right", dmm - 2 * t * 1000, hmm), ("bottom", wmm - 2 * t * 1000, dmm - 2 * t * 1000),
                       ("flap", wmm - 2 * t * 1000 - 1.0, fh * 1000)):
        th.island(nm, w_, h_, "card")
        th.island("in_" + nm, w_, h_, "inside")
    top = (hb + 0.016) if arrange == "stand" else None
    shell_islands(th, hb, False, top=top)
    th.pack()
    I = th.islands
    mats = ["card", "inside", "brass", "hull"]
    h = H - t
    # the box: the walls round the bottom, the front and back across the ends of the sides
    body = [_panel((-W / 2, -D / 2, 0), (W, 0, 0), (0, 0, h), t, I["front"], I["in_front"], "card", "inside"),
            _panel((W / 2, D / 2, 0), (-W, 0, 0), (0, 0, h), t, I["back"], I["in_back"], "card", "inside"),
            _panel((-W / 2, D / 2 - t, 0), (0, -(D - 2 * t), 0), (0, 0, h), t, I["left"], I["in_left"], "card", "inside"),
            _panel((W / 2, -D / 2 + t, 0), (0, D - 2 * t, 0), (0, 0, h), t, I["right"], I["in_right"], "card", "inside"),
            _panel((-W / 2 + t, D / 2 - t, 0), (W - 2 * t, 0, 0), (0, -(D - 2 * t), 0), t, I["bottom"], I["in_bottom"], "card", "inside")]
    # the lid over it, hinged along the back's top, and its tuck flap down inside the front
    g = 0.0005
    lid = [_panel((-W / 2, -D / 2, H), (W, 0, 0), (0, D, 0), t, I["lid"], I["in_lid"], "card", "inside"),
           _panel((-W / 2 + t + g, -D / 2 + t + 0.0002, h - fh), (W - 2 * t - 2 * g, 0, 0), (0, 0, fh), t, I["flap"], I["in_flap"],
                  "card", "inside")]
    # the shells inside
    one = shell_mesh(I, hb, False, int(sh.get("segments", 14)), 0.02, mats, top=top)
    shells = []
    for k in range(count):
        m = one.copy()
        if arrange == "stand":
            c, r = k % cols, k // cols
            m.v = m.v @ M.rot("x", 180).T                                      # heads up
            m.v += np.array([(c - (cols - 1) / 2) * pitch, (r - (rows - 1) / 2) * pitch, t + Hi - 0.0006])
        else:
            c, layer = k % cols, k // cols
            m.v = m.v @ M.rot("x", -90).T                                      # lying along y, the print up, the brass to the front
            m.v += np.array([(c - (cols - 1) / 2) * pitch, -Di / 2 + 0.0008, t + RIM + layer * 2 * RIM])
        m.a["rest"] = m.v.copy()
        shells.append(m)
    open_deg = float(spec.get("open", 0))
    lid_m = M.join(lid, mats)
    if open_deg:                                     # made open: the lid turned up about its hinge (the part's `built`)
        piv = np.array([0.0, D / 2, H])
        lid_m.v = (lid_m.v - piv) @ M.rodrigues((-1.0, 0.0, 0.0), open_deg).T + piv
        lid_m.a["rest"] = lid_m.v.copy()
    th.assemble([("box", M.join(body + shells, mats)), ("lid", lid_m)], None, mats)
    th.high = None
    th.part("lid", (0.0, D / 2, H), (-1.0, 0.0, 0.0), kind="hinge", open=110.0, shut=0.0, built=open_deg)
    th.inside = ((-Wi / 2, -Di / 2, t), (Wi / 2, Di / 2, t + Hi))
    th.sockets = {"lid": ((0.0, 0.0, H), (0.0, 0.0, 1.0)), "front": ((0.0, -D / 2, H / 2), (0.0, -1.0, 0.0))}
    th.extras["ammo"] = {"kind": "box", "count": count, "arrange": arrange, "gauge": 12}
    th.pose = "stand"
    th.sharp_angle = 30
    th.view = {"azim": -28, "elev": 38}
    th.reach = 0.004
    th.cage = 0.0015
    art = dict({"design": "shell_box"}, **(spec.get("art") or {}))
    art.setdefault("count", f"{count} SHELLS")

    worn = float((spec.get("wear") or {}).get("edges", 0.3))

    def paint(fr):
        for i, nm in enumerate(("lid", "front", "back", "left", "right", "bottom", "flap")):
            designs.draw(fr[nm], dict(art, part=nm), seed, "shell_box")
            _worn_edges(fr[nm], worn, seed + i)
            designs.draw(fr["in_" + nm], {"design": "card_plain", "color": spec.get("inside", "#b8ab94")}, seed, "card_plain")
        paint_shell(fr, sh, seed + 11, False, hb)

    th.paint = paint
    return th


def make(spec, th):
    return _box(spec, th) if spec.get("kind", "shell") == "box" else _shell(spec, th)
