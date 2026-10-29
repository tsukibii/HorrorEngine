"""GODOTLOOK: UltraVHS as the Godot export's shader, measured. The plugin's test chart (Tools/preview.py --chart) goes
through vhs.gdshader in a small Godot project under xvfb (lavapipe), and the picture is measured with the plugin's
measure.py beside the numpy reference's numbers on the same chart (preview.py: the shader line for line): the edge
rise, the halo, colour edges against luma's, black and white. Ends "GODOTLOOK ok".

    python tools/godot/look_check.py [--keep DIR]
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TOOLS = ROOT / "UnrealPlugins" / "UltraVHS" / "Tools"
ADDON = ROOT / "tools" / "godot" / "addons" / "horrorstudio"
OUT = ROOT / "Saved" / "Godot" / "_look"

LOOK_GD = '''extends SceneTree
var n := 0
var vhs
func _initialize() -> void:
	var img := Image.load_from_file("res://chart.png")
	var tr := TextureRect.new()
	tr.texture = ImageTexture.create_from_image(img)
	tr.set_anchors_preset(Control.PRESET_FULL_RECT)
	tr.stretch_mode = TextureRect.STRETCH_SCALE
	root.add_child(tr)
	vhs = load("res://vhs.gd").new()
	root.add_child(vhs)
	vhs.preset("camcorder")
func _process(_d: float) -> bool:
	n += 1
	if n == 6:
		root.get_texture().get_image().save_png("res://out.png")
		print("LOOKSHOT ok")
		quit()
	return false
'''


def godot_bin():
    for c in [os.environ.get("GODOT"), "godot", "godot-mono"]:
        if c and shutil.which(c):
            return shutil.which(c)
    return None


def measure(path):
    r = subprocess.run([sys.executable, str(TOOLS / "measure.py"), str(path), "--json", str(path) + ".json"], capture_output=True, text=True, timeout=300)
    if r.returncode != 0:
        print(r.stdout + r.stderr)
        return None
    return json.loads(Path(str(path) + ".json").read_text())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--keep", help="keep the pictures here")
    a = ap.parse_args()
    g = godot_bin()
    if not g:
        print("GODOTLOOK FAIL: no godot")
        return 1
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    subprocess.run([sys.executable, str(TOOLS / "preview.py"), "--chart", str(OUT / "chart.png")], check=True, capture_output=True)
    subprocess.run([sys.executable, str(TOOLS / "preview.py"), str(OUT / "chart.png"), str(OUT / "chart_numpy.png"), "--preset", "camcorder"], check=True, capture_output=True)
    (OUT / "project.godot").write_text('config_version=5\n\n[application]\n\nconfig/name="HorrorStudio look check"\nconfig/features=PackedStringArray("4.7", "Forward Plus")\n\n[display]\n\nwindow/size/viewport_width=1920\nwindow/size/viewport_height=1080\n\n[rendering]\n\nrenderer/rendering_method="forward_plus"\n', encoding="utf-8")
    shutil.copy(ADDON / "vhs.gd", OUT / "vhs.gd")
    shutil.copy(ADDON / "vhs.gdshader", OUT / "vhs.gdshader")
    (OUT / "look.gd").write_text(LOOK_GD.replace('load("res://vhs.gd")', 'load("res://vhs.gd")'), encoding="utf-8")
    # the add-on's shader path inside vhs.gd is res://addons/horrorstudio/vhs.gdshader: the same file here
    (OUT / "addons" / "horrorstudio").mkdir(parents=True)
    shutil.copy(ADDON / "vhs.gdshader", OUT / "addons" / "horrorstudio" / "vhs.gdshader")
    env = dict(os.environ)
    env.setdefault("VK_ICD_FILENAMES", "/usr/share/vulkan/icd.d/lvp_icd.json")
    cmd = [g, "--path", str(OUT), "--rendering-driver", "vulkan", "-s", "res://look.gd"]
    if not os.environ.get("DISPLAY"):
        cmd = ["xvfb-run", "-a"] + cmd
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=900, env=env)
    out = "\n".join(ln for ln in (r.stdout + r.stderr).splitlines() if "ALSA" not in ln and "snd_" not in ln)
    if "LOOKSHOT ok" not in out or not (OUT / "out.png").exists():
        print(out[-2000:])
        print("GODOTLOOK FAIL: no picture from Godot")
        return 1
    ref = measure(OUT / "chart_numpy.png")
    got = measure(OUT / "out.png")
    if not ref or not got:
        print("GODOTLOOK FAIL: measure.py")
        return 1
    checks = [("edge_rise_px", 1.0), ("halo", 0.04), ("chroma_vs_luma", 0.5), ("black", 0.02), ("white", 0.03)]
    ok = True
    print(f"{'':<16}{'numpy':>10}{'godot':>10}")
    for k, tol in checks:
        rv, gv = ref.get(k), got.get(k)
        bad = rv is None or gv is None or abs(float(rv) - float(gv)) > tol
        ok = ok and not bad
        print(f"{k:<16}{str(rv):>10}{str(gv):>10}" + ("   <- off by more than %s" % tol if bad else ""))
    if a.keep:
        Path(a.keep).mkdir(parents=True, exist_ok=True)
        for f in ("chart.png", "chart_numpy.png", "out.png"):
            shutil.copy(OUT / f, Path(a.keep) / ("godot_" + f if f == "out.png" else f))
    print("GODOTLOOK ok" if ok else "GODOTLOOK FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
