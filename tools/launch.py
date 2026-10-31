#!/usr/bin/env python3
"""The studio launcher: pick a tool from a list instead of typing its command.

    python tools/launch.py              (or ./studio from the project folder; .\\studio in PowerShell)
    python tools/launch.py desk         filter straight away: runs it if one tool matches
    python tools/launch.py --list       every tool and its command, then exit

At the prompt: a number runs that tool, words filter the list (`motion`, `check pilot`...), r1 to r5 rerun a recent
one, g changes the game, close stops every page still running, q quits. Tools that need a game ask once (the last
game is remembered); tools that need a word or a folder ask for it. The pages (the desk, the score room, Kimodo's
demo) start in their own window and open in the browser, so the launcher stays free; the menu marks the ones running,
and the same number again stops that page (pages on one server, like the desk and the builder, share it: another of
them only opens its page). Running pages are kept in Saved/launch.json, so a new launcher can still stop them.

    python tools/launch.py --close      stop every page the launcher started, then exit

The same tools as a page: python dashboard.py (the dashboard, in the project folder; it shares Saved/launch.json).
"""
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GAMES = ROOT / "Content" / "Games"
STATE = ROOT / "Saved" / "launch.json"
WIN = os.name == "nt"
PY = sys.executable or "python"

# the look: colours only on a terminal that has them (NO_COLOR turns them off), the banner in the bloody figlet font
if WIN:
    os.system("")                                                # turns on the console's colour codes
COLOR = sys.stdout.isatty() and not os.environ.get("NO_COLOR") and os.environ.get("TERM") != "dumb"


def paint(text, *codes):
    return "\033[%sm%s\033[0m" % (";".join(map(str, codes)), text) if COLOR and codes else text


BLOOD, RED, DARK, BONE, ASH = (38, 5, 196), (38, 5, 160), (38, 5, 88), (38, 5, 252), (38, 5, 242)
DRIP = [196, 196, 160, 160, 124, 124, 88, 88, 52, 52]           # the banner's rows, bright at the top, dried at the drips
BANNER_WIDE = """\
 ██░ ██  ▒█████   ██▀███   ██▀███   ▒█████   ██▀███       ██████ ▄▄▄█████▓ █    ██ ▓█████▄  ██▓ ▒█████
▓██░ ██▒▒██▒  ██▒▓██ ▒ ██▒▓██ ▒ ██▒▒██▒  ██▒▓██ ▒ ██▒   ▒██    ▒ ▓  ██▒ ▓▒ ██  ▓██▒▒██▀ ██▌▓██▒▒██▒  ██▒
▒██▀▀██░▒██░  ██▒▓██ ░▄█ ▒▓██ ░▄█ ▒▒██░  ██▒▓██ ░▄█ ▒   ░ ▓██▄   ▒ ▓██░ ▒░▓██  ▒██░░██   █▌▒██▒▒██░  ██▒
░▓█ ░██ ▒██   ██░▒██▀▀█▄  ▒██▀▀█▄  ▒██   ██░▒██▀▀█▄       ▒   ██▒░ ▓██▓ ░ ▓▓█  ░██░░▓█▄   ▌░██░▒██   ██░
░▓█▒░██▓░ ████▓▒░░██▓ ▒██▒░██▓ ▒██▒░ ████▓▒░░██▓ ▒██▒   ▒██████▒▒  ▒██▒ ░ ▒▒█████▓ ░▒████▓ ░██░░ ████▓▒░
 ▒ ░░▒░▒░ ▒░▒░▒░ ░ ▒▓ ░▒▓░░ ▒▓ ░▒▓░░ ▒░▒░▒░ ░ ▒▓ ░▒▓░   ▒ ▒▓▒ ▒ ░  ▒ ░░   ░▒▓▒ ▒ ▒  ▒▒▓  ▒ ░▓  ░ ▒░▒░▒░
 ▒ ░▒░ ░  ░ ▒ ▒░   ░▒ ░ ▒░  ░▒ ░ ▒░  ░ ▒ ▒░   ░▒ ░ ▒░   ░ ░▒  ░ ░    ░    ░░▒░ ░ ░  ░ ▒  ▒  ▒ ░  ░ ▒ ▒░
 ░  ░░ ░░ ░ ░ ▒    ░░   ░   ░░   ░ ░ ░ ░ ▒    ░░   ░    ░  ░  ░    ░       ░░░ ░ ░  ░ ░  ░  ▒ ░░ ░ ░ ▒
 ░  ░  ░    ░ ░     ░        ░         ░ ░     ░              ░              ░        ░     ░      ░ ░
                                                                                    ░"""
BANNER = """\
 ██░ ██  ▒█████   ██▀███   ██▀███   ▒█████   ██▀███
▓██░ ██▒▒██▒  ██▒▓██ ▒ ██▒▓██ ▒ ██▒▒██▒  ██▒▓██ ▒ ██▒
▒██▀▀██░▒██░  ██▒▓██ ░▄█ ▒▓██ ░▄█ ▒▒██░  ██▒▓██ ░▄█ ▒
░▓█ ░██ ▒██   ██░▒██▀▀█▄  ▒██▀▀█▄  ▒██   ██░▒██▀▀█▄
░▓█▒░██▓░ ████▓▒░░██▓ ▒██▒░██▓ ▒██▒░ ████▓▒░░██▓ ▒██▒
 ▒ ░░▒░▒░ ▒░▒░▒░ ░ ▒▓ ░▒▓░░ ▒▓ ░▒▓░░ ▒░▒░▒░ ░ ▒▓ ░▒▓░
 ▒ ░▒░ ░  ░ ▒ ▒░   ░▒ ░ ▒░  ░▒ ░ ▒░  ░ ▒ ▒░   ░▒ ░ ▒░
 ░  ░░ ░░ ░ ░ ▒    ░░   ░   ░░   ░ ░ ░ ░ ▒    ░░   ░
 ░  ░  ░    ░ ░     ░        ░         ░ ░     ░"""
WHISPERS = [
    "the lights are off. pick a door.",
    "something is breathing in the build folder.",
    "every take is ten seconds or less. she isn't.",
    "don't look behind the locker slats.",
    "the desk remembers what you left on it.",
    "she was in the hallway a second ago.",
]


def banner():
    width = shutil.get_terminal_size((100, 30)).columns
    art = BANNER_WIDE if width > 105 else BANNER
    print()
    for n, row in enumerate(art.split("\n")):
        print(paint(row, 38, 5, DRIP[min(n, len(DRIP) - 1)]))
    tag = "s  t  u  d  i  o" if art is BANNER else ""
    if tag:
        print(paint(tag.center(53), 1, *BONE))
    print(paint(("   " + WHISPERS[int(time.time()) % len(WHISPERS)]), 3, *ASH))


def rule(title, width):
    head = "▓▒░ " + title.upper() + " "
    return " " + paint(head, 1, *RED) + paint("─" * max(4, min(width, 80) - len(head) - 2), *DARK)


def say(text, kind="note"):
    mark, codes = {"ok": ("◉", BLOOD), "stop": ("✝", RED), "warn": ("!", (1,) + BLOOD), "note": ("·", ASH)}[kind]
    print(paint(mark, *codes) + " " + (paint(text, *ASH) if kind == "note" else text))


# (section, label, command, options). In a command: {game} asks for the game; {ask:Prompt} asks for a word or path;
# {opt:Prompt|--flag} the same, but empty leaves it out (and --flag goes before the answer when there is one).
# options: url (a page: started in its own window, then opened).
TOOLS = [
    ("Pages", "Writers' room (write a game's story as a flowchart: its points, choices, secrets, endings)", "tools/writers/serve.py", {"url": "http://127.0.0.1:8795"}),
    ("Pages", "Director's desk", "tools/director/serve.py", {"url": "http://127.0.0.1:8780"}),
    ("Pages", "Score room (music)", "tools/score/serve.py", {"url": "http://127.0.0.1:8791"}),
    ("Pages", "Scene builder (floor plans)", "tools/director/serve.py", {"url": "http://127.0.0.1:8780/builder.html"}),
    ("Pages", "Street builder (the streets and the outsides of buildings: the map the enterable buildings go into)", "tools/director/serve.py", {"url": "http://127.0.0.1:8780/street.html"}),
    ("Pages", "Face mesh: photos to a head", "tools/director/serve.py", {"url": "http://127.0.0.1:8780/face.html"}),
    ("Pages", "Character Studio (body, face, skin, hair in the salon, clothes)", "tools/character/serve.py", {"url": "http://127.0.0.1:8793"}),
    ("Pages", "Salon (hair as locks: strands, sheets, bundles, against a locked reference video)", "tools/character/serve.py", {"url": "http://127.0.0.1:8793/salon.html"}),
    ("Pages", "Kit maker (room things from numbers)", "tools/director/serve.py", {"url": "http://127.0.0.1:8780/kit.html"}),
    ("Pages", "PBR shelf (your texture sets in assets/pbr, on a sphere; the Character Studio has it as its PBR button)", "tools/director/serve.py", {"url": "http://127.0.0.1:8780/pbr.html"}),
    ("Pages", "Pigment test (projected art as pigment)", "tools/director/serve.py", {"url": "http://127.0.0.1:8780/pigment.html"}),
    ("Pages", "Kimodo demo", "tools/kimodo.py demo", {"url": "http://127.0.0.1:7860"}),

    ("Godot", "Export a game as its own Godot 4.7 project, a new version each time (Saved/Godot/<game>_v001, _v002... and its .zip, with a guide to editing it; record the scenes on the desk first)", "tools/godot_export.py --game {game} --zip", {}),
    ("Godot", "Record a game's scenes for the export (the desk running)", "node tools/godot/bake.mjs --game {game}", {}),
    ("Godot", "Godot check (4.7 runs headless and draws a lit box)", "tools/godot/check.sh", {}),
    ("Godot", "Pictures for a game's guide, made by Godot (the start by day and night, the first scene from the bake), the guide written again", "tools/godot_export.py --game {game} --pictures", {}),
    ("Godot", "Godot export check (every game exported and opened headless)", "tools/godot_export.py --check", {}),
    ("Godot", "Godot look check (UltraVHS's chart through the export's tape shader, measured)", "tools/godot/look_check.py", {}),
    ("Godot", "The look plugin's check (its demo room pictured and measured: wet floors, blood, rain, wet skin)", "tools/godot/plugin_check.py", {}),
    ("Godot", "A Character Studio export in Godot on the skin shader (GDPEOPLE: flat-lit against its paint, dry, sweating, oiled)", "tools/godot/people_check.py", {}),
    ("Godot", "A character as the Studio draws it beside Godot's render of its export (GDSTUDIO: the skin's colour alike; the Studio's server running)", "tools/godot/studio_compare.py", {}),
    ("Godot", "The Pilot played in Godot (GDPLAY)", "tools/godot_export.py --game Pilot --play", {}),
    ("Godot", "TestRoom001 played in Godot station by station (GDTESTROOM)", "tools/godot_export.py --game TestRoom001 --testroom", {}),
    ("Godot", "A street as the .glb to drop into a Godot folder (into Saved/Streets/<street>; the desk running)", "node tools/director/streetexport.mjs --street {ask:Street}", {}),
    ("Godot", "A street imported in Godot and checked: colliders, occluders, lamps, colours (GDSTREET; the desk running)", "tools/godot/street_check.py --street {ask:Street}", {}),

    ("Checks", "Every offline check, every game", "tools/check_all.py", {}),
    ("Checks", "Every offline check, one game", "tools/check_all.py --game {game}", {}),
    ("Checks", "Story check, verbose", "tools/story_check.py --game {game} -v", {}),
    ("Checks", "Level check", "tools/level_check.py --game {game}", {}),
    ("Checks", "Shots review (plan only, no pictures)", "tools/shots_sheet.py --game {game} --plan", {}),
    ("Checks", "Shots review (after the editor took them)", "tools/shots_sheet.py --game {game}", {}),
    ("Checks", "Score check (music cues and palettes)", "node tools/score/check.js", {}),
    ("Checks", "PBR shelf check", "tools/pbr.py check", {}),
    ("Checks", "Sound shelf check", "tools/sfx.py check", {}),
    ("Checks", "Texture templates check (the placeholder things' layouts, the .ora, the desk's UVs)", "tools/uv_templates.py check", {}),
    ("Checks", "Expressions test (the library in the desk, headless browser; the desk running)", "node tools/director/exprtest.mjs", {}),
    ("Checks", "Kit check (presets and kit props)", "node tools/kit/check.mjs", {}),
    ("Checks", "Street check (every building style, part, thing and fence; every street; each shot against its photo)", "tools/street.py check", {}),
    ("Checks", "Street page test (the street builder in a headless browser; the desk running)", "node tools/director/streettest.mjs", {}),
    ("Checks", "Street bake check (a street baked in Blender, read back and dropped into Godot: STREETBAKE; the desk running)", "tools/street.py bake-check --godot", {}),
    ("Checks", "Tailor check (every clothing design on seven bodies)", "node tools/character/tailor/check.mjs", {}),
    ("Checks", "Play mode test (the Pilot walked, headless browser; the desk running)", "node tools/director/playtest.js", {}),
    ("Checks", "Test room (TestRoom001 played station by station, headless browser; the desk running; the reference for Unreal)", "node tools/director/testroom.mjs", {}),
    ("Checks", "Board games check (every game's rules played hundreds of times)", "node tools/director/play/boardtest.mjs", {}),
    ("Checks", "Time of day on the desk (the desk running)", "node tools/director/timetest.js", {}),
    ("Checks", "A cast member's models on the desk (the desk running)", "node tools/director/modelstest.js", {}),
    ("Checks", "Dashboard test (headless browser, its own dashboard on port 8798)", "node tools/dashboard/dashtest.mjs", {}),
    ("Checks", "Writers' room check (the chart's format and check, the prompt library, the upgrade, a build through check_all)", "tools/writers/room.py check", {}),
    ("Checks", "Writers' room page test (the chart drawn in a headless browser, built)", "node tools/writers/pagetest.mjs", {}),
    ("Checks", "Blender look check (Light Kit's times, UltraVHS's camcorder; needs the Blender module)", "tools/blender_look_check.py", {}),
    ("Story", "Kit meshes (the Godot export builds them too)", "tools/kit_build.py --game {game}", {}),

    ("Story", "Notes from the desk", "tools/story.py --game {game} notes", {}),
    ("Story", "Flow graph", "tools/story.py --game {game} flow", {}),
    ("Story", "Show one scene, stitch or node", "tools/story.py --game {game} show {ask:Id}", {}),
    ("Story", "Stats (minutes, words)", "tools/story.py --game {game} stats", {}),
    ("Story", "Rooms", "tools/story.py --game {game} rooms", {}),
    ("Story", "Cast", "tools/story.py --game {game} cast", {}),
    ("Story", "Props still blocks (art to place)", "tools/story.py --game {game} art", {}),
    ("Story", "Plan view picture (needs Pillow)", "tools/plan_view.py --game {game}", {}),
    ("Story", "Texture templates for Krita (every placeholder thing, or one; into Art/Textures)", "tools/uv_templates.py --game {game} {opt:A thing's id (Enter: every one)}", {}),
    ("Story", "Texture templates: what's painted, what's stale", "tools/uv_templates.py --game {game} list", {}),
    ("Story", "New game", "tools/story.py new {ask:New game's name}", {}),

    ("Streets", "Streets: what each one holds", "tools/street.py list", {}),
    ("Streets", "A street as text", "tools/street.py show {ask:Street}", {}),
    ("Streets", "A street drawn through its shot, beside its photo (into Saved/Streets; the desk running)", "tools/street.py shot {ask:Street} {opt:Shot (Enter: photo)}", {}),
    ("Streets", "New street", "tools/street.py new {ask:New street's name}", {}),
    ("Streets", "A street in Blender: procedural finishes and its wear, rendered through its shot beside the photo (the desk running)", "tools/street.py look {ask:Street} {opt:Shot (Enter: the first; all)}", {}),
    ("Streets", "A street baked for Godot: tileable sets, its wear atlas, the .glb and .blend (colliders kept), pictured in Godot (the desk running)", "tools/street.py bake {ask:Street} --godot", {}),
    ("Streets", "The procedural finishes baked onto the PBR shelf as tileable sets (assets/pbr/Procedural)", "tools/street.py finishes", {}),

    ("Script", "Writers' room: the sessions", "tools/writers/room.py list", {}),
    ("Script", "Writers' room: what the page shows now", "tools/writers/room.py now", {}),
    ("Script", "Writers' room: a session's chart as text", "tools/writers/room.py show {ask:Session id}", {}),
    ("Script", "Writers' room: build a session into the director", "tools/writers/room.py build {ask:Session id}", {}),
    ("Script", "Script generator: outline to story (Ollama)", "tools/scriptgen.py --game {game} new {ask:Outline file}", {}),
    ("Script", "Script generator: review pack", "tools/scriptgen.py --game {game} review", {}),
    ("Script", "Script generator: set up Ollama", "tools/scriptgen.py setup", {}),

    ("Takes", "Takes to record (clips list)", "tools/story.py --game {game} clips", {}),
    ("Takes", "MiniMax prompts, ready to paste", "tools/story.py --game {game} minimax", {}),
    ("Takes", "One-off voice lines", "tools/story.py --game {game} lines", {}),
    ("Takes", "Takes status (recorded, missing, too long)", "tools/intake.py --game {game} --status", {}),
    ("Takes", "Bring in takes from a folder", "tools/intake.py --game {game} {ask:Folder with the takes}", {}),
    ("Takes", "Placeholder voices (Windows speech)", "tools/voice_placeholder.py --game {game} {opt:Language, ja or en (Enter: ja)|--lang}", {}),

    ("Motion", "Kimodo shot list", "tools/motion.py --game {game} shotlist", {}),
    ("Motion", "Import motions saved from Kimodo", "tools/motion.py --game {game} import", {}),
    ("Motion", "Motion jobs", "tools/motion.py --game {game} jobs", {}),
    ("Motion", "Motion check", "tools/motion.py --game {game} check", {}),
    ("Motion", "Motion preview into the desk", "tools/motion.py --game {game} preview", {}),
    ("Motion", "Kimodo check (CUDA, token, encoder)", "tools/kimodo.py check", {}),
    ("Motion", "Retarget: motions to FBX", "tools/retarget.py --game {game} fbx", {}),

    ("Look", "Clothes: an outfit's contact sheet (Saved/tailor_sheet.png)", "node tools/character/tailor/sheet.mjs --outfit {ask:Outfit (e.g. work uniform)} {opt:Body (feminine, masculine, average)|--body} --out Saved/tailor_sheet.png", {}),
    ("Look", "Clothes: pictures of every outfit and design on the default model, for the Studio's picker (Content/Studio/Clothes/thumbs)", "node tools/character/tailor/thumbs.mjs", {}),
    ("Look", "Clothes in motion: an outfit walked, sat and crouched on several bodies (Saved/tailor_motion.png)", "node tools/character/tailor/motion.mjs --outfit {ask:Outfit (e.g. work uniform)} {opt:Bodies (e.g. feminine,full_masculine)|--bodies} --out Saved/tailor_motion.png", {}),
    ("Look", "Face mesh from photos or a video (for Blender)", "tools/face_mesh.py make {ask:Photo, video or folder}", {}),
    ("Look", "An expression from a video of a face (the desk's Expressions tab does this with Import)", "tools/face_capture.py solve {ask:Video} --out {ask:Folder}", {}),
    ("Look", "Salon reference from a turntable video (frames, key, poses, the face fit)", "tools/gshair.py run {ask:Video} --orbit --to reference --ref {ask:Reference name}", {}),

    ("Library", "What the story needs from the CC0 library", "tools/cc0.py needs --game {game}", {}),
    ("Library", "Fetch what the story needs", "tools/cc0.py fetch --game {game}", {}),
    ("Library", "Search props", "tools/cc0.py props {ask:Word}", {}),
    ("Library", "Credits list (ledger)", "tools/cc0.py ledger", {}),
    ("Library", "PBR shelf: scan and list (unpacks new ZIPs)", "tools/pbr.py", {}),
    ("Library", "PBR shelf: five made-up sets to try", "tools/pbr.py demo", {}),
    ("Library", "Sound shelf: list (filter by a word)", "tools/sfx.py list {ask:Word}", {}),
    ("Library", "Sound shelf: fetch the CC0 sound effects", "tools/sfx.py fetch", {}),
    ("Library", "Score room: fetch the added instruments", "tools/score/fetch_samples.py", {}),


    ("Setup", "Find Unreal, Visual Studio, git", "setup/setup.py env", {}),
    ("Setup", "Install or update Kimodo", "setup/setup.py kimodo", {}),
    ("Setup", "Kimodo demo additions: check", "setup/setup.py kimodo-patch check", {}),
    ("Setup", "Kimodo demo additions: apply", "setup/setup.py kimodo-patch apply", {}),
    ("Setup", "Face mesh setup (MediaPipe)", "tools/face_mesh.py setup", {}),
    ("Setup", "Salon reference setup (torch, OpenCV, MediaPipe, the models)", "tools/gshair.py setup", {}),
    ("Setup", "Blender module setup (retarget)", "tools/retarget.py setup", {}),
]


def load_state():
    try:
        return json.loads(STATE.read_text("utf-8"))
    except (OSError, ValueError):
        return {}


def save_state(state):
    try:
        STATE.parent.mkdir(parents=True, exist_ok=True)
        STATE.write_text(json.dumps(state, indent=1), "utf-8")
    except OSError:
        pass


def games():
    return sorted(p.name for p in GAMES.iterdir() if (p / "story.json").is_file()) if GAMES.is_dir() else []


def ask(prompt, default=""):
    try:
        shown_prompt = paint("\n☠ ❯", 1, *BLOOD) if prompt == ">" else paint(prompt, *BONE) + (paint(" [" + default + "]", *ASH) if default else "") + ":"
        v = input(shown_prompt + " ").strip()
    except EOFError:
        return None
    return v or default


def pick_game(state, force=False):
    gs = games()
    if not gs:
        say("No games yet (Content/Games/<Name>/story.json).", "warn")
        return None
    last = state.get("game")
    if not force and last in gs:
        return last
    for i, g in enumerate(gs, 1):
        print("  %s  %s" % (paint("%2d" % i, 1, *BLOOD), g))
    v = ask("Game (number or name)", last if last in gs else gs[0])
    if v is None:
        return None
    g = gs[int(v) - 1] if v.isdigit() and 1 <= int(v) <= len(gs) else v
    if g not in gs:
        say("No game called %s." % g, "warn")
        return None
    state["game"] = g
    save_state(state)
    return g


def build(cmd, state):
    """The command as an argument list, asking for the game and any words it needs; None when cancelled."""
    out = []
    for tok in re.findall(r"\{[^}]*\}|\S+", cmd):
        if "{game}" in tok:
            g = pick_game(state)
            if not g:
                return None
            tok = tok.replace("{game}", g)
        if tok.startswith("{ask:") or tok.startswith("{opt:"):
            prompt, _, flag = tok[5:-1].partition("|")
            v = ask(prompt)
            if v is None or (not v and tok.startswith("{ask:")):
                return None
            if v:
                out += ([flag] if flag else []) + [v.strip('"')]
            continue
        out.append(tok)
    if out[0] == "node":
        if not shutil.which("node"):
            say("This one needs Node.js (https://nodejs.org).", "warn")
            return None
        return out
    return [PY] + out


def shown(args):
    return " ".join(('"%s"' % a if " " in a else a) for a in (["python"] + args[1:] if args[0] == PY else args))


def alive(pid, args):
    """Whether the page server started as pid is still that server (not a reused pid)."""
    if WIN:
        out = subprocess.run(["tasklist", "/FI", "PID eq %d" % pid, "/NH"], capture_output=True, text=True).stdout
        return str(pid) in out
    try:
        cmdline = Path("/proc/%d/cmdline" % pid).read_bytes().decode("utf-8", "replace")
    except OSError:
        try:
            os.kill(pid, 0)
        except OSError:
            return False
        return True
    return Path(args[1]).name in cmdline


def running(state):
    """The page servers still up, by command; the dead ones are forgotten."""
    live = {k: r for k, r in state.get("running", {}).items() if alive(r["pid"], r["args"])}
    if live != state.get("running", {}):
        state["running"] = live
        save_state(state)
    return live


def stop(state, key):
    r = state.get("running", {}).pop(key, None)
    save_state(state)
    if not r or not alive(r["pid"], r["args"]):
        return
    if WIN:                                                      # the whole tree: uv and the like start children
        subprocess.run(["taskkill", "/T", "/F", "/PID", str(r["pid"])], capture_output=True)
    else:                                                        # its own session: the group is the server and its children
        try:
            os.killpg(r["pid"], signal.SIGTERM)
            for _ in range(30):
                if not alive(r["pid"], r["args"]):
                    break
                time.sleep(0.1)
            else:
                os.killpg(r["pid"], signal.SIGKILL)
        except OSError:
            pass
    say("Stopped %s." % " / ".join(r["labels"]), "stop")


def close_all(state):
    live = running(state)
    if not live:
        say("No pages running.")
    for k in list(live):
        stop(state, k)


def run(label, args, opts, dry=False, state=None):
    if opts.get("url") and state is not None and not dry:
        key = shown(args)
        r = running(state).get(key)
        if r and label in r["labels"]:                           # the same number again: the page again (x<number> stops it)
            webbrowser.open(opts["url"])
            say("%s: %s %s" % (label, paint(opts["url"], 4, *BONE), paint("(already running: x%s stops it)" % (TOOLS.index(next(t for t in TOOLS if t[1] == label)) + 1), *ASH)), "ok")
            return 0
        if r:                                                    # its server is up for another page: just open this one
            r["labels"].append(label)
            save_state(state)
            webbrowser.open(opts["url"])
            say("%s: %s %s" % (label, paint(opts["url"], 4, *BONE), paint("(its server is already running)", *ASH)), "ok")
            return 0
    print("\n" + paint("❯ ", *RED) + paint(shown(args), *ASH) + "\n")
    if dry:
        return 0
    if opts.get("url"):
        # a page: its server in its own window (Windows) or in the background, then the browser
        if WIN:
            proc = subprocess.Popen(args, cwd=ROOT, creationflags=subprocess.CREATE_NEW_CONSOLE)
        else:                                                    # no new window here: its output goes to a log
            log = ROOT / "Saved" / "launch" / (Path(args[1]).parent.name + ".log")
            log.parent.mkdir(parents=True, exist_ok=True)
            with open(log, "ab") as f:
                proc = subprocess.Popen(args, cwd=ROOT, start_new_session=True, stdin=subprocess.DEVNULL, stdout=f, stderr=subprocess.STDOUT)
            say("its output: " + str(log.relative_to(ROOT)))
        time.sleep(1.5)
        if proc.poll() is not None:                              # gone already: most often its port is taken
            say("%s stopped straight away (is it running from somewhere else?)%s" % (label, "" if WIN else "; see its output"), "warn")
        elif state is not None:
            state.setdefault("running", {})[shown(args)] = {"pid": proc.pid, "args": args, "labels": [label]}
            save_state(state)
        webbrowser.open(opts["url"])
        say("%s is starting%s: %s" % (label, " in its own window" if WIN else "", paint(opts["url"], 4, *BONE)), "ok")
        say("its number again stops it; close stops every page")
        return 0
    try:
        return subprocess.call(args, cwd=ROOT)
    except KeyboardInterrupt:
        print()
        say("stopped", "stop")
        return 130


def matches(words):
    words = [w.lower() for w in words]
    return [i for i, (sec, label, cmd, _) in enumerate(TOOLS) if all(w in (sec + " " + label + " " + cmd).lower() for w in words)]


def show_menu(idx, state):
    width = shutil.get_terminal_size((100, 30)).columns
    up = {l for r in running(state).values() for l in r["labels"]}
    print("\n" + paint(" ━━ HORROR STUDIO ━━", 1, *BLOOD)
          + (paint("  game ", *ASH) + paint(state["game"], 1, *BONE) if state.get("game") else "")
          + (paint("  ● %d page%s running" % (len(running(state)), "s" if len(running(state)) > 1 else ""), *BLOOD) if up else ""))
    sec = None
    for i in idx:
        s, label, cmd, opts = TOOLS[i]
        if s != sec:
            print("\n" + rule(s, width))
            sec = s
        line = "  " + paint("%2d" % (i + 1), 1, *BLOOD) + " " + (paint("●", *BLOOD) if label in up else " ") + " " \
            + (paint(label, 1, *BONE) if label in up else label)
        if width >= 100:
            stem = Path(cmd.split()[1] if cmd.startswith("node ") else cmd.split()[0]).stem
            line += " " * max(1, 46 - len(label)) + paint(stem, *ASH)
        print(line)
    recent = state.get("recent", [])
    if recent:
        print("\n" + rule("Recent", width))
        for n, r in enumerate(recent[:5], 1):
            print("  " + paint("r%d" % n, 1, *RED) + "   " + r["label"] + (paint("  " + r["shown"], *ASH) if width >= 100 else ""))
    keys = [("number", "run" + (" (a ● again: open it)" if up else "")), ("words", "filter"), ("r1-r5", "recent"), ("g", "game")] \
        + ([("x<number>", "stop a ●"), ("close", "stop the pages")] if up else []) + [("q", "quit")]
    print("\n " + paint("  ·  ", *DARK).join(paint(k, 1, *RED) + " " + paint(t, *ASH) for k, t in keys))


def remember(state, label, args, opts):
    r = {"label": label, "args": [a if a != PY else "{py}" for a in args], "url": opts.get("url"), "shown": shown(args)}
    state["recent"] = [r] + [x for x in state.get("recent", []) if x.get("shown") != r["shown"]][:4]
    save_state(state)


def main(argv):
    state = load_state()
    if "--list" in argv:
        try:
            for s, label, cmd, _ in TOOLS:
                print("%-8s %-46s %s" % (s, label, cmd))
        except BrokenPipeError:
            pass
        return 0
    if "--close" in argv:
        close_all(state)
        return 0
    dry = "--dry" in argv
    words = [a for a in argv if not a.startswith("--")]
    idx = matches(words) if words else list(range(len(TOOLS)))
    if words and len(idx) == 1:
        s, label, cmd, opts = TOOLS[idx[0]]
        args = build(cmd, state)
        if args:
            remember(state, label, args, opts)
            return run(label, args, opts, dry, state)
        return 1
    banner()
    while True:
        show_menu(idx or list(range(len(TOOLS))), state)
        v = ask(">")
        if v is None or v.lower() in ("q", "quit", "exit"):
            n = len(running(state))
            if n:
                say("%d page%s still running (close, or launch.py --close, stops them)." % (n, "s" if n > 1 else ""))
            print(paint("  sleep well.", 3, *DARK))
            return 0
        if v.lower() in ("close", "c", "stop"):
            close_all(state)
            continue
        if v.lower()[0] == "x" and v[1:].isdigit():             # stop one page's server
            n = int(v[1:]) - 1
            hit = [k for k, r in running(state).items() if 0 <= n < len(TOOLS) and TOOLS[n][1] in r["labels"]]
            if not hit:
                say("%s isn't running." % (TOOLS[n][1] if 0 <= n < len(TOOLS) else "No tool " + v[1:]), "warn")
            for k in hit:
                stop(state, k)
            continue
        if not v:
            idx = list(range(len(TOOLS)))
            continue
        if v.lower() == "g":
            pick_game(state, force=True)
            continue
        if v.lower()[0] == "r" and v[1:].isdigit():
            recent = state.get("recent", [])
            n = int(v[1:]) - 1
            if 0 <= n < len(recent):
                r = recent[n]
                args = [PY if a == "{py}" else a for a in r["args"]]
                remember(state, r["label"], args, {"url": r.get("url")})
                run(r["label"], args, {"url": r.get("url")}, dry, state)
                if not r.get("url"):
                    ask("\n(Enter for the menu)")
            continue
        if v.isdigit():
            n = int(v) - 1
            if not 0 <= n < len(TOOLS):
                say("No tool %s." % v, "warn")
                continue
            s, label, cmd, opts = TOOLS[n]
            args = build(cmd, state)
            if not args:
                continue
            remember(state, label, args, opts)
            run(label, args, opts, dry, state)
            if not opts.get("url"):
                ask("\n(Enter for the menu)")
            idx = list(range(len(TOOLS)))
            continue
        found = matches(v.split())
        if not found:
            say("Nothing matches %r." % v, "warn")
        idx = found


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]) or 0)
