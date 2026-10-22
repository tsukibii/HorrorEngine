#!/usr/bin/env python3
"""GaussianHair for the Character Studio (docs/GSHAIR.md): hair reconstructed from a phone video of a head as strands
of cylindrical 3D Gaussians (Luo et al. 2024), our own implementation: a differentiable splatter in plain PyTorch, the
poses from the head itself (no COLMAP), strands grown through the oriented field (no pre-trained decoder), the result
riding guide chains with wig.js's physics on the Studio's splat page. Everything runs on this machine, sealed off the
network (unshare -rn), with MediaPipe's usage stats blocked.

    python tools/gshair.py setup [--cpu] [--home DIR]   the environment (uv, Python 3.12: torch, OpenCV, scipy, MediaPipe)
                                                        and MediaPipe's models (hair, person and face) under vendor/gshair/
    python tools/gshair.py run VIDEO --name NAME [--head mhr|NAME|head.obj] [--iters N] [--res PX] [--from STEP]
                                                        every step; the result in Content/Studio/People/NAME/gshair/
                                                        (--out DIR instead of --name for any folder)
    python tools/gshair.py frames|masks|poses|field|grow|refine|export --out DIR ...   one step (its --help)
    python tools/gshair.py check [--keep] [--full]      GSHAIR ok: the whole pipeline on a synthetic head, on the CPU
    python tools/gshair.py page [--name NAME]           the splat page: python tools/character/serve.py, then
                                                        http://127.0.0.1:8793/gshair.html?name=NAME

The capture (the paper's): the subject still, even light, a phone about a metre away swept slowly round the head,
front, both sides and as much of the back as you can; 4K 60 fps if you have it. 80 to 100 sharp frames are picked.
"""
import argparse
import os
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODELS = {
    "hair_segmenter.tflite": "https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float32/latest/hair_segmenter.tflite",
    "selfie_multiclass_256x256.tflite": "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite",
    "face_landmarker.task": "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
    "canonical_face_model.obj": "https://raw.githubusercontent.com/google-ai-edge/mediapipe/master/mediapipe/modules/face_geometry/data/canonical_face_model.obj",
}
DEPS = ["numpy", "opencv-python-headless", "scipy", "mediapipe"]


def home_dir(a=None):
    env = os.environ.get("GSHAIR_HOME")
    return Path(a.home) if a is not None and getattr(a, "home", None) else Path(env) if env else ROOT / "vendor" / "gshair"


def py_of(home):
    return home / "venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def cmd_setup(a):
    home = home_dir(a); home.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ, UV_CACHE_DIR=str(home / "uvcache"), UV_PYTHON_INSTALL_DIR=str(home / "uvpy"))
    subprocess.run(["uv", "python", "install", "3.12"], env=env, check=False)
    if not py_of(home).exists():
        subprocess.run(["uv", "venv", "-p", "3.12", str(home / "venv")], env=env, check=True)
    pip = ["uv", "pip", "install", "-p", str(py_of(home))]
    torch = ["torch", "--index-url", "https://download.pytorch.org/whl/cpu"] if a.cpu else ["torch"]
    subprocess.run(pip + torch, env=env, check=True)
    subprocess.run(pip + DEPS, env=env, check=True)
    for name, url in MODELS.items():
        if not (home / name).exists():
            print(f"fetching {name}")
            urllib.request.urlretrieve(url, home / name)
    print(f"GSHAIR setup ok: {home}")


def sandbox_ok():
    probe = "import socket,sys\ntry:\n socket.create_connection(('1.1.1.1',443),timeout=3); sys.exit(1)\nexcept OSError: sys.exit(0)"
    try:
        return subprocess.run(["unshare", "-rn", "--", sys.executable, "-c", probe], timeout=20).returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


def sealed(home, argv, unsealed=False):
    """cli.py in the environment, sealed off the network"""
    py = py_of(home)
    if not py.exists(): sys.exit(f"not set up ({py}): python tools/gshair.py setup")
    for name in MODELS:
        if not (home / name).exists(): sys.exit(f"no {name} in {home}: python tools/gshair.py setup")
    env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1", GSHAIR_HOME=str(home), DO_NOT_TRACK="1", HF_HUB_OFFLINE="1",
               https_proxy="http://127.0.0.1:9", HTTPS_PROXY="http://127.0.0.1:9", http_proxy="http://127.0.0.1:9", HTTP_PROXY="http://127.0.0.1:9", no_proxy="", NO_PROXY="")
    cmd = [str(py), "-I", str(ROOT / "tools" / "character" / "gshair" / "cli.py")] + argv
    if unsealed or os.name == "nt":
        print("(running with the network on: MediaPipe's stats are sent to a dead proxy instead)")
    elif sandbox_ok():
        cmd = ["unshare", "-rn", "--"] + cmd
    else:
        sys.exit("unshare -rn doesn't work here (unprivileged user namespaces off?): --unsealed runs with the network on")
    r = subprocess.run(cmd, env=env, cwd=ROOT)
    sys.exit(r.returncode)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0], add_help=False)
    ap.add_argument("cmd", nargs="?")
    ap.add_argument("--home"); ap.add_argument("--unsealed", action="store_true"); ap.add_argument("--cpu", action="store_true")
    ap.add_argument("--name"); ap.add_argument("-h", "--help", action="store_true")
    a, rest = ap.parse_known_args()
    if a.help and a.cmd is None or a.cmd is None:
        print(__doc__); return
    if a.cmd == "setup": return cmd_setup(a)
    if a.cmd == "page":
        print(f"python tools/character/serve.py, then http://127.0.0.1:8793/gshair.html" + (f"?name={a.name}" if a.name else "")); return
    argv = [a.cmd] + rest
    if a.name and a.cmd == "preset":
        argv += ["--name", a.name]
    elif a.name:
        out = ROOT / "Content" / "Studio" / "People" / a.name / "gshair"
        if "--out" not in rest: argv += ["--out", str(out)]
    if a.help: argv.append("--help")
    sealed(home_dir(a), argv, a.unsealed)


if __name__ == "__main__":
    main()
