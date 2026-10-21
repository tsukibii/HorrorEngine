"""A garment for a Character Studio character, from its sewing pattern to a drape on its body. Runs in GarmentCode's
environment (python tools/garment.py setup; MIT), and calls Blender's module for the drape (tools/character/drape.py;
GarmentCode's own draping simulator is research-only, so it isn't used).

    vendor/garmentcode/venv/bin/python tools/character/clothes.py --out DIR --design NAME --height 1.62 --weights '[...]'

1. The body file GarmentCode wants, from the character: GarmentCode's mean female body at the character's height, its
   girths (bust, waist, hips) and shoulder width scaled by how this body's measures differ from our feminine base
   (MHR's measures take in a little arm in its A-pose, so ratios are fairer than raw numbers).
2. The pattern: GarmentCode's MetaGarment with a design from Content/Studio/Clothes/designs/ (or a yaml path).
3. The panels placed round the body and the seams (tools/garment.py's panels), and the body as OBJ.
4. The drape (Blender's cloth with sewing springs) onto the body: <DIR>/garment.obj, metres, the Studio's frame.
Prints one JSON line (the files, the measures, the drape's report) and CLOTHES ok.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools" / "character"))
sys.path.insert(0, str(ROOT / "tools"))
import mhr  # noqa: E402
import garment  # noqa: E402 - panels_obj

DESIGNS = ROOT / "Content" / "Studio" / "Clothes" / "designs"
GC = ROOT / "vendor" / "garmentcode" / "src"
LENGTHS_SKIP = {"shoulder_incl", "arm_pose_angle", "hip_inclination"}      # angles: not scaled with height


def blender_python():
    for p in (os.environ.get("BLENDER_PY"), ROOT / "vendor" / "blender" / ".venv" / "bin" / "python",
              ROOT / "vendor" / "blender" / ".venv" / "Scripts" / "python.exe"):
        if p and Path(p).exists(): return str(p)
    sys.exit("no Blender module: python tools/retarget.py setup (or BLENDER_PY=<a Python with bpy>)")


def body_points(weights, height):
    """the character's body (metres, feet on the floor, at its height) and that scale"""
    p = mhr.body(weights)
    lo = p[:, 1].min()
    k = height / (p[:, 1].max() - lo)
    p = (p - [0, lo, 0]) * k
    return p, k


def body_file(weights, height):
    """GarmentCode's body parameters for this character"""
    import yaml
    presets = json.loads(mhr.PRESETS_FILE.read_text(encoding="utf-8"))["presets"]
    ref = mhr.measures(body_points(presets["feminine"], height)[0])
    me = mhr.measures(body_points(weights, height)[0])
    base = yaml.safe_load((GC / "assets" / "bodies" / "mean_female.yaml").read_text(encoding="utf-8"))["body"]
    k = height * 100 / base["height"]
    b = {key: (v * k if isinstance(v, (int, float)) and key not in LENGTHS_SKIP else v) for key, v in base.items()}
    ratio = lambda n: me[n] / ref[n] if ref[n] else 1.0
    for key, n in (("bust", "chest"), ("underbust", "chest"), ("waist", "waist"), ("hips", "hips"),
                   ("shoulder_w", "shoulders"), ("neck_w", "neck")):
        if key in b: b[key] = round(b[key] * ratio(n), 2)
    b["height"] = round(height * 100, 2)
    return {"body": b}, {n: round(me[n], 1) for n in ("height", "shoulders", "chest", "waist", "hips")}


def pattern(body_yaml, design, out):
    """GarmentCode's pattern for the body: the specification JSON (and its svg/png), in out"""
    sys.path.insert(0, str(GC))
    cwd = os.getcwd(); os.chdir(GC)
    try:
        import yaml
        from assets.bodies.body_params import BodyParameters
        from assets.garment_programs.meta_garment import MetaGarment
        body = BodyParameters(str(body_yaml))
        dsg = yaml.safe_load(Path(design).read_text(encoding="utf-8"))["design"]
        piece = MetaGarment(Path(design).stem, body, dsg)
        pat = piece.assembly()
        folder = pat.serialize(out, tag="", to_subfolder=False, with_3d=False, with_text=False, view_ids=False,
                               with_printable=False)
    finally:
        os.chdir(cwd)
    return next(Path(folder).glob("*_specification.json"))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", required=True)
    ap.add_argument("--design", required=True, help="a name in Content/Studio/Clothes/designs/ or a yaml")
    ap.add_argument("--height", type=float, default=1.7)
    ap.add_argument("--weights", default="[]", help="the character's 45 identity weights, as JSON")
    ap.add_argument("--frames", type=int, default=90)
    a = ap.parse_args()
    import yaml
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    design = Path(a.design) if a.design.endswith((".yaml", ".yml")) else DESIGNS / f"{a.design}.yaml"
    if not design.exists(): sys.exit(f"no design {design}")
    weights = json.loads(a.weights)
    bf, meas = body_file(weights, a.height)
    (out / "body.yaml").write_text(yaml.safe_dump(bf), encoding="utf-8")
    spec = pattern(out / "body.yaml", design, out)
    panels = out / "panels.obj"
    garment.panels_obj(spec, panels)
    pts, _ = body_points(weights, a.height)
    tris = mhr.load()["tris"]
    with open(out / "body.obj", "w", encoding="utf-8") as f:
        f.write("# the character's body for the drape: metres, Y up, facing +Z, feet on the floor\n")
        for v in pts: f.write("v %.5f %.5f %.5f\n" % tuple(v))
        for t in tris: f.write("f %d %d %d\n" % tuple(t + 1))
    shutil.copy(design, out / "design.yaml")
    r = subprocess.run([blender_python(), str(ROOT / "tools" / "character" / "drape.py"), "--", str(out / "body.obj"),
                        str(panels), str(panels.with_suffix(".seams.json")), str(out / "garment.obj"), str(a.frames)],
                       capture_output=True, text=True, encoding="utf-8")
    rep = next((json.loads(l[6:]) for l in r.stdout.splitlines() if l.startswith("DRAPE ")), None)
    if r.returncode or rep is None:
        sys.stderr.write(r.stdout[-3000:] + r.stderr[-3000:]); sys.exit("the drape failed")
    print(json.dumps({"garment": str(out / "garment.obj"), "pattern": str(spec), "measures_cm": meas, "drape": rep}))
    print("CLOTHES ok")


if __name__ == "__main__":
    main()
