#!/usr/bin/env python3
"""Draws the blockout from above without the editor: walls, doors (red when locked), props, lights (yellow),
triggers (dashed), spots and the start (arrows), people (circles). A quick look before importing.

    python tools/plan_view.py [--game Pilot] [level] [out.png]      (needs Pillow: pip install pillow)
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "Content" / "Python"))
from storykit import storylib as L, plan as P  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

PX = 60   # pixels a metre


def main():
    game, args = L.pick_game(sys.argv[1:])
    story, spath = L.load(game)
    level = args[0] if args else next(iter(story["levels"]))
    out = Path(args[1] if len(args) > 1 else L.ROOT / "Saved" / "Story" / spath.parent.name / f"plan_{level}.png")
    pieces = [p for p in P.plan(story, level) if not p["id"].endswith("__volume")]   # room volumes would cover it all
    xs = [p["pos"][0] + s * p["size"][0] / 2 for p in pieces for s in (-1, 1)]
    ys = [p["pos"][1] + s * p["size"][1] / 2 for p in pieces for s in (-1, 1)]
    x0, y0 = min(xs) - 1, min(ys) - 1
    W, H = int((max(xs) + 1 - x0) * PX), int((max(ys) + 1 - y0) * PX)
    img = Image.new("RGB", (W, H), (245, 242, 235))
    dr = ImageDraw.Draw(img)

    def px(x, y):
        return (x - x0) * PX, H - (y - y0) * PX

    def rect(p, fill=None, outline=None, width=1):
        w, d = p["size"][0], p["size"][1]
        cx, cy = p["pos"][0], p["pos"][1]
        corners = []
        for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            dx, dy = P._rot(sx * w / 2, sy * d / 2, p["yaw"])
            corners.append(px(cx + dx, cy + dy))
        dr.polygon(corners, fill=fill, outline=outline, width=width)

    def arrow(p, col):
        x, y = px(*p["pos"][:2])
        a = math.radians(p["yaw"])
        dr.ellipse((x - 5, y - 5, x + 5, y + 5), outline=col, width=2)
        dr.line((x, y, x + math.cos(a) * 20, y - math.sin(a) * 20), fill=col, width=3)

    order = {"floor": 0, "trigger": 1, "mesh": 2, "wall": 3, "door": 4, "person": 5, "light": 6, "spot": 7, "start": 8}
    for p in sorted(pieces, key=lambda p: order.get(p["kind"], 9)):
        k = p["kind"]
        if k == "floor":
            rect(p, fill=(225, 220, 208))
        elif k == "wall":
            rect(p, fill=(40, 40, 40))
        elif k == "door":
            rect(p, fill=(200, 40, 40) if p["d"].get("locked_by") else (150, 100, 50))
        elif k == "mesh":
            col = (90, 140, 200) if "hidden" not in p["tags"] else (190, 200, 215)
            if any(t.startswith("use:") for t in p["tags"]):
                col = (60, 170, 90)
            rect(p, fill=col, outline=(30, 30, 30))
        elif k == "trigger":
            rect(p, outline=(160, 60, 160), width=2)
        elif k == "light":
            x, y = px(*p["pos"][:2])
            dr.ellipse((x - 6, y - 6, x + 6, y + 6), fill=(250, 200, 40), outline=(120, 90, 0))
        elif k == "person":
            x, y = px(*p["pos"][:2])
            dr.ellipse((x - 12, y - 12, x + 12, y + 12), outline=(120, 30, 120), width=3)
        elif k in ("spot", "start"):
            arrow(p, (30, 120, 30) if k == "start" else (100, 100, 100))
    for p in pieces:
        if p["kind"] == "floor":
            x, y = px(p["pos"][0], p["pos"][1] - p["size"][1] / 2 + 0.35)
            dr.text((x - 3 * len(p["room"]), y), p["room"], fill=(70, 70, 70))
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out)
    print(f"PLAN {level}: {len(pieces)} pieces -> {out}")


if __name__ == "__main__":
    main()
