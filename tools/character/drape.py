"""The drape: GarmentCode's flat panels sewn onto a body with Blender's cloth (sewing springs), headless. Runs inside
Blender's module (tools/character/clothes.py calls it):

    python drape.py -- body.obj panels.obj panels.seams.json garment.obj [frames]

body.obj: metres, Y up, facing +Z (the Character Studio's frame). panels.obj + .seams.json: tools/garment.py's panels
(cm, placed round GarmentCode's body: the same frame). Each panel is re-meshed with inner points (Blender's constrained
Delaunay, the outline kept); stitched edges are subdivided alike so their points pair one to one, and each pair is a
sewing spring. The cloth sews with gravity off, then hangs with it on, colliding with the body; the seams are welded.
Writes garment.obj (metres) and prints DRAPE {report}: the seams' gap before welding, the points left inside the body.
"""
import json
import os
import math
import sys
import time

import bpy
import bmesh  # noqa: E402 - after bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import delaunay_2d_cdt

STEP = 0.02                                                   # the cloth's edge length (m)


def read_obj(path):
    v, f, objs = [], [], []
    for line in open(path, encoding="utf-8"):
        p = line.split()
        if not p: continue
        if p[0] == "v": v.append([float(x) for x in p[1:4]])
        elif p[0] == "f": f.append([int(x.split("/")[0]) - 1 for x in p[1:]])
        elif p[0] == "o": objs.append(p[1])
    return np.array(v), f, objs


def build(panels_obj, seams_json):
    """the panels re-meshed, as one mesh (metres), and the sewing pairs (vertex indices)"""
    pv, _, _ = read_obj(panels_obj)
    pv = pv / 100.0                                           # cm -> m
    S = json.loads(open(seams_json, encoding="utf-8").read())
    panels = S["panels"]
    # every edge's points, end included (the next edge's first), 0-based into pv
    edges = {}
    for name, P in panels.items():
        es = P["edges"]
        for k, e in enumerate(es):
            nxt = es[(k + 1) % len(es)]["vertices"][0]
            edges[(name, e["edge"])] = [i - 1 for i in e["vertices"]] + [nxt - 1]
    # how many pieces each segment is cut into: stitched pairs alike, from the longer side
    cuts = {key: [max(1, math.ceil(np.linalg.norm(pv[b] - pv[a]) / STEP)) for a, b in zip(pts, pts[1:])]
            for key, pts in edges.items()}
    pairs = []
    for s in S["stitches"]:
        ka, kb = (s[0]["panel"], s[0]["edge"]), (s[1]["panel"], s[1]["edge"])
        A, B = edges[ka], edges[kb]
        if len(A) != len(B): continue
        da = sum(np.linalg.norm(pv[A[i]] - pv[B[i]]) for i in range(len(A)))
        db = sum(np.linalg.norm(pv[A[i]] - pv[B[-1 - i]]) for i in range(len(A)))
        rev = db < da
        ca, cb = cuts[ka], cuts[kb]
        for i in range(len(ca)):
            j = len(cb) - 1 - i if rev else i
            c = max(ca[i], cb[j]); ca[i] = cb[j] = c
        pairs.append((ka, kb, rev))
    # each panel: its refined outline, inner points, the constrained Delaunay inside
    verts, faces, where = [], [], {}                       # where[(panel, edge)] = global indices along the edge, end included
    for name, P in panels.items():
        outline, owner = [], []
        for e in P["edges"]:
            key = (name, e["edge"]); pts = edges[key]; idx = []
            for (a, b), n in zip(zip(pts, pts[1:]), cuts[key]):
                for t in range(n):
                    idx.append(len(outline)); outline.append(pv[a] + (pv[b] - pv[a]) * (t / n))
            owner.append((key, idx))
        O = np.array(outline)
        c = O.mean(0)
        _, _, vt = np.linalg.svd(O - c)
        u, w = vt[0], vt[1]
        P2 = np.stack([(O - c) @ u, (O - c) @ w], 1)
        lo, hi = P2.min(0), P2.max(0)
        gx, gy = np.meshgrid(np.arange(lo[0] + STEP / 2, hi[0], STEP), np.arange(lo[1] + STEP / 2, hi[1], STEP))
        G = np.stack([gx.ravel(), gy.ravel()], 1)
        G[:, 0] += (np.round((G[:, 1] - lo[1]) / STEP) % 2) * STEP / 2      # staggered rows: near-equilateral triangles
        inside = np.zeros(len(G), bool)                     # even-odd rule
        for (x1, y1), (x2, y2) in zip(P2, np.roll(P2, -1, 0)):
            cross = ((y1 > G[:, 1]) != (y2 > G[:, 1]))
            xi = x1 + (G[:, 1] - y1) * (x2 - x1) / np.where(y2 - y1 == 0, 1e-12, y2 - y1)
            inside ^= cross & (G[:, 0] < xi)
        G = G[inside]
        if len(G):                                          # not too close to the outline
            d = np.min(np.linalg.norm(G[:, None, :] - P2[None, :, :], axis=2), axis=1)
            G = G[d > STEP * 0.6]
        allp = [Vector((x, y)) for x, y in np.vstack([P2, G])] if len(G) else [Vector((x, y)) for x, y in P2]
        n = len(P2)
        res = delaunay_2d_cdt(allp, [(i, (i + 1) % n) for i in range(n)], [list(range(n))], 2, 1e-7)
        ov, of, orig = res[0], res[2], res[3]
        base = len(verts)
        for p in ov: verts.append(c + p.x * u + p.y * w)
        faces += [[base + i for i in f] for f in of]
        remap = {}
        for k, src in enumerate(orig):
            for s in src: remap[s] = base + k
        for key, idx in owner: where[key] = [remap[i] for i in idx]
    for name, P in panels.items():                          # each edge's end: the next edge's first point
        es = P["edges"]
        for k, e in enumerate(es):
            where[(name, e["edge"])].append(where[(name, es[(k + 1) % len(es)]["edge"])][0])
    sew = []
    for ka, kb, rev in pairs:
        A, B = where[ka], where[kb]
        if rev: B = B[::-1]
        sew += [(a, b) for a, b in zip(A, B) if a != b]
    return np.array(verts), faces, sorted(set(tuple(sorted(p)) for p in sew))


def prewrap(gv, gf, bv, off=0.015, cell=0.01):
    """the panels laid onto the body before the sim: GarmentCode places them flat, 30 cm in front and 25 cm behind, and
    sewing them from there pulls the shoulder seams straight through the shoulders. Each point moves to just off the
    body's front or back surface at its (x, y) (a depth map of the body, front and back); where the body isn't, it
    comes in to a few cm of the body's middle, so side seams start close."""
    x0, y0 = bv[:, 0].min() - 0.1, bv[:, 1].min()
    nx, ny = int((bv[:, 0].max() + 0.1 - x0) / cell) + 1, int((bv[:, 1].max() - y0) / cell) + 1
    zmax = np.full((ny, nx), -np.inf); zmin = np.full((ny, nx), np.inf)
    ix = ((bv[:, 0] - x0) / cell).astype(int); iy = ((bv[:, 1] - y0) / cell).astype(int)
    np.maximum.at(zmax, (iy, ix), bv[:, 2]); np.minimum.at(zmin, (iy, ix), bv[:, 2])
    for _ in range(2):                                    # close pinholes between the body's points
        for M, op in ((zmax, np.maximum), (zmin, np.minimum)):
            P = np.pad(M, 1, constant_values=-np.inf if op is np.maximum else np.inf)
            nb = [P[1 + dy:1 + dy + ny, 1 + dx:1 + dx + nx] for dy in (-1, 0, 1) for dx in (-1, 0, 1)]
            fill = op.reduce(nb)
            M[:] = np.where(np.isfinite(M), M, fill)
    mid = (bv[:, 2].min() + bv[:, 2].max()) / 2
    out = gv.copy()
    for k, (x, y, z) in enumerate(gv):
        i, j = int((y - y0) / cell), int((x - x0) / cell)
        front = z > mid
        if 0 <= i < ny and 0 <= j < nx and np.isfinite(zmax[i, j]):
            out[k, 2] = zmax[i, j] + off if front else zmin[i, j] - off
        else:
            out[k, 2] = mid + np.sign(z - mid) * min(abs(z - mid), 0.08)
    # smooth it (no cliffs where the body ends), still off the body
    nb = [set() for _ in range(len(gv))]
    for f in gf:
        for a in f:
            nb[a].update(b for b in f if b != a)
    floor = out[:, 2].copy()
    on = np.array([0 <= int((y - y0) / cell) < ny and 0 <= int((x - x0) / cell) < nx and
                   np.isfinite(zmax[int((y - y0) / cell), int((x - x0) / cell)]) for x, y, _ in gv])
    front = gv[:, 2] > mid
    for _ in range(30):
        z = out[:, 2].copy()
        out[:, 2] = [np.mean([z[b] for b in nb[a]]) if nb[a] else z[a] for a in range(len(gv))]
        out[:, 2] = np.where(on & front, np.maximum(out[:, 2], floor), out[:, 2])
        out[:, 2] = np.where(on & ~front, np.minimum(out[:, 2], floor), out[:, 2])
    return out


def main():
    args = sys.argv[sys.argv.index("--") + 1:]
    body_obj, panels_obj, seams_json, out = args[:4]
    frames = int(args[4]) if len(args) > 4 else 90
    t0 = time.time()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    to_b = lambda p: (p[0], -p[2], p[1])                   # the Studio's Y up, +Z front -> Blender's Z up, -Y front
    from_b = lambda p: (p[0], p[2], -p[1])
    bv, bf, _ = read_obj(body_obj)
    bme = bpy.data.meshes.new("body"); bme.from_pydata([to_b(p) for p in bv], [], bf); bme.update()
    body = bpy.data.objects.new("body", bme); bpy.context.scene.collection.objects.link(body)
    body.modifiers.new("collision", "COLLISION")
    body.collision.thickness_outer = 0.004; body.collision.cloth_friction = 5

    gv, gf, sew = build(panels_obj, seams_json)
    # GarmentCode's body stands a little behind ours: centre the garment on this torso, front to back
    torso = bv[(bv[:, 1] > bv[:, 1].max() * 0.55) & (bv[:, 1] < bv[:, 1].max() * 0.75) & (np.abs(bv[:, 0]) < 0.15)]
    gv[:, 2] += torso[:, 2].mean() - (gv[:, 2].min() + gv[:, 2].max()) / 2
    start = prewrap(gv, gf, bv)
    gme = bpy.data.meshes.new("garment"); gme.from_pydata([to_b(p) for p in start], [list(e) for e in sew], gf); gme.update()
    gar = bpy.data.objects.new("garment", gme); bpy.context.scene.collection.objects.link(gar)

    cl = gar.modifiers.new("cloth", "CLOTH")
    s = cl.settings
    s.quality = 8; s.mass = 0.25; s.air_damping = 2
    s.tension_stiffness = s.compression_stiffness = 12; s.shear_stiffness = 5; s.bending_stiffness = 0.3
    s.use_sewing_springs = True; s.sewing_force_max = 8      # 30 yanked a t-shirt off the shoulders, sleeves crushed
    for k, v in json.loads(os.environ.get("DRAPE_SET", "{}")).items(): setattr(s, k, v)   # tuning: '{"bending_stiffness": 1}'
    cl.collision_settings.distance_min = 0.004; cl.collision_settings.use_self_collision = False
    sc = bpy.context.scene; sc.frame_start = 1; sc.frame_end = frames
    cl.point_cache.frame_start = 1; cl.point_cache.frame_end = frames
    sew_end = max(10, int(frames * 0.45))
    s.effector_weights.gravity = 0.0; s.effector_weights.keyframe_insert("gravity", frame=sew_end)
    s.effector_weights.gravity = 1.0; s.effector_weights.keyframe_insert("gravity", frame=sew_end + 10)
    for f in range(1, frames + 1): sc.frame_set(f)

    dg = bpy.context.evaluated_depsgraph_get()
    ev = gar.evaluated_get(dg)
    P = np.array([from_b(v.co) for v in ev.data.vertices])
    gap = float(np.mean([np.linalg.norm(P[a] - P[b]) for a, b in sew])) if sew else 0.0
    # weld the seams: each pair to its middle
    bm = bmesh.new(); bm.from_mesh(ev.to_mesh()); bm.verts.ensure_lookup_table()
    for v, p in zip(bm.verts, P): v.co = Vector(p)
    tmap = {bm.verts[b]: bm.verts[a] for a, b in sew if a != b}
    for a, b in sew: bm.verts[a].co = (bm.verts[a].co + bm.verts[b].co) / 2
    bmesh.ops.weld_verts(bm, targetmap=tmap)
    bmesh.ops.delete(bm, geom=[e for e in bm.edges if not e.link_faces], context="EDGES")
    bm.verts.index_update()
    W = np.array([tuple(v.co) for v in bm.verts]); F = [[v.index for v in f.verts] for f in bm.faces]
    bm.free()
    # how much ended up inside the body
    tree = BVHTree.FromPolygons([Vector(p) for p in bv], bf)
    inside = 0
    for p in W[::max(1, len(W) // 1500)]:
        hit = tree.find_nearest(Vector(p))
        if hit[0] is not None and (Vector(p) - hit[0]).dot(hit[1]) < -0.002: inside += 1
    with open(out, "w", encoding="utf-8") as f:
        f.write("# draped by tools/character/drape.py: metres, Y up, facing +Z\no garment\n")
        for p in W: f.write("v %.5f %.5f %.5f\n" % tuple(p))
        for fa in F: f.write("f " + " ".join(str(i + 1) for i in fa) + "\n")
    rep = dict(points=len(W), faces=len(F), seams=len(sew), seam_gap_mm=round(gap * 1000, 1),
               inside_pct=round(100 * inside / max(1, len(W[::max(1, len(W) // 1500)])), 1),
               frames=frames, seconds=round(time.time() - t0, 1))
    print("DRAPE " + json.dumps(rep))


main()
