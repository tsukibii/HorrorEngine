#!/usr/bin/env python3
"""The project's one-time setup, step by step (SETUP.md says when to run each). Safe to rerun: each step skips
what's already done.

    python setup/setup.py env                    find Unreal, the C++ toolchain, git, git-lfs; write setup/env.json
    python setup/setup.py adopt <folder>         copy a project the Project Browser made elsewhere into this folder
                                                 (its .uproject, Source, Config, Content merged); the old one stays
    python setup/setup.py plugins [words...]     list the engine's plugins whose name matches (default: setup/plugins.json's words)
    python setup/setup.py enable                 enable setup/plugins.json's plugins in the .uproject (names checked against the engine)
    python setup/setup.py unrealclaude [--show-scripts] [--auto-approve]
                                                 UnrealClaude (with the UE 5.8 fix, pull request 48) into Plugins/, its MCP
                                                 bridge's npm packages, and .mcp.json so Claude Code connects to the editor
    python setup/setup.py fetch [--all]          clone setup/sources.json's other repos (only the default ones without --all)
    python setup/setup.py kimodo [--home DIR] [--cuda cu128|cu126|cpu|none] [--python 3.11] [--demo] [--text-cpu] [--rev REV]
                                                 NVIDIA Kimodo from source with uv (no Docker): repo, Python, torch, models and
                                                 caches all in one folder (default vendor/kimodo); then `tools/kimodo.py check`
    python setup/setup.py kimodo-patch [apply|check|refresh|remove]
                                                 our additions to Kimodo's demo (setup/kimodo_studio.patch: Loop, In place,
                                                 Drop last frame, Stage, Path, Pose): put them in, see if they fit, save the
                                                 checkout's changes back into the patch, or take them out
    python setup/setup.py configure              ini lines (packaging story.json, Python), .gitignore, .gitattributes
    python setup/setup.py build                  compile the editor target (C++ projects), via the engine's Build.sh / Build.bat
    python setup/setup.py editor [args]          open the editor on the project (extra args pass through; on Linux through
                                                 unreal-omarchy's `ue` launcher when it's there, for its stability flags)
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
ENV = HERE / "env.json"
LAUNCHER = Path(os.environ.get("ProgramData", r"C:\ProgramData")) / "Epic" / "UnrealEngineLauncher" / "LauncherInstalled.dat"
WINDOWS = os.name == "nt"
PLAT = "Win64" if WINDOWS else "Linux"
UE_LAUNCHER = Path.home() / ".local" / "bin" / "ue"      # unreal-omarchy's launcher (it knows UE_ROOT)
VSWHERE = Path(os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")) / "Microsoft Visual Studio" / "Installer" / "vswhere.exe"

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def uproject():
    found = sorted(ROOT.glob("*.uproject"))
    return found[0] if found else None


def load_env():
    if not ENV.exists():
        sys.exit("run `python setup/setup.py env` first")
    return json.loads(ENV.read_text(encoding="utf-8"))


def run(cmd, **kw):
    try:
        return subprocess.run(cmd, capture_output=True, text=True, **kw)
    except (FileNotFoundError, OSError):
        return None


def find_engine(given=None):
    if given:
        return Path(given)
    if os.environ.get("UE_ROOT"):
        return Path(os.environ["UE_ROOT"])
    if LAUNCHER.exists():
        apps = json.loads(LAUNCHER.read_text(encoding="utf-8")).get("InstallationList", [])
        engines = [a for a in apps if re.match(r"UE_\d+\.\d+", a.get("AppName", ""))]
        if engines:
            best = max(engines, key=lambda a: tuple(int(x) for x in a["AppName"][3:].split(".")))
            return Path(best["InstallLocation"])
    if UE_LAUNCHER.exists():
        m = re.search(r'^UE_ROOT="?([^"\n]+)"?', UE_LAUNCHER.read_text(encoding="utf-8", errors="replace"), re.M)
        if m and Path(m.group(1)).exists():
            return Path(m.group(1))
    for base in (Path(r"C:\Program Files\Epic Games"), Path(r"D:\Epic Games")):
        if base.exists():
            cands = sorted(base.glob("UE_5.*"))
            if cands:
                return cands[-1]
    return None


def editor_exe(eng):
    return Path(eng) / "Engine" / "Binaries" / PLAT / ("UnrealEditor.exe" if WINDOWS else "UnrealEditor")


def linux_toolchain(eng):
    """Epic's bundled clang (the Linux prebuilt ships it), or one LINUX_MULTIARCH_ROOT points at."""
    if os.environ.get("LINUX_MULTIARCH_ROOT"):
        return os.environ["LINUX_MULTIARCH_ROOT"]
    base = Path(eng) / "Engine" / "Extras" / "ThirdPartyNotUE" / "SDKs" / "HostLinux" / "Linux_x64" if eng else None
    found = sorted(base.glob("*clang*")) if base and base.exists() else []
    return str(found[-1]) if found else None


def cmd_env(args):
    rows, env = [], {}
    eng = find_engine(args[0] if args else None)
    editor = editor_exe(eng) if eng else None
    ok = bool(editor and editor.exists())
    version = None
    if eng and (eng / "Engine" / "Build" / "Build.version").exists():
        bv = json.loads((eng / "Engine" / "Build" / "Build.version").read_text())
        version = f"{bv.get('MajorVersion')}.{bv.get('MinorVersion')}.{bv.get('PatchVersion')}"
    rows.append(("Unreal Engine", ok, f"{eng} ({version})" if ok else "not found: pass its folder, e.g. "
                 "`python setup/setup.py env /path/to/UnrealEngine` (or set UE_ROOT)"))
    env.update(engine=str(eng) if eng else None, version=version)
    if ok and version and tuple(int(x) for x in version.split(".")[:2]) < (5, 8):
        rows.append(("Unreal 5.8 or newer", False, f"found {version}: the MCP plugin needs 5.8"))
    if WINDOWS:
        vs = None
        if VSWHERE.exists():
            r = run([str(VSWHERE), "-latest", "-products", "*", "-requires", "Microsoft.VisualStudio.Workload.NativeGame",
                     "-property", "installationPath"])
            vs = r.stdout.strip() if r and r.stdout.strip() else None
        rows.append(("Visual Studio with 'Game development with C++'", bool(vs), vs or
                     "needed to compile C++ (the StoryRunner): install Visual Studio Community with that workload, then rerun"))
        env["visual_studio"] = vs
    else:
        tc = linux_toolchain(eng)
        rows.append(("Epic's clang toolchain (C++)", bool(tc), tc or "not in this engine: the Linux prebuilt ships it under "
                     "Engine/Extras/ThirdPartyNotUE/SDKs/HostLinux; or set LINUX_MULTIARCH_ROOT"))
        env["toolchain"] = tc
    git = shutil.which("git")
    rows.append(("git", bool(git), git or ("install Git for Windows (winget install Git.Git)" if WINDOWS else "sudo pacman -S git")))
    lfs = run(["git", "lfs", "version"]) if git else None
    rows.append(("git-lfs", bool(lfs and lfs.returncode == 0), (lfs.stdout.strip() if lfs and lfs.returncode == 0 else
                 ("install it (winget install GitHub.GitLFS)" if WINDOWS else "sudo pacman -S git-lfs") + ", then `git lfs install`")))
    try:
        import PIL  # noqa: F401
        pil = True
    except ImportError:
        pil = False
    rows.append(("Pillow (for the plan and shot sheets)", pil, "ok" if pil else "uv pip install pillow numpy (or pip)"))
    node = run(["node", "--version"])
    nv = node.stdout.strip() if node and node.returncode == 0 else None
    node_ok = bool(nv) and int(nv.lstrip("v").split(".")[0]) >= 18
    rows.append(("Node.js 18+ (UnrealClaude's MCP bridge)", node_ok, nv or ("install Node.js LTS (winget install OpenJS.NodeJS.LTS)" if WINDOWS else "sudo pacman -S nodejs npm")))
    cc = run(["claude", "--version"]) or run(["claude.cmd", "--version"])
    rows.append(("Claude Code CLI", bool(cc and cc.returncode == 0), (cc.stdout.strip() if cc and cc.returncode == 0 else
                 "npm install -g @anthropic-ai/claude-code, then claude auth login")))
    free = shutil.disk_usage(ROOT).free / 1e9
    rows.append(("free disk on this drive", free > 60, f"{free:.0f} GB (want 60+ for the project, builds and footage)"))
    up = uproject()
    rows.append(("the .uproject in this folder", bool(up), str(up.name) if up else
                 "create the project (SETUP.md S2), then `python setup/setup.py adopt <its folder>`"))
    env["uproject"] = str(up) if up else None
    for name, good, note in rows:
        print(f"{'ok  ' if good else 'MISS'}  {name:<48} {note}")
    ENV.write_text(json.dumps(env, indent=1), encoding="utf-8")
    missing = [n for n, g, _ in rows if not g]
    print(f"ENV {'ok' if not missing else 'MISSING ' + ', '.join(missing)}")


def engine_plugins(eng):
    out = {}
    for base in (Path(eng) / "Engine" / "Plugins", ROOT / "Plugins"):
        for f in base.rglob("*.uplugin"):
            try:
                d = json.loads(f.read_text(encoding="utf-8-sig"))
            except (json.JSONDecodeError, UnicodeDecodeError):
                d = {}
            out[f.stem] = {"friendly": d.get("FriendlyName", ""), "category": d.get("Category", ""),
                           "beta": d.get("IsBetaVersion", False), "experimental": d.get("IsExperimentalVersion", False),
                           "path": str(f.relative_to(base.parent if base.name == "Plugins" else base))}
    return out


def cmd_plugins(args):
    env = load_env()
    allp = engine_plugins(env["engine"])
    words = args or [w for p in json.loads((HERE / "plugins.json").read_text())["plugins"] for w in p["find"]]
    for w in words:
        hits = [(k, v) for k, v in allp.items() if w.lower() in (k + " " + v["friendly"]).lower()]
        print(f"'{w}': " + ("; ".join(f"{k} ({v['friendly']}{', experimental' if v['experimental'] else ''})"
                                     for k, v in sorted(hits)) or "nothing"))


def cmd_enable(_args):
    env = load_env()
    up = uproject()
    if not up:
        sys.exit("no .uproject here")
    allp = engine_plugins(env["engine"])
    want = json.loads((HERE / "plugins.json").read_text())["plugins"]
    proj = json.loads(up.read_text(encoding="utf-8-sig"))
    have = {p["Name"]: p for p in proj.setdefault("Plugins", [])}
    bad = 0
    for p in want:
        name = next((n for n in p["names"] if n in allp), None)
        if not name:
            print(f"MISS  {p['want']}: none of {p['names']} exists; `setup.py plugins {' '.join(p['find'])}` and fix plugins.json")
            bad += 1
            continue
        if have.get(name, {}).get("Enabled"):
            print(f"ok    {p['want']}: {name} (already on)")
            continue
        have[name] = {"Name": name, "Enabled": True}
        print(f"on    {p['want']}: {name}")
    proj["Plugins"] = list(have.values())
    up.write_text(json.dumps(proj, indent="\t"), encoding="utf-8")
    print("ENABLE ok" if not bad else f"ENABLE MISSING {bad}")


def cmd_fetch(args):
    srcs = json.loads((HERE / "sources.json").read_text())["sources"]
    lock_f = HERE / "sources.lock.json"
    lock = json.loads(lock_f.read_text()) if lock_f.exists() else {}
    for s in srcs:
        if not s.get("default", True) and "--all" not in args and s["name"] not in args:
            print(f"skip  {s['name']} (not default: `setup.py fetch {s['name']}`)")
            continue
        dest = ROOT / s["to"]
        if dest.exists():
            print(f"have  {s['name']} at {s['to']}")
        else:
            dest.parent.mkdir(parents=True, exist_ok=True)
            r = run(["git", "clone", "--depth", "1", s["url"], str(dest)])
            if not r or r.returncode:
                print(f"FAIL  {s['name']}: {(r.stderr if r else 'git not found').strip()[:300]}")
                continue
            shutil.rmtree(dest / ".git", ignore_errors=True)   # vendored: our repo tracks it
            print(f"got   {s['name']} -> {s['to']}  ({s.get('license', '?')}): {s['why']}")
            lock[s["name"]] = {"url": s["url"], "commit": (run(["git", "ls-remote", s["url"], "HEAD"]) or
                                                           subprocess.CompletedProcess([], 0, "")).stdout.split("\t")[0]}
        if s.get("audit"):
            print(f"      AUDIT {s['name']} before using it: {s['audit']}")
    lock_f.write_text(json.dumps(lock, indent=1), encoding="utf-8")


UC_REPO = "https://github.com/Natfii/UnrealClaude"
UC_PR = 48            # "Fix compile on UE 5.8: FJsonObject key type changed to FSharedString" (verified on 5.8 by its author)
UC_SRC = ROOT / "vendor" / "UnrealClaude-src"
UC_PLUGIN = ROOT / "Plugins" / "UnrealClaude"


def git(*args, cwd=None):
    r = run(["git", "-c", "user.name=setup", "-c", "user.email=setup@localhost", *args], cwd=cwd)
    if not r or r.returncode:
        sys.exit(f"git {' '.join(args)} failed: {(r.stderr if r else 'git not found').strip()[:400]}")
    return r.stdout.strip()


def cmd_unrealclaude(args):
    env = load_env()
    if not UC_SRC.exists():
        UC_SRC.parent.mkdir(parents=True, exist_ok=True)
        git("clone", UC_REPO, str(UC_SRC))
        print(f"got   UnrealClaude source -> {UC_SRC.relative_to(ROOT)}")
    base = git("rev-parse", "--short", "HEAD", cwd=UC_SRC)
    merged = run(["git", "merge-base", "--is-ancestor", f"pr{UC_PR}", "HEAD"], cwd=UC_SRC)
    if not merged or merged.returncode:
        git("fetch", "origin", f"pull/{UC_PR}/head:pr{UC_PR}", cwd=UC_SRC)
        git("merge", "--no-edit", f"pr{UC_PR}", cwd=UC_SRC)
        print(f"fix   merged pull request {UC_PR} (UE 5.8 FJsonObject keys) onto {base}")
    else:
        print(f"have  pull request {UC_PR} merged")
    git("submodule", "update", "--init", "--recursive", cwd=UC_SRC)
    if UC_PLUGIN.exists():
        shutil.rmtree(UC_PLUGIN)
    shutil.copytree(UC_SRC / "UnrealClaude", UC_PLUGIN, ignore=shutil.ignore_patterns(".git", "node_modules"))
    up = UC_PLUGIN / "UnrealClaude.uplugin"
    d = json.loads(up.read_text(encoding="utf-8-sig"))
    if env.get("version"):
        d["EngineVersion"] = ".".join(env["version"].split(".")[:2]) + ".0"   # no "built for another version" nag
    up.write_text(json.dumps(d, indent="\t"), encoding="utf-8")
    print(f"copy  plugin -> Plugins/UnrealClaude (EngineVersion {d['EngineVersion']}); it compiles with the project")
    bridge = UC_PLUGIN / "Resources" / "mcp-bridge"
    if "--show-scripts" in args:
        router = bridge / "tool-router.js"
        text = router.read_text(encoding="utf-8")
        for name in ("execute_script", "cleanup_scripts", "get_script_history"):
            text = text.replace(f'  "{name}",\n', "")
        router.write_text(text, encoding="utf-8")
        print("show  execute_script, cleanup_scripts, get_script_history to the model (run_console_command stays hidden); "
              "every script still asks in the editor unless auto-approve is on")
    npm = shutil.which("npm") or shutil.which("npm.cmd")
    if not npm:
        sys.exit("npm not found: install Node.js LTS, then rerun")
    r = subprocess.run([npm, "install", "--no-audit", "--no-fund"], cwd=bridge, capture_output=True, text=True, shell=os.name == "nt")
    print("npm   bridge packages installed" if r.returncode == 0 else f"FAIL  npm install: {r.stderr.strip()[:300]}")
    mcp = ROOT / ".mcp.json"
    cfg = json.loads(mcp.read_text(encoding="utf-8")) if mcp.exists() else {}
    cfg.setdefault("mcpServers", {})["unreal"] = {"command": "node", "args": [str(bridge / "index.js")],
                                                    "env": {"UNREAL_MCP_URL": "http://localhost:3000"}}
    mcp.write_text(json.dumps(cfg, indent=2), encoding="utf-8")
    print("mcp   .mcp.json: server 'unreal' (restart Claude Code in this folder and approve it)")
    if "--auto-approve" in args:
        ini_add(ROOT / "Config" / "DefaultEditor.ini", "[/Script/UnrealClaude.UnrealClaudeSettings]", "bAutoApproveScripts=True")
        print("set   auto-approve script execution ON for this project (the editor logs each script it runs)")
    print("UNREALCLAUDE ok: build the project (setup.py build), open the editor, then `curl http://localhost:3000/mcp/status`")


INI = {
    "Config/DefaultGame.ini": [
        ("[/Script/UnrealEd.ProjectPackagingSettings]", "bShareMaterialShaderCode=True"),
    ],
    "Config/DefaultEngine.ini": [
        ("[/Script/PythonScriptPlugin.PythonScriptPluginSettings]", "bDeveloperMode=True"),
    ],
}

KIMODO_REPO = "https://github.com/nv-tlabs/kimodo"


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


def ini_add(path, section, line):
    text = path.read_text(encoding="utf-8") if path.exists() else ""
    if line in text:
        return False
    if section in text:
        text = text.replace(section, section + "\n" + line, 1)
    else:
        text = (text.rstrip("\n") + "\n\n" if text.strip() else "") + f"{section}\n{line}\n"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return True


def cmd_configure(_args):
    for f, pairs in INI.items():
        for section, line in pairs:
            print(f"{'set ' if ini_add(ROOT / f, section, line) else 'have'}  {f}: {line}")
    for name in (".gitignore", ".gitattributes"):
        src, dst = HERE / (name[1:] + ".txt"), ROOT / name
        if dst.exists():
            print(f"have  {name} (compare with setup/{src.name})")
        else:
            shutil.copy(src, dst)
            print(f"wrote {name}")
    print("CONFIGURE ok")


def cmd_build(_args):
    env = load_env()
    up = Path(env["uproject"] or uproject())
    batch = Path(env["engine"]) / "Engine" / "Build" / "BatchFiles"
    script = batch / "Build.bat" if WINDOWS else batch / "Linux" / "Build.sh"
    cmd = [str(script), f"{up.stem}Editor", PLAT, "Development", f"-Project={up}", "-WaitMutex", "-NoHotReload"]
    print(" ".join(cmd))
    r = subprocess.run(cmd)
    print("BUILD ok" if r.returncode == 0 else f"BUILD FAILED ({r.returncode})")
    sys.exit(r.returncode)


def cmd_editor(args):
    env = load_env()
    up = Path(env["uproject"] or uproject())
    exe = UE_LAUNCHER if not WINDOWS and UE_LAUNCHER.exists() else editor_exe(env["engine"])
    subprocess.Popen([str(exe), str(up)] + args)
    print(f"EDITOR started: {exe} {up.name} {' '.join(args)}")


def cmd_adopt(args):
    """The Project Browser won't create a project in a folder with files in it, so it makes one elsewhere and this
    copies it in: its .uproject and thumbnail, Source and Config (which must be new here) and its Content (merged:
    nothing of ours is overwritten). The old folder stays as it was: delete it once the project opens from here."""
    if not args:
        sys.exit("adopt <the folder the Project Browser made>")
    src = Path(args[0]).expanduser().resolve()
    ups = sorted(src.glob("*.uproject"))
    if len(ups) != 1:
        sys.exit(f"want one .uproject in {src}, found {len(ups)}")
    if uproject():
        sys.exit(f"this folder already has {uproject().name}: nothing adopted")
    for name in ("Source", "Config"):
        if (ROOT / name).exists():
            sys.exit(f"{name}/ already exists here: move it aside first")
    clash = [f.relative_to(src) for f in (src / "Content").rglob("*") if f.is_file() and (ROOT / f.relative_to(src)).exists()]
    if clash:
        sys.exit("these Content files exist in both: " + ", ".join(map(str, clash[:10])))
    for name in ("Source", "Config"):
        if (src / name).exists():
            shutil.copytree(src / name, ROOT / name)
    n = 0
    for f in sorted((src / "Content").rglob("*")):
        if f.is_file():
            dst = ROOT / f.relative_to(src)
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(f, dst)
            n += 1
    for f in [ups[0], *src.glob(f"{ups[0].stem}.png")]:
        shutil.copy2(f, ROOT / f.name)
    print(f"ADOPT ok: {ups[0].name}, Source, Config and {n} Content files copied into {ROOT}")
    print(f"the old project is still at {src}: delete it once the editor opens the project from here")


def main():
    cmds = {"env": cmd_env, "plugins": cmd_plugins, "enable": cmd_enable, "fetch": cmd_fetch, "unrealclaude": cmd_unrealclaude,
            "configure": cmd_configure, "adopt": cmd_adopt, "build": cmd_build, "editor": cmd_editor, "kimodo": cmd_kimodo,
            "kimodo-patch": cmd_kimodo_patch}
    if len(sys.argv) < 2 or sys.argv[1] not in cmds:
        print(__doc__)
        return
    cmds[sys.argv[1]](sys.argv[2:])


if __name__ == "__main__":
    main()
