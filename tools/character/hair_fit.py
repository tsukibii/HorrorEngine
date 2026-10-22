"""DiffLocks' strands (tools/difflocks.py run: SMPL-X's head frame) onto a Character Studio character (its body as the
Studio has it: metres, Y up, facing +Z, feet on the floor). Runs in face_mesh.py's environment (MediaPipe, numpy):

    python tools/character/hair_fit.py --strands DIR/strands.npz --out DIR/fit.npz (--character NAME | --body body.npy)
                                       [--smplx vendor/difflocks/src/data_loader/difflocks_bodydata/smplx_base.ply]

1. Both heads' faces are found the way face_mesh.py finds a template's: rendered, MediaPipe's 468 points pinned to the
   triangles under them (kept in vendor/face_mesh/bindings/). The firm ones (eye corners, the nose's bridge, the
   forehead, the cheeks at the ears) give a similarity (scale, turn, move) from SMPL-X's head to this one.
2. Skulls differ: each strand is carried by its root onto the nearest point of this scalp (a millimetre out), whole,
   so its shape is kept.
3. What still sits inside the head or the shoulders is pushed out (a radial field round the skull, slices down the
   neck and torso: hair.js's, in numpy).
Writes positions (strands x points x 3, float32, the Studio's frame) and a report: where the roots landed, what was inside.
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools")); sys.path.insert(0, str(ROOT / "tools" / "character"))
FIRM = [33, 133, 263, 362, 168, 6, 10, 151, 9, 234, 454, 127, 356, 1, 4, 152]   # eye corners, bridge, forehead, cheeks, nose, chin


def read_ply(path):
    """a binary PLY's points and triangles"""
    b = Path(path).read_bytes(); i = b.index(b"end_header\n") + 11; head = b[:i].decode().split("\n")
    nv = int(next(l for l in head if l.startswith("element vertex")).split()[-1])
    nf = int(next(l for l in head if l.startswith("element face")).split()[-1])
    props = [l.split() for l in head if l.startswith("property") and "list" not in l]
    dt = np.dtype([(p[2], {"float": "<f4", "uchar": "u1", "double": "<f8", "int": "<i4", "uint": "<u4"}[p[1]]) for p in props])
    v = np.frombuffer(b, dt, nv, i); off = i + nv * dt.itemsize
    tris = []
    for _ in range(nf):
        n = b[off]; f = np.frombuffer(b, "<u4", n, off + 1); off += 1 + 4 * n
        tris += [[f[0], f[k], f[k + 1]] for k in range(1, n - 1)]
    return np.stack([v["x"], v["y"], v["z"]], 1).astype(float), np.array(tris)


def umeyama(src, dst):
    """scale s, rotation R, move t with dst ~ s R src + t"""
    ms, md = src.mean(0), dst.mean(0); a, b = src - ms, dst - md
    U, S, Vt = np.linalg.svd(b.T @ a / len(src))
    d = np.sign(np.linalg.det(U @ Vt)); D = np.diag([1, 1, d])
    R = U @ D @ Vt; s = (S * np.diag(D)).sum() / (a ** 2).sum(1).mean()
    return s, R, md - s * R @ ms


def landmarks(points, tris):
    """MediaPipe's 468 points on this body's (or head's) face, through face_mesh's cached binding"""
    import face_mesh as F
    home = F.ROOT / "vendor" / "face_mesh"
    import os
    if os.environ.get("FACE_MESH_HOME"): home = Path(os.environ["FACE_MESH_HOME"])
    canon, _ = F.load_canonical(home / "canonical_face_model.obj")
    tpl = F.body_template(points, tris, "hair_fit")
    bnd = F.binding(home, tpl, canon, F.landmarker(home))
    return F.bound_points(tpl, bnd), bnd


def nearest(points, targets, chunk=4096):
    """for each point, the index of the nearest target"""
    out = np.empty(len(points), int)
    t2 = (targets ** 2).sum(1)
    for i in range(0, len(points), chunk):
        p = points[i:i + chunk]
        out[i:i + chunk] = np.argmin(t2[None, :] - 2 * p @ targets.T, axis=1)
    return out


def normals(points, tris):
    n = np.zeros_like(points)
    fn = np.cross(points[tris[:, 1]] - points[tris[:, 0]], points[tris[:, 2]] - points[tris[:, 0]])
    for k in range(3): np.add.at(n, tris[:, k], fn)
    return n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-12)


class Field:
    """the body as a radial field round the skull's middle and slices down the neck and torso (hair.js's fields)"""
    def __init__(self, pts, C, X, U, F, S):
        self.C, self.X, self.U, self.F, self.S = C, X, U, F, S
        self.AZ, self.EL = 48, 24
        d = pts - C; r = np.linalg.norm(d, axis=1)
        el = np.arcsin(np.clip(d @ U / (r + 1e-12), -1, 1)); az = np.arctan2(d @ X, d @ F)
        keep = (r < 0.17 * S) & (el > -0.35)
        self.head = np.zeros((self.EL, self.AZ))
        a, e = self.bins(az[keep], el[keep])
        np.maximum.at(self.head, (e, a), r[keep])
        for _ in range(3):                                  # holes from the neighbours
            nb = np.max([np.roll(self.head, 1, 1), np.roll(self.head, -1, 1), np.roll(self.head, 1, 0), np.roll(self.head, -1, 0)], 0)
            self.head = np.where(self.head > 0, self.head, nb)
        self.STEP, self.y0, self.SEC = 0.015 * S, C[1] - 0.02 * S, 32
        rows = int(0.75 * S / self.STEP)
        row = np.floor((self.y0 - pts[:, 1]) / self.STEP).astype(int)
        ok = (row >= 0) & (row < rows) & (np.abs(pts[:, 0]) < 0.2 * S)
        self.mid = np.zeros((rows, 2)); cnt = np.zeros(rows)
        np.add.at(self.mid, row[ok], pts[ok][:, [0, 2]]); np.add.at(cnt, row[ok], 1)
        self.mid /= np.maximum(cnt, 1)[:, None]; self.cnt = cnt
        dx = pts[ok, 0] - self.mid[row[ok], 0]; dz = pts[ok, 2] - self.mid[row[ok], 1]
        sec = ((np.arctan2(dx, dz) + np.pi) / (2 * np.pi) * self.SEC).astype(int) % self.SEC
        self.body = np.zeros((rows, self.SEC)); np.maximum.at(self.body, (row[ok], sec), np.hypot(dx, dz))
        self.rows = rows

    def bins(self, az, el):
        return (np.minimum(self.AZ - 1, ((az + np.pi) / (2 * np.pi) * self.AZ).astype(int)),
                np.minimum(self.EL - 1, ((el + np.pi / 2) / np.pi * self.EL).astype(int)))

    def push(self, p, gap):
        """p (n,3) out of the head and the body by gap; and which moved"""
        p = p.copy(); moved = np.zeros(len(p), bool)
        d = p - self.C; r = np.linalg.norm(d, axis=1)
        el = np.arcsin(np.clip(d @ self.U / (r + 1e-12), -1, 1)); az = np.arctan2(d @ self.X, d @ self.F)
        a, e = self.bins(az, el); R = self.head[e, a] + gap
        m = (el > -0.35) & (R > gap) & (r < R)
        p[m] = self.C + d[m] / r[m, None] * R[m, None]; moved |= m
        row = np.floor((self.y0 - p[:, 1]) / self.STEP).astype(int)
        ok = (row >= 0) & (row < self.rows)
        ok[ok] &= self.cnt[row[ok]] > 0
        dx = p[ok, 0] - self.mid[row[ok], 0]; dz = p[ok, 2] - self.mid[row[ok], 1]
        sec = ((np.arctan2(dx, dz) + np.pi) / (2 * np.pi) * self.SEC).astype(int) % self.SEC
        Rb = self.body[row[ok], sec]; rr = np.hypot(dx, dz)
        m2 = (Rb > 0) & (rr < Rb + gap)
        idx = np.flatnonzero(ok)[m2]; k = (Rb[m2] + gap) / np.maximum(rr[m2], 1e-6)
        p[idx, 0] = self.mid[row[idx], 0] + dx[m2] * k; p[idx, 2] = self.mid[row[idx], 1] + dz[m2] * k
        moved[idx] = True
        return p, moved


def frame(lm, S):
    """the head's frame from the face (hair.js's): X to the left, U up the face, F forward, C the skull's middle"""
    X = lm[454] - lm[234]; X /= np.linalg.norm(X)
    U = lm[10] - lm[152]; U -= X * (U @ X); U /= np.linalg.norm(U)
    F = np.cross(X, U)
    return X, U, F


def fit(strands, sx_pts, sx_tris, me_pts, me_tris, scale=1.0):
    sx_lm, _ = landmarks(sx_pts, sx_tris)
    me_lm, _ = landmarks(me_pts, me_tris)
    s, R, t = umeyama(sx_lm[FIRM], me_lm[FIRM])
    P = strands @ (s * R).T + t                                          # into this head's place and size
    res = np.linalg.norm(sx_lm[FIRM] @ (s * R).T + t - me_lm[FIRM], axis=1)
    # the scalp: this head's points above the eyes and behind the hairline, as the hair's roots know it
    X, U, Fw = frame(me_lm, scale)
    C = (me_lm[234] + me_lm[454]) / 2
    top = me_pts[:, 1].max()
    head = np.flatnonzero((me_pts[:, 1] > top - 0.30 * scale) & (np.linalg.norm(me_pts - C, axis=1) < 0.17 * scale))
    N = normals(me_pts, me_tris)
    roots = P[:, 0]
    k = head[nearest(roots, me_pts[head])]
    target = me_pts[k] + N[k] * 0.001 * scale
    move = target - roots
    gap0 = np.linalg.norm(move, axis=1)
    P = P + move[:, None, :]                                             # whole strands, by their roots
    # the skull's middle for the field: as hair.js finds it (the skull's front-back middle)
    d = me_pts[head] - C; up = d @ U > 0.02 * scale
    f = d[up] @ Fw; C2 = C + Fw * (f.min() + f.max()) / 2
    field = Field(me_pts, C2, X, U, Fw, scale)
    flat = P[:, 1:].reshape(-1, 3)
    pushed, moved = field.push(flat, 0.002 * scale)
    P[:, 1:] = pushed.reshape(P[:, 1:].shape)
    report = dict(strands=len(P), points=P.shape[1], scale=round(float(s), 4),
                  landmark_error_mm=round(float(res.mean() * 1000), 1),
                  root_moved_mm=dict(mean=round(float(gap0.mean() * 1000), 1), p95=round(float(np.percentile(gap0, 95) * 1000), 1)),
                  pushed_out_pct=round(float(100 * moved.mean()), 1))
    return P.astype(np.float32), report


def character_body(name):
    import mhr
    c = json.loads((ROOT / "Content" / "Studio" / "People" / name / "character.json").read_text(encoding="utf-8"))
    p = mhr.body(c.get("weights") or [])
    lo = p[:, 1].min(); k = c.get("height", 1.7) / (p[:, 1].max() - lo)
    return (p - [0, lo, 0]) * k, mhr.load()["tris"], k


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--strands", required=True); ap.add_argument("--out", required=True)
    ap.add_argument("--character"); ap.add_argument("--body", help="the body as the Studio has it (n,3 .npy)")
    ap.add_argument("--smplx", default=str(ROOT / "vendor" / "difflocks" / "src" / "data_loader" / "difflocks_bodydata" / "smplx_base.ply"))
    a = ap.parse_args()
    import mhr
    if a.body:
        pts, tris = np.load(a.body).astype(float), mhr.load()["tris"]
        k = (pts[:, 1].max() - pts[:, 1].min()) / 1.7
    elif a.character:
        pts, tris, k = character_body(a.character)
    else:
        sys.exit("--character NAME or --body body.npy")
    S = np.load(a.strands)["positions"].astype(float)
    sx, sxt = read_ply(a.smplx)
    P, rep = fit(S, sx, sxt, pts, tris, scale=k)
    np.savez_compressed(a.out, positions=P)
    print(json.dumps(rep))
    print("HAIRFIT ok")


if __name__ == "__main__":
    main()
