"""The rules that keep a model from breaking the animations (docs/ANIMATION_RULES.md), held.

    python tools/anim_rules.py tables     the measured tables written into docs/ANIMATION_RULES.md (between its markers),
                                          from Content/Studio/Animation/space.json and ranges.json
    python tools/anim_rules.py check      ANIMRULES: the document's tables are those files' own; the files are what the
                                          clips measure today (three bodies made again: node tools/animator/space.mjs);
                                          every seat, bed and door in the kit and every chair the prop generator makes
                                          is inside the rules' ranges, or is listed in rules.json with why not
    python tools/anim_rules.py check --quick     without making the bodies again (check_all runs it this way: the
                                          Animator's own check holds the clips)

DECISIONS 2026-11-14, later: "interior, furniture and street rules for yourself so if I use claude to model in the
future it can stick to rules that dont break the animations".
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HERE = ROOT / "Content" / "Studio" / "Animation"
DOC = ROOT / "docs" / "ANIMATION_RULES.md"
PEOPLE = ["skinny_man", "normal_woman", "chubby_woman"]
LABEL = {"skinny_man": "a man, 1.80 m", "normal_woman": "a woman, 1.63 m", "chubby_woman": "a heavy woman, 1.60 m", "child_8": "a girl of 8, 1.27 m", "child_small": "a small child, 1.10 m",
         "child_12": "a boy of 12, 1.49 m", "goblin": "goblin, 1.15 m", "ghoul": "ghoul, 1.90 m", "ogre": "ogre, 2.60 m", "imp": "imp, 0.90 m", "hag": "hag, 1.50 m"}
ORDER = ["person", "skinny_man", "normal_woman", "chubby_woman", "child_12", "child_8", "child_small", "hag", "goblin", "imp", "ghoul", "ogre"]


def load(name):
    return json.loads((HERE / name).read_text(encoding="utf-8"))


def cm(v):
    return "" if v is None else str(round(v * 100))


def person(B):
    """the most any of the three adults needs: what "a person" means in the rules"""
    out = {"height": max(B[n]["height"] for n in PEOPLE), "clips": {}}
    for g in B[PEOPLE[0]]["clips"]:
        e = {}
        for k, v in B[PEOPLE[0]]["clips"][g].items():
            vals = [B[n]["clips"][g].get(k) for n in PEOPLE]
            if isinstance(v, bool) or not isinstance(v, (int, float)):
                e[k] = v
            else:
                e[k] = max(vals)
        out["clips"][g] = e
    return out


def tables():
    B = dict(load("space.json")["bodies"])
    B["person"] = person(B)
    LABEL["person"] = "**a person** (the most of the three adults)"
    rows = [n for n in ORDER if n in B]
    c = lambda n, g, k: cm(B[n]["clips"].get(g, {}).get(k))
    t = {}
    t["move"] = ["| | standing: wide, in front, behind | walking: wide, stride in front and behind | running: wide | sneaking: wide, high | creeping: wide, in front, high | crawling: wide, long, high | scuttling: wide, long, high |", "|---|---|---|---|---|---|---|---|"]
    for n in rows:
        e = B[n]["clips"]
        long = lambda g: cm(e[g]["front"] + e[g]["back"])
        t["move"].append(f"| {LABEL[n]} | {c(n, 'stand', 'wide')}, {c(n, 'stand', 'front')}, {c(n, 'stand', 'back')} | {c(n, 'walk', 'wide')}, {c(n, 'walk', 'front')}, {c(n, 'walk', 'back')} | {c(n, 'run', 'wide')} | {c(n, 'sneak', 'wide')}, {c(n, 'sneak', 'up')} | "
                         f"{c(n, 'creep', 'wide')}, {c(n, 'creep', 'front')}, {c(n, 'creep', 'up')} | {c(n, 'crawl', 'wide')}, {long('crawl')}, {c(n, 'crawl', 'up')} | {c(n, 'scuttle', 'wide')}, {long('scuttle')}, {c(n, 'scuttle', 'up')} |")
    t["seat"] = ["| | the seat her clip is made for | she stands in front of its edge | her body in front of the edge | behind the edge | wide |", "|---|---|---|---|---|---|"]
    for n in rows:
        e = B[n]["clips"]["sit"]
        t["seat"].append(f"| {LABEL[n]} | {cm(e['height'])}{' (high for her: she gets up onto it)' if e.get('high') and n != 'person' else ''} | {cm(e['stands'])} | {cm(e['before'])} | {cm(e['behind'])} | {cm(e['wide'])} |")
    t["bed"] = ["| | the bed her clip is made for | in front of its edge | behind the edge | along it to her head's end | to her feet's end | her head: along, over the bed, in from the edge |", "|---|---|---|---|---|---|---|"]
    for n in rows:
        e = B[n]["clips"]["bed"]
        hd = e.get("head") or [0, 0, 0]
        t["bed"].append(f"| {LABEL[n]} | {cm(e['height'])} | {cm(e['before'])} | {cm(e['behind'])} | {cm(e['to_head'])} | {cm(e['to_feet'])} | {cm(hd[0])}, {cm(hd[1] - e['height'])}, {cm(-hd[2])} |" if n != "person" else
                        f"| {LABEL[n]} | {cm(e['height'])} | {cm(e['before'])} | {cm(e['behind'])} | {cm(e['to_head'])} | {cm(e['to_feet'])} | |")
    t["door"] = ["| | the handle her clip is made for | from where she stands: to her right, ahead | pushed: her hand goes ahead | pulled: her body behind where she stands | slid: the handle goes to her right; her reach across | wide (push, pull) |", "|---|---|---|---|---|---|---|"]
    for n in rows:
        if n == "person":
            continue
        e = B[n]["clips"]
        hd = e["door_push"]["handle"]
        t["door"].append(f"| {LABEL[n]} | {cm(hd[1])} | {cm(-hd[0])}, {cm(hd[2])} | {cm(e['door_push']['front'])} | {cm(e['door_pull']['behind'])} | {cm(-e['door_slide']['travel'][0])}; {cm(e['door_slide']['wide'])} | {cm(e['door_push']['wide'])}, {cm(e['door_pull']['wide'])} |")
    t["hands"] = ["| | a thing on the floor, on a table, on a shelf: its height; how far ahead of her | a peek: the wall's end to her right, the wall's face ahead; her width | a scare reaches | a punch reaches | a swing: her hand up to, wide | a knock: up, ahead |", "|---|---|---|---|---|---|---|"]
    for n in rows:
        if n == "person":
            continue
        e = B[n]["clips"]
        lo, mi, hi, pk = e["reach_low"]["at"], e["reach_mid"]["at"], e["reach_high"]["at"], e["peek"]
        t["hands"].append(f"| {LABEL[n]} | {cm(lo[1])}, {cm(mi[1])}, {cm(hi[1])}; {cm(lo[2])}, {cm(mi[2])}, {cm(hi[2])} | {cm(-pk['edge'][0])}, {cm(pk['edge'][2])}; {cm(pk['left'] + pk['right'])} | {cm(e['scare']['front'])} | {cm(e['punch']['front'])} | "
                          f"{cm(e['swing']['up'])}, {cm(e['swing']['wide'])} | {cm(e['knock']['at'][1])}, {cm(e['knock']['at'][2])} |")
    R = load("ranges.json")["bodies"] if (HERE / "ranges.json").is_file() else {}
    t["ranges"] = ["| | a door's handle: held within 1 cm | within 3 cm | a thing to pick up, what it stands on: her hand's grip on it within 2 cm | within 5 cm |", "|---|---|---|---|---|"]
    span = lambda d, lim, f: runs([float(k) for k, v in sorted(d.items(), key=lambda kv: float(kv[0])) if f(v) <= lim])
    for n in ["normal_woman", "child_small", "imp"]:
        if n not in R:
            continue
        h, p = R[n]["handles"], R[n]["picks"]
        t["ranges"].append(f"| {LABEL[n]} | {span(h, 1.0, lambda v: v)} | {span(h, 3.0, lambda v: v)} | {span(p, 2.0, lambda v: v[0])} | {span(p, 5.0, lambda v: v[0])} |")
    return {k: "\n".join(v) for k, v in t.items()}


def runs(vals):
    """a list of heights as ranges: 0.90 to 1.25 m"""
    if not vals:
        return "nowhere"
    step = min((round(b - a, 2) for a, b in zip(vals, vals[1:])), default=0.1)
    out, a, prev = [], vals[0], vals[0]
    for v in vals[1:] + [None]:
        if v is None or round(v - prev, 2) > step + 0.001:
            out.append(f"{a:.2f} m" if a == prev else f"{a:.2f} to {prev:.2f} m")
            a = v
        prev = v
    return ", ".join(out)


def filled(text, t):
    for k, body in t.items():
        pat = re.compile(rf"(<!-- {k}:begin -->\n).*?(<!-- {k}:end -->)", re.S)
        if not pat.search(text):
            raise SystemExit(f"docs/ANIMATION_RULES.md has no <!-- {k}:begin --> ... <!-- {k}:end --> block")
        text = pat.sub(lambda m: m.group(1) + body + "\n" + m.group(2), text)
    return text


def catalogue():
    """every seat, bed and door the studio's tools make, with the height that matters: [(name, kind, value, where)]"""
    js = ("import('" + (ROOT / "tools" / "director" / "kit.js").as_posix() + "').then(K => { const fs = require('fs');"
          " const P = JSON.parse(fs.readFileSync('" + (ROOT / "Content" / "Studio" / "Kit" / "presets.json").as_posix() + "', 'utf8')).presets, out = [];"
          " for (const [n, p] of Object.entries(P)) { let s; try { s = K.withDefaults(K.resolve(p, P)); } catch (e) { continue; }"
          " if (s.type === 'sofa') out.push([n, 'seat', s.seat_h]); else if (s.type === 'school_chair') out.push([n, 'seat', s.seat_h]);"
          " else if (s.type === 'bed') out.push([n, 'bed', s.top]);"
          " else if (s.type === 'door') out.push([n, 'door', s.handle_z, s.size[0], s.size[2], s.style]);"
          " else if (s.type === 'parts' && /chair|stool|bench/.test(n)) { let top = 0, area = 0; for (const q of s.parts || []) { if (q.s !== 'box') continue; const a = q.size[0] * q.size[1], z = (q.at[2] || 0) + q.size[2];"
          " if (z < 0.7 && a > area) { area = a; top = z; } } out.push([n, 'seat', +top.toFixed(3)]); }"
          " else if (s.type === 'table' && /bench/.test(n)) out.push([n, 'seat', s.size[2]]); }"
          " console.log(JSON.stringify(out)); });")
    r = subprocess.run(["node", "-e", js], capture_output=True, text=True, timeout=120)
    if r.returncode != 0 or not r.stdout.strip().startswith("["):
        raise SystemExit("ANIMRULES FAILED: the kit's presets didn't resolve: " + (r.stdout + r.stderr)[-800:])
    out = [tuple(x) + ("the kit",) for x in json.loads(r.stdout.strip().splitlines()[-1])]
    src = (ROOT / "tools" / "propgen" / "families" / "chair.py").read_text(encoding="utf-8")
    for m in re.finditer(r'"(\w+)": dict\(seat_h=(\d+)', src):
        out.append((m.group(1), "seat", int(m.group(2)) / 1000.0, "the prop generator's chairs"))
    return out


def check(args):
    errs, said = [], []
    R = load("rules.json")
    if not DOC.is_file():
        errs.append("no docs/ANIMATION_RULES.md")
    else:
        text = DOC.read_text(encoding="utf-8")
        if filled(text, tables()) != text:
            errs.append("docs/ANIMATION_RULES.md's tables aren't what Content/Studio/Animation's files say: python tools/anim_rules.py tables")
    if "--quick" not in args:
        r = subprocess.run(["node", str(ROOT / "tools" / "animator" / "space.mjs"), "--check", "--body", "normal_woman,child_small,ogre"], capture_output=True, text=True, timeout=900)
        if "SPACE ok" not in r.stdout:
            errs += [ln[7:] for ln in r.stdout.splitlines() if ln.startswith("ERROR: ")][:6] or ["node tools/animator/space.mjs --check failed: " + (r.stdout + r.stderr)[-400:]]
    seats = beds = doors = 0
    listed = {**R.get("not_seats", {}), **R.get("floor_beds", {}), **R.get("high_seats", {}), **R.get("doors_out", {})}
    for item in catalogue():
        name, kind, v, where = item[0], item[1], item[2], item[-1]
        if kind == "seat":
            seats += 1
            if not (R["seat"]["min"] - 1e-6 <= v <= R["seat"]["max"] + 1e-6) and name not in listed:
                errs.append(f"{where}: {name}'s seat is {v * 100:.0f} cm: outside {R['seat']['min'] * 100:.0f} to {R['seat']['max'] * 100:.0f} cm, where a person's sit clip works ({R['seat']['why']}); change it, or list it in rules.json with why")
        elif kind == "bed":
            beds += 1
            if not (R["bed"]["min"] - 1e-6 <= v <= R["bed"]["max"] + 1e-6) and name not in listed:
                errs.append(f"{where}: {name}'s mattress is {v * 100:.0f} cm up: outside {R['bed']['min'] * 100:.0f} to {R['bed']['max'] * 100:.0f} cm ({R['bed']['why']}); change it, or list it in rules.json with why")
        elif kind == "door":
            doors += 1
            hz, w, h, style = v, item[3], item[4], item[5]
            if name in listed or style in ("slide", "shoji", "bars"):
                continue                                     # (a sliding door is taken by its edge, wherever her hand is)
            if not (R["handle"]["min"] - 1e-6 <= hz <= R["handle"]["max"] + 1e-6):
                errs.append(f"{where}: {name}'s handle is {hz * 100:.0f} cm up: outside {R['handle']['min'] * 100:.0f} to {R['handle']['max'] * 100:.0f} cm ({R['handle']['why']})")
            if w < R["door"]["width"] - 1e-6 or h < R["door"]["height"] - 1e-6:
                errs.append(f"{where}: {name} is {w * 100:.0f} cm wide and {h * 100:.0f} cm high: under {R['door']['width'] * 100:.0f} by {R['door']['height'] * 100:.0f} cm ({R['door']['why']})")
    for name in listed:
        if not any(it[0] == name for it in catalogue_names()):
            errs.append(f"rules.json lists {name}, which nothing makes any more")
    said.append(f"{seats} seats, {beds} beds and {doors} doors of the kit and the prop generator inside the rules' ranges, {len(listed)} listed with why not")
    for s in said:
        print("  " + s)
    for e in errs:
        print("ERROR: " + e)
    print("ANIMRULES ok" if not errs else f"ANIMRULES FAILED ({len(errs)})")
    return 1 if errs else 0


_names = None


def catalogue_names():
    global _names
    if _names is None:
        _names = catalogue() + [(n,) for n in json.loads((ROOT / "Content" / "Studio" / "Kit" / "presets.json").read_text(encoding="utf-8"))["presets"]]
    return _names


def main():
    a = sys.argv[1:]
    if a and a[0] == "tables":
        DOC.write_text(filled(DOC.read_text(encoding="utf-8"), tables()), encoding="utf-8")
        print(f"  {DOC}")
        return 0
    if a and a[0] == "check":
        return check(a[1:])
    print(__doc__)
    return 1


if __name__ == "__main__":
    sys.exit(main())
