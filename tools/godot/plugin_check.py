"""LOOKPLUGIN: the HorrorStudio look plugin (GodotPlugins/HorrorStudioLook) runs in a Godot 4.7 project of its own and
its parts show: the demo scene (addons/horrorstudio_look/demo/demo.gd) pictured under xvfb (lavapipe) with the plain
look, the realism preset, the wet floor, blood and rain, the skin spheres and a CRT screen, each measured
(report.json): the lamp brighter in the wet floor than the dry, the rain moving between frames, the blood red, the
sweat's glints and the oil's gloss over dry skin, the CRT's scanlines at the pitch the camera should see and its
stripes in order close up, gone across the room. Ends "LOOKPLUGIN ok". Pictures kept in --keep (default
Saved/Story/_look/godot_plugin).

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
    ap.add_argument("--nodes", action="store_true", help="only the effect nodes and their presets (a quick run)")
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
    nodes_ok = nodes(g, keep, env)
    if a.nodes:
        print("LOOKPLUGIN ok" if nodes_ok else "LOOKPLUGIN FAIL")
        return 0 if nodes_ok else 1
    cmd = [g, "--path", str(OUT), "--rendering-driver", "vulkan", "--fixed-fps", "60", "-s", "res://addons/horrorstudio_look/demo/demo.gd", "--", f"--out={keep}"]
    if shutil.which("xvfb-run"):                                          # Xvfb when it's there (the card still draws through Vulkan): a fixed-size window no window manager resizes
        cmd = ["xvfb-run", "-a"] + cmd
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=1800, env=env)   # sixteen stages on lavapipe: over fifteen minutes on a loaded machine (2026-11-05)
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
    checks = demo_checks(rep)
    ok = nodes_ok
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


def demo_checks(rep):
    """The demo's measures (report.json) judged: (what, passed) for each part."""
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
    crt_line = rep.get("crt_line_px", 0)
    crt_exp = rep.get("crt_line_px_expected", 1)
    checks.append(("a CRT screen seen close: the scanlines' period in the picture is the pitch the camera should see (%.1f px against %.1f), the stripes run red, green, blue along a row (%.0f%% of the colour changes in that order), the picture flickers with the hum (%.1f%% over twelve frames)"
                   % (crt_line, crt_exp, 100 * rep.get("crt_triad_order", 0), 100 * rep.get("crt_flicker", 0)),
                   crt_line > 0 and abs(crt_line / max(crt_exp, 1e-6) - 1.0) < 0.2 and rep.get("crt_triad_order", 0) > 0.8 and rep.get("crt_triads_per_row", 0) > 20 and rep.get("crt_flicker", 0) > 0.01 and rep.get("crt_frames", 0) >= 10))
    checks.append(("across the room the lines and stripes fade out (its grey field's row-to-row contrast %.4f against %.4f close: no moiré), the raster lit (%.3f) over the set off (%.3f: dark glass), a lamp by the eye glinting in the glass off (a peak %.2f over the lower glass's mean of %.3f), its snow grained (%.3f)"
                   % (rep.get("crt_far_contrast", 9), rep.get("crt_near_contrast", 0), rep.get("crt_far", {}).get("mean", 0), rep.get("crt_off", {}).get("mean", 9), rep.get("crt_glint", {}).get("max", 0), rep.get("crt_glint_lower", {}).get("mean", 9), rep.get("crt_static_grain", 0)),
                   rep.get("crt_far_contrast", 9) < rep.get("crt_near_contrast", 0) * 0.25 and rep.get("crt_far", {}).get("mean", 0) > rep.get("crt_off", {}).get("mean", 9) * 1.5
                   and rep.get("crt_glint", {}).get("max", 0) > rep.get("crt_glint_lower", {}).get("mean", 9) * 3.0 and rep.get("crt_static_grain", 0) > 0.01))
    lg = rep.get("lightning", {})
    checks.append(("lightning within the flash limits: each strike one flash (one rise past half, its glow dipping no more than a tenth between three brightenings), a second strike asked for during the first waiting a second of dark, the thunder 3 s a kilometre after, someone there only in the flash, the room lit by it",
                   lg.get("strikes") == 2 and lg.get("rises") == [1, 1] and lg.get("glow_min", 0) >= 0.89 and lg.get("brightenings") == 3 and lg.get("dark_between_s", 0) >= 0.98
                   and abs(lg.get("thunder_s", -9) - 3.0 * lg.get("km", 1.0)) < 0.05 and lg.get("figure_ok") is True and lg.get("lit_gain", 0) > 1.3))
    cd = rep.get("cold", {})
    checks.append(("the cold: a breath shows in a flashlight's beam (%.3f over the same frame without it), more with a lamp behind it (%.3f: droplets throw light forward) and not in the dark (%.3f); a pane frosts from its bottom edge, the room behind blurred there (its sharpness %.4f from %.4f clear) and sharp above the frost line (%.4f from %.4f)"
                   % (cd.get("breath_lit", 0), cd.get("breath_back", 0), cd.get("breath_dark", 9), cd.get("frost_bottom", 9), cd.get("clear_bottom", 0), cd.get("frost_top", 0), cd.get("clear_top", 9)),
                   cd.get("breaths", 0) >= 3 and cd.get("breath_lit", 0) > 0.01 and cd.get("breath_back", 0) > cd.get("breath_lit", 0) * 1.5 and cd.get("breath_dark", 9) < cd.get("breath_lit", 0) * 0.35
                   and cd.get("frost_bottom", 9) < cd.get("clear_bottom", 0) * 0.4 and cd.get("frost_top", 0) > cd.get("clear_top", 9) * 0.7))
    mo = rep.get("mirror_only", {})
    checks.append(("only in the mirror and never in it (layer 19 drawn by the mirrors' cameras alone, layer 20 by every camera but theirs): the green box in the mirror's picture and not the eye's, the red box in the eye's and not the mirror's",
                   mo.get("in_mirror_view") is True and mo.get("in_eye_view") is True and mo.get("eye_mask_19") is False and mo.get("mirror_mask_19") is True and mo.get("mirror_mask_20") is False
                   and mo.get("mirror_green", 0) >= 9 and mo.get("eye_green", 99) <= 2 and mo.get("eye_red", 0) >= 20 and mo.get("mirror_red", 99) <= 2))
    checks.append(("a mirror's own wall kept out of its camera's picture (what's drawn just behind the glass, found without a collider: the near plane is square to the view, not the glass)", mo.get("wall_hidden", 0) >= 1))
    ml = rep.get("mirror2_layers", {})
    checks.append(("a mirror seen in a mirror: the second mirror's glass in the first's picture holds a picture lit like the room (not a hole), each mirror on its own layer, never itself",
                   ml.get("second_seen_by_first") is True and ml.get("first_not_itself") is True and ml.get("first") != ml.get("second") and ml.get("active2") is True
                   and rep.get("mirror2_in_first", {}).get("max", 0) > 0.3 and rep.get("mirror2_in_first", {}).get("mean", 0) > 0.2))
    return checks


def run_godot(cmd, env, timeout=600):
    if shutil.which("xvfb-run"):
        cmd = ["xvfb-run", "-a"] + cmd
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, env=env)
    return quiet(r.stdout + r.stderr)


def nodes(g, keep, env):
    """The effect nodes (addons/horrorstudio_look/nodes/) and every preset (presets/): in a game (demo/nodes.gd: each
    one's work measured, a save as the editor does it), then in the editor itself (demo/editor_test.gd as a plugin:
    a scene of presets opened, the nodes running in the editor's viewport, saved, the file holding nothing they made)."""
    text = run_godot([g, "--path", str(OUT), "--rendering-driver", "vulkan", "--fixed-fps", "60", "-s", "res://addons/horrorstudio_look/demo/nodes.gd", "--", f"--out={keep}"], env, timeout=1200)   # 41 presets at once: slow on a loaded machine (2026-11-05: ten minutes under four parallel jobs)
    bad = [l for l in text.splitlines() if "SCRIPT ERROR" in l or "SHADER ERROR" in l or "Parse Error" in l or "error(" in l.lower()]
    if bad or "LOOKNODES" not in text:
        print(text[-3000:])
        print("  BAD the effect nodes didn't run clean")
        return False
    rep = json.loads((keep / "nodes.json").read_text(encoding="utf-8"))
    fl = rep.get("flicker", {})
    moved = [k for k, (lo, hi) in fl.items() if hi - lo > 0.05]
    checks = [
        ("every preset loads and goes in (%d of %d files)" % (rep.get("presets", 0), rep.get("preset_files", 0)), rep.get("presets", 0) == rep.get("preset_files", -1) and rep.get("presets", 0) >= 30),
        ("rain: the box's streaks made", rep.get("rain") is True),
        ("a wet surface on the floor's mesh, the raining one with its ripples", rep.get("wet") is True and rep.get("wet_ripples") is True),
        ("a puddle's decal, blood on the floor and up the wall (dripping there)", rep.get("puddle") is True and rep.get("blood") is True),
        ("a leak's band on the wall it was dropped on", rep.get("leak") is True),
        ("a light shaft's card running to the floor (shorter than its reach)", rep.get("shaft") is True),
        ("a headlight sweep fired and passing", rep.get("sweep_passing") is True),
        ("lightning struck once to full and gone again (HSLightningStorm)", rep.get("lightning") is True),
        ("the four pattern lights each throwing their frames", rep.get("patterns", 0) == 4),
        ("the flicker lights moving (%s)" % ", ".join(moved), len(moved) >= 5),
        ("a mirror's reflection attached to the game's camera, a window pane's glass, a CRT screen's glass", rep.get("mirror") is True and rep.get("pane") is True and rep.get("crt") is True),
        ("a character's skin worn (%d materials)" % rep.get("character", 0), rep.get("character", 0) >= 1),
        ("the editor-only look environment stepping aside in the game", rep.get("look_env_freed") is True),
        ("a save: the meshes' own materials back, the lights at full, no projector, nothing the nodes made in the packed scene; on again after",
         rep.get("save_materials_back") is True and rep.get("save_lights_full") is True and rep.get("save_no_projector") is True and rep.get("save_nothing_made") is True and rep.get("after_save_on") is True),
        ("a node taken off: its mesh dry again", rep.get("removed_dry") is True),
        ("the look_balanced preset: the balanced environment (SSR at 48 steps, no SSIL) and TAA on the viewport", rep.get("look_balanced") is True),
        ("the grade and the tape: made when there's none, a second over the first, and the first back when it goes",
         all(rep.get(k) is True for k in ["grade_own", "grade_over", "grade_back", "tape_own", "tape_over", "tape_back"])),
    ]
    text = run_godot([g, "--path", str(OUT), "--rendering-driver", "vulkan", "--fixed-fps", "60", "-s", "res://addons/horrorstudio_look/demo/window.gd", "--", f"--out={keep}"], env)
    wl = next((l for l in text.splitlines() if l.startswith("LOOKWINDOW ")), None)
    wr = json.loads(wl[len("LOOKWINDOW "):]) if wl else {}
    if not wl:
        print(text[-2000:])
    checks += [
        ("the window sun in a window (window_sun.png): the beam bright just inside the glass and nothing beside the opening (it comes from the window)",
         wr.get("beam_gain_in", 0) > 0.008 and wr.get("beam_gain_beside", 1) < wr.get("beam_gain_in", 0) * 0.15),
        ("its sides parallel to the sun's way in, its slices in the window's plane, its length to the floor, its light outside aimed along it",
         wr.get("parallel") is True and wr.get("length", 99) < wr.get("reach", 0) and wr.get("light_aimed") is True and wr.get("light_outside") is True),
    ]
    text = run_godot([g, "--path", str(OUT), "--rendering-driver", "vulkan", "--fixed-fps", "60", "-s", "res://addons/horrorstudio_look/demo/zones.gd", "--", f"--out={keep}"], env)
    zl = next((l for l in text.splitlines() if l.startswith("LOOKZONES ")), None)
    zr = json.loads(zl[len("LOOKZONES "):]) if zl else {}
    if not zl:
        print(text[-2000:])
    la, lb = (zr.get("layers") or [0, 0])
    checks += [
        ("the room presets' zones each own their lights on a layer of their own (%s of 6)" % rep.get("room_presets"), rep.get("room_presets") == 6),
        ("two rooms' zones (zones.png): on different layers (%s, %s), each floor on its own, the wall between on both; the bulb's reach fitted (%.2f m of 6)" % (la, lb, zr.get("bulb_range", 0)),
         la > 0 and lb > 0 and la != lb and zr.get("floor_a") == 1 << (la - 1) and zr.get("floor_b") == 1 << (lb - 1) and zr.get("wall_ab") == (1 << (la - 1)) | (1 << (lb - 1)) and zr.get("bulb_range", 9) < 6.0
         and zr.get("lights") == [1, 2]),
        ("the bulb kept to its room: the next room's floor through the doorway no brighter with it on (%.4f against %.4f), and brighter when let out (%.4f)" % (zr.get("b_floor_bulb_on", 0), zr.get("b_floor_bulb_off", 0), zr.get("b_floor_bulb_free", 0)),
         abs(zr.get("b_floor_bulb_on", 1) - zr.get("b_floor_bulb_off", 0)) < 0.004 and zr.get("b_floor_bulb_free", 0) > zr.get("b_floor_bulb_off", 1) + 0.01),
        ("the next room's lamp off while the eye looks away, on when it looks back", zr.get("b_lamp_away") is False and zr.get("b_lamp_back") is True),
        ("a save puts every layer, mask and reach back, and they're on again after", zr.get("save_back") is True and zr.get("after_save") is True),
        ("the bulb's fitting glass goes with it: found (%.2f), out with the light off (%.2f, emission %.2f), dimmed with it (%.2f of 0.3), a glowing sign across the room left alone; put back before a save (%s) and found again after (%.2f)"
         % (zr.get("glass_on", -1), zr.get("glass_off", -1), zr.get("glass_off_energy", -1), zr.get("glass_dim", -1), zr.get("glass_put_back"), zr.get("glass_after_save", -1)),
         abs(zr.get("glass_on", 0) - 1.0) < 0.01 and abs(zr.get("glass_on_energy", 0) - 3.0) < 0.01 and zr.get("glass_off", 9) == 0 and zr.get("glass_off_energy", 9) == 0
         and abs(zr.get("glass_again", 0) - 1.0) < 0.01 and abs(zr.get("glass_dim", 0) - 0.3) < 0.02 and zr.get("sign_left") is True and zr.get("glass_put_back") is True
         and abs(zr.get("glass_after_save", 0) - 1.0) < 0.01),
    ]
    text = run_godot([g, "--path", str(OUT), "--rendering-driver", "vulkan", "--fixed-fps", "60", "-s", "res://addons/horrorstudio_look/demo/air.gd", "--", f"--out={keep}"], env, timeout=2400)
    al = next((l for l in text.splitlines() if l.startswith("LOOKAIR ")), None)
    ar = json.loads(al[len("LOOKAIR "):]) if al else {}
    if not al:
        print(text[-2000:])
    lv = ar.get("levels", {})
    b0, b25, b50, b75 = (lv.get(k, 0) for k in ["0.0", "0.25", "0.5", "0.75"])
    mo = ar.get("motes", [0, 9])
    checks += [
        ("the air (air_level_*.png): a flashlight's beam in it as thick as the fog: none in clear air (%.1f), faint at the look's haze (%.1f), more at 0.5 (%.1f) and 0.75 (%.1f)" % (b0, b25, b50, b75),
         b0 < 1.0 and b25 >= 2.0 and b50 > b25 * 1.6 and b75 > b50),
        ("the beam follows its light: half the energy about half the beam (%.2f), none with the light off (%.1f), no trail where it was after a turn (%.2f of it)" % (ar.get("battery_half", 0), ar.get("off", 9), ar.get("turn_first", 9)),
         0.35 <= ar.get("battery_half", 0) <= 0.65 and ar.get("off", 9) < 0.5 and ar.get("turn_first", 9) < 0.1),
        ("dust (air_dust.png): motes lit in the beam's core (%.1f a thousand pixels) and fewer beside it (%.2f), none by moonlight (air_moon.png: %.2f)" % (mo[0], mo[1], ar.get("moon_motes", 9)),
         mo[0] >= 4.0 * max(mo[1], 0.25) and ar.get("moon_motes", 9) < 0.3),
        ("the motes look like dust, not dots (docs/research/eye_candy.md §2.3b): they twinkle and drift (%.0f%% of the lit pixels changed in a quarter of a second) and vary (the brightest tenth %.1f times the faintest, over %d pixels)" % (100 * ar.get("twinkle", 0), ar.get("mote_spread", 0), ar.get("mote_pixels", 0)),
         ar.get("twinkle", 0) >= 0.3 and ar.get("mote_spread", 0) >= 4.0 and ar.get("mote_pixels", 0) >= 10),
        ("fog_to: half way through (%.4f) between where it was (%.4f) and where it's going (%.4f), there at the end (%.4f)" % (ar.get("fog_to_half", 0), ar.get("fog_to_from", 0), ar.get("fog_to_want", 0), ar.get("fog_to_end", 0)),
         ar.get("fog_to_from", 0) < ar.get("fog_to_half", 0) < ar.get("fog_to_want", 0) and abs(ar.get("fog_to_end", 0) - ar.get("fog_to_want", 1)) < 0.03 * ar.get("fog_to_want", 1)),
        ("an air zone round the eye: its fog while inside (%.3f of 0.7), the level's again after (%.3f of 0.25)" % (ar.get("zone_in", 0), ar.get("zone_out", 9)),
         abs(ar.get("zone_in", 0) - 0.7) < 0.03 and abs(ar.get("zone_out", 9) - 0.25) < 0.03),
        ("ground mist (air_woods_mist.png): a lamp lights it more near the ground (%+.1f) than up high (%+.1f)" % (ar.get("mist_low", 0), ar.get("mist_high", 0)),
         ar.get("mist_low", 0) > 1.0 and ar.get("mist_low", 0) > 1.5 * max(ar.get("mist_high", 0), 0.0)),
        ("a save: the light's projector and fog energy and the environment's density go back, and come again after",
         all(ar.get(k) is True for k in ["save_projector_back", "save_fog_energy_back", "save_env_back", "save_taken_again"])),
        ("the air's presets in the room: one atmosphere acts and the others wait, each preset's numbers, three beams drawn, the cookies on, motes and a zone",
         rep.get("air_one_acts") is True and rep.get("air_presets") is True and rep.get("air_beams") == 3 and rep.get("air_cookies") is True and rep.get("air_dust") is True),
        ("a save puts the air back: the atmosphere's environment, the flashlight's fog energy", rep.get("save_air_back") is True),
    ]
    ed = editor(g, keep, env)
    checks += ed
    ok = True
    for what, good in checks:
        print(("  ok  " if good else "  BAD ") + what)
        ok = ok and good
    print("  nodes: " + json.dumps(rep))
    return ok


def editor(g, keep, env):
    """The nodes in the editor: a scene of presets opened by a plugin, a few hundred frames of the editor running, the
    nodes' work seen there, the scene saved, and the saved file read back."""
    proj = OUT
    (proj / "addons" / "hs_editor_test").mkdir(parents=True, exist_ok=True)
    (proj / "addons" / "hs_editor_test" / "plugin.cfg").write_text('[plugin]\nname="hs editor test"\ndescription=""\nauthor=""\nversion="1"\nscript="plugin.gd"\n')
    shutil.copy(PLUGIN / "demo" / "editor_test.gd", proj / "addons" / "hs_editor_test" / "plugin.gd")
    pg = (proj / "project.godot").read_text(encoding="utf-8")
    if "[editor_plugins]" not in pg:
        (proj / "project.godot").write_text(pg + '\n[editor_plugins]\n\nenabled=PackedStringArray("res://addons/hs_editor_test/plugin.cfg")\n', encoding="utf-8")
    shutil.copy(PLUGIN / "demo" / "editor_scene.tscn", proj / "editor_scene.tscn")
    text = run_godot([g, "--editor", "--path", str(proj), "--rendering-driver", "vulkan"], env, timeout=600)
    line = next((l for l in text.splitlines() if l.startswith("HSEDITOR ")), None)
    if line is None:
        print(text[-3000:])
        return [("the nodes in the editor (no report)", False)]
    rep = json.loads(line[len("HSEDITOR "):])
    saved = (proj / "editor_scene.tscn").read_text(encoding="utf-8")
    made = [w for w in ['name="Beam"', 'name="Card"', 'name="Sweep"', 'name="Pattern"', 'name="Leak"', 'name="Splashes"', 'name="Box"', "light_projector", "ShaderMaterial", "hs_wet_was", "material_override = SubResource",
                        'name="BeamCone"', 'name="Air"', 'name="Motes"', "volumetric_fog", "FogVolume",
                        "layers =", "light_cull_mask", "hs_layers_was", "hs_zone", "omni_range"] if w in saved]
    errs = [l for l in text.splitlines() if "SCRIPT ERROR" in l or "Parse Error" in l]
    if errs:
        print("\n".join(errs[:20]))
    return [
        ("in the editor: the rain, the wet floor, the shaft, the pattern, the flicker, the CRT, a room's light zone, a flashlight's beam and the air run in the viewport (%s)" % json.dumps(rep.get("live", {})), all(rep.get("live", {}).values()) and len(rep.get("live", {})) >= 5 and rep.get("live", {}).get("crt") is True and rep.get("live", {}).get("beam") is True and rep.get("live", {}).get("air") is True and not errs),
        ("in the editor: saved, the file holds only what was placed (%s)" % (", ".join(made) or "nothing made"), rep.get("saved") is True and not made),
        ("in the editor: after the save the nodes are on again", rep.get("after") is True),
    ]


if __name__ == "__main__":
    sys.exit(main())
