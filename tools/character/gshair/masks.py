"""Step 2: the hair cut out of each frame, and what else the frame shows. Three ways to key:
  green    a wig on a matte green head against a green backdrop: a chroma key (OpenCV), the largest piece kept (the
           patterns on the floor that the camera tracks by are dropped), a soft edge, the green spill taken out
  hair     a person: MediaPipe's hair segmenter (Apache-2.0, no account, usage stats blocked, run sealed) and its
           multiclass selfie segmenter for the person's alpha
  keyed:DIR frames already keyed by something better (CorridorKey): NNN.png with alpha, named like frames/, used
           as the training pictures too (frames_keyed/)
Always: MediaPipe's 468 face points where a face is seen (a person's capture: they anchor the poses to the head),
and a Gabor filter bank's 2D hair orientation per pixel with a confidence (the orientation loss, OpenCV, classic).

Orientation: theta is the hair's direction in image coordinates (x right, y down), modulo pi; conf in [0, 1]."""
import json
import shutil
from pathlib import Path

import numpy as np

from .common import Capture, HOME, imread, jsave, no_metrics

ANGLES = 32


def gabor_bank(ksize=15, sigma=2.2, lambd=6.0, gamma=0.5):
    """quadrature pairs at ANGLES angles. OpenCV's theta is the normal of the kernel's stripes, so a kernel at theta
    answers to hair running along theta + 90 degrees"""
    import cv2
    bank = []
    for i in range(ANGLES):
        th = np.pi * i / ANGLES
        e = cv2.getGaborKernel((ksize, ksize), sigma, th, lambd, gamma, 0, ktype=cv2.CV_32F)
        o = cv2.getGaborKernel((ksize, ksize), sigma, th, lambd, gamma, np.pi / 2, ktype=cv2.CV_32F)
        e -= e.mean(); o -= o.mean()
        bank.append((e / np.abs(e).sum(), o / np.abs(o).sum(), th + np.pi / 2))
    return bank


def orientation(grey, bank=None):
    """grey (H,W) uint8 -> theta (H,W) float32 radians (the hair's direction, mod pi), conf (H,W) float32"""
    import cv2
    bank = bank or gabor_bank()
    g = grey.astype(np.float32) / 255.0
    g = g - cv2.GaussianBlur(g, (0, 0), 8)                            # local contrast, not the lighting
    resp = np.empty((len(bank),) + g.shape, np.float32)
    for i, (e, o, _) in enumerate(bank):
        resp[i] = np.hypot(cv2.filter2D(g, cv2.CV_32F, e), cv2.filter2D(g, cv2.CV_32F, o))
    best = resp.argmax(0)
    mx = resp.max(0); mean = resp.mean(0)
    conf = np.clip((mx - mean) / (mx + 1e-6), 0, 1).astype(np.float32)
    thetas = np.array([b[2] for b in bank], np.float32)
    i0 = (best - 1) % len(bank); i1 = (best + 1) % len(bank)
    y0 = np.take_along_axis(resp, i0[None], 0)[0]; y1 = mx; y2 = np.take_along_axis(resp, i1[None], 0)[0]
    denom = (y0 - 2 * y1 + y2)
    shift = np.where(np.abs(denom) > 1e-9, 0.5 * (y0 - y2) / np.where(np.abs(denom) > 1e-9, denom, 1), 0)
    theta = (thetas[best] + np.clip(shift, -1, 1) * (np.pi / len(bank))) % np.pi
    return theta.astype(np.float32), conf


def green_key(bgr, hue=(35, 80), sat=0.12, val=0.4, keep_largest=True, feather=2.0):
    """a chroma key: hair = not green. Green is a hue in the range, saturated above sat and brighter than val: a pale
    green mannequin keys away (low saturation, bright) while dark hair with green spill on it stays (dark). Returns
    the soft mask (H,W) float32 and the picture with the green spill taken out of the kept pixels (G no higher than
    the larger of R and B)"""
    import cv2
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    h, s, v = hsv[..., 0], hsv[..., 1] / 255.0, hsv[..., 2] / 255.0
    green = (h >= hue[0]) & (h <= hue[1]) & (s > sat) & (v > val)
    m = (~green).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    if keep_largest:                                   # the piece that is big, central and high: the wig, not the floor's patterns
        n, lab, stats, cent = cv2.connectedComponentsWithStats(m, 8)
        if n > 1:
            H, W = m.shape
            score = stats[1:, cv2.CC_STAT_AREA] * np.exp(-((cent[1:, 0] - W / 2) / (0.3 * W)) ** 2) * (1 - cent[1:, 1] / H)
            m = (lab == 1 + np.argmax(score)).astype(np.uint8)
    soft = cv2.GaussianBlur(m.astype(np.float32), (0, 0), feather) if feather > 0 else m.astype(np.float32)
    out = bgr.copy()
    b, g, r = out[..., 0].astype(np.int32), out[..., 1].astype(np.int32), out[..., 2].astype(np.int32)
    lim = np.maximum(b, r)
    g2 = np.where(g > lim, lim, g)
    out[..., 1] = g2.astype(np.uint8)
    return np.clip(soft, 0, 1), out


class Segmenters:
    def __init__(self, home=HOME, need_hair=True):
        no_metrics()
        import mediapipe as mp
        from mediapipe.tasks.python import BaseOptions, vision
        self.mp = mp
        self.hair = self.person = None
        if need_hair:
            self.hair = vision.ImageSegmenter.create_from_options(vision.ImageSegmenterOptions(
                base_options=BaseOptions(model_asset_path=str(home / "hair_segmenter.tflite")), output_confidence_masks=True, output_category_mask=False))
            self.person = vision.ImageSegmenter.create_from_options(vision.ImageSegmenterOptions(
                base_options=BaseOptions(model_asset_path=str(home / "selfie_multiclass_256x256.tflite")), output_confidence_masks=False, output_category_mask=True))
        self.face = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=str(home / "face_landmarker.task")), num_faces=1, output_face_blendshapes=False))

    def image(self, bgr):
        import cv2
        return self.mp.Image(image_format=self.mp.ImageFormat.SRGB, data=cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))

    def hair_person(self, bgr):
        import cv2
        h, w = bgr.shape[:2]
        img = self.image(bgr)
        hair = self.hair.segment(img).confidence_masks
        hair = hair[1].numpy_view() if len(hair) > 1 else hair[0].numpy_view()
        cat = self.person.segment(img).category_mask.numpy_view()                   # 0 bg 1 hair 2 body 3 face 4 clothes 5 other
        if hair.shape != (h, w): hair = cv2.resize(hair, (w, h), interpolation=cv2.INTER_LINEAR)
        if cat.shape != (h, w): cat = cv2.resize(cat, (w, h), interpolation=cv2.INTER_NEAREST)
        person = cv2.GaussianBlur((cat > 0).astype(np.float32), (0, 0), 1.5)
        hair = np.maximum(hair, (cat == 1) * 0.6).astype(np.float32)
        return hair, person

    def landmarks(self, bgr):
        h, w = bgr.shape[:2]
        res = self.face.detect(self.image(bgr))
        return [[p.x * w, p.y * h] for p in res.face_landmarks[0]] if res.face_landmarks else None


def run(out, key="green", res=960, home=HOME, segmenters=None, bank=None, hue=(35, 80), sat=0.12, val=0.4):
    """every frame's hair mask (and keyed picture), face points and orientation map"""
    import cv2
    cap = Capture(out)
    seg = segmenters or Segmenters(home, need_hair=(key == "hair"))
    bank = bank or gabor_bank()
    (cap.dir / "masks").mkdir(exist_ok=True); (cap.dir / "orient").mkdir(exist_ok=True)
    keyed_dir = Path(key[6:]) if key.startswith("keyed:") else None
    fk = cap.dir / "frames_keyed"
    if fk.exists(): shutil.rmtree(fk)
    if key == "green" or keyed_dir: fk.mkdir()
    lms, report = {}, dict(frames=len(cap.names), faces=0, hair_px=[], key=key)
    for name, src in zip(cap.names, cap.meta.get("sources", cap.names)):
        bgr = imread(cap.frame(name))
        h, w = bgr.shape[:2]
        person = None
        if keyed_dir:
            cand = [keyed_dir / f"{name}.png", keyed_dir / (Path(src).stem + ".png")]
            f = next((c for c in cand if c.exists()), None)
            if f is None: raise SystemExit(f"no keyed frame for {name} in {keyed_dir} ({cand[0].name} or {cand[1].name})")
            rgba = cv2.imread(str(f), cv2.IMREAD_UNCHANGED)
            if rgba is None or rgba.ndim != 3 or rgba.shape[2] != 4: raise SystemExit(f"{f}: not a PNG with alpha")
            if rgba.shape[:2] != (h, w): rgba = cv2.resize(rgba, (w, h), interpolation=cv2.INTER_AREA)
            hair = rgba[..., 3].astype(np.float32) / 255; pic = rgba[..., :3]
            cv2.imwrite(str(fk / f"{name}.png"), pic)
        elif key == "green":
            hair, pic = green_key(bgr, hue, sat, val)
            cv2.imwrite(str(fk / f"{name}.png"), pic)
        elif key == "hair":
            hair, person = seg.hair_person(bgr); pic = bgr
        else:
            raise SystemExit(f"--key {key}: green, hair or keyed:DIR")
        cv2.imwrite(str(cap.hair_mask(name)), (np.clip(hair, 0, 1) * 255).astype(np.uint8))
        cv2.imwrite(str(cap.alpha(name)), (np.clip(person if person is not None else hair, 0, 1) * 255).astype(np.uint8))
        lm = seg.landmarks(bgr)
        if lm is not None: lms[name] = np.round(lm, 2).tolist(); report["faces"] += 1
        k = res / max(h, w) if max(h, w) > res else 1.0
        small = cv2.resize(pic, (round(w * k), round(h * k)), interpolation=cv2.INTER_AREA) if k < 1 else pic
        theta, conf = orientation(cv2.cvtColor(small, cv2.COLOR_BGR2GRAY), bank)
        hm = cv2.resize(hair, (small.shape[1], small.shape[0]), interpolation=cv2.INTER_LINEAR)
        np.savez_compressed(cap.orient(name), theta=theta.astype(np.float16), conf=(conf * (hm > 0.3)).astype(np.float16))
        report["hair_px"].append(int((hair > 0.5).sum()))
    jsave(cap.dir / "landmarks.json", lms)
    for t in (seg.face, seg.hair, seg.person):                        # closed now, not at exit (MediaPipe complains then)
        if t is not None: t.close()
    report["hair_px"] = dict(min=min(report["hair_px"]), median=int(np.median(report["hair_px"])), max=max(report["hair_px"]))
    report["res"] = res
    jsave(cap.dir / "masks.json", report)
    return report


def main(a):
    rep = run(a.out, a.key, a.res, hue=(a.hue - 25, a.hue + 20), sat=a.sat, val=a.val)
    print(json.dumps(rep))
    if rep["hair_px"]["min"] < 500: print("warning: a frame has almost no hair in its mask: look at masks/")
    print("GSHAIR masks ok")
