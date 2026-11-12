// The pores: where hair grows from, for the hair editor v2.0 (docs/HAIR_V2.md). One fixed set of points on MHR's
// scalp, made once (pores.mjs -> Content/Studio/Hair2/pores.bin) and the same for every character: each sits on its own
// triangle of the mesh, so it rides any head the Studio makes (a fitted face, the sculpt, a child, a creature); the two
// sides are mirror images; and they are ranked, so the first N of them are evenly spaced too (Density takes a prefix:
// nothing reshuffles). Which pores are alive is the hairline (a dropdown of shapes and a few sliders) and the thinning.
// Plain arrays, no three.js. The head's local space throughout (salonref.js): the origin between the ears, X the
// character's left, Y up, Z forward, metres on MHR's base head.
//
// The chart: a pore's place on the scalp as an angle round the head (az, degrees: 0 the front, 90 her left, -90 her
// right, 180 the back; about the skull's middle C) and its height (y). It is read on MHR's base head and kept with the
// pore, so a hairline means the same place on the mesh for every character.
//
//   readPores(buffer) -> { n, tri, bary, base, az, u, mirror, C }
//   place(pores, L, T, VN) -> { pos, nrm }             each pore on a body (its local points, triangles, smooth normals)
//   hairline(settings) -> limit(az) -> y               the scalp's lower edge at an angle (az signed)
//   alive(pores, settings, count) -> { on, edge, n }   which of the first `count` pores grow hair; edge: 0 at the hairline to 1 well inside
import { rng } from "../salonlib.js";

const D = Math.PI / 180;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// heights of the face on MHR's base head (local metres), for the fringe, the cut and the keep-outs
export const MARKS = { crown: 0.122, hairline: 0.082, brow: 0.037, eye: 0.015, nose: -0.021, lips: -0.05, jaw: -0.066, chin: -0.096, earTop: 0.05, earBottom: -0.033,
  shoulder: -0.135, collar: -0.17, chest: -0.30 };

export const chartAz = (x, z, C) => Math.atan2(x, z - C[2]) / D;

// ---- the widest scalp: where the fixed pores are. Every hairline lies inside it ----------------------------------------
// round the head from the front (az 0..180, either side): the lowest front hairline, the temples' corners, the longest
// sideburns in front of the ears, over the ears (never on them), close behind them, the lowest nape
export function masterLimit(az) {
  az = Math.abs(az);
  if (az < 30) return 0.056;
  if (az < 52) return lerp(0.056, 0.036, (az - 30) / 22);
  if (az < 59) return lerp(0.036, -0.052, (az - 52) / 7);
  if (az < 118) return -0.052;                                           // the sideburn, and round the ear (the ear itself is cut out: onEar)
  if (az < 140) return lerp(-0.052, -0.085, (az - 118) / 22);
  return -0.09;
}
// the ear on the chart (MHR's base head: its flap from 85 to 112 degrees round, 3.3 cm under the ears' line to 2 cm
// over it) with half a centimetre round it: no pore there. earIn: under 1 inside it, 1 on its edge; earGap: metres
// outside it (about)
export const EAR = { az: 98, y: -0.0125, da: 18, dy: 0.0395, n: 3 };
export const earIn = (az, y) => Math.pow(Math.pow(Math.abs((Math.abs(az) - EAR.az) / EAR.da), EAR.n) + Math.pow(Math.abs((y - EAR.y) / EAR.dy), EAR.n), 1 / EAR.n);
export const onEar = (az, y) => earIn(az, y) < 1;
export const earGap = (az, y) => Math.max(0, earIn(az, y) - 1) * 0.03;

// ---- hairlines ----------------------------------------------------------------------------------------------------------
// A hairline is the scalp's lower edge as heights at a few angles (the front's middle, half way out, the temple's
// corner, the temple's foot), smooth between, then the sideburn, the ear and the nape, each from its own slider.
//   front: [y at az 0, y at az 18, y at az 34, y at the corner], corner: the angle where it turns down to the sideburn
export const HAIRLINES = {
  soft_round: { label: "Soft round", front: [0.086, 0.085, 0.079, 0.062], corner: 50 },
  straight: { label: "Straight", front: [0.083, 0.083, 0.082, 0.070], corner: 51 },
  high: { label: "High forehead", front: [0.096, 0.095, 0.089, 0.068], corner: 50 },
  low: { label: "Low", front: [0.074, 0.073, 0.068, 0.054], corner: 50 },
  widows_peak: { label: "Widow's peak", front: [0.076, 0.088, 0.083, 0.064], corner: 50, peak: 1 },
  heart: { label: "Heart", front: [0.078, 0.089, 0.080, 0.058], corner: 49, peak: 0.6 },
  square: { label: "Square (men's)", front: [0.085, 0.085, 0.085, 0.074], corner: 53 },
  m_shape: { label: "M-shape", front: [0.084, 0.088, 0.100, 0.074], corner: 52 },
  receding_1: { label: "Receding I", front: [0.088, 0.093, 0.106, 0.078], corner: 53 },
  receding_2: { label: "Receding II", front: [0.094, 0.103, 0.118, 0.084], corner: 54 },
  receding_3: { label: "Receding III", front: [0.104, 0.116, 0.128, 0.090], corner: 55 },
  uneven: { label: "Uneven", front: [0.085, 0.086, 0.080, 0.063], corner: 50, irregular: 0.8 },
};
export const HAIRLINE_DEFAULTS = { shape: "soft_round", height: 0, temples: 0, peak: 0, sideburns: 0.5, nape: 0.5, napeShape: "round", irregular: 0.25, soft: 0.5, seed: 1,
  thinning: "none", thinAmount: 0.6, thinSize: 0.5 };

// a smooth curve through (xs, ys): Catmull-Rom, flat past the ends
function curve(xs, ys) {
  return x => {
    if (x <= xs[0]) return ys[0];
    const n = xs.length; if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (x > xs[i + 1]) i++;
    const t = (x - xs[i]) / (xs[i + 1] - xs[i]), p0 = ys[Math.max(0, i - 1)], p1 = ys[i], p2 = ys[i + 1], p3 = ys[Math.min(n - 1, i + 2)];
    return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);
  };
}
// smooth noise along the hairline: the same for a seed, different each side
function wobble(seed) {
  const r = rng(seed * 7919 + 13), ph = Array.from({ length: 6 }, () => r() * 6.283), am = [0.5, 0.3, 0.25, 0.2, 0.15, 0.1], fr = [1, 2.3, 3.7, 5.9, 8.3, 12.1];
  return az => { let s = 0; for (let i = 0; i < 6; i++) s += am[i] * Math.sin(fr[i] * az * D * 3 + ph[i]); return s; };
}

export function hairline(h = {}) {
  const s = Object.assign({}, HAIRLINE_DEFAULTS, h), K = HAIRLINES[s.shape] || HAIRLINES.soft_round;
  const f = K.front.map(y => y + 0.001 * s.height);                     // Height: millimetres, the whole front
  f[2] += 0.001 * s.temples; f[3] += 0.0006 * s.temples;               // Temples: millimetres back at the corners (the M)
  const pk = 0.001 * s.peak;                                           // Peak: millimetres down at the middle (over the shape's own)
  const corner = K.corner, front = curve([0, 18, 34, corner], f);
  const burn = lerp(0.016, -0.05, clamp(s.sideburns, 0, 1));           // Sideburns: none (level with the ear's top) to long (the lobe)
  const nape = lerp(-0.058, -0.088, clamp(s.nape, 0, 1));              // Nape: high to low
  const irr = (s.irregular ?? 0) + (K.irregular || 0), wl = wobble(s.seed), wr = wobble(s.seed + 101);
  return az => {
    const a = Math.abs(az), w = irr > 0 ? (az >= 0 ? wl(a) : wr(a)) * 0.004 * irr : 0;
    let y;
    if (a <= corner) y = front(a) - pk * Math.exp(-(a * a) / (2 * 7 * 7));
    else if (a < corner + 8) y = lerp(f[3], burn, smooth(corner, corner + 8, a));   // down the temple's front edge to the sideburn's foot
    else if (a < 79) y = burn;
    else if (a < 85) y = lerp(burn, 0, smooth(79, 85, a));               // the sideburn ends at the ear
    else if (a < 104) y = 0;                                             // over the ear the hair comes down to it (the ear itself is cut out of the pores); nothing under it
    else if (a < 118) y = lerp(0, -0.042, smooth(104, 118, a));          // behind the ear, down to the nape's corner
    else {
      const t = smooth(118, 150, a), side = lerp(-0.042, nape + 0.012, t);
      const mid = smooth(150, 180, a);                                   // the nape's middle: round dips a little, V more, straight not at all
      y = s.napeShape === "straight" ? Math.min(side, lerp(side, nape + 0.006, mid)) : s.napeShape === "v" ? lerp(side, nape - 0.012, mid * mid) : lerp(side, nape, mid);
    }
    return Math.max(masterLimit(az) + 0.0005, y + w);
  };
}

// ---- thinning: how much hair is left at a place (1 full, 0 bald), by distance over the head from where it thins -------
const VERTEX = [0, 0.118, -0.06], CROWN = [0, 0.098, -0.105], FRONT = [0, 0.1, 0.02];
const away = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
export const THINNING = { none: "None", crown: "Crown", top: "Top", front: "Front", horseshoe: "Horseshoe", all: "All over" };
export function density(h, x, y, z, az) {
  const s = h.thinning || "none", a = clamp(h.thinAmount ?? 0.6, 0, 1), k = 0.6 + 0.8 * clamp(h.thinSize ?? 0.5, 0, 1), p = [x, y, z];
  if (s === "none" || a <= 0) return 1;
  if (s === "all") return 1 - 0.85 * a;
  let bald = 0;
  if (s === "crown") bald = 1 - smooth(0.035 * k, 0.075 * k, away(p, CROWN));
  else if (s === "front") bald = 1 - smooth(0.03 * k, 0.08 * k, away(p, FRONT));
  else if (s === "top") bald = Math.max(1 - smooth(0.04 * k, 0.085 * k, away(p, VERTEX)), 1 - smooth(0.03 * k, 0.07 * k, away(p, FRONT)));
  else if (s === "horseshoe") {                                           // everything above a line round the head: over the ears' tops, dipping at the back
    const line = lerp(0.075, 0.05, smooth(60, 160, Math.abs(az))) + 0.03 * (1 - k);
    bald = smooth(line - 0.012, line + 0.012, y);
  }
  return 1 - a * bald;
}

// ---- reading, placing, choosing ---------------------------------------------------------------------------------------
export function readPores(buf) {
  const dv = new DataView(buf), hl = dv.getUint32(0, true), h = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl)));
  let at = 4 + hl; at += (4 - (at % 4)) % 4;
  const take = (C, n) => { const a = new C(buf.slice(at, at + n * C.BYTES_PER_ELEMENT)); at += n * C.BYTES_PER_ELEMENT; return a; };
  const n = h.n, tri = take(Uint32Array, n), bary = take(Float32Array, n * 2), base = take(Float32Array, n * 3), u = take(Float32Array, n), mirror = take(Uint32Array, n);
  const az = new Float32Array(n); for (let i = 0; i < n; i++) az[i] = chartAz(base[i * 3], base[i * 3 + 2], h.C);
  return { n, tri, bary, base, az, u, mirror, C: h.C, header: h };
}
export function writePores(P) {                                         // (pores.mjs)
  const h = new TextEncoder().encode(JSON.stringify(P.header)), pad = (4 - ((4 + h.length) % 4)) % 4;
  const parts = [P.tri, P.bary, P.base, P.u, P.mirror], size = 4 + h.length + pad + parts.reduce((a, x) => a + x.byteLength, 0), out = new Uint8Array(size);
  new DataView(out.buffer).setUint32(0, h.length, true); out.set(h, 4);
  let at = 4 + h.length + pad; for (const x of parts) { out.set(new Uint8Array(x.buffer, x.byteOffset, x.byteLength), at); at += x.byteLength; }
  return out;
}

// each pore on a body: its place and the skin's smooth normal there
export function place(P, L, T, VN) {
  const pos = new Float32Array(P.n * 3), nrm = new Float32Array(P.n * 3);
  for (let i = 0; i < P.n; i++) {
    const t = P.tri[i] * 3, a = T[t] * 3, b = T[t + 1] * 3, c = T[t + 2] * 3, wa = P.bary[i * 2], wb = P.bary[i * 2 + 1], wc = 1 - wa - wb;
    for (let k = 0; k < 3; k++) { pos[i * 3 + k] = L[a + k] * wa + L[b + k] * wb + L[c + k] * wc; nrm[i * 3 + k] = VN[a + k] * wa + VN[b + k] * wb + VN[c + k] * wc; }
    const l = Math.hypot(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]) || 1; nrm[i * 3] /= l; nrm[i * 3 + 1] /= l; nrm[i * 3 + 2] /= l;
  }
  return { pos, nrm };
}

// which of the first `count` pores grow hair under a hairline and its thinning. A pore is in when it's above the edge
// and its own fixed number is under the hair left there: the edge's last centimetre thins out (Soft edge), a thinning
// patch thins gradually, the same every time. edge: 0 at the hairline to 1 a centimetre and a half inside it.
export function alive(P, h = {}, count = P.n) {
  const s = Object.assign({}, HAIRLINE_DEFAULTS, h), lim = hairline(s), n = Math.min(count, P.n), on = new Uint8Array(P.n), edge = new Float32Array(P.n);
  const band = 0.004 + 0.012 * clamp(s.soft, 0, 1);
  let m = 0;
  for (let i = 0; i < n; i++) {
    const x = P.base[i * 3], y = P.base[i * 3 + 1], z = P.base[i * 3 + 2], az = P.az[i], above = y - lim(az);
    if (above <= 0) continue;
    const inside = Math.min(edgeDistance(lim, az, y), earGap(az, y) + 0.002);   // along the scalp rather than straight up (the edge runs steeply by the temples); the ear's outline is an edge too
    edge[i] = clamp(inside / 0.015, 0, 1);
    let keep = density(s, x, y, z, az);
    if (s.soft > 0) keep *= lerp(0.35, 1, smooth(0, band, inside));
    if (P.u[i] < keep) { on[i] = 1; m++; }
  }
  return { on, edge, n: m };
}
// how far (m) a point at (az, y) is inside the hairline, counting the edge to its sides too (2.2 mm a degree at the temple)
function edgeDistance(lim, az, y) {
  let best = y - lim(az);
  for (let d = 2; d <= 14; d += 2) for (const sgn of [-1, 1]) {
    const a = az + sgn * d, up = y - lim(a), side = d * 0.0016;
    if (up <= 0) { best = Math.min(best, side); continue; }
    best = Math.min(best, Math.hypot(side, up));
  }
  return Math.max(0, best);
}
