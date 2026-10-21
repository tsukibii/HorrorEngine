"""story.json -> a flat list of pieces to spawn (walls cut round openings, floors, ceilings, doors, props, lights,
triggers, spots, stand-ins, the player start). Plain Python: tools/plan_view.py draws it without the editor, and
storykit.importer only spawns what this returns, so the maths is tested once, here.

A piece: {"id", "kind", "level", "room", "pos" (world metres: the centre for meshes and triggers, the base for
people, lights and spots), "size" (w, d, h in metres, along the piece's own axes), "yaw" (story degrees),
"shape" (box, cyl, sphere), "tags", "d" (the source dict, for the class map)}.
kind: wall, floor, ceiling, door, mesh, person, light, trigger, spot, start.
"""
import math

from . import storylib as L

STEP = 0.18   # a stair's rise


def _tags(t, extra=()):
    tags = ["story", f"story:{t.id}", f"room:{t.room}"]
    if t.use and t.kind == "prop":
        tags.append(f"use:{t.use}")
    if isinstance(t.d.get("on"), str):
        tags.append(f"on:{t.d['on']}")
    if t.d.get("hidden"):
        tags.append("hidden")
    if t.d.get("art"):                       # a library mesh that replaces the block, scaled to fit it
        tags.append(f"art:{t.d['art']}")
    if t.d.get("mat"):                       # a library texture set on the block
        tags.append(f"mat:{t.d['mat']}")
    return tags + list(extra)


def _rot(dx, dy, yaw):
    a = math.radians(yaw)
    return dx * math.cos(a) - dy * math.sin(a), dx * math.sin(a) + dy * math.cos(a)


def room_pieces(lid, room):
    out = []
    x0, y0, z0 = room["at"]
    w, d, h = room["size"]
    T = L.WALL_T
    base = {"level": lid, "room": room["id"], "yaw": 0.0, "shape": "box", "d": room}
    tags = ["story", f"story:{room['id']}", f"room:{room['id']}"]
    look = lambda part: [f"mat:{room['look'][part]}"] if (room.get("look") or {}).get(part) else []   # library textures
    out.append(dict(base, id=f"{room['id']}__floor", kind="floor", pos=(x0 + w / 2, y0 + d / 2, z0 - 0.05),
                    size=(w, d, 0.1), tags=tags + ["floor:" + room.get("floor", "wood")] + look("floor")))
    out.append(dict(base, id=f"{room['id']}__volume", kind="trigger", shape=None,           # "enter <room>" in the game
                    pos=(x0 + w / 2, y0 + d / 2, z0 + h / 2), size=(w - T, d - T, h - 0.05),
                    tags=["story", f"room_volume:{room['id']}", f"room:{room['id']}"]))
    if room.get("ceiling", True):
        out.append(dict(base, id=f"{room['id']}__ceiling", kind="ceiling", pos=(x0 + w / 2, y0 + d / 2, z0 + h + 0.05),
                        size=(w, d, 0.1), tags=tags + look("ceiling")))
    for wall in L.WALLS:
        if wall in room.get("skip", []):
            continue
        length = L.wall_length(room, wall)
        ext = T / 2 if wall in ("n", "s") else 0.0         # n and s walls run past the corners to close them
        spans = []                                          # (a0, a1, z_lo, z_hi) along the wall
        cur = -ext
        # openings cut a hole; a skipped stretch (a neighbour builds that part of the wall) cuts all of it
        cuts = [(o["at"] - o["w"] / 2, o["at"] + o["w"] / 2, o.get("sill", 0.0), o["h"]) for o in room.get("openings", []) if o["wall"] == wall]
        cuts += [(a0, a1, 0.0, h) for a0, a1 in L.skipped_stretches(room, wall)]
        for a0, a1, sill, oh in sorted(cuts):
            if a0 > cur + 0.001:
                spans.append((cur, a0, 0.0, h))
            if sill > 0.001:
                spans.append((max(a0, cur), a1, 0.0, sill))
            if h - (sill + oh) > 0.001:
                spans.append((max(a0, cur), a1, sill + oh, h))
            cur = max(cur, a1)
        if length + ext > cur + 0.001:
            spans.append((cur, length + ext, 0.0, h))
        for i, (a0, a1, lo, hi) in enumerate(spans):
            a, along, zc, hh = (a0 + a1) / 2, a1 - a0, z0 + (lo + hi) / 2, hi - lo
            if wall in ("n", "s"):
                pos, size = (x0 + a, y0 + (d if wall == "n" else 0.0), zc), (along, T, hh)
            else:
                pos, size = (x0 + (w if wall == "e" else 0.0), y0 + a, zc), (T, along, hh)
            out.append(dict(base, id=f"{room['id']}__wall_{wall}{i}", kind="wall", pos=pos, size=size, tags=tags + look("walls")))
    return out


def plan(story, level=None):
    things, errs = L.index(story)
    if errs:
        raise ValueError("; ".join(errs))
    out = []
    for lid, lvl in story["levels"].items():
        if level and lid != level:
            continue
        for room in lvl["rooms"]:
            out += room_pieces(lid, room)
        st = things[lvl["start"]]
        out.append({"id": f"{lid}__start", "kind": "start", "level": lid, "room": st.room, "pos": st.pos,
                    "size": (0, 0, 0), "yaw": st.yaw, "shape": None, "tags": ["story", "story:start"], "d": st.d})
    for t in things.values():
        if level and t.level != level or t.kind == "room":
            continue
        p = {"id": t.id, "level": t.level, "room": t.room, "yaw": t.yaw, "d": t.d, "shape": "box"}
        if t.kind == "door":
            out.append(dict(p, kind="door", pos=t.centre, size=(t.size[0] - 0.02, 0.05, t.size[2] - 0.01),
                            tags=_tags(t, [f"locked_by:{t.d['locked_by']}"] if t.d.get("locked_by") else [])))
            continue
        u = t.use
        if u == "spot":
            out.append(dict(p, kind="spot", pos=t.pos, size=(0, 0, 0), shape=None, tags=_tags(t)))
        elif u == "trigger":
            out.append(dict(p, kind="trigger", pos=t.centre, size=t.size, shape=None, tags=_tags(t)))
        elif u == "light":
            lift = 0.12 if isinstance(t.d.get("on"), str) else 0.0
            out.append(dict(p, kind="light", pos=(t.pos[0], t.pos[1], t.pos[2] + lift), size=(0, 0, 0), shape=None,
                            tags=_tags(t)))
        elif t.d.get("shape", "").startswith("person"):
            cast, pose = L.parse_shape(t.d["shape"])[1]
            out.append(dict(p, kind="person", pos=t.pos, size=t.size, shape=None, tags=_tags(t, [f"cast:{cast}", f"pose:{pose}"])))
        elif t.d.get("shape"):
            kind, args = L.parse_shape(t.d["shape"])
            if kind == "stairs":
                sw, run, rise = args
                n = max(1, round(rise / STEP))
                for i in range(n):
                    dy = -run / 2 + run / n * (i + 0.5)     # steps climb along the stairs' own +y
                    ox, oy = _rot(0.0, dy, t.yaw - 90)        # rot 90 (north) = climbing north
                    sh = rise / n * (i + 1)
                    out.append(dict(p, id=f"{t.id}__step{i}", kind="mesh", shape="box",
                                    pos=(t.pos[0] + ox, t.pos[1] + oy, t.pos[2] + sh / 2),
                                    size=(sw, run / n, sh), yaw=t.yaw - 90, tags=_tags(t)))
            elif kind == "asset":                     # the mesh itself, at its indexed size (its box stands in until fetched)
                out.append(dict(p, kind="mesh", shape="box", pos=t.centre, size=t.size, tags=_tags(t, [f"art:{args[0]}", "real"])))
            else:
                shape = {"box": "box", "plane": "box", "cyl": "cyl", "sphere": "sphere"}[kind]
                out.append(dict(p, kind="mesh", shape=shape, pos=t.centre, size=t.size, tags=_tags(t)))
    return out
