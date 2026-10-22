"""The hair library's outlines and thumbnails, and a front photo matched against them (face_mesh.py's environment:
MediaPipe, numpy, OpenCV). The classic step of the hair papers (Hu et al. 2015: retrieve the closest hairstyles from a
database), with Perm's 343 hairstyles (tools/perm.py) as the database:

    python tools/character/hair_match.py index --library vendor/perm/library --head vendor/perm/head.obj
        each hairstyle's front outline in the head's own frame (silhouettes.npz) and a sprite sheet of thumbnails,
        front and side (sprite.png, index.json), for the Studio's Hair tab
    python tools/character/hair_match.py match --library DIR --photo PICTURE [--model hair_segmenter.tflite] [--top 3]
        MediaPipe's hair segmenter finds the hair in the photo and its Face Landmarker the face; the hair is moved into
        the head's frame by the face (eyes, nose, chin, the cheeks at the ears), and every hairstyle's outline is
        scored against it (overlap over union, where the photo can see). Prints the best ones and blend weights.

The head's frame: x across the face, u up it, both in face heights (forehead landmark 10 to chin 152), from the middle of
the cheeks at the ears. Hairstyles below the photo's edge aren't counted against it.
"""
import argparse
import json
import os
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools")); sys.path.insert(0, str(ROOT / "tools" / "character"))
GRID = 96
XR, UR = (-2.2, 2.2), (-3.2, 1.6)             # the outline's window, in face heights
FIRM = [33, 133, 263, 362, 168, 6, 10, 151, 1, 4, 152, 234, 454]
SEG_URL = "https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float32/latest/hair_segmenter.tflite"


def head_frame(lm):
    """C, X, U, F and the face height from MediaPipe's points on a head"""
    X = lm[454] - lm[234]; X /= np.linalg.norm(X)
    U = lm[10] - lm[152]; U -= X * (U @ X); h = np.linalg.norm(lm[10] - lm[152]); U /= np.linalg.norm(U)
    return (lm[234] + lm[454]) / 2, X, U, np.cross(X, U), h


def head_landmarks(path):
    """MediaPipe's 468 points on a head mesh (any units: centimetre heads are scaled for the binding and back)"""
    import hair_fit
    v, t = hair_fit.read_ply(path) if str(path).endswith(".ply") else hair_fit.read_obj(path)
    k = 0.01 if np.ptp(v[:, 1]) > 3 else 1.0        # a head taller than 3 units is in centimetres
    lm, _ = hair_fit.landmarks(v * k, t)
    return lm / k


def outline(P, fr, size=GRID):
    """a hairstyle's front outline: its strands drawn into the window as thick lines"""
    import cv2
    C, X, U, F, h = fr
    d = P.reshape(-1, 3) - C
    x, u = (d @ X) / h, (d @ U) / h
    px = (x - XR[0]) / (XR[1] - XR[0]) * size; py = (UR[1] - u) / (UR[1] - UR[0]) * size
    pts = np.stack([px, py], 1).reshape(P.shape[0], P.shape[1], 2)
    m = np.zeros((size, size), np.uint8)
    cv2.polylines(m, [np.round(s * 4).astype(np.int32) for s in pts[::2]], False, 1, 2, cv2.LINE_8, 2)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    return m.astype(bool)


def thumb(P, fr, side=False, w=96, h=120):
    """front or side: the strands as lines, nearer ones lighter"""
    import cv2
    C, X, U, F, fh = fr
    d = P.reshape(-1, 3) - C
    a, b, depth = ((d @ F, d @ U, d @ X) if side else (d @ X, d @ U, d @ F))
    a, b, depth = a / fh, b / fh, depth / fh
    px = (a + 2.4) / 4.8 * w; py = (1.7 - b) / 5.0 * h
    pts = np.stack([px, py], 1).reshape(P.shape[0], P.shape[1], 2); dz = depth.reshape(P.shape[0], P.shape[1]).mean(1)
    img = np.full((h, w, 3), 34, np.uint8)
    cv2.ellipse(img, (int(w / 2), int((1.7 - 0.2) / 5.0 * h)), (int(w * 0.17), int(h * 0.2)), 0, 0, 360, (150, 160, 175), -1)
    for i in np.argsort(dz)[::3]:
        g = int(np.clip(90 + 90 * (dz[i] - dz.min()) / (np.ptp(dz) + 1e-6), 60, 200))
        cv2.polylines(img, [np.round(pts[i] * 4).astype(np.int32)], False, (g * 0.55, g * 0.75, g), 1, cv2.LINE_AA, 2)
    return img


def cmd_index(a):
    import cv2
    lib = Path(a.library); names = json.loads((lib / "strands.json").read_text())
    lm = head_landmarks(a.head); fr = head_frame(lm)
    np.save(lib / "head_landmarks.npy", lm)
    sil, cols = [], 16
    sheet = np.zeros(((len(names) + cols - 1) // cols * 120, cols * 192, 3), np.uint8)
    for i, n in enumerate(names):
        P = np.load(lib / f"{n}.npz")["positions"].astype(np.float32)
        sil.append(np.packbits(outline(P, fr)))
        r, c = divmod(i, cols)
        sheet[r * 120:(r + 1) * 120, c * 192:c * 192 + 96] = thumb(P, fr)
        sheet[r * 120:(r + 1) * 120, c * 192 + 96:(c + 1) * 192] = thumb(P, fr, side=True)
    np.savez_compressed(lib / "silhouettes.npz", names=np.array(names), packed=np.array(sil))
    cv2.imwrite(str(lib / "sprite.png"), sheet)
    lengths = []
    for n in names:                                   # a rough length for the labels: how far below the chin it reaches
        P = np.load(lib / f"{n}.npz")["positions"].astype(np.float32)
        lengths.append(round(float(-np.percentile(((P[:, -1] - fr[0]) @ fr[2]) / fr[4], 10)), 2))
    (lib / "index.json").write_text(json.dumps({"names": names, "cols": cols, "cell": [192, 120], "drop": lengths,
                                                "about": "front and side thumbnails per hairstyle; drop: how far the hair falls, face heights below the ears"}),
                                    encoding="utf-8")
    print(json.dumps({"hairstyles": len(names)}))
    print("HAIRMATCH ok")


def photo_hair(img, model):
    """the hair's mask (float 0..1, the photo's size) by MediaPipe's hair segmenter"""
    import face_mesh as F
    F.no_metrics()
    import mediapipe as mp
    from mediapipe.tasks.python import BaseOptions, vision
    opts = vision.ImageSegmenterOptions(base_options=BaseOptions(model_asset_path=str(model)), output_confidence_masks=True)
    with vision.ImageSegmenter.create_from_options(opts) as seg:
        import cv2
        res = seg.segment(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)))
        conf = res.confidence_masks
        return conf[-1].numpy_view().astype(np.float32)   # the last class is the hair


def photo_landmarks(img):
    import face_mesh as F
    home = Path(os.environ.get("FACE_MESH_HOME", ROOT / "vendor" / "face_mesh"))
    import mediapipe as mp
    import cv2
    res = F.landmarker(home).detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)))
    if not res.face_landmarks: return None
    h, w = img.shape[:2]
    return np.array([[p.x * w, p.y * h] for p in res.face_landmarks[0][:468]])


def sim2(src, dst):
    """2D similarity (s, R, t) with dst ~ s R src + t"""
    ms, md = src.mean(0), dst.mean(0); A, B = src - ms, dst - md
    U, S, Vt = np.linalg.svd(B.T @ A / len(src)); d = np.sign(np.linalg.det(U @ Vt)); D = np.diag([1, d])
    R = U @ D @ Vt; s = (S * np.diag(D)).sum() / (A ** 2).sum(1).mean()
    return s, R, md - s * R @ ms


def photo_outline(img, model, head_lm):
    """the photo's hair in the head's window (bool), and where the photo can see (bool)"""
    import cv2
    pl = photo_landmarks(img)
    if pl is None: return None, None, "no face found in the photo"
    mask = photo_hair(img, model)
    if mask.shape != img.shape[:2]: mask = cv2.resize(mask, (img.shape[1], img.shape[0]))
    C, X, U, F, h = head_frame(head_lm)
    hx = ((head_lm[FIRM] - C) @ X) / h; hu = ((head_lm[FIRM] - C) @ U) / h
    s, R, t = sim2(np.stack([hx, hu], 1), np.stack([pl[FIRM, 0], -pl[FIRM, 1]], 1))   # head window -> photo (y up)
    xs = XR[0] + (np.arange(GRID) + 0.5) / GRID * (XR[1] - XR[0]); us = UR[1] - (np.arange(GRID) + 0.5) / GRID * (UR[1] - UR[0])
    gx, gu = np.meshgrid(xs, us)
    q = (s * (R @ np.stack([gx.ravel(), gu.ravel()]))).T + t
    px, py = q[:, 0], -q[:, 1]
    seen = (px >= 0) & (px < img.shape[1] - 1) & (py >= 0) & (py < img.shape[0] - 1)
    vals = np.zeros(len(px), np.float32)
    vals[seen] = mask[py[seen].astype(int), px[seen].astype(int)]
    return (vals > 0.5).reshape(GRID, GRID), seen.reshape(GRID, GRID), None


def cmd_match(a):
    import cv2
    lib = Path(a.library)
    S = np.load(lib / "silhouettes.npz"); names = list(S["names"])
    sil = np.unpackbits(S["packed"], axis=1)[:, :GRID * GRID].reshape(len(names), GRID, GRID).astype(bool)
    head_lm = np.load(lib / "head_landmarks.npy")
    img = cv2.imread(a.photo)
    if img is None: sys.exit(f"can't read {a.photo}")
    model = Path(a.model)
    if not model.exists(): sys.exit(f"no hair segmenter at {model}: python tools/perm.py setup")
    hair, seen, err = photo_outline(img, model, head_lm)
    if err: sys.exit(err)
    inter = (sil & hair & seen).sum((1, 2)); union = ((sil | hair) & seen).sum((1, 2))
    iou = inter / np.maximum(union, 1)
    order = np.argsort(-iou)[:a.top]
    best = iou[order]
    w = np.exp((best - best[0]) / 0.03); w /= w.sum()
    out = {"top": [{"name": names[i], "iou": round(float(iou[i]), 3), "weight": round(float(x), 3)} for i, x in zip(order, w)],
           "photo_hair_cells": int(hair.sum())}
    if a.debug:
        vis = np.zeros((GRID, GRID * 2, 3), np.uint8); vis[..., 1][:, :GRID] = hair * 255; vis[..., 2][:, :GRID] = ~seen * 120
        vis[..., 0][:, GRID:] = sil[order[0]] * 255; vis[..., 1][:, GRID:] = hair * 255
        cv2.imwrite(a.debug, cv2.resize(vis, (GRID * 6, GRID * 3), interpolation=cv2.INTER_NEAREST))
    print(json.dumps(out))
    print("HAIRMATCH ok")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("index"); p.add_argument("--library", required=True); p.add_argument("--head", required=True)
    p = sub.add_parser("match"); p.add_argument("--library", required=True); p.add_argument("--photo", required=True)
    p.add_argument("--model", default=str(ROOT / "vendor" / "perm" / "hair_segmenter.tflite")); p.add_argument("--top", type=int, default=3)
    p.add_argument("--debug", help="a picture of the photo's hair against the best outline")
    a = ap.parse_args()
    {"index": cmd_index, "match": cmd_match}[a.cmd](a)


if __name__ == "__main__":
    main()
