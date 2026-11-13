"""GDMOTION: a character baked by the Animator (docs/ANIMATOR_V2.md), in Godot 4.7.

    python tools/godot/motion_check.py [--reuse] [--keep DIR]
        a by-hand project (godot_byhand.py new), a floor and the starter's Story; the normal woman's test body
        (tools/animator/bodies.mjs) baked and dropped in. Played headless (motion_test.gd): the file read at run time
        as a game reads a body (every clip, loops by their names, tracks on bones only and none on the face's, the soft
        bones, the bake's record) and as the editor imports it; the starter's motion.gd under her: walking somewhere at
        her walk's own speed with her planted foot not sliding, running, sitting on a seat and standing first when
        asked to walk, sleeping with her head on the pillow and waking, a door opened with her hand on its handle, a
        thing picked up from the floor and from a table, acts fired by the Story's words and chained, a clip of your
        own, and moves.gd using her own clips. Ends "GDMOTION ok".
    python tools/godot/motion_check.py shots --glb FILE.glb --clip walk_loop [--n 12] [--view side] [--sheet FILE.jpg]
                                             [--size 480x640] [--wear] [--tag NAME]
        a baked character's clip pictured at n moments on the real mesh in a scratch project, as one sheet

Godot is $GODOT, else godot; under xvfb when there's no display to draw on (the pictures).
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
PROJECT = ROOT / "Saved" / "Godot" / "_motion"
KEEP = ROOT / "Saved" / "Story" / "_look" / "godot_motion"


def godot_bin():
    for c in [os.environ.get("GODOT"), "godot", "godot-mono"]:
        if c and shutil.which(c):
            return shutil.which(c)
    return None


def env():
    e = dict(os.environ)
    if os.path.exists("/usr/share/vulkan/icd.d/lvp_icd.json") and not e.get("DISPLAY"):
        e.setdefault("VK_ICD_FILENAMES", "/usr/share/vulkan/icd.d/lvp_icd.json")
    return e


def project_text(size):
    w, h = size.split("x")
    return ('config_version=5\n\n[application]\n\nconfig/name="HorrorStudio motion check"\n'
            'config/features=PackedStringArray("4.7", "Forward Plus")\n\n[display]\n\n'
            f'window/size/viewport_width={w}\nwindow/size/viewport_height={h}\nwindow/size/resizable=false\n\n'
            '[rendering]\n\nrenderer/rendering_method="forward_plus"\nanti_aliasing/quality/msaa_3d=2\n')


def project(size="480x640", plugin=False):
    """the scratch project for a picture size (a picture is the project's window); with the look plugin when asked"""
    proj = PROJECT.with_name(f"{PROJECT.name}_{size}{'_look' if plugin else ''}")
    script = Path(__file__).with_name("motion_shots.gd")
    newest = max([script.stat().st_mtime] + ([p.stat().st_mtime for p in list(PLUGIN.rglob("*.gd")) + list(PLUGIN.rglob("*.gdshader*"))] if plugin else []))
    stamp = proj / ".made"
    if (proj / "project.godot").exists() and stamp.exists() and stamp.stat().st_mtime >= newest:
        return proj
    if proj.exists():
        shutil.rmtree(proj)
    proj.mkdir(parents=True)
    (proj / "project.godot").write_text(project_text(size), encoding="utf-8")
    if plugin:
        (proj / "addons").mkdir()
        shutil.copytree(PLUGIN, proj / "addons" / "horrorstudio_look")
        shutil.copytree(HUMAN, proj / "HumanShaders", ignore=shutil.ignore_patterns("*.import"))
    shutil.copy(script, proj / "motion_shots.gd")
    subprocess.run([godot_bin(), "--headless", "--path", str(proj), "--import"], capture_output=True, text=True, timeout=900, env=env())
    stamp.write_text("made", encoding="utf-8")
    return proj


def shoot(glb, plan, out, tag="motion", size="480x640", frames=6, wear=False, timeout=1800):
    """the pictures of a plan (motion_shots.gd): (report, error text)"""
    g = godot_bin()
    if not g:
        return None, "no godot ($GODOT or godot)"
    out = Path(out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    pf = out / f"{tag}_plan.json"
    pf.write_text(json.dumps(plan), encoding="utf-8")
    cmd = [g, "--path", str(project(size, wear)), "--rendering-driver", "vulkan", "-s", "res://motion_shots.gd", "--",
           f"--glb={Path(glb).resolve()}", f"--out={out}", f"--tag={tag}", f"--plan={pf}", f"--size={size}", f"--frames={frames}"] + (["--wear"] if wear else [])
    if shutil.which("xvfb-run") and not os.environ.get("DISPLAY"):
        cmd = ["xvfb-run", "-a"] + cmd
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, env=env())
    text = "\n".join(l for l in (r.stdout + r.stderr).splitlines() if l and "ALSA" not in l and "snd_" not in l and "ERR_CANT_OPEN" not in l)
    bad = [l for l in text.splitlines() if "SCRIPT ERROR" in l or "SHADER ERROR" in l or "MOTIONSHOTS FAIL" in l or "Parse Error" in l]
    line = next((l for l in text.splitlines() if l.startswith("MOTIONSHOTS {")), None)
    if bad or not line:
        return None, text[-3000:]
    return json.loads(line[len("MOTIONSHOTS "):]), ""


def sheet(files, out, cols=None, labels=None, height=420):
    from PIL import Image, ImageDraw
    ims = [Image.open(f).convert("RGB") for f in files]
    ims = [im.resize((round(im.width * height / im.height), height), Image.LANCZOS) for im in ims]
    cols = cols or len(ims)
    rows = (len(ims) + cols - 1) // cols
    w = max(im.width for im in ims)
    canvas = Image.new("RGB", (w * cols, height * rows), (30, 30, 32))
    d = ImageDraw.Draw(canvas)
    for i, im in enumerate(ims):
        canvas.paste(im, ((i % cols) * w, (i // cols) * height))
        if labels:
            d.text(((i % cols) * w + 5, (i // cols) * height + 4), labels[i], fill=(240, 240, 240))
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out, quality=88)
    return out


def clip_sheet(glb, clip, out_file, n=12, views=("side",), size="480x640", wear=False, tag=None, frames=6, secs=None):
    """one clip at n moments from each view, as a sheet; returns (report, error)"""
    tag = tag or Path(glb).stem
    plan = [{"clip": clip, "f": i / n if secs is None else None, "t": None if secs is None else secs * i / max(1, n - 1), "view": v, "name": f"{clip}_{v}_{i:02d}"} for v in views for i in range(n)]
    plan = [{k: v for k, v in s.items() if v is not None} for s in plan]
    rep, err = shoot(glb, plan, KEEP / tag, tag, size, frames, wear)
    if rep is None:
        return None, err
    files = [KEEP / tag / f for f in rep["shots"]]
    sheet(files, out_file, cols=n, labels=[f"{s['view']} {i % n}" for i, s in enumerate(plan)])
    return rep, ""


def check(args):
    """GDMOTION"""
    sys.path.insert(0, str(ROOT / "tools"))
    import godot_byhand as BH
    g = godot_bin()
    if not g:
        sys.exit("GDMOTION FAILED: no godot (tools/godot_setup.sh on a cloud session)")
    proj = Path(args[args.index("--keep") + 1]).resolve() if "--keep" in args else ROOT / "Saved" / "Godot" / "_motion_check"
    if "--reuse" in args and (proj / "motion.json").is_file():
        BH.install(proj, starter=True)
        print(f"  reusing {proj}")
    else:
        if proj.exists() and any(proj.iterdir()) and not (proj / "motion.json").exists():
            sys.exit(f"GDMOTION FAILED: {proj} has things in it this didn't make: give --keep a new folder")
        shutil.rmtree(proj, ignore_errors=True)
        if BH.main(["new", str(proj), "--name", "Motion"]):
            sys.exit("GDMOTION FAILED: godot_byhand.py new")
        (proj / "motion.json").write_text("{}", encoding="utf-8")
    (proj / "characters").mkdir(exist_ok=True)
    scratch = ROOT / "Saved" / "Animator" / "check"
    r = subprocess.run(["node", str(ROOT / "tools" / "animator" / "bodies.mjs"), "--out", str(scratch), "normal_woman"], capture_output=True, text=True, timeout=600)
    if "BODIES ok" not in r.stdout:
        sys.exit("GDMOTION FAILED: the test body: " + (r.stdout + r.stderr)[-1500:])
    r = subprocess.run(["node", str(ROOT / "tools" / "animator" / "bake.mjs"), str(scratch / "normal_woman.glb"), "--out", str(proj / "characters" / "normal_woman.glb")], capture_output=True, text=True, timeout=600)
    if "BAKE ok" not in r.stdout:
        sys.exit("GDMOTION FAILED: the bake: " + (r.stdout + r.stderr)[-1500:])
    for _ in range(3):
        subprocess.run([g, "--headless", "--path", str(proj), "--import"], capture_output=True, text=True, timeout=2400)
        if list((proj / ".godot" / "imported").glob("normal_woman.glb-*.scn")):
            break
    lines = ['[gd_scene load_steps=3 format=3]', "", '[ext_resource type="Script" path="res://starter/story.gd" id="story"]', "",
             '[sub_resource type="BoxShape3D" id="floor"]', "size = Vector3(60, 0.2, 60)", "", '[node name="Main" type="Node3D"]', "",
             '[node name="Floor" type="StaticBody3D" parent="."]', "transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, -0.1, 0)", "",
             '[node name="Shape" type="CollisionShape3D" parent="Floor"]', 'shape = SubResource("floor")', "",
             '[node name="Story" type="CanvasLayer" parent="."]', 'script = ExtResource("story")', 'tasks = PackedStringArray("key: Someone takes the key.")', ""]
    (proj / "main.tscn").write_text("\n".join(lines), encoding="utf-8")
    shutil.copy(Path(__file__).with_name("motion_test.gd"), proj / "motion_test.gd")
    r = subprocess.run([g, "--headless", "--path", str(proj), "--fixed-fps", "60", "-s", "motion_test.gd"], capture_output=True, text=True, timeout=1200)
    got = [ln for ln in r.stdout.splitlines() if ln.startswith("MOTION ")]
    for ln in got:
        if not ln.startswith("MOTION result "):
            print("  " + ln[7:])
    res = next((json.loads(ln.split(" ", 2)[2]) for ln in got if ln.startswith("MOTION result ")), None)
    if res is None:
        sys.exit("GDMOTION FAILED: Godot said nothing: " + (r.stdout + r.stderr)[-3000:])
    errs = list(res.get("errors", []))
    errs += [f"a script error: {ln.strip()}" for ln in (r.stdout + r.stderr).splitlines() if "SCRIPT ERROR" in ln or "Parse Error" in ln][:8]
    for e in errs:
        print("ERROR: " + e)
    print("GDMOTION ok" if not errs else f"GDMOTION FAILED ({len(errs)})")
    sys.exit(1 if errs else 0)


def main():
    if not sys.argv[1:] or sys.argv[1] != "shots":
        return check(sys.argv[1:])
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", nargs="?", default="shots")
    ap.add_argument("--glb")
    ap.add_argument("--clip", default="walk_loop")
    ap.add_argument("--n", type=int, default=12)
    ap.add_argument("--view", default="side")
    ap.add_argument("--size", default="480x640")
    ap.add_argument("--sheet")
    ap.add_argument("--wear", action="store_true")
    ap.add_argument("--tag")
    a = ap.parse_args()
    out = a.sheet or str(KEEP / f"{Path(a.glb).stem}_{a.clip}.jpg")
    rep, err = clip_sheet(a.glb, a.clip, out, a.n, tuple(a.view.split(",")), a.size, a.wear, a.tag)
    if rep is None:
        print(err)
        print("MOTIONSHOTS FAILED")
        sys.exit(1)
    print(f"  clips in the file: {', '.join(f'{k} ({v['secs']:.2f} s, loop {v['loop']})' for k, v in rep['clips'].items())}")
    print(f"  {out} ({rep['seconds']:.0f} s)")
    print("MOTIONSHOTS ok")


if __name__ == "__main__":
    main()
