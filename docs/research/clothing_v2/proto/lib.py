"""The fit test's library (a research prototype, docs/research/clothing_v2/fit_test.md): MakeHuman's hm08 base mesh
and clothes, MHR's body and rig, small mesh maths."""
import json
import struct
import sys
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(REPO / "tools" / "character"))
import mhr as MHR  # noqa: E402  (the repo's own packed MHR reader)


# ---------------------------------------------------------------- MakeHuman's side
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


def load_hm08(path):
    """MakeHuman's base mesh in metres (its unit is a decimetre): body triangles, helpers, joints"""
    o = load_obj(path, 0.1)
    joints = {g[6:]: o["V"][sorted(v)].mean(0) for g, v in o["vgroups"].items() if g.startswith("joint-")}
    body_faces = [f for f, g in zip(o["faces"], o["group"]) if g == "body"]
    T, _ = tris_of(body_faces)
    o.update(joints=joints, body_T=T, body_idx=np.array(sorted(o["vgroups"]["body"])))
    return o


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


# ---------------------------------------------------------------- MHR's side
def load_rig(path=REPO / "Content" / "Studio" / "Bodies" / "MHR_lod1_rig.bin"):
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


def mhr_body(weights=(), height=None):
    """MHR's points for identity weights, feet on the floor, scaled to a height when given: as node.mjs mhrBody"""
    m = MHR.load()
    P = MHR.body(list(weights), m)
    lo, hi = P[:, 1].min(), P[:, 1].max()
    k = 1.0 if height is None else height / (hi - lo)
    P = P.copy(); P[:, 1] -= lo; P *= k
    return P, m["tris"], k, lo


# ---------------------------------------------------------------- mesh maths
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
