#!/usr/bin/env python3
"""The salon's reference from a video (docs/SALON.md, The reference): the frames picked, the hair keyed (a green screen,
CorridorKey's keyed frames, or MediaPipe on a person), the cameras found from the head itself (no COLMAP; --orbit for a
turntable or a MiniMax orbit), and the frames written in the head's space for the salon to lock to its view. Everything
runs on this machine, sealed off the network (unshare -rn), with MediaPipe's usage stats blocked. The name is historical:
this was the GaussianHair splat's pipeline, and the splat was removed (DECISIONS 2026-10-23).

    python tools/gshair.py setup [--cpu] [--home DIR]   the environment (uv, Python 3.12: OpenCV, scipy, MediaPipe; torch only for the check)
                                                        and MediaPipe's models (hair, person and face) under vendor/gshair/
    python tools/gshair.py run VIDEO --orbit --ref REF  a video straight to a salon reference (Content/Studio/Hair/References/REF)
    python tools/gshair.py frames|masks|poses --out DIR ...   one step (its --help)
    python tools/gshair.py reference --out CAPTURE --name REF    the reference from a capture (or --photos F [S] [B])
    python tools/gshair.py check [--keep] [--full]      GSHAIR ok: the pipeline on a synthetic head, on the CPU

The capture: the subject still, even light, the camera swept slowly round the head (or the head turning on a turntable),
front, both sides and as much of the back as you can.
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
    argv = [a.cmd] + rest
    if a.name and a.cmd == "reference":
        argv += ["--name", a.name]
    if a.help: argv.append("--help")
    sealed(home_dir(a), argv, a.unsealed)


if __name__ == "__main__":
    main()
