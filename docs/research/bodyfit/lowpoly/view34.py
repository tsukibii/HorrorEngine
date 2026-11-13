# view34.py name ... [--ref] [--yaw 40,145]: each candidate body (alter/meas.mjs's triangles, alter/out/sil_<name>.json)
# seen as the low-poly reference is: from three quarters in front and three quarters behind, from under the bust to
# above the knee, flat shaded; and measured as the reference was: the width across the picture at each height, the
# narrowest (the waist) against the widest (the hips and thighs), and the widths below the widest as the thighs taper.
# --ref: the reference's two halves beside them (Saved/Body/ref/lowpoly.png, kept out of git), scaled so its waist and
# its widest row are at the same heights as the first body's. Writes lowpoly/out/view.jpg.
import sys, json, os, numpy as np
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); A = os.path.join(HERE, "..", "alter", "out") + "/"; OUT = os.path.join(HERE, "out") + "/"; os.makedirs(OUT, exist_ok=True)
args = [a for a in sys.argv[1:] if not a.startswith("--")]; ref = "--ref" in sys.argv
yaws = [float(v) for v in sys.argv[sys.argv.index("--yaw") + 1].split(",")] if "--yaw" in sys.argv else [-55, -150]
REF = os.path.join(HERE, "..", "..", "..", "..", "Saved", "Body", "ref", "lowpoly.png")
# the reference, read once: its two halves' width at each row (the figure against its dark ground)
def ref_profile():
    im = np.asarray(Image.open(REF).convert("RGB")).astype(float); g = im.mean(2); m = g > np.median(g[:20, :20]) + 35; out = []
    for x0, x1 in ((0, 295), (300, 599)):
        sub = m[:, x0:x1]; rows = [y for y in range(sub.shape[0]) if sub[y].sum() > 10]; w = {y: np.where(sub[y])[0].max() - np.where(sub[y])[0].min() for y in rows}
        ys = sorted(w); mid = [y for y in ys if ys[0] + 60 < y < ys[-1] - 150]; yw = min(mid, key=lambda y: w[y]); yh = max([y for y in ys if y > yw], key=lambda y: w[y])
        out.append(dict(x0=x0, x1=x1, top=ys[0], bot=ys[-1], yw=yw, yh=yh, w=w))
    return out
def profile(t, yaw):
    c, s = np.cos(np.radians(yaw)), np.sin(np.radians(yaw)); keep = np.abs(t[:, :, 0]).max(1) < 0.3; p = t[keep]
    x = p[:, :, 0] * c + p[:, :, 2] * s; z = -p[:, :, 0] * s + p[:, :, 2] * c; return p, x, z
def widths(p, x, lo, hi, step=0.005):
    ys = np.arange(lo, hi, step); W = []
    for y in ys:
        k = (p[:, :, 1].min(1) < y + step) & (p[:, :, 1].max(1) > y - step); W.append(x[k].max() - x[k].min() if k.any() else 0)
    return ys, np.array(W)
S = 900; panels = []; first = None; R = ref_profile() if ref and os.path.exists(REF) else None
for name in args:
    t = np.array(json.load(open(A + "sil_" + name + ".json"))).reshape(-1, 3, 3); H = t[:, :, 1].max()
    for vi, yaw in enumerate(yaws):
        p, x, z = profile(t, yaw); ys, W = widths(p, x, 0.30 * H, 0.80 * H)
        hi = np.argmax(np.where((ys > 0.44 * H) & (ys < 0.58 * H), W, 0)); wi = np.argmin(np.where((ys > ys[hi] + 0.06) & (ys < 0.72 * H), W, 9)); d = ys[wi] - ys[hi]
        below = [W[np.argmin(np.abs(ys - (ys[hi] - f * d)))] for f in (0.36, 0.64, 0.93)]
        print(f"{name:12s} yaw {yaw:5.0f}: waist {W[wi] * 100:5.1f} cm at {ys[wi] / H:.3f}, widest {W[hi] * 100:5.1f} at {ys[hi] / H:.3f}: waist/widest {W[wi] / W[hi]:.2f}; below the widest by 0.36, 0.64, 0.93 of that span: {', '.join(f'{b / W[hi]:.2f}' for b in below)} of it")
        top, bot = 0.775 * H, 0.33 * H; hh = int((top - bot) * S) + 24; w = int(0.5 * S); yW, yH = 0.655 * H, (0.49 if vi == 0 else 0.525) * H   # (the same crop and heights for every body: the waist, and the widest row: the thighs' top from in front, the seat from behind)
        im = Image.new("RGB", (w, hh), (52, 52, 54)); dr = ImageDraw.Draw(im); n = np.cross(p[:, 1] - p[:, 0], p[:, 2] - p[:, 0]); n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
        c, s = np.cos(np.radians(yaw)), np.sin(np.radians(yaw)); nz = -n[:, 0] * s + n[:, 2] * c; nx = n[:, 0] * c + n[:, 2] * s; light = np.clip(0.35 * nx + 0.3 * n[:, 1] + 0.85 * nz, 0, 1)
        cx = (x.max() + x.min()) / 2
        for i in np.argsort(z.mean(1)):
            if nz[i] < 0 or p[i, :, 1].min() > top or p[i, :, 1].max() < bot: continue
            g = int(70 + 150 * light[i]); dr.polygon([(w / 2 + (x[i, k] - cx) * S, 12 + (top - p[i, k, 1]) * S) for k in range(3)], fill=(g, g, g))
        dr.text((6, 4), f"{name}  {yaw:.0f} deg", fill=(230, 200, 120)); panels.append(im)
        if R and first is None: first = (top, bot, ys[wi], ys[hi])
        if R and name == args[0]:
            r = R[vi]; k = (r["yh"] - r["yw"]) / ((yW - yH) * S); src = Image.open(REF).convert("RGB").crop((r["x0"], 0, r["x1"], 421)); rs = src.resize((int(src.width / k), int(src.height / k)), Image.LANCZOS)
            pim = Image.new("RGB", (w, hh), (52, 52, 54)); pim.paste(rs, (int(w / 2 - rs.width / 2), int(12 + (top - yW) * S - r["yw"] / k))); ImageDraw.Draw(pim).text((6, 4), "the reference", fill=(230, 200, 120)); panels.append(pim)
            rw = r["w"]; print(f"{'reference':12s} view {vi}: waist/widest {rw[r['yw']] / rw[r['yh']]:.2f}; below the widest by 0.36, 0.64, 0.93 of that span: {', '.join(f'''{rw[min(rw, key=lambda y: abs(y - (r['yh'] + f * (r['yh'] - r['yw']))))] / rw[r['yh']]:.2f}''' for f in (0.36, 0.64, 0.93))}; its waist {rw[r['yw']] / (r['yh'] - r['yw']) * (yW - yH) * 100:.1f} cm and widest {rw[r['yh']] / (r['yh'] - r['yw']) * (yW - yH) * 100:.1f} cm at this body's span")
hh = max(p.size[1] for p in panels); out = Image.new("RGB", (sum(p.size[0] for p in panels), hh), (30, 30, 32)); x0 = 0
for p in panels: out.paste(p, (x0, 0)); x0 += p.size[0]
out.save(OUT + "view.jpg", quality=90); print(OUT + "view.jpg", out.size)
