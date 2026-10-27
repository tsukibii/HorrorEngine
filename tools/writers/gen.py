"""The writers' room's drafting (docs/WRITERS_ROOM.md §1, §5): the stages that turn a brief into a prototype (the bible
and the endings, the river, each act's details), suggesting endings, and the assistant's chat, each one request with a
JSON schema, checked by storykit.proto and sent back with the problems when it's wrong (two more tries).

    draft(P, backend, progress=print, save=proto.save)   every stage in order, saved as each lands
    chat(P, message, view, backend)                      -> (reply, the prototype changed, done, couldn't)
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "Content" / "Python"))
sys.path.insert(0, str(HERE))
from storykit import proto  # noqa: E402
import llm  # noqa: E402

TRIES = 3

RULES = """You are the writers' room of HorrorStudio, a two-person studio making short first-person horror games. You prototype a
game's story before anything is built: a river of points the player follows, its forks and secrets, and three endings.
The user brings the rough idea and the references; you make it a story that works.

THE GAMES
- About an hour: 55 to 65 minutes on a first playthrough; played again for the other endings and the secrets.
- Relatable first: stories the player has nearly lived (a distant friend invites you over; house-sitting for a
  neighbour; your sister's new boyfriend; a late shift alone; a grandparent you haven't visited in years; a date that
  goes well, too well). The horror is that something isn't quite right with a person or a place you should be able to
  trust.
- The believability ladder: the strange arrives in steps. First it has an ordinary explanation (she's tired, the walls
  are thin, you misremembered the date); then a pattern; then a detail nothing ordinary explains; then the truth. A
  bizarre premise is grounded in the personal and the physical: what the player finds (a note, a photo, a voicemail, a
  receipt) makes the impossible feel documented, as if it really happened. Nothing is explained by a speech: the player
  puts it together a beat before the story confirms it. Never break a rule the story set; keep the ordinary details
  consistent (the time, the weather, what's in the fridge).
- An interactive story with light gameplay that matters: it feels like watching a story unfold with you in it. What the
  player does is small and always changes something: what you find changes what you know, what you answer changes what
  she says and how it ends. No quick-time events, no combat, no game overs, no deaths that send you back: bad things
  happen in endings.
- First person: the camera is the player's eye. The player is "you" and speaks only through the answers they choose.

THE RIVER
- 16 to 24 main points in order, 2 to 5 minutes each, in 3 to 5 acts (often days or nights: sleeping ends one, a
  chapter card starts the next).
- A point is a scene (people talk to you: a cutscene from your eye), a talk, a task, a chapter or a choice.
- A talk is an L.A. Noire close-up: intimate, face to face; she says something, you choose what to say from 2 or 3
  answers, and her face answers before her words do. The faces carry the truth: a player who watches them learns what
  she really wants. 1 to 3 talks an act, staged close (seated across a table, side by side on a sofa, face to face in a
  doorway): a face can't be read from across a room.
- A task is light gameplay: a to-do list of chores, a request (she asks, waits, and walks off when it's done), something
  to find, a room to look through, a note to read.
- A chapter is time passing: you sleep, or night falls; a title card such as "Saturday · 07:40" and the time of day.
- A choice is a decision that matters: a fork (the story goes two ways for a while, each way 1 to 3 points, and both
  reach the next main point) or, at the end, the way to an ending. At most one or two forks a game. No branch is cut off.
- Secrets come back to the river: 3 to 6 side streams for the curious (a locked phone, a photo behind another, a room
  nobody mentions): a short extra moment that unlocks an achievement, after which the story picks up at the next main
  point. Never needed for the intended ending; they deepen the truth.
- Three endings, each an ending cutscene: the intended one (the truth understood and faced, earned) and two others
  (you misread her, ignored the signs, took her side, left without knowing). What the player noticed and chose decides:
  the talks' answers carry karma (the bible says what it measures in this story), and sometimes a last answer decides.
  Each ending is reachable on a first playthrough by a natural way of playing.
- Achievements: one per secret, one per ending, a few small feats. Short, evocative titles; hints that don't spoil.

LINES AND FACES
- Lines are English, shown as text: one sentence each, 12 words at most; pauses are their own beats. The player's
  answers are short (2 to 8 words), each believable, each meaning something different (warm, probing, evasive, honest,
  a lie).
- Every face in a dialogue moment is a MiniMax post prompt: a fragment appended after the user's own prompt for the
  character, saying what the face visibly does in 4 seconds: present tense, third person, lower case, two or three
  moves with the last one held, no speech, no camera moves, movement not feelings. Example: "her eyes roll up as she
  bites her lower lip, she nervously looks down and then back at the viewer."
- Use a face from the library by its id when one fits; write a new face only when the moment needs it: a new id, its
  prompt, secs (how long it plays once stretched, 4 to 10) and loop (the held part to loop, as fractions of the clip,
  e.g. [0.5, 1]; null when it doesn't loop).

IDS: lower case letters, digits and _, starting with a letter (hana, living_room, p07, kettle); each unique."""


# ---- the schemas (made strict by llm.strict: every object closed, every property present) --------------------------

S, N, I, B = {"type": "string"}, {"type": "number"}, {"type": "integer"}, {"type": "boolean"}
NUL = {"type": "null"}
STRS = {"type": "array", "items": S}
OUTLINE = {"id": S, "type": {"type": "string", "enum": list(proto.TYPES)}, "title": S, "where": S, "who": STRS, "minutes": N, "what": S, "player": S}
ENDING = {"type": "object", "properties": {"id": S, "kind": {"type": "string", "enum": list(proto.KINDS)}, "title": S, "what": S, "how": S,
                                           "by": {"type": "string", "enum": ["user", "suggested"]}}}
BIBLE = {"type": "object", "properties": {
    "title": S, "logline": S, "hook": S, "truth": S, "ladder": STRS, "tone": S, "setting": S, "player": S,
    "time": {"type": "string", "enum": list(proto.TIMES)}, "karma": S,
    "cast": {"type": "array", "items": {"type": "object", "properties": {"id": S, "name": S, "subject": {"type": "string", "enum": ["she", "he"]},
                                                                          "role": S, "look": S, "wants": S, "hides": S, "tells": S}}},
    "places": {"type": "array", "items": {"type": "object", "properties": {"id": S, "name": S, "look": S}}},
    "endings": {"type": "array", "items": ENDING}}}
ENDINGS = {"type": "object", "properties": {"endings": {"type": "array", "items": ENDING}}}
RIVER = {"type": "object", "properties": {
    "acts": {"type": "array", "items": {"type": "object", "properties": {"id": S, "title": S}}},
    "points": {"type": "array", "items": {"type": "object", "properties": dict(OUTLINE, act=S, fork={"anyOf": [NUL, {"type": "object", "properties": {
        "question": S, "ways": {"type": "array", "items": {"type": "object", "properties": {
            "id": S, "label": S, "sets": S, "points": {"type": "array", "items": {"type": "object", "properties": OUTLINE}}}}}}}]})}},
    "secrets": {"type": "array", "items": {"type": "object", "properties": {"id": S, "after": S, "title": S, "find": S, "shows": S, "achievement": S}}},
    "achievements": {"type": "array", "items": {"type": "object", "properties": {"id": S, "title": S, "text": S, "for": S, "hidden": B}}},
    "rules": {"type": "array", "items": {"type": "object", "properties": {"id": S, "by": {"type": "string", "enum": ["karma", "answer"]},
                                                                          "min": {"anyOf": [NUL, N]}, "max": {"anyOf": [NUL, N]}, "point": S, "option": S}}}}}
FACE = {"type": "object", "properties": {"id": S, "prompt": S, "secs": N, "loop": {"anyOf": [NUL, {"type": "array", "items": N}]}, "for": S}}
DETAILS = {"type": "object", "properties": {
    "points": {"type": "array", "items": {"type": "object", "properties": {
        "id": S, "shot": S,
        "lines": {"type": "array", "items": {"type": "object", "properties": {"who": S, "text": S, "face": S}}},
        "talk": {"anyOf": [NUL, {"type": "object", "properties": {
            "line": {"type": "object", "properties": {"who": S, "text": S}}, "listen": S,
            "options": {"type": "array", "items": {"type": "object", "properties": {"id": S, "say": S, "face": S, "tell": S, "karma": I, "sets": S}}},
            "reveals": S}}]},
        "tasks": {"type": "array", "items": {"type": "object", "properties": {"id": S, "text": S, "who": S, "done": S, "fails": S}}},
        "chapter": {"anyOf": [NUL, {"type": "object", "properties": {"title": S, "sub": S, "time": {"type": "string", "enum": list(proto.TIMES)}}}]}}}},
    "faces": {"type": "array", "items": FACE}}}
CHAT = {"type": "object", "properties": {
    "reply": S,
    "changes": {"type": "array", "items": {"type": "object", "properties": {
        "op": {"type": "string", "enum": ["set", "add", "remove", "move"]}, "what": {"type": "string", "enum": list(proto.WHAT)},
        "id": S, "after": S, "field": S, "value_json": S}}}}}


# ---- what each request carries -------------------------------------------------------------------------------------

def brief_text(P):
    b = P.get("brief") or {}
    ends = b.get("endings") or []
    names = ["the intended ending", "another ending", "a third ending"]
    given = [f"- {names[i]}: {e.strip()}" for i, e in enumerate(ends[:3]) if str(e).strip()]
    return (f"THE BRIEF\nWhat kind of game: {b.get('kind') or '(not given)'}\n"
            f"Length: about {b.get('minutes', 60)} minutes on a first playthrough.\n"
            f"Reference stories and notes:\n{(b.get('references') or '').strip() or '(none)'}\n"
            + (f"More notes: {b['notes'].strip()}\n" if str(b.get("notes", "")).strip() else "")
            + ("The user's endings:\n" + "\n".join(given) if given else "The user gave no endings: suggest all three."))


def bible_text(P):
    b = P.get("bible") or {}
    if not b:
        return ""
    cast = "\n".join(f"- {c['id']}: {c.get('name')} ({c.get('subject')}), {c.get('role')}; wants {c.get('wants')}; hides {c.get('hides')}; tells: {c.get('tells')}" for c in b.get("cast", []))
    places = "\n".join(f"- {x['id']}: {x.get('name')} ({x.get('look')})" for x in b.get("places", []))
    ends = "\n".join(f"- {e['id']} ({e.get('kind')}): {e.get('title')}: {e.get('what')} [how: {e.get('how')}]" for e in P.get("endings", []))
    return (f"THE BIBLE\nTitle: {P.get('title')}\nLogline: {b.get('logline')}\nHook: {b.get('hook')}\nTruth: {b.get('truth')}\n"
            f"Ladder: {' / '.join(b.get('ladder', []))}\nTone: {b.get('tone')}\nSetting: {b.get('setting')}\nThe player: {b.get('player')}\n"
            f"Starts at: {b.get('time')}\nKarma measures: {b.get('karma')}\nCast:\n{cast}\nPlaces:\n{places}\nEndings:\n{ends}")


def library_text(lib):
    return "LIBRARY FACES (id: what it's for):\n" + "\n".join(f"- {k}: {v.get('use', v.get('name'))}" for k, v in lib.items())


# ---- one request, checked, retried with its problems ---------------------------------------------------------------

def ask(backend, kind, user, schema, check, progress=None):
    """The backend's answer for a stage, passing `check` (a list of problems back): its problems go back to it, three tries."""
    msg, last = user, []
    for attempt in range(TRIES):
        if attempt and progress:
            progress(f"the {kind} again: {len(last)} problem{'s' if len(last) > 1 else ''} to fix")
        data = backend.ask(RULES, msg, llm.strict(schema), kind, progress)
        last = check(data)
        if not last:
            return data
        msg = user + "\n\nYour last answer had these problems. Fix them and answer again in full:\n- " + "\n- ".join(last[:25])
    raise llm.ModelError(f"the {kind} still has problems after {TRIES} tries: " + "; ".join(last[:6]))


def stage_errors(Q, keep):
    """The check's errors on a candidate, the ones this stage answers for (by what they're about)."""
    errs, _ = proto.check(Q)
    return [e for e in errs if any(k in e for k in keep)]


# ---- the stages ---------------------------------------------------------------------------------------------------

def stage_bible(P, backend, progress=None):
    user = (brief_text(P) + "\n\nWrite the bible: a working title; a one-line logline; the hook (why a player relates to it); "
            "the truth (what is really going on: the secret under everything); the ladder (5 to 8 steps from ordinary to the truth, "
            "each something the player sees or finds); the tone in a few words; the setting (where and when, concretely); who the "
            "player is; the time of day it starts; what karma measures in this story; the cast (2 to 5: id, name, she or he, role, "
            "look, what they want, what they hide, how their face gives them away); the places (4 to 8 rooms or spots the story "
            "uses: id, name, look). Then the three endings: keep the user's where they gave one (their idea, refined; by: user) "
            "and suggest the rest from the brief and the references (by: suggested); the first is the intended one (kind intended), "
            "the others kind other; each with id, title, what (the ending cutscene, two sentences) and how (how a player gets there).")

    def check(d):
        Q = dict(P, title=d.get("title") or P.get("title"), bible={k: v for k, v in d.items() if k not in ("endings", "title")}, endings=d.get("endings", []))
        errs = stage_errors(Q, ("cast", "place", "ending", "bible time"))
        if len(d.get("endings", [])) != 3:
            errs.append(f"{len(d.get('endings', []))} endings: exactly three")
        if not d.get("cast"):
            errs.append("no cast")
        if len(d.get("places", [])) < 2:
            errs.append("two places at least")
        return errs
    d = ask(backend, "bible", user, BIBLE, check, progress)
    P["title"] = d.pop("title") or P.get("title")
    P["endings"] = d.pop("endings")
    P["bible"] = d
    return P


def stage_endings(P, backend, progress=None):
    """Suggest the endings the user left empty (and refine the ones they gave), from the brief and the bible so far."""
    user = (brief_text(P) + ("\n\n" + bible_text(P) if P.get("bible") else "") + "\n\nWrite the three endings: keep the user's where "
            "they gave one (by: user), suggest the others from the brief, the references and the bible (by: suggested); the first "
            "is the intended one (kind intended), the others kind other; each with id, title, what (the ending cutscene, two "
            "sentences) and how (how a player gets there).")
    old = {e.get("id"): e for e in P.get("endings", [])}

    def check(d):
        e = d.get("endings", [])
        out = [] if len(e) == 3 else [f"{len(e)} endings: exactly three"]
        if sum(x.get("kind") == "intended" for x in e) != 1:
            out.append("exactly one intended ending")
        return out
    d = ask(backend, "endings", user, ENDINGS, check, progress)
    for e in d["endings"]:                              # a rule set already stays with its ending
        if e["id"] in old and old[e["id"]].get("rule"):
            e["rule"] = old[e["id"]]["rule"]
    P["endings"] = d["endings"]
    return P


def stage_river(P, backend, progress=None):
    minutes = (P.get("brief") or {}).get("minutes", 60)
    user = (brief_text(P) + "\n\n" + bible_text(P) + f"\n\nWrite the river for about {minutes} minutes. The acts (3 to 5: id a1, a2..., "
            "a title each). The main points in order (16 to 24: id p01, p02...; act; type scene, talk, task, chapter or choice; title; "
            "where (a place id); who (cast ids in it); minutes (2 to 5; a chapter 1 or 2); what happens (two or three sentences); "
            "player (what the player does)); a choice point that forks has fork: its question and two ways (id, label, sets: a "
            "flag that remembers the way, or empty; points: 1 to 3 points with the same fields, ids like p08a), the others fork "
            "null. Climb the ladder across the acts; plan the talks as close-ups. The secrets (3 to 6: id, after (the main point "
            "it leaves from, never the last), title, find (how it's found), shows (what it shows), achievement (its title)). The "
            "achievements (each secret's (for: secret:<id>), each ending's (for: ending:<id>), and one to three feats (for: "
            "feat); id, title, text (a hint that doesn't spoil), hidden). The endings' rules, one per ending by its id: by karma "
            "(the intended one min 2 or more, another max -2 or less, the last with neither: the rest) or by answer (a talk "
            "point's id and the answer id that leads there: a, b or c; only for a point that is a talk, usually the last). The "
            "main river's minutes add up to about the length.")

    def merge(d, Q):
        Q["acts"] = d.get("acts", [])
        Q["points"] = [dict(p, fork=(p.get("fork") or None)) for p in d.get("points", [])]
        Q["secrets"] = d.get("secrets", [])
        Q["achievements"] = d.get("achievements", [])
        rules = {r.get("id"): r for r in d.get("rules", [])}
        Q["endings"] = [dict(e, rule=rule_of(rules.get(e.get("id")))) for e in Q.get("endings", [])]
        return Q

    def check(d):
        Q = merge(d, json.loads(json.dumps(P)))
        errs = [e for e in stage_errors(Q, ("point", "act", "secret", "achievement", "ending", "fork"))
                if "answer " not in e or "isn't a talk's answer" not in e]   # the talks' answers come with the details
        for e in Q["endings"]:
            r = e.get("rule") or {}
            if r.get("by") == "answer":
                q, _, _ = proto.point_by_id(Q, r.get("point"))
                if not q or q.get("type") != "talk":
                    errs.append(f"ending {e['id']}: rule by answer at {r.get('point')!r}: that has to be a talk point")
            elif not r:
                errs.append(f"ending {e['id']}: no rule")
        n = len(Q["points"])
        if n < 8:
            errs.append(f"{n} main points: an hour's story has 16 to 24")
        m = proto.main_minutes(Q)
        if not proto.MINUTES[0] <= m <= proto.MINUTES[1]:
            errs.append(f"the main river is {m:.0f} minutes: make it about {minutes}")
        return errs
    d = ask(backend, "river", user, RIVER, check, progress)
    return merge(d, P)


def rule_of(r):
    if not r:
        return None
    if r.get("by") == "answer":
        return {"by": "answer", "point": r.get("point"), "option": r.get("option")}
    out = {"by": "karma"}
    for k in ("min", "max"):
        if r.get(k) is not None:
            out[k] = r[k]
    return out


def act_points(P, act):
    out = []
    for p in P.get("points", []):
        if p.get("act") == act:
            out.append(p)
            for w in ((p.get("fork") or {}).get("ways") or []):
                out += w.get("points", [])
    return out


def stage_details(P, backend, act, progress=None):
    """One act's details: each of its points' lines, talk, tasks and chapter, and any new faces."""
    lib = proto.library()
    pts = act_points(P, act)
    title = next((a.get("title") for a in P.get("acts", []) if a.get("id") == act), act)
    user = (bible_text(P) + "\n\nTHE RIVER\n" + proto.river_text(P) + "\n\n" + library_text(lib)
            + (("\nTHE PROTOTYPE'S OWN FACES: " + ", ".join(f"{f['id']} ({f.get('prompt')})" for f in P.get("faces", []))) if P.get("faces") else "")
            + f"\n\nTHE ACT: {act} ({title})\nIts points:\n" + "\n".join(proto.point_line(p) for p in pts)
            + "\n\nWrite each of these points' details (every point listed, by its id): shot (how it's framed from the player's eye: "
            "close for talks); lines (the key lines in order: who (a cast id), text (one sentence, 12 words at most), face (a face "
            "id); 2 to 8 for scenes and talks, none or one for tasks and chapters); talk (only for talk points, else null: line (her "
            "question or statement: who, text), listen (her face while she waits: a listening face), options (2 or 3 answers: id a, "
            "b, c; say (2 to 8 words); face (her face's answer: a tell); tell (what that face gives away); karma (-2 to 2); sets (a "
            "flag that remembers it, or empty)), reveals (what reading her faces here tells an attentive player)); tasks (only for "
            "task points, else empty: 1 to 4 to-do items: id, text (as the list says it), who (the cast id if someone asked, else "
            "empty), done (what ticks it, in words), fails (what fails it, or empty)); chapter (only for chapter points, else null: "
            "title (the card, like \"Saturday\" or \"Night 2\"), sub (a time like 22:10), time (day, dusk or night)). Faces: library "
            "ids when one fits; a new face only when needed, listed in faces (id, prompt, secs, loop, for: the cast id).")
    want = [p["id"] for p in pts]

    def merge(d, Q):
        by = {x.get("id"): x for x in d.get("points", [])}
        for p, _, _ in proto.all_points(Q):
            x = by.get(p.get("id"))
            if x:
                for k in ("shot", "lines", "talk", "tasks", "chapter"):
                    p[k] = x.get(k)
        have = {f["id"] for f in Q.get("faces", [])}
        Q.setdefault("faces", []).extend(f for f in d.get("faces", []) if f.get("id") not in have)
        return Q

    def check(d):
        Q = merge(d, json.loads(json.dumps(P)))
        got = {x.get("id") for x in d.get("points", [])}
        errs = [f"point {i}: missing (write every point listed)" for i in want if i not in got]
        mine = set(want) | {f.get("id") for f in d.get("faces", [])}
        errs += [e for e in proto.check(Q, lib)[0] if any(f"point {i}" in e or f"{i} " in e for i in mine) or e.startswith("face ")]
        for x in d.get("points", []):
            p, _, _ = proto.point_by_id(Q, x.get("id"))
            if p and p.get("type") == "talk" and not x.get("talk"):
                errs.append(f"point {x['id']}: a talk point needs its talk")
            if p and p.get("type") == "chapter" and not x.get("chapter"):
                errs.append(f"point {x['id']}: a chapter point needs its chapter")
        return errs
    d = ask(backend, "details", user, DETAILS, check, progress)
    return merge(d, P)


def draft(P, backend, progress=None, save=None, stages=("bible", "river", "details")):
    """The stages in order, the prototype saved after each (so the page shows them as they land)."""
    say = progress or (lambda m: None)
    if "bible" in stages:
        say("the bible: the hook, the truth, the cast, the places, the endings")
        stage_bible(P, backend, progress)
        save and save(P)
    if "river" in stages:
        say("the river: the acts, the points, the forks, the secrets")
        stage_river(P, backend, progress)
        save and save(P)
    if "details" in stages:
        for a in P.get("acts", []):
            say(f"the details of {a.get('title') or a['id']}: lines, talks and their faces, tasks")
            stage_details(P, backend, a["id"], progress)
            save and save(P)
    return P


# ---- the assistant ------------------------------------------------------------------------------------------------

CHAT_RULES = """

YOU ARE ALSO THE USER'S ASSISTANT IN THE WRITERS' ROOM. You see the prototype as JSON and what the user is looking at
(the view: which tab, which point is picked). Answer in `reply` (short, plain, like a co-writer) and make any changes in
`changes`, which are applied at once (the user can undo them):
- set: what (point, secret, ending, cast, place, face, achievement, act, bible, brief), id (the item's id; empty for the
  bible and the brief), field (one of the item's fields; empty to merge an object of fields), value_json (the new value
  as JSON: a string in quotes, an object, a list).
- add: what, after (for a point: the id of the point it comes after; else empty), value_json (the whole new item as a
  JSON object with its own new id).
- remove: what, id.   - move: what point, id, after (the point it goes after).
A question gets an answer and no changes. A change is made completely: a new talk point has its talk and faces; a new
secret has its achievement; ids stay unique; the story's rules above still hold. Don't change what the user didn't ask
about. Keep the reply under 120 words."""


def view_text(view):
    return json.dumps(view or {}, ensure_ascii=False)


def chat(P, message, view, backend, progress=None):
    """One turn: the assistant's reply and its changes, applied (the prototype passed in is left alone)."""
    lib = proto.library()
    slim = {k: v for k, v in P.items() if k not in ("chat", "created", "updated")}
    history = "\n".join(f"{m['role'].upper()}: {m['text']}" for m in (P.get("chat") or [])[-10:])
    user = ("THE PROTOTYPE (JSON):\n" + json.dumps(slim, ensure_ascii=False) + "\n\n" + library_text(lib)
            + "\n\nWHAT THE USER SEES: " + view_text(view)
            + ("\n\nTHE CONVERSATION SO FAR:\n" + history if history else "")
            + "\n\nTHE USER: " + message)
    tried = {}

    def check(d):
        Q, done, bad = proto.apply_changes(P, d.get("changes"))
        before = set(proto.check(P, lib)[0])
        new = [e for e in proto.check(Q, lib)[0] if e not in before]
        tried["result"] = (Q, done, bad)
        return bad + new
    d = ChatAsk(backend, user, check, progress).run()
    Q, done, bad = tried["result"]
    return d.get("reply", ""), Q, done, bad


class ChatAsk:
    """The chat's ask: the same retries, with the chat's own rules after the story's."""
    def __init__(self, backend, user, check, progress):
        self.backend, self.user, self.check, self.progress = backend, user, check, progress

    def run(self):
        msg, last = self.user, []
        for attempt in range(TRIES):
            if attempt and self.progress:
                self.progress(f"the changes again: {len(last)} problem{'s' if len(last) > 1 else ''} to fix")
            data = self.backend.ask(RULES + CHAT_RULES, msg, llm.strict(CHAT), "chat", self.progress)
            last = self.check(data)
            if not last:
                return data
            msg = self.user + "\n\nYour last changes had these problems (they weren't applied). Fix them and answer again:\n- " + "\n- ".join(last[:20])
        raise llm.ModelError("the changes still have problems: " + "; ".join(last[:5]))
