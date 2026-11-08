"""A recipe made into a prop. The family makes the thing at rest (its islands, a game mesh and, when it has detail the
game mesh can't carry, a detailed one) and deforms it; then here: set down on the floor, painted, the detailed mesh
baked onto the game mesh (normals, occlusion, creases), worn, its maps written, its material made, and the files.

    Thing.mats      {name: {kind, px, alpha, double, color, rough, metal}}: each material one texture set
    Thing.islands   {name: Island}: where each part's print goes (sizes in mm; packed per material)
    Thing.low       the game mesh; Thing.high the detailed one (or None)
    Thing.paint     fn(frames): draws every island (frames: {island name: Frame})
"""
import json
import math
import os
import time

import numpy as np

from . import bake as BK
from . import deform as D
from . import mesh as M
from . import noise as N
from . import paint as P
from . import surface as S

VERSION = 1


class Thing:
    def __init__(self, spec):
        self.spec = spec
        self.mats, self.islands, self.wrap = {}, {}, set()
        self.low = self.high = None
        self.paint = None
        self.pose, self.axis = "stand", (0, 0, 1)
        self.density = {}
        self.view = None
        self.sharp_angle = None
        self.weighted = None        # an angle (degrees): the game mesh's normals weighted by face area (hard surfaces)
        self.texel_paint = None     # fn(material name, canvas, texels): paint by each texel's place (an imported mesh)
        self.liquid = None          # (Mesh of the container's inside, liquid.info(...)): a node of its own for Godot's shader
        self.sockets = {}           # name -> (point, direction) at rest, metres: empties in the glb (socket_flame, socket_steam...)
        self.fx = {}                # the enhancers Godot's HSPropFX gives it: glow, flame, smoke, steam, wax (PROPGEN.md §14)
        self.anchor = None          # a point of the made thing (metres) that stays at x = y = 0 when it's set down: a tree's trunk
        self.keep_z = False         # its heights as made (the floor at z = 0 already: a blanket on a bed, clear of the floor)
        self.reach = None           # the bake's reach and cage for this thing (a family's own, where the recipe gives none:
        self.cage = None            # set here, not in the recipe, so a made prop's recipe stays the recipe it was made from)
        self.bake_ao = True         # off for a thing whose texture tiles over itself (a tree's bark): a bake over it would be a jumble
        self.tree = None            # what a tree family records about its growth (meta.json's "tree")
        self.pieces = {}            # name -> (f0, f1): a named run of th.low's faces as assemble() joined them (a lid, a door)
        self.parts = {}             # name -> {piece, kind, pivot, axis, open, shut, built}: a piece that moves in play (PROPGEN §26)
        self.inside = None          # a container's inner box ((x0, y0, z0), (x1, y1, z1)) metres, built space: where things go in it
        self.extras = {}            # more for the glb's root node, by name: `propgen_<name>` (a book's page materials, PROPGEN §26)
        self.ao_dist = None         # the occlusion's reach (metres) where the recipe gives none: a family's own for its size
        self.record = {}            # more for meta.json, by name (the retro pack's fixes and layouts, PROPGEN §29)
        self.after_wear = None      # fn(material name, canvas): after the wear is laid (the retro pack's colour floor)

    def material(self, name, kind="paint", px=None, alpha=False, double=False, color="#808080", rough=0.5, metal=0.0, specular=None,
                 bake=True):
        """bake=False: no detail baked onto it (parts the same in both meshes sharing one island: a curtain's rod, its
        rings and brackets, whose overlapping maps a bake would scramble); its normal from its paint's relief alone."""
        self.mats[name] = dict(kind=kind, px=px or int(self.spec.get("tex", 1024)), alpha=alpha, double=double,
                               color=color, rough=rough, metal=metal, specular=specular, bake=bake)

    def island(self, name, w_mm, h_mm, mat="main", wrap=False):
        self.islands[name] = M.Island(name, w_mm, h_mm, mat)
        if wrap:
            self.wrap.add(name)
        return self.islands[name]

    def pack(self, margin=6):
        """Every material's islands into its texture at one density (pixels a mm), the most that fits."""
        for mname, mat in self.mats.items():
            items = sorted([i for i in self.islands.values() if i.mat == mname], key=lambda i: (-i.h_mm, -i.w_mm, i.name))
            if not items:
                continue
            px = mat["px"]

            def fits(d):
                x = y = sh = 0.0
                out = []
                for it in items:
                    w, h = it.w_mm * d + 2 * margin, it.h_mm * d + 2 * margin
                    if w > px:
                        return None
                    if x + w > px:
                        y += sh
                        x, sh = 0.0, 0.0
                    if y + h > px:
                        return None
                    out.append((it, x, y))
                    x += w
                    sh = max(sh, h)
                return out

            lo, hi = 1e-3, 200.0
            for _ in range(50):
                mid = math.sqrt(lo * hi)
                lo, hi = (mid, hi) if fits(mid) else (lo, mid)
            d = lo * 0.999
            for it, x, y in fits(d):
                x0, y0 = x + margin, y + margin
                x1, y1 = x0 + it.w_mm * d, y0 + it.h_mm * d
                it.rect = (x0 / px, 1 - y1 / px, x1 / px, 1 - y0 / px)
            self.density[mname] = d

    def assemble(self, low, high=None, mats=None):
        """th.low (and th.high) joined from named pieces [(name, Mesh), ...] in order, each piece's run of faces
        remembered by name (`pieces`), so a part (`part`) can be cut out again at the export as a node of its own.
        A deformation after this moves vertices only, so the runs stay right."""
        out = []
        at = 0
        for nm, m in low:
            if m is None or not len(m.v):
                continue
            self.pieces[nm] = (at, at + len(m.f))
            at += len(m.f)
            out.append(m)
        self.low = M.join(out, mats)
        if high is not None:
            self.high = M.join([m for _, m in high if m is not None and len(m.v)], mats)
        return self.low

    def part(self, name, pivot, axis, kind="hinge", open=100.0, shut=0.0, built=None, piece=None, **extra):
        """A piece that moves in play (PROPGEN §26): the piece named `piece` (or `name`) leaves the glb as a child node
        of its own, its origin at `pivot` (metres, the built space), carrying `propgen_part` extras: `kind` hinge (its
        `axis` the hinge line, `open` and `shut` in degrees) or slide (`axis` the way it slides, `open` and `shut` in
        metres), `show` (seen only while the thing is open: a book's spread) or `hide` (seen only while it's shut: the
        closed book's block), and `built`, the state it's built and exported in (open unless said: a suitcase is built
        with its lid up; a closet with its doors shut, built=0). The runtime swings or slides it from `built` to the
        state the story wants. A positive hinge angle turns the piece about `axis` by the right hand. `extra` goes out
        with it (`hide_open`: a hinged cover hidden once fully open, under the spread that takes its place)."""
        a = np.asarray(axis, float)
        a = a / max(float(np.linalg.norm(a)), 1e-12)
        self.parts[name] = dict(piece=piece or name, kind=kind, pivot=tuple(float(x) for x in pivot), axis=tuple(float(x) for x in a),
                                open=float(open), shut=float(shut), built=float(open if built is None else built), extra=dict(extra))


def write_tscn(odir, name, fx, liquid):
    """<name>.tscn beside the glb: a Godot scene of the prop ready to drop into a level, its enhancers (HSPropFX) and its
    liquid's slosh (HSLiquidFill) on it, each a node to switch off or delete. The glb is named by a path relative to the
    scene, so the two move together into any project with the HorrorStudio Look plugin."""
    ext = [f'[ext_resource type="PackedScene" path="{name}.glb" id="1_glb"]']
    nodes = [f'[node name="{name}" instance=ExtResource("1_glb")]']
    if fx:
        ext.append('[ext_resource type="Script" path="res://addons/horrorstudio_look/nodes/prop_fx.gd" id="2_fx"]')
        nodes.append('[node name="HSPropFX" type="Node3D" parent="."]\nscript = ExtResource("2_fx")')
    if liquid:
        ext.append('[ext_resource type="Script" path="res://addons/horrorstudio_look/nodes/liquid_fill.gd" id="3_liq"]')
        nodes.append(f'[node name="HSLiquidFill" type="Node" parent="{name}_liquid"]\nscript = ExtResource("3_liq")')
    path = os.path.join(odir, name + ".tscn")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(f"[gd_scene load_steps={len(ext) + 1} format=3]\n\n" + "\n".join(ext) + "\n\n" + "\n\n".join(nodes) + "\n")
    return path


def lay_extras(spec, th, frames):
    """What every family takes over its own paint: a PBR set (`lay_pbr`), then your pictures (`lay_pictures`). The
    prop's own pictures (`pictures`) are its paint's, by Frame.slot."""
    lay_pbr(spec, th, frames)
    lay_pictures(spec, th, frames)


def lay_pbr(spec, th, frames):
    """A PBR set off the shelf on a material's islands (`pbr`: {material or "*": "pbr/<set>" or {set, tile (metres a
    repeat), rot, tint, alpha, normal, islands: [names]}})."""
    for mname, ps in (spec.get("pbr") or {}).items():
        ps = ps if isinstance(ps, dict) else {"set": ps}
        only = ps.get("islands")
        for iname, isl in th.islands.items():
            if (mname == "*" or isl.mat == mname) and (not only or iname in only):
                frames[iname].pbr(ps["set"], tile=ps.get("tile"), rot=float(ps.get("rot", 0.0)), tint=ps.get("tint"),
                                  alpha=float(ps.get("alpha", 1.0)), normal_strength=float(ps.get("normal", 1.0)))


def lay_pictures(spec, th, frames):
    """Your pictures over the prop's own paint: `sheets` first (one picture over a material's whole texture, `_sheet`),
    then pictures on any island (`decals`: [{image, island, x, y (its middle, mm across and up the island; the middle
    if not given), w (mm; a third of the island), h (from the picture's shape), rot (degrees anticlockwise about its
    middle), fit, rough, metal, alpha, height}]). `fit` wraps a picture over the whole island: "stretch" to its size,
    "cover" filling it with its own shape (cut to it), "contain" all of it inside with its own shape, "width" its width
    with its own shape (centred up and down), "height" the same the other way (x and y move a cover or a contain);
    `flip`, `tint`, and as a flourish `repeat`/`corners` (`_copies`). Then `smudges` over it all (`_smudge`)."""
    for sh in spec.get("sheets") or ():
        _sheet(sh, th, frames)
    for dc in spec.get("decals") or ():
        f = frames.get(dc.get("island"))
        if f is None:
            raise ValueError(f"decal on island {dc.get('island')!r}: one of {', '.join(sorted(frames))}")
        img = P.read_image(dc["image"])
        asp = img.shape[0] / img.shape[1]
        fit = dc.get("fit")
        if fit == "stretch":
            w, h, x, y = f.W, f.H, f.W / 2, f.H / 2
        elif fit == "width":
            w, h, x, y = f.W, f.W * asp, f.W / 2, float(dc.get("y", f.H / 2))
        elif fit == "height":
            w, h, x, y = f.H / asp, f.H, float(dc.get("x", f.W / 2)), f.H / 2
        elif fit in ("cover", "contain"):
            w = (max if fit == "cover" else min)(f.W, f.H / asp)
            h, x, y = w * asp, float(dc.get("x", f.W / 2)), float(dc.get("y", f.H / 2))
        else:
            w = float(dc.get("w", f.W / 3))
            h = float(dc.get("h", w * asp))
            x, y = float(dc.get("x", f.W / 2)), float(dc.get("y", f.H / 2))
        props = dict(rough=float(dc.get("rough", 0.3)), metal=float(dc.get("metal", 0.0)), alpha=float(dc.get("alpha", 1.0)),
                     height=float(dc.get("height", 0.01)))
        if dc.get("tint"):
            img = img.copy()
            img[..., :3] *= P.rgb(dc["tint"])
        rot = 0.0 if fit else float(dc.get("rot", 0.0))
        for cx, cy, fx, fy in _copies(dc, f, x, y, w, h):
            im = img[::-1 if fy else 1, ::-1 if fx else 1]
            f.image(im, cx - w / 2, cy - h / 2, w, h, rot=rot if fx == fy else -rot, **props)
    for sm in spec.get("smudges") or ():
        _smudge(sm, th, frames)


def _sheet(sh, th, frames):
    """One picture over a material's whole texture, laid in its layout (`sheets`: [{image, mat (the material; the only
    one if not given), at: [x0, y0, x1, y1] (where the picture lies on the texture, fractions from its top left; all
    of it if not given), layout: {island: [u0, v0, u1, v1]} (each part's place on the texture when the picture was laid
    on it, as meta.json's rects: a part another make has moved still takes its own piece of it, and a part that isn't
    in it takes none; without a layout every part of the material takes what's over it now), alpha, rough, metal,
    height (the paint's own roughness, metalness and relief unless given), tint}]): your painting over the layout's
    template, each part its own piece, under the decals and smudges."""
    img = P.read_image(sh["image"])
    mats = sorted({i.mat for i in th.islands.values()})
    mat = sh.get("mat") or (mats[0] if len(mats) == 1 else None)
    if mat not in th.mats:
        raise ValueError(f"sheet on material {sh.get('mat')!r}: one of {', '.join(sorted(th.mats))}")
    x0, y0, x1, y1 = (float(v) for v in (sh.get("at") or (0.0, 0.0, 1.0, 1.0)))
    if x1 <= x0 or y1 <= y0:
        raise ValueError(f"sheet's at {sh.get('at')}: [x0, y0, x1, y1] with x1 > x0 and y1 > y0")
    lay = sh.get("layout")
    if sh.get("tint"):
        img = img.copy()
        img[..., :3] *= P.rgb(sh["tint"])
    props = {k: float(sh[k]) for k in ("rough", "metal", "height") if k in sh}
    props["alpha"] = float(sh.get("alpha", 1.0))
    for iname, isl in th.islands.items():
        if isl.mat != mat or (lay is not None and iname not in lay):
            continue
        u0, v0, u1, v1 = (float(v) for v in (lay[iname] if lay is not None else isl.rect))
        f = frames[iname]
        sx, sy = f.W / max(u1 - u0, 1e-9), f.H / max(v1 - v0, 1e-9)       # the part's mm a unit of the texture there
        # the picture's left at x0, its top at the texture's row y0 (v = 1 - y0), in the part's mm (x across, y up)
        pw, ph = (x1 - x0) * sx, (y1 - y0) * sy
        f.image(img, (x0 - u0) * sx, (1 - y0 - v0) * sy - ph, pw, ph, seam=False, **props)


def write_design(odir, name, th, spec, canvases, slots):
    """What the page's picture editor draws under your pictures, beside the maps: each material's paint (`_paint.png`:
    the family's own and its PBR set, with the pictures swapped into its own slots, before your sheets, decals and
    smudges and before the wear), and where it has pictures of its own, its paint with every one of them left out
    (`_ground.png`: what's under them, so a swap shows at once). {material: {"paint": file, "ground": file}}."""
    out = {}
    for mname, cv in canvases.items():
        f = f"{name}_{mname}_paint.png"
        P.write_png(os.path.join(odir, f), cv.col)
        out[mname] = {"paint": f}
    mats = {th.islands[s["island"]].mat for s in slots if s["island"] in th.islands}
    if mats:
        bare = {}
        for mname, mt in th.mats.items():
            cv = P.Canvas(mt["px"], mt["px"], mt["color"], mt["rough"], mt["metal"])
            cv.pictures, cv.slots = {"*": False}, None              # every slot: nothing there
            bare[mname] = cv
        fr = {n: P.Frame(bare[i.mat], i, wrap=n in th.wrap) for n, i in th.islands.items()}
        th.paint(fr)
        lay_pbr(spec, th, fr)
        for mname in sorted(mats):
            f = f"{name}_{mname}_ground.png"
            P.write_png(os.path.join(odir, f), bare[mname].col)
            out[mname]["ground"] = f
    return out


def _copies(dc, f, x, y, w, h):
    """Where a decal goes (its middle, mirrored across, mirrored up): once, flipped (`flip`); or as a flourish:
    `repeat` n copies spread along the island (`along` x or y, `gap` mm between them, else spread evenly; `mirror`
    every other one flipped), `corners` one in each corner `inset` mm in, each mirrored to face its corner."""
    fl = bool(dc.get("flip"))
    if dc.get("corners"):
        k = float(dc.get("inset", 2.0))
        return [(k + w / 2, f.H - k - h / 2, fl, False), (f.W - k - w / 2, f.H - k - h / 2, not fl, False),
                (k + w / 2, k + h / 2, fl, True), (f.W - k - w / 2, k + h / 2, not fl, True)]
    n = int(dc.get("repeat", 1))
    if n <= 1:
        return [(x, y, fl, False)]
    along = dc.get("along", "x")
    span, size = (f.W, w) if along == "x" else (f.H, h)
    gap = dc.get("gap")
    step = size + float(gap) if gap is not None else span / n
    start = (x if along == "x" else y) - step * (n - 1) / 2 if gap is not None else step / 2
    out = []
    for i in range(n):
        c = start + i * step
        m = fl != (bool(dc.get("mirror")) and i % 2 == 1)
        out.append((c, y, m, False) if along == "x" else (x, c, m, False))
    return out


def _smudge(sm, th, frames):
    """A smudge (`smudges`: [{image: "smudge/<name>" or your picture, island (or "*": any, by area), x, y (its middle,
    mm; the middle if not given), w (mm), rot (degrees), strength, blend, tint, rough, height, count (that many
    scattered at random places, turns and sizes), seed}]); a built-in smudge's blend, roughness and size are its own
    unless given."""
    from . import smudges as SM
    from .noise import rng
    img = P.read_image(sm["image"])
    base = SM.INDEX.get(sm["image"][len("smudge/"):], {}) if sm["image"].startswith("smudge/") else {}
    n = int(sm.get("count", 1))
    r = rng(int(sm.get("seed", 0)), "smudge", sm["image"], str(sm.get("island")))
    names = [sm.get("island", "*")] if sm.get("island", "*") != "*" else list(frames)
    for nm in names:
        if nm not in frames:
            raise ValueError(f"smudge on island {nm!r}: one of {', '.join(sorted(frames))}")
    areas = np.array([frames[nm].W * frames[nm].H for nm in names], float)
    for i in range(n):
        nm = names[int(r.choice(len(names), p=areas / areas.sum()))] if len(names) > 1 else names[0]
        f = frames[nm]
        w = float(sm.get("w", base.get("w", min(f.W, f.H) / 2)))
        if n > 1:
            w *= r.uniform(0.75, 1.25)
            x, y, rot = r.uniform(0, f.W), r.uniform(0, f.H), r.uniform(0, 360)
        else:
            x, y, rot = float(sm.get("x", f.W / 2)), float(sm.get("y", f.H / 2)), float(sm.get("rot", 0.0))
        f.smudge(img, x, y, w, rot=rot, strength=float(sm.get("strength", 0.8)), blend=sm.get("blend", base.get("blend", "multiply")),
                 tint=sm.get("tint"), rough=sm.get("rough", base.get("rough")), height=float(sm.get("height", 0.0)),
                 flip=bool(sm.get("flip", False)))


def families():
    from .families import FAMILIES
    return FAMILIES


def _filter_kwargs(op, kw):
    try:
        props = {p.identifier for p in op.get_rna_type().properties}
        return {k: v for k, v in kw.items() if k in props}
    except Exception:
        return kw


def export(obs, base, formats):
    """The selected objects as <base>.glb / .fbx / .obj (+ .mtl and textures beside them) / .blend."""
    import bpy
    bpy.context.view_layer.update()
    for o in bpy.context.scene.objects:
        o.select_set(False)
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    out = []
    if "glb" in formats:
        op = bpy.ops.export_scene.gltf
        op(**_filter_kwargs(op, dict(filepath=base + ".glb", export_format="GLB", use_selection=True, export_yup=True,
                                     export_apply=True, export_texcoords=True, export_normals=True, export_tangents=True,
                                     export_materials="EXPORT", export_image_format="AUTO", export_cameras=False,
                                     export_lights=False, export_animations=False, export_extras=True)))
        out.append(base + ".glb")
    if "fbx" in formats:
        op = bpy.ops.export_scene.fbx
        op(**_filter_kwargs(op, dict(filepath=base + ".fbx", use_selection=True, path_mode="COPY", embed_textures=True,
                                     apply_unit_scale=True, apply_scale_options="FBX_SCALE_UNITS", axis_forward="-Z",
                                     axis_up="Y", mesh_smooth_type="OFF", use_tspace=True, bake_anim=False)))
        out.append(base + ".fbx")
    if "obj" in formats:
        op = bpy.ops.wm.obj_export
        op(**_filter_kwargs(op, dict(filepath=base + ".obj", export_selected_objects=True, export_materials=True,
                                     path_mode="RELATIVE", forward_axis="NEGATIVE_Z", up_axis="Y", export_uv=True,
                                     export_normals=True, export_triangulated_mesh=False)))
        out.append(base + ".obj")
    if "blend" in formats:
        bpy.ops.wm.save_as_mainfile(filepath=base + ".blend", copy=True, relative_remap=True, compress=True)
        out.append(base + ".blend")
    return out


def run(name, spec, out_dir, formats=("glb",), preview=True, samples=None, gpu=False, log=print, preview_samples=None):
    """Makes the prop `name` from `spec` into out_dir/<name>/; returns its record (what meta.json holds)."""
    import bpy
    t0 = time.time()
    seed = int(spec.get("seed", 0))
    fam = families()[spec["family"]]
    th = Thing(spec)
    th.out = out_dir                                  # where it's made (the import family's kit meshes go beside it)
    th = fam.make(spec, th)
    log(f"  {name}: made ({th.low.ntris()} triangles{'; detail ' + str(th.high.ntris()) if th.high is not None else ''})")
    # set down
    pose = spec.get("pose", th.pose)
    R = D.rest_pose(th.high if th.high is not None else th.low, pose, th.axis, seed, prefer=spec.get("down", (0, 1, 0)))
    Mx, shift = D.place([th.high, th.low] + ([th.liquid[0]] if th.liquid else []), R, float(spec.get("yaw", 0)))
    if th.anchor is not None:
        # the anchor, not the middle of the bounds, over the origin (a tree stands on its trunk, its crown wherever it leans)
        a = Mx @ np.asarray(th.anchor, float) + shift
        off = np.array([a[0], a[1], shift[2] if th.keep_z else 0.0])
        for x in [th.high, th.low] + ([th.liquid[0]] if th.liquid else []):
            if x is not None:
                x.v = x.v - off
        shift = shift - off
    if th.parts:
        # set down by its box shut (a level places it by that box, PROPGEN §26): every part turned or slid to `shut`, a
        # `show` part left out, the middle of what's left over the origin and its lowest point on the floor; what a lid
        # built open adds beyond that box is the runtime's to swing
        vs = th.low.v.copy()
        keep_v = np.ones(len(vs), bool)
        for pname, pt in th.parts.items():
            if pt["piece"] not in th.pieces:
                raise ValueError(f"part {pname!r}: no piece {pt['piece']!r} (assemble() names them: {', '.join(th.pieces) or 'none'})")
            f0, f1 = th.pieces[pt["piece"]]
            fcs = th.low.f[f0:f1]
            idx = np.unique(fcs[fcs >= 0])
            d = pt["shut"] - pt["built"]
            piv = Mx @ np.asarray(pt["pivot"], float) + shift
            ax = Mx @ np.asarray(pt["axis"], float)
            if pt["kind"] == "slide":
                vs[idx] += ax * d
            elif pt["kind"] == "hinge":
                vs[idx] = (vs[idx] - piv) @ M.rodrigues(ax, d).T + piv
            elif pt["kind"] == "show":
                keep_v[idx] = False
        vs = vs[keep_v] if keep_v.any() else vs
        slo, shi = vs.min(0), vs.max(0)
        off = np.array([(slo[0] + shi[0]) / 2, (slo[1] + shi[1]) / 2, slo[2]])
        for x in [th.high, th.low] + ([th.liquid[0]] if th.liquid else []):
            if x is not None:
                x.v = x.v - off
        shift = shift - off
    # the parts' hinges and a container's inside, set down with the thing
    parts_w = {}
    for pname, pt in th.parts.items():
        if pt["piece"] not in th.pieces:
            raise ValueError(f"part {pname!r}: no piece {pt['piece']!r} (assemble() names them: {', '.join(th.pieces) or 'none'})")
        parts_w[pname] = dict(pt, pivot=tuple(float(x) for x in (Mx @ np.asarray(pt["pivot"], float) + shift)),
                              axis=tuple(float(x) for x in (Mx @ np.asarray(pt["axis"], float))))
    inside_w = None
    if th.inside is not None:
        lo_i, hi_i = (np.asarray(v, float) for v in th.inside)
        cs = np.array([[x, y, z] for x in (lo_i[0], hi_i[0]) for y in (lo_i[1], hi_i[1]) for z in (lo_i[2], hi_i[2])]) @ Mx.T + shift
        inside_w = (cs.min(0), cs.max(0))
    odir = os.path.join(out_dir, name)
    os.makedirs(odir, exist_ok=True)
    # Blender objects with stand-in materials (the bakes need materials to put their images in)
    temp = {m: S.flat_material(f"{name}_{m}_tmp", v["color"], v["rough"], v["metal"]) for m, v in th.mats.items()}
    sharp = spec.get("sharp_angle", th.sharp_angle)
    low_me = M.to_blender(th.low, name, temp, sharp_angle=sharp, weighted=spec.get("weighted", th.weighted))
    low_ob = bpy.data.objects.new(name, low_me)
    bpy.context.scene.collection.objects.link(low_ob)
    high_ob = None
    curv_hi = None
    if th.high is not None:
        high_me = M.to_blender(th.high, name + "_detail", temp, sharp_angle=sharp)
        k = BK.curvature(th.high)
        curv_hi = k
        att = high_me.color_attributes.new("curv", "FLOAT_COLOR", "POINT")
        cvals = np.zeros((len(k), 4), np.float32)
        cvals[:, 0] = np.clip(k * 0.5 + 0.5, 0, 1)
        cvals[:, 3] = 1
        att.data.foreach_set("color", cvals.ravel())
        high_ob = bpy.data.objects.new(name + "_detail", high_me)
        bpy.context.scene.collection.objects.link(high_ob)
    # paint every material's islands
    canvases, frames = {}, {}
    slots = []                                       # the prop's own pictures, as its paint names them (Frame.slot)
    for mname, mt in th.mats.items():
        cv = P.Canvas(mt["px"], mt["px"], mt["color"], mt["rough"], mt["metal"])
        cv.pictures, cv.slots = spec.get("pictures") or {}, slots
        canvases[mname] = cv
    for iname, isl in th.islands.items():
        frames[iname] = P.Frame(canvases[isl.mat], isl, wrap=iname in th.wrap)
    th.paint(frames)
    lay_pbr(spec, th, frames)
    design = write_design(odir, name, th, spec, canvases, slots)
    lay_pictures(spec, th, frames)
    log(f"  {name}: painted ({time.time() - t0:.1f}s)")
    # per-texel attributes of the game mesh, and the bakes from the detailed one
    bs = int(samples or spec.get("bake_samples", 24))
    ao = BK.bake("AO", low_ob, high_ob, px=max(v["px"] for v in th.mats.values()), samples=bs, gpu=gpu,
                 ao_dist=float(spec.get("ao_dist", th.ao_dist or 0.012)), extrude=float(spec.get("cage", th.cage or 0.003)), reach=float(spec.get("reach", th.reach or 0.012))) if th.bake_ao else {}
    nb = BK.bake("NORMAL", low_ob, high_ob, px=max(v["px"] for v in th.mats.values()), samples=4, gpu=gpu,
                 extrude=float(spec.get("cage", th.cage or 0.003)), reach=float(spec.get("reach", th.reach or 0.012))) if high_ob else {}
    cb = BK.bake("EMIT", low_ob, high_ob, px=max(v["px"] for v in th.mats.values()), samples=1, gpu=gpu, attr="curv",
                 extrude=float(spec.get("cage", th.cage or 0.003)), reach=float(spec.get("reach", th.reach or 0.012))) if high_ob else {}
    log(f"  {name}: baked ({time.time() - t0:.1f}s)")
    vn = BK.vertex_normals(th.low)
    kl = BK.curvature(th.low, vn)
    files = {}
    wspec = dict(spec.get("wear") or {})
    for mi, (mname, mt) in enumerate(th.mats.items()):
        cv = canvases[mname]
        px = mt["px"]
        wl = {**wspec, **(th.mats[mname].get("wear") or {})}
        key = f"{name}_{mname}_tmp"
        if th.texel_paint or any(wl.values()):
            # each texel's place on the thing, for the wear and a paint by place: the slow part of a big mesh, so only
            # where something reads it
            fa = None
            if th.texel_paint:
                T, B = BK.tangent_frames(th.low)
                fa = {"tan": T, "bit": B}
            tex = BK.raster(th.low, px, {"rest": th.low.a.get("rest", th.low.v), "nrm": vn, "curv": kl[:, None]}, mat=th.low.mats.index(mname),
                            face_attrs=fa)
            tex["curv"] = tex["curv"][..., 0]
        else:
            tex = {"hit": cv.used}

        def fit(a):
            if a.shape[0] == px:
                return a
            k2 = a.shape[0] // px
            return a.reshape(px, k2, px, k2, -1).mean((1, 3))

        baked = mt.get("bake", True)
        a_ao = fit(ao[key])[..., 0] if key in ao and baked else np.ones((px, px), np.float32)
        tex["ao"] = a_ao
        if key in cb and baked:
            tex["curv"] = (fit(cb[key])[..., 0] - 0.5) * 2
        if th.texel_paint:
            th.texel_paint(mname, cv, tex)
        S.wear(cv, tex, wl, mt["kind"], seed + 7 * mi, th.density.get(mname, 4.0))
        if th.after_wear:
            th.after_wear(mname, cv)                    # the family's last word on its colours (retro: no texel left black)
        det = S.combine_normals(cv.nrm, S.height_normal(cv.height, th.density.get(mname, 4.0), float(spec.get("relief", 1.0))))
        if key in nb and baked:
            base = fit(nb[key])[..., :3] * 2 - 1
            base /= np.maximum(np.linalg.norm(base, axis=-1, keepdims=True), 1e-9)
            nrm = S.combine_normals(base, det)
        else:
            nrm = det
        aomap = np.clip(a_ao, 0, 1) ** float(spec.get("ao_gamma", 0.8))
        alpha = cv.opacity if mt["alpha"] else None
        used = cv.used
        wraps = []
        for iname in [n for n in th.islands if n in th.wrap]:      # in the islands' order: a set's order changes run to run
            isl = th.islands[iname]
            if isl.mat == mname:
                u0, v0, u1, v1 = isl.rect
                wraps.append((int((1 - v1) * px), int(round(u0 * px)), int(math.ceil((1 - v0) * px)), int(round(u1 * px))))
        maps = [cv.col, cv.rough, cv.metal, nrm, aomap, cv.emit] + ([alpha] if alpha is not None else [])
        BK.bleed(maps, used, wraps)
        base_path = os.path.join(odir, f"{name}_{mname}")
        files[mname] = S.save_maps(base_path, cv, tex, nrm, aomap, alpha)
    # the enhancers: what the family gives it, then the recipe's own (`fx`: a kind false takes it away, a dict changes it)
    fx = {k: (dict(v) if isinstance(v, dict) else v) for k, v in (th.fx or {}).items()}
    for k, v in (spec.get("fx") or {}).items():
        if v is False or v is None:
            fx.pop(k, None)
        elif isinstance(v, dict) and isinstance(fx.get(k), dict):
            fx[k].update(v)
        else:
            fx[k] = v if isinstance(v, dict) else {}
    glowing = [m for m, f in files.items() if f[3]]
    if glowing:
        fx.setdefault("glow", {})["materials"] = [f"{name}_{m}" for m in glowing]
    else:
        fx.pop("glow", None)
    for k in ("flame", "smoke", "steam"):
        if k in fx:
            fx[k]["sockets"] = [s_ for s_ in fx[k].get("sockets", []) if s_ in th.sockets]
            if not fx[k]["sockets"]:
                fx.pop(k)
    if "wax" in fx:
        fx["wax"]["materials"] = [f"{name}_{m}" for m in fx["wax"].get("materials", []) if m in th.mats]
    # the real materials on the game mesh
    gl = fx.get("glow") or {}
    for i, mname in enumerate(th.low.mats):
        mt = th.mats[mname]
        pa, po, pn, pe = files[mname]
        mat = S.material(f"{name}_{mname}", pa, po, pn, mt["kind"], alpha=mt["alpha"], double_sided=mt["double"], specular=mt["specular"],
                         tint=mt.get("tint"), emission=pe, emission_strength=float(gl.get("energy", 1.0)))
        low_me.materials[i] = mat
    if high_ob is not None:
        bpy.data.objects.remove(high_ob, do_unlink=True)
    for m in temp.values():
        bpy.data.materials.remove(m)
    liq_ob = None
    if th.liquid:
        from . import liquid as LQ
        lm, ld = th.liquid
        ax = Mx @ np.array([0.0, 0.0, 1.0])
        tilt = math.acos(float(np.clip(ax[2], -1, 1)))
        h_world = float(shift[2]) + LQ.level(ld["_tab"], ld["h_min"], ld["h_max"], tilt, ld["fill"])
        plain = S.flat_material(f"{name}_liquid", ld["color"], 0.1)
        liq_me = M.to_blender(lm, name + "_liquid", {lm.mats[0]: plain})
        liq_ob = bpy.data.objects.new(name + "_liquid", liq_me)
        bpy.context.scene.collection.objects.link(liq_ob)
        # glTF is y up: Blender's (x, y, z) goes out as (x, z, -y)
        liq_ob["propgen_liquid"] = LQ.extras(ld, (ax[0], ax[2], -ax[1]), (shift[0], shift[2], -shift[1]))
        th.liquid_preview = LQ.preview_material(f"{name}_liquid_preview", ld, h_world)
    socks = []
    for sname, (sp, sd) in th.sockets.items():
        # set down with the thing, then an empty under it pointing its +Z along the socket's direction
        from mathutils import Matrix, Vector
        p = Mx @ np.asarray(sp, float) + shift
        dvec = Mx @ np.asarray(sd, float)
        em = bpy.data.objects.new(f"socket_{sname}", None)
        em.empty_display_type = "SINGLE_ARROW"
        em.empty_display_size = 0.02
        rot = Vector((0, 0, 1)).rotation_difference(Vector(dvec)).to_matrix().to_4x4()
        em.matrix_world = Matrix.Translation(Vector(p)) @ rot
        bpy.context.scene.collection.objects.link(em)
        em.parent = low_ob
        em.matrix_parent_inverse = low_ob.matrix_world.inverted()
        socks.append(em)
    if fx:
        low_ob["propgen_fx"] = json.dumps(dict(fx, version=1))
    # the parts that move: each cut out of the game mesh as a child object with its origin at its hinge (glTF is y up:
    # Blender's (x, y, z) goes out as (x, z, -y), a proper rotation, so an axis maps the same way and angles keep their sign)
    gl = lambda v: [round(float(v[0]), 5), round(float(v[2]), 5), round(-float(v[1]), 5)]

    def part_extras(pname, pt):
        return dict(pt.get("extra") or {}, name=pname, kind=pt["kind"], axis=gl(pt["axis"]), pivot=gl(pt["pivot"]), open=pt["open"], shut=pt["shut"],
                    built=pt["built"], version=1)
    part_obs = []
    if parts_w:
        keep = np.ones(len(th.low.f), bool)
        real = {mname: low_me.materials[i] for i, mname in enumerate(th.low.mats)}
        wt = spec.get("weighted", th.weighted)
        for pname, pt in parts_w.items():
            f0, f1 = th.pieces[pt["piece"]]
            sel = np.zeros(len(th.low.f), bool)
            sel[f0:f1] = True
            keep &= ~sel
            sub = M.select(th.low, sel)
            piv = np.asarray(pt["pivot"], float)
            sub.v = sub.v - piv
            if "rest" in sub.a:
                sub.a["rest"] = sub.a["rest"] - piv
            pme = M.to_blender(sub, f"{name}_{pname}", real, sharp_angle=sharp, weighted=wt)
            pob = bpy.data.objects.new(f"{name}_{pname}", pme)
            bpy.context.scene.collection.objects.link(pob)
            pob.location = tuple(piv)
            pob.parent = low_ob
            pob["propgen_part"] = json.dumps(part_extras(pname, pt))
            part_obs.append(pob)
        main = M.select(th.low, keep)
        if len(main.f):
            old_me = low_ob.data
            low_ob.data = M.to_blender(main, name, real, sharp_angle=sharp, weighted=wt)
            bpy.data.meshes.remove(old_me)
        else:                                        # every face a part's (a book: its block, cover and spread): the root an empty, the parts under it
            root = bpy.data.objects.new(name + "_root", None)
            bpy.context.scene.collection.objects.link(root)
            for kk in list(low_ob.keys()):
                root[kk] = low_ob[kk]
            for ob in part_obs + socks:
                ob.parent = root
            old_me = low_ob.data
            bpy.data.objects.remove(low_ob, do_unlink=True)
            bpy.data.meshes.remove(old_me)
            low_ob = root
            root.name = name
        low_ob["propgen_parts"] = json.dumps({n: part_extras(n, pt) for n, pt in parts_w.items()})
    if inside_w is not None:
        c0, c1 = gl(inside_w[0]), gl(inside_w[1])
        low_ob["propgen_inside"] = json.dumps([[min(a, b) for a, b in zip(c0, c1)], [max(a, b) for a, b in zip(c0, c1)]])
    for xk, xv in (th.extras or {}).items():
        low_ob["propgen_" + xk] = json.dumps(xv)
    # a part seen only open (`show`) built shut isn't in the picture, nor a `hide` part built open
    shown = [pob for pob, (pn, pt) in zip(part_obs, parts_w.items())
             if not ((pt["kind"] == "show" and pt["built"] <= pt["shut"]) or (pt["kind"] == "hide" and pt["built"] > pt["shut"]))]
    base = os.path.join(odir, name)
    outs = export([low_ob] + part_obs + ([liq_ob] if liq_ob else []) + socks, base, formats)
    if "glb" in formats:
        outs.append(write_tscn(odir, name, fx, bool(th.liquid)))
    pv = None
    if preview:
        pv = base + "_preview.png"
        from .stage import preview as render
        if liq_ob is not None:
            liq_ob.data.materials[0] = th.liquid_preview
        # Cycles draws every object in the scene: the parts not in the picture are hidden for it (an empty root isn't
        # listed: its bound box is its display size, a metre, which would push the camera back)
        for pob in part_obs:
            pob.hide_render = pob not in shown
        render(([low_ob] if low_ob.type == "MESH" else []) + shown + ([liq_ob] if liq_ob else []), pv, samples=int(preview_samples or spec.get("preview_samples", 48)), gpu=gpu,
               passes=base + "_st.png", mats=list(th.low.mats),
               ground={m: os.path.join(odir, d["ground"]) for m, d in (design or {}).items() if d.get("ground")},
               **(spec.get("view") or th.view or {}))
        for pob in part_obs:
            pob.hide_render = False
    lo, hi = th.low.bounds()
    rec_sockets = {k: [round(float(x), 5) for x in (Mx @ np.asarray(v[0], float) + shift)] for k, v in th.sockets.items()}
    rec = {"name": name, "family": spec["family"], "version": VERSION, "seed": seed, "size_m": [round(float(x), 4) for x in (hi - lo)],
           "tris": th.low.ntris(), "files": [os.path.basename(p) for p in outs], "preview": os.path.basename(pv) if pv else None,
           "textures": {m: [os.path.basename(p) for p in f if p] for m, f in files.items()}, "spec": spec,
           "secs": round(time.time() - t0, 1), "sockets": rec_sockets,
           "islands": {n: {"mat": i.mat, "mm": [round(i.w_mm, 2), round(i.h_mm, 2)], "rect": [round(float(x), 5) for x in i.rect],
                           "wrap": n in th.wrap} for n, i in th.islands.items()},
           "materials": {m: {"kind": v["kind"], "px": v["px"], "color": v["color"]} for m, v in th.mats.items()}, "fx": fx,
           "slots": slots, "design": design}
    if th.anchor is not None:
        rec["anchor"] = [round(float(x), 5) for x in (Mx @ np.asarray(th.anchor, float) + shift)]
        # its box from its origin (story metres, z up): a level places a mesh by its box (centred, on its base), so a
        # blanket made for a bed goes where its box falls over the bed's middle (docs/PROPGEN.md §21)
        rec["box_m"] = [round(float(x), 4) for x in list(lo) + list(hi)]
        if th.keep_z:
            rec["keep_z"] = True                        # its heights as made: on what it lies on, not on the floor
    if th.tree:
        rec["tree"] = th.tree
    rec.update(th.record or {})
    if parts_w:
        # the parts (story metres, z up, as the sockets): each hinge or slide, and the thing's size with every part shut
        rec["parts"] = {n: dict(pt.get("extra") or {}, kind=pt["kind"], pivot=[round(float(x), 5) for x in pt["pivot"]], axis=[round(float(x), 5) for x in pt["axis"]],
                                open=pt["open"], shut=pt["shut"], built=pt["built"]) for n, pt in parts_w.items()}
        vs = th.low.v.copy()
        keep_v = np.ones(len(vs), bool)
        for n, pt in parts_w.items():
            f0, f1 = th.pieces[pt["piece"]]
            fcs = th.low.f[f0:f1]
            idx = np.unique(fcs[fcs >= 0])
            d = pt["shut"] - pt["built"]
            if pt["kind"] == "slide":
                vs[idx] += np.asarray(pt["axis"], float) * d
            elif pt["kind"] == "hinge":
                piv = np.asarray(pt["pivot"], float)
                vs[idx] = (vs[idx] - piv) @ M.rodrigues(pt["axis"], d).T + piv
            elif pt["kind"] == "show":                   # not there shut
                keep_v[idx] = False
        vs = vs[keep_v] if keep_v.any() else vs
        slo, shi = vs.min(0), vs.max(0)
        rec["size_shut_m"] = [round(float(x), 4) for x in (shi - slo)]
        rec["box_shut_m"] = [round(float(x), 4) for x in list(slo) + list(shi)]
    if inside_w is not None:
        rec["inside_m"] = [round(float(x), 4) for x in list(inside_w[0]) + list(inside_w[1])]
    with open(os.path.join(odir, "meta.json"), "w", encoding="utf-8") as fh:
        json.dump(rec, fh, indent=1)
    if th.liquid:
        rec["liquid"] = {k: th.liquid[1][k] for k in ("kind", "fill", "color", "clarity")}
        with open(os.path.join(odir, "meta.json"), "w", encoding="utf-8") as fh:
            json.dump(rec, fh, indent=1)
    log(f"  {name}: done in {rec['secs']}s -> {odir}")
    bpy.data.objects.remove(low_ob, do_unlink=True)
    if liq_ob is not None:
        bpy.data.objects.remove(liq_ob, do_unlink=True)
    for em in socks:
        bpy.data.objects.remove(em, do_unlink=True)
    for pob in part_obs:
        bpy.data.objects.remove(pob, do_unlink=True)
    return rec
