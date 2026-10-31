"""The street's wear atlas: one texture for the whole street, low resolution (dirt is slow: tens of pixels a metre),
holding what the street's own shape says about where it gets dirty, the way the prop generator's wear goes by each
texel's place, normal, occlusion and curvature (docs/PROPGEN.md §3), here at a street's scale:

  R  the occlusion (1 open, 0 shut): glTF's occlusion map reads R, so a game without our plugin gets it on UV2
  G  dirt: in corners and under ledges (the occlusion), the splash band up a wall's foot (its height above the ground
     under it), a slow grime over everything
  B  on walls, rain streaks: run down from every ledge (each window's sill line and each wall's top, found where the
     texel above is off the island; and under whatever is fixed to the wall, found by a short occlusion), each column
     its own length; on what faces up, the wet and oily patches
  A  worn edges (the bevel's normal against the face's), chipped by noise

The layout is our own, not the street's UVs: each flat patch of the street (triangles joined across shared edges
when they face the same way) laid flat in its own plane, a vertical one with its up the image's up (so streaks run
down the image), packed into one atlas at a density by what it is. The inputs come from Cycles bakes into it (each
texel's place, its normal, two occlusions and the bevel), the rest is numpy."""
import math

import bpy
import numpy as np
from mathutils.bvhtree import BVHTree

PAD = 2
WALKABLE = ("asphalt", "pavement", "kerb", "ground", "gravel")
# pixels a metre for each finish, as a share of the street's density
DENSITY = {"ground": 0.12, "roof_sheet": 0.4, "roof_tiles": 0.5, "glow": 0.25, "glass": 0.5, "plain": 0.5, "image": 0.6,
           "asphalt": 0.8, "paving": 0.8, "paint": 0.6, "kerb": 0.8}


# ---- the layout ----------------------------------------------------------------------------------------------------

def _frame(n):
    """A patch's plane: (u, v) unit axes, v up the face when it stands."""
    n = n / max(np.linalg.norm(n), 1e-12)
    if abs(n[2]) > 0.95:
        return np.array([1.0, 0, 0]), np.array([0, 1.0 if n[2] > 0 else -1.0, 0])
    u = np.cross([0, 0, 1.0], n)
    u /= np.linalg.norm(u)
    return u, np.cross(n, u)


def patches(objs, finish_of):
    """Every visual object's triangles joined into flat patches: [(obj, [polygon indices], u, v, origin2d, size2d,
    density share)], and the triangles' world corners per object."""
    out, corners = [], {}
    for o in objs:
        me = o.data
        mw = np.array(o.matrix_world)
        nv, nl, np_ = len(me.vertices), len(me.loops), len(me.polygons)
        co = np.empty(nv * 3, np.float64)
        me.vertices.foreach_get("co", co)
        co = co.reshape(-1, 3) @ mw[:3, :3].T + mw[:3, 3]
        vi = np.empty(nl, np.int64)
        me.loops.foreach_get("vertex_index", vi)
        ls = np.empty(np_, np.int64)
        lt = np.empty(np_, np.int64)
        me.polygons.foreach_get("loop_start", ls)
        me.polygons.foreach_get("loop_total", lt)
        mi = np.empty(np_, np.int64)
        me.polygons.foreach_get("material_index", mi)
        P = co[vi]                                       # each loop's world place
        corners[o.name] = P
        # face normals in the world (the street's polygons come in as triangles)
        fn = np.cross(P[ls + 1] - P[ls], P[ls + 2] - P[ls])
        area = np.linalg.norm(fn, axis=1) / 2
        fn = fn / np.maximum(np.linalg.norm(fn, axis=1, keepdims=True), 1e-12)
        # union-find over shared edges between faces that face the same way
        parent = list(range(np_))

        def find(x):
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x
        key = np.round(P / 1e-3).astype(np.int64)
        edges = {}
        for f in range(np_):
            s, t = ls[f], lt[f]
            for j in range(t):
                ka, kb = tuple(key[s + j]), tuple(key[s + (j + 1) % t])
                e = (ka, kb) if ka < kb else (kb, ka)
                g = edges.get(e)
                if g is None:
                    edges[e] = f
                elif np.dot(fn[g], fn[f]) > 0.985:
                    ra, rb = find(g), find(f)
                    if ra != rb:
                        parent[ra] = rb
        groups = {}
        for f in range(np_):
            if area[f] > 1e-10:
                groups.setdefault(find(f), []).append(f)
        mats = [m.name if m else "" for m in me.materials]
        for fs in groups.values():
            fs = np.array(fs)
            n = (fn[fs] * area[fs, None]).sum(0)
            u, v = _frame(n)
            idx = np.concatenate([np.arange(ls[f], ls[f] + lt[f]) for f in fs])
            q = np.stack([P[idx] @ u, P[idx] @ v], 1)
            lo, hi = q.min(0), q.max(0)
            share = DENSITY.get(finish_of(mats[mi[fs[0]]] if mats else ""), 1.0)
            out.append({"obj": o, "faces": fs, "u": u, "v": v, "lo": lo, "size": hi - lo, "share": share,
                        "vertical": abs(n[2]) / max(np.linalg.norm(n), 1e-12) < 0.5})
    return out


def pack(P, density, maxw=8192):
    """Shelf-packs the patches at `density` pixels a metre (each by its share), shrinking until it fits; writes each
    patch's rect. (width, height, the density used)."""
    d = density
    while True:
        rects = []
        for p in P:
            w = int(math.ceil(p["size"][0] * d * p["share"])) + 1 + 2 * PAD
            h = int(math.ceil(p["size"][1] * d * p["share"])) + 1 + 2 * PAD
            rects.append((w, h))
        total = sum(w * h for w, h in rects)
        W = 1 << max(8, int(math.ceil(math.log2(math.sqrt(total * 1.12)))))
        W = min(W, maxw)
        order = sorted(range(len(P)), key=lambda i: (-rects[i][1], -rects[i][0]))
        x = y = rowh = 0
        ok = True
        for i in order:
            w, h = rects[i]
            if w > W:
                ok = False
                break
            if x + w > W:
                x, y, rowh = 0, y + rowh, 0
            P[i]["rect"] = (x, y, w, h)
            x += w
            rowh = max(rowh, h)
        H = y + rowh
        if ok and H <= maxw:
            H = int(math.ceil(H / 64.0)) * 64
            return W, H, d
        d *= 0.85


def write_uvs(P, W, H, density, name="Wear"):
    """Each patch's loops their place in the atlas, as the UV layer `name` (made if missing)."""
    by = {}
    for p in P:
        by.setdefault(p["obj"].name, []).append(p)
    for oname, ps in by.items():
        o = bpy.data.objects[oname]
        me = o.data
        lay = me.uv_layers.get(name) or me.uv_layers.new(name=name)
        nl = len(me.loops)
        uv = np.zeros(nl * 2, np.float32)
        lay.data.foreach_get("uv", uv)
        uv = uv.reshape(-1, 2)
        mw = np.array(o.matrix_world)
        co = np.empty(len(me.vertices) * 3)
        me.vertices.foreach_get("co", co)
        co = co.reshape(-1, 3) @ mw[:3, :3].T + mw[:3, 3]
        vi = np.empty(nl, np.int64)
        me.loops.foreach_get("vertex_index", vi)
        ls = np.empty(len(me.polygons), np.int64)
        lt = np.empty(len(me.polygons), np.int64)
        me.polygons.foreach_get("loop_start", ls)
        me.polygons.foreach_get("loop_total", lt)
        Pl = co[vi]
        for p in ps:
            x, y, w, h = p["rect"]
            s = density * p["share"]
            idx = np.concatenate([np.arange(ls[f], ls[f] + lt[f]) for f in p["faces"]])
            q = np.stack([Pl[idx] @ p["u"], Pl[idx] @ p["v"]], 1)
            q = (q - p["lo"]) * s + PAD + 0.5
            uv[idx, 0] = (x + q[:, 0]) / W
            uv[idx, 1] = (y + q[:, 1]) / H
        lay.data.foreach_set("uv", uv.ravel())


# ---- the bakes (Cycles) --------------------------------------------------------------------------------------------

def bake_material(img, what):
    """A material that emits `what` (position, normal, occlusion) into `img` for a bake."""
    from .nodes import NB
    m = bpy.data.materials.get("_wearbake") or bpy.data.materials.new("_wearbake")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    nb = NB(nt)
    out = nb.node("ShaderNodeOutputMaterial")
    em = nb.node("ShaderNodeEmission")
    nb.put(1.0, em.inputs["Strength"])
    if what == "position":
        c = nb.geo("Position")
    elif what == "normal":
        c = nb.geo("True Normal")
    else:
        ao_s = nb.node("ShaderNodeAmbientOcclusion", samples=8)
        nb.put(0.18, ao_s.inputs["Distance"])
        ao_l = nb.node("ShaderNodeAmbientOcclusion", samples=12)
        nb.put(1.4, ao_l.inputs["Distance"])
        bev = nb.node("ShaderNodeBevel", samples=8)
        nb.put(0.05, bev.inputs["Radius"])
        dp = nb.vmath("DOT_PRODUCT", bev.outputs[0], nb.geo("Normal"), out=1)
        edge = nb.clamp(nb.mul(nb.sub(1.0, dp), 5.0))
        c = nb.comb(ao_s.outputs["AO"], ao_l.outputs["AO"], edge)
    nt.links.new(c, em.inputs["Color"])
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    t = nb.node("ShaderNodeTexImage", image=img)
    nb.put(nb.uv("Wear"), t.inputs["Vector"])
    nt.nodes.active = t
    t.select = True
    return m


DECAL = ("paint", "paint_y", "glyph:", "decal:")


def is_decal(o):
    """Road markings: painted on what's under them, they mustn't shut its occlusion (the road shows through their wear)."""
    names = [s.material.name for s in o.material_slots if s.material]
    return bool(names) and all(any(n.startswith("street_" + d) for d in DECAL) for n in names)


def joined(objs):
    """One copy of all of them joined (Cycles bakes an object at a time, each over the whole image: one is quick);
    the originals hidden from the render meanwhile, so the occlusion meets each surface once."""
    sc = bpy.context.scene
    copies = []
    for o in objs:
        c = o.copy()
        c.data = o.data.copy()
        sc.collection.objects.link(c)
        c.matrix_world = o.matrix_world.copy()
        copies.append(c)
    bpy.ops.object.select_all(action="DESELECT")
    for c in copies:
        c.select_set(True)
    bpy.context.view_layer.objects.active = copies[0]
    bpy.ops.object.join()
    J = bpy.context.view_layer.objects.active
    J.name = "_wearbake"
    J.parent = None
    for o in objs:
        o.hide_render = True
    return J


def unjoin(J, objs):
    me = J.data
    bpy.data.objects.remove(J)
    bpy.data.meshes.remove(me)
    for o in objs:
        o.hide_render = False


def bake(J, img, what, samples, margin, clear=True, hide=None):
    """Bakes `what` into `img` on the joined copy J, through its Wear UVs: (H, W, 4) floats. hide: an object kept out
    of the rays meanwhile (the road markings, while what's under them is baked)."""
    sc = bpy.context.scene
    if hide is not None:
        hide.hide_render = True
    m = bake_material(img, what)
    J.data.materials.clear()
    J.data.materials.append(m)
    J.data.polygons.foreach_set("material_index", np.zeros(len(J.data.polygons), np.int32))
    J.data.uv_layers.active = J.data.uv_layers["Wear"]
    sc.cycles.samples = samples
    bpy.ops.object.select_all(action="DESELECT")
    J.select_set(True)
    bpy.context.view_layer.objects.active = J
    bpy.ops.object.bake(type="EMIT", margin=margin, margin_type="EXTEND", use_clear=clear, target="IMAGE_TEXTURES",
                        uv_layer="Wear")
    if hide is not None:
        hide.hide_render = False
    a = np.empty(img.size[0] * img.size[1] * 4, np.float32)
    img.pixels.foreach_get(a)
    return a.reshape(img.size[1], img.size[0], 4)


def float_image(name, W, H):
    im = bpy.data.images.get(name)
    if im:
        bpy.data.images.remove(im)
    im = bpy.data.images.new(name, W, H, alpha=True, float_buffer=True)
    im.generated_color = (0, 0, 0, 0)
    im.colorspace_settings.name = "Non-Color"
    return im


# ---- the ground under everything -----------------------------------------------------------------------------------

def ground_map(objs, cell=0.5):
    """(z grid, x0, y0, cell): the top of what can be walked on under each place, holes filled from around them."""
    verts, polys = [], []
    for o in objs:
        if not any(o.name.endswith("_" + w) or ("_" + w + ".") in o.name for w in WALKABLE):
            continue
        mw = o.matrix_world
        base = len(verts)
        verts += [tuple(mw @ v.co) for v in o.data.vertices]
        polys += [tuple(base + i for i in p.vertices) for p in o.data.polygons]
    if not verts:
        return None
    V = np.array(verts)
    x0, y0 = V[:, 0].min() - 2, V[:, 1].min() - 2
    x1, y1 = V[:, 0].max() + 2, V[:, 1].max() + 2
    top = V[:, 2].max() + 50
    bvh = BVHTree.FromPolygons(verts, polys)
    nx, ny = int((x1 - x0) / cell) + 1, int((y1 - y0) / cell) + 1
    Z = np.full((ny, nx), np.nan)
    for j in range(ny):
        y = y0 + j * cell
        for i in range(nx):
            hit = bvh.ray_cast((x0 + i * cell, y, top), (0, 0, -1))
            if hit[0] is not None:
                Z[j, i] = hit[0][2]
    # fill holes (under the buildings) from their neighbours
    for _ in range(400):
        bad = np.isnan(Z)
        if not bad.any():
            break
        P = np.pad(Z, 1, constant_values=np.nan)
        nb = np.stack([P[:-2, 1:-1], P[2:, 1:-1], P[1:-1, :-2], P[1:-1, 2:]])
        cnt = (~np.isnan(nb)).sum(0)
        s = np.nansum(nb, 0)
        fill = bad & (cnt > 0)
        Z[fill] = s[fill] / cnt[fill]
    Z[np.isnan(Z)] = np.nanmin(Z) if not np.isnan(Z).all() else 0.0
    return Z, x0, y0, cell


def ground_at(G, x, y):
    Z, x0, y0, cell = G
    fx = np.clip((x - x0) / cell, 0, Z.shape[1] - 1.001)
    fy = np.clip((y - y0) / cell, 0, Z.shape[0] - 1.001)
    i, j = fx.astype(int), fy.astype(int)
    tx, ty = fx - i, fy - j
    return (Z[j, i] * (1 - tx) * (1 - ty) + Z[j, i + 1] * tx * (1 - ty) + Z[j + 1, i] * (1 - tx) * ty + Z[j + 1, i + 1] * tx * ty)


# ---- noise (numpy) -------------------------------------------------------------------------------------------------

def _hash(ix, iy, iz, seed):
    h = (ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791) ^ (seed * 2654435761)
    h = (h ^ (h >> 13)) * 1274126177
    return ((h ^ (h >> 16)) & 0xffffff).astype(np.float32) / float(0xffffff)


def vnoise(P, seed=0):
    """Value noise at points P (n, 3): 0..1, smooth."""
    f = np.floor(P)
    t = P - f
    t = t * t * (3 - 2 * t)
    i = f.astype(np.int64)
    out = 0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (t[:, 0] if dx else 1 - t[:, 0]) * (t[:, 1] if dy else 1 - t[:, 1]) * (t[:, 2] if dz else 1 - t[:, 2])
                out = out + w * _hash(i[:, 0] + dx, i[:, 1] + dy, i[:, 2] + dz, seed)
    return out


def fbm(P, seed=0, octaves=3):
    out, amp, tot = 0, 1.0, 0
    for o in range(octaves):
        out = out + amp * vnoise(P * (2.0 ** o) + 17.3 * o, seed + 31 * o)
        tot += amp
        amp *= 0.5
    return out / tot


def ss(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


# ---- the wear ------------------------------------------------------------------------------------------------------

def compute(pos, nrm, aoc, cov, dens, G, seed=7, amount=None):
    """The wear (H, W, 4) in 0..1 from the bakes. dens: each texel's pixels a metre (0 off the patches)."""
    amount = amount or {}
    H, W = cov.shape
    out = np.zeros((H, W, 4), np.float32)
    yy, xx = np.nonzero(cov)
    p = pos[yy, xx, :3].astype(np.float64)
    n = nrm[yy, xx, :3].astype(np.float64)
    n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)
    aoS, aoL, edge = aoc[yy, xx, 0], aoc[yy, xx, 1], aoc[yy, xx, 2]
    nz = n[:, 2]
    vert = 1 - ss(0.45, 0.7, np.abs(nz))
    up = ss(0.6, 0.85, nz)
    hag = p[:, 2] - ground_at(G, p[:, 0], p[:, 1]) if G is not None else p[:, 2]
    n1 = fbm(p / 2.0, seed + 1)
    n2 = fbm(p / 1.3, seed + 2)
    n3 = fbm(p / 7.0, seed + 3, 2)
    # dirt: the corners and under things, the splash band up a wall's foot, a slow grime
    occl = np.clip((1 - aoL) * 1.6, 0, 1) ** 1.2
    h0 = 0.18 + 0.75 * n2
    band = (1 - ss(0.0, 1.0, hag / np.maximum(h0, 0.05))) * vert
    dirt = np.clip(occl * (0.35 + 1.0 * n1) + band * (0.55 + 0.6 * n1) + 0.25 * ss(0.45, 0.85, n3), 0, 1)
    dirt *= amount.get("dirt", 1.0)
    # worn edges, chipped
    n6 = fbm(p * 3.0, seed + 6)
    edges = np.clip(ss(0.12, 0.5, edge) * (ss(0.35, 0.65, n6) * 1.2), 0, 1) * amount.get("edges", 1.0)
    # wet and oily patches on what faces up
    n7 = fbm(p / 2.5, seed + 7)
    wet = ss(0.58, 0.72, n7) * up + np.clip((1 - aoL) * 1.2, 0, 1) * up * 0.5
    out[yy, xx, 0] = np.clip(aoL, 0, 1)
    out[yy, xx, 1] = dirt
    out[yy, xx, 3] = edges
    # rain streaks: sources on walls, run down the image (its rows grow upward: Blender's), each column its length
    src = np.zeros((H, W), np.float32)
    vmap = np.zeros((H, W), np.float32)
    vmap[yy, xx] = vert
    above = np.zeros_like(cov)
    above[:-1] = cov[1:]
    top = cov & ~above
    n4 = fbm(p * np.array([1.6, 1.6, 0.25]), seed + 4)
    srcv = np.maximum(top[yy, xx] * (0.45 + 0.8 * n4), ss(0.82, 0.5, aoS) * (0.3 + 0.7 * n4))
    src[yy, xx] = srcv * vert
    L = 0.35 + 2.6 * fbm(p * np.array([1.2, 1.2, 0.08]), seed + 5) ** 1.5          # metres a streak runs
    k = np.zeros((H, W), np.float32)
    k[yy, xx] = np.exp(-1.0 / np.maximum(L * dens[yy, xx], 1.0))
    run = np.zeros((H, W), np.float32)
    mask = (cov * (vmap > 0.3)).astype(np.float32)
    for r in range(H - 2, -1, -1):
        run[r] = np.maximum(src[r], run[r + 1] * k[r]) * mask[r]
    # thin: fine across the wall, long down it
    t = np.cross(np.array([0, 0, 1.0]), n)
    t /= np.maximum(np.linalg.norm(t, axis=1, keepdims=True), 1e-9)
    hcoord = (p * t).sum(1)
    thin = fbm(np.stack([hcoord * 14.0, p[:, 2] * 0.5, hcoord * 0.0 + seed], 1), seed + 8)
    streak = run[yy, xx] * (0.25 + 0.95 * ss(0.4, 0.75, thin))
    out[yy, xx, 2] = np.clip(streak * vert * amount.get("streaks", 1.0) + wet * (1 - vert) * amount.get("wet", 1.0), 0, 1)
    return out


def bleed(a, cov, px=6):
    """The texels round each patch take their neighbours' wear (filtering never reads the black between them)."""
    have = cov.copy()
    for _ in range(px):
        P = np.pad(a, ((1, 1), (1, 1), (0, 0)))
        Hm = np.pad(have, 1).astype(np.float32)
        s = P[:-2, 1:-1] * Hm[:-2, 1:-1, None] + P[2:, 1:-1] * Hm[2:, 1:-1, None] + P[1:-1, :-2] * Hm[1:-1, :-2, None] + P[1:-1, 2:] * Hm[1:-1, 2:, None]
        c = Hm[:-2, 1:-1] + Hm[2:, 1:-1] + Hm[1:-1, :-2] + Hm[1:-1, 2:]
        grow = (~have) & (c > 0)
        a[grow] = s[grow] / c[grow, None]
        have = have | grow
    return a


def density_map(P, W, H, density):
    d = np.zeros((H, W), np.float32)
    for p in P:
        x, y, w, h = p["rect"]
        d[y:y + h, x:x + w] = density * p["share"]
    return d
