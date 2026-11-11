"""Stages 1 and 2 of the fit test.

  Stage 1 (once per garment): a MakeHuman garment (made on hm08) carried onto MHR's average body in MHR's rest pose:
      warped by the registration (a smooth blend of the local turns and scales of the skin near each point), then taken
      out of hm08's pose by MHR's own skin weights.
  Stage 2 (per character): the garment on MHR's average carried onto any MHR body the same way (every MHR body is the
      same mesh, so the skin's own change is known exactly), pushed out of the skin where it dips in, and the skin it
      hides left out.

  python fit.py <reg.npz> <rig-less bodies dir> <out dir> <body name,body name...> <garment folder> [...]
"""
import json
import sys
from pathlib import Path

import numpy as np
import scipy.sparse as sp
from scipy.spatial import cKDTree

import lib


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


def push_out(G, faces, P, T, ease=0.003, rounds=4):
    """cloth that dips into the skin put back `ease` outside it, its neighbours eased along with it"""
    A = adjacency(len(G), faces)
    N = lib.vnormals(P, T)
    tree = cKDTree((P[T[:, 0]] + P[T[:, 1]] + P[T[:, 2]]) / 3.0)
    moved = 0
    for r in range(rounds):
        t, b, cp, sd = lib.closest_on_tris(G, P, T, k=12, tree=tree)
        n = N[T[t, 0]] * b[:, :1] + N[T[t, 1]] * b[:, 1:2] + N[T[t, 2]] * b[:, 2:3]
        n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-20
        dist = np.linalg.norm(G - cp, axis=1)
        signed = np.where(np.einsum("ij,ij->i", G - cp, n) < 0, -dist, dist)     # by the skin's own smooth normal there
        inside = (signed < ease) & (dist < 0.06)
        if r == 0:
            moved = int(inside.sum())
        D = np.zeros_like(G); D[inside] = cp[inside] + ease * n[inside] - G[inside]
        Ds = D.copy()
        for _ in range(3):
            Ds = 0.5 * Ds + 0.5 * (A @ Ds)
        G = G + np.where(inside[:, None], D, Ds * 0.7)
    return G, moved


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
        raise SystemExit(f"{folder.name}: {len(o['V'])} bound points, {len(stored)} in its .obj")
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


def detail_map(tex, out):
    """the garment's own colour texture as a layer of detail only (its seams, stitches, folds and wear: each pixel
    over its neighbourhood's mean), to lay over another fabric"""
    from PIL import Image, ImageFilter
    im = Image.open(tex).convert("RGB")
    if max(im.size) > 2048:
        im = im.resize((2048, 2048 * im.size[1] // im.size[0]))
    L = np.asarray(im.convert("L"), np.float32) / 255.0
    B = np.asarray(im.convert("L").filter(ImageFilter.GaussianBlur(max(6, im.size[0] // 40))), np.float32) / 255.0
    d = np.clip(L / np.maximum(B, 0.02), 0.35, 1.65)
    Image.fromarray(np.uint8(np.clip(d * 0.5, 0, 1) * 255)).save(out)


def main():
    reg = dict(np.load(sys.argv[1]))
    bodies_dir, out = Path(sys.argv[2]), Path(sys.argv[3]); out.mkdir(parents=True, exist_ok=True)
    names = sys.argv[4].split(",")
    rig = lib.load_rig()
    T = reg["mhr_T"]
    w_hm = Warp(reg["hm_p"], reg["hm_X"], reg["hm_T"], keep=reg["hm_ok"])
    P_avg = reg["mhr_rest"]

    garments = []
    for folder in sys.argv[5:]:
        c, o, mat, folder, meta = load_garment(folder, reg["hm_all"])
        Gp = w_hm(o["V"])                                           # on MHR posed as hm08
        Gr, _ = unpose(Gp, o["faces"], reg, rig)                    # on MHR's average, at rest
        src, uv, tris = corners(o)
        uv2, islands = uv_metres(Gr[src], uv, tris)
        garments.append(dict(name=c.get("name", folder.name), rest=Gr, faces=o["faces"], src=src, uv=uv, uv2=uv2, islands=islands, tris=tris, mat=mat, folder=folder,
                             delete=np.array(c["delete"], np.int64), meta=meta))
        print(f"{folder.name}: {len(o['V'])} points, {len(tris)} triangles, hides {len(c['delete'])} of hm08's vertices; {'; '.join(meta.get('credit', []))[:120]}")

    # hm08's delete_verts as MHR's: each MHR point takes the hm08 skin vertex registered nearest it
    tree = cKDTree(reg["hm_X"])
    _, near = tree.query(reg["mhr_posed"])
    body_idx = reg["body_idx"]
    hm_of_mhr = body_idx[near]

    index = dict(bodies=[], garments=[dict(name=g["name"], tex=str(g["folder"] / g["mat"].get("diffuseTexture", "")) if g["mat"].get("diffuseTexture") else None,
                                           normal=str(g["folder"] / g["mat"].get("normalmapTexture", "")) if g["mat"].get("normalmapTexture") else None,
                                           credit=g["meta"].get("credit", [])) for g in garments])
    import os
    each = os.environ.get("EACH") == "1"                             # every garment alone on the first body: a catalogue sheet
    jobs = [(g["name"], names[0], [k]) for k, g in enumerate(garments)] if each else [(n, n, list(range(len(garments)))) for n in names]
    cache = {}
    for label, name, which in jobs:
        if name not in cache:
            P = np.fromfile(bodies_dir / f"{name}.f32", np.float32).reshape(-1, 3).astype(np.float64)
            cache[name] = (P, Warp(P_avg, P, T, K=16, eps=0.004))
        P, w = cache[name]
        hidden = np.zeros(len(P), bool)
        parts = []
        for k in which:
            g = garments[k]
            G = w(g["rest"])
            G, moved = push_out(G, g["faces"], P, T)
            hidden |= np.isin(hm_of_mhr, g["delete"])
            t, b, cp, sd = lib.closest_on_tris(G, P, T, k=12)
            parts.append((k, g, G))
            bad = int((~np.isfinite(G)).any(1).sum())
            print(f"  {name:15s} {g['name'][:28]:28s} {len(G):6d} pts  pushed out {moved:5d} ({100 * moved / len(G):4.1f}%)  off the skin: median {np.median(sd) * 1000:5.1f} mm  max {sd.max() * 1000:6.1f} mm" + (f"  NOT FINITE {bad}" if bad else ""))
        vis = T[~(hidden[T].all(1))]
        safe = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in label)
        f = out / f"{safe}.bin"
        with open(f, "wb") as fh:
            head = dict(body=dict(P=len(P) * 3, T=vis.size), garments=[])
            blobs = [P.astype(np.float32).tobytes(), vis.astype(np.uint32).tobytes()]
            for k, g, G in parts:
                Pc = G[g["src"]].astype(np.float32)
                Nc = lib.vnormals(G, lib.tris_of(g["faces"])[0])[g["src"]].astype(np.float32)   # smooth across the UV seams
                head["garments"].append(dict(name=g["name"], m=k, P=Pc.size, N=Nc.size, UV=g["uv"].size, UV2=g["uv2"].size, T=g["tris"].size))
                blobs += [Pc.tobytes(), Nc.tobytes(), g["uv"].astype(np.float32).tobytes(), g["uv2"].astype(np.float32).tobytes(), g["tris"].astype(np.uint32).tobytes()]
            hb = json.dumps(head).encode(); hb += b" " * ((4 - len(hb) % 4) % 4)
            fh.write(np.array([len(hb)], np.uint32).tobytes()); fh.write(hb)
            for bl in blobs:
                fh.write(bl)
        index["bodies"].append(dict(name=label, file=f.name, hidden=int(hidden.sum())))
    for g, gi in zip(garments, index["garments"]):
        gi["islands"] = g["islands"]
        if gi["tex"] and Path(gi["tex"]).exists():
            gi["detail"] = str(out / (Path(gi["tex"]).stem + "_detail.png")); detail_map(gi["tex"], gi["detail"])
    (out / "index.json").write_text(json.dumps(index, indent=1))
    print("FIT ok ->", out)


if __name__ == "__main__":
    main()
