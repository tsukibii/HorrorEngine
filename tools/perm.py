"""Perm (Yale and Adobe, ICLR 2025; MIT code): a parametric model of 3D hair, with 343 artist hairstyles fitted to it.
The Character Studio's hair library: browse the hairstyles, blend them, match them to a front photo (hair_match.py),
and the result goes through hair_fit.py and hair_batch.py like any strands. Everything stays on this machine
(vendor/perm/, git-ignored) and Perm runs sealed off the network (unshare -rn): its checkpoints are pickles that run
code as they load, so they come only from the authors' links. The hairstyles derive from USC-HairSalon (research use):
free games only (docs/DECISIONS.md 2026-10-22).

    python tools/perm.py setup [--home DIR]      Perm (pinned) and its uv environment (Python 3.10, torch 2.1); the
                                                 checkpoints, the 343 fitted hairstyles and the AVATAR NEO head from
                                                 the authors' links (or from files you downloaded into
                                                 vendor/perm/downloads/ when a link refuses a script)
    python tools/perm.py library                 every fitted hairstyle as preview strands (vendor/perm/library/),
                                                 then their outlines and thumbnails (hair_match.py)
    python tools/perm.py blend --weights '{"strands00123": 0.7, "strands00456": 0.3}' --out DIR [--roots 30k]
                                                 the hairstyles mixed by weight (their parameters, not their strands),
                                                 DIR/strands.npz on Perm's head (vendor/perm/head.obj)
    python tools/perm.py check                   PERM ok: the sandbox has no network; what's set up

Perm's own CUDA operations compile with nvcc when it's there; without it StyleGAN's code falls back to plain PyTorch
(slower, same result). A GPU is used when torch sees one, otherwise the CPU.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = "https://github.com/c-he/perm.git"
PIN = "5885a2ab66f128d7f0acb88c4518b21b7b4ad9cb"
LINKS = {   # the authors' links (README), each a direct download with download=1
    "models": "https://yaleedu-my.sharepoint.com/:u:/g/personal/chengan_he_yale_edu/ESQ2YM2wd39Fg2PNrUQRV_cBg61LQWPFp7xhuq3knOkNtw?e=33h7pF",
    "fitted": "https://yaleedu-my.sharepoint.com/:u:/g/personal/chengan_he_yale_edu/ESmIHlb9IN5NlyRsQnl94mQBmiHEI7gR1tgpFPsEMJomqQ?e=GcrDRi",
    "head": "https://www.avatarneo.com/PinscreenGenericHeadModel.obj",
}
SEG_URL = "https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float32/latest/hair_segmenter.tflite"
TORCH = ["torch==2.1.2", "--index-url", "https://download.pytorch.org/whl/cu121"]
DEPS = ["numpy<2", "trimesh", "pillow", "click", "scipy", "ninja", "tqdm", "requests"]


def home_dir(a=None):
    return Path(a.home) if a is not None and getattr(a, "home", None) else ROOT / "vendor" / "perm"


def py_of(home):
    return home / "venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def unpack(archive, dest):
    """a tar or zip into dest, refusing any path that would land outside it"""
    dest.mkdir(parents=True, exist_ok=True)
    root = dest.resolve()
    if zipfile.is_zipfile(archive):
        with zipfile.ZipFile(archive) as z:
            for m in z.namelist():
                if not (dest / m).resolve().is_relative_to(root): sys.exit(f"{archive}: {m} points outside: refused")
            z.extractall(dest)
    elif tarfile.is_tarfile(archive):
        with tarfile.open(archive) as t:
            for m in t.getmembers():
                if m.issym() or m.islnk() or not (dest / m.name).resolve().is_relative_to(root): sys.exit(f"{archive}: {m.name}: refused")
            t.extractall(dest)
    else:
        return False
    return True


def fetch(name, url, downloads):
    """the file from its link (download=1), or one already in downloads/ whose name starts with the key"""
    have = sorted(p for p in downloads.glob(f"{name}*") if p.is_file())
    if have: return have[0]
    out = downloads / (name + (".obj" if name == "head" else ".bin"))
    tries = [url]
    m = re.match(r"https://([^/]+)/:\w:/g/personal/([^/]+)/([^?]+)", url)
    if m:                                                  # a SharePoint share: its download page, then the link with download=1
        tries = [f"https://{m[1]}/personal/{m[2]}/_layouts/15/download.aspx?share={m[3]}", url + "&download=1"]
    print(f"fetching {name} from the authors' link")
    for direct in tries:
        try:
            req = urllib.request.Request(direct, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=60) as r, open(out, "wb") as f:
                shutil.copyfileobj(r, f)
            if b"<html" in out.read_bytes()[:2000].lower():
                out.unlink(); raise OSError("a web page came back, not the file")
            return out
        except OSError as e:
            print(f"  couldn't: {e}")
    return None


def cmd_setup(a):
    home = home_dir(a); home.mkdir(parents=True, exist_ok=True)
    src = home / "src"
    if not src.exists():
        subprocess.run(["git", "clone", REPO, str(src)], check=True)
    subprocess.run(["git", "-C", str(src), "fetch", "--depth", "1", "origin", PIN], check=False)
    subprocess.run(["git", "-C", str(src), "checkout", "-q", PIN], check=True)
    env = dict(os.environ, UV_CACHE_DIR=str(home / "uvcache"), UV_PYTHON_INSTALL_DIR=str(home / "uvpy"))
    subprocess.run(["uv", "python", "install", "--no-bin", "3.10"], env=env, check=False)   # no ~/.local/bin shortcut
    if not py_of(home).exists():
        subprocess.run(["uv", "venv", "-p", "3.10", str(home / "venv")], env=env, check=True)
    pip = ["uv", "pip", "install", "-p", str(py_of(home))]
    subprocess.run(pip + TORCH, env=env, check=True)
    subprocess.run(pip + DEPS, env=env, check=True)
    seg = home / "hair_segmenter.tflite"                   # MediaPipe's hair segmenter (Apache-2.0) for the photo match
    if not seg.exists():
        print("fetching MediaPipe's hair segmenter"); urllib.request.urlretrieve(SEG_URL, seg)
    downloads = home / "downloads"; downloads.mkdir(exist_ok=True)
    missing = []
    for name, url in LINKS.items():
        f = fetch(name, url, downloads)
        if not f: missing.append((name, url)); continue
        if name == "head":
            shutil.copy(f, home / "head.obj")
        else:
            target = home / name
            if not (target.exists() and any(target.iterdir())) and not unpack(f, target):
                missing.append((name, url)); print(f"  {f.name} isn't a zip or tar")
    if missing:
        print("\nSome links refused a script. Download these in your browser into " + str(downloads) + ", named as shown, then run setup again:")
        for name, url in missing: print(f"  {name}*  <-  {url}")
        return
    print(f"Perm at {src} (pinned {PIN[:7]}); models, fitted hairstyles and the head in {home}")
    print("next: python tools/perm.py library")


def sandbox_ok():
    probe = "import socket,sys\ntry:\n socket.create_connection(('1.1.1.1',443),timeout=3); sys.exit(1)\nexcept OSError: sys.exit(0)"
    try:
        return subprocess.run(["unshare", "-rn", "--", sys.executable, "-c", probe], timeout=20).returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


def find(home, pattern):
    return sorted(home.rglob(pattern))


def run(home, op, *extra):
    """tools/perm_run.py in Perm's environment, sealed off the network, from its source folder"""
    if not py_of(home).exists(): sys.exit("Perm isn't set up: python tools/perm.py setup")
    if not sandbox_ok(): sys.exit("unshare -rn doesn't work here (unprivileged user namespaces off?): Perm won't run with the network on")
    models = sorted({p.parent for p in find(home / "models", "*.pkl")})
    if not models: sys.exit(f"no checkpoints in {home / 'models'}: python tools/perm.py setup")
    if not (home / "head.obj").exists(): sys.exit(f"no head at {home / 'head.obj'}: python tools/perm.py setup")
    cmd = ["unshare", "-rn", "--", str(py_of(home)), str(ROOT / "tools" / "perm_run.py"), op,
           "--models", str(models[0]), "--head", str(home / "head.obj")] + [str(x) for x in extra]
    r = subprocess.run(cmd, cwd=home / "src" / "src", env=dict(os.environ, PYTHONDONTWRITEBYTECODE="1"))
    if r.returncode: sys.exit(f"Perm's {op} failed (above)")


def cmd_library(a):
    home = home_dir(a)
    fitted = find(home / "fitted", "*.npz")
    if not fitted: sys.exit(f"no fitted hairstyles in {home / 'fitted'}: python tools/perm.py setup")
    run(home, "library", "--params", fitted[0].parent, "--out", home / "library",
        "--roots", home / "src" / "data" / "roots" / "rootPositions_10k.txt", "--preview", a.preview)
    face = Path(os.environ.get("FACE_MESH_HOME", ROOT / "vendor" / "face_mesh"))
    py = face / "venv" / "bin" / "python"
    if not py.exists(): sys.exit("the outlines need face_mesh.py's environment: python tools/face_mesh.py setup")
    r = subprocess.run([str(py), str(ROOT / "tools" / "character" / "hair_match.py"), "index", "--library", str(home / "library"),
                        "--head", str(home / "head.obj")])
    if r.returncode: sys.exit("the outlines failed (above)")
    print("PERM ok")


def cmd_blend(a):
    home = home_dir(a)
    fitted = find(home / "fitted", "*.npz")
    if not fitted: sys.exit(f"no fitted hairstyles in {home / 'fitted'}: python tools/perm.py setup")
    out = Path(a.out).resolve(); out.mkdir(parents=True, exist_ok=True)
    roots = home / "src" / "data" / "roots" / f"rootPositions_{a.roots}.txt"
    run(home, "blend", "--params", fitted[0].parent, "--weights", a.weights, "--out", out / "strands.npz", "--roots", roots,
        "--seed", a.seed, "--vary", a.vary)
    (out / "perm.json").write_text(json.dumps({
        "weights": json.loads(a.weights), "made_by": f"Perm {PIN[:7]} (Yale, Adobe)", "head": str(home / "head.obj"),
        "licence": "Perm's code is MIT; the hairstyles derive from USC-HairSalon (research use): free games only (docs/DECISIONS.md 2026-10-22)"},
        indent=1), encoding="utf-8")
    print(f"strands in {out / 'strands.npz'}")
    print("PERM ok")


def cmd_check(a):
    home = home_dir(a)
    if not sandbox_ok(): sys.exit("PERM FAIL: a process under unshare -rn could reach the network (or unshare is missing)")
    print("  ok  the sandbox: no connection gets out of unshare -rn")
    for what, ok in (("Perm's environment", py_of(home).exists()), ("the checkpoints", bool(find(home / "models", "*.pkl"))),
                     ("the fitted hairstyles", bool(find(home / "fitted", "*.npz"))), ("the head", (home / "head.obj").exists()),
                     ("the library", (home / "library" / "index.json").exists())):
        print(f"  {'ok' if ok else '--'}  {what}")
    print("PERM ok")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("setup", "library", "blend", "check"):
        p = sub.add_parser(name); p.add_argument("--home")
        if name == "library": p.add_argument("--preview", type=int, default=3000, help="strands kept per hairstyle for its preview and outline")
        if name == "blend":
            p.add_argument("--weights", required=True, help='{"hairstyle": weight, ...}'); p.add_argument("--out", required=True)
            p.add_argument("--roots", default="30k", choices=["10k", "20k", "30k", "40k", "50k", "100k"])
            p.add_argument("--seed", type=int, default=0); p.add_argument("--vary", type=float, default=0.0, help="a little randomness in the shape")
    a = ap.parse_args()
    {"setup": cmd_setup, "library": cmd_library, "blend": cmd_blend, "check": cmd_check}[a.cmd](a)


if __name__ == "__main__":
    main()
