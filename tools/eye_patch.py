"""TAU's eyes on our faces: the eye region of TAU's demo head (the lids as thick flesh resting on the eyeball, their edge
rolling in to touch it, the crease, the lower lid's roll, the corners) grafted onto MHR's base face, each of its points
riding the MHR triangle under it, so every slider, the sculpt, a photo's fit and the expressions carry it; its own
blink, the lids turning over the eyeball about its centre (DECISIONS 2026-10-31, the night, later: "ideally we want
TAU's look for the eyes, eyelid shape and then make it modifiable through some basic shape keys").

    python tools/eye_patch.py make [--blend PATH]   the graft, from TAU's .blend (vendor/tau/procedural_human_hair.blend)
                                                    into Content/Studio/Bodies/MHR_eyes.bin (git-ignored)
    python tools/eye_patch.py preview               clay pictures: TAU, MHR, MHR with the eyes, open and shut, and on
                                                    another body (Saved/Story/_look/eyes/)
    python tools/eye_patch.py check                 EYEPATCH: the graft's numbers (below)

How it's made (inside Blender's module, `vendor/blender/.venv`): TAU's head at multires level 2 lined up on MHR's base
face (a similarity fitted over the upper face round the eyes, the eyes themselves left out); the left eye's region taken
as TAU's own loops: the band where the skin meets the eyeball (80 points), loops outward over the lids to the 19th and
inward into the socket to the 5th (the lining, inside the eyeball, hidden by it); its outer loops (12 to 19) eased onto
MHR's skin, so its edge lies on MHR's; MHR's triangles inside that edge hidden and the gap between the two edges
stitched; the right eye the left mirrored. Each point keeps the MHR triangle nearest it and its barycentric weights:
the Studio moves it by its triangle's points' moves (`v = v0 + sum(b * (P - P0))`, MHR's own blink left out), the
export carries those as `_MHRP`/`_MHRW`. The blink: each point of a lid turned about the eyeball's centre on the head's
x axis by its share of the angle that closes the opening where it is (the upper lid 85%, the lower 15%, the lining and
the lid's edge whole, fading out by the 13th loop): the lids slide over the eyeball and meet, never through it.

The licence: TAU's pack is CC BY-SA 4.0 (docs/TAU_HAIR.md); its demo head looks like Blender Studio's Human Base Meshes
body (CC0: the same object names), which would make the graft free to share. Until that's checked against the bundle
itself, what this makes stays on the machine (Content/Studio/Bodies/MHR_eyes.bin is git-ignored).
"""
import argparse
import json
import struct
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BPY = ROOT / "vendor" / "blender" / ".venv" / "bin" / "python"
BLEND = ROOT / "vendor" / "tau" / "procedural_human_hair.blend"
OUTDIR = ROOT / "Saved" / "eye_patch"                # the lined-up head's cache, the job
BIN = ROOT / "Content" / "Studio" / "Bodies" / "MHR_eyes.bin"   # (git-ignored: what's made from TAU's head stays on the machine for now)
LOOK = ROOT / "Saved" / "Story" / "_look" / "eyes"
K_OUT, K_IN, K_EASE, K_BLINK = 21, 5, 16, 13      # loops outward kept, inward kept (the lining), where the easing onto MHR starts (after TAU's crease, about the 12th, and the fold over it), where the blink fades out
UPPER_SHARE = 0.85                                 # of the closing angle: the upper lid's, the rest the lower's

# ---- the file -----------------------------------------------------------------------------------------------------------

ARRAYS = [("pos", "f4", 3), ("tri", "u4", 1), ("bary", "f4", 3), ("ring", "i2", 1), ("blink", "f4", 1), ("membrane", "f4", 1),
          ("uv", "f4", 2), ("mhrv", "i4", 1), ("faces", "u4", 3), ("hide", "u4", 1), ("contact", "u4", 1), ("lash", "u4", 1), ("fade", "f4", 1)]


def write_bin(path, header, sides):
    import numpy as np
    blobs, at = [], 0
    for side in ("L", "R"):
        h = header["sides"][side]
        for name, dt, w in ARRAYS:
            a = np.ascontiguousarray(sides[side][name], dtype=dt).reshape(-1)
            h[name] = {"at": at, "count": int(a.size // w), "type": dt, "width": w}
            blobs.append(a.tobytes()); at += a.nbytes
            pad = (-at) % 4; blobs.append(b"\0" * pad); at += pad
    hj = json.dumps(header).encode("utf-8"); hj += b" " * ((-len(hj)) % 4)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(struct.pack("<I", len(hj)) + hj + b"".join(blobs))


def read_bin(path=BIN):
    import numpy as np
    data = Path(path).read_bytes(); (hl,) = struct.unpack_from("<I", data, 0)
    h = json.loads(data[4:4 + hl].decode("utf-8")); base = 4 + hl; out = {"header": h}
    for side in ("L", "R"):
        s = h["sides"][side]; o = dict(eye=s["eye"])
        for name, dt, w in ARRAYS:
            m = s[name]; a = np.frombuffer(data, dt, m["count"] * w, base + m["at"])
            o[name] = a.reshape(-1, w) if w > 1 else a
        out[side] = o
    return out


def line_up(job, M, P0, T, bvhM):
    """TAU's head at multires 2 in MHR's frame, lined up on MHR's base face: (A, faces, scale, rotation, translation, eyes)"""
    import bpy
    import numpy as np
    from mathutils import Vector
    bpy.ops.wm.open_mainfile(filepath=job["blend"])
    toM = lambda A: np.c_[A[:, 0], A[:, 2], -A[:, 1]]        # Blender (z up, -y forward) -> MHR (y up, +z forward), metres
    tau = bpy.data.objects["GEO-body_female_realistic"]
    eyes = {}
    for s in "LR":
        eo = bpy.data.objects[f"GEO-body_female_realistic.eye.{s}"]; mw = np.array(eo.matrix_world)
        EV = toM((np.c_[np.array([v.co for v in eo.data.vertices]), np.ones(len(eo.data.vertices))] @ mw.T)[:, :3])
        c = toM(np.array(eo.matrix_world.translation)[None])[0]
        front = EV[np.argmax((EV - c)[:, 2])]
        eyes[s] = dict(c=c, r=float(np.median(np.linalg.norm(EV - c, axis=1))), f=(front - c) / np.linalg.norm(front - c))
    mr = [m for m in tau.modifiers if m.type == "MULTIRES"][0]; mr.levels = 2
    dg = bpy.context.evaluated_depsgraph_get(); dg.update()
    te = tau.evaluated_get(dg); tm = te.to_mesh(); tw = np.array(te.matrix_world)
    TV = toM((np.c_[np.array([v.co for v in tm.vertices]), np.ones(len(tm.vertices))] @ tw.T)[:, :3])
    TF = [tuple(p.vertices) for p in tm.polygons]
    te.to_mesh_clear()
    opening = {}
    for s, nm in (("L", "eyesClosed_L"), ("R", "eyesClosed_R")):
        i = M["expr_names"].index(nm); moved = M["expr_idx"][np.linalg.norm(M["expr"][i], axis=1) > 0.002]; opening[s] = P0[moved].mean(0)
    # a similarity, from the eyeballs' fronts on MHR's openings and as far apart, then ICP over the upper face round the
    # eyes (19 to 40 mm from the eyeballs' centres), the worst 15% of pairs left out each round
    tf = {s: eyes[s]["c"] + eyes[s]["r"] * eyes[s]["f"] for s in "LR"}
    S = float(np.linalg.norm(opening["L"] - opening["R"]) / np.linalg.norm(eyes["L"]["c"] - eyes["R"]["c"]))
    R = np.eye(3); t = (opening["L"] + opening["R"]) / 2 - S * (tf["L"] + tf["R"]) / 2
    X = lambda A: S * A @ R.T + t
    last = None
    for it in range(120):
        A = X(TV); cs = [X(eyes[s]["c"][None])[0] for s in "LR"]
        dd = np.min(np.stack([np.linalg.norm(A - c, axis=1) for c in cs]), 0)
        sel = np.nonzero((dd > 0.019) & (dd < 0.040) & (A[:, 2] > (cs[0][2] + cs[1][2]) / 2 - 0.03))[0][::3]
        src, dst = [], []
        for i in sel:
            loc, nrm, idx, dist = bvhM.find_nearest(Vector(A[i]))
            if loc is not None and dist < 0.01: src.append(TV[i]); dst.append(np.array(loc))
        src, dst = np.array(src), np.array(dst)
        res = np.linalg.norm(X(src) - dst, axis=1); keep = res < np.percentile(res, 85); src, dst = src[keep], dst[keep]
        mu_s, mu_d = src.mean(0), dst.mean(0); A0, B0 = src - mu_s, dst - mu_d
        U_, Sg, Vt = np.linalg.svd(B0.T @ A0 / len(src)); D = np.diag([1, 1, np.sign(np.linalg.det(U_ @ Vt))])
        R = U_ @ D @ Vt; S = float(np.trace(np.diag(Sg) @ D) / (A0 ** 2).sum(1).mean()); t = mu_d - S * mu_s @ R.T
        now = (S, float(res.mean()))
        if last and abs(now[0] - last[0]) < 2e-5 and abs(now[1] - last[1]) < 2e-6: break
        last = now
    print(f"EYEPATCH lined up in {it + 1} rounds: scale {S:.4f}, the skin round the eyes within {np.median(res) * 1000:.2f} mm (median)")
    return X(TV), TF, S, R, t, eyes


# ---- inside Blender's module --------------------------------------------------------------------------------------------

def inside(job_path):
    import bpy
    import numpy as np
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    sys.path.insert(0, str(ROOT / "tools" / "character"))
    import mhr
    job = json.loads(Path(job_path).read_text(encoding="utf-8"))
    M = mhr.load(); P0 = M["points"]; T = M["tris"]; UV = M["uv"]
    bvhM = BVHTree.FromPolygons([tuple(v) for v in P0], [tuple(f) for f in T])
    cache = OUTDIR / "lined_up.npz"; OUTDIR.mkdir(parents=True, exist_ok=True)
    if cache.exists() and cache.stat().st_mtime > Path(job["blend"]).stat().st_mtime:
        z = np.load(cache, allow_pickle=True); A, TF, S, R, t = z["A"], list(map(tuple, z["TF"])), float(z["S"]), z["R"], z["t"]
        eyes = z["eyes"].item(); TF = [tuple(int(i) for i in f if i >= 0) for f in z["TF"]]
        print("EYEPATCH the lined-up head from the last make")
    else:
        A, TF, S, R, t, eyes = line_up(job, M, P0, T, bvhM)
        np.savez(cache, A=A, TF=np.array([list(f) + [-1] * (4 - len(f)) for f in TF]), S=S, R=R, t=t, eyes=np.array(eyes, dtype=object))
    X = lambda Q: S * Q @ R.T + t
    eye = {s: dict(c=X(eyes[s]["c"][None])[0], r=eyes[s]["r"] * S, f=eyes[s]["f"] @ R.T) for s in "LR"}
    # MHR's strip over each eye (the triangles its blink squeezes shut: a fifth of their area or less shut): a photo's
    # eyeball is projected onto their UVs, so nothing of the graft takes its place or its UVs from them
    shutP = P0.copy()
    for nm in ("eyesClosed_L", "eyesClosed_R"):
        e = M["expr_names"].index(nm); shutP[M["expr_idx"]] += M["expr"][e]
    ar = lambda Q: np.linalg.norm(np.cross(Q[T[:, 1]] - Q[T[:, 0]], Q[T[:, 2]] - Q[T[:, 0]]), axis=1)
    strip = (ar(shutP) < 0.2 * ar(P0)) & (np.min(np.stack([np.linalg.norm(P0[T].mean(1) - eye[s]["c"], axis=1) for s in "LR"]), 0) < 0.03)
    skinT = np.nonzero(~strip)[0]
    bvhS = BVHTree.FromPolygons([tuple(v) for v in P0], [tuple(f) for f in T[skinT]])
    print(f"EYEPATCH MHR's strips over the eyes: {int(strip.sum())} triangles (left out of the binding)")

    # 2. the left eye's region as TAU's own loops
    c, r = eye["L"]["c"], eye["L"]["r"]
    near = np.linalg.norm(A - c, axis=1) < 0.034
    faces = [f for f in TF if all(near[i] for i in f)]
    adj = {}
    for f in faces:
        for a, b in zip(f, f[1:] + f[:1]): adj.setdefault(a, set()).add(b); adj.setdefault(b, set()).add(a)
    off = np.linalg.norm(A - c, axis=1) - r; fwd = (A - c)[:, 2]
    contact = sorted({a for a, nb in adj.items() for b in nb if off[a] >= 0 > off[b] and fwd[a] > 0 and fwd[b] > 0})
    ring = {a: 0 for a in contact}

    def grow(start, ok, K, sign):
        cur = set(start)
        for k in range(1, K + 1):
            nxt = {b for a in cur for b in adj.get(a, ()) if b not in ring and ok(b)}
            for b in nxt: ring[b] = sign * k
            cur = nxt
    K_OUT_, K_EASE_ = job.get("out_loops", K_OUT), job.get("ease_loops", K_EASE)
    grow(contact, lambda b: off[b] >= 0, K_OUT_, 1)
    grow(contact, lambda b: off[b] < 0, K_IN, -1)
    keepF = [f for f in faces if all(i in ring for i in f)]
    used = sorted({i for f in keepF for i in f}); idx = {v: k for k, v in enumerate(used)}
    V = A[used].copy(); RING = np.array([ring[v] for v in used])
    tris = []
    for f in keepF:
        q = [idx[i] for i in f]
        if len(q) == 3: tris.append(q)
        else:                                            # a quad split along its shorter diagonal
            d02 = np.linalg.norm(V[q[0]] - V[q[2]]); d13 = np.linalg.norm(V[q[1]] - V[q[3]])
            tris += [[q[0], q[1], q[2]], [q[0], q[2], q[3]]] if d02 <= d13 else [[q[0], q[1], q[3]], [q[1], q[2], q[3]]]
    tris = np.array(tris)
    print(f"EYEPATCH the left eye's region: {len(V)} points, {len(tris)} triangles, the contact band {len(contact)} points")

    # the lash line: the loop where the lid's edge turns from facing the eye to facing out (its normal radial)
    nrm = np.zeros_like(V)
    for a, b, d in tris: n = np.cross(V[b] - V[a], V[d] - V[a]); nrm[a] += n; nrm[b] += n; nrm[d] += n
    nrm /= np.linalg.norm(nrm, axis=1, keepdims=True) + 1e-12
    if np.mean(np.sum(nrm * (V - c), 1)[RING > 6]) < 0: nrm = -nrm; tris = tris[:, [0, 2, 1]]   # (outward: the face's front)
    radial = np.sum(nrm * (V - c) / np.linalg.norm(V - c, axis=1, keepdims=True), 1)
    print("EYEPATCH the loops' normals against the eyeball's radius:", " ".join(f"{k}:{np.mean(radial[RING == k]):.2f}" for k in range(-2, 12)))
    plateau = max(np.mean(radial[RING == k]) for k in range(5, 11))
    lash_ring = next((k for k in range(1, 8) if np.mean(radial[RING == k]) >= 0.6 * plateau), 3)
    print(f"EYEPATCH the lash line: loop {lash_ring} (the edge's normal radial: {np.mean(radial[RING == lash_ring]):.2f})")

    def mirror(side):                                    # the left as it is, the right the left mirrored
        Vs = V * (np.array([1, 1, 1]) if side == "L" else np.array([-1, 1, 1]))
        Ts = tris if side == "L" else tris[:, [0, 2, 1]]
        es = dict(c=eye["L"]["c"] * (1 if side == "L" else np.array([-1, 1, 1])), r=r, f=eye["L"]["f"] * (1 if side == "L" else np.array([-1, 1, 1])))
        return Vs.copy(), Ts.copy(), es

    def loops_of(T_):                                    # every boundary loop of a triangle set (edges used once), each in order
        cnt = {}
        for a, b, d in T_:
            for e in ((a, b), (b, d), (d, a)): k = tuple(sorted(e)); cnt[k] = cnt.get(k, 0) + 1
        nb = {}
        for (a, b), n in cnt.items():
            if n == 1: nb.setdefault(a, []).append(b); nb.setdefault(b, []).append(a)
        out, seen = [], set()
        for st in sorted(nb):
            if st in seen: continue
            L_, prev = [st], None; seen.add(st)
            while True:
                nxt = [x for x in nb[L_[-1]] if x != prev and (x == st or x not in seen)]
                if not nxt or nxt[0] == st: break
                prev = L_[-1]; L_.append(nxt[0]); seen.add(nxt[0])
            out.append(L_)
        return out

    sides = {}
    for side in ("L", "R"):
        Vs, Ts, es = mirror(side)
        c_, r_ = es["c"], es["r"]
        # 3. the outer loops eased onto MHR's skin (from the 12th to the 19th), so the edge lies on it
        moved = {}
        for i in np.nonzero(RING >= K_EASE_)[0]:
            loc, n_, fi, dist = bvhM.find_nearest(Vector(Vs[i]))
            if loc is None: continue
            u = (RING[i] - K_EASE_) / (K_OUT_ - K_EASE_); w = u * u * (3 - 2 * u)
            moved.setdefault(int(RING[i]), []).append(float(np.linalg.norm(np.array(loc) - Vs[i])) * w * 1000)
            Vs[i] += w * (np.array(loc) - Vs[i])
        if side == "L": print("EYEPATCH eased onto MHR (mm, mean/max by loop):", " ".join(f"{k}:{np.mean(v):.1f}/{np.max(v):.1f}" for k, v in sorted(moved.items())))
        bl = loops_of(Ts); outer = max(bl, key=lambda L_: (np.mean(RING[L_]), len(L_)))
        print(f"EYEPATCH {side}: boundary loops {[len(L_) for L_ in bl]}, mean loops {[round(float(np.mean(RING[L_])), 1) for L_ in bl]}")
        # 4. MHR's triangles inside that edge hidden (seen from the front, round the eyeball's centre)
        poly = Vs[outer][:, :2] - c_[:2]
        if side == "L": print(f"EYEPATCH the edge reaches {poly[:, 1].max() * 1000:.1f} mm up, {poly[:, 1].min() * 1000:.1f} down, {np.abs(poly[:, 0]).max() * 1000:.1f} across from the eyeball's centre")

        def inside2(p):
            x, y = p[0] - c_[0], p[1] - c_[1]; ins = False
            for k in range(len(poly)):
                x1, y1 = poly[k]; x2, y2 = poly[k - 1]
                if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1: ins = not ins
            return ins
        cand = np.nonzero((np.linalg.norm(P0 - c_, axis=1) < 0.04) & (P0[:, 2] > c_[2] - 0.002))[0]
        print(f"EYEPATCH {side}: the outer loop {len(outer)} points (of {int((RING == K_OUT_).sum())} in loop {K_OUT_}), 2D extent {np.ptp(poly, 0) * 1000}, {len(cand)} MHR points near")
        inV = np.zeros(len(P0), bool); inV[[v for v in cand if inside2(P0[v])]] = True
        candT = np.nonzero(np.any(np.isin(T, cand), 1))[0]
        hide = [ti for ti in candT if inV[T[ti]].any() or inside2(P0[T[ti]].mean(0)) or any(inside2((P0[T[ti][a]] + P0[T[ti][(a + 1) % 3]]) / 2) for a in range(3))]
        if not hide: raise SystemExit(f"EYEPATCH FAIL: no MHR triangle inside the {side} eye's edge")
        hide = np.array(sorted(hide), dtype=np.int64); hidden = np.zeros(len(T), bool); hidden[hide] = True
        hl = loops_of(T[hide])                           # the hidden triangles' boundary: the hole's edge (the longest of its loops)
        area2 = lambda L_: abs(sum(P0[L_[k - 1], 0] * P0[L_[k], 1] - P0[L_[k], 0] * P0[L_[k - 1], 1] for k in range(len(L_)))) / 2
        hole = max(hl, key=area2)
        print(f"EYEPATCH {side}: the hole's loops {[len(L_) for L_ in hl]}, the edge {len(hole)} points")
        # 5. the gap stitched: both loops round the eyeball's centre the same way, walked together by angle
        ang = lambda p: np.arctan2(p[1] - c_[1], p[0] - c_[0])
        def ccw(L_, pts):
            a = np.unwrap([ang(pts[i]) for i in L_]); return L_ if a[-1] > a[0] else L_[::-1]
        outer = ccw(outer, Vs); hole = ccw(hole, P0)
        n0 = len(Vs); hv = {v: n0 + k for k, v in enumerate(hole)}
        Vall = np.r_[Vs, P0[hole]]; RINGs = np.r_[RING, np.full(len(hole), 999)]
        aA = np.array([ang(Vs[i]) for i in outer]); aB = np.array([ang(P0[v]) for v in hole])
        j0 = int(np.argmin(np.abs(np.angle(np.exp(1j * (aB - aA[0]))))))
        B = hole[j0:] + hole[:j0]; aB = np.r_[aB[j0:], aB[:j0]]
        unA = np.unwrap(np.r_[aA, aA[0]]); unA -= unA[0]
        unB = np.unwrap(np.r_[aB, aB[0]]); unB -= unB[0] - np.angle(np.exp(1j * (aB[0] - aA[0])))
        zip_, i, j = [], 0, 0
        while i < len(outer) or j < len(B):
            ai, bj = outer[i % len(outer)], hv[B[j % len(B)]]
            if j >= len(B) or (i < len(outer) and unA[i + 1] <= unB[j + 1]):
                zip_.append([ai, outer[(i + 1) % len(outer)], bj]); i += 1
            else:
                zip_.append([ai, hv[B[(j + 1) % len(B)]], bj]); j += 1
        zip_ = np.array(zip_)
        e1 = Vall[zip_[:, 1]] - Vall[zip_[:, 0]]; e2 = Vall[zip_[:, 2]] - Vall[zip_[:, 0]]
        flip = np.cross(e1, e2)[:, 2] < 0; zip_[flip] = zip_[flip][:, [0, 2, 1]]
        F_all = np.r_[Ts, zip_]
        # 6. each point on the MHR triangle nearest it (the hole's points on their own)
        tri = np.zeros(len(Vall), np.int64); bary = np.zeros((len(Vall), 3)); mhrv = np.full(len(Vall), -1)
        for k in range(len(Vall)):
            if k >= n0:
                v = hole[k - n0]; ti = int(np.nonzero(np.any(T == v, 1))[0][0]); tri[k] = ti
                bary[k, list(T[ti]).index(v)] = 1; mhrv[k] = v; continue
            loc, n_, fi, dist = bvhS.find_nearest(Vector(Vall[k])); fi = int(skinT[fi])
            a, b, d = P0[T[fi]]; p = np.array(loc)
            v0, v1, v2 = b - a, d - a, p - a; d00, d01, d11, d20, d21 = v0 @ v0, v0 @ v1, v1 @ v1, v2 @ v0, v2 @ v1
            den = d00 * d11 - d01 * d01; w1 = (d11 * d20 - d01 * d21) / den; w2 = (d00 * d21 - d01 * d20) / den
            tri[k] = fi; bary[k] = [1 - w1 - w2, w1, w2]
        # the UVs (what a photo skin or paint shows on it): TAU's lid laid on MHR's by where it is between the opening and
        # the edge, round the eyeball's centre seen from the front: the graft's contact band onto MHR's lid line (the strip's
        # edge), its outer edge onto the hole's, so TAU's lid wears MHR's lid skin (a photo's lid, not its eyeball)
        def radius_at(pts2, th):                         # a loop's distance from the centre at each angle th (seen from the front)
            a_ = np.arctan2(pts2[:, 1], pts2[:, 0]); o_ = np.argsort(a_); a_, rr = a_[o_], np.linalg.norm(pts2, axis=1)[o_]
            return np.interp(th, np.r_[a_ - 2 * np.pi, a_, a_ + 2 * np.pi], np.r_[rr, rr, rr])
        q2 = Vall[:, :2] - c_[:2]; th = np.arctan2(q2[:, 1], q2[:, 0]); rv = np.linalg.norm(q2, axis=1)
        cl0 = np.nonzero(RINGs == 0)[0]; r_in = radius_at(Vall[cl0, :2] - c_[:2], th); r_out = radius_at(Vall[outer, :2] - c_[:2], th)
        stripE = [tuple(sorted(e)) for ti in np.nonzero(strip)[0] for e in ((T[ti][0], T[ti][1]), (T[ti][1], T[ti][2]), (T[ti][2], T[ti][0]))]
        cntE = {}
        for e in stripE: cntE[e] = cntE.get(e, 0) + 1
        lidv = np.array(sorted({v for e, k in cntE.items() if k == 1 for v in e if np.linalg.norm(P0[v] - c_) < 0.03}))
        m_in = radius_at(P0[lidv, :2] - c_[:2], th); m_out = radius_at(P0[hole, :2] - c_[:2], th)
        rho = np.clip((rv - r_in) / np.maximum(r_out - r_in, 1e-6), 0, 1); rt = m_in + rho * (m_out - m_in) + 0.0003 * (rho <= 0)
        uv = np.zeros((len(Vall), 2))
        for k in range(len(Vall)):
            if mhrv[k] >= 0: uv[k] = UV[tri[k]][list(T[tri[k]]).index(mhrv[k])]; continue
            o_ = np.array([c_[0] + rt[k] * np.cos(th[k]), c_[1] + rt[k] * np.sin(th[k]), c_[2] + 0.05])
            loc, n_, fi, dist = bvhS.ray_cast(Vector(o_), Vector((0, 0, -1)), 0.1)
            if loc is None: uv[k] = np.einsum("k,kd->d", bary[k], UV[tri[k]]); continue
            fi = int(skinT[fi]); a, b, d = P0[T[fi]]; p_ = np.array(loc)
            v0, v1, v2 = b - a, d - a, p_ - a; d00, d01, d11, d20, d21 = v0 @ v0, v0 @ v1, v1 @ v1, v2 @ v0, v2 @ v1
            den = d00 * d11 - d01 * d01; w1 = (d11 * d20 - d01 * d21) / den; w2 = (d00 * d21 - d01 * d20) / den
            uv[k] = np.einsum("k,kd->d", np.array([1 - w1 - w2, w1, w2]), UV[fi])
        print(f"EYEPATCH {side}: the UVs laid from MHR's lid ({len(lidv)} points on its lid line)")
        # 7. the blink: each lid point turned about the eyeball's centre on the head's x axis; per x across the eye, the
        # angle (in the y-z plane) between the upper and lower contact points, the upper lid taking 85% of it
        q = Vall - c_; psi = np.arctan2(q[:, 1], q[:, 2])
        cl = [i for i in range(n0) if RINGs[i] == 0]
        xc = q[cl, 0]; inner_i, outer_i = cl[int(np.argmin(xc))], cl[int(np.argmax(xc))]   # the corners: the contact band's ends across the eye
        # upper and lower contact points by their angle against the line between the corners
        x0, x1 = q[inner_i, 0], q[outer_i, 0]; p0_, p1_ = psi[inner_i], psi[outer_i]
        line = lambda x: p0_ + (p1_ - p0_) * np.clip((x - x0) / (x1 - x0), 0, 1)
        up = [i for i in cl if psi[i] > line(q[i, 0])]; lo = [i for i in cl if psi[i] <= line(q[i, 0])]
        def curve(sel):
            o = np.argsort(q[sel, 0]); xs = q[sel, 0][o]; ys = psi[sel][o]; return xs, ys
        xu, pu = curve(up); xl, pl = curve(lo)
        blink = np.zeros(len(Vall))
        xmin, xmax = min(x0, x1), max(x0, x1)
        for k in range(n0):
            x = q[k, 0]
            if x <= xmin or x >= xmax: continue
            psu, psl = np.interp(x, xu, pu), np.interp(x, xl, pl); gap = max(0.0, psu - psl)
            upper = psi[k] > (psu + psl) / 2
            kk = RINGs[k]
            if kk <= 2: w = 1.0                          # the lining and the lid's edge turn whole
            elif kk >= K_BLINK: w = 0.0
            else: u = (kk - 2) / (K_BLINK - 2); w = 1 - u * u * (3 - 2 * u)
            blink[k] = w if upper else -w                # (the angle is the face's own: apply() measures the opening as it is)
        # 7b. an even falloff from the opening (1) to the edge (0), harmonic over the graft's own triangles: the shape keys
        # fade by it, so the room each way is used evenly (TAU's loops bunch up toward the nose)
        fade = np.zeros(len(Vall)); fixed = (RINGs <= 0) | (RINGs >= K_OUT_); fade[RINGs <= 0] = 1
        Ed = np.unique(np.sort(np.r_[F_all[:, [0, 1]], F_all[:, [1, 2]], F_all[:, [2, 0]]], 1), axis=0); deg = np.bincount(Ed.ravel(), minlength=len(Vall))
        for _ in range(6000):
            acc = np.bincount(Ed[:, 0], weights=fade[Ed[:, 1]], minlength=len(Vall)) + np.bincount(Ed[:, 1], weights=fade[Ed[:, 0]], minlength=len(Vall))
            nxt = np.where(fixed, fade, acc / np.maximum(deg, 1))
            if np.abs(nxt - fade).max() < 1e-7: break
            fade = nxt
        # 8. the wet membrane: the lining, the contact band, the lid's edge behind the lash line
        membrane = np.clip(1 - (RINGs - 0) / max(1, lash_ring), 0, 1) * (RINGs < 999)
        membrane[RINGs <= 0] = 1
        sides[side] = dict(pos=Vall, tri=tri, bary=bary, ring=RINGs, blink=blink, membrane=membrane, uv=uv, mhrv=mhrv, faces=F_all, fade=fade,
                           hide=hide, contact=np.array(order_ring(Ts, RING, 0, Vall, c_)), lash=np.array(order_ring(Ts, RING, lash_ring, Vall, c_)))
        sides[side]["eye"] = dict(centre=c_.tolist(), radius=r_, forward=es["f"].tolist())
        print(f"EYEPATCH {side}: {len(Vall)} points ({len(hole)} of them MHR's own round the hole), {len(F_all)} triangles ({len(zip_)} stitching), {len(hide)} MHR triangles hidden")
    header = {"version": 1, "about": "TAU's eye region (tools/eye_patch.py) on MHR's base face: the left eye's loops from TAU's demo head "
                                      "(TAU's Procedural Human Hair, CC BY-SA 4.0; the head looks like Blender Studio's Human Base Meshes, CC0), "
                                      "the right the left mirrored; each point on an MHR triangle (tri, bary), its rest place (pos, metres), "
                                      "its loop (ring: <0 the lining, 0 where it meets the eyeball, >0 outward, 999 MHR's own), its blink "
                                      "(radians about the head's x axis through the eyeball's centre), the wet membrane, its UV on MHR's",
              "align": {"scale": S, "rotation": R.tolist(), "translation": t.tolist()}, "lash_ring": int(lash_ring),
              "loops": {"out": K_OUT_, "in": K_IN, "ease": K_EASE_, "blink": K_BLINK}, "upper_share": UPPER_SHARE,
              "sides": {s: {"eye": sides[s]["eye"]} for s in ("L", "R")}}
    write_bin(Path(job["out"]), header, sides)
    print(f"EYEPATCH written: {job['out']}")


def order_ring(Ts, RING, k, V, c):                      # a loop's points (RING == k) in order round the eyeball's centre, from the outer corner
    import numpy as np
    sel = np.nonzero(RING == k)[0]
    a = np.arctan2(V[sel, 1] - c[1], (V[sel, 0] - c[0]) * np.sign(c[0] or 1))
    return sel[np.argsort(a)].tolist()


# ---- what the graft does to a body (the Studio's and the export's maths, in numpy) -----------------------------------------

KEYS = {"size": 0.0, "crease": 0.0, "fold": 0.0, "tilt": 0.0, "opening": 0.0, "depth": 0.0}   # the eye's shape keys (eyegraft.js SHAPE_KEYS)
PRESETS = {"TAU": {}, "East Asian": {"crease": -0.8, "fold": 0.6, "tilt": 0.25, "opening": -0.3, "depth": 0.35},
           "Caucasian": {"crease": 0.6, "opening": 0.15, "depth": -0.4}}


def _smooth(u):
    import numpy as np
    u = np.clip(u, 0, 1); return u * u * (3 - 2 * u)


def fields(E, side):
    """each point's place for the shape keys: its lid (+1 upper, -1 lower), how far along the opening (0 the inner
    corner, 1 the outer), and the side's sign (x out toward the temple)"""
    import numpy as np
    g = E[side]; c0 = np.array(g["eye"]["centre"]); sx = 1.0 if side == "L" else -1.0
    q = g["pos"] - c0; lx, ly = q[:, 0] * sx, q[:, 1]; cl = g["ring"] == 0
    xin, xout = lx[cl].min(), lx[cl].max(); yin, yout = ly[cl][np.argmin(lx[cl])], ly[cl][np.argmax(lx[cl])]
    line = yin + (yout - yin) * np.clip((lx - xin) / (xout - xin), 0, 1)
    lid = np.where(g["blink"] > 0, 1, np.where(g["blink"] < 0, -1, np.where(ly > line, 1, -1)))
    return lid, (lx - xin) / (xout - xin), sx


def _turn_x(v, c, a):                                   # each point turned about the head's x axis through c by its angle
    import numpy as np
    q = v - c; ca, sa = np.cos(a), np.sin(a)
    return c + np.c_[q[:, 0], q[:, 1] * ca - q[:, 2] * sa, q[:, 1] * sa + q[:, 2] * ca]


def apply(E, side, P, P0, T, blink=0.0, keys=None):
    """the graft's points on a body (P: MHR's points now, P0: MHR's base), shut by blink (0..1), shaped by the keys; and
    its eyeball. Each point moves as its MHR triangle's points do; the eyeball follows the skin round the eye (loops 15
    and out: the face, not the lids) and grows with it; then the keys that move the lids with the eyeball (size, tilt,
    opening, depth); the lid's edge and the lining seated back on the eyeball as they rest on it (to the 4th loop, eased
    out by the 10th); the keys that shape the lid's skin (crease, inner fold); the blink turns each lid point about the
    eyeball's centre on the head's x axis by its share of the angle between the lids where it is, measured on the face as
    it is (the upper lid 85%)"""
    import numpy as np
    k = {**KEYS, **(keys or {})}
    G = E[side]; tri = T[G["tri"]]; base = G["pos"]; ring = G["ring"]; rf = ring.astype(float); own = ring < 999
    v = base + np.einsum("nk,nkd->nd", G["bary"], P[tri] - P0[tri])
    c0 = np.array(G["eye"]["centre"]); r0 = G["eye"]["radius"]
    out = ring >= 15
    c = c0 + (v[out] - base[out]).mean(0)
    sc = np.linalg.norm(v[out] - v[out].mean(0), axis=1).mean() / np.linalg.norm(base[out] - base[out].mean(0), axis=1).mean()
    mm = 0.001 * sc                                      # (a millimetre at this face's size)
    lid, u, sx = fields(E, side)
    tap = _smooth(u / 0.25) * _smooth((1 - u) / 0.2)     # (nothing at the corners)
    fd = G["fade"] if "fade" in G else np.where(own, 1 - _smooth((rf - 8) / 8), 0)   # (1 at the opening, 0 at the edge)
    r = r0 * sc * (1 + 0.08 * k["size"]); c = c + np.array([0, 0, 1.2 * mm * k["depth"]])
    v = v + (v - c) * (0.08 * k["size"] * _smooth(fd / 0.6))[:, None]
    a = np.radians(8) * k["tilt"] * _smooth(fd / 0.5)
    lx, ly = (v[:, 0] - c[0]) * sx, v[:, 1] - c[1]
    v[:, 0] = c[0] + (lx * np.cos(a) - ly * np.sin(a)) * sx; v[:, 1] = c[1] + lx * np.sin(a) + ly * np.cos(a)
    v = _turn_x(v, c, np.where(lid > 0, -np.radians(5), np.radians(2.5)) * k["opening"] * np.abs(G["blink"]) * tap)
    v[:, 2] += 1.2 * mm * k["depth"] * _smooth(fd / 0.6)
    o = np.linalg.norm(base - c0, axis=1) - r0           # each point's height over the eyeball at rest
    u_ = np.clip((rf - 4) / 6, 0, 1); ws = np.where(own, 1 - u_ * u_ * (3 - 2 * u_), 0)
    q = v - c; d = np.linalg.norm(q, axis=1, keepdims=True)
    v = v + q / d * ((r + o * sc)[:, None] - d) * ws[:, None]
    nrm = (v - c) / np.linalg.norm(v - c, axis=1, keepdims=True)
    up = (lid > 0) & own
    if k["crease"] > 0:                                  # a deeper double lid: the fold set in
        b = np.exp(-((rf - 12.5) / 2.5) ** 2) * up * tap; v = v - nrm * (1.0 * mm * k["crease"] * b)[:, None]   # (TAU's crease: about the 12th loop)
    elif k["crease"] < 0:                                # a monolid: the fold filled, the skin over the lid a little lower
        b = np.exp(-((rf - 12) / 3.5) ** 2) * up * tap; v = v + nrm * (1.4 * mm * -k["crease"] * b)[:, None]; v[:, 1] -= 0.8 * mm * -k["crease"] * b
    f = (1 - _smooth(u / 0.3)) * np.exp(-((rf - 7) / 4) ** 2) * _smooth((rf - 3) / 2) * up   # (the lid's edge stays: the skin above it drapes over the corner)
    v = v + k["fold"] * f[:, None] * np.array([-0.8 * mm * sx, -1.2 * mm, 0.4 * mm])
    if blink:
        q = v - c; psi = np.arctan2(q[:, 1], q[:, 2]); x = q[:, 0]; w = G["blink"]
        cl = ring == 0; upc, loc_ = cl & (w >= 0), cl & (w <= 0)   # (the corners in both lids: each closes onto them)
        ou, ol = np.argsort(x[upc]), np.argsort(x[loc_])
        gu = np.interp(x, x[upc][ou], psi[upc][ou]); gl = np.interp(x, x[loc_][ol], psi[loc_][ol])
        past = np.maximum(0, np.maximum(x[cl].min() - x, x - x[cl].max()))   # past the corners: eased out over 1.5 mm (a tilted eye's lid can reach past its corner)
        gap = np.maximum(0, gu - gl) * (1 - _smooth(past / (1.5 * mm)))
        v = _turn_x(v, c, np.where(w > 0, UPPER_SHARE, -(1 - UPPER_SHARE)) * gap * np.abs(w) * blink)
    return v, c, r


def inside_preview(job_path):
    import bpy
    import numpy as np
    from mathutils import Vector
    sys.path.insert(0, str(ROOT / "tools" / "character"))
    import mhr
    job = json.loads(Path(job_path).read_text(encoding="utf-8"))
    E = read_bin(job["bin"]); M = mhr.load(); P0 = M["points"]; T = M["tris"]
    bodies = {"base": P0}
    if job.get("body"): bodies["char"] = np.frombuffer(Path(job["body"]).read_bytes(), dtype=np.float32).reshape(-1, 3).astype(np.float64)
    for ob in list(bpy.data.objects): bpy.data.objects.remove(ob, do_unlink=True)
    toB = lambda A: np.c_[A[:, 0], -A[:, 2], A[:, 1]]
    clay = bpy.data.materials.new("clay"); clay.use_nodes = True; clay.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.62, 0.5, 0.44, 1)
    wet = bpy.data.materials.new("wet"); wet.use_nodes = True; wet.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.62, 0.42, 0.40, 1)
    eyem = bpy.data.materials.new("eye"); eyem.use_nodes = True; eyem.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.75, 0.75, 0.78, 1)
    def obj(name, V, F, mat):
        me = bpy.data.meshes.new(name); me.from_pydata(toB(V).tolist(), [], [list(map(int, f)) for f in F]); me.update()
        for p in me.polygons: p.use_smooth = True
        ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob); ob.data.materials.append(mat); return ob
    sc = bpy.context.scene; sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = 16
    sc.render.resolution_x, sc.render.resolution_y = 480, 340
    sc.world = bpy.data.worlds.new("w"); sc.world.use_nodes = True; sc.world.node_tree.nodes["Background"].inputs[0].default_value = (0.25, 0.25, 0.27, 1)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); cam.data.lens = 100; sc.collection.objects.link(cam); sc.camera = cam
    key = bpy.data.objects.new("key", bpy.data.lights.new("key", "AREA")); key.data.energy = 8; key.data.size = 0.3; sc.collection.objects.link(key)
    hidden = np.zeros(len(T), bool); hidden[E["L"]["hide"]] = True; hidden[E["R"]["hide"]] = True
    shots = []
    for bname, P in bodies.items():
        for blink in (0.0, 1.0):
            made = []
            made.append(obj("mhr", P, T[~hidden], clay))
            for side in ("L", "R"):
                v, c, r = apply(E, side, P, P0, T, blink)
                F = E[side]["faces"]; mem = E[side]["membrane"]
                wetF = mem[F].mean(1) > 0.5
                made.append(obj(f"patch{side}", v, F[~wetF], clay)); made.append(obj(f"wet{side}", v, F[wetF], wet))
                bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=r, location=tuple(toB(c[None])[0]))
                es = bpy.context.active_object; es.data.materials.append(eyem); bpy.ops.object.shade_smooth(); made.append(es)
            e = toB(apply(E, "L", P, P0, T)[1][None])[0]; e[1] -= 0.012
            key.location = Vector((e[0] + 0.15, e[1] - 0.5, e[2] + 0.3)); key.rotation_euler = (1.0, 0, 0.3)
            for vname, (loc, rot) in {"front": (Vector((e[0], e[1] - 0.24, e[2] + 0.004)), (1.5708, 0, 0)), "side": (Vector((e[0] + 0.23, e[1] - 0.05, e[2] + 0.004)), (1.5708, 0, 1.33))}.items():
                cam.location = loc; cam.rotation_euler = rot
                f = f"{job['out']}/{bname}_{'shut' if blink else 'open'}_{vname}.png"; sc.render.filepath = f; bpy.ops.render.render(write_still=True); shots.append(f)
            for ob in made: bpy.data.objects.remove(ob, do_unlink=True)
    print("EYEPATCH pictures:", len(shots))


def cmd_preview(a):
    if not BIN.exists(): sys.exit("EYEPATCH FAIL: no graft yet (python tools/eye_patch.py make)")
    LOOK.mkdir(parents=True, exist_ok=True)
    body = ROOT / "Content" / "Studio" / "People" / (a.person or "_studiotest") / "body.bin"
    job = {"bin": str(BIN), "out": str(LOOK), "body": str(body) if body.exists() else None}
    jp = LOOK / "job.json"; jp.write_text(json.dumps(job), encoding="utf-8")
    r = subprocess.run([str(BPY), str(Path(__file__).resolve()), "--inside-preview", str(jp)], capture_output=True, text=True, timeout=3600)
    jp.unlink(missing_ok=True)
    print("\n".join(l for l in (r.stdout + r.stderr).splitlines() if l.startswith("EYEPATCH")))
    if r.returncode: print((r.stdout + r.stderr)[-3000:]); sys.exit("EYEPATCH FAIL: the pictures didn't finish")
    from PIL import Image, ImageDraw
    names = [n for n in ("base", "char") if (LOOK / f"{n}_open_front.png").exists()]
    cols = [f"{n}_{b}_{v}" for n in names for b in ("open", "shut") for v in ("front", "side")]
    ims = [Image.open(LOOK / f"{c}.png").convert("RGB") for c in cols]; w, h = ims[0].size; per = 4
    sheet = Image.new("RGB", (w * per, (h + 20) * ((len(ims) + per - 1) // per)), (20, 20, 20)); d = ImageDraw.Draw(sheet)
    for k, (im, c) in enumerate(zip(ims, cols)):
        x, y = (k % per) * w, (k // per) * (h + 20); sheet.paste(im, (x, y + 20)); d.text((x + 6, y + 4), c.replace("_", " ").replace("char", "a character"), fill=(230, 230, 230))
    sheet.save(LOOK / "sheet.jpg", quality=88); print(f"EYEPATCH sheet: {(LOOK / 'sheet.jpg').relative_to(ROOT)}")


# ---- the commands ------------------------------------------------------------------------------------------------------

def cmd_check(a):
    """EYEPATCH: the graft as made on this machine (none: nothing to check, said so): the seam (its points round the hole
    MHR's own, its edge on MHR's skin), the right eye the left mirrored, and on MHR's base face and on each character's
    body found: open, nothing of a lid inside the eyeball; shut, the lids meeting (their edges within 0.6 mm) and still
    nothing inside; the lid's edge seated on the eyeball"""
    import numpy as np
    sys.path.insert(0, str(ROOT / "tools" / "character"))
    import mhr
    bad = []
    say = lambda ok, what: (print(("  ok  " if ok else "  BAD ") + what), None if ok else bad.append(what))
    if not BIN.exists():
        print(f"  --  no graft on this machine ({BIN.relative_to(ROOT)}: python tools/eye_patch.py make, from TAU's .blend)")
        print("EYEPATCH ok"); return
    E = read_bin(); M = mhr.load(); P0, T = M["points"], M["tris"]
    for side in ("L", "R"):
        g = E[side]; n = len(g["ring"])
        say(int(g["faces"].max()) < n and len(g["hide"]) > 100, f"{side}: {n} points, {len(g['faces'])} triangles, {len(g['hide'])} of MHR's hidden")
        own = g["mhrv"] >= 0; k = np.array([list(T[t]).index(v) for t, v in zip(g["tri"][own], g["mhrv"][own])])
        say(np.allclose(g["bary"][own][np.arange(own.sum()), k], 1) and np.allclose(g["pos"][own], P0[g["mhrv"][own]], atol=1e-6),
            f"{side}: the seam: its {int(own.sum())} points round the hole are MHR's own")
        edge = (g["ring"] == E["header"]["loops"]["out"])
        tri = T[g["tri"][edge]]; on = np.einsum("nk,nkd->nd", g["bary"][edge], P0[tri])
        say(np.abs(np.linalg.norm(on - g["pos"][edge], axis=1)).max() < 2e-3, f"{side}: its edge {np.abs(np.linalg.norm(on - g['pos'][edge], axis=1)).max() * 1000:.2f} mm off MHR's skin at most (eased onto it)")
    gl, gr = E["L"], E["R"]; m = gl["ring"] < E["header"]["loops"]["ease"]   # (the loops eased onto MHR's skin follow each side's own)
    say(len(gl["ring"]) >= m.sum() and np.allclose(gr["pos"][m] * [-1, 1, 1], gl["pos"][m], atol=1e-6), f"the right eye is the left mirrored (its {int(m.sum())} points inside the easing)")
    bodies = {"MHR's base": P0}
    for b in sorted((ROOT / "Content" / "Studio" / "People").glob("*/body.bin")):
        if b.stat().st_size == P0.size * 4: bodies[b.parent.name] = np.frombuffer(b.read_bytes(), dtype=np.float32).reshape(-1, 3).astype(np.float64)
    tries = [(n, P, {}) for n, P in list(bodies.items())[:4]] + [(f"MHR's base, {pn}", P0, pk) for pn, pk in PRESETS.items() if pk]
    tries += [(f"MHR's base, {kk} {vv:+g}", P0, {kk: vv}) for kk in KEYS for vv in ((-1, 1) if kk != "fold" else (1,))]
    for name, P, keys in tries:
        for side in ("L", "R"):
            g = E[side]; lid = (g["ring"] > 0) & (g["ring"] < 999)
            v0, c, r = apply(E, side, P, P0, T, 0.0, keys); v1, _, _ = apply(E, side, P, P0, T, 1.0, keys)
            ins0 = int((np.linalg.norm(v0[lid] - c, axis=1) < r - 1e-4).sum()); ins1 = int((np.linalg.norm(v1[lid] - c, axis=1) < r - 1e-4).sum())
            cl = np.nonzero(g["ring"] == 0)[0]; up = g["blink"][cl] > 0; lo = g["blink"][cl] <= 0   # (an upper edge point meets the lower lid or a corner)
            U_, L_ = v1[cl][up], v1[cl][lo]; dd = np.linalg.norm(U_[:, None] - L_[None], axis=2).min(1)
            sp = np.sort(np.linalg.norm(U_[:, None] - U_[None], axis=2), 1)[:, 1]   # (each upper edge point's own spacing: at a corner the nearest lower point is a neighbour)
            gap = float(np.max(dd / np.maximum(0.00055, sp)))   # (1: as far as the edge's own spacing, or 0.55 mm)
            seat = np.abs(np.linalg.norm(v0[cl] - c, axis=1) - r).max() * 1000
            if keys and side == "R": continue                 # (the keys are mirrored: the left says it)
            say(ins0 == 0 and ins1 == 0 and gap <= 1.05 and seat < 0.5, f"{name} {side}: the eyeball {r * 1000:.1f} mm; open and shut nothing of the lids inside it ({ins0}, {ins1}); shut the lids meet ({dd.max() * 1000:.2f} mm at most, {gap:.2f} of the edge's own spacing); their edge on it within {seat:.2f} mm")
    print("EYEPATCH " + ("FAIL" if bad else "ok")); sys.exit(1 if bad else 0)


def cmd_make(a):
    blend = Path(a.blend) if a.blend else BLEND
    if not blend.exists(): sys.exit(f"EYEPATCH FAIL: TAU's pack isn't at {blend} (docs/TAU_HAIR.md)")
    if not BPY.exists(): sys.exit("EYEPATCH FAIL: no Blender module (python tools/retarget.py setup)")
    OUTDIR.mkdir(parents=True, exist_ok=True)
    job = {"blend": str(blend), "out": str(BIN)}
    jp = OUTDIR / "job.json"; jp.write_text(json.dumps(job), encoding="utf-8")
    r = subprocess.run([str(BPY), str(Path(__file__).resolve()), "--inside", str(jp)], capture_output=True, text=True, timeout=3600)
    jp.unlink(missing_ok=True)
    print("\n".join(l for l in (r.stdout + r.stderr).splitlines() if l.startswith("EYEPATCH")))
    if r.returncode or not BIN.exists():
        print((r.stdout + r.stderr)[-3000:]); sys.exit("EYEPATCH FAIL: Blender's half didn't finish")


def main():
    if "--inside" in sys.argv: return inside(sys.argv[sys.argv.index("--inside") + 1])
    if "--inside-preview" in sys.argv: return inside_preview(sys.argv[sys.argv.index("--inside-preview") + 1])
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0]); sub = p.add_subparsers(dest="cmd", required=True)
    m = sub.add_parser("make"); m.add_argument("--blend")
    sub.add_parser("check"); pv = sub.add_parser("preview"); pv.add_argument("--person")
    a = p.parse_args()
    {"make": cmd_make, "preview": cmd_preview, "check": cmd_check}.get(a.cmd, lambda a: sys.exit(f"{a.cmd}: not yet"))(a)


if __name__ == "__main__":
    main()
