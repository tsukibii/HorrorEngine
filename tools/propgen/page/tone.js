// The previews' tone (tools/propgen/tone.py, the same numbers: docs/PROPGEN.md §25): scene light (linear) to display
// values, and the sticker passes' 8-bit light decoded. A picture the page lays over a thumbnail is lit by the passes
// and toned here exactly as the thumbnail itself was toned in Python, so the two agree.

const INSET = [0.842479062253094, 0.0784335999999992, 0.0792237451477643,
  0.0423282422610123, 0.878468636469772, 0.0791661274605434,
  0.0423756549057051, 0.0784336, 0.879142973793104];
const OUTSET = [1.19687900512017, -0.0980208811401368, -0.0990297440797205,
  -0.0528968517574562, 1.15190312990417, -0.0989611768448433,
  -0.0529716355144438, -0.0980434501171241, 1.15107367264116];
const EV0 = -12.47393, EV1 = 4.026069;

function curve(x) {
  x = Math.min(Math.max((Math.log2(Math.max(x, 1e-10)) - EV0) / (EV1 - EV0), 0), 1);
  const x2 = x * x, x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
}

// linear Rec.709 light -> display values 0..1, into out[o..o+2]
export function agx(r, g, b, out, o = 0) {
  const a = curve(INSET[0] * r + INSET[1] * g + INSET[2] * b);
  const c = curve(INSET[3] * r + INSET[4] * g + INSET[5] * b);
  const d = curve(INSET[6] * r + INSET[7] * g + INSET[8] * b);
  out[o] = Math.min(Math.max(OUTSET[0] * a + OUTSET[1] * c + OUTSET[2] * d, 0), 1);
  out[o + 1] = Math.min(Math.max(OUTSET[3] * a + OUTSET[4] * c + OUTSET[5] * d, 0), 1);
  out[o + 2] = Math.min(Math.max(OUTSET[6] * a + OUTSET[7] * c + OUTSET[8] * d, 0), 1);
  return out;
}

// a light coded in 8 bits (tone.enc: sqrt(L / (1 + L))) back to the light
export const DEC = new Float32Array(256).map((_, i) => { const e = Math.min(i / 255, 254.5 / 255); return e * e / (1 - e * e); });

// sRGB 8-bit -> linear
export const LIN = new Float32Array(256).map((_, i) => { const c = i / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
