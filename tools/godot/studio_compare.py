"""GDSTUDIO: a Character Studio character as the Studio draws it (three.js: its skin and eye shaders, under its own
lights) beside Godot's render of its export (HSSkin and HSEye on the look plugin, GDPEOPLE's stages), pictured side
by side and measured: the skin's colour in both (the face's skin pixels' mean, as ratios red over green and blue over
green, which the lights change least) within a tolerance, the Godot side also against the character's own skin tone.
Needs the Studio's server (port 8793), a card (GPU=1 for the browser), Godot, and the character saved with an export.

    python tools/godot/studio_compare.py [--person NAME] [--keep DIR] [--fresh]

Pictures and the sheet in --keep (default Saved/Story/_look/godot_studio). Ends "GDSTUDIO ok".
"""
import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PEOPLE = ROOT / "Content" / "Studio" / "People"
GODOT_KEEP = ROOT / "Saved" / "Story" / "_look" / "godot_people"
KEEP = ROOT / "Saved" / "Story" / "_look" / "godot_studio"


def skin_mean(path, box):
    """The mean colour of the skin pixels in the box (x0, y0, x1, y1 as fractions): warm, not too dark, not grey."""
    from PIL import Image
    import numpy as np
    im = np.asarray(Image.open(path).convert("RGB")).astype(float)
    h, w = im.shape[:2]
    c = im[int(h * box[1]):int(h * box[3]), int(w * box[0]):int(w * box[2])]
    r, g, b = c[..., 0], c[..., 1], c[..., 2]
    mask = (r > g) & (g >= b - 4) & (r - b > 14) & (r > 60) & ((r + g + b) < 720) & ((r - g) < 110)
    n = int(mask.sum())
    if n < 400:
        return None
    m = c[mask].mean(axis=0)
    return {"rgb": [round(float(v), 1) for v in m], "n": n, "rg": round(float(m[0] / max(m[1], 1)), 3), "bg": round(float(m[2] / max(m[1], 1)), 3)}


def hex_rgb(s):
    s = (s or "").lstrip("#")
    return [int(s[i:i + 2], 16) for i in (0, 2, 4)] if len(s) == 6 else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--person", default="_studiotest")
    ap.add_argument("--keep", default=str(KEEP))
    ap.add_argument("--fresh", action="store_true", help="run GDPEOPLE again for the Godot pictures")
    a = ap.parse_args()
    keep = Path(a.keep)
    keep.mkdir(parents=True, exist_ok=True)
    glb = PEOPLE / a.person / "export" / f"{a.person}.glb"
    if not glb.exists():
        print(f"GDSTUDIO FAIL: no export at {glb} (the Character Studio's Export for desk / Unreal)")
        return 1
    # the Godot side: GDPEOPLE's pictures of this export (made now unless there already and not --fresh)
    rep = GODOT_KEEP / "people.json"
    stale = a.fresh or not rep.exists() or not (GODOT_KEEP / "people_lit.png").exists()
    if not stale:
        try:
            stale = json.loads(rep.read_text(encoding="utf-8")).get("eyes", [None])[0] not in (f"{a.person}_eye_L", f"{a.person}_eye_R")
        except Exception:
            stale = True
    if stale:
        r = subprocess.run([sys.executable, str(ROOT / "tools" / "godot" / "people_check.py"), "--person", a.person], capture_output=True, text=True, timeout=1800)
        if "GDPEOPLE ok" not in r.stdout:
            print(r.stdout[-1500:])
            print("GDSTUDIO FAIL: GDPEOPLE")
            return 1
    # the Studio side: its own pictures of the character
    env = dict(os.environ)
    env.setdefault("GPU", "1")
    r = subprocess.run(["node", str(ROOT / "tools" / "character" / "studioshot.mjs"), "--person", a.person, "--out", str(keep)], capture_output=True, text=True, timeout=900, env=env)
    line = next((l for l in r.stdout.splitlines() if l.startswith("STUDIOSHOT {")), None)
    if not line:
        print((r.stdout + r.stderr)[-1500:])
        print("GDSTUDIO FAIL: no pictures from the Studio (its server on 8793? the character saved?)")
        return 1
    shot = json.loads(line[len("STUDIOSHOT "):])
    tone = hex_rgb((shot.get("who") or {}).get("tone"))
    # the measures: the face's skin in each, as colour ratios
    studio = skin_mean(shot["studio"]["file"], (0.3, 0.2, 0.7, 0.8))
    godot_lit = skin_mean(GODOT_KEEP / "people_lit.png", (0.3, 0.1, 0.7, 0.8))
    godot_flat = skin_mean(GODOT_KEEP / "people_flat.png", (0.3, 0.1, 0.7, 0.8))
    checks = []
    checks.append(("the Studio's own picture has a face of skin in it", bool(studio)))
    checks.append(("Godot's lit picture has one too", bool(godot_lit)))
    if studio and godot_lit:
        d_rg, d_bg = abs(studio["rg"] - godot_lit["rg"]), abs(studio["bg"] - godot_lit["bg"])
        checks.append((f"the skin's colour reads alike in both (red over green {studio['rg']:.2f} Studio, {godot_lit['rg']:.2f} Godot; blue over green {studio['bg']:.2f}, {godot_lit['bg']:.2f}: each within 0.25 under their own lights)", d_rg < 0.25 and d_bg < 0.25))
    if godot_flat and tone:
        trg, tbg = tone[0] / max(tone[1], 1), tone[2] / max(tone[1], 1)
        checks.append((f"flat-lit, Godot's skin keeps the character's own tone #{''.join('%02x' % v for v in tone)} (red over green {godot_flat['rg']:.2f} against {trg:.2f}, blue over green {godot_flat['bg']:.2f} against {tbg:.2f}: within 0.2)", abs(godot_flat["rg"] - trg) < 0.2 and abs(godot_flat["bg"] - tbg) < 0.2))
    # the sheet: the Studio's pictures beside Godot's
    try:
        from PIL import Image, ImageDraw
        cells = [("the Character Studio, its studio light (three.js)", shot["studio"]["file"]), ("Godot: the export lit (HSSkin, HSEye)", GODOT_KEEP / "people_lit.png"),
                 ("the Studio, the reference (film) light", shot.get("reference", {}).get("file")), ("Godot: flat-lit, the paint as it is", GODOT_KEEP / "people_flat.png"),
                 ("Godot: the left eye close (the Studio's eye on the plugin's shader)", GODOT_KEEP / "people_eye_front.png"), ("Godot: sweating", GODOT_KEEP / "people_wet.png")]
        W, H = 560, 360
        sheet = Image.new("RGB", (2 * W, 3 * (H + 22)), (12, 12, 14))
        d = ImageDraw.Draw(sheet)
        for i, (label, f) in enumerate(cells):
            x, y = (i % 2) * W, (i // 2) * (H + 22)
            if f and Path(f).exists():
                im = Image.open(f).convert("RGB")
                k = min(W / im.width, H / im.height)
                im = im.resize((int(im.width * k), int(im.height * k)))
                sheet.paste(im, (x + (W - im.width) // 2, y + 22))
            d.text((x + 6, y + 5), label, fill=(230, 226, 220))
        sheet.save(keep / "compare.jpg", quality=84)
    except Exception as e:  # the sheet is for the eye; the measures are the check
        print(f"  (no sheet: {e})")
    ok = True
    for what, good in checks:
        print(("  ok  " if good else "  BAD ") + what)
        ok = ok and good
    print("  measures: " + json.dumps({"studio": studio, "godot_lit": godot_lit, "godot_flat": godot_flat, "tone": tone}))
    print("  pictures in " + str(keep))
    if not ok:
        print("GDSTUDIO FAIL")
        return 1
    print("GDSTUDIO ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
