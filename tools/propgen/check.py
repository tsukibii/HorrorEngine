"""PROPGEN: a recipe of every family made small (256 px textures, a few bake samples, no preview, the .glb alone) and
measured: its glb well formed with a material of three textures (base colour, ORM, normal), standing on the floor and
centred, about its real size, within its triangle budget, its colour map not one flat colour, its normal map facing
out; its enhancers in the glb's extras and an emission map where it glows; its Godot scene (.tscn) beside it; the
same recipe made twice the same mesh; every recipe's family and design known."""
import json
import math
import os
import struct
import time

import numpy as np

from . import build, designs, recipes
from .paint import read_image

# a recipe per family: (its longest side in mm, roughly; the most triangles its game mesh may have)
CASES = {"soda_can": (115, 6000), "soda_can_crushed": (125, 14000), "water_bottle": (205, 16000), "coffee_cup": (117, 9000),
         "paper_ball": (90, 14000), "burger_box": (140, 2000), "chair_worn": (900, 2000), "spoon": (200, 4000),
         "key_brass": (60, 3000), "rice_bowl": (117, 8000), "cig_butts": (150, 8000), "trash_bag": (560, 10000),
         "soy_bottle": (120, 9000), "pill_bottle": (90, 14000), "candle_taper": (330, 13000),
         "ema": (160, 6000), "shimenawa": (900, 10000), "wara_ningyo": (270, 8000), "hokora": (560, 8000), "tetsubin": (180, 12000),
         "rice_cooker": (330, 8000), "kitchen_sink_water": (920, 14000), "book_hardcover": (215, 4000), "diary_open": (360, 4000),
         "books_cubby": (420, 16000)}


def _glb(path):
    d = open(path, "rb").read()
    n = struct.unpack("<I", d[12:16])[0]
    j = json.loads(d[20:20 + n])
    bin0 = 20 + n + 8
    return j, d[bin0:]


def _positions(j, binc):
    out = []
    for m in j["meshes"]:
        for p in m["primitives"]:
            a = j["accessors"][p["attributes"]["POSITION"]]
            bv = j["bufferViews"][a["bufferView"]]
            off = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
            out.append(np.frombuffer(binc[off:off + a["count"] * 12], np.float32).reshape(-1, 3))
    return np.concatenate(out)


def _triangles(j, binc):
    """Every primitive's triangles as one soup: positions (n, 3), index triples (m, 3) and each triangle's material's
    doubleSided."""
    P, T, D, off = [], [], [], 0
    for m in j["meshes"]:
        for p in m["primitives"]:
            a = j["accessors"][p["attributes"]["POSITION"]]
            bv = j["bufferViews"][a["bufferView"]]
            o = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
            P.append(np.frombuffer(binc[o:o + a["count"] * 12], np.float32).reshape(-1, 3).astype(float))
            ia = j["accessors"][p["indices"]]
            ib = j["bufferViews"][ia["bufferView"]]
            dt = {5125: np.uint32, 5123: np.uint16, 5121: np.uint8}[ia["componentType"]]
            io = ib.get("byteOffset", 0) + ia.get("byteOffset", 0)
            t = np.frombuffer(binc[io:io + ia["count"] * np.dtype(dt).itemsize], dt).reshape(-1, 3).astype(np.int64)
            T.append(t + off)
            D.append(np.full(len(t), bool(j["materials"][p.get("material", 0)].get("doubleSided")) if j.get("materials") else False))
            off += a["count"]
    return np.concatenate(P), np.concatenate(T), np.concatenate(D)


def orientation(path, dirs=26, grid=40):
    """Which way a made prop's faces look, as the game sees them: Godot draws only a face's front, so a part turned
    inside out is see-through from outside (Cycles' previews draw both sides and hide it: LESSONS 2026-10-31). Rays from
    `dirs` directions all round, a `grid` of them each across the prop; `back` the share of what they first hit that is
    a face's back (double-sided materials left out: both their sides are drawn). `mixed` the edges whose two faces
    disagree on which side is out (one walks the edge the way the other does), the mesh welded by position."""
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    j, binc = _glb(path)
    P, T, D = _triangles(j, binc)
    tree = BVHTree.FromPolygons([Vector(p) for p in P], T.tolist(), all_triangles=True, epsilon=0.0)
    lo, hi = P.min(0), P.max(0)
    c, R = (lo + hi) / 2, float(np.linalg.norm(hi - lo)) / 2 + 1e-6
    k = np.arange(dirs) + 0.5
    phi, th = np.arccos(1 - 2 * k / dirs), math.pi * (1 + 5 ** 0.5) * k
    hits = backs = 0
    where = {}
    for d in np.stack([np.cos(th) * np.sin(phi), np.sin(th) * np.sin(phi), np.cos(phi)], 1):
        u = np.cross(d, [0, 0, 1] if abs(d[2]) < 0.9 else [1, 0, 0])
        u /= np.linalg.norm(u)
        v = np.cross(d, u)
        dv = Vector(d)
        for x in np.linspace(-R, R, grid):
            for y in np.linspace(-R, R, grid):
                loc, nrm, fi, _ = tree.ray_cast(Vector(c - d * 2 * R + u * x + v * y), dv, 4 * R)
                if loc is None or D[fi]:
                    continue
                hits += 1
                if nrm.dot(dv) > 0:
                    backs += 1
                    where[fi] = where.get(fi, 0) + 1
    # edges two faces share, walked the same way by both
    _, w = np.unique(np.round(P * 1e6).astype(np.int64), axis=0, return_inverse=True)
    F = w.ravel()[T]
    F = F[(F[:, 0] != F[:, 1]) & (F[:, 1] != F[:, 2]) & (F[:, 0] != F[:, 2])]
    E = np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]])
    _, ek, cnt = np.unique(np.sort(E, 1), axis=0, return_inverse=True, return_counts=True)
    ek = ek.ravel()
    two = cnt[ek] == 2
    pf = (E[:, 0] < E[:, 1])[two][np.argsort(ek[two], kind="stable")].reshape(-1, 2)
    worst = sorted(where, key=where.get, reverse=True)[:3]
    return {"back": backs / max(hits, 1), "hits": hits, "mixed": int(np.sum(pf[:, 0] == pf[:, 1])),
            "at": [np.round(P[T[f]].mean(0) * 1000, 1).tolist() for f in worst]}

def pictures_case(book, tmp):
    """The picture editor's words (PROPGEN.md §17): a hardcover made with one picture over its whole texture (a sheet,
    four colours in its quarters) laid in an older layout (the front's place then the bottom right quarter, the
    spine's the top left, the back's not in it), and a bar turned 90 degrees on the back (a decal's `rot`). Its front
    takes the yellow quarter, its spine the red, the back none of it and the bar standing upright; the paint under your
    pictures (`_paint.png`) and with its own pictures left out (`_ground.png`) beside the maps, apart only in its
    pictures' boxes."""
    import bpy
    from .paint import write_png
    name = "book_hardcover"
    if name not in book:
        return [f"{name}: the check's recipe is gone from presets.json"]
    q = np.zeros((256, 256, 4), np.float32)
    q[..., 3] = 1
    q[:128, :128, :3], q[:128, 128:, :3], q[128:, :128, :3], q[128:, 128:, :3] = (1, 0, 0), (0, 1, 0), (0, 0, 1), (1, 1, 0)
    bar = np.ones((50, 200, 4), np.float32)
    bar[..., :3] = (0.9, 0.1, 0.6)
    qp, bp = os.path.join(tmp, "_sheet_quarters.png"), os.path.join(tmp, "_bar.png")
    write_png(qp, q)
    write_png(bp, bar)
    spec = recipes.resolve(book, name, sets=["tex=256"])
    spec["sheets"] = [{"image": qp, "layout": {"front": [0.6, 0.1, 0.8, 0.4], "spine": [0.0, 0.5, 0.5, 1.0]}}]
    spec["decals"] = [{"image": bp, "island": "back", "w": 80, "h": 20, "rot": 90}]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    rec = build.run("pictures_case", spec, tmp, formats=("glb",), preview=False, samples=4, log=lambda *a: None)
    d = os.path.join(tmp, "pictures_case")
    A = read_image(os.path.join(d, rec["textures"]["main"][0]))[..., :3]
    px = A.shape[0]
    isl = rec["islands"]

    def at(img, part, a, b):
        u0, v0, u1, v1 = isl[part]["rect"]
        return img[int((1 - (v0 + b * (v1 - v0))) * px), int((u0 + a * (u1 - u0)) * px)]
    problems = []
    for part, want, colour in (("front", (1, 1, 0), "yellow"), ("spine", (1, 0, 0), "red")):
        for a, b in ((0.5, 0.5), (0.25, 0.75), (0.75, 0.25)):
            if np.abs(at(A, part, a, b) - want).max() > 0.2:
                problems.append(f"the sheet's {colour} quarter isn't on the {part} at {a}, {b}: {np.round(at(A, part, a, b), 2).tolist()}")
                break
    if np.abs(at(A, "back", 0.5, 0.15) - (1, 0, 0)).max() < 0.2 or np.abs(at(A, "back", 0.5, 0.15) - (0, 0, 1)).max() < 0.2:
        problems.append("the sheet is on the back, which its layout leaves out")
    pink = lambda c: np.abs(c - (0.9, 0.1, 0.6)).max() < 0.15
    if not (pink(at(A, "back", 0.5, 0.5)) and pink(at(A, "back", 0.5, 0.75)) and not pink(at(A, "back", 0.8, 0.5))):
        problems.append("the bar turned 90 degrees isn't standing upright on the back")
    des = (rec.get("design") or {}).get("main") or {}
    if not des.get("paint") or not des.get("ground"):
        problems.append(f"no paint and ground beside the maps: {des}")
    else:
        Pn = read_image(os.path.join(d, des["paint"]))[..., :3]
        Gr = read_image(os.path.join(d, des["ground"]))[..., :3]
        inside = np.zeros(Pn.shape[:2], bool)
        for s in rec["slots"]:
            i = isl[s["island"]]
            u0, v0, u1, v1 = i["rect"]
            W, H = i["mm"]
            x0, y0, w, h = s["box"]
            inside[int((1 - (v0 + (y0 + h) / H * (v1 - v0))) * px) - 1:int((1 - (v0 + y0 / H * (v1 - v0))) * px) + 2,
                   int((u0 + x0 / W * (u1 - u0)) * px) - 1:int((u0 + (x0 + w) / W * (u1 - u0)) * px) + 2] = True
        diff = np.abs(Pn - Gr).max(-1)
        if float(diff[inside].mean()) < 0.02:
            problems.append("the paint and its ground are alike in its pictures' boxes")
        if float((diff[~inside] > 0.02).mean()) > 0.01:
            problems.append(f"the paint and its ground differ outside its pictures' boxes ({(diff[~inside] > 0.02).mean() * 100:.1f}%)")
        if np.abs(at(Pn, "front", 0.5, 0.5) - (1, 1, 0)).max() < 0.2:
            problems.append("the paint under your pictures already has the sheet")
    print(("  ok  " if not problems else "  BAD ") + "your pictures: a sheet in an older layout, a decal turned, the paint and its ground"
          + ("; " + "; ".join(problems) if problems else ""))
    return [f"pictures: {p}" for p in problems]


def run(book, out):
    t0 = time.time()
    tmp = os.path.join(out, "_check")
    os.makedirs(tmp, exist_ok=True)
    bad = []
    # every recipe resolves to a known family and design
    fams = build.families()
    for n in book:
        spec = recipes.resolve(book, n)
        if spec.get("family") not in fams:
            bad.append(f"{n}: no family {spec.get('family')!r}")
        for key in ("art", "back"):
            d = (spec.get(key) or {}).get("design")
            if d and d not in designs.DESIGNS:
                bad.append(f"{n}: no design {d!r}")
    print(f"  ok  {len(book)} recipes, each a family and design that exist" if not bad else "  BAD " + "; ".join(bad))
    import bpy
    first = None
    for name, (size_mm, budget) in CASES.items():
        if name not in book:
            bad.append(f"{name}: the check's recipe is gone from presets.json")
            continue
        spec = recipes.resolve(book, name, sets=["tex=256"])
        bpy.ops.wm.read_factory_settings(use_empty=True)
        rec = build.run(name, spec, tmp, formats=("glb",), preview=False, samples=4, log=lambda *a: None)
        glb = os.path.join(tmp, name, name + ".glb")
        problems = []
        j, binc = _glb(glb)
        mats = j.get("materials", [])
        for m in mats:
            if m.get("name", "").endswith("_liquid"):
                continue                                  # plain on purpose: Godot's liquid shader takes its place
            pbr = m.get("pbrMetallicRoughness", {})
            if "baseColorTexture" not in pbr or "metallicRoughnessTexture" not in pbr or "normalTexture" not in m:
                problems.append(f"material {m.get('name')} lacks a texture")
        pos = _positions(j, binc)
        lo, hi = pos.min(0), pos.max(0)                 # glTF: y up
        if abs(lo[1]) > 1e-4:
            problems.append(f"its lowest point at {lo[1] * 1000:.2f} mm, not on the floor")
        if abs((lo[0] + hi[0]) / 2) > 1e-3 or abs((lo[2] + hi[2]) / 2) > 1e-3:
            problems.append("not centred")
        longest = float((hi - lo).max()) * 1000
        if not (0.5 * size_mm <= longest <= 2.0 * size_mm):
            problems.append(f"{longest:.0f} mm long, against about {size_mm}")
        if rec["tris"] > budget:
            problems.append(f"{rec['tris']} triangles, over its {budget}")
        liq = [nd for nd in j["nodes"] if "propgen_liquid" in (nd.get("extras") or {})]
        if spec.get("liquid") or (spec.get("family") == "bottle" and spec.get("fill")):
            if not liq:
                problems.append("its liquid isn't in the glb")
            else:
                d = json.loads(liq[0]["extras"]["propgen_liquid"])
                if len(d["table"]) != d["tilts"] * d["fills"] or not (0 <= min(d["table"]) and max(d["table"]) <= 1):
                    problems.append("its liquid's fill table is malformed")
        fx = rec.get("fx") or {}
        if fx:
            if not [nd for nd in j["nodes"] if "propgen_fx" in (nd.get("extras") or {})]:
                problems.append("its enhancers aren't in the glb")
            if fx.get("glow") and not any("emissiveTexture" in m for m in mats):
                problems.append("it glows but no material has an emission map")
        if not os.path.exists(os.path.join(tmp, name, name + ".tscn")):
            problems.append("no Godot scene (.tscn) beside its glb")
        # Godot draws a face's front only: what's seen from outside must be fronts (a part inside out is see-through)
        ori = orientation(os.path.join(tmp, name, name + ".glb"))
        if ori["back"] > 0.015:
            problems.append(f"{ori['back'] * 100:.1f}% of what's seen from outside is the back of a face (inside out, "
                            f"see-through in Godot), at {ori['at'][0]} mm")
        flat = []
        for mname, files in rec["textures"].items():
            alb = read_image(os.path.join(tmp, name, files[0]))[..., :3]
            if alb.std() < 0.01:
                flat.append(mname)
            nrm = read_image(os.path.join(tmp, name, files[2]))[..., :3] * 2 - 1
            if nrm[..., 2].mean() < 0.6:
                problems.append(f"{mname}'s normal map faces away ({nrm[..., 2].mean():.2f})")
        if len(flat) == len(rec["textures"]):
            problems.append("every colour map is one flat colour (" + ", ".join(flat) + ")")
        if first is None:
            first = (name, spec, pos)
        print(("  ok  " if not problems else "  BAD ") + f"{name}: {rec['tris']} triangles, {' x '.join(f'{v:.0f}' for v in (hi - lo) * 1000)} mm, "
              f"{len(mats)} material(s), backs {ori['back'] * 100:.1f}%, {rec['secs']}s" + ("; " + "; ".join(problems) if problems else ""))
        bad += [f"{name}: {p}" for p in problems]
    bad += pictures_case(book, tmp)
    if first:
        name, spec, pos = first
        bpy.ops.wm.read_factory_settings(use_empty=True)
        build.run(name + "_again", spec, tmp, formats=("glb",), preview=False, samples=4, log=lambda *a: None)
        j, binc = _glb(os.path.join(tmp, name + "_again", name + "_again.glb"))
        same = np.array_equal(_positions(j, binc), pos)
        print(("  ok  " if same else "  BAD ") + f"{name} made twice: the same mesh")
        if not same:
            bad.append("not the same twice")
    # made again in a process of its own with another string hash (a set's order changes with it: the wrap bands'
    # margins once came out different run to run), every file byte for byte; the butts have twelve bands side by side
    if "cig_butts" in CASES:
        import subprocess
        import sys
        again = os.path.join(out, "_check_again")
        main_py = os.path.join(os.path.dirname(os.path.abspath(__file__)), "main.py")
        cmd = ([bpy.app.binary_path, "--background", "--factory-startup", "--python-exit-code", "1", "--python", main_py, "--"]
               if bpy.app.binary_path else [sys.executable, main_py, "--"]) + ["case", "cig_butts", "--out", again]
        env = dict(os.environ, PYTHONHASHSEED=str(int(os.environ.get("PYTHONHASHSEED", "0") or 0) + 7))
        r = subprocess.run(cmd, env=env, capture_output=True, text=True)
        a_dir, b_dir = os.path.join(tmp, "cig_butts"), os.path.join(again, "cig_butts")
        files = sorted(f for f in os.listdir(a_dir) if f != "meta.json") if os.path.isdir(a_dir) else []
        diff = [f for f in files if not os.path.exists(os.path.join(b_dir, f)) or
                open(os.path.join(a_dir, f), "rb").read() != open(os.path.join(b_dir, f), "rb").read()]
        ok_ = r.returncode == 0 and files and not diff
        print(("  ok  " if ok_ else "  BAD ") + f"cig_butts made again in another process: {len(files) - len(diff)} of {len(files)} files the same"
              + ("" if r.returncode == 0 else f" (it failed: {r.stderr.strip().splitlines()[-1:] if r.stderr.strip() else r.returncode})"))
        if not ok_:
            bad.append("cig_butts not the same made in another process: " + ", ".join(diff[:4]))
    print(f"PROPGEN ok ({len(CASES)} recipes made and measured, {time.time() - t0:.0f}s)" if not bad else "PROPGEN FAIL: " + "; ".join(bad[:8]))
    return not bad
