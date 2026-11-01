"""A desk game as a Director project (the user, 2026-11-01: "when we export from director to godot it now follows this
format/new system too"; docs/GODOT_DIRECTOR.md §6d): the desk's story (Content/Games/<G>/story.json) turned into what
the Director plugin builds a game from, plain Python:

- world(story, out): the world in Godot's axes for desk/desk_build.gd: each level's rooms (HSRoom: the desk's box, its
  walls where the desk has them, its doorways and windows, its textures), doors (HSDoor in its doorway), things (HSThing:
  the desk's use as the Director's, its words, its model: a kit thing, a library mesh or a shape of its size), people
  (HSActor: who she is, her body), spots, areas, paths and lights. The meshes and textures go into the project.
- director_file(story): the Director file: each task (stitch) a quest (its first beat's to-dos its steps, its objective,
  the rest of what it starts with, its timer), each other beat a moment during it, its endings; what the Director file
  doesn't say itself goes in as it was: the cutscenes and the desk's choices as items in the quest list (a scene, a
  choice by what the player does, by a scene's result, by flags, by karma: the runtime plays them as the export does),
  and under `desk` the scenes, lines, sounds, motions, secrets, trigger cutscenes and more of the items', cast's and
  game's words.

Ids are the desk's: a quest is its flow node's id, so every way between them, the timers' and the trigger cutscenes'
land where they did. tools/godot_director.py from-desk builds a project from them."""
import json
import math
import re
import shutil
from pathlib import Path

from . import storylib as L
from . import kit as KIT
from . import library as LIB
from . import life as LIFE
from . import godot as G

T = L.WALL_T                                             # the desk's walls: 10 cm, centred on a room's edge
FRAME = 0.05                                             # HSRoom's door frame each side (room.gd FRAME): a door's leaf this much inside its doorway
FLOORS = {"wood": "wood", "stone": "stone", "tile": "tile", "carpet": "carpet", "dirt": "dirt", "metal": "metal", "water": "water",
          "concrete": "stone", "marble": "tile", "tatami": "wood", "grass": "dirt", "gravel": "dirt", "mud": "dirt", "sand": "dirt", "snow": "dirt"}
USES = {"pickup": "pickup", "note": "note", "inspect": "inspect", "switch": "switch", "breaker": "breaker", "sit": "sit", "sleep": "sleep",
        "locker": "hide", "carry": "carry", "roll": "roll", "combo": "code", "use_on": "use_item", "clean": "clean", "game": "game"}
SIDES = {"n": "north", "s": "south", "e": "east", "w": "west"}
SKIP_FIELDS = {"id", "use", "at", "rot", "z", "on", "shape", "kit", "art", "hidden", "tag", "note", "item", "text", "code", "then",
               "needs", "consume", "if", "see_through", "with", "stain", "game", "life", "state", "light", "name", "size", "safe"}


def gyaw(yaw):
    """A desk facing (degrees from east toward north) as a Director node's turn: its +Z is where it faces."""
    return float(yaw or 0.0) + 90.0


def opening(room, wall, at, w, h, sill, op=None):
    """A desk opening (`at` metres along its wall from the west or south end) as an HSOpening's (from the wall's middle,
    east of it on a north or south wall, south of it on an east or west one), with a window's words: its glass
    (`window`), its daylight (every window and sill, as the export lights them: godot.py windows()), its `shaft` and a
    car passing (`sweep`)."""
    rw, rd, _ = room["size"]
    off = at - rw / 2 if wall in ("n", "s") else rd / 2 - at
    o = {"side": SIDES[wall], "offset": round(off, 4), "width": round(w, 4), "height": round(h, 4), "sill": round(sill, 4)}
    if op:
        if op.get("window"):
            o["glass"] = True
        if op.get("window") or (op.get("sill") or 0) > 0.05:
            o["daylight"] = True
        sh = op.get("shaft")
        if sh not in (None, False):
            o["shaft"] = 1.0 if sh is True else float(sh)
            for k in ("reach", "dust"):
                if op.get(k) is not None:
                    o["shaft_" + k] = float(op[k])
        sw = op.get("sweep")
        if sw not in (None, False):
            o["sweep_on"] = True
            for k in ("every", "secs", "out", "span", "energy", "aim"):
                if isinstance(sw, dict) and sw.get(k) is not None:
                    o["sweep_" + k] = float(sw[k])
    return o


def leak(room, tid, d, pos):
    """A desk leak (`use: leak` on a room's wall, its `at` by it and `z` where the water comes in) as an HSRoomLeak's
    words: its side, along the wall from its middle as an opening is, how high above the room's floor."""
    wall = d.get("wall", "n")
    x0, y0, z0 = room["at"]
    rw, rd, _ = room["size"]
    off = pos[0] - (x0 + rw / 2) if wall in ("n", "s") else (y0 + rd / 2) - pos[1]
    return {"id": tid, "side": SIDES[wall], "offset": round(off, 4), "height": round(pos[2] - z0, 4),
            "width": float(d.get("width", 0.4)), "drip": float(d.get("drip", 2.6)), "wet": float(d.get("wet", 0.8))}


def material(ref, out):
    """A library texture set (a room's `look`) as the builder's material spec, its maps copied into the project
    (game/textures/<set>/, a DirectX normal's green flipped for Godot); None when the set isn't on the shelf."""
    meta, src = LIB.texture_meta(ref), LIB.texture_dir(ref)
    if not meta or not src.is_dir() or "albedo" not in meta.get("maps", {}):
        return None
    safe = re.sub(r"[^A-Za-z0-9_]+", "_", ref)
    dst = out / "game" / "textures" / safe
    dst.mkdir(parents=True, exist_ok=True)
    maps, spec = meta["maps"], {"tile": float(meta.get("tile_m") or 2.0)}
    for slot in ("albedo", "rough", "ao", "metal", "orm"):
        if slot in maps and (src / maps[slot]).exists():
            if not (dst / maps[slot]).exists():
                shutil.copy(src / maps[slot], dst / maps[slot])
            spec[slot] = f"res://game/textures/{safe}/{maps[slot]}"
    normal = maps.get("normal") or maps.get("normal_dx")
    if normal and (src / normal).exists():
        name = normal
        if meta.get("normal") == "dx" or maps.get("normal_dx") == normal:
            name = re.sub(r"\.(png|jpe?g)$", "", normal) + "_gl.png"
            if not (dst / name).exists() and not G.flip_green(src / normal, dst / name):
                name = None
        elif not (dst / name).exists():
            shutil.copy(src / normal, dst / name)
        if name:
            spec["normal"] = f"res://game/textures/{safe}/{name}"
    return spec


def mesh(ref, out):
    """A library mesh (a kit thing's kit/<type>_<hash>, a basemesh/<name>) copied into the project (game/meshes/), its
    res:// path; None without the file."""
    src = LIB.mesh_file(ref)
    if not src.exists():
        return None
    dst = out / "game" / "meshes" / src.parent.name / src.name
    dst.parent.mkdir(parents=True, exist_ok=True)
    if not dst.exists():
        shutil.copy(src, dst)
    return f"res://game/meshes/{src.parent.name}/{src.name}"


def art_xform(ref, size, real):
    """Where a mesh sits in its thing, from the thing's base (the export's art_transform, from its centre): a kit thing's
    origin is its base's centre; a library mesh centred and rested on the base, scaled evenly into the box unless it's
    `real`. Transform3D's twelve numbers (the basis' columns, then the origin)."""
    w, d, h = size
    if ref.startswith("kit/"):
        return [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]
    b = G.glb_bounds(LIB.mesh_file(ref))
    if b is None:
        return [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]
    lo, hi = b
    sz = [hi[i] - lo[i] for i in range(3)]
    k = 1.0 if real else min([want / s for want, s in zip((w, h, d), sz) if s > 0.001] or [1.0])
    c = [(lo[i] + hi[i]) / 2 for i in range(3)]
    return [k, 0, 0, 0, k, 0, 0, 0, k, -c[0] * k, -lo[1] * k, -c[2] * k]


def model_of(t, story, out):
    """A prop's look in its thing (turned back by the thing's own quarter turn: `turn`): a kit thing's mesh, a library
    mesh (`asset`, or a shape with `art`), else its shape at its size; None when it has none (a light, a spot)."""
    d = t.d
    if d.get("kit") is not None:
        try:
            ref = KIT.ref(d["kit"])
        except ValueError:
            ref = None
        p = mesh(ref, out) if ref else None
        if p:
            return {"path": p, "xform": art_xform(ref, t.size, True), "turn": -90}
    shape = d.get("shape") or ""
    kind, args = L.parse_shape(shape) if shape else (None, None)
    art = d.get("art") if isinstance(d.get("art"), str) else (args[0] if kind == "asset" else None)
    if art:
        p = mesh(art, out)
        if p:
            return {"path": p, "xform": art_xform(art, t.size, kind == "asset"), "turn": -90}
    w, dd, h = t.size
    if kind == "stairs":
        sw, run, rise = args
        n = max(1, round(rise / 0.18))
        steps = []
        for i in range(n):
            dy = -run / 2 + run / n * (i + 0.5)
            sh = rise / n * (i + 1)
            steps.append({"at": [0.0, sh / 2, -dy], "size": [sw, sh, run / n]})   # the steps climb the thing's own +y (north at rot 90)
        return {"steps": steps, "turn": -90}
    if kind == "cyl":
        return {"cyl": [max(w, dd) / 2, h], "turn": -90}
    if kind == "sphere":
        return {"sphere": max(w, dd, h) / 2, "turn": -90}
    if w > 0 and h >= 0:
        return {"box": [w, max(h, 0.005), dd], "turn": -90}
    return None


def world(story, out):
    """The desk's levels as the builder's world (Godot's axes), the meshes and textures copied into out; and the kit's
    sockets (game/kit.json) for the little things' effects."""
    out = Path(out)
    things, errs = L.index(story)
    if errs:
        raise ValueError("; ".join(errs))
    notes, items, cast = story.get("notes") or {}, story.get("items") or {}, story.get("cast") or {}
    kit_index, levels, placed_cast = {}, [], set()
    for lid, lvl in story.get("levels", {}).items():
        L_ = {"id": lid, "start": lvl.get("start", ""), "rooms": [], "doors": [], "things": [], "actors": [], "spots": [],
              "triggers": [], "paths": [], "lights": []}
        for k, ok in (("look", ("balanced", "realism", "plain")), ("weather", ("clear", "rain"))):
            if lvl.get(k) in ok:
                L_[k] = lvl[k]                            # this level's own, over the game's (STORY_FORMAT §2: a flat-lit annex)
        for room in lvl.get("rooms", []):
            x0, y0, z0 = room["at"]
            w, d, h = room["size"]
            walls, ops = 0, []
            for side, bit in (("n", 1), ("s", 2), ("e", 4), ("w", 8)):
                if side not in room.get("skip", []):
                    walls |= bit
            for op in room.get("openings", []):
                if op.get("door"):
                    continue                              # a door cuts its own
                ops.append(opening(room, op["wall"], op["at"], op["w"], op["h"], op.get("sill", 0.0), op))
            for e in room.get("skip", []):                # a stretch another room builds: a hole as high as the room
                if isinstance(e, list) and len(e) == 3:
                    a0, a1 = float(e[1]), float(e[2])
                    ops.append(opening(room, e[0], (a0 + a1) / 2, a1 - a0, h, 0.0))
            mats = {}
            for part in ("floor", "walls", "ceiling"):
                ref = (room.get("look") or {}).get(part)
                if ref:
                    spec = material(ref, out)
                    if spec:
                        mats[part] = spec
            L_["rooms"].append({"id": room["id"], "pos": list(G.s2g((x0 + w / 2, y0 + d / 2, z0))), "size": [w - T, h, d - T], "wall": T,
                                "walls": walls, "floor_on": True, "ceiling_on": bool(room.get("ceiling", True)),
                                "floor_kind": FLOORS.get(room.get("floor", "wood"), "wood"), "openings": ops, "materials": mats,
                                "wet": float(room.get("wet", 0) or 0)})
            for op in room.get("openings", []):           # its doors, in their doorways
                door = op.get("door")
                if not door:
                    continue
                t = things[door["id"]]
                style = ""
                if door.get("kit") is not None:
                    try:
                        style = KIT.resolve(door["kit"]).get("style") or ""
                    except ValueError:
                        style = ""
                dr = {"id": door["id"], "pos": list(G.s2g(t.pos)), "yaw": t.yaw, "width": max(0.4, op["w"] - 2 * FRAME),
                      "height": max(1.0, op["h"] - FRAME), "hinge": door.get("hinge", "left"), "sliding": style in ("slide", "shoji")}
                for k in ("locked_by", "peephole", "latch"):
                    if door.get(k) not in (None, False, ""):
                        dr[k] = door[k]
                L_["doors"].append(dr)
        for tid, t in things.items():
            if t.level != lid or t.kind != "prop":
                continue
            d, u = t.d, t.use
            if u == "spot":
                L_["spots"].append({"id": tid, "pos": list(G.s2g(t.pos)), "yaw": gyaw(t.yaw)})
            elif u == "trigger":
                w, dd, h = t.size
                L_["triggers"].append({"id": tid, "pos": list(G.s2g(t.pos)), "size": [w, h, dd], "safe": bool(d.get("safe"))})
            elif u == "light":
                kind = d.get("kind") or "bulb"
                c, energy, rng = G.LIGHTS.get(kind, G.LIGHTS["bulb"])
                lift = 0.12 if isinstance(d.get("on"), str) else 0.0
                li = {"id": tid, "pos": list(G.s2g((t.pos[0], t.pos[1], t.pos[2] + lift))),
                      "color": [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255], "energy": energy, "range": rng,
                      "on": d.get("lit") is not False, "size": {"bulb": 0.06, "lamp": 0.15, "candle": 0.02, "fire": 0.3}.get(kind, 0.06),
                      "light": dict({"kind": kind}, **{k: d[k] for k in ("flicker", "mode", "interval", "rate", "letters") if k in d})}
                if d.get("pattern") in G.PATTERNS and isinstance(d.get("aim"), list) and len(d["aim"]) == 3:
                    # a pattern in its light: a spot aimed at `aim` (room metres), its cone `spread` wide (the export's; HSPatternLight here)
                    room = next((r for r in lvl.get("rooms", []) if r["id"] == t.room), None)
                    ra = list((room or {}).get("at") or [0, 0, 0]) + [0, 0, 0]
                    li["pos"] = list(G.s2g(t.pos))
                    li["pattern"] = dict({"pattern": d["pattern"], "aim": list(G.s2g([float(d["aim"][i]) + float(ra[i]) for i in range(3)])),
                                          "spread": float(d.get("spread", 50))}, **{k: d[k] for k in ("scale", "speed", "open", "angle") if k in d})
                L_["lights"].append(li)
            elif u == "leak":                             # water down a wall: one of its room's leaks (HSRoomLeak)
                room = next((r for r in lvl.get("rooms", []) if r["id"] == t.room), None)
                rec = next((r for r in L_["rooms"] if r["id"] == t.room), None)
                if room is not None and rec is not None:
                    rec.setdefault("leaks", []).append(leak(room, tid, d, t.pos))
            elif (d.get("shape") or "").startswith("person"):
                who, _pose = L.parse_shape(d["shape"])[1]
                c = cast.get(who) or {}
                body = c.get("previs_body") or "MHR.fbx"
                a = {"id": tid, "cast": who if who != tid else "", "pos": list(G.s2g(t.pos)), "yaw": gyaw(t.yaw),
                     "height": float(c.get("height") or 1.62), "display_name": c.get("name") or who, "hidden_at_start": bool(d.get("hidden")),
                     "solid": False, "behaviour": "idle"}
                if isinstance(body, str) and body.startswith("people/"):
                    a["studio_character"] = body[7:]
                else:
                    a["body"] = "res://bodies/MHR.fbx"
                L_["actors"].append(a)
                placed_cast.add(who)
            else:
                use = USES.get(u, "none")
                life = LIFE.life_of(d)
                if life:
                    use = "life"
                f, extra = {}, {}
                if use in ("pickup", "carry"):
                    iid = d.get("item") or tid
                    f["item"] = iid
                    f["item_name"] = (items.get(iid) or {}).get("name") or ""
                    if (items.get(iid) or {}).get("torch"):
                        f["flashlight"] = True
                elif use == "note":
                    nid = d.get("note") or tid
                    f["note"] = nid
                    f["note_title"] = (notes.get(nid) or {}).get("title") or nid
                    f["note_text"] = (notes.get(nid) or {}).get("text") or ""
                elif use == "inspect":
                    f["inspect_text"] = d.get("text") or ""
                elif use == "code":
                    f["code"] = str(d.get("code", ""))
                    if d.get("then"):
                        f["opens_flag"] = d["then"]
                elif use == "use_item":
                    f["needs_item"] = d.get("needs") or ""
                    if d.get("then"):
                        f["opens_flag"] = d["then"]
                    if "consume" in d:
                        f["consume"] = bool(d["consume"])
                elif use == "sleep":
                    if d.get("if"):
                        f["sleep_needs"] = [str(x) for x in (d["if"] if isinstance(d["if"], list) else [d["if"]])]
                elif use == "hide":
                    if "see_through" in d:
                        f["see_through"] = float(d["see_through"])
                elif use == "clean":
                    if d.get("stain"):
                        f["stain"] = d["stain"]
                    if d.get("with"):
                        f["clean_with"] = d["with"]
                elif use == "game":
                    if d.get("game"):
                        f["board_game"] = d["game"]
                elif use == "life":
                    f["life"] = life
                    if d.get("state"):
                        f["life_state"] = d["state"]
                if d.get("hidden"):
                    f["hidden_at_start"] = True
                if d.get("name"):
                    f["display_name"] = d["name"]
                for k, v in d.items():                    # the rest of the runtime's words for it, as they were
                    if k not in SKIP_FIELDS:
                        extra[k] = v
                tags = []
                if d.get("tag"):
                    tags.append(f"tag:{d['tag']}")
                if d.get("kit") == "mirror" and d.get("tag") != "mirror":
                    tags.append("tag:mirror")            # a kit mirror reflects the room (play.gd mirror_attach: the export's piece says it by its kit)
                if d.get("kit") is not None:
                    try:
                        ref = KIT.ref(d["kit"])
                        tags += [f"kit:{KIT.kind(d['kit'])}", f"art:{ref}"]
                        if LIB.mesh_info(ref):
                            kit_index[ref] = LIB.mesh_info(ref)
                    except ValueError:
                        pass
                if d.get("use") and d["use"] not in USES and d["use"] not in ("talk",):
                    tags.append(f"use:{d['use']}")
                if tags:
                    extra["tags"] = tags
                th = {"id": tid, "use": use, "pos": list(G.s2g(t.pos)), "yaw": gyaw(t.yaw), "fields": f, "model": model_of(t, story, out)}
                if use == "switch" and d.get("light"):
                    th["switches"] = d["light"] if isinstance(d["light"], list) else [d["light"]]
                if use == "life" and isinstance(d.get("light"), str):
                    th["life_light"] = d["light"]               # a candle's flame: lit while it burns
                if extra:
                    th["extra"] = extra
                L_["things"].append(th)
        for rid, pts in (lvl.get("routes") or {}).items():   # a route: its spots in turn, or its points
            out_pts = []
            for p in pts if isinstance(pts, list) else pts.get("points", []):
                at = p if isinstance(p, str) else (p.get("at") or p.get("spot")) if isinstance(p, dict) else None
                if not isinstance(at, str) or at not in things:
                    continue
                pt = {"pos": list(G.s2g(things[at].pos)), "yaw": gyaw(things[at].yaw)}   # she waits facing the spot's way
                if isinstance(p, dict):
                    if p.get("wait"):
                        pt["wait"] = float(p["wait"])
                    for k in ("pose", "check"):
                        if p.get(k):
                            pt[k] = str(p[k])
                out_pts.append(pt)
            if len(out_pts) >= 2:
                L_["paths"].append({"id": rid, "points": out_pts, "mode": (pts.get("mode") if isinstance(pts, dict) else None) or "loop"})
        levels.append(L_)
    first = levels[0] if levels else None                 # a cast member with no figure of her own: one in the first level, out of it till the story brings her
    for who, c in cast.items():
        if who in placed_cast or first is None:
            continue
        st = next((s for s in first["spots"] if s["id"] == first["start"]), None)
        a = {"id": who, "pos": st["pos"] if st else [0, 0, 0], "yaw": st["yaw"] if st else 90.0, "height": float(c.get("height") or 1.62),
             "display_name": c.get("name") or who, "hidden_at_start": True, "behaviour": "off", "solid": False}
        body = c.get("previs_body") or "MHR.fbx"
        if isinstance(body, str) and body.startswith("people/"):
            a["studio_character"] = body[7:]
        else:
            a["body"] = "res://bodies/MHR.fbx"
        first["actors"].append(a)
    g = story.get("game") or {}
    game = {"title": g.get("title") or g.get("id") or "Game", "time_of_day": g.get("time") or L.TIME_DEFAULT}
    for k, gk in (("player_name", "player_name"), ("fov", "fov"), ("look", "look"), ("vhs", "vhs"), ("grade", "grade"), ("ui_theme", "ui_theme"),
                  ("weather", "weather"), ("lighting", "lighting")):
        if g.get(gk) not in (None, ""):
            game[k] = g[gk]
    if isinstance(g.get("counters"), dict):
        game["counters"] = list(g["counters"].keys())
    (out / "game").mkdir(parents=True, exist_ok=True)
    (out / "game" / "kit.json").write_text(json.dumps(kit_index, separators=(",", ":")), encoding="utf-8")
    return {"game": game, "levels": levels}


# ---- the story -----------------------------------------------------------------------------------------------------
TODO_KEYS = {"todo", "text", "ticks", "fails", "secs", "hidden", "who"}


def _cond(b):
    """A beat's condition (its `if` flags, a counter's range) as the Director's: a list that's all of it."""
    c = [str(x) for x in (b.get("if") or [])] if isinstance(b.get("if"), list) else ([str(b["if"])] if b.get("if") else [])
    if b.get("count"):
        cc = {"count": b["count"]}
        if "min" in b:
            cc["at_least"] = b["min"]
        if "max" in b:
            cc["at_most"] = b["max"]
        c.append(cc)
    return c


def _moment(qid, b):
    m = {"id": f"{qid}__{b.get('id', 'beat')}", "when": b.get("when"), "do": list(b.get("do") or []), "during": [qid]}
    c = _cond(b)
    if c:
        m["if"] = c
    if b.get("repeat"):
        m["once"] = False
        m["every"] = float(b.get("every", 0.1))
    for k, v in b.items():                                # the beat's own words (optional, a secret, a label...)
        if k not in ("id", "when", "do", "if", "count", "min", "max", "repeat", "every"):
            m[k] = v
    return m


def _quest(nid, node, st, moments):
    q = {"id": nid, "title": st.get("title") or nid, "finish": "never", "checkpoint": False}
    if st.get("level"):
        q["map"] = st["level"]
    beats = list(st.get("beats") or [])
    start = next((b for b in beats if isinstance(b.get("when"), dict) and b["when"].get("start") is True and len(b["when"]) == 1
                  and not b.get("if") and not b.get("repeat") and not b.get("count")), None)
    steps, on_start, objective = [], [], None
    if start is not None:
        beats.remove(start)
        for a in start.get("do") or []:
            if isinstance(a, dict) and isinstance(a.get("todo"), str) and set(a) <= TODO_KEYS:
                s = {"id": a["todo"], "text": a.get("text") or a["todo"]}
                for k, sk in (("ticks", "done"), ("fails", "fail"), ("secs", "secs"), ("hidden", "hidden"), ("who", "who")):
                    if a.get(k) not in (None, False):
                        s[sk] = a[k]
                steps.append(s)
            elif isinstance(a, dict) and set(a) == {"objective"} and objective is None and isinstance(a["objective"], str):
                objective = a["objective"]
            else:
                on_start.append(a)
    q["objective"] = objective if objective is not None else ""
    q["steps"] = steps
    if on_start:
        q["on_start"] = on_start
    if isinstance(st.get("play"), dict):            # a round of gameplay (STORY_FORMAT §9.8): played instead of steps, its result ends it
        q["round"] = st["play"]
    tm = st.get("timer")
    if isinstance(tm, dict) and tm.get("secs"):
        q["time_limit"] = float(tm["secs"])
        if tm.get("fail"):
            q["on_timeout"] = tm["fail"]
        if tm.get("label"):
            q["time_label"] = tm["label"]
    for b in beats:
        moments.append(_moment(nid, b))
    return q


def director_file(story):
    """The desk's story as the Director file (its shape: story/story_file.gd)."""
    flow = story.get("flow") or {}
    order = G.play_order(story)
    ref_of = {n.get("ref"): nid for nid, n in flow.items() if n.get("type") == "stitch"}
    quests, endings, moments = [], [], []
    for nid in order:
        n = flow[nid]
        t = n.get("type")
        if t == "stitch":
            st = (story.get("stitches") or {}).get(n.get("ref"), {})
            quests.append(_quest(nid, n, st, moments))
        elif t == "ending" and set(n) <= {"type", "kind", "title", "text"}:
            endings.append({"id": nid, "kind": n.get("kind", "neutral"), "title": n.get("title", ""), "text": n.get("text", "")})
        else:
            quests.append({"id": nid, "desk": n})       # a scene, a choice (an ending with more to it): as the desk has it
    ids = [q["id"] for q in quests]
    for i, q in enumerate(quests):                        # a quest's next: where its task went, said when it isn't the item after it
        if "desk" in q:
            continue
        nx = flow[q["id"]].get("next")
        after = ids[i + 1] if i + 1 < len(ids) else None
        if nx and nx != after:
            q["next"] = [{"go": nx}]
    desk = {}
    for k in ("scenes", "lines", "sounds", "motions", "secrets", "items", "cast"):
        if story.get(k):
            desk[k] = story[k]
    if story.get("interrupts"):                           # the trigger cutscenes: `during` a task's quest (its flow node), not its stitch
        desk["interrupts"] = []
        for it in story["interrupts"]:
            it = dict(it)
            if isinstance(it.get("during"), list):
                it["during"] = [ref_of.get(x, x) for x in it["during"]]
            desk["interrupts"].append(it)
    g = {k: v for k, v in (story.get("game") or {}).items() if k not in ("id", "start", "title", "target_min", "fast_min", "note", "clip_max", "voice", "text")}
    if g:
        desk["game"] = g
    out = {"format": 1, "quests": quests, "moments": moments, "talk": {}, "states": [], "endings": endings, "achievements": [], "facts": {}, "desk": desk}
    for a in story.get("achievements") or []:            # the desk's achievements, as the Director keeps them (Steam later)
        if isinstance(a, dict) and a.get("id"):
            when = a.get("when") if a.get("when") is not None else (a.get("flag") or a.get("if"))
            out["achievements"].append({"id": a["id"], "title": a.get("title", a["id"]), "text": a.get("text", a.get("hint", "")),
                                        "hidden": bool(a.get("hidden")), "when": when})
    return out
