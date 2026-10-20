#!/usr/bin/env python3
"""The script generator: an outline -> a format 3 story, drafted by a local model (Ollama) scene by scene, so prompting
Claude is for the reviews and the glue (docs/PIPELINE.md §3, PIPELINE_V2_PLAN W7).

    python tools/scriptgen.py --game G new outline.md [--minutes 15]   every step below, in order (resumes: a step
                                                                       whose output exists is skipped; --redo redoes)
    python tools/scriptgen.py --game G bible outline.md   the story bible: premise, tone, cast, places, karma, endings
    python tools/scriptgen.py --game G cards              the beat sheet: one card per scene or task, act by act
    python tools/scriptgen.py --game G scenes [card]      each scene's English draft, one at a time (bible + the last
                                                          scene's summary + its card: well inside the context window)
    python tools/scriptgen.py --game G assemble           the drafts -> Content/Games/G/story.json (format 3): a greybox
                                                          room per place, the scenes and their Kimodo segments, timed
                                                          choices with karma, tasks with a guide-back, endings by karma
    python tools/scriptgen.py --game G review             Saved/Story/G/script/review.md: the pack Claude reviews
    python tools/scriptgen.py setup                       how to install Ollama and the model; checks it answers

Everything the model writes is JSON against a schema (Ollama's structured outputs), checked, and sent back with the
error when it's wrong (three tries). `--fake` answers with a stand-in instead of the model (the tool's own test).
The drafts live in Content/Games/G/script/ (bible.json, cards.json, scenes/<card>.json), so you can edit any of
them and assemble again. The English is a draft: you refine it, then Claude's Japanese pass (§5) writes ja, the
subtitles and the MiniMax fields. The model and its settings: setup/scriptgen.json.
"""
import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "Content" / "Python"))
from storykit import storylib as L  # noqa: E402

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

CONF_FILE = ROOT / "setup" / "scriptgen.json"
DEFAULT_CONF = {"url": "http://127.0.0.1:11434", "model": "qwen3.6:27b", "num_ctx": 32768, "temperature": 0.8,
                "tries": 3, "timeout": 600}

STYLE = """You write for HorrorStudio: short first-person horror romance games: obsession and yandere, as in Japanese anime
and games, with Resident Evil 7's point of view. She is close, she talks to you, she waits for your answer. Mood
carries everything: silence, the ordinary gone wrong, devotion that is a little too much. The player is "you", the
quiet one: characters speak to you face to face. Rules you never break:
- She is likeable first: sweet, attentive, remembering everything. Small tells, then the turn, and the turn is
  about you (jealousy, fear you'll leave). The tender staging (her face close, a hand on your cheek) becomes the
  threat (the hand on your throat, the door locked behind her).
- Every spoken line is one beat of at most 12 English words: one sentence, said in about 7 seconds once it is
  Japanese. Longer speech is several lines, with pauses and expressions between them.
- Replies: some lines hang, a question she waits on; the player picks one of two short replies (one to four words,
  both believable: warm or cool, honest or evasive); she answers that reply in one line; the next line must work
  after either reply and after silence. Now and then a reply is remembered later.
- The ending comes from karma: how the player answered and reacted (kind, cruel, silent).
- Gameplay between scenes is simple, for players raised on Roblox: hide, run, collect, sneak, hold still, search,
  escape. One-line rules ("hide before I count to ten"), a warning before, 30 to 60 seconds. Being caught can kill
  you: each death is a short scene, and the player returns to the round just before. Strikes escalate: cute,
  then a tease, then the death.
- Intimacy is distance, gaze, touch, breath and whispers; nothing explicit, the tension is the point.
- Bodies stay simple (80%: standing, sitting, turning, walking over, small gestures; 15% an activity; 5% action
  like a slap or a fall). The face and voice do the acting.
- Choices are short replies the player picks in 30 seconds; silence is always an answer."""

BIBLE_SCHEMA = {"type": "object", "required": ["title", "logline", "tone", "locations", "cast", "karma", "endings"], "properties": {
    "title": {"type": "string"}, "logline": {"type": "string"}, "tone": {"type": "string"},
    "locations": {"type": "array", "items": {"type": "object", "required": ["id", "name", "look"], "properties": {
        "id": {"type": "string"}, "name": {"type": "string"}, "look": {"type": "string"}}}},
    "cast": {"type": "array", "items": {"type": "object", "required": ["id", "name", "role", "voice", "wants", "hides"], "properties": {
        "id": {"type": "string"}, "name": {"type": "string"}, "role": {"type": "string"}, "subject": {"type": "string"},
        "voice": {"type": "string"}, "wants": {"type": "string"}, "hides": {"type": "string"}}}},
    "karma": {"type": "object", "required": ["kind_means", "cruel_means"], "properties": {
        "kind_means": {"type": "string"}, "cruel_means": {"type": "string"}}},
    "endings": {"type": "object", "required": ["good", "neutral", "bad"], "properties": {
        k: {"type": "object", "required": ["title", "what"], "properties": {"title": {"type": "string"}, "what": {"type": "string"}}}
        for k in ("good", "neutral", "bad")}},
    "eggs": {"type": "array", "items": {"type": "object", "properties": {"find": {"type": "string"}, "scene": {"type": "string"}}}}}}

CARD = {"type": "object", "required": ["id", "kind", "title", "where", "who", "purpose", "minutes"], "properties": {
    "id": {"type": "string"}, "kind": {"type": "string", "enum": ["scene", "task", "play"]}, "title": {"type": "string"},
    "where": {"type": "string"}, "who": {"type": "array", "items": {"type": "string"}}, "purpose": {"type": "string"},
    "beats": {"type": "array", "items": {"type": "string"}}, "minutes": {"type": "number"},
    "choice": {"type": "object", "properties": {"prompt": {"type": "string"}, "options": {"type": "array", "items": {
        "type": "object", "required": ["label", "karma"], "properties": {"label": {"type": "string"}, "karma": {"type": "integer"}}}}}},
    "task": {"type": "object", "properties": {"goal": {"type": "string"}, "secs": {"type": "number"}, "guide_back": {"type": "string"}}},
    "play": {"type": "object", "properties": {"type": {"type": "string", "enum": list(L.PLAYS)}, "rule": {"type": "string"},
        "warn": {"type": "string"}, "secs": {"type": "number"}, "death": {"type": "string"}}}}}
CARDS_SCHEMA = {"type": "object", "required": ["cards"], "properties": {"cards": {"type": "array", "items": CARD}}}

SCENE_SCHEMA = {"type": "object", "required": ["clips", "summary"], "properties": {
    "clips": {"type": "array", "items": {"type": "object", "required": ["who", "en", "act"], "properties": {
        "who": {"type": "string"}, "en": {"type": "string"}, "act": {"type": "string"}, "expr": {"type": "string"},
        "voice": {"type": "string"}, "body": {"type": "string"}, "tier": {"type": "string", "enum": ["simple", "activity", "action"]},
        "wait_expr": {"type": "string"},
        "reply": {"type": "array", "items": {"type": "object", "required": ["label", "answer"], "properties": {
            "label": {"type": "string"}, "answer": {"type": "string"}, "act": {"type": "string"}, "expr": {"type": "string"},
            "voice": {"type": "string"}, "flag": {"type": "string"}}}}}}},
    "summary": {"type": "string"}}}


def conf():
    c = dict(DEFAULT_CONF)
    if CONF_FILE.exists():
        c.update({k: v for k, v in json.loads(CONF_FILE.read_text(encoding="utf-8")).items() if not k.startswith("_")})
    return c


def slug(s, n=3):
    w = re.findall(r"[a-z0-9]+", s.lower())
    return "_".join(w[:n]) or "x"


# ---- the model ------------------------------------------------------------------------------------------------

def ask_ollama(system, user, schema, c):
    body = {"model": c["model"], "stream": False, "format": schema,
            "options": {"num_ctx": c["num_ctx"], "temperature": c["temperature"]},
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
    req = urllib.request.Request(c["url"].rstrip("/") + "/api/chat", data=json.dumps(body).encode("utf-8"),
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=c["timeout"]) as r:
            return json.loads(r.read().decode("utf-8"))["message"]["content"]
    except urllib.error.URLError as e:
        sys.exit(f"no answer from Ollama at {c['url']} ({e}): python tools/scriptgen.py setup")


def fake(kind, ctx):
    """A stand-in for the model (--fake): deterministic answers shaped like real ones, to test the tool."""
    if kind == "bible":
        return {"title": ctx["title"], "logline": "You visit your sister's apartment; she says she has been waiting a long time.",
                "tone": "quiet dread, warm light gone wrong", "locations": [
                    {"id": "door", "name": "The front door", "look": "a narrow genkan, shoes lined up"},
                    {"id": "room", "name": "Her room", "look": "a futon, a low table, the curtains drawn"}],
                "cast": [{"id": "aya", "name": "Aya", "role": "your sister", "subject": "she", "voice": "soft, too calm",
                          "wants": "for you to stay", "hides": "she died a year ago"}],
                "karma": {"kind_means": "you treat her as alive", "cruel_means": "you deny her"},
                "endings": {"good": {"title": "Tea for two", "what": "she lets you go"},
                            "neutral": {"title": "The door stays shut", "what": "you leave; she waits"},
                            "bad": {"title": "Stay", "what": "you never leave the room"}}, "eggs": []}
    if kind == "cards":
        return {"cards": [
            {"id": "arrive", "kind": "scene", "title": "She opens the door", "where": "door", "who": ["aya"], "purpose": "meet her",
             "beats": ["she opens the door", "she is too happy"], "minutes": 1,
             "choice": {"prompt": "", "options": [{"label": "I missed you.", "karma": 1}, {"label": "You look different.", "karma": 0},
                                                  {"label": "(Say nothing)", "karma": -1}]}},
            {"id": "hide", "kind": "play", "title": "Hide and seek", "where": "room", "who": ["aya"], "purpose": "a game from when you were small",
             "minutes": 1, "play": {"type": "hide", "rule": "Hide before she counts to ten", "warn": "she counts out loud", "secs": 40,
                                    "death": "She finds you, and keeps you"}},
            {"id": "tea", "kind": "task", "title": "Make the tea", "where": "room", "who": ["aya"], "purpose": "find the cups",
             "minutes": 3, "task": {"goal": "Find two cups", "secs": 240, "guide_back": "she hands you a cup herself"}},
            {"id": "truth", "kind": "scene", "title": "The photo", "where": "room", "who": ["aya"], "purpose": "she knows",
             "beats": ["she sees the funeral photo"], "minutes": 1,
             "choice": {"prompt": "", "options": [{"label": "I'll stay with you.", "karma": 2}, {"label": "You're not real.", "karma": -2},
                                                  {"label": "(Look away)", "karma": 0}]}}]}
    if kind == "scene":
        card = ctx["card"]
        who = (card.get("who") or ["aya"])[0]
        return {"clips": [{"who": who, "en": "...You came.", "act": "a long look, then a small smile", "expr": "a small, tired smile",
                           "voice": "whispers", "body": "", "tier": "simple"},
                          {"who": who, "en": "Did you miss me?", "act": "head tilted, waiting", "expr": "a hopeful smile", "voice": "says softly",
                           "wait_expr": "a hopeful, expectant expression", "reply": [
                               {"label": "Yeah.", "answer": "I knew it. I always know.", "expr": "a delighted, knowing smile", "voice": "says softly"},
                               {"label": "...Not really.", "answer": "Liar. You're blushing.", "expr": "a teasing smile that doesn't move", "voice": "says flatly", "flag": "denied_her"}]},
                          {"who": who, "en": "I kept everything the way you left it.", "act": "turns to the room",
                           "expr": "a proud, fragile smile", "voice": "says softly", "body": "turns around slowly", "tier": "simple"}],
                "summary": f"{card['title']}: she is glad you came, too glad."}
    raise ValueError(kind)


def ask(kind, system, user, schema, check, ctx, a):
    """The model's JSON for one step, checked; its errors go back to it (three tries)."""
    c = conf()
    msg = user
    for attempt in range(c["tries"]):
        if a.fake:
            data = fake(kind, ctx)
        else:
            raw = ask_ollama(system, msg, schema, c)
            try:
                data = json.loads(raw)
            except ValueError as e:
                msg = user + f"\n\nYour last answer wasn't valid JSON ({e}). Answer again, JSON only."
                continue
        errs = check(data)
        if not errs:
            return data
        print(f"  try {attempt + 1}: {'; '.join(errs[:4])}")
        msg = user + "\n\nYour last answer broke these rules; fix them and answer again:\n- " + "\n- ".join(errs)
    sys.exit(f"{kind}: the model couldn't satisfy the rules in {c['tries']} tries (edit the file by hand, or rerun)")


# ---- the steps ------------------------------------------------------------------------------------------------

def gdir(game):
    return L.GAMES / game / "script"


def load_json(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))


def save_json(p, data):
    Path(p).parent.mkdir(parents=True, exist_ok=True)
    Path(p).write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")


def compact_bible(b):
    cast = "; ".join(f"{c['id']}: {c['name']}, {c['role']} (voice {c['voice']}; wants {c['wants']}; hides {c['hides']})" for c in b["cast"])
    locs = "; ".join(f"{x['id']}: {x['name']} ({x['look']})" for x in b["locations"])
    ends = "; ".join(f"{k}: {v['title']} ({v['what']})" for k, v in b["endings"].items())
    return (f"TITLE {b['title']}\nLOGLINE {b['logline']}\nTONE {b['tone']}\nCAST {cast}\nPLACES {locs}\n"
            f"KARMA kind = {b['karma']['kind_means']}; cruel = {b['karma']['cruel_means']}\nENDINGS {ends}")


def check_bible(b):
    errs = []
    ids = [c.get("id", "") for c in b.get("cast", [])] + [x.get("id", "") for x in b.get("locations", [])]
    for i in ids:
        if not re.match(r"^[a-z][a-z0-9_]*$", i):
            errs.append(f"id {i!r}: lower case letters, digits and _ only")
    if len(set(ids)) != len(ids):
        errs.append("cast and location ids must all differ")
    if not b.get("cast"):
        errs.append("no cast")
    if not b.get("locations"):
        errs.append("no locations")
    return errs


def step_bible(game, outline, a):
    out = gdir(game) / "bible.json"
    if out.exists() and not a.redo:
        print(f"bible: {out.relative_to(ROOT)} exists (--redo to write it again)")
        return load_json(out)
    text = Path(outline).read_text(encoding="utf-8")
    user = (f"The user's outline for a {a.minutes}-minute game:\n\n{text}\n\nWrite the story bible: a title, a one-line "
            "logline, the tone in a few words, 2 to 5 places (short lower-case ids), the cast (short lower-case ids; "
            "subject she or he; how each one's voice sounds; what each wants and hides), what kindness and cruelty mean "
            "in this story (the karma), and the three endings (good, neutral, bad: the bad one may kill the hero). "
            "Optional easter eggs: something found that unlocks an extra scene and then rejoins the story.")
    b = ask("bible", STYLE, user, BIBLE_SCHEMA, check_bible, {"title": game}, a)
    save_json(out, b)
    print(f"bible: {b['title']}: {len(b['cast'])} cast, {len(b['locations'])} places -> {out.relative_to(ROOT)}")
    return b


def check_cards(cards, bible):
    errs, ids = [], set()
    cast, locs = {c["id"] for c in bible["cast"]}, {x["id"] for x in bible["locations"]}
    for c in cards.get("cards", []):
        cid = c.get("id", "")
        if not re.match(r"^[a-z][a-z0-9_]*$", cid) or cid in ids:
            errs.append(f"card id {cid!r}: unique, lower case")
        ids.add(cid)
        if c.get("where") not in locs:
            errs.append(f"card {cid}: where {c.get('where')!r} isn't a place ({', '.join(sorted(locs))})")
        for w in c.get("who", []):
            if w not in cast:
                errs.append(f"card {cid}: who {w!r} isn't in the cast")
        if c.get("kind") == "scene" and not c.get("who"):
            errs.append(f"card {cid}: a scene needs someone in it")
        if c.get("kind") == "task" and not (c.get("task") or {}).get("goal"):
            errs.append(f"card {cid}: a task needs task.goal")
        if c.get("kind") == "play" and ((c.get("play") or {}).get("type") not in L.PLAYS or not (c.get("play") or {}).get("rule")):
            errs.append(f"card {cid}: a play needs play.type ({', '.join(L.PLAYS)}) and a one-line play.rule")
        for o in (c.get("choice") or {}).get("options", []):
            if not -3 <= int(o.get("karma", 0)) <= 3:
                errs.append(f"card {cid}: karma {o.get('karma')} (keep it -3 to 3)")
    if not any((c.get("choice") or {}).get("options") for c in cards.get("cards", [])):
        errs.append("no card has a choice: the karma needs several")
    return errs


def step_cards(game, a):
    out = gdir(game) / "cards.json"
    if out.exists() and not a.redo:
        print(f"cards: {out.relative_to(ROOT)} exists (--redo to write it again)")
        return load_json(out)
    bible = load_json(gdir(game) / "bible.json")
    acts = [("the first act: normal life, the first wrongness, the first choice", 0.25),
            ("the second act: it gets worse; tasks between scenes; choices that cost something", 0.5),
            ("the third act: the turn, the reveal, the last choices before the ending", 0.25)]
    cards, prev = [], ""
    for name, share in acts:                           # act by act: each answer stays small
        user = (f"{compact_bible(bible)}\n\nCards so far: {prev or 'none'}\n\nWrite the cards for {name}, about "
                f"{a.minutes * share:.0f} minutes. Alternate scenes (people talking to you) and tasks (things you do "
                "alone: search, solve, hide, carry; a timer in seconds and how you're guided on if you're too slow). "
                "Most scenes end in a choice of three short replies with karma -3 to 3 (one silent). Some cards are play: one round of "
                "simple gameplay (hide, run, collect, sneak, hold, search, escape) with a one-line rule, a warning, 30 to 60 secs, "
                "and `death` (what happens if you're caught) when being caught kills you. Ids are lower case.")
        part = ask("cards", STYLE, user, CARDS_SCHEMA, lambda d: check_cards({"cards": cards + d.get("cards", [])}, bible) if d.get("cards") else ["no cards"],
                   {"act": name}, a)
        new = [c for c in part["cards"] if c["id"] not in {x["id"] for x in cards}]
        cards += new
        prev = "; ".join(f"{c['id']} ({c['kind']}: {c['title']})" for c in cards)
        if a.fake:
            break                                      # the stand-in has one act's worth
    save_json(out, {"cards": cards})
    print(f"cards: {len(cards)} ({sum(c['kind'] == 'scene' for c in cards)} scenes, {sum(c['kind'] == 'task' for c in cards)} tasks) -> {out.relative_to(ROOT)}")
    return {"cards": cards}


def check_scene(d, card, bible):
    errs = []
    cast = {c["id"] for c in bible["cast"]}
    if not d.get("clips"):
        errs.append("no clips")
    for i, c in enumerate(d.get("clips", [])):
        if c.get("who") not in cast:
            errs.append(f"clip {i + 1}: who {c.get('who')!r} isn't in the cast ({', '.join(sorted(cast))})")
        words = len(c.get("en", "").split())
        if words > 14:
            errs.append(f"clip {i + 1}: {words} words: one beat is 12 words at most; split it into two clips")
        if c.get("body") and len(c["body"].split()) > 10:
            errs.append(f"clip {i + 1}: body {c['body']!r}: one plain action, a few words")
        rp = c.get("reply") or []
        if rp and len(rp) != 2:
            errs.append(f"clip {i + 1}: a reply has exactly two options (left and right)")
        for o in rp:
            if len(o.get("label", "").split()) > 5:
                errs.append(f"clip {i + 1}: reply {o.get('label')!r}: the player says one to four words")
            if len(o.get("answer", "").split()) > 14:
                errs.append(f"clip {i + 1}: her answer {o.get('answer')!r}: one beat, 12 words at most")
    return errs


def step_scenes(game, a, only=None):
    bible = load_json(gdir(game) / "bible.json")
    cards = load_json(gdir(game) / "cards.json")["cards"]
    summary = ""
    for card in cards:
        out = gdir(game) / "scenes" / f"{card['id']}.json"
        if card["kind"] != "scene":
            continue
        if (only and card["id"] != only) or (out.exists() and not a.redo):
            if out.exists():
                summary = load_json(out).get("summary", summary)
            continue
        ch = card.get("choice") or {}
        user = (f"{compact_bible(bible)}\n\nThe story so far: {summary or 'this is the first scene'}\n\nThis scene: "
                f"{json.dumps(card, ensure_ascii=False)}\n\nWrite its clips in order: each one line (12 words at most) "
                "with who says it, the acting note (act), the facial expression as visible movement (expr, a noun phrase "
                "like 'a frightened expression, eyes wide'), how it's said (voice: says, whispers, says angrily, screams, "
                "murmurs, sobs, says softly, says coldly, says flatly, pleads), the body's one plain action if it moves "
                "(body, like 'sits down on the bed'; empty if still) and its tier. Leave pauses: a short line, a look, "
                "then the next. 4 to 10 clips. One or two of them may hang: a question she waits on, with wait_expr (the face "
                "she holds) and `reply`: two short replies (label: what you say, one to four words) and her one-line answer to "
                "each (answer, with act, expr, voice; flag if the story should remember it). The clip after a reply must work "
                "after either answer and after silence." + (" The last clip leads into the player's choice: " + "; ".join(
                    o["label"] for o in ch.get("options", [])) if ch.get("options") else "") +
                " Then a one-sentence summary of what happened.")
        d = ask("scene", STYLE, user, SCENE_SCHEMA, lambda x: check_scene(x, card, bible), {"card": card}, a)
        save_json(out, d)
        summary = d["summary"]
        print(f"scene {card['id']}: {len(d['clips'])} clips -> {out.relative_to(ROOT)}")


# ---- assembling the story ---------------------------------------------------------------------------------------

ROOM_W, ROOM_D = 6.0, 5.0


def greybox(bible, game):
    """A room per place, in a row north from the first, each with a spot per cast member and one for your eye."""
    rooms, links = [], []
    locs = bible["locations"]
    for i, x in enumerate(locs):
        props = [{"id": f"{x['id']}_view", "use": "spot", "at": [ROOM_W / 2, 1.2], "rot": 90},
                 {"id": f"{x['id']}_lamp", "use": "light", "kind": "bulb", "lit": True, "flicker": 0.1, "at": [ROOM_W / 2, ROOM_D / 2], "z": 2.6}]
        for j, c in enumerate(bible["cast"]):
            props.append({"id": f"{x['id']}_{c['id']}_spot", "use": "spot", "at": [1.5 + j * 1.5 if len(bible['cast']) > 1 else ROOM_W / 2, 3.8], "rot": 270})
        room = {"id": x["id"], "at": [0, i * ROOM_D, 0], "size": [ROOM_W, ROOM_D, 2.8], "floor": "wood", "light": "dim", "props": props,
                "note": x.get("look", "")}
        if i:
            room["skip"] = ["s"]
            links.append({"a": locs[i - 1]["id"], "b": x["id"], "via": None})
        if i < len(locs) - 1:
            room["openings"] = [{"wall": "n", "at": ROOM_W / 2, "w": 1.2, "h": 2.2}]
        rooms.append(room)
    rooms[0]["props"].append({"id": "start", "use": "spot", "at": [ROOM_W / 2, 0.8], "rot": 90})
    return {"main": {"start": "start", "rooms": rooms, "links": links}}


def body_of(game, sid, cid, c, secs):
    act = (c.get("body") or "").strip().rstrip(".")
    if not act:
        return None
    prompt = act if re.match(r"^(A|An) ", act) else "A person " + act
    return {"tier": c.get("tier") or "simple",
            "segments": [{"name": f"{game.lower()}_{sid[2:]}_{cid}_01_{slug(act, 1)}", "prompt": prompt, "secs": max(2.0, min(10.0, round(secs, 1)))}]}


def step_assemble(game, a):
    bible = load_json(gdir(game) / "bible.json")
    cards = load_json(gdir(game) / "cards.json")["cards"]
    path = L.GAMES / game / "story.json"
    if path.exists() and not a.redo and json.loads(path.read_text(encoding="utf-8")).get("format") == 3 and not a.force:
        print(f"assemble: {path.relative_to(ROOT)} exists: --force to write over it (your edits in it would go)")
        return
    S = {"format": 3, "game": {"id": game, "title": bible["title"], "start": "n_start", "target_min": a.minutes,
                               "fast_min": round(a.minutes * 0.7), "voice": "ja", "text": "en", "subtitles": ["en", "zh"],
                               "clip_max": 8, "karma": {"axes": {"karma": {"min": -10, "max": 10,
                               "label": f"kind: {bible['karma']['kind_means']}; cruel: {bible['karma']['cruel_means']}"}}},
                               "logline": bible["logline"], "tone": bible["tone"],
                               "built_with": {"engine": L.engine_version(), "format": 3}},
         "cast": {c["id"]: {"name": c["name"], "subject": c.get("subject", "she"), "metahuman": None, "height": 1.65,
                            "note": f"{c['role']}; voice {c['voice']}; wants {c['wants']}; hides {c['hides']}"} for c in bible["cast"]},
         "items": {}, "notes": {}, "lines": {}, "sounds": {}, "levels": greybox(bible, game),
         "scenes": {}, "stitches": {}, "flow": {}, "secrets": {}, "motions": {},
         "board": [{"by": "claude", "at": "", "text": "Drafted by tools/scriptgen.py from the outline: the English is a draft "
                    "for you to refine; then the Japanese pass. Tasks are placeholders (a clue to read) and plays are cards until they're built."}]}
    first = bible["locations"][0]["id"]
    S["stitches"]["t_start"] = {"title": "Start", "level": "main", "beats": [
        {"id": "b_start", "when": {"start": True}, "do": [{"fade": "in", "secs": 2}, {"done": True}]}]}
    order = ["n_start"]
    for card in cards:
        cid, where = card["id"], card["where"]
        if card["kind"] == "scene":
            f = gdir(game) / "scenes" / f"{cid}.json"
            if not f.exists():
                print(f"  {cid}: no draft yet (scriptgen.py scenes)")
                continue
            d = load_json(f)
            sid = f"s_{cid}"
            who = card["who"][0]
            clips = []
            for i, c in enumerate(d["clips"]):
                clip = {"id": f"c{i + 1}", "who": c["who"], "en": c["en"], "en_draft": c["en"], "act": c.get("act", "")}
                for k in ("expr", "voice"):
                    if c.get(k):
                        clip[k] = c[k]
                if i:
                    clip["seam"] = {"kind": "blink" if i % 3 else "turn"}
                b = body_of(game, sid, clip["id"], c, L.clip_secs(clip))
                if b:
                    clip["body"] = b
                if c.get("reply"):                     # a hanging line: two replies, her answer to each
                    clip["wait_expr"] = c.get("wait_expr") or "a hopeful, expectant expression"
                    clip["reply"] = {"wait": L.REPLY_SECS, "timeout": None, "options": []}
                    for j, o in enumerate(c["reply"][:2]):
                        then = {"en": o["answer"], "en_draft": o["answer"], "act": o.get("act", "")}
                        then.update({k: o[k] for k in ("expr", "voice") if o.get(k)})
                        opt = {"id": f"r{j + 1}", "label": o["label"], "then": then}
                        if o.get("flag"):
                            opt["sets"] = [{"flag": o["flag"]}]
                        clip["reply"]["options"].append(opt)
                clips.append(clip)
            ch = card.get("choice") or {}
            if ch.get("options") and clips:
                opts = [{"id": f"o{j + 1}", "label": o["label"], "karma": int(o.get("karma", 0))} for j, o in enumerate(ch["options"])]
                silent = min(opts, key=lambda o: (abs(o["karma"]) if "(" in o["label"] else 99, o["karma"]))
                clips[-1]["event"] = {"type": "choose", "prompt": ch.get("prompt", ""), "options": opts, "default": silent["id"]}
            S["scenes"][sid] = {"title": card["title"], "level": "main", "view": f"{where}_view", "mood": "dread",
                                "stage": {w: f"{where}_{w}_spot" for w in card["who"]},
                                "camera": {"mode": "soft", "look": who, "cone": [30, 18]}, "clips": clips,
                                "notes": [{"by": "claude", "text": f"purpose: {card['purpose']}; beats: {'; '.join(card.get('beats', []))}"}]}
            order.append(f"n_{cid}")
            S["flow"][f"n_{cid}"] = {"type": "scene", "ref": sid}
        elif card["kind"] == "play":                 # a round of gameplay; being caught can be a death
            pl, tid = card.get("play") or {}, f"t_{cid}"
            kind = pl.get("type", "hide")
            S["stitches"][tid] = {"title": card["title"], "level": "main", "template": kind, "target_min": card.get("minutes", 1), "beats": [],
                                  "play": {"type": kind, "secs": float(pl.get("secs", 40)), "rule": pl.get("rule", ""), "warn": pl.get("warn", "")}}
            order.append(f"n_{cid}")
            S["flow"][f"n_{cid}"] = {"type": "stitch", "ref": tid}
            if pl.get("death") and card.get("who"):
                g = card["who"][0]
                win, lose = L.PLAYS[kind]
                S["scenes"][f"s_{cid}_death"] = {"title": f"{card['title']}: caught", "level": "main", "view": f"{where}_view", "mood": "panic",
                                                 "stage": {g: f"{where}_{g}_spot"}, "camera": {"mode": "held", "look": g},
                                                 "clips": [{"id": "c1", "who": g, "en": "...", "en_draft": "...", "act": pl["death"]}],
                                                 "notes": [{"by": "claude", "text": f"the death: {pl['death']} (to write with the user)"}]}
                S["flow"][f"n_{cid}_r"] = {"type": "choice", "by": "result", "of": f"n_{cid}", "options": [{"result": win, "to": None}, {"result": lose, "to": f"n_{cid}_death"}]}
                S["flow"][f"n_{cid}_death"] = {"type": "scene", "ref": f"s_{cid}_death", "next": f"e_{cid}_death"}
                S["flow"][f"e_{cid}_death"] = {"type": "ending", "kind": "death", "title": pl["death"], "retry": f"n_{cid}"}
                order.append(f"n_{cid}_r")
        else:
            t = card.get("task") or {}
            tid, note = f"t_{cid}", f"{cid}_clue"
            S["notes"][note] = {"title": card["title"], "text": t.get("goal", card["purpose"])}
            room = next(r for r in S["levels"]["main"]["rooms"] if r["id"] == where)
            room["props"].append({"id": f"{cid}_clue_prop", "shape": "box 0.21 0.3 0.01", "use": "note", "note": note, "at": [ROOM_W - 1, 2.5]})
            S["stitches"][tid] = {"title": card["title"], "level": "main", "goal": t.get("goal", ""), "target_min": card.get("minutes", 2),
                                  "template": "placeholder", "beats": [
                                      {"id": f"b_{cid}_start", "when": {"start": True}, "do": [{"objective": t.get("goal", card["title"])}]},
                                      {"id": f"b_{cid}_done", "when": {"read": note}, "do": [{"done": True}]}]}
            guide = f"s_{cid}_guide"
            if card.get("who"):
                g = card["who"][0]
                S["scenes"][guide] = {"title": f"{card['title']}: guided on", "level": "main", "view": f"{where}_view", "mood": "calm",
                                      "stage": {g: f"{where}_{g}_spot"}, "camera": {"mode": "soft", "look": g, "cone": [30, 18]},
                                      "clips": [{"id": "c1", "who": g, "en": "...There. Let me.", "en_draft": "...There. Let me.",
                                                 "act": t.get("guide_back", "they help you along")}],
                                      "notes": [{"by": "claude", "text": f"the guide-back: {t.get('guide_back', '')}"}]}
                S["stitches"][tid]["timer"] = {"secs": float(t.get("secs", 180)), "label": card["title"], "fail": f"n_{cid}_guide"}
                S["flow"][f"n_{cid}_guide"] = {"type": "scene", "ref": guide}
            order.append(f"n_{cid}")
            S["flow"][f"n_{cid}"] = {"type": "stitch", "ref": tid}
    S["flow"]["n_start"] = {"type": "stitch", "ref": "t_start"}
    for k in ("good", "neutral", "bad"):            # the endings: a final scene each, then the card
        e = bible["endings"][k]
        g = bible["cast"][0]["id"]
        S["scenes"][f"s_end_{k}"] = {"title": e["title"], "level": "main", "view": f"{first}_view", "mood": "aftermath", "final": True,
                                     "stage": {g: f"{first}_{g}_spot"}, "camera": {"mode": "soft", "look": g, "cone": [30, 18]},
                                     "clips": [{"id": "c1", "who": g, "en": "...", "en_draft": "...", "act": e["what"]}],
                                     "notes": [{"by": "claude", "text": f"the {k} ending: {e['what']} (to write with the user)"}]}
        S["flow"][f"n_end_{k}"] = {"type": "scene", "ref": f"s_end_{k}", "next": f"e_{k}", "final": True}
        S["flow"][f"e_{k}"] = {"type": "ending", "kind": k, "title": e["title"]}
    S["flow"]["n_end"] = {"type": "choice", "by": "karma", "options": [{"min": 2, "to": "n_end_good"}, {"max": -2, "to": "n_end_bad"},
                                                                       {"to": "n_end_neutral"}]}
    order.append("n_end")
    for x, y in zip(order, order[1:]):
        if S["flow"][x].get("type") == "choice" and S["flow"][x].get("by") == "result":   # a play's result: the winner goes on
            S["flow"][x]["options"][0]["to"] = y
            continue
        S["flow"][x]["next"] = y
        if x.endswith("_guide") is False and f"{x}_guide" in S["flow"]:
            S["flow"][f"{x}_guide"]["next"] = y      # guided on, then where the task would have led
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(S, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"assemble: {len(S['scenes'])} scenes, {len(S['stitches'])} tasks -> {path.relative_to(ROOT)}; "
          f"now python tools/check_all.py --game {game}")


def step_review(game, a):
    bible = load_json(gdir(game) / "bible.json")
    cards = load_json(gdir(game) / "cards.json")["cards"]
    out = ROOT / "Saved" / "Story" / game / "script" / "review.md"
    lines = [f"# Review pack: {bible['title']}", "", "For Claude: review against docs/REFERENCES.md (structure, pacing, "
             "scares), docs/KIMODO.md (bodies), docs/VOICES.md (expressions and voices) and the rules in docs/PIPELINE.md. "
             "Write what to change as notes on the scenes (by: claude); fix the glue between scenes yourself.", "",
             "```", compact_bible(bible), "```", ""]
    for card in cards:
        lines.append(f"## {card['id']} ({card['kind']}): {card['title']}  [{card['where']}; {', '.join(card.get('who', []))}; ~{card.get('minutes')} min]")
        lines.append(f"Purpose: {card['purpose']}")
        f = gdir(game) / "scenes" / f"{card['id']}.json"
        if card["kind"] == "scene" and f.exists():
            for c in load_json(f)["clips"]:
                lines.append(f"- **{c['who']}** ({c.get('voice', 'says')}; {c.get('expr', '')}): {c['en']}  _{c.get('act', '')}_"
                             + (f"  [body: {c['body']}]" if c.get("body") else ""))
        if card.get("choice"):
            lines.append("Choice: " + " / ".join(f"{o['label']} ({o['karma']:+d})" for o in card["choice"].get("options", [])))
        if card.get("task"):
            lines.append(f"Task: {card['task'].get('goal')} ({card['task'].get('secs', '?')} s; if too slow: {card['task'].get('guide_back', '')})")
        lines.append("")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lines), encoding="utf-8")
    print(f"review: {out.relative_to(ROOT)} ({len(cards)} cards)")


def step_setup(a):
    c = conf()
    if not CONF_FILE.exists():
        CONF_FILE.write_text(json.dumps(DEFAULT_CONF, indent=1), encoding="utf-8")
        print(f"wrote {CONF_FILE.relative_to(ROOT)} (the model and its settings)")
    print("1. Install Ollama: https://ollama.com/download (Windows: winget install Ollama.Ollama)")
    print(f"2. Pull the model: ollama pull {c['model']}   (Qwen3.6-27B, about 17 GB at Q4: fits the RTX 3090 with a 32k context;")
    print("   the second to compare on Japanese prose: ollama pull gemma3:27b. Put the one you pick in setup/scriptgen.json.)")
    try:
        with urllib.request.urlopen(c["url"].rstrip("/") + "/api/tags", timeout=5) as r:
            tags = [m["name"] for m in json.loads(r.read().decode("utf-8")).get("models", [])]
        print(f"Ollama answers at {c['url']}; models: {', '.join(tags) or 'none yet'}")
        print("SCRIPTGEN ok" if any(t.split(":")[0] == c["model"].split(":")[0] for t in tags) else f"(pull {c['model']} first)")
    except (urllib.error.URLError, OSError):
        print(f"Ollama isn't answering at {c['url']} yet")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--game")
    ap.add_argument("--minutes", type=int, default=15)
    ap.add_argument("--fake", action="store_true", help="a stand-in instead of the model (the tool's own test)")
    ap.add_argument("--redo", action="store_true", help="write a step's output again even if it exists")
    ap.add_argument("--force", action="store_true", help="assemble over an existing format 3 story")
    ap.add_argument("cmd", choices=["new", "bible", "cards", "scenes", "assemble", "review", "setup"])
    ap.add_argument("arg", nargs="?")
    a = ap.parse_args(argv)
    if a.cmd == "setup":
        return step_setup(a)
    if not a.game:
        sys.exit("--game is needed")
    if a.cmd in ("new", "bible"):
        if not a.arg:
            sys.exit("the outline file is needed")
        step_bible(a.game, a.arg, a)
        if a.cmd == "bible":
            return
    if a.cmd in ("new", "cards"):
        step_cards(a.game, a)
    if a.cmd in ("new", "scenes"):
        step_scenes(a.game, a, a.arg if a.cmd == "scenes" else None)
    if a.cmd in ("new", "assemble"):
        step_assemble(a.game, a)
    if a.cmd in ("new", "review"):
        step_review(a.game, a)
    print("SCRIPTGEN ok")


if __name__ == "__main__":
    main()
