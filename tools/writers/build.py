"""Build: your chart from the writers' room into the director (docs/WRITERS_ROOM.md §5). A rough, working outline of
the game in Content/Games/<Game>/: story.json (format 3, `game.draft`), the prototype it was built from, BUILD.md (the
handoff: what Claude does next to make it the game, shape by shape) and faces.md (the MiniMax post prompts to make).

    import build
    res = build.build(P, "Ticket114")        # {"ok", "game", "message", "files", "check"}
    res = build.check_build(P)               # the same into a scratch folder, through the story check (WRITERS)

The story: one level, a greybox room per place in a row (joined by doorways), each with the player's eye (`<room>_view`),
a mark for every cast member far (`<room>_<cast>`) and close (`<room>_<cast>_close`, the talks' close-ups) and a lamp;
the boxes the tasks, the secrets and the choices use stand along its walls. Or, built into a set (`set=`: a place the
user designed first in the scene builder, Content/Studio/Sets/<name>), its level: each place on one of its rooms, the
marks and the things fitted in round its own furniture and doorways (SetRooms). Each shape becomes:

- scene: a scene of its lines (the face's post prompt as each clip's `expr`);
- talk: a scene, the close-up: its lines, then the question as a hanging line with her listening face (`wait_expr`)
  and the answers (2 or 3), each with her face's answer (`then`: "…", the face's prompt and what it gives away), karma
  and a flag;
- task: a stitch with its to-do list, each to-do ticked by using its box;
- chapter: its lines as a scene, then the chapter card (a stitch: the title, the time of day, an autosave);
- choice: by the player, a choice by act (a box for each way); by karma, a karma choice; by an answer, a flag choice
  on the flags the talk's answers set;
- secret: found in its point's task (a secret beat), or after a scene in a short look round the room; then a choice
  on its flag plays what it shows and goes on where its arrow out says;
- ending: its ending scene (final) and the ending;
- note: a note on the game's board, for Claude.

The arrows are the flow's `next`s and options; every node sits on the director's board where its shape sits on the
chart (`xy`), the acts' frames are the board's acts. Achievements: each secret's and ending's own, and the feats.
"""
import copy
import json
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "Content" / "Python"))
from storykit import chartscript  # noqa: E402
from storykit import proto  # noqa: E402
from storykit import storylib as L  # noqa: E402

GAMES = ROOT / "Content" / "Games"
EXPRESSIONS = ROOT / "Content" / "Studio" / "Expressions"
GAME = re.compile(r"^[A-Z][A-Za-z0-9]{0,40}$")
W, D, H = 6.0, 5.0, 2.8             # a greybox room (metres): the real place is laid out later in the scene builder
VIEW = (3.0, 1.2)                   # the player's eye in a scene, facing north
FAR, CLOSE = 3.6, 1.85              # the cast's marks: across the room, and close (0.65 m from the eye: a talk's close-up)
BOX = {"task": "box 0.5 0.5 0.9", "secret": "box 0.4 0.4 0.6", "way": "box 0.5 0.5 1.0"}
COLORS = ["#8a63d2", "#d26a63", "#4f9bd2", "#5fb37a", "#d2a14f", "#b35f9b"]
SEAM = {"kind": "blink"}
LARGE = {"table": (1.2, 0.8, 0.75), "desk": (1.2, 0.6, 0.75), "fridge": (0.7, 0.7, 1.8), "refrigerator": (0.7, 0.7, 1.8), "wardrobe": (1.0, 0.6, 1.9),
         "closet": (1.0, 0.6, 1.9), "cupboard": (0.9, 0.5, 1.8), "cabinet": (0.9, 0.5, 1.0), "bookshelf": (0.9, 0.35, 1.8), "shelf": (0.9, 0.35, 1.6),
         "shelves": (0.9, 0.35, 1.6), "sofa": (1.8, 0.8, 0.8), "couch": (1.8, 0.8, 0.8), "bath": (1.6, 0.75, 0.6), "bathtub": (1.6, 0.75, 0.6),
         "sink": (0.6, 0.5, 0.9), "toilet": (0.4, 0.7, 0.8), "stove": (0.6, 0.6, 0.9), "oven": (0.6, 0.6, 0.9), "counter": (1.6, 0.6, 0.9),
         "piano": (1.5, 0.6, 1.2), "dresser": (1.0, 0.5, 0.9), "altar": (0.8, 0.5, 1.4), "butsudan": (0.8, 0.5, 1.4), "kotatsu": (0.9, 0.9, 0.4),
         "bench": (1.4, 0.4, 0.45), "washer": (0.6, 0.6, 0.85), "dryer": (0.6, 0.6, 0.85), "mirror": (0.6, 0.08, 1.4)}


def game_name(title):
    """A game's folder name from a title: "Ticket 114" -> Ticket114."""
    words = re.findall(r"[A-Za-z0-9]+", str(title))
    name = "".join(w[:1].upper() + w[1:] for w in words) or "Game"
    return name if name[0].isalpha() else "G" + name


def snake(text, n=4):
    return "_".join(re.findall(r"[a-z0-9]+", str(text).lower())[:n]) or "x"


def end_id(eid):
    """An ending's id in the flow: the prototype's, without a leading ending_ (e_handover, not e_ending_handover)."""
    return re.sub(r"^(ending|end)_(?=.)", "", snake(eid, 6))


def today():
    return time.strftime("%Y-%m-%d")


# ---- the greybox ----------------------------------------------------------------------------------------------------

class Rooms:
    """The level: a room per place in a row going north, and what stands in them along their walls (the story's things,
    sized as written; the stand-in boxes for tasks, finds and ways; doors in the outer walls), clear of the eye, the
    marks and the doorways."""

    def __init__(self, places, cast):
        self.order = [x["id"] for x in places]
        self.rooms = {}
        n = len(cast)
        gap_far = min(1.2, 4.8 / max(1, n - 1))
        for i, x in enumerate(places):
            rid = x["id"]
            props = [{"id": f"{rid}_view", "use": "spot", "at": list(VIEW), "rot": 90},
                     {"id": f"{rid}_lamp", "use": "light", "kind": "bulb", "lit": True, "flicker": 0.05, "at": [W / 2, D / 2], "z": H - 0.2}]
            for j, c in enumerate(cast):
                off = j - (n - 1) / 2
                props.append({"id": f"{rid}_{c['id']}", "use": "spot", "at": [round(W / 2 + off * gap_far, 2), FAR], "rot": 270})
                props.append({"id": f"{rid}_{c['id']}_close", "use": "spot", "at": [W / 2, CLOSE], "rot": 270})   # one talks at a time
            if i == 0:
                props.append({"id": "start", "use": "spot", "at": [W / 2, 0.8], "rot": 90})
            room = {"id": rid, "name": x.get("name", rid), "at": [0, i * D, 0], "size": [W, D, H], "floor": "wood", "light": "dim",
                    "props": props}
            if i:
                room["skip"] = ["s"]
            if i < len(places) - 1:
                room["openings"] = [{"wall": "n", "at": W / 2, "w": 1.2, "h": 2.2}]
            self.rooms[rid] = room
        # the free stretches of each wall (metres from its south or west end): the west and east whole, the north and
        # south either side of the middle (the doorways, the start and the eye's line) and clear of the corners, where
        # what stands on the west and east walls reaches (a bed, a metre deep)
        side = [(1.2, W / 2 - 0.9), (W / 2 + 0.9, W - 1.2)]
        self.free = {rid: {"e": [(0.25, D - 0.25)], "w": [(0.25, D - 0.25)], "n": list(side), "s": list(side)} for rid in self.order}
        self.walk_on = {}
        self.placed = set()             # the boxes' ids (owned where they're made)

    taken = frozenset()             # ids the level brings with it (a set's): never made again

    def level(self):
        links = [{"a": a, "b": b, "via": None} for a, b in zip(self.order, self.order[1:])]
        return {"start": "start", "rooms": [self.rooms[r] for r in self.order], "links": links}

    def lamp(self, rid):
        return f"{rid}_lamp"

    def room_id(self, rid):
        """The level's room a place is (walking into it is `enter` that room)."""
        return rid

    def spot(self, rid, along, walls):
        """The first stretch of wall (of `walls`, in order) with `along` metres free: (the wall, the middle along it)."""
        for wall in walls:
            spans = self.free[rid][wall]
            for k, (a, b) in enumerate(spans):
                if b - a >= along:
                    spans[k] = (a + along + 0.15, b)
                    return wall, a + along / 2
        raise ValueError(f"the greybox room {rid} has no wall left for something {along:g} m wide: too many things in one place (split it)")

    def box(self, rid, pid, along, depth, h, walls=("e", "w", "n", "s"), **fields):
        """A box against a wall, facing into the room (`rot`): `along` the wall, `depth` into the room."""
        wall, c = self.spot(rid, along, walls)
        off = depth / 2 + 0.06
        at = {"w": (off, c), "e": (W - off, c), "n": (c, D - off), "s": (c, off)}[wall]
        prop = dict({"id": pid, "shape": f"box {depth:g} {along:g} {h:g}", "at": [round(at[0], 3), round(at[1], 3)],
                     "rot": {"w": 0, "e": 180, "n": 270, "s": 90}[wall]}, **fields)
        self.rooms[rid]["props"].append(prop)
        self.placed.add(pid)
        return prop

    def place(self, rid, kind, pid, **fields):
        """A stand-in box for a task (the east wall first), a find (the west) or a way."""
        walls = {"task": ("e", "s", "n", "w"), "secret": ("w", "n", "s", "e"), "way": ("n", "e", "w", "s")}[kind]
        d, w, h = (float(x) for x in BOX[kind].split()[1:])
        return self.box(rid, pid, w, d, h, walls, tag=kind, **fields)["id"]

    def door(self, rid, did):
        """A door in the room's outer wall (west, then east), away from the corners so what stands on the north and south
        walls keeps out of the 0.8 m in front of it: an opening with its door, the wall either side of it still free."""
        for wall in ("w", "e"):
            spans = self.free[rid][wall]
            for k, (a, b) in enumerate(spans):
                lo, hi = max(a, 1.25), min(b, D - 1.25)          # the door's middle: its 0.65 either side within the span
                if hi - lo >= 0:
                    c = min(max(D / 2, lo + 0.65), hi - 0.65) if hi - lo >= 1.3 else (lo + hi) / 2
                    if c - 0.65 < a - 1e-6 or c + 0.65 > b + 1e-6:
                        continue
                    spans[k:k + 1] = [x for x in ((a, c - 0.65 - 0.15), (c + 0.65 + 0.15, b)) if x[1] - x[0] > 0.3]
                    self.rooms[rid].setdefault("openings", []).append({"wall": wall, "at": round(c, 3), "w": 0.9, "h": 2.1, "door": {"id": did}})
                    self.placed.add(did)
                    return did
        raise ValueError(f"the greybox room {rid} has no outer wall left for the door {did}: too many things in one place (split it)")

    def stand(self, rid, pid, w, d, h, **fields):
        """A small thing on a stand of its own (a little table) against a wall: (the stand, the thing)."""
        st = self.box(rid, f"{pid}_stand", 0.45, 0.45, 0.75, ("s", "n", "e", "w"), tag="stand")
        thing = dict({"id": pid, "shape": f"box {w:g} {d:g} {h:g}", "on": st["id"], "at": list(st["at"]), "rot": st["rot"]}, **fields)
        self.rooms[rid]["props"].append(thing)
        self.placed.add(pid)
        return st, thing

    def walk_on_of(self, rid):
        """The doorway's end of the room: walking into it ends a look round."""
        if rid not in self.walk_on:
            tid = f"{rid}_walk_on"
            self.rooms[rid]["props"].append({"id": tid, "use": "trigger", "size": [1.6, 0.8, 2.2], "at": [W / 2, D - 0.45]})
            self.walk_on[rid] = tid
        return self.walk_on[rid]


KEEP_USES = {"light", "switch", "spot", "sit", "sleep", "locker", "inspect"}   # a set's props that are the place's own
ROOM_WORDS = {                      # a place's words -> the room kinds they mean (storylib.ROOM_KINDS; the scene builder's)
    "genkan": "genkan entrance entry front door doorway hallway", "corridor": "corridor hall hallway passage landing",
    "ldk": "ldk living lounge sitting kitchen dining apartment flat studio home", "living": "living lounge sitting family",
    "dining": "dining", "kitchen": "kitchen kitchenette", "washitsu": "washitsu tatami japanese", "bedroom": "bedroom bed sleeping",
    "kids": "kids child children nursery", "study": "study office", "bath": "bath bathroom shower", "washroom": "washroom laundry sink",
    "toilet": "toilet wc restroom loo lavatory", "closet": "closet wardrobe", "walkin": "walk walkin dressing", "storage": "storage store attic basement cellar",
    "stairs": "stairs staircase stairwell upstairs downstairs", "balcony": "balcony veranda", "engawa": "engawa porch veranda",
    "garden": "garden yard outside", "garage": "garage"}


class SetRooms(Rooms):
    """The level of a set (a place the user designed first in the scene builder: Content/Studio/Sets/<name>, DECISIONS
    2026-10-27, later), as Rooms is for the greybox: each of the chart's places on one of its rooms (by name, then by
    kind, else the biggest one not taken; several places can share one), the marks of each place in its room (the eye a
    little in from its south wall facing north, the cast across from it and close), a lamp where it has none, and what
    the story needs (its things, the tasks' and the finds' boxes) fitted against its walls round what's there: its
    furniture, a doorway's clearance, the marks, each other. Its own doors are used where a thing is a door. What's the
    set's own stays (its furniture, lights, switches, seats, beds, hiding places); what belongs to a game (things to take,
    notes, people, keys on its doors) is left out."""

    def __init__(self, places, cast, sset, name):
        S = copy.deepcopy(sset)
        lid = name if name in S.get("levels", {}) else next(iter(S["levels"]))
        self.set_name, lvl = name, S["levels"][lid]
        for r in lvl["rooms"]:                         # the place's own, not a game's
            props = []
            for x in r.get("props", []):
                if str(x.get("shape", "")).startswith("person") or (x.get("use") and x["use"] not in KEEP_USES):
                    continue
                x.pop("line", None)
                props.append(x)
            ids = {x["id"] for x in props}
            r["props"] = [x for x in props if not isinstance(x.get("on"), str) or x["on"] in ids or x["on"] in {q["id"] for q in lvl["rooms"]}]
            for op in r.get("openings", []):
                if op.get("door"):
                    op["door"].pop("locked_by", None)
        self.lvl, self.order = lvl, [x["id"] for x in places]
        self.by_room = {r["id"]: r for r in lvl["rooms"]}
        self.map = self.match(places, lvl["rooms"])
        self.rooms = {pid: self.by_room[rid] for pid, rid in self.map.items()}
        things, errs = L.index({"levels": {lid: lvl}, "cast": {}, "items": {}, "notes": {}, "lines": {}, "sounds": {}})
        if errs:
            raise ValueError(f"the set {name}: " + "; ".join(errs[:3]))
        self.taken = frozenset(set(things) | set(self.by_room) | {lid})
        self.used_doors, self.walk_on, self.placed, self.lamps = set(), {}, set(), {}
        self.spilled = []                              # (a thing, its place, the room it went to instead): no room left in its own
        self.obs = {rid: self.obstacles(r, things, lvl) for rid, r in self.by_room.items()}
        n = len(cast)
        for pid in self.order:                         # the marks, then a lamp where the room has no light
            r = self.rooms[pid]
            w, d = r["size"][0], r["size"][1]
            vy = min(1.2, max(0.6, d * 0.22))
            close, far = vy + 0.65, min(d - 0.6, vy + 2.4)
            gap = min(1.2, max(0.0, w - 1.2) / max(1, n - 1))
            props = r.setdefault("props", [])
            marks = [{"id": f"{pid}_view", "use": "spot", "at": [round(w / 2, 2), round(vy, 2)], "rot": 90}]
            for j, c in enumerate(cast):
                marks.append({"id": f"{pid}_{c['id']}", "use": "spot", "at": [round(w / 2 + (j - (n - 1) / 2) * gap, 2), round(max(close + 0.3, far), 2)], "rot": 270})
                marks.append({"id": f"{pid}_{c['id']}_close", "use": "spot", "at": [round(w / 2, 2), round(close, 2)], "rot": 270})
            props += marks
            for m in marks:                             # room to stand on each
                self.obs[r["id"]].append((m["at"][0] - 0.3, m["at"][1] - 0.3, m["at"][0] + 0.3, m["at"][1] + 0.3))
            light = next((x["id"] for x in props if x.get("use") == "light"), None)
            if not light:
                light = f"{pid}_lamp"
                props.append({"id": light, "use": "light", "kind": "bulb", "lit": True, "flicker": 0.05, "at": [round(w / 2, 2), round(d / 2, 2)], "z": round(r["size"][2] - 0.2, 2)})
            self.lamps[pid] = light

    @staticmethod
    def match(places, rooms):
        """Each place onto a room: its own name or id, then a room of the kind its words mean, else the biggest room not
        taken yet (and once they're all taken, the biggest)."""
        words = lambda t: set(re.findall(r"[a-z]+", str(t or "").lower()))
        area = lambda r: r["size"][0] * r["size"][1]
        out, used = {}, set()
        for x in places:
            pw = words(x.get("name")) | words(x.get("id"))
            best, score = None, 0
            for r in rooms:
                rw = words(r.get("name")) | words(r.get("id"))
                sc = 4 if pw & rw and (pw <= rw or rw <= pw) else 3 if pw & rw else 2 if pw & words(ROOM_WORDS.get(r.get("kind") or "", "")) else 0
                sc -= 0.5 if r["id"] in used else 0
                if sc > score:
                    best, score = r, sc
            if not best:
                free = [r for r in rooms if r["id"] not in used and r.get("kind") not in ("stairs", "closet", "oshiire")] or rooms
                best = max(free, key=area)
            out[x["id"]] = best["id"]
            used.add(best["id"])
        return out

    @staticmethod
    def obstacles(r, things, lvl):
        """What's in the way in a room, as rectangles in its own metres: its furniture (what stands on the floor or low on
        a wall) and the clearance in front of every doorway on its walls (its own and a neighbour's on the same line)."""
        x0, y0, z0 = r["at"]
        w, d = r["size"][0], r["size"][1]
        out = []
        for t in things.values():
            if t.room != r["id"] or t.kind == "room" or t.use in ("spot", "trigger", "light") or t.kind == "door":
                continue
            if (t.pos[2] if len(t.pos) > 2 else 0) - z0 > 1.0:
                continue                                # up on the wall: things stand under it
            sw, sd = (t.size[0], t.size[1]) if len(t.size) > 1 else (0.4, 0.4)
            if abs(((t.yaw or 0) % 180) - 90) < 45:
                sw, sd = sd, sw
            cx, cy = t.pos[0] - x0, t.pos[1] - y0
            out.append((cx - sw / 2 - 0.05, cy - sd / 2 - 0.05, cx + sw / 2 + 0.05, cy + sd / 2 + 0.05))
        for o in lvl["rooms"]:
            for op in o.get("openings", []):
                if op.get("sill", 0) > 0.3 or op.get("h", 2.1) < 1.8:
                    continue
                axis, v, lo, _ = L.wall_line(o, op["wall"])
                c, hw = lo + op["at"], op["w"] / 2 + 0.1
                if axis == "y" and (abs(v - y0) < 0.06 or abs(v - (y0 + d)) < 0.06) and x0 - 0.01 <= c <= x0 + w + 0.01:
                    yy = v - y0
                    out.append((c - x0 - hw, yy - 0.9, c - x0 + hw, yy + 0.9))
                elif axis == "x" and (abs(v - x0) < 0.06 or abs(v - (x0 + w)) < 0.06) and y0 - 0.01 <= c <= y0 + d + 0.01:
                    xx = v - x0
                    out.append((xx - 0.9, c - y0 - hw, xx + 0.9, c - y0 + hw))
        return out

    def level(self):
        return self.lvl

    def lamp(self, rid):
        return self.lamps[rid]

    def room_id(self, rid):
        return self.map[rid]

    def fit(self, rid, along, depth, walls, room=None):
        """The first spot against a wall (of `walls`, in order) where `along` by `depth` stands clear of everything
        there: (the wall, the middle along it, the rectangle). `room`: that room of the set instead of the place's."""
        r = room or self.rooms[rid]
        w, d = r["size"][0], r["size"][1]
        obs = self.obs[r["id"]]
        for wall in walls:
            length = w if wall in ("n", "s") else d
            k = 0.2 + along / 2
            while k <= length - 0.2 - along / 2 + 1e-9:
                off0, off1 = 0.06, 0.06 + depth
                rect = {"w": (off0, k - along / 2, off1, k + along / 2), "e": (w - off1, k - along / 2, w - off0, k + along / 2),
                        "s": (k - along / 2, off0, k + along / 2, off1), "n": (k - along / 2, d - off1, k + along / 2, d - off0)}[wall]
                if not any(rect[0] < o[2] and o[0] < rect[2] and rect[1] < o[3] and o[1] < rect[3] for o in obs):
                    obs.append((rect[0] - 0.08, rect[1] - 0.08, rect[2] + 0.08, rect[3] + 0.08))
                    return wall, k, rect
                k += 0.05
        raise ValueError(f"the set's room {r['id']} (for {rid}) has no wall left for something {along:g} m wide: too many things in one place (split it, "
                         "or make the room bigger in the scene builder)")

    def box(self, rid, pid, along, depth, h, walls=("e", "w", "n", "s"), **fields):
        """Against a wall of the place's room; when it's full, of the next biggest room with space (kept in `spilled`)."""
        try:
            room = self.rooms[rid]
            wall, c, rect = self.fit(rid, along, depth, walls)
        except ValueError:
            for room in sorted(self.lvl["rooms"], key=lambda q: -q["size"][0] * q["size"][1]):
                if room is self.rooms[rid] or room.get("kind") == "stairs":
                    continue
                try:
                    wall, c, rect = self.fit(rid, along, depth, walls, room)
                    self.spilled.append((pid, rid, room["id"]))
                    break
                except ValueError:
                    continue
            else:
                raise
        prop = dict({"id": pid, "shape": f"box {depth:g} {along:g} {h:g}", "at": [round((rect[0] + rect[2]) / 2, 3), round((rect[1] + rect[3]) / 2, 3)],
                     "rot": {"w": 0, "e": 180, "n": 270, "s": 90}[wall]}, **fields)
        room["props"].append(prop)
        self.placed.add(pid)
        self.in_room = room
        return prop

    def stand(self, rid, pid, w, d, h, **fields):
        st = self.box(rid, f"{pid}_stand", 0.45, 0.45, 0.75, ("s", "n", "e", "w"), tag="stand")
        thing = dict({"id": pid, "shape": f"box {w:g} {d:g} {h:g}", "on": st["id"], "at": list(st["at"]), "rot": st["rot"]}, **fields)
        self.in_room["props"].append(thing)            # on its stand, wherever that went
        self.placed.add(pid)
        return st, thing

    def door(self, rid, did):
        """A door the story uses: one of the room's own doors not used yet (one onto the outside first), else a new one
        in a stretch of its wall that's free."""
        r = self.rooms[rid]
        doors = [op["door"]["id"] for op in r.get("openings", []) if op.get("door") and op["door"].get("id") and op["door"]["id"] not in self.used_doors]
        if doors:
            self.used_doors.add(doors[0])
            return doors[0]
        wall, c, rect = self.fit(rid, 1.3, 0.9, ("w", "e", "s", "n"))
        r.setdefault("openings", []).append({"wall": wall, "at": round(c, 3), "w": 0.9, "h": 2.1, "door": {"id": did}})
        self.placed.add(did)
        self.used_doors.add(did)
        return did

    def walk_on_of(self, rid):
        """In front of the room's first doorway (walking into it ends a look round), else its middle."""
        if rid not in self.walk_on:
            r = self.rooms[rid]
            w, d = r["size"][0], r["size"][1]
            op = next((o for o in r.get("openings", []) if o.get("sill", 0) <= 0.3 and not o.get("window")), None)
            at = [w / 2, d / 2]
            if op:
                at = {"n": [op["at"], d - 0.45], "s": [op["at"], 0.45], "e": [w - 0.45, op["at"]], "w": [0.45, op["at"]]}[op["wall"]]
            tid = f"{rid}_walk_on"
            r["props"].append({"id": tid, "use": "trigger", "size": [1.4, 0.8, 2.2], "at": [round(at[0], 3), round(at[1], 3)]})
            self.walk_on[rid] = tid
        return self.walk_on[rid]

    def mapping(self):
        """The places and the rooms they're on, for BUILD.md."""
        return [(pid, self.map[pid], self.by_room[self.map[pid]].get("name") or self.map[pid]) for pid in self.order]

    def spills(self):
        return [f"`{t}` (in {pid}) is in `{rid}`: no room left in its own" for t, pid, rid in self.spilled if not t.endswith("_stand")]


# ---- the story ------------------------------------------------------------------------------------------------------

class Builder:
    def __init__(self, P, game, sset=None, set_name=None):
        self.P, self.game = P, game
        self.N = proto.nodes_of(P)
        self.cast = {c["id"]: c for c in P.get("cast", [])}
        self.places = P.get("places") or [{"id": "room", "name": "A room"}]
        self.lib = proto.library()
        self.rooms = SetRooms(self.places, P.get("cast", []), sset, set_name) if sset else Rooms(self.places, P.get("cast", []))
        self.ids = set(self.rooms.taken)         # a set's ids are its own
        self.S = {"format": 3, "game": {}, "cast": {}, "items": {}, "notes": {}, "lines": {}, "sounds": {}, "levels": {},
                  "secrets": {}, "achievements": {}, "motions": {}, "stitches": {}, "scenes": {}, "flow": {}, "interrupts": [],
                  "board": [], "frames": []}
        self.entry = {}                 # a shape -> the flow node it begins at
        self.exits = {}                 # a shape -> [(holder, key)]: where what comes after it is written
        self.made = {}                  # a shape -> every flow node made for it (its acts, its place on the board)
        self.options = {}               # an arrow out of a choice -> its option (whose `to` is written when wired)
        self.found_in = {}              # a task -> its stitch (its secrets are found in it)
        self.handoff = []               # BUILD.md: (shape, what was built, the boxes to tick)
        self.secret_key, self.secret_flag = {}, {}
        self.answer_flags = {}          # (talk, answer) -> the flag a choice by an answer reads
        self.moved = []                 # karma bounds moved into the answers' reach
        self.todo_ids = set()           # the to-dos' ids (one list for the whole run)
        self.thing, self.thing_named, self.texts = {}, {}, {}
        self.pend = []                  # a talk's cues waiting for its hanging line

    # ids: everything this build makes is unique across the file
    def own(self, i):
        if i in self.ids:
            raise ValueError(f"the build made the id {i!r} twice: rename a shape on the chart")
        self.ids.add(i)
        return i

    def room_of(self, n):
        """A shape's room: its own place, else the nearest one's on the way to it, else the first place."""
        seen, todo = set(), [n.get("id")]
        while todo:
            k = todo.pop(0)
            if k in seen:
                continue
            seen.add(k)
            w = (self.N.get(k) or {}).get("where")
            if w in self.rooms.rooms:
                return w
            todo += [e.get("from") for e in proto.ins(self.P, k)]
        return self.rooms.order[0]

    def face(self, fid, who):
        f = proto.face_of(self.P, fid, self.lib) if fid else None
        return proto.for_subject(f["prompt"], (self.cast.get(who) or {}).get("subject", "she")) if f and f.get("prompt") else None

    def note(self, text):
        return [{"by": "claude", "text": text, "at": today()}]

    def node(self, shape, nid, n, k=0):
        """A flow node made for a shape: kept, placed on the board under the shape (k: the how-many-th of its nodes)."""
        sh = self.N.get(shape) or {}
        n["xy"] = [round(float(sh.get("x", 0))), round(float(sh.get("y", 0)) + 70 * k)]
        self.S["flow"][self.own(nid)] = n
        self.made.setdefault(shape, []).append(nid)
        return n

    def scene(self, sid, title, room, who, clips, mood, notes, close=None, final=False):
        """A scene in a room: the cast on their marks (`close`: the one face to face, on the close mark), the camera
        soft on the first of them (on the close one in a talk)."""
        stage = {c: f"{room}_{c}{'_close' if c == close else ''}" for c in ([close] if close else []) + list(who) if c in self.cast}
        sc = {"title": title, "level": "main", "view": f"{room}_view", "mood": mood, "stage": stage,
              "camera": {"mode": "soft", "look": next(iter(stage)), "cone": [30, 18]} if stage else {"mode": "free"},
              "clips": clips, "notes": notes}
        if final:
            sc["final"] = True
        self.S["scenes"][self.own(sid)] = sc
        return sc

    def stitch(self, tid, st):
        st = dict({"level": "main"}, **st)
        self.S["stitches"][self.own(tid)] = st
        for b in st.get("beats", []):
            self.own(b["id"])
        return st

    def who_of(self, n):
        return [c for c in (n.get("who") or []) if c in self.cast]

    def about(self, n):
        bits = [f"what happens: {n['text']}"] if n.get("text") else []
        for k, label in (("player", "the player"), ("shot", "the shot"), ("notes", "a note from the chart")):
            if n.get(k):
                bits.append(f"{label}: {n[k]}")
        return "; ".join(bits) or "as written on the chart"

    def feat_flag(self, fid):
        f = next((a for a in self.P.get("feats", []) if a.get("id") == fid), None) or {}
        return f"feat_{snake(f.get('title') or fid, 4)}"

    def sound(self, st):
        """A sound off the shelf (the nearest to its words), in the sounds table once."""
        name = st.get("sfx") or chartscript.sound_for(st.get("text", ""))
        if not name or name not in chartscript.shelf():
            return None
        sid = f"snd_{snake(name, 6)}"
        if sid not in self.S["sounds"]:
            self.S["sounds"][self.own(sid)] = {"file": f"sfx/{name}"}
        return {"sound": sid}

    # ---- the story's things: each a block of its size where it's first used, with its use --------------------------
    def prepass(self):
        """What you see when you use a thing: the plain lines written right after looking at it, reading it or using it
        (they're its text, not lines of their own)."""
        self.texts = {}
        for n in self.N.values():
            steps = n.get("steps") or []
            for j, st in enumerate(steps):
                if st.get("do") == "act" and st.get("item") and st.get("verb") in ("look", "read", "use", "open", "take"):
                    k, txt = j + 1, []
                    while k < len(steps) and steps[k].get("do") == "see" and not steps[k].get("who"):
                        txt.append(steps[k]["text"])
                        steps[k]["_used"] = True
                        k += 1
                    if txt and st["item"] not in self.texts:
                        self.texts[st["item"]] = " ".join(txt)

    def things(self):
        """The chart's things (its `items`): a door in its room's outer wall, a bed, a seat, a closet to hide in, a light
        switch, a note to read and a small thing to take each on a stand of its own, a medium thing to carry, the rest
        to look at or use, sized small, medium or large; blocks for now (the Database puts the real ones in)."""
        self.thing, self.thing_named = {}, {}
        for it in sorted(self.P.get("items") or [], key=lambda x: x.get("kind") != "door"):     # the doors first, mid-wall
            tid, kind, size = it["id"], it.get("kind", "inspect"), it.get("size", "medium")
            rid = it.get("where") if it.get("where") in self.rooms.rooms else self.rooms.order[0]
            name = str(it.get("name") or tid)
            text = self.texts.get(tid) or f"The {name}."
            iid, k = tid, 2
            while tid in self.ids:                     # a set's own id: the thing takes another
                tid, k = f"{iid}_{k}", k + 1
            t = {"kind": kind, "room": rid, "prop": tid, "name": name}
            self.own(tid)
            if kind == "door":
                t["prop"] = self.rooms.door(rid, tid)    # a set's own door, where the room has one
            elif kind == "bed":
                self.rooms.box(rid, tid, 2.0, 1.0, 0.55, ("w", "e", "n", "s"), use="sleep", tag="bed")
            elif kind == "seat":
                along, depth, h = (1.8, 0.8, 0.8) if size == "large" else (0.5, 0.5, 0.9)
                self.rooms.box(rid, tid, along, depth, h, use="sit", tag=name)
            elif kind == "hideout":
                self.rooms.box(rid, tid, 1.0, 0.6, 1.9, ("w", "e", "n", "s"), use="locker", tag=name)
            elif kind == "switch":
                self.rooms.box(rid, tid, 0.12, 0.04, 0.12, ("s", "e", "w", "n"), use="switch", light=self.rooms.lamp(rid), z=1.2, tag="light_switch")
            elif kind == "note":
                t["note"] = nid = self.own(f"{tid}_note")
                self.S["notes"][nid] = {"title": name[:1].upper() + name[1:], "text": self.texts.get(tid) or "…"}
                self.own(f"{tid}_stand")
                self.rooms.stand(rid, tid, 0.22, 0.16, 0.02, use="note", note=nid, tag=name)
            elif kind == "pickup":                     # (its item a story id of its own: the thing stays keyed by the chart's, as steps name it)
                t["item"] = item = self.own(f"{tid}_item")
                self.S["items"][item] = {"name": name, "shape": "box 0.12 0.12 0.08", "inspect": text}
                if name.lower() in chartscript.TORCHES or name.lower().split()[-1:] and name.lower().split()[-1] in chartscript.TORCHES:
                    self.S["items"][item]["torch"] = True        # a flashlight: F lights the way once it's had
                self.own(f"{tid}_stand")
                self.rooms.stand(rid, tid, 0.12, 0.12, 0.08, use="pickup", item=item, tag=name)
            elif kind == "carry":
                self.rooms.box(rid, tid, 0.4, 0.35, 0.35, use="carry", tag=name)
            elif kind == "stain":                      # a mess on the floor by a wall, scrubbed away by holding the click
                low = name.lower()
                stain = next((k for k, ws in (("blood", "blood"), ("mud", "mud muck footprints"), ("water", "water puddle spill"), ("ash", "ash"))
                              if any(w in low.split() for w in ws.split())), "dirt")
                self.rooms.box(rid, tid, 0.8, 0.6, 0.01, ("s", "n", "e", "w"), use="clean", stain=stain, tag=name)
            elif kind == "breaker":                    # the fuse box on a wall at chest height
                self.rooms.box(rid, tid, 0.3, 0.12, 0.4, ("s", "e", "w", "n"), use="breaker", z=1.3, tag="breaker")
            elif kind == "peephole":                   # the room's door (one onto the outside first) gets one
                did = self.rooms.door(rid, self.own(f"{tid}_door"))
                for op in self.rooms.rooms[rid].get("openings", []):
                    if (op.get("door") or {}).get("id") == did:
                        op["door"]["peephole"] = True
                t["prop"], t["door"] = did, did
            elif size == "small":
                self.own(f"{tid}_stand")
                self.rooms.stand(rid, tid, 0.2, 0.2, 0.15, use="inspect", text=text, tag=name)
            elif size == "medium":
                self.rooms.box(rid, tid, 0.5, 0.5, 0.6, use="inspect", text=text, tag=name)
            else:
                along, depth, h = LARGE.get(name.split()[-1] if name.split() else name, (1.0, 0.6, 1.2))
                self.rooms.box(rid, tid, along, depth, h, use="inspect", text=text, tag=name)
            self.thing[iid] = t
            self.thing_named[name.lower()] = iid

    def trigger(self, st):
        """What the game hears when the player does a step's thing: the thing's own trigger for the verb."""
        if st.get("verb") == "go" and st.get("place") in self.rooms.rooms:
            return {"enter": self.rooms.room_id(st["place"])}
        t = self.thing.get(st.get("item"))
        if not t:
            return None
        k = t["kind"]
        if k == "hideout":
            return {"hidden": t["prop"]}
        if k == "note":
            return {"read": t["note"]}
        if k == "pickup":
            if st.get("verb") in ("on", "off") and self.S["items"].get(t["item"], {}).get("torch"):
                return {"torch": st["verb"]}                       # "turn on the flashlight": F
            return {"pickup": t["item"]}
        if k == "peephole":
            return {"peeping": t["door"]}
        if k == "door" and (st.get("said") or "").split()[:1] == ["lock"]:   # "lock the front door": its latch, turned from inside
            for r in self.rooms.rooms.values():
                for op in r.get("openings", []):
                    if (op.get("door") or {}).get("id") == t["prop"]:
                        op["door"]["latch"] = True
            return {"locked": t["prop"]}
        if k == "carry":
            return {"dropped": t["prop"]} if st.get("verb") == "put" else {"carrying": t["prop"]}
        return {"use": t["prop"]}

    def stand_in(self, n, room, j, text):
        """Something to do with no thing of its own (wash your face, clean up): a box on the wall to use, by its words."""
        box = self.rooms.place(room, "task", self.own(f"{n['id']}_{j + 1}_{snake(text, 3)}"), use="inspect", text=text[:1].upper() + text[1:] + ".")
        return {"use": box}

    # ---- a shape's steps: what you play (a stitch) and what you watch (a scene) ----------------------------------
    @staticmethod
    def parts(steps):
        """Steps cut where the game stops for you (a thing to do, a to-do, your name, a save): runs to play and runs
        to watch, in order."""
        out = []
        for st in steps:
            what = "play" if st.get("do") in ("act", "todo", "name", "save") else "scene"
            if out and out[-1][0] == what:
                out[-1][1].append(st)
            else:
                out.append((what, [st]))
        return out

    def play(self, n, steps, room, tid, title):
        """Steps to play: one stitch, a new beat after each thing the game waits for (a thing you do, by its own
        trigger; a list of to-dos, through; a pause, after it); its people stand on their marks meanwhile."""
        pid, who = n["id"], self.who_of(n)
        beats, notes_, todos = [], [], []
        cur = {"id": f"b_{tid[2:]}_1", "when": {"start": True}, "do": [{"behave": c, "as": "idle", "at": f"{room}_{c}", "face": "player"} for c in who]}

        def close(when):
            nonlocal cur
            if not cur["do"]:
                cur["do"].append({"wait": 0.1})
            beats.append(cur)
            cur = {"id": f"b_{tid[2:]}_{len(beats) + 1}", "when": when, "do": []}
        for j, st in enumerate(steps):
            d = st.get("do")
            if d != "todo" and todos:                 # what's written after a list of to-dos waits for the list
                close({"ticked": True})
                todos = []
            if d == "think":
                cur["do"].append({"think": st["text"]})
            elif d in ("say", "you"):
                lid = self.own(f"l_{tid[2:]}_{j + 1}")
                ln = {"who": st.get("who") if d == "say" and st.get("who") in self.cast else "player", "en": st["text"]}
                ex = self.face(st.get("face"), ln["who"])
                if ex:
                    ln["expr"] = ex
                self.S["lines"][lid] = ln
                cur["do"].append({"say": lid})
            elif d in ("see", "cast"):
                if not st.get("_used"):
                    notes_.append(st["text"])
            elif d == "sound":
                a = self.sound(st)
                if a:
                    cur["do"].append(a)
                else:
                    notes_.append(f"a sound: {st.get('text', '')} (nothing like it on the shelf yet)")
            elif d == "light":
                cur["do"].append({"light": self.rooms.lamp(room), "set": st["set"]})
            elif d == "power":
                cur["do"].append({"power": st["set"]})
            elif d == "music":
                cur["do"].append({"music": st["mood"]})
            elif d == "fade":
                cur["do"] += [{"fade": "out", "secs": 1}, {"wait": 1}, {"fade": "in", "secs": 1}]
            elif d == "name":
                cur["do"].append({"name": "What's your name?"})
            elif d == "save":
                cur["do"].append({"checkpoint": True})
            elif d == "feat":
                cur["do"].append({"flag": self.feat_flag(st.get("feat"))})
            elif d == "wait":
                close({"after": cur["id"], "secs": float(st.get("secs") or 3)})
            elif d == "todo":
                kid = snake(st.get("text"), 3)
                k, base = 2, f"{pid}_{kid}"
                tdid = base
                while tdid in self.todo_ids:
                    tdid, k = f"{base}_{k}", k + 1
                self.todo_ids.add(tdid)
                td = {"todo": tdid, "text": st["text"], "ticks": self.trigger(st) or self.stand_in(n, room, j, st.get("done") or st["text"])}
                for f in ("secs", "hidden"):
                    if st.get(f):
                        td[f] = st[f]
                if st.get("who") in self.cast:
                    td["who"] = st["who"]
                if st.get("fails"):
                    notes_.append(f"“{st['text']}” fails: {st['fails']}")
                cur["do"].append(td)
                todos.append(tdid)
            elif d == "act":
                text = str(st.get("text") or f"{st.get('verb', 'use')} the {self.thing.get(st.get('item'), {}).get('name', 'thing')}")
                when = self.trigger(st) or self.stand_in(n, room, j, text)
                cur["do"].append({"objective": text[:1].upper() + text[1:]})
                close(when)
        if todos:
            close({"ticked": True})
        cur["do"] += [{"untodo": True}] + [{"behave": c, "as": "off"} for c in who] + [{"objective": ""}, {"done": True}]
        beats.append(cur)
        mins = max(0.3, chartscript.minutes_of_steps([x for x in steps if x.get("do") in chartscript.STEP_SECS or x.get("do") == "wait"], "task"))
        return self.stitch(tid, {"title": title, "goal": next((str(x.get("text")) for x in steps if x.get("do") in ("act", "todo")), title),
                                 "target_min": mins, "template": "notes", "beats": beats,
                                 "notes": self.note(self.about(n) + ("; as written: " + " / ".join(notes_) if notes_ else ""))})

    def clips(self, n, steps, room, fill=True):
        """Steps to watch: (clips, cues, sets). A line said, a thought, you aloud are clips; what happens is the acting
        note of the clip it goes with (someone else's, or before a thought, a silent clip of its own); sounds, lights
        and the music are cues on the clips' edges; a pause is a silent clip of its length; a fade a dip into the next."""
        clips, cues, sets, acts, pend = [], [], [], [], []
        seam = [None]

        def add(c):
            c["id"] = f"c{len(clips) + 1}"
            if clips:
                c["seam"] = seam[0] or dict(SEAM)
            seam[0] = None
            clips.append(c)
            cues.extend({"at": {"clip": c["id"], "edge": "start"}, "do": a} for a in pend)
            pend.clear()

        def silent(w, t):
            return {"who": w, "en": "…", "act": t} if w in self.cast else {"who": "player", "think": True, "en": "…", "act": t}

        def flush(for_who=None):
            mine = [t for w, t in acts if for_who and w in (None, for_who)]
            for w, t in [(w, t) for w, t in acts if not (for_who and w in (None, for_who))]:
                add(silent(w, t))
            acts.clear()
            return "; ".join(mine)
        for st in steps:
            d = st.get("do")
            if d in ("see", "cast"):
                if not st.get("_used"):
                    acts.append((st.get("who") if st.get("who") in self.cast else None, st["text"]))
            elif d == "say" and st.get("who") in self.cast:
                act = flush(st["who"])
                c = {"who": st["who"], "en": st["text"]}
                if act:
                    c["act"] = act
                ex = self.face(st.get("face"), st["who"])
                if ex:
                    c["expr"] = ex
                add(c)
            elif d in ("you", "think", "say"):
                flush()
                c = {"who": "player", "en": st["text"]}
                if d == "think":
                    c["think"] = True
                add(c)
            elif d == "sound":
                a = self.sound(st)
                if a:
                    pend.append(a)
            elif d == "light":
                pend.append({"light": self.rooms.lamp(room), "set": st["set"]})
            elif d == "power":
                pend.append({"power": st["set"]})
            elif d == "music":
                pend.append({"music": st["mood"]})
            elif d == "fade":
                seam[0] = {"kind": "dip"}
            elif d == "wait":
                flush()
                add({"who": "player", "think": True, "en": "…", "dur": float(st.get("secs") or 3)})
            elif d == "feat":
                sets.append({"flag": self.feat_flag(st.get("feat"))})
        flush()
        if not clips and fill:                   # nothing written yet: a silent moment carrying the gist
            add(silent((self.who_of(n) or [None])[0], n.get("text") or n.get("shows") or "…"))
        if clips:
            cues.extend({"at": {"clip": clips[-1]["id"], "edge": "end"}, "do": a} for a in pend)
        else:
            self.pend = list(pend)               # no clip yet (a talk's own): its cues go on the hanging line
        return clips, cues, sets

    # ---- a shape and the nodes it becomes ------------------------------------------------------------------------
    def steps_of(self, n):
        steps = list(n.get("steps") or [])
        if n.get("type") == "task" and not steps:
            steps = [{"do": "todo", "text": str(n.get("player") or n.get("title") or "Look round")}]
        return steps

    def point(self, n):
        """A scene, talk, task or chapter: its steps cut into what you play and what you watch, each a node, in order;
        a talk's answers on its last scene, her question the hanging line; a chapter's card after the rest."""
        pid, room, kind = n["id"], self.room_of(n), n.get("type")
        title = n.get("title") or pid
        built, todo = [], []
        self.handoff.append((n, built, todo))
        t = n.get("talk") if kind == "talk" else None
        talking = bool(t and t.get("options"))
        steps = self.steps_of(n)
        parts = [("play", steps)] if kind == "task" else self.parts(steps)
        if kind not in ("task", "chapter") and (talking and (not parts or parts[-1][0] != "scene") or not parts):
            parts.append(("scene", []))          # (a chapter with nothing before its card is the card alone)
        first = not [e for e in proto.ins(self.P, pid) if (self.N.get(e.get("from")) or {}).get("type") != "start"]
        nodes = []
        for k, (what, sts) in enumerate(parts):
            sfx = "" if k == 0 else f"_{k + 1}"
            if what == "play":
                tid = f"t_{pid}{sfx}"
                st = self.play(n, sts, room, tid, title)
                nd = self.node(pid, f"n_{pid}{sfx}", {"type": "stitch", "ref": tid, "next": None}, k)
                acts = [x for x in sts if x.get("do") == "act"]
                tds = [x for x in sts if x.get("do") == "todo"]
                built.append(f"stitch `{tid}`: {len(st['beats'])} beat(s)" + (f", {len(acts)} thing(s) to do" if acts else "") + (f", {len(tds)} to-do(s)" if tds else ""))
            else:
                sid = f"s_{pid}{sfx}"
                hangs = talking and k == len(parts) - 1
                clips, cues, sets = self.clips(n, sts, room, fill=not hangs)
                talker = None
                if hangs:
                    clips.append(self.hanging(n, t, len(clips)))
                    cues += [{"at": {"clip": clips[-1]["id"], "edge": "start"}, "do": a} for a in self.pend]
                    self.pend = []
                    talker = clips[-1]["who"] if clips[-1]["who"] in self.cast else None
                    if len(clips) > 1:
                        clips[-1]["seam"] = dict(SEAM)
                    for c in clips:                  # a close-up: her face 0.65 m from the eye, head and shoulders
                        if talker and c["who"] == talker:
                            c["shot"] = "mcu"
                who = [w for w in dict.fromkeys([talker] + [c["who"] for c in clips]) if w in self.cast]
                mood = "intimate" if talker else "calm" if kind == "chapter" or first else "dread"
                sc = self.scene(sid, title, room, who, clips, mood, self.note(self.about(n) + (f"; what reading her face tells you: {t['reveals']}" if t and t.get("reveals") else "")), close=talker)
                if cues:
                    sc["cues"] = cues
                if sets:
                    sc["sets"] = sets
                nd = self.node(pid, f"n_{pid}{sfx}", {"type": "scene", "ref": sid, "next": None}, k)
                said = sum(1 for c in clips if c.get("en") not in ("…", None))
                built.append(f"scene `{sid}`: {len(clips)} clip(s)" + (f", {said} with words" if said != len(clips) else "")
                             + (f", the close-up's hanging line ({len(t['options'])} answers)" if talker or (talking and k == len(parts) - 1) else ""))
            if nodes:
                nodes[-1]["next"] = f"n_{pid}{sfx}"
            nodes.append(nd)
        self.entry[pid] = f"n_{pid}"
        last = nodes[-1] if nodes else None
        if last and last.get("type") == "stitch" and kind != "chapter":   # it ends in play: what's found after it is found in it
            self.found_in[pid] = self.S["stitches"][last["ref"]]
        if kind == "chapter":
            ch = n.get("chapter") or {}
            tid = f"t_{pid}_card"
            card = {"chapter": ch.get("title") or title}
            if ch.get("sub"):
                card["sub"] = ch["sub"]
            if ch.get("time") in proto.TIMES:
                card["time"] = ch["time"]
            self.stitch(tid, {"title": title, "template": "chapter", "target_min": 0.2, "beats": [
                {"id": f"b_{pid}_card", "when": {"start": True}, "do": [card, {"done": True}]}], "notes": self.note(self.about(n))})
            nd = self.node(pid, f"n_{pid}_card" if nodes else f"n_{pid}", {"type": "stitch", "ref": tid, "next": None}, len(nodes))
            if last:
                last["next"] = f"n_{pid}_card"
            last = nd
            built.append(f"the chapter card `{tid}`: “{card['chapter']}{' · ' + card['sub'] if card.get('sub') else ''}”"
                         + (f", {card['time']} from here on" if card.get("time") else ""))
        if any(x.get("do") in ("say", "think", "you") for x in steps) or talking:
            todo.append("Write the lines in full where they're only the gist: one sentence a line, the pauses as their own beats, a seam on every cut")
        if any(x.get("do") in ("act", "todo") for x in steps):
            todo.append("Make each thing the real thing where it belongs (its block is a stand-in): the Database, then the scene builder")
        if talking:
            her = "his" if (self.cast.get(((t.get("line") or {}).get("who"))) or {}).get("subject") == "he" else "her"
            todo += [f"Stage the close-up as the shot says: the mark `{room}_{(t.get('line') or {}).get('who')}_close`, the player's eye across a table, beside on a sofa or face to face in a doorway",
                     f"Write {her} words after each answer that has none yet (“…”: {her} face answers first)", f"Make {her} faces (faces.md): the listening face and one for each answer"]
        self.exits[pid] = [(last, "next")]

    def hanging(self, n, t, i):
        """A talk's question as a hanging line: she asks, waits with her listening face, and her face answers yours
        (`then`: her words when written, else “…”); each answer the act, the thought with it (`think`), karma, a flag."""
        ln = t.get("line") or {}
        who = ln.get("who") if ln.get("who") in self.cast or ln.get("who") == "player" else (self.who_of(n) or list(self.cast) or ["player"])[0]
        c = {"id": f"c{i + 1}", "who": who, "en": str(ln.get("text") or "…").strip() or "…"}
        ex = self.face(ln.get("face"), who)
        if ex:
            c["expr"] = ex
        listen = self.face(t.get("listen"), who)
        if listen:
            c["wait_expr"] = listen
        opts = []
        for o in (t.get("options") or [])[:3]:
            sets = []
            if o.get("karma"):
                sets.append({"karma": o["karma"]})
            flag = self.answer_flags.get((n["id"], o.get("id")))
            if not flag and isinstance(o.get("sets"), str) and proto.ID.match(o.get("sets") or ""):
                flag = o["sets"]
            if flag:
                sets.append({"flag": flag})
            opt = {"id": snake(o.get("id") or f"o{len(opts) + 1}", 2), "label": str(o.get("say") or "…")}
            if str(o.get("think") or "").strip():
                opt["think"] = str(o["think"]).strip()
            if who in self.cast or o.get("then"):
                then = {"en": str(o.get("then") or "…").strip() or "…"}
                if o.get("tell"):
                    then["act"] = o["tell"]
                fx = self.face(o.get("face"), who)
                if fx:
                    then["expr"] = fx
                opt["then"] = then
            if sets:
                opt["sets"] = sets
            opts.append(opt)
        c["reply"] = {"wait": 15, "timeout": None, "options": opts}
        return c

    def choice(self, n):
        """A choice: by the player (a box for each way: using it takes that way), by karma, or by an answer."""
        cid, by, room = n["id"], n.get("by", "player"), self.room_of(n)
        built, todo = [], []
        self.handoff.append((n, built, todo))
        es = proto.outs(self.P, cid)
        if by == "player":
            c = self.node(cid, f"n_{cid}", {"type": "choice", "by": "act", "prompt": str(n.get("question") or n.get("title") or ""), "options": []})
            for e in es:
                act = chartscript.parse_act(str(e.get("label") or ""))
                tid = self.thing_named.get((act or {}).get("thing") or "")
                when = self.trigger({"verb": act["verb"], "item": tid}) if act and tid else None
                if not when:
                    box = self.rooms.place(room, "way", self.own(f"{cid}_{snake(e.get('id'), 2)}"), use="inspect", text=str(e.get("label") or e.get("to")))
                    when = {"use": box}
                o = {"label": str(e.get("label") or (self.N.get(e.get("to")) or {}).get("title") or e.get("to")), "when": when, "to": None}
                c["options"].append(o)
                self.options[e["id"]] = o
            built.append(f"a choice by act `n_{cid}`: {len(es)} ways (each by doing its thing in `{room}`, or using a box that stands in)")
            todo.append("Make the ways real things to do in the room (hide in the closet, answer the phone...): the blocks stand in for them")
        elif by == "karma":
            bounded = [e for e in es if (e.get("when") or {}).get("min") is not None or (e.get("when") or {}).get("max") is not None]
            rest = [e for e in es if e not in bounded][:1]
            c = self.node(cid, f"n_{cid}", {"type": "choice", "by": "karma", "options": []})
            hi, lo = proto.karma_range(self.P)
            for e in bounded + rest:
                w, o = dict(e.get("when") or {}), {"to": None}
                if e not in rest:
                    if w.get("min") is not None and hi >= 1 and not 1 <= w["min"] <= hi:
                        to = min(max(1, w["min"]), hi)
                        self.moved.append(f"{cid} → {e.get('to')}: karma at least {w['min']:g} → {to:g} (the kindest answers add up to {hi:g})")
                        w["min"] = to
                    if w.get("max") is not None and lo <= -1 and not lo <= w["max"] <= -1:
                        to = max(min(-1, w["max"]), lo)
                        self.moved.append(f"{cid} → {e.get('to')}: karma at most {w['max']:g} → {to:g} (the cruellest add up to {lo:g})")
                        w["max"] = to
                    o.update({b_: w[b_] for b_ in ("min", "max") if w.get(b_) is not None})
                c["options"].append(o)
                self.options[e["id"]] = o
            built.append(f"a choice by karma `n_{cid}`: " + ", ".join(proto.when_text(n, e) + f" → {e.get('to')}" for e in bounded + rest))
        else:
            named = [e for e in es if (e.get("when") or {}).get("talk")]
            rest = [e for e in es if e not in named][:1]
            c = self.node(cid, f"n_{cid}", {"type": "choice", "by": "flag", "options": []})
            for e in named + rest:
                w, o = e.get("when") or {}, {"to": None}
                if e in named:
                    o["if"] = [self.answer_flags[(w["talk"], w.get("answer"))]]
                c["options"].append(o)
                self.options[e["id"]] = o
            built.append(f"a choice by the answers `n_{cid}`: " + ", ".join(proto.when_text(n, e) + f" → {e.get('to')}" for e in named + rest))
        self.entry[cid] = f"n_{cid}"

    def ending(self, n):
        eid = end_id(n["id"])
        built, todo = [], []
        self.handoff.append((n, built, todo))
        room = self.room_of(n)
        last = next((self.N.get(e.get("from")) for e in proto.ins(self.P, n["id"])), None) or {}
        while last.get("type") == "choice":            # who's there at the end: the cast of the moment before it
            last = next((self.N.get(e.get("from")) for e in proto.ins(self.P, last["id"])), None) or {}
        steps = [x for x in self.steps_of(n) if x.get("do") not in ("act", "todo", "name", "save")]   # an ending is watched
        if steps:
            clips, cues, sets = self.clips(n, steps, room)
            who = [w for w in dict.fromkeys(c["who"] for c in clips) if w in self.cast]
        else:
            who = self.who_of(last)[:2]
            clips, cues, sets = [{"id": "c1", "who": who[0] if who else "player", "en": "…", "act": str(n.get("text") or "")}], [], []
        sid = f"s_end_{eid}"
        sc = self.scene(sid, n.get("title") or eid, room, who, clips,
                        "aftermath", self.note(f"the ending ({n.get('kind', 'other')}): {n.get('text', '')} How the player gets here: {n.get('how', '')}"), final=True)
        if cues:
            sc["cues"] = cues
        if sets:
            sc["sets"] = sets
        self.node(n["id"], f"n_end_{eid}", {"type": "scene", "ref": sid, "next": f"e_{eid}", "final": True})
        froms = [(self.N.get(e.get("from")) or {}, e) for e in proto.ins(self.P, n["id"])]
        kind = "good" if n.get("kind") == "intended" else \
            "bad" if any(a.get("by") == "karma" and (e.get("when") or {}).get("max") is not None for a, e in froms) else \
            "other" if any(a.get("by") == "answer" and (e.get("when") or {}).get("talk") for a, e in froms) else "neutral"
        self.node(n["id"], f"e_{eid}", {"type": "ending", "kind": kind, "title": n.get("title") or eid}, 1)
        self.entry[n["id"]] = f"n_end_{eid}"
        built.append(f"`{sid}` (final), then the ending `e_{eid}` ({kind})")
        todo += ["Write the ending cutscene in full where it's only the gist (no ending cards: DECISIONS 2026-10-27)",
                 "Play the way there on the desk (the Watch, and the karma it shows at the end) and see it plays as the chart says"]

    # ---- the arrows: next, options, the secrets on the way ------------------------------------------------------
    def wire(self):
        for k, n in self.N.items():
            t = n.get("type")
            if t == "choice":
                for e in proto.outs(self.P, k):
                    o = self.options.get(e.get("id"))
                    if o is not None:
                        o["to"] = self.entry.get(e.get("to"))
                    if e.get("sets") and proto.ID.match(str(e["sets"])):
                        self.way_flag(e)
                continue
            if t not in ("start",) + proto.POINTS:
                continue
            main = proto.main_out(self.P, k, self.N)
            after = self.entry.get(main[0].get("to")) if main else None
            secrets = [self.N[e["to"]] for e in proto.outs(self.P, k) if (self.N.get(e.get("to")) or {}).get("type") == "secret"]
            ends = self.exits.get(k, [])
            if secrets:
                ends = self.secrets_after(n, secrets, ends, after)
            for holder, key in ends:
                holder[key] = after

    def way_flag(self, e):
        """A way that's remembered (a flag): set where it begins, when only this way goes there."""
        to = self.N.get(e.get("to")) or {}
        if len(proto.ins(self.P, to.get("id"))) != 1 or to.get("type") not in proto.POINTS:
            self.handoff.append(({"id": e.get("id"), "type": "arrow", "title": f"the way to {to.get('id')}"}, [],
                                 [f"The way “{e.get('label', '')}” is remembered as `{e['sets']}`: set that flag where the way begins"]))
            return
        nid = self.entry.get(to["id"])
        fn = self.S["flow"].get(nid) or {}
        if fn.get("type") == "scene":
            self.S["scenes"][fn["ref"]].setdefault("sets", []).append({"flag": e["sets"]})
        elif fn.get("type") == "stitch":
            self.S["stitches"][fn["ref"]]["beats"][0]["do"].insert(0, {"flag": e["sets"]})

    def secrets_after(self, n, secrets, ends, after):
        """The secrets found after a point: in its task, or in a short look round its room; then, for each, a choice on
        its flag plays what it shows (and goes on where the secret's arrow out says); the rest go straight on."""
        pid, room = n["id"], self.room_of(n)
        beats = []
        for s in secrets:
            key = self.secret_key[s["id"]]
            when = self.trigger({"verb": "look", "item": s.get("find_item")}) if s.get("find_item") in self.thing else None
            if not when:
                box = self.rooms.place(room, "secret", self.own(f"{s['id']}_find"), use="inspect", text=str(s.get("find") or s.get("title") or "…"))
                when = {"use": box}
            beats.append({"id": f"b_{s['id']}_find", "when": when, "secret": key, "do": [{"flag": self.secret_flag[s["id"]]}]})
        tid = f"t_{pid}_look"
        if pid in self.found_in:                         # a task: its finds are in the same room, before it's done
            for bt in beats:
                self.own(bt["id"])
            st = self.found_in[pid]
            st["beats"][-1:-1] = beats
        else:                                            # after a scene: a moment to look round the room, then walk on
            walk = self.rooms.walk_on_of(room)
            self.stitch(tid, {"title": f"A look round: {self.rooms.rooms[room].get('name', room)}", "goal": "Look round, then walk on", "target_min": 1,
                              "template": "look", "beats": [{"id": f"b_{pid}_look", "when": {"start": True}, "do": [{"objective": "Walk on when you're ready"}]}] + beats +
                                                           [{"id": f"b_{pid}_on", "when": {"enter": walk}, "do": [{"done": True}]}],
                              "notes": self.note("a moment to look round before the story goes on: the secrets here are found by the curious")})
            look = self.node(pid, f"n_{pid}_look", {"type": "stitch", "ref": tid, "next": None}, len(self.made.get(pid, [])))
            for holder, key in ends:
                holder[key] = f"n_{pid}_look"
            ends = [(look, "next")]
        for s in secrets:
            egg = self.node(s["id"], f"n_{s['id']}_egg", {"type": "choice", "by": "flag", "options": [{"if": [self.secret_flag[s["id"]]], "to": None}, {"to": None}]}, 1)
            for holder, key in ends:
                holder[key] = f"n_{s['id']}_egg"
            sid = f"s_{s['id']}_seen"
            steps = [x for x in s.get("steps") or [] if x.get("do") not in ("act", "todo", "name", "save")]
            clips, cues, sets = self.clips(s, steps, room) if steps else ([{"id": "c1", "who": "player", "en": "…", "act": str(s.get("shows") or "")}], [], [])
            sc = self.scene(sid, s.get("title") or s["id"], room, [w for w in dict.fromkeys(c["who"] for c in clips) if w in self.cast], clips,
                            "reveal", self.note(f"the secret: {s.get('shows', '')} (found: {s.get('find', '')})"))
            if cues:
                sc["cues"] = cues
            if sets:
                sc["sets"] = sets
            seen = self.node(s["id"], f"n_{s['id']}_seen", {"type": "scene", "ref": sid, "next": None})
            egg["options"][0]["to"] = f"n_{s['id']}_seen"
            back = next((e.get("to") for e in proto.outs(self.P, s["id"])), None)
            seen["next"] = self.entry.get(back) or after
            ends = [(egg["options"][1], "to")]
            self.handoff.append((s, [f"a find in `{room}` (" + (f"the {self.thing[s['find_item']]['name']}" if s.get("find_item") in self.thing else f"`{s['id']}_find`")
                                     + (", in the task" if pid in self.found_in else f", in the look round `{tid}`") + f"), then `{sid}` if it was found"],
                                 ["Hide it where the chart says (its block is a stand-in), and make finding it the curious player's reward",
                                  f"Show what it shows in `{sid}`, then back to the story"]))
        return ends

    # ---- the whole story -----------------------------------------------------------------------------------------
    def build(self):
        P, S, st = self.P, self.S, self.P.get("story") or {}
        minutes = int((P.get("brief") or {}).get("minutes") or 60)
        S["game"] = {"id": self.game, "title": P.get("title") or self.game, "start": "n_start", "draft": True, "prototype": P["id"],
                     "target_min": minutes, "fast_min": round(minutes * 0.75), "voice": "none", "text": "en", "clip_max": 8,
                     "time": st.get("time") if st.get("time") in proto.TIMES else "night", "no_death": True,
                     "karma": {"axes": {"karma": {"min": -10, "max": 10, "label": str(st.get("karma") or "how much of the truth you let yourself see")}}},
                     "built_with": {"engine": L.engine_version(), "format": 3},
                     "note": f"Built by the writers' room from “{P.get('title')}” ({P['id']}): a rough outline. BUILD.md is what's next; faces.md the faces to make."}
        for c in P.get("cast", []):
            S["cast"][self.own(c["id"])] = {"name": c.get("name") or c["id"], "subject": c.get("subject", "she"), "metahuman": None,
                                            "height": 1.75 if c.get("subject") == "he" else 1.62,
                                            "note": "; ".join(f"{k}: {c[k]}" for k in ("role", "look", "wants", "hides", "tells") if c.get(k))}
        for x in self.places:
            if x["id"] not in self.rooms.taken:          # the greybox's rooms are the places (a set's are its own)
                self.own(x["id"])
        if (st.get("player_name") or "").strip():
            S["game"]["player_name"] = st["player_name"].strip()
        self.prepass()
        self.things()
        for k, n in self.N.items():
            if n.get("type") == "secret":
                self.secret_key[k] = key = self.own(k if k not in self.ids else f"egg_{k}")
                self.secret_flag[k] = f"found_{snake(k, 6)}"
                S["secrets"][key] = {"flag": self.secret_flag[k], "hint": str(n.get("find") or n.get("title") or "")}
            if n.get("type") == "choice" and n.get("by") == "answer":
                for e in proto.outs(P, k):
                    w = e.get("when") or {}
                    if w.get("talk"):
                        tk = self.N.get(w["talk"]) or {}
                        o = next((x for x in (tk.get("talk") or {}).get("options") or [] if x.get("id") == w.get("answer")), {})
                        own = o.get("sets") if isinstance(o.get("sets"), str) and proto.ID.match(o.get("sets") or "") else None
                        self.answer_flags[(w["talk"], w.get("answer"))] = own or f"said_{snake(w['talk'], 3)}_{snake(w.get('answer'), 2)}"
        for k in proto.reading_order(P):
            n = self.N[k]
            t = n.get("type")
            if t == "start":
                self.stitch("t_start", {"title": "Start", "beats": [{"id": "b_start", "when": {"start": True}, "do": [{"fade": "in", "secs": 2}, {"done": True}]}]})
                self.exits[k] = [(self.node(k, "n_start", {"type": "stitch", "ref": "t_start", "next": None}), "next")]
                self.entry[k] = "n_start"
            elif t in proto.POINTS:
                self.point(n)
            elif t == "choice":
                self.choice(n)
            elif t == "ending":
                self.ending(n)
        self.wire()
        S["levels"]["main"] = self.rooms.level()
        for r in S["levels"]["main"]["rooms"]:          # the greybox's own ids (its spots, lamps, triggers) are ids too
            for x in r["props"]:
                if x["id"] not in self.rooms.placed and x["id"] not in self.rooms.taken:
                    self.own(x["id"])
        for k, n in self.N.items():                      # achievements: the secrets', the endings', the feats
            a = n.get("achievement") or {}
            if n.get("type") in ("secret", "ending") and str(a.get("title", "")).strip():
                f = {"secret": self.secret_key[k]} if n["type"] == "secret" else {"ending": f"e_{end_id(k)}"}
                S["achievements"][self.own(f"ach_{snake(k, 6)}")] = {"title": a["title"], "text": a.get("text", ""), "hidden": bool(a.get("hidden")), "for": f}
        for a in P.get("feats", []):
            if str(a.get("title", "")).strip():
                S["achievements"][self.own(a.get("id") or f"ach_{snake(a['title'], 4)}")] = {"title": a["title"], "text": a.get("text", ""), "hidden": bool(a.get("hidden")),
                                                                                             "for": {"flag": f"feat_{snake(a['title'], 4)}"}}
        for f in P.get("frames", []):                    # the acts: the board's frames round what was made for their shapes
            inside = [k for k, n in self.N.items() if proto.frame_of(P, n) is f]
            nodes = [nid for k in inside for nid in self.made.get(k, [])]
            if nodes:
                S["frames"].append({"id": f"f_{snake(f.get('id'), 4)}", "title": f.get("title") or f.get("id"), "color": f.get("color") or COLORS[len(S["frames"]) % len(COLORS)], "nodes": nodes})
        S["board"] = self.note(f"Built by the writers' room from “{P.get('title')}” (session {P['id']}) on {today()}: a rough, working outline, laid out as the "
                               "chart was. BUILD.md beside story.json is the plan to make it the game, shape by shape; faces.md lists the faces to make in MiniMax.")
        S["board"] += [{"by": "user", "text": n.get("text", ""), "at": today(), "done": False} for n in self.N.values() if n.get("type") == "note" and str(n.get("text", "")).strip()]
        return S


# ---- the handoff ----------------------------------------------------------------------------------------------------

def build_md(P, S, B, moved=(), rooms=None):
    st, game, N = P.get("story") or {}, S["game"]["id"], proto.nodes_of(P)
    out = [f"# {P.get('title')}: from the writers' room to the game", "",
           f"Built {today()} from the writers' room session `{P['id']}` (Content/Prototypes/{P['id']}/prototype.json; the copy built "
           f"is `prototype.json` beside this). `story.json` is a **rough, working outline** of the chart: it opens on the director's "
           "desk (its board laid out as the chart was), plays in the Watch from the start to each ending, and passes the story check "
           "with `game.draft: true` (the playtime targets only warn until the scenes are written in full). Lines are text "
           "(`game.voice: \"none\"`, EXPRESSIONS_PLAN §3).", "",
           f"**For Claude** (\"build {game} from its BUILD.md\"): make it the game shape by shape, in the director's terms (STORY_FORMAT.md, "
           "DIRECTING.md, WRITING.md). The chart is the user's story: change what happens only with the user. Tick each box as it's done "
           f"and run `python tools/check_all.py --game {game}` after each act. Ask the user what they're doing first (CLAUDE.md). "
           f"`python tools/writers/room.py show {P['id']}` prints the chart as text.", "",
           "## The story", ""]
    b = P.get("brief") or {}
    for k, label in (("kind", "What kind of game"), ("references", "Reference stories")):
        if str(b.get(k, "")).strip():
            out.append(f"- **{label}:** {b[k]}")
    for k, label in (("logline", "Logline"), ("hook", "Why it's relatable"), ("truth", "What's really going on"), ("tone", "Tone"),
                     ("setting", "Setting"), ("player", "Who you are"), ("karma", "What the answers measure (karma)")):
        if str(st.get(k, "")).strip():
            out.append(f"- **{label}:** {st[k]}")
    if str(b.get("notes", "")).strip():
        out.append(f"- **Notes:** {b['notes']}")
    if st.get("ladder"):
        out += ["", "**The believability ladder** (each step has an ordinary explanation first; keep them in this order):", ""]
        out += [f"{i + 1}. {x}" for i, x in enumerate(st["ladder"])]
    if P.get("cast"):
        out += ["", "| Cast | Who | Wants | Hides | Tells (how the face gives it away) |", "|---|---|---|---|---|"]
        out += [f"| `{c['id']}` {c.get('name', '')} ({c.get('subject', 'she')}) | {c.get('role', '')} | {c.get('wants', '')} | {c.get('hides', '')} | {c.get('tells', '')} |"
                for c in P["cast"]]
    if P.get("places"):
        out += ["", "| Place (a greybox room) | What it looks like |", "|---|---|"]
        out += [f"| `{x['id']}` {x.get('name', '')} | {x.get('look', '')} |" for x in P["places"]]
    out += ["", "## Everywhere", "",
            ("- [ ] **The place.** Built into the set `" + rooms.set_name + "` (Content/Studio/Sets/" + rooms.set_name + ", designed first in the "
             "scene builder): " + "; ".join(f"{pid} is its room `{rid}` ({nm})" for pid, rid, nm in rooms.mapping()) + ". Every thing the story names "
             "was fitted against a free stretch of its room's walls, clear of the furniture and the doorways: move each where it belongs (the kettle "
             "on the counter, the album on the shelf: its `at`, or `on` a piece of furniture), and the marks (`<place>_view`, `<place>_<cast>`, "
             "`<place>_<cast>_close`) where the scenes are seen from; `python tools/story.py --game " + game + " rooms` lists them, LEVEL checks them."
             + (" Moved for now: " + "; ".join(rooms.spills()) + "." if rooms.spills() else "")
             if isinstance(rooms, SetRooms) else
             "- [ ] **The place.** The greybox is a row of 6 × 5 m rooms, one per place, joined by doorways. Lay out the real place in "
             "the scene builder (docs/SCENE_BUILDER.md) from the looks above; keep the spot ids (`<room>_view`, `<room>_<cast>`, "
             "`<room>_<cast>_close`) or move the scenes onto the new ones."),
            "- [ ] **The lines.** Each scene has the chart's key lines only: write each in full (WRITING.md: one sentence a line, "
            "the pauses as their own beats, a seam on every cut).",
            "- [ ] **The talks.** The words after each answer are “…” (the face answers first): write them, or keep the silence. Stage "
            "each talk as a close-up (seated across a table, side by side, face to face in a doorway).",
            "- [ ] **The bodies.** Block every scene on the desk (marks, poses, who moves), then the Kimodo shot list.",
            "- [ ] **The faces.** faces.md lists every expression video to make in MiniMax, then capture each into the expression "
            "library (the desk's Expressions tab), named by its id.",
            "- [ ] **The things.** Each thing the chart names is a block of its size (small on a stand, medium on the floor, large "
            "against a wall) with its use (a door in the outer wall, a bed, a seat, a closet to hide in, a switch, a note, a thing to "
            "take or carry, the rest to look at): put the real one in through the Database, where it belongs.",
            "- [ ] **The tasks.** A to-do with no thing of its own is a box on a wall that stands in for it: make it the real thing.",
            "- [ ] **The secrets.** Each find (its thing, or a box) stands in for the hiding place: hide it as the chart says.",
            "- [ ] **The feats.** Achievements for a flag of their own (below) need that flag set where it happens.",
            "- [ ] **Done.** When the scenes are written in full and the playtime check passes, take `game.draft` out.", ""]
    rank = {k: i for i, k in enumerate(proto.reading_order(P))}

    def where_in(entry):                           # a secret right after the point it's found after; the endings last
        item = entry[0]
        if item.get("type") == "secret":
            src = next((e.get("from") for e in proto.ins(P, item.get("id"))), None)
            return (0, rank.get(src, 1e9) + 0.5)
        if item.get("type") == "arrow":
            return (0, rank.get((item.get("title") or "").split()[-1], 1e9) - 0.25)
        return (1 if item.get("type") == "ending" else 0, rank.get(item.get("id"), 1e9))
    act, ending = "", False
    for item, built, todo in sorted(B, key=where_in):
        t = item.get("type")
        if t == "ending" and not ending:
            out += ["## The endings", ""]
            ending = True
        elif t in proto.POINTS + ("choice",) and not ending:
            f = proto.frame_of(P, item)
            if (f or {}).get("id") != act:
                act = (f or {}).get("id")
                out += [f"## {f.get('title') or f.get('id')}" if f else "## Outside the acts", ""]
        if t in proto.POINTS:
            out.append(f"### {item['id']} · {item.get('title', '')} ({t}, {proto.minutes_of(item):g} min, `{item.get('where', '')}`)")
        elif t == "choice":
            out.append(f"### ◇ {item['id']} · {item.get('question') or item.get('title', '')} (a choice: "
                       + {"player": "the player decides", "karma": "karma decides", "answer": "an answer decides"}.get(item.get("by", "player"), "") + ")")
        elif t == "secret":
            out.append(f"### ★ secret {item['id']} · {item.get('title', '')} (achievement: {(item.get('achievement') or {}).get('title', '')})")
        elif t == "ending":
            out.append(f"### ending {item['id']} · {item.get('title', '')} ({item.get('kind', 'other')})")
        else:
            out.append(f"### {item.get('title', item.get('id'))}")
        out.append("")
        if item.get("text") and not item.get("steps"):
            out.append(str(item["text"]))
        for k, label in (("find", "Found"), ("how", "How the player gets here"), ("player", "The player"), ("shot", "The shot"), ("notes", "A note")):
            if item.get(k):
                out.append(f"*{label}:* {item[k]}")
        if item.get("shows") and not item.get("steps"):
            out.append(f"*It shows:* {item['shows']}")
        if item.get("steps"):                       # what was written, as it was written (its script: .claude/skills/chart/script.md)
            out += ["", "As written:", "", "```"] + chartscript.step_lines(P, item["steps"]) + ["```"]
        tk = item.get("talk")
        if t == "talk" and tk:
            out.append(f"*The question:* “{(tk.get('line') or {}).get('text', '')}” (listening: `{tk.get('listen', '')}`)")
            for o in tk.get("options") or []:
                out.append(f"- [{o.get('id')}] “{o.get('say')}”" + (f" ({o['think']})" if o.get("think") else "")
                           + f" → `{o.get('face', '')}` (karma {o.get('karma', 0)}{', sets ' + o['sets'] if isinstance(o.get('sets'), str) and o.get('sets') else ''}): {o.get('tell', '')}"
                           + (f" → “{o['then']}”" if o.get("then") else ""))
            if tk.get("reveals"):
                out.append(f"*What reading the face tells you:* {tk['reveals']}")
        if t == "choice":
            for e in proto.outs(P, item["id"]):
                out.append(f"- [{proto.when_text(item, e)}] → {e.get('to')} {(N.get(e.get('to')) or {}).get('title', '')}")
        if built:
            out += ["", "Built: " + "; ".join(built) + "."]
        out += [""] + [f"- [ ] {x}" for x in todo] + [""]
    if moved:
        out += ["**Karma moved into reach:** " + "; ".join(moved) + ". Balance the answers' karma, or move them back.", ""]
    sticky = [n for n in N.values() if n.get("type") == "note" and str(n.get("text", "")).strip()]
    if sticky:
        out += ["## The notes on the chart", ""] + [f"- ✎ {n['text']}" for n in sticky] + [""]
    out += ["## Achievements", "", "| id | title | for | hidden | text |", "|---|---|---|---|---|"]
    for k, a in S["achievements"].items():
        f = next(iter(a["for"].items()))
        out.append(f"| `{k}` | {a['title']} | {f[0]} `{f[1]}` | {'yes' if a.get('hidden') else ''} | {a.get('text', '')} |")
    feats = [k for k, a in S["achievements"].items() if "flag" in a["for"]]
    if feats:
        out += ["", "- [ ] Set the feats' flags where they happen: " + ", ".join(f"`{S['achievements'][k]['for']['flag']}` ({S['achievements'][k]['title']}: {S['achievements'][k].get('text', '')})" for k in feats)]
    out += ["", "## Checks", "", f"- `python tools/check_all.py --game {game}`: STORY, LEVEL, SHOTS",
            f"- `python tools/story.py --game {game} flow`: the flow as text; the desk: http://127.0.0.1:8780/?game={game}",
            "- `node tools/director/desktest.mjs`, `node tools/director/refstest.mjs` (the desk's own checks over every game)", ""]
    return "\n".join(out)


def faces_md(P, S):
    lib = proto.library()
    cast = {c["id"]: c for c in P.get("cast", [])}
    used = {}
    for fid, where, who in proto.faces_used(P):
        used.setdefault(fid, []).append((where, who))
    out = [f"# {P.get('title')}: the faces to make", "",
           "Each face is a **4 second** MiniMax video: your own prompt for the character, then this post prompt after it. Then, in "
           "the desk's Expressions tab: Import the video, name it by its **id**, set its **Length** to the seconds given (8 to 10 s "
           "still reads as natural) and keep its loop range (EXPRESSIONS_PLAN §2b). One capture serves every character (the face's "
           "movement, played on any body); a face used by a he is written for him below.", "",
           "| id | the post prompt | length | loop | who | where | made |", "|---|---|---|---|---|---|---|"]
    for fid in sorted(used, key=lambda f: (0 if any(x.get("id") == f for x in P.get("faces", [])) else 1, f)):
        f = proto.face_of(P, fid, lib) or {}
        whos = sorted({w for _, w in used[fid] if w})
        subject = "he" if whos and all((cast.get(w) or {}).get("subject") == "he" for w in whos) else "she"
        made = (EXPRESSIONS / fid / "expression.json").exists()
        lp = f.get("loop")
        out.append(f"| `{fid}` | {proto.for_subject(f.get('prompt', '?'), subject)} | {f.get('secs', 4)} s | {f'{lp[0]:.2f}–{lp[1]:.2f}' if lp else ''} | "
                   f"{', '.join(whos)} | {', '.join(w for w, _ in used[fid][:4])}{' …' if len(used[fid]) > 4 else ''} | {'✓' if made else ''} |")
    own = [x for x in P.get("faces", []) if x.get("id") not in used]
    if own:
        out += ["", "The story's own faces not used yet: " + ", ".join(f"`{x['id']}`" for x in own)]
    out += ["", f"{len(used)} faces, {sum(1 for f in used if (EXPRESSIONS / f / 'expression.json').exists())} already in the expression library.", ""]
    return "\n".join(out)


# ---- build, and the check's build ------------------------------------------------------------------------------------

def story_check(path, tool="story_check.py", *args):
    """A check on a story.json (a path is a game to the checks): (ok, its last line, its errors). The story check by
    default; check_all's others are level_check.py and shots_sheet.py --plan."""
    r = subprocess.run([sys.executable, str(ROOT / "tools" / tool), *args, "--game", str(path)], capture_output=True, text=True, timeout=300)
    lines = (r.stdout + r.stderr).strip().splitlines()
    return r.returncode == 0, (lines[-1] if lines else ""), [x for x in lines if x.startswith(("ERROR: ", "FAIL "))]


def build(P, game, force=False, games=None, check=True, set_name=None, sset=None):
    """The chart into Content/Games/<game>/ (or `games`/<game>): story.json, prototype.json, BUILD.md, faces.md.
    A story already there is replaced only with `force` (or when this session built it), kept in the desk's history first.
    `set_name`: built into that set's level (Content/Studio/Sets/<name>, the place designed first; `sset` its story when
    it's already in hand)."""
    game = (game or "").strip() or game_name(P.get("title"))
    if not GAME.match(game):
        return {"ok": False, "game": game, "message": f"the game's folder name {game!r}: a capital letter, then letters and digits (Ticket114)"}
    errs, _ = proto.check(P)
    if errs:
        return {"ok": False, "game": game, "message": f"the chart has {len(errs)} problem(s): {'; '.join(errs[:4])}"}
    N = proto.nodes_of(P)
    if not any(n.get("type") in proto.POINTS for n in N.values()) or not any(n.get("type") == "ending" for n in N.values()):
        return {"ok": False, "game": game, "message": "nothing to build yet: the story's points and its endings first"}
    folder = (Path(games) if games else GAMES) / game
    path = folder / "story.json"
    if path.exists():
        try:
            was = json.loads(path.read_text(encoding="utf-8")).get("game", {}).get("prototype")
        except ValueError:
            was = None
        if was != P["id"] and not force:
            return {"ok": False, "game": game, "message": f"{game} exists and wasn't built from this session: build over it (its story goes into the desk's history first), or pick another name"}
    if set_name and sset is None:
        try:
            sset, _ = L.load("set:" + set_name)
        except SystemExit as e:
            return {"ok": False, "game": game, "message": str(e)}
    try:
        B = Builder(copy.deepcopy(P), game, sset, set_name)
        S = B.build()
    except (ValueError, KeyError) as e:
        return {"ok": False, "game": game, "message": f"the build failed: {e}"}
    if path.exists():                                     # the desk's history keeps what it replaces (a scratch game its own)
        desk = folder.parent.resolve() == (ROOT / "Content" / "Games").resolve()
        hist = ROOT / "Saved" / "Story" / game / "history" if desk else folder / "history"
        hist.mkdir(parents=True, exist_ok=True)
        (hist / f"{time.strftime('%Y%m%d-%H%M%S')}.json").write_bytes(path.read_bytes())
    folder.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(S, ensure_ascii=False, indent=1), encoding="utf-8")
    (folder / "prototype.json").write_text(json.dumps(P, ensure_ascii=False, indent=1), encoding="utf-8")
    (folder / "BUILD.md").write_text(build_md(P, S, B.handoff, B.moved, B.rooms), encoding="utf-8")
    (folder / "faces.md").write_text(faces_md(P, S), encoding="utf-8")
    res = {"ok": True, "game": game, "files": [str(p.relative_to(ROOT)) if ROOT in p.resolve().parents else str(p) for p in
                                               (path, folder / "prototype.json", folder / "BUILD.md", folder / "faces.md")],
           "nodes": len(S["flow"]), "scenes": len(S["scenes"]), "stitches": len(S["stitches"]),
           "placed": sorted(B.rooms.placed), "items": sorted(t["item"] for t in B.thing.values() if t.get("item"))}   # the blocks and items it made
    if check:
        ok, last, errors = story_check(path)
        res["check"] = {"ok": ok, "line": last, "errors": [x[7:] for x in errors[:8]]}
    where = folder.resolve().relative_to(ROOT).as_posix() if ROOT in folder.resolve().parents else str(folder)
    res["message"] = (f"Built {game} in {where}" + (f" into the set {set_name}" if set_name else "") + f": {res['nodes']} flow nodes, {res['scenes']} scenes, "
                      f"{res['stitches']} tasks, {len(S['achievements'])} achievements" + (f"; the story check: {res['check']['line']}" if check else "") + ".")
    return res


DRESS = ("mesh", "kit", "preset", "look", "art", "texture", "pbr")   # what makes a thing more than a plain block


def bare_build(S, placed, items=()):
    """What a build mustn't have (DECISIONS 2026-10-28, evening; HANDOFF_DIRECTOR_TODO §3): the cast stays still at its
    marks, no `body` on any line (an answer's included) and no motions for the user to animate over in Kimodo; and the
    things it placed (`placed`: its blocks' ids; a set's own furniture isn't) and the items it made are plain blocks at
    their size (`box w d h`), untextured, for the Database's real ones. '' when so."""
    bodies = []
    for sid, sc in S.get("scenes", {}).items():
        for v in [sc, *(sc.get("variants") or {}).values()]:
            for c in v.get("clips", []):
                bodies += [f"{sid} {c.get('id')}"] if c.get("body") else []
                bodies += [f"{sid} {c.get('id')} answer {o.get('id')}" for o in (c.get("reply") or {}).get("options", [])
                           for th in L.then_list(o) if th.get("body")]
    moves = []                                       # a behaviour playing a motion, a round's looped motions
    def walk(x, at):
        if isinstance(x, dict):
            for k, v in x.items():
                if k in ("motion", "loops") and v:
                    moves.append(f"{at} {k}")
                walk(v, at)
        elif isinstance(x, list):
            for v in x:
                walk(v, at)
    for table in ("stitches", "scenes"):
        for k, v in S.get(table, {}).items():
            walk(v, k)
    props = {p.get("id"): p for lv in S.get("levels", {}).values() for r in lv.get("rooms", []) for p in r.get("props", [])}
    dressed = [f"{k} ({x.get('shape')})" for k, x in [*((k, props[k]) for k in placed if k in props), *((k, S.get("items", {})[k]) for k in items if k in S.get("items", {}))]
               if not str(x.get("shape", "")).startswith("box ") or any(d in x for d in DRESS)]
    said = [f"bodies on {', '.join(bodies[:3])}" if bodies else "", f"motions {', '.join(list(S.get('motions') or {})[:3])}" if S.get("motions") else "",
            f"the cast moving ({', '.join(moves[:3])})" if moves else "", f"things that aren't plain blocks: {', '.join(dressed[:3])}" if dressed else ""]
    return "; ".join(x for x in said if x)


def check_build(P, set_name=None, sset=None):
    """WRITERS: a chart built into a scratch folder (into a set's level when one's given) passes check_all's STORY, LEVEL
    and SHOTS, and holds what the chart has."""
    with tempfile.TemporaryDirectory() as tmp:
        res = build(P, "WritersCheck", games=tmp, set_name=set_name, sset=sset)
        if not res.get("ok"):
            return {"ok": False, "message": f"the build: {res.get('message')}"}
        if not res["check"]["ok"]:
            return {"ok": False, "message": f"the build fails the story check: {'; '.join(res['check']['errors'][:4]) or res['check']['line']}"}
        path = Path(tmp) / "WritersCheck" / "story.json"
        report = ROOT / "Saved" / "Story" / "WritersCheck"   # where the shots' review lands (by the game's id): not kept
        try:
            for tool, *args in (("level_check.py",), ("shots_sheet.py", "--plan")):   # check_all's others: the greybox, the shots
                ok, last, errors = story_check(path, tool, *args)
                if not ok:
                    return {"ok": False, "message": f"the build fails {tool}: {'; '.join(errors[:4]) or last}"}
        finally:
            shutil.rmtree(report, ignore_errors=True)
        S = json.loads(path.read_text(encoding="utf-8"))
        bare = bare_build(S, res["placed"], res["items"])
        if bare:
            return {"ok": False, "message": f"the build {bare}: only the dialogue, the tasks and the gameplay go across (HANDOFF_DIRECTOR_TODO §3)"}
        N = proto.nodes_of(P)
        talks = [n for n in N.values() if n.get("type") == "talk" and (n.get("talk") or {}).get("options")]
        replies = [c for sc in S["scenes"].values() for c in sc["clips"] if c.get("reply")]
        ends = [n for n in S["flow"].values() if n["type"] == "ending"]
        eggs = [n for n in S["flow"].values() if n["type"] == "choice" and n["by"] == "flag" and any(
            set(o.get("if", [])) & {s["flag"] for s in S["secrets"].values()} for o in n["options"])]
        md = (Path(tmp) / "WritersCheck" / "BUILD.md").read_text(encoding="utf-8")
        fm = (Path(tmp) / "WritersCheck" / "faces.md").read_text(encoding="utf-8")
        missing = [k for k, n in N.items() if n.get("type") in proto.POINTS + ("choice", "secret", "ending") and f" {k} · " not in md]
        faces = {f for f, _, _ in proto.faces_used(P)}
        placed = [k for k, n in S["flow"].items() if not isinstance(n.get("xy"), list)]
        if len(replies) != len(talks) or len(ends) != sum(n.get("type") == "ending" for n in N.values()) \
                or len(eggs) != sum(n.get("type") == "secret" for n in N.values()) or missing or placed \
                or any(f"`{f}`" not in fm for f in faces) or sum(1 for c in replies if c.get("wait_expr")) != sum(1 for n in talks if (n.get("talk") or {}).get("listen")):
            return {"ok": False, "message": f"the build: {len(replies)} hanging lines for {len(talks)} talks, {len(ends)} endings, {len(eggs)} "
                                            f"secrets' choices, BUILD.md misses {missing}, unplaced on the board {placed[:4]}"}
        return {"ok": True, "message": f"a chart built through check_all's STORY ({res['check']['line'].split('(')[-1].rstrip(')')}), LEVEL and SHOTS: "
                                       f"{res['nodes']} nodes on the board as on the chart, {len(replies)} talks as hanging lines with her faces, "
                                       f"{len(ends)} endings, {len(eggs)} secrets rejoining, {len(S['achievements'])} achievements, {len(S['frames'])} acts; "
                                       f"BUILD.md shape by shape, faces.md {len(faces)} faces"}
