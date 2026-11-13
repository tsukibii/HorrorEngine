"""JIGGLE: the look plugin's HSJiggle (docs/GODOT_LOOK.md §5n): the chains of bones a Character Studio export gives its
animal ears (`jiggle_<name>_0` ... `jiggle_<name>_tip`, under the head) sprung by Godot's SpringBoneSimulator3D, run
headless at 60 frames a second in a project of its own. On a skeleton made in the demo (a long ear of four bones, a
short one of two): one spring with a setting a chain; still, the tips rest; the head jerked 40 cm sideways, both tips
lag and the long ear's further than the short one's; left alone they settle back; with gravity the long ear hangs
lower; at amount 0 nothing moves. Then on a Studio export with ears, when there is one (`--glb FILE`, `--person NAME`,
else the first export under Content/Studio/People whose skeleton has such bones): its chains under `c_head`, its ears'
meshes skinned to them, each chain's softness read from the file, a jerk moving the tips and their settling back.

Then her soft tissue (docs/GODOT_LOOK.md §5w, DECISIONS 2026-11-13, the hands and the jiggle): HSSoftJiggle on a
skeleton made as the Animator leaves a baked character's (a breast and a buttock named in the bake's record, a third
soft bone it doesn't name): one modifier, a bone each, the record's numbers read; its tick the Animator's own (the
same weight after 10, 20 and 30 ticks as tools/animator/core/soft.js gives); still, they rest; a weight let go rings
at the rate and dies in the time JiggleBones' rule gives for its stiffness and damping; shoved, the weight stays
behind and settles; turned, it lags; carried along evenly, nothing leans; laid on her back, where it rests leans the way down has gone; at amount 0 nothing;
a clip's own turn of a soft bone left out and its shift kept; put 5 m away in a frame, no swing.
Ends "JIGGLE ok".

    python tools/godot/jiggle_check.py [--glb FILE | --person NAME] [--keep DIR]
"""
import argparse
import json
import os
import shutil
import struct
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PLUGIN = ROOT / "GodotPlugins" / "HorrorStudioLook" / "addons" / "horrorstudio_look"
PEOPLE = ROOT / "Content" / "Studio" / "People"
OUT = ROOT / "Saved" / "Godot" / "_jiggle"
KEEP = ROOT / "Saved" / "Story" / "_look" / "godot_jiggle"

PROJECT = '''config_version=5

[application]

config/name="HorrorStudio jiggle check"
config/features=PackedStringArray("4.7", "Forward Plus")
'''


def godot_bin():
    for c in [os.environ.get("GODOT"), "godot", "godot-mono"]:
        if c and shutil.which(c):
            return shutil.which(c)
    return None


def glb_json(path):
    """a binary glTF's JSON chunk"""
    with open(path, "rb") as f:
        head = f.read(20)
        if len(head) < 20 or head[:4] != b"glTF":
            return None
        (n,) = struct.unpack_from("<I", head, 12)
        return json.loads(f.read(n))


def chains_in(path):
    """the names of a glb's jiggle chains (its nodes named jiggle_<name>_0)"""
    try:
        j = glb_json(path)
    except (OSError, ValueError):
        return []
    return sorted(n["name"][7:-2] for n in (j or {}).get("nodes", []) if str(n.get("name", "")).startswith("jiggle_") and n["name"].endswith("_0"))


def find_export(person):
    """an export with ears: the person's, else the first under People that has chains"""
    if person:
        f = PEOPLE / person / "export" / f"{person}.glb"
        return f if f.exists() else None
    for d in sorted(PEOPLE.iterdir()) if PEOPLE.is_dir() else []:
        f = d / "export" / f"{d.name}.glb"
        if f.exists() and chains_in(f):
            return f
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--glb", default="")
    ap.add_argument("--person", default="")
    ap.add_argument("--keep", default=str(KEEP))
    a = ap.parse_args()
    g = godot_bin()
    if not g:
        print("JIGGLE FAIL: no godot (tools/godot_setup.sh)")
        return 1
    glb = Path(a.glb) if a.glb else find_export(a.person)
    if (a.glb or a.person) and (glb is None or not glb.exists()):
        print(f"JIGGLE FAIL: no export at {a.glb or a.person}")
        return 1
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "addons").mkdir(parents=True)
    (OUT / "project.godot").write_text(PROJECT, encoding="utf-8")
    shutil.copytree(PLUGIN, OUT / "addons" / "horrorstudio_look", ignore=shutil.ignore_patterns("*.import", "presets", "textures"))
    keep = Path(a.keep)
    keep.mkdir(parents=True, exist_ok=True)
    cmd = [g, "--headless", "--fixed-fps", "60", "--path", str(OUT), "-s", "res://addons/horrorstudio_look/demo/jiggle.gd", "--", f"--out={keep}"]
    if glb is not None:
        shutil.copy(glb, OUT / "who.glb")
        cmd.append(f"--glb={OUT / 'who.glb'}")
    subprocess.run([g, "--headless", "--path", str(OUT), "--import"], capture_output=True, text=True, timeout=900)   # (the classes' names registered)
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        text = r.stdout + r.stderr
    except subprocess.TimeoutExpired as e:
        text = (e.stdout or b"").decode("utf-8", "replace") + (e.stderr or b"").decode("utf-8", "replace") + "\n(stopped after 300 s)"
    text = "\n".join(l for l in text.splitlines() if l and "ALSA" not in l and "snd_" not in l)
    bad = [l for l in text.splitlines() if "SCRIPT ERROR" in l or "Parse Error" in l or "JIGGLE FAIL" in l]
    if bad or "JIGGLE {" not in text:
        print(text[-3000:])
        print("JIGGLE FAIL: the demo didn't run clean")
        return 1
    rep = json.loads((keep / "jiggle.json").read_text(encoding="utf-8"))
    ok = True

    def say(good, words):
        nonlocal ok
        ok = ok and bool(good)
        print(("  ok  " if good else "  BAD ") + words)

    mm = lambda v: 1000.0 * v
    made = rep.get("made") or {}
    ch = {c["root"]: c for c in made.get("chains", [])}
    say(made.get("springs") == 1 and set(ch) == {"jiggle_ear_L_0", "jiggle_ear_R_0"} and ch["jiggle_ear_L_0"]["tip"] == "jiggle_ear_L_tip",
        "one spring simulator on the skeleton, a setting a chain, each from its _0 bone to its _tip (%s)" % ", ".join(sorted(ch)))
    L, R = ch.get("jiggle_ear_L_0", {}), ch.get("jiggle_ear_R_0", {})
    say(L and R and L["stiffness"] < R["stiffness"], "the long ear softer than the short one (stiffness %.2f against %.2f)" % (L.get("stiffness", 0), R.get("stiffness", 0)))
    j, s, gr, off = rep.get("jerk") or {}, rep.get("settle") or {}, rep.get("gravity") or {}, rep.get("off") or {}
    say(j.get("L", 0) > 0.008 and j.get("R", 0) > 0.0005, "the head jerked 40 cm sideways: the long ear's tip lags %.1f mm behind, the short one's %.1f mm" % (mm(j.get("L", 0)), mm(j.get("R", 0))))
    say(j.get("L", 0) > 1.5 * j.get("R", 1), "the long ear flops further than the short one (%.1f times)" % (j.get("L", 0) / max(1e-9, j.get("R", 0))))
    say(s.get("L", 1) < 0.001 and s.get("R", 1) < 0.001, "left alone four seconds, both back where they rested (%.2f mm, %.2f mm off)" % (mm(s.get("L", 1)), mm(s.get("R", 1))))
    wk, tn = rep.get("walk") or {}, rep.get("turn") or {}
    say(0.002 < wk.get("L", 0) < 0.06 and wk.get("R", 1) < wk.get("L", 0), "walking (the head bobbing 2.5 cm twice a second): the long ear's tip moves %.1f mm against the head, the short one's %.1f mm: a flop, not a flail" % (mm(wk.get("L", 0)), mm(wk.get("R", 0))))
    say(tn.get("L", 0) > 0.005 and tn.get("L", 0) > tn.get("R", 1), "the head turned 60 degrees in a third of a second: the long ear swings %.1f mm behind, the short one %.1f mm" % (mm(tn.get("L", 0)), mm(tn.get("R", 0))))
    say(gr.get("L", 0) < -0.002 and gr.get("L", 0) < gr.get("R", 0), "with gravity the long ear hangs lower (its tip %.1f mm down, the short one's %.1f mm)" % (-mm(gr.get("L", 0)), -mm(gr.get("R", 0))))
    say(off.get("L", 1) < 1e-5 and off.get("R", 1) < 1e-5, "at amount 0 the same jerk moves nothing (%.3f mm)" % mm(max(off.get("L", 1), off.get("R", 1))))
    real = rep.get("real")
    if glb is None:
        print("  --  no Studio export with ears on this machine (Accessories, Animal ears, then Export for Godot): the real thing isn't measured")
    else:
        names = chains_in(glb)
        say(real and real.get("loaded") and real.get("attached"), f"{glb.name}: loaded by Godot, its jiggle put on (the file's chains: {', '.join(names) or 'none'})")
        if real and real.get("attached"):
            got = sorted(c["name"] for c in real.get("chains", []))
            say(got == names and len(got) >= 1, "Godot finds the same chains on its skeleton (%s)" % ", ".join(got))
            say(all(p == "c_head" for p in real.get("parents", [])) and real.get("head", -1) >= 0, "each chain's root under the head's bone (%s)" % ", ".join(sorted(set(real.get("parents", [])))))
            say(len(real.get("meshes", [])) >= len(got) and real.get("stray", 1) == 0, "the ears' meshes weighted to their chains' bones and to nothing else (%s)" % ", ".join(real.get("meshes", [])[:8]))
            soft = real.get("soft") or {}
            if soft:
                say(all(0.0 < v <= 1.0 for v in soft.values()), "each chain's softness read from the file's extras (%s)" % ", ".join("%s %.2f" % (k[7:], v) for k, v in sorted(soft.items())))
            else:
                print("  --  the file's extras didn't come through Godot's import here: the softness is taken from each chain's length")
            jr, st = real.get("jerk") or {}, real.get("settle") or {}
            say(jr and all(v > 0.001 for v in jr.values()), "a jerk moves every ear's tip (%s mm)" % ", ".join("%s %.1f" % (k, mm(v)) for k, v in sorted(jr.items())))
            say(st and all(v < 0.0015 for v in st.values()), "and they settle back (%s mm off)" % ", ".join("%s %.2f" % (k, mm(v)) for k, v in sorted(st.items())))
            wk, tn = real.get("walk") or {}, real.get("turn") or {}
            say(wk and all(0.0003 < v < 0.06 for v in wk.values()), "walking, each ear's tip moves against the head (%s mm); a 60 degree turn swings them %s mm" % (
                ", ".join("%s %.1f" % (k, mm(v)) for k, v in sorted(wk.items())), ", ".join("%s %.1f" % (k, mm(v)) for k, v in sorted(tn.items()))))
    # ---- her soft tissue: HSSoftJiggle -------------------------------------------------------------------------------
    try:
        r = subprocess.run([g, "--headless", "--fixed-fps", "60", "--path", str(OUT), "-s", "res://addons/horrorstudio_look/demo/soft_jiggle.gd", "--", f"--out={keep}"], capture_output=True, text=True, timeout=300)
        text = r.stdout + r.stderr
    except subprocess.TimeoutExpired as e:
        text = (e.stdout or b"").decode("utf-8", "replace") + (e.stderr or b"").decode("utf-8", "replace") + "\n(stopped after 300 s)"
    text = "\n".join(l for l in text.splitlines() if l and "ALSA" not in l and "snd_" not in l)
    bad = [l for l in text.splitlines() if "SCRIPT ERROR" in l or "Parse Error" in l or "SOFTJIGGLE FAIL" in l]
    if bad or "SOFTJIGGLE {" not in text:
        print(text[-3000:])
        print("JIGGLE FAIL: the soft bones' demo didn't run clean")
        return 1
    sr = json.loads((keep / "soft_jiggle.json").read_text(encoding="utf-8"))
    m = sr.get("made") or {}
    bones = {b["name"]: b for b in m.get("bones", [])}
    say(m.get("modifiers") == 1 and set(bones) == {"soft_bust_l", "soft_seat_l", "soft_other"}, "soft tissue: one HSSoftJiggle on the skeleton, a bone for each soft bone (%s)" % ", ".join(sorted(bones)))
    b, st, o = bones.get("soft_bust_l", {}), bones.get("soft_seat_l", {}), bones.get("soft_other", {})
    say(abs(b.get("length", 0) - 0.074) < 1e-6 and abs(st.get("length", 0) - 0.11) < 1e-6 and abs(o.get("length", 0) - 0.08) < 1e-6,
        "the bake's record read for the two it names (rods of %.1f and %.1f cm), the third's numbers made up (%.1f cm)" % (100 * b.get("length", 0), 100 * st.get("length", 0), 100 * o.get("length", 0)))
    want = [-0.154851, 0.074595, -0.032468]                # tools/animator/core/soft.js jiggleTick, the same weight let go
    got = m.get("ticks") or [9, 9, 9]
    say(len(got) == 3 and max(abs(a - w) for a, w in zip(got, want)) < 2e-4, "its tick is the Animator's: the same weight after 10, 20 and 30 ticks (%s rad)" % ", ".join("%.5f" % v for v in got))
    pl = m.get("plugin") or {}
    say(abs(pl.get("f", 0) - 3.669) < 0.01 and abs(pl.get("half", 0) - 0.1526) < 0.001, "JiggleBones' own default (stiffness 1, damping 0) rings at %.2f Hz and halves in %.2f s by this rule" % (pl.get("f", 0), pl.get("half", 0)))
    say((sr.get("rest") or {}).get("most", 9) < 0.02, "standing still, every soft bone as it rests (%.3f degrees off)" % (sr.get("rest") or {}).get("most", 9))
    rg = sr.get("ring") or {}
    wt = rg.get("want") or {"f": 1, "half": 1}
    say(abs(rg.get("first", 0)) > 12 and rg.get("crossings", 0) >= 4 and abs(rg.get("hz", 0) / wt["f"] - 1) < 0.08 and abs(rg.get("half", 0) / wt["half"] - 1) < 0.25 and rg.get("end", 9) < 0.2,
        "a weight let go from %.0f degrees rings at %.2f Hz and halves in %.2f s, as the rule says for its numbers (%.2f Hz, %.2f s), and comes to rest" % (abs(rg.get("first", 0)), rg.get("hz", 0), rg.get("half", 0), wt["f"], wt["half"]))
    jk = sr.get("jerk") or {}
    say(jk.get("most", 0) > 3 and jk.get("lag", 0) < -0.02 and jk.get("settled", 9) < 0.2 and jk.get("seat", 0) > 0.5 and jk.get("other", 0) > 0.5,
        "shoved 15 cm sideways in three frames: the weight stays behind (the breast's bone turns %.1f degrees against the shove, the seat's %.1f, the unnamed one %.1f) and settles back (%.2f)" % (
            jk.get("most", 0), jk.get("seat", 0), jk.get("other", 0), jk.get("settled", 9)))
    tn = sr.get("turn") or {}
    say(tn.get("most", 0) > 2 and tn.get("settled", 9) < 0.2, "turned 40 degrees in a tenth of a second: it lags %.1f degrees and settles" % tn.get("most", 0))
    sd = sr.get("steady") or {}
    say(sd.get("most", 9) < 0.3, "carried along evenly at 3.2 m/s: once going, no soft bone leans (%.2f degrees: its damping is against the body, not the air)" % sd.get("most", 9))
    gv = sr.get("gravity") or {}
    say(gv.get("angle", 0) > 4 and gv.get("lean", 0) > 0.05 and gv.get("off", 9) < 0.3, "laid on her back, where it rests has leaned %.1f degrees the way down has gone against her body; with gravity off, as stood (%.2f)" % (gv.get("angle", 0), gv.get("off", 9)))
    of = sr.get("off") or {}
    say(of.get("most", 9) < 0.01 and of.get("modifiers") == 1, "at amount 0 the same shove moves nothing (%.4f degrees)" % of.get("most", 9))
    cl = sr.get("clip") or {}
    say(cl.get("angle", 9) < 0.5 and abs(cl.get("shift", 0) - 0.01) < 1e-4 and abs(cl.get("without", 0) - 30) < 1,
        "a clip that turns a soft bone 30 degrees and shifts it a centimetre: the turn left out (%.2f degrees: the live swing takes its place), the shift kept (%.1f mm); the modifier off, the clip's turn shows (%.1f)" % (
            cl.get("angle", 9), 1000 * cl.get("shift", 0), cl.get("without", 0)))
    say((sr.get("teleport") or {}).get("most", 9) < 0.5, "put 5 m away in one frame: no swing (%.2f degrees)" % (sr.get("teleport") or {}).get("most", 9))
    if not ok:
        print("JIGGLE FAIL")
        return 1
    print("JIGGLE ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
