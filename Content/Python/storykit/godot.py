"""story.json -> a Godot 4.7 project (docs/GODOT_EXPORT.md): plain Python, no engine running. One project per game,
written as text (`.tscn` scenes, `project.godot`) plus the story's data and the runtime add-on copied in, so the user
opens it in Godot (Mono or standard: it's GDScript) and keeps working in it.

    python tools/godot_export.py --game Pilot [--out DIR] [--zip]

What's written (parity first, GODOT_EXPORT §3 is the shape to reach):
  project.godot                        Forward+, the title, the main scene (the add-on's), GDScript only
  addons/horrorstudio/                 the runtime (tools/godot/addons/horrorstudio, copied)
  HumanShaders/                        GodotPlugins/HumanShaders (copied; its own files refer to res://HumanShaders/)
  game/story.json                      the story as data (the runtime reads it: flow, stitches, scenes, items...)
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

from . import life as LIFE
from . import plan as P
from . import storylib as L

ROOT = L.ROOT
ADDON = ROOT / "tools" / "godot" / "addons" / "horrorstudio"
HUMAN = ROOT / "GodotPlugins" / "HumanShaders"
LIVES = L.STUDIO / "Life" / "lives.json"
OUT = ROOT / "Saved" / "Godot"

# the desk's stage materials (stage.js setWorld): colour, roughness, [metalness]
MATS = {
    "wall": (0x55524d, 0.95), "floor": (0x3a342d, 1.0), "ceiling": (0x2c2c2e, 1.0), "door": (0x5a3a20, 0.8),
    "prop": (0x5d6f86, 0.8), "use": (0x4f8a5c, 0.8), "trim": (0xcfc8b8, 0.55), "mirror": (0xb8c4cc, 0.05, 0.9),
    "screen": (0x0c0d10, 0.2), "paper": (0xb59a7a, 0.9), "white": (0xe4e2dc, 0.5), "person": (0x9a8fa8, 0.8),
    "cast": (0xc8c2b6, 0.8), "stain": (0x3a2a1a, 1.0),
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

    def node(self, name, ntype, parent, props=None, meta=None):
        p = dict(props or {})
        for k, v in (meta or {}).items():
            p[f"metadata/{k}"] = gstr(json.dumps(v, ensure_ascii=False, separators=(",", ":")))
        self.nodes.append((name, ntype, parent, p))
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
            head = f'[node name="{name}" type="{ntype}"' + (f' parent="{parent}"' if parent is not None else "") + "]"
            out.append(head)
            for k, v in props.items():
                out.append(f"{k} = {v}")
            out.append("")
        return "\n".join(out)


class LevelWriter:
    def __init__(self, story, lid, pieces, time):
        self.story, self.lid, self.pieces, self.time = story, lid, pieces, time
        self.t = Tscn(f"level_{node_name(lid)}")
        self.mats = {}
        self.names = set()

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
        self.t.node("mesh", "MeshInstance3D", name, mprops)
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


def export(game, out=None, make_zip=False):
    """The project for a game, into out (Saved/Godot/<game> by default); returns {"dir", "zip", "levels", "pieces"}."""
    story, path = L.load(game)
    pieces = P.plan(story)
    out = Path(out) if out else OUT / game
    if out.exists():
        shutil.rmtree(out)
    (out / "game" / "levels").mkdir(parents=True)
    (out / "project.godot").write_text(project_godot(story), encoding="utf-8")
    shutil.copytree(ADDON, out / "addons" / "horrorstudio", ignore=shutil.ignore_patterns(".godot", "*.uid.bak"))
    if HUMAN.exists():
        shutil.copytree(HUMAN, out / "HumanShaders", ignore=shutil.ignore_patterns("*.import"))
    (out / "game" / "story.json").write_text(json.dumps(story, ensure_ascii=False, indent=0), encoding="utf-8")
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
        lw = LevelWriter(story, lid, pieces, t)
        (out / "game" / "levels" / f"{lid}.tscn").write_text(lw.write(), encoding="utf-8")
        levels.append(lid)
    (out / "game" / "export.json").write_text(json.dumps({"game": game, "story": str(path), "levels": levels, "pieces": len(pieces),
                                                          "engine": L.engine_version()}, indent=1), encoding="utf-8")
    (out / ".gitignore").write_text(".godot/\n", encoding="utf-8")
    z = None
    if make_zip:
        z = out.parent / f"{game}.zip"
        with zipfile.ZipFile(z, "w", zipfile.ZIP_DEFLATED) as zf:
            for fp in sorted(out.rglob("*")):
                if fp.is_file() and ".godot" not in fp.parts:
                    zf.write(fp, Path(game) / fp.relative_to(out))
    return {"dir": str(out), "zip": str(z) if z else None, "levels": levels, "pieces": len(pieces)}
