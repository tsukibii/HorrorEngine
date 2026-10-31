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
    python tools/propgen.py library [names...]         made props into the library as props/<name> (no Blender):
                                                       a story places one with "shape": "asset props/<name>"
                                                       (or "art": "props/<name>" on a block), the Godot export
                                                       copies it into the game
    python tools/propgen.py pbr                        the PBR shelf's sets (assets/pbr/): a material's "pbr" names one
    python tools/propgen.py pbr-add NAME FILES...      a set onto the shelf from its maps (any names: _albedo, _diff,
                                                       _normal, _nor_gl, _rough...; or a folder or a .zip)
    python tools/propgen.py all [family...]            every recipe (or a family's)
    python tools/propgen.py sheet [names...]           a contact sheet of their previews: Saved/Props/sheet.png
    python tools/propgen.py pictures [names...]        each made prop's own pictures (logos, flourishes, stamps...)
        --out DIR                                      (from the props made there, not Saved/Props)
                                                       and parts, and what size a picture wants on each:
                                                       docs/PROPGEN_PICTURES.md
    python tools/propgen.py check                      PROPGEN: a few recipes made small and measured
    python tools/propgen.py godot [names...]           GDPROPS: the made props imported by Godot 4.7, their materials
                                                       read back, pictured (Saved/Props/_godot/godot_props.png)

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
    if argv[0] == "pbr":
        sys.path.insert(0, os.path.join(ROOT, "Content", "Python"))
        from storykit import pbr as PBR
        sets = PBR.scan(write=True)
        if not sets:
            print(f"no sets on the shelf ({PBR.ROOT}): put a set's folder or .zip there, or `propgen.py pbr-add NAME FILES...`")
        for ref, m in sets.items():
            print(f"  {ref:36s} tile {m.get('tile_m', 2.0)} m  maps: {', '.join(sorted(m['maps']))}  ({m.get('source', '')})")
        return
    if argv[0] == "pbr-add":
        sys.path.insert(0, os.path.join(ROOT, "Content", "Python"))
        from storykit import pbr as PBR
        if len(argv) < 3:
            sys.exit("pbr-add NAME FILES... (a category with a slash: Metal/brushed)")
        dst = PBR.ROOT.joinpath(*argv[1].split("/"))
        dst.mkdir(parents=True, exist_ok=True)
        for f in argv[2:]:
            if os.path.isdir(f):
                for g in os.listdir(f):
                    if os.path.splitext(g)[1].lower() in PBR.IMG:
                        shutil.copy(os.path.join(f, g), dst / g)
            else:
                shutil.copy(f, dst / os.path.basename(f))
        sets = PBR.scan(write=True)
        ref = "pbr/" + argv[1]
        m = sets.get(ref)
        if not m:
            sys.exit(f"{ref}: no colour map among those files (its name should end in albedo, diff, col, color, basecolor...)")
        print(f"PROPGEN pbr {ref}: {', '.join(sorted(m['maps']))} (tile {m.get('tile_m')} m; set it on the shelf page or in its meta.json)")
        return
    if argv[0] == "library":
        from propgen import recipes
        names = argv[1:] or sorted(n for n in os.listdir(recipes.OUT) if os.path.exists(os.path.join(recipes.OUT, n, "meta.json")))
        for n in names:
            mp = os.path.join(recipes.OUT, n, "meta.json")
            if not os.path.exists(mp):
                sys.exit(f"{n}: not made yet (python tools/propgen.py make {n})")
            recipes.to_library(json.load(open(mp, encoding="utf-8")), recipes.OUT)
        print(f"PROPGEN library: {len(names)} in Content/Studio/Library as props/<name>")
        return
    if argv[0] == "pictures":
        from propgen import recipes, sizes
        args, src = argv[1:], recipes.OUT
        if "--out" in args:
            i = args.index("--out")
            src = args[i + 1]
            del args[i:i + 2]
        out = os.path.join(ROOT, "docs", "PROPGEN_PICTURES.md")
        n = sizes.write_doc(src, out, args or None)
        print(f"PROPGEN pictures: {n} made props' pictures and parts, and the size each wants, in {os.path.relpath(out, ROOT)}")
        return
    if argv[0] == "godot":
        from propgen import godot_check
        sys.exit(godot_check.main(argv[1:]))
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
