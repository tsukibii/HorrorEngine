"""Step 3: where the camera was in each frame, with no Structure from Motion tool. Two ways in:
  a person's capture: the frames that see the face get their pose by PnP from MediaPipe's 468 points against the
    same points pinned on this head (OpenCV), so the world is the head's own frame (metres, Y up, facing +Z);
  a wig on a mannequin: no face, so the first pose comes from two frames (the essential matrix), the world is the
    first camera's and its scale is the pair's baseline; clumps.py fits that world onto the character's head later
    (the cameras' down vector says which way is up, the first frame which way is front).
The rest are chained: SIFT features matched between neighbouring frames, triangulated from posed frames, PnP for the
next frame, outward until every frame is posed. Then one bundle adjustment (scipy) over all poses, the feature points
and the focal, with the face points as anchors when there are any. cameras.json keeps the poses and the report;
poses_sheet.jpg draws the head's points (a person) or the feature points over a few frames: the check by eye.

A capture that won't chain (a blank wall behind, a jump in the sweep): tools/gshair.py poses --colmap reads a COLMAP
text model instead (BSD; nothing else of it is used)."""
import json
from pathlib import Path

import numpy as np

from .common import Capture, FIRM, imread, jload, project_np

MIN_INLIERS = 40
PNP_PX = 4.0


def rotvec(R):
    import cv2
    return cv2.Rodrigues(R)[0].reshape(3)


def rotmat(w):
    import cv2
    return cv2.Rodrigues(np.asarray(w, float).reshape(3, 1))[0]


def Kmat(K):
    return np.array([[K[0], 0, K[2]], [0, K[1], K[3]], [0, 0, 1]], float)


def pnp(obj, img, K, px=PNP_PX, min_inliers=MIN_INLIERS):
    import cv2
    if len(obj) < 6: return None
    ok, rv, tv, inl = cv2.solvePnPRansac(obj.astype(np.float64), img.astype(np.float64), Kmat(K), None, iterationsCount=300,
                                         reprojectionError=px, confidence=0.999, flags=cv2.SOLVEPNP_EPNP)
    if not ok or inl is None or len(inl) < min_inliers: return None
    inl = inl.reshape(-1)
    rv, tv = cv2.solvePnPRefineLM(obj[inl].astype(np.float64), img[inl].astype(np.float64), Kmat(K), None, rv, tv)
    R, t = rotmat(rv), tv.reshape(3)
    p, z = project_np(obj[inl], R, t, K)
    if (z <= 0).any(): return None
    return R, t, inl, float(np.sqrt(((p - img[inl]) ** 2).sum(1).mean()))


def in_front(R, t, fr):
    """the camera centre is on the face's side of the head"""
    return float((-R.T @ t - fr["C"]) @ fr["F"]) > 0


def face_poses(cap, head_lm, K, max_rms=8.0):
    """PnP of the face's 468 points on the character's head, the camera kept in front of the face. A face is nearly
    flat, so PnP has a mirror solution (the camera behind the head, nearly the same reprojection) that EPnP, SQPnP and
    RANSAC's consensus fall into; OpenCV's iterative solver from its own start doesn't, and the points that disagree
    most are dropped once and the pose solved again from there"""
    import cv2
    from .common import head_frame
    fr = head_frame(head_lm)
    out = {}
    obj = head_lm.astype(np.float64)
    for name, pts in jload(cap.dir / "landmarks.json", {}).items():
        img = np.asarray(pts, np.float64)
        if len(img) != len(obj): continue
        ok, rv, tv = cv2.solvePnP(obj, img, Kmat(K), None, flags=cv2.SOLVEPNP_ITERATIVE)
        if not ok: continue
        p, z = project_np(obj, rotmat(rv), tv.reshape(3), K)
        e = np.linalg.norm(p - img, axis=1)
        inl = np.flatnonzero(e <= max(3 * np.median(e), 2.0))
        if len(inl) < 200: continue
        R, t = rotmat(rv), tv.reshape(3)
        ok, rv2, tv2 = cv2.solvePnP(obj[inl], img[inl], Kmat(K), None, flags=cv2.SOLVEPNP_ITERATIVE)   # again, from scratch, without the worst points
        if ok:                                                        # (a refinement from a guess can walk to the twin with the points behind the camera)
            R2, t2 = rotmat(rv2), tv2.reshape(3); p2, z2 = project_np(obj[inl], R2, t2, K)
            if (z2 > 0).all() and in_front(R2, t2, fr): R, t = R2, t2
        p, z = project_np(obj[inl], R, t, K)
        if (z <= 0).any() or not in_front(R, t, fr): continue
        rms = float(np.sqrt(((p - img[inl]) ** 2).sum(1).mean()))
        if rms > max_rms: continue
        out[name] = dict(R=R, t=t, rms=rms, inliers=int(len(inl)), source="face")
    return out


def features(cap, max_side=1080, n=4000):
    import cv2
    sift = cv2.SIFT_create(nfeatures=n, contrastThreshold=0.02)
    kp, desc = {}, {}
    for name in cap.names:
        g = imread(cap.frame(name), max_side, grey=True)
        k, d = sift.detectAndCompute(g, None)
        kp[name] = np.array([p.pt for p in k], np.float32).reshape(-1, 2) * (cap.meta["width"] / g.shape[1])
        desc[name] = d if d is not None else np.zeros((0, 128), np.float32)
    return kp, desc


def match(desc_a, desc_b, kp_a, kp_b, ratio=0.75):
    import cv2
    if len(desc_a) < 8 or len(desc_b) < 8: return np.zeros((0, 2), int)
    bf = cv2.BFMatcher(cv2.NORM_L2)
    pairs = [(m[0].queryIdx, m[0].trainIdx) for m in bf.knnMatch(desc_a, desc_b, k=2) if len(m) == 2 and m[0].distance < ratio * m[1].distance]
    pairs = np.array(pairs, int).reshape(-1, 2)
    if len(pairs) < 12: return np.zeros((0, 2), int)
    F, mask = cv2.findFundamentalMat(kp_a[pairs[:, 0]], kp_b[pairs[:, 1]], cv2.FM_RANSAC, 3.0, 0.999)
    if mask is None: return np.zeros((0, 2), int)
    return pairs[mask.reshape(-1) > 0]


class Tracks:
    """feature observations joined across frames into tracks, each at most one feature per frame: a match joins a
    feature to an existing track only if the track has nothing in that frame yet (a wrong match can't swallow a
    whole wall of look-alike dots into one track), and tracks are never merged. A list of {frame: feature index}"""
    def build(self, names, kp, pairs):
        order = {n: k for k, n in enumerate(names)}
        track_of, tracks = {}, []
        for (a, b) in sorted(pairs, key=lambda ab: (order[ab[1]] - order[ab[0]], order[ab[0]])):
            for i, j in pairs[(a, b)]:
                ka, kb = (a, int(i)), (b, int(j))
                ta, tb = track_of.get(ka), track_of.get(kb)
                if ta is None and tb is None:
                    track_of[ka] = track_of[kb] = len(tracks); tracks.append({a: int(i), b: int(j)})
                elif tb is None and b not in tracks[ta]:
                    tracks[ta][b] = int(j); track_of[kb] = ta
                elif ta is None and tb is not None and a not in tracks[tb]:
                    tracks[tb][a] = int(i); track_of[ka] = tb
        return [t for t in tracks if len(t) >= 2]


def triangulate(obs, poses, kp, K):
    rows, cams = [], []
    for name, i in obs.items():
        if name not in poses: continue
        R, t = poses[name]["R"], poses[name]["t"]
        P = Kmat(K) @ np.hstack([R, t[:, None]])
        u, v = kp[name][i]
        rows.append(u * P[2] - P[0]); rows.append(v * P[2] - P[1]); cams.append((name, R, t))
    if len(cams) < 2: return None
    _, _, Vt = np.linalg.svd(np.array(rows))
    X = Vt[-1]
    if abs(X[3]) < 1e-12: return None
    X = X[:3] / X[3]
    centres = [-R.T @ t for _, R, t in cams]
    rays = [(X - c) / (np.linalg.norm(X - c) + 1e-12) for c in centres]
    best = max(np.degrees(np.arccos(np.clip(rays[i] @ rays[j], -1, 1))) for i in range(len(rays)) for j in range(i + 1, len(rays)))
    if best < 1.5: return None
    for name, R, t in cams:
        p, z = project_np(X[None], R, t, K)
        if z[0] <= 0.05 or np.linalg.norm(p[0] - kp[name][obs[name]]) > 2 * PNP_PX: return None
    return X


def init_pair(cap, kp, desc, pairs, K):
    """the first two poses from the essential matrix of a pair with enough matches and parallax"""
    import cv2
    names = cap.names; W = cap.meta["width"]
    best = None
    for (a, b), m in pairs.items():
        if len(m) < 80: continue
        disp = np.median(np.linalg.norm(kp[a][m[:, 0]] - kp[b][m[:, 1]], axis=1))
        if disp < 0.02 * W: continue
        score = len(m) * min(disp / (0.06 * W), 1.0)
        if best is None or score > best[0]: best = (score, a, b, m)
    if best is None: raise SystemExit("no pair of frames with enough matched features and parallax to start from: is the background textured and the sweep steady?")
    _, a, b, m = best
    p1, p2 = kp[a][m[:, 0]].astype(np.float64), kp[b][m[:, 1]].astype(np.float64)
    E, mask = cv2.findEssentialMat(p1, p2, Kmat(K), cv2.RANSAC, 0.999, 1.5)
    n, R, t, mask2 = cv2.recoverPose(E, p1, p2, Kmat(K), mask=mask)
    if n < 40: raise SystemExit(f"the starting pair {a}-{b} gave only {n} points in front of both cameras")
    return {a: dict(R=np.eye(3), t=np.zeros(3), rms=0.0, inliers=int(n), source="pair"),
            b: dict(R=R, t=t.reshape(3), rms=0.0, inliers=int(n), source="pair")}


def relative_step(a, b, m, poses, kp, tracks, pts, K, track_of):
    """frame b from posed frame a by their essential matrix, the scale from the 3D points they share (a visual-odometry
    step for when too few points are known for PnP)"""
    import cv2
    if len(m) < 30: return None
    pa, pb = kp[a][m[:, 0]].astype(np.float64), kp[b][m[:, 1]].astype(np.float64)
    E, mask = cv2.findEssentialMat(pa, pb, Kmat(K), cv2.RANSAC, 0.999, 1.5)
    if E is None or E.shape != (3, 3): return None
    n, Rab, tab, mask2 = cv2.recoverPose(E, pa, pb, Kmat(K), mask=mask)
    if n < 20: return None
    tab = tab.reshape(3)
    Ra, ta = poses[a]["R"], poses[a]["t"]
    inl = mask2.reshape(-1) > 0
    # the scale: points known in the world, seen in both, triangulated again with a unit baseline
    P0 = Kmat(K) @ np.hstack([np.eye(3), np.zeros((3, 1))]); P1 = Kmat(K) @ np.hstack([Rab, tab[:, None]])
    ratios = []
    for (i, j), ok in zip(m, inl):
        if not ok: continue
        ti = track_of.get((a, int(i)))
        if ti is None or ti not in pts: continue
        X = pts[ti] @ Ra.T + ta                                        # in camera a
        Xu = cv2.triangulatePoints(P0, P1, kp[a][i].reshape(2, 1).astype(np.float64), kp[b][j].reshape(2, 1).astype(np.float64))
        Xu = (Xu[:3] / Xu[3]).reshape(3)
        if Xu[2] > 1e-6 and X[2] > 1e-6: ratios.append(X[2] / Xu[2])
    if len(ratios) < 3: return None
    s = float(np.median(ratios))
    if np.median(np.abs(np.array(ratios) / s - 1)) > 0.3: return None
    R = Rab @ Ra; t = Rab @ ta + s * tab
    return dict(R=R, t=t, rms=0.0, inliers=int(n), source="step")


def chain(cap, poses, kp, desc, K, head_lm=None, span=4, bundle_every=5):
    names = cap.names
    pairs = {}
    for i, a in enumerate(names):
        for j in range(i + 1, min(len(names), i + span + 1)):
            m = match(desc[a], desc[names[j]], kp[a], kp[names[j]])
            if len(m): pairs[(a, names[j])] = m
    if not poses: poses.update(init_pair(cap, kp, desc, pairs, K))
    tracks = Tracks().build(names, kp, pairs)
    track_of = {(name, i): ti for ti, obs in enumerate(tracks) for name, i in obs.items()}
    pts, log = {}, []

    def grow_points(again=False):
        for ti, obs in enumerate(tracks):
            if ti in pts and not again: continue
            X = triangulate(obs, poses, kp, K)
            if X is not None: pts[ti] = X
            elif again: pts.pop(ti, None)
    grow_points()
    changed = True; since_bundle = 0
    while changed:
        changed = False
        for name in [n for n in names if n not in poses]:
            if since_bundle >= bundle_every:                                # incremental SfM: settle what's posed so far
                bundle(cap, poses, tracks, pts, kp, head_lm, K, refine_focal=False, max_nfev=20)
                grow_points(again=True); since_bundle = 0
            obj, img = [], []
            for ti, obs in enumerate(tracks):
                if ti in pts and name in obs: obj.append(pts[ti]); img.append(kp[name][obs[name]])
            r = pnp(np.array(obj), np.array(img), K, px=2 * PNP_PX, min_inliers=15) if len(obj) >= 15 else None
            if r is not None:
                R, t, inl, rms = r
                poses[name] = dict(R=R, t=t, rms=rms, inliers=int(len(inl)), source="chain")
            else:                                                       # too few known points: a step from a posed neighbour
                i = names.index(name); best = None
                for j in range(max(0, i - span), min(len(names), i + span + 1)):
                    other = names[j]
                    if other not in poses or other == name: continue
                    m = pairs.get((other, name)); flip = False
                    if m is None: m = pairs.get((name, other)); flip = True
                    if m is None: continue
                    mm = m[:, ::-1] if flip else m
                    if best is None or len(mm) > len(best[1]): best = (other, mm)
                if best is None: continue
                r = relative_step(best[0], name, best[1], poses, kp, tracks, pts, K, track_of)
                if r is None: continue
                poses[name] = r
            log.append((name, poses[name]["inliers"], poses[name]["source"])); changed = True; since_bundle += 1
            grow_points()
    return tracks, pts, log


def bundle(cap, poses, tracks, pts, kp, head_lm, K, refine_focal=True, max_points=8000, face_weight=5.0, max_nfev=60, drop_px=12.0, loss="huber"):
    """one bundle adjustment: poses, points, the focal; the face points anchor the frames that see it, else the
    first camera and the scale are held"""
    from scipy.optimize import least_squares
    from scipy.sparse import lil_matrix
    names = [n for n in cap.names if n in poses]
    ni = {n: i for i, n in enumerate(names)}
    lms = jload(cap.dir / "landmarks.json", {})
    tids = sorted(pts, key=lambda t: -len(tracks[t]))[:max_points]
    pi = {t: i for i, t in enumerate(tids)}
    obs = np.array([(ni[name], pi[t], *kp[name][k]) for t in tids for name, k in tracks[t].items() if name in ni], float).reshape(-1, 4)
    # observations that don't fit the poses as they stand are out (a wrong match, a point behind a camera)
    keep = np.ones(len(obs), bool)
    for i in range(len(obs)):
        f_, j_ = int(obs[i, 0]), int(obs[i, 1]); R, t = poses[names[f_]]["R"], poses[names[f_]]["t"]
        p, z = project_np(pts[tids[j_]][None], R, t, K)
        keep[i] = z[0] > 0.05 and np.linalg.norm(p[0] - obs[i, 2:]) < drop_px
    obs = obs[keep]
    if len(obs) < 20: return dict(rms_before=None, rms_after=None, focal=K[0], points=0, observations=0, face_observations=0, anchored=False), K[0]
    fobs = []
    if head_lm is not None:
        for name, L in lms.items():
            if name in ni and poses[name]["source"] == "face":
                L = np.asarray(L, float)
                fobs += [(ni[name], l, L[l, 0], L[l, 1]) for l in range(len(L))]
    fobs = np.array(fobs, float).reshape(-1, 4)
    anchored = len(fobs) > 0
    nF, nP = len(names), len(tids)
    x0 = np.concatenate([np.concatenate([rotvec(poses[n]["R"]), poses[n]["t"]]) for n in names] + [pts[t] for t in tids] + [[K[0]]])
    fi, pj = obs[:, 0].astype(int), obs[:, 1].astype(int)
    ffi, fl = fobs[:, 0].astype(int), fobs[:, 1].astype(int)
    gauge = [] if anchored else [i for i, n in enumerate(names) if poses[n]["source"] == "pair"]
    g0 = x0[6 * gauge[0]: 6 * gauge[0] + 6].copy() if gauge else None
    base0 = np.linalg.norm(x0[6 * gauge[1] + 3: 6 * gauge[1] + 6]) if len(gauge) > 1 else None

    def unpack(x):
        return x[:6 * nF].reshape(nF, 6), x[6 * nF:6 * nF + 3 * nP].reshape(nP, 3), (x[-1] if refine_focal else K[0])

    def proj(cams, X, f, idx):
        out = np.empty((len(idx), 2))
        for i in np.unique(idx):
            m = idx == i; R = rotmat(cams[i, :3]); c = X[m] @ R.T + cams[i, 3:]
            z = np.maximum(c[:, 2], 0.05)                                 # a point behind a camera: a bounded, not a huge, residual
            out[m] = np.stack([f * c[:, 0] / z + K[2], f * c[:, 1] / z + K[3]], 1)
        return out

    def resid(x):
        cams, P, f = unpack(x)
        r = [(proj(cams, P[pj], f, fi) - obs[:, 2:]).reshape(-1)]
        if anchored: r.append((proj(cams, head_lm[fl], f, ffi) - fobs[:, 2:]).reshape(-1) * face_weight)
        if gauge:
            r.append((cams[gauge[0]] - g0) * 1e3)
            if base0 is not None: r.append(np.array([(np.linalg.norm(cams[gauge[1], 3:]) - base0) * 1e3]))
        return np.concatenate(r)

    n_res = len(resid(x0))
    S = lil_matrix((n_res, len(x0)), dtype=int)
    rows = np.arange(len(obs)) * 2
    for k in range(6): S[rows, fi * 6 + k] = 1; S[rows + 1, fi * 6 + k] = 1
    for k in range(3): S[rows, 6 * nF + pj * 3 + k] = 1; S[rows + 1, 6 * nF + pj * 3 + k] = 1
    at = 2 * len(obs)
    if anchored:
        frows = at + np.arange(len(fobs)) * 2
        for k in range(6): S[frows, ffi * 6 + k] = 1; S[frows + 1, ffi * 6 + k] = 1
        at += 2 * len(fobs)
    if gauge:
        for k in range(6): S[at + k, 6 * gauge[0] + k] = 1
        at += 6
        if base0 is not None:
            for k in range(3): S[at, 6 * gauge[1] + 3 + k] = 1
    if refine_focal: S[:, -1] = 1
    before = float(np.sqrt((resid(x0)[: 2 * len(obs)] ** 2).mean()))
    r = least_squares(resid, x0, jac_sparsity=S, loss=loss, f_scale=2.0, x_scale="jac", max_nfev=max_nfev, verbose=0)
    cams, P, f = unpack(r.x)
    for n in names:
        i = ni[n]; poses[n]["R"] = rotmat(cams[i, :3]); poses[n]["t"] = cams[i, 3:]
    for t in tids: pts[t] = P[pi[t]]
    after = float(np.sqrt((resid(r.x)[: 2 * len(obs)] ** 2).mean()))
    return dict(rms_before=round(before, 2), rms_after=round(after, 2), focal=round(float(f), 1), points=nP,
                observations=int(len(obs)), face_observations=int(len(fobs)), anchored=anchored), f


def look_point(frames):
    """the point the cameras look at (least squares on their forward rays) and their mean distance from it"""
    C = np.array([-f["R"].T @ f["t"] for f in frames]); D = np.array([f["R"][2] for f in frames])
    A = np.zeros((3, 3)); b = np.zeros(3)
    for c, d in zip(C, D):
        P = np.eye(3) - np.outer(d, d); A += P; b += P @ c
    look = np.linalg.solve(A + 1e-9 * np.eye(3), b)
    return look, float(np.linalg.norm(C - look, axis=1).mean())


def sheet(cap, frames, K, path, head_lm=None, head_points=None, pts=None, n=8):
    """a contact sheet: the head's points (a person) or the triangulated features over n frames"""
    import cv2
    pick = frames[:: max(1, len(frames) // n)][:n]
    tiles = []
    rng = np.random.default_rng(1)
    cloud = head_points[rng.choice(len(head_points), min(1500, len(head_points)), replace=False)] if head_points is not None else (np.array(list(pts.values())) if pts else None)
    for f in pick:
        img = imread(cap.frame(f["name"]))
        R, t = f["R"], f["t"]
        if cloud is not None and len(cloud):
            p, z = project_np(cloud, R, t, K)
            for (u, v), zz in zip(p, z):
                if zz > 0 and 0 <= u < img.shape[1] and 0 <= v < img.shape[0]: cv2.circle(img, (int(u), int(v)), 2, (60, 200, 255), -1)
        if head_lm is not None:
            p, z = project_np(head_lm[FIRM], R, t, K)
            for (u, v), zz in zip(p, z):
                if zz > 0 and 0 <= u < img.shape[1] and 0 <= v < img.shape[0]: cv2.circle(img, (int(u), int(v)), 3, (0, 255, 0), -1)
        cv2.putText(img, f"{f['name']} {f['source']} {f['rms']:.1f}px", (8, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)
        k = 360 / img.shape[0]
        tiles.append(cv2.resize(img, (round(img.shape[1] * k), 360)))
    if not tiles: return
    cols = 4
    rows = [np.hstack(tiles[i:i + cols]) for i in range(0, len(tiles), cols)]
    w = max(r.shape[1] for r in rows)
    cv2.imwrite(str(path), np.vstack([np.pad(r, ((0, 0), (0, w - r.shape[1]), (0, 0))) for r in rows]), [cv2.IMWRITE_JPEG_QUALITY, 80])


def read_colmap(model_dir):
    poses = {}
    for line in (Path(model_dir) / "images.txt").read_text().splitlines():
        if line.startswith("#") or not line.strip(): continue
        p = line.split()
        if len(p) < 10 or not p[-1].lower().endswith((".jpg", ".png")): continue
        qw, qx, qy, qz = map(float, p[1:5]); t = np.array(list(map(float, p[5:8])))
        R = np.array([[1 - 2 * (qy * qy + qz * qz), 2 * (qx * qy - qz * qw), 2 * (qx * qz + qy * qw)],
                      [2 * (qx * qy + qz * qw), 1 - 2 * (qx * qx + qz * qz), 2 * (qy * qz - qx * qw)],
                      [2 * (qx * qz - qy * qw), 2 * (qy * qz + qx * qw), 1 - 2 * (qx * qx + qy * qy)]])
        poses[Path(p[-1]).stem] = dict(R=R, t=t, rms=0.0, inliers=0, source="colmap")
    return poses


def align_to(poses, anchors):
    """a similarity taking one world onto another, from frames posed both ways (3 or more)"""
    common = [n for n in anchors if n in poses]
    if len(common) < 3: raise SystemExit("fewer than 3 frames posed both ways: can't align the COLMAP model to the head")
    A = np.array([-poses[n]["R"].T @ poses[n]["t"] for n in common]); B = np.array([-anchors[n]["R"].T @ anchors[n]["t"] for n in common])
    ma, mb = A.mean(0), B.mean(0); a, b = A - ma, B - mb
    U, S, Vt = np.linalg.svd(b.T @ a / len(a)); d = np.sign(np.linalg.det(U @ Vt)); D = np.diag([1, 1, d])
    R = U @ D @ Vt; s = (S * np.diag(D)).sum() / (a ** 2).sum(1).mean(); t = mb - s * R @ ma
    for p in poses.values():
        Rc, tc = p["R"], p["t"]
        p["R"] = Rc @ R.T; p["t"] = (tc - Rc @ R.T @ t / s) * s
    return poses


def run(out, head_lm=None, head_points=None, colmap=None, refine_focal=True, no_chain=False):
    cap = Capture(out)
    K = list(cap.meta["K"])
    poses = face_poses(cap, head_lm, K) if head_lm is not None else {}
    report = dict(frames=len(cap.names), face=len(poses))
    pts = None
    if colmap:
        cm = read_colmap(colmap)
        poses = align_to(cm, poses) if poses else cm
        report["colmap"] = len(poses)
    elif no_chain:
        if not poses: raise SystemExit("--no-chain needs frames that see the face")
    elif len(poses) < len(cap.names):
        kp, desc = features(cap)
        tracks, pts, log = chain(cap, poses, kp, desc, K, head_lm)
        report["chain"] = len(log); report["unposed"] = [n for n in cap.names if n not in poses]
        # the whole loop at once: first with a loose gate so the frames where the chain's two ends meet pull on each
        # other, the points triangulated again, then tightly
        bundle(cap, poses, tracks, pts, kp, head_lm, K, refine_focal=False, max_nfev=100, drop_px=60.0, loss="linear")   # plain least squares: a robust loss would let the drift stand
        for ti, obs in enumerate(tracks):
            X = triangulate(obs, poses, kp, K)
            if X is not None: pts[ti] = X
            else: pts.pop(ti, None)
        ba, f = bundle(cap, poses, tracks, pts, kp, head_lm, K, refine_focal, max_nfev=80, drop_px=8.0)
        report["bundle"] = ba
        if refine_focal: K = [f, f, K[2], K[3]]
    if not poses: raise SystemExit("no frame could be posed")
    frames = [dict(name=n, R=poses[n]["R"], t=poses[n]["t"], rms=round(float(poses[n]["rms"]), 2), inliers=poses[n]["inliers"], source=poses[n]["source"], K=K)
              for n in cap.names if n in poses]
    anchored = any(f["source"] == "face" for f in frames)
    report.update(posed=len(frames), anchored=anchored)
    if anchored: report["rms_face"] = round(float(np.mean([f["rms"] for f in frames if f["source"] == "face"])), 2)
    look, dist = look_point(frames)
    C = head_lm.mean(0) if anchored else look
    down = np.mean([f["R"][1] for f in frames], 0); down /= np.linalg.norm(down)
    ang = [float(np.degrees(np.arctan2(*((-f["R"].T @ f["t"] - C)[[0, 2]])))) for f in frames]
    report.update(look=look.round(4).tolist(), camera_distance=round(dist, 3), down=down.round(4).tolist(),
                  forward_first=frames[0]["R"][2].round(4).tolist(), sweep_deg=dict(min=round(min(ang)), max=round(max(ang))))
    cap.save_cameras(frames, report)
    sheet(cap, frames, K, cap.dir / "poses_sheet.jpg", head_lm if anchored else None, head_points if anchored else None, pts)
    return report


def main(a):
    from .common import load_head, landmarks_on
    pts, tris, name = load_head(a.head, a.body)
    lm = landmarks_on(pts, tris, name)
    np.savez_compressed(Path(a.out) / "head.npz", points=pts.astype(np.float32), tris=tris.astype(np.int32), landmarks=lm.astype(np.float32))
    faces = jload(Path(a.out) / "masks.json", {}).get("faces", 0)
    rep = run(a.out, lm if faces else None, pts, a.colmap, not a.fixed_focal, a.no_chain)
    print(json.dumps(rep))
    if rep["posed"] < rep["frames"]: print(f"warning: {rep['frames'] - rep['posed']} frames unposed (left out)")
    if not rep["anchored"]: print("no face seen: the world is the first camera's; clumps.py fits it onto the head (adjust on the page)")
    print("GSHAIR poses ok")
