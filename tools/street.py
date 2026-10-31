#!/usr/bin/env python3
"""The street builder's streets from the command line (docs/STREET_BUILDER.md): the outside world the enterable
buildings go into, kept in Content/Studio/Streets/<name>/street.json (the page: tools/director/street.html).

    python tools/street.py list                  every street: what it holds
    python tools/street.py show <name>           one street as text (instead of reading its JSON)
    python tools/street.py new <name>            a new street with one road, to open in the page
    python tools/street.py check [--street N]    STREET: every style, part, thing and fence builds; every street is
                                                 well formed; its shots' pins land on their photos (runs node)
    python tools/street.py shot <name> [shot]    the street drawn through a shot (and beside its photo), into
                                                 Saved/Streets/<name>/ (the desk's server running; runs node)

  In Blender (docs/STREET_TEXTURING.md; Blender on the PATH, --blender PATH, or `python tools/retarget.py setup`):
    python tools/street.py look <name> [--shot ID|all] [--samples 64] [--height 900] [--density 24] [--reuse-wear]
                                                 the street's .glb in Blender with procedural finishes (its
                                                 finish.json) and its wear atlas, rendered through its shot(s)
                                                 beside the photo: Saved/Streets/<name>/blender/
    python tools/street.py bake <name> [...] [--tile-px 1024] [--godot]
                                                 the look, the finishes baked onto the PBR shelf as tileable sets,
                                                 every material made plain glTF, <name>.glb (drop it into Godot:
                                                 colliders kept) and <name>.blend; --godot: pictured in Godot too
    python tools/street.py finishes [names...] [--tile-px 1024]
                                                 the procedural finishes onto the shelf (assets/pbr/Procedural)
    python tools/street.py decals [--force]        the decals made from code (assets/decals: posters, streaks, oil...)
    python tools/street.py library [names...] [--tile-px 1024] [--force]
                                                 the material library (Japanese exterior finishes, library.py) onto
                                                 the shelf, each with its lit picture for the paint page
    python tools/street.py bake-check [--street N] [--godot]
                                                 STREETBAKE: a street baked small on a scratch shelf, read back
"""
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STREETS = ROOT / "Content" / "Studio" / "Streets"


def streets():
    return sorted(d.name for d in STREETS.iterdir() if (d / "street.json").is_file()) if STREETS.is_dir() else []


def load(name):
    f = STREETS / name / "street.json"
    if not f.is_file():
        sys.exit(f"no street called {name} (python tools/street.py list)")
    return json.loads(f.read_text(encoding="utf-8"))


def node(args):
    exe = shutil.which("node")
    if not exe:
        print("warning: the street check needs Node.js (https://nodejs.org); skipped")
        print("STREET ok (skipped: no node)")
        return 0
    return subprocess.run([exe] + args, cwd=ROOT).returncode


def show(name):
    S = load(name)
    print(f"{name}: {S.get('about', '')}".rstrip(": "))
    print(f"time {S.get('time', 'dusk')}; look {S.get('look') or '-'}")
    for r in S.get("roads", []):
        w = r.get("walks", [0, 0])
        print(f"  road {r['id']}: {r['from']} -> {r['to']}, {r.get('width', 6)} m wide, walks {w}, marks {[m.get('text', m['kind']) for m in r.get('marks', [])]}")
    for b in S.get("buildings", []):
        parts = {}
        for p in b.get("parts", []):
            parts[p["kind"]] = parts.get(p["kind"], 0) + 1
        roof = (b.get("roof") or {}).get("kind", "flat")
        print(f"  building {b['id']} ({b.get('style', '-')}): at {b['at']} turned {b.get('turn', 0)}, {b['w']} x {b['d']} m, {b['floors']} floors, "
              f"roof {roof}{', parts ' + str(parts) if parts else ''}{', photos ' + str(sorted(b['refs'])) if b.get('refs') else ''}")
    kinds = {}
    for t in S.get("things", []):
        kinds.setdefault(t["kind"], []).append(t["id"])
    for k, ids in sorted(kinds.items()):
        print(f"  {k} x{len(ids)}: {', '.join(ids[:8])}{' ...' if len(ids) > 8 else ''}")
    for f in S.get("fences", []):
        print(f"  fence {f['id']} ({f['kind']}): {f['from']} -> {f['to']}, {f.get('h', '-')} m")
    for s in S.get("shots", []):
        print(f"  shot {s['id']} '{s.get('name', '')}': eye {s['eye']} looking at {s['look']}, {s.get('vfov')} deg tall, frame {s.get('aspect')}, "
              f"photo {s.get('ref', '-')}, {len(s.get('pins', []))} pins")


def new(name):
    import re
    if not re.fullmatch(r"[a-z][a-z0-9_]{0,40}", name):
        sys.exit("a street's name is small letters, digits and _, starting with a letter")
    f = STREETS / name / "street.json"
    if f.exists():
        sys.exit(f"there's already a street called {name}")
    f.parent.mkdir(parents=True, exist_ok=True)
    street = {"format": 1, "name": name, "about": "", "time": "dusk", "look": {},
              "roads": [{"id": "road1", "from": [0, -30], "to": [0, 30], "width": 6, "walks": [2, 2], "kerb": 0.15, "edge": [0, 0], "centre": "dashed", "marks": []}],
              "buildings": [], "things": [], "fences": [], "shots": []}
    f.write_text(json.dumps(street, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {f.relative_to(ROOT)}: open http://127.0.0.1:8780/street.html?street={name}")


def main(argv):
    cmd = argv[0] if argv else "list"
    if cmd == "list":
        for n in streets():
            S = load(n)
            print(f"{n:<24} {len(S.get('roads', []))} roads, {len(S.get('buildings', []))} buildings, {len(S.get('things', []))} things, "
                  f"{len(S.get('fences', []))} fences, {len(S.get('shots', []))} shots")
        return 0
    if cmd == "show" and len(argv) > 1:
        show(argv[1])
        return 0
    if cmd == "new" and len(argv) > 1:
        new(argv[1])
        return 0
    if cmd == "check":
        return node([str(ROOT / "tools" / "director" / "streetcheck.mjs")] + argv[1:])
    if cmd == "decals":
        sys.path.insert(0, str(ROOT / "tools"))
        from streetbake import decals as dec  # noqa: PLC0415
        dec.ensure("--force" in argv)
        return 0
    if cmd == "library":
        sys.path.insert(0, str(ROOT / "tools"))
        from streetbake import cli as lcli  # noqa: PLC0415
        return lcli.library(argv[1:])
    if cmd in ("look", "bake", "finishes", "bake-check"):
        sys.path.insert(0, str(ROOT / "tools"))
        from streetbake import cli
        rest = argv[1:]
        return cli.look_or_bake(cmd, rest) if cmd in ("look", "bake") else cli.finishes(rest) if cmd == "finishes" else cli.bake_check(rest)
    if cmd == "shot" and len(argv) > 1:
        return node([str(ROOT / "tools" / "director" / "streetshot.mjs"), "--street", argv[1], "--shot", argv[2] if len(argv) > 2 else "photo"])
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
