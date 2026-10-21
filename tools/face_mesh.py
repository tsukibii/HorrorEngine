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
                                   [--depth 0.4] [--follow 0.5] [--detail 1] [--smooth 0.01] [--symmetry 0.5] [--units m|cm]
                                                       writes <out>/<name>.obj, <name>.json (what was used and dropped,
                                                       and why, and the settings) and <name>_sheet.png (the pictures used,
                                                       the result from the front and the side); out defaults to Content/Studio/Heads/
    python tools/face_mesh.py check                    the fit on the canonical face posed, scaled, noised, talking, with
                                                       full lips; the head template bent to itself and to a wider jaw (FACEMESH ok)
    python tools/face_mesh.py worker                   the desk's face page (tools/director/face.html) through serve.py

The page: python tools/director/serve.py, then http://127.0.0.1:8780/face.html (./studio: Pages). Drop pictures, see
each with its points and why it was used or dropped, every setting as a slider, the head turning in 3D, Save.

The head: the template is rendered from each side it might face (Y or Z up) and MediaPipe finds its face, so any head
works without marking it up (kept per file in vendor/face_mesh/bindings/). The result keeps the template's
topology, objects, UVs and place: bend your MetaHuman's base head (exported, then saved as OBJ from Blender) and it
comes out already lined up with it, no scaling by hand. MHR's head (Content/Studio/Bodies/MHR_head.obj, metres, Y
up, facing +Z) is the default; --head none gives the face alone (Y up, facing +Z, --units, an average adult's size).

The settings: --depth is how much of MediaPipe's depth the face takes (its learned guess, the weakest part: the profile);
--follow how much the whole head takes the face's proportions (from a face alone, all of it over-reaches: a tall
crown); --detail the fine pass (eyelids, lips, nostrils);
--smooth damps it; --symmetry blends the face toward its mirror image (a photo's asymmetry is mostly its pose).
One frontal, evenly lit, neutral photo is enough; several (or a video, a few seconds turning a little) average out
each picture's error. A side picture (named in `side` by the worker's callers: the body editor's side slot) gives the
depth of the half it sees instead of MediaPipe's guess; it has to be one MediaPipe finds, about 70 degrees at most.
A body works as the template too (body_template: the body editor's MHR, tools/character/): bound on its head alone, bent
with the fit fading out down the neck. A phone's wide lens close up swells the nose: take the photo from further away and crop.
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
MOUTH_OPEN = 0.04          # the inner lips this far apart (of the face's height, brow to chin) is an open mouth


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


def side_depth(mean, sides, amount=1.0):
    """the face's depth taken from side pictures where they see it: each is fitted onto the face, and the half
    turned to the camera (and the middle) takes its depth, which a side view measures across the picture instead of
    guessing it. MediaPipe needs a face it can find: about 70 degrees at most, so a three-quarter view works best."""
    import numpy as np
    out = mean.copy(); acc = np.zeros(len(mean)); depth = np.zeros(len(mean))
    for x in sides:
        s, r, t = similarity(x["aligned"], mean)
        p = (s * (r @ x["aligned"].T)).T + t
        cam = x["camera"]                                  # the camera's direction in the face's frame
        vis = np.clip(0.5 + np.sign(cam[0]) * mean[:, 0] / 2.0, 0, 1) * min(1.0, abs(cam[0]) / 0.5)
        depth += vis * p[:, 2]; acc += vis
    k = np.where(acc > 0, amount * np.minimum(acc, 1), 0)
    out[:, 2] = (1 - k) * mean[:, 2] + k * np.where(acc > 0, depth / np.maximum(acc, 1e-9), mean[:, 2])
    return out


def fit(frames, canon, max_turn=30.0, max_expression=0.4, relative=True, skip=(), side=(), side_amount=1.0):
    """frames: [{"name", "points" (468x3, any pose and scale), "expression" ({blendshape: score})}]. Each is fitted to
    the canonical face; the turned, the open-mouthed and the expressive are dropped (unless nothing else is left), the
    outliers of the rest after a generalised Procrustes too, and the mean is returned at the canonical face's size
    with a report. relative: an expression is read against the person's own most neutral picture, not an average
    face's (full lips read as a pout to MediaPipe in every picture; only a picture more expressive than the rest is
    dropped). skip: the names left out by hand. side: the names of side pictures, used for the depth only
    (side_depth), never dropped for their turn."""
    import numpy as np
    seen = []
    for f in frames:
        s, r, t = similarity(f["points"], canon)
        aligned = (s * (r @ f["points"].T)).T + t
        gap = float(np.linalg.norm(aligned[13] - aligned[14]) / np.linalg.norm(aligned[10] - aligned[152]))
        seen.append(dict(name=f["name"], aligned=aligned, turn=round(turn_of(r), 1), mouth=round(gap, 3),
                         camera=r[:, 2] / np.linalg.norm(r[:, 2]),
                         scores={k: float(v) for k, v in f.get("expression", {}).items() if k in EXPRESSIONS}))
    if not seen: raise ValueError("no face found in any picture")
    sides = [x for x in seen if x["name"] in side and x["name"] not in skip]
    pool = [x for x in seen if x["name"] not in skip and x["name"] not in side]
    if not pool: raise ValueError("every picture is left out")
    base = {k: (min(x["scores"].get(k, 0.0) for x in pool) if relative else 0.0) for k in EXPRESSIONS}
    for x in seen:
        k, v = max(((k, v - base[k]) for k, v in x["scores"].items()), key=lambda kv: kv[1], default=("", 0.0))
        if x["mouth"] > MOUTH_OPEN: k, v = "mouth open", max(v, 1.0)
        x["expression"] = [k, round(float(v), 2)]
    warn = []
    if relative:
        held = sorted(((v, k) for k, v in base.items() if v > max_expression), reverse=True)
        if held:
            v, k = held[0]
            warn.append(f"every picture reads {k} {v:.2f} or more: taken as this face at rest (MediaPipe reads some "
                        f"faces that way, full lips as a pout); if it's an expression in all of them, add a relaxed picture")
    good = [x for x in pool if x["turn"] <= max_turn and x["expression"][1] <= max_expression]
    if not good:                                         # nothing neutral: the frontal ones closest to it
        front = [x for x in pool if x["turn"] <= max_turn] or [min(pool, key=lambda x: x["turn"])]
        least = min(x["expression"][1] for x in front)
        good = [x for x in front if x["expression"][1] <= least + 0.1]
        warn.append(f"no picture was frontal and neutral; used the {len(good)} closest (from "
                    f"{least:.2f} {min(front, key=lambda x: x['expression'][1])['expression'][0]}): the face carries "
                    f"that expression")
    for x in seen:
        if x["name"] in skip: x["dropped"] = "by hand"
        elif x["name"] in side: x["side"] = True
        elif not any(x is g for g in good):
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
    if sides:
        mean = side_depth(mean, sides, side_amount)
    elif side:
        warn.append("no face found in the side picture: MediaPipe needs it turned less than about 70 degrees "
                    "(a three-quarter view works)")
    report = dict(pictures=len(frames), faces=len(seen), used=len(good), sides=len(sides), warnings=warn,
                  each=[{k: (round(v, 3) if isinstance(v, float) else v) for k, v in x.items()
                         if k not in ("aligned", "scores", "camera")} for x in seen])
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


def body_template(points, tris, name="MHR body"):
    """a whole body as a head template: bound on its head's triangles only (the top 30 cm), and bent with the fit
    fading out down the neck, so the shoulders never move"""
    import numpy as np
    points, tris = np.asarray(points, float), np.asarray(tris)
    top = points[:, 1].max()
    head = np.flatnonzero((points[tris][:, :, 1] > top - 0.30).all(1))
    return dict(path=name, lines=None, verts=points, tris=tris, bind_tris=head, region="head")


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
    used = v[np.unique(tris)]                                            # framed on what's drawn (a body's head alone)
    lo, hi = used[:, :2].min(0), used[:, :2].max(0)
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
    sub = tpl.get("bind_tris")
    tris = tpl["tris"] if sub is None else tpl["tris"][sub]
    for rot in orientations():
        img, ids, px = render(tpl["verts"], tris, rot, size)
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
        a, b, c = px[tris[t]]
        if sub is not None: t = int(sub[t])
        m = np.array([[a[0] - c[0], b[0] - c[0]], [a[1] - c[1], b[1] - c[1]]])
        try: l1, l2 = np.linalg.solve(m, [u - c[0], w - c[1]])
        except np.linalg.LinAlgError: l1 = l2 = 1 / 3
        l = np.clip([l1, l2, 1 - l1 - l2], 0, 1); l /= l.sum()
        tri.append(t); bary.append(l.round(5).tolist())
    return dict(rot=rot.tolist(), tri=tri, bary=bary, turn=round(turn, 1))


def binding(home, tpl, canon, landmarker):
    """bind(), kept per template file (vendor/face_mesh/bindings/) so a template is only looked at once"""
    import hashlib
    if tpl.get("lines") is None:                       # made from arrays: the topology and the first shape it came in
        key = "body-" + hashlib.sha1(tpl["tris"].tobytes() + tpl["verts"].round(4).tobytes()).hexdigest()[:16]
    else:
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
    full = tpl["verts"] @ rot.T                               # in the view: x right, y up, z out of the face
    b = bound_points(tpl, bnd) @ rot.T
    face_h = np.linalg.norm(b[10] - b[152])
    near = np.flatnonzero(full[:, 1] > b[152, 1] - 0.6 * face_h) if tpl.get("region") == "head" else slice(None)
    v = full[near]
    s, r, t = similarity(face, b)
    target = (s * (r @ face.T)).T + t
    target[:, 2] = b[:, 2] + depth * (target[:, 2] - b[:, 2])
    X = np.hstack([b, np.ones((len(b), 1))])
    A = np.linalg.lstsq(X, target, rcond=None)[0]
    ident = np.vstack([np.eye(3), np.zeros((1, 3))])
    A = ident + follow * (A - ident)
    out = np.hstack([v, np.ones((len(v), 1))]) @ A
    res = target - X @ A
    for (K, KV), gain in zip(kernels(tpl, bnd, v, b), (1.0, detail)):
        w = np.linalg.solve(K + smooth * np.eye(len(b)), res)
        out += gain * (KV @ w)
        res = res - K @ w
    if tpl.get("region") == "head":                    # a body: all of it under the chin to none by mid-neck
        k = np.clip((v[:, 1] - (b[152, 1] - 0.6 * face_h)) / (0.45 * face_h), 0, 1)
        k = k * k * (3 - 2 * k)
        out = v + k[:, None] * (out - v)
    full = full.copy(); full[near] = out
    return full @ rot


_KERNELS = {}


def kernels(tpl, bnd, v, b):
    """the Gaussians at both sizes between the bound points (K) and from every point to them (KV): they only depend
    on the template and its binding, so they're kept (the page refits on every slider)"""
    import numpy as np
    key = (id(tpl), id(bnd), len(v))
    if key not in _KERNELS:
        width = np.linalg.norm(b[234] - b[454])               # cheek to cheek
        d2 = lambda p, q: np.maximum((p * p).sum(1)[:, None] + (q * q).sum(1)[None, :] - 2 * p @ q.T, 0)
        bb, vb = d2(b, b), d2(v, b)
        _KERNELS.clear()                                      # one template at a time; it's held so its id stays its own
        _KERNELS[key] = (tpl, bnd, [(np.exp(-bb / (2 * sig * sig)), np.exp(-vb / (2 * sig * sig)).astype(np.float32))
                                    for sig in (0.25 * width, 0.07 * width)])
    return _KERNELS[key][2]


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


def head_path(head):
    return None if head in (None, "", "none") else (
        ROOT / "Content" / "Studio" / "Bodies" / "MHR_head.obj" if head == "mhr" else Path(head))


DEFAULTS = dict(head="mhr", max_turn=30.0, max_expression=0.4, relative=True, depth=0.4, follow=0.5, detail=1.0,
                smooth=0.01, symmetry=0.5, side_depth=1.0, units="m")


class Session:
    """what make and the desk's page share: MediaPipe, the canonical face, the head templates and their bindings,
    loaded once"""
    def __init__(self, home):
        self.home = home
        self.canon, self.faces = load_canonical(home / "canonical_face_model.obj")
        self.lm, self.heads = None, {}

    def landmarker(self):
        if self.lm is None: self.lm = landmarker(self.home)
        return self.lm

    def head(self, head):
        """(template, binding) for a head (mhr, an OBJ's path), or None for the face alone"""
        hp = head_path(head)
        if not hp: return None
        if not hp.exists(): raise ValueError(f"no head template at {hp}")
        key = (str(hp), hp.stat().st_mtime)
        if key not in self.heads:
            tpl = load_template(hp)
            self.heads[key] = (tpl, binding(self.home, tpl, self.canon, self.landmarker()))
        return self.heads[key]

    def body(self, points, tris):
        """(template, binding) for a body's points (the body editor's MHR): bound once per topology"""
        import numpy as np
        tpl = body_template(points, tris)
        key = ("body", len(points), tpl["tris"].tobytes()[:4096])
        if key not in self.heads:
            self.heads[key] = binding(self.home, tpl, self.canon, self.landmarker())
        bnd = self.heads[key]
        return tpl, bnd

    def shape(self, frames, st, skip=(), side=(), template=None):
        """the averaged face and, with a head (or a body: template), the head bent to it: (points, triangles, the
        view's rotation, report, the template or None)"""
        import numpy as np
        st = {**DEFAULTS, **st}
        face, report = fit(frames, self.canon, st["max_turn"], st["max_expression"], st["relative"], set(skip),
                           set(side), st["side_depth"])
        face = symmetric(face, self.canon, st["symmetry"])
        report["settings"] = st
        head = template or self.head(st["head"])
        if not head: return face, self.faces, np.eye(3), report, None
        tpl, bnd = head
        return bend(tpl, bnd, face, st["depth"], st["follow"], st["detail"], st["smooth"]), tpl["tris"], \
            np.array(bnd["rot"]), report, tpl

    def save(self, out, name, frames, thumbs, st, skip=(), source=""):
        import numpy as np
        st = {**DEFAULTS, **st}
        verts, tris, rot, report, tpl = self.shape(frames, st, skip)
        out.mkdir(parents=True, exist_ok=True)
        if tpl:
            write_template(out / f"{name}.obj", tpl, verts, f"# face_mesh.py: {Path(tpl['path']).name} bent to {source}")
            report.update(head=Path(tpl["path"]).name, units="the template's",
                          size=[round(float(x), 4) for x in np.ptp(verts, 0)])
        else:
            write_obj(out / f"{name}.obj", verts, tris, st["units"], source)
            report.update(head=None, units=st["units"], size_cm=[round(float(x), 1) for x in np.ptp(verts, 0)])
        (out / f"{name}.json").write_text(json.dumps(report, indent=1), encoding="utf-8")
        sheet(out / f"{name}_sheet.png", thumbs, report, verts, tris, rot)
        return out / f"{name}.obj", report


def cmd_make(a):
    ses = Session(home_dir(a))
    frames, thumbs, n = detect(ses.landmarker(), a.inputs, a.frames)
    st = dict(head=a.head, max_turn=a.max_turn, max_expression=a.max_expression, relative=not a.absolute,
              depth=a.depth, follow=a.follow, detail=a.detail, smooth=a.smooth, symmetry=a.symmetry, units=a.units)
    name = a.name or Path(a.inputs[0]).stem
    out = Path(a.out) if a.out else ROOT / "Content" / "Studio" / "Heads"
    try:
        path, report = ses.save(out, name, frames, thumbs, st, source=", ".join(Path(i).name for i in a.inputs))
    except ValueError as e:
        sys.exit(str(e))
    for w in report["warnings"]: print("WARNING:", w)
    drops = {}
    for x in report["each"]:
        if "dropped" in x: drops[x["dropped"]] = drops.get(x["dropped"], 0) + 1
    print(f"{n} pictures, {report['faces']} faces, {report['used']} used"
          + (" (dropped: " + ", ".join(f"{v} {k}" for k, v in drops.items()) + ")" if drops else "")
          + (f"; bent {report['head']}" if report["head"] else "; the face only"))
    print(f"wrote {path} (+ .json, _sheet.png)")
    print("FACEMESH ok")


def thumb(img, pts, size=200):
    """a picture cropped to its face with the points on it, as a JPEG in base64 (the page's list)"""
    import base64
    import cv2
    import numpy as np
    img = img.copy(); h = img.shape[0]
    for x, y, _ in pts: cv2.circle(img, (int(x), int(-y)), max(1, h // 300), (60, 220, 90), -1)
    cx, cy = pts[:, 0].mean(), -pts[:, 1].mean()
    r = 0.7 * max(np.ptp(pts[:, 0]), np.ptp(pts[:, 1]))
    crop = img[max(0, int(cy - r)):int(cy + r), max(0, int(cx - r)):int(cx + r)]
    ok, jpg = cv2.imencode(".jpg", cv2.resize(crop, (size, size)), [cv2.IMWRITE_JPEG_QUALITY, 82])
    return base64.b64encode(jpg.tobytes()).decode("ascii")


def cmd_worker(a):
    """the desk's face page (tools/director/face.html) through serve.py: one JSON request a line on stdin, one answer
    a line on stdout, prefixed @@ (anything else on stdout is MediaPipe talking). Ops:
      detect {name, files, frames}        the pictures' points; a thumbnail of each with them on it
      template {head}                     the head's points and triangles and the rotation that faces it to the view
      fit {name, settings, skip}          the head bent with those settings, its points flat, the report
      save {name, settings, skip, out}    <out>/<name>.obj, .json, _sheet.png
      mhr {}                              the body editor's sliders: groups, labels, the bases, MHR's measures
      body {name, weights, settings, skip, side}   MHR's body (tools/character/mhr.py) with those identity weights and the
                                          face bent onto its head: the points that moved and by how much
    (detect, fit, body: a picture named in side is used for the face's depth only)"""
    ses, pics = Session(home_dir(a)), {}

    def flat(v, nd=5):
        return [round(float(x), nd) for x in v.reshape(-1)]

    def handle(q):
        import numpy as np
        op = q.get("op")
        if op == "detect":
            frames, thumbs, n = detect(ses.landmarker(), q["files"], int(q.get("frames", 40)))
            pics[q["name"]] = (frames, thumbs)
            found = {f["name"] for f in frames}
            return dict(pictures=[dict(name=k, thumb=thumb(*thumbs[k])) for k in thumbs],
                        missed=[Path(f).name for f in q["files"] if Path(f).name not in found
                                and not any(k.startswith(Path(f).name + "#") for k in found)], seen=n)
        if op == "template":
            head = ses.head(q.get("head"))
            if not head: return dict(verts=flat(ses.canon), tris=ses.faces.reshape(-1).tolist(), rot=flat(np.eye(3)))
            tpl, bnd = head
            return dict(verts=flat(tpl["verts"]), tris=tpl["tris"].reshape(-1).tolist(), rot=flat(np.array(bnd["rot"])))
        if op == "mhr":                                    # the body editor's sliders: groups, labels, the bases
            sys.path.insert(0, str(ROOT / "tools" / "character"))
            import mhr
            m = mhr.load()
            presets = json.loads(mhr.PRESETS_FILE.read_text(encoding="utf-8"))["presets"] if mhr.PRESETS_FILE.exists() else {}
            return dict(groups=m["header"]["groups"], labels=mhr.labels(m), presets=presets,
                        measures=mhr.measures(m["points"], m))
        if op == "body":
            sys.path.insert(0, str(ROOT / "tools" / "character"))
            import mhr
            m = mhr.load()
            pts = mhr.body(q.get("weights", []), m)
            frames, thumbs = pics.get(q.get("name"), ([], {}))
            if not frames: return dict(idx=[], delta=[], report=None)
            tpl, bnd = ses.body(m["points"], m["tris"])
            shaped = dict(tpl, verts=pts)
            verts, tris, rot, report, _ = ses.shape(frames, q.get("settings", {}), q.get("skip", []), q.get("side", []),
                                                    template=(shaped, bnd))
            d = verts - pts
            idx = np.flatnonzero(np.abs(d).max(1) > 1e-6)
            return dict(idx=idx.tolist(), delta=flat(d[idx], 6), report=report)
        if op in ("fit", "save"):
            if q["name"] not in pics: raise ValueError("detect the pictures first")
            frames, thumbs = pics[q["name"]]
            if op == "fit":
                verts, tris, rot, report, tpl = ses.shape(frames, q.get("settings", {}), q.get("skip", []),
                                                          q.get("side", []))
                return dict(verts=flat(verts), report=report)
            path, report = ses.save(Path(q["out"]), q["name"], frames, thumbs, q.get("settings", {}), q.get("skip", []),
                                    source=", ".join(sorted({k.split("#")[0] for k in thumbs})))
            return dict(path=str(path), report=report)
        raise ValueError(f"no op {op!r}")

    for line in sys.stdin:
        try:
            res = handle(json.loads(line))
        except (Exception, SystemExit) as e:  # noqa: BLE001 - the page shows why; the worker keeps going
            res = {"error": str(e) if isinstance(e, (ValueError, SystemExit)) else f"{type(e).__name__}: {e}"}
        sys.stdout.write("@@" + json.dumps(res) + "\n")
        sys.stdout.flush()


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
    face[14] = face[13]                                                                 # lips closed (the canonical's part)

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
    bad = face.copy(); bad[:, 0] *= np.where(bad[:, 1] > 0, 1.3, 1.0)                   # a wrong detection
    frames.append(pic("bad", bad, 0))
    gaping = face.copy(); gaping[14, 1] -= 1.2                                          # lips 1.2 cm apart, no score
    frames.append(pic("gaping", gaping, 0))
    verts, report = fit(frames, canon, skip={"p7"})
    fails = []
    dropped = {x["name"]: x.get("dropped") for x in report["each"]}
    for name, why in (("turned", "turned"), ("talking", "expression"), ("bad", "outlier"), ("gaping", "expression"),
                      ("p7", "by hand")):
        if dropped.get(name) != why: fails.append(f"{name} should be dropped as {why}, got {dropped.get(name)}")
    lips = [pic(f"l{i}", face, rng.uniform(-10, 10), {"mouthPucker": 0.85 + 0.05 * rng.random()}) for i in range(4)]
    lips.append(pic("pout", face, 0, {"mouthPucker": 0.9, "jawOpen": 0.75}))
    _, rep2 = fit(lips, canon)
    d2 = {x["name"]: x.get("dropped") for x in rep2["each"]}
    if d2.get("pout") != "expression" or any(d2.get(f"l{i}") for i in range(4)):
        fails.append(f"full lips in every picture: only the real expression should go, got {d2}")
    if not any("at rest" in w for w in rep2["warnings"]): fails.append("full lips everywhere should be noted")
    flat = face.copy(); flat[:, 2] = face[:, 2].mean() + 0.6 * (face[:, 2] - face[:, 2].mean())   # front depth guessed short
    fronts = [pic(f"f{i}", flat, rng.uniform(-8, 8)) for i in range(3)]
    s0, r0, t0 = similarity(face, canon); truth = (s0 * (r0 @ face.T)).T + t0
    depth_err = lambda m: float(np.abs(m[:, 2] - truth[:, 2])[truth[:, 0] < -1].mean())    # the half a +55 deg turn shows
    plain, _ = fit(fronts, canon)
    seen, rep4 = fit(fronts + [pic("side", face, 55)], canon, side={"side"})
    if rep4["sides"] != 1 or depth_err(seen) > 0.5 * depth_err(plain):
        fails.append(f"a side picture should fix the depth it sees: {depth_err(plain):.2f} -> {depth_err(seen):.2f} cm")
    print(f"side picture: depth off {depth_err(plain):.2f} cm from the fronts alone, {depth_err(seen):.2f} cm with it")
    _, rep3 = fit(lips, canon, relative=False)
    if rep3["used"] > 1 and not rep3["warnings"]: fails.append("against an average face, full lips should read as a pout")
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
        sys.path.insert(0, str(ROOT / "tools" / "character"))
        import mhr
        if mhr.BIN.exists():                              # the body: its head bends, nothing under the neck moves
            m = mhr.load()
            lm = landmarker(home)
            btpl = body_template(m["points"], m["tris"])
            bb = binding(home, btpl, canon, lm); lm.close()
            pts = bound_points(btpl, bb)
            s, r, t = similarity(pts, canon)
            own = (s * (r @ pts.T)).T + t
            wide = own.copy(); wide[:, 0] *= np.where(own[:, 1] < -4, 1.15, 1.0)
            bent = bend(btpl, bb, wide)
            below = m["points"][:, 1] < pts[152, 1] - 0.12
            low = float(np.abs(bent[below] - m["points"][below]).max())
            head_moved = float(np.abs(bent - m["points"]).max())
            if low > 1e-9: fails.append(f"the body moved {low * 1000:.2f} mm below the neck")
            if head_moved < 0.003: fails.append("the body's head didn't take a wider jaw")
            print(f"body: bound facing {bb['turn']} deg off, the head moved up to {head_moved * 100:.1f} cm, "
                  f"under the neck {low * 1000:.3f} mm")
    else:
        print("head: skipped (no MediaPipe or no MHR_head.obj)")
    for x in fails: print("FAIL", x)
    if fails: sys.exit(1)
    print("FACEMESH ok")


class Worker:
    """the worker from a plain-Python server (the desk's serve.py, the body editor's): started on first use in
    MediaPipe's environment and kept, one request at a time; FACE_MESH_HOME picks another environment"""
    def __init__(self, log):
        import threading
        self.proc, self.lock, self.log = None, threading.Lock(), Path(log)

    def call(self, req):
        """(http status, answer)"""
        with self.lock:
            p = self.proc
            if p is None or p.poll() is not None:
                home = Path(os.environ.get("FACE_MESH_HOME", ROOT / "vendor" / "face_mesh"))
                py = py_of(home)
                if not py.exists():
                    return 400, {"error": "MediaPipe isn't set up: python tools/face_mesh.py setup"}
                self.log.parent.mkdir(parents=True, exist_ok=True)
                p = self.proc = subprocess.Popen([str(py), str(Path(__file__).resolve()), "--home", str(home), "worker"],
                                                 stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=open(self.log, "ab"),
                                                 text=True, encoding="utf-8", bufsize=1, cwd=str(ROOT))
            p.stdin.write(json.dumps(req) + "\n")
            p.stdin.flush()
            for line in p.stdout:
                if line.startswith("@@"):
                    res = json.loads(line[2:])
                    return (400 if "error" in res else 200), res
            self.proc = None
            return 500, {"error": f"the face worker stopped ({self.log} says why)"}


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
    m.add_argument("--depth", type=float, default=0.4, help="how much of MediaPipe's depth the head takes (0 to 1)")
    m.add_argument("--follow", type=float, default=0.5, help="how much the whole head takes the face's proportions")
    m.add_argument("--detail", type=float, default=1.0, help="the fine pass: eyelids, lips, nostrils (0 to 1.5)")
    m.add_argument("--smooth", type=float, default=0.01, help="damping: more is softer, with fewer bumps")
    m.add_argument("--symmetry", type=float, default=0.5, help="blend toward the face's mirror image (0 to 1)")
    m.add_argument("--absolute", action="store_true", help="read expressions against an average face, not this one's "
                   "most neutral picture (full lips then read as a pout)")
    sub.add_parser("check")
    sub.add_parser("worker", help="the desk's face page through serve.py (JSON lines)")
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
    {"make": cmd_make, "check": cmd_check, "worker": cmd_worker}[a.cmd](a)


if __name__ == "__main__":
    main()
