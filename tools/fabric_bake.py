"""The Studio's fabrics, made in Blender (tools/streetbake/fabrics.py, DECISIONS 2026-11-01): procedural node groups of
threads, stitches, fibres and grain at their real size, baked once into tileable PBR sets on the shelf
(assets/pbr/Procedural/fabric_<name>/), which the Character Studio's garments wear from their PBR set picker.

    python tools/fabric_bake.py list                          the fabrics, and which are baked on this machine
    python tools/fabric_bake.py bake [names...] [--tile-px 1024] [--force]
                                                              baked in Blender's module (python tools/retarget.py setup
                                                              once, or a blender on the PATH), a lit picture of each
    python tools/fabric_bake.py sheet                         the lit pictures as one sheet: Saved/Story/_look/fabrics/sheet.jpg
    python tools/fabric_bake.py check                         FABRICS: every fabric tiles (its period a whole number of
                                                              its repeats), and every baked one has its maps
"""
import ast
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
SRC = ROOT / "tools" / "streetbake" / "fabrics.py"
SHELF = ROOT / "assets" / "pbr" / "Procedural"
LOOK = ROOT / "Saved" / "Story" / "_look" / "fabrics"


def entries():
    """The fabrics as written (read from the source: no Blender needed): {name: (label, family, period, relief, numbers, tint)}."""
    tree = ast.parse(SRC.read_text(encoding="utf-8"))
    node = next(n.value for n in tree.body if isinstance(n, ast.Assign) and getattr(n.targets[0], "id", "") == "LIB")
    out = {}
    for k, v in zip(node.keys, node.values):
        label, fam, P, rel, nums, tint = v.elts
        out[k.value] = (label.value, fam.value, ast.literal_eval(P), ast.literal_eval(rel), {kw.arg: ast.literal_eval(kw.value) for kw in nums.keywords}, ast.literal_eval(tint))
    return out


MAPS = ("albedo", "normal", "orm", "roughness", "ao", "height")


def baked(name):
    d = SHELF / name
    return all((d / f"{name}_{m}.png").is_file() for m in MAPS) and (d / "meta.json").is_file()


def cmd_list(_):
    for n, (label, fam, P, rel, p, tint) in entries().items():
        print(f"{n:<20} {label:<40} {fam:<6} {P[0] * 100:.1f} cm  {'tint' if tint else 'own colours':<11} {'baked' if baked(n) else '-'}")
    return 0


def cmd_bake(argv):
    from streetbake import cli as C
    names = [a for a in argv if not a.startswith("--") and a in entries()] or list(entries())
    kind, exe = C.find_blender(argv)
    px = C.opt(argv, "--tile-px", "1024")
    C.run_blender(kind, exe, ["look", "--glb", "-", "--out", str(ROOT / "Saved" / "Streets"), "--tiles-only", ",".join(names), "--tile-px", px]
                  + (["--force-tiles"] if C.flag(argv, "--force") else []))
    made = [n for n in names if C.thumb(n)]
    print(f"FABRICS {len(made)} of {len(names)} fabrics on the shelf with their pictures (assets/pbr/Procedural/fabric_*)")
    cmd_sheet([])
    return 0 if len(made) == len(names) else 1


def cmd_sheet(_):
    from PIL import Image, ImageDraw
    got = [(n, e[0]) for n, e in entries().items() if (SHELF / n / "_lit.jpg").is_file()]
    if not got:
        print("no fabric baked yet: python tools/fabric_bake.py bake")
        return 1
    cols, T, cap = 6, 220, 34
    rows = (len(got) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * T, rows * (T + cap)), (28, 30, 36))
    dr = ImageDraw.Draw(sheet)
    for k, (n, label) in enumerate(got):
        x, y = (k % cols) * T, (k // cols) * (T + cap)
        sheet.paste(Image.open(SHELF / n / "_lit.jpg").convert("RGB").resize((T - 8, T - 8)), (x + 4, y + 4))
        dr.text((x + 6, y + T), label[:34], fill=(230, 228, 220))
        dr.text((x + 6, y + T + 14), n, fill=(150, 150, 150))
    LOOK.mkdir(parents=True, exist_ok=True)
    sheet.save(LOOK / "sheet.jpg", quality=88)
    print(f"the sheet: {(LOOK / 'sheet.jpg').relative_to(ROOT)}")
    return 0


def cmd_check(_):
    bad = []
    say = lambda ok, what: (print(("  ok  " if ok else "  BAD ") + what), None if ok else bad.append(what))
    E = entries()
    for n, (label, fam, P, rel, p, tint) in E.items():
        reps = []                                                    # what must fit a whole number of times in the period
        if fam == "weave":
            n_rep = {"plain": 2, "basket": 4, "satin": 5}.get(p["weave"], p.get("over", 2) + p.get("under", 1))
            if p["weave"] == "herringbone":
                n_rep = max(n_rep, 2 * p.get("band", 12))
            reps = [(p["pitch"] * n_rep, "u"), (p["pitch"] * n_rep, "v")]
        elif fam == "knit":
            reps = [(p["w"] * (4 if p["stitch"] == "rib" else 1), "u"), (p["h"], "v")]
        elif fam == "pile" and p["kind"] == "corduroy":
            reps = [(p["wale"], "u")]
        elif fam == "net":                                           # whole cells (a mesh's rows staggered: two to a repeat down)
            reps = [(p["cell"], "u"), (p["cell"] * (2 if p["kind"] == "mesh" else 1), "v")]
        elif fam == "felt" and p["kind"] == "flannel":
            reps = [(p["pitch"] * 4, "u"), (p["pitch"] * 4, "v")]
        fits = all(abs(P[0 if ax == "u" else 1] / r - round(P[0 if ax == "u" else 1] / r)) < 1e-6 for r, ax in reps)
        say(fits and rel > 0 and 0.005 <= P[0] <= 0.2, f"{n}: {label}, {P[0] * 100:.1f} cm a repeat{(' (its threads and stitches fit it whole: it tiles)' if fits else ' (its threads and stitches DO NOT fit it whole: a seam)') if reps else ''}, {rel * 1000:.2f} mm of relief")
    made = [n for n in E if baked(n)]
    for n in made:
        m = json.loads((SHELF / n / "meta.json").read_text(encoding="utf-8"))
        say(abs(m.get("tile_m", 0) - E[n][2][0]) < 1e-4 and m.get("group") == "fabric", f"{n}: baked with its maps, its repeat {m.get('tile_m')} m")
    if not made:
        print("  --  none baked on this machine yet (python tools/fabric_bake.py bake)")
    print("FABRICS " + ("FAIL" if bad else "ok"))
    return 1 if bad else 0


def main(argv):
    cmd = argv[0] if argv else "list"
    return {"list": cmd_list, "bake": cmd_bake, "sheet": cmd_sheet, "check": cmd_check}.get(cmd, lambda a: (print(__doc__), 1)[1])(argv[1:])


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
