"""GDUI: the HUD's own rules in Godot (ui-v3, DECISIONS 2026-11-08): the Pilot exported and started headless and the HUD
driven from the runtime (tests/gdui.gd): the guide marker's strength by distance and by the walls between (faint far off
and in the next room, clearer the nearer, its name near, a pointer toward it after a moment out of view, the player's
setting, gone once its task is), and the other pieces as they're built. With --pictures the HUD's pictures too, under
xvfb: the marker in the Pilot's rooms at 1080p (tests/uishot.gd from a plan) into Saved/Story/_look/godot_ui/.

    python tools/godot/ui_check.py [--pictures] [--keep DIR]

Ends "GDUI ok". Godot: $GODOT, else godot (tools/godot_setup.sh on a cloud session).
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
import godot_export as GE  # noqa: E402

G = GE.G
KEEP = ROOT / "Saved" / "Story" / "_look" / "godot_ui"

# the marker in the Pilot, seen as the player sees it: clear at range, near with its name, through two walls, turned away
PLAN = [
    {"clear": 1, "time": "night", "setting": {"scale": 1, "guide": 1}, "at": [2, 1.0, 90, 0],
     "todo": [{"todo": "find_doll", "text": "Find the doll", "guide": "doll_on_table"}], "wait": 90, "shot": "marker_hall.png"},
    {"at": [2, 3.2, 90, 0], "wait": 60, "shot": "marker_near.png"},
    {"at": [6, 3.0, 135, 0], "wait": 60, "shot": "marker_walls.png"},
    {"at": [2, 3.2, 270, 0], "wait": 150, "shot": "marker_behind.png"},
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pictures", action="store_true", help="the HUD's pictures at 1080p under xvfb (a few minutes on lavapipe)")
    ap.add_argument("--keep", help="where to keep the pictures (default Saved/Story/_look/godot_ui)")
    a = ap.parse_args()
    r = G.export("Pilot", G.CHECK_OUT / "Pilot", False)
    code, out = GE.run_godot(r["dir"], "res://addons/horrorstudio/tests/gdui.gd", ["--fixed-fps", "60"], timeout=1200)
    print("\n".join("  " + ln for ln in out.splitlines()[-30:]))
    ok = code == 0 and "GDUI ok" in out
    if ok and a.pictures:
        keep = Path(a.keep) if a.keep else KEEP
        keep.mkdir(parents=True, exist_ok=True)
        plan = keep / "plan.json"
        plan.write_text(json.dumps(PLAN))
        code, out = GE.run_godot(r["dir"], "res://addons/horrorstudio/tests/uishot.gd", ["--fixed-fps", "30", "--resolution", "1920x1080", "--", f"--plan={plan}", f"--out={keep}"], xvfb=True, timeout=1500)
        shots = [ln for ln in out.splitlines() if ln.startswith("UISHOT shot")]
        print("\n".join("  " + ln for ln in shots) or "  (no pictures) " + out[-400:])
        if code != 0 or len(shots) != len([s for s in PLAN if "shot" in s]):
            ok = False
    print("GDUI ok" if ok else "GDUI FAIL")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
