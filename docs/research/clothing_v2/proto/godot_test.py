"""The fit test's layers in Godot 4.7: a layered outfit's .glb (wear.py --glb) dropped into a scratch project with
godot/cover.gdshader, imported headless, then pictured under xvfb by godot/shots.gd: worn, the coat off, half way,
what the dissolve leaves out, the covers painted. Checks that what each band hides came through the import (the
vertex colours) and that the pictures differ where they should. Ends "GDLAYERS ok".

    python godot_test.py <outfit dir of wear.py --glb> <body> <out dir for the pictures> [scratch project dir]
"""
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROJECT = """config_version=5
[application]
config/name="clothing layers"
config/features=PackedStringArray("4.7", "Forward Plus")
[rendering]
anti_aliasing/quality/msaa_3d=2
"""


def main():
    src, body, out = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3]).resolve()
    proj = Path(sys.argv[4]) if len(sys.argv) > 4 else out / "_project"
    g = os.environ.get("GODOT") or shutil.which("godot") or shutil.which("godot-mono")
    if not g:
        print("GDLAYERS FAIL: no godot (tools/godot_setup.sh)"); return 1
    if proj.exists():
        shutil.rmtree(proj)
    proj.mkdir(parents=True); out.mkdir(parents=True, exist_ok=True)
    (proj / "project.godot").write_text(PROJECT)
    shutil.copy(src / f"{body}.glb", proj / "outfit.glb")
    for f in ("cover.gdshader", "shots.gd"):
        shutil.copy(HERE / "godot" / f, proj / f)
    env = dict(os.environ)
    if os.path.exists("/usr/share/vulkan/icd.d/lvp_icd.json"):
        env.setdefault("VK_ICD_FILENAMES", "/usr/share/vulkan/icd.d/lvp_icd.json")
    subprocess.run([g, "--headless", "--path", str(proj), "--import"], capture_output=True, text=True, timeout=900, env=env)
    cmd = [g, "--path", str(proj), "--rendering-driver", "vulkan", "-s", "res://shots.gd", "--", f"--out={out}"]
    if shutil.which("xvfb-run"):
        cmd = ["xvfb-run", "-a"] + cmd
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=1200, env=env)
    log = r.stdout + r.stderr
    lines = [l for l in log.splitlines() if l.startswith("GD")]
    print("\n".join(lines))
    if "GDLAYERS done" not in log:
        print("\n".join(l for l in log.splitlines() if "ALSA" not in l and "snd_" not in l)[-3000:]); print("GDLAYERS FAIL: the pictures weren't made"); return 1
    if "switching to OpenGL 3" in log or re.search(r"SHADER ERROR|Shader compilation failed", log):
        print(log[-3000:]); print("GDLAYERS FAIL: the shader or Vulkan"); return 1
    cov = {}
    for l in lines:
        m = re.match(r"GDCOVER (\S+) layer=(\S+) band=(\S+) area=(\S+) hidden=(\S+) by bottoms=(\S+) tops=(\S+) outerwear=(\S+) footwear=(\S+)", l)
        if m:
            cov[m.group(1)] = dict(layer=int(float(m.group(2))), band=m.group(3), hidden=float(m.group(5)), outer=float(m.group(8)))
    faults = []
    if not cov:
        faults.append("no mesh came through with its covers (vertex colours)")
    tops = [k for k, v in cov.items() if v["band"] == "top"]
    outers = [k for k, v in cov.items() if v["band"] == "outer"]
    if outers and tops and not any(cov[k]["outer"] > 0.2 for k in tops):
        faults.append("a top under outerwear isn't hidden by it")
    if any(cov[k]["hidden"] > 0.001 for k in outers):
        faults.append("the outermost layer is hidden by something")
    # the pictures: with the coat only made invisible there's less cloth drawn than with it taken off
    try:
        from PIL import Image
        import numpy as np
        im = {n: np.asarray(Image.open(out / f"{n}.png").convert("RGB"), np.float32) / 255 for n in ("worn", "coat_off", "half", "under", "covers")}
        bg = im["worn"][2, 2]
        drawn = {n: float((np.abs(a - bg).sum(2) > 0.06).mean()) for n, a in im.items()}
        print("GDPIX drawn: " + ", ".join(f"{n} {v:.4f}" for n, v in drawn.items()))
        if outers and not (drawn["under"] < drawn["half"] <= drawn["coat_off"] + 1e-4 and drawn["under"] < drawn["coat_off"] - 0.002):
            faults.append("taking the coat off didn't bring back what it hid")
        red = float(((im["covers"][..., 0] > im["covers"][..., 1] + 0.25) & (im["covers"][..., 0] > im["covers"][..., 2] + 0.25)).mean())
        print(f"GDPIX covers painted red: {red:.4f}")
        if outers and red < 0.03:
            faults.append("nothing is painted as hidden")
    except ImportError:
        print("(no PIL: the pictures weren't measured)")
    for f in faults:
        print("GDLAYERS FAIL:", f)
    if not faults:
        print("GDLAYERS ok ->", out)
    return 1 if faults else 0


if __name__ == "__main__":
    sys.exit(main())
