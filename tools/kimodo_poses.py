#!/usr/bin/env python3
"""The pose library shared by the director's desk and Kimodo's demo (its pose window: Save, Load).

Two files in Content/Studio/:
- poses.json, the desk's library on the previs skeleton (UE mannequin bones, Euler XYZ degrees): blocking uses it.
- kimodo_poses.json, poses made in Kimodo's pose window on its own 77-joint skeleton, exactly as posed (each
  joint's rotation relative to its parent's global one, as quaternions, and the hips' position). A save writes both:
  the exact one here, and its previs version into poses.json (bone directions matched, rolls left at rest) so the
  desk can block with it. A desk pose loads into the window through kimodo_constrain's solver.

Poses are in character space: the hips over the origin (x = z = 0), facing +Z. Runs inside Kimodo's environment
(numpy, and torch for loading desk poses).

    python tools/kimodo.py py -P tools/kimodo_poses.py check  every Kimodo pose against its desk version: POSES ok
"""
import json
import math
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
STUDIO = ROOT / "Content" / "Studio"
DESK, OWN = STUDIO / "poses.json", STUDIO / "kimodo_poses.json"
sys.path.insert(0, str(ROOT / "Content" / "Python"))     # not tools/: its kimodo.py would hide the kimodo package


def _tool(name):
    import importlib.util
    spec = importlib.util.spec_from_file_location(name, ROOT / "tools" / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _read(path, default):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


def soma():
    return _read(STUDIO / "soma77.json", {})


def joint_map():
    return _read(ROOT / "setup" / "kimodo.json", {})["npz"]["joint_map"]


def listing():
    """Every pose by name: 'kimodo' ones load exactly, 'desk' ones through the solver."""
    own = _read(OWN, {"poses": {}})["poses"]
    desk = _read(DESK, {"poses": {}})["poses"]
    out = [{"name": n, "src": "kimodo"} for n in sorted(own)]
    return out + [{"name": n, "src": "desk"} for n in sorted(desk) if n not in own]


def load(name):
    """quats (effective local, x y z w) and the hips' position, for the pose window."""
    own = _read(OWN, {"poses": {}})["poses"]
    if name in own:
        return own[name]
    lib = _read(DESK, None)
    if not lib or name not in lib["poses"]:
        raise KeyError(f"no pose {name!r}")
    return _from_desk(lib, name)


def _from_desk(lib, name):
    import torch
    from kimodo.geometry import matrix_to_axis_angle
    from kimodo.skeleton import SOMASkeleton77
    solve = _tool("kimodo_constrain").solve
    from storykit import storylib as L
    sm, jmap = soma(), joint_map()
    names = sm["names"]
    kh = sm["rest"][names.index("HeadEnd")][1]
    pos = L.pose_positions(lib, name, height=kh)
    par = {n: p for n, p, _ in lib["skeleton"]["joints"]}
    tj = ["pelvis"] + [n for n in jmap if n in pos and n != "pelvis"]
    idx = [names.index(jmap[n]) for n in tj]
    segs = [(tj.index(par[n]), tj.index(n)) for n in tj if par.get(n) in tj and not n.startswith(("thigh_", "clavicle_"))]
    skel = SOMASkeleton77()
    relaxed = skel.relaxed_hands_rest_pose.float()
    aa_rest = matrix_to_axis_angle(relaxed if relaxed.dim() == 3 else relaxed.reshape(-1, 3, 3))
    body = [i for i, n in enumerate(names) if not any(k in n for k in ("Thumb", "Index", "Middle", "Ring", "Pinky", "Eye", "Jaw"))]
    root0 = torch.tensor(sm["rest"][names.index("Hips")], dtype=torch.float32)
    rots, P, _ = solve(skel, [list(pos[n]) for n in tj], idx, segs, body, aa_rest, root0)
    G = rots.detach().numpy()
    parents = [int(p) for p in skel.joint_parents.tolist()]
    E = np.stack([G[j] if parents[j] < 0 else G[parents[j]].T @ G[j] for j in range(len(parents))])
    return {"quats": _quats(E), "root": [round(float(v), 5) for v in P[skel.root_idx].tolist()]}


def save(name, quats, root, offsets, parents):
    """The exact pose into kimodo_poses.json and its previs version into poses.json. A desk pose that wasn't made
    here keeps its name: pick another. Returns the previs version's worst bone error in degrees."""
    if not name or not all(c.isalnum() or c == "_" for c in name):
        raise ValueError("a pose name is letters, digits and _")
    own = _read(OWN, {"_note": "Poses made in Kimodo's pose window (tools/kimodo_poses.py): exact, on its skeleton.",
                      "poses": {}})
    desk = _read(DESK, None)
    if desk and name in desk["poses"] and name not in own["poses"]:
        raise ValueError(f"{name!r} is a desk pose: save under another name")
    own["poses"][name] = {"quats": quats, "root": root}
    OWN.write_text(json.dumps(own, indent=1), encoding="utf-8")
    if not desk:
        return None
    pose, err = _to_desk(desk, quats, root, offsets, parents)
    desk["poses"][name] = pose
    DESK.write_text(json.dumps(desk, indent=1), encoding="utf-8")
    return err


def _fk(quats, root, offsets, parents):
    E = _mats(quats)
    J = len(parents)
    G, P = np.zeros((J, 3, 3)), np.zeros((J, 3))
    for j in range(J):
        p = parents[j]
        if p < 0:
            G[j], P[j] = E[j], root
        else:
            G[j], P[j] = G[p] @ E[j], P[p] + G[p] @ np.asarray(offsets[j])
    return G, P


def _to_desk(lib, quats, root, offsets, parents):
    """Previs Euler angles whose forward kinematics point every bone the way the Kimodo pose does."""
    from storykit import storylib as L
    sm, jmap = soma(), joint_map()
    names = sm["names"]
    _, P = _fk(quats, np.asarray(root, float), offsets, parents)
    sk = lib["skeleton"]
    kh = sm["rest"][names.index("HeadEnd")][1]
    tgt = {n: P[names.index(jmap[n])] * (sk["height"] / kh) for n in jmap}
    joints = sk["joints"]
    kids = {n: [c for c, p, _ in joints if p == n] for n, _, _ in joints}
    off = {n: np.asarray(o, float) for n, _, o in joints}
    glob, pose = {}, {}
    for n, parent, _ in joints:
        pr = glob[parent] if parent else np.eye(3)
        cs = [c for c in kids[n] if c in tgt and n in tgt]
        if not cs:
            R = pr
        elif len(cs) == 1:
            R = _swing(pr @ off[cs[0]], tgt[cs[0]] - tgt[n]) @ pr
        else:                                     # the pelvis and the chest: the first child, then the sideways pair
            a0, a1 = pr @ off[cs[0]], tgt[cs[0]] - tgt[n]
            side = [c for c in cs[1:] if c.endswith("_l")], [c for c in cs[1:] if c.endswith("_r")]
            if side[0] and side[1]:
                b0, b1 = pr @ (off[side[0][0]] - off[side[1][0]]), tgt[side[0][0]] - tgt[side[1][0]]
                R = _frame(a1, b1) @ _frame(a0, b0).T @ pr
            else:
                R = _swing(a0, a1) @ pr
        glob[n] = R
        local = pr.T @ R
        if parent is None:                        # the hips: root position and rotation; the pelvis bone stays at rest
            pose["root"] = [round(float(v), 4) for v in tgt[n] - off[n]]
            pose["root_rot"] = _euler(R)
        else:
            e = _euler(local)
            if any(abs(v) > 0.05 for v in e):
                pose[n] = e
    test = {**lib, "poses": {"_t": pose}}
    got = L.pose_positions(test, "_t", height=sk["height"])
    err = 0.0
    for n, parent, _ in joints:
        if parent and parent in tgt and n in tgt and parent in got:
            a, b = np.subtract(got[n], got[parent]), tgt[n] - tgt[parent]
            if np.linalg.norm(a) > 1e-6 and np.linalg.norm(b) > 1e-6 and not n.startswith(("thigh_", "clavicle_")):
                c = np.dot(a, b) / np.linalg.norm(a) / np.linalg.norm(b)
                err = max(err, math.degrees(math.acos(max(-1.0, min(1.0, c)))))
    return pose, round(err, 1)


def _swing(a, b):
    """The smallest rotation taking direction a onto direction b."""
    a, b = a / np.linalg.norm(a), b / np.linalg.norm(b)
    v, c = np.cross(a, b), float(np.dot(a, b))
    if c < -0.999999:                             # opposite: half a turn about any axis square to a
        axis = np.cross(a, [1, 0, 0] if abs(a[0]) < 0.9 else [0, 1, 0])
        axis /= np.linalg.norm(axis)
        return 2 * np.outer(axis, axis) - np.eye(3)
    k = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + k + k @ k / (1 + c)


def _frame(a, b):
    """An orthonormal frame from a primary direction and a secondary one."""
    x = a / np.linalg.norm(a)
    z = np.cross(x, b)
    z /= np.linalg.norm(z)
    return np.stack([x, np.cross(z, x), z], axis=1)


def _euler(R):
    """three.js Euler 'XYZ' (R = Rx Ry Rz) in degrees, rounded."""
    y = math.asin(max(-1.0, min(1.0, R[0, 2])))
    if abs(R[0, 2]) < 0.9999999:
        x, z = math.atan2(-R[1, 2], R[2, 2]), math.atan2(-R[0, 1], R[0, 0])
    else:
        x, z = math.atan2(R[2, 1], R[1, 1]), 0.0
    return [round(math.degrees(v), 2) for v in (x, y, z)]


def _quats(M):
    from scipy.spatial.transform import Rotation
    return Rotation.from_matrix(np.asarray(M, float)).as_quat().round(6).tolist()


def _mats(q):
    from scipy.spatial.transform import Rotation
    return Rotation.from_quat(np.asarray(q, float)).as_matrix()


def check():
    """Every Kimodo pose against its desk version (bone directions, degrees)."""
    from kimodo.skeleton import SOMASkeleton77
    skel = SOMASkeleton77()
    parents = [int(p) for p in skel.joint_parents.tolist()]
    n = skel.neutral_joints.numpy()
    offsets = n - n[[max(p, 0) for p in parents]]
    offsets[[j for j, p in enumerate(parents) if p < 0]] = 0
    own, desk = _read(OWN, {"poses": {}})["poses"], _read(DESK, None)
    bad = 0
    for name, p in sorted(own.items()):
        _, err = _to_desk(desk, p["quats"], p["root"], offsets, parents)
        flag = "ok  " if err <= 8 else "FAIL"
        bad += err > 8
        print(f"{flag}  {name}: the desk version's worst bone is {err} degrees off")
    print("POSES ok" if not bad else f"POSES: {bad} poses off")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(check() if sys.argv[1:] == ["check"] else (print(__doc__) or 0))
