"""Step 6: a simple wig. The splat traced into a low-poly shell (under a thousand triangles, no strands): round the
head, cell by cell (azimuth by height: a cap of elevation bands over the crown, cylinder bands down the sides), the
outer line is where the hair's Gaussians end and the inner line where they begin (never inside the head), and the
shell is the two surfaces closed by a rim. Cells with no hair (the face) are left open. Textured by projecting the
keyed frames onto it: each texel takes the colour of the frames that face it, weighted by how squarely. Written:
  wig.json  positions, normals, uvs, indices (the page draws it), the report
  wig.png   the texture: the outer surface in the top half, the inner in the bottom
  wig.obj   the same mesh with UVs, for anything else"""
import json
from pathlib import Path

import numpy as np

from .clumps import apply_align
from .common import HeadField, head_frame, jload, jsave, mhr_scale, project_np, imread


def build(out, az=18, cap_rows=5, cyl_rows=8, tex=256, p_out=93, p_in=7, min_count=4, smooth=1):
    out = Path(out)
    sp = {k: v.astype(float) for k, v in np.load(out / "splat.npz").items() if k in ("mu", "scales", "quat", "opacity", "rgb")}
    head = np.load(out / "head.npz")
    pts, lm = head["points"].astype(float), head["landmarks"].astype(float)
    fr = head_frame(lm); S = mhr_scale(fr["h"]); field = HeadField(pts, fr, S)
    al = jload(out / "align.json")
    if al is None: raise SystemExit("no align.json: run the clumps step first (it fits the splat onto the head)")
    g = apply_align(sp, al)
    keep = g["opacity"] > 0.25
    mu, op, rgb = g["mu"][keep], g["opacity"][keep], g["rgb"][keep]
    C, X, U, F = field.C, fr["X"], fr["U"], fr["F"]
    d = mu - C
    h = d @ U; x = d @ X; z = d @ F
    azim = np.arctan2(x, z)                                               # 0 at the front, round to the left
    rho = np.hypot(x, z)
    r_sph = np.linalg.norm(d, axis=1)
    el = np.arcsin(np.clip(h / (r_sph + 1e-9), -1, 1))
    y_low = np.percentile(h[h < 0], 3) if (h < 0).any() else -0.05 * S
    rows = cap_rows + cyl_rows                                            # row 0 the crown's top, row cap_rows the equator, the last the hem
    # each Gaussian's cell
    ai = np.minimum(az - 1, ((azim + np.pi) / (2 * np.pi) * az).astype(int))
    above = h >= 0
    ri = np.where(above, np.minimum(cap_rows - 1, ((np.pi / 2 - el) / (np.pi / 2) * cap_rows).astype(int)),
                  cap_rows + np.minimum(cyl_rows - 1, (h / y_low * cyl_rows).astype(int)))
    radius = np.where(above, r_sph, rho)
    outer = np.full((rows, az), np.nan); inner = np.full((rows, az), np.nan); count = np.zeros((rows, az), int)
    colour = np.zeros((rows, az, 3))
    for j in range(rows):
        for i in range(az):
            m = (ri == j) & (ai == i)
            count[j, i] = int(m.sum())
            if count[j, i] >= min_count:
                w = op[m]
                outer[j, i] = np.percentile(radius[m], p_out); inner[j, i] = np.percentile(radius[m], p_in)
                colour[j, i] = (rgb[m] * w[:, None]).sum(0) / w.sum()
    present = ~np.isnan(outer)
    # fill lone holes from the neighbours, then smooth (round the azimuth)
    def neigh_mean(A):
        B = np.where(np.isnan(A), 0, A); N = (~np.isnan(A)).astype(float)
        acc = np.zeros_like(B); cnt = np.zeros_like(N)
        for dj in (-1, 0, 1):
            for di in (-1, 0, 1):
                acc += np.roll(np.roll(B, dj, 0), di, 1); cnt += np.roll(np.roll(N, dj, 0), di, 1)
        return np.where(cnt > 0, acc / np.maximum(cnt, 1), np.nan)
    for _ in range(smooth):
        o2, i2 = neigh_mean(outer), neigh_mean(inner)
        outer = np.where(present, 0.5 * outer + 0.5 * o2, outer); inner = np.where(present, 0.5 * inner + 0.5 * i2, inner)
    # the cell centres as directions; the inner never inside the head
    def place(j, i, r):
        a = -np.pi + (i + 0.5) * 2 * np.pi / az
        if j < cap_rows:
            e = np.pi / 2 - (j + 0.5) * (np.pi / 2) / cap_rows
            return C + r * (np.cos(e) * (np.sin(a) * X + np.cos(a) * F) + np.sin(e) * U)
        y = y_low * (j - cap_rows + 0.5) / cyl_rows
        return C + U * y + r * (np.sin(a) * X + np.cos(a) * F)
    for j in range(rows):
        for i in range(az):
            if not present[j, i]: continue
            if j < cap_rows:
                p = place(j, i, 1.0); rr, R, _ = field.radius(p[None]); Rh = float(R[0]) if R[0] > 0 else 0.1 * S
                inner[j, i] = max(inner[j, i], Rh + 0.004 * S)
            else:
                inner[j, i] = max(inner[j, i], 0.03 * S)
            outer[j, i] = max(outer[j, i], inner[j, i] + 0.008 * S)
    # the vertices: a grid per surface, the azimuth seam doubled; present cells only
    V, N, UVs, idx = [], [], [], {}
    def vert(shell, j, i):
        key = (shell, j, i % az)
        if key in idx and i < az: return idx[key]
        ii = i % az
        r = (outer if shell == 0 else inner)[j, ii]
        p = place(j, ii, r)
        # the normal: out from the axis (cap: from the centre), flipped for the inner shell
        n = (p - C) if j < cap_rows else (p - C) - U * ((p - C) @ U)
        n = n / (np.linalg.norm(n) + 1e-9) * (1 if shell == 0 else -1)
        V.append(p); N.append(n); UVs.append([i / az, (0.5 if shell == 0 else 0.0) + 0.5 * (1 - j / (rows - 1))])
        k = len(V) - 1
        if i < az: idx[key] = k
        return k
    tris = []
    def quad(a, b, c, dd, flip=False):
        if flip: tris.extend([[a, c, b], [a, dd, c]])
        else: tris.extend([[a, b, c], [a, c, dd]])
    cell_quads = []
    for j in range(rows - 1):
        for i in range(az):
            i1 = i + 1
            if not (present[j, i] and present[j, i1 % az] and present[j + 1, i] and present[j + 1, i1 % az]): continue
            cell_quads.append((j, i))
            quad(vert(0, j, i), vert(0, j, i1), vert(0, j + 1, i1), vert(0, j + 1, i))
            quad(vert(1, j, i), vert(1, j, i1), vert(1, j + 1, i1), vert(1, j + 1, i), flip=True)
    # the rim: every grid edge with a quad on one side only joins outer to inner
    edges = {}
    for (j, i) in cell_quads:
        for e in (((j, i), (j, i + 1)), ((j, i + 1), (j + 1, i + 1)), ((j + 1, i + 1), (j + 1, i)), ((j + 1, i), (j, i))):
            k = tuple(sorted([(e[0][0], e[0][1] % az), (e[1][0], e[1][1] % az)]))
            edges[k] = edges.get(k, 0) + 1
    for (a, b), n in edges.items():
        if n != 1: continue
        quad(vert(0, a[0], a[1]), vert(0, b[0], b[1]), vert(1, b[0], b[1]), vert(1, a[0], a[1]))
    V = np.array(V); N = np.array(N); UVs = np.array(UVs); T = np.array(tris, int).reshape(-1, 3)
    # the texture: the frames projected
    texture = project_frames(out, al, V, N, UVs, T, tex, rows, az, outer, inner, colour, present, place, cap_rows, S, C, X, U, F, y_low, cyl_rows)
    rep = dict(triangles=int(len(T)), vertices=int(len(V)), cells=int(present.sum()), of=int(rows * az),
               thickness_mm=dict(median=round(float(np.nanmedian(outer - inner) * 1000), 1), max=round(float(np.nanmax(outer - inner) * 1000), 1)),
               hem_m=round(float(-y_low), 3))
    jsave(out / "wig.json", dict(about="a low-poly wig shell traced from the splat; tools/character/gshair/wig.py", positions=V.round(5).tolist(),
                                 normals=N.round(4).tolist(), uvs=UVs.round(5).tolist(), indices=T.reshape(-1).tolist(), report=rep))
    with open(out / "wig.obj", "w", encoding="utf-8") as f:
        f.write("# a wig shell from a hair splat (tools/character/gshair/wig.py); metres, Y up, facing +Z\nmtllib wig.mtl\n")
        for p in V: f.write(f"v {p[0]:.5f} {p[1]:.5f} {p[2]:.5f}\n")
        for uv in UVs: f.write(f"vt {uv[0]:.5f} {uv[1]:.5f}\n")
        for n in N: f.write(f"vn {n[0]:.4f} {n[1]:.4f} {n[2]:.4f}\n")
        f.write("usemtl wig\n")
        for t in T: f.write(f"f {t[0] + 1}/{t[0] + 1}/{t[0] + 1} {t[1] + 1}/{t[1] + 1}/{t[1] + 1} {t[2] + 1}/{t[2] + 1}/{t[2] + 1}\n")
    (out / "wig.mtl").write_text("newmtl wig\nKd 1 1 1\nmap_Kd wig.png\n", encoding="utf-8")
    import cv2
    cv2.imwrite(str(out / "wig.png"), cv2.cvtColor((np.clip(texture, 0, 1) * 255).astype(np.uint8), cv2.COLOR_RGBA2BGRA))
    return rep


def project_frames(out, al, V, N, UVs, T, tex, rows, az, outer, inner, colour, present, place, cap_rows, S, C, X, U, F, y_low, cyl_rows, n_frames=45):
    """the keyed frames onto the shell's texture (W = tex, H = tex: the outer surface in the top half, the inner in
    the bottom): each texel's point and normal from its cell, the colour from the frames that face it. Where no
    frame saw a texel, the splat's own colour there"""
    import cv2
    from .common import Capture
    cap = Capture(out); cams = cap.cameras()
    R_al, t_al, s_al = np.array(al["R"], float), np.array(al["t"], float), float(al["s"])
    keyed = cap.dir / "frames_keyed"
    H = W = tex
    acc = np.zeros((H, W, 3)); wsum = np.zeros((H, W)); base = np.zeros((H, W, 3)); has = np.zeros((H, W), bool)
    # every texel's 3D point and normal: its place between the cell centres (the radius interpolated, the angle and
    # height continuous), so the texture isn't a mosaic of cells
    P3 = np.zeros((H, W, 3)); N3 = np.zeros((H, W, 3))
    def radius_at(grid, jf, uf):
        j0 = int(np.clip(np.floor(jf - 0.5), 0, rows - 1)); j1 = min(j0 + 1, rows - 1); tj = np.clip(jf - 0.5 - j0, 0, 1)
        i0 = int(np.floor(uf - 0.5)) % az; i1 = (i0 + 1) % az; ti = (uf - 0.5 - np.floor(uf - 0.5))
        vals = [(grid[j0, i0], (1 - tj) * (1 - ti)), (grid[j0, i1], (1 - tj) * ti), (grid[j1, i0], tj * (1 - ti)), (grid[j1, i1], tj * ti)]
        vals = [(r, w) for r, w in vals if not np.isnan(r)]
        if not vals: return None
        return sum(r * w for r, w in vals) / (sum(w for _, w in vals) + 1e-9)
    for shell in (0, 1):
        grid = outer if shell == 0 else inner
        for v in range(H // 2):
            jf = v / (H // 2 - 1) * (rows - 1)                               # the row, continuous (0 the crown)
            j = min(int(jf), rows - 1)
            for u in range(W):
                uf = u / W * az; i = min(int(uf), az - 1)
                if not present[j, i]: continue
                r = radius_at(grid, jf, uf)
                if r is None: continue
                a = -np.pi + uf * 2 * np.pi / az
                if jf < cap_rows - 0.5:
                    e = np.pi / 2 - (jf + 0.5) * (np.pi / 2) / cap_rows
                    p = C + r * (np.cos(e) * (np.sin(a) * X + np.cos(a) * F) + np.sin(e) * U); n = p - C
                else:
                    y = y_low * (jf - cap_rows + 0.5) / cyl_rows
                    p = C + U * y + r * (np.sin(a) * X + np.cos(a) * F); n = r * (np.sin(a) * X + np.cos(a) * F)
                n = n / (np.linalg.norm(n) + 1e-9) * (1 if shell == 0 else -1)
                row = v if shell == 0 else H // 2 + v
                P3[row, u] = p; N3[row, u] = n; has[row, u] = True; base[row, u] = colour[j, i]
    pts = P3[has]; nrm = N3[has]
    # back into the splat's world for the cameras
    ps = ((pts - t_al) @ R_al) / s_al
    frames = cams["frames"]; pick = frames[:: max(1, len(frames) // n_frames)]
    W0 = cap.meta["width"]
    for f in pick:
        src = keyed / f"{f['name']}.png"
        img = imread(src if src.exists() else cap.frame(f["name"]))
        hm = imread(cap.hair_mask(f["name"]), grey=True)
        R, t = np.array(f["R"], float), np.array(f["t"], float); K = f["K"]
        cam_c = -R.T @ t
        cam_s = ((cam_c * s_al) @ R_al.T) + t_al                           # the camera centre in the head's frame
        facing = ((cam_s - pts) / (np.linalg.norm(cam_s - pts, axis=1, keepdims=True) + 1e-9) * nrm).sum(1)
        p2, z = project_np(ps, R, t, K)
        u = p2[:, 0].round().astype(int); v = p2[:, 1].round().astype(int)
        ok = (z > 0.01) & (u >= 0) & (u < img.shape[1]) & (v >= 0) & (v < img.shape[0]) & (facing > 0.25)
        ok[ok] &= hm[v[ok], u[ok]] > 128
        w = np.where(ok, facing ** 2, 0)
        col = np.zeros((len(pts), 3)); col[ok] = img[v[ok], u[ok], ::-1] / 255.0
        acc[has] += col * w[:, None]; wsum[has] += w
    texture = np.zeros((H, W, 4))
    seen = wsum > 1e-6
    texture[..., :3] = np.where(seen[..., None], acc / np.maximum(wsum, 1e-6)[..., None], base)
    texture[..., 3] = has.astype(float)
    # soften the texel grid a little, inside the covered area
    rgb = cv2.GaussianBlur(texture[..., :3].astype(np.float32), (0, 0), 0.8)
    texture[..., :3] = np.where(has[..., None], rgb, texture[..., :3])
    return texture


def main(a):
    rep = build(a.out, a.az, a.cap_rows, a.cyl_rows, a.tex)
    print(json.dumps(rep))
    print("GSHAIR wig ok")
