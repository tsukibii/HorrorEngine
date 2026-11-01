#!/usr/bin/env python3
"""The Director plugin's projects (docs/GODOT_DIRECTOR.md, DECISIONS 2026-10-30, night): a game built in Godot itself.

    python tools/godot_director.py new <folder> [--title T] [--sample] [--link]
        a new Godot 4.7 project ready to build a game in: the four add-ons (the runtime, the look, the Director,
        HumanShaders), the sound shelf and the little things' lives, the balanced look's project settings, the
        plugins on, a main scene with an HSGame and a first room (--sample: the sample game, a small house with a
        story to play through, built by Godot itself)
    python tools/godot_director.py install <folder> [--link]
        the add-ons, the shelf and the lives into an existing project (again after a pull: they're copies), the
        plugins switched on, the guide into guide/ (guides/director: the dock's Guide button opens it), the Character
        Studio exports its characters name (`studio_character`) into game/people/, the expression library into faces/
        (tools/face_export.mjs: the loops in faces/loops/); --link makes the add-ons and the guide symlinks into this
        repo instead, so a pull reaches the project at once
    python tools/godot_director.py guide
        the HTML guide's pictures (guides/director/img/) made again by Godot: a fresh sample project played and pictured
        (tests/guide_game.gd) and its editor with the dock (tests/guide_editor.gd), under xvfb when it's there (on a
        machine with a display, Godot's window opens for a few minutes), then the Director Manager's page on it in a
        headless browser (tools/director_manager/guide_shots.mjs); pictures no longer made are removed. Ends "GUIDE ok".
    python tools/godot_director.py from-desk <Game> [folder] [--force] [--play]
        a desk game as a Director project (Saved/Godot/<Game>_director unless a folder's given): a new project with the
        desk's levels as the Director's own nodes (rooms, doors, things with their models, people, spots, areas, paths,
        lights) and its story as the Director file (each task a quest, its beats moments, its endings; the cutscenes
        and the desk's choices as they were), its meshes, textures, bake and characters with it (docs/GODOT_DIRECTOR.md
        §6d). --play plays it through as its export's check does (the Pilot: GDPLAY's walk; TestRoom001: GDTESTROOM's
        stations; another game: started and run a while) and ends "FROMDESK ok".
    python tools/godot_director.py check [--keep]
        DIRECTOR: a sample project made in Saved/Godot/_director_check, imported, and its game compiled and played
        headless to its ending (tests/director_check.gd), the editor opened on it with the plugin (the dock, the
        nodes; tests/editor_check.gd), a Kimodo motion retargeted onto a skeleton (tests/kimodo_check.gd). Ends
        "DIRECTOR ok".
"""
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "Content" / "Python"))
from storykit import godot as G  # noqa: E402

DIRECTOR = ROOT / "GodotPlugins" / "HorrorStudioDirector" / "addons" / "horrorstudio_director"
RUNTIME = ROOT / "tools" / "godot" / "addons" / "horrorstudio"
LOOK = ROOT / "GodotPlugins" / "HorrorStudioLook" / "addons" / "horrorstudio_look"
HUMAN = ROOT / "GodotPlugins" / "HumanShaders"
SFX = ROOT / "Content" / "Studio" / "SFX"
LIVES = ROOT / "Content" / "Studio" / "Life" / "lives.json"
SOMA = ROOT / "Content" / "Studio" / "soma77.json"
CHECK = ROOT / "Saved" / "Godot" / "_director_check"
GUIDE_PROJECT = ROOT / "Saved" / "Godot" / "_director_guide"
GUIDES = ROOT / "guides"
PLUGINS = ["res://addons/horrorstudio_director/plugin.cfg", "res://addons/horrorstudio_look/plugin.cfg"]

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def project_godot(title):
    safe = "".join(ch if ch.isalnum() else "_" for ch in title).strip("_") or "game"
    return f'''; Engine configuration file.
; Made by tools/godot_director.py (the HorrorStudio Director plugin); the game's own settings go here too.

config_version=5

[application]

config/name={G.gstr(title)}
config/use_custom_user_dir=true
config/custom_user_dir_name={G.gstr("horrorstudio_" + safe)}
run/main_scene="res://main.tscn"
config/features=PackedStringArray("4.7", "Forward Plus")

[display]

window/size/viewport_width=1280
window/size/viewport_height=720

[editor_plugins]

enabled=PackedStringArray({", ".join(G.gstr(p) for p in PLUGINS)})

[rendering]

renderer/rendering_method="forward_plus"
''' + "".join(f"{k[len('rendering/'):]}={'true' if v is True else 'false' if v is False else v}\n" for k, v in G.PROJECT_LOOK.items()) + '''
[horrorstudio]

look/settings_applied=true
'''


FIRST_SCENE = '''[gd_scene load_steps=5 format=3]

[ext_resource type="Script" path="res://addons/horrorstudio_director/story/game.gd" id="game"]
[ext_resource type="Script" path="res://addons/horrorstudio_director/level/level.gd" id="level"]
[ext_resource type="Script" path="res://addons/horrorstudio_director/level/room.gd" id="room"]
[ext_resource type="Script" path="res://addons/horrorstudio_director/level/spot.gd" id="spot"]

[node name="Game" type="Node"]
script = ExtResource("game")
title = {title}

[node name="House" type="Node3D" parent="."]
script = ExtResource("level")
id = "house"

[node name="Hall" type="Node3D" parent="House"]
script = ExtResource("room")
id = "hall"

[node name="Start" type="Marker3D" parent="House"]
transform = Transform3D(-1, 0, 0, 0, 1, 0, 0, 0, -1, 0, 0, 1)
script = ExtResource("spot")
id = "start"
'''
EMPTY_STORY = {"format": 1, "quests": [], "states": [], "moments": [], "talk": {}, "endings": [], "achievements": [], "facts": {}}


def place(src, dst, link):
    """One add-on (or folder) into the project: a copy, or a symlink into the repo."""
    if dst.is_symlink() or dst.is_file():
        dst.unlink()
    elif dst.exists():
        shutil.rmtree(dst)
    dst.parent.mkdir(parents=True, exist_ok=True)
    if link:
        os.symlink(src, dst, target_is_directory=True)
    else:
        shutil.copytree(src, dst, ignore=shutil.ignore_patterns(".godot", "*.uid.bak", "__pycache__", "*.import") if src != HUMAN else shutil.ignore_patterns("*.import"))


def install(out, link=False):
    out = Path(out).resolve()
    place(RUNTIME, out / "addons" / "horrorstudio", link)
    place(LOOK, out / "addons" / "horrorstudio_look", link)
    place(DIRECTOR, out / "addons" / "horrorstudio_director", link)
    if HUMAN.exists():
        place(HUMAN, out / "HumanShaders", link)
    game = out / "game"
    game.mkdir(exist_ok=True)
    if (SFX / "index.json").exists():
        place(SFX, game / "sfx", link)
    if LIVES.exists():
        shutil.copy(LIVES, game / "lives.json")
    if not (game / "life_things.json").exists():
        (game / "life_things.json").write_text("{}", encoding="utf-8")
    kimodo = out / "kimodo"
    kimodo.mkdir(exist_ok=True)
    if SOMA.exists():
        shutil.copy(SOMA, kimodo / "soma77.json")
    (kimodo / "studio_root.txt").write_text(str(ROOT), encoding="utf-8")     # where Kimodo's stage file and tools/kimodo.py are
    (kimodo / "motions").mkdir(exist_ok=True)
    bodies = out / "bodies"                                                   # MHR (Meta's, Apache-2.0): a body to try motions on
    bodies.mkdir(exist_ok=True)
    for f in ("MHR.fbx", "MHR_LICENSE.txt"):
        if (ROOT / "Content" / "Studio" / "Bodies" / f).exists():
            shutil.copy(ROOT / "Content" / "Studio" / "Bodies" / f, bodies / f)
    pg = out / "project.godot"
    if pg.exists():
        text = pg.read_text(encoding="utf-8")
        if "[editor_plugins]" not in text:
            text += "\n[editor_plugins]\n\nenabled=PackedStringArray(%s)\n" % ", ".join(G.gstr(p) for p in PLUGINS)
        else:
            for p in PLUGINS:
                if p not in text:
                    text = text.replace("enabled=PackedStringArray(", "enabled=PackedStringArray(%s, " % G.gstr(p), 1)
        pg.write_text(text, encoding="utf-8")
    gd = out / "guide"                                                       # the guide (guides/director), the dock's Guide button's page
    if guide_ours(gd):
        place(GUIDES / "director", gd, link)                                  # its .gdignore keeps Godot from importing its pictures
    else:
        print(f"  {gd} is a folder of your own: the guide stays in the studio (guides/director/index.html)")
    people(out)
    faces(out)
    gi = out / ".gitignore"
    if not gi.exists():
        gi.write_text(".godot/\n*.import\n", encoding="utf-8")
    return out


def guide_ours(gd):
    """A project's guide/ is the Director's to replace: not there yet, a link to the studio's, or a copy of it."""
    if gd.is_symlink() or not gd.exists():
        return True
    page = gd / "index.html"
    return (gd / ".gdignore").exists() and page.exists() and "HorrorStudio Director" in page.read_text(encoding="utf-8", errors="replace")[:600]


def faces(out):
    """The expression library into the project's faces/ (the loops in faces/loops/) by tools/face_export.mjs, as the
    runtime plays them (`expr`: an HSActor's expression, a line's face, a state's)."""
    if not (ROOT / "Content" / "Studio" / "Expressions").is_dir():
        return
    try:
        r = subprocess.run(["node", str(ROOT / "tools" / "face_export.mjs"), "--project", str(out)], capture_output=True, text=True, timeout=300)
        last = (r.stdout.strip().splitlines() or [""])[-1]
        print(f"  faces: {last}" if r.returncode == 0 else f"  faces: not brought in ({(r.stdout + r.stderr).strip()[-300:]})")
    except (OSError, subprocess.TimeoutExpired) as e:
        print(f"  faces: not brought in (node: {e}); run node tools/face_export.mjs --project {out}")


def face_morphs(glb):
    """MHR's 72 face shapes baked into a Studio export's copy as morph targets (tools/face_morphs.mjs), so the story's
    `expr` plays on her face: a few words for the log"""
    try:
        r = subprocess.run(["node", str(ROOT / "tools" / "face_morphs.mjs"), str(glb)], capture_output=True, text=True, timeout=300)
        return ", her face's shapes baked in" if r.returncode == 0 else f" (her face's shapes not baked: {(r.stdout + r.stderr).strip()[-200:]})"
    except (OSError, subprocess.TimeoutExpired) as e:
        return f" (her face's shapes not baked: node {e})"


def people(out):
    """The Character Studio exports the project's characters wear (an HSActor's `studio_character`) into game/people/,
    where the runtime reads them as the export's games have theirs."""
    names = set()
    for d, dirs, files in os.walk(out):
        dirs[:] = [x for x in dirs if not x.startswith(".") and not (Path(d) == out and x in ("addons", "game", "guide", "HumanShaders"))]
        for f in files:
            if f.endswith(".tscn"):
                names.update(re.findall(r'^studio_character = "([^"]+)"', (Path(d) / f).read_text(encoding="utf-8", errors="replace"), re.M))
    for name in sorted(names):
        src = ROOT / "Content" / "Studio" / "People" / name / "export" / f"{name}.glb"
        if src.exists():
            (out / "game" / "people").mkdir(parents=True, exist_ok=True)
            shutil.copy(src, out / "game" / "people" / f"{name}.glb")
            print(f"  {name}: her Character Studio export copied into game/people/{face_morphs(out / 'game' / 'people' / f'{name}.glb')}")
        else:
            print(f"  {name}: no Character Studio export at {src.relative_to(ROOT)} (export her from the Character Studio, then install again)")


def godot():
    g = G.godot_bin()
    if not g:
        sys.exit("no godot on the PATH ($GODOT, godot or godot-mono; tools/godot_setup.sh on a cloud session)")
    return g


def run_godot(args, timeout=600, env=None):
    e = dict(os.environ)
    if env:
        e.update(env)
    try:
        r = subprocess.run([godot(), *args], capture_output=True, text=True, timeout=timeout, env=e)
        return r.returncode, r.stdout + r.stderr
    except subprocess.TimeoutExpired as ex:
        return 124, (ex.stdout or b"").decode("utf-8", "replace") if isinstance(ex.stdout, bytes) else str(ex.stdout or "")


def quiet(text):
    return "\n".join(l for l in text.splitlines() if not any(w in l for w in ("ALSA", "snd_", "ERR_CANT_OPEN", "at: cleanup", "at: clear (core")))


def import_all(out, tries=3):
    """Godot's import of the project, again until the body is in: one `--import` pass sometimes leaves the FBX for the
    next (the sample was once made without Mari's body)."""
    for _ in range(tries):
        run_godot(["--headless", "--path", str(out), "--import"], timeout=900)
        body = out / "bodies" / "MHR.fbx"
        if not body.exists() or ((out / "bodies" / "MHR.fbx.import").exists() and any((out / ".godot" / "imported").glob("MHR.fbx-*.scn"))):
            return True
    return False


def new(out, title="My HorrorStudio game", sample=False, link=False):
    out = Path(out).resolve()
    if out.exists() and any(out.iterdir()):
        sys.exit(f"{out} isn't empty: `install` puts the add-ons into an existing project")
    out.mkdir(parents=True, exist_ok=True)
    (out / "project.godot").write_text(project_godot(title), encoding="utf-8")
    install(out, link)
    (out / "main.tscn").write_text(FIRST_SCENE.format(title=G.gstr(title)), encoding="utf-8")
    (out / "director").mkdir(exist_ok=True)                                  # the story (the Director Manager writes it): none yet, a free roam
    (out / "director" / "director.json").write_text(json.dumps(EMPTY_STORY, indent=1), encoding="utf-8")
    import_all(out)
    if sample:
        code, text = run_godot(["--headless", "--path", str(out), "-s", "res://addons/horrorstudio_director/tests/make_sample.gd"], timeout=300)
        if "SAMPLE ok" not in text:
            print(quiet(text)[-3000:])
            sys.exit("the sample wasn't made")
        import_all(out)
    print(f"DIRECTOR project {out}: open it in Godot 4.7 (the HorrorStudio dock is on the right), F5 plays main.tscn")
    return out


def from_desk(game, folder=None, force=False):
    """A desk game as a Director project (the user, 2026-11-01: the desk's export "follows this format/new system too";
    docs/GODOT_DIRECTOR.md §6d): a new project as `new` makes one, the desk's levels built into it as the Director's own
    nodes (storykit/director_desk.py world, desk/desk_build.gd) and its story as the Director file (director_file), its
    meshes, textures, bake and characters with it. The project is the game from then on: the dock, the Manager, F5."""
    from storykit import storylib as SL, kit as KIT, director_desk as DD  # noqa: PLC0415
    story, _ = SL.load(game)
    out = Path(folder or ROOT / "Saved" / "Godot" / f"{game}_director").resolve()
    if out.exists() and any(out.iterdir()):
        if not force:
            sys.exit(f"{out} isn't empty (from-desk makes a new project; --force replaces it)")
        shutil.rmtree(out)
    specs = ROOT / "Saved" / "kit" / f"{game}.json"                   # the kit's meshes the game needs, as the export builds them
    try:
        if KIT.write_specs(story, specs) and shutil.which("node"):
            subprocess.run(["node", str(ROOT / "tools" / "kit" / "build.mjs"), "--specs", str(specs)], capture_output=True, text=True, timeout=900)
    except (OSError, ValueError, subprocess.TimeoutExpired):
        pass
    new(out, (story.get("game") or {}).get("title") or game)
    w = DD.world(story, out)
    (out / "director" / "desk_world.json").write_text(json.dumps(w, ensure_ascii=False, indent=0), encoding="utf-8")
    (out / "director" / "director.json").write_text(json.dumps(DD.director_file(story), ensure_ascii=False, indent=1), encoding="utf-8")
    baked = G.copy_previs(game, out)
    import_all(out)                                                      # the meshes and textures it brought
    code, text = run_godot(["--headless", "--path", str(out), "-s", "res://addons/horrorstudio_director/desk/desk_build.gd"], timeout=600)
    line = next((l for l in quiet(text).splitlines() if l.startswith("DESKBUILD")), "")
    if not line.startswith("DESKBUILD ok"):
        print(quiet(text)[-3000:])
        sys.exit(f"the desk's world wasn't built ({line or 'no word from desk_build.gd'})")
    print(f"  {line}")
    people(out)                                                          # its characters' Character Studio exports, their faces baked
    if (out / "game" / "people").is_dir():
        import_all(out)
    lv = w["levels"]
    print(f"  {len(lv)} level(s): " + "; ".join(f"{L['id']}: {len(L['rooms'])} rooms, {len(L['doors'])} doors, {len(L['things'])} things, {len(L['actors'])} people, "
                                                 f"{len(L['spots'])} spots, {len(L['lights'])} lights" for L in lv) + (f"; the bake ({baked} bodies)" if baked else ""))
    print(f"FROMDESK {game} -> {out}: open it in Godot 4.7, the story in director/director.json (the Manager), F5 plays it")
    return out


# the games with a playthrough of their export (their checks), played the same way on the Director project made from them
PLAYTHROUGHS = {"Pilot": ("gdplay.gd", "GDPLAY", 1200, "to its good ending"),
                "TestRoom001": ("gdtestroom.gd", "GDTESTROOM", 3000, "station by station, a death and its retry, the trigger cutscene")}


def from_desk_play(game, out):
    """The game played through the Director project made from it, as its export's check plays it (tests/gdplay.gd or
    tests/gdtestroom.gd with --director); a game with no playthrough started headless and run a while (tests/load_check.gd)."""
    if game not in PLAYTHROUGHS:
        code, text = run_godot(["--headless", "--path", str(out), "--quit-after", "600"], timeout=600)
        text = quiet(text)
        bad = [l for l in text.splitlines() if "SCRIPT ERROR" in l or "Parse Error" in l or "DIRECTOR:" in l and "problem" in l]
        for l in bad[:12]:
            print("  " + l.strip()[:300])
        print(f"FROMDESK {'ok' if not bad else 'FAIL'} ({game} started and run ten seconds as a Director project; only "
              f"{' and '.join(PLAYTHROUGHS)} have a playthrough)")
        return 0 if not bad else 1
    script, name, timeout, how = PLAYTHROUGHS[game]
    code, text = run_godot(["--headless", "--fixed-fps", "60", "--path", str(out), "-s", f"res://addons/horrorstudio/tests/{script}", "--", "--director"], timeout=timeout)
    text = quiet(text)
    for l in text.splitlines():
        if l.strip().startswith(("ok ", "BAD", name)) or "SCRIPT ERROR" in l or "Parse Error" in l:
            print("  " + l.strip()[:300])
    ok = f"{name} ok" in text
    print(f"FROMDESK ok ({game} played through as a Director project, {how})" if ok else "FROMDESK FAIL")
    return 0 if ok else 1


def pictures_env():
    """Godot drawing for pictures: through xvfb and the cloud's lavapipe when they're there, else the machine's display."""
    env = dict(os.environ)
    if Path("/usr/share/vulkan/icd.d/lvp_icd.json").exists() and shutil.which("xvfb-run"):
        env.setdefault("VK_ICD_FILENAMES", "/usr/share/vulkan/icd.d/lvp_icd.json")
    return env


def drawn(args, size, timeout=900, env=None):
    cmd = [godot(), *args, "--rendering-driver", "vulkan", "--resolution", size]
    if shutil.which("xvfb-run"):
        cmd = ["xvfb-run", "-a", "-s", "-screen 0 %sx24" % size] + cmd
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, env=env or pictures_env())
        return quiet(r.stdout + r.stderr)
    except subprocess.TimeoutExpired:
        return ""


def guide():
    """The guide's pictures, made again: a fresh sample, the game played and pictured, the editor and its dock."""
    if GUIDE_PROJECT.exists():
        shutil.rmtree(GUIDE_PROJECT)
    out = new(GUIDE_PROJECT, "The House", sample=True)
    img = GUIDES / "director" / "img"
    img.mkdir(parents=True, exist_ok=True)
    text = drawn(["--path", str(out), "--fixed-fps", "30", "-s", "res://addons/horrorstudio_director/tests/guide_game.gd", "--", f"--out={img}"], "1280x720")
    line = next((l for l in text.splitlines() if l.startswith("GUIDEGAME ")), None)
    game = json.loads(line[len("GUIDEGAME "):]) if line else {}
    t = out / "addons" / "hs_director_guide"                 # the editor's pictures: a plugin of their own, the dock where a new project has it
    t.mkdir(parents=True, exist_ok=True)
    (t / "plugin.cfg").write_text('[plugin]\nname="hs director guide"\ndescription=""\nauthor=""\nversion="1"\nscript="plugin.gd"\n', encoding="utf-8")
    shutil.copy(DIRECTOR / "tests" / "guide_editor.gd", t / "plugin.gd")
    pg = out / "project.godot"
    before = pg.read_text(encoding="utf-8")
    pg.write_text(before.replace("enabled=PackedStringArray(", 'enabled=PackedStringArray("res://addons/hs_director_guide/plugin.cfg", ', 1), encoding="utf-8")
    layout = out / ".godot" / "editor" / "editor_layout.cfg"
    if layout.exists():
        layout.unlink()
    env = pictures_env()
    env["HSGUIDE_OUT"] = str(img)
    text2 = drawn(["--editor", "--path", str(out)], "1600x1000", env=env)
    pg.write_text(before, encoding="utf-8")
    shutil.rmtree(t, ignore_errors=True)
    line2 = next((l for l in text2.splitlines() if l.startswith("GUIDEEDITOR ")), None)
    editor = json.loads(line2[len("GUIDEEDITOR "):]) if line2 else {}
    try:                                                     # the Director Manager's page on the same sample, in a headless browser
        r = subprocess.run(["node", str(ROOT / "tools" / "director_manager" / "guide_shots.mjs"), "--project", str(out), "--out", str(img)],
                           capture_output=True, text=True, timeout=600)
        text3 = r.stdout + r.stderr
    except (OSError, subprocess.TimeoutExpired) as e:
        text3 = f"MANAGERSHOTS FAIL {e}"
    manager = [l.strip() for l in text3.splitlines() if l.startswith("  m_")]
    manager = manager[0].split(", ") if manager else []
    made = game.get("made", []) + editor.get("made", []) + manager
    ok = (len(game.get("made", [])) >= 13 and len(editor.get("made", [])) >= 12 and "MANAGERSHOTS ok" in text3
          and not game.get("timeout") and not editor.get("timeout"))
    if not ok:
        print((text + text2)[-3000:])
        print(text3[-1500:])
    else:                                                    # the pictures it no longer makes go (the guide shows every one there)
        for f in img.glob("*.jpg"):
            if f.stem not in made:
                f.unlink()
                print(f"  {f.name}: not made any more, removed")
    print(f"  the game: {', '.join(game.get('made', []))}")
    print(f"  the editor: {', '.join(editor.get('made', []))}")
    print(f"  the Manager: {', '.join(manager)}")
    print(f"GUIDE {'ok' if ok else 'FAIL'} ({len(made)} pictures in {img.relative_to(ROOT)})")
    return 0 if ok else 1


def check(keep=False):
    if CHECK.exists():
        shutil.rmtree(CHECK)
    out = new(CHECK, "Director check", sample=True)
    ok = True
    code, text = run_godot(["--headless", "--fixed-fps", "60", "--path", str(out), "-s", "res://addons/horrorstudio_director/tests/director_check.gd"], timeout=900)
    text = quiet(text)
    for l in text.splitlines():
        if l.strip().startswith(("ok ", "BAD", "DIRECTOR")) or "SCRIPT ERROR" in l or "Parse Error" in l:
            print("  " + l.strip())
    if "DIRECTORPLAY ok" not in text:
        print(text[-4000:])
        ok = False
    ok = kimodo_check(out) and ok
    ok = alone_check(out) and ok
    ok = editor_check(out) and ok
    ok = guide_check(out) and ok
    print("DIRECTOR ok" if ok else "DIRECTOR FAIL")
    return 0 if ok else 1


def guide_check(out):
    """The guide's page (guides/director): every picture it shows is there and every picture there is shown, every
    link inside it lands, and the project got its copy."""
    page = GUIDES / "director" / "index.html"
    if not page.exists():
        print("  BAD no guide (guides/director/index.html)")
        return False
    html = page.read_text(encoding="utf-8")
    shown = set(re.findall(r'<img src="([^"]+)"', html))
    ids = set(re.findall(r'\bid="([^"]+)"', html))
    links = re.findall(r'href="([^"]+)"', html)
    bad = sorted(s for s in shown if not (page.parent / s).exists())
    bad += [l for l in links if l.startswith("#") and l[1:] not in ids]
    bad += [l for l in links if not l.startswith(("#", "http:", "https:")) and not (page.parent / l.split("#")[0]).exists()]
    unshown = sorted(p.name for p in (page.parent / "img").glob("*.jpg") if f"img/{p.name}" not in shown)
    copied = (out / "guide" / "index.html").exists() and (out / "guide" / ".gdignore").exists()
    ok = not bad and not unshown and len(shown) >= 20 and copied
    print(("  ok  " if ok else "  BAD ") + "the guide: %d pictures, %d links%s%s%s" % (len(shown), len(links), "; not there: %s" % bad if bad else "",
        "; pictures it doesn't show: %s" % unshown if unshown else "", "" if copied else "; the project has no guide/ with its .gdignore"))
    return ok


def kimodo_check(out):
    """The Kimodo link (tests/kimodo_check.gd): a motion made on SOMA through an .npz and back, retargeted onto SOMA and onto
    MHR, in place, and the sample's house sent as a stage from where Mari stands."""
    code, text = run_godot(["--headless", "--path", str(out), "-s", "res://addons/horrorstudio_director/tests/kimodo_check.gd"], timeout=300)
    line = next((l for l in quiet(text).splitlines() if l.startswith("KIMODOCHECK ")), None)
    if line is None:
        print(quiet(text)[-3000:])
        print("  BAD the Kimodo check's report never came")
        return False
    r = json.loads(line[len("KIMODOCHECK "):])
    kinds = r.get("stage_kinds", {})
    checks = [
        ("a Kimodo .npz written and read back: %s frames, %.6f m off" % (r.get("npz_frames"), r.get("npz_err", 1)), r.get("npz_frames") == 31 and r.get("npz_err", 1) < 1e-6),
        ("onto Kimodo's own skeleton: every joint where the motion put it (%.2f cm at worst, %s)" % (r.get("soma_err_cm", 99), r.get("soma_err_at")), r.get("family_soma") == "soma" and r.get("soma_err_cm", 99) < 0.5),
        ("onto the Character Studio's MHR: the limbs pointing SOMA's way (%.2f° at worst), the hips at its height (%.3f)" % (r.get("mhr_limb_deg", 99), r.get("mhr_hip_ratio", 0)),
         r.get("family_mhr") == "mhr" and r.get("mhr_limb_deg", 99) < 1.0 and 0.88 < r.get("mhr_hip_ratio", 0) < 0.97),
        ("the fingers onto MHR: every finger bone (%s) pointing SOMA's way (%.2f° at worst, %s), the index curling with the motion (%.1f°)"
         % (r.get("mhr_finger_bones"), r.get("mhr_finger_deg", 99), r.get("mhr_finger_at"), r.get("mhr_finger_moved", 0)),
         r.get("mhr_finger_bones") == 32 and r.get("mhr_finger_deg", 99) < 1.0 and r.get("mhr_finger_moved", 0) > 40.0),
        ("in place: the travel gone (%.3f m of %.2f), the sway kept (%.3f m), looping" % (r.get("in_place_travel", 9), r.get("full_travel", 0), r.get("in_place_sway", 0)),
         r.get("in_place_travel", 9) < 0.01 and abs(r.get("full_travel", 0) - 1.2) < 0.01 and r.get("in_place_sway", 0) > 0.02 and r.get("in_place_loop") is True),
        ("the house as Kimodo's stage from Mari: %d boxes %s, %d door swings, marks %s, the hall's floor where it is from her" % (r.get("stage_boxes", 0), json.dumps(kinds), r.get("stage_arcs", 0), r.get("stage_marks")),
         r.get("stage_boxes", 0) >= 20 and all(kinds.get(k, 0) > 0 for k in ("floor", "wall", "door", "use")) and r.get("stage_arcs") == 2
         and any(m.endswith(":player") for m in r.get("stage_marks", [])) and r.get("stage_floor_ok") is True),
    ]
    ok = True
    for what, good in checks:
        print(("  ok  " if good else "  BAD ") + what)
        ok = ok and good
    return ok


def alone_check(out):
    """The test runs (tests/alone_check.gd, a run each): a level played on its own (F6 on its scene: a game made round
    it, a free roam with the Director file's moments, the player at its Test start with what it starts with); the
    whole game from the panel's Test start (its first quest, the player kept at the Test start); the panel's Try it
    (the player in front of a thing, facing it)."""
    ok = True
    for mode in ("alone", "test", "near"):
        code, text = run_godot(["--headless", "--fixed-fps", "60", "--path", str(out), "-s", "res://addons/horrorstudio_director/tests/alone_check.gd", "--", "--mode=" + mode], timeout=300)
        text = quiet(text)
        line = next((l for l in text.splitlines() if l.startswith("ALONECHECK ")), None)
        r = json.loads(line[len("ALONECHECK "):]) if line else {}
        warn = [l for l in text.splitlines() if "SCRIPT ERROR" in l or "BoneAttachment" in l]
        made = r.get("game_made") is True and r.get("active") is True and r.get("file_gone") is True and not warn
        if mode == "alone":
            good = made and r.get("at_test_start") is True and "bedroom_key" in r.get("items", []) and r.get("level_start") == "test_start" \
                and "m_figure_scare" in r.get("beats", []) and r.get("scare") is True and r.get("checkpoint") is True
            what = "a level played on its own (F6): a game made round it, the player at its Test start with the bedroom key, a free roam with the story's moments (the jumpscare fires), the checkpoint autosaving"
        elif mode == "test":
            good = made and r.get("here") is True and "bedroom_key" in r.get("items", []) and "q_key" in r.get("trail", []) \
                and r.get("todo") == ["read_letter", "find_key"] and r.get("start_move") is False
            what = "Play from the Test start: the game's first quest, the player kept at the Test start (not sent to the quest's start) with the bedroom key"
        else:
            good = made and r.get("here") is True and r.get("level_start") == "try_here" and "q_key" in r.get("trail", [])
            what = "Try it: the game with the player in front of the letter, facing it"
        print(("  ok  " if good else "  BAD ") + what + ("" if good else " " + json.dumps(r) + " " + " | ".join(warn[:3])))
        ok = ok and good
    return ok


def editor_check(out):
    """The plugin in the editor itself: tests/editor_check.gd installed as a plugin of its own beside the Director's, the
    editor opened on the sample (headless: the dock's logic, no pictures), its report read."""
    t = out / "addons" / "hs_director_editor_test"
    t.mkdir(parents=True, exist_ok=True)
    (t / "plugin.cfg").write_text('[plugin]\nname="hs director editor test"\ndescription=""\nauthor=""\nversion="1"\nscript="plugin.gd"\n', encoding="utf-8")
    shutil.copy(DIRECTOR / "tests" / "editor_check.gd", t / "plugin.gd")
    pg = out / "project.godot"
    before = pg.read_text(encoding="utf-8")
    pg.write_text(before.replace("enabled=PackedStringArray(", 'enabled=PackedStringArray("res://addons/hs_director_editor_test/plugin.cfg", ', 1), encoding="utf-8")
    code, text = run_godot(["--headless", "--editor", "--path", str(out)], timeout=600)
    pg.write_text(before, encoding="utf-8")
    shutil.rmtree(t, ignore_errors=True)
    text = quiet(text)
    line = next((l for l in text.splitlines() if l.startswith("HSDIRECTOREDITOR ")), None)
    errs = [l for l in text.splitlines() if ("SCRIPT ERROR" in l or "Parse Error" in l) and "hs_director_editor_test" not in l]
    if line is None:
        print(text[-4000:])
        print("  BAD the editor's report never came")
        return False
    rep = json.loads(line[len("HSDIRECTOREDITOR "):])
    flags = rep.get("flags_rows", [])
    checks = [
        ("the editor opens the sample with the plugin on: the dock found", rep.get("dock") is True),
        ("Director: the story file's quests in play order, their steps, the endings, the moments (%d rows)" % rep.get("director_rows", 0), rep.get("director_has") is True),
        ("Things and Check drawn (%s)" % rep.get("check_summary", ""), rep.get("things_rows", 0) > 10 and "5 quests" in rep.get("check_summary", "")),
        ("the dock's Guide button, on the project's own copy of the guide (guide/index.html)", rep.get("guide") is True),
        ("parts: a mesh made a cup from the panel, in its place, its effect points made as markers of the scene's (%s; made %s, owned %s)" % (", ".join(rep.get("part_points", [])), rep.get("part_made"), rep.get("part_points_owned")),
         rep.get("part_made") is True and rep.get("part_points_owned") is True and rep.get("part_points") == ["handle", "inner", "rim"]),
        ("parts: a pickup dropped on a mesh in the Scene tree wraps it (%s); undone, the part is back on it (%s)" % (rep.get("part_dropped"), rep.get("part_drop_undone")),
         rep.get("part_dropped") is True and rep.get("part_drop_undone") is True),
        ("the running game followed: ▶ on the quest it's on, ✓ on the ones done and the steps ticked, ● the facts it has", rep.get("live_now") is True and rep.get("live_facts") is True),
        ("the panel: a key placed in the selected room, a node of the scene's own", rep.get("preset_placed") is True),
        ("the HorrorStudio panel at the bottom (%s): its categories (%d), the Kitchen's %d cards, a search for kettle finding %s" % (rep.get("panel_bottom"), len(rep.get("panel_rail", [])), rep.get("panel_kitchen", 0), ", ".join(rep.get("panel_search", []))),
         rep.get("panel_found") is True and rep.get("panel_bottom") is True and len(rep.get("panel_rail", [])) >= 13 and rep.get("panel_kitchen") == 12 and {"kettle", "whistling_kettle"} <= set(rep.get("panel_search", []))),
        ("a model called OldSaucepan: a pot suggested first (%s), its card one click away (%s), the Inspector's box with every part and the suggestion" % (", ".join(rep.get("panel_suggest", [])), rep.get("panel_card_ready")),
         (rep.get("panel_suggest") or [""])[0] == "pot" and rep.get("panel_card_ready") == "Make it this" and rep.get("panel_inspector") is True),
        ("one click makes it a pot (%s); its card says so (%s), This object in words (%s)" % (rep.get("panel_assigned"), rep.get("panel_card_now"), rep.get("panel_side")),
         rep.get("panel_assigned") is True and rep.get("panel_card_now") == "✓ It's this now" and rep.get("panel_side") is True),
        ("made plain again: the model back in its place, the thing gone (%s); undone, a pot again (%s)" % (rep.get("panel_plain"), rep.get("panel_plain_undone")),
         rep.get("panel_plain") is True and rep.get("panel_plain_undone") is True),
        ("the mouse's ray finds the model a part is dropped on in the 3D view, with no collider (%s)" % rep.get("panel_ray"), rep.get("panel_ray") is True),
        ("a window in the kitchen's wall: glass and the sky's light (%s), undone (%s)" % (rep.get("panel_window"), rep.get("panel_window_undone")),
         rep.get("panel_window") is True and rep.get("panel_window_undone") is True),
        ("a jumpscare card: its area named Jumpscare, its moment in the Director file (%s); undone (%s)" % (rep.get("panel_scare"), rep.get("panel_scare_undone")),
         rep.get("panel_scare") is True and rep.get("panel_scare_undone") is True),
        ("the Player category first (%s): its cards %s, the sample's start there already (%s), a click on a card selecting the one there (%s, %s)"
         % (rep.get("player_rail_first"), ", ".join(rep.get("player_cards", [])), rep.get("player_card_foot"), rep.get("player_start_selected"), rep.get("player_test_selected")),
         rep.get("player_rail_first") == "player" and rep.get("player_cards") == ["player_start", "test_start", "checkpoint"] and rep.get("player_card_foot") == "✓ One in House"
         and rep.get("player_start_selected") is True and rep.get("player_test_selected") is True),
        ("a Player start in This object: facing %s, turned East (%s) and back (%s), the mug put in its pocket (%s) and out (%s), Play from here (%s)"
         % (rep.get("player_facing"), rep.get("player_turned"), rep.get("player_turn_undone"), rep.get("player_item"), rep.get("player_item_undone"), rep.get("player_play_button")),
         rep.get("player_facing") == "North" and rep.get("player_turned") is True and rep.get("player_turn_undone") is True and rep.get("player_item") is True
         and rep.get("player_item_undone") is True and rep.get("player_play_button") is True),
        ("a checkpoint placed, an area of the story's (%s); undone (%s)" % (rep.get("player_checkpoint"), rep.get("player_checkpoint_undone")),
         rep.get("player_checkpoint") is True and rep.get("player_checkpoint_undone") is True),
        ("a node's id follows its renames while it's the name's (%s), one typed by hand stays (%s)" % (rep.get("id_follows"), rep.get("id_kept")), rep.get("id_follows") == ["hs_thing", "old_key"] and rep.get("id_kept") == "my_key"),
        ("saved: the new nodes in the file, no story nodes, nothing the nodes make for themselves", rep.get("saved") is True and rep.get("saved_task") is True and rep.get("saved_nothing_made") is True),
        ("no script errors in the editor", not errs),
    ]
    if errs:
        print("\n".join(errs[:12]))
    ok = True
    for what, good in checks:
        print(("  ok  " if good else "  BAD ") + what)
        ok = ok and good
    return ok


def main(argv):
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        return 0
    cmd, rest = argv[0], argv[1:]
    opt = lambda k, d=None: rest[rest.index(k) + 1] if k in rest else d   # noqa: E731
    if cmd == "new":
        if not rest:
            sys.exit("new <folder>")
        new(rest[0], opt("--title", "My HorrorStudio game"), "--sample" in rest, "--link" in rest)
        return 0
    if cmd == "install":
        if not rest:
            sys.exit("install <folder>")
        print(f"DIRECTOR installed into {install(rest[0], '--link' in rest)}")
        return 0
    if cmd == "check":
        return check("--keep" in rest)
    if cmd == "from-desk":
        if not rest or rest[0].startswith("--"):
            sys.exit("from-desk <Game> [folder] [--force] [--play]")
        folder = rest[1] if len(rest) > 1 and not rest[1].startswith("--") else None
        out = from_desk(rest[0], folder, "--force" in rest)
        return from_desk_play(rest[0], out) if "--play" in rest else 0
    if cmd == "guide":
        return guide()
    print(__doc__)
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
