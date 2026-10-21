"""Takes the review pictures in the editor: one camera per shot from storykit.shotlib (the player's eye at each
scripted moment, and each room's entrance), a 1280x720 screenshot each, into Saved/Story/Shots/, with shots.json
beside them. Then, outside the editor: python tools/shots_sheet.py (contact sheets and the measured rules).

    import storykit.shots as s; s.take("Pilot")                    every shot (opens each level's map)
    import storykit.shots as s; s.take("Pilot", beat="b_knock")    just one beat's shots

Screenshots finish on a later editor tick, so this runs as a queue on the Slate tick and returns at once; watch
the Output Log for `SHOTS done`. Occlusion is measured with line traces where the API allows (best effort).
V0: written before it ever ran in an editor; SETUP.md S10 makes it work.
"""
import json

import unreal

from . import shotlib as S
from . import storylib as L

FRAMES_BETWEEN = 6         # engine frames, not Slate ticks: in the background Slate ticks many times per frame

actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
levels = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
_state = {}


def _ue(p):
    return unreal.Vector(p[0] * 100.0, -p[1] * 100.0, p[2] * 100.0)


def _visible_rays(shot):
    """How many of 9 rays from the eye reach the target (its centre, and halfway to each corner of its box). A ray
    is clear when nothing blocks it, or when what it hits lies inside the target's own box (+5 cm)."""
    box = shot.get("box")
    if not box:
        return None
    c = [(box[i] + box[i + 3]) / 2 for i in range(3)]
    pts = [c] + [[(c[i] + (box[i] if (k >> i) & 1 else box[i + 3])) / 2 for i in range(3)] for k in range(8)]
    world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    clear = 0
    for p in pts:
        try:
            res = unreal.SystemLibrary.line_trace_single(world, _ue(shot["eye"]), _ue(p),
                                                         unreal.TraceTypeQuery.TRACE_TYPE_QUERY1, False, [],
                                                         unreal.DrawDebugTrace.NONE, True)
            hit = res[1] if isinstance(res, tuple) else res
            t = hit.to_tuple() if hit else None
            if not t or not t[0]:                       # (blocking_hit, initial_overlap, time, distance, location, ...)
                clear += 1
                continue
            loc = t[4]
            x, y, z = loc.x / 100, -loc.y / 100, loc.z / 100
            if all(box[i] - 0.05 <= v <= box[i + 3] + 0.05 for i, v in enumerate((x, y, z))):
                clear += 1
        except Exception as e:  # noqa: BLE001 - the trace's Python shape varies by version; S10 pins it down
            unreal.log_warning(f"storykit: occlusion not measured: {e}")
            return None
    return clear


def _frame():
    return unreal.SystemLibrary.get_frame_count()


def _tick(_dt):
    st = _state
    if _frame() < st["wait"]:
        return
    if st.get("cam"):
        actors.destroy_actor(st["cam"])
        st["cam"] = None
    if not st["todo"]:
        unreal.unregister_slate_post_tick_callback(st["handle"])
        (st["out"] / "shots.json").write_text(json.dumps(st["done"], indent=1), encoding="utf-8")
        unreal.log(f"SHOTS done: {len(st['done'])} -> {st['out']}")
        return
    shot = st["todo"].pop(0)
    level = shot["level"]
    if st.get("level") != level:
        levels.load_level(f"/Game/Games/{st['game']}/Maps/L_{level}")
        st["level"] = level
        st["wait"] = _frame() + FRAMES_BETWEEN * 4
        st["todo"].insert(0, shot)
        return
    yaw, pitch = S.angles(shot["eye"], shot["aim"])
    cam = actors.spawn_actor_from_class(unreal.CameraActor, _ue(shot["eye"]),
                                        unreal.Rotator(roll=0.0, pitch=pitch, yaw=-yaw))
    cam.camera_component.set_editor_property("field_of_view", shot["fov"])
    cam.camera_component.set_editor_property("aspect_ratio", S.ASPECT)
    shot["file"] = f"{shot['id']}.png"
    shot["visible_rays"] = _visible_rays(shot)
    unreal.AutomationLibrary.take_high_res_screenshot(1280, 720, str(st["out"] / shot["file"]), camera=cam)
    st["cam"] = cam
    st["done"].append(shot)
    st["wait"] = _frame() + FRAMES_BETWEEN


def take(game=None, beat=None):
    story, spath = L.load(game)
    game = spath.parent.name
    out = L.ROOT / "Saved" / "Story" / game / "Shots"
    shots = [s for s in S.shot_list(story) if not beat or s["beat"] == beat]
    out.mkdir(parents=True, exist_ok=True)
    if beat and (out / "shots.json").exists():    # keep the other beats' entries
        old = [s for s in json.loads((out / "shots.json").read_text(encoding="utf-8")) if s["beat"] != beat]
    else:
        old = []
    _state.clear()
    _state.update(todo=shots, done=old, wait=0, cam=None, game=game, out=out)
    _state["handle"] = unreal.register_slate_post_tick_callback(_tick)
    unreal.log(f"SHOTS: taking {len(shots)} for {game}")
