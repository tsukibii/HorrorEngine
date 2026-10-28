#!/usr/bin/env python3
"""The offline level check, from the same plan the importer spawns (no editor needed).

    python tools/level_check.py [--game Pilot] [level]

Fails on: props overlapping (more than 2 cm, unless one is `on` the other), props or people in walls, props
outside their room, doorways blocked (0.8 m each side of every walk-through opening), interactables with no
standing room (no free 0.5 m square on the floor within reach, 1.2 m). Ends `LEVEL ok` or `LEVEL FAILED (n)`.
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "Content" / "Python"))
from storykit import storylib as L, plan as P  # noqa: E402

TOL = 0.02
CLEAR = 0.8
REACH = 1.2


def aabb(p):
    """World box (x0, y0, z0, x1, y1, z1) round a piece, rotation included (a bit generous when rotated)."""
    w, d, h = p["size"]
    xs, ys = [], []
    for sx in (-1, 1):
        for sy in (-1, 1):
            dx, dy = P._rot(sx * w / 2, sy * d / 2, p["yaw"])
            xs.append(p["pos"][0] + dx)
            ys.append(p["pos"][1] + dy)
    zc = p["pos"][2] + (h / 2 if p["kind"] == "person" else 0.0)   # people stand on pos; meshes are centred
    return (min(xs), min(ys), zc - h / 2, max(xs), max(ys), zc + h / 2)


def overlap(a, b):
    return min(min(a[i + 3], b[i + 3]) - max(a[i], b[i]) for i in range(3))


def main():
    game, args = L.pick_game(sys.argv[1:])
    story, _ = L.load(game)
    errs, pieces = check(story, args[0] if args else None)
    for e in errs:
        print("ERROR:", e)
    if errs:
        print(f"LEVEL FAILED ({len(errs)})")
        sys.exit(1)
    print(f"LEVEL ok ({len(pieces)} pieces)")


def check(story, level=None):
    """The level rules on a story (the desk's scene builder calls it on an unsaved one): (errors, pieces)."""
    pieces = P.plan(story, level)
    errs = []
    solid = [p for p in pieces if p["kind"] in ("mesh", "person")]
    walls = [p for p in pieces if p["kind"] == "wall"]
    rooms = {r["id"]: r for lv in story["levels"].values() for r in lv["rooms"]}
    level_of = {r["id"]: name for name, lv in story["levels"].items() for r in lv["rooms"]}

    def stacked(a, b):
        return f"on:{b['id']}" in a["tags"] or f"on:{a['id']}" in b["tags"]

    # a kit floor, rug or ceiling step is walked over or under, not bumped (surface); a window frame sits in its wall
    flat = lambda q: "surface" in q["tags"] or any(t.startswith("door_part:") for t in q["tags"])   # a door's own parts
    for i, a in enumerate(solid):
        ba = aabb(a)
        for b in solid[i + 1:]:
            if flat(a) or flat(b):
                continue
            if a["room"] == b["room"] and not stacked(a, b) and a["id"].split("__")[0] != b["id"].split("__")[0]:
                o = overlap(ba, aabb(b))
                if o > TOL:
                    errs.append(f"{a['id']} and {b['id']} overlap by {o * 100:.0f} cm")
        if any(t.startswith("door_part:") for t in a["tags"]):   # a door's frame and handle belong to its doorway
            continue
        for w in ([] if "in_wall" in a["tags"] else walls):
            if w.get("level") != a.get("level"):           # each level is its own map: another one's walls aren't here
                continue
            o = overlap(ba, aabb(w))
            if o > TOL:
                errs.append(f"{a['id']} is {o * 100:.0f} cm into a wall of {w['room']}")
        r = rooms[a["room"]]
        x0, y0, z0 = r["at"]
        if any(t == "trim:threshold" or t == "in_wall" for t in a["tags"]):     # across a doorway, or in a wall
            continue
        if ba[0] < x0 - TOL or ba[1] < y0 - TOL or ba[3] > x0 + r["size"][0] + TOL or ba[4] > y0 + r["size"][1] + TOL:
            errs.append(f"{a['id']} pokes out of {a['room']}")
        if ba[5] > z0 + r["size"][2] + TOL:
            errs.append(f"{a['id']} goes through the ceiling of {a['room']}")

    # doorways: a box CLEAR deep on each side of every opening tall enough to walk through
    for r in rooms.values():
        if level is not None and level_of[r["id"]] != level:
            continue
        for op in r.get("openings", []):
            if op.get("sill", 0) > 0.3 or op["h"] < 1.8:
                continue
            x, y = L.wall_point(r, op["wall"], op["at"])
            wx, wy, wz = L.room_world(r, x, y)
            along_x = op["wall"] in ("n", "s")
            hw = op["w"] / 2
            zone = (wx - (hw if along_x else CLEAR), wy - (CLEAR if along_x else hw), wz + 0.05,
                    wx + (hw if along_x else CLEAR), wy + (CLEAR if along_x else hw), wz + 1.8)
            for s in solid:
                if "hidden" in s["tags"] or "in_wall" in s["tags"] or any(t.startswith("door_part:") for t in s["tags"]) or s.get("level", level_of[r["id"]]) != level_of[r["id"]]:
                    continue
                o = overlap(zone, aabb(s))
                if o > TOL:
                    name = op.get("door", {}).get("id") or f"{r['id']} {op['wall']} opening"
                    errs.append(f"{s['id']} blocks {name} ({o * 100:.0f} cm into the {CLEAR} m clearance)")

    # standing room by each interactable: a free 0.5 m square on the floor within REACH
    for t in solid:
        if not any(tag.startswith("use:") for tag in t["tags"]):
            continue
        r = rooms[t["room"]]
        x0, y0, z0 = r["at"]
        ok = False
        for k in range(16):
            a = math.radians(k * 22.5)
            for dist in (0.6, 0.9, REACH):
                cx, cy = t["pos"][0] + math.cos(a) * dist, t["pos"][1] + math.sin(a) * dist
                sq = (cx - 0.25, cy - 0.25, z0 + 0.05, cx + 0.25, cy + 0.25, z0 + 1.7)
                if sq[0] < x0 + 0.05 or sq[1] < y0 + 0.05 or sq[3] > x0 + r["size"][0] - 0.05 or sq[4] > y0 + r["size"][1] - 0.05:
                    continue
                if all(overlap(sq, aabb(s)) <= TOL for s in solid if "hidden" not in s["tags"]):
                    ok = True
                    break
            if ok:
                break
        if not ok:
            errs.append(f"{t['id']}: nowhere to stand within {REACH} m")

    return errs, pieces


if __name__ == "__main__":
    main()
