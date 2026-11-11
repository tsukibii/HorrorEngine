"""GDLIBRARY: a Character Studio export wearing library garments, in Godot (DECISIONS 2026-11-11, the last: "if skin
clips through in godot that it ... hides so the clothing is visible instead, clothing should move along the body though
for walk animations"). The export (the Studio's Export for Godot: LIBRARYPAGE's `_librarytest`, or --glb / --person) is
read by Godot 4.7 headless in a project of its own: its skin and its clothes skinned to one skeleton; the body put
through a stride, sitting, a bend forward, arms raised and a twist; in each pose the clothes have moved with the bones
and the skin the file still carries is looked for through them (tools/godot/library_test.gd: a ray from just under
every skin point 8 mm into the body, cast at the clothes as they are in that pose). Hardly any may stand through.
--pictures: each pose from the front and the side, under xvfb, into a sheet. Ends "GDLIBRARY ok".
    python tools/godot/library_check.py [--glb FILE | --person NAME] [--pictures] [--keep DIR]
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PEOPLE = ROOT / "Content" / "Studio" / "People"
OUT = ROOT / "Saved" / "Godot" / "_library"
KEEP = ROOT / "Saved" / "Story" / "_look" / "godot_library"
PROJECT = 'config_version=5\n[application]\nconfig/name="HorrorStudio library garments check"\nconfig/features=PackedStringArray("4.7", "Forward Plus")\n'
MOST = 0.004                                   # the share of the skin's points that may stand through cloth in any pose


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--glb", default=""); ap.add_argument("--person", default="_librarytest"); ap.add_argument("--pictures", action="store_true"); ap.add_argument("--keep", default=str(KEEP))
    a = ap.parse_args()
    g = next((shutil.which(c) for c in [os.environ.get("GODOT"), "godot", "godot-mono"] if c and shutil.which(c)), None)
    if not g:
        print("GDLIBRARY FAIL: no godot (tools/godot_setup.sh)"); return 1
    glb = Path(a.glb) if a.glb else PEOPLE / a.person / "export" / f"{a.person}.glb"
    if not glb.exists():
        print(f"GDLIBRARY FAIL: no export at {glb} (node tools/character/librarypagetest.mjs --export makes one)"); return 1
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    (OUT / "project.godot").write_text(PROJECT, encoding="utf-8")
    shutil.copy(ROOT / "tools" / "godot" / "library_test.gd", OUT / "library_test.gd")
    keep = Path(a.keep); keep.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ)
    if os.path.exists("/usr/share/vulkan/icd.d/lvp_icd.json"):
        env.setdefault("VK_ICD_FILENAMES", "/usr/share/vulkan/icd.d/lvp_icd.json")
    cmd = [g, "--path", str(OUT)] + (["--rendering-driver", "vulkan"] if a.pictures else ["--headless"]) + ["-s", "res://library_test.gd", "--", f"--glb={glb}"] + ([f"--out={keep}"] if a.pictures else [])
    if a.pictures and shutil.which("xvfb-run"):
        cmd = ["xvfb-run", "-a"] + cmd
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=3000, env=env)
    text = r.stdout + r.stderr
    line = next((l for l in text.splitlines() if l.startswith("GDLIBRARY {")), None)
    bad = [l for l in text.splitlines() if "SCRIPT ERROR" in l or "Parse Error" in l]
    if bad or line is None:
        print(text[-2500:]); print("GDLIBRARY FAIL: the script didn't finish"); return 1
    rep = json.loads(line[len("GDLIBRARY "):])
    faults = []
    if not (rep["skeleton"] and rep["skin"] and rep["clothes"]):
        faults.append(f"the export has no skeleton, skin or library clothes skinned to it: {rep}")
    for name, p in rep.get("poses", {}).items():
        share = p["through"] / max(p["skin_points"], 1)
        print(f"  {name:8s} skin through the clothes at {p['through']:4d} of {p['skin_points']} points ({100 * share:.2f}%), the deepest {p['deepest_mm']} mm" + (f"; the clothes moved up to {p['clothes_moved_m'] * 100:.0f} cm with the bones" if name != "rest" else ""))
        if share > MOST:
            faults.append(f"{name}: skin stands through the clothes at {p['through']} points ({100 * share:.2f}%)")
        if name in ("stride", "sit") and not p["clothes_moved_m"] > 0.03:
            faults.append(f"{name}: the clothes didn't move with the bones ({p['clothes_moved_m']} m)")
    if a.pictures:
        try:
            from PIL import Image
            names = [n for n in rep["poses"]]
            ims = [[Image.open(keep / f"{n}_{v}.png").convert("RGB") for n in names] for v in ("front", "side")]
            w, h = ims[0][0].size
            sheet = Image.new("RGB", (w * len(names), h * 2), (20, 20, 24))
            for r_, row in enumerate(ims):
                for c, im in enumerate(row):
                    sheet.paste(im, (c * w, r_ * h))
            sheet.save(keep / "poses.jpg", quality=88); print(f"  {keep / 'poses.jpg'}")
        except Exception as e:                                       # (no Pillow: the pictures stay as they are)
            print(f"  (no sheet: {e})")
    for f in faults:
        print("GDLIBRARY FAIL:", f)
    if not faults:
        print(f"GDLIBRARY ok ({', '.join(rep['clothes'])}: skinned with the skin, {len(rep['poses'])} poses, no more than {100 * MOST:.1f}% of the skin through the clothes in any)")
    return 1 if faults else 0


if __name__ == "__main__":
    sys.exit(main())
