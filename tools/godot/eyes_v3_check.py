"""EYESV3: eyes v3 in Godot (docs/GODOT_LOOK.md §5v; DECISIONS 2026-11-12, eyes v3: the user's own render matched, "make it
easy to modify some things via sliders (different iris shape / patterns, colors etc)"). A character made in the
Character Studio with the eyes v3 look and exported for Godot (`node tools/character/eyelooks.mjs make --only v3
--hair daz_twin_tails --export`: People/eyes_v3), worn as a game wears it and pictured under xvfb as the reference
frames her (both eyes across the picture), then her eyes changed by HSEyePaint and pictured again; each eye measured
where it lands:

  - her own eyes: the iris dark and red-brown, the pupil black, the white brighter than the iris and cool (no redder
    than blue); on each eye the two catchlights that stay where the look puts them (the big one up and to the picture's
    right of the iris's middle, the small one across from it), the same side in both eyes;
  - Godot's own picture of her eyes' record (the Studio's paint, ported: eye_paint.gdshaderinc) against the picture the
    Studio baked into the export: the same within a few hundredths, over the white and over the iris;
  - the catchlights that stay switched off: gone (only the room's lamps are left, dimmed); moved: where they were put;
    in the dark none, and with Catchlights in the dark they glow by themselves;
  - another iris (blue): the iris blue, the picture drawn once for the change and not again; a sunburst's accent in it;
    a slit pupil: upright and narrow; a bigger and a smaller iris drawn so, by the eye's own shape and not the mesh's;
  - reset: her own eyes again, to the pixel's measure, nothing left changed;
  - the eye picker and the node: every slider a number HSEyePaint takes; an HSCharacterLook's Eye Look and Eye paint
    worn when the game runs; a look saved by the picker read back.

The pictures and the sheet (her eyes beside the reference when `Saved/Eyes/ref/eyes.png` is there, and each change) in
Saved/Story/_look/godot_eyes_v3/. Ends "EYESV3 ok".

    python tools/godot/eyes_v3_check.py [--person eyes_v3 | --glb FILE] [--sheet FILE] [--quick]
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

OUT = ROOT / "Saved" / "Godot" / "_eyes_v3"
KEEP = ROOT / "Saved" / "Story" / "_look" / "godot_eyes_v3"
PEOPLE = ROOT / "Content" / "Studio" / "People"
REF = ROOT / "Saved" / "Eyes" / "ref" / "eyes.png"
STAGES = ["own", "redraw", "nocatch", "moved", "blue", "sunburst", "slit", "big", "small", "reset", "dark", "glow"]


def run(g, script, args, env, word, headless=False):
    cmd = [g, "--path", str(OUT)] + (["--headless"] if headless else ["--rendering-driver", "vulkan", "--fixed-fps", "60"]) + ["-s", script, "--"] + args
    if shutil.which("xvfb-run") and not headless:
        cmd = ["xvfb-run", "-a"] + cmd
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=3600, env=env)
    text = "\n".join(l for l in (r.stdout + r.stderr).splitlines() if l and "ALSA" not in l and "snd_" not in l and "ERR_CANT_OPEN" not in l)
    if "switching to OpenGL 3" in text:
        return None, "Vulkan failed and Godot fell back to OpenGL"
    bad = [l for l in text.splitlines() if "SCRIPT ERROR" in l or "SHADER ERROR" in l or "Parse Error" in l or "EYESV3 FAIL" in l]
    if bad or word not in text:
        return None, text[-3000:]
    return text, ""


def hue(c):
    import colorsys
    return colorsys.rgb_to_hsv(*c)[0]


def lum(c):
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--glb", default="")
    ap.add_argument("--person", default="eyes_v3")
    ap.add_argument("--keep", default=str(KEEP))
    ap.add_argument("--sheet", default="", help="also copy the sheet here (the docs' picture)")
    ap.add_argument("--quick", action="store_true", help="her own eyes pictured (both eyes, the face), no measures: for tuning")
    a = ap.parse_args()
    g = godot_bin()
    if not g:
        print("EYESV3 FAIL: no godot (tools/godot_setup.sh)")
        return 1
    glb = Path(a.glb) if a.glb else PEOPLE / a.person / "export" / f"{a.person}.glb"
    if not glb.exists():
        print(f"EYESV3 FAIL: no export at {glb} (node tools/character/eyelooks.mjs make --only v3 --hair daz_twin_tails --export, the Character Studio's server running)")
        return 1
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "addons").mkdir(parents=True)
    (OUT / "people").mkdir()
    (OUT / "project.godot").write_text(project_text(), encoding="utf-8")
    shutil.copytree(PLUGIN, OUT / "addons" / "horrorstudio_look")
    shutil.copytree(HUMAN, OUT / "HumanShaders", ignore=shutil.ignore_patterns("*.import"))
    shutil.copy(glb, OUT / "people" / glb.name)
    keep = Path(a.keep).resolve()
    keep.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ)
    if os.path.exists("/usr/share/vulkan/icd.d/lvp_icd.json"):
        env.setdefault("VK_ICD_FILENAMES", "/usr/share/vulkan/icd.d/lvp_icd.json")
    subprocess.run([g, "--headless", "--path", str(OUT), "--import"], capture_output=True, text=True, timeout=1800)
    base = [f"--glb=res://people/{glb.name}", f"--out={keep}"]
    if a.quick:
        text, err = run(g, "res://addons/horrorstudio_look/demo/eyes_v3.gd", base + ["--shots=pair,face", "--stages=own", "--tag=quick"], env, "EYESV3 {done}")
        print(err or f"  pictures in {keep} (quick_own_*.png)")
        return 0 if text else 1
    text, err = run(g, "res://addons/horrorstudio_look/demo/eyes_v3.gd", base + ["--shots=pair", "--stages=" + ",".join(STAGES), "--tag=v3"], env, "EYESV3 {done}")
    if text is None:
        print(err)
        print("EYESV3 FAIL: the demo didn't run clean")
        return 1
    rep = json.loads((keep / "v3.json").read_text(encoding="utf-8"))
    S = rep["stages"]
    ok = True

    def say(good, what):
        nonlocal ok
        print(("  ok  " if good else "  BAD ") + what)
        ok = ok and bool(good)

    def eye(stage, side="L"):
        return S[stage]["pair"][side]

    def spots(stage, side="L", least=6):
        return [(s["x"], s["y"]) for s in eye(stage, side)["spots"] if s["n"] >= least]

    def near(pts, x, y, tol=0.16):
        return any(abs(px - x) < tol and abs(py - y) < tol for px, py in pts)

    own = rep.get("own", {})
    say(rep.get("painter") and rep.get("eyes") == 2 and rep.get("eye_mats", 0) >= 2, "%s: her eyes on the Studio's eye (%d materials), her painter on both (%d)" % (glb.stem, rep.get("eye_mats", 0), rep.get("eyes", 0)))
    o = eye("own")
    say(lum(o["iris"]) < 0.16 and lum(o["pupil"]) < 0.06 and o["iris"][0] >= o["iris"][2], "her own eyes: the iris dark and no bluer than red (%.3f, %.3f, %.3f), the pupil black (%.3f)" % (*o["iris"], lum(o["pupil"])))
    say(lum(o["white"]) > 2.5 * lum(o["iris"]) and o["white"][2] >= o["white"][0] * 0.97, "the white brighter than the iris and cool (%.2f, %.2f, %.2f)" % tuple(o["white"]))
    cx, cy, c2x, c2y = float(own.get("catchX", 0)), float(own.get("catchY", 0)), float(own.get("catch2X", 0)), float(own.get("catch2Y", 0))
    kept = float(own.get("catchKeep", 0)) > 0
    if kept:
        both = all(near(spots("own", sd), cx, cy) and near(spots("own", sd), c2x, c2y) for sd in ("L", "R"))
        say(both, "the catchlights that stay on both eyes where the look puts them, the same side in each: the big one at (%.2f, %.2f), the small one at (%.2f, %.2f) of the iris; found L %s, R %s" % (
            cx, cy, c2x, c2y, ["(%.2f, %.2f)" % p for p in spots("own", "L")[:3]], ["(%.2f, %.2f)" % p for p in spots("own", "R")[:3]]))
        say(not near(spots("nocatch"), cx, cy) and not near(spots("nocatch"), c2x, c2y) and eye("nocatch")["bright_px"] < 0.35 * o["bright_px"],
            "switched off, they're gone (%d bright points on the iris against %d)" % (eye("nocatch")["bright_px"], o["bright_px"]))
        say(near(spots("moved"), -0.4, 0.35) and near(spots("moved"), 0.35, -0.3) and not near(spots("moved"), cx, cy),
            "moved, they're where they were put: (-0.40, 0.35) and (0.35, -0.30); found %s" % ["(%.2f, %.2f)" % p for p in spots("moved")[:3]])
        say(eye("dark")["bright_px"] == 0 and eye("glow")["bright_px"] >= 6, "in the dark none (lit by the lamps that reach the eye), and with Catchlights in the dark they glow by themselves (%d bright points)" % eye("glow")["bright_px"])
    else:
        print("  --  this export's eyes have no catchlights that stay (an export from before eyes v3, or a look without them)")
    rd = rep.get("redraw", {})
    say(len(rd) == 2 and all(v["iris"] < 0.03 and v["white"] < 0.03 for v in rd.values()),
        "Godot's own picture of her eyes' record is the one the Studio baked: " + ", ".join("%s the iris %.3f off, the white %.3f (the worst point %.2f)" % (k, v["iris"], v["white"], v["worst"]) for k, v in sorted(rd.items())))
    b = eye("blue")
    say(0.5 < hue(b["iris"]) < 0.72 and b["iris"][2] > 1.5 * b["iris"][0] and S["blue"]["bakes"] - S["moved"]["bakes"] == 1,
        "another iris: blue (hue %.2f), its picture drawn once for the change (%d in all by then)" % (hue(b["iris"]), S["blue"]["bakes"]))
    sb = eye("sunburst")
    say(sb["iris"][0] > sb["iris"][2] * 0.45 and hue(sb["iris"]) > 0.6 or hue(sb["iris"]) < 0.12, "a pattern: a violet iris with an orange sunburst round the pupil (the ring's colour %.2f, %.2f, %.2f)" % tuple(sb["iris"]))
    sl = eye("slit")
    say(sl["pupil_h"] > 2.0 * max(sl["pupil_w"], 0.01) and sl["pupil_w"] < 0.25, "a slit pupil: upright and narrow (%.2f of the iris across, %.2f down)" % (sl["pupil_w"], sl["pupil_h"]))
    big, small, own_mm = eye("big")["iris_mm"], eye("small")["iris_mm"], o["iris_mm"]
    say(big > own_mm * 1.08 and small < own_mm * 0.92, "a bigger and a smaller iris drawn so (the eye drawn from its own shape, not the mesh's): %.1f mm and %.1f mm across against her own %.1f" % (big, small, own_mm))
    r = eye("reset")
    off = max(abs(r["iris"][i] - o["iris"][i]) for i in range(3))
    say(off < 0.02 and S["reset"]["paint"] == {} and (not kept or near(spots("reset"), cx, cy)), "reset: her own eyes again (the iris %.3f off), nothing left changed" % off)

    # ---- the picker, the node and a saved look, headless
    text, err = run(g, "res://addons/horrorstudio_look/demo/eyes_v3_ui.gd", [f"--glb=res://people/{glb.name}", f"--out={keep}"], env, "EYESV3UI {done}", headless=True)
    if text is None:
        print(err)
        say(False, "the eye picker's stage didn't run clean")
    else:
        ui = json.loads((keep / "v3_ui.json").read_text(encoding="utf-8"))
        say(ui.get("sliders", 0) >= 25 and ui.get("unknown") == [], "the eye picker: %d sliders, %d colours and %d dropdowns, each a number HSEyePaint takes" % (ui.get("sliders", 0), ui.get("colours", 0), ui.get("choices", 0)))
        say(ui.get("picked") and ui.get("styled") and ui.get("reset_clean"), "a slider moved, a colour and a pupil picked, a style started from: on her eyes; Her own eyes: nothing left changed")
        say(ui.get("saved") and ui.get("read_back"), "Save as eyes writes an HSEyeLook (%s), read back with what was changed" % ui.get("saved_path", ""))
        say(ui.get("node_look") and ui.get("node_paint") and ui.get("node_props", 0) >= 30, "an HSCharacterLook wears its Eye Look and its Eye paint when the game runs; its Inspector lists %d eye numbers, each starting from the export's own" % ui.get("node_props", 0))
        say(ui.get("ready_look"), "the ready-made eye look (eyes/eyes_v3.tres) loads and goes onto her eyes")

    # ---- the sheet
    try:
        from PIL import Image, ImageDraw
        W = 1175
        H = 406

        def crop(name):
            f = keep / f"v3_{name}_pair.png"
            if not f.exists():
                return None
            im = Image.open(f).convert("RGB")
            w, h = im.size
            ch = int(w * H / W)
            return im.crop((0, (h - ch) // 2, w, (h - ch) // 2 + ch)).resize((W, H), Image.LANCZOS)
        rows = []
        if REF.exists():
            rows.append(("the reference (the user's render)", Image.open(REF).convert("RGB").resize((W, H), Image.LANCZOS)))
        rows.append(("eyes v3 in Godot", crop("own")))
        small_names = [n for n in ("nocatch", "moved", "blue", "sunburst", "slit", "big", "glow") if (keep / f"v3_{n}_pair.png").exists()]
        sw = W // 4
        sh = int(sw * H / W)
        srows = (len(small_names) + 3) // 4
        im = Image.new("RGB", (W, (H + 22) * len(rows) + (sh + 20) * srows), (20, 20, 20))
        d = ImageDraw.Draw(im)
        y = 0
        for label, pic in rows:
            d.text((6, y + 5), label, fill=(230, 230, 230))
            if pic is not None:
                im.paste(pic, (0, y + 22))
            y += H + 22
        for i, n in enumerate(small_names):
            x, yy = (i % 4) * sw, y + (i // 4) * (sh + 20)
            d.text((x + 6, yy + 4), n, fill=(230, 230, 230))
            im.paste(crop(n).resize((sw, sh), Image.LANCZOS), (x, yy + 20))
        im.save(keep / "eyes_v3.jpg", quality=90)
        print(f"  the sheet: {keep / 'eyes_v3.jpg'}")
        if a.sheet:
            Path(a.sheet).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(keep / "eyes_v3.jpg", a.sheet)
    except ImportError:
        pass
    print("EYESV3 ok" if ok else "EYESV3 FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
