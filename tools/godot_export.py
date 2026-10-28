#!/usr/bin/env python3
"""A game on the desk -> a Godot 4.7 project (docs/GODOT_EXPORT.md; storykit/godot.py does the writing).

    python tools/godot_export.py --game Pilot              -> Saved/Godot/Pilot/
    python tools/godot_export.py --game Pilot --zip        -> and Saved/Godot/Pilot.zip
    python tools/godot_export.py --game Pilot --out DIR
    python tools/godot_export.py --check                   -> GDEXPORT: every game exported and opened headless
    python tools/godot_export.py --game Pilot --shot a.png -> a picture from the start, under xvfb (lavapipe)

Godot: $GODOT, else `godot`, else `godot-mono` (the user's machine; tools/godot_setup.sh on a cloud session).
"""
import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "Content" / "Python"))
from storykit import godot as G  # noqa: E402
from storykit import storylib as L  # noqa: E402


def godot_bin():
    for c in [os.environ.get("GODOT"), "godot", "godot-mono"]:
        if c and shutil.which(c):
            return shutil.which(c)
    return None


def import_project(project, timeout=300):
    """Godot's first import of the project (its .godot/ folder, the global class cache): needed before a script that
    names a class_name runs headless (Woohill's lesson)."""
    g = godot_bin()
    if not g:
        return 127
    r = subprocess.run([g, "--headless", "--path", str(project), "--import"], capture_output=True, text=True, timeout=timeout)
    return r.returncode


def run_godot(project, script, extra=(), xvfb=False, timeout=240):
    g = godot_bin()
    if not g:
        return 127, "no godot (tools/godot_setup.sh on a cloud session; godot-mono on the user's machine)"
    if not (Path(project) / ".godot" / "global_script_class_cache.cfg").exists():
        import_project(project)
    cmd = [g, "--path", str(project), "-s", script, *extra]
    env = dict(os.environ)
    if xvfb:
        env.setdefault("VK_ICD_FILENAMES", "/usr/share/vulkan/icd.d/lvp_icd.json")
        cmd = ["xvfb-run", "-a", g, "--path", str(project), "--rendering-driver", "vulkan", "-s", script, *extra] if not os.environ.get("DISPLAY") else cmd
    else:
        cmd.insert(1, "--headless")
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, env=env)
    except subprocess.TimeoutExpired:
        return 124, "timed out"
    noise = ("ALSA", "ERR_CANT_OPEN", "snd_", "leaked at exit", "Pages in use", "still in use at exit", "RID allocations")
    lines = [ln for ln in (r.stdout + r.stderr).splitlines() if ln.strip() and not any(x in ln for x in noise)]
    return r.returncode, "\n".join(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--game")
    ap.add_argument("--out")
    ap.add_argument("--zip", action="store_true")
    ap.add_argument("--check", action="store_true", help="GDEXPORT: export every game (or --game) and open it headless")
    ap.add_argument("--shot", help="a picture from the start, under xvfb")
    a = ap.parse_args()
    games = [a.game] if a.game else L.games()
    ok = True
    for game in games:
        r = G.export(game, a.out if a.game else None, a.zip)
        print(f"exported {game}: {r['pieces']} pieces, levels {', '.join(r['levels'])} -> {r['dir']}" + (f", {r['zip']}" if r["zip"] else ""))
        if a.check:
            code, out = run_godot(r["dir"], "res://addons/horrorstudio/tests/load_check.gd")
            print("\n".join("  " + ln for ln in out.splitlines()[-12:]))
            if code != 0 or "GDEXPORT ok" not in out:
                ok = False
        if a.shot:
            shot = Path(a.shot).resolve()
            code, out = run_godot(r["dir"], "res://addons/horrorstudio/tests/shot.gd", ["--", f"--shot={shot}"], xvfb=True)
            print("\n".join("  " + ln for ln in out.splitlines()[-4:]))
            if code != 0 or not shot.exists():
                ok = False
    if a.check:
        print("GDEXPORT ok" if ok else "GDEXPORT FAIL")
        sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
