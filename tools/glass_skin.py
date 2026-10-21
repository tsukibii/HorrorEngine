"""A glass-skin texture set for MetaHuman faces (docs/METAHUMAN_LOOKS.md §2).

    python tools/glass_skin.py [--size 2048] [--out Content/Studio/Skin/GlassSkin] [--order SRMF]
                               [--roughness 0.32] [--specular 0.55] [--fuzz 0.25] [--pores 0.5] [--dew 0.6]
                               [--seed 7]

"Glass skin" is the K-beauty finish: even tone, pores you can't see, a soft wet highlight, light that sinks in a
little. On a MetaHuman that is mostly *roughness, specular and cavity*, not colour: the colour stays Creator's
synthesised skin (tone, texture type, foundation make-up), and the maps here are deliberately UV-agnostic (one
fine pore field with no face features drawn in) so they fit every MetaHuman head and never fight the synthesised
albedo. Writes, into --out:

    T_GlassSkin_Roughness.png   grey, linear   the roughness: low and even, pores a touch rougher, dew patches lower
    T_GlassSkin_Specular.png    grey, linear   the specular: a little above skin's usual 0.5, lower in the pores
    T_GlassSkin_Cavity.png      grey, linear   near white: very shallow pores (Creator's Texture Override: Cavity)
    T_GlassSkin_SRMF.png        RGBA, linear   the packed map MetaHuman bakes (Specular, Roughness, Metallic, Fuzz)
                                               in --order, to replace T_Head_SRMF after assembly
    T_GlassSkin_NormalMicro.png RGB, linear    an optional micro normal (DirectX green): the same pores, very shallow
    glass_skin.json             the recipe: what each file is, the Creator and material settings to pair with it
    glass_skin_sheet.png        a contact sheet (1:1 crops and the whole map) to review the look by eye

The default size is 2048 (committed, small). For a hero face run it at 4096 or 8192 on your machine: the maps are
generated, not resized, so the pores stay the same physical size (one pore every 1/400 of the map). Loading them:
`Content/Python/storykit/skin.py` (editor) imports the set and applies it to a MetaHuman, or do it by hand as the
doc says. The channel order of T_Head_SRMF is read off the assembled texture on the first run (§2.4 in the doc);
if it isn't S,R,M,F, rerun with --order (for example --order RSMF).
"""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "Content" / "Studio" / "Skin" / "GlassSkin"
NAMES = {"S": "Specular", "R": "Roughness", "M": "Metallic", "F": "Fuzz"}


def value_noise(size, cells, rng):
    """Smooth noise in [0, 1]: a random grid of `cells` x `cells`, bicubic up to size x size."""
    g = rng.random((cells, cells), dtype=np.float32)
    im = Image.fromarray((g * 65535).astype(np.uint16)).resize((size, size), Image.BICUBIC)
    return np.asarray(im, dtype=np.float32) / 65535.0


def pores(size, spacing, rng, jitter=0.45):
    """A pore field in [0, 1] (1 = the pore's centre, 0 = flat skin): one pore per `spacing` px on a jittered grid,
    each with its own radius and depth so the field doesn't read as a pattern. Row-chunked: 8K fits in memory."""
    n = int(np.ceil(size / spacing)) + 2
    cx = (np.arange(n) - 1)[None, :] * spacing + rng.uniform(-jitter, jitter, (n, n)) * spacing + spacing / 2
    cy = (np.arange(n) - 1)[:, None] * spacing + rng.uniform(-jitter, jitter, (n, n)) * spacing + spacing / 2
    radius = spacing * rng.uniform(0.18, 0.34, (n, n)).astype(np.float32)
    depth = (rng.random((n, n), dtype=np.float32) ** 1.6)          # most pores shallow, a few deep
    out = np.zeros((size, size), dtype=np.float32)
    xs = np.arange(size, dtype=np.float32)
    step = max(64, int(2 ** 24 // size))                              # rows per chunk
    for y0 in range(0, size, step):
        ys = np.arange(y0, min(size, y0 + step), dtype=np.float32)
        acc = np.zeros((len(ys), size), dtype=np.float32)
        gy = (ys // spacing).astype(int) + 1
        gx = (xs // spacing).astype(int) + 1
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                iy = np.clip(gy + dy, 0, n - 1)
                ix = np.clip(gx + dx, 0, n - 1)
                px = cx[iy[:, None], ix[None, :]]
                py = cy[iy[:, None], ix[None, :]]
                r = radius[iy[:, None], ix[None, :]]
                d = depth[iy[:, None], ix[None, :]]
                dist2 = (xs[None, :] - px) ** 2 + (ys[:, None] - py) ** 2
                t = np.clip(1.0 - dist2 / (r * r), 0.0, 1.0)      # a round dent, soft edge
                acc = np.maximum(acc, t * t * d)
        out[y0:y0 + len(ys)] = acc
    return out


def normal_from_height(h, strength):
    """A tangent-space normal map (DirectX green, what Unreal expects without flipping) from a height field."""
    dx = np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1)
    dy = np.roll(h, -1, axis=0) - np.roll(h, 1, axis=0)
    nx, ny, nz = -dx * strength, dy * strength, np.ones_like(h)
    l = np.sqrt(nx * nx + ny * ny + nz * nz)
    return np.stack([nx / l, ny / l, nz / l], axis=-1) * 0.5 + 0.5


def to8(a):
    return (np.clip(a, 0.0, 1.0) * 255.0 + 0.5).astype(np.uint8)


def sheet(maps, size, path):
    """A contact sheet: for each map a 1:1 crop (the pores at texture resolution) and the whole map small."""
    tile, pad = 384, 8
    cols = len(maps)
    im = Image.new("RGB", (cols * (tile + pad) + pad, 2 * (tile + pad) + pad + 24), (24, 24, 24))
    d = ImageDraw.Draw(im)
    for i, (name, arr) in enumerate(maps.items()):
        x = pad + i * (tile + pad)
        full = Image.fromarray(arr if arr.ndim == 3 else np.repeat(arr[..., None], 3, axis=-1))
        crop = full.crop((size // 2, size // 2, size // 2 + tile, size // 2 + tile))
        im.paste(crop, (x, pad + 24))
        im.paste(full.resize((tile, tile), Image.BOX), (x, 2 * pad + 24 + tile))
        d.text((x, pad), name, fill=(220, 220, 220))
    im.save(path)


def make(size, out, order, roughness, specular, fuzz, pore_amount, dew, seed):
    rng = np.random.default_rng(seed)
    out.mkdir(parents=True, exist_ok=True)
    spacing = max(3.0, size / 400.0)
    p = pores(size, spacing, rng) * pore_amount                      # 0..pore_amount at the pore centres
    lf = value_noise(size, 24, rng) - 0.5                            # slow mottling, -0.5..0.5
    dewp = np.clip((value_noise(size, 10, rng) - 0.55) * 4.0, 0.0, 1.0) * dew   # the dewy patches, 0..dew
    micro = (value_noise(size, max(64, size // 8), rng) - 0.5) * 0.05           # fine grain

    rough = roughness + 0.18 * p + micro + 0.04 * lf - 0.07 * dewp
    spec = specular - 0.15 * p + 0.03 * lf + 0.04 * dewp
    cav = 1.0 - 0.35 * p + 0.02 * lf
    fz = fuzz + 0.08 * lf - 0.05 * dewp
    met = np.zeros_like(p)
    nrm = normal_from_height(-p * 0.6, strength=0.9 * size / 2048.0)

    chans = {"S": spec, "R": rough, "M": met, "F": fz}
    srmf = np.stack([to8(chans[c]) for c in order], axis=-1)
    files = {
        "T_GlassSkin_Roughness.png": to8(rough),
        "T_GlassSkin_Specular.png": to8(spec),
        "T_GlassSkin_Cavity.png": to8(cav),
        "T_GlassSkin_SRMF.png": srmf,
        "T_GlassSkin_NormalMicro.png": to8(nrm),
    }
    for name, arr in files.items():
        Image.fromarray(arr).save(out / name, optimize=True)
    sheet({k.replace("T_GlassSkin_", "").replace(".png", ""): v for k, v in files.items()}, size, out / "glass_skin_sheet.png")

    stats = {k: {"mean": round(float(v.mean()), 3), "min": round(float(v.min()), 3), "max": round(float(v.max()), 3)}
             for k, v in {"roughness": rough, "specular": spec, "cavity": cav, "fuzz": fz}.items()}
    recipe = {
        "what": "glass skin for a MetaHuman face: low even roughness, slightly raised specular, shallow pores; the "
                "colour stays Creator's synthesised skin (docs/METAHUMAN_LOOKS.md §2)",
        "size": size, "seed": seed, "pore_spacing_px": spacing,
        "params": {"roughness": roughness, "specular": specular, "fuzz": fuzz, "pores": pore_amount, "dew": dew},
        "stats": stats,
        "files": {
            "T_GlassSkin_Roughness.png": "grey, linear (sRGB off), compression Grayscale: the roughness channel",
            "T_GlassSkin_Specular.png": "grey, linear: the specular channel",
            "T_GlassSkin_Cavity.png": "grey, linear: MetaHuman Creator > Materials > Skin > Texture Override > Cavity (face)",
            "T_GlassSkin_SRMF.png": "RGBA, linear, compression Masks: channels " + ", ".join(f"{c}={NAMES[o]}" for c, o in zip("RGBA", order))
                                    + "; swap in for T_Head_SRMF after assembly (verify the order on the first run)",
            "T_GlassSkin_NormalMicro.png": "RGB, Normalmap, DirectX green: optional; only as the face normal override "
                                           "if the synthesised normal shows pores (it also removes every wrinkle)",
        },
        "creator": {
            "skin.roughness": 0.85, "skin.face_texture_index": "the smoothest (youngest) of the texture types",
            "skin.freckles": "none", "skin.accents": "none, or redness on the cheeks only at 0.1 to 0.2",
            "makeup.foundation": {"apply": True, "color": "the skin tone, half a step lighter", "intensity": 0.6,
                                  "roughness": 0.15, "concealer": 0.8},
            "makeup.lips": {"roughness": "low (gloss)"},
            "eyes": "iris dark brown, limbal ring on, sclera brightness up a little",
        },
        "material_after_assembly": {
            "roughness multiplier": 0.8, "specular multiplier": 1.1, "scatter / subsurface multiplier": 1.15,
            "normal strength": 0.7, "note": "the head material instance's global scalars; names vary by version, "
                                            "storykit.skin prints the ones it finds",
        },
    }
    (out / "glass_skin.json").write_text(json.dumps(recipe, indent=2) + "\n")
    return stats


def main():
    a = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    a.add_argument("--size", type=int, default=2048)
    a.add_argument("--out", type=Path, default=OUT)
    a.add_argument("--order", default="SRMF", help="channel order of the packed map, R G B A (default SRMF)")
    a.add_argument("--roughness", type=float, default=0.32, help="base roughness (skin's usual 0.45 to 0.55)")
    a.add_argument("--specular", type=float, default=0.55, help="base specular (skin's usual 0.5)")
    a.add_argument("--fuzz", type=float, default=0.25)
    a.add_argument("--pores", type=float, default=0.5, help="pore depth, 0 (none) to 1 (ordinary skin)")
    a.add_argument("--dew", type=float, default=0.6, help="how much the dewy patches lower the roughness, 0 to 1")
    a.add_argument("--seed", type=int, default=7)
    args = a.parse_args()
    order = args.order.upper()
    if sorted(order) != sorted("SRMF"):
        a.error("--order must be a permutation of SRMF")
    stats = make(args.size, args.out, order, args.roughness, args.specular, args.fuzz, args.pores, args.dew, args.seed)
    for k, v in stats.items():
        print(f"{k:10s} mean {v['mean']:.3f}  min {v['min']:.3f}  max {v['max']:.3f}")
    print(f"wrote {args.out.relative_to(ROOT) if args.out.is_relative_to(ROOT) else args.out} ({args.size}px, order {order}); "
          f"review glass_skin_sheet.png")
    print("GLASS_SKIN ok")


if __name__ == "__main__":
    main()
