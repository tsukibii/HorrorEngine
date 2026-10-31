"""Run inside Blender (or with Blender's Python module): tools/street.py starts it.

    main.py look --glb G --out DIR --shot JSON [--book finish.json] [--density 32] [--samples 64] [--height 900]
            [--time dusk] [--no-render] [--blend]
"""
import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import bpy  # noqa: E402
import numpy as np  # noqa: E402

from streetbake import export as X  # noqa: E402
from streetbake import tiles as T  # noqa: E402
from streetbake import scene as S  # noqa: E402
from streetbake import wear as Wr  # noqa: E402


def args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    a = argparse.ArgumentParser()
    a.add_argument("cmd")
    a.add_argument("--glb", required=True)
    a.add_argument("--out", required=True)
    a.add_argument("--name", default="street")
    a.add_argument("--shot", default=None)
    a.add_argument("--book", default=None)
    a.add_argument("--density", type=float, default=24)
    a.add_argument("--samples", type=int, default=64)
    a.add_argument("--height", type=int, default=900)
    a.add_argument("--time", default="dusk")
    a.add_argument("--no-render", action="store_true")
    a.add_argument("--prefix", default="look_")
    a.add_argument("--blend", action="store_true")
    a.add_argument("--bake-samples", type=int, default=8)
    a.add_argument("--reuse-wear", action="store_true", help="the wear atlas already made (its layout is made again)")
    a.add_argument("--tile-px", type=int, default=1024)
    a.add_argument("--force-tiles", action="store_true")
    a.add_argument("--tiles-only", default=None, help="finishes to bake onto the shelf, comma-separated, and stop")
    return a.parse_args(argv)


def say(*a):
    print(*a, flush=True)


def wear_atlas(vis, book, out, name, density, samples, reuse=False):
    t0 = time.time()
    fin = lambda m: S.finish_of(m, book)  # noqa: E731
    P = Wr.patches(vis, fin)
    W, H, d = Wr.pack(P, density)
    Wr.write_uvs(P, W, H, d)
    say(f"WEAR layout: {len(P)} patches into {W} x {H} at {d:.1f} px/m ({time.time() - t0:.1f} s)")
    path = Path(out) / f"{name}_wear.png"
    if reuse and path.is_file():
        img = bpy.data.images.load(str(path))
        img.name = name + "_wear"
        img.colorspace_settings.name = "Non-Color"
        if tuple(img.size) == (W, H):
            say(f"WEAR atlas: {path} (as made before)")
            return img
        bpy.data.images.remove(img)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    t1 = time.time()
    decals = [o for o in vis if Wr.is_decal(o)]
    rest = [o for o in vis if not Wr.is_decal(o)]
    J = Wr.joined(rest)
    Jd = Wr.joined(decals) if decals else None
    imgs = {k: Wr.float_image("_" + k, W, H) for k in ("pos", "nrm", "ao")}
    for jj, first in ((J, True), (Jd, False)):
        if jj is None:
            continue
        pos = Wr.bake(jj, imgs["pos"], "position", 1, 0, clear=first)
        nrm = Wr.bake(jj, imgs["nrm"], "normal", 1, 0, clear=first)
        aoc = Wr.bake(jj, imgs["ao"], "ao", samples, 3, clear=first, hide=Jd if jj is J else None)
    say(f"WEAR bakes: position, normal, occlusion and edges, {len(decals)} road markings apart ({time.time() - t1:.1f} s)")
    Wr.unjoin(J, rest)
    if Jd is not None:
        Wr.unjoin(Jd, decals)
    t2 = time.time()
    cov = pos[..., 3] > 0.5
    G = Wr.ground_map(vis)
    dens = Wr.density_map(P, W, H, d)
    a = Wr.compute(pos, nrm, aoc, cov, dens, G, amount=book.get("wear"))
    a = Wr.bleed(a, cov)
    img = bpy.data.images.get(name + "_wear") or bpy.data.images.new(name + "_wear", W, H, alpha=True)
    img.colorspace_settings.name = "Non-Color"
    img.pixels.foreach_set(np.clip(a, 0, 1).ravel())
    img.filepath_raw = str(Path(out) / f"{name}_wear.png")
    img.file_format = "PNG"
    img.save()
    for nm in ("_pos", "_nrm", "_ao"):
        bpy.data.images.remove(bpy.data.images[nm])
    m = bpy.data.materials.get("_wearbake")
    if m:
        bpy.data.materials.remove(m)
    say(f"WEAR atlas: {img.filepath_raw} ({time.time() - t2:.1f} s): occlusion {a[cov, 0].mean():.2f}, dirt {a[cov, 1].mean():.2f}, "
        f"streaks or wet {a[cov, 2].mean():.2f}, edges {a[cov, 3].mean():.2f}")
    return img


def materials(vis, book, wear_img):
    done, kinds = set(), {}
    for o in vis:
        for s in o.material_slots:
            m = s.material
            if m and m.name not in done:
                done.add(m.name)
                k = S.rebuild(m, book, wear_img)
                kinds[k] = kinds.get(k, 0) + 1
    say("MATERIALS " + ", ".join(f"{k} {n}" for k, n in sorted(kinds.items())))


def look(a, keep=False):
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    book = S.load_book(a.book)
    vis, cols = S.load(a.glb)
    say(f"STREET {a.name}: {len(vis)} meshes, {sum(len(o.data.polygons) for o in vis)} triangles")
    wear_img = wear_atlas(vis, book, out, a.name, float(book.get("density", a.density)), a.bake_samples, a.reuse_wear)
    materials(vis, book, wear_img)
    S.world(a.time)
    S.lamps(a.time)
    S.render_settings(a.samples)
    if a.shot:
        shots = json.loads(Path(a.shot).read_text(encoding="utf-8")) if Path(a.shot).is_file() else json.loads(a.shot)
        for shot in (shots if isinstance(shots, list) else [shots]):
            S.camera(shot, a.height)
            if not a.no_render:
                t = time.time()
                sc = bpy.context.scene
                sc.render.filepath = str(out / f"{a.prefix}{shot.get('id', 'shot')}.png")
                sc.render.image_settings.file_format = "PNG"
                bpy.ops.render.render(write_still=True)
                say(f"RENDER {sc.render.filepath} ({time.time() - t:.0f} s, {a.samples} samples)")
    if a.blend and not keep:
        bpy.ops.wm.save_as_mainfile(filepath=str(out / f"{a.name}.blend"), relative_remap=True)
        say(f"BLEND {out / (a.name + '.blend')}")
    return vis, book, wear_img


def bake(a):
    """The look, then the finishes' sets on the shelf, the materials made plain glTF, the .glb and the .blend."""
    out = Path(a.out)
    vis, book, wear_img = look(a, keep=True)
    used = sorted({i["finish"] for i in S.INFO.values()})
    t = time.time()
    made = T.ensure([f for f in used if not f.startswith("pbr/") and f not in ("glow", "image")], a.tile_px, 4, a.force_tiles, say)
    say(f"TILES {len(made)} made, {len(used)} finishes in use ({time.time() - t:.0f} s)")
    kept = X.glyph_images(vis, S.INFO, out)
    roofs = {n for n, i in S.INFO.items() if i["finish"] in ("roof_tiles", "roof_sheet")}
    say(f"ROOFS {X.fix_roof_uvs(vis, roofs)} faces turned so the ribs run down the slope")
    kinds = {}
    done = set()
    for o in vis:
        for s in o.material_slots:
            m = s.material
            if m and m.name not in done and m.name in S.INFO:
                done.add(m.name)
                k = X.material(m, S.INFO[m.name], book, wear_img, kept)
                kinds[k] = kinds.get(k, 0) + 1
    say("EXPORT MATERIALS " + ", ".join(f"{k} {n}" for k, n in sorted(kinds.items())))
    X.tidy_uvs(vis)
    X.lamps_for_export()
    n = keep_dressing(out / f"{a.name}.blend")
    if n:
        say(f"DRESSING {n} things of yours kept from the last bake's Foliage collection")
    glb = out / f"{a.name}.glb"
    X.export_glb(glb)
    say("GLB " + str(glb) + " " + json.dumps(X.report(glb)))
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(out / f"{a.name}.blend"), compress=True)
    say(f"BLEND {out / (a.name + '.blend')} (its pictures packed in: drop it into a Godot project as it is)")


def keep_dressing(path):
    """What you added in the last bake's .blend (its Foliage collection: trees, props, their colliders) brought into
    this one, so baking the street again never loses it."""
    if not path.is_file():
        return 0
    with bpy.data.libraries.load(str(path), link=False) as (src, dst):
        dst.collections = [c for c in src.collections if c == "Foliage"]
    mine = bpy.data.collections["Foliage"]
    n = 0
    for c in dst.collections:
        if c is None or c == mine:
            continue
        for o in list(c.all_objects):
            if o.name not in mine.objects:
                mine.objects.link(o)
                n += 1
        bpy.data.collections.remove(c)
    # all of it ours now: nothing left pointing at the old file (it is about to be written over)
    for attr in dir(bpy.data):
        coll = getattr(bpy.data, attr, None)
        if isinstance(coll, bpy.types.bpy_prop_collection) and attr != "libraries":
            for idb in list(coll):
                if isinstance(idb, bpy.types.ID) and idb.library is not None:
                    idb.make_local()
    for lib in list(bpy.data.libraries):
        bpy.data.libraries.remove(lib)
    return n


def tiles_only(a):
    for f in a.tiles_only.split(","):
        T.bake_set(f.strip(), a.tile_px, 4, say)


if __name__ == "__main__":
    import os
    a = args()
    if a.tiles_only:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        tiles_only(a)
    else:
        {"look": look, "bake": bake}[a.cmd](a)
    sys.stdout.flush()
    os._exit(0)                                     # Blender's module can crash on its way out
