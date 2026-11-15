#!/usr/bin/env python3
"""The project's one-time setup for Kimodo (NVIDIA's text-to-motion model) and our additions to its demo. Safe to
rerun: each step skips what's already done. (The Unreal setup steps went with the Unreal side, 2026-10-30: the games
ship from Godot, tools/godot_setup.sh.)

    python setup/setup.py kimodo [--home DIR] [--cuda cu128|cu126|cpu|none] [--python 3.11] [--demo] [--text-cpu] [--rev REV]
                                                 NVIDIA Kimodo from source with uv (no Docker): repo, Python, torch, models and
                                                 caches all in one folder (default vendor/kimodo); then `tools/kimodo.py check`
    python setup/setup.py doctor                 what of the toolchain this machine has (Node, Playwright and its Chromium,
                                                 Godot 4.7, Blender, MediaPipe, Kimodo, a card...), what each is for and the
                                                 command that sets up what's missing; installs nothing
    python setup/setup.py kimodo-patch [apply|check|refresh|remove]
                                                 our additions to Kimodo's demo (setup/kimodo_studio.patch: Loop, In place,
                                                 Drop last frame, Stage, Path, Pose): put them in, see if they fit, save the
                                                 checkout's changes back into the patch, or take them out
"""
import json
import os
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


def _which_godot():
    for c in [os.environ.get("GODOT"), "godot", "godot-mono"]:
        if c and shutil.which(c):
            return shutil.which(c)
    return None


def _out(cmd, **kw):
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=60, **kw)
        return r.returncode, (r.stdout + r.stderr).strip()
    except (OSError, subprocess.TimeoutExpired) as e:
        return 1, str(e)


def _venv_python(home, name):
    return home / name / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def doctor_rows():
    """(found, what, what it's for, how to set it up), one a piece of the toolchain; nothing is installed."""
    rows = []

    def add(ok, what, why, how=""):
        rows.append((bool(ok), what, why, how))

    v = sys.version_info
    add(v >= (3, 10), "Python %d.%d" % (v[0], v[1]), "every tool", "Python 3.10 or newer")
    for mod, why in [("numpy", "the checks, the prop and fabric makers, the hair and clothing bakes"),
                     ("scipy", "the clothing library's bake (clothing_library.py bake)"),
                     ("PIL", "contact sheets and pictures (plan_view.py, the Godot sheets)")]:
        code, _ = _out([sys.executable, "-c", "import " + mod])
        add(code == 0, mod if mod != "PIL" else "Pillow", why, "pip install " + ("pillow" if mod == "PIL" else mod))
    node = shutil.which("node")
    code, ver = _out([node, "--version"]) if node else (1, "")
    add(node and code == 0, "Node.js " + (ver if node else ""), "the pages' checks, the Animator, the kit, the bakes", "https://nodejs.org (18 or newer)")
    env = dict(os.environ)
    probe = "const p=require(process.env.PLAYWRIGHT||'playwright');const fs=require('fs');const e=p.chromium.executablePath();process.stdout.write(e+' '+fs.existsSync(e))"
    code, out = _out([node, "-e", probe], cwd=ROOT, env=env) if node else (1, "")
    if code and node and not env.get("NODE_PATH") and shutil.which("npm"):
        _, root = _out([shutil.which("npm"), "root", "-g"])
        if root:
            env["NODE_PATH"] = root.splitlines()[-1]
            code, out = _out([node, "-e", probe], cwd=ROOT, env=env)
    found = code == 0 and out.endswith(" true")
    add(found, "Playwright and its Chromium" + (" (NODE_PATH=$(npm root -g))" if found and env.get("NODE_PATH") != os.environ.get("NODE_PATH") else ""),
        "every browser check (python tools/browser_checks.py)",
        "npm install -g playwright && npx playwright install chromium; export NODE_PATH=\"$(npm root -g)\" (docs/RUN_LOCALLY.md)"
        if code else "the Playwright package and its Chromium differ: npx playwright install chromium (docs/RUN_LOCALLY.md, step 2)")
    smi = shutil.which("nvidia-smi")
    code, out = _out([smi, "-L"]) if smi else (1, "")
    add(smi and code == 0, "NVIDIA card" + (": " + out.splitlines()[0].split(" (UUID")[0] if smi and code == 0 and out else ""),
        "the browser checks on the card (GPU=1) and Godot's pictures in seconds", "none here: everything draws on the CPU, slowly")
    gd = _which_godot()
    code, ver = _out([gd, "--version"]) if gd else (1, "")
    add(gd and code == 0 and ver.startswith("4.7"), "Godot 4.7" + (" (" + ver.splitlines()[0] + " at " + gd + ")" if gd else ""),
        "the exports, the plugins, every Godot check", "godot-mono 4.7 on the PATH, or $GODOT (tools/godot_setup.sh on a cloud session)")
    add(shutil.which("xvfb-run"), "xvfb-run", "Godot's pictures without a window (the checks' sheets)", "the xvfb package")
    add(shutil.which("ffmpeg"), "ffmpeg", "the made sounds into Ogg (weapon_sounds.py, device_sounds.py), clips", "the ffmpeg package")
    add(shutil.which("uv"), "uv", "the setups below (their own Pythons)", "https://docs.astral.sh/uv/")
    cfg = json.loads(ENV.read_text(encoding="utf-8")) if ENV.exists() else {}
    bl = os.environ.get("BLENDER") or shutil.which("blender")
    bhome = Path((cfg.get("blender") or {}).get("home") or ROOT / "vendor" / "blender")
    bmod = _venv_python(bhome, ".venv").exists()
    add(bl or bmod, "Blender" + (" (" + bl + ")" if bl else " (its Python module)" if bmod else ""),
        "the prop generator, the street's bake, the fabrics, the retarget",
        "blender on the PATH, $BLENDER, or python tools/retarget.py setup (its module)")
    add(_venv_python(ROOT / "vendor" / "face_mesh", "venv").exists(), "MediaPipe (face mesh)",
        "photos to a head, the Studio's face fit (STUDIO, FACEPAGE)", "python tools/face_mesh.py setup")
    gh = Path(os.environ.get("GSHAIR_HOME") or ROOT / "vendor" / "gshair")
    add(_venv_python(gh, "venv").exists(), "the salon's reference (torch, OpenCV)", "a turntable video as the salon's locked reference",
        "python tools/gshair.py setup")
    try:
        sys.path.insert(0, str(ROOT / "tools"))
        import kimodo as K
        kim = (K.paths(K.settings()[0])["src"] / ".git").exists()
    except Exception:                                            # its settings unreadable: say it's not set up
        kim = False
    add(kim, "Kimodo", "one-off motions made from words (the Kimodo demo)", "python setup/setup.py kimodo")
    return rows


def cmd_doctor(args):
    """What of the toolchain this machine has, what each piece is for, and how to set up what's missing."""
    rows = doctor_rows()
    for ok, what, why, how in rows:
        print(("  ok   " if ok else "  --   ") + what)
        print("         for " + why + ("" if ok or not how else "\n         set up: " + how))
    missing = sum(1 for r in rows if not r[0])
    print("DOCTOR ok (%d of %d there%s)" % (len(rows) - missing, len(rows), "; what's missing only matters for what it's for" if missing else ""))


def main():
    cmds = {"kimodo": cmd_kimodo, "kimodo-patch": cmd_kimodo_patch, "doctor": cmd_doctor}
    if len(sys.argv) < 2 or sys.argv[1] not in cmds:
        print(__doc__)
        return
    cmds[sys.argv[1]](sys.argv[2:])


if __name__ == "__main__":
    main()
