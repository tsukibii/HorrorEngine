"""The lives of the little things (docs/IMMERSION.md): Content/Studio/Life/lives.json, read the way the desk's
tools/director/life.js reads it. Which life a prop has (its own `life`, else its kit's), where it starts, its states,
and how a state can be reached (by waiting, by the player's act, by the thing it stands on): the story check's walker
uses that to play a `{"state": id, "is": s}` trigger through. Plain Python, no `unreal`."""
import json

from . import storylib as L
from . import kit as KIT

LIVES_FILE = L.STUDIO / "Life" / "lives.json"
ACT_SECS = 2.0          # the walker's time to do a thing's act (switch the kettle on)
_cache = {}


def data():
    m = LIVES_FILE.stat().st_mtime if LIVES_FILE.exists() else 0
    if _cache.get("mtime") != m:
        _cache["mtime"] = m
        _cache["data"] = json.loads(LIVES_FILE.read_text(encoding="utf-8")) if m else {"lives": {}}
    return _cache["data"]


def lives():
    return data().get("lives", {})


def _val(v):
    return "true" if v is True else "false" if v is False else str(v)


def pick_rule(rule, spec):
    """A by_kit rule: a life's name, or {param: {value: life | null}, ..., "else": life} (life.js pickRule)."""
    if rule is None:
        return None
    if isinstance(rule, str):
        return rule
    for k, m in rule.items():
        if k == "else" or k not in spec or not isinstance(m, dict):
            continue
        if _val(spec[k]) in m:
            return m[_val(spec[k])]
    return rule.get("else")


def life_of(d):
    """A prop's life: its own `life` (false switches it off), else its kit's (by_preset, then by_kit)."""
    D, lv = data(), lives()
    if not isinstance(d, dict):
        return None
    if "life" in d:
        return d["life"] if d["life"] and d["life"] in lv else None
    if d.get("kit") is None:
        return None
    try:
        k = KIT.resolve(d["kit"])
    except ValueError:
        return None
    pre = d["kit"] if isinstance(d["kit"], str) else d["kit"].get("preset")
    if pre and pre in (D.get("by_preset") or {}):
        return D["by_preset"][pre]
    name = pick_rule((D.get("by_kit") or {}).get(k.get("type")), k)
    return name if name in lv else None


def states(life):
    return [s["id"] for s in lives().get(life, {}).get("states", [])]


def state_def(life, s):
    return next((x for x in lives().get(life, {}).get("states", []) if x["id"] == s), None)


def start(d, life):
    ids = states(life)
    return d.get("state") if d.get("state") in ids else (ids[0] if ids else None)


def secs_of(life, d, s):
    own = (d.get("secs") or {}).get(s) if isinstance(d.get("secs"), dict) else None
    sd = state_def(life, s) or {}
    return float(own) if own is not None else (float(sd["secs"]) if "secs" in sd else None)


def reach(life, d, frm, to, leader=None, ready=None):
    """Seconds to go from state `frm` to `to` by itself (timers) and by the player's acts (when it can be touched), or
    None. `leader`: a function (state) -> seconds for the thing it follows to get there (or None), so a pot boils once
    its hob is on. `ready`: a function (setting) -> seconds for the source an act needs (a cup's `from`) to be ready."""
    if frm == to:
        return 0.0
    best, todo = {frm: 0.0}, [(0.0, frm)]
    follows = lives().get(life, {}).get("follows") or {}
    while todo:
        todo.sort()
        t, s = todo.pop(0)
        if s == to:
            return t
        sd = state_def(life, s) or {}
        nxt = []
        secs = secs_of(life, d, s)
        if sd.get("next") and secs is not None:
            nxt.append((sd["next"], secs))
        if d.get("acts", True) is not False:
            for a in sd.get("acts") or []:
                if not a.get("needs"):
                    nxt.append((a["to"], ACT_SECS))
                elif ready and ready(a["needs"]) is not None:
                    nxt.append((a["to"], ACT_SECS + ready(a["needs"])))
        if leader:
            for ls, fs in follows.items():
                lt = leader(ls)
                if lt is not None:
                    nxt.append((fs, lt))
        for n, dt in nxt:
            if n and (n not in best or t + dt < best[n]):
                best[n] = t + dt
                todo.append((t + dt, n))
    return None
