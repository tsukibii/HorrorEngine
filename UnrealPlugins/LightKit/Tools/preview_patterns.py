"""Light Kit's patterns offline: the Custom nodes of Content/Python/lightkit_materials.py in numpy, side by side.

    uv run --with numpy --with pillow python Tools/preview_patterns.py OUT.png [--time 2.0] [--metres 4]

Draws caustics, leaves, blinds, clouds and the puddle mask over a square METRES across (the light-space UV a kit
light sees), at TIME seconds. Keep it in step with the HLSL when either changes.
"""
import argparse

import numpy as np
from PIL import Image, ImageDraw


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def h(i, k=(127.1, 311.7)):
    return np.modf(np.sin(i[..., 0] * k[0] + i[..., 1] * k[1]) * 43758.5453)[0] % 1.0


def fbm(q, octaves, step):
    n = np.zeros(q.shape[:-1])
    a = 0.5
    for _ in range(octaves):
        i = np.floor(q)
        f = q - i
        f = f * f * (3 - 2 * f)
        h00, h10 = h(i), h(i + [1, 0])
        h01, h11 = h(i + [0, 1]), h(i + [1, 1])
        n += a * ((h00 * (1 - f[..., 0]) + h10 * f[..., 0]) * (1 - f[..., 1]) + (h01 * (1 - f[..., 0]) + h11 * f[..., 0]) * f[..., 1])
        q = q * 2.07 + step(q)
        a *= 0.5
    return n


def leaves(uv, t, scale=0.6, speed=0.4, openness=0.5):
    p = uv / scale * 3.0
    tt = t * speed
    w = 0.12 * np.stack([np.sin(tt * 1.3 + p[..., 1] * 0.9), np.cos(tt * 1.1 + p[..., 0] * 0.8)], -1)
    n = fbm(p + w, 3, lambda q: np.array([13.7, 7.3]) + w)
    cut = 0.68 + (0.42 - 0.68) * openness
    return 0.06 + 0.94 * smoothstep(cut - 0.05, cut + 0.05, n)


def blinds(uv, scale=0.05, openness=0.5, angle=0.0):
    a = np.radians(angle)
    s = uv[..., 0] * np.cos(a) + uv[..., 1] * np.sin(a)
    f = (s / scale) % 1.0
    return 0.04 + 0.96 * (1 - smoothstep(openness - 0.06, openness + 0.06, f))


def caustics(uv, t, scale=0.6, speed=0.4, openness=0.5):
    tt = t * speed
    acc = np.zeros(uv.shape[:-1])
    for layer in range(2):
        p = uv / scale * (1.0 if layer == 0 else 1.7) + layer * np.array([3.1, 1.7])
        p = p + 0.2 * np.stack([np.sin(p[..., 1] * 2.3 + tt), np.cos(p[..., 0] * 2.1 - tt * 0.8)], -1)
        i = np.floor(p)
        f = p - i
        d1 = np.full(uv.shape[:-1], 8.0)
        d2 = np.full(uv.shape[:-1], 8.0)
        for y in (-1, 0, 1):
            for x in (-1, 0, 1):
                g = np.array([x, y], float)
                c = i + g
                hh = np.stack([h(c), h(c, (269.5, 183.3))], -1)
                o = 0.5 + 0.4 * np.sin(tt * 0.7 + 6.2831853 * hh)
                d = np.linalg.norm(g + o - f, axis=-1)
                closer = d < d1
                d2 = np.where(closer, d1, np.where(d < d2, d, d2))
                d1 = np.where(closer, d, d1)
        acc += (1 - smoothstep(0.0, 0.12, d2 - d1)) * (0.7 if layer == 0 else 0.45)
    base = 0.05 + 0.45 * openness
    return base + (1.2 - base) * np.clip(acc, 0, 1)


def clouds(uv, t, scale=40.0, speed=0.04, openness=0.5):
    q = uv / scale + np.array([t * speed, t * speed * 0.37])
    n = fbm(q, 5, lambda q: np.array([5.3, 9.1]))
    cover = 0.35 + 0.3 * openness
    return 1.0 + (0.35 - 1.0) * smoothstep(cover - 0.08, cover + 0.08, n)


def wet(uv01, seed=0.0, coverage=0.45, edge=0.15, cells=3.0):
    q = uv01 * cells + seed * np.array([0.137, 0.271])
    n = fbm(q, 4, lambda q: np.array([3.7, 1.9]))
    e = np.abs(uv01 - 0.5) * 2
    box = 1 - smoothstep(0.35, 0.95, np.linalg.norm(e, axis=-1) * 0.8)
    c = (1 - coverage) * 0.8
    return smoothstep(c - edge, c + 0.02, n * box)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("output")
    ap.add_argument("--time", type=float, default=2.0)
    ap.add_argument("--metres", type=float, default=4.0)
    ap.add_argument("--px", type=int, default=360)
    a = ap.parse_args()

    ys, xs = np.mgrid[0:a.px, 0:a.px] + 0.5
    uv = np.stack([xs, ys], -1) / a.px * a.metres
    uv01 = np.stack([xs, ys], -1) / a.px
    tiles = [
        ("caustics (size 0.6 m)", caustics(uv, a.time)),
        ("leaves (size 0.6 m)", leaves(uv, a.time)),
        ("blinds (5 cm, half open)", blinds(uv)),
        ("clouds (40 m, over 400 m)", clouds(uv * 100, a.time)),
        ("a puddle (3 m box, 0.8 m wobble)", wet(uv01, seed=17.0, cells=3 / 0.8)),
    ]
    pad = 24
    sheet = Image.new("RGB", (len(tiles) * (a.px + 8), a.px + pad), (20, 20, 24))
    d = ImageDraw.Draw(sheet)
    for k, (label, v) in enumerate(tiles):
        img = (np.clip(v / max(v.max(), 1.0), 0, 1) * 255).astype(np.uint8)
        sheet.paste(Image.fromarray(img).convert("RGB"), (k * (a.px + 8), pad))
        d.text((k * (a.px + 8) + 4, 6), label, fill=(230, 230, 230))
    sheet.save(a.output)
    print("wrote", a.output)


if __name__ == "__main__":
    main()
