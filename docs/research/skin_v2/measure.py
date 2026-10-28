# The user's three reference stills (DECISIONS 2026-10-28, later), measured for skin_v2.md §1: skin colour (CIE L*a*b*,
# ITA°), the sparkle's density and contrast, the shadow edge's width, the lips' lines and highlights. The stills aren't
# in git (faces stay out of it): python docs/research/skin_v2/measure.py <folder with face.jpg, lips.jpg, eye.jpg>
# The regions are boxes in each still's pixels (the eye still's at quarter scale, x4). Reuse the functions on a render.
import os, sys
import numpy as np
from PIL import Image
def load(f): return np.asarray(Image.open(f).convert("RGB")).astype(np.float64) / 255.0
def lin(c): return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
def lab(rgb):
    L_ = lin(rgb); M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = L_ @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)
def lum(rgb): return lin(rgb) @ np.array([0.2126, 0.7152, 0.0722])
def region(img, x0, y0, x1, y1, s=1): return img[int(y0 * s):int(y1 * s), int(x0 * s):int(x1 * s)]
def stats(name, px):
    l = lab(px.reshape(-1, 3)); m = l.mean(0); sd = l.std(0)
    ita = np.degrees(np.arctan2(m[0] - 50, m[2]))
    srgb = tuple(int(x) for x in (px.reshape(-1, 3).mean(0) * 255).round())
    print(f"  {name:28s} L*{m[0]:5.1f} a*{m[1]:5.1f} b*{m[2]:5.1f}  (sd L {sd[0]:4.1f})  ITA {ita:5.1f}°  sRGB {srgb}")
    return m
def boxblur(a, r):
    c = np.cumsum(np.cumsum(np.pad(a, ((r + 1, r), (r + 1, r)), mode="edge"), 0), 1)
    return (c[2 * r + 1:, 2 * r + 1:] - c[:-2 * r - 1, 2 * r + 1:] - c[2 * r + 1:, :-2 * r - 1] + c[:-2 * r - 1, :-2 * r - 1]) / (2 * r + 1) ** 2
def sparkles(name, img, x0, y0, x1, y1, pxmm, k=2.2):
    """bright specks: a pixel brighter than its neighbourhood's mean by k of its spread and the brightest in 3x3"""
    Y = lum(region(img, x0, y0, x1, y1))
    r = max(2, int(round(0.6 * pxmm)))                       # the neighbourhood: about 1.2 mm across
    m = boxblur(Y, r); v = np.sqrt(np.maximum(boxblur(Y * Y, r) - m * m, 1e-12))
    hi = Y > m + k * v
    pk = hi.copy()
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dx or dy: pk &= Y >= np.roll(np.roll(Y, dy, 0), dx, 1)
    n = int(pk.sum()); area = Y.size / pxmm ** 2 / 100           # cm²
    frac = hi.mean()
    contrast = float(np.median((Y[pk] / m[pk]))) if n else 0
    print(f"  {name:28s} {n} specks over {area:.2f} cm²: {n / area:.0f} a cm² (about {10 / np.sqrt(n / area):.2f} mm apart); {100 * frac:.1f}% of the skin above; a speck {contrast:.2f}× its surround")
def profile(name, img, y, x0, x1, pxmm, rows=6):
    """the luminance across a shadow edge (a row band, left to right): the 10-90% transition width in mm"""
    Y = lum(img[y - rows:y + rows, x0:x1]).mean(0)
    Ys = np.convolve(Y, np.ones(5) / 5, mode="same")[3:-3]
    hi, lo = np.percentile(Ys, 95), np.percentile(Ys, 5)
    t10 = lo + 0.1 * (hi - lo); t90 = lo + 0.9 * (hi - lo)
    i90 = int(np.argmax(Ys < t90)); i10 = int(np.argmax(Ys < t10))
    print(f"  {name:28s} lit {hi:.3f}, shadow {lo:.3f} (ratio {hi / max(lo, 1e-4):.1f}:1); 90%->10% over {(i10 - i90) / pxmm:.1f} mm")

D = sys.argv[1] if len(sys.argv) > 1 else "."
face, lips, eye = (load(os.path.join(D, f)) for f in ("face.jpg", "lips.jpg", "eye.jpg"))
print("FACE (1080x603, the whole face, front, a soft key; the nose shadows her left side)")
for nm, b in {"cheek, her right (lit)": (360, 280, 430, 350), "cheek, her left (lit)": (650, 280, 720, 350), "beside the nose (shadow)": (565, 260, 600, 320),
              "nose tip": (510, 330, 570, 360), "chin": (500, 475, 580, 515), "lips": (480, 410, 600, 440), "neck (shadow)": (470, 550, 630, 595),
              "hair (front)": (300, 120, 340, 260), "background": (20, 20, 200, 200)}.items():
    stats(nm, region(face, *b))
print("EYE AND NOSE (4320x2156; quarter-scale coordinates ×4)")
S = 4; pxmm = 102 * S / 11.7                                    # the near iris 102 px across at quarter scale, an iris 11.7 mm
print(f"  scale: {pxmm:.1f} px a mm (the near iris, 11.7 mm across)")
for nm, b in {"cheek, lit": (700, 300, 800, 380), "cheek, under the eye": (600, 175, 700, 205), "forehead": (550, 25, 700, 60),
              "nose bridge, lit": (400, 230, 440, 300), "nose side, shadow": (480, 260, 540, 320), "nose tip highlight": (345, 360, 375, 390),
              "nose wing edge (red)": (355, 405, 380, 440), "nostril": (420, 425, 470, 445), "lower lid / tear line": (600, 150, 700, 160),
              "sclera (near eye)": (565, 115, 590, 135), "iris (near eye)": (620, 110, 680, 150)}.items():
    stats(nm, region(eye, *b, s=S))
sparkles("cheek, lit (sparkle)", eye, 2720, 1040, 3520, 1760, pxmm)
sparkles("cheek under the eye", eye, 2400, 700, 2800, 820, pxmm)
sparkles("forehead", eye, 2200, 100, 2800, 240, pxmm)
sparkles("nose bridge", eye, 1600, 920, 1760, 1200, pxmm)
profile("nose: lit side to shadow", eye, 1200, 1680, 2240, pxmm)
profile("cheek: light to the jaw shadow", eye, 1500, 3300, 4100, pxmm)
print("LIPS (1080x509, close-up)")
for nm, b in {"lower lip": (300, 290, 640, 420), "upper lip": (300, 120, 650, 220), "skin beside the lips": (20, 20, 180, 180),
              "lip corner (dark)": (190, 237, 240, 267)}.items():
    stats(nm, region(lips, *b))
Y = lum(region(lips, 330, 330, 650, 400)); Yh = Y - boxblur(Y, 8)
spec = np.abs(np.fft.rfft(Yh.mean(0) - Yh.mean()))
f = np.fft.rfftfreq(Yh.shape[1]); i = 3 + int(np.argmax(spec[3:60]))
print(f"  lower lip's lines: strongest period {1 / f[i]:.1f} px across = {1 / f[i] / 22:.2f} mm (the lower lip's red 220 px tall, about 10 mm: 22 px a mm)")
hl = Y > np.percentile(Y, 99.0)
print(f"  lower lip highlights: the top 1% at {np.percentile(Y, 99.0) / np.median(Y):.2f}× the lip's median; peak {Y.max() / np.median(Y):.2f}×")
