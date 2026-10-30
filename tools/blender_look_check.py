"""BLENDERLOOK: tools/blender_look.py checked by rendering, with Blender's module (python tools/retarget.py setup).

    python tools/blender_look_check.py [--keep DIR]        ends "BLENDERLOOK ok"; --keep leaves the pictures there

1. The camcorder: UltraVHS's test chart through the compositor nodes, measured with UltraVHS's own measure.py
   against the reference video's numbers (edge rise 5 px at 1080, halo 12 %, colour edges 2.4 times as wide as
   luma's, black about 0.03); at night the black is blue.
2. The time of day: a room (5 x 4 m, a window in its east wall, a table) rendered in Cycles at day, dusk and night:
   brighter by day than at dusk than at night, the night a deep blue (its shadows blue, not black), one window light
   facing into the room.
"""
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VHS_TOOLS = ROOT / "tools" / "ultravhs"


# ---- Blender's side (run with the bpy environment's Python) ----------------------------------------------------------
def blender_side(argv):
    import math

    import bpy                                # first: it brings Blender's other modules (bmesh, mathutils)
    import bmesh
    import mathutils
    sys.path.insert(0, str(ROOT / "tools"))
    import blender_look as BL
    what, out = argv[0], Path(argv[1])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.display_settings.display_device = "sRGB"
    sc.render.engine = "CYCLES"
    sc.cycles.device, sc.cycles.use_denoising = "CPU", False
    sc.render.image_settings.file_format = "PNG"
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    sc.collection.objects.link(cam)
    sc.camera = cam
    res = {}
    if what == "chart":
        sc.cycles.samples = 1
        sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 1440, 1080, 100
        img = BL.comp_tree(sc).nodes.new("CompositorNodeImage")
        img.image = bpy.data.images.load(argv[2])
        for t in ("day", "night"):
            BL.composite(sc, t, "camcorder", source=img.outputs["Image"], display=("sRGB",))
            sc.render.filepath = str(out / f"chart_{t}.png")
            bpy.ops.render.render(write_still=True)
            res[t] = sc.render.filepath
    else:
        def mat(col):
            m = bpy.data.materials.new("m")
            m.use_nodes = True
            m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*col, 1)
            return m

        def box(name, size, at, m):
            me = bpy.data.meshes.new(name)
            bm = bmesh.new()
            bmesh.ops.create_cube(bm, size=1.0)
            bm.to_mesh(me)
            bm.free()
            ob = bpy.data.objects.new(name, me)
            ob.scale, ob.location = size, at
            ob.data.materials.append(m)
            sc.collection.objects.link(ob)
            return ob
        wall, floor = mat((0.6, 0.58, 0.55)), mat((0.3, 0.22, 0.15))
        W, D, H, (y0, y1, z0, z1) = 5.0, 4.0, 2.6, (1.3, 2.7, 0.9, 2.1)
        for name, size, at, m in (("floor", (W, D, 0.1), (W / 2, D / 2, -0.05), floor), ("ceiling", (W, D, 0.1), (W / 2, D / 2, H + 0.05), wall),
                                  ("wall_w", (0.1, D, H), (-0.05, D / 2, H / 2), wall), ("wall_n", (W, 0.1, H), (W / 2, D + 0.05, H / 2), wall),
                                  ("wall_s", (W, 0.1, H), (W / 2, -0.05, H / 2), wall), ("wall_e1", (0.1, y0, H), (W + 0.05, y0 / 2, H / 2), wall),
                                  ("wall_e2", (0.1, D - y1, H), (W + 0.05, (y1 + D) / 2, H / 2), wall),
                                  ("wall_e3", (0.1, y1 - y0, z0), (W + 0.05, (y0 + y1) / 2, z0 / 2), wall),
                                  ("wall_e4", (0.1, y1 - y0, H - z1), (W + 0.05, (y0 + y1) / 2, (z1 + H) / 2), wall),
                                  ("table", (1.2, 0.8, 0.75), (2.4, 2.0, 0.375), floor), ("ground", (60, 60, 0.1), (0, 0, -0.2), floor)):
            box(name, size, at, m)
        glass = box("Window", (0.01, y1 - y0, z1 - z0), (W + 0.05, (y0 + y1) / 2, (z0 + z1) / 2), wall)
        glass.hide_render = True              # the opening: light comes through the hole
        cam.location, cam.data.lens = (0.6, 0.7, 1.65), 18
        cam.rotation_euler = (math.radians(84), 0, math.radians(-62))
        sc.cycles.samples = 16
        sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 320, 240, 100
        for t in ("day", "dusk", "night"):
            made = BL.time_of_day(sc, t, True)
            BL.composite(sc, t, "off")
            sc.render.filepath = str(out / f"room_{t}.png")
            bpy.ops.render.render(write_still=True)
            lights = [o for o in made if o.name.startswith("LK_Window")]
            res[t] = {"file": sc.render.filepath, "windows": len(lights),
                      "inward_x": [round((o.matrix_world.to_3x3() @ mathutils.Vector((0, 0, -1))).x, 2) for o in lights]}
    print("BLENDERSIDE " + json.dumps(res))


# ---- the check (any Python with numpy and Pillow) --------------------------------------------------------------------
def bpy_python():
    home = ROOT / "vendor" / "blender"
    env = ROOT / "setup" / "env.json"
    if env.exists():
        home = Path(json.loads(env.read_text(encoding="utf-8")).get("blender", {}).get("home", home))
    exe = home / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    if not exe.exists():
        sys.exit(f"BLENDERLOOK: no Blender module at {home}: python tools/retarget.py setup")
    return exe


def run_blender(*args):
    r = subprocess.run([str(bpy_python()), __file__, "--blender-side", *map(str, args)], capture_output=True, text=True, encoding="utf-8", errors="replace")
    line = next((ln for ln in r.stdout.splitlines() if ln.startswith("BLENDERSIDE ")), None)
    if r.returncode or not line:
        sys.stderr.write(r.stdout[-2000:] + r.stderr[-2000:])
        sys.exit("BLENDERLOOK FAIL: Blender's side")
    return json.loads(line[len("BLENDERSIDE "):])


def main():
    import numpy as np
    from PIL import Image
    keep = sys.argv[sys.argv.index("--keep") + 1] if "--keep" in sys.argv else None
    out = Path(keep or tempfile.mkdtemp(prefix="blenderlook_"))
    out.mkdir(parents=True, exist_ok=True)
    bad = []

    def check(ok, what):
        print(("  ok  " if ok else "  NO  ") + what)
        if not ok:
            bad.append(what)

    # 1. the camcorder against UltraVHS's reference
    subprocess.run([sys.executable, str(VHS_TOOLS / "preview.py"), "--chart", str(out / "chart_full.png")], check=True, capture_output=True)
    full = Image.open(out / "chart_full.png")
    w, h = full.size
    full.crop(((w - h * 4 // 3) // 2, 0, (w + h * 4 // 3) // 2, h)).save(out / "chart.png")
    got = run_blender("chart", out, out / "chart.png")
    subprocess.run([sys.executable, str(VHS_TOOLS / "measure.py"), got["day"], "--json", str(out / "day.json")], capture_output=True, text=True)
    m = json.loads((out / "day.json").read_text()) if (out / "day.json").exists() else {}
    m = m.get("measured", m)
    rise, halo, chroma, black = m.get("edge_rise_px"), m.get("halo"), m.get("chroma_vs_luma"), m.get("black")
    print(f"       the camcorder on the chart: edge rise {rise} px, halo {halo}, colour edges {chroma}x, black {black} (reference 5, 0.12, 2.4, 0.031)")
    check(rise is not None and 4 <= rise <= 6, "the camcorder's softness: edges rise in 4 to 6 px at 1080 (the reference 5)")
    check(halo is not None and 0.08 <= halo <= 0.16, "the deck's halo beside edges: 8 to 16 % (the reference 12)")
    check(chroma is not None and 1.8 <= chroma <= 3.2, "colour bled wider than luma: 1.8 to 3.2 times (the reference 2.4)")
    check(black is not None and black < 0.07, "black lifted, not grey: under 0.07")
    night = np.asarray(Image.open(got["night"]).convert("RGB")).astype(float) / 255
    lum = night.mean(2)
    sh = night[lum < np.percentile(lum, 2)].mean(0)
    check(sh[2] > sh[0] + 0.02, f"night mode: black records blue {sh.round(3).tolist()}")

    # 2. the time of day in a room
    got = run_blender("room", out)
    med, shadows = {}, {}
    for t, g in got.items():
        a = np.asarray(Image.open(g["file"]).convert("RGB")).astype(float) / 255
        lum = a.mean(2)
        med[t] = float(np.median(lum))
        shadows[t] = a[lum < np.percentile(lum, 20)].mean(0)
    print("       the room's median: " + ", ".join(f"{t} {v:.3f}" for t, v in med.items()) + f"; the night's shadows {shadows['night'].round(3).tolist()}")
    check(med["day"] > 1.15 * med["dusk"] and med["dusk"] > 2 * med["night"], "brighter by day than at dusk than at night")
    check(0.05 <= med["night"] <= 0.2, "the night readable, not black (median 0.05 to 0.2)")
    s = shadows["night"]
    check(s[2] > s[1] > s[0] and s[2] > 0.02, "the night's shadows a deep blue, never black")
    check(all(g["windows"] == 1 and g["inward_x"] and g["inward_x"][0] < -0.9 for g in got.values()), "one window light, facing into the room")
    if keep:
        print(f"       pictures in {out}")
    print("BLENDERLOOK ok" if not bad else f"BLENDERLOOK FAILED: {len(bad)}")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    if "--blender-side" in sys.argv:
        blender_side(sys.argv[sys.argv.index("--blender-side") + 1:])
    else:
        main()
