"""story.json -> a Godot 4.7 project (docs/GODOT_EXPORT.md): plain Python, no engine running. One project per game,
written as text (`.tscn` scenes, `project.godot`) plus the story's data and the runtime add-on copied in, so the user
opens it in Godot (Mono or standard: it's GDScript) and keeps working in it.

    python tools/godot_export.py --game Pilot [--out DIR] [--zip]

What's written (parity first, GODOT_EXPORT §3 is the shape to reach):
  project.godot                        Forward+, the title, the main scene (the add-on's), GDScript only
  addons/horrorstudio/                 the runtime (tools/godot/addons/horrorstudio, copied)
  addons/horrorstudio_look/            the look plugin (GodotPlugins/HorrorStudioLook, copied: UltraVHS, the realism
                                       preset, puffs, rain, wet floors, blood, wet skin; docs/GODOT_LOOK.md)
  HumanShaders/                        GodotPlugins/HumanShaders (copied; its own files refer to res://HumanShaders/)
  game/story.json                      the story as data (the runtime reads it: flow, stitches, scenes, items...)
  game/people/<name>.glb               the cast's Character Studio exports (previs_body "people/<name>"), for HSSkin
  game/textures/<set>/                 the texture sets the rooms' `look` and the props' `mat` name (the PBR shelf, the
                                       library): world-aligned triplanar StandardMaterial3Ds, M_StudioSurface's part
  game/lives.json                      the little things' lives (Content/Studio/Life/lives.json)
  game/levels/<level>.tscn             each level: plan.py's pieces as nodes (StaticBody3D blocks with a mesh and a
                                       collision shape, doors, OmniLight3D lights, Area3D triggers, Marker3D spots,
                                       cast stand-ins), every node carrying its piece as `metadata/piece` (JSON)
Coordinates: story (x east, y north, z up, metres) -> Godot (x, y up, -z), as the desk's s2t; a piece's yaw turns
it about Y by the same degrees the desk turns its mesh.
"""
import json
import math
import re
import shutil
import zipfile
from pathlib import Path

from . import kit as KIT
from . import library as LIB
from . import godot_guide as GUIDE
from . import life as LIFE
from . import plan as P
from . import storylib as L

ROOT = L.ROOT
ADDON = ROOT / "tools" / "godot" / "addons" / "horrorstudio"
HUMAN = ROOT / "GodotPlugins" / "HumanShaders"
LOOK = ROOT / "GodotPlugins" / "HorrorStudioLook" / "addons" / "horrorstudio_look"
LIVES = L.STUDIO / "Life" / "lives.json"
OUT = ROOT / "Saved" / "Godot"

# the desk's stage materials (stage.js setWorld): colour, roughness, [metalness]
MATS = {
    "wall": (0x55524d, 0.95), "floor": (0x3a342d, 1.0), "ceiling": (0x2c2c2e, 1.0), "door": (0x5a3a20, 0.8),
    "prop": (0x5d6f86, 0.8), "use": (0x4f8a5c, 0.8), "trim": (0xcfc8b8, 0.55), "mirror": (0xb8c4cc, 0.05, 0.9),
    "screen": (0x0c0d10, 0.2), "paper": (0xb59a7a, 0.9), "white": (0xe4e2dc, 0.5), "person": (0x9a8fa8, 0.8),
    "cast": (0xc8c2b6, 0.8), "stain": (0x3a2a1a, 1.0), "glass": (0xd8e4ee, 0.05),
}
BY_TAG = {"mirror": "mirror", "tv": "screen", "poster": "paper", "calendar": "paper", "frame": "paper", "board": "white",
          "air_conditioner": "white", "light_switch": "white"}
# the desk's lights by kind: colour, strength (the stage's units: Godot energy about the same), reach (m)
LIGHTS = {"bulb": (0xffc98a, 2.2, 7), "candle": (0xffa84a, 1.0, 3.5), "lamp": (0xffd2a0, 1.6, 5), "fire": (0xff8a3a, 3, 9)}
# the time of day (stage.js TIME_LOOK): the sky, the ambient (colour, strength), the window light (colour, strength, reach)
TIME_LOOK = {
    "day": {"sky": 0xb7c6d6, "amb": (0xd6dae2, 0.65), "win": (0xeef3ff, 20, 8)},
    "dusk": {"sky": 0x2e2030, "amb": (0xa08c88, 0.32), "win": (0xffb27a, 6, 6)},
    "night": {"sky": 0x070a16, "amb": (0x7a86aa, 0.22), "win": (0x8fa8ff, 1.2, 5)},
}


def f(x):
    """A number as Godot's text writes it (short, no exponent)."""
    x = float(x)
    if abs(x) < 1e-9:
        return "0"
    s = f"{x:.5f}".rstrip("0").rstrip(".")
    return s if s not in ("-0", "") else "0"


def col(hexv, a=1.0):
    r, g, b = (hexv >> 16) & 255, (hexv >> 8) & 255, hexv & 255
    return f"Color({f(r / 255)}, {f(g / 255)}, {f(b / 255)}, {f(a)})"


def v3(x, y, z):
    return f"Vector3({f(x)}, {f(y)}, {f(z)})"


def s2g(p):
    """A story point (x east, y north, z up) as a Godot point (x, y up, -z): the desk's s2t."""
    return (p[0], p[2], -p[1])


def xform(pos, yaw=0.0):
    """Transform3D(the basis' three rows, then the origin): a turn about Y by yaw (story degrees, as the desk turns a
    mesh: Godot's rotation.y reads the same), at pos (Godot)."""
    a = math.radians(yaw)
    c, s = math.cos(a), math.sin(a)
    return f"Transform3D({f(c)}, 0, {f(s)}, 0, 1, 0, {f(-s)}, 0, {f(c)}, {f(pos[0])}, {f(pos[1])}, {f(pos[2])})"


def gstr(s):
    return json.dumps(s, ensure_ascii=False)


_NAME_BAD = re.compile(r'[.:@/"%]')


def node_name(s):
    return _NAME_BAD.sub("_", str(s)) or "x"


class Tscn:
    """A .tscn in Godot's text format (format 3): sub-resources, then nodes in tree order."""

    def __init__(self, root_name, root_type="Node3D"):
        self.subs, self.nodes, self.n = [], [], 0
        self.ext = []
        self.node(root_name, root_type, None)

    def sub(self, rtype, props):
        self.n += 1
        sid = f"{rtype}_{self.n}"
        self.subs.append((sid, rtype, props))
        return f'SubResource("{sid}")'

    def extres(self, path, rtype):
        rid = f"ext_{len(self.ext) + 1}"
        self.ext.append((rid, path, rtype))
        return f'ExtResource("{rid}")'

    def node(self, name, ntype, parent, props=None, meta=None, instance=None):
        """ntype a node type, or instance an ExtResource(...) PackedScene instanced here (ntype then ignored)."""
        p = dict(props or {})
        for k, v in (meta or {}).items():
            p[f"metadata/{k}"] = gstr(json.dumps(v, ensure_ascii=False, separators=(",", ":")))
        self.nodes.append((name, ntype if not instance else ("instance", instance), parent, p))
        return name if parent is None else (f"{parent}/{name}" if parent != "." else name)

    def text(self):
        out = [f"[gd_scene load_steps={len(self.subs) + len(self.ext) + 1} format=3]", ""]
        for rid, path, rtype in self.ext:
            out.append(f'[ext_resource type="{rtype}" path="{path}" id="{rid}"]')
        if self.ext:
            out.append("")
        for sid, rtype, props in self.subs:
            out.append(f'[sub_resource type="{rtype}" id="{sid}"]')
            for k, v in props.items():
                out.append(f"{k} = {v}")
            out.append("")
        for name, ntype, parent, props in self.nodes:
            kind = f"instance={ntype[1]}" if isinstance(ntype, tuple) else f'type="{ntype}"'
            head = f'[node name="{name}" {kind}' + (f' parent="{parent}"' if parent is not None else "") + "]"
            out.append(head)
            for k, v in props.items():
                out.append(f"{k} = {v}")
            out.append("")
        return "\n".join(out)


class LevelWriter:
    def __init__(self, story, lid, pieces, time, meshes_out=None):
        self.story, self.lid, self.pieces, self.time = story, lid, pieces, time
        self.t = Tscn(f"level_{node_name(lid)}")
        self.mats = {}
        self.names = set()
        self.meshes_out = Path(meshes_out) if meshes_out else None   # game/meshes/: the kit's and the library's glbs copied here
        self.surfaces = {}                                 # a library texture set's material, by ref (surface())
        self.surfaced = 0                                  # the pieces wearing one
        self.arts = {}                                                 # ref -> ExtResource(...), once each
        self.art_count = 0

    def art_of(self, ref):
        """The library mesh a piece shows (art:<ref>: the kit's kit/<type>_<hash>, or basemesh/<name>), copied into the
        project as game/meshes/<lib>/<name>.glb and an ext_resource; None without the file."""
        if self.meshes_out is None:
            return None
        if ref in self.arts:
            return self.arts[ref]
        src = LIB.mesh_file(ref)
        if not src.exists():
            self.arts[ref] = None
            return None
        dst = self.meshes_out / src.parent.name / src.name
        dst.parent.mkdir(parents=True, exist_ok=True)
        if not dst.exists():
            shutil.copy(src, dst)
        self.arts[ref] = self.t.extres(f"res://game/meshes/{src.parent.name}/{src.name}", "PackedScene")
        return self.arts[ref]

    def surface(self, ref):
        """A library texture set (a room's `look`, a prop's `mat`: `mat:<ref>`) as a world-aligned material, the Unreal
        side's M_StudioSurface (docs/ASSETS.md §5): its maps copied into game/textures/<set>/ (a DirectX normal's
        green flipped for Godot), tiled by the set's metres through triplanar UVs so a block's stretched UVs don't
        matter; None when the set isn't on the shelf (the block keeps its colour)."""
        if self.meshes_out is None:
            return None
        if ref in self.surfaces:
            return self.surfaces[ref]
        self.surfaces[ref] = None
        meta = LIB.texture_meta(ref)
        src = LIB.texture_dir(ref)
        if not meta or not src.is_dir() or "albedo" not in meta.get("maps", {}):
            return None
        safe = re.sub(r"[^A-Za-z0-9_]+", "_", ref)
        dst = self.meshes_out.parent / "textures" / safe
        dst.mkdir(parents=True, exist_ok=True)
        maps = meta["maps"]
        props = {}
        tile = float(meta.get("tile_m") or 2.0)
        props["uv1_triplanar"] = "true"
        props["uv1_world_triplanar"] = "true"
        props["uv1_scale"] = v3(1.0 / tile, 1.0 / tile, 1.0 / tile)
        props["texture_filter"] = "5"                      # linear with mipmaps, anisotropic
        for slot, prop in (("albedo", "albedo_texture"), ("rough", "roughness_texture"), ("ao", "ao_texture"), ("metal", "metallic_texture")):
            if slot in maps and (src / maps[slot]).exists():
                if not (dst / maps[slot]).exists():
                    shutil.copy(src / maps[slot], dst / maps[slot])
                props[prop] = self.t.extres(f"res://game/textures/{safe}/{maps[slot]}", "Texture2D")
        if "ao_texture" in props:
            props["ao_enabled"] = "true"
            props["ao_texture_channel"] = "0"
        if "roughness_texture" in props:
            props["roughness_texture_channel"] = "0"
        if "orm" in maps and "roughness_texture" not in props and (src / maps["orm"]).exists():   # a packed AO / rough / metal map
            if not (dst / maps["orm"]).exists():
                shutil.copy(src / maps["orm"], dst / maps["orm"])
            orm = self.t.extres(f"res://game/textures/{safe}/{maps['orm']}", "Texture2D")
            props.update({"ao_enabled": "true", "ao_texture": orm, "ao_texture_channel": "0", "roughness_texture": orm, "roughness_texture_channel": "1"})
        normal = maps.get("normal") or maps.get("normal_dx")
        if normal and (src / normal).exists():
            out_name = normal
            if meta.get("normal") == "dx" or "normal_dx" in maps and maps["normal_dx"] == normal:
                out_name = re.sub(r"\.(png|jpe?g)$", "", normal) + "_gl.png"
                if not (dst / out_name).exists():
                    out_name = flip_green(src / normal, dst / out_name) and out_name
            elif not (dst / out_name).exists():
                shutil.copy(src / normal, dst / out_name)
            if out_name:
                props["normal_enabled"] = "true"
                props["normal_texture"] = self.t.extres(f"res://game/textures/{safe}/{out_name}", "Texture2D")
        self.surfaces[ref] = self.t.sub("StandardMaterial3D", props)
        return self.surfaces[ref]

    def art_transform(self, p, ref):
        """Where the mesh sits in its block (the desk's kitIn and dress): a kit thing's origin is its base's centre
        (a door leaf's its hinge axis), so it goes at the block's base; a library mesh is centred and rested on the
        base, scaled evenly into the box unless the piece is `real`."""
        w, d, h = p["size"]
        if ref.startswith("kit/"):
            px = py = 0.0
            kit = p.get("kit") or ((p.get("d") or {}).get("kit") if isinstance((p.get("d") or {}).get("kit"), dict) else None)
            if p["kind"] == "door" and kit:
                r = KIT.resolve(kit)
                if r.get("style") not in ("slide", "shoji"):          # kit.js hingeAxis: the barrel's axis, in the leaf's own space
                    kr = min(0.012, max(0.003, float(r.get("barrel") or 0.013) / 2))
                    px = (1 if r.get("hinge") == "right" else -1) * (w / 2 - kr * 0.5)
                    py = -d / 2 + kr * 0.5
            return xform((px, -h / 2, -py)), 1.0                      # item (x across, y deep, z up) -> the block's (x, up, -y)
        b = glb_bounds(LIB.mesh_file(ref))
        if b is None:
            return xform((0, -h / 2, 0)), 1.0
        lo, hi = b
        size = [hi[i] - lo[i] for i in range(3)]
        k = 1.0 if "real" in p["tags"] else min([want / sz for want, sz in zip((w, h, d), size) if sz > 0.001] or [1.0])
        c = [(lo[i] + hi[i]) / 2 for i in range(3)]
        pos = (-c[0] * k, -lo[1] * k - h / 2, -c[2] * k)
        return f"Transform3D({f(k)}, 0, 0, 0, {f(k)}, 0, 0, 0, {f(k)}, {f(pos[0])}, {f(pos[1])}, {f(pos[2])})", k

    def mat(self, key, extra=None):
        k = key if not extra else key + "|" + json.dumps(extra, sort_keys=True)
        if k not in self.mats:
            c, rough, *met = MATS[key]
            props = {"albedo_color": col(c), "roughness": f(rough)}
            if met:
                props["metallic"] = f(met[0])
            if extra:
                props.update(extra)
            self.mats[k] = self.t.sub("StandardMaterial3D", props)
        return self.mats[k]

    def uname(self, pid):
        n = base = node_name(pid)
        i = 2
        while n in self.names:
            n = f"{base}_{i}"
            i += 1
        self.names.add(n)
        return n

    def piece_meta(self, p):
        d = p.get("d") or {}
        if p["kind"] in ("wall", "floor", "ceiling") or (p.get("room") and d.get("rooms") is not None):
            d = {}                                   # a room's pieces carry the room: too big, and nothing reads it
        elif p["kind"] == "mesh" and p["tags"] and any(t.startswith("trim:") for t in p["tags"]):
            d = {}
        m = {"id": p["id"], "kind": p["kind"], "shape": p.get("shape"), "size": [round(x, 4) for x in p["size"]], "room": p.get("room"),
             "yaw": round(float(p.get("yaw") or 0), 3), "tags": p["tags"], "pos": [round(x, 4) for x in p["pos"]], "d": d}
        if p.get("kit") is not None:
            m["kit"] = p["kit"]
        return m

    def block(self, p):
        w, d, h = p["size"]
        tags = p["tags"]
        hidden = "hidden" in tags
        hollow = "hollow" in tags
        use = next((t[4:] for t in tags if t.startswith("use:")), None)
        tagged = BY_TAG.get(next((t[4:] for t in tags if t.startswith("tag:")), ""))
        if p["kind"] == "mesh":
            key = "trim" if any(t.startswith("trim:") for t in tags) else tagged or ("use" if use else "prop")
        else:
            key = p["kind"]
        if use == "clean":
            key = "stain"
        name = self.uname(p["id"])
        props = {"transform": xform(s2g(p["pos"]), p.get("yaw") or 0)}
        if hidden:
            props["visible"] = "false"
        meta = {"piece": self.piece_meta(p)}
        if p["kind"] == "door":
            meta["piece"]["swing"] = self.swing(p)
        self.t.node(name, "StaticBody3D", ".", props, meta)
        if p["shape"] == "cyl":
            mesh = self.t.sub("CylinderMesh", {"top_radius": f(w / 2), "bottom_radius": f(w / 2), "height": f(h)})
            shape = self.t.sub("CylinderShape3D", {"radius": f(w / 2), "height": f(h)})
        elif p["shape"] == "sphere":
            mesh = self.t.sub("SphereMesh", {"radius": f(w / 2), "height": f(w)})
            shape = self.t.sub("SphereShape3D", {"radius": f(w / 2)})
        else:
            mesh = self.t.sub("BoxMesh", {"size": v3(w, h, d), "add_uv2": "true"})
            shape = self.t.sub("BoxShape3D", {"size": v3(w, h, d)})
        mprops = {"mesh": mesh, "material_override": self.mat(key, {"transparency": "1", "albedo_color": col(MATS["stain"][0], 0.85)} if key == "stain" else None)}
        mat_ref = next((t[4:] for t in tags if t.startswith("mat:")), None)    # a room's look or a prop's mat: the set off the shelf
        if mat_ref and key != "stain":
            surf = self.surface(mat_ref)
            if surf:
                mprops["material_override"] = surf
                self.surfaced += 1
        art = next((t[4:] for t in tags if t.startswith("art:")), None) if p["kind"] in ("mesh", "door") else None
        ext = self.art_of(art) if art else None
        if ext:                                       # the mesh in its block; the block stays, unseen, for the cursor and the walls
            mprops["visible"] = "false"
        self.t.node("mesh", "MeshInstance3D", name, mprops)
        if ext:
            xf, k = self.art_transform(p, art)
            self.t.node("art", None, name, {"transform": xf}, instance=ext)
            self.art_count += 1
        if not hollow and use != "clean":
            sprops = {"shape": shape}
            if hidden:
                sprops["disabled"] = "true"
            self.t.node("shape", "CollisionShape3D", name, sprops)

    def swing(self, p):
        """Where a door turns (stage.js swingDoor): a kit door on its hinges, a plain one on its left edge; a sliding
        one slides. pivot in the leaf's own space (x along the leaf, z through it), Godot axes."""
        d = p.get("d") or {}
        w = p["size"][0]
        slide = d.get("swing") == "slide"
        hinge = "left"
        pivot = [-w / 2, 0.0, 0.0]
        kit = p.get("kit") or (d.get("kit") if isinstance(d.get("kit"), dict) else None)
        if kit:
            hinge = kit.get("hinge", "left")
            style = kit.get("style")
            if style in ("slide", "shoji"):
                slide = True
            lw = (kit.get("size") or [w])[0]
            pivot = [(-1 if hinge != "right" else 1) * lw / 2, 0.0, 0.0]
            w = lw
        return {"pivot": pivot, "hinge": hinge, "slide": slide, "w": w, "handle_z": (kit or {}).get("handle_z"), "handle_in": (kit or {}).get("handle_in")}

    def light(self, p):
        d = p.get("d") or {}
        kind = d.get("kind") or "bulb"
        c, inten, dist = LIGHTS.get(kind, LIGHTS["bulb"])
        lit = d.get("lit") is not False
        name = self.uname(p["id"])
        self.t.node(name, "OmniLight3D", ".", {
            "transform": xform(s2g(p["pos"])), "light_color": col(c), "light_energy": f(inten if lit else 0.0),
            "omni_range": f(dist), "omni_attenuation": "1.6", "shadow_enabled": "true"},
            {"piece": self.piece_meta(p), "light": {"kind": kind, "room": p.get("room"), "flicker": float(d.get("flicker") or 0), "base": inten, "on": lit}})

    def trigger(self, p):
        w, d, h = p["size"]
        x, y, z = p["pos"]
        rv = next((t[12:] for t in p["tags"] if t.startswith("room_volume:")), None)
        name = self.uname(p["id"])
        self.t.node(name, "Area3D", ".", {"transform": xform(s2g(p["pos"])), "monitoring": "false", "monitorable": "false"},
                    {"piece": self.piece_meta(p), "trigger": {"id": rv or p["id"], "safe": bool((p.get("d") or {}).get("safe")),
                                                              "min": [round(x - w / 2, 4), round(y - d / 2, 4), round(z - h / 2, 4)],
                                                              "max": [round(x + w / 2, 4), round(y + d / 2, 4), round(z + h / 2, 4)]}})
        self.t.node("shape", "CollisionShape3D", name, {"shape": self.t.sub("BoxShape3D", {"size": v3(w, h, d)})})

    def spot(self, p, name=None):
        name = self.uname(name or p["id"])
        self.t.node(name, "Marker3D", ".", {"transform": xform(s2g(p["pos"]), p.get("yaw") or 0)}, {"piece": self.piece_meta(p)})

    def person(self, p, cast_id=None, height=None):
        w, d, h = p["size"] if not height else (0.5, 0.3, height)
        name = self.uname(p["id"])
        hidden = "hidden" in p["tags"]
        props = {"transform": xform(s2g(p["pos"]), p.get("yaw") or 0)}
        if hidden:
            props["visible"] = "false"
        meta = {"piece": self.piece_meta(p)}
        self.t.node(name, "Node3D", ".", props, meta)
        body = self.t.sub("CapsuleMesh", {"radius": f(0.2), "height": f(max(0.5, h - 0.25))})
        self.t.node("body", "MeshInstance3D", name, {"transform": xform((0, h / 2 - 0.1, 0)), "mesh": body, "material_override": self.mat("cast" if cast_id else "person")})
        head = self.t.sub("SphereMesh", {"radius": f(0.1), "height": f(0.2)})
        self.t.node("head", "MeshInstance3D", name, {"transform": xform((0, h - 0.1, 0)), "mesh": head, "material_override": self.mat("cast" if cast_id else "person")})

    def windows(self):
        """A soft light just inside every window, into the room (stage.js: Light Kit Window's sky fill), by the time."""
        look = TIME_LOOK.get(self.time) or TIME_LOOK["night"]
        wc, wk, wd = look["win"]
        for room in (self.story["levels"][self.lid].get("rooms") or []):
            for i, op in enumerate(room.get("openings") or []):
                if not op.get("window") and not (op.get("sill") or 0) > 0.05:
                    continue
                x0, y0, z0 = room["at"]
                w, d = room["size"][0], room["size"][1]
                line = {"n": ("y", y0 + d, x0, -1), "s": ("y", y0, x0, 1), "e": ("x", x0 + w, y0, -1), "w": ("x", x0, y0, 1)}.get(op["wall"])
                if not line:
                    continue
                axis, v, lo, inward = line
                along, z = lo + op["at"], z0 + (op.get("sill") or 0) + op["h"] / 2
                at = (lambda k: (along, v + inward * k, z - (0.8 if k > 1 else 0)) if axis == "y" else (v + inward * k, along, z - (0.8 if k > 1 else 0)))
                a, b = s2g(at(0.05)), s2g(at(2))
                area = op["w"] * op["h"]
                name = self.uname(f"__window_{room['id']}_{i}")
                # a spot light looks down its -Z: aim it from a at b
                dx, dy, dz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
                yaw = math.degrees(math.atan2(-dz, dx)) - 90   # the desk's yaw convention (character +Z faces rot+90)
                self.t.node(name, "SpotLight3D", ".", {
                    "transform": xform(a, yaw + 180), "light_color": col(wc), "light_energy": f(wk * area), "spot_range": f(wd),
                    "spot_angle": "63", "spot_attenuation": "1.5"}, {"window": {"room": room["id"], "area": area, "energy": wk * area}})
                if op.get("window"):                      # the pane: a quad of glass in the opening (HSGlass; the runtime rains on it)
                    pane = self.uname(f"__pane_{room['id']}_{i}")
                    quad = self.t.sub("QuadMesh", {"size": f"Vector2({f(op['w'])}, {f(op['h'])})"})
                    glass = self.mat("glass", {"transparency": "1", "albedo_color": "Color(0.85, 0.9, 0.95, 0.12)", "roughness": "0.05", "cull_mode": "2"})
                    self.t.node(pane, "MeshInstance3D", ".", {"transform": xform(s2g(at(0)), 0 if axis == "y" else 90), "mesh": quad, "material_override": glass},
                                {"pane": {"room": room["id"], "w": op["w"], "h": op["h"]}})

    def gi(self):
        """A VoxelGI per room (GODOT_PLAN §4's trial: the bounce of the room's own lights; a level-wide one misses the
        10 cm walls): its box plus a metre, 64 cells. Unbaked here (baking is the renderer's): the runtime bakes each
        once when the level loads and keeps the result in user://."""
        for room in (self.story["levels"][self.lid].get("rooms") or []):
            x0, y0, z0 = room["at"]
            w, d, h = room["size"]
            c = s2g((x0 + w / 2, y0 + d / 2, z0 + h / 2))
            self.t.node(self.uname(f"__gi_{room['id']}"), "VoxelGI", ".", {"transform": xform(c), "size": v3(w + 1.0, h + 1.0, d + 1.0), "subdiv": "0"},
                        {"gi": {"room": room["id"]}})

    def write(self):
        things = L.index(self.story)[0]
        for p in self.pieces:
            if p["level"] != self.lid:
                continue
            k = p["kind"]
            if k in ("wall", "floor", "ceiling", "door", "mesh"):
                self.block(p)
            elif k == "light":
                self.light(p)
            elif k == "trigger":
                self.trigger(p)
            elif k == "spot":
                self.spot(p)
            elif k == "start":
                self.spot(p, "__start")
            elif k == "person":
                self.person(p)
        self.gi()
        # a stand-in per cast member (the importer's cast_standins): hidden at the start; behaviours and scenes move it
        st = things.get(self.story["levels"][self.lid]["start"])
        for cid, c in (self.story.get("cast") or {}).items():
            h = float(c.get("height", 1.7))
            piece = {"id": f"cast_{cid}", "kind": "person", "level": self.lid, "room": "cast", "pos": st.pos if st else (0, 0, 0), "size": (0.5, 0.3, h),
                     "yaw": 0.0, "shape": None, "d": {}, "tags": ["story", f"cast:{cid}", "hidden", "standin"]}
            self.person(piece, cast_id=cid, height=h)
        self.windows()
        return self.t.text()


def project_godot(story):
    title = (story.get("game") or {}).get("title") or "HorrorStudio game"
    return f'''; Engine configuration file.
; Written by the director's desk (tools/godot_export.py); the game's own settings go here too.

config_version=5

[application]

config/name={gstr(title)}
run/main_scene="res://addons/horrorstudio/main.tscn"
config/features=PackedStringArray("4.7", "Forward Plus")

[display]

window/size/viewport_width=1280
window/size/viewport_height=720

[rendering]

renderer/rendering_method="forward_plus"
'''


def flip_green(src, dst):
    """A DirectX normal map (Y down) as the OpenGL one Godot reads (Y up): the green channel inverted. False without PIL."""
    try:
        from PIL import Image
    except ImportError:
        return False
    try:
        im = Image.open(src).convert("RGB")
        r, g, b = im.split()
        g = g.point(lambda v: 255 - v)
        Image.merge("RGB", (r, g, b)).save(dst)
        return True
    except (OSError, ValueError):
        return False


def glb_bounds(path):
    """A glb's bounds in its own space from its accessors' min and max, each node's transform applied: (lo, hi), or None."""
    try:
        data = Path(path).read_bytes()
        if data[:4] != b"glTF":
            return None
        n = int.from_bytes(data[12:16], "little")
        j = json.loads(data[20:20 + n].decode("utf-8"))
    except (OSError, ValueError):
        return None
    acc, meshes, nodes = j.get("accessors", []), j.get("meshes", []), j.get("nodes", [])
    lo, hi = [1e9] * 3, [-1e9] * 3

    def mul(m, v):
        return [m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]]

    def mat_of(node):
        if "matrix" in node:
            return node["matrix"]
        t, r, s = node.get("translation", [0, 0, 0]), node.get("rotation", [0, 0, 0, 1]), node.get("scale", [1, 1, 1])
        x, y, z, w = r
        R = [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w),
             2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w),
             2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y)]
        return [R[0] * s[0], R[1] * s[0], R[2] * s[0], 0, R[3] * s[1], R[4] * s[1], R[5] * s[1], 0, R[6] * s[2], R[7] * s[2], R[8] * s[2], 0, t[0], t[1], t[2], 1]

    def matmul(a, b):
        return [sum(a[k * 4 + r] * b[c * 4 + k] for k in range(4)) for c in range(4) for r in range(4)]

    def walk(i, parent):
        node = nodes[i]
        m = matmul(parent, mat_of(node))
        if "mesh" in node:
            for prim in meshes[node["mesh"]].get("primitives", []):
                a = acc[prim["attributes"]["POSITION"]]
                if "min" in a and "max" in a:
                    for cx in (a["min"][0], a["max"][0]):
                        for cy in (a["min"][1], a["max"][1]):
                            for cz in (a["min"][2], a["max"][2]):
                                v = mul(m, [cx, cy, cz])
                                for q in range(3):
                                    lo[q], hi[q] = min(lo[q], v[q]), max(hi[q], v[q])
        for c in node.get("children", []):
            walk(c, m)

    ident = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    roots = j.get("scenes", [{}])[j.get("scene", 0)].get("nodes", list(range(len(nodes))))
    for i in roots:
        walk(i, ident)
    return (lo, hi) if lo[0] < 1e8 else None


def rec_file(key):
    """a recording's key ("c3=good|c7=") as a file name's part: letters, digits, - and +"""
    return "".join(ch if (ch.isalnum() or ch in "_-") else ("-" if ch == "=" else "+" if ch == "|" else "_") for ch in key)


def godot_bin():
    """Godot 4.7 on this machine: $GODOT, godot, or godot-mono (the user's), or None."""
    import os  # noqa: PLC0415
    for c in [os.environ.get("GODOT"), "godot", "godot-mono"]:
        if c and shutil.which(c):
            return shutil.which(c)
    return None


# ---- the receipt (docs/GODOT_EXPORT.md §5): what the export wrote, so a re-export keeps what the user changed ---------
MANIFEST = Path(".desk") / "manifest.json"


def sha1_of(path):
    import hashlib  # noqa: PLC0415
    h = hashlib.sha1()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def generated_files(out):
    """Every file the export wrote, by its path in the project (the import's .godot/, Godot's own .import and .uid
    sidecars, and the receipt itself left out: they're the editor's, never stale)."""
    for fp in sorted(out.rglob("*")):
        if fp.is_file() and ".godot" not in fp.parts and fp.relative_to(out) != MANIFEST and fp.suffix not in (".import", ".uid"):
            yield fp.relative_to(out).as_posix()


def read_manifest(out):
    p = out / MANIFEST
    if not p.exists():
        return None
    try:
        m = json.loads(p.read_text(encoding="utf-8"))
        return m.get("files") if isinstance(m.get("files"), dict) else None
    except ValueError:
        return None


def write_manifest(out):
    import datetime  # noqa: PLC0415
    files = {rel: sha1_of(out / rel) for rel in generated_files(out)}
    (out / ".desk").mkdir(exist_ok=True)
    (out / MANIFEST).write_text(json.dumps({"written": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"), "files": files}, indent=1), encoding="utf-8")
    return files


def desk_name(rel):
    """The new version's name beside a file the user kept: game/levels/annex.tscn -> game/levels/annex.desk.tscn."""
    p = Path(rel)
    return (p.parent / (p.stem + ".desk" + p.suffix)).as_posix() if p.suffix else rel + ".desk"


def merge_export(new, final, old_manifest):
    """The fresh export (new) into the project the user has (final), by the last receipt: a generated file they
    changed is kept, the new one written beside it as <name>.desk.<ext>; one they left is overwritten; a stale one
    (generated last time, not this time, unchanged) goes; anything of theirs the export never wrote is untouched.
    Returns the kept files."""
    kept = []
    written = set()
    for rel in generated_files(new):
        src = new / rel
        dst = final / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        if dst.exists() and rel in old_manifest and sha1_of(dst) != old_manifest[rel]:
            beside = final / desk_name(rel)
            shutil.copy(src, beside)
            kept.append(rel)
            written.add(desk_name(rel))
        else:
            shutil.copy(src, dst)
            written.add(rel)
            if rel in old_manifest and (final / desk_name(rel)).exists():   # theirs taken back: the sibling goes
                (final / desk_name(rel)).unlink()
    for rel in old_manifest:
        if rel in written or rel in kept:
            continue
        stale = final / rel
        if stale.exists() and sha1_of(stale) == old_manifest[rel]:
            stale.unlink()
    shutil.rmtree(new)
    return kept


def rewrite_guide(out, game):
    """The guide written again for an export that's there (its pictures made since: tools/godot_export.py --pictures)."""
    out = Path(out)
    story, _path = L.load(game)
    info = json.loads((out / "game" / "export.json").read_text(encoding="utf-8"))
    GUIDE.write_guide(out, game, story, info, ROOT / "Saved" / "Story" / game / "godot_reference")
    write_manifest(out)


def import_project(out, timeout=600):
    """Godot's import of the project (its .godot/ folder): the glb meshes the levels instance load only once imported.
    The editor does it on opening the project; here so a headless run can too. Quiet when Godot isn't on the PATH."""
    import subprocess  # noqa: PLC0415
    g = godot_bin()
    if not g:
        return False
    try:
        subprocess.run([g, "--headless", "--path", str(out), "--import"], capture_output=True, text=True, timeout=timeout)
    except (subprocess.TimeoutExpired, OSError):
        return False
    return True


def export(game, out=None, make_zip=False, do_import=True):
    """The project for a game, into out (Saved/Godot/<game> by default); returns {"dir", "zip", "levels", "pieces", "arts"}.
    The kit's meshes the game needs are built first (tools/kit_build.py, when node is there) and go in with the
    library's; the project is then imported once so they load headless (do_import)."""
    story, path = L.load(game)
    pieces = P.plan(story)
    arts = 0
    surfaced = 0
    surface_sets = set()
    kit_index = {}
    try:
        import subprocess  # noqa: PLC0415
        specs = ROOT / "Saved" / "kit" / f"{game}.json"
        if KIT.write_specs(story, specs) and shutil.which("node"):
            subprocess.run([shutil.which("node"), str(ROOT / "tools" / "kit" / "build.mjs"), "--specs", str(specs)], capture_output=True, text=True, timeout=900)
    except (OSError, ValueError, subprocess.TimeoutExpired):
        pass
    final = Path(out) if out else OUT / game
    old_manifest = read_manifest(final)                   # a re-export: the receipt of the last one (§5), None the first time
    out = final.with_name(final.name + ".new") if old_manifest is not None else final
    if out.exists():
        shutil.rmtree(out)
    (out / "game" / "levels").mkdir(parents=True)
    (out / "project.godot").write_text(project_godot(story), encoding="utf-8")
    shutil.copytree(ADDON, out / "addons" / "horrorstudio", ignore=shutil.ignore_patterns(".godot", "*.uid.bak"))
    shutil.copytree(LOOK, out / "addons" / "horrorstudio_look", ignore=shutil.ignore_patterns(".godot", "*.uid.bak"))
    if HUMAN.exists():
        shutil.copytree(HUMAN, out / "HumanShaders", ignore=shutil.ignore_patterns("*.import"))
    (out / "game" / "story.json").write_text(json.dumps(story, ensure_ascii=False, indent=0), encoding="utf-8")
    people = 0                                        # the cast's Character Studio exports (previs_body / models "people/<name>"): game/people/<name>.glb
    for c in (story.get("cast") or {}).values():
        for ref in [c.get("previs_body")] + list((c.get("models") or {}).values()):
            if isinstance(ref, str) and ref.startswith("people/"):
                name = ref[7:]
                src = L.STUDIO / "People" / name / "export" / f"{name}.glb"
                if src.exists() and not (out / "game" / "people" / f"{name}.glb").exists():
                    (out / "game" / "people").mkdir(parents=True, exist_ok=True)
                    shutil.copy(src, out / "game" / "people" / f"{name}.glb")
                    people += 1
    previs = L.GAMES / game / "Previs"                 # the desk's bake (tools/godot/bake.mjs, or the desk's Generate): the scenes as recorded
    baked = 0
    if (previs / "preview.json").exists():
        pv = json.loads((previs / "preview.json").read_text(encoding="utf-8"))
        (out / "game" / "previs" / "scenes").mkdir(parents=True, exist_ok=True)
        index = {k: v for k, v in pv.items() if k != "scenes"}
        index["scenes"] = {}
        for sid, sc in pv.get("scenes", {}).items():      # the frames a file a scene; the index keeps each scene's facts
            index["scenes"][sid] = {k: v for k, v in sc.items() if k not in ("frames", "subs", "events", "lights", "recordings")}
            index["scenes"][sid]["frames"] = len(sc.get("frames", []))
            recs = sc.get("recordings") or {}             # the reply branches, a file each: <sid>__<key>.json
            index["scenes"][sid]["recordings"] = {k: rec_file(k) for k in recs}
            (out / "game" / "previs" / "scenes" / f"{sid}.json").write_text(json.dumps({k: v for k, v in sc.items() if k != "recordings"}, separators=(",", ":")), encoding="utf-8")
            for key, rec in recs.items():
                (out / "game" / "previs" / "scenes" / f"{sid}__{rec_file(key)}.json").write_text(json.dumps(rec, separators=(",", ":")), encoding="utf-8")
        (out / "game" / "previs" / "index.json").write_text(json.dumps(index, separators=(",", ":")), encoding="utf-8")
        for f in sorted(previs.glob("Body_*.glb")):
            shutil.copy(f, out / "game" / "previs" / f.name)
            baked += 1
    if LIVES.exists():
        shutil.copy(LIVES, out / "game" / "lives.json")
    lt = {}                                            # the little things with a life: {id: {life, d}} (app.js lifeThings)
    for lv in story.get("levels", {}).values():
        for r in lv.get("rooms", []):
            for p in r.get("props", []):
                lf = LIFE.life_of(p)
                if lf:
                    lt[p["id"]] = {"life": lf, "d": p}
    (out / "game" / "life_things.json").write_text(json.dumps(lt, ensure_ascii=False), encoding="utf-8")
    times = L.flow_times(story)
    levels = []
    for lid in story.get("levels", {}):
        t = (story.get("game") or {}).get("time") or L.TIME_DEFAULT
        lw = LevelWriter(story, lid, pieces, t, out / "game" / "meshes")
        (out / "game" / "levels" / f"{lid}.tscn").write_text(lw.write(), encoding="utf-8")
        levels.append(lid)
        arts += lw.art_count
        surfaced += lw.surfaced
        surface_sets.update(r for r, m in lw.surfaces.items() if m)
        for ref in lw.arts:                               # the kit things' sockets and slots (lifefx.gd), by their ref
            if ref.startswith("kit/") and LIB.mesh_info(ref):
                kit_index[ref] = LIB.mesh_info(ref)
    (out / "game" / "kit.json").write_text(json.dumps(kit_index, separators=(",", ":")), encoding="utf-8")
    sfx = ROOT / "Content" / "Studio" / "SFX"                      # the sound shelf (docs/SFX.md, CC0): every sound and its index
    if (sfx / "index.json").exists():
        shutil.copytree(sfx, out / "game" / "sfx", ignore=shutil.ignore_patterns("*.import", "__pycache__"))
    import datetime  # noqa: PLC0415
    info = {"game": game, "story": str(path), "levels": levels, "pieces": len(pieces), "arts": arts, "surfaced": surfaced, "surface_sets": sorted(surface_sets), "bake": (previs / "preview.json").exists(), "bodies": baked,
            "bodies_list": sorted(f.name[5:-4] for f in previs.glob("Body_*.glb")) if previs.exists() else [], "engine": L.engine_version(), "godot": "4.7",
            "made": datetime.datetime.now().strftime("%Y-%m-%d %H:%M")}
    kept = []
    if old_manifest is not None:                           # merged into the project the user has: theirs kept, the new beside
        kept = merge_export(out, final, old_manifest)
        out = final
    info["kept"] = kept
    (out / "game" / "export.json").write_text(json.dumps(info, indent=1), encoding="utf-8")
    GUIDE.write_guide(out, game, story, info, ROOT / "Saved" / "Story" / game / "godot_reference")   # the guide (GODOT_PLAN §7)
    (out / ".gitignore").write_text(".godot/\n", encoding="utf-8")
    write_manifest(out)
    if (arts or surfaced) and do_import:
        import_project(out)
    z = zip_project(out, game) if make_zip else None
    return {"dir": str(out), "zip": str(z) if z else None, "levels": levels, "pieces": len(pieces), "arts": arts, "kept": kept}


def zip_project(out, game):
    """The project as <game>.zip beside it (Godot's .godot/ left out): the file the desk's button hands over."""
    out = Path(out)
    z = out.parent / f"{game}.zip"
    with zipfile.ZipFile(z, "w", zipfile.ZIP_DEFLATED) as zf:
        for fp in sorted(out.rglob("*")):
            if fp.is_file() and ".godot" not in fp.parts:
                zf.write(fp, Path(game) / fp.relative_to(out))
    return z
