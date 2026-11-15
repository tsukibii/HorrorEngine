#!/usr/bin/env python3
"""A new horror game for Godot 4.7, made by hand with the studio's plugins, in one command (the user, 2026-11-15: "a
horror godot package maker wrapper which I can name and creates a base project with everything set up for godot 4.7").

    python tools/horror_game.py new "My Game" [--to DIR] [--artist "Your Studio"]   a project to open and play (F5) at once
    python tools/horror_game.py update FOLDER                the studio's plugins and starter scripts into it again
    python tools/horror_game.py check                        HORRORGAME: one made in Saved/Godot/_horror_game and played

`new` makes DIR/My_Game (DIR: ~/HorrorGames unless --to says): godot_byhand.py's project (the Look, UI, Weapons, Devices
and Markers plugins switched on with the balanced look's settings, HumanShaders, the starter kit as res://starter/, the
sound shelf, the four music moods, the Kimodo reader, exports/ folders), named as you named it, and three scenes Godot
builds and saves (tools/godot/base_build.gd): intro.tscn, the project's start (black, "[Artist] presents", or
"Your Studio presents" with --artist: the UI plugin's HSSplash, Godot's own logo not shown), menu.tscn (the main menu: the game's name, Continue, New game, Load
game, Settings, Quit: HSTitleMenu) and main.tscn, the game: the studio's look, moonlight, a small room with a lamp and
a table, a note on it, the starter's player, the Story (an objective, a task, autosave), the HSHud with the game's keys,
Sound, the pause menu (Esc: Save, Load, Settings, Quit to the menu) and a checkpoint at the start. Imported, so Godot opens it at once. A README.md in
it says what's there and how to bring the studio's newer plugins in (`update`: their copies, and the starter's scripts
with yours that differed kept in starter_before/).

Why a project maker and not one plugin: what a game needs lives in five plugins (copied into addons/) and the starter
kit (copied into starter/: scenes reference res://starter/ by path); this makes a project with all of them, and
`update` keeps it current. Needs Godot 4.7 on the PATH ($GODOT for another)."""
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
import godot_byhand as BH  # noqa: E402

README = """# {name}

A horror game for Godot 4.7, made by the HorrorStudio project maker (`tools/horror_game.py new` in the studio). Open
`project.godot` in Godot 4.7 and press F5: a black card ("[Artist] presents"), the main menu, then New game: you're in a
small room at night with a note on the table.

## What's in it

- `intro.tscn`, where the game starts: black, "[Artist] presents" (its **Line**: your studio's name, or made with
  `--artist "Your Studio"`; **Picture** a logo over it), then `menu.tscn`. Godot's own boot screen is black under it (Project Settings > Application > Boot Splash:
  no image; put a picture of your own there if you like).
- `menu.tscn`, the main menu (the UI plugin's HSTitleMenu): the game's name (**Title**, **Subtitle**, a **Backdrop**),
  Continue (the newest save), New game, Load game, Settings, Quit.
- `main.tscn`, the game: the studio's look (`Look`: the balanced preset's environment, tape and grade; its **Tape** is
  the studio's camhybrid tape, a 4:3 picture: Preset `off` for the whole screen, clean), moonlight,
  a room (a floor, four walls with a doorway, a lamp, a table), a note (E reads it), the player (`res://starter/player.tscn`),
  the **Story** (the objective, the to-do list, the pocket, flags, checkpoints and saves: its Saving group), the **Hud**
  (the UI plugin's HSHud: E's prompt, conversations, the pocket's row; its Keys are the chips at the foot), **Sound**,
  **Pause** (Esc: Resume, Save game, Load game, Settings, Quit) and a **Checkpoint** where you start (with the Story's
  Autosave on, the game's first save). Everything in it is yours to change.
- `addons/`: the studio's plugins, switched on: horrorstudio_look (the look, light zones, the air, skins, eyes, cloth,
  a head that follows you, hands, small movements), horrorstudio_ui (the HUD, quest markers, the pause menu),
  horrorstudio_weapons (the double barrel, what a shot leaves, things that break, black ichor), horrorstudio_devices
  (the laptop, its shop and parcels) and horrorstudio_markers (NPC markers, flags and things: the NPC Markers, Things and
  Flags tabs along the bottom).
- `starter/`: the starter kit's scripts and scenes (the player, the Story, doors, pickups, notes, seats, scares, cues,
  sound, fear, hunts, sanity, a character's Motion, the pause menu...). Yours to change.
- `sfx/`, `music/`: the sound shelf and the four moods; `kimodo/`, `animations/`: Kimodo's motions for a character's
  moves; `exports/`: drop the studio's exports here (interiors, streets, characters).

## Shipping it

Project > Export: a Linux and a Windows preset are ready (Godot asks for its export templates the first time: Editor >
Manage Export Templates). The project keeps its scenes as text when it's exported (Godot 4.7's binary conversion leaves
out every list in a scene: the to-do list, the HUD's keys), and the presets take Kimodo's motions (`*.npz`) along.

## Keeping it current

The plugins and the starter are copies of the studio's. After a pull in the studio:

    python {studio}/tools/horror_game.py update "{folder}"

brings the plugins again and the starter's scripts (a script of yours that differed is kept in `starter_before/`).

## Where to go next

In the studio: `guides/first_game/index.html` (an interior, a street and a character, step by step),
`guides/tutorial_v2/index.html` (a whole night in a hotel, every system), `guides/markers/index.html` (a character's
part as markers), `guides/flags/index.html` (doors that need a flag), `guides/sequences/index.html` (little scenes).
"""


def godot():
    for c in [os.environ.get("GODOT"), "godot", "godot-mono"]:
        if c and shutil.which(c):
            return shutil.which(c)
    return None


def folder_name(name):
    return re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_") or "Horror_Game"


# the project's start: the studio's card (intro.tscn), Godot's own boot screen black under it (no image: its logo
# not shown; Project Settings > Application > Boot Splash takes a picture of your own)
START = {"run/main_scene": '"res://intro.tscn"', "boot_splash/bg_color": "Color(0, 0, 0, 1)", "boot_splash/show_image": "false"}


def set_start(proj):
    p = proj / "project.godot"
    s = p.read_text(encoding="utf-8")
    for k, v in START.items():
        if re.search(r"^" + re.escape(k) + "=", s, re.M):
            s = re.sub(r"^" + re.escape(k) + "=.*$", f"{k}={v}", s, flags=re.M)
        else:
            s = s.replace("[application]\n", f"[application]\n\n{k}={v}\n", 1)
    p.write_text(s, encoding="utf-8")


def make(name, proj, quiet=False, artist=""):
    """the project and its main scene in `proj` (the card naming `artist`); -> None, or what went wrong"""
    g = godot()
    if not g:
        return "no godot on the PATH (Godot 4.7: install it, or set GODOT to its path)"
    if (proj / "project.godot").exists():
        return f"{proj} is a Godot project already: python tools/horror_game.py update {proj}"
    if BH.main(["new", str(proj), "--name", name]):
        return "godot_byhand.py new didn't make it"
    shutil.copy(HERE / "godot" / "base_build.gd", proj / "base_build.gd")
    subprocess.run([g, "--headless", "--path", str(proj), "--import"], capture_output=True, text=True, timeout=3600)
    r = subprocess.run([g, "--headless", "--path", str(proj), "-s", "base_build.gd", "--", "--name=" + name] + (["--artist=" + artist] if artist else []),
                       capture_output=True, text=True, timeout=600)
    (proj / "base_build.gd").unlink(missing_ok=True)
    if "BASEBUILD saved" not in r.stdout:   # (the game, the card and the menu)
        return "the main scene wasn't made: " + (r.stdout + r.stderr).strip()[-600:]
    set_start(proj)
    (proj / "README.md").write_text(README.format(name=name, studio=ROOT, folder=proj), encoding="utf-8")
    subprocess.run([g, "--headless", "--path", str(proj), "--import"], capture_output=True, text=True, timeout=1200)
    return None


def played(cmd, cwd=None):
    """one of the check's scripts run: its lines printed, its errors (and any script error) returned"""
    import json
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=600, cwd=cwd)
    text = r.stdout + r.stderr
    errs = []
    for ln in text.splitlines():
        if ln.startswith("HORRORGAME ") and not ln.startswith("HORRORGAME result"):
            print("  " + ln[11:])
        if ln.startswith("HORRORGAME result"):
            errs += json.loads(ln[len("HORRORGAME result "):]).get("errors", [])
    if not any(ln.startswith("HORRORGAME result") for ln in text.splitlines()):
        errs.append("the game said nothing: " + text.strip()[-500:])
    return errs + [f"a script error: {ln.strip()}" for ln in text.splitlines() if "SCRIPT ERROR" in ln or "Parse Error" in ln][:8]


def probe_files(proj):
    """what base_probe.gd reads: a .glb whose materials carry the Studio's records (as a character's export's do), a
    face clip as the Face page writes one, a Kimodo motion"""
    import json
    import struct
    import zipfile
    pos = struct.pack("<9f", 0, 0, 0, 1, 0, 0, 0, 1, 0)
    blob = pos + struct.pack("<3H", 0, 1, 2) + b"\0\0"
    mats = [{"name": "probe_eye", "extras": {"studioEye": {"limbus": 0.55, "side": "L"}}},
            {"name": "probe_hair", "extras": {"studioHair": {"normal": "shell"}, "look": {"name": "probe"}}},
            {"name": "probe_skin", "extras": {"studioSkin": {"pores": 0.7}}}]
    j = {"asset": {"version": "2.0"}, "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"name": "probe", "mesh": 0}],
         "meshes": [{"name": "probe", "primitives": [{"attributes": {"POSITION": 0}, "indices": 1, "material": i} for i in range(3)]}],
         "materials": mats,
         "accessors": [{"bufferView": 0, "componentType": 5126, "count": 3, "type": "VEC3", "min": [0, 0, 0], "max": [1, 1, 0]},
                       {"bufferView": 1, "componentType": 5123, "count": 3, "type": "SCALAR"}],
         "bufferViews": [{"buffer": 0, "byteOffset": 0, "byteLength": 36}, {"buffer": 0, "byteOffset": 36, "byteLength": 6}],
         "buffers": [{"byteLength": len(blob)}]}
    js = json.dumps(j).encode()
    js += b" " * (-len(js) % 4)
    (proj / "probe").mkdir(exist_ok=True)
    (proj / "probe" / "probe_look.glb").write_bytes(struct.pack("<4sII", b"glTF", 2, 28 + len(js) + len(blob))
                                                    + struct.pack("<I4s", len(js), b"JSON") + js
                                                    + struct.pack("<I4s", len(blob), b"BIN\0") + blob)
    (proj / "faces").mkdir(exist_ok=True)
    (proj / "faces" / "probe_smile.tres").write_text(
        '[gd_resource type="Resource" script_class="HSFaceClip" load_steps=2 format=3]\n\n'
        '[ext_resource type="Script" path="res://addons/horrorstudio/face_clip.gd" id="1_face"]\n\n'
        '[resource]\nscript = ExtResource("1_face")\nid = "probe_smile"\ntitle = "probe smile"\nloop = false\n'
        'secs = 0.10000\nfps = 30.00000\nframes = 3\nshapes = PackedStringArray("jawDrop", "lipCornerPuller_L")\n'
        'weights = PackedFloat32Array(0, 0, 0.5, 0.5, 1, 1)\n', encoding="utf-8")
    head = "{'descr': '<f4', 'fortran_order': False, 'shape': (4, 77, 3), }"
    head += " " * (-(10 + len(head) + 1) % 64) + "\n"
    npy = b"\x93NUMPY\x01\x00" + struct.pack("<H", len(head)) + head.encode() + bytes(4 * 4 * 77 * 3)
    (proj / "animations").mkdir(exist_ok=True)
    with zipfile.ZipFile(proj / "animations" / "probe_walk.npz", "w") as z:
        z.writestr("posed_joints.npy", npy)


def main(argv):
    if not argv or argv[0] not in ("new", "update", "check"):
        print(__doc__)
        return 2
    if argv[0] == "new":
        words, opts, i = [], {}, 1
        while i < len(argv):                              # (the name's words, and each option's word after it)
            if argv[i] in ("--to", "--artist") and i + 1 < len(argv):
                opts[argv[i]] = argv[i + 1]
                i += 2
                continue
            if not argv[i].startswith("--"):
                words.append(argv[i])
            i += 1
        artist = opts.get("--artist", "").strip()
        if not words:
            print('which name? python tools/horror_game.py new "My Game" [--to DIR] [--artist "Your Studio"]')
            return 2
        name = " ".join(words).strip()
        base = Path(opts["--to"]).expanduser() if "--to" in opts else Path.home() / "HorrorGames"
        proj = (base / folder_name(name)).resolve()
        print(f"making {name} in {proj} (a minute or two: the plugins, the sounds, the import)")
        why = make(name, proj, artist=artist)
        if why:
            print("HORRORGAME FAILED: " + why)
            return 1
        print(f"{name} is ready: open {proj / 'project.godot'} in Godot 4.7 and press F5 (its README.md says what's in it)")
        return 0
    if argv[0] == "update":
        if len(argv) < 2:
            print("which project? python tools/horror_game.py update FOLDER")
            return 2
        proj = Path(argv[1]).expanduser().resolve()
        rc = BH.main(["install", str(proj), "--starter"])
        g = godot()
        if rc == 0 and g:
            subprocess.run([g, "--headless", "--path", str(proj), "--import"], capture_output=True, text=True, timeout=3600)
            print(f"{proj}: imported again; open it in Godot")
        return rc
    # check: one made from scratch and played headless
    g = godot()
    if not g:
        print("HORRORGAME ok (skipped: no godot on the PATH)")
        return 0
    proj = ROOT / "Saved" / "Godot" / "_horror_game"
    shutil.rmtree(proj, ignore_errors=True)
    why = make("Check Game", proj, artist="Check Studio")
    if why:
        print("ERROR: " + why)
        print("HORRORGAME FAILED")
        return 1
    for f in ("base_test.gd", "base_probe.gd"):
        shutil.copy(HERE / "godot" / f, proj / f)
    probe_files(proj)
    subprocess.run([g, "--headless", "--path", str(proj), "--import"], capture_output=True, text=True, timeout=1200)
    errs = played([g, "--headless", "--path", str(proj), "--fixed-fps", "60", "-s", "base_test.gd"])
    errs += played([g, "--headless", "--path", str(proj), "-s", "base_probe.gd"])
    # the game as it ships: the pack Godot exports with the project's own preset (no export templates needed for a
    # pack), played the same way and looked inside
    build = ROOT / "Saved" / "Godot" / "_horror_game_build"
    shutil.rmtree(build, ignore_errors=True)
    build.mkdir(parents=True)
    r = subprocess.run([g, "--headless", "--path", str(proj), "--export-pack", "Linux", str(build / "game.pck")],
                       capture_output=True, text=True, timeout=1200)
    if not (build / "game.pck").is_file():
        errs.append("the pack wasn't exported: " + (r.stdout + r.stderr).strip()[-400:])
    else:
        print(f"  (exported: {(build / 'game.pck').stat().st_size / 1e6:.0f} MB with the project's Linux preset)")
        errs += played([g, "--headless", "--main-pack", str(build / "game.pck"), "--fixed-fps", "60", "-s", "res://base_test.gd", "--", "--packed"], cwd=build)
        errs += played([g, "--headless", "--main-pack", str(build / "game.pck"), "-s", "res://base_probe.gd", "--", "--packed"], cwd=build)
    main_text = (proj / "main.tscn").read_text(encoding="utf-8") if (proj / "main.tscn").is_file() else ""
    if "_Talk" in main_text or "_reach" in main_text:
        errs.append("main.tscn holds something made while a game ran")
    for e in errs:
        print("ERROR: " + e)
    print("HORRORGAME ok" if not errs else f"HORRORGAME FAILED ({len(errs)})")
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
