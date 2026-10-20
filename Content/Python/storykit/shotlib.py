"""Where the camera is for each moment worth reviewing, and where things land on screen. Plain Python: the editor
(storykit.shots) takes the pictures, tools/shots_sheet.py measures them, and both use this maths.

First person: the eye is always where the player stands (the scene's view spot at its stance's eye height, leaning in
by cam.push), the fov is the game's one field of view (a held cam.zoom narrows it slightly), and a shot size is checked
as the subject's distance from the eye (storylib.SHOT_BAND), not a lens.

A shot: {"id", "owner" (the stitch, scene or level), "beat", "level", "kind", "target", "eye" (world m), "aim" (world m), "fov" (horizontal degrees),
"shot" (the size the story asks for), "dist" (eye to the subject's face, m), "real" (the size that distance gives),
"closeup", "box" (the target's world box: x0 y0 z0 x1 y1 z1), "screen" (its box on screen, 0..1), "in_frame",
"eyes_v" (closeups: where the eyes land, 0 = top), "people" (other stand-ins on screen within 3 m)}.
"""
import math

from . import storylib as L

FOV = float(L.FOV_H)
SHOT_PART = {"ecu": 0.12, "cu": 0.22, "closeup": 0.22, "mcu": 0.35, "ms": 0.6, "fs": 1.0}   # how much of the body (from the top) the shot is about
ASPECT = 16 / 9
CLOSE_DIST = 0.7


def _sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def _dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def _norm(a):
    n = math.sqrt(_dot(a, a)) or 1.0
    return (a[0] / n, a[1] / n, a[2] / n)


def angles(eye, aim):
    """(yaw, pitch) in story degrees: yaw counter-clockwise from east, pitch up."""
    d = _sub(aim, eye)
    return math.degrees(math.atan2(d[1], d[0])), math.degrees(math.atan2(d[2], math.hypot(d[0], d[1])))


def project(eye, aim, fov, p, aspect=ASPECT):
    """A world point -> (u, v) on screen (0..1, v down), or None behind the camera."""
    f = _norm(_sub(aim, eye))
    r = _norm(_cross(f, (0.0, 0.0, 1.0)))
    up = _cross(r, f)
    q = _sub(p, eye)
    z = _dot(q, f)
    if z <= 0.01:
        return None
    t = math.tan(math.radians(fov) / 2)
    return 0.5 + _dot(q, r) / z / (2 * t), 0.5 - _dot(q, up) / z / (2 * t / aspect)


def box_of(t):
    w, d, h = t.size
    if t.kind == "room":
        return None
    x, y, z = t.pos
    r = max(w, d) / 2 if t.yaw % 90 else None
    hw, hd = (r, r) if r else ((w / 2, d / 2) if t.yaw % 180 == 0 else (d / 2, w / 2))
    return (x - hw, y - hd, z, x + hw, y + hd, z + max(h, 0.05))


def screen_box(eye, aim, fov, box):
    pts = [project(eye, aim, fov, (box[i], box[j], box[k])) for i in (0, 3) for j in (1, 4) for k in (2, 5)]
    pts = [p for p in pts if p]
    if not pts:
        return None, 0.0
    u0, v0 = min(p[0] for p in pts), min(p[1] for p in pts)
    u1, v1 = max(p[0] for p in pts), max(p[1] for p in pts)
    if (u1 - u0) * (v1 - v0) < 1e-6:         # a point (a light, a spot): in frame or not
        return (u0, v0, u1, v1), 1.0 if 0 <= u0 <= 1 and 0 <= v0 <= 1 else 0.0
    area = (u1 - u0) * (v1 - v0)
    cu0, cv0, cu1, cv1 = max(u0, 0), max(v0, 0), min(u1, 1), min(v1, 1)
    inside = max(0.0, cu1 - cu0) * max(0.0, cv1 - cv0)
    return (u0, v0, u1, v1), inside / area


def _toward(a, b, dist):
    d = _sub(b, a)
    n = math.hypot(d[0], d[1]) or 1.0
    return (a[0] + d[0] / n * dist, a[1] + d[1] / n * dist, a[2])


def _entrance(story, things, room_id):
    """A point just inside the room, at the first doorway that leads into it."""
    rm = things[room_id]
    for lv in story["levels"].values():
        for r in lv["rooms"]:
            for op in r.get("openings", []):
                x, y = L.wall_point(r, op["wall"], op["at"])
                wx, wy, _ = L.room_world(r, x, y)
                inside = (rm.pos[0] - rm.size[0] / 2 - 0.01 <= wx <= rm.pos[0] + rm.size[0] / 2 + 0.01 and
                          rm.pos[1] - rm.size[1] / 2 - 0.01 <= wy <= rm.pos[1] + rm.size[1] / 2 + 0.01)
                if inside and op["h"] >= 1.8 and op.get("sill", 0) < 0.3:
                    return _toward((wx, wy, rm.pos[2]), rm.pos, 0.6)
    return rm.pos


def _eye_for(story, things, when, target):
    k = next(iter(set(when) - {"secs", "within"}))
    v = when[k]
    if k in ("enter", "exit") and v in things:
        t = things[v]
        p = _entrance(story, things, v) if t.kind == "room" else t.pos
    elif k in ("use", "look") and v in things:
        t = things[v]
        p = _toward(t.pos, things[t.room].pos, 1.0)
    else:
        t = target
        p = _toward(t.pos, things[t.room].pos, 1.5)
    room_z = things[(things[v] if v in things else target).room].pos[2]    # the floor, not the thing
    return (p[0], p[1], room_z + L.EYE)


def _staged(story, things, who, spot_id, sid):
    """The cast member's stand-in where a scene stages them, as a Thing (it isn't placed in the level)."""
    spot = things[spot_id]
    h = float((story.get("cast", {}).get(who) or {}).get("height", 1.7))
    return L.Thing(f"{who}@{sid}", "prop", spot.level, spot.room, {"shape": f"person {who} stand"}, spot.pos,
                   (0.5, 0.3, h), spot.yaw)


def shot_list(story):
    things, _ = L.index(story)
    shots, extra = [], {}

    fov_game = float(story.get("game", {}).get("fov", FOV))

    def add(owner, b, kind, target, n, closeup=False, eye=None, fov=None, part=None, through=(), shot=None):
        if not target:
            return
        if target.id not in things:
            extra[target.id] = target
        if closeup:
            face = (target.pos[0], target.pos[1], target.pos[2] + target.size[2] - 0.1)
            a = math.radians(target.yaw)
            eye = (face[0] + math.cos(a) * CLOSE_DIST, face[1] + math.sin(a) * CLOSE_DIST, face[2])
            vf = 2 * math.atan(math.tan(math.radians(fov_game) / 2) / ASPECT)       # (the player brought face to face)
            drop = CLOSE_DIST * math.tan(math.atan(2 * (1 / 6) * math.tan(vf / 2)))
            aim, fov = (face[0], face[1], face[2] - drop), fov_game
        else:
            eye = eye or _eye_for(story, things, b["when"], target)
            c = target.centre
            if target.d.get("shape", "").startswith("person"):
                c = (target.pos[0], target.pos[1], target.pos[2] + target.size[2] - 0.15)   # their face
            aim = (c[0], c[1], c[2]) if target.kind != "room" else (c[0], c[1], eye[2] - 0.2)
            fov = fov or fov_game
        d = L.dist(eye, aim)
        shots.append({"id": f"{b['id']}.{n}", "owner": owner, "beat": b["id"], "kind": kind, "target": target.id,
                      "level": target.level, "eye": eye, "aim": aim, "fov": fov, "closeup": closeup, "part": part,
                      "through": list(through), "shot": shot, "dist": round(d, 2), "real": L.shot_of(d)})

    def walk(owner, b, acts, n=0):
        for a in acts:
            n += 1
            if "trick" in a:
                tk = a["trick"]
                tid = {"glimpse": "figure", "jumpscare": "figure", "swap": "show", "knock": "at", "whisper": "at",
                       "cut_away": "lookat", "slam_behind": "door"}.get(tk)
                if tid and a.get(tid) in things:
                    add(owner, b, tk, things[a[tid]], n)
                if tk == "cut_away":
                    n = walk(owner, b, a.get("then", []), n)
            elif "lookat" in a and a["lookat"] in things:
                add(owner, b, "lookat", things[a["lookat"]], n)
        return n

    for tid, st in story.get("stitches", {}).items():
        for b in st.get("beats", []):
            walk(tid, b, b.get("do", []))

    for sid, sc in story.get("scenes", {}).items():
        ver = L.scene_version(sc)
        stage = {who: _staged(story, things, who, spot, sid) for who, spot in ver.get("stage", {}).items() if spot in things}
        cam = ver.get("camera", {})
        view = things.get(sc.get("view"))
        lvl = L.level_of(story, sc)
        eh = L.EYES.get(sc.get("stance", "stand"), L.EYE)
        if view:
            room_z = things[view.room].pos[2]
            eye = (view.pos[0], view.pos[1], room_z + eh)
        else:
            st = things[story["levels"][lvl]["start"]]
            eye = (st.pos[0], st.pos[1], st.pos[2] + eh)
        through = cam.get("through", [])
        at = dict(ver.get("stage", {}))                        # where each actor is now: blocking `move`s carry over
        for i, c in enumerate(ver.get("clips", [])):
            b = {"id": f"{sid}.{c['id']}", "when": {}}
            who = c.get("who")
            moves = [k["move"] for k in (c.get("body") or {}).get("block", []) if k.get("move") in things]
            if who in at and at[who] in things:
                here = _staged(story, things, who, at[who], f"{sid}.{c['id']}")
                for m in moves:                                 # the closest moment decides the framing (as the desk)
                    if L.dist(things[m].pos, eye) < L.dist(here.pos, eye):
                        here.pos, here.yaw = things[m].pos, things[m].yaw
                stage[who] = here
                extra[here.id] = here
            seam = c.get("seam") or {}
            ccam = dict(cam, **(c.get("cam") or {}))
            look = stage.get(ccam.get("look")) or things.get(ccam.get("look"))
            shot = c.get("shot")
            fov = fov_game * (1 - min(L.ZOOM, float(ccam.get("zoom", 0))))
            if i == 0 or shot or c.get("cam"):
                if look:
                    e = eye
                    if ccam.get("push"):                       # the player leans toward what they look at
                        f = look.pos
                        dx, dy = f[0] - eye[0], f[1] - eye[1]
                        n = math.hypot(dx, dy) or 1.0
                        lean = min(L.LEAN, float(ccam["push"]))
                        e = (eye[0] + dx / n * lean, eye[1] + dy / n * lean, eye[2])
                    add(sid, b, f"scene:{shot or 'free'}", look, 0, eye=e, fov=fov, part=SHOT_PART.get(shot), through=through, shot=shot)
            if seam.get("look"):
                tgt = stage.get(seam["look"]) or things.get(seam["look"])
                add(sid, b, f"seam:{seam.get('kind')}", tgt, 1, eye=eye, through=through)
            if moves:
                at[who] = moves[-1]

    levels_done = set()
    for lid, lvl in story.get("levels", {}).items():
        for rm in lvl["rooms"]:
            if lid not in levels_done:
                add(lid, {"id": f"enter_{rm['id']}", "when": {"enter": rm["id"]}}, "room", things[rm["id"]], 0)
        levels_done.add(lid)

    placed = things
    things = dict(things, **extra)
    for s in shots:
        t = things[s["target"]]
        box = box_of(t)
        close = {"ecu": (0.2, 0.24), "cu": (0.22, 0.26), "closeup": (0.22, 0.26), "mcu": (0.45, 0.5), "pov_down": (0.45, 0.5), "pov_up": (0.45, 0.5)}.get(s.get("shot"))
        if box and close and t.d.get("shape", "").startswith("person"):   # first-person close shots: the head (and shoulders)
            w, hh = close
            cx, cy, top = t.pos[0], t.pos[1], t.pos[2] + t.size[2]
            box = (cx - w / 2, cy - w / 2, top - hh, cx + w / 2, cy + w / 2, top)
            s["part"] = None
        if box and s.get("part"):              # a close shot is about the top of the body: the face, the shoulders
            box = (box[0], box[1], box[5] - (box[5] - box[2]) * s["part"], box[3], box[4], box[5])
            sb, _ = screen_box(s["eye"], s["aim"], s["fov"], box)
            s["part_h"] = (min(1, sb[3]) - max(0, sb[1])) if sb else 0.0
        s["box"] = box
        s["screen"], s["in_frame"] = screen_box(s["eye"], s["aim"], s["fov"], box) if box else (None, 1.0)
        if s["closeup"]:
            eyes = (t.pos[0], t.pos[1], t.pos[2] + t.size[2] - 0.1)
            s["eyes_v"] = project(s["eye"], s["aim"], s["fov"], eyes)[1]
        s["people"] = []
        for p in placed.values():            # stand-ins staged for scenes only appear in their scene
            if p.id == s["target"] or not p.d.get("shape", "").startswith("person") or p.d.get("hidden"):
                continue
            if L.dist(p.pos, s["eye"]) < 3.0:
                uv = project(s["eye"], s["aim"], s["fov"], p.centre)
                if uv and 0 <= uv[0] <= 1 and 0 <= uv[1] <= 1:
                    s["people"].append(p.id)
    return shots
