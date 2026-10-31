"""The street's decals (docs/STREET_PAINT.md): what's laid on a surface by hand in the paint page, made from code here
as pictures with their alpha (no downloads): rain streaks and damp, rust bleeding from a fitting, cracks, moss at a
wall's foot, salt bloom, soot over a vent, posters new and torn, stickers, a sprayed tag; on the ground oil, a puddle,
tyre marks, gum, worn paint, fallen leaves, litter, a manhole cover, a drain grate.

    python tools/street.py decals [--force]      -> assets/decals/<kind>.png and assets/decals/decals.json

Plain Python (numpy, Pillow). Each decal has its real size (metres), where it goes (a wall, the ground, anywhere), and
how it shines (a puddle's wet, an oil stain's sheen, a manhole's iron). The pictures are made again when this file
changes (decals.json keeps the time it was made from)."""
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "assets" / "decals"
FONTS = ["/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf", "/usr/share/fonts/truetype/fonts-japanese-gothic.ttf",
         "/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc", "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
         "/usr/share/fonts/noto/NotoSansCJK-Regular.ttc", "/usr/share/fonts/TTF/ipag.ttf"]


def hexc(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float32) / 255


def noise(shape, scale, rng, octaves=4, rough=0.5):
    """Fractal value noise in 0..1 (each octave a random grid smoothly enlarged)."""
    h, w = shape
    out = np.zeros(shape, np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        gh, gw = max(2, int(h / scale * 2 ** o)), max(2, int(w / scale * 2 ** o))
        g = Image.fromarray((rng.random((gh, gw)) * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
        out += amp * np.asarray(g, np.float32) / 255
        tot += amp
        amp *= rough
    return out / tot


def soft(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def blob(shape, rng, fill=0.55, scale=None, edge=0.08):
    """A ragged blob filling about `fill` of the picture, soft at its edge."""
    h, w = shape
    yy, xx = np.mgrid[0:h, 0:w]
    r = np.hypot((xx - w / 2) / (w / 2), (yy - h / 2) / (h / 2))
    n = noise(shape, scale or min(h, w) / 3, rng, 5, 0.55)
    v = (1 - r) + (n - 0.5) * 0.9
    return soft(v, 1 - fill - edge, 1 - fill + edge)


def rgba(col, a):
    """Colour (h, w, 3 or 3,) and alpha (h, w) to an RGBA picture."""
    a = np.clip(a, 0, 1)
    c = np.broadcast_to(col, a.shape + (3,)) if np.ndim(col) == 1 else col
    return np.dstack([np.clip(c, 0, 1), a])


def tint_noise(col, shape, rng, amt=0.12, scale=40):
    n = noise(shape, scale, rng, 4)
    return hexc(col)[None, None, :] * (1 - amt + 2 * amt * n[..., None])


# ---- on walls -----------------------------------------------------------------------------------------------------

def streaks(rng, size, col="#2f2b26", strength=0.55, top=0.0, spread=1.0):
    h, w = size
    a = np.zeros(size, np.float32)
    n = int(w * 0.18 * spread)
    for _ in range(n):
        x = rng.integers(0, w)
        y0 = int(top * h + rng.random() * h * 0.08)
        L = int(h * (0.25 + 0.75 * rng.random() ** 1.5))
        wid = rng.integers(1, 4)
        f = np.linspace(1, 0, max(1, L)) ** (0.6 + rng.random())
        y1 = min(h, y0 + L)
        a[y0:y1, max(0, x - wid):x + wid] = np.maximum(a[y0:y1, max(0, x - wid):x + wid], (f[:y1 - y0] * (0.4 + 0.6 * rng.random()))[:, None])
    a = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.6)), np.float32) / 255
    a *= 0.6 + 0.4 * noise(size, w / 6, rng, 3)
    edge = soft(np.minimum(np.arange(w)[None, :], w - 1 - np.arange(w)[None, :]) / (w * 0.08), 0, 1)
    return rgba(tint_noise(col, size, rng, 0.1), a * strength * edge)


def d_rain(rng):
    return streaks(rng, (512, 384), "#2d2924", 0.6)


def d_rust(rng):
    h, w = 512, 224
    a = streaks(rng, (h, w), "#6b3a1c", 0.75, spread=1.6)
    xx = np.arange(w)[None, :]
    a[..., 3] *= np.exp(-((xx - w / 2) / (w * 0.22)) ** 2)            # from the fitting's middle
    return a


def d_damp(rng):
    s = (384, 448)
    a = blob(s, rng, 0.62) * (0.35 + 0.35 * noise(s, 60, rng, 4))
    yy = np.linspace(0, 1, s[0])[:, None]
    a *= 0.6 + 0.4 * yy                                               # darker low down, where it's wettest
    return rgba(tint_noise("#3a342c", s, rng, 0.08), a)


def d_efflorescence(rng):
    a = streaks(rng, (512, 384), "#e9e5dc", 0.5)
    return a


def d_soot(rng):
    s = (448, 320)
    h, w = s
    yy, xx = np.mgrid[0:h, 0:w]
    plume = np.exp(-((xx - w / 2) / (w * (0.12 + 0.3 * (1 - yy / h)))) ** 2) * (yy / h) ** 0.8
    a = plume * (0.5 + 0.5 * noise(s, 40, rng, 4)) * 0.7
    return rgba(tint_noise("#1b1916", s, rng, 0.05), a)


def d_cracks(rng):
    s = (512, 512)
    img = Image.new("L", (s[1], s[0]), 0)
    g = ImageDraw.Draw(img)

    def walk(x, y, ang, L, wdt, depth):
        pts = [(x, y)]
        for _ in range(int(L)):
            ang += rng.normal(0, 0.35)
            x, y = x + math.cos(ang) * 4, y + math.sin(ang) * 4
            pts.append((x, y))
            if depth < 3 and rng.random() < 0.025:
                walk(x, y, ang + rng.choice([-1, 1]) * (0.5 + rng.random()), L * 0.45, max(1, wdt - 1), depth + 1)
        g.line(pts, fill=230, width=int(wdt))
    for k in range(3):                                                # from a corner of a window or a joint, wandering
        ang = rng.random() * math.tau
        walk(s[1] * (0.35 + 0.3 * rng.random()), s[0] * (0.35 + 0.3 * rng.random()), ang, 70, 3 if k == 0 else 2, 0)
    a = np.asarray(img.filter(ImageFilter.GaussianBlur(0.8)), np.float32) / 255
    return rgba(hexc("#1b1916"), a * 0.85)


def d_moss(rng):
    s = (192, 640)
    h, w = s
    yy = np.linspace(1, 0, h)[:, None]
    top = 0.35 + 0.45 * noise((1, w), 60, rng, 4)[0][None, :]
    a = soft(top - yy, -0.05, 0.12) * (0.55 + 0.45 * noise(s, 18, rng, 5))
    col = tint_noise("#3d4a2a", s, rng, 0.2, 20)
    return rgba(col, a * 0.85)


def font(px):
    for f in FONTS:
        if Path(f).is_file():
            try:
                return ImageFont.truetype(f, px)
            except OSError:
                pass
    return None


WORDS = ["納涼祭", "迷い猫", "求人", "閉店", "ライブ", "占い", "貸店舗", "注意", "防犯", "祭", "探しています", "警告"]


def poster(rng, w=420, h=600, torn=True, faded=0.25):
    bg = rng.choice(["#efe9dc", "#f2d9a0", "#d9e6ea", "#f0c9c0", "#e8e8e8"])
    col = rng.choice(["#b3261e", "#1d3557", "#2a2a2a", "#2d6a4f", "#7b2d8e"])
    img = Image.new("RGB", (w, h), bg)
    g = ImageDraw.Draw(img)
    f = font(int(w * 0.17))
    word = rng.choice(WORDS)
    if f:
        g.text((w * 0.08, h * 0.06), word, fill=col, font=f)
    else:
        g.rectangle([w * 0.08, h * 0.06, w * 0.92, h * 0.2], fill=col)
    g.rectangle([w * 0.08, h * 0.3, w * 0.92, h * 0.66], fill=rng.choice(["#6d6a65", "#8a6f5a", "#4f6d7a", "#a3826a"]))
    for i in range(5):                                                 # lines of small print
        y = h * (0.72 + i * 0.045)
        g.rectangle([w * 0.08, y, w * (0.5 + 0.4 * rng.random()), y + h * 0.015], fill=col)
    a = np.ones((h, w), np.float32)
    rgb = np.asarray(img, np.float32) / 255
    rgb = rgb * (1 - faded) + faded * np.array([0.92, 0.9, 0.86])     # sun-faded
    rgb *= (0.88 + 0.12 * noise((h, w), 30, rng, 4))[..., None]       # wrinkles and dirt
    if torn:                                                           # a corner torn away, a ragged edge
        yy, xx = np.mgrid[0:h, 0:w]
        cut = (xx / w + (1 - yy / h)) + (noise((h, w), 40, rng, 5) - 0.5) * 0.25
        a *= soft(1.55 - cut, 0, 0.02) if rng.random() < 0.7 else 1
        edge = noise((h, w), 12, rng, 3)
        a *= soft(np.minimum.reduce([xx, w - 1 - xx, yy, h - 1 - yy]) / 6 + edge * 0.8, 0.3, 0.6)
    return rgba(rgb, a)


def d_poster(rng):
    return poster(rng)


def d_posters_old(rng):
    W, H = 800, 640
    canvas = np.zeros((H, W, 4), np.float32)
    for _ in range(5):
        p = poster(rng, int(260 + rng.random() * 150), int(360 + rng.random() * 200), True, 0.35 + 0.3 * rng.random())
        ph, pw = p.shape[:2]
        x, y = rng.integers(0, max(1, W - pw)), rng.integers(0, max(1, H - ph))
        a = p[..., 3:4] * (0.75 + 0.25 * rng.random())
        canvas[y:y + ph, x:x + pw, :3] = canvas[y:y + ph, x:x + pw, :3] * (1 - a) + p[..., :3] * a
        canvas[y:y + ph, x:x + pw, 3:] = np.maximum(canvas[y:y + ph, x:x + pw, 3:], a)
    left = noise((H, W), 50, rng, 4)                                   # paper scraped off in patches
    canvas[..., 3] *= soft(left, 0.25, 0.4)
    return canvas


def d_stickers(rng):
    W, H = 256, 512
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    g = ImageDraw.Draw(img)
    for _ in range(14):
        c = tuple(int(x) for x in rng.choice([[230, 230, 225], [220, 60, 50], [40, 90, 160], [240, 200, 40], [30, 30, 30], [90, 170, 90]])) + (int(200 + rng.random() * 55),)
        x, y, s = rng.random() * W, rng.random() * H, 18 + rng.random() * 40
        (g.ellipse if rng.random() < 0.4 else g.rectangle)([x, y, x + s, y + s * (0.6 + rng.random() * 0.8)], fill=c)
    a = np.asarray(img, np.float32) / 255
    a[..., :3] *= (0.85 + 0.15 * noise((H, W), 20, rng, 3))[..., None]
    return a


def d_graffiti(rng):
    W, H = 768, 432
    img = Image.new("L", (W, H), 0)
    g = ImageDraw.Draw(img)
    x = W * 0.08
    for _ in range(rng.integers(3, 6)):                                # letters as loops and strokes
        pts, cx, cy = [], x, H * (0.3 + 0.3 * rng.random())
        for t in np.linspace(0, 1, 40):
            a = t * math.pi * (2 + 3 * rng.random())
            pts.append((cx + math.cos(a) * W * 0.05 * (1 + t) + t * W * 0.12, cy + math.sin(a * 1.3) * H * 0.22))
        g.line(pts, fill=255, width=int(10 + rng.random() * 10), joint="curve")
        x += W * 0.17
    g.line([(W * 0.06, H * 0.82), (W * 0.94, H * 0.74)], fill=255, width=9)
    a = np.asarray(img.filter(ImageFilter.GaussianBlur(3.2)), np.float32) / 255
    a = soft(a, 0.08, 0.6)
    for _ in range(12):                                                # drips
        xx = rng.integers(int(W * 0.1), int(W * 0.9)); y0 = int(H * (0.5 + 0.3 * rng.random())); L = rng.integers(20, 90)
        a[y0:y0 + L, xx - 2:xx + 2] = np.maximum(a[y0:y0 + L, xx - 2:xx + 2], np.linspace(0.9, 0, min(L, H - y0))[:, None])
    col = hexc(rng.choice(["#151515", "#c8c8c8", "#b02a2a", "#2a5bb0"]))
    return rgba(col, a * 0.92)


# ---- on the ground -----------------------------------------------------------------------------------------------

def d_oil(rng):
    s = (384, 448)
    a = blob(s, rng, 0.5) * (0.5 + 0.5 * noise(s, 50, rng, 4)) * 0.75
    return rgba(tint_noise("#121110", s, rng, 0.05), a)


def d_puddle(rng):
    s = (384, 576)
    a = blob(s, rng, 0.6, edge=0.03)
    return rgba(tint_noise("#1e1f20", s, rng, 0.05), a * 0.55)


def d_tyres(rng):
    W, H = 1024, 192
    img = Image.new("L", (W, H), 0)
    g = ImageDraw.Draw(img)
    for off in (-0.25, 0.25):
        pts = [(x, H / 2 + off * H + math.sin(x / W * math.pi) * H * 0.18) for x in np.linspace(0, W, 60)]
        g.line(pts, fill=200, width=26)
    a = np.asarray(img.filter(ImageFilter.GaussianBlur(4)), np.float32) / 255
    a *= 0.5 + 0.5 * noise((H, W), 30, rng, 4)
    a *= soft(np.minimum(np.arange(W), W - 1 - np.arange(W))[None, :] / (W * 0.2), 0, 1)
    return rgba(hexc("#141414"), a * 0.6)


def d_gum(rng):
    W = H = 384
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    g = ImageDraw.Draw(img)
    for _ in range(40):
        x, y, r = rng.random() * W, rng.random() * H, 2 + rng.random() * 5
        v = int(25 + rng.random() * 40)
        g.ellipse([x - r, y - r, x + r, y + r], fill=(v, v, v, int(150 + rng.random() * 90)))
    return np.asarray(img.filter(ImageFilter.GaussianBlur(0.6)), np.float32) / 255


def d_paint_worn(rng):
    s = (384, 384)
    a = soft(noise(s, 24, rng, 5), 0.5, 0.62) * blob(s, rng, 0.65)
    return rgba(tint_noise("#e7e4dc", s, rng, 0.04), a * 0.9)


def d_leaves(rng):
    W = H = 512
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    g = ImageDraw.Draw(img)
    for _ in range(70):
        x, y = rng.normal(W / 2, W / 5), rng.normal(H / 2, H / 5)
        L, Wd, ang = 10 + rng.random() * 14, 5 + rng.random() * 6, rng.random() * math.pi
        c = rng.choice([[120, 80, 40], [150, 105, 45], [95, 70, 40], [170, 130, 60], [80, 85, 40]])
        pts = []                                                       # a leaf: pointed at both ends, wider in the middle
        for t in np.linspace(0, 2 * math.pi, 17)[:-1]:
            px, py = math.cos(t) * L, math.sin(t) * Wd * abs(math.sin(t)) ** 0.3
            pts.append((x + px * math.cos(ang) - py * math.sin(ang), y + px * math.sin(ang) + py * math.cos(ang)))
        g.polygon(pts, fill=tuple(int(v) for v in c) + (235,))
    return np.asarray(img, np.float32) / 255


def d_litter(rng):
    W = H = 384
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    g = ImageDraw.Draw(img)
    for _ in range(18):
        x, y, a = rng.random() * W, rng.random() * H, rng.random() * math.pi
        L = 8 + rng.random() * 6
        g.line([(x, y), (x + math.cos(a) * L, y + math.sin(a) * L)], fill=(235, 230, 220, 240), width=3)       # a cigarette's end
        g.line([(x + math.cos(a) * L * 0.65, y + math.sin(a) * L * 0.65), (x + math.cos(a) * L, y + math.sin(a) * L)], fill=(200, 140, 70, 240), width=3)
    for _ in range(4):
        x, y, s = rng.random() * W, rng.random() * H, 10 + rng.random() * 18
        g.polygon([(x, y), (x + s, y + s * 0.2), (x + s * 0.8, y + s), (x - s * 0.1, y + s * 0.7)], fill=(225, 225, 220, 230))
    return np.asarray(img, np.float32) / 255


def d_manhole(rng):
    S = 512
    yy, xx = np.mgrid[0:S, 0:S]
    r = np.hypot(xx - S / 2, yy - S / 2) / (S / 2)
    th = np.arctan2(yy - S / 2, xx - S / 2)
    a = soft(1 - r, 0, 0.01)
    base = 0.24 + 0.05 * noise((S, S), 30, rng, 4)
    rings = (np.abs(r - 0.93) < 0.025) | (np.abs(r - 0.62) < 0.02)
    pattern = ((np.sin(th * 18) > 0.0) & (r > 0.66) & (r < 0.9)) | ((np.sin(xx / 14) * np.sin(yy / 14) > 0.35) & (r < 0.58))
    v = base + 0.06 * pattern + 0.07 * rings
    img = np.dstack([v * 1.0, v * 0.98, v * 0.95])
    out = Image.fromarray((np.dstack([np.clip(img, 0, 1), a]) * 255).astype(np.uint8), "RGBA")
    f = font(46)
    if f:
        ImageDraw.Draw(out).text((S / 2, S / 2), "下水", fill=(70, 69, 66, 255), font=f, anchor="mm")
    return np.asarray(out, np.float32) / 255


def d_grate(rng):
    W, H = 256, 576
    v = np.full((H, W), 0.28, np.float32)
    frame = np.zeros((H, W), bool)
    frame[:14, :] = frame[-14:, :] = True
    frame[:, :14] = frame[:, -14:] = True
    slots = ((np.arange(H)[:, None] % 26) > 13) & ~frame
    v[slots] = 0.03                                                    # the dark below
    v += 0.04 * noise((H, W), 20, rng, 3) * ~slots
    img = np.dstack([v, v * 0.98, v * 0.95])
    return np.dstack([np.clip(img, 0, 1), np.ones((H, W), np.float32)])


# ---- wear laid by hand (the user: "there are no perfectly smooth things... chips, smudges, fingerprints") ----------

def d_fingerprints(rng):
    """Greasy fingerprints and a palm's smear, where a door or a glass is pushed: ridged ovals, a haze."""
    W, H = 384, 384
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    a = np.zeros((H, W), np.float32)
    for _ in range(9):
        cx, cy = rng.normal(W / 2, W / 6), rng.normal(H / 2, H / 6)
        rx, ry, ang = 14 + rng.random() * 6, 19 + rng.random() * 7, rng.random() * math.pi
        dx, dy = xx - cx, yy - cy
        u = (dx * math.cos(ang) + dy * math.sin(ang)) / rx
        v = (-dx * math.sin(ang) + dy * math.cos(ang)) / ry
        r = np.sqrt(u * u + v * v)
        ridges = 0.5 + 0.5 * np.sin(r * 26 + noise((H, W), 8, rng, 2) * 3)            # the whorl's ridges
        a = np.maximum(a, soft(1 - r, 0, 0.35) * (0.45 + 0.55 * ridges) * (0.5 + 0.5 * rng.random()))
    palm = blob((H, W), rng, 0.3, edge=0.2) * 0.25
    a = np.maximum(a, palm)
    return rgba(hexc("#b9b4a8"), a * 0.5)


def d_smudge(rng):
    """A greasy hand smear, darker and shinier, rubbed along."""
    s = (256, 512)
    a = blob(s, rng, 0.45, edge=0.25) * (0.4 + 0.6 * noise(s, 20, rng, 4))
    a = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6)), np.float32) / 255
    return rgba(tint_noise("#2d2a26", s, rng, 0.05), a * 0.45)


def d_scuffs(rng):
    """Black rubber scuffs at the foot of a door or a wall: shoes, trolleys, bags."""
    W, H = 768, 192
    img = Image.new("L", (W, H), 0)
    g = ImageDraw.Draw(img)
    for _ in range(26):
        x, y = rng.random() * W, H * (0.35 + 0.6 * rng.random())
        L, ang = 20 + rng.random() * 70, rng.normal(0, 0.25)
        g.line([(x, y), (x + math.cos(ang) * L, y + math.sin(ang) * L)], fill=int(120 + rng.random() * 135), width=int(2 + rng.random() * 5))
    a = np.asarray(img.filter(ImageFilter.GaussianBlur(1.5)), np.float32) / 255
    return rgba(hexc("#141312"), a * 0.8)


def d_scratches(rng):
    """Scratches in paint or metal: hair-thin, bright where they cut through, in a bunch."""
    W = H = 512
    img = Image.new("L", (W, H), 0)
    g = ImageDraw.Draw(img)
    base = rng.random() * math.pi
    for _ in range(40):
        x, y = rng.normal(W / 2, W / 4), rng.normal(H / 2, H / 4)
        ang, L = base + rng.normal(0, 0.3), 30 + rng.random() * 150
        pts = [(x + math.cos(ang) * t + rng.normal(0, 0.6), y + math.sin(ang) * t + rng.normal(0, 0.6)) for t in np.linspace(0, L, 12)]
        g.line(pts, fill=int(150 + rng.random() * 105), width=1)
    a = np.asarray(img.filter(ImageFilter.GaussianBlur(0.5)), np.float32) / 255
    return rgba(hexc("#d9d6cf"), a * 0.85)


def d_chipped_paint(rng):
    """Paint flaked off a wall or a door: islands of what's under it with a lighter rim."""
    s = (448, 448)
    n = noise(s, 26, rng, 5)
    hole = soft(n, 0.6, 0.63) * blob(s, rng, 0.7, edge=0.15)
    rim = np.clip(soft(n, 0.56, 0.6) - hole, 0, 1)
    col = np.dstack([hole * 0.42 + rim * 0.85 + (1 - hole - rim) * 0.5] * 3).astype(np.float32) * np.array([1.0, 0.97, 0.93])
    return np.dstack([np.clip(col, 0, 1), np.clip(hole + rim * 0.7, 0, 1)])


def d_water_stain(rng):
    """Tide marks where water stood and dried: rings, darker at their edges."""
    s = (448, 448)
    h, w = s
    yy, xx = np.mgrid[0:h, 0:w]
    r = np.hypot((xx - w / 2) / (w / 2), (yy - h / 2) / (h / 2)) + (noise(s, 50, rng, 4) - 0.5) * 0.5
    a = np.zeros(s, np.float32)
    for k in (0.45, 0.62, 0.8):
        a = np.maximum(a, np.exp(-((r - k) / 0.025) ** 2) * (0.5 + 0.5 * rng.random()))
    a += soft(0.8 - r, 0, 0.3) * 0.12
    return rgba(tint_noise("#4a4338", s, rng, 0.08), np.clip(a, 0, 1) * 0.6)


def d_tape(rng):
    """Tape and the paper left of posters torn down: yellowed strips, their glue's dirt."""
    W, H = 512, 384
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    g = ImageDraw.Draw(img)
    for x0, y0 in [(30, 30), (W - 130, 30), (30, H - 70), (W - 130, H - 70), (W / 2 - 50, 25)]:
        if rng.random() < 0.8:
            c = (int(200 + rng.random() * 30), int(185 + rng.random() * 25), int(140 + rng.random() * 30), 230)
            g.polygon([(x0, y0), (x0 + 100 + rng.random() * 20, y0 + rng.normal(0, 4)), (x0 + 100, y0 + 36), (x0 - 4, y0 + 40)], fill=c)
    a = np.asarray(img, np.float32) / 255
    a[..., :3] *= (0.85 + 0.15 * noise((H, W), 16, rng, 3))[..., None]
    return a


# kind: (label, where, (width m, height m), roughness or None, metallic, made by)
DECALS = {
    "rain_streaks": ("Rain streaks", "wall", (1.5, 2.0), None, 0.0, d_rain),
    "rust_bleed": ("Rust bleeding from a fitting", "wall", (0.6, 1.4), None, 0.0, d_rust),
    "damp": ("Damp patch", "wall", (1.4, 1.2), None, 0.0, d_damp),
    "efflorescence": ("Salt bloom (efflorescence)", "wall", (1.0, 1.4), None, 0.0, d_efflorescence),
    "soot": ("Soot over a vent", "wall", (0.8, 1.1), None, 0.0, d_soot),
    "cracks": ("Cracks", "wall", (1.5, 1.5), None, 0.0, d_cracks),
    "moss": ("Moss at the foot of a wall", "wall", (2.4, 0.7), None, 0.0, d_moss),
    "poster": ("Poster", "wall", (0.6, 0.85), 0.8, 0.0, d_poster),
    "posters_old": ("Old posters, torn", "wall", (1.5, 1.2), 0.85, 0.0, d_posters_old),
    "stickers": ("Stickers", "any", (0.3, 0.6), 0.6, 0.0, d_stickers),
    "graffiti": ("Sprayed tag", "wall", (1.6, 0.9), None, 0.0, d_graffiti),
    "oil": ("Oil stain", "ground", (1.0, 0.85), 0.3, 0.0, d_oil),
    "puddle": ("Puddle", "ground", (1.6, 1.1), 0.04, 0.0, d_puddle),
    "tyre_marks": ("Tyre marks", "ground", (3.0, 0.55), None, 0.0, d_tyres),
    "gum": ("Chewing gum", "ground", (1.0, 1.0), None, 0.0, d_gum),
    "paint_worn": ("Worn paint", "ground", (1.0, 1.0), None, 0.0, d_paint_worn),
    "leaves": ("Fallen leaves", "ground", (1.2, 1.2), 0.8, 0.0, d_leaves),
    "litter": ("Litter, cigarette ends", "ground", (0.8, 0.8), 0.7, 0.0, d_litter),
    "manhole": ("Manhole cover", "ground", (0.75, 0.75), 0.55, 0.6, d_manhole),
    "drain_grate": ("Drain grate", "ground", (0.4, 0.9), 0.5, 0.7, d_grate),
    "fingerprints": ("Fingerprints and a palm", "any", (0.25, 0.25), 0.3, 0.0, d_fingerprints),
    "smudge": ("Greasy smudge", "any", (0.5, 0.25), 0.35, 0.0, d_smudge),
    "scuffs": ("Rubber scuffs at the foot", "wall", (1.2, 0.3), 0.7, 0.0, d_scuffs),
    "scratches": ("Scratches", "any", (0.5, 0.5), 0.35, 0.0, d_scratches),
    "chipped_paint": ("Chipped paint", "wall", (0.8, 0.8), 0.8, 0.0, d_chipped_paint),
    "water_stain": ("Water stain, tide marks", "any", (0.9, 0.9), None, 0.0, d_water_stain),
    "tape": ("Tape and paper left of posters", "wall", (0.6, 0.45), 0.6, 0.0, d_tape),
}


def made_from():
    return int(Path(__file__).stat().st_mtime)


def ensure(force=False, say=print):
    """Every decal's picture and the catalogue, made again when missing or older than this file."""
    OUT.mkdir(parents=True, exist_ok=True)
    cat = OUT / "decals.json"
    old = json.loads(cat.read_text(encoding="utf-8")) if cat.is_file() else {}
    fresh = old.get("made_from", 0) >= made_from() and not force
    made = 0
    for i, (k, (label, where, size, rough, metal, fn)) in enumerate(sorted(DECALS.items())):
        if fresh and (OUT / f"{k}.png").is_file():
            continue
        rng = np.random.default_rng(1000 + i)
        a = fn(rng)
        Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8), "RGBA").save(OUT / f"{k}.png", optimize=True)
        made += 1
    info = {"made_from": made_from(), "decals": {k: {"label": v[0], "on": v[1], "size": list(v[2]), "rough": v[3], "metal": v[4], "file": f"{k}.png"}
                                                 for k, v in sorted(DECALS.items())}}
    cat.write_text(json.dumps(info, indent=1, ensure_ascii=False), encoding="utf-8")
    say(f"DECALS {len(DECALS)} in assets/decals ({made} made now)")
    return info


if __name__ == "__main__":
    import sys
    ensure("--force" in sys.argv)
