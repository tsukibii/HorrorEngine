"""The cute eye's numbers, fitted (DECISIONS 2026-11-17, cuter eyes; README.md here). The Cute eye shape key
(tools/eye_patch.py `apply`, tools/character/eyegraft.js `placeAll`: the same maths) turns the opening about the eye's
middle (CUTE_TILT) and turns each lid's edge by a profile along the opening (CUTE_UP, CUTE_LO: 17 values each). This
finds those numbers so that the opening, as the graft has it on a body, is the reference's outline
(Content/Studio/Eyes/cute_outline.json): each profile value moved by how far the lid's edge is from the outline there
(as an angle about the eye's x axis), a little smoothing each pass (more by the corners, where a profile that changes
fast creases the skin beside the lid), the tilt moved until the corners' line is the picture's; 60 passes. The pinch and the rise (CUTE_PINCH, CUTE_RISE) are chosen by eye, not fitted.

    python docs/research/cute_eye/fit.py [BODY.bin] [--write] [--picture FILE]

BODY.bin: a character's body as the Studio saves it (Content/Studio/People/<name>/body.bin; a new character's is what
the numbers in the repo were fitted on: the v2female head); none: MHR's base. --write puts the numbers into
tools/eye_patch.py and tools/character/eyegraft.js; --picture draws the opening before and after over the outline.
Then `python tools/eye_patch.py check` (EYEPATCH) holds them.
"""
import re
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "tools")); sys.path.insert(0, str(ROOT / "tools" / "character"))
import eye_patch as EP  # noqa: E402
import mhr  # noqa: E402

args = [a for a in sys.argv[1:] if not a.startswith("--")]
E = EP.read_bin(); M = mhr.load(); P0, T = M["points"], M["tris"]
P = np.frombuffer(Path(args[0]).read_bytes(), dtype=np.float32).reshape(-1, 3).astype(np.float64) if args else P0
side = "L"; g = E[side]; lid, u, sx = EP.fields(E, side); cl = g["ring"] == 0; uc = u[cl]; moving = np.abs(g["blink"][cl]) > 0
KNOTS = 0.5 * (1 - np.cos(np.pi * np.arange(17) / 16))      # where a profile's values stand along the opening (EP._prof)
SMOOTH_AT = np.where((np.arange(17) < 4) | (np.arange(17) > 12), 0.5, 0.06)   # how much each value is drawn toward its neighbours a pass: most by the corners, where the values stand close together (a fast change there is a crease in the skin beside the lid; a quarter of a millimetre of the outline given for it)

v0, c0, _ = EP.apply(E, side, P, P0, T, 0.0, {})
tilt0 = EP.opening(E, side, v0, c0)[2]
EP.CUTE_UP = [0.0] * 17; EP.CUTE_LO = [0.0] * 17
for it in range(60):
    v, c, r = EP.apply(E, side, P, P0, T, 0.0, {"cute": 1.0})
    A, _, tilt, length, _ = EP.opening(E, side, v, c); up, lo, want = EP.cute_target(length)
    q = (v[cl] - c) * 1000
    for sel, target, tab in ((lid[cl] > 0, up, EP.CUTE_UP), (lid[cl] < 0, lo, EP.CUTE_LO)):
        sel = sel & moving; o = np.argsort(uc[sel])
        e = np.interp(A[sel, 0], target[:, 0], target[:, 1]) - A[sel, 1]          # how far the edge is under the outline, mm
        ek = np.interp(KNOTS, uc[sel][o], e[o]); ek[0] = ek[-1] = 0               # (the corners stay: both lids meet there)
        rho = np.interp(KNOTS, uc[sel][o], np.hypot(q[sel][:, 1], q[sel][:, 2])[o])
        cz = np.interp(KNOTS, uc[sel][o], (q[sel][:, 2] / np.hypot(q[sel][:, 1], q[sel][:, 2]))[o])
        t = np.array(tab, float)
        t[1:-1] += 0.7 * np.degrees(ek[1:-1] / (rho[1:-1] * np.maximum(0.35, cz[1:-1])))
        t[1:-1] += SMOOTH_AT[1:-1] * (0.5 * (t[:-2] + t[2:]) - t[1:-1])
        tab[:] = list(t)
    EP.CUTE_TILT += 0.5 * (want - tilt)                      # (the corners are seated on the eyeball again after the turn)
EP.CUTE_TILT = round(float(EP.CUTE_TILT), 2); EP.CUTE_UP = [round(float(t), 2) for t in EP.CUTE_UP]; EP.CUTE_LO = [round(float(t), 2) for t in EP.CUTE_LO]
v, c, r = EP.apply(E, side, P, P0, T, 0.0, {"cute": 1.0}); dt, rms, most, tilt, length = EP.cute_fit(E, side, v, c)
print(f"the opening {length:.2f} mm from corner to corner; without the key its outer corner {tilt0:.2f} deg higher, with it {tilt:.2f} (the picture's {tilt - dt:.2f})")
print(f"its points {rms:.2f} mm from the picture's outline (rms), {most:.2f} at most")
fmt = lambda L: "[" + ", ".join(f"{t:g}" for t in L) + "]"
print(f"CUTE_TILT = {EP.CUTE_TILT:g}\nCUTE_UP = {fmt(EP.CUTE_UP)}\nCUTE_LO = {fmt(EP.CUTE_LO)}")

if "--write" in sys.argv:
    for f, pre, end in ((ROOT / "tools" / "eye_patch.py", "", ""), (ROOT / "tools" / "character" / "eyegraft.js", "export const ", ";")):
        s = f.read_text(encoding="utf-8")
        s = re.sub(rf"{pre}CUTE_TILT = [-\d.]+{end}", f"{pre}CUTE_TILT = {EP.CUTE_TILT:g}{end}", s)
        s = re.sub(rf"{pre}CUTE_UP = \[.*?\]{end}", f"{pre}CUTE_UP = {fmt(EP.CUTE_UP)}{end}", s)
        s = re.sub(rf"{pre}CUTE_LO = \[.*?\]{end}", f"{pre}CUTE_LO = {fmt(EP.CUTE_LO)}{end}", s)
        f.write_text(s, encoding="utf-8"); print("written:", f.relative_to(ROOT))

if "--picture" in sys.argv:
    from PIL import Image, ImageDraw
    K = 30; W, H = 34 * K, 26 * K; im = Image.new("RGB", (W, H), (30, 30, 34)); d = ImageDraw.Draw(im); px = lambda p: (W / 2 + p[0] * K, H / 2 - p[1] * K)
    A, _, tilt, length, _ = EP.opening(E, side, v, c); up, lo, _ = EP.cute_target(length)
    q = (v[cl] - c)[:, :2] * 1000; q[:, 0] *= sx; a, b = q[np.argmin(uc)], q[np.argmax(uc)]; th = np.radians(tilt); R = np.array([[np.cos(th), -np.sin(th)], [np.sin(th), np.cos(th)]])
    for C in (up, lo): d.line([px(p @ R.T + 0.5 * (a + b)) for p in C], fill=(255, 60, 20), width=3)          # the picture's outline
    q0 = (v0[cl] - c0)[:, :2] * 1000; q0[:, 0] *= sx
    for pts, col in ((q0, (90, 90, 110)), (q, (240, 240, 240))):                                                # the opening without the key, and with it
        for p in pts: d.ellipse([px(p)[0] - 2, px(p)[1] - 2, px(p)[0] + 2, px(p)[1] + 2], fill=col)
    for rad, col in ((r * 1000, (70, 110, 70)), (12 * np.sin(np.radians(36)), (110, 80, 60))):                  # the eyeball, and an iris of 36 degrees
        d.ellipse([px((-rad, rad))[0], px((-rad, rad))[1], px((rad, -rad))[0], px((rad, -rad))[1]], outline=col)
    out = sys.argv[sys.argv.index("--picture") + 1]; im.save(out); print("drawn:", out)
