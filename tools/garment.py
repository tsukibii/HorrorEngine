"""Clothing on the go (docs/METAHUMAN_ROUTE.md §6): a garment's sewing pattern from a cast member's measures with
GarmentCode (MIT, github.com/maria-korosteleva/GarmentCode), and the pattern's panels placed in 3D round the body as
an OBJ plus a seams file, for Unreal's Chaos cloth (the Dataflow editor's panel import).

    python tools/garment.py setup [--home DIR]                 GarmentCode from its repo with uv (Python 3.11: its cgal
                                                               wheels stop there), everything under DIR (default vendor/garmentcode)
    python tools/garment.py --game G body <cast>               the cast member's measures as a GarmentCode body file
    python tools/garment.py --game G pattern <cast> <design>   the pattern (svg, png, the 3D placement, specification.json)
                                                               design: a name in GarmentCode's assets/design_params (t-shirt)
                                                               or a yaml of your own; writes Content/Games/G/Garments/<cast>_<design>/
    python tools/garment.py panels <specification.json> [--out X.obj]
                                                               the panels as flat meshes placed in 3D (cm, Y up) + <X>.seams.json

The measures are widths (the desk's); GarmentCode wants circumferences, so they're turned into them by an ellipse of
depth 0.7 x width, with the rest of its body file scaled from its mean female body by height. Good enough for a fit;
a tape-measure file (assets/bodies) is better when there is one. Tested here on Mari's t-shirt; the Unreal import of
the OBJ is the untested half (SETUP S12).
"""
import argparse
import json
import math
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "Content" / "Python"))
from storykit import storylib as L  # noqa: E402

REPO = "https://github.com/maria-korosteleva/GarmentCode.git"
ANGLES = {"shoulder_incl", "arm_pose_angle", "hip_inclination"}
ARC_CCW_IS_RIGHT = True        # GarmentCode's circle arcs: the "right" flag as the sweep direction in its y-up frame (checked against its own render)


def home_dir(a):
    return Path(a.home) if getattr(a, "home", None) else ROOT / "vendor" / "garmentcode"


def py_of(home):
    exe = home / "venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    if not exe.exists():
        sys.exit(f"no GarmentCode environment at {home}: python tools/garment.py setup")
    return exe


def cmd_setup(a):
    home = home_dir(a); home.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ, UV_CACHE_DIR=str(home / "uvcache"), UV_PYTHON_INSTALL_DIR=str(home / "uvpy"))
    src = home / "src"
    if not (src / "pyproject.toml").exists():
        subprocess.run(["git", "clone", "--depth", "1", REPO, str(src)], check=True)
    subprocess.run(["uv", "python", "install", "3.11"], env=env, check=False)
    subprocess.run(["uv", "venv", "-p", "3.11", str(home / "venv")], env=env, check=True)
    subprocess.run(["uv", "pip", "install", "-p", str(py_of(home)), "-e", str(src)], env=env, check=True)
    sysjson = src / "system.json"
    if not sysjson.exists():
        t = json.loads((src / "system.template.json").read_text(encoding="utf-8")); t["output"] = "./output"
        sysjson.write_text(json.dumps(t, indent=2), encoding="utf-8")
    print(f"GarmentCode at {home} (MIT; its licence is in {src / 'LICENSE'})")
    print("GARMENT ok")


def body_yaml(measures, src):
    """GarmentCode's body file from the desk's measures (cm): widths to circumferences, the rest scaled by height."""
    import yaml
    base_f = src / "assets" / "bodies" / "mean_female.yaml"
    base = yaml.safe_load((base_f if base_f.exists() else src / "assets" / "bodies" / "f_smpl_average_A40.yaml").read_text(encoding="utf-8"))["body"]
    k = measures["height"] / base["height"]
    b = {kk: (round(v * k, 1) if isinstance(v, (int, float)) and kk not in ANGLES else v) for kk, v in base.items()}
    circ = lambda w: round(math.pi * (w + 0.7 * w) / 2, 1)
    b["height"] = measures["height"]
    if "shoulders" in measures: b["shoulder_w"] = measures["shoulders"]
    if "waist" in measures: b["waist"] = circ(measures["waist"])
    if "hips" in measures: b["hips"] = circ(measures["hips"])
    if "chest" in measures: b["bust"] = circ(measures["chest"] * 1.6)       # the desk's chest is a depth-ish span
    return {"body": b}


def cast_measures(a):
    story, _ = L.load(a.game)
    c = story.get("cast", {}).get(a.cid)
    if not c: sys.exit(f"{a.cid!r} isn't in {a.game}'s cast")
    m = dict(c.get("measures") or {})
    if "height" not in m and c.get("height"): m["height"] = round(float(c["height"]) * 100, 1)
    if "height" not in m: sys.exit(f"{a.cid} has no measures: shape the body on the Shape page and Save to story")
    return m


def cmd_body(a):
    import yaml
    home = home_dir(a); src = home / "src"
    out = ROOT / "Content" / "Games" / a.game / "Garments" / f"{a.cid}_body.yaml"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(yaml.safe_dump(body_yaml(cast_measures(a), src)), encoding="utf-8")
    print(f"wrote {out.relative_to(ROOT)}")
    return out


def cmd_pattern(a):
    home = home_dir(a); src = home / "src"; py = py_of(home)
    body = cmd_body(a)
    design = Path(a.design).resolve() if a.design.endswith((".yaml", ".yml")) else src / "assets" / "design_params" / f"{a.design}.yaml"
    if not design.exists(): sys.exit(f"no design {design}")
    name = design.stem
    script = f'''
import yaml, shutil
from pathlib import Path
from assets.garment_programs.meta_garment import MetaGarment
from assets.bodies.body_params import BodyParameters
body = BodyParameters({str(body)!r})
design = yaml.safe_load(open({str(design)!r}))["design"]
piece = MetaGarment({name!r}, body, design)
pattern = piece.assembly()
if piece.is_self_intersecting(): print("WARNING: the pattern self-intersects")
folder = pattern.serialize(Path("./output"), tag="_{a.cid}", to_subfolder=True, with_3d=True, with_text=False, view_ids=False, with_printable=False)
body.save(folder); shutil.copy({str(design)!r}, folder)
print("FOLDER", folder)
'''
    r = subprocess.run([str(py), "-c", script], cwd=str(src), capture_output=True, text=True, encoding="utf-8")
    sys.stdout.write(r.stdout[-2000:]); sys.stderr.write(r.stderr[-2000:])
    folder = next((ln.split("FOLDER", 1)[1].strip() for ln in r.stdout.splitlines() if ln.startswith("FOLDER")), None)
    if r.returncode or not folder: sys.exit("GarmentCode failed")
    dst = ROOT / "Content" / "Games" / a.game / "Garments" / f"{a.cid}_{name}"
    if dst.exists(): shutil.rmtree(dst)
    shutil.copytree(src / folder, dst)
    spec = next(dst.glob("*_specification.json"))
    obj = dst / f"{a.cid}_{name}_panels.obj"
    panels_obj(spec, obj)
    print(f"wrote {dst.relative_to(ROOT)}/ (pattern, the 3D placement, {obj.name}, {obj.with_suffix('.seams.json').name})")
    print("GARMENT ok")


def edge_points(verts, e, n=12):
    """an edge's points, start included, end excluded (the next edge starts there): straight, a quadratic or cubic
    Bezier from GarmentCode's relative control points (along the edge, across it, of its length), or a circle arc
    (radius, large arc, right)"""
    a, b = (verts[i] for i in e["endpoints"])
    c = e.get("curvature")
    if c is None: return [[a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n] for i in range(n)]   # straight: as many points as a curve, so stitched edges pair one to one
    if isinstance(c, list): c = {"type": "quadratic", "params": [c]}
    rel = lambda p: [a[0] + (b[0] - a[0]) * p[0] - (b[1] - a[1]) * p[1], a[1] + (b[1] - a[1]) * p[0] + (b[0] - a[0]) * p[1]]
    out = []
    if c["type"] in ("quadratic", "cubic"):
        P = [a] + [rel(p) for p in (c["params"] if c["type"] == "cubic" else c["params"][:1])] + [b]
        for i in range(n):
            t = i / n
            if len(P) == 3: out.append([(1 - t) ** 2 * P[0][k] + 2 * (1 - t) * t * P[1][k] + t * t * P[2][k] for k in (0, 1)])
            else: out.append([(1 - t) ** 3 * P[0][k] + 3 * (1 - t) ** 2 * t * P[1][k] + 3 * (1 - t) * t * t * P[2][k] + t ** 3 * P[3][k] for k in (0, 1)])
        return out
    if c["type"] == "circle":
        r, large, right = c["params"]
        mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        dx, dy = b[0] - a[0], b[1] - a[1]; d = math.hypot(dx, dy) or 1e-9
        h = math.sqrt(max(0.0, r * r - (d / 2) ** 2))                 # the centre's distance from the chord's middle
        nx, ny = -dy / d, dx / d                                      # the chord's left normal
        ccw = bool(right) if ARC_CCW_IS_RIGHT else not right
        for side in (1, -1):                                          # the centre's side: the one whose arc, swept this way, is the minor (or major) arc
            cx, cy = mx + nx * h * side, my + ny * h * side
            a0, a1 = math.atan2(a[1] - cy, a[0] - cx), math.atan2(b[1] - cy, b[0] - cx)
            sweep = a1 - a0
            if ccw and sweep < 0: sweep += 2 * math.pi
            if not ccw and sweep > 0: sweep -= 2 * math.pi
            if (abs(sweep) <= math.pi) == (not large): break
        for i in range(n): t = a0 + sweep * i / n; out.append([cx + r * math.cos(t), cy + r * math.sin(t)])
        return out
    return [a]


def triangulate(poly):
    """ear clipping of a simple polygon (the panels are simple): triangles as index triples"""
    n = len(poly); idx = list(range(n)); tris = []
    area = sum(poly[i][0] * poly[(i + 1) % n][1] - poly[(i + 1) % n][0] * poly[i][1] for i in range(n))
    if area < 0: idx.reverse()
    def convex(a, b, c): return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 1e-9
    def inside(p, a, b, c):
        return all((q[0] - r[0]) * (p[1] - r[1]) - (q[1] - r[1]) * (p[0] - r[0]) >= -1e-9 for q, r in ((b, a), (c, b), (a, c)))
    guard = 0
    while len(idx) > 3 and guard < 10000:
        guard += 1
        for k in range(len(idx)):
            i0, i1, i2 = idx[k - 1], idx[k], idx[(k + 1) % len(idx)]
            a, b, c = poly[i0], poly[i1], poly[i2]
            if not convex(a, b, c): continue
            if any(inside(poly[j], a, b, c) for j in idx if j not in (i0, i1, i2)): continue
            tris.append((i0, i1, i2)); del idx[k]; break
        else: break
    if len(idx) == 3: tris.append(tuple(idx))
    return tris


def rot(v, r):
    """GarmentCode's rotation: Euler XYZ degrees"""
    x, y, z = (math.radians(t) for t in r)
    cx, sx, cy, sy, cz, sz = math.cos(x), math.sin(x), math.cos(y), math.sin(y), math.cos(z), math.sin(z)
    px, py, pz = v
    py, pz = cx * py - sx * pz, sx * py + cx * pz
    px, pz = cy * px + sy * pz, -sy * px + cy * pz
    px, py = cz * px - sz * py, sz * px + cz * py
    return [px, py, pz]


def panels_obj(spec_path, out):
    spec = json.loads(Path(spec_path).read_text(encoding="utf-8")); P = spec["pattern"]
    scale = 100 / spec.get("properties", {}).get("units_in_meter", 100)    # to cm
    lines = [f"# {Path(spec_path).name}: GarmentCode panels placed in 3D round the body (cm, Y up); seams in the .seams.json"]
    base, seams, loops = 0, {}, {}
    for name in P.get("panel_order") or list(P["panels"]):
        pan = P["panels"][name]; verts = pan["vertices"]
        poly, edge_ranges = [], []
        for ei, e in enumerate(pan["edges"]):
            pts = edge_points(verts, e)
            start = len(poly); poly.extend(pts); edge_ranges.append((start, len(poly)))
        tris = triangulate(poly)
        lines.append(f"o {name}")
        for p in poly:
            v = rot([p[0] * scale, p[1] * scale, 0.0], pan.get("rotation", [0, 0, 0]))
            t = pan.get("translation", [0, 0, 0])
            lines.append(f"v {v[0] + t[0] * scale:.3f} {v[1] + t[1] * scale:.3f} {v[2] + t[2] * scale:.3f}")
        for a, b, c in tris:                                            # degenerate ears (collinear points on near-straight curves) are dropped
            (ax, ay), (bx, by), (cx, cy) = poly[a], poly[b], poly[c]
            if abs((bx - ax) * (cy - ay) - (by - ay) * (cx - ax)) < 1e-3: continue
            lines.append(f"f {base + a + 1} {base + b + 1} {base + c + 1}")
        loops[name] = {"first_vertex": base + 1, "count": len(poly), "edges": [{"edge": i, "vertices": list(range(base + s + 1, base + e + 1))} for i, (s, e) in enumerate(edge_ranges)]}
        base += len(poly)
    stitches = [[{"panel": s[0]["panel"], "edge": s[0]["edge"]}, {"panel": s[1]["panel"], "edge": s[1]["edge"]}] for s in P.get("stitches", [])]
    Path(out).write_text("\n".join(lines) + "\n", encoding="utf-8")
    Path(out).with_suffix(".seams.json").write_text(json.dumps({"units": "cm, Y up; vertex indices are the OBJ's (1-based)", "panels": loops, "stitches": stitches}, indent=1), encoding="utf-8")
    return base, len(stitches)


def cmd_panels(a):
    out = Path(a.out) if a.out else Path(a.spec).with_name(Path(a.spec).stem.replace("_specification", "") + "_panels.obj")
    n, s = panels_obj(a.spec, out)
    print(f"wrote {out} ({n} vertices) and {out.with_suffix('.seams.json').name} ({s} stitches)")
    print("GARMENT ok")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--game"); ap.add_argument("--home")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("setup")
    b = sub.add_parser("body"); b.add_argument("cid")
    p = sub.add_parser("pattern"); p.add_argument("cid"); p.add_argument("design")
    q = sub.add_parser("panels"); q.add_argument("spec"); q.add_argument("--out")
    a = ap.parse_args(argv)
    if a.cmd in ("body", "pattern") and not a.game: sys.exit("--game is needed")
    {"setup": cmd_setup, "body": cmd_body, "pattern": cmd_pattern, "panels": cmd_panels}[a.cmd](a)


if __name__ == "__main__":
    main()
