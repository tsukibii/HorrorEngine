"""Clothing layers for the fit test (the user, 2026-11-11: "if a piece of clothing is higher in the layer the layer
below can never clip through"; "skirts ... always below the waistband"). ../fit_test.md §7.

Every garment has a kind and a layer; what's worn is put in order, innermost first. Cloth is compared with cloth
directly (a point against the nearest place on the other garment's surface), and which way is "out" there is the
body's own outward direction, never the cloth's faces. What each garment covers is laid on the skin (which skin
vertices it lies over, and how close), so that "how far inside its edge" is a distance along the body.

  order       a garment's kind from its shape and name (shoes, legs, socks, trousers, skirt, top, dress, suit, outer,
              coat, hat), its layer from the kind: bottoms under tops (a top hangs over a waistband; `tuck` puts it
              under)
  resolve     going outward, each garment against everything under it: a point of the upper one that is under the
              lower one's surface (or nearer than a gap) is a conflict; the lower gives most of it and the upper the
              rest; the lower never goes into the skin nor through what it lies on; then once more with only the
              upper one moving. Judged at points on the triangles too, and both ways, so a coarse garment's flat faces
              don't cut through a fine one. A shoe is never bent
  hide        the part of a lower garment (and of the skin) an opaque upper one covers closely is left out, from
              INSET inside the upper one's edge: nothing is there to come through, in any pose; `cover` is how deep
              inside each point is, for a dissolve at the edge; kept by the band of what covers, for Godot
  crossings   the fault counted: points of a garment that stand outside something worn over it and are still drawn
"""
import re

import numpy as np
import scipy.sparse as sp
from scipy.sparse.csgraph import dijkstra
from scipy.spatial import cKDTree

import lib

GAP = 0.0025        # cloth over cloth: metres between a layer's outside and the next one's inside
H_MIN = 0.0015      # the least a layer stands off the skin
SKIN_GAP = 0.002    # a library garment's faces over the skin
SHARE = 0.65        # of a conflict, the part the lower layer gives; the upper is pushed out by the rest
NEAR = 0.05         # cloth is compared with cloth this near it
REACH_M = 0.08      # a push fades out over this much cloth round it
RIGID = ("shoes", "hat", "accessory")     # these keep their shape: what's under them goes in, what's over them out
INSET = 0.035       # hidden from this far inside the covering garment's edge (the tailor's own inset, TAILOR §3d)
FADE = 0.02         # the dissolve's width past INSET
EDGE = dict(shoes=(0.012, 0.008), socks=(0.012, 0.008), legs=(0.012, 0.008), under=(0.012, 0.008))   # (INSET, FADE) under things whose edge lies tight on what's under it: nothing to look in under
CLOSE = 0.04        # an upper garment further than this above what's under it doesn't hide it (a skirt over legs, an open coat)
REACH = INSET + FADE + 0.05     # how far from an edge depths are measured
SHOWN = -8.0        # a cover for "nowhere near being covered"

LAYER = dict(under=10, legs=15, socks=16, shoes=20, trousers=30, skirt=30, top=40, dress=40, suit=40, outer=60, coat=70,
             hat=90, accessory=95)
NAMES = [("accessory", r"bag|glasses|goggle|watch|necklace|earring|bracelet|tie$|scarf|belt|mask|guitar|racket"),
         ("hat", r"hat|cap$|fedora|helmet|beanie|hood$"),
         ("shoes", r"shoe|boot|sneaker|loafer|flats?$|sandal|oxford|heel|pump"),
         ("socks", r"sock"),
         ("legs", r"stocking|pantyhose|tights|leggings|fishnet"),
         ("coat", r"coat|parka|robe|kimono"),
         ("outer", r"jacket|cardigan|blazer|hoodie|vest|lusekofta"),
         ("dress", r"dress|gown|qipao"),
         ("skirt", r"skirt"),
         ("trousers", r"trouser|pant|jean|shorts|slacks"),
         ("suit", r"suit|coverall|overall"),
         ("top", r"shirt|sweater|top$|blouse|tee|polo|knit")]
SLOTS = dict(under="under", legs="legs", bottom="trousers", top="top", full="dress", jacket="outer")


class Body:
    """The character's skin as the thing cloth is measured on."""

    def __init__(self, P, T):
        self.P, self.T = P, T
        self.N = lib.vnormals(P, T)
        self.tree = cKDTree((P[T[:, 0]] + P[T[:, 1]] + P[T[:, 2]]) / 3.0)
        n = len(P)
        E = np.vstack([T[:, [0, 1]], T[:, [1, 2]], T[:, [2, 0]]])
        E = np.unique(np.sort(E, axis=1), axis=0)
        L = np.linalg.norm(P[E[:, 0]] - P[E[:, 1]], axis=1)
        self.graph = sp.coo_matrix((np.r_[L, L], (np.r_[E[:, 0], E[:, 1]], np.r_[E[:, 1], E[:, 0]])), shape=(n, n)).tocsr()
        A = sp.coo_matrix((np.ones(len(E) * 2), (np.r_[E[:, 0], E[:, 1]], np.r_[E[:, 1], E[:, 0]])), shape=(n, n)).tocsr()
        self.nb = A
        self.avg = sp.diags(1.0 / np.maximum(np.asarray(A.sum(1)).ravel(), 1)) @ A

    def at(self, X):
        """each point's place on the skin: {t, b: the triangle and where in it; cp; n: the skin's smooth normal there;
        h: its height off the skin (under it: negative); v: the skin vertex nearest}"""
        t, b, cp, _ = lib.closest_on_tris(X, self.P, self.T, k=12, tree=self.tree)
        n = self.N[self.T[t, 0]] * b[:, :1] + self.N[self.T[t, 1]] * b[:, 1:2] + self.N[self.T[t, 2]] * b[:, 2:3]
        n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-20
        d = X - cp
        dist = np.linalg.norm(d, axis=1)
        h = np.where(np.einsum("ij,ij->i", d, n) < 0, -dist, dist)
        return dict(t=t, b=b, cp=cp, n=n, h=h, v=self.T[t, np.argmax(b, axis=1)])

    def field(self, at, h):
        """a garment's heights laid on the skin's vertices: (its outside, its inside, where it covers)"""
        nv = len(self.P)
        hi = np.full(nv, -np.inf); lo = np.full(nv, np.inf)
        np.maximum.at(hi, at["v"], h); np.minimum.at(lo, at["v"], h)
        cov = np.isfinite(lo)
        for _ in range(2):                                           # a vertex its samples missed, among ones they didn't
            share = self.avg @ cov.astype(float)
            fill = ~cov & (share >= 0.6)
            if not fill.any():
                break
            w = self.nb[fill][:, cov]
            cnt = np.maximum(np.asarray(w.sum(1)).ravel(), 1)
            hi[fill] = np.asarray(w @ hi[cov]).ravel() / cnt; lo[fill] = np.asarray(w @ lo[cov]).ravel() / cnt
            cov = cov | fill
        return hi, lo, cov

    def inside(self, open_):
        """how far along the skin each vertex is from the nearest one where `open_` holds"""
        src = np.where(open_)[0]
        if not len(src):
            return np.full(len(self.P), np.inf)
        return dijkstra(self.graph, indices=src, min_only=True, limit=REACH)

    def depth(self, covered):
        """how deep inside `covered` each vertex is, along the skin: metres from its edge, negative outside it
        (signed, so that a value carried to a coarse garment's corners still crosses zero at the edge)"""
        return np.where(covered, np.minimum(self.inside(~covered), REACH), -np.minimum(self.inside(covered), REACH))


def samples(P, T, step=0.007):
    """a mesh's points and more on its triangles, about `step` apart (a coarse garment laid on a finer skin), and
    for each the three corners it belongs to (a point of the mesh: itself)"""
    out = [P]
    own = [np.repeat(np.arange(len(P))[:, None], 3, axis=1)]
    A, B, C = P[T[:, 0]], P[T[:, 1]], P[T[:, 2]]
    e = np.maximum(np.maximum(np.linalg.norm(B - A, axis=1), np.linalg.norm(C - B, axis=1)), np.linalg.norm(A - C, axis=1))
    n = np.clip(np.ceil(e / step).astype(int), 1, 12)
    for k in np.unique(n):
        m = n == k
        if k == 1:
            out.append((A[m] + B[m] + C[m]) / 3.0); own.append(T[m]); continue
        ij = [(i, j) for i in range(k + 1) for j in range(k + 1 - i) if (i, j) not in ((0, 0), (k, 0), (0, k))]
        w = np.array([(i / k, j / k, 1 - (i + j) / k) for i, j in ij])
        out.append((w[:, 0, None, None] * A[m] + w[:, 1, None, None] * B[m] + w[:, 2, None, None] * C[m]).reshape(-1, 3))
        own.append(np.tile(T[m], (len(ij), 1)))
    return np.vstack(out), np.vstack(own)


def smooth_adj(n, T):
    E = np.vstack([T[:, [0, 1]], T[:, [1, 2]], T[:, [2, 0]], T[:, [1, 0]], T[:, [2, 1]], T[:, [0, 2]]])
    A = sp.coo_matrix((np.ones(len(E)), (E[:, 0], E[:, 1])), shape=(n, n)).tocsr(); A.data[:] = 1.0
    return sp.diags(1.0 / np.maximum(np.asarray(A.sum(1)).ravel(), 1)) @ A


def kind_of(name, rest, height, rig_at, rig_names, tags=()):
    """a garment's kind: by its name when the name says, else by where it lies on the average body at rest"""
    key = (name + " " + " ".join(tags)).lower()
    for kind, pat in NAMES:
        if re.search(pat, key):
            named = kind; break
    else:
        named = None
    y = rest[:, 1] / height
    y0, y1 = float(np.percentile(y, 1)), float(np.percentile(y, 99))
    crotch = (rig_at[rig_names.index("l_upleg")][1] - 0.085) / height
    skirtlike = float(np.mean((np.abs(rest[:, 0]) < 0.03) & (y < crotch - 0.04))) > 0.01
    if y1 < 0.14:
        shape = "shoes"
    elif y0 > 0.8:
        shape = "hat"
    elif y1 > 0.7 and y0 < crotch - 0.06:
        shape = "dress" if skirtlike else "suit"
    elif y1 > 0.7:
        shape = "top"
    elif y1 < 0.52 and not skirtlike and y0 < 0.3 and y1 < crotch + 0.02:
        shape = "legs"
    else:
        shape = "skirt" if skirtlike else "trousers"
    if named in ("accessory", "hat", "shoes", "socks", "legs"):
        return named
    if named == "outer" and shape in ("top", "dress", "suit"):
        return "outer" if shape == "top" else "coat"
    if named == "coat" and shape in ("top", "dress", "suit"):
        return "coat"
    if named in ("skirt", "trousers") and shape in ("skirt", "trousers", "legs"):
        return named
    if named == "dress" and shape in ("dress", "suit", "top"):
        return "dress"
    return named if named in ("suit", "top") and shape == named else shape


class Garment:
    """something worn: its points (to be moved), its triangles, its kind and layer, whether it's opaque. `dense`: its
    own points are close enough together to stand for it; `group`: garments made together, already set on one another
    (the tailor's), which are left as they are among themselves"""

    def __init__(self, name, P, T, kind, layer=None, opaque=True, dense=False, group=None):
        self.name, self.P, self.T, self.kind = name, P, T, kind
        self.layer = LAYER[kind] if layer is None else layer
        self.opaque, self.dense, self.group = opaque, dense, group
        self.adj = smooth_adj(len(P), T)
        self.cover = np.zeros(len(P))                                # see hide()
        self.moved = dict(inward=0, outward=0)
        self._s = self._n = None
        self.rim = rim(P, T)
        E = np.unique(np.sort(np.vstack([T[:, [0, 1]], T[:, [1, 2]], T[:, [2, 0]]]), axis=1), axis=0)
        w = np.exp(-np.linalg.norm(P[E[:, 0]] - P[E[:, 1]], axis=1) / REACH_M)
        self.edges = (np.r_[E[:, 0], E[:, 1]], np.r_[E[:, 1], E[:, 0]], np.r_[w, w])     # (to, from, how much of a push carries across)

    def sample(self):
        """(points on it, the corners each belongs to)"""
        if self.dense:
            return self.P, np.repeat(np.arange(len(self.P))[:, None], 3, axis=1)
        if self._s is None or self._s[0] is not self.P:
            self._s = (self.P,) + samples(self.P, self.T)
        return self._s[1], self._s[2]

    def facing(self, body):
        """which way is out at each of its points: the skin's own normal at the place on the body nearest the point.
        (Not the cloth's faces: a library garment's wind either way, and a hem's turned edge or a pleat's side face
        nowhere useful.)"""
        if self._n is None or self._n[0] is not self.P:
            self._n = (self.P, body.at(self.P)["n"])
        return self._n[1]

    def least(self, own, val):
        """a value at its samples as the least of it at each corner"""
        out = np.full(len(self.P), np.inf)
        for c in range(3):
            np.minimum.at(out, own[:, c], val)
        return out

    def most(self, own, val, vec=None):
        """a value at its samples as the most of it at each corner (and with `vec`, that sample's vector)"""
        out = np.zeros(len(self.P))
        for c in range(3):
            np.maximum.at(out, own[:, c], val)
        if vec is None:
            return out
        o = np.argsort(val)                                          # the largest last: its vector is the one kept
        dv = np.zeros((len(self.P), 3))
        dv[own[o].ravel()] = np.repeat(vec[o], 3, axis=0)
        return out, dv


def order(garments, tuck=False):
    """innermost first: by layer, then as given; a tucked top goes under the bottoms"""
    for g in garments:
        if tuck and g.kind == "top":
            g.layer = 25
    return sorted(garments, key=lambda g: g.layer)                   # (stable: equal layers keep the order worn)


def _shift(g, dirs, move, hold, own=None):
    """move the points `hold` by `move` metres along `dirs`, and the cloth round them along with them: every other
    point by the most its neighbours move, fading over REACH_M of cloth, along its own way out (`own`) or the way
    its neighbours go. A hem pushed out by a row of pleats moves as one line, not as a zigzag."""
    A = np.where(hold, move, 0.0)
    D = A[:, None] * dirs
    i, j, w = g.edges
    env = A.copy()
    for _ in range(8):
        cand = env[j] * w
        nxt = env.copy()
        np.maximum.at(nxt, i, cand)
        if np.allclose(nxt, env, atol=1e-6):
            break
        env = nxt
    way = D.copy()
    for _ in range(6):                                               # the direction, spread from the points that move
        way = np.where(hold[:, None], D, g.adj @ way)
    n = np.linalg.norm(way, axis=1, keepdims=True)
    way = np.where(n > 1e-12, way / np.maximum(n, 1e-12), 0.0 if own is None else own)
    g.P = g.P + np.where(hold[:, None], D, env[:, None] * way)


def rim(P, T):
    """a mesh's open edges: (per triangle, whether the edge opposite each corner is one; per point, whether it's on
    one). Points in one place count as one point: a garment's parts meet along seams without sharing their points"""
    _, w = np.unique(np.round(P / 1e-4).astype(np.int64), axis=0, return_inverse=True)
    w = w.ravel()
    E = np.vstack([T[:, [1, 2]], T[:, [2, 0]], T[:, [0, 1]]])       # the edge opposite corner 0, 1, 2
    key = np.sort(w[E], axis=1); key = key[:, 0] * (int(w.max()) + 1) + key[:, 1]
    _, inv, cnt = np.unique(key, return_inverse=True, return_counts=True)
    open_ = (cnt[inv.ravel()] == 1).reshape(3, -1).T
    on = np.zeros(len(P), bool)
    on[E[open_.T.ravel()].ravel()] = True
    return open_, on


def _side(S, P, T, VN, edge=None, tri=False):
    """points against a surface: (how far outside it each is, negative under it; the surface's outward normal
    there; whether the comparison holds: the point is near and squarely over or under the surface. A point whose
    nearest place on it is the surface's open edge is past that edge, unless it's straight over the edge itself)"""
    t, b, cp, _ = lib.closest_on_tris(S, P, T, k=12)
    n = VN[T[t, 0]] * b[:, :1] + VN[T[t, 1]] * b[:, 1:2] + VN[T[t, 2]] * b[:, 2:3]
    n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-20
    d = S - cp
    dist = np.linalg.norm(d, axis=1)
    sd = np.einsum("ij,ij->i", d, n)
    square = 0.6
    if edge is not None:
        zero = b < 1e-6
        at_rim = (zero & edge[0][t]).any(1) | ((zero.sum(1) == 2) & edge[1][T[t, np.argmax(b, axis=1)]])
        square = np.where(at_rim, 0.95, 0.6)
    ok = (dist < NEAR) & ((np.abs(sd) > square * dist) | (dist < 0.0015))
    return (sd, n, ok, t) if tri else (sd, n, ok)


def _near(a, b, pad=NEAR):
    return bool(np.all(a.P.min(0) - pad < b.P.max(0)) and np.all(b.P.min(0) - pad < a.P.max(0)))


def _against(S, G, body):
    """points against the garment G: (whether the comparison holds; whether the point stands outside G: outside the
    sheet of it nearest the point and every sheet beyond that (a shoe has an insole inside its sole, a jacket a
    lining inside its shell: between two sheets is inside); how far outside the nearest sheet)"""
    VN = G.facing(body)
    sd, n, ok = _side(S, G.P, G.T, VN, G.rim)
    out = ok & (sd > 0)
    idx = np.where(out)[0]
    for step in (0.0015, 0.004, 0.01, 0.02, 0.035):
        if not len(idx):
            break
        sd2, _, ok2 = _side(S[idx] + n[idx] * step, G.P, G.T, VN, G.rim)
        inner = ok2 & (sd2 < 0)                                      # a sheet of G lies further out
        out[idx[inner]] = False
        idx = idx[~inner]
    return ok, out, sd


def _under(worn, k):
    """what garment k is compared with: the ones under it that are near it and weren't made together with it"""
    G = worn[k]
    return [L for L in worn[:k] if not (G.group and L.group == G.group) and _near(L, G)]


def _out(body, G, lowers, share=1.0, goes=1):
    """G out of what's under it (a library garment: out of the skin too), by `share` of each conflict. Judged both
    ways: G's own points against each lower surface, and each lower one's points against G's faces (a pleat's ridge
    between two of G's points)."""
    for _ in range(goes):
        S, own = G.sample()
        need = np.zeros(len(S)); dirn = np.zeros((len(S), 3))
        for P, T, VN, gap in [(L.P, L.T, L.facing(body), GAP) for L in lowers] + ([] if G.dense else [(body.P, body.T, body.N, SKIN_GAP)]):
            sd, n, ok = _side(S, P, T, VN)                          # (near the lower one's edge too: its edge mustn't poke through G)
            nd = np.where(ok, gap - sd, 0.0)
            m = nd > need
            need[m] = nd[m]; dirn[m] = n[m]
        mv, dv = G.most(own, need, dirn)
        for L in lowers:
            SL, _ = L.sample()
            sd, n, ok, t = _side(SL, G.P, G.T, G.facing(body), G.rim, tri=True)
            over = ok & (sd > -0.5 * GAP)
            if over.any():
                m2, d2 = G.most(G.T[t[over]], sd[over] + GAP, n[over])
                up = m2 > mv
                mv = np.where(up, m2, mv); dv = np.where(up[:, None], d2, dv)
        hit = mv > 1e-5
        if hit.any():
            _shift(G, dv, mv * share, hit, G.facing(body))
        if not (mv > 2e-4).any():
            break


def _in(body, L, G, below):
    """L in under G's surface: never into the skin, nor through what's worn under L"""
    S, own = L.sample()
    sd, n, ok = _side(S, G.P, G.T, G.facing(body), G.rim)
    mv, dv = L.most(own, np.where(ok, np.maximum(sd + GAP, 0.0), 0.0), -n)
    if not (mv > 1e-5).any():
        return
    room = np.maximum(body.at(L.P)["h"] - H_MIN, 0.0)
    for K in below:
        sdk, _, okk = _side(S, K.P, K.T, K.facing(body))
        room = np.minimum(room, L.least(own, np.where(okk, np.maximum(sdk - GAP, 0.0), np.inf)))
    i, j, _ = L.edges
    for _ in range(2):                                               # as far in as the cloth round a point can go too: a hem over pleats goes in to their ridges as a line, not down into each valley
        near = room.copy()
        np.minimum.at(near, i, room[j])
        room = near
    mv = np.minimum(mv, room)
    hit = mv > 1e-5
    if hit.any():
        g_before = L.P.copy()
        _shift(L, dv, mv, hit, -L.facing(body))
        # the cloth round a point that moved in went with it: never further than its own room
        d = np.linalg.norm(L.P - g_before, axis=1)
        far = d > room + 1e-9
        if far.any():
            L.P[far] = g_before[far] + (L.P[far] - g_before[far]) * (room[far] / d[far])[:, None]


def resolve(body, worn, rounds=3):
    """every garment outside the ones under it by GAP. Going outward, each against everything under it: of a
    conflict the lower one gives most (as far as the skin and its own lowers let it) and the upper the rest; then
    once more going outward with only the upper one moving, so that at the end nothing is under anything. A rigid
    thing (a shoe) is never bent: what's under it goes in, what's over it goes out. A library garment's faces, not
    only its points, are kept outside the skin."""
    worn = [g for g in worn if g.kind != "accessory"]
    start = [g.P.copy() for g in worn]
    for k, G in enumerate(worn):
        lowers = _under(worn, k)
        soft = [L for L in lowers if L.kind not in RIGID]
        for r in range(rounds if soft else 1):
            if G.kind not in RIGID and (lowers or not G.dense):
                _out(body, G, lowers, (1 - SHARE) if soft else 1.0)
            for L in soft:
                _in(body, L, G, _under(worn, worn.index(L)))
    for k, G in enumerate(worn):
        lowers = _under(worn, k)
        if G.kind not in RIGID and (lowers or not G.dense):
            _out(body, G, lowers, 1.0, goes=8)
    for g, P0 in zip(worn, start):
        d = np.einsum("ij,ij->i", g.P - P0, g.facing(body))
        far = np.linalg.norm(g.P - P0, axis=1) > 2e-4
        g.moved = dict(inward=int((far & (d < 0)).sum()), outward=int((far & (d >= 0)).sum()), most=float(np.linalg.norm(g.P - P0, axis=1).max()))
    return worn


BANDS = ("bottom", "top", "outer", "feet")    # what does the hiding, in four bands a game can switch: see band()


def band(layer):
    """which band a covering garment's layer falls in: 0 bottoms (30..39), 1 tops (40..59), 2 outerwear (60 and
    over), 3 legwear and shoes (under 30). A game that takes the coat off turns band 2 off and what was under it is
    drawn again, with nothing baked again."""
    return 3 if layer < 30 else 0 if layer < 40 else 1 if layer < 60 else 2


def hide(body, worn):
    """what each opaque garment covers closely: on the skin (a number per skin vertex) and on every garment under it
    (its `cover`, per point). A cover is 0 at INSET inside the covering garment's edge and 1 at INSET + FADE, and
    runs on past both (negative in the open): drawn, it's clamped to 0..1, 1 being gone; carried unclamped so a
    coarse garment's triangles dissolve where the edge really is. Kept by the band of what covers too (`covers`,
    four rows; the skin's in `body.covers`): `cover` is the most of them."""
    worn = [g for g in worn if g.kind != "accessory"]
    fields = []
    for g in worn:
        at = body.at(g.sample()[0])
        fields.append(body.field(at, at["h"]))
        g.covers = np.full((4, len(g.P)), SHOWN)
    body.covers = np.full((4, len(body.P)), SHOWN)
    for k, G in enumerate(worn):
        if not G.opaque:
            continue
        _, lo, cov = fields[k]
        inset, fade = EDGE.get(G.kind, (INSET, FADE))
        b = band(G.layer)
        # the skin under G: open where G isn't, or stands far off it
        body.covers[b] = np.maximum(body.covers[b], (body.depth(cov & (lo < CLOSE)) - inset) / fade)
        for j in range(k):
            L = worn[j]
            hiL, _, covL = fields[j]
            far = covL & (lo - np.where(covL, hiL, 0.0) >= CLOSE)     # G hangs away from L here: one can see in
            d = body.depth(cov & ~far)
            atl = body.at(L.P)
            c = ((d[body.T[atl["t"]]] * atl["b"]).sum(1) - inset) / fade
            if G.kind not in RIGID:                                   # (inside a shoe, all of it: its sole may be thinner than a sock)
                ok, out, _ = _against(L.P, G, body)
                c = np.where(ok & ~out, c, np.minimum(c, 0.0))        # only what is under G's surface
            L.covers[b] = np.maximum(L.covers[b], c)
    for g in worn:
        g.cover = g.covers.max(0)
    return body.covers.max(0)


def crossings(body, worn):
    """the fault itself, counted: for each garment, how many of its points (with the faces round them) stand outside
    something worn over it and are still drawn, the deepest of them in metres, and through what"""
    worn = [g for g in worn if g.kind != "accessory"]
    found = []
    for j, L in enumerate(worn):
        S, own = L.sample()
        thr = np.zeros(len(L.P)); by = {}
        for G in worn[j + 1:]:
            if _near(L, G):
                _, outside, sd = _against(S, G, body)
                t = np.where(L.cover < 1, L.most(own, np.where(outside, sd, 0.0)), 0.0)
                if (t > 0).any():
                    by[G.name] = int((t > 0).sum())
                thr = np.maximum(thr, t)
        found.append((L.name, int((thr > 0).sum()), float(thr.max()) if len(thr) else 0.0, by))
    return found
