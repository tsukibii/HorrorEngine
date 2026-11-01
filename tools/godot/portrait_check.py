"""GDPORTRAIT: a Character Studio export as a portrait in Godot, the way the game wears it (HSSkin with its detail
layer, HSEye, HSHair), under a character reel's light and the game's own lamp, at four distances: a medium close-up, a
close-up, an extreme close-up of the cheek (the pores) and the player's medium shot; the same again with the skin's
detail layer off, and the two side by side on one sheet. With hair: the salon's bake worn MetaHuman's way when the file
carries it (shell normals, strand numbers: GODOT_LOOK §5e) and the darkened scalp in its own colour. The measures: at the extreme close-up the detail layer gives
the cheek a fine grain the plain skin hasn't (the pores and the furrows between them), at the medium shot it changes
the picture little (no pattern from afar: the layer fades into roughness), and the skin is no brighter or darker for
it. Pictures and the sheet in Saved/Story/_look/godot_portrait/. Ends "GDPORTRAIT ok". Needs a Studio export (STUDIO
makes People/_studiotest).

    python tools/godot/portrait_check.py [--person NAME] [--preset young|natural|adult|old] [--plugin DIR] [--keep DIR]
                                         [--quick ecu,cu]   (those shots with the layer on, no measures: for tuning)

`--plugin DIR` pictures it with another copy of the look plugin (an older one, for a before and after: its
addons/horrorstudio_look folder); only the detail-on pictures are made then.

The skin's depth layer (GODOT_LOOK §5g) is measured too, under a baked level's light (the ambient alone, LightmapGI's
probes: `--light=baked`) at the close-up and in profile, off, on (as the export asks) and with its ears switched off,
points on the skin found by their UV (`skin_detail.probe_uvs`): round the eyes and the nose warmer with it (red against
green up), the ear warmer and back as it was with its switch off, the cheek and the forehead as they were, the picture
no brighter or darker; `depth_sheet.jpg` the three side by side. `--no-depth` leaves it out.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "Content" / "Python"))
from storykit.godot import PROJECT_LOOK  # noqa: E402 - the game's own project settings: the pictures are the game's

PLUGIN = ROOT / "GodotPlugins" / "HorrorStudioLook" / "addons" / "horrorstudio_look"
HUMAN = ROOT / "GodotPlugins" / "HumanShaders"
PEOPLE = ROOT / "Content" / "Studio" / "People"
OUT = ROOT / "Saved" / "Godot" / "_portrait"
KEEP = ROOT / "Saved" / "Story" / "_look" / "godot_portrait"
SHOTS = ["mcu", "cu", "ecu", "pov"]


def project_text(extra=None):
    look = "".join(f"{k[len('rendering/'):]}={'true' if v is True else 'false' if v is False else v}\n"
                   for k, v in {**PROJECT_LOOK, **(extra or {})}.items() if k.startswith("rendering/"))
    return ('config_version=5\n\n[application]\n\nconfig/name="HorrorStudio portrait check"\n'
            'config/features=PackedStringArray("4.7", "Forward Plus")\n\n[display]\n\n'
            'window/size/viewport_width=1280\nwindow/size/viewport_height=720\nwindow/size/resizable=false\n\n'
            '[rendering]\n\nrenderer/rendering_method="forward_plus"\n' + look)


def godot_bin():
    for c in [os.environ.get("GODOT"), "godot", "godot-mono"]:
        if c and shutil.which(c):
            return shutil.which(c)
    return None


def run(g, out, args, env):
    cmd = [g, "--path", str(out), "--rendering-driver", "vulkan", "-s", "res://addons/horrorstudio_look/demo/portrait.gd", "--"] + args
    if shutil.which("xvfb-run"):
        cmd = ["xvfb-run", "-a"] + cmd
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=1800, env=env)
    text = "\n".join(l for l in (r.stdout + r.stderr).splitlines() if l and "ALSA" not in l and "snd_" not in l and "ERR_CANT_OPEN" not in l)
    if "switching to OpenGL 3" in text:
        return None, text + "\nVulkan failed and Godot fell back to OpenGL"
    bad = [l for l in text.splitlines() if "SCRIPT ERROR" in l or "SHADER ERROR" in l or "PORTRAIT FAIL" in l]
    if bad or "PORTRAIT {" not in text:
        return None, text[-4000:]
    return text, ""


def shell_hair(glb):
    """the export carries the salon's bake as a volume (a hair material whose studioHair record has shell normals)"""
    import struct
    b = glb.read_bytes()
    j = json.loads(b[20:20 + struct.unpack("<I", b[12:16])[0]])
    return any("shell" in str((m.get("extras") or {}).get("studioHair", {}).get("normal", "")) for m in j.get("materials", []))


def sheet(keep, rows, path):
    """rows: [(label, tag)], each a row of the four shots, scaled to 480 x 270"""
    from PIL import Image, ImageDraw
    W, H = 480, 270
    im = Image.new("RGB", (W * len(SHOTS), (H + 22) * len(rows)), (20, 20, 20))
    d = ImageDraw.Draw(im)
    for r, (label, tag) in enumerate(rows):
        for c, s in enumerate(SHOTS):
            f = keep / f"{tag}_{s}.png"
            if f.exists():
                im.paste(Image.open(f).convert("RGB").resize((W, H)), (c * W, r * (H + 22) + 22))
        d.text((6, r * (H + 22) + 5), label, fill=(230, 230, 230))
    im.save(path, quality=90)


DEPTH_RUNS = [("depth_off", ["--depth=0"], "the skin's depth off"), ("depth_on", [], "the skin's depth (as the export asks)"),
              ("depth_noears", ["--ears=off"], "the skin's depth, its ears off")]


def depth_check(g, keep, base, env):
    """the depth layer (GODOT_LOOK §5g) off, on and with its ears off under a baked level's light; the measures; the
    sheet. Returns ok"""
    sys.path.insert(0, str(ROOT / "tools"))
    sys.path.insert(0, str(ROOT / "tools" / "character"))
    import mhr
    import skin_detail
    probes = skin_detail.probe_uvs(mhr.load())
    shots = {}
    for tag, extra, _ in DEPTH_RUNS:
        text, err = run(g, OUT, base + [f"--tag={tag}", "--shots=cu,side", "--light=baked", "--probe=" + json.dumps(probes)] + extra, env)
        if text is None:
            print(err)
            print(f"  BAD the depth layer's pictures ({tag}) didn't run clean")
            return False
        shots[tag] = json.loads((keep / f"{tag}.json").read_text(encoding="utf-8"))
    if "depth" not in shots["depth_on"]:
        print("  BAD the skin has no depth layer (skin_depth)")
        return False

    def warm(tag, shot, k):                                               # red against green where the camera sees the point
        p = shots[tag]["shots"][shot].get("probes", {}).get(k)
        return p[0] / max(p[1], 1e-4) if p else None
    ok = True

    def say(good, what):
        nonlocal ok
        print(("  ok  " if good else "  BAD ") + what)
        ok = ok and good
    on, off, noears = "depth_on", "depth_off", "depth_noears"
    core = {k: (warm(off, "cu", k), warm(on, "cu", k)) for k in ("inner corner +x", "alar crease +x", "nose wing +x")}
    seen = {k: v for k, v in core.items() if None not in v}
    say(len(seen) >= 2 and all(b > a * 1.08 for a, b in seen.values()),
        "round the eyes and the nose warmer with the skin's depth (red against green, baked light): " + ", ".join(f"{k} {a:.2f} to {b:.2f}" for k, (a, b) in seen.items()))
    e0, e1, e2 = warm(off, "side", "ear +x"), warm(on, "side", "ear +x"), warm(noears, "side", "ear +x")
    if None in (e0, e1, e2):
        say(False, "the ear isn't in the profile shot")
    else:
        if shots[on].get("depth_ears", True):
            say(e1 > e0 * 1.15, f"the ear warmer with it: {e0:.2f} to {e1:.2f}")
        else:
            print(f"  ok  the export has its ears' glow off (its hair over them): {e0:.2f} to {e1:.2f}")
        say(abs(e2 / e0 - 1) < 0.05, f"and back as it was with its ears switched off: {e2:.2f} against {e0:.2f}")
    rest = {k: (warm(off, "cu", k), warm(on, "cu", k)) for k in ("cheek +x", "forehead")}
    rest = {k: v for k, v in rest.items() if None not in v}
    say(len(rest) == 2 and all(abs(b / a - 1) < 0.06 for a, b in rest.values()),
        "the cheek and the forehead as they were: " + ", ".join(f"{k} {a:.2f} to {b:.2f}" for k, (a, b) in rest.items()))
    lum = {s: shots[on]["shots"][s]["lum"] / max(1e-6, shots[off]["shots"][s]["lum"]) for s in ("cu", "side")}
    say(all(0.92 < v < 1.08 for v in lum.values()), "and the picture no brighter or darker for it: " + ", ".join(f"{s} {v:.2f}" for s, v in lum.items()))
    try:
        from PIL import Image, ImageDraw
        W, H = 640, 360
        im = Image.new("RGB", (W * 2, (H + 22) * len(DEPTH_RUNS)), (20, 20, 20))
        d = ImageDraw.Draw(im)
        for r, (tag, _, label) in enumerate(DEPTH_RUNS):
            for c, s in enumerate(("cu", "side")):
                f = keep / f"{tag}_{s}.png"
                if f.exists():
                    im.paste(Image.open(f).convert("RGB").resize((W, H)), (c * W, r * (H + 22) + 22))
            d.text((6, r * (H + 22) + 5), label + " (a baked level's light)", fill=(230, 230, 230))
        im.save(keep / "depth_sheet.jpg", quality=90)
        print(f"  the depth sheet: {keep / 'depth_sheet.jpg'}")
    except ImportError:
        pass
    return ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--person", default="_studiotest")
    ap.add_argument("--preset", default="")
    ap.add_argument("--plugin", default="")
    ap.add_argument("--tag", default="")
    ap.add_argument("--keep", default=str(KEEP))
    ap.add_argument("--quick", default="")
    ap.add_argument("--hair", default="", help="the hair shader's numbers as JSON over the bake's (tuning)")
    ap.add_argument("--sss", type=int, default=-1, help="the screen-space scattering's quality for this run (0 off to 3 high; the game's own when unset)")
    ap.add_argument("--no-depth", action="store_true", help="leave the skin's depth layer's measures out")
    a = ap.parse_args()
    g = godot_bin()
    if not g:
        print("GDPORTRAIT FAIL: no godot")
        return 1
    glb = PEOPLE / a.person / "export" / f"{a.person}.glb"
    if not glb.exists():
        print(f"GDPORTRAIT FAIL: no export at {glb} (the Character Studio's Export for desk / Unreal, or STUDIO)")
        return 1
    plugin = Path(a.plugin) if a.plugin else PLUGIN
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "addons").mkdir(parents=True)
    (OUT / "people").mkdir()
    (OUT / "project.godot").write_text(project_text({"rendering/environment/subsurface_scattering/subsurface_scattering_quality": a.sss} if a.sss >= 0 else None), encoding="utf-8")
    shutil.copytree(plugin, OUT / "addons" / "horrorstudio_look")
    if a.plugin:                                                          # an older plugin: this picture-taker in it
        shutil.copy(PLUGIN / "demo" / "portrait.gd", OUT / "addons" / "horrorstudio_look" / "demo" / "portrait.gd")
    shutil.copytree(HUMAN, OUT / "HumanShaders", ignore=shutil.ignore_patterns("*.import"))
    shutil.copy(glb, OUT / "people" / glb.name)
    env = dict(os.environ)
    if os.path.exists("/usr/share/vulkan/icd.d/lvp_icd.json"):
        env.setdefault("VK_ICD_FILENAMES", "/usr/share/vulkan/icd.d/lvp_icd.json")
    subprocess.run([g, "--headless", "--path", str(OUT), "--import"], capture_output=True, text=True, timeout=900)
    keep = Path(a.keep).resolve()                                         # absolute: Godot runs inside its project folder
    keep.mkdir(parents=True, exist_ok=True)
    base = [f"--glb=res://people/{glb.name}", f"--out={keep}"] + ([f"--preset={a.preset}"] if a.preset else []) + ([f"--hair={a.hair}"] if a.hair else [])
    tag = a.tag or ("before" if a.plugin else "portrait")
    if a.quick:
        text, err = run(g, OUT, base + [f"--tag={tag}", f"--shots={a.quick}"], env)
        print(err or f"  pictures in {keep} ({tag}_*.png)")
        return 0 if text else 1
    text, err = run(g, OUT, base + [f"--tag={tag}"], env)
    if text is None:
        print(err)
        print("GDPORTRAIT FAIL: the portrait didn't run clean")
        return 1
    if a.plugin:
        print(f"  pictures in {keep} ({tag}_*.png)")
        print("GDPORTRAIT ok")
        return 0
    text, err = run(g, OUT, base + ["--tag=plain", "--detail=off"], env)
    if text is None:
        print(err)
        print("GDPORTRAIT FAIL: the portrait without the detail layer didn't run clean")
        return 1
    on = json.loads((keep / f"{tag}.json").read_text(encoding="utf-8"))
    off = json.loads((keep / "plain.json").read_text(encoding="utf-8"))
    ok = on.get("skin_mats", 0) >= 1
    print(("  ok  " if ok else "  BAD ") + "the skin on HSSkin (%d materials), its detail layer %.2f at %.1f mm a tile" % (
        on.get("skin_mats", 0), on.get("detail_amount") or 0, 1000 * (on.get("detail_scale") or 0)))
    e1, e0 = on["shots"]["ecu"], off["shots"]["ecu"]
    fine = e1["grain"] > e0["grain"] * 1.25
    print(("  ok  " if fine else "  BAD ") + "close up the cheek has the skin's fine grain: %.4f with the layer against %.4f without (over 1.25 times)" % (e1["grain"], e0["grain"]))
    p1, p0 = on["shots"]["pov"], off["shots"]["pov"]
    calm = p1["grain"] < p0["grain"] * 1.6
    print(("  ok  " if calm else "  BAD ") + "at the game's medium shot it adds no pattern: grain %.4f against %.4f (under 1.6 times)" % (p1["grain"], p0["grain"]))
    lum = all(0.85 < on["shots"][s]["lum"] / max(1e-6, off["shots"][s]["lum"]) < 1.12 for s in SHOTS)
    print(("  ok  " if lum else "  BAD ") + "and no brighter or darker for it: " + ", ".join(
        "%s %.2f" % (s, on["shots"][s]["lum"] / max(1e-6, off["shots"][s]["lum"])) for s in SHOTS))
    ok = ok and fine and calm and lum
    if on.get("hair_mats"):                                               # the hair (GODOT_LOOK §5e)
        if shell_hair(glb):
            worn = on.get("hair_baked", 0) >= 1
            print(("  ok  " if worn else "  BAD ") + "the salon's bake worn MetaHuman's way: %d of %d hair materials with its shell normals and strand numbers" % (on.get("hair_baked", 0), on["hair_mats"]))
            ok = ok and worn
        if on.get("scalps"):
            col = on.get("scalps_coloured", 0) == on["scalps"]
            print(("  ok  " if col else "  BAD ") + "the darkened scalp in its own colour, not the importer's white: %d of %d" % (on.get("scalps_coloured", 0), on["scalps"]))
            ok = ok and col
    rows = [("the skin's detail off", "plain"), ("the skin's detail on" + (f" ({a.preset})" if a.preset else ""), tag)]
    if (keep / "before_mcu.png").exists():
        rows.insert(0, ("before (the plugin as it was)", "before"))
    try:
        sheet(keep, rows, keep / "sheet.jpg")
        print(f"  the sheet: {keep / 'sheet.jpg'}")
    except ImportError:
        print("  (PIL missing: no sheet)")
    if not a.no_depth:
        ok = depth_check(g, keep, base, env) and ok
    print(f"  pictures in {keep}")
    if not ok:
        print("GDPORTRAIT FAIL")
        return 1
    print("GDPORTRAIT ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
