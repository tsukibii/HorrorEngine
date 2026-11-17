"""WETEYES: the look plugin's wet eyes and tall catchlights (docs/GODOT_LOOK.md §5ab, DECISIONS 2026-11-17, cuter eyes:
"try re-create the wet eye look too inside godot"). Four made-up eyeballs at an eye's own size on the Studio's eye
shader, on a dark stage under one lamp, pictured under xvfb and measured: a dry eye and a wet one, each with a tear
line as an export carries it (the wet one's pooled into its corners, as the Studio builds it); two with catchlights
that stay, round and tall. Dry, the tear line is the faint glint it always was; wet, it adds several times the light,
its corners lit (the pools), uneven along the lid (glints, not a white line), and never a burnt-out stripe; with the
lamp out neither shows (the film has no light of its own); the wet eye's white takes a brighter glint; a dry eye made
wet in the game (HSEye.set_wet) glistens as much in its middle; a tall catchlight is taller than it's wide where the
round one is round. HSEyePaint's Wet eyes and Catchlights tall reach the eye's shader and both tear lines, and its
reset takes them back. A sheet in the keep folder. Ends "WETEYES ok".

    python tools/godot/wet_eyes_check.py [--keep DIR] [--sheet FILE]
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from portrait_check import HUMAN, PLUGIN, godot_bin, project_text  # noqa: E402

OUT = ROOT / "Saved" / "Godot" / "_wet_eyes"
KEEP = ROOT / "Saved" / "Story" / "_look" / "godot_wet_eyes"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--keep", default=str(KEEP))
    ap.add_argument("--sheet", default="", help="also copy the sheet here (the docs' picture)")
    a = ap.parse_args()
    g = godot_bin()
    if not g:
        print("WETEYES FAIL: no godot (tools/godot_setup.sh)")
        return 1
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "addons").mkdir(parents=True)
    (OUT / "project.godot").write_text(project_text(), encoding="utf-8")
    shutil.copytree(PLUGIN, OUT / "addons" / "horrorstudio_look")
    shutil.copytree(HUMAN, OUT / "HumanShaders", ignore=shutil.ignore_patterns("*.import"))
    keep = Path(a.keep).resolve()
    keep.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ)
    if os.path.exists("/usr/share/vulkan/icd.d/lvp_icd.json"):
        env.setdefault("VK_ICD_FILENAMES", "/usr/share/vulkan/icd.d/lvp_icd.json")
    subprocess.run([g, "--headless", "--path", str(OUT), "--import"], capture_output=True, text=True, timeout=900)
    cmd = [g, "--path", str(OUT), "--rendering-driver", "vulkan", "--fixed-fps", "60", "-s", "res://addons/horrorstudio_look/demo/wet_eyes.gd", "--", f"--out={keep}"]
    if shutil.which("xvfb-run"):
        cmd = ["xvfb-run", "-a"] + cmd
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=3600, env=env)
    text = "\n".join(l for l in (r.stdout + r.stderr).splitlines() if l and "ALSA" not in l and "snd_" not in l and "ERR_CANT_OPEN" not in l)
    if "switching to OpenGL 3" in text:
        print("WETEYES FAIL: Vulkan failed and Godot fell back to OpenGL")
        return 1
    bad = [l for l in text.splitlines() if "SCRIPT ERROR" in l or "SHADER ERROR" in l or "Parse Error" in l or "WETEYES FAIL" in l]
    if bad or "WETEYES {done}" not in text:
        print(text[-3000:])
        print("WETEYES FAIL: the demo didn't run clean")
        return 1
    rep = json.loads((keep / "wet_eyes.json").read_text(encoding="utf-8"))
    ok = True

    def say(good, words):
        nonlocal ok
        ok = ok and bool(good)
        print(("  ok  " if good else "  BAD ") + words)

    S = rep["shots"]
    lit, dark, made = S["lit"], S["dark"], S["set"]
    d, w = lit["dry"]["tear"], lit["wet"]["tear"]
    say(d["added"] > 0.5 and d["brightest"] < 0.97, "dry, the tear line is a faint glint along the lid (%.1f of light added to the picture, its brightest point %.2f)" % (d["added"], d["brightest"]))
    say(w["added"] > 3.0 * d["added"], "wet, it adds %.1f times the light (%.1f against %.1f)" % (w["added"] / max(d["added"], 1e-6), w["added"], d["added"]))
    say(w["corners"] > 0.25 * w["middle"] and w["corners"] > 4.0 * max(d["corners"], 1e-3),
        "pooled into the corners (%.1f there against %.1f along the middle; the dry line's corners %.2f)" % (w["corners"], w["middle"], d["corners"]))
    say(w["uneven"] > 0.2, "uneven along the lid: glints, not a white line (its light varies by %.0f%% of its mean along the middle; the dry line's %.0f%%)" % (100 * w["uneven"], 100 * d["uneven"]))
    say(dark["wet"]["tear"]["brightest"] < 0.04 and dark["dry"]["tear"]["brightest"] < 0.04,
        "with the lamp out neither shows: the film has no light of its own (the brightest point %.3f wet, %.3f dry)" % (dark["wet"]["tear"]["brightest"], dark["dry"]["tear"]["brightest"]))
    say(lit["wet"]["white_glint"] >= lit["dry"]["white_glint"] - 0.01, "the wet eye's white takes the lamp's glint at least as brightly (%.2f against %.2f)" % (lit["wet"]["white_glint"], lit["dry"]["white_glint"]))
    say(abs(lit["wet"]["white"] - lit["dry"]["white"]) < 0.08 * max(lit["dry"]["white"], 1e-6), "and is no brighter or darker over all: wet isn't a tint (the white %.3f wet, %.3f dry)" % (lit["wet"]["white"], lit["dry"]["white"]))
    m = made["dry"]["tear"]
    say(m["middle"] > 2.5 * d["middle"], "a dry eye made wet in the game (HSEye.set_wet): its line's middle %.1f times as bright (%.1f against %.1f)" % (m["middle"] / max(d["middle"], 1e-6), m["middle"], d["middle"]))
    ro, ta = lit["round"], lit["tall"]
    say(ro["spot"] > 20 and 0.7 < ro["spot_h"] / max(ro["spot_w"], 1) < 1.5, "a catchlight that stays, round: %d x %d px" % (ro["spot_w"], ro["spot_h"]))
    say(ta["spot"] > 20 and ta["spot_h"] / max(ta["spot_w"], 1) > 1.8 * ro["spot_h"] / max(ro["spot_w"], 1),
        "Catchlights tall at 3: %d x %d px, %.1f times as tall for its width" % (ta["spot_w"], ta["spot_h"], (ta["spot_h"] / max(ta["spot_w"], 1)) / (ro["spot_h"] / max(ro["spot_w"], 1))))
    C = rep["counted"]
    say(C["tears_found"] == 2 and C["dry"][0] == 0.0 and C["dry"][1] == 0.0, "an eye that says nothing of it is dry: the shader's and its tear line's wet both 0 (2 tear lines found)")
    say(C["set_wet"][:3] == [1.0, 1.0, 1.0] and C["set_wet"][3] < C["dry"][2] - 0.02, "HSEye.set_wet: the eye's shader and both tear lines wet, the eye glassier (roughness %.3f from %.3f)" % (C["set_wet"][3], C["dry"][2]))
    say(C.get("painter") and C["painter_reads"] == 0.0 and C["half"] == [0.5, 0.5, 0.5], "with an HSEyePaint under her it goes through it: Wet eyes at a half on the eye and both tear lines")
    say(abs(C.get("tall", 0) - 2.5) < 1e-6 and C["reset"] == [0.0, 0.0], "its Catchlights tall reaches the shader; reset: her own eyes again, dry")
    try:
        from PIL import Image, ImageDraw
        W, H = 640, 360
        tiles = [("a dry eye, a wet one, a round catchlight, a tall one", keep / "wet_lit.png"), ("without the tear lines", keep / "wet_bare.png"),
                 ("the lamp out", keep / "wet_dark.png"), ("the dry eye made wet in the game (HSEye.set_wet)", keep / "wet_set.png")]
        tiles = [(t, f) for t, f in tiles if f.exists()]
        im = Image.new("RGB", (W * 2, (H + 20) * 2), (12, 12, 12))
        dr = ImageDraw.Draw(im)
        for i, (t, f) in enumerate(tiles):
            x, y = (i % 2) * W, (i // 2) * (H + 20)
            im.paste(Image.open(f).convert("RGB").resize((W, H)), (x, y + 20))
            dr.text((x + 6, y + 4), t, fill=(230, 230, 230))
        im.save(keep / "wet_eyes.jpg", quality=90)
        print(f"  the sheet: {keep / 'wet_eyes.jpg'}")
        if a.sheet:
            shutil.copy(keep / "wet_eyes.jpg", a.sheet)
    except (ImportError, FileNotFoundError) as e:
        print(f"  (no sheet: {e})")
    if not ok:
        print("WETEYES FAIL")
        return 1
    print("WETEYES ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
