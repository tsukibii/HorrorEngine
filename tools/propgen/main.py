"""Inside Blender: tools/propgen.py runs this (`blender --background --python tools/propgen/main.py -- <args>`, or the
Blender module's Python). The commands are propgen.py's; this side makes, renders and checks."""
import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

import bpy  # noqa: E402

from propgen import build, recipes  # noqa: E402


def _args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    p = argparse.ArgumentParser(prog="propgen")
    p.add_argument("cmd")
    p.add_argument("names", nargs="*")
    p.add_argument("--out")
    p.add_argument("--formats", default="glb,fbx,obj,blend")
    p.add_argument("--set", action="append", default=[], help="key=value (dotted keys, JSON values)")
    p.add_argument("--seed", type=int)
    p.add_argument("--tex", type=int)
    p.add_argument("--as", dest="as_name")
    p.add_argument("--no-preview", action="store_true")
    p.add_argument("--gpu", action="store_true")
    p.add_argument("--samples", type=int)
    p.add_argument("--library", action="store_true")
    p.add_argument("--title", default="Props")
    p.add_argument("--cols", type=int, default=5)
    p.add_argument("--presets")
    return p.parse_args(argv)


def main():
    a = _args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    book = recipes.load(a.presets)
    out = a.out or recipes.OUT
    if a.cmd in ("make", "all"):
        names = a.names if a.cmd == "make" else [n for n in book if not a.names or recipes.resolve(book, n).get("family") in a.names]
        if not names:
            sys.exit("make: which? (python tools/propgen.py list)")
        done = []
        for n in names:
            spec = recipes.resolve(book, n, a.set, seed=a.seed, tex=a.tex)
            name = a.as_name if a.as_name and len(names) == 1 else n
            bpy.ops.wm.read_factory_settings(use_empty=True)
            rec = build.run(name, spec, out, formats=tuple(x for x in a.formats.split(",") if x), preview=not a.no_preview,
                            samples=a.samples, gpu=a.gpu)
            if a.library:
                recipes.to_library(rec, out)
            done.append(rec)
        print(f"PROPGEN made {len(done)}: " + ", ".join(f"{r['name']} ({r['tris']} tris, {r['secs']}s)" for r in done))
    elif a.cmd == "sheet":
        from propgen import stage
        names = a.names or [n for n in book if os.path.exists(os.path.join(out, n, n + "_preview.png"))]
        tiles = [(os.path.join(out, n, n + "_preview.png"), n) for n in names]
        path = os.path.join(out, "sheet.png")
        stage.sheet(tiles, path, a.title, cols=a.cols)
        print(f"PROPGEN sheet {path}")
    elif a.cmd == "check":
        from propgen import check
        check.run(book, out)
    else:
        sys.exit(f"unknown command {a.cmd}")


if __name__ == "__main__":
    # Blender's Python module can crash on its way out after the work is done: leave without its teardown
    code = 0
    try:
        main()
    except SystemExit as e:
        code = e.code if isinstance(e.code, int) else (0 if e.code is None else (print(e.code, file=sys.stderr) or 1))
    except Exception:
        import traceback
        traceback.print_exc()
        code = 1
    sys.stdout.flush()
    sys.stderr.flush()
    os._exit(code)
