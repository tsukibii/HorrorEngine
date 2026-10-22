"""Shared by the GaussianHair steps (tools/gshair.py): the head and its 468 landmarks (MediaPipe's, pinned on the head
through tools/face_mesh.py's binding), the head's frame and its scalp, the head as a radial field (inside / push out),
the capture's files, cameras in and out, images at the working size. numpy and OpenCV only (torch stays in raster,
field and refine)."""
import json
import os
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "tools")); sys.path.insert(0, str(ROOT / "tools" / "character"))
HOME = Path(os.environ.get("GSHAIR_HOME", ROOT / "vendor" / "gshair"))
MHR_FACE_HEIGHT = None      # filled when the MHR base is loaded: the face's height (landmark 10 to 152) at MHR's size
FIRM = [33, 133, 263, 362, 168, 6, 10, 151, 9, 234, 454, 127, 356, 1, 4, 152, 197, 195, 5, 8, 107, 336, 61, 291, 13, 14]


def no_metrics():
    """MediaPipe's native library posts usage stats on every run and has no switch: point every proxy at a dead port
    (tools/face_mesh.py does the same); the pipeline itself is run under unshare -rn so nothing could leave anyway"""
    dead = "http://127.0.0.1:9"
    for k in ("https_proxy", "HTTPS_PROXY", "http_proxy", "HTTP_PROXY", "all_proxy", "ALL_PROXY"):
        os.environ[k] = dead
    for k in ("no_proxy", "NO_PROXY"):
        os.environ[k] = ""
    os.environ.setdefault("DO_NOT_TRACK", "1")
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")


def jload(path, default=None):
    p = Path(path)
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else default


def jsave(path, data):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(data, indent=1), encoding="utf-8")


# ---- the head ---------------------------------------------------------------------------------------------------
def read_obj(path):
    v, tris = [], []
    for line in Path(path).read_text(encoding="utf-8", errors="replace").splitlines():
        p = line.split()
        if not p: continue
        if p[0] == "v": v.append([float(x) for x in p[1:4]])
        elif p[0] == "f":
            ids = [int(x.split("/")[0]) for x in p[1:]]; ids = [i - 1 if i > 0 else len(v) + i for i in ids]
            tris += [[ids[0], ids[k], ids[k + 1]] for k in range(1, len(ids) - 1)]
    return np.array(v, float), np.array(tris, np.int64)


def load_head(spec="mhr", body=None):
    """the head (or whole body) the hair grows from: points (n,3) metres, Y up, facing +Z; tris; a name for the binding.
    spec: 'mhr' (MHR's base body), a .obj head, or a character's name (its body.f32 saved by the Studio beside the
    hair, else its character.json's weights); body: a .f32 or .npy of points over MHR's topology"""
    import mhr
    m = mhr.load()
    if body:
        pts = np.fromfile(body, np.float32).reshape(-1, 3).astype(float) if str(body).endswith(".f32") else np.load(body).reshape(-1, 3).astype(float)
        if len(pts) != len(m["points"]): raise ValueError(f"{body}: {len(pts)} points, MHR has {len(m['points'])}")
        return pts, m["tris"], "MHR body"
    if spec.endswith(".obj"):
        v, t = read_obj(spec)
        if np.ptp(v[:, 1]) > 3: v = v * 0.01                        # centimetres
        return v, t, Path(spec).stem
    if spec != "mhr":
        d = ROOT / "Content" / "Studio" / "People" / spec
        f = d / "gshair" / "body.f32"
        if f.exists(): return load_head("mhr", f)
        c = jload(d / "character.json", {})
        w = c.get("weights") or c.get("shape") or []
        pts = mhr.body(w, m) if isinstance(w, (list, dict)) else m["points"].copy()
        h = float(c.get("height", 0) or 0)
        if h > 0:                                                   # the Studio scales the body to its height, feet on the floor
            lo = pts[:, 1].min(); S = h / (pts[:, 1].max() - lo); pts = (pts - [0, lo, 0]) * S
        return pts, m["tris"], "MHR body"
    return m["points"].copy(), m["tris"], "MHR body"


def landmarks_on(points, tris, name, home=HOME):
    """MediaPipe's 468 points on this head (metres), through face_mesh.py's cached binding: the head is rendered, its
    face found, each point pinned to the triangle under it"""
    no_metrics()
    import face_mesh as F
    canon, _ = F.load_canonical(home / "canonical_face_model.obj")
    tpl = F.body_template(points, tris, name)
    bnd = F.binding(home, tpl, canon, F.landmarker(home))
    return np.asarray(F.bound_points(tpl, bnd), float)


def head_frame(lm):
    """C the skull's middle (between the ears, moved to the skull's centre later), X to the character's left, U up the
    face, F forward, h the face's height (landmark 10 to 152)"""
    X = lm[454] - lm[234]; X /= np.linalg.norm(X)
    U = lm[10] - lm[152]; U -= X * (U @ X); h = float(np.linalg.norm(lm[10] - lm[152])); U /= np.linalg.norm(U)
    return dict(C=(lm[234] + lm[454]) / 2, X=X, U=U, F=np.cross(X, U), h=h)


def mhr_scale(h):
    """the head's size against MHR's (hair.js's sizes are MHR's at 1.7 m)"""
    global MHR_FACE_HEIGHT
    if MHR_FACE_HEIGHT is None:
        MHR_FACE_HEIGHT = 0.1653                                   # MHR's base face, landmark 10 to 152 (measured once)
    return h / MHR_FACE_HEIGHT


class HeadField:
    """the head as a radial field round the skull's middle (hair.js's): the outermost skin per direction. inside(p),
    push(p, gap). C is moved from between the ears to the skull's centre (front to back)"""
    def __init__(self, points, fr, S):
        self.X, self.U, self.F = fr["X"], fr["U"], fr["F"]
        C = fr["C"].copy()
        d = points - C; r = np.linalg.norm(d, axis=1)
        keep = (r < 0.16 * S) & (d @ self.U > 0.02 * S)
        f = d[keep] @ self.F
        C = C + self.F * (f.min() + f.max()) / 2
        self.C, self.S = C, S
        self.AZ, self.EL = 64, 32
        d = points - C; r = np.linalg.norm(d, axis=1)
        el = np.arcsin(np.clip(d @ self.U / (r + 1e-12), -1, 1)); az = np.arctan2(d @ self.X, d @ self.F)
        keep = (r < 0.18 * S) & (el > -0.4)
        self.R = np.zeros((self.EL, self.AZ))
        a, e = self.bins(az[keep], el[keep])
        np.maximum.at(self.R, (e, a), r[keep])
        for _ in range(4):
            nb = np.max([np.roll(self.R, 1, 1), np.roll(self.R, -1, 1), np.roll(self.R, 1, 0), np.roll(self.R, -1, 0)], 0)
            self.R = np.where(self.R > 0, self.R, nb)
        self.top = C + self.U * self.R.max()

    def bins(self, az, el):
        return (np.minimum(self.AZ - 1, ((az + np.pi) / (2 * np.pi) * self.AZ).astype(int)),
                np.minimum(self.EL - 1, ((el + np.pi / 2) / np.pi * self.EL).astype(int)))

    def radius(self, p):
        d = p - self.C; r = np.linalg.norm(d, axis=-1)
        el = np.arcsin(np.clip(d @ self.U / (r + 1e-12), -1, 1)); az = np.arctan2(d @ self.X, d @ self.F)
        a, e = self.bins(az, el)
        return r, self.R[e, a], el

    def inside(self, p, gap=0.0):
        r, R, el = self.radius(np.atleast_2d(p))
        return (el > -0.4) & (R > 0) & (r < R + gap)

    def push(self, p, gap):
        p = np.atleast_2d(p).copy()
        r, R, el = self.radius(p)
        m = (el > -0.4) & (R > 0) & (r < R + gap)
        d = p[m] - self.C
        p[m] = self.C + d / (r[m, None] + 1e-12) * (R[m] + gap)[:, None]
        return p, m

    def normal(self, p):
        """the outward direction at p"""
        d = np.atleast_2d(p) - self.C
        return d / (np.linalg.norm(d, axis=1, keepdims=True) + 1e-12)


def scalp(points, tris, lm, fr, S, hairline=0.0):
    """the scalp's triangles: the head above a hairline that runs from the forehead (landmark 10) over the ears to the
    nape (hair.js's rule)"""
    C, U, X, F = fr["C"], fr["U"], fr["X"], fr["F"]
    h = lambda p: (p - C) @ U
    front = h(lm[10]) + hairline * S; side = h((lm[105] + lm[334]) / 2) + 0.012 * S; back = -0.08 * S
    smooth = lambda t: np.where(t <= 0, 0, np.where(t >= 1, 1, t * t * (3 - 2 * t)))
    d = points - C
    az = np.abs(np.arctan2(d @ X, d @ F))
    line = np.where(az < np.pi / 2, front + (side - front) * smooth(az / (np.pi / 2) * 1.15),
                    side + (back - side) * smooth((az - np.pi / 2) / (np.pi / 2) * 2.4))
    ok = (np.linalg.norm(d, axis=1) < 0.16 * S) & (d @ U > line)
    return np.flatnonzero(ok[tris].all(1))


def sample_triangles(points, tris, ids, n, rng):
    """n points spread over the triangles ids by area, with their normals"""
    P = points[tris[ids]]
    fn = np.cross(P[:, 1] - P[:, 0], P[:, 2] - P[:, 0]); area = np.linalg.norm(fn, axis=1) / 2
    fn /= np.linalg.norm(fn, axis=1, keepdims=True) + 1e-12
    pick = rng.choice(len(ids), n, p=area / area.sum())
    u, v = rng.random(n), rng.random(n); flip = u + v > 1; u[flip] = 1 - u[flip]; v[flip] = 1 - v[flip]
    T = P[pick]
    return T[:, 0] + (T[:, 1] - T[:, 0]) * u[:, None] + (T[:, 2] - T[:, 0]) * v[:, None], fn[pick]


def vertex_normals(points, tris):
    n = np.zeros_like(points)
    fn = np.cross(points[tris[:, 1]] - points[tris[:, 0]], points[tris[:, 2]] - points[tris[:, 0]])
    for k in range(3): np.add.at(n, tris[:, k], fn)
    return n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-12)


# ---- the capture ------------------------------------------------------------------------------------------------
class Capture:
    """a capture folder: frames/NNN.jpg, capture.json, masks/, orient/, landmarks.json, cameras.json"""
    def __init__(self, out):
        self.dir = Path(out)
        self.meta = jload(self.dir / "capture.json", {})

    @property
    def names(self): return self.meta.get("frames", [])

    def frame(self, name): return self.dir / "frames" / f"{name}.jpg"
    def hair_mask(self, name): return self.dir / "masks" / f"{name}_hair.png"
    def alpha(self, name): return self.dir / "masks" / f"{name}_alpha.png"
    def orient(self, name): return self.dir / "orient" / f"{name}.npz"

    def cameras(self):
        c = jload(self.dir / "cameras.json")
        if not c: return None
        for f in c["frames"]:
            f["R"] = np.array(f["R"], float); f["t"] = np.array(f["t"], float)
        return c

    def save_cameras(self, frames, report):
        out = [dict(f, R=np.asarray(f["R"]).round(7).tolist(), t=np.asarray(f["t"]).round(6).tolist()) for f in frames]
        jsave(self.dir / "cameras.json", dict(frames=out, report=report, width=self.meta["width"], height=self.meta["height"]))


def imread(path, max_side=None, grey=False):
    import cv2
    img = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE if grey else cv2.IMREAD_COLOR)
    if img is None: raise FileNotFoundError(path)
    if max_side and max(img.shape[:2]) > max_side:
        k = max_side / max(img.shape[:2])
        img = cv2.resize(img, (round(img.shape[1] * k), round(img.shape[0] * k)), interpolation=cv2.INTER_AREA)
    return img


def scale_K(K, w0, w1):
    """the intrinsics (fx, fy, cx, cy) for an image resized from width w0 to w1"""
    k = w1 / w0
    return [K[0] * k, K[1] * k, K[2] * k, K[3] * k]


def project_np(P, R, t, K):
    """world points (n,3) -> pixels (n,2) and depths"""
    c = P @ R.T + t
    z = c[:, 2]
    return np.stack([K[0] * c[:, 0] / z + K[2], K[1] * c[:, 1] / z + K[3]], 1), z
