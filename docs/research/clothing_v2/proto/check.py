"""LAYERS: the layer rules held to what they promise, on the outfits that clipped (the user, 2026-11-11: "skirts are
always below the waistband", "the layer below can never clip through"; the regression they caught the same day: the
same skirt and sweater broken again once pantyhose went under them; and "light rules for outfitting just to not have
to deal with harder clipping and mesh distortion").

    python check.py <work dir> [outfit ...]        (<work dir> as wear.py's; the outfits are outfits/*.json)

First the outfit rules by kind, on made-up lines (no garments needed): one bottom, one coat, a dress is the top and the
bottom, no coat over a dress, legwear, socks and shoes with anything.
Then, for each outfit, worn without the layers and with them:
  - without: the fault is there and is counted (so the count is known to see it);
  - with: no garment stands outside one worn over it and is still drawn (a sliver at an edge is let be: under half
    a percent of its points, each under 2 mm; the chunky dress under a coat on the full bust: 5 mm);
  - nothing is shoved about to get there: no point further than layers.FAR (5 cm) from where its garment was fitted,
    a shoe not at all;
  - what the rules refuse isn't worn, and only that: the coat over a dress (by kind), the jacket over a dress with
    wide hanging sleeves (by measure);
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
sys.path.insert(0, str(HERE))
import layers  # noqa: E402

# outfit -> least: the fewest points that come through without the layers; sliver_mm; refused: what its rules don't let be worn
OUTFITS = dict(skirt_sweater=dict(least=150), tights=dict(least=150), coat=dict(least=500), uniform=dict(least=1500), socks=dict(least=1500), fishnet=dict(least=300),
               reddress_coat=dict(least=5000, sliver_mm=5.0), dress_cocktail=dict(least=300), dress_halter=dict(least=800), dress_50s=dict(least=3000), dress_cardigan=dict(least=500),
               dress_coat=dict(least=800, refused=["Coat"]), dress_bell_jacket=dict(refused=["Denim_Jacket"]))
SLIVER = (0.005, 2.0)       # at an edge a few points may stand through: this share of a garment's points at most, each under this many mm


class K:
    def __init__(self, kind, n=0):
        self.kind, self.name = kind, f"{kind}{n}"


def by_kind():
    """the rules by kind, on made-up lines: (what's asked for in order, the kinds refused)"""
    faults = []
    for asked, no in [(["skirt", "top", "coat"], []), (["legs", "socks", "shoes", "dress", "outer"], []), (["top", "top", "trousers", "outer", "coat"], []), (["dress", "coat"], ["coat"]),
                      (["coat", "dress"], ["dress"]), (["dress", "top"], ["top"]), (["skirt", "dress"], ["dress"]), (["trousers", "skirt"], ["skirt"]), (["outer", "outer"], ["outer"]),
                      (["suit", "trousers", "coat"], ["trousers"]), (["shoes", "shoes"], ["shoes"]), (["legs", "legs", "socks"], ["legs"])]:
        got = [g.kind for g, _ in layers.rules([K(k, i) for i, k in enumerate(asked)])[1]]
        if got != no:
            faults.append(f"the rules on {asked}: refused {got}, expected {no}")
    return faults


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
    faults = by_kind()
    for o, plain, lay in got:
        for b0, b1 in zip(plain, lay):
            who = f"{o} on {b1['body']}"
            before = sum(g["through"] for g in b0["garments"])
            want = OUTFITS.get(o, {})
            if before < want.get("least", 0):
                faults.append(f"{who}: without the layers only {before} points come through (at least {want['least']} expected: is the count still looking?)")
            gs = b1["garments"]
            for g in gs:
                if g["through"] > SLIVER[0] * g["points"] or g["through_mm"] > want.get("sliver_mm", SLIVER[1]):
                    faults.append(f"{who}: {g['name']} comes through {g['through_what']} at {g['through']} points, {g['through_mm']} mm")
                if g["moved_most_mm"] > layers.FAR * 1000 + 0.5:
                    faults.append(f"{who}: {g['name']} was moved {g['moved_most_mm']} mm")
            no = sorted(r["name"] for r in b1.get("refused", []))
            if no != sorted(want.get("refused", [])):
                faults.append(f"{who}: not worn {no}, expected {sorted(want.get('refused', []))}: {[r['why'] for r in b1.get('refused', [])]}")
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
            print(f"  {who:34s} through: {before:5d} -> {sum(g['through'] for g in gs)};  moved most: " + ", ".join(f"{g['name'][:14]} {g['moved_most_mm']:.0f} mm" for g in gs)
                  + ("" if not b1.get("refused") else ";  not worn: " + "; ".join(f"{r['name']} ({r['why']})" for r in b1["refused"])))
    for f in faults:
        print("LAYERS FAIL:", f)
    if not faults:
        print(f"LAYERS ok ({len(got)} outfits, {sum(len(l) for _, _, l in got)} bodies)")
    return 1 if faults else 0


if __name__ == "__main__":
    sys.exit(main())
