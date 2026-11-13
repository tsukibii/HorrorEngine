# outline.py name ...: each body's outline from the front between the ribs and the knee (alter/meas.mjs's triangles),
# drawn large, and how sharply it turns: the outline's direction every centimetre, and the most it turns within any
# 4 cm (degrees) between the waist and mid thigh (--back: the same for the back's outline seen from the side): a corner reads as a corner from about 25 degrees; a hip that is a
# curve turns less than that anywhere. Also the waist's and the hips' half widths and where they are. lowpoly/out/outline.jpg
import sys, json, os, numpy as np
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); A = os.path.join(HERE, "..", "alter", "out") + "/"; OUT = os.path.join(HERE, "out") + "/"; os.makedirs(OUT, exist_ok=True)
S = 1500; panels = []; BACK = "--back" in sys.argv   # --back: the outline of the back from the side (the seat and the back of the thigh) instead
for name in [a for a in sys.argv[1:] if not a.startswith("--")]:
    t = np.array(json.load(open(A + "sil_" + name + ".json"))).reshape(-1, 3, 3); H = t[:, :, 1].max(); keep = np.abs(t[:, :, 0]).max(1) < 0.3; p = t[keep]
    ys = np.arange(0.36 * H, 0.74 * H, 0.0025); W = []
    for y in ys:
        k = (p[:, :, 1].min(1) < y) & (p[:, :, 1].max(1) > y); xs = []
        for tri in p[k]:                                   # where the triangle's edges cross this height
            for a, b in ((0, 1), (1, 2), (2, 0)):
                if (tri[a, 1] - y) * (tri[b, 1] - y) < 0: f = (y - tri[a, 1]) / (tri[b, 1] - tri[a, 1]); xs.append(-(tri[a, 2] + f * (tri[b, 2] - tri[a, 2])) + 0.1 if BACK else abs(tri[a, 0] + f * (tri[b, 0] - tri[a, 0])))
        W.append(max(xs) if xs else 0)
    W = np.array(W); k = np.ones(9) / 9; Ws = np.convolve(np.pad(W, 4, mode="edge"), k, mode="valid")   # (over 2 cm: the mesh's own facets out)
    wi = np.argmin(np.where((ys > 0.6 * H) & (ys < 0.72 * H), Ws, 9)); hi = np.argmax(np.where((ys > 0.44 * H) & (ys < 0.58 * H), Ws, 0))
    ang = np.degrees(np.arctan2(np.gradient(Ws, ys), 1)); n4 = int(0.04 / 0.0025); lo, top = np.argmin(np.abs(ys - 0.40 * H)), wi
    turn = np.array([abs(ang[i + n4] - ang[i]) for i in range(lo, top - n4)]); at = lo + int(np.argmax(turn))
    print(f"{name:12s} waist {Ws[wi] * 200:5.1f} cm across at {ys[wi] / H:.3f}, hips {Ws[hi] * 200:5.1f} at {ys[hi] / H:.3f}; the outline turns {turn.max():4.1f} deg at the most within 4 cm (at {ys[at + n4 // 2] / H:.3f} of the height), {np.percentile(turn, 90):4.1f} at its 90th percentile; steepest going out {ang[hi:wi].min():5.1f} deg from upright, going in below {ang[lo:hi].max():5.1f}")
    hh = int((ys[-1] - ys[0]) * S) + 30; w = int(0.3 * S); im = Image.new("RGB", (w, hh), (24, 25, 28)); d = ImageDraw.Draw(im)
    pts = [(20 + Ws[i] * S, 15 + (ys[-1] - ys[i]) * S) for i in range(len(ys))]; d.line(pts, fill=(235, 235, 230), width=3); d.line([(20, 15), (20, hh - 15)], fill=(70, 70, 76))
    d.ellipse((pts[at + n4 // 2][0] - 6, pts[at + n4 // 2][1] - 6, pts[at + n4 // 2][0] + 6, pts[at + n4 // 2][1] + 6), outline=(240, 120, 90), width=2); d.text((26, 4), f"{name}: {turn.max():.0f} deg", fill=(230, 200, 120)); panels.append(im)
out = Image.new("RGB", (sum(q.size[0] for q in panels), max(q.size[1] for q in panels)), (24, 25, 28)); x = 0
for q in panels: out.paste(q, (x, 0)); x += q.size[0]
out.save(OUT + ("outline_back.jpg" if BACK else "outline.jpg"), quality=90); print(OUT + ("outline_back.jpg" if BACK else "outline.jpg"), out.size)
