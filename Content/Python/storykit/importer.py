"""Builds each level of a game's story.json in the editor: one map per level (/Game/Games/<Game>/Maps/L_<level>),
every story actor
tagged `story` and `story:<id>` (the StoryRunner finds things by that tag), greybox blocks until a prop has `art`.

Rerunning it deletes the actors tagged `story` in that map and builds them again, so hand edits to story actors are
lost by design: change story.json instead. Anything you place by hand without the `story` tag is kept.

In the editor's Output Log (Python):  import storykit.importer as i; i.build("Pilot")            (every level)
                                      import storykit.importer as i; i.build("Pilot", "house")
Each level also gets one hidden stand-in per cast member (tag cast:<id>): the runner moves it to a scene's stage
spot when the scene starts, and the MetaHuman replaces it later (class_map stand_in, or the cast's metahuman).
V0: written before it ever ran in an editor. SETUP.md phase S9 makes it work; fix it here, keep plan.py the maths.
"""
import json
import math

import unreal

from . import plan as P
from . import storylib as L
from . import surfaces

CLASS_MAP = L.STUDIO / "class_map.json"
GREY = "/Game/Studio/Greybox"
MESH = {"box": "/Engine/BasicShapes/Cube.Cube", "cyl": "/Engine/BasicShapes/Cylinder.Cylinder",
        "sphere": "/Engine/BasicShapes/Sphere.Sphere"}          # all 1 m across, pivot at the centre
COLOURS = {"wall": (0.55, 0.55, 0.55), "floor": (0.35, 0.33, 0.30), "ceiling": (0.45, 0.45, 0.45),
           "door": (0.45, 0.25, 0.10), "prop": (0.25, 0.45, 0.75), "use": (0.20, 0.70, 0.30), "person": (0.6, 0.2, 0.6)}
LIGHTS = {"bulb": (400, 2700, 6), "candle": (40, 1900, 3), "lamp": (250, 2600, 5), "fire": (900, 1800, 8)}  # lumens, K, m

actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
levels = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)


def to_ue(p):
    return unreal.Vector(p[0] * 100.0, -p[1] * 100.0, p[2] * 100.0)


def rot(yaw):
    return unreal.Rotator(roll=0.0, pitch=0.0, yaw=-float(yaw))


def class_map():
    try:
        return json.loads(CLASS_MAP.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}


_mats = {}


def grey(kind):
    """A tinted copy of the engine's basic shape material, one per kind of thing."""
    if kind in _mats:
        return _mats[kind]
    path = f"{GREY}/MI_{kind}"
    mi = unreal.load_asset(path) if unreal.EditorAssetLibrary.does_asset_exist(path) else None
    if mi is None:
        try:
            tools = unreal.AssetToolsHelpers.get_asset_tools()
            mi = tools.create_asset(f"MI_{kind}", GREY, unreal.MaterialInstanceConstant,
                                    unreal.MaterialInstanceConstantFactoryNew())
            unreal.MaterialEditingLibrary.set_material_instance_parent(
                mi, unreal.load_asset("/Engine/BasicShapes/BasicShapeMaterial"))
            unreal.MaterialEditingLibrary.set_material_instance_vector_parameter_value(
                mi, "Color", unreal.LinearColor(*COLOURS[kind], 1.0))
            unreal.EditorAssetLibrary.save_loaded_asset(mi)
        except Exception as e:   # noqa: BLE001 - greybox colour is a nicety
            unreal.log_warning(f"storykit: no tinted material for {kind}: {e}")
            mi = None
    _mats[kind] = mi
    return mi


def finish(actor, piece, folder):
    actor.set_actor_label(piece["id"])
    actor.set_folder_path(f"Story/{folder}")
    actor.set_editor_property("tags", [unreal.Name(t) for t in piece["tags"]])
    if "hidden" in piece["tags"]:
        actor.set_actor_hidden_in_game(True)
        actor.set_actor_enable_collision(False)
    return actor


def spawn_block(piece, colour):
    a = actors.spawn_actor_from_class(unreal.StaticMeshActor, to_ue(piece["pos"]), rot(piece["yaw"]))
    c = a.static_mesh_component
    if piece["kind"] in ("mesh", "door", "person"):
        c.set_mobility(unreal.ComponentMobility.MOVABLE)       # the runner may show, hide or move it
    # art: an asset path (/Game/...), or a library ref (basemesh/headstone_01: storykit/surfaces.py imports it once)
    art = next((t[4:] for t in piece["tags"] if t.startswith("art:")), None) if piece["kind"] == "mesh" else None
    mesh = None
    if art:
        mesh = unreal.load_asset(art) if art.startswith("/") else surfaces.mesh(art)
        if mesh is None:
            unreal.log_warning(f"storykit: {piece['id']}: art {art} not found, keeping the block")
    if mesh:
        fit_art(a, c, mesh, piece, 0.0 if art.startswith("/") else float(class_map().get("library_yaw", 0)))
    else:
        c.set_static_mesh(unreal.load_asset(MESH[piece["shape"] or "box"]))
        w, d, h = piece["size"]
        a.set_actor_scale3d(unreal.Vector(max(w, 0.01), max(d, 0.01), max(h, 0.01)))
        mat = next((t[4:] for t in piece["tags"] if t.startswith("mat:")), None)
        m = (surfaces.material(mat) if mat else None) or grey(colour)
        if m:
            c.set_material(0, m)
    return a


def fit_art(actor, comp, mesh, piece, yaw_fix=0.0):
    """Scales an art mesh uniformly into the block's box: centred on it, resting on its base. yaw_fix turns library
    meshes to face the story's way (class_map library_yaw: set once, from a screenshot of a chair)."""
    comp.set_static_mesh(mesh)
    if yaw_fix:
        actor.set_actor_rotation(rot(piece["yaw"] + yaw_fix), False)
    box = mesh.get_bounding_box()
    ext = [(box.max.x - box.min.x) / 100, (box.max.y - box.min.y) / 100, (box.max.z - box.min.z) / 100]
    want = piece["size"]
    s = min(want[i] / ext[i] for i in range(3) if ext[i] > 0.001)
    actor.set_actor_scale3d(unreal.Vector(s, s, s))
    # move so the mesh's bounds sit where the block was (centre in x, y; bottom on the base)
    cx, cy = (box.max.x + box.min.x) / 2 * s, (box.max.y + box.min.y) / 2 * s
    a = math.radians(-(piece["yaw"] + yaw_fix))
    ox, oy = cx * math.cos(a) - cy * math.sin(a), cx * math.sin(a) + cy * math.cos(a)
    base_z = (piece["pos"][2] - piece["size"][2] / 2) * 100 - box.min.z * s
    loc = to_ue(piece["pos"])
    actor.set_actor_location(unreal.Vector(loc.x - ox, loc.y - oy, base_z), False, False)


def spawn_bp(path, piece):
    cls = unreal.load_class(None, path)
    if cls is None:
        unreal.log_warning(f"storykit: class {path} not found for {piece['id']}")
        return None
    base = (piece["pos"][0], piece["pos"][1], piece["pos"][2] - piece["size"][2] / 2)
    return actors.spawn_actor_from_class(cls, to_ue(base), rot(piece["yaw"]))


def set_fields(actor, piece, fields):
    for story_field, prop in (fields or {}).items():
        if story_field in piece["d"] and prop:
            try:
                actor.set_editor_property(prop, piece["d"][story_field])
            except Exception as e:  # noqa: BLE001
                unreal.log_warning(f"storykit: {piece['id']}: couldn't set {prop}: {e}")


def spawn(piece, cmap):
    k = piece["kind"]
    if k in ("wall", "floor", "ceiling"):
        return finish(spawn_block(piece, k), piece, f"{piece['room']}/shell")
    if k == "start":
        return finish(actors.spawn_actor_from_class(unreal.PlayerStart, to_ue(piece["pos"]) + unreal.Vector(0, 0, 92),
                                                    rot(piece["yaw"])), piece, "start")
    if k == "spot":
        return finish(actors.spawn_actor_from_class(unreal.TargetPoint, to_ue(piece["pos"]), rot(piece["yaw"])),
                      piece, f"{piece['room']}/spots")
    if k == "trigger":
        a = actors.spawn_actor_from_class(unreal.TriggerBox, to_ue(piece["pos"]), rot(piece["yaw"]))
        w, d, h = piece["size"]
        a.get_component_by_class(unreal.BoxComponent).set_box_extent(unreal.Vector(w * 50, d * 50, h * 50), True)
        return finish(a, piece, f"{piece['room']}/triggers")
    if k == "light":
        d = piece["d"]
        lm, kelvin, radius = LIGHTS.get(d.get("kind", "bulb"), LIGHTS["bulb"])
        a = actors.spawn_actor_from_class(unreal.PointLight, to_ue(piece["pos"]), rot(0))
        c = a.get_component_by_class(unreal.PointLightComponent)
        c.set_mobility(unreal.ComponentMobility.MOVABLE)
        c.set_editor_property("intensity_units", unreal.LightUnits.LUMENS)
        c.set_intensity(float(d.get("lumens", lm)))
        c.set_attenuation_radius(float(d.get("radius", radius)) * 100)
        c.set_use_temperature(True)
        c.set_temperature(float(d.get("kelvin", kelvin)))
        c.set_visibility(bool(d.get("lit", True)))
        return finish(a, piece, f"{piece['room']}/lights")
    if k == "person":
        mesh_path = cmap.get("stand_in_mesh")
        mesh = unreal.load_asset(mesh_path) if mesh_path else None
        if mesh:
            a = actors.spawn_actor_from_class(unreal.SkeletalMeshActor, to_ue(piece["pos"]), rot(piece["yaw"] - 90))
            a.skeletal_mesh_component.set_skeletal_mesh_asset(mesh)
            s = piece["size"][2] / float(cmap.get("stand_in_height", 1.8))
            a.set_actor_scale3d(unreal.Vector(s, s, s))
        else:   # no mannequin: a capsule-ish block
            piece = dict(piece, shape="cyl", pos=(piece["pos"][0], piece["pos"][1], piece["pos"][2] + piece["size"][2] / 2),
                         size=(0.45, 0.45, piece["size"][2]))
            a = spawn_block(piece, "person")
        return finish(a, piece, f"{piece['room']}/people")
    use = next((t[4:] for t in piece["tags"] if t.startswith("use:")), None)
    entry = cmap.get(use or ("door" if k == "door" else ""), None)
    if isinstance(entry, dict) and entry.get("class"):
        a = spawn_bp(entry["class"], piece)
        if a:
            set_fields(a, piece, entry.get("fields"))
            if entry.get("keep_block"):
                finish(spawn_block(dict(piece, id=piece["id"] + "__block"), "use"), piece, f"{piece['room']}/props")
            return finish(a, piece, f"{piece['room']}/props")
    colour = "door" if k == "door" else ("use" if use else "prop")
    return finish(spawn_block(piece, colour), piece, f"{piece['room']}/props")


def environment(lid):
    """A dark interior's basics, rebuilt with the level: exposure held still (auto exposure undoes darkness), a
    faint sky light so unlit corners aren't pure black."""
    ppv = actors.spawn_actor_from_class(unreal.PostProcessVolume, unreal.Vector(0, 0, 0), rot(0))
    ppv.set_editor_property("unbound", True)
    try:
        s = ppv.get_editor_property("settings")
        for name, value in (("auto_exposure_min_brightness", 0.0), ("auto_exposure_max_brightness", 0.0),
                            ("auto_exposure_bias", 0.0)):
            s.set_editor_property("override_" + name, True)
            s.set_editor_property(name, value)
        ppv.set_editor_property("settings", s)
    except Exception as e:  # noqa: BLE001 - S9 tunes exposure by eye with the user
        unreal.log_warning(f"storykit: exposure not set: {e}")
    finish(ppv, {"id": f"{lid}__post", "tags": ["story", "story:post"]}, "env")
    sky = actors.spawn_actor_from_class(unreal.SkyLight, unreal.Vector(0, 0, 1000), rot(0))
    sky.light_component.set_intensity(0.05)
    finish(sky, {"id": f"{lid}__sky", "tags": ["story", "story:sky"]}, "env")


def map_path(game, lid):
    return f"/Game/Games/{game}/Maps/L_{lid}"


def open_level(game, lid):
    path = map_path(game, lid)
    if unreal.EditorAssetLibrary.does_asset_exist(path):
        levels.load_level(path)
    else:
        levels.new_level(path)
    gone = [a for a in actors.get_all_level_actors() if a.actor_has_tag("story")]
    if gone:
        actors.destroy_actors(gone)
    return path


def cast_standins(story, lid, cmap):
    """One hidden stand-in per cast member, at the level's start: the runner stages it for scenes."""
    start = None
    for room in story["levels"][lid]["rooms"]:
        for p in room.get("props", []):
            if p["id"] == story["levels"][lid]["start"]:
                start = L.room_world(room, *p["at"])
    for cid, c in story.get("cast", {}).items():
        h = float(c.get("height", 1.7))
        piece = {"id": f"cast_{cid}", "kind": "person", "level": lid, "room": "cast", "pos": start, "size": (0.5, 0.3, h),
                 "yaw": 0.0, "shape": None, "d": {}, "tags": ["story", f"cast:{cid}", "hidden", "standin"]}
        spawn(piece, cmap)


def build(game=None, level=None):
    story, spath = L.load(game)
    game = spath.parent.name
    cmap = class_map()
    for lid in story["levels"]:
        if level and lid != level:
            continue
        path = open_level(game, lid)
        pieces = P.plan(story, lid)
        with unreal.ScopedSlowTask(len(pieces), f"Building {lid}") as task:
            task.make_dialog(True)
            for piece in pieces:
                task.enter_progress_frame(1)
                spawn(piece, cmap)
        cast_standins(story, lid, cmap)
        environment(lid)
        levels.save_current_level()
        unreal.log(f"IMPORT {lid}: {len(pieces)} pieces -> {path}")
    # the runtime reads story.json itself; tools/package_game.py stages only that game's folder
