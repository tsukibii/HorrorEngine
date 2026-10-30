"""Label designs: a few fields (a brand, a line under it, colours, a size) drawn as a label is laid out, on a Frame in
millimetres. A design is a function (frame, fields, rng); `DESIGNS` names them, and a recipe's `art` picks one:
{"design": "soda", "brand": "KAZE", "flavour": "ORANGE SODA", "colors": ["#e8620f", "#ffa13d"]}. Every brand here is
made up. `art: {"image": "my_label.png"}` lays your own picture over the island instead (uv_template's layout)."""
import math

import numpy as np

from . import paint as P

INK = dict(rough=0.28, metal=0.4)          # printed ink over metal: still a little metallic
WHITE_INK = dict(rough=0.35, metal=0.12)   # the opaque white base under bright colours


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
    y1 = f.H if y1 is None else y1
    for _ in range(count):
        r = rng.uniform(rmin, rmax)
        f.ring(rng.uniform(0, f.W), rng.uniform(y0, y1), r, max(r * 0.18, 0.3), color=color, alpha=alpha, **INK)


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
    _bubbles(f, rng, int(d.get("bubbles", 70)), "#ffffff", 0.35, 0.8, 4.5)
    mid = f.W / 2
    brand = d.get("brand", "KAZE")
    f.rect(0, f.H * 0.86, f.W, f.H * 0.035, color=accent, **INK)
    f.rect(0, f.H * 0.06, f.W, f.H * 0.03, color=accent, **INK)
    f.text(brand, (mid, f.H * 0.56), f.H * 0.26, font=d.get("font", "anton"), color="#ffffff", fit=f.W * 0.34,
           stroke=(accent, 1.4), shadow=("#000000", 0.8, -1.0, 1.2, 0.3), **WHITE_INK)
    f.text(d.get("flavour", "ORANGE SODA"), (mid, f.H * 0.31), f.H * 0.065, font="bebas", tracking=0.18, color="#fff7e6", **WHITE_INK)
    f.text(d.get("volume", "330 ml"), (mid, f.H * 0.16), f.H * 0.035, font="archivo", color="#ffffff", **WHITE_INK)
    _fruit(f, mid + f.W * 0.2, f.H * 0.62, f.H * 0.09, d.get("fruit", "#f08a1c"))
    # the back: small print and a barcode
    _greek(f, 4, f.H * 0.7, 40, 8, 1.4, "#ffffff", rng)
    _barcode(f, f.W - 34, f.H * 0.3, 22, 9, rng)
    f.text(d.get("tagline", "Fresh & Fizzy"), (mid - f.W * 0.2, f.H * 0.72), f.H * 0.06, font="pacifico", rot=10, color="#fff2c0", **WHITE_INK)


def energy(f, d, rng):
    c0 = (d.get("colors") or ["#0c0c0e"])[0]
    lines = d.get("lines") or ["#f6d21e", "#22b8f0"]
    f.fill(color=c0, rough=0.28, metal=0.65)
    # scribbles: thin white strokes all over
    for _ in range(int(d.get("scribbles", 40))):
        x, y = rng.uniform(0, f.W), rng.uniform(0, f.H)
        pts = [(x, y)]
        for _k in range(rng.integers(2, 5)):
            x += rng.uniform(-6, 6)
            y += rng.uniform(-6, 6)
            pts.append((x, y))
        f.line(pts, rng.uniform(0.2, 0.45), color="#d8d8d8", alpha=0.75, **INK)
    # zigzags across the front
    for i, c in enumerate(lines):
        y0 = f.H * (0.38 + 0.22 * i)
        pts = [(x, y0 + (4 if k % 2 else -4)) for k, x in enumerate(np.linspace(f.W * 0.2, f.W * 0.8, 15))]
        f.line(pts, 1.6, color=c, **WHITE_INK)
    mid = f.W / 2
    f.text(d.get("brand", "VOLTA"), (mid, f.H * 0.5), f.H * 0.42, font=d.get("font", "anton"), rot=90, fit=f.H * 0.8,
           color="#ffffff", stroke=("#000000", 1.0), **WHITE_INK)
    f.text(d.get("flavour", "ENERGY DRINK"), (mid + f.W * 0.11, f.H * 0.5), f.H * 0.05, rot=90, font="bebas", tracking=0.2,
           color=lines[0], **WHITE_INK)
    f.text(d.get("volume", "500 ml"), (mid - f.W * 0.12, f.H * 0.15), f.H * 0.035, font="archivo", color="#ffffff", **WHITE_INK)
    _greek(f, 4, f.H * 0.75, 38, 9, 1.4, "#bdbdbd", rng)
    _barcode(f, f.W - 34, f.H * 0.25, 22, 9, rng)


def beer(f, d, rng):
    c0, c1 = (d.get("colors") or ["#123a6b", "#0a2242"])[:2]
    gold = d.get("accent", "#d7b45a")
    f.gradient(c1, c0, angle=90, **INK)
    f.stripes(3.0, 0.08, angle=0, color=gold, alpha=0.25, **INK)
    mid = f.W / 2
    f.ellipse(mid, f.H * 0.55, f.H * 0.3, f.H * 0.33, color="#f3ead4", **WHITE_INK)
    f.ring(mid, f.H * 0.55, f.H * 0.28, 0.9, color=gold, **INK)
    f.text(d.get("brand", "Kitsune"), (mid, f.H * 0.58), f.H * 0.12, font="lobster", fit=f.H * 0.5, color=c1, **INK)
    f.text(d.get("flavour", "LAGER"), (mid, f.H * 0.42), f.H * 0.05, font="bebas", tracking=0.3, color=c1, **INK)
    f.text(d.get("volume", "350 ml  5% ALC."), (mid, f.H * 0.14), f.H * 0.035, font="archivo", color=gold, **INK)
    _greek(f, 4, f.H * 0.7, 40, 8, 1.3, "#e8e0c8", rng)
    _barcode(f, f.W - 34, f.H * 0.3, 22, 9, rng)


def coffee_can(f, d, rng):
    """A Japanese vending-machine coffee can: a band of colour, the brand big, a cup drawn, 'BLACK' or 'MILK'."""
    c0, c1 = (d.get("colors") or ["#3a2416", "#c8a26a"])[:2]
    f.fill(color=c0, **INK)
    f.rect(0, f.H * 0.32, f.W, f.H * 0.36, color=c1, **INK)
    mid = f.W / 2
    f.text(d.get("brand", "BOSSA"), (mid, f.H * 0.52), f.H * 0.2, font="archivo", fit=f.W * 0.32, color="#ffffff",
           stroke=(c0, 0.8), **WHITE_INK)
    f.text(d.get("flavour", "ブラック"), (mid, f.H * 0.8), f.H * 0.08, font="gothic_jp", color="#ffffff", **WHITE_INK)
    f.text(d.get("sub", "微糖 COFFEE"), (mid, f.H * 0.2), f.H * 0.05, font="gothic_jp", color=c1, **WHITE_INK)
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
    for i in range(3):
        y = f.H * (0.12 + 0.07 * i)
        pts = [(x, y + 1.2 * math.sin(x / 9.0 + i)) for x in np.linspace(-2, f.W + 2, 120)]
        f.line(pts, 0.9, color=mix_hex(blue, "#ffffff", 0.35 + 0.2 * i), **ink)
    mid = f.W / 2
    _mountain(f, mid, f.H * 0.52, f.H * 0.55, f.H * 0.3)
    f.text(d.get("brand", "MIZUHO"), (mid, f.H * 0.38), f.H * 0.14, font=d.get("font", "archivo"), tracking=0.06, color=blue,
           fit=f.W * 0.3, **ink)
    f.text(d.get("flavour", "NATURAL MINERAL WATER"), (mid, f.H * 0.27), f.H * 0.05, font="bebas", tracking=0.2, color="#5a7da8", **ink)
    f.text(d.get("volume", "500 ml"), (mid + f.W * 0.17, f.H * 0.88), f.H * 0.06, font="archivo", color=blue, **ink)
    _greek(f, 4, f.H * 0.8, 46, 10, 1.6, "#6d7f95", rng)
    _barcode(f, f.W - 36, f.H * 0.4, 24, 11, rng)


def coffee_cup(f, d, rng):
    """A takeaway cup: white board, wavy lines round its foot and lip, a small brand mark."""
    ink = dict(rough=0.7, metal=0.0)
    f.fill(color=d.get("paper", "#f6f4ee"), **ink)
    cols = d.get("colors") or ["#3a8fb7", "#e07b39"]
    for i, c in enumerate(cols[:2]):
        for row in range(2):
            y = f.H * (0.06 + 0.05 * row + 0.82 * i)
            pts = [(x, y + 1.3 * math.sin(x / 5.0 + row * 1.7 + i)) for x in np.linspace(-2, f.W + 2, 160)]
            f.line(pts, 0.7, color=c, **ink)
    mid = f.W / 2
    f.text(d.get("brand", "FRESH BREW COFFEE"), (mid, f.H * 0.78), f.H * 0.05, font="archivo", tracking=0.08, color="#3b2a20",
           fit=f.W * 0.3, **ink)
    f.text(d.get("tagline", "careful, the drink is hot"), (mid + f.W * 0.25, f.H * 0.2), f.H * 0.035, font="serif", color="#6b5a4c", **ink)


def sleeve(f, d, rng):
    """A kraft sleeve: corrugated card, a stamped circle with HOT in it, a second stamp round the back."""
    ink = dict(rough=0.9, metal=0.0)
    f.fill(color=d.get("kraft", "#b5895a"), **ink)
    f.stripes(1.8, 0.5, angle=0, height=0.12, alpha=1.0)
    dark = d.get("stamp", "#4a2c18")
    mid = f.W / 2
    for x in (mid, 18.0):
        f.ring(x, f.H * 0.5, f.H * 0.32, 0.8, color=dark, **ink)
        f.text(d.get("sleeve_word", "HOT"), (x, f.H * 0.5), f.H * 0.26, font="archivo", color=dark, **ink)
    f.text("· recyclable ·", (mid + f.W * 0.25, f.H * 0.5), f.H * 0.12, font="serif", color=dark, **ink)


def iced(f, d, rng):
    """An iced-drink cup: white with bubbles in blue, ICE COLD up its side."""
    ink = dict(rough=0.55, metal=0.0)
    f.fill(color="#fbfbfa", **ink)
    blue = d.get("accent", "#2d6fb8")
    for _ in range(int(d.get("bubbles", 90))):
        r = rng.uniform(0.8, 3.6)
        f.ring(rng.uniform(0, f.W), rng.uniform(f.H * 0.08, f.H * 0.92), r, max(0.35, r * 0.15), color=blue, alpha=0.7, **ink)
    mid = f.W / 2
    f.text(d.get("brand", "ICE COLD"), (mid, f.H * 0.55), f.H * 0.16, font="bungee", rot=90, fit=f.H * 0.8, color="#16427a", **ink)
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
        f.text(d.get("title", "The Hollow Creek Herald"), (W / 2, H - m - H * 0.045), H * 0.045, font="fraktur", fit=W - 2 * m, color=ink, **PAPER_INK)
        f.rect(m, H - m - H * 0.085, W - 2 * m, 0.5, color=ink, **PAPER_INK)
        f.text(d.get("dateline", "TUESDAY, OCTOBER 14 · 75 CENTS · LATE EDITION"), (W / 2, H - m - H * 0.098), H * 0.009,
               font="serif", tracking=0.1, color=ink, **PAPER_INK)
        f.rect(m, H - m - H * 0.108, W - 2 * m, 0.25, color=ink, **PAPER_INK)
        top = H - m - H * 0.125
        f.text(d.get("headline", "BRIDGE TO CLOSE\nFOR SIX WEEKS"), (m, top), H * 0.04, font="serif_bold", anchor="left top", fit=W - 2 * m,
               line=1.05, color=ink, **PAPER_INK)
        top -= H * 0.115
        f.text(d.get("deck", "Residents of the east bank face a long way round"), (m, top), H * 0.012, font="serif", anchor="left top",
               color="#3a3834", **PAPER_INK)
        top -= H * 0.03
        # the photo: a soft grey picture, a caption under it
        pw, ph = (W - 2 * m) * 0.55, H * 0.2
        X, Y = f.grid()
        from . import noise as Nn
        inside = ((X > m) & (X < m + pw) & (Y < top) & (Y > top - ph)).astype(np.float32)
        pic = Nn.fbm3(np.stack([X / 30, Y / 30, np.full_like(X, 3.3)], -1), 9, 4) * 0.5 + 0.45 + 0.25 * np.clip((Y - (top - ph)) / ph, 0, 1)
        grey = np.clip(pic, 0.12, 0.85)[..., None] * np.array([0.92, 0.9, 0.86])[None, None]
        f.lay_island(inside, color=grey.astype(np.float32), rough=0.8)
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
        f.text(d.get("section", "CLASSIFIEDS"), (m, H - m), H * 0.022, font="serif_bold", anchor="left top", color=ink, **PAPER_INK)
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
    f.ring(cx, cy, R, R * 0.1, color=red, **ink)
    f.ellipse(cx - R * 0.35, cy + R * 0.25, R * 0.09, color=red, **ink)
    f.ellipse(cx + R * 0.35, cy + R * 0.25, R * 0.09, color=red, **ink)
    f.line([(cx - R * 0.5 + i * R / 12, cy - R * 0.25 - R * 0.28 * math.sin(math.pi * i / 12)) for i in range(13)], R * 0.09, color=red, **ink)
    f.text(d.get("brand", "THANK YOU · HAVE A NICE DAY"), (cx, cy + R * 1.6), R * 0.22, font="archivo", tracking=0.1, color=red,
           fit=f.W * 0.9, **ink)
    f.text(d.get("brand", "THANK YOU · HAVE A NICE DAY"), (cx, cy - R * 1.6), R * 0.22, font="archivo", tracking=0.1, color=red,
           rot=180, fit=f.W * 0.9, **ink)


def fries(f, d, rng):
    """A fries bag: green and white stripes, a red seal with the name on an arc."""
    paper_base(f, "#f6f4ec", fibres=0.8, seed=int(rng.integers(1000)))
    green = d.get("colors", ["#1f8f6a"])[0]
    red = d.get("accent", "#d23a2f")
    ink = dict(rough=0.8, metal=0.0)
    f.stripes(f.W / 9, 0.5, angle=90 if d.get("horizontal") else 0, color=green, **ink)
    cx, cy, R = f.W * 0.5, f.H * float(d.get("seal_y", 0.58)), f.W * 0.26
    f.ellipse(cx, cy, R, color="#fbf8f0", **ink)
    f.ring(cx, cy, R * 0.92, R * 0.06, color=red, **ink)
    words = d.get("brand", "CRISPY FRIES").split()
    f.text(words[0], (cx, cy + R * 0.2), R * 0.32, font="bungee", arc=R * 0.75, color=red, **ink)
    if len(words) > 1:
        f.text(" ".join(words[1:]), (cx, cy - R * 0.28), R * 0.3, font="bungee", color=red, **ink)
    f.text(d.get("tagline", "since 1987"), (cx, cy - R * 0.68), R * 0.12, font="pacifico", color=green, **ink)


def receipt(f, d, rng):
    """A till receipt: thermal paper, monospaced lines, a total, a barcode; it fades where it was handled."""
    paper_base(f, "#f5f4f0", fibres=0.4, seed=int(rng.integers(1000)))
    ink = d.get("ink", "#2a2a2e")
    pi = dict(rough=0.6, metal=0.0)
    y = f.H - 10
    f.text(d.get("brand", "SUNNY MART #0413"), (f.W / 2, y), 3.2, font="mono", color=ink, **pi)
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
    for ln in (d.get("text") or "don't open the door\nwhatever it says").split("\n"):
        f.text(ln, (22 + rng.uniform(-1, 1), y), float(d.get("size", 4.0)), font=font, anchor="left baseline", rot=rng.uniform(-1.2, 1.2),
               fit=f.W - 30, color=ink, **PAPER_INK)
        y -= 8.0 * int(d.get("spacing", 1))


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
    f.dots(5.0, 0.55, hexed=True, color=red, alpha=0.85, **ink)
    f.stripes(9.0, 0.06, angle=45, color=red, alpha=0.35, **ink)
    if d.get("part") == "lid_bottom":
        cx, cy = f.W / 2, f.H / 2
        f.ellipse(cx, cy, f.W * 0.26, f.H * 0.2, color="#fbf8f0", **ink)
        f.ring(cx, cy, f.W * 0.24, 1.0, color=red, **ink)
        _burger(f, cx, cy + f.H * 0.03, f.W * 0.2, ink)
        f.text(d.get("brand", "BIG BITE"), (cx, cy - f.H * 0.13), f.H * 0.05, font="bungee", color=red, **ink)


def kraft(f, d, rng):
    """Brown board: its fibres and flutes, a stamped mark on the face that shows."""
    ink = dict(rough=0.9, metal=0.0)
    paper_base(f, d.get("color", "#b78d5c"), fibres=1.4, seed=int(rng.integers(1000)), tint="#9c7346")
    f.stripes(3.2, 0.5, angle=0, height=0.05, alpha=0.6)
    if d.get("part") in (d.get("face"), "lid_top"):
        dark = d.get("stamp", "#5a2a18")
        cx, cy = f.W / 2, f.H * 0.45
        R = min(f.W, f.H) * 0.18
        f.ring(cx, cy, R, R * 0.07, color=dark, alpha=0.85, **ink)
        f.text(d.get("brand", "NONNA'S"), (cx, cy + R * 0.12), R * 0.34, font="lobster", color=dark, alpha=0.85, **ink)
        f.text(d.get("tagline", "PIZZA AL TAGLIO"), (cx, cy - R * 0.42), R * 0.14, font="bebas", tracking=0.25, color=dark, alpha=0.85, **ink)


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
    for y in (f.H * 0.72, f.H * 0.74):
        f.rect(0, y, f.W, 0.8, color=gold, rough=0.25, metal=0.9)
    for _ in range(int(d.get("petals", 10))):
        cx, cy = rng.uniform(0, f.W), rng.uniform(f.H * 0.78, f.H * 0.97)
        s = rng.uniform(0.8, 1.4)
        for k in range(5):
            a = k * 2 * math.pi / 5 + rng.uniform(0, 1)
            f.ellipse(cx + math.cos(a) * s, cy + math.sin(a) * s, s * 0.7, s * 0.45, rot=math.degrees(a), color="#f2c6cf", rough=0.3)
        f.ellipse(cx, cy, s * 0.35, color=gold, rough=0.3, metal=0.8)


# ---- glazes ------------------------------------------------------------------------------------------------------------

def glaze(f, d, rng):
    """A ceramic glaze: its colour and gloss, pooling darker toward the foot, a faint crackle; glass when `clear`."""
    from . import noise as Nn
    c = P.rgb(d.get("glaze", "#ece7dc"))
    if d.get("clear"):
        f.fill(color=c, rough=0.04, opacity=0.22 if d.get("part") != "lip" else 0.5)
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
            f.rect(0, f.H - 3, f.W, 3, color=d["rim"], rough=0.15)


def N_edge(gap, w):
    return np.clip(1 - gap / max(w, 1e-9), 0, 1)


def sometsuke(f, d, rng):
    """Blue and white: cobalt under a clear glaze: a band of seigaiha waves round the outside, rings at lip and foot."""
    glaze(f, dict(d, glaze=d.get("glaze", "#f1efe8"), crackle=0.2), rng)
    blue = d.get("accent", "#2b4a8c")
    ink = dict(rough=0.12, metal=0.0)
    part = d.get("part")
    if part == "outside":
        f.rect(0, f.H - 4.5, f.W, 0.9, color=blue, **ink)
        f.rect(0, 2.0, f.W, 0.7, color=blue, **ink)
        r = f.H * 0.09
        rows = int((f.H * 0.55) / (r * 0.5))
        for j in range(rows):
            for i in range(int(f.W / (2 * r)) + 2):
                cx = i * 2 * r + (r if j % 2 else 0)
                cy = f.H * 0.25 + j * r * 0.5
                for k in range(3):
                    f.ring(cx, cy, r * (0.9 - 0.27 * k), r * 0.07, color=blue, alpha=0.9, **ink)
    elif part == "inside":
        f.rect(0, f.H - 3.0, f.W, 0.8, color=blue, **ink)


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
    f.rect(0, 1.5, f.W, 1.0, color=red, **ink)
    f.rect(0, f.H - 2.5, f.W, 1.0, color=red, **ink)
    mid = f.W / 2
    f.text(d.get("brand", "梅干し"), (mid, f.H * 0.55), f.H * 0.32, font="gothic_jp", color="#2a1a14", **ink)
    f.text(d.get("sub", "UMEBOSHI · 2026"), (mid, f.H * 0.2), f.H * 0.09, font="serif", color=red, **ink)


def mix_hex(a, b, t):
    return P.mix(a, b, t)


def plain(f, d, rng):
    f.fill(color=(d.get("colors") or ["#c7cacc"])[0], rough=0.3, metal=1.0)


DESIGNS = {"soda": soda, "energy": energy, "beer": beer, "coffee_can": coffee_can, "water": water, "coffee_cup": coffee_cup,
           "sleeve": sleeve, "iced": iced, "newspaper": newspaper, "newsprint": newsprint, "napkin": napkin, "fries": fries,
           "receipt": receipt, "note": note, "paper": paper, "card_plain": card_plain, "burger_box": burger_box, "kraft": kraft,
           "wood_grain": wood_grain, "lacquer": lacquer, "glaze": glaze, "sometsuke": sometsuke, "speckled": speckled,
           "jar_label": jar_label, "plain": plain}


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
