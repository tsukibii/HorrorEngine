"""UltraVHS offline: the shader's three passes in numpy, for previewing settings without Unreal.

    uv run --with numpy --with pillow python preview.py IN.png OUT.png [--preset camcorder|worn|nightmare]
        [--set Name=value ...] [--night] [--frame N] [--side-by-side]
    uv run --with numpy --with pillow python preview.py --chart chart.png    # a test chart to feed it

It follows Shaders/Private/UltraVHS.usf line for line (same names), except the persistence (no last frame here)
and bilinear sampling is done with numpy. Keep the two in step when either changes.
"""
import argparse
import math

import numpy as np
from PIL import Image

CAMCORDER = dict(
    bCrop4x3=True, TapeLines=480, Distortion=0.085, ChromaticAberration=0.0, Vignette=0.08,
    BlackLevel=(0.035, 0.027, 0.022), WhiteLevel=(0.82, 0.81, 0.78), Saturation=0.8,
    LumaBlur=1.4, Sharpen=1.0, SharpenRadius=3.0, ChromaBlur=2.0, ChromaShift=0.0, ChromaVerticalBlend=0.5,
    Ghosting=0.15, LumaNoise=0.0, ChromaNoise=0.0, TrackingJitter=0.0, TrackingError=0.0, HeadSwitch=0.0,
    Dropouts=0.0, Scanlines=0.0, Glitch=0.0,
)
PRESETS = {
    "camcorder": {},
    "worn": dict(Saturation=0.7, LumaBlur=1.6, ChromaBlur=3.0, ChromaShift=1.5, Ghosting=0.2, LumaNoise=0.25,
                 ChromaNoise=0.35, TrackingJitter=0.4, HeadSwitch=0.6, Dropouts=0.3),
    "nightmare": dict(TapeLines=360, Saturation=0.55, BlackLevel=(0.06, 0.045, 0.045), WhiteLevel=(0.74, 0.72, 0.70),
                      LumaBlur=1.8, ChromaBlur=4.5, ChromaShift=3.0, Ghosting=0.3, LumaNoise=0.5, ChromaNoise=0.7,
                      TrackingJitter=1.0, TrackingError=0.5, HeadSwitch=1.0, Dropouts=1.0, Scanlines=0.15),
}

NIGHT_BLACK = (0.02, 0.03, 0.05)   # the component's NightBlackLevel: night mode records black as a cool blue

M32 = np.uint32(0xFFFFFFFF)


def hash_u(x):
    x = x.astype(np.uint64) & 0xFFFFFFFF
    x ^= x >> 16
    x = (x * 0x7FEB352D) & 0xFFFFFFFF
    x ^= x >> 15
    x = (x * 0x846CA68B) & 0xFFFFFFFF
    x ^= x >> 16
    return x


def hash01(a, b, c):
    a, b, c = (np.asarray(v, dtype=np.uint64) for v in (a, b, c))
    return (hash_u(a ^ hash_u(b ^ hash_u(c))) >> 8).astype(np.float64) / 16777216.0


def line_noise(x, row, seed):
    cell = np.floor(x)
    t = x - cell
    t = t * t * (3 - 2 * t)
    c = (cell + 65536).astype(np.uint64)
    return hash01(c, row, seed) * (1 - t) + hash01(c + 1, row, seed) * t


def bilinear(img, px, py):
    """img HxWxC, sample at pixel coordinates (centres at .5), clamped."""
    h, w = img.shape[:2]
    x = np.clip(px - 0.5, 0, w - 1)
    y = np.clip(py - 0.5, 0, h - 1)
    x0 = np.floor(x).astype(int)
    y0 = np.floor(y).astype(int)
    x1 = np.minimum(x0 + 1, w - 1)
    y1 = np.minimum(y0 + 1, h - 1)
    fx = (x - x0)[..., None]
    fy = (y - y0)[..., None]
    return ((img[y0, x0] * (1 - fx) + img[y0, x1] * fx) * (1 - fy)
            + (img[y1, x0] * (1 - fx) + img[y1, x1] * fx) * fy)


def luma(c):
    return c @ np.array([0.299, 0.587, 0.114])


def rgb_to_yiq(c):
    m = np.array([[0.299, 0.587, 0.114], [0.596, -0.274, -0.322], [0.211, -0.523, 0.312]])
    return c @ m.T


def yiq_to_rgb(y):
    m = np.array([[1, 0.956, 0.621], [1, -0.272, -0.647], [1, -1.106, 1.703]])
    return y @ m.T


def tape_size(p, view_w, view_h):
    view_aspect = view_w / view_h
    tape_aspect = min(4 / 3, view_aspect) if p["bCrop4x3"] else view_aspect
    lines = int(min(max(p["TapeLines"], 120), 1080))
    return max(1, round(lines * tape_aspect)), lines


def capture(src, p, tw, th):
    vh, vw = src.shape[:2]
    tape_aspect = tw / th
    view_aspect = vw / vh
    corner_r2 = tape_aspect ** 2 + 1
    fringe = p["ChromaticAberration"] / (240 * corner_r2 * math.sqrt(corner_r2))
    zoom = max(1.0, 1 + p["Distortion"] * corner_r2)
    ys, xs = np.mgrid[0:th, 0:tw] + 0.5

    def tape_to_view(u, v, fr):
        px = (u - 0.5) * 2 * tape_aspect
        py = (v - 0.5) * 2
        r2 = px * px + py * py
        s = (1 + p["Distortion"] * r2) / zoom * (1 + fr * r2)
        return px * s / view_aspect * 0.5 + 0.5, py * s * 0.5 + 0.5

    c = np.zeros((th, tw, 3))
    hx, hy = 0.25 / tw, 0.25 / th
    for i in range(4):
        u = xs / tw + (hx if i & 1 else -hx)
        v = ys / th + (hy if i & 2 else -hy)
        for ch, fr in ((0, fringe), (1, 0.0), (2, -fringe)):
            vu, vv = tape_to_view(u, v, fr)
            c[..., ch] += bilinear(src[..., ch:ch + 1], vu * vw, vv * vh)[..., 0]
    c *= 0.25
    px = (xs / tw - 0.5) * 2 * tape_aspect
    py = (ys / th - 0.5) * 2
    vig = 1 + p["Vignette"] * (px * px + py * py)
    c /= (vig * vig)[..., None]
    l = luma(c)[..., None]
    c = l + (c - l) * p["Saturation"]
    black, white = np.array(p["BlackLevel"]), np.array(p["WhiteLevel"])
    return black + (white - black) * np.clip(c, 0, 1)


def tape(cap, p, frame, time):
    th, tw = cap.shape[:2]
    scale = th / 480
    ys, xs = np.mgrid[0:th, 0:tw] + 0.5
    row = ys.astype(np.uint64)
    v = ys / th
    g = min(max(p["Glitch"], 0), 1)

    jitter = p["TrackingJitter"] + g * 3
    offset = (hash01(row, frame, 1) - 0.5) * jitter + np.sin(time * 2.3 + v * 4) * 0.4 * jitter
    track = min(max(p["TrackingError"] + g * 0.8, 0), 1)
    band_at = (time * 0.09) % 1 * 1.4 - 0.2
    band = track * np.clip(1 - np.abs(v - band_at) / 0.05, 0, 1)
    offset += band * (hash01(row, frame, 2) - 0.3) * 28
    hs = min(max(p["HeadSwitch"] + g * 0.5, 0), 1)
    from_bottom = (th - ys) / scale
    hs_amount = hs * np.clip(1 - from_bottom / (5 + 5 * hs), 0, 1)
    offset += hs_amount * (14 + 12 * hash01(row, frame, 3))
    x = xs - offset * scale

    cap_y = luma(cap)[..., None]
    sl = max(p["LumaBlur"], 0.35)
    ss = max(p["SharpenRadius"], sl + 0.5)
    yl = wl = ys_ = ws = 0
    for i in range(-8, 9):
        y = bilinear(cap_y, x + i * scale, ys)[..., 0]
        a, b = math.exp(-0.5 * i * i / sl ** 2), math.exp(-0.5 * i * i / ss ** 2)
        yl, wl, ys_, ws = yl + y * a, wl + a, ys_ + y * b, ws + b
    yl, ys_ = yl / wl, ys_ / ws
    yv = yl + p["Sharpen"] * (yl - ys_)

    cap_iq = rgb_to_yiq(cap)[..., 1:]
    sc = max(p["ChromaBlur"], 0.5)
    step = max(sc * 0.3, 0.5)
    iq = 0
    wc = 0
    for j in range(-8, 9):
        d = j * step
        w = math.exp(-0.5 * d * d / sc ** 2)
        xc = x + (d - p["ChromaShift"]) * scale
        a = bilinear(cap_iq, xc, ys)
        b = bilinear(cap_iq, xc, ys - 1)
        iq = iq + (a + (b - a) * p["ChromaVerticalBlend"] * 0.5) * w
        wc += w
    iq = iq / wc

    ln = p["LumaNoise"] + g * 0.35 + band * 0.8 + hs_amount * 0.6
    yv = yv + (line_noise(x / (1.6 * scale), row, frame * 3 + 11) - 0.5) * ln * 0.22
    cn = p["ChromaNoise"] + g * 0.5 + band * 0.5
    smear = np.stack([line_noise(x / (18 * scale), row, frame * 3 + 12),
                      line_noise(x / (18 * scale), row, frame * 3 + 13)], -1) - 0.5
    iq = (iq + smear * cn[..., None] * 0.12) * (1 - g * 0.45)

    chance = p["Dropouts"] * 0.004 + g * 0.01 + band * 0.04
    hit = hash01(row, frame, 7) < chance
    start = hash01(row, frame, 8) * tw
    length = (8 + 48 * hash01(row, frame, 9)) * scale
    t = (xs - start) / length
    on = hit & (t >= 0) & (t <= 1)
    fade = np.where(on, 1 - t * t, 0)
    yv = yv + (0.85 - yv) * fade
    iq = iq * (1 - fade)[..., None]

    return np.clip(yiq_to_rgb(np.concatenate([yv[..., None], iq], -1)), 0, 1)


def display(tp, p, out_w, out_h):
    th, tw = tp.shape[:2]
    ys, xs = np.mgrid[0:out_h, 0:out_w] + 0.5
    u, v = xs / out_w, ys / out_h
    ta, va = tw / th, out_w / out_h
    fx, fy = (ta / va, 1.0) if ta < va else (1.0, va / ta)
    tu, tv = (u - 0.5) / fx + 0.5, (v - 0.5) / fy + 0.5
    c = bilinear(tp, tu * tw, tv * th)
    line = tv * th - 0.5
    c *= (1 - p["Scanlines"] * (0.5 - 0.5 * np.cos(line * 2 * math.pi)))[..., None]
    outside = (tu < 0) | (tu > 1) | (tv < 0) | (tv > 1)
    c[outside] = 0
    return c


def run(src, p, frame=0):
    h, w = src.shape[:2]
    tw, th = tape_size(p, w, h)
    cap = capture(src, p, tw, th)
    tp = tape(cap, p, frame, frame / 60.0)
    return display(tp, p, w, h)


def chart(w=1920, h=1080):
    """Hard edges, thin lines, saturated patches, a dark corridor and bright panels: what VHS shows best on."""
    img = np.full((h, w, 3), 0.62)
    ys, xs = np.mgrid[0:h, 0:w]
    img[(xs // 120 + ys // 120) % 2 == 0] = 0.48                       # checker walls
    img[(xs % 120 < 3) | (ys % 120 < 3)] = 0.08                         # grid lines: straight, to show the barrel
    cx, cy = w // 2, h // 2
    img[cy - 220:cy + 220, cx - 160:cx + 160] = 0.05                    # the corridor's dark end
    img[cy - 180:cy + 180, cx + 180:cx + 300] = 0.95                    # a lit doorway
    img[80:150, cx - 300:cx + 300] = 1.0                                # a ceiling light
    for i, col in enumerate([(0.8, 0.1, 0.1), (0.1, 0.6, 0.2), (0.15, 0.2, 0.8), (0.85, 0.75, 0.1), (0.7, 0.2, 0.6)]):
        img[h - 260:h - 120, 300 + i * 270:500 + i * 270] = col         # a rug's colours
    return img


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input", nargs="?")
    ap.add_argument("output", nargs="?")
    ap.add_argument("--preset", default="camcorder", choices=list(PRESETS))
    ap.add_argument("--set", action="append", default=[], help="Name=value (a knob from FUltraVHSSettings)")
    ap.add_argument("--night", action="store_true", help="night mode: BlackLevel becomes the night's cool blue")
    ap.add_argument("--frame", type=int, default=0)
    ap.add_argument("--side-by-side", action="store_true")
    ap.add_argument("--chart", help="write the test chart here and stop")
    a = ap.parse_args()

    if a.chart:
        Image.fromarray((chart() * 255).astype(np.uint8)).save(a.chart)
        print("wrote", a.chart)
        return
    p = dict(CAMCORDER, **PRESETS[a.preset])
    if a.night:
        p["BlackLevel"] = NIGHT_BLACK
    for kv in a.set:
        k, v = kv.split("=", 1)
        if k not in p:
            raise SystemExit(f"no knob {k}")
        p[k] = tuple(float(x) for x in v.split(",")) if isinstance(p[k], tuple) else type(p[k])(
            v.lower() in ("1", "true") if isinstance(p[k], bool) else v)
    src = np.asarray(Image.open(a.input).convert("RGB")).astype(np.float64) / 255
    out = run(src, p, a.frame)
    if a.side_by_side:
        out = np.concatenate([src, out], 1)
    Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8)).save(a.output)
    print("wrote", a.output)


if __name__ == "__main__":
    main()
