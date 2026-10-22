"""The Character Studio's clothing presets as GarmentCode designs: each one a few changes to GarmentCode's defaults
(vendor/garmentcode/src/assets/design_params/default.yaml), written whole to Content/Studio/Clothes/designs/<name>.yaml,
and the outfits (garments made in order, each draped over the ones before) to Content/Studio/Clothes/outfits.json.
GarmentCode has no sailor collar and no true pleats: the sailor blouse is a loose top with a deep V, the pleated skirt
many panels with a little flare. Runs in GarmentCode's environment (yaml):

    vendor/garmentcode/venv/bin/python tools/character/make_designs.py
"""
import copy
import json
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
DEFAULT = ROOT / "vendor" / "garmentcode" / "src" / "assets" / "design_params" / "default.yaml"
OUT = ROOT / "Content" / "Studio" / "Clothes"

# our characters stand in an A-pose (arms about 45 degrees down): sleeves cut at 45 hang without crumpling, and without
# GarmentCode's cuff bands (they fold up at the wrist in the drape); a top's hem flares a little (shirt.flare) so it
# passes over the hips instead of riding up on them
LONG_SLEEVE = {"sleeve.sleeveless": False, "sleeve.length": 0.8, "sleeve.end_width": 1.0, "sleeve.sleeve_angle": 45,
               "sleeve.armhole_shape": "ArmholeCurve", "sleeve.cuff.type": None}
PRESETS = {   # name: (what it is, {dotted path: value})
    "button_shirt": ("a school or office shirt: long sleeves with cuffs, a small standing collar", {
        "meta.upper": "Shirt", "meta.wb": None, "meta.bottom": None, "shirt.length": 1.5, "shirt.width": 1.0, "shirt.flare": 1.25,
        "collar.f_collar": "VNeckHalf", "collar.b_collar": "CircleNeckHalf", "collar.width": 0.1, "collar.fc_depth": 0.6,
        "collar.component.style": "SimpleLapel", "collar.component.lapel_standing": True, "collar.component.depth": 3, **LONG_SLEEVE}),
    "short_sleeve_shirt": ("a summer school shirt: short sleeves, a small collar", {
        "meta.upper": "Shirt", "meta.wb": None, "meta.bottom": None, "shirt.length": 1.45, "shirt.width": 1.0, "shirt.flare": 1.25,
        "sleeve.sleeve_angle": 45, "collar.f_collar": "VNeckHalf", "collar.fc_depth": 0.6, "collar.width": 0.1, "collar.component.style": "SimpleLapel",
        "collar.component.lapel_standing": True, "collar.component.depth": 3, "sleeve.sleeveless": False, "sleeve.length": 0.35,
        "sleeve.end_width": 1.0}),
    "sailor_blouse": ("a sailor-uniform blouse (no flap collar in GarmentCode: a loose top with a deep V)", {
        "meta.upper": "Shirt", "meta.wb": None, "meta.bottom": None, "shirt.length": 1.4, "shirt.width": 1.12, "shirt.flare": 1.3,
        "collar.f_collar": "VNeckHalf", "collar.b_collar": "SquareNeckHalf", "collar.width": 0.35, "collar.fc_depth": 1.3,
        "collar.bc_depth": 0.4, **LONG_SLEEVE}),
    "blazer": ("a school blazer: long, roomy, a lapel, long sleeves (worn over a shirt)", {
        "meta.upper": "Shirt", "meta.wb": None, "meta.bottom": None, "shirt.length": 1.75, "shirt.width": 1.15, "shirt.flare": 1.35,
        "collar.f_collar": "VNeckHalf", "collar.b_collar": "CircleNeckHalf", "collar.width": 0.25, "collar.fc_depth": 1.6,
        "collar.component.style": "SimpleLapel", "collar.component.lapel_standing": False, "collar.component.depth": 6,
        **LONG_SLEEVE}),
    "gakuran": ("a gakuran (the boys' standing-collar uniform jacket): closed, long sleeves", {
        "meta.upper": "Shirt", "meta.wb": None, "meta.bottom": None, "shirt.length": 1.65, "shirt.width": 1.06, "shirt.flare": 1.25,
        "collar.f_collar": "CircleNeckHalf", "collar.b_collar": "CircleNeckHalf", "collar.width": 0.0, "collar.fc_depth": 0.35,
        "collar.component.style": "Turtle", "collar.component.depth": 3, **LONG_SLEEVE}),
    "hoodie": ("a hoodie: loose, long sleeves, a hood", {
        "meta.upper": "Shirt", "meta.wb": None, "meta.bottom": None, "shirt.length": 1.6, "shirt.width": 1.15, "shirt.flare": 1.3,
        "collar.f_collar": "CircleNeckHalf", "collar.fc_depth": 0.5, "collar.component.style": "Hood2Panels",
        "collar.component.hood_depth": 1.2, **LONG_SLEEVE}),
    "pleated_skirt": ("a school pleated skirt (many panels, a little flare): just above the knee", {
        "meta.upper": None, "meta.wb": "StraightWB", "meta.bottom": "SkirtManyPanels", "waistband.width": 0.15,
        "flare-skirt.length": 0.32, "flare-skirt.suns": 0.35, "flare-skirt.skirt-many-panels.n_panels": 15,
        "flare-skirt.skirt-many-panels.panel_curve": 0}),
    "long_skirt": ("a long, softly flared skirt", {
        "meta.upper": None, "meta.wb": "StraightWB", "meta.bottom": "SkirtCircle", "flare-skirt.length": 0.75, "flare-skirt.suns": 0.5}),
    "trousers": ("full-length straight trousers with a waistband", {
        "meta.upper": None, "meta.wb": "StraightWB", "meta.bottom": "Pants", "waistband.width": 0.15, "pants.length": 0.88,
        "pants.width": 1.12, "pants.flare": 1.0, "pants.rise": 1.0}),
    "jeans": ("slim full-length jeans", {
        "meta.upper": None, "meta.wb": "FittedWB", "meta.bottom": "Pants", "pants.length": 0.86, "pants.width": 1.0,
        "pants.flare": 0.85, "pants.rise": 0.85}),
}
OUTFITS = {   # name: [(design, colour), ...] made in order, each over the ones before
    "school uniform (sailor)": [["sailor_blouse", "#eef0f2"], ["pleated_skirt", "#1f2a44"]],
    "school uniform (blazer, skirt)": [["button_shirt", "#f2f2ee"], ["pleated_skirt", "#3a3f4a"], ["blazer", "#1d2840"]],
    "school uniform (blazer, trousers)": [["button_shirt", "#f2f2ee"], ["trousers", "#2b2f38"], ["blazer", "#1d2840"]],
    "gakuran": [["trousers", "#141519"], ["gakuran", "#141519"]],
    "summer uniform": [["short_sleeve_shirt", "#f4f4f0"], ["pleated_skirt", "#2a3550"]],
    "shirt and trousers": [["button_shirt", "#dfe6ee"], ["trousers", "#2f3238"]],
    "casual": [["t-shirt", "#c9c3b8"], ["jeans", "#2e4566"]],
    "hoodie and jeans": [["jeans", "#2e4566"], ["hoodie", "#3a3a3e"]],
}


def setv(design, path, value):
    node = design
    for k in path.split("."): node = node[k]
    if "range" in node and node.get("type", "").startswith("select") and value not in node["range"]:
        raise ValueError(f"{path}: {value!r} isn't one of {node['range']}")
    node["v"] = value


def main():
    base = yaml.safe_load(DEFAULT.read_text(encoding="utf-8"))
    (OUT / "designs").mkdir(parents=True, exist_ok=True)
    for name, (about, changes) in PRESETS.items():
        d = copy.deepcopy(base)
        for path, v in changes.items(): setv(d["design"], path, v)
        text = f"# {name}: {about}. Made by tools/character/make_designs.py from GarmentCode's defaults.\n" + yaml.safe_dump(d, sort_keys=False)
        (OUT / "designs" / f"{name}.yaml").write_text(text, encoding="utf-8")
    (OUT / "outfits.json").write_text(json.dumps({"about": "garments made in order, each draped over the ones before (tools/character/make_designs.py)",
                                                   "outfits": OUTFITS}, indent=1), encoding="utf-8")
    print(f"{len(PRESETS)} designs, {len(OUTFITS)} outfits")


if __name__ == "__main__":
    main()
