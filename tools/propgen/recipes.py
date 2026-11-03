"""The recipes: Content/Studio/Props/presets.json, a recipe a prop ({"family": "can", "art": {...}, "crush": {...}}),
one starting from another with `from` (only what differs written down). Plain Python: the command reads them outside
Blender too. Made props go to Saved/Props/<name>/; `--library` also puts the game mesh in the CC0 library as
`props/<name>` (Content/Studio/Library/meshes/props/, its size in index/props.json, its line in LEDGER.json: ours), so a
story can place it with `shape: "asset props/<name>"`."""
import copy
import datetime
import json
import os
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
PRESETS = os.path.join(ROOT, "Content", "Studio", "Props", "presets.json")
OUT = os.path.join(ROOT, "Saved", "Props")
LIB = os.path.join(ROOT, "Content", "Studio", "Library")


def load(path=None):
    with open(path or PRESETS, encoding="utf-8") as fh:
        book = json.load(fh)
    return {k: v for k, v in book.items() if not k.startswith("_")}


def save(book, path=None, note=None):
    """The recipes back to their file, a block a recipe (its keys a line each where they're long), the note first."""
    with open(path or PRESETS, encoding="utf-8") as fh:
        old = json.load(fh)
    note = note or old.get("_note", "")
    out = ["{", f' "_note": {json.dumps(note, ensure_ascii=False)},']
    names = list(book)
    for i, n in enumerate(names):
        r = book[n]
        parts = [f"{json.dumps(k, ensure_ascii=False)}: {json.dumps(v, ensure_ascii=False)}" for k, v in r.items()]
        lines, cur = [], ""
        for prt in parts:
            if cur and len(cur) + len(prt) + 2 > 118:
                lines.append(cur + ",")
                cur = prt
            else:
                cur = f"{cur}, {prt}" if cur else prt
        lines.append(cur)
        body = ("\n   ".join(lines))
        out.append(f' {json.dumps(n)}: {{{body}}}' + ("," if i < len(names) - 1 else ""))
    out.append("}")
    with open(path or PRESETS, "w", encoding="utf-8") as fh:
        fh.write("\n".join(out) + "\n")


def _merge(a, b):
    out = copy.deepcopy(a)
    for k, v in b.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _merge(out[k], v)
        else:
            out[k] = copy.deepcopy(v)
    return out


def resolve(book, name, sets=(), seed=None, tex=None):
    """A recipe with what it comes `from` merged under it, then `--set key.sub=value` (JSON values) over it."""
    if name not in book:
        raise SystemExit(f"no recipe {name!r} (python tools/propgen.py list)")
    seen, chain = set(), []
    n = name
    while n:
        if n in seen:
            raise SystemExit(f"{name}: 'from' goes round in a circle at {n}")
        seen.add(n)
        r = book[n]
        chain.append(r)
        n = r.get("from")
    spec = {}
    for r in reversed(chain):
        spec = _merge(spec, {k: v for k, v in r.items() if k != "from"})
    for s in sets or ():
        key, _, val = s.partition("=")
        try:
            v = json.loads(val)
        except ValueError:
            v = val
        d = spec
        parts = key.split(".")
        for p in parts[:-1]:
            d = d.setdefault(p, {})
        d[parts[-1]] = v
    if seed is not None:
        spec["seed"] = seed
    if tex:
        spec["tex"] = tex
    return spec


def to_library(rec, out):
    """The made prop's game mesh into the library as props/<name>, its size and triangles in the index, its ledger line."""
    name = rec["name"]
    src = os.path.join(out, name, name + ".glb")
    dst_dir = os.path.join(LIB, "meshes", "props")
    os.makedirs(dst_dir, exist_ok=True)
    shutil.copyfile(src, os.path.join(dst_dir, name + ".glb"))
    ip = os.path.join(LIB, "index", "props.json")
    index = json.load(open(ip, encoding="utf-8")) if os.path.exists(ip) else {}
    x, y, z = rec["size_m"]                       # Blender's x, y, z (z up) -> the index's glTF x, y (up), z
    index[name] = {"kb": os.path.getsize(src) // 1024, "size_m": [x, z, y], "tris": rec["tris"]}
    with open(ip, "w", encoding="utf-8") as fh:
        json.dump(dict(sorted(index.items())), fh, indent=1)
    lp = os.path.join(LIB, "LEDGER.json")
    ledger = json.load(open(lp, encoding="utf-8")) if os.path.exists(lp) else {}
    ledger[f"props/{name}"] = {"date": datetime.date.today().isoformat(), "kind": "mesh", "licence": "ours",
                               "source": f"ours: tools/propgen.py, recipe {name} (Content/Studio/Props/presets.json)"}
    with open(lp, "w", encoding="utf-8") as fh:
        json.dump(ledger, fh, indent=1, sort_keys=True)
    print(f"  {name}: in the library as props/{name}")
