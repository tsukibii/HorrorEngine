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
    ap.add_argument("--play", action="store_true", help="GDPLAY: the Pilot played headless to its good ending (needs --game Pilot)")
    ap.add_argument("--testroom", action="store_true", help="GDTESTROOM: TestRoom001 played station by station (needs --game TestRoom001)")
    ap.add_argument("--from", dest="from_nid", help="GDTESTROOM: start from a station")
    a = ap.parse_args()
    games = [a.game] if a.game else L.games()
    ok = True
    for game in games:
        r = G.export(game, a.out if a.game else None, a.zip)
        print(f"exported {game}: {r['pieces']} pieces, levels {', '.join(r['levels'])} -> {r['dir']}" + (f", {r['zip']}" if r["zip"] else ""))
        for rel in r.get("kept", []):                       # a re-export: the files the user changed stay, the new ones beside them
            print(f"  kept yours: {rel} (the desk's new version beside it as {G.desk_name(rel)})")
        if a.check:
            guide = Path(r["dir"]) / "guide" / "index.html"
            if not guide.exists() or game not in guide.read_text(encoding="utf-8"):
                print(f"  GDEXPORT FAIL: no guide for {game}")
                ok = False
            if game == games[-1]:                           # the receipt: a file changed by hand survives a re-export, the new one beside it
                lvl = Path(r["dir"]) / "game" / "levels" / f"{r['levels'][0]}.tscn"
                mine = lvl.read_text(encoding="utf-8") + "\n; mine\n"
                lvl.write_text(mine, encoding="utf-8")
                r2 = G.export(game, a.out if a.game else None, False, do_import=False)
                beside = lvl.with_name(lvl.stem + ".desk.tscn")
                if lvl.read_text(encoding="utf-8") != mine or not beside.exists() or r2.get("kept") != [lvl.relative_to(r["dir"]).as_posix()]:
                    print(f"  GDEXPORT FAIL: a re-export didn't keep a changed file ({r2.get('kept')})")
                    ok = False
                else:
                    print(f"  GDEXPORT re-export: kept {r2['kept'][0]}, the new one beside it")
                lvl.write_text(beside.read_text(encoding="utf-8"), encoding="utf-8")    # back to the desk's, for the checks after
                beside.unlink()
                G.write_manifest(Path(r["dir"]))
            for part in ("addons/horrorstudio_look/plugin.cfg", "addons/horrorstudio_look/look.gd", "HumanShaders/skin_shader.gdshader"):
                if not (Path(r["dir"]) / part).exists():            # the plugins (GodotPlugins/) copied in
                    print(f"  GDEXPORT FAIL: {part} missing from the export")
                    ok = False
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
        if a.play:
            code, out = run_godot(r["dir"], "res://addons/horrorstudio/tests/gdplay.gd", ["--fixed-fps", "60"], timeout=1200)
            print("\n".join("  " + ln for ln in out.splitlines()[-40:]))
            if code != 0 or "GDPLAY ok" not in out:
                ok = False
        if a.testroom:
            ref = ROOT / "Saved" / "Story" / game / "godot_reference"
            extra = ["--fixed-fps", "60", "--", f"--ref={ref}"] + ([f"--from={a.from_nid}"] if a.from_nid else [])
            code, out = run_godot(r["dir"], "res://addons/horrorstudio/tests/gdtestroom.gd", extra, timeout=1800)
            print("\n".join("  " + ln for ln in out.splitlines()[-60:]))
            if code != 0 or "GDTESTROOM ok" not in out:
                ok = False
    if a.check:
        print("GDEXPORT ok" if ok else "GDEXPORT FAIL")
        sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
