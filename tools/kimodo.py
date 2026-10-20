#!/usr/bin/env python3
"""Runs NVIDIA's Kimodo from its own uv environment, with every download kept in one folder (no Docker).

`python setup/setup.py kimodo` builds it (docs/ANIMATION.md §1). The folder is KIMODO_HOME (default vendor/kimodo
in the project; `setup.py kimodo --home D:/Kimodo` puts it elsewhere): src/ (the repo), .venv/ (Python, torch,
Kimodo), cache/ (uv's packages and Python builds, Hugging Face models: Kimodo's checkpoints and the Llama-3-8B text
encoder, about 20 GB; torch; temp files). Nothing goes to the user's profile on C:.

    python tools/kimodo.py check                  CUDA, VRAM, the token, access to the gated text encoder: KIMODO ok
    python tools/kimodo.py login                  store a Hugging Face token (in cache/hf, not your profile)
    python tools/kimodo.py gen "<prompt>" [kimodo_gen flags...]   one generation (kimodo_gen --help for the flags)
    python tools/kimodo.py demo                   NVIDIA's timeline demo on http://127.0.0.1:7860
    python tools/kimodo.py py <script> [args]     any Python inside the environment (motion.py preview uses it)
    python tools/kimodo.py env                    print the environment variables it sets (for a shell of your own)

TEXT_ENCODER_DEVICE=cpu (set in setup/env.json by `setup.py kimodo --text-cpu`) keeps the GPU under 3 GB.
"""
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / "setup" / "env.json"
TEXT_ENCODER = "meta-llama/Meta-Llama-3-8B-Instruct"     # gated: ask for access on its Hugging Face page


def settings():
    env = json.loads(ENV_FILE.read_text(encoding="utf-8")) if ENV_FILE.exists() else {}
    k = env.get("kimodo") or {}
    home = Path(k.get("home") or ROOT / "vendor" / "kimodo")
    return home, k


def paths(home):
    cache = home / "cache"
    win = os.name == "nt"
    venv = home / ".venv"
    return {"home": home, "src": home / "src", "venv": venv, "cache": cache,
            "python": venv / ("Scripts/python.exe" if win else "bin/python"),
            "bin": venv / ("Scripts" if win else "bin")}


def environ(home, k=None):
    """The variables that keep every cache inside KIMODO_HOME."""
    p = paths(home)
    c = p["cache"]
    e = {
        "UV_CACHE_DIR": c / "uv", "UV_PYTHON_INSTALL_DIR": c / "python", "UV_TOOL_DIR": c / "uv-tools",
        "HF_HOME": c / "hf", "HUGGINGFACE_CACHE_DIR": c / "hf" / "hub", "TORCH_HOME": c / "torch",
        "XDG_CACHE_HOME": c / "xdg", "PIP_CACHE_DIR": c / "pip", "TMP": c / "tmp", "TEMP": c / "tmp", "TMPDIR": c / "tmp",
        "VIRTUAL_ENV": p["venv"],
    }
    out = {key: str(v) for key, v in e.items()}
    if (k or {}).get("text_encoder_device"):
        out["TEXT_ENCODER_DEVICE"] = k["text_encoder_device"]
    return out


def full_env(home, k=None):
    e = dict(os.environ)
    e.update(environ(home, k))
    for key in ("UV_CACHE_DIR", "UV_PYTHON_INSTALL_DIR", "HF_HOME", "TORCH_HOME", "XDG_CACHE_HOME", "TMP"):
        Path(e[key]).mkdir(parents=True, exist_ok=True)
    e["PATH"] = str(paths(home)["bin"]) + os.pathsep + e.get("PATH", "")
    return e


def run_in(home, k, argv):
    p = paths(home)
    if not p["python"].exists():
        sys.exit(f"no Kimodo environment at {home}: run `python setup/setup.py kimodo` first")
    return subprocess.call(argv, env=full_env(home, k))


CHECK = r'''
import os, sys
ok = True
try:
    import torch
    cuda = torch.cuda.is_available()
    print(f"torch {torch.__version__}, CUDA {'yes: ' + torch.cuda.get_device_name(0) if cuda else 'NO'}")
    if cuda:
        vram = torch.cuda.get_device_properties(0).total_memory / 2**30
        print(f"VRAM {vram:.1f} GB" + ("" if vram >= 17 or os.environ.get("TEXT_ENCODER_DEVICE") == "cpu"
                                         else "  (under 17 GB: `setup.py kimodo --text-cpu` puts the text encoder on the CPU)"))
    ok &= cuda
except Exception as e:
    print("torch: not importable:", e); ok = False
try:
    import kimodo, motion_correction  # noqa: F401
    print("kimodo and motion_correction import")
except Exception as e:
    print("kimodo: not importable:", e); ok = False
try:
    from huggingface_hub import auth_check, get_token
    if not get_token():
        print("no Hugging Face token: `python tools/kimodo.py login`"); ok = False
    else:
        auth_check("{MODEL}")
        print("access to {MODEL}: yes")
except Exception as e:
    print(f"text encoder access: NO ({type(e).__name__}): ask on https://huggingface.co/{MODEL}, then log in"); ok = False
print("HF_HOME", os.environ.get("HF_HOME"))
print("KIMODO ok" if ok else "KIMODO not ready")
'''.replace("{MODEL}", TEXT_ENCODER)


def main(argv):
    home, k = settings()
    p = paths(home)
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        return 0
    cmd, rest = argv[0], argv[1:]
    exe = lambda name: str(p["bin"] / (name + (".exe" if os.name == "nt" else "")))   # noqa: E731
    if cmd == "env":
        for key, v in environ(home, k).items():
            print(f"$env:{key} = '{v}'" if os.name == "nt" else f"export {key}='{v}'")
        return 0
    if cmd == "check":
        return run_in(home, k, [str(p["python"]), "-c", CHECK])
    if cmd == "login":
        return run_in(home, k, [exe("hf"), "auth", "login"])
    if cmd == "gen":
        return run_in(home, k, [exe("kimodo_gen"), *rest])
    if cmd == "demo":
        return run_in(home, k, [exe("kimodo_demo"), *rest])
    if cmd == "py":
        return run_in(home, k, [str(p["python"]), *rest])
    print(__doc__)
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
