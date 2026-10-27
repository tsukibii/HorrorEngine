"""The writers' room's prototype (docs/WRITERS_ROOM.md §3): a game's story as you write it before the director, a
flowchart of shapes (the story's points, its choices, its secrets and its endings) joined by arrows, as plain data;
its check, the flow as text for Claude (room.py show), and the upgrade from the first format (the river the old
assistant drafted). Plain Python: the writers' room's server, its command line and Build use it.

    P = proto.load(proto.path_of("ticket-114"))
    errors, warnings = proto.check(P)
    print(proto.flow_text(P))
"""
import copy
import json
import re
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PROTOS = ROOT / "Content" / "Prototypes"
PROMPTS = ROOT / "Content" / "Studio" / "Expressions" / "prompts.json"
FORMAT = 2
POINTS = ("scene", "talk", "task", "chapter")            # the story's moments: one arrow on (and arrows to its secrets)
TYPES = ("start",) + POINTS + ("choice", "secret", "ending", "note")
BY = ("player", "karma", "answer")                         # what decides a choice: the player's act, karma, an answer
TIMES = ("day", "dusk", "night")
KINDS = ("intended", "other")
ID = re.compile(r"^[a-z][a-z0-9_]{0,40}$")
SESSION = re.compile(r"^[a-z0-9][a-z0-9-]{0,60}$")
MINUTES = (45, 75)          # an hour's game: a playthrough's minutes should land here (WRITERS_ROOM §2)
DEFAULT_MIN = {"scene": 3, "talk": 3, "task": 4, "chapter": 1}
ICON = {"start": "●", "scene": "▶", "talk": "◉", "task": "☐", "chapter": "☾", "choice": "◇", "secret": "★", "ending": "■", "note": "✎"}


def slug(text, n=6):
    w = re.findall(r"[a-z0-9]+", str(text).lower())
    return "-".join(w[:n]) or "untitled"


def path_of(sid):
    return PROTOS / sid / "prototype.json"


def now():
    return time.strftime("%Y-%m-%dT%H:%M:%S")


def blank(title, brief=None):
    """A new prototype: a title, a brief, and the start shape; the rest is yours to draw."""
    b = {"kind": "", "references": "", "notes": "", "minutes": 60}
    b.update({k: v for k, v in (brief or {}).items() if k in b})
    return {"format": FORMAT, "id": "", "title": title, "created": now(), "updated": now(), "brief": b,
            "story": {"logline": "", "hook": "", "truth": "", "ladder": [], "tone": "", "setting": "", "player": "", "time": "night", "karma": ""},
            "cast": [], "places": [], "nodes": [{"id": "start", "type": "start", "x": 40, "y": 240, "title": "Start"}],
            "edges": [], "frames": [], "faces": [], "feats": [], "built": None}


def new_session(title, brief=None):
    """A new session's folder under Content/Prototypes, named from the title (a number added when it's taken)."""
    base, n = slug(title), 1
    sid = base
    while path_of(sid).exists():
        n += 1
        sid = f"{base}-{n}"
    P = blank(title, brief)
    P["id"] = sid
    save(P)
    return P


def load(path):
    """A session from its file, in this format (the first format's river is upgraded as it's read)."""
    P = json.loads(Path(path).read_text(encoding="utf-8"))
    return upgrade(P) if P.get("format") == 1 else P


def save(P):
    P["updated"] = now()
    p = path_of(P["id"])
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(P, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(p)
    return p


def sessions():
    out = []
    for p in sorted(PROTOS.glob("*/prototype.json")) if PROTOS.is_dir() else []:
        try:
            P = load(p)
        except (OSError, ValueError, KeyError):
            continue
        lo, hi = minutes_range(P)
        out.append({"id": p.parent.name, "title": P.get("title", ""), "updated": P.get("updated", ""), "kind": P["brief"].get("kind", ""),
                    "points": sum(n.get("type") in POINTS for n in P.get("nodes", [])), "built": (P.get("built") or {}).get("game"),
                    "minutes": round(hi)})
    return sorted(out, key=lambda s: s["updated"], reverse=True)


# ---- the faces ---------------------------------------------------------------------------------------------------

def library():
    """The reusable expression prompts (Content/Studio/Expressions/prompts.json), by id."""
    try:
        return {p["id"]: p for p in json.loads(PROMPTS.read_text(encoding="utf-8"))["prompts"]}
    except (OSError, ValueError, KeyError):
        return {}


def face_of(P, fid, lib=None):
    """A face by id: the prototype's own, else the library's; None when neither has it."""
    for f in P.get("faces", []):
        if f.get("id") == fid:
            return f
    return (lib if lib is not None else library()).get(fid)


def for_subject(prompt, subject):
    """A she/her prompt for a he (the library's are written for she)."""
    if subject != "he":
        return prompt
    out = re.sub(r"\bher\b", "his", prompt)
    out = re.sub(r"\bherself\b", "himself", out)
    return re.sub(r"\bshe\b", "he", out)


FACE_RULES = [
    (lambda t: not t.strip(), "is empty"),
    (lambda t: t[:1].isupper(), "starts with a capital: it follows your own prompt, so lower case"),
    (lambda t: not t.rstrip().endswith("."), "doesn't end with a full stop"),
    (lambda t: len(t.split()) > 45, "is long for 4 seconds (45 words at most: two or three moves)"),
    (lambda t: re.search(r"[\"“”]|\b(says|said|speaks|talks|whispers|shouts|tells)\b", t), "has speech in it: the face only, silent"),
    (lambda t: re.search(r"\b(camera|zoom|pan|dolly|cut to|close-up|shot)\b", t, re.I), "moves the camera: the face only"),
    (lambda t: re.search(r"\b(feels|feeling)\b", t), "names a feeling: write what the face does"),
]


def face_problems(prompt):
    return [why for test, why in FACE_RULES if test(prompt or "")]


# ---- the graph ----------------------------------------------------------------------------------------------------

def nodes_of(P):
    return {n["id"]: n for n in P.get("nodes", []) if isinstance(n, dict) and n.get("id")}


def outs(P, nid):
    return [e for e in P.get("edges", []) if e.get("from") == nid]


def ins(P, nid):
    return [e for e in P.get("edges", []) if e.get("to") == nid]


def start_of(P):
    return next((n["id"] for n in P.get("nodes", []) if n.get("type") == "start" and n.get("id")), None)


def main_out(P, nid, N=None):
    """A point's (or the start's) arrows on: those not to a secret (a secret is a side stream, found after it)."""
    N = N or nodes_of(P)
    return [e for e in outs(P, nid) if (N.get(e.get("to")) or {}).get("type") != "secret"]


def reachable(P, frm=None, N=None):
    N = N or nodes_of(P)
    seen, todo = set(), [frm or start_of(P)]
    while todo:
        k = todo.pop()
        if k in seen or k not in N:
            continue
        seen.add(k)
        todo += [e.get("to") for e in outs(P, k)]
    return seen


def reading_order(P):
    """The shapes in the order the story reads: from the start along the arrows, a shape after every arrow into it,
    the left one first where two are ready (a chart read left to right); the rest (unreachable, or in a loop) after."""
    N = nodes_of(P)
    reach = reachable(P, N=N)
    indeg = {k: 0 for k in reach}
    for e in P.get("edges", []):
        if e.get("from") in reach and e.get("to") in indeg:
            indeg[e["to"]] += 1
    ready, out = [k for k in reach if indeg[k] == 0], []
    while ready:
        ready.sort(key=lambda k: (N[k].get("x", 0), N[k].get("y", 0)))
        k = ready.pop(0)
        out.append(k)
        for e in outs(P, k):
            t = e.get("to")
            if t in indeg:
                indeg[t] -= 1
                if indeg[t] == 0:
                    ready.append(t)
    rest = sorted((k for k, n in N.items() if k not in out and n.get("type") != "note"), key=lambda k: (N[k].get("x", 0), N[k].get("y", 0)))
    return out + rest


def frame_of(P, n):
    """The act frame a shape sits in (its middle inside the frame), or None."""
    cx, cy = float(n.get("x", 0)) + 100, float(n.get("y", 0)) + 40
    for f in P.get("frames", []):
        if f.get("x", 0) <= cx <= f.get("x", 0) + f.get("w", 0) and f.get("y", 0) <= cy <= f.get("y", 0) + f.get("h", 0):
            return f
    return None


def _paths_extremes(P, weight):
    """The least and the most a playthrough can add up to from the start to an ending, each shape counting
    weight(node) -> (low, high); secrets are side streams (not counted). A loop counts once."""
    N = nodes_of(P)
    memo = {}

    def go(k, path):
        if k in memo:
            return memo[k]
        if k in path or k not in N:
            return (0.0, 0.0)
        n = N[k]
        lo, hi = weight(n)
        nxt = [e.get("to") for e in outs(P, k) if (N.get(e.get("to")) or {}).get("type") != "secret"]
        if nxt:
            rs = [go(t, path | {k}) for t in nxt]
            lo, hi = lo + min(r[0] for r in rs), hi + max(r[1] for r in rs)
        memo[k] = (lo, hi)
        return memo[k]
    s = start_of(P)
    return go(s, frozenset()) if s else (0.0, 0.0)


def minutes_of(n):
    if n.get("type") not in POINTS:
        return 0.0
    m = n.get("minutes")
    return float(m if isinstance(m, (int, float)) else DEFAULT_MIN.get(n.get("type"), 0))


def minutes_range(P):
    """The shortest and the longest playthrough in minutes, by the shapes' minutes (secrets aside)."""
    m = _paths_extremes(P, lambda n: (minutes_of(n), minutes_of(n)))
    return round(m[0], 1), round(m[1], 1)


def karma_range(P):
    """The karma the talks' answers can add up to on the way through: (the kindest player's, the cruellest's)."""
    def w(n):
        ks = [float(o.get("karma") or 0) for o in (n.get("talk") or {}).get("options") or []] if n.get("type") == "talk" else []
        return (min(ks), max(ks)) if ks else (0.0, 0.0)
    lo, hi = _paths_extremes(P, w)
    return hi, lo


def faces_used(P):
    """Every face a shape names, where: [(face id, where it is, who)]."""
    out = []
    for n in P.get("nodes", []):
        for i, ln in enumerate(n.get("lines") or []):
            if ln.get("face"):
                out.append((ln["face"], f"{n['id']} line {i + 1}", ln.get("who")))
        t = n.get("talk") or {}
        who = (t.get("line") or {}).get("who") or (n.get("who") or [None])[0]
        if (t.get("line") or {}).get("face"):
            out.append((t["line"]["face"], f"{n['id']} the question", who))
        if t.get("listen"):
            out.append((t["listen"], f"{n['id']} listening", who))
        for o in t.get("options") or []:
            if o.get("face"):
                out.append((o["face"], f"{n['id']} answer {o.get('id')}", who))
    return out


# ---- the check ----------------------------------------------------------------------------------------------------

def check(P, lib=None):
    """(errors, warnings): what's wrong with the flow, each starting with the shape it's about (`talk p05: ...`), so the
    page can show it there. Errors stop Build; warnings are notes."""
    E, W = [], []
    lib = library() if lib is None else lib
    if P.get("format") != FORMAT:
        E.append(f"format {P.get('format')!r}: {FORMAT}")
    if not str(P.get("title", "")).strip():
        E.append("no title")
    cast = {c.get("id"): c for c in P.get("cast", [])}
    places = {x.get("id"): x for x in P.get("places", [])}
    ids = {}

    def own(kind, i):
        if not isinstance(i, str) or not ID.match(i):
            E.append(f"{kind} id {i!r}: lower case letters, digits and _ (a letter first)")
            return False
        if i in ids:
            E.append(f"{kind} {i}: the id is taken by a {ids[i]}")
            return False
        ids[i] = kind
        return True
    for c in P.get("cast", []):
        own("cast member", c.get("id"))
        if c.get("subject") not in ("she", "he"):
            E.append(f"cast {c.get('id')}: she or he")
    for x in P.get("places", []):
        own("place", x.get("id"))
    st = P.get("story") or {}
    if st.get("time", "night") not in TIMES:
        E.append(f"the story starts at {st.get('time')!r}: day, dusk or night")

    N = {}
    for n in P.get("nodes", []):
        t = n.get("type")
        if own("shape", n.get("id")):
            N[n["id"]] = n
        if t not in TYPES:
            E.append(f"shape {n.get('id')}: type {t!r} ({', '.join(TYPES)})")
    edge_ids, pairs = set(), set()
    for e in P.get("edges", []):
        a, b = e.get("from"), e.get("to")
        if not e.get("id") or e["id"] in edge_ids:
            E.append(f"arrow {e.get('id')!r}: every arrow has its own id")
        edge_ids.add(e.get("id"))
        if a not in N or b not in N:
            E.append(f"arrow {e.get('id')}: from {a!r} to {b!r}, but {'that' if a in N else a!r} isn't a shape")
            continue
        if a == b:
            E.append(f"{N[a]['type']} {a}: an arrow back into itself")
        if "note" in (N[a].get("type"), N[b].get("type")):
            E.append(f"note {a if N[a].get('type') == 'note' else b}: a note takes no arrows (it's for whoever reads the chart)")
        if b and N[b].get("type") == "start":
            E.append(f"start {b}: nothing leads into the start")
        if (a, b) in pairs:
            W.append(f"{N[a].get('type')} {a}: two arrows to {b}")
        pairs.add((a, b))

    starts = [k for k, n in N.items() if n.get("type") == "start"]
    if len(starts) != 1:
        E.append(f"{len(starts)} start shapes: one, where the story begins")
    talks = {k: n for k, n in N.items() if n.get("type") == "talk"}
    for k, n in N.items():
        t, where = n.get("type"), f"{n.get('type')} {k}"
        o, i = outs(P, k), ins(P, k)
        if t == "start":
            if len(o) != 1:
                E.append(f"{where}: one arrow from the start to where the story begins")
            elif N.get(o[0].get("to"), {}).get("type") == "secret":
                E.append(f"{where}: the story can't begin with a secret")
            continue
        if t == "note":
            continue
        if t in POINTS or t in ("choice", "secret", "ending"):
            if not str(n.get("title", "")).strip() and t != "ending":
                W.append(f"{where}: no title")
        if t in POINTS:
            main = [e for e in o if N.get(e.get("to"), {}).get("type") != "secret"]
            if not main:
                E.append(f"{where}: nothing comes after it: an arrow to what's next (another point, a choice or an ending)")
            elif len(main) > 1:
                E.append(f"{where}: {len(main)} arrows on: one way on from a {t} (a choice decides between ways)")
            if n.get("where") and n["where"] not in places:
                E.append(f"{where}: where {n['where']!r} isn't a place ({', '.join(places) or 'none yet: add them in Cast & places'})")
            for w_ in n.get("who") or []:
                if w_ not in cast:
                    E.append(f"{where}: who {w_!r} isn't in the cast")
            if n.get("minutes") is not None and (not isinstance(n["minutes"], (int, float)) or not 0 <= n["minutes"] <= 15):
                E.append(f"{where}: minutes {n['minutes']!r} (0 to 15)")
            for j, ln in enumerate(n.get("lines") or []):
                if ln.get("who") not in cast and ln.get("who") != "player":
                    E.append(f"{where} line {j + 1}: who {ln.get('who')!r} isn't in the cast")
                if len(str(ln.get("text", "")).split()) > 14:
                    W.append(f"{where} line {j + 1}: {len(str(ln.get('text', '')).split())} words: one sentence, 12 at most")
        if t == "talk":
            tk = n.get("talk") or {}
            opts = tk.get("options") or []
            if not opts:
                W.append(f"{where}: a talk without its answers yet (what you can say, and what her face does)")
            elif not 2 <= len(opts) <= 3:
                E.append(f"{where}: a talk has 2 or 3 answers, this one {len(opts)}")
            if len({x.get('id') for x in opts}) != len(opts):
                E.append(f"{where}: the answers need their own ids")
            if (tk.get("line") or {}).get("who") and tk["line"]["who"] not in cast:
                E.append(f"{where}: who asks, {tk['line']['who']!r}, isn't in the cast")
            for x in opts:
                if not str(x.get("say", "")).strip():
                    E.append(f"{where} answer {x.get('id')}: what the player says")
                elif len(str(x["say"]).split()) > 10:
                    W.append(f"{where} answer {x.get('id')}: {len(str(x['say']).split())} words: the player's answers are short")
                if not isinstance(x.get("karma", 0), (int, float)) or not -3 <= x.get("karma", 0) <= 3:
                    E.append(f"{where} answer {x.get('id')}: karma -3 to 3")
                if not x.get("tell") and not x.get("face"):
                    W.append(f"{where} answer {x.get('id')}: what her face does when you say it (the face answers before her words do)")
        if t == "task":
            if not n.get("tasks"):
                W.append(f"{where}: nothing on its to-do list yet")
            for x in n.get("tasks") or []:
                if not str(x.get("text", "")).strip():
                    E.append(f"{where}: a to-do without its text")
                if x.get("who") and x["who"] not in cast:
                    E.append(f"{where}: to-do {x.get('id')}: asked by {x['who']!r}, not in the cast")
        if t == "chapter":
            ch = n.get("chapter") or {}
            if ch.get("time") and ch["time"] not in TIMES:
                E.append(f"{where}: the chapter's time {ch['time']!r}: day, dusk or night")
        if t == "choice":
            by = n.get("by", "player")
            if by not in BY:
                E.append(f"{where}: decided by {by!r} (the player, karma or an answer)")
            if len(o) < 2:
                E.append(f"{where}: a choice has two ways on or more (an arrow for each)")
            for e in o:
                if N.get(e.get("to"), {}).get("type") == "secret":
                    E.append(f"{where}: a secret is found after a point (a scene, a talk, a task or a chapter), not a choice")
            wh = [(e, e.get("when") or {}) for e in o]
            if by == "player":
                for e, _ in wh:
                    if not str(e.get("label", "")).strip():
                        W.append(f"{where}: the arrow to {e.get('to')} has no label (what the player does to go that way)")
            if by == "karma":
                rest = [e for e, w in wh if w.get("min") is None and w.get("max") is None]
                if len(o) >= 2 and len(rest) != 1:
                    E.append(f"{where}: by karma, one arrow is for the rest (neither at least nor at most), and the others say their karma")
                for e, w in wh:
                    for b_ in ("min", "max"):
                        if w.get(b_) is not None and not isinstance(w[b_], (int, float)):
                            E.append(f"{where}: the arrow to {e.get('to')}: karma {b_} {w[b_]!r} isn't a number")
                bounds = [(w.get("min"), w.get("max")) for e, w in wh if e not in rest]
                if len(set(bounds)) != len(bounds):
                    E.append(f"{where}: two arrows with the same karma: the second is never taken")
            if by == "answer":
                rest = [e for e, w in wh if not w.get("talk")]
                if len(o) >= 2 and len(rest) != 1:
                    E.append(f"{where}: by an answer, one arrow is for the rest (no answer named), and the others name a talk's answer")
                for e, w in wh:
                    if w.get("talk"):
                        tk = talks.get(w["talk"])
                        if not tk:
                            E.append(f"{where}: the arrow to {e.get('to')} names {w['talk']!r}, which isn't a talk")
                        elif not any(x.get("id") == w.get("answer") for x in (tk.get("talk") or {}).get("options") or []):
                            E.append(f"{where}: the arrow to {e.get('to')} names answer {w.get('answer')!r} of {w['talk']}, which it hasn't")
                        elif w["talk"] not in reachable(P, w["talk"]) or k not in reachable(P, w["talk"]):
                            E.append(f"{where}: talk {w['talk']} isn't on the way here: its answer can't decide this")
        if t == "secret":
            src = [e for e in i]
            if len(src) != 1:
                E.append(f"{where}: one arrow in, from the point it's found after")
            elif N.get(src[0].get("from"), {}).get("type") not in POINTS:
                E.append(f"{where}: it's found after a point (a scene, a talk, a task or a chapter)")
            if len(o) != 1:
                E.append(f"{where}: one arrow out, to where the story picks up")
            elif N.get(o[0].get("to"), {}).get("type") in ("secret", "start", "note", None):
                E.append(f"{where}: the story picks up at a point, a choice or an ending")
            elif len(src) == 1:
                back, mains = o[0]["to"], main_out(P, src[0].get("from"), N)
                if mains and back != mains[0].get("to") and back not in reachable(P, mains[0].get("to"), N):
                    W.append(f"{where}: it doesn't rejoin the story: where it picks up ({back}) isn't on the way on from {src[0].get('from')}")
            if not (n.get("achievement") or {}).get("title"):
                W.append(f"{where}: no achievement (a secret unlocks one)")
            if not str(n.get("find", "")).strip():
                W.append(f"{where}: how it's found")
        if t == "ending":
            if o:
                E.append(f"{where}: an ending has no arrows out")
            if n.get("kind", "other") not in KINDS:
                E.append(f"{where}: intended or other")
            if not str(n.get("title", "")).strip():
                W.append(f"{where}: no title")
    # reachable, and one way: no loops
    reach = reachable(P, N=N) if starts else set()
    for k, n in N.items():
        if n.get("type") not in ("note", "start") and k not in reach and starts:
            W.append(f"{n.get('type')} {k}: nothing leads here from the start")
    color, looped = {}, set()

    def visit(k):
        color[k] = 1
        for e in outs(P, k):
            t = e.get("to")
            if t not in N:
                continue
            if color.get(t) == 1 and t not in looped:
                looped.add(t)
                E.append(f"{N[t].get('type')} {t}: the flow loops back here from {k}: the story goes one way (draw it on, not back)")
            elif not color.get(t):
                visit(t)
        color[k] = 2
    for k in starts:
        visit(k)
    # the endings: three by default, one intended
    ends = [n for n in N.values() if n.get("type") == "ending"]
    if any(n.get("type") in POINTS for n in N.values()):
        if not ends:
            W.append("no endings yet: three by default (the intended one and two others)")
        elif len(ends) != 3:
            W.append(f"{len(ends)} endings: three by default (the intended one and two others)")
        if ends and sum(n.get("kind") == "intended" for n in ends) != 1:
            W.append("one ending is the intended one")
    # faces, feats, achievements
    for f in P.get("faces", []):
        own("face", f.get("id"))
        for why in face_problems(f.get("prompt", "")):
            W.append(f"face {f.get('id')}: the prompt {why}")
    for fid, where, who in faces_used(P):
        if face_of(P, fid, lib) is None:
            E.append(f"{where.split()[0] if where.split()[0] not in N else N[where.split()[0]].get('type')} {where}: face {fid!r} isn't in the library or the story's faces")
    for a in P.get("feats", []):
        own("feat", a.get("id"))
        if not str(a.get("title", "")).strip():
            W.append(f"feat {a.get('id')}: no title")
    # the time: about an hour
    lo, hi = minutes_range(P)
    if ends and any(n.get("type") in POINTS for n in N.values()) and (lo < MINUTES[0] or hi > MINUTES[1]):
        W.append(f"a playthrough is {lo:.0f} to {hi:.0f} minutes by the shapes' minutes: an hour's game is {MINUTES[0]} to {MINUTES[1]}")
    # karma: the bounds the answers can reach
    if talks and all((n.get("talk") or {}).get("options") for n in talks.values()):
        kind, cruel = karma_range(P)
        for k, n in N.items():
            if n.get("type") != "choice" or n.get("by") != "karma":
                continue
            for e in outs(P, k):
                w = e.get("when") or {}
                if isinstance(w.get("min"), (int, float)) and (w["min"] > kind or w["min"] <= 0):
                    W.append(f"choice {k}: the arrow to {e.get('to')} needs karma {w['min']:g} or more: the kindest answers add up to {kind:g}, "
                             f"and a player who says nothing has 0 (the rest's): between 1 and {kind:g} (Build moves it there)")
                if isinstance(w.get("max"), (int, float)) and (w["max"] < cruel or w["max"] >= 0):
                    W.append(f"choice {k}: the arrow to {e.get('to')} needs karma {w['max']:g} or less: the cruellest answers add up to {cruel:g}, "
                             f"and a player who says nothing has 0: between {cruel:g} and -1 (Build moves it there)")
    return E, W


# ---- the text view (for Claude: room.py show, now) ----------------------------------------------------------------

def when_text(n, e):
    w = e.get("when") or {}
    if n.get("by") == "karma":
        if w.get("min") is not None and w.get("max") is not None:
            return f"karma {w['min']:g} to {w['max']:g}"
        return f"karma ≥ {w['min']:g}" if w.get("min") is not None else f"karma ≤ {w['max']:g}" if w.get("max") is not None else "the rest"
    if n.get("by") == "answer":
        return f"said {w.get('talk')}/{w.get('answer')}" if w.get("talk") else "the rest"
    return e.get("label") or "?"


def node_text(P, n, N=None, detail=True):
    N = N or nodes_of(P)
    t, k = n.get("type"), n.get("id")
    head = f"{ICON.get(t, '?')} {k} {t}" + (f" “{n.get('title')}”" if n.get("title") else "")
    bits = []
    if t in POINTS:
        bits.append(f"{minutes_of(n):g} min")
        if n.get("where"):
            bits.append(n["where"])
        if n.get("who"):
            bits.append(", ".join(n["who"]))
    if t == "choice":
        bits.append({"player": "the player decides", "karma": "karma decides", "answer": "an answer decides"}.get(n.get("by", "player"), ""))
    if t == "ending":
        bits.append(n.get("kind", "other"))
    out = [head + (f" ({'; '.join(b for b in bits if b)})" if bits else "")]
    pad = "    "
    if n.get("text"):
        out.append(pad + str(n["text"]))
    for key, label in (("player", "the player"), ("shot", "the shot"), ("question", "asks"), ("find", "found"), ("shows", "shows"), ("how", "how you get here")):
        if detail and n.get(key):
            out.append(f"{pad}{label}: {n[key]}")
    if detail:
        for ln in n.get("lines") or []:
            out.append(f"{pad}{ln.get('who')}: “{ln.get('text', '')}”" + (f" [{ln['face']}]" if ln.get("face") else ""))
        tk = n.get("talk")
        if tk:
            ln = tk.get("line") or {}
            out.append(f"{pad}asks ({ln.get('who', '?')}): “{ln.get('text', '')}”" + (f" listening [{tk['listen']}]" if tk.get("listen") else ""))
            for o in tk.get("options") or []:
                out.append(f"{pad}  [{o.get('id')}] “{o.get('say', '')}” karma {o.get('karma', 0)}" + (f", sets {o['sets']}" if o.get("sets") else "")
                           + (f" → [{o['face']}]" if o.get("face") else "") + (f" {o['tell']}" if o.get("tell") else ""))
            if tk.get("reveals"):
                out.append(f"{pad}reveals: {tk['reveals']}")
        for x in n.get("tasks") or []:
            out.append(f"{pad}☐ {x.get('text', '')}" + (f" (asked by {x['who']})" if x.get("who") else "") + (f"; done: {x['done']}" if x.get("done") else "")
                       + (f"; fails: {x['fails']}" if x.get("fails") else ""))
        ch = n.get("chapter")
        if ch:
            out.append(f"{pad}card: {ch.get('title', '')}" + (f" · {ch['sub']}" if ch.get("sub") else "") + (f" ({ch['time']} from here)" if ch.get("time") else ""))
        a = n.get("achievement") or {}
        if a.get("title"):
            out.append(f"{pad}achievement: {a['title']}" + (f": {a['text']}" if a.get("text") else "") + (" (hidden)" if a.get("hidden") else ""))
        if n.get("notes"):
            out.append(f"{pad}note for Claude: {n['notes']}")
    for e in outs(P, k):
        to = N.get(e.get("to")) or {}
        if t == "choice":
            out.append(f"{pad}⑂ [{when_text(n, e)}] → {e.get('to')}" + (f" (sets {e['sets']})" if e.get("sets") else ""))
        elif to.get("type") == "secret":
            out.append(f"{pad}★ if found → {e.get('to')}")
        else:
            out.append(f"{pad}→ {e.get('to')}" + (f" ({e['label']})" if e.get("label") else ""))
    return "\n".join(out)


def flow_text(P, detail=True):
    """The whole story as text: the brief and the story's heart, the cast and places, then every shape in reading
    order under its act, with its arrows; the notes and the feats."""
    N, st, out = nodes_of(P), P.get("story") or {}, []
    lo, hi = minutes_range(P)
    out.append(f"{P.get('title', '')}  ({sum(n.get('type') in POINTS for n in N.values())} points, {len(P.get('edges', []))} arrows; "
               f"a playthrough {lo:.0f} to {hi:.0f} min)")
    b = P.get("brief") or {}
    for k, label in (("kind", "KIND"), ("references", "REFERENCES"), ("notes", "NOTES")):
        if str(b.get(k, "")).strip():
            out.append(f"{label} {b[k]}")
    for k, label in (("logline", "LOGLINE"), ("hook", "HOOK"), ("truth", "TRUTH"), ("tone", "TONE"), ("setting", "SETTING"), ("player", "THE PLAYER"),
                     ("karma", "KARMA MEANS")):
        if str(st.get(k, "")).strip():
            out.append(f"{label} {st[k]}")
    if st.get("time"):
        out.append(f"STARTS AT {st['time']}")
    if st.get("ladder"):
        out.append("LADDER " + " / ".join(f"{i + 1}. {x}" for i, x in enumerate(st["ladder"])))
    if P.get("cast"):
        out.append("CAST " + "; ".join(f"{c['id']}: {c.get('name', '')} ({c.get('subject', 'she')}), {c.get('role', '')}"
                                         + (f"; tells: {c['tells']}" if detail and c.get("tells") else "") for c in P["cast"]))
    if P.get("places"):
        out.append("PLACES " + "; ".join(f"{x['id']} ({x.get('name', '')})" + (f": {x['look']}" if detail and x.get("look") else "") for x in P["places"]))
    act = None
    for k in reading_order(P):
        n = N[k]
        f = frame_of(P, n)
        fid = f.get("id") if f else None
        if fid != act:
            act = fid
            out.append(f"\n[{f.get('id')}] {f.get('title', '')}" if f else "\n[outside the acts]")
        out.append(node_text(P, n, N, detail))
    notes = [n for n in N.values() if n.get("type") == "note"]
    if notes:
        out.append("\nNOTES")
        for n in notes:
            near = min((m for m in N.values() if m.get("type") != "note"), key=lambda m: (m.get("x", 0) - n.get("x", 0)) ** 2 + (m.get("y", 0) - n.get("y", 0)) ** 2, default=None)
            out.append(f"  ✎ {n.get('text', '')}" + (f" (near {near['id']})" if near else ""))
    if P.get("feats"):
        out.append("\nFEATS " + "; ".join(f"{a.get('title')}: {a.get('text', '')}" for a in P["feats"]))
    return "\n".join(out)


# ---- the first format (the river the assistant drafted), upgraded --------------------------------------------------

STEP, ROW, SEC = 250, 180, 200          # the chart's spacing: one shape to the next, a way below, a secret above


def upgrade(P1):
    """A first-format prototype (points in order, forks, secrets after a point, endings by rules) as this format's
    chart: each act a row read left to right (as lines of text), a fork's other ways below its row, the secrets above,
    the endings fanned out after a choice by karma (or by an answer), the acts as frames round their shapes."""
    P1 = copy.deepcopy(P1)
    b1, bible = P1.get("brief") or {}, P1.get("bible") or {}
    P = blank(P1.get("title", ""), {k: b1.get(k) for k in ("kind", "references", "notes", "minutes") if b1.get(k) is not None})
    ideas = [x for x in b1.get("endings") or [] if str(x).strip()]
    if ideas:
        P["brief"]["notes"] = (P["brief"]["notes"] + "\n\n" if P["brief"]["notes"] else "") + "Endings I had in mind: " + " / ".join(ideas)
    for k in ("id", "created", "built", "faces"):
        if k in P1:
            P[k] = P1[k]
    P["story"].update({k: bible[k] for k in ("logline", "hook", "truth", "ladder", "tone", "setting", "player", "time", "karma") if bible.get(k)})
    P["cast"], P["places"] = bible.get("cast", []), bible.get("places", [])
    achs = {str(a.get("for", "")): a for a in P1.get("achievements", [])}
    P["feats"] = [{k: a.get(k) for k in ("id", "title", "text", "hidden")} for a in P1.get("achievements", []) if a.get("for", "feat") == "feat"]
    # the rows: an act each, its secrets above its points, a fork's other ways below them
    order, extra = [], {}
    for p in P1.get("points", []):
        a = p.get("act")
        if a not in order:
            order.append(a)
        ways = (p.get("fork") or {}).get("ways") or []
        extra[a] = max(extra.get(a, 0), len(ways) - 1 if p.get("type") == "choice" else 0)
    row_y, y = {}, 0
    for a in order:
        row_y[a] = y + SEC + 60
        y = row_y[a] + 150 + ROW * extra.get(a, 0) + 120
    Y0 = row_y.get(order[0] if order else None, 260)
    nodes, edges, at = [P["nodes"][0]], [], {}
    nodes[0].update({"x": 40, "y": Y0})
    eid = [0]

    def arrow(a, b, **kw):
        eid[0] += 1
        edges.append(dict({"id": f"a{eid[0]}", "from": a, "to": b}, **kw))

    def shape(p, x, y, as_type=None):
        n = {k: v for k, v in p.items() if k not in ("fork", "act", "what") and v not in (None, [], "")}
        n.update({"type": as_type or p.get("type"), "x": x, "y": y, "text": p.get("what", "")})
        nodes.append(n)
        at[n["id"]] = (x, y)
        return n["id"]
    x, prev, member, fork_last, act = 40 + STEP, ["start"], {}, {}, (order or [None])[0]   # member: a shape -> its act
    for p in P1.get("points", []):
        if p.get("act") != act:                     # a new act: a new row, from the left
            act, x = p.get("act"), 40 + STEP
        Y0 = row_y.get(act, Y0)
        fk = p.get("fork") or {}
        ways = fk.get("ways") or []
        if p.get("type") == "choice" and ways:     # a fork: its moment (if it has lines), the choice, its ways below
            head = None
            if p.get("lines"):
                head = shape(p, x, Y0, "scene")
                x += STEP
            cid = shape({"id": f"{p['id']}_choice" if head else p["id"], "title": fk.get("question") or p.get("title", ""), "what": p.get("what", "")},
                        x, Y0, "choice")
            nodes[-1].update({"by": "player", "question": fk.get("question", "")})
            for a in prev:
                arrow(a, head or cid)
            if head:
                arrow(head, cid)
            ends, longest = [], 0
            for j, w in enumerate(ways):
                last = None
                for q, wp in enumerate(w.get("points") or []):
                    sid = shape(wp, x + STEP * (q + 1), Y0 + ROW * j)
                    member[sid] = p.get("act")
                    if last is None:
                        arrow(cid, sid, label=w.get("label", ""), **({"sets": w["sets"]} if w.get("sets") else {}))
                    else:
                        arrow(last, sid)
                    last = sid
                longest = max(longest, len(w.get("points") or []))
                if last:
                    ends.append(last)
            for k in ([head] if head else []) + [cid]:
                member[k] = p.get("act")
            if ends:
                fork_last[p["id"]] = ends[0]
            prev, x = ends, x + STEP * (longest + 1)
            continue
        sid = shape(p, x, Y0, "scene" if p.get("type") == "choice" else None)
        member[sid] = p.get("act")
        for a in prev:
            arrow(a, sid)
        prev, x = [sid], x + STEP
    # the endings: a choice by an answer (if any decides one), then by karma, the endings fanned out after it
    ends = P1.get("endings", [])
    by_answer = [e for e in ends if (e.get("rule") or {}).get("by") == "answer"]
    by_karma = [e for e in ends if e not in by_answer]
    ex = x + STEP * (2 if by_answer and by_karma else 1)
    for j, e in enumerate(ends):
        a = achs.get(f"ending:{e['id']}") or {}
        nodes.append({"id": e["id"], "type": "ending", "x": ex, "y": Y0 + ROW * (j - (len(ends) - 1) / 2), "title": e.get("title", ""),
                      "kind": e.get("kind", "other"), "text": e.get("what", ""), "how": e.get("how", ""),
                      "achievement": {"title": a.get("title", ""), "text": a.get("text", ""), "hidden": bool(a.get("hidden", True))}})
    if ends:
        chooser = []
        if by_answer:
            nodes.append({"id": "the_last_answer" if by_karma else "how_it_ends", "type": "choice", "x": x, "y": Y0, "by": "answer",
                          "title": "The last answer", "question": "What the player said decides"})
            chooser.append(nodes[-1]["id"])
        if by_karma:
            nodes.append({"id": "how_it_ends", "type": "choice", "x": x + (STEP if by_answer else 0), "y": Y0, "by": "karma",
                          "title": "How it ends", "question": "What the answers added up to"})
            chooser.append(nodes[-1]["id"])
        for a in prev:
            arrow(a, chooser[0])
        if by_answer:
            for e in by_answer:
                r = e["rule"]
                arrow(chooser[0], e["id"], when={"talk": r.get("point"), "answer": r.get("option")})
            if by_karma:
                arrow(chooser[0], chooser[1], when={})
            else:
                edges[-1]["when"] = {}
        if by_karma:
            bounded = [e for e in by_karma if (e.get("rule") or {}).get("min") is not None or (e.get("rule") or {}).get("max") is not None]
            for e in bounded + [e for e in by_karma if e not in bounded]:
                r = e.get("rule") or {}
                arrow(chooser[-1], e["id"], when={k: r[k] for k in ("min", "max") if r.get(k) is not None})
    for k in [n["id"] for n in nodes if n.get("type") == "ending" or n["id"] in ("how_it_ends", "the_last_answer")]:
        member[k] = order[-1] if order else None   # the endings close the last act
    # secrets: above the point they're found after, back where its arrow on goes
    kinds, stacked = {n["id"]: n["type"] for n in nodes}, {}
    for s in P1.get("secrets", []):
        a = s.get("after")
        a = fork_last.get(a, a)                     # found after a fork: at the end of its first way
        if kinds.get(a) not in POINTS:
            continue
        back = next((e["to"] for e in edges if e["from"] == a and kinds.get(e["to"]) != "secret"), None)
        k = stacked[a] = stacked.get(a, -1) + 1
        ax, _ = at[a]
        an = next(n for n in nodes if n["id"] == a)
        nodes.append({"id": s["id"], "type": "secret", "x": ax + STEP // 2, "y": an["y"] - SEC - 150 * k, "title": s.get("title", ""),
                      "find": s.get("find", ""), "shows": s.get("shows", ""),
                      "achievement": {"title": s.get("achievement") or (achs.get(f"secret:{s['id']}") or {}).get("title", ""),
                                      "text": (achs.get(f"secret:{s['id']}") or {}).get("text", ""), "hidden": bool((achs.get(f"secret:{s['id']}") or {}).get("hidden"))}})
        kinds[s["id"]] = "secret"
        member[s["id"]] = member.get(a)
        arrow(a, s["id"])
        if back:
            arrow(s["id"], back)
    # the acts: a frame round each act's shapes
    frames = []
    pos = {n["id"]: n for n in nodes}
    for act in P1.get("acts", []):
        ks = [k for k, a in member.items() if a == act.get("id") and k in pos]
        if not ks:
            continue
        xs, ys = [pos[k]["x"] for k in ks], [pos[k]["y"] for k in ks]
        frames.append({"id": act["id"], "title": act.get("title", ""), "x": min(xs) - 30, "y": min(ys) - 60, "w": max(xs) - min(xs) + 260,
                       "h": max(ys) - min(ys) + 190, "color": ["#8a63d2", "#3f8fc9", "#c98a2b", "#4fae7c", "#c0473f"][len(frames) % 5]})
    P.update({"nodes": nodes, "edges": edges, "frames": frames})
    return P
