"""The salon's locked reference (docs/SALON_PLAN.md, Phase 1): a video's frames (or a few photos) with a camera per
frame in the head's own space, so the salon can turn the view to a frame's camera and lay the frame over the head.

Nothing trains. From a capture (frames, masks, poses: the gshair steps), the cameras are moved from the capture's world
into a head-local space that any MHR body can rebuild: the origin between the ears, X to the character's left, U up the
face, F forward, in units of MHR's face height (landmark 10 to 152). Four MHR vertices (the ones nearest landmarks 234,
10 and 152 on the capture's head, and 234's mirror) define that frame on whatever body the salon shows, so a reference made on the
base body lands on a character of another height.

    reference.make(capture_dir, name)            -> Content/Studio/Hair/References/<name>/reference.json, frames/, keyed/
    reference.photos({"front": f, "side": f, "back": f}, name)

The capture's world reaches the head through align.json (the splat's fit) when there is one; otherwise a guess from the
orbit's cameras and the key's silhouette (the salon's hand fit finishes either way).
"""
import json
import math
from pathlib import Path

import numpy as np

from .common import ROOT, jload, jsave, head_frame

REFS = ROOT / "Content" / "Studio" / "Hair" / "References"
FACE_H = 0.1653                       # MHR's base face, landmark 10 to 152 (common.mhr_scale)
ANCHORS = dict(right=234, top=10, chin=152)
DEFAULT_ANCHORS = dict(right=4113, left=1227, top=2796, chin=2834)   # MHR's vertices, measured on the base body


def anchor_vertices(points, lm):
    """the MHR vertices nearest the landmarks, the left one the right one's mirror (MHR is symmetric about x = 0; the
    landmark binding isn't quite, which would turn the frame about 10 degrees)"""
    idx = {k: int(np.argmin(np.linalg.norm(points - lm[i], axis=1))) for k, i in ANCHORS.items()}
    idx["left"] = int(np.argmin(np.linalg.norm(points - points[idx["right"]] * [-1, 1, 1], axis=1)))
    return idx


def local_frame(points, idx):
    """the head-local frame from the anchor vertices (salon.js does the same on its body)"""
    v = {k: points[i] for k, i in idx.items()}
    X = v["left"] - v["right"]; X = X / np.linalg.norm(X)
    U = v["top"] - v["chin"]; h = float(np.linalg.norm(U)); U = U - X * (U @ X); U = U / np.linalg.norm(U)
    F = np.cross(X, U)
    return dict(C=(v["right"] + v["left"]) / 2, B=np.stack([X, U, F], 1), S=h / FACE_H)


def turn_about_up(R, t, a):
    """the camera turned by a radians about the local U axis through the origin (the rig turned, the head kept)"""
    c, s_ = math.cos(a), math.sin(a)
    Ry = np.array([[c, 0, s_], [0, 1, 0], [-s_, 0, c]])
    return R @ Ry.T, t


def to_local(R_c, t_c, Q, sigma, b):
    """a camera (world to camera, OpenCV: x right, y down, z forward) moved through p_l = sigma Q p_w + b"""
    R = R_c @ Q.T
    t = sigma * t_c - R @ b
    return R, t


def orbit_angles(R, t):
    c = -R.T @ t
    return math.degrees(math.atan2(c[0], c[2])), math.degrees(math.atan2(c[1], math.hypot(c[0], c[2]))), float(np.linalg.norm(c))


def guess_align(cams, alpha0, K0, fr, field_w):
    """no splat: the capture's world onto the head from the orbit's cameras (up from their down, front from the front
    frame) and the front frame's key silhouette (its width 1.2 head widths, its top 1 cm over the skull)"""
    rep = cams["report"]
    up = -np.array(rep.get("down", [0, -1, 0]), float); up /= np.linalg.norm(up)
    f0 = -np.array(rep.get("forward_first", [0, 0, -1]), float); f0 = f0 - up * (f0 @ up); f0 /= np.linalg.norm(f0)
    x = np.cross(up, f0)
    R = np.stack([fr["X"], fr["U"], fr["F"]], 1) @ np.stack([x, up, f0], 1).T
    look = np.array(rep.get("look", [0, 0, 0]), float)
    f = cams["frames"][0]; Rc, tc = np.array(f["R"]), np.array(f["t"])
    d = float(np.linalg.norm(-Rc.T @ tc - look))
    ys, xs = np.nonzero(alpha0 > 128)
    if len(xs) < 50: return dict(R=R.tolist(), t=(fr["C"] - R @ look).tolist(), s=1.0, source="guess")
    top = ys.min(); band = ys < top + 0.35 * (ys.max() - top)
    lo, hi = np.percentile(xs[band], [5, 95])
    width = (hi - lo) * d / K0[0]
    s = 1.2 * field_w / max(width, 1e-6)
    # the silhouette's top, back into the world at the look point's depth
    v_top = (top - K0[3]) * d / K0[1]
    cam_down = Rc.T @ np.array([0, 1, 0.0])
    top_w = look + cam_down * v_top
    skull_top = fr["C"] + fr["U"] * (0.62 * field_w)                 # the skull's top over the ears, roughly
    t = skull_top + fr["U"] * 0.01 - s * R @ top_w
    # the look point sits over the skull's middle front to back
    return dict(R=R.tolist(), t=t.tolist(), s=float(s), source="silhouette")


# inner-face landmarks that don't slide round the silhouette as the head turns: the eyes' corners, the brows, the nose,
# the mouth's corners and lips, the chin, the forehead
FACE_POINTS = (33, 133, 263, 362, 70, 105, 300, 334, 168, 6, 197, 1, 2, 98, 327, 61, 291, 0, 17, 152, 10, 151, 50, 280)


def triangulate(rows, lm2d, j, min_views=3):
    """landmark j from every frame that saw it (linear, the cameras in local space): the point and its rms reprojection"""
    A, used = [], []
    for r in rows:
        pts = lm2d.get(r["name"])
        if not pts or j >= len(pts): continue
        fx, fy, cx, cy = r["K_src"]; u, v = pts[j]
        R, t = np.array(r["R"]), np.array(r["t"])
        P = np.array([[fx, 0, cx], [0, fy, cy], [0, 0, 1.0]]) @ np.hstack([R, t[:, None]])
        A += [u * P[2] - P[0], v * P[2] - P[1]]; used.append((P, u, v))
    if len(used) < min_views: return None, None
    X = np.linalg.svd(np.array(A))[2][-1]; X = X[:3] / X[3]
    err = [np.hypot(*(((P @ np.append(X, 1))[:2] / (P @ np.append(X, 1))[2]) - [u, v])) for P, u, v in used]
    return X, float(np.sqrt(np.mean(np.square(err))))


def umeyama(a, b):
    """s, R, t with s R a + t ~ b (least squares)"""
    ma, mb = a.mean(0), b.mean(0); A, B = a - ma, b - mb
    U, S, Vt = np.linalg.svd(B.T @ A / len(a))
    D = np.eye(3); D[2, 2] = np.sign(np.linalg.det(U @ Vt))
    R = U @ D @ Vt; s = float(np.trace(np.diag(S) @ D) / (A ** 2).sum() * len(a))
    return s, R, mb - s * R @ ma


def face_fit(rows, lm2d, mhr_local):
    """the reference's face (triangulated from the frames that saw it) onto the head's same landmarks: the salon's fit
    (scale, turn, height, offset), or None when too few frames saw a face"""
    a, b, errs = [], [], []
    for j in FACE_POINTS:
        X, e = triangulate(rows, lm2d, j)
        if X is None: continue
        a.append(X); b.append(mhr_local[j]); errs.append(e)
    if len(a) < 8: return None
    a, b = np.array(a), np.array(b)
    s, R, t = umeyama(a, b)
    res = np.linalg.norm(s * a @ R.T + t - b, axis=1)
    turn = math.degrees(math.atan2(-R[2, 0], R[0, 0])); tilt = math.degrees(math.atan2(-R[1, 2], R[1, 1]))
    roll = math.degrees(math.asin(max(-1.0, min(1.0, R[1, 0]))))
    return dict(offset=[round(float(x), 5) for x in t], scale=round(s, 4), turn=round(turn, 2), height=round(-tilt, 2),
                source="face", points=len(a), reproj_px=round(float(np.median(errs)), 2), residual_mm=round(float(np.median(res)) * 1000, 1), roll=round(roll, 2))


def hull_box(rows, alphas, size, step=0.015, keep=0.9, pad=0.015):
    """the hair's box in the reference's local space: a coarse visual hull carved by the keyed frames (a voxel stays
    when it falls inside the hair in nearly every frame that sees it), its bounds padded"""
    import cv2
    w2, h2 = size
    ax = [np.arange(-0.35, 0.35, step), np.arange(-0.7, 0.35, step), np.arange(-0.45, 0.4, step)]
    X, Y, Z = np.meshgrid(*ax, indexing="ij"); P = np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1)
    inside = np.zeros(len(P)); seen = np.zeros(len(P))
    for r, a in zip(rows, alphas):
        if a is None: continue
        m = cv2.dilate((a > 64).astype(np.uint8), np.ones((5, 5), np.uint8))
        R, t = np.array(r["R"]), np.array(r["t"]); fx, fy, cx, cy = r["K"]
        c = P @ R.T + t; z = c[:, 2]; ok = z > 1e-3
        u = np.round(fx * c[:, 0] / np.where(ok, z, 1) + cx).astype(int); v = np.round(fy * c[:, 1] / np.where(ok, z, 1) + cy).astype(int)
        vis = ok & (u >= 0) & (u < w2) & (v >= 0) & (v < h2)
        seen += vis; inside[vis] += m[v[vis], u[vis]] > 0
    hull = (seen >= 3) & (inside >= keep * seen)
    if hull.sum() < 20: return None
    H = P[hull]
    return dict(min=np.round(H.min(0) - pad, 4).tolist(), max=np.round(H.max(0) + pad, 4).tolist(), voxels=int(hull.sum()), step=step)


def _write(img, path, quality=82):
    import cv2
    path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(path), img, [cv2.IMWRITE_WEBP_QUALITY, quality])


def make(cap, name, size=640, quality=82, use_align=True, refs=None):
    import cv2
    cap = Path(cap); out = Path(refs or REFS) / name
    cams = jload(cap / "cameras.json")
    if not cams: raise SystemExit(f"no cameras.json in {cap}: run the poses step first (gshair.py run VIDEO --to reference)")
    head = np.load(cap / "head.npz")
    pts, lm = head["points"].astype(float), head["landmarks"].astype(float)
    idx = anchor_vertices(pts, lm)
    loc = local_frame(pts, idx)
    fr = head_frame(lm)
    al = jload(cap / "align.json") if use_align else None
    if al is None and cams["report"].get("anchored"):             # the face anchored the poses: the capture's world is the head's
        al = dict(R=np.eye(3).tolist(), t=[0, 0, 0], s=1.0, source="face")
    W, H = int(cams["width"]), int(cams["height"])
    k = min(1.0, size / max(W, H)); w2, h2 = round(W * k), round(H * k)
    frames = cams["frames"]
    if al is None:
        a0 = cv2.imread(str(cap / "masks" / f"{frames[0]['name']}_alpha.png"), cv2.IMREAD_GRAYSCALE)
        if a0 is None: a0 = np.zeros((H, W), np.uint8)
        a0 = cv2.resize(a0, (W, H))
        field_w = float(np.linalg.norm(pts[idx["left"]] - pts[idx["right"]])) * 1.15
        al = guess_align(cams, a0, frames[0]["K"], fr, field_w)
    Ra, ta, sa = np.array(al["R"], float), np.array(al["t"], float), float(al["s"])
    # capture world -> head (p_h = s R p + t) -> local (p_l = B^T (p_h - C) / S)
    Q = loc["B"].T @ Ra; sigma = sa / loc["S"]; b = loc["B"].T @ (ta - loc["C"]) / loc["S"]
    front = int(cams["report"].get("orbit", {}).get("front", 0) or 0) if not cams["report"].get("anchored") else None
    turn = 0.0
    if front is not None and 0 <= front < len(frames):           # the front frame faces the face (the orbit's prior)
        R0, t0 = to_local(np.array(frames[front]["R"], float), np.array(frames[front]["t"], float), Q, sigma, b)
        turn = -math.radians(orbit_angles(R0, t0)[0])
    rows, alphas = [], []
    for f in frames:
        R, t = to_local(np.array(f["R"], float), np.array(f["t"], float), Q, sigma, b)
        R, t = turn_about_up(R, t, turn)
        az, el, dist = orbit_angles(R, t)
        fx, fy, cx, cy = f["K"]
        src = cap / "frames" / f"{f['name']}.jpg"
        img = cv2.imread(str(src))
        if img is None: continue
        img = cv2.resize(img, (w2, h2), interpolation=cv2.INTER_AREA)
        _write(img, out / "frames" / f"{f['name']}.webp", quality)
        row = dict(name=f["name"], file=f"frames/{f['name']}.webp", R=np.round(R, 6).tolist(), t=np.round(t, 6).tolist(),
                   K=[fx * k, fy * k, cx * k, cy * k], az=round(az, 2), el=round(el, 2), dist=round(dist, 4), K_src=[fx, fy, cx, cy])
        alpha = cap / "masks" / f"{f['name']}_alpha.png"
        if not alpha.exists(): alpha = cap / "masks" / f"{f['name']}_hair.png"
        if alpha.exists():
            a = cv2.resize(cv2.imread(str(alpha), cv2.IMREAD_GRAYSCALE), (w2, h2), interpolation=cv2.INTER_AREA)
            ds = img.copy(); ds[..., 1] = np.minimum(ds[..., 1], np.maximum(ds[..., 0], ds[..., 2]))   # the backdrop's green spill off the edges
            _write(np.dstack([ds, a]), out / "keyed" / f"{f['name']}.webp", quality)
            row["keyed"] = f"keyed/{f['name']}.webp"
            alphas.append(a)
        else:
            alphas.append(None)
        rows.append(row)
    fit = dict(offset=[0, 0, 0], scale=1.0, turn=0.0, height=0.0, flip=False, sweep=1.0, cover=360, mirror=True, per_frame={})
    lm2d = jload(cap / "landmarks.json", {}) or {}
    lm2d = {k: v for k, v in lm2d.items() if v}
    if len(lm2d) >= 3:                                            # the face seen: the fit from it (the wig as it sat on that head)
        mhr_local = (lm - loc["C"]) @ loc["B"] / loc["S"]
        ff = face_fit(rows, lm2d, mhr_local)
        if ff and ff["residual_mm"] < 15: fit.update({k: ff[k] for k in ("offset", "scale", "turn", "height")}); fit["from"] = ff
        elif ff: fit["from"] = dict(ff, used=False)
    box = hull_box(rows, alphas, (w2, h2))                       # the hair's box: where the salon's cube starts
    for r in rows: r.pop("K_src", None)
    azs = np.unwrap(np.radians([r["az"] for r in rows]))
    ref = dict(about="the salon's locked reference: a camera per frame in head-local space (tools/character/gshair/reference.py)",
               kind="video", source=jload(cap / "capture.json", {}).get("source"), size=[w2, h2],
               local=dict(anchors=idx, face_height=FACE_H, axes="X the character's left, U up the face, F forward; origin between the ears; units of MHR's face height"),
               align=al.get("source", "splat"), front_turn=round(math.degrees(turn), 2), sweep=round(float(np.degrees(azs.max() - azs.min())), 1),
               frames=rows, fit=fit, hull_box=box)
    jsave(out / "reference.json", ref)
    return dict(name=name, frames=len(rows), sweep=ref["sweep"], align=ref["align"], fit=fit.get("from", "none"), hull_box=box, path=str(out.relative_to(ROOT)) if out.is_relative_to(ROOT) else str(out))


def photos(files, name, size=900, quality=85, focal35=50.0, dist=1.0, side_face="left"):
    """front, side and back photos as three fixed cameras round the head (the hand fit, per photo, finishes them).
    side_face: where the face points in the side photo (left: the camera is on the character's left)"""
    import cv2
    out = REFS / name
    out.mkdir(parents=True, exist_ok=True)
    rows = []
    # the head-local frame is the unit frame here; the camera is dist face-heights... in face-height units
    D = dist / FACE_H
    az_of = {"front": 0.0, "side": 90.0 if side_face == "left" else -90.0, "back": 180.0}
    for view, f in files.items():
        if not f: continue
        img = cv2.imread(str(f))
        if img is None: raise SystemExit(f"can't read {f}")
        H, W = img.shape[:2]; k = min(1.0, size / max(W, H)); img = cv2.resize(img, (round(W * k), round(H * k)), interpolation=cv2.INTER_AREA)
        h2, w2 = img.shape[:2]
        _write(img, out / "frames" / f"{view}.webp", quality)
        fx = focal35 / 36.0 * max(w2, h2)
        a = math.radians(az_of[view])
        c = np.array([D * math.sin(a), 0.0, D * math.cos(a)])        # the camera, level with the ears
        fwd = -c / np.linalg.norm(c); right = np.cross(fwd, [0, 1.0, 0]); right /= np.linalg.norm(right); down = np.cross(fwd, right)
        R = np.stack([right, down, fwd]); t = -R @ c
        rows.append(dict(name=view, file=f"frames/{view}.webp", R=np.round(R, 6).tolist(), t=np.round(t, 6).tolist(),
                         K=[fx, fx, w2 / 2, h2 / 2], az=round(az_of[view], 2), el=0.0, dist=round(D, 4)))
    ref = dict(about="the salon's locked reference from photos: three fixed cameras (tools/character/gshair/reference.py)",
               kind="photos", source={v: str(f) for v, f in files.items() if f}, size=None,
               local=dict(anchors=DEFAULT_ANCHORS, face_height=FACE_H, axes="X the character's left, U up the face, F forward; origin between the ears; units of MHR's face height"),
               align="photos", sweep=0.0, frames=rows,
               fit=dict(offset=[0, 0, 0], scale=1.0, turn=0.0, height=0.0, flip=False, sweep=1.0, mirror=True, per_frame={}))
    jsave(out / "reference.json", ref)
    return dict(name=name, frames=len(rows), path=str(out.relative_to(ROOT)))


def main(a):
    if a.photos:
        files = dict(zip(("front", "side", "back"), a.photos))
        print(json.dumps(photos(files, a.name, side_face=a.side_face)))
    else:
        print(json.dumps(make(a.out, a.name, a.size, use_align=not a.no_align)))
    print("GSHAIR reference ok")
