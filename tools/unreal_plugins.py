#!/usr/bin/env python3
"""The plugins in UnrealPlugins/ (UltraVHS, LightKit) on or off in an Unreal project: this one or any other.

    python tools/unreal_plugins.py                                   each plugin, and whether this project has it on
    python tools/unreal_plugins.py on UltraVHS LightKit [--build]    on in HorrorEngine (UnrealPlugins/ used in place)
    python tools/unreal_plugins.py on LightKit --project /path/Game.uproject [--link] [--build]
                                     another project: a copy in its Plugins/ (--link: point it at this folder instead)
    python tools/unreal_plugins.py off UltraVHS [--project ...]      off again (a copy in Plugins/ stays: delete it by hand)
    --dry shows what would change and changes nothing

What `on` does: the plugin goes in (HorrorEngine: "AdditionalPluginDirectories": ["UnrealPlugins"]; another project:
a copy in its Plugins/, or with --link this folder's absolute path), it's enabled in the .uproject with the engine
plugins it needs, and --build compiles: the editor target of a C++ project, or the plugin by itself for a
Blueprint-only one (RunUAT BuildPlugin, the built copy put in Plugins/). Then, in the editor: Light Kit makes its
materials itself the first time the editor starts with it (its Content/Python/init_unreal.py); UltraVHS goes on the
player (Add Component > Ultra VHS); in HorrorStudio, Generate gives every level Light Kit's sky at the scene's time
and a window light in every window (docs/UNREAL_FLOW.md §1c). The plugins' own CLAUDE.md say how to check them and
fix them on another engine. Ends "PLUGINS ok".
"""
import argparse
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLUGINS = ROOT / "UnrealPlugins"
NEEDS = {"LightKit": ["PythonScriptPlugin", "EditorScriptingUtilities"]}   # engine plugins: Light Kit's material script
WINDOWS = os.name == "nt"
PLAT = "Win64" if WINDOWS else "Linux"

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def ours():
    """The plugins in UnrealPlugins/: {name: its folder}."""
    return {f.stem: f.parent for f in sorted(PLUGINS.glob("*/*.uplugin"))}


def setup_module():
    spec = importlib.util.spec_from_file_location("studio_setup", ROOT / "setup" / "setup.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def engine():
    """Unreal's folder: setup/env.json (setup.py env), else the places setup.py looks."""
    env = ROOT / "setup" / "env.json"
    if env.exists():
        e = json.loads(env.read_text(encoding="utf-8")).get("engine")
        if e and Path(e).exists():
            return Path(e)
    return setup_module().find_engine()


def read(up):
    return json.loads(up.read_text(encoding="utf-8-sig"))


def write(up, proj, dry):
    if not dry:
        up.write_text(json.dumps(proj, indent="\t") + "\n", encoding="utf-8")


def is_this(up):
    return up.resolve().parent == ROOT


def plugin_dirs(up, proj):
    """Where the project looks for plugins besides its own Plugins/: absolute paths."""
    return [(up.parent / d).resolve() for d in proj.get("AdditionalPluginDirectories", [])]


def state(up, proj, name):
    """'on', 'off' (in reach but not enabled), or 'absent' (the project can't see it)."""
    entry = next((p for p in proj.get("Plugins", []) if p.get("Name") == name), None)
    reach = (up.parent / "Plugins" / name).is_dir() or PLUGINS.resolve() in plugin_dirs(up, proj)
    if entry and entry.get("Enabled") and reach:
        return "on"
    return "off" if reach else "absent"


def enable(proj, name, on=True):
    plugs = proj.setdefault("Plugins", [])
    entry = next((p for p in plugs if p.get("Name") == name), None)
    if entry is None:
        if not on:
            return False
        plugs.append({"Name": name, "Enabled": True})
        return True
    if bool(entry.get("Enabled")) == on:
        return False
    entry["Enabled"] = on
    return True


def cmd_list(up):
    proj = read(up)
    print(f"{up}")
    for name, folder in ours().items():
        d = json.loads((folder / f"{name}.uplugin").read_text(encoding="utf-8-sig"))
        print(f"  {state(up, proj, name):6} {name:10} {d.get('FriendlyName', '')}: {d.get('Description', '')[:90]}")
    print("PLUGINS ok")


def build_project(up, eng, dry):
    batch = Path(eng) / "Engine" / "Build" / "BatchFiles"
    script = batch / "Build.bat" if WINDOWS else batch / "Linux" / "Build.sh"
    cmd = [str(script), f"{up.stem}Editor", PLAT, "Development", f"-Project={up}", "-WaitMutex", "-NoHotReload"]
    print("build  " + " ".join(cmd))
    return dry or subprocess.run(cmd).returncode == 0


def build_plugin(up, name, eng, dry):
    """A Blueprint-only project can't compile plugin source: build the plugin by itself and put the built copy in."""
    uat = Path(eng) / "Engine" / "Build" / "BatchFiles" / ("RunUAT.bat" if WINDOWS else "RunUAT.sh")
    out = Path(tempfile.mkdtemp(prefix=f"{name}_built_"))
    cmd = [str(uat), "BuildPlugin", f"-Plugin={ours()[name] / (name + '.uplugin')}", f"-Package={out}", f"-TargetPlatforms={PLAT}"]
    print("build  " + " ".join(cmd))
    if dry:
        return True
    if subprocess.run(cmd).returncode != 0:
        return False
    dst = up.parent / "Plugins" / name
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(out, dst)
    print(f"put    the built {name} in {dst}")
    return True


def cmd_on(up, names, link, build, dry):
    proj, mine, bad = read(up), ours(), 0
    this = is_this(up)
    for name in names:
        if name not in mine:
            print(f"MISS   {name}: not in UnrealPlugins/ ({', '.join(mine)})")
            bad += 1
            continue
        if this or link:                                    # in place: the project looks in this folder
            rel = "UnrealPlugins" if this else str(PLUGINS.resolve())
            dirs = proj.setdefault("AdditionalPluginDirectories", [])
            if PLUGINS.resolve() not in plugin_dirs(up, proj):
                dirs.append(rel)
                print(f"look   in {rel} for plugins")
        else:                                               # a copy the project owns (its folder keeps the plugin's name)
            dst = up.parent / "Plugins" / name
            print(f"{'update' if dst.exists() else 'copy  '} {mine[name]} -> {dst}")
            if not dry:
                shutil.copytree(mine[name], dst, dirs_exist_ok=True, ignore=shutil.ignore_patterns("Binaries", "Intermediate", "__pycache__"))
        print(f"{'on' if enable(proj, name) else 'have':6} {name}")
        for need in NEEDS.get(name, []):
            if enable(proj, need):
                print(f"{'on':6} {need} (for {name})")
    write(up, proj, dry)
    if build and not bad:
        eng = engine()
        if not eng:
            print("no Unreal found: run `python setup/setup.py env`, or build from the editor")
            bad += 1
        elif (up.parent / "Source").is_dir():
            bad += 0 if build_project(up, eng, dry) else 1
        else:
            for name in names:
                bad += 0 if build_plugin(up, name, eng, dry) else 1
    elif not (up.parent / "Source").is_dir():
        print("note   a Blueprint-only project can't compile the plugins' C++: add --build (it builds them with RunUAT), "
              "or add any C++ class once (Tools > New C++ Class)")
    print("next   open the editor (it builds a C++ project's modules on start if you didn't --build)")
    if "LightKit" in names:
        print("next   Light Kit makes its materials the first time the editor starts with it (or: import lightkit_materials; lightkit_materials.build())")
        print("next   a level: clear its sky, then Light Kit Sky, and Light Kit Window in each window (LightKit/README.md)"
              + ("; HorrorStudio's Generate does this for every level" if this else ""))
    if "UltraVHS" in names:
        print("next   UltraVHS: the player's Blueprint, Add Component > Ultra VHS (r.UltraVHS 1 in the console shows it at once)")
    print("PLUGINS ok" if not bad else f"PLUGINS FAILED ({bad})")
    return bad


def cmd_off(up, names, dry):
    proj = read(up)
    for name in names:
        print(f"{'off' if enable(proj, name, False) else 'was off':6} {name}")
    if is_this(up) and all(state(up, proj, n) != "on" for n in ours()):
        dirs = [d for d in proj.get("AdditionalPluginDirectories", []) if (up.parent / d).resolve() != PLUGINS.resolve()]
        if dirs != proj.get("AdditionalPluginDirectories", []):
            if dirs:
                proj["AdditionalPluginDirectories"] = dirs
            else:
                proj.pop("AdditionalPluginDirectories", None)
            print("stop   looking in UnrealPlugins (none of them is on)")
    write(up, proj, dry)
    print("PLUGINS ok")
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", nargs="?", default="list", choices=["list", "on", "off"])
    ap.add_argument("names", nargs="*", help="plugins (folders in UnrealPlugins/)")
    ap.add_argument("--project", help="another project's .uproject (default: this one)")
    ap.add_argument("--link", action="store_true", help="another project uses this folder's copy instead of its own")
    ap.add_argument("--build", action="store_true", help="compile after (the editor target, or the plugins alone)")
    ap.add_argument("--dry", action="store_true", help="say what would change, change nothing")
    a = ap.parse_args()
    up = Path(a.project).expanduser().resolve() if a.project else next(iter(sorted(ROOT.glob("*.uproject"))), None)
    if not up or not up.is_file():
        sys.exit(f"no .uproject at {a.project or ROOT}")
    if a.cmd == "list":
        return cmd_list(up)
    if not a.names:
        sys.exit(f"which? {', '.join(ours())}")
    sys.exit(cmd_on(up, a.names, a.link, a.build, a.dry) if a.cmd == "on" else cmd_off(up, a.names, a.dry))


if __name__ == "__main__":
    main()
