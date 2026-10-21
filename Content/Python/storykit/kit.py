"""The kit (docs/KIT.md): room things made from a few numbers (floors of tiles or planks with real gaps, cabinets,
switch plates, window frames, curtains...). A prop carries one as `kit`: a preset's name or {type | preset, size,
...params}. The meshes are made by tools/director/kit.js (the pages draw them; `node tools/kit/build.mjs` writes them
for Unreal as library meshes kit/<type>_<hash>.glb). This side, plain Python like the rest of storykit, only needs a
spec's size and its mesh ref: the size is in the spec (or its preset), the ref is the hash of the resolved spec,
written the same way as kit.js's canon()."""
import hashlib
import json

from . import storylib as L

PRESETS_FILE = L.STUDIO / "Kit" / "presets.json"
META = {"label", "cat", "mount", "z", "note", "user"}
SURFACE = {"tiles", "planks", "tatami", "rug", "bulkhead"}     # lie on a floor or under a ceiling: walked over, not bumped
# a kit door's assembly (plan.py): the leaf, its handle and its frame. The same defaults as TYPES.door in kit.js
# (tools/kit/check.mjs compares them)
DOOR = {"leaf_t": 0.04, "lining": 0.02, "gap": 0.003, "floor_gap": 0.008, "handle": "lever_round", "handle_z": 0.95,
        "handle_in": 0.065, "frame": "door_frame", "hinge": "left", "style": "panels"}
_cache = {}


def presets_file():
    m = PRESETS_FILE.stat().st_mtime if PRESETS_FILE.exists() else 0
    if _cache.get("mtime") != m:
        _cache["mtime"] = m
        _cache["data"] = json.loads(PRESETS_FILE.read_text(encoding="utf-8")) if m else {"version": 1, "presets": {}}
    return _cache["data"]


def presets():
    return presets_file().get("presets", {})


def resolve(spec):
    """A spec with its preset merged under it (top-level keys; the preset's label, cat, mount and z left out)."""
    if isinstance(spec, str):
        spec = {"preset": spec}
    if not isinstance(spec, dict):
        raise ValueError("kit must be a preset name or an object")
    out = {}
    if spec.get("preset"):
        p = presets().get(spec["preset"])
        if p is None:
            raise ValueError(f"no kit preset {spec['preset']!r} (Content/Studio/Kit/presets.json)")
        out.update({k: json.loads(json.dumps(v)) for k, v in p.items() if k not in META})
    out.update({k: v for k, v in spec.items() if k != "preset" and k not in META})
    if not out.get("type"):
        raise ValueError("kit needs a type or a preset")
    return out


def size(spec):
    """(w, d, h) in metres: the box the thing fills."""
    s = resolve(spec).get("size")
    if not (isinstance(s, list) and len(s) == 3 and all(isinstance(v, (int, float)) and v > 0 for v in s)):
        raise ValueError("kit needs a size [w, d, h] of positive numbers")
    return tuple(float(v) for v in s)


def kind(spec):
    return resolve(spec)["type"]


def canon(v):
    """kit.js canon(): numbers as whole micrometres, keys sorted, no spaces."""
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(int(_round(v * 1e6)))
    if isinstance(v, str):
        return json.dumps(v, ensure_ascii=False)
    if isinstance(v, list):
        return "[" + ",".join(canon(x) for x in v) + "]"
    return "{" + ",".join(json.dumps(k, ensure_ascii=False) + ":" + canon(v[k]) for k in sorted(v)) + "}"


def _round(x):
    """JavaScript's Math.round: halves go up."""
    import math
    return math.floor(x + 0.5)


def ref(spec):
    """The library mesh ref its mesh is written under: kit/<type>_<12 hex>."""
    r = resolve(spec)
    h = hashlib.sha1((f"v{presets_file().get('version', 1)}:" + canon(r)).encode("utf-8")).hexdigest()[:12]
    return f"kit/{r['type']}_{h}"


def specs(story, level=None):
    """Every kit mesh a story needs, once each: [{"ref", "kit"}] from the plan's pieces (props, floors, frames, and
    each door's leaf, handle and frame), for `node tools/kit/build.mjs --specs`."""
    from . import plan as P
    out = {}
    for q in P.plan(story, level):
        if q.get("kit") is not None:
            try:
                out.setdefault(ref(q["kit"]), q["kit"])
            except ValueError:
                pass
    return [{"ref": r, "kit": k} for r, k in sorted(out.items())]


def write_specs(story, path, level=None):
    import pathlib
    items = specs(story, level)
    pathlib.Path(path).parent.mkdir(parents=True, exist_ok=True)
    pathlib.Path(path).write_text(json.dumps(items), encoding="utf-8")
    return items
