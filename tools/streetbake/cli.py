"""The street in Blender from the command line (tools/street.py look | bake | finishes | bake-check; docs/STREET_TEXTURING.md).
Plain Python: it finds Blender (--blender PATH, $BLENDER, `blender` on the PATH, else Blender's Python module from
`python tools/retarget.py setup`), makes the street's .glb with the page's own exporter when it's missing or older
than the street (the desk's server running), and runs main.py there."""
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MAIN = ROOT / "tools" / "streetbake" / "main.py"
STREETS = ROOT / "Content" / "Studio" / "Streets"
ENV_FILE = ROOT / "setup" / "env.json"
SHOW = ("STREET ", "WEAR", "MATERIALS", "RENDER", "TILE", "ROOFS", "EXPORT", "GLB", "BLEND")


def opt(argv, k, d=None):
    if k in argv:
        i = argv.index(k)
        v = argv[i + 1]
        del argv[i:i + 2]
        return v
    return d


def flag(argv, k):
    if k in argv:
        argv.remove(k)
        return True
    return False


def find_blender(argv):
    """(kind, path): 'exe' a Blender to run in the background, or 'module' a Python with bpy."""
    p = opt(argv, "--blender") or os.environ.get("BLENDER")
    if p:
        return "exe", p
    if not flag(argv, "--module") and shutil.which("blender"):
        return "exe", shutil.which("blender")
    home = None
    if ENV_FILE.exists():
        home = (json.loads(ENV_FILE.read_text(encoding="utf-8")).get("blender") or {}).get("home")
    home = Path(home) if home else ROOT / "vendor" / "blender"
    py = home / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    if py.exists():
        return "module", str(py)
    sys.exit("no Blender: install it (blender on the PATH), pass --blender PATH, or `python tools/retarget.py setup` for "
             "Blender's Python module")


def street_json(name):
    f = STREETS / name / "street.json"
    if not f.is_file():
        sys.exit(f"no street called {name} (python tools/street.py list)")
    return json.loads(f.read_text(encoding="utf-8"))


def street_glb(name, fresh=False):
    """The street's .glb as the page exports it (Saved/Streets/<name>/<name>.glb), made again when the street changed."""
    src = STREETS / name / "street.json"
    out = ROOT / "Saved" / "Streets" / name / f"{name}.glb"
    if out.exists() and out.stat().st_mtime >= src.stat().st_mtime and not fresh:
        return out
    node = shutil.which("node")
    if not node:
        sys.exit("making the street's .glb needs Node.js (and the desk's server: python tools/director/serve.py)")
    r = subprocess.run([node, str(ROOT / "tools/director/streetexport.mjs"), "--street", name, "--out", str(out)], cwd=ROOT,
                       capture_output=True, text=True)
    if r.returncode or not out.exists():
        sys.exit("couldn't export the street's .glb (is the desk's server running? python tools/director/serve.py): " + (r.stdout + r.stderr)[-400:])
    print(r.stdout.strip().splitlines()[-1])
    return out


def run_blender(kind, exe, args, quiet=False):
    if kind == "exe":
        cmd = [exe, "-b", "--factory-startup", "--python-exit-code", "1", "--python", str(MAIN), "--"] + args
    else:
        cmd = [exe, str(MAIN)] + args
    p = subprocess.Popen(cmd, cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, errors="replace")
    keep = []
    for line in p.stdout:
        keep.append(line)
        if not quiet and line.startswith(SHOW):
            print(line.rstrip(), flush=True)
    p.wait()
    if p.returncode:
        print("".join(keep[-40:]))
        sys.exit("Blender's step failed")
    return keep


def shots_of(S, which):
    shots = [{k: v for k, v in s.items() if k != "pins"} for s in S.get("shots", [])]
    if not shots:
        return []
    if which in (None, ""):
        return shots[:1]
    if which == "all":
        return shots
    got = [s for s in shots if s["id"] == which]
    if not got:
        sys.exit(f"no shot {which}: {', '.join(s['id'] for s in shots)}")
    return got


def sheet(name, shots, out, godot=False):
    """Each shot's render beside its photo (and Godot's picture of the .glb): compare_<shot>.jpg."""
    try:
        from PIL import Image
    except ImportError:
        return
    for s in shots:
        pics, labels = [], []
        ref = STREETS / name / s["ref"] if s.get("ref") else None
        for f, label in ((ref, "the photo"), (out / f"look_{s['id']}.png", "Blender: the street's materials, worn"),
                         (out / f"godot_{s['id']}.png" if godot else None, "Godot: the .glb, the plugin's street shader")):
            if f and f.is_file():
                pics.append(Image.open(f).convert("RGB"))
                labels.append(label)
        if len(pics) < 2:
            continue
        h = 750
        pics = [p.resize((int(round(p.width * h / p.height)), h)) for p in pics]
        im = Image.new("RGB", (sum(p.width for p in pics), h))
        x = 0
        for p in pics:
            im.paste(p, (x, 0))
            x += p.width
        f = out / f"compare_{s['id']}.jpg"
        im.save(f, quality=88)
        print(f"COMPARE {f.relative_to(ROOT)}: " + " | ".join(labels))


def made_sets(S, clean=True):
    """Every tuned look on the street made into its set (storykit/pbrmix.py) before Blender reads it (Blender's own
    Python has no Pillow), on the shelf $STUDIO_PBR names if it's set (the bake check's scratch one); the made sets no
    street uses any more taken off the shelf."""
    sys.path.insert(0, str(ROOT / "Content" / "Python"))
    from storykit import pbr as PBR  # noqa: PLC0415
    from storykit import pbrmix as MIX  # noqa: PLC0415
    if os.environ.get("STUDIO_PBR"):
        PBR.ROOT = PBR.DEFAULT = Path(os.environ["STUDIO_PBR"])
    looks = list((S.get("look") or {}).values())
    for k in ("roads", "buildings", "things", "fences"):
        for x in S.get(k) or []:
            looks += list((x.get("look") or {}).values())
    refs = []
    for v in looks:
        if isinstance(v, dict):
            refs.append(MIX.made(v)[0])
    if refs:
        print(f"MADE {len(set(refs))} tuned looks' sets ready")
    if not clean:
        return
    used = []
    for f in STREETS.glob("*/street.json"):                 # every street's, not only this one's
        try:
            T = json.loads(f.read_text(encoding="utf-8"))
        except ValueError:
            continue
        for L in [T.get("look") or {}] + [x.get("look") or {} for k in ("roads", "buildings", "things", "fences") for x in T.get(k) or []]:
            for v in L.values():
                if isinstance(v, dict):
                    try:
                        used.append(MIX.made(v, write=False)[0])
                    except ValueError:                           # a set that isn't on this machine's shelf: STREET warns
                        pass
    MIX.clean(used)


def look_or_bake(cmd, argv):
    kind, exe = find_blender(argv)
    if not argv:
        sys.exit(f"python tools/street.py {cmd} <street> [--shot ID|all] [--samples N] [--height PX] [--density PX/M] ...")
    name = argv.pop(0)
    S = street_json(name)
    which = opt(argv, "--shot")
    godot = flag(argv, "--godot")
    fresh = flag(argv, "--fresh")
    out = ROOT / "Saved" / "Streets" / name / "blender"
    out.mkdir(parents=True, exist_ok=True)
    made_sets(S)
    glb = street_glb(name, fresh)
    shots = shots_of(S, which)
    args = [cmd, "--glb", str(glb), "--out", str(out), "--name", name, "--time", S.get("time", "dusk")]
    if shots:
        (out / "_shots.json").write_text(json.dumps(shots), encoding="utf-8")
        args += ["--shot", str(out / "_shots.json")]
    book = STREETS / name / "finish.json"
    if book.is_file():
        args += ["--book", str(book)]
    t = time.time()
    run_blender(kind, exe, args + argv)
    print(f"done in {time.time() - t:.0f} s: {out.relative_to(ROOT)}")
    if cmd == "bake" and godot and shots:
        r = subprocess.run([sys.executable, str(ROOT / "tools/godot/street_check.py"), "--street", name, "--glb", str(out / f"{name}.glb"),
                            "--plugin", "--shot", shots[0]["id"], "--out", str(out / f"godot_{shots[0]['id']}.png"), "--no-sets"],
                           cwd=ROOT, capture_output=True, text=True)
        print("\n".join(ln for ln in r.stdout.splitlines() if not ln.startswith("  a ray")))
    sheet(name, shots, out, godot and cmd == "bake")
    return 0


def finishes(argv):
    kind, exe = find_blender(argv)
    px = opt(argv, "--tile-px", "1024")
    from_names = [a for a in argv if not a.startswith("--")]
    sys.path.insert(0, str(ROOT / "tools"))
    names = from_names or sorted({f for f in ("render", "tile", "panel", "concrete", "blocks", "kerb", "asphalt", "ground", "paving",
                                              "paint", "metal", "corrugated", "roof_tiles", "roof_sheet", "glass", "wood", "fabric", "plastic")})
    run_blender(kind, exe, ["look", "--glb", "-", "--out", str(ROOT / "Saved" / "Streets"), "--tiles-only", ",".join(names), "--tile-px", px])
    return 0


def library(argv):
    """The material library (library.py) baked onto the shelf, a lit picture of each for the paint page, and a sheet."""
    import ast
    kind, exe = find_blender(argv)
    px = opt(argv, "--tile-px", "1024")
    tree = ast.parse((ROOT / "tools" / "streetbake" / "library.py").read_text(encoding="utf-8"))
    every = next(sorted(k.value for k in n.value.keys) for n in tree.body if isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") == "LIB")
    names = [a for a in argv if not a.startswith("--") and a in every] or every
    run_blender(kind, exe, ["look", "--glb", "-", "--out", str(ROOT / "Saved" / "Streets"), "--tiles-only", ",".join(names), "--tile-px", px]
                + (["--force-tiles"] if flag(argv, "--force") else []))
    made = [n for n in names if thumb(n)]
    print(f"LIBRARY {len(made)} of {len(names)} materials on the shelf with their pictures")
    return 0 if len(made) == len(names) else 1


def thumb(name, size=256):
    """A picture of a library set lit from the upper left (its colour, normal and occlusion), and its sheet's tile."""
    import numpy as np
    from PIL import Image
    d = ROOT / "assets" / "pbr" / "Procedural" / name
    try:
        alb = np.asarray(Image.open(d / f"{name}_albedo.png").convert("RGB"), np.float32) / 255
        nrm = np.asarray(Image.open(d / f"{name}_normal.png").convert("RGB"), np.float32) / 255 * 2 - 1
        orm = np.asarray(Image.open(d / f"{name}_orm.png").convert("RGB"), np.float32) / 255
    except OSError:
        return False
    m = json.loads((d / "meta.json").read_text(encoding="utf-8"))
    px_per_m = alb.shape[1] / float(m.get("tile_m") or 2.0)
    k = max(8, min(alb.shape[0], alb.shape[1], int(px_per_m * 1.2)))   # 1.2 m of it
    alb, nrm, orm = alb[:k, :k], nrm[:k, :k], orm[:k, :k]
    lin = alb ** 2.2
    L = np.array([-0.45, 0.55, 0.70]); L /= np.linalg.norm(L)
    n = nrm / np.maximum(np.linalg.norm(nrm, axis=2, keepdims=True), 1e-6)
    ndl = np.clip(n @ L, 0, 1)[..., None]
    H = L + np.array([0, 0, 1.0]); H /= np.linalg.norm(H)
    rough = orm[..., 1:2]
    spec = np.clip(n @ H, 0, 1)[..., None] ** (2 + 60 * (1 - rough) ** 2) * (1 - rough) * 0.35
    shade = lin * (0.30 * orm[..., 0:1] + 0.95 * ndl) + spec
    img = np.clip(shade ** (1 / 2.2), 0, 1)
    Image.fromarray((img * 255).astype(np.uint8)).resize((size, size), Image.LANCZOS).save(d / "_lit.jpg", quality=88)   # not a map: "_"
    return True


def _test_set(d):
    """A set of our own on the check's scratch shelf (bricks: colour, normal, roughness), for a material to wear."""
    import numpy as np
    from PIL import Image
    n = 128
    y, x = np.mgrid[0:n, 0:n]
    row = y // 16
    mortar = ((y % 16) < 2) | (((x + (row % 2) * 16) % 32) < 2)
    col = np.where(mortar[..., None], [150, 150, 145], [150, 70, 50]).astype(np.uint8)
    Image.fromarray(col).save(d / "bricks_albedo.png")
    nrm = np.full((n, n, 3), [128, 128, 255], np.uint8)
    nrm[mortar] = [128, 128, 200]
    Image.fromarray(nrm).save(d / "bricks_normal.png")
    Image.fromarray(np.where(mortar, 240, 200).astype(np.uint8)).save(d / "bricks_roughness.png")
    (d / "meta.json").write_text(json.dumps({"tile_m": 0.8, "source": "yours", "licence": "CC0-1.0"}), encoding="utf-8")


def _glb_json(path):
    import struct
    b = Path(path).read_bytes()
    n = struct.unpack("<I", b[12:16])[0]
    return json.loads(b[20:20 + n])


DRESS = r'''
import bpy, sys
bpy.ops.wm.open_mainfile(filepath=sys.argv[-1])
col = bpy.data.collections["Foliage"]
bpy.ops.mesh.primitive_cone_add(radius1=1.2, depth=3.0, location=(-2.0, -6.0, 2.0))
t = bpy.context.active_object
t.name = "tree_test"
bpy.ops.mesh.primitive_cylinder_add(radius=0.25, depth=2.0, location=(-2.0, -6.0, 1.0))
c = bpy.context.active_object
c.name = "tree_test_trunk-colonly"
for o in (t, c):
    for u in list(o.users_collection):
        u.objects.unlink(o)
    col.objects.link(o)
bpy.ops.wm.save_mainfile()
print("DRESSED")
import os
os._exit(0)
'''


def bake_check(argv):
    """STREETBAKE: a street baked small on a scratch shelf (the procedural sets and one of our own), its .glb read back:
    every surface but the lit ones carries its wear and the atlas as its occlusion on UV2, the colliders, occluders,
    lamps and insides as many as the street's own .glb, the wear atlas sane, each baked set seamless, the set of our
    own in it, the .blend written. --godot: then GDSTREET on it with the plugin."""
    import numpy as np
    from PIL import Image
    kind, exe = find_blender(argv)
    name = opt(argv, "--street", "shibuya_lane")
    godot = flag(argv, "--godot")
    scratch = ROOT / "Saved" / "Streets" / "_bakecheck"
    shutil.rmtree(scratch, ignore_errors=True)
    tset = scratch / "pbr" / "Test" / "bricks"
    tset.mkdir(parents=True)
    _test_set(tset)
    os.environ["STUDIO_PBR"] = str(scratch / "pbr")
    made_sets(street_json(name), clean=False)                     # the street's tuned looks, on the scratch shelf
    glb = street_glb(name)
    book = json.loads((STREETS / name / "finish.json").read_text(encoding="utf-8")) if (STREETS / name / "finish.json").is_file() else {}
    book.setdefault("finishes", {})["trim"] = "pbr/Test/bricks"     # a slot the lane's paint leaves alone (the paint wins)
    (scratch / "finish.json").write_text(json.dumps(book), encoding="utf-8")
    S = street_json(name)
    shots = shots_of(S, None)
    out = scratch / "out"
    out.mkdir()
    args = ["bake", "--glb", str(glb), "--out", str(out), "--name", name, "--book", str(scratch / "finish.json"),
            "--density", "6", "--tile-px", "128", "--bake-samples", "2", "--samples", "4", "--height", "120"]
    if shots:
        (out / "_shots.json").write_text(json.dumps(shots[:1]), encoding="utf-8")
        args += ["--shot", str(out / "_shots.json")]
    t = time.time()
    run_blender(kind, exe, args, quiet=True)
    errs = []
    J, I = _glb_json(out / f"{name}.glb"), _glb_json(glb)
    mats = [m for m in J.get("materials", []) if m.get("name", "").startswith("street_")]   # not the colliders' own
    lit = [m for m in mats if not (m.get("extras") or {}).get("hs_wear")]
    bad = [m["name"] for m in lit if not m.get("emissiveFactor")]
    if bad:
        errs.append(f"{len(bad)} materials without their wear and not lit: {bad[:4]}")
    no_ao = [m["name"] for m in mats if (m.get("extras") or {}).get("hs_wear") and (m.get("occlusionTexture") or {}).get("texCoord") != 1]
    if no_ao:
        errs.append(f"{len(no_ao)} worn materials without the atlas as their occlusion on UV2: {no_ao[:4]}")
    count = lambda j, f: sum(1 for x in j.get("nodes", []) if f(x.get("name", "")))  # noqa: E731
    for what, f in (("colliders", lambda n: n.endswith("-colonly")), ("occluders", lambda n: n.endswith("-occonly")),
                    ("insides", lambda n: n.startswith("inside_"))):
        if count(J, f) != count(I, f):
            errs.append(f"{count(J, f)} {what} went out, the street's own .glb has {count(I, f)}")
    lamps = lambda j: len(((j.get("extensions") or {}).get("KHR_lights_punctual") or {}).get("lights", []))  # noqa: E731
    if lamps(J) != lamps(I):
        errs.append(f"{lamps(J)} lamps went out, the street's own .glb has {lamps(I)}")
    w = np.asarray(Image.open(out / f"{name}_wear.png").convert("RGBA"), float) / 255
    used = w[..., 0] > 0.004
    ao, dirt, streak = w[..., 0][used].mean(), w[..., 1][used].mean(), w[..., 2][used].max()
    if not (0.2 < ao < 0.97 and 0.03 < dirt < 0.9 and streak > 0.3):
        errs.append(f"the wear atlas looks wrong: occlusion {ao:.2f}, dirt {dirt:.2f}, the strongest streak {streak:.2f}")
    seams = []
    for d in sorted((scratch / "pbr" / "Procedural").iterdir()):
        a = np.asarray(Image.open(d / f"{d.name}_albedo.png").convert("RGB"), float)
        for ax in (1, 0):                    # across the columns (left-right), then the rows (top-bottom)
            # a seam is a step at the wrap bigger than any step inside (a brick's edge inside is as big as one there)
            inner = np.abs(np.diff(a, axis=ax)).mean(axis=1 - ax).mean(axis=-1).max()
            seam = np.abs(np.take(a, 0, axis=ax) - np.take(a, -1, axis=ax)).mean()
            if seam > 1.25 * inner + 2:
                seams.append(f"{d.name} ({'left-right' if ax == 1 else 'top-bottom'}: {seam:.1f}, the biggest step inside {inner:.1f})")
    if seams:
        errs.append("baked sets with a seam: " + ", ".join(seams))
    if not any("bricks" in (im.get("name", "") + im.get("uri", "")) for im in J.get("images", [])):
        errs.append("the set of our own (pbr/Test/bricks on trim) isn't in the .glb")
    blend = out / f"{name}.blend"
    if not blend.is_file() or blend.stat().st_size < 100000:
        errs.append("no .blend written")
    else:                                   # a tree of yours in the .blend's Foliage, then the street baked again
        script = out / "_dress.py"
        script.write_text(DRESS, encoding="utf-8")
        cmd = [exe, str(script), str(blend)] if kind == "module" else [exe, "-b", "--factory-startup", "--python", str(script), "--", str(blend)]
        r = subprocess.run(cmd, capture_output=True, text=True, errors="replace")
        if "DRESSED" not in r.stdout:
            errs.append("couldn't add a tree to the .blend: " + (r.stdout + r.stderr)[-300:])
        else:
            run_blender(kind, exe, args + ["--reuse-wear", "--no-render"], quiet=True)
            names = [x.get("name", "") for x in _glb_json(out / f"{name}.glb").get("nodes", [])]
            if "tree_test" not in names or "tree_test_trunk-colonly" not in names:
                errs.append("baked again, the tree added in the .blend's Foliage (and its -colonly trunk) didn't come along")
            else:
                print("baked again: the tree added in the .blend's Foliage came along, its -colonly trunk too")
    print(f"{name}: {len(mats)} materials ({len(mats) - len(lit)} worn, {len(lit)} lit), {count(J, lambda n: n.endswith('-colonly'))} colliders, "
          f"{lamps(J)} lamps; the atlas's occlusion {ao:.2f}, dirt {dirt:.2f}; {len(list((scratch / 'pbr' / 'Procedural').iterdir()))} sets baked "
          f"seamless; {time.time() - t:.0f} s")
    if godot and not errs:
        r = subprocess.run([sys.executable, str(ROOT / "tools/godot/street_check.py"), "--street", name, "--glb", str(out / f"{name}.glb"),
                            "--plugin", "--no-sets"], cwd=ROOT, capture_output=True, text=True)
        print("\n".join(ln for ln in r.stdout.splitlines() if not ln.startswith("  a ray")))
        if "GDSTREET ok" not in r.stdout:
            errs.append("GDSTREET on the baked .glb failed")
    for e in errs:
        print("ERROR: " + e)
    print("STREETBAKE ok" if not errs else f"STREETBAKE FAILED ({len(errs)})")
    return 1 if errs else 0
