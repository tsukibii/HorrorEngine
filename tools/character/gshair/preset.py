"""A hair preset: the splat of a capture saved under Content/Studio/Hair/<name>/ for the hair builder
(tools/character/hairbuilder.html), to shape by hand: a box round it with cuts, pieces moved and stretched, paint,
jiggle per piece. The Gaussians are kept raw, in the head's frame when the capture was fitted (align.json), else in
their own world:
  gaussians.bin   float32 per Gaussian: x y z, sx sy sz, qw qx qy qz, r g b, opacity (14)
  hair.json       what it came from, the cage (box, cuts, pieces and their jiggle), the paint, the head, the look;
                  "animation" is reserved for the refiner (per clip, per piece: physics overrides and keyed poses)

    python tools/gshair.py preset --out DIR --name NAME [--raw]      from a capture folder
"""
import json
from pathlib import Path

import numpy as np

from .clumps import apply_align
from .common import ROOT, jload, jsave

HAIR = ROOT / "Content" / "Studio" / "Hair"
LAYOUT = "x y z sx sy sz qw qx qy qz r g b opacity"


def default_cage(mu, op, pad=0.02):
    m = op > 0.3
    P = mu[m] if m.sum() > 100 else mu
    lo, hi = np.percentile(P, 2, axis=0) - pad, np.percentile(P, 98, axis=0) + pad
    return dict(box=dict(centre=((lo + hi) / 2).round(4).tolist(), size=(hi - lo).round(4).tolist()), cuts=dict(y=[], z=[]), locked=False, pieces={})


def write(name, mu, scales, quat, op, rgb, source, frame, cage=None, look=None):
    d = HAIR / name; d.mkdir(parents=True, exist_ok=True)
    per = np.concatenate([mu, scales, quat, rgb, op[:, None]], 1).astype(np.float32)
    (d / "gaussians.bin").write_bytes(per.tobytes())
    hair = dict(about="a hair preset for the hair builder (tools/character/hairbuilder.html); tools/character/gshair/preset.py",
                name=name, version=1, source=source,
                gaussians=dict(file="gaussians.bin", count=int(len(per)), floats=14, layout=LAYOUT, frame=frame),
                cage=cage or default_cage(mu, op), paint=dict(added=None, erased=[]),
                head=dict(kind="base", preset="feminine", height=1.7, character=None),
                look=look or dict(roughness=0.35, shift=0.035, specular=0.5, ambient=0.3, sigma=1.0, opacity=1.0),
                animation=dict(clips={}, about="reserved: per clip, per piece: physics overrides and keyed poses (the animation refiner)"))
    jsave(d / "hair.json", hair)
    return hair


def from_capture(out, name, raw=False):
    out = Path(out)
    sp = {k: v.astype(float) for k, v in np.load(out / "splat.npz").items() if k in ("mu", "scales", "quat", "opacity", "rgb")}
    al = None if raw else jload(out / "align.json")
    g = apply_align(sp, al) if al else dict(mu=sp["mu"], quat=sp["quat"], scales=sp["scales"], opacity=sp["opacity"], rgb=sp["rgb"])
    cap = jload(out / "capture.json", {}); cams = jload(out / "cameras.json", {}).get("report", {}); srep = jload(out / "splat.json", {})
    source = dict(video=cap.get("source"), frames=len(cap.get("frames", [])), size=[cap.get("width"), cap.get("height")],
                  key=jload(out / "masks.json", {}).get("key"), poses="orbit" if cams.get("orbit") else ("face" if cams.get("anchored") else "chain"),
                  splat={k: srep.get(k) for k in ("iters", "res", "gaussians", "psnr_heldout", "anisotropy_mean")}, align=al.get("source") if al else "raw")
    frame = "head (metres, Y up, facing +Z; fitted by " + al["source"] + ")" if al else "the capture's own world"
    return write(name, g["mu"], g["scales"], g["quat"], g["opacity"], g["rgb"], source, frame)


def main(a):
    hair = from_capture(a.out, a.name, a.raw)
    print(json.dumps(dict(name=hair["name"], gaussians=hair["gaussians"]["count"], frame=hair["gaussians"]["frame"], box=hair["cage"]["box"])))
    print("GSHAIR preset ok")
