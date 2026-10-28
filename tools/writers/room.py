#!/usr/bin/env python3
"""The writers' room from the command line (docs/WRITERS_ROOM.md): what Claude in Claude Code reads and runs, and the
check. The page is serve.py.

    python tools/writers/room.py list                   the sessions (Content/Prototypes/<id>/prototype.json)
    python tools/writers/room.py new "Title" [--kind "what kind of game"]
    python tools/writers/room.py show ID [SHAPE]        the chart as text: the brief, the story's heart, every shape in
                                                        reading order with its arrows; one shape in full
    python tools/writers/room.py now                    what the page shows right now (the session, the shapes picked)
    python tools/writers/room.py build ID [--game G] [--set S]
                                                        the chart into Content/Games/G (story.json, BUILD.md, faces.md),
                                                        G from the title when not given; --force over a story not built from it;
                                                        --set into the set S's level (the place designed first in the scene
                                                        builder: Content/Studio/Sets/S) instead of greybox rooms
    python tools/writers/room.py sets                   the sets there are
    python tools/writers/room.py import SCRIPT [--into ID] [--notes FILE]
                                                        Claude's script of the user's notes (/chart; its syntax is
                                                        .claude/skills/chart/script.md) into a session: a new one, or ID's
                                                        chart made again (where its shapes sit kept; one drawn on the page
                                                        found by its title); --notes keeps the user's own notes beside it
                                                        (notes.txt); prints what each line became and what it couldn't read
    python tools/writers/room.py script ID              a session's chart as a script, as it is now (what was changed on
                                                        the page too): to change it and import it again
    python tools/writers/room.py check                  WRITERS: the format and its check, the post prompt library, the
                                                        upgrade from the first format, a chart built through check_all
"""
import argparse
import copy
import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "Content" / "Python"))
sys.path.insert(0, str(HERE))
from storykit import chartscript  # noqa: E402
from storykit import proto  # noqa: E402

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
NOW = ROOT / "Saved" / "Writers" / "now.json"
HOME = Path(os.environ["WRITERS_HOME"]).resolve() if os.environ.get("WRITERS_HOME") else None
if HOME:                                            # a scratch home, as the page's (WRITERSPAGE): sessions, history, builds
    proto.PROTOS, proto.SAVED, NOW = HOME / "Prototypes", HOME / "Saved", HOME / "Saved" / "now.json"


def load_session(sid):
    p = proto.path_of(sid)
    if not p.exists():
        sys.exit(f"no session {sid!r} (python tools/writers/room.py list)")
    return proto.load(p)


def cmd_list(a):
    ss = proto.sessions()
    if not ss:
        print("no sessions yet: python tools/writers/room.py new \"Title\" (or New in the page)")
    for s in ss:
        print(f"{s['id']:<28} {s['title'][:40]:<40} {s['points']:>3} points {s['minutes']:>3} min  {s['updated']}"
              + (f"  built: {s['built']}" if s["built"] else ""))


def cmd_new(a):
    P = proto.new_session(a.title, {"kind": a.kind or ""})
    print(f"new session {P['id']}: {proto.path_of(P['id']).relative_to(ROOT)}")


def problems(P, limit=12):
    errs, warns = proto.check(P)
    if errs or warns:
        print(f"\n{len(errs)} problems, {len(warns)} notes" + "".join("\n  ERROR " + e for e in errs[:limit]) + "".join("\n  note  " + w for w in warns[:limit]))


def cmd_show(a):
    P = load_session(a.id)
    if a.shape:
        n = proto.nodes_of(P).get(a.shape)
        if not n:
            sys.exit(f"no shape {a.shape} (room.py show {a.id} lists them)")
        print(proto.node_text(P, n))
        for fid, where, who in proto.faces_used({"nodes": [n], "faces": P.get("faces", [])}):
            f = proto.face_of(P, fid)
            subject = next((c.get("subject") for c in P.get("cast", []) if c["id"] == who), "she")
            print(f"face {fid} ({where}): {proto.for_subject((f or {}).get('prompt', '?'), subject)}")
        return
    print(proto.flow_text(P))
    problems(P)


def cmd_now(a):
    try:
        v = json.loads(NOW.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        sys.exit("the writers' room hasn't shown anything yet (open it: python tools/writers/serve.py)")
    picked = v.get("selected") or []
    print(f"the page shows session {v.get('session')!r}, the {v.get('tab')} tab" + (f", picked: {', '.join(picked)}" if picked else "")
          + (f", arrows {', '.join(v['arrows'])}" if v.get("arrows") else "") + f" ({v.get('at', '')})")
    if v.get("session") and proto.path_of(v["session"]).exists():
        P = proto.load(proto.path_of(v["session"]))
        N = proto.nodes_of(P)
        if picked:
            for k in picked:
                if k in N:
                    print(proto.node_text(P, N[k], N))
        else:
            print(proto.flow_text(P, detail=False))


def cmd_build(a):
    import build
    if HOME:
        build.GAMES = HOME / "Games"
    P = load_session(a.id)
    out = build.build(P, a.game, force=a.force, set_name=a.set or None)
    print(out["message"])
    if out.get("ok"):
        P["built"] = dict({"game": out["game"], "at": proto.now()}, **({"set": a.set} if a.set else {}))
        proto.save(P)
        print("\n".join("  " + f for f in out["files"]) + f"\nthen, in Claude Code: build {out['game']} from its BUILD.md")
    for e in (out.get("check") or {}).get("errors", []):
        print("  ERROR " + e)
    sys.exit(0 if out.get("ok") and (out.get("check") or {}).get("ok", True) else 1)


def cmd_import(a):
    text = Path(a.file).read_text(encoding="utf-8")
    old = load_session(a.into) if a.into else None
    P, rep = chartscript.read(text, old)
    if old:
        proto.keep_history(old["id"])            # the chart before: the page's Sessions bring it back
    if not old:
        sid, n = proto.slug(P["title"]), 1
        base = sid
        while proto.path_of(sid).exists():
            n += 1
            sid = f"{base}-{n}"
        P["id"] = sid
    for ln in rep["lines"]:
        if ln["text"].strip() and (ln["problems"] or a.verbose):
            print(f"{ln['n']:>4} {ln['what'] or '?':<34} {ln['text'][:70]}" + "".join("\n       ! " + x for x in ln["problems"]))
    c = rep["counts"]
    print(f"{P['title']}: " + ", ".join(f"{v} {k}" for k, v in c.items() if v) + f"; {len(rep['problems'])} line(s) to look at")
    if rep["errors"]:
        print("the chart's problems:" + "".join("\n  ERROR " + e for e in rep["errors"][:12]))
    proto.save(P)
    if a.notes:                                  # the user's own notes, as they wrote them, beside the chart
        (proto.path_of(P["id"]).parent / "notes.txt").write_text(Path(a.notes).read_text(encoding="utf-8"), encoding="utf-8")
    where = proto.path_of(P["id"])
    print(f"{'made again' if old else 'new session'} {P['id']}: {where.relative_to(ROOT) if where.is_relative_to(ROOT) else where}"
          f"  (open it: python tools/writers/serve.py, then http://127.0.0.1:8795/?s={P['id']})")


def cmd_sets(a):
    from storykit import storylib
    names = storylib.sets()
    print("\n".join(f"{n}  (Content/Studio/Sets/{n}; python tools/story.py --game set:{n} rooms)" for n in names) or
          "no sets yet: design the place in the scene builder (its game picker: + new set…), or python tools/story.py new-set <name>")


def cmd_script(a):
    P = load_session(a.id)
    text = chartscript.write(P)
    if P.get("script_chart") and P["script_chart"] != text:
        print("// changed on the page since the script was read in: this is the chart as it is now")
    print(text, end="")


# ---- the check ----------------------------------------------------------------------------------------------------

def fixture():
    """A small chart with every kind of shape and arrow: a scene with lines, a task with a secret found in it, a talk,
    a choice by the player whose ways rejoin (one remembered), a chapter with a line and a secret in a look round, the
    last talk deciding one ending by its answer and karma the other two, a note, two acts, a feat, a face of its own."""
    P = proto.blank("Come Over", {"kind": "a distant friend invites you over and something isn't quite right", "minutes": 60})
    P["id"] = "come-over-check"
    P["story"].update({"logline": "Hana asks you to stay the weekend; her grandmother's room is shut.", "truth": "Her grandmother died in March.",
                       "ladder": ["she sets three cups", "the room is locked", "the calendar stops in March"], "time": "dusk", "karma": "how much you let yourself see"})
    P["cast"] = [{"id": "hana", "name": "Hana", "subject": "she", "role": "your friend", "tells": "she looks at the door when she lies"}]
    P["places"] = [{"id": "genkan", "name": "Entrance"}, {"id": "kitchen", "name": "Kitchen"}, {"id": "living", "name": "Living room"}, {"id": "upstairs", "name": "Upstairs"}]
    P["faces"] = [{"id": "hana_door", "prompt": "her eyes widen as she sees the viewer, then she smiles and looks down at her hands.", "secs": 6, "loop": [0.5, 1], "for": "hana"}]
    P["feats"] = [{"id": "feat_cups", "title": "Clean Kitchen", "text": "Wash every cup.", "hidden": False}]

    def talk(line, opts, listen="listening_guarded"):
        return {"line": {"who": "hana", "text": line}, "listen": listen,
                "options": [dict(zip(("id", "say", "karma", "face", "tell"), o)) for o in opts], "reveals": "her eyes go to the shut door"}
    N = P["nodes"]
    N[0].update({"x": 40, "y": 260})
    N += [
        {"id": "p01", "type": "scene", "x": 290, "y": 260, "title": "The door opens", "text": "Hana lets you in, too glad.", "where": "genkan", "who": ["hana"], "minutes": 8,
         "lines": [{"who": "hana", "text": "You came. I didn't think you would.", "face": "hana_door"}, {"who": "player", "text": "Of course I came."}]},
        {"id": "p02", "type": "task", "x": 540, "y": 260, "title": "Tea for Hana", "text": "She asks for tea.", "where": "kitchen", "who": ["hana"], "minutes": 10,
         "tasks": [{"id": "kettle", "text": "Put the kettle on", "who": "hana", "done": "the kettle boils", "fails": ""}, {"id": "cups", "text": "Find two cups", "who": "", "done": "two cups", "fails": "three cups instead"}]},
        {"id": "s01", "type": "secret", "x": 600, "y": 40, "title": "The third cup", "find": "behind the rice cooker", "shows": "a cup with a name scratched off",
         "achievement": {"title": "Three Cups", "text": "Someone else drinks tea here.", "hidden": False}},
        {"id": "p03", "type": "talk", "x": 790, "y": 260, "title": "Across the low table", "text": "She asks about the room.", "where": "living", "who": ["hana"], "minutes": 8,
         "talk": talk("Do you remember her room?", [("a", "Of course I do.", 1, "relief_too_much", "she breathes out"), ("b", "Whose room?", -1, "lie_glance_away", "her eyes go to the door"),
                                                     ("c", "Why is it shut?", 2, "fear_flicker", "fear, smoothed over")])},
        {"id": "c01", "type": "choice", "x": 1040, "y": 250, "title": "A sound upstairs", "by": "player", "question": "A sound from upstairs: go and look?"},
        {"id": "p04", "type": "scene", "x": 1290, "y": 150, "title": "Upstairs", "text": "The shut door, a light under it.", "where": "upstairs", "who": [], "minutes": 8},
        {"id": "p05", "type": "scene", "x": 1290, "y": 380, "title": "Stay with her", "text": "She holds your sleeve.", "where": "living", "who": ["hana"], "minutes": 8,
         "lines": [{"who": "hana", "text": "Don't go up there.", "face": "tears_held"}]},
        {"id": "p06", "type": "chapter", "x": 1540, "y": 260, "title": "Night one", "text": "You sleep on the sofa.", "where": "living", "who": ["hana"], "minutes": 2,
         "lines": [{"who": "hana", "text": "Sleep well.", "face": "waiting_blank"}], "chapter": {"title": "Saturday", "sub": "02:10", "time": "night"}},
        {"id": "s02", "type": "secret", "x": 1600, "y": 40, "title": "Her diary", "find": "under the sofa cushion", "shows": "the last page is from March",
         "achievement": {"title": "March", "text": "", "hidden": True}},
        {"id": "p07", "type": "talk", "x": 1790, "y": 260, "title": "Morning", "text": "She asks you to stay.", "where": "kitchen", "who": ["hana"], "minutes": 10,
         "talk": talk("Will you stay another night?", [("a", "She's gone, Hana.", 0, "tears_held", "the truth lands"), ("b", "Of course I'll stay.", 1, "relief_too_much", "too grateful"),
                                                        ("c", "I have to go.", -2, "lie_glance_away", "she looks away")])},
        {"id": "c02", "type": "choice", "x": 2040, "y": 250, "title": "What you said", "by": "answer", "question": "The last answer"},
        {"id": "c03", "type": "choice", "x": 2290, "y": 380, "title": "How it ends", "by": "karma", "question": "What it added up to"},
        {"id": "e01", "type": "ending", "x": 2290, "y": 100, "title": "Let her rest", "kind": "intended", "text": "You open the room together.", "how": "say it",
         "achievement": {"title": "Let Her Rest", "text": "", "hidden": True}},
        {"id": "e02", "type": "ending", "x": 2540, "y": 300, "title": "Four places set", "kind": "other", "text": "You stay.", "how": "play along",
         "achievement": {"title": "Four Places", "text": "", "hidden": True}},
        {"id": "e03", "type": "ending", "x": 2540, "y": 480, "title": "The last bus", "kind": "other", "text": "You leave.", "how": "leave", "achievement": {"title": "", "text": "", "hidden": True}},
        {"id": "note1", "type": "note", "x": 300, "y": 520, "text": "Remember the rice cooker's click.", "color": "yellow"}]
    E = [("start", "p01"), ("p01", "p02"), ("p02", "p03"), ("p02", "s01"), ("s01", "p03"), ("p03", "c01"), ("p04", "p06"), ("p05", "p06"),
         ("p06", "p07"), ("p06", "s02"), ("s02", "p07"), ("p07", "c02"), ("c02", "c03")]
    P["edges"] = [{"id": f"a{i + 1}", "from": a, "to": b, "label": ""} for i, (a, b) in enumerate(E)]
    P["edges"] += [{"id": "w1", "from": "c01", "to": "p04", "label": "Go up and look", "sets": "went_up"},
                   {"id": "w2", "from": "c01", "to": "p05", "label": "Stay with Hana"},
                   {"id": "x1", "from": "c02", "to": "e01", "label": "", "when": {"talk": "p07", "answer": "a"}},
                   {"id": "x2", "from": "c03", "to": "e02", "label": "", "when": {"min": 2}},
                   {"id": "x3", "from": "c03", "to": "e03", "label": "", "when": {}}]
    next(e for e in P["edges"] if e["from"] == "c02" and e["to"] == "c03")["when"] = {}
    P["frames"] = [{"id": "act1", "title": "Friday", "x": 0, "y": 0, "w": 1000, "h": 520, "color": "#8a63d2"},
                   {"id": "act2", "title": "Saturday", "x": 1010, "y": 0, "w": 1760, "h": 640, "color": "#3f8fc9"}]
    return proto.with_steps(dict(P, format=2))           # drawn in the second format's lines and to-dos: upgraded


USER_EXAMPLE = """( Opening )

Internal monologue
"Ji should be arriving soon, I should probably clean up the apartment"

Hidden Timed Task  - Clean up

*knock, knock*

"That must be her"

*open door*

She is standing, she smiles and leans in for a hug, she pulls back

*Enter Name*

Ji: "X! It's been so long, I barely recognise you."

[ Greet ] She's probably cold, I should let her inside  --- [ Question ] Is this what she looked like.
"""
EXAMPLE = HERE / "script_example.txt"
LIGHTS_OUT = HERE / "script_lights_out.txt"      # the day's small systems from notes (DECISIONS 2026-10-28)
DEFAULT_TIMED = chartscript.DEFAULT_SECS


def first_format():
    """A first-format prototype (the river the old assistant drafted), for the upgrade."""
    return {"format": 1, "id": "old-river", "title": "The Old River", "brief": {"kind": "k", "references": "r", "notes": "", "endings": ["the one I want", "", ""], "minutes": 60},
            "bible": {"logline": "l", "truth": "t", "time": "night", "cast": [{"id": "mari", "name": "Mari", "subject": "she"}], "places": [{"id": "hall", "name": "Hall"}]},
            "acts": [{"id": "a1", "title": "One"}, {"id": "a2", "title": "Two"}],
            "points": [{"id": "p1", "act": "a1", "type": "scene", "title": "Hello", "where": "hall", "who": ["mari"], "minutes": 12, "what": "she opens the door",
                        "lines": [{"who": "mari", "text": "You came.", "face": "glad_to_see_you"}]},
                       {"id": "p2", "act": "a1", "type": "choice", "title": "Up or down", "where": "hall", "minutes": 2, "what": "a noise",
                        "fork": {"question": "Up or down?", "ways": [{"id": "w1", "label": "Up", "sets": "went_up", "points": [{"id": "p2a", "type": "scene", "title": "Up", "where": "hall", "minutes": 12}]},
                                                                      {"id": "w2", "label": "Down", "points": [{"id": "p2b", "type": "task", "title": "Down", "where": "hall", "minutes": 12,
                                                                                                                "tasks": [{"id": "t1", "text": "Find the fuse"}]}]}]}},
                       {"id": "p3", "act": "a2", "type": "talk", "title": "Talk", "where": "hall", "who": ["mari"], "minutes": 12,
                        "talk": {"line": {"who": "mari", "text": "Well?"}, "listen": "listening_guarded",
                                 "options": [{"id": "a", "say": "Yes.", "karma": 2, "face": "relief_too_much", "tell": "x"}, {"id": "b", "say": "No.", "karma": -2, "face": "lie_glance_away", "tell": "y"}]}},
                       {"id": "p4", "act": "a2", "type": "chapter", "title": "Night", "where": "hall", "minutes": 8, "chapter": {"title": "Night 2", "time": "night"}}],
            "secrets": [{"id": "s1", "after": "p1", "title": "A photo", "find": "behind the mirror", "shows": "her and someone", "achievement": "The Photo"}],
            "endings": [{"id": "e_good", "kind": "intended", "title": "Good", "what": "w", "rule": {"by": "karma", "min": 1}},
                        {"id": "e_bad", "kind": "other", "title": "Bad", "what": "w", "rule": {"by": "karma", "max": -1}},
                        {"id": "e_mid", "kind": "other", "title": "Mid", "what": "w", "rule": {"by": "karma"}}],
            "achievements": [{"id": "ach_feat", "title": "A Feat", "text": "do it", "for": "feat"}], "faces": [], "chat": []}


def cmd_check(a):
    fails = []
    ok = lambda m: print("  ok  " + m)
    bad = lambda m: (fails.append(m), print("  FAIL " + m))

    # the post prompt library
    lib = proto.library()
    probs = []
    for k, p in lib.items():
        if not proto.ID.match(k):
            probs.append(f"{k}: id")
        probs += [f"{k}: the prompt {w}" for w in proto.face_problems(p.get("prompt", ""))]
        if not 4 <= float(p.get("secs", 0)) <= 10:
            probs.append(f"{k}: secs {p.get('secs')}")
        lp = p.get("loop")
        if lp is not None and not (isinstance(lp, list) and len(lp) == 2 and 0 <= lp[0] < lp[1] <= 1):
            probs.append(f"{k}: loop {lp}")
        if not set(p.get("tags", [])) <= {"listen", "tell", "warm", "unsettling", "sad", "fear"} or not p.get("use"):
            probs.append(f"{k}: tags or use")
    he = proto.for_subject("her eyes roll up as she bites her lower lip, she looks at herself.", "he")
    if he != "his eyes roll up as he bites his lower lip, he looks at himself.":
        probs.append("he: " + he)
    ok(f"the post prompt library: {len(lib)} faces, each a 4 s post prompt ({sum('listen' in p['tags'] for p in lib.values())} listening, "
       f"{sum('tell' in p['tags'] for p in lib.values())} tells), loops in range, he for she") if not probs else bad("the library: " + "; ".join(probs[:6]))

    # a whole chart: no problems, read in order, its minutes and karma
    P = fixture()
    errs, warns = proto.check(P, lib)
    order = proto.reading_order(P)
    lo, hi = proto.minutes_range(P)
    kind, cruel = proto.karma_range(P)
    if errs or warns:
        bad(f"the fixture chart: {errs[:3]} {warns[:3]}")
    elif order[0] != "start" or order.index("p03") > order.index("c01") or order.index("p06") < max(order.index("p04"), order.index("p05")):
        bad(f"the reading order: {order}")
    elif (lo, hi) != (46.0, 46.0) or (kind, cruel) != (3.0, -3.0):
        bad(f"minutes {lo}-{hi}, karma {kind}/{cruel}")
    else:
        ok(f"a chart of every shape: no problems; read in order (a join after both its ways); {lo:g} min; karma {cruel:g} to {kind:g}")

    # the check finds each fault at its shape
    def fault(what, change, start):
        Q = copy.deepcopy(P)
        change(Q)
        es, _ = proto.check(Q, lib)
        return (what, any(e.startswith(start) for e in es), es)
    def edge(Q, a, b, **kw):
        Q["edges"].append(dict({"id": f"z{len(Q['edges'])}", "from": a, "to": b, "label": ""}, **kw))
    def node(Q, k):
        return next(n for n in Q["nodes"] if n["id"] == k)
    results = [
        fault("two ways on from a scene", lambda Q: edge(Q, "p01", "p03"), "scene p01: 2 arrows on"),
        fault("a dead end", lambda Q: Q.__setitem__("edges", [e for e in Q["edges"] if e["from"] != "p03"]), "talk p03: nothing comes after it"),
        fault("a loop", lambda Q: edge(Q, "p05", "p01"), "scene p01: the flow loops back"),
        fault("karma with two for the rest", lambda Q: edge(Q, "c03", "e01", when={}), "choice c03: by karma, one arrow is for the rest"),
        fault("an answer the talk hasn't", lambda Q: next(e for e in Q["edges"] if e["id"] == "x1")["when"].update(answer="z"), "choice c02: the arrow to e01 names answer 'z'"),
        fault("a secret that never comes back", lambda Q: Q.__setitem__("edges", [e for e in Q["edges"] if e["from"] != "s01"]), "secret s01: one arrow out"),
        fault("a secret after a choice", lambda Q: edge(Q, "c01", "s01"), "choice c01: a secret is found after a point"),
        fault("someone not in the cast", lambda Q: node(Q, "p01").update(who=["nobody"]), "scene p01: who 'nobody' isn't in the cast"),
        fault("an arrow to a note", lambda Q: edge(Q, "p01", "note1"), "note note1: a note takes no arrows"),
        fault("a face that isn't anywhere", lambda Q: node(Q, "p03")["talk"]["options"][0].update(face="no_such_face"), "talk p03 answer a: face"),
        fault("two starts", lambda Q: Q["nodes"].append({"id": "start2", "type": "start", "x": 0, "y": 0}), "2 start shapes"),
        fault("an ending with an arrow out", lambda Q: edge(Q, "e02", "p01"), "ending e02: an ending has no arrows out"),
        fault("four answers", lambda Q: node(Q, "p03")["talk"]["options"].append({"id": "d", "say": "Hm.", "karma": 0, "tell": "t"}), "talk p03: a talk has 2 or 3 answers"),
    ]
    missed = [(w, es[:2]) for w, hit, es in results if not hit]
    ok(f"the check finds each of {len(results)} faults at its shape (two ways on, a dead end, a loop, karma's rest, an answer, "
       "secrets, the cast, a note, a face, two starts, an ending's arrow, four answers)") if not missed else bad(f"faults missed: {missed}")

    # the chart as text, for Claude
    t = proto.flow_text(P)
    absent = [n["id"] for n in P["nodes"] if n["type"] != "note" and f" {n['id']} " not in t]
    ok("the chart as text: every shape, the ways by their labels and karma, the secrets, the notes") if not absent and "[Go up and look]" in t \
        and "[karma ≥ 2]" in t and "★ if found → s01" in t and "Remember the rice cooker" in t else bad(f"flow text: missing {absent}")

    # the first format's river, upgraded
    Q = proto.upgrade(first_format())
    qe, qw = proto.check(Q, lib)
    N = proto.nodes_of(Q)
    counts = {t: sum(n["type"] == t for n in N.values()) for t in ("scene", "talk", "task", "chapter", "choice", "secret", "ending")}
    want = {"scene": 2, "talk": 1, "task": 1, "chapter": 1, "choice": 2, "secret": 1, "ending": 3}
    if qe or counts != want or not Q["feats"] or "the one I want" not in Q["brief"]["notes"] or len(Q["frames"]) != 2 \
            or not any(e.get("sets") == "went_up" for e in Q["edges"]) or Q["format"] != proto.FORMAT:
        bad(f"the upgrade: {qe[:3]} {counts} feats {Q['feats']} frames {len(Q['frames'])}")
    else:
        ok(f"a first-format river upgraded to a chart: {len(N)} shapes, {len(Q['edges'])} arrows, its acts as frames, the fork a choice whose ways "
           f"rejoin, the endings after a choice by karma; no problems ({len(qw)} notes)")

    # the build: through check_all's STORY, LEVEL and SHOTS
    import build
    res = build.check_build(P)
    (ok if res["ok"] else bad)(res["message"])

    # the script (.claude/skills/chart/script.md): the user's own first example reads as they wrote it
    U, rep_u = chartscript.read(USER_EXAMPLE)
    rep = rep_u
    N = proto.nodes_of(U)
    task, talk = N.get("opening") or {}, N.get("opening_ji") or {}
    st = [x.get("do") for x in task.get("steps") or []]
    td = next((x for x in task.get("steps") or [] if x.get("do") == "todo"), {})
    tk = talk.get("talk") or {}
    want = (st == ["think", "todo", "sound", "think", "act"] and td.get("hidden") is True and td.get("secs") == DEFAULT_TIMED
            and next((x for x in task["steps"] if x["do"] == "act"), {}).get("item") == "door"
            and [x.get("do") for x in talk.get("steps") or []] == ["see", "name"] and (talk["steps"][0].get("who") == "ji")
            and tk.get("line", {}).get("text", "").startswith("{name}! It's been so long")
            and [(o["say"], o.get("think")) for o in tk.get("options") or []] == [("Greet", "She's probably cold, I should let her inside"), ("Question", "Is this what she looked like.")]
            and any(i["id"] == "door" and i["kind"] == "door" for i in U["items"]))
    ok("the user's example as written: a task (a thought, the hidden timed clean-up, the knock off the shelf, a thought, the door "
       "to open), then Ji's close-up (she hugs you, you type your name, her question with X as {name}, Greet and Question each "
       "with its thought)") if want else bad(f"the user's example: steps {st}, talk {[x.get('do') for x in talk.get('steps') or []]}, {tk.get('options')}")

    # the example story: every part of the syntax, a chart with no problems, built through STORY, LEVEL and SHOTS
    E, rep = chartscript.read(EXAMPLE.read_text(encoding="utf-8"))
    E["id"] = "script-check"
    kinds = {k: sum(1 for n in E["nodes"] if n["type"] == k) for k in ("talk", "secret", "chapter", "ending", "choice")}
    things = {i["name"]: i["kind"] for i in E["items"]}
    if rep["problems"] or rep["errors"]:
        bad(f"the example script: {rep['problems'][:3]} {rep['errors'][:3]}")
    elif kinds != {"talk": 3, "secret": 1, "chapter": 1, "ending": 3, "choice": 5} or sum(n.get("kind") == "intended" for n in E["nodes"]) != 1 \
            or not {"door": "door", "bed": "bed", "closet": "hideout", "kettle": "inspect"}.items() <= things.items():
        bad(f"the example script: {kinds} {things}")
    else:
        r2 = build.check_build(E)
        (ok if r2["ok"] else bad)(f"the example script (tools/writers/script_example.txt): {len(rep['lines'])} lines, no problems, {len(E['nodes'])} shapes "
                                  f"({kinds['talk']} talks, {kinds['choice']} choices, a secret, a chapter, three endings by karma), {len(E['items'])} things "
                                  "sized and used; " + r2["message"])

    # the small systems from notes (DECISIONS 2026-10-28): a mess mopped, the flashlight taken and switched on, the power
    # cut and the breaker, a knock and the peephole: use: clean, an item with torch, the power, use: breaker, a door's
    # peephole, each step heard as its own; STORY, LEVEL and SHOTS
    L, repL = chartscript.read(LIGHTS_OUT.read_text(encoding="utf-8"))
    L["id"] = "lights-out-check"
    kindsL = {i["name"]: i["kind"] for i in L["items"]}
    SL = build.Builder(copy.deepcopy(L), "LightsOutCheck").build()
    whens = [b["when"] for st in SL["stitches"].values() for b in st.get("beats", [])]
    usesL = {p.get("use") for lv in SL["levels"].values() for r in lv["rooms"] for p in r.get("props", [])}
    peepL = any((o.get("door") or {}).get("peephole") for lv in SL["levels"].values() for r in lv["rooms"] for o in r.get("openings", []))
    latchL = [(o.get("door") or {}).get("id") for lv in SL["levels"].values() for r in lv["rooms"] for o in r.get("openings", []) if (o.get("door") or {}).get("latch")]
    torchL = any(v.get("torch") for v in SL["items"].values())
    powerL = [a["power"] for st in SL["stitches"].values() for b in st.get("beats", []) for a in b.get("do", []) if "power" in a]
    rL = build.check_build(L)
    if repL["problems"] or repL["errors"] or kindsL != {"mud": "stain", "flashlight": "pickup", "breaker": "breaker", "peephole": "peephole", "front door": "door"} \
            or not all(w in whens for w in ({"use": "mud"}, {"torch": "on"}, {"use": "breaker"})) or not any("pickup" in w for w in whens) \
            or not any("peeping" in w for w in whens) or not {"clean", "breaker"} <= usesL or not peepL or not torchL or powerL != ["off", "on"] \
            or len(latchL) != 1 or {"locked": latchL[0]} not in whens or not rL["ok"]:
        bad(f"the small systems from notes: {repL['problems'][:2]} {repL['errors'][:2]} {kindsL} {whens} {usesL} peephole {peepL} latch {latchL} torch {torchL} {powerL} {rL['message'][:160]}")
    else:
        ok("the small systems from notes (tools/writers/script_lights_out.txt): the mud a stain to mop, the flashlight taken and switched "
           "on with F, the power cut and the breaker, the front door's peephole, locking the front door by its latch; each step heard as its own; " + rL["message"].split(":")[0])

    # into a set (a place designed first in the scene builder: here the Pilot's house as one): each place on its room,
    # the things fitted round its furniture and doorways, a door the story opens one of its own; STORY, LEVEL, SHOTS
    from storykit import storylib
    pilot, _ = storylib.load("Pilot")
    sset = {"format": 3, "game": {"id": "pilot_house", "title": "pilot_house", "start": "n_start"}, "levels": {"pilot_house": copy.deepcopy(pilot["levels"]["house"])},
            "cast": {}, "items": {}, "notes": {}, "lines": {}, "sounds": {}}
    SB = build.Builder(copy.deepcopy(E), "SetCheck", sset, "pilot_house")
    SS = SB.build()
    mapping = {pid: rid for pid, rid, _ in SB.rooms.mapping()}
    door = SB.thing.get("door", {}).get("prop")
    rooms_of = {x["id"]: r["id"] for r in SS["levels"]["main"]["rooms"] for x in r.get("props", [])}
    misplaced = [i for i, t in SB.thing.items() if t["kind"] not in ("door",) and t["prop"] not in rooms_of]
    r3 = build.check_build(E, "pilot_house", sset)
    F = fixture()
    r4 = build.check_build(F, "pilot_house", sset)
    if not r3["ok"] or not r4["ok"] or mapping.get("bathroom") != "kitchen" or door != "front_door" or misplaced or "rooms" not in json.dumps(SS["levels"]["main"]):
        bad(f"into a set: {r3['message'][:200]} | {r4['message'][:200]} | {mapping} door {door} misplaced {misplaced}")
    else:
        ok(f"built into a set (the Pilot's house as one): the places on its rooms ({', '.join(f'{a} → {b}' for a, b in mapping.items())}), "
           f"{len(SB.thing)} things fitted round its furniture ({len(SB.rooms.spilled)} moved to a room with space), the door its own front door; "
           "the example and the fixture through STORY, LEVEL and SHOTS")

    # the chart written as a script reads back as the same story, and is the same script again
    T = chartscript.write(E)
    E2, rep2 = chartscript.read(T)
    shape = lambda X: sorted((n["type"], len(n.get("steps") or []), len((n.get("talk") or {}).get("options") or [])) for n in X["nodes"])
    if rep2["problems"] or rep2["errors"] or shape(E2) != shape(E) or len(E2["edges"]) != len(E["edges"]) or chartscript.write(E2) != T:
        bad(f"the round trip: {rep2['problems'][:3]} {rep2['errors'][:3]} shapes {shape(E2) == shape(E)} arrows {len(E2['edges'])}/{len(E['edges'])}")
    else:
        ok(f"the chart written back as a script ({len(T.splitlines())} lines) reads as the same story, and writes the same script again")

    # a chart drawn by hand, written as a script and read back into its session: its shapes keep their ids and places
    H = copy.deepcopy(P)
    H2, rep5 = chartscript.read(chartscript.write(H), H)
    pos = lambda X: {n["id"]: (n["type"], n["x"], n["y"]) for n in X["nodes"] if n["type"] not in ("note", "start")}
    lost = sorted(set(pos(H).items()) - set(pos(H2).items()))
    ch = {n["id"]: n.get("title") for n in H["nodes"] if n["type"] == "choice"}
    ch2 = {n["id"]: n.get("title") for n in H2["nodes"] if n["type"] == "choice"}
    ok(f"a chart drawn by hand, written as a script and read back into it: all {len(pos(H))} shapes keep their ids and places, "
       "its choices their titles") if not lost and ch == ch2 and not rep5["errors"] else bad(f"drawn by hand and back: lost {lost[:4]}, choices {ch} -> {ch2}, {rep5['errors'][:2]}")

    # typing habits copied from the user's notes: curly quotes, a long dash, three dots in one, bullets, capitals: the same chart
    phone = (USER_EXAMPLE.replace('"', "“", 1).replace("\"That must be her\"", "“That must be her”").replace(" --- ", " — ")
             .replace("Internal monologue", "• internal monologue").replace("*open door*", "*Open Door*"))
    U2, rep3 = chartscript.read(phone)
    same = [(n["type"], [x.get("do") for x in n.get("steps") or []]) for n in U2["nodes"]] == [(n["type"], [x.get("do") for x in n.get("steps") or []]) for n in U["nodes"]]
    ok("typing habits (curly quotes, a long dash between the answers, a bullet, capitals) read the same") if same and rep3["errors"] == rep_u["errors"] \
        else bad(f"typing habits: {rep3['errors'][:3]}")

    # what the import can't read is said at its line
    faulty = USER_EXAMPLE + "\n[ Nope ]\nJi: \"Hm.\"\n\n( Later ) if [ Missing ]\n\nTimed task - Wait for the bus\n\n( Secret: Nothing )\n\nA box.\n"
    _, rep4 = chartscript.read(faulty)
    said = " | ".join(rep4["problems"])
    hits = [w for w in ("[ Nope ]: no answer", "no answer [ Missing ]", "a timed task with no time", "how is it found") if w in said]
    ok("what it can't read is said at its line: an answer that isn't one, an if on an answer that isn't there, a timed task with no time, "
       "a secret with no Find") if len(hits) == 4 else bad(f"the problems: {said[:400]}")

    print("WRITERS " + ("ok" if not fails else f"FAILED ({len(fails)})"))
    sys.exit(1 if fails else 0)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list")
    s = sub.add_parser("new"); s.add_argument("title"); s.add_argument("--kind")
    s = sub.add_parser("show"); s.add_argument("id"); s.add_argument("shape", nargs="?")
    sub.add_parser("now")
    s = sub.add_parser("build"); s.add_argument("id"); s.add_argument("--game", default=""); s.add_argument("--force", action="store_true"); s.add_argument("--set", default="")
    sub.add_parser("sets")
    s = sub.add_parser("import"); s.add_argument("file"); s.add_argument("--into", default=""); s.add_argument("--notes", default="")
    s.add_argument("-v", "--verbose", action="store_true")
    s = sub.add_parser("script"); s.add_argument("id")
    sub.add_parser("check")
    a = ap.parse_args(argv)
    {"list": cmd_list, "new": cmd_new, "show": cmd_show, "now": cmd_now, "build": cmd_build, "import": cmd_import, "script": cmd_script, "sets": cmd_sets,
     "check": cmd_check}[a.cmd](a)


if __name__ == "__main__":
    main()
