"""The writers' room's prototype (docs/WRITERS_ROOM.md §4): a game's story before the director, as plain data, its
check, a compact text of it (for the assistant and for Claude Code), and the assistant's changes applied to it.
Plain Python: the writers' room's server, its command line and the build use it.

    P = proto.load(proto.path_of("the-visit"))
    errors, warnings = proto.check(P)
    print(proto.river_text(P))
"""
import copy
import json
import re
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PROTOS = ROOT / "Content" / "Prototypes"
PROMPTS = ROOT / "Content" / "Studio" / "Expressions" / "prompts.json"
FORMAT = 1
TYPES = ("scene", "talk", "task", "chapter", "choice")
TIMES = ("day", "dusk", "night")
KINDS = ("intended", "other")
ID = re.compile(r"^[a-z][a-z0-9_]{0,40}$")
SESSION = re.compile(r"^[a-z0-9][a-z0-9-]{0,60}$")
MINUTES = (45, 75)          # an hour's game: the main river's minutes should land here (WRITERS_ROOM §2)
WHAT = ("point", "secret", "ending", "cast", "place", "bible", "face", "achievement", "act", "brief")


def slug(text, n=6):
    w = re.findall(r"[a-z0-9]+", str(text).lower())
    return "-".join(w[:n]) or "untitled"


def path_of(sid):
    return PROTOS / sid / "prototype.json"


def now():
    return time.strftime("%Y-%m-%dT%H:%M:%S")


def blank(title, brief=None):
    """A new prototype: a title and a brief; the rest comes from the drafting stages (or by hand)."""
    b = {"kind": "", "references": "", "notes": "", "endings": ["", "", ""], "minutes": 60}
    b.update(brief or {})
    return {"format": FORMAT, "id": "", "title": title, "created": now(), "updated": now(), "brief": b,
            "bible": {}, "endings": [], "acts": [], "points": [], "secrets": [], "achievements": [], "faces": [],
            "notes": [], "chat": [], "built": None}


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
    return json.loads(Path(path).read_text(encoding="utf-8"))


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
        except (OSError, ValueError):
            continue
        out.append({"id": p.parent.name, "title": P.get("title", ""), "updated": P.get("updated", ""), "kind": P["brief"].get("kind", ""),
                    "points": len(P.get("points", [])), "built": (P.get("built") or {}).get("game"), "minutes": round(main_minutes(P))})
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


# ---- walking the river --------------------------------------------------------------------------------------------

def all_points(P):
    """Every point: the main river's, then each fork's ways' (with the fork point and the way they belong to)."""
    out = []
    for p in P.get("points", []):
        out.append((p, None, None))
        for w in ((p.get("fork") or {}).get("ways") or []):
            for q in w.get("points", []):
                out.append((q, p, w))
    return out


def point_by_id(P, pid):
    for p, fork, way in all_points(P):
        if p.get("id") == pid:
            return p, fork, way
    return None, None, None


def main_minutes(P):
    """The main river's minutes on the way through: each point's, a fork counted by its longest way."""
    total = 0.0
    for p in P.get("points", []):
        total += float(p.get("minutes") or 0)
        ways = (p.get("fork") or {}).get("ways") or []
        if ways:
            total += max(sum(float(q.get("minutes") or 0) for q in w.get("points", [])) for w in ways)
    return total


def karma_range(P):
    """The karma the talks' answers can add up to on the way through: (the kindest player's, the cruellest's); a fork
    counts its kindest way for the one and its cruellest for the other."""
    def of(points):
        hi = lo = 0.0
        for p in points:
            ks = [float(o.get("karma") or 0) for o in (p.get("talk") or {}).get("options") or []]
            if ks:
                hi, lo = hi + max(ks), lo + min(ks)
            ways = (p.get("fork") or {}).get("ways") or []
            if ways:
                r = [of(w.get("points") or []) for w in ways]
                hi, lo = hi + max(x[0] for x in r), lo + min(x[1] for x in r)
        return hi, lo
    return of(P.get("points", []))


def faces_used(P):
    """Every face a point names, where: [(face id, where it is, who)]."""
    out = []
    for p, fork, way in all_points(P):
        for i, ln in enumerate(p.get("lines") or []):
            if ln.get("face"):
                out.append((ln["face"], f"{p['id']} line {i + 1}", ln.get("who")))
        t = p.get("talk") or {}
        who = (t.get("line") or {}).get("who") or (p.get("who") or [None])[0]
        if t.get("listen"):
            out.append((t["listen"], f"{p['id']} listening", who))
        for o in t.get("options") or []:
            if o.get("face"):
                out.append((o["face"], f"{p['id']} answer {o.get('id')}", who))
    return out


# ---- the check ----------------------------------------------------------------------------------------------------

def check(P, lib=None):
    """(errors, warnings): what's wrong with the prototype, by where it is."""
    E, W = [], []
    lib = library() if lib is None else lib
    if P.get("format") != FORMAT:
        E.append(f"format {P.get('format')!r}: {FORMAT}")
    if not str(P.get("title", "")).strip():
        E.append("no title")
    b = P.get("bible") or {}
    cast = {c.get("id"): c for c in b.get("cast", [])}
    places = {x.get("id"): x for x in b.get("places", [])}
    ids = {}

    def own(kind, i):
        if not isinstance(i, str) or not ID.match(i):
            E.append(f"{kind} id {i!r}: lower case letters, digits and _ (a letter first)")
        elif i in ids:
            E.append(f"{kind} {i}: the id is taken by a {ids[i]}")
        else:
            ids[i] = kind
    for c in b.get("cast", []):
        own("cast member", c.get("id"))
        if c.get("subject") not in ("she", "he"):
            E.append(f"cast {c.get('id')}: subject she or he")
    for x in b.get("places", []):
        own("place", x.get("id"))
    if b and b.get("time", "night") not in TIMES:
        E.append(f"bible time {b.get('time')!r}: {', '.join(TIMES)}")
    acts = [a.get("id") for a in P.get("acts", [])]
    for a in P.get("acts", []):
        own("act", a.get("id"))

    # the endings: three, one intended, each with a rule
    ends = P.get("endings", [])
    for e in ends:
        own("ending", e.get("id"))
        if e.get("kind") not in KINDS:
            E.append(f"ending {e.get('id')}: kind intended or other")
        if not e.get("title"):
            E.append(f"ending {e.get('id')}: no title")
    if P.get("points"):
        if len(ends) != 3:
            W.append(f"{len(ends)} endings: three by default (the intended one and two others)")
        if sum(e.get("kind") == "intended" for e in ends) != 1:
            E.append("one ending is the intended one")

    # the points
    for p, fork, way in all_points(P):
        pid = p.get("id")
        own("point", pid)
        where = f"point {pid}" + (f" (fork {fork['id']}, way {way.get('id')})" if fork else "")
        if p.get("type") not in TYPES:
            E.append(f"{where}: type {p.get('type')!r} ({', '.join(TYPES)})")
        if not fork and acts and p.get("act") not in acts:
            E.append(f"{where}: act {p.get('act')!r} isn't one of the acts")
        if p.get("where") and places and p["where"] not in places:
            E.append(f"{where}: where {p['where']!r} isn't a place ({', '.join(places)})")
        for w in p.get("who") or []:
            if cast and w not in cast:
                E.append(f"{where}: who {w!r} isn't in the cast")
        if not isinstance(p.get("minutes", 0), (int, float)) or not 0 <= float(p.get("minutes") or 0) <= 15:
            E.append(f"{where}: minutes {p.get('minutes')!r} (0 to 15)")
        if not p.get("title"):
            E.append(f"{where}: no title")
        for i, ln in enumerate(p.get("lines") or []):
            if ln.get("who") not in cast and ln.get("who") != "player":
                E.append(f"{where} line {i + 1}: who {ln.get('who')!r} isn't in the cast")
            if len(str(ln.get("text", "")).split()) > 14:
                W.append(f"{where} line {i + 1}: {len(str(ln.get('text', '')).split())} words: one sentence, 12 at most")
        t = p.get("talk")
        if t:
            opts = t.get("options") or []
            if not 2 <= len(opts) <= 3:
                E.append(f"{where}: a talk has 2 or 3 answers, this one {len(opts)}")
            if len({o.get('id') for o in opts}) != len(opts):
                E.append(f"{where}: the talk's answers need their own ids")
            for o in opts:
                if not o.get("say"):
                    E.append(f"{where} answer {o.get('id')}: what the player says (say)")
                elif len(str(o["say"]).split()) > 10:
                    W.append(f"{where} answer {o.get('id')}: {len(o['say'].split())} words: the player's answers are short")
                if not o.get("face"):
                    E.append(f"{where} answer {o.get('id')}: her face's answer (face)")
                if not o.get("tell"):
                    W.append(f"{where} answer {o.get('id')}: what her face gives away (tell)")
                if not isinstance(o.get("karma", 0), (int, float)) or not -3 <= o.get("karma", 0) <= 3:
                    E.append(f"{where} answer {o.get('id')}: karma -3 to 3")
            if p.get("type") != "talk":
                W.append(f"{where}: has a talk but is a {p.get('type')}")
        elif p.get("type") == "talk" and P.get("acts") and p.get("lines") is not None:
            W.append(f"{where}: a talk without its talk (the line, the answers, her faces)")
        for k in p.get("tasks") or []:
            if not k.get("text"):
                E.append(f"{where}: a task without its text")
            if k.get("who") and k["who"] not in cast:
                E.append(f"{where} task {k.get('id')}: who {k['who']!r} isn't in the cast")
        ch = p.get("chapter")
        if ch and ch.get("time") and ch["time"] not in TIMES:
            E.append(f"{where}: chapter time {ch['time']!r}")
        fk = p.get("fork")
        if fk:
            if fork:
                E.append(f"{where}: a fork inside a fork's way (one level only)")
            ways = fk.get("ways") or []
            if len(ways) < 2:
                E.append(f"{where}: a fork has two ways or more")
            for w in ways:
                if not w.get("points"):
                    E.append(f"{where} way {w.get('id')}: no points")
                elif len(w["points"]) > 3:
                    W.append(f"{where} way {w.get('id')}: {len(w['points'])} points: one to three, then the river again")

    # the faces: every one named exists, every prompt reads as a 4 s post prompt
    for f in P.get("faces", []):
        own("face", f.get("id"))
        for why in face_problems(f.get("prompt", "")):
            W.append(f"face {f.get('id')}: the prompt {why}")
        if not 2 <= float(f.get("secs") or 4) <= 12:
            W.append(f"face {f.get('id')}: secs {f.get('secs')} (4 to 10 reads as natural)")
    for fid, where, who in faces_used(P):
        if face_of(P, fid, lib) is None:
            E.append(f"{where}: face {fid!r} isn't in the library or the prototype's faces")

    # the secrets and the achievements
    order = [p["id"] for p in P.get("points", []) if p.get("id")]
    for s in P.get("secrets", []):
        own("secret", s.get("id"))
        if s.get("after") not in order:
            E.append(f"secret {s.get('id')}: after {s.get('after')!r} isn't a point on the main river")
        elif order.index(s["after"]) == len(order) - 1:
            E.append(f"secret {s.get('id')}: after the last point: nothing to rejoin")
        if not s.get("achievement"):
            W.append(f"secret {s.get('id')}: no achievement")
    for a in P.get("achievements", []):
        own("achievement", a.get("id"))
        f = str(a.get("for", "feat"))
        kind, _, ref = f.partition(":")
        if kind == "secret" and ref not in {s.get("id") for s in P.get("secrets", [])}:
            E.append(f"achievement {a.get('id')}: for {f!r}: no such secret")
        elif kind == "ending" and ref not in {e.get("id") for e in ends}:
            E.append(f"achievement {a.get('id')}: for {f!r}: no such ending")
        elif kind not in ("secret", "ending", "feat"):
            E.append(f"achievement {a.get('id')}: for secret:<id>, ending:<id> or feat")

    # the endings' rules: karma bounds, or an answer at a point
    for e in ends:
        r = e.get("rule") or {}
        if not r:
            if P.get("points"):
                W.append(f"ending {e.get('id')}: no rule (how the story picks it): by karma or by an answer")
            continue
        if r.get("by") == "karma":
            for k in ("min", "max"):
                if r.get(k) is not None and not isinstance(r[k], (int, float)):
                    E.append(f"ending {e.get('id')}: rule {k} {r[k]!r} isn't a number")
        elif r.get("by") == "answer":
            q, _, _ = point_by_id(P, r.get("point"))
            if not q or not any(o.get("id") == r.get("option") for o in (q.get("talk") or {}).get("options", [])):
                E.append(f"ending {e.get('id')}: rule answer {r.get('point')}/{r.get('option')} isn't a talk's answer")
        else:
            E.append(f"ending {e.get('id')}: rule by {r.get('by')!r} (karma or answer)")
    if P.get("points") and ends and all((e.get("rule") or {}).get("by") == "karma" for e in ends):
        if not any((e.get("rule") or {}).get("min") is None and (e.get("rule") or {}).get("max") is None for e in ends):
            W.append("the endings by karma have no fallback (one with neither min nor max): some players reach none")
    by_karma = [e for e in ends if (e.get("rule") or {}).get("by") == "karma"]
    free = [e.get("id") for e in by_karma if (e.get("rule") or {}).get("min") is None and (e.get("rule") or {}).get("max") is None]
    if len(free) > 1:
        E.append(f"endings {', '.join(map(str, free))}: by karma with neither min nor max, but only one can be the fallback: give the others a min or a max")
    bounds = [(e["rule"].get("min"), e["rule"].get("max")) for e in by_karma if e.get("id") not in free]
    if len(set(bounds)) != len(bounds):
        E.append("two endings by karma have the same min and max: the second can never be reached")
    talks = [p for p, _, _ in all_points(P) if p.get("type") == "talk"]
    if by_karma and talks and all((p.get("talk") or {}).get("options") for p in talks):   # once the talks are written
        hi, lo = karma_range(P)
        for e in by_karma:
            r = e.get("rule") or {}
            if r.get("min") is not None and (r["min"] > hi or r["min"] <= 0):
                W.append(f"ending {e.get('id')}: karma min {r['min']}: the kindest answers add up to {hi:g}, and a player who says nothing "
                         f"has 0 (the fallback's): between 1 and {hi:g} (Build moves it there)")
            if r.get("max") is not None and (r["max"] < lo or r["max"] >= 0):
                W.append(f"ending {e.get('id')}: karma max {r['max']}: the cruellest answers add up to {lo:g}, and a player who says nothing "
                         f"has 0 (the fallback's): between {lo:g} and -1 (Build moves it there)")

    m = main_minutes(P)
    if P.get("points") and not MINUTES[0] <= m <= MINUTES[1]:
        W.append(f"the main river is {m:.0f} minutes: an hour's game is {MINUTES[0]} to {MINUTES[1]}")
    return E, W


# ---- the text views ----------------------------------------------------------------------------------------------

ICON = {"scene": "▶", "talk": "◉", "task": "☐", "chapter": "☾", "choice": "⑂"}


def river_text(P, detail=False):
    """The story as a compact text: the bible's heart, the acts and points in order, the forks, secrets and endings."""
    b, out = P.get("bible") or {}, []
    out.append(f"{P.get('title', '')}  ({main_minutes(P):.0f} min main river, {len(P.get('points', []))} points)")
    if b.get("logline"):
        out.append(f"LOGLINE {b['logline']}")
    if b.get("truth"):
        out.append(f"TRUTH {b['truth']}")
    if b.get("cast"):
        out.append("CAST " + "; ".join(f"{c['id']}: {c.get('name')}, {c.get('role')}" for c in b["cast"]))
    if b.get("places"):
        out.append("PLACES " + ", ".join(f"{x['id']} ({x.get('name')})" for x in b["places"]))
    secrets_after = {}
    for s in P.get("secrets", []):
        secrets_after.setdefault(s.get("after"), []).append(s)
    act = None
    for p in P.get("points", []):
        if p.get("act") != act:
            act = p.get("act")
            title = next((a.get("title") for a in P.get("acts", []) if a.get("id") == act), "")
            out.append(f"\n[{act}] {title}")
        out.append(point_line(p, detail))
        for w in ((p.get("fork") or {}).get("ways") or []):
            out.append(f"    ⑂ {w.get('id')}: {w.get('label')}")
            for q in w.get("points", []):
                out.append("      " + point_line(q, detail))
        for s in secrets_after.get(p.get("id"), []):
            out.append(f"    ★ secret {s['id']}: {s.get('title')} (find: {s.get('find')}; achievement: {s.get('achievement')})")
    if P.get("endings"):
        out.append("\nENDINGS")
        for e in P["endings"]:
            r = e.get("rule") or {}
            rule = ("karma " + " ".join(f"{k} {r[k]}" for k in ("min", "max") if r.get(k) is not None)).strip() if r.get("by") == "karma" else \
                f"answer {r.get('point')}/{r.get('option')}" if r.get("by") == "answer" else "no rule"
            out.append(f"  {'★' if e.get('kind') == 'intended' else '·'} {e.get('id')}: {e.get('title')} [{rule}] {e.get('what', '')}")
    return "\n".join(out)


def point_line(p, detail=False):
    who = ",".join(p.get("who") or [])
    s = f"  {ICON.get(p.get('type'), '?')} {p.get('id')} {p.get('title')} ({p.get('type')}, {p.get('minutes', 0)} min, {p.get('where', '')}{'; ' + who if who else ''}): {p.get('what', '')}"
    if detail:
        t = p.get("talk")
        if t:
            s += f"\n      talk: “{(t.get('line') or {}).get('text', '')}” " + " / ".join(f"[{o.get('id')}] {o.get('say')} → {o.get('face')} ({o.get('tell', '')})" for o in t.get("options") or [])
        if p.get("tasks"):
            s += "\n      to do: " + "; ".join(k.get("text", "") for k in p["tasks"])
    return s


# ---- the assistant's changes -------------------------------------------------------------------------------------

def _list(P, what):
    if what == "point":
        return P.setdefault("points", [])
    if what in ("cast", "place"):
        return P.setdefault("bible", {}).setdefault("cast" if what == "cast" else "places", [])
    return P.setdefault({"secret": "secrets", "ending": "endings", "face": "faces", "achievement": "achievements", "act": "acts"}[what], [])


def apply_changes(P, changes):
    """The assistant's changes, applied in order: [{op: set|add|remove|move, what, id, after, field, value_json}].
    Returns (the prototype changed, [what was done], [what couldn't be]). The prototype passed in is left alone."""
    Q, done, bad = copy.deepcopy(P), [], []
    for c in changes or []:
        op, what, iid, field = c.get("op"), c.get("what"), c.get("id") or "", c.get("field") or ""
        try:
            value = json.loads(c["value_json"]) if c.get("value_json") not in (None, "") else None
        except ValueError as e:
            bad.append(f"{op} {what} {iid}: its value isn't JSON ({e})")
            continue
        if what not in WHAT:
            bad.append(f"{op}: what {what!r}")
            continue
        if what in ("bible", "brief"):                   # the bible or the brief: a field of it
            if op != "set" or not field:
                bad.append(f"{what}: only set, with a field")
                continue
            Q.setdefault(what, {})[field] = value
            done.append(f"{what}.{field}")
            continue
        if what == "point":
            item, fork, way = point_by_id(Q, iid)
            lst = way["points"] if way else Q.setdefault("points", [])
        else:
            lst = _list(Q, what)
            item = next((x for x in lst if x.get("id") == iid), None)
        if op == "set":
            if item is None:
                bad.append(f"set {what} {iid}: no such {what}")
                continue
            if field:
                item[field] = value
            elif isinstance(value, dict):
                item.update(value)
            else:
                bad.append(f"set {what} {iid}: a field, or an object of fields")
                continue
            done.append(f"{what} {iid}" + (f".{field}" if field else ""))
        elif op == "add":
            if not isinstance(value, dict) or not value.get("id"):
                bad.append(f"add {what}: the new {what} as an object with its id")
                continue
            if what == "point" and c.get("after"):
                q, fk, wy = point_by_id(Q, c["after"])
                target = wy["points"] if wy else Q.setdefault("points", [])
                at = next((i for i, x in enumerate(target) if x.get("id") == c["after"]), None)
                if at is None:
                    bad.append(f"add point {value['id']}: after {c['after']!r}: no such point")
                    continue
                target.insert(at + 1, value)
            elif what == "point" and c.get("after") == "" and c.get("first"):
                Q.setdefault("points", []).insert(0, value)
            else:
                lst.append(value)
            done.append(f"+{what} {value['id']}")
        elif op == "remove":
            if item is None:
                bad.append(f"remove {what} {iid}: no such {what}")
                continue
            lst.remove(item)
            done.append(f"-{what} {iid}")
        elif op == "move":
            if what != "point" or item is None:
                bad.append(f"move {what} {iid}: only points move")
                continue
            q, fk, wy = point_by_id(Q, c.get("after") or "")
            if c.get("after") and q is None:
                bad.append(f"move point {iid}: after {c.get('after')!r}: no such point")
                continue
            lst.remove(item)
            target = wy["points"] if wy else Q["points"]
            at = next((i for i, x in enumerate(target) if x.get("id") == c.get("after")), -1)
            target.insert(at + 1, item)
            done.append(f"moved {iid}")
        else:
            bad.append(f"op {op!r}: set, add, remove or move")
    return Q, done, bad
