#!/usr/bin/env python3
"""The writers' room from the command line (docs/WRITERS_ROOM.md): what Claude in Claude Code reads and runs, and the
check. The page is serve.py.

    python tools/writers/room.py list                   the sessions (Content/Prototypes/<id>/prototype.json)
    python tools/writers/room.py new "Title" [--kind "what kind of game"]
    python tools/writers/room.py show ID [POINT]        the story as text (the river, the bible's heart); a point in full
    python tools/writers/room.py river ID               the river with its talks and to-do lists
    python tools/writers/room.py now                    what the page shows right now (the session, the view, the point)
    python tools/writers/room.py draft ID [--stage bible|endings|river|details|all] [--backend claude|local|fake]
    python tools/writers/room.py build ID --game G      the prototype into Content/Games/G (story.json, BUILD.md, faces.md)
    python tools/writers/room.py setup                  the anthropic SDK in vendor/writers/venv (Claude through the API)
    python tools/writers/room.py check                  WRITERS: the format, the prompt library, the stages and the
                                                        assistant on the stand-in model, the build passing the story check
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "Content" / "Python"))
sys.path.insert(0, str(HERE))
from storykit import proto  # noqa: E402
import llm  # noqa: E402
import gen  # noqa: E402
import fake  # noqa: E402

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
NOW = ROOT / "Saved" / "Writers" / "now.json"


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


def cmd_show(a):
    P = load_session(a.id)
    if a.point:
        p, fork, way = proto.point_by_id(P, a.point)
        if not p:
            sys.exit(f"no point {a.point}")
        print(json.dumps(p, ensure_ascii=False, indent=1))
        for fid, where, who in proto.faces_used({"points": [p], "faces": P.get("faces", [])}):
            f = proto.face_of(P, fid)
            print(f"face {fid} ({where}): {proto.for_subject((f or {}).get('prompt', '?'), next((c.get('subject') for c in P['bible'].get('cast', []) if c['id'] == who), 'she'))}")
        return
    print(proto.river_text(P))
    errs, warns = proto.check(P)
    if errs or warns:
        print(f"\n{len(errs)} problems, {len(warns)} warnings" + "".join("\n  ERROR " + e for e in errs[:12]) + "".join("\n  warn  " + w for w in warns[:8]))


def cmd_river(a):
    print(proto.river_text(load_session(a.id), detail=True))


def cmd_now(a):
    try:
        v = json.loads(NOW.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        sys.exit("the writers' room hasn't shown anything yet (open it: python tools/writers/serve.py)")
    print(f"the page shows session {v.get('session')!r}, the {v.get('tab')} view" + (f", point {v['selected']}" if v.get("selected") else "")
          + f" ({v.get('at', '')})")
    if v.get("session") and proto.path_of(v["session"]).exists():
        P = proto.load(proto.path_of(v["session"]))
        if v.get("selected"):
            p, _, _ = proto.point_by_id(P, v["selected"])
            if p:
                print(json.dumps(p, ensure_ascii=False, indent=1))
        else:
            print(proto.river_text(P))


def cmd_draft(a):
    P = load_session(a.id)
    s = llm.settings()
    if a.backend:
        s["backend"] = a.backend
    be = llm.backend(s, fake.answer)
    stages = ("bible", "river", "details") if a.stage == "all" else (a.stage,)
    print(f"drafting {a.id} with {be.label}: {', '.join(stages)}")
    if stages == ("endings",):
        gen.stage_endings(P, be, print)
        proto.save(P)
    elif stages == ("details",):
        for act in P.get("acts", []):
            gen.stage_details(P, be, act["id"], print)
            proto.save(P)
    else:
        gen.draft(P, be, print, proto.save, stages)
    errs, warns = proto.check(P)
    print(f"done: {len(P.get('points', []))} points, {proto.main_minutes(P):.0f} min; {len(errs)} problems, {len(warns)} warnings")


def cmd_build(a):
    import build
    P = load_session(a.id)
    out = build.build(P, a.game, force=a.force)
    print(out["message"])


def cmd_setup(a):
    home = ROOT / "vendor" / "writers"
    home.mkdir(parents=True, exist_ok=True)
    py = llm.venv_python()
    if shutil.which("uv"):
        if not py.exists():
            subprocess.run(["uv", "venv", str(home / "venv")], check=True)
        subprocess.run(["uv", "pip", "install", "-p", str(py), "anthropic"], check=True)
    else:
        if not py.exists():
            subprocess.run([sys.executable, "-m", "venv", str(home / "venv")], check=True)
        subprocess.run([str(py), "-m", "pip", "install", "anthropic"], check=True)
    ver = subprocess.run([str(py), "-c", "import anthropic; print(anthropic.__version__)"], capture_output=True, text=True).stdout.strip()
    print(f"the anthropic SDK {ver} in {home / 'venv'}")
    ok, why = llm.api_ready()
    print(f"Claude through the API: {'ready (' + why + ')' if ok else why}; without a key the writers' room uses Claude Code (claude -p)")


# ---- the check ----------------------------------------------------------------------------------------------------

def valid(schema, data, path="$"):
    """The JSON schema subset the stages use (type, properties, required, additionalProperties, enum, anyOf, items)."""
    errs = []
    if "anyOf" in schema:
        if not any(not valid(s, data, path) for s in schema["anyOf"]):
            errs.append(f"{path}: matches none of anyOf")
        return errs
    t = schema.get("type")
    ok = {"object": isinstance(data, dict), "array": isinstance(data, list), "string": isinstance(data, str), "null": data is None,
          "integer": isinstance(data, int) and not isinstance(data, bool), "number": isinstance(data, (int, float)) and not isinstance(data, bool),
          "boolean": isinstance(data, bool)}.get(t, True)
    if not ok:
        return [f"{path}: not {t}"]
    if "enum" in schema and data not in schema["enum"]:
        errs.append(f"{path}: {data!r} not in {schema['enum']}")
    if t == "object":
        props = schema.get("properties", {})
        for k in schema.get("required", []):
            if k not in data:
                errs.append(f"{path}.{k}: missing")
        if schema.get("additionalProperties") is False:
            errs += [f"{path}.{k}: not in the schema" for k in data if k not in props]
        for k, v in data.items():
            if k in props:
                errs += valid(props[k], v, f"{path}.{k}")
    if t == "array":
        for i, v in enumerate(data):
            errs += valid(schema.get("items", {}), v, f"{path}[{i}]")
    return errs


def closed(schema, path="$"):
    """Every object closed and every property required (what structured outputs accept)."""
    out = []
    if isinstance(schema, dict):
        if schema.get("type") == "object" and "properties" in schema:
            if schema.get("additionalProperties") is not False or set(schema.get("required", [])) != set(schema["properties"]):
                out.append(path)
        for k, v in schema.items():
            out += closed(v, f"{path}.{k}")
    elif isinstance(schema, list):
        for i, v in enumerate(schema):
            out += closed(v, f"{path}[{i}]")
    return out


def cmd_check(a):
    fails = []
    ok = lambda m: print("  ok  " + m)
    bad = lambda m: (fails.append(m), print("  FAIL " + m))

    # the prompt library
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
    ok(f"the prompt library: {len(lib)} faces, each a 4 s post prompt ({sum('listen' in p['tags'] for p in lib.values())} listening, "
       f"{sum('tell' in p['tags'] for p in lib.values())} tells), loops in range, he for she") if not probs else bad("the library: " + "; ".join(probs[:6]))

    # the schemas: closed, and the stand-in's answers fit them (what a real model is held to)
    schemas = {"bible": gen.BIBLE, "endings": gen.ENDINGS, "river": gen.RIVER, "details": gen.DETAILS, "chat": gen.CHAT}
    opened = [f"{k}: {p}" for k, s in schemas.items() for p in closed(llm.strict(s))]
    fits = []
    for k, s in schemas.items():
        users = ["THE ACT: a1", "THE ACT: a2", "THE ACT: a3"] if k == "details" else ['"selected": "p03" THE USER: add a secret'] if k == "chat" else [""]
        for u in users:
            fits += [f"{k}: {e}" for e in valid(llm.strict(s), fake.answer(k, u))[:3]]
    ok("every stage's schema is closed (structured outputs take it) and the stand-in's answers fit them") if not opened and not fits else bad("schemas: " + "; ".join((opened + fits)[:6]))

    # a draft end to end on the stand-in, in a scratch folder
    with tempfile.TemporaryDirectory() as tmp:
        proto.PROTOS = Path(tmp)
        P = proto.new_session("Come Over", {"kind": "a distant friend invites you over and something isn't quite right",
                                            "references": "a friend who kept her grandmother's room shut", "endings": ["", "", ""]})
        saves = []
        gen.draft(P, llm.Fake(fake.answer), None, lambda q: saves.append(proto.save(q)))
        errs, warns = proto.check(P)
        talks = [p for p, _, _ in proto.all_points(P) if p.get("talk")]
        if errs:
            bad("the stand-in's draft: " + "; ".join(errs[:6]))
        elif len(P["endings"]) != 3 or len(P["points"]) < 10 or not talks or len(saves) < 5:
            bad(f"the draft: {len(P['endings'])} endings, {len(P['points'])} points, {len(talks)} talks, {len(saves)} saves")
        else:
            ok(f"a draft on the stand-in: bible, river and {len(P['acts'])} acts of details, saved as each landed ({len(saves)} saves); "
               f"{len(P['points'])} points, {proto.main_minutes(P):.0f} min, {len(talks)} talks, {len(P['secrets'])} secrets; no problems, {len(warns)} warnings")
        rt = proto.river_text(P, detail=True)
        missing = [p["id"] for p, _, _ in proto.all_points(P) if p["id"] not in rt]
        ok("the river as text names every point, the secrets and the endings") if not missing and "★ secret" in rt and "ENDINGS" in rt else bad(f"river text: missing {missing}")

        # a stage's problems go back to the model, and the second answer is taken
        class Twice:
            label = "twice"
            def __init__(self):
                self.calls, self.msgs = 0, []
            def ask(self, system, user, schema, kind, progress=None):
                self.calls += 1
                self.msgs.append(user)
                d = fake.answer(kind, user)
                if self.calls == 1:
                    d = json.loads(json.dumps(d))
                    d["cast"][0]["id"] = "Hana Sato"
                return d
        t = Twice()
        Q = proto.blank("x")
        Q["id"] = "x"
        gen.stage_bible(Q, t)
        ok("a stage's problems go back to the model with its request; the fixed answer is taken") if t.calls == 2 and "Hana Sato" in t.msgs[1] and Q["bible"]["cast"][0]["id"] == "hana" \
            else bad(f"retries: {t.calls} calls")

        # the assistant: a change applied, the same prototype left alone, a question answered
        reply, Q, done, couldnt = gen.chat(P, "add a secret here", {"tab": "river", "selected": "p05"}, llm.Fake(fake.answer))
        s = next((x for x in Q["secrets"] if x["id"] == "s_garden"), None)
        if not s or s["after"] != "p05" or "s_garden" in json.dumps(P) or couldnt or not reply:
            bad(f"chat: {done} {couldnt} {reply!r}")
        else:
            ok(f"the assistant sees the view (the picked point) and its changes apply: {', '.join(done)}")
        Q2, done2, bad2 = proto.apply_changes(P, [
            {"op": "add", "what": "point", "after": "p05", "value_json": json.dumps({"id": "p05b", "act": "a2", "type": "scene", "title": "A knock", "where": "genkan", "who": [], "minutes": 2, "what": "x", "player": "y"})},
            {"op": "move", "what": "point", "id": "p05b", "after": "p06"},
            {"op": "set", "what": "bible", "field": "tone", "value_json": json.dumps("colder")},
            {"op": "remove", "what": "secret", "id": "s_chair"},
            {"op": "set", "what": "point", "id": "p08a", "field": "minutes", "value_json": "3"},
            {"op": "set", "what": "point", "id": "nope", "field": "x", "value_json": "1"}])
        order = [p["id"] for p in Q2["points"]]
        fork_pt, _, _ = proto.point_by_id(Q2, "p08a")
        if order.index("p05b") != order.index("p06") + 1 or Q2["bible"]["tone"] != "colder" or any(x["id"] == "s_chair" for x in Q2["secrets"]) \
                or fork_pt["minutes"] != 3 or len(bad2) != 1:
            bad(f"changes: {done2} {bad2}")
        else:
            ok("changes: add after, move, set the bible, remove, set inside a fork's way; one to nothing is reported, not applied")

        # the build: into a scratch game, through the story check
        if (HERE / "build.py").exists():
            import build
            res = build.check_build(P)
            (ok if res["ok"] else bad)(res["message"])

    # the backends: what the settings pick
    s = dict(llm.settings(), backend="local")
    picks = [type(llm.backend(s)).__name__]
    s.update(backend="claude", claude_via="code")
    picks.append(type(llm.backend(s)).__name__)
    s.update(claude_via="auto")
    picks.append(type(llm.backend(s)).__name__)
    want = ["Ollama", "ClaudeCode", "ClaudeAPI" if llm.api_ready()[0] else "ClaudeCode"]
    st = llm.status()
    ok(f"the switch picks the backend (local: Ollama; Claude: the API with a key, else Claude Code); here: API {st['claude-api']['why']}, "
       f"Claude Code {'yes' if st['claude-code']['ok'] else 'no'}, Ollama {'yes' if st['local']['ok'] else 'no'}") if picks == want else bad(f"backends: {picks} for {want}")

    print("WRITERS " + ("ok" if not fails else f"FAILED ({len(fails)})"))
    sys.exit(1 if fails else 0)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list")
    s = sub.add_parser("new"); s.add_argument("title"); s.add_argument("--kind")
    s = sub.add_parser("show"); s.add_argument("id"); s.add_argument("point", nargs="?")
    s = sub.add_parser("river"); s.add_argument("id")
    sub.add_parser("now")
    s = sub.add_parser("draft"); s.add_argument("id"); s.add_argument("--stage", default="all", choices=["all", "bible", "endings", "river", "details"])
    s.add_argument("--backend", choices=["claude", "local", "fake"])
    s = sub.add_parser("build"); s.add_argument("id"); s.add_argument("--game", required=True); s.add_argument("--force", action="store_true")
    sub.add_parser("setup")
    sub.add_parser("check")
    a = ap.parse_args(argv)
    {"list": cmd_list, "new": cmd_new, "show": cmd_show, "river": cmd_river, "now": cmd_now, "draft": cmd_draft,
     "build": cmd_build, "setup": cmd_setup, "check": cmd_check}[a.cmd](a)


if __name__ == "__main__":
    main()
