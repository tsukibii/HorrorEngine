"""Build: your chart from the writers' room into the director (docs/WRITERS_ROOM.md §5). A rough, working outline of
the game in Content/Games/<Game>/: story.json (format 3, `game.draft`), the prototype it was built from, BUILD.md (the
handoff: what Claude does next to make it the game, shape by shape) and faces.md (the MiniMax post prompts to make).

    import build
    res = build.build(P, "Ticket114")        # {"ok", "game", "message", "files", "check"}
    res = build.check_build(P)               # the same into a scratch folder, through the story check (WRITERS)

The story: one level, a greybox room per place in a row (joined by doorways), each with the player's eye (`<room>_view`),
a mark for every cast member far (`<room>_<cast>`) and close (`<room>_<cast>_close`, the talks' close-ups) and a lamp;
the boxes the tasks, the secrets and the choices use stand along its walls. Each shape becomes:

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
    """The level: a room per place in a row going north, and the free places along their walls for the boxes."""

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
        self.used = {rid: set() for rid in self.order}
        self.walk_on = {}
        self.placed = set()             # the boxes' ids (owned where they're made)

    def level(self):
        links = [{"a": a, "b": b, "via": None} for a, b in zip(self.order, self.order[1:])]
        return {"start": "start", "rooms": [self.rooms[r] for r in self.order], "links": links}

    def slots(self, kind):
        """Where a box can stand, clear of the eye, the marks and the way through: along the east and west walls, by
        the north wall's corners, along the south wall beside the doorway. Tasks fill the east first, secrets the west."""
        east = [(W - 0.3, y, 180) for y in (0.8, 1.7, 2.6, 3.5, 4.4)]
        west = [(0.3, y, 0) for y in (0.8, 1.7, 2.6, 3.5, 4.4)]
        inner = [(1.4, 4.4, 270), (4.6, 4.4, 270), (1.4, 2.7, 270), (4.6, 2.7, 270)]
        south = [(1.0, 0.35, 90), (1.7, 0.35, 90), (4.3, 0.35, 90), (5.0, 0.35, 90)]
        return {"task": east + south + inner + west, "secret": west + inner + south + east, "way": inner + east + west + south}[kind]

    def place(self, rid, kind, pid, **fields):
        """A box in the room: the first free slot for its kind."""
        for x, y, rot in self.slots(kind):
            if (x, y) not in self.used[rid]:
                self.used[rid].add((x, y))
                prop = dict({"id": pid, "shape": BOX[kind], "at": [x, y], "rot": rot, "tag": kind}, **fields)
                self.rooms[rid]["props"].append(prop)
                self.placed.add(pid)
                return pid
        raise ValueError(f"the greybox room {rid} has no room left for {pid}: too many tasks and finds in one place (split it)")

    def walk_on_of(self, rid):
        """The doorway's end of the room: walking into it ends a look round."""
        if rid not in self.walk_on:
            tid = f"{rid}_walk_on"
            self.rooms[rid]["props"].append({"id": tid, "use": "trigger", "size": [1.6, 0.8, 2.2], "at": [W / 2, D - 0.45]})
            self.walk_on[rid] = tid
        return self.walk_on[rid]


# ---- the story ------------------------------------------------------------------------------------------------------

class Builder:
    def __init__(self, P, game):
        self.P, self.game = P, game
        self.N = proto.nodes_of(P)
        self.cast = {c["id"]: c for c in P.get("cast", [])}
        self.places = P.get("places") or [{"id": "room", "name": "A room"}]
        self.lib = proto.library()
        self.rooms = Rooms(self.places, P.get("cast", []))
        self.ids = set()
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

    def speaker(self, n):
        """Who a scene's placeholder line is said by: the shape's first cast member, else the player's own thought."""
        w = self.who_of(n)
        return w[0] if w else "player"

    def about(self, n):
        bits = [f"what happens: {n.get('text', '')}"]
        for k, label in (("player", "the player"), ("shot", "the shot"), ("notes", "a note from the chart")):
            if n.get(k):
                bits.append(f"{label}: {n[k]}")
        return "; ".join(bits)

    def clips_of(self, lines, fallback_who, act_text):
        clips = []
        for ln in lines:
            who = ln.get("who") if ln.get("who") in self.cast or ln.get("who") == "player" else fallback_who
            c = {"id": f"c{len(clips) + 1}", "who": who, "en": str(ln.get("text") or "…").strip() or "…"}
            ex = self.face(ln.get("face"), who)
            if ex:
                c["expr"] = ex
            if clips:
                c["seam"] = dict(SEAM)
            clips.append(c)
        if not clips:
            clips.append({"id": "c1", "who": fallback_who, "en": "…", "act": act_text})
        return clips

    # ---- a shape and the nodes it becomes ------------------------------------------------------------------------
    def point(self, n):
        """A scene, talk, task or chapter: its nodes; what comes after it is written where its exits say."""
        pid, room, kind = n["id"], self.room_of(n), n.get("type")
        who, title = self.who_of(n), n.get("title") or pid
        built, todo = [], []
        self.handoff.append((n, built, todo))
        t = n.get("talk") if kind == "talk" else None
        last, k = None, 0
        if kind in ("scene", "talk") or (kind == "chapter" and n.get("lines")):
            asked = re.sub(r"\W+", " ", str(((t or {}).get("line") or {}).get("text", ""))).strip().lower()
            lines = [ln for ln in n.get("lines") or [] if not asked or re.sub(r"\W+", " ", str(ln.get("text", ""))).strip().lower() != asked]
            clips = self.clips_of(lines, self.speaker(n), n.get("text", "")) if (lines or not t or not (t.get("options"))) else []
            talker = None
            if t and t.get("options"):
                clips.append(self.hanging(n, t, len(clips)))
                talker = clips[-1]["who"]
                if len(clips) > 1:
                    clips[-1]["seam"] = dict(SEAM)
                for c in clips:                          # a close-up: the face 0.65 m from the eye, head and shoulders
                    c["shot"] = "mcu"
            first = not [e for e in proto.ins(self.P, pid) if (self.N.get(e.get("from")) or {}).get("type") != "start"]
            mood = "intimate" if talker else "calm" if kind == "chapter" or first else "dread"
            sid = f"s_{pid}"
            notes = self.note(self.about(n) + (f"; what reading her face tells you: {t['reveals']}" if t and t.get("reveals") else ""))
            self.scene(sid, title, room, who, clips, mood, notes, close=talker)
            last = self.node(pid, f"n_{pid}", {"type": "scene", "ref": sid, "next": None})
            self.entry[pid] = f"n_{pid}"
            k = 1
            if talker:
                opts = t.get("options") or []
                her = "his" if (self.cast.get(talker) or {}).get("subject") == "he" else "her"
                built.append(f"scene `{sid}`, a close-up: {len(clips) - 1} line(s), then the hanging line {clips[-1]['id']} "
                             f"({len(opts)} answers, the face answering each)")
                todo += [f"Stage it as a close-up, as the shot says: the mark `{room}_{talker}_close`, the player's eye across a table, "
                         "beside on a sofa or face to face in a doorway",
                         f"Write {her} words after each answer (`then.en` is “…”: {her} face answers first), and the lines before the question",
                         f"Make {her} faces (faces.md): the listening face and one for each answer; each answer's tell is its `then.act`"]
            else:
                built.append(f"scene `{sid}`: {len(clips)} line(s){' (a placeholder: no lines yet)' if not lines else ''}")
                todo += ["Write the scene in full: its lines in order with the pauses between, a seam on every cut",
                         "Block it on the desk: the marks, who moves, where the eye goes"]
                if kind == "talk":
                    todo.append("Write the talk's answers on the chart (it has none yet), then build again")
        if kind == "task":
            last = self.task(n, room, built, todo)
        elif kind == "chapter":
            ch = n.get("chapter") or {}
            tid = f"t_{pid}"
            card = {"chapter": ch.get("title") or title}
            if ch.get("sub"):
                card["sub"] = ch["sub"]
            if ch.get("time") in proto.TIMES:
                card["time"] = ch["time"]
            self.stitch(tid, {"title": title, "template": "chapter", "target_min": 0.2, "beats": [
                {"id": f"b_{pid}_card", "when": {"start": True}, "do": [card, {"done": True}]}], "notes": self.note(self.about(n))})
            nid = f"n_{pid}_card" if last else f"n_{pid}"
            nd = self.node(pid, nid, {"type": "stitch", "ref": tid, "next": None}, k)
            if last:
                last["next"] = nid
            else:
                self.entry[pid] = nid
            last = nd
            built.append(f"the chapter card `{tid}`: “{card['chapter']}{' · ' + card['sub'] if card.get('sub') else ''}”"
                         + (f", {card['time']} from here on" if card.get("time") else ""))
            todo.append("If the night ends in sleep, a bed in the room (`use: sleep`) and the card on its `use` (STORY_FORMAT §4)")
        self.exits[pid] = [(last, "next")]

    def hanging(self, n, t, i):
        """A talk's question as a hanging line: she asks, waits with her listening face, and her face answers yours."""
        ln = t.get("line") or {}
        who = ln.get("who") if ln.get("who") in self.cast else (self.who_of(n) or list(self.cast) or ["player"])[0]
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
            then = {"en": "…"}
            if o.get("tell"):
                then["act"] = o["tell"]
            fx = self.face(o.get("face"), who)
            if fx:
                then["expr"] = fx
            opt = {"id": snake(o.get("id") or f"o{len(opts) + 1}", 2), "label": str(o.get("say") or "…"), "then": then}
            if sets:
                opt["sets"] = sets
            opts.append(opt)
        c["reply"] = {"wait": 15, "timeout": None, "options": opts}
        return c

    def task(self, n, room, built, todo):
        """A task: a stitch with its to-do list, each to-do ticked by using its box in the room."""
        pid = n["id"]
        tid = f"t_{pid}"
        start = [{"objective": n.get("title") or pid}]
        for i, ln in enumerate(n.get("lines") or []):
            who = ln.get("who") if ln.get("who") in self.cast else None
            if not who:
                continue
            lid = self.own(f"l_{pid}_{i + 1}")
            self.S["lines"][lid] = {"who": who, "en": str(ln.get("text") or "…")}
            start.append({"say": lid})
        for c in self.who_of(n):
            start.append({"behave": c, "as": "idle", "at": f"{room}_{c}", "face": "player"})
        tasks = [k for k in n.get("tasks") or [] if str(k.get("text", "")).strip()] or [{"id": "do", "text": n.get("player") or n.get("title") or "Look round"}]
        fails = []
        for k in tasks:
            kid = snake(k.get("id") or f"t{len(start)}", 3)
            box = self.rooms.place(room, "task", self.own(f"{pid}_{kid}_box"), use="inspect", text=str(k.get("done") or k.get("text") or "Done."))
            td = {"todo": f"{pid}_{kid}", "text": str(k.get("text") or kid), "ticks": {"use": box}}
            if k.get("who") in self.cast:
                td["who"] = k["who"]
            start.append(td)
            if k.get("fails"):
                fails.append(f"“{k.get('text')}” fails: {k['fails']}")
        done = [{"untodo": True}] + [{"behave": c, "as": "off"} for c in self.who_of(n)] + [{"done": True}]
        st = self.stitch(tid, {"title": n.get("title") or pid, "goal": n.get("player") or n.get("title") or "", "target_min": float(n.get("minutes") or 2),
                               "template": "todo", "beats": [
                                   {"id": f"b_{pid}_start", "when": {"start": True}, "do": start},
                                   {"id": f"b_{pid}_done", "when": {"ticked": True}, "do": done}],
                               "notes": self.note(self.about(n) + ("; " + "; ".join(fails) if fails else ""))})
        nd = self.node(pid, f"n_{pid}", {"type": "stitch", "ref": tid, "next": None})
        self.entry[pid] = f"n_{pid}"
        self.found_in[pid] = st
        built.append(f"stitch `{tid}`: a to-do list of {len(tasks)} (each ticked by using its box on the wall of `{room}`)")
        todo.append("Make each to-do the real thing where it belongs (the box is a stand-in): " + "; ".join(str(k.get("text")) for k in tasks))
        todo += [f"Make it failable: {f}" for f in fails]
        if self.who_of(n):
            todo.append(f"{', '.join(self.cast[c].get('name', c) for c in self.who_of(n))} waits idle on her mark meanwhile: a request? "
                        "(`who` on the to-do, `behave` go when it's done: STORY_FORMAT §9.12)")
        return nd

    def choice(self, n):
        """A choice: by the player (a box for each way: using it takes that way), by karma, or by an answer."""
        cid, by, room = n["id"], n.get("by", "player"), self.room_of(n)
        built, todo = [], []
        self.handoff.append((n, built, todo))
        es = proto.outs(self.P, cid)
        if by == "player":
            c = self.node(cid, f"n_{cid}", {"type": "choice", "by": "act", "prompt": str(n.get("question") or n.get("title") or ""), "options": []})
            for e in es:
                box = self.rooms.place(room, "way", self.own(f"{cid}_{snake(e.get('id'), 2)}"), use="inspect", text=str(e.get("label") or e.get("to")))
                o = {"label": str(e.get("label") or (self.N.get(e.get("to")) or {}).get("title") or e.get("to")), "when": {"use": box}, "to": None}
                c["options"].append(o)
                self.options[e["id"]] = o
            built.append(f"a choice by act `n_{cid}`: {len(es)} ways (a box each in `{room}`: using it takes that way)")
            todo.append("Make the ways real things to do in the room (go to the dryer, look at the monitor...): the boxes stand in for them")
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
        who = self.who_of(last)[:2]
        sid = f"s_end_{eid}"
        self.scene(sid, n.get("title") or eid, room, who, [{"id": "c1", "who": who[0] if who else "player", "en": "…", "act": str(n.get("text") or "")}],
                   "aftermath", self.note(f"the ending ({n.get('kind', 'other')}): {n.get('text', '')} How the player gets here: {n.get('how', '')}"), final=True)
        self.node(n["id"], f"n_end_{eid}", {"type": "scene", "ref": sid, "next": f"e_{eid}", "final": True})
        froms = [(self.N.get(e.get("from")) or {}, e) for e in proto.ins(self.P, n["id"])]
        kind = "good" if n.get("kind") == "intended" else \
            "bad" if any(a.get("by") == "karma" and (e.get("when") or {}).get("max") is not None for a, e in froms) else \
            "other" if any(a.get("by") == "answer" and (e.get("when") or {}).get("talk") for a, e in froms) else "neutral"
        self.node(n["id"], f"e_{eid}", {"type": "ending", "kind": kind, "title": n.get("title") or eid}, 1)
        self.entry[n["id"]] = f"n_end_{eid}"
        built.append(f"`{sid}` (final), then the ending `e_{eid}` ({kind})")
        todo += ["Write the ending cutscene in full (no ending cards: DECISIONS 2026-10-27)",
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
            box = self.rooms.place(room, "secret", self.own(f"{s['id']}_find"), use="inspect", text=str(s.get("find") or s.get("title") or "…"))
            beats.append({"id": f"b_{s['id']}_find", "when": {"use": box}, "secret": key, "do": [{"flag": self.secret_flag[s["id"]]}]})
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
            self.scene(sid, s.get("title") or s["id"], room, [], [{"id": "c1", "who": "player", "en": "…", "act": str(s.get("shows") or "")}],
                       "reveal", self.note(f"the secret: {s.get('shows', '')} (found: {s.get('find', '')})"))
            seen = self.node(s["id"], f"n_{s['id']}_seen", {"type": "scene", "ref": sid, "next": None})
            egg["options"][0]["to"] = f"n_{s['id']}_seen"
            back = next((e.get("to") for e in proto.outs(self.P, s["id"])), None)
            seen["next"] = self.entry.get(back) or after
            ends = [(egg["options"][1], "to")]
            self.handoff.append((s, [f"a find in `{room}` (`{s['id']}_find`, " + ("in the task" if pid in self.found_in else f"in the look round `{tid}`")
                                     + f"), then `{sid}` if it was found"],
                                 ["Hide it where the chart says (the box is a stand-in), and make finding it the curious player's reward",
                                  f"Show what it shows in `{sid}` (a placeholder), then back to the story"]))
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
            self.own(x["id"])
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
                if x["id"] not in self.rooms.placed:
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

def build_md(P, S, B, moved=()):
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
            "- [ ] **The place.** The greybox is a row of 6 × 5 m rooms, one per place, joined by doorways. Lay out the real place in "
            "the scene builder (docs/SCENE_BUILDER.md) from the looks above; keep the spot ids (`<room>_view`, `<room>_<cast>`, "
            "`<room>_<cast>_close`) or move the scenes onto the new ones.",
            "- [ ] **The lines.** Each scene has the chart's key lines only: write each in full (WRITING.md: one sentence a line, "
            "the pauses as their own beats, a seam on every cut).",
            "- [ ] **The talks.** The words after each answer are “…” (the face answers first): write them, or keep the silence. Stage "
            "each talk as a close-up (seated across a table, side by side, face to face in a doorway).",
            "- [ ] **The bodies.** Block every scene on the desk (marks, poses, who moves), then the Kimodo shot list.",
            "- [ ] **The faces.** faces.md lists every expression video to make in MiniMax, then capture each into the expression "
            "library (the desk's Expressions tab), named by its id.",
            "- [ ] **The tasks.** Each to-do's box (on the east walls) stands in for the real thing: make it that thing where it belongs.",
            "- [ ] **The secrets.** Each find's box (on the west walls) stands in for the hiding place: hide it as the chart says.",
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
        if item.get("text"):
            out.append(str(item["text"]))
        for k, label in (("find", "Found"), ("shows", "It shows"), ("how", "How the player gets here"), ("player", "The player"), ("shot", "The shot"), ("notes", "A note")):
            if item.get(k):
                out.append(f"*{label}:* {item[k]}")
        tk = item.get("talk")
        if t == "talk" and tk:
            out.append(f"*The question:* “{(tk.get('line') or {}).get('text', '')}” (listening: `{tk.get('listen', '')}`)")
            for o in tk.get("options") or []:
                out.append(f"- [{o.get('id')}] “{o.get('say')}” → `{o.get('face', '')}` (karma {o.get('karma', 0)}{', sets ' + o['sets'] if isinstance(o.get('sets'), str) and o.get('sets') else ''}): {o.get('tell', '')}")
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
    notes = [n for n in N.values() if n.get("type") == "note" and str(n.get("text", "")).strip()]
    if notes:
        out += ["## The notes on the chart", ""] + [f"- ✎ {n['text']}" for n in notes] + [""]
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


def build(P, game, force=False, games=None, check=True):
    """The chart into Content/Games/<game>/ (or `games`/<game>): story.json, prototype.json, BUILD.md, faces.md.
    A story already there is replaced only with `force` (or when this session built it), kept in the desk's history first."""
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
    try:
        B = Builder(copy.deepcopy(P), game)
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
    (folder / "BUILD.md").write_text(build_md(P, S, B.handoff, B.moved), encoding="utf-8")
    (folder / "faces.md").write_text(faces_md(P, S), encoding="utf-8")
    res = {"ok": True, "game": game, "files": [str(p.relative_to(ROOT)) if ROOT in p.resolve().parents else str(p) for p in
                                               (path, folder / "prototype.json", folder / "BUILD.md", folder / "faces.md")],
           "nodes": len(S["flow"]), "scenes": len(S["scenes"]), "stitches": len(S["stitches"])}
    if check:
        ok, last, errors = story_check(path)
        res["check"] = {"ok": ok, "line": last, "errors": [x[7:] for x in errors[:8]]}
    where = folder.resolve().relative_to(ROOT).as_posix() if ROOT in folder.resolve().parents else str(folder)
    res["message"] = (f"Built {game} in {where}: {res['nodes']} flow nodes, {res['scenes']} scenes, {res['stitches']} tasks, "
                      f"{len(S['achievements'])} achievements" + (f"; the story check: {res['check']['line']}" if check else "") + ".")
    return res


def check_build(P):
    """WRITERS: a chart built into a scratch folder passes check_all's STORY, LEVEL and SHOTS, and holds what the chart has."""
    with tempfile.TemporaryDirectory() as tmp:
        res = build(P, "WritersCheck", games=tmp)
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
                or any(f"`{f}`" not in fm for f in faces) or not all(c.get("wait_expr") for c in replies):
            return {"ok": False, "message": f"the build: {len(replies)} hanging lines for {len(talks)} talks, {len(ends)} endings, {len(eggs)} "
                                            f"secrets' choices, BUILD.md misses {missing}, unplaced on the board {placed[:4]}"}
        return {"ok": True, "message": f"a chart built through check_all's STORY ({res['check']['line'].split('(')[-1].rstrip(')')}), LEVEL and SHOTS: "
                                       f"{res['nodes']} nodes on the board as on the chart, {len(replies)} talks as hanging lines with her faces, "
                                       f"{len(ends)} endings, {len(eggs)} secrets rejoining, {len(S['achievements'])} achievements, {len(S['frames'])} acts; "
                                       f"BUILD.md shape by shape, faces.md {len(faces)} faces"}
