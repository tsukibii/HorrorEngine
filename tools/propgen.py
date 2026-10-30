#!/usr/bin/env python3
"""The prop generator: small props made from a recipe by Python in Blender, the way the Free Street Litter Sampler's
were (docs/PROPGEN.md): a shape turned, folded, cut or simulated from real measurements, crushed, crumpled or dented
by code, its label drawn by code (shapes, patterns, text in a font), the detail baked onto a game mesh, worn, and
exported. No image or 3D generator anywhere.

    python tools/propgen.py list                       the recipes (Content/Studio/Props/presets.json)
    python tools/propgen.py make soda_can [more...]    each into Saved/Props/<name>/: .glb .fbx .obj .blend, its
                                                       textures (albedo, ORM, normal), a preview and meta.json
        --set crush.amount=0.9 --set art.brand=HANA    change anything in the recipe (JSON values)
        --seed 7 --as hana_crushed                     another roll of the dice, under another name
        --formats glb --tex 2048 --no-preview          less or more of it
        --library                                      also into the library as props/<name>: a story places it
                                                       with "shape": "asset props/<name>"
    python tools/propgen.py all [family...]            every recipe (or a family's)
    python tools/propgen.py sheet [names...]           a contact sheet of their previews: Saved/Props/sheet.png
    python tools/propgen.py check                      PROPGEN: a few recipes made small and measured

Blender: --blender PATH, $BLENDER, `blender` on the PATH, or Blender's Python module (python tools/retarget.py
setup, the cloud's way). Cycles uses the graphics card when it finds one (--cpu not to).
"""
import json
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN = os.path.join(ROOT, "tools", "propgen", "main.py")
ENV_FILE = os.path.join(ROOT, "setup", "env.json")
sys.path.insert(0, os.path.join(ROOT, "tools"))


def find_blender(argv):
    """(kind, path): 'exe' a Blender to run in the background, or 'module' a Python with bpy."""
    if "--blender" in argv:
        i = argv.index("--blender")
        p = argv[i + 1]
        del argv[i:i + 2]
        return "exe", p
    if os.environ.get("BLENDER"):
        return "exe", os.environ["BLENDER"]
    if "--module" not in argv:
        exe = shutil.which("blender")
        if exe:
            return "exe", exe
    else:
        argv.remove("--module")
    home = None
    if os.path.exists(ENV_FILE):
        home = (json.load(open(ENV_FILE, encoding="utf-8")).get("blender") or {}).get("home")
    home = home or os.path.join(ROOT, "vendor", "blender")
    py = os.path.join(home, ".venv", "Scripts" if os.name == "nt" else "bin", "python.exe" if os.name == "nt" else "python")
    if os.path.exists(py):
        return "module", py
    sys.exit("no Blender: install it (blender on the PATH), pass --blender PATH, or `python tools/retarget.py setup` "
             "for Blender's Python module")


def cmd_list():
    from propgen import recipes
    book = recipes.load()
    fams = {}
    for n, r in book.items():
        spec = recipes.resolve(book, n)
        fams.setdefault(spec.get("family", "?"), []).append((n, spec.get("label", "")))
    for f, items in sorted(fams.items()):
        print(f"{f}:")
        for n, label in items:
            print(f"  {n:28s} {label}")


def main():
    argv = sys.argv[1:]
    if not argv or argv[0] in ("-h", "--help", "help"):
        print(__doc__)
        return
    if argv[0] == "list":
        cmd_list()
        return
    cpu = "--cpu" in argv
    if cpu:
        argv.remove("--cpu")
    elif "--gpu" not in argv:
        argv.append("--gpu")
    kind, path = find_blender(argv)
    if kind == "exe":
        cmd = [path, "--background", "--factory-startup", "--python-exit-code", "1", "--python", MAIN, "--"] + argv
    else:
        cmd = [path, MAIN, "--"] + argv
    r = subprocess.run(cmd)
    sys.exit(r.returncode)


if __name__ == "__main__":
    main()
