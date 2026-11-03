"""Leaves cut from a leaf set off the PBR shelf (ambientCG's LeafSet0xx: a few real leaves or sprays photographed on a
plain ground, stalk down, with an opacity map that cuts them out, their normal and roughness maps), for the tree
family's cards (families/tree.py, PROPGEN.md §18): each leaf found as one piece of the opacity map (a thin stalk kept
with its blade), its base the lowest point of the piece as photographed (the stalk's end, a twig's cut end) or, for a
long spray, the end of its long axis where the last slices hold one thin run of pixels (its cut stem, not its fan of
needles), so it can be hung from a twig by its base at any size and angle, with its colour, its roughness and its
normal map turned with it. numpy only."""
import math
import os

import numpy as np

_sets = {}


class Cutout:
    """One leaf (or spray) of a set: its maps cropped to it, its base (the stalk's end) and its axis in its own pixels."""

    def __init__(self, rgba, nrm, rough, base, axis, length):
        self.rgba, self.nrm, self.rough = rgba, nrm, rough     # (h, w, 4) sRGB + opacity, (h, w, 3) -1..1, (h, w)
        self.base = np.asarray(base, float)                   # pixel (x, y) of the stalk's end, in the crop
        self.axis = np.asarray(axis, float)                   # unit (x, y) from the base toward the tip, pixel space
        self.length = float(length)                           # pixels from the base to the tip
        self.width = 0.0


def _label(mask):
    """Connected pieces of a boolean image (8-connected): labels (h, w), 0 the ground, and how many pieces."""
    h, w = mask.shape
    labels = np.zeros((h, w), np.int32)
    n = 0
    ys, xs = np.nonzero(mask)
    todo = set(zip(ys.tolist(), xs.tolist()))
    while todo:
        y0, x0 = todo.pop()
        n += 1
        stack = [(y0, x0)]
        labels[y0, x0] = n
        while stack:
            y, x = stack.pop()
            for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1), (y - 1, x - 1), (y - 1, x + 1), (y + 1, x - 1), (y + 1, x + 1)):
                if (yy, xx) in todo:
                    todo.discard((yy, xx))
                    labels[yy, xx] = n
                    stack.append((yy, xx))
    return labels, n


def _end_score(t, s, t0, t1):
    """How much of a leaf there is at one end of its axis: over the slices between t0 and t1 (a pixel each), the mean
    opaque width times the mean number of separate runs. A bare stem stub scores a few; a blade's tip or a fan of
    needles far more."""
    sel = (t >= t0) & (t <= t1)
    if not sel.any():
        return 1e9
    tt, ss = np.round(t[sel]).astype(int), s[sel]
    widths, runs = [], []
    for b in np.unique(tt):
        v = np.sort(ss[tt == b])
        widths.append(len(v))
        runs.append(1 + int((np.diff(v) > 1.5).sum()) if len(v) > 1 else 1)
    return float(np.mean(widths) * np.mean(runs))


def _downsample(a, k):
    h, w = a.shape[:2]
    hh, ww = h // k * k, w // k * k
    b = a[:hh, :ww]
    return b.reshape(hh // k, k, ww // k, k, *a.shape[2:]).mean((1, 3))


def load(ref, min_share=0.002):
    """The set's leaves as Cutouts (biggest first), from its shelf meta (storykit/pbr.py): the colour map with the
    opacity map as its alpha (or its own alpha), the normal (GL), the roughness. Pieces under `min_share` of the image
    are specks and left out."""
    if ref in _sets:
        return _sets[ref]
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "Content", "Python"))
    from storykit import pbr as PBR
    from .paint import read_image
    d = PBR.set_dir(ref) if str(ref).startswith("pbr/") else __import__("pathlib").Path(ref)
    m = PBR.meta(d)
    if not m or "albedo" not in m["maps"]:
        raise SystemExit(f"leaf set {ref}: no colour map in {d}")
    col = read_image(str(d / m["maps"]["albedo"]))
    if m["maps"].get("opacity"):
        op = read_image(str(d / m["maps"]["opacity"]))[..., 0]
    elif col.shape[-1] > 3 and float(col[..., 3].min()) < 0.5:
        op = col[..., 3]
    else:
        raise SystemExit(f"leaf set {ref}: no opacity map and no alpha: nothing cuts the leaves out")
    rgba = np.concatenate([col[..., :3], op[..., None]], -1).astype(np.float32)
    nrm = None
    if m["maps"].get("normal"):
        nrm = read_image(str(d / m["maps"]["normal"]))[..., :3] * 2 - 1
        if m.get("normal") == "dx":
            nrm[..., 1] *= -1
    rough = read_image(str(d / m["maps"]["rough"]))[..., 0] if m["maps"].get("rough") else None
    h, w = op.shape
    # the pieces, found small (a pixel a 4 x 4 block) and cut at full size
    k = max(1, int(round(max(h, w) / 256)))
    hh, ww = h // k * k, w // k * k
    small = (op[:hh, :ww] > 0.5).reshape(hh // k, k, ww // k, k).max((1, 3))      # any opaque pixel in a block: a thin stalk stays joined to its leaf
    labels, n = _label(small)
    out = []
    for i in range(1, n + 1):
        ys, xs = np.nonzero(labels == i)
        if len(ys) < min_share * small.size:
            continue
        y0, y1 = max(0, ys.min() * k - 2), min(h, (ys.max() + 1) * k + 2)
        x0, x1 = max(0, xs.min() * k - 2), min(w, (xs.max() + 1) * k + 2)
        crop = rgba[y0:y1, x0:x1].copy()
        a = crop[..., 3] > 0.5
        # other pieces inside this box are cut away (a neighbour's edge), by the small labels brought up to size
        lab_full = np.repeat(np.repeat(labels, k, 0), k, 1)[:h, :w][y0:y1, x0:x1]
        others = (lab_full != i) & (lab_full != 0)
        crop[..., 3] = np.where(others, 0.0, crop[..., 3])
        a = crop[..., 3] > 0.5
        if a.sum() < 20:
            continue
        yy, xx = np.nonzero(a)
        P = np.stack([xx, yy], 1).astype(float)
        c = P.mean(0)
        cov = np.cov((P - c).T)
        evals, evecs = np.linalg.eigh(cov)
        e1 = evecs[:, 1]
        e2 = evecs[:, 0]
        t = (P - c) @ e1
        s = (P - c) @ e2
        lo, hi = t.min(), t.max()
        span = hi - lo
        width = float(np.percentile(s, 95) - np.percentile(s, 5))
        if span / max(width, 1e-6) <= 2.2:
            # a leaf (or a twig of them) was photographed stalk down: its base is its lowest point (the stalk's end,
            # a twig's cut end), its axis from there up through its middle
            soft = crop[..., 3] > 0.3
            yy3, xx3 = np.nonzero(soft)
            j = int(np.argmax(yy3 + 0.001 * -np.abs(xx3 - xx3.mean())))
            base = np.array([xx3[j], yy3[j]], float)
            e1 = c - base
            e1 /= max(np.linalg.norm(e1), 1e-9)
            t = (P - base) @ e1
            s = (P - base) @ np.array([-e1[1], e1[0]])
            length = float(t.max())
            width = float(np.percentile(s, 97) - np.percentile(s, 3))
        else:
            if True:
                # long and thin (a spray, a lance of a leaf): the stem's end is the end of the long axis where the
                # last slices hold one thin run of pixels (a cut stem), not a fan of needles (several runs, or a wide
                # one); the browner end decides when they're alike
                col = crop[..., :3][a]
                score_lo = _end_score(t, s, lo, lo + 0.06 * span)
                score_hi = _end_score(t, s, hi - 0.06 * span, hi)
                if abs(score_lo - score_hi) < 0.3 * max(score_lo, score_hi, 1e-6):
                    brown_lo = float((col[t < lo + 0.06 * span, 0] - col[t < lo + 0.06 * span, 1]).mean())
                    brown_hi = float((col[t > hi - 0.06 * span, 0] - col[t > hi - 0.06 * span, 1]).mean())
                    flip_ends = brown_hi > brown_lo
                else:
                    flip_ends = score_hi < score_lo
            if flip_ends:
                e1 = -e1
                t = -t
                lo, hi = -hi, -lo
            base = P[int(np.argmin(t))]
            length = hi - lo
            width = float(2 * np.abs(s).max())
        cut = Cutout(crop, None if nrm is None else nrm[y0:y1, x0:x1].copy(), None if rough is None else rough[y0:y1, x0:x1].copy(),
                     base, e1, length)
        cut.width = width
        out.append(cut)
    out.sort(key=lambda cc: -cc.rgba[..., 3].sum())
    _sets[ref] = out
    return out


def lay(frame, cut, at, angle, length_mm, tint=None, rough=None, flip=False, height=0.12, shade=1.0):
    """Hangs a cutout on a frame: its base at `at` (mm), its axis along `angle` degrees from straight up (clockwise
    positive, as the drawn leaves turn), `length_mm` from base to tip; its colour (times `tint` and `shade`), opacity,
    roughness and normal map (turned with it) laid where it is opaque."""
    X, Y = frame.grid()
    iy0, ix0, iy1, ix1 = frame.box
    scale = length_mm / max(cut.length, 1e-6)                   # mm a pixel
    a = math.radians(angle)
    along = np.array([math.sin(a), math.cos(a)])                # the leaf's axis in the frame (x across, y up)
    across = np.array([math.cos(a), -math.sin(a)])
    e1, e2 = cut.axis, np.array([-cut.axis[1], cut.axis[0]])    # pixel space (x right, y down)
    if flip:
        e2 = -e2
    h, w = cut.rgba.shape[:2]
    # where the crop's corners land on the frame, for the pixels to visit
    corners = []
    for cx, cy in ((0, 0), (w, 0), (0, h), (w, h)):
        d = np.array([cx, cy], float) - cut.base
        u, v = d @ e1, d @ e2
        corners.append(np.asarray(at, float) + along * (u * scale) + across * (v * scale))
    corners = np.array(corners)
    px = frame.to_px(corners)
    cx0, cx1 = int(np.floor(px[:, 0].min())) - 1, int(np.ceil(px[:, 0].max())) + 1
    cy0, cy1 = int(np.floor(px[:, 1].min())) - 1, int(np.ceil(px[:, 1].max())) + 1
    cx0, cx1 = max(cx0, ix0), min(cx1, ix1)
    cy0, cy1 = max(cy0, iy0), min(cy1, iy1)
    if cx1 <= cx0 or cy1 <= cy0:
        return
    Xs = X[cy0 - iy0:cy1 - iy0, cx0 - ix0:cx1 - ix0]
    Ys = Y[cy0 - iy0:cy1 - iy0, cx0 - ix0:cx1 - ix0]
    dx, dy = Xs - at[0], Ys - at[1]
    u = (dx * along[0] + dy * along[1]) / scale              # pixels along the leaf's axis
    v = (dx * across[0] + dy * across[1]) / scale
    pxx = cut.base[0] + u * e1[0] + v * e2[0]
    pyy = cut.base[1] + u * e1[1] + v * e2[1]
    inside = (pxx >= 0) & (pxx <= w - 1) & (pyy >= 0) & (pyy <= h - 1)
    if not inside.any():
        return
    x0 = np.clip(np.floor(pxx).astype(int), 0, w - 1)
    y0 = np.clip(np.floor(pyy).astype(int), 0, h - 1)
    x1 = np.clip(x0 + 1, 0, w - 1)
    y1 = np.clip(y0 + 1, 0, h - 1)
    tx = np.clip(pxx - x0, 0, 1)[..., None]
    ty = np.clip(pyy - y0, 0, 1)[..., None]

    def samp(img):
        if img.ndim == 2:
            img = img[..., None]
        top = img[y0, x0] * (1 - tx) + img[y0, x1] * tx
        bot = img[y1, x0] * (1 - tx) + img[y1, x1] * tx
        return top * (1 - ty) + bot * ty

    rgba = samp(cut.rgba)
    cov = rgba[..., 3] * inside
    col = rgba[..., :3] * shade
    if isinstance(tint, tuple) and tint and tint[0] == "hue":
        from .families.tree import _hued
        col = _hued(col, tint[1])
    elif tint is not None:
        t = np.asarray(tint, np.float32)
        col = col * (t / max(float(t.mean()), 1e-6))[None, None]
    props = {"color": np.clip(col, 0, 1).astype(np.float32), "opacity": 1.0, "height": height}
    if cut.rough is not None:
        props["rough"] = samp(cut.rough)[..., 0].astype(np.float32) if rough is None else rough
    elif rough is not None:
        props["rough"] = rough
    if cut.nrm is not None:
        n = samp(cut.nrm)
        # the map's x, y turned as the leaf is: its axis e1 goes to `along`, e2 (down the image) to `across`
        nx, ny = n[..., 0], -n[..., 1]                        # GL: y up in the map; make it image-down then turn
        # the normal's in-plane part expressed on (e1, e2), then on the frame's (along, across)
        a1 = nx * e1[0] + (-ny) * e1[1]
        a2 = nx * e2[0] + (-ny) * e2[1]
        fx = a1 * along[0] + a2 * across[0]
        fy = a1 * along[1] + a2 * across[1]
        nn = np.stack([fx, fy, n[..., 2]], -1)
        nn /= np.maximum(np.linalg.norm(nn, axis=-1, keepdims=True), 1e-6)
        props["normal"] = nn.astype(np.float32)
    frame.cv.lay(cy0, cx0, cov.astype(np.float32), **{k: (v if k != "color" else v) for k, v in props.items()})
