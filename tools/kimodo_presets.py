#!/usr/bin/env python3
"""The horror prompt presets (Content/Studio/kimodo_prompts.json, the demo's Preset dropdown), generated and measured.

    python tools/kimodo_presets.py run [id...]      3 takes of each with the local Kimodo (Saved/Kimodo/presets/<id>/)
    python tools/kimodo_presets.py check [--dir D]  measure the takes against each preset's `expect`, and write the
                                                    result into its `checked`: PRESETS ok when every preset has 2 of 3

What `expect` can ask (each a [low, high] range, metres, Kimodo's axes: z forward, y up):
forward (the hips' travel along z, end minus start), travel (on the floor, any way), hips_mean, hips_start and
hips_end (the hips' height over the whole take, its first or its last third of a second), hands_head_end (the
hands' mean distance from the head at the end: covering it), turn (degrees the body ends up turned from where it
started facing).
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRESETS = ROOT / "Content" / "Studio" / "kimodo_prompts.json"
OUT = ROOT / "Saved" / "Kimodo" / "presets"
TAKES = 3


def measures(npz):
    import numpy as np
    sm = json.loads((ROOT / "Content" / "Studio" / "soma77.json").read_text(encoding="utf-8"))
    ix = {n: i for i, n in enumerate(sm["names"])}
    j = np.load(npz)["posed_joints"]
    if j.ndim == 4:
        j = j[0]
    hips, head = j[:, ix["Hips"]], j[:, ix["Head"]]
    hands = (j[:, ix["LeftHand"]] + j[:, ix["RightHand"]]) / 2
    tail = max(1, len(j) // 15)
    left = j[:, ix["LeftLeg"]] - j[:, ix["RightLeg"]]                  # facing: square to the hips' left
    heading = np.degrees(np.arctan2(-left[:, 2], left[:, 0]))
    turn = (heading[-tail:].mean() - heading[:tail].mean() + 180) % 360 - 180
    return {
        "forward": float(hips[-1, 2] - hips[0, 2]),
        "travel": float(np.hypot(hips[-1, 0] - hips[0, 0], hips[-1, 2] - hips[0, 2])),
        "hips_mean": float(hips[:, 1].mean()),
        "hips_start": float(hips[:tail, 1].mean()),
        "hips_end": float(hips[-tail:, 1].mean()),
        "hands_head_end": float(np.linalg.norm(hands[-tail:] - head[-tail:], axis=1).mean()),
        "turn": float(abs(turn)),
    }


def run(ids):
    data = json.loads(PRESETS.read_text(encoding="utf-8"))
    for p in data["presets"]:
        if ids and p["id"] not in ids:
            continue
        d = OUT / p["id"]
        d.mkdir(parents=True, exist_ok=True)
        r = subprocess.run([sys.executable, str(ROOT / "tools" / "kimodo.py"), "gen", p["prompt"], "--duration", str(p["secs"]),
                            "--num_samples", str(TAKES), "--seed", "1", "--output", str(d / p["id"])],
                           capture_output=True, text=True)
        print(f"{p['id']}: {'ok' if r.returncode == 0 else 'FAILED ' + (r.stderr.strip().splitlines() or [''])[-1]}")


def check(folder):
    data = json.loads(PRESETS.read_text(encoding="utf-8"))
    bad = 0
    for p in data["presets"]:
        files = sorted((folder / p["id"]).glob("*.npz")) or sorted(folder.glob(f"{p['id']}/*.npz"))
        if not files:
            print(f"MISS  {p['id']}: no takes in {folder / p['id']}")
            bad += 1
            continue
        passed, notes = 0, []
        for f in files:
            m = measures(f)
            fails = [f"{k} {m[k]:.2f}" for k, (lo, hi) in p.get("expect", {}).items() if not lo <= m[k] <= hi]
            passed += not fails
            if fails:
                notes.append(", ".join(fails))
        ok = passed * 3 >= len(files) * 2
        bad += not ok
        p["checked"] = f"measured {passed} of {len(files)} takes as expected (seed 1)"
        print(f"{'ok  ' if ok else 'FAIL'}  {p['id']}: {passed}/{len(files)}" + (f"  ({'; '.join(notes)})" if notes else ""))
    PRESETS.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print("PRESETS ok" if not bad else f"PRESETS: {bad} presets below 2 of 3")
    return 1 if bad else 0


if __name__ == "__main__":
    args = sys.argv[1:]
    if args[:1] == ["run"]:
        run(args[1:])
    elif args[:1] == ["check"]:
        sys.exit(check(Path(args[args.index("--dir") + 1]) if "--dir" in args else OUT))
    else:
        print(__doc__)
