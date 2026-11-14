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
    python tools/godot/motion_check.py v3 [--reuse] [--quick]
        animations v3 (docs/ANIMATOR_V3.md) in the same project (motion3_test.gd): her head following the player
        within its range and letting go past it, the low gaits and what she rests in after, a peek past a wall's edge,
        a scare thrown and hidden, a thing held by its grip with her fingers round it, drinking and eating with the
        thing's mouth at hers, a punch and a swing carried onto who they're thrown at, a knock, the acts, moves.gd.
        Ends "GDMOTION3 ok".
    python tools/godot/motion_check.py small [--reuse] [--quick] [--only=imp,goblin]
        short bodies on a person's furniture (docs/ANIMATOR_V3.md §10; motion_small_test.gd) in the same project: a
        small child (1.10 m), a goblin and an imp baked beside the normal woman, each onto a 45 cm chair and off it
        (sat with its legs hanging, no leg in the chair), onto a 60 cm seat (lifted the rest of the way), into a 45 cm
        bed and out (nothing of it in the bed), and at a door whose handle is a metre up (its hand on the handle,
        carried there by the hand's IK). Ends "GDSMALL ok".
    python tools/godot/motion_check.py shots --glb FILE.glb --clip walk_loop [--n 12] [--view side] [--sheet FILE.jpg]
                                             [--size 480x640] [--wear] [--tag NAME]
        a baked character's clip pictured at n moments on the real mesh in a scratch project, as one sheet
    python tools/godot/motion_check.py sheets [--out docs/animator_sheets]
        the three test characters (tools/animator/people.mjs, baked) pictured wearing the look: their walks from the
        side and the front, their runs, their hands close up (standing, walking, running), and the normal woman's acts
    python tools/godot/motion_check.py sheets3 [--who NAME | --glb FILE.glb] [--out docs/animator_sheets] [--only low,peek]
        animations v3 (docs/ANIMATOR_V3.md) pictured on a baked character (the normal woman's unless another is named:
        a creature exported from the Studio and baked), a sheet a group: low (sneak, creep, crawl, scuttle), peek (round
        a wall, from in front and from behind), scares, fight, mouth (eat, drink), acts (look round, knock, cower, a
        reach to the floor)
    python tools/godot/motion_check.py furniture [--who NAME | --glb FILE.glb] [--plain] [--out docs/animator_sheets] [--only seat,bed,door]
        a baked character on the furniture its clips are made for (docs/ANIMATOR_V3.md §10), drawn as boxes from its
        own record: onto a chair, sat and off it; into a bed, asleep and out; a door pushed and pulled. --plain: a
        test body (tools/animator/bodies.mjs), which wears no look
    python tools/godot/motion_check.py shots3 [--who NAME | --glb FILE.glb] [--out DIR] [--only head,drink,swing]
        animations v3 in the game (motion3_shots.gd, in the check's own by-hand project: run the check first): her head
        following someone to her left and right and let go of behind her, a bottle taken from a table by its grip and
        drunk from, a bat taken and swung onto someone, a punch landing; eight pictures as JPEGs
    python tools/godot/motion_check.py gizmo [--out DIR]
        the grip's gizmo pictured in Godot's editor itself (grip_editor_shots.gd, a plugin of its own in the check's
        project, under xvfb): a water bottle's grip selected, the whole editor and the 3D view close; a bat's
    python tools/godot/motion_check.py guide3 [--date 2026-11-14]
        the Animator guide's pictures of animations v3 (guides/animator/img/v3_*.jpg, grip_*.jpg) put together from
        what the three above made: sheets3 for the normal woman, creature_ghoul and creature_goblin, shots3, gizmo

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
    v3 = "v3" in args                                        # animations v3's half (motion3_test.gd): the same project, another script
    small = "small" in args                                  # short bodies on a person's furniture (motion_small_test.gd): the same project, three more bodies
    NAME, TEST = ("GDSMALL", "motion_small_test.gd") if small else ("GDMOTION3", "motion3_test.gd") if v3 else ("GDMOTION", "motion_test.gd")
    bodies = ["child_small", "goblin", "imp", "normal_woman"] if small else ["normal_woman"]
    g = godot_bin()
    if not g:
        sys.exit(f"{NAME} FAILED: no godot (tools/godot_setup.sh on a cloud session)")
    proj = Path(args[args.index("--keep") + 1]).resolve() if "--keep" in args else ROOT / "Saved" / "Godot" / "_motion_check"
    if "--reuse" in args and (proj / "motion.json").is_file():
        BH.install(proj, starter=True)
        print(f"  reusing {proj}")
    else:
        if proj.exists() and any(proj.iterdir()) and not (proj / "motion.json").exists():
            sys.exit(f"{NAME} FAILED: {proj} has things in it this didn't make: give --keep a new folder")
        shutil.rmtree(proj, ignore_errors=True)
        if BH.main(["new", str(proj), "--name", "Motion"]):
            sys.exit(f"{NAME} FAILED: godot_byhand.py new")
        (proj / "motion.json").write_text("{}", encoding="utf-8")
    (proj / "characters").mkdir(exist_ok=True)
    scratch = ROOT / "Saved" / "Animator" / "check"
    imported = lambda: all(list((proj / ".godot" / "imported").glob(f"{b}.glb-*.scn")) for b in bodies)
    if not ("--reuse" in args and "--quick" in args and imported()):   # (--quick: the scripts changed, the bodies didn't: no bake, no import)
        r = subprocess.run(["node", str(ROOT / "tools" / "animator" / "bodies.mjs"), "--out", str(scratch)] + bodies, capture_output=True, text=True, timeout=900)
        if "BODIES ok" not in r.stdout:
            sys.exit(f"{NAME} FAILED: the test body: " + (r.stdout + r.stderr)[-1500:])
        for b in bodies:
            r = subprocess.run(["node", str(ROOT / "tools" / "animator" / "bake.mjs"), str(scratch / f"{b}.glb"), "--out", str(proj / "characters" / f"{b}.glb")], capture_output=True, text=True, timeout=600)
            if "BAKE ok" not in r.stdout:
                sys.exit(f"{NAME} FAILED: the bake of {b}: " + (r.stdout + r.stderr)[-1500:])
        for _ in range(3):
            subprocess.run([g, "--headless", "--path", str(proj), "--import"], capture_output=True, text=True, timeout=2400)
            if imported():
                break
    lines = ['[gd_scene load_steps=3 format=3]', "", '[ext_resource type="Script" path="res://starter/story.gd" id="story"]', "",
             '[sub_resource type="BoxShape3D" id="floor"]', "size = Vector3(60, 0.2, 60)", "", '[node name="Main" type="Node3D"]', "",
             '[node name="Floor" type="StaticBody3D" parent="."]', "transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, -0.1, 0)", "",
             '[node name="Shape" type="CollisionShape3D" parent="Floor"]', 'shape = SubResource("floor")', "",
             '[node name="Story" type="CanvasLayer" parent="."]', 'script = ExtResource("story")', 'tasks = PackedStringArray("key: Someone takes the key.")', ""]
    (proj / "main.tscn").write_text("\n".join(lines), encoding="utf-8")
    shutil.copy(Path(__file__).with_name(TEST), proj / TEST)
    more = ["--"] + [x for x in args if x.startswith("--only=")] if any(x.startswith("--only=") for x in args) else []
    r = subprocess.run([g, "--headless", "--path", str(proj), "--fixed-fps", "60", "-s", TEST] + more, capture_output=True, text=True, timeout=1200)
    got = [ln for ln in r.stdout.splitlines() if ln.startswith("MOTION ")]
    for ln in got:
        if not ln.startswith("MOTION result "):
            print("  " + ln[7:])
    res = next((json.loads(ln.split(" ", 2)[2]) for ln in got if ln.startswith("MOTION result ")), None)
    if res is None:
        sys.exit(f"{NAME} FAILED: Godot said nothing: " + (r.stdout + r.stderr)[-3000:])
    errs = list(res.get("errors", []))
    out = (r.stdout + r.stderr).splitlines()
    errs += [f"a script error: {ln.strip()} {out[i + 1].strip() if i + 1 < len(out) else ''}" for i, ln in enumerate(out) if "SCRIPT ERROR" in ln or "Parse Error" in ln][:8]
    for e in errs:
        print("ERROR: " + e)
    print(f"{NAME} ok" if not errs else f"{NAME} FAILED ({len(errs)})")
    sys.exit(1 if errs else 0)


def doc_sheets(out_dir):
    """the three test characters' sheets (docs/animator_sheets): their walks from the side and the front, and one's acts"""
    out_dir = Path(out_dir)
    people = [("anim_skinny_man", "the skinny man"), ("anim_normal_woman", "the normal woman"), ("anim_chubby_woman", "the chubby woman")]
    files = {n: next((p for p in [ROOT / "Exports" / "characters" / n / f"{n}.glb"] if p.is_file()), None) for n, _ in people}
    if not all(files.values()):
        sys.exit("the three test characters aren't on this machine: node tools/animator/people.mjs (the Studio's server running), then bake each")
    n = 8
    for view, name in [("side", "three_walks"), ("front", "three_walks_front")]:
        rows = []
        for who, label in people:
            plan = [{"clip": "walk_loop", "f": i / n, "view": view, "name": f"walk_{view}_{i:02d}"} for i in range(n)]
            rep, err = shoot(files[who], plan, KEEP / who, who, "400x520", 5, True)
            if rep is None:
                sys.exit(err)
            rows += [KEEP / who / f for f in rep["shots"]]
        sheet(rows, out_dir / f"2026-11-13_{name}.jpg", cols=n, height=420)
        print(f"  {out_dir / f'2026-11-13_{name}.jpg'}")
    # the runs, from the side and the front (the arms carried bent, the fists going from the hip to the chest, the palms to the body)
    rows = []
    for view in ["side", "front"]:
        for who, label in people:
            plan = [{"clip": "run_loop", "f": i / n, "view": view, "name": f"run_{view}_{i:02d}"} for i in range(n)]
            rep, err = shoot(files[who], plan, KEEP / who, who, "400x520", 5, True)
            if rep is None:
                sys.exit(err)
            rows += [KEEP / who / f for f in rep["shots"]]
    sheet(rows, out_dir / "2026-11-13_three_runs.jpg", cols=n, height=380)
    print(f"  {out_dir / '2026-11-13_three_runs.jpg'}")
    # the hands close up: standing, three moments of the walk, three of the run (her left hand, seen from in front and to her left)
    rows = []
    for who, label in people:
        plan = [{"clip": c, "f": f, "bone": "l_middle1", "yaw": 55, "pitch": 8, "dist": 0.62, "fov": 26, "name": f"hand_{c}_{k}"} for k, (c, f) in enumerate(
            [("idle_loop", 0.0), ("walk_loop", 0.0), ("walk_loop", 0.25), ("walk_loop", 0.5), ("run_loop", 0.0), ("run_loop", 0.25), ("run_loop", 0.5), ("run_loop", 0.75)])]
        rep, err = shoot(files[who], plan, KEEP / who, who + "_hands", "400x400", 5, True)
        if rep is None:
            sys.exit(err)
        rows += [KEEP / who / f for f in rep["shots"]]
    sheet(rows, out_dir / "2026-11-13_hands.jpg", cols=8, labels=(["standing", "walking", "", "", "running", "", "", ""] * 3), height=300)
    print(f"  {out_dir / '2026-11-13_hands.jpg'}")
    who = "anim_normal_woman"
    acts = [("sit_down", "q"), ("lie_down", "q"), ("open_push", "side"), ("reach_low", "q"), ("reach_high", "q"), ("run_loop", "side")]
    plan = [{"clip": c, "f": i / (n - 1) * 0.999, "view": v, "name": f"{c}_{i:02d}", "at": [0, 0.8, -0.15], "dist": 4.4} for c, v in acts for i in range(n)]
    rep, err = shoot(files[who], plan, KEEP / who, who + "_acts", "400x440", 5, True)
    if rep is None:
        sys.exit(err)
    sheet([KEEP / who / f for f in rep["shots"]], out_dir / "2026-11-13_acts.jpg", cols=n, labels=[f"{s['clip']}" if i % n == 0 else "" for i, s in enumerate(plan)], height=360)
    print(f"  {out_dir / '2026-11-13_acts.jpg'}")
    print("SHEETS ok")


def v3_sheets(args):
    """animations v3 on a baked character, a sheet a group (docs/animator_sheets/<date>_v3_<group>.jpg)"""
    opt = lambda k, d=None: args[args.index(k) + 1] if k in args else d
    who = opt("--who", "anim_normal_woman")
    glb = Path(opt("--glb") or ROOT / "Exports" / "characters" / who / f"{who}.glb")
    out_dir = Path(opt("--out", ROOT / "docs" / "animator_sheets"))
    only = [x for x in (opt("--only") or "").split(",") if x]
    rec_file = glb.with_name(glb.stem + ".motion.json")
    if not glb.is_file() or not rec_file.is_file():
        sys.exit(f"{glb} isn't there, or isn't baked (node tools/animator/bake.mjs {glb})")
    rec = json.loads(rec_file.read_text(encoding="utf-8"))
    if "peek_out" not in rec["clips"]:
        sys.exit(f"{glb.name} was baked before animations v3: node tools/animator/bake.mjs {glb}")
    k = float(rec["body"]["height"]) / 163.0                    # the camera's distances are a 1.63 m woman's: by the body's own height
    edge = rec["clips"]["peek_out"]["peek"]["edge"]
    wall = [[edge[0] + 0.75 * k, 1.1 * k, edge[2] + 0.06, 1.5 * k, 2.2 * k, 0.12]]   # the wall she peeks round: its end at the record's edge, off to her left
    v = lambda at, dist, **more: {"at": [a * k for a in at], "dist": dist * k, **more}
    groups = {
        "low": [("sneak_loop", "side", {}), ("creep_loop", "side", {}), ("crawl_loop", "side", v([0, 0.45, 0.2], 3.4)), ("scuttle_loop", "side", v([0, 0.45, 0.2], 3.4))],
        "peek": [("peek_out", "front", v([-0.25, 1.05, 0], 3.3, boxes=wall)), ("peek_out", "side", v([-0.1, 1.0, 0.1], 3.6, boxes=wall, yaw=-150, pitch=14)), ("peek_loop", "front", v([-0.3, 1.25, 0.2], 1.7, boxes=wall))],
        "scares": [("scare_lunge", "q", v([0, 0.82, 0.2], 4.6)), ("scare_loom", "q", {}), ("scare_snap", "front", {}), ("scare_claw", "q", v([0, 0.5, 0.2], 3.6))],
        "fight": [("punch", "side", v([0, 0.82, 0.2], 4.4)), ("swing", "side", v([0, 0.82, 0.2], 4.4)), ("swing", "front", {}), ("hit_react", "side", v([0, 0.82, -0.1], 4.4))],
        "mouth": [("eat", "q", v([0, 1.25, 0], 2.3)), ("drink", "q", v([0, 1.25, 0], 2.3))],
        "acts": [("look_around", "front", {}), ("knock", "side", {}), ("cower_loop", "q", {}), ("reach_low", "side", v([0, 0.7, 0.1], 4.0))],
    }
    n, date = 8, opt("--date", "2026-11-14")
    tag = "v3" if who == "anim_normal_woman" and not opt("--glb") else f"v3_{glb.stem}"
    for name, rows in groups.items():
        if only and name not in only:
            continue
        plan, labels = [], []
        for clip, view, extra in rows:
            for i in range(n):
                f = i / n if clip.endswith("_loop") else i / (n - 1) * 0.999
                plan.append({"clip": clip, "f": f, "view": view, "name": f"{clip}_{view}_{i:02d}", **extra})
                labels.append(f"{clip} ({'from behind' if extra.get('yaw') else view})" if i == 0 else "")
        rep, err = shoot(glb, plan, KEEP / (glb.stem + "_v3"), glb.stem + "_" + name, "400x440", 5, True)
        if rep is None:
            sys.exit(err)
        out = out_dir / f"{date}_{tag}_{name}.jpg"
        sheet([KEEP / (glb.stem + "_v3") / f for f in rep["shots"]], out, cols=n, labels=labels, height=330)
        print(f"  {out}")
    print("SHEETS3 ok")


def furniture_sheets(args):
    """a baked character on the furniture its clips are made for (docs/ANIMATOR_V3.md §10), a sheet a group:
    seat (onto a chair, sat, off it), bed (into bed, out of it), door (pushed, pulled)"""
    opt = lambda k, d=None: args[args.index(k) + 1] if k in args else d
    who = opt("--who", "anim_normal_woman")
    glb = Path(opt("--glb") or ROOT / "Exports" / "characters" / who / f"{who}.glb")
    out_dir = Path(opt("--out", ROOT / "docs" / "animator_sheets"))
    only = [x for x in (opt("--only") or "").split(",") if x]
    rec_file = glb.with_name(glb.stem + ".motion.json")
    if not glb.is_file() or not rec_file.is_file():
        sys.exit(f"{glb} isn't there, or isn't baked (node tools/animator/bake.mjs {glb})")
    rec = json.loads(rec_file.read_text(encoding="utf-8"))
    C = rec["clips"]
    if "furniture" not in rec and "high" not in C["sit_down"]["seat"] and float(rec["body"]["height"]) < 140:
        sys.exit(f"{glb.name} was baked before the furniture went by the body: node tools/animator/bake.mjs {glb}")
    k = float(rec["body"]["height"]) / 163.0
    seat, bed, door = C["sit_down"]["seat"], C["lie_down"]["bed"], C["open_push"]["door"]
    H, e = float(seat["height"]), float(seat["edge"])
    chair = [[0, H / 2, e - 0.24, 0.48, H, 0.48], [0, H + 0.2, e - 0.46, 0.48, 0.4, 0.04]]              # a seat and its back
    Hb, eb, head = float(bed["height"]), float(bed["edge"]), bed["head"]
    x0, x1 = -0.75 * max(k, 0.6), float(head[0]) + 0.4
    beds = [[(x0 + x1) / 2, Hb / 2, eb - 0.5, x1 - x0, Hb, 1.0], [x1 + 0.03, Hb / 2 + 0.25, eb - 0.5, 0.06, Hb + 0.5, 1.0]]   # a bed and its headboard
    hd = door["handle"]
    frame = lambda d: [[hd[0] + 0.45, 1.0, d["handle"][2] + 0.03, 0.08, 2.0, 0.1], [d["handle"][0] + 0.2, d["handle"][1], d["handle"][2] + 0.005, 0.5, 0.025, 0.03]]   # the frame's post beyond it (the camera is on her right), and a bar at the handle's height where the handle is before it moves
    v = lambda at, dist, **more: {"at": at, "dist": dist, **more}
    tall = float(rec["body"]["height"]) / 100.0
    mid = max(0.75, 0.52 * tall)
    groups = {
        "seat": [("sit_down", "q", v([0, mid, -0.1], 3.6, boxes=chair)), ("sit_loop", "side", v([0, mid, -0.1], 3.4, boxes=chair)), ("stand_up", "q", v([0, mid, -0.1], 3.6, boxes=chair))],
        "bed": [("lie_down", "q", v([0.25, mid * 0.9, -0.3], 4.6, boxes=beds)), ("sleep_loop", "q", v([0.3, Hb + 0.15, -0.5], 3.4, boxes=beds, pitch=28)), ("get_up", "q", v([0.25, mid * 0.9, -0.3], 4.6, boxes=beds))],
        "door": [("open_push", "side", v([0, max(0.8, 0.55 * tall), 0.25], 3.4, boxes=frame(C["open_push"]["door"]))), ("open_pull", "side", v([0, max(0.8, 0.55 * tall), 0.25], 3.4, boxes=frame(C["open_pull"]["door"])))],
    }
    n, date = 8, opt("--date", "2026-11-14")
    wear = "--plain" not in args
    for name, rows in groups.items():
        if only and name not in only:
            continue
        plan, labels = [], []
        for clip, view, extra in rows:
            for i in range(n):
                f = i / n if clip.endswith("_loop") else i / (n - 1) * 0.999
                plan.append({"clip": clip, "f": f, "view": view, "name": f"{clip}_{view}_{i:02d}", **extra})
                labels.append(f"{clip} ({view})" if i == 0 else "")
        rep, err = shoot(glb, plan, KEEP / (glb.stem + "_furniture"), glb.stem + "_" + name, "400x440", 5, wear)
        if rep is None:
            sys.exit(err)
        out = out_dir / f"{date}_furniture_{glb.stem}_{name}.jpg"
        sheet([KEEP / (glb.stem + "_furniture") / f for f in rep["shots"]], out, cols=n, labels=labels, height=330)
        print(f"  {out}")
    print("FURNITURESHEETS ok")


def v3_shots(args):
    """animations v3 pictured in the game: the head, a grip, a swing, a punch (motion3_shots.gd)"""
    from PIL import Image
    opt = lambda k, d=None: args[args.index(k) + 1] if k in args else d
    who = opt("--who", "anim_normal_woman")
    glb = Path(opt("--glb") or ROOT / "Exports" / "characters" / who / f"{who}.glb").resolve()
    out = Path(opt("--out", KEEP / (glb.stem + "_game"))).resolve()
    proj = ROOT / "Saved" / "Godot" / "_motion_check"
    g = godot_bin()
    if not g or not (proj / "project.godot").is_file() or not glb.is_file():
        sys.exit("shots3: run the check first (python tools/godot/motion_check.py v3), and bake the character")
    shutil.copy(Path(__file__).with_name("motion3_shots.gd"), proj / "motion3_shots.gd")
    shutil.copytree(PLUGIN, proj / "addons" / "horrorstudio_look", dirs_exist_ok=True)       # (the plugin and the starter as they are now)
    for f in ["motion.gd", "act.gd", "moves.gd"]:
        shutil.copy(ROOT / "guides" / "first_game" / "starter" / f, proj / "starter" / f)
    raw = out / "raw"
    raw.mkdir(parents=True, exist_ok=True)
    cmd = [g, "--path", str(proj), "--rendering-driver", "vulkan", "--resolution", "900x900", "--fixed-fps", "60", "-s", "res://motion3_shots.gd", "--", f"--glb={glb}", f"--out={raw}"] + ([f"--only={opt('--only')}"] if opt("--only") else [])
    if shutil.which("xvfb-run") and not os.environ.get("DISPLAY"):
        cmd = ["xvfb-run", "-a", "-s", "-screen 0 900x900x24"] + cmd
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=1500, env=env())
    text = "\n".join(l for l in (r.stdout + r.stderr).splitlines() if l and "ALSA" not in l and "snd_" not in l)
    line = next((l for l in text.splitlines() if l.startswith("MOTION3SHOTS {")), None)
    bad = [l for l in text.splitlines() if "SCRIPT ERROR" in l or "Parse Error" in l or "MOTION3SHOTS FAIL" in l]
    if bad or not line:
        print(text[-3000:])
        sys.exit("MOTION3SHOTS FAILED")
    rep = json.loads(line[len("MOTION3SHOTS "):])
    for f in rep["shots"]:
        Image.open(raw / f).convert("RGB").save(out / (Path(f).stem + ".jpg"), quality=88)
    for n in rep["notes"]:
        print("  " + n)
    print(f"  {len(rep['shots'])} pictures in {out}")
    print("MOTION3SHOTS ok")


def gizmo_shots(args):
    """the grip's gizmo pictured in the editor (grip_editor_shots.gd, installed as a plugin of its own)"""
    from PIL import Image
    opt = lambda k, d=None: args[args.index(k) + 1] if k in args else d
    out = Path(opt("--out", KEEP / "grip_gizmo")).resolve()
    proj = ROOT / "Saved" / "Godot" / "_motion_check"
    g = godot_bin()
    if not g or not (proj / "project.godot").is_file():
        sys.exit("gizmo: run the check first (python tools/godot/motion_check.py v3)")
    shutil.copytree(PLUGIN, proj / "addons" / "horrorstudio_look", dirs_exist_ok=True)
    t = proj / "addons" / "hs_grip_shots"
    t.mkdir(parents=True, exist_ok=True)
    (t / "plugin.cfg").write_text('[plugin]\nname="hs grip shots"\ndescription=""\nauthor=""\nversion="1"\nscript="plugin.gd"\n', encoding="utf-8")
    shutil.copy(Path(__file__).with_name("grip_editor_shots.gd"), t / "plugin.gd")
    raw = out / "raw"
    raw.mkdir(parents=True, exist_ok=True)
    (proj / "grip_shots.json").write_text(json.dumps({"out": str(raw)}), encoding="utf-8")
    subprocess.run([g, "--headless", "--path", str(proj), "--import"], capture_output=True, text=True, timeout=900, env=env())
    pg = proj / "project.godot"
    before = pg.read_text(encoding="utf-8").replace('"res://addons/hs_grip_shots/plugin.cfg", ', "")     # (a run that was killed leaves it in)
    pg.write_text(before.replace("enabled=PackedStringArray(", 'enabled=PackedStringArray("res://addons/hs_grip_shots/plugin.cfg", ', 1), encoding="utf-8")
    try:
        shutil.rmtree(proj / ".godot" / "editor", ignore_errors=True)                                  # (a fresh layout)
        e = env()
        if os.path.exists("/usr/share/vulkan/icd.d/lvp_icd.json") and not e.get("DISPLAY"):
            e.setdefault("VK_ICD_FILENAMES", "/usr/share/vulkan/icd.d/lvp_icd.json")
        cmd = [g, "--editor", "--path", str(proj), "--rendering-driver", "vulkan", "--resolution", "1920x1080"]
        if shutil.which("xvfb-run"):
            cmd = ["xvfb-run", "-a", "-s", "-screen 0 1920x1080x24"] + cmd
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=600, env=e)
    finally:
        pg.write_text(before, encoding="utf-8")
        shutil.rmtree(t, ignore_errors=True)
        for f in ["grip_demo.tscn", "grip_shots.json"]:
            (proj / f).unlink(missing_ok=True)
    text = r.stdout + r.stderr
    line = next((l for l in text.splitlines() if l.startswith("GRIPSHOTS {")), None)
    if not line:
        print(text[-3000:])
        sys.exit("GRIPSHOTS FAILED: the editor said nothing")
    rep = json.loads(line[len("GRIPSHOTS "):])
    for f in raw.glob("*.png"):
        Image.open(f).convert("RGB").save(out / (f.stem + ".jpg"), quality=88)
    for d in rep["shots"]:
        print("  " + d)
    for e2 in rep["errors"]:
        print("ERROR: " + e2)
    print(f"  pictures in {out}")
    print("GRIPSHOTS ok" if not rep["errors"] else "GRIPSHOTS FAILED")


def guide3(args):
    """the Animator guide's v3 pictures, from the sheets (sheets3), the game's pictures (shots3) and the editor's (gizmo)"""
    from PIL import Image
    opt = lambda k, d=None: args[args.index(k) + 1] if k in args else d
    date, sheets, img = opt("--date", "2026-11-14"), ROOT / "docs" / "animator_sheets", ROOT / "guides" / "animator" / "img"
    game, giz = KEEP / "anim_normal_woman_game", KEEP / "grip_gizmo"
    sh = lambda name, who="": Image.open(sheets / f"{date}_v3_{who + '_' if who else ''}{name}.jpg").convert("RGB")
    row = lambda im, r, h=330: im.crop((0, r * h, im.width, (r + 1) * h))          # (a sheet's row: one clip, eight moments)
    def stack(rows, out):
        w = max(r.width for r in rows)
        c = Image.new("RGB", (w, sum(r.height for r in rows)), (30, 30, 32))
        y = 0
        for r in rows:
            c.paste(r, (0, y))
            y += r.height
        c.save(img / out, quality=86)
        print(f"  {img / out}  {c.size[0]}x{c.size[1]}")
    def beside(files, out, h=600):
        ims = [Image.open(f).convert("RGB") for f in files]
        ims = [im.resize((round(im.width * h / im.height), h), Image.LANCZOS) for im in ims]
        c = Image.new("RGB", (sum(im.width for im in ims), h), (30, 30, 32))
        x = 0
        for im in ims:
            c.paste(im, (x, 0))
            x += im.width
        c.save(img / out, quality=86)
        print(f"  {img / out}  {c.size[0]}x{c.size[1]}")
    need = [sheets / f"{date}_v3_{n}.jpg" for n in ["low", "peek", "scares", "fight", "mouth", "creature_ghoul_low", "creature_ghoul_peek", "creature_ghoul_scares", "creature_goblin_low", "creature_goblin_scares"]]
    need += [game / f"{n}.jpg" for n in ["head_left", "head_right", "head_behind", "drink_take", "drink_sip", "swing_up", "swing_hit", "punch_hit"]] + [giz / f"{n}.jpg" for n in ["grip_editor", "grip_bottle", "grip_bat"]]
    missing = [str(f) for f in need if not f.is_file()]
    if missing:
        sys.exit("guide3: these aren't made yet (sheets3 for the normal woman, creature_ghoul and creature_goblin; shots3; gizmo):\n  " + "\n  ".join(missing))
    gh, gb = "creature_ghoul", "creature_goblin"
    stack([sh("low")], "v3_low.jpg")
    stack([row(sh("low", gh), 1), row(sh("low", gb), 1), row(sh("low", gh), 3), row(sh("low", gb), 3), row(sh("scares", gh), 0), row(sh("scares", gb), 0)], "v3_creatures.jpg")
    stack([row(sh("peek"), 0), row(sh("peek"), 1), row(sh("peek", gh), 0), row(sh("peek", gh), 2)], "v3_peek.jpg")
    stack([sh("scares", gh)], "v3_scares.jpg")
    stack([sh("mouth")], "v3_mouth.jpg")
    stack([sh("fight")], "v3_fight.jpg")
    beside([game / f"{n}.jpg" for n in ["head_left", "head_right", "head_behind"]], "v3_head.jpg")
    beside([game / f"{n}.jpg" for n in ["drink_take", "drink_sip"]], "v3_drink.jpg")
    beside([game / f"{n}.jpg" for n in ["swing_up", "swing_hit", "punch_hit"]], "v3_blows.jpg")
    for n in ["grip_editor", "grip_bottle", "grip_bat"]:
        Image.open(giz / f"{n}.jpg").convert("RGB").save(img / f"{n}.jpg", quality=86)
        print(f"  {img / (n + '.jpg')}")
    print("GUIDE3 ok")


def main():
    if sys.argv[1:] and sys.argv[1] == "guide3":
        return guide3(sys.argv[2:])
    if sys.argv[1:] and sys.argv[1] == "gizmo":
        return gizmo_shots(sys.argv[2:])
    if sys.argv[1:] and sys.argv[1] == "shots3":
        return v3_shots(sys.argv[2:])
    if sys.argv[1:] and sys.argv[1] == "sheets":
        return doc_sheets(sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else ROOT / "docs" / "animator_sheets")
    if sys.argv[1:] and sys.argv[1] == "sheets3":
        return v3_sheets(sys.argv[2:])
    if sys.argv[1:] and sys.argv[1] == "furniture":
        return furniture_sheets(sys.argv[2:])
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
