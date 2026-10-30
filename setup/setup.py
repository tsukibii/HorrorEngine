#!/usr/bin/env python3
"""The project's one-time setup for Kimodo (NVIDIA's text-to-motion model) and our additions to its demo. Safe to
rerun: each step skips what's already done. (The Unreal setup steps went with the Unreal side, 2026-10-30: the games
ship from Godot, tools/godot_setup.sh.)

    python setup/setup.py kimodo [--home DIR] [--cuda cu128|cu126|cpu|none] [--python 3.11] [--demo] [--text-cpu] [--rev REV]
                                                 NVIDIA Kimodo from source with uv (no Docker): repo, Python, torch, models and
                                                 caches all in one folder (default vendor/kimodo); then `tools/kimodo.py check`
    python setup/setup.py kimodo-patch [apply|check|refresh|remove]
                                                 our additions to Kimodo's demo (setup/kimodo_studio.patch: Loop, In place,
                                                 Drop last frame, Stage, Path, Pose): put them in, see if they fit, save the
                                                 checkout's changes back into the patch, or take them out
"""
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HERE = ROOT / "setup"
ENV = HERE / "env.json"            # the Kimodo setup's paths (tools/kimodo.py reads it)
KIMODO_REPO = "https://github.com/nv-tlabs/kimodo"

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def run(cmd, **kw):
    try:
        return subprocess.run(cmd, capture_output=True, text=True, **kw)
    except (FileNotFoundError, OSError):
        return None


KIMODO_PATCH = ROOT / "setup" / "kimodo_studio.patch"


def kimodo_src():
    sys.path.insert(0, str(ROOT / "tools"))
    import kimodo as K
    home, _ = K.settings()
    src = K.paths(home)["src"]
    if not (src / ".git").exists():
        sys.exit(f"no Kimodo checkout at {src}: run `python setup/setup.py kimodo` first")
    return src


def patch_base(patch=KIMODO_PATCH):
    """The Kimodo commit the patch was made on (its first line), or None."""
    first = patch.read_text(encoding="utf-8").split("\n", 1)[0] if patch.exists() else ""
    return first.split("base ", 1)[1].split()[0] if first.startswith("Kimodo base ") else None


def patch_state(src, patch=KIMODO_PATCH):
    """applied, clean (applies as it is), 3way (applies by merging into a newer Kimodo) or conflict."""
    ok = lambda *a: (r := run(["git", "apply", *a, str(patch)], cwd=src)) is not None and r.returncode == 0   # noqa: E731
    if ok("--reverse", "--check"):
        return "applied"
    if ok("--check"):
        return "clean"
    return "3way" if ok("--3way", "--check") else "conflict"


def apply_kimodo_patch(src, patch=KIMODO_PATCH):
    """Our demo additions into the checkout; a newer Kimodo gets them by a three-way merge where the lines moved."""
    if not patch.exists():
        return "no patch"
    state = patch_state(src, patch)
    if state == "applied":
        return "already in"
    if state in ("clean", "3way"):
        r = run(["git", "apply", *(["--3way"] if state == "3way" else []), str(patch)], cwd=src)
        if r and r.returncode == 0:
            return "applied" + (" (merged into a newer Kimodo)" if state == "3way" else "")
        files = [ln.split(" b/", 1)[1] for ln in patch.read_text(encoding="utf-8").splitlines() if ln.startswith("diff --git")]
        for name in files:                        # a merge that conflicted: put those files back as they were
            run(["git", "reset", "-q", "--", name], cwd=src)
            known = run(["git", "cat-file", "-e", f"HEAD:{name}"], cwd=src)
            if known and known.returncode == 0:
                run(["git", "checkout", "HEAD", "--", name], cwd=src)
            else:
                (Path(src) / name).unlink(missing_ok=True)
    base = patch_base(patch)
    sys.exit(f"{patch.name} doesn't fit this Kimodo. Either build the Kimodo it was made on:\n"
             f"  python setup/setup.py kimodo --rev {base or '<the commit on its first line>'}\n"
             "or port it by hand: docs/ANIMATION.md, 'The studio's additions to Kimodo's demo', says what each piece "
             "does and where it lives; then `python setup/setup.py kimodo-patch refresh`.")


def cmd_kimodo_patch(args):
    src, what = kimodo_src(), (args[0] if args else "apply")
    head = (run(["git", "rev-parse", "HEAD"], cwd=src) or subprocess.CompletedProcess([], 0, "")).stdout.strip()
    if what == "check":
        print(f"KIMODO_PATCH {patch_state(src)} (made on {(patch_base() or '?')[:10]}, this checkout {head[:10]})")
    elif what == "apply":
        print(f"KIMODO_PATCH {apply_kimodo_patch(src)}")
    elif what == "remove":
        if patch_state(src) != "applied":
            sys.exit("KIMODO_PATCH isn't in this checkout (or the files changed since): nothing removed")
        r = run(["git", "apply", "--reverse", str(KIMODO_PATCH)], cwd=src)
        print("KIMODO_PATCH removed: stock Kimodo" if r and r.returncode == 0 else f"failed: {r.stderr if r else ''}")
    elif what == "refresh":                       # the checkout's changes (new files too) become the patch
        new = (run(["git", "ls-files", "--others", "--exclude-standard", "--", "kimodo"], cwd=src).stdout or "").split()
        if new:
            run(["git", "add", "-N", *new], cwd=src)
        diff = run(["git", "diff", "--src-prefix=a/", "--dst-prefix=b/", "--", "kimodo"], cwd=src).stdout   # portable whatever the git config
        if not diff.strip():
            sys.exit("no changes in the checkout: nothing to save")
        KIMODO_PATCH.write_text(f"Kimodo base {head}\n\n{diff}", encoding="utf-8", newline="\n")
        files = [ln.split(" b/", 1)[1] for ln in diff.splitlines() if ln.startswith("diff --git")]
        print(f"KIMODO_PATCH refreshed: {len(files)} files ({', '.join(files)}), base {head[:10]}")
    else:
        sys.exit("kimodo-patch apply | check | refresh | remove")


def cmd_kimodo(args):
    """Kimodo built from its repo in a uv environment: everything (Python, torch, the 20 GB of models, caches, temp
    files) under one folder, so nothing lands on the system drive. Rerun to repair or update; it skips what's done."""
    sys.path.insert(0, str(ROOT / "tools"))
    import kimodo as K
    opt = lambda name, d=None: args[args.index(name) + 1] if name in args else d   # noqa: E731
    env = json.loads(ENV.read_text(encoding="utf-8")) if ENV.exists() else {}
    k = env.get("kimodo") or {}
    home = Path(opt("--home") or k.get("home") or ROOT / "vendor" / "kimodo").resolve()
    cuda, py, rev = opt("--cuda", k.get("cuda", "cu128")), opt("--python", k.get("python", "3.11")), opt("--rev", k.get("rev"))
    k.update(home=str(home), cuda=cuda, python=py)
    if "--text-cpu" in args:
        k["text_encoder_device"] = "cpu"
    p = K.paths(home)
    uv = shutil.which("uv")
    if not uv:
        sys.exit("uv isn't installed. Install it (a single small program, in your user folder):\n"
                 "  powershell -ExecutionPolicy ByPass -c \"irm https://astral.sh/uv/install.ps1 | iex\"\n"
                 "then open a new terminal and rerun `python setup/setup.py kimodo`.")
    e = K.full_env(home, k)

    def step(title, cmd, cwd=None):
        print(f"--> {title}", flush=True)
        r = subprocess.run(cmd, env=e, cwd=cwd)
        if r.returncode:
            sys.exit(f"FAILED: {title} (exit {r.returncode}). Fix and rerun; finished steps are skipped.")

    home.mkdir(parents=True, exist_ok=True)
    if not (p["src"] / ".git").exists():
        step("clone Kimodo", ["git", "clone", KIMODO_REPO, str(p["src"])])
    if rev:
        step(f"check out {rev}", ["git", "checkout", rev], cwd=p["src"])
    print(f"--> {KIMODO_PATCH.name}: {apply_kimodo_patch(p['src'])}")
    k["commit"] = (run(["git", "rev-parse", "HEAD"], cwd=p["src"]) or subprocess.CompletedProcess([], 0, "")).stdout.strip()
    if not p["python"].exists():
        step(f"Python {py} (uv, inside {home})", [uv, "python", "install", py])
        step("the environment", [uv, "venv", str(p["venv"]), "--python", py])
    vp = str(p["python"])
    if cuda == "none":
        print("--> PyTorch: skipped (--cuda none: you installed it into the environment yourself)")
    elif cuda == "cpu":
        step("PyTorch (CPU only: slow, for testing)", [uv, "pip", "install", "--python", vp, "torch", "--index-url", "https://download.pytorch.org/whl/cpu"])
    else:
        step(f"PyTorch with CUDA ({cuda})", [uv, "pip", "install", "--python", vp, "torch", "--index-url", f"https://download.pytorch.org/whl/{cuda}"])
    step("build tools (CMake for Kimodo's motion correction, hatchling for the demo's viser)", [uv, "pip", "install", "--python", vp, "cmake", "setuptools", "wheel", "hatchling"])
    # NVIDIA's own pinned versions (docker_requirements.txt) as constraints, so this matches what they test
    pins = [ln.strip() for ln in (p["src"] / "docker_requirements.txt").read_text(encoding="utf-8").splitlines()
            if re.match(r"^[A-Za-z0-9_.\-]+==", ln.strip())]
    tv = run([vp, "-c", "import torch; print(torch.__version__)"])
    if tv and tv.returncode == 0 and tv.stdout.strip():
        pins.append(f"torch=={tv.stdout.strip()}")    # SOMA-X needs torch: keep the CUDA build, never PyPI's CPU one
    cons = home / "constraints.txt"
    cons.write_text("\n".join(pins) + "\n", encoding="utf-8")
    extra = "[all]" if "--demo" in args else "[soma]"
    step(f"Kimodo {extra} (compiles motion correction with Visual Studio's C++)",
         [uv, "pip", "install", "--python", vp, "-c", str(cons), "--no-build-isolation", "-e", f"{p['src']}{extra}"])
    env["kimodo"] = k
    ENV.write_text(json.dumps(env, indent=1), encoding="utf-8")
    print(f"KIMODO built in {home} (commit {k['commit'][:10]})")
    print("next: 1) ask for access to meta-llama/Meta-Llama-3-8B-Instruct on huggingface.co (Kimodo's text encoder)")
    print("      2) python tools/kimodo.py login     3) python tools/kimodo.py check   (KIMODO ok)")


def main():
    cmds = {"kimodo": cmd_kimodo, "kimodo-patch": cmd_kimodo_patch}
    if len(sys.argv) < 2 or sys.argv[1] not in cmds:
        print(__doc__)
        return
    cmds[sys.argv[1]](sys.argv[2:])


if __name__ == "__main__":
    main()
