"""story.json -> a flat list of pieces to spawn (walls cut round openings, floors, ceilings, doors, props, lights,
triggers, spots, stand-ins, the player start). Plain Python: tools/plan_view.py draws it without the editor, and
the Godot export (storykit.godot) only writes what this returns, so the maths is tested once, here.

A piece: {"id", "kind", "level", "room", "pos" (world metres: the centre for meshes and triggers, the base for
people, lights and spots), "size" (w, d, h in metres, along the piece's own axes), "yaw" (story degrees),
"shape" (box, cyl, sphere), "tags", "d" (the source dict, for the class map)}.
kind: wall, floor, ceiling, door, mesh, person, light, trigger, spot, start.
"""
import math

from . import storylib as L
from . import kit as KIT
from . import library as LIB
from . import life as LIFE

STEP = 0.18   # a stair's rise


def mat_ref(look):
    """A look as the plan tags it (`mat:<this>`): a set's ref or a colour as it is, a tuned set (a look object, as the
    street paints with: STREET_PAINT §2) the set made from it, pbr/_made/<hash> (pbrmix.py; the desk's server and the
    Godot export make it when it's missing)."""
    if isinstance(look, dict):
        from . import pbrmix as MIX          # plain Python to name it; numpy only when its pixels are made
        return MIX.ref_of(look)
    return look


def _matslots(d):
    """A kit thing's (or a kit door's) slots dressed, its `mats`, as tags: matslot:<slot>:<ref>."""
    m = d.get("mats")
    return [f"matslot:{sl}:{mat_ref(v)}" for sl, v in m.items() if v] if isinstance(m, dict) else []


def _look(room, part):
    v = (room.get("look") or {}).get(part)
    return [f"mat:{mat_ref(v)}"] if v else []


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
        tags.append(f"mat:{mat_ref(t.d['mat'])}")
    tags += _matslots(t.d)                   # a kit thing's slots dressed: matslot:<slot>:<ref> (its tones _2.._4 follow)
    if t.d.get("tag"):                       # what it is (a mirror, a poster): the desk colours by it
        tags.append(f"tag:{t.d['tag']}")
    lf = LIFE.life_of(t.d) if t.kind == "prop" else None
    if lf:                                   # a little thing's life and where it starts (docs/IMMERSION.md §5)
        tags += [f"life:{lf}", f"state:{LIFE.start(t.d, lf)}"]
    return tags + list(extra)


def _rot(dx, dy, yaw):
    a = math.radians(yaw)
    return dx * math.cos(a) - dy * math.sin(a), dx * math.sin(a) + dy * math.cos(a)


def door_pieces(p, t):
    """A kit door (docs/KIT.md §5): its leaf (kind door, the mesh's pivot on the hinges), its handle (attached to the
    leaf) and its frame (the lining and the stop, in the wall). The leaf's front faces the side it opens to; each
    part is tagged door:<id> and door_part:leaf|handle|frame, and carries its sized spec as `kit`."""
    k = KIT.resolve(t.d["kit"])

    def g(key):
        return k.get(key, KIT.DOOR[key])
    w, wall_t, h = t.size
    swing = t.d.get("swing", "in")
    slide = swing == "slide" or g("style") in ("slide", "shoji")
    yaw = {"n": 0.0, "s": 180.0, "e": 270.0, "w": 90.0}[getattr(t, "wall", "n")] + (180.0 if swing == "out" else 0.0)
    lt = float((k.get("size") or [0, g("leaf_t"), 0])[1])
    ln, gap, fg = float(g("lining")), float(g("gap")), float(g("floor_gap"))
    bx, by, bz = t.pos

    def at(lx, ly, lz):
        ox, oy = _rot(lx, ly, yaw)
        return (bx + ox, by + oy, bz + lz)

    def part(pid, kind, spec, pos, size, extra, d=None):
        spec = dict(spec, size=[round(v, 4) for v in size])
        tags = ["story", f"story:{pid}", f"room:{t.room}", f"door:{t.id}", f"kit:{KIT.kind(spec)}", f"art:{KIT.ref(spec)}", "real"] + extra + _matslots(t.d)   # the door's `mats` on each part's slots
        return dict(p, id=pid, kind=kind, shape="box", pos=pos, size=tuple(spec["size"]), yaw=yaw, d=d or {"kit": spec}, kit=spec, tags=tags)
    out = []
    leaf = {key: v for key, v in k.items() if key not in ("handle", "frame", "hinge_art")}
    if k.get("hinge_art"):                              # your own hinge model, split in two (§8): the kit cuts its mortises only
        leaf["hinge_model"] = "none"
    if slide:                                           # a sliding leaf hangs on the room's face, wider than its hole
        lw, lh, ly = w + 0.05, h + 0.01, -(wall_t / 2 + lt / 2 + 0.004)
        lz = 0.0
    else:
        lw, lh, ly, lz = w - 2 * ln - 2 * gap, h - ln - gap - fg, 0.0, fg
    fr = g("frame")
    if fr and fr != "none":
        fs = {"preset": fr} if isinstance(fr, str) else dict(fr)
        fs.update({"leaf_t": lt, "stop": not slide})
        if not slide:                                   # the frame's half of each hinge: where the door's are
            fs.update({"hinge": g("hinge"), "hinges": g("hinges"), "hinge_h": g("hinge_h"), "knuckles": g("knuckles"),
                       "hinge_tip": g("hinge_tip"), "hinge_slot": g("hinge_slot"), "leaf_w": round(lw, 4), "leaf_h": round(lh, 4), "leaf_z": round(lz, 4),
                       "hinge_w": g("hinge_w"), "hinge_t": g("hinge_t"), "barrel": g("barrel"), "mortise": g("mortise"),
                       "hinge_model": "none" if k.get("hinge_art") else g("hinge_model")})
        out.append(part(f"{t.id}__frame", "mesh", fs, at(0, 0, h / 2), (w, wall_t, h), ["door_part:frame", "in_wall", "hollow"]))
    leaf_tags = ["door_part:leaf", f"hinge:{g('hinge')}"] + ([f"locked_by:{t.d['locked_by']}"] if t.d.get("locked_by") else [])
    lp = part(t.id, "door", leaf, at(0, ly, lz + lh / 2), (lw, lt, lh), leaf_tags, d=dict(t.d, kit=dict(leaf, size=[round(lw, 4), round(lt, 4), round(lh, 4)])))
    out.append(lp)
    art = k.get("hinge_art")
    if art and not slide:                               # your own hinge, split at its barrel (the scene builder's Split
        side_l = g("hinge") != "right"                  # for Unreal): its door half rides the leaf, its frame half stays
        kr = float(g("barrel")) / 2
        hx, hy = (-1 if side_l else 1) * (lw / 2 - kr / 2), -lt / 2 + kr / 2
        for i, zc in enumerate(KIT.hinge_zs(g("hinges"), lh)):
            for half in ("door", "frame"):
                ref = f"{art}_{half}_{'l' if side_l else 'r'}"
                try:
                    box = (LIB.mesh_info(ref) or {}).get("box_m")
                except ValueError:
                    box = None
                if not box:
                    continue
                c = [(box[q] + box[q + 3]) / 2 for q in range(3)]
                size = tuple(round(box[q + 3] - box[q], 4) for q in range(3))
                tags = ["story", f"story:{t.id}__hinge{i + 1}_{half}", f"room:{t.room}", f"door:{t.id}", f"art:{ref}", "real",
                        f"door_part:hinge_{half}"] + ([f"attach:{t.id}"] if half == "door" else [])
                out.append(dict(p, id=f"{t.id}__hinge{i + 1}_{half}", kind="mesh", shape="box", pos=at(hx + c[0], ly + hy + c[1], lz + zc + c[2]),
                                size=size, yaw=yaw, d={"art": ref}, tags=tags))
    hd = g("handle")
    if hd and hd != "none":
        hs = {"preset": hd} if isinstance(hd, str) else dict(hd)
        hw, hd_all, hh = KIT.size(hs)
        proj = max(0.0, (hd_all - float(KIT.resolve(hs).get("through", KIT.DOOR["leaf_t"]))) / 2)   # how far it stands off each face
        side = 1.0 if g("hinge") == "left" else -1.0          # the handle on the edge away from the hinges
        hs.update({"through": lt, "points": "left" if side > 0 else "right"})
        hx = side * (lw / 2 - float(g("handle_in")))
        out.append(part(f"{t.id}__handle", "mesh", hs, at(hx, ly, float(g("handle_z"))), (hw, lt + 2 * proj, hh),
                        ["door_part:handle", f"attach:{t.id}"]))
    return out


def room_pieces(lid, room):
    out = []
    x0, y0, z0 = room["at"]
    w, d, h = room["size"]
    T = L.WALL_T
    base = {"level": lid, "room": room["id"], "yaw": 0.0, "shape": "box", "d": room}
    tags = ["story", f"story:{room['id']}", f"room:{room['id']}"]
    look = lambda part: _look(room, part)                                                   # library textures, tuned sets, colours
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


TRIM_DEPTH = {"skirting": 0.012, "cornice": 0.03, "casing": 0.015, "threshold": 0.0}   # how far each stands off the wall


def room_trim(lvl, room):
    """A room's trim: the level's `trim`, overridden key by key by the room's; `trim: false` has none."""
    if room.get("trim") is False:
        return {}
    t = dict(lvl.get("trim") or {})
    t.update(room.get("trim") or {})
    return {k: float(v) for k, v in t.items() if k in TRIM_DEPTH and v}


def trim_pieces(lid, lvl, room, walls, openings):
    """Skirting boards, a cornice and door casings on the room's side of its walls, wherever a wall is built (its
    own or a neighbour's), so they stop at every opening and open side on their own. walls: this level's wall pieces;
    openings: (axis, v, a0, a1, z0, h, is_window) in world metres for every opening on the level."""
    tr = room_trim(lvl, room)
    if not tr:
        return []
    out, T = [], L.WALL_T
    x0, y0, z0 = room["at"]
    w, d, h = room["size"]
    base = {"level": lid, "room": room["id"], "yaw": 0.0, "shape": "box", "d": room}
    look = _look(room, "trim")
    for wall in L.WALLS:
        axis, v, lo, hi = L.wall_line(room, wall)
        inward = {"n": -1, "s": 1, "e": -1, "w": 1}[wall]
        lo_in, hi_in = lo + T / 2, hi - T / 2                # between the faces of the walls at the corners

        def on_line(p):
            c, sz = p["pos"], p["size"]
            return abs((c[1] if axis == "y" else c[0]) - v) < 0.01 and (sz[1] if axis == "y" else sz[0]) <= T + 0.001

        def spans(zlo, zhi):
            got = []
            for p in walls:
                if not on_line(p) or p["pos"][2] - p["size"][2] / 2 > zlo + 0.005 or p["pos"][2] + p["size"][2] / 2 < zhi - 0.005:
                    continue
                c, half = (p["pos"][0], p["size"][0] / 2) if axis == "y" else (p["pos"][1], p["size"][1] / 2)
                a0, a1 = max(c - half, lo_in), min(c + half, hi_in)
                if a1 - a0 > 0.03:
                    got.append([a0, a1])
            got.sort()
            merged = []
            for a0, a1 in got:
                if merged and a0 <= merged[-1][1] + 0.005:
                    merged[-1][1] = max(merged[-1][1], a1)
                else:
                    merged.append([a0, a1])
            return merged

        def piece(name, a0, a1, zc, hh, depth):
            off = v + inward * (T / 2 + depth / 2)
            pos = ((a0 + a1) / 2, off, zc) if axis == "y" else (off, (a0 + a1) / 2, zc)
            size = (a1 - a0, depth, hh) if axis == "y" else (depth, a1 - a0, hh)
            out.append(dict(base, id=f"{room['id']}__{name}", kind="mesh", pos=pos, size=size,
                            tags=["story", f"story:{room['id']}", f"room:{room['id']}", f"trim:{name.split('_')[0]}"] + look))

        if tr.get("skirting"):
            sk = tr["skirting"]
            for i, (a0, a1) in enumerate(spans(z0, z0 + sk)):
                piece(f"skirting_{wall}{i}", a0, a1, z0 + sk / 2, sk, TRIM_DEPTH["skirting"])
        if tr.get("cornice") and room.get("ceiling", True):
            co = tr["cornice"]
            for i, (a0, a1) in enumerate(spans(z0 + h - co, z0 + h)):
                piece(f"cornice_{wall}{i}", a0, a1, z0 + h - co / 2, co, TRIM_DEPTH["cornice"])
        if tr.get("casing"):
            cw, cd, i = tr["casing"], TRIM_DEPTH["casing"], 0
            for ax, ov, a0, a1, oz, oh, win in openings:
                if win or ax != axis or abs(ov - v) > 0.01 or abs(oz - z0) > 0.3 or a0 < lo - 0.01 or a1 > hi + 0.01:
                    continue
                top = min(oz + oh + cw, z0 + h)
                for b0, b1 in ((a0 - cw, a0), (a1, a1 + cw)):         # the jambs' faces, either side
                    if b0 >= lo_in - 0.001 and b1 <= hi_in + 0.001:
                        piece(f"casing_{wall}{i}", b0, b1, (oz + top) / 2, top - oz, cd)
                        i += 1
                if top - (oz + oh) > 0.01:                             # the head over it
                    piece(f"casing_{wall}{i}", max(a0 - cw, lo_in), min(a1 + cw, hi_in), (oz + oh + top) / 2, top - (oz + oh), cd)
                    i += 1
    return out


LINING = 0.004   # a lining's depth: a room's own walls look on the face of a wall its neighbour builds


def lining_pieces(lid, room, walls, rooms):
    """A room's side of the walls a neighbour builds (a shared wall is one piece, its builder's, wearing the builder's
    look on both faces): a lining 4 mm deep, 1 mm off the wall, wearing this room's own `walls` look (its default
    grey when it has none), wherever the two rooms' looks differ, so a room painted is painted on its own side only.
    It follows the builder's pieces, holes and all; hollow: the wall behind it is what stops you."""
    mine = _look(room, "walls")
    out, T = [], L.WALL_T
    z0, h = room["at"][2], room["size"][2]
    base = {"level": lid, "room": room["id"], "yaw": 0.0, "shape": "box", "d": room}
    for wall in L.WALLS:
        axis, v, lo, hi = L.wall_line(room, wall)
        inward = {"n": -1, "s": 1, "e": -1, "w": 1}[wall]
        lo_in, hi_in = lo + T / 2, hi - T / 2
        i = 0
        for p in walls:
            c, sz = p["pos"], p["size"]
            if p["room"] == room["id"] or abs((c[1] if axis == "y" else c[0]) - v) > 0.01 or (sz[1] if axis == "y" else sz[0]) > T + 0.001:
                continue
            owner = rooms.get(p["room"])
            if owner is None or _look(owner, "walls") == mine:
                continue
            zlo, zhi = max(c[2] - sz[2] / 2, z0), min(c[2] + sz[2] / 2, z0 + h)
            cc, half = (c[0], sz[0] / 2) if axis == "y" else (c[1], sz[1] / 2)
            a0, a1 = max(cc - half, lo_in), min(cc + half, hi_in)
            if zhi - zlo < 0.02 or a1 - a0 < 0.02:
                continue
            off = v + inward * (T / 2 + 0.001 + LINING / 2)
            pos = ((a0 + a1) / 2, off, (zlo + zhi) / 2) if axis == "y" else (off, (a0 + a1) / 2, (zlo + zhi) / 2)
            size = (a1 - a0, LINING, zhi - zlo) if axis == "y" else (LINING, a1 - a0, zhi - zlo)
            out.append(dict(base, id=f"{room['id']}__lining_{wall}{i}", kind="mesh", pos=pos, size=size,
                            tags=["story", f"story:{room['id']}", f"room:{room['id']}", "trim:lining", "hollow"] + mine))
            i += 1
    return out


def threshold_pieces(lid, lvl):
    """A strip across every doorway where the floor changes (wood to tile at the washroom door), as tall as the
    level's (or the host room's) `trim.threshold`, as deep as the wall: the host room's own."""
    out, T = [], L.WALL_T
    rooms = lvl["rooms"]
    for room in rooms:
        th = room_trim(lvl, room).get("threshold")
        if not th:
            continue
        for i, op in enumerate(room.get("openings", [])):
            if op.get("window") or op.get("sill", 0.0) > 0.05:
                continue
            axis, v, lo, _ = L.wall_line(room, op["wall"])
            a0, a1 = lo + op["at"] - op["w"] / 2, lo + op["at"] + op["w"] / 2
            other = None
            for o in rooms:
                if o is room or abs(o["at"][2] - room["at"][2]) > 0.05:
                    continue
                for wl in L.WALLS:
                    ax2, v2, lo2, hi2 = L.wall_line(o, wl)
                    if ax2 == axis and abs(v2 - v) < 0.01 and lo2 <= a0 + 0.01 and hi2 >= a1 - 0.01:
                        other = o
            if not other or other.get("floor", "wood") == room.get("floor", "wood"):
                continue
            z0 = room["at"][2]
            pos = ((a0 + a1) / 2, v, z0 + th / 2) if axis == "y" else (v, (a0 + a1) / 2, z0 + th / 2)
            size = (a1 - a0, T, th) if axis == "y" else (T, a1 - a0, th)
            look = _look(room, "trim")
            out.append({"id": f"{room['id']}__threshold_{i}", "kind": "mesh", "level": lid, "room": room["id"], "yaw": 0.0, "shape": "box",
                        "d": room, "pos": pos, "size": size, "tags": ["story", f"story:{room['id']}", f"room:{room['id']}", "trim:threshold"] + look})
    return out


def plan(story, level=None):
    things, errs = L.index(story)
    if errs:
        raise ValueError("; ".join(errs))
    out = []
    for lid, lvl in story["levels"].items():
        if level and lid != level:
            continue
        mine = []
        for room in lvl["rooms"]:
            mine += room_pieces(lid, room)
        walls = [p for p in mine if p["kind"] == "wall"]
        ops = []
        for room in lvl["rooms"]:
            for op in room.get("openings", []):
                axis, v, lo, _ = L.wall_line(room, op["wall"])
                ops.append((axis, v, lo + op["at"] - op["w"] / 2, lo + op["at"] + op["w"] / 2, room["at"][2] + op.get("sill", 0.0),
                            op["h"], bool(op.get("window"))))
        by_id = {r["id"]: r for r in lvl["rooms"]}
        for room in lvl["rooms"]:
            mine += trim_pieces(lid, lvl, room, walls, ops)
            mine += lining_pieces(lid, room, walls, by_id)
        mine += threshold_pieces(lid, lvl)
        out += mine
        st = things[lvl["start"]]
        out.append({"id": f"{lid}__start", "kind": "start", "level": lid, "room": st.room, "pos": st.pos,
                    "size": (0, 0, 0), "yaw": st.yaw, "shape": None, "tags": ["story", "story:start"], "d": st.d})
    for t in things.values():
        if level and t.level != level or t.kind == "room":
            continue
        p = {"id": t.id, "level": t.level, "room": t.room, "yaw": t.yaw, "d": t.d, "shape": "box"}
        if t.kind == "door":
            if t.d.get("kit") is not None:
                try:
                    out += door_pieces(p, t)
                    continue
                except ValueError:
                    pass                                # story_check says why; the slab stands in
            out.append(dict(p, kind="door", pos=t.centre, size=(t.size[0] - 0.02, 0.05, t.size[2] - 0.01),
                            tags=_tags(t, [f"locked_by:{t.d['locked_by']}"] if t.d.get("locked_by") else [])))
            continue
        u = t.use
        if u == "spot":
            out.append(dict(p, kind="spot", pos=t.pos, size=(0, 0, 0), shape=None, tags=_tags(t)))
        elif u == "trigger":
            out.append(dict(p, kind="trigger", pos=t.centre, size=t.size, shape=None, tags=_tags(t)))
        elif u == "leak":                                # water running down a wall from here (GODOT_LOOK §2: a wet band, drips)
            out.append(dict(p, kind="leak", pos=t.pos, size=(float(t.d.get("width", 0.4)), 0, 0), shape=None, tags=_tags(t, [f"wall:{t.d.get('wall', 'n')}"])))
        elif u == "light":
            lift = 0.12 if isinstance(t.d.get("on"), str) else 0.0
            if t.d.get("kit") is not None:              # a light with a fitting (the user, 2026-10-31: lights as furniture): the
                try:                                    # fitting a kit thing of its own, <id>__fitting, its glass lit with the light;
                    ktype, ref = KIT.kind(t.d["kit"]), KIT.ref(t.d["kit"])   # the light just under it (the Godot export
                except ValueError:                      # writes no light source for it: GODOT_EXPORT §3b)
                    ktype = ref = None
                if ref:
                    out.append(dict(p, id=f"{t.id}__fitting", kind="mesh", shape="box", pos=t.centre, size=t.size, kit=t.d["kit"],
                                    tags=[x for x in _tags(t, [f"kit:{ktype}", f"art:{ref}", "real", f"fitting:{t.id}", "hollow"]) if not x.startswith("use:")]))
                    out.append(dict(p, kind="light", pos=(t.pos[0], t.pos[1], t.pos[2] - 0.03), size=(0, 0, 0), shape=None,
                                    tags=_tags(t, [f"fitting:{t.id}__fitting"])))
                    continue
            out.append(dict(p, kind="light", pos=(t.pos[0], t.pos[1], t.pos[2] + lift), size=(0, 0, 0), shape=None,
                            tags=_tags(t)))
        elif t.d.get("shape", "").startswith("person"):
            cast, pose = L.parse_shape(t.d["shape"])[1]
            out.append(dict(p, kind="person", pos=t.pos, size=t.size, shape=None, tags=_tags(t, [f"cast:{cast}", f"pose:{pose}"])))
        elif t.d.get("kit") is not None:            # a kit thing (docs/KIT.md): its box here; its mesh is kit/<type>_<hash>
            try:
                ktype, ref = KIT.kind(t.d["kit"]), KIT.ref(t.d["kit"])
            except ValueError:
                continue                                # story_check says why
            extra = [f"kit:{ktype}", f"art:{ref}", "real"] + (["surface"] if ktype in KIT.SURFACE else []) + (["in_wall"] if t.d.get("in_wall") else [])
            out.append(dict(p, kind="mesh", shape="box", pos=t.centre, size=t.size, kit=t.d["kit"], tags=_tags(t, extra)))
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
