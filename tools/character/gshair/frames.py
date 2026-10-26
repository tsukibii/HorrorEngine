"""Step 1: the frames. From a video (or a folder of pictures) pick about 90 sharp frames spread evenly through it,
save them at a working size with the camera's focal guess (tools/gshair.py frames). The paper's capture: the subject
still, uniform light, a phone about a metre away swept slowly round the head, 80 to 100 frames of it."""
import json
from pathlib import Path

import numpy as np

from .common import Capture, jsave

IMAGES = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
VIDEOS = {".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"}


def sharpness(grey):
    import cv2
    return float(cv2.Laplacian(grey, cv2.CV_64F).var())


def pick(source, out, count=90, max_side=1080, focal35=24.0, every=1):
    """writes out/frames/NNN.jpg and out/capture.json; returns the capture"""
    import cv2
    source = Path(source); out = Path(out); (out / "frames").mkdir(parents=True, exist_ok=True)
    for old in (out / "frames").glob("*.jpg"): old.unlink()
    frames, sizes, fps = [], None, 0.0
    if source.is_dir():
        files = sorted(f for f in source.iterdir() if f.suffix.lower() in IMAGES)
        if not files: raise SystemExit(f"no pictures in {source}")
        idx = np.unique(np.linspace(0, len(files) - 1, min(count, len(files))).round().astype(int))
        for k, i in enumerate(idx):
            img = cv2.imread(str(files[i]))
            if img is None: continue
            frames.append((f"{k:03d}", img, files[i].name))
    elif source.suffix.lower() in VIDEOS:
        cap = cv2.VideoCapture(str(source))
        if not cap.isOpened(): raise SystemExit(f"can't open {source}")
        fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
        n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        # pass 1: every frame's sharpness on a small grey copy
        scores, i = [], 0
        while True:
            ok, img = cap.read()
            if not ok: break
            if i % every == 0:
                g = cv2.cvtColor(cv2.resize(img, (320, round(320 * img.shape[0] / img.shape[1]))), cv2.COLOR_BGR2GRAY)
                scores.append((i, sharpness(g)))
            i += 1
        if not scores: raise SystemExit(f"no frames read from {source}")
        # the sharpest frame in each of count windows
        edges = np.linspace(0, len(scores), count + 1).round().astype(int)
        chosen = []
        for a, b in zip(edges[:-1], edges[1:]):
            if b > a: chosen.append(max(scores[a:b], key=lambda s: s[1])[0])
        chosen = sorted(set(chosen))
        cap.release(); cap = cv2.VideoCapture(str(source))
        want = set(chosen); i = 0; k = 0
        while want:
            ok, img = cap.read()
            if not ok: break
            if i in want:
                frames.append((f"{k:03d}", img, f"frame {i}")); want.discard(i); k += 1
            i += 1
        cap.release()
    else:
        img = cv2.imread(str(source))
        if img is None: raise SystemExit(f"not a video, a folder or a picture: {source}")
        frames.append(("000", img, source.name))
    names = []
    for name, img, src in frames:
        h, w = img.shape[:2]
        if sizes is None: sizes = (w, h)
        if max(w, h) > max_side:
            k = max_side / max(w, h); img = cv2.resize(img, (round(w * k), round(h * k)), interpolation=cv2.INTER_AREA)
        cv2.imwrite(str(out / "frames" / f"{name}.jpg"), img, [cv2.IMWRITE_JPEG_QUALITY, 95])
        names.append(name)
    w, h = (frames[0][1].shape[1], frames[0][1].shape[0]) if frames else (0, 0)
    long = max(w, h)
    f_px = long * focal35 / 36.0                      # the long side spans the 36 mm of a 35 mm frame
    meta = dict(source=str(source), frames=names, width=w, height=h, original=list(sizes or (w, h)), fps=fps,
                focal35=focal35, K=[f_px, f_px, w / 2, h / 2], sources=[s for _, _, s in frames])
    jsave(out / "capture.json", meta)
    return Capture(out)


def main(a):
    cap = pick(a.source, a.out, a.count, a.max_side, a.focal35, a.every)
    print(json.dumps(dict(frames=len(cap.names), size=[cap.meta["width"], cap.meta["height"]], focal_px=round(cap.meta["K"][0], 1))))
    print("GSHAIR frames ok")
