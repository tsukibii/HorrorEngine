"""MHR's body as one small binary for the body editor and face_mesh.py: the mesh at one LOD (its points, Y up, facing
+Z, metres; its triangles) and its 45 identity shapes (0-19 body, 20-39 head, 40-44 hands) as float16 offsets.
Runs inside Blender's module (tools/retarget.py setup puts it in vendor/blender):

    vendor/blender/.venv/bin/python tools/character/pack_mhr.py [lod1] [out]

Writes Content/Studio/Bodies/MHR_<lod>.bin (default lod1: 18,439 points). The file: a uint32 header length, the
header (JSON: counts, units, the offsets of each block), then the points (float32), the triangles (uint32) and the
shapes (float16, shape by shape). Meta's MHR, Apache-2.0 (Content/Studio/Bodies/MHR_LICENSE.txt).
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
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    tris = np.array([[v.index for v in f.verts] for f in bm.faces], np.uint32)
    bm.free()
    pts = base.astype(np.float32).tobytes(); tri = tris.tobytes(); shp = shapes.astype(np.float16).tobytes()
    head = {"lod": lod, "points": n, "triangles": len(tris), "shapes": SHAPES, "units": "m", "up": "+Y", "front": "+Z",
            "groups": {"body": [0, 20], "head": [20, 40], "hands": [40, 45]}, "licence": "MHR, Apache-2.0 (Meta)"}
    for _ in range(2):                                                    # the offsets depend on the header's own length
        h = json.dumps(head).encode("utf-8"); h += b" " * (-(len(h) + 4) % 8)
        start = 4 + len(h)
        head.update(points_at=start, triangles_at=start + len(pts), shapes_at=start + len(pts) + len(tri))
    h = json.dumps(head).encode("utf-8"); h += b" " * (-(len(h) + 4) % 8)
    assert 4 + len(h) == head["points_at"], "header length moved"
    out.write_bytes(struct.pack("<I", len(h)) + h + pts + tri + shp)
    print(f"wrote {out} ({out.stat().st_size // 1024} KB): {n} points, {len(tris)} triangles, {SHAPES} shapes, "
          f"height {np.ptp(base[:, 1]):.3f} m, max shape offset {np.abs(shapes).max() * 100:.1f} cm")


main()
