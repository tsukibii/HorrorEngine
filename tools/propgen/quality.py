"""How good a prop is, measured (docs/PROPGEN.md §29): any .glb read with numpy and Pillow alone (no Blender), its game
mesh's geometry and each material's maps, so the made props and a mesh from anywhere else (the retro pack) are held to
one bar.

    measure(path)            {geometry, materials: [...]} for one .glb (its LOD0 only, when it carries LODs)
    reference(names)         the bar: the measures of the best made props (Saved/Props/<name>/<name>.glb), each
                             measure's range over their materials, written to Content/Studio/Props/quality_reference.json
    against(m, ref)          what a measured prop lacks against the bar: [(measure, its value, the bar's range, note)]
    verdict(m, budget)       a mesh's geometry good enough or not: (ok, [reasons]), the retro pack's audit

Geometry: triangles, size (story metres, z up), surface, degenerate and flipped faces, open and non-manifold edges, the
facets (the angle between neighbouring faces where a surface is meant to be smooth: a low-poly cylinder's sides), how
it's shaded (flat: every face its own normals; smooth). Each material: the textures it has (base colour, ORM, normal,
emission), its texel density (pixels a metre on the thing), its UVs (in 0-1 or tiled, overlapping, how much of the
texture they use), and over the texels it uses: the base colour's lightness, its range and saturation, its fine detail
(what a blur of two texels takes away), roughness and its spread, metalness, the occlusion and the normal map's relief
(how far it tilts from flat)."""
import io
import json
import math
import os
import re
import struct

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
REFERENCE = os.path.join(ROOT, "Content", "Studio", "Props", "quality_reference.json")

CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}
LOD = re.compile(r"lod[_\s.-]?(\d+)", re.I)


# ---- reading a glb ---------------------------------------------------------------------------------------------------

def _chunks(path):
    with open(path, "rb") as fh:
        b = fh.read()
    magic, _, ln = struct.unpack_from("<III", b, 0)
    if magic != 0x46546C67:
        raise ValueError(f"{path}: not a .glb")
    off, js, binc = 12, None, b""
    while off < ln:
        cl, ctype = struct.unpack_from("<II", b, off)
        if ctype == 0x4E4F534A:
            js = json.loads(b[off + 8: off + 8 + cl])
        elif ctype == 0x004E4942:
            binc = b[off + 8: off + 8 + cl]
        off += 8 + cl
    return js, binc


def _accessor(js, binc, i):
    a = js["accessors"][i]
    dt, n = CT[a["componentType"]], NC[a["type"]]
    if "bufferView" not in a:
        return np.zeros((a["count"], n))
    bv = js["bufferViews"][a["bufferView"]]
    start = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    item = np.dtype(dt).itemsize * n
    stride = bv.get("byteStride") or item
    raw = np.frombuffer(binc, np.uint8, count=stride * (a["count"] - 1) + item, offset=start)
    if stride != item:
        raw = np.lib.stride_tricks.as_strided(raw, (a["count"], item), (stride, 1)).copy()
    arr = np.frombuffer(raw.tobytes(), dt).reshape(a["count"], n)
    out = arr.astype(np.float64)
    if a.get("normalized") and dt != np.float32:
        out = out / float(np.iinfo(dt).max)
    return out


def _local(nd):
    if "matrix" in nd:
        return np.array(nd["matrix"], float).reshape(4, 4).T
    x, y, z, w = nd.get("rotation", [0, 0, 0, 1])
    R = np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                  [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                  [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
    M = np.eye(4)
    M[:3, :3] = R * np.asarray(nd.get("scale", [1, 1, 1]), float)[None]
    M[:3, 3] = nd.get("translation", [0, 0, 0])
    return M


def decode(data, mime=""):
    """An image file's bytes as RGBA floats 0-1 (rows top first, the file's own values: sRGB as stored): by Pillow when
    it's there, else by Blender (inside it, where the prop generator runs)."""
    try:
        from PIL import Image
    except ImportError:
        Image = None
    if Image is not None:
        return np.asarray(Image.open(io.BytesIO(data)).convert("RGBA"), np.float32) / 255.0
    import tempfile
    import bpy
    ext = ".jpg" if "jpeg" in mime or data[:3] == b"\xff\xd8\xff" else ".png"
    fd, tmp = tempfile.mkstemp(suffix=ext)
    with os.fdopen(fd, "wb") as fh:
        fh.write(data)
    try:
        im = bpy.data.images.load(tmp, check_existing=False)
        im.colorspace_settings.name = "Non-Color"          # its own values, a 16-bit PNG too (docs/LESSONS.md 2026-11-08)
        w, h = im.size
        px = np.zeros(w * h * 4, np.float32)
        im.pixels.foreach_get(px)
        bpy.data.images.remove(im)
    finally:
        os.remove(tmp)
    return px.reshape(h, w, 4)[::-1].copy()


def lod_of(name):
    """A node's level of detail from its name (`A_LOD1`, `pole_wood_a_lod_2`), None when it says none; a billboard is
    a far LOD whatever it says."""
    if name and "billboard" in name.lower():
        return 99
    m = LOD.search(name or "")
    return int(m.group(1)) if m else None


def read(path, lod=0, nodes=None):
    """The .glb as {js, prims: [{node, mesh, mat, P, N, UV, T}], image: i -> RGBA floats}, positions and normals in the
    scene's space (glTF: y up). `lod`: the level of detail kept where its nodes are named by one (0: the nearest), None
    for every node. `nodes`: only the nodes so named (a name or a list; a node under one counts as it), as a pack's
    file of several pieces is taken apart."""
    js, binc = _chunks(path)
    nodes_ = js.get("nodes", [])
    W = {}

    want = [nodes] if isinstance(nodes, str) else list(nodes or [])
    picked = {}

    def walk(i, P, inherited, under=False):
        M = P @ _local(nodes_[i])
        # the mesh's own name first (a pack whose node LOD0 holds the billboard named LOD1 is believed by its mesh)
        own = lod_of(js["meshes"][nodes_[i]["mesh"]].get("name")) if "mesh" in nodes_[i] else None
        own = own if own is not None else lod_of(nodes_[i].get("name"))
        W[i] = (M, own if own is not None else inherited)
        picked[i] = under or not want or nodes_[i].get("name") in want
        for c in nodes_[i].get("children", []):
            walk(c, M, W[i][1], picked[i] and bool(want))

    sc = js.get("scenes", [{}])[js.get("scene", 0)] if js.get("scenes") else {"nodes": list(range(len(nodes_)))}
    for r in sc.get("nodes", []):
        walk(r, np.eye(4), None)
    if want and not any(picked[i] for i in picked if "mesh" in nodes_[i]):
        raise ValueError(f"{path}: no node named {', '.join(want)} ({', '.join(n.get('name', '?') for n in nodes_)})")
    levels = sorted({lv for _, lv in W.values() if lv is not None})
    keep_lv = None if lod is None or not levels else (lod if lod in levels else levels[0])
    prims = []
    for ni, (M, lv) in W.items():
        nd = nodes_[ni]
        if "mesh" not in nd or not picked[ni]:
            continue
        me = js["meshes"][nd["mesh"]]
        if keep_lv is not None and lv is not None and lv != keep_lv:
            continue
        if keep_lv is not None and lv is None and "billboard" in (me.get("name") or "").lower():
            continue
        for pr in me["primitives"]:
            if pr.get("mode", 4) != 4:
                continue
            at = pr["attributes"]
            P = _accessor(js, binc, at["POSITION"])
            P = (np.c_[P, np.ones(len(P))] @ M.T)[:, :3]
            N = None
            if "NORMAL" in at:
                N = _accessor(js, binc, at["NORMAL"]) @ np.linalg.inv(M[:3, :3])
                N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-20)
            UV = _accessor(js, binc, at["TEXCOORD_0"]) if "TEXCOORD_0" in at else None
            I = _accessor(js, binc, pr["indices"]).astype(np.int64).ravel() if "indices" in pr else np.arange(len(P))
            if np.linalg.det(M[:3, :3]) < 0:                       # a mirrored node: its winding turns over
                I = I.reshape(-1, 3)[:, ::-1].ravel()
            prims.append({"node": nd.get("name"), "mesh": me.get("name"), "mat": pr.get("material"), "P": P, "N": N, "UV": UV,
                          "T": I.reshape(-1, 3)})
    images = {}

    def image(i):
        if i in images:
            return images[i]
        im = js["images"][i]
        data = None
        if "bufferView" in im:
            bv = js["bufferViews"][im["bufferView"]]
            data = binc[bv.get("byteOffset", 0): bv.get("byteOffset", 0) + bv["byteLength"]]
        elif im.get("uri") and not im["uri"].startswith("data:"):
            with open(os.path.join(os.path.dirname(path), im["uri"]), "rb") as fh:
                data = fh.read()
        images[i] = decode(data, im.get("mimeType", "")) if data else None
        return images[i]

    return {"js": js, "prims": prims, "image": image, "levels": levels, "lod": keep_lv}


def texture(G, ref):
    """(RGBA floats (h, w, 4), sampler) of a material's texture reference ({index, texCoord}), or (None, {})."""
    if not ref:
        return None, {}
    js = G["js"]
    t = js["textures"][ref["index"]]
    src = t.get("source")
    if src is None:
        for e in (t.get("extensions") or {}).values():
            src = e.get("source", src)
    smp = js.get("samplers", [])[t["sampler"]] if "sampler" in t else {}
    return (G["image"](src) if src is not None else None), smp


# ---- geometry --------------------------------------------------------------------------------------------------------

def _zup(P):
    """glTF's y-up as the story's z-up (x, -z, y)."""
    return np.stack([P[:, 0], -P[:, 2], P[:, 1]], 1)


def geometry(G):
    prims = G["prims"]
    if not prims:
        return {"tris": 0, "verts": 0}
    P = np.concatenate([p["P"] for p in prims])
    offs = np.cumsum([0] + [len(p["P"]) for p in prims])[:-1]
    T = np.concatenate([p["T"] + o for p, o in zip(prims, offs)])
    hasN = all(p["N"] is not None for p in prims)
    N = np.concatenate([p["N"] for p in prims]) if hasN else None
    a, b, c = P[T[:, 0]], P[T[:, 1]], P[T[:, 2]]
    cr = np.cross(b - a, c - a)
    area = np.linalg.norm(cr, axis=1) / 2
    fn = cr / np.maximum(2 * area[:, None], 1e-20)
    lo, hi = P.min(0), P.max(0)
    size = _zup((hi - lo)[None])[0] * np.array([1, -1, 1])
    out = {"tris": int(len(T)), "verts": int(len(P)), "size_m": [round(float(x), 4) for x in np.abs(size)],
           "diag_m": round(float(np.linalg.norm(hi - lo)), 4), "area_m2": round(float(area.sum()), 4)}
    # the floor and the middle: where it stands (a prop sits on z = 0, its middle over the origin)
    zl = _zup(P)
    out["base"] = [round(float((zl[:, 0].min() + zl[:, 0].max()) / 2), 3), round(float((zl[:, 1].min() + zl[:, 1].max()) / 2), 3),
                   round(float(zl[:, 2].min()), 3)]
    degen = area < max(1e-10, float(np.median(area)) * 1e-4)
    out["degenerate"] = int(degen.sum())
    # welded positions (to 0.05 mm), so a mesh split for flat shading or its UV seams still counts its edges right
    key = np.round(P / 5e-5).astype(np.int64)
    _, inv = np.unique(key, axis=0, return_inverse=True)
    inv = inv.ravel()
    out["split_ratio"] = round(len(P) / max(1, int(inv.max()) + 1), 2)
    tw = inv[T]
    ok = ~degen & (tw[:, 0] != tw[:, 1]) & (tw[:, 1] != tw[:, 2]) & (tw[:, 2] != tw[:, 0])
    fi = np.nonzero(ok)[0]
    e = np.concatenate([tw[fi][:, [0, 1]], tw[fi][:, [1, 2]], tw[fi][:, [2, 0]]])
    ef = np.concatenate([fi, fi, fi])
    es = np.sort(e, 1)
    uk, inv_e, cnt = np.unique(es, axis=0, return_inverse=True, return_counts=True)
    inv_e = inv_e.ravel()
    out["edges"] = int(len(uk))
    out["open_edges"] = int((cnt == 1).sum())
    out["nonmanifold_edges"] = int((cnt > 2).sum())
    # facets: the angle between the two faces of each manifold edge, area-weighted, over edges under 60 degrees (the
    # surface meant to be smooth; a box's corners are meant to be hard and left out)
    two = np.nonzero(cnt == 2)[0]
    if len(two):
        order = np.argsort(inv_e, kind="stable")
        starts = np.searchsorted(inv_e[order], two)
        f1, f2 = ef[order[starts]], ef[order[starts + 1]]
        cosang = np.clip((fn[f1] * fn[f2]).sum(1), -1, 1)
        ang = np.degrees(np.arccos(cosang))
        w = (area[f1] + area[f2])
        soft = (ang > 0.5) & (ang < 60)
        if soft.any():
            o = np.argsort(ang[soft])
            cw = np.cumsum(w[soft][o]) / w[soft].sum()
            out["facet_deg_med"] = round(float(ang[soft][o][np.searchsorted(cw, 0.5)]), 2)
            out["facet_deg_p90"] = round(float(ang[soft][o][min(len(o) - 1, np.searchsorted(cw, 0.9))]), 2)
        else:
            out["facet_deg_med"] = out["facet_deg_p90"] = 0.0
        out["hard_edges"] = int((ang >= 60).sum())
    if hasN:
        # shading: how far each corner's normal sits from its face's (0: flat faces), and the ones turned over
        dots = np.stack([(N[T[:, k]] * fn).sum(1) for k in range(3)], 1)[ok]
        ang = np.degrees(np.arccos(np.clip(dots, -1, 1)))
        out["shade_deg_med"] = round(float(np.median(ang)), 2) if ang.size else 0.0
        out["flipped"] = int((ang > 100).any(1).sum())
        out["shading"] = "flat" if out["shade_deg_med"] < 0.5 else "smooth"
    return out


# ---- UVs and the texels a material uses -------------------------------------------------------------------------------

def coverage(tris_uv, px, wrap=True):
    """(px, px) int: how many triangles cover each texel's centre. UVs as glTF has them (v runs down the image: row
    v * px, as the image's rows top first). Tiled UVs wrap."""
    cnt = np.zeros((px, px), np.int32)
    for tri in tris_uv:
        uv = tri.copy()
        if wrap:
            uv -= np.floor(uv.min(0))
            if (uv.max(0) > 1.0).any() and (uv.max(0) - uv.min(0) >= 1.0).any():
                cnt += 1                                            # spans a whole repeat: every texel
                continue
        P = np.stack([uv[:, 0] * px - 0.5, uv[:, 1] * px - 0.5], -1)
        shifts = [(0, 0)]
        if wrap:
            shifts = [(dx, dy) for dx in ((0, -px) if P[:, 0].max() >= px - 0.5 else (0,))
                      for dy in ((0, -px) if P[:, 1].max() >= px - 0.5 else (0,))]
        for dx, dy in shifts:
            Q = P + np.array([dx, dy])
            x0, y0 = np.floor(Q.min(0)).astype(int)
            x1, y1 = np.ceil(Q.max(0)).astype(int)
            x0, y0 = max(x0, 0), max(y0, 0)
            x1, y1 = min(x1, px - 1), min(y1, px - 1)
            if x1 < x0 or y1 < y0:
                continue
            X, Y = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
            (ax, ay), (bx, by), (cx, cy) = Q
            d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
            if abs(d) < 1e-12:
                continue
            w0 = ((by - cy) * (X - cx) + (cx - bx) * (Y - cy)) / d
            w1 = ((cy - ay) * (X - cx) + (ax - cx) * (Y - cy)) / d
            ins = (w0 >= 0) & (w1 >= 0) & (1 - w0 - w1 >= 0)
            cnt[Y[ins], X[ins]] += 1
    return cnt


def _mat_tris(G, mi):
    """A material's triangles: positions (k, 3, 3) and UVs (k, 3, 2) (None without UVs)."""
    Ps, UVs = [], []
    for p in G["prims"]:
        if p["mat"] != mi:
            continue
        Ps.append(p["P"][p["T"]])
        UVs.append(p["UV"][p["T"]] if p["UV"] is not None else None)
    if not Ps:
        return None, None
    P = np.concatenate(Ps)
    UV = np.concatenate(UVs) if all(u is not None for u in UVs) else None
    return P, UV


def uv_measures(P, UV, tex_px):
    """Texel density (pixels a metre, the area-weighted median over its triangles), its UVs in 0-1 or tiled, the share
    of used texels covered more than once (stacked or mirrored islands), the share of the texture used."""
    area = np.linalg.norm(np.cross(P[:, 1] - P[:, 0], P[:, 2] - P[:, 0]), axis=1) / 2
    d1, d2 = UV[:, 1] - UV[:, 0], UV[:, 2] - UV[:, 0]
    uva = np.abs(d1[:, 0] * d2[:, 1] - d1[:, 1] * d2[:, 0]) / 2
    ok = (uva > 1e-12) & (area > 1e-12)
    out = {"uv_in01": round(float(((UV >= -0.001) & (UV <= 1.001)).all(-1).all(-1).mean()), 3),
           "uv_zero_area": round(float((uva <= 1e-12).mean()), 3)}
    if ok.any():
        r = np.sqrt(uva[ok] / area[ok]) * tex_px                     # pixels a metre on each triangle
        o = np.argsort(r)
        cw = np.cumsum(area[ok][o]) / area[ok].sum()
        out["px_per_m"] = round(float(r[o][np.searchsorted(cw, 0.5)]), 1)
        out["px_per_m_p10"] = round(float(r[o][np.searchsorted(cw, 0.1)]), 1)
    g = int(min(256, tex_px))
    cnt = coverage(UV, g, wrap=out["uv_in01"] < 0.999)
    used = cnt > 0
    out["uv_used"] = round(float(used.mean()), 3)
    out["uv_overlap"] = round(float((cnt > 1).sum() / max(1, used.sum())), 3)
    return out, cnt


def _arr(im, mode="RGBA"):
    return im[..., :3] if mode == "RGB" else im


def _resample(a, px):
    """An image array to px x px (nearest: what the texels hold)."""
    h, w = a.shape[:2]
    ys = np.clip(((np.arange(px) + 0.5) * h / px).astype(int), 0, h - 1)
    xs = np.clip(((np.arange(px) + 0.5) * w / px).astype(int), 0, w - 1)
    return a[ys][:, xs]


def _erode(mask):
    """A mask shrunk by a texel on every side (what's left is inside the islands, off their bled edges)."""
    m = mask.copy()
    m[1:] &= mask[:-1]
    m[:-1] &= mask[1:]
    m[:, 1:] &= mask[:, :-1]
    m[:, :-1] &= mask[:, 1:]
    return m


def _blur(a, r=2):
    """A box blur of radius r texels, twice (close to a Gaussian), wrapping."""
    for _ in range(2):
        acc = np.zeros_like(a)
        for d in range(-r, r + 1):
            acc += np.roll(a, d, 0)
        a = acc / (2 * r + 1)
        acc = np.zeros_like(a)
        for d in range(-r, r + 1):
            acc += np.roll(a, d, 1)
        a = acc / (2 * r + 1)
    return a


def material_measures(G, mi):
    js = G["js"]
    m = js["materials"][mi] if mi is not None and mi < len(js.get("materials", [])) else {}
    pb = m.get("pbrMetallicRoughness", {})
    out = {"name": m.get("name", "(none)"), "alpha": m.get("alphaMode", "OPAQUE"), "double_sided": bool(m.get("doubleSided", False))}
    bc, smp = texture(G, pb.get("baseColorTexture"))
    mr, _ = texture(G, pb.get("metallicRoughnessTexture"))
    oc, _ = texture(G, m.get("occlusionTexture"))
    nm, _ = texture(G, m.get("normalTexture"))
    em, _ = texture(G, m.get("emissiveTexture"))
    out["maps"] = [k for k, v in (("base", bc), ("orm" if mr is not None and oc is not None and mr is oc else "mr", mr),
                                  ("occlusion", oc if oc is not mr else None), ("normal", nm), ("emission", em)) if v is not None]
    out["filter"] = {9728: "nearest", 9729: "linear"}.get(smp.get("magFilter"), "linear")
    out["tex_px"] = [int(bc.shape[1]), int(bc.shape[0])] if bc is not None else None
    P, UV = _mat_tris(G, mi)
    if P is None:
        return out
    tex = max(bc.shape[:2]) if bc is not None else 1024
    used = cnt = None
    if UV is not None:
        um, cnt = uv_measures(P, UV, tex)
        out.update(um)
        used = cnt > 0
    # the texels it uses, each map sampled at one grid
    g = used.shape[0] if used is not None else 256
    if used is None or not used.any():
        used = np.ones((g, g), bool)
    bcf = np.asarray(pb.get("baseColorFactor", [1, 1, 1, 1]), np.float32)
    col = (_resample(_arr(bc), g) if bc is not None else np.ones((g, g, 4), np.float32)) * bcf[None, None]
    srgb_f = np.where(bcf[:3] <= 0.0031308, bcf[:3] * 12.92, 1.055 * np.power(np.maximum(bcf[:3], 0), 1 / 2.4) - 0.055)
    if bc is None:
        col[..., :3] = srgb_f                                         # a factor alone: its colour (sRGB) everywhere
    rgb = col[..., :3]
    if m.get("alphaMode") in ("MASK", "BLEND"):
        cut = float(m.get("alphaCutoff", 0.5)) if m.get("alphaMode") == "MASK" else 0.05
        used = used & (col[..., 3] >= cut)
        out["alpha_cut"] = round(float(1 - used.sum() / max(1, (cnt > 0).sum() if cnt is not None else used.size)), 3)
    if not used.any():
        return out
    x = rgb[used]
    lin = np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)
    Y = lin @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    L = np.where(Y <= 0.0031308, Y * 12.92, 1.055 * np.power(Y, 1 / 2.4) - 0.055)   # lightness, back on sRGB's scale
    mx, mn = x.max(1), x.min(1)
    out["albedo"] = {"mean": round(float(L.mean()), 3), "p2": round(float(np.percentile(L, 2)), 3), "p98": round(float(np.percentile(L, 98)), 3),
                     "sat": round(float(np.mean((mx - mn) / np.maximum(mx, 1e-6))), 3),
                     "black": round(float((mx < 0.035).mean()), 4), "white": round(float((mn > 0.96).mean()), 4)}
    # fine detail: what a blur of two texels (at the texture's own size, up to 1024) takes away, inside its islands
    gd = int(min(1024, tex))
    full = _resample(_arr(bc, "RGB"), gd) if bc is not None else np.zeros((gd, gd, 3), np.float32)
    Lf = full @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    hp = np.abs(Lf - _blur(Lf, 2))
    um = _resample(_erode(used).astype(np.float32)[..., None], gd)[..., 0] > 0.5           # off the islands' edges
    out["albedo"]["detail"] = round(float(hp[um].mean()), 4) if um.any() else 0.0
    rf, mf = float(pb.get("roughnessFactor", 1.0)), float(pb.get("metallicFactor", 1.0))
    if mr is not None:
        a = _resample(_arr(mr, "RGB"), g)
        r, mt = a[..., 1][used] * rf, a[..., 2][used] * mf
    else:
        r, mt = np.full(used.sum(), rf, np.float32), np.full(used.sum(), mf, np.float32)
    out["rough"] = {"mean": round(float(r.mean()), 3), "std": round(float(r.std()), 3), "p5": round(float(np.percentile(r, 5)), 3),
                    "p95": round(float(np.percentile(r, 95)), 3)}
    out["metal"] = {"mean": round(float(mt.mean()), 3), "between": round(float(((mt > 0.1) & (mt < 0.9)).mean()), 3)}
    if oc is not None:
        o = _resample(_arr(oc, "RGB"), g)[..., 0][used] * float((m.get("occlusionTexture") or {}).get("strength", 1.0))
        out["ao"] = {"mean": round(float(o.mean()), 3), "p5": round(float(np.percentile(o, 5)), 3)}
    else:
        out["ao"] = {"mean": 1.0, "p5": 1.0}
    if nm is not None:
        n = _resample(_arr(nm, "RGB"), g)[used] * 2 - 1
        n[:, :2] *= float((m.get("normalTexture") or {}).get("scale", 1.0))
        n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)
        tilt = np.degrees(np.arccos(np.clip(n[:, 2], -1, 1)))
        out["normal"] = {"tilt_mean": round(float(tilt.mean()), 2), "tilt_p95": round(float(np.percentile(tilt, 95)), 2),
                         "flat": round(float((tilt < 1.0).mean()), 3)}
    else:
        out["normal"] = {"tilt_mean": 0.0, "tilt_p95": 0.0, "flat": 1.0}
    return out


def measure(path, lod=0, nodes=None):
    """Every measure of one .glb (its nearest LOD when its nodes are named by LODs; `nodes` only those)."""
    G = read(path, lod, nodes)
    mats = sorted({p["mat"] for p in G["prims"]}, key=lambda x: -1 if x is None else x)
    return {"file": os.path.relpath(path, ROOT) if os.path.isabs(path) else path, "levels": G["levels"], "lod": G["lod"],
            "geometry": geometry(G), "materials": [material_measures(G, mi) for mi in mats]}


# ---- the bar ---------------------------------------------------------------------------------------------------------

# the measures the bar keeps, each (its path in a material's measures, what it says)
BAR = [
    ("px_per_m", "texel density: pixels a metre on the thing"),
    ("albedo.mean", "base colour lightness (sRGB 0-1)"),
    ("albedo.p2", "base colour's darkest (2nd percentile)"),
    ("albedo.p98", "base colour's lightest (98th percentile)"),
    ("albedo.sat", "base colour saturation"),
    ("albedo.detail", "fine detail in the base colour (what a 2-texel blur takes away)"),
    ("rough.mean", "roughness"),
    ("rough.std", "roughness spread over the surface"),
    ("ao.mean", "baked occlusion (1: none)"),
    ("ao.p5", "the deepest occlusion (5th percentile)"),
    ("normal.tilt_mean", "normal map relief: mean tilt from flat (degrees)"),
    ("normal.flat", "share of texels the normal map leaves flat"),
]


def _get(d, path):
    for k in path.split("."):
        if not isinstance(d, dict) or k not in d:
            return None
        d = d[k]
    return d


def reference(names, out_dir=None, write=True):
    """The bar from the best made props: each measure's range over their materials (the 10th to the 90th percentile,
    and the extremes), the maps every one has, geometry's numbers beside them."""
    out_dir = out_dir or os.path.join(ROOT, "Saved", "Props")
    props, missing = {}, []
    for n in names:
        p = os.path.join(out_dir, n, n + ".glb")
        if not os.path.exists(p):
            missing.append(n)
            continue
        props[n] = measure(p)
    if missing:
        raise SystemExit(f"quality reference: not made yet: {', '.join(missing)} (python tools/propgen.py make {' '.join(missing)})")
    mats = [(n, m) for n, r in props.items() for m in r["materials"] if m.get("maps")]
    bar = {}
    for key, what in BAR:
        vals = np.array([v for _, m in mats if (v := _get(m, key)) is not None], float)
        if not len(vals):
            continue
        bar[key] = {"what": what, "p10": round(float(np.percentile(vals, 10)), 4), "p90": round(float(np.percentile(vals, 90)), 4),
                    "min": round(float(vals.min()), 4), "max": round(float(vals.max()), 4), "median": round(float(np.median(vals)), 4)}
    maps = sorted(set.intersection(*[set(m["maps"]) for _, m in mats])) if mats else []
    ref = {"_note": "The quality bar (docs/PROPGEN.md §29): the best made props measured by tools/propgen/quality.py; "
                    "python tools/propgen.py quality reference makes it again.",
           "props": names, "maps": maps, "bar": bar,
           "alpha": sorted({m["alpha"] for _, m in mats}),
           "per_prop": {n: {"geometry": r["geometry"], "materials": r["materials"]} for n, r in props.items()}}
    if write:
        with open(REFERENCE, "w", encoding="utf-8") as fh:
            json.dump(ref, fh, indent=1)
    return ref


def load_reference():
    with open(REFERENCE, encoding="utf-8") as fh:
        return json.load(fh)


def against(meas, ref=None):
    """What one measured prop's materials lack against the bar: [(material, measure, value, [p10, p90], note)]; a
    material without a texture's maps the bar's props all have is listed first. Cut-outs (leaves, grass) are left out of
    the occlusion and colour range (their texels are cards seen against the sky)."""
    ref = ref or load_reference()
    gaps = []
    for m in meas["materials"]:
        miss = [k for k in ref["maps"] if k not in m.get("maps", []) and not (k == "orm" and "mr" in m.get("maps", []))]
        if miss:
            gaps.append((m["name"], "maps", m.get("maps", []), ref["maps"], "missing " + ", ".join(miss)))
        for key, b in ref["bar"].items():
            v = _get(m, key)
            if v is None:
                continue
            lo, hi = b["p10"], b["p90"]
            if key.startswith("ao") and m.get("alpha") != "OPAQUE":
                continue
            if v < lo - 1e-9:
                gaps.append((m["name"], key, v, [lo, hi], "under the bar"))
            elif v > hi + 1e-9:
                gaps.append((m["name"], key, v, [lo, hi], "over the bar"))
    return gaps


REFERENCE_PROPS = ["soda_can_crushed", "coffee_can", "trash_bag", "saucepan", "frying_pan", "rice_cooker_retro", "candle_votive",
                   "table_farmhouse", "suitcase_softside", "hokora", "rock_boulder", "rock_mossy", "cedar_real", "zelkova_real",
                   "hakone_grass"]
REVIEW = os.path.join(ROOT, "Content", "Studio", "Props", "retro_review.json")
AUDIT = os.path.join(ROOT, "Content", "Studio", "Props", "retro_audit.json")


def budget(diag):
    """The triangles a low-poly (PSX-era) thing of that size may have: a hand prop 2000, a chair's size 3500, a car's
    6000, a house's or a pole's 8000, a tree's 10000."""
    return 2000 if diag < 0.6 else 3500 if diag < 2 else 6000 if diag < 6 else 8000 if diag < 20 else 10000


def verdict(meas, review=None):
    """Is a mesh good enough to enhance (the retro pack's audit, docs/PROPGEN.md §29)? (ok, [why not], [notes]).
    Fails: no triangles, a textured material without UVs or with most of its UV triangles collapsed (the picture can't
    be laid on it), more than 5% of its faces degenerate, or the hand review's word (a decal pretending to be a model).
    Notes, not failures: over its triangle budget (a lower LOD of the pack's is taken when it has one), faces wound
    against their own normals (wound back by them), coarse facets on a smooth-shaded mesh (smoothed by angle), open
    edges (a card or a shell: drawn from both sides)."""
    geo = meas["geometry"]
    why, notes = [], []
    t = max(1, geo.get("tris", 0))
    if geo.get("tris", 0) == 0:
        return False, ["no triangles"], notes
    for m in meas["materials"]:
        if "base" not in (m.get("maps") or []):
            continue                                        # a colour alone (a door's glass): its UVs don't matter
        if "uv_in01" not in m:
            why.append(f"{m['name']}: a texture and no UVs")
        elif m.get("uv_zero_area", 0) > 0.5:
            why.append(f"{m['name']}: {100 * m['uv_zero_area']:.0f}% of its UV triangles collapsed")
    if geo.get("degenerate", 0) / t > 0.05:
        why.append(f"{geo['degenerate']} degenerate triangles ({100 * geo['degenerate'] / t:.1f}%)")
    if review:
        why.append(review)
    b = budget(geo.get("diag_m", 1.0))
    if geo["tris"] > b:
        notes.append(f"{geo['tris']} triangles, over a low-poly budget of {b} for its size")
    if geo.get("flipped"):
        notes.append(f"{geo['flipped']} faces wound against their own normals ({100 * geo['flipped'] / t:.1f}%): wound back")
    if geo.get("shading") == "smooth" and geo.get("facet_deg_med", 0) > 46:
        notes.append(f"smooth-shaded over {geo['facet_deg_med']:.0f}-degree facets: smoothed by angle instead")
    if geo.get("open_edges"):
        notes.append(f"{geo['open_edges']} open edges (cards or a shell): drawn from both sides")
    return not why, why, notes


def _rel(path):
    return os.path.relpath(path, ROOT).replace(os.sep, "/")


def audit(folder="retro", presets=None, out=AUDIT, log=print):
    """Every .glb under `folder` measured and judged (verdict), the lower LOD files of the pack's beside their LOD0
    (`_lod_1`: taken instead when LOD0 is over budget), the recipes made from each, and the hand review's fails and
    notes (Content/Studio/Props/retro_review.json: {"fail": {file: why}, "notes": {file: note}}); written to `out`."""
    from . import recipes
    root = folder if os.path.isabs(folder) else os.path.join(ROOT, folder)
    review = {}
    if os.path.exists(REVIEW):
        with open(REVIEW, encoding="utf-8") as fh:
            review = json.load(fh)
    book = recipes.load(presets) if presets or os.path.exists(recipes.PRESETS) else {}
    used = {}
    for n in book:
        try:
            sp = recipes.resolve(book, n)
        except SystemExit:
            continue
        if sp.get("family") == "retro" and sp.get("file"):
            used.setdefault(sp["file"].replace("\\", "/"), []).append(n)
    files = sorted(os.path.join(d, f) for d, _, fs in os.walk(root) for f in fs if f.lower().endswith(".glb"))
    rows = []
    for f in files:
        rel = _rel(f)
        lod_m = re.search(r"_lod_(\d+)\.glb$", rel, re.I)
        if lod_m and lod_m.group(1) != "0":
            continue                                        # a lower LOD file: judged beside its LOD0
        m = measure(f)
        ok, why, notes = verdict(m, (review.get("fail") or {}).get(rel))
        row = {"file": rel, "verdict": "pass" if ok else "fail", "why": why, "notes": notes, "use": rel,
               "tris": m["geometry"]["tris"], "size_m": m["geometry"]["size_m"], "levels": m["levels"],
               "materials": [{k: x.get(k) for k in ("name", "maps", "tex_px", "alpha", "px_per_m", "uv_overlap", "uv_in01")} for x in m["materials"]],
               "gaps": len(against(m)) if os.path.exists(REFERENCE) else None}
        if (review.get("notes") or {}).get(rel):
            row["notes"].append(review["notes"][rel])
        if lod_m and m["geometry"]["tris"] > budget(m["geometry"]["diag_m"]):
            for k in (1, 2):
                alt = re.sub(r"_lod_0\.glb$", f"_lod_{k}.glb", f, flags=re.I)
                if os.path.exists(alt):
                    g2 = measure(alt)["geometry"]
                    if g2["tris"] <= budget(g2["diag_m"]):
                        row["use"] = _rel(alt)
                        row["notes"].append(f"its LOD{k} taken instead: {g2['tris']} triangles")
                        break
        pieces = [r for r in used if r in (rel, row["use"])]
        row["recipes"] = sorted(n for r in pieces for n in used[r])
        # what each recipe made of it measures now, against the bar (Saved/Props/<recipe>/<recipe>.glb, where made)
        if os.path.exists(REFERENCE):
            for n in row["recipes"]:
                mg = os.path.join(recipes.OUT, n, n + ".glb")
                if os.path.exists(mg):
                    mm = measure(mg)
                    row.setdefault("after", {})[n] = {"gaps": [list(g[:2]) + [g[4]] for g in against(mm)], "tris": mm["geometry"]["tris"],
                                                      "materials": [{k: x.get(k) for k in ("name", "maps", "tex_px", "alpha", "px_per_m")} for x in mm["materials"]]}
        rows.append(row)
        log(f"  {row['verdict']:4s} {rel[len(_rel(root)) + 1:]:60s} {row['tris']:6d} tris  {', '.join(row['recipes']) or '-'}")
    res = {"_note": "The retro pack judged (docs/PROPGEN.md §29): python tools/propgen.py quality audit makes it again.",
           "folder": _rel(root), "passed": sum(r["verdict"] == "pass" for r in rows), "failed": sum(r["verdict"] == "fail" for r in rows),
           "files": rows}
    if out:
        with open(out, "w", encoding="utf-8") as fh:
            json.dump(res, fh, indent=1)
    return res


def made_against(names, out_dir=None, log=print):
    """Made props measured against the bar: each material's gaps."""
    out_dir = out_dir or os.path.join(ROOT, "Saved", "Props")
    ref = load_reference()
    res = {}
    for n in names:
        p = os.path.join(out_dir, n, n + ".glb")
        if not os.path.exists(p):
            log(f"  {n}: not made")
            continue
        m = measure(p)
        gaps = against(m, ref)
        res[n] = {"measure": m, "gaps": gaps}
        log(f"  {n}: {len(gaps)} gaps" + "".join(f"\n      {g[0]}: {g[1]} {g[2]} (bar {g[3]}) {g[4]}" for g in gaps))
    return res


def main(argv):
    """python tools/propgen.py quality reference [names] | audit [folder] | made [names]"""
    if not argv or argv[0] not in ("reference", "audit", "made"):
        print(main.__doc__)
        return 2
    if argv[0] == "reference":
        ref = reference(argv[1:] or REFERENCE_PROPS)
        print(f"QUALITY reference: {len(ref['props'])} props, maps {', '.join(ref['maps'])} -> {_rel(REFERENCE)}")
        for k, b in ref["bar"].items():
            print(f"  {k:18s} {b['p10']:>9} .. {b['p90']:<9} ({b['what']})")
        return 0
    if argv[0] == "audit":
        res = audit(argv[1] if len(argv) > 1 else "retro")
        print(f"QUALITY audit: {res['passed']} pass, {res['failed']} fail -> {_rel(AUDIT)}")
        return 0
    made_against(argv[1:])
    return 0
