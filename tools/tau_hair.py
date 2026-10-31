"""TAU's Procedural Human Hair for a Character Studio character's brows and lashes (DECISIONS 2026-10-31, docs/TAU_HAIR.md).

TAU's pack (creamtau.itch.io/procedural-human-hair, CC BY-SA 4.0, by TAU) is a .blend of Geometry Nodes generators for
realistic eyebrows and eyelashes, hair by hair (tapered strands a few hundredths of a millimetre thick, flow, curl,
clumping, noise). It isn't ours and stays out of git: the user downloads it and puts it at
vendor/tau/procedural_human_hair.blend (git-ignored). Blender's module runs it headless (tools/retarget.py setup):

    python tools/tau_hair.py presets                     TAU's presets in the .blend (brows: Bushy, Feather, Fluffy,
                                                         Laminated, Natural; lashes: Clumped, Fox, Manga, Straight, Volume)
    python tools/tau_hair.py make --person NAME [--brows Natural] [--lashes Straight] [--preview]
                                                         the character's export (People/NAME/export/NAME.glb) as TAU's
                                                         surface; the strands pinned to MHR's triangles and written to
                                                         People/NAME/tau/strands.json (the Character Studio builds the
                                                         brows and lashes from them, riding the face; its export carries
                                                         them to the desk and Godot); --preview a Cycles close-up there
    python tools/tau_hair.py check                       TAUHAIR: the pinning (a strand bound to a triangle's frame comes
                                                         back exactly, rides the triangle when it turns); with Blender's
                                                         module, TAU's .blend and an export, a make measured

How TAU's generators are fed (read from the .blend, 2026-10-31): each grows on a surface mesh ("Body Object", the
curves' surface and its UV map) from a density vertex group ("Eyebrows Density", "Eyelashes Density"); the brows'
shape comes from a mask image in the surface's UV layout; every setting is placed by six measurements of the face in
metres (Inner/Outer Eyebrow Distance, Lower/Upper Eyebrow Height, Inner/Outer Eye Distance); the lashes are sorted upper
or lower by their root's surface normal (TAU's lid margins face forward and down above the eye, forward and up below).
Ours: the export's skin welded into one surface; the brows' group, TAU's UV layout (so its own mask applies) and its
brow measurements carried from TAU's own body laid over ours by the eyeballs (their middle, their distance); a lid
margin strip along each opening's outline as cut (the export's extras) facing as TAU's do, the lashes' group on it, the
eye measurements from the outlines. Measured on the test character: Natural brows 629 strands 5.5 mm, Straight lashes
617 strands 4.5 mm (on TAU's own body 710 at 5.7 mm and 520 at 5.0 mm).
"""
import argparse
import json
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PEOPLE = ROOT / "Content" / "Studio" / "People"
BLEND = ROOT / "vendor" / "tau" / "procedural_human_hair.blend"
BPY = ROOT / "vendor" / "blender" / ".venv" / "bin" / "python"
BROW_UP = {"R": [70, 63, 105, 66, 107], "L": [300, 293, 334, 296, 336]}    # MediaPipe's brow rows, outer to inner
BROW_LO = {"R": [46, 53, 52, 65, 55], "L": [276, 283, 282, 295, 285]}
TAU_BROW = {"Inner Eyebrow Distance": 0.027773, "Outer Eyebrow Distance": 0.104971,   # TAU's own body's (its presets'), carried over by the eyes
            "Lower Eyebrow Height": 1.54726, "Upper Eyebrow Height": 1.55874}


# ---- the export: its skin's corners, their MHR points, the openings ------------------------------------------------------

def read_glb(path):
    import numpy as np
    f = Path(path).read_bytes(); n = struct.unpack("<I", f[12:16])[0]; j = json.loads(f[20:20 + n]); off = 20 + n + 8
    def acc(i):
        a = j["accessors"][i]; bv = j["bufferViews"][a["bufferView"]]; k = {"VEC3": 3, "VEC2": 2, "VEC4": 4, "SCALAR": 1}[a["type"]]
        dt = {5126: np.float32, 5121: np.uint8, 5123: np.uint16, 5125: np.uint32}[a["componentType"]]
        return np.frombuffer(f, dtype=dt, count=a["count"] * k, offset=off + bv.get("byteOffset", 0) + a.get("byteOffset", 0)).reshape(-1, k)
    return f, j, off, acc


def face_of(person):
    """the export's skin: each MHR point's place (where a corner sits on it alone), MHR's triangles, the openings"""
    import numpy as np
    sys.path.insert(0, str(ROOT / "tools" / "character"))
    import mhr
    glb = PEOPLE / person / "export" / f"{person}.glb"
    if not glb.exists():
        sys.exit(f"TAUHAIR FAIL: no export at {glb.relative_to(ROOT)} (the Character Studio's Export for desk / Unreal)")
    f, j, off, acc = read_glb(glb)
    node = [nd for nd in j["nodes"] if (nd.get("name") or "").endswith("_skin")][0]
    at = j["meshes"][node["mesh"]]["primitives"][0]["attributes"]
    P, I, W = acc(at["POSITION"]), acc(at["_MHRP"]).astype(int), acc(at["_MHRW"])
    M = mhr.load(); pos = np.full((len(M["points"]), 3), np.nan)
    for k in range(3):
        sel = W[:, k] > 0.999
        pos[I[sel, k]] = P[sel]
    lifted = pos.copy()
    body = PEOPLE / person / "body.bin"                          # the face as the Studio has it: the export brings the lids forward
    if body.exists() and body.stat().st_size == pos.size * 4:    # onto the eyeballs (index.html lidsRest), the Studio doesn't
        flat = np.frombuffer(body.read_bytes(), dtype=np.float32).reshape(-1, 3).astype(np.float64)
        moved = np.abs(np.nan_to_num(lifted - flat)).max(axis=0)
        if moved[0] < 1e-4 and moved[1] < 1e-4:                  # (the same body: only z differs, by the lift)
            pos = np.where(np.isnan(lifted), np.nan, flat)
    return {"glb": glb, "pos": pos, "lifted": lifted, "tris": M["tris"], "openings": {s: np.array(v) for s, v in node["extras"]["openings"].items()}}


def landmark(face, i, L):
    t = face["tris"][L["tri"][i]]; b = L["bary"][i]
    return sum(b[k] * face["pos"][int(t[k])] for k in range(3))


# ---- pinning: a strand as offsets in an MHR triangle's frame at its root --------------------------------------------------

def frame(A, B, C):
    """a triangle's frame: x along its first edge, z its normal (MHR's winding), y across, each as long as the triangle's
    own size (the square root of twice its area): offsets in it follow the face's scale and its local stretch (the export
    is in a larger space than the Character Studio's own, 6.7% on the test character)"""
    import numpy as np
    cr = np.cross(B - A, C - A); size = np.sqrt(np.linalg.norm(cr))
    e1 = B - A; e1 = e1 / np.linalg.norm(e1) * size; nz = cr / np.linalg.norm(cr) * size
    return e1, np.cross(nz / size, e1), nz


def closest_on_triangles(p, A, B, C):
    """the closest point to p on each triangle (A, B, C: arrays of corners) and its barycentric weights (Ericson, Real-Time
    Collision Detection 5.1.5: the corner, edge or face region p falls in)"""
    import numpy as np
    ab, ac = B - A, C - A
    ap, bp, cp = p - A, p - B, p - C
    d1, d2, d3, d4, d5, d6 = (ab * ap).sum(1), (ac * ap).sum(1), (ab * bp).sum(1), (ac * bp).sum(1), (ab * cp).sum(1), (ac * cp).sum(1)
    va, vb, vc = d3 * d6 - d5 * d4, d5 * d2 - d1 * d6, d1 * d4 - d3 * d2
    bary = np.zeros((len(A), 3)); done = np.zeros(len(A), bool)
    def put(m, f):
        nonlocal done
        m = m & ~done
        if m.any(): bary[m] = f(m)
        done = done | m
    with np.errstate(divide="ignore", invalid="ignore"):
        put((d1 <= 0) & (d2 <= 0), lambda m: [1.0, 0.0, 0.0])
        put((d3 >= 0) & (d4 <= d3), lambda m: [0.0, 1.0, 0.0])
        put((vc <= 0) & (d1 >= 0) & (d3 <= 0), lambda m: (lambda v: np.c_[1 - v, v, 0 * v])(np.nan_to_num(d1[m] / (d1[m] - d3[m]))))
        put((d6 >= 0) & (d5 <= d6), lambda m: [0.0, 0.0, 1.0])
        put((vb <= 0) & (d2 >= 0) & (d6 <= 0), lambda m: (lambda w: np.c_[1 - w, 0 * w, w])(np.nan_to_num(d2[m] / (d2[m] - d6[m]))))
        put((va <= 0) & (d4 - d3 >= 0) & (d5 - d6 >= 0), lambda m: (lambda w: np.c_[0 * w, 1 - w, w])(np.nan_to_num((d4[m] - d3[m]) / ((d4[m] - d3[m]) + (d5[m] - d6[m])))))
        put(np.ones(len(A), bool), lambda m: (lambda den: np.c_[1 - (vb[m] + vc[m]) * den, vb[m] * den, vc[m] * den])(np.nan_to_num(1.0 / (va[m] + vb[m] + vc[m]))))
    q = bary[:, :1] * A + bary[:, 1:2] * B + bary[:, 2:] * C
    return q, bary


def pin(strands, pos, tris, ok):
    """each strand pinned to the nearest allowed MHR triangle at its root: [tri, b0, b1, b2] and its points as offsets in
    the triangle's frame at that point (the Character Studio rebuilds it from the face as it is: tools/character/tau.js)"""
    import numpy as np
    cand = np.nonzero(ok)[0]; A, B, C = pos[tris[cand, 0]], pos[tris[cand, 1]], pos[tris[cand, 2]]
    out = []
    for s in strands:
        q, bary = closest_on_triangles(s[0], A, B, C); k = int(np.argmin(np.linalg.norm(q - s[0], axis=1)))
        t = int(cand[k]); b = bary[k]; O = q[k]; e1, e2, nz = frame(A[k], B[k], C[k])
        sz2 = float(np.dot(e1, e1))                             # (the frame's axes are each the triangle's size long)
        offs = [[float(np.dot(p - O, e1)) / sz2, float(np.dot(p - O, e2)) / sz2, float(np.dot(p - O, nz)) / sz2] for p in s]
        out.append({"tri": t, "bary": [round(float(x), 6) for x in b], "offsets": [[round(x, 6) for x in o] for o in offs]})
    return out


def unlift(S, face, ok):
    """TAU grows on the export, whose lids are brought forward onto the eyeballs (up to 3 mm: index.html lidsRest); the
    Studio wears the strands on its own face, which isn't. Each strand moved back whole by the lift where its root sits
    (its triangle's on the export, at its barycentric place), so it is pinned to the Studio's face with its own shape: a
    strand pinned to the lifted lids came back on the Studio's turned with its triangles' tilt, across the eye. The
    export lifts it again with the lids (liftWith)"""
    import numpy as np
    if "lifted" not in face: return S
    pos, up, tris = face["pos"], face["lifted"], face["tris"]
    cand = np.nonzero(ok)[0]; A, B, C = up[tris[cand, 0]], up[tris[cand, 1]], up[tris[cand, 2]]
    lift = np.nan_to_num(up - pos)
    out = []
    for s in S:
        q, bary = closest_on_triangles(s[0], A, B, C); k = int(np.argmin(np.linalg.norm(q - s[0], axis=1)))
        t = tris[cand[k]]; b = bary[k]
        out.append(s - (b[0] * lift[t[0]] + b[1] * lift[t[1]] + b[2] * lift[t[2]]))
    return out


def unpin(p, pos, tris):
    import numpy as np
    t = tris[p["tri"]]; A, B, C = pos[t[0]], pos[t[1]], pos[t[2]]; b = p["bary"]
    O = b[0] * A + b[1] * B + b[2] * C; e1, e2, nz = frame(A, B, C)
    return np.array([O + o[0] * e1 + o[1] * e2 + o[2] * nz for o in p["offsets"]])


LOWER_KEEP, LOWER_LENGTH = 0.45, 0.7                            # what's kept of TAU's lower lashes, and their length


def tidy_lashes(S, R, openings):
    """TAU's lashes tidied on our lids (in the export's frame: x across, y up, z toward the viewer). None shorter than
    1.2 mm: TAU grew some a third of a millimetre long, a dot on the lid. Each lash clear of the opening seen from the
    front past its first fifth: an upper lash turned up about the lid's line at its root as little as clears it, a
    lower lash down, and a lower lash 30 degrees under the forward way at least (TAU's came out toward the viewer: dots
    again); one that 40 degrees doesn't clear is left out. The lower lashes thinned to LOWER_KEEP and shortened to
    LOWER_LENGTH (MetaHuman's lower lashes are a soft fringe; TAU's a second row as dark as the upper: a spider's
    legs under the eye). S: the strands (points each), R: their radii; the openings
    (32 points each, 0..16 the lower lid outer to inner, then the upper). Returns the strands, their radii, and how
    many were short, turned and crossing"""
    import numpy as np
    def inside(poly, pts):
        x, y = pts[:, 0][:, None], pts[:, 1][:, None]; xi, yi = poly[:, 0][None], poly[:, 1][None]
        xj, yj = np.roll(xi, 1, 1), np.roll(yi, 1, 1)
        hit = ((yi > y) != (yj > y)) & (x < (xj - xi) * (y - yi) / np.where(yj == yi, 1e-12, yj - yi) + xi)
        return hit.sum(1) % 2 == 1
    def turn(v, k, a):                                          # Rodrigues: the rows of v about the unit axis k by a
        return v * np.cos(a) + np.cross(k, v) * np.sin(a) + np.outer(v @ k, k) * (1 - np.cos(a))
    out_s, out_r, short, turned, crossing = [], [], 0, 0, 0
    for s, r in zip(S, R):
        seg = np.linalg.norm(np.diff(s, axis=0), axis=1); L = seg.sum()
        if L < 0.0012:
            short += 1; continue
        root = s[0]; O = np.asarray(openings["L" if root[0] > 0 else "R"]); n = len(O)
        i = int(np.argmin(np.linalg.norm(O[:, :2] - root[:2], axis=1)))
        lower = root[1] < O[:, 1].mean() if i in (0, n // 2) else i < n // 2
        k = O[(i + 1) % n] - O[(i - 1) % n]; k = k / np.linalg.norm(k)
        sign = 1.0 if turn(np.array([[0.0, 0.0, 1.0]]), k, 0.1)[0, 1] > 0 else -1.0   # the way that turns a lash up
        if lower:
            sign = -sign
            if (int(abs(root[0]) * 1e6) * 2654435761 + int(abs(root[1]) * 1e6)) % 1000 >= LOWER_KEEP * 1000:
                continue                                        # thinned (the same lashes every bake: by where each grows)
            s = root + (s - root) * LOWER_LENGTH; seg = seg * LOWER_LENGTH; L = L * LOWER_LENGTH
        far = (np.r_[0.0, np.cumsum(seg)] / L) > 0.2
        best = None
        for step in range(21):
            q = root + turn(s - root, k, sign * np.radians(2.0 * step))
            d = q[-1] - root
            if not inside(O[:, :2], q[far, :2]).any() and (not lower or np.degrees(np.arctan2(d[1], d[2])) <= -30.0):
                best = q; turned += step > 0; break
        if best is None:
            crossing += 1; continue
        out_s.append(best); out_r.append(r)
    return out_s, out_r, short, turned, crossing


def allowed(face, kind, strands):
    """the triangles a strand may be pinned to: near the strands; for the lashes never one inside an opening (the
    opening's region squeezes shut on a blink: a lash pinned there would fold into the eye)"""
    import numpy as np
    pos, tris = face["pos"], face["tris"]; good = ~np.isnan(pos[tris]).any(axis=(1, 2))
    cen = np.nan_to_num(pos[tris].mean(1)); roots = np.array([s[0] for s in strands])
    near = np.zeros(len(tris), bool)
    for r in roots[:: max(1, len(roots) // 400)]: near |= np.linalg.norm(cen - r, axis=1) < 0.012
    ok = good & near
    if kind == "lashes":
        for s, ring in face["openings"].items():
            c = ring.mean(0); xy = ring[:, :2]
            inside = np.zeros(len(tris), bool)
            for k in range(len(xy)):                            # the centroid inside the outline seen from the front
                a, b = xy[k], xy[(k + 1) % len(xy)]
                cross = ((a[1] > cen[:, 1]) != (b[1] > cen[:, 1])) & (cen[:, 0] < (b[0] - a[0]) * (cen[:, 1] - a[1]) / (b[1] - a[1] + 1e-12) + a[0])
                inside ^= cross
            ok &= ~(inside & (np.abs(cen[:, 2] - c[2]) < 0.012))
    return ok


# ---- make ---------------------------------------------------------------------------------------------------------------

def cmd_make(a):
    import numpy as np
    if not BLEND.exists(): sys.exit(f"TAUHAIR FAIL: TAU's pack isn't at {BLEND.relative_to(ROOT)} (download it: creamtau.itch.io/procedural-human-hair)")
    if not BPY.exists(): sys.exit("TAUHAIR FAIL: no Blender module (python tools/retarget.py setup)")
    face = face_of(a.person)
    L = json.loads((ROOT / "Content" / "Studio" / "Bodies" / "MHR_landmarks.json").read_text(encoding="utf-8"))
    out = PEOPLE / a.person / "tau"; out.mkdir(parents=True, exist_ok=True)
    job = {"glb": str(face["glb"]), "blend": str(BLEND), "brow": a.brows, "lash": a.lashes, "preview": a.preview,
           "openings": {s: v.tolist() for s, v in face["openings"].items()}, "out": str(out),
           "raw": str(out / "raw.json")}
    jp = out / "job.json"; jp.write_text(json.dumps(job), encoding="utf-8")
    r = subprocess.run([str(BPY), str(Path(__file__).resolve()), "--inside", str(jp)], capture_output=True, text=True, timeout=3600)
    said = [l for l in (r.stdout + r.stderr).splitlines() if l.startswith("TAU")]
    print("\n".join(said))
    if r.returncode or not Path(job["raw"]).exists():
        print((r.stdout + r.stderr)[-3000:]); sys.exit("TAUHAIR FAIL: Blender's half didn't finish")
    raw = json.loads(Path(job["raw"]).read_text(encoding="utf-8")); Path(job["raw"]).unlink(); jp.unlink()   # (only strands.json stays: the export's recipe carries tau/*.json)
    res = {"about": "TAU's Procedural Human Hair (CC BY-SA 4.0, by TAU: creamtau.itch.io/procedural-human-hair) grown on this "
                    "character's export by tools/tau_hair.py; each strand pinned to an MHR triangle at its root (tri, bary, its "
                    "points as offsets in the triangle's frame: x along its first edge, z its normal) and its radius per point (m)",
           "made_from": face["glb"].name, "made_at": face["glb"].stat().st_mtime}
    for kind in ("brows", "lashes"):
        if kind not in raw: continue
        S, rad = [np.array(s).reshape(-1, 3) for s in raw[kind]["strands"]], raw[kind]["radius"]
        if kind == "lashes":                                    # clear of the eye, no dots (tidy_lashes)
            S, rad, short, turned, crossing = tidy_lashes(S, rad, face["openings"])
            print(f"TAU lashes tidied: {short} under 1.2 mm left out, {turned} turned clear of the eye, {crossing} that wouldn't clear left out")
        ok = allowed(face, kind, S)
        S = unlift(S, face, ok)                                 # back onto the Studio's lids (the export's are brought forward)
        res[kind] = {"preset": raw[kind]["preset"], "radius": rad, "strands": pin(S, face["pos"], face["tris"], ok)}
        back = max(float(np.abs(unpin(p, face["pos"], face["tris"]) - s).max()) for p, s in zip(res[kind]["strands"], S))
        lens = [np.linalg.norm(np.diff(s, axis=0), axis=1).sum() for s in S]
        print(f"TAU {kind}: {len(S)} strands of {raw[kind]['preset']}, {np.mean(lens) * 1000:.1f} mm mean, pinned (back within {back * 1e6:.1f} µm)")
    (out / "strands.json").write_text(json.dumps(res, separators=(",", ":")), encoding="utf-8")
    print(f"TAU wrote {(out / 'strands.json').relative_to(ROOT)}" + (f" and {out.relative_to(ROOT)}/preview.png" if a.preview else ""))
    print("TAUHAIR ok")


def cmd_presets(a):
    if not BLEND.exists(): sys.exit(f"no {BLEND.relative_to(ROOT)}")
    r = subprocess.run([str(BPY), str(Path(__file__).resolve()), "--inside-presets", str(BLEND)], capture_output=True, text=True, timeout=600)
    print("\n".join(l for l in r.stdout.splitlines() if l.startswith("TAU")))


# ---- Blender's half (run with Blender's module) --------------------------------------------------------------------------

def build_from_glb(path):
    """the export's skin as one welded surface (its corners joined where they sit on the same point, its UVs per corner,
    its baked colours) and its eyeballs with their baked paint, in Blender's frame (Z up, facing -Y)"""
    import bpy
    import numpy as np
    f, j, off, acc = read_glb(path)
    def image(ti):
        if ti is None: return None
        src = j["images"][j["textures"][ti["index"]]["source"]]; bv = j["bufferViews"][src["bufferView"]]
        t = tempfile.NamedTemporaryFile(suffix=".png", delete=False); t.write(f[off + bv.get("byteOffset", 0): off + bv.get("byteOffset", 0) + bv["byteLength"]]); t.close()
        im = bpy.data.images.load(t.name); im.pack(); return im
    def material(mi, name):
        g = j["materials"][mi]; m = bpy.data.materials.new(name); m.use_nodes = True
        bsdf = m.node_tree.nodes["Principled BSDF"]; im = image(g.get("pbrMetallicRoughness", {}).get("baseColorTexture"))
        if im:
            tx = m.node_tree.nodes.new("ShaderNodeTexImage"); tx.image = im; m.node_tree.links.new(tx.outputs[0], bsdf.inputs["Base Color"])
        bsdf.inputs["Roughness"].default_value = 0.5
        return m
    def mesh(node, name, weld):
        pr = j["meshes"][node["mesh"]]["primitives"][0]; at = pr["attributes"]
        P = acc(at["POSITION"]).astype(np.float64); UV = acc(at["TEXCOORD_0"]) if "TEXCOORD_0" in at else None
        T = acc(pr["indices"]).reshape(-1, 3).astype(np.int64) if "indices" in pr else np.arange(len(P)).reshape(-1, 3)
        Pb = np.c_[P[:, 0], -P[:, 2], P[:, 1]]                  # glTF (Y up) to Blender (Z up)
        if weld:
            _, uid, inv = np.unique(np.round(Pb / 1e-6).astype(np.int64), axis=0, return_index=True, return_inverse=True)
            verts, faces = Pb[uid], inv.reshape(-1)[T]
        else:
            verts, faces = Pb, T
        me = bpy.data.meshes.new(name); me.from_pydata(verts.tolist(), [], faces.tolist()); me.update()
        if UV is not None:
            uvl = me.uv_layers.new(name="UVMap"); cu = UV[T.reshape(-1)]
            uvl.data.foreach_set("uv", np.c_[cu[:, 0], 1.0 - cu[:, 1]].reshape(-1).astype(np.float32))
        ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
        ob.data.materials.append(material(pr["material"], name + "_mat"))
        for p in me.polygons: p.use_smooth = True
        return ob
    skin, eyes = None, []
    for nd in j["nodes"]:
        nm = nd.get("name") or ""
        if "mesh" not in nd: continue
        if nm.endswith("_skin"): skin = mesh(nd, nm, True)
        elif "_eye_" in nm: eyes.append(mesh(nd, nm, False))
    return skin, eyes


def inside(jp):
    import bpy, bmesh
    import numpy as np
    from mathutils import Matrix, Vector
    job = json.loads(Path(jp).read_text(encoding="utf-8"))
    bpy.ops.wm.open_mainfile(filepath=job["blend"])             # TAU's generators, presets and materials
    keep = {f"Eyebrows - {job['brow']}", f"Eyelashes - {job['lash']}"}
    missing = [k for k in keep if k not in bpy.data.objects]
    if missing: print(f"TAU no such preset: {missing}"); sys.exit(1)
    tau_body = bpy.data.objects["GEO-body_female_realistic"]
    tau_eyes = [np.array(bpy.data.objects[f"GEO-body_female_realistic.eye.{s}"].matrix_world.translation) for s in "LR"]
    for ob in list(bpy.data.objects):
        if ob.name not in keep and ob is not tau_body: bpy.data.objects.remove(ob, do_unlink=True)
    skin, eyes = build_from_glb(job["glb"])
    g2b = lambda p: np.array([p[0], -p[2], p[1]])
    # TAU's lid margins along our openings: a strip from each outline forward and out (up on the upper lid, down on the
    # lower), facing as TAU's own do (measured on its body: 52° below forward on the upper lid, 36° above on the lower:
    # 1.4 mm forward and 1.1 up, 0.9 forward and 1.24 down, blended round the corners); unseen
    bm = bmesh.new(); bm.from_mesh(skin.data); strip = []; nfaces = 0
    for s in "LR":
        ring = np.array([g2b(p) for p in job["openings"][s]]); c = ring.mean(0); A, B = [], []
        for p in ring:
            o = p - c; o[1] = 0.0; o /= max(np.linalg.norm(o), 1e-9)
            t = (o[2] + 1) / 2                                  # 1 on the upper lid's middle, 0 on the lower's
            fwd, out = 0.0009 + 0.0005 * t, 0.00124 - 0.00014 * t
            A.append(bm.verts.new(tuple(p))); B.append(bm.verts.new(tuple(p + np.array([0.0, -fwd, 0.0]) + o * out)))
        for i in range(len(ring)):
            f_ = bm.faces.new((A[i], A[(i + 1) % len(ring)], B[(i + 1) % len(ring)], B[i])); f_.normal_update(); nfaces += 1
            if f_.normal.y > 0: f_.normal_flip()
        strip += A + B
    bm.verts.index_update(); bm.faces.index_update(); strip_ids = [v.index for v in strip]
    strip_faces = [f.index for f in bm.faces][-nfaces:]
    bm.to_mesh(skin.data); bm.free()
    unseen = bpy.data.materials.new("lid margin (unseen)"); unseen.use_nodes = True; nt = unseen.node_tree
    nt.nodes.remove(nt.nodes["Principled BSDF"]); tr = nt.nodes.new("ShaderNodeBsdfTransparent"); nt.links.new(tr.outputs[0], nt.nodes["Material Output"].inputs[0])
    skin.data.materials.append(unseen)
    for fi in strip_faces: skin.data.polygons[fi].material_index = len(skin.data.materials) - 1
    skin.vertex_groups.new(name="Eyelashes Density").add(strip_ids, 1.0, "REPLACE")
    # TAU's body over ours by the eyeballs (their middle, their distance): its brows' group and its UV layout to our skin
    ours = {}
    for e in eyes:
        c = np.array(e.matrix_world @ (sum((v.co for v in e.data.vertices), Vector()) / len(e.data.vertices))); ours["L" if c[0] > 0 else "R"] = c
    sc = float(np.linalg.norm(ours["L"] - ours["R"]) / np.linalg.norm(tau_eyes[0] - tau_eyes[1]))
    mid_t, mid_o = (tau_eyes[0] + tau_eyes[1]) / 2, (ours["L"] + ours["R"]) / 2
    tau_body.parent = None
    tau_body.matrix_world = Matrix.Translation(Vector(mid_o)) @ Matrix.Scale(sc, 4) @ Matrix.Translation(Vector(-mid_t)) @ tau_body.matrix_world
    for mm in list(tau_body.modifiers): tau_body.modifiers.remove(mm)
    skin.data.uv_layers["UVMap"].name = "MHR_UV"                # TAU's layout into a layer of its own (the transfer matches layers by
    skin.data.uv_layers.new(name="UVMap"); skin.vertex_groups.new(name="Eyebrows Density")   # name: ours is set aside meanwhile)
    dt = skin.modifiers.new("tau", "DATA_TRANSFER"); dt.object = tau_body
    dt.use_vert_data = True; dt.data_types_verts = {"VGROUP_WEIGHTS"}; dt.vert_mapping = "POLYINTERP_NEAREST"
    dt.layers_vgroup_select_src = "Eyebrows Density"; dt.layers_vgroup_select_dst = "NAME"
    dt.use_loop_data = True; dt.data_types_loops = {"UV"}; dt.loop_mapping = "POLYINTERP_NEAREST"
    dt.layers_uv_select_src = "UVMap"; dt.layers_uv_select_dst = "NAME"
    bpy.context.view_layer.objects.active = skin
    with bpy.context.temp_override(object=skin, active_object=skin): bpy.ops.object.modifier_apply(modifier="tau")
    bpy.data.objects.remove(tau_body, do_unlink=True)
    skin.data.uv_layers["UVMap"].name = "TAU_UV"; skin.data.uv_layers["MHR_UV"].name = "UVMap"
    skin.data.uv_layers.active = skin.data.uv_layers["UVMap"]; skin.data.uv_layers["UVMap"].active_render = True   # the skin's own UVs for its colours
    # the six measurements TAU places every setting by: the eyes' from our outlines, the brows' TAU's own carried over
    corners = [(np.abs(np.array([g2b(p) for p in job["openings"][s]])[:, 0]).min(), np.abs(np.array([g2b(p) for p in job["openings"][s]])[:, 0]).max()) for s in "LR"]
    measures = {"Inner Eye Distance": 2 * float(np.mean([c[0] for c in corners])), "Outer Eye Distance": 2 * float(np.mean([c[1] for c in corners]))}
    for k, v in TAU_BROW.items(): measures[k] = v * sc if "Distance" in k else float(mid_o[2] + sc * (v - mid_t[2]))
    print("TAU measurements for this face:", {k: round(v, 4) for k, v in measures.items()}, f"(TAU laid over ours at {sc:.3f})")
    for name in sorted(keep):
        ob = bpy.data.objects[name]; ob.parent = None; ob.matrix_world = skin.matrix_world.copy()
        ob.data.surface = skin; ob.data.surface_uv_map = "TAU_UV"; ob.hide_viewport = False; ob.hide_render = False
        m = [x for x in ob.modifiers if x.type == "NODES"][0]
        for it in m.node_group.interface.items_tree:
            if it.item_type != "SOCKET" or it.in_out != "INPUT": continue
            if it.name == "Body Object": m[it.identifier] = skin
            if it.name == "Viewport Display Percentage": m[it.identifier] = 100.0
            if it.name in measures: m[it.identifier] = measures[it.name]
            if it.name == "UV Map Name": m[it.identifier] = "TAU_UV"
    dg = bpy.context.evaluated_depsgraph_get(); dg.update()
    raw = {}
    for name in sorted(keep):
        ob = bpy.data.objects[name]; c = ob.evaluated_get(dg).data
        P = np.array([p.position for p in c.points]) if len(c.points) else np.zeros((0, 3)); R = np.array([p.radius for p in c.points]) if len(c.points) else np.zeros(0)
        offs = [cv.first_point_index for cv in c.curves] + [len(c.points)]
        mw = np.array(ob.matrix_world); Pw = (np.c_[P, np.ones(len(P))] @ mw.T)[:, :3]
        kind = "brows" if name.startswith("Eyebrows") else "lashes"
        raw[kind] = {"preset": name, "strands": [[float(x) for q in Pw[offs[i]:offs[i + 1]] for x in (q[0], q[2], -q[1])] for i in range(len(offs) - 1)],   # back to glTF's frame
                     "radius": [[round(float(r), 7) for r in R[offs[i]:offs[i + 1]]] for i in range(len(offs) - 1)]}
        print(f"TAU grew {len(offs) - 1} {kind} ({name})")
    Path(job["raw"]).write_text(json.dumps(raw), encoding="utf-8")
    if job.get("preview"):                                       # a close-up from the front: Cycles on the CPU, soft key and fill, grey ground
        sc_ = bpy.context.scene; sc_.render.engine = "CYCLES"; sc_.cycles.device = "CPU"; sc_.cycles.samples = 48
        sc_.render.resolution_x, sc_.render.resolution_y = 1200, 520
        try: sc_.view_settings.view_transform = "AgX"
        except TypeError: pass
        try: sc_.cycles.use_denoising = True; sc_.cycles.denoiser = "OPENIMAGEDENOISE"
        except Exception: sc_.cycles.use_denoising = False
        e = mid_o + np.array([0.0, -0.012, 0.0])
        cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); cam.data.lens = 135; sc_.collection.objects.link(cam)
        cam.location = Vector((e[0], e[1] - 0.42, e[2] + 0.012)); cam.rotation_euler = (1.5708, 0, 0); sc_.camera = cam
        for nm, en, size, loc, rot in (("key", 6, 0.35, (0.25, -0.8, 0.45), (0.95, 0, 0.3)), ("fill", 2, 0.5, (-0.5, -0.6, 0.0), (1.5708, 0, -0.7))):
            ld = bpy.data.lights.new(nm, "AREA"); ld.energy = en; ld.size = size; lo = bpy.data.objects.new(nm, ld); sc_.collection.objects.link(lo)
            lo.location = Vector((e[0] + loc[0], e[1] + loc[1], e[2] + loc[2])); lo.rotation_euler = rot
        if sc_.world is None: sc_.world = bpy.data.worlds.new("w")
        sc_.world.use_nodes = True; sc_.world.node_tree.nodes["Background"].inputs[0].default_value = (0.06, 0.06, 0.065, 1)
        sc_.render.filepath = str(Path(job["out"], "preview.png")); bpy.ops.render.render(write_still=True)


def inside_presets(blend):
    import bpy
    bpy.ops.wm.open_mainfile(filepath=blend)
    for kind in ("Eyebrows", "Eyelashes"):
        print(f"TAU {kind.lower()}: " + ", ".join(sorted(o.name.split(" - ", 1)[1] for o in bpy.data.objects if o.name.startswith(kind + " - "))))


# ---- check --------------------------------------------------------------------------------------------------------------

def cmd_check(a):
    import numpy as np
    bad = []
    say = lambda ok, what: (print(("  ok  " if ok else "  BAD ") + what), None if ok else bad.append(what))
    rng = np.random.default_rng(3)                              # the pinning on made-up triangles: exact, and riding a turn
    pos = rng.normal(size=(60, 3)) * 0.05; tris = np.array([[i, i + 1, i + 2] for i in range(0, 57, 3)])
    strands = [pos[tris[k]].mean(0) + np.cumsum(rng.normal(size=(6, 3)) * 0.001, axis=0) for k in range(10)]
    pins = pin(strands, pos, tris, np.ones(len(tris), bool))
    back = max(float(np.abs(unpin(p, pos, tris) - s).max()) for p, s in zip(pins, strands))
    say(back < 1e-6, f"a strand pinned to its triangle comes back within {back * 1e9:.1f} nm")
    th = 0.7; Rz = np.array([[np.cos(th), -np.sin(th), 0], [np.sin(th), np.cos(th), 0], [0, 0, 1]]); moved = pos @ Rz.T + np.array([0.01, 0.02, 0.0])
    ride = max(float(np.abs(unpin(p, moved, tris) - (s @ Rz.T + np.array([0.01, 0.02, 0.0]))).max()) for p, s in zip(pins, strands))
    say(ride < 1e-6, f"turned and moved with its triangle, the strand goes with it within {ride * 1e9:.1f} nm")
    big = pos * 1.067; grow = max(float(np.abs(unpin(p, big, tris) - s * 1.067).max()) for p, s in zip(pins, strands))
    say(grow < 1e-6, f"in a space 6.7% larger (the export's against the Character Studio's), it comes back 6.7% larger within {grow * 1e9:.1f} nm")
    person = next((p for p in ("_studiotest", "_skintest") if (PEOPLE / p / "export" / f"{p}.glb").exists()), None)
    if BLEND.exists() and BPY.exists() and person:
        r = subprocess.run([sys.executable, str(Path(__file__).resolve()), "make", "--person", person], capture_output=True, text=True, timeout=3600)
        res = json.loads((PEOPLE / person / "tau" / "strands.json").read_text()) if r.returncode == 0 else {}
        face = face_of(person) if res else None
        for kind, lo, hi, l0, l1 in (("brows", 300, 1500, 3.5, 8.0), ("lashes", 250, 1200, 3.0, 7.0)):
            S = res.get(kind, {}).get("strands", [])
            ln = np.mean([np.linalg.norm(np.diff(unpin(s, face["pos"], face["tris"]), axis=0), axis=1).sum() for s in S]) * 1000 if S else 0
            say(lo <= len(S) <= hi and l0 <= ln <= l1, f"{person}'s {kind}: {len(S)} strands, {ln:.1f} mm mean (wanted {lo} to {hi}, {l0} to {l1} mm)")
    else:
        print(f"  --  a make not tried: {'no TAU pack' if not BLEND.exists() else 'no Blender module' if not BPY.exists() else 'no export'} (the pinning above is the check's offline part)")
    print("TAUHAIR " + ("FAIL" if bad else "ok"))
    return 1 if bad else 0


def main():
    if "--inside" in sys.argv: return inside(sys.argv[sys.argv.index("--inside") + 1])
    if "--inside-presets" in sys.argv: return inside_presets(sys.argv[sys.argv.index("--inside-presets") + 1])
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0]); sub = ap.add_subparsers(dest="cmd", required=True)
    mk = sub.add_parser("make"); mk.add_argument("--person", required=True); mk.add_argument("--brows", default="Natural"); mk.add_argument("--lashes", default="Straight")
    mk.add_argument("--preview", action="store_true")
    sub.add_parser("presets"); sub.add_parser("check")
    a = ap.parse_args()
    return {"make": cmd_make, "presets": cmd_presets, "check": cmd_check}[a.cmd](a)


if __name__ == "__main__":
    sys.exit(main())
