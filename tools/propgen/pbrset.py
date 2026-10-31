"""PBR sets off the shelf (assets/pbr/, docs/ASSETS.md §6), read the way the desk reads them (storykit/pbr.py: its maps
by their names, the normal's convention, tile_m), as arrays to sample: by a texture's own coordinates (an island at real
size) or by triplanar projection in a thing's own space (an imported mesh, whatever its UVs). A ref is pbr/<path>, or a
folder of maps anywhere."""
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, "Content", "Python"))

_sets = {}


class Set:
    def __init__(self, name, maps, tile_m=2.0):
        self.name, self.maps, self.tile_m = name, maps, float(tile_m)

    def sample(self, u, v):
        """The maps at texture coordinates (u, v) (arrays, wrapping): albedo (sRGB), rough, metal, normal (-1..1, GL)."""
        out = {}
        for k, img in self.maps.items():
            out[k] = _bilinear(img, u, v)
        out["albedo"] = out["albedo"][..., :3]
        out["rough"] = out["rough"][..., 0] if "rough" in out else np.full(u.shape, 0.7, np.float32)
        out["metal"] = out["metal"][..., 0] if "metal" in out else np.zeros(u.shape, np.float32)
        out["normal"] = out["normal"][..., :3] * 2 - 1 if "normal" in out else np.stack([np.zeros(u.shape), np.zeros(u.shape), np.ones(u.shape)], -1)
        if "ao" in out:
            out["albedo"] = out["albedo"] * (0.55 + 0.45 * out["ao"][..., :1])
        return out


def _bilinear(img, u, v):
    h, w = img.shape[:2]
    x = (np.asarray(u) % 1.0) * w - 0.5
    y = (1.0 - (np.asarray(v) % 1.0)) * h - 0.5
    x0 = np.floor(x).astype(np.int64)
    y0 = np.floor(y).astype(np.int64)
    tx, ty = (x - x0)[..., None], (y - y0)[..., None]
    x0, y0 = x0 % w, y0 % h
    x1, y1 = (x0 + 1) % w, (y0 + 1) % h
    top = img[y0, x0] * (1 - tx) + img[y0, x1] * tx
    bot = img[y1, x0] * (1 - tx) + img[y1, x1] * tx
    return (top * (1 - ty) + bot * ty).astype(np.float32)


def shelf():
    """Every set on the shelf: {ref: its meta} (storykit/pbr.py's scan, written as the desk does)."""
    from storykit import pbr as PBR
    return PBR.scan(write=True)


def load(ref, size=1024):
    """A set as arrays (each map at most `size` pixels across): from the shelf by ref, or a folder."""
    key = (str(ref), size)
    if key in _sets:
        return _sets[key]
    from storykit import pbr as PBR
    from .paint import read_image
    if str(ref).startswith("pbr/"):
        d = PBR.set_dir(ref)
    else:
        d = __import__("pathlib").Path(ref)
    if not d.is_dir():
        raise SystemExit(f"PBR set {ref}: no folder at {d} (python tools/propgen.py pbr lists the shelf)")
    m = PBR.meta(d)
    if not m:
        raise SystemExit(f"PBR set {ref}: no colour map in {d}")
    maps = {}
    for k in ("albedo", "normal", "rough", "metal", "ao"):
        f = m["maps"].get(k)
        if not f:
            continue
        img = read_image(str(d / f))
        step = max(1, int(np.ceil(max(img.shape[:2]) / size)))
        if step > 1:
            hh, ww = img.shape[0] // step * step, img.shape[1] // step * step
            img = img[:hh, :ww].reshape(hh // step, step, ww // step, step, -1).mean((1, 3))
        if k == "normal" and m.get("normal") == "dx":
            img = img.copy()
            img[..., 1] = 1 - img[..., 1]
        maps[k] = img.astype(np.float32)
    if "rough" not in maps and m.get("orm"):
        orm = read_image(str(d / m["orm"]))
        maps["ao"] = orm[..., 0:1].repeat(3, -1)
        maps["rough"] = orm[..., 1:2].repeat(3, -1)
        maps["metal"] = orm[..., 2:3].repeat(3, -1)
    st = Set(str(ref), maps, m.get("tile_m", 2.0))
    _sets[key] = st
    return st


def triplanar(st, P, N, T, B, tile=None, sharp=4.0):
    """A set sampled on texels by their place (P, metres) and normal (N) in the thing's own space, blended by how much
    each face looks down an axis; its normal map turned into each texel's tangent frame (T, B, N). Ben Golus's
    whiteout blend. Returns albedo (k, 3), rough (k,), metal (k,), normal (k, 3) in tangent space."""
    tm = tile or st.tile_m
    p = P / tm
    w = np.abs(N) ** sharp
    w /= np.maximum(w.sum(1, keepdims=True), 1e-9)
    sgn = np.where(N >= 0, 1.0, -1.0)
    # the three planar samples (looking down x: (z, y); y: (x, z); z: (x, y)), u flipped on the far sides so print
    # doesn't read mirrored there
    sx = st.sample(p[:, 2] * sgn[:, 0], p[:, 1])
    sy = st.sample(p[:, 0] * sgn[:, 1], p[:, 2])
    sz = st.sample(p[:, 0] * -sgn[:, 2], p[:, 1])
    alb = sx["albedo"] * w[:, :1] + sy["albedo"] * w[:, 1:2] + sz["albedo"] * w[:, 2:3]
    rough = sx["rough"] * w[:, 0] + sy["rough"] * w[:, 1] + sz["rough"] * w[:, 2]
    metal = sx["metal"] * w[:, 0] + sy["metal"] * w[:, 1] + sz["metal"] * w[:, 2]
    tx, ty, tz = sx["normal"].copy(), sy["normal"].copy(), sz["normal"].copy()
    tx[:, 0] *= sgn[:, 0]
    ty[:, 0] *= sgn[:, 1]
    tz[:, 0] *= -sgn[:, 2]
    nx = np.stack([tx[:, 0] + N[:, 2], tx[:, 1] + N[:, 1], np.abs(tx[:, 2]) * N[:, 0]], 1)   # in (z, y, x)
    ny = np.stack([ty[:, 0] + N[:, 0], ty[:, 1] + N[:, 2], np.abs(ty[:, 2]) * N[:, 1]], 1)   # in (x, z, y)
    nz = np.stack([tz[:, 0] + N[:, 0], tz[:, 1] + N[:, 1], np.abs(tz[:, 2]) * N[:, 2]], 1)   # in (x, y, z)
    world = nx[:, [2, 1, 0]] * w[:, :1] + ny[:, [0, 2, 1]] * w[:, 1:2] + nz * w[:, 2:3]
    world /= np.maximum(np.linalg.norm(world, axis=1, keepdims=True), 1e-9)
    ts = np.stack([(world * T).sum(1), (world * B).sum(1), (world * N).sum(1)], 1)
    ts /= np.maximum(np.linalg.norm(ts, axis=1, keepdims=True), 1e-9)
    return alb, rough, metal, ts
