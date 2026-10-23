"""GSHAIR: the salon's reference pipeline on a synthetic capture, on the CPU in minutes. The Gabor orientation on
stripes and the green key; then a person (the face anchors the poses) and a known wig on MHR's head with no face in sight
(a mannequin: a pair to start, the chain round, the bundle), each rendered from a sweep of cameras, go through the poses
and are measured against the truth (the wig's after the similarity its free world needs), then into the salon's
reference: the person's cameras in the head's space reproject the face exactly, the wig's without any fit see the head.
The synthetic frames are drawn by raster.py (the removed splat's renderer, kept only for this). Ends 'GSHAIR ok'.
Needs the environment (tools/gshair.py setup): torch, OpenCV, scipy, MediaPipe."""
import json
import shutil
import time
from pathlib import Path

import numpy as np

from . import poses, synth
from .common import project_np


def fail(msg):
    raise SystemExit("GSHAIR FAIL: " + msg)


def check_gabor():
    from .masks import orientation
    yy, xx = np.mgrid[0:96, 0:96].astype(np.float32)
    for deg in (0, 30, 90, 135):
        th = np.deg2rad(deg); nx, ny = -np.sin(th), np.cos(th)
        img = (127 + 100 * np.sin(2 * np.pi * (xx * nx + yy * ny) / 6.0)).astype(np.uint8)
        theta, conf = orientation(img)
        c = theta[24:72, 24:72]
        est = np.rad2deg(np.arctan2(np.sin(2 * c).mean(), np.cos(2 * c).mean()) / 2) % 180
        if min(abs(est - deg), 180 - abs(est - deg)) > 3: fail(f"stripes along {deg} degrees read as {est:.1f}")
    print("  ok  the Gabor orientation: stripes at 0, 30, 90 and 135 degrees read right")


def check_green_key():
    import cv2
    from .masks import green_key
    img = np.zeros((120, 160, 3), np.uint8); img[:] = (40, 200, 60)                   # BGR green
    cv2.circle(img, (80, 50), 30, (20, 15, 10), -1)                                   # dark hair
    cv2.rectangle(img, (0, 100), (160, 120), (200, 200, 200), -1)                     # a patterned floor
    m, pic = green_key(img)
    if m[50, 80] < 0.9 or m[20, 20] > 0.1 or m[110, 80] > 0.1: fail("the green key kept the wrong pixels")
    print("  ok  the green key: the hair kept, the green and the floor's pattern dropped")


def similarity(A, B):
    """s, R, t with B ~ s R A + t"""
    ma, mb = A.mean(0), B.mean(0); a, b = A - ma, B - mb
    U, S, Vt = np.linalg.svd(b.T @ a / len(a)); d = np.sign(np.linalg.det(U @ Vt)); D = np.diag([1, 1, d])
    R = U @ D @ Vt; s = (S * np.diag(D)).sum() / (a ** 2).sum(1).mean()
    return s, R, mb - s * R @ ma


def run(out, keep=False, quick=True, device="cpu"):
    t0 = time.time()
    out = Path(out)
    if out.exists(): shutil.rmtree(out)
    out.mkdir(parents=True)
    check_gabor(); check_green_key()
    size, views = (256, 30) if quick else (400, 48)
    # a person's capture: the poses anchored by the face
    pdir = out / "person"
    rep = synth.make(pdir, n_strands=300, nodes=32, views=views, size=size, person=True, device=device)
    head = np.load(pdir / "head.npz"); truth = np.load(pdir / "truth.npz")
    pr = poses.run(pdir, head["landmarks"].astype(float), head["points"].astype(float))
    cams = json.loads((pdir / "cameras.json").read_text())["frames"]
    err = [np.linalg.norm(-np.array(c["R"]).T @ np.array(c["t"]) - (-truth["R"][int(c["name"])].T @ truth["t"][int(c["name"])])) * 1000 for c in cams]
    if pr["posed"] < views or not pr["anchored"]: fail(f"the person's capture: {pr}")
    worst = cams[int(np.argmax(err))]
    print(f"  ok  a person's poses: {pr['face']} by the face, {pr.get('chain', 0)} chained, bundle rms {pr['bundle']['rms_after']} px; "
          f"camera centres {np.mean(err):.1f} mm off (max {np.max(err):.1f} at {worst['name']} by {worst['source']}) ({time.time() - t0:.0f} s)")
    if np.max(err) > 40 or np.mean(err) > 20: fail(f"a camera is {np.max(err):.0f} mm off the truth (mean {np.mean(err):.0f})")
    # the salon's reference from it: the cameras moved into the head's local space see the head where the capture's did,
    # and the face triangulated from the frames fits the head it is (scale 1, no offset, no turn)
    from . import reference
    rr = reference.make(pdir, "check", refs=out / "refs")
    ref = json.loads((out / "refs" / "check" / "reference.json").read_text())
    loc = reference.local_frame(head["points"].astype(float), ref["local"]["anchors"])
    lm_w = head["landmarks"].astype(float); lm_l = (lm_w - loc["C"]) @ loc["B"] / loc["S"]
    worst_px = 0.0
    for c, r in zip(cams, ref["frames"]):
        a = project_np(lm_w, np.array(c["R"]), np.array(c["t"]), np.array(c["K"]))[0]
        b = project_np(lm_l, np.array(r["R"]), np.array(r["t"]), np.array(r["K"]))[0]
        worst_px = max(worst_px, float(np.abs(a - b).max()))
    ff = ref["fit"].get("from") or {}
    print(f"  ok  the salon's reference: {rr['frames']} frames in the head's space reproject the face within {worst_px:.3f} px; the face fit "
          f"scale {ff.get('scale')}, offset {np.round(np.array(ff.get('offset', [0, 0, 0])) * 1000, 1).tolist()} mm, turn {ff.get('turn')}°, {ff.get('residual_mm')} mm residual")
    if worst_px > 0.05: fail(f"the reference's cameras see the head {worst_px:.2f} px off the capture's")
    if not ff or abs(ff["scale"] - 1) > 0.04 or np.linalg.norm(ff["offset"]) > 0.012 or abs(ff["turn"]) > 3: fail(f"the face fit of a head onto itself: {ff}")
    # a wig on a mannequin: no face, a free world
    wdir = out / "wig"
    rep = synth.make(wdir, n_strands=500 if quick else 1200, nodes=48, views=views, size=size, person=False, device=device)
    head = np.load(wdir / "head.npz"); truth = np.load(wdir / "truth.npz")
    pr = poses.run(wdir, None, None)
    if pr["posed"] < views or pr["anchored"]: fail(f"the wig's capture: {pr}")
    cams = json.loads((wdir / "cameras.json").read_text())["frames"]
    A = np.array([-np.array(c["R"]).T @ np.array(c["t"]) for c in cams]); B = np.array([-truth["R"][int(c["name"])].T @ truth["t"][int(c["name"])] for c in cams])
    s, R, t = similarity(A, B)
    err = np.linalg.norm((A @ R.T) * s + t - B, axis=1) * 1000
    print(f"  ok  the wig's poses: a pair to start, {pr.get('chain', 0)} chained, bundle rms {pr['bundle']['rms_after']} px; after a similarity "
          f"the camera centres are {err.mean():.1f} mm off (max {err.max():.1f}); scale {s:.3f} ({time.time() - t0:.0f} s)")
    if err.max() > 90 or err.mean() > 50: fail(f"a camera is {err.max():.0f} mm off the truth (mean {err.mean():.0f}): no face anchors a wig's loop")
    # the wig's reference without the splat's fit (a video straight to the salon): the silhouette's guess, finite cameras
    # that all see the head's middle in front of them
    rw = reference.make(wdir, "check_wig", refs=out / "refs", use_align=False)
    fw = json.loads((out / "refs" / "check_wig" / "reference.json").read_text())["frames"]
    if rw["frames"] != views or not all(np.isfinite(np.array(f["R"] + [f["t"]], float)).all() and f["t"][2] > 0 for f in fw):
        fail(f"the wig's reference without a splat: {rw}")
    print(f"  ok  the wig's reference without the splat: {rw['frames']} frames, aligned by the {rw['align']}, the head in front of every camera")
    print(json.dumps(dict(seconds=round(time.time() - t0), poses_mm=round(float(err.mean()), 1))))
    if not keep: shutil.rmtree(out, ignore_errors=True)
    print("GSHAIR ok")
