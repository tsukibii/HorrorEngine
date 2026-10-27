#!/usr/bin/env python3
"""The offline story check: no editor needed, runs in a second.

    python tools/story_check.py [--game Pilot] [-v] [--route Saved/Story/<game>/route.json] [--story FILE]

Checks every reference (world, scenes, stitches, flow), walls and doors, scenes' clips (each fits one take of
game.clip_max seconds; every cut between takes has a seam to hide it), subtitles' reading speed, combination codes
written somewhere, the directing rules. Then plays the story down every path (each player choice and struggle
result both ways; flag choices as the flags fall) with a greedy player in the stitches, proving every path reaches
an ending with no softlock, and estimates the playtime per ending. Ends `STORY ok (...)` or `STORY FAILED (n errors)`.
"""
import copy
import math
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "Content" / "Python"))
from storykit import storylib as L  # noqa: E402
from storykit import library as LIB  # noqa: E402
from storykit import kit as KIT  # noqa: E402
from storykit import life as LIFE  # noqa: E402

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")   # Windows consoles default to cp1252; the script is Japanese

TRIGGERS = {"start", "enter", "exit", "use", "pickup", "read", "look", "after", "flag", "all", "any", "caught", "rolled", "hidden",
            "answered", "carrying", "dropped", "played", "state", "ticked", "failed"}
TRIGGER_EXTRA = {"secs", "within", "face", "at_least", "option", "in", "result", "is"}
BOARDS = {}                 # the board games this game's tables can have (storylib.board_games), set in main
ACTIONS = {"say", "think", "sound", "music", "light", "door", "show", "hide", "move", "objective", "flag", "unflag",
           "give", "take", "wait", "fade", "lookat", "shot", "seq", "anim", "stalker", "trick", "checkpoint", "done",
           "karma", "count", "scene", "behave", "ask", "state", "todo", "tick", "fail", "untodo", "chapter"}
ASK_SECS = 3.0              # the walker's time to answer an ask
MUSIC = {"silence", "calm", "uneasy", "dread", "chase"}
LIGHT_SET = {"on", "off", "flicker", "dim"}
DOOR_SET = {"lock", "unlock", "open", "close", "slam"}
STALKER = {"spawn", "despawn", "patrol", "hunt", "chase"}
BEHAVE = {"idle": ("at",), "sit": ("at",), "path": ("route",), "patrol": ("routes",), "off": ()}   # a cast member in play: what each needs
ROUTE_MODES = {"loop", "pingpong", "once"}
SIGHT = {"angle", "range", "crouched", "meter", "drain", "calm"}      # behave sees: the play runtime's SIGHT
TRICKS = {  # name: (required fields, seconds it takes)
    "swap": ({"hide", "show"}, 0), "slam_behind": ({"door"}, 2), "lights_die": ({"room"}, 3),
    "glimpse": ({"figure"}, 2), "knock": ({"at"}, 3), "whisper": ({"line", "at"}, 0),
    "jumpscare": ({"figure"}, 3), "loop_hall": ({"trigger", "back_to"}, 0), "cut_away": ({"lookat", "then"}, 2),
}
SEAMS = {  # kind: (fields it needs, seconds it adds)
    "none": (set(), 0.0), "blink": (set(), 0.2), "glance": ({"look"}, 1.0), "flicker": (set(), 0.4),
    "occlude": (set(), 0.8), "cutaway": ({"look"}, 1.5), "turn": (set(), 0.0), "stumble": (set(), 1.0),
    "dip": (set(), 2.0), "jcut": (set(), 0.0), "heartbeat": (set(), 0.6),
}
CAMERA = {"free", "soft", "hard", "held"}
PULLS = {"back", "left", "right", "down", "any"}
EVENTS = {"struggle", "press", "mash", "hold", "breath", "aim", "choose"}
QTE = {"struggle", "press", "mash", "hold", "breath", "aim"}   # deprecated (DECISIONS 2026-10-27): they break the immersion
TRANSITIONS = {"blend", "fade", "cut", "blink", "dip"}   # blend: the view eases from the player's eye (the default)
CAM_KEYS = {"push": (0, L.LEAN), "zoom": (0, L.ZOOM), "roll": (-30, 30), "shake": (0, 2), "lag": (0, 2)}
FAST = {"walking": 0.625, "looking round": 8 / 30, "searching": 0.3, "reading": 0.55, "puzzles": 0.35}  # a fast player
GAME_DIR = None
POSES = set()
ENDINGS = {"good", "neutral", "bad", "secret", "other", "death"}
FORMAT = 2                  # the file's format; 3 adds the v2 pipeline (docs/STORY_FORMAT.md §9)
STYLES = ("kind", "cruel", "silent")     # how the karma sweeps answer every timed choice
SEG_NAME = re.compile(r"^[a-z0-9]+(_[a-z0-9]+)+$")
PERSON = re.compile(r"^(A|An) ([A-Za-z-]+ ){0,3}person\b")
LOOK_WORDS = re.compile(r"\b(at|toward|towards) (the )?(player|viewer|camera|you)\b|\blooks? at (him|her|them)\b", re.I)
TIER_SECS = {}              # tier -> seconds of motion (the animation budget report)
SEG_NAMES = {}              # segment name -> where
STATE_VERBS = {"flag", "unflag", "give", "take", "show", "hide", "door", "move", "state"}
TODO_ON = {"done", "failed"}  # a to-do task's `on`: actions when it's ticked, when it's failed
MAX_CPS = 17.0
WALK = 1.4 / 1.6            # metres a second, with looking around (x 1.6)
ROOM_FIRST = 30             # seconds: the first look round a room
SEARCH = 20                 # seconds a prop, in a room that holds a pickup
PUZZLE = {"combo": 180, "use_on": 60}
NOTE_WPM = 180
CUES = {"sound", "light", "door", "music"}
REVEALS = {"glimpse", "jumpscare"}
MINOR = {"glimpse", "slam_behind", "knock", "whisper", "lights_die", "swap"}
SCARE_GAP, MINOR_GAP = 240, 60
MAX_HOLD = 2.5
MAX_PATHS = 4096            # format 3 sweeps three answer styles and both secret modes


def asks_of(story):
    """Every ask in the stitches (nested in answers too): its id -> its answers' ids, for `answered` triggers."""
    out = {}

    def walk(acts):
        for a in acts or []:
            if isinstance(a.get("ask"), str):
                out.setdefault(a["ask"], set()).update(o.get("id") for o in a.get("options") or [] if isinstance(o, dict))
                for o in a.get("options") or []:
                    walk(o.get("do") if isinstance(o, dict) else None)
            walk(a.get("then"))
    for st in story.get("stitches", {}).values():
        for b in st.get("beats", []):
            walk(b.get("do"))
    return out


def todos_of(story):
    """Every to-do task the stitches put on the list (in answers and `on` too): its id -> its `todo` action."""
    out = {}

    def walk(acts):
        for a in acts or []:
            if not isinstance(a, dict):
                continue
            if isinstance(a.get("todo"), str):
                out.setdefault(a["todo"], a)
                for acts2 in (a.get("on") or {}).values():
                    walk(acts2)
            for o in a.get("options") or []:
                walk(o.get("do") if isinstance(o, dict) else None)
            walk(a.get("then"))
    for st in story.get("stitches", {}).values():
        for b in st.get("beats", []):
            walk(b.get("do"))
        for acts in ((st.get("play") or {}).get("on") or {}).values():
            walk(acts)
    return out


def verbs(a):
    """An action's verb. A trick's fields (door, lookat...) and say's "wait": false share names with verbs."""
    if "trick" in a:
        return ["trick"]
    return [k for k in a if k in ACTIONS and not (k == "wait" and isinstance(a[k], bool))]


class Report:
    def __init__(self):
        self.errors, self.warnings = [], []

    def err(self, m):
        if m not in self.errors:
            self.errors.append(m)

    def warn(self, m):
        if m not in self.warnings:
            self.warnings.append(m)


# ---- static checks ----------------------------------------------------------------------------------------------

def check_library(story, r):
    """Library refs (docs/ASSETS.md): a bad one is an error; ones not fetched yet are one warning (the blocks stand in)."""
    missing = []
    for kind, ref, where in LIB.refs(story):
        try:
            if kind == "mesh" and not LIB.mesh_info(ref) and not LIB.mesh_file(ref).exists():
                r.err(f"{where}: {ref} isn't a known mesh (`python tools/cc0.py props <word>`)")
            elif not LIB.fetched(ref, kind) and ref not in missing:
                missing.append(ref)
        except ValueError as e:
            r.err(f"{where}: {e}")
    if missing:
        r.warn(f"{len(missing)} library assets not fetched yet ({', '.join(missing[:4])}{' ...' if len(missing) > 4 else ''}): "
               f"`python tools/cc0.py fetch`")
    bodies = [("game", story.get("game", {}).get("previs_body"))] + [(c, v.get("previs_body")) for c, v in story.get("cast", {}).items()]
    for who, f in bodies:
        if f and f.startswith("people/"):                # a Character Studio character, as exported for the desk
            name = f[len("people/"):]
            if not name or "/" in name or not (L.STUDIO / "People" / name / "export" / f"{name}.glb").exists():
                r.warn(f"{who}: previs_body {f}: no Export for desk / Unreal of {name or '?'} from the Character Studio on this machine (the director falls back)")
        elif f and not (L.STUDIO / "Bodies" / f).exists():
            r.warn(f"{who}: previs_body {f} isn't in Content/Studio/Bodies on this machine (the director falls back)")


def check_world(story, things, r):
    check_library(story, r)
    cast, items, notes, lines = (story.get(k, {}) for k in ("cast", "items", "notes", "lines"))
    for k, it in items.items():
        if "shape" in it:
            try:
                L.parse_shape(it["shape"])
            except ValueError as e:
                r.err(f"item {k}: {e}")
    for k, ln in lines.items():
        check_spoken(f"line {k}", ln, cast, r)
    for lid, lvl in story.get("levels", {}).items():
        rooms = {rm["id"]: rm for rm in lvl.get("rooms", [])}
        start = things.get(lvl.get("start"))
        if not start or start.use != "spot" or start.level != lid:
            r.err(f"level {lid}: start {lvl.get('start')!r} isn't a spot in it")
        for rid, rt in (lvl.get("routes") or {}).items():    # named walks for the cast in play (behave path / patrol)
            pts = rt.get("points", []) if isinstance(rt, dict) else []
            if len(pts) < 2:
                r.err(f"level {lid}: route {rid} needs points: two or more spots")
            if isinstance(rt, dict) and rt.get("mode", "loop") not in ROUTE_MODES:
                r.err(f"level {lid}: route {rid} mode {rt.get('mode')!r} (one of {', '.join(sorted(ROUTE_MODES))})")
            for pt in pts:
                q = {"at": pt} if isinstance(pt, str) else pt
                t = things.get(q.get("at"))
                if not t or t.use != "spot" or t.level != lid:
                    r.err(f"level {lid}: route {rid} point {q.get('at')!r} isn't a spot in it")
                if not isinstance(q.get("wait", 0), (int, float)) or q.get("wait", 0) < 0:
                    r.err(f"level {lid}: route {rid} at {q.get('at')}: wait {q.get('wait')!r} (seconds)")
                ck = q.get("check")                    # she looks in that hiding place at this point
                if ck is not None and (ck not in things or things[ck].use != "locker" or things[ck].level != lid):
                    r.err(f"level {lid}: route {rid} at {q.get('at')}: check {ck!r} isn't a locker in it")
                if q.get("pose") is not None and q["pose"] not in POSES:
                    r.err(f"level {lid}: route {rid} at {q.get('at')}: pose {q['pose']!r} isn't in Content/Studio/poses.json")
        for k, v in (lvl.get("trim") or {}).items():
            if k not in ("skirting", "cornice", "casing", "threshold") or not isinstance(v, (int, float)) or not 0 <= v <= 0.4:
                r.err(f"level {lid}: trim {k}: {v!r} (skirting, cornice, casing, threshold: heights or widths in metres, 0 for none)")
        for rm in rooms.values():
            if len(rm.get("size", [])) != 3 or len(rm.get("at", [])) != 3:
                r.err(f"room {rm['id']}: needs at [x, y, z] and size [w, d, h]")
                continue
            for wl in rm.get("skip", []):
                if isinstance(wl, list):
                    if len(wl) != 3 or wl[0] not in L.WALLS or not (0 <= wl[1] < wl[2] <= L.wall_length(rm, wl[0]) + 0.01):
                        r.err(f"room {rm['id']}: skip {wl!r} isn't [wall, from, to] inside the wall")
                elif wl not in L.WALLS:
                    r.err(f"room {rm['id']}: skip {wl!r} isn't one of n e s w")
            if rm.get("trim") not in (None, False):
                for k, v in (rm["trim"] or {}).items():
                    if k not in ("skirting", "cornice", "casing", "threshold") or not isinstance(v, (int, float)) or not 0 <= v <= 0.4:
                        r.err(f"room {rm['id']}: trim {k}: {v!r} (skirting, cornice, casing, threshold: heights or widths in metres, 0 for none)")
            if rm.get("kind") is not None and rm["kind"] not in L.ROOM_KINDS:
                r.warn(f"room {rm['id']}: kind {rm['kind']!r} isn't one of {', '.join(L.ROOM_KINDS)}")
            for op in rm.get("openings", []):
                if op.get("wall") not in L.WALLS:
                    r.err(f"room {rm['id']}: opening wall {op.get('wall')!r}")
                    continue
                length = L.wall_length(rm, op["wall"])
                if op["at"] - op["w"] / 2 < 0.05 or op["at"] + op["w"] / 2 > length - 0.05:
                    r.err(f"room {rm['id']}: opening at {op['at']} (w {op['w']}) runs off the {op['wall']} wall ({length} m)")
                if op.get("sill", 0) + op["h"] > rm["size"][2]:
                    r.err(f"room {rm['id']}: opening on {op['wall']} is taller than the room")
                if L.wall_skipped(rm, op["wall"], op["at"] - op["w"] / 2, op["at"] + op["w"] / 2):
                    r.err(f"room {rm['id']}: opening at {op['at']} on {op['wall']} is on a stretch it skips (put it on the room that builds that wall)")
                if op.get("door") and op["door"].get("kit") is not None:
                    try:
                        if KIT.kind(op["door"]["kit"]) != "door":
                            r.err(f"door {op['door'].get('id')}: its kit is a {KIT.kind(op['door']['kit'])}, not a door")
                    except ValueError as e:
                        r.err(f"door {op['door'].get('id')}: kit: {e}")
                if op.get("door") and op["door"].get("class") is not None and not str(op["door"]["class"]).endswith("_C"):
                    r.err(f"door {op['door'].get('id')}: class {op['door']['class']!r} isn't a Blueprint class path (…_C)")
                if op.get("door") and op["door"].get("swing", "in") not in ("in", "out", "slide"):
                    r.err(f"door {op['door'].get('id')}: swing {op['door']['swing']!r} isn't in, out or slide")
                if op.get("door") and op["door"].get("locked_by"):
                    lb = op["door"]["locked_by"]
                    if not lb.startswith("flag:") and lb not in items:
                        r.err(f"door {op['door']['id']}: locked_by {lb!r} is neither an item nor 'flag:<name>'")
        rl = list(rooms.values())
        for i, a in enumerate(rl):
            for b in rl[i + 1:]:
                # rooms whose heights overlap share walls (a two-storey stairwell beside an upstairs room too)
                if min(a["at"][2] + a["size"][2], b["at"][2] + b["size"][2]) - max(a["at"][2], b["at"][2]) <= 0.3:
                    continue
                for wa in L.WALLS:
                    for wb in L.WALLS:
                        la, lb_ = L.wall_line(a, wa), L.wall_line(b, wb)
                        if la[0] != lb_[0] or abs(la[1] - lb_[1]) > 0.01:
                            continue
                        o0, o1 = max(la[2], lb_[2]), min(la[3], lb_[3])
                        if o1 - o0 <= 0.05:
                            continue
                        sa = L.wall_skipped(a, wa, o0 - la[2], o1 - la[2])
                        sb = L.wall_skipped(b, wb, o0 - lb_[2], o1 - lb_[2])
                        if not sa and not sb:
                            r.err(f"rooms {a['id']} ({wa}) and {b['id']} ({wb}) both build their shared wall: skip it on one")
                        if sa and sb:
                            r.warn(f"rooms {a['id']} and {b['id']} both skip their shared wall: there's a gap")
        for ln in lvl.get("links", []):
            for side in ("a", "b"):
                if ln.get(side) not in rooms:
                    r.err(f"level {lid}: link {ln} names {ln.get(side)!r}, not a room here")
            v = ln.get("via")
            if v and (v not in things or things[v].kind != "door"):
                r.err(f"level {lid}: link via {v!r} isn't a door")
            elif v and things[v].room not in (ln.get("a"), ln.get("b")):
                r.err(f"level {lid}: door {v} is in {things[v].room}, not on the link's rooms")

    texts = [n.get("text", "") for n in notes.values()] + [ln.get("en", "") for ln in lines.values()]
    for sc in story.get("scenes", {}).values():
        for ver in [sc] + list((sc.get("variants") or {}).values()):
            texts += [c.get("en", "") for c in ver.get("clips", [])]
    for t in things.values():
        if t.kind != "prop":
            continue
        p, u = t.d, t.use
        if u is None and "shape" not in p and "kit" not in p:
            r.err(f"{t.id}: needs a shape, a kit or a use")
        if "kit" in p and "shape" in p:
            r.err(f"{t.id}: a shape or a kit, not both")
        if u is not None and u not in L.USES:
            r.err(f"{t.id}: unknown use {u!r}")
        if p.get("shape", "").startswith("person"):
            cid = L.parse_shape(p["shape"])[1][0]
            if cid not in cast:
                r.err(f"{t.id}: person {cid!r} isn't in cast")
        need = {"pickup": ("item", items), "note": ("note", notes)}
        if u in need:
            f, table = need[u]
            if p.get(f) not in table:
                r.err(f"{t.id}: {f} {p.get(f)!r} doesn't exist")
        if u == "switch" and (p.get("light") not in things or things[p["light"]].use != "light"):
            r.err(f"{t.id}: switch light {p.get('light')!r} isn't a light")
        if u == "use_on":
            if p.get("needs") not in items:
                r.err(f"{t.id}: needs {p.get('needs')!r} isn't an item")
            if not p.get("then"):
                r.err(f"{t.id}: use_on needs 'then' (the flag it sets)")
        if u == "combo":
            if not p.get("code"):
                r.err(f"{t.id}: combo needs a code")
            if not p.get("then") and not p.get("opens"):
                r.err(f"{t.id}: combo needs 'then' (a flag) or 'opens' (a door)")
            if p.get("opens") and (p["opens"] not in things or things[p["opens"]].kind != "door"):
                r.err(f"{t.id}: opens {p['opens']!r} isn't a door")
            flat = [re.sub(r"[\s\-.,:]", "", x) for x in texts + [q.d.get("text", "") for q in things.values()]]
            if not any(str(p.get("code", "")) in x for x in flat):
                r.warn(f"{t.id}: the code {p.get('code')} isn't written in any note, line or inspect text")
        if u == "inspect" and p.get("line") and p["line"] not in lines:
            r.err(f"{t.id}: line {p['line']!r} doesn't exist")
        if u == "light" and p.get("kind", "bulb") not in ("bulb", "candle", "lamp", "fire"):
            r.err(f"{t.id}: light kind {p.get('kind')!r}")
        if u == "locker":                               # Play puts the player inside: its `inside` spot, else its middle
            ins = p.get("inside")
            if ins is not None and (ins not in things or things[ins].use != "spot" or things[ins].level != t.level):
                r.err(f"{t.id}: inside {ins!r} isn't a spot on its level")
        if u == "sleep":                                # a bed: E sleeps when its `if` flags hold; a beat on its use plays the chapter
            ifs = p.get("if", [])
            if not (isinstance(ifs, str) or isinstance(ifs, list) and all(isinstance(f, str) for f in ifs)):
                r.err(f"{t.id}: sleep if is a flag or a list of flags (\"!flag\" for not)")
            if "not_yet" in p and not isinstance(p["not_yet"], str):
                r.err(f"{t.id}: not_yet is the thought when it isn't time to sleep")
            if f'"use": "{t.id}"' not in json.dumps(story, ensure_ascii=False):
                r.warn(f"{t.id}: a bed to sleep in, but nothing hears it (a beat {{\"when\": {{\"use\": \"{t.id}\"}}}} that plays a chapter)")
        if "safe" in p and not (u == "trigger" and isinstance(p["safe"], bool)):
            r.err(f"{t.id}: safe is for a trigger: true when the player can't be seen in it")
        if "see_through" in p and not (u == "locker" and isinstance(p["see_through"], (int, float)) and 0 <= p["see_through"] <= 1):
            r.err(f"{t.id}: see_through is for a locker, a number 0..1 (how much of its slats are gaps)")
        if u == "carry":                                # held E picks it up, held E puts it down; its shape is its body
            if str(p.get("shape", "")).split()[:1] not in (["box"], ["cyl"], ["sphere"], ["asset"]):
                r.err(f"{t.id}: carry needs a shape (box, cyl, sphere or asset): its size is the body that falls and rolls")
            elif max(t.size) > 1.0:
                r.warn(f"{t.id}: {max(t.size):.2f} m: too big to carry in the hands (keep a thing to carry under 1 m)")
            if p.get("physics", "rigid") not in L.PHYSICS:
                r.err(f"{t.id}: physics {p.get('physics')!r} ({', '.join(L.PHYSICS)})")
        if "physics" in p and u != "carry":
            r.err(f"{t.id}: physics is for a thing you carry (use: carry)")
        if u == "game":                                 # a table with a board game: its rules in Content/Studio/BoardGames/ (or the game's own)
            g, gs = p.get("game"), p.get("settings") or {}
            if g not in BOARDS:
                r.err(f"{t.id}: game {g!r} isn't a board game ({', '.join(sorted(BOARDS)) or 'none in Content/Studio/BoardGames'})")
            elif not isinstance(gs, dict) or any(k != "seed" and k not in BOARDS[g].get("settings", {}) for k in gs):
                r.err(f"{t.id}: {g}'s settings are {', '.join(BOARDS[g].get('settings', {})) or 'none'} (and seed), not {gs!r}")
            if p.get("vs") is not None and p["vs"] not in cast:
                r.err(f"{t.id}: vs {p['vs']!r} isn't in cast")
            if "shape" not in p and "kit" not in p:
                r.err(f"{t.id}: a board game needs its table (a shape or a kit)")
        for f in ("game", "vs", "settings"):
            if f in p and u != "game":
                r.err(f"{t.id}: {f} is for a board game's table (use: game)")
        if "jiggle" in p and not (u == "carry" and p.get("physics") == "plushie" and isinstance(p["jiggle"], (int, float))
                                  and not isinstance(p["jiggle"], bool) and 0 <= p["jiggle"] <= 2):
            r.err(f"{t.id}: jiggle is a plushie's softness, 0..2 (0 still, 1 a plushie, 2 jelly; physics: plushie)")
        check_life(t, things, r)


def check_life(t, things, r):
    """A little thing's life (docs/IMMERSION.md): its own `life` or its kit's, the `state` it starts in, its settings."""
    p, lv = t.d, LIFE.lives()
    lf = LIFE.life_of(p)
    if p.get("life") and p["life"] not in lv:
        r.err(f"{t.id}: life {p['life']!r} isn't a life ({', '.join(sorted(lv))})")
    if "state" in p and (not lf or p["state"] not in LIFE.states(lf)):
        r.err(f"{t.id}: state {p['state']!r}: " + (f"one of {lf}'s ({', '.join(LIFE.states(lf))})" if lf else
                                                   "it has no life (a kit thing that has one, or `life`)"))
    own = set((lv.get(lf) or {}).get("settings") or [])
    for f in ("liquid", "from", "rings", "level") + (("light",) if lf else ()):
        if f in p and f not in own:
            r.err(f"{t.id}: {f} isn't a setting of its life ({lf or 'it has none'}; lives.json says which have it)")
    if "secs" in p and lf and not (isinstance(p["secs"], dict) and all(k in LIFE.states(lf) and isinstance(v, (int, float)) and v > 0 for k, v in p["secs"].items())):
        r.err(f"{t.id}: secs is how long its states last, {{state: seconds}} ({lf}: {', '.join(LIFE.states(lf))})")
    if "acts" in p and not isinstance(p["acts"], bool):
        r.err(f"{t.id}: acts is true or false (false: the player can't touch it)")
    if "liquid" in p and p["liquid"] not in (LIFE.data().get("liquids") or {}):
        r.err(f"{t.id}: liquid {p['liquid']!r} (one of {', '.join(LIFE.data().get('liquids') or {})})")
    if "from" in p:
        src = things.get(p["from"])
        sl = LIFE.life_of(src.d) if src and src.kind == "prop" else None
        if not sl or not any((LIFE.state_def(sl, x) or {}).get("ready") for x in LIFE.states(sl)):
            r.err(f"{t.id}: from {p['from']!r} isn't a kettle or a teapot (a thing with a life that pours)")
    if "rings" in p and not (isinstance(p["rings"], list) and p["rings"] and all(isinstance(x, int) and x >= 1 for x in p["rings"])):
        r.err(f"{t.id}: rings are the hob's rings that are on, numbers from 1: [1, 3]")
    if "light" in p and lf and (p["light"] not in things or things[p["light"]].use != "light"):
        r.err(f"{t.id}: light {p['light']!r} isn't a light (use: light) for it to light")


STORY = None


def story_subs():
    return (STORY or {}).get("game", {}).get("subtitles", ["en"])


def check_karma(where, delta, story, r):
    axes = L.karma_axes(story)
    if isinstance(delta, (int, float)):
        if "karma" not in axes:
            r.err(f"{where}: karma {delta} names no axis (the game's axes: {', '.join(axes)})")
        return
    if not isinstance(delta, dict):
        r.err(f"{where}: karma is a number or {{axis: number}}")
        return
    for k, v in delta.items():
        if k not in axes:
            r.err(f"{where}: karma axis {k!r} isn't in game.karma.axes ({', '.join(axes)})")
        if not isinstance(v, (int, float)):
            r.err(f"{where}: karma {k} {v!r} isn't a number")


def check_spoken(where, ln, cast, r, clip_max=None):
    if ln.get("who") not in cast and ln.get("who") != "player":
        r.err(f"{where}: who {ln.get('who')!r} isn't in cast")
    if not ln.get("en"):
        r.err(f"{where}: no 'en' subtitle")
    if not ln.get("ja"):
        r.warn(f"{where}: no 'ja' text to record")
    if FORMAT >= 3 and ln.get("ja") and ln.get("face", True) is not False and "voice" in ln:
        if ln["voice"] not in L.VOICES:
            r.warn(f"{where}: voice {ln['voice']!r} isn't in the list (docs/VOICES.md): fine if you've tested it, then add it")
        if not ln.get("expr"):
            r.warn(f"{where}: no `expr`: the MiniMax prompt needs the expression (docs/VOICES.md)")
    if FORMAT >= 3 and ln.get("ja"):
        for lang in [x for x in story_subs() if x != "en"]:
            if not ln.get(lang):
                r.warn(f"{where}: no {lang!r} subtitle (game.subtitles has it)")
    if ln.get("dur"):
        cps = len(ln.get("en", "")) / L.clip_secs(ln)
        if cps > MAX_CPS:
            r.err(f"{where}: subtitle at {cps:.0f} characters a second (max {MAX_CPS:.0f}): split it")
    if clip_max:
        secs = L.clip_secs(ln)
        if ln.get("dur") and secs > clip_max + 0.01:
            r.err(f"{where}: the take is {secs:.1f} s, over the {clip_max} s a clip can be: split it into two clips")
        elif not ln.get("dur") and secs > clip_max:
            r.warn(f"{where}: about {secs:.0f} s at speaking pace, over {clip_max} s: split it before recording")


def check_look(where, spec, stage, trackers, things, r):
    """A head's look (format 3): {at: player | a tracker | someone on stage | a placed thing, limit, past, lag, w}."""
    if not isinstance(spec, dict):
        r.err(f"{where}: look is {{\"at\": ..., \"limit\": [yaw, up, down], \"past\": \"hold\"|\"snap\"}}")
        return
    at = spec.get("at", "player")
    if at != "player" and at not in trackers and at not in stage and at not in things:
        r.err(f"{where}: look at {at!r}: the player, a tracker, someone on stage or a placed thing")
    lim = spec.get("limit", [70, 20, 30])
    if not (isinstance(lim, list) and len(lim) == 3 and all(isinstance(x, (int, float)) and 0 <= x <= 120 for x in lim)):
        r.err(f"{where}: look limit {lim!r}: [yaw, up, down] in degrees, 0 to 120")
    if spec.get("past", "hold") not in ("hold", "snap"):
        r.err(f"{where}: look past {spec.get('past')!r} (hold or snap)")


def check_trackers(where, trackers, ids, things, lvl, r):
    for tid, tr in (trackers or {}).items():
        tw = f"{where} tracker {tid}"
        keys = tr.get("keys") or []
        if not keys and not tr.get("at"):
            r.err(f"{tw}: needs keys (or a fixed `at`)")
        for k in keys:
            if k.get("clip") not in ids:
                r.err(f"{tw}: a key rides clip {k.get('clip')!r}, not in this scene (keys ride clip edges, never scene time)")
            if not 0 <= float(k.get("at", 0)) <= 1:
                r.err(f"{tw}: key at {k.get('at')} (0..1 of its clip)")
            to = k.get("to")
            if not (isinstance(to, list) and len(to) in (2, 3)) and to not in things:
                r.err(f"{tw}: key to {to!r}: a spot or thing, or [x, y, z]")


def check_reply(cw, c, story, things, lvl, stage, cast, clip_max, r):
    """A reply (format 3): the player answers left or right; her answer back plays, then the scene goes on."""
    rp = c["reply"]
    opts = rp.get("options", [])
    ids = [o.get("id") for o in opts]
    if len(opts) != 2:
        r.warn(f"{cw}: a reply has two options (left and right); this one has {len(opts)}")
    if None in ids or len(set(ids)) != len(ids):
        r.err(f"{cw}: reply options need unique ids")
    if not 2 <= float(rp.get("wait", L.REPLY_SECS)) <= 15:
        r.err(f"{cw}: reply wait {rp.get('wait')} s: she waits 2 to 15 s, then carries on")
    if rp.get("timeout") is not None and rp["timeout"] not in ids:
        r.err(f"{cw}: reply timeout {rp['timeout']!r}: null (her answer is skipped) or an option id")
    for o in opts:
        ow = f"{cw} reply {o.get('id')}"
        if not o.get("label"):
            r.err(f"{ow}: needs a label (the English the player picks)")
        if FORMAT >= 3 and not o.get("ja"):
            r.warn(f"{ow}: no `ja` (the Japanese shown over the English)")
        for a in o.get("sets", []):
            check_action(f"{ow} sets", a, story, things, r, stage)
        th = o.get("then")
        if th:
            th = dict({"who": c.get("who")}, **th)
            check_spoken(f"{ow} then", th, cast, r, clip_max)
            if th.get("body"):
                check_body_v3(f"{ow} then", None, th, th["body"], story, things, lvl, r)
    if not c.get("ja", "").rstrip().endswith(("？", "?", "……", "…", "。", "ね", "の")) and FORMAT >= 3:
        pass                                          # a hanging line usually asks; the check doesn't insist


def check_body_v3(cw, sid, c, body, story, things, lvl, r):
    """Format 3's body fields: the tier (the animation budget) and the Kimodo segments (docs/KIMODO.md §2)."""
    tier = body.get("tier")
    if tier is not None and tier not in L.TIERS:
        r.err(f"{cw}: body tier {tier!r} (one of {', '.join(L.TIERS)})")
    segs = body.get("segments") or []
    secs = sum(float(g.get("secs", 0)) for g in segs) or L.clip_secs(c)
    if FORMAT >= 3 and not tier:
        r.warn(f"{cw}: body has no tier (simple, activity, action): the animation budget can't count it")
    TIER_SECS[tier or "simple"] = TIER_SECS.get(tier or "simple", 0) + secs
    for i, g in enumerate(segs):
        gw = f"{cw} segment {i + 1}"
        name, prompt = g.get("name", ""), g.get("prompt", "")
        if not SEG_NAME.match(name):
            r.err(f"{gw}: name {name!r}: lower case words joined by _ (<game>_<scene>_<clip>_<nn>_<verb>, docs/KIMODO.md §3)")
        elif name in SEG_NAMES and SEG_NAMES[name] != gw:
            if (story.get("motions") or {}).get(name) is None and not g.get("reuse"):
                r.err(f"{gw}: name {name!r} is also {SEG_NAMES[name]} (mark the second `reuse: true` if it's the same motion)")
        else:
            SEG_NAMES[name] = gw
        if not PERSON.match(prompt):
            r.err(f"{gw}: the prompt starts \"A person ...\" (or \"A scared person ...\"): {prompt!r}")
        if LOOK_WORDS.search(prompt):
            r.warn(f"{gw}: the prompt says where to look ({prompt!r}): Kimodo can't aim the head; the look layer does it")
        if prompt.lower().startswith(("then", "and then")) or " then " in prompt.lower():
            r.warn(f"{gw}: one behaviour per motion, standing alone (no \"then\"): split it into two segments")
        n = g.get("secs")
        if not isinstance(n, (int, float)) or not L.SEG_MIN <= n <= L.SEG_MAX:
            r.err(f"{gw}: secs {n!r}: a Kimodo motion is {L.SEG_MIN:g} to {L.SEG_MAX:g} s (a stand-up is one, the walk after it the next)")
        for spot in g.get("path", []):
            if spot not in things or things[spot].use != "spot" or things[spot].level != lvl:
                r.err(f"{gw}: path spot {spot!r} isn't a spot in level {lvl}")
        for k in g.get("keys", []):
            if k.get("pose") not in POSES:
                r.err(f"{gw}: key pose {k.get('pose')!r} isn't in Content/Studio/poses.json")
        if "blend" in g and not (isinstance(g["blend"], (int, float)) and 0 <= g["blend"] <= 2):
            r.err(f"{gw}: blend {g['blend']!r}: seconds it blends in from the segment before (0 to 2; 0.25 when not given)")
    if segs and not c.get("dur") and abs(secs - L.clip_secs(c)) > max(2.0, 0.35 * L.clip_secs(c)):
        r.warn(f"{cw}: its segments run {secs:.1f} s against the clip's {L.clip_secs(c):.1f} s (fit will stretch, hold or trim)")


def check_layer(lw, ly, r):
    """A body layer (STORY_FORMAT §3.5): a part of the body (`mask`) played from another motion or a pose, over a window."""
    if ly.get("mask") not in L.MASKS:
        r.err(f"{lw}: mask {ly.get('mask')!r} (one of {', '.join(L.MASKS)})")
    if bool(ly.get("file")) == bool(ly.get("pose")):
        r.err(f"{lw}: a layer plays a `file` (a made motion) or a `pose` (from the library): one of them")
    if ly.get("pose") and ly["pose"] not in POSES:
        r.err(f"{lw}: pose {ly['pose']!r} isn't in Content/Studio/poses.json")
    if ly.get("file") and GAME_DIR and not (GAME_DIR / "Motion" / ly["file"]).exists():
        r.warn(f"{lw}: file Motion/{ly['file']} isn't there yet (the layer waits for it)")
    a, b = ly.get("from", 0), ly.get("to", 1)
    if not all(isinstance(v, (int, float)) for v in (a, b)) or not 0 <= a < b <= 1:
        r.err(f"{lw}: from {a!r} to {b!r}: fractions of the clip, from before to")
    for k, lo, hi in (("fade", 0, 5), ("weight", 0, 1)):
        if k in ly and not (isinstance(ly[k], (int, float)) and lo <= ly[k] <= hi):
            r.err(f"{lw}: {k} {ly[k]!r} ({lo} to {hi})")
    if ly.get("fit", "loop") not in L.FITS:
        r.err(f"{lw}: fit {ly.get('fit')!r} (one of {', '.join(L.FITS)})")
    if set(ly) - {"mask", "file", "pose", "from", "to", "fade", "weight", "fit"}:
        r.err(f"{lw}: unknown fields {', '.join(sorted(set(ly) - {'mask', 'file', 'pose', 'from', 'to', 'fade', 'weight', 'fit'}))}")


def check_scene(sid, sc, story, things, r):
    cast = story.get("cast", {})
    lvl = L.level_of(story, sc)
    if lvl not in story.get("levels", {}):
        r.err(f"scene {sid}: level {lvl!r} doesn't exist")
    variants = sc.get("variants") or {}
    if variants and sc.get("pick") not in variants:
        r.err(f"scene {sid}: pick {sc.get('pick')!r} isn't one of its variants ({', '.join(variants)})")
    if sc.get("pick_by") is not None:
        if sc["pick_by"] != "found_at":
            r.err(f"scene {sid}: pick_by {sc['pick_by']!r} (found_at: the variant named by where the player was caught)")
        else:
            spots = {sp for st in story.get("stitches", {}).values() for sp in (st.get("play") or {}).get("spots", [])}
            for k in variants:
                if k not in spots:
                    r.warn(f"scene {sid}: variant {k!r} isn't a hiding spot of any play (pick_by found_at): it only plays as the pick")
    if sc.get("mood") and sc["mood"] not in L.MOODS:
        r.err(f"scene {sid}: mood {sc['mood']!r} (one of {', '.join(L.MOODS)})")
    if "time" in sc and sc["time"] not in L.TIMES:
        r.err(f"scene {sid}: time {sc['time']!r} (one of {', '.join(L.TIMES)}; leave it out to keep the time it was)")
    for edge in ("enter", "exit"):
        if sc.get(edge) and sc[edge].get("kind") not in TRANSITIONS:
            r.err(f"scene {sid}: {edge} kind {sc[edge].get('kind')!r} (one of {', '.join(sorted(TRANSITIONS))})")
    cam = sc.get("camera", {"mode": "free"})
    for t in cam.get("through", []):
        if t not in things:
            r.err(f"scene {sid}: camera through {t!r} isn't a placed thing")
    if cam.get("mode", "free") not in CAMERA:
        r.err(f"scene {sid}: camera mode {cam.get('mode')!r} (one of {', '.join(sorted(CAMERA))})")
    if sc.get("view") and (sc["view"] not in things or things[sc["view"]].use != "spot"):
        r.err(f"scene {sid}: view {sc['view']!r} isn't a spot")
    if sc.get("stance", "stand") not in L.EYES:
        r.err(f"scene {sid}: stance {sc.get('stance')!r} (one of {', '.join(L.EYES)})")
    if sc.get("view") in things:                  # the camera is the player: it stands where a player can stand
        v = things[sc["view"]]
        room = things.get(v.room)
        if room and not (room.pos[0] - room.size[0] / 2 + 0.15 <= v.pos[0] <= room.pos[0] + room.size[0] / 2 - 0.15 and
                         room.pos[1] - room.size[1] / 2 + 0.15 <= v.pos[1] <= room.pos[1] + room.size[1] / 2 - 0.15):
            r.err(f"scene {sid}: view {v.id} is in a wall or outside its room: the player's eye can't be there")
        for t in things.values():
            if t.kind != "prop" or t.room != v.room or t.use in ("spot", "light", "trigger") or t.id in cam.get("through", []):
                continue
            if not t.d.get("shape") or t.size[2] < 0.5:
                continue
            dx, dy = v.pos[0] - t.pos[0], v.pos[1] - t.pos[1]
            a = -math.radians(t.yaw); lx, ly = dx * math.cos(a) - dy * math.sin(a), dx * math.sin(a) + dy * math.cos(a)
            if abs(lx) < t.size[0] / 2 and abs(ly) < t.size[1] / 2:
                r.err(f"scene {sid}: view {v.id} is inside {t.id}: the player can't stand there"
                      f" (hiding in it? list it in camera.through and set stance 'hide')")
    versions = [(f"scene {sid}", sc)] if not variants else \
        [(f"scene {sid} variant {k}", L.scene_version(dict(sc, pick=k))) for k in variants]
    clip_max = story["game"].get("clip_max", 8 if FORMAT >= 3 else 10)
    for where, ver in versions:
        stage = ver.get("stage", {})
        for who, spot in stage.items():
            if who not in cast:
                r.err(f"{where}: stage names {who!r}, not in cast")
            if spot not in things or things[spot].use != "spot" or things[spot].level != lvl:
                r.err(f"{where}: stage spot {spot!r} isn't a spot in level {lvl}")
        vcam = ver.get("camera", cam)
        look = vcam.get("look")
        if look and look not in things and look not in stage and vcam.get("mode") != "free":
            if look in cast:
                r.warn(f"{where}: the camera looks at {look}, who isn't on stage in this version")
            else:
                r.err(f"{where}: camera look {look!r} is neither a thing nor someone on stage")
        clips = ver.get("clips", [])
        if not clips:
            r.err(f"{where}: no clips")
        ids = [c.get("id") for c in clips]
        if len(set(ids)) != len(ids) or None in ids:
            r.err(f"{where}: clip ids must be present and unique")
        for i, c in enumerate(clips):
            cw = f"{where} clip {c.get('id')}"
            check_spoken(cw, c, cast, r, clip_max)
            seam = c.get("seam")
            if i > 0:
                if not seam:
                    r.err(f"{cw}: a cut from {clips[i - 1].get('id')} with no seam: pick one (blink, glance, flicker, "
                          f"occlude, cutaway, turn, stumble, dip, jcut, heartbeat; none only for the same take)")
                elif seam.get("kind") not in SEAMS:
                    r.err(f"{cw}: seam {seam.get('kind')!r} isn't a seam")
                else:
                    missing = SEAMS[seam["kind"]][0] - set(seam)
                    if missing:
                        r.err(f"{cw}: seam {seam['kind']} needs {', '.join(sorted(missing))}")
                    lk = seam.get("look")
                    if lk and lk not in things and lk not in stage:
                        r.err(f"{cw}: seam look {lk!r} isn't a thing or someone on stage")
                    if seam["kind"] == "glance" and cam.get("mode") == "hard":
                        r.warn(f"{cw}: a glance needs the player's look (soft or free camera); with a hard camera use blink or cutaway")
            if c.get("shot") and c["shot"] not in L.SHOT_TYPES:
                r.err(f"{cw}: shot {c['shot']!r} (one of {', '.join(L.SHOT_TYPES)})")
            for k, v in (c.get("cam") or {}).items():
                if k in CAM_KEYS:
                    lo, hi = CAM_KEYS[k]
                    if not isinstance(v, (int, float)) or not lo <= v <= hi:
                        r.err(f"{cw}: cam {k} {v!r} (a number from {lo} to {hi})")
                elif k == "fov":
                    r.err(f"{cw}: cam fov: the camera is the player's eye and never changes lens. Frame by distance "
                          f"(bring the actor in, `push` to lean in up to {L.LEAN} m) or `zoom` up to {L.ZOOM} for a held focus "
                          f"(DIRECTING.md §1)")
                elif k in ("look", "focus"):
                    if v not in things and v not in stage:
                        r.err(f"{cw}: cam {k} {v!r} isn't a thing or someone on stage")
                else:
                    r.err(f"{cw}: unknown cam field {k!r} (push, zoom, roll, shake, lag, look, focus)")
            if c.get("struggle"):
                r.err(f"{cw}: `struggle` is an event now: \"event\": {{\"type\": \"struggle\", \"secs\": 4, \"pull\": \"back\", \"need\": 0.6}}")
            if c.get("reply"):
                check_reply(cw, c, story, things, lvl, stage, cast, clip_max, r)
                if c.get("event"):
                    r.err(f"{cw}: a clip has a reply or an event, not both (put the event on the next clip)")
            ev = c.get("event")
            if ev:
                t = ev.get("type")
                if t not in EVENTS:
                    r.err(f"{cw}: event type {t!r} (one of {', '.join(sorted(EVENTS))})")
                elif t in QTE:
                    r.warn(f"{cw}: `{t}` is a quick-time event, deprecated (DECISIONS 2026-10-27: they break the immersion): "
                           "a `choose` (a dialogue answer) or a plain scene instead")
                if t == "choose" and FORMAT >= 3 and "secs" not in ev:
                    pass                                    # format 3: a timed choice gives 30 s
                elif not isinstance(ev.get("secs"), (int, float)) or ev["secs"] <= 0:
                    r.err(f"{cw}: event needs secs (how long the player has)")
                if t == "struggle":
                    if ev.get("pull", "any") not in PULLS:
                        r.err(f"{cw}: struggle pull {ev.get('pull')!r} (one of {', '.join(sorted(PULLS))})")
                    if vcam.get("mode") != "held":
                        r.warn(f"{cw}: a struggle wants camera mode 'held'")
                if t in ("struggle", "mash") and not 0 < float(ev.get("need", 0.5)) <= 1:
                    r.err(f"{cw}: event need is 0..1")
                if t == "choose":
                    oids = [o.get("id") for o in ev.get("options", [])]
                    if len(oids) < 2 or None in oids or len(set(oids)) != len(oids):
                        r.err(f"{cw}: a timed choice needs two options or more, each with a unique id and a label")
                    if ev.get("default") not in oids:
                        r.err(f"{cw}: a timed choice needs `default`: the option taken when the time runs out (silence is a choice)")
                    for o in ev.get("options", []):
                        if not o.get("label"):
                            r.err(f"{cw}: option {o.get('id')!r} needs a label")
                        if "karma" in o:
                            check_karma(f"{cw} option {o.get('id')}", o["karma"], story, r)
                for res, acts in (ev.get("on") or {}).items():
                    if res not in L.event_results(ev):
                        r.err(f"{cw}: event on {res!r} isn't a result of {t} ({', '.join(map(str, L.event_results(ev)))})")
                    for a in acts:
                        check_action(f"{cw} event on {res}", a, story, things, r, stage)
            body = c.get("body")
            if body:
                check_body_v3(cw, sid, c, body, story, things, lvl, r)
                block = body.get("block") or []
                if not block and not body.get("prompt") and not body.get("file") and not body.get("segments"):
                    r.err(f"{cw}: body needs blocking keys, a prompt or a file")
                elif not body.get("prompt") and not body.get("segments"):
                    r.warn(f"{cw}: body has no prompt: motion.py won't generate it (the blocking plays)")
                for k in block:
                    if k.get("pose") not in POSES:
                        r.err(f"{cw}: block pose {k.get('pose')!r} isn't in Content/Studio/poses.json")
                    if k.get("ease", "inout") not in L.EASES:
                        r.err(f"{cw}: block ease {k.get('ease')!r} (one of {', '.join(L.EASES)})")
                    if "s" not in k and not 0 <= float(k.get("at", 0)) <= 1:
                        r.err(f"{cw}: block key at {k.get('at')} (0..1 of the clip, or `s` in seconds)")
                    if k.get("move") and (k["move"] not in things or things[k["move"]].use != "spot"):
                        r.err(f"{cw}: block key moves to {k['move']!r}, not a spot")
                for m in body.get("mods") or []:
                    if m.get("type") not in L.MODS:
                        r.err(f"{cw}: modifier {m.get('type')!r} (one of {', '.join(L.MODS)})")
                    elif set(m) - {"type"} - set(L.MODS[m["type"]]):
                        r.err(f"{cw}: modifier {m['type']} takes {', '.join(L.MODS[m['type']]) or 'nothing'}")
                if body.get("fit", "stretch") not in L.FITS:
                    r.err(f"{cw}: fit {body.get('fit')!r} (one of {', '.join(L.FITS)})")
                if body.get("file") and GAME_DIR and not (GAME_DIR / "Motion" / body["file"]).exists():
                    r.warn(f"{cw}: body file Motion/{body['file']} isn't there yet (the blocking plays meanwhile)")
                for spot in body.get("path", []):
                    if spot not in things or things[spot].use != "spot" or things[spot].level != lvl:
                        r.err(f"{cw}: body path spot {spot!r} isn't a spot in level {lvl}")
                for li, ly in enumerate(body.get("layers") or []):
                    check_layer(f"{cw} layer {li + 1}", ly, r)
                rc = body.get("reach")
                if rc:
                    if rc.get("hand", "right") not in ("right", "left", "both"):
                        r.err(f"{cw}: reach hand {rc.get('hand')!r} (right, left or both)")
                    if rc.get("to") not in ("player_collar", "player_face") and rc.get("to") not in things:
                        r.err(f"{cw}: reach to {rc.get('to')!r} (player_collar, player_face or a placed thing)")
                    if rc.get("to", "").startswith("player") and not sc.get("view"):
                        r.err(f"{cw}: reaching for the player needs the scene's view spot (where the player stands)")
                for edge in ("start", "end"):
                    if body.get(edge) and body[edge] not in story.get("motions", {}) and body[edge] not in ("idle", "tpose"):
                        r.warn(f"{cw}: body {edge} pose {body[edge]!r} isn't in motions (idle and tpose are built in)")
        trackers = ver.get("trackers", sc.get("trackers")) or {}
        check_trackers(where, trackers, ids, things, lvl, r)
        for who, spec in (ver.get("look", sc.get("look")) or {}).items():
            if who not in stage:
                r.err(f"{where}: look for {who!r}, who isn't on stage")
            check_look(f"{where} look {who}", spec, stage, trackers, things, r)
        for c in clips:
            if c.get("look"):
                check_look(f"{where} clip {c.get('id')} look", c["look"], stage, trackers, things, r)
        for cue in ver.get("cues", []):
            at = cue.get("at", {})
            if at.get("clip") not in ids:
                r.err(f"{where}: a cue anchors to clip {at.get('clip')!r}, not in this version")
            if at.get("edge", "start") not in ("start", "end"):
                r.err(f"{where}: cue edge {at.get('edge')!r} (start or end)")
            check_action(f"{where} cue", cue.get("do", {}), story, things, r, stage)
    for a in sc.get("sets", []):
        check_action(f"scene {sid} sets", a, story, things, r)


def check_trigger(bid, w, story, things, beats, r):
    keys = set(w) - TRIGGER_EXTRA
    if len(keys) != 1:
        r.err(f"{bid}: 'when' needs exactly one trigger, has {sorted(keys)}")
        return
    k = keys.pop()
    v = w[k]
    if "option" in w and k != "answered":
        r.err(f"{bid}: `option` goes with an answered trigger")
    if "in" in w and k != "dropped":
        r.err(f"{bid}: `in` goes with a dropped trigger")
    if "result" in w and k != "played":
        r.err(f"{bid}: `result` goes with a played trigger")
    if "is" in w and k != "state":
        r.err(f"{bid}: `is` goes with a state trigger")
    if k not in TRIGGERS:
        r.err(f"{bid}: unknown trigger {k!r}")
    elif k in ("all", "any"):
        for sub in v:
            check_trigger(bid, sub, story, things, beats, r)
    elif k in ("enter", "exit"):
        if v not in things or things[v].kind != "room" and things[v].use != "trigger":
            r.err(f"{bid}: {k} {v!r} isn't a room or a trigger")
    elif k in ("use", "look") and v not in things:
        r.err(f"{bid}: {k} {v!r} isn't placed anywhere")
    elif k == "pickup" and v not in story.get("items", {}):
        r.err(f"{bid}: pickup {v!r} isn't an item")
    elif k == "read" and v not in story.get("notes", {}):
        r.err(f"{bid}: read {v!r} isn't a note")
    elif k == "after" and v not in beats:
        r.err(f"{bid}: after {v!r} isn't a beat in this stitch")
    elif k == "caught" and v is not True and v not in story.get("cast", {}):
        r.err(f"{bid}: caught {v!r}: true (by anyone) or a cast member")
    elif k == "hidden" and v is not True and (v not in things or things[v].use != "locker"):
        r.err(f"{bid}: hidden {v!r}: true (in any hiding place) or a locker's id")
    elif k == "answered":                              # an ask answered: any answer, or `option`
        asks = asks_of(story)
        if v not in asks:
            r.err(f"{bid}: answered {v!r} isn't an ask in any stitch")
        elif "option" in w and w["option"] not in asks[v]:
            r.err(f"{bid}: answered {v!r} option {w['option']!r} isn't one of its answers ({', '.join(sorted(map(str, asks[v])))})")
    elif k == "carrying" and v is not True and (v not in things or things[v].use != "carry"):
        r.err(f"{bid}: carrying {v!r}: true (anything) or a thing with use: carry")
    elif k == "dropped":                               # put down and settled: anywhere, or in a room or a trigger
        if v not in things or things[v].use != "carry":
            r.err(f"{bid}: dropped {v!r} isn't a placed thing with use: carry")
        elif "in" in w:
            z = things.get(w["in"])
            if not z or (z.kind != "room" and z.use != "trigger") or z.level != things[v].level:
                r.err(f"{bid}: dropped in {w['in']!r}: a room or a trigger on {v}'s level")
    elif k == "played":                                # a board game ended (use: game): any result, or one of its game's
        if v not in things or things[v].use != "game":
            r.err(f"{bid}: played {v!r} isn't a table with use: game")
        elif "result" in w and w["result"] not in BOARDS.get(things[v].d.get("game"), {}).get("results", [w["result"]]):
            r.err(f"{bid}: played result {w['result']!r}: {things[v].d.get('game')} ends {', '.join(BOARDS[things[v].d['game']]['results'])}")
    elif k == "state":                                 # a little thing gets to a state (docs/IMMERSION.md)
        lf = LIFE.life_of(things[v].d) if v in things and things[v].kind == "prop" else None
        if not lf:
            r.err(f"{bid}: state {v!r} isn't a placed thing with a life")
        elif w.get("is") not in LIFE.states(lf):
            r.err(f"{bid}: state {v} is {w.get('is')!r}: one of its states ({', '.join(LIFE.states(lf))})")
    elif k in ("ticked", "failed"):                    # a to-do task ticked or failed; true: the list through, any failed
        if v is not True and v not in todos_of(story):
            r.err(f"{bid}: {k} {v!r}: true or a task some stitch puts on the to-do list (`todo`)")
    elif k == "rolled":                                # a die thrown (use: roll): any roll, one face, or at least a face
        if v not in things or things[v].use != "roll":
            r.err(f"{bid}: rolled {v!r} isn't a placed thing with use: roll")
        sides = int(things[v].d.get("sides", 6)) if v in things else 6
        for f in ("face", "at_least"):
            if f in w and not (isinstance(w[f], int) and 1 <= w[f] <= sides):
                r.err(f"{bid}: rolled {f} {w[f]!r} (a face from 1 to {sides})")



def check_action(bid, a, story, things, r, stage=None):
    keys = verbs(a)
    if len(keys) != 1:
        r.err(f"{bid}: an action needs exactly one verb, has {sorted(a)}")
        return
    k = keys[0]
    v = a[k]
    stage = stage or {}

    def placed(x, what="thing"):
        if x not in things and x not in stage:
            r.err(f"{bid}: {k} names {x!r}, which isn't a placed {what}")
            return False
        return x in things

    lines, sounds, items, cast = (story.get(t, {}) for t in ("lines", "sounds", "items", "cast"))
    if k == "karma":
        check_karma(bid, v, story, r)
        return
    if k == "count":
        if v not in (story["game"].get("counters") or {}):
            r.err(f"{bid}: count {v!r} isn't in game.counters ({', '.join(story['game'].get('counters') or {}) or 'none'})")
        if not isinstance(a.get("add", 1), (int, float)) or ("set" in a and not isinstance(a["set"], (int, float))):
            r.err(f"{bid}: count takes `add` (a number, 1 by default) or `set`")
        return
    if k == "scene":                                   # a triggered scene: plays from where the player is, then play goes on
        if v not in story.get("scenes", {}):
            r.err(f"{bid}: scene {v!r} isn't a scene")
        elif any(n.get("type") == "scene" and n.get("ref") == v for n in story.get("flow", {}).values()):
            r.warn(f"{bid}: scene {v!r} is also a flow node: it will play twice")
        return
    if k == "ask":                                     # a question with answers floating beside who / at on (STORY_FORMAT §4)
        if not isinstance(v, str) or not v:
            r.err(f"{bid}: ask needs an id (a word, for `answered`)")
        if ("line" in a) == ("text" in a):
            r.err(f"{bid}: ask {v!r}: the question is a `line` (spoken) or a `text` (a thought), one of them")
        elif "line" in a and a["line"] not in lines:
            r.err(f"{bid}: ask {v!r}: line {a['line']!r} isn't a line")
        if "who" in a and a["who"] not in cast:
            r.err(f"{bid}: ask {v!r}: who {a['who']!r} isn't in cast")
        if "on" in a:
            placed(a["on"])
        if "who" in a and "on" in a:
            r.err(f"{bid}: ask {v!r}: beside `who` or at `on`, not both")
        opts = a.get("options")
        if not isinstance(opts, list) or not 2 <= len(opts) <= 4 or not all(isinstance(o, dict) for o in opts):
            r.err(f"{bid}: ask {v!r}: options are 2 to 4 answers, each {{id, label, ja?, do?}}")
            return
        ids = [o.get("id") for o in opts]
        if len(set(ids)) != len(ids) or not all(isinstance(i, str) and i for i in ids):
            r.err(f"{bid}: ask {v!r}: each answer needs its own id")
        for o in opts:
            if not o.get("label"):
                r.err(f"{bid}: ask {v!r} answer {o.get('id')!r} needs a label")
            for sub in o.get("do") or []:
                check_action(f"{bid} ask {v} {o.get('id')}", sub, story, things, r, stage)
        if "secs" in a and not (isinstance(a["secs"], (int, float)) and a["secs"] > 0):
            r.err(f"{bid}: ask {v!r}: secs is a number of seconds")
        if "secs" in a and a.get("default") not in ids:
            r.err(f"{bid}: ask {v!r} is timed: `default` (the answer when time runs out) is one of {', '.join(map(str, ids))}")
        elif "default" in a and a["default"] not in ids:
            r.err(f"{bid}: ask {v!r}: default {a['default']!r} isn't one of its answers")
        return
    if k == "todo":                                    # a task on the to-do list (STORY_FORMAT §4)
        if not isinstance(v, str) or not re.match(r"^[a-z0-9_]+$", v):
            r.err(f"{bid}: todo needs an id (a word: lower case, digits, _), for tick, fail and the ticked trigger")
        if not isinstance(a.get("text"), str) or not a["text"].strip():
            r.err(f"{bid}: todo {v!r} needs its `text` (what the list says: \"Mop the floor\")")
        for f in ("ticks", "fails"):
            if f in a:
                if not isinstance(a[f], dict):
                    r.err(f"{bid}: todo {v!r} {f} is a trigger ({{\"enter\": \"kitchen\"}})")
                else:
                    check_trigger(f"{bid} todo {v} {f}", a[f], story, things, set(), r)
        if "secs" in a and not (isinstance(a["secs"], (int, float)) and a["secs"] > 0):
            r.err(f"{bid}: todo {v!r}: secs is a number of seconds (it fails when they're up)")
        on = a.get("on") or {}
        if not isinstance(on, dict) or set(on) - TODO_ON:
            r.err(f"{bid}: todo {v!r}: `on` is {{done: [actions], failed: [actions]}}")
        else:
            for res, acts in on.items():
                for sub in acts or []:
                    check_action(f"{bid} todo {v} on {res}", sub, story, things, r, stage)
        if "who" in a and a["who"] not in cast:
            r.err(f"{bid}: todo {v!r}: who {a['who']!r} isn't in cast")
        return
    if k == "chapter":                                 # a title card: dark, the card, the time of day, an autosave
        if not isinstance(v, str) or not v.strip():
            r.err(f"{bid}: chapter needs its title (\"Night 2\")")
        if "time" in a and a["time"] not in L.TIMES:
            r.err(f"{bid}: chapter time {a['time']!r} (one of {', '.join(L.TIMES)})")
        if "secs" in a and not (isinstance(a["secs"], (int, float)) and 0 < a["secs"] <= 12):
            r.err(f"{bid}: chapter secs: how long the card is held, 0 to 12")
        if "sub" in a and not isinstance(a["sub"], str):
            r.err(f"{bid}: chapter sub is a line of text under the title (\"23:40\")")
        if "save" in a and not isinstance(a["save"], bool):
            r.err(f"{bid}: chapter save is true or false (an autosave, true by default)")
        return
    if k in ("tick", "fail", "untodo"):
        if v not in todos_of(story) and not (k == "untodo" and v is True):
            r.err(f"{bid}: {k} {v!r} isn't a task any stitch puts on the to-do list (`todo`)" + (" (or true: all of them)" if k == "untodo" else ""))
        return
    if k == "say" and v not in lines:
        r.err(f"{bid}: say {v!r} isn't a line")
    elif k == "sound":
        if v not in sounds:
            r.err(f"{bid}: sound {v!r} isn't in sounds")
        if a.get("at"):
            placed(a["at"])
    elif k == "music" and v not in MUSIC:
        r.err(f"{bid}: music {v!r} (one of {', '.join(sorted(MUSIC))})")
    elif k == "light":
        if a.get("room"):
            placed(a["room"], "room")
        elif placed(v, "light") and things[v].use != "light":
            r.err(f"{bid}: light {v!r} isn't a light")
        if a.get("set") not in LIGHT_SET:
            r.err(f"{bid}: light set {a.get('set')!r}")
    elif k == "door":
        if placed(v, "door") and things[v].kind != "door":
            r.err(f"{bid}: door {v!r} isn't a door")
        if a.get("set") not in DOOR_SET:
            r.err(f"{bid}: door set {a.get('set')!r}")
    elif k in ("show", "hide", "anim", "lookat"):
        placed(v)
    elif k == "move":
        placed(v)
        if placed(a.get("to"), "spot") and things[a["to"]].use != "spot":
            r.err(f"{bid}: move to {a['to']!r} isn't a spot")
    elif k in ("give", "take") and v not in items:
        r.err(f"{bid}: {k} {v!r} isn't an item")
    elif k == "state":                                  # a little thing to a state: {"state": "kettle", "to": "heating"}
        lf = LIFE.life_of(things[v].d) if v in things and things[v].kind == "prop" else None
        if not lf:
            r.err(f"{bid}: state {v!r} isn't a placed thing with a life")
        elif a.get("to") not in LIFE.states(lf):
            r.err(f"{bid}: state {v} to {a.get('to')!r}: one of its states ({', '.join(LIFE.states(lf))})")
    elif k == "shot":
        if a.get("who") not in cast:
            r.err(f"{bid}: shot who {a.get('who')!r} isn't in cast")
        if a.get("line") and a["line"] not in lines:
            r.err(f"{bid}: shot line {a['line']!r} isn't a line")
    elif k == "behave":                                 # {"behave": cast id, "as": idle sit path patrol off, ...}
        routes = {rid for lv in story.get("levels", {}).values() for rid in (lv.get("routes") or {})}
        as_ = a.get("as", "idle")
        if v not in cast:
            r.err(f"{bid}: behave {v!r} isn't in cast")
        if as_ not in BEHAVE:
            r.err(f"{bid}: behave as {as_!r} (one of {', '.join(sorted(BEHAVE))})")
            return
        for f in BEHAVE[as_]:
            if f not in a:
                r.err(f"{bid}: behave as {as_} needs {f!r}")
        if "at" in a:
            placed(a["at"], "spot")
        rs = a.get("routes", []) + ([a["route"]] if isinstance(a.get("route"), str) else [])
        for x in rs:
            if x not in routes:
                r.err(f"{bid}: route {x!r} isn't a route on any level")
        for x in a.get("route", []) if isinstance(a.get("route"), list) else []:
            placed(x, "spot")
        if a.get("pose") is not None and a["pose"] not in POSES:
            r.err(f"{bid}: behave pose {a['pose']!r} isn't in Content/Studio/poses.json")
        if a.get("motion") is not None:                 # what she plays: standing, sitting, or walking (in place) a route
            ms = story.get("motions", {})
            if a["motion"] not in ms:
                r.err(f"{bid}: behave motion {a['motion']!r} isn't in motions")
            elif as_ in ("path", "patrol") and not ms[a["motion"]].get("in_place"):
                r.warn(f"{bid}: behave motion {a['motion']} walks a route: make it in_place (the route moves her)")
            elif FORMAT >= 3 and not ms[a["motion"]].get("name"):
                r.warn(f"{bid}: motion {a['motion']} has no Kimodo `name`: it won't be on the shot list")
        sees = a.get("sees", False)
        if not (isinstance(sees, bool) or isinstance(sees, dict) and set(sees) <= SIGHT and all(isinstance(x, (int, float)) and x >= 0 for x in sees.values())):
            r.err(f"{bid}: behave sees {sees!r}: true, or some of {', '.join(sorted(SIGHT))} as numbers")
        if a.get("pick", "order") not in ("order", "random") or a.get("mode", "loop") not in ROUTE_MODES:
            r.err(f"{bid}: behave pick (order random) or mode (loop pingpong once)")
    elif k == "stalker":
        if v not in STALKER:
            r.err(f"{bid}: stalker {v!r}")
        for s in [a.get("at")] + list(a.get("route", [])):
            if s:
                placed(s, "spot")
    elif k == "trick":
        if v not in TRICKS:
            r.err(f"{bid}: unknown trick {v!r}")
            return
        missing = TRICKS[v][0] - set(a)
        if missing:
            r.err(f"{bid}: trick {v} needs {', '.join(sorted(missing))}")
        for f in ("hide", "show", "door", "room", "figure", "at", "trigger", "back_to", "lookat"):
            if f in a:
                placed(a[f])
        if v == "whisper" and a.get("line") not in lines:
            r.err(f"{bid}: whisper line {a.get('line')!r} isn't a line")
        if v in ("glimpse", "jumpscare") and a.get("figure") in things and \
                not things[a["figure"]].d.get("shape", "").startswith("person"):
            r.err(f"{bid}: {v} figure {a['figure']!r} isn't a person")
        for sub in a.get("then", []):
            check_action(bid, sub, story, things, r, stage)


def check_stitch(tid, st, story, things, r):
    if L.level_of(story, st) not in story.get("levels", {}):
        r.err(f"stitch {tid}: level {st.get('level')!r} doesn't exist")
    beats = {b["id"] for b in st.get("beats", [])}
    has_done = False
    for b in st.get("beats", []):
        check_trigger(b["id"], b.get("when", {}), story, things, beats, r)
        w = b.get("when", {})
        if "rolled" in w and ("face" in w or "at_least" in w) and not (b.get("optional") or b.get("secret")):
            r.warn(f"{b['id']}: a roll is chance: a beat that needs a face should be optional or secret, or the player may never get it")
        if "played" in w and "result" in w and not (b.get("optional") or b.get("secret")):
            r.warn(f"{b['id']}: a game's result is chance: a beat that needs one result should be optional or secret (a flag the flow branches on), or the player may never get it")
        if b.get("secret") and b["secret"] not in story.get("secrets", {}):
            r.err(f"{b['id']}: secret {b['secret']!r} isn't in secrets")
        cued = "look" in b.get("when", {})
        for act in b.get("do", []):
            check_action(b["id"], act, story, things, r)
            v = verbs(act)
            if v and v[0] == "done":
                has_done = True
            if v and v[0] in CUES or act.get("trick") in ("knock", "whisper"):
                cued = True
            if act.get("trick") in REVEALS and not cued:
                r.warn(f"{b['id']}: {act['trick']} with no cue before it (a sound, light or door in the same beat "
                       f"first): lead the eye to where the reveal is")
            if "lookat" in act and "trick" not in act and float(act.get("secs", 1)) > MAX_HOLD:
                r.warn(f"{b['id']}: lookat holds {act['secs']} s without control (max {MAX_HOLD})")
    pl = st.get("play")
    if pl:
        if pl.get("type") not in L.PLAYS:
            r.err(f"stitch {tid}: play type {pl.get('type')!r} (one of {', '.join(L.PLAYS)})")
        if not isinstance(pl.get("secs"), (int, float)) or pl["secs"] <= 0:
            r.err(f"stitch {tid}: play needs secs (how long the round lasts)")
        if not pl.get("rule"):
            r.warn(f"stitch {tid}: play has no `rule`: one line a child could say (\"hide before she finishes counting\")")
        for sp in pl.get("spots", []):
            if sp not in things:
                r.err(f"stitch {tid}: play spot {sp!r} isn't a placed thing")
        cast, motions, lines = story.get("cast", {}), story.get("motions", {}), story.get("lines", {})
        if pl.get("seeker") and pl["seeker"] not in cast:
            r.err(f"stitch {tid}: play seeker {pl['seeker']!r} isn't in cast")
        for role, mid in (pl.get("loops") or {}).items():
            if role not in L.PLAY_ROLES:
                r.err(f"stitch {tid}: play loop role {role!r} (one of {', '.join(L.PLAY_ROLES)})")
            if mid not in motions:
                r.err(f"stitch {tid}: play loop {role} {mid!r} isn't in motions")
            elif FORMAT >= 3 and not motions[mid].get("name"):
                r.warn(f"stitch {tid}: motion {mid} has no Kimodo `name`: it won't be on the shot list")
        for moment, ids in (pl.get("barks") or {}).items():
            if moment not in L.BARK_MOMENTS:
                r.err(f"stitch {tid}: play bark moment {moment!r} (one of {', '.join(L.BARK_MOMENTS)})")
            for lid in ids:
                if lid not in lines:
                    r.err(f"stitch {tid}: play bark {lid!r} isn't a line")
                elif pl.get("seeker") and lines[lid].get("who") != pl["seeker"]:
                    r.warn(f"stitch {tid}: bark {lid} is {lines[lid].get('who')}'s, not the seeker's")
            if len(ids) == 1 and moment in ("search", "near", "taunt"):
                r.warn(f"stitch {tid}: one {moment} bark repeats every time: give it two or three to pick from")
        for res, acts in (pl.get("on") or {}).items():
            if res not in L.PLAYS.get(pl.get("type"), []):
                r.err(f"stitch {tid}: play on {res!r} isn't a result of {pl.get('type')} ({', '.join(L.PLAYS.get(pl.get('type'), []))})")
            for a in acts:
                check_action(f"stitch {tid} play on {res}", a, story, things, r)
    elif not has_done:
        r.err(f"stitch {tid}: no beat ends it ({{\"done\": true}})")


SFX_INDEX = L.STUDIO / "SFX" / "index.json"


def check_sounds(story, r):
    """A sound's file: sfx/<name> names the Studio's sound shelf (tools/sfx.py), and must be on it; any other file is
    the game's own, under its Audio folder in Unreal."""
    try:
        shelf = json.loads(SFX_INDEX.read_text("utf-8")).get("sounds", {})
    except (OSError, ValueError):
        shelf = None
    for k, s in story.get("sounds", {}).items():
        f = (s or {}).get("file")
        if not f:
            r.err(f"sound {k}: needs a file (sfx/<name> off the Studio's shelf, or the game's own)")
        elif f.startswith("sfx/"):
            if shelf is None:
                r.warn(f"sound {k}: {f} is on the Studio's sound shelf, which isn't here (python tools/sfx.py fetch)")
            elif f[4:] not in shelf:
                r.err(f"sound {k}: {f} isn't on the Studio's sound shelf (python tools/sfx.py list)")


def check_motions(story, r):
    for k, m in story.get("motions", {}).items():
        if m.get("in_place") and not m.get("loop"):
            r.warn(f"motion {k}: in_place without loop: in-place motions are cycles the game moves (walks, runs, searches)")
        if not m.get("prompt"):
            r.err(f"motion {k}: needs a prompt")
        if m.get("who") and m["who"] not in story.get("cast", {}):
            r.err(f"motion {k}: who {m['who']!r} isn't in cast")
        if FORMAT >= 3 and m.get("name"):
            if not PERSON.match(m.get("prompt", "")):
                r.err(f"motion {k}: the prompt starts \"A person ...\" (docs/KIMODO.md): {m.get('prompt')!r}")
            if not SEG_NAME.match(m["name"]):
                r.err(f"motion {k}: name {m['name']!r}: <game>_<cast>_<motion id>, lower case (docs/KIMODO.md §3)")


def scene_event(story, n):
    """The event a result choice reads: clip `event` of scene node `of` (the last clip with an event by default)."""
    src = story["flow"].get(n.get("of"), {})
    if src.get("type") == "stitch":                   # a gameplay stitch: its play's results
        pl = (story.get("stitches", {}).get(src.get("ref")) or {}).get("play")
        return {"play": pl, "on": pl.get("on") or {}} if pl else None
    sc = story.get("scenes", {}).get(src.get("ref")) if src.get("type") == "scene" else None
    if not sc:
        return None
    clips = [c for c in L.scene_version(sc).get("clips", []) if c.get("event")]
    if n.get("event"):
        clips = [c for c in clips if c["id"] == n["event"]]
    return clips[-1]["event"] if clips else None


def check_flow(story, things, r):
    flow, scenes, stitches = story.get("flow", {}), story.get("scenes", {}), story.get("stitches", {})
    st = story["game"].get("see_through")              # the hiding places' default (a locker's own wins)
    if st is not None and not (isinstance(st, (int, float)) and 0 <= st <= 1):
        r.err(f"game.see_through {st!r}: a number 0..1")
    th = story["game"].get("ui_theme")                 # the Play HUD's theme: a file in tools/director/play/ui/themes
    if th is not None and not (Path(__file__).resolve().parent / "director" / "play" / "ui" / "themes" / f"{th}.css").is_file():
        r.err(f"game.ui_theme {th!r}: no tools/director/play/ui/themes/{th}.css")
    if story["game"].get("start") not in flow:
        r.err(f"game.start {story['game'].get('start')!r} isn't a flow node")
    if "time" in story["game"] and story["game"]["time"] not in L.TIMES:
        r.err(f"game.time {story['game']['time']!r}: the time the game starts at, one of {', '.join(L.TIMES)} ({L.TIME_DEFAULT} when unset)")
    for nid, ft in L.flow_times(story).items():          # a scene staged for one time that a path brings at another
        if flow[nid].get("type") == "scene" and not ft["own"] and len(ft["paths"]) > 1:
            r.warn(f"flow {nid}: its scene plays at {' or '.join(ft['paths'])} depending on the path; give it a `time` if it's staged for one")
    frames, in_act = story.get("frames", []), {}        # the board's acts: coloured frames behind groups of cards
    if not isinstance(frames, list):
        r.err("frames: a list of the board's acts, each {id, title, color, nodes}")
        frames = []
    for f in frames:
        fid = f.get("id") if isinstance(f, dict) else None
        if not isinstance(fid, str) or not fid:
            r.err(f"frames: {f!r}: an act needs an id, a title, a color and its nodes")
            continue
        if any(x is not f and isinstance(x, dict) and x.get("id") == fid for x in frames):
            r.err(f"frame {fid}: two acts with this id")
        if "color" in f and not re.fullmatch(r"#[0-9a-fA-F]{6}", str(f["color"])):
            r.err(f"frame {fid}: color {f['color']!r}: #rrggbb")
        for nid in f.get("nodes", []):
            if nid not in flow:
                r.err(f"frame {fid}: {nid!r} isn't a flow node")
            elif nid in in_act and in_act[nid] != fid:
                r.err(f"flow {nid}: in two acts ({in_act[nid]} and {fid})")
            in_act[nid] = fid
    for nid, n in flow.items():
        t = n.get("type")
        if "xy" in n and not (isinstance(n["xy"], list) and len(n["xy"]) == 2 and all(isinstance(v, (int, float)) for v in n["xy"])):
            r.err(f"flow {nid}: xy {n['xy']!r}: where it sits on the desk's board, [x, y]")
        if t in ("scene", "stitch"):
            table = scenes if t == "scene" else stitches
            if n.get("ref") not in table:
                r.err(f"flow {nid}: {t} {n.get('ref')!r} doesn't exist")
            if n.get("next") not in flow:
                r.err(f"flow {nid}: next {n.get('next')!r} isn't a flow node")
        elif t == "choice":
            by, opts = n.get("by"), n.get("options", [])
            if by not in ("act", "flag", "result", "karma", "count"):
                r.err(f"flow {nid}: choice by {by!r} (act, flag, result, karma or count)")
            if by == "count":
                ctr = story["game"].get("counters") or {}
                for o in opts[:-1]:
                    if o.get("count") not in ctr:
                        r.err(f"flow {nid}: count option names {o.get('count')!r}, not in game.counters")
                    if "min" not in o and "max" not in o:
                        r.err(f"flow {nid}: every count option but the last needs `min` or `max` (the last is the fallback)")
                if "min" in opts[-1] or "max" in opts[-1]:
                    r.err(f"flow {nid}: the last count option is the fallback: no `min` or `max`")
            if by == "karma":
                axes = L.karma_axes(story)
                for o in opts[:-1]:
                    if "min" not in o and "max" not in o:
                        r.err(f"flow {nid}: every karma option but the last needs `min` or `max` (the last is the fallback)")
                    if o.get("axis", "karma" if "karma" in axes else next(iter(axes))) not in axes:
                        r.err(f"flow {nid}: karma axis {o.get('axis')!r} isn't in game.karma.axes")
                if "min" in opts[-1] or "max" in opts[-1]:
                    r.err(f"flow {nid}: the last karma option is the fallback: no `min` or `max`")
            if len(opts) < 2:
                r.err(f"flow {nid}: a choice needs two options or more")
            for o in opts:
                if o.get("to") not in flow:
                    r.err(f"flow {nid}: option goes to {o.get('to')!r}, not a flow node")
                if by == "act":
                    check_trigger(nid, o.get("when", {}), story, things, set(), r)
            if by == "flag" and any("if" not in o for o in opts[:-1]):
                r.err(f"flow {nid}: every option but the last needs 'if'")
            if by == "result":
                ev = scene_event(story, n)
                if ev is None:
                    r.err(f"flow {nid}: 'of' {n.get('of')!r} isn't a scene node with an event or a stitch with a play")
                else:
                    results = L.event_results(ev)
                    for o in opts:
                        if o.get("result") not in results:
                            r.err(f"flow {nid}: result {o.get('result')!r} (the event's results: {', '.join(map(str, results))})")
                    missing = set(results) - {o.get("result") for o in opts}
                    if missing:
                        r.err(f"flow {nid}: no option for result {', '.join(sorted(map(str, missing)))}")
        elif t == "ending":
            if n.get("kind") not in ENDINGS:
                r.err(f"flow {nid}: ending kind {n.get('kind')!r}")
            if n.get("kind") == "death":
                rt = n.get("retry")
                if rt not in flow or flow.get(rt, {}).get("type") == "ending":
                    r.err(f"flow {nid}: a death names `retry`, the branch the map suggests returning to (a flow node, not an ending)")
        else:
            r.err(f"flow {nid}: type {t!r} (scene, stitch, choice, ending)")
    for sid, sc in scenes.items():
        evs = [c["event"] for c in L.scene_version(sc).get("clips", []) if c.get("event")]
        if evs:
            for k in [k for k, n in flow.items() if n.get("ref") == sid and n.get("type") == "scene"]:
                nxt = flow.get(flow[k].get("next"), {})
                karma = any("karma" in o for e in evs for o in e.get("options", []))
                if (nxt.get("type") != "choice" or nxt.get("by") != "result") and not any(e.get("on") for e in evs) and not karma:
                    r.warn(f"flow {k}: scene {sid} has an event, but nothing uses its result (a result choice next, or `on`)")
    for tid, st in stitches.items():
        tm = st.get("timer")
        if tm:
            if not isinstance(tm.get("secs"), (int, float)) or tm["secs"] <= 0:
                r.err(f"stitch {tid}: timer needs secs")
            if tm.get("fail") not in flow:
                r.err(f"stitch {tid}: timer fail {tm.get('fail')!r} isn't a flow node")
    if FORMAT >= 3:
        check_no_death(story, r)
        check_eggs(story, r)
    for it in story.get("interrupts", []):
        w = f"interrupt {it.get('id')}"
        check_trigger(w, it.get("when", {}), story, things, set(), r)
        if it.get("to") not in flow:
            r.err(f"{w}: to {it.get('to')!r} isn't a flow node")
        during = it.get("during", "all")
        if during != "all" and any(t not in stitches for t in during):
            r.err(f"{w}: during names something that isn't a stitch")
    for k, s in story.get("secrets", {}).items():
        sets = json.dumps(story.get("stitches", {})) + json.dumps(story.get("scenes", {}))
        if f'"flag": "{s.get("flag")}"' not in sets:
            r.warn(f"secret {k}: nothing sets its flag {s.get('flag')!r}")


def flow_edges(story):
    """Every edge of the flow: (from, to, why)."""
    flow, out = story.get("flow", {}), []
    for nid, n in flow.items():
        if n.get("next"):
            out.append((nid, n["next"], "next"))
        for o in n.get("options", []):
            why = "karma" if n.get("by") == "karma" else ("result " + str(o.get("result")) if n.get("by") == "result" else n.get("by"))
            out.append((nid, o.get("to"), why))
        if n.get("type") == "stitch":
            tm = (story.get("stitches", {}).get(n.get("ref")) or {}).get("timer")
            if tm:
                out.append((nid, tm.get("fail"), "timer"))
    for it in story.get("interrupts", []):
        for nid, n in flow.items():
            during = it.get("during", "all")
            if n.get("type") == "stitch" and (during == "all" or n.get("ref") in during):
                out.append((nid, it.get("to"), "interrupt " + str(it.get("id"))))
    return out


def is_final(story, nid):
    n = story["flow"].get(nid, {})
    ref = (story.get("scenes", {}).get(n.get("ref")) or story.get("stitches", {}).get(n.get("ref")) or {}) if n.get("ref") else {}
    return bool(n.get("final") or ref.get("final"))


def check_no_death(story, r):
    """No dying (game.no_death, on by default in format 3): an ending comes only from a karma choice or a node marked
    final. A missed task, a lost struggle or an interrupt leads on to a scene or a task: the player is guided back."""
    if not story["game"].get("no_death", False):     # deaths are back (DECISIONS 2026-10-21): only a game that asks
        return
    flow = story["flow"]
    for a, b, why in flow_edges(story):
        if flow.get(b, {}).get("type") != "ending":
            continue
        n = flow.get(a, {})
        if why == "karma" or is_final(story, a):
            continue
        if n.get("type") == "choice" and n.get("by") == "flag" and is_final_branch(story, a):
            continue
        r.err(f"flow {a} -> {b} ({why}): an ending outside the final act. No dying: guide the player on to a scene or "
              f"a task (they're found, wake, are pulled along), or mark the node `final: true` if this is the end")


def is_final_branch(story, nid):
    """A flag choice in the final act: every node leading into it is final."""
    preds = [a for a, b, _ in flow_edges(story) if b == nid]
    return bool(preds) and all(is_final(story, a) or story["flow"][a].get("type") == "choice" for a in preds)


def reach(story, start, stop=None):
    flow, seen, todo = story["flow"], set(), [start]
    succ = {}
    for a, b, _ in flow_edges(story):
        succ.setdefault(a, []).append(b)
    while todo:
        n = todo.pop()
        if n in seen or n not in flow:
            continue
        seen.add(n)
        if n == stop:
            continue
        todo.extend(succ.get(n, []))
    return seen


def check_eggs(story, r):
    """Easter eggs (a flag choice on a secret's flag) blend back into the main story: their branch reaches the
    fallback's node again."""
    secret_flags = {s.get("flag") for s in story.get("secrets", {}).values()}
    for nid, n in story["flow"].items():
        if n.get("type") != "choice" or n.get("by") != "flag" or is_final(story, nid) or is_final_branch(story, nid):
            continue
        main = n["options"][-1].get("to")
        for o in n["options"][:-1]:
            if not secret_flags & {f.lstrip("!") for f in o.get("if", [])}:
                continue
            if main not in reach(story, o.get("to"), stop=main):
                r.warn(f"flow {nid}: the easter egg to {o.get('to')} never rejoins the main story at {main}: let it blend back")


# ---- the playthrough: a greedy player down every path -----------------------------------------------------------

class World:
    def __init__(self, story, things, r, verbose=False):
        self.story, self.things, self.r, self.verbose = story, things, r, verbose
        self.flags, self.inv, self.done_events, self.fired = set(), set(), set(), set()
        self.hidden = {t.id for t in things.values() if t.d.get("hidden")}
        self.taken, self.used = set(), set()
        self.locked = {t.id for t in things.values() if t.kind == "door" and t.d.get("locked_by")}
        self.visited, self.pos, self.room, self.level = set(), None, None, None
        self.cur, self.clock = None, 0.0
        self.secs = {}           # node -> {what: seconds}  (a typical first-time player)
        self.fast = {}           # node -> seconds          (a fast player who knows what to do)
        self.bait = set()        # things the greedy player leaves alone (they trigger interrupts)
        for it in story.get("interrupts", []):
            w = it.get("when", {})
            for t in things.values():
                if t.id == w.get("use") or (t.use == "pickup" and t.d.get("item") == w.get("pickup")):
                    self.bait.add(t.id)
        self.scares = []         # (clock, trick, where)
        self.route = []
        self.path = []           # node ids
        self.results = {}        # scene node -> escape/caught
        self.seek_secrets = False  # the second sweep fires `secret` beats; the first plays past them
        self.dev = 0               # how far this path strays from the spine (later options, interrupts, timeouts)
        self.karma = {}            # axis -> total
        self.counters = {}         # game.counters -> value
        self.todo = {}             # the to-do list: task id -> [state (open done failed), its todo action]
        self.style = "kind"        # how this sweep answers timed choices (STYLES)
        self.answers = []          # (scene node, clip, option) for the report
        # the little things' lives (docs/IMMERSION.md): each one's state, a follower where its leader puts it
        self.lives = {t.id: lf for t in things.values() if t.kind == "prop" for lf in [LIFE.life_of(t.d)] if lf}
        self.states = {k: LIFE.start(things[k].d, lf) for k, lf in self.lives.items()}
        for k, lf in self.lives.items():
            lead = self.leader(k)
            m = (LIFE.lives()[lf].get("follows") or {}).get(self.states.get(lead)) if lead else None
            if m and "state" not in things[k].d:
                self.states[k] = m

    # the little things
    def leader(self, tid):
        on = self.things[tid].d.get("on")
        return on if on in self.lives and (LIFE.lives()[self.lives[tid]].get("follows")) else None

    def reach_state(self, tid, to, acts=True, depth=0):
        """Seconds until it's in `to` (waiting, the player's acts beside it, its leader's), or None."""
        lf = self.lives.get(tid)
        if not lf or depth > 4:
            return None
        t, lead = self.things[tid], self.leader(tid)
        d = t.d if acts and self.can_reach(tid) else dict(t.d, acts=False)

        def ready(key):
            src = t.d.get(key)
            got = [self.reach_state(src, x, acts, depth + 1) for x in LIFE.states(self.lives[src]) if (LIFE.state_def(self.lives[src], x) or {}).get("ready")] if src in self.lives else []
            got = [g for g in got if g is not None]
            return min(got) if got else None
        return LIFE.reach(lf, d, self.states[tid], to, (lambda x: self.reach_state(lead, x, acts, depth + 1)) if lead else None, ready)

    def set_state(self, tid, to):
        """It's in `to` now; what stands on it follows (unless already on its way: life.js States.enter)."""
        if tid not in self.states or self.states[tid] == to:
            return
        self.states[tid] = to
        for f, lf in self.lives.items():
            m = (LIFE.lives()[lf].get("follows") or {}).get(to) if self.leader(f) == tid else None
            if m and LIFE.reach(lf, dict(self.things[f].d, acts=False), m, self.states[f]) is None:
                self.set_state(f, m)

    def wait_state(self, nid, tid, to):
        """Play until it's in `to`: the player does what it takes beside it (and its leader), then waits."""
        secs = self.reach_state(tid, to)
        if secs is None:
            return
        idle = self.reach_state(tid, to, acts=False)
        if idle is None or idle > secs + 0.01:                 # it takes the player's hand: go to it and use it
            self.go(tid)
            self.route.append({"node": nid, "do": "use", "id": tid})
        lead = self.leader(tid)
        if lead:                                              # its leader goes to where it puts it there (the hob on)
            lf = self.lives[tid]
            for ls, fs in (LIFE.lives()[lf].get("follows") or {}).items():
                if LIFE.reach(lf, dict(self.things[tid].d, acts=False), fs, to) is not None and self.reach_state(lead, ls) is not None:
                    self.set_state(lead, ls)
                    break
        self.add("waiting", secs)
        self.set_state(tid, to)

    def add_karma(self, delta):
        for k, v in L.karma_of(delta).items():
            self.karma[k] = self.karma.get(k, 0.0) + v

    def answer(self, ev):
        """The option this sweep's player takes at a timed choice: the kindest, the cruellest, or silence (the default)."""
        opts = ev.get("options", [])
        if self.style == "silent" or not any("karma" in o for o in opts):
            return next((o for o in opts if o.get("id") == ev.get("default")), opts[0] if opts else {})
        score = lambda o: sum(L.karma_of(o.get("karma")).values())
        return max(opts, key=score) if self.style == "kind" else min(opts, key=score)

    def fork(self):
        story, things, r = self.story, self.things, self.r
        self.story = self.r = None
        w = copy.deepcopy(self)
        self.story, self.r = story, r
        w.story, w.r = story, r
        return w

    # where the player can be
    def door_locked(self, did):
        if did not in self.locked:
            return False
        lb = self.things[did].d.get("locked_by", "")
        return not (lb.startswith("flag:") and lb[5:] in self.flags)

    def reachable_rooms(self):
        lvl = self.story["levels"][self.level]
        seen, todo = {self.room}, [self.room]
        while todo:
            rm = todo.pop()
            for ln in lvl.get("links", []):
                if rm not in (ln["a"], ln["b"]):
                    continue
                other = ln["b"] if rm == ln["a"] else ln["a"]
                if other in seen or (ln.get("via") and self.door_locked(ln["via"])):
                    continue
                seen.add(other)
                todo.append(other)
        return seen

    def can_reach(self, tid):
        t = self.things.get(tid)
        if not t or t.level != self.level or tid in self.hidden:
            return False
        rooms = self.reachable_rooms()
        if t.kind == "door":
            for ln in self.story["levels"][self.level].get("links", []):
                if ln.get("via") == tid and (ln["a"] in rooms or ln["b"] in rooms):
                    return True
        return t.room in rooms

    def enter_level(self, level):
        if level != self.level:
            self.level = level
            st = self.things[self.story["levels"][level]["start"]]
            self.pos, self.room = st.pos, st.room
            self.visited.add(st.room)

    # time
    def add(self, what, secs):
        c = self.secs.setdefault(self.cur, {})
        c[what] = c.get(what, 0) + secs
        self.fast[self.cur] = self.fast.get(self.cur, 0) + secs * FAST.get(what, 1.0)
        self.clock += secs

    def go(self, tid):
        t = self.things[tid]
        self.route.append({"node": self.cur, "do": "go", "id": tid})
        if self.pos is not None:
            self.add("walking", L.dist(self.pos, t.pos) / WALK)
        self.pos = t.pos
        if t.kind != "door":
            self.room = t.room
        if t.room not in self.visited:
            self.visited.add(t.room)
            self.add("looking round", ROOM_FIRST)
            props = [q for q in self.things.values() if q.room == t.room and q.kind == "prop" and q.d.get("shape")]
            if any(q.use == "pickup" for q in props):
                self.add("searching", SEARCH * len(props))

    # triggers
    def can_fire(self, w):
        k = next(iter(set(w) - TRIGGER_EXTRA))
        v = w[k]
        if k == "start":
            return ("start", self.cur) in self.done_events
        if k in ("enter", "exit", "look", "rolled", "played"):   # rolled, played: the walker plays until the face, the result, comes up
            return self.can_reach(v)
        if k == "hidden":                                 # the walker gets into that locker, or the nearest one it can reach
            return any(self.can_reach(t.id) for t in self.things.values() if t.use == "locker" and (v is True or t.id == v))
        if k == "carrying":                               # the walker picks it up (that thing, or any it can reach)
            return any(self.can_reach(t.id) for t in self.things.values() if t.use == "carry" and (v is True or t.id == v))
        if k == "dropped":                                # ... and carries it there to put it down
            return self.can_reach(v) and (w.get("in") is None or self.can_reach(w["in"]))
        if k == "use":
            t = self.things[v]
            if t.use == "sleep":                          # a bed sleeps only when its `if` flags hold
                ifs = t.d.get("if") or []
                ifs = [ifs] if isinstance(ifs, str) else ifs
                if not all((f[1:] not in self.flags) if f.startswith("!") else (f in self.flags) for f in ifs):
                    return False
            if t.use == "pickup":
                return ("pickup", t.d["item"]) in self.done_events
            if t.use == "note":
                return ("read", t.d["note"]) in self.done_events
            if t.kind == "door" and self.door_locked(v):
                return False
            return self.can_reach(v)
        if k in ("pickup", "read"):
            return (k, v) in self.done_events
        if k == "after":
            return v in self.fired
        if k == "answered":                               # the walker gave the ask's default (else its first) answer
            return any(e[0] == "answered" and e[1] == v and (w.get("option") is None or e[2] == w["option"]) for e in self.done_events)
        if k == "flag":
            return v in self.flags
        if k == "ticked":                                 # holds: that task ticked, or the list through (nothing open)
            return bool(self.todo) and all(x[0] != "open" for x in self.todo.values()) if v is True else self.todo.get(v, [None])[0] == "done"
        if k == "failed":                                 # the walker fails only what the story fails (`fail`)
            return any(x[0] == "failed" for x in self.todo.values()) if v is True else self.todo.get(v, [None])[0] == "failed"
        if k == "state":                                  # the walker does what it takes and waits (wait_state)
            return self.reach_state(v, w.get("is")) is not None
        if k == "all":
            return all(self.can_fire(s) for s in v)
        if k == "any":
            return any(self.can_fire(s) for s in v)
        return False

    def where(self, w):
        k = next(iter(set(w) - TRIGGER_EXTRA))
        v = w[k]
        return v if k in ("enter", "exit", "use", "look", "rolled", "hidden", "carrying", "dropped", "played") and v in self.things else None

    def apply_state(self, a):
        k = verbs(a)[0]
        v = a[k]
        if k == "flag":
            self.flags.add(v)
        elif k == "unflag":
            self.flags.discard(v)
        elif k == "give":
            self.inv.add(v)
        elif k == "take":
            self.inv.discard(v)
        elif k == "show":
            self.hidden.discard(v)
        elif k == "hide":
            self.hidden.add(v)
        elif k == "move" and v in self.things:
            t, s = self.things[v], self.things[a["to"]]
            t.room, t.pos, t.level = s.room, s.pos, s.level
        elif k == "door":
            if a["set"] == "lock":
                self.locked.add(v)
            elif a["set"] in ("unlock", "open"):
                self.locked.discard(v)
        elif k == "state":
            self.set_state(v, a.get("to"))

    def run_actions(self, where, acts):
        """Returns True when a `done` ends the stitch."""
        lines = self.story.get("lines", {})
        for a in acts:
            k = verbs(a)[0]
            v = a[k]
            if k in STATE_VERBS:
                self.apply_state(a)
            elif k == "say":
                self.add("dialogue", L.line_secs(lines[v]) if a.get("wait", True) else 0)
            elif k == "think":
                self.add("dialogue", max(1.5, len(v) / 15))
            elif k == "wait":
                self.add("scripted", float(v))
            elif k in ("fade", "lookat"):
                self.add("scripted", float(a.get("secs", 1)))
            elif k == "shot":
                self.add("dialogue", L.line_secs(lines[a["line"]]) if a.get("line") else 2)
            elif k == "seq":
                self.add("scripted", float(a.get("secs", 3)))
            elif k == "stalker":
                self.secs.setdefault(self.cur, {})["_stalker"] = 1
            elif k == "trick":
                if v in MINOR or v == "jumpscare":
                    self.scares.append((self.clock, v, where))
                self.add("scripted", TRICKS[v][1] + float(a.get("secs", 0)))
                if v == "swap":
                    self.hidden.add(a["hide"])
                    self.hidden.discard(a["show"])
                elif v == "whisper":
                    self.add("dialogue", L.line_secs(lines[a["line"]]))
                elif v == "cut_away":
                    if self.run_actions(where, a["then"]):
                        return True
            elif k == "scene":
                self.play_scene(v, self.story["scenes"][v])
            elif k == "karma":
                self.add_karma(v)
            elif k == "count":
                self.counters[v] = float(a["set"]) if "set" in a else self.counters.get(v, 0.0) + float(a.get("add", 1))
            elif k == "ask":                              # the walker answers with the default (else the first)
                q = lines.get(a.get("line")) if a.get("line") else None
                self.add("dialogue", (L.line_secs(q) if q else max(1.5, len(a.get("text", "")) / 15)) + min(ASK_SECS, float(a.get("secs", ASK_SECS))))
                opts = [o for o in a.get("options") or [] if isinstance(o, dict)]   # a broken ask is the check's to report
                o = next((o for o in opts if o.get("id") == a.get("default")), opts[0] if opts else None)
                if o:
                    self.done_events.add(("answered", v, o.get("id")))
                    if self.run_actions(where, o.get("do") or []):
                        return True
            elif k == "chapter":
                self.add("scripted", 3.6 + float(a.get("secs", 3)))
            elif k == "todo":
                self.todo[v] = ["open", a]
            elif k in ("tick", "fail"):
                if self.set_todo(where, v, "done" if k == "tick" else "failed"):
                    return True
            elif k == "untodo":
                if v is True:
                    self.todo.clear()
                else:
                    self.todo.pop(v, None)
            elif k == "done":
                return True
        return False

    def set_todo(self, where, tid, state):
        """An open task ticked or failed: its `on` runs. True when that ends the stitch."""
        t = self.todo.get(tid)
        if not t or t[0] != "open":
            return False
        t[0] = state
        return self.run_actions(where, (t[1].get("on") or {}).get(state) or [])

    def tick_todos(self, nid):
        """The greedy player does an open task that ticks by itself (`ticks`) when it can: (fired, ended)."""
        for tid, (state, a) in list(self.todo.items()):
            if state != "open" or not isinstance(a.get("ticks"), dict) or not self.can_fire(a["ticks"]):
                continue
            at = self.where(a["ticks"])
            if at:
                self.go(at)
            if "state" in a["ticks"]:
                self.wait_state(nid, a["ticks"]["state"], a["ticks"].get("is"))
            self.route.append({"node": nid, "do": "expect", "todo": tid})
            if self.verbose:
                print(f"  [{nid}] ticks {tid}")
            return True, self.set_todo(tid, tid, "done")
        return False, False

    def player_move(self):
        for t in self.things.values():
            if t.level != self.level or t.id in self.bait or not self.can_reach(t.id):
                continue
            u = t.use
            if u == "pickup" and t.id not in self.taken:
                self.go(t.id)
                self.route.append({"node": self.cur, "do": "use", "id": t.id})
                self.taken.add(t.id)
                self.hidden.add(t.id)
                self.inv.add(t.d["item"])
                self.done_events.add(("pickup", t.d["item"]))
                return f"picks up {t.d['item']}"
            if u == "note" and ("read", t.d["note"]) not in self.done_events:
                self.go(t.id)
                self.route.append({"node": self.cur, "do": "use", "id": t.id})
                n = self.story["notes"][t.d["note"]]
                self.add("reading", L.words(n.get("text", "")) / NOTE_WPM * 60 + 10)
                self.done_events.add(("read", t.d["note"]))
                return f"reads {t.d['note']}"
            if u in ("combo", "use_on") and t.id not in self.used:
                if u == "use_on" and t.d["needs"] not in self.inv:
                    continue
                self.go(t.id)
                step = {"node": self.cur, "do": "use", "id": t.id}
                if u == "combo":
                    step["code"] = t.d["code"]
                self.route.append(step)
                self.used.add(t.id)
                self.add("puzzles", PUZZLE[u])
                if u == "use_on" and t.d.get("consume", True):
                    self.inv.discard(t.d["needs"])
                if t.d.get("then"):
                    self.flags.add(t.d["then"])
                if t.d.get("opens"):
                    self.locked.discard(t.d["opens"])
                return f"solves {t.id}"
        for did in sorted(self.locked):
            lb = self.things[did].d.get("locked_by", "")
            if lb in self.inv and self.can_reach(did):
                self.go(did)
                self.route.append({"node": self.cur, "do": "use", "id": did, "with": lb})
                self.locked.discard(did)
                return f"unlocks {did} with {lb}"
        return None

    # the node kinds
    def play_stitch(self, nid, st):
        self.enter_level(L.level_of(self.story, st))
        self.done_events.add(("start", self.cur))
        if st.get("play"):                             # a gameplay round: its length; the first result unless branched
            pl = st["play"]
            self.add("gameplay", float(pl.get("secs", 30)))
            self.results[nid] = L.PLAYS.get(pl.get("type"), ["success"])[0]
            self.route.append({"node": nid, "do": "play", "type": pl.get("type")})
            return True
        beats = st.get("beats", [])
        for _ in range(10000):
            fired_one = True
            while fired_one:
                fired_one, ended = self.tick_todos(nid)
                if ended:
                    return True
                for b in beats:
                    if b["id"] in self.fired or (b.get("secret") and not self.seek_secrets):
                        continue
                    if not all((f[1:] not in self.flags) if f.startswith("!") else (f in self.flags) for f in b.get("if", [])):
                        continue
                    if not self.can_fire(b["when"]):
                        continue
                    at = self.where(b["when"])
                    if at:
                        self.go(at)
                        k = next(iter(set(b["when"]) - TRIGGER_EXTRA))
                        if k in ("use", "look"):
                            self.route.append({"node": nid, "do": k, "id": at, "secs": b["when"].get("secs", 1.0)})
                        if k in ("carrying", "dropped"):           # picked up; put down where it's asked for, and it lies there
                            self.route.append({"node": nid, "do": "carry", "id": at})
                        if k == "dropped":
                            to = b["when"].get("in")
                            if to in self.things:
                                self.go(to)
                                self.things[at].room, self.things[at].pos = self.things[to].room, self.things[to].pos
                            self.route.append({"node": nid, "do": "drop", "id": at, **({"in": to} if to else {})})
                    if "state" in b["when"]:
                        self.wait_state(nid, b["when"]["state"], b["when"].get("is"))
                    self.route.append({"node": nid, "do": "expect", "beat": b["id"]})
                    self.fired.add(b["id"])
                    fired_one = True
                    if self.verbose:
                        print(f"  [{nid}] beat {b['id']}")
                    if self.run_actions(b["id"], b.get("do", [])):
                        return True
            move = self.player_move()
            if self.verbose and move:
                print(f"  [{nid}] player {move}")
            if not move:
                left = [b["id"] for b in beats if b["id"] not in self.fired]
                self.r.err(f"SOFTLOCK in {nid} (path {' > '.join(self.path)}): nothing left to do and no `done`. "
                           f"Unfired: {', '.join(left)}; holding {sorted(self.inv) or 'nothing'}; flags "
                           f"{sorted(self.flags) or 'none'}; locked {sorted(d for d in self.locked if self.door_locked(d)) or 'none'}")
                return False
        self.r.err(f"{nid}: the play ran 10000 steps without ending")
        return False

    def play_scene(self, nid, sc):
        self.enter_level(L.level_of(self.story, sc))
        ver = L.scene_version(sc)
        if sc.get("view") and sc["view"] in self.things:
            self.go(sc["view"])
        for i, c in enumerate(ver.get("clips", [])):
            self.add("scenes", L.clip_secs(c))
            if i and c.get("seam"):
                self.add("scenes", SEAMS.get(c["seam"].get("kind"), (None, 0))[1])
            ev = c.get("event")
            if ev and ev.get("type") == "choose":
                secs = float(ev.get("secs", L.CHOOSE_SECS if FORMAT >= 3 else 3))
                o = self.answer(ev)
                self.add("choices", secs if self.style == "silent" else min(secs, 8.0))
                self.results[nid] = o.get("id")
                self.add_karma(o.get("karma"))
                self.answers.append((nid, c.get("id"), o.get("id")))
                self.route.append({"node": nid, "do": "answer", "clip": c.get("id"), "option": o.get("id")})
            elif ev:
                self.add("scenes", float(ev.get("secs", 3)))
            rp = c.get("reply")
            if rp:                                     # the player's reply: by this sweep's style; silence skips her answer
                opts = rp.get("options", [])
                score = lambda o: sum(sum(L.karma_of(a["karma"]).values()) for a in o.get("sets", []) if "karma" in a)
                if self.style == "silent":
                    o = next((x for x in opts if x.get("id") == rp.get("timeout")), None)
                    self.add("choices", float(rp.get("wait", L.REPLY_SECS)))
                else:
                    o = (max if self.style == "kind" else min)(opts, key=score) if opts else None
                    self.add("choices", min(float(rp.get("wait", L.REPLY_SECS)), L.REPLY_ANSWER))
                if o:
                    self.run_actions(nid, o.get("sets", []))
                    if o.get("then"):
                        self.add("scenes", L.clip_secs(o["then"]))
                self.answers.append((nid, c.get("id"), (o or {}).get("id", "silence")))
        self.add("scenes", float((sc.get("hold") or {}).get("max", 0)) / 2)
        for cue in ver.get("cues", []):
            a = cue.get("do", {})
            v = verbs(a)
            if v and v[0] in STATE_VERBS:
                self.apply_state(a)
            if a.get("trick") in MINOR or a.get("trick") == "jumpscare":
                self.scares.append((self.clock, a["trick"], nid))
        self.route.append({"node": nid, "do": "scene", "id": sc.get("title", nid)})
        self.run_actions(nid, sc.get("sets", []))
        return True


def explore(w, nid, done_paths, visited_nodes):
    flow, story = w.story["flow"], w.story
    while True:
        if len(done_paths) >= MAX_PATHS:
            return
        if nid in w.path and flow[nid]["type"] != "ending":
            w.r.err(f"flow loops back to {nid} (path {' > '.join(w.path)}): loops need a flag choice to leave")
            return
        w.path.append(nid)
        visited_nodes.add(nid)
        n = flow[nid]
        w.cur = nid
        t = n["type"]
        if t == "stitch":
            st = story["stitches"][n["ref"]]
            before = w.fork()
            if not w.play_stitch(nid, st):
                return
            spent_fast, spent = w.fast.get(nid, 0), sum(v for k, v in w.secs.get(nid, {}).items() if k != "_stalker")
            tm = st.get("timer")
            if tm:
                if spent_fast > tm["secs"]:
                    w.r.err(f"{nid}: even a fast player needs {spent_fast:.0f} s, but the timer gives {tm['secs']} s")
                elif spent > tm["secs"]:
                    w.r.warn(f"{nid}: a typical player needs {spent:.0f} s against the {tm['secs']} s timer (fast {spent_fast:.0f} s): many will fail it")
                    w.secs[nid] = {"timed": float(tm["secs"]) * 0.8}
                    w.fast[nid] = spent_fast
                b = before.fork()                     # the timer runs out
                b.dev += 10
                b.cur = nid
                b.add("timed", float(tm["secs"]))
                b.route.append({"node": nid, "do": "timeout"})
                explore(b, tm["fail"], done_paths, visited_nodes)
            for it in story.get("interrupts", []):
                during = it.get("during", "all")
                if during != "all" and n["ref"] not in during:
                    continue
                k = next(iter(set(it["when"]) - TRIGGER_EXTRA))
                v = it["when"][k]
                bait = [t.id for t in w.things.values() if t.id == v or (t.use == "pickup" and t.d.get("item") == v)]
                if k == "caught" or (bait and w.can_reach(bait[0])) or (k in ("enter", "flag") and w.can_fire(it["when"])):
                    b = before.fork()                 # the player takes the bait halfway through
                    b.dev += 10
                    b.cur = nid
                    b.add("scripted", spent / 2)
                    b.route.append({"node": nid, "do": "interrupt", "id": it.get("id")})
                    explore(b, it["to"], done_paths, visited_nodes)
            pl = st.get("play")
            if pl:                                      # no result choice next: the first result's `on` happens
                nxt = flow.get(n["next"], {})
                if not (nxt.get("type") == "choice" and nxt.get("by") == "result" and nxt.get("of") == nid):
                    w.run_actions(nid, (pl.get("on") or {}).get(L.PLAYS.get(pl.get("type"), ["success"])[0], []))
            nid = n["next"]
        elif t == "scene":
            w.play_scene(nid, story["scenes"][n["ref"]])
            nid = n["next"]
        elif t == "ending":
            done_paths.append(w)
            return
        elif t == "choice":
            by = n["by"]
            if by == "flag":
                opt = next(o for o in n["options"] if all(
                    (f[1:] not in w.flags) if f.startswith("!") else (f in w.flags) for f in o.get("if", [])))
                nid = opt["to"]
                continue
            if by == "act":              # the player can still act while the choice waits (use a key, read a note)
                while w.player_move():
                    pass
            ok = []
            for o in n["options"]:
                if by == "act" and not w.can_fire(o["when"]):
                    continue
                ok.append(o)
            if not ok:
                w.r.err(f"SOFTLOCK at choice {nid} (path {' > '.join(w.path)}): none of its options can happen here")
                return
            if by == "count":
                for o in n["options"]:
                    v = w.counters.get(o.get("count"), 0.0)
                    if ("min" not in o or v >= o["min"]) and ("max" not in o or v <= o["max"]):
                        nid = o["to"]
                        break
                continue
            if by == "karma":
                for o in n["options"]:
                    axis = o.get("axis") or ("karma" if "karma" in L.karma_axes(story) else next(iter(L.karma_axes(story))))
                    v = w.karma.get(axis, 0.0)
                    if ("min" not in o or v >= o["min"]) and ("max" not in o or v <= o["max"]):
                        nid = o["to"]
                        break
                continue
            for i, o in enumerate(ok):
                b = w.fork()
                b.dev += i
                if by == "act":
                    at = b.where(o["when"])
                    if at:
                        b.go(at)
                    b.route.append({"node": nid, "do": "choose", "label": o.get("label"), "when": o.get("when")})
                else:
                    ev = scene_event(story, n) or {}
                    if ev.get("type") == "choose":             # this branch answers differently from the sweep
                        was = next((x for x in ev.get("options", []) if x.get("id") == b.results.get(n.get("of"))), {})
                        now = next((x for x in ev.get("options", []) if x.get("id") == o["result"]), {})
                        b.add_karma({k: -v for k, v in L.karma_of(was.get("karma")).items()})
                        b.add_karma(now.get("karma"))
                    b.results[n.get("of")] = o["result"]
                    b.run_actions(nid, (ev.get("on") or {}).get(o["result"], []))
                    b.route.append({"node": nid, "do": "event", "result": o["result"]})
                explore(b, o["to"], done_paths, visited_nodes)
            return


def main():
    game, argv = L.pick_game(sys.argv[1:])
    route_out = None
    if "--route" in argv:
        i = argv.index("--route")
        route_out = argv[i + 1]
        del argv[i:i + 2]
    verbose = "-v" in argv
    story_file = None                     # --story FILE: a story not saved yet (the desk's), checked as this game's
    if "--story" in argv:
        i = argv.index("--story")
        story_file = argv[i + 1]
        del argv[i:i + 2]
    global GAME_DIR, POSES, FORMAT, STORY, BOARDS
    story, path = L.load(game)
    if story_file:
        story = json.loads(Path(story_file).read_text(encoding="utf-8"))
    BOARDS = L.board_games(game)
    FORMAT, STORY = story.get("format"), story
    GAME_DIR = path.parent
    POSES = set(L.poses()["poses"])
    r = Report()
    if story.get("format") not in (2, 3):
        r.err("this check reads formats 2 and 3 (scenes, stitches, flow): see docs/STORY_FORMAT.md")
    if FORMAT >= 3:
        bw, eng = story["game"].get("built_with") or {}, L.engine_version()
        if not bw:
            r.warn(f"game.built_with is missing: {{\"engine\": \"{eng}\", \"format\": 3}} (Content/Studio/CHANGELOG.md)")
        elif str(bw.get("engine", "0")).split(".")[0] != eng.split(".")[0]:
            r.warn(f"built with engine {bw.get('engine')}, the studio is {eng}: read Content/Studio/CHANGELOG.md for what changed")
    things, errs = L.index(story)
    for e in errs:
        r.err(e)
    names = {}
    for table in ("cast", "items", "notes", "lines", "sounds", "scenes", "stitches", "flow", "secrets", "motions"):
        for k in story.get(table, {}):
            names.setdefault(k, []).append(table)
    for k in things:
        names.setdefault(k, []).append("placed")
    for st in story.get("stitches", {}).values():
        for b in st.get("beats", []):
            names.setdefault(b["id"], []).append("beat")
    for k, where in names.items():
        if len(where) > 1 and set(where) != {"secrets"}:
            r.err(f"id {k!r} is used by {', '.join(where)}: ids are unique across the file")
    for lid, lvl in story.get("levels", {}).items():
        for rm in lvl.get("rooms", []):
            if rm.get("acoustics") and rm["acoustics"] not in L.ACOUSTICS:
                r.err(f"room {rm.get('id')}: acoustics {rm['acoustics']!r} (one of {', '.join(L.ACOUSTICS)})")
    if not r.errors:
        check_world(story, things, r)
        for sid, sc in story.get("scenes", {}).items():
            check_scene(sid, sc, story, things, r)
        for tid, st in story.get("stitches", {}).items():
            check_stitch(tid, st, story, things, r)
        check_flow(story, things, r)
        check_motions(story, r)
        check_sounds(story, r)
    paths = []
    if not r.errors:
        visited = set()
        styles = STYLES if FORMAT >= 3 else ("kind",)
        for style in styles:                # format 3: the kind, the cruel and the silent player
            for seek in (False, True):      # a player who misses every secret, then one who finds them all
                w = World(story, things, r, verbose)
                w.seek_secrets, w.style = seek, style
                explore(w, story["game"]["start"], paths, visited)
        for nid in story["flow"]:
            if nid not in visited:
                (r.err if story["flow"][nid]["type"] == "ending" else r.warn)(f"flow {nid}: no path reaches it")
        fired = set().union(*(p.fired for p in paths)) if paths else set()
        for tid, st in story.get("stitches", {}).items():
            for b in st.get("beats", []):
                if b["id"] not in fired and not b.get("optional") and paths:
                    r.warn(f"{b['id']}: never fires on any path (mark it optional if that's fine)")
    target = story["game"].get("target_min", 150)
    summary = ""
    if paths and not r.errors:
        flow = story["flow"]
        main_path = min(paths, key=lambda p: (p.seek_secrets, p.dev))   # the spine: first options, nothing taken
        print(f"main path ({len(paths)} path{'s' if len(paths) > 1 else ''} in all; minutes typical / fast):")
        for nid in main_path.path:
            parts = dict(main_path.secs.get(nid, {}))
            stalk = parts.pop("_stalker", 0)
            secs = sum(parts.values()) * (1.3 if stalk else 1.0)
            n = flow[nid]
            label = n.get("ref") or n.get("kind") or n.get("by")
            detail = ", ".join(f"{k} {v / 60:.1f}" for k, v in sorted(parts.items(), key=lambda kv: -kv[1]) if v)
            print(f"  {nid:<16}{n['type']:<8}{str(label):<14}{secs / 60:>5.1f} / {main_path.fast.get(nid, 0) / 60:<4.1f} {detail}")
        by_end = {}
        fast_min = story["game"].get("fast_min", round(target * 0.8))
        for p in paths:
            mins = sum(sum(v for k, v in d.items() if k != "_stalker") * (1.3 if d.get("_stalker") else 1)
                       for d in p.secs.values()) / 60
            fmins = sum(p.fast.values()) / 60
            by_end.setdefault(p.path[-1], []).append((mins, fmins))
        print("endings (typical, fast):")
        for e, ms in by_end.items():
            lo, flo = min(m for m, _ in ms), min(f for _, f in ms)
            print(f"  {e:<16}{flow[e]['kind']:<8}{len(ms)} path(s), {lo:.1f} to {max(m for m, _ in ms):.1f} min; fastest {flo:.1f}")
            if flow[e].get("kind") == "death":
                rt = flow[e].get("retry")
                if rt and not any(rt in p.path for p in paths if p.path[-1] == e):
                    r.warn(f"{e}: retry {rt!r} isn't on the way to this death: the branch map would send the player somewhere they haven't been")
                continue
            if not flow[e].get("short_ok"):
                if lo < target:
                    r.err(f"the shortest typical path to {e} is {lo:.0f} min, under target_min {target} (an early death ending: short_ok)")
                if flo < fast_min:
                    r.err(f"a fast player reaches {e} in {flo:.0f} min, under fast_min {fast_min}: Steam refunds under 2 hours "
                          f"(longer cutscenes can't be skipped; add stitches or scenes)")
        if FORMAT >= 3:
            print("karma (each sweep's player answers every timed choice the same way):")
            for style in STYLES:
                ends = sorted({(p.path[-1], tuple(sorted((k, round(v, 1)) for k, v in p.karma.items())))
                               for p in paths if p.style == style and not p.seek_secrets})
                print(f"  {style:<8}" + "; ".join(f"{e} {dict(k) or '{}'}" for e, k in ends))
            total = sum(TIER_SECS.values())
            if total:
                share = {t: TIER_SECS.get(t, 0) / total for t in L.TIERS}
                print("animation budget: " + ", ".join(f"{t} {share[t] * 100:.0f}% (aim {L.TIER_SHARE[t] * 100:.0f}%)" for t in L.TIERS))
                if share["simple"] < 0.65:
                    r.warn(f"only {share['simple'] * 100:.0f}% of the motion is simple: aim for 80% (the face carries the acting)")
                if share["action"] > 0.10:
                    r.warn(f"{share['action'] * 100:.0f}% of the motion is action: aim for 5%")
        last = None
        for t, trick, where in main_path.scares:
            if last is not None and t - last < MINOR_GAP:
                r.warn(f"{where}: {trick} only {t - last:.0f} s after the last scare (keep {MINOR_GAP} s apart)")
            last = t
        if route_out:
            Path(route_out).parent.mkdir(parents=True, exist_ok=True)
            Path(route_out).write_text(json.dumps(main_path.route, indent=1), encoding="utf-8")
            print(f"route: {len(main_path.route)} steps -> {route_out}")
        summary = f"{len(paths)} paths, main {sum(sum(v for k, v in d.items() if k != '_stalker') for d in main_path.secs.values()) / 60:.0f} min"
    for w in r.warnings:
        print("warning:", w)
    for e in r.errors:
        print("ERROR:", e)
    if r.errors:
        print(f"STORY FAILED ({len(r.errors)} errors)")
        sys.exit(1)
    print(f"STORY ok ({story['game'].get('id', path.parent.name)}: {summary}, {len(r.warnings)} warnings)")


if __name__ == "__main__":
    main()
