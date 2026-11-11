"""Stage 0 of the fit test, once per source body: MakeHuman's hm08 base mesh registered onto MHR's average body.

  1. MHR is posed (its own skinning) so its arms, legs and feet point the way hm08's do;
  2. hm08 is pre-warped so its joints land on MHR's (a smooth warp through the joints);
  3. hm08's skin is pulled onto MHR's by closest points, the pull smoothed over hm08's own mesh (a membrane), in rounds;
  4. what's kept: where every hm08 skin vertex ends on MHR, and the bone transforms of the pose (to take things back
     to MHR's rest pose).

  python register.py <hm08 base.obj> <out.npz>
"""
import sys

import numpy as np
import scipy.sparse as sp
import scipy.sparse.linalg as spla
from scipy.spatial import cKDTree

import lib

PAIRS = {  # hm08 joint -> MHR bone, per side
    "shoulder": "uparm", "elbow": "lowarm", "hand": "wrist", "upper-leg": "upleg", "knee": "lowleg", "ankle": "foot",
    "foot-1": "ball", "clavicle": "clavicle",
}
CHAINS = [("uparm", "lowarm", "shoulder", "elbow"), ("lowarm", "wrist", "elbow", "hand"),
          ("upleg", "lowleg", "upper-leg", "knee"), ("lowleg", "foot", "knee", "ankle"), ("foot", "ball", "ankle", "foot-1")]


def rot_between(a, b):
    a = a / np.linalg.norm(a); b = b / np.linalg.norm(b)
    v = np.cross(a, b); c = float(a @ b); s = np.linalg.norm(v)
    if s < 1e-9:
        return np.eye(3)
    k = v / s; K = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]])
    return np.eye(3) + s * K + (1 - c) * (K @ K)


def pose_mhr(rig, P, hmJ):
    """MHR's bones turned so each limb points as hm08's: (R (bones,3,3), posed_at (bones,3)), the points posed"""
    names, par, at = rig["names"], rig["parent"], rig["at"]
    nb = len(names)
    swing = {}
    order = sorted(range(nb), key=lambda b: _depth(par, b))
    R = np.zeros((nb, 3, 3)); pat = np.zeros((nb, 3))
    want = {}
    for side in "lr":
        for bone, child, j0, j1 in CHAINS:
            want[names.index(f"{side}_{bone}")] = (names.index(f"{side}_{child}"), hmJ[f"{side}-{j1}"] - hmJ[f"{side}-{j0}"])
    for b in order:
        p = par[b]
        Rp = R[p] if p >= 0 else np.eye(3)
        pat[b] = (pat[p] + Rp @ (at[b] - at[p])) if p >= 0 else at[b]
        if b in want:
            child, target = want[b]
            cur = Rp @ (at[child] - at[b])
            R[b] = rot_between(cur, target) @ Rp
            swing[names[b]] = float(np.degrees(np.arccos(np.clip((cur / np.linalg.norm(cur)) @ (target / np.linalg.norm(target)), -1, 1))))
        else:
            R[b] = Rp
    bi, bw = rig["bi"], rig["bw"]
    out = np.zeros_like(P)
    for k in range(4):
        b = bi[:, k]
        out += bw[:, k:k + 1] * (pat[b] + np.einsum("nij,nj->ni", R[b], P - at[b]))
    return R, pat, out, swing


def _depth(par, b):
    d = 0
    while par[b] >= 0:
        b = par[b]; d += 1
    return d


def rbf_warp(src, dst):
    """a smooth warp taking the points src onto dst (the kernel r, with an affine part): a function of (n,3) points"""
    n = len(src)
    K = np.linalg.norm(src[:, None] - src[None], axis=2)
    Pm = np.hstack([np.ones((n, 1)), src])
    A = np.zeros((n + 4, n + 4)); A[:n, :n] = K + 1e-9 * np.eye(n); A[:n, n:] = Pm; A[n:, :n] = Pm.T
    rhs = np.zeros((n + 4, 3)); rhs[:n] = dst
    sol = np.linalg.solve(A, rhs)
    w, aff = sol[:n], sol[n:]

    def f(Q):
        return np.linalg.norm(Q[:, None] - src[None], axis=2) @ w + np.hstack([np.ones((len(Q), 1)), Q]) @ aff
    return f


def laplacian(n, edges):
    i = np.concatenate([edges[:, 0], edges[:, 1]]); j = np.concatenate([edges[:, 1], edges[:, 0]])
    W = sp.coo_matrix((np.ones(len(i)), (i, j)), shape=(n, n)).tocsr()
    W.data[:] = 1.0
    return sp.diags(np.asarray(W.sum(1)).ravel()) - W


def main():
    hm = lib.load_hm08(sys.argv[1])
    V = hm["V"].copy()
    idx = hm["body_idx"]
    floor = V[idx][:, 1].min()
    V[:, 1] -= floor                                                   # feet on the floor, as MHR
    J = {n: j - np.array([0, floor, 0]) for n, j in hm["joints"].items()}
    P, T, _, _ = lib.mhr_body()
    rig = lib.load_rig()
    R, pat, Pp, swing = pose_mhr(rig, P, J)
    print("MHR posed to hm08's limbs; swings (degrees):", {k: round(v, 1) for k, v in swing.items() if k.startswith("l_")})

    # the joints as control points (both sides), the neck, the top of the head, the floor under each ankle
    names = rig["names"]
    src, dst = [], []
    for side in "lr":
        for hj, mb in PAIRS.items():
            src.append(J[f"{side}-{hj}"]); dst.append(pat[names.index(f"{side}_{mb}")])
        a = J[f"{side}-ankle"].copy(); a[1] = 0; b = pat[names.index(f"{side}_foot")].copy(); b[1] = 0
        src.append(a); dst.append(b)
    src.append(J["neck"]); dst.append(pat[names.index("c_neck")])
    B = V[idx]
    top_h = B[np.argmax(B[:, 1])]; top_m = Pp[np.argmax(Pp[:, 1])]
    src.append(np.array([0.0, top_h[1], top_h[2]])); dst.append(np.array([0.0, top_m[1], top_m[2]]))
    src, dst = np.array(src), np.array(dst)
    pre = rbf_warp(src, dst)
    X = pre(B)
    print("pre-warp through", len(src), "joints: hm08 height", round(B[:, 1].max(), 3), "->", round(X[:, 1].max(), 3), "MHR", round(Pp[:, 1].max(), 3))

    # hm08's skin as a graph
    body_faces = [f for f, g in zip(hm["faces"], hm["group"]) if g == "body"]
    remap = -np.ones(len(V), np.int64); remap[idx] = np.arange(len(idx))
    edges = set()
    for f in body_faces:
        for a in range(len(f)):
            i, j = remap[f[a]], remap[f[(a + 1) % len(f)]]
            edges.add((min(i, j), max(i, j)))
    edges = np.array(sorted(edges)); L = laplacian(len(idx), edges)
    hT = remap[hm["body_T"]]
    tree_c = cKDTree((Pp[T[:, 0]] + Pp[T[:, 1]] + Pp[T[:, 2]]) / 3.0)
    Nm = lib.vnormals(Pp, T)
    tri_n = np.cross(Pp[T[:, 1]] - Pp[T[:, 0]], Pp[T[:, 2]] - Pp[T[:, 0]]); tri_n /= np.linalg.norm(tri_n, axis=1, keepdims=True) + 1e-20

    lams = [300, 150, 80, 40, 20, 10, 5, 3, 2, 1.5, 1, 1, 0.7, 0.5, 0.5, 0.3, 0.3, 0.2, 0.2, 0.1]
    for it, lam in enumerate(lams):
        Nh = lib.vnormals(X, hT)
        t, b, cp, sd = lib.closest_on_tris(X, Pp, T, k=16, tree=tree_c)
        d = cp - X
        dist = np.linalg.norm(d, axis=1)
        ok = (np.einsum("ij,ij->i", Nh, tri_n[t]) > 0.2) & (dist < 0.10)
        w = ok.astype(float)
        A = sp.diags(w) + lam * L + 1e-6 * sp.eye(len(idx))
        solve = spla.factorized(A.tocsc())
        D = np.stack([solve(w * d[:, k]) for k in range(3)], 1)
        X = X + D
        if it % 4 == 0 or it == len(lams) - 1:
            print(f"  round {it:2d} lambda {lam:6.1f}: matched {ok.mean() * 100:5.1f}%  mean gap {dist[ok].mean() * 1000:6.2f} mm  p95 {np.percentile(dist[ok], 95) * 1000:6.2f} mm")
    # the last step: onto the surface itself where it matched
    Nh = lib.vnormals(X, hT)
    t, b, cp, sd = lib.closest_on_tris(X, Pp, T, k=16, tree=tree_c)
    ok = (np.einsum("ij,ij->i", Nh, tri_n[t]) > 0.2) & (np.linalg.norm(cp - X, axis=1) < 0.03)
    X[ok] = cp[ok]
    print(f"on MHR's skin: {ok.mean() * 100:.1f}% of hm08's {len(idx)} skin vertices; the rest left where the membrane put them")
    np.savez(sys.argv[2], hm_all=V, hm_p=B, hm_X=X, hm_T=hT, hm_ok=ok, hm_tri=t, hm_bary=b, mhr_posed=Pp, mhr_rest=P, mhr_T=T, R=R, pat=pat,
             floor=floor, body_idx=idx)
    print("REGISTER ok ->", sys.argv[2])


if __name__ == "__main__":
    main()
