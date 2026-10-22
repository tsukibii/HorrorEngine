"""Perm's side of tools/perm.py: runs in Perm's environment, from its src/ folder, inside unshare -rn.

    perm_run.py library --models DIR --head OBJ --params DIR --out DIR --roots TXT [--preview 3000]
        every fitted hairstyle (its theta and beta, on its own roots) as preview strands: DIR/<name>.npz (positions,
        float16, preview x 32 points, Perm's head frame), and DIR/strands.json (the names)
    perm_run.py blend --models DIR --head OBJ --params DIR --weights JSON --out FILE.npz --roots TXT [--seed N --vary X]
        the hairstyles' parameters mixed by weight and decoded on the root set: FILE (positions: strands x points x 3)
"""
import argparse
import json
import os
import sys
from pathlib import Path

import numpy as np
import torch

sys.path.insert(0, os.getcwd())
from hair.hair_models import Perm  # noqa: E402 - Perm's own source folder is the working directory

SCALP_BOUNDS = [0.1870, 0.8018, 0.4011, 0.8047]   # Perm's default (gen_from_parameters.py)


def resample(P, n):
    """strands (s, p, 3) -> (s, n, 3) evenly along their length"""
    seg = np.linalg.norm(np.diff(P, axis=1), axis=2)
    acc = np.concatenate([np.zeros((len(P), 1)), np.cumsum(seg, 1)], 1)
    out = np.empty((len(P), n, 3), np.float32)
    idx = np.arange(len(P))
    for j, f in enumerate(np.linspace(0, 1, n)):
        d = acc[:, -1] * f
        k = np.clip((acc < d[:, None]).sum(1) - 1, 0, P.shape[1] - 2)
        a, b = acc[idx, k], acc[idx, k + 1]
        t = np.clip((d - a) / np.maximum(b - a, 1e-9), 0, 1)[:, None]
        out[:, j] = P[idx, k] * (1 - t) + P[idx, k + 1] * t
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("op", choices=["library", "blend"])
    for k in ("--models", "--head", "--params", "--out", "--roots"): ap.add_argument(k, required=True)
    ap.add_argument("--preview", type=int, default=3000); ap.add_argument("--weights", default="{}")
    ap.add_argument("--seed", type=int, default=0); ap.add_argument("--vary", type=float, default=0.0)
    a = ap.parse_args()
    dev = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Perm on {dev}")
    model = Perm(model_path=a.models, head_mesh=a.head, scalp_bounds=SCALP_BOUNDS).eval().requires_grad_(False).to(dev)
    params = {p.stem: p for p in sorted(Path(a.params).glob("*.npz"))}
    load = lambda name: {k: torch.tensor(v, dtype=torch.float32, device=dev) for k, v in np.load(params[name]).items() if k in ("theta", "beta", "roots")}
    if a.op == "library":
        out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
        rng = np.random.default_rng(0)
        for i, name in enumerate(params):
            if (out / f"{name}.npz").exists(): continue
            d = load(name)
            with torch.no_grad():
                s = model(roots=d["roots"].unsqueeze(0), theta=d["theta"].unsqueeze(0), beta=d["beta"].unsqueeze(0))["strands"][0].position
            P = s.cpu().numpy()
            P = P[np.linalg.norm(P[:, -1] - P[:, 0], axis=1) > 1e-3]           # Perm's zero-length strands (its README)
            P = P[rng.choice(len(P), min(a.preview, len(P)), replace=False)]
            np.savez_compressed(out / f"{name}.npz", positions=resample(P, 32).astype(np.float16))
            print(f"  {i + 1}/{len(params)} {name}: {len(P)} strands")
        (out / "strands.json").write_text(json.dumps(sorted(params)), encoding="utf-8")
        return
    w = {k: float(v) for k, v in json.loads(a.weights).items() if k in params and float(v) > 0}
    if not w: sys.exit("no known hairstyles in --weights")
    total = sum(w.values())
    ds = {k: load(k) for k in w}
    theta = sum(ds[k]["theta"] * v for k, v in w.items()) / total
    beta = sum(ds[k]["beta"] * v for k, v in w.items()) / total
    if a.vary:
        g = torch.Generator().manual_seed(a.seed)
        theta = theta + a.vary * torch.randn(theta.shape, generator=g).to(dev)
    roots, _ = model.hair_roots.load_txt(a.roots)
    with torch.no_grad():
        s = model(roots=roots.to(dev).unsqueeze(0), theta=theta.unsqueeze(0), beta=beta.unsqueeze(0))["strands"][0].position
    P = s.cpu().numpy()
    P = P[np.linalg.norm(P[:, -1] - P[:, 0], axis=1) > 1e-3]
    np.savez_compressed(a.out, positions=P.astype(np.float32))
    print(f"blend of {len(w)}: {len(P)} strands x {P.shape[1]} points")


if __name__ == "__main__":
    main()
