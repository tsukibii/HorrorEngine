"""A contact sheet of the game lit different ways (the lighting trial, GODOT_PLAN §4): each cell one lookshot.gd
picture (a time of day, a GI, SSAO/SSIL, the power, the tape), labelled, under xvfb on lavapipe (slow: minutes).

    python tools/godot/sheet.py --game TestRoom001 --node n_front --at -2,-4.5,270,5 --out sheet.png \\
        --cells "day|time=day" "night|time=night" "night sdfgi|time=night,gi=sdfgi" ...
"""
import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]


def godot_bin():
    for c in [os.environ.get("GODOT"), "godot", "godot-mono"]:
        if c and shutil.which(c):
            return shutil.which(c)
    return None


def shot(project, args, out, timeout=1200):
    env = dict(os.environ)
    env.setdefault("VK_ICD_FILENAMES", "/usr/share/vulkan/icd.d/lvp_icd.json")
    cmd = [godot_bin(), "--path", str(project), "--rendering-driver", "vulkan", "--fixed-fps", "60", "-s", "res://addons/horrorstudio/tests/lookshot.gd", "--"] + args + [f"--shot={out}"]
    if not os.environ.get("DISPLAY"):
        cmd = ["xvfb-run", "-a"] + cmd
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, env=env)
    lines = [ln for ln in (r.stdout + r.stderr).splitlines() if "LOOKSHOT" in ln or "VOXELGI" in ln or "SCRIPT ERROR" in ln]
    print("  " + " | ".join(lines[-3:]))
    return Path(out).exists()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--game", required=True)
    ap.add_argument("--node", default="")
    ap.add_argument("--at", default="")
    ap.add_argument("--out", required=True)
    ap.add_argument("--cells", nargs="+", required=True, help='"label|k=v,k=v"')
    ap.add_argument("--cols", type=int, default=3)
    ap.add_argument("--scale", type=float, default=0.5)
    a = ap.parse_args()
    project = ROOT / "Saved" / "Godot" / a.game
    if not (project / "project.godot").exists():
        subprocess.run([sys.executable, str(ROOT / "tools" / "godot_export.py"), "--game", a.game], check=True)
    tmp = ROOT / "Saved" / "Godot" / f"_sheet_{a.game}"
    tmp.mkdir(parents=True, exist_ok=True)
    pics = []
    for i, cell in enumerate(a.cells):
        label, _, kv = cell.partition("|")
        args = [f"--node={a.node}", f"--at={a.at}"] + [f"--{p.strip()}" for p in kv.split(",") if p.strip()]
        out = tmp / f"cell{i}.png"
        if out.exists():
            out.unlink()
        print(label)
        ok = shot(project, args, str(out))
        pics.append((label, out if ok else None))
    w, h = 1280, 720
    cw, ch = int(w * a.scale), int(h * a.scale)
    cols = min(a.cols, len(pics))
    rows = (len(pics) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cw, rows * (ch + 24)), (12, 12, 14))
    d = ImageDraw.Draw(sheet)
    for i, (label, p) in enumerate(pics):
        x, y = (i % cols) * cw, (i // cols) * (ch + 24)
        if p:
            sheet.paste(Image.open(p).convert("RGB").resize((cw, ch)), (x, y + 24))
        d.text((x + 8, y + 5), label if p else label + " (no picture)", fill=(230, 226, 220))
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    sheet.save(a.out)
    print(f"SHEET {a.out} {len(pics)} cells")
    return 0


if __name__ == "__main__":
    sys.exit(main())
