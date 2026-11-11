"""The Exports folder (DECISIONS 2026-11-03, night: "have an exports folder with sub folders for each to get exported to
by default so I can drag and drop them into my Godot project"): what the studio's editors make for a Godot project
built by hand, without the Director, each in a folder of its own to drag into the project's FileSystem dock.

    Exports/interiors/<name>/<name>.glb     the scene builder's Export for Godot: a level (a game's or a set's)
    Exports/streets/<name>/<name>.glb       the street builder's Export for Godot (street.py, streetexport.mjs)
    Exports/characters/<name>/<name>.glb    the Character Studio's Export for Godot: the character, MHR's face shapes baked

Each folder gets a README.txt saying what's in the .glb and what to do with it in Godot (guides/godot_by_hand). Nothing
under Exports/ is tracked but its READMEs (.gitignore there) and the ready-made exports (READY_MADE: tutorial v2's hotel
floor, so the tutorial can start in Godot): what's exported is made again from the studio's files. A name starting with
_ is a check's scratch one (_studiotest, a page test's street): it goes to Saved/Exports/ instead."""
import hashlib
import json
import re
import struct
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
EXPORTS = ROOT / "Exports"
KINDS = ("interiors", "streets", "characters")
NAME = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_\-]{0,80}$")
SCRATCH = ROOT / "Saved" / "Exports"         # a name starting with _ is a check's scratch one: its export goes here instead

HOW = {
    "interiors": """{name}.glb: the level {what} as the scene builder shows it, made for a Godot 4 project built by hand.

Drag this folder into your project's FileSystem dock, then drag {name}.glb into a scene (or double-click it and
choose New Inherited Scene to make it your own). Y is up, a unit is a metre, the level sits where the desk has it.

Inside it:
  visual/        every room's walls, floors, ceilings, trim and things, each piece a node by its id, with its
                 materials (the PBR sets it wears, at their real size)
  doors/         each door its own node, its origin on the hinge: turn it about Y to open it (its collider goes with it);
                 a locked one's metadata says what opens it (locked_by: an item's name, or flag:<name>)
  collision/     the walls, floors, ceilings and things you'd bump into, one *-colonly mesh a room: Godot makes each a
                 StaticBody3D with its shape on import, so a CharacterBody3D walks on the floors and stops at the walls
  occluders/     the walls, floors and ceilings as *-occonly boxes: Godot's occlusion culling (turn it on in Project
                 Settings > Rendering > Occlusion Culling > Use Occlusion Culling)
  lights/        the level's lamps (OmniLight3D, SpotLight3D): delete them to light it all by hand
  markers/       player_start, every spot (spot_<id>) and trigger area (trigger_<id>) as empty nodes, their -Z
                 their facing, what they are in their metadata; a room's trigger_<room>__volume also its floor's
                 kind and the sets on its floor, walls and ceiling (the starter kit's sound and footsteps read them)
{outside}
The HorrorStudio Look plugin (GodotPlugins/HorrorStudioLook) gives it the studio's look: guides/godot_by_hand.
""",
    "streets": """{name}.glb: the street {what} from the street builder, made for a Godot 4 project built by hand.

Drag this folder into your project's FileSystem dock, then drag {name}.glb into a scene. Y is up, a unit is a metre.

Inside it:
  visual/        the street in chunks of 48 m, a mesh a material
  collision/     the roads', pavements' and ground's surfaces to walk on and a box a building, fence or thing: Godot
                 makes each *-colonly mesh a StaticBody3D on import (the kerbs have ramps a body walks up)
  occluders/     *-occonly boxes inside the buildings: occlusion culling (Project Settings > Rendering > Occlusion
                 Culling > Use Occlusion Culling)
  lamps/         the street lamps' lights (OmniLight3D): leave them out (the lamps box in the street page) to light it
                 by hand
  insides/       where a walk-in building's level goes: inside_<building>, the set's name in its metadata. Export that
                 set from the scene builder (Export for Godot) and put its scene there
{insides}
With the HorrorStudio Look plugin (GodotPlugins/HorrorStudioLook) enabled, its road paint and decals cast no shadow
(its import step): guides/godot_by_hand.
""",
    "characters": """{name}.glb: the Character Studio's character {name}, made for a Godot 4 project built by hand.

Drag this folder into your project's FileSystem dock, then drag {name}.glb into a scene. It stands neutral (in a T or
A pose as the Studio exported it), in metres, Y up, facing +Z, on MHR's skeleton (a Skeleton3D: retarget animations
onto it with Godot's retargeting, or play the studio's Kimodo clips through the Director plugin's library).

Its blend shapes: MHR's 72 face shapes by Meta's names (jawDrop, eyesClosed_L, lipCornerPuller_R...), for expressions
and talking (an AnimationPlayer's blend shape tracks, or the face clips the Face page makes).

Its materials are its baked colours (skin, eyes, hair, clothes) as plain PBR: it looks right in any project. For the
studio's own skin, eyes and hair (the pores, the refracting eyes, the hair's two highlights, its blink) give the
character an HSCharacterLook child (the HorrorStudio Look plugin, GodotPlugins/HorrorStudioLook): it dresses it when
the game runs. guides/godot_by_hand says how.

Animal ears (the Studio's Accessories) come with bones of their own under the head, jiggle_<name>_0 ... jiggle_<name>_tip:
the same HSCharacterLook makes them flop as the character moves (its Jiggle and Jiggle amount; HSJiggle by itself on any
skeleton whose bones are named so). Without it they stand still, as made. Horns ride the head.
""",
}


def folder(kind, name):
    """Exports/<kind>/<name>/, made if it's missing"""
    if kind not in KINDS:
        raise ValueError(f"no export kind {kind}: one of {', '.join(KINDS)}")
    if not NAME.match(str(name or "")):
        raise ValueError(f"an export's name is letters, digits, _ and -: {name!r}")
    d = (SCRATCH if name.startswith("_") else EXPORTS) / kind / name
    d.mkdir(parents=True, exist_ok=True)
    return d


def readme(kind, name, what="", outside="", insides=""):
    """the folder's README.txt: what's in it and what to do with it in Godot"""
    d = folder(kind, name)
    text = HOW[kind].format(name=name, what=what, outside=outside, insides=insides)
    (d / "README.txt").write_text(text, encoding="utf-8")
    return d / "README.txt"


def save(kind, name, fname, data, meta=None):
    """a posted file written into Exports/<kind>/<name>/ (a .glb must be one), with the folder's README and, given meta,
    `export.json` (what made it, when): the path written"""
    if Path(fname).name != fname or not NAME.match(Path(fname).stem) or Path(fname).suffix not in (".glb", ".json"):
        raise ValueError(f"an export's file is <name>.glb or .json: {fname!r}")
    if fname.endswith(".glb") and not data.startswith(b"glTF"):
        raise ValueError("not a binary glTF")
    d = folder(kind, name)
    (d / fname).write_bytes(data)
    if meta is not None:
        (d / "export.json").write_text(json.dumps(dict(meta, made=time.strftime("%Y-%m-%d %H:%M:%S"), file=fname), indent=1),
                                       encoding="utf-8")
    return d / fname


def character(name, people=ROOT / "Content" / "Studio" / "People", node="node", into=None):
    """a Character Studio export made Godot's: People/<name>/export/<name>.glb copied into Exports/characters/<name>/ (or
    `into`), MHR's 72 face shapes baked into the copy as blend shapes (tools/face_morphs.mjs, as the Director's install
    does for game/people/), its README: (the .glb's path, what the bake said)"""
    import shutil
    import subprocess
    src = people / name / "export" / f"{name}.glb"
    if not src.is_file():
        raise ValueError(f"{name} has no export yet (People/{name}/export/{name}.glb): Export it in the Character Studio first")
    d = Path(into) if into else folder("characters", name)
    d.mkdir(parents=True, exist_ok=True)
    out = d / f"{name}.glb"
    shutil.copy(src, out)
    try:
        r = subprocess.run([node, str(ROOT / "tools" / "face_morphs.mjs"), str(out)], capture_output=True, text=True, timeout=300)
        said = (r.stdout.strip().splitlines() or [r.stderr.strip()[-200:]])[-1] if r.returncode == 0 else "the face shapes weren't baked: " + (r.stdout + r.stderr)[-300:]
    except OSError as e:
        said = f"the face shapes weren't baked (node: {e})"
    if not into:
        readme("characters", name)
    return out, said


def rel(p):
    return str(Path(p).resolve().relative_to(ROOT))


# ---- the ready-made exports (DECISIONS 2026-11-11, the user: "I dont want to build the map myself for tutorial 2, can
# you pre-build it so i can just do the godot part of the tutorial") ----
# Exports the studio keeps made and tracked in git beside the READMEs (Exports/.gitignore names their files), each with
# what it's made from, so a tutorial can start in Godot. tools/godot_byhand.py `ready` makes them again (the desk's server
# running), `ready --check` (READYMADE, in check_all) says when one is older than what it's made from, and TUTORIAL2
# holds tutorial v2's to the export it makes itself.
READY_MADE = {("interiors", "hotel_floor"): "set:hotel_floor"}       # tutorial v2's floor (guides/tutorial_v2 §2)


def fingerprint(game):
    """a story's content as a short hash: its JSON with the keys sorted, so a save that changes nothing changes nothing"""
    from . import storylib as L
    j = json.loads(Path(L.story_path(game)).read_text(encoding="utf-8"))
    return hashlib.sha1(json.dumps(j, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode("utf-8")).hexdigest()[:16]


def _num(v, k=4):
    """numbers rounded (a tenth of a millimetre), -0 as 0, inside lists and dicts too"""
    if v is None or isinstance(v, (bool, str)):
        return v
    if isinstance(v, (int, float)):
        return round(float(v), k) + 0.0
    if isinstance(v, list):
        return [_num(x, k) for x in v]
    if isinstance(v, dict):
        return {key: _num(x, k) for key, x in v.items()}
    return v


def signature(path):
    """what a .glb holds, its pictures' pixels aside (a browser's PNG bytes aren't the same from one machine to the next):
    every node by its path, with its place, its extras, its light and its mesh (each primitive's attributes, its vertex and
    index counts and bounds, its material's factors, extras and maps, each map's picture's size). Two exports with one
    signature give Godot the same nodes, shapes, materials and metadata. -> (a short hash, {node path: what})"""
    b = Path(path).read_bytes()
    if b[:4] != b"glTF":
        raise ValueError(f"{path}: not a binary glTF")
    n = struct.unpack_from("<I", b, 12)[0]
    j, binary = json.loads(b[20:20 + n]), b[20 + n + 8:]
    views, acc = j.get("bufferViews", []), j.get("accessors", [])
    lights = (j.get("extensions") or {}).get("KHR_lights_punctual", {}).get("lights", [])

    def picture(i):                                    # a map's picture: a PNG's width and height, from its header
        im = j["images"][i]
        if "bufferView" not in im:
            return im.get("uri", "")
        v = views[im["bufferView"]]
        data = binary[v.get("byteOffset", 0):v.get("byteOffset", 0) + 24]
        return list(struct.unpack(">II", data[16:24])) if data[:8] == b"\x89PNG\r\n\x1a\n" else im.get("mimeType", "")

    def texture(t):
        src = j["textures"][t["index"]].get("source")
        return dict({k: _num(t[k]) for k in ("scale", "strength") if k in t}, picture=None if src is None else picture(src),
                    uv=t.get("texCoord", 0))

    def material(i):
        if i is None:
            return None
        m = j["materials"][i]
        out = {k: _num(v) for k, v in m.items() if not k.endswith("Texture") and k != "pbrMetallicRoughness"}
        for k, v in m.get("pbrMetallicRoughness", {}).items():
            out[k] = texture(v) if k.endswith("Texture") else _num(v)
        for k in ("normalTexture", "occlusionTexture", "emissiveTexture"):
            if k in m:
                out[k] = texture(m[k])
        return out

    def mesh(i):
        prims = []
        for p in j["meshes"][i]["primitives"]:
            pos = acc[p["attributes"]["POSITION"]]
            prims.append({"mode": p.get("mode", 4), "attributes": sorted(p["attributes"]), "vertices": pos["count"],
                          "indices": acc[p["indices"]]["count"] if "indices" in p else None,
                          "box": _num([pos.get("min"), pos.get("max")], 3), "material": material(p.get("material")),
                          "extras": _num(p.get("extras")), "targets": len(p.get("targets", []))})
        return {"primitives": prims, "extras": _num(j["meshes"][i].get("extras"))}

    nodes, out = j.get("nodes", []), {}

    def walk(i, parent):
        nd = nodes[i]
        path = (parent + "/" if parent else "") + nd.get("name", f"#{i}")
        while path in out:                             # two of one name under one parent (Godot numbers them)
            path += "+"
        what = {k: _num(nd[k]) for k in ("matrix", "translation", "rotation", "scale", "extras") if k in nd}
        light = (nd.get("extensions") or {}).get("KHR_lights_punctual", {}).get("light")
        if light is not None:
            what["light"] = _num(lights[light], 3)
        if "mesh" in nd:
            what["mesh"] = mesh(nd["mesh"])
        out[path] = what
        for c in nd.get("children", []):
            walk(c, path)

    for r in j.get("scenes", [{}])[j.get("scene", 0)].get("nodes", []):
        walk(r, "")
    return hashlib.sha1(json.dumps(out, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()[:16], out


def differ(a, b, names=("the first", "the second"), most=4):
    """how two signatures' nodes differ, in words: those only in a, only in b, and changed (a few of each named)"""
    only_a, only_b = [p for p in a if p not in b], [p for p in b if p not in a]
    changed = [p for p in a if p in b and a[p] != b[p]]
    said = [f"{len(xs)} {what} ({', '.join(x.split('/')[-1] for x in xs[:most])}{'...' if len(xs) > most else ''})"
            for xs, what in ((only_a, "only in " + names[0]), (only_b, "only in " + names[1]), (changed, "changed")) if xs]
    return "; ".join(said) or "the same"
