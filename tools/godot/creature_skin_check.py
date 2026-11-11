"""CREATURESKIN: the look plugin's creature skins (docs/GODOT_LOOK.md §5o, DECISIONS 2026-11-11: "some more weird skin
shaders/textures for the monster characters that we can apply in godot, e.g. a chrome silver skin, a pearlescent skin,
some kind of greasy shader"). HSCreatureSkin's looks, each on a ball with a made-up skin's paint beside a plain one, on
a dark stage under one warm lamp, pictured under xvfb and measured where each ball lands: at none of the look every
ball is the plain skin; lit, chrome is bright and grey with a glint, the mirror shows the black room, pearl is white
and turns colour toward its edge, greasy keeps the skin's colour under a glint, slime is green, black oil is black with
a film's colours along its edge, porcelain white, stone grey and matt, scales glinting, the ember's cracks glowing; the
lamp out, only the ember glows and chrome is as dark as the room; the lamp behind, wax and slime let it through; at half
the look, halfway. Then on a Character Studio export (`--person NAME`, `--glb FILE`, else a creature made by
`node tools/character/creatures.mjs make --export` when there is one), through the HSCharacterLook node as a game by
hand wears it: every look on her skin and her horns, how much of it changed while it's worn, her own skin back at the
end with its paint. A sheet of the balls and of her in every look in the keep folder. Ends "CREATURESKIN ok".

    python tools/godot/creature_skin_check.py [--person NAME | --glb FILE] [--keep DIR] [--sheet FILE]
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

OUT = ROOT / "Saved" / "Godot" / "_creature_skin"
KEEP = ROOT / "Saved" / "Story" / "_look" / "godot_creature_skin"
EXPORTS = [ROOT / "Exports" / "characters", ROOT / "Saved" / "Exports" / "characters"]


def find_export(person):
    names = [person] if person else ["creature_demon", "creature_goblin", "creature_ogre"]
    for n in names:
        for d in EXPORTS:
            f = d / n / f"{n}.glb"
            if f.exists():
                return f
    if person:
        return None
    for d in EXPORTS:                                  # any character exported for Godot
        for f in sorted(d.glob("*/*.glb")) if d.is_dir() else []:
            return f
    return None


def hue_apart(a, b):
    d = abs(a - b) % 1.0
    return min(d, 1.0 - d)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--glb", default="")
    ap.add_argument("--person", default="")
    ap.add_argument("--keep", default=str(KEEP))
    ap.add_argument("--sheet", default="", help="also copy the sheet here (the docs' picture)")
    a = ap.parse_args()
    g = godot_bin()
    if not g:
        print("CREATURESKIN FAIL: no godot (tools/godot_setup.sh)")
        return 1
    glb = Path(a.glb) if a.glb else find_export(a.person)
    if (a.glb or a.person) and (glb is None or not glb.exists()):
        print(f"CREATURESKIN FAIL: no export for Godot at {a.glb or a.person} (Export for Godot in the Character Studio)")
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
    cmd = [g, "--path", str(OUT), "--rendering-driver", "vulkan", "-s", "res://addons/horrorstudio_look/demo/creature.gd", "--", f"--out={keep}"]
    if glb is not None:
        cmd.append(f"--glb={glb}")
    if shutil.which("xvfb-run"):
        cmd = ["xvfb-run", "-a"] + cmd
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=3600, env=env)
    text = "\n".join(l for l in (r.stdout + r.stderr).splitlines() if l and "ALSA" not in l and "snd_" not in l and "ERR_CANT_OPEN" not in l)
    if "switching to OpenGL 3" in text:
        print("CREATURESKIN FAIL: Vulkan failed and Godot fell back to OpenGL")
        return 1
    bad = [l for l in text.splitlines() if "SCRIPT ERROR" in l or "SHADER ERROR" in l or "Parse Error" in l or "CREATURE FAIL" in l]
    if bad or "CREATURE {done}" not in text:
        print(text[-3000:])
        print("CREATURESKIN FAIL: the demo didn't run clean")
        return 1
    rep = json.loads((keep / "creature.json").read_text(encoding="utf-8"))
    ok = True

    def say(good, words):
        nonlocal ok
        ok = ok and bool(good)
        print(("  ok  " if good else "  BAD ") + words)

    S = rep["shots"]
    lit, dark, back, half, none = S["lit"], S["dark"], S["back"], S["half"], S["none"]
    looks = [k for k in lit if k != "plain"]
    P = lit["plain"]
    say(len(looks) >= 11, "%d looks, each on a ball beside a plain one: %s" % (len(looks), ", ".join(looks)))
    off = max(max(abs(none[k]["rgb"][c] - none["plain"]["rgb"][c]) for c in range(3)) for k in looks)
    say(off < 0.05, "at none of the look every ball is the plain skin (the furthest colour %.3f off it)" % off)
    c = lit["chrome"]
    say(c["sat"] < 0.6 * P["sat"] and c["sat"] < 0.26 and c["max"] > 0.98 and c["mean"] > 0.35,
        "chrome: bright under the lamp and grey (brightness %.2f, colour %.2f against the skin's %.2f), a glint at full white" % (c["mean"], c["sat"], P["sat"]))
    m = lit["mirror"]
    say(m["mean"] < 0.4 * P["mean"] and m["max"] > 0.98, "the mirror shows the black room it stands in (brightness %.2f against the skin's %.2f) and the lamp as a point" % (m["mean"], P["mean"]))
    p = lit["pearl"]
    say(p["sat"] < 0.22 and p["mean"] > P["mean"] and hue_apart(p["edge_hue"], p["mid_hue"]) >= 0.015,
        "pearl: white (colour %.2f), brighter than skin, its colour turning from the middle to the edge (hue %.2f to %.2f)" % (p["sat"], p["mid_hue"], p["edge_hue"]))
    gr = lit["greasy"]
    say(hue_apart(gr["mid_hue"], P["mid_hue"]) < 0.04 and gr["sat"] > 0.35 and gr["max"] > P["max"] * 1.08,
        "greasy: the skin's own colour kept (hue %.2f, the skin's %.2f) under a film that glints (%.2f, the skin's brightest %.2f)" % (gr["mid_hue"], P["mid_hue"], gr["max"], P["max"]))
    sl = lit["slime"]
    say(sl["rgb"][1] > sl["rgb"][0] and sl["rgb"][1] > 2.0 * sl["rgb"][2] and sl["max"] > 0.9, "slime: green (%.2f, %.2f, %.2f) and wet (a glint at %.2f)" % (*sl["rgb"], sl["max"]))
    o = lit["oil"]
    say(o["mean"] < 0.3 * P["mean"] and o["max"] > 0.98 and hue_apart(o["edge_hue"], o["mid_hue"]) > 0.1,
        "black oil: black (brightness %.2f), a glint, a film's colours along its edge (hue %.2f in the middle, %.2f at the edge)" % (o["mean"], o["mid_hue"], o["edge_hue"]))
    po = lit["porcelain"]
    say(po["sat"] < 0.22 and po["mean"] > P["mean"] and po["max"] > 0.98, "porcelain: white and glazed (colour %.2f, brightness %.2f, a glint)" % (po["sat"], po["mean"]))
    st = lit["stone"]
    say(st["sat"] < 0.3 and st["max"] < P["max"] + 0.05, "stone: grey and matt (colour %.2f, nothing brighter than %.2f)" % (st["sat"], st["max"]))
    sc = lit["scales"]
    say(sc["max"] > 0.9 and sc["mid_hue"] > P["mid_hue"] + 0.03, "scales: glints on them (%.2f) over the skin's colour turned green (hue %.2f, the skin's %.2f)" % (sc["max"], sc["mid_hue"], P["mid_hue"]))
    e, ed = lit["ember"], dark["ember"]
    say(e["glow"] > 0.12 and e["mean"] < 0.45 * P["mean"], "ember: burnt black (brightness %.2f) with its cracks glowing (%.0f%% of it)" % (e["mean"], 100 * e["glow"]))
    others = max(dark[k]["glow"] for k in dark if k != "ember")
    say(ed["glow"] > 0.12 and others < 0.08, "the lamp out: the ember glows of itself (%.0f%% of it), nothing else does (%.0f%% at most: its glow in the mirror)" % (100 * ed["glow"], 100 * others))
    say(dark["chrome"]["mean"] < 0.15 * c["mean"], "and chrome is as dark as the room (%.3f against %.2f lit): it has no light of its own" % (dark["chrome"]["mean"], c["mean"]))
    w, wb, pb = lit["wax"], back["wax"], back["plain"]
    say(wb["mean"] > 1.8 * pb["mean"] and w["std"] < 0.7 * P["std"], "wax: soft (its shading %.2f against the skin's %.2f) and the lamp behind it comes through (%.2f against the skin's %.2f)" % (w["std"], P["std"], wb["mean"], pb["mean"]))
    sb = back["slime"]
    say(sb["rgb"][1] > 2.0 * sb["rgb"][0], "slime: the lamp behind it comes through green (%.2f, %.2f, %.2f)" % (*sb["rgb"],))
    mono = (lit["oil"]["mean"] < half["oil"]["mean"] < none["oil"]["mean"] and lit["stone"]["sat"] < half["stone"]["sat"] < none["stone"]["sat"]
            and lit["ember"]["glow"] > half["ember"]["glow"] > none["ember"]["glow"])
    say(mono, "at half the look, halfway: the oil's black %.2f, %.2f, %.2f; the stone's grey %.2f, %.2f, %.2f; the ember's glow %.0f%%, %.0f%%, %.0f%% (the look, half, none)" % (
        lit["oil"]["mean"], half["oil"]["mean"], none["oil"]["mean"], lit["stone"]["sat"], half["stone"]["sat"], none["stone"]["sat"],
        100 * lit["ember"]["glow"], 100 * half["ember"]["glow"], 100 * none["ember"]["glow"]))
    who = rep.get("who")
    if glb is None or not who:
        print("  --  no character exported for Godot on this machine (node tools/character/creatures.mjs make --only demon --export): the looks aren't tried on one")
    else:
        say(who.get("node_looks") == "none," + who.get("looks", ""), "the HSCharacterLook node's Creature skin row lists every look (%s)" % who.get("node_looks"))
        worn = {k: who.get(k, 0) for k in looks}
        say(all(v >= 1 for v in worn.values()), "%s: every look worn through the node, on her skin%s (%s surfaces)" % (
            glb.stem, " and her horns and ears" if max(worn.values()) > 1 else "", ", ".join(str(v) for v in sorted(set(worn.values())))))
        say(who.get("amount") and all(abs(x - 0.25) < 1e-6 for x in who["amount"]), "how much of it changed while it's worn (a quarter, on %d surfaces)" % len(who.get("amount") or []))
        say(who.get("paint_kept", 0) >= 1, "her skin worn a second time (a script after the node) keeps its paint")
        say(who.get("left", 1) == 0 and who.get("skin_back", 0) >= 1, "taken off: nothing of it left, her own skin back on the skin shader")
    try:
        from PIL import Image, ImageDraw
        W, H = 480, 270
        tiles = [("the looks on balls, a plain skin first", keep / "creature_lit.png"), ("the lamp out: what glows of itself", keep / "creature_dark.png"), ("the lamp behind: what lets light through", keep / "creature_back.png")]
        if glb is not None and who:
            tiles += [("its own skin" if n == "off" else n, keep / f"creature_who_{n}.png") for n in ["off"] + looks]
        tiles = [(t, f) for t, f in tiles if f.exists()]
        cols = 4 if len(tiles) > 6 else 3
        rows = (len(tiles) + cols - 1) // cols
        im = Image.new("RGB", (W * cols, (H + 20) * rows), (12, 12, 12))
        d = ImageDraw.Draw(im)
        for i, (t, f) in enumerate(tiles):
            x, y = (i % cols) * W, (i // cols) * (H + 20)
            im.paste(Image.open(f).convert("RGB").resize((W, H)), (x, y + 20))
            d.text((x + 6, y + 4), t, fill=(230, 230, 230))
        im.save(keep / "creature_skins.jpg", quality=88)
        print(f"  the sheet: {keep / 'creature_skins.jpg'}")
        if a.sheet:
            shutil.copy(keep / "creature_skins.jpg", a.sheet)
    except (ImportError, FileNotFoundError) as e:
        print(f"  (no sheet: {e})")
    if not ok:
        print("CREATURESKIN FAIL")
        return 1
    print("CREATURESKIN ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
