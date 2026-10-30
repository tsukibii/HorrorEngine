"""Noise for shapes and paint, numpy only: Perlin's improved gradient noise in 3D at any points (the dents, folds and
wrinkles of a deformer, the dirt and scratches of a texel by its place on the thing), its fractal sums and ridges, and
cellular noise (the facets of crumpled paper). A seed always gives the same field."""
import numpy as np

_GRAD = np.array([[1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
                  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]], float)
_perms = {}


def rng(seed, *salt):
    """A generator for a seed and any words or numbers (each part of a thing rolls its own dice)."""
    h = 2166136261
    for s in (seed,) + salt:
        for ch in str(s).encode():
            h = ((h ^ ch) * 16777619) & 0xffffffff
        h = ((h ^ 0x2f) * 16777619) & 0xffffffff
    return np.random.default_rng(h)


def _perm(seed):
    if seed not in _perms:
        p = rng(seed, "perm").permutation(256)
        _perms[seed] = np.concatenate([p, p]).astype(np.int64)
    return _perms[seed]


def perlin3(p, seed=0):
    """Gradient noise at points p (..., 3), about -1 to 1, zero on the integer lattice."""
    p = np.asarray(p, float)
    perm = _perm(seed)
    fl = np.floor(p)
    f = p - fl
    i = fl.astype(np.int64) & 255
    u = f * f * f * (f * (f * 6 - 15) + 10)
    x0, y0, z0 = i[..., 0], i[..., 1], i[..., 2]
    x1, y1, z1 = (x0 + 1) & 255, (y0 + 1) & 255, (z0 + 1) & 255
    fx, fy, fz = f[..., 0], f[..., 1], f[..., 2]

    def g(ix, iy, iz, dx, dy, dz):
        gr = _GRAD[perm[perm[perm[ix] + iy] + iz] % 12]
        return gr[..., 0] * dx + gr[..., 1] * dy + gr[..., 2] * dz

    ux, uy, uz = u[..., 0], u[..., 1], u[..., 2]
    a = g(x0, y0, z0, fx, fy, fz) * (1 - ux) + g(x1, y0, z0, fx - 1, fy, fz) * ux
    b = g(x0, y1, z0, fx, fy - 1, fz) * (1 - ux) + g(x1, y1, z0, fx - 1, fy - 1, fz) * ux
    c = g(x0, y0, z1, fx, fy, fz - 1) * (1 - ux) + g(x1, y0, z1, fx - 1, fy, fz - 1) * ux
    d = g(x0, y1, z1, fx, fy - 1, fz - 1) * (1 - ux) + g(x1, y1, z1, fx - 1, fy - 1, fz - 1) * ux
    return ((a * (1 - uy) + b * uy) * (1 - uz) + (c * (1 - uy) + d * uy) * uz) * 1.45


def fbm3(p, seed=0, octaves=4, lacunarity=2.0, gain=0.5):
    """Fractal sum: octaves of perlin3, each finer and fainter, normalised to about -1 to 1."""
    p = np.asarray(p, float)
    out = np.zeros(p.shape[:-1])
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        out += amp * perlin3(p * lacunarity ** o + 17.31 * o, seed + 101 * o)
        tot += amp
        amp *= gain
    return out / tot


def ridged3(p, seed=0, octaves=3, lacunarity=2.0, gain=0.5):
    """Sharp creases: 1 on the noise's zero lines, falling away either side (folds, wrinkles), 0 to 1."""
    p = np.asarray(p, float)
    out = np.zeros(p.shape[:-1])
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        out += amp * (1 - np.abs(perlin3(p * lacunarity ** o + 9.17 * o, seed + 57 * o))) ** 2
        tot += amp
        amp *= gain
    return out / tot


def cells3(p, seed=0, density=1.0):
    """Cellular noise: (F1, F2, the nearest cell's id) for points p (..., 3) against one random point per unit cube
    (scaled by density). F2 - F1 is 0 on the cells' borders: the ridges between facets."""
    p = np.asarray(p, float) * density
    sh = p.shape[:-1]
    q = p.reshape(-1, 3)
    base = np.floor(q).astype(np.int64)
    f1 = np.full(len(q), np.inf)
    f2 = np.full(len(q), np.inf)
    cid = np.zeros(len(q), np.int64)
    perm = _perm(seed)
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for dz in (-1, 0, 1):
                c = base + (dx, dy, dz)
                h = perm[(perm[(perm[c[:, 0] & 255] + (c[:, 1] & 255))] + (c[:, 2] & 255))]
                h2 = perm[(h + 71) & 511]
                h3 = perm[(h2 + 13) & 511]
                jit = np.stack([h, h2, h3], 1) / 255.0
                d = np.linalg.norm(c + jit - q, axis=1)
                ids = h * 65536 + h2 * 256 + h3
                closer = d < f1
                f2 = np.where(closer, f1, np.minimum(f2, d))
                cid = np.where(closer, ids, cid)
                f1 = np.where(closer, d, f1)
    return f1.reshape(sh) / density, f2.reshape(sh) / density, cid.reshape(sh)


def smoothstep(e0, e1, x):
    t = np.clip((np.asarray(x, float) - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)
