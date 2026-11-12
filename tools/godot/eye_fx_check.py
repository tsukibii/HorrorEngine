"""EYEFX: the look plugin's creepy eyes (docs/GODOT_LOOK.md §5q, DECISIONS 2026-11-12: "some glowing eye
shaders or creepy eye effects, spiral eyes, glowing eyes (adjustable color), black eye, love hearts inside the eyes").
HSEyeFx's looks, each on a made-up eyeball on the Studio's eye shader beside a plain one, on a dark stage under one
lamp, pictured under xvfb and measured where each eye lands: with the looks off every eye is the plain eye; the glow
lights the iris with the lamp out (its pupil a dark hole, its white dark), in the colour asked for, half as much at
half the look; black is black, white and all, with the cornea's glint still on it; void is black with a point of
light; white is a pale lamp with no iris; blind is clouded; bloodshot reddens the white; the spiral has its arms and
turns; the hearts are hearts (a notch at the top, a point at the bottom, pink) and throb; the star has five points;
the slit is tall and thin; the cross is a cross; dilated and pinprick move the pupil's edge. One side alone, a look
taking another's place, the looks off, the stand-in version on a plain ball. Then on a Character Studio export
(`--person NAME`, `--glb FILE`, else a creature made by `node tools/character/creatures.mjs make --export` when there
is one), through the HSCharacterLook node's Creepy eyes row: every look on her eyes, the glowing ones with the lamp
out. A sheet in the keep folder. Ends "EYEFX ok".

    python tools/godot/eye_fx_check.py [--person NAME | --glb FILE] [--keep DIR] [--sheet FILE]
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
from creature_skin_check import find_export, hue_apart  # noqa: E402

OUT = ROOT / "Saved" / "Godot" / "_eye_fx"
KEEP = ROOT / "Saved" / "Story" / "_look" / "godot_eye_fx"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--glb", default="")
    ap.add_argument("--person", default="")
    ap.add_argument("--keep", default=str(KEEP))
    ap.add_argument("--sheet", default="", help="also copy the sheet here (the docs' picture)")
    a = ap.parse_args()
    g = godot_bin()
    if not g:
        print("EYEFX FAIL: no godot (tools/godot_setup.sh)")
        return 1
    glb = Path(a.glb) if a.glb else find_export(a.person)
    if (a.glb or a.person) and (glb is None or not glb.exists()):
        print(f"EYEFX FAIL: no export for Godot at {a.glb or a.person} (Export for Godot in the Character Studio)")
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
    cmd = [g, "--path", str(OUT), "--rendering-driver", "vulkan", "--fixed-fps", "60", "-s", "res://addons/horrorstudio_look/demo/eyes.gd", "--", f"--out={keep}"]
    if glb is not None:
        cmd.append(f"--glb={glb}")
    if shutil.which("xvfb-run"):
        cmd = ["xvfb-run", "-a"] + cmd
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=3600, env=env)
    text = "\n".join(l for l in (r.stdout + r.stderr).splitlines() if l and "ALSA" not in l and "snd_" not in l and "ERR_CANT_OPEN" not in l)
    if "switching to OpenGL 3" in text:
        print("EYEFX FAIL: Vulkan failed and Godot fell back to OpenGL")
        return 1
    bad = [l for l in text.splitlines() if "SCRIPT ERROR" in l or "SHADER ERROR" in l or "Parse Error" in l or "EYES FAIL" in l]
    if bad or "EYES {done}" not in text:
        print(text[-3000:])
        print("EYEFX FAIL: the demo didn't run clean")
        return 1
    rep = json.loads((keep / "eyes.json").read_text(encoding="utf-8"))
    ok = True

    def say(good, words):
        nonlocal ok
        ok = ok and bool(good)
        print(("  ok  " if good else "  BAD ") + words)

    S = rep["shots"]
    lit, later, dark, half, green, none = S["lit"], S["later"], S["dark"], S["half"], S["green"], S["none"]
    looks = [k for k in lit if k != "plain"]
    P, Pd = lit["plain"], dark["plain"]
    say(len(looks) >= 13, "%d looks, each on an eyeball beside a plain one: %s" % (len(looks), ", ".join(looks)))
    off = max(max(abs(none[k]["all"][c] - none["plain"]["all"][c]) for c in range(3)) for k in looks)
    say(off < 0.03, "with the looks off every eye is the plain eye (the furthest colour %.3f off it)" % off)
    say(P["iris_lum"] > 0.12 and P["pupil"] < 0.5 * P["iris_lum"] and P["white_lum"] > 0.3 and Pd["iris_lum"] < 0.05,
        "the plain eye: an iris (%.2f), a black pupil (%.3f), a white (%.2f); dark with the lamp out (%.3f)" % (P["iris_lum"], P["pupil"], P["white_lum"], Pd["iris_lum"]))
    gl, gd, gh, gg = lit["glow"], dark["glow"], half["glow"], green["glow"]
    red = lambda h: h < 0.07 or h > 0.93
    say(gd["iris_lum"] > 0.2 and red(gd["iris_hue"]) and gd["pupil"] < 0.5 * gd["iris_lum"] and gd["white_lum"] < 0.35 * gd["iris_lum"],
        "glow: the lamp out, the iris lit red of itself (%.2f, hue %.2f), its pupil a dark hole (%.2f), its white dark (%.2f)" % (gd["iris_lum"], gd["iris_hue"], gd["pupil"], gd["white_lum"]))
    say(0.2 < gg["iris_hue"] < 0.45 and gg["iris"][1] > 1.15 * gg["iris"][0], "its colour is yours: asked for green, the iris green (hue %.2f)" % gg["iris_hue"])
    say(Pd["iris_lum"] + 0.02 < gh["iris_lum"] < gd["iris_lum"] - 0.02, "at half the look, half lit (%.2f between the plain eye's %.3f and %.2f)" % (gh["iris_lum"], Pd["iris_lum"], gd["iris_lum"]))
    b = lit["black"]
    say(b["white_lum"] < 0.25 * P["white_lum"] and b["iris_lum"] < 0.5 * P["iris_lum"] and b["max"] > 0.8,
        "black: the white black (%.3f against %.2f) and the iris with it (%.3f), the cornea's glint still on it (%.2f)" % (b["white_lum"], P["white_lum"], b["iris_lum"], b["max"]))
    v, vd = lit["void"], dark["void"]
    say(v["white_lum"] < 0.25 * P["white_lum"] and vd["pupil"] > 0.4 and vd["iris_lum"] < 0.5 * vd["pupil"],
        "void: black, a point of light in its middle with the lamp out (%.2f, the iris round it %.2f)" % (vd["pupil"], vd["iris_lum"]))
    w, wd = lit["white"], dark["white"]
    say(wd["iris_lum"] > 0.25 and wd["white_lum"] > 0.12 and wd["pupil"] > 0.25 and w["iris_sat"] < 0.6 * P["iris_sat"],
        "white: the whole eye a pale lamp with the lamp out (the iris %.2f, the pupil %.2f, the white %.2f), no iris to see lit (colour %.2f against %.2f)" % (wd["iris_lum"], wd["pupil"], wd["white_lum"], w["iris_sat"], P["iris_sat"]))
    bl = lit["blind"]
    say(bl["iris_sat"] < 0.6 * P["iris_sat"] and bl["pupil"] > P["pupil"] + 0.1 and dark["blind"]["iris_lum"] < 0.06,
        "blind: the iris clouded (colour %.2f against %.2f), the pupil grey (%.2f); no light of its own" % (bl["iris_sat"], P["iris_sat"], bl["pupil"]))
    bs = lit["bloodshot"]
    rg = lambda m: m["white"][0] / max(m["white"][1], 1e-4)
    say(rg(bs) > 1.08 * rg(P) and bs["dark"] > 1.2 * P["dark"], "bloodshot: the white reddened (red over green %.2f against %.2f), the pupil wider (%.0f%% of the iris dark against %.0f%%)" % (rg(bs), rg(P), 100 * bs["dark"], 100 * P["dark"]))
    sp, sl = lit["spiral"], later["spiral"]
    moved = sum(1 for x, y in zip(sp["ring"], sl["ring"]) if x != y)
    say(dark["spiral"]["ring_changes"] == 4 and moved >= 18, "spiral: two arms round the iris (%d changes of colour round a circle, the lamp out) and turning (%d of 180 points changed in a third of a second)" % (dark["spiral"]["ring_changes"], moved))
    h = lit["hearts"]
    hm = S["close"]["hearts"].get("mark") or {}
    say(hm and hm["notch"] and hm["lobes"] and hm["widest_at"] < 0.5 and hm["bottom_w"] < 0.4 and hm["middle"] and 0.75 < hm["w"] / hm["h"] < 1.5,
        "hearts: a heart (%s x %s px: a notch between two lobes at the top, widest in its upper half, a point at the bottom %.0f%% as wide), pink" % (hm.get("w"), hm.get("h"), 100 * hm.get("bottom_w", 1)))
    say(abs(later["hearts"]["marks"] - h["marks"]) >= 0.03 * h["marks"], "and throbbing (%d px of it, %d a third of a second later)" % (h["marks"], later["hearts"]["marks"]))
    say(dark["hearts"]["pupil"] > 0.15, "the hearts lit of themselves with the lamp out (%.2f)" % dark["hearts"]["pupil"])
    st = (lit["star"].get("mark") or {})
    say(st and st["arms"] == 5 and st["middle"], "star: five points round its middle (%s)" % st.get("arms"))
    slm = (lit["slit"].get("mark") or {})
    say(slm and slm["h"] > 2.5 * slm["w"] and slm["middle"], "slit: an upright pupil (%s x %s px)" % (slm.get("w"), slm.get("h")))
    cr = (lit["cross"].get("mark") or {})
    say(cr and cr["middle"] and cr["fill"] < 0.55 and 0.7 < cr["w"] / cr["h"] < 1.4 and cr["arms"] == 4, "cross: four arms through the middle (%s, its box %.0f%% full)" % (cr.get("arms"), 100 * cr.get("fill", 1)))
    say(lit["dilated"]["dark"] > 2.0 * P["dark"] and lit["pinprick"]["dark"] < 0.6 * P["dark"],
        "the pupil blown wide and shrunk to a point (%.0f%% and %.0f%% of the iris's disc dark, the plain eye's %.0f%%)" % (100 * lit["dilated"]["dark"], 100 * lit["pinprick"]["dark"], 100 * P["dark"]))
    C = rep["counted"]
    say(C["eyes_found"] == 2 and C["one_side"] == 1 and C["side_numbers"] == [1.0, 0.0], "one side alone: the left eye black, the right as it was")
    say(C["replaced"][0] == 0.0 and C["replaced"][1] > 0.0 and C["replaced"][2] and abs(C["amount"] - 0.25) < 1e-6 and C["recoloured"], "another look takes the first one's place; its amount and its colour changed while it's worn")
    say(C["left"] == 0 and C["after_clear"] == [0.0, 1.0], "taken off: nothing of it left (%d eyes cleared)" % C["cleared"])
    say(C["plain_glow"] and C["plain_hearts"] == 0 and C["plain_back"], "eyes that aren't the Studio's (a plain ball named eye): the glow as an emission in the colour asked, nothing for a look it has no version of, its own material back")
    who = rep.get("who")
    if glb is None or not who:
        print("  --  no character exported for Godot on this machine (node tools/character/creatures.mjs make --only alien --export): the looks aren't tried on one")
    else:
        say(who.get("node_looks") == "none," + who.get("looks", ""), "the HSCharacterLook node's Creepy eyes row lists every look (%s)" % who.get("node_looks"))
        worn = who.get("worn", {})
        say(all(worn.get(k, 0) >= 2 for k in looks), "%s: every look worn through the node on both her eyes" % glb.stem)
        G = who.get("glow", {})
        say(G.get("glow_dark", 0) > 8 and G.get("none", 0) == 0, "her eyes glow red in the dark (%d points of the picture; none without the look)" % G.get("glow_dark", 0))
        say(who.get("left", 1) == 0, "taken off: her own eyes back")
    try:
        from PIL import Image, ImageDraw
        W, H = 480, 270
        tiles = [("the looks on eyeballs, a plain eye first: " + ", ".join(looks[:7]), keep / "eyes_lit.png"), ("the lamp out: what glows of itself", keep / "eyes_dark.png"), ("every look's colour asked for in green", keep / "eyes_green.png")]
        if glb is not None and who:
            tiles += [(n.replace("_", " "), keep / f"eyes_who_{n}.png") for n in ["none"] + [x for l in looks for x in ([l, l + "_dark"] if (keep / f"eyes_who_{l}_dark.png").exists() else [l])]]
        tiles = [(t, f) for t, f in tiles if f.exists()]
        cols = 4 if len(tiles) > 6 else 3
        rows = (len(tiles) + cols - 1) // cols
        im = Image.new("RGB", (W * cols, (H + 20) * rows), (12, 12, 12))
        d = ImageDraw.Draw(im)
        for i, (t, f) in enumerate(tiles):
            x, y = (i % cols) * W, (i // cols) * (H + 20)
            im.paste(Image.open(f).convert("RGB").resize((W, H)), (x, y + 20))
            d.text((x + 6, y + 4), t, fill=(230, 230, 230))
        im.save(keep / "eye_fx.jpg", quality=88)
        print(f"  the sheet: {keep / 'eye_fx.jpg'}")
        if a.sheet:
            shutil.copy(keep / "eye_fx.jpg", a.sheet)
    except (ImportError, FileNotFoundError) as e:
        print(f"  (no sheet: {e})")
    if not ok:
        print("EYEFX FAIL")
        return 1
    print("EYEFX ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
