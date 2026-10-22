"""DiffLocks (Meshcapade and the Max Planck Institute, CVPR 2025): a picture of a person to about 100,000 hair strands.
Its licence is non-commercial (the games are free: docs/DECISIONS.md 2026-10-22); its code, checkpoints and output stay
on this machine (vendor/difflocks/ and Content/Studio/People/, git-ignored), and it runs with no network at all.

    python tools/difflocks.py setup [--home DIR]     its code (pinned), a uv environment (Python 3.11, torch 2.5 with
                                                     CUDA 12.4, NATTEN with its CUDA kernels: NATTEN's wheel or built
                                                     with nvcc, --natten-expired-cert to take the wheel from its site
                                                     despite the expired certificate; FlashAttention-2's prebuilt wheel
                                                     from its GitHub release) and DINOv2's code and weights
                                                     for torch.hub, under vendor/difflocks/. Then the checkpoints: you
                                                     register at difflocks.is.tue.mpg.de and run its own script
                                                     (cd vendor/difflocks/src && ./download_checkpoints.sh): your account.
    python tools/difflocks.py audit                  every line in its code that could reach the network, and what
                                                     happens to each (known, or new: read it)
    python tools/difflocks.py run <picture> --out DIR [--blender PATH] [--alembic]
                                                     inside a network namespace of its own with no interfaces
                                                     (unshare -rn): nothing it or MediaPipe does can leave the machine.
                                                     DIR gets strands.npz (positions: strands x 256 points x 3, metres,
                                                     SMPL-X's head frame: tools/character/hair_fit.py moves it onto an
                                                     MHR character), hair.json (melanin, redness, root darkness),
                                                     difflocks.json (where it came from, the licence)
    python tools/difflocks.py check                  DIFFLOCKS ok: the sandbox has no network; the audit finds nothing new

What the audit knows (fcc7374, 2025-10-31): inference loads DINOv2 through torch.hub (from GitHub, and its weights
from dl.fbaipublicfiles.com): setup fetches both once and the run loads them from disk (tools/difflocks_run.py
points torch.hub at the local copy); MediaPipe's native library posts usage stats to Google on every run (the face
tool found it: face_mesh.no_metrics) and the namespace stops it; wandb and tensorboard are only in the training scripts,
which we don't run; the Blender export is a local subprocess. Setup itself downloads (pip, git, the DINOv2 weights);
nothing runs from the network after it.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = "https://github.com/Meshcapade/difflocks.git"
PIN = "fcc73747dc60320c30228b6711000a53fc0c9d84"
DINO_REPO = "https://github.com/facebookresearch/dinov2.git"
DINO_WEIGHTS = "https://dl.fbaipublicfiles.com/dinov2/dinov2_vitl14/dinov2_vitl14_reg4_pretrain.pth"
TORCH = ["torch==2.5.0", "torchvision==0.20.0", "--index-url", "https://download.pytorch.org/whl/cu124"]
NATTEN_WHEELS = "https://shi-labs.com/natten/wheels/"   # NATTEN's own builds (CUDA); its certificate expired 2025-12-03
FLASH_WHEEL = ("https://github.com/Dao-AILab/flash-attention/releases/download/v2.7.0.post2/"
               "flash_attn-2.7.0.post2+cu12torch2.5cxx11abiFALSE-cp311-cp311-linux_x86_64.whl")   # prebuilt: no nvcc needed
NET = re.compile(r"requests\.|urllib|urlopen|http\.client|socket\.|wandb|hf_hub|huggingface_hub|torch\.hub|"
                 r"download|telemetry|analytics|sentry|SummaryWriter|mlflow|comet_ml|clearml|subprocess|os\.system|"
                 r"smtplib|ftplib|https?://")
# what the audit has read and decided: (file, a piece of the line) -> what happens
KNOWN = [
    ("inference/img2hair.py", "torch.hub.load('facebookresearch/dinov2'", "DINOv2 from torch.hub: loaded from vendor/difflocks/hub by difflocks_run.py, weights from its cache; no network in the namespace anyway"),
    ("data_processing/create_latents.py", "torch.hub.load('facebookresearch/dinov2'", "dataset processing, not run"),
    ("inference_difflocks.py", "subprocess", "runs Blender (local) for the .blend/Alembic export"),
    ("data_processing/uncompress_data.py", "subprocess", "unzips the dataset, not run"),
    ("callbacks/wandb_callback.py", "wandb", "training only (a cloud logger), not run, not installed"),
    ("callbacks/tensorboard_callback.py", "SummaryWriter", "training only, writes local files"),
    ("callbacks/callback_utils.py", "", "training only"),
    ("train_", "", "training scripts, not run"),
    ("data_loader/dataloader.py", "download", "a comment about a partly downloaded dataset"),
    ("", "https://github.com", "a URL in a comment (credit for borrowed code)"),
    ("", "https://arxiv.org", "a URL in a comment"),
    ("", "https://www.khronos.org", "a URL in a comment"),
    ("", "https://www.reddit.com", "a URL in a comment"),
    ("download_", "", "the dataset and checkpoint scripts: you run them yourself, with your account"),
    ("inference/img2hair.py", "mediapipe", "MediaPipe's face landmarker (a local model file); its usage stats can't leave the namespace"),
    ("k_diffusion/utils.py", "", "k-diffusion's download_file: defined, never called"),
    ("dockerfile/", "", "Docker setup scripts, not used"),
    ("utils/general_util.py", "https://docs.scipy.org", "a URL in a docstring"),
    ("utils/general_util.py", "http://arxiv.org", "a URL in a docstring"),
]
COMMENT = "a comment"


def home_dir(a=None):
    return Path(a.home) if a is not None and getattr(a, "home", None) else ROOT / "vendor" / "difflocks"


def py_of(home):
    return home / "venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def natten_cuda(home):
    """NATTEN is in and has its CUDA kernels (one built without nvcc has none, and DiffLocks needs them)"""
    r = subprocess.run([str(py_of(home)), "-c", "import natten,sys; sys.exit(0 if natten.has_cuda() else 1)"], capture_output=True)
    return r.returncode == 0


def natten(home, env, pip, a):
    """NATTEN with CUDA: NATTEN's own wheel, or built here with nvcc for this GPU alone (minutes, not an hour)"""
    if natten_cuda(home): return
    subprocess.run(["uv", "pip", "uninstall", "-p", str(py_of(home)), "natten"], env=env)
    insecure = ["--allow-insecure-host", "shi-labs.com"] if a.natten_expired_cert else []
    if subprocess.run(pip + ["natten==0.17.3+torch250cu124", "-f", NATTEN_WHEELS] + insecure, env=env).returncode == 0 and natten_cuda(home):
        return
    nvcc = shutil.which("nvcc") or next((str(p) for p in (Path(os.environ.get("CUDA_HOME", "/opt/cuda")) / "bin" / "nvcc",) if p.exists()), None)
    if nvcc:
        cuda_home = str(Path(nvcc).resolve().parents[1])
        ver = subprocess.run([nvcc, "--version"], capture_output=True, text=True).stdout
        if "release 12." not in ver:
            sys.exit(f"nvcc at {nvcc} isn't CUDA 12 (torch 2.5 here is built for 12.4; the build needs the same major):\n{ver[-200:]}")
        arch = subprocess.run(["nvidia-smi", "--query-gpu=compute_cap", "--format=csv,noheader"], capture_output=True, text=True).stdout.split()
        benv = dict(env, CUDA_HOME=cuda_home, NATTEN_CUDA_ARCH=(arch[0] if arch else "8.6"), NATTEN_N_WORKERS=str(max(2, (os.cpu_count() or 4) // 2)))
        print(f"building NATTEN with CUDA for compute {benv['NATTEN_CUDA_ARCH']} (CUDA at {cuda_home}; about 10 to 20 minutes)")
        subprocess.run(pip + ["natten==0.17.3", "--no-build-isolation", "--no-cache", "--reinstall"], env=benv, check=True)
        if natten_cuda(home): return
        sys.exit("NATTEN built, but without its CUDA kernels (above)")
    sys.exit("""NATTEN needs its CUDA kernels and there are two ways to get them:
  1. NATTEN's own prebuilt wheel. Its site's certificate expired on 2025-12-03, so the download can't be verified
     the usual way (still encrypted, but the certificate is out of date). If you accept that:
         python tools/difflocks.py setup --natten-expired-cert
  2. Build it here: install the CUDA 12 toolkit (nvcc; CUDA 13 won't do: torch 2.5 here is CUDA 12.4), e.g.
         pacman -Si cuda | grep Version      (12.x: sudo pacman -S cuda; otherwise a CUDA 12 toolkit from NVIDIA)
     then run setup again (it finds /opt/cuda/bin/nvcc, or set CUDA_HOME).""")


def cmd_setup(a):
    home = home_dir(a); home.mkdir(parents=True, exist_ok=True)
    src = home / "src"
    if not src.exists():
        subprocess.run(["git", "clone", REPO, str(src)], check=True)
    subprocess.run(["git", "-C", str(src), "fetch", "--depth", "1", "origin", PIN], check=False)
    subprocess.run(["git", "-C", str(src), "checkout", "-q", PIN], check=True)
    env = dict(os.environ, UV_CACHE_DIR=str(home / "uvcache"), UV_PYTHON_INSTALL_DIR=str(home / "uvpy"))
    subprocess.run(["uv", "python", "install", "3.11"], env=env, check=False)
    if not py_of(home).exists():
        subprocess.run(["uv", "venv", "-p", "3.11", str(home / "venv")], env=env, check=True)
    pip = ["uv", "pip", "install", "-p", str(py_of(home))]
    subprocess.run(pip + TORCH, env=env, check=True)
    reqs = [l.strip() for l in (src / "requirements.txt").read_text().splitlines()
            if l.strip() and not l.startswith(("torch==", "torchvision==", "setuptools", "wheel"))]
    subprocess.run(pip + reqs + ["setuptools", "wheel", "ninja", "packaging"], env=env, check=True)
    natten(home, env, pip, a)
    if subprocess.run(pip + [FLASH_WHEEL], env=env).returncode:
        sys.exit("FlashAttention-2's prebuilt wheel didn't install (above)")
    hub = home / "hub"
    if not (hub / "dinov2").exists():
        subprocess.run(["git", "clone", "--depth", "1", DINO_REPO, str(hub / "dinov2")], check=True)
    ck = home / "torch_home" / "hub" / "checkpoints"; ck.mkdir(parents=True, exist_ok=True)
    if not (ck / Path(DINO_WEIGHTS).name).exists():
        print("fetching DINOv2's weights (1.2 GB, Apache-2.0)"); urllib.request.urlretrieve(DINO_WEIGHTS, ck / Path(DINO_WEIGHTS).name)
    have = (src / "checkpoints" / "difflocks_diffusion").exists()
    print(f"DiffLocks at {src} (pinned {PIN[:7]}), its environment at {home / 'venv'}")
    print("checkpoints: " + ("in place" if have else f"not yet: register at difflocks.is.tue.mpg.de, then  cd {src} && ./download_checkpoints.sh"))


def audit_hits(src):
    hits = []
    for f in sorted(src.rglob("*")):
        if f.suffix not in (".py", ".sh") or ".git" in f.parts: continue
        rel = f.relative_to(src).as_posix()
        for n, line in enumerate(f.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
            if not NET.search(line): continue
            why = COMMENT if line.lstrip().startswith("#") and rel.endswith(".py") else \
                next((w for path, piece, w in KNOWN if path in rel and piece in line), None)
            hits.append((rel, n, line.strip()[:110], why))
    return hits


def cmd_audit(a):
    src = home_dir(a) / "src"
    if not src.exists(): sys.exit(f"no DiffLocks at {src}: python tools/difflocks.py setup")
    hits = audit_hits(src)
    new = [h for h in hits if h[3] is None]
    for rel, n, line, why in hits:
        print(f"{'  ' if why else '! '}{rel}:{n}: {line}\n      {why or 'NEW: read it before running'}")
    print(f"\n{len(hits)} lines could reach out; {len(new)} new" + (" (read them)" if new else ""))
    return new


def sandbox_ok():
    """True when a command started under unshare -rn can't open a connection"""
    probe = "import socket,sys\ntry:\n socket.create_connection(('1.1.1.1',443),timeout=3); sys.exit(1)\nexcept OSError: sys.exit(0)"
    try:
        return subprocess.run(["unshare", "-rn", "--", sys.executable, "-c", probe], timeout=20).returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


def cmd_run(a):
    home = home_dir(a); src = home / "src"
    if not py_of(home).exists(): sys.exit("DiffLocks isn't set up: python tools/difflocks.py setup")
    if not (src / "checkpoints" / "difflocks_diffusion").exists():
        sys.exit(f"no checkpoints yet: register at difflocks.is.tue.mpg.de, then  cd {src} && ./download_checkpoints.sh")
    if not sandbox_ok(): sys.exit("unshare -rn doesn't work here (unprivileged user namespaces off?): DiffLocks won't run with the network on")
    out = Path(a.out).resolve(); out.mkdir(parents=True, exist_ok=True)
    work = out / "_difflocks"; work.mkdir(exist_ok=True)
    env = dict(os.environ, TORCH_HOME=str(home / "torch_home"), DIFFLOCKS_HUB=str(home / "hub"), HF_HUB_OFFLINE="1",
               TRANSFORMERS_OFFLINE="1", WANDB_MODE="disabled", NO_ALBUMENTATIONS_UPDATE="1")
    cmd = ["unshare", "-rn", "--", str(py_of(home)), str(ROOT / "tools" / "difflocks_run.py"),
           "--img_path", str(Path(a.picture).resolve()), "--out_path", str(work)]
    if a.blender: cmd += ["--blender_path", a.blender] + (["--export_alembic"] if a.alembic else [])
    r = subprocess.run(cmd, cwd=src, env=env)
    if r.returncode or not (work / "difflocks_output_strands.npz").exists(): sys.exit("DiffLocks failed (above)")
    shutil.move(str(work / "difflocks_output_strands.npz"), out / "strands.npz")
    for f in ("hair.json", "rgb.png", "scalp_texture.npz"):
        if (work / f).exists(): shutil.move(str(work / f), out / f)
    for f in work.glob("*"):
        if f.suffix in (".blend", ".abc"): shutil.move(str(f), out / f.name)
    shutil.rmtree(work, ignore_errors=True)
    (out / "difflocks.json").write_text(json.dumps({
        "source": str(Path(a.picture).name), "made_by": f"DiffLocks {PIN[:7]} (Meshcapade, MPI)",
        "licence": "DiffLocks: non-commercial only (free games; no payments, no sexual content): docs/DECISIONS.md 2026-10-22",
        "frame": "SMPL-X head (DiffLocks' body data), metres"}, indent=1), encoding="utf-8")
    print(f"strands in {out / 'strands.npz'}")
    print("DIFFLOCKS ok")


def cmd_check(a):
    if not sandbox_ok(): sys.exit("DIFFLOCKS FAIL: a process under unshare -rn could reach the network (or unshare is missing)")
    print("  ok  the sandbox: no connection gets out of unshare -rn")
    src = home_dir(a) / "src"
    if src.exists():
        new = [h for h in audit_hits(src) if h[3] is None]
        if new: sys.exit("DIFFLOCKS FAIL: new lines that could reach out:\n" + "\n".join(f"  {r}:{n}: {l}" for r, n, l, _ in new))
        print("  ok  the audit: every line that could reach out is known")
    else:
        print("  --  the audit: DiffLocks isn't set up here (python tools/difflocks.py setup)")
    print("DIFFLOCKS ok")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("setup", "audit", "check"):
        p = sub.add_parser(name); p.add_argument("--home")
        if name == "setup": p.add_argument("--natten-expired-cert", action="store_true", help="take NATTEN's wheel although its site's certificate has expired")
    p = sub.add_parser("run"); p.add_argument("picture"); p.add_argument("--out", required=True); p.add_argument("--home")
    p.add_argument("--blender", help="Blender 4.1.1's executable, for the .blend (and --alembic)"); p.add_argument("--alembic", action="store_true")
    a = ap.parse_args()
    {"setup": cmd_setup, "audit": cmd_audit, "run": cmd_run, "check": cmd_check}[a.cmd](a)


if __name__ == "__main__":
    main()
