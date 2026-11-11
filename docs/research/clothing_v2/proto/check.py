"""LAYERS: the layer rules held to what they promise, on the outfits that clipped (the user, 2026-11-11: "skirts are
always below the waistband", "the layer below can never clip through"; and the regression they caught the same day:
the same skirt and sweater broken again once pantyhose went under them).

    python check.py <work dir> [outfit ...]        (<work dir> as wear.py's; the outfits are outfits/*.json)

For each outfit, worn without the layers and with them:
  - without: the fault is there and is counted (so the count is known to see it);
  - with: no garment stands outside one worn over it and is still drawn (a sliver at an edge is let be: under half
    a percent of its points, each under 2 mm);
  - nothing is shoved about to get there: no garment moved further than 45 mm (a coat over a chunky dress: 120),
    a shoe not at all;
  - the outermost garment isn't hidden by anything; bottoms sit under tops (tops under bottoms in an outfit that
    tucks them in), outerwear over both.
Ends "LAYERS ok".
"""
import json
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).resolve().parent
# outfit -> (the least number of points that come through without the layers, the furthest any garment may be moved, mm)
# 45 mm is a layer or two of cloth; a coat over a chunky knit dress on a full bust has further to go
OUTFITS = dict(skirt_sweater=(150, 45), tights=(150, 45), coat=(500, 45), uniform=(1500, 45), socks=(1500, 45), fishnet=(300, 45), reddress_coat=(5000, 120))
SLIVER = (0.005, 2.0)       # at an edge a few points may stand through: this share of a garment's points at most, each under this many mm


def worn(work, o, plain):
    r = subprocess.run([sys.executable, str(HERE / "wear.py"), str(work), str(HERE / "outfits" / f"{o}.json")] + (["--no-layers"] if plain else []), capture_output=True, text=True)
    if r.returncode:
        raise SystemExit(f"LAYERS FAIL: wear.py on {o}: {(r.stdout + r.stderr)[-800:]}")
    return json.loads((work / (o + ("_plain" if plain else "")) / "index.json").read_text())["report"]


def main():
    work = Path(sys.argv[1]).resolve()
    names = sys.argv[2:] or list(OUTFITS)
    with ThreadPoolExecutor(4) as ex:
        got = list(ex.map(lambda o: (o, worn(work, o, True), worn(work, o, False)), names))
    faults = []
    for o, plain, lay in got:
        for b0, b1 in zip(plain, lay):
            who = f"{o} on {b1['body']}"
            before = sum(g["through"] for g in b0["garments"])
            least, far = OUTFITS.get(o, (0, 45))
            if before < least:
                faults.append(f"{who}: without the layers only {before} points come through (at least {least} expected: is the count still looking?)")
            gs = b1["garments"]
            for g in gs:
                if g["through"] > SLIVER[0] * g["points"] or g["through_mm"] > SLIVER[1]:
                    faults.append(f"{who}: {g['name']} comes through {g['through_what']} at {g['through']} points, {g['through_mm']} mm")
                if g["moved_most_mm"] > far:
                    faults.append(f"{who}: {g['name']} was moved {g['moved_most_mm']} mm")
                if g["kind"] in ("shoes", "hat") and (g["moved_in"] or g["moved_out"]):
                    faults.append(f"{who}: {g['name']} (rigid) was bent")
            top = max(gs, key=lambda g: g["layer"])
            if top["hidden"]:
                faults.append(f"{who}: the outermost garment, {top['name']}, has {top['hidden']} points hidden")
            lay_of = {}
            for g in gs:
                lay_of.setdefault(g["kind"], g["layer"])
            tuck = json.loads((HERE / "outfits" / f"{o}.json").read_text()).get("tuck", False)     # (an outfit that tucks its tops in asks for the other order)
            for a, b in ((("top", "skirt"), ("top", "trousers")) if tuck else (("skirt", "top"), ("trousers", "top"))) + (("top", "outer"), ("top", "coat"), ("socks", "shoes"), ("legs", "socks")):
                if a in lay_of and b in lay_of and not lay_of[a] < lay_of[b]:
                    faults.append(f"{who}: a {a} (layer {lay_of[a]}) isn't under a {b} (layer {lay_of[b]})")
            print(f"  {who:34s} through: {before:5d} -> {sum(g['through'] for g in gs)};  moved most: " + ", ".join(f"{g['name'][:14]} {g['moved_most_mm']:.0f} mm" for g in gs))
    for f in faults:
        print("LAYERS FAIL:", f)
    if not faults:
        print(f"LAYERS ok ({len(got)} outfits, {sum(len(l) for _, _, l in got)} bodies)")
    return 1 if faults else 0


if __name__ == "__main__":
    sys.exit(main())
