#!/usr/bin/env python3
"""The studio launcher: pick a tool from a list instead of typing its command.

    python tools/launch.py              (or ./studio from the project folder; .\\studio in PowerShell)
    python tools/launch.py desk         filter straight away: runs it if one tool matches
    python tools/launch.py --list       every tool and its command, then exit

At the prompt: a number runs that tool, words filter the list (`motion`, `check pilot`...), r1 to r5 rerun a recent
one, g changes the game, q quits. Tools that need a game ask once (the last game is remembered); tools that need a
word or a folder ask for it. The pages (the desk, the score room, Kimodo's demo) start in their own window and open
in the browser, so the launcher stays free. Plain Python, no installs.
"""
import json
import os
import re
import shutil
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

# (section, label, command, options). In a command: {game} asks for the game; {ask:Prompt} asks for a word or path;
# {opt:Prompt|--flag} the same, but empty leaves it out (and --flag goes before the answer when there is one).
# options: url (a page: started in its own window, then opened).
TOOLS = [
    ("Pages", "Director's desk", "tools/director/serve.py", {"url": "http://127.0.0.1:8780"}),
    ("Pages", "Score room (music)", "tools/score/serve.py", {"url": "http://127.0.0.1:8791"}),
    ("Pages", "Scene builder (floor plans)", "tools/director/serve.py", {"url": "http://127.0.0.1:8780/builder.html"}),
    ("Pages", "Face mesh: photos to a head", "tools/director/serve.py", {"url": "http://127.0.0.1:8780/face.html"}),
    ("Pages", "Character Studio (body, face from pictures, expressions)", "tools/character/serve.py", {"url": "http://127.0.0.1:8793"}),
    ("Pages", "Kit maker (room things from numbers)", "tools/director/serve.py", {"url": "http://127.0.0.1:8780/kit.html"}),
    ("Pages", "PBR shelf (your texture sets)", "tools/director/serve.py", {"url": "http://127.0.0.1:8780/pbr.html"}),
    ("Pages", "Kimodo demo", "tools/kimodo.py demo", {"url": "http://127.0.0.1:7860"}),

    ("Checks", "Every offline check, every game", "tools/check_all.py", {}),
    ("Checks", "Every offline check, one game", "tools/check_all.py --game {game}", {}),
    ("Checks", "Story check, verbose", "tools/story_check.py --game {game} -v", {}),
    ("Checks", "Level check", "tools/level_check.py --game {game}", {}),
    ("Checks", "Shots review (plan only, no pictures)", "tools/shots_sheet.py --game {game} --plan", {}),
    ("Checks", "Shots review (after the editor took them)", "tools/shots_sheet.py --game {game}", {}),
    ("Checks", "Score check (music cues and palettes)", "node tools/score/check.js", {}),
    ("Checks", "PBR shelf check", "tools/pbr.py check", {}),
    ("Checks", "Kit check (presets and kit props)", "node tools/kit/check.mjs", {}),
    ("Checks", "Play mode test (the Pilot walked, headless browser; the desk running)", "node tools/director/playtest.js", {}),
    ("Story", "Kit meshes for Unreal (the importer runs it too)", "tools/kit_build.py --game {game}", {}),

    ("Story", "Notes from the desk", "tools/story.py --game {game} notes", {}),
    ("Story", "Flow graph", "tools/story.py --game {game} flow", {}),
    ("Story", "Show one scene, stitch or node", "tools/story.py --game {game} show {ask:Id}", {}),
    ("Story", "Stats (minutes, words)", "tools/story.py --game {game} stats", {}),
    ("Story", "Rooms", "tools/story.py --game {game} rooms", {}),
    ("Story", "Cast", "tools/story.py --game {game} cast", {}),
    ("Story", "Props still blocks (art to place)", "tools/story.py --game {game} art", {}),
    ("Story", "Plan view picture (needs Pillow)", "tools/plan_view.py --game {game}", {}),
    ("Story", "New game", "tools/story.py --game {game} new {ask:New game's name}", {}),

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
    ("Motion", "Retarget: editor script onto the MetaHumans", "tools/retarget.py --game {game} unreal", {}),

    ("Look", "MetaHuman Creator script for a cast member", "tools/metahuman.py --game {game} {ask:Cast id}", {}),
    ("Look", "Glass-skin texture set", "tools/glass_skin.py", {}),
    ("Look", "Face mesh from photos or a video (for Blender)", "tools/face_mesh.py make {ask:Photo, video or folder}", {}),
    ("Look", "Garment pattern", "tools/garment.py --game {game} pattern {ask:Cast id} {ask:Design (e.g. t-shirt)}", {}),

    ("Library", "What the story needs from the CC0 library", "tools/cc0.py needs --game {game}", {}),
    ("Library", "Fetch what the story needs", "tools/cc0.py fetch --game {game}", {}),
    ("Library", "Search props", "tools/cc0.py props {ask:Word}", {}),
    ("Library", "Credits list (ledger)", "tools/cc0.py ledger", {}),
    ("Library", "PBR shelf: scan and list (unpacks new ZIPs)", "tools/pbr.py", {}),
    ("Library", "PBR shelf: five made-up sets to try", "tools/pbr.py demo", {}),

    ("Ship", "Package a game (dry run)", "tools/package_game.py --game {game} --dry", {}),
    ("Ship", "Package a game", "tools/package_game.py --game {game}", {}),

    ("Setup", "Find Unreal, Visual Studio, git", "setup/setup.py env", {}),
    ("Setup", "Install or update Kimodo", "setup/setup.py kimodo", {}),
    ("Setup", "Kimodo demo additions: check", "setup/setup.py kimodo-patch check", {}),
    ("Setup", "Kimodo demo additions: apply", "setup/setup.py kimodo-patch apply", {}),
    ("Setup", "GarmentCode setup", "tools/garment.py setup", {}),
    ("Setup", "Face mesh setup (MediaPipe)", "tools/face_mesh.py setup", {}),
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
        v = input(prompt + (" [" + default + "]" if default else "") + ("" if prompt.endswith(">") else ":") + " ").strip()
    except EOFError:
        return None
    return v or default


def pick_game(state, force=False):
    gs = games()
    if not gs:
        print("No games yet (Content/Games/<Name>/story.json).")
        return None
    last = state.get("game")
    if not force and last in gs:
        return last
    for i, g in enumerate(gs, 1):
        print("  %d  %s" % (i, g))
    v = ask("Game (number or name)", last if last in gs else gs[0])
    if v is None:
        return None
    g = gs[int(v) - 1] if v.isdigit() and 1 <= int(v) <= len(gs) else v
    if g not in gs:
        print("No game called %s." % g)
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
            print("This one needs Node.js (https://nodejs.org).")
            return None
        return out
    return [PY] + out


def shown(args):
    return " ".join(('"%s"' % a if " " in a else a) for a in (["python"] + args[1:] if args[0] == PY else args))


def run(label, args, opts, dry=False):
    print("\n> " + shown(args) + "\n")
    if dry:
        return 0
    if opts.get("url"):
        # a page: its server in its own window (Windows) or in the background, then the browser
        if WIN:
            subprocess.Popen(args, cwd=ROOT, creationflags=subprocess.CREATE_NEW_CONSOLE)
        else:                                                    # no new window here: its output goes to a log
            log = ROOT / "Saved" / "launch" / (Path(args[1]).parent.name + ".log")
            log.parent.mkdir(parents=True, exist_ok=True)
            with open(log, "ab") as f:
                subprocess.Popen(args, cwd=ROOT, start_new_session=True, stdin=subprocess.DEVNULL, stdout=f, stderr=subprocess.STDOUT)
            print("its output: " + str(log.relative_to(ROOT)))
        time.sleep(1.5)
        webbrowser.open(opts["url"])
        print("%s is starting%s: %s" % (label, " in its own window (close it to stop the page)" if WIN else "", opts["url"]))
        return 0
    try:
        return subprocess.call(args, cwd=ROOT)
    except KeyboardInterrupt:
        print("\n(stopped)")
        return 130


def matches(words):
    words = [w.lower() for w in words]
    return [i for i, (sec, label, cmd, _) in enumerate(TOOLS) if all(w in (sec + " " + label + " " + cmd).lower() for w in words)]


def show_menu(idx, state):
    width = shutil.get_terminal_size((100, 30)).columns
    print("\n=== HorrorStudio tools" + ("   (game: %s)" % state["game"] if state.get("game") else "") + " ===")
    sec = None
    for i in idx:
        s, label, cmd, opts = TOOLS[i]
        if s != sec:
            print("\n " + s)
            sec = s
        line = "  %2d  %s" % (i + 1, label)
        if width >= 100:
            line = line.ljust(52) + " " + Path(cmd.split()[1] if cmd.startswith("node ") else cmd.split()[0]).stem
        print(line)
    recent = state.get("recent", [])
    if recent:
        print("\n Recent")
        for n, r in enumerate(recent[:5], 1):
            print("  r%d  %s" % (n, r["label"] + ("  (" + r["shown"] + ")" if width >= 100 else "")))
    print("\nNumber to run, words to filter, r1-r5 recent, g game, q quit.")


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
    dry = "--dry" in argv
    words = [a for a in argv if not a.startswith("--")]
    idx = matches(words) if words else list(range(len(TOOLS)))
    if words and len(idx) == 1:
        s, label, cmd, opts = TOOLS[idx[0]]
        args = build(cmd, state)
        if args:
            remember(state, label, args, opts)
            return run(label, args, opts, dry)
        return 1
    while True:
        show_menu(idx or list(range(len(TOOLS))), state)
        v = ask(">")
        if v is None or v.lower() in ("q", "quit", "exit"):
            return 0
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
                run(r["label"], args, {"url": r.get("url")}, dry)
                if not r.get("url"):
                    ask("\n(Enter for the menu)")
            continue
        if v.isdigit():
            n = int(v) - 1
            if not 0 <= n < len(TOOLS):
                print("No tool %s." % v)
                continue
            s, label, cmd, opts = TOOLS[n]
            args = build(cmd, state)
            if not args:
                continue
            remember(state, label, args, opts)
            run(label, args, opts, dry)
            if not opts.get("url"):
                ask("\n(Enter for the menu)")
            idx = list(range(len(TOOLS)))
            continue
        found = matches(v.split())
        if not found:
            print("Nothing matches %r." % v)
        idx = found


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]) or 0)
