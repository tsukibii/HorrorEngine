"""Stairs from points (docs/KIT.md §11b; DECISIONS 2026-11-06: "stairs aren't pre-defined: you select start, mid and
end points and they get generated to our rules"): a prop's `stairs` object laid out as flights, landings and winders,
the same numbers as kit.js stairsLayout (tools/kit/check.mjs compares them). Plain Python: the plan builds the level's
pieces from the parts (plan.py stairs_pieces), the story index takes the box round them, the story check reads the
warnings.

The way: `from` at the foot, `to` at the top (x, y, z in room metres), `via` points on the way: straight on a landing to
rest on, to the side (more than half a width across) a quarter turn (a house's: three winders round the newel; else a
landing), back behind (the point after it behind the node) a half turn with a platform, the way back down the lane
that point lies on. The risers: as many as 2R + G = 63 cm wants, never taller than the style's limit; the treads
shared out along the flights by their runs (a warning when they come out shallower than the style allows); a via
point with a height of its own fixes the landing there."""
import math

RULES = {
    "blondel": 0.63, "winders": 3, "top": 1.0, "slab": 0.25, "under": 2.0,
    "riser_max": {"house": 0.23, "house_open": 0.23, "apartment": 0.2, "motel": 0.2, "steel": 0.22},
    "tread_min": {"house": 0.18, "house_open": 0.18, "apartment": 0.23, "motel": 0.26, "steel": 0.22},
    "preset": {"house": "stairs_house", "house_open": "stairs_house_open", "apartment": "stairs_apartment", "motel": "stairs_motel", "steel": "stairs_steel"},
    "winder": {"house": "winder_house", "house_open": "winder_house", "apartment": "winder_apartment", "motel": "winder_apartment", "steel": "winder_apartment"},
    "slot": {"house": "wood", "house_open": "wood", "apartment": "concrete", "motel": "concrete", "steel": "checker"},
    "rail": {"house": "none", "house_open": "right", "apartment": "right", "motel": "both", "steel": "right"},
    "wall_rail": {"house": "left", "house_open": "left", "apartment": "none", "motel": "none", "steel": "none"},
}
STYLES = tuple(RULES["preset"])
TURNS = ("auto", "landing", "winders")
RAILS = ("none", "left", "right", "both")


def r6(v):
    """kit.js r6: Math.round(v * 1e6) / 1e6 (halves up)."""
    return math.floor(v * 1e6 + 0.5) / 1e6


def _round(v):
    """JavaScript's Math.round."""
    return math.floor(v + 0.5)


def rot_of(a):
    return r6((math.degrees(math.atan2(a[1], a[0])) - 90) % 360)


def _snap45(a):
    k = _round(math.atan2(a[1], a[0]) / (math.pi / 4)) * (math.pi / 4)
    return [r6(math.cos(k)), r6(math.sin(k))]


def _clamp(v, a, b):
    return min(b, max(a, v))


def _pt(p):
    p = p if isinstance(p, (list, tuple)) else []
    x = float(p[0]) if len(p) > 0 and isinstance(p[0], (int, float)) else 0.0
    y = float(p[1]) if len(p) > 1 and isinstance(p[1], (int, float)) else 0.0
    z = float(p[2]) if len(p) > 2 and isinstance(p[2], (int, float)) else None
    return [x, y, z]


def layout(spec):
    """{"parts": [...], "warnings", "n", "riser", "treads", "pitch", "walk", "bounds", "style", "w"}: kit.js stairsLayout."""
    RU = RULES
    spec = spec if isinstance(spec, dict) else {}
    style = spec.get("style") if spec.get("style") in RU["preset"] else "house"
    w_in = spec.get("w")
    w = _clamp(float(w_in) if isinstance(w_in, (int, float)) and w_in else 0.9, 0.6, 2.5)
    top_in = spec.get("top")
    top = float(top_in) if isinstance(top_in, (int, float)) and top_in > 0 else RU["top"]
    turn_mode = spec.get("turn") if spec.get("turn") in TURNS else "auto"
    via = spec.get("via") if isinstance(spec.get("via"), list) else []
    P = [_pt(spec.get("from"))] + [_pt(v) for v in via] + [_pt(spec.get("to"))]
    warnings, parts = [], []
    k = len(P) - 1
    z0 = P[0][2] if P[0][2] is not None else 0.0
    H = (P[k][2] if P[k][2] is not None else z0) - z0
    out = {"parts": parts, "warnings": warnings, "n": 0, "riser": 0, "treads": [], "pitch": 0, "walk": 0, "bounds": None, "style": style, "w": w}
    if k < 1:
        warnings.append("a stair needs a foot and a top")
        return out
    if not H > 0.3:
        warnings.append(f"the top is {H:.2f} m above the foot: a stair climbs at least 0.3 m")
        return out

    def unit(p, q):
        dx, dy = q[0] - p[0], q[1] - p[1]
        ln = math.hypot(dx, dy)
        return [dx / ln, dy / ln] if ln > 1e-6 else None

    flights, nodes = [], {}
    cur = [P[0][0], P[0][1]]
    A = _snap45(unit(P[0], P[1]) or [0, 1])
    well = 0
    for i in range(k):
        nx = P[i + 1]
        nrm = [-A[1], A[0]]
        s = (nx[0] - cur[0]) * A[0] + (nx[1] - cur[1]) * A[1]
        node = None
        if i < k - 1:
            after = P[i + 2]
            along = (after[0] - nx[0]) * A[0] + (after[1] - nx[1]) * A[1]
            across = (after[0] - nx[0]) * nrm[0] + (after[1] - nx[1]) * nrm[1]
            kind = "half" if along < -w / 2 else ("quarter" if abs(across) > w / 2 else "rest")
            sign = 1 if across > 0 else -1
            node = {"kind": kind, "sign": sign, "z": nx[2],
                    "winders": kind == "quarter" and (turn_mode == "winders" or (turn_mode == "auto" and style in ("house", "house_open")))}
        run = s - w / 2 if node else s
        if run < -0.01:
            warnings.append(f"point {i + 2} lies behind flight {i + 1}'s start: that flight is dropped")
        run = max(0.0, run)
        flights.append({"start": list(cur), "axis": A, "run": run, "end": [cur[0] + A[0] * run, cur[1] + A[1] * run]})
        if not node:
            break
        nodes[i + 1] = node
        if node["kind"] == "half":
            after = P[i + 2]
            lane = (after[0] - cur[0]) * nrm[0] + (after[1] - cur[1]) * nrm[1]
            if abs(lane) < w * 0.9:
                warnings.append(f"the half turn's flights lie {abs(lane):.2f} m apart: a stair's width ({w} m) and a well between")
            node["centre"] = [cur[0] + A[0] * s + nrm[0] * lane / 2, cur[1] + A[1] * s + nrm[1] * lane / 2]
            node["size"] = [abs(lane) + w, w]
            node["rot"] = rot_of(A)
            well = 1 if lane > 0 else -1
            cur = [cur[0] + A[0] * (s - w / 2) + nrm[0] * lane, cur[1] + A[1] * (s - w / 2) + nrm[1] * lane]
            A = [-A[0], -A[1]]
        else:
            node["centre"] = [cur[0] + A[0] * s, cur[1] + A[1] * s]
            node["size"] = [w, w]
            node["rot"] = rot_of(A)
            o = ([-A[1], A[0]] if node["sign"] > 0 else [A[1], -A[0]]) if node["kind"] == "quarter" else A
            cur = [node["centre"][0] + o[0] * w / 2, node["centre"][1] + o[1] * w / 2]
            A = o
    winder_turns = sum(1 for nd in nodes.values() if nd["kind"] == "quarter" and nd["winders"])
    Lw = sum(f["run"] for f in flights) + winder_turns * math.pi / 2 * (w / 2)
    live = sum(1 for f in flights if f["run"] > 0.001)
    n = max(max(1, math.ceil(H / RU["riser_max"][style] - 1e-9)), _round((2 * H + Lw) / RU["blondel"]))
    if n - winder_turns * RU["winders"] < live:
        n = winder_turns * RU["winders"] + live
    R = H / n
    items = []
    for i in range(k):
        items.append({"type": "flight", "i": i, "run": flights[i]["run"]})
        nd = nodes.get(i + 1)
        if not nd:
            break
        if nd["z"] is not None:
            items.append({"type": "anchor", "before": _round((nd["z"] - z0) / R), "i": i + 1})
        if nd["kind"] == "quarter" and nd["winders"]:
            items.append({"type": "winders", "i": i + 1})
    count = [0] * k
    done = 0
    start = 0

    def share(lst, budget):
        fl = [it for it in lst if it["type"] == "flight" and it["run"] > 0.001]
        if not fl:
            return
        tot = sum(it["run"] for it in fl)
        left = budget - len(fl)
        if left < 0:
            warnings.append("not enough risers for every flight: a via point's height is too low")
            left = 0
        fr = []
        for it in fl:
            v = left * it["run"] / tot
            fl0 = math.floor(v)
            fr.append({"it": it, "fl0": fl0, "frac": v - fl0})
        rem = left - sum(x["fl0"] for x in fr)
        fr.sort(key=lambda x: (-x["frac"], x["it"]["i"]))
        for x in fr:
            count[x["it"]["i"]] = 1 + x["fl0"] + (1 if rem > 0 else 0)
            if rem > 0:
                rem -= 1

    for i in range(len(items) + 1):
        it = items[i] if i < len(items) else None
        if it and it["type"] != "anchor":
            continue
        stage = items[start:i]
        wind = sum(1 for x in stage if x["type"] == "winders") * RU["winders"]
        budget = (max(done + wind, min(n, it["before"])) if it else n) - done - wind
        share(stage, budget)
        done += wind + sum(count[x["i"]] for x in stage if x["type"] == "flight")
        if it and it["before"] != done:
            warnings.append(f"the landing at point {it['i'] + 1} comes out {z0 + done * R:.2f} m up, not {float(nodes[it['i']]['z']):.2f}")
        start = i + 1
    rail = spec.get("rail") if spec.get("rail") in RAILS else (("left" if well > 0 else "right") if well else RU["rail"][style])
    wall_rail = spec.get("wall_rail") if spec.get("wall_rail") in RAILS else RU["wall_rail"][style]
    z = z0
    pitch = 0.0
    treads = []
    for i in range(k):
        f, ni = flights[i], count[i]
        if f["run"] > 0.001 and ni > 0:
            G = f["run"] / ni
            treads.append(r6(G))
            pitch = max(pitch, math.degrees(math.atan2(R, G)))
            if G < RU["tread_min"][style] - 1e-6:
                warnings.append(f"flight {i + 1}: treads of {math.floor(G * 100 + 0.5)} cm (the {style} rule wants {math.floor(RU['tread_min'][style] * 100 + 0.5)}); a longer run, or a turn with winders")
            parts.append({"kind": "flight", "at": [r6((f["start"][0] + f["end"][0]) / 2), r6((f["start"][1] + f["end"][1]) / 2)], "z": r6(z), "rot": rot_of(f["axis"]),
                          "w": r6(w), "run": r6(f["run"]), "n": ni, "rise": r6(ni * R),
                          "kit": {"preset": RU["preset"][style], "size": [r6(w), r6(f["run"]), r6(ni * R + top)], "top": r6(top), "treads": ni, "landing": 0,
                                  "waist": 0.15 if z - z0 > 0.01 else 0, "rail": rail, "wall_rail": wall_rail, "land_rail": "none"}})
            z += ni * R
        nd = nodes.get(i + 1)
        if not nd:
            break
        if nd["kind"] == "quarter" and nd["winders"]:
            turn = "left" if nd["sign"] > 0 else "right"
            parts.append({"kind": "winder", "at": [r6(nd["centre"][0]), r6(nd["centre"][1])], "z": r6(z), "rot": nd["rot"], "w": r6(w), "n": RU["winders"],
                          "rise": r6(RU["winders"] * R), "turn": turn,
                          "kit": {"preset": RU["winder"][style], "size": [r6(w), r6(w), r6(RU["winders"] * R + top)], "top": r6(top), "n": RU["winders"], "turn": turn}})
            z += RU["winders"] * R
        else:
            solid = z - z0 - RU["slab"] < RU["under"]
            thick = z - z0 if solid else RU["slab"]
            parts.append({"kind": "landing", "at": [r6(nd["centre"][0]), r6(nd["centre"][1])], "z": r6(z - thick), "rot": nd["rot"],
                          "size": [r6(nd["size"][0]), r6(nd["size"][1]), r6(thick)], "turn": nd["kind"],
                          "kit": {"type": "block", "size": [r6(nd["size"][0]), r6(nd["size"][1]), r6(thick)], "slot": RU["slot"][style], "bevel": 0.003, "nosing": 0}})
    if abs(z - z0 - H) > 1e-6:
        warnings.append("the risers don't add up to the rise (a via point's height?)")
    bx0 = by0 = math.inf
    bx1 = by1 = -math.inf
    for p in parts:
        sx, sy = (p["size"][0], p["size"][1]) if p["kind"] == "landing" else (p["w"], p["run"] if p["kind"] == "flight" else p["w"])
        c, sn = math.cos(math.radians(p["rot"])), math.sin(math.radians(p["rot"]))
        for i, j in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            x = p["at"][0] + (i * sx / 2) * c - (j * sy / 2) * sn
            y = p["at"][1] + (i * sx / 2) * sn + (j * sy / 2) * c
            bx0, by0, bx1, by1 = min(bx0, x), min(by0, y), max(bx1, x), max(by1, y)
    out.update({"n": n, "riser": r6(R), "treads": treads, "pitch": r6(pitch), "walk": r6(Lw),
                "bounds": [r6(bx0), r6(by0), r6(z0), r6(bx1), r6(by1), r6(z0 + H + top)] if parts else None})
    return out


def bounds(spec):
    """The box round a stairs prop (room metres: x0, y0, z0, x1, y1, z1), or a small one when it can't be laid out."""
    b = layout(spec).get("bounds")
    return tuple(b) if b else (0.0, 0.0, 0.0, 0.6, 0.6, 1.0)
