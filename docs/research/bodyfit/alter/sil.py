# sil.py name ...: each body's front and side as shaded silhouettes side by side (a quick look at the build)
import sys, json, numpy as np
from PIL import Image, ImageDraw
import os; H = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out") + "/"; os.makedirs(H, exist_ok=True)
S = 330; hh = int(1.7 * S); panels = []
for name in sys.argv[1:]:
    t = np.array(json.load(open(H + "sil_" + name + ".json"))).reshape(-1, 3, 3)
    n = np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0]); n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
    for view in (0, 1):
        w = int((0.62 if view == 0 else 0.42) * S); im = Image.new("RGB", (w, hh), (24, 25, 28)); d = ImageDraw.Draw(im)
        ax = 0 if view == 0 else 2; depth = t[:, :, 2 if view == 0 else 0].mean(1) * (1 if view == 0 else 1); order = np.argsort(depth)
        light = np.clip(n @ (np.array([0.3, 0.3, 0.9]) if view == 0 else np.array([0.9, 0.3, 0.3])), 0, 1)
        for i in order:
            if abs(t[i, :, 0]).max() > (0.3 if view == 0 else 0.21): continue
            if (n[i, 2] if view == 0 else n[i, 0]) < 0: continue
            c = int(60 + 170 * light[i]); d.polygon([(w / 2 + (p[ax] if view == 0 else -p[ax]) * S, hh - 12 - p[1] * S) for p in t[i]], fill=(c, c, int(c * 0.97)))
        ImageDraw.Draw(im).text((6, 4), name if view == 0 else "", fill=(230, 200, 120)); panels.append(im)
out = Image.new("RGB", (sum(p.size[0] for p in panels), hh)); x = 0
for p in panels: out.paste(p, (x, 0)); x += p.size[0]
out.save(H + "sil.jpg", quality=90); print(H + "sil.jpg", out.size)
