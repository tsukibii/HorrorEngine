"""Library garments onto MHR (docs/research/clothing_v2/fit_test.md; the prototype's fit.py and lib.py, the part that
is done once per garment): a MakeHuman garment, made on MakeHuman's hm08 base mesh, carried onto MHR's average body in
MHR's rest pose and written as a bake the Character Studio fits to any character in its own JavaScript
(tools/character/tailor/library.js: the same warp from the average body to the character's, then out of the skin).

    the registration   Content/Studio/Clothes/library/hm08_mhr.npz: hm08's skin on MHR's (docs/research/clothing_v2/
                       proto/register.py made it once; hm08 is MakeHuman's base mesh, CC0)
    a bake             <clothing>/_mhr/<id>.bin: a uint32 header length, a JSON header, then its arrays (float32 and
                       uint32, little endian): rest (its welded points on MHR's average, at rest), src (each corner's
                       point), uv (its own, as its author laid it), uv2 (metres: each island at the cloth's own size),
                       tris (corners), cover (the MHR skin points it hides: MakeHuman's delete_verts carried over)
    the body           <clothing>/_mhr/_base.f32: MHR's average at rest, the body every bake stands on

Needs numpy and scipy (uv run --with numpy --with scipy ...): only the bake does; wearing a baked garment needs neither.
"""
import json
import struct
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[3]
REG = ROOT / "Content" / "Studio" / "Clothes" / "library" / "hm08_mhr.npz"
BAKE_VERSION = 1


class lib:                                                           # (the prototype's names for these, kept so its functions read the same)
    pass


def load_obj(path, scale=1.0):
    """{V (n,3), UV (m,2), faces: [(vidx..)], fuv: [(uvidx..)], group: [name per face], vgroups: {name: set of v}}"""
    V, UV, faces, fuv, groups, vg = [], [], [], [], [], {}
    g = "default"
    with open(path, errors="ignore") as f:
        for line in f:
            if line.startswith("v "):
                V.append([float(x) for x in line.split()[1:4]])
            elif line.startswith("vt "):
                UV.append([float(x) for x in line.split()[1:3]])
            elif line.startswith("g "):
                g = line.split()[1] if len(line.split()) > 1 else "default"
            elif line.startswith("f "):
                vi, ti = [], []
                for tok in line.split()[1:]:
                    p = tok.split("/")
                    vi.append(int(p[0]) - 1)
                    ti.append(int(p[1]) - 1 if len(p) > 1 and p[1] else -1)
                faces.append(tuple(vi)); fuv.append(tuple(ti)); groups.append(g)
                vg.setdefault(g, set()).update(vi)
    return dict(V=np.array(V, float) * scale, UV=np.array(UV, float) if UV else np.zeros((0, 2)), faces=faces, fuv=fuv,
                group=groups, vgroups=vg)


def tris_of(faces):
    """quads and n-gons fanned into triangles: (m,3) int array and, per triangle, the face it came from"""
    T, src = [], []
    for k, f in enumerate(faces):
        for i in range(1, len(f) - 1):
            T.append((f[0], f[i], f[i + 1])); src.append(k)
    return np.array(T, np.int64), np.array(src, np.int64)


def load_mhclo(path):
    """a MakeHuman clothes file: its settings, each vertex's three base vertices, weights and offsets, delete_verts"""
    path = Path(path)
    out = dict(dir=path.parent, verts=[], delete=[], scale={})
    mode = None
    for line in path.read_text(errors="ignore").splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        w = s.split()
        if mode == "verts" and (w[0].lstrip("-").isdigit()):
            if len(w) >= 9:
                out["verts"].append((int(w[0]), int(w[1]), int(w[2]), *[float(x) for x in w[3:9]]))
            elif len(w) == 1:                      # bound to one base vertex exactly
                out["verts"].append((int(w[0]), int(w[0]), int(w[0]), 1.0, 0.0, 0.0, 0.0, 0.0, 0.0))
            continue
        if mode == "delete" and (w[0].isdigit()):
            i = 0
            while i < len(w):
                if i + 2 < len(w) and w[i + 1] == "-":
                    out["delete"].extend(range(int(w[i]), int(w[i + 2]) + 1)); i += 3
                else:
                    out["delete"].append(int(w[i])); i += 1
            continue
        if w[0] == "verts":
            mode = "verts"
        elif w[0] == "delete_verts":
            mode = "delete"
        elif w[0] in ("x_scale", "y_scale", "z_scale"):
            out["scale"][w[0][0]] = (int(w[1]), int(w[2]), float(w[3]))
        elif w[0] in ("name", "obj_file", "material", "basemesh", "z_depth"):
            out[w[0]] = " ".join(w[1:])           # (a keyword between the vertex lines doesn't end them: shoes05 has two)
    out["verts"] = np.array(out["verts"], float)
    return out


def mhclo_points(c, base_V):
    """the clothes' points on a base mesh (base_V in the base's own units x 0.1: metres), by MakeHuman's rule: the
    three base vertices blended by the weights, plus the offset scaled along each axis by the distance between the
    axis's two reference vertices over its reference length"""
    v = c["verts"]
    i = v[:, :3].astype(int); w = v[:, 3:6]; off = v[:, 6:9]
    P = (base_V[i[:, 0]] * w[:, :1] + base_V[i[:, 1]] * w[:, 1:2] + base_V[i[:, 2]] * w[:, 2:3])
    sc = np.ones(3)
    for k, ax in enumerate("xyz"):
        if ax in c["scale"]:
            a, b, ref = c["scale"][ax]
            sc[k] = abs(base_V[a, k] - base_V[b, k]) * 10.0 / ref          # base_V is in metres, the reference in dm
    return P + off * sc * 0.1


def load_rig(path=ROOT / "Content" / "Studio" / "Bodies" / "MHR_lod1_rig.bin"):
    d = Path(path).read_bytes()
    hl = struct.unpack_from("<I", d, 0)[0]
    h = json.loads(d[4:4 + hl].decode())
    n = h["points"]
    bi = np.frombuffer(d, np.uint8, n * 4, h["bi_at"]).reshape(n, 4).astype(np.int64)
    bw = np.frombuffer(d, np.uint16, n * 4, h["bw_at"]).reshape(n, 4).astype(np.float64) / 65535.0
    names = [b["name"] for b in h["bones"]]
    parent = np.array([b["parent"] for b in h["bones"]])
    at = np.array([b["at"] for b in h["bones"]], float)
    return dict(names=names, parent=parent, at=at, bi=bi, bw=bw)


def vnormals(P, T):
    n = np.cross(P[T[:, 1]] - P[T[:, 0]], P[T[:, 2]] - P[T[:, 0]])
    N = np.zeros_like(P)
    for k in range(3):
        np.add.at(N, T[:, k], n)
    return N / (np.linalg.norm(N, axis=1, keepdims=True) + 1e-20)


def closest_on_tris(Q, P, T, k=12, tree=None):
    """for each query point: (triangle, barycentrics (3), the closest point, signed distance along the triangle's normal)
    through the k nearest triangles by their centres"""
    from scipy.spatial import cKDTree
    A, B, C = P[T[:, 0]], P[T[:, 1]], P[T[:, 2]]
    tree = tree or cKDTree((A + B + C) / 3.0)
    _, cand = tree.query(Q, k=k)
    best_d = np.full(len(Q), np.inf); best_t = np.zeros(len(Q), np.int64); best_b = np.zeros((len(Q), 3)); best_p = np.zeros((len(Q), 3))
    for j in range(cand.shape[1]):
        t = cand[:, j]
        p, b = _closest_pt_tri(Q, A[t], B[t], C[t])
        d = np.linalg.norm(Q - p, axis=1)
        m = d < best_d
        best_d[m] = d[m]; best_t[m] = t[m]; best_b[m] = b[m]; best_p[m] = p[m]
    n = np.cross(B[best_t] - A[best_t], C[best_t] - A[best_t]); n /= (np.linalg.norm(n, axis=1, keepdims=True) + 1e-20)
    sd = np.einsum("ij,ij->i", Q - best_p, n)
    return best_t, best_b, best_p, sd


def _closest_pt_tri(p, a, b, c):
    """closest points on triangles (vectorised; Ericson's Real-Time Collision Detection 5.1.5): points and barycentrics"""
    ab, ac, ap = b - a, c - a, p - a
    d1 = np.einsum("ij,ij->i", ab, ap); d2 = np.einsum("ij,ij->i", ac, ap)
    bp = p - b; d3 = np.einsum("ij,ij->i", ab, bp); d4 = np.einsum("ij,ij->i", ac, bp)
    cp = p - c; d5 = np.einsum("ij,ij->i", ab, cp); d6 = np.einsum("ij,ij->i", ac, cp)
    vc = d1 * d4 - d3 * d2; vb = d5 * d2 - d1 * d6; va = d3 * d6 - d5 * d4
    out = np.zeros((len(p), 3))
    denom = va + vb + vc; denom = np.where(np.abs(denom) < 1e-30, 1e-30, denom)
    v = vb / denom; w = vc / denom
    out[:] = np.stack([1 - v - w, v, w], 1)                                   # inside the face
    m = (va <= 0) & ((d4 - d3) >= 0) & ((d5 - d6) >= 0)                         # edge BC
    t = (d4 - d3) / np.where(((d4 - d3) + (d5 - d6)) == 0, 1, ((d4 - d3) + (d5 - d6)))
    out[m] = np.stack([np.zeros(m.sum()), 1 - t[m], t[m]], 1)
    m = (vb <= 0) & (d2 >= 0) & (d6 <= 0)                                       # edge AC
    t = d2 / np.where((d2 - d6) == 0, 1, (d2 - d6))
    out[m] = np.stack([1 - t[m], np.zeros(m.sum()), t[m]], 1)
    m = (d6 >= 0) & (d5 <= d6); out[m] = [0, 0, 1]                              # vertex C
    m = (vc <= 0) & (d1 >= 0) & (d3 <= 0)                                       # edge AB
    t = d1 / np.where((d1 - d3) == 0, 1, (d1 - d3))
    out[m] = np.stack([1 - t[m], t[m], np.zeros(m.sum())], 1)
    m = (d3 >= 0) & (d4 <= d3); out[m] = [0, 1, 0]                              # vertex B
    m = (d1 <= 0) & (d2 <= 0); out[m] = [1, 0, 0]                               # vertex A
    q = a * out[:, :1] + b * out[:, 1:2] + c * out[:, 2:3]
    return q, out


def frames(p, X, T):
    """each vertex's turn R and scale s from its neighbourhood in p to the same in X (edges and the normal)"""
    n = len(p)
    E = np.vstack([T[:, [0, 1]], T[:, [1, 2]], T[:, [2, 0]], T[:, [1, 0]], T[:, [2, 1]], T[:, [0, 2]]])
    a = p[E[:, 1]] - p[E[:, 0]]; b = X[E[:, 1]] - X[E[:, 0]]
    H = np.zeros((n, 3, 3)); sa = np.zeros(n); sb = np.zeros(n); cnt = np.zeros(n)
    np.add.at(H, E[:, 0], a[:, :, None] * b[:, None, :])
    np.add.at(sa, E[:, 0], (a * a).sum(1)); np.add.at(sb, E[:, 0], (b * b).sum(1)); np.add.at(cnt, E[:, 0], 1)
    s = np.sqrt(sb / np.maximum(sa, 1e-20))
    n0 = lib.vnormals(p, T); n1 = lib.vnormals(X, T)
    H += (sa / np.maximum(cnt, 1))[:, None, None] * 2.0 * (n0[:, :, None] * n1[:, None, :]) * s[:, None, None]
    U, _, Vt = np.linalg.svd(H)
    d = np.sign(np.linalg.det(np.einsum("nij,njk->nik", U, Vt)))
    D = np.tile(np.eye(3), (n, 1, 1)); D[:, 2, 2] = d
    R = np.einsum("nji,njk,nlk->nil", Vt, D, U)                      # R = V D U^T: a -> b
    return R, s


def smooth_frames(R, s, T, rounds=2):
    """neighbouring turns and scales averaged a little, so a noisy patch of skin doesn't kink the cloth"""
    n = len(s)
    E = np.vstack([T[:, [0, 1]], T[:, [1, 2]], T[:, [2, 0]], T[:, [1, 0]], T[:, [2, 1]], T[:, [0, 2]]])
    for _ in range(rounds):
        Rs = R.copy(); ss = s.copy(); c = np.ones(n)
        np.add.at(Rs, E[:, 0], R[E[:, 1]]); np.add.at(ss, E[:, 0], s[E[:, 1]]); np.add.at(c, E[:, 0], 1)
        U, _, Vt = np.linalg.svd(Rs)
        d = np.sign(np.linalg.det(np.einsum("nij,njk->nik", U, Vt)))
        D = np.tile(np.eye(3), (n, 1, 1)); D[:, 2, 2] = d
        R = np.einsum("nij,njk,nkl->nil", U, D, Vt); s = ss / c
    return R, s


class Warp:
    """points near the surface p carried to the surface X: each by the blend of its K nearest skin vertices' own
    moves (where the vertex went, plus the point's offset from it turned and scaled as the skin there was)"""

    def __init__(self, p, X, T, K=24, eps=0.006, keep=None):
        self.p, self.X = p, X
        R, s = frames(p, X, T)
        self.R, self.s = smooth_frames(R, s, T)
        self.use = np.arange(len(p)) if keep is None else np.where(keep)[0]
        from scipy.spatial import cKDTree
        self.tree = cKDTree(p[self.use]); self.K, self.eps = K, eps

    def __call__(self, Q):
        d, j = self.tree.query(Q, k=self.K)
        i = self.use[j]
        w = 1.0 / (d * d + self.eps ** 2) ** 2
        w /= w.sum(1, keepdims=True)
        diff = Q[:, None, :] - self.p[i]
        moved = self.X[i] + self.s[i][..., None] * np.einsum("nkij,nkj->nki", self.R[i], diff)
        return (w[..., None] * moved).sum(1)


def adjacency(n, faces):
    i, j = [], []
    for f in faces:
        for a in range(len(f)):
            i.append(f[a]); j.append(f[(a + 1) % len(f)]); i.append(f[(a + 1) % len(f)]); j.append(f[a])
    import scipy.sparse as sp
    A = sp.coo_matrix((np.ones(len(i)), (i, j)), shape=(n, n)).tocsr(); A.data[:] = 1.0
    deg = np.asarray(A.sum(1)).ravel()
    return sp.diags(1.0 / np.maximum(deg, 1)) @ A


def unpose(G, faces, reg, rig):
    """the garment in MHR's rest pose: each point by the bones of the posed skin nearest it (smoothed over the
    garment), the pose's transform taken back off"""
    Pp, T = reg["mhr_posed"], reg["mhr_T"]
    t, b, _, _ = lib.closest_on_tris(G, Pp, T, k=12)
    nb = len(rig["names"])
    Wb = np.zeros((len(Pp), nb))
    for k in range(4):
        np.add.at(Wb, (np.arange(len(Pp)), rig["bi"][:, k]), rig["bw"][:, k])
    W = (Wb[T[t, 0]] * b[:, :1] + Wb[T[t, 1]] * b[:, 1:2] + Wb[T[t, 2]] * b[:, 2:3])
    A = adjacency(len(G), faces)
    for _ in range(6):
        W = 0.5 * W + 0.5 * (A @ W)
    W /= W.sum(1, keepdims=True)
    R, pat, at = reg["R"], reg["pat"], rig["at"]
    M = np.einsum("nb,bij->nij", W, R)                               # the blended turn
    tr = W @ (pat - np.einsum("bij,bj->bi", R, at))                  # and shift: x' = M x + tr
    return np.linalg.solve(M, (G - tr)[:, :, None])[:, :, 0], W


def load_garment(folder, base):
    """a MakeHuman garment on the default base mesh: its points by its own binding (the .mhclo: the stored .obj is
    whatever body its author modelled on; only its faces and UVs are taken from it)"""
    folder = Path(folder)
    mh = sorted(folder.glob("*.mhclo"))[0]
    c = lib.load_mhclo(mh)
    o = lib.load_obj(folder / c["obj_file"], 0.1)
    stored = o["V"]
    o["V"] = lib.mhclo_points(c, base)
    if len(o["V"]) != len(stored):
        raise ValueError(f"{folder.name}: {len(o['V'])} bound points, {len(stored)} in its .obj")
    mat = {}
    mm = folder / c.get("material", "x.mhmat")
    if mm.exists():
        for line in mm.read_text(errors="ignore").splitlines():
            w = line.split()
            if len(w) >= 2 and w[0] in ("diffuseTexture", "normalmapTexture", "diffuseColor", "transparent", "backfaceCull"):
                mat[w[0]] = " ".join(w[1:])
    meta = {}
    for line in mh.read_text(errors="ignore").splitlines()[:40]:
        if line.startswith("#") and any(k in line.lower() for k in ("author", "license", "cc0")):
            meta.setdefault("credit", []).append(line.lstrip("# ").strip())
    return c, o, mat, folder, meta


def corners(o):
    """the render mesh: a vertex per (point, uv) pair, triangles from the quads"""
    key, src, uv, tris = {}, [], [], []
    for f, ft in zip(o["faces"], o["fuv"]):
        ids = []
        for v, t in zip(f, ft):
            k = (v, t)
            if k not in key:
                key[k] = len(src); src.append(v); uv.append(o["UV"][t] if t >= 0 and len(o["UV"]) else (0.0, 0.0))
            ids.append(key[k])
        for a in range(1, len(ids) - 1):
            tris.append((ids[0], ids[a], ids[a + 1]))
    return np.array(src), np.array(uv, float), np.array(tris)


def uv_metres(P, uv, tris):
    """a second UV for tileable fabrics at their real size: each UV island scaled so its area matches the cloth's
    own area in metres (the island's shape and grain direction as its author laid them)"""
    n = len(uv); parent = np.arange(n)

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]; a = parent[a]
        return a
    for t in tris:
        a, b, c = find(t[0]), find(t[1]), find(t[2])
        parent[b] = a; parent[c] = a
    root = np.array([find(i) for i in range(n)])
    a3 = 0.5 * np.linalg.norm(np.cross(P[tris[:, 1]] - P[tris[:, 0]], P[tris[:, 2]] - P[tris[:, 0]]), axis=1)
    e1 = uv[tris[:, 1]] - uv[tris[:, 0]]; e2 = uv[tris[:, 2]] - uv[tris[:, 0]]
    au = 0.5 * np.abs(e1[:, 0] * e2[:, 1] - e1[:, 1] * e2[:, 0])
    tr = root[tris[:, 0]]
    A3 = np.zeros(n); AU = np.zeros(n); np.add.at(A3, tr, a3); np.add.at(AU, tr, au)
    k = np.sqrt(A3[root] / np.maximum(AU[root], 1e-12))
    return uv * k[:, None], len(set(root.tolist()))


for _f in (load_obj, tris_of, load_mhclo, mhclo_points, load_rig, vnormals, closest_on_tris):
    setattr(lib, _f.__name__, staticmethod(_f))


def registration():
    if not REG.exists():
        raise SystemExit(f"no registration at {REG.relative_to(ROOT)}")
    r = np.load(REG)
    return {k: (r[k].astype(np.float64) if r[k].dtype.kind == "f" else r[k]) for k in r.files}


class Baker:
    """garments onto MHR's average at rest, one after another (the registration and its warp made once)"""

    def __init__(self):
        from scipy.spatial import cKDTree
        self.reg = reg = registration()
        self.rig = load_rig()
        self.warp = Warp(reg["hm_p"], reg["hm_X"], reg["hm_T"], keep=reg["hm_ok"])
        _, near = cKDTree(reg["hm_X"]).query(reg["mhr_posed"])      # hm08's delete_verts as MHR's: each MHR point takes the hm08 skin vertex registered nearest it
        self.hm_of_mhr = reg["body_idx"][near]

    def base(self):
        return self.reg["mhr_rest"].astype(np.float32)

    def bake(self, folder, gid):
        """(header, the bake's bytes) for the garment in `folder`"""
        c, o, mat, folder, meta = load_garment(folder, self.reg["hm_all"])
        rest, _ = unpose(self.warp(o["V"]), o["faces"], self.reg, self.rig)
        if not np.isfinite(rest).all():
            raise ValueError("points that aren't finite")
        src, uv, tris = corners(o)
        uv2, islands = uv_metres(rest[src], uv, tris)
        cover = np.where(np.isin(self.hm_of_mhr, np.array(c["delete"], np.int64)))[0]
        tex = mat.get("diffuseTexture") or ""
        arrays = [("rest", rest.astype("<f4")), ("src", src.astype("<u4")), ("uv", uv.astype("<f4")), ("uv2", uv2.astype("<f4")), ("tris", tris.astype("<u4")), ("cover", cover.astype("<u4"))]
        head = dict(version=BAKE_VERSION, id=gid, name=c.get("name", folder.name), points=len(rest), corners=len(src), triangles=len(tris), islands=islands,
                    texture=tex if tex and (folder / tex).exists() else "", normal=mat.get("normalmapTexture") or "", color=mat.get("diffuseColor") or "",
                    transparent=str(mat.get("transparent", "")).lower() in ("true", "1"), arrays={})
        at = 0
        for name, a in arrays:
            head["arrays"][name] = dict(at=at, count=int(a.size)); at += a.nbytes
        hb = json.dumps(head).encode(); hb += b" " * ((4 - len(hb) % 4) % 4)
        return head, struct.pack("<I", len(hb)) + hb + b"".join(a.tobytes() for _, a in arrays)


def read_bake(path):
    """a bake's header and its arrays (numpy), for checks"""
    d = Path(path).read_bytes()
    n = struct.unpack_from("<I", d, 0)[0]
    head = json.loads(d[4:4 + n].decode())
    out = {}
    for name, a in head["arrays"].items():
        out[name] = np.frombuffer(d, "<u4" if name in ("src", "tris", "cover") else "<f4", a["count"], 4 + n + a["at"])
    return head, out
