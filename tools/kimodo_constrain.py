"""Turns motion jobs into Kimodo constraint files: each blocked pose key becomes a full-body keyframe on Kimodo's own
SOMA skeleton (solved with its forward kinematics, so its rotation conventions are used as they are), each walk a
2D root path. Run inside Kimodo's environment: `python tools/motion.py --game G constrain [job]` (via tools/kimodo.py).

The previs joints (poses.json, 25) pin the SOMA joints setup/kimodo.json maps them to; fingers keep Kimodo's relaxed
hands, eyes and jaw stay at rest. Writes Saved/Story/<Game>/motion/<job>.kimodo.json, which `motion.py run` passes on.
"""
import json
import sys
from pathlib import Path

import torch
from kimodo.constraints import FullBodyConstraintSet, Root2DConstraintSet, save_constraints_lst
from kimodo.geometry import axis_angle_to_matrix, matrix_to_axis_angle
from kimodo.skeleton import SOMASkeleton77

ROOT = Path(__file__).resolve().parents[1]
FPS = 30


def solve(skel, targets, idx, segs, free, aa0, root0, iters=500):
    """Local rotations (axis-angle) and a root position whose FK points each mapped bone the way the blocking does
    (directions, not positions: the two skeletons' proportions differ) with the hips where the blocking has them."""
    aa = aa0.clone()
    delta = (torch.randn(len(free), 3) * 1e-3).requires_grad_(True)     # not exactly zero: axis-angle has no gradient there
    root = root0.clone().requires_grad_(True)
    opt = torch.optim.Adam([delta, root], lr=0.03)
    tgt = torch.tensor(targets, dtype=torch.float32)
    sa, sb = [s[0] for s in segs], [s[1] for s in segs]                  # indices into targets / idx
    want = tgt[sb] - tgt[sa]
    want = want / want.norm(dim=-1, keepdim=True).clamp_min(1e-6)

    def run():
        a = aa.clone()
        a[free] = aa0[free] + delta
        rots, pos, _ = skel.fk(axis_angle_to_matrix(a)[None], root[None])
        p = pos[0, idx]
        d = p[sb] - p[sa]
        return rots[0], pos[0], p, d / d.norm(dim=-1, keepdim=True).clamp_min(1e-6)
    for _ in range(iters):
        opt.zero_grad()
        _, _, p, d = run()
        loss = ((d - want) ** 2).sum() + 4 * ((p[0] - tgt[0]) ** 2).sum() + 1e-3 * (delta ** 2).sum()
        loss.backward()
        opt.step()
    with torch.no_grad():
        rots, pos, p, d = run()
        errs = torch.rad2deg(torch.acos((d * want).sum(-1).clamp(-1, 1)))
    return rots, pos, errs


def main(argv):
    jobs_path = Path(argv[0])
    only = argv[1] if len(argv) > 1 else None
    conf = json.loads((ROOT / "setup" / "kimodo.json").read_text(encoding="utf-8"))["npz"]
    soma = json.loads((ROOT / conf.get("skeleton", "Content/Studio/soma77.json")).read_text(encoding="utf-8"))
    names = soma["names"]
    kh = soma["rest"][names.index("HeadEnd")][1]
    jmap = conf["joint_map"]
    par = {n: p for n, p, _ in json.loads((ROOT / "Content" / "Studio" / "poses.json").read_text(encoding="utf-8"))["skeleton"]["joints"]}
    skel = SOMASkeleton77()
    relaxed = skel.relaxed_hands_rest_pose.float()                       # local rotation matrices, relaxed hands
    aa_rest = matrix_to_axis_angle(relaxed if relaxed.dim() == 3 else relaxed.reshape(-1, 3, 3))
    body = [i for i, n in enumerate(names) if not any(k in n for k in ("Thumb", "Index", "Middle", "Ring", "Pinky", "Eye", "Jaw"))]
    root0 = torch.tensor(soma["rest"][names.index("Hips")], dtype=torch.float32)
    jobs = json.loads(jobs_path.read_text(encoding="utf-8"))
    for j in jobs:
        if only and j["id"] != only:
            continue
        cons, c = [], j.get("constraints", {})
        nf = int(round(j["secs"] * FPS))
        keys = c.get("pose_keys") or []
        if keys:
            frames, P, R, worst, worst_bone = [], [], [], 0.0, ""
            for k in keys:
                h = max(p[1] for p in k["joints"].values()) or kh                 # the cast member's height in the key
                s = kh / max(h, 1e-3)
                tj = ["pelvis"] + [n for n in jmap if n in k["joints"] and n != "pelvis"]   # the hips first
                idx = [names.index(jmap[n]) for n in tj]
                tg = [[v * s for v in k["joints"][n]] for n in tj]
                # bones only: the hips-to-thigh and chest-to-clavicle offsets are fixed shapes that differ between rigs
                segs = [(tj.index(par[n]), tj.index(n)) for n in tj if par.get(n) in tj and not n.startswith(("thigh_", "clavicle_"))]
                rots, pos, errs = solve(skel, tg, idx, segs, body, aa_rest, root0)
                k_worst = int(errs.argmax())
                err, bone = float(errs[k_worst]), tj[segs[k_worst][1]]
                frames.append(min(max(0, k["frame"]), max(0, nf - 1)))
                P.append(pos)
                R.append(rots)
                if err > worst:
                    worst, worst_bone = err, bone
            cons.append(FullBodyConstraintSet(skel, torch.tensor(frames), torch.stack(P), torch.stack(R)))
            print(f"{j['id']}: {len(keys)} pose keys, worst bone {worst:.1f} degrees off the blocking ({worst_bone})")
        path, rk = c.get("root_path"), c.get("root_keys")
        if rk and len(rk) > 1:                                             # blocked walks, keyed when each move lands
            fi = [min(max(0, k["frame"]), nf - 1) for k in rk]
            xy = torch.tensor([[k["pos"][1], k["pos"][0]] for k in rk], dtype=torch.float32)
            cons.append(Root2DConstraintSet(skel, torch.tensor(fi), xy))
            print(f"{j['id']}: blocked walk, {len(rk)} root keys")
        elif path and len(path) > 1:                                       # job axes: x forward, y left -> Kimodo (x left, z forward)
            fi = [round(i * (nf - 1) / (len(path) - 1)) for i in range(len(path))]
            xy = torch.tensor([[p[1], p[0]] for p in path], dtype=torch.float32)        # metres stay metres
            cons.append(Root2DConstraintSet(skel, torch.tensor(fi), xy))
            print(f"{j['id']}: root path, {len(path)} points")
        out = jobs_path.parent / f"{j['id']}.kimodo.json"
        if cons:
            save_constraints_lst(str(out), cons)
        elif out.exists():
            out.unlink()
    print("CONSTRAIN ok")


if __name__ == "__main__":
    main(sys.argv[1:])
