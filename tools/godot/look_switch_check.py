"""LOOKSWITCH: a character's looks, switched (docs/GODOT_LOOK.md §5r, DECISIONS 2026-11-12, later: "a tool that lets
us toggle between the eyes and skin shades (allows us to use default too), we should be able to make events or quests
trigger different looks"). In a `godot_byhand.py new` project, headless (the look plugin's demo/switch.gd): an
HSLookSwitch under a made-up figure with seven looks: a look at once (its skin on her skin alone, its eyes on both
eyes) and her default exactly back (the same materials as before); a turn over a second (nothing worn: all of it
coming in; from one look to another: half the old going, the swap, half the new coming; a look's own seconds); the
cloak with her eyes left glowing and with them cloaked, and back; an amount alone keeping the same skin on; a
creature skin keeps her shadow, the cloak takes it; next() through them in turn, fire(); the starter kit's own Story:
a task ticked puts its look on, a fact set the later look in the list, a look asked by hand staying until the story
changes; the starter's event area turning her by its `look_of` and `her_look`; a switch starting in a look; the picker: a
skin, eyes and a colour picked, the look saved as an HSLookPreset .tres and read back and added to her list, the code,
her named looks, the panel over the game finding every switch; the lists a preset offers the looks there are. With a
Studio export on the machine, the switch under her beside her HSCharacterLook. Then the look viewer run as a scene
under xvfb: her default, cloaked in front of the stripes with her eyes glowing, her eyes green with the lamp out,
pictured and the glow counted. Ends "LOOKSWITCH ok".

    python tools/godot/look_switch_check.py [--person NAME | --glb FILE] [--reuse] [--keep DIR] [--sheet FILE]
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
sys.path.insert(0, str(Path(__file__).resolve().parent))
import godot_byhand as BH  # noqa: E402
from creature_skin_check import find_export  # noqa: E402

proj = ROOT / "Saved" / "Godot" / "_look_switch"
KEEP = ROOT / "Saved" / "Story" / "_look" / "godot_look_switch"
VIEWER = "res://addons/horrorstudio_look/tools/look_viewer.tscn"


def godot_bin():
    for c in [os.environ.get("GODOT"), "godot", "godot-mono"]:
        if c and shutil.which(c):
            return shutil.which(c)
    return None


def clean(text):
    return "\n".join(l for l in text.splitlines() if l and "ALSA" not in l and "snd_" not in l and "ERR_CANT_OPEN" not in l)


def bad_lines(text):
    return [l for l in text.splitlines() if "SCRIPT ERROR" in l or "SHADER ERROR" in l or "Parse Error" in l]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--glb", default="")
    ap.add_argument("--person", default="")
    ap.add_argument("--keep", default=str(KEEP))
    ap.add_argument("--reuse", action="store_true", help="keep the last project (its import)")
    ap.add_argument("--sheet", default="", help="also copy the viewer's sheet here (the docs' picture)")
    a = ap.parse_args()
    g = godot_bin()
    if not g:
        print("LOOKSWITCH FAIL: no godot (tools/godot_setup.sh)")
        return 1
    glb = Path(a.glb) if a.glb else find_export(a.person)
    if (a.glb or a.person) and (glb is None or not glb.exists()):
        print(f"LOOKSWITCH FAIL: no export for Godot at {a.glb or a.person} (Export for Godot in the Character Studio)")
        return 1
    if not (a.reuse and (proj / "project.godot").exists()):
        if proj.exists():
            shutil.rmtree(proj)
        BH.new(proj) if hasattr(BH, "new") else subprocess.run([sys.executable, str(ROOT / "tools" / "godot_byhand.py"), "new", str(proj)], check=True, capture_output=True)
    else:
        subprocess.run([sys.executable, str(ROOT / "tools" / "godot_byhand.py"), "install", str(proj)], capture_output=True, text=True)
        for f in ["event_area.gd", "cue.gd", "story.gd"]:                # (install leaves starter/ alone: the scripts under test, fresh)
            shutil.copy(ROOT / "guides" / "first_game" / "starter" / f, proj / "starter" / f)
    if glb is not None:                                                # her, where the viewer looks for characters
        d = proj / "exports" / "characters" / glb.stem
        d.mkdir(parents=True, exist_ok=True)
        if not (d / glb.name).exists() or (d / glb.name).stat().st_size != glb.stat().st_size:
            shutil.copy(glb, d / glb.name)
    subprocess.run([g, "--headless", "--path", str(proj), "--import"], capture_output=True, text=True, timeout=1800)
    keep = Path(a.keep).resolve()
    keep.mkdir(parents=True, exist_ok=True)
    shutil.copy(ROOT / "GodotPlugins" / "HorrorStudioLook" / "addons" / "horrorstudio_look" / "demo" / "switch.gd", proj / "look_switch_test.gd")   # (a by-hand project doesn't carry the plugin's demo folder)
    cmd = [g, "--headless", "--path", str(proj), "-s", "res://look_switch_test.gd", "--", f"--out={keep}"]
    if glb is not None:
        cmd.append(f"--glb={glb}")
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
    text = clean(r.stdout + r.stderr)
    if bad_lines(text) or "SWITCH {done}" not in text:
        print(text[-3000:])
        print("LOOKSWITCH FAIL: the demo didn't run clean")
        return 1
    R = json.loads((keep / "switch.json").read_text(encoding="utf-8"))
    ok = True

    def say(good, words):
        nonlocal ok
        ok = ok and bool(good)
        print(("  ok  " if good else "  BAD ") + words)

    plain = {"skin": "default", "shirt": "default", "eye_l": "default", "eye_r": "default"}
    say(R["names"] == ["angry", "love", "gone", "watching", "night", "met", "slow"], "a switch with seven looks: %s" % ", ".join(R["names"]))
    say(R["angry"] == {"skin": "ember", "shirt": "default", "eye_l": "glow", "eye_r": "glow"} and R["angry_amounts"] == [1.0, 1.0, "angry", False],
        "a look at once: its skin on her skin alone (her shirt left), its eyes on both eyes, all of it, no turn left")
    say(R["angry_shadow"], "a creature skin keeps her shadow")
    say(R["default"] == plain and R["default_exact"], "her default exactly back: every mesh the material it had, her eyes' numbers at nothing, no look left on her")
    say(R["heard_first"] == ["angry", ""], "its signal: the look she's in, then her default")
    say(R["in_half"][:3] == [0.5, 0.5, True] and abs(R["in_half"][3] - 0.5) < 1e-6 and R["in_done"] == [1.0, 1.0, False],
        "a turn over a second from her default: all of it coming in (half at half a second, on her eyes' shader too; done at one)")
    oh, swp = R["out_half"], R["swapped"]
    say(oh[0]["skin"] == "ember" and oh[0]["eye_l"] == "glow" and abs(oh[1] - 0.5) < 1e-6 and abs(oh[2] - 0.5) < 1e-6,
        "from one look to another: the old going first (a quarter in: the ember and the glow at half)")
    say(swp[0] == {"skin": "default", "shirt": "default", "eye_l": "hearts", "eye_r": "hearts"} and swp[1] == 0.0 and abs(R["coming"] - 0.5) < 1e-6
        and R["love"] == [swp[0], 1.0, "love", False], "then the swap (her own skin back, the hearts on at nothing) and the new coming in (half, then all)")
    say(abs(R["slow_out"] - 0.5) < 1e-6 and R["slow_in"][0] == "stone" and abs(R["slow_in"][1] - 0.5) < 1e-6, "a look's own seconds over the switch's (two: the hearts half gone at half a second, the stone half on at one and a half)")
    w = R["watching"]
    say(w[0] == {"skin": "cloak", "shirt": "cloak", "eye_l": "glow", "eye_r": "glow"} and w[1] and w[2] and w[3],
        "the cloak with eyes: her skin and shirt cloaked on the cloak's shader, her eyes left on the eye shader and glowing in the colour asked, no shadow")
    say(R["gone"] == {"skin": "cloak", "shirt": "cloak", "eye_l": "cloaked", "eye_r": "cloaked"}, "the cloak alone: her eyes cloaked with the rest")
    say(R["after_cloak"] == [{"skin": "default", "shirt": "default", "eye_l": "hearts", "eye_r": "hearts"}, True] and R["default_after_cloak"],
        "out of it into another look (the cloak wholly off, her shadow back), then her default exactly")
    am = R["amount_alone"]
    say(abs(am[0] - 0.75) < 1e-6 and am[1] and abs(am[2] - 0.75) < 1e-6, "an amount alone: the same skin kept on (the same material), only how much of it (%.2f on its way to a half)" % am[0])
    say(R["next"] == ["angry", "love", "gone", "watching", "night", "met", "slow", "", "angry"], "next(): through her looks in turn, her default, round again")
    say(R["fire"] == "love" and R["missing"] is False, "fire() turns her to the look it names; a name she hasn't is refused")
    say(R["story_real"], "the starter kit's own Story in the project")
    if R["story_real"]:
        say(R["story_none"] == ["", ""], "the story: nothing asked for with the task still to do")
        say(R["story_task"] == ["night", "night", "pearl"], "a task ticked: its look on her (pearl)")
        say(R["story_fact"][:2] == ["met", "met"] and R["story_fact"][2] == {"skin": "default", "shirt": "default", "eye_l": "black", "eye_r": "black"},
            "a fact set: the later look in the list takes over (her eyes black, the pearl gone)")
        say(R["story_by_hand"] == "angry", "a look asked by hand stays until the story changes")
        say(R.get("event_area") == "love" and R.get("event_area_default") == ["", plain], "the starter's event area turns her by its look_of and her_look (a look by name; default, with the switch itself named)")
        say(R.get("cue_words") is True, "the starter's cue has the same two words")
    say(R["start"] == ["love", "hearts"], "a switch that starts in a look")
    pk = R["picked"]
    say(pk[0] == {"skin": "pearl", "shirt": "default", "eye_l": "spiral", "eye_r": "spiral"} and pk[1] and pk[2] == "custom",
        "the picker: a skin, eyes and a colour picked, and she's in them (a green spiral)")
    say('"skin": "pearl"' in R["code"] and '"eyes": "spiral"' in R["code"] and "show(" in R["code"], "as code: %s" % R["code"])
    say(R["saved"][0].endswith("looks_test/pearly.tres") and R["saved"][1] and R["saved"][2] and R["no_name"] == "",
        "saved as a look: %s, read back the same, in her list; none without a name" % R["saved"][0])
    say(R["picker_default"] == plain and R["picker_named"] == ["pearl", "pearly"], "its Default button and her named looks")
    say(R["panel"] == [True, 2, True], "the panel over the game finds every switch in the scene (%d) and closes again" % R["panel"][1])
    say(all(R["lists"]), "the skins and eyes a look offers are the looks there are (HSCreatureSkin's, HSEyeFx's)")
    who = R.get("who")
    if glb is None or not who:
        print("  --  no character exported for Godot on this machine (node tools/character/creatures.mjs make --only alien --export): the switch isn't tried on one")
    else:
        say(who["skin_before"] >= 1 and who["eyes_before"] == 2 and who["chrome_glow"] == [who["chrome_glow"][0], 2] and who["chrome_glow"][0] >= 1,
            "%s under her HSCharacterLook: chrome on her skin (%d surfaces), the glow on both eyes" % (glb.stem, who["chrome_glow"][0]))
        say(who["cloak_hearts"][1] == 2 and who["cloak_hearts"][2] == 2 and who["cloak"][1] == 0 and who["cloak"][0] > who["cloak_hearts"][0] - 1,
            "cloaked with hearts her eyes stay on the eye shader (2); cloaked alone they go with the rest (%d surfaces cloaked)" % who["cloak"][0])
        say(who["default"] == [0, 0, who["skin_before"], 2], "her default: nothing of a look on her, her skin on the skin shader, her eyes on theirs")
    # ---- the viewer, as a scene of its own
    env = dict(os.environ)
    if os.path.exists("/usr/share/vulkan/icd.d/lvp_icd.json"):
        env.setdefault("VK_ICD_FILENAMES", "/usr/share/vulkan/icd.d/lvp_icd.json")
    who_path = f"res://exports/characters/{glb.stem}/{glb.name}" if glb is not None else ""
    shots = [("default", []), ("cloak", ['--look={"skin":"cloak","eyes":"glow"}', "--behind=stripes", "--view=body"]), ("green", ['--look={"eyes":"glow","eye_color":"#22ff44"}', "--lamp=off"])]
    red = {}
    seen = True
    for name, more in shots:
        out = keep / f"viewer_{name}.png"
        if out.exists():
            out.unlink()
        cmd = [g, "--path", str(proj), "--rendering-driver", "vulkan", "--resolution", "1280x720", VIEWER, "--", f"--shot={out}"] + more + ([f"--glb={who_path}"] if who_path else [])
        if shutil.which("xvfb-run"):
            cmd = ["xvfb-run", "-a"] + cmd
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=1800, env=env)
        text = clean(r.stdout + r.stderr)
        if bad_lines(text) or not out.exists():
            print(text[-2000:])
            seen = False
            continue
        try:
            from PIL import Image
            im = Image.open(out).convert("RGB")
            px = im.load()
            n = 0
            for y in range(0, im.height, 2):
                for x in range(360, im.width, 2):                         # (right of the picker)
                    r_, g_, b_ = px[x, y]
                    if g_ > 140 and g_ > 1.6 * r_ and g_ > 1.6 * b_:
                        n += 1
            red[name] = n
        except ImportError:
            red[name] = -1
    say(seen, "the look viewer runs as a scene of its own and pictures %s in three looks" % (glb.stem if glb is not None else "its stand-in"))
    if seen and red.get("green", -1) >= 0:
        say(red["green"] > 8 and red["default"] == 0, "in it, the lamp out and her eyes asked for in green: they glow green (%d points of the picture, none in her default)" % red["green"])
    try:
        from PIL import Image, ImageDraw
        tiles = [(t, keep / f"viewer_{n}.png") for t, n in [("the look viewer: her default", "default"), ("cloaked in front of the stripes, her eyes left glowing", "cloak"), ("the lamp out, her eyes green", "green")]]
        tiles = [(t, f) for t, f in tiles if f.exists()]
        W, H = 640, 360
        im = Image.new("RGB", (W * len(tiles), H + 20), (12, 12, 12))
        d = ImageDraw.Draw(im)
        for i, (t, f) in enumerate(tiles):
            im.paste(Image.open(f).convert("RGB").resize((W, H)), (i * W, 20))
            d.text((i * W + 6, 4), t, fill=(230, 230, 230))
        im.save(keep / "look_viewer.jpg", quality=88)
        print(f"  the sheet: {keep / 'look_viewer.jpg'}")
        if a.sheet:
            shutil.copy(keep / "look_viewer.jpg", a.sheet)
    except (ImportError, FileNotFoundError, ValueError) as e:
        print(f"  (no sheet: {e})")
    if not ok:
        print("LOOKSWITCH FAIL")
        return 1
    print("LOOKSWITCH ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
