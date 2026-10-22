// The salon's hair look (docs/SALON.md, The look): a strand atlas made in code and the looks (presets) the hair shader
// (hairshader.js) reads. Plain arrays, no three.js, so node can check it.
//
// The atlas: W x H RGBA bytes, v = y / H down a card (0 the root, 1 the tip), u across it (cards take half its width,
// wrapping). Strands run root to tip in clumps; each clump narrows to a point over its last stretch (the see-through,
// pointed ends of a fringe), strands stop at their own lengths and thin out as they go. Channels:
//   R  the strand's brightness (each strand a little lighter or darker)
//   G  the strand's own random number (its highlight's shift; the few above 1 - inner are the inner colour)
//   B  the clump's random number (whole clumps lighter, glossier)
//   A  coverage (the shader cuts it out, softly)
//   albedo(atlas, look) -> RGBA bytes with the look's colours baked in (for the glTF, which can't carry the shader)

import { rng } from "./salonlib.js";

// colours as sRGB hex; spec1 the sharp highlight (shifted towards the root), spec2 the broad tinted one (towards the
// tip); shift: how far each strand's highlight wanders; inner: the hidden-colour strands, how many
export const LOOKS = {
  jet_blue: { label: "Jet black, blue sheen, crimson strands", root: "#060709", tip: "#1b2028", inner: "#6a0c18", innerAmount: 0.05,
              spec1: "#a7b9cf", spec2: "#3b5270", shine: 1.0, gloss1: 220, gloss2: 45, shift1: -0.07, shift2: 0.12, shiftNoise: 0.22,
              rim: "#4d5f78", rimAmount: 0.2, rootLength: 0.3 },
  natural_black: { label: "Natural black", root: "#030303", tip: "#121110", inner: "#121110", innerAmount: 0, spec1: "#d9d4cc", spec2: "#5a524a",
              shine: 0.85, gloss1: 240, gloss2: 55, shift1: -0.06, shift2: 0.1, shiftNoise: 0.22, rim: "#3a3633", rimAmount: 0.12, rootLength: 0.3 },
  dark_brown: { label: "Dark brown", root: "#0b0604", tip: "#2a1a10", inner: "#2a1a10", innerAmount: 0, spec1: "#e6d2bb", spec2: "#7a5236",
              shine: 0.8, gloss1: 220, gloss2: 50, shift1: -0.05, shift2: 0.1, shiftNoise: 0.22, rim: "#4a3426", rimAmount: 0.12, rootLength: 0.3 },
  ash_brown: { label: "Ash brown", root: "#14110f", tip: "#5a524b", inner: "#5a524b", innerAmount: 0, spec1: "#e8e6e2", spec2: "#8a8279",
              shine: 0.7, gloss1: 180, gloss2: 45, shift1: -0.05, shift2: 0.1, shiftNoise: 0.22, rim: "#6d655d", rimAmount: 0.12, rootLength: 0.35 },
  chestnut: { label: "Chestnut", root: "#140805", tip: "#5e2c16", inner: "#7a3a1c", innerAmount: 0.04, spec1: "#f3d8bd", spec2: "#a35a33",
              shine: 0.85, gloss1: 220, gloss2: 50, shift1: -0.05, shift2: 0.1, shiftNoise: 0.22, rim: "#6e3c24", rimAmount: 0.12, rootLength: 0.3 },
  black_red_tips: { label: "Black, red underneath and at the tips", root: "#020203", tip: "#1a0a0c", inner: "#8c0e1e", innerAmount: 0.2,
              spec1: "#d8c8cc", spec2: "#6a2a34", shine: 0.95, gloss1: 250, gloss2: 58, shift1: -0.07, shift2: 0.12, shiftNoise: 0.25, rim: "#5a2a32", rimAmount: 0.15, rootLength: 0.3 },
};
export const DEFAULT_LOOK = "jet_blue";
export const UV_SPAN = 0.3;          // how much of the atlas's width one card shows (about eight clumps)

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function makeAtlas(o = {}) {
  const W = o.W ?? 512, H = o.H ?? 512, r = rng(o.seed ?? 7), clumps = o.clumps ?? 34, taper = o.tipTaper ?? 0.3, minLen = o.minLength ?? 0.74;
  const A = new Float32Array(W * H), best = new Float32Array(W * H), R = new Uint8Array(W * H), G = new Uint8Array(W * H), B = new Uint8Array(W * H);
  let strands = 0;
  for (let c = 0; c < clumps; c++) {
    const xc = (c + 0.2 + 0.6 * r()) / clumps * W, wc = W / clumps * (1.3 + 0.9 * r()), Lc = minLen + (1 - minLen) * r(), cr = r(), n = 14 + Math.floor(r() * 14);
    for (let s = 0; s < n; s++, strands++) {
      const off = (r() * 2 - 1) * wc / 2, len = Lc * (0.8 + 0.2 * r()), alpha = 0.55 + 0.45 * r(), w0 = 0.7 + 0.9 * r(), bright = r(), id = r();
      const amp = 0.3 + 0.9 * r(), freq = 2 + 5 * r(), ph = r() * 6.28;
      const end = Math.min(H - 1, Math.floor(len * H));
      for (let y = 0; y <= end; y++) {
        const v = y / H, conv = 0.92 * smooth(Lc * (1 - taper), Lc, v);       // the clump draws together to its point
        const x = xc + off * (1 - conv) + amp * Math.sin(freq * 6.28 * v + ph);
        const w = w0 * (1 - 0.6 * smooth(0.6 * len, len, v)), a = alpha * (1 - smooth(0.88 * len, len, v));
        const x0 = x - w / 2, x1 = x + w / 2;
        for (let px = Math.floor(x0); px <= Math.floor(x1); px++) {
          const cov = Math.max(0, Math.min(px + 1, x1) - Math.max(px, x0)) * a; if (cov <= 0) continue;
          const i = y * W + (((px % W) + W) % W);
          A[i] = A[i] + cov * (1 - A[i]);
          if (cov > best[i]) { best[i] = cov; R[i] = Math.round(bright * 255); G[i] = Math.round(id * 255); B[i] = Math.round(cr * 255); }
        }
      }
    }
  }
  const data = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) { data[i * 4] = R[i]; data[i * 4 + 1] = G[i]; data[i * 4 + 2] = B[i]; data[i * 4 + 3] = Math.round(Math.min(1, A[i]) * 255); }
  return { W, H, data, strands, clumps };
}

// sRGB hex -> linear [r, g, b]
export function linear(hex) {
  const n = parseInt(hex.replace("#", ""), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(x => x / 255);
  return c.map(x => x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));
}
const toSRGB = x => Math.round(255 * Math.max(0, Math.min(1, x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055)));

// the atlas with the look's colours in it (sRGB bytes, alpha kept): what the bake carries
export function albedo(atlas, look) {
  const { W, H, data } = atlas, out = new Uint8ClampedArray(W * H * 4), root = linear(look.root), tip = linear(look.tip), inner = linear(look.inner);
  for (let y = 0; y < H; y++) {
    const k = smooth(0, look.rootLength, y / H);
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, br = data[i] / 255, id = data[i + 1] / 255, cl = data[i + 2] / 255;
      let c = [0, 1, 2].map(a => (root[a] + (tip[a] - root[a]) * k) * (0.45 + 0.55 * br) * (0.6 + 0.8 * cl));
      if (id > 1 - look.innerAmount) c = inner.map(v => v * (0.7 + 0.3 * br) * (0.4 + 0.6 * k));
      out[i] = toSRGB(c[0]); out[i + 1] = toSRGB(c[1]); out[i + 2] = toSRGB(c[2]); out[i + 3] = data[i + 3];
    }
  }
  return out;
}

// how see-through the atlas is down its length: coverage by tenths, root to tip (for the check)
export function coverageProfile(atlas, bands = 10) {
  const { W, H, data } = atlas, out = [];
  for (let b = 0; b < bands; b++) { let s = 0, n = 0; for (let y = Math.floor(b * H / bands); y < Math.floor((b + 1) * H / bands); y++) for (let x = 0; x < W; x++) { s += data[(y * W + x) * 4 + 3]; n++; } out.push(+(s / n / 255).toFixed(3)); }
  return out;
}
