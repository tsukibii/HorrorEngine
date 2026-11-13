# compare.py OURS_DIR [tag] [--out sheet.jpg]: the Studio's open mouth laid over the picture's (DECISIONS 2026-11-13, better
# mouths: the test the user set). The picture's lips are MediaPipe's points on it (out/d3.json: headfit/lm.py); ours are
# where the Studio says its own lips' points and its opening's outline are (tools/character/mouthshots.mjs). Ours is
# turned, sized and moved onto the picture by the lips' twenty outer points (a similarity: nothing is stretched), then:
# the opening's two outlines one over the other and how much they share, how much of each opening is teeth, tongue
# and dark, and whether the teeth and the tongue are in the same places. A sheet: hers, ours, half and half, the lines.
import sys, json, os
import numpy as np
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, "..", "..", "..")
args = sys.argv[1:]; D = args[0]; tag = args[1] if len(args) > 1 and not args[1].startswith("--") else ""
out = args[args.index("--out") + 1] if "--out" in args else os.path.join(D, f"compare{tag}.jpg")
OUTER = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185]
INNER = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191]
ref = json.load(open(os.path.join(HERE, "out", "d3.json"))); P = np.array(ref["pts"])[:, :2]
ro, ri = P[OUTER], P[INNER]; x0, y0 = ro.min(0); x1, y1 = ro.max(0); w = x1 - x0; pad = 0.3 * w
box = [x0 - 0.22 * w, y0 - 0.2 * w, x1 + 0.22 * w, y1 + 0.2 * w]; S = 640 / (box[2] - box[0])
im = Image.open(ref["file"]).convert("RGB"); W, H = round((box[2] - box[0]) * S), round((box[3] - box[1]) * S)
hers = im.transform((W, H), Image.AFFINE, (1 / S, 0, box[0], 0, 1 / S, box[1]), Image.BICUBIC)
to = lambda q: (np.asarray(q, float) - [box[0], box[1]]) * S
ro, ri = to(ro), to(ri)
me = json.load(open(os.path.join(D, f"mouth{tag}.json")))["mouth"]; mo, mr = np.array(me["outer"], float), np.array(me["ring"], float)
# ours -> hers: z -> a z + b over the outer ring (complex least squares)
za, zb = mo[:, 0] + 1j * mo[:, 1], ro[:, 0] + 1j * ro[:, 1]; ma, mb = za.mean(), zb.mean(); a = ((zb - mb) * np.conj(za - ma)).sum() / (abs(za - ma) ** 2).sum(); b = mb - a * ma
f = lambda q: (lambda z: np.stack([z.real, z.imag], 1))(a * (q[:, 0] + 1j * q[:, 1]) + b)
ours_o, ours_r = f(mo), f(mr); ia = 1 / a; ib = -b / a                                   # hers -> ours, for the warp
mine = Image.open(os.path.join(D, f"mouth{tag}.png")).convert("RGB").transform((W, H), Image.AFFINE, (ia.real, -ia.imag, ib.real, ia.imag, ia.real, ib.imag), Image.BICUBIC)
def mask(poly):
    m = Image.new("L", (W, H), 0); ImageDraw.Draw(m).polygon([tuple(p) for p in poly], fill=255); return np.asarray(m) > 0
Mh, Mo = mask(ri), mask(ours_r)
iou = lambda A, B: (A & B).sum() / max(1, (A | B).sum())
def parts(img, M):
    a = np.asarray(img.convert("HSV"), float) / 255; rgb = np.asarray(img, float) / 255; v, s = a[..., 2], a[..., 1]
    ref_v = np.percentile(v[M], 97) if M.any() else 1
    teeth = M & (v > 0.5 * ref_v) & (s < 0.24)                                      # teeth: pale and hardly coloured (ours are greyer under the Studio's lamp than hers under her fill: by how little colour, not how bright)
    dark = M & (v < 0.33 * ref_v) & ~teeth
    tongue = M & ~teeth & ~dark
    return teeth, tongue, dark
Th, Gh, Dh = parts(hers, Mh); To, Go, Do = parts(mine, Mo)
span = lambda q: (q[:, 0].max() - q[:, 0].min(), q[:, 1].max() - q[:, 1].min())
pxmm = me["mm"] * abs(a)                                                                 # the picture's pixels a millimetre of our head
rms = float(np.sqrt(((ours_o - ro) ** 2).sum(1).mean())) / pxmm
sh, so = span(ri), span(ours_r)
rowsT = lambda T, M: (lambda ys: (ys.min(), ys.max()) if len(ys) else (0, 0))(np.where(T.any(1))[0])
print(f"the lips' outer points: ours on hers within {rms:.1f} mm (rms; {pxmm:.1f} of the picture's pixels a millimetre of our head)")
print(f"the opening: hers {sh[0] / pxmm:.1f} x {sh[1] / pxmm:.1f} mm, ours {so[0] / pxmm:.1f} x {so[1] / pxmm:.1f}; the two outlines share {iou(Mh, Mo):.2f} of what they cover together")
pct = lambda T, M: 100 * T.sum() / max(1, M.sum())
print(f"of the opening, hers: teeth {pct(Th, Mh):.0f}%, tongue {pct(Gh, Mh):.0f}%, dark {pct(Dh, Mh):.0f}%; ours: teeth {pct(To, Mo):.0f}%, tongue {pct(Go, Mo):.0f}%, dark {pct(Do, Mo):.0f}%")
print(f"in the same places: the teeth share {iou(Th, To):.2f}, the tongue {iou(Gh, Go):.2f}")
def bandmm(T):
    cols = np.where(T.any(0))[0]
    if not len(cols): return 0, 0
    mid = T[:, int(np.median(cols)) - 6:int(np.median(cols)) + 7]; ys = np.where(mid.any(1))[0]; top = ys[ys < ys.min() + (ys.max() - ys.min()) * 0.6] if len(ys) else ys
    return (cols.max() - cols.min()) / pxmm, (len(set(top)) / pxmm if len(top) else 0)
bh, bo = bandmm(Th), bandmm(To)
print(f"the teeth across: hers {bh[0]:.1f} mm, ours {bo[0]:.1f}; the upper teeth showing in the middle: hers {bh[1]:.1f} mm, ours {bo[1]:.1f}")
mean = lambda img, T: tuple(int(c) for c in np.asarray(img)[T].mean(0)) if T.any() else (0, 0, 0)
print(f"colours (lit, the picture's light is pink neon): her teeth {mean(hers, Th)}, ours {mean(mine, To)}; her tongue {mean(hers, Gh)}, ours {mean(mine, Go)}")
# the sheet
blend = Image.blend(hers, mine, 0.5); lines = hers.copy(); d = ImageDraw.Draw(lines)
d.line([tuple(p) for p in ri] + [tuple(ri[0])], fill=(60, 255, 120), width=2); d.line([tuple(p) for p in ours_r] + [tuple(ours_r[0])], fill=(255, 60, 60), width=2)
d.line([tuple(p) for p in ro] + [tuple(ro[0])], fill=(60, 200, 255), width=1); d.line([tuple(p) for p in ours_o] + [tuple(ours_o[0])], fill=(255, 200, 60), width=1)
def paint(img, T, G, Dk):
    a = np.asarray(img).copy(); a[T] = (0.4 * a[T] + 0.6 * np.array([255, 255, 255])).astype(np.uint8); a[G] = (0.5 * a[G] + 0.5 * np.array([255, 80, 140])).astype(np.uint8); a[Dk] = (0.5 * a[Dk] + 0.5 * np.array([40, 40, 160])).astype(np.uint8); return Image.fromarray(a)
cells = [hers, mine, blend, lines, paint(hers, Th, Gh, Dh), paint(mine, To, Go, Do)]
sheet = Image.new("RGB", (W * 3 + 16, H * 2 + 8), (16, 17, 20))
for k, c in enumerate(cells): sheet.paste(c, ((k % 3) * (W + 8), (k // 3) * (H + 8)))
sheet.save(out, quality=90); print(out, sheet.size)
