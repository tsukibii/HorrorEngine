#!/usr/bin/env python3
"""Reviews the shots the editor took (storykit.shots): checks the measured rules of docs/STORY_FORMAT.md §8
and makes one contact sheet per chapter (4 across, labelled, failures framed in red).

    python tools/shots_sheet.py [--game Pilot]          after `storykit.shots.take("Pilot")` in the editor
    python tools/shots_sheet.py [--game Pilot] --plan   no pictures yet: only the rules that need none (1, 2, 5)

Writes Saved/Story/<Game>/Shots/<owner>.png (one sheet per stitch, scene and level) and review.json; ends `SHOTS ok` or `SHOTS FAILED (n)`. Read review.json
first; open a sheet only for what failed or was flagged.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "Content" / "Python"))
from storykit import storylib as L, plan as P, shotlib as S  # noqa: E402

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

OUT = None   # Saved/Story/<Game>/Shots, set in main


def eye_inside(eye, pieces, through=()):
    for p in pieces:
        if p["kind"] not in ("wall", "mesh", "door", "floor", "ceiling") or p["id"] in through:
            continue
        w, d, h = p["size"]
        r = max(w, d) / 2 if p["yaw"] % 90 else None
        hw, hd = (r, r) if r else ((w / 2, d / 2) if p["yaw"] % 180 == 0 else (d / 2, w / 2))
        x, y, z = p["pos"]
        m = 0.15
        if x - hw - m < eye[0] < x + hw + m and y - hd - m < eye[1] < y + hd + m and z - h / 2 - m < eye[2] < z + h / 2 + m:
            return p["id"]
    return None


def brightness(img, box):
    from PIL import ImageStat
    g = img.convert("L")
    W, H = g.size
    frame = ImageStat.Stat(g).mean[0] / 255
    if not box:
        return frame, None
    u0, v0, u1, v1 = (max(0.0, min(1.0, x)) for x in box)
    if u1 - u0 < 0.005 or v1 - v0 < 0.005:
        return frame, 0.0
    crop = g.crop((int(u0 * W), int(v0 * H), max(int(u0 * W) + 1, int(u1 * W)), max(int(v0 * H) + 1, int(v1 * H))))
    return frame, ImageStat.Stat(crop).mean[0] / 255


def review(shots, pieces, with_images):
    from PIL import Image
    for s in shots:
        fails, flags = [], []
        inside = eye_inside(s["eye"], pieces, s.get("through") or ())
        if inside:
            fails.append(f"rule 1: the camera is inside or within 15 cm of {inside}")
        if s["in_frame"] < 0.7:
            fails.append(f"rule 2: only {s['in_frame']:.0%} of {s['target']} is in frame")
        if s.get("closeup") and abs(s.get("eyes_v", 0.333) - 1 / 3) > 0.05:
            fails.append(f"rule 2: the eyes sit at {s['eyes_v']:.2f} of the height, not on the upper third")
        if s.get("visible_rays") is not None and s["visible_rays"] < 6:
            fails.append(f"rule 3: only {s['visible_rays']}/9 rays reach {s['target']}: something is in the way")
        shot = s.get("shot")                  # first person: the size is the subject's distance from the eye
        band = L.SHOT_BAND.get(shot) if shot else None
        if band and s.get("dist") is not None and not band[0] <= s["dist"] < band[1]:
            flags.append(f"a {shot.upper()} wants the face {band[0]}-{band[1] if band[1] < 100 else 'any'} m from the player's eye; "
                         f"here {s['dist']:.2f} m frames as {s['real'].upper()}: bring them in (or out), lean (push), or relabel")
        p_ = S.angles(s["eye"], s["aim"])[1] if s.get("aim") else 0
        if abs(p_) > L.PITCH:
            fails.append(f"rule 1: looking {'up' if p_ > 0 else 'down'} {abs(p_):.0f} degrees: past the player's neck")
        sc = s.get("screen")
        if sc and s["kind"] != "room" and (min(sc[2], 1) - max(sc[0], 0)) * (min(sc[3], 1) - max(sc[1], 0)) < 0.002:
            flags.append(f"{s['target']} is tiny on screen: a bigger prop, a light on it, or a closer look")
        if s["people"]:
            fails.append(f"rule 5: stand-in {', '.join(s['people'])} on screen within 3 m")
        if with_images and s.get("file") and (OUT / s["file"]).exists():
            img = Image.open(OUT / s["file"])
            frame, subj = brightness(img, s.get("screen"))
            s["frame_luma"], s["subject_luma"] = round(frame, 3), None if subj is None else round(subj, 3)
            if subj is not None and s["kind"] != "room" and not (subj >= 0.08 or subj >= frame * 1.6):
                fails.append(f"rule 4: {s['target']} is too dark to read ({subj:.2f}, frame {frame:.2f}): light it")
            if s["kind"] == "room" and frame < 0.03:
                flags.append("the room's entrance shot is nearly black: is there a light leading the eye?")
        elif with_images:
            flags.append("no picture for this shot")
        s["fails"], s["flags"] = fails, flags
    return shots


def sheets(shots):
    from PIL import Image, ImageDraw
    by = {}
    for s in shots:
        by.setdefault(s["owner"], []).append(s)
    tw, th, cols = 320, 180, 4
    for ch, ss in by.items():
        rows = (len(ss) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * tw, rows * (th + 18)), (20, 20, 20))
        dr = ImageDraw.Draw(sheet)
        for i, s in enumerate(ss):
            x, y = (i % cols) * tw, (i // cols) * (th + 18)
            f = OUT / s.get("file", "")
            if s.get("file") and f.exists():
                sheet.paste(Image.open(f).convert("RGB").resize((tw, th)), (x, y))
            if s.get("screen"):
                u0, v0, u1, v1 = (max(0.0, min(1.0, q)) for q in s["screen"])
                dr.rectangle((x + u0 * tw, y + v0 * th, x + u1 * tw, y + v1 * th), outline=(80, 200, 255))
            col = (230, 60, 60) if s["fails"] else ((230, 180, 40) if s["flags"] else (120, 200, 120))
            dr.rectangle((x, y, x + tw - 1, y + th - 1), outline=col, width=3 if s["fails"] else 1)
            dr.text((x + 4, y + th + 3), f"{s['id']} {s['kind']} -> {s['target']}", fill=col)
        sheet.save(OUT / f"{ch}.png")


def main():
    global OUT
    game, args = L.pick_game(sys.argv[1:])
    plan_only = "--plan" in args
    story, spath = L.load(game)
    OUT = L.ROOT / "Saved" / "Story" / spath.parent.name / "Shots"
    pieces = P.plan(story)
    if plan_only or not (OUT / "shots.json").exists():
        shots = S.shot_list(story)
        if not plan_only:
            print(f"no {OUT / 'shots.json'} yet: checking the plan only (run storykit.shots.take() in the editor)")
        plan_only = True
    else:
        shots = json.loads((OUT / "shots.json").read_text(encoding="utf-8"))
    shots = review(shots, pieces, not plan_only)
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "review.json").write_text(json.dumps([{k: s[k] for k in ("id", "kind", "target", "fails", "flags")}
                                                 for s in shots], indent=1), encoding="utf-8")
    if not plan_only:
        sheets(shots)
    n = 0
    for s in shots:
        for f in s["fails"]:
            print(f"FAIL {s['owner']}/{s['id']}: {f}")
            n += 1
        for f in s["flags"]:
            print(f"flag {s['owner']}/{s['id']}: {f}")
    print(f"SHOTS FAILED ({n})" if n else f"SHOTS ok ({len(shots)} shots{', plan only' if plan_only else ''})")
    sys.exit(1 if n else 0)


if __name__ == "__main__":
    main()
