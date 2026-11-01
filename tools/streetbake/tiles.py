"""A finish baked once into a tileable texture set on the PBR shelf (assets/pbr/Procedural/<finish>/, docs/ASSETS.md §6):
its colour (a tint, white-based: a street multiplies it by each surface's own colour; alpha where it has holes, as
worn paint), its normal (OpenGL's, as glTF and Godot read it), its roughness, and an ORM map (R a cavity occlusion
from its relief, G roughness, B metalness: glTF's metallic-roughness map), one period of its noise on a side, so it
repeats without a seam. Any street then uses it at its real size (meta.json's tile_m), like a set of your own."""
import json
import sys
from pathlib import Path

import bpy
import numpy as np

from . import finishes as F
from . import library as LIB
from .nodes import NB

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "Content" / "Python"))
from storykit import pbr as PBR  # noqa: E402

SHELF = "Procedural"


def ref_of(finish):
    return f"pbr/{SHELF}/{finish}"


def set_dir(finish):
    return PBR.ROOT / SHELF / finish


def stamp(finish=None):
    """What a set is made from: the finishes' code, and the library's for its sets (a set older than it is made again)."""
    files = ("finishes.py", "nodes.py", "tiles.py", "library.py", "fabrics.py")    # the library's imperfections wear the finishes too
    return int(max((Path(__file__).parent / f).stat().st_mtime for f in files))


def is_fresh(finish, px):
    d = set_dir(finish)
    m = d / "procedural.json"
    if not m.is_file():
        return False
    j = json.loads(m.read_text(encoding="utf-8"))
    return j.get("made_from", 0) >= stamp(finish) and j.get("px", 0) >= px and all((d / f"{finish}_{k}.png").is_file() for k in ("albedo", "normal", "orm", "height"))


def _plane(P):
    pu, pv = P
    me = bpy.data.meshes.new("_tile")
    me.from_pydata([(0, 0, 0), (pu, 0, 0), (pu, pv, 0), (0, pv, 0)], [], [(0, 1, 2, 3)])
    uv = me.uv_layers.new(name="UVMap")
    for i, c in enumerate([(0, 0), (pu, 0), (pu, pv), (0, pv)]):
        uv.data[i].uv = c
    bk = me.uv_layers.new(name="Bake")
    for i, c in enumerate([(0, 0), (1, 0), (1, 1), (0, 1)]):
        bk.data[i].uv = c
    o = bpy.data.objects.new("_tile", me)
    bpy.context.scene.collection.objects.link(o)
    return o


def _material(finish, what, img):
    """The finish read in metres, emitting `what` (or lit, with its bump, for the normal) into img through 'Bake'."""
    m = bpy.data.materials.new("_tile_" + what)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    nb = NB(nt)
    out = nb.node("ShaderNodeOutputMaterial")
    g = nb.group(F.finish_group(finish), UV=nb.uv("UVMap"), Color=(1, 1, 1, 1))
    if what == "normal":
        bs = nb.node("ShaderNodeBsdfPrincipled")
        bump = nb.node("ShaderNodeBump")
        nb.put(0.6 if finish not in LIB.RELIEF else 1.0, bump.inputs["Strength"])
        nb.put(LIB.RELIEF.get(finish, 0.004), bump.inputs["Distance"])          # the relief its height stands for
        nb.put(g.outputs["Height"], bump.inputs["Height"])
        nb.put(bump.outputs[0], bs.inputs["Normal"])
        nt.links.new(bs.outputs[0], out.inputs["Surface"])
    else:
        em = nb.node("ShaderNodeEmission")
        if what == "albedo":
            c = g.outputs["Color"]
        elif what == "alpha":
            c = g.outputs["Alpha"]
        elif what == "height":
            c = g.outputs["Height"]
        else:                                           # ORM: a cavity from the relief, roughness, metalness
            cav = nb.ramp(g.outputs["Height"], -0.6, 0.4, (0.55, 1.0))
            c = nb.comb(cav, g.outputs["Roughness"], g.outputs["Metallic"])
        nb.put(c, em.inputs["Color"])
        nt.links.new(em.outputs[0], out.inputs["Surface"])
    t = nb.node("ShaderNodeTexImage", image=img)
    nb.put(nb.uv("Bake"), t.inputs["Vector"])
    nt.nodes.active = t
    return m


def bake_set(finish, px=1024, samples=4, say=print):
    """Bakes one finish onto the shelf; its folder."""
    P = F.PERIOD.get(finish, (2.0, 2.0))
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    o = _plane(P)
    for oo in bpy.context.scene.objects:
        oo.select_set(False)
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    o.data.uv_layers.active = o.data.uv_layers["Bake"]
    d = set_dir(finish)
    d.mkdir(parents=True, exist_ok=True)
    W = px
    H = max(64, int(round(px * P[1] / P[0])))
    got = {}
    for what in ("albedo", "alpha", "orm", "normal", "height"):
        img = bpy.data.images.new(f"_{finish}_{what}", W, H, alpha=False, float_buffer=what != "albedo")
        if what in ("orm", "normal", "alpha", "height"):
            img.colorspace_settings.name = "Non-Color"
        m = _material(finish, what, img)
        o.data.materials.clear()
        o.data.materials.append(m)
        if what == "normal":
            bpy.ops.object.bake(type="NORMAL", normal_space="TANGENT", margin=0, use_clear=True, uv_layer="Bake")
        else:
            bpy.ops.object.bake(type="EMIT", margin=0, use_clear=True, uv_layer="Bake")
        a = np.empty(W * H * 4, np.float32)
        img.pixels.foreach_get(a)
        got[what] = (img, a.reshape(H, W, 4))
        bpy.data.materials.remove(m)
    # the colour's alpha is the finish's own (worn paint's holes)
    alb_img, alb = got["albedo"]
    alpha = got["alpha"][1][..., 0]
    rgba = alb.copy()
    rgba[..., 3] = np.clip(alpha, 0, 1)
    out = bpy.data.images.new(f"{finish}_albedo", W, H, alpha=True)
    out.pixels.foreach_set(np.clip(rgba, 0, 1).ravel())
    _save(out, d / f"{finish}_albedo.png")
    if float(alpha.min()) < 0.98:                                    # holes (a net's): an opacity map of their own, for the cut-outs
        oa = np.clip(alpha, 0, 1)
        o5 = bpy.data.images.new(f"{finish}_opacity", W, H, alpha=False)
        o5.colorspace_settings.name = "Non-Color"
        o5.pixels.foreach_set(np.dstack([oa, oa, oa, np.ones_like(oa)]).ravel())
        _save(o5, d / f"{finish}_opacity.png")
    for what, cs in (("normal", "Non-Color"), ("orm", "Non-Color")):
        im, a = got[what]
        o2 = bpy.data.images.new(f"{finish}_{what}", W, H, alpha=False)
        o2.colorspace_settings.name = cs
        o2.pixels.foreach_set(np.clip(a, 0, 1).ravel())
        _save(o2, d / f"{finish}_{what}.png")
        if what == "orm":                                # the shelf's own map words: roughness and ao on their own
            for k, ch in (("roughness", 1), ("ao", 0)):
                g = np.repeat(a[..., ch:ch + 1], 3, 2)
                o3 = bpy.data.images.new(f"{finish}_{k}", W, H, alpha=False)
                o3.colorspace_settings.name = "Non-Color"
                o3.pixels.foreach_set(np.clip(np.concatenate([g, np.ones_like(g[..., :1])], 2), 0, 1).ravel())
                _save(o3, d / f"{finish}_{k}.png")
    hm = got["height"][1][..., 0]                                     # the height map: its own range onto 0..1, its relief kept
    lo, hi = float(hm.min()), float(hm.max())
    hn = (hm - lo) / max(hi - lo, 1e-6)
    o4 = bpy.data.images.new(f"{finish}_height", W, H, alpha=False)
    o4.colorspace_settings.name = "Non-Color"
    o4.pixels.foreach_set(np.dstack([hn, hn, hn, np.ones_like(hn)]).ravel())
    _save(o4, d / f"{finish}_height.png")
    relief = (hi - lo) * LIB.RELIEF.get(finish, 0.004)                  # metres from its lowest to its highest
    for k in list(got):
        bpy.data.images.remove(got[k][0])
    me = o.data
    bpy.data.objects.remove(o)
    bpy.data.meshes.remove(me)
    # the shelf's own meta.json (what a shelf scan keeps), and ours beside it (a scan rewrites meta.json)
    lib = finish in LIB.LIB                                          # the library's: its own colours, not a tint
    fab = finish in LIB.FABRICS.LIB                                 # a fabric for the Studio's clothes (fabrics.py): a tint unless its colour is in its threads
    meta = {"tile_m": round(P[0], 4), "source": "procedural: " + ("tools/fabric_bake.py (tools/streetbake/fabrics.py)" if fab else "tools/street.py " + ("library (tools/streetbake/library.py)" if lib else "finishes (tools/streetbake/finishes.py)")),
            "url": "", "licence": "CC0-1.0",
            "note": f"the street material '{finish}' baked from Blender's nodes" + ("" if lib else "; its colour is a tint for a surface's own colour")}
    if lib:
        meta.update(LIB.meta(finish), tint=False)
    if fab:
        meta.update(LIB.FABRICS.meta(finish), note=f"the fabric '{finish}' baked from Blender's nodes at its real size" + ("; its colour is a tint for the garment's own" if LIB.FABRICS.LIB[finish][5] else "; its colours are its threads'"))
    (d / "meta.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False), encoding="utf-8")
    (d / "procedural.json").write_text(json.dumps({"finish": finish, "tint": LIB.FABRICS.LIB[finish][5] if fab else not lib, "tile_v_m": round(P[1], 4), "px": px, "height_m": round(relief, 5),
                                                   "made_from": stamp(finish)}, indent=1), encoding="utf-8")
    say(f"TILE {finish}: {W} x {H} for {P[0]:g} x {P[1]:g} m ({px / P[0]:.0f} px/m) -> {d.relative_to(ROOT) if d.is_relative_to(ROOT) else d}")
    return d


def _save(img, path):
    img.filepath_raw = str(path)
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)


def ensure(finishes, px=1024, samples=4, force=False, say=print):
    """Every finish's set on the shelf, made (or made again) when missing or older than the code."""
    made = []
    for f in sorted(set(finishes)):
        if f not in F.BUILD or f in ("plain",):
            continue
        if force or not is_fresh(f, px):
            bake_set(f, px, samples, say)
            made.append(f)
    return made


def maps(ref):
    """(folder, meta) of a shelf set: a procedural finish's or one of your own (pbr/<name>)."""
    d = PBR.set_dir(ref)
    m = PBR.meta(d) if d.is_dir() else None
    if m is None:
        return None, None
    for j in (PBR.meta_file(d), d / "procedural.json"):       # a set of your own can say `tint` in its meta.json (an attached folder's: its mirror)
        if j.is_file():
            extra = json.loads(j.read_text(encoding="utf-8"))
            for k in ("tint", "tile_v_m"):
                if k in extra:
                    m[k] = extra[k]
    orm = d / f"{d.name}_orm.png"
    if orm.is_file():
        m["orm"] = orm.name
    return d, m


def size_of(m):
    t = float(m.get("tile_m") or 2.0)
    return t, float(m.get("tile_v_m") or t)

