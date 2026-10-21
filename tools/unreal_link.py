#!/usr/bin/env python3
"""The desk's Generate: a game from the desk to Unreal with nobody in between (docs/UNREAL_FLOW.md §1).

    python tools/unreal_link.py --game Pilot generate     the checks, then the build in Unreal
    python tools/unreal_link.py --game Pilot status       what the last Generate did (Saved/Story/<G>/generate/)

The checks first (story_check, level_check): nothing goes across that the desk hasn't proved. Then, if the editor is
open, the build goes in through UnrealClaude's port (localhost:3000, scripts auto-approved); if it isn't, the editor
is started and Content/Python/init_unreal.py runs the build once it has loaded. Either way storykit.generate writes result.json when it's done.
Plain Python, no installs; the desk's server calls generate() and status().
"""
import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "Content" / "Python"))
from storykit import storylib as L  # noqa: E402

BRIDGE = "http://localhost:3000"
UE_LAUNCHER = Path.home() / ".local" / "bin" / "ue"        # unreal-omarchy's launcher
ENV = ROOT / "setup" / "env.json"


def out_dir(game):
    d = ROOT / "Saved" / "Story" / game / "generate"
    d.mkdir(parents=True, exist_ok=True)
    return d


def bridge(path, body=None, timeout=3):
    req = urllib.request.Request(BRIDGE + path, data=None if body is None else json.dumps(body).encode("utf-8"),
                                 headers={"Content-Type": "application/json"}, method="GET" if body is None else "POST")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def editor_up():
    try:
        return bool(bridge("/mcp/status"))
    except OSError:
        return False


def editor_running():
    """An editor process with this project, open but maybe still loading (its port comes up last)."""
    r = subprocess.run(["pgrep", "-a", "UnrealEditor"], capture_output=True, text=True)
    return any(str(ROOT) in line for line in r.stdout.splitlines())


def checks(game):
    out, ok = [], True
    for tool in ("story_check.py", "level_check.py"):
        r = subprocess.run([sys.executable, str(ROOT / "tools" / tool), "--game", game],
                           capture_output=True, text=True, encoding="utf-8")
        out.append((r.stdout + r.stderr).strip().splitlines()[-1] if (r.stdout + r.stderr).strip() else tool)
        ok = ok and r.returncode == 0
    return ok, out


def script(game):
    return (f"# @Description: Generate {game} from the desk\n"
            f"import storykit.generate as g\ng.run({game!r})\n")


def start_editor(game):
    """The editor, with a note for init_unreal.py to run the build once it has loaded (-ExecutePythonScript runs too
    early and closes the editor after). Its output to a log, so nothing waits on it (LESSONS)."""
    up = json.loads(ENV.read_text(encoding="utf-8"))["uproject"] if ENV.exists() else str(next(ROOT.glob("*.uproject")))
    (out_dir(game) / "pending").write_text(game, encoding="utf-8")
    exe = str(UE_LAUNCHER) if UE_LAUNCHER.exists() else str(Path(json.loads(ENV.read_text())["engine"]) / "Engine" / "Binaries" / "Linux" / "UnrealEditor")
    log = open(out_dir(game) / "editor.log", "w", encoding="utf-8")
    subprocess.Popen([exe, up], stdout=log, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL, start_new_session=True)


def generate(game):
    """Returns at once: {"ok", "how", "checks"}; the build itself reports through status()."""
    ok, out = checks(game)
    res = out_dir(game) / "result.json"
    if not ok:
        return {"ok": False, "how": "checks", "checks": out, "error": "the checks failed: fix the story first"}
    res.write_text(json.dumps({"state": "sent", "game": game, "started": time.time()}), encoding="utf-8")
    if editor_up():
        (out_dir(game) / "pending").unlink(missing_ok=True)      # a start-up build that never ran: this one replaces it
        r = bridge("/mcp/tool/execute_script", {"script_type": "python", "script_content": script(game)}, timeout=30)
        if not r.get("success"):
            return {"ok": False, "how": "bridge", "checks": out, "error": r.get("message", "the editor refused the script")}
        return {"ok": True, "how": "editor", "checks": out}
    if editor_running():
        return {"ok": False, "how": "loading", "checks": out,
                "error": "the editor is still loading (its port isn't up yet): Generate again in a minute"}
    start_editor(game)
    return {"ok": True, "how": "started", "checks": out}


def status(game):
    f = out_dir(game) / "result.json"
    if not f.exists():
        return {"state": "none"}
    r = json.loads(f.read_text(encoding="utf-8"))
    r["editor"] = editor_up()
    return r


def main():
    game, args = L.pick_game(sys.argv[1:])
    game = game or (L.games() or [None])[0]
    cmd = args[0] if args else "status"
    if cmd == "generate":
        r = generate(game)
        print("\n".join(r["checks"]))
        print(f"GENERATE sent ({r['how']})" if r["ok"] else f"GENERATE FAILED: {r['error']}")
        sys.exit(0 if r["ok"] else 1)
    if cmd == "status":
        print(json.dumps(status(game), indent=1))
        return
    sys.exit(__doc__)


if __name__ == "__main__":
    main()
