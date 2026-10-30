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
window/size/resizable=false

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
    if os.path.exists("/usr/share/vulkan/icd.d/lvp_icd.json"):          # the cloud's lavapipe; on a machine with a card the loader finds it itself
        env.setdefault("VK_ICD_FILENAMES", "/usr/share/vulkan/icd.d/lvp_icd.json")
    r = subprocess.run([g, "--headless", "--path", str(OUT), "--import"], capture_output=True, text=True, timeout=600)
    keep = Path(a.keep)
    keep.mkdir(parents=True, exist_ok=True)
    cmd = [g, "--path", str(OUT), "--rendering-driver", "vulkan", "--fixed-fps", "60", "-s", "res://addons/horrorstudio_look/demo/demo.gd", "--", f"--out={keep}"]
    if shutil.which("xvfb-run"):                                          # Xvfb when it's there (the card still draws through Vulkan): a fixed-size window no window manager resizes
        cmd = ["xvfb-run", "-a"] + cmd
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=900, env=env)
    text = quiet(r.stdout + r.stderr)
    bad = [l for l in text.splitlines() if "SCRIPT ERROR" in l or "SHADER ERROR" in l or "Parse Error" in l or "error(" in l.lower()]
    if "switching to OpenGL 3" in text:                                   # no SSR, fog, compositor or auto exposure there: nothing measured would mean anything
        print(text[:1200])
        print("LOOKPLUGIN FAIL: Vulkan failed and Godot fell back to OpenGL (VK_ICD_FILENAMES=" + env.get("VK_ICD_FILENAMES", "") + ")")
        return 1
    if bad or "LOOKDEMO" not in text:
        print(text[-3000:])
        print("LOOKPLUGIN FAIL: the demo didn't run clean")
        return 1
    print("  " + next((l for l in text.splitlines() if "Using Device" in l), "renderer: ?"))
    rep = json.loads((keep / "report.json").read_text(encoding="utf-8"))
    checks = []
    checks.append(("the wet floor carries the lamp (brighter under it than dry)", rep["wet"]["mean"] > rep["realism"]["mean"] * 1.05 or rep["wet"]["max"] > rep["realism"]["max"] * 1.05))
    checks.append(("the realism preset changes the picture", abs(rep["realism"]["mean"] - rep["plain"]["mean"]) > 0.002))
    checks.append(("the blood is red", rep["blood"]["red"] > 400))
    checks.append(("the rain moves between frames", rep.get("rain_motion", 0) > 0.002))
    checks.append(("the splashes glint on the floor where the rain lands (brighter than the same floor without them)", rep.get("splash_glow", 0) > 0.0002 or rep.get("splash_peak", 0) > 0.02))   # glints and thrown droplets since 2026-10-29, no drawn ring: sparse, so a peak counts too
    checks.append(("the mirror reflects the room (the bulb's glint in its upper half: a peak well over the wall beside it and over its own lower half; drawn every frame it's in view)", rep["mirror_top"]["max"] > rep["mirror_wall"]["mean"] * 1.2 and rep["mirror_top"]["max"] > rep["mirror_bottom"]["max"] * 1.25 and rep.get("mirror_frames", 0) >= 20))
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
                   ir.get("open", 0) > ir.get("closed", 9) * 1.05 and ir.get("night", 9) < ir.get("closed", 0) * 0.85))   # one stop of range since 2026-10-30: 1.08 and 0.80 measured (1.24 and 0.8 with five stops)
    checks.append(("a leak's band on the wall: wet, the wall's lit face carries the lamp (brighter peak than dry) and darker between, and drops have fallen",
                   rep.get("leak_wet", {}).get("max", 0) > rep.get("leak_dry", {}).get("max", 9) * 1.04 and rep.get("leak_wet", {}).get("mean", 9) < rep.get("leak_dry", {}).get("mean", 0) * 1.0 and rep.get("leak_drops", 0) >= 2))
    checks.append(("hair on an imported model: the cards worn by their name, the highlights brighten the lit crown band over the dull one, the colour steps leave the crown under half the lit one's colours, and the dither grains it over the steps alone",
                   rep.get("hair_surfaces", 0) >= 1 and rep.get("hair_crown_lit", {}).get("mean", 0) > rep.get("hair_crown_dull", {}).get("mean", 9) * 1.05
                   and rep.get("hair_steps_colours", 9e9) < rep.get("hair_lit_colours", 0) * 0.5 and rep.get("hair_retro_grain", 0) > rep.get("hair_steps_grain", 9) * 1.3))
    gt = rep.get("grade_tint", {})
    checks.append(("the grade (cinema): the shadows cooler and the highlights warmer than ungraded, the corners darker by the vignette, the middle kept",
                   gt.get("dark_b_over_r", 0) > gt.get("dark_b_over_r_plain", 9) * 1.03 and gt.get("bright_r_over_b", 0) > gt.get("bright_r_over_b_plain", 9) * 1.02
                   and rep.get("grade_corner", {}).get("mean", 9) < rep.get("grade_corner_plain", {}).get("mean", 0) * 0.9 and abs(rep.get("grade_middle", {}).get("mean", 9) - rep.get("grade_middle_plain", {}).get("mean", 0)) < 0.08))
    ml = rep.get("mirror2_layers", {})
    checks.append(("a mirror seen in a mirror: the second mirror's glass in the first's picture holds a picture (a bright peak well over its mean, not a flat wall), each mirror on its own layer, never itself",
                   ml.get("second_seen_by_first") is True and ml.get("first_not_itself") is True and ml.get("first") != ml.get("second") and rep.get("mirror2_in_first", {}).get("max", 0) > 0.3 and rep.get("mirror2_in_first", {}).get("max", 0) > rep.get("mirror2_in_first", {}).get("mean", 9) * 2.0))
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
