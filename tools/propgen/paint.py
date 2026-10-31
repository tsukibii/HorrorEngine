"""Painting a thing's texture as a designer draws a label: shapes, patterns and text in millimetres on an island of the
texture, each stroke laying down its colour, roughness, metalness and height (ink, emboss) together. numpy only, plus
Blender's own font code for the text's outlines (any .ttf or .otf; ours are in fonts/).

A Canvas holds a texture's maps (y down, row 0 the image's top). A Frame is one island of it in millimetres, y up from
the island's foot, x across (a band's x wraps round: what's drawn over its edge comes back on the other side).
Shapes are polygons filled by the nonzero rule, 4 x 4 samples a pixel."""
import math
import os

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, "fonts")
FONT_FILES = {
    "anton": "Anton-Regular.ttf", "bebas": "BebasNeue-Regular.ttf", "archivo": "ArchivoBlack-Regular.ttf",
    "pacifico": "Pacifico-Regular.ttf", "lobster": "Lobster-Regular.ttf", "fraktur": "UnifrakturMaguntia-Book.ttf",
    "serif": "OldStandard-Regular.ttf", "serif_bold": "OldStandard-Bold.ttf", "typewriter": "SpecialElite-Regular.ttf",
    "marker": "PermanentMarker-Regular.ttf", "mono": "CourierPrime-Regular.ttf", "bungee": "Bungee-Regular.ttf",
    "righteous": "Righteous-Regular.ttf", "rubik": "RubikMonoOne-Regular.ttf", "gothic_jp": "DelaGothicOne-Regular.ttf",
    "brush_jp": "YujiSyuku-Subset.ttf",          # a calligrapher's hand: kana and JIS level 1 kanji (talismans, ema)
}


def rgb(c):
    """'#rrggbb', '#rgb', (r, g, b) 0-1 or 0-255 -> float array (3,) in sRGB 0-1."""
    if isinstance(c, str):
        s = c.lstrip("#")
        if len(s) == 3:
            s = "".join(ch * 2 for ch in s)
        return np.array([int(s[i:i + 2], 16) / 255 for i in (0, 2, 4)])
    c = np.asarray(c, float)[:3]
    return c / 255 if c.max() > 1.0 else c


def mix(a, b, t):
    return rgb(a) * (1 - t) + rgb(b) * t


# ---- coverage ---------------------------------------------------------------------------------------------------------

def coverage(polys, w, h, ss=4, evenodd=False):
    """Polygons (lists of (k, 2) pixel points, x right, y down) filled by the nonzero (or even-odd) rule:
    (y0, x0, cov) with cov the covered fraction of each pixel of their box, or None off the canvas."""
    polys = [np.asarray(p, float) for p in polys if len(p) >= 3]
    if not polys:
        return None
    pts = np.concatenate(polys)
    x0 = int(max(math.floor(pts[:, 0].min()) - 1, 0))
    x1 = int(min(math.ceil(pts[:, 0].max()) + 1, w))
    y0 = int(max(math.floor(pts[:, 1].min()) - 1, 0))
    y1 = int(min(math.ceil(pts[:, 1].max()) + 1, h))
    if x1 <= x0 or y1 <= y0:
        return None
    A = np.concatenate(polys)
    B = np.concatenate([np.roll(p, -1, 0) for p in polys])
    keep = A[:, 1] != B[:, 1]
    ax, ay, bx, by = A[keep, 0], A[keep, 1], B[keep, 0], B[keep, 1]
    dirn = np.where(by > ay, 1.0, -1.0)
    ylo, yhi = np.minimum(ay, by), np.maximum(ay, by)
    W = (x1 - x0) * ss
    out = np.zeros((y1 - y0, x1 - x0), np.float32)
    band = max(1, (1 << 22) // ((W + 1) * ss))
    for b0 in range(y0, y1, band):
        b1 = min(b0 + band, y1)
        Hs = (b1 - b0) * ss
        sel = (yhi > b0) & (ylo < b1)
        if not sel.any():
            continue
        i0 = np.clip(np.ceil((ylo[sel] - b0) * ss - 0.5), 0, Hs).astype(np.int64)
        i1 = np.clip(np.ceil((yhi[sel] - b0) * ss - 0.5), 0, Hs).astype(np.int64)
        cnt = i1 - i0
        tot = int(cnt.sum())
        if not tot:
            continue
        eid = np.repeat(np.arange(len(cnt)), cnt)
        ii = np.arange(tot) - np.repeat(np.cumsum(cnt) - cnt, cnt) + np.repeat(i0, cnt)
        ys = b0 + (ii + 0.5) / ss
        eax, eay, ebx, eby = ax[sel][eid], ay[sel][eid], bx[sel][eid], by[sel][eid]
        xs = eax + (ys - eay) * (ebx - eax) / (eby - eay)
        col = np.clip(np.ceil((xs - x0) * ss - 0.5), 0, W).astype(np.int64)
        acc = np.bincount(ii * (W + 1) + col, weights=dirn[sel][eid], minlength=Hs * (W + 1)).reshape(Hs, W + 1)
        wind = np.cumsum(acc, axis=1)[:, :W]
        inside = (np.rint(np.abs(wind)).astype(np.int64) & 1).astype(bool) if evenodd else np.abs(wind) > 0.5
        out[b0 - y0:b1 - y0] = inside.reshape(b1 - b0, ss, x1 - x0, ss).mean((1, 3))
    return y0, x0, out


def blur(a, r):
    """About a gaussian of radius r pixels: three box blurs along each axis (edges held)."""
    if r <= 0:
        return a
    k = max(1, int(round(r / 1.7)))
    out = a.astype(np.float32)
    for axis in (0, 1):
        for _ in range(3):
            pad = [(0, 0)] * out.ndim
            pad[axis] = (k + 1, k)
            c = np.cumsum(np.pad(out, pad, mode="edge"), axis=axis, dtype=np.float64)
            hi = np.take(c, np.arange(2 * k + 1, c.shape[axis]), axis=axis)
            lo = np.take(c, np.arange(0, c.shape[axis] - 2 * k - 1), axis=axis)
            out = ((hi - lo) / (2 * k + 1)).astype(np.float32)
    return out


def dilate(a, r):
    """Grey dilation by about a disc of radius r pixels (an octagon: square and cross steps in turn)."""
    out = a.copy()
    for i in range(int(round(r))):
        p = np.pad(out, 1)
        n = [p[1:-1, :-2], p[1:-1, 2:], p[:-2, 1:-1], p[2:, 1:-1]]
        if i % 2:
            n += [p[:-2, :-2], p[:-2, 2:], p[2:, :-2], p[2:, 2:]]
        out = np.maximum.reduce([out] + n)
    return out


# ---- the canvas -------------------------------------------------------------------------------------------------------

class Canvas:
    """A texture's maps painted together: col (sRGB), rough, metal, height (mm, + out of the surface), opacity (for a
    see-through material: 1 solid), and `used`, what any island covers (the bleed fills the rest)."""

    def __init__(self, w, h, color="#808080", rough=0.5, metal=0.0):
        self.w, self.h = w, h
        self.col = np.empty((h, w, 3), np.float32)
        self.col[:] = rgb(color)
        self.rough = np.full((h, w), rough, np.float32)
        self.metal = np.full((h, w), metal, np.float32)
        self.height = np.zeros((h, w), np.float32)
        self.opacity = np.ones((h, w), np.float32)
        self.nrm = np.zeros((h, w, 3), np.float32)            # a tangent-space normal laid by a PBR set (0 0 1: none)
        self.nrm[..., 2] = 1.0
        self.used = np.zeros((h, w), bool)

    def lay(self, y0, x0, cov, color=None, rough=None, metal=None, height=None, alpha=1.0, add_height=False, opacity=None,
            normal=None):
        """Composite a coverage patch at (y0, x0): each given property laid over what's there."""
        hh, ww = cov.shape
        y1, x1 = min(y0 + hh, self.h), min(x0 + ww, self.w)
        if y1 <= y0 or x1 <= x0:
            return
        c = cov[:y1 - y0, :x1 - x0] * alpha
        if color is not None:
            col = np.asarray(color, np.float32)
            if col.ndim == 1:
                col = col[None, None, :]
            else:
                col = col[:y1 - y0, :x1 - x0]
            reg = self.col[y0:y1, x0:x1]
            reg += (col - reg) * c[..., None]
        for name, val in (("rough", rough), ("metal", metal), ("opacity", opacity)):
            if val is not None:
                reg = getattr(self, name)[y0:y1, x0:x1]
                v = val if np.ndim(val) == 0 else np.asarray(val)[:y1 - y0, :x1 - x0]
                reg += (v - reg) * c
        if normal is not None:
            reg = self.nrm[y0:y1, x0:x1]
            nv = np.asarray(normal, np.float32)[:y1 - y0, :x1 - x0]
            reg += (nv - reg) * c[..., None]
            reg /= np.maximum(np.linalg.norm(reg, axis=-1, keepdims=True), 1e-6)
        if height is not None:
            reg = self.height[y0:y1, x0:x1]
            v = height if np.ndim(height) == 0 else np.asarray(height)[:y1 - y0, :x1 - x0]
            if add_height:
                reg += v * c
            else:
                reg += (v - reg) * c


class Frame:
    """An island of a canvas in millimetres: x across from its left, y up from its foot. `wrap`: a band round a thing,
    whose left and right edges meet."""

    def __init__(self, canvas, island, wrap=False):
        self.cv, self.isl, self.wrap = canvas, island, wrap
        u0, v0, u1, v1 = island.rect
        self.px0, self.px1 = u0 * canvas.w, u1 * canvas.w
        self.py0, self.py1 = (1 - v1) * canvas.h, (1 - v0) * canvas.h        # pixel rows, top to bottom
        self.W, self.H = island.w_mm, island.h_mm
        self.s = (self.px1 - self.px0) / self.W                             # pixels a millimetre
        ix0, ix1 = int(math.floor(self.px0)), int(math.ceil(self.px1))
        iy0, iy1 = int(math.floor(self.py0)), int(math.ceil(self.py1))
        canvas.used[max(iy0, 0):iy1, max(ix0, 0):ix1] = True
        self.box = (iy0, ix0, iy1, ix1)

    # -- coordinates
    def to_px(self, pts):
        p = np.asarray(pts, float)
        return np.stack([self.px0 + p[..., 0] * self.s, self.py1 - p[..., 1] * self.s], -1)

    def grid(self):
        """Each pixel of the island as (x, y) millimetres (arrays the island's pixel size), and its box."""
        iy0, ix0, iy1, ix1 = self.box
        xs = (np.arange(ix0, ix1) + 0.5 - self.px0) / self.s
        ys = (self.py1 - (np.arange(iy0, iy1) + 0.5)) / self.s
        X, Y = np.meshgrid(xs, ys)
        return X, Y

    def _clip(self, y0, x0, cov):
        iy0, ix0, iy1, ix1 = self.box
        hh, ww = cov.shape
        cy0, cx0 = max(y0, iy0), max(x0, ix0)
        cy1, cx1 = min(y0 + hh, iy1), min(x0 + ww, ix1)
        if cy1 <= cy0 or cx1 <= cx0:
            return None
        return cy0, cx0, cov[cy0 - y0:cy1 - y0, cx0 - x0:cx1 - x0]

    # -- painting
    def fill_polys(self, polys, evenodd=False, **props):
        """Polygons in mm (lists of (k, 2)) laid with props (color, rough, metal, height, alpha, add_height)."""
        polys = [np.asarray(p, float) for p in polys]
        shifts = [0.0]
        if self.wrap and polys:
            allx = np.concatenate([p[:, 0] for p in polys])
            if allx.min() < 0:
                shifts.append(self.W)
            if allx.max() > self.W:
                shifts.append(-self.W)
        for sh in shifts:
            px = [self.to_px(p + (sh, 0)) for p in polys]
            r = coverage(px, self.cv.w, self.cv.h, evenodd=evenodd)
            if r is None:
                continue
            r = self._clip(*r)
            if r is not None:
                self.lay(*r, **props)

    def cov_of(self, polys, evenodd=False):
        """The island-sized coverage of polygons in mm (for masks and effects)."""
        iy0, ix0, iy1, ix1 = self.box
        out = np.zeros((iy1 - iy0, ix1 - ix0), np.float32)
        polys = [np.asarray(p, float) for p in polys]
        shifts = [0.0]
        if self.wrap and polys:
            allx = np.concatenate([p[:, 0] for p in polys])
            shifts += ([self.W] if allx.min() < 0 else []) + ([-self.W] if allx.max() > self.W else [])
        for sh in shifts:
            r = coverage([self.to_px(p + (sh, 0)) for p in polys], self.cv.w, self.cv.h, evenodd=evenodd)
            if r is None:
                continue
            y0, x0, cov = r
            r = self._clip(y0, x0, cov)
            if r is None:
                continue
            cy0, cx0, c = r
            reg = out[cy0 - iy0:cy0 - iy0 + c.shape[0], cx0 - ix0:cx0 - ix0 + c.shape[1]]
            np.maximum(reg, c, out=reg)
        return out

    def lay(self, y0, x0, cov, color=None, rough=None, metal=None, height=None, alpha=1.0, add_height=False, opacity=None,
            normal=None):
        self.cv.lay(y0, x0, cov, None if color is None else rgb(color) if not isinstance(color, np.ndarray) or color.ndim == 1 else color,
                    rough, metal, height, alpha, add_height, opacity, normal)

    def lay_island(self, cov, **props):
        """A coverage the island's size (cov_of, a pattern) laid with props."""
        iy0, ix0, iy1, ix1 = self.box
        y0, x0 = max(iy0, 0), max(ix0, 0)
        self.lay(y0, x0, cov[y0 - iy0:, x0 - ix0:], **props)

    # -- shapes (polygons in mm)
    def rect(self, x, y, w, h, r=0.0, **props):
        self.fill_polys([rrect_poly(x, y, w, h, r)], **props)

    def ellipse(self, cx, cy, rx, ry=None, rot=0.0, **props):
        self.fill_polys([ellipse_poly(cx, cy, rx, rx if ry is None else ry, rot)], **props)

    def ring(self, cx, cy, r, width, **props):
        self.fill_polys([ellipse_poly(cx, cy, r + width / 2, r + width / 2), ellipse_poly(cx, cy, r - width / 2, r - width / 2)[::-1]], **props)

    def poly(self, pts, **props):
        self.fill_polys([pts], **props)

    def line(self, pts, width, closed=False, **props):
        self.fill_polys(stroke_polys(pts, width, closed), **props)

    def fill(self, **props):
        self.rect(-1, -1, self.W + 2, self.H + 2, **props) if not self.wrap else self.rect(0, -1, self.W, self.H + 2, **props)

    def gradient(self, c0, c1, angle=90.0, t0=0.0, t1=1.0, mask=None, **props):
        """A linear gradient across the island, from c0 to c1 along `angle` degrees (90: bottom to top)."""
        X, Y = self.grid()
        a = math.radians(angle)
        d = np.cos(a) * X / self.W + np.sin(a) * Y / self.H
        lo, hi = (min(0, math.cos(a)) + min(0, math.sin(a))), (max(0, math.cos(a)) + max(0, math.sin(a)))
        t = np.clip(((d - lo) / max(hi - lo, 1e-9) - t0) / max(t1 - t0, 1e-9), 0, 1)
        t = t * t * (3 - 2 * t)
        col = rgb(c0)[None, None] * (1 - t[..., None]) + rgb(c1)[None, None] * t[..., None]
        self.lay_island(np.ones_like(t) if mask is None else mask, color=col, **props)

    # -- patterns (analytic, the island's size)
    def stripes(self, period, duty=0.5, angle=0.0, offset=0.0, mask=None, **props):
        X, Y = self.grid()
        a = math.radians(angle)
        if self.wrap and abs(math.cos(a)) > 1e-6:
            # whole repeats round the band, so the stripes meet at the seam
            n = max(1, round(self.W * abs(math.cos(a)) / period))
            period = self.W * abs(math.cos(a)) / n
        s = (X * math.cos(a) + Y * math.sin(a)) / period + offset
        fr = s - np.floor(s)
        sd = np.where(fr < duty, np.minimum(fr, duty - fr), -np.minimum(fr - duty, 1 - fr)) * period * self.s
        cov = np.clip(sd + 0.5, 0, 1)
        self.lay_island(cov * (1 if mask is None else mask), **props)

    def dots(self, spacing, radius, hexed=True, offset=(0.0, 0.0), mask=None, **props):
        X, Y = self.grid()
        sx = spacing
        if self.wrap:
            sx = self.W / max(1, round(self.W / spacing))
        gy = (Y - offset[1]) / (spacing * (0.866 if hexed else 1.0))
        row = np.round(gy)
        xx = (X - offset[0]) / sx - (0.5 * (row % 2) if hexed else 0)
        dx = (xx - np.round(xx)) * sx
        dy = (gy - row) * spacing * (0.866 if hexed else 1.0)
        d = np.sqrt(dx * dx + dy * dy)
        cov = np.clip((radius - d) * self.s + 0.5, 0, 1)
        self.lay_island(cov * (1 if mask is None else mask), **props)

    # -- text
    def text(self, s, at, size, font="anton", anchor="center", tracking=0.0, line=1.15, rot=0.0, skew=0.0,
             stretch=1.0, fit=None, arc=None, stroke=None, shadow=None, **props):
        """Text with its cap height `size` mm, anchored at `at` (anchor: center, left, right, top, bottom, or two words).
        fit: a width in mm it's squeezed into (narrowed, not shrunk, down to 55%, then shrunk). arc: a radius in mm it
        bends round (positive: centre below, the text on top of a circle). stroke: (color, width mm) drawn under it;
        shadow: (color, dx, dy, blur mm, alpha)."""
        polys = text_polys(s, font, size, tracking, line, anchor, rot, skew, stretch, fit, arc)
        polys = [p + np.asarray(at, float) for p in polys]
        if not polys:
            return
        if shadow:
            c, dx, dy, bl, al = shadow
            cov = self.cov_of([p + (dx, dy) for p in polys])
            cov = blur(cov, bl * self.s)
            self.lay_island(cov, color=c, alpha=al)
        if stroke:
            c, wmm = stroke[0], stroke[1]
            cov = dilate(self.cov_of(polys), wmm * self.s)
            sp = dict(props)
            sp["color"] = c
            sp.pop("height", None)
            self.lay_island(cov, **sp)
        self.fill_polys(polys, **props)

    def pbr(self, ref, tile=None, rot=0.0, offset=(0.0, 0.0), tint=None, mask=None, alpha=1.0, normal_strength=1.0):
        """A PBR set off the shelf (pbr/<name>, or a folder) laid over the island at its real size: `tile` metres a repeat
        (the set's own tile_m if not given), turned `rot` degrees; its colour (tinted), roughness, metalness and normal."""
        from . import pbrset
        st = pbrset.load(ref)
        X, Y = self.grid()
        tm = (tile or st.tile_m) * 1000.0
        a = math.radians(rot)
        u = (X * math.cos(a) + Y * math.sin(a)) / tm + offset[0]
        v = (-X * math.sin(a) + Y * math.cos(a)) / tm + offset[1]
        smp = st.sample(u, v)
        cov = np.ones_like(X) if mask is None else mask
        col = smp["albedo"]
        if tint is not None:
            col = col * rgb(tint)[None, None] * 1.0
        n = smp["normal"].copy()
        if rot:
            c, s_ = math.cos(a), math.sin(a)
            nx, ny = n[..., 0] * c - n[..., 1] * s_, n[..., 0] * s_ + n[..., 1] * c
            n[..., 0], n[..., 1] = nx, ny
        n[..., :2] *= normal_strength
        n /= np.maximum(np.linalg.norm(n, axis=-1, keepdims=True), 1e-6)
        self.lay_island(cov, color=col.astype(np.float32), rough=smp["rough"], metal=smp["metal"], alpha=alpha,
                        normal=n.astype(np.float32))

    def image(self, path_or_array, x=0.0, y=0.0, w=None, h=None, **props):
        """A picture (an RGBA array 0-1, rows top first, or a PNG path) laid over the island's rect (x, y, w, h mm)."""
        img = read_image(path_or_array) if isinstance(path_or_array, str) else np.asarray(path_or_array, np.float32)
        w = self.W if w is None else w
        h = self.H if h is None else h
        X, Y = self.grid()
        u = (X - x) / w
        v = 1 - (Y - y) / h
        inside = ((u >= 0) & (u <= 1) & (v >= 0) & (v <= 1)).astype(np.float32)
        ih, iw = img.shape[:2]
        fx = np.clip(u * iw - 0.5, 0, iw - 1)
        fy = np.clip(v * ih - 0.5, 0, ih - 1)
        x0, y0 = np.floor(fx).astype(int), np.floor(fy).astype(int)
        x1, y1 = np.minimum(x0 + 1, iw - 1), np.minimum(y0 + 1, ih - 1)
        tx, ty = (fx - x0)[..., None], (fy - y0)[..., None]
        top = img[y0, x0] * (1 - tx) + img[y0, x1] * tx
        bot = img[y1, x0] * (1 - tx) + img[y1, x1] * tx
        px = top * (1 - ty) + bot * ty
        a = px[..., 3] if px.shape[-1] > 3 else np.ones(px.shape[:2], np.float32)
        self.lay_island(inside * a, color=px[..., :3], **props)


# ---- polygons ---------------------------------------------------------------------------------------------------------

def rrect_poly(x, y, w, h, r=0.0, n=8):
    r = min(r, w / 2, h / 2)
    if r <= 0:
        return np.array([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], float)
    out = []
    for cx, cy, a0 in ((x + w - r, y + r, -90), (x + w - r, y + h - r, 0), (x + r, y + h - r, 90), (x + r, y + r, 180)):
        for k in range(n + 1):
            a = math.radians(a0 + 90 * k / n)
            out.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return np.array(out)


def ellipse_poly(cx, cy, rx, ry, rot=0.0, n=None):
    n = n or max(24, int(min(256, 6 * math.sqrt(max(rx, ry, 0.1)) * 4)))
    t = np.linspace(0, 2 * math.pi, n, endpoint=False)
    x, y = rx * np.cos(t), ry * np.sin(t)
    c, s = math.cos(math.radians(rot)), math.sin(math.radians(rot))
    return np.stack([cx + c * x - s * y, cy + s * x + c * y], 1)


def star_poly(cx, cy, r_out, r_in, points=5, rot=90.0):
    a = np.radians(rot) + np.arange(points * 2) * math.pi / points
    r = np.where(np.arange(points * 2) % 2 == 0, r_out, r_in)
    return np.stack([cx + r * np.cos(a), cy + r * np.sin(a)], 1)


def stroke_polys(pts, width, closed=False):
    """A polyline drawn `width` mm wide: a quad a segment and a disc at each joint (their union by the nonzero rule)."""
    p = np.asarray(pts, float)
    if closed:
        p = np.concatenate([p, p[:1]])
    out = []
    hw = width / 2
    for a, b in zip(p[:-1], p[1:]):
        d = b - a
        L = np.hypot(*d)
        if L < 1e-9:
            continue
        nrm = np.array([-d[1], d[0]]) / L * hw
        out.append(np.array([a - nrm, b - nrm, b + nrm, a + nrm]))
    for q in p:
        out.append(ellipse_poly(q[0], q[1], hw, hw, n=16))
    return out


# ---- text through Blender's fonts ---------------------------------------------------------------------------------------

_fonts, _glyphs, _caps = {}, {}, {}


def font_path(name):
    if os.path.isfile(str(name)):
        return str(name)
    f = FONT_FILES.get(str(name).lower())
    if f:
        return os.path.join(FONTS, f)
    raise ValueError(f"font {name!r}: one of {', '.join(sorted(FONT_FILES))} or a .ttf path")


def _font(name):
    import bpy
    p = font_path(name)
    f = _fonts.get(p)
    try:
        if f is not None and f.name:
            return f
    except ReferenceError:            # Blender's data was reset since (a new prop): load it again
        pass
    _fonts[p] = bpy.data.fonts.load(p, check_existing=True)
    return _fonts[p]


def _outline(s, font, tracking, line):
    """The text's outlines at Blender size 1, unaligned: a list of (k, 2) arrays."""
    key = (s, font, round(tracking, 4), round(line, 4))
    if key in _glyphs:
        return _glyphs[key]
    import bpy
    cu = bpy.data.curves.new("propgen_text", "FONT")
    cu.body = s
    cu.font = _font(font)
    cu.size = 1.0
    cu.space_character = 1.0 + tracking
    cu.space_line = line
    cu.resolution_u = 12
    ob = bpy.data.objects.new("propgen_text", cu)
    bpy.context.scene.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get()
    polys = []
    try:
        c = ob.evaluated_get(dg).to_curve(dg)
        for sp in c.splines:
            bp = list(sp.bezier_points)
            if len(bp) < 2:
                continue
            n = len(bp)
            co = np.array([b.co[:2] for b in bp])
            hr = np.array([b.handle_right[:2] for b in bp])
            hl = np.array([b.handle_left[:2] for b in bp])
            p0, p1, p2, p3 = co, hr, np.roll(hl, -1, 0), np.roll(co, -1, 0)
            # a straight segment needs one point, a curve ten
            def cross2(a, b):
                return a[:, 0] * b[:, 1] - a[:, 1] * b[:, 0]
            dev = np.maximum(np.abs(cross2(p3 - p0, p1 - p0)), np.abs(cross2(p3 - p0, p2 - p0)))
            curved = dev > 1e-6 * np.maximum(np.linalg.norm(p3 - p0, axis=1), 1e-9)
            t = np.arange(10) / 10.0
            pts = []
            for i in range(n):
                if curved[i]:
                    tt = t[:, None]
                    pts.append((1 - tt) ** 3 * p0[i] + 3 * (1 - tt) ** 2 * tt * p1[i] + 3 * (1 - tt) * tt * tt * p2[i] + tt ** 3 * p3[i])
                else:
                    pts.append(p0[i][None])
            pts = np.concatenate(pts)
            polys.append(pts)
    finally:
        ob.evaluated_get(dg).to_curve_clear() if hasattr(ob, "to_curve_clear") else None
        bpy.data.objects.remove(ob)
        bpy.data.curves.remove(cu)
    _glyphs[key] = polys
    return polys


def cap_height(font):
    if font not in _caps:
        p = _outline("H", font, 0.0, 1.0)
        ys = np.concatenate([q[:, 1] for q in p]) if p else np.array([0.0, 0.7])
        _caps[font] = max(ys.max() - ys.min(), 1e-3)
    return _caps[font]


def text_polys(s, font="anton", size=10.0, tracking=0.0, line=1.15, anchor="center", rot=0.0, skew=0.0, stretch=1.0,
               fit=None, arc=None):
    """Text outlines in mm round (0, 0) per the anchor, cap height `size` (see Frame.text)."""
    raw = _outline(s, font, tracking, line)
    if not raw:
        return []
    k = size / cap_height(font)
    polys = [p * k for p in raw]
    allp = np.concatenate(polys)
    x0, y0 = allp.min(0)
    x1, y1 = allp.max(0)
    sx = stretch
    if fit and (x1 - x0) * sx > fit:
        sx = max(fit / (x1 - x0), 0.55 * stretch)
    scale_all = 1.0
    if fit and (x1 - x0) * sx > fit:
        scale_all = fit / ((x1 - x0) * sx)
    words = anchor.split()
    ax = 0.5 if "center" in words or not ({"left", "right"} & set(words)) else (0.0 if "left" in words else 1.0)
    # vertical: center on the caps of the first line (descenders hang), or the box's top or bottom
    if "top" in words:
        ay = y1
    elif "bottom" in words:
        ay = y0
    elif "baseline" in words:
        ay = 0.0
    else:
        ay = (y1 + max(y1 - size * 1.0, y0)) / 2 if "\n" not in s else (y0 + y1) / 2
    cx = x0 + (x1 - x0) * ax
    out = []
    c, sn = math.cos(math.radians(rot)), math.sin(math.radians(rot))
    for p in polys:
        q = p - (cx, ay)
        q[:, 0] = (q[:, 0] + skew * q[:, 1]) * sx
        q *= scale_all
        if arc:
            ang = q[:, 0] / arc
            rr = arc + q[:, 1]
            q = np.stack([rr * np.sin(ang), rr * np.cos(ang) - arc], 1)
        q = np.stack([c * q[:, 0] - sn * q[:, 1], sn * q[:, 0] + c * q[:, 1]], 1)
        out.append(q)
    return out


def text_width(s, font="anton", size=10.0, tracking=0.0):
    raw = _outline(s, font, tracking, 1.15)
    if not raw:
        return 0.0
    allp = np.concatenate(raw) * (size / cap_height(font))
    return float(allp[:, 0].max() - allp[:, 0].min())


# ---- PNG out (no Pillow inside Blender), pictures in through Blender -------------------------------------------------------------------------

def write_png(path, a):
    """An array (h, w) or (h, w, 3/4), floats 0-1 or uint8, rows top first, as an 8-bit PNG."""
    import struct
    import zlib
    a = np.asarray(a)
    if a.dtype != np.uint8:
        a = (np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)
    if a.ndim == 2:
        a = a[..., None]
    h, w, c = a.shape
    ctype = {1: 0, 2: 4, 3: 2, 4: 6}[c]
    raw = b"".join(b"\x00" + a[y].tobytes() for y in range(h))

    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)

    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, ctype, 0, 0, 0)) + \
        chunk(b"IDAT", zlib.compress(raw, 6)) + chunk(b"IEND", b"")
    with open(path, "wb") as fh:
        fh.write(data)


def read_image(path):
    """Any picture Blender reads (PNG, JPG, TGA...) as RGBA floats 0-1, rows top first, in the file's own values."""
    import bpy
    im = bpy.data.images.load(os.path.abspath(path), check_existing=False)
    w, h = im.size
    px = np.zeros(w * h * 4, np.float32)
    im.pixels.foreach_get(px)
    bpy.data.images.remove(im)
    return px.reshape(h, w, 4)[::-1].copy()
