"""GDHAIR2: the hair editor v2.0's hair in Godot (docs/HAIR_V2.md). Each style made on MHR's base head by node
(tools/character/hair2/make.mjs: a head and its hair as a glb), loaded in a scratch Godot 4.7 project with the look
plugin and worn as the game wears hair (HSHair with the bake's records read from the file), pictured from five sides
under a reel's light, and measured: every hair mesh on the bake's look (shell normals, strand numbers); the skin seen
through the hair under a share of the hair's outline from every side (the scalp a flat marker colour in a second
picture: the gaps); the hair neither black nor bleached; the triangles within the style's budget; a tail's chain of
bones found. A contact sheet a style in Saved/Story/_look/godot_hair2/. Ends "GDHAIR2 ok".

    python tools/godot/hair2_check.py [--styles a,b] [--quick] [--keep DIR]
    python tools/godot/hair2_check.py shots --glb FILE.glb [--out DIR] [--tag NAME] [--shots front,q,side,back,top]
                                            [--size 960x720] [--frames 20] [--light reel|front|room] [--marker]
                                            [--origin x,y,z] [--hair JSON] [--frame head|bust] [--sheet FILE.jpg]

`shots` pictures any glb (the Character Studio's Preview in Godot posts the page's own head and hair to it; a Studio
export works too). Godot is $GODOT, else godot, else godot-mono; under xvfb when there's no display to draw on.
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
PROJECT = ROOT / "Saved" / "Godot" / "_hair2"
KEEP = ROOT / "Saved" / "Story" / "_look" / "godot_hair2"
MAKE = ROOT / "tools" / "character" / "hair2" / "make.mjs"
VIEWS = ["front", "q", "side", "back", "top"]


def project_text():
    look = "".join(f"{k[len('rendering/'):]}={'true' if v is True else 'false' if v is False else v}\n"
                   for k, v in PROJECT_LOOK.items() if k.startswith("rendering/"))
    return ('config_version=5\n\n[application]\n\nconfig/name="HorrorStudio hair check"\n'
            'config/features=PackedStringArray("4.7", "Forward Plus")\n\n[display]\n\n'
            'window/size/viewport_width=960\nwindow/size/viewport_height=720\nwindow/size/resizable=false\n\n'
            '[rendering]\n\nrenderer/rendering_method="forward_plus"\n' + look)


def godot_bin():
    for c in [os.environ.get("GODOT"), "godot", "godot-mono"]:
        if c and shutil.which(c):
            return shutil.which(c)
    return None


def project(fresh=False):
    """the scratch project: the look plugin (and HumanShaders, which its skin shader includes) and the picture script;
    imported once so the plugin's scripts and shaders load"""
    stamp = PROJECT / ".made"
    newest = max(p.stat().st_mtime for p in list(PLUGIN.rglob("*.gd")) + list(PLUGIN.rglob("*.gdshader*")) + [Path(__file__).with_name("hair2_shots.gd")])
    if not fresh and stamp.exists() and stamp.stat().st_mtime >= newest:
        return PROJECT
    if PROJECT.exists():
        shutil.rmtree(PROJECT)
    (PROJECT / "addons").mkdir(parents=True)
    (PROJECT / "project.godot").write_text(project_text(), encoding="utf-8")
    shutil.copytree(PLUGIN, PROJECT / "addons" / "horrorstudio_look")
    shutil.copytree(HUMAN, PROJECT / "HumanShaders", ignore=shutil.ignore_patterns("*.import"))
    shutil.copy(Path(__file__).with_name("hair2_shots.gd"), PROJECT / "hair2_shots.gd")
    subprocess.run([godot_bin(), "--headless", "--path", str(PROJECT), "--import"], capture_output=True, text=True, timeout=900, env=env())
    stamp.write_text("made", encoding="utf-8")
    return PROJECT


def env():
    e = dict(os.environ)
    if os.path.exists("/usr/share/vulkan/icd.d/lvp_icd.json") and not e.get("DISPLAY"):
        e.setdefault("VK_ICD_FILENAMES", "/usr/share/vulkan/icd.d/lvp_icd.json")
    return e


def shoot(glb, out, tag="hair", shots=None, size="960x720", frames=20, light="reel", marker=False, origin=None, hair=None, look="balanced", frame="head", timeout=3600):
    """the pictures of one glb: (report, error text)"""
    g = godot_bin()
    if not g:
        return None, "no godot ($GODOT, godot or godot-mono)"
    out = Path(out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    args = [f"--glb={Path(glb).resolve()}", f"--out={out}", f"--tag={tag}", f"--shots={','.join(shots or VIEWS)}", f"--size={size}", f"--frames={frames}",
            f"--light={light}", f"--look={look}", f"--frame={frame}"]
    if marker:
        args.append("--marker")
    if origin:
        args.append(f"--origin={origin}")
    if hair:
        args.append(f"--hair={hair}")
    cmd = [g, "--path", str(project()), "--rendering-driver", "vulkan", "-s", "res://hair2_shots.gd", "--"] + args
    if shutil.which("xvfb-run") and not os.environ.get("DISPLAY"):
        cmd = ["xvfb-run", "-a"] + cmd
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, env=env())
    text = "\n".join(l for l in (r.stdout + r.stderr).splitlines() if l and "ALSA" not in l and "snd_" not in l and "ERR_CANT_OPEN" not in l)
    if "switching to OpenGL 3" in text:
        return None, text + "\nVulkan failed and Godot fell back to OpenGL"
    bad = [l for l in text.splitlines() if "SCRIPT ERROR" in l or "SHADER ERROR" in l or "HAIR2SHOTS FAIL" in l or "Parse Error" in l]
    line = next((l for l in text.splitlines() if l.startswith("HAIR2SHOTS {")), None)
    if bad or not line:
        return None, text[-4000:]
    return json.loads(line[len("HAIR2SHOTS "):]), ""


def sheet(files, out, cols=None, label=None, height=360):
    """pictures side by side on one sheet (a row, or rows of `cols`)"""
    from PIL import Image, ImageDraw
    ims = []
    for f in files:
        im = Image.open(f).convert("RGB")
        ims.append(im.resize((round(im.width * height / im.height), height), Image.LANCZOS))
    cols = cols or len(ims)
    rows = [ims[i:i + cols] for i in range(0, len(ims), cols)]
    w = max(sum(i.width for i in r) for r in rows)
    top = 22 if label else 0
    S = Image.new("RGB", (w, top + height * len(rows)), (24, 24, 26))
    if label:
        ImageDraw.Draw(S).text((6, 4), label, fill=(220, 220, 220))
    for ri, r in enumerate(rows):
        x = 0
        for im in r:
            S.paste(im, (x, top + ri * height))
            x += im.width
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    S.save(out, quality=90)
    return out


def make(style, glb, body="base", sets=None):
    """a style grown on a body by node, as a glb (tools/character/hair2/make.mjs): (its stats, error text)"""
    cmd = ["node", str(MAKE), "--style", style, "--body", body, "--out", str(glb)]
    for kv in sets or []:
        cmd += ["--set", kv]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    line = next((l for l in r.stdout.splitlines() if "{" in l and "pores" in l), None)
    if r.returncode or not line:
        return None, (r.stdout + r.stderr)[-2000:]
    return json.loads(line[line.index("{"):]), ""


def cmd_sheets(a):
    """each style a row of views on one sheet (for looking at; no measures)"""
    from PIL import Image
    out = Path(a.out) if a.out else KEEP
    out.mkdir(parents=True, exist_ok=True)
    views = a.shots.split(",") if a.shots else VIEWS
    rows = []
    for st in a.styles.split(","):
        glb = out / f"{st}.glb"
        stats, err = make(st, glb, a.body, a.set)
        if stats is None:
            print(err)
            return 1
        rep, err = shoot(glb, out, st, views, a.size, a.frames, a.light, False, "0,0,0", a.hair, a.look, a.frame)
        if rep is None:
            print(err)
            return 1
        row = out / f"{st}_row.jpg"
        sheet([out / f"{st}_{v.replace(':', '_')}.png" for v in views], row, label=f"{st}: {stats['cards']} cards, {stats['triangles']} triangles, scalp covered {stats.get('covered', 0) * 100:.1f}% (two layers {stats.get('twoLayers', 0) * 100:.1f}%), grown in {stats['total']:.0f} ms", height=a.height)
        rows.append(Image.open(row))
        print(f"  {st}: {stats['cards']} cards, {stats['triangles']} triangles, {rep['seconds']:.0f} s of pictures")
    S = Image.new("RGB", (max(r.width for r in rows), sum(r.height for r in rows)), (24, 24, 26))
    y = 0
    for r in rows:
        S.paste(r, (0, y))
        y += r.height
    S.save(a.sheet or (out / "sheet.jpg"), quality=90)
    print(f"  sheet {a.sheet or (out / 'sheet.jpg')}")
    return 0


THUMBS = ROOT / "Content" / "Studio" / "Hair2" / "thumbs"


def cmd_thumbs(a):
    """the styles' cards: each style on MHR's base, pictured by Godot from three quarters, kept small in
    Content/Studio/Hair2/thumbs/<style>.jpg (the Character Studio's tab shows them)"""
    from PIL import Image
    out = Path(a.out) if a.out else ROOT / "Saved" / "Hair2" / "thumbs"
    out.mkdir(parents=True, exist_ok=True)
    THUMBS.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(["node", "-e", f"import('{(MAKE.parent / 'styles.js').as_posix()}').then(m => console.log(Object.keys(m.STYLES).join(',')))"], capture_output=True, text=True)
    names = [s for s in (a.styles.split(",") if a.styles else r.stdout.strip().split(",")) if s]
    view = "v:26:5:0.93:28:0:-0.065:0"
    for st in names:
        glb = out / f"{st}.glb"
        stats, err = make(st, glb)
        if stats is None:
            print(err)
            return 1
        rep, err = shoot(glb, out, st, [view], "512x512", 16, "reel", False, "0,0,0", None, "balanced", "head")
        if rep is None:
            print(err)
            return 1
        Image.open(out / f"{st}_{view.replace(':', '_')}.png").convert("RGB").resize((200, 200), Image.LANCZOS).save(THUMBS / f"{st}.jpg", quality=86)
        print(f"  {st}")
    print(f"  {len(names)} pictures in {THUMBS.relative_to(ROOT)}")
    return 0


def cmd_shots(a):
    out = Path(a.out) if a.out else KEEP
    rep, err = shoot(a.glb, out, a.tag, a.shots.split(",") if a.shots else None, a.size, a.frames, a.light, a.marker, a.origin, a.hair, a.look, a.frame)
    if rep is None:
        print(err)
        print("GDHAIR2 FAIL: the pictures didn't run clean")
        return 1
    names = [s.replace(":", "_") for s in (a.shots.split(",") if a.shots else VIEWS)]
    if a.sheet:
        sheet([out / f"{a.tag}_{s}.png" for s in names], a.sheet, label=a.label, height=a.height)
        print(f"  sheet {a.sheet}")
    print(json.dumps(rep))
    return 0


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd")
    s = sub.add_parser("shots")
    s.add_argument("--glb", required=True)
    s.add_argument("--out")
    s.add_argument("--tag", default="hair")
    s.add_argument("--shots")
    s.add_argument("--size", default="960x720")
    s.add_argument("--frames", type=int, default=20)
    s.add_argument("--light", default="reel")
    s.add_argument("--look", default="balanced")
    s.add_argument("--marker", action="store_true")
    s.add_argument("--frame", default="head")
    s.add_argument("--origin")
    s.add_argument("--hair")
    s.add_argument("--sheet")
    s.add_argument("--label")
    s.add_argument("--height", type=int, default=360)
    t = sub.add_parser("sheets")
    t.add_argument("--styles", required=True)
    t.add_argument("--body", default="base")
    t.add_argument("--set", action="append")
    t.add_argument("--out")
    t.add_argument("--shots")
    t.add_argument("--size", default="960x720")
    t.add_argument("--frames", type=int, default=16)
    t.add_argument("--light", default="reel")
    t.add_argument("--look", default="balanced")
    t.add_argument("--frame", default="head")
    t.add_argument("--hair")
    t.add_argument("--sheet")
    t.add_argument("--height", type=int, default=300)
    th = sub.add_parser("thumbs")
    th.add_argument("--styles")
    th.add_argument("--out")
    p.add_argument("--styles")
    p.add_argument("--quick", action="store_true")
    p.add_argument("--keep")
    a = p.parse_args()
    if a.cmd == "shots":
        return cmd_shots(a)
    if a.cmd == "sheets":
        return cmd_sheets(a)
    if a.cmd == "thumbs":
        return cmd_thumbs(a)
    print("GDHAIR2 FAIL: the check isn't written yet (use `shots`)")
    return 1


if __name__ == "__main__":
    sys.exit(main())
