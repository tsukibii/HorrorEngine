"""Label designs: a few fields (a brand, a line under it, colours, a size) drawn as a label is laid out, on a Frame in
millimetres. A design is a function (frame, fields, rng); `DESIGNS` names them, and a recipe's `art` picks one:
{"design": "soda", "brand": "KAZE", "flavour": "ORANGE SODA", "colors": ["#e8620f", "#ffa13d"]}. Every brand here is
made up. `art: {"image": "my_label.png"}` lays your own picture over the island instead (uv_template's layout).

What a design draws that you'd want to swap (the brand, a picture, an ornament, a seal, a line of print) goes through
`f.slot` (paint.py): a recipe's `pictures` puts your picture in its box instead. Where a slot's drawing takes random
numbers, they're drawn before it, so swapping one leaves everything after it as it was."""
import math

import numpy as np

from . import paint as P

INK = dict(rough=0.28, metal=0.4)          # printed ink over metal: still a little metallic
WHITE_INK = dict(rough=0.35, metal=0.12)   # the opaque white base under bright colours


def _box(polys, pad=0.0, at=(0.0, 0.0)):
    """The box (cx, cy, w, h mm) round polygons, `pad` mm more all round (None for none)."""
    polys = [np.asarray(q, float) for q in polys if len(q)]
    if not polys:
        return None
    a = np.concatenate(polys)
    (x0, y0), (x1, y1) = a.min(0), a.max(0)
    return (at[0] + (x0 + x1) / 2, at[1] + (y0 + y1) / 2, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad)


def text_box(s, at, size, pad=0.4, **layout):
    """A slot's box round text where Frame.text puts it: its outline's own extent, `pad` mm more (layout: font,
    tracking, line, anchor, rot, fit, arc... as the text is drawn)."""
    return _box(P.text_polys(s, size=size, **layout), pad, at) or (at[0], at[1], 2 * pad, size)


def union(*boxes):
    """The box round boxes (cx, cy, w, h mm): a slot's round a drawing of several parts."""
    x0 = min(b[0] - b[2] / 2 for b in boxes)
    y0 = min(b[1] - b[3] / 2 for b in boxes)
    x1 = max(b[0] + b[2] / 2 for b in boxes)
    y1 = max(b[1] + b[3] / 2 for b in boxes)
    return ((x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0)


def on(f, box):
    """A box kept on its island: a picture laid in it can't go past the island's edges (or round a band's seam)."""
    cx, cy, w, h = box
    x0, y0, x1, y1 = max(cx - w / 2, 0.0), max(cy - h / 2, 0.0), min(cx + w / 2, f.W), min(cy + h / 2, f.H)
    return ((x0 + x1) / 2, (y0 + y1) / 2, max(x1 - x0, 0.0), max(y1 - y0, 0.0))


def _glyphs_box(glyphs, pad, at, size):
    """The box round characters laid out by _tate (a column's place and size when there are none)."""
    return _box([q for g in glyphs for q in g], pad) or (at[0], at[1] - size / 2, size, size)


def _greek(f, x, y, w, rows, size, color, rng, gap=1.6, font="archivo"):
    """Rows of small print (ingredients, the law's lines) as made-up words."""
    syl = ["ra", "to", "mi", "ne", "ka", "su", "lo", "vi", "de", "an", "or", "el", "um", "is", "ta", "po"]
    for i in range(rows):
        words, ln = [], 0
        while ln < w / (size * 0.62):
            wd = "".join(rng.choice(syl, rng.integers(1, 4)))
            words.append(wd)
            ln += len(wd) + 1
        f.text(" ".join(words), (x, y - i * size * gap), size, font=font, anchor="left", fit=w, color=color, **INK)


def _barcode(f, x, y, w, h, rng, color="#111111"):
    f.rect(x - 1.5, y - 3.0, w + 3, h + 4.5, color="#ffffff", **WHITE_INK)
    xs = x
    while xs < x + w:
        bw = rng.choice([0.25, 0.25, 0.5, 0.75])
        if rng.random() < 0.55:
            f.rect(xs, y, bw, h, color=color, **INK)
        xs += bw + 0.25
    f.text("4 901234 567894", (x + w / 2, y - 1.6), 1.2, font="mono", color=color, **INK)


def _bubbles(f, rng, count, color, alpha, rmin, rmax, y0=0, y1=None):
    """Bubbles as rings all over: their sizes and places drawn now; returns what draws them."""
    y1 = f.H if y1 is None else y1
    spots = []
    for _ in range(count):
        r = rng.uniform(rmin, rmax)
        spots.append((rng.uniform(0, f.W), rng.uniform(y0, y1), r))

    def draw():
        for x, y, r in spots:
            f.ring(x, y, r, max(r * 0.18, 0.3), color=color, alpha=alpha, **INK)
    return draw


def _fruit(f, cx, cy, r, color, rind="#fff0c8", seed=0):
    """An orange (or lemon, lime) slice: rind, pith, segments."""
    f.ellipse(cx, cy, r, color=color, **INK)
    f.ellipse(cx, cy, r * 0.88, color=rind, **WHITE_INK)
    for k in range(10):
        a0 = k * 2 * math.pi / 10 + 0.06
        a1 = (k + 1) * 2 * math.pi / 10 - 0.06
        pts = [(cx + r * 0.08 * math.cos((a0 + a1) / 2), cy + r * 0.08 * math.sin((a0 + a1) / 2))]
        for j in range(7):
            a = a0 + (a1 - a0) * j / 6
            pts.append((cx + r * 0.8 * math.cos(a), cy + r * 0.8 * math.sin(a)))
        f.poly(pts, color=color, **INK)


def soda(f, d, rng):
    c0, c1 = (d.get("colors") or ["#e8620f", "#ffa13d"])[:2]
    accent = d.get("accent", "#6b2200")
    f.gradient(c0, c1, angle=90, **INK)
    f.slot("bubbles", (f.W / 2, f.H / 2, f.W, f.H), _bubbles(f, rng, int(d.get("bubbles", 70)), "#ffffff", 0.35, 0.8, 4.5),
           kind="pattern", about="the bubbles all over it", **INK)
    mid = f.W / 2
    brand = d.get("brand", "KAZE")
    f.rect(0, f.H * 0.86, f.W, f.H * 0.035, color=accent, **INK)
    f.rect(0, f.H * 0.06, f.W, f.H * 0.03, color=accent, **INK)
    font = d.get("font", "anton")
    f.slot("logo", text_box(brand, (mid, f.H * 0.56), f.H * 0.26, 2.4, font=font, fit=f.W * 0.34),
           lambda: f.text(brand, (mid, f.H * 0.56), f.H * 0.26, font=font, color="#ffffff", fit=f.W * 0.34,
                          stroke=(accent, 1.4), shadow=("#000000", 0.8, -1.0, 1.2, 0.3), **WHITE_INK),
           about="the brand across the front", **WHITE_INK)
    flavour = d.get("flavour", "ORANGE SODA")
    f.slot("flavour", text_box(flavour, (mid, f.H * 0.31), f.H * 0.065, font="bebas", tracking=0.18),
           lambda: f.text(flavour, (mid, f.H * 0.31), f.H * 0.065, font="bebas", tracking=0.18, color="#fff7e6", **WHITE_INK),
           kind="text", about="the flavour under the brand", **WHITE_INK)
    f.text(d.get("volume", "330 ml"), (mid, f.H * 0.16), f.H * 0.035, font="archivo", color="#ffffff", **WHITE_INK)
    f.slot("fruit", (mid + f.W * 0.2, f.H * 0.62, f.H * 0.19, f.H * 0.19),
           lambda: _fruit(f, mid + f.W * 0.2, f.H * 0.62, f.H * 0.09, d.get("fruit", "#f08a1c")),
           kind="picture", about="the orange slice beside the brand", **INK)
    # the back: small print and a barcode
    _greek(f, 4, f.H * 0.7, 40, 8, 1.4, "#ffffff", rng)
    _barcode(f, f.W - 34, f.H * 0.3, 22, 9, rng)
    tag = d.get("tagline", "Fresh & Fizzy")
    f.slot("tagline", text_box(tag, (mid - f.W * 0.2, f.H * 0.72), f.H * 0.06, font="pacifico", rot=10),
           lambda: f.text(tag, (mid - f.W * 0.2, f.H * 0.72), f.H * 0.06, font="pacifico", rot=10, color="#fff2c0", **WHITE_INK),
           kind="text", about="the tagline in a script, tilted", **WHITE_INK)


def energy(f, d, rng):
    c0 = (d.get("colors") or ["#0c0c0e"])[0]
    lines = d.get("lines") or ["#f6d21e", "#22b8f0"]
    f.fill(color=c0, rough=0.28, metal=0.65)
    # scribbles: thin white strokes all over, their places drawn first (swapped, the small print after them stays as it was)
    strokes = []
    for _ in range(int(d.get("scribbles", 40))):
        x, y = rng.uniform(0, f.W), rng.uniform(0, f.H)
        pts = [(x, y)]
        for _k in range(rng.integers(2, 5)):
            x += rng.uniform(-6, 6)
            y += rng.uniform(-6, 6)
            pts.append((x, y))
        strokes.append((pts, rng.uniform(0.2, 0.45)))

    def scribbles():
        for pts, w in strokes:
            f.line(pts, w, color="#d8d8d8", alpha=0.75, **INK)
    f.slot("scribbles", (f.W / 2, f.H / 2, f.W, f.H), scribbles, kind="pattern", about="thin white scribbles all over it", **INK)

    # zigzags across the front
    def zigzags():
        for i, c in enumerate(lines):
            y0 = f.H * (0.38 + 0.22 * i)
            pts = [(x, y0 + (4 if k % 2 else -4)) for k, x in enumerate(np.linspace(f.W * 0.2, f.W * 0.8, 15))]
            f.line(pts, 1.6, color=c, **WHITE_INK)
    if lines:
        y0, y1 = f.H * 0.38 - 4.8, f.H * (0.38 + 0.22 * (len(lines) - 1)) + 4.8
        f.slot("zigzags", (f.W / 2, (y0 + y1) / 2, f.W * 0.6 + 1.6, y1 - y0), zigzags, kind="flourish",
               about="the coloured zigzags across the front", **WHITE_INK)
    mid = f.W / 2
    brand, font = d.get("brand", "VOLTA"), d.get("font", "anton")
    f.slot("logo", text_box(brand, (mid, f.H * 0.5), f.H * 0.42, 1.4, font=font, rot=90, fit=f.H * 0.8),
           lambda: f.text(brand, (mid, f.H * 0.5), f.H * 0.42, font=font, rot=90, fit=f.H * 0.8, color="#ffffff",
                          stroke=("#000000", 1.0), **WHITE_INK),
           rot=90, about="the brand up the front, read from below", **WHITE_INK)
    flavour = d.get("flavour", "ENERGY DRINK")
    f.slot("flavour", text_box(flavour, (mid + f.W * 0.11, f.H * 0.5), f.H * 0.05, rot=90, font="bebas", tracking=0.2),
           lambda: f.text(flavour, (mid + f.W * 0.11, f.H * 0.5), f.H * 0.05, rot=90, font="bebas", tracking=0.2, color=lines[0],
                          **WHITE_INK),
           kind="text", rot=90, about="the line up beside the brand", **WHITE_INK)
    f.text(d.get("volume", "500 ml"), (mid - f.W * 0.12, f.H * 0.15), f.H * 0.035, font="archivo", color="#ffffff", **WHITE_INK)
    _greek(f, 4, f.H * 0.75, 38, 9, 1.4, "#bdbdbd", rng)
    _barcode(f, f.W - 34, f.H * 0.25, 22, 9, rng)


def beer(f, d, rng):
    c0, c1 = (d.get("colors") or ["#123a6b", "#0a2242"])[:2]
    gold = d.get("accent", "#d7b45a")
    f.gradient(c1, c0, angle=90, **INK)
    f.slot("pinstripes", (f.W / 2, f.H / 2, f.W, f.H), lambda: f.stripes(3.0, 0.08, angle=0, color=gold, alpha=0.25, **INK),
           kind="pattern", about="the faint gold pinstripes all over it", **INK)
    mid = f.W / 2

    def badge():
        f.ellipse(mid, f.H * 0.55, f.H * 0.3, f.H * 0.33, color="#f3ead4", **WHITE_INK)
        f.ring(mid, f.H * 0.55, f.H * 0.28, 0.9, color=gold, **INK)
    f.slot("badge", (mid, f.H * 0.55, f.H * 0.6 + 0.6, f.H * 0.66 + 0.6), badge, kind="flourish",
           about="the cream oval with its gold ring, behind the brand", **WHITE_INK)
    brand, flavour = d.get("brand", "Kitsune"), d.get("flavour", "LAGER")
    f.slot("logo", text_box(brand, (mid, f.H * 0.58), f.H * 0.12, font="lobster", fit=f.H * 0.5),
           lambda: f.text(brand, (mid, f.H * 0.58), f.H * 0.12, font="lobster", fit=f.H * 0.5, color=c1, **INK),
           about="the brand in a script on the oval", **INK)
    f.slot("flavour", text_box(flavour, (mid, f.H * 0.42), f.H * 0.05, font="bebas", tracking=0.3),
           lambda: f.text(flavour, (mid, f.H * 0.42), f.H * 0.05, font="bebas", tracking=0.3, color=c1, **INK),
           kind="text", about="the kind of beer under it", **INK)
    f.text(d.get("volume", "350 ml  5% ALC."), (mid, f.H * 0.14), f.H * 0.035, font="archivo", color=gold, **INK)
    _greek(f, 4, f.H * 0.7, 40, 8, 1.3, "#e8e0c8", rng)
    _barcode(f, f.W - 34, f.H * 0.3, 22, 9, rng)


def coffee_can(f, d, rng):
    """A Japanese vending-machine coffee can: a band of colour, the brand big, a cup drawn, 'BLACK' or 'MILK'."""
    c0, c1 = (d.get("colors") or ["#3a2416", "#c8a26a"])[:2]
    f.fill(color=c0, **INK)
    f.rect(0, f.H * 0.32, f.W, f.H * 0.36, color=c1, **INK)
    mid = f.W / 2
    brand, flavour, sub = d.get("brand", "BOSSA"), d.get("flavour", "ブラック"), d.get("sub", "微糖 COFFEE")
    f.slot("logo", text_box(brand, (mid, f.H * 0.52), f.H * 0.2, 1.2, font="archivo", fit=f.W * 0.32),
           lambda: f.text(brand, (mid, f.H * 0.52), f.H * 0.2, font="archivo", fit=f.W * 0.32, color="#ffffff",
                          stroke=(c0, 0.8), **WHITE_INK),
           about="the brand big on the band", **WHITE_INK)
    f.slot("flavour", text_box(flavour, (mid, f.H * 0.8), f.H * 0.08, font="gothic_jp"),
           lambda: f.text(flavour, (mid, f.H * 0.8), f.H * 0.08, font="gothic_jp", color="#ffffff", **WHITE_INK),
           kind="text", about="what's in it, over the band (ブラック: black)", **WHITE_INK)
    f.slot("sub", text_box(sub, (mid, f.H * 0.2), f.H * 0.05, font="gothic_jp"),
           lambda: f.text(sub, (mid, f.H * 0.2), f.H * 0.05, font="gothic_jp", color=c1, **WHITE_INK),
           kind="text", about="the line under the band", **WHITE_INK)
    _greek(f, 4, f.H * 0.88, 38, 4, 1.3, "#d8c8b0", rng)
    _barcode(f, f.W - 32, f.H * 0.06, 20, 7, rng)


def _mountain(f, cx, cy, w, h, colors=("#1f5fa8", "#5fa8dc"), snow="#ffffff"):
    """A mountain range logo: two peaks, snow caps, a sun."""
    a, b = colors
    f.poly([(cx - w * 0.5, cy), (cx - w * 0.12, cy + h), (cx + w * 0.2, cy + h * 0.25), (cx + w * 0.5, cy)], color=b, **INK)
    f.poly([(cx - w * 0.35, cy), (cx + w * 0.08, cy + h * 0.82), (cx + w * 0.5, cy)], color=a, **INK)
    f.poly([(cx - w * 0.12, cy + h), (cx - w * 0.2, cy + h * 0.78), (cx - w * 0.1, cy + h * 0.83), (cx - w * 0.03, cy + h * 0.76)], color=snow, **WHITE_INK)
    f.poly([(cx + w * 0.08, cy + h * 0.82), (cx + w * 0.01, cy + h * 0.66), (cx + w * 0.1, cy + h * 0.7), (cx + w * 0.17, cy + h * 0.64)], color=snow, **WHITE_INK)


def water(f, d, rng):
    """A still-water label: white to pale blue, mountains, the brand in blue, waves along the foot."""
    c0, c1 = (d.get("colors") or ["#ffffff", "#cfe7f7"])[:2]
    blue = d.get("accent", "#1d58a6")
    ink = dict(rough=0.4, metal=0.0)
    f.gradient(c1, c0, angle=90, **ink)

    def waves():
        for i in range(3):
            y = f.H * (0.12 + 0.07 * i)
            pts = [(x, y + 1.2 * math.sin(x / 9.0 + i)) for x in np.linspace(-2, f.W + 2, 120)]
            f.line(pts, 0.9, color=mix_hex(blue, "#ffffff", 0.35 + 0.2 * i), **ink)
    y0, y1 = f.H * 0.12 - 1.8, f.H * 0.26 + 1.8
    f.slot("waves", (f.W / 2, (y0 + y1) / 2, f.W, y1 - y0), waves, kind="flourish", about="the three waves round its foot", **ink)
    mid = f.W / 2
    f.slot("mountains", (mid, f.H * 0.67, f.H * 0.55 + 0.4, f.H * 0.3 + 0.4), lambda: _mountain(f, mid, f.H * 0.52, f.H * 0.55, f.H * 0.3),
           kind="picture", about="the snow-capped mountains over the brand", **INK)
    brand, font, flavour = d.get("brand", "MIZUHO"), d.get("font", "archivo"), d.get("flavour", "NATURAL MINERAL WATER")
    f.slot("logo", text_box(brand, (mid, f.H * 0.38), f.H * 0.14, font=font, tracking=0.06, fit=f.W * 0.3),
           lambda: f.text(brand, (mid, f.H * 0.38), f.H * 0.14, font=font, tracking=0.06, color=blue, fit=f.W * 0.3, **ink),
           about="the brand in blue under the mountains", **ink)
    f.slot("flavour", text_box(flavour, (mid, f.H * 0.27), f.H * 0.05, font="bebas", tracking=0.2),
           lambda: f.text(flavour, (mid, f.H * 0.27), f.H * 0.05, font="bebas", tracking=0.2, color="#5a7da8", **ink),
           kind="text", about="what it is, under the brand", **ink)
    f.text(d.get("volume", "500 ml"), (mid + f.W * 0.17, f.H * 0.88), f.H * 0.06, font="archivo", color=blue, **ink)
    _greek(f, 4, f.H * 0.8, 46, 10, 1.6, "#6d7f95", rng)
    _barcode(f, f.W - 36, f.H * 0.4, 24, 11, rng)


def coffee_cup(f, d, rng):
    """A takeaway cup: white board, wavy lines round its foot and lip, a small brand mark."""
    ink = dict(rough=0.7, metal=0.0)
    f.fill(color=d.get("paper", "#f6f4ee"), **ink)
    cols = d.get("colors") or ["#3a8fb7", "#e07b39"]
    for i, c in enumerate(cols[:2]):
        def waves(i=i, c=c):
            for row in range(2):
                y = f.H * (0.06 + 0.05 * row + 0.82 * i)
                pts = [(x, y + 1.3 * math.sin(x / 5.0 + row * 1.7 + i)) for x in np.linspace(-2, f.W + 2, 160)]
                f.line(pts, 0.7, color=c, **ink)
        y0, y1 = f.H * (0.06 + 0.82 * i) - 1.7, f.H * (0.11 + 0.82 * i) + 1.7
        f.slot(("waves_foot", "waves_lip")[i], (f.W / 2, (y0 + y1) / 2, f.W, y1 - y0), waves, kind="flourish",
               about=("the two wavy lines round its foot", "the two wavy lines round its lip")[i], **ink)
    mid = f.W / 2
    brand, tag = d.get("brand", "FRESH BREW COFFEE"), d.get("tagline", "careful, the drink is hot")
    f.slot("logo", text_box(brand, (mid, f.H * 0.78), f.H * 0.05, font="archivo", tracking=0.08, fit=f.W * 0.3),
           lambda: f.text(brand, (mid, f.H * 0.78), f.H * 0.05, font="archivo", tracking=0.08, color="#3b2a20", fit=f.W * 0.3, **ink),
           about="the small brand mark at the front", **ink)
    f.slot("tagline", text_box(tag, (mid + f.W * 0.25, f.H * 0.2), f.H * 0.035, font="serif"),
           lambda: f.text(tag, (mid + f.W * 0.25, f.H * 0.2), f.H * 0.035, font="serif", color="#6b5a4c", **ink),
           kind="text", about="the warning round the side", **ink)


def sleeve(f, d, rng):
    """A kraft sleeve: corrugated card, a stamped circle with HOT in it, a second stamp round the back."""
    ink = dict(rough=0.9, metal=0.0)
    f.fill(color=d.get("kraft", "#b5895a"), **ink)
    f.stripes(1.8, 0.5, angle=0, height=0.12, alpha=1.0)
    dark = d.get("stamp", "#4a2c18")
    mid = f.W / 2
    word = d.get("sleeve_word", "HOT")
    for name, x in (("stamp", mid), ("stamp_back", 18.0)):
        def stamped(x=x):
            f.ring(x, f.H * 0.5, f.H * 0.32, 0.8, color=dark, **ink)
            f.text(word, (x, f.H * 0.5), f.H * 0.26, font="archivo", color=dark, **ink)
        tw = text_box(word, (x, f.H * 0.5), f.H * 0.26, font="archivo")[2]
        f.slot(name, on(f, (x, f.H * 0.5, max(f.H * 0.64 + 1.2, tw), f.H * 0.64 + 1.2)), stamped, kind="stamp",
               about="HOT in a ring, stamped on the front" if name == "stamp" else "the same stamp round the back", **ink)
    f.slot("words", text_box("· recyclable ·", (mid + f.W * 0.25, f.H * 0.5), f.H * 0.12, font="serif"),
           lambda: f.text("· recyclable ·", (mid + f.W * 0.25, f.H * 0.5), f.H * 0.12, font="serif", color=dark, **ink),
           kind="text", about="· recyclable · on its side", **ink)


def iced(f, d, rng):
    """An iced-drink cup: white with bubbles in blue, ICE COLD up its side."""
    ink = dict(rough=0.55, metal=0.0)
    f.fill(color="#fbfbfa", **ink)
    blue = d.get("accent", "#2d6fb8")

    def bubbles():
        for _ in range(int(d.get("bubbles", 90))):
            r = rng.uniform(0.8, 3.6)
            f.ring(rng.uniform(0, f.W), rng.uniform(f.H * 0.08, f.H * 0.92), r, max(0.35, r * 0.15), color=blue, alpha=0.7, **ink)
    f.slot("bubbles", (f.W / 2, f.H / 2, f.W, f.H * 0.84 + 7.4), bubbles, kind="pattern", about="the blue bubbles all over it", **ink)
    mid = f.W / 2
    brand = d.get("brand", "ICE COLD")
    f.slot("logo", text_box(brand, (mid, f.H * 0.55), f.H * 0.16, font="bungee", rot=90, fit=f.H * 0.8),
           lambda: f.text(brand, (mid, f.H * 0.55), f.H * 0.16, font="bungee", rot=90, fit=f.H * 0.8, color="#16427a", **ink),
           rot=90, about="the name up its side, read from below", **ink)
    f.rect(0, f.H * 0.02, f.W, f.H * 0.05, color="#e8a33d", **ink)
    f.rect(0, f.H * 0.92, f.W, f.H * 0.05, color="#1aa0b8", **ink)


# ---- paper -------------------------------------------------------------------------------------------------------------

PAPER_INK = dict(rough=0.82, metal=0.0)


def paper_base(f, color="#efece4", fibres=0.6, seed=0, tint=None):
    """Paper: its colour with a faint mottle, fibres in the height (the normal map's tooth), a yellowing toward `tint`."""
    from . import noise as Nn
    X, Y = f.grid()
    f.fill(color=color, rough=0.85, metal=0.0)
    p = np.stack([X / 7.0, Y / 7.0, np.full_like(X, seed * 1.37)], -1)
    mott = Nn.fbm3(p, seed + 3, 3)
    col = P.rgb(color)[None, None] * (1 + 0.035 * mott[..., None])
    if tint:
        g = np.clip(Nn.fbm3(p / 6, seed + 5, 2) * 0.5 + 0.5, 0, 1)[..., None]
        col = col * (1 - 0.35 * g) + P.rgb(tint)[None, None] * 0.35 * g
    f.lay_island(np.ones_like(X), color=col.astype(np.float32))
    fib = Nn.fbm3(np.stack([X / 0.35, Y / 1.6, np.full_like(X, seed)], -1), seed + 7, 2)
    f.lay_island(np.ones_like(X), height=(fib * 0.012 * fibres).astype(np.float32))


def _lines(f, x, y_top, w, rows, size, color, rng, gap=1.45, font="serif", indent_every=9):
    """Rows of made-up words, justified a column `w` mm wide: every word's outline made once (P.text_polys) and the
    whole column filled at once."""
    syl = ["the", "on", "ri", "ver", "town", "coun", "cil", "said", "of", "and", "an", "nounced", "bridge", "week", "res",
           "i", "dents", "mon", "day", "road", "will", "be", "close", "for", "re", "pairs", "that", "were", "ex", "pect", "ed"]
    sp = size * 0.32
    polys = []
    for i in range(rows):
        y = y_top - i * size * gap - size
        words, ww = [], []
        tot = 0.0
        while True:
            wd = "".join(rng.choice(syl, rng.integers(1, 3)))
            wl = P.text_width(wd, font, size)
            if tot + wl > w:
                break
            words.append(wd)
            ww.append(wl)
            tot += wl + sp
        if not words:
            continue
        last = i % indent_every == indent_every - 1
        if last:
            words, ww = words[: max(1, len(words) // 2)], ww[: max(1, len(ww) // 2)]
        gapw = sp if last or len(words) < 2 else (w - sum(ww)) / (len(words) - 1)
        xx = x
        for wd, wl in zip(words, ww):
            for pl in P.text_polys(wd, font, size, anchor="left baseline"):
                polys.append(pl + (xx, y))
            xx += wl + gapw
    if polys:
        f.fill_polys(polys, color=color, **PAPER_INK)


def newspaper(f, d, rng):
    """A newspaper page: the masthead, the date line, a headline and its deck, a photo, columns of text."""
    paper_base(f, d.get("paper", "#e9e5d8"), seed=int(rng.integers(1000)), tint=d.get("age_tint", "#d9cfae"))
    ink = d.get("ink", "#1c1b19")
    W, H = f.W, f.H
    m = W * 0.05
    if d.get("page", 1) == 1:
        title = d.get("title", "The Hollow Creek Herald")
        f.slot("masthead", text_box(title, (W / 2, H - m - H * 0.045), H * 0.045, font="fraktur", fit=W - 2 * m),
               lambda: f.text(title, (W / 2, H - m - H * 0.045), H * 0.045, font="fraktur", fit=W - 2 * m, color=ink, **PAPER_INK),
               about="the paper's name across the top", **PAPER_INK)
        f.rect(m, H - m - H * 0.085, W - 2 * m, 0.5, color=ink, **PAPER_INK)
        f.text(d.get("dateline", "TUESDAY, OCTOBER 14 · 75 CENTS · LATE EDITION"), (W / 2, H - m - H * 0.098), H * 0.009,
               font="serif", tracking=0.1, color=ink, **PAPER_INK)
        f.rect(m, H - m - H * 0.108, W - 2 * m, 0.25, color=ink, **PAPER_INK)
        top = H - m - H * 0.125
        head = d.get("headline", "BRIDGE TO CLOSE\nFOR SIX WEEKS")
        f.slot("headline", text_box(head, (m, top), H * 0.04, font="serif_bold", anchor="left top", fit=W - 2 * m, line=1.05),
               lambda: f.text(head, (m, top), H * 0.04, font="serif_bold", anchor="left top", fit=W - 2 * m, line=1.05, color=ink,
                              **PAPER_INK),
               kind="text", about="the headline", **PAPER_INK)
        top -= H * 0.115
        f.text(d.get("deck", "Residents of the east bank face a long way round"), (m, top), H * 0.012, font="serif", anchor="left top",
               color="#3a3834", **PAPER_INK)
        top -= H * 0.03
        # the photo: a soft grey picture, a caption under it
        pw, ph = (W - 2 * m) * 0.55, H * 0.2

        def photo():
            X, Y = f.grid()
            from . import noise as Nn
            inside = ((X > m) & (X < m + pw) & (Y < top) & (Y > top - ph)).astype(np.float32)
            pic = Nn.fbm3(np.stack([X / 30, Y / 30, np.full_like(X, 3.3)], -1), 9, 4) * 0.5 + 0.45 + 0.25 * np.clip((Y - (top - ph)) / ph, 0, 1)
            grey = np.clip(pic, 0.12, 0.85)[..., None] * np.array([0.92, 0.9, 0.86])[None, None]
            f.lay_island(inside, color=grey.astype(np.float32), rough=0.8)
        f.slot("photo", (m + pw / 2, top - ph / 2, pw, ph), photo, kind="picture", about="the photo under the headline", rough=0.8)
        f.text("The east bank road, seen from the old mill.", (m, top - ph - 2), H * 0.008, font="serif", anchor="left top", color=ink, **PAPER_INK)
        cols, col_top = 3, top
        colw = (W - 2 * m - (cols - 1) * 4) / cols
        x0 = m + pw + 4
        _lines(f, x0, col_top, W - m - x0, int(ph / (H * 0.008 * 1.45)), H * 0.0075, ink, rng)
        y = top - ph - 8
        for c in range(cols):
            _lines(f, m + c * (colw + 4), y, colw, int((y - m) / (H * 0.0075 * 1.45)), H * 0.0075, ink, rng)
            if c:
                f.rect(m + c * (colw + 4) - 2.2, m, 0.25, y - m, color=ink, alpha=0.6, **PAPER_INK)
    else:
        cols = 4
        colw = (W - 2 * m - (cols - 1) * 4) / cols
        sec = d.get("section", "CLASSIFIEDS")
        f.slot("section", text_box(sec, (m, H - m), H * 0.022, font="serif_bold", anchor="left top"),
               lambda: f.text(sec, (m, H - m), H * 0.022, font="serif_bold", anchor="left top", color=ink, **PAPER_INK),
               kind="text", about="the page's section, top left", **PAPER_INK)
        f.rect(m, H - m - H * 0.032, W - 2 * m, 0.5, color=ink, **PAPER_INK)
        y = H - m - H * 0.04
        for c in range(cols):
            yy = y
            x = m + c * (colw + 4)
            while yy > m + 20:
                bh = rng.uniform(18, 45)
                f.rect(x, yy - bh, colw, bh, color=ink, alpha=0.9, **PAPER_INK)
                f.rect(x + 0.4, yy - bh + 0.4, colw - 0.8, bh - 0.8, color=d.get("paper", "#e9e5d8"), **PAPER_INK)
                f.text(rng.choice(["FOR SALE", "WANTED", "ROOM TO LET", "LOST CAT", "NOTICE", "HELP WANTED"]), (x + 2, yy - 2), H * 0.0085,
                       font="serif_bold", anchor="left top", fit=colw - 4, color=ink, **PAPER_INK)
                _lines(f, x + 2, yy - 2 - H * 0.014, colw - 4, max(1, int((bh - 8) / (H * 0.007 * 1.45))), H * 0.0065, ink, rng, indent_every=99)
                yy -= bh + 3


def newsprint(f, d, rng):
    """Any page of small print (for a ball of it): columns of text and a headline or two."""
    paper_base(f, d.get("paper", "#ebe7da"), seed=int(rng.integers(1000)))
    ink = d.get("ink", "#232220")
    m = 6
    cols = int(d.get("cols", 4))
    colw = (f.W - 2 * m - (cols - 1) * 4) / cols
    for c in range(cols):
        y = f.H - m
        x = m + c * (colw + 4)
        while y > m + 10:
            if rng.random() < 0.18:
                f.text(rng.choice(["COUNCIL VOTES", "MILL FIRE", "STORM WARNING", "MISSING", "LOCAL NEWS"]), (x, y), 4.0, font="serif_bold",
                       anchor="left top", fit=colw, color=ink, **PAPER_INK)
                y -= 7
            n = int(rng.integers(6, 16))
            _lines(f, x, y, colw, n, 1.6, ink, rng)
            y -= n * 1.6 * 1.45 + 3


def napkin(f, d, rng):
    """A paper napkin or a wrapper: white, a red print of a smile and a thank-you round it."""
    paper_base(f, d.get("paper", "#f4f3ef"), fibres=1.0, seed=int(rng.integers(1000)))
    red = d.get("accent", "#c8312b")
    ink = dict(rough=0.85, metal=0.0)
    cx, cy = f.W * 0.5, f.H * 0.5
    R = min(f.W, f.H) * 0.18

    def smile():
        f.ring(cx, cy, R, R * 0.1, color=red, **ink)
        f.ellipse(cx - R * 0.35, cy + R * 0.25, R * 0.09, color=red, **ink)
        f.ellipse(cx + R * 0.35, cy + R * 0.25, R * 0.09, color=red, **ink)
        f.line([(cx - R * 0.5 + i * R / 12, cy - R * 0.25 - R * 0.28 * math.sin(math.pi * i / 12)) for i in range(13)], R * 0.09, color=red, **ink)
    f.slot("smile", (cx, cy, R * 2.1 + 0.8, R * 2.1 + 0.8), smile, about="the smiling face in the middle", **ink)
    words = d.get("brand", "THANK YOU · HAVE A NICE DAY")
    for name, y, rot in (("words", cy + R * 1.6, 0), ("words_under", cy - R * 1.6, 180)):
        f.slot(name, text_box(words, (cx, y), R * 0.22, font="archivo", tracking=0.1, rot=rot, fit=f.W * 0.9),
               lambda y=y, rot=rot: f.text(words, (cx, y), R * 0.22, font="archivo", tracking=0.1, color=red, rot=rot, fit=f.W * 0.9, **ink),
               kind="text", rot=rot, about="the thank-you over the face" if not rot else "the thank-you under it, upside down", **ink)


def fries(f, d, rng):
    """A fries bag: green and white stripes, a red seal with the name on an arc."""
    paper_base(f, "#f6f4ec", fibres=0.8, seed=int(rng.integers(1000)))
    green = d.get("colors", ["#1f8f6a"])[0]
    red = d.get("accent", "#d23a2f")
    ink = dict(rough=0.8, metal=0.0)
    f.slot("stripes", (f.W / 2, f.H / 2, f.W, f.H), lambda: f.stripes(f.W / 9, 0.5, angle=90 if d.get("horizontal") else 0, color=green, **ink),
           kind="pattern", about="the green and white stripes", **ink)
    cx, cy, R = f.W * 0.5, f.H * float(d.get("seal_y", 0.58)), f.W * 0.26
    words = d.get("brand", "CRISPY FRIES").split()
    tag = d.get("tagline", "since 1987")

    def seal():
        f.ellipse(cx, cy, R, color="#fbf8f0", **ink)
        f.ring(cx, cy, R * 0.92, R * 0.06, color=red, **ink)
        f.text(words[0], (cx, cy + R * 0.2), R * 0.32, font="bungee", arc=R * 0.75, color=red, **ink)
        if len(words) > 1:
            f.text(" ".join(words[1:]), (cx, cy - R * 0.28), R * 0.3, font="bungee", color=red, **ink)
        f.text(tag, (cx, cy - R * 0.68), R * 0.12, font="pacifico", color=green, **ink)
    box = union((cx, cy, 2 * R + 0.6, 2 * R + 0.6), text_box(words[0], (cx, cy + R * 0.2), R * 0.32, font="bungee", arc=R * 0.75),
                *([text_box(" ".join(words[1:]), (cx, cy - R * 0.28), R * 0.3, font="bungee")] if len(words) > 1 else []),
                text_box(tag, (cx, cy - R * 0.68), R * 0.12, font="pacifico"))
    f.slot("seal", box, seal, kind="logo", about="the round seal with the name on it", **ink)


def receipt(f, d, rng):
    """A till receipt: thermal paper, monospaced lines, a total, a barcode; it fades where it was handled."""
    paper_base(f, "#f5f4f0", fibres=0.4, seed=int(rng.integers(1000)))
    ink = d.get("ink", "#2a2a2e")
    pi = dict(rough=0.6, metal=0.0)
    y = f.H - 10
    brand = d.get("brand", "SUNNY MART #0413")
    f.slot("logo", text_box(brand, (f.W / 2, y), 3.2, font="mono"), lambda: f.text(brand, (f.W / 2, y), 3.2, font="mono", color=ink, **pi),
           about="the shop's name at its head", **pi)
    y -= 6
    for ln in d.get("lines") or ["2-14-7 KITA-KU", "TEL 03-5555-0142", d.get("date", "2026/10/14 23:58"), "-" * 30]:
        f.text(ln, (f.W / 2, y), 2.0, font="mono", color=ink, fit=f.W - 8, **pi)
        y -= 4.2
    items = d.get("items") or [("ONIGIRI SALMON", 158), ("CUP NOODLE", 214), ("BLACK COFFEE", 140), ("CANDLES 6P", 330),
                               ("BATTERIES AA", 498), ("MATCHES", 88)]
    tot = 0
    for name, price in items:
        f.text(name, (6, y), 2.0, font="mono", anchor="left", color=ink, **pi)
        f.text(f"{price:>5}", (f.W - 6, y), 2.0, font="mono", anchor="right", color=ink, **pi)
        tot += price
        y -= 4.4
    f.text("-" * 30, (f.W / 2, y), 2.0, font="mono", color=ink, fit=f.W - 8, **pi)
    y -= 5
    f.text("TOTAL", (6, y), 3.0, font="mono", anchor="left", color=ink, **pi)
    f.text(f"Y{tot:,}", (f.W - 6, y), 3.0, font="mono", anchor="right", color=ink, **pi)
    y -= 9
    _barcode(f, f.W / 2 - 25, y - 10, 50, 10, rng, color=ink)
    f.text(d.get("footer", "THANK YOU FOR SHOPPING"), (f.W / 2, 8), 2.0, font="mono", color=ink, **pi)


def note(f, d, rng):
    """A note: lined paper (or plain), its words handwritten (marker) or typed (typewriter), a line at a time."""
    paper_base(f, d.get("paper", "#f2efe6"), seed=int(rng.integers(1000)), tint=d.get("age_tint"))
    if d.get("lined", True):
        for i in range(int(f.H // 8)):
            f.rect(0, f.H - 22 - i * 8, f.W, 0.25, color="#8fb0cf", alpha=0.8, **PAPER_INK)
        f.rect(18, 0, 0.3, f.H, color="#d47a7a", alpha=0.8, **PAPER_INK)
    font = d.get("font", "marker")
    ink = d.get("ink", "#1f2a52" if font == "marker" else "#222222")
    y = f.H - 22 + 2.2
    size = float(d.get("size", 4.0))
    lines = []                              # each line where the hand put it: (words, x, y, its slant)
    for ln in (d.get("text") or "don't open the door\nwhatever it says").split("\n"):
        x = 22 + rng.uniform(-1, 1)
        lines.append((ln, x, y, rng.uniform(-1.2, 1.2)))
        y -= 8.0 * int(d.get("spacing", 1))

    def writing():
        for ln, x, y, rot in lines:
            f.text(ln, (x, y), size, font=font, anchor="left baseline", rot=rot, fit=f.W - 30, color=ink, **PAPER_INK)
    boxes = [b for b in (_box(P.text_polys(ln, font, size, anchor="left baseline", rot=rot, fit=f.W - 30), 0.4, (x, y))
                         for ln, x, y, rot in lines) if b]
    f.slot("writing", union(*boxes) if boxes else (f.W / 2, f.H - 22, f.W - 30, size), writing, kind="text",
           about="the words written on it", **PAPER_INK)


def paper(f, d, rng):
    paper_base(f, d.get("paper", "#efece4"), seed=int(rng.integers(1000)), tint=d.get("age_tint"))


# ---- card and board ---------------------------------------------------------------------------------------------------

def card_plain(f, d, rng):
    paper_base(f, d.get("color", "#d9cfbf"), fibres=1.2, seed=int(rng.integers(1000)))


def _burger(f, cx, cy, s, ink):
    """A burger drawn in flat shapes: the bun, a lettuce wave, the patty, cheese, the bottom bun."""
    f.ellipse(cx, cy + s * 0.32, s * 0.5, s * 0.3, color="#e59a3b", **ink)
    f.rect(cx - s * 0.52, cy - s * 0.02, s * 1.04, s * 0.34, color="#fbf8f0", **ink)
    f.line([(cx - s * 0.55 + i * s / 10, cy + s * 0.06 + (0.05 * s if i % 2 else -0.02 * s)) for i in range(12)], s * 0.09, color="#5aa83a", **ink)
    f.rect(cx - s * 0.52, cy - s * 0.18, s * 1.04, s * 0.18, r=s * 0.08, color="#6b3a22", **ink)
    f.poly([(cx - s * 0.5, cy - s * 0.02), (cx + s * 0.5, cy - s * 0.02), (cx + s * 0.3, cy - s * 0.12), (cx - s * 0.1, cy - s * 0.06)], color="#f2c230", **ink)
    f.rect(cx - s * 0.5, cy - s * 0.36, s * 1.0, s * 0.16, r=s * 0.08, color="#e59a3b", **ink)
    for k in range(5):
        f.ellipse(cx - s * 0.3 + k * s * 0.15, cy + s * 0.4 + (k % 2) * s * 0.06, s * 0.025, s * 0.012, color="#fff3d6", **ink)


def burger_box(f, d, rng):
    """A burger clamshell's print: white board, red dots in diagonal rows all over, the brand and a burger on its lid."""
    ink = dict(rough=0.8, metal=0.0)
    paper_base(f, d.get("paper", "#f3efe4"), fibres=0.8, seed=int(rng.integers(1000)))
    red = d.get("accent", "#c9372c")

    def pattern():
        f.dots(5.0, 0.55, hexed=True, color=red, alpha=0.85, **ink)
        f.stripes(9.0, 0.06, angle=45, color=red, alpha=0.35, **ink)
    f.slot("pattern", (f.W / 2, f.H / 2, f.W, f.H), pattern, kind="pattern", about="the red dots and diagonal lines all over", **ink)
    if d.get("part") == "lid_bottom":
        cx, cy = f.W / 2, f.H / 2

        def badge():
            f.ellipse(cx, cy, f.W * 0.26, f.H * 0.2, color="#fbf8f0", **ink)
            f.ring(cx, cy, f.W * 0.24, 1.0, color=red, **ink)
        f.slot("badge", (cx, cy, 2 * max(f.W * 0.26, f.W * 0.24 + 0.5) + 0.6, 2 * max(f.H * 0.2, f.W * 0.24 + 0.5) + 0.6), badge,
               kind="flourish", about="the cream oval and its red ring on the lid", **ink)
        s = f.W * 0.2
        f.slot("burger", (cx, cy + f.H * 0.03 + s * 0.13, s * 1.19 + 0.6, s * 0.98 + 0.6), lambda: _burger(f, cx, cy + f.H * 0.03, s, ink),
               kind="picture", about="the burger drawn on the lid", **ink)
        brand = d.get("brand", "BIG BITE")
        f.slot("logo", text_box(brand, (cx, cy - f.H * 0.13), f.H * 0.05, font="bungee"),
               lambda: f.text(brand, (cx, cy - f.H * 0.13), f.H * 0.05, font="bungee", color=red, **ink),
               about="the brand under the burger", **ink)


def kraft(f, d, rng):
    """Brown board: its fibres and flutes, a stamped mark on the face that shows."""
    ink = dict(rough=0.9, metal=0.0)
    paper_base(f, d.get("color", "#b78d5c"), fibres=1.4, seed=int(rng.integers(1000)), tint="#9c7346")
    f.stripes(3.2, 0.5, angle=0, height=0.05, alpha=0.6)
    if d.get("part") in (d.get("face"), "lid_top"):
        dark = d.get("stamp", "#5a2a18")
        cx, cy = f.W / 2, f.H * 0.45
        R = min(f.W, f.H) * 0.18
        brand, tag = d.get("brand", "NONNA'S"), d.get("tagline", "PIZZA AL TAGLIO")

        def stamped():
            f.ring(cx, cy, R, R * 0.07, color=dark, alpha=0.85, **ink)
            f.text(brand, (cx, cy + R * 0.12), R * 0.34, font="lobster", color=dark, alpha=0.85, **ink)
            f.text(tag, (cx, cy - R * 0.42), R * 0.14, font="bebas", tracking=0.25, color=dark, alpha=0.85, **ink)
        box = union((cx, cy, R * 2.07 + 0.6, R * 2.07 + 0.6), text_box(brand, (cx, cy + R * 0.12), R * 0.34, font="lobster"),
                    text_box(tag, (cx, cy - R * 0.42), R * 0.14, font="bebas", tracking=0.25))
        f.slot("stamp", box, stamped, kind="stamp", about="the shop's mark stamped on the lid", alpha=0.85, **ink)


# ---- wood and lacquer ---------------------------------------------------------------------------------------------------

def wood_grain(f, d, rng):
    """Wood along the island's length: growth rings as bands of early and late wood bent by the grain's wander, fine
    pores in the relief, a satin oil finish."""
    from . import noise as Nn
    X, Y = f.grid()
    base = P.rgb(d.get("color", "#8a5a36"))
    dark = base * 0.62
    light = np.clip(base * 1.22, 0, 1)
    off = rng.uniform(-50, 50, 2)
    wander = Nn.fbm3(np.stack([X / 60.0 + off[0], Y / 12.0, np.full_like(X, off[1])], -1), int(rng.integers(1000)), 3)
    rings = (Y + 6.0 * wander) / float(d.get("ring", 2.2))
    band = 0.5 + 0.5 * np.sin(rings * 2 * math.pi) ** 3
    fleck = Nn.fbm3(np.stack([X / 8.0, Y / 0.6, np.full_like(X, off[0])], -1), int(rng.integers(1000)), 2) * 0.5 + 0.5
    t = np.clip(band * 0.75 + fleck * 0.25, 0, 1)[..., None]
    col = light[None, None] * (1 - t) + dark[None, None] * t
    pores = Nn.fbm3(np.stack([X / 3.0, Y / 0.18, np.full_like(X, off[1])], -1), int(rng.integers(1000)), 2)
    f.lay_island(np.ones_like(X), color=col.astype(np.float32), rough=np.clip(0.45 + 0.15 * t[..., 0], 0, 1).astype(np.float32),
                 metal=0.0, height=(pores * 0.015 - 0.01 * t[..., 0]).astype(np.float32))


def lacquer(f, d, rng):
    """Lacquered chopsticks: deep red (or black) with a soft gloss, gold bands and a scatter of petals near the top."""
    base = d.get("color", "#7a1f1a")
    gold = d.get("accent", "#c9a24a")
    f.fill(color=base, rough=0.18, metal=0.0)
    f.gradient(P.mix(base, "#000000", 0.35), base, angle=90, t0=0.0, t1=0.4, rough=0.18, metal=0.0)

    def bands():
        for y in (f.H * 0.72, f.H * 0.74):
            f.rect(0, y, f.W, 0.8, color=gold, rough=0.25, metal=0.9)
    f.slot("bands", (f.W / 2, f.H * 0.73 + 0.4, f.W, f.H * 0.02 + 1.4), bands, kind="flourish", about="the two gold bands",
           rough=0.25, metal=0.9)

    def petals():
        for _ in range(int(d.get("petals", 10))):
            cx, cy = rng.uniform(0, f.W), rng.uniform(f.H * 0.78, f.H * 0.97)
            s = rng.uniform(0.8, 1.4)
            for k in range(5):
                a = k * 2 * math.pi / 5 + rng.uniform(0, 1)
                f.ellipse(cx + math.cos(a) * s, cy + math.sin(a) * s, s * 0.7, s * 0.45, rot=math.degrees(a), color="#f2c6cf", rough=0.3)
            f.ellipse(cx, cy, s * 0.35, color=gold, rough=0.3, metal=0.8)
    f.slot("petals", (f.W / 2, f.H * 0.875, f.W, f.H * 0.19 + 5.0), petals, kind="flourish", about="the petals scattered above the bands",
           rough=0.3)


# ---- glazes ------------------------------------------------------------------------------------------------------------

def glaze(f, d, rng):
    """A ceramic glaze: its colour and gloss, pooling darker toward the foot, a faint crackle; glass when `clear`."""
    from . import noise as Nn
    c = P.rgb(d.get("glaze", "#ece7dc"))
    if d.get("clear"):
        f.fill(color=c, rough=0.04, opacity=0.1 if d.get("part") != "lip" else 0.3)
        return
    f.fill(color=c, rough=0.12, metal=0.0)
    X, Y = f.grid()
    pool = np.clip(1 - Y / max(f.H, 1e-6), 0, 1) ** 3 if d.get("part") == "outside" else np.zeros_like(X)
    f.lay_island(np.ones_like(X), color=(c[None, None] * (1 - 0.18 * pool[..., None])).astype(np.float32))
    if d.get("crackle", 0.4):
        f1, f2, _ = Nn.cells3(np.stack([X / 3.0, Y / 3.0, np.full_like(X, 1.7)], -1), int(rng.integers(1000)))
        edge = N_edge(f2 - f1, 0.05 * 3.0)
        f.lay_island(edge * float(d.get("crackle", 0.4)) * 0.5, color=(c * 0.7).astype(np.float32), height=-0.004, add_height=True)
    if d.get("rim"):
        if d.get("part") == "outside":
            f.slot("rim", (f.W / 2, f.H - 1.6, f.W, 3.2), lambda: f.rect(0, f.H - 3, f.W, 3, color=d["rim"], rough=0.15), kind="flourish",
                   about="the coloured line round the rim", rough=0.15)


def N_edge(gap, w):
    return np.clip(1 - gap / max(w, 1e-9), 0, 1)


def sometsuke(f, d, rng):
    """Blue and white: cobalt under a clear glaze: a band of seigaiha waves round the outside, rings at lip and foot."""
    glaze(f, dict(d, glaze=d.get("glaze", "#f1efe8"), crackle=0.2), rng)
    blue = d.get("accent", "#2b4a8c")
    ink = dict(rough=0.12, metal=0.0)
    part = d.get("part")
    if part == "outside":
        f.slot("line_lip", (f.W / 2, f.H - 4.05, f.W, 1.3), lambda: f.rect(0, f.H - 4.5, f.W, 0.9, color=blue, **ink), kind="flourish",
               about="the blue line under the lip", **ink)
        f.slot("line_foot", (f.W / 2, 2.35, f.W, 1.1), lambda: f.rect(0, 2.0, f.W, 0.7, color=blue, **ink), kind="flourish",
               about="the blue line round the foot", **ink)
        r = f.H * 0.09
        rows = int((f.H * 0.55) / (r * 0.5))

        def waves():
            for j in range(rows):
                for i in range(int(f.W / (2 * r)) + 2):
                    cx = i * 2 * r + (r if j % 2 else 0)
                    cy = f.H * 0.25 + j * r * 0.5
                    for k in range(3):
                        f.ring(cx, cy, r * (0.9 - 0.27 * k), r * 0.07, color=blue, alpha=0.9, **ink)
        y0, y1 = f.H * 0.25 - r * 0.94 - 0.2, f.H * 0.25 + (rows - 1) * r * 0.5 + r * 0.94 + 0.2
        f.slot("waves", (f.W / 2, (y0 + y1) / 2, f.W, y1 - y0), waves, kind="pattern", about="the band of blue waves (seigaiha)", **ink)
    elif part == "inside":
        f.slot("line_lip", (f.W / 2, f.H - 2.6, f.W, 1.2), lambda: f.rect(0, f.H - 3.0, f.W, 0.8, color=blue, **ink), kind="flourish",
               about="the blue line inside the lip", **ink)


def speckled(f, d, rng):
    """Stoneware: an oatmeal glaze over clay full of iron, which comes through as dark specks."""
    glaze(f, dict(d, glaze=d.get("glaze", "#d9cdb4"), crackle=0.0), rng)
    for _ in range(int(f.W * f.H * 0.02)):
        f.ellipse(rng.uniform(0, f.W), rng.uniform(0, f.H), rng.uniform(0.12, 0.45), color="#4a3424", rough=0.2, alpha=rng.uniform(0.5, 0.9))


def jar_label(f, d, rng):
    """A jar's paper label: a cream ground, a red border, the contents in a brush-like hand."""
    paper_base(f, d.get("paper", "#efe6d0"), seed=int(rng.integers(1000)))
    red = d.get("accent", "#a8332a")
    ink = dict(rough=0.8, metal=0.0)
    f.slot("line_foot", (f.W / 2, 2.0, f.W, 1.4), lambda: f.rect(0, 1.5, f.W, 1.0, color=red, **ink), kind="flourish",
           about="the red line along its foot", **ink)
    f.slot("line_top", (f.W / 2, f.H - 2.0, f.W, 1.4), lambda: f.rect(0, f.H - 2.5, f.W, 1.0, color=red, **ink), kind="flourish",
           about="the red line along its top", **ink)
    mid = f.W / 2
    brand, sub = d.get("brand", "梅干し"), d.get("sub", "UMEBOSHI · 2026")
    f.slot("logo", text_box(brand, (mid, f.H * 0.55), f.H * 0.32, font="gothic_jp"),
           lambda: f.text(brand, (mid, f.H * 0.55), f.H * 0.32, font="gothic_jp", color="#2a1a14", **ink),
           about="what's in it, big in the middle", **ink)
    f.slot("sub", text_box(sub, (mid, f.H * 0.2), f.H * 0.09, font="serif"),
           lambda: f.text(sub, (mid, f.H * 0.2), f.H * 0.09, font="serif", color=red, **ink),
           kind="text", about="the line under it", **ink)


def rx_label(f, d, rng):
    """A pharmacy's label: its name and cross, the Rx number, the patient, the medicine and its strength, how to take
    it, the count, the date, the doctor; a coloured warning sticker beside it. Every name made up."""
    paper_base(f, d.get("paper", "#f6f4ee"), fibres=0.5, seed=int(rng.integers(1000)))
    ink, blue = d.get("ink", "#1f1f22"), d.get("accent", "#1f5fa8")
    pi = dict(rough=0.75, metal=0.0)
    W, H = f.W, f.H
    x0 = W * 0.22                          # the front of the bottle is the sticker's middle
    f.rect(0, H - 9.5, W * 0.75, 9.5, color=blue, **pi)
    pharmacy = d.get("pharmacy", "HOLLOW CREEK PHARMACY")

    def logo():
        f.rect(x0, H - 7.8, 1.6, 6.0, color="#ffffff", **pi)
        f.rect(x0 - 2.2, H - 5.6, 6.0, 1.6, color="#ffffff", **pi)
        f.text(pharmacy, (x0 + 6, H - 4.8), 2.6, font="archivo", anchor="left", color="#ffffff", fit=W * 0.46, **pi)
    f.slot("logo", union((x0 + 0.8, H - 4.8, 6.8, 6.8), text_box(pharmacy, (x0 + 6, H - 4.8), 2.6, font="archivo", anchor="left", fit=W * 0.46)),
           logo, about="the pharmacy's cross and name on the blue band", **pi)
    y = H - 13
    f.text(f"Rx# {d.get('rx', '0413-2278')}    {d.get('date', '10/14/26')}", (x0, y), 1.9, font="mono", anchor="left", color=ink, **pi)
    y -= 4.2
    f.text(d.get("patient", "MORI, KAEDE"), (x0, y), 2.6, font="archivo", anchor="left", color=ink, fit=W * 0.48, **pi)
    y -= 5.2
    f.text(d.get("drug", "SOMNIRAL 10 MG TABLETS"), (x0, y), 2.4, font="archivo", anchor="left", color=ink, fit=W * 0.5, **pi)
    y -= 4.4
    for ln in (d.get("directions") or "TAKE 1 TABLET BY MOUTH\nAT BEDTIME. DO NOT TAKE MORE\nTHAN ONE IN A NIGHT.").replace("\\n", "\n").split("\n"):
        f.text(ln, (x0, y), 1.7, font="mono", anchor="left", color=ink, fit=W * 0.5, **pi)
        y -= 3.0
    y -= 1.0
    f.text(f"QTY: {d.get('qty', 30)}   REFILLS: {d.get('refills', 0)}   DR. {d.get('doctor', 'H. SATO')}", (x0, y), 1.5, font="mono", anchor="left",
           color=ink, fit=W * 0.5, **pi)
    # the warning sticker
    wx = W * 0.76
    warn = (d.get("warning") or "MAY CAUSE\nDROWSINESS\n\nDO NOT\nDRINK\nALCOHOL").replace("\\n", "\n").split("\n")

    def warning():
        f.rect(wx, H * 0.18, W * 0.16, H * 0.64, r=1.2, color=d.get("warning_color", "#f2b51f"), **pi)
        for i, ln in enumerate(warn):
            f.text(ln, (wx + W * 0.08, H * 0.74 - i * 3.6), 1.9, font="archivo", color=ink, fit=W * 0.14, **pi)
    box = union((wx + W * 0.08, H * 0.5, W * 0.16 + 0.6, H * 0.64 + 0.6),
                *[b for b in (_box(P.text_polys(ln, "archivo", 1.9, fit=W * 0.14), 0.3, (wx + W * 0.08, H * 0.74 - i * 3.6))
                              for i, ln in enumerate(warn)) if b])
    f.slot("warning", box, warning, kind="picture", about="the warning sticker beside it", **pi)
    _barcode(f, W * 0.04, 2.2, W * 0.14, 4.0, rng, color=ink)


# ---- the occult: talismans, ema, omamori ------------------------------------------------------------------------------

_EMS = {}


def _em(font):
    """A kanji's height in the font at the text size 1 (so a column of them can be sized by the character, not by H)."""
    if font not in _EMS:
        ps = P.text_polys("国", font, 1.0)
        ys = np.concatenate([q[:, 1] for q in ps]) if ps else np.array([0.0, 1.0])
        _EMS[font] = max(ys.max() - ys.min(), 1e-3)
    return _EMS[font]


def _tate(s, x, y_top, size, rng, font="brush_jp", gap=1.1, jitter=0.05):
    """tate's layout: each character's outlines where the brush puts it (its unevenness drawn from rng now, so a slot
    that's swapped leaves what comes after it as it was), and the column's foot."""
    k = 1.0 / _em(font)
    y, cx = y_top - size / 2, x
    glyphs = []
    for ch in s:
        if ch == "\n":
            cx -= size * 1.25
            y = y_top - size / 2
            continue
        if ch in " 　":
            y -= size * gap * 0.6
            continue
        sz = size * (1 + rng.uniform(-jitter, jitter))
        ps = P.text_polys(ch, font, sz * k, rot=rng.uniform(-40, 40) * jitter)
        if ps:
            allp = np.concatenate(ps)
            c = (allp.min(0) + allp.max(0)) / 2
            small = ch in "ぁぃぅぇぉっゃゅょァィゥェォッャュョ"
            off = np.array([cx + rng.uniform(-1, 1) * size * jitter, y + rng.uniform(-1, 1) * size * jitter * 0.5])
            glyphs.append([q - c + off + ((size * 0.15, size * 0.15) if small else (0, 0)) for q in ps])
        y -= size * gap
    return glyphs, y + size * gap - size / 2


def _brush(f, glyphs, **props):
    """Characters laid out by _tate, filled one after another."""
    for g in glyphs:
        f.fill_polys(g, **props)


def tate_slot(f, name, s, x, y_top, size, rng, about, kind="text", font="brush_jp", gap=1.1, jitter=0.05, **ink):
    """tate as a slot: the column brushed in `ink` (its colour and the rest), or your picture in its box. Returns the
    foot."""
    glyphs, foot = _tate(s, x, y_top, size, rng, font, gap, jitter)
    f.slot(name, on(f, _glyphs_box(glyphs, 0.5, (x, y_top), size)), lambda: _brush(f, glyphs, **ink), kind=kind, about=about,
           **{k: v for k, v in ink.items() if k != "color"})
    return foot


def tate(f, s, x, y_top, size, rng, font="brush_jp", gap=1.1, jitter=0.05, **props):
    """Words written down a column (tategaki), right to left over columns at a newline: each character `size` mm tall,
    centred on x, a brush's unevenness (each a little off its place, turned, bigger or smaller). Returns the foot."""
    glyphs, foot = _tate(s, x, y_top, size, rng, font, gap, jitter)
    _brush(f, glyphs, **props)
    return foot


def stamp(f, cx, cy, size, chars, rng, color="#b8281c", shape="square", white=True, rot=0.0, ink=0.85, seed=None):
    """A seal pressed in vermilion: a square (or round) of ink, its characters cut out of it in white (hakubun) or
    standing in red inside a red border (shubun); laid unevenly, the paper showing through where the stamp missed
    (`seed` for that unevenness, else drawn from rng)."""
    from . import noise as Nn
    h = size / 2
    if shape == "round":
        outer = [P.ellipse_poly(cx, cy, h, h)]
        rim = [P.ellipse_poly(cx, cy, h * 0.86, h * 0.86)]
        inner_rim = [P.ellipse_poly(cx, cy, h * 0.8, h * 0.8)]
    else:
        outer = [P.rrect_poly(cx - h, cy - h, size, size, size * 0.06)]
        rim = [P.rrect_poly(cx - h * 0.86, cy - h * 0.86, size * 0.86, size * 0.86, size * 0.04)]
        inner_rim = [P.rrect_poly(cx - h * 0.8, cy - h * 0.8, size * 0.8, size * 0.8, size * 0.035)]
    n = len(chars)
    cols = 1 if n <= 2 else 2
    rows = int(math.ceil(n / cols))
    cell = size * 0.76 / max(rows, cols)
    k = 1.0 / _em("brush_jp")
    polys = []
    for i, ch in enumerate(chars):
        col, row = i // rows, i % rows                      # read down the right column first
        px = cx + (cols - 1) * cell / 2 - col * cell if cols > 1 else cx
        py = cy + (rows - 1) * cell / 2 - row * cell
        ps = P.text_polys(ch, "brush_jp", cell * 0.86 * k)
        if ps:
            allp = np.concatenate(ps)
            c = (allp.min(0) + allp.max(0)) / 2
            polys += [q - c + (px, py) for q in ps]
    if rot:
        a = math.radians(rot)
        R2 = np.array([[math.cos(a), -math.sin(a)], [math.sin(a), math.cos(a)]])
        turn = lambda ps: [((q - (cx, cy)) @ R2.T) + (cx, cy) for q in ps]
        outer, rim, inner_rim, polys = turn(outer), turn(rim), turn(inner_rim), turn(polys)
    cov = f.cov_of(outer)
    ring = np.clip(f.cov_of(rim) - f.cov_of(inner_rim), 0, 1)
    ch_cov = f.cov_of(polys) if polys else np.zeros_like(cov)
    if white:                       # hakubun: a red square, its characters and an inner line cut out of it
        ink_cov = cov * (1 - ring) * (1 - ch_cov)
    else:                           # shubun: red characters inside a red border, the paper between them
        ink_cov = np.clip(np.clip(cov - f.cov_of(rim), 0, 1) + ch_cov, 0, 1)
    X, Y = f.grid()
    seed = int(rng.integers(1000)) if seed is None else seed
    g = Nn.fbm3(np.stack([X / 1.1, Y / 1.1, np.full_like(X, seed * 0.13)], -1), seed, 3)
    pressed = np.clip((g + 0.55) * 2.2, 0, 1) * np.clip(0.75 + 0.6 * Nn.fbm3(np.stack([X / 9, Y / 9, np.full_like(X, 2.0)], -1), seed + 1, 2), 0, 1)
    f.lay_island((ink_cov * pressed * ink).astype(np.float32), color=color, rough=0.78, height=0.002)


def stamp_slot(f, name, cx, cy, size, chars, rng, about, rot=0.0, shape="square", **kw):
    """stamp as a slot, its unevenness drawn now; its box round it as it's turned."""
    seed = int(rng.integers(1000))
    a = math.radians(rot)
    ext = size * (abs(math.cos(a)) + abs(math.sin(a))) if shape != "round" else size
    f.slot(name, on(f, (cx, cy, ext + 0.6, ext + 0.6)), lambda: stamp(f, cx, cy, size, chars, rng, rot=rot, shape=shape, seed=seed, **kw),
           kind="stamp", about=about, rough=0.78, height=0.002)


def ofuda(f, d, rng):
    """An ofuda (a paper talisman, a seal against what's on the other side): washi, its words brushed down the middle in
    sumi, the smaller lines beside it, a vermilion seal stamped at its head and another over the words; old ones
    yellowed and foxed (`age_tint`). Fields: text, side (two lines: right, left), seal (its characters), seal2, border."""
    seed = int(rng.integers(1000))
    paper_base(f, d.get("paper", "#efe8d6"), fibres=1.8, seed=seed, tint=d.get("age_tint"))
    if d.get("page") == 2:
        return
    W, H = f.W, f.H
    ink = dict(color=d.get("ink", "#17120f"), rough=0.62, height=0.003)
    red = d.get("seal_color", "#b8281c")
    if d.get("border", True):
        def border():
            f.line([(3, 3), (W - 3, 3), (W - 3, H - 3), (3, H - 3)], 0.7, closed=True, alpha=0.9, **ink)
            f.line([(4.6, 4.6), (W - 4.6, 4.6), (W - 4.6, H - 4.6), (4.6, H - 4.6)], 0.3, closed=True, alpha=0.8, **ink)
        f.slot("border", (W / 2, H / 2, W - 4.5, H - 4.5), border, kind="flourish", about="the double line framing it",
               rough=0.62, height=0.003)
    seal = d.get("seal", "封印")
    s_top = W * 0.56
    top = H - 8
    if seal:
        rot = rng.uniform(-3, 3)
        stamp_slot(f, "seal", W / 2, H - 7 - s_top / 2, s_top, seal, rng, "the vermilion seal at its head", rot=rot, color=red)
        top = H - 10 - s_top
    main = d.get("text", "悪霊退散")
    n = max(1, len(main.replace("\n", "")))
    size = min(W * 0.52, (top - 12) / (n * 1.12))
    foot = tate_slot(f, "words", main, W / 2, top, size, rng, "the words brushed down its middle", gap=1.12, **ink)
    side = d.get("side", ["急急如律令", "鎮宅霊符"])
    if side:
        ss = min(W * 0.14, (top - 30) / (max(len(x) for x in side) * 1.15))
        mid = (top + foot) / 2
        for name, x, line in zip(("side_right", "side_left"), (W * 0.83, W * 0.17), side):
            tate_slot(f, name, line, x, mid + len(line) * ss * 1.15 / 2, ss, rng,
                      "the smaller line on its right" if name == "side_right" else "the smaller line on its left", gap=1.15, **ink)
    s2 = d.get("seal2", "護")
    if s2:
        x2 = W / 2 + rng.uniform(-2, 2)
        rot2 = rng.uniform(-8, 8)
        stamp_slot(f, "seal_2", x2, foot + size * 1.4, W * 0.34, s2, rng, "the round seal stamped over the words", rot=rot2,
                   shape="round", color=red, ink=0.8)


def ema(f, d, rng):
    """An ema (a wooden votive plaque): plain hinoki, the front painted (the year's animal as a red disc and a gold
    mark, or a torii) with the shrine's words, the back a wish brushed in sumi (`wish`, `name`). `part`: front or back."""
    wood_grain(f, dict(d, color=d.get("wood", "#d8b98a"), ring=1.6), rng)
    W, H = f.W, f.H
    ink = dict(color=d.get("ink", "#1a1410"), rough=0.6, height=0.002)
    if d.get("part") == "back":
        wish = d.get("wish", "家内安全\n無病息災")
        cols = wish.split("\n")
        size = min(W / (len(cols) * 1.8 + 1), (H * 0.72) / max(len(c) for c in cols) / 1.12)
        x0 = W / 2 + (len(cols) - 1) * size * 0.65
        tate_slot(f, "wish", wish, x0, H * 0.78, size, rng, "the wish brushed on its back", jitter=0.09, **ink)
        if d.get("name"):
            tate_slot(f, "name", d["name"], W * 0.18, H * 0.38, size * 0.55, rng, "the name signed under the wish", jitter=0.08, **ink)
        return
    paint = dict(rough=0.45, height=0.004)
    motif = d.get("motif", "torii")
    if motif == "torii":
        red = d.get("color", "#b3261e")
        cx, base, tw = W / 2, H * 0.2, W * 0.56

        def torii():
            f.poly([(cx - tw * 0.62, H * 0.62), (cx + tw * 0.62, H * 0.62), (cx + tw * 0.56, H * 0.67), (cx - tw * 0.56, H * 0.67)], color="#1c1715", **paint)
            f.rect(cx - tw * 0.56, H * 0.56, tw * 1.12, H * 0.06, color=red, **paint)
            f.rect(cx - tw * 0.5, H * 0.47, tw, H * 0.035, color=red, **paint)
            for sx in (-1, 1):
                f.poly([(cx + sx * tw * 0.36 - 2.2, base), (cx + sx * tw * 0.36 + 2.2, base), (cx + sx * tw * 0.33 + 1.9, H * 0.56), (cx + sx * tw * 0.33 - 1.9, H * 0.56)],
                       color=red, **paint)
            f.rect(cx - 3, H * 0.505, 6, H * 0.055, color=red, **paint)
        f.slot("motif", (cx, H * 0.435, tw * 1.24 + 0.6, H * 0.47 + 0.6), torii, kind="picture", about="the red torii painted on the front",
               **paint)
    else:
        f.slot("motif", (W / 2, H * 0.45, W * 0.54 + 0.6, W * 0.54 + 0.6),
               lambda: f.ellipse(W / 2, H * 0.45, W * 0.27, color=d.get("color", "#b3261e"), **paint), kind="picture",
               about="the red disc painted on the front", **paint)
        tate_slot(f, "mark", d.get("mark", "絆"), W / 2, H * 0.45 + W * 0.17, W * 0.34, rng, "the gold mark on the disc", kind="logo",
                  color="#e8c14a", rough=0.35, metal=0.6, height=0.004)
    words = d.get("text", "奉納")
    tate_slot(f, "words", words, W * 0.84, H * 0.62, W * 0.1, rng, "the offering's words down its right", jitter=0.03, **ink)
    tate_slot(f, "shrine", d.get("shrine", "神社"), W * 0.16, H * 0.5, W * 0.08, rng, "the shrine's name down its left", jitter=0.03,
              **ink)


def brocade(f, d, rng):
    """Brocade silk (an omamori's): a woven ground in its colour, a pattern in gold thread (seigaiha waves, kikkō
    hexagons, asanoha), the weave's tooth in the relief; on its front, the words embroidered down the middle
    (`text`, `name`) in raised thread. `part`: front, back or edge."""
    from . import noise as Nn
    X, Y = f.grid()
    base = P.rgb(d.get("color", "#8e1b26"))
    gold = d.get("thread", "#d9b45a")
    f.fill(color=base, rough=0.55)
    weave = (np.sin(X * 2 * math.pi / 0.5) * np.sin(Y * 2 * math.pi / 0.5)).astype(np.float32)
    f.lay_island(np.ones_like(X), height=(weave * 0.006).astype(np.float32))
    thread = dict(color=gold, rough=0.3, metal=0.55, height=0.012)
    pat = d.get("pattern", "seigaiha")

    def woven():
        if pat == "seigaiha":
            r = float(d.get("scale", 5.0))
            for j in range(int(f.H / (r * 0.5)) + 3):
                for i in range(int(f.W / (2 * r)) + 2):
                    cx, cy = i * 2 * r + (r if j % 2 else 0), j * r * 0.5 - r
                    for k in range(3):
                        f.ring(cx, cy, r * (0.92 - 0.28 * k), r * 0.08, alpha=0.75, **thread)
        elif pat == "kikko":
            r = float(d.get("scale", 4.0))
            for j in range(int(f.H / (r * 1.5)) + 2):
                for i in range(int(f.W / (r * 1.732)) + 2):
                    cx, cy = i * r * 1.732 + (r * 0.866 if j % 2 else 0), j * r * 1.5
                    hexa = [(cx + r * math.cos(math.radians(30 + 60 * k)), cy + r * math.sin(math.radians(30 + 60 * k))) for k in range(6)]
                    f.line(hexa, r * 0.09, closed=True, alpha=0.8, **thread)
        else:
            f.dots(float(d.get("scale", 3.0)), 0.4, alpha=0.8, **thread)
    f.slot("pattern", (f.W / 2, f.H / 2, f.W, f.H), woven, kind="pattern",
           about={"seigaiha": "the gold waves (seigaiha) woven all over", "kikko": "the gold hexagons (kikkō) woven all over"}.get(
               pat, "the gold dots woven all over"), rough=0.3, metal=0.55, height=0.012)
    if d.get("part") == "front":
        plate = d.get("plate", "#f2ead6")
        w = f.W * 0.36
        glyphs, _foot = _tate(d.get("text", "御守"), f.W / 2, f.H * 0.8, w * 0.72, rng, font="brush_jp", jitter=0.02)

        def words():
            f.rect(f.W / 2 - w / 2, f.H * 0.12, w, f.H * 0.72, r=1.0, color=base * 0.85, rough=0.6)
            _brush(f, glyphs, color=plate, rough=0.35, metal=0.15, height=0.02)
        f.slot("words", union((f.W / 2, f.H * 0.48, w + 0.4, f.H * 0.72 + 0.4), _glyphs_box(glyphs, 0.5, (f.W / 2, f.H * 0.8), w * 0.72)),
               words, kind="text", about="its name embroidered down the front, on a darker panel", rough=0.35, metal=0.15, height=0.02)
    elif d.get("part") == "back":
        tate_slot(f, "name", d.get("name", "厄除"), f.W / 2, f.H * 0.72, f.W * 0.2, rng, "what it's for, embroidered on the back",
                  jitter=0.02, color=gold, rough=0.3, metal=0.5, height=0.015)


def mix_hex(a, b, t):
    return P.mix(a, b, t)


def plain(f, d, rng):
    f.fill(color=(d.get("colors") or ["#c7cacc"])[0], rough=0.3, metal=1.0)


DESIGNS = {"soda": soda, "energy": energy, "beer": beer, "coffee_can": coffee_can, "water": water, "coffee_cup": coffee_cup,
           "sleeve": sleeve, "iced": iced, "newspaper": newspaper, "newsprint": newsprint, "napkin": napkin, "fries": fries,
           "receipt": receipt, "note": note, "paper": paper, "card_plain": card_plain, "burger_box": burger_box, "kraft": kraft,
           "wood_grain": wood_grain, "lacquer": lacquer, "glaze": glaze, "sometsuke": sometsuke, "speckled": speckled,
           "jar_label": jar_label, "rx_label": rx_label, "plain": plain, "ofuda": ofuda, "ema": ema, "brocade": brocade}


def draw(f, art, seed, default="plain"):
    """A recipe's `art` on a frame: a design by name with its fields, or a picture of your own."""
    from .noise import rng
    art = art or {}
    if art.get("image"):
        f.image(art["image"], **INK)
        return
    fn = DESIGNS.get(art.get("design", default))
    if fn is None:
        raise ValueError(f"design {art.get('design')!r}: one of {', '.join(DESIGNS)}")
    fn(f, art, rng(seed, "art", art.get("design", default)))
