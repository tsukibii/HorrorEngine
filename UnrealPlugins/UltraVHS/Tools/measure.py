"""Measure a VHS look: the numbers the presets were tuned to, from a video or still frames.

    uv run --with numpy --with pillow python measure.py CAPTURE.mp4 [--start 9 --seconds 30]
    uv run --with numpy --with pillow python measure.py frame1.png frame2.png ...
    ... --json out.json        also write the numbers

Prints (and compares with the reference, README.md "The reference"):
  frame      the picture's shape inside any pillarbox
  levels     black (luma 0.5th percentile), white (99.5th), the shadows' and highlights' colour
  edges      10-90% rise of the sharpest luma edges in 1080-line pixels, and the halo (overshoot past the edge)
  chroma     how much wider colour edges are than luma edges
  noise      high-pass noise in the flattest patches
  vignette   corner luma over centre luma (only means something over many frames)
  motion     (video) the camera's wander: dominant frequencies and size, from frame-to-frame shifts
A capture from Unreal (Movie Render Queue, or OBS on the window) at 1080p is what to compare.
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image

# this tool on the reference capture, seconds 9 to 39 (README.md "The reference"). Its vignette is scene-biased (the
# corridor's dark end sits in the centre); the motion's size includes the player's own looking around.
REFERENCE = {
    "aspect": 1.34, "black": 0.031, "white": 0.778, "shadows_rgb": [0.102, 0.073, 0.055],
    "highlights_rgb": [0.74, 0.739, 0.717], "edge_rise_px": 5.0, "halo": 0.12, "chroma_vs_luma": 2.4,
    "noise": 0.0002, "vignette": 0.85,
    "motion": {"vertical": {"peaks_hz": [0.5, 0.25, 0.75], "std_pct_height": 5.04},
               "horizontal": {"peaks_hz": [0.5, 0.25, 0.75]}},
}


def frames_from_video(path, start, seconds, fps):
    d = tempfile.mkdtemp(prefix="vhsmeasure_")
    subprocess.run(["ffmpeg", "-v", "error", "-ss", str(start), "-t", str(seconds), "-i", path,
                    "-vf", f"fps={fps},scale=-2:1080", os.path.join(d, "f_%04d.png")], check=True)
    return sorted(os.path.join(d, f) for f in os.listdir(d))


def gray_from_video(path, start, seconds, box):
    x, w, h = box
    out = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(start), "-t", str(seconds), "-i", path,
                          "-vf", f"scale=-2:1080,crop={w}:{h}:{x}:0,scale=480:360", "-pix_fmt", "gray",
                          "-f", "rawvideo", "-"], check=True, capture_output=True).stdout
    probe = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate",
                            "-of", "csv=p=0", path], capture_output=True, text=True).stdout.strip()
    num, den = (probe.split("/") + ["1"])[:2]
    a = np.frombuffer(out, np.uint8)
    n = a.size // (480 * 360)
    return a[:n * 480 * 360].reshape(n, 360, 480).astype(np.float32), float(num) / float(den or 1)


def load(path):
    return np.asarray(Image.open(path).convert("RGB")).astype(np.float64) / 255


def active_box(img):
    """Columns that aren't pillarbox black."""
    col = img.max(axis=(0, 2))
    on = np.where(col > 0.03)[0]
    if len(on) == 0:
        return 0, img.shape[1], img.shape[0]
    return int(on[0]), int(on[-1] - on[0] + 1), img.shape[0]


def luma(c):
    return c @ np.array([0.299, 0.587, 0.114])


def cr(c):
    return (c[..., 0] - luma(c)) * 0.713


def edges(y, chroma=None, half=16, max_edges=400):
    """Step edges along rows: rise (10-90%) and overshoot past the high side."""
    g = np.diff(y, axis=1)
    mag = np.abs(g)
    thresh = np.percentile(mag, 99.7)
    rows, cols = np.where(mag > max(thresh, 0.02))
    order = np.argsort(-mag[rows, cols])
    rises, halos, ratios, used = [], [], [], set()
    for k in order:
        r, c = rows[k], cols[k]
        if c < half + 2 or c > y.shape[1] - half - 3 or (r // 4, c // 8) in used:
            continue
        p = y[r, c - half:c + half + 2]
        lo_side, hi_side = (p[:4].mean(), p[-4:].mean())
        if abs(hi_side - lo_side) < 0.15:
            continue
        if hi_side < lo_side:
            p = p[::-1]
            lo_side, hi_side = hi_side, lo_side
        # flat sides only (a step, not texture)
        if p[:4].std() > 0.03 or p[-4:].std() > 0.03:
            continue
        n = (p - lo_side) / (hi_side - lo_side)
        i10, i90 = np.argmax(n > 0.1), np.argmax(n > 0.9)
        if i90 <= i10:
            continue
        used.add((r // 4, c // 8))
        rises.append(i90 - i10)
        halos.append(max(0.0, n.max() - 1.0))
        if chroma is not None:
            q = chroma[r, c - half:c + half + 2]
            if np.ptp(q) > 0.04:
                qn = (q - q.min()) / np.ptp(q)
                if qn[-1] < qn[0]:
                    qn = qn[::-1]
                j10, j90 = np.argmax(qn > 0.1), np.argmax(qn > 0.9)
                if j90 > j10:
                    ratios.append((j90 - j10) / max(i90 - i10, 1))
        if len(rises) >= max_edges:
            break
    med = lambda v: float(np.median(v)) if v else None
    return med(rises), med(halos), med(ratios), len(rises)


def noise(y):
    hp = y - (np.roll(y, 1, 0) + np.roll(y, -1, 0) + np.roll(y, 1, 1) + np.roll(y, -1, 1)) / 4
    h, w = y.shape
    blocks = [hp[i:i + 32, j:j + 32].std() for i in range(32, h - 64, 32) for j in range(32, w - 64, 32)]
    return float(np.mean(np.sort(blocks)[:10]))


def motion(gray, fps):
    win = np.outer(np.hanning(gray.shape[1]), np.hanning(gray.shape[2]))
    shifts = []
    for a, b in zip(gray[1:], gray[:-1]):
        A = np.fft.fft2((a - a.mean()) * win)
        B = np.fft.fft2((b - b.mean()) * win)
        R = A * np.conj(B)
        R /= np.abs(R) + 1e-6
        r = np.fft.ifft2(R).real
        i = np.unravel_index(np.argmax(r), r.shape)
        shifts.append([v if v < s / 2 else v - s for v, s in zip(i, r.shape)])
    s = np.array(shifts, float)
    # in 4 s windows, each with its slow trend (the player's own looking around) taken out
    n = int(fps * 4)
    out = {}
    for name, v in (("vertical", s[:, 0]), ("horizontal", s[:, 1])):
        stds, spectra = [], []
        for w0 in range(0, len(v) - n + 1, n):
            pos = np.cumsum(v[w0:w0 + n])
            t = np.arange(n)
            pos = pos - np.polyval(np.polyfit(t, pos, 2), t)
            stds.append(pos.std())
            spectra.append(np.abs(np.fft.rfft(pos * np.hanning(n))))
        if not spectra:
            continue
        f = np.fft.rfftfreq(n, 1 / fps)
        F = np.mean(spectra, 0)
        m = (f > 0.2) & (f < 6)
        top = np.argsort(F[m])[-3:][::-1]
        out[name] = {"peaks_hz": [round(float(x), 2) for x in f[m][top]],
                     "std_pct_height": round(float(np.median(stds) / 360 * 100), 2)}
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("inputs", nargs="+")
    ap.add_argument("--start", type=float, default=0)
    ap.add_argument("--seconds", type=float, default=30)
    ap.add_argument("--json")
    a = ap.parse_args()

    video = len(a.inputs) == 1 and os.path.splitext(a.inputs[0])[1].lower() in (".mp4", ".mov", ".mkv", ".webm", ".avi")
    paths = frames_from_video(a.inputs[0], a.start, a.seconds, 2) if video else a.inputs
    imgs = [load(p) for p in paths]
    x, w, h = active_box(imgs[len(imgs) // 2])
    imgs = [im[:, x:x + w] for im in imgs]

    ys = [luma(im) for im in imgs]
    allY = np.concatenate([y.ravel() for y in ys])
    stack = np.concatenate([im.reshape(-1, 3) for im in imgs])
    sl = luma(stack)
    rises, halos, ratios = [], [], []
    for im, y in zip(imgs, ys):
        r, hl, ra, n = edges(y, cr(im))
        if r is not None:
            rises.append(r)
            halos.append(hl)
        if ra is not None:
            ratios.append(ra)
    mean_y = np.mean(ys, axis=0)
    hh, ww = mean_y.shape
    corner = np.mean([mean_y[:hh // 8, :ww // 8].mean(), mean_y[:hh // 8, -ww // 8:].mean(),
                      mean_y[-hh // 8:, :ww // 8].mean(), mean_y[-hh // 8:, -ww // 8:].mean()])
    centre = mean_y[hh * 3 // 8:hh * 5 // 8, ww * 3 // 8:ww * 5 // 8].mean()

    res = {
        "frames": len(imgs),
        "aspect": round(w / h, 3),
        "black": round(float(np.percentile(allY, 0.5)), 3),
        "white": round(float(np.percentile(allY, 99.5)), 3),
        "shadows_rgb": [round(float(v), 3) for v in stack[sl < np.percentile(sl, 5)].mean(0)],
        "highlights_rgb": [round(float(v), 3) for v in stack[sl > np.percentile(sl, 95)].mean(0)],
        "edge_rise_px": round(float(np.median(rises)), 1) if rises else None,
        "halo": round(float(np.median(halos)), 3) if halos else None,
        "chroma_vs_luma": round(float(np.median(ratios)), 2) if ratios else None,
        "noise": round(float(np.mean([noise(y) for y in ys])), 4),
        "vignette": round(float(corner / max(centre, 1e-6)), 2),
    }
    if video:
        gray, fps = gray_from_video(a.inputs[0], a.start, a.seconds, (x, w, h))
        res["motion"] = motion(gray, fps)

    width = max(len(k) for k in res)
    for k, v in res.items():
        ref = REFERENCE.get(k)
        print(f"{k:<{width}}  {v}" + (f"   (reference {ref})" if ref is not None else ""))
    if a.json:
        with open(a.json, "w") as f:
            json.dump(res, f, indent=2)


if __name__ == "__main__":
    sys.exit(main())
