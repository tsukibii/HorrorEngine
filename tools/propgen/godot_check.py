#!/usr/bin/env python3
"""GDPROPS: the made props in Godot 4.7, the way a game's export takes them (each .glb as it is, imported by Godot's
own glTF importer): every surface's material read back (base colour, the ORM texture, the normal map, see-through
where it should be), its size against the prop's meta.json, its triangles, and all of them pictured in a row under a
light (Saved/Props/_godot/godot_props.png; under xvfb and lavapipe in the cloud).

    python tools/propgen.py godot [names...]      (python tools/propgen/godot_check.py [names...])
"""
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "Saved" / "Props"
PROJ = OUT / "_godot"

PROJECT = """config_version=5

[application]
config/name="propgen check"

[display]
window/size/viewport_width=1600
window/size/viewport_height=600

[rendering]
renderer/rendering_method="forward_plus"
anti_aliasing/quality/msaa_3d=2
"""

SCRIPT = r'''extends SceneTree

func _init():
	var out := ""
	var files := []
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out = a.substr(6)
		elif a.begins_with("--glb="):
			files.append(a.substr(6))
	var root := Node3D.new()
	get_root().add_child(root)
	var rep := {}
	var x := 0.0
	var tallest := 0.0
	for f in files:
		var ps = load(f)
		if ps == null:
			rep[f] = {"error": "load failed"}
			continue
		var inst: Node3D = ps.instantiate()
		root.add_child(inst)
		var info := {"surfaces": [], "tris": 0}
		var box := AABB()
		var first := true
		for mi in inst.find_children("*", "MeshInstance3D", true, false):
			var mesh: Mesh = mi.mesh
			for s in mesh.get_surface_count():
				var mat = mi.get_active_material(s)
				var d := {"class": mat.get_class() if mat else "none", "node": str(mi.name)}
				if mat is BaseMaterial3D:
					d["albedo"] = mat.albedo_texture != null
					d["normal"] = mat.normal_enabled and mat.normal_texture != null
					d["transparency"] = mat.transparency
					d["cull"] = mat.cull_mode
					if mat is ORMMaterial3D:
						d["orm"] = mat.orm_texture != null
					else:
						d["rough"] = mat.roughness_texture != null
						d["metal"] = mat.metallic_texture != null
						d["ao"] = mat.ao_enabled and mat.ao_texture != null
				info["surfaces"].append(d)
				var arr = mesh.surface_get_arrays(s)
				var idx = arr[Mesh.ARRAY_INDEX]
				info["tris"] += (idx.size() / 3) if idx != null and idx.size() > 0 else (arr[Mesh.ARRAY_VERTEX].size() / 3)
			var b: AABB = mi.global_transform * mi.get_aabb()
			box = b if first else box.merge(b)
			first = false
		info["size"] = [box.size.x, box.size.y, box.size.z]
		inst.position = Vector3(x - box.position.x, -box.position.y, -box.position.z - box.size.z / 2)
		x += box.size.x + 0.04
		tallest = maxf(tallest, box.size.y)
		rep[f] = info
	# the stage: a grey floor, a soft sun and a sky, a camera taking them all in
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.36, 0.36, 0.37)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.55, 0.56, 0.6)
	e.ambient_light_energy = 0.7
	e.reflected_light_source = Environment.REFLECTION_SOURCE_BG
	e.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.environment = e
	root.add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-52, -38, 0)
	sun.light_energy = 2.2
	sun.shadow_enabled = true
	root.add_child(sun)
	var floor := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(40, 40)
	floor.mesh = pm
	var fm := StandardMaterial3D.new()
	fm.albedo_color = Color(0.42, 0.42, 0.42)
	fm.roughness = 0.8
	floor.material_override = fm
	root.add_child(floor)
	var cam := Camera3D.new()
	cam.fov = 30
	var mid := x / 2.0
	var dist: float = maxf(x * 0.95, tallest * 5.0) + 0.3
	cam.position = Vector3(mid, dist * 0.42, dist * 0.78)
	root.add_child(cam)
	cam.current = true
	await process_frame
	cam.look_at_from_position(Vector3(mid, dist * 0.42, dist * 0.78), Vector3(mid, tallest * 0.35, 0), Vector3.UP)
	for i in 12:
		await process_frame
	var img := get_root().get_viewport().get_texture().get_image()
	img.save_png(out + "/godot_props.png")
	var fh := FileAccess.open(out + "/godot_props.json", FileAccess.WRITE)
	fh.store_string(JSON.stringify(rep))
	fh.close()
	print("PROPS ", JSON.stringify({"n": files.size()}))
	quit()
'''


LIQUID_SCRIPT = r'''extends SceneTree

# the liquids: each prop upright and tipped over beside it, its liquid worn as the game wears it (HSLiquid.auto)
func _init():
	var out := ""
	var files := []
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out = a.substr(6)
		elif a.begins_with("--glb="):
			files.append(a.substr(6))
	var root := Node3D.new()
	get_root().add_child(root)
	var x := 0.0
	var tallest := 0.0
	for f in files:
		for tilt in [0.0, 70.0]:
			var inst: Node3D = load(f).instantiate()
			root.add_child(inst)
			inst.rotation_degrees = Vector3(0, 0, tilt)
			var box := AABB()
			var first := true
			for mi in inst.find_children("*", "MeshInstance3D", true, false):
				var b: AABB = mi.global_transform * mi.get_aabb()
				box = b if first else box.merge(b)
				first = false
			inst.position = Vector3(x - box.position.x, -box.position.y, 0)
			x += box.size.x + 0.03
			tallest = maxf(tallest, box.size.y)
	var n: int = load("res://addons/horrorstudio_look/liquid.gd").auto(root)
	await process_frame
	var rep := {"attached": n, "liquids": []}
	for mi in root.find_children("*_liquid", "MeshInstance3D", true, false):
		var m = mi.material_override
		rep["liquids"].append({"name": str(mi.name), "shader": m.shader.resource_path if m is ShaderMaterial and m.shader else ""})
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.36, 0.36, 0.37)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.55, 0.56, 0.6)
	e.ambient_light_energy = 0.7
	e.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.environment = e
	root.add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-50, -30, 0)
	sun.light_energy = 2.0
	sun.shadow_enabled = true
	root.add_child(sun)
	var floor := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(20, 20)
	floor.mesh = pm
	var fm := StandardMaterial3D.new()
	fm.albedo_color = Color(0.42, 0.42, 0.42)
	floor.material_override = fm
	root.add_child(floor)
	var cam := Camera3D.new()
	cam.fov = 28
	root.add_child(cam)
	cam.current = true
	await process_frame
	var dist: float = maxf(x * 0.85, tallest * 4.0) + 0.1
	cam.look_at_from_position(Vector3(x / 2.0, tallest * 0.9 + dist * 0.18, dist), Vector3(x / 2.0, tallest * 0.4, 0), Vector3.UP)
	for i in 12:
		await process_frame
	get_root().get_viewport().get_texture().get_image().save_png(out + "/godot_liquids.png")
	print("LIQUIDS ", JSON.stringify(rep))
	quit()
'''


def godot_bin():
    for c in [os.environ.get("GODOT"), "godot", "godot-mono"]:
        if c and shutil.which(c):
            return shutil.which(c)
    return None


def main(argv):
    g = godot_bin()
    if not g:
        print("GDPROPS FAIL: no godot (tools/godot_setup.sh in the cloud; GODOT=path on your machine)")
        return 1
    names = [a for a in argv if not a.startswith("-")] or sorted(p.name for p in OUT.iterdir() if (p / f"{p.name}.glb").exists())
    if not names:
        print("GDPROPS FAIL: no props made yet (python tools/propgen.py make <name>)")
        return 1
    if PROJ.exists():
        shutil.rmtree(PROJ)
    (PROJ / "props").mkdir(parents=True)
    (PROJ / "project.godot").write_text(PROJECT, encoding="utf-8")
    (PROJ / "check.gd").write_text(SCRIPT, encoding="utf-8")
    (PROJ / "liquids.gd").write_text(LIQUID_SCRIPT, encoding="utf-8")
    shutil.copytree(ROOT / "GodotPlugins" / "HorrorStudioLook" / "addons" / "horrorstudio_look", PROJ / "addons" / "horrorstudio_look",
                    ignore=shutil.ignore_patterns("*.import", "demo"))
    metas = {}
    for n in names:
        shutil.copy(OUT / n / f"{n}.glb", PROJ / "props" / f"{n}.glb")
        mp = OUT / n / "meta.json"
        metas[n] = json.loads(mp.read_text(encoding="utf-8")) if mp.exists() else {}
    env = dict(os.environ)
    if os.path.exists("/usr/share/vulkan/icd.d/lvp_icd.json"):
        env.setdefault("VK_ICD_FILENAMES", "/usr/share/vulkan/icd.d/lvp_icd.json")
    subprocess.run([g, "--headless", "--path", str(PROJ), "--import"], capture_output=True, text=True, timeout=900, env=env)
    cmd = [g, "--path", str(PROJ), "--rendering-driver", "vulkan", "-s", "res://check.gd", "--", f"--out={PROJ}"] + \
          [f"--glb=res://props/{n}.glb" for n in names]
    if shutil.which("xvfb-run"):
        cmd = ["xvfb-run", "-a", "-s", "-screen 0 1600x600x24"] + cmd
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=1800, env=env)
    text = "\n".join(l for l in (r.stdout + r.stderr).splitlines() if l and "ALSA" not in l and "snd_" not in l)
    if "PROPS {" not in text or "SCRIPT ERROR" in text:
        print(text[-3000:])
        print("GDPROPS FAIL: the check scene didn't run clean")
        return 1
    rep = json.loads((PROJ / "godot_props.json").read_text(encoding="utf-8"))
    ok = True
    for n in names:
        info = rep.get(f"res://props/{n}.glb") or {}
        if info.get("error") or not info.get("surfaces"):
            print(f"  BAD {n}: {info.get('error', 'no mesh')}")
            ok = False
            continue
        problems = []
        for i, s in enumerate(info["surfaces"]):
            if s.get("node", "").endswith("_liquid"):
                continue                                    # the liquid wears HSLiquid's shader in a game; its own material is plain
            if not s.get("albedo"):
                problems.append(f"surface {i} has no base colour texture")
            if not s.get("normal"):
                problems.append(f"surface {i} has no normal map")
            if not (s.get("orm") or (s.get("rough") and s.get("metal"))):
                problems.append(f"surface {i} has no roughness/metal texture")
        want = metas[n].get("size_m")
        if want:
            gx, gy, gz = info["size"]
            have = [gx, gz, gy]                                       # Godot's x, y up, z: the meta's Blender x, y, z up
            off = max(abs(a - b) / max(b, 1e-3) for a, b in zip(have, want))
            if off > 0.02:
                problems.append(f"size {[round(v, 3) for v in have]} against {want}")
        clear = [s for s in info["surfaces"] if s.get("transparency", 0)]
        ok = ok and not problems
        kinds = ", ".join(sorted({s["class"].replace("Material3D", "") for s in info["surfaces"]}))
        print(("  ok  " if not problems else "  BAD ") + f"{n}: {len(info['surfaces'])} surface(s) ({kinds}{'; ' + str(len(clear)) + ' see-through' if clear else ''}), "
              f"{info['tris']} triangles, {' x '.join(f'{v * 1000:.0f}' for v in info['size'])} mm" + ("; " + "; ".join(problems) if problems else ""))
    wet = [n for n in names if metas[n].get("liquid")]
    if wet:
        cmd = [g, "--path", str(PROJ), "--rendering-driver", "vulkan", "-s", "res://liquids.gd", "--", f"--out={PROJ}"] + \
              [f"--glb=res://props/{n}.glb" for n in wet]
        if shutil.which("xvfb-run"):
            cmd = ["xvfb-run", "-a", "-s", "-screen 0 1600x600x24"] + cmd
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=1800, env=env)
        text = "\n".join(l for l in (r.stdout + r.stderr).splitlines() if l and "ALSA" not in l and "snd_" not in l)
        line = next((l for l in text.splitlines() if l.startswith("LIQUIDS ")), None)
        if line is None or "SCRIPT ERROR" in text or "SHADER ERROR" in text:
            print(text[-3000:])
            print("  BAD the liquids' scene didn't run clean")
            ok = False
        else:
            rep = json.loads(line[8:])
            good = [l for l in rep["liquids"] if l["shader"].endswith(("liquid.gdshader", "liquid_clear.gdshader"))]
            fine = len(good) == 2 * len(wet) and rep["attached"] == 2 * len(wet)
            ok = ok and fine
            print(("  ok  " if fine else "  BAD ") + f"liquids: {len(wet)} prop(s) upright and tipped 70 degrees, HSLiquid on {rep['attached']} "
                  f"({', '.join(sorted({l['shader'].rsplit('/', 1)[-1] for l in good}))}): {PROJ / 'godot_liquids.png'}")
    pic = PROJ / "godot_props.png"
    print(f"  the picture: {pic}")
    print("GDPROPS ok" if ok else "GDPROPS FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
