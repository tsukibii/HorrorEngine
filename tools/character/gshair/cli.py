"""The GaussianHair steps, in their environment (tools/gshair.py runs this sealed off the network):
    cli.py run <video|folder> --out DIR [--key green|hair|keyed:DIR] [--head mhr|NAME|head.obj] [--body body.f32] ...
    cli.py frames|masks|poses|splat|clumps --out DIR ...
    cli.py check [--keep] [--full]
"""
import argparse
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[2] / "tools")); sys.path.insert(0, str(HERE.parent))   # the package before tools/gshair.py

STEPS = ["frames", "masks", "poses", "splat", "clumps"]


def add_out(p):
    p.add_argument("--out", required=True, help="the capture folder (everything lands here)")


def add_head(p):
    p.add_argument("--head", default="mhr", help="mhr, a character's name (Content/Studio/People/<name>) or a head .obj")
    p.add_argument("--body", help="the body's points over MHR's topology (.f32 or .npy), as the Studio saves them")


def add_masks(p):
    p.add_argument("--key", default="green", help="green (a wig on a green head), hair (a person: MediaPipe), keyed:DIR (keyed PNGs, e.g. CorridorKey's)")
    p.add_argument("--hue", type=int, default=60, help="the green's hue in OpenCV's 0-180 (pure green, 120 degrees, is 60; backdrops run 45 to 70; the range is hue-25 to hue+20)")
    p.add_argument("--sat", type=float, default=0.12, help="green must be at least this saturated (a pale green mannequin: low)")
    p.add_argument("--val", type=float, default=0.4, help="green must be at least this bright: darker pixels are hair even with green spill on them (a black wig: 0.4; a blonde one: lower)")


def add_splat(p):
    p.add_argument("--res", type=int, default=540, help="the long side the optimisation works at")
    p.add_argument("--iters", type=int, default=4000)
    p.add_argument("--device", help="cuda or cpu (default: cuda when torch sees one)")
    p.add_argument("--voxel", type=float, default=0.01, help="the visual hull's voxel (in the capture's units: metres with a face, else the pair's baseline)")
    p.add_argument("--init", type=int, default=40000, help="Gaussians to start from")
    p.add_argument("--orient", type=float, default=0.1, help="the orientation loss's weight (0 turns it off)")
    p.add_argument("--seed", type=int, default=0)
    p.add_argument("--refine-poses", action="store_true", default=None, help="let the cameras move a little with the splat (the default when no face anchored them)")
    p.add_argument("--max-frames", type=int)


def add_orbit(p):
    p.add_argument("--orbit", action="store_true", help="a turntable (a rotating head on a plain backdrop, a MiniMax orbit): cameras on an even circle, no feature matching")
    p.add_argument("--sweep", type=float, default=360.0, help="--orbit: the degrees the frames cover")
    p.add_argument("--elevation", type=float, default=0.0, help="--orbit: the camera's angle above eye level, degrees")
    p.add_argument("--distance", type=float, default=0.9, help="--orbit: the camera's distance, m (a guess)")
    p.add_argument("--front", type=int, default=0, help="--orbit: the frame (by index) that sees the face from the front")


def add_clumps(p):
    p.add_argument("--clumps", type=int, default=16, help="clay blobs: one per lock of hair")
    p.add_argument("--joints", type=int, default=4, help="joints down each blob's chain")
    p.add_argument("--align", help="an align.json to use instead of the capture's")


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
    p = sub.add_parser("splat"); add_out(p); add_splat(p)
    p = sub.add_parser("clumps"); add_out(p); add_clumps(p)
    p = sub.add_parser("run", help="every step from a video"); add_out(p); add_head(p); add_masks(p); add_orbit(p); add_splat(p); add_clumps(p); p.add_argument("source")
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
    elif a.cmd == "splat":
        from gshair import splat; splat.main(a)
    elif a.cmd == "clumps":
        from gshair import clumps; clumps.main(a)
    elif a.cmd == "check":
        from gshair import check
        check.run(a.out or (common.HOME / "check"), a.keep, not a.full, a.device)
    elif a.cmd == "run":
        import json
        import numpy as np
        from gshair import clumps, frames, masks, poses, splat
        todo = STEPS[STEPS.index(a.from_step):]
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
        if "splat" in todo:
            print(json.dumps(dict(step="splat", **{k: v for k, v in splat.run(out, a.res, a.iters, a.device, a.voxel, a.init, a.seed, a.orient,
                                                                                   max_frames=a.max_frames, refine_poses=a.refine_poses).items() if k != "log"})), flush=True)
        if "clumps" in todo: print(json.dumps(dict(step="clumps", **clumps.run(out, a.clumps, a.joints, align=a.align))), flush=True)
        print("GSHAIR run ok")


if __name__ == "__main__":
    main()
