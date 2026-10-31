"""A set's own layout (docs/ASSETS.md §6c): the tiles, boards or mats a texture set draws, found in its maps as cells, so
a kit floor painted with it (STORY_FORMAT §2, a kit thing's `mats`) lays its real boards where the set's painted ones
are: the kit's gaps and bevels in the set's seams, each board wearing the one plank, tile or mat the set paints there
(the user, 2026-10-31: "make the floors take a material"). A set with no layout of its own (wood grain, a weave, plaster)
has none: each of the kit's boards wears its own cut of it.

    cells(look) -> {"tile": metres, "rects": [[u0, v0, u1, v1], ...], "seam": metres} or None

`look` is what a slot is painted with: a set's ref (`pbr/...`) or a tuned set (a look object: its set's maps turned as
the made set's are, its size scaled). Rects are fractions of one repeat in the texture's own UV space (u right, v up,
as the kit's UVs and three.js read it; Godot's slot materials are offset to agree, GODOT_EXPORT §3b), each from the
middle of its seams to the middle of the next, a rect crossing the repeat's edge running past 0 or 1. Found on the
height map (seams sit low), else the occlusion, else the colour's darkness: long straight runs of low pixels are
seams (grain, cracks and specks are too short or crooked to count), the areas between them the cells, kept only
when they are rectangles that fill the repeat. A set's meta.json `cells: false` says it has none, whatever is found.
Plain Python with numpy and Pillow (pbrmix's), imported when a set is first looked at; cached by the set's stamp.
"""
import math

from . import pbr as PBR

N = 1024                   # the size the maps are looked at (one pixel a millimetre or two on a floor set)
DEEP = 0.45                # a seam at least this deep as the set's typical one (a scratch across a paver isn't)
RUN = 32                   # a seam runs straight at least 1/RUN of a repeat (a joint between two rows of small pavers does)
_cache = {}


def _np():
    import numpy
    return numpy


def _gray(d, meta, q):
    """The map seams show in, low where they are, as an N x N array turned q quarter turns (as the made set's maps)."""
    from . import pbrmix as MIX
    np = _np()
    maps = meta.get("maps") or {}
    a = None
    for k in ("height", "ao", "albedo"):
        if k in maps and (d / maps[k]).is_file():
            a = MIX._read(d / maps[k], "RGB" if k == "albedo" else "L")
            if a.ndim == 3:
                a = a @ np.array([0.2126, 0.7152, 0.0722], np.float32)
            break
    if a is None:
        return None
    from PIL import Image
    n = min(N, max(a.shape))
    a = np.asarray(Image.fromarray(a.astype(np.float32), "F").resize((n, n), Image.BOX), dtype=np.float32)
    return np.rot90(a, q).copy() if q else a


def _blur(a, r):
    """A box blur r pixels each way, wrapping round (the set tiles)."""
    np = _np()
    for ax in (0, 1):
        p = np.concatenate([a.take(range(-r - 1, 0), axis=ax), a, a.take(range(0, r), axis=ax)], axis=ax)
        c = np.cumsum(p, axis=ax, dtype=np.float64)
        n = a.shape[ax]
        a = (c.take(range(2 * r + 1, 2 * r + 1 + n), axis=ax) - c.take(range(0, n), axis=ax)) / (2 * r + 1)
    return a.astype(np.float32)


def _runs(b):
    """Each row's runs of True as (row, start, end) arrays, end exclusive."""
    np = _np()
    x = np.pad(b.astype(np.int8), ((0, 0), (1, 1)))
    d = np.diff(x, axis=1)
    sr, sc = np.nonzero(d == 1)
    er, ec = np.nonzero(d == -1)
    return sr, sc, ec


def _long(b, L, z):
    """The runs along each row at least L long (wrapping round the row's ends): (rows, starts, ends, each run's mean
    depth in z), a start in the first width, an end up to a width past it."""
    np = _np()
    H, W = b.shape
    sr, sc, ec = _runs(np.concatenate([b, b], axis=1))
    keep = ((ec - sc) >= L) & (sc < W)
    sr, sc, ec = sr[keep], sc[keep], np.minimum(ec[keep], sc[keep] + W)
    cz = np.concatenate([np.zeros((H, 1)), np.cumsum(np.concatenate([z, z], axis=1), axis=1, dtype=np.float64)], axis=1)
    return sr, sc, ec, (cz[sr, ec] - cz[sr, sc]) / np.maximum(ec - sc, 1)


def _mark(shape, sr, sc, ec):
    """A mask of the runs (wrapping round the row's ends)."""
    np = _np()
    H, W = shape
    m = np.zeros((H, 2 * W + 1), np.int32)
    np.add.at(m, (sr, sc), 1)
    np.add.at(m, (sr, ec), -1)
    out = np.cumsum(m, axis=1)[:, :2 * W] > 0
    return out[:, :W] | out[:, W:]


def _close(b, g):
    """Gaps of up to 2g pixels along each row closed (a seam broken by a speck stays one seam)."""
    np = _np()
    dil = b.copy()
    for s in range(1, g + 1):
        dil |= np.roll(b, s, axis=1) | np.roll(b, -s, axis=1)
    ero = dil.copy()
    for s in range(1, g + 1):
        ero &= np.roll(dil, s, axis=1) & np.roll(dil, -s, axis=1)
    return ero | b


def _seams(a):
    """The seam mask: long straight runs (along rows and columns) of pixels well below their surroundings, each at least
    DEEP as deep as the set's own seams are (a scratch, a grain line or a crack is shallower than the joints)."""
    np = _np()
    n = a.shape[0]
    hp = a - _blur(a, max(4, n // 24))
    med = float(np.median(hp))
    mad = float(np.median(np.abs(hp - med))) * 1.4826 + 1e-6
    z = ((hp - med) / mad).astype(np.float32)
    low = z < -2.2
    L, g = max(12, n // RUN), max(1, n // 512)
    h = _long(_close(low, g), L, z)
    v = _long(_close(low.T, g), L, z.T)
    depth = np.concatenate([h[3], v[3]])
    if not len(depth):
        return np.zeros_like(low)
    lens = np.concatenate([h[2] - h[1], v[2] - v[1]]).astype(np.float64)
    o = np.argsort(depth)                                            # the set's typical seam: the length-weighted median
    typ = float(depth[o][np.searchsorted(np.cumsum(lens[o]), lens.sum() / 2)])
    kh, kv = h[3] <= DEEP * typ, v[3] <= DEEP * typ
    return _mark(low.shape, h[0][kh], h[1][kh], h[2][kh]) | _mark(low.shape, v[0][kv], v[1][kv], v[2][kv]).T


def _label(fg):
    """Connected areas of fg (4-neighbours, wrapping both ways): [(area, rows covered, columns covered)]."""
    np = _np()
    H, W = fg.shape
    sr, sc, ec = _runs(fg)
    n = len(sr)
    parent = list(range(n))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(i, j):
        i, j = find(i), find(j)
        if i != j:
            parent[j] = i
    first = np.searchsorted(sr, np.arange(H + 1))
    scl, ecl = sc.tolist(), ec.tolist()
    for r in range(H):
        a0, a1 = int(first[r]), int(first[r + 1])
        if a1 - a0 > 1 and scl[a0] == 0 and ecl[a1 - 1] == W:          # round the row's ends
            union(a0, a1 - 1)
        rn = (r + 1) % H
        b0, b1 = int(first[rn]), int(first[rn + 1])
        i, j = a0, b0
        while i < a1 and j < b1:
            if scl[i] < ecl[j] and scl[j] < ecl[i]:
                union(i, j)
            if ecl[i] < ecl[j]:
                i += 1
            else:
                j += 1
    comps = {}
    srl = sr.tolist()
    for k in range(n):
        c = comps.setdefault(find(k), [0, np.zeros(H, bool), np.zeros(W, bool)])
        c[0] += ecl[k] - scl[k]
        c[1][srl[k]] = True
        c[2][scl[k]:ecl[k]] = True
    return list(comps.values())


def _extent(cov):
    """(start, length) of what a component covers along a wrapping axis: everything but its widest gap."""
    np = _np()
    n = len(cov)
    if cov.all():
        return 0, n
    gap = np.concatenate([~cov, ~cov])
    sr, sc, ec = _runs(gap[None, :])
    lens = np.minimum(ec - sc, n)
    k = int(np.argmax(lens))
    return int(ec[k]) % n, n - int(lens[k])


def _snap(vals, tol):
    """Edges within tol of each other (round the repeat) made one: where two cells meet, they meet exactly."""
    if not vals:
        return {}
    fr = sorted({v % 1.0 for v in vals})
    groups = [[fr[0]]]
    for x in fr[1:]:
        if x - groups[-1][-1] <= tol:
            groups[-1].append(x)
        else:
            groups.append([x])
    if len(groups) > 1 and groups[0][0] + 1.0 - groups[-1][-1] <= tol:      # the first and last meet round the edge
        groups[0] = [x - 1.0 for x in groups.pop()] + groups[0]
    centre = {}
    for g in groups:
        c = sum(g) / len(g)
        for x in g:
            centre[round(x % 1.0, 9)] = c
    out = {}
    for v in vals:                                                          # the group's centre nearest the edge
        c = centre[round(v % 1.0, 9)]
        out[v] = c + round(v - c)
    return out


def find(a):
    """The cells in an N x N map (low in the seams): (rects as fractions, u right and v up, the seam's width as a
    fraction) or (None, why)."""
    np = _np()
    n = a.shape[0]
    seam = _seams(a)
    if seam.mean() < 0.004:
        return None, "no seams"
    parts = _label(~seam)
    min_side, min_area = max(6, n // 80), (n // 80) ** 2
    cells = []
    for area, rows, cols in parts:
        r0, h = _extent(rows)
        c0, w = _extent(cols)
        if area < min_area or h < min_side or w < min_side:
            continue                                                # a speck between seams: under the gap
        cells.append((area, r0, h, c0, w))
    med = sorted(c[0] for c in cells)[len(cells) // 2] if cells else 0

    def within(s0, l0, s1, l1):
        return any(s1 <= s0 + k and s0 + k + l0 <= s1 + l1 for k in (-n, 0, n))
    cells = [a for a in cells if a[0] >= 0.5 * med or not any(                # a crack closing a sliver inside a tile: the
        b is not a and within(a[1], a[2], b[1], b[2]) and within(a[3], a[4], b[3], b[4]) for b in cells)]   # tile's box covers it
    if len(cells) < 2:
        return None, "one area"
    if sum(c[0] for c in cells if c[2] >= n or c[4] >= n) > 0.5 * sum(c[0] for c in cells):
        return None, "lines, not cells"
    total = sum(c[0] for c in cells)
    if total < 0.6 * n * n:
        return None, f"cells cover {total / n / n:.0%}"
    fill = [c[0] / (c[2] * c[4]) for c in cells]
    if sum(f * c[0] for f, c in zip(fill, cells)) / total < 0.88 or min((f for f, c in zip(fill, cells) if c[0] > 0.01 * n * n), default=1.0) < 0.7:
        return None, "not rectangles"
    # the seam's width: the short runs across the seam mask, along rows and columns
    widths = []
    for b in (seam, seam.T):
        sr, sc, ec = _runs(b)
        w = ec - sc
        widths += w[(w <= n // 16)].tolist()
    s = float(np.median(widths)) if widths else 2.0
    half = s / 2.0
    rects = []
    for area, r0, h, c0, w in cells:                                # pixel rows run down: v = 1 - row / n
        u0, u1 = (c0 - half) / n, (c0 + w + half) / n
        v0, v1 = 1.0 - (r0 + h + half) / n, 1.0 - (r0 - half) / n
        rects.append([u0, v0, u1, v1])
    tol = max(s, 2.0) / n
    us = _snap([r[0] for r in rects] + [r[2] for r in rects], tol)
    vs = _snap([r[1] for r in rects] + [r[3] for r in rects], tol)
    rects = [[us[r[0]], vs[r[1]], us[r[2]], vs[r[3]]] for r in rects]
    # each rect starting in the first repeat, then a check that they tile it: little overlap, few holes
    out = []
    for u0, v0, u1, v1 in rects:
        du, dv = math.floor(u0), math.floor(v0)
        out.append([round(u0 - du, 5), round(v0 - dv, 5), round(u1 - du, 5), round(v1 - dv, 5)])
    cov = np.zeros((n, n), np.int16)
    for u0, v0, u1, v1 in out:
        c0, c1 = int(round(u0 * n)), int(round(u1 * n))
        r0, r1 = int(round((1 - v1) * n)), int(round((1 - v0) * n))
        cols = np.arange(c0, c1) % n
        rows = np.arange(r0, r1) % n
        cov[np.ix_(rows, cols)] += 1
    over, holes = float((cov > 1).mean()), float((cov == 0).mean())
    if over > 0.01 or holes > 0.03:
        return None, f"cells overlap {over:.1%}, holes {holes:.1%}"
    return (sorted(out), s / n), None


def _target(look):
    """(the set's dir, meta, quarter turns, scale) a look paints with, or None."""
    if isinstance(look, dict):
        ref, q, sc = look.get("set"), int(look.get("turn", 0) or 0) // 90 % 4, float(look.get("scale", 1.0) or 1.0)
    else:
        ref, q, sc = look, 0, 1.0
    if not isinstance(ref, str) or not ref.startswith("pbr/"):
        return None
    d = PBR.set_dir(ref)
    m = PBR.meta(d) if d.is_dir() else None
    return (d, m, q, sc) if m else None


def cells(look):
    """The cells of the set a slot is painted with (see the module's words), or None (no layout of its own, a colour,
    a set not on this machine's shelf, no numpy or Pillow)."""
    t = _target(look)
    if t is None:
        return None
    d, m, q, sc = t
    if m.get("cells") is False:
        return None
    key = (str(d), m.get("stamp"), q)
    if key not in _cache:
        try:
            a = _gray(d, m, q)
            _cache[key] = find(a)[0] if a is not None else None
        except ImportError:
            return None
    found = _cache[key]
    if not found:
        return None
    rects, seam = found
    tile = float((m.get("tile_v_m") if q % 2 else None) or m.get("tile_m") or 2.0) * sc   # as pbrmix sizes a turned set
    return {"tile": round(tile, 4), "rects": rects, "seam": round(seam * tile, 5)}


def why(look):
    """Why a set has no cells (the PBR check and the shelf's words): None when it has."""
    t = _target(look)
    if t is None:
        return "not a set on this shelf"
    d, m, q, sc = t
    if m.get("cells") is False:
        return "its meta.json says cells: false"
    a = _gray(d, m, q)
    return "no maps" if a is None else find(a)[1]
