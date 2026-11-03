"""The studio's CC0 asset library (docs/ASSETS.md): meshes and texture sets shared by every game, in
Content/Studio/Library/. Plain Python, no `unreal` import: the offline tools, the director and the importer all use it.

A ref is `<lib>/<name>`:
- a mesh: `basemesh/headstone_01` (The Base Mesh, 900 real-scale props), `local/<name>` (yours). Its size comes from
  Library/index/<lib>.json, so a prop can be placed by name before the file is fetched; the file is
  Library/meshes/<lib>/<name>.glb.
- a texture set: `ambientcg/Planks012`, `polyhaven/rough_plaster_brick`, `local/<name>`, in
  Library/textures/<lib>/<name>/ (albedo, normal, rough, ao, height, meta.json with `tile_m`, the metres one repeat covers).
- a set on your PBR shelf: `pbr/<category>/<name>` (storykit/pbr.py: Content/Studio/PBR/, in category folders).

LEDGER.json records where every fetched file came from (source, url, licence, date): the credits list and the proof
that each asset is CC0 when a store asks.
"""
import json
from pathlib import Path

from . import pbr as PBR
from . import storylib as L

LIB = L.STUDIO / "Library"
INDEX = LIB / "index"
MESHES = LIB / "meshes"
TEXTURES = LIB / "textures"
LEDGER = LIB / "LEDGER.json"
MAPS = ("albedo", "normal", "rough", "ao", "height", "metal", "opacity")
_cache = {}


def split(ref):
    """'basemesh/headstone_01' -> ('basemesh', 'headstone_01'); 'pbr/Wood/old_planks' -> ('pbr', 'Wood/old_planks')."""
    if str(ref).startswith("pbr/"):
        return "pbr", PBR.split_ref(ref)
    parts = str(ref).split("/")
    if len(parts) != 2 or not all(parts):
        raise ValueError(f"bad library ref {ref!r}: '<lib>/<name>', like basemesh/headstone_01 or ambientcg/Planks012")
    return parts[0], parts[1]


def mesh_index(lib):
    if lib not in _cache:
        p = INDEX / f"{lib}.json"
        _cache[lib] = json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}
    return _cache[lib]


def mesh_info(ref):
    """{'size_m': [x, y (up), z], 'tris', 'kb'} or None."""
    lib, name = split(ref)
    return mesh_index(lib).get(name)


def mesh_size(ref, scale=1.0):
    """(w, d, h) in story metres: the box the mesh fills (glTF is Y up: x wide, z deep)."""
    info = mesh_info(ref)
    if not info:
        raise ValueError(f"{ref}: not in Library/index/{split(ref)[0]}.json (`python tools/cc0.py props <word>` finds names)")
    x, y, z = info["size_m"]
    return (x * scale, z * scale, y * scale)


def mesh_file(ref):
    lib, name = split(ref)
    return MESHES / lib / f"{name}.glb"


def texture_dir(ref):
    lib, name = split(ref)
    return PBR.set_dir(ref) if lib == "pbr" else TEXTURES / lib / name


def texture_meta(ref):
    if split(ref)[0] == "pbr":
        d = texture_dir(ref)
        return PBR.meta(d) if d.is_dir() else None
    p = texture_dir(ref) / "meta.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def is_texture(ref):
    return split(ref)[0] in ("ambientcg", "polyhaven", "local", "texninja", "pbr") or texture_meta(ref) is not None


def fetched(ref, kind):
    return mesh_file(ref).exists() if kind == "mesh" else texture_meta(ref) is not None


def is_colour(v):
    """'#rrggbb': a look that's a flat colour, not a set."""
    return isinstance(v, str) and len(v) == 7 and v.startswith("#") and all(c in "0123456789abcdefABCDEF" for c in v[1:])


def looks(story):
    """Every look a story paints its levels with: [(look, where)]: a room's floor, walls, ceiling and trim, a block's
    `mat`, a kit thing's slots (`mats`), a door's (`mat` a plain one, `mats` a kit one's parts), a level's outside slots. A look is a set's ref, a colour (#rrggbb) or a tuned set (a look object, as the
    street paints with: STREET_PAINT §2; pbrmix.py makes it)."""
    out = []
    for lid, lvl in story.get("levels", {}).items():
        for sl, v in ((lvl.get("outside") or {}).get("look") or {}).items() if isinstance(lvl.get("outside"), dict) else ():
            out.append((v, f"{lid}.outside.look.{sl}"))
        for room in lvl.get("rooms", []):
            for part, v in (room.get("look") or {}).items():
                out.append((v, f"{room['id']}.look.{part}"))
            for op in room.get("openings", []):            # a door: a plain one's slab (`mat`), a kit one's parts' slots (`mats`)
                dd = op.get("door") if isinstance(op.get("door"), dict) else None
                if dd and dd.get("mat"):
                    out.append((dd["mat"], f"{dd.get('id')}.mat"))
                for slot, v in (dd.get("mats") or {}).items() if dd and isinstance(dd.get("mats"), dict) else ():
                    out.append((v, f"{dd.get('id')}.mats.{slot}"))
            for p in room.get("props", []):
                if p.get("mat"):
                    out.append((p["mat"], f"{p['id']}.mat"))
                for slot, v in (p.get("mats") or {}).items() if isinstance(p.get("mats"), dict) else ():
                    out.append((v, f"{p['id']}.mats.{slot}"))   # a kit thing's slot dressed (STORY_FORMAT §2)
    return out


def look_sets(look):
    """The sets a look paints with (a tuned one's own and its layers'); none for a colour."""
    if isinstance(look, dict):
        from . import pbrmix as MIX          # canon is plain Python; numpy only when pixels are made
        return MIX.sets_of(look)
    return [] if not isinstance(look, str) or not look or look.startswith("#") else [look]   # a colour: the check says if it's not one


def refs(story):
    """Every library ref a story uses: [(kind 'mesh' or 'texture', ref, where)]. A tuned look counts as the sets it's
    made from; a colour isn't a ref."""
    out = []
    for look, where in looks(story):
        if ".outside." in where:
            continue                          # the street builder's slots: its own check (STREET's words)
        for ref in look_sets(look):
            out.append(("texture", ref, where))
    for lid, lvl in story.get("levels", {}).items():
        for room in lvl.get("rooms", []):
            for p in room.get("props", []):
                sh = str(p.get("shape", ""))
                if sh.startswith("asset "):
                    out.append(("mesh", sh.split()[1], p["id"]))
                if p.get("art"):
                    out.append(("mesh", p["art"], f"{p['id']}.art"))
    return out


def ledger():
    return json.loads(LEDGER.read_text(encoding="utf-8")) if LEDGER.exists() else {}


def record(ref, kind, source, url, licence="CC0-1.0", **extra):
    import datetime
    d = ledger()
    d[ref] = dict(kind=kind, source=source, url=url, licence=licence, date=datetime.date.today().isoformat(), **extra)
    LIB.mkdir(parents=True, exist_ok=True)
    LEDGER.write_text(json.dumps(d, indent=1, sort_keys=True), encoding="utf-8")
