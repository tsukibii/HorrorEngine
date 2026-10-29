"""LOOKPLUGIN: the HorrorStudio look plugin (GodotPlugins/HorrorStudioLook) runs in a Godot 4.7 project of its own and
its parts show: the demo scene (addons/horrorstudio_look/demo/demo.gd) pictured under xvfb (lavapipe) with the plain
look, the realism preset, the wet floor, blood and rain, and the skin spheres, each measured (report.json): the lamp
brighter in the wet floor than the dry, the rain moving between frames, the blood red, the sweat's glints and the
oil's gloss over dry skin. Ends "LOOKPLUGIN ok". Pictures kept in --keep (default Saved/Story/_look/godot_plugin).

    python tools/godot/plugin_check.py [--keep DIR]
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PLUGIN = ROOT / "GodotPlugins" / "HorrorStudioLook" / "addons" / "horrorstudio_look"
HUMAN = ROOT / "GodotPlugins" / "HumanShaders"
OUT = ROOT / "Saved" / "Godot" / "_lookplugin"
KEEP = ROOT / "Saved" / "Story" / "_look" / "godot_plugin"

PROJECT = '''config_version=5

[application]

config/name="HorrorStudio look plugin check"
config/features=PackedStringArray("4.7", "Forward Plus")

[display]

window/size/viewport_width=1280
window/size/viewport_height=720

[rendering]

renderer/rendering_method="forward_plus"
'''


def godot_bin():
    for c in [os.environ.get("GODOT"), "godot", "godot-mono"]:
        if c and shutil.which(c):
            return shutil.which(c)
    return None


def quiet(text):
    return "\n".join(l for l in text.splitlines() if l and "ALSA" not in l and "snd_" not in l and "ERR_CANT_OPEN" not in l)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--keep", default=str(KEEP))
    a = ap.parse_args()
    g = godot_bin()
    if not g:
        print("LOOKPLUGIN FAIL: no godot")
        return 1
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "addons").mkdir(parents=True)
    (OUT / "project.godot").write_text(PROJECT, encoding="utf-8")
    shutil.copytree(PLUGIN, OUT / "addons" / "horrorstudio_look")
    shutil.copytree(HUMAN, OUT / "HumanShaders", ignore=shutil.ignore_patterns("*.import"))
    env = dict(os.environ)
    env.setdefault("VK_ICD_FILENAMES", "/usr/share/vulkan/icd.d/lvp_icd.json")
    r = subprocess.run([g, "--headless", "--path", str(OUT), "--import"], capture_output=True, text=True, timeout=600)
    keep = Path(a.keep)
    keep.mkdir(parents=True, exist_ok=True)
    cmd = [g, "--path", str(OUT), "--rendering-driver", "vulkan", "-s", "res://addons/horrorstudio_look/demo/demo.gd", "--", f"--out={keep}"]
    if not os.environ.get("DISPLAY"):
        cmd = ["xvfb-run", "-a"] + cmd
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=900, env=env)
    text = quiet(r.stdout + r.stderr)
    bad = [l for l in text.splitlines() if "SCRIPT ERROR" in l or "SHADER ERROR" in l or "Parse Error" in l or "error(" in l.lower()]
    if bad or "LOOKDEMO" not in text:
        print(text[-3000:])
        print("LOOKPLUGIN FAIL: the demo didn't run clean")
        return 1
    rep = json.loads((keep / "report.json").read_text(encoding="utf-8"))
    checks = []
    checks.append(("the wet floor carries the lamp (brighter under it than dry)", rep["wet"]["mean"] > rep["realism"]["mean"] * 1.05 or rep["wet"]["max"] > rep["realism"]["max"] * 1.05))
    checks.append(("the realism preset changes the picture", abs(rep["realism"]["mean"] - rep["plain"]["mean"]) > 0.002))
    checks.append(("the blood is red", rep["blood"]["red"] > 400))
    checks.append(("the rain moves between frames", rep.get("rain_motion", 0) > 0.002))
    checks.append(("the splashes glint on the floor where the rain lands (brighter than the same floor without them)", rep.get("splash_glow", 0) > 0.0002 or rep.get("splash_peak", 0) > 0.02))   # glints and thrown droplets since 2026-10-29, no drawn ring: sparse, so a peak counts too
    checks.append(("the mirror reflects the room (the bulb's glint in its upper half: a peak well over the wall beside it and over its own lower half; drawn every frame it's in view)", rep["mirror_top"]["max"] > rep["mirror_wall"]["mean"] * 1.2 and rep["mirror_top"]["max"] > rep["mirror_bottom"]["max"] * 1.6 and rep.get("mirror_frames", 0) >= 20))
    checks.append(("the sweat glints (a brighter peak than dry skin)", rep["skin_sweat"]["max"] > rep["skin_dry"]["max"] * 1.02))
    checks.append(("the oil glosses (the fill light's glint, a tight bright spot dry skin hasn't)", rep["glint_oil"]["max"] > rep["glint_dry"]["max"] * 1.15))
    checks.append(("the softener keeps a checker at arm's length nearly as sharp (over 0.6 of unsoftened)", rep.get("soften_near_on", 0) > rep.get("soften_near_off", 1) * 0.6))
    checks.append(("and softens one across the room (under 0.8 of unsoftened, and more than the near one)", rep.get("soften_far_on", 1) < rep.get("soften_far_off", 1) * 0.8 and rep.get("soften_far_on", 1) / max(rep.get("soften_far_off", 1), 1e-9) < rep.get("soften_near_on", 0) / max(rep.get("soften_near_off", 1), 1e-9)))
    checks.append(("a glow drawn after the opaque pass survives the softener (the digits, LEDs and steam: at least 0.7 of its peak)", rep.get("soften_glow_on", {}).get("max", 0) > rep.get("soften_glow_off", {}).get("max", 1) * 0.7 and rep.get("soften_frames", 0) >= 1))
    checks.append(("a light's pattern (caustics on the back wall): drawn into its projector, light and dark across the wall, and moving", rep.get("pattern_attached", 0) == 1 and rep.get("pattern_var", 0) > 0.004 and rep.get("pattern_motion", 0) > 0.004))
    checks.append(("a window's light shaft: the air in the beam brighter with it than the settled haze without", rep.get("shaft_gain", 0) > 0.004))
    checks.append(("a headlight sweep: fired, the car is passing at the shot and the ceiling and wall are brighter than before it", rep.get("sweep_passing", 0) == 1 and rep.get("sweep_gain", 0) > 0.01))
    ir = rep.get("iris", {})
    checks.append(("the iris: against a bright light the eye closes (the same light with the iris off is brighter), and night holds it a stop under",
                   ir.get("open", 0) > ir.get("closed", 9) * 1.12 and ir.get("night", 9) < ir.get("closed", 0) * 0.8))
    ok = True
    for what, good in checks:
        print(("  ok  " if good else "  BAD ") + what)
        ok = ok and good
    print("  measures: " + json.dumps({k: ({kk: round(vv, 4) if isinstance(vv, float) else vv for kk, vv in v.items()} if isinstance(v, dict) else round(v, 4)) for k, v in rep.items()}))
    print("  pictures in " + str(keep))
    if not ok:
        print("LOOKPLUGIN FAIL")
        return 1
    print("LOOKPLUGIN ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
