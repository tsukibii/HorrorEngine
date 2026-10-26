"""Reads a game's story.json and works out where everything is. Plain Python, no `unreal` import: the offline tools
(tools/*.py) and the editor scripts (storykit.importer etc.) both use it, so the geometry is worked out once.

Story space: metres, x east, y north, z up; yaw (rot) in degrees counter-clockwise from east (90 = facing north).
Unreal space: centimetres, X = x, Y = -y, Z = z, yaw = -rot (see to_ue in importer.py).
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]          # the project folder (Content/Python/storykit/ -> up 3)
GAMES = ROOT / "Content" / "Games"                  # one folder per game: Content/Games/<Game>/story.json
STUDIO = ROOT / "Content" / "Studio"                # shared by every game: class_map.json, the runner's assets

WALL_T = 0.1          # wall thickness, centred on the room's edge
EYE = 1.65            # the player's eye height
SHAPE_ARGS = {"box": 3, "cyl": 2, "sphere": 1, "plane": 2, "stairs": 3}
USES = {"door", "pickup", "note", "inspect", "switch", "light", "locker", "combo", "use_on", "trigger", "spot", "sit", "roll",
        "carry", "game"}
PHYSICS = ("rigid", "plushie")   # how a thing you carry moves: the desk's physics kinds (tools/director/play/physics.js)
BOARD_GAMES = STUDIO / "BoardGames"   # board games' rules, one JS module each (its README.md); a game may add its own BoardGames/


def board_games(game=None):
    """{id: meta} for every board game a game can put on a table (use: game): the studio's, then the game's own (which
    win). The meta is the rules file's one line of JSON, `export const meta = {...};`: title, players, results, settings."""
    import re
    out = {}
    for d in (BOARD_GAMES, GAMES / game / "BoardGames" if game else None):
        for f in sorted(d.glob("*.js")) if d and d.is_dir() else []:
            m = None if f.name.startswith("_") else re.search(r"^export const meta = (\{.*\});$", f.read_text(encoding="utf-8"), re.M)
            try:
                if m:
                    out[f.stem] = dict(json.loads(m.group(1)), file=f.relative_to(ROOT).as_posix())
            except ValueError:
                pass
    return out
WALLS = ("n", "e", "s", "w")
# what a room is (the scene builder's labels, its colour and its built-ins; optional): Japanese homes first
ROOM_KINDS = ("genkan", "corridor", "ldk", "living", "dining", "kitchen", "washitsu", "bedroom", "service", "kids",
              "study", "bath", "washroom", "toilet", "closet", "walkin", "oshiire", "storage", "stairs", "balcony",
              "engawa", "common", "garden", "garage", "other")


def games():
    return sorted(d.name for d in GAMES.iterdir() if (d / "story.json").exists()) if GAMES.exists() else []


def story_path(game=None):
    """A game name, a path to a story.json, or nothing: the HORROR_GAME environment variable, else the only game."""
    import os
    game = game or os.environ.get("HORROR_GAME")
    if game and str(game).endswith(".json"):
        return Path(game)
    if not game:
        found = games()
        if len(found) != 1:
            raise SystemExit(f"which game? pass --game <name> (or set HORROR_GAME): {', '.join(found) or 'none yet'}")
        game = found[0]
    p = GAMES / game / "story.json"
    if not p.exists():
        raise SystemExit(f"no {p} (games: {', '.join(games()) or 'none'})")
    return p


def load(game=None):
    p = story_path(game)
    with open(p, encoding="utf-8") as f:
        return json.load(f), p


def pick_game(argv):
    """Pulls `--game X` / `-g X` out of an argument list: (game or None, the other arguments)."""
    args, game = list(argv), None
    for flag in ("--game", "-g"):
        if flag in args:
            i = args.index(flag)
            game = args[i + 1]
            del args[i:i + 2]
    return game, args


def parse_shape(s):
    """'box 1.6 0.9 0.76' -> ('box', [1.6, 0.9, 0.76]); 'person mari stand' -> ('person', ['mari', 'stand'])."""
    parts = str(s).split()
    if not parts:
        raise ValueError("empty shape")
    kind = parts[0]
    if kind == "person":
        if len(parts) < 2:
            raise ValueError("person needs a cast id: 'person <cast> [pose]'")
        return kind, [parts[1], parts[2] if len(parts) > 2 else "stand"]
    if kind == "asset":     # 'asset basemesh/headstone_01 [scale]': a library mesh at its real size (storykit/library.py)
        if len(parts) not in (2, 3):
            raise ValueError("asset takes a ref and an optional scale: 'asset basemesh/headstone_01 [1.2]'")
        return kind, [parts[1], float(parts[2]) if len(parts) > 2 else 1.0]
    if kind not in SHAPE_ARGS:
        raise ValueError(f"unknown shape {kind!r} (box, cyl, sphere, plane, stairs, person, asset)")
    if len(parts) - 1 != SHAPE_ARGS[kind]:
        raise ValueError(f"{kind} takes {SHAPE_ARGS[kind]} numbers")
    return kind, [float(x) for x in parts[1:]]


def shape_size(story, kind, args):
    """(w, d, h) in metres: the box the shape fills."""
    if kind == "box":
        return tuple(args)
    if kind == "cyl":
        return (args[0] * 2, args[0] * 2, args[1])
    if kind == "sphere":
        return (args[0] * 2,) * 3
    if kind == "plane":
        return (args[0], 0.02, args[1])
    if kind == "stairs":
        return (args[0], args[1], args[2])
    if kind == "person":
        h = (story.get("cast", {}).get(args[0]) or {}).get("height", 1.7)
        return (0.5, 0.3, h) if args[1] != "lie" else (0.5, h, 0.3)
    if kind == "asset":
        from . import library
        return library.mesh_size(*args)
    raise ValueError(kind)


def wall_length(room, wall):
    w, d, _ = room["size"]
    return w if wall in ("n", "s") else d


def wall_point(room, wall, at):
    """A point on the wall line, room-local."""
    w, d, _ = room["size"]
    return {"n": (at, d), "s": (at, 0.0), "e": (w, at), "w": (0.0, at)}[wall]


def skipped_stretches(room, wall):
    """The stretches of a wall another room builds: `skip` entries [wall, from, to] (metres along the wall from its
    west or south end). A plain wall letter in `skip` drops the whole wall instead."""
    return [(float(e[1]), float(e[2])) for e in room.get("skip", []) if isinstance(e, list) and len(e) == 3 and e[0] == wall]


def wall_skipped(room, wall, a0, a1):
    """Is the stretch a0..a1 of this wall built by another room (all of it skipped)?"""
    if wall in room.get("skip", []):
        return True
    cur = a0
    for s0, s1 in sorted(skipped_stretches(room, wall)):
        if s0 <= cur + 0.02 and s1 > cur:
            cur = s1
    return cur >= a1 - 0.02


def wall_line(room, wall):
    """World segment of a wall: ('x' or 'y' = the fixed axis, value, lo, hi)."""
    x0, y0 = room["at"][0], room["at"][1]
    w, d, _ = room["size"]
    if wall == "n":
        return ("y", y0 + d, x0, x0 + w)
    if wall == "s":
        return ("y", y0, x0, x0 + w)
    if wall == "e":
        return ("x", x0 + w, y0, y0 + d)
    return ("x", x0, y0, y0 + d)


def room_world(room, x, y, z=0.0):
    ax, ay, az = room["at"]
    return (ax + x, ay + y, az + z)


class Thing:
    """Anything with an id and a place: a room, a door, a prop (including lights, triggers, spots, people)."""
    def __init__(self, tid, kind, level, room, d, pos, size=(0.0, 0.0, 0.0), yaw=0.0):
        self.id, self.kind, self.level, self.room, self.d = tid, kind, level, room, d
        self.pos, self.size, self.yaw = pos, size, yaw   # pos = world centre of the base (x, y, z)

    @property
    def use(self):
        return self.d.get("use") if self.kind == "prop" else self.kind

    @property
    def centre(self):
        return (self.pos[0], self.pos[1], self.pos[2] + self.size[2] / 2)


def index(story):
    """All placed things by id, plus the errors met on the way (bad shapes, missing 'on', duplicate ids)."""
    things, errs = {}, []

    def add(t):
        if t.id in things:
            errs.append(f"duplicate id {t.id!r}")
        things[t.id] = t

    for lid, lvl in story.get("levels", {}).items():
        for room in lvl.get("rooms", []):
            w, d, h = room["size"]
            add(Thing(room["id"], "room", lid, room["id"], room, room_world(room, w / 2, d / 2), (w, d, h)))
            for op in room.get("openings", []):
                door = op.get("door")
                if door:
                    x, y = wall_point(room, op["wall"], op["at"])
                    yaw = 0.0 if op["wall"] in ("n", "s") else 90.0   # the panel runs along its wall
                    t = Thing(door["id"], "door", lid, room["id"], door, room_world(room, x, y, op.get("sill", 0.0)),
                              (op["w"], WALL_T, op["h"]), yaw)
                    t.wall = op["wall"]                        # which wall: a kit door faces its room from it
                    add(t)
            props = {p["id"]: p for p in room.get("props", [])}
            placed = {}

            def place(pid, depth=0):
                if pid in placed:
                    return placed[pid]
                p = props[pid]
                size = (0.0, 0.0, 0.0)
                if "shape" in p:
                    try:
                        size = shape_size(story, *parse_shape(p["shape"]))
                    except ValueError as e:
                        errs.append(f"{pid}: {e}")
                elif "kit" in p:
                    from . import kit as KIT
                    try:
                        size = KIT.size(p["kit"])
                    except ValueError as e:
                        errs.append(f"{pid}: {e}")
                elif p.get("use") == "trigger":
                    size = tuple(p.get("size", (1, 1, 2)))
                z = p.get("z")
                on = p.get("on") if isinstance(p.get("on"), str) else None
                if on:
                    if on not in props:
                        errs.append(f"{pid}: on {on!r}, which isn't a prop in room {room['id']}")
                    elif depth > 8:
                        errs.append(f"{pid}: 'on' loops")
                    elif z is None:                     # on its top; with a z of its own, at that height (a cushion
                        base = place(on, depth + 1)     # on a sofa's seat, below the sofa's back)
                        z = base.pos[2] - room["at"][2] + base.size[2]
                    else:
                        place(on, depth + 1)
                if z is None:
                    z = 0.0
                x, y = p.get("at", (0, 0))
                t = Thing(pid, "prop", lid, room["id"], p, room_world(room, x, y, z), size, float(p.get("rot", 0)))
                placed[pid] = t
                return t

            for pid in props:
                add(place(pid))
    return things, errs


def level_of(story, node):
    """The level a stitch or scene happens in (its own `level`, else the story's only level)."""
    lv = node.get("level")
    if lv:
        return lv
    levels = list(story.get("levels", {}))
    return levels[0] if levels else None


TIMES = ("day", "dusk", "night")       # a scene's time of day (STORY_FORMAT §3.1): Light Kit's Day, Dusk and Night in Unreal
TIME_DEFAULT = "night"                  # game.time when unset: the studio's dark interiors (the importer's held exposure)


def flow_outs(story, nid):
    """Where the flow can go from a node: its next, its options, a timed stitch's fail and the interrupts during it."""
    flow = story.get("flow", {})
    n = flow.get(nid) or {}
    out = [n["next"]] if n.get("next") else []
    out += [o["to"] for o in n.get("options", []) if o.get("to")]
    if n.get("type") == "stitch":
        st = story.get("stitches", {}).get(n.get("ref")) or {}
        if (st.get("timer") or {}).get("fail"):
            out.append(st["timer"]["fail"])
        for it in story.get("interrupts", []):
            during = it.get("during", "all")
            if it.get("to") and (during == "all" or n.get("ref") in (during or [])):
                out.append(it["to"])
    return out


def flow_times(story):
    """Each flow node's time of day: a scene's own `time`, else the time it was when the flow got there (the scene it
    branched from, back to game.time). {nid: {"time", "from" (the scene node that set it, or "game"), "own" (the
    scene sets it), "paths" (every time the paths into it bring, sorted)}}, the shortest path's time first; a node no
    path reaches isn't in it."""
    flow, scenes = story.get("flow", {}), story.get("scenes", {})
    game = story.get("game", {})
    came = {}                                           # nid -> {time: from}, in the order the paths found them
    todo, i = [(game.get("start"), game.get("time") or TIME_DEFAULT, "game")], 0
    while i < len(todo):                                # breadth first: the nearest scene before a node wins
        nid, t, src = todo[i]
        i += 1
        if nid not in flow or t in came.setdefault(nid, {}):
            continue
        came[nid][t] = src
        n = flow[nid]
        own = (scenes.get(n.get("ref")) or {}).get("time") if n.get("type") == "scene" else None
        for to in flow_outs(story, nid):
            todo.append((to, own or t, nid if own else src))
    out = {}
    for nid, seen in came.items():
        n = flow[nid]
        own = (scenes.get(n.get("ref")) or {}).get("time") if n.get("type") == "scene" else None
        t, src = next(iter(seen.items()))
        out[nid] = {"time": own or t, "from": nid if own else src, "own": bool(own), "paths": sorted(seen)}
    return out


def scene_version(scene):
    """A scene's playing version: its picked variant merged over the scene (clips, stage, cues), or the scene."""
    pick = scene.get("pick")
    var = (scene.get("variants") or {}).get(pick) if pick else None
    if not var:
        return scene
    merged = dict(scene)
    merged.update({k: v for k, v in var.items() if k != "label"})
    return merged


def engine_version():
    """The studio engine's version (Content/Studio/VERSION): games record it in game.built_with."""
    f = STUDIO / "VERSION"
    return f.read_text(encoding="utf-8").strip() if f.exists() else "0.0.0"


JA_MORAE = 6.5        # morae a second: a film's unhurried delivery (everyday speech runs 7 to 8)
JA_PAUSES = {"…": 0.25, "‥": 0.2, "、": 0.25, "。": 0.45, "？": 0.4, "！": 0.3, "?": 0.4, "!": 0.3, "—": 0.3, "―": 0.3}
_SMALL = set("ゃゅょぁぃぅぇぉゎャュョァィゥェォヮ")


def ja_secs(text):
    """How long a Japanese line takes to say: kana count a mora each (small ゃ ゅ ょ ride on the one before), a kanji
    about 1.7, Latin letters and digits a third each; punctuation adds its pause; plus half a second of breath."""
    morae, pause = 0.0, 0.0
    for ch in str(text):
        o = ord(ch)
        if ch in JA_PAUSES:
            pause += JA_PAUSES[ch]
        elif ch in _SMALL:
            continue
        elif 0x3040 <= o <= 0x30ff:                   # hiragana, katakana (ー and っ count: they're held)
            morae += 1
        elif 0x4e00 <= o <= 0x9fff or 0x3400 <= o <= 0x4dbf:
            morae += 1.7
        elif ch.isalnum():
            morae += 1 / 3
    return morae / JA_MORAE + pause + 0.5


def reply_secs(clip):
    """What a reply adds after its clip: the player's answer, then her answer back (the first option's), typically."""
    rp = clip.get("reply")
    if not rp:
        return 0.0
    then = next((o.get("then") for o in rp.get("options", []) if o.get("then")), None)
    return min(float(rp.get("wait", REPLY_SECS)), REPLY_ANSWER) + (clip_secs(then) if then else 0.0)


def clip_secs(clip, line_fallback=12.0):
    """A clip's length: its measured `dur` (from the take, after its trim), else the placeholder voice's `dur_tts`,
    else an estimate from the Japanese (ja_secs), else from the English at 12 characters a second plus a breath."""
    if clip.get("dur"):
        tr = clip.get("trim") or {}
        return max(0.1, float(clip["dur"]) - float(tr.get("in", 0)) - float(tr.get("out", 0)))
    if clip.get("dur_tts"):
        return float(clip["dur_tts"])
    if clip.get("ja") and any(ord(ch) > 0x3000 for ch in clip["ja"]):
        return max(1.5, ja_secs(clip["ja"]))
    return max(1.5, len(clip.get("en", "")) / line_fallback + 0.6)


def dist(a, b):
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) ** 0.5


def words(text):
    return len(str(text).split())


def line_secs(line):
    """A voice line's length: its measured 'dur' once the audio exists, else a placeholder at 15 characters a second."""
    if line.get("dur"):
        return float(line["dur"])
    if line.get("ja") and any(ord(ch) > 0x3000 for ch in line["ja"]):
        return max(1.0, ja_secs(line["ja"]))
    return max(1.5, len(line.get("en", "")) / 15.0)


# ---- the previs skeleton and pose library (Content/Studio/poses.json), shared with the director's motion.js -----

EVENT_RESULTS = {"struggle": ["escape", "caught"], "press": ["success", "fail"], "mash": ["success", "fail"],
                 "hold": ["success", "fail"], "breath": ["success", "fail"], "aim": ["success", "fail"]}
SHOT_TYPES = ("ecu", "cu", "mcu", "ms", "fs", "ws", "insert", "pov_down", "pov_up", "closeup")
# first person: a shot size is how close the subject comes to the player's eye (metres, Hall's zones); the lens is fixed
SHOT_BAND = {"ecu": (0, 0.3), "cu": (0.3, 0.55), "closeup": (0.3, 0.55), "mcu": (0.55, 0.9), "ms": (0.9, 1.6),
             "fs": (1.6, 3.0), "ws": (3.0, 1e9), "insert": (0.2, 0.7)}
EYES = {"stand": 1.65, "crouch": 1.05, "kneel": 1.2, "sit": 1.15, "lie": 0.3, "hide": 1.6}   # the player's eye height by stance
FOV_H = 90          # the game's horizontal field of view unless game.fov says otherwise
LEAN, ZOOM, PITCH = 0.35, 0.15, 75   # the most the player leans in (cam.push, m), a held focus narrows (cam.zoom), the neck (deg)


def shot_of(d):
    """The framing a subject at d metres from the eye gets."""
    return next(k for k in ("ecu", "cu", "mcu", "ms", "fs", "ws") if d < SHOT_BAND[k][1])
EASES = ("linear", "in", "out", "inout", "snap", "hold", "overshoot")
MODS = {"ease": ("in", "out"), "speed": ("x",), "ramp": ("from", "to"), "hold": ("at", "secs"), "snap": ("at", "secs"),
        "twitch": ("amount",), "trim": ("in", "out"), "loop": ("from", "to", "times"), "mirror": ()}
FITS = ("stretch", "hold", "loop", "pad", "trim")
MASKS = ("upper", "arms", "left_arm", "right_arm", "head")   # what a body layer drives (the desk's MASKS, motion.js)
MOODS = ("intimate", "dread", "panic", "reveal", "calm", "grief", "chase", "aftermath")
VOICES = ("says", "whispers", "says angrily", "screams", "murmurs", "sobs", "says softly", "says coldly", "says flatly",
          "pleads", "laughs", "giggles", "says in a trembling voice", "hisses", "gasps", "sings softly", "hums")   # docs/VOICES.md
TIERS = ("simple", "activity", "action")            # the animation budget: 80 / 15 / 5 (docs/KIMODO.md §2)
TIER_SHARE = {"simple": 0.80, "activity": 0.15, "action": 0.05}
SEG_MIN, SEG_MAX = 2.0, 10.0                         # a Kimodo motion: one behaviour, 2 to 10 seconds
CHOOSE_SECS = 30                                     # a timed choice's default (format 3)
REPLY_SECS = 6                                       # how long she waits for a reply before she carries on
REPLY_ANSWER = 2.5                                   # how long a player takes to pick a reply, typically
# the gameplay between scenes (format 3 `play`): simple rules the Roblox generation knows; each type's results
PLAYS = {"hide": ["hidden", "found"], "run": ["escaped", "caught"], "collect": ["done", "failed"],
         "sneak": ["made_it", "spotted"], "hold": ["held", "broke"], "search": ["found", "out_of_time"],
         "escape": ["out", "caught"]}
# a play's gameplay assets: the seeker's looped motions by role, and the lines she calls out by moment (barks)
PLAY_ROLES = ("wait", "count", "search", "patrol", "chase", "found", "idle")
BARK_MOMENTS = ("start", "count", "search", "near", "found", "lost", "taunt", "chase")
# how a room sounds (format 3 room `acoustics`; the importer gives each room a reverb, docs/UNREAL_FLOW.md)
ACOUSTICS = ("closet", "bathroom", "bedroom", "small_room", "kitchen", "living_room", "hallway", "stairwell",
             "basement", "large_hall", "church", "outdoors", "car")


def acoustics_of(room):
    """A room's acoustics: its own `acoustics`, else a guess from its size, floor and ceiling."""
    if room.get("acoustics"):
        return room["acoustics"]
    w, d = float(room["size"][0]), float(room["size"][1])
    area, long_ = w * d, max(w, d) / max(0.1, min(w, d))
    if room.get("ceiling") is False:
        return "outdoors"
    if area < 3:
        return "closet"
    if room.get("floor") == "tile":
        return "bathroom" if area < 8 else "kitchen"
    if long_ > 2.5:
        return "hallway"
    if area > 60:
        return "large_hall"
    return "small_room" if area < 14 else "living_room"


def minimax_prompt(clip, cast=None):
    """The MiniMax image-to-video prompt for a take (docs/VOICES.md): the expression and the voice around the line.
    `<subject> makes <a|an> <expr> while <subject> <voice> <d>[Japanese] <ja> </d>`; an unseen speaker is an
    off-screen voice with the lips still."""
    who = (cast or {}).get(clip.get("who"), {})
    subj = who.get("subject", "she")
    voice = clip.get("voice") or "says"
    line = f"<d>[Japanese] {clip.get('ja', '')} </d>"
    if clip.get("face") is False:
        return f"an off-screen voice {voice}, no one on screen speaks {line}"
    expr = (clip.get("expr") or "neutral expression").strip()
    art = "" if expr.lower().startswith(("a ", "an ", "the ", "her ", "his ")) else ("an " if expr[0].lower() in "aeiou" else "a ")
    out = f"{subj} makes {art}{expr} while {subj} {voice} {line}"
    if clip.get("reply") or clip.get("wait_expr"):    # a hanging line: the take ends on her waiting for the answer
        w = (clip.get("wait_expr") or "hopeful, expectant expression").strip()
        out += f", then {subj} makes {'' if w.lower().startswith(('a ', 'an ')) else ('an ' if w[0].lower() in 'aeiou' else 'a ')}{w} and waits silently"
    return out


def reply_clips(clip):
    """A clip's reply answers as clips of their own: (option id, clip); their takes are <take id>_<option id>."""
    for o in (clip.get("reply") or {}).get("options", []):
        if o.get("then"):
            yield o["id"], dict({"who": clip.get("who")}, **o["then"], id=f"{clip.get('id')}_{o['id']}")


def karma_of(delta, axis="karma"):
    """A karma delta as {axis: n}: an int is the default axis."""
    if delta is None:
        return {}
    if isinstance(delta, (int, float)):
        return {axis: float(delta)}
    return {k: float(v) for k, v in delta.items()}


def karma_axes(story):
    k = story.get("game", {}).get("karma") or {}
    return k.get("axes") or {"karma": {"min": -10, "max": 10}}


def event_results(ev):
    if ev.get("play"):                                # a gameplay stitch read as an event (format 3)
        return PLAYS.get(ev["play"].get("type"), ["success", "fail"])
    if ev.get("type") == "choose":
        return [o.get("id") for o in ev.get("options", [])]
    return EVENT_RESULTS.get(ev.get("type"), ["success", "fail"])


def poses():
    return json.loads((STUDIO / "poses.json").read_text(encoding="utf-8"))


def _quat_euler(x, y, z):
    """Euler XYZ degrees (three.js order 'XYZ': R = Rx * Ry * Rz) to a quaternion (x, y, z, w)."""
    import math
    cx, sx = math.cos(math.radians(x) / 2), math.sin(math.radians(x) / 2)
    cy, sy = math.cos(math.radians(y) / 2), math.sin(math.radians(y) / 2)
    cz, sz = math.cos(math.radians(z) / 2), math.sin(math.radians(z) / 2)
    return (sx * cy * cz + cx * sy * sz, cx * sy * cz - sx * cy * sz, cx * cy * sz + sx * sy * cz, cx * cy * cz - sx * sy * sz)


def _qmul(a, b):
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return (aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx,
            aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz)


def _qrot(q, v):
    x, y, z, w = q
    ix, iy, iz, iw = w * v[0] + y * v[2] - z * v[1], w * v[1] + z * v[0] - x * v[2], w * v[2] + x * v[1] - y * v[0], -x * v[0] - y * v[1] - z * v[2]
    return (ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x)


def pose_positions(lib, name, height=1.7):
    """Joint positions (character space: y up, z forward, x the character's left; metres) of a library pose: the
    same forward kinematics as the director's motion.js, for motion jobs' keyframes and offline checks."""
    import math
    sk, p = lib["skeleton"], lib["poses"][name]
    s = height / sk["height"]
    yaw = math.radians(p.get("yaw", 0))
    yq = (0.0, math.sin(yaw / 2), 0.0, math.cos(yaw / 2))
    base = _qmul(yq, _quat_euler(*p.get("root_rot", (0, 0, 0))))
    root = p.get("root", (0, 0, 0))
    rot, pos = {}, {}
    for jn, parent, off in sk["joints"]:
        q = _quat_euler(*p.get(jn, (0, 0, 0)))
        if parent is None:
            r = _qrot(yq, root)
            pos[jn] = (off[0] + r[0], off[1] + r[1], off[2] + r[2])
            rot[jn] = _qmul(base, q)
        else:
            o = _qrot(rot[parent], off)
            pp = pos[parent]
            pos[jn] = (pp[0] + o[0], pp[1] + o[1], pp[2] + o[2])
            rot[jn] = _qmul(rot[parent], q)
    return {k: (v[0] * s, v[1] * s, v[2] * s) for k, v in pos.items()}
