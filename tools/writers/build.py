"""Build: a writers' room prototype into the director (docs/WRITERS_ROOM.md §7). A rough, working outline of the game
in Content/Games/<Game>/: story.json (format 3, `game.draft`), the prototype it was built from, BUILD.md (the handoff:
what Claude does next to make it the game, point by point) and faces.md (the MiniMax post prompts to make).

    import build
    res = build.build(P, "Ticket114")        # {"ok", "game", "message", "files", "check"}
    res = build.check_build(P)               # the same into a scratch folder, through the story check (WRITERS)

The story: one level, a greybox room per place in a row (joined by doorways), each with the player's eye (`<room>_view`),
a mark for every cast member far (`<room>_<cast>`) and close (`<room>_<cast>_close`, the talks' close-ups) and a lamp;
the boxes the tasks, the secrets and the forks use stand along its walls. Each point becomes:

- scene: a scene of its lines (the face's post prompt as each clip's `expr`);
- talk: a scene, the close-up: its lines, then the hanging line with her listening face (`wait_expr`) and the answers
  (2 or 3), each with her face's answer (`then`: "…", the face's prompt and what it gives away), karma and a flag;
- task: a stitch with its to-do list, each task ticked by using its box;
- chapter: its lines as a scene, then the chapter card (a stitch: the title, the time of day, an autosave);
- choice: its lines as a scene; a fork is a choice by act (a box for each way) whose ways join the river again.

A secret is found in its point's task (a secret beat), or, after a scene, in a short look round the room; then a choice
on its flag plays what it shows and rejoins the river. The endings: a choice by the answers that decide one, then by
karma, each ending's scene (final) and its ending. Achievements: the prototype's, each on its secret, ending or flag.
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
        b = P.get("bible") or {}
        self.cast = {c["id"]: c for c in b.get("cast", [])}
        self.places = b.get("places") or [{"id": "room", "name": "A room"}]
        self.lib = proto.library()
        self.rooms = Rooms(self.places, b.get("cast", []))
        self.ids = set()
        self.S = {"format": 3, "game": {}, "cast": {}, "items": {}, "notes": {}, "lines": {}, "sounds": {}, "levels": {},
                  "secrets": {}, "achievements": {}, "motions": {}, "stitches": {}, "scenes": {}, "flow": {}, "interrupts": [],
                  "board": [], "frames": []}
        self.open = []                  # (holder, key): where the next node's id goes (a `next`, an option's `to`)
        self.act_nodes = {}             # act id -> its nodes, for the board's frames
        self.handoff = []               # BUILD.md: (point, what was built, the todo boxes)
        self.secret_key, self.secret_flag = {}, {}
        self.answer_flags = {}          # (point, option) -> the flag an ending reads
        self.moved = []                 # karma bounds moved into the answers' reach

    # ids: everything this build makes is unique across the file
    def own(self, i):
        if i in self.ids:
            raise ValueError(f"the build made the id {i!r} twice: rename a point, a secret or an ending in the prototype")
        self.ids.add(i)
        return i

    def where(self, p):
        w = p.get("where")
        return w if w in self.rooms.rooms else self.rooms.order[0]

    def face(self, fid, who):
        f = proto.face_of(self.P, fid, self.lib) if fid else None
        subject = (self.cast.get(who) or {}).get("subject", "she")
        return proto.for_subject(f["prompt"], subject) if f and f.get("prompt") else None

    def note(self, text):
        return [{"by": "claude", "text": text, "at": today()}]

    def node(self, nid, n, act):
        self.S["flow"][self.own(nid)] = n
        self.act_nodes.setdefault(act, []).append(nid)
        for holder, key in self.open:
            holder[key] = nid
        self.open = []
        return n

    # a scene of lines (the scene, the talk, a chapter's or a fork's moment, a secret seen, an ending)
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

    def who_of(self, p):
        return [c for c in (p.get("who") or []) if c in self.cast]

    def speaker(self, p):
        """Who a scene's placeholder line is said by: the point's first cast member, else the player's own thought."""
        w = self.who_of(p)
        return w[0] if w else "player"

    def about(self, p):
        bits = [f"what happens: {p.get('what', '')}"]
        if p.get("player"):
            bits.append(f"the player: {p['player']}")
        if p.get("shot"):
            bits.append(f"the shot: {p['shot']}")
        return "; ".join(bits)

    # ---- a point and the nodes it becomes -----------------------------------------------------------------------
    def point(self, p, act, way=None, way_flag=None, first=False):
        """The nodes for one point (on the river or in a fork's way); leaves the ends open for whatever comes next.
        Returns the stitch the point's secrets are found in, if it has one."""
        pid, room, kind = p["id"], self.where(p), p.get("type")
        who, title = self.who_of(p), p.get("title") or pid
        built, todo = [], []
        self.handoff.append((dict(p, _way=way.get("label")) if way else p, built, todo))
        found_in = None

        def scene_node(nid, sid, sc):
            n = self.node(nid, {"type": "scene", "ref": sid, "next": None}, act)
            self.open = [(n, "next")]
            if way_flag and not sc.get("sets"):
                sc["sets"] = [{"flag": way_flag}]
            return n

        t = p.get("talk") if kind != "task" else None
        if kind in ("scene", "talk") or (kind in ("chapter", "choice") and p.get("lines")) or t:
            asked = re.sub(r"\W+", " ", str(((t or {}).get("line") or {}).get("text", ""))).strip().lower()
            lines = [ln for ln in p.get("lines") or [] if not asked or re.sub(r"\W+", " ", str(ln.get("text", ""))).strip().lower() != asked]
            clips = self.clips_of(lines, self.speaker(p), p.get("what", "")) if (lines or not t) else []
            talker = None
            if t:
                clips.append(self.hanging(p, t, len(clips)))
                talker = clips[-1]["who"]
                if len(clips) > 1:
                    clips[-1]["seam"] = dict(SEAM)
                for c in clips:                          # a close-up: the face 0.65 m from the eye, head and shoulders
                    c["shot"] = "mcu"
            mood = "intimate" if t else "calm" if kind == "chapter" or first else "reveal" if kind == "choice" else "dread"
            sid = f"s_{pid}"
            notes = self.note(self.about(p) + (f"; what the talk reveals: {t['reveals']}" if t and t.get("reveals") else ""))
            sc = self.scene(sid, title, room, who, clips, mood, notes, close=talker)
            scene_node(f"n_{pid}", sid, sc)
            way_flag = None
            if t:
                opts = t.get("options") or []
                built.append(f"scene `{sid}`, a close-up: {len(clips) - 1} line(s), then the hanging line {clips[-1]['id']} "
                             f"({len(opts)} answers, the face answering each)")
                her = "his" if (self.cast.get(talker) or {}).get("subject") == "he" else "her"
                todo += [f"Stage it as a close-up, as the shot says: the mark `{room}_{talker}_close`, the player's eye across a table, "
                         "beside on a sofa or face to face in a doorway",
                         f"Write {her} words after each answer (`then.en` is “…”: {her} face answers first), and the lines before the question",
                         f"Make {her} faces (faces.md): the listening face and one for each answer; each answer's tell is its `then.act`"]
            else:
                built.append(f"scene `{sid}`: {len(clips)} line(s){' (a placeholder: no lines yet)' if not p.get('lines') else ''}")
                todo += ["Write the scene in full: its lines in order with the pauses between, a seam on every cut",
                         "Block it on the desk: the marks, who moves, where the eye goes"]
        if kind == "task":
            found_in = self.task(p, act, room, way_flag, built, todo)
        elif kind == "chapter":
            ch = p.get("chapter") or {}
            tid = f"t_{pid}"
            card = {"chapter": ch.get("title") or title}
            if ch.get("sub"):
                card["sub"] = ch["sub"]
            if ch.get("time") in proto.TIMES:
                card["time"] = ch["time"]
            self.stitch(tid, {"title": title, "template": "chapter", "target_min": 0.2, "beats": [
                {"id": f"b_{pid}_card", "when": {"start": True}, "do": ([{"flag": way_flag}] if way_flag else []) + [card, {"done": True}]}],
                "notes": self.note(self.about(p))})
            n = self.node(f"n_{pid}_card" if f"n_{pid}" in self.S["flow"] else f"n_{pid}", {"type": "stitch", "ref": tid, "next": None}, act)
            self.open = [(n, "next")]
            built.append(f"the chapter card `{tid}`: “{card['chapter']}{' · ' + card['sub'] if card.get('sub') else ''}”"
                         + (f", {card['time']} from here on" if card.get("time") else ""))
            todo.append("If the night ends in sleep, a bed in the room (`use: sleep`) and the card on its `use` (STORY_FORMAT §4)")
        fk = p.get("fork")
        if fk and (fk.get("ways") or []):
            self.fork(p, fk, act, room, built, todo)
        elif kind == "choice" and not p.get("lines"):
            sid = f"s_{pid}"                           # a choice point with no fork and no lines: its moment, as a placeholder
            sc = self.scene(sid, title, room, who, self.clips_of([], self.speaker(p), p.get("what", "")), "reveal", self.note(self.about(p)))
            scene_node(f"n_{pid}", sid, sc)
            built.append(f"scene `{sid}`: a placeholder (no lines yet)")
            todo.append("Write the moment in full (what the player decides here is in the next talk's answers)")
        return found_in

    def hanging(self, p, t, i):
        """A talk's question as a hanging line: she asks, waits with her listening face, and her face answers yours."""
        ln = t.get("line") or {}
        who = ln.get("who") if ln.get("who") in self.cast else (self.who_of(p) or list(self.cast) or ["player"])[0]
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
            flag = o.get("sets") if isinstance(o.get("sets"), str) and proto.ID.match(o.get("sets") or "") else None
            if (p["id"], o.get("id")) in self.answer_flags:
                flag = flag or self.answer_flags[(p["id"], o.get("id"))]
                self.answer_flags[(p["id"], o.get("id"))] = flag
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

    def task(self, p, act, room, way_flag, built, todo):
        """A task: a stitch with its to-do list, each task ticked by using its box in the room."""
        pid = p["id"]
        tid = f"t_{pid}"
        start = [{"flag": way_flag}] if way_flag else []
        start.append({"objective": p.get("title") or pid})
        for i, ln in enumerate(p.get("lines") or []):
            lid = self.own(f"l_{pid}_{i + 1}")
            who = ln.get("who") if ln.get("who") in self.cast else None
            if not who:
                continue
            self.S["lines"][lid] = {"who": who, "en": str(ln.get("text") or "…")}
            start.append({"say": lid})
        for c in self.who_of(p):
            start.append({"behave": c, "as": "idle", "at": f"{room}_{c}", "face": "player"})
        tasks = p.get("tasks") or [{"id": "do", "text": p.get("player") or p.get("title") or "Look around"}]
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
        done = [{"untodo": True}] + [{"behave": c, "as": "off"} for c in self.who_of(p)] + [{"done": True}]
        st = self.stitch(tid, {"title": p.get("title") or pid, "goal": p.get("player") or p.get("title") or "", "target_min": float(p.get("minutes") or 2),
                               "template": "todo", "beats": [
                                   {"id": f"b_{pid}_start", "when": {"start": True}, "do": start},
                                   {"id": f"b_{pid}_done", "when": {"ticked": True}, "do": done}],
                               "notes": self.note(self.about(p) + ("; " + "; ".join(fails) if fails else ""))})
        n = self.node(f"n_{pid}", {"type": "stitch", "ref": tid, "next": None}, act)
        self.open = [(n, "next")]
        built.append(f"stitch `{tid}`: a to-do list of {len(tasks)} (each ticked by using its box on the wall of `{room}`)")
        todo.append("Make each task the real thing where it belongs (the box is a stand-in): " + "; ".join(str(k.get("text")) for k in tasks))
        todo += [f"Make it failable: {f}" for f in fails]
        if self.who_of(p):
            todo.append(f"{', '.join(self.cast[c].get('name', c) for c in self.who_of(p))} waits idle on her mark meanwhile: a request? "
                        "(`who` on the task, `behave` go when it's done: STORY_FORMAT §9.12)")
        return st

    def fork(self, p, fk, act, room, built, todo):
        """A fork: a choice by act (a box for each way: using it takes that way), each way its points, all joining the
        river again at the next main point."""
        pid, ways = p["id"], fk["ways"]
        n = self.node(f"n_{pid}_way" if f"n_{pid}" in self.S["flow"] else f"n_{pid}",
                      {"type": "choice", "by": "act", "prompt": str(fk.get("question") or p.get("title") or ""), "options": []}, act)
        ends = []
        for w in ways:
            wid = snake(w.get("id") or f"w{len(n['options']) + 1}", 3)
            box = self.rooms.place(room, "way", self.own(f"{pid}_{wid}" if not wid.startswith(pid) else wid), use="inspect", text=str(w.get("label") or wid))
            opt = {"label": str(w.get("label") or wid), "when": {"use": box}, "to": None}
            n["options"].append(opt)
            self.open = [(opt, "to")]
            flag = w.get("sets") if isinstance(w.get("sets"), str) and proto.ID.match(w.get("sets") or "") else None
            for q in w.get("points") or []:
                self.point(q, act, way=w, way_flag=flag)
                flag = None
            ends += self.open
        self.open = ends
        built.append(f"the fork `{n['prompt']}`: a choice by act, {len(ways)} ways (a box each in `{room}`: using it takes that way), "
                     "joining again at the next point")
        todo.append("Make the ways real choices in the room (go to the dryer, look at the monitor...): the boxes stand in for them")

    def secrets_after(self, p, act, found_in):
        """The secrets that leave from this point: found in its task, or in a short look round its room; then each
        one's flag choice plays what it shows and rejoins the river."""
        ss = [s for s in self.P.get("secrets", []) if s.get("after") == p["id"]]
        if not ss:
            return
        room = self.where(p)
        beats = []
        for s in ss:
            key = self.secret_key[s["id"]]
            box = self.rooms.place(room, "secret", self.own(f"{s['id']}_find"), use="inspect", text=str(s.get("find") or s.get("title") or "…"))
            beats.append({"id": f"b_{s['id']}_find", "when": {"use": box}, "secret": key, "do": [{"flag": self.secret_flag[s["id"]]}]})
        tid = f"t_{p['id']}_look"
        if found_in is not None:                         # a task: its finds are in the same room, before it's done
            for bt in beats:
                self.own(bt["id"])
            found_in["beats"][-1:-1] = beats
        else:                                            # after a scene: a moment to look round the room, then walk on
            walk = self.rooms.walk_on_of(room)
            self.stitch(tid, {"title": f"A look round: {self.place_name(room)}", "goal": "Look round, then walk on", "target_min": 1, "template": "look",
                              "beats": [{"id": f"b_{p['id']}_look", "when": {"start": True}, "do": [{"objective": "Walk on when you're ready"}]}] + beats +
                                       [{"id": f"b_{p['id']}_on", "when": {"enter": walk}, "do": [{"done": True}]}],
                              "notes": self.note("a moment to look round before the story goes on: the secrets here are found by the curious")})
            n = self.node(f"n_{p['id']}_look", {"type": "stitch", "ref": tid, "next": None}, act)
            self.open = [(n, "next")]
        for s in ss:
            egg = self.node(f"n_{s['id']}_egg", {"type": "choice", "by": "flag", "options": [
                {"if": [self.secret_flag[s["id"]]], "to": None}, {"to": None}]}, act)
            sid = f"s_{s['id']}_seen"
            sc = self.scene(sid, s.get("title") or s["id"], room, [], [{"id": "c1", "who": "player", "en": "…", "act": str(s.get("shows") or "")}],
                            "reveal", self.note(f"the secret: {s.get('shows', '')} (found: {s.get('find', '')})"))
            self.open = [(egg["options"][0], "to")]
            seen = self.node(f"n_{s['id']}_seen", {"type": "scene", "ref": sid, "next": None}, act)
            self.open = [(seen, "next"), (egg["options"][1], "to")]
            self.handoff.append((s, [f"a find in `{room}` (`{s['id']}_find`, " + ("in the task" if found_in is not None else f"in the look round `{tid}`")
                                     + f"), then `{sid}` if it was found"],
                                 ["Hide it where the prototype says (the box is a stand-in), and make finding it the curious player's reward",
                                  f"Show what it shows in `{sid}` (a placeholder), then back to the river"]))

    def place_name(self, rid):
        return self.rooms.rooms[rid].get("name", rid)

    # ---- the endings ---------------------------------------------------------------------------------------------
    def endings(self, last):
        ends = self.P.get("endings", [])
        act = (last or {}).get("act")
        room = self.where(last) if last else self.rooms.order[0]
        who = self.who_of(last)[:2] if last else []
        by_answer = [e for e in ends if (e.get("rule") or {}).get("by") == "answer"]
        by_karma = [e for e in ends if e not in by_answer]
        bounded = [e for e in by_karma if (e.get("rule") or {}).get("min") is not None or (e.get("rule") or {}).get("max") is not None]
        karma_order = bounded + [e for e in by_karma if e not in bounded][:1]
        self.reach_karma(bounded)
        heads = []
        if by_answer:
            n = self.node("n_end", {"type": "choice", "by": "flag", "options": []}, act)
            for e in by_answer:
                r = e["rule"]
                n["options"].append({"if": [self.answer_flags[(r["point"], r["option"])]], "to": None})
            if karma_order:
                n["options"].append({"to": None})
            else:
                n["options"][-1].pop("if")
            heads = list(zip(by_answer + ([None] if karma_order else []), n["options"]))
        if karma_order:
            kn = {"type": "choice", "by": "karma", "options": []}
            for e in karma_order:
                r, o = e.get("rule") or {}, {"to": None}
                if e is not karma_order[-1]:
                    o.update({k: r[k] for k in ("min", "max") if r.get(k) is not None})
                kn["options"].append(o)
            if by_answer:
                self.open = [(heads[-1][1], "to")]
                heads = heads[:-1]
            self.node("n_end_karma" if by_answer else "n_end", kn, act)
            heads += list(zip(karma_order, kn["options"]))
        for e, o in heads:
            eid = end_id(e["id"])
            sid = f"s_end_{eid}"
            self.scene(sid, e.get("title") or eid, room, who, [{"id": "c1", "who": who[0] if who else "player", "en": "…", "act": str(e.get("what") or "")}],
                       "aftermath", self.note(f"the ending ({e.get('kind')}): {e.get('what', '')} How the player gets here: {e.get('how', '')}"), final=True)
            self.open = [(o, "to")]
            n = self.node(f"n_end_{eid}", {"type": "scene", "ref": sid, "next": f"e_{eid}", "final": True}, act)
            r = e.get("rule") or {}
            kind = "good" if e.get("kind") == "intended" else "other" if r.get("by") == "answer" else "bad" if r.get("max") is not None else "neutral"
            self.S["flow"][self.own(f"e_{eid}")] = {"type": "ending", "kind": kind, "title": e.get("title") or eid}
            self.act_nodes.setdefault(act, []).append(f"e_{eid}")
            rule = "by karma " + " ".join(f"{k} {r[k]:g}" for k in ("min", "max") if r.get(k) is not None) if r.get("by") != "answer" else \
                f"by the answer {r.get('option')} at {r.get('point')}"
            if r.get("by") != "answer" and o is heads[-1][1] and r.get("by", "karma") == "karma":
                rule = "by karma: the rest (the fallback)"
            self.handoff.append((e, [f"`{sid}` (final), then the ending `e_{eid}` ({kind}), {rule}"],
                                 ["Write the ending cutscene in full (no ending cards: DECISIONS 2026-10-27)",
                                  "Play the way there on the desk (the Watch, the karma it shows at the end) and see it plays as the prototype says"]))
        self.open = []

    def reach_karma(self, bounded):
        """Each ending by karma reachable by the answers: the kindest player's karma at least its `min`, the cruellest's at
        most its `max`, a player who says nothing (0) on the fallback. A bound out of reach moves into it (said in BUILD.md)."""
        kind, cruel = proto.karma_range(self.P)
        for e in bounded:
            r = e["rule"]
            if r.get("min") is not None:
                want = min(max(1, r["min"]), kind) if kind >= 1 else r["min"]
                if want != r["min"]:
                    self.moved.append(f"{e['id']}: karma min {r['min']} → {want} (the kindest answers add up to {kind:g})")
                    r["min"] = want
            if r.get("max") is not None:
                want = max(min(-1, r["max"]), cruel) if cruel <= -1 else r["max"]
                if want != r["max"]:
                    self.moved.append(f"{e['id']}: karma max {r['max']} → {want} (the cruellest add up to {cruel:g})")
                    r["max"] = want

    # ---- the whole story -----------------------------------------------------------------------------------------
    def build(self):
        P, S, b = self.P, self.S, self.P.get("bible") or {}
        minutes = int(P["brief"].get("minutes") or 60)
        S["game"] = {"id": self.game, "title": P.get("title") or self.game, "start": "n_start", "draft": True, "prototype": P["id"],
                     "target_min": minutes, "fast_min": round(minutes * 0.75), "voice": "none", "text": "en", "clip_max": 8,
                     "time": b.get("time") if b.get("time") in proto.TIMES else "night", "no_death": True,
                     "karma": {"axes": {"karma": {"min": -10, "max": 10, "label": str(b.get("karma") or "how much of the truth you let yourself see")}}},
                     "built_with": {"engine": L.engine_version(), "format": 3},
                     "note": f"Built by the writers' room from “{P.get('title')}” ({P['id']}): a rough outline. BUILD.md is what's next; faces.md the faces to make."}
        for c in b.get("cast", []):
            S["cast"][self.own(c["id"])] = {"name": c.get("name") or c["id"], "subject": c.get("subject", "she"), "metahuman": None,
                                            "height": 1.75 if c.get("subject") == "he" else 1.62,
                                            "note": "; ".join(f"{k}: {c[k]}" for k in ("role", "look", "wants", "hides", "tells") if c.get(k))}
        for x in self.places:
            self.own(x["id"])
        S["levels"]["main"] = None                   # filled at the end, once every box is placed
        for s in P.get("secrets", []):
            self.secret_key[s["id"]] = key = self.own(s["id"] if s["id"] not in self.ids else f"egg_{s['id']}")
            self.secret_flag[s["id"]] = f"found_{snake(s['id'], 6)}"
            S["secrets"][key] = {"flag": self.secret_flag[s["id"]], "hint": str(s.get("find") or s.get("title") or "")}
        for e in P.get("endings", []):
            r = e.get("rule") or {}
            if r.get("by") == "answer":
                self.answer_flags[(r.get("point"), r.get("option"))] = f"said_{snake(r.get('point'), 3)}_{snake(r.get('option'), 2)}"
        self.stitch("t_start", {"title": "Start", "beats": [{"id": "b_start", "when": {"start": True}, "do": [{"fade": "in", "secs": 2}, {"done": True}]}]})
        first_act = (P.get("points") or [{}])[0].get("act")
        n = self.node("n_start", {"type": "stitch", "ref": "t_start", "next": None}, first_act)
        self.open = [(n, "next")]
        points = P.get("points", [])
        for i, p in enumerate(points):
            found_in = self.point(p, p.get("act"), first=not i)
            self.secrets_after(p, p.get("act"), found_in)
        self.endings(points[-1] if points else None)
        S["levels"]["main"] = self.rooms.level()
        for r in S["levels"]["main"]["rooms"]:          # the greybox's own ids (its spots, lamps, triggers) are ids too
            for x in r["props"]:
                if x["id"] not in self.rooms.placed:
                    self.own(x["id"])
        for a in P.get("achievements", []):          # each on its secret, its ending, or a flag of its own (a feat)
            kind, _, ref = str(a.get("for", "feat")).partition(":")
            if kind == "secret" and ref in self.secret_key:
                f = {"secret": self.secret_key[ref]}
            elif kind == "ending" and f"e_{end_id(ref)}" in S["flow"]:
                f = {"ending": f"e_{end_id(ref)}"}
            else:
                f = {"flag": f"feat_{snake(a.get('title') or a.get('id'), 4)}"}
            S["achievements"][self.own(a["id"])] = {"title": a.get("title") or a["id"], "text": a.get("text", ""), "hidden": bool(a.get("hidden")), "for": f}
        have = {json.dumps(a["for"]) for a in S["achievements"].values()}
        for s in P.get("secrets", []):               # a secret or an ending with no achievement gets one: they unlock one each
            f = {"secret": self.secret_key[s["id"]]}
            if json.dumps(f) not in have and s.get("achievement"):
                S["achievements"][self.own(f"ach_{snake(s['id'], 6)}")] = {"title": s["achievement"], "text": s.get("title", ""), "hidden": False, "for": f}
        for e in P.get("endings", []):
            f = {"ending": f"e_{end_id(e['id'])}"}
            if json.dumps(f) not in have and f["ending"] in S["flow"]:
                S["achievements"][self.own(f"ach_{end_id(e['id'])}")] = {"title": e.get("title") or e["id"], "text": "", "hidden": True, "for": f}
        acts = {a.get("id"): a.get("title") for a in P.get("acts", [])}
        for i, (act, nodes) in enumerate(self.act_nodes.items()):
            if act:
                S["frames"].append({"id": f"f_{snake(act, 4)}", "title": f"{act}: {acts.get(act) or ''}".strip(": "), "color": COLORS[i % len(COLORS)], "nodes": nodes})
        S["board"] = self.note(f"Built by the writers' room from “{P.get('title')}” (session {P['id']}) on {today()}: a rough, working outline. "
                               "BUILD.md beside story.json is the plan to make it the game, point by point; faces.md lists the faces to make in MiniMax.")
        return S


# ---- the handoff ----------------------------------------------------------------------------------------------------

def build_md(P, S, B, moved=()):
    b, game = P.get("bible") or {}, S["game"]["id"]
    out = [f"# {P.get('title')}: from the writers' room to the game", "",
           f"Built {today()} from the writers' room session `{P['id']}` (Content/Prototypes/{P['id']}/prototype.json; the copy built "
           f"is `prototype.json` beside this). `story.json` is a **rough, working outline**: it opens on the director's desk, plays in "
           "the Watch from the start to each ending, and passes the story check with `game.draft: true` (the playtime targets only warn "
           "until the scenes are written in full). Lines are text (`game.voice: \"none\"`, EXPRESSIONS_PLAN §3).", "",
           f"**For Claude** (\"build {game} from its BUILD.md\"): make it the game point by point, in the director's terms (STORY_FORMAT.md, "
           "DIRECTING.md, WRITING.md). The prototype is the agreed story: change what happens only with the user. Tick each box as it's done "
           f"and run `python tools/check_all.py --game {game}` after each act. Ask the user what they're doing first (CLAUDE.md).", "",
           "## The story", ""]
    for k, label in (("logline", "Logline"), ("hook", "Why it's relatable"), ("truth", "What's really going on"), ("tone", "Tone"),
                     ("setting", "Setting"), ("player", "Who you are"), ("karma", "What the answers measure (karma)")):
        if b.get(k):
            out.append(f"- **{label}:** {b[k]}")
    if b.get("ladder"):
        out += ["", "**The believability ladder** (each step has an ordinary explanation first; keep them in this order):", ""]
        out += [f"{i + 1}. {x}" for i, x in enumerate(b["ladder"])]
    if b.get("cast"):
        out += ["", "| Cast | Who | Wants | Hides | Tells (how the face gives it away) |", "|---|---|---|---|---|"]
        out += [f"| `{c['id']}` {c.get('name', '')} ({c.get('subject', 'she')}) | {c.get('role', '')} | {c.get('wants', '')} | {c.get('hides', '')} | {c.get('tells', '')} |"
                for c in b["cast"]]
    if b.get("places"):
        out += ["", "| Place (a greybox room) | What it looks like |", "|---|---|"]
        out += [f"| `{x['id']}` {x.get('name', '')} | {x.get('look', '')} |" for x in b["places"]]
    out += ["", "## Everywhere", "",
            "- [ ] **The place.** The greybox is a row of 6 × 5 m rooms, one per place, joined by doorways. Lay out the real place in "
            "the scene builder (docs/SCENE_BUILDER.md) from the looks above; keep the spot ids (`<room>_view`, `<room>_<cast>`, "
            "`<room>_<cast>_close`) or move the scenes onto the new ones.",
            "- [ ] **The lines.** Each scene has the prototype's key lines only: write each in full (WRITING.md: one sentence a line, "
            "the pauses as their own beats, a seam on every cut).",
            "- [ ] **The talks.** Her words after each answer are “…” (her face answers first): write them, or keep the silence. Stage "
            "each talk as a close-up (seated across a table, side by side, face to face in a doorway).",
            "- [ ] **The bodies.** Block every scene on the desk (marks, poses, who moves), then the Kimodo shot list.",
            "- [ ] **The faces.** faces.md lists every expression video to make in MiniMax, then capture each into the expression "
            "library (the desk's Expressions tab), named by its id.",
            "- [ ] **The tasks.** Each task's box (on the east walls) stands in for the real thing: make it that thing where it belongs.",
            "- [ ] **The secrets.** Each find's box (on the west walls) stands in for the hiding place: hide it as the prototype says.",
            "- [ ] **The feats.** Achievements for a flag of their own (below) need that flag set where it happens.",
            "- [ ] **Done.** When the scenes are written in full and the playtime check passes, take `game.draft` out.", ""]
    acts = {a.get("id"): a.get("title") for a in P.get("acts", [])}
    act, ending = object(), False
    for item, built, todo in B:
        if "type" in item and item.get("act", act) != act and item.get("act"):
            act = item["act"]
            out += [f"## {act}: {acts.get(act, '')}", ""]
        if "type" in item:
            on = f" ⑂ the way “{item['_way']}”" if item.get("_way") else ""
            out.append(f"### {item['id']} · {item.get('title', '')} ({item.get('type')}, {item.get('minutes', 0)} min, `{item.get('where', '')}`){on}")
        elif "after" in item:
            out.append(f"### ★ secret {item['id']} · {item.get('title', '')} (after {item.get('after')}; achievement: {item.get('achievement', '')})")
            item = {"what": f"*Found:* {item.get('find', '')}", "player": None, "shows": item.get("shows")}
        else:
            if not ending:
                out += ["## The endings", ""]
                ending = True
            out.append(f"### ending {item['id']} · {item.get('title', '')} ({item.get('kind')})")
            item = {"what": item.get("what"), "how": item.get("how")}
        out.append("")
        if item.get("shows"):
            item["what"] += f" *It shows:* {item['shows']}"
        if item.get("how"):
            item["what"] += f"\n*How the player gets here:* {item['how']}"
        if item.get("what"):
            out.append(f"{item['what']}")
        if item.get("player"):
            out.append(f"*The player:* {item['player']}")
        if item.get("shot"):
            out.append(f"*The shot:* {item['shot']}")
        t = item.get("talk")
        if t:
            out.append(f"*The question:* “{(t.get('line') or {}).get('text', '')}” (listening: `{t.get('listen', '')}`)")
            for o in t.get("options") or []:
                out.append(f"- [{o.get('id')}] “{o.get('say')}” → `{o.get('face')}` (karma {o.get('karma', 0)}{', sets ' + o['sets'] if isinstance(o.get('sets'), str) and o.get('sets') else ''}): {o.get('tell', '')}")
            if t.get("reveals"):
                out.append(f"*What it reveals:* {t['reveals']}")
        if built:
            out += ["", "Built: " + "; ".join(built) + "."]
        out += [""] + [f"- [ ] {x}" for x in todo] + [""]
    if moved:
        out += ["**Karma moved into reach:** " + "; ".join(moved) + ". Balance the answers' karma, or move them back.", ""]
    out += ["## Achievements", "", "| id | title | for | hidden | text |", "|---|---|---|---|---|"]
    for k, a in S["achievements"].items():
        f = next(iter(a["for"].items()))
        out.append(f"| `{k}` | {a['title']} | {f[0]} `{f[1]}` | {'yes' if a.get('hidden') else ''} | {a.get('text', '')} |")
    feats = [k for k, a in S["achievements"].items() if "flag" in a["for"]]
    if feats:
        out += ["", "- [ ] Set the feats' flags where they happen: " + ", ".join(f"`{S['achievements'][k]['for']['flag']}` ({S['achievements'][k]['title']}: {S['achievements'][k].get('text', '')})" for k in feats)]
    out += ["", "## Checks", "", f"- `python tools/check_all.py --game {game}`: STORY, LEVEL, SHOTS",
            f"- `python tools/story.py --game {game} flow`: the flow as text; the desk: http://127.0.0.1:8780/?game={game}",
            "- `node tools/director/desktest.mjs`, `node tools/director/refstest.mjs` (the desk's own checks over every game)",
            f"- The writers' room: `python tools/writers/room.py show {P['id']}` (the prototype, as text)", ""]
    return "\n".join(out)


def faces_md(P, S):
    lib = proto.library()
    cast = {c["id"]: c for c in (P.get("bible") or {}).get("cast", [])}
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
        out += ["", "The prototype's own faces not used yet: " + ", ".join(f"`{x['id']}`" for x in own)]
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
    """The prototype into Content/Games/<game>/ (or `games`/<game>): story.json, prototype.json, BUILD.md, faces.md.
    A story already there is replaced only with `force` (or when this prototype built it), kept in the desk's history first."""
    game = (game or "").strip() or game_name(P.get("title"))
    if not GAME.match(game):
        return {"ok": False, "game": game, "message": f"the game's folder name {game!r}: a capital letter, then letters and digits (Ticket114)"}
    errs, _ = proto.check(P)
    if errs:
        return {"ok": False, "game": game, "message": f"the prototype has {len(errs)} problem(s): {'; '.join(errs[:4])}"}
    if not P.get("points") or len(P.get("endings", [])) < 1:
        return {"ok": False, "game": game, "message": "nothing to build yet: the river and the endings first (Draft)"}
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
    res = {"ok": True, "game": game, "files": [str(p.relative_to(ROOT)) if ROOT in p.parents else str(p) for p in
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
    """WRITERS: the prototype built into a scratch folder passes the story check, and holds what the prototype has."""
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
        S = json.loads((Path(tmp) / "WritersCheck" / "story.json").read_text(encoding="utf-8"))
        talks = [p for p, _, _ in proto.all_points(P) if p.get("talk")]
        replies = [c for sc in S["scenes"].values() for c in sc["clips"] if c.get("reply")]
        ends = [n for n in S["flow"].values() if n["type"] == "ending"]
        eggs = [n for n in S["flow"].values() if n["type"] == "choice" and n["by"] == "flag" and any(
            set(o.get("if", [])) & {s["flag"] for s in S["secrets"].values()} for o in n["options"])]
        md = (Path(tmp) / "WritersCheck" / "BUILD.md").read_text(encoding="utf-8")
        fm = (Path(tmp) / "WritersCheck" / "faces.md").read_text(encoding="utf-8")
        missing = [p["id"] for p, _, _ in proto.all_points(P) if f"### {p['id']} " not in md]
        faces = {f for f, _, _ in proto.faces_used(P)}
        if len(replies) != len(talks) or len(ends) != len(P["endings"]) or len(eggs) != len(P.get("secrets", [])) or missing \
                or any(f"`{f}`" not in fm for f in faces) or not all(c.get("wait_expr") for c in replies):
            return {"ok": False, "message": f"the build: {len(replies)} hanging lines for {len(talks)} talks, {len(ends)} endings, {len(eggs)} "
                                            f"secrets' choices, BUILD.md misses {missing}"}
        return {"ok": True, "message": f"a build on the stand-in's draft passes check_all's STORY ({res['check']['line'].split('(')[-1].rstrip(')')}), LEVEL and SHOTS: "
                                       f"{res['nodes']} nodes, {len(replies)} talks as hanging lines with her faces, {len(ends)} endings, "
                                       f"{len(eggs)} secrets rejoining, {len(S['achievements'])} achievements; BUILD.md point by point, faces.md "
                                       f"{len(faces)} faces"}
