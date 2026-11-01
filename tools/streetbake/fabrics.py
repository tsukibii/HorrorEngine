"""Fabrics for the Character Studio's clothes, made the way the street's materials are (library.py, DECISIONS
2026-11-01: "similar to what we did for props and buildings can you create some procedural materials with blender for the
clothing in the studio, stuff like cotton, etc."): each a procedural node group read in metres, built from what the cloth
is made of, its threads, stitches, fibres or grain at their real size, and baked once into a tileable set on the PBR
shelf (assets/pbr/Procedural/fabric_<name>/, tiles.py): colour, normal, roughness, ORM and height. A garment wears one
from the Studio's PBR set picker (they're listed first), `pbr/Procedural/fabric_<name>`, its repeat the set's own.

Most are white-based (their colour is a tint: the Studio lays the garment's colour over it), so one cotton serves every
colour of shirt; the ones whose colour is in their threads (denim's indigo warp over an ecru weft, tweed's flecks,
chambray) carry their own colours and aren't tinted.

The families:
  weave     threads over and under each other: plain (poplin, cotton, canvas, linen with its slubs), basket (oxford),
            twill (denim, gabardine, chino), herringbone, satin; each thread its own shade and thickness along it
  knit      stitches in columns: jersey's little Vs, rib (knit and purl columns), a waffle's cells
  felt      fibres with no weave to see: flannel (a twill under its brushed fuzz), fleece, melton
  grain     a hide: leather's cells and pores, suede's nap
  pile      a cut pile: corduroy's wales, velvet; crepe's pebbled grain; boucle's loops; tweed's flecked twill

Each entry: label, family, its period (metres: a whole number of its repeats each way, so it tiles), the relief its
height stands for (metres), its numbers, and whether its colour is a tint. Built with nodes.NB (the street's own)."""
import math

from .nodes import srgb

PI = math.pi

# name: (label, family, (period u, period v) metres, relief metres, numbers, tint)
LIB = {
    "fabric_poplin":      ("Poplin (shirting)", "weave", (0.024, 0.024), 0.00015, dict(weave="plain", pitch=0.00015, col="#eeece6", var=0.03, rough=0.78, fuzz=0.1), True),
    "fabric_cotton":      ("Cotton (plain weave)", "weave", (0.03, 0.03), 0.00025, dict(weave="plain", pitch=0.00025, col="#ebe9e2", var=0.04, slub=0.15, rough=0.85, fuzz=0.25), True),
    "fabric_oxford":      ("Oxford (basket weave shirting)", "weave", (0.03, 0.03), 0.00025, dict(weave="basket", pitch=0.00025, col="#e6e4de", weft="#fbfaf6", var=0.03, rough=0.84, fuzz=0.2), True),
    "fabric_linen":       ("Linen", "weave", (0.04, 0.04), 0.00045, dict(weave="plain", pitch=0.0004, col="#e9e4d8", var=0.07, slub=0.6, rough=0.9, fuzz=0.3, heather=0.06), True),
    "fabric_canvas":      ("Canvas", "weave", (0.04, 0.04), 0.0006, dict(weave="plain", pitch=0.0008, col="#e4e0d4", var=0.04, slub=0.2, rough=0.9, fuzz=0.15), True),
    "fabric_chambray":    ("Chambray (blue warp, white weft)", "weave", (0.03, 0.03), 0.0002, dict(weave="plain", pitch=0.0002, col="#6f8db4", weft="#e8e6df", var=0.05, slub=0.3, rough=0.85, fuzz=0.2), False),
    "fabric_denim":       ("Denim (3/1 twill, indigo)", "weave", (0.03, 0.03), 0.0004, dict(weave="twill", over=3, under=1, pitch=0.0003, col="#2d4268", weft="#8e9bb0", var=0.1, slub=0.8, rough=0.82, fuzz=0.25, heather=0.16, streaks=0.12), False),
    "fabric_denim_light": ("Denim, washed light", "weave", (0.03, 0.03), 0.00035, dict(weave="twill", over=3, under=1, pitch=0.0003, col="#7f9cc0", weft="#c9d0db", var=0.12, slub=0.8, rough=0.86, fuzz=0.3, heather=0.18, streaks=0.15), False),
    "fabric_gabardine":   ("Gabardine (fine steep twill, suiting)", "weave", (0.024, 0.024), 0.00018, dict(weave="twill", over=2, under=1, pitch=0.00016, col="#e6e3dc", var=0.025, rough=0.72, fuzz=0.08), True),
    "fabric_chino":       ("Chino twill", "weave", (0.03, 0.03), 0.00025, dict(weave="twill", over=2, under=1, pitch=0.00025, col="#e8e4da", var=0.035, slub=0.15, rough=0.82, fuzz=0.18), True),
    "fabric_herringbone": ("Herringbone wool", "weave", (0.048, 0.048), 0.0005, dict(weave="herringbone", over=2, under=2, pitch=0.0006, band=10, col="#e2dfd8", weft="#b9b5ad", var=0.05, rough=0.9, fuzz=0.45), True),
    "fabric_satin":       ("Satin (silk, five-harness)", "weave", (0.02, 0.02), 0.0001, dict(weave="satin", pitch=0.0001, col="#f2f0ea", var=0.015, rough=0.32, fuzz=0.0), True),
    "fabric_jersey":      ("Jersey (t-shirt knit)", "knit", (0.024, 0.024), 0.0003, dict(stitch="jersey", w=0.0008, h=0.0006, col="#eceae4", var=0.03, rough=0.86, fuzz=0.25), True),
    "fabric_sweater":     ("Sweater knit (chunky)", "knit", (0.06, 0.06), 0.0012, dict(stitch="jersey", w=0.004, h=0.003, col="#e8e3d8", var=0.05, rough=0.92, fuzz=0.6, heather=0.05), True),
    "fabric_rib":         ("Rib knit (2 x 2)", "knit", (0.032, 0.032), 0.0008, dict(stitch="rib", w=0.002, h=0.0016, col="#e9e6df", var=0.03, rough=0.9, fuzz=0.35), True),
    "fabric_waffle":      ("Waffle knit (thermal)", "knit", (0.032, 0.032), 0.0009, dict(stitch="waffle", w=0.004, h=0.004, col="#ece9e1", var=0.03, rough=0.9, fuzz=0.3), True),
    "fabric_flannel":     ("Flannel (brushed wool suiting)", "felt", (0.06, 0.06), 0.0002, dict(kind="flannel", pitch=0.0005, col="#e2dfd9", var=0.06, rough=0.93, fuzz=0.8, heather=0.08), True),
    "fabric_fleece":      ("Fleece (sweatshirt)", "felt", (0.05, 0.05), 0.0006, dict(kind="fleece", col="#ecebe6", var=0.05, rough=0.95, fuzz=1.0), True),
    "fabric_melton":      ("Melton wool (coats)", "felt", (0.06, 0.06), 0.00025, dict(kind="melton", col="#e0ddd6", var=0.05, rough=0.94, fuzz=0.6, heather=0.04), True),
    "fabric_tweed":       ("Tweed (flecked twill)", "weave", (0.048, 0.048), 0.0007, dict(weave="twill", over=2, under=2, pitch=0.0008, col="#6b6358", weft="#4e4840", var=0.12, slub=0.5, rough=0.92, fuzz=0.55,
                                                                                             flecks=["#d8cfbf", "#8a4a32", "#3e5068", "#c9a24a", "#202020"]), False),
    "fabric_boucle":      ("Boucle (looped tweed)", "pile", (0.05, 0.05), 0.0012, dict(kind="boucle", col="#e7e2d8", var=0.07, rough=0.93, fuzz=0.5), True),
    "fabric_crepe":       ("Crepe (pebbled, blouses and suiting)", "pile", (0.024, 0.024), 0.00012, dict(kind="crepe", col="#efede7", var=0.02, rough=0.74, fuzz=0.05), True),
    "fabric_corduroy":    ("Corduroy (wide wale)", "pile", (0.036, 0.036), 0.0009, dict(kind="corduroy", wale=0.003, col="#e6e1d6", var=0.05, rough=0.85, fuzz=0.4), True),
    "fabric_velvet":      ("Velvet", "pile", (0.04, 0.04), 0.00015, dict(kind="velvet", col="#ebe7e0", var=0.08, rough=0.62, fuzz=0.6), True),
    "fabric_leather":     ("Leather (grained)", "grain", (0.08, 0.08), 0.0003, dict(kind="leather", cell=0.0012, col="#e6e2dc", var=0.06, rough=0.55), True),
    "fabric_suede":       ("Suede", "grain", (0.05, 0.05), 0.00012, dict(kind="suede", col="#e4dfd6", var=0.08, rough=0.95), True),
    # nets, their holes in the colour's alpha (the user, 2026-11-01: "in blender render a new fishnet type called spider
    # webs, and mesh fabric"): a web a cell, its spokes meeting the next cell's at the edges and corners
    "fabric_spiderweb":   ("Spider web net (gothic)", "net", (0.12, 0.12), 0.0006, dict(kind="spiderweb", cell=0.06, col="#e8e6e2", w=0.009, ring=0.07, rough=0.55), True),
    "fabric_mesh":        ("Sport mesh (open holes)", "net", (0.024, 0.024), 0.0005, dict(kind="mesh", cell=0.003, col="#e6e4de", hole=0.3, var=0.03, rough=0.8, fuzz=0.15), True),
}


# ---- helpers ------------------------------------------------------------------------------------------------------------

def _vary(nb, col, f, amt):
    return nb.cmul(col, nb.madd(f, 2 * amt, 1 - amt))


def _white(nb, x, y=0.0, z=0.0):
    """A random number 0..1 per (x, y, z) (each thread, each stitch its own)."""
    wn = nb.node("ShaderNodeTexWhiteNoise", noise_dimensions="3D")
    nb.put(nb.comb(x, y, z), wn.inputs["Vector"])
    return wn.outputs["Value"]


def _along(nb, t, P, r, scale, detail=2):
    """Noise along a thread (t metres, the period P along it), different on each thread (r its random number): a slub,
    a thickening, a shade change that runs a few centimetres, seamless round the period."""
    a = nb.mul(t, 2 * PI / P)
    rr = P / (2 * PI)
    return nb.noise(nb.comb(nb.mul(r, 37.0), nb.mul(nb.cos(a), rr), nb.mul(nb.sin(a), rr)), scale, detail, 0.5)


def _aniso(T, nb, sx, sy):
    v, w = T
    return nb.vmath("MULTIPLY", v, (sx, sx, sy)), nb.mul(w, sy)


def _fuzz(nb, T, amt):
    """Loose fibres over everything: a fine fuzz in the height and a faint lightening (what catches the light)."""
    f = nb.noise(T, 2600, 3, 0.7)
    return nb.mul(nb.sub(f, 0.5), amt)


def _bump(nb, x):
    """sin(pi x) on 0..1: a thread's or a yarn's round section."""
    return nb.sin(nb.mul(nb.clamp(x), PI))


# ---- the families ---------------------------------------------------------------------------------------------------------

def f_weave(nb, uv, T, P, p):
    """Threads over and under: warp along v (columns), weft along u (rows). Which is on top at each crossing by the
    weave: plain (alternating), basket (in pairs), twill (over n, under m, stepping a thread a row: the diagonal),
    herringbone (the twill's direction turned every `band` threads), satin (long warp floats, five-harness)."""
    u, v, _ = nb.sep(uv)
    pitch = p["pitch"]
    a, b = nb.div(u, pitch), nb.div(v, pitch)
    i, j = nb.floor(a), nb.floor(b)
    fu, fv = nb.fract(a), nb.fract(b)
    w = p["weave"]
    if w == "plain":
        up = nb.one_minus(nb.math("FLOORED_MODULO", nb.add(i, j), 2.0))
    elif w == "basket":
        up = nb.one_minus(nb.math("FLOORED_MODULO", nb.add(nb.floor(nb.div(i, 2.0)), nb.floor(nb.div(j, 2.0))), 2.0))
    elif w in ("twill", "herringbone"):
        n = p.get("over", 2) + p.get("under", 1)
        if w == "herringbone":
            s = nb.math("FLOORED_MODULO", nb.floor(nb.div(i, float(p.get("band", 12)))), 2.0)   # 0 one way, 1 the other
            d = nb.add(i, nb.mul(j, nb.madd(s, 2.0, -1.0)))
        else:
            d = nb.sub(i, j)
        up = nb.math("LESS_THAN", nb.math("FLOORED_MODULO", d, float(n)), float(p.get("over", 2)))
    else:                                                            # satin: the weft shows at one crossing in five, spread out
        up = nb.math("GREATER_THAN", nb.math("FLOORED_MODULO", nb.add(nb.mul(i, 2.0), j), 5.0), 0.5)
    ri, rj = _white(nb, i, 1.0), _white(nb, j, 2.0)                  # each warp thread, each weft thread its own
    sl = p.get("slub", 0.0)
    thick_w = nb.madd(_along(nb, v, P[1], ri, 30.0), sl * 1.2, 1.0 - sl * 0.6) if sl else 1.0   # slubs: a thread thicker here, thinner there
    thick_f = nb.madd(_along(nb, u, P[0], rj, 30.0), sl * 1.2, 1.0 - sl * 0.6) if sl else 1.0
    warp = nb.mul(nb.pow(_bump(nb, nb.madd(nb.sub(fu, 0.5), nb.div(1.0, thick_w) if sl else 1.0, 0.5)), 0.7), nb.madd(_bump(nb, fv), 0.35, 0.65))
    weft = nb.mul(nb.pow(_bump(nb, nb.madd(nb.sub(fv, 0.5), nb.div(1.0, thick_f) if sl else 1.0, 0.5)), 0.7), nb.madd(_bump(nb, fu), 0.35, 0.65))
    h = nb.mixf(up, nb.mul(weft, 0.8), warp)                         # the one on top higher
    wc = srgb(p["col"])
    fc = srgb(p.get("weft", p["col"]))
    wcol = _vary(nb, wc, ri, p.get("var", 0.04))
    fcol = _vary(nb, fc, rj, p.get("var", 0.04))
    if p.get("heather"):                                             # a heathered yarn: the shade changes along it
        wcol = _vary(nb, wcol, _along(nb, v, P[1], ri, 60.0), p["heather"])
        fcol = _vary(nb, fcol, _along(nb, u, P[0], rj, 60.0), p["heather"])
    col = nb.mix(up, fcol, wcol)
    if p.get("streaks"):                                             # denim: lighter and darker streaks down the warp (ring-spun yarn)
        col = _vary(nb, col, nb.noise(_aniso(T, nb, 1.0, 0.08), 260, 3, 0.6), p["streaks"])
    if p.get("flecks"):                                              # tweed: coloured fibres caught in the yarn
        fl = nb.voronoi(T, 900, "F1", out="Color")
        fd = nb.one_minus(nb.ramp(nb.voronoi(T, 900, "F1"), 0.05, 0.22))
        pick = nb.ramp(_white(nb, nb.sepc(fl)[0], 5.0), 0.0, 1.0)
        cs = p["flecks"]
        fcl = srgb(cs[0])
        for k, cc in enumerate(cs[1:], 1):
            fcl = nb.mix(nb.math("GREATER_THAN", pick, k / len(cs)), fcl, srgb(cc))
        col = nb.mix(nb.mul(fd, nb.math("GREATER_THAN", nb.sepc(fl)[1], 0.55)), col, fcl)
    col = nb.cmul(col, nb.madd(h, 0.28, 0.72))                       # the gaps between the threads in shadow
    fz = p.get("fuzz", 0.2)
    h = nb.add(h, _fuzz(nb, T, 0.3 * fz))
    rough = nb.madd(nb.one_minus(h), 0.08, p.get("rough", 0.85))
    return col, rough, h, 0.0, 1.0


def f_knit(nb, uv, T, P, p):
    """Stitches: each a V of two yarn legs in its column, the columns side by side, the rows stacked (jersey); rib's
    columns in pairs, knit raised and purl sunk; a waffle's square cells."""
    u, v, _ = nb.sep(uv)
    a, b = nb.div(u, p["w"]), nb.div(v, p["h"])
    i, j = nb.floor(a), nb.floor(b)
    fx, fy = nb.fract(a), nb.fract(b)
    r = _white(nb, i, j, 3.0)
    st = p["stitch"]
    if st == "waffle":
        e = nb.mn(nb.mn(fx, nb.one_minus(fx)), nb.mn(fy, nb.one_minus(fy)))
        h = nb.one_minus(nb.ramp(e, 0.0, 0.35))                      # the cell's walls up, its floor down
        h = nb.add(h, nb.mul(_bump(nb, fx), nb.mul(_bump(nb, fy), 0.15)))
    else:
        leg = nb.absf(nb.sub(nb.mul(nb.absf(nb.sub(fx, 0.5)), 2.0), nb.one_minus(fy)))   # 0 on the V's legs
        h = nb.mul(nb.one_minus(nb.ramp(leg, 0.0, 0.5)), nb.madd(_bump(nb, fy), 0.3, 0.7))
        if st == "rib":                                              # two columns knit, two purl (sunk, flatter)
            purl = nb.math("GREATER_THAN", nb.math("FLOORED_MODULO", i, 4.0), 1.5)
            h = nb.mixf(purl, h, nb.add(nb.mul(h, 0.35), nb.mul(_bump(nb, fy), 0.1)))
    col = _vary(nb, srgb(p["col"]), r, p.get("var", 0.03))
    if p.get("heather"):
        col = _vary(nb, col, nb.noise(T, 400, 2, 0.5), p["heather"])
    col = nb.cmul(col, nb.madd(h, 0.3, 0.7))
    h = nb.add(h, _fuzz(nb, T, 0.3 * p.get("fuzz", 0.3)))
    rough = nb.madd(nb.one_minus(h), 0.06, p.get("rough", 0.88))
    return col, rough, h, 0.0, 1.0


def f_felt(nb, uv, T, P, p):
    """Fibres matted or brushed, the weave under them faint or gone: flannel (a twill under its fuzz), fleece (a deep
    soft pile in tufts), melton (dense and smooth)."""
    k = p["kind"]
    fib = nb.noise(_aniso(T, nb, 1.0, 1.6), 900, 6, 0.7, distort=0.6)          # fibres, a little longer up and down
    tuft = nb.noise(T, 220, 4, 0.6, distort=0.4)
    h = nb.add(nb.mul(fib, 0.5), nb.mul(tuft, {"fleece": 0.8, "melton": 0.25}.get(k, 0.4)))
    if k == "flannel":                                               # the twill beneath, barely there
        u, v, _ = nb.sep(uv)
        d = nb.sub(nb.floor(nb.div(u, p["pitch"])), nb.floor(nb.div(v, p["pitch"])))
        tw = nb.math("LESS_THAN", nb.math("FLOORED_MODULO", d, 4.0), 2.0)
        h = nb.add(h, nb.mul(tw, 0.12))
    col = _vary(nb, srgb(p["col"]), nb.noise(T, 60, 3, 0.55), p.get("var", 0.05))
    if p.get("heather"):
        col = _vary(nb, col, nb.noise(T, 700, 2, 0.5), p["heather"])
    col = nb.cmul(col, nb.madd(h, 0.2, 0.85))
    rough = nb.madd(fib, 0.05, p.get("rough", 0.93))
    return col, rough, h, 0.0, 1.0


def f_grain(nb, uv, T, P, p):
    """A hide: leather's grain (cells with creases between, pores in them, a polish that's worn off the high parts);
    suede's nap (short fibres, brushed one way, lighter and darker where it lies differently)."""
    if p["kind"] == "leather":
        n = 1.0 / p["cell"]
        edge = nb.voronoi(_aniso(T, nb, 1.0, 1.3), n, "DISTANCE_TO_EDGE", rand=0.85)   # cells about `cell` across: a fine pebble
        crease = nb.one_minus(nb.ramp(edge, 0.0, 0.08))
        pores = nb.one_minus(nb.ramp(nb.voronoi(T, n * 5, "F1"), 0.0, 0.15))
        h = nb.sub(nb.sub(1.0, nb.mul(crease, 0.5)), nb.mul(pores, 0.15))
        h = nb.add(h, nb.mul(nb.noise(T, 40, 3, 0.5), 0.3))           # the hide's own slow waves
        col = _vary(nb, srgb(p["col"]), nb.noise(T, 25, 3, 0.6), p.get("var", 0.06))
        col = nb.cmul(col, nb.madd(crease, -0.12, 1.0))
        rough = nb.madd(crease, 0.25, p.get("rough", 0.55))           # the creases dull, the tops polished
    else:
        nap = nb.noise(_aniso(T, nb, 1.0, 2.5), 1500, 5, 0.75, distort=0.3)
        lie = nb.noise(T, 30, 3, 0.55)                                # where it's been brushed the other way
        h = nb.add(nb.mul(nap, 0.6), nb.mul(lie, 0.3))
        col = _vary(nb, srgb(p["col"]), lie, p.get("var", 0.08))
        col = _vary(nb, col, nap, 0.04)
        rough = p.get("rough", 0.95)
    return col, rough, h, 0.0, 1.0


def f_pile(nb, uv, T, P, p):
    """Corduroy (wales of cut pile in ribs down the cloth), velvet (a smooth pile, its shade by how it lies), crepe (a
    pebbled grain from twisted yarns), boucle (looped yarns: little rings, knotted and tufted)."""
    k = p["kind"]
    u, v, _ = nb.sep(uv)
    if k == "corduroy":
        f = nb.fract(nb.div(u, p["wale"]))
        rib = nb.pow(_bump(nb, nb.madd(nb.sub(f, 0.5), 1.15, 0.5)), 0.6)
        pile = nb.noise(_aniso(T, nb, 1.0, 3.0), 1800, 4, 0.7)
        h = nb.add(rib, nb.mul(pile, 0.25))
        col = _vary(nb, srgb(p["col"]), _white(nb, nb.floor(nb.div(u, p["wale"])), 4.0), 0.03)
        col = nb.cmul(col, nb.madd(rib, 0.4, 0.6))                    # the furrows dark
        rough = nb.madd(rib, -0.12, p.get("rough", 0.85))
    elif k == "velvet":
        lie = nb.noise(T, 18, 4, 0.6, distort=0.5)
        pile = nb.noise(T, 2400, 3, 0.6)
        h = nb.add(nb.mul(lie, 0.6), nb.mul(pile, 0.2))
        col = _vary(nb, srgb(p["col"]), lie, p.get("var", 0.08))      # the shade by how the pile lies
        rough = nb.madd(lie, 0.2, p.get("rough", 0.62) - 0.1)
    elif k == "crepe":
        peb = nb.ramp(nb.noise(T, 1600, 2, 0.5), 0.42, 0.68)          # (noise, not cells: on the 4D wrap a cell pattern comes out sparse)
        h = nb.add(nb.mul(peb, 0.8), nb.mul(nb.noise(T, 3000, 2, 0.5), 0.2))
        col = _vary(nb, srgb(p["col"]), peb, p.get("var", 0.02))
        rough = nb.madd(peb, -0.06, p.get("rough", 0.74))
    else:                                                            # boucle: curly looped yarn (the thin lines where a noise crosses its middle wind like loops), tufts
        n1, n2 = nb.noise(T, 380, 3, 0.55), nb.noise(T, 520, 3, 0.55, w=None)
        loops = nb.mx(nb.one_minus(nb.ramp(nb.absf(nb.sub(n1, 0.5)), 0.0, 0.07)), nb.mul(nb.one_minus(nb.ramp(nb.absf(nb.sub(nb.noise(_aniso(T, nb, 1.3, 1.0), 520, 3, 0.55), 0.5)), 0.0, 0.06)), 0.8))
        tuft = nb.noise(T, 160, 4, 0.6, distort=0.5)
        h = nb.add(nb.mul(loops, 0.75), nb.mul(tuft, 0.45))
        col = _vary(nb, srgb(p["col"]), nb.noise(T, 90, 2, 0.5), p.get("var", 0.07))
        col = _vary(nb, col, n1, 0.05)
        col = nb.cmul(col, nb.madd(h, 0.35, 0.65))
        rough = p.get("rough", 0.93)
    h = nb.add(h, _fuzz(nb, T, 0.3 * p.get("fuzz", 0.3)))
    return col, rough, h, 0.0, 1.0


def f_net(nb, uv, T, P, p):
    """A net, its holes see-through (alpha 0): a spider web a cell (spokes from its hub to the cell's edges and corners,
    so the next cell's meet them; rings round the hub, sagging between the spokes, faded out before the edge), or sport
    mesh (round holes in staggered rows, a knit's yarn round them)."""
    u, v, _ = nb.sep(uv)
    a, b = nb.div(u, p["cell"]), nb.div(v, p["cell"])
    if p["kind"] == "mesh":
        j = nb.floor(b)
        a = nb.add(a, nb.mul(nb.math("FLOORED_MODULO", j, 2.0), 0.5))  # every other row half a hole over
        fx, fy = nb.sub(nb.fract(a), 0.5), nb.sub(nb.fract(b), 0.5)
        d = nb.math("SQRT", nb.add(nb.mul(fx, fx), nb.mul(nb.mul(fy, fy), 1.25)))
        hole = p.get("hole", 0.3)
        alpha = nb.ramp(d, hole - 0.03, hole + 0.02)
        h = nb.mul(alpha, nb.ramp(d, hole, 0.5))
        r = _white(nb, nb.floor(a), j, 5.0)
        col = _vary(nb, srgb(p["col"]), r, p.get("var", 0.03))
        col = nb.cmul(col, nb.madd(h, 0.25, 0.75))
        h = nb.add(h, _fuzz(nb, T, 0.3 * p.get("fuzz", 0.2)))
        return col, nb.madd(nb.one_minus(h), 0.05, p.get("rough", 0.8)), h, 0.0, alpha
    fx, fy = nb.sub(nb.fract(a), 0.5), nb.sub(nb.fract(b), 0.5)
    rho = nb.math("SQRT", nb.add(nb.mul(fx, fx), nb.mul(fy, fy)))
    th = nb.math("ARCTAN2", fy, fx)
    q = nb.sub(nb.fract(nb.add(nb.div(th, math.pi / 4), 0.5)), 0.5)  # -0.5..0.5 from the nearest spoke (eight)
    dq = nb.mul(q, math.pi / 4)
    spoke = nb.mul(rho, nb.absf(nb.sin(dq)))                          # how far from that spoke
    rr = nb.mul(nb.mul(rho, nb.cos(dq)), nb.madd(nb.mul(q, q), 0.35, 1.0))   # the rings' measure, sagging between spokes
    ring = nb.mul(nb.absf(nb.sub(nb.fract(nb.add(nb.div(rr, p["ring"]), 0.5)), 0.5)), p["ring"])
    w = p["w"]
    lines = nb.mx(nb.one_minus(nb.ramp(spoke, w * 0.35, w * 0.6)),
                  nb.mul(nb.mul(nb.ramp(rr, 0.04, 0.07), nb.one_minus(nb.ramp(rr, 0.39, 0.44))), nb.one_minus(nb.ramp(ring, w * 0.25, w * 0.45))))
    lines = nb.mx(lines, nb.one_minus(nb.ramp(rho, 0.02, 0.03)))    # the hub
    col = nb.cmul(srgb(p["col"]), nb.madd(lines, 0.15, 0.85))
    return col, p.get("rough", 0.55), lines, 0.0, lines


FAMILY = {"weave": f_weave, "knit": f_knit, "felt": f_felt, "grain": f_grain, "pile": f_pile, "net": f_net}


def register(F, relief):
    """The fabrics among the finishes (so tiles.py bakes them as it bakes any), with their relief."""
    for name, (label, fam, P, rel, p, tint) in LIB.items():
        F.BUILD[name] = (lambda fam_, prm: (lambda nb, uv, T, Pp: FAMILY[fam_](nb, uv, T, Pp, prm)))(fam, p)
        F.PERIOD[name] = P
        F.WEAR.setdefault(name, next(iter(F.WEAR.values())))
        relief[name] = rel


def meta(name):
    label, fam, P, rel, p, tint = LIB[name]
    return {"label": label, "group": "fabric", "family": fam, "tile_m": P[0], "tile_v_m": P[1], "relief_m": rel, "tint": tint}
