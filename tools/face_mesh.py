"""A head shaped from photos or a video, as a mesh for Blender (docs/METAHUMAN_LOOKS.md §1.3): MediaPipe's Face
Landmarker (Apache-2.0, no account) finds the 468 points of its face mesh in each picture, each set is taken out of
its head pose by a similarity fit to MediaPipe's canonical face, the posed, blinking or talking ones are dropped,
and the rest are averaged into one neutral face. Then a whole head template (MHR's by default, or your MetaHuman's
base head as an OBJ) is bent so its face lands on those points: a skull, ears and a neck round the face, and the
template's own eyelids and lips shaped by the photo's. No texture: the shape is the point (what Mesh to MetaHuman
traces and auto-matches).

    python tools/face_mesh.py setup [--home DIR]       MediaPipe in its own uv environment (Python 3.12), the Face
                                                       Landmarker model and the canonical face, under DIR (default vendor/face_mesh)
    python tools/face_mesh.py make <photo|video|folder>... [--name N] [--out DIR] [--frames 40]
                                   [--max-turn 30] [--max-expression 0.4] [--head mhr|none|<head.obj>]
                                   [--depth 0.6] [--follow 1] [--detail 1] [--smooth 0.01] [--symmetry 0.5] [--units m|cm]
                                                       writes <out>/<name>.obj, <name>.json (what was used and dropped,
                                                       and why, and the settings) and <name>_sheet.png (the pictures used,
                                                       the result from the front and the side); out defaults to Content/Studio/Heads/
    python tools/face_mesh.py check                    the fit on the canonical face posed, scaled, noised, talking; the
                                                       head template bent to itself and to a wider jaw (FACEMESH ok)

The head: the template is rendered from each side it might face (Y or Z up) and MediaPipe finds its face, so any head
works without marking it up (kept per file in vendor/face_mesh/bindings/). The result keeps the template's
topology, objects, UVs and place: bend your MetaHuman's base head (exported, then saved as OBJ from Blender) and it
comes out already lined up with it, no scaling by hand. MHR's head (Content/Studio/Bodies/MHR_head.obj, metres, Y
up, facing +Z) is the default; --head none gives the face alone (Y up, facing +Z, --units, an average adult's size).

The settings: --depth is how much of MediaPipe's depth the face takes (its learned guess, the weakest part: the profile);
--follow how much the whole head takes the face's proportions; --detail the fine pass (eyelids, lips, nostrils);
--smooth damps it; --symmetry blends the face toward its mirror image (a photo's asymmetry is mostly its pose).
One frontal, evenly lit, neutral photo is enough; several (or a video, a few seconds turning a little) average out
each picture's error. A phone's wide lens close up swells the nose: take the photo from further away and crop.
"""
import argparse
import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task"
CANON_URL = "https://raw.githubusercontent.com/google-ai-edge/mediapipe/master/mediapipe/modules/face_geometry/data/canonical_face_model.obj"
IMAGES = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
VIDEOS = {".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"}
# the blendshapes that bend the face away from neutral (a smile, an open jaw, a blink): a picture scoring over
# --max-expression on any of them is dropped (or, with nothing better, used with a warning)
EXPRESSIONS = ["jawOpen", "mouthSmileLeft", "mouthSmileRight", "mouthFrownLeft", "mouthFrownRight", "mouthPucker",
               "mouthFunnel", "mouthStretchLeft", "mouthStretchRight", "cheekPuff", "eyeBlinkLeft", "eyeBlinkRight",
               "eyeSquintLeft", "eyeSquintRight", "eyeWideLeft", "eyeWideRight", "browInnerUp", "browDownLeft",
               "browDownRight"]


def home_dir(a):
    return Path(a.home) if getattr(a, "home", None) else ROOT / "vendor" / "face_mesh"


def py_of(home):
    return home / "venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def cmd_setup(a):
    home = home_dir(a); home.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ, UV_CACHE_DIR=str(home / "uvcache"), UV_PYTHON_INSTALL_DIR=str(home / "uvpy"))
    subprocess.run(["uv", "python", "install", "3.12"], env=env, check=False)
    if not py_of(home).exists():
        subprocess.run(["uv", "venv", "-p", "3.12", str(home / "venv")], env=env, check=True)
    subprocess.run(["uv", "pip", "install", "-p", str(py_of(home)), "mediapipe", "numpy", "opencv-python-headless"],
                   env=env, check=True)
    for url, name in ((MODEL_URL, "face_landmarker.task"), (CANON_URL, "canonical_face_model.obj")):
        if not (home / name).exists():
            print(f"fetching {name}")
            urllib.request.urlretrieve(url, home / name)
    print(f"MediaPipe and the Face Landmarker at {home} (Apache-2.0)")
    print("FACEMESH ok")


# --- the fit (numpy only) ---

def load_canonical(path):
    """the canonical face's 468 points (cm, Y up, facing +Z) and its 898 triangles (0-based, wound outward)"""
    import numpy as np
    v, f = [], []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        p = line.split()
        if p and p[0] == "v": v.append([float(x) for x in p[1:4]])
        elif p and p[0] == "f": f.append([int(x.split("/")[0]) - 1 for x in p[1:4]])
    return np.array(v), np.array(f)


def to_points(lms, w, h):
    """MediaPipe's normalised landmarks (x right, y down, z toward the camera negative, in x's scale) as 3D points in
    pixels with Y up and Z toward the camera, the canonical face's frame"""
    import numpy as np
    p = np.array([[lm.x, lm.y, lm.z] for lm in lms[:468]], dtype=float)
    return np.stack([p[:, 0] * w, -p[:, 1] * h, -p[:, 2] * w], axis=1)


def similarity(src, dst):
    """Umeyama: scale s, rotation R, shift t with s R src + t closest to dst"""
    import numpy as np
    ms, md = src.mean(0), dst.mean(0)
    a, b = src - ms, dst - md
    u, d, vt = np.linalg.svd(b.T @ a / len(src))
    e = np.eye(3); e[2, 2] = np.sign(np.linalg.det(u @ vt))
    r = u @ e @ vt
    s = (d * np.diag(e)).sum() / (a ** 2).sum(1).mean()
    return s, r, md - s * r @ ms


def turn_of(r):
    """how far a head is turned from facing the camera (degrees): the angle between its forward axis and +Z"""
    import numpy as np
    return float(np.degrees(np.arccos(np.clip(r.T[2, 2], -1, 1))))


def fit(frames, canon, max_turn=30.0, max_expression=0.4):
    """frames: [{"name", "points" (468x3, any pose and scale), "expression" ({blendshape: score})}]. Each is fitted to
    the canonical face; the turned and the expressive are dropped (unless nothing else is left), the outliers of the
    rest after a generalised Procrustes too, and the mean is returned at the canonical face's size with a report."""
    import numpy as np
    seen = []
    for f in frames:
        s, r, t = similarity(f["points"], canon)
        expr = max(((k, v) for k, v in f.get("expression", {}).items() if k in EXPRESSIONS), key=lambda kv: kv[1],
                   default=("", 0.0))
        seen.append(dict(name=f["name"], aligned=(s * (r @ f["points"].T)).T + t, turn=round(turn_of(r), 1),
                         expression=[expr[0], round(float(expr[1]), 2)]))
    if not seen: raise ValueError("no face found in any picture")
    good = [x for x in seen if x["turn"] <= max_turn and x["expression"][1] <= max_expression]
    warn = []
    if not good:                                         # nothing neutral: the frontal ones closest to it
        pool = [x for x in seen if x["turn"] <= max_turn] or [min(seen, key=lambda x: x["turn"])]
        least = min(x["expression"][1] for x in pool)
        good = [x for x in pool if x["expression"][1] <= least + 0.1]
        warn.append(f"no picture was frontal and neutral; used the {len(good)} closest (from "
                    f"{least:.2f} {min(pool, key=lambda x: x['expression'][1])['expression'][0]}): the face carries "
                    f"that expression")
    for x in seen:
        if not any(x is g for g in good):
            x["dropped"] = ("turned" if x["turn"] > max_turn else "expression")
    mean = np.mean([x["aligned"] for x in good], axis=0)
    for _ in range(3):                                   # generalised Procrustes: align to the mean, re-average
        for x in good:
            s, r, t = similarity(x["aligned"], mean)
            x["aligned"] = (s * (r @ x["aligned"].T)).T + t
        mean = np.mean([x["aligned"] for x in good], axis=0)
        s, r, t = similarity(mean, canon)                # keep the mean in the canonical face's place and size
        mean = (s * (r @ mean.T)).T + t
    for x in good:
        x["spread"] = float(np.sqrt(((x["aligned"] - mean) ** 2).sum(1).mean()))
    if len(good) >= 5:                                   # the odd one out (a bad detection, a hand over the mouth)
        d = np.array([x["spread"] for x in good])
        med, mad = np.median(d), np.median(np.abs(d - np.median(d))) or 1e-9
        keep = [x for x in good if x["spread"] <= med + 3 * 1.4826 * mad]
        for x in good:
            if not any(x is k for k in keep): x["dropped"] = "outlier"
        good = keep
        mean = np.mean([x["aligned"] for x in good], axis=0)
        s, r, t = similarity(mean, canon)
        mean = (s * (r @ mean.T)).T + t
    report = dict(pictures=len(frames), faces=len(seen), used=len(good), warnings=warn,
                  each=[{k: (round(v, 3) if isinstance(v, float) else v) for k, v in x.items() if k != "aligned"}
                        for x in seen])
    return mean, report


def write_obj(path, verts_cm, faces, units, source):
    k = 0.01 if units == "m" else 1.0
    lines = [f"# face_mesh.py from {source}", f"# units: {units}; Y up, facing +Z; MediaPipe's face mesh topology (468 points)",
             "o face"]
    lines += [f"v {x * k:.6f} {y * k:.6f} {z * k:.6f}" for x, y, z in verts_cm]
    lines += [f"f {a + 1} {b + 1} {c + 1}" for a, b, c in faces]
    Path(path).write_text("\n".join(lines) + "\n", encoding="utf-8")


def read_obj(path):
    v, f = [], []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        p = line.split()
        if p and p[0] == "v": v.append([float(x) for x in p[1:4]])
        elif p and p[0] == "f": f.append([int(x.split("/")[0]) - 1 for x in p[1:4]])
    return v, f


def symmetric(face, canon, amount):
    """the face blended toward its own mirror image (0 as it is, 1 fully symmetric), in the canonical frame"""
    import numpy as np
    if amount <= 0: return face
    mirror = canon * [-1, 1, 1]
    perm = np.argmin(((canon[:, None, :] - mirror[None, :, :]) ** 2).sum(2), axis=0)   # i's mirror is perm[i]
    return (1 - amount) * face + amount * 0.5 * (face + (face * [-1, 1, 1])[perm])


# --- the head: a whole head template bent to the face (numpy, OpenCV) ---

def load_template(path):
    """an OBJ head: its lines (written back with the new points), its points and its faces as triangles"""
    import numpy as np
    lines = Path(path).read_text(encoding="utf-8", errors="replace").splitlines()
    v, tris = [], []
    for line in lines:
        p = line.split()
        if not p: continue
        if p[0] == "v": v.append([float(x) for x in p[1:4]])
        elif p[0] == "f":
            ids = [int(x.split("/")[0]) for x in p[1:]]
            ids = [i - 1 if i > 0 else len(v) + i for i in ids]
            tris += [[ids[0], ids[k], ids[k + 1]] for k in range(1, len(ids) - 1)]
    if not v or not tris: sys.exit(f"{path} has no mesh")
    return dict(path=str(path), lines=lines, verts=np.array(v), tris=np.array(tris))


def write_template(path, tpl, verts, note):
    """the template's OBJ with its points moved: its objects, groups and UVs kept, its normals dropped (they're the
    old shape's; Blender works them out again) and its material file left behind"""
    out, i = [note], 0
    for line in tpl["lines"]:
        p = line.split()
        if p and p[0] == "v":
            out.append("v %.6f %.6f %.6f" % tuple(verts[i])); i += 1
        elif p and p[0] in ("vn", "mtllib"):
            continue
        elif p and p[0] == "f":
            out.append("f " + " ".join("/".join(t.split("/")[:2]).rstrip("/") for t in p[1:]))
        else:
            out.append(line)
    Path(path).write_text("\n".join(out) + "\n", encoding="utf-8")


def orientations():
    """the ways a head file can stand (Y or Z up) and face, as rotations into the view (x right, y up, z to the camera)"""
    import numpy as np
    e = np.eye(3); out = []
    for up in (e[1], e[2]):
        for fwd in (e[2], -e[2], e[0], -e[0], e[1], -e[1]):
            if abs(fwd @ up) < 0.5:
                out.append(np.stack([np.cross(up, fwd), up, fwd]))
    return out


def render(verts, tris, rot, size=512):
    """the mesh shaded from the front of rot (orthographic, far triangles first), which triangle each pixel shows, and
    each point's pixel"""
    import cv2
    import numpy as np
    v = verts @ rot.T
    lo, hi = v[:, :2].min(0), v[:, :2].max(0)
    k, c = size * 0.9 / (hi - lo).max(), (lo + hi) / 2
    px = np.stack([(v[:, 0] - c[0]) * k + size / 2, size / 2 - (v[:, 1] - c[1]) * k], 1)
    n = np.cross(v[tris[:, 1]] - v[tris[:, 0]], v[tris[:, 2]] - v[tris[:, 0]])
    n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
    light = np.array([0.3, 0.4, 1.0]) / np.linalg.norm([0.3, 0.4, 1.0])
    shade = (255 * (0.25 + 0.75 * np.abs(n @ light))).astype(int)      # either winding
    pts = (px[tris] * 16).round().astype(np.int32)                       # 4 bits of subpixel
    img = np.full((size, size), 205, np.uint8)
    ids = np.full((size, size), -1, np.int32)
    for t in np.argsort(v[tris, 2].mean(1)):
        cv2.fillConvexPoly(img, pts[t], int(shade[t]), cv2.LINE_8, 4)
        cv2.fillConvexPoly(ids, pts[t], int(t), cv2.LINE_8, 4)
    return img, ids, px


def bind(tpl, canon, landmarker):
    """where MediaPipe's 468 points sit on the template: it's rendered standing and facing each way, the most frontal
    face found wins, and each point is pinned to the triangle under it (triangle, barycentric weights)"""
    import cv2
    import mediapipe as mp
    import numpy as np
    best, size = None, 512
    for rot in orientations():
        img, ids, px = render(tpl["verts"], tpl["tris"], rot, size)
        res = landmarker.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)))
        if not res.face_landmarks: continue
        lms = res.face_landmarks[0]
        turn = turn_of(similarity(to_points(lms, size, size), canon)[1])
        if best is None or turn < best[0]: best = (turn, rot, lms, ids, px)
    if best is None: raise ValueError(f"no face found on {tpl['path']} from any side: is it a head, with a face?")
    turn, rot, lms, ids, px = best
    hit = np.argwhere(ids >= 0)
    tri, bary = [], []
    for lm in lms[:468]:
        u, w = lm.x * size, lm.y * size
        y, x = int(round(w)), int(round(u))
        if not (0 <= y < size and 0 <= x < size) or ids[y, x] < 0:     # off the mesh by a pixel or two: the nearest
            y, x = hit[np.argmin(((hit - [w, u]) ** 2).sum(1))]
        t = int(ids[y, x])
        a, b, c = px[tpl["tris"][t]]
        m = np.array([[a[0] - c[0], b[0] - c[0]], [a[1] - c[1], b[1] - c[1]]])
        try: l1, l2 = np.linalg.solve(m, [u - c[0], w - c[1]])
        except np.linalg.LinAlgError: l1 = l2 = 1 / 3
        l = np.clip([l1, l2, 1 - l1 - l2], 0, 1); l /= l.sum()
        tri.append(t); bary.append(l.round(5).tolist())
    return dict(rot=rot.tolist(), tri=tri, bary=bary, turn=round(turn, 1))


def binding(home, tpl, canon, landmarker):
    """bind(), kept per template file (vendor/face_mesh/bindings/) so a template is only looked at once"""
    import hashlib
    key = hashlib.sha1(Path(tpl["path"]).read_bytes()).hexdigest()[:16]
    f = home / "bindings" / f"{key}.json"
    if f.exists(): return json.loads(f.read_text(encoding="utf-8"))
    b = bind(tpl, canon, landmarker)
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(json.dumps(b), encoding="utf-8")
    return b


def bound_points(tpl, bnd):
    import numpy as np
    return (tpl["verts"][tpl["tris"][bnd["tri"]]] * np.array(bnd["bary"])[..., None]).sum(1)


def bend(tpl, bnd, face, depth=1.0, follow=1.0, detail=1.0, smooth=0.01):
    """the template bent so its 468 points land on the face's: the face is fitted onto them (rotation, size, place),
    its depth scaled by `depth` (MediaPipe's depth is its weakest part); the whole head follows the face's proportions
    by an affine fit, as much as `follow`; what's left is spread by Gaussians at two sizes (a quarter of the face's
    width: cheeks, jaw, brow; 7%: eyelids, lips, nostrils, scaled by `detail`), fading out before the back of the head.
    `smooth` damps the fit (more: softer, fewer bumps from noisy points)."""
    import numpy as np
    rot = np.array(bnd["rot"])
    v = tpl["verts"] @ rot.T                                  # in the view: x right, y up, z out of the face
    b = bound_points(tpl, bnd) @ rot.T
    s, r, t = similarity(face, b)
    target = (s * (r @ face.T)).T + t
    target[:, 2] = b[:, 2] + depth * (target[:, 2] - b[:, 2])
    X = np.hstack([b, np.ones((len(b), 1))])
    A = np.linalg.lstsq(X, target, rcond=None)[0]
    ident = np.vstack([np.eye(3), np.zeros((1, 3))])
    A = ident + follow * (A - ident)
    out = np.hstack([v, np.ones((len(v), 1))]) @ A
    res = target - X @ A
    width = np.linalg.norm(b[234] - b[454])                   # cheek to cheek
    d2 = lambda p, q: (p * p).sum(1)[:, None] + (q * q).sum(1)[None, :] - 2 * p @ q.T
    bb = d2(b, b); vb = d2(v, b)
    for sig, gain in ((0.25 * width, 1.0), (0.07 * width, detail)):
        K = np.exp(-bb / (2 * sig * sig))
        w = np.linalg.solve(K + smooth * np.eye(len(b)), res)
        out += gain * (np.exp(-np.maximum(vb, 0) / (2 * sig * sig)) @ w)
        res = res - K @ w
    return out @ rot


# --- the pictures (MediaPipe, OpenCV) ---

def pictures(inputs, n_frames):
    """(name, BGR image) for every photo and for n_frames spread over every video; folders give what's inside"""
    import cv2
    files = []
    for i in inputs:
        p = Path(i)
        if p.is_dir(): files += sorted(q for q in p.iterdir() if q.suffix.lower() in IMAGES | VIDEOS)
        elif p.exists(): files.append(p)
        else: sys.exit(f"no such file {p}")
    for p in files:
        if p.suffix.lower() in IMAGES:
            img = cv2.imread(str(p))
            if img is None: print(f"can't read {p}"); continue
            yield p.name, img
        elif p.suffix.lower() in VIDEOS:
            cap = cv2.VideoCapture(str(p))
            total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
            want = {round(i * (total - 1) / max(n_frames - 1, 1)) for i in range(n_frames)} if total else None
            i = 0
            while True:
                ok, img = cap.read()
                if not ok: break
                if want is None or i in want: yield f"{p.name}#{i}", img
                i += 1
            cap.release()


def no_metrics():
    """MediaPipe's native library posts usage stats to play.googleapis.com/log on every run (about 2 KB, no pictures)
    and has no switch for it. It goes out through the environment's proxy, so a proxy that isn't there stops it;
    nothing in make needs the network. Set before MediaPipe loads."""
    dead = "http://127.0.0.1:9"                          # the discard port: nothing listens there
    for k in ("https_proxy", "HTTPS_PROXY", "http_proxy", "HTTP_PROXY", "all_proxy", "ALL_PROXY"):
        os.environ[k] = dead
    for k in ("no_proxy", "NO_PROXY"):
        os.environ[k] = ""


def landmarker(home):
    no_metrics()
    from mediapipe.tasks.python import BaseOptions, vision
    model = home / "face_landmarker.task"
    if not model.exists(): sys.exit(f"no Face Landmarker model at {model}: python tools/face_mesh.py setup")
    opts = vision.FaceLandmarkerOptions(base_options=BaseOptions(model_asset_path=str(model)), num_faces=1,
                                        output_face_blendshapes=True)
    return vision.FaceLandmarker.create_from_options(opts)


def detect(lm, inputs, n_frames):
    import cv2
    import mediapipe as mp
    frames, thumbs, n = [], {}, 0
    for name, img in pictures(inputs, n_frames):
        n += 1
        h, w = img.shape[:2]
        res = lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)))
        if not res.face_landmarks:
            print(f"no face in {name}"); continue
        pts = to_points(res.face_landmarks[0], w, h)
        expr = {c.category_name: c.score for c in res.face_blendshapes[0]} if res.face_blendshapes else {}
        frames.append(dict(name=name, points=pts, expression=expr))
        thumbs[name] = (img, pts)
    return frames, thumbs, n


SIDE = [[0, 0, -1], [0, 1, 0], [1, 0, 0]]                  # a quarter turn about the view's up: the profile


def sheet(path, thumbs, report, verts, tris, rot):
    """the pictures used with their points, then the result shaded from the front and the side"""
    import cv2
    import numpy as np
    used = [x["name"] for x in report["each"] if "dropped" not in x][:8]
    tiles = []
    for name in used:
        img, pts = thumbs[name]
        img = img.copy(); h = img.shape[0]
        for x, y, _ in pts: cv2.circle(img, (int(x), int(-y)), max(1, h // 400), (0, 255, 0), -1)
        cx, cy = pts[:, 0].mean(), -pts[:, 1].mean()
        r = 0.65 * max(np.ptp(pts[:, 0]), np.ptp(pts[:, 1]))
        crop = img[max(0, int(cy - r)):int(cy + r), max(0, int(cx - r)):int(cx + r)]
        tiles.append(cv2.resize(crop, (240, 240)))
    for view in (rot, np.array(SIDE) @ rot):
        img = render(verts, tris, view, 480)[0]
        tiles.append(cv2.cvtColor(cv2.resize(img, (240, 240), interpolation=cv2.INTER_AREA), cv2.COLOR_GRAY2BGR))
    cv2.imwrite(str(path), np.concatenate(tiles, axis=1))


def head_path(a):
    return None if a.head == "none" else (ROOT / "Content" / "Studio" / "Bodies" / "MHR_head.obj" if a.head == "mhr"
                                          else Path(a.head))


def cmd_make(a):
    import numpy as np
    home = home_dir(a)
    canon, faces = load_canonical(home / "canonical_face_model.obj")
    lm = landmarker(home)
    frames, thumbs, n = detect(lm, a.inputs, a.frames)
    try:
        face, report = fit(frames, canon, a.max_turn, a.max_expression)
    except ValueError as e:
        sys.exit(str(e))
    face = symmetric(face, canon, a.symmetry)
    name = a.name or Path(a.inputs[0]).stem
    out = Path(a.out) if a.out else ROOT / "Content" / "Studio" / "Heads"
    out.mkdir(parents=True, exist_ok=True)
    source = ", ".join(Path(i).name for i in a.inputs)
    hp = head_path(a)
    if hp:
        tpl = load_template(hp)
        try:
            bnd = binding(home, tpl, canon, lm)
        except ValueError as e:
            sys.exit(str(e))
        verts = bend(tpl, bnd, face, a.depth, a.follow, a.detail, a.smooth)
        write_template(out / f"{name}.obj", tpl, verts, f"# face_mesh.py: {hp.name} bent to {source}")
        tris, rot = tpl["tris"], np.array(bnd["rot"])
        report.update(head=hp.name, units="the template's", size=[round(float(x), 4) for x in np.ptp(verts, 0)])
    else:
        write_obj(out / f"{name}.obj", face, faces, a.units, source)
        verts, tris, rot = face, faces, np.eye(3)
        report.update(head=None, units=a.units, size_cm=[round(float(x), 1) for x in np.ptp(face, 0)])
    report.update(depth=a.depth, follow=a.follow, detail=a.detail, smooth=a.smooth, symmetry=a.symmetry)
    lm.close()
    (out / f"{name}.json").write_text(json.dumps(report, indent=1), encoding="utf-8")
    sheet(out / f"{name}_sheet.png", thumbs, report, verts, tris, rot)
    for w in report["warnings"]: print("WARNING:", w)
    drops = {}
    for x in report["each"]:
        if "dropped" in x: drops[x["dropped"]] = drops.get(x["dropped"], 0) + 1
    print(f"{n} pictures, {report['faces']} faces, {report['used']} used"
          + (" (dropped: " + ", ".join(f"{v} {k}" for k, v in drops.items()) + ")" if drops else "")
          + (f"; bent {hp.name}" if hp else "; the face only"))
    print(f"wrote {out / name}.obj (+ .json, _sheet.png)")
    print("FACEMESH ok")


def cmd_check(a):
    """the fit on made-up pictures: the canonical face with a face of its own (a longer nose, wider jaw), posed,
    scaled and noised; a turned one, a talking one and a bad detection that must be dropped; the OBJ read back"""
    import numpy as np
    home = home_dir(a)
    path = home / "canonical_face_model.obj"
    if not path.exists(): sys.exit(f"no canonical face at {path}: python tools/face_mesh.py setup")
    canon, faces = load_canonical(path)
    rng = np.random.default_rng(7)
    face = canon.copy()
    face[:, 2] += 0.6 * np.exp(-((face[:, 0] ** 2 + (face[:, 1] + 0.5) ** 2) / 4))      # a nose 6 mm longer
    face[:, 0] *= np.where(face[:, 1] < -4, 1.08, 1.0)                                  # a wider jaw

    def rot(yaw, pitch, roll):
        y, p, r = np.radians([yaw, pitch, roll])
        ry = np.array([[np.cos(y), 0, np.sin(y)], [0, 1, 0], [-np.sin(y), 0, np.cos(y)]])
        rx = np.array([[1, 0, 0], [0, np.cos(p), -np.sin(p)], [0, np.sin(p), np.cos(p)]])
        rz = np.array([[np.cos(r), -np.sin(r), 0], [np.sin(r), np.cos(r), 0], [0, 0, 1]])
        return rz @ rx @ ry

    def pic(name, shape, yaw, expr=None):
        r = rot(yaw, rng.uniform(-8, 8), rng.uniform(-5, 5))
        pts = (rng.uniform(15, 40) * (r @ shape.T)).T + rng.uniform(-300, 300, 3)
        return dict(name=name, points=pts + rng.normal(0, 0.15, pts.shape) * 20, expression=expr or {"jawOpen": 0.05})

    frames = [pic(f"p{i}", face, rng.uniform(-20, 20)) for i in range(8)]
    frames.append(pic("turned", face, 55))
    frames.append(pic("talking", face, 0, {"jawOpen": 0.8}))
    bad = face.copy(); bad[:, 1] *= 1.4
    frames.append(pic("bad", bad, 0))
    verts, report = fit(frames, canon)
    fails = []
    dropped = {x["name"]: x.get("dropped") for x in report["each"]}
    for name, why in (("turned", "turned"), ("talking", "expression"), ("bad", "outlier")):
        if dropped.get(name) != why: fails.append(f"{name} should be dropped as {why}, got {dropped.get(name)}")
    s, r, t = similarity(face, canon)
    truth = (s * (r @ face.T)).T + t
    err = float(np.sqrt(((verts - truth) ** 2).sum(1).mean()))
    nose = verts[4, 2] - canon[4, 2]
    if err > 0.15: fails.append(f"recovered face off the truth by {err:.2f} cm rms")
    if nose < 0.3: fails.append(f"the longer nose didn't come through ({nose:.2f} cm)")
    single, rep1 = fit([pic("one", face, 0, {"mouthSmileLeft": 0.9})], canon)
    if not rep1["warnings"] or rep1["used"] != 1: fails.append("one smiling photo should be used with a warning")
    out = home / "check.obj"
    write_obj(out, verts, faces, "m", "check")
    v, f = read_obj(out)
    if len(v) != 468 or len(f) != len(faces): fails.append(f"OBJ read back {len(v)} points, {len(f)} triangles")
    if abs(np.ptp(np.array(v), 0).max() - np.ptp(verts, 0).max() / 100) > 1e-4: fails.append("OBJ not in metres")
    n = np.cross(verts[faces[:, 1]] - verts[faces[:, 0]], verts[faces[:, 2]] - verts[faces[:, 0]])
    if (n[verts[faces].mean(1)[:, 2] > 3][:, 2] > 0).mean() < 0.9: fails.append("the face's triangles don't face out")
    print(f"recovered {err:.3f} cm rms from {report['used']} of {report['pictures']} pictures; nose +{nose:.2f} cm")
    sym = symmetric(face, canon, 1.0)
    if np.abs(sym - symmetric(sym, canon, 1.0)).max() > 1e-9: fails.append("symmetry isn't symmetric")
    head = ROOT / "Content" / "Studio" / "Bodies" / "MHR_head.obj"
    try:
        import mediapipe  # noqa: F401
        lm = landmarker(home)
    except ImportError:
        lm = None
    if lm and head.exists():                             # the head template: bound, bent to itself, bent to a jaw
        tpl = load_template(head)
        bnd = binding(home, tpl, canon, lm); lm.close()
        b = bound_points(tpl, bnd)
        s, r, t = similarity(b, canon)
        own = (s * (r @ b.T)).T + t
        size = np.ptp(tpl["verts"], 0).max()
        same = bend(tpl, bnd, own)
        moved = float(np.sqrt(((same - tpl["verts"]) ** 2).sum(1).mean()) / size)
        if moved > 0.002: fails.append(f"the head bent to its own points moved {moved:.2%} of its size")
        wide = own.copy(); wide[:, 0] *= np.where(own[:, 1] < -4, 1.15, 1.0)
        jaw = bend(tpl, bnd, wide, follow=0.0)
        v = tpl["verts"] @ np.array(bnd["rot"]).T
        back = np.argmin(v[:, 2])                         # the back of the head
        if np.linalg.norm(jaw[back] - tpl["verts"][back]) / size > 0.002: fails.append("the back of the head moved")
        chin = np.array(bnd["tri"])[[172, 397]]           # the jaw's corners
        grew = np.ptp(jaw[tpl["tris"][chin][:, 0]] @ np.array(bnd["rot"]).T[:, 0]) / \
            np.ptp(v[tpl["tris"][chin][:, 0]][:, 0])
        if grew < 1.05: fails.append(f"a 15% wider jaw only widened the head's jaw by {grew - 1:.0%}")
        print(f"head: bound facing {bnd['turn']} deg off, bent to itself {moved:.3%}, jaw +{grew - 1:.0%}")
    else:
        print("head: skipped (no MediaPipe or no MHR_head.obj)")
    for x in fails: print("FAIL", x)
    if fails: sys.exit(1)
    print("FACEMESH ok")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--home", help="where MediaPipe lives (default vendor/face_mesh)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("setup")
    m = sub.add_parser("make")
    m.add_argument("inputs", nargs="+", help="photos, videos or folders of them, all of one face")
    m.add_argument("--name", help="the mesh's name (default the first input's)")
    m.add_argument("--out", help="the folder (default Content/Studio/Heads/)")
    m.add_argument("--frames", type=int, default=40, help="frames taken from each video, spread over it")
    m.add_argument("--units", choices=["m", "cm"], default="m", help="m for Blender, cm for Unreal")
    m.add_argument("--max-turn", type=float, default=30.0, help="degrees from frontal a picture may be turned")
    m.add_argument("--max-expression", type=float, default=0.4, help="the highest smile, blink or open jaw kept")
    m.add_argument("--head", default="mhr", help="the head to bend to the face: mhr (MHR's, the default), none (the "
                   "face only) or an OBJ of your own (your MetaHuman's base head: the result keeps its topology and place)")
    m.add_argument("--depth", type=float, default=0.6, help="how much of MediaPipe's depth the head takes (0 to 1)")
    m.add_argument("--follow", type=float, default=1.0, help="how much the whole head takes the face's proportions")
    m.add_argument("--detail", type=float, default=1.0, help="the fine pass: eyelids, lips, nostrils (0 to 1.5)")
    m.add_argument("--smooth", type=float, default=0.01, help="damping: more is softer, with fewer bumps")
    m.add_argument("--symmetry", type=float, default=0.5, help="blend toward the face's mirror image (0 to 1)")
    sub.add_parser("check")
    a = ap.parse_args()
    if a.cmd == "setup":
        return cmd_setup(a)
    try:                                                 # the rest runs in MediaPipe's environment
        import numpy  # noqa: F401
        import mediapipe  # noqa: F401
    except ImportError:
        py = py_of(home_dir(a))
        if not py.exists(): sys.exit(f"no MediaPipe environment at {py.parent.parent}: python tools/face_mesh.py setup")
        sys.exit(subprocess.run([str(py), *sys.argv]).returncode)
    {"make": cmd_make, "check": cmd_check}[a.cmd](a)


if __name__ == "__main__":
    main()
