"""HITBOXES: the weapons plugin's hit reactions on bodies that aren't an adult's (docs/GODOT_LOOK.md's creatures;
DECISIONS 2026-11-11: "fix anything that needs fixed for godot too"). HSHitReact's hitboxes are capsules on her bones:
their lengths always followed her skeleton, their thickness was an adult's whoever she was. Now each part's thickness
goes with its own bones (the legs' by the leg, the arms' by the arm, the torso's and neck's by the shoulders, the
head's by the head's own length), an adult of any rig keeping the numbers it had, and `girth` says what bones can't.
Here, headless, in a `godot_byhand.py new` project: MHR's own body (an adult: every size 1, the capsules as they
were), and the Studio exports there are on this machine: a child (its head an adult's on a smaller body), a goblin
(small, a big head), an ogre (a shot at his chest's side meets a hitbox where an adult's capsule left a gap), and the
ogre again at girth 1.5. Ends "HITBOXES ok".

    python tools/godot/hitbox_check.py [--keep DIR] [--reuse]

The exports: `node tools/character/creatures.mjs make --only goblin,ogre --export` (and GROWPAGE's `_growtest` for the
child); without them only the adult is measured.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
import godot_byhand as BH  # noqa: E402

proj = ROOT / "Saved" / "Godot" / "_hitboxes"
KEEP = ROOT / "Saved" / "Story" / "_look" / "godot_hitboxes"
MHR = ROOT / "Content" / "Studio" / "Bodies" / "MHR.fbx"
EXPORTS = [ROOT / "Exports" / "characters", ROOT / "Saved" / "Exports" / "characters"]
ADULT = {"c_head": 0.1, "c_neck": 0.055, "l_upleg": 0.075, "l_lowleg": 0.055, "l_uparm": 0.05, "l_lowarm": 0.042}


def godot_bin():
    for c in [os.environ.get("GODOT"), "godot", "godot-mono"]:
        if c and shutil.which(c):
            return shutil.which(c)
    return None


def export_of(name):
    for d in EXPORTS:
        f = d / name / f"{name}.glb"
        if f.exists():
            return f
    return None


def run_test(g, bodies, keep, girth=None):
    cmd = [g, "--headless", "--path", str(proj), "-s", "res://hitbox_test.gd", "--", f"--out={keep}"] + [f"--body={n}={p}" for n, p in bodies]
    if girth:
        cmd.append(f"--girth={girth}")
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
    text = "\n".join(l for l in (r.stdout + r.stderr).splitlines() if l and "ALSA" not in l and "snd_" not in l)
    if "HITBOXES {done}" not in text or any("SCRIPT ERROR" in l or "Parse Error" in l for l in text.splitlines()):
        print(text[-3000:])
        return None
    return json.loads((keep / "hitboxes.json").read_text(encoding="utf-8"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--keep", default=str(KEEP))
    ap.add_argument("--reuse", action="store_true", help="keep the last project (its import)")
    a = ap.parse_args()
    g = godot_bin()
    if not g:
        print("HITBOXES FAIL: no godot (tools/godot_setup.sh)")
        return 1
    if not (a.reuse and (proj / "project.godot").exists()):
        if proj.exists():
            shutil.rmtree(proj)
        BH.new(proj) if hasattr(BH, "new") else subprocess.run([sys.executable, str(ROOT / "tools" / "godot_byhand.py"), "new", str(proj)], check=True, capture_output=True)
    else:
        subprocess.run([sys.executable, str(ROOT / "tools" / "godot_byhand.py"), "install", str(proj)], capture_output=True, text=True)
    (proj / "bodies").mkdir(exist_ok=True)
    shutil.copy(MHR, proj / "bodies" / "MHR.fbx")
    shutil.copy(ROOT / "tools" / "godot" / "hitbox_test.gd", proj / "hitbox_test.gd")
    subprocess.run([g, "--headless", "--path", str(proj), "--import"], capture_output=True, text=True, timeout=1800)
    keep = Path(a.keep).resolve()
    keep.mkdir(parents=True, exist_ok=True)
    bodies = [("adult", "res://bodies/MHR.fbx")]
    found = {}
    for key, name in [("child", "_growtest"), ("goblin", "creature_goblin"), ("ogre", "creature_ogre"), ("demon", "creature_demon")]:
        f = export_of(name)
        if f:
            bodies.append((key, str(f)))
            found[key] = f
    rep = run_test(g, bodies, keep)
    if rep is None:
        print("HITBOXES FAIL: the test didn't run clean")
        return 1
    ok = True

    def say(good, words):
        nonlocal ok
        ok = ok and bool(good)
        print(("  ok  " if good else "  BAD ") + words)

    ad = rep.get("adult") or {}
    bx = ad.get("boxes") or {}
    say(ad.get("loaded") and len(bx) >= 14 and all(v["layer"] == 1024 for v in bx.values()), "MHR's own body (an adult, %.2f m): %d hitboxes on its bones, on layer 11" % (ad.get("tall", 0), len(bx)))
    say(all(abs(v - 1.0) < 1e-9 for v in (ad.get("sizes") or {"x": 0}).values()), "its sizes all an adult's (%s)" % ", ".join("%s %.2f" % kv for kv in sorted((ad.get("sizes") or {}).items())))
    same = {k: bx.get(k, {}).get("r", -1) for k in ADULT}
    say(all(abs(same[k] - ADULT[k]) < 1e-6 for k in ADULT), "and its capsules as thick as they were (the head %.3f, the neck %.3f, the thigh %.3f, the shin %.3f, the upper arm %.3f m)" % (
        same["c_head"], same["c_neck"], same["l_upleg"], same["l_lowleg"], same["l_uparm"]))
    ss = ad.get("side_shot") or {}
    print("      (a shot at an adult's chest %.0f cm out from the spine %s)" % (100 * ss.get("off_m", 0), "meets its %s" % ss.get("part") if ss.get("hit") else "passes between the torso and the arm"))
    if "child" in rep and rep["child"].get("loaded"):
        c = rep["child"]
        s, b = c["sizes"], c["boxes"]
        say(s["leg"] < 0.9 and abs(s["head"] - 1.0) < 1e-9 and abs(b["c_head"]["r"] - 0.1) < 1e-6 and b["l_upleg"]["r"] < 0.07,
            "a child (%.2f m): her legs %.2f of an adult's and their capsules thinner (the thigh %.3f m), her head an adult's (%.2f: its capsule %.3f m as before)" % (c["tall"], s["leg"], b["l_upleg"]["r"], s["head"], b["c_head"]["r"]))
    if "goblin" in rep and rep["goblin"].get("loaded"):
        c = rep["goblin"]
        s, b = c["sizes"], c["boxes"]
        say(s["leg"] < 0.8 and s["head"] >= 0.9 and b["l_upleg"]["r"] < 0.062 and b["c_head"]["r"] >= 0.09,
            "a goblin (%.2f m): legs %.2f of an adult's (the thigh %.3f m), a head %.2f of one (%.3f m): small with a big head" % (c["tall"], s["leg"], b["l_upleg"]["r"], s["head"], b["c_head"]["r"]))
    if "ogre" in rep and rep["ogre"].get("loaded"):
        c = rep["ogre"]
        s, b = c["sizes"], c["boxes"]
        chest = max(v["r"] for v in b.values() if v["part"] == "torso")
        say(s["torso"] > 1.2 and s["leg"] > 1.2 and chest > 0.165 and b["l_upleg"]["r"] > 0.09,
            "an ogre (%.2f m): shoulders %.2f of an adult's, legs %.2f; his chest's capsule %.3f m (an adult's 0.14), his thigh's %.3f m" % (c["tall"], s["torso"], s["leg"], chest, b["l_upleg"]["r"]))
        so = c.get("side_shot") or {}
        say(so.get("hit"), "a shot at his chest %.0f cm out from the spine meets his %s (an adult's capsule, 14 cm, reached %s of the way there)" % (
            100 * so.get("off_m", 0), so.get("part", "?"), "%.0f%%" % (100 * 0.14 / max(so.get("off_m", 1), 1e-6))))
        rep2 = run_test(g, [("ogre", str(found["ogre"]))], keep, girth=1.5)
        if rep2 is None:
            say(False, "the ogre again at girth 1.5 didn't run")
        else:
            chest2 = max(v["r"] for v in rep2["ogre"]["boxes"].values() if v["part"] == "torso")
            say(abs(chest2 - 1.5 * chest) < 1e-4 and abs(rep2["ogre"]["boxes"]["c_head"]["r"] - b["c_head"]["r"]) < 1e-6,
                "girth 1.5: his chest's capsule half as thick again (%.3f m), his head's as it was" % chest2)
    if "demon" in rep and rep["demon"].get("loaded"):
        c = rep["demon"]
        print("      a demon (%.2f m): %s" % (c["tall"], ", ".join("%s %.2f" % kv for kv in sorted(c["sizes"].items()))))
    if not found:
        print("  --  no Studio exports on this machine (node tools/character/creatures.mjs make --only goblin,ogre --export): only the adult is measured")
    if not ok:
        print("HITBOXES FAIL")
        return 1
    print("HITBOXES ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
