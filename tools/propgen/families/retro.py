"""The retro pack (docs/PROPGEN.md §29): your own low-poly models (a PSX-era look: a few hundred triangles, small painted
or photo textures, colour only, every material fully rough) kept as they are and given what the made props have: the
texture sharper, its baked light taken out, its colours kept in the bar's range, a PBR set's grain at its real size,
relief from its own colours into a normal map, roughness and metalness by what each part is, the occlusion baked from
the mesh, the wear, cut-outs cut (alpha scissor) and glass see-through, one-sided unless it's a card, and the low poly
smoothed where it's meant to be round.

    {"family": "retro", "file": "retro/3D_Retro_World 0.01/GLTF/Props/Camp/Bag.glb", "group": "camp",
     "lod": 0, "node": null, "scale": 1.0, "smooth": 40, "weighted": null, "normals": "smooth" | "keep",
     "pivot": "floor" | "keep" | "trunk",
     "tex": 1024, "pixel": false, "layout": "auto" | "keep" | "unique" | "tile", "enhance": true,
     "materials": {"*" or its name: {"kind": "fabric" | "paint" | "metal" | "steel" | "plastic" | "rubber" | "wood" |
                   "weathered" | "stone" | "concrete" | "asphalt" | "bark" | "foliage" | "print" | "glass" | "card",
                   "rough": 0.7, "metal": 0, "detail": "pbr/<set>", "detail_amount": 0.5, "tile": 2.0, "relief": 1.0,
                   "delight": 0.3, "floor": 0.05, "layout": "unique", "alpha": "clip", "opacity": 0.3, "double": false,
                   "glow": {"above": 0.85, "sat": 0.35, "strength": 1.0}, "tint": "#ffffff", "wear": {...}}},
     "wear": {"dirt": 0.3, "dust": 0.2, "edges": 0.3}, "edge_mm": 5, "ao_dist": 0.05}

- **The mesh** is read from the .glb with numpy (tools/propgen/quality.py): its nearest LOD (`lod`; a billboard never;
  `node` one piece of a file of several, by its node's name), glTF's y-up as z-up, its vertices welded so a smooth
  surface shades smooth, each face wound the way its own normals say (a face turned inside out and hidden by
  double-sided drawing comes back), degenerate faces dropped. `smooth` is the angle past which an edge stays hard (40:
  a box's corners hard, a 9-sided cylinder round; 50 for the 8-sided poles; 0 every face flat, the PSX look),
  `weighted` hard-surface normals instead (an angle); `normals: "keep"` its own normals instead, unwelded (foliage
  cards whose normals bend out of the crown, so a bush lights as a soft mass). `pivot`: "floor" (centred, on the
  floor: the props' way), "keep" (its own origin: modular pieces that snap, a wall, a road), "trunk" (a tree on its
  trunk).
- **The texture**: `layout` "keep" (its own UVs: unique and in 0-1, the canvas is its texture), "unique" (stacked or
  mirrored islands: new UVs a material each, its picture carried over texel by texel from where the old UVs read it),
  "tile" (a texture made to repeat, or a card atlas: kept as it repeats, improved in its own space; no occlusion or wear
  by place, which a repeat can't hold); "auto" picks: cards and textures that repeat tile, unique UVs that use at least
  two fifths of their texture keep, the rest (stacked islands, a corner of an atlas shared with other models) unique.
  `tex` the canvas's pixels; `pixel` keeps the source's pixels square (nearest) instead of resampling smooth;
  `enhance: false` makes it as it came, for a comparison (its own texture's pixels, fully rough, no metal, occlusion or
  wear: the pack's own look in the studio).
- **A material** (by its name in the file, its name here, a pattern such as "*bark*", or "*" for all) gets its `kind`'s
  defaults (KINDS below) under what the recipe says: `rough` and `metal` (0-1, or "grey": bare metal where its colour
  is a light, clean grey), `detail` a shelf set laid over it at `tile` metres a repeat (its lightness, roughness and
  normal as variations on the picture's own colours, by `detail_amount`), `grain` and `grain_mm` (a fine grain of its
  own at its real size), `relief` (mm of the colour's own relief), `delight` (0-1: the picture's baked light taken
  out), `floor` (its darkest colour lifted to that lightness), `alpha` ("clip" cut-outs, "blend" glass, "opaque"; by
  itself a cut-out where its own alpha cuts holes in what its UVs use), `opacity` and `tint` (glass), `double` (both
  sides), `glow` (what's brighter than `above` and less saturated than `sat` (more than `sat_min`) lit: a lamp's panel,
  a sign's light box, a fire's embers), `px` its own texture size.
- **The wear** (the recipe's `wear`, a material's own) is the made props' (surface.wear): its worn edges and the dirt in
  its creases found by each texel's distance to the mesh's hard edges (`edge_mm` wide, by its size; a low mesh's own
  vertex curvature would spread over whole faces), its dirt in the baked occlusion.
"""
import fnmatch
import math
import os
import re

import numpy as np

from .. import mesh as M
from .. import noise as Nz
from ..recipes import ROOT

# what each kind of part is: its roughness and metalness, the relief its colour makes (mm), the shelf set whose grain it
# takes and at what repeat (metres), how much of its baked light goes, the darkest it may be, its alpha, the wear's kind
KINDS = {
    "fabric": dict(grain=0.07, grain_mm=0.9, rough=0.86, metal=0.0, relief=0.35, detail=None, tile=0.25, delight=0.25,
                   floor=0.05, wear_kind="fabric"),
    "paint": dict(grain=0.02, grain_mm=1.5, rough=0.42, metal=0.0, relief=0.06, detail="pbr/building/Paint005_1K-PNG",
                  detail_amount=0.15, tile=1.5, delight=0.15, floor=0.04, wear_kind="paint"),
    "metal": dict(grain=0.03, grain_mm=1.2, rough=0.38, metal=1.0, relief=0.05, detail="pbr/metal/Metal063_1K-PNG",
                  detail_amount=0.15, tile=1.0, delight=0.25, floor=0.18, wear_kind="metal"),
    "steel": dict(grain=0.02, grain_mm=1.0, rough=0.24, metal=1.0, relief=0.03, detail="pbr/metal/Metal063_1K-PNG",
                  detail_amount=0.1, tile=0.8, delight=0.3, floor=0.25, wear_kind="steel"),
    "plastic": dict(grain=0.02, grain_mm=1.5, rough=0.45, metal=0.0, relief=0.05, detail="pbr/plastic/white_plastic",
                    detail_amount=0.2, tile=0.6, delight=0.2, floor=0.04, wear_kind="plastic"),
    "rubber": dict(grain=0.04, grain_mm=1.0, rough=0.82, metal=0.0, relief=0.08, detail=None, tile=0.5, delight=0.2,
                   floor=0.04, wear_kind="plastic"),
    "wood": dict(grain=0.03, grain_mm=1.5, rough=0.68, metal=0.0, relief=0.5, detail="pbr/wood/WoodOak001_2K-JPG",
                 detail_amount=0.2, tile=1.0, delight=0.25, floor=0.05, wear_kind="wood"),
    "weathered": dict(grain=0.06, grain_mm=2.5, rough=0.88, metal=0.0, relief=1.2, detail="pbr/bark/Bark001_1K-PNG",
                      detail_amount=0.25, tile=1.5, delight=0.3, floor=0.06, wear_kind="weathered"),
    "stone": dict(grain=0.07, grain_mm=6.0, rough=0.86, metal=0.0, relief=3.0,
                  detail="pbr/concrete/Concrete044D_1K-PNG", detail_amount=0.3, tile=2.0, delight=0.4, floor=0.06,
                  wear_kind="stone"),
    "concrete": dict(grain=0.06, grain_mm=2.5, rough=0.9, metal=0.0, relief=0.9,
                     detail="pbr/concrete/Concrete021_1K-PNG", detail_amount=0.35, tile=2.0, delight=0.3, floor=0.07,
                     wear_kind="stone"),
    "asphalt": dict(grain=0.08, grain_mm=2.5, rough=0.9, metal=0.0, relief=0.8, detail="pbr/asphalt/Asphalt025C_1K-PNG",
                    detail_amount=0.4, tile=2.0, delight=0.2, floor=0.05, wear_kind="stone"),
    "bark": dict(grain=0.06, grain_mm=2.0, rough=0.9, metal=0.0, relief=4.0, detail=None, tile=1.0, delight=0.35,
                 floor=0.05, wear_kind="weathered"),
    "foliage": dict(grain=0.04, grain_mm=1.5, rough=0.58, metal=0.0, relief=0.3, detail=None, tile=1.0, delight=0.0,
                    floor=0.04, alpha="clip", double=True, wear_kind="fabric"),
    "print": dict(grain=0.012, grain_mm=1.0, rough=0.38, metal=0.0, relief=0.0, detail=None, tile=1.0, delight=0.0,
                  floor=0.03, wear_kind="paint"),
    "glass": dict(grain=0.0, grain_mm=1.0, rough=0.05, metal=0.0, relief=0.0, detail=None, tile=1.0, delight=0.0,
                  floor=0.0, alpha="blend", opacity=0.18, tint="#c9d6d2", wear_kind="clear"),
    "card": dict(grain=0.05, grain_mm=1.0, rough=0.8, metal=0.0, relief=0.15, detail=None, tile=0.5, delight=0.1,
                 floor=0.05, wear_kind="card"),
}
WEAR_LAYERS = ("grime", "dirt", "dust", "scratches", "edges", "stains", "fade")
TAB = True              # the page lists it as a tab of its own, after "all", its recipes by their `group` (PROPGEN §29)
FIELDS = {"file": "retro/3D_Retro_World 0.01/GLTF/Props/Camp/Bag.glb", "group": "camp", "smooth": 40, "pivot": "floor",
          "layout": "auto", "pixel": False, "materials": {"*": {"kind": "fabric"}}, "wear": {"dirt": 0.3, "dust": 0.2}}
CHOICES = {"pivot": ["floor", "keep", "trunk"], "layout": ["auto", "keep", "unique", "tile"]}


def _safe(name, taken):
    s = re.sub(r"[^a-z0-9]+", "_", (name or "main").lower()).strip("_") or "main"
    s = re.sub(r"_?material_?|_?mat$", "", s).strip("_") or "main"
    out, i = s, 2
    while out in taken:
        out, i = f"{s}{i}", i + 1
    return out


def _srgb_to_lin(c):
    c = np.asarray(c, np.float32)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def _lin_to_srgb(c):
    c = np.maximum(np.asarray(c, np.float32), 0)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def _lum(col):
    """The colour's lightness on sRGB's scale (its linear luminance, encoded back)."""
    return _lin_to_srgb(_srgb_to_lin(col) @ np.array([0.2126, 0.7152, 0.0722], np.float32))


def _fill(a, used):
    """Texels outside `used` take their nearest used neighbours' values (push-pull), so a resize or a blur near an
    island's edge (a cut-out's) never pulls in what's beyond it (a magenta or black background)."""
    from .. import bake as BK
    a = a.copy()
    BK.bleed([a], used)
    return a


def _weights(n_in, n_out, kernel="lanczos", wrap=False):
    """(n_out, n_in): each output sample's weights over the input's (a separable resize): "lanczos" (Lanczos-3),
    "box" (area: shrinking), "linear", "nearest"; past the ends clamped, or wrapped."""
    scale = n_in / n_out
    x = (np.arange(n_out) + 0.5) * scale - 0.5
    if kernel == "nearest":
        W = np.zeros((n_out, n_in), np.float32)
        W[np.arange(n_out), np.clip(np.floor(x + 0.5).astype(int), 0, n_in - 1)] = 1
        return W
    s = max(1.0, scale)                                  # shrinking: the kernel widens to cover what each sample gathers
    sup = {"lanczos": 3.0, "box": 0.5, "linear": 1.0}[kernel] * s
    j0 = np.floor(x - sup).astype(int) + 1
    taps = int(np.ceil(2 * sup)) + 1
    J = j0[:, None] + np.arange(taps)[None]
    d = (J - x[:, None]) / s
    if kernel == "lanczos":
        w = np.sinc(d) * np.sinc(d / 3.0) * (np.abs(d) < 3)
    elif kernel == "box":
        w = (np.abs(d) <= 0.5).astype(float)
    else:
        w = np.maximum(0, 1 - np.abs(d))
    w /= np.maximum(w.sum(1, keepdims=True), 1e-9)
    J = J % n_in if wrap else np.clip(J, 0, n_in - 1)
    W = np.zeros((n_out, n_in), np.float64)
    np.add.at(W, (np.repeat(np.arange(n_out), taps), J.ravel()), w.ravel())
    return W.astype(np.float32)


def _resize(img, px, pixel=False, wrap=False, kernel=None):
    """(h, w, k) floats to (px, px, k) (or (px[0], px[1], k)): Lanczos (smooth), or nearest (`pixel`: the source's pixels
    kept square); "box" to shrink."""
    oh, ow = (px, px) if np.ndim(px) == 0 else px
    a = img.astype(np.float32)
    flat = a.ndim == 2
    if flat:
        a = a[..., None]
    k = "nearest" if pixel else (kernel or ("box" if a.shape[0] > oh * 2 else "lanczos"))
    Wy = _weights(a.shape[0], oh, k, wrap)
    Wx = _weights(a.shape[1], ow, k, wrap)
    out = np.einsum("yh,hwc->ywc", Wy, a, optimize=True)
    out = np.einsum("xw,ywc->yxc", Wx, out, optimize=True)
    out = np.clip(out, 0, 1) if k == "lanczos" else out
    return out[..., 0] if flat else out


def _smooth_field(a, frac, mask=None, wrap=False):
    """A wide blur (a box of `frac` of the canvas, by a small copy and back): what's left is light and colour over
    large areas. Inside `mask` only (normalised), when given; across the edges of a texture that repeats (`wrap`)."""
    h, w = a.shape[:2]
    k = max(4, int(round(1.0 / max(frac, 1e-3))))
    a3 = a.reshape(h, w, -1).astype(np.float32)
    m = np.ones((h, w), np.float32) if mask is None else mask.astype(np.float32)
    num = _resize(_resize(a3 * m[..., None], k, wrap=wrap, kernel="box"), (h, w), wrap=wrap, kernel="linear")
    den = _resize(_resize(m, k, wrap=wrap, kernel="box"), (h, w), wrap=wrap, kernel="linear")
    return (num / np.maximum(den[..., None], 1e-4)).reshape(a.shape)


def _blur_px(a, r):
    """A blur of about r texels (twice a box), wrapping."""
    a = a.astype(np.float32)
    for _ in range(2):
        for ax in (0, 1):
            padded = np.concatenate([a.take(range(-r - 1, 0), axis=ax), a, a.take(range(0, r), axis=ax)], axis=ax)
            c = np.cumsum(padded, axis=ax, dtype=np.float64)
            hi = c.take(range(2 * r + 1, c.shape[ax]), axis=ax)
            lo = c.take(range(0, c.shape[ax] - 2 * r - 1), axis=ax)
            a = ((hi - lo) / (2 * r + 1)).astype(np.float32)
    return a


def _torus_noise(xx, yy, w, h, cells, seed, octaves=3):
    """Noise over texels (xx, yy) of a w x h texture that tiles: 4-D noise on a flat torus, `cells` features across."""
    a, b = xx / w * 2 * math.pi, yy / h * 2 * math.pi
    r = max(float(cells), 1.0) / (2 * math.pi)
    p = np.stack([np.cos(a) * r, np.sin(a) * r, np.cos(b) * r, np.sin(b) * r], 1)
    return Nz.fbm4(p, seed, octaves)


def _sample(img, u, v):
    """img (h, w, k) at texture coordinates (u, v), v up, wrapping, bilinear."""
    h, w = img.shape[:2]
    x = (u % 1.0) * w - 0.5
    y = (1.0 - (v % 1.0)) * h - 0.5
    x0, y0 = np.floor(x).astype(np.int64), np.floor(y).astype(np.int64)
    tx, ty = (x - x0)[..., None], (y - y0)[..., None]
    x0, y0 = x0 % w, y0 % h
    x1, y1 = (x0 + 1) % w, (y0 + 1) % h
    return (img[y0, x0] * (1 - tx) + img[y0, x1] * tx) * (1 - ty) + (img[y1, x0] * (1 - tx) + img[y1, x1] * tx) * ty


def _raster_corners(m, px, cvals, mat):
    """Like bake.raster, but a value per triangle corner (cvals: (faces, 4, k), the faces' corners): each texel of the
    material `mat` gets its triangle's corners' values blended at its centre. Returns ((px, px, k), hit)."""
    t, tuv, tf = m.tris()
    q = m.f[:, 3] >= 0
    cv = np.concatenate([cvals[:, [0, 1, 2]], cvals[q][:, [0, 2, 3]]])
    keep = m.fm[tf] == mat
    tuv, cv = tuv[keep], cv[keep]
    k = cvals.shape[2]
    out = np.zeros((px, px, k), np.float32)
    hit = np.zeros((px, px), bool)
    P = np.stack([tuv[..., 0] * px - 0.5, (1 - tuv[..., 1]) * px - 0.5], -1)
    lo = np.clip(np.floor(P.min(1)).astype(np.int64), 0, px - 1)
    hi = np.clip(np.ceil(P.max(1)).astype(np.int64), 0, px - 1)
    for i in range(len(P)):
        (x0, y0), (x1, y1) = lo[i], hi[i]
        if x1 < x0 or y1 < y0:
            continue
        X, Y = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
        (ax, ay), (bx, by), (cx, cy) = P[i]
        d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(d) < 1e-12:
            continue
        w0 = ((by - cy) * (X - cx) + (cx - bx) * (Y - cy)) / d
        w1 = ((cy - ay) * (X - cx) + (ax - cx) * (Y - cy)) / d
        w2 = 1 - w0 - w1
        ins = (w0 >= -1e-4) & (w1 >= -1e-4) & (w2 >= -1e-4)
        if not ins.any():
            continue
        yy, xx = Y[ins], X[ins]
        out[yy, xx] = w0[ins, None] * cv[i, 0] + w1[ins, None] * cv[i, 1] + w2[ins, None] * cv[i, 2]
        hit[yy, xx] = True
    return out, hit


# ---- the mesh ---------------------------------------------------------------------------------------------------------

def _load(spec):
    """The .glb's nearest LOD as a Mesh (z up, welded, wound by its own normals), its materials' sources and its
    original corner UVs."""
    from .. import quality as Q
    path = spec.get("file")
    if not path:
        raise SystemExit("retro: give a `file` (.glb)")
    full = path if os.path.isabs(path) else os.path.join(ROOT, path)
    if not os.path.exists(full):
        raise SystemExit(f"retro: no file {path}")
    G = Q.read(full, int(spec.get("lod", 0)), spec.get("node"))
    if not G["prims"]:
        raise SystemExit(f"retro: no triangles in {path}")
    js = G["js"]
    Ps, Ns, UVs, Ts, Fm = [], [], [], [], []
    mat_ids = []
    off = 0
    for p in G["prims"]:
        mi = p["mat"] if p["mat"] is not None else -1
        if mi not in mat_ids:
            mat_ids.append(mi)
        Ps.append(p["P"])
        Ns.append(p["N"] if p["N"] is not None else np.zeros_like(p["P"]))
        UVs.append(p["UV"] if p["UV"] is not None else np.zeros((len(p["P"]), 2)))
        Ts.append(p["T"] + off)
        Fm.append(np.full(len(p["T"]), mat_ids.index(mi)))
        off += len(p["P"])
    P = np.concatenate(Ps)
    P = np.stack([P[:, 0], -P[:, 2], P[:, 1]], 1) * float(spec.get("scale", 1.0))          # glTF y-up -> z-up
    Nn = np.concatenate(Ns)
    Nn = np.stack([Nn[:, 0], -Nn[:, 2], Nn[:, 1]], 1)
    UV = np.concatenate(UVs)
    T = np.concatenate(Ts)
    fm = np.concatenate(Fm)
    keep_n = spec.get("normals", "smooth") == "keep"
    if keep_n:
        # its own normals (a tree's leaves lit as a rounded mass, its bark's): no weld, every vertex as it came
        inv = np.arange(len(P))
        v = P.copy()
    else:
        # weld (0.02 mm): one vertex a place, so smoothing reaches across what the export split
        key = np.round(P / 2e-5).astype(np.int64)
        _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
        inv = inv.ravel()
        v = P[first]
    tw = inv[T]
    # degenerate faces out
    a, b, c = v[tw[:, 0]], v[tw[:, 1]], v[tw[:, 2]]
    cr = np.cross(b - a, c - a)
    area = np.linalg.norm(cr, axis=1) / 2
    ok = (tw[:, 0] != tw[:, 1]) & (tw[:, 1] != tw[:, 2]) & (tw[:, 2] != tw[:, 0]) & (area > 1e-12)
    # wound the way the face's own normals say
    flip = ((Nn[T[:, 0]] + Nn[T[:, 1]] + Nn[T[:, 2]]) * cr).sum(1) < 0
    flip &= np.linalg.norm(Nn[T].sum(1), axis=1) > 1e-6
    T2 = T.copy()
    T2[flip] = T2[flip][:, [0, 2, 1]]
    tw = inv[T2]
    tw, T2, fm = tw[ok], T2[ok], fm[ok]
    uv = UV[T2].copy()
    uv[..., 1] = 1.0 - uv[..., 1]                                                           # glTF's v runs down
    f = np.concatenate([tw, np.full((len(tw), 1), -1)], 1)
    uv4 = np.concatenate([uv, np.zeros((len(uv), 1, 2))], 1)
    names, taken = [], set()
    for mi in mat_ids:
        nm = _safe(js["materials"][mi].get("name") if mi >= 0 else "main", taken)
        taken.add(nm)
        names.append(nm)
    low = M.Mesh(v, f, uv4, mats=names)
    low.fm = fm.astype(np.int64)
    low.a["rest"] = low.v.copy()
    if keep_n:
        nn = Nn / np.maximum(np.linalg.norm(Nn, axis=1, keepdims=True), 1e-9)
        bad = np.linalg.norm(Nn, axis=1) < 1e-6
        if bad.any():                                   # a vertex without a normal: its faces' own
            from .. import bake as BK
            nn[bad] = BK.vertex_normals(low)[bad]
        low.a["normal"] = nn
    sources = {}
    for nm, mi in zip(names, mat_ids):
        sources[nm] = _source(G, mi)
    info = {"flipped": int(flip[ok].sum()), "degenerate": int((~ok).sum()), "welded": int(len(P) - len(v)),
            "levels": G["levels"], "lod": G["lod"]}
    return low, sources, info


def _source(G, mi):
    """A material's own look: its base colour image (sRGB, RGBA floats) times its factor, its alpha mode, its normal
    map (if it has one)."""
    from .. import quality as Q
    js = G["js"]
    m = js["materials"][mi] if mi is not None and mi >= 0 else {}
    pb = m.get("pbrMetallicRoughness", {})
    fac = np.asarray(pb.get("baseColorFactor", [1, 1, 1, 1]), np.float32)
    bc, _ = Q.texture(G, pb.get("baseColorTexture"))
    nm, _ = Q.texture(G, m.get("normalTexture"))
    img = bc.astype(np.float32).copy() if bc is not None else None
    if img is not None:
        img[..., :3] = _lin_to_srgb(_srgb_to_lin(img[..., :3]) * fac[:3])
        img[..., 3] *= fac[3]
    nrm = nm[..., :3].astype(np.float32).copy() if nm is not None else None
    return {"name": m.get("name"), "image": img, "factor": fac, "alpha": m.get("alphaMode", "OPAQUE"), "normal": nrm}


def _uv_shape(low, mi):
    """A material's UVs: (in 0-1 share, overlap share, the share of the texture used) at 256 px."""
    from .. import quality as Q
    sel = low.fm == mi
    uv = low.uv[sel][:, :3]
    if not len(uv):
        return 1.0, 0.0, 1.0
    in01 = float(((uv >= -0.001) & (uv <= 1.001)).all(-1).all(-1).mean())
    u2 = uv.copy()
    u2[..., 1] = 1 - u2[..., 1]                       # coverage() reads glTF's v (down)
    cnt = Q.coverage(u2, 256, wrap=in01 < 0.999)
    used = cnt > 0
    return in01, float((cnt > 1).sum() / max(1, used.sum())), float(used.mean())


def _unique_uvs(low, mats):
    """New UVs for the faces of the materials `mats` (indices): each material unwrapped into its own 0-1 by Blender's
    Smart UV Project, the other faces' UVs as they were."""
    import bpy
    me = M.to_blender(low, "retro_uv_tmp")
    if len(me.polygons) != len(low.f):
        bpy.data.meshes.remove(me)
        raise SystemExit("retro: Blender dropped faces of the mesh while unwrapping it")
    for i, s in enumerate(me.materials):
        me.materials[i] = bpy.data.materials.new(f"retro_uv_{i}")
    ob = bpy.data.objects.new("retro_uv_tmp", me)
    bpy.context.scene.collection.objects.link(ob)
    for o in bpy.context.scene.objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode="EDIT")
    for mi in mats:
        bpy.ops.mesh.select_all(action="DESELECT")
        ob.active_material_index = int(mi)
        bpy.ops.object.material_slot_select()
        bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.004, area_weight=0.0, correct_aspect=True,
                                 scale_to_bounds=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    back = M.from_blender(me)
    bpy.data.objects.remove(ob, do_unlink=True)
    for mt in list(me.materials):
        if mt is not None:
            bpy.data.materials.remove(mt)
    bpy.data.meshes.remove(me)
    sel = np.isin(low.fm, list(mats))
    low.uv[sel] = back.uv[sel]


def _density(low, mi, px):
    """Pixels a millimetre on the faces of material `mi` (the area-weighted median)."""
    t, tuv, tf = low.tris()
    keep = low.fm[tf] == mi
    t, tuv = t[keep], tuv[keep]
    if not len(t):
        return 1.0
    a, b, c = low.v[t[:, 0]], low.v[t[:, 1]], low.v[t[:, 2]]
    area = np.linalg.norm(np.cross(b - a, c - a), axis=1) / 2
    d1, d2 = tuv[:, 1] - tuv[:, 0], tuv[:, 2] - tuv[:, 0]
    uva = np.abs(d1[:, 0] * d2[:, 1] - d1[:, 1] * d2[:, 0]) / 2
    ok = (area > 1e-12) & (uva > 1e-14)
    if not ok.any():
        return 1.0
    r = np.sqrt(uva[ok] / area[ok]) * px / 1000.0
    o = np.argsort(r)
    cw = np.cumsum(area[ok][o]) / area[ok].sum()
    return float(r[o][np.searchsorted(cw, 0.5)])


def _cut_share(low, mi, img):
    """The share of the texels a material's UVs use whose alpha is under a half."""
    from .. import quality as Q
    sel = low.fm == mi
    uv = low.uv[sel][:, :3].copy()
    if not len(uv):
        return 0.0
    in01 = float(((uv >= -0.001) & (uv <= 1.001)).all(-1).all(-1).mean())
    uv[..., 1] = 1 - uv[..., 1]
    cnt = Q.coverage(uv, 256, wrap=in01 < 0.999)
    a = Q._resample(img[..., 3:4], 256)[..., 0]
    used = cnt > 0
    return float((a[used] < 0.5).mean()) if used.any() else 0.0


def _open_share(low, mi):
    """The share of a material's edges with one face only: a card or an open shell, drawn from both sides."""
    sel = np.nonzero(low.fm == mi)[0]
    f = low.f[sel][:, :3]
    e = np.sort(np.concatenate([f[:, [0, 1]], f[:, [1, 2]], f[:, [2, 0]]]), 1)
    _, cnt = np.unique(e, axis=0, return_counts=True)
    return float((cnt == 1).mean()) if len(cnt) else 0.0


# ---- the enhancement --------------------------------------------------------------------------------------------------

def _soft_floor(col, floor):
    """The darkest colours lifted to `floor` lightness (sRGB) with a soft knee, their hue kept."""
    if floor <= 0:
        return col
    L = np.maximum(_lum(col), 1e-4)
    k = floor * 2.0
    t = np.clip(L / k, 0, 1)
    newL = np.where(L < k, floor + (k - floor) * (t ** 1.6), L)
    lin = _srgb_to_lin(col) * (_srgb_to_lin(newL) / np.maximum(_srgb_to_lin(L), 1e-6))[..., None]
    grey = np.repeat(_srgb_to_lin(newL)[..., None], 3, axis=-1)
    dark = (_srgb_to_lin(L) < 2e-4)[..., None]                    # no light in it at all: no hue to keep, a neutral grey
    return np.clip(_lin_to_srgb(np.where(dark, grey, lin)), 0, 1)


def enhance(cv, hit, ms, tx, place, density, seed, relief_scale=1.0, k=1.0):
    """The canvas's colour (already the picture's) given the rest: its baked light out, its darkest lifted, a set's grain,
    roughness, metalness, the relief its colour makes (cv.height, mm), what glows. `place`: texels' places and normals
    (keep/unique layouts: the grain laid by triplanar projection at real size) or None (tile: the grain repeats in the
    texture's own space). `k`: the canvas's texels a texel of the source (an upscale's factor): the relief and the
    roughness follow the picture's features, never its pixels' edges."""
    from .. import pbrset
    yy, xx = np.nonzero(hit)
    if not len(yy):
        return
    col = cv.col.copy()
    def dbg(tag):                                         # RETRO_DEBUG=1: the lightness after each step, in the log
        if os.environ.get("RETRO_DEBUG"):
            print(f"    retro {tag}: L {float(_lum(col[yy, xx]).mean()):.3f}", flush=True)
    dbg("source")
    # 1. the picture's baked light: its lightness over large areas evened out toward its mean
    dl = float(ms.get("delight", 0.0))
    if dl > 0:
        L = _lum(col)
        big = _smooth_field(L, 1 / 12, hit, wrap=place is None)
        meanL = float(L[hit].mean())
        ratio = np.clip(meanL / np.maximum(big, 1e-3), 0.55, 1.8) ** dl
        col = np.clip(_lin_to_srgb(_srgb_to_lin(col) * _srgb_to_lin(np.clip(big * ratio, 0, 1))[..., None]
                                   / np.maximum(_srgb_to_lin(big), 1e-5)[..., None]), 0, 1)
    dbg("delit")
    # 2. the darkest lifted (no paint is black: the bar's darkest)
    col = _soft_floor(col, float(ms.get("floor", 0.04)))
    dbg("floored")
    # 3. a set's grain over the picture's colours (its lightness as a variation, its roughness and normal)
    rough = np.full(cv.rough.shape, float(ms["rough"]), np.float32) if not isinstance(ms["rough"], str) else cv.rough.copy()
    nrm = None
    det = ms.get("detail")
    amt = float(ms.get("detail_amount", 0.0)) if det else 0.0
    if det and amt > 0:
        try:
            st = pbrset.load(det, 1024)
        except SystemExit:
            st = None
        if st is not None:
            tile = float(ms.get("tile", st.tile_m))
            if place is not None:
                P, Nw, T, B = place
                alb, rr, _, nts = pbrset.triplanar(st, P[yy, xx], Nw[yy, xx], T[yy, xx], B[yy, xx], tile=tile)
            else:
                reps = max(1.0, round(float(ms.get("repeat", 4))))
                u = (xx + 0.5) / cv.w * reps
                v = 1 - (yy + 0.5) / cv.h * reps
                s = st.sample(u, v)
                alb, rr, nts = s["albedo"], s["rough"], s["normal"]
            ld = _lum(alb)
            ratio = 1.0 + amt * (ld / max(float(ld.mean()), 1e-3) - 1.0)
            col[yy, xx] = np.clip(_lin_to_srgb(_srgb_to_lin(col[yy, xx]) * np.clip(ratio, 0.4, 1.8)[:, None]), 0, 1)
            rough[yy, xx] += amt * 0.8 * (rr - float(rr.mean()))
            n = np.zeros(cv.nrm.shape, np.float32)
            n[..., 2] = 1
            nts = nts.copy()
            nts[:, :2] *= min(1.0, amt * 1.6)
            n[yy, xx] = nts / np.maximum(np.linalg.norm(nts, axis=1, keepdims=True), 1e-6)
            nrm = n
            dbg(f"detail (set's L mean {float(ld.mean()):.3f}, normal mean {np.round(n[yy, xx].mean(0), 3).tolist()})")
    # 3b. a fine grain at its real size, never finer than 2.5 texels (no shimmer): what a smooth upscale leaves out,
    #     in the colour's lightness, its roughness and its relief at once (a weave, a cast surface's pores, grit)
    gr = float(ms.get("grain", 0.0))
    if gr > 0:
        mm = max(float(ms.get("grain_mm", 1.0)), 2.5 / max(density, 1e-3))
        if place is not None:
            n = Nz.fbm3(place[0][yy, xx] * 1000.0 / mm, seed + 5, 3)
        else:
            n = _torus_noise(xx, yy, cv.w, cv.h, cv.w / (mm * max(density, 1e-3)), seed + 5, 3)
        n = np.clip(n / max(float(np.std(n)), 1e-4), -2.5, 2.5) * 0.5
        col[yy, xx] = np.clip(_lin_to_srgb(_srgb_to_lin(col[yy, xx]) * (1 + gr * n)[:, None]), 0, 1)
        rough[yy, xx] += gr * 0.6 * n
        cv.height[yy, xx] += n * gr * 4.0 * float(ms.get("relief", 0.3) or 0.3)
        dbg("grain")
    # 4. the relief its colour makes: dark is deep (a crack, a weave's gap, bark's furrows), on two scales
    rel = float(ms.get("relief", 0.0)) * relief_scale
    L = _lum(col)
    ki = max(1, int(round(k)))
    Ls = _blur_px(L, max(1, ki // 2)) if ki > 1 else L               # the source's pixels' edges softened away
    if rel > 0:
        r1 = max(1, int(round(cv.w / 512)), ki)
        fine = Ls - _blur_px(Ls, r1)
        mid = Ls - _blur_px(Ls, 4 * r1)
        sd = float(np.std(mid[hit])) + 1e-4
        h = (0.55 * fine + 0.45 * mid) / sd
        cv.height[hit] += np.clip(h[hit], -3, 3) * rel * 0.3
    # 5. roughness: the kind's, a little rougher where the colour is darker than round it (grime, gaps), a fine noise
    #    by place so no two patches shine alike
    loc = Ls - _blur_px(Ls, max(2, int(round(cv.w / 128)), 2 * ki))
    rough[yy, xx] += -0.35 * np.clip(loc[yy, xx], -0.3, 0.3)
    if place is not None:
        pts = place[0][yy, xx] * 1000.0
        rough[yy, xx] += 0.05 * Nz.fbm3(pts / 40.0, seed + 3, 3)
    else:
        rough[yy, xx] += 0.05 * _torus_noise(xx, yy, cv.w, cv.h, 12.0, seed + 3, 3)
    cv.rough[yy, xx] = np.clip(rough[yy, xx], 0.03, 1.0)
    # 6. metalness: the kind's, or bare metal where the colour is grey
    mt = ms.get("metal", 0.0)
    if mt == "grey":
        # bare metal where the colour is a light, clean grey (a pot stand, a valve, a galvanised arm); a dark grey stays
        # paint (a dark metal would mirror the sky as silver), and white is print or paint (a label's letters)
        x = col[yy, xx]
        sat = (x.max(1) - x.min(1)) / np.maximum(x.max(1), 1e-4)
        lum = L[yy, xx]
        grey = np.clip((0.12 - sat) / 0.05, 0, 1) * np.clip((lum - 0.38) / 0.08, 0, 1) * np.clip((0.84 - lum) / 0.08, 0, 1)
        cv.metal[yy, xx] = grey
        cv.rough[yy, xx] = cv.rough[yy, xx] * (1 - grey) + np.clip(0.3 + 0.5 * (cv.rough[yy, xx] - float(ms["rough"])), 0.08, 0.6) * grey
        lift = np.clip(0.5 / np.maximum(lum, 1e-3), 1.0, 1.4)                 # metals reflect half their light or more
        col[yy, xx] = np.clip(col[yy, xx] * (1 + (lift - 1) * grey)[:, None], 0, 1)
    elif float(mt) >= 0.5:
        lum = L[yy, xx]
        col[yy, xx] = np.clip(col[yy, xx] * np.clip(0.45 / np.maximum(lum, 1e-3), 1.0, 1.6)[:, None], 0, 1)
        cv.metal[yy, xx] = float(mt)
    else:
        cv.metal[yy, xx] = float(mt)
    # 7. what glows
    gl = ms.get("glow")
    if gl:
        x = col[yy, xx]
        sat = (x.max(1) - x.min(1)) / np.maximum(x.max(1), 1e-4)
        g = np.clip((L[yy, xx] - float(gl.get("above", 0.85))) / 0.08, 0, 1) * np.clip((float(gl.get("sat", 0.35)) - sat) / 0.1, 0, 1)
        g *= np.clip((sat - float(gl.get("sat_min", 0.0))) / 0.1 + (1.0 if not gl.get("sat_min") else 0.0), 0, 1)
        cv.emit[yy, xx] = x * g[:, None] * float(gl.get("strength", 1.0))
    if ms.get("tint"):
        from ..paint import rgb
        col = np.clip(col * rgb(ms["tint"])[None, None], 0, 1)
    cv.col[yy, xx] = col[yy, xx]
    if nrm is not None:
        cv.nrm[yy, xx] = nrm[yy, xx]


# ---- the family -------------------------------------------------------------------------------------------------------

def make(spec, th):
    low, sources, info = _load(spec)
    raw = spec.get("enhance") is False          # as it came, for a comparison: its own texture's pixels, fully rough, no metal,
                                                # no occlusion, no wear (the pack's look in the prop generator's studio)
    tex = int(spec.get("tex", 1024))
    mspec = spec.get("materials") or {}
    settings, layouts = {}, {}
    uniq = []
    for mi, nm in enumerate(low.mats):
        src = sources[nm]
        own = dict(mspec.get("*") or {})
        for key, val in mspec.items():                  # patterns ("*bark*": every bark of a tree) in the recipe's order
            if key != "*" and any(ch in key for ch in "*?[") and fnmatch.fnmatch((src["name"] or nm).lower(), key.lower()):
                own.update(val or {})
        own.update(mspec.get(src["name"] or "") or {})
        own.update(mspec.get(nm) or {})
        cut = src["image"] is not None and float((src["image"][..., 3] < 0.5).mean()) > 0.2
        kind = own.get("kind") or ("glass" if src["image"] is None and src["alpha"] != "OPAQUE" else
                                   "foliage" if src["alpha"] != "OPAQUE" and cut else "paint")
        ms = dict(KINDS.get(kind, KINDS["paint"]), **own)
        ms["kind"] = kind
        in01, overlap, share = _uv_shape(low, mi)
        lay = ms.get("layout") or spec.get("layout", "auto")
        if raw:
            lay = "tile" if kind == "foliage" or in01 < 0.5 or overlap >= 0.03 else "keep"   # as it came: no new UVs
        elif lay == "auto":
            # cards and textures made to repeat tile; unique UVs using most of their texture keep it; the rest (stacked
            # or mirrored islands, a corner of an atlas shared with other models) are laid out again over the whole canvas
            lay = ("tile" if kind == "foliage" or in01 < 0.5 else
                   "keep" if in01 > 0.999 and overlap < 0.03 and share >= 0.4 else "unique")
        if src["image"] is None and kind == "glass":
            lay = "keep"
        layouts[nm] = lay
        if lay == "unique":
            uniq.append(mi)
        settings[nm] = ms
    uv0 = low.uv.copy()
    src_density = {nm: _density(low, mi, max(sources[nm]["image"].shape[:2]) if sources[nm]["image"] is not None else 256)
                   for mi, nm in enumerate(low.mats)}
    if uniq:
        _unique_uvs(low, uniq)
    th.low, th.high = low, None
    th.sharp_angle = spec.get("smooth", 40) if spec.get("smooth", 40) is not False else 0
    if spec.get("weighted"):
        th.weighted = float(spec["weighted"])
    th.pose = spec.get("pose", "stand")
    lo, hi = low.v.min(0), low.v.max(0)
    diag = float(np.linalg.norm(hi - lo))
    th.ao_dist = float(np.clip(0.04 * diag, 0.01, 0.5))
    piv = spec.get("pivot", "floor")
    if piv == "keep":
        th.anchor, th.keep_z = (0.0, 0.0, 0.0), True
    elif piv == "trunk":
        z = low.v[:, 2]
        base = low.v[z < z.min() + 0.03 * (z.max() - z.min()) + 1e-6]
        th.anchor = (float(base[:, 0].mean()), float(base[:, 1].mean()), float(z.min()))
    for mi, nm in enumerate(low.mats):
        ms, src, lay = settings[nm], sources[nm], layouts[nm]
        alpha = ms.get("alpha")
        if alpha is None:
            # its own alpha cuts holes in what its UVs use (a pan's perforations, a sign's outline): a cut-out
            alpha = "clip" if src["image"] is not None and src["alpha"] != "OPAQUE" and _cut_share(low, mi, src["image"]) > 0.01 else "opaque"
            ms["alpha"] = alpha
        alpha = "clip" if alpha == "clip" else (True if alpha == "blend" else False)
        double = bool(ms.get("double", alpha == "clip" or _open_share(low, mi) > 0.02 or float(np.ptp(low.v, 0).min()) < 0.002))
        img = src["image"]
        base = tuple(float(x) for x in (img[..., :3].reshape(-1, 3).mean(0) if img is not None else _lin_to_srgb(src["factor"][:3])))
        px = int(ms.get("px", tex))
        if raw:
            ms.update(rough=1.0, metal=0.0)
        th.material(nm, ms.get("wear_kind", "paint"), px=px, alpha=alpha, double=double, color=base,
                    rough=float(ms["rough"]) if not isinstance(ms["rough"], str) else 0.6,
                    metal=float(ms["metal"]) if not isinstance(ms["metal"], str) else 0.0,
                    bake=lay != "tile" and ms["kind"] != "glass" and not raw)   # glass: no occlusion (a pane's UVs often one point)
        own_wear = dict(ms["wear"]) if isinstance(ms.get("wear"), dict) else {}
        if lay == "tile" or ms["kind"] in ("glass", "foliage") or raw:
            own_wear = {k: 0 for k in WEAR_LAYERS}                 # a repeat can't hold wear by place; glass and leaves keep clean
        th.mats[nm]["wear"] = own_wear
        th.density[nm] = max(0.05, _density(low, mi, px))
    th.record["retro"] = dict(info, layouts=layouts, kinds={n: settings[n]["kind"] for n in low.mats})

    def texel_paint(mname, cv, tx):
        mi = low.mats.index(mname)
        ms, src, lay = settings[mname], sources[mname], layouts[mname]
        hit = tx["hit"]
        img = src["image"]
        px = cv.w
        if img is None:
            cv.col[:] = _lin_to_srgb(src["factor"][:3])
            cv.opacity[:] = float(src["factor"][3]) if src["factor"][3] > 0 or raw else 1.0
            cv.used[:] = True
            hit = np.ones_like(hit)
        else:
            a = img
            if a.shape[2] == 4 and (a[..., 3] < 0.5).any():
                # the cut-out's background filled from inside first, so a resize never pulls in its colour
                a = np.concatenate([_fill(a[..., :3], a[..., 3] >= 0.5), a[..., 3:]], -1)
            if lay in ("keep", "tile"):
                big = _resize(a, px, bool(spec.get("pixel")) or raw, wrap=lay == "tile")   # a repeat resampled across its seam
                cv.col[:] = big[..., :3]
                cv.opacity[:] = big[..., 3]
                if lay == "tile":
                    hit = np.ones_like(hit)
                cv.used |= hit
            else:
                k = 2 if max(a.shape[:2]) < 1024 and not spec.get("pixel") else 1
                big = _resize(a, max(a.shape[:2]) * k, bool(spec.get("pixel"))) if k > 1 else a
                c4 = uv0.copy()
                old, h2 = _raster_corners(low, px, c4, mi)
                hit = hit | h2
                smp = _sample(big, old[..., 0], old[..., 1])
                cv.col[hit] = smp[hit][:, :3]
                cv.opacity[hit] = smp[hit][:, 3]
                cv.used |= hit
            if src["normal"] is not None and lay in ("keep", "tile"):
                n = _resize(src["normal"], px) * 2 - 1
                cv.nrm[:] = n / np.maximum(np.linalg.norm(n, axis=-1, keepdims=True), 1e-6)
        if raw:
            cv.rough[:] = 1.0
            cv.metal[:] = 0.0
            if ms.get("alpha") == "clip":
                cv.opacity[:] = np.where(cv.opacity >= 0.5, 1.0, 0.0)
            return
        if ms["kind"] == "glass":
            # a pane: its colour (the picture's, or its factor's) toward glass's own tint, see-through by its kind's
            # opacity whatever its alpha said (the pack's panes were drawn with an alpha of 0: invisible)
            from ..paint import rgb
            cv.col[:] = np.clip(cv.col * 0.4 + rgb(ms.get("tint", "#c9d6d2"))[None, None] * 0.6, 0, 1)
            cv.opacity[:] = float(ms.get("opacity", 0.18))
            cv.rough[:] = float(ms["rough"])
            cv.metal[:] = 0.0
            cv.used[:] = True
            return
        place = None
        if lay != "tile" and "rest" in tx and "tan" in tx:
            place = (tx["rest"], *_shading_frame(mi, px, tx))
        k = 1.0
        if img is not None and not spec.get("pixel"):
            if lay in ("keep", "tile"):
                k = px / max(img.shape[:2])
            else:
                k = th.density.get(mname, 1.0) / max(src_density[mname], 1e-6)
        enhance(cv, hit, ms, tx, place, th.density.get(mname, 1.0), int(spec.get("seed", 0)) + 13 * mi, k=k)
        if lay != "tile" and "rest" in tx and any((th.mats[mname].get("wear") or spec.get("wear") or {}).get(x) for x in ("edges", "scratches", "dirt")):
            tx["curv"] = _edge_mask(mi, tx, tx["hit"])           # read by the wear after this: worn corners, dirt in the creases
        if ms.get("alpha") == "clip":
            cv.opacity[:] = np.where(cv.opacity >= 0.5, 1.0, 0.0)

    corner_n = {}
    edges = {}

    def _edge_mask(mi, tx, hit):
        """Each texel's nearness to a hard edge in 3D (a corner past 35 degrees, or an open edge), +1 on a convex one
        (where paint wears through), -1 in a concave one (where dirt gathers), 0 beyond `edge_mm` (by the thing's size):
        what a bevel bake gives a detailed mesh. A low mesh's own vertex curvature spreads over whole faces (every vertex
        of a box is a corner), so the wear went over whole panels."""
        if "tree" not in edges:
            from mathutils import Vector
            from mathutils.kdtree import KDTree
            t, _, tf = low.tris()
            V = low.a["rest"]                         # the texels' places are rest places (before it was set down)
            a, b, c = V[t[:, 0]], V[t[:, 1]], V[t[:, 2]]
            fn = np.cross(b - a, c - a)
            fn /= np.maximum(np.linalg.norm(fn, axis=1, keepdims=True), 1e-12)
            ctr = (a + b + c) / 3
            e = np.concatenate([t[:, [0, 1]], t[:, [1, 2]], t[:, [2, 0]]])
            ef = np.tile(np.arange(len(t)), 3)
            key = np.sort(e, 1)
            uk, inv, cnt = np.unique(key, axis=0, return_inverse=True, return_counts=True)
            inv = inv.ravel()
            order = np.argsort(inv, kind="stable")
            starts = np.searchsorted(inv[order], np.arange(len(uk)))
            pts, sgn = [], []
            w = float(spec.get("edge_mm", np.clip(diag * 4.0, 3.0, 40.0))) / 1000.0
            step = w * 0.5
            for k, (i0, i1) in enumerate(uk):
                if cnt[k] == 1:
                    s_ = 1.0                                  # an open edge: a card's or a shell's rim, worn
                elif cnt[k] == 2:
                    f1, f2 = ef[order[starts[k]]], ef[order[starts[k] + 1]]
                    if float(fn[f1] @ fn[f2]) > math.cos(math.radians(35)):
                        continue
                    s_ = 1.0 if float(fn[f1] @ (ctr[f2] - ctr[f1])) < 0 else -1.0   # the other face falls away: convex
                else:
                    continue
                p0, p1 = V[i0], V[i1]
                n = max(1, int(np.linalg.norm(p1 - p0) / step))
                for u in np.linspace(0, 1, n + 1):
                    pts.append(p0 + (p1 - p0) * u)
                    sgn.append(s_)
            tree = KDTree(max(1, len(pts)))
            for i, p_ in enumerate(pts):
                tree.insert(Vector(p_), i)
            tree.balance()
            edges.update(tree=tree, sgn=np.asarray(sgn), w=w, n=len(pts))
        out = np.zeros(hit.shape, np.float32)
        if not edges["n"]:
            return out
        from mathutils import Vector
        yy, xx = np.nonzero(hit)
        P = tx["rest"][yy, xx]
        tree, sgn, w = edges["tree"], edges["sgn"], edges["w"]
        vals = np.zeros(len(yy), np.float32)
        for i in range(len(yy)):
            co, idx, d = tree.find(Vector(P[i]))
            if d < w:
                vals[i] = sgn[idx] * (1.0 - d / w) ** 1.5
        out[yy, xx] = vals
        return out

    def _shading_frame(mi, px, tx):
        """Each texel's normal as the mesh is shaded (its own normals kept, or split past `smooth` degrees: a wall's
        thin side face isn't leaned toward its big front by a smooth vertex normal), and the UV tangents squared
        against it: the frame a set's grain is turned into, as Godot's normal mapping reads it."""
        if "n" not in corner_n:
            if "normal" in low.a:
                cn = np.where((low.f >= 0)[..., None], low.a["normal"][np.maximum(low.f, 0)], 0.0)
            else:
                cn = np.zeros((len(low.f), 4, 3))
                ok = low.f >= 0
                cf, ck = np.nonzero(ok)
                cn[cf, ck] = M.weighted_normals(low, max(float(th.sharp_angle or 0), 0.01))
            corner_n["n"] = cn
        n, _ = _raster_corners(low, px, corner_n["n"], mi)
        n /= np.maximum(np.linalg.norm(n, axis=-1, keepdims=True), 1e-9)
        T, B = tx["tan"], tx["bit"]
        T = T - n * (T * n).sum(-1, keepdims=True)
        T /= np.maximum(np.linalg.norm(T, axis=-1, keepdims=True), 1e-9)
        hand = np.sign((np.cross(n, T) * B).sum(-1, keepdims=True))
        hand[hand == 0] = 1
        B = np.cross(n, T) * hand
        return n, T, B

    def after_wear(mname, cv):
        """No texel left black after the dirt (the bar's darkest is 0.06: dirt in a crease is dark, not black)."""
        ms = settings[mname]
        if raw or ms["kind"] == "glass":
            return
        fl = min(float(ms.get("floor", 0.04)), 0.035)
        cv.col[cv.used] = _soft_floor(cv.col[cv.used][None], fl)[0]

    th.paint = lambda fr: None
    th.after_wear = after_wear
    th.texel_paint = texel_paint
    th.view = spec.get("view") or {"azim": -35, "elev": 22 if diag > 3 else 28}
    return th
