#!/usr/bin/env python3
"""Every offline check for every game (or one: --game Pilot), one line each: story, level, shots (plan).
Ends `CHECKS ok` or `CHECKS FAILED`. Run before every commit that touches a story or tools/; the editor checks
(import, playthrough, shots with pictures) are listed in CLAUDE.md."""
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "Content" / "Python"))
from storykit import storylib as L  # noqa: E402

CHECKS = [["story_check.py"], ["level_check.py"], ["shots_sheet.py", "--plan"]]
STUDIO = [["pbr.py", "check"], ["sfx.py", "check"], ["face_capture.py", "check"], ["uv_templates.py", "check"], ["street.py", "check"], ["skin_detail.py", "check"], ["eye_patch.py", "check"], ["fabric_bake.py", "check"]]   # once, not per game: the PBR shelf, the sound shelf, the expression library, the texture templates, the streets, the skin's detail tiles, the grafted eyes, the made fabrics

game, _ = L.pick_game(sys.argv[1:])
bad = 0
for g in ([game] if game else L.games()):
    for c in CHECKS:
        r = subprocess.run([sys.executable, str(HERE / c[0]), "--game", g] + c[1:], capture_output=True, text=True,
                           encoding="utf-8")
        lines = [ln for ln in r.stdout.splitlines() if ln.strip()]
        last = lines[-1] if lines else r.stderr.strip()[-300:]
        print(f"{'ok  ' if r.returncode == 0 else 'FAIL'}  {g:<12} {c[0]:<16} {last}")
        if r.returncode:
            bad += 1
            for ln in lines[:-1]:
                if ln.startswith(("ERROR", "FAIL")):
                    print("      " + ln)
for c in STUDIO:
    r = subprocess.run([sys.executable, str(HERE / c[0])] + c[1:], capture_output=True, text=True, encoding="utf-8")
    lines = [ln for ln in r.stdout.splitlines() if ln.strip()]
    print(f"{'ok  ' if r.returncode == 0 else 'FAIL'}  {'(studio)':<12} {c[0]:<16} {lines[-1] if lines else r.stderr.strip()[-300:]}")
    if r.returncode:
        bad += 1
        for ln in lines[:-1]:
            print("      " + ln)
print("CHECKS ok" if not bad else f"CHECKS FAILED ({bad})")
sys.exit(1 if bad else 0)
