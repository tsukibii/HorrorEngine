"""Sheets crumpled, folded and laid down, by position-based dynamics in numpy: paper that doesn't stretch (every edge
keeps its length), bends (the distance across each pair of triangles) and keeps its bends as creases once they go past
a yield (plasticity), never passes through itself (its particles keep their distance), and lies on the floor.

    crumple: squeezed in a shrinking sphere (a fist), then let go: it springs back a little and keeps its creases
    fold:    a straight crease at a line of the flat sheet (a newspaper folded in half), the far side turned over
    drape:   gravity onto z = 0, friction, the creases holding the paper up where they do

The sheet is the mid-surface (vertices, triangles); the mesh's two faces are offset from it afterwards."""
import math

import numpy as np

from . import noise as N


class Paper:
    def __init__(self, X, T, flat, stiff=0.08, yield_=0.02, plastic=0.25):
        """X (n, 3) the start, T (m, 3) triangles, flat (n, 2) the flat sheet's coordinates (metres)."""
        self.X = np.asarray(X, float).copy()
        self.V = np.zeros_like(self.X)
        self.T = np.asarray(T, np.int64)
        self.flat = np.asarray(flat, float)
        e = np.concatenate([self.T[:, [0, 1]], self.T[:, [1, 2]], self.T[:, [2, 0]]])
        opp = np.concatenate([self.T[:, 2], self.T[:, 0], self.T[:, 1]])
        key = np.sort(e, 1)
        order = np.lexsort((key[:, 1], key[:, 0]))
        ks, op = key[order], opp[order]
        same = np.all(ks[1:] == ks[:-1], 1)
        self.E, first = np.unique(ks, axis=0, return_index=True)
        self.L0 = np.linalg.norm(self.flat[self.E[:, 0]] - self.flat[self.E[:, 1]], axis=1)
        # bending pairs: the two vertices across each inner edge
        i = np.nonzero(same)[0]
        self.B = np.stack([op[i], op[i + 1]], 1)
        self.D0 = np.linalg.norm(self.X[self.B[:, 0]] - self.X[self.B[:, 1]], axis=1)
        self.Dflat = np.linalg.norm(self.flat[self.B[:, 0]] - self.flat[self.B[:, 1]], axis=1)
        self.stiff, self.yield_, self.plastic = stiff, yield_, plastic
        self.h = float(np.median(self.L0))
        self.n = len(self.X)
        self.pinned = np.zeros(self.n, bool)

    # -- constraints (Jacobi: every correction averaged, then applied together)
    def _apply(self, P, idx, corr, w=1.0):
        acc = np.zeros_like(P)
        cnt = np.bincount(idx, minlength=self.n).astype(float)
        for k in range(3):
            acc[:, k] = np.bincount(idx, weights=corr[:, k], minlength=self.n)
        m = (~self.pinned)[:, None]
        P += w * acc / np.maximum(cnt, 1)[:, None] * m

    def stretch(self, P, w=1.6):
        a, b = self.E[:, 0], self.E[:, 1]
        d = P[b] - P[a]
        L = np.maximum(np.linalg.norm(d, axis=1), 1e-12)
        c = ((L - self.L0) / L * 0.5)[:, None] * d
        self._apply(P, np.concatenate([a, b]), np.concatenate([c, -c]), w)

    def bend(self, P, w=1.0):
        a, b = self.B[:, 0], self.B[:, 1]
        d = P[b] - P[a]
        L = np.maximum(np.linalg.norm(d, axis=1), 1e-12)
        c = ((L - self.D0) / L * 0.5 * self.stiff)[:, None] * d
        self._apply(P, np.concatenate([a, b]), np.concatenate([c, -c]), w)

    def creases(self, P):
        """Bends past the yield set: the rest distance across moves part of the way to the present one."""
        a, b = self.B[:, 0], self.B[:, 1]
        D = np.linalg.norm(P[b] - P[a], axis=1)
        over = np.abs(D - self.D0) > self.yield_ * self.Dflat
        self.D0[over] += (D[over] - self.D0[over]) * self.plastic

    def collide(self, P, d=None):
        """Particles closer than d (that weren't near on the flat sheet) pushed apart."""
        d = d or self.h * 0.85
        i, j = pairs_within(P, d)
        if not len(i):
            return
        far = np.linalg.norm(self.flat[i] - self.flat[j], axis=1) > d * 1.6
        i, j = i[far], j[far]
        v = P[i] - P[j]
        L = np.linalg.norm(v, axis=1)
        close = L < d
        i, j, v, L = i[close], j[close], v[close], np.maximum(L[close], 1e-9)
        if not len(i):
            return
        c = ((d - L) / L * 0.5)[:, None] * v
        self._apply(P, np.concatenate([i, j]), np.concatenate([c, -c]), 1.0)

    def floor(self, P, z=0.0, friction=0.6):
        below = P[:, 2] < z
        if below.any():
            P[below, 2] = z
            P[below, :2] = self.X[below, :2] + (P[below, :2] - self.X[below, :2]) * (1 - friction)

    # -- stepping
    def step(self, dt=1.0, gravity=0.0, damping=0.9, iters=6, sphere=None, ground=None, collide=True, pull=None):
        P = self.X + self.V * damping * dt
        if gravity:
            P[:, 2] -= gravity * dt * dt
        if pull is not None:
            c, k = pull
            P += (c - P) * k
        P[self.pinned] = self.X[self.pinned]
        pairs = None
        if collide:
            d = self.h * 0.85
            i, j = pairs_within(P, d * 1.25)
            if len(i):
                far = np.linalg.norm(self.flat[i] - self.flat[j], axis=1) > d * 1.6
                pairs = (i[far], j[far], d)
        for it in range(iters):
            self.stretch(P)
            self.bend(P)
            if sphere is not None:
                c, R = sphere
                v = P - c
                L = np.linalg.norm(v, axis=1)
                out = L > R
                P[out] = c + v[out] * (R / L[out])[:, None]
            if ground is not None:
                self.floor(P, ground)
            if pairs is not None and len(pairs[0]):
                i, j, d = pairs
                v = P[i] - P[j]
                L = np.linalg.norm(v, axis=1)
                close = L < d
                if close.any():
                    ii, jj, vv, LL = i[close], j[close], v[close], np.maximum(L[close], 1e-9)
                    c = ((d - LL) / LL * 0.5)[:, None] * vv
                    self._apply(P, np.concatenate([ii, jj]), np.concatenate([c, -c]), 1.0)
        self.stretch(P)
        self.V = (P - self.X) / dt
        self.X = P


def pairs_within(P, d):
    """All pairs (i < j) of points closer than d, through a grid of d-sized cells."""
    lo = P.min(0)
    cell = np.floor((P - lo) / d).astype(np.int64)
    dims = cell.max(0) + 3
    cell += 1
    key = (cell[:, 0] * dims[1] + cell[:, 1]) * dims[2] + cell[:, 2]
    order = np.argsort(key, kind="stable")
    ks = key[order]
    uk, start, cnt = np.unique(ks, return_index=True, return_counts=True)
    I, J = [], []
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for dz in (-1, 0, 1):
                if (dx, dy, dz) < (0, 0, 0):
                    continue
                nk = ((cell[:, 0] + dx) * dims[1] + cell[:, 1] + dy) * dims[2] + cell[:, 2] + dz
                pos = np.searchsorted(uk, nk)
                pos = np.minimum(pos, len(uk) - 1)
                ok = uk[pos] == nk
                src = np.nonzero(ok)[0]
                if not len(src):
                    continue
                c = cnt[pos[src]]
                s0 = start[pos[src]]
                tot = int(c.sum())
                ii = np.repeat(src, c)
                jj = order[np.repeat(s0, c) + (np.arange(tot) - np.repeat(np.cumsum(c) - c, c))]
                keep = ii != jj if (dx, dy, dz) != (0, 0, 0) else ii < jj
                I.append(ii[keep])
                J.append(jj[keep])
    if not I:
        return np.zeros(0, np.int64), np.zeros(0, np.int64)
    i, j = np.concatenate(I), np.concatenate(J)
    a, b = np.minimum(i, j), np.maximum(i, j)
    pk = np.unique(a * len(P) + b)
    return pk // len(P), pk % len(P)


# ---- what's done to a sheet ---------------------------------------------------------------------------------------------

def random_folds(pp, count, seed, max_angle=150.0):
    """Folds about random lines of the flat sheet near its middle, each turning the far side about the line as it now
    lies in space (the chord between two of its points): the sheet goes from flat to a tangle in a few moves."""
    r = N.rng(seed, "folds")
    f = pp.flat
    ctr = f.mean(0)
    span = f.max(0) - f.min(0)
    for _ in range(count):
        p0 = ctr + r.uniform(-0.25, 0.25, 2) * span
        a = r.uniform(0, math.pi)
        d = np.array([math.cos(a), math.sin(a)])
        side = ((f - p0) @ np.array([-d[1], d[0]])) > 0
        if side.sum() > len(f) / 2:
            side = ~side
        # the line in space: the vertices nearest two points of it
        i0 = int(np.argmin(np.linalg.norm(f - (p0 - d * span.max() * 0.2), axis=1)))
        i1 = int(np.argmin(np.linalg.norm(f - (p0 + d * span.max() * 0.2), axis=1)))
        A, B = pp.X[i0], pp.X[i1]
        ax = B - A
        if np.linalg.norm(ax) < 1e-6:
            continue
        ax /= np.linalg.norm(ax)
        ang = math.radians(r.uniform(60, max_angle)) * r.choice([-1, 1])
        K = np.array([[0, -ax[2], ax[1]], [ax[2], 0, -ax[0]], [-ax[1], ax[0], 0]])
        Rm = np.eye(3) + math.sin(ang) * K + (1 - math.cos(ang)) * K @ K
        pp.X[side] = (pp.X[side] - A) @ Rm.T + A
        # let it find its lengths again before the next one
        for _k in range(6):
            pp.step(damping=0.3, iters=4, collide=True)
    return pp


def crumple(pp, amount=0.7, seed=0, steps=90, release=30, folds=None, log=None):
    """Crumpled in the hands: a few random folds, then squeezed (every particle pulled to the middle, a sphere shrinking
    round it to (1 - 0.8 amount) of its start), the bends setting as creases, then let go to spring back a little."""
    r = N.rng(seed, "crumple")
    X = pp.X
    c = X.mean(0)
    R0 = float(np.linalg.norm(X - c, axis=1).max()) * 1.02
    q = pp.flat / max(pp.flat.max(), 1e-9) * 3.0
    off = r.uniform(-50, 50, 3)
    for k in range(3):
        pp.X[:, k] += N.fbm3(np.stack([q[:, 0] + off[k], q[:, 1] - off[k], np.full(len(q), off[k])], 1), seed + k, 3) * R0 * (0.06 if k == 2 else 0.02)
    random_folds(pp, int(folds if folds is not None else 2 + round(4 * amount)), seed)
    c = pp.X.mean(0)
    Rs = float(np.linalg.norm(pp.X - c, axis=1).max()) * 1.02
    R1 = R0 * (1 - 0.8 * np.clip(amount, 0, 1))
    for s in range(steps):
        t = (s + 1) / steps
        R = Rs + (min(R1, Rs) - Rs) * (1 - (1 - t) ** 2)
        cc = c + r.normal(0, R0 * 0.008, 3)
        pp.step(sphere=(cc, R), pull=(cc, 0.012 * amount), damping=0.5, iters=4, collide=True)
        pp.creases(pp.X)
        if log and s % 30 == 0:
            log(f"    crumple {s}/{steps}")
    for s in range(release):
        pp.step(damping=0.5, iters=4, collide=True)
    return pp


def fold(pp, a, b, angle=175.0, radius=0.002, side=1, under=True):
    """Folds the flat sheet along the line through flat points a and b by `angle` degrees: the part on `side` turns
    about the line round a crease of `radius` metres, under the rest (its front stays outside, as a newspaper's
    front page does) or, with under false, over it. On a flat sheet (z = 0) only."""
    a, b = np.asarray(a, float), np.asarray(b, float)
    d = (b - a) / np.linalg.norm(b - a)
    nrm = np.array([-d[1], d[0]])
    s = (pp.flat - a) @ nrm * side           # distance across the line on the flat sheet
    ang = math.radians(angle)
    arc = radius * ang                       # the crease's own length
    X = pp.X.copy()
    along = (pp.flat - a) @ d
    p0 = a[None, :] + along[:, None] * d[None, :]
    out = s > 0
    # inside the crease: wrapped round a cylinder of the radius; past it: flat, turned by the full angle
    t = np.clip(s / max(arc, 1e-12), 0, 1)
    phi = t * ang
    inside = out & (s <= arc)
    beyond = s > arc
    side_dir = np.concatenate([nrm * side, [0]])
    for msk in (inside, beyond):
        if not msk.any():
            continue
        ph = phi[msk]
        rem = np.where(beyond[msk], s[msk] - arc, 0.0)
        # centre of the crease's cylinder sits radius above the line
        cx = np.sin(ph) * radius
        cz = radius - np.cos(ph) * radius
        # then the rest runs on, tangent at the end of the arc
        tx = np.cos(ph)
        tz = np.sin(ph)
        loc = cx + tx * rem
        hz = cz + tz * rem
        X[msk, :2] = p0[msk] + side_dir[None, :2] * loc[:, None]
        X[msk, 2] = pp.X[msk, 2] + (-hz if under else hz)
    pp.X = X
    pp.D0 = np.linalg.norm(X[pp.B[:, 0]] - X[pp.B[:, 1]], axis=1)
    return pp


def curl(pp, edge="top", amount=0.25, radius=0.03):
    """An edge lifted and rolled: the flat sheet past (1 - amount) of its height toward `edge` bent round a radius."""
    f = pp.flat
    lo, hi = f.min(0), f.max(0)
    axis = {"top": (1, 1), "bottom": (1, -1), "right": (0, 1), "left": (0, -1)}[edge]
    k, sgn = axis
    span = hi[k] - lo[k]
    start = hi[k] - amount * span if sgn > 0 else lo[k] + amount * span
    s = (f[:, k] - start) * sgn
    m = s > 0
    ph = s[m] / radius
    X = pp.X.copy()
    X[m, k] = start + sgn * np.sin(ph) * radius
    X[m, 2] += radius * (1 - np.cos(ph))
    pp.X = X
    pp.D0 = np.linalg.norm(X[pp.B[:, 0]] - X[pp.B[:, 1]], axis=1)
    return pp


def drape(pp, steps=60, gravity=0.0003, friction=0.7, stiff=0.5, log=None):
    """Lets the sheet settle onto z = 0 from where it is (lowest point on the floor), friction holding what touches.
    Paper lying down springs back to its creases (no new ones set, a stiffer bend) instead of wrinkling like cloth."""
    pp.X[:, 2] -= pp.X[:, 2].min()
    pp.V[:] = 0
    keep = pp.stiff
    pp.stiff = max(pp.stiff, stiff)
    for s in range(steps):
        pp.step(gravity=gravity, damping=0.7, iters=4, ground=0.0, collide=True)
    pp.stiff = keep
    pp.X[:, 2] -= pp.X[:, 2].min()
    return pp


# ---- cloth: bedding (families/bedding.py; the user, 2026-11-04: "proper better pillows and blankets") -------------------

class Cloth(Paper):
    """Cloth: the paper's solver with a soft bend that springs back (no creases set), for pillows and blankets. Thick (its
    layers kept `thick` apart: a quilted futon's 5 cm), pushed by gravity or a filling's pressure (a pillow: a bag sewn
    from two pieces, inflated until its volume is reached), lying on supports (boxes with rounded edges: a futon, a
    mattress, a headboard) and the floor with friction, tied where it's tufted (a zabuton's middle). `sep`: the points'
    places for telling apart what was near on the cloth (a bag's two pieces lie on one flat: one is put a metre off)."""

    def __init__(self, X, T, flat, stiff=0.02, thick=0.0, sep=None):
        super().__init__(X, T, flat, stiff=stiff, yield_=1e9, plastic=0.0)
        self.thick = float(thick)
        self.d = max(self.h * 0.85, self.thick)
        self.sep = np.asarray(sep if sep is not None else np.concatenate([self.flat, np.zeros((self.n, 1))], 1), float)
        self.ties = None              # (i, j, dist): held within dist of each other

    def normals(self, P=None):
        P = self.X if P is None else P
        a, b, c = P[self.T[:, 0]], P[self.T[:, 1]], P[self.T[:, 2]]
        fn = np.cross(b - a, c - a)
        n = np.zeros_like(P)
        for k in range(3):
            for j in range(3):
                n[:, j] += np.bincount(self.T[:, k], weights=fn[:, j], minlength=self.n)
        return n / np.maximum(np.linalg.norm(n, axis=1), 1e-12)[:, None]

    def volume(self, P=None):
        """The volume a closed cloth holds (outward triangles)."""
        P = self.X if P is None else P
        a, b, c = P[self.T[:, 0]], P[self.T[:, 1]], P[self.T[:, 2]]
        return float(np.einsum("ij,ij->i", a, np.cross(b, c)).sum() / 6.0)

    def _contact(self, P, X0, idx, g, push, fr):
        """Points idx pushed out along g by push; their slide since the step began kept by (1 - fr)."""
        P[idx] += g * push[:, None]
        if fr > 0:
            mv = P[idx] - X0[idx]
            nm = (mv * g).sum(1, keepdims=True) * g
            P[idx] = X0[idx] + nm + (mv - nm) * (1 - fr)

    def boxes(self, P, X0, boxes, pad, fr):
        for lo, hi, r in boxes:
            lo, hi = np.asarray(lo, float), np.asarray(hi, float)
            c, half = (lo + hi) / 2, (hi - lo) / 2 - r
            rel = P - c
            q = np.abs(rel) - half
            outq = np.maximum(q, 0)
            ol = np.linalg.norm(outq, axis=1)
            d = ol + np.minimum(q.max(1), 0) - r
            hit = np.nonzero(d < pad)[0]
            if not len(hit):
                continue
            g, gl = outq[hit], ol[hit]
            inner = gl < 1e-9
            if inner.any():                          # inside the box's core: out through its nearest face
                ax = q[hit][inner].argmax(1)
                gi = np.zeros((int(inner.sum()), 3))
                gi[np.arange(len(ax)), ax] = 1.0
                g[inner], gl[inner] = gi, 1.0
            g = g / gl[:, None] * np.where(rel[hit] >= 0, 1.0, -1.0)
            self._contact(P, X0, hit, g, pad - d[hit], fr)

    def step(self, gravity=0.0, damping=0.92, iters=8, boxes=(), floor=0.0, friction=0.5, pressure=0.0, collide=True, spheres=(), pad=None,
             extra=None):
        """One step; `extra(P, X0)` a constraint of the caller's own, projected every iteration after the others (a
        curtain's tie-back ring)."""
        X0 = self.X
        P = X0 + self.V * damping
        if gravity:
            P[:, 2] -= gravity
        if pressure:
            P += self.normals(P) * pressure
        P[self.pinned] = X0[self.pinned]
        pad = self.thick / 2 + 0.002 if pad is None else pad
        fr = 1 - (1 - friction) ** (1.0 / iters)     # the friction a step spread over its iterations
        pairs = None
        if collide:
            i, j = pairs_within(P, self.d * 1.2)
            if len(i):
                far = np.linalg.norm(self.sep[i] - self.sep[j], axis=1) > self.d * 1.6
                pairs = (i[far], j[far])
        for _ in range(iters):
            self.stretch(P)
            self.bend(P)
            if self.ties is not None:
                ti, tj, td = self.ties
                v = P[tj] - P[ti]
                L = np.maximum(np.linalg.norm(v, axis=1), 1e-12)
                over = L > td
                if over.any():
                    c = ((L[over] - td[over]) / L[over] * 0.5)[:, None] * v[over]
                    self._apply(P, np.concatenate([ti[over], tj[over]]), np.concatenate([c, -c]), 1.0)
            for c, R in spheres:
                v = P - np.asarray(c, float)
                L = np.maximum(np.linalg.norm(v, axis=1), 1e-12)
                hit = np.nonzero(L < R + pad)[0]
                if len(hit):
                    self._contact(P, X0, hit, v[hit] / L[hit, None], R + pad - L[hit], fr)
            if boxes:
                self.boxes(P, X0, boxes, pad, fr)
            if extra is not None:
                extra(P, X0)
            if floor is not None:
                hit = np.nonzero(P[:, 2] < floor + pad)[0]
                if len(hit):
                    g = np.zeros((len(hit), 3))
                    g[:, 2] = 1.0
                    self._contact(P, X0, hit, g, floor + pad - P[hit, 2], fr)
            if pairs is not None and len(pairs[0]):
                pi, pj = pairs
                v = P[pi] - P[pj]
                L = np.linalg.norm(v, axis=1)
                close = L < self.d
                if close.any():
                    ii, jj, vv, LL = pi[close], pj[close], v[close], np.maximum(L[close], 1e-9)
                    c = ((self.d - LL) / LL * 0.5)[:, None] * vv
                    self._apply(P, np.concatenate([ii, jj]), np.concatenate([c, -c]), 1.0)
        self.V = P - X0
        self.X = P


def inflate(cl, volume, steps=220, pressure=0.0012, floor=None, iters=18, log=None):
    """A bag filled: pushed out along its normals until it holds `volume` (m³), the push easing as it nears it. Many
    iterations a step keep the cloth from stretching, so it buckles instead: the folds at a pillow's corners."""
    for s in range(steps):
        v = cl.volume()
        p = pressure * float(np.clip(1 - v / volume, 0, 1)) ** 0.5
        cl.step(pressure=p, damping=0.6, iters=iters, floor=floor, friction=0.3, collide=True)
    return cl


def settle(cl, steps=160, gravity=0.0004, boxes=(), floor=0.0, friction=0.55, pressure=0.0, volume=None, spheres=(), damping=0.85):
    """Gravity onto what the cloth lies on until it's still; a bag keeps its filling (pressure toward its volume)."""
    for s in range(steps):
        p = 0.0
        if volume:
            p = pressure * float(np.clip(1 - cl.volume() / volume, 0, 1)) ** 0.5
        cl.step(gravity=gravity, damping=damping, iters=8, boxes=boxes, floor=floor, friction=friction, pressure=p, spheres=spheres)
    return cl


def hinge(cl, axis, at, side, t):
    """Folds what lies past a line (x = at for axis 0, y = at for axis 1; side +1 beyond it, -1 before it) over onto
    the rest, rolled round the line rather than creased: each layer past it bends in a half circle about the fold's
    middle (the outer layers of a stack wider), then lies flat a layer's thickness `t` over the rest's top (a futon
    folded for the oshiire). The bends are kept as they are (a fold that stays folded)."""
    X = cl.X
    s = (X[:, axis] - at) * side
    m = s > 0
    if not m.any() or m.all():
        return cl
    src_top, dst_top = X[m, 2].max(), X[~m, 2].max()
    zc = (src_top + dst_top + t) / 2                    # the bend's middle: the part folded lands a layer over the rest
    rho = np.maximum(zc - X[m, 2], 1e-4)                # each layer round it at its own radius
    sm = s[m]
    a = np.minimum(sm / rho, np.pi)
    on_arc = sm < np.pi * rho
    X[m, axis] = np.where(on_arc, at + side * rho * np.sin(a), at - side * (sm - np.pi * rho))
    X[m, 2] = np.where(on_arc, zc - rho * np.cos(a), zc + rho)
    cl.V[:] = 0
    cl.D0 = np.linalg.norm(X[cl.B[:, 0]] - X[cl.B[:, 1]], axis=1)
    return cl
    src_top, dst_top = X[m, 2].max(), X[~m, 2].max()
    zm = (src_top + dst_top + t) / 2
    X[m, axis] = 2 * at - X[m, axis]
    X[m, 2] = 2 * zm - X[m, 2]
    cl.V[:] = 0
    cl.D0 = np.linalg.norm(X[cl.B[:, 0]] - X[cl.B[:, 1]], axis=1)
    return cl
