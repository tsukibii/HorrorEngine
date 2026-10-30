"""PROPGEN: a recipe of every family made small (256 px textures, a few bake samples, no preview, the .glb alone) and
measured: its glb well formed with a material of three textures (base colour, ORM, normal), standing on the floor and
centred, about its real size, within its triangle budget, its colour map not one flat colour, its normal map facing
out; the same recipe made twice the same mesh; every recipe's family and design known."""
import json
import os
import struct
import time

import numpy as np

from . import build, designs, recipes
from .paint import read_image

# a recipe per family: (its longest side in mm, roughly; the most triangles its game mesh may have)
CASES = {"soda_can": (115, 6000), "soda_can_crushed": (125, 14000), "water_bottle": (205, 16000), "coffee_cup": (117, 9000),
         "paper_ball": (90, 14000), "burger_box": (140, 2000), "chair_worn": (900, 2000), "spoon": (200, 4000),
         "key_brass": (60, 3000), "rice_bowl": (117, 8000), "cig_butts": (150, 8000), "trash_bag": (560, 10000)}


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
        for mname, files in rec["textures"].items():
            alb = read_image(os.path.join(tmp, name, files[0]))[..., :3]
            if alb.std() < 0.01:
                problems.append(f"{mname}'s colour is one flat colour")
            nrm = read_image(os.path.join(tmp, name, files[2]))[..., :3] * 2 - 1
            if nrm[..., 2].mean() < 0.6:
                problems.append(f"{mname}'s normal map faces away ({nrm[..., 2].mean():.2f})")
        if first is None:
            first = (name, spec, pos)
        print(("  ok  " if not problems else "  BAD ") + f"{name}: {rec['tris']} triangles, {' x '.join(f'{v:.0f}' for v in (hi - lo) * 1000)} mm, "
              f"{len(mats)} material(s), {rec['secs']}s" + ("; " + "; ".join(problems) if problems else ""))
        bad += [f"{name}: {p}" for p in problems]
    if first:
        name, spec, pos = first
        bpy.ops.wm.read_factory_settings(use_empty=True)
        build.run(name + "_again", spec, tmp, formats=("glb",), preview=False, samples=4, log=lambda *a: None)
        j, binc = _glb(os.path.join(tmp, name + "_again", name + "_again.glb"))
        same = np.array_equal(_positions(j, binc), pos)
        print(("  ok  " if same else "  BAD ") + f"{name} made twice: the same mesh")
        if not same:
            bad.append("not the same twice")
    print(f"PROPGEN ok ({len(CASES)} recipes made and measured, {time.time() - t0:.0f}s)" if not bad else "PROPGEN FAIL: " + "; ".join(bad[:8]))
    return not bad
