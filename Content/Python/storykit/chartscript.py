"""The chart's script (.claude/skills/chart/script.md): the user writes the game any way they like, in a notepad;
Claude writes it out as this script (the /chart command), and this reads it into the writers' room's chart: every part
its shapes (a task where you play, a scene where you watch, a talk where you answer), each keeping what was written as
its steps; the choices their arrows; acts round the parts that make several shapes; the cast, the places and the things
you touch (sized small, medium or large). With a report, line by line, of what each line became. And the other way: a
chart written back as a script (`write`), to change and read in again.

    P, rep = chartscript.read(text)          # a new prototype (no id yet)
    P, rep = chartscript.read(text, old)     # into a session: its id and history kept, a shape you moved stays put
    text = chartscript.write(P)
    rep: {"lines": [{"n", "text", "what", "problems"}], "problems": [...], "counts": {...}}
"""
import copy
import json
import re
from pathlib import Path

from . import proto

SFX_INDEX = proto.ROOT / "Content" / "Studio" / "SFX" / "index.json"
STEP, ROW = 250, 170                    # the chart: one shape to the next, a way below
X0, Y0 = 40, 300
SHAPE_W, SHAPE_H = 200, 92
COLORS = ["#8a63d2", "#3f8fc9", "#c98a2b", "#4fae7c", "#c0473f"]
DEFAULT_SECS = 120                      # a timed task with no time given
PLAYER = {"you", "me", "i", "player", "the player", "myself"}
PRONOUNS = {"she", "he", "they", "her", "his", "their", "him", "them"}
ARTICLES = {"the", "a", "an", "my", "her", "his", "their", "your", "our", "its", "some", "this", "that", "these", "those", "ji's"}
REJOIN = {"either way", "then", "all", "both", "after", "anyway", "everyone", "everybody", "rejoin", "together", "whatever", "after that"}
TIMES = {"day": "day", "morning": "day", "noon": "day", "afternoon": "day", "dawn": "day", "dusk": "dusk", "evening": "dusk",
         "sunset": "dusk", "twilight": "dusk", "night": "night", "midnight": "night", "late": "night"}
SIZES = {"s": "small", "small": "small", "m": "medium", "medium": "medium", "med": "medium", "l": "large", "large": "large", "big": "large"}
SIZE_OF = {                             # a thing's size by its last word, when the note doesn't say
    "small": "key keys phone letter note notes card photo photograph picture cup mug glass book diary pen pencil ring coin wallet "
             "remote lighter candle bottle can tissue knife spoon fork plate bowl teacup teapot kettle pot pan watch necklace "
             "earring bracelet doll toy tape cassette dvd envelope receipt ticket match matches cigarette ashtray torch flashlight "
             "battery batteries charger cable plug switch button sock scarf hat glove gloves mask umbrella towel soap toothbrush "
             "comb brush mirror clock lamp vase jar box_small slip paper map newspaper magazine bell pill pills medicine",
    "medium": "box bag backpack suitcase chair stool bucket mop broom vacuum hoover trash rubbish bin laundry basket plant tv "
              "television radio computer laptop microwave fan heater rug painting frame crate drum guitar bike bicycle chest "
              "dishes cushion pillow blanket futon_small clothes",
    "large": "table desk bed sofa couch fridge refrigerator closet wardrobe cupboard cabinet bookshelf shelf shelves bath bathtub "
             "shower sink toilet stove oven washer dryer piano dresser counter altar butsudan locker futon kotatsu bench",
}
SIZE_OF = {w: s for s, ws in SIZE_OF.items() for w in ws.split()}
DOORS = {"door", "doors", "gate", "fusuma", "shoji", "doorway", "front door", "back door", "screen door", "sliding door"}
LIGHTS = {"light", "lights", "lamp", "lamps", "switch", "light switch", "torch", "flashlight", "bulb"}
# the day's small systems (DECISIONS 2026-10-28): a mess mopped, scrubbed or wiped is a stain (use: clean); the fuse box a
# breaker; a peephole its door's; a flashlight a small thing you take, F switches it
MESS = {"mess", "stain", "stains", "blood", "mud", "puddle", "spill", "vomit", "dirt", "ash", "floor", "footprints", "water", "muck"}
CLEANING = {"mop", "clean", "wipe", "scrub", "sweep", "wash", "tidy"}
BREAKERS = {"breaker", "breakers", "breaker box", "fuse box", "fusebox", "fuse", "fuses", "circuit breaker", "fuse board", "power box"}
PEEPHOLES = {"peephole", "peep hole", "spyhole", "spy hole", "door viewer", "eyehole"}
TORCHES = {"flashlight", "torch", "penlight", "flash light"}
# the player's verbs: the phrase as written -> what it does (script.md "Things you do")
VERBS = [
    ("pick up", "take"), ("pick", "take"), ("take", "take"), ("grab", "take"), ("get", "take"), ("collect", "take"), ("fetch", "take"),
    ("put down", "put"), ("put back", "put"), ("put away", "put"), ("set down", "put"), ("put", "put"), ("place", "put"), ("drop", "put"), ("hang", "put"),
    ("read", "read"),
    ("look at", "look"), ("look in", "look"), ("look into", "look"), ("look under", "look"), ("look behind", "look"), ("look through", "look"),
    ("look out of", "look"), ("look out", "look"), ("look", "look"), ("examine", "look"), ("inspect", "look"), ("check", "look"), ("search", "look"),
    ("peek at", "look"), ("peek into", "look"), ("peek", "look"), ("study", "look"), ("watch", "look"), ("listen at", "look"), ("listen to", "look"),
    ("sit on", "sit"), ("sit in", "sit"), ("sit down on", "sit"), ("sit down", "sit"), ("sit", "sit"), ("take a seat", "sit"),
    ("go to sleep", "sleep"), ("go to bed", "sleep"), ("lie down on", "sleep"), ("lie down", "sleep"), ("lie on", "sleep"), ("sleep in", "sleep"), ("sleep", "sleep"),
    ("hide in", "hide"), ("hide under", "hide"), ("hide behind", "hide"), ("hide inside", "hide"), ("hide", "hide"),
    ("turn on", "on"), ("switch on", "on"), ("turn off", "off"), ("switch off", "off"),
    ("go to", "go"), ("go into", "go"), ("go in", "go"), ("go outside", "go"), ("walk to", "go"), ("walk into", "go"), ("run to", "go"), ("run into", "go"),
    ("head to", "go"), ("enter", "go"), ("come in", "go"),
    ("open", "open"), ("close", "close"), ("shut", "close"), ("lock", "use"), ("unlock", "use"),
]
USE_VERBS = set("""use press push pull ring answer call dial eat drink pour make cook boil brew wash clean wipe mop sweep tidy fix repair feed water
light blow give hand show touch unplug plug charge play rewind fill empty brush wake hug kiss move lift carry fold sort stack restock
iron hoover vacuum dust scrub flush rinse dry heat warm turn switch type write sign leave kneel pray bow fold stir chop slice open close
throw toss kick hit smash break burn cut tie untie wind set fold pet stroke comb tuck pull hold squeeze shake""".split())
PREPS = (" on ", " in ", " into ", " onto ", " under ", " behind ", " to ", " with ", " at ", " from ", " for ", " through ", " near ", " by ",
         " beside ", " next to ", " inside ", " off ", " out of ", " over ", " across ", " around ", " back on ")
PARTICLES = {"up", "down", "out", "off", "away", "over", "back", "around", "round", "in", "about"}
KIND_RANK = ["door", "bed", "seat", "hideout", "switch", "note", "carry", "pickup", "stain", "breaker", "peephole", "inspect"]   # a thing used two ways keeps the first here
ID = proto.ID


def snake(text, n=5):
    return "_".join(re.findall(r"[a-z0-9]+", str(text).lower().replace("'", ""))[:n]) or "x"


def ident(text, n=5, prefix="x"):
    s = snake(text, n)[:36].strip("_") or prefix
    return s if s[0].isalpha() else f"{prefix}_{s}"


# ---- a line ---------------------------------------------------------------------------------------------------------

QUOTES = str.maketrans({"“": '"', "”": '"', "„": '"', "«": '"', "»": '"', "＂": '"', "「": '"', "」": '"', "‘": "'", "’": "'",
                        " ": " ", "\t": " ", "…": "...", "​": ""})
SEP = re.compile(r"\s*(?:-{2,}|[—–]+-*|-+[—–]+|\|)\s*(?=\[)")
SECTION = re.compile(r"^\((.+)\)\s*((?:if|when)\b.*|otherwise|else|or else|everyone else)?\s*$", re.I)
HEADER = re.compile(r"^(title|starts?|start time|name|your name|player|kind|type|logline|tone|references?|setting|truth|minutes|length)\s*[:\-–—]\s*(.*)$", re.I)
CAST = re.compile(r"^([A-Za-z][\w'.\- ]{0,30}?)\s*\((she|he|her|him|they|female|male|woman|man|girl|boy|f|m)\)\s*(?:[:\-–—]\s*(.*))?$", re.I)
SPEAKER = re.compile(r"^([A-Za-z][\w'.\- ]{0,30}?)\s*:\s*(.*)$")
TIME = re.compile(r"\(?\s*(\d+(?:[.,]\d+)?)\s*(m|mins?|minutes?|s|secs?|seconds?|h|hrs?|hours?)\b\.?\s*\)?|\(?\s*(\d{1,2}):(\d{2})\s*\)?", re.I)
TASK = re.compile(r"^(hidden\s+|secret\s+)?(timed\s+)?(hidden\s+)?(task|chore|objective|to\s*-?\s*do)\b\s*(.*)$", re.I)
REQUEST = re.compile(r"^(?:request\s*(?:from\s+(?P<a>[A-Za-z][\w' ]*?))?\s*(?:\((?P<b>[^)]*)\))?|(?P<c>[A-Za-z][\w']*)'s\s+request)\s*[:\-–—]\s*(?P<text>.+)$", re.I)
FIND = re.compile(r"^(find|found|found by|how it's found|how to find)\s*[:\-–—]\s*(.+)$", re.I)
ACH = re.compile(r"^(hidden\s+|secret\s+)?(achievement|trophy)\s*[:\-–—]\s*(.+)$", re.I)
NOTE = re.compile(r"^(note|notes|note for claude|claude|todo for claude)\s*[:\-–—]\s*(.+)$", re.I)
LABEL = re.compile(r"^((internal|inner)\s+)?(monologue|thoughts?|thinking)\s*:?$", re.I)


def clean(raw):
    t = raw.translate(QUOTES).strip()
    if t[:1] in "•◦▪●○◆◇■□☐☑✓✔" or (t[:2] in ("- ", "– ") and not t.startswith("--")):
        t = t[1:].strip()
    elif t.startswith("* ") and not t.rstrip().endswith("*"):
        t = t[2:].strip()
    return re.sub(r"\s+", " ", t)


def secs_of(text):
    """(seconds, the text without them): '3 min' / '90s' / '1:30' anywhere in it; (None, text) when there are none."""
    m = TIME.search(text)
    if not m:
        return None, text
    if m.group(3):
        s = int(m.group(3)) * 60 + int(m.group(4))
    else:
        v, u = float(m.group(1).replace(",", ".")), m.group(2).lower()
        s = v * 3600 if u.startswith("h") else v * 60 if u.startswith("m") else v
    rest = (text[:m.start()] + " " + text[m.end():]).strip()
    return int(round(s)), re.sub(r"\s+", " ", rest)


def unquote(t):
    """The words between a line's first and last quote (a missing closing quote is forgiven)."""
    i = t.find('"')
    j = t.rfind('"')
    return (t[i + 1:j] if j > i else t[i + 1:]).strip()


def lex(raw):
    """One line of the note: (kind, data). Kinds: blank, comment, section, place, header, cast, label, think, line, star,
    task, choice, option, heading, find, ach, note, prose."""
    t = clean(raw)
    if not t:
        return "blank", {}
    if t.startswith("//"):
        return "comment", {}
    m = SECTION.match(t)
    if m and '"' not in m.group(1):
        return "section", {"title": m.group(1).strip(), "cond": (m.group(2) or "").strip()}
    if t.startswith("@"):
        body = t[1:].strip()
        name, look = (re.split(r"\s*[:\-–—]\s+|\s*:\s*", body, maxsplit=1) + [""])[:2]
        return "place", {"name": name.strip(" ."), "look": look.strip()}
    if t.startswith("["):
        parts = SEP.split(t)
        opts = []
        for p in parts:
            m = re.match(r"^\[\s*(.*?)\s*\]\s*(.*)$", p)
            if not m:
                return "prose", {"text": t}
            opts.append((m.group(1), m.group(2).strip()))
        if len(opts) == 1 and not opts[0][1]:
            return "heading", {"label": opts[0][0]}
        if len(opts) == 1:
            return "option", {"opts": opts}
        return "choice", {"opts": opts}
    m = TASK.match(t)
    if m and (m.group(5) or "").strip()[:1] in (":", "-", "–", "—", "("):
        rest = m.group(5).strip()
        secs, rest = secs_of(rest)
        rest = re.sub(r"^[:\-–—\s]+", "", rest).strip()
        if rest:
            return "task", {"text": rest, "hidden": bool(m.group(1) or m.group(3)), "timed": bool(m.group(2)) or secs is not None, "secs": secs}
    m = REQUEST.match(t)
    if m:
        who = (m.group("a") or m.group("b") or m.group("c") or "").strip()
        secs, text = secs_of(m.group("text"))
        return "task", {"text": text.strip(), "who": who, "timed": secs is not None, "secs": secs, "hidden": False}
    m = FIND.match(t)
    if m:
        return "find", {"text": m.group(2).strip()}
    m = ACH.match(t)
    if m:
        title, text = (re.split(r"\s+[\-–—]\s+|\s*:\s+", m.group(3).strip(), maxsplit=1) + [""])[:2]
        return "ach", {"title": title.strip(" ."), "text": text.strip(), "hidden": bool(m.group(1))}
    m = NOTE.match(t)
    if m:
        return "note", {"text": m.group(2).strip()}
    if LABEL.match(t):
        return "label", {}
    m = HEADER.match(t)
    if m and '"' not in t:
        return "header", {"key": m.group(1).lower(), "value": m.group(2).strip()}
    m = CAST.match(t)
    if m and '"' not in t:
        sub = m.group(2).lower()
        return "cast", {"name": m.group(1).strip(), "subject": "he" if sub in ("he", "him", "male", "man", "boy", "m") else "she", "role": (m.group(3) or "").strip()}
    if t.startswith("*"):
        j = t.find("*", 1)
        if j > 1:
            return "star", {"text": t[1:j].strip(), "rest": t[j + 1:].strip()}
    if t.startswith('"'):
        return "think", {"text": unquote(t)}
    if t.startswith("(") and '"' in t:              # (a sigh) "words": the player has no face; the words are a thought
        return "think", {"text": unquote(t), "dropped": t[1:t.find(")")].strip() if ")" in t else ""}
    m = SPEAKER.match(t)
    if m:
        rest = m.group(2).strip()
        face = None
        fm = re.match(r"^\(([^)]*)\)\s*(.*)$", rest)
        if fm:
            face, rest = fm.group(1).strip(), fm.group(2).strip()
        tail = re.match(r'^(.*")\s*\(([^)]*)\)\s*$', rest)
        if tail:
            rest, face = tail.group(1), (face + "; " if face else "") + tail.group(2).strip()
        quoted = '"' in rest
        return "line", {"who": m.group(1).strip(), "text": unquote(rest) if quoted else rest, "face": face, "quoted": quoted}
    return "prose", {"text": t}


# ---- what's written between stars ----------------------------------------------------------------------------------

SIZE_MARK = re.compile(r"\s*\(\s*(small|medium|med|large|big|s|m|l)\s*\)", re.I)


def unsized(text):
    """A thing's size note out of the words shown ('Find the photo album (large)' -> 'Find the photo album')."""
    return re.sub(r"\s+", " ", SIZE_MARK.sub("", str(text))).strip()


def norm_name(text):
    """A thing's or a place's name as written, its size note and its articles off: ('the old box (large)') -> ('old box', 'large')."""
    t = text.strip().strip(".!?,;").strip()
    size = None
    m = re.search(r"\(\s*(small|medium|med|large|big|s|m|l)\s*\)\s*$", t, re.I)
    if m:
        size, t = SIZES[m.group(1).lower()], t[:m.start()].strip()
    words = t.split()
    while words and words[0].lower() in ARTICLES:
        words = words[1:]
    return " ".join(words).strip().lower(), size


def parse_act(text):
    """`open door` -> {"verb": "open", "said": "open", "thing": "door", "size": None, "to": None}; None when it isn't
    one of the player's verbs (or an unknown verb with a thing after it: `polish the mirror`)."""
    t = text.strip().rstrip(".!")
    low = " " + t.lower() + " "
    for phrase, verb in sorted(VERBS, key=lambda v: -len(v[0])):
        if low.startswith(" " + phrase + " ") or low.strip() == phrase:
            rest = t[len(phrase):].strip()
            break
    else:
        words = t.split()
        if len(words) >= 2 and (words[0].lower() in USE_VERBS or words[1].lower() in ARTICLES):
            verb, phrase, rest = "use", words[0].lower(), " ".join(words[1:])
        else:
            return None
    # "turn the light on", "switch the lamp off"
    m = re.match(r"^(turn|switch)\s+(.+?)\s+(on|off)$", t, re.I)
    if m:
        verb, phrase, rest = m.group(3).lower(), f"{m.group(1).lower()} {m.group(3).lower()}", m.group(2)
    words = rest.split()
    while words and words[0].lower() in PARTICLES:          # "clean up", "tidy up the kitchen"
        words = words[1:]
    rest = " ".join(words)
    to = None
    rl = " " + rest + " "
    for p in sorted(PREPS, key=len, reverse=True):
        k = rl.lower().find(p)
        if k > 0:
            rest, to = rl[:k].strip(), rl[k + len(p):].strip()
            break
    own = rest.lower().split()[:1] in (["your"], ["my"], ["yourself"], ["myself"])
    thing, size = norm_name(rest)
    if own:                                       # "wash your face": something you do, not a thing
        thing = ""
    target = norm_name(to)[0] if to else None
    if verb in ("sit", "sleep", "hide", "go", "look") and not thing and target:       # "sit on the sofa": the sofa
        thing, target = target, None
    if not thing:
        thing = {"sit": "chair", "sleep": "bed", "hide": "closet", "on": "light", "off": "light"}.get(verb, "")
    return {"verb": verb, "said": phrase, "thing": thing, "size": size, "to": target}


def effect_of(text):
    """What a star that isn't the player's act does: a light, the music, a fade, a pause, a save, the name; else None (a sound)."""
    low = text.lower().strip(" .!")
    if re.match(r"^(enter|type|choose|pick|ask( for)?|input)?\s*(your |my |the player'?s? |a )?name$", low):
        return {"do": "name"}
    m = re.match(r"^(wait|pause|beat|silence|a beat|a pause|a moment)(?:\s+(?:for\s+)?(\d+(?:\.\d+)?)\s*(s|secs?|seconds?|m|mins?|minutes?)?)?$", low)
    if m:
        v = float(m.group(2) or (3 if m.group(1) != "silence" else 4))
        return {"do": "wait", "secs": v * 60 if (m.group(3) or "").startswith("m") else v}
    if low in ("save", "checkpoint", "autosave", "auto save", "game saves"):
        return {"do": "save"}
    m = re.match(r"^music\s*[:\-–—]?\s*(silence|calm|uneasy|dread|chase)$|^(silence|calm|uneasy|dread|chase) music$", low)
    if m:
        return {"do": "music", "mood": m.group(1) or m.group(2)}
    if re.match(r"^(fade( out)?( to)? black|black ?out|fade out|cut to black|time passes)$", low):
        return {"do": "fade"}
    if re.search(r"\b(power|electricity|blackout|power cut|fuses?)\b", low):   # the power: every light in the house (a breaker brings it back)
        if re.search(r"\b(come|comes|came) (back|on)|\bback\b|\bon\b|\brestored?\b", low):
            return {"do": "power", "set": "on"}
        return {"do": "power", "set": "off"}
    if re.search(r"\b(lights?|lamps?|power|bulbs?)\b", low):
        if re.search(r"flicker", low):
            return {"do": "light", "set": "flicker"}
        if re.search(r"\b(go(es)? out|went out|die|dies|cut|cuts|off|fail|fails)\b", low):
            return {"do": "light", "set": "off"}
        if re.search(r"\b(dim|dims)\b", low):
            return {"do": "light", "set": "dim"}
        if re.search(r"\b(come|comes|came) (back|on)|\bon\b", low):
            return {"do": "light", "set": "on"}
    if low == "blackout":
        return {"do": "light", "set": "off"}
    return None


_SFX = None


def shelf():
    global _SFX
    if _SFX is None:
        try:
            _SFX = json.loads(SFX_INDEX.read_text(encoding="utf-8")).get("sounds", {})
        except (OSError, ValueError, AttributeError):
            _SFX = {}
    return _SFX


def sound_for(text):
    """The sound shelf's nearest sound to a description ('knock, knock' -> 'knock_wood_01'), or None."""
    words = {w.rstrip("s") if len(w) > 3 else w for w in re.findall(r"[a-z]+", text.lower())} - {"the", "a", "an", "of", "and", "in", "on", "at", "to"}
    best, key = None, None
    for sid, s in sorted(shelf().items()):
        have = {w.rstrip("s") if len(w) > 3 else w for w in re.findall(r"[a-z]+", sid.replace("_", " ") + " " + " ".join(s.get("tags", [])))}
        hits = len(words & have)
        if not hits:
            continue
        k = (hits, not s.get("loop"), -len(sid))
        if key is None or k > key:
            best, key = sid, k
    return best


# ---- the note, read into parts ---------------------------------------------------------------------------------------

class Choice:
    def __init__(self, n, opts, rep):
        self.n, self.options, self.blocks, self.open = n, [], {}, True
        seen = set()
        for label, think in opts:
            m = re.match(r"^(.*?)\s*([+-]\s*\d+)\s*$", label)
            karma = int(m.group(2).replace(" ", "")) if m else 0
            label = (m.group(1) if m else label).strip()
            act = None
            if label.startswith("*") and label.endswith("*") and len(label) > 2:
                act = parse_act(label.strip("*").strip()) or {"verb": "use", "said": "", "thing": norm_name(label.strip("*"))[0], "size": None, "to": None}
                label = label.strip("*").strip()
            oid = ident(label, 3, "a")[:16]
            while oid in seen:
                oid += "_2"
            seen.add(oid)
            if karma and not -3 <= karma <= 3:
                rep.problem(n, f"karma {karma:+d} on [ {label} ]: -3 to 3")
                karma = max(-3, min(3, karma))
            self.options.append({"id": oid, "label": label, "think": think, "karma": karma, "act": act})
        self.by_act = any(o["act"] for o in self.options)

    def add(self, options):                     # an answer on a line of its own, after the first
        for o in options:
            while any(x["id"] == o["id"] for x in self.options):
                o["id"] += "_2"
            self.options.append(o)
        self.by_act = any(o["act"] for o in self.options)

    def option(self, label):
        key = norm_label(label)
        return next((o for o in self.options if norm_label(o["label"]) == key or o["id"] == ident(key, 3, "a")[:16]), None)


def norm_label(label):
    return re.sub(r"[^a-z0-9 ]", "", re.sub(r"[+-]\s*\d+\s*$", "", str(label)).strip("* ").lower()).strip()


class Section:
    def __init__(self, n, title, cond_text):
        self.n, self.items, self.cond_text = n, [], cond_text
        low = title.lower()
        self.kind, self.title, self.intended, self.chapter = "part", title, False, None
        m = re.match(r"^((true|good|main|real|best|intended|bad|sad|other|secret|normal|neutral|happy|dark|worst|alternative|alt)\s+)?ending\b\s*[:\-–—]?\s*(.*)$", low)
        if m:
            self.kind = "ending"
            self.intended = (m.group(2) or "") in ("true", "good", "main", "real", "best", "intended", "happy")
            self.title = title[len(title) - len(m.group(3)):].strip() if m.group(3) else "The End"
        elif re.match(r"^(secret|easter egg)\b\s*[:\-–—]?", low):
            self.kind = "secret"
            self.title = re.sub(r"^(secret|easter egg)\b\s*[:\-–—]?\s*", "", title, flags=re.I).strip() or "A secret"
        elif re.match(r"^chapter\b\s*[:\-–—]?", low):
            self.kind = "chapter"
            body = re.sub(r"^chapter\b\s*[:\-–—]?\s*", "", title, flags=re.I).strip()
            head, sub = (re.split(r"\s*[·•|,/]\s*|\s+[\-–—]\s+", body, maxsplit=1) + [""])[:2]
            self.title = head.strip() or "Chapter"
            self.chapter = {"title": self.title, "sub": sub.strip(), "time": time_of(body)}
        self.find = self.ach = None


def time_of(text):
    m = re.search(r"\b(\d{1,2})[:.](\d{2})\b", text)
    if m:
        h = int(m.group(1)) % 24
        return "day" if 5 <= h < 17 else "dusk" if 17 <= h < 19 else "night"
    for w in re.findall(r"[a-z]+", text.lower()):
        if w in TIMES:
            return TIMES[w]
    return "night"


class Report:
    def __init__(self, lines):
        self.lines = [{"n": i + 1, "text": t.rstrip(), "what": "", "problems": []} for i, t in enumerate(lines)]
        self.problems = []

    def what(self, n, text):
        if n and 0 < n <= len(self.lines) and not self.lines[n - 1]["what"]:
            self.lines[n - 1]["what"] = text

    def problem(self, n, text):
        if n and 0 < n <= len(self.lines):
            self.lines[n - 1]["problems"].append(text)
        self.problems.append(f"line {n}: {text}" if n else text)


class Reader:
    """The note's lines into the front (title, cast, places...) and the parts, each a list of steps and choices."""

    def __init__(self, text):
        self.raw = str(text or "").replace("\r\n", "\n").replace("\r", "\n").split("\n")
        self.rep = Report(self.raw)
        self.front = {"title": "", "time": "night", "notes": [], "story": {}}
        self.cast, self.places, self.sections, self.place_ids = {}, {}, [], {}
        self.focus = None                      # who "she" is: the last cast member named or speaking
        self.has_name = False                  # the player types their name somewhere (X in a line is it)

    # cast and places, by name
    def person(self, name, n, subject=None, role=""):
        key = name.strip().lower()
        if key in PLAYER:
            return "player"
        for cid, c in self.cast.items():
            if c["name"].lower() == key or cid == ident(key, 3, "c"):
                if subject:
                    c["subject"] = subject
                if role and not c.get("role"):
                    c["role"] = role
                return cid
        cid = ident(name, 3, "c")
        self.cast[cid] = {"id": cid, "name": name.strip(), "subject": subject or "she", "role": role, "wants": "", "hides": "", "tells": "",
                          "_said": bool(subject), "_n": n}
        return cid

    def place(self, name, look="", taken=()):
        nm = norm_name(name)[0] or name.strip().lower()
        if nm in self.place_ids:
            pid = self.place_ids[nm]
        else:
            pid = ident(nm, 3, "p")
            while pid in taken or pid in self.cast:
                pid += "_room"
            self.place_ids[nm] = pid
        if pid not in self.places:
            self.places[pid] = {"id": pid, "name": name.strip().strip(".").title() if name.islower() else name.strip().strip("."), "look": look}
        elif look and not self.places[pid].get("look"):
            self.places[pid]["look"] = look
        return pid

    def subject_of(self, text):
        """Who a line of what happens is about: a cast member named first, or she/he (whoever was last named)."""
        words = re.findall(r"[A-Za-z']+", text)
        if not words:
            return None
        low = [w.lower() for w in words]
        for i in range(min(3, len(words))):
            for cid, c in self.cast.items():
                if low[i] == c["name"].lower() or low[i] == c["name"].lower() + "'s" or " ".join(low[i:i + len(c["name"].split())]) == c["name"].lower():
                    return cid
        if low[0] in PRONOUNS:
            return self.focus or next(iter(self.cast), None)
        return None

    def mention(self, text):
        low = text.lower()
        for cid, c in self.cast.items():
            if re.search(r"\b" + re.escape(c["name"].lower()) + r"\b", low):
                self.focus = cid

    def read(self):
        self.first_pass()
        sec, stack, open_ = None, None, []
        pending_option = None                       # a choice written an option a line

        def put(step, n):
            nonlocal sec, stack
            if sec is None:                         # before any part: the story starts without a title
                sec = Section(n, "Opening", "")
                self.sections.append(sec)
                stack = [sec.items]
            step["n"] = n
            stack[-1].append(step)

        def close_option():
            nonlocal pending_option
            pending_option = None

        for i, raw in enumerate(self.raw):
            n = i + 1
            kind, d = lex(raw)
            if kind == "blank":
                continue
            if kind != "option" and pending_option is not None:
                close_option()
            if kind == "comment":
                self.rep.what(n, "ignored")
                continue
            if kind == "section":
                sec = Section(n, d["title"], d["cond"])
                self.sections.append(sec)
                stack, open_, pending_option = [sec.items], [], None
                self.rep.what(n, {"part": "a part", "ending": "an ending" + (" (the intended one)" if sec.intended else ""),
                                  "secret": "a secret", "chapter": "a chapter card"}[sec.kind] + (f", {d['cond']}" if d["cond"] else ""))
                continue
            if sec is None and kind in ("header", "cast", "note", "place"):
                if kind == "header":
                    self.header(d, n)
                elif kind == "cast":
                    cid = self.person(d["name"], n, d["subject"], d["role"])
                    self.cast[cid]["_said"] = True
                    self.rep.what(n, "a person")
                elif kind == "note":
                    self.front["notes"].append(d["text"])
                    self.rep.what(n, "a note for the brief")
                else:
                    self.place(d["name"], d["look"])
                    self.rep.what(n, "a place")
                continue
            if kind == "place":
                pid = self.place(d["name"], d["look"])
                put({"do": "place", "place": pid}, n)
                self.rep.what(n, f"from here, in {self.places[pid]['name']}")
                continue
            if kind == "label":
                self.rep.what(n, "(your thoughts follow)")
                continue
            if kind in ("choice", "option"):
                if kind == "option" and pending_option is not None:
                    pending_option.add(Choice(n, [(lab, self.named(th)) for lab, th in d["opts"]], self.rep).options)
                    self.rep.what(n, "another answer")
                    continue
                ch = Choice(n, [(lab, self.named(th)) for lab, th in d["opts"]], self.rep)
                put_choice = {"do": "choice", "choice": ch}
                put(put_choice, n)
                open_.append((ch, len(stack) - 1))
                if kind == "option":
                    pending_option = ch
                self.rep.what(n, "a choice by doing" if ch.by_act else "your answers")
                continue
            if kind == "heading":
                label = d["label"]
                if norm_label(label) in REJOIN:
                    if open_:
                        ch, depth = open_.pop()
                        del stack[depth + 1:]
                        self.rep.what(n, "everyone again")
                    else:
                        self.rep.problem(n, f"[ {label} ]: no choice above it to come back from")
                    continue
                hit = None
                for k in range(len(open_) - 1, -1, -1):
                    o = open_[k][0].option(label)
                    if o:
                        hit = (k, o)
                        break
                if not hit:
                    self.rep.problem(n, f"[ {label} ]: no answer called that in a choice above it")
                    continue
                k, o = hit
                ch, depth = open_[k]
                del open_[k + 1:]
                del stack[depth + 1:]
                block = ch.blocks.setdefault(o["id"], [])
                stack.append(block)
                self.rep.what(n, f"after [ {o['label']} ]")
                continue
            if kind == "header":                  # a header inside a part: the note's own line
                kind, d = "prose", {"text": clean(raw)}
            if kind == "cast" and sec is not None:
                cid = self.person(d["name"], n, d["subject"], d["role"])
                self.cast[cid]["_said"] = True
                self.rep.what(n, "a person")
                continue
            if kind == "note":
                put({"do": "note", "text": d["text"]}, n)
                self.rep.what(n, "a note on the chart")
                continue
            if kind == "find":
                if sec and sec.kind == "secret":
                    t = d["text"].strip()
                    sec.find = {"text": t.strip("*").strip(), "act": parse_act(t.strip("*").strip()) if t.startswith("*") else None}
                    self.rep.what(n, "how it's found")
                else:
                    self.rep.problem(n, "Find: goes in a secret (how it's found)")
                continue
            if kind == "ach":
                if sec and sec.kind in ("secret", "ending") and not sec.ach:
                    sec.ach = d
                    self.rep.what(n, "its achievement")
                else:
                    put({"do": "feat", "title": d["title"], "text": d["text"], "hidden": d["hidden"]}, n)
                    self.rep.what(n, "an achievement, unlocked here")
                continue
            for step in self.steps(kind, d, n):
                put(step, n)
        self.done()
        return self

    def header(self, d, n):
        k, v = d["key"], d["value"]
        if k == "title":
            self.front["title"] = v
        elif k.startswith("start"):
            self.front["time"] = time_of(v)
        elif k in ("name", "your name"):
            self.front["story"]["player_name"] = v
        elif k == "player":
            self.front["story"]["player"] = v
        elif k in ("kind", "type"):
            self.front["kind"] = v
        elif k.startswith("reference"):
            self.front["references"] = v
        elif k in ("minutes", "length"):
            s, _ = secs_of(v)
            self.front["minutes"] = round(s / 60) if s else int(re.sub(r"\D", "", v) or 60)
        else:
            self.front["story"][k] = v
        self.rep.what(n, {"title": "the title", "name": "your name until you type one", "your name": "your name until you type one", "player": "who you are",
                          "kind": "the kind of game", "type": "the kind of game", "minutes": "how long a playthrough is", "length": "how long a playthrough is"}.get(
                              k, f"when it starts: {self.front['time']}" if k.startswith("start") else f"the {k}"))

    def steps(self, kind, d, n):
        """A line's steps (most lines are one)."""
        if kind in ("think", "line"):
            d = dict(d, text=self.named(d["text"]))
        if kind == "think":
            self.mention(d["text"])
            self.rep.what(n, "your thought")
            if d.get("dropped"):
                self.rep.problem(n, f"({d['dropped']}): you have no face to show it; it's left out (write what happens on its own line)")
            return [{"do": "think", "text": d["text"]}]
        if kind == "line":
            who = d["who"]
            if who.lower() in PLAYER:
                self.rep.what(n, "you say it")
                return [{"do": "you", "text": d["text"]}]
            known = any(c["name"].lower() == who.lower() for c in self.cast.values())
            if not d["quoted"] and not known:
                self.mention(d["text"])
                self.rep.what(n, "what happens")
                return [{"do": "see", "text": f"{who}: {d['text']}", "who": self.subject_of(who)}]
            cid = self.person(who, n)
            self.focus = cid
            self.rep.what(n, f"{self.cast[cid]['name']} says it" + (" (with her face)" if d.get("face") else ""))
            step = {"do": "say", "who": cid, "text": d["text"]}
            if d.get("face"):
                step["face"] = d["face"]
            return [step]
        if kind == "star":
            out = self.star(d["text"], n)
            if d.get("rest"):
                k2, d2 = lex(d["rest"])
                out += self.steps(k2, d2, n) if k2 not in ("blank", "comment") else []
            return out
        if kind == "task":
            act = parse_act(d["text"])
            shown = unsized(d["text"])
            step = {"do": "todo", "text": shown[:1].upper() + shown[1:], "hidden": d["hidden"]}
            if d.get("timed"):
                step["secs"] = d["secs"] or DEFAULT_SECS
                if not d["secs"]:
                    self.rep.problem(n, f"a timed task with no time: {DEFAULT_SECS // 60} minutes (write it like this: Timed task (3 min) - {d['text']})")
            if d.get("who"):
                step["who"] = self.person(d["who"], n)
            if act and act.get("thing"):
                step.update({"verb": act["verb"], "thing": act["thing"], "size": act["size"], "to": act["to"]})
            self.rep.what(n, ("a hidden " if d["hidden"] else "a ") + ("timed " if d.get("timed") else "") + "task"
                          + (f" ({step['secs'] // 60:g} min)" if step.get("secs") and step["secs"] % 60 == 0 else f" ({step['secs']} s)" if step.get("secs") else "")
                          + (f", asked by {self.cast[step['who']]['name']}" if step.get("who") else ""))
            return [step]
        if kind == "prose":
            text = d["text"]
            who = self.subject_of(text)
            self.mention(text)
            self.rep.what(n, "what happens" + (f" ({self.cast[who]['name']})" if who in self.cast else ""))
            return [{"do": "see", "text": text, "who": who}]
        self.rep.problem(n, "couldn't read this line")
        return []

    def star(self, text, n):
        fx = effect_of(text)
        if fx:
            self.rep.what(n, {"name": "you type your name", "wait": f"a pause ({fx.get('secs', 0):g} s)", "save": "an autosave",
                              "music": f"the music: {fx.get('mood')}", "fade": "a moment passes", "light": f"the lights: {fx.get('set')}",
                              "power": f"the power: {fx.get('set')}"}[fx["do"]])
            return [fx]
        who = self.subject_of(text)
        if who:
            self.mention(text)
            self.rep.what(n, f"what {self.cast[who]['name']} does")
            return [{"do": "cast", "who": who, "text": text}]
        act = parse_act(text)
        if act:
            self.rep.what(n, f"you do it: {act['said']} {act['thing']}".rstrip() + (f" ({act['size']})" if act["size"] else ""))
            return [dict({"do": "act", "text": unsized(text)}, **act)]
        snd = sound_for(text)
        self.rep.what(n, f"a sound: {snd}" if snd else "a sound (nothing on the shelf like it yet)")
        return [{"do": "sound", "text": text, "sfx": snd}]

    def done(self):
        for c in self.cast.values():
            if not c.pop("_said", None):
                self.rep.problem(c.get("_n"), f"{c['name']}: she or he? (she for now; say it at the top: {c['name']} (she): who she is)")
            c.pop("_n", None)

    def first_pass(self):
        """Who's in it before anything's read (so "she" knows who she is from the start), and whether the player types
        their name (then X in a line is it)."""
        for i, raw in enumerate(self.raw):
            kind, d = lex(raw)
            if kind == "cast":
                cid = self.person(d["name"], i + 1, d["subject"], d["role"])
                self.cast[cid]["_said"] = True
            elif kind == "line" and d["quoted"] and d["who"].lower() not in PLAYER:
                self.person(d["who"], i + 1)
            elif kind == "star" and (effect_of(d["text"]) or {}).get("do") == "name":
                self.has_name = True

    def named(self, text):
        """{name}: the player's name, written {name}, <name>, [name] or (once they type it) X."""
        t = re.sub(r"[{<\[]\s*(your\s+)?name\s*[}>\]]", "{name}", str(text), flags=re.I)
        return re.sub(r"(?<![\w'-])X(?![\w'-])", "{name}", t) if self.has_name else t


# ---- the parts, made into the chart ---------------------------------------------------------------------------------

PLAY_KINDS = {"act", "todo", "wait", "save"}
SCENE_KINDS = {"say", "you", "cast", "name"}


class Maker:
    def __init__(self, rd, old=None):
        self.rd, self.rep, self.old = rd, rd.rep, old or {}
        self.nodes, self.edges, self.frames, self.items, self.faces, self.feats = [], [], [], {}, {}, []
        self.ids = {"start"} | set(rd.cast) | set(rd.places)
        self.lane, self.where = {}, None
        self.talks = []                          # (talk node, its options) as made: `if [ Answer ]` finds the nearest
        self.last_point = None                   # the shape a secret is found after
        self.section_nodes = {}                  # a section -> the shapes it made
        self.notes = []                          # (a sticky note, the shape it's beside)
        self.item_ids = {}                       # a thing's name -> its id

    # ---- shapes and arrows
    def new_id(self, base):
        b = ident(base, 4, "s")[:30]
        k, i = b, 2
        while k in self.ids:
            k, i = f"{b}_{i}", i + 1
        self.ids.add(k)
        return k

    def shape(self, typ, title, sec, lane, **fields):
        n = dict({"id": self.new_id(title), "type": typ, "x": 0, "y": 0, "title": title}, **fields)
        self.nodes.append(n)
        self.lane[n["id"]] = lane
        self.section_nodes.setdefault(sec, []).append(n["id"])
        return n

    def edge(self, a, b, **kw):
        self.edges.append(dict({"id": f"a{len(self.edges) + 1}", "from": a, "to": b}, **{k: v for k, v in kw.items() if v not in (None, "")}))

    def join(self, pending, nid):
        for a, extra in pending:
            self.edge(a, nid, **extra)

    # ---- the things touched, by name
    def thing(self, name, verb, size, n, said=None):
        if not name:
            return None
        if verb == "go":
            return None
        head = name.split()[-1] if name.split() else name
        kind = {"take": "pickup", "put": "carry", "read": "note", "sit": "seat", "sleep": "bed", "hide": "hideout", "on": "switch", "off": "switch"}.get(verb, "inspect")
        if (name in DOORS or head in ("door", "doors", "gate", "fusuma", "shoji")) and verb in ("open", "close", "use", "look"):
            kind = "door"
        if kind == "switch" and not (name in LIGHTS or head in LIGHTS):
            kind = "inspect"                   # "turn on the kettle": E on it
        if (said or "").split()[:1] and said.split()[0] in CLEANING and (name in MESS or head in MESS):
            kind = "stain"                     # "mop the mud": a stain, scrubbed away
        if name in BREAKERS or head in BREAKERS:
            kind = "breaker"
        if name in PEEPHOLES or head in PEEPHOLES:
            kind = "peephole"
        if name in TORCHES or head in TORCHES:   # "take the flashlight", "turn on the torch": a small thing you take
            kind, size = "pickup", "small"
        guess = SIZE_OF.get(head) or SIZE_OF.get(name) or ("large" if kind in ("bed", "seat", "hideout") else "small" if kind in ("note", "switch") else "medium")
        tid = self.item_ids.get(name)
        if not tid:
            tid = ident(name, 4, "t")
            while tid in self.ids or tid in self.rd.places:
                tid += "_thing"
            self.ids.add(tid)
            self.item_ids[name] = tid
        it = self.items.get(tid)
        if not it:
            it = self.items[tid] = {"id": tid, "name": name, "size": size or guess, "kind": kind, "where": self.where or "", "verbs": []}
        else:
            if size:
                it["size"] = size
            if KIND_RANK.index(kind) < KIND_RANK.index(it["kind"]):
                it["kind"] = kind
        if kind == "pickup" and it["size"] != "small" and it["kind"] == "pickup":
            it["kind"] = "carry" if it["size"] == "medium" else "inspect"
        if verb not in it["verbs"]:
            it["verbs"].append(verb)
        return tid

    def face(self, text, who):
        prompt = text.strip().rstrip(".") + "."
        prompt = prompt[:1].lower() + prompt[1:]
        for f in self.faces.values():
            if f["prompt"] == prompt and f["for"] == who:
                return f["id"]
        fid = ident(f"{who} {text}", 5, "f")[:36]
        base, k = fid, 2
        while fid in self.faces or fid in self.ids:
            fid, k = f"{base}_{k}", k + 1
        self.ids.add(fid)
        self.faces[fid] = {"id": fid, "prompt": prompt, "secs": 6, "loop": None, "for": who}
        return fid

    # ---- a list of steps and choices: its shapes, joined to what came before (pending: [(shape, arrow fields)])
    def stream(self, items, pending, sec, lane, title):
        pieces, cur = [], None
        for it in items:
            d = it["do"]
            if d == "choice":
                cur = None
                pieces.append(("choice", it))
                continue
            if d == "note":
                pieces.append(("note", it))
                continue
            if d == "place":
                cur = None
                pieces.append(("place", it))
                continue
            kind = "play" if d in PLAY_KINDS else "scene" if d in SCENE_KINDS or (d == "see" and it.get("who")) else None
            if cur is None or (kind and cur["kind"] and kind != cur["kind"] and not (d == "name")):
                cur = {"kind": kind, "steps": []}
                pieces.append(("stretch", cur))
            elif kind and not cur["kind"]:
                cur["kind"] = kind
            cur["steps"].append(it)
        for k, (what, p) in enumerate(pieces):
            if what == "stretch" and not p["kind"]:
                nxt = next((q for w, q in pieces[k + 1:] if w in ("stretch", "choice")), None)
                p["kind"] = "play" if nxt is not None and "choice" in nxt and nxt["choice"].by_act else "scene"
        made, last = 0, None
        for what, p in pieces:
            if what == "place":
                self.where = p["place"]
                continue
            if what == "note":
                self.notes.append((p, last["id"] if last else (pending[0][0] if pending else None), lane))
                continue
            if what == "stretch":
                kind = p["kind"] or "play"
                t = title if not made else f"{title} · {self.what_of(p, kind)}"
                n = self.point("task" if kind == "play" else "scene", t, p["steps"], sec, lane)
                self.join(pending, n["id"])
                pending, last = [(n["id"], {})], n
                made += 1
                continue
            ch = p["choice"]
            if ch.by_act:
                c = self.shape("choice", f"{title} · what you do" if made else title, sec, lane, by="player",
                               question=" or ".join(o["label"] for o in ch.options) + "?")
                self.join(pending, c["id"])
                pending, made, last = self.ways(c, ch, sec, lane, title), made + 1, c
                continue
            talk = last if last is not None and last["type"] == "scene" and pending == [(last["id"], {})] else None
            if talk is None:
                talk = self.point("talk", title if not made else f"{title} · your answer", [], sec, lane)
                self.join(pending, talk["id"])
                made += 1
            pending, last = self.answers(talk, ch, sec, lane, title), talk
        return pending

    def what_of(self, p, kind):
        for s in p["steps"]:
            if s["do"] == "todo":
                return s["text"]
            if s["do"] == "act":
                return s["text"][:1].upper() + s["text"][1:]
            if s["do"] == "say":
                return self.rd.cast[s["who"]]["name"]
        for s in p["steps"]:
            if s["do"] in ("think", "see", "cast", "you") and s.get("text"):
                w = re.sub(r"[{}]", "", s["text"]).split()
                return " ".join(w[:5]).rstrip(".,!?") + ("…" if len(w) > 5 else "")
        return "play" if kind == "play" else "scene"

    def point(self, typ, title, steps, sec, lane):
        """A scene, task or talk shape: its steps (the things touched made items, faces made the story's own)."""
        out, who = [], []
        for s in steps:
            s = {k: v for k, v in s.items() if k != "n" and v not in (None, "")}
            if s["do"] in ("say", "cast", "see") and s.get("who") in self.rd.cast and s["who"] not in who:
                who.append(s["who"])
            if s["do"] == "todo" and s.get("who") and s["who"] not in who:
                who.append(s["who"])
            if s["do"] == "say" and s.get("face"):
                s["face"] = self.face(s["face"], s["who"])
            if s["do"] in ("act", "todo") and s.get("thing"):
                tid = self.thing(s["thing"], s.get("verb"), s.get("size"), None, s.get("said"))
                if tid:
                    s["item"] = tid
                elif s.get("verb") == "go":
                    s["place"] = self.rd.place(s["thing"], taken=self.ids)
                    self.ids.add(s["place"])
                for k in ("thing", "size"):
                    s.pop(k, None)
                if s.get("to") and s.get("verb") == "put":
                    s["on"] = self.thing(s.pop("to"), "look", None, None)
                s.pop("to", None)
            if s["do"] == "feat":
                fid = self.new_id(f"feat {s['title']}")
                self.feats.append({"id": fid, "title": s["title"], "text": s.get("text", ""), "hidden": bool(s.get("hidden"))})
                s = {"do": "feat", "feat": fid}
            out.append(s)
        n = self.shape(typ, title, sec, lane, text=" ".join(s["text"] for s in out if s["do"] == "see")[:400], who=who, where=self.where or "",
                       minutes=minutes_of_steps(out, typ), steps=out)
        if typ == "talk":
            n["talk"] = {"line": {"who": "", "text": ""}, "listen": "", "options": [], "reveals": ""}
        self.last_point = n
        return n

    def answers(self, talk, ch, sec, lane, title):
        """A talk's answers (the close-up): her question is the last line said before them; after each answer, her
        reply (her first line there) and anything more, which becomes shapes of their own after a choice by that answer."""
        steps = talk["steps"]
        talk["type"] = "talk"
        talk.setdefault("talk", {"line": {"who": "", "text": ""}, "listen": "", "options": [], "reveals": ""})
        asker = next((s["who"] for s in reversed(steps) if s["do"] == "say"), None)
        if steps and steps[-1]["do"] == "say":
            q = steps.pop()
            talk["talk"]["line"] = {"who": q["who"], "text": q["text"]}
            if q.get("face"):
                talk["talk"]["line"]["face"] = q["face"]
        else:
            talk["talk"]["line"] = {"who": asker or "player", "text": "…"}
        if asker and asker not in talk["who"]:
            talk["who"].append(asker)
        talk["minutes"] = minutes_of_steps(steps, "talk")
        opts, branches = [], []
        for o in ch.options:
            x = {"id": o["id"], "say": o["label"], "karma": o["karma"], "tell": "", "face": "", "sets": ""}
            if o["think"]:
                x["think"] = o["think"]
            block = list(ch.blocks.get(o["id"], []))
            if block and block[0]["do"] == "say" and block[0]["who"] == asker:      # her reply: her face answers first
                first = block.pop(0)
                x["then"] = first["text"]
                if first.get("face"):
                    x["tell"] = first["face"]
                    x["face"] = self.face(first["face"], asker)
            opts.append(x)
            if block:
                branches.append((o, block))
        talk["talk"]["options"] = opts
        self.talks.append(talk)
        if not branches:
            return [(talk["id"], {})]
        c = self.shape("choice", f"{title} · after your answer", sec, lane, by="answer",
                       question=f"What you answered {self.rd.cast[asker]['name'] if asker in self.rd.cast else ''}".strip() + "?")
        self.edge(talk["id"], c["id"])
        out, rest = [], len(branches) < len(ch.options)
        for k, (o, block) in enumerate(branches):
            last = k == len(branches) - 1 and not rest
            when = {} if last else {"talk": talk["id"], "answer": o["id"]}
            out += self.stream(block, [(c["id"], {"when": when})], sec, lane + 1 + k, f"{title} · {o['label']}")
        if rest:
            out.append((c["id"], {"when": {}}))
        return out

    def ways(self, c, ch, sec, lane, title):
        """A choice by doing: each way labelled with what you do; what's written after one is its way, the rest go on."""
        out = []
        for k, o in enumerate(ch.options):
            if o["act"] and o["act"].get("thing") and o["act"]["verb"] != "go":
                self.thing(o["act"]["thing"], o["act"]["verb"], o["act"]["size"], None)
            block = ch.blocks.get(o["id"], [])
            extra = {"label": o["label"], "think": o.get("think") or None}
            if block:
                out += self.stream(block, [(c["id"], extra)], sec, lane + 1 + k, f"{title} · {o['label']}")
            else:
                out.append((c["id"], extra))
        return out

    # ---- the whole note
    def make(self):
        rd = self.rd
        pending = [("start", {})]
        secs, i = rd.sections, 0
        while i < len(secs):
            s = secs[i]
            if s.kind == "secret":
                pending = self.secret(s, pending)
                i += 1
                continue
            if s.cond_text or s.kind == "ending":
                j = i
                while j < len(secs) and (secs[j].cond_text or (secs[j].kind == "ending" and s.kind == "ending")) and secs[j].kind != "secret" \
                        and (secs[j].kind == "ending") == (s.kind == "ending"):
                    j += 1
                pending = self.group(secs[i:j], pending)
                i = j
                continue
            pending = self.section(s, pending, 0)
            i += 1
        if pending and any(a != "start" for a, _ in pending):
            self.rep.problem(secs[-1].n if secs else 0, "the story doesn't end: an ending part last, ( Ending: ... )")
        elif pending:
            self.rep.problem(0, "nothing to read: write a part, ( Opening ), and what happens in it")
        return self

    def section(self, s, pending, lane):
        if s.kind == "chapter":
            n = self.shape("chapter", s.title, s, lane, text="", who=[], where=self.where or "", minutes=1, steps=[], chapter=s.chapter)
            self.join(pending, n["id"])
            pending = [(n["id"], {})]
            self.last_point = n
            if not s.items:
                return pending
        if s.kind == "ending":
            return self.ending(s, pending, lane)
        return self.stream(s.items, pending, s, lane, s.title) if s.items else self.empty(s, pending, lane)

    def empty(self, s, pending, lane):
        n = self.point("scene", s.title, [], s, lane)
        self.join(pending, n["id"])
        self.rep.problem(s.n, f"( {s.title} ) has nothing in it yet")
        return [(n["id"], {})]

    def ending(self, s, pending, lane):
        steps = [x for x in s.items if x["do"] not in ("choice", "note", "place")]
        for x in s.items:
            if x["do"] == "note":
                self.notes.append((x, None, lane))
            if x["do"] == "choice":
                self.rep.problem(x["n"], "an ending is where it stops: no answers in it")
            if x["do"] == "place":
                self.where = x["place"]
        pt = self.point("scene", s.title, steps, s, lane)      # its steps and things, made like any shape's
        pt.update({"type": "ending", "kind": "intended" if s.intended else "other", "how": "",
                   "achievement": {"title": (s.ach or {}).get("title", ""), "text": (s.ach or {}).get("text", ""), "hidden": True if not s.ach else bool(s.ach.get("hidden", True))}})
        for k in ("talk", "minutes"):
            pt.pop(k, None)
        self.join(pending, pt["id"])
        return []

    def secret(self, s, pending):
        src = self.last_point
        if not src or src["type"] not in proto.POINTS:
            self.rep.problem(s.n, f"( Secret: {s.title} ) is found after a part with something in it: write it after one")
            return pending
        if len({a for a, _ in pending}) > 1 or (pending and pending[0][0] != src["id"]):
            self.rep.problem(s.n, f"( Secret: {s.title} ) comes after a choice: it's found only on the way through {src['title']}")
        steps = [x for x in s.items if x["do"] not in ("choice", "note", "place")]
        for x in s.items:
            if x["do"] == "note":
                self.notes.append((x, src["id"], -1))
        n = self.point("scene", s.title, steps, s, -1)
        find = s.find or {}
        n.update({"type": "secret", "find": find.get("text") or "look round", "shows": n.get("text", ""),
                  "achievement": {"title": (s.ach or {}).get("title", "") or s.title, "text": (s.ach or {}).get("text", ""), "hidden": bool((s.ach or {}).get("hidden"))}})
        if find.get("act") and find["act"].get("thing"):
            n["find_item"] = self.thing(find["act"]["thing"], find["act"]["verb"], find["act"]["size"], None)
        for k in ("talk", "minutes", "who"):
            n.pop(k, None)
        if not s.find:
            self.rep.problem(s.n, f"( Secret: {s.title} ): how is it found? (Find: *look behind the mirror*)")
        self.lane[n["id"]] = self.lane.get(src["id"], 0) - 1
        self.edge(src["id"], n["id"])
        self.last_point = src
        return pending + [(n["id"], {})]

    def group(self, group, pending):
        """Parts with conditions next to each other (or the endings): one choice, a way each. The same condition
        again carries its way on; `otherwise` is everyone else; with none, the rest go on to the next part (the
        endings: the last one is the rest)."""
        ending = group[0].kind == "ending"
        ways, conds = [], []
        for s in group:
            c = self.cond(s)
            if ways and not ending and c == conds[-1] and c["by"] not in ("rest", "none"):
                ways[-1].append(s)
            else:
                ways.append([s])
                conds.append(c)
        bys = [c["by"] for c in conds if c["by"] not in ("rest", "none")]
        if not bys:
            if len(ways) == 1:                   # one ending (or one part) with nothing to decide
                out = pending
                for s in ways[0]:
                    out = self.section(s, out, 0)
                return out
            for c, w in zip(conds, ways):        # several endings and nothing says which: the player picks, for now
                c.update({"by": "player", "label": w[0].title})
            bys = ["player"]
            self.rep.problem(group[0].n, "what decides the ending? (if karma 2+, if [ Answer ], if *do something*, otherwise): the player picks for now")
        by = bys[0]
        kinds = list(dict.fromkeys(bys))
        if len(kinds) > 1 and "player" not in kinds:
            return self.chain(group, ways, conds, kinds, pending, ending)
        if len(set(bys)) > 1:
            self.rep.problem(group[0].n, f"what you do can't be mixed with answers or karma in one choice: these parts mix {', '.join(sorted(set(bys)))}; by {by} here")
        for c, w in zip(conds, ways):
            if c["by"] == "none":
                c["by"] = "rest"
            if c["by"] not in (by, "rest"):
                c.clear()
                c["by"] = "rest"
            if by == "player" and c["by"] == "rest":
                c.update({"by": "player", "label": w[0].title})
        rests = [k for k, c in enumerate(conds) if c["by"] == "rest"]
        if by in ("karma", "answer") and len(rests) > 1:
            for k in rests[1:]:
                self.rep.problem(ways[k][0].n, f"( {ways[k][0].title} ): only one part is for everyone else (otherwise)")
        if ending and by in ("karma", "answer") and not rests:
            conds[-1] = {"by": "rest"}
            self.rep.problem(ways[-1][0].n, f"the endings need one for everyone else: ( {ways[-1][0].title} ) is it (write otherwise after it)")
        title = "How it ends" if ending else ways[0][0].title + "?"
        q = {"karma": "What the answers added up to", "answer": "What you answered", "player": "What you do"}[by]
        c = self.shape("choice", title, group[0], 0, by=by, question=q)
        self.join(pending, c["id"])
        out = []
        for k, (cond, way) in enumerate(zip(conds, ways)):
            if by == "player":
                extra = {"label": cond.get("label") or way[0].title}
            elif cond["by"] == "rest":
                extra = {"when": {}}
            elif by == "karma":
                extra = {"when": {x: cond[x] for x in ("min", "max") if cond.get(x) is not None}}
            else:
                extra = {"when": {"talk": cond["talk"], "answer": cond["answer"]}}
            p = [(c["id"], extra)]
            for s in way:
                p = self.section(s, p, k)
            out += p
        if not ending and by in ("karma", "answer") and not rests:
            out.append((c["id"], {"when": {}}))  # everyone else goes on to the next part
        if by == "player" and len(ways) < 2:
            out.append((c["id"], {"label": "carry on"}))
            self.rep.problem(group[0].n, "a choice by doing has two ways or more: the other way is to carry on, for now")
        return out

    def chain(self, group, ways, conds, kinds, pending, ending):
        """Conditions of more than one kind (an answer, then karma): a choice for each kind in the order they come, its
        rest going on to the next one; the last one's rest is the part for everyone else (otherwise)."""
        for c in conds:
            if c["by"] == "none":
                c["by"] = "rest"
        rests = [k for k, c in enumerate(conds) if c["by"] == "rest"]
        for k in rests[1:]:
            self.rep.problem(ways[k][0].n, f"( {ways[k][0].title} ): only one part is for everyone else (otherwise)")
        if ending and not rests:
            conds[-1] = {"by": "rest"}
            self.rep.problem(ways[-1][0].n, f"the endings need one for everyone else: ( {ways[-1][0].title} ) is it (write otherwise after it)")
        head = "How it ends" if ending else ways[0][0].title + "?"
        out = []
        for i, by in enumerate(kinds):
            last = i == len(kinds) - 1
            idx = [k for k, c in enumerate(conds) if c["by"] == by or (last and c["by"] == "rest")]
            q = {"karma": "What the answers added up to", "answer": "What you answered"}[by]
            c = self.shape("choice", f"{head}: {'your answer' if by == 'answer' else 'karma'}", group[0], min(idx) if i else 0, by=by, question=q)
            self.join(pending, c["id"])
            for k in idx:
                cond, way = conds[k], ways[k]
                extra = {"when": {}} if cond["by"] == "rest" else {"when": {x: cond[x] for x in ("min", "max") if cond.get(x) is not None}} \
                    if by == "karma" else {"when": {"talk": cond["talk"], "answer": cond["answer"]}}
                p = [(c["id"], extra)]
                for sec in way:
                    p = self.section(sec, p, k)
                out += p
            pending = [(c["id"], {"when": {}})]  # the rest: on to the next kind's choice (the last: to the next part)
            if last and not ending and not any(conds[k]["by"] == "rest" for k in idx):
                out += pending
        return out

    def cond(self, s):
        t = s.cond_text.strip()
        low = re.sub(r"^(if|when)\s+", "", t.lower()).strip()
        if not t:
            return {"by": "none"}
        if low in ("otherwise", "else", "or else", "everyone else", "not", "the rest"):
            return {"by": "rest"}
        m = re.match(r"^karma\s*(?:is\s*)?(.*)$", low)
        if m:
            r = karma_cond(m.group(1))
            if r:
                return dict({"by": "karma"}, **r)
            self.rep.problem(s.n, f"{t}: karma how much? (if karma 2+, if karma -2 or less)")
            return {"by": "rest"}
        m = re.match(r"^\[\s*(.*?)\s*\]$", t[t.find("["):] if "[" in t else "")
        if m:
            label = m.group(1)
            for talk in reversed(self.talks):
                for o in talk["talk"]["options"]:
                    if norm_label(o["say"]) == norm_label(label.split(":")[-1]) and (":" not in label or norm_label(label.split(":")[0]) in norm_label(talk["title"])):
                        return {"by": "answer", "talk": talk["id"], "answer": o["id"]}
            self.rep.problem(s.n, f"{t}: no answer [ {label} ] before it")
            return {"by": "rest"}
        m = re.match(r"^\*(.+)\*$", re.sub(r"^(if|when)\s+", "", t, flags=re.I).strip())
        if m:
            act = parse_act(m.group(1))
            if act and act.get("thing") and act["verb"] != "go":
                self.thing(act["thing"], act["verb"], act["size"], None)
            return {"by": "player", "label": m.group(1).strip()}
        self.rep.problem(s.n, f"{t}: an if this note can't read (if [ Answer ], if karma 2+, if *do something*, otherwise)")
        return {"by": "rest"}


def karma_cond(t):
    t = t.strip().replace("≥", ">=").replace("≤", "<=")
    m = re.match(r"^(-?\d+)\s*(\+|or more|or higher|or above|and up|and over|plus)$", t)
    if m:
        return {"min": int(m.group(1))}
    m = re.match(r"^(-?\d+)\s*(-|or less|or lower|or below|and down|and under|minus)$", t)
    if m:
        return {"max": int(m.group(1))}
    m = re.match(r"^(>=|at least|over|above|more than|>|higher than)\s*(-?\d+)$", t)
    if m:
        v = int(m.group(2))
        return {"min": v + (1 if m.group(1) in (">", "over", "above", "more than", "higher than") else 0)}
    m = re.match(r"^(<=|at most|under|below|less than|<|lower than)\s*(-?\d+)$", t)
    if m:
        v = int(m.group(2))
        return {"max": v - (1 if m.group(1) in ("<", "under", "below", "less than", "lower than") else 0)}
    m = re.match(r"^(-?\d+)\s*(?:to|-|\.\.)\s*(-?\d+)$", t)
    if m:
        return {"min": int(m.group(1)), "max": int(m.group(2))}
    return None


STEP_SECS = {"say": 4, "you": 4, "think": 4, "see": 3, "cast": 3, "sound": 1, "light": 1, "power": 1, "music": 0, "fade": 2, "act": 25, "todo": 45,
             "name": 8, "save": 0, "feat": 0}


def minutes_of_steps(steps, typ):
    s = sum(x.get("secs", 0) if x["do"] == "wait" else x.get("secs", STEP_SECS.get(x["do"], 3)) if x["do"] == "todo" else STEP_SECS.get(x["do"], 3)
            for x in steps)
    if typ == "talk":
        s += 20
    return max(0.5, min(15, round(s / 30) / 2))


# ---- the layout -----------------------------------------------------------------------------------------------------

WRAP = 8                                # columns a row of the chart holds before the story goes on in the row below
ROW_GAP = 130                           # between one row of the chart and the next


def layout(mk, old_nodes):
    """Columns along the story (a shape after everything that leads to it), wrapped into rows like lines of text (a
    part's shapes kept in one row); the ways of a choice in lanes under it, secrets above, the endings stacked; a shape
    you moved before keeps its place."""
    N = {n["id"]: n for n in mk.nodes}
    N["start"] = {"id": "start", "type": "start"}
    col = {"start": 0}
    for _ in range(len(N)):
        moved = False
        for e in mk.edges:
            a, b = e["from"], e["to"]
            if a in col and N.get(b, {}).get("type") != "secret" and col.get(b, -1) < col[a] + 1:
                col[b], moved = col[a] + 1, True
        if not moved:
            break
    for e in mk.edges:                           # a secret: half a step on from where it's found
        if N.get(e["to"], {}).get("type") == "secret":
            col[e["to"]] = col.get(e["from"], 0) + 0.5
    lane = {}
    endings = [m["id"] for m in mk.nodes if m["type"] == "ending"]
    for k in N:
        lane[k] = endings.index(k) if k in endings else mk.lane.get(k, 0)
    # the rows: the parts in order, a new row when the next part would run past WRAP columns
    row, row_of, start_col = 0, {"start": 0}, [0]
    for sec, ids in mk.section_nodes.items():
        cs = [col[i] for i in ids if i in col]
        if not cs:
            continue
        if max(cs) - start_col[row] >= WRAP and min(cs) > start_col[row]:
            row += 1
            start_col.append(min(cs))
        for i in ids:
            row_of[i] = row
    # each row as tall as its lanes, the next below it; within a row, no two shapes on one spot
    used, spot = set(), {}
    for k in ["start"] + [m["id"] for m in mk.nodes]:
        r, c, ln = row_of.get(k, 0), col.get(k, 0), lane.get(k, 0)
        while (r, c, ln) in used:
            ln += 1 if ln >= 0 else -1
        used.add((r, c, ln))
        spot[k] = (r, c, ln)
    tops, y = [], Y0
    for r in range(row + 1):
        lanes = [ln for (rr, _, ln) in spot.values() if rr == r] or [0]
        tops.append(y - min(lanes) * ROW)        # the row's lane 0 (secrets above it, ways below)
        y += (max(lanes) - min(lanes) + 1) * ROW + ROW_GAP
    pos = {k: (X0 + round((c - start_col[r]) * STEP), tops[r] + ln * ROW) for k, (r, c, ln) in spot.items()}
    for n in mk.nodes:
        o = old_nodes.get(n["id"])
        if o and o.get("type") == n["type"] and "x" in o:
            n["x"], n["y"] = o["x"], o["y"]
        else:
            n["x"], n["y"] = pos[n["id"]]
    return pos["start"]


def frames_of(mk, old_frames):
    out = []
    for sec, ids in mk.section_nodes.items():
        ns = [n for n in mk.nodes if n["id"] in ids]
        if len(ns) < 2:
            continue
        fid = "act_" + ident(sec.title, 4, "a")
        xs, ys = [n["x"] for n in ns], [n["y"] for n in ns]
        f = {"id": fid, "title": sec.title, "x": min(xs) - 24, "y": min(ys) - 52, "w": max(xs) - min(xs) + SHAPE_W + 48, "h": max(ys) - min(ys) + SHAPE_H + 76,
             "color": COLORS[len(out) % len(COLORS)]}
        o = old_frames.get(fid)
        if o:
            f["color"] = o.get("color", f["color"])
        k = 2
        while any(x["id"] == f["id"] for x in out):
            f["id"], k = f"{fid}_{k}", k + 1
        out.append(f)
    return out


def keep_ids(mk, old):
    """The chart made again into a session whose shapes have other ids (drawn on the page, then written as a script): a
    new shape of the same type and title takes the old one's id, then one an arrow reaches from a shape that kept its
    id, where the old chart's arrow from there went to just one unclaimed shape of that type. It keeps its place on the
    chart, and a choice its title and question (a script can't name a choice: the reader makes those up)."""
    olds = {n["id"]: n for n in (old or {}).get("nodes", [])}
    if not olds:
        return
    new = {n["id"]: n for n in mk.nodes}
    taken = set(mk.ids) | set(new) | {"start"}
    free = [o for o in olds.values() if o.get("type") not in ("start", "note") and o["id"] not in taken]
    kept = lambda k: k in olds and k in new and olds[k].get("type") == new[k]["type"]
    key = lambda x: (x.get("type"), " ".join(str(x.get("title") or "").lower().split()))
    ren = {}

    def take(n, o):
        ren[n["id"]] = o["id"]
        free.remove(o)
    for n in mk.nodes:
        if not kept(n["id"]):
            o = next((o for o in free if key(o) == key(n)), None)
            if o:
                take(n, o)
    old_out = {}
    for e in (old or {}).get("edges", []):
        old_out.setdefault(e.get("from"), []).append(e.get("to"))
    moved = True
    while moved:
        moved = False
        for e in mk.edges:
            a, b = e["from"], e["to"]
            if b not in new or b in ren or kept(b):
                continue
            a_old = ren.get(a) or (a if a == "start" or kept(a) else None)
            cands = [o for o in free if o["id"] in old_out.get(a_old, []) and o.get("type") == new[b]["type"]] if a_old else []
            if len(cands) == 1:
                take(new[b], cands[0])
                moved = True
    if not ren:
        return
    for n in mk.nodes:
        if n["id"] in ren:
            o = olds[ren[n["id"]]]
            n["id"] = ren[n["id"]]
            if n["type"] == "choice":
                n.update({k: o[k] for k in ("title", "question") if o.get(k)})
            if n["type"] == "chapter" and o.get("title") and n.get("title") == (o.get("chapter") or {}).get("title"):
                n["title"] = o["title"]
    for e in mk.edges:
        e["from"], e["to"] = ren.get(e["from"], e["from"]), ren.get(e["to"], e["to"])
        w = e.get("when") or {}
        if w.get("talk") in ren:
            w["talk"] = ren[w["talk"]]
    mk.lane = {ren.get(k, k): v for k, v in mk.lane.items()}
    mk.section_nodes = {sec: [ren.get(i, i) for i in ids] for sec, ids in mk.section_nodes.items()}
    mk.notes = [(nt, ren.get(b, b), ln) for nt, b, ln in mk.notes]


def read(text, old=None):
    """A note into a prototype: (P, report). `old`: the session it goes into (its id, title if the note has none,
    brief, history and where its shapes sit are kept)."""
    rd = Reader(text).read()
    mk = Maker(rd).make()
    old = copy.deepcopy(old) if old else None
    keep_ids(mk, old)
    title = rd.front["title"] or (old or {}).get("title") or (rd.sections[0].title if rd.sections else "Untitled")
    P = proto.blank(title, {k: rd.front[k] for k in ("kind", "references", "minutes") if rd.front.get(k)})
    if old:
        for k in ("id", "created", "built", "brief"):
            if old.get(k) is not None:
                P[k] = old[k]
        for k in ("kind", "references", "minutes"):
            if rd.front.get(k):
                P["brief"][k] = rd.front[k]
    if rd.front["notes"]:
        P["brief"]["notes"] = "\n".join(rd.front["notes"])
    P["story"].update({"time": rd.front["time"]})
    P["story"].update({k: v for k, v in rd.front["story"].items() if k in ("logline", "hook", "truth", "tone", "setting", "player", "karma", "player_name")})
    P["cast"] = list(rd.cast.values())
    P["places"] = list(rd.places.values())
    for n in mk.nodes:                           # a shape's place: where it happens (the first place when none was said)
        if "where" in n and not n["where"] and P["places"]:
            n["where"] = P["places"][0]["id"]
    P["items"] = [{k: v for k, v in it.items() if k != "verbs"} for it in mk.items.values()]
    for it in P["items"]:
        if not it["where"] and P["places"]:
            it["where"] = P["places"][0]["id"]
    P["faces"] = list(mk.faces.values())
    P["feats"] = mk.feats
    olds = {n["id"]: n for n in (old or {}).get("nodes", [])}
    start = layout(mk, olds)
    P["nodes"][0].update({"x": olds.get("start", {}).get("x", start[0]), "y": olds.get("start", {}).get("y", start[1])})
    P["nodes"] += mk.nodes
    for k, (nt, beside, lane) in enumerate(mk.notes):
        b = next((n for n in P["nodes"] if n["id"] == beside), None) or next((n for n in reversed(P["nodes"]) if n["type"] != "note"), P["nodes"][0])
        P["nodes"].append({"id": f"note{k + 1:02d}", "type": "note", "x": b["x"] + 30, "y": b["y"] - 150, "text": nt["text"], "color": "yellow"})
    P["edges"] = mk.edges
    P["frames"] = frames_of(mk, {f["id"]: f for f in (old or {}).get("frames", [])})
    P["script"] = str(text or "")
    P["script_chart"] = write(P)                 # the chart as it came from the script: changed on the page since, the script is behind
    counts = {t: sum(1 for n in mk.nodes if n["type"] == t) for t in ("scene", "talk", "task", "chapter", "choice", "secret", "ending")}
    counts.update({"cast": len(P["cast"]), "places": len(P["places"]), "things": len(P["items"]), "faces": len(P["faces"])})
    errors, warnings = proto.check(P)
    rep = {"lines": rd.rep.lines, "problems": rd.rep.problems, "counts": counts, "errors": errors, "warnings": warnings}
    return P, rep


# ---- the chart, written back as notes ---------------------------------------------------------------------------------

def step_lines(P, steps):
    """A shape's steps as the note's lines (what was written, near enough to read back the same)."""
    cast = {c["id"]: c for c in P.get("cast", [])}
    items = {x["id"]: x for x in P.get("items", [])}
    faces = {f["id"]: f for f in P.get("faces", [])}
    feats = {f["id"]: f for f in P.get("feats", [])}
    name = lambda w: "You" if w == "player" else (cast.get(w) or {}).get("name") or w
    lines = []
    for s in steps or []:
        d = s.get("do")
        if d == "think":
            lines.append(f'"{s.get("text", "")}"')
        elif d == "say":
            f = faces.get(s.get("face")) or {}
            face = f.get("prompt", "").rstrip(".")
            lines.append(f'{name(s.get("who"))}: ' + (f"({face}) " if face else "") + f'"{s.get("text", "")}"')
        elif d == "you":
            lines.append(f'You: "{s.get("text", "")}"')
        elif d == "see":
            lines.append(s.get("text", ""))
        elif d in ("cast", "sound"):
            lines.append(f"*{s.get('text', '')}*")
        elif d == "act":
            it = items.get(s.get("item")) or {}
            size = it.get("size") if it.get("size") and it.get("size") != SIZE_OF.get((it.get("name") or "").split()[-1:][0] if it.get("name") else "") and it.get("kind") != "door" else None
            text = s.get("text") or f"{s.get('verb', 'use')} {it.get('name', '')}".strip()
            lines.append(f"*{text}{f' ({size})' if size and it.get('name', '') in text else ''}*")
        elif d == "todo":
            secs = s.get("secs")
            t = f" ({secs // 60:g} min)" if secs and secs % 60 == 0 else f" ({secs} s)" if secs else ""
            kind = ("Hidden " if s.get("hidden") else "") + ("timed task" if secs else "task")
            kind = kind[:1].upper() + kind[1:]
            lines.append(f"Request from {name(s['who'])} - {s.get('text', '')}" if s.get("who") else f"{kind}{t} - {s.get('text', '')}")
        elif d == "name":
            lines.append("*Enter Name*")
        elif d == "wait":
            lines.append(f"*wait {s.get('secs', 3):g}s*")
        elif d == "save":
            lines.append("*save*")
        elif d == "light":
            lines.append({"flicker": "*lights flicker*", "off": "*lights go out*", "on": "*lights come back*", "dim": "*lights dim*"}.get(s.get("set"), "*lights flicker*"))
        elif d == "power":
            lines.append("*the power comes back*" if s.get("set") == "on" else "*the power goes out*")
        elif d == "music":
            lines.append(f"*music: {s.get('mood')}*")
        elif d == "fade":
            lines.append("*fade to black*")
        elif d == "feat":
            f = feats.get(s.get("feat")) or {}
            lines.append(f"{'Hidden achievement' if f.get('hidden') else 'Achievement'}: {f.get('title', '')}" + (f" - {f['text']}" if f.get("text") else ""))
    return lines


def shape_lines(P, n):
    """A shape's script as the page's inspector shows it: its steps, and a talk's question, answers and replies as the
    script has them."""
    lines = step_lines(P, n.get("steps") or [])
    if n.get("type") != "talk":
        return lines
    t = n.get("talk") or {}
    ln = t.get("line") or {}
    cast = {c["id"]: c for c in P.get("cast", [])}
    who = ln.get("who") or next(iter(n.get("who") or []), "")
    nm = (cast.get(who) or {}).get("name") or who or "Someone"
    f = proto.face_of(P, ln.get("face"), {}) if ln.get("face") else None
    if ln.get("text") and ln["text"] != "…":
        lines.append(f"{nm}: " + (f"({f['prompt'].rstrip('.')}) " if f and f.get("prompt") else "") + f'"{ln["text"]}"')
    opts = t.get("options") or []
    if opts:
        lines.append(" --- ".join(f"[ {o.get('say', '')}{(' %+d' % o['karma']) if o.get('karma') else ''} ]" + (f" {o['think']}" if o.get("think") else "") for o in opts))
    for o in opts:
        if o.get("then"):
            lines += ["", f"[ {o.get('say', '')} ]", f"{nm}: " + (f"({o['tell']}) " if o.get("tell") else "") + f'"{o["then"]}"']
    return lines


def write(P):
    """The chart as a note in this syntax, read along the story, so it can go back to the phone: a part per shape; a
    talk's answers with what follows each as `[ Answer ]` blocks and `[ Either way ]` where they meet again; any other
    choice's ways as parts with their conditions (each shape on a way carries it), the shape where the ways meet with
    none. Read back, it makes the same story."""
    N = proto.nodes_of(P)
    cast = {c["id"]: c for c in P.get("cast", [])}
    places = {x["id"]: x for x in P.get("places", [])}
    st = P.get("story") or {}
    out = []
    if P.get("title"):
        out.append(f"Title: {P['title']}")
    if st.get("time"):
        out.append(f"Starts: {st['time']}")
    if st.get("player_name"):
        out.append(f"Name: {st['player_name']}")
    for k in ("player", "logline", "tone", "setting", "truth"):
        if st.get(k):
            out.append(f"{k.title()}: {st[k]}")
    for k in ("kind", "references"):
        if (P.get("brief") or {}).get(k):
            out.append(f"{k.title()}: {P['brief'][k]}")
    for c in P.get("cast", []):
        out.append(f"{c.get('name') or c['id']} ({c.get('subject', 'she')})" + (f": {c['role']}" if c.get("role") else ""))
    for x in P.get("places", []):
        out.append(f"@ {x.get('name') or x['id']}" + (f": {x['look']}" if x.get("look") else ""))
    for line in str((P.get("brief") or {}).get("notes") or "").split("\n"):
        if line.strip():
            out.append(f"Note: {line.strip()}")
    name = lambda w: "You" if w == "player" else (cast.get(w) or {}).get("name") or w
    order = [k for k in proto.reading_order(P) if N[k].get("type") not in ("start", "note")]
    rank = {k: i for i, k in enumerate(order)}
    mains = lambda k: proto.main_out(P, k, N)
    done, where = set(), [None]

    def join_of(ks):
        """The first shape, in reading order, that every one of these comes to (or is)."""
        sets = [proto.reachable(P, k, N) for k in ks if k in N]
        common = set.intersection(*sets) if sets else set()
        return min(common, key=lambda k: rank.get(k, 1e9)) if common else None

    def lines_of(n):
        ls = []
        if n.get("where") and n["where"] != where[0] and n["where"] in places:
            ls.append(f"@ {places[n['where']].get('name') or n['where']}")
            where[0] = n["where"]
        if not n.get("steps"):                   # drawn on the page: its gist (a secret's what it shows) is what happens
            gist = str(n.get("shows") if n.get("type") == "secret" else n.get("text") or "").strip()
            return ls + [x.strip() for x in gist.split("\n") if x.strip()]
        return ls + step_lines(P, n.get("steps") or [])

    def face_of(fid):
        f = proto.face_of(P, fid, {}) if fid else None
        return f"({f['prompt'].rstrip('.')}) " if f and f.get("prompt") else ""

    def block(frm, stop):
        """A way's own shapes, from `frm` up to where the ways meet: their lines, inline."""
        ls, k = [], frm
        while k and k != stop and k in N and k not in done and N[k].get("type") in ("scene", "task") and len(mains(k)) <= 1:
            done.add(k)
            ls += lines_of(N[k])
            k = (mains(k) or [{}])[0].get("to")
        return ls

    def talk(n):
        t = n.get("talk") or {}
        ln = t.get("line") or {}
        ls = []
        asker = ln.get("who") or next(iter(n.get("who") or []), "") or next(iter(cast), "")
        if ln.get("text") and ln["text"] != "…":
            ls.append(f"{name(asker) or 'Someone'}: {face_of(ln.get('face'))}\"{ln['text']}\"")
        opts = t.get("options") or []
        ls.append(" --- ".join(f"[ {o.get('say', '')}{(' %+d' % o['karma']) if o.get('karma') else ''} ]" + (f" {o['think']}" if o.get("think") else "") for o in opts))
        ways, join, after = {}, None, mains(n["id"])
        c = N.get(after[0]["to"]) if len(after) == 1 else None
        if c and c.get("type") == "choice" and c.get("by") == "answer" and all((e.get("when") or {}).get("talk") in (None, n["id"]) for e in proto.outs(P, c["id"])):
            es = proto.outs(P, c["id"])
            join = join_of([e["to"] for e in es])
            named = {(e.get("when") or {}).get("answer") for e in es if (e.get("when") or {}).get("talk")}
            for e in es:
                w = e.get("when") or {}
                if w.get("talk"):
                    ways[w["answer"]] = e["to"]
                elif e["to"] != join:              # every answer had a way: the last one's is the rest
                    left = [o["id"] for o in opts if o["id"] not in named]
                    if left:
                        ways[left[-1]] = e["to"]
            done.add(c["id"])
        blocks = []
        for o in opts:
            body = [f"{name(asker) or 'Someone'}: " + (f"({o['tell']}) " if o.get("tell") else "") + f"\"{o['then']}\""] if o.get("then") else []
            if o["id"] in ways and ways[o["id"]] != join:
                body += block(ways[o["id"]], join)
            if body:
                blocks += ["", f"[ {o.get('say', '')} ]"] + body
        return ls + (blocks + ["[ Either way ]"] if blocks else [])

    def blockable(c):
        """Every way of this choice is scenes and tasks, one after another, up to where the ways meet."""
        es = proto.outs(P, c["id"])
        join = join_of([e["to"] for e in es])
        for e in es:
            k, seen = e["to"], set()
            while k and k != join:
                if k in seen or k not in N or N[k].get("type") not in ("scene", "task") or len(mains(k)) > 1:
                    return False
                seen.add(k)
                k = (mains(k) or [{}])[0].get("to")
        return True

    inline = set()                               # the choices written as blocks where they come
    for k in order:
        m = mains(k)
        c = N.get(m[0]["to"]) if len(m) == 1 else None
        if not c or c.get("type") != "choice":
            continue
        if N[k].get("type") == "talk" and c.get("by") == "answer" and all((e.get("when") or {}).get("talk") in (None, k) for e in proto.outs(P, c["id"])) \
                and blockable(c):
            inline.add(c["id"])
        elif N[k].get("type") in ("scene", "task") and c.get("by", "player") == "player":
            inline.add(c["id"])

    def ways(c):
        """A choice by doing, written after the shape before it: its ways as answers with their thoughts, what follows
        each as its block."""
        es = proto.outs(P, c["id"])
        join = join_of([e["to"] for e in es])
        ls = [" --- ".join(f"[ *{e.get('label') or '…'}* ]" + (f" {e['think']}" if e.get("think") else "") for e in es)]
        blocks = []
        for e in es:
            body = block(e["to"], join) if e["to"] != join else []
            if body:
                blocks += ["", f"[ {e.get('label') or '…'} ]"] + body
        done.add(c["id"])
        return ls + (blocks + ["[ Either way ]"] if blocks else [])

    # the conditions on the ways of the other choices: each shape on a way carries its way's
    cond = {}
    for k in order:
        c = N[k]
        if c.get("type") != "choice" or k in inline:
            continue
        es = proto.outs(P, k)
        join = join_of([e["to"] for e in es])
        for e in es:
            w = e.get("when") or {}
            if c.get("by") == "karma":
                txt = f"if karma {w['min']}+" if w.get("min") is not None else f"if karma {w['max']} or less" if w.get("max") is not None else "otherwise"
            elif c.get("by") == "answer":
                tk = N.get(w.get("talk")) or {}
                o = next((x for x in (tk.get("talk") or {}).get("options") or [] if x.get("id") == w.get("answer")), {})
                txt = f"if [ {o.get('say') or w.get('answer')} ]" if w.get("talk") else "otherwise"
            else:
                lab = str(e.get("label") or "")
                txt = "otherwise" if lab in ("otherwise", "carry on", "") else f"if *{lab}*"
            if e["to"] == join:
                continue                          # the rest go on to where the ways meet: no condition
            todo_ = [e["to"]]
            while todo_:
                x = todo_.pop()
                if x == join or x in cond or x not in N or N[x].get("type") in ("secret", "choice"):
                    continue                      # a choice on the way gives its own ways their conditions
                cond[x] = txt
                todo_ += [m["to"] for m in mains(x)]
    beside = {}                                  # a sticky note: written after the shape nearest it
    for n in N.values():
        if n.get("type") == "note" and str(n.get("text", "")).strip():
            near = min((m for m in N.values() if m.get("type") not in ("note", "start", "choice")), default=None,
                       key=lambda m: (m.get("x", 0) - n.get("x", 0)) ** 2 + (m.get("y", 0) - n.get("y", 0)) ** 2)
            beside.setdefault(near["id"] if near else None, []).append(n["text"])

    def next_on_way(k):
        """The shape after k on the same way (after its choice written inline, where that meets again), if it carries
        the same condition: a way's parts are written one after another."""
        m = mains(k)
        if len(m) != 1:
            return None
        to = m[0]["to"]
        if to in inline:
            to = join_of([e["to"] for e in proto.outs(P, to)])
        return to if to and k in cond and cond.get(to) == cond[k] and to not in done else None

    ordered, seen = [], set()
    for k in order:
        while k and k not in seen:
            seen.add(k)
            ordered.append(k)
            k = next_on_way(k)
    for k in ordered:
        if k in done:
            continue
        n = N[k]
        t = n.get("type")
        if t == "choice":
            continue
        title = n.get("title") or k
        c = f" {cond[k]}" if k in cond else ""
        if t == "ending":
            head = f"( {'True ending' if n.get('kind') == 'intended' else 'Ending'}: {title} ){c}"
        elif t == "secret":
            head = f"( Secret: {title} )"
        elif t == "chapter":
            ch = n.get("chapter") or {}
            head = f"( Chapter: {ch.get('title') or title}{' · ' + ch['sub'] if ch.get('sub') else ''} ){c}"
        else:
            head = f"( {title} ){c}"
        out += ["", head, ""]
        done.add(k)
        if t == "secret":
            out.append(f"Find: *{n.get('find') or 'look round'}*")
        out += lines_of(n)
        if t == "talk":
            out += talk(n)
        else:
            m = mains(k)
            if len(m) == 1 and m[0]["to"] in inline and m[0]["to"] not in done:
                out += ways(N[m[0]["to"]])
        a = n.get("achievement") or {}
        if t in ("ending", "secret") and a.get("title"):
            out.append(f"{'Hidden achievement' if a.get('hidden') and t == 'secret' else 'Achievement'}: {a['title']}" + (f" - {a['text']}" if a.get("text") else ""))
        out += [f"Note: {x}" for x in beside.pop(k, [])]
    for xs in beside.values():
        out += [f"Note: {x}" for x in xs]
    return "\n".join(out).strip() + "\n"
