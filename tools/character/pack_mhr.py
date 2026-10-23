"""MHR's body as one small binary for the Character Studio and face_mesh.py: the mesh at one LOD (its points, Y up,
facing +Z, metres; its triangles), its 45 identity shapes (0-19 body, 20-39 head, 40-44 hands) as float16 offsets,
its 72 FACS expression shapes (Meta's names) as float16 offsets on the points they move, and its UVs per triangle corner.
Runs inside Blender's module (tools/retarget.py setup puts it in vendor/blender):

    vendor/blender/.venv/bin/python tools/character/pack_mhr.py [lod1] [out]

Writes Content/Studio/Bodies/MHR_<lod>.bin (default lod1: 18,439 points). The file: a uint32 header length, the
header (JSON: counts, units, names, the offset of each block: <name>_at), then the points (float32), the triangles
(uint32), the shapes (float16, shape by shape), the expressions' points (uint32) and offsets (float16, expression by
expression) and the UVs (float32, three corners per triangle). Meta's MHR, Apache-2.0 (Content/Studio/Bodies/MHR_LICENSE.txt).
"""
import json
import struct
import sys
from pathlib import Path

import bpy
import bmesh  # noqa: E402 - after bpy, which loads it
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
SHAPES = 45
EXPRESSIONS = 72
# Meta's names for the 72 expression shapes, in order (github.com/facebookresearch/MHR, mhr/face_expression.py)
EXPRESSION_NAMES = (
    "browLowerer_L", "browLowerer_R", "cheekPuff_L", "cheekPuff_R", "cheekRaiser_L", "cheekRaiser_R", "cheekSuck_L",
    "cheekSuck_R", "chinRaiser_B", "chinRaiser_T", "dimpler_L", "dimpler_R", "eyesClosed_L", "eyesClosed_R",
    "eyesLookDown_L", "eyesLookDown_R", "eyesLookLeft_L", "eyesLookLeft_R", "eyesLookRight_L", "eyesLookRight_R",
    "eyesLookUp_L", "eyesLookUp_R", "innerBrowRaiser_L", "innerBrowRaiser_R", "jawDrop", "jawSidewaysLeft",
    "jawSidewaysRight", "jawThrust", "lidTightener_L", "lidTightener_R", "lipCornerDepressor_L", "lipCornerDepressor_R",
    "lipCornerPuller_L", "lipCornerPuller_R", "lipFunneler_LB", "lipFunneler_LT", "lipFunneler_RB", "lipFunneler_RT",
    "lipPressor_L", "lipPressor_R", "lipPucker_L", "lipPucker_R", "lipStretcher_L", "lipStretcher_R", "lipSuck_LB",
    "lipSuck_LT", "lipSuck_RB", "lipSuck_RT", "lipTightener_L", "lipTightener_R", "lipsToward_LB", "lipsToward_LT",
    "lipsToward_RB", "lipsToward_RT", "lowerLipDepressor_L", "lowerLipDepressor_R", "mouthLeft", "mouthRight",
    "nasolabialFurrow_L", "nasolabialFurrow_R", "noseWrinkler_L", "noseWrinkler_R", "nostrilCompressor_L",
    "nostrilCompressor_R", "nostrilDilator_L", "nostrilDilator_R", "outerBrowRaiser_L", "outerBrowRaiser_R",
    "upperLidRaiser_L", "upperLidRaiser_R", "upperLipRaiser_L", "upperLipRaiser_R")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    lod = args[0] if args else "lod1"
    out = Path(args[1]) if len(args) > 1 else ROOT / "Content" / "Studio" / "Bodies" / f"MHR_{lod}.bin"
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(ROOT / "Content" / "Studio" / "Bodies" / f"MHR_{lod}.fbx"))
    o = [x for x in bpy.data.objects if x.type == "MESH"][0]
    me, n = o.data, len(o.data.vertices)
    m3 = np.array(o.matrix_world.to_3x3())
    loc = np.array(o.matrix_world.translation)
    axes = np.array([[1, 0, 0], [0, 0, 1], [0, -1, 0]], float)           # Blender's Z up, -Y front -> Y up, +Z front
    kb = me.shape_keys.key_blocks
    raw = np.empty(n * 3); kb[0].data.foreach_get("co", raw); raw = raw.reshape(-1, 3)
    base = ((raw @ m3.T) + loc) @ axes.T
    shapes = np.zeros((SHAPES, n, 3), np.float32)
    for i in range(SHAPES):
        a = np.empty(n * 3); kb[1 + i].data.foreach_get("co", a)
        shapes[i] = ((a.reshape(-1, 3) - raw) @ m3.T) @ axes.T
    expr = np.zeros((EXPRESSIONS, n, 3), np.float32)                     # the 72 FACS shapes, kept sparse
    for i in range(EXPRESSIONS):
        a = np.empty(n * 3); kb[1 + SHAPES + i].data.foreach_get("co", a)
        expr[i] = ((a.reshape(-1, 3) - raw) @ m3.T) @ axes.T
    eidx = np.flatnonzero(np.abs(expr).max(axis=(0, 2)) > 1e-6).astype(np.uint32)
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    uvl = bm.loops.layers.uv.active
    tris = np.array([[v.index for v in f.verts] for f in bm.faces], np.uint32)
    uvs = np.array([[tuple(l[uvl].uv) for l in f.loops] for f in bm.faces], np.float32)   # per corner (seams split)
    bm.free()
    pad = lambda b: b + b"\0" * (-len(b) % 8)                        # every block 8-byte aligned (typed arrays need it)
    blocks = [("points", base.astype(np.float32).tobytes()), ("triangles", tris.tobytes()),
              ("shapes", shapes.astype(np.float16).tobytes()), ("expr_idx", eidx.tobytes()),
              ("expr", expr[:, eidx].astype(np.float16).tobytes()), ("uv", uvs.tobytes())]
    blocks = [(name, pad(data)) for name, data in blocks]
    head = {"lod": lod, "points": n, "triangles": len(tris), "shapes": SHAPES, "units": "m", "up": "+Y", "front": "+Z",
            "groups": {"body": [0, 20], "head": [20, 40], "hands": [40, 45]}, "licence": "MHR, Apache-2.0 (Meta)",
            "expressions": EXPRESSIONS, "expr_points": len(eidx), "expr_names": list(EXPRESSION_NAMES),
            "uv": "per triangle corner, float32 (u, v), v up"}
    for _ in range(2):                                                    # the offsets depend on the header's own length
        h = json.dumps(head).encode("utf-8"); h += b" " * (-(len(h) + 4) % 8)
        at = 4 + len(h)
        for name, data in blocks:
            head[name + "_at"] = at; at += len(data)
    h = json.dumps(head).encode("utf-8"); h += b" " * (-(len(h) + 4) % 8)
    assert 4 + len(h) == head["points_at"], "header length moved"
    out.write_bytes(struct.pack("<I", len(h)) + h + b"".join(d for _, d in blocks))
    print(f"wrote {out} ({out.stat().st_size // 1024} KB): {n} points, {len(tris)} triangles, {SHAPES} shapes, "
          f"{EXPRESSIONS} expressions on {len(eidx)} points, height {np.ptp(base[:, 1]):.3f} m, "
          f"max shape offset {np.abs(shapes).max() * 100:.1f} cm, max expression offset {np.abs(expr).max() * 100:.1f} cm")


main()
