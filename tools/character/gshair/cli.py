"""The salon's reference from a video, in its environment (tools/gshair.py runs this sealed off the network):
    cli.py run <video|folder> --ref NAME [--key green|hair|keyed:DIR] [--head mhr|NAME|head.obj] [--orbit ...]
    cli.py frames|masks|poses --out DIR ...
    cli.py reference --out DIR --name NAME | --photos FRONT [SIDE] [BACK] --name NAME   (the salon's locked reference)
    cli.py check [--keep] [--full]
The Gaussian splat and its clay that these steps once fed were removed (DECISIONS 2026-10-23); the name stays.
"""
import argparse
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[2] / "tools")); sys.path.insert(0, str(HERE.parent))   # the package before tools/gshair.py

STEPS = ["frames", "masks", "poses"]


def add_out(p, required=True):
    p.add_argument("--out", required=required, help="the capture folder (everything lands here)")


def add_head(p):
    p.add_argument("--head", default="mhr", help="mhr, a character's name (Content/Studio/People/<name>) or a head .obj")
    p.add_argument("--body", help="the body's points over MHR's topology (.f32 or .npy), as the Studio saves them")


def add_masks(p):
    p.add_argument("--key", default="green", help="green (a wig on a green head), hair (a person: MediaPipe), keyed:DIR (keyed PNGs, e.g. CorridorKey's)")
    p.add_argument("--hue", type=int, default=60, help="the green's hue in OpenCV's 0-180 (pure green, 120 degrees, is 60; backdrops run 45 to 70; the range is hue-25 to hue+20)")
    p.add_argument("--sat", type=float, default=0.12, help="green must be at least this saturated (a pale green mannequin: low)")
    p.add_argument("--val", type=float, default=0.4, help="green must be at least this bright: darker pixels are hair even with green spill on them (a black wig: 0.4; a blonde one: lower)")


def add_orbit(p):
    p.add_argument("--orbit", action="store_true", help="a turntable (a rotating head on a plain backdrop, a MiniMax orbit): cameras on an even circle, no feature matching")
    p.add_argument("--sweep", type=float, default=360.0, help="--orbit: the degrees the frames cover")
    p.add_argument("--elevation", type=float, default=0.0, help="--orbit: the camera's angle above eye level, degrees")
    p.add_argument("--distance", type=float, default=0.9, help="--orbit: the camera's distance, m (a guess)")
    p.add_argument("--front", type=int, default=0, help="--orbit: the frame (by index) that sees the face from the front")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("frames"); add_out(p); p.add_argument("source"); p.add_argument("--count", type=int, default=90)
    p.add_argument("--max-side", type=int, default=1080); p.add_argument("--focal35", type=float, default=24.0, help="the lens in 35 mm terms (a phone's main camera: 24 to 26)")
    p.add_argument("--every", type=int, default=1, help="score every nth frame of the video")
    p = sub.add_parser("masks"); add_out(p); add_masks(p); p.add_argument("--res", type=int, default=960)
    p = sub.add_parser("poses"); add_out(p); add_head(p); p.add_argument("--colmap", help="a COLMAP text model folder instead of the chain")
    p.add_argument("--fixed-focal", action="store_true"); p.add_argument("--no-chain", action="store_true", help="only the frames that see the face")
    add_orbit(p)
    p = sub.add_parser("reference", help="the salon's locked reference (Content/Studio/Hair/References/NAME): a capture's frames with their cameras in head space, or photos")
    p.add_argument("--out", help="the capture folder (frames, masks, poses done)"); p.add_argument("--name", required=True)
    p.add_argument("--size", type=int, default=640, help="the frames' long side"); p.add_argument("--no-align", action="store_true", help="ignore an align.json (a fit left in an older capture): the silhouette's guess")
    p.add_argument("--photos", nargs="+", help="front [side [back]] pictures instead of a capture"); p.add_argument("--side-face", default="left", choices=["left", "right"], help="where the face points in the side photo")
    p = sub.add_parser("run", help="every step from a video"); add_out(p, required=False); add_head(p); add_masks(p); add_orbit(p); p.add_argument("source")
    p.add_argument("--to", default="reference", choices=STEPS + ["reference"], help="the last step (reference: frames, masks, poses, then the salon's reference)")
    p.add_argument("--ref", help="--to reference: the reference's name (default: the capture folder's parent's name)")
    p.add_argument("--count", type=int, default=90); p.add_argument("--focal35", type=float, default=24.0)
    p.add_argument("--from", dest="from_step", default="frames", choices=STEPS)
    p = sub.add_parser("check"); p.add_argument("--keep", action="store_true"); p.add_argument("--full", action="store_true"); p.add_argument("--out", default=None)
    p.add_argument("--device", default="cpu")
    a = ap.parse_args(argv)
    from gshair import common
    common.no_metrics()
    if a.cmd == "frames":
        from gshair import frames; frames.main(a)
    elif a.cmd == "masks":
        from gshair import masks; masks.main(a)
    elif a.cmd == "poses":
        from gshair import poses; poses.main(a)
    elif a.cmd == "reference":
        from gshair import reference
        if not a.photos and not a.out: ap.error("reference: --out CAPTURE or --photos FRONT [SIDE] [BACK]")
        reference.main(a)
    elif a.cmd == "check":
        from gshair import check
        check.run(a.out or (common.HOME / "check"), a.keep, not a.full, a.device)
    elif a.cmd == "run":
        import json
        if not a.out:                                             # a reference's capture lives beside it
            if a.to != "reference" or not a.ref: ap.error("run: --ref NAME (or --out DIR)")
            from gshair.reference import REFS
            a.out = str(REFS / a.ref / "capture")
        import numpy as np
        from gshair import frames, masks, poses
        last = "poses" if a.to == "reference" else a.to
        todo = STEPS[STEPS.index(a.from_step):STEPS.index(last) + 1]
        out = Path(a.out)
        if "frames" in todo: print(json.dumps(dict(step="frames", frames=len(frames.pick(a.source, out, a.count, 1080, a.focal35).names))), flush=True)
        if "masks" in todo: print(json.dumps(dict(step="masks", **masks.run(out, a.key, hue=(a.hue - 25, a.hue + 20), sat=a.sat, val=a.val))), flush=True)
        if "poses" in todo:
            pts, tris, name = common.load_head(a.head, a.body)
            lm = common.landmarks_on(pts, tris, name)
            np.savez_compressed(out / "head.npz", points=pts.astype(np.float32), tris=tris.astype(np.int32), landmarks=lm.astype(np.float32))
            faces = common.jload(out / "masks.json", {}).get("faces", 0)
            orbit = dict(sweep=a.sweep, elevation=a.elevation, distance=a.distance, front=a.front) if a.orbit else None
            print(json.dumps(dict(step="poses", **poses.run(out, lm if faces else None, pts, orbit=orbit))), flush=True)
        if a.to == "reference":
            from gshair import reference
            print(json.dumps(dict(step="reference", **reference.make(out, a.ref or out.parent.name))), flush=True)
        print("GSHAIR run ok")


if __name__ == "__main__":
    main()
