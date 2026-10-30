"""Baking. The game mesh's own attributes per texel (numpy: which triangle covers each texel of its texture, and
any per-vertex value there: the rest position the paint's noise follows, the normal, the curvature), and what the
detailed mesh has, onto the game mesh's texture through Cycles (its normals, its ambient occlusion, a vertex
attribute such as its creases' curvature, as an emission)."""
import numpy as np


def tangent_frames(m):
    """Per triangle (in tris() order): the directions u and v run on the surface (tangent, bitangent), unit."""
    t, tuv, _ = m.tris()
    p0, p1, p2 = m.v[t[:, 0]], m.v[t[:, 1]], m.v[t[:, 2]]
    e1, e2 = p1 - p0, p2 - p0
    d1, d2 = tuv[:, 1] - tuv[:, 0], tuv[:, 2] - tuv[:, 0]
    det = d1[:, 0] * d2[:, 1] - d2[:, 0] * d1[:, 1]
    r = np.where(np.abs(det) > 1e-14, 1.0 / np.where(np.abs(det) > 1e-14, det, 1.0), 0.0)[:, None]
    T = (e1 * d2[:, 1:2] - e2 * d1[:, 1:2]) * r
    B = (e2 * d1[:, 0:1] - e1 * d2[:, 0:1]) * r
    T /= np.maximum(np.linalg.norm(T, axis=1, keepdims=True), 1e-12)
    B /= np.maximum(np.linalg.norm(B, axis=1, keepdims=True), 1e-12)
    return T, B


def raster(m, px, attrs, mat=None, face_attrs=None):
    """{name: (px, px, k)} the attributes (name -> (n, k) per vertex) at each texel's centre, and `hit` (px, px): the
    texels a triangle covers. Rows top first (v = 1 at row 0). Only faces of material index `mat`, if given.
    face_attrs: name -> (triangles, k) values per triangle (tris() order), laid flat over its texels."""
    t, tuv, tf = m.tris()
    fa = face_attrs or {}
    if mat is not None:
        keep = m.fm[tf] == mat
        t, tuv, tf = t[keep], tuv[keep], tf[keep]
        fa = {k: x[keep] for k, x in fa.items()}
    out = {k: np.zeros((px, px, x.shape[1]), np.float32) for k, x in list(attrs.items()) + list(fa.items())}
    hit = np.zeros((px, px), bool)
    P = np.stack([tuv[..., 0] * px - 0.5, (1 - tuv[..., 1]) * px - 0.5], -1)
    lo = np.floor(P.min(1)).astype(np.int64)
    hi = np.ceil(P.max(1)).astype(np.int64)
    lo = np.clip(lo, 0, px - 1)
    hi = np.clip(hi, 0, px - 1)
    for i in range(len(t)):
        x0, y0 = lo[i]
        x1, y1 = hi[i]
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
        e = -1e-4
        ins = (w0 >= e) & (w1 >= e) & (w2 >= e)
        if not ins.any():
            continue
        yy, xx = Y[ins], X[ins]
        ww = np.stack([w0[ins], w1[ins], w2[ins]], 1)
        hit[yy, xx] = True
        for k, x in attrs.items():
            out[k][yy, xx] = ww[:, 0, None] * x[t[i, 0]] + ww[:, 1, None] * x[t[i, 1]] + ww[:, 2, None] * x[t[i, 2]]
        for k, x in fa.items():
            out[k][yy, xx] = x[i]
    out["hit"] = hit
    return out


def bleed(maps, used, wrap=()):
    """Texels outside the islands take their nearest islands' values (push-pull: each empty texel from the coarsest
    level of a mip pyramid that has data under it), so filtering and mipmaps never pull in a neighbour's colour.
    maps: (h, w[, k]) arrays changed in place; used: (h, w) bool. wrap: (y0, x0, y1, x1) pixel boxes of bands whose
    left and right edges meet: their margins are copied from the other side first."""
    used = used.copy()
    for (y0, x0, y1, x1) in wrap:
        m = min(8, (x1 - x0) // 4)
        a0, a1 = max(x0 - m, 0), min(x1 + m, used.shape[1])
        for a in maps:
            a[y0:y1, a0:x0] = a[y0:y1, x1 - (x0 - a0):x1]
            a[y0:y1, x1:a1] = a[y0:y1, x0:x0 + (a1 - x1)]
        used[y0:y1, a0:a1] = True
    if used.all():
        return
    for a in maps:
        flat = a.reshape(a.shape[0], a.shape[1], -1).astype(np.float64)
        w = used.astype(np.float64)
        levels = [(flat * w[..., None], w)]
        while min(levels[-1][1].shape) > 1:
            v, ww = levels[-1]
            h2, w2 = (v.shape[0] + 1) // 2 * 2, (v.shape[1] + 1) // 2 * 2
            v = np.pad(v, ((0, h2 - v.shape[0]), (0, w2 - v.shape[1]), (0, 0)))
            ww = np.pad(ww, ((0, h2 - ww.shape[0]), (0, w2 - ww.shape[1])))
            levels.append((v.reshape(h2 // 2, 2, w2 // 2, 2, -1).sum((1, 3)), ww.reshape(h2 // 2, 2, w2 // 2, 2).sum((1, 3))))
        v, ww = levels[-1]
        fill = v / np.maximum(ww, 1e-12)[..., None]
        for v, ww in reversed(levels[:-1]):
            up = np.repeat(np.repeat(fill, 2, 0), 2, 1)[:v.shape[0], :v.shape[1]]
            fill = np.where(ww[..., None] > 0, v / np.maximum(ww, 1e-12)[..., None], up)
        out = fill.reshape(a.shape).astype(a.dtype)
        a[~used] = out[~used]


def vertex_normals(m):
    """Smooth vertex normals (area-weighted over the faces round each vertex)."""
    t, _, _ = m.tris()
    a, b, c = m.v[t[:, 0]], m.v[t[:, 1]], m.v[t[:, 2]]
    fn = np.cross(b - a, c - a)
    n = np.zeros_like(m.v)
    for k in range(3):
        np.add.at(n, t[:, k], fn)
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)


def curvature(m, n=None, rounds=2):
    """Per vertex: + on ridges, - in creases (the umbrella operator along the normal over the mean edge length),
    smoothed over a ring or two. Vertices at one place (seams) are treated as one."""
    if n is None:
        n = vertex_normals(m)
    key = np.round(m.v / 1e-6).astype(np.int64)
    _, inv = np.unique(key, axis=0, return_inverse=True)
    inv = inv.ravel()
    nu = inv.max() + 1
    pos = np.zeros((nu, 3))
    np.add.at(pos, inv, m.v)
    cntv = np.bincount(inv, minlength=nu)[:, None]
    pos /= cntv
    nrm = np.zeros((nu, 3))
    np.add.at(nrm, inv, n)
    nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-12)
    t, _, _ = m.tris()
    tt = inv[t]
    e = np.concatenate([tt[:, [0, 1]], tt[:, [1, 2]], tt[:, [2, 0]]])
    e = np.concatenate([e, e[:, ::-1]])
    acc = np.zeros((nu, 3))
    np.add.at(acc, e[:, 0], pos[e[:, 1]])
    deg = np.bincount(e[:, 0], minlength=nu)[:, None]
    lap = acc / np.maximum(deg, 1) - pos
    el = np.linalg.norm(pos[e[:, 0]] - pos[e[:, 1]], axis=1)
    mel = np.zeros(nu)
    np.add.at(mel, e[:, 0], el)
    mel = mel / np.maximum(deg[:, 0], 1)
    k = -(lap * nrm).sum(1) / np.maximum(mel, 1e-9) ** 1 * 2.0
    for _ in range(rounds):
        acc1 = np.zeros(nu)
        np.add.at(acc1, e[:, 0], k[e[:, 1]])
        k = 0.5 * k + 0.5 * acc1 / np.maximum(deg[:, 0], 1)
    return k[inv]


# ---- Cycles ----------------------------------------------------------------------------------------------------------

def cycles(samples=16, gpu=False):
    import bpy
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples = samples
    sc.cycles.use_denoising = False
    sc.cycles.device = "CPU"
    if gpu:
        try:
            prefs = bpy.context.preferences.addons["cycles"].preferences
            for kind in ("OPTIX", "CUDA", "HIP", "METAL", "ONEAPI"):
                try:
                    prefs.compute_device_type = kind
                    prefs.get_devices()
                    if any(d.type == kind for d in prefs.devices):
                        for d in prefs.devices:
                            d.use = d.type == kind
                        sc.cycles.device = "GPU"
                        break
                except TypeError:
                    continue
        except Exception:
            pass
    return sc


def bake(kind, low, high=None, px=1024, samples=16, extrude=0.003, reach=0.012, attr=None, gpu=False, ao_dist=0.02):
    """Bakes onto the low object's UVs, an image a material (each material's islands fill its own texture): 'NORMAL'
    (tangent space, from high), 'AO', or 'EMIT' (the high's or low's vertex attribute `attr` as an emission).
    Returns {material name: (px, px, 4) floats, rows top first}."""
    import bpy
    sc = cycles(samples, gpu)
    imgs, added = {}, []
    for slot in low.material_slots:
        mt = slot.material
        if mt is None or mt.name in imgs:
            continue
        img = bpy.data.images.new(f"bake_{kind}_{mt.name}", px, px, alpha=False, float_buffer=True)
        img.colorspace_settings.name = "Non-Color"
        imgs[mt.name] = img
        nd = mt.node_tree.nodes.new("ShaderNodeTexImage")
        nd.image = img
        mt.node_tree.nodes.active = nd
        added.append((mt, nd))
    saved = []
    src = high or low
    if kind == "EMIT":
        for slot in src.material_slots:
            tree = slot.material.node_tree
            out = next(n for n in tree.nodes if n.type == "OUTPUT_MATERIAL" and n.is_active_output)
            link = out.inputs["Surface"].links[0] if out.inputs["Surface"].links else None
            at = tree.nodes.new("ShaderNodeAttribute")
            at.attribute_name = attr
            em = tree.nodes.new("ShaderNodeEmission")
            tree.links.new(at.outputs["Color"], em.inputs["Color"])
            tree.links.new(em.outputs["Emission"], out.inputs["Surface"])
            saved.append((tree, out, link.from_socket if link else None, [at, em]))
    if kind == "AO":
        sc.world = sc.world or bpy.data.worlds.new("propgen_world")
        sc.world.light_settings.distance = ao_dist
    bpy.context.view_layer.update()
    for o in bpy.context.scene.objects:
        o.select_set(False)
    low.select_set(True)
    if high is not None:
        high.select_set(True)
    bpy.context.view_layer.objects.active = low
    kw = dict(type=kind, margin=4, margin_type="EXTEND", use_clear=True, target="IMAGE_TEXTURES")
    if high is not None:
        kw.update(use_selected_to_active=True, cage_extrusion=extrude, max_ray_distance=reach)
    if kind == "NORMAL":
        kw.update(normal_space="TANGENT")
    bpy.ops.object.bake(**kw)
    out = {}
    for name, img in imgs.items():
        a = np.zeros(px * px * 4, np.float32)
        img.pixels.foreach_get(a)
        out[name] = a.reshape(px, px, 4)[::-1].copy()
    for mt, nd in added:
        mt.node_tree.nodes.remove(nd)
    for tree, o, sock, nodes in saved:
        if sock is not None:
            tree.links.new(sock, o.inputs["Surface"])
        for nd in nodes:
            tree.nodes.remove(nd)
    for img in imgs.values():
        bpy.data.images.remove(img)
    return out
