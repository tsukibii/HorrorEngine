"""The views for the splat (splat.py): every posed frame at the working size as tensors on the device: the keyed
picture (frames_keyed/ when the key made one, else the frame), the hair mask, the region the losses look at (the mask
grown by a margin: the hair and its edges), the orientation map as (cos 2t, sin 2t) with its confidence, and the
camera. Every tenth frame is held out to measure on."""
import numpy as np
import torch

from .common import Capture, imread, scale_K


class Views:
    def __init__(self, out, res=540, device="cpu", margin=20, heldout_every=10, max_frames=None):
        import cv2
        self.cap = cap = Capture(out)
        cams = cap.cameras()
        if not cams: raise SystemExit("no cameras.json: run the poses step first")
        self.device = device
        self.frames = []
        W0 = cap.meta["width"]
        keyed = cap.dir / "frames_keyed"
        for i, f in enumerate(cams["frames"]):
            if max_frames and len(self.frames) >= max_frames: break
            src = keyed / f"{f['name']}.png"
            img = imread(src if src.exists() else cap.frame(f["name"]), res)
            H, W = img.shape[:2]
            hair = cv2.resize(imread(cap.hair_mask(f["name"]), grey=True), (W, H), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
            k = max(1, int(round(margin * W / 960)))
            region = cv2.dilate((hair > 0.3).astype(np.uint8), np.ones((2 * k + 1, 2 * k + 1), np.uint8)).astype(np.float32)
            region = cv2.GaussianBlur(region, (0, 0), 2)
            o = np.load(cap.orient(f["name"]))
            theta = cv2.resize(o["theta"].astype(np.float32), (W, H), interpolation=cv2.INTER_NEAREST)
            conf = cv2.resize(o["conf"].astype(np.float32), (W, H), interpolation=cv2.INTER_AREA)
            rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).astype(np.float32) / 255
            T = lambda a: torch.from_numpy(np.ascontiguousarray(a)).to(device)
            self.frames.append(dict(
                name=f["name"], img=T(rgb), hair=T(hair), region=T(region),
                orient=T(np.stack([np.cos(2 * theta), np.sin(2 * theta)], -1)), conf=T(conf * (hair > 0.3)),
                R=T(np.asarray(f["R"], np.float32)), t=T(np.asarray(f["t"], np.float32)),
                K=tuple(scale_K(f["K"], W0, W)), W=W, H=H, heldout=(i % heldout_every == 0) and heldout_every > 0))
        self.train = [f for f in self.frames if not f["heldout"]] or self.frames
        self.heldout = [f for f in self.frames if f["heldout"]]
        self.W, self.H = self.frames[0]["W"], self.frames[0]["H"]

    def cam(self, f, delta=None):
        R, t = f["R"], f["t"]
        if delta is not None:
            from .raster import rodrigues
            Rd = rodrigues(delta[:3]); R = Rd @ R; t = Rd @ t + delta[3:]
        return dict(R=R, t=t, K=f["K"], W=f["W"], H=f["H"])

    def sample(self, rng):
        return self.train[rng.integers(len(self.train))]
