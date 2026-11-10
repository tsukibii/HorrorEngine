"""Computers (DECISIONS 2026-11-10, later: the user's `laptop`): the user's own low-poly laptop and mouse ("PSX STYLE Low
Poly LAPTOP & MOUSE", made in Blender: `model`, an .fbx in Content/Studio/Props/models/) brought to their real size and
given what the made props have, as the retro pack's models are (PROPGEN §29): the model kept, its parts found on it,
painted by what each part is, its occlusion baked, worn. Its own two textures (a 120 x 85 photo of a keyboard and a
92 x 98 product shot of a gaming mouse, both off the web) aren't ours to ship, so every surface is painted here.

The laptop (`kind: "laptop"`): the base and the lid as the model has them (the base's top with a keyboard well and a
palm rest, its front edge bevelled, a channel at the back for the hinge; the lid a slab with the screen sunk behind a
bezel), its four materials:
- `deck`, the base's top seen from above (its island `deck`, x across, y from the front edge to the hinge): a real key
  layout (fifteen units wide, six rows, the function row low) of chiclet keys raised over a darker well, their legends
  printed, the keys you play with (W A S D, E, Q, R, F, Space, Shift, Enter) polished shiny and their letters rubbed
  thin, speaker grilles each side, a touchpad sunk into the palm rest with its chamfer, the palms' shine either side of
  it, three status lights (the power one lit), a sticker (`deck.sticker`);
- `lid`, its back (the island `lid`, read from behind, upright when it's open): the maker's crescent and name in the
  middle (`lid.logo`), an old sticker (`lid.sticker`) and an asset tag with its barcode (`lid.tag`), all yours to swap;
- `screen`, the glass behind the bezel (the island `screen`, upright from the front, alone in its texture so a game puts
  its own picture there: the devices plugin's HSLaptop draws its terminal on it);
- `shell`, the rest, painted by each texel's place: the plastic's fine grain, the bezel's matt black with a webcam and
  its light at the top, the ports along the sides, the hinge channel, and underneath four rubber feet, screws, vents
  and a label.
The lid is a part on its hinge (PROPGEN §26: `lid`, about x, built as the model has it, `open` its angle, `shut` 0), the
hinge's line found so the shut lid lies on the deck flush with its back. `lid: "shut"` builds it shut. Sockets:
`screen` (the glass's middle, out of it), `screen_up` and `screen_right` (the middle of its top and right edges: its
size and which way is up), `webcam`, `keys` (the keyboard's middle), `power` (the power light), `hinge`; the first four
ride on the lid. The root's extras `propgen_computer`: the screen's size in mm and its material's name.

The mouse (`kind: "mouse"`): the model's mouse turned round so its buttons point away from you (+y, the laptop's way),
`length_mm` long (its own proportions; `height_mm` stretches it), in two materials: `top` (its island seen from above:
the buttons' split, the wheel in rubber with its ridges, the maker's crescent `top.logo`) and `body` (by place: the grip
on its sides, underneath the feet, a label and the sensor's red glow). Sockets `wheel`, `sensor`, `palm`.

    {"family": "computer", "kind": "laptop", "model": "Content/Studio/Props/models/laptop_mouse.fbx", "width_mm": 330,
     "plastic": "#2c2e33", "keys": "#16171a", "legend": "#c6cad0", "bezel": "#101114", "brand": "VESPER", "lid": "open"}
    {"family": "computer", "kind": "mouse", "model": "Content/Studio/Props/models/laptop_mouse.fbx", "length_mm": 115,
     "plastic": "#1d1f23"}
"""
import math
import os

import numpy as np

from .. import mesh as M
from .. import noise as N

CUSTOM = True       # your own pictures go on it: the picture editor previews them on its picture (PROPGEN §25)

MODEL = "Content/Studio/Props/models/laptop_mouse.fbx"
LAPTOP_OBJECTS = {"base": "Cube", "lid": "Cube.001"}   # the model's assembled laptop (its second copy, laid flat, isn't used)
MOUSE_OBJECT = "Cube.002"
INK = dict(rough=0.42, metal=0.0)

# the keyboard, row by row: (legend, width in units); "" a key with no legend. A row of 15 units; the function row low.
ROWS = [
    [("esc", 1)] + [(f"F{i}", 1) for i in range(1, 13)] + [("del", 1), ("pwr", 1)],
    [("`", 1), ("1", 1), ("2", 1), ("3", 1), ("4", 1), ("5", 1), ("6", 1), ("7", 1), ("8", 1), ("9", 1), ("0", 1), ("-", 1),
     ("=", 1), ("backspace", 2)],
    [("tab", 1.5)] + [(c, 1) for c in "QWERTYUIOP[]"] + [("\\", 1.5)],
    [("caps", 1.75)] + [(c, 1) for c in "ASDFGHJKL;'"] + [("enter", 2.25)],
    [("shift", 2.25)] + [(c, 1) for c in "ZXCVBNM,./"] + [("shift ", 2.75)],
    [("ctrl", 1.25), ("fn", 1), ("", 1), ("alt", 1.25), (" ", 5.5), ("alt ", 1), ("ctrl ", 1), ("<", 1), ("^v", 1), (">", 1)],
]
PLAYED = {"W": 1.0, "A": 1.0, "S": 1.0, "D": 1.0, "E": 0.8, " ": 0.7, "shift": 0.7, "Q": 0.5, "R": 0.5, "F": 0.5, "enter": 0.5,
          "C": 0.35, "esc": 0.35, "tab": 0.3, "1": 0.3, "2": 0.3}


def _model_path(spec):
    from ..recipes import ROOT
    p = spec.get("model", MODEL)
    p = p if os.path.isabs(p) else os.path.join(ROOT, p)
    if not os.path.exists(p):
        raise SystemExit(f"computer: no model at {p}")
    return p


def _import(path, names):
    """The .fbx's mesh objects by name (only those it brought in), and what was there before."""
    import bpy
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path)
    bpy.context.view_layer.update()
    obs = {o.name: o for o in bpy.data.objects if o not in before and o.type == "MESH"}
    missing = [n for n in names if n not in obs]
    if missing:
        raise SystemExit(f"computer: {', '.join(missing)} not in {os.path.basename(path)} (its objects: {', '.join(sorted(obs))})")
    return obs, before


def _place(ob, R, mats):
    """The object's mesh at its place in the made thing (its world matrix, then R), faces turned out again if that
    mirrored it (the model's mouse is scaled by -1 on every axis), its materials `mats`."""
    import bmesh
    import bpy
    import mathutils
    X = R @ ob.matrix_world
    ob.data.transform(X)
    if X.determinant() < 0:
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
        bm.to_mesh(ob.data)
        bm.free()
    ob.parent = None
    ob.matrix_world = mathutils.Matrix.Identity(4)
    ob.data.materials.clear()
    for nm in mats:
        if nm not in bpy.data.materials:
            bpy.data.materials.new(nm)
        ob.data.materials.append(bpy.data.materials[nm])
    ob.data.update()


def _join_uv(obs, shell_slots, before):
    """The objects joined into one mesh (each face's object in the int attribute `hs_piece`), big faces triangulated,
    smart UVs for the materials painted by place (`shell_slots`); back as a Mesh."""
    import bmesh
    import bpy
    for i, o in enumerate(obs):
        at = o.data.attributes.get("hs_piece") or o.data.attributes.new("hs_piece", "INT", "FACE")
        at.data.foreach_set("value", [i] * len(o.data.polygons))
    for o in bpy.context.scene.objects:
        o.select_set(False)
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    if len(obs) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    big = [f for f in bm.faces if len(f.verts) > 4]
    if big:
        bmesh.ops.triangulate(bm, faces=big)
    bm.to_mesh(me)
    bm.free()
    if not me.uv_layers:
        me.uv_layers.new(name="UVMap")
    bpy.ops.object.mode_set(mode="EDIT")
    for i in shell_slots:                              # a layout of its own a material, in 0-1, no overlaps
        bpy.ops.mesh.select_all(action="DESELECT")
        ob.active_material_index = i
        bpy.ops.object.material_slot_select()
        bpy.ops.uv.smart_project(angle_limit=math.radians(55), island_margin=0.01, area_weight=0.0, correct_aspect=True,
                                 scale_to_bounds=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    piece = np.zeros(len(me.polygons), np.int32)
    me.attributes["hs_piece"].data.foreach_get("value", piece)
    full = M.from_blender(me)
    for o in list(bpy.data.objects):
        if o not in before:
            bpy.data.objects.remove(o, do_unlink=True)
    return full, piece


def _planar(full, faces, isl, a_of, b_of):
    """The faces' corners mapped across the island: island-local a = a_of(points), b = b_of(points), 0 to 1."""
    for fi in np.nonzero(faces)[0]:
        for k in range(4):
            vi = full.f[fi, k]
            if vi < 0:
                continue
            p = full.v[vi]
            full.uv[fi, k] = isl.to_uv(float(np.clip(a_of(p), 0, 1)), float(np.clip(b_of(p), 0, 1)))


def _density(th, full, mname, mi):
    """Pixels a millimetre of a material laid out by smart UVs (one density a material): the relief's and the wear's scale."""
    tt, tuv, tf = full.tris()
    a3 = 0.5 * np.linalg.norm(np.cross(full.v[tt[:, 1]] - full.v[tt[:, 0]], full.v[tt[:, 2]] - full.v[tt[:, 0]]), axis=1) * 1e6
    e1, e2 = tuv[:, 1] - tuv[:, 0], tuv[:, 2] - tuv[:, 0]
    a2 = 0.5 * np.abs(e1[:, 0] * e2[:, 1] - e1[:, 1] * e2[:, 0])
    sel = full.fm[tf] == mi
    if sel.any():
        th.density[mname] = float(th.mats[mname]["px"] * math.sqrt(a2[sel].sum() / max(a3[sel].sum(), 1e-9)))


def _rot_x(deg):
    a = math.radians(deg)
    return np.array([[1, 0, 0], [0, math.cos(a), -math.sin(a)], [0, math.sin(a), math.cos(a)]])


def _grain(P, seed, scale=0.35):
    """A plastic's fine grain (a sparkle of the moulding's texture) from a texel's place: -1..1."""
    return N.fbm3(P * (1000.0 / scale), seed, 2)


def _bevel(ob, width, segs, keep):
    """The object's edges sharper than 30 degrees rounded off `width` metres in `segs` steps, except round the faces
    `keep(face)` names (the screen and the recess it sits in: its rectangle stays exact)."""
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.faces.ensure_lookup_table()
    kept = {f.index for f in bm.faces if keep(f)}
    edges = [e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0.0) > math.radians(30)
             and not any(f.index in kept for f in e.link_faces)]
    if edges:
        bmesh.ops.bevel(bm, geom=edges, offset=width, offset_type="OFFSET", segments=segs, profile=0.5, affect="EDGES",
                        clamp_overlap=True)
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()


# ---- the laptop ---------------------------------------------------------------------------------------------------------

def _laptop(spec, th):
    import bpy  # noqa: F401  (the importer's)
    import mathutils
    from ..paint import rgb
    seed = int(spec.get("seed", 0))
    path = _model_path(spec)
    names = dict(LAPTOP_OBJECTS, **(spec.get("objects") or {}))
    obs, before = _import(path, [names["base"], names["lid"]])
    base, lid = obs[names["base"]], obs[names["lid"]]
    for n, o in list(obs.items()):                     # the model's other pieces (its laid-out copy, the mouse) aren't the laptop
        if o not in (base, lid):
            bpy.data.objects.remove(o, do_unlink=True)
    W0 = base.matrix_world
    bp = np.array([tuple(W0 @ v.co) for v in base.data.vertices])
    lo, hi = bp.min(0), bp.max(0)
    k = float(spec.get("width_mm", 330)) * 0.001 / max(float(hi[0] - lo[0]), 1e-9)
    R = mathutils.Matrix.Translation((-(lo[0] + hi[0]) / 2 * k, -(lo[1] + hi[1]) / 2 * k, -lo[2] * k)) @ mathutils.Matrix.Scale(k, 4)
    mats = ["shell", "deck", "lid", "screen"]
    for o in (base, lid):
        _place(o, R, mats)
    # the base: its top (the deck) is every face looking up at its highest
    bv = np.array([tuple(v.co) for v in base.data.vertices])
    ztop, yback = float(bv[:, 2].max()), float(bv[:, 1].max())
    deck_v = []
    for p in base.data.polygons:
        up = p.normal.z > 0.99 and p.center.z > ztop - 0.0005
        p.material_index = 1 if up else 0
        if up:
            deck_v += [tuple(base.data.vertices[i].co) for i in p.vertices]
    deck_v = np.array(deck_v)
    dx0, dy0 = deck_v[:, :2].min(0)
    dx1, dy1 = deck_v[:, :2].max(0)
    # the lid: the screen is the biggest face looking forward (out of its recess), its back the biggest looking back
    polys = list(lid.data.polygons)
    fronts = [p for p in polys if p.normal.y < -0.3]
    backs = [p for p in polys if p.normal.y > 0.3]
    if not fronts or not backs:
        raise SystemExit("computer laptop: no screen or back found on the lid")
    scr = max(fronts, key=lambda p: p.area)
    bk = max(backs, key=lambda p: p.area)
    n_s = np.array(tuple(scr.normal), float)
    n_s /= np.linalg.norm(n_s)
    rx = np.array([1.0, 0.0, 0.0])
    up = np.cross(n_s, rx)
    up /= np.linalg.norm(up)
    if up[2] < 0:                                    # the model's screen upside down: its up is the lid's top all the same
        up = -up
    for p in polys:
        p.material_index = 3 if p.index == scr.index else 2 if p.index == bk.index else 0
    sv = np.array([tuple(lid.data.vertices[i].co) for i in scr.vertices])
    bkv = np.array([tuple(lid.data.vertices[i].co) for i in bk.vertices])
    lv = np.array([tuple(v.co) for v in lid.data.vertices])
    # the hinge: the lid turned about x until its screen faces down, lying on the deck 0.6 mm clear, flush with the
    # base's back; the line it turns about solved from those two (any line along x gives the same turn, only its place
    # moves the shut lid)
    phi = math.degrees(-math.pi / 2 - math.atan2(n_s[2], n_s[1]))
    phi = (phi + 180.0) % 360.0 - 180.0
    if phi < 0:
        phi += 360.0
    Rc = _rot_x(phi)
    w = lv @ Rc.T
    d = np.array([yback - w[:, 1].max(), ztop + 0.0006 - w[:, 2].min()])
    pyz = np.linalg.solve((np.eye(3) - Rc)[1:, 1:], d)
    pivot = np.array([0.0, pyz[0], pyz[1]])
    shut = spec.get("lid", "open") == "shut"
    print(f"  laptop: scale {k:.4f}, {len(base.data.polygons) + len(lid.data.polygons)} faces; deck "
          f"{(dx1 - dx0) * 1000:.0f} x {(dy1 - dy0) * 1000:.0f} mm at z {ztop * 1000:.1f}; screen normal {np.round(n_s, 3).tolist()}; "
          f"the lid opens {phi:.1f} deg about y {pivot[1] * 1000:.1f} z {pivot[2] * 1000:.1f} mm")
    # the islands at their true sizes (mm); each picture-bearing face alone in its material
    sa, sb = sv @ rx, sv @ up
    ba, bb = bkv @ rx, bkv @ up
    deck_mm = ((dx1 - dx0) * 1000, (dy1 - dy0) * 1000)
    scr_mm = ((sa.max() - sa.min()) * 1000, (sb.max() - sb.min()) * 1000)
    lid_mm = ((ba.max() - ba.min()) * 1000, (bb.max() - bb.min()) * 1000)
    px = int(spec.get("tex", 1024))
    plastic = spec.get("plastic", "#2c2e33")
    th.material("shell", "plastic", px=px, color=plastic, rough=0.6)
    th.material("deck", "plastic", px=int(spec.get("deck_tex", 2048)), color=plastic, rough=0.58)
    th.material("lid", "plastic", px=px, color=plastic, rough=0.55)
    th.material("screen", "clear", px=int(spec.get("screen_tex", 256)), color="#07080a", rough=0.06)
    th.island("deck", *deck_mm, "deck")
    th.island("lid", *lid_mm, "lid")
    th.island("screen", *scr_mm, "screen")
    th.pack()
    I = th.islands
    bw = float(spec.get("bevel_mm", 1.5)) * 0.001
    if bw > 0:                                         # its edges rounded off a little, so they catch the light
        sunk_d = float((lv @ n_s).max())
        _bevel(base, bw, 2, lambda f: False)
        _bevel(lid, bw, 2, lambda f: f.material_index == 3 or (abs(float(np.dot(tuple(f.normal), n_s))) < 0.2
                                                               and float(np.dot(tuple(f.calc_center_median()), n_s)) < sunk_d - 1e-4))
    full, piece = _join_uv([base, lid], [0], before)
    full.mats = mats
    fm = full.fm
    _planar(full, fm == 1, I["deck"], lambda p: (p[0] - dx0) / (dx1 - dx0), lambda p: (p[1] - dy0) / (dy1 - dy0))
    _planar(full, fm == 3, I["screen"], lambda p: (p @ rx - sa.min()) / (sa.max() - sa.min()),
            lambda p: (p @ up - sb.min()) / (sb.max() - sb.min()))
    _planar(full, fm == 2, I["lid"], lambda p: (ba.max() - p @ rx) / (ba.max() - ba.min()),       # read from behind
            lambda p: (p @ up - bb.min()) / (bb.max() - bb.min()))
    # where things are (the built lid: open as modelled, or turned shut)
    centre = sv.mean(0)
    s_up = centre + up * (sb.max() - sb.min()) / 2
    s_right = centre + rx * (sa.max() - sa.min()) / 2
    bezel_top = float((lv @ up).max() - sb.max())
    sunk = float((lv @ n_s).max() - centre @ n_s)        # the glass sits this far behind the bezel's face
    cam = centre + up * ((sb.max() - sb.min()) / 2 + bezel_top * 0.5) + n_s * sunk
    lid_pts = {"screen": (centre, n_s), "screen_up": (s_up, up), "screen_right": (s_right, rx), "webcam": (cam, n_s)}
    lid_faces = piece == 1
    if shut:
        turn = lambda q: (np.asarray(q) - pivot) @ Rc.T + pivot     # noqa: E731
        idx = np.unique(full.f[lid_faces][full.f[lid_faces] >= 0])
        full.v[idx] = turn(full.v[idx])
        lid_pts = {n: (turn(p), Rc @ np.asarray(v)) for n, (p, v) in lid_pts.items()}
    full.a["rest"] = full.v.copy()
    th.assemble([("base", M.select(full, ~lid_faces)), ("lid", M.select(full, lid_faces))], None, mats)
    th.high = None
    th.part("lid", tuple(pivot), (-1.0, 0.0, 0.0), kind="hinge", open=round(phi, 2), shut=0.0, built=0.0 if shut else round(phi, 2))
    # the deck's layout (mm in its island, from its front-left corner): the keyboard in the back 56%, the touchpad below
    DW, DH = deck_mm
    lay = _deck_layout(DW, DH)
    kx = dx0 + (lay["kb"][0] + lay["kb"][2] / 2) / 1000
    ky = dy0 + (lay["kb"][1] + lay["kb"][3] / 2) / 1000
    pw = lay["power_led"]
    th.sockets = {n: (tuple(float(c) for c in p), tuple(float(c) for c in v)) for n, (p, v) in lid_pts.items()}
    th.sockets.update({"keys": ((kx, ky, ztop), (0.0, 0.0, 1.0)),
                       "power": ((dx0 + pw[0] / 1000, dy0 + pw[1] / 1000, ztop), (0.0, 0.0, 1.0)),
                       "hinge": (tuple(float(c) for c in pivot), (-1.0, 0.0, 0.0))})
    th.extras["computer"] = {"kind": "laptop", "screen_mm": [round(scr_mm[0], 1), round(scr_mm[1], 1)],
                             "screen_material": "screen", "lid_open_deg": round(phi, 2), "lid": "shut" if shut else "open",
                             "model": os.path.basename(path)}
    _density(th, full, "shell", 0)
    th.pose = "stand"
    th.sharp_angle = float(spec.get("sharp_angle", 50))
    th.weighted = float(spec.get("weighted", 50))     # hard surface: its flat faces flat, its bevels round
    th.view = {"azim": -32, "elev": 30}
    th.reach = 0.003
    th.cage = 0.0015
    th.ao_dist = 0.02

    # ---- paint
    keys_c = spec.get("keys", "#16171a")
    legend = spec.get("legend", "#c6cad0")
    brand = str(spec.get("brand", "VESPER"))
    played = dict(PLAYED, **(spec.get("played") or {}))

    def paint(fr):
        _paint_deck(fr["deck"], lay, seed, plastic, keys_c, legend, played, spec)
        _paint_lid(fr["lid"], seed, plastic, brand, spec)
        f = fr["screen"]
        f.fill(color="#060709", rough=0.05, metal=0.0)
        X, Y = f.grid()
        dust = np.clip(N.fbm3(np.stack([X / 9.0, Y / 9.0, np.full_like(X, 3.0 + seed)], -1), seed + 41, 3) * 0.5 + 0.2, 0, 1)
        f.lay_island((dust * 0.5).astype(np.float32), rough=0.16)          # its dust and smears only change its shine

    # the shell by place: which side of the base or lid a texel is on, from where it is and which way it faces
    zt = ztop
    lid_n = lid_pts["screen"][1]
    bez = rgb(spec.get("bezel", "#101114"))
    pl = rgb(plastic)

    def texel_paint(mname, cv, tx):
        if mname != "shell":
            return
        hit = tx["hit"]
        if not hit.any():
            return
        cv.used |= hit                                  # what the bleed keeps (no island marks this material's texels)
        P = tx["rest"][hit].astype(np.float64)
        Nn = tx["nrm"][hit]
        x, y, z = P[:, 0], P[:, 1], P[:, 2]
        g = _grain(P, seed + 3)
        col = pl[None] * (1.0 + 0.02 * g[:, None])
        rough = 0.6 + 0.03 * g
        height = 0.0015 * g
        emit = np.zeros((len(P), 3))
        on_lid = z > zt + 0.002 if not shut else z > zt + 0.0004
        front = on_lid & (Nn @ lid_n > 0.95)                    # the bezel round the glass
        col[front] = bez * (1.0 + 0.04 * g[front, None])
        rough[front] = 0.48
        # the webcam: a glossy lens in a ring, its light beside it
        c_cam = lid_pts["webcam"][0]
        dcam = np.linalg.norm(P - c_cam[None], axis=1)
        lens = front & (dcam < 0.0018)
        ring = front & (dcam >= 0.0018) & (dcam < 0.0026)
        col[ring] = rgb("#26282c")
        rough[ring] = 0.3
        col[lens] = rgb("#050608")
        rough[lens] = 0.05
        height[lens] = -0.05
        led = front & (np.linalg.norm(P - (c_cam + rx * 0.006)[None], axis=1) < 0.0006)
        col[led] = rgb("#1a1d1a")
        rough[led] = 0.2
        # under the base: four rubber feet, screws, vents toward the back, a label
        bottom = (~on_lid) & (Nn[:, 2] < -0.9)
        bx, by = x[bottom], y[bottom]
        xs = np.array([lo_b[0] + 0.03, hi_b[0] - 0.03])
        ys = np.array([lo_b[1] + 0.025, hi_b[1] - 0.03])
        feet = np.zeros(len(bx), bool)
        for fx in xs:
            for fy in ys:
                feet |= ((bx - fx) / 0.016) ** 2 + ((by - fy) / 0.006) ** 2 < 1
        screws = np.zeros(len(bx), bool)
        for sx in np.linspace(lo_b[0] + 0.012, hi_b[0] - 0.012, 5):
            for sy in (lo_b[1] + 0.012, hi_b[1] - 0.012):
                screws |= np.hypot(bx - sx, by - sy) < 0.0021
        vents = (by > hi_b[1] - 0.075) & (by < hi_b[1] - 0.035) & (np.abs(bx) < 0.09) & (np.mod((bx + 0.09) / 0.0042, 1.0) < 0.42)
        label = (np.abs(bx - 0.0) < 0.035) & (by > lo_b[1] + 0.04) & (by < lo_b[1] + 0.075)
        cb, rb, hb = col[bottom], rough[bottom], height[bottom]
        cb[:] = pl * 1.08 * (1 + 0.04 * g[bottom, None])
        rb[:] = 0.7
        cb[vents] = rgb("#0b0c0d")
        rb[vents] = 0.9
        hb[vents] = -0.4
        cb[label] = rgb("#b8b6ae")
        rb[label] = 0.55
        hb[label] = 0.02
        cb[screws] = rgb("#3c3f44")
        rb[screws] = 0.35
        hb[screws] = -0.12
        cb[feet] = rgb("#121213")
        rb[feet] = 0.92
        hb[feet] = 0.35
        col[bottom], rough[bottom], height[bottom] = cb, rb, hb
        # the ports along the sides: two USBs and a jack on the left, a USB and the power on the right
        side = (~on_lid) & (np.abs(Nn[:, 0]) > 0.9)
        zc = (zt + 0.0) / 2.0
        ports = []
        for sgn, ps in ((-1, [(-0.035, "usb"), (-0.012, "usb"), (0.03, "jack")]), (1, [(-0.02, "usb"), (0.045, "power")])):
            for py, kind in ps:
                ports.append((sgn, py, kind))
        for sgn, py, kind in ports:
            on = side & (np.sign(Nn[:, 0]) == sgn)
            if kind == "usb":
                m = on & (np.abs(y - py) < 0.0062) & (np.abs(z - zc) < 0.0024)
                tongue = m & (np.abs(y - py) < 0.0045) & (np.abs(z - zc - 0.0005) < 0.0007)
                col[m] = rgb("#060607")
                rough[m] = 0.8
                height[m] = -0.6
                col[tongue] = rgb("#1d3f8f")
                rough[tongue] = 0.45
            else:
                r_ = 0.0019 if kind == "jack" else 0.0028
                m = on & (np.hypot(y - py, z - zc) < r_)
                rim = on & (np.hypot(y - py, z - zc) >= r_) & (np.hypot(y - py, z - zc) < r_ + 0.0007)
                col[rim] = rgb("#4a4d52")
                rough[rim] = 0.35
                col[m] = rgb("#050506")
                rough[m] = 0.85
                height[m] = -0.6
        # the hinge's channel at the back of the base: darker, a satin
        chan = (~on_lid) & (y > lay_back) & (Nn[:, 2] > 0.3) & (z < zt - 0.0008)
        col[chan] = pl * 0.62
        rough[chan] = 0.42
        cv.col[hit] = np.clip(col, 0, 1)
        cv.rough[hit] = np.clip(rough, 0.04, 1)
        cv.metal[hit] = 0.0
        cv.height[hit] = height
        cv.emit[hit] = emit

    lo_b, hi_b = bv.min(0), bv.max(0)
    lay_back = dy1 - 0.0005
    th.paint = paint
    th.texel_paint = texel_paint
    return th


def _deck_layout(W, H):
    """Where things go on the deck (mm from its front-left corner): the keyboard's box and its unit, the touchpad, the
    speaker grilles, the palms, the status lights, the sticker."""
    back = 7.0
    avail = H * 0.56 - back
    u = min((W - 2 * 30.0) / 15.0, avail / 5.75)
    kw, kh = 15 * u, 5.6 * u
    kx = (W - kw) / 2
    ky = H - back - kh
    tw, tht = min(108.0, W * 0.33), min(66.0, ky * 0.72)
    tx, ty = W / 2 - tw / 2 + u * 0.5, (ky - tht) * 0.5
    gw = max(10.0, kx - 10.0)
    return {"kb": (kx, ky, kw, kh), "u": u, "pad": (tx, ty, tw, tht),
            "grilles": [(5.0, ky + 2, gw - 2, kh - 4), (W - 5.0 - (gw - 2), ky + 2, gw - 2, kh - 4)],
            "palms": [(tx - 46.0, ty + tht * 0.45), (tx + tw + 46.0, ty + tht * 0.45)],
            "leds": [(14.0 + i * 6.0, 6.0) for i in range(3)], "power_led": (14.0, 6.0),
            "sticker": (W - 26.0, 13.0, 24.0, 16.0)}


def _paint_deck(f, lay, seed, plastic, keys_c, legend, played, spec):
    from ..paint import rgb
    rng = np.random.default_rng(seed + 5)
    X, Y = f.grid()
    g = N.fbm3(np.stack([X / 0.35, Y / 0.35, np.full_like(X, seed * 0.3)], -1), seed + 7, 2)
    f.fill(color=plastic, rough=0.58)
    f.lay_island(np.ones_like(X, np.float32), color=(rgb(plastic)[None, None] * (1 + 0.02 * g[..., None])).astype(np.float32),
                 height=(0.0015 * g).astype(np.float32))
    kx, ky, kw, kh = lay["kb"]
    u = lay["u"]
    gap = 0.17 * u
    # the well under the keys, a little darker and grimy at its edges
    f.rect(kx - gap * 0.6, ky - gap * 0.6, kw + gap * 1.2, kh + gap * 1.2, r=2.0, color=rgb(plastic) * 0.55, rough=0.75, height=-0.35)
    # the keys: row by row from the top (the function row 0.6 high)
    heights = [0.6, 1, 1, 1, 1, 1]
    y = ky + kh
    for row, h in zip(ROWS, heights):
        y -= h * u
        x = kx
        for lg, wu in row:
            w = wu * u
            if lg == "^v":                              # the up and down arrows stacked in one unit
                for j, s in enumerate(("v", "^")):
                    _key(f, x, y + j * h * u / 2, w, h * u / 2, gap, s, keys_c, legend, played, seed, rng)
            else:
                _key(f, x, y, w, h * u, gap, lg, keys_c, legend, played, seed, rng)
            x += w
    # speaker grilles: holes drilled through the plastic
    for gx, gy, gw, gh in lay["grilles"]:
        m = ((X > gx) & (X < gx + gw) & (Y > gy) & (Y < gy + gh)).astype(np.float32)
        f.dots(2.1, 0.5, hexed=True, mask=m, color="#08090a", rough=0.9, height=-0.25)
    # the touchpad sunk into the palm rest, its chamfer catching the light
    tx, ty, tw, tht = lay["pad"]
    f.rect(tx - 0.7, ty - 0.7, tw + 1.4, tht + 1.4, r=5.5, color=rgb(plastic) * 1.45, rough=0.32, height=-0.05)
    f.rect(tx, ty, tw, tht, r=5.0, color=rgb(plastic) * 0.92, rough=0.36, height=-0.18)
    pg = N.fbm3(np.stack([X / 0.35, Y / 0.35, np.full_like(X, 9.0)], -1), seed + 9, 2)
    pm = ((X > tx) & (X < tx + tw) & (Y > ty) & (Y < ty + tht)).astype(np.float32)
    f.lay_island(pm * 0.6, height=(0.006 * pg).astype(np.float32), add_height=True)
    # the palms' shine and grime either side of it
    for cx, cy in lay["palms"]:
        d = np.hypot((X - cx) / 42.0, (Y - cy) / 30.0)
        m = np.clip(1.15 - d, 0, 1).astype(np.float32) ** 1.5
        f.lay_island(m * 0.75, rough=0.3)
        f.lay_island(m * 0.25, color="#1b1a18")
    # three status lights at the front left: the power one lit
    for i, (lx, ly) in enumerate(lay["leds"]):
        f.rect(lx - 1.6, ly - 0.7, 3.2, 1.4, r=0.6, color="#0f1010", rough=0.25)
        if i == 0:
            f.rect(lx - 1.3, ly - 0.45, 2.6, 0.9, r=0.4, color="#7dff9a", rough=0.2, emit="#38ff6a")
    # the sticker on the palm rest (yours to swap)
    sx, sy, sw, sh = lay["sticker"]

    def sticker():
        f.rect(sx - sw / 2, sy - sh / 2, sw, sh, r=1.2, color="#c9ced6", rough=0.32, metal=0.55, height=0.04)
        f.rect(sx - sw / 2 + 1.0, sy - sh / 2 + 1.0, sw - 2.0, sh - 2.0, r=0.8, color="#2a4f9c", rough=0.3, metal=0.4)
        f.text("HELIX", (sx, sy + 2.2), 2.6, font="archivo", color="#e9edf2", **INK)
        f.text("CORE 5", (sx, sy - 2.6), 2.2, font="bebas", color="#9fc3ff", **INK)
    f.slot("sticker", (sx, sy, sw, sh), sticker, kind="logo", about="the sticker on the palm rest")


def _key(f, x, y, w, h, gap, lg, keys_c, legend, played, seed, rng):
    """One chiclet key: raised over the well, its face a touch domed, its legend printed; a key you play with polished
    and its letter rubbed thin."""
    from ..paint import rgb
    wear = float(played.get(lg.strip() if lg.strip() else lg, 0.0)) if lg else 0.0
    if lg == " ":
        wear = float(played.get(" ", 0.0))
    kx, ky, kw, kh = x + gap / 2, y + gap / 2, w - gap, h - gap
    r = min(1.6, kh * 0.18)
    base = rgb(keys_c) * (1.0 + 0.35 * wear)
    f.rect(kx, ky, kw, kh, r=r, color=base * 0.8, rough=0.62, height=0.45)
    f.rect(kx + 0.35, ky + 0.45, kw - 0.7, kh - 0.7, r=max(r - 0.3, 0.2), color=base, rough=0.62 - 0.32 * wear, height=0.6)
    if wear > 0.5:                                      # the polish where the finger lands, off-centre a little
        X, Y = f.grid()
        d = np.hypot((X - (kx + kw * 0.45)) / (kw * 0.42), (Y - (ky + kh * 0.45)) / (kh * 0.42))
        m = np.clip(1 - d, 0, 1).astype(np.float32) * ((X > kx) & (X < kx + kw) & (Y > ky) & (Y < ky + kh))
        f.lay_island(m * (wear - 0.3), rough=0.2, color=base * 1.2)
    if not lg.strip():
        return
    text = {"backspace": "← back", "enter": "enter", "shift": "shift", "shift ": "shift", "caps": "caps", "tab": "tab",
            "ctrl": "ctrl", "ctrl ": "ctrl", "alt": "alt", "alt ": "alt", "fn": "fn", "esc": "esc", "del": "del",
            "pwr": "", "<": "<", ">": ">", "^": "^", "v": "v"}.get(lg, lg)
    alpha = 1.0 - 0.75 * max(0.0, wear - 0.4) / 0.6
    if lg == "pwr":                                    # the power key's symbol: a ring broken at the top and its line
        cx, cy, rr = kx + kw / 2, ky + kh / 2, min(kw, kh) * 0.2
        ang = np.radians(np.linspace(-240, 60, 40))
        pts = np.stack([cx + rr * np.cos(ang), cy + rr * np.sin(ang)], -1)
        f.line(pts, 0.45, color=legend, alpha=alpha, **INK)
        f.line([(cx, cy), (cx, cy + rr * 1.25)], 0.45, color=legend, alpha=alpha, **INK)
        return
    word = len(text) > 1 and text not in [f"F{i}" for i in range(1, 13)]
    size = min(kh * (0.22 if word else 0.3), 3.4 if not word else 2.4)
    if word:
        f.text(text, (kx + 1.4, ky + 1.3), size, font="archivo", anchor="left bottom", color=legend, alpha=alpha, **INK)
    else:
        f.text(text, (kx + kw / 2, ky + kh * 0.52), size, font="archivo", color=legend, alpha=alpha, **INK)


def _paint_lid(f, seed, plastic, brand, spec):
    from ..paint import rgb
    X, Y = f.grid()
    g = N.fbm3(np.stack([X / 0.35, Y / 0.35, np.full_like(X, 5.0 + seed)], -1), seed + 13, 2)
    f.fill(color=plastic, rough=0.55)
    f.lay_island(np.ones_like(X, np.float32), color=(rgb(plastic)[None, None] * (1 + 0.02 * g[..., None])).astype(np.float32),
                 height=(0.0015 * g).astype(np.float32))
    cx, cy = f.W / 2, f.H * 0.55

    def logo():
        r = 13.0
        a = np.radians(np.linspace(0, 360, 72))
        outer = np.stack([cx + r * np.cos(a), cy + r * np.sin(a)], -1)
        inner = np.stack([cx + r * 0.42 + r * 0.86 * np.cos(a), cy + r * 0.3 + r * 0.86 * np.sin(a)], -1)
        f.fill_polys([outer, inner[::-1]], color="#b9bdc4", rough=0.18, metal=0.85, height=0.05)
        f.text(brand, (cx, cy - r - 8.0), 6.0, font="righteous", tracking=1.6, color="#aeb2b9", rough=0.22, metal=0.8, height=0.03)
    f.slot("logo", (cx, cy - 4.0, 70.0, 46.0), logo, kind="logo", about="the maker's crescent and name on the lid")
    sx, sy = f.W * 0.8, f.H * 0.24

    def sticker():
        r = 11.0
        f.ellipse(sx, sy, r, color="#d8b62a", rough=0.5, height=0.05)
        f.ellipse(sx - 3.6, sy + 2.6, 1.4, 2.0, color="#2a2210", rough=0.5)
        f.ellipse(sx + 3.6, sy + 2.6, 1.4, 2.0, color="#2a2210", rough=0.5)
        a = np.radians(np.linspace(200, 340, 24))
        f.line(np.stack([sx + 6.0 * np.cos(a), sy - 0.5 + 5.0 * np.sin(a)], -1), 1.0, color="#2a2210", rough=0.5)
        # rubbed through to the plastic at its edge, and a crack across it
        dd = np.hypot(X - sx, Y - sy)
        n = N.fbm3(np.stack([X / 1.5, Y / 1.5, np.full_like(X, 11.0)], -1), seed + 17, 3)
        m = ((dd < r) & (dd > r - 2.5 - 2.0 * n)).astype(np.float32) * 0.85
        f.lay_island(m, color=plastic, rough=0.55, height=0.0)
    f.slot("sticker", (sx, sy, 24.0, 24.0), sticker, kind="picture", about="an old sticker on the lid")
    tx, ty = f.W * 0.17, f.H * 0.14

    def tag():
        f.rect(tx - 15.0, ty - 7.0, 30.0, 14.0, r=0.8, color="#e8e6df", rough=0.45, height=0.04)
        f.text("ASSET 004719", (tx, ty + 3.6), 2.2, font="mono", color="#222222", rough=0.5)
        x0 = tx - 11.0
        rng = np.random.default_rng(seed + 21)
        xs = x0
        while xs < tx + 11.0:
            bw = float(rng.choice([0.25, 0.25, 0.5, 0.75]))
            if rng.random() < 0.55:
                f.rect(xs, ty - 4.8, bw, 6.0, color="#151515", rough=0.5)
            xs += bw + 0.3
    f.slot("tag", (tx, ty, 30.0, 14.0), tag, kind="stamp", about="an asset tag with its barcode")


# ---- the mouse ----------------------------------------------------------------------------------------------------------

def _evaluated(ob):
    """The object's mesh with its modifiers applied, as its own mesh (no operator: the module runs headless)."""
    import bpy
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    for m in list(ob.modifiers):
        ob.modifiers.remove(m)
    old = ob.data
    ob.data = me
    bpy.data.meshes.remove(old)


def _wheel_block(p, lo, hi):
    """The model's wheel: of the vertices in its top sixth, the run along its length (split where they're apart) that's
    narrow (the hump's row spans the whole width; the wheel stands up alone between the buttons)."""
    high = p[p[:, 2] > lo[2] + (hi[2] - lo[2]) * 0.83]
    if not len(high):
        return high
    high = high[np.argsort(high[:, 1])]
    cuts = np.nonzero(np.diff(high[:, 1]) > (hi[1] - lo[1]) * 0.06)[0] + 1
    best = None
    for g in np.split(high, cuts):
        wide = g[:, 0].max() - g[:, 0].min()
        if wide < (hi[0] - lo[0]) * 0.35 and (best is None or wide < best[0]):
            best = (wide, g)
    return best[1] if best is not None else high[:0]


def _mouse(spec, th):
    import bmesh
    import bpy
    import mathutils
    from ..paint import rgb
    seed = int(spec.get("seed", 0))
    path = _model_path(spec)
    name = spec.get("object", MOUSE_OBJECT)
    obs, before = _import(path, [name])
    ob = obs[name]
    for o in list(obs.values()):
        if o is not ob:
            bpy.data.objects.remove(o, do_unlink=True)
    W0 = ob.matrix_world.copy()
    p0 = np.array([tuple(W0 @ v.co) for v in ob.data.vertices])
    lo, hi = p0.min(0), p0.max(0)
    # its wheel: the block standing out of the top between the buttons (the model's narrow run of vertices over the rest)
    blk = _wheel_block(p0, lo, hi)
    k = float(spec.get("length_mm", 115)) * 0.001 / max(float(hi[1] - lo[1]), 1e-9)
    kz = k * (float(spec["height_mm"]) * 0.001 / (k * float(hi[2] - lo[2])) if spec.get("height_mm") else 1.0)
    turn = 180.0 if spec.get("front", "+y") == "-y" else 0.0      # its buttons toward +y, away from you, as the model has them
    R = (mathutils.Matrix.Rotation(math.radians(turn), 4, "Z") @ mathutils.Matrix.Diagonal((k, k, kz, 1.0))
         @ mathutils.Matrix.Translation((-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2])))
    Rn = np.array(R)[:3, :3]
    tn = np.array(R)[:3, 3]
    wheel_c = (blk.mean(0) @ Rn.T + tn) if len(blk) else None
    wheel_sz = ((blk.max(0) - blk.min(0)) * np.array([k, k, kz])) if len(blk) else None
    mats = ["body", "top"]
    _place(ob, R, mats)
    # made round: subdivided twice, its base's outline creased so it stays a flat foot with a crisp edge
    lv = int(spec.get("round", 2))
    if lv > 0:
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        cr = bm.edges.layers.float.get("crease_edge") or bm.edges.layers.float.new("crease_edge")
        for e in bm.edges:
            fs = e.link_faces
            if len(fs) == 2 and (fs[0].normal.z < -0.9) != (fs[1].normal.z < -0.9):
                e[cr] = 1.0
        bm.to_mesh(ob.data)
        bm.free()
        sub = ob.modifiers.new("round", "SUBSURF")
        sub.levels = sub.render_levels = lv
        _evaluated(ob)
        cap = int(spec.get("max_tris", 1600))
        tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
        if tris > cap:
            dec = ob.modifiers.new("cap", "DECIMATE")
            dec.ratio = cap / tris
            _evaluated(ob)
        for p in ob.data.polygons:
            p.use_smooth = True
    v = np.array([tuple(q.co) for q in ob.data.vertices])
    lo, hi = v.min(0), v.max(0)
    H = float(hi[2] - lo[2])
    for p in ob.data.polygons:                          # the top: what looks up, over a third of its height
        p.material_index = 1 if (p.normal.z > 0.5 and p.center.z > lo[2] + H * 0.35) else 0
    tv = np.array([tuple(ob.data.vertices[i].co) for p in ob.data.polygons if p.material_index == 1 for i in p.vertices])
    tx0, ty0 = tv[:, :2].min(0)
    tx1, ty1 = tv[:, :2].max(0)
    top_mm = ((tx1 - tx0) * 1000, (ty1 - ty0) * 1000)
    print(f"  mouse: scale {k:.4f}, {len(ob.data.polygons)} faces, {np.round((hi - lo) * 1000, 1).tolist()} mm; its top "
          f"{np.round(top_mm, 1).tolist()} mm; its wheel at {None if wheel_c is None else np.round(wheel_c * 1000, 1).tolist()} mm")
    px = int(spec.get("tex", 1024))
    plastic = spec.get("plastic", "#1d1f23")
    th.material("body", "plastic", px=px // 2, color=plastic, rough=0.55)
    th.material("top", "plastic", px=px, color=plastic, rough=0.45)
    th.island("top", *top_mm, "top")
    th.pack()
    I = th.islands
    full, piece = _join_uv([ob], [0], before)
    full.mats = mats
    _planar(full, full.fm == 1, I["top"], lambda p: (p[0] - tx0) / (tx1 - tx0), lambda p: (p[1] - ty0) / (ty1 - ty0))
    full.a["rest"] = full.v.copy()
    th.assemble([("mouse", full)], None, mats)
    th.high = None
    TW, TH = top_mm
    if wheel_c is None:
        wheel_c = np.array([0.0, ty0 + (ty1 - ty0) * 0.7, hi[2]])
        wheel_sz = np.array([0.009, 0.016, 0.004])
    wx, wy = (wheel_c[0] - tx0) * 1000, (wheel_c[1] - ty0) * 1000          # the wheel in the island (mm)
    ww, wh = max(float(wheel_sz[0]) * 1000, 6.0), max(float(wheel_sz[1]) * 1000, 12.0)
    zt = float(hi[2])
    th.sockets = {"wheel": ((float(wheel_c[0]), float(wheel_c[1]), zt), (0.0, 0.0, 1.0)),
                  "sensor": ((0.0, float(lo[1] + hi[1]) / 2 + 0.008, float(lo[2])), (0.0, 0.0, -1.0)),
                  "palm": ((0.0, ty0 + TH * 0.3 / 1000, zt), (0.0, 0.0, 1.0))}
    th.extras["computer"] = {"kind": "mouse", "model": os.path.basename(path)}
    _density(th, full, "body", 0)
    th.pose = "stand"
    th.sharp_angle = float(spec.get("sharp_angle", 70))
    th.view = {"azim": -35, "elev": 34}
    th.reach = 0.002
    th.cage = 0.001
    th.ao_dist = 0.008
    pl = rgb(plastic)

    def paint(fr):
        f = fr["top"]
        Xg, Yg = f.grid()
        g = N.fbm3(np.stack([Xg / 0.25, Yg / 0.25, np.full_like(Xg, seed * 0.7)], -1), seed + 31, 2)
        f.fill(color=plastic, rough=0.42)
        f.lay_island(np.ones_like(Xg, np.float32), color=(pl[None, None] * (1 + 0.02 * g[..., None])).astype(np.float32),
                     height=(0.0015 * g).astype(np.float32))
        back = wy - wh / 2 - 6.0                           # the buttons: from the tip back past the wheel, split down the middle
        f.line([(TW / 2, back), (TW / 2, TH + 1)], 0.45, color="#08090a", rough=0.8, height=-0.25)
        f.line([(-1, back), (TW + 1, back)], 0.35, color="#0c0d0f", rough=0.8, height=-0.15)
        # the wheel: a dark slot and the rubber in it, ridged across
        f.rect(wx - ww / 2 - 1.2, wy - wh / 2 - 1.2, ww + 2.4, wh + 2.4, r=2.4, color="#050506", rough=0.9, height=-0.3)
        f.rect(wx - ww / 2, wy - wh / 2, ww, wh, r=min(ww, wh) * 0.3, color="#26282c", rough=0.78, height=0.2)
        m = ((np.abs(Xg - wx) < ww / 2 - 0.2) & (np.abs(Yg - wy) < wh / 2 - 0.2)).astype(np.float32)
        f.stripes(1.0, 0.45, angle=90.0, mask=m, color="#121315", rough=0.9, height=-0.1)
        # the buttons glossier where the fingers rest
        for bx in (TW * 0.3, TW * 0.7):
            d = np.hypot((Xg - bx) / (TW * 0.18), (Yg - TH * 0.84) / (TH * 0.1))
            f.lay_island((np.clip(1 - d, 0, 1) * 0.6).astype(np.float32), rough=0.26)

        def logo():
            cx, cy, r = TW / 2, TH * 0.26, 4.2
            a = np.radians(np.linspace(0, 360, 48))
            outer = np.stack([cx + r * np.cos(a), cy + r * np.sin(a)], -1)
            inner = np.stack([cx + r * 0.42 + r * 0.86 * np.cos(a), cy + r * 0.3 + r * 0.86 * np.sin(a)], -1)
            f.fill_polys([outer, inner[::-1]], color="#8e939b", rough=0.2, metal=0.8, height=0.04)
        f.slot("logo", (TW / 2, TH * 0.26, 14.0, 14.0), logo, kind="logo", about="the maker's crescent on the mouse")

    def texel_paint(mname, cv, tx):
        if mname != "body":
            return
        hit = tx["hit"]
        if not hit.any():
            return
        cv.used |= hit                                  # what the bleed keeps (no island marks this material's texels)
        P = tx["rest"][hit].astype(np.float64)
        Nn = tx["nrm"][hit]
        x, y, z = P[:, 0], P[:, 1], P[:, 2]
        g = _grain(P, seed + 3, 0.25)
        col = pl[None] * (1.0 + 0.02 * g[:, None])
        rough = 0.55 + 0.03 * g
        height = 0.0015 * g
        emit = np.zeros((len(P), 3))
        side = (np.abs(Nn[:, 0]) > 0.45) & (Nn[:, 2] > -0.6)
        grip = side & (z > lo[2] + H * 0.15) & (z < lo[2] + H * 0.7) & (np.abs(y - (lo[1] + hi[1]) / 2) < (hi[1] - lo[1]) * 0.3)
        a1 = np.mod((y * 1000) / 1.4 + (z * 1000) / 1.4, 1.0)
        a2 = np.mod((y * 1000) / 1.4 - (z * 1000) / 1.4, 1.0)
        dia = (np.abs(a1 - 0.5) < 0.18) | (np.abs(a2 - 0.5) < 0.18)
        col[grip] = rgb("#141516")
        rough[grip] = 0.86
        height[grip & dia] = -0.1
        under = Nn[:, 2] < -0.85
        cy = float(lo[1] + hi[1]) / 2 + 0.008
        feet = under & ((np.abs(y - (lo[1] + 0.012)) < 0.0025) | (np.abs(y - (hi[1] - 0.012)) < 0.0025)) & (np.abs(x) < 0.016)
        col[under] = pl * 0.8
        rough[under] = 0.7
        col[feet] = rgb("#3a3b3d")
        rough[feet] = 0.14
        height[feet] = 0.25
        hole = under & (np.hypot(x, y - cy) < 0.0042)
        eye = under & (np.hypot(x, y - cy) < 0.0014)
        col[hole] = rgb("#070708")
        rough[hole] = 0.3
        height[hole] = -0.4
        col[eye] = rgb("#ff2a1a")
        emit[eye] = rgb("#ff1a0a")
        lab = under & (np.abs(x) < 0.012) & (y > cy + 0.01) & (y < cy + 0.026)
        col[lab] = rgb("#a9a79f")
        rough[lab] = 0.5
        cv.col[hit] = np.clip(col, 0, 1)
        cv.rough[hit] = np.clip(rough, 0.04, 1)
        cv.metal[hit] = 0.0
        cv.height[hit] = height
        cv.emit[hit] = emit

    th.paint = paint
    th.texel_paint = texel_paint
    return th


def make(spec, th):
    return _mouse(spec, th) if spec.get("kind", "laptop") == "mouse" else _laptop(spec, th)
