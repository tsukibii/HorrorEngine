"""The street's material library (docs/STREET_PAINT.md): Japanese exterior finishes after the reference photos, each a
procedural node group read in metres, like the finishes (finishes.py), but in its own colours: sprayed mortar, 45 x 95
facade tiles, ceramic siding, ALC panels, exposed concrete, block walls, galvanised and painted metal, shutters, kawara,
slate and standing-seam roofs, asphalt new and old, the green lanes, pavers, tactile paving, kerbs, glass...

Every one is baked once into a tileable set on the PBR shelf (assets/pbr/Procedural/<name>/, tiles.py): its colour, its
normal (the relief faked from its height: joints, grains, ribs, waves), its roughness and an ORM map, at its real size,
plus a picture of it lit for the paint page. A street wears one on any surface as `pbr/Procedural/<name>` in a piece's
or the street's `look` (the paint page, tools/streetpaint): the set's colour is the surface's (not a tint).

Each entry: label, group (walls, tiles, siding, concrete, metal, roofs, roads, pavements, other), the family that builds
it with its numbers, the period its pattern and noise repeat in (whole tiles, boards, ribs), the relief (metres of
depth the height stands for), and the wear it takes (finishes.WEAR)."""
import math

from . import finishes as F
from .nodes import srgb, TAU


# ---- helpers ----------------------------------------------------------------------------------------------------------

def cramp(nb, f, stops, interp="LINEAR"):
    """A colour ramp: f through [(position, '#hex')...]."""
    n = nb.node("ShaderNodeValToRGB")
    r = n.color_ramp
    r.interpolation = interp
    els = r.elements
    els[0].position, els[0].color = stops[0][0], srgb(stops[0][1])
    els[1].position, els[1].color = stops[-1][0], srgb(stops[-1][1])
    for pos, hx in stops[1:-1]:
        els.new(pos).color = srgb(hx)
    nb.put(f, n.inputs["Fac"])
    return n.outputs["Color"]


def pal(nb, f, hexes):
    """One of the colours by f (0..1), each with an equal share."""
    if len(hexes) == 1:
        return srgb(hexes[0])
    return cramp(nb, f, [(i / len(hexes), h) for i, h in enumerate(hexes)], "CONSTANT")


def vary(nb, col, f, amt):
    """col's value moved by up to +-amt as f goes 0..1."""
    return nb.cmul(col, nb.madd(f, 2 * amt, 1 - amt))


def aniso(T, nb, sx, sy):
    """The torus stretched: sx across u, sy across v (noise long one way: grain, brushing), still seamless."""
    v, w = T
    return nb.vmath("MULTIPLY", v, (sx, sx, sy)), nb.mul(w, sy)


def rnd2(nb, r, k=7.31, o=0.17):
    """A second random number from one (per tile, per board)."""
    return nb.fract(nb.madd(r, k, o))


def nz(nb, T, scale, detail=4, rough=0.6):
    """Noise stretched to fill 0..1: Blender's sits close to 0.5, so a +-5% read from it moves a colour about 1%,
    where a real wall's tone varies several percent from metre to metre (what survives the tape: research/photoreal.md)."""
    return nb.ramp(nb.noise(T, scale, detail, rough), 0.3, 0.7)


def mottle(nb, col, T, scale, amt, detail=4):
    """col's value varied by up to +-amt in blotches about 1/scale metres across."""
    return vary(nb, col, nz(nb, T, scale, detail), amt)


def macro(nb, T, amt, scale=0.7):
    """A slow tone over the set (its larger blotches; the street's wear atlas does the largest)."""
    return nb.madd(nz(nb, T, scale, 3, 0.55), 2 * amt, 1 - amt)


# ---- the families -------------------------------------------------------------------------------------------------------

def m_stucco(nb, uv, T, P, p):
    """Sprayed mortar, stucco, plaster: grains (sprayed sand or blobs), their shading, a slow tone."""
    g = p.get("grain", 260)
    f1 = nb.voronoi(T, g, "F1", "EUCLIDEAN", 1.0)
    grains = nb.one_minus(nb.ramp(f1, 0.0, p.get("grain_size", 0.55)))
    fine = nb.noise(T, g * 2.3, 2, 0.5)
    lump = nb.noise(T, p.get("lumps", g / 9), 3, 0.6)
    h = nb.add(nb.add(nb.mul(grains, p.get("grain_h", 0.55)), nb.mul(fine, 0.2)), nb.mul(lump, p.get("lump_h", 0.35)))
    trowel = p.get("trowel", 0.0)
    if trowel:                                                       # trowel marks: soft arcs smoothing it down
        tw = nb.noise(aniso(T, nb, 1.0, 3.5), 2.2, 2, 0.4)
        h = nb.mixf(nb.mul(nb.ramp(tw, 0.45, 0.65), trowel), h, nb.mul(lump, 0.3))
    col = mottle(nb, srgb(p["col"]), T, 0.6, p.get("var", 0.06), 3)
    col = mottle(nb, col, T, 2.5, p.get("var2", 0.035), 4)
    h = nb.add(h, nb.mul(nb.noise(T, 0.9, 2, 0.5), p.get("wave", 0.3)))       # a rendered wall isn't flat: it shows in a raking light
    col = nb.cmul(col, nb.madd(h, p.get("cavity", 0.10), 1 - p.get("cavity", 0.10)))      # the grains' shadows, baked a little
    rough = nb.add(nb.madd(nb.one_minus(h), p.get("rough_var", 0.08), p.get("rough", 0.86) - 0.04), nb.mul(nz(nb, T, 1.5), 0.08))
    return col, rough, h, 0.0, 1.0


def m_tiles(nb, uv, T, P, p):
    """Tiles in a bond: each its own shade of the palette, its face's texture, a bevel, grout lower in the joints."""
    w, hh, j = p["w"], p["h"], p["joint"]
    m, r, (fx, fy), d = F.bricks(nb, uv, w, hh, j, offset=p.get("offset", 0.5), soft=0.0005, period=P)
    r2 = rnd2(nb, r)
    face = vary(nb, pal(nb, r, p["cols"]), r2, p.get("var", 0.04))
    tex = p.get("face", "smooth")
    if tex == "scratch":                                             # 二丁掛's raked face: fine lines along the tile
        s = nb.noise(nb.comb(nb.add(nb.mul(fx, 3.0), nb.mul(r, 17.0)), nb.mul(fy, 260.0), nb.mul(r2, 9.0)), 1.0, 2, 0.5)
        face_h = nb.add(nb.mul(s, 0.35), 0.55)
        face = vary(nb, face, s, 0.05)
    elif tex == "rustic":                                            # a rough fired face
        s = nb.noise(T, 150, 4, 0.65)
        face_h = nb.add(nb.mul(s, 0.4), 0.5)
        face = vary(nb, face, s, 0.07)
    else:                                                            # a glazed or smooth face, slightly cushioned
        cx, cy = nb.sub(nb.div(fx, w), 0.5), nb.sub(nb.div(fy, hh), 0.5)
        cush = nb.one_minus(nb.mul(nb.add(nb.mul(cx, cx), nb.mul(cy, cy)), 1.6))
        s = nb.noise(T, 90, 2, 0.5)
        face_h = nb.add(nb.mul(cush, 0.18), nb.add(0.72, nb.mul(s, 0.06)))
        face = vary(nb, face, s, 0.015)
    bev = nb.ramp(d, j / 2, j / 2 + p.get("bevel", 0.0015))
    tilt = nb.mul(nb.sub(r2, 0.5), p.get("tilt", 0.08))              # no two tiles quite in one plane
    h = nb.mul(bev, nb.add(face_h, tilt))
    grout = vary(nb, srgb(p.get("grout", "#8f8a82")), nb.noise(T, 40, 2, 0.5), 0.06)
    col = nb.mix(m, face, grout)
    col = nb.cmul(col, macro(nb, T, p.get("tone", 0.03)))
    rough = nb.mixf(m, nb.madd(nb.noise(T, 60, 2, 0.5), 0.08, p.get("rough", 0.3)), p.get("grout_rough", 0.9))
    return col, rough, h, 0.0, 1.0


def m_boards(nb, uv, T, P, p):
    """Boards (lap siding, weathered planks, charred cedar), or ceramic siding's moulded panels: rows of boards, each
    its own shade, their ends staggered, a lap's shadow line, grain along them."""
    u, v, _ = nb.sep(uv)
    if p.get("vertical"):
        u, v = v, u
    bh = p["board"]
    k = nb.div(v, bh)
    row = nb.math("FLOORED_MODULO", nb.floor(k), max(1, round((P[0] if p.get("vertical") else P[1]) / bh)))
    f = nb.fract(k)
    wn = nb.node("ShaderNodeTexWhiteNoise", noise_dimensions="3D")
    nb.put(nb.comb(row, 0.0, 0.0), wn.inputs["Vector"])
    r = wn.outputs["Value"]
    L = p.get("length", 3.0)                                         # each board's length: its ends staggered by row
    ue = nb.div(nb.add(u, nb.mul(r, L)), L)
    endd = nb.mul(nb.mn(nb.fract(ue), nb.one_minus(nb.fract(ue))), L)
    ends = nb.one_minus(nb.ramp(endd, 0.0, 0.003))
    lap = p.get("lap", 0.5)                                          # 0: flat boards butted, 1: a deep lap
    prof = nb.mul(nb.ramp(f, 0.0, 0.02), nb.madd(nb.one_minus(f), lap * 0.5, 1 - lap * 0.5))
    gr = nb.noise(aniso(T, nb, 0.6, 9.0) if not p.get("vertical") else aniso(T, nb, 9.0, 0.6), p.get("grain", 3.0), 5, 0.7, distort=0.6)
    h = nb.mul(nb.mul(prof, nb.one_minus(nb.mul(ends, 0.8))), nb.madd(gr, p.get("grain_h", 0.2), 1 - p.get("grain_h", 0.2)))
    col = vary(nb, pal(nb, r, p["cols"]), rnd2(nb, r), p.get("var", 0.05))
    col = vary(nb, col, gr, p.get("grain_var", 0.06))
    if p.get("char"):                                                # yakisugi: the char's alligator cracks
        cr = nb.voronoi(aniso(T, nb, 0.5, 2.0), 22, "DISTANCE_TO_EDGE")
        crack = nb.one_minus(nb.ramp(cr, 0.0, 0.05))
        h = nb.sub(h, nb.mul(crack, 0.35))
        col = nb.mix(nb.mul(crack, 0.6), col, srgb("#0b0a09"))
    col = nb.mix(nb.mul(nb.one_minus(nb.ramp(f, 0.0, 0.03)), p.get("gap_dark", 0.5)), col, srgb("#1a1714"))
    rough = nb.madd(gr, p.get("rough_var", 0.08), p.get("rough", 0.75))
    return col, rough, h, 0.0, 1.0


def m_panels(nb, uv, T, P, p):
    """Ceramic siding with a moulded pattern (bricks or stones) in panels, ALC panels: a panel grid with its sealed joints,
    the panel's own pattern pressed in, a painted sandy face."""
    pw, ph = p["panel"]
    m, r, (fx, fy), d = F.bricks(nb, uv, pw, ph, p.get("joint", 0.01), offset=p.get("offset", 0.0), soft=0.0008, period=P)
    sand = nb.noise(T, 320, 2, 0.5)
    h = nb.add(0.75, nb.mul(sand, 0.08))
    col = vary(nb, srgb(p["col"]), sand, 0.03)
    col = vary(nb, col, rnd2(nb, r, 5.3), p.get("panel_var", 0.035))         # no two panels painted quite alike
    col = mottle(nb, col, T, 0.8, p.get("var", 0.04), 3)
    pat = p.get("pattern")
    if pat == "bricks":                                              # moulded bricks: their own bond inside the panel
        bm, br, _, bd = F.bricks(nb, uv, 0.227, 0.0682, 0.008, offset=0.5, soft=0.0008, period=P)
        bb = nb.ramp(bd, 0.004, 0.008)
        h = nb.add(nb.mul(bb, nb.add(0.18, nb.mul(rnd2(nb, br), 0.05))), nb.mul(h, 0.85))
        col = nb.mix(bm, vary(nb, pal(nb, br, p["cols"]), rnd2(nb, br, 3.7), 0.06), srgb(p.get("mortar", "#9b968e")))
    elif pat == "stone":                                             # a stone pattern: irregular blocks
        e = nb.voronoi(aniso(T, nb, 1.0, 1.9), 6.5, "DISTANCE_TO_EDGE")
        cell = nb.voronoi(aniso(T, nb, 1.0, 1.9), 6.5, "F1", out="Color")
        cr = nb.sepc(cell)[0]
        sb = nb.ramp(e, 0.004, 0.02)
        rough_face = nb.noise(T, 60, 4, 0.65)
        h = nb.add(nb.mul(sb, nb.add(0.2, nb.mul(rough_face, 0.25))), nb.mul(h, 0.6))
        col = nb.mix(nb.one_minus(sb), vary(nb, pal(nb, cr, p["cols"]), rough_face, 0.08), srgb(p.get("mortar", "#8c877e")))
    bev = nb.ramp(d, p.get("joint", 0.01) / 2, p.get("joint", 0.01) / 2 + 0.003)
    h = nb.mul(h, bev)
    col = nb.mix(m, col, srgb(p.get("seal", "#8f8b85")))
    col = nb.cmul(col, macro(nb, T, p.get("tone", 0.03)))
    rough = nb.madd(sand, 0.06, p.get("rough", 0.8))
    return col, rough, h, 0.0, 1.0


def m_metal(nb, uv, T, P, p):
    """Sheet metal: corrugated, standing seams, spandrel grooves, a shutter's slats, or flat; galvanised (its spangle),
    painted (orange peel, chips to the steel) or anodised (brushed); rust where it's old."""
    u, v, _ = nb.sep(uv)
    x = u if p.get("ribs_along", "v") == "v" else v                  # ribs running up: the profile goes across u
    pitch = p.get("pitch", 0.076)
    f = nb.fract(nb.div(x, pitch))
    prof = p.get("profile", "flat")
    if prof == "sine":
        h = nb.madd(nb.sin(nb.mul(f, TAU)), 0.5, 0.5)
    elif prof == "seam":                                             # a narrow standing seam, the pan between a little wavy
        seam = nb.one_minus(nb.ramp(nb.mn(f, nb.one_minus(f)), 0.0, 0.025))
        can = nb.noise(aniso(T, nb, 2.0, 0.4), 1.5, 2, 0.5)
        h = nb.add(nb.mul(seam, 0.9), nb.mul(can, 0.08))
    elif prof == "groove":                                           # spandrel: a V groove each pitch
        h = nb.ramp(nb.mn(f, nb.one_minus(f)), 0.0, 0.08)
    elif prof == "slats":                                            # a rolling shutter's curved slats, a gap between
        h = nb.mul(nb.sin(nb.mul(f, math.pi)), nb.ramp(f, 0.0, 0.04))
    else:
        h = nb.mul(nb.noise(T, 3, 2, 0.4), 0.15)
    fin = p.get("finish", "galv")
    if fin == "galv":                                                # zinc spangle: crystals each their own grey
        sp = nb.sepc(nb.voronoi(T, p.get("spangle", 45), "F1", out="Color"))[0]
        col = vary(nb, srgb(p["col"]), sp, 0.07)
        col = mottle(nb, col, T, 1.2, 0.08, 3)
        metal = p.get("metal", 0.85)
        rough = nb.madd(sp, 0.12, p.get("rough", 0.38))
    elif fin == "anodised":
        br = nb.noise(aniso(T, nb, 30.0, 0.05) if p.get("ribs_along", "v") == "v" else aniso(T, nb, 0.05, 30.0), 6, 2, 0.5)   # brushed along its length
        col = vary(nb, srgb(p["col"]), br, 0.03)
        metal = 1.0
        rough = nb.madd(br, 0.1, p.get("rough", 0.3))
    else:                                                            # painted: orange peel, chips showing grey primer or steel
        peel = nb.noise(T, 180, 2, 0.5)
        col = mottle(nb, srgb(p["col"]), T, 1.0, p.get("var", 0.05), 3)
        roller = nz(nb, aniso(T, nb, 0.08, 3.0) if p.get("ribs_along", "v") == "v" else aniso(T, nb, 3.0, 0.08), 2.0, 2)
        col = vary(nb, col, roller, 0.02)                                     # the brush or roller's strokes
        h = nb.add(h, nb.mul(nb.noise(T, 0.7, 2, 0.4), 0.12))                 # a sheet is never flat
        chip = nb.ramp(nb.noise(T, 9, 5, 0.75), p.get("chips", 0.8), p.get("chips", 0.8) + 0.02)
        col = nb.mix(chip, col, srgb("#6b6a66"))
        h = nb.add(h, nb.sub(nb.mul(peel, 0.04), nb.mul(chip, 0.06)))
        metal = nb.mul(chip, 0.6)
        rough = nb.madd(peel, 0.06, p.get("rough", 0.42))
    rust = p.get("rust", 0.0)
    if rust:                                                         # rust in blooms
        rm = nb.ramp(nb.noise(T, 3.5, 5, 0.7), 0.72 - rust * 0.25, 0.80 - rust * 0.25)
        rc = vary(nb, srgb("#6e3b1f"), nb.noise(T, 40, 3, 0.6), 0.25)
        col = nb.mix(rm, col, rc)
        rough = nb.mixf(rm, rough, 0.9)
        metal = nb.mixf(rm, metal, 0.0)
        h = nb.add(h, nb.mul(rm, nb.mul(nb.noise(T, 90, 3, 0.6), 0.08)))
    return col, rough, h, metal, 1.0


def m_concrete(nb, uv, T, P, p):
    """Concrete: exposed (form panels, their seams and P-cone holes, pour lines, pores), precast panels (an aggregate),
    block walls (390 x 190 with their joints), polished stone (a speckle under a gloss)."""
    kind = p.get("kind", "exposed")
    tone = nb.noise(T, 0.9, 4, 0.6)
    blot = nb.noise(T, 4.0, 4, 0.6)
    pores = nb.one_minus(nb.ramp(nb.voronoi(T, p.get("pores", 140), "F1"), 0.0, 0.12))
    col = mottle(nb, srgb(p["col"]), T, 0.9, p.get("var", 0.08), 4)
    col = mottle(nb, col, T, 4.0, 0.05, 4)
    h = nb.sub(0.8, nb.mul(pores, 0.25))
    col = nb.cmul(col, nb.one_minus(nb.mul(pores, 0.25)))
    rough = nb.madd(blot, 0.1, p.get("rough", 0.72))
    if kind == "exposed":                                            # 900 x 1800 forms: their seams, their P-cones
        m, r, (fx, fy), d = F.bricks(nb, uv, 0.9, 1.8, 0.004, offset=0.0, soft=0.0008, period=P)
        col = vary(nb, col, r, p.get("form_var", 0.07))                      # each pour and form its own grey
        h = nb.sub(h, nb.mul(m, 0.3))
        # P-cone holes on a 450 x 600 grid inside each form
        cx = nb.sub(nb.fract(nb.div(nb.add(fx, 0.225), 0.45)), 0.5)
        cy = nb.sub(nb.fract(nb.div(nb.add(fy, 0.3), 0.6)), 0.5)
        rr = nb.add(nb.mul(nb.mul(cx, 0.45), nb.mul(cx, 0.45)), nb.mul(nb.mul(cy, 0.6), nb.mul(cy, 0.6)))
        hole = nb.one_minus(nb.ramp(rr, 0.00016, 0.00024))
        ring = nb.mul(nb.one_minus(nb.ramp(rr, 0.00024, 0.0004)), nb.one_minus(hole))
        col = nb.mix(nb.mul(hole, 0.55), col, srgb("#4a4843"))
        col = vary(nb, col, nb.one_minus(ring), 0.02)
        h = nb.sub(h, nb.mul(hole, 0.6))
        pour = nz(nb, aniso(T, nb, 0.15, 3.0), 2.5, 3)                     # pour lines across
        col = vary(nb, col, pour, 0.05)
    elif kind == "precast":
        m, r, (fx, fy), d = F.bricks(nb, uv, p.get("pw", 1.8), p.get("ph", 3.6), 0.012, offset=0.0, soft=0.001, period=P)
        agg = nb.sepc(nb.voronoi(T, 260, "F1", out="Color"))[0]
        aggm = nb.ramp(nb.voronoi(T, 260, "F1"), 0.0, 0.25)
        col = nb.mix(nb.mul(nb.one_minus(aggm), 0.35), col, vary(nb, srgb(p.get("agg", "#8a817a")), agg, 0.2))
        col = nb.mix(m, col, srgb("#7d7973"))
        h = nb.sub(h, nb.mul(m, 0.4))
    elif kind == "blocks":
        m, r, (fx, fy), d = F.bricks(nb, uv, 0.4, 0.2, 0.01, offset=0.5, soft=0.001, period=P)
        col = vary(nb, col, r, 0.05)
        bev = nb.ramp(d, 0.005, 0.012)
        h = nb.mul(h, bev)
        col = nb.mix(m, col, vary(nb, srgb("#77736c"), blot, 0.05))
        rough = nb.mixf(m, rough, 0.92)
    elif kind == "stone":                                            # polished granite or terrazzo: a speckle under a gloss
        m, r, (fx, fy), d = F.bricks(nb, uv, p.get("pw", 0.6), p.get("ph", 0.6), 0.003, offset=0.0, soft=0.0005, period=P)
        sp = nb.sepc(nb.voronoi(T, p.get("speck", 180), "F1", out="Color"))[0]
        col = pal(nb, sp, p["specks"])
        col = vary(nb, col, r, 0.04)
        col = nb.mix(m, col, srgb("#3a3836"))
        h = nb.sub(0.8, nb.mul(m, 0.3))
        rough = nb.madd(nb.noise(T, 30, 2, 0.5), 0.06, p.get("rough", 0.12))
    col = nb.cmul(col, macro(nb, T, p.get("tone", 0.04)))
    return col, rough, h, 0.0, 1.0


def m_asphalt(nb, uv, T, P, p):
    """Asphalt: the stones of its aggregate in the binder, worn to them in places, cracks, sealant, patches; or a colour
    coat over it (the green lanes, the red)."""
    cell = nb.voronoi(T, p.get("stones", 110), "F1", out="Color")
    sd = nb.voronoi(T, p.get("stones", 110), "F1")
    stone = nb.one_minus(nb.ramp(sd, 0.18, 0.42))                    # each stone's top
    sv = nb.sepc(cell)[0]
    worn = nb.ramp(nb.noise(T, 1.4, 4, 0.6), 0.45, 0.7)              # where the binder's worn to the stones
    sc = vary(nb, pal(nb, sv, p.get("stone_cols", ["#6d6a65", "#7e7a73", "#5e5b57", "#8a857c"])), rnd2(nb, sv), 0.08)
    base = mottle(nb, srgb(p["col"]), T, 0.7, p.get("var", 0.10), 4)
    base = mottle(nb, base, T, 3.0, 0.05, 3)
    col = nb.mix(nb.mul(stone, nb.madd(worn, 0.55, p.get("expose", 0.25))), base, sc)
    h = nb.add(nb.mul(stone, 0.6), nb.mul(nb.noise(T, 400, 2, 0.5), 0.15))
    rough = nb.mixf(stone, p.get("rough", 0.86), 0.7)
    if p.get("cracks"):                                              # cracks, some sealed with a glossy black
        e = nb.voronoi(T, 0.55, "DISTANCE_TO_EDGE", w=None)
        cm = nb.ramp(nb.noise(T, 0.8, 3, 0.6), 0.5, 0.6)
        crack = nb.mul(nb.one_minus(nb.ramp(e, 0.0, 0.006)), cm)
        seal = nb.mul(nb.one_minus(nb.ramp(e, 0.0, 0.03)), nb.ramp(nb.noise(T, 0.5, 2, 0.5), 0.55, 0.6))
        col = nb.mix(nb.mul(seal, 0.9), col, srgb("#151515"))
        rough = nb.mixf(seal, rough, 0.35)
        col = nb.mix(crack, col, srgb("#0d0d0d"))
        h = nb.sub(h, nb.mul(crack, 0.5))
    if p.get("patches"):                                             # newer, darker patches
        pm = nb.ramp(nb.noise(T, 0.35, 2, 0.4), 0.62, 0.64)
        col = nb.mix(nb.mul(pm, 0.8), col, vary(nb, srgb("#2b2b2c"), nb.noise(T, 3, 3, 0.5), 0.05))
        h = nb.add(h, nb.mul(pm, 0.1))
    coat = p.get("coat")
    if coat:                                                         # a colour coat, worn through on the stones' tops
        cc = mottle(nb, srgb(coat), T, 0.8, 0.10, 4)
        through = nb.mul(stone, nb.ramp(nb.noise(T, 1.1, 4, 0.6), 0.55, 0.8))
        col = nb.mix(nb.mul(nb.one_minus(through), 0.92), col, cc)
        rough = nb.mixf(nb.one_minus(through), rough, 0.8)
    return col, rough, h, 0.0, 1.0


def m_pavers(nb, uv, T, P, p):
    """Pavers and tactile paving: tiles of concrete or resin, chamfered, an exposed aggregate face or dots and bars."""
    w, hh = p["w"], p["h"]
    m, r, (fx, fy), d = F.bricks(nb, uv, w, hh, p.get("joint", 0.004), offset=p.get("offset", 0.0), soft=0.0006, period=P)
    face = vary(nb, pal(nb, r, p["cols"]), rnd2(nb, r), p.get("var", 0.05))
    agg = nb.noise(T, 220, 3, 0.6)
    face = vary(nb, face, agg, p.get("agg", 0.05))
    bev = nb.ramp(d, p.get("joint", 0.004) / 2, p.get("joint", 0.004) / 2 + p.get("chamfer", 0.006))
    h = nb.mul(bev, nb.add(0.7, nb.mul(agg, 0.12)))
    tac = p.get("tactile")
    if tac == "dots":                                                # 5 x 5 truncated domes on a 300 tile
        cx = nb.sub(nb.fract(nb.div(fx, w / 5)), 0.5)
        cy = nb.sub(nb.fract(nb.div(fy, hh / 5)), 0.5)
        rr = nb.add(nb.mul(cx, cx), nb.mul(cy, cy))
        dome = nb.one_minus(nb.ramp(rr, 0.06, 0.11))
        h = nb.add(h, nb.mul(dome, 0.6))
    elif tac == "bars":                                              # 4 bars along the way
        cx = nb.sub(nb.fract(nb.div(fx, w / 4)), 0.5)
        bar = nb.one_minus(nb.ramp(nb.absf(cx), 0.18, 0.26))
        ends = nb.mul(nb.ramp(fy, 0.02, 0.035), nb.ramp(nb.sub(hh, fy), 0.02, 0.035))
        h = nb.add(h, nb.mul(nb.mul(bar, ends), 0.6))
    col = nb.mix(m, face, srgb(p.get("joint_col", "#5f5b55")))
    col = nb.cmul(col, macro(nb, T, p.get("tone", 0.04)))
    rough = nb.mixf(m, nb.madd(agg, 0.08, p.get("rough", 0.78)), 0.92)
    return col, rough, h, 0.0, 1.0


def m_kawara(nb, uv, T, P, p):
    """Roof tiles down the slope (u across, v up it): kawara's waves (J tiles, ibushi silver or glazed), or slate
    (Colorbest: flat shingles in staggered courses, each course's step)."""
    u, v, _ = nb.sep(uv)
    kind = p.get("kind", "kawara")
    if kind == "kawara":
        wcol, course = p.get("width", 0.305), p.get("course", 0.245)
        row = nb.floor(nb.div(v, course))
        fv = nb.fract(nb.div(v, course))
        fu = nb.fract(nb.div(u, wcol))
        wave = nb.madd(nb.cos(nb.mul(fu, TAU)), -0.5, 0.5)           # the tile's trough and roll
        step = nb.mul(nb.one_minus(fv), 0.35)                        # each course over the one below
        lip = nb.one_minus(nb.ramp(fv, 0.0, 0.05))
        h = nb.add(nb.mul(wave, 0.55), nb.sub(step, nb.mul(lip, 0.2)))
        colm = nb.math("FLOORED_MODULO", nb.floor(nb.div(u, wcol)), max(1, round(P[0] / wcol)))
        rowm = nb.math("FLOORED_MODULO", row, max(1, round(P[1] / course)))
        wn = nb.node("ShaderNodeTexWhiteNoise", noise_dimensions="3D")
        nb.put(nb.comb(colm, rowm, 3.0), wn.inputs["Vector"])
        r = wn.outputs["Value"]
        col = vary(nb, pal(nb, r, p["cols"]), rnd2(nb, r), p.get("var", 0.05))
        col = nb.cmul(col, nb.madd(lip, -0.35, 1.0))
        rough = nb.madd(nb.noise(T, 50, 2, 0.5), 0.08, p.get("rough", 0.45))
        metal = p.get("metal", 0.0)
    else:                                                            # slate
        sw, course = p.get("width", 0.455), p.get("course", 0.182)
        m, r, (fx, fy), d = F.bricks(nb, uv, sw, course, 0.004, offset=0.5, soft=0.0005, period=P)
        h = nb.add(nb.mul(nb.div(fy, course), 0.5), nb.mul(nb.noise(T, 200, 3, 0.6), 0.1))
        h = nb.mul(h, nb.ramp(d, 0.002, 0.004))
        col = vary(nb, pal(nb, r, p["cols"]), nb.noise(T, 120, 3, 0.6), p.get("var", 0.06))
        col = nb.cmul(col, nb.madd(nb.div(fy, course), 0.25, 0.75))
        rough = nb.madd(nb.noise(T, 60, 2, 0.5), 0.08, p.get("rough", 0.62))
        metal = 0.0
    col = nb.cmul(col, macro(nb, T, p.get("tone", 0.04)))
    return col, rough, h, metal, 1.0


def m_simple(nb, uv, T, P, p):
    """Earth and gravel, a rooftop's coating, glass: a noise surface of the entry's numbers."""
    kind = p.get("kind")
    col = mottle(nb, srgb(p["col"]), T, 0.8, p.get("var", 0.08), 4)
    if kind == "gravel":
        st = nb.voronoi(T, p.get("stones", 70), "F1", out="Color")
        sd = nb.one_minus(nb.ramp(nb.voronoi(T, p.get("stones", 70), "F1"), 0.15, 0.45))
        col = nb.mix(nb.mul(sd, 0.85), col, vary(nb, pal(nb, nb.sepc(st)[0], p["stone_cols"]), nb.sepc(st)[1], 0.08))
        h = nb.add(nb.mul(sd, 0.7), nb.mul(nb.noise(T, 30, 3, 0.6), 0.2))
        rough = 0.9
    elif kind == "coating":                                          # a rooftop's urethane: sheets' seams, patches
        m, r, _, _ = F.bricks(nb, uv, 1.0, 10.0, 0.03, offset=0.0, soft=0.004, period=P)
        col = nb.mix(nb.mul(m, 0.5), vary(nb, col, r, 0.03), srgb(p.get("seam", "#5e625c")))
        patch = nb.ramp(nb.noise(T, 0.6, 3, 0.5), 0.63, 0.65)
        col = nb.mix(nb.mul(patch, 0.6), col, srgb(p.get("patch", "#73776f")))
        h = nb.add(nb.mul(m, 0.2), nb.mul(nb.noise(T, 120, 2, 0.5), 0.08))
        rough = nb.madd(nb.noise(T, 6, 2, 0.5), 0.15, 0.6)
    else:                                                            # glass: dark, a faint waviness in its reflections
        h = nb.mul(nb.noise(T, 0.8, 2, 0.4), 0.05)
        smudge = nb.ramp(nb.noise(T, 2.2, 4, 0.6), 0.55, 0.75)              # wiped smears and fingerprints, duller
        rough = nb.add(p.get("rough", 0.04), nb.mul(smudge, 0.18))
        col = vary(nb, col, smudge, 0.05)
    return col, rough, h, 0.0, 1.0


FAMILY = {"stucco": m_stucco, "tiles": m_tiles, "boards": m_boards, "panels": m_panels, "metal": m_metal,
          "concrete": m_concrete, "asphalt": m_asphalt, "pavers": m_pavers, "kawara": m_kawara, "simple": m_simple}

# ---- the library: (label, group, family, period, relief in metres, wear, its numbers) ------------------------------------
# colours are the surfaces' albedo (sRGB), kept to what real ones measure: white paint and mortar 0.6-0.75 linear,
# concrete 0.25-0.4, fresh asphalt about 0.05, old about 0.12, kawara 0.08-0.15
LIB = {
    # walls: mortar and plaster
    "jp_mortar_cream":   ("Mortar, sprayed, cream (吹付け)", "walls", "stucco", (3.0, 3.0), 0.0025, "render",
                          dict(col="#d6cdbd", grain=280, var=0.05)),
    "jp_mortar_grey":    ("Mortar, sprayed, grey", "walls", "stucco", (3.0, 3.0), 0.0025, "render",
                          dict(col="#aaa69e", grain=280, var=0.06)),
    "jp_mortar_beige":   ("Mortar, sprayed, beige", "walls", "stucco", (3.0, 3.0), 0.0025, "render",
                          dict(col="#c9b79c", grain=260, var=0.05)),
    "jp_stucco_white":   ("Stucco, white (スタッコ)", "walls", "stucco", (3.0, 3.0), 0.006, "render",
                          dict(col="#e4e0d7", grain=55, grain_size=0.8, grain_h=0.7, lumps=8, lump_h=0.4, var=0.03)),
    "jp_plaster_white":  ("Plaster, white (漆喰)", "walls", "stucco", (3.0, 3.0), 0.0015, "render",
                          dict(col="#ebe8e1", grain=600, grain_h=0.15, lumps=3, lump_h=0.3, trowel=0.7, var=0.025, rough=0.7)),
    "jp_alc":            ("ALC panels, painted", "walls", "panels", (3.0, 2.4), 0.003, "panel",
                          dict(panel=(0.6, 2.4), col="#c4c0b6", joint=0.01, seal="#9e9a92", rough=0.82)),
    # tiles
    "jp_tile45_white":   ("Tiles 45 x 95, white (45二丁掛)", "tiles", "tiles", (2.0, 1.0), 0.0035, "tile",
                          dict(w=0.1, h=0.05, joint=0.005, cols=["#e3dfd6", "#dcd8cf", "#e8e4dc", "#d6d2c9"], grout="#9d9890", rough=0.32)),
    "jp_tile45_beige":   ("Tiles 45 x 95, beige", "tiles", "tiles", (2.0, 1.0), 0.0035, "tile",
                          dict(w=0.1, h=0.05, joint=0.005, cols=["#c9b79d", "#bfac92", "#d1c0a6", "#b8a589"], grout="#8e877c", rough=0.4)),
    "jp_tile45_grey":    ("Tiles 45 x 95, grey", "tiles", "tiles", (2.0, 1.0), 0.0035, "tile",
                          dict(w=0.1, h=0.05, joint=0.005, cols=["#8f8e8a", "#9a9995", "#85847f", "#a3a29d"], grout="#6e6c67", rough=0.35)),
    "jp_tile45_brown":   ("Tiles 45 x 95, brown", "tiles", "tiles", (2.0, 1.0), 0.0035, "tile",
                          dict(w=0.1, h=0.05, joint=0.005, cols=["#7b5a45", "#86644d", "#6f513e", "#91705a"], grout="#8a847a", rough=0.55, face="rustic")),
    "jp_tile_nichou":    ("Tiles 227 x 60, raked brown (二丁掛)", "tiles", "tiles", (2.32, 1.04), 0.004, "tile",
                          dict(w=0.232, h=0.065, joint=0.008, cols=["#8a5b40", "#7d5039", "#956648", "#6e4733"], grout="#8f897f", rough=0.7, face="scratch")),
    "jp_mosaic_blue":    ("Mosaic 50 x 50, blue-grey (1970s)", "tiles", "tiles", (1.65, 1.65), 0.003, "tile",
                          dict(w=0.055, h=0.055, joint=0.004, offset=0.0, cols=["#8a9ba5", "#7c8e98", "#97a7af", "#a9b5ba", "#6f818b"], grout="#a8a49c", rough=0.28)),
    # siding
    "jp_siding_brick":   ("Ceramic siding, brick (窯業系サイディング)", "siding", "panels", (3.03, 2.73), 0.005, "panel",
                          dict(panel=(3.03, 0.455), offset=0.5, pattern="bricks", col="#9a7a64", cols=["#9c6b52", "#8a5c45", "#a87a5e", "#7a5241"], mortar="#a39d93", rough=0.75)),
    "jp_siding_stone":   ("Ceramic siding, stone", "siding", "panels", (3.03, 2.73), 0.006, "panel",
                          dict(panel=(3.03, 0.455), offset=0.5, pattern="stone", col="#b5ab9b", cols=["#b9ae9d", "#a99e8c", "#c6bcab", "#9d927f"], mortar="#8d877d", rough=0.8)),
    "jp_siding_board":   ("Siding, painted boards", "siding", "boards", (3.0, 2.4), 0.004, "panel",
                          dict(board=0.2, cols=["#cfcdc6", "#c9c7c0", "#d4d2cb"], lap=0.6, grain=2.0, grain_h=0.06, grain_var=0.015, var=0.015, rough=0.6, gap_dark=0.35)),
    "jp_wood_weathered": ("Wood planks, weathered (下見板)", "siding", "boards", (3.0, 2.4), 0.004, "wood",
                          dict(board=0.18, cols=["#6e6052", "#7a6b5b", "#625547", "#85776a"], lap=0.8, grain=3.0, grain_h=0.3, grain_var=0.12, var=0.08, rough=0.85)),
    "jp_yakisugi":       ("Charred cedar (焼杉)", "siding", "boards", (2.4, 3.0), 0.005, "wood",
                          dict(board=0.18, vertical=True, cols=["#2a2725", "#312e2b", "#24221f"], lap=0.0, grain=3.0, grain_h=0.25, grain_var=0.2, var=0.06, rough=0.9, char=True)),
    # concrete and stone
    "jp_concrete_bare":  ("Concrete, exposed (打ち放し)", "concrete", "concrete", (3.6, 3.6), 0.003, "concrete",
                          dict(kind="exposed", col="#9c9a94", var=0.08, rough=0.7)),
    "jp_concrete_dark":  ("Concrete, weathered dark", "concrete", "concrete", (3.6, 3.6), 0.003, "concrete",
                          dict(kind="exposed", col="#7c7a74", var=0.1, rough=0.76)),
    "jp_precast_pink":   ("Precast panels, pink stone", "concrete", "concrete", (3.6, 3.6), 0.003, "panel",
                          dict(kind="precast", col="#c7a99b", agg="#9b857b", var=0.05, rough=0.7)),
    "jp_block_wall":     ("Concrete blocks (ブロック塀)", "concrete", "concrete", (2.4, 2.4), 0.006, "blocks",
                          dict(kind="blocks", col="#8f8b84", pores=110, var=0.08, rough=0.88)),
    "jp_granite_black":  ("Granite, polished black", "concrete", "concrete", (2.4, 2.4), 0.002, "tile",
                          dict(kind="stone", col="#2b2a29", pw=0.6, ph=0.6, specks=["#1c1b1a", "#2a2928", "#3d3b39", "#585550", "#151414"], rough=0.12)),
    "jp_granite_grey":   ("Granite, flamed grey", "concrete", "concrete", (2.4, 2.4), 0.003, "tile",
                          dict(kind="stone", col="#8f8c88", pw=0.6, ph=0.3, specks=["#7a7773", "#9d9a95", "#b9b6b0", "#5d5a56", "#8a8783"], speck=220, rough=0.55)),
    # metal
    "jp_corrugated_galv": ("Corrugated sheet, galvanised (波板)", "metal", "metal", (2.432, 2.0), 0.012, "corrugated",
                          dict(profile="sine", pitch=0.076, col="#a7aaab", finish="galv", rust=0.25)),
    "jp_corrugated_paint": ("Corrugated sheet, painted", "metal", "metal", (2.432, 2.0), 0.012, "corrugated",
                          dict(profile="sine", pitch=0.076, col="#6f7d72", finish="paint", chips=0.82, rough=0.5)),
    "jp_spandrel":       ("Spandrel, ribbed metal (スパンドレル)", "metal", "metal", (2.0, 2.0), 0.004, "corrugated",
                          dict(profile="groove", pitch=0.1, ribs_along="u", col="#c2c4c3", finish="paint", chips=0.95, rough=0.38)),
    "jp_shutter":        ("Shutter, galvanised slats", "metal", "metal", (2.0, 2.0), 0.006, "corrugated",
                          dict(profile="slats", pitch=0.05, ribs_along="u", col="#9fa3a5", finish="galv", rust=0.1, rough=0.45)),
    "jp_steel_white":    ("Steel, painted white", "metal", "metal", (2.0, 2.0), 0.0015, "metal",
                          dict(profile="flat", col="#d8d8d3", finish="paint", chips=0.86, rough=0.4)),
    "jp_steel_grey":     ("Steel, painted grey-green", "metal", "metal", (2.0, 2.0), 0.0015, "metal",
                          dict(profile="flat", col="#7e8a82", finish="paint", chips=0.8, rough=0.45)),
    "jp_aluminium":      ("Aluminium, anodised (sashes)", "metal", "metal", (2.0, 2.0), 0.001, "metal",
                          dict(profile="flat", col="#b9bcbe", finish="anodised", rough=0.32)),
    "jp_rust":           ("Steel, rusted", "metal", "metal", (2.0, 2.0), 0.002, "metal",
                          dict(profile="flat", col="#7a7d7f", finish="galv", rust=1.0, rough=0.6)),
    # roofs
    "jp_kawara_ibushi":  ("Kawara, ibushi silver (いぶし瓦)", "roofs", "kawara", (2.44, 2.45), 0.03, "roof_tiles",
                          dict(kind="kawara", cols=["#5f6366", "#686c6f", "#565a5d", "#71757a"], rough=0.42, metal=0.25)),
    "jp_kawara_blue":    ("Kawara, glazed blue (釉薬瓦)", "roofs", "kawara", (2.44, 2.45), 0.03, "roof_tiles",
                          dict(kind="kawara", cols=["#33465a", "#2d3f52", "#3a4e63"], rough=0.18)),
    "jp_kawara_black":   ("Kawara, glazed black", "roofs", "kawara", (2.44, 2.45), 0.03, "roof_tiles",
                          dict(kind="kawara", cols=["#252627", "#2c2d2f", "#1f2021"], rough=0.2)),
    "jp_slate":          ("Slate, Colorbest", "roofs", "kawara", (2.73, 2.184), 0.006, "roof_tiles",
                          dict(kind="slate", cols=["#3b3a39", "#433f3c", "#353433", "#4a4643"], rough=0.6)),
    "jp_galvalume":      ("Galvalume, standing seam (ガルバリウム)", "roofs", "metal", (2.7, 2.0), 0.008, "roof_sheet",
                          dict(profile="seam", pitch=0.45, col="#45484a", finish="paint", chips=0.97, rough=0.42)),
    "jp_roof_coating":   ("Flat roof, urethane coating", "roofs", "simple", (4.0, 10.0), 0.003, "concrete",
                          dict(kind="coating", col="#848a82", seam="#5e625c", patch="#6d7169")),
    # roads and pavements
    "jp_asphalt_new":    ("Asphalt, new", "roads", "asphalt", (6.0, 6.0), 0.003, "asphalt",
                          dict(col="#3a3a3b", expose=0.12, stones=120, rough=0.88)),
    "jp_asphalt_old":    ("Asphalt, old (cracks, sealant, patches)", "roads", "asphalt", (6.0, 6.0), 0.003, "asphalt",
                          dict(col="#575653", expose=0.35, stones=110, cracks=True, patches=True, rough=0.86)),
    "jp_asphalt_green":  ("Asphalt, green lane (カラー舗装)", "roads", "asphalt", (6.0, 6.0), 0.003, "paint",
                          dict(col="#3a3a3b", coat="#5d7b55", stones=120, rough=0.86)),
    "jp_asphalt_red":    ("Asphalt, red", "roads", "asphalt", (6.0, 6.0), 0.003, "paint",
                          dict(col="#3a3a3b", coat="#8a4b3d", stones=120, rough=0.86)),
    "jp_pavers_grey":    ("Concrete pavers, 300 square", "pavements", "pavers", (2.4, 2.4), 0.004, "paving",
                          dict(w=0.3, h=0.3, cols=["#8e8c87", "#96948f", "#86847f", "#9e9c96"], rough=0.8)),
    "jp_interlocking":   ("Interlocking blocks, mixed", "pavements", "pavers", (2.4, 2.4), 0.005, "paving",
                          dict(w=0.2, h=0.1, offset=0.5, cols=["#8d8781", "#a08877", "#7c7670", "#9b938a", "#8a7266"], rough=0.82)),
    "jp_tactile_dots":   ("Tactile paving, dots (点字ブロック)", "pavements", "pavers", (2.4, 2.4), 0.006, "paving",
                          dict(w=0.3, h=0.3, cols=["#d4ad2a", "#cfa826", "#d9b331"], tactile="dots", agg=0.02, rough=0.55)),
    "jp_tactile_bars":   ("Tactile paving, bars", "pavements", "pavers", (2.4, 2.4), 0.006, "paving",
                          dict(w=0.3, h=0.3, cols=["#d4ad2a", "#cfa826", "#d9b331"], tactile="bars", agg=0.02, rough=0.55)),
    "jp_kerb":           ("Kerb, precast concrete", "pavements", "pavers", (3.6, 2.4), 0.004, "kerb",
                          dict(w=0.6, h=2.4, cols=["#a19e98", "#9a9791", "#a8a59f"], chamfer=0.01, rough=0.8)),
    "jp_gravel":         ("Gravel", "pavements", "simple", (3.0, 3.0), 0.01, "ground",
                          dict(kind="gravel", col="#6f6a62", stone_cols=["#8d8981", "#9e9890", "#7a756e", "#a7a097"])),
    "jp_earth":          ("Earth, packed", "pavements", "simple", (3.0, 3.0), 0.006, "ground",
                          dict(kind="gravel", col="#6b5a49", stones=40, stone_cols=["#7c6c5b", "#8a7a68", "#6e6052"])),
    # other
    "jp_glass":          ("Glass, window", "other", "simple", (3.0, 3.0), 0.0005, "glass",
                          dict(kind="glass", col="#2b3033", rough=0.04)),
}

# the library's entries known to the finishes (so tiles.py bakes them like any finish)
for _n, (_label, _group, _fam, _P, _rel, _wear, _p) in LIB.items():
    F.BUILD[_n] = (lambda fam, prm: (lambda nb, uv, T, P: FAMILY[fam](nb, uv, T, P, prm)))(_fam, _p)
    F.PERIOD[_n] = _P
    F.WEAR.setdefault(_n, F.WEAR[_wear])
RELIEF = {n: v[4] for n, v in LIB.items()}
NAMES = sorted(LIB)


def meta(name):
    """What the paint page shows of an entry (written beside its set)."""
    label, group, fam, P, rel, wear, p = LIB[name]
    return {"label": label, "group": group, "family": fam, "tile_m": P[0], "tile_v_m": P[1], "relief_m": rel, "wear": wear}
