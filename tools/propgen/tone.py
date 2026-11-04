"""The previews' tone: scene light (linear) to the picture's 8-bit sRGB, and the sticker passes' light coded in 8 bits
(docs/PROPGEN.md §25). One curve shared with the page (`page/tone.js`, the same numbers): a preview's picture is toned
here from its linear render, and a sticker the page lays over it is lit by the passes and toned there by the same
curve, so the two agree pixel for pixel.

The curve is AgX (Troy Sobotka's, the approximation by Benjamin Wrensch: an inset matrix, a log2 allocation from
-12.47 to +4.03 stops, a sixth-order sigmoid, the outset), close to Blender's own AgX the previews used before.
"""
import numpy as np

INSET = np.array([[0.842479062253094, 0.0784335999999992, 0.0792237451477643],
                  [0.0423282422610123, 0.878468636469772, 0.0791661274605434],
                  [0.0423756549057051, 0.0784336, 0.879142973793104]])
OUTSET = np.array([[1.19687900512017, -0.0980208811401368, -0.0990297440797205],
                   [-0.0528968517574562, 1.15190312990417, -0.0989611768448433],
                   [-0.0529716355144438, -0.0980434501171241, 1.15107367264116]])
EV = (-12.47393, 4.026069)


def agx(rgb):
    """Linear Rec.709 light (..., 3) to display values 0..1 (sRGB-encoded)."""
    x = np.asarray(rgb, np.float64) @ INSET.T
    x = (np.clip(np.log2(np.maximum(x, 1e-10)), EV[0], EV[1]) - EV[0]) / (EV[1] - EV[0])
    x2 = x * x
    x4 = x2 * x2
    y = 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232
    return np.clip(y @ OUTSET.T, 0.0, 1.0)


def enc(light):
    """A light (0..inf, linear) in 0..1 for 8 bits: sqrt(L / (1 + L)), fine in the shadows, never clipped."""
    L = np.maximum(np.asarray(light, np.float64), 0.0)
    return np.sqrt(L / (1.0 + L))


def dec(e):
    e = np.minimum(np.asarray(e, np.float64), 254.5 / 255)
    return e * e / (1.0 - e * e)


def srgb_to_linear(c):
    c = np.asarray(c, np.float64)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
